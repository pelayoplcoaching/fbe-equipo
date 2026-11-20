// (v0.200, belleza) Lo que se instala una vez al arrancar (main.jsx): la decoración de temporada y la onda al pulsar un
// botón. Los estilos, en belleza.css. Todo es adorno: no recibe toques, no lo leen los lectores de pantalla y, con
// «reducir movimiento», se queda quieto (los copos) o no sale (la onda).
import { temporadaDe, coposDe, semillaDia, decoracionDe, horaDecimal } from '../logica/cielo.js';
import { leerAjustes, EVENTO_AJUSTES } from './ajustes.js';
import { sinMovimiento } from './transiciones.js';
import { hoyISO } from '../logica/fechas.js';

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
// En un navegador automático (las pruebas), la onda solo si la prueba la pide: así no se cruza con las demás
export const automatico = () => typeof navigator !== 'undefined' && !!navigator.webdriver && !leer('fbe-probar-belleza');

// ---------- La temporada: html[data-temporada] y una capa de copos detrás del contenido ----------
let capa = null, puesta = null;
export function aplicarTemporada(a = leerAjustes(), hoy = hoyISO()) {
  if (typeof document === 'undefined' || !document.body) return null;
  // (segunda tanda) sin temporada, de noche, estrellas tenues (que solo se ven en oscuro)
  const t = decoracionDe({ fecha: hoy, hora: horaDecimal(), encendida: a.temporada !== false });
  const r = document.documentElement;
  if (t && t !== 'estrellas') r.setAttribute('data-temporada', t); else r.removeAttribute('data-temporada');
  if (t) r.setAttribute('data-fondo-cielo', t); else r.removeAttribute('data-fondo-cielo');
  const clave = t ? `${t}|${hoy}` : null;
  if (clave === puesta && (!t || capa?.isConnected)) return t;
  puesta = clave;
  capa?.remove();
  capa = null;
  if (!t) return null;
  capa = document.createElement('div');
  capa.className = `temporada-capa temporada-${t}`;
  capa.setAttribute('aria-hidden', 'true');
  for (const c of coposDe(t, semillaDia(hoy))) {
    const i = document.createElement('i');
    i.style.setProperty('--x', `${c.x}%`);
    i.style.setProperty('--tam', `${c.tam}px`);
    i.style.setProperty('--dura', `${c.dura}s`);
    i.style.setProperty('--espera', `${c.espera}s`);
    i.style.setProperty('--deriva', `${c.deriva}px`);
    i.style.setProperty('--op', String(c.op));
    i.style.setProperty('--y', `${c.y}%`);
    capa.appendChild(i);
  }
  document.body.appendChild(capa);
  return t;
}

// ---------- La onda: un círculo del color del texto del botón que se abre desde el dedo y se apaga ----------
// No toca el botón (ni su contenido ni su recorte): es una capa fija encima de él, del mismo tamaño y con sus esquinas
const CON_ONDA = '.btn, .tab, .acento-op';
export function lanzarOnda(el, x, y) {
  if (!el || typeof document === 'undefined') return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const cs = getComputedStyle(el);
  const caja = document.createElement('span');
  caja.className = 'onda-capa';
  caja.setAttribute('aria-hidden', 'true');
  // (dentro de la pantalla: un botón medio fuera no estira nada)
  const izq = Math.max(0, r.left), arr = Math.max(0, r.top);
  const an = Math.min(r.right, window.innerWidth) - izq, al = Math.min(r.bottom, window.innerHeight) - arr;
  if (an <= 0 || al <= 0) return null;
  Object.assign(caja.style, { left: `${izq}px`, top: `${arr}px`, width: `${an}px`, height: `${al}px`, borderRadius: cs.borderRadius, color: cs.color });
  const px = (Number.isFinite(x) ? x : r.left + r.width / 2) - izq, py = (Number.isFinite(y) ? y : r.top + r.height / 2) - arr;
  const radio = Math.ceil(Math.hypot(Math.max(px, an - px), Math.max(py, al - py)));
  const o = document.createElement('i');
  Object.assign(o.style, { left: `${px - radio}px`, top: `${py - radio}px`, width: `${radio * 2}px`, height: `${radio * 2}px` });
  caja.appendChild(o);
  document.body.appendChild(caja);
  const quitar = () => caja.remove();
  o.addEventListener('animationend', quitar, { once: true });
  setTimeout(quitar, 900);
  return caja;
}

