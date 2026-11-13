// «La travesía» (remate, tanda 5): el sonido del juego, hecho en el móvil (sin descargar nada). Pisadas según lo que pisa
// (hierba, nieve, madera de cornisas y puentes), el viento, que sube con la velocidad, y un eco en la montaña. Además,
// «jugar sin mirar»: pitidos en estéreo que avisan de cada obstáculo (más agudos cuanto más cerca; dos para el monte,
// grave para la rama). Va por el mismo contexto de audio que el resto y respeta el ajuste general de sonido.
import { contextoAudio, prepararAudio } from './sesion-comun.jsx';
import { leerAjustes } from '../ajustes.js';

export function crearSonido() {
  prepararAudio();
  const ac = contextoAudio();
  if (!ac || !leerAjustes().sonido) return null;
  const vol = Math.min(1, Math.max(0.1, Number(leerAjustes().volumen) || 1));
  const salida = ac.createGain(); salida.gain.value = 0.9 * vol; salida.connect(ac.destination);
  // (el eco de la montaña: un retardo con algo de vuelta, que solo se abre en la montaña)
  const eco = ac.createDelay(1); eco.delayTime.value = 0.28;
  const vuelta = ac.createGain(); vuelta.gain.value = 0.32;
  const ecoSale = ac.createGain(); ecoSale.gain.value = 0;
  eco.connect(vuelta).connect(eco); eco.connect(ecoSale).connect(salida);
  // Un poco de ruido para pisadas y viento
  const ruido = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
  const d = ruido.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // El viento: ruido en bucle por un filtro, con el volumen de la velocidad
  const viento = ac.createBufferSource(); viento.buffer = ruido; viento.loop = true;
  const vFiltro = ac.createBiquadFilter(); vFiltro.type = 'bandpass'; vFiltro.frequency.value = 500; vFiltro.Q.value = 0.6;
  const vGain = ac.createGain(); vGain.gain.value = 0;
  viento.connect(vFiltro).connect(vGain).connect(salida); viento.start();
  const golpe = (destino, { tipo = 'hierba', fuerte = 1 } = {}) => {
    const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = ruido;
    const f = ac.createBiquadFilter(), g = ac.createGain();
    if (tipo === 'nieve') { f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 1.4; }
    else if (tipo === 'madera') { f.type = 'lowpass'; f.frequency.value = 700; }
    else { f.type = 'lowpass'; f.frequency.value = 1300; }
    const dura = tipo === 'nieve' ? 0.09 : 0.05;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((tipo === 'madera' ? 0.22 : 0.12) * fuerte, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dura);
    s.connect(f).connect(g).connect(destino); s.start(t, Math.random() * 0.8, dura + 0.02);
    if (tipo === 'madera') tonoEn(destino, 180, 0.07, 0.12 * fuerte, 'triangle');
  };
  const tonoEn = (destino, fr, dura, v, tipo = 'sine', pan = 0) => {
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo; o.frequency.value = fr;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dura);
    let fin = g;
    if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); fin = p; }
    o.connect(g); fin.connect(destino); o.start(t); o.stop(t + dura + 0.03);
  };
  let montana = false, vivo = true;
  return {
    // el terreno de esta etapa: en la montaña, eco
    lugar(paisaje) { montana = paisaje === 0; ecoSale.gain.setTargetAtTime(montana ? 0.5 : 0, ac.currentTime, 0.3); },
    paso(tipo) { if (vivo) golpe(salida, { tipo }); },
    // un efecto del juego (los tonos de siempre, con eco en la montaña)
    efecto([fr, dura, v]) { if (!vivo) return; tonoEn(salida, fr, dura, v); if (montana) tonoEn(eco, fr, dura, v * 0.8); },
    viento(v) { if (vivo) vGain.gain.setTargetAtTime(Math.max(0, Math.min(0.09, (v - 5) * 0.018)), ac.currentTime, 0.25); },
    // jugar sin mirar: un pitido que viene de la derecha (de donde llegan las cosas)
    aviso(tipo, cerca) {
      if (!vivo) return;
      const fr = tipo === 'rama' ? 260 : 620 + cerca * 520;
      tonoEn(salida, fr, 0.09, 0.2, tipo === 'rama' ? 'triangle' : 'sine', 0.7 - cerca * 0.6);
      if (tipo === 'monte') setTimeout(() => vivo && tonoEn(salida, fr * 1.25, 0.09, 0.2, 'sine', 0.4), 110);
    },
    parar() {
      if (!vivo) return;
      vivo = false;
      try { salida.gain.setTargetAtTime(0.0001, ac.currentTime, 0.15); setTimeout(() => { try { viento.stop(); salida.disconnect(); } catch { /* */ } }, 900); } catch { /* */ }
    },
  };
}
