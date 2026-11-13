// «La travesía» (top, tanda 3): una música que crece con la racha, hecha en el móvil (sin descargar nada). Cuatro capas
// sobre una escala pentatónica, a 96 pulsos por minuto: un fondo suave siempre; el bajo, con 4 seguidos sin tropezar;
// el arpegio, con el combo ×2; y unas campanas, con el ×3. Al tropezar se quedan solo el fondo y el bajo se va apagando.
// Apagada de entrada (su botón, en el juego); respeta el ajuste general de sonido y va por el mismo canal que el resto.
import { contextoAudio, prepararAudio } from './sesion-comun.jsx';
import { leerAjustes } from '../ajustes.js';
import { volumenDe } from '../../logica/sonido.js';

const PULSO = 60 / 96 / 2;   // una corchea, en s
// Los acordes (en semitonos sobre La 220 Hz) y la escala de la que salen las notas
const ACORDES = [[0, 7, 12], [-4, 3, 8], [3, 10, 15], [-2, 5, 10]];   // La m, Fa, Do, Sol
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const hz = (st, base = 220) => base * 2 ** (st / 12);

export function crearMusica() {
  prepararAudio();
  const ac = contextoAudio();
  if (!ac || !leerAjustes().sonido) return null;
  const salida = ac.createGain(); salida.gain.value = 0.0001; salida.connect(ac.destination);
  salida.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.5 * volumenDe(leerAjustes(), 'juego')), ac.currentTime + 1.2);   // (sonido, tanda 1) su apartado
  const capa = (v) => { const g = ac.createGain(); g.gain.value = v; g.connect(salida); return g; };
  const capas = { fondo: capa(1), bajo: capa(0), arpegio: capa(0), campanas: capa(0) };
  let estado = { serie: 0, combo: 1 }, paso = 0, siguiente = ac.currentTime + 0.1, vivo = true;
  const nota = (dest, f, t, dura, vol, tipo = 'sine') => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dura);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dura + 0.05);
  };
  // El fondo: dos notas largas por compás (raíz y quinta del acorde), muy suaves
  const programar = () => {
    if (!vivo) return;
    while (siguiente < ac.currentTime + 0.25) {
      const acorde = ACORDES[Math.floor(paso / 32) % ACORDES.length], t = siguiente, enCompas = paso % 8;
      if (enCompas === 0) { nota(capas.fondo, hz(acorde[0], 110), t, PULSO * 8, 0.05, 'triangle'); nota(capas.fondo, hz(acorde[1], 110), t, PULSO * 8, 0.035); }
      if (enCompas === 0 || enCompas === 4) nota(capas.bajo, hz(acorde[0], 55), t, PULSO * 1.6, 0.16, 'triangle');
      if (enCompas % 2 === 0 || estado.combo >= 3) { const i = (paso * 3 + Math.floor(paso / 8)) % 5; nota(capas.arpegio, hz(acorde[0] + PENTA[i + 2]), t, PULSO * 1.4, 0.05); }
      if (paso % 3 === 1) nota(capas.campanas, hz(PENTA[(paso * 7) % PENTA.length] + 12 + acorde[0]), t, PULSO * 2.5, 0.03);
      paso += 1; siguiente += PULSO;
    }
  };
  const reloj = setInterval(programar, 90);
  programar();
  const fijar = (g, v) => { g.gain.cancelScheduledValues(ac.currentTime); g.gain.setTargetAtTime(v, ac.currentTime, 0.4); };
  return {
    // serie: saltados seguidos sin tropezar; combo: el multiplicador
    actualizar({ serie = 0, combo = 1 } = {}) {
      if (serie === estado.serie && combo === estado.combo) return;
      estado = { serie, combo };
      fijar(capas.bajo, serie >= 4 ? 1 : 0);
      fijar(capas.arpegio, combo >= 2 ? 1 : 0);
      fijar(capas.campanas, combo >= 3 ? 1 : 0);
    },
    parar() {
      if (!vivo) return;
      vivo = false; clearInterval(reloj);
      try { salida.gain.cancelScheduledValues(ac.currentTime); salida.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25); setTimeout(() => { try { salida.disconnect(); } catch { /* */ } }, 1500); } catch { /* */ }
    },
  };
}
