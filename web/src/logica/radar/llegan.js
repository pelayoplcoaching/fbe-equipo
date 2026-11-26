// (v0.258, el día a día: D11) Para «A quién escribir»: cómo han llegado tus atletas con seguimiento a sus sesiones de los
// últimos 7 días (lo que contestaron en «¿Cómo llegas hoy?»): cuántas sesiones, cuántas en día difícil o flojo y quién
// lleva dos o más seguidas en día difícil. Solo cuenta lo contestado.
import { consejoPreparacion } from '../preparacion.js';

// sesiones: { atleta_id: [{ fecha, preparacion }] } (datosRadar); resumenes: [{ atleta_id, nombre }]
export function comoLlegan(sesiones = {}, resumenes = []) {
  const nombre = Object.fromEntries((resumenes || []).map((r) => [r.atleta_id, r.nombre]));
  let total = 0, malas = 0, flojas = 0;
  const seguidas = [];
  for (const [id, xs] of Object.entries(sesiones || {})) {
    const niv = (xs || []).filter((s) => consejoPreparacion(s?.preparacion)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
      .map((s) => consejoPreparacion(s.preparacion).nivel);
    total += niv.length;
    malas += niv.filter((n) => n === 'malo').length;
    flojas += niv.filter((n) => n === 'flojo').length;
    let k = 0;
    for (let i = niv.length - 1; i >= 0 && niv[i] === 'malo'; i--) k++;
    if (k >= 2 && nombre[id]) seguidas.push({ atleta_id: id, nombre: nombre[id], n: k });
  }
  seguidas.sort((a, b) => b.n - a.n || String(a.nombre).localeCompare(String(b.nombre), 'es'));
  return { total, malas, flojas, seguidas };
}
// «De 12 sesiones con respuesta, 2 en día difícil y 3 en día flojo.»
export function textoLlegan(c) {
  if (!c?.total) return null;
  const partes = [c.malas ? `${c.malas} en día difícil` : null, c.flojas ? `${c.flojas} en día flojo` : null].filter(Boolean);
  return `De ${c.total} ${c.total === 1 ? 'sesión' : 'sesiones'} con respuesta, ${partes.length ? partes.join(' y ') : 'ninguna en día flojo ni difícil'}.`;
}
