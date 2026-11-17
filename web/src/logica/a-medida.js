// «A su medida» (migración 080): la individualización de cada atleta que escribe su coach. Lo puro:
//   · la forma de `atletas.propio` y su limpieza (la app nunca se fía de lo guardado): frases por momento, frases de un
//     ejercicio concreto y márgenes de ritmo de peso;
//   · qué frase toca (rotan sin repetirse hasta haberlas visto todas; la misma mientras dura su momento);
//   · cuándo es día de pierna, cuándo empieza la semana antes de tiempo y cuándo un esfuerzo se pasa de lo pautado;
//   · el aviso de ritmo de peso, con la tendencia de varias semanas y los márgenes de ese atleta.
// Nada de aquí cambia la programación: son frases, imágenes y un aviso. Sin nada guardado, el atleta ve lo de siempre.
import { tendenciaPeso, ritmoPeso } from './calculos.js';
import { diasEntre } from './fechas.js';

// Los momentos: [clave, nombre, cuándo sale]
export const MOMENTOS = [
  ['saludo', 'Saludo en Hoy', 'Arriba en Hoy, una al día.'],
  ['pierna', 'Día de pierna', 'En Hoy, el día que le toca pierna.'],
  ['antes', 'Empieza la semana antes de tiempo', 'Al abrir una sesión de una semana que aún no ha empezado.'],
  ['semana', 'Semana completa', 'En Hoy, con todas las sesiones de la semana hechas.'],
  ['record', 'Récord', 'En el resumen de la sesión en la que bate una marca.'],
  ['gamberrada', 'Esfuerzo por encima de lo pautado', 'Al apuntar una serie muy por encima del RPE pautado o una serie de más.'],
  ['peso_baja', 'Ritmo de peso: baja demasiado rápido', 'Con el aviso de ritmo de peso, cuando baja más de su margen.'],
  ['peso_sube', 'Ritmo de peso: sube demasiado rápido', 'Con el aviso de ritmo de peso, cuando sube más de su margen.'],
  ['varias', 'Varias', 'De vez en cuando, en lugar del saludo.'],
];
export const CLAVES_MOMENTO = MOMENTOS.map(([k]) => k);
export const LIMITES = { frase: 160, porMomento: 12, ejercicios: 8, textoEjercicio: 40 };

// Los huecos de imagen: [clave, nombre, forma, dónde sale]
export const HUECOS = [
  ['perfil', 'Perfil y carné', 'apaisada', 'En la cabecera de su perfil (si no ha puesto su foto de portada) y en su carné.'],
  ['antes', 'Empieza antes', 'cuadrada', 'Junto a la frase, cuando empieza la semana antes de tiempo.'],
  ['record', 'Récord', 'cuadrada', 'Junto a la frase, en el resumen de una sesión con récord.'],
];
export const CLAVES_HUECO = HUECOS.map(([k]) => k);
export const MAX_IMAGEN = 600000;   // como la restricción de la base (letras de la data URL)
export const imagenValida = (t) => typeof t === 'string' && t.length >= 200 && t.length <= MAX_IMAGEN && /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(t);

// Los márgenes de ritmo de peso. Definición (Helms): perder entre un 0,5 y un 1 % del peso por semana; aviso al pasar
// del 1 %. Volumen, según nivel: cuanto más avanzado, más despacio (al mes).
export const MARGEN_BAJA = 1;
export const MARGEN_SUBE_NIVEL = [['principiante', 'Principiante', 1.5], ['intermedio', 'Intermedio', 1], ['avanzado', 'Avanzado', 0.5]];
const margen = (v, max) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0.1 && n <= max ? Math.round(n * 100) / 100 : null;
};

