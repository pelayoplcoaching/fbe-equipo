// (tacto 224 y 225, v0.272) La barra de abajo, con el dedo. Deslizar el pulgar por ella cambia de pestaña: la píldora
// sigue al dedo, con un toque en cada una, y al soltar se va a esa. Mantener una pulsada abre sus atajos: en «Hoy»,
// «Empezar», «Check-in» y «Tu peso»; en «Progreso», sus cuatro partes; en «Más», lo último que abriste. Con los atajos
// abiertos se puede subir el dedo hasta uno y soltar, o tocarlo después. Un toque normal sigue haciendo lo de siempre.
// Va aparte: llega cuando la app ya está abierta (AtletaApp lo pide), y escucha en el documento porque la barra se quita
// y se pone al entrar y salir de una sesión.
import { render } from 'preact';
import { Icono } from '../comunes.jsx';
import { vibrar } from '../hapticos.js';
import { leerAjustes } from '../ajustes.js';
import { sinMovimiento } from '../transiciones.js';
import { SUBS_PROGRESO, pedirSubProgreso } from './sub-progreso.js';
import { atajosDe, ICONO_SUB, LARGO_MS } from '../../logica/barra-atajos.js';

const CLAVE = 'fbe-mas-ultimo';
const leerUltimo = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const guardarUltimo = (id) => { try { localStorage.setItem(CLAVE, id); } catch { /* */ } };

// Tras ir a Hoy, toca lo que lleva esa marca (data-atajo): «Empezar sesión» o el botón de «Tu peso» (si su tarjeta está
// plegada, se abre antes). Si no está (hoy no hay sesión), lo dice
function tocarEnHoy(que, o) {
  const fin = Date.now() + 2500;
  const mirar = () => {
    let b = document.querySelector(`main [data-atajo="${que}"]`);
    if (!b && que === 'peso') { const d = document.querySelector('main details[data-plegable="peso"]'); if (d && !d.open) { d.open = true; d.dispatchEvent(new Event('toggle')); } b = document.querySelector('main [data-atajo="peso"]'); }
    if (b) { b.scrollIntoView({ block: 'center', behavior: 'auto' }); b.click(); return; }
    if (Date.now() < fin) { setTimeout(mirar, 120); return; }
    if (que === 'empezar') o.aviso?.('Hoy no tienes una sesión por empezar');
  };
  setTimeout(mirar, 60);
}

