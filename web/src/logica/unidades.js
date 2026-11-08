// v0.112: kilos o libras para las cargas del entreno (lo pidió un atleta que entrena con discos en libras). Es un ajuste
// de su móvil (Perfil → Este móvil): la base guarda siempre kilos (el coach, el motor, la progresión y las cuentas
// siguen en kilos); solo cambia lo que el atleta ve y lo que escribe. Lo que escribe en libras se pasa a kilos al
// guardar (con dos decimales, como guarda la base) y lo guardado se enseña en libras con un decimal: 135 lb → 61,23 kg
// → 135 lb. El peso corporal, las medidas y la nutrición siguen en kilos.
// La unidad es de toda la app del atleta (AtletaApp la fija al arrancar y al cambiar el ajuste; la app del coach, kilos),
// así los textos que salen de la lógica («62,5×5 @9», «prueba con 82,5 kg») la siguen sin pasarla de mano en mano.
// (num, el de calculos.js, copiado aquí: calculos.js usa este módulo y así no se importan el uno al otro)
function num(v, dec = 1) {
  const n = Number(v);
  // (sin decimales, «220» se queda en 220: solo se quitan los ceros de detrás de la coma)
  const f = n.toFixed(dec);
  const s = Number.isInteger(n) ? String(n) : f.includes('.') ? f.replace(/\.?0+$/, '') : f;
  return s.replace('.', ',');
}

export const KG_POR_LB = 0.45359237;
export const UNIDADES_PESO = ['kg', 'lb'];
let actual = 'kg';
export const unidadPeso = () => actual;
export const enLibras = () => actual === 'lb';
export function fijarUnidadPeso(u) { actual = u === 'lb' ? 'lb' : 'kg'; return actual; }

const esNum = (x) => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));

// Kilos → la unidad de la app (en libras, con un decimal; en kilos, con dos, como se guardan). null si no es un número
export function vista(kg, u = actual) {
  if (!esNum(kg)) return null;
  const n = Number(kg);
  return u === 'lb' ? Math.round((n / KG_POR_LB) * 10) / 10 : Math.round(n * 100) / 100;
}
// La unidad de la app → kilos, con dos decimales (lo que guarda la base). null si no es un número
export function deVista(v, u = actual) {
  if (!esNum(v)) return null;
  const n = Number(v);
  return Math.round((u === 'lb' ? n * KG_POR_LB : n) * 100) / 100;
}
// «61,25 kg» / «135 lb» (dec: los decimales en kilos; en libras, como mucho uno)
// (se redondea una sola vez: 100 kg son 220,46 lb, «220,5 lb» con un decimal y «220 lb» sin ninguno)
export function pesoNum(kg, dec = 2, u = actual) {
  if (!esNum(kg)) return '—';
  return u === 'lb' ? num(Number(kg) / KG_POR_LB, Math.min(dec, 1)) : num(Number(kg), dec);
}
export function pesoTxt(kg, dec = 2, u = actual) {
  const n = pesoNum(kg, dec, u);
  return n === '—' ? n : `${n} ${u}`;
}
// Una diferencia de kilos (subidas, ritmos): sin redondear a la unidad antes de restar
export const difVista = (kg, u = actual) => (esNum(kg) ? (u === 'lb' ? Number(kg) / KG_POR_LB : Number(kg)) : null);
export const etiquetaPeso = (u = actual) => u;
// Para leer en voz alta o en una etiqueta: «Kilos», «kilos», «libras»…
export const nombrePeso = (u = actual, { mayuscula = false, singular = false } = {}) => {
  const n = u === 'lb' ? (singular ? 'libra' : 'libras') : (singular ? 'kilo' : 'kilos');
  return mayuscula ? n[0].toUpperCase() + n.slice(1) : n;
};
// La barra olímpica: 20 kg o 45 lb
export const barraVista = (u = actual) => (u === 'lb' ? 45 : 20);
// Los discos de un gimnasio en libras (por lado)
export const DISCOS_LB = [45, 35, 25, 10, 5, 2.5];

// El salto en libras (los −/+ del teclado y el redondeo de lo que se propone): de 5 en 5 (un disco de 2,5 lb por lado,
// las mancuernas y las placas de las máquinas en libras); por debajo de 20 lb, de 2,5 en 2,5
export const pasoLb = (lb) => (Number(lb) > 0 && Number(lb) < 20 ? 2.5 : 5);
// Lo que te propone la app (la pauta de tu coach, la doble progresión, una back-off), en libras redondeado a lo que se
// puede cargar: 80 kg son 176,4 lb, y se propone 175 (79,38 kg, que es lo que se guarda si lo marcas así). En kilos, igual
export function redondearCarga(kg, u = actual) {
  if (u !== 'lb' || !esNum(kg) || !(Number(kg) > 0)) return kg;
  const lb = Number(kg) / KG_POR_LB;
  const p = pasoLb(lb);
  return deVista(Math.max(p, Math.round(lb / p) * p), 'lb');
}