const unaLinea = (t, max) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, max).trim();
const frasesLimpias = (lista) => {
  const out = [];
  for (const f of Array.isArray(lista) ? lista : []) {
    const t = typeof f === 'string' ? unaLinea(f, LIMITES.frase) : '';
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= LIMITES.porMomento) break;
  }
  return out;
};
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Lo guardado, limpio: { frases, ejercicios, peso } o null si no hay nada que valga
export function leerPropio(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const frases = {};
  for (const k of CLAVES_MOMENTO) { const l = frasesLimpias(p.frases?.[k]); if (l.length) frases[k] = l; }
  const ejercicios = [];
  for (const e of Array.isArray(p.ejercicios) ? p.ejercicios : []) {
    const texto = unaLinea(e?.texto, LIMITES.textoEjercicio), l = frasesLimpias(e?.frases);
    if (texto.length >= 3 && l.length && !ejercicios.some((x) => sinTildes(x.texto) === sinTildes(texto))) ejercicios.push({ texto, frases: l });
    if (ejercicios.length >= LIMITES.ejercicios) break;
  }
  const baja = margen(p.peso?.baja_semana, 3), sube = margen(p.peso?.sube_mes, 5);
  const peso = baja != null || sube != null ? { baja_semana: baja, sube_mes: sube } : null;
  if (!Object.keys(frases).length && !ejercicios.length && !peso) return null;
  return { frases, ejercicios, peso };
}
// Para guardar en la base: lo mismo, con su versión; null si se queda vacío
export function paraGuardarPropio(p) {
  const l = leerPropio(p);
  return l ? { v: 1, frases: l.frases, ejercicios: l.ejercicios, ...(l.peso ? { peso: l.peso } : {}) } : null;
}
export const cuantasFrases = (p) => { const l = leerPropio(p); return l ? Object.values(l.frases).reduce((n, x) => n + x.length, 0) + l.ejercicios.reduce((n, x) => n + x.frases.length, 0) : 0; };

// Las frases de un momento; con `ejercicio` (su nombre), las del primero de «sus ejercicios» cuyo texto contenga
export function frasesDe(propio, momento, { ejercicio = '' } = {}) {
  const l = leerPropio(propio);
  if (!l) return [];
  if (momento === 'ejercicio') {
    const n = sinTildes(ejercicio);
    if (!n) return [];
    // (el texto más largo primero: «sentadilla búlgara» antes que «sentadilla»)
    const e = [...l.ejercicios].sort((a, b) => b.texto.length - a.texto.length).find((x) => n.includes(sinTildes(x.texto)));
    return e ? e.frases : [];
  }
  return l.frases[momento] || [];
}

// Qué frase toca. estado: { vistas: { momento: [frases ya vistas] }, fijas: { clave: frase } } (lo recuerda el móvil).
// Con `clave` (el día, la sesión…), la misma frase mientras dure; si no, la siguiente que no haya visto; cuando las ha
// visto todas, se empieza otra vez (sin repetir la última). Devuelve { frase, estado } (estado nuevo, sin tocar el dado).
export function elegirFrase(frases, estado, { momento, clave = null, azar = Math.random } = {}) {
  const lista = Array.isArray(frases) ? frases : [];
  const e = { vistas: { ...(estado?.vistas || {}) }, fijas: { ...(estado?.fijas || {}) } };
  if (!lista.length) return { frase: null, estado: e };
  const k = clave ? `${momento}:${clave}` : null;
  if (k && lista.includes(e.fijas[k])) return { frase: e.fijas[k], estado: e };
  let vistas = (Array.isArray(e.vistas[momento]) ? e.vistas[momento] : []).filter((f) => lista.includes(f));
  let quedan = lista.filter((f) => !vistas.includes(f));
  if (!quedan.length) { const ultima = vistas[vistas.length - 1]; vistas = lista.length > 1 && ultima ? [ultima] : []; quedan = lista.filter((f) => !vistas.includes(f)); }
  const frase = quedan[Math.min(quedan.length - 1, Math.floor(azar() * quedan.length))];
  e.vistas[momento] = [...vistas, frase];
  if (k) {
    e.fijas[k] = frase;
    // (solo las 24 últimas: lo de días pasados no hace falta)
    const claves = Object.keys(e.fijas);
    for (const vieja of claves.slice(0, Math.max(0, claves.length - 24))) delete e.fijas[vieja];
  }
  return { frase, estado: e };
}

// ¿«Varias» en lugar del saludo? Uno de cada cuatro días (siempre el mismo para ese día), si las hay
export function tocaVarias(hoy, propio) {
  const l = leerPropio(propio);
  if (!l?.frases.varias?.length) return false;
  if (!l.frases.saludo?.length) return true;
  const n = Math.round(Date.parse(`${hoy}T00:00:00Z`) / 864e5);
  return Number.isFinite(n) && n % 4 === 0;
}

