// Análisis automático de un vídeo de técnica (v0.58, experimental, migración 036): lo que no depende de la pantalla, del
// vídeo ni de la base. Todo se calcula en el propio móvil u ordenador: el vídeo y sus fotogramas no salen a ningún sitio.
//   · Seguir la barra (18): correlación cruzada normalizada (NCC) de una plantilla del disco en una ventana alrededor de
//     donde se espera (con la velocidad del fotograma anterior), de grueso a fino y con precisión de subpíxel; la plantilla
//     se actualiza despacio (y vuelve un poco hacia la original, para no derivar) y cada fotograma lleva su confianza.
//   · La velocidad estimada (19): calibración con el diámetro del disco, repeticiones a partir de la trayectoria vertical
//     (suavizada; con huecos rellenados), velocidad media y pico de la subida, duración de la subida, recorrido y la
//     pérdida de velocidad de la serie.
//   · Los puntos del cuerpo (20): ángulos de rodilla, cadera, codo y la inclinación del tronco, y su resumen por repetición.
//   · Lo que se guarda (analisis en video_revisiones), con la misma forma que analisis_valido() en la base.

// ---------------------------------------------------------------- 18. Seguir la barra
// Luminancia (0-255) de unos píxeles RGBA
export function aGris(rgba, w, h, out = null) {
  const n = w * h;
  const g = out && out.length === n ? out : new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return g;
}

// La NCC de dos trozos del mismo tamaño (de -1 a 1; 0 si alguno es plano): la medida de lo que se parecen
export function ncc(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; va += x * x; vb += y * y; }
  if (va < 1e-9 || vb < 1e-9) return 0;
  return num / Math.sqrt(va * vb);
}

// Imágenes integrales (suma y suma de cuadrados): la media y la varianza de cualquier ventana, al momento
export function integrales(gris, w, h) {
  const W = w + 1;
  const s = new Float64Array(W * (h + 1)), s2 = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let fila = 0, fila2 = 0;
    for (let x = 0; x < w; x++) {
      const v = gris[y * w + x];
      fila += v; fila2 += v * v;
      s[(y + 1) * W + x + 1] = s[y * W + x + 1] + fila;
      s2[(y + 1) * W + x + 1] = s2[y * W + x + 1] + fila2;
    }
  }
  return { s, s2, W };
}
const sumaRect = (a, W, x0, y0, lado) => a[(y0 + lado) * W + x0 + lado] - a[y0 * W + x0 + lado] - a[(y0 + lado) * W + x0] + a[y0 * W + x0];

// La plantilla: el cuadrado de lado 2r+1 centrado en (cx, cy), sin su media (null si se sale de la imagen o es plana)
export function plantillaDe(gris, w, h, cx, cy, r) {
  const R = Math.max(2, Math.round(r)), lado = 2 * R + 1;
  const x0 = Math.round(cx) - R, y0 = Math.round(cy) - R;
  if (x0 < 0 || y0 < 0 || x0 + lado > w || y0 + lado > h) return null;
  const d = new Float32Array(lado * lado);
  let s = 0;
  for (let j = 0; j < lado; j++) for (let i = 0; i < lado; i++) { const v = gris[(y0 + j) * w + x0 + i]; d[j * lado + i] = v; s += v; }
  const m = s / d.length;
  let q = 0;
  for (let k = 0; k < d.length; k++) { d[k] -= m; q += d[k] * d[k]; }
  if (q < 1e-6) return null;
  return { d, lado, R, norma: Math.sqrt(q) };
}
function normalizar(tpl) {
  let s = 0;
  for (let k = 0; k < tpl.d.length; k++) s += tpl.d[k];
  const m = s / tpl.d.length;
  let q = 0;
  for (let k = 0; k < tpl.d.length; k++) { tpl.d[k] -= m; q += tpl.d[k] * tpl.d[k]; }
  tpl.norma = Math.sqrt(q);
  return tpl;
}

// La NCC de la plantilla con la ventana cuyo centro es (cx, cy) (enteros); null si se sale
export function nccEn(gris, w, h, I, tpl, cx, cy) {
  const { lado, R, d, norma } = tpl;
  const x0 = cx - R, y0 = cy - R;
  if (x0 < 0 || y0 < 0 || x0 + lado > w || y0 + lado > h) return null;
  const n = lado * lado;
  const s = sumaRect(I.s, I.W, x0, y0, lado), s2 = sumaRect(I.s2, I.W, x0, y0, lado);
  const varianza = s2 - (s * s) / n;
  if (varianza < 1e-6 || !(norma > 0)) return 0;
  let dot = 0, k = 0;
  for (let j = 0; j < lado; j++) {
    const o = (y0 + j) * w + x0;
    for (let i = 0; i < lado; i++) dot += gris[o + i] * d[k++];
  }
  return dot / (Math.sqrt(varianza) * norma);
}

