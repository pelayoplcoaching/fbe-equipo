// Dibujo generativo y tarjetas de compartir (v0.51), sin pantalla para poder probarlo.
// · La portada de la sesión: un dibujo de líneas propio que sale del nombre de la sesión (la semilla), de su tipo
//   (fuerza, cardio o movilidad) y de su patrón principal (empuje, tirón, pierna o core). La misma sesión tiene siempre
//   el mismo dibujo; dos sesiones distintas, dibujos distintos. Solo geometría: los colores los pone el tema.
// · Las tres tarjetas de compartir una sesión («Cifras», «Mínima» y «Con tu foto»): qué cifras lleva cada una (nunca
//   peso corporal, salud ni nutrición) y cómo se encaja una foto en la tarjeta.
import { num } from './calculos.js';

// Semilla de un texto (FNV-1a de 32 bits) y un generador pequeño (mulberry32): siempre los mismos números
export function semilla(texto = '') {
  let h = 0x811c9dc5;
  for (const ch of String(texto)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export function aleatorio(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (x) => Math.round(x * 10) / 10;
// La familia del patrón principal de la sesión (los de logica/diseno.js)
export function familiaPatron(patron) {
  if (['empuje_h', 'empuje_v'].includes(patron)) return 'empuje';
  if (['tiron_h', 'tiron_v'].includes(patron)) return 'tiron';
  if (['sentadilla', 'bisagra', 'unilateral', 'pierna'].includes(patron)) return 'pierna';
  if (patron === 'core') return 'core';
  if (patron === 'cardio') return 'cardio';
  return 'otro';
}
// El ángulo de las barras de la portada según la familia: el empuje sube, el tirón baja, la pierna va plana
const ANGULO = { empuje: -58, tiron: 32, pierna: 0, core: -40, cardio: -18, otro: -24 };

// La portada: formas en un lienzo de `ancho` × `alto`. motivo: 'discos' (fuerza), 'ondas' (cardio) u 'orbitas'
// (movilidad). Cada forma: { t: 'circulo' | 'linea' | 'trazo', ..., tono: 'acento' | 'claro' | 'tenue', grosor, opacidad }
export function arteSesion({ nombre = '', tipo = 'fuerza', patron = null } = {}, ancho = 400, alto = 260) {
  const rnd = aleatorio(semilla(`${tipo}|${nombre}`));
  const familia = tipo === 'cardio' ? 'cardio' : familiaPatron(patron);
  const motivo = tipo === 'cardio' ? 'ondas' : tipo === 'movilidad' ? 'orbitas' : 'discos';
  const formas = [];
  if (motivo === 'discos') {
    // Discos de competición vistos de frente (anillos concéntricos), apilados en diagonal, y la barra que los cruza
    const cx = ancho * (0.6 + rnd() * 0.24), cy = alto * (0.26 + rnd() * 0.3);
    const n = 4 + Math.floor(rnd() * 3);
    const radio = alto * (0.5 + rnd() * 0.18);
    for (let i = 0; i < n; i++) {
      const r = radio * (1 - i / (n + 0.6));
      formas.push({ t: 'circulo', cx: r2(cx), cy: r2(cy), r: r2(r), tono: i === 1 ? 'acento' : i % 2 ? 'tenue' : 'claro', grosor: i === 1 ? 3 : 1.5, opacidad: r2(0.32 + (i / n) * 0.4) });
    }
    formas.push({ t: 'circulo', cx: r2(cx), cy: r2(cy), r: r2(radio * 0.12), tono: 'acento', grosor: 2.5, opacidad: 0.9 });
    // La barra (y sus paralelas) con el ángulo de la familia
    const a = ((ANGULO[familia] + (rnd() - 0.5) * 10) * Math.PI) / 180;
    const largo = ancho * 1.6;
    const lineas = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < lineas; i++) {
      const off = (i - (lineas - 1) / 2) * (10 + rnd() * 10);
      const px = cx - Math.sin(a) * off, py = cy + Math.cos(a) * off;
      formas.push({ t: 'linea', x1: r2(px - Math.cos(a) * largo / 2), y1: r2(py - Math.sin(a) * largo / 2), x2: r2(px + Math.cos(a) * largo / 2), y2: r2(py + Math.sin(a) * largo / 2), tono: i === 0 ? 'acento' : 'tenue', grosor: i === 0 ? 2.5 : 1, opacidad: i === 0 ? 0.75 : 0.4 });
    }
  } else if (motivo === 'ondas') {
    // Ondas que se superponen, como un pulso o el perfil de una carrera
    const n = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const base = alto * (0.22 + (i / n) * 0.62), amp = 10 + rnd() * 26, onda = 0.6 + rnd() * 1.4, fase = rnd() * Math.PI * 2;
      const pts = [];
      for (let x = -10; x <= ancho + 10; x += 10) pts.push(`${pts.length ? 'L' : 'M'}${r2(x)} ${r2(base + Math.sin((x / ancho) * Math.PI * 2 * onda + fase) * amp)}`);
      formas.push({ t: 'trazo', d: pts.join(''), tono: i === Math.floor(n / 2) ? 'acento' : i % 2 ? 'tenue' : 'claro', grosor: i === Math.floor(n / 2) ? 3 : 1.5, opacidad: r2(0.3 + rnd() * 0.4) });
    }
  } else {
    // Órbitas: elipses que giran alrededor de un centro (el rango de movimiento)
    const cx = ancho * (0.58 + rnd() * 0.25), cy = alto * (0.3 + rnd() * 0.25);
    const n = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const rx = alto * (0.3 + i * 0.12), ry = rx * (0.35 + rnd() * 0.25), giro = Math.round(rnd() * 180);
      formas.push({ t: 'elipse', cx: r2(cx), cy: r2(cy), rx: r2(rx), ry: r2(ry), giro, tono: i === 1 ? 'acento' : i % 2 ? 'tenue' : 'claro', grosor: i === 1 ? 2.5 : 1.3, opacidad: r2(0.35 + rnd() * 0.35) });
    }
    formas.push({ t: 'circulo', cx: r2(cx), cy: r2(cy), r: 6, tono: 'acento', grosor: 2.5, opacidad: 0.9 });
  }
  // Una lluvia de puntos en la esquina de abajo a la izquierda (la textura del papel), siempre poca
  const puntos = 10 + Math.floor(rnd() * 8);
  for (let i = 0; i < puntos; i++) formas.push({ t: 'punto', cx: r2(rnd() * ancho * 0.45), cy: r2(alto * 0.15 + rnd() * alto * 0.5), r: r2(0.8 + rnd() * 1.4), tono: 'tenue', opacidad: r2(0.25 + rnd() * 0.35) });
  return { motivo, familia, ancho, alto, formas };
}

