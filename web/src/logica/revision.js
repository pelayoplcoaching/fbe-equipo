// v0.67: «Revisión semanal» del coach. Lo puro: qué pide su atención y en qué orden salen.

// Lo que pide atención de un atleta esta semana: [{ tipo, nivel ('alerta' | 'aviso' | 'info' | 'ok'), texto }]
export function avisosRevision(f) {
  const out = [];
  if (f.molestia >= 2) out.push({ tipo: 'molestia', nivel: f.molestia >= 3 ? 'alerta' : 'aviso', texto: `Molestia ${f.molestia}/5` });
  if (f.mensajes > 0) out.push({ tipo: 'mensajes', nivel: 'aviso', texto: f.mensajes === 1 ? '1 mensaje sin leer' : `${f.mensajes} mensajes sin leer` });
  if (f.videos > 0) out.push({ tipo: 'videos', nivel: 'aviso', texto: f.videos === 1 ? '1 vídeo sin revisar' : `${f.videos} vídeos sin revisar` });
  if (f.servicio !== 'nutricion' || f.checkin) out.push(f.checkin ? { tipo: 'checkin', nivel: 'ok', texto: 'Check-in enviado' } : { tipo: 'checkin', nivel: 'info', texto: 'Sin check-in' });
  return out;
}

// Cuánto le falta de sus sesiones de la semana (0 = todas hechas; 1 = ninguna); sin sesiones pautadas, 0
const falta = (f) => { const t = f.sesiones?.total || 0; return t ? Math.max(0, 1 - (f.sesiones.completadas || 0) / t) : 0; };
// Cuántas cosas piden atención (sin contar el check-in enviado)
export const pendientesDe = (f) => avisosRevision(f).filter((a) => a.nivel !== 'ok').length;

// El orden: primero los que faltan por revisar; entre ellos, los que tienen algo urgente (molestia fuerte), luego los que
// tienen más cosas pendientes y los que han hecho menos de lo pautado; los ya revisados, al final. A igualdad, por nombre.
export function ordenRevision(filas) {
  const urgente = (f) => (f.molestia >= 3 ? 1 : 0);
  return [...(filas || [])].sort((a, b) => (Number(a.hecha) - Number(b.hecha))
    || (urgente(b) - urgente(a))
    || (pendientesDe(b) - pendientesDe(a))
    || (falta(b) - falta(a))
    || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
}