// Busca la plantilla en una ventana de ±radio alrededor de (cx, cy): primero cada 2 píxeles, después fino alrededor del
// mejor y, al final, la parábola de los vecinos (subpíxel). { x, y, conf } o null si no cabe en ningún sitio.
export function buscar(gris, w, h, tpl, cx, cy, radio, I = null) {
  const ii = I || integrales(gris, w, h);
  const X = Math.round(cx), Y = Math.round(cy), rad = Math.max(1, Math.round(radio));
  let mejor = null;
  const probar = (x, y) => { const s = nccEn(gris, w, h, ii, tpl, x, y); if (s != null && (!mejor || s > mejor.s)) mejor = { x, y, s }; };
  for (let y = Y - rad; y <= Y + rad; y += 2) for (let x = X - rad; x <= X + rad; x += 2) probar(x, y);
  if (!mejor) return null;
  const g = mejor;
  for (let y = g.y - 2; y <= g.y + 2; y++) for (let x = g.x - 2; x <= g.x + 2; x++) if (Math.abs(x - X) <= rad + 1 && Math.abs(y - Y) <= rad + 1) probar(x, y);
  const { x, y, s } = mejor;
  const sub = (a, c) => { if (a == null || c == null) return 0; const den = a - 2 * s + c; if (Math.abs(den) < 1e-9) return 0; return Math.max(-0.5, Math.min(0.5, (a - c) / (2 * den))); };
  const dx = sub(nccEn(gris, w, h, ii, tpl, x - 1, y), nccEn(gris, w, h, ii, tpl, x + 1, y));
  const dy = sub(nccEn(gris, w, h, ii, tpl, x, y - 1), nccEn(gris, w, h, ii, tpl, x, y + 1));
  return { x: x + dx, y: y + dy, conf: s };
}

// Por debajo de esto, el fotograma es dudoso; tres seguidos así, se ha perdido la barra
export const CONF_MIN = 0.5;
export const DUDOSOS_MAX = 3;
// El seguidor: se crea con el fotograma donde se ha tocado la barra (gris de w × h) y el círculo del disco (en esos
// píxeles); paso(gris) da { x, y, conf, estado: 'ok' | 'dudoso' | 'perdido' }
export function crearSeguidor(gris, w, h, { x, y, r }) {
  const original = plantillaDe(gris, w, h, x, y, r);
  if (!original) return null;
  const tpl = { ...original, d: Float32Array.from(original.d) };
  let prev = { x, y }, vel = { x: 0, y: 0 }, dudosos = 0;
  const radio = Math.max(6, Math.round(original.R * 0.9));
  return {
    plantilla: tpl,
    paso(g) {
      const I = integrales(g, w, h);
      const pred = { x: prev.x + vel.x, y: prev.y + vel.y };
      const res = buscar(g, w, h, tpl, pred.x, pred.y, radio, I);
      if (!res || res.conf < CONF_MIN) {
        dudosos++;
        if (dudosos >= DUDOSOS_MAX) return { x: pred.x, y: pred.y, conf: res?.conf ?? 0, estado: 'perdido' };
        prev = pred;
        return { x: pred.x, y: pred.y, conf: res?.conf ?? 0, estado: 'dudoso' };
      }
      dudosos = 0;
      vel = { x: 0.7 * (res.x - prev.x) + 0.3 * vel.x, y: 0.7 * (res.y - prev.y) + 0.3 * vel.y };
      prev = { x: res.x, y: res.y };
      // La plantilla se actualiza despacio con lo que se ve ahora (si se ve bien) y vuelve un poco hacia la original
      if (res.conf > 0.8) {
        const nueva = plantillaDe(g, w, h, res.x, res.y, original.R);
        if (nueva && nueva.lado === tpl.lado) {
          const k1 = 1 / nueva.norma, k0 = 1 / original.norma, kt = 1 / (tpl.norma || 1);
          for (let k = 0; k < tpl.d.length; k++) tpl.d[k] = 0.82 * tpl.d[k] * kt + 0.12 * nueva.d[k] * k1 + 0.06 * original.d[k] * k0;
          normalizar(tpl);
        }
      }
      return { x: res.x, y: res.y, conf: res.conf, estado: 'ok' };
    },
  };
}

// El tamaño de proceso: unos 360 px de ancho, y menos si el disco es grande (que su radio quede en ~20 px: así cada
// fotograma cuesta poco). { w, h, k } con k = píxeles de proceso por píxel del vídeo.
export const ANCHO_PROCESO = 360;
export function tamProceso(vw, vh, rVideo) {
  let k = Math.min(1, ANCHO_PROCESO / Math.max(1, vw));
  const r = (Number(rVideo) || 0) * k;
  if (r > 20) k *= 20 / r;
  return { w: Math.max(16, Math.round(vw * k)), h: Math.max(16, Math.round(vh * k)), k };
}

// Lo que se analiza: como mucho 60 s (desde t0)
export const MAX_SEG_ANALISIS = 60;
export function tramoAnalisis(t0, t1, dur) {
  const d = Number.isFinite(dur) && dur > 0 ? dur : 0;
  let a = Math.max(0, Math.min(Number(t0) || 0, d)), b = Number.isFinite(t1) ? Math.min(t1, d) : d;
  if (b < a) [a, b] = [b, a];
  const recortado = b - a > MAX_SEG_ANALISIS + 1e-9;
  if (recortado) b = a + MAX_SEG_ANALISIS;
  return { t0: a, t1: b, recortado };
}
// Los momentos que se visitan (cada fotograma de 1/30 s), del primero al último
export const PASO = 1 / 30;
export function momentosDe(t0, t1, paso = PASO) {
  const out = [];
  const n = Math.floor((t1 - t0) / paso + 1e-6);
  for (let i = 0; i <= n; i++) out.push(Math.round((t0 + i * paso) * 1000) / 1000);
  return out;
}

