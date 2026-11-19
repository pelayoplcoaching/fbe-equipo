// (v0.187) El banco de las tarjetas de compartir: las pinta todas (plantillas x formatos x nombres cortos y largos, con y
// sin récord, y los logros) y apunta dónde cae cada texto, para que e2e-compartir-187.mjs compruebe que nada se sale ni
// se monta. Se compila aparte (no va en la app).
import { dibujarTarjeta, dibujarLogro } from '../web/src/ui/Compartir.jsx';
import { datosRacha, datosSemanaCompleta, datosRecordDeSesion, datosEquipoSemana, FORMATOS } from '../web/src/logica/compartir.js';

const base = { subtitulo: 'Bloque 3 · Semana 2', fecha: '2026-11-18', series: 18, tonelaje: 4230, minutos: 62,
  mejores: [{ nombre: 'Press banca', serie: '82,5 kg × 5' }, { nombre: 'Remo con barra', serie: '70 kg × 8' }, { nombre: 'Press militar con mancuernas sentado en banco', serie: '22 kg × 10' }, { nombre: 'Jalón al pecho', serie: '60 kg × 10' }, { nombre: 'Curl de bíceps en polea baja', serie: '25 kg × 12' }, { nombre: 'Extensión de tríceps', serie: '30 kg × 12' }] };
const SESIONES = {
  corta: { ...base, nombre: 'Torso A', records: [{ nombre: 'Press banca', texto: '82,5 kg × 5' }] },
  larga: { ...base, nombre: 'Pierna: cuádriceps y glúteo con mucho volumen', records: [] },
  largaR: { ...base, nombre: 'Pierna: cuádriceps y glúteo con mucho volumen', records: [{ nombre: 'Sentadilla trasera con barra alta y pausa', texto: '120 kg × 3' }, { nombre: 'Prensa inclinada', texto: '260 kg × 8' }] },
  palabra: { ...base, subtitulo: '', nombre: 'Superextraordinariamente largo', records: [] },
};
const LOGROS = {
  racha: datosRacha(12, { sesiones: 41 }, '2026-11-19'),
  semana: datosSemanaCompleta({ lunes: '2026-11-09', domingo: '2026-11-15', hechas: 4, previstas: 4, minutos: 245, tonelaje: 16200, records: 2, racha: 12 }, '2026-11-19'),
  record: datosRecordDeSesion({ nombre: 'Sentadilla trasera con barra alta y pausa de dos segundos', s: { kg: 120, reps: 3 }, r: { tipo: 'e1rm', valor: 131, antes: 127, reps: 3, kg: 120, texto: '120 kg × 3' } }, '2026-11-18'),
  equipo: datosEquipoSemana({ sesiones: 63, semana_completa: 9, miembros: 21, records: 14, retos: 1 }, '2026-11-19'),
};
globalThis.casos = () => {
  const c = [];
  for (const n of Object.keys(SESIONES)) for (const pl of ['cifras', 'minima', 'poster', 'lista', 'record']) for (const [f] of FORMATOS) c.push([`${n}/${pl}/${f}`, 't', n, { plantilla: pl, formato: f, handle: 'ana.entrena', equipo: 'fbecoaching', frase: n === 'corta' ? 'Hoy tocaba y se hizo' : '' }]);
  for (const n of Object.keys(LOGROS)) for (const [f] of FORMATOS) c.push([`logro ${n}/${f}`, 'l', n, { formato: f }]);
  // (v0.190) con tu foto en el recuadro de arriba: todas las plantillas y formatos (la foto cuenta como un texto mas: nada se le monta)
  for (const n of ['corta', 'largaR', 'palabra']) for (const pl of ['cifras', 'minima', 'poster', 'lista', 'record']) for (const [f] of FORMATOS) c.push([`${n}+foto/${pl}/${f}`, 't', n, { plantilla: pl, formato: f, handle: 'ana.entrena', recuadro: true, ...(n === 'largaR' ? { frase: 'Hoy tocaba apretar y se ha apretado' } : {}) }]);
  c.push(['corta+foto/cifras/clara', 't', 'corta', { plantilla: 'cifras', paleta: 'clara', recuadro: true }]);
  c.push(['corta/cifras/clara', 't', 'corta', { plantilla: 'cifras', paleta: 'clara' }], ['logro record/bosque', 'l', 'record', { paleta: 'bosque' }]);
  return c;
};
// Pinta un caso apuntando cada texto: { t, x0, x1, y0, y1 } ya en píxeles de la imagen
const FOTO = document.createElement('canvas');
FOTO.width = 600; FOTO.height = 900;
{ const f = FOTO.getContext('2d'); f.fillStyle = '#2E8B6F'; f.fillRect(0, 0, 600, 900); f.fillStyle = '#F4D9A0'; f.beginPath(); f.arc(300, 360, 150, 0, Math.PI * 2); f.fill(); }
globalThis.pintar = async (i) => {
  const [nombre, tipo, n, o0] = globalThis.casos()[i];
  const o = o0.recuadro ? { ...o0, recuadro: FOTO } : o0;
  const textos = [];
  const pintarImagen = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (im, ...a) {
    if (im === FOTO && a.length === 8) { const T = this.getTransform(); textos.push({ t: '[tu foto]', x0: a[4] * T.a + T.e, x1: (a[4] + a[6]) * T.a + T.e, y0: a[5] * T.d + T.f, y1: (a[5] + a[7]) * T.d + T.f }); }
    return pintarImagen.call(this, im, ...a);
  };
  const P = CanvasRenderingContext2D.prototype, original = P.fillText;
  P.fillText = function (t, x, y, ...r) {
    const m = this.measureText(t), T = this.getTransform();
    // (la pegatina va girada: no se mide; aquí no se pinta ninguna)
    if (!T.b && !T.c && String(t).trim()) {
      const izq = this.textAlign === 'right' ? x - m.width : this.textAlign === 'center' ? x - m.width / 2 : x;
      const alto = this.textBaseline === 'middle' ? [m.actualBoundingBoxAscent, m.actualBoundingBoxDescent] : [m.actualBoundingBoxAscent, m.actualBoundingBoxDescent];
      textos.push({ t: String(t), x0: izq * T.a + T.e, x1: (izq + m.width) * T.a + T.e, y0: (y - alto[0]) * T.d + T.f, y1: (y + alto[1]) * T.d + T.f });
    }
    return original.call(this, t, x, y, ...r);
  };
  try {
    const blob = await (tipo === 'l' ? dibujarLogro(LOGROS[n], o) : dibujarTarjeta(SESIONES[n], o));
    const img = await createImageBitmap(blob);
    return { nombre, ancho: img.width, alto: img.height, textos };
  } finally { P.fillText = original; P.drawImage = pintarImagen; }
};