// leer(): { tab, irAPestana(id), tabs: [ids de todas], mas: [[id, texto, icono]…], salud, aviso }. Devuelve cómo quitarlo
export function instalarBarra(leer) {
  let g = null, sinClic = -1e9, nodo = null, abierto = null;
  const barraDe = (el) => el?.closest?.('.tabs-flota .tabs-in') || null;
  const pestanas = (cont) => [...cont.querySelectorAll('button.tab[data-tab], button.tab-mas')].filter((b) => b.getClientRects().length);
  const idDe = (b) => b?.dataset.tab || (b?.classList.contains('tab-mas') ? 'mas' : null);
  const cercana = (cont, x) => {
    let mejor = null, d = Infinity;
    for (const b of pestanas(cont)) { const r = b.getBoundingClientRect(); const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0; if (dx < d) { d = dx; mejor = b; } }
    return mejor;
  };
  const acciones = (id) => {
    const o = leer();
    const ir = (t) => () => o.irAPestana(t);
    return atajosDe(id, { tabs: o.tabs, mas: o.mas, ultimo: leerUltimo(), conPeso: !!o.salud && !leerAjustes().ocultar?.peso, subs: SUBS_PROGRESO }).map((a) => ({
      ...a,
      fn: a.que === 'empezar' || a.que === 'peso' ? () => { if (o.tab !== 'hoy') o.irAPestana('hoy'); tocarEnHoy(a.que, o); }
        : a.que === 'sub' ? () => { pedirSubProgreso(a.id); if (o.tab !== 'progreso') o.irAPestana('progreso'); }
          : ir(a.id),
    }));
  };

  // ---- los atajos
  const cerrar = () => { if (!nodo) return; render(null, nodo); nodo.remove(); nodo = null; abierto = null; document.removeEventListener('keydown', tecla, true); };
  const elegir = (a) => { cerrar(); vibrar('elegir'); a.fn(); };
  function tecla(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); const b = abierto?.boton; cerrar(); b?.focus?.({ preventScroll: true }); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const bs = [...(nodo?.querySelectorAll('.bg-item') || [])];
    if (!bs.length) return;
    e.preventDefault();
    const i = bs.indexOf(document.activeElement);
    bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
  }
  const abrir = (boton, { foco = false } = {}) => {
    const id = idDe(boton);
    const items = id ? acciones(id) : [];
    if (!items.length) return false;
    cerrar();
    const r = boton.getBoundingClientRect(), cont = barraDe(boton).getBoundingClientRect();
    nodo = document.createElement('div');
    nodo.className = 'capa';
    document.body.appendChild(nodo);
    abierto = { boton, items };
    const ancho = 232, x = Math.max(12, Math.min(window.innerWidth - ancho - 12, r.left + r.width / 2 - ancho / 2));
    render(
      <>
        <div class="bg-velo" onPointerDown={(e) => { e.preventDefault(); cerrar(); }} />
        <div class="bg-menu" role="menu" aria-label={`Atajos de ${boton.textContent.trim().split(' ')[0]}`} style={{ left: `${x}px`, bottom: `${Math.round(window.innerHeight - cont.top + 10)}px`, width: `${ancho}px` }}>
          {items.map((a, k) => <button key={k} type="button" role="menuitem" class="bg-item" data-k={k} onClick={() => elegir(a)}><Icono n={a.icono || ICONO_SUB} />{a.texto}</button>)}
        </div>
      </>, nodo,
    );
    const m = nodo.querySelector('.bg-menu');
    if (m?.animate && !sinMovimiento()) { try { m.animate([{ transform: 'scale(.9) translateY(8px)' }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2, .9, .3, 1.15)' }); } catch { /* */ } }
    document.addEventListener('keydown', tecla, true);
    if (foco) nodo.querySelector('.bg-item')?.focus();
    return true;
  };
  const sobre = (x, y) => {
    if (!nodo) return null;
    const el = document.elementFromPoint(x, y)?.closest?.('.bg-item');
    for (const b of nodo.querySelectorAll('.bg-item')) { if (b === el) b.dataset.sobre = ''; else delete b.dataset.sobre; }
    return el || null;
  };

  // ---- la píldora, con el dedo
  const pildora = (cont) => cont.querySelector('.tabs-pildora');
  const aIcono = (cont, b) => {
    const p = pildora(cont), ico = b?.querySelector('.tab-ico');
    if (!p || !ico) return;
    const a = ico.getBoundingClientRect(), c = cont.getBoundingClientRect();
    p.style.transform = `translate(${Math.round(a.left - c.left)}px, ${Math.round(a.top - c.top)}px)`;
  };

  const baja = (e) => {
    const cont = barraDe(e.target), boton = e.target.closest?.('button.tab');
    if (!cont || !boton || e.button > 0 || g) return;
    const o = leer();
    // (lo último que se abrió desde «Más»: se apunta al tocar la barra estando en ello)
    if (o.mas.some(([t]) => t === o.tab)) guardarUltimo(o.tab);
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, cont, boton, modo: null, encima: null, item: null };
    g.t = setTimeout(() => { if (g && !g.modo && abrir(g.boton)) { g.modo = 'menu'; vibrar('hecho', { sonido: false }); } }, LARGO_MS);
  };
  const mueve = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (g.modo === 'menu') { const it = sobre(e.clientX, e.clientY); if (it !== g.item) { g.item = it; if (it) vibrar('toque'); } return; }
    if (!g.modo) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      clearTimeout(g.t);
      g.modo = 'desliza';
      try { g.cont.setPointerCapture(e.pointerId); } catch { /* */ }
      const p = pildora(g.cont);
      if (p) { g.trans = p.style.transition; p.style.transition = 'none'; }
      g.encima = g.cont.querySelector('.tab[aria-current="page"]');
    }
    const p = pildora(g.cont), c = g.cont.getBoundingClientRect();
    const b = cercana(g.cont, e.clientX);
    if (p && b) {
      const ico = b.querySelector('.tab-ico').getBoundingClientRect(), w = p.getBoundingClientRect().width;
      const x = Math.max(4, Math.min(c.width - w - 4, e.clientX - c.left - w / 2));
      p.style.transform = `translate(${x.toFixed(1)}px, ${Math.round(ico.top - c.top)}px)`;
    }
    if (b && b !== g.encima) {
      if (g.encima) delete g.encima.dataset.sobre;
      g.encima = b; b.dataset.sobre = '';
      vibrar('toque');
    }
  };
  const sube = (e) => {
    if (!g || e.pointerId !== g.id) return;
    clearTimeout(g.t);
    const s = g; g = null;
    if (!s.modo) return;   // un toque normal
    sinClic = e.timeStamp;
    if (s.modo === 'menu') {
      const a = s.item && abierto ? abierto.items[Number(s.item.dataset.k)] : null;
      for (const b of nodo?.querySelectorAll('.bg-item') || []) delete b.dataset.sobre;
      if (a && e.type !== 'pointercancel') elegir(a);
      return;
    }
    const p = pildora(s.cont);
    if (p) p.style.transition = s.trans || '';
    for (const b of s.cont.querySelectorAll('[data-sobre]')) delete b.dataset.sobre;
    const actual = s.cont.querySelector('.tab[aria-current="page"]');
    const destino = e.type === 'pointercancel' ? null : s.encima;
    if (destino && destino !== actual) { aIcono(s.cont, destino); vibrar('elegir'); destino.click(); }
    else if (actual) aIcono(s.cont, actual);
  };
  // (el clic que llega al soltar tras un gesto no cuenta; los de código, sí)
  const clic = (e) => { if (e.isTrusted && e.timeStamp - sinClic < 160 && (barraDe(e.target) || e.target.closest?.('.tabs-flota'))) { e.stopPropagation(); e.preventDefault(); } };
  // (el menú del sistema al mantener pulsado, o la tecla de menú: sus atajos)
  const contexto = (e) => {
    const boton = barraDe(e.target) && e.target.closest?.('button.tab');
    if (!boton) return;
    e.preventDefault();
    if (!abierto && g?.modo !== 'menu') { clearTimeout(g?.t); if (abrir(boton, { foco: !g }) && g) g.modo = 'menu'; }
  };
  document.addEventListener('pointerdown', baja); document.addEventListener('pointermove', mueve); document.addEventListener('pointerup', sube); document.addEventListener('pointercancel', sube);
  document.addEventListener('click', clic, true); document.addEventListener('contextmenu', contexto);
  return () => {
    clearTimeout(g?.t); g = null; cerrar();
    document.removeEventListener('pointerdown', baja); document.removeEventListener('pointermove', mueve); document.removeEventListener('pointerup', sube); document.removeEventListener('pointercancel', sube);
    document.removeEventListener('click', clic, true); document.removeEventListener('contextmenu', contexto);
  };
}