// ---------------------------------------------------------------- 19. La velocidad estimada
export const DISCOS_CM = [45, 40, 35, 25];
export const DISCO_CM = 45;
export const calibracionValida = (c) => !!c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length === 4 && Object.keys(c).every((k) => ['cm', 'px', 'w', 'h'].includes(k))
  && esNum(c.cm) && c.cm >= 10 && c.cm <= 60 && esNum(c.px) && c.px > 0 && c.px <= 10000
  && Number.isInteger(c.w) && c.w >= 1 && c.w <= 10000 && Number.isInteger(c.h) && c.h >= 1 && c.h <= 10000;
// El diámetro en píxeles del vídeo entre dos toques (en coordenadas de 0 a 1)
export const diametroPx = (a, b, w, h) => Math.hypot((b[0] - a[0]) * w, (b[1] - a[1]) * h);
export function calibracion(cm, px, w, h) {
  const c = { cm: Math.round(Number(cm) * 10) / 10, px: Math.round(Number(px) * 10) / 10, w: Math.round(Number(w)), h: Math.round(Number(h)) };
  return calibracionValida(c) ? c : null;
}
export const metrosPorPx = (cal) => cal.cm / 100 / cal.px;

const esNum = (x) => typeof x === 'number' && Number.isFinite(x);

// La trayectoria en una serie uniforme (cada «paso» s), con los huecos (fotogramas perdidos) rellenados a línea recta;
// un hueco de más de huecoMax s la parte en tramos. Cada tramo: { t, x, y } (arrays).
export function serieUniforme(puntos, { paso = PASO, huecoMax = 0.5 } = {}) {
  const ps = (puntos || []).filter((p) => Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(esNum)).slice().sort((a, b) => a[0] - b[0]);
  const tramos = [];
  let actual = [];
  for (const p of ps) {
    if (actual.length && p[0] - actual[actual.length - 1][0] > huecoMax) { tramos.push(actual); actual = []; }
    if (!actual.length || p[0] > actual[actual.length - 1][0]) actual.push(p);
  }
  if (actual.length) tramos.push(actual);
  return tramos.filter((tr) => tr.length >= 2).map((tr) => {
    const t0 = tr[0][0], t1 = tr[tr.length - 1][0];
    const n = Math.floor((t1 - t0) / paso + 1e-6) + 1;
    const t = new Float64Array(n), x = new Float64Array(n), y = new Float64Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const ti = t0 + i * paso;
      while (j < tr.length - 2 && tr[j + 1][0] < ti) j++;
      const a = tr[j], b = tr[Math.min(j + 1, tr.length - 1)];
      const f = b[0] > a[0] ? Math.max(0, Math.min(1, (ti - a[0]) / (b[0] - a[0]))) : 0;
      t[i] = ti; x[i] = a[1] + (b[1] - a[1]) * f; y[i] = a[2] + (b[2] - a[2]) * f;
    }
    return { t, x, y };
  });
}
// Suavizado gaussiano (sigma en muestras), con los bordes bien tratados
export function suavizar(v, sigma = 1.5) {
  const n = v.length, out = new Float64Array(n);
  if (!(sigma > 0)) { out.set(v); return out; }
  const R = Math.max(1, Math.ceil(sigma * 3));
  const k = Array.from({ length: 2 * R + 1 }, (_, i) => Math.exp(-((i - R) ** 2) / (2 * sigma * sigma)));
  for (let i = 0; i < n; i++) {
    let s = 0, p = 0;
    for (let j = -R; j <= R; j++) { const q = i + j; if (q < 0 || q >= n) continue; s += v[q] * k[j + R]; p += k[j + R]; }
    out[i] = s / p;
  }
  return out;
}
// La derivada (diferencias centradas)
export function derivada(v, paso = PASO) {
  const n = v.length, out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = v[Math.max(0, i - 1)], b = v[Math.min(n - 1, i + 1)];
    const dt = (Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * paso;
    out[i] = dt > 0 ? (b - a) / dt : 0;
  }
  return out;
}
// Los extremos de una señal que cambian de sentido al menos «umbral» (zigzag): [{ i, tipo: 'min' | 'max' }]
export function zigzag(s, umbral) {
  const n = s.length, out = [];
  if (n < 2) return out;
  let dir = 0, imin = 0, imax = 0, cand = 0;
  for (let i = 1; i < n; i++) {
    if (dir === 0) {
      if (s[i] < s[imin]) imin = i;
      if (s[i] > s[imax]) imax = i;
      if (s[i] - s[imin] >= umbral) { out.push({ i: imin, tipo: 'min' }); dir = 1; cand = i; }
      else if (s[imax] - s[i] >= umbral) { out.push({ i: imax, tipo: 'max' }); dir = -1; cand = i; }
    } else if (dir === 1) {
      if (s[i] > s[cand]) cand = i;
      else if (s[cand] - s[i] >= umbral) { out.push({ i: cand, tipo: 'max' }); dir = -1; cand = i; }
    } else {
      if (s[i] < s[cand]) cand = i;
      else if (s[i] - s[cand] >= umbral) { out.push({ i: cand, tipo: 'min' }); dir = 1; cand = i; }
    }
  }
  if (dir === 1) out.push({ i: cand, tipo: 'max' });
  else if (dir === -1) out.push({ i: cand, tipo: 'min' });
  return out;
}

