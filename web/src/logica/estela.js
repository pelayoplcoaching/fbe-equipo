// v0.61 (8): la «estela del movimiento», como en las repeticiones de la tele: la trayectoria de la barra (o de una
// articulación, si hay puntos del cuerpo de esta sesión) en los últimos N fotogramas, que se va apagando. Aquí, lo que no
// depende de la pantalla: qué puntos se ven en el momento t, en qué tramos (un hueco en la trayectoria la corta) y con qué
// transparencia cada uno. Con «reducir movimiento», la trayectoria entera, quieta (sin apagarse ni moverse con el vídeo).
// La trayectoria: [[t, x, y], …] con x e y de 0 a 1 dentro de la imagen (como analisis.barra.p, 036) y t en segundos del
// vídeo, así que va igual a cámara lenta (es el tiempo del vídeo, no el del reloj).
import { PUNTOS_POSE, VISIBLE_MIN } from './analisis.js';

export const FOTOGRAMA_ESTELA = 1 / 30;
export const LARGOS_ESTELA = [[15, 'Corta'], [45, 'Media'], [90, 'Larga']]; // fotogramas (a 30 por segundo)
export const LARGO_ESTELA = 45;
export const ALFA_MIN = 0.06;
export const HUECO_ESTELA = 0.5; // más de medio segundo sin punto: la estela se corta ahí
export const MAX_SEGMENTOS = 400;
export const ARTICULACIONES_ESTELA = [['barra', 'Barra'], ['cadera', 'Cadera'], ['rodilla', 'Rodilla'], ['hombro', 'Hombro'], ['muneca', 'Muñeca'], ['tobillo', 'Tobillo']];
export const NOMBRE_ARTICULACION = Object.fromEntries(ARTICULACIONES_ESTELA);

const esNum = (x) => typeof x === 'number' && Number.isFinite(x);
export const largoValido = (n) => LARGOS_ESTELA.some(([x]) => x === n);
export const segundosEstela = (fotogramas = LARGO_ESTELA) => (largoValido(fotogramas) ? fotogramas : LARGO_ESTELA) * FOTOGRAMA_ESTELA;

// Una trayectoria limpia: [t, x, y] con t en orden creciente y x, y de 0 a 1 (lo demás, fuera)
export function limpiarTrayectoria(puntos = []) {
  const out = [];
  for (const p of puntos || []) {
    if (!Array.isArray(p) || p.length < 3 || !esNum(p[0]) || !esNum(p[1]) || !esNum(p[2])) continue;
    if (p[1] < 0 || p[1] > 1 || p[2] < 0 || p[2] > 1 || p[0] < 0) continue;
    if (out.length && p[0] <= out[out.length - 1][0]) continue;
    out.push([p[0], p[1], p[2]]);
  }
  return out;
}

// La transparencia de un punto de edad «edad» (segundos antes de t) en una estela de «ventana» segundos: 1 recién
// pintado y se apaga (cuadrática, como una estela de verdad) hasta ALFA_MIN al final; fuera de la ventana, 0
export function alfaEstela(edad, ventana) {
  if (!esNum(edad) || !esNum(ventana) || ventana <= 0 || edad < -1e-9 || edad > ventana + 1e-9) return 0;
  const f = 1 - Math.min(1, Math.max(0, edad) / ventana);
  return Math.max(ALFA_MIN, f * f);
}

