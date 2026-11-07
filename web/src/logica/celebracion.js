// v0.73 (migración 045): la quinta tanda de la comunidad, «momentos y celebración». Lo puro: los aniversarios en FBE, «<Mes> en
// el equipo», los hitos del equipo, las reacciones y pegatinas nuevas y los momentos de 24 horas. La base hace lo mismo (045) y la
// demo (backend-memoria.js) usa estas funciones para imitarla.
import { nombreMes, sumarMes, primerDia, ultimoDia } from './mes.js';
import { REACCIONES } from './comunidad.js';

const capital = (t) => String(t || '').charAt(0).toUpperCase() + String(t || '').slice(1);
// 1000 → «1.000» (como se escriben las cifras en España a partir de 5 cifras… y aquí también en las de 4, que se leen mejor)
export const miles = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ---------------------------------------------------------------- 1. Aniversarios en FBE
// Sumar meses a una fecha (AAAA-MM-DD) como la base (fecha + interval 'n months'): si el día no existe en ese mes, el último
// (31 de enero + 1 mes = 28 o 29 de febrero)
export function sumarMesesFecha(iso, n) {
  const [a, m, d] = String(iso).split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  const anio = Math.floor(t / 12), mes = (t % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}
// Los meses que se cumplen hoy desde el alta, si hoy es justo ese día (null si no): como comunidad_meses_aniversario (045)
export function mesesCumplidos(alta, hoy) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(alta || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(hoy || ''))) return null;
  const [aa, ma] = alta.split('-').map(Number);
  const [ah, mh] = hoy.split('-').map(Number);
  const m = (ah - aa) * 12 + (mh - ma);
  if (m < 1) return null;
  return sumarMesesFecha(alta, m) === hoy ? m : null;
}
// Se celebra al mes, a los 6 meses, al año y cada año más
export const mesesDeAniversario = (m) => Number.isInteger(m) && (m === 1 || m === 6 || (m >= 12 && m % 12 === 0));
export function aniversarioDe(alta, hoy) {
  const m = mesesCumplidos(alta, hoy);
  return mesesDeAniversario(m) ? { meses: m, texto: textoAniversario(m) } : null;
}
// «1 mes», «6 meses», «1 año», «3 años»
export const textoAniversario = (m) => (m === 1 ? '1 mes' : m < 12 ? `${m} meses` : m === 12 ? '1 año' : `${Math.floor(m / 12)} años`);
export const tituloAniversario = (m) => `¡Hoy hace ${textoAniversario(m)} que entrenas con FBE!`;
export const textoAniversarioMuro = (nombre, m) => `${nombre} cumple ${textoAniversario(m)} en FBE 🎉`;

// ---------------------------------------------------------------- 2. «<Mes> en el equipo»
export const DIAS_MES_EQUIPO = 7;
// Del 1 al 7 de cada mes, el mes que acaba de terminar (hoy: AAAA-MM-DD de Madrid); el resto del mes, null
export function mesEquipoDe(hoy) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(hoy || '')) || Number(hoy.slice(8, 10)) > DIAS_MES_EQUIPO) return null;
  const mes = sumarMes(hoy.slice(0, 7), -1);
  return { mes, desde: primerDia(mes), hasta: ultimoDia(mes), nombre: capital(nombreMes(mes)) };
}
export const tituloMesEquipo = (mes) => `${capital(nombreMes(mes))} en el equipo`;
// La reacción más usada (en empate, la que va antes en la lista); sin ninguna, null
export function reaccionMasUsada(tipos = []) {
  const n = {};
  for (const t of tipos) if (REACCIONES_TODAS.some(([k]) => k === t)) n[t] = (n[t] || 0) + 1;
  let mejor = null;
  for (const [k] of REACCIONES_TODAS) if (n[k] && (!mejor || n[k] > n[mejor])) mejor = k;
  return mejor;
}
const plural = (n, uno, varios) => `${n === 1 ? uno : varios}`;
// Las cifras del equipo de la tarjeta (en este orden), solo recuentos
export function cifrasMesEquipo(e = {}) {
  const reac = REACCIONES_TODAS.find(([k]) => k === e.reaccion);
  return [
    ['sesiones', miles(e.sesiones || 0), plural(e.sesiones, 'sesión', 'sesiones')],
    ['semanas', miles(e.semanas_completas || 0), plural(e.semanas_completas, 'semana completa', 'semanas completas')],
    ['records', miles(e.records || 0), plural(e.records, 'récord compartido', 'récords compartidos')],
    ['retos', miles(e.retos || 0), plural(e.retos, 'reto conseguido', 'retos conseguidos')],
    ...(e.racha ? [['racha', String(e.racha), plural(e.racha, 'semana: la racha más larga', 'semanas: la racha más larga')]] : []),
    ...(reac ? [['reaccion', reac[1], `la reacción más usada (${reac[2].toLowerCase()})`]] : []),
  ];
}
export function cifrasMiMes(y = {}) {
  return [
    ['sesiones', String(y.sesiones || 0), plural(y.sesiones, 'sesión', 'sesiones')],
    ['records', String(y.records || 0), plural(y.records, 'récord compartido', 'récords compartidos')],
    ['racha', String(y.racha || 0), plural(y.racha, 'semana de racha', 'semanas de racha')],
    ['dados', String(y.animos_dados || 0), plural(y.animos_dados, 'ánimo dado', 'ánimos dados')],
    ['recibidos', String(y.animos_recibidos || 0), plural(y.animos_recibidos, 'ánimo recibido', 'ánimos recibidos')],
  ];
}
// Los datos de la imagen para compartir (la tarjeta de siempre, Compartir.jsx): solo recuentos, nada de peso, cuerpo ni salud
export function datosImagenMes(r, { mio = false } = {}) {
  const c = mio ? cifrasMiMes(r.yo) : cifrasMesEquipo(r.equipo);
  const [a, b, d, ...resto] = c;
  return {
    nombre: mio ? `Mi ${nombreMes(r.mes)} en FBE` : tituloMesEquipo(r.mes), subtitulo: mio ? 'En el equipo' : 'FBE Equipo', fecha: ultimoDia(r.mes),
    etiquetaFecha: capital(`${nombreMes(r.mes)} de ${r.mes.slice(0, 4)}`),
    cifras: [a, b, d].map(([, v, t]) => [v, t]), series: 0, tonelaje: 0, minutos: null, records: [],
    mejores: resto.map(([, v, t]) => ({ nombre: capital(t), serie: v })), tituloMejores: 'Y además',
    // (imágenes) el fondo de la tarjeta: las lunas para el mes del equipo; para el tuyo, las llamas (tu constancia)
    fondo: mio ? 'racha' : 'mes',
  };
}

