// v0.52: física de las hojas (como Apple Maps o Things 3), pura y sin dependencias, para poder probarla.
// - Un muelle amortiguado (masa 1): la posición en cada instante, sin integrar paso a paso (la solución exacta del
//   oscilador), así no se desfasa aunque el móvil vaya lento. Con amortiguación 1 es crítico (llega sin pasarse);
//   un poco por debajo, se pasa una pizca y vuelve, como en iOS.
// - Al soltar, se proyecta adónde iría la hoja con la velocidad que lleva (la deceleración de UIScrollView) y se
//   elige el tope más cercano a ese punto: completa, media (~55 % de la pantalla, solo en las hojas largas) o cerrada.
// - Por encima de su tope, la hoja se resiste como una goma (la fórmula de iOS).
// Las posiciones son desplazamientos hacia abajo en px desde la hoja completa (0 = completa).

export const MUELLE = { rigidez: 420, amortiguacion: 0.86 };   // ω0 ≈ 20,5 rad/s; ζ 0,86: se pasa < 1 % y asienta en ~0,4 s
export const MUELLE_SUAVE = { rigidez: 300, amortiguacion: 1 }; // crítico: para abrir (sin rebote)
export const DECELERACION = 0.995;                               // por cada ms (la «normal» de iOS es 0,998; esta frena antes)
export const FRACCION_MEDIA = 0.55;                              // el tope medio: el 55 % del alto de la pantalla
export const GOMA = 0.55;                                        // la constante de la goma de iOS

// La posición y la velocidad de un muelle que va de «desde» a «hasta» con velocidad inicial v0 (px/s), en t segundos
export function muelle({ desde, hasta, velocidad = 0, rigidez = MUELLE.rigidez, amortiguacion = MUELLE.amortiguacion }) {
  const w0 = Math.sqrt(Math.max(1e-6, rigidez));
  const z = Math.max(0, amortiguacion);
  const x0 = desde - hasta, v0 = velocidad;
  let pos, vel;
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const A = x0, B = (v0 + z * w0 * x0) / wd;
    pos = (t) => Math.exp(-z * w0 * t) * (A * Math.cos(wd * t) + B * Math.sin(wd * t));
    vel = (t) => {
      const e = Math.exp(-z * w0 * t), c = Math.cos(wd * t), s = Math.sin(wd * t);
      return e * ((-z * w0) * (A * c + B * s) + (-A * wd * s + B * wd * c));
    };
  } else if (z === 1) {
    const B = v0 + w0 * x0;
    pos = (t) => Math.exp(-w0 * t) * (x0 + B * t);
    vel = (t) => Math.exp(-w0 * t) * (B - w0 * (x0 + B * t));
  } else {
    const s = w0 * Math.sqrt(z * z - 1);
    const r1 = -z * w0 + s, r2 = -z * w0 - s;
    const C2 = (v0 - r1 * x0) / (r2 - r1), C1 = x0 - C2;
    pos = (t) => C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
    vel = (t) => C1 * r1 * Math.exp(r1 * t) + C2 * r2 * Math.exp(r2 * t);
  }
  return { posicion: (t) => hasta + pos(t), velocidad: vel };
}

// Fotogramas del muelle (cada 1/60 s) hasta que se asienta: a menos de medio píxel y casi quieto, como mucho 1,5 s.
// Se usan como fotogramas clave de la Web Animations API (solo transform: va por el compositor).
export function fotogramasMuelle(opciones, { fps = 60, tope = 1.5, margen = 0.5 } = {}) {
  const m = muelle(opciones);
  const paso = 1 / fps;
  const puntos = [opciones.desde];
  let t = 0;
  while (t < tope) {
    t += paso;
    const x = m.posicion(t);
    puntos.push(x);
    if (Math.abs(x - opciones.hasta) < margen && Math.abs(m.velocidad(t)) < 20) break;
  }
  puntos[puntos.length - 1] = opciones.hasta;
  return { puntos, duracion: Math.round((puntos.length - 1) * paso * 1000) };
}

// Adónde llegaría algo que se suelta con velocidad v (px/s) y frena con la deceleración de iOS
export function proyectar(y, velocidad, deceleracion = DECELERACION) {
  return y + ((velocidad / 1000) * deceleracion) / (1 - deceleracion);
}

// La velocidad (px/s) al soltar, de las muestras del último instante [{ y, t (ms) }]: la pendiente de los últimos
// ~100 ms (con dos muestras sueltas, un temblor del dedo daría una velocidad enorme)
export function velocidadDe(muestras, ventana = 100) {
  if (!muestras?.length) return 0;
  const ult = muestras[muestras.length - 1];
  const dentro = muestras.filter((m) => ult.t - m.t <= ventana);
  const pri = dentro.length > 1 ? dentro[0] : muestras[Math.max(0, muestras.length - 2)];
  const dt = ult.t - pri.t;
  if (dt <= 0) return 0;
  return ((ult.y - pri.y) / dt) * 1000;
}

// La goma de iOS: cuanto más se pasa, menos se mueve (nunca más allá de «dimension»)
export function goma(exceso, dimension, c = GOMA) {
  if (exceso <= 0 || dimension <= 0) return 0;
  return (1 - 1 / ((exceso * c) / dimension + 1)) * dimension;
}

// Los topes de una hoja: completa (0), media (si tiene y se nota) y cerrada (todo su alto, y un poco más)
export function topesHoja({ alto, pantalla, medio = false }) {
  const topes = { completa: 0, cerrada: alto + 24 };
  const media = alto - pantalla * FRACCION_MEDIA;
  if (medio && media > 48) topes.media = Math.round(media);
  return topes;
}

// Al soltar: adónde iría con su velocidad. Se cierra si eso queda más allá del tope abierto más bajo en más de 140 px
// (o del 30 % de lo que queda de hoja), la regla de la v0.49; si no, el tope abierto más cercano.
export const UMBRAL_CIERRE = { px: 140, fraccion: 0.3 };
export function destinoHoja({ y, velocidad = 0, alto, pantalla, medio = false }) {
  const topes = topesHoja({ alto, pantalla, medio });
  const fin = proyectar(y, velocidad);
  const abiertos = Object.entries(topes).filter(([k]) => k !== 'cerrada');
  const masBajo = Math.max(...abiertos.map(([, v]) => v));
  const umbral = masBajo + Math.min(UMBRAL_CIERRE.px, UMBRAL_CIERRE.fraccion * Math.max(0, alto - masBajo));
  if (fin > umbral) return { tope: 'cerrada', y: topes.cerrada, proyectado: Math.round(fin) };
  let mejor = 'completa', dist = Infinity;
  for (const [k, v] of abiertos) {
    const d = Math.abs(fin - v);
    if (d < dist) { dist = d; mejor = k; }
  }
  return { tope: mejor, y: topes[mejor], proyectado: Math.round(fin) };
}

// Lo que se ve mientras se arrastra: 1:1 con el dedo; por encima de la hoja completa, con goma
export function arrastreVisible(y, alto) {
  return y >= 0 ? y : -goma(-y, Math.max(1, alto));
}