// La altura de la barra en cada momento de un tramo: en metros si está calibrado; si no, en «alturas del vídeo»
// (la imagen va de 0 arriba a 1 abajo: subir es que y baje)
function alturas(tramo, cal) {
  const k = cal ? cal.h * metrosPorPx(cal) : 1;
  const hs = new Float64Array(tramo.y.length);
  for (let i = 0; i < hs.length; i++) hs[i] = -tramo.y[i] * k;
  return hs;
}
const r3 = (x) => Math.round(x * 1000) / 1000;
const r2 = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;

// Una repetición de un tramo ya preparado ({ t, s: altura suavizada, v: su velocidad }): abajo, el punto más bajo de
// [minDe]; arriba, el más alto de [maxDe] (después de abajo); la subida, de cuando empieza a subir de verdad (más del 3 %
// de su velocidad pico) a cuando para (entre muestras, interpolado); ini, cuando empezó a bajar antes (no antes de idesde).
function medirEntre(P, minDe, maxDe, idesde, cal) {
  const { t, s, v } = P;
  const n = s.length;
  const [a0, a1] = [Math.max(0, minDe[0]), Math.min(n - 1, minDe[1])];
  if (a1 < a0) return null;
  let imin = a0;
  for (let i = a0; i <= a1; i++) if (s[i] < s[imin]) imin = i;
  const [b0, b1] = [Math.max(imin, maxDe[0]), Math.min(n - 1, maxDe[1])];
  if (b1 < b0) return null;
  let imax = b0;
  for (let i = b0; i <= b1; i++) if (s[i] > s[imax]) imax = i;
  if (imax - imin < 2) return null;
  let ipk = imin;
  for (let i = imin; i <= imax; i++) if (v[i] > v[ipk]) ipk = i;
  const vp = v[ipk];
  if (!(vp > 0)) return null;
  const umbral = 0.03 * vp;
  let a = imin; while (a < ipk && v[a] <= umbral) a++;
  let b = imax; while (b > ipk && v[b] <= umbral) b--;
  if (b <= a) return null;
  // El cruce del umbral, entre la muestra de antes y la de después (sin perder medio fotograma en cada punta)
  const cruce = (i, j) => { const f = v[j] !== v[i] ? Math.max(0, Math.min(1, (umbral - v[i]) / (v[j] - v[i]))) : 0; return [t[i] + (t[j] - t[i]) * f, s[i] + (s[j] - s[i]) * f]; };
  const [ta, sa] = a > imin ? cruce(a - 1, a) : [t[a], s[a]];
  const [tb, sb] = b < imax ? cruce(b + 1, b) : [t[b], s[b]];
  let ini = imin;
  while (ini > Math.max(0, idesde) && v[ini - 1] < -umbral) ini--;
  const dc = tb - ta;
  if (!(dc > 0)) return null;
  const out = { t: [r3(Math.min(t[ini], ta)), r3(ta), r3(tb)], dc: r2(dc), _i: [ini, a, b, imin, imax] };
  if (cal) {
    out.vm = r2(Math.min(3, Math.max(0, (sb - sa) / dc)));
    out.vp = r2(Math.min(3, Math.max(0, vp)));
    out.rom = r1(Math.min(150, Math.max(0, (s[imax] - s[imin]) * 100)));
  }
  return out;
}
// Prepara un tramo para medir: altura suavizada y su velocidad
function preparar(tramo, cal, sigma) {
  const s = suavizar(alturas(tramo, cal), sigma);
  return { t: tramo.t, s, v: derivada(s, tramo.t.length > 1 ? tramo.t[1] - tramo.t[0] : PASO), x: tramo.x };
}
export const MAX_REPS = 30;
// Las repeticiones de una trayectoria ([[t, x, y], …], de 0 a 1): cada subida de al menos un 30 % del recorrido del tramo
// (y como mínimo 4 cm calibrado, o un 3 % del alto del vídeo sin calibrar). [{ t: [ini, abajo, arriba], dc, vm?, vp?, rom? }]
export function repeticiones(puntos, { cal = null, sigma = 1.5 } = {}) {
  const c = calibracionValida(cal) ? cal : null;
  const out = [];
  for (const tramo of serieUniforme(puntos)) {
    if (tramo.t.length < 3) continue;
    const P = preparar(tramo, c, sigma);
    let lo = Infinity, hi = -Infinity;
    for (const x of P.s) { if (x < lo) lo = x; if (x > hi) hi = x; }
    const umbral = Math.max(0.3 * (hi - lo), c ? 0.04 : 0.03);
    if (hi - lo < umbral) continue;
    const ext = zigzag(P.s, umbral);
    let desde = 0;
    for (let k = 0; k + 1 < ext.length; k++) {
      if (ext[k].tipo !== 'min' || ext[k + 1].tipo !== 'max') continue;
      const r = medirEntre(P, [ext[k].i, ext[k].i], [ext[k + 1].i, ext[k + 1].i], desde, c);
      if (r) { out.push(r); desde = r._i[4]; }
    }
  }
  return out.slice(0, MAX_REPS).map(({ _i, ...r }) => r);
}
// Una repetición medida en la trayectoria: abajo, en [minDe]; arriba, en [maxDe] (momentos en s); ini, si se da
function medirEn(puntos, minDe, maxDe, { cal = null, sigma = 1.5, ini = null } = {}) {
  const c = calibracionValida(cal) ? cal : null;
  for (const tramo of serieUniforme(puntos)) {
    const n = tramo.t.length;
    if (n < 3 || minDe[0] > tramo.t[n - 1] || maxDe[1] < tramo.t[0]) continue;
    const P = preparar(tramo, c, sigma);
    const idx = (tt) => Math.max(0, Math.min(n - 1, Math.round((tt - tramo.t[0]) / (tramo.t[1] - tramo.t[0]))));
    const r = medirEntre(P, minDe.map(idx), maxDe.map(idx), idx(minDe[0]), c);
    if (!r) return null;
    const { _i, ...rep } = r;
    if (ini != null && ini <= rep.t[1]) rep.t[0] = r3(Math.max(0, ini));
    return rep;
  }
  return null;
}
// Una repetición entre dos momentos: lo más bajo y, después, lo más alto
export const medirTramo = (puntos, ta, tb, op = {}) => medirEn(puntos, [ta, tb], [ta, tb], op);
// Unir una repetición con la siguiente (el coach ve que es una sola, con un frenazo en medio): desde lo más bajo de la
// primera hasta lo más alto de la segunda
export function unirReps(puntos, reps, i, op = {}) {
  if (!reps?.[i] || !reps[i + 1]) return reps;
  const a = reps[i], b = reps[i + 1];
  const r = medirEn(puntos, [a.t[1] - 0.15, a.t[2]], [b.t[1], b.t[2] + 0.15], { ...op, ini: a.t[0] });
  return r ? [...reps.slice(0, i), r, ...reps.slice(i + 2)] : reps;
}
// Partir una repetición en el momento t (el coach ve que son dos): la primera hasta t; la segunda, desde t
export function partirRep(puntos, reps, i, t, op = {}) {
  const r = reps?.[i];
  if (!r || !(t > r.t[1]) || !(t < r.t[2])) return reps;
  const a = medirEn(puntos, [r.t[1] - 0.15, t], [r.t[1], t], { ...op, ini: r.t[0] });
  const b = a ? medirEn(puntos, [t, r.t[2]], [t, r.t[2] + 0.15], { ...op, ini: a.t[2] }) : null;
  return a && b ? [...reps.slice(0, i), a, b, ...reps.slice(i + 1)].slice(0, MAX_REPS) : reps;
}
// La serie: la mejor repetición (por velocidad media) y la pérdida de velocidad, de la mejor y de la primera a la última
export function resumenSerie(reps) {
  const vs = (reps || []).map((r) => (esNum(r?.vm) ? r.vm : null));
  const validas = vs.filter((x) => x != null);
  if (!validas.length) return null;
  const mejor = vs.indexOf(Math.max(...validas));
  const ultima = vs[vs.length - 1];
  const perdida = (ref) => (ref > 0 && ultima != null ? Math.round(((ref - ultima) / ref) * 1000) / 10 : null);
  return { mejor, vmMejor: vs[mejor], perdidaMejor: perdida(vs[mejor]), perdidaPrimera: vs[0] != null ? perdida(vs[0]) : null, n: vs.length };
}
// Cuánto se va la barra a cada lado de la vertical del principio (en cm si está calibrado; si no, en % del ancho)
export function desvioHorizontal(puntos, cal = null) {
  const ps = (puntos || []).filter((p) => Array.isArray(p) && esNum(p[1]));
  if (ps.length < 2) return null;
  const x0 = ps[0][1];
  let izq = 0, der = 0;
  for (const p of ps) { const d = p[1] - x0; if (d < izq) izq = d; if (d > der) der = d; }
  const c = calibracionValida(cal) ? cal : null;
  const k = c ? c.w * metrosPorPx(c) * 100 : 100;
  return { izq: r1(-izq * k), der: r1(der * k), unidad: c ? 'cm' : '%', x0 };
}
// Los tramos de la trayectoria según la fase: bajando o subiendo (o quieta), para pintarlos de dos colores
export function fasesTrayectoria(puntos) {
  const ps = (puntos || []).filter((p) => Array.isArray(p) && p.length >= 3);
  if (ps.length < 2) return [];
  const ys = suavizar(Float64Array.from(ps.map((p) => p[2])), 1.5);
  const v = ps.map((p, i) => { const a = Math.max(0, i - 1), b = Math.min(ps.length - 1, i + 1); const dt = ps[b][0] - ps[a][0]; return dt > 0 ? (ys[b] - ys[a]) / dt : 0; });
  const max = Math.max(...v.map(Math.abs));
  const fase = (x) => (Math.abs(x) <= 0.08 * max ? 'quieta' : x > 0 ? 'baja' : 'sube');
  const out = [];
  for (let i = 0; i < ps.length; i++) {
    const f = fase(v[i]);
    const ult = out[out.length - 1];
    if (ult && ult.fase === f) ult.p.push([ps[i][1], ps[i][2]]);
    else out.push({ fase: f, p: ult ? [ult.p[ult.p.length - 1], [ps[i][1], ps[i][2]]] : [[ps[i][1], ps[i][2]]] });
  }
  return out.filter((x) => x.p.length >= 2);
}
// Dónde está la barra en el momento t (interpolada; null fuera de la trayectoria o en un hueco)
export function posicionEn(puntos, t, huecoMax = 0.5) {
  const ps = puntos || [];
  if (!ps.length || t < ps[0][0] - 1e-6 || t > ps[ps.length - 1][0] + 1e-6) return null;
  let lo = 0, hi = ps.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ps[m][0] <= t) lo = m; else hi = m; }
  const a = ps[lo], b = ps[hi];
  if (b[0] - a[0] > huecoMax) return null;
  const f = b[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))) : 0;
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
// La repetición en la que está el vídeo (o null)
export const repEn = (reps, t) => (reps || []).findIndex((r) => t >= r.t[0] - 0.05 && t <= r.t[2] + 0.05);

