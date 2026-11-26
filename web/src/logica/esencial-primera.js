// FBE Esencial (alta, tanda 3): la primera semana de quien va por su cuenta. Los textos son los de las guías de Pelayo (las
// lecciones aprobadas el 25/11/2026 y la guía «Cómo empezar»). Lógica pura.
import { sobran } from './esencial.js';

// (42) «¿Qué peso pongo?», junto a un ejercicio sin kilos la primera vez. rir: lo que le tienen que sobrar (4,5 → «4-5»)
const EN_LETRA = { 1: 'una', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', '1-2': 'una o dos', '2-3': 'dos o tres', '3-4': 'tres o cuatro', '4-5': 'cuatro o cinco' };
export function textoQuePeso(rir) {
  const s = sobran(rir);
  const meta = EN_LETRA[s] || 'cuatro o cinco';
  return `El primer día no lo sabe nadie. Empieza con poco, haz doce repeticiones y pregúntate cuántas más habrías podido hacer: si habrías hecho diez más, sube; si ninguna, baja. Buscas el peso con el que te sobren ${meta}.`;
}

// (43) Tras la primera serie de un ejercicio sin kilos: la regla de la guía. rpe: el que apuntó (te sobran 10 − rpe).
// Le sobraban muchas (8 o más): que suba; ninguna: que baje. Si no, nada que decir.
export function consejoPeso(rpe) {
  const r = Number(rpe);
  if (rpe == null || rpe === '' || !Number.isFinite(r)) return null;
  const s = 10 - r;
  if (s >= 8) return 'Te sobraban muchas: en la siguiente serie, sube un poco el peso.';
  if (s <= 0) return 'No te sobró ninguna: en la siguiente serie, baja un poco el peso.';
  return null;
}

// (46 y 49) Al terminar su primera sesión: cuándo es la siguiente y las agujetas. siguiente: { nombre, dia_previsto } o null;
// hoy: 'AAAA-MM-DD'
export function textoSiguiente(siguiente, hoy, fechaLarga = (x) => x) {
  if (!siguiente) return null;
  if (siguiente.dia_previsto && String(siguiente.dia_previsto).slice(0, 10) > hoy) return `La siguiente, «${siguiente.nombre}», el ${fechaLarga(String(siguiente.dia_previsto).slice(0, 10))}.`;
  // (en fin de semana ya no cabe «esta semana»)
  const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay();
  if (dia === 0 || dia === 6) return `La siguiente, «${siguiente.nombre}», cuando puedas, dejando un día entre una y otra.`;
  return `La siguiente, «${siguiente.nombre}», cuando te venga bien esta semana, mejor sin que vaya seguida de esta: deja un día entre una y otra.`;
}
// El consejo de «¿Cómo llegas hoy?» (logica/preparacion.js) para quien va por su cuenta: el mismo nivel y lo mismo que
// hacer, sin «cuéntaselo a tu coach» ni el RPE. c: lo de consejoPreparacion
const CONSEJO_SUYO = {
  malo: 'Haz la sesión sin apretar más de lo que toca y, si hace falta, quita una serie en los accesorios. Si una molestia cambia cómo te mueves o va a más, para ese ejercicio y, si no mejora, consúltalo con tu médico.',
  flojo: 'Guíate por lo que te tiene que sobrar: si las series pesan más de lo normal, quédate en la parte baja del rango.',
};
export const textoConsejo = (c, suyo = false) => (c?.unToque && c.texto) || (suyo && CONSEJO_SUYO[c?.nivel]) || c?.texto || '';   // (v0.258) el de un toque, el suyo
export const TEXTO_AGUJETAS = 'Mañana o pasado puede que notes agujetas: son normales las dos primeras semanas. Luego bajan, y no dicen si entrenaste bien o mal.';