// ---------- tarjetas para compartir una sesión ----------
export const PLANTILLAS_TARJETA = [
  ['cifras', 'Cifras', 'Las cifras en grande'],
  ['minima', 'Mínima', 'El nombre y una cifra'],
  ['foto', 'Con tu foto', 'Elige una foto del móvil'],
];
// d: lo de datosTarjeta (nombre, series, tonelaje en kg, minutos, records). Solo lo del entreno.
export function cifrasTarjeta(d = {}) {
  const out = [];
  if (d.minutos) out.push({ k: 'minutos', v: String(d.minutos), u: 'min', t: 'Duración' });
  out.push({ k: 'series', v: String(d.series || 0), u: '', t: d.series === 1 ? 'Serie' : 'Series' });
  if (d.tonelaje > 0) out.push({ k: 'tonelaje', v: num(Math.round(d.tonelaje / 100) / 10, 1), u: 't', t: 'Tonelaje' });
  const rec = (d.records || []).length;
  if (rec) out.push({ k: 'records', v: String(rec), u: '', t: rec === 1 ? 'Récord' : 'Récords' });
  return out;
}
// La cifra de la tarjeta «Mínima»: los récords si los hay; si no, el tonelaje; si no, los minutos; si no, las series
export function cifraHeroe(d = {}) {
  const c = cifrasTarjeta(d);
  return c.find((x) => x.k === 'records') || c.find((x) => x.k === 'tonelaje') || c.find((x) => x.k === 'minutos') || c.find((x) => x.k === 'series');
}
// Encajar una foto de `w` × `h` en una tarjeta de `W` × `H` sin deformarla (como object-fit: cover): el trozo de
// la foto que se pinta (centrado; un poco más arriba que el centro en las verticales, donde suele estar la cara)
export function encajarFoto(w, h, W = 1080, H = 1350) {
  if (!(w > 0) || !(h > 0)) return null;
  const escala = Math.max(W / w, H / h);
  const sw = W / escala, sh = H / escala;
  const sx = (w - sw) / 2;
  const sy = Math.max(0, Math.min(h - sh, (h - sh) * (h > w ? 0.35 : 0.5)));
  return { sx: Math.round(sx), sy: Math.round(sy), sw: Math.round(sw), sh: Math.round(sh) };
}