// ---------- Los degradados de las barras de las gráficas: una sola vez, en el documento (los usa belleza.css) ----------
const DEGRADADOS = ['acento', 'seq', 'azul', 'ok'];
export function ponerDegradados() {
  if (typeof document === 'undefined' || !document.body || document.getElementById('defs-belleza')) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('id', 'defs-belleza');
  svg.setAttribute('class', 'defs-belleza');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const defs = document.createElementNS(ns, 'defs');
  for (const k of DEGRADADOS) {
    const g = document.createElementNS(ns, 'linearGradient');
    g.setAttribute('id', `deg-barra-${k}`);
    g.setAttribute('x1', '0'); g.setAttribute('y1', '0'); g.setAttribute('x2', '0'); g.setAttribute('y2', '1');
    for (const [off, cl] of [['0', 'a'], ['1', 'b']]) {
      const s = document.createElementNS(ns, 'stop');
      s.setAttribute('offset', off);
      s.setAttribute('class', `deg-${k}-${cl}`);
      g.appendChild(s);
    }
    defs.appendChild(g);
  }
  svg.appendChild(defs);
  document.body.appendChild(svg);
}

// ---------- Las barras crecen la primera vez que la gráfica se ve ----------
// Las que ya están a la vista al pintarse empiezan en ese mismo instante (antes de verse, sin parpadeo); las demás, al
// llegar a la pantalla. Cada barra lleva su orden, para que crezcan una detrás de otra.
const vistas = new WeakSet();
let io = null;
function crecer(svg) {
  if (vistas.has(svg)) return;
  vistas.add(svg);
  svg.querySelectorAll('rect.barra, rect.barra-dia').forEach((r, i) => r.style.setProperty('--orden', String(Math.min(i, 16))));
  svg.classList.add('grafica-crece');
}
function mirarGrafica(svg) {
  if (vistas.has(svg) || !svg.querySelector('rect.barra, rect.barra-dia')) return;
  const r = svg.getBoundingClientRect();
  if (r.bottom > 0 && r.top < window.innerHeight && r.width > 0) { crecer(svg); return; }
  if (typeof IntersectionObserver === 'undefined') { crecer(svg); return; }
  io ||= new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); crecer(e.target); } }, { threshold: 0.3 });
  io.observe(svg);
}
export function vigilarGraficas() {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.body) return;
  const buscar = (n) => {
    if (n.nodeType !== 1) return;
    if (n.matches?.('svg.grafica')) mirarGrafica(n);
    n.querySelectorAll?.('svg.grafica').forEach(mirarGrafica);
  };
  // (una barra que llega después, con la gráfica ya puesta, también cuenta: se mira la gráfica que la contiene)
  new MutationObserver((ms) => {
    for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      const g = n.closest?.('svg.grafica');
      if (g) mirarGrafica(g); else buscar(n);
    }
  }).observe(document.body, { childList: true, subtree: true });
  buscar(document.body);
}

let instalado = false;
export function instalarBelleza() {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  aplicarTemporada();
  ponerDegradados();
  if (!sinMovimiento()) vigilarGraficas();
  window.addEventListener(EVENTO_AJUSTES, () => aplicarTemporada());
  // (al anochecer salen las estrellas: se mira cada diez minutos)
  setInterval(() => aplicarTemporada(), 10 * 60 * 1000);
  // (al volver a la app: si ha pasado la medianoche, la del día nuevo)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') aplicarTemporada(); });
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || automatico() || sinMovimiento()) return;
    const el = e.target?.closest?.(CON_ONDA);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    lanzarOnda(el, e.clientX, e.clientY);
  }, { passive: true });
}
