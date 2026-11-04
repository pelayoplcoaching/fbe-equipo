// v0.60 (13): «Difuminar la cara» antes de enviar un vídeo. La cara se busca en el propio móvil con el modelo de los puntos
// del cuerpo que ya lleva la app (MediaPipe Pose, v0.58: sin descargar otro): la nariz, los ojos, las orejas y la boca dan
// una caja de la cabeza en cada fotograma mirado. Los fotogramas en que no sale se rellenan con los de al lado (y la caja
// crece un poco, por si acaso); si no sale en ninguno, no se envía un vídeo «difuminado» que no lo está.
// Aquí, lo que no depende de la pantalla (y se prueba sin navegador).

// Los puntos de la cara en MediaPipe Pose: 0 nariz, 1-6 ojos, 7-8 orejas, 9-10 boca; 11-12, los hombros (para el tamaño)
export const PUNTOS_CARA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const VISIBLE_MIN = 0.5;
export const HUECO_SIN_AVISO = 1;      // s: un hueco más largo se rellena igual, pero se avisa en la vista previa
export const COBERTURA_MIN = 0.5;      // con menos de la mitad de los fotogramas con cara, se avisa

const visible = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility == null || p.visibility >= VISIBLE_MIN);
const lim = (x) => Math.min(1, Math.max(0, x));

// La caja de la cabeza (de 0 a 1 en cada eje) con los puntos de un fotograma (33 × { x, y, visibility }) en una imagen de
// w × h. Cuadrada en píxeles, con margen (de perfil solo se ven la nariz, un ojo y una oreja: el ancho real de la cabeza
// es casi el doble) y un poco hacia arriba (la frente y el pelo). null si se ven menos de 2 puntos de la cara.
export function cajaCabeza(puntos, { w = 1, h = 1 } = {}) {
  if (!Array.isArray(puntos) || !(w > 0) || !(h > 0)) return null;
  const cara = PUNTOS_CARA.map((i) => puntos[i]).filter(visible).map((p) => [p.x * w, p.y * h]);
  if (cara.length < 2) return null;
  const xs = cara.map((p) => p[0]), ys = cara.map((p) => p[1]);
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const [hi, hd] = [puntos[11], puntos[12]];
  const hombros = visible(hi) && visible(hd) ? Math.hypot((hi.x - hd.x) * w, (hi.y - hd.y) * h) : 0;
  // El lado: el de la cara con margen, nunca menos de lo que dan los hombros (de frente, ~0,6 de su anchura) ni de un 6 %
  // del alto de la imagen
  const lado = Math.max(span * 2.4, hombros * 0.6, 0.06 * h);
  const x0 = cx - lado / 2, y0 = cy - lado * 0.62;
  const caja = { x: lim(x0 / w), y: lim(y0 / h), w: 0, h: 0 };
  caja.w = lim((x0 + lado) / w) - caja.x;
  caja.h = lim((y0 + lado) / h) - caja.y;
  return caja.w > 0 && caja.h > 0 ? redondear(caja) : null;
}
const r4 = (x) => Math.round(x * 10000) / 10000;
const redondear = (c) => ({ x: r4(c.x), y: r4(c.y), w: r4(c.w), h: r4(c.h) });

// Entre dos cajas (k de 0 a 1), y una caja agrandada por igual alrededor de su centro (sin salirse de la imagen)
export const mezclar = (a, b, k) => redondear({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });
export function agrandar(c, f = 1) {
  if (!c || !(f > 1)) return c;
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2, w = c.w * f, h = c.h * f;
  const x = lim(cx - w / 2), y = lim(cy - h / 2);
  return redondear({ x, y, w: lim(cx + w / 2) - x, h: lim(cy + h / 2) - y });
}