// ¿Es día de pierna? Por el nombre de la sesión («Pierna», «Tren inferior»…) o porque dos de cada tres series son de
// pierna (cuerpo completo y torso-pierna no cuentan).
const GRUPOS_PIERNA = new Set(['cuadriceps', 'gluteo', 'isquiotibiales', 'gemelo', 'aductores']);
export function esDiaDePierna(sesion, ejercicios = []) {
  const n = sinTildes(sesion?.nombre);
  if (/\b(torso|full|cuerpo completo|empuje|tiron)\b/.test(n)) return false;
  if (/\b(pierna|piernas|tren inferior|leg|legs)\b/.test(n)) return true;
  let total = 0, pierna = 0;
  for (const e of ejercicios || []) {
    const s = Number(e?.series) || 0, g = (e?.ejercicio?.grupos_musculares || e?.grupos_musculares || [])[0];
    if (!s || !g) continue;
    total += s;
    if (GRUPOS_PIERNA.has(g)) pierna += s;
  }
  return total >= 6 && pierna / total >= 2 / 3;
}

// ¿Empieza la semana antes de tiempo? La semana tiene fecha y aún no ha llegado
export const semanaAdelantada = (semana, hoy) => !!semana?.fecha_inicio && !!hoy && semana.fecha_inicio > hoy;

// ¿Se ha pasado de lo pautado? Una serie apuntada 1,5 puntos o más por encima del RPE pautado (o del que sale de su
// RIR), o una serie de más (por encima de las pautadas). Devuelve 'rpe' | 'serie' | null.
export function gamberrada({ pauta = {}, numero = 0, rpe = null } = {}) {
  const objetivo = pauta.rpe_objetivo != null && pauta.rpe_objetivo !== '' ? Number(pauta.rpe_objetivo)
    : pauta.rir_objetivo != null && pauta.rir_objetivo !== '' ? 10 - Number(pauta.rir_objetivo) : null;
  const hecho = rpe === '' || rpe == null ? null : Number(rpe);
  if (objetivo != null && Number.isFinite(objetivo) && hecho != null && Number.isFinite(hecho) && hecho - objetivo >= 1.5) return 'rpe';
  const series = Number(pauta.series) || 0;
  if (series > 0 && Number(numero) > series) return 'serie';
  return null;
}

// El aviso de ritmo de peso. pesos: [{ fecha, kg }]; fase: la de su plan de nutrición ('perder', 'ganar'…), si lo tiene.
// Mira la tendencia de las últimas 4 semanas (hacen falta al menos 4 pesos que abarquen 2 semanas y uno de los últimos
// 10 días). En definición solo avisa de bajar; en volumen, solo de subir; sin fase, de las dos cosas.
// Devuelve null o { tipo: 'baja' | 'sube', pct, margen, cada: 'semana' | 'mes', texto }.
const DIAS_MES = 30.44;
const pct = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
export function avisoRitmoPeso(pesos = [], propio = null, { fase = null, hoy } = {}) {
  const m = leerPropio(propio)?.peso;
  if (!m || !hoy) return null;
  const serie = tendenciaPeso((pesos || []).filter((p) => p?.fecha && p.fecha <= hoy));
  const ultimo = serie[serie.length - 1];
  if (!ultimo || diasEntre(ultimo.fecha, hoy) > 10) return null;
  const tramo = serie.filter((p) => diasEntre(p.fecha, ultimo.fecha) <= 28);
  if (tramo.length < 4 || diasEntre(tramo[0].fecha, ultimo.fecha) < 14) return null;
  const ritmo = ritmoPeso(serie, 28);
  if (!ritmo) return null;
  const semana = Number(ritmo.pctSemana) || 0;
  if (m.baja_semana != null && fase !== 'ganar' && -semana > m.baja_semana) {
    return { tipo: 'baja', pct: Math.round(-semana * 10) / 10, margen: m.baja_semana, cada: 'semana',
      texto: `Tu peso baja un ${pct(-semana)} % a la semana (lo buscado: hasta un ${pct(m.baja_semana)} %). Tan rápido se pierde también músculo: coméntalo con tu coach.` };
  }
  const mes = semana * DIAS_MES / 7;
  if (m.sube_mes != null && fase !== 'perder' && mes > m.sube_mes) {
    return { tipo: 'sube', pct: Math.round(mes * 10) / 10, margen: m.sube_mes, cada: 'mes',
      texto: `Tu peso sube un ${pct(mes)} % al mes (lo buscado: hasta un ${pct(m.sube_mes)} %). Tan rápido no todo es músculo: coméntalo con tu coach.` };
  }
  return null;
}
