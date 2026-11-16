// Los suplementos de cada atleta (migración 077): lo que le pauta su coach o añade él, lo que marca cada día en Hoy y
// su aviso al móvil, si lo quiere. Solo suplementos: no es para medicación. Lógica pura (la app, la demo y las pruebas).
import { sumarDias, fechaMadrid } from './fechas.js';

// La lista corta de FBE: la dosis es la habitual en adultos sanos, un punto de partida que el coach ajusta a cada uno
// (se puede cambiar al añadirlo). guia: la clave de su guía en «Aprende», si la hay.
export const SUPLEMENTOS_FBE = [
  { clave: 'creatina', nombre: 'Creatina monohidrato', dosis: '3-5 g al día', momento: 'cuando', guia: 'creatina' },
  { clave: 'proteina', nombre: 'Proteína en polvo', dosis: '1 cazo (20-30 g)', momento: 'despues', guia: 'numero-proteina' },
  { clave: 'cafeina', nombre: 'Cafeína', dosis: 'Hasta 3 mg por kg (máx. 400 mg al día)', momento: 'antes', guia: null },
  { clave: 'vitamina-d', nombre: 'Vitamina D', dosis: 'La que marque tu analítica', momento: 'manana', guia: null },
  { clave: 'omega-3', nombre: 'Omega-3', dosis: '1-2 g de EPA y DHA', momento: 'comida', guia: null },
  { clave: 'magnesio', nombre: 'Magnesio', dosis: '200-350 mg', momento: 'noche', guia: null },
  { clave: 'citrulina', nombre: 'Citrulina malato', dosis: '6-8 g, una hora antes', momento: 'antes', guia: null },
  { clave: 'beta-alanina', nombre: 'Beta-alanina', dosis: '3-6 g al día, repartidos', momento: 'cuando', guia: null },
];
export const MOMENTOS = [['manana', 'Por la mañana'], ['antes', 'Antes de entrenar'], ['despues', 'Después de entrenar'], ['comida', 'Con la comida'], ['noche', 'Por la noche'], ['cuando', 'Cuando quieras']];
export const NOMBRE_MOMENTO = Object.fromEntries(MOMENTOS);
export const MAX_SUPLEMENTOS = 8, MAX_NOMBRE = 40, MAX_DOSIS = 40;
export const HORA_MIN = '05:00', HORA_MAX = '23:30';
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const texto = (v) => String(v ?? '').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim();

export const deLaLista = (clave) => SUPLEMENTOS_FBE.find((s) => s.clave === clave) || null;
export const horaValida = (h) => typeof h === 'string' && HORA.test(h) && h >= HORA_MIN && h <= HORA_MAX;

// Lo que se manda a la base: { datos } o { error } (el mismo criterio que la 077)
export function limpiarSuplemento(x = {}) {
  const nombre = texto(x.nombre), dosis = texto(x.dosis) || null;
  if (!nombre) return { error: 'Ponle un nombre.' };
  if (nombre.length > MAX_NOMBRE) return { error: `El nombre, como mucho ${MAX_NOMBRE} caracteres.` };
  if (dosis && dosis.length > MAX_DOSIS) return { error: `La dosis, como mucho ${MAX_DOSIS} caracteres.` };
  const momento = MOMENTOS.some(([k]) => k === x.momento) ? x.momento : 'cuando';
  const clave = x.clave && deLaLista(x.clave) ? x.clave : null;
  return { datos: { ...(x.id ? { id: x.id } : {}), clave, nombre, dosis, momento } };
}

// «3-5 g al día · Cuando quieras» (sin «Cuando quieras» si no hay dosis no dice nada raro)
export const detalleSuplemento = (s) => [s.dosis, s.momento && s.momento !== 'cuando' ? NOMBRE_MOMENTO[s.momento] : null].filter(Boolean).join(' · ');

// Lo de hoy: cada suplemento activo con si ya lo ha tomado; cuántos quedan
export function suplementosDeHoy({ suplementos = [], tomas = [] } = {}, hoy = fechaMadrid()) {
  const hechos = new Set(tomas.filter((t) => t.fecha === hoy).map((t) => t.suplemento_id));
  const lista = suplementos.filter((s) => s.activo !== false).map((s) => ({ ...s, tomado: hechos.has(s.id) }));
  return { lista, quedan: lista.filter((s) => !s.tomado).length, total: lista.length };
}

// Cómo va cada uno en los últimos `dias` (sin contar hoy si aún no lo ha marcado; desde el día en que se lo pusieron):
// { dias: [{ fecha, tomado }], tomados, de, pct, racha } — la racha, días seguidos hasta hoy (o hasta ayer, si hoy falta)
export function constanciaSuplemento(s, tomas = [], hoy = fechaMadrid(), dias = 7) {
  const suyas = new Set(tomas.filter((t) => t.suplemento_id === s.id).map((t) => t.fecha));
  const desde = s.creado_en ? fechaMadrid(new Date(s.creado_en)) : null;
  const ventana = [];
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = sumarDias(hoy, -i);
    if (desde && fecha < desde) continue;
    if (fecha === hoy && !suyas.has(fecha)) continue;
    ventana.push({ fecha, tomado: suyas.has(fecha) });
  }
  let racha = 0;
  for (let f = suyas.has(hoy) ? hoy : sumarDias(hoy, -1); suyas.has(f); f = sumarDias(f, -1)) racha++;
  const tomados = ventana.filter((d) => d.tomado).length;
  return { dias: ventana, tomados, de: ventana.length, pct: ventana.length ? Math.round((tomados / ventana.length) * 100) : null, racha };
}

// Los de la lista que aún no tiene (para ofrecérselos)
export const porAnadir = (suplementos = []) => SUPLEMENTOS_FBE.filter((x) => !suplementos.some((s) => s.activo !== false && (s.clave === x.clave || s.nombre.toLowerCase() === x.nombre.toLowerCase())));