// Dónde está en t (interpolado entre los dos puntos de alrededor; null fuera o en un hueco)
function enT(ps, t, hueco) {
  if (!ps.length || t < ps[0][0] - 1e-9 || t > ps[ps.length - 1][0] + 1e-9) return null;
  let lo = 0, hi = ps.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ps[m][0] <= t) lo = m; else hi = m; }
  const a = ps[lo], b = ps[hi];
  if (b[0] - a[0] > hueco) return Math.abs(a[0] - t) < 1e-9 ? [a[0], a[1], a[2]] : null;
  const f = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
  return [t, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

// Los puntos de la estela en t: los de (t − ventana, t], más el de t (interpolado), en orden. [[t, x, y], …]
export function puntosEstela(trayectoria, t, { ventana = segundosEstela(), hueco = HUECO_ESTELA } = {}) {
  const ps = trayectoria || [];
  if (!esNum(t) || !ps.length || !(ventana > 0)) return [];
  const desde = t - ventana;
  const out = [];
  const ini = enT(ps, Math.max(desde, ps[0][0]), hueco);
  if (ini && ini[0] > desde - 1e-9 && ini[0] < t) out.push(ini);
  for (const p of ps) {
    if (p[0] <= desde + 1e-9 || p[0] >= t - 1e-9) continue;
    if (out.length && p[0] <= out[out.length - 1][0] + 1e-9) continue;
    out.push(p);
  }
  const fin = enT(ps, t, hueco);
  if (fin) out.push(fin);
  return out;
}

// Los tramos para pintarla: [{ a: [x, y], b: [x, y], alfa }], del más viejo al más nuevo. Un hueco de más de «hueco»
// segundos entre dos puntos no se une. Con estatica (reducir movimiento), la trayectoria entera con la misma transparencia.
export function segmentosEstela(trayectoria, t, { ventana = segundosEstela(), hueco = HUECO_ESTELA, estatica = false } = {}) {
  const ps = estatica ? (trayectoria || []) : puntosEstela(trayectoria, t, { ventana, hueco });
  const out = [];
  for (let i = 1; i < ps.length; i++) {
    const p = ps[i - 1], q = ps[i];
    if (q[0] - p[0] > hueco + 1e-9) continue;
    const alfa = estatica ? 0.85 : alfaEstela(t - (p[0] + q[0]) / 2, ventana);
    if (alfa <= 0) continue;
    out.push({ a: [p[1], p[2]], b: [q[1], q[2]], alfa: Math.round(alfa * 1000) / 1000 });
  }
  // (una trayectoria muy larga, a trozos de 2 en 2, para no pintar cientos de líneas)
  if (out.length > MAX_SEGMENTOS) { const k = Math.ceil(out.length / MAX_SEGMENTOS); return out.filter((_, i) => i % k === 0 || i === out.length - 1); }
  return out;
}
// La cabeza de la estela (el punto de ahora), o null
export function cabezaEstela(trayectoria, t, { hueco = HUECO_ESTELA } = {}) {
  const p = enT(trayectoria || [], t, hueco);
  return p ? [p[1], p[2]] : null;
}

// La trayectoria de una articulación con los puntos del cuerpo de esta sesión (fotos: [{ t, kp: [[x, y, visibilidad], …] }],
// los de MediaPipe Pose) del lado elegido; solo los fotogramas en que se ve bien (visibilidad ≥ VISIBLE_MIN)
export function trayectoriaArticulacion(fotos = [], articulacion = 'cadera', lado = 'izq') {
  const idx = PUNTOS_POSE[articulacion]?.[lado === 'der' ? 1 : 0];
  if (idx == null) return [];
  const out = [];
  for (const f of fotos || []) {
    const q = f?.kp?.[idx];
    if (!esNum(f?.t) || !Array.isArray(q) || !esNum(q[0]) || !esNum(q[1]) || (q[2] ?? 1) < VISIBLE_MIN) continue;
    out.push([f.t, Math.min(1, Math.max(0, q[0])), Math.min(1, Math.max(0, q[1]))]);
  }
  return limpiarTrayectoria(out);
}

// Qué se puede seguir con lo que hay: la barra (guardada o de esta sesión) y, con puntos del cuerpo de esta sesión, las
// articulaciones. [[clave, nombre]]
export function fuentesEstela({ barra = null, pose = null } = {}) {
  const out = [];
  if (limpiarTrayectoria(barra || []).length >= 2) out.push(['barra', 'Barra']);
  if (pose?.fotos?.length) for (const [k, n] of ARTICULACIONES_ESTELA) if (k !== 'barra' && trayectoriaArticulacion(pose.fotos, k, pose.lado).length >= 2) out.push([k, n]);
  return out;
}
// La trayectoria que se sigue: la de la fuente elegida si se puede; si no, la primera que haya
export function trayectoriaEstela({ fuente = 'barra', barra = null, pose = null } = {}) {
  const fs = fuentesEstela({ barra, pose });
  const k = fs.some(([x]) => x === fuente) ? fuente : fs[0]?.[0] || null;
  if (!k) return { fuente: null, puntos: [] };
  return { fuente: k, puntos: k === 'barra' ? limpiarTrayectoria(barra) : trayectoriaArticulacion(pose.fotos, k, pose.lado) };
}
