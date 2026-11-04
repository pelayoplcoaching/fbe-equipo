// v0.63: el teclado de la app para apuntar una serie (kilos, repeticiones y RPE), como el de Strong o Hevy: teclas grandes
// para una mano, −/+ con el salto que tiene sentido para ese ejercicio y «Siguiente» que pasa de kilos a repeticiones, al
// RPE (si tu coach lo pide) y a marcar la serie. Aquí, lo que no depende de la pantalla (probado en test/logica.test.mjs).
import { esBarra, num } from './calculos.js';
import { normal } from './busqueda.js';

// El RPE, de 6 a 10 de medio en medio
export const RPE_TECLADO = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
// El disco más pequeño que puede tener un gimnasio (por lado). De serie, el de 1,25 kg (±2,5 kg en la barra)
export const DISCOS_MINIMOS = [0.5, 1, 1.25, 2.5];
export const DISCO_MINIMO_DEFECTO = 1.25;
export const discoMinimoValido = (d) => DISCOS_MINIMOS.includes(Number(d));

// Cómo se carga un ejercicio, por su nombre (la biblioteca no guarda el material aparte; las mismas pistas que
// «¿Dónde entrenas hoy?»): 'discos' (barra, multipower o una máquina de discos), 'mancuernas', 'kettlebell', 'maquina'
// (placas o poleas) o null si no se sabe
export function tipoCarga(nombre = '') {
  const n = normal(nombre);
  if (!n) return null;
  if (/\bkettlebells?\b|\bpesas? rusas?\b/.test(n)) return 'kettlebell';
  if (/\bmancuernas?\b|\bbulgara\b|\bhex press\b/.test(n)) return 'mancuernas';
  if (esBarra(nombre) || /\bmultipower\b|\bsmith\b|\bprensa\b|\bhack\b|\bpendulum\b|\bbelt squat\b|\blandmine\b|\btrap bar\b|\bhip thrust\b/.test(n)) return 'discos';
  if (/\bmaquinas?\b|\bpoleas?\b|\bcables?\b|\bjalon\b|\bface pull\b|\bpec-?deck\b|\bcontractora\b|\bleg curl\b|\bleg extensions?\b|\bextension de cuadriceps\b|\bcurl femoral\b|\babducciones?\b|\baductor\b|\bgironda\b|\bpallof\b/.test(n)) return 'maquina';
  return null;
}

// El salto de los botones −/+ de los kilos:
//  · con discos, dos veces el disco más pequeño de ese gimnasio (uno por lado): ±2,5 kg con discos de 1,25;
//  · mancuernas, de 2 en 2 (de 1 en 1 por debajo de 10 kg); kettlebells, de 4 en 4 (8, 12, 16…);
//  · máquinas y poleas, como la app propone las cargas (calculos.incrementoCarga): 2,5 kg y 5 kg desde 50 kg;
//  · sin saber qué es, ±2,5.
export function pasoKg({ nombre = '', kg = null, discoMinimo = DISCO_MINIMO_DEFECTO } = {}) {
  const t = tipoCarga(nombre);
  const x = Number(kg);
  if (t === 'discos') return Math.round(2 * (discoMinimoValido(discoMinimo) ? Number(discoMinimo) : DISCO_MINIMO_DEFECTO) * 100) / 100;
  if (t === 'mancuernas') return Number.isFinite(x) && x > 0 && x < 10 ? 1 : 2;
  if (t === 'kettlebell') return 4;
  if (t === 'maquina') return Number.isFinite(x) && x >= 50 ? 5 : 2.5;
  return 2.5;
}

// Los discos que hay para el cálculo de discos por lado, con el más pequeño de ese gimnasio
export function discosCon(discoMinimo = DISCO_MINIMO_DEFECTO) {
  const min = discoMinimoValido(discoMinimo) ? Number(discoMinimo) : DISCO_MINIMO_DEFECTO;
  return [25, 20, 15, 10, 5, 2.5, 1.25, 1, 0.5].filter((d) => d >= min);
}