// muestras: [{ t, caja | null }] (los fotogramas mirados, en orden). Rellena los que no tienen cara con los de al lado:
// entre dos con cara, a medio camino (y la caja crece con lo largo del hueco: hasta un 50 % más a partir de 2 s); al
// principio o al final, la más cercana. Devuelve { cajas: [{ t, caja, rellena }], detectadas, rellenadas, cobertura,
// huecoMax, estado: 'nada' | 'avisar' | 'bien' }.
export function interpolarCajas(muestras) {
  const ms = (Array.isArray(muestras) ? muestras : []).filter((m) => m && Number.isFinite(m.t)).sort((a, b) => a.t - b.t);
  const con = ms.map((m, i) => (m.caja ? i : -1)).filter((i) => i >= 0);
  const detectadas = con.length;
  if (!detectadas) return { cajas: ms.map((m) => ({ t: m.t, caja: null, rellena: false })), detectadas: 0, rellenadas: 0, cobertura: 0, huecoMax: ms.length ? Infinity : 0, estado: 'nada' };
  let huecoMax = 0, rellenadas = 0;
  const cajas = ms.map((m, i) => {
    if (m.caja) return { t: m.t, caja: m.caja, rellena: false };
    const ant = [...con].reverse().find((j) => j < i), sig = con.find((j) => j > i);
    let caja, hueco;
    if (ant != null && sig != null) {
      hueco = ms[sig].t - ms[ant].t;
      caja = mezclar(ms[ant].caja, ms[sig].caja, (m.t - ms[ant].t) / (hueco || 1));
    } else {
      const j = ant != null ? ant : sig;
      hueco = Math.abs(m.t - ms[j].t) * 2;
      caja = ms[j].caja;
    }
    huecoMax = Math.max(huecoMax, hueco);
    rellenadas++;
    return { t: m.t, caja: agrandar(caja, 1 + Math.min(1, hueco / 2) * 0.5), rellena: true };
  });
  const cobertura = Math.round((detectadas / ms.length) * 1000) / 1000;
  const estado = cobertura < COBERTURA_MIN || huecoMax > HUECO_SIN_AVISO ? 'avisar' : 'bien';
  return { cajas, detectadas, rellenadas, cobertura, huecoMax: Math.round(huecoMax * 100) / 100, estado };
}

// La caja en un momento cualquiera t (entre dos fotogramas mirados, a medio camino; fuera, la más cercana)
export function cajaEn(cajas, t) {
  const cs = (cajas || []).filter((c) => c?.caja);
  if (!cs.length || !Number.isFinite(t)) return null;
  if (t <= cs[0].t) return cs[0].caja;
  if (t >= cs[cs.length - 1].t) return cs[cs.length - 1].caja;
  let lo = 0, hi = cs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cs[m].t <= t) lo = m; else hi = m; }
  const a = cs[lo], b = cs[hi];
  return mezclar(a.caja, b.caja, (t - a.t) / ((b.t - a.t) || 1));
}

// Los momentos que se miran: unos 5 por segundo (como mucho MAX muestras) del principio al final
export function tiemposCara(dur, { porSegundo = 5, max = 600 } = {}) {
  const d = Number(dur);
  if (!(d > 0)) return [];
  const n = Math.max(2, Math.min(max, Math.ceil(d * porSegundo) + 1));
  return Array.from({ length: n }, (_, i) => Math.round(Math.min(d - 0.04, (i * d) / (n - 1)) * 1000) / 1000).map((t) => Math.max(0, t));
}

// El texto de la vista previa
export function textoDeteccion(r) {
  if (!r || r.estado === 'nada') return 'No se ha encontrado tu cara en el vídeo, así que no se puede difuminar. Puedes enviarlo sin difuminar, o grabarlo de nuevo con la cara a la vista.';
  const pc = Math.round((r.cobertura || 0) * 100);
  if (r.estado === 'avisar') return `Tu cara se ha encontrado en el ${pc} % del vídeo; el resto se ha rellenado con lo de al lado. Revisa la vista previa antes de enviarlo.`;
  return `Tu cara se ha encontrado en el ${pc} % del vídeo${r.rellenadas ? ' (lo demás se ha rellenado con lo de al lado)' : ''}. Revisa la vista previa.`;
}
