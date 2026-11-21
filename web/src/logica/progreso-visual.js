// (v0.203) Lo de Progreso que se calcula para pintarlo (sin pantalla, para poder probarlo): la meta de un objetivo
// dentro de su gráfica, el ritmo del peso frente a ella, el cambio de cada medida y dónde va cada etiqueta de la figura.
import { num } from './calculos.js';
import { difVista, pesoNum, etiquetaPeso } from './unidades.js';
import { tipoDeObjetivo } from './objetivos-atleta.js';

// ---------- la meta de un objetivo, dentro de su gráfica
// El objetivo de fuerza de ese ejercicio (en curso, sin conseguir): { y (en la unidad que se ve), texto, hasta }
export function metaFuerza(objetivos = [], ejercicioId) {
  const o = (objetivos || []).find((x) => tipoDeObjetivo(x) === 'fuerza' && x.ejercicio_id === ejercicioId && x.estado !== 'completado' && x.estado !== 'descartado'
    && x.auto && !x.auto.conseguido && Number.isFinite(Number(x.auto.meta)));
  if (!o) return null;
  return { y: difVista(Number(o.auto.meta)), texto: `Meta: ${pesoNum(Number(o.auto.meta), 1)} ${etiquetaPeso()}`, hasta: o.auto.prevision?.fecha || null, objetivo: o };
}
// El de peso corporal (su tendencia aún no está en él)
export function metaPeso(objetivos = []) {
  const o = (objetivos || []).find((x) => x.autoPeso && x.estado !== 'completado' && x.estado !== 'descartado' && !x.autoPeso.llegado && Number.isFinite(Number(x.autoPeso.meta)));
  if (!o) return null;
  return { y: Number(o.autoPeso.meta), texto: `Meta: ${num(Number(o.autoPeso.meta))} kg`, hasta: o.autoPeso.prevision?.fecha || null, objetivo: o };
}
// El ritmo del peso frente a su objetivo: 'hacia' (va hacia él), 'contra' (va en el otro sentido) o null (sin
// objetivo, o el ritmo es casi cero)
export function ritmoFrenteMeta(ritmo, tendencia, meta) {
  if (!ritmo || !meta || !Number.isFinite(tendencia) || Math.abs(ritmo.kgSemana) < 0.02) return null;
  const falta = meta.y - tendencia;
  if (Math.abs(falta) < 0.05) return null;
  return Math.sign(ritmo.kgSemana) === Math.sign(falta) ? 'hacia' : 'contra';
}

// ---------- tu cuerpo en cifras
// medidas: las filas de medidas (de la más antigua a la última); claves: [[clave, nombre]] de las que tienen datos
export function cambiosMedidas(medidas = [], claves = []) {
  return claves.map(([k, t]) => {
    const xs = (medidas || []).filter((m) => m[k] != null && Number.isFinite(Number(m[k])));
    if (!xs.length) return null;
    const ult = xs[xs.length - 1], pri = xs[0];
    return { k, t, valor: Number(ult[k]), fecha: ult.fecha, desde: xs.length > 1 ? pri.fecha : null, cambio: xs.length > 1 ? Math.round((Number(ult[k]) - Number(pri[k])) * 10) / 10 : null };
  }).filter(Boolean);
}
// La altura (en % de la figura) de cada etiqueta de un lado: la de su medida, pero separadas como poco «hueco» % para
// que no se pisen (y sin salirse por arriba ni por abajo)
export function alturasEtiquetas(ys = [], hueco = 26, min = 11, max = 89) {
  const orden = ys.map((y, i) => ({ y: y / 2, i })).sort((a, b) => a.y - b.y);
  for (let k = 0; k < orden.length; k++) orden[k].y = Math.max(orden[k].y, k ? orden[k - 1].y + hueco : min);
  const exceso = orden.length ? orden[orden.length - 1].y - max : 0;
  if (exceso > 0) for (let k = orden.length - 1; k >= 0; k--) orden[k].y = Math.max(min, Math.min(orden[k].y - exceso, k < orden.length - 1 ? orden[k + 1].y - hueco : max));
  const out = [];
  for (const o of orden) out[o.i] = Math.round(o.y * 10) / 10;
  return out;
}
