// La comunidad del equipo (v0.43): lo que no depende de la pantalla ni de la base.
import { textoVisible } from './texto.js';
import { diasEntre } from './fechas.js';
import { e1rm } from './calculos.js';

// [clave en la base, emoji, nombre]
export const REACCIONES = [['fuerza', '💪', 'Fuerza'], ['fuego', '🔥', 'Fuego'], ['aplauso', '👏', 'Aplauso']];
export const MAX_POST = 2000;
export const MAX_COMENTARIO = 1000;
export const MAX_MOTIVO = 300;

// El nombre que sale en el equipo de entrada: el nombre y la inicial del apellido («Ana López» → «Ana L.»)
export function nombreEquipo(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  const n = partes[0].slice(0, 30);
  return partes.length > 1 ? `${n} ${partes[1][0].toUpperCase()}.` : n;
}
// Lo mismo que la base: espacios juntos, de 2 a 40 letras y con algo visible
export const limpiarNombre = (t) => String(t || '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim();
export const nombreValido = (t) => { const v = limpiarNombre(t); return v.length >= 2 && v.length <= 40 && textoVisible(v); };

// Un reto: en marcha, por empezar o terminado (sus fechas incluidas)
export function estadoReto(r, hoy) {
  if (hoy < r.desde) return 'proximo';
  if (hoy > r.hasta) return 'terminado';
  return 'en_marcha';
}
export function textoReto(r, hoy) {
  const e = estadoReto(r, hoy);
  if (e === 'proximo') { const d = diasEntre(hoy, r.desde); return d === 1 ? 'Empieza mañana' : `Empieza en ${d} días`; }
  if (e === 'terminado') return 'Terminado';
  const d = diasEntre(hoy, r.hasta);
  return d === 0 ? 'Último día' : d === 1 ? 'Queda 1 día' : `Quedan ${d} días`;
}

// El ranking de constancia: primero quien lleva más de lo previsto (en proporción), luego quien lleva más sesiones
export function ordenarRanking(filas) {
  return [...filas].sort((a, b) => (b.hechas / (b.previstas || 1)) - (a.hechas / (a.previstas || 1)) || b.hechas - a.hechas || String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

// «Rubén M., Carlos V. y 2 más»
export function quienes(nombres, max = 2) {
  if (!nombres.length) return '';
  if (nombres.length <= max) return nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
  return `${nombres.slice(0, max).join(', ')} y ${nombres.length - max} más`;
}

// Los récords de una sesión, como los decide la base al compartirla (comunidad_compartir_sesion): en cada
// ejercicio, el mejor 1RM estimado de esa sesión supera al mejor de antes de empezarla; en uno sin carga, más
// repeticiones que nunca. series: el historial del atleta ({ sesion_id, ejercicio_id, kg, reps, rpe, rir,
// registrada_en }). Devuelve los ejercicio_id con récord.
export function recordsDeEquipo(series, sesionId) {
  const conReps = series.filter((s) => Number(s.reps) > 0);
  const hoy = conReps.filter((s) => s.sesion_id === sesionId);
  const inicio = series.filter((s) => s.sesion_id === sesionId).map((s) => s.registrada_en).filter(Boolean).sort()[0] || '9999';
  const antes = conReps.filter((s) => s.sesion_id !== sesionId && s.registrada_en && s.registrada_en < inicio);
  const maxE = (l) => l.reduce((m, s) => { const v = e1rm({ kg: s.kg, reps: s.reps, rpe: s.rpe ?? null, rir: s.rir ?? null }); return v != null && (m == null || v > m) ? v : m; }, null);
  const maxR = (l) => l.filter((s) => !(Number(s.kg) > 0)).reduce((m, s) => (m == null || Number(s.reps) > m ? Number(s.reps) : m), null);
  const out = new Set();
  for (const id of new Set(hoy.map((s) => s.ejercicio_id))) {
    const h = hoy.filter((s) => s.ejercicio_id === id), a = antes.filter((s) => s.ejercicio_id === id);
    const eh = maxE(h), ea = maxE(a);
    if ((eh != null && ea != null && eh > ea) || (!h.some((s) => Number(s.kg) > 0) && maxR(a) != null && maxR(h) > maxR(a))) out.add(id);
  }
  return out;
}
