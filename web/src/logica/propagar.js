// v0.63: al cambiar los kilos o las repeticiones de una serie sin hacer (casi siempre la primera de trabajo), el mismo
// cambio pasa solo a las series siguientes de ese ejercicio que llevaban lo mismo, con un aviso «También en las series 3
// y 4 · Deshacer». Lo que nunca se toca: las series ya hechas, las que tienen otra pauta (la top y sus back-off, una serie
// pautada con otros kilos o repeticiones, una de más), las que ya habías cambiado a otra cosa y los demás ejercicios.
// Se aplica (no se pregunta): es lo que haría el atleta a mano en cada fila, y deshacerlo es un toque.
// Funciones puras, probadas en test/logica.test.mjs.

const leer = (t) => {
  const s = String(t ?? '').replace(',', '.').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const mismo = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 1e-9);

// filas: [{ numero, hecha, pautada (no es una de más), tipo ('top', 'backoff' o null), prescrito (lo que te propone la app
// para ese campo, el gris), texto (lo escrito, '' si nada) }]. numero: la fila cambiada; antes / despues: su texto antes
// y después del cambio. Devuelve los cambios [{ numero, antes, despues }] (vacío si no hay que tocar nada).
export function propagarCambio(filas, numero, antes, despues) {
  const f = (filas || []).find((x) => x.numero === numero);
  if (!f || f.hecha || !f.pautada) return [];
  const viejo = leer(antes) ?? f.prescrito ?? null;
  const nuevo = leer(despues) ?? f.prescrito ?? null;
  if (mismo(viejo, nuevo)) return [];
  const cambios = [];
  for (const x of filas) {
    if (x.numero <= numero || x.hecha || !x.pautada || (x.tipo || null) !== (f.tipo || null)) continue;
    // La misma pauta que la cambiada (lo que propone la app para esa serie)
    if (!mismo(x.prescrito ?? null, f.prescrito ?? null)) continue;
    // Y aún con lo mismo que enseñaba la cambiada (si la habías cambiado a otra cosa, se respeta)
    const ahora = leer(x.texto) ?? x.prescrito ?? null;
    if (!mismo(ahora, viejo) || mismo(ahora, nuevo)) continue;
    cambios.push({ numero: x.numero, antes: String(x.texto ?? ''), despues: String(despues ?? '') });
  }
  return cambios;
}

// Deshacer: cada serie vuelve exactamente a lo que tenía escrito (también vacío), salvo las que se han vuelto a cambiar
// después (eso no se pisa). borradores: { numero: { kg, reps, … } }. Devuelve los borradores nuevos.
export function deshacerPropagacion(borradores, campo, cambios) {
  const b = { ...(borradores || {}) };
  for (const c of cambios || []) {
    const actual = String(b[c.numero]?.[campo] ?? '');
    if (actual !== c.despues) continue;
    b[c.numero] = { ...(b[c.numero] || {}), [campo]: c.antes };
  }
  return b;
}

// Aplicar los cambios a los borradores
export function aplicarPropagacion(borradores, campo, cambios) {
  const b = { ...(borradores || {}) };
  for (const c of cambios || []) b[c.numero] = { ...(b[c.numero] || {}), [campo]: c.despues };
  return b;
}

// «También en la serie 3», «También en las series 3 y 4», «También en las series 2, 3 y 4»
export function textoPropagacion(numeros) {
  const n = [...(numeros || [])].sort((a, b) => a - b);
  if (!n.length) return '';
  if (n.length === 1) return `También en la serie ${n[0]}`;
  return `También en las series ${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}