// Textos
const coma = (x, dec) => (Math.round(x * 10 ** dec) / 10 ** dec).toFixed(dec).replace('.', ',');
export const textoVel = (v) => (esNum(v) ? `${coma(v, 2)} m/s` : '—');
export const textoCm = (v) => (esNum(v) ? `${coma(v, v >= 10 ? 0 : 1)} cm` : '—');
export const textoSeg = (v) => (esNum(v) ? `${coma(v, 2)} s` : '—');
export const textoPct = (v) => (esNum(v) ? `${coma(v, 0)} %` : '—');
export const textoGrados = (v) => (esNum(v) ? `${Math.round(v)}°` : '—');

// ---------------------------------------------------------------- 20. Los puntos del cuerpo
// Los 33 puntos de MediaPipe Pose (BlazePose): los que se usan, [izquierda, derecha]
export const PUNTOS_POSE = { hombro: [11, 12], codo: [13, 14], muneca: [15, 16], cadera: [23, 24], rodilla: [25, 26], tobillo: [27, 28], talon: [29, 30], pie: [31, 32] };
// El esqueleto que se dibuja (de un lado): hombro-codo-muñeca, hombro-cadera-rodilla-tobillo-pie
export const HUESOS = [['hombro', 'codo'], ['codo', 'muneca'], ['hombro', 'cadera'], ['cadera', 'rodilla'], ['rodilla', 'tobillo'], ['tobillo', 'talon'], ['talon', 'pie'], ['tobillo', 'pie']];
export const VISIBLE_MIN = 0.5;
// El ángulo en b (de 0 a 180°) entre a y c; los puntos en píxeles (para no deformarlo con la proporción del vídeo)
export function angulo(a, b, c) {
  const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
  const n1 = Math.hypot(...v1), n2 = Math.hypot(...v2);
  if (!(n1 > 0) || !(n2 > 0)) return null;
  const cos = Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)));
  return (Math.acos(cos) * 180) / Math.PI;
}
// La inclinación del tronco respecto a la vertical (0° erguido; 90°, horizontal): de la cadera al hombro
export function inclinacionTronco(cadera, hombro) {
  const dx = hombro[0] - cadera[0], dy = hombro[1] - cadera[1];
  if (!(Math.hypot(dx, dy) > 0)) return null;
  return (Math.acos(Math.max(-1, Math.min(1, -dy / Math.hypot(dx, dy)))) * 180) / Math.PI;
}
// Un punto en píxeles (si se ve lo bastante): kp es [[x, y, visibilidad], …] de 0 a 1
const punto = (kp, nombre, lado, w, h) => {
  const q = kp?.[PUNTOS_POSE[nombre][lado === 'der' ? 1 : 0]];
  return q && esNum(q[0]) && esNum(q[1]) && (q[2] == null || q[2] >= VISIBLE_MIN) ? [q[0] * w, q[1] * h] : null;
};
// Los ángulos de un fotograma: rodilla, cadera, codo y la inclinación del tronco (null lo que no se ve)
export function angulosDe(kp, lado, w = 1, h = 1) {
  const P = (n) => punto(kp, n, lado, w, h);
  const [ho, co, mu, ca, ro, to] = ['hombro', 'codo', 'muneca', 'cadera', 'rodilla', 'tobillo'].map(P);
  const r = (x) => (x == null ? null : Math.round(x * 10) / 10);
  return {
    rodilla: ca && ro && to ? r(angulo(ca, ro, to)) : null,
    cadera: ho && ca && ro ? r(angulo(ho, ca, ro)) : null,
    tronco: ca && ho ? r(inclinacionTronco(ca, ho)) : null,
    codo: ho && co && mu ? r(angulo(ho, co, mu)) : null,
  };
}
// El lado que mejor se ve (el que está hacia la cámara): el de más visibilidad media en cadera, rodilla y tobillo
export function ladoProbable(fotos) {
  let iz = 0, de = 0;
  for (const f of fotos || []) for (const n of ['hombro', 'cadera', 'rodilla', 'tobillo']) { iz += f.kp?.[PUNTOS_POSE[n][0]]?.[2] || 0; de += f.kp?.[PUNTOS_POSE[n][1]]?.[2] || 0; }
  return de > iz ? 'der' : 'izq';
}
// El fotograma de pose más cercano a t (a menos de «margen» s)
export function poseEn(fotos, t, margen = 0.12) {
  const fs = fotos || [];
  if (!fs.length) return null;
  let lo = 0, hi = fs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (fs[m].t <= t) lo = m; else hi = m; }
  const f = Math.abs(fs[lo].t - t) <= Math.abs(fs[hi].t - t) ? fs[lo] : fs[hi];
  return Math.abs(f.t - t) <= margen ? f : null;
}
// Las repeticiones según la cadera (si no hay trayectoria de la barra): la cadera sube en la subida
export function repsDeCadera(fotos, lado) {
  const i = PUNTOS_POSE.cadera[lado === 'der' ? 1 : 0];
  const ps = (fotos || []).filter((f) => f.kp?.[i] && (f.kp[i][2] ?? 1) >= VISIBLE_MIN).map((f) => [f.t, f.kp[i][0], f.kp[i][1]]);
  return repeticiones(ps, { sigma: 1 });
}
// Por repetición: el ángulo mínimo de rodilla (la profundidad), la inclinación máxima del tronco, el mínimo de cadera y
// (en los press) el mínimo de codo. reps: [{ t: [ini, abajo, arriba] }] → [{ t: [ini, arriba], rodilla, tronco, cadera, codo? }]
export function resumenPose(fotos, reps, lado, { w = 1, h = 1, codo = false } = {}) {
  const out = [];
  for (const r of (reps || []).slice(0, MAX_REPS)) {
    const a = r.t[0], b = r.t[r.t.length - 1];
    let rod = null, tro = null, cad = null, cod = null;
    for (const f of fotos || []) {
      if (f.t < a - 1e-6 || f.t > b + 1e-6) continue;
      const g = angulosDe(f.kp, lado, w, h);
      if (g.rodilla != null && (rod == null || g.rodilla < rod)) rod = g.rodilla;
      if (g.tronco != null && (tro == null || g.tronco > tro)) tro = g.tronco;
      if (g.cadera != null && (cad == null || g.cadera < cad)) cad = g.cadera;
      if (g.codo != null && (cod == null || g.codo < cod)) cod = g.codo;
    }
    const x = { t: [r3(a), r3(b)] };
    if (rod != null) x.rodilla = Math.round(rod);
    if (tro != null) x.tronco = Math.round(tro);
    if (cad != null) x.cadera = Math.round(cad);
    if (codo && cod != null) x.codo = Math.round(cod);
    if (Object.keys(x).length > 1) out.push(x);
  }
  return out;
}