// ---------------------------------------------------------------- 3. Hitos del equipo
// [clave, medida, meta]: sesiones de todo el equipo desde que se abrió la comunidad, récords compartidos y retos conseguidos
// (como comunidad_hitos, 045)
export const HITOS = [
  ['sesiones_100', 'sesiones', 100], ['sesiones_500', 'sesiones', 500], ['sesiones_1000', 'sesiones', 1000], ['sesiones_2500', 'sesiones', 2500], ['sesiones_5000', 'sesiones', 5000],
  ['records_50', 'records', 50], ['records_100', 'records', 100], ['retos_10', 'retos', 10],
];
const UNIDAD_HITO = { sesiones: 'sesiones', records: 'récords compartidos', retos: 'retos conseguidos' };
export const tituloHito = (medida, meta) => `${miles(meta)} ${UNIDAD_HITO[medida] || medida}`;
export const textoHito = (medida, meta) => `¡${tituloHito(medida, meta)} entre todo el equipo!`;
// valores: { sesiones, records, retos } → la lista de hitos con lo que lleva cada uno y si está conseguido
export function hitosDe(valores = {}) {
  return HITOS.map(([clave, medida, meta]) => {
    const valor = Number(valores[medida]) || 0;
    return { clave, medida, meta, valor, alcanzado: valor >= meta, titulo: tituloHito(medida, meta) };
  });
}
// El que toca celebrar al entrar: de los conseguidos que este miembro aún no ha celebrado, el último de la lista (el más alto
// de su medida); y todos los conseguidos se marcan (a quien entra tarde no le salen diez celebraciones seguidas). null: nada
export function hitoPorCelebrar(lista = [], celebrados = []) {
  const ya = new Set(celebrados);
  const nuevos = lista.filter((h) => h.alcanzado && !ya.has(h.clave));
  if (!nuevos.length) return null;
  return { hito: nuevos.at(-1), marcar: lista.filter((h) => h.alcanzado).map((h) => h.clave) };
}

// ---------------------------------------------------------------- 4. Reacciones y pegatinas
// Las tres de siempre y tres más (una por persona y publicación, como siempre). Con la 045; sin ella, las tres de siempre
export const REACCIONES_TODAS = [...REACCIONES, ['corazon', '❤️', 'Me encanta'], ['risa', '😂', 'Risa'], ['trofeo', '🏆', 'Trofeo']];
// Las pegatinas de FBE (se dibujan en ui/Pegatinas.jsx): se mandan como un comentario. La base guarda la clave y pone el texto
export const PEGATINAS = [['pr', 'PR'], ['a_tope', 'A tope'], ['semana_completa', 'Semana completa'], ['constancia', 'Constancia'], ['vamos', 'Vamos'], ['dia_pierna', 'Día de pierna']];
export const pegatinaValida = (k) => PEGATINAS.some(([c]) => c === k);
export const textoPegatina = (k) => PEGATINAS.find(([c]) => c === k)?.[1] || null;

// ---------------------------------------------------------------- 5. Momentos del día (24 h)
export const MAX_MOMENTO = 140;
export const HORAS_MOMENTO = 24;
export const NORMA_MOMENTO = 'Nada sobre el cuerpo, el peso o el físico (normas del equipo).';
export const momentoVigente = (m, ahora = Date.now()) => !!m?.creado_en && Date.parse(m.creado_en) > ahora - HORAS_MOMENTO * 3600e3;
// «Quedan 3 h» / «Quedan 20 min» (lo que le falta para desaparecer)
export function textoQueda(m, ahora = Date.now()) {
  const min = Math.max(0, Math.ceil((Date.parse(m.creado_en) + HORAS_MOMENTO * 3600e3 - ahora) / 60000));
  return min >= 60 ? `Quedan ${Math.floor(min / 60)} h` : `Quedan ${Math.max(1, min)} min`;
}
// La línea de un momento: una sola, sin espacios de más; vacía, null. { texto } o { error }
export function limpiarMomento(texto) {
  const t = String(texto ?? '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim();
  if ([...t].length > MAX_MOMENTO) return { error: `La línea, hasta ${MAX_MOMENTO} letras.` };
  return { texto: t || null };
}
// En la tira: el mío primero (el más nuevo), después los demás del más nuevo al más viejo; solo los que siguen vigentes
export function ordenarMomentos(lista = [], yo = null, ahora = Date.now()) {
  return lista.filter((m) => momentoVigente(m, ahora))
    .sort((a, b) => (a.autor_id === yo) !== (b.autor_id === yo) ? (a.autor_id === yo ? -1 : 1) : Date.parse(b.creado_en) - Date.parse(a.creado_en));
}