// El orden de «Siguiente»: kilos → repeticiones → RPE (solo si tu coach lo pide) → marcar la serie ('hecho')
export function ordenCampos({ conRpe = false } = {}) { return conRpe ? ['kg', 'reps', 'rpe', 'hecho'] : ['kg', 'reps', 'hecho']; }
export function siguienteCampo(campo, { conRpe = false } = {}) {
  const orden = ordenCampos({ conRpe });
  const i = orden.indexOf(campo);
  // (el RPE sin pedirlo: si alguien lo abre a mano, lo siguiente es marcar)
  if (i < 0) return campo === 'rpe' ? 'hecho' : 'kg';
  return orden[Math.min(i + 1, orden.length - 1)];
}
// ¿Pide RPE tu coach en esta serie? (un RPE objetivo en la pauta o en la serie, o un RIR)
export const pideRpe = (se, objetivoSerie = null) => objetivoSerie?.rpe != null || se?.rpe_objetivo != null || se?.rir_objetivo != null;

// Lo que admite cada campo mientras se escribe: kilos con hasta 4 cifras y 2 decimales (hasta 1500); repeticiones
// enteras, hasta 200 (lo mismo que problemaSerie)
const VALIDO = { kg: /^\d{1,4}(,\d{0,2})?$/, reps: /^\d{1,3}$/ };
const TOPE = { kg: 1500, reps: 200 };
const valor = (t) => { const n = Number(String(t).replace(',', '.')); return Number.isFinite(n) ? n : null; };

// Una tecla sobre lo escrito. nuevo: el campo se acaba de abrir (o de cambiar con −/+), así que lo que se teclea
// sustituye a lo que hay, como al seleccionar un campo (borrar lo deja vacío). Devuelve el texto (el mismo si la tecla
// no vale ahí: una coma en las repeticiones, una segunda coma, una cifra de más)
export function pulsarTecla(texto, tecla, { campo = 'kg', nuevo = false } = {}) {
  const antes = String(texto ?? '');
  const base = nuevo ? '' : antes;
  if (tecla === 'borrar') return nuevo ? '' : base.slice(0, -1);
  let t;
  if (tecla === ',') {
    if (campo !== 'kg' || base.includes(',')) return antes;
    t = base === '' ? '0,' : `${base},`;
  } else if (/^\d$/.test(tecla)) t = base === '0' ? tecla : base + tecla;
  else return antes;
  if (!VALIDO[campo]?.test(t)) return antes;
  const v = valor(t);
  if (v != null && v > TOPE[campo]) return antes;
  return t;
}

// −/+: suma el salto a lo escrito o, si no hay nada, a lo que te propone (el gris). Nunca por debajo de 0 ni por
// encima del tope; los kilos, redondeados a dos decimales y con coma
export function sumarPaso(texto, base, delta, campo = 'kg') {
  const escrito = String(texto ?? '').trim() === '' ? null : valor(texto);
  const actual = escrito ?? (Number.isFinite(Number(base)) && base !== null && base !== '' ? Number(base) : 0);
  let n = Math.round((actual + delta) * 100) / 100;
  if (campo === 'reps') n = Math.round(n);
  n = Math.min(TOPE[campo] ?? Infinity, Math.max(0, n));
  return campo === 'kg' ? num(n, 2) : String(n);
}

// Lo que se anuncia al lector de pantalla al cambiar el valor («Kilos: 42,5», «Repeticiones: vacío», «RPE: 8»)
const NOMBRE = { kg: 'Kilos', reps: 'Repeticiones', rpe: 'RPE' };
export function anuncioValor(campo, texto) {
  const t = campo === 'rpe' ? (texto === '' || texto == null ? '' : num(texto)) : String(texto ?? '');
  return `${NOMBRE[campo] || campo}: ${t === '' ? 'vacío' : t}`;
}
