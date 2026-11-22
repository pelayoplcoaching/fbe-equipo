// (v0.207) Lo del editor que usa la capa de datos (api.js), sin el motor: así no se carga al abrir la app. editor.js lo
// reexporta para el editor y las pruebas.

// La nota solo para el coach y el candado de un ejercicio, por atleta: viven en sus notas privadas (el atleta nunca las
// ve), una por ejercicio, con una marca delante. «#ej:<id>:fijo# texto».
const MARCA_EJ = /^#ej:([^:#\s]+)(:fijo)?#[ ]?([\s\S]*)$/;
export function leerNotaEjercicio(texto) {
  const m = MARCA_EJ.exec(String(texto ?? ''));
  return m ? { ejercicioId: m[1], fijado: !!m[2], nota: m[3].trim() } : null;
}
export function escribirNotaEjercicio(ejercicioId, { nota = '', fijado = false } = {}) {
  const t = String(nota ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return t || fijado ? `#ej:${ejercicioId}${fijado ? ':fijo' : ''}# ${t}`.trim() : null;
}
// { ejercicioId: { id, nota, fijado } } de las notas privadas de un atleta (si hay dos de un ejercicio, la mas nueva)
export function notasPorEjercicio(notas = []) {
  const out = {};
  for (const n of [...notas].sort((a, b) => String(a.creado_en || '').localeCompare(String(b.creado_en || '')))) {
    const x = leerNotaEjercicio(n.texto);
    if (x) out[x.ejercicioId] = { id: n.id, nota: x.nota, fijado: x.fijado };
  }
  return out;
}

// Quien queda por programar. Cada atleta con su bloque y sus semanas: le falta «esta» si hoy no tiene semana publicada,
// «siguiente» si no la tiene para el lunes que viene. Primero los de esta semana; despues, por nombre.
//   filas: [{ atleta_id, nombre, bloque_id, semanas: [{ fecha_inicio, programacion }] }]; lunes: el de esta semana (iso)
export function porProgramar(filas = [], lunes, sumar) {
  const siguiente = sumar(lunes, 7);
  const out = [];
  for (const f of filas) {
    const publicadas = (f.semanas || []).filter((w) => w.programacion === 'programada' && w.fecha_inicio).map((w) => w.fecha_inicio);
    if (!(f.semanas || []).some((w) => w.fecha_inicio)) continue;  // un bloque sin fechas no va por calendario
    const esta = publicadas.some((x) => x === lunes), prox = publicadas.some((x) => x >= siguiente);
    if (prox) continue;
    out.push({ atleta_id: f.atleta_id, nombre: f.nombre, bloque_id: f.bloque_id, falta: esta ? 'siguiente' : 'esta' });
  }
  return out.sort((a, b) => (a.falta === b.falta ? String(a.nombre).localeCompare(String(b.nombre), 'es') : a.falta === 'esta' ? -1 : 1));
}