// ---------------------------------------------------------------- Lo que se guarda (como analisis_valido() en la base)
export const MAX_PUNTOS_BARRA = 900;
export const MAX_BYTES_ANALISIS = 65536;
export const ANGULOS = ['rodilla', 'cadera', 'tronco', 'codo'];
const soloClaves = (o, ks) => Object.keys(o).every((k) => ks.includes(k));
const esObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const entre = (x, lo, hi) => esNum(x) && x >= lo && x <= hi;
// El tamaño del texto que guarda la base (jsonb::text: «, » entre elementos y «: » tras cada clave)
export function tamJsonb(x) {
  if (Array.isArray(x)) return 2 + x.reduce((s, v) => s + tamJsonb(v), 0) + Math.max(0, x.length - 1) * 2;
  if (esObj(x)) { const ks = Object.keys(x); return 2 + ks.reduce((s, k) => s + bytes(JSON.stringify(k)) + 2 + tamJsonb(x[k]), 0) + Math.max(0, ks.length - 1) * 2; }
  return bytes(JSON.stringify(x));
}
const bytes = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : unescape(encodeURIComponent(s)).length);
// { v: 1, barra?: { p: [[t, x, y], 2..900] }, cal?: { cm, px, w, h }, reps?: [1..30 × { t: [ini, abajo, arriba], dc?, vm?, vp?, rom? }],
//   pose?: { lado: 'izq' | 'der', reps: [1..30 × { t: [desde, hasta], rodilla?, cadera?, tronco?, codo? }] } }; con barra o pose; las
// repeticiones de la velocidad, solo con barra; dur: la duración del vídeo (como el trigger: nada después de dur + 1)
export function analisisValido(a, dur = null) {
  if (!esObj(a) || !soloClaves(a, ['v', 'barra', 'cal', 'reps', 'pose'])) return false;
  if (a.v !== 1 || !('barra' in a || 'pose' in a) || ('reps' in a && !('barra' in a))) return false;
  const tope = Number.isFinite(dur) && dur >= 0 ? Math.min(3600, dur + 1) : 3600;
  if ('barra' in a) {
    const b = a.barra;
    if (!esObj(b) || !soloClaves(b, ['p']) || !Array.isArray(b.p) || b.p.length < 2 || b.p.length > MAX_PUNTOS_BARRA) return false;
    let prev = -1;
    for (const p of b.p) {
      if (!Array.isArray(p) || p.length !== 3 || !p.every(esNum)) return false;
      if (p[0] < 0 || p[0] > 3600 || p[0] <= prev || p[0] > tope || !entre(p[1], 0, 1) || !entre(p[2], 0, 1)) return false;
      prev = p[0];
    }
  }
  if ('cal' in a && !calibracionValida(a.cal)) return false;
  if ('reps' in a) {
    if (!Array.isArray(a.reps) || a.reps.length < 1 || a.reps.length > MAX_REPS) return false;
    let prev = -1;
    for (const r of a.reps) {
      if (!esObj(r) || !soloClaves(r, ['t', 'dc', 'vm', 'vp', 'rom'])) return false;
      if (!Array.isArray(r.t) || r.t.length !== 3 || !r.t.every(esNum)) return false;
      if (r.t[0] < 0 || r.t[0] > r.t[1] || r.t[1] > r.t[2] || r.t[2] > 3600 || r.t[2] > tope || r.t[1] <= prev) return false;
      prev = r.t[1];
      if (('dc' in r && !entre(r.dc, 0, 60)) || ('vm' in r && !entre(r.vm, 0, 3)) || ('vp' in r && !entre(r.vp, 0, 3)) || ('rom' in r && !entre(r.rom, 0, 150))) return false;
    }
  }
  if ('pose' in a) {
    const p = a.pose;
    if (!esObj(p) || !soloClaves(p, ['lado', 'reps']) || !['izq', 'der'].includes(p.lado) || !Array.isArray(p.reps) || p.reps.length < 1 || p.reps.length > MAX_REPS) return false;
    let prev = -1;
    for (const r of p.reps) {
      if (!esObj(r) || !soloClaves(r, ['t', ...ANGULOS]) || !Array.isArray(r.t) || r.t.length !== 2 || !r.t.every(esNum)) return false;
      if (r.t[0] < 0 || r.t[0] > r.t[1] || r.t[1] > 3600 || r.t[1] > tope || r.t[0] < prev) return false;
      prev = r.t[0];
      const ks = ANGULOS.filter((k) => k in r);
      if (!ks.length || !ks.every((k) => entre(r[k], 0, 180))) return false;
    }
  }
  return tamJsonb(a) <= MAX_BYTES_ANALISIS;
}
// Lo que se guarda: la trayectoria con 3 decimales (y como mucho 900 puntos: uno de cada k), las repeticiones y la pose
// por repetición (nunca los puntos del cuerpo de cada fotograma). null si no queda nada que guardar.
export function limpiarAnalisis({ barra = null, cal = null, reps = null, pose = null } = {}) {
  const out = { v: 1 };
  const ps = (barra?.p || []).filter((p) => Array.isArray(p) && p.slice(0, 3).every(esNum));
  if (ps.length >= 2) {
    const k = Math.ceil(ps.length / MAX_PUNTOS_BARRA);
    const elegidos = ps.filter((_, i) => i % k === 0);
    if (elegidos[elegidos.length - 1] !== ps[ps.length - 1] && elegidos.length < MAX_PUNTOS_BARRA) elegidos.push(ps[ps.length - 1]);
    let prev = -1;
    out.barra = { p: elegidos.map((p) => [r3(Math.max(0, p[0])), r3(Math.min(1, Math.max(0, p[1]))), r3(Math.min(1, Math.max(0, p[2])))]).filter((p) => { if (p[0] <= prev) return false; prev = p[0]; return true; }) };
    if (out.barra.p.length < 2) delete out.barra;
  }
  if (out.barra && calibracionValida(cal)) out.cal = { cm: cal.cm, px: cal.px, w: cal.w, h: cal.h };
  if (out.barra && reps?.length) {
    const rs = reps.slice(0, MAX_REPS).map((r) => {
      const x = { t: r.t.map(r3) };
      for (const [k, lo, hi, f] of [['dc', 0, 60, r2], ['vm', 0, 3, r2], ['vp', 0, 3, r2], ['rom', 0, 150, r1]]) if (esNum(r[k])) x[k] = f(Math.min(hi, Math.max(lo, r[k])));
      return x;
    });
    out.reps = rs;
  }
  if (pose?.reps?.length && ['izq', 'der'].includes(pose.lado)) out.pose = { lado: pose.lado, reps: pose.reps.slice(0, MAX_REPS).map((r) => { const x = { t: r.t.map(r3) }; for (const k of ANGULOS) if (esNum(r[k])) x[k] = Math.round(Math.min(180, Math.max(0, r[k]))); return x; }) };
  return out.barra || out.pose ? out : null;
}

// «Mi técnica»: la mejor velocidad media de cada vídeo de un ejercicio a lo largo del tiempo (una por día, la mejor)
export function serieVelocidad(videos = []) {
  const por = new Map();
  for (const v of videos || []) {
    const reps = v?.revision?.analisis?.reps || [];
    const vs = reps.map((r) => r.vm).filter(esNum);
    if (!vs.length || !v.fecha) continue;
    const m = Math.max(...vs);
    if (!por.has(v.fecha) || por.get(v.fecha) < m) por.set(v.fecha, m);
  }
  return [...por.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([x, y]) => ({ x, y }));
}
