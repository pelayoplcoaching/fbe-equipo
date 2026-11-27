// (tacto 221-223, v0.272) Asomarse. Mantener el dedo sobre una sesión (en Semana y en «Tus entrenamientos»), un
// ejercicio de una lista, una receta o una medalla la asoma en una tarjeta flotante: sus ejercicios y cómo fue, su
// última vez y su mejor marca, su foto y sus macros, lo que falta para la siguiente. Soltar la cierra; subir el dedo
// la abre (si se puede abrir). Solo con el dedo o el lápiz: con ratón, teclado o lector de pantalla se entra como
// siempre, que es donde está todo. Va aparte: llega cuando la app ya está abierta (AtletaApp lo pide) y escucha en el
// documento lo que lleve la marca data-asoma: «sesion:<id>», «ejercicio:<id>», «rotulo» (lo que dice su aria-label) o
// «suyo» (el propio elemento trae su tarjeta en __asoma()).
import { render } from 'preact';
import { vibrar } from '../hapticos.js';
import { sinMovimiento } from '../transiciones.js';
import { ASOMA_MS, ASOMA_QUIETO, ASOMA_ABRE, asomaSesion, asomaEjercicio, asomaRotulo, sitioAsoma } from '../../logica/asomar.js';

function Tarjeta({ d, cargando, abre, sePuedeAbrir }) {
  return (
    <div class="aso-tarjeta" data-abre={abre ? '' : undefined}>
      {d.foto && <img class="aso-foto" src={d.foto} alt="" />}
      <strong class="aso-t">{d.titulo}</strong>
      {d.sub && <span class="aso-sub">{d.sub}</span>}
      {cargando && <span class="aso-sub">Cargando…</span>}
      {d.lineas?.length > 0 && (
        <ul class="aso-lineas">
          {d.lineas.map(([a, b], k) => <li key={k}><span class="aso-a">{a}</span>{b && <span class="aso-b num">{b}</span>}</li>)}
          {d.mas > 0 && <li><span class="aso-a aso-mas">y {d.mas} más</span></li>}
        </ul>
      )}
      {d.pie && <span class="aso-pie">{d.pie}</span>}
      <span class="aso-pista">{abre ? 'Suelta para abrir' : sePuedeAbrir ? 'Suelta para cerrar · sube el dedo para abrir' : 'Suelta para cerrar'}</span>
    </div>
  );
}

// leer(): { api, atleta }. Devuelve cómo quitarlo
export function instalarAsomar(leer) {
  let g = null, nodo = null, sinClic = -1e9;
  const pintar = () => {
    if (!nodo || !g?.d) return;
    render(<><div class="aso-velo" /><Tarjeta d={g.d} cargando={g.cargando} abre={g.abre} sePuedeAbrir={g.boton} /></>, nodo);
    const t = nodo.querySelector('.aso-tarjeta');
    if (!t) return;
    const s = sitioAsoma(g.el.getBoundingClientRect(), t.offsetHeight, { vw: window.innerWidth, vh: window.innerHeight });
    t.style.left = `${s.x}px`; t.style.top = `${s.y}px`; t.style.width = `${s.w}px`;
    t.style.transformOrigin = s.arriba ? '50% 100%' : '50% 0';
    g.tarjeta = t;
  };
  const datos = (el) => {
    const [tipo, id] = String(el.dataset.asoma || '').split(':');
    const { api, atleta } = leer();
    // (su nombre: el que trae la marca o el que se lee en la fila, sin la etiqueta de superserie ni las pastillas; aquí no
    // se nombran clases de otras pantallas: sus estilos dejarían de viajar con su trozo)
    const n = el.querySelector('.nombre');
    const nombre = (el.dataset.asomaT || (n ? [...n.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('') : '')).trim();
    if (tipo === 'suyo') return { ya: el.__asoma?.() || null };
    if (tipo === 'rotulo') return { ya: asomaRotulo(el.getAttribute('aria-label')) };
    if (tipo === 'sesion' && id) return { ya: { titulo: nombre || 'Sesión', lineas: [] }, luego: api.sesion(id, atleta.id).then(asomaSesion) };
    if (tipo === 'ejercicio' && id) return { ya: { titulo: nombre || 'Ejercicio', lineas: [] }, luego: api.historialEjercicio(atleta.id, id).then((h) => asomaEjercicio(nombre || 'Ejercicio', h.series)) };
    return { ya: null };
  };
  const abrir = () => {
    if (!g || nodo) return;
    const { ya, luego } = datos(g.el);
    if (!ya) { g = null; return; }
    g.d = ya; g.cargando = !!luego; g.abierta = true;
    g.boton = g.el.matches('button, a, [role="button"]');
    nodo = document.createElement('div');
    nodo.className = 'capa aso-capa';
    nodo.setAttribute('aria-hidden', 'true');
    document.body.appendChild(nodo);
    pintar();
    vibrar('hecho', { sonido: false });
    if (g.tarjeta?.animate && !sinMovimiento()) { try { g.tarjeta.animate([{ transform: 'scale(.86)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 180, easing: 'cubic-bezier(.2, .9, .3, 1.1)' }); } catch { /* */ } }
    const mio = g;
    luego?.then((d) => { if (g === mio && d) { g.d = d; g.cargando = false; pintar(); } }, () => { if (g === mio) { g.cargando = false; pintar(); } });
  };
  const cerrar = () => { if (nodo) { render(null, nodo); nodo.remove(); nodo = null; } };
  const soltar = (el) => { clearTimeout(g?.t); el?.removeEventListener('touchmove', frena); if (el) { el.style.webkitTouchCallout = ''; el.style.webkitUserSelect = ''; el.style.userSelect = ''; } };
  // Con la tarjeta fuera, el dedo ya no desplaza la página (se decide en el primer movimiento tras asomarla)
  function frena(e) { if (g?.abierta && e.cancelable) e.preventDefault(); }

  const baja = (e) => {
    if (g || e.button > 0 || e.pointerType === 'mouse') return;
    const el = e.target.closest?.('[data-asoma]');
    if (!el || el.disabled) return;
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, el, abre: false, abierta: false };
    // (sin el menú ni la selección del sistema al mantener pulsado)
    el.style.webkitTouchCallout = 'none'; el.style.webkitUserSelect = 'none'; el.style.userSelect = 'none';
    el.addEventListener('touchmove', frena, { passive: false });
    g.t = setTimeout(abrir, ASOMA_MS);
  };
  const mueve = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.abierta) { if (Math.hypot(dx, dy) > ASOMA_QUIETO) { soltar(g.el); g = null; } return; }
    const abre = g.boton && -dy > ASOMA_ABRE;
    if (g.tarjeta && !sinMovimiento()) g.tarjeta.style.transform = `translateY(${Math.round(Math.max(-28, Math.min(0, dy * 0.3)))}px)`;
    if (abre !== g.abre) { g.abre = abre; vibrar('toque'); pintar(); }
  };
  const sube = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const s = g;
    soltar(s.el); g = null;
    if (!s.abierta) return;   // un toque normal
    sinClic = e.timeStamp;
    cerrar();
    if (s.abre && e.type !== 'pointercancel') { vibrar('elegir'); s.el.click(); }
  };
  // (el clic que llega al soltar no cuenta; los de código, sí) y sin menú del sistema sobre lo que se asoma
  const clic = (e) => { if (e.isTrusted && e.timeStamp - sinClic < 80) { e.stopPropagation(); e.preventDefault(); } };
  const contexto = (e) => { if (g || e.target.closest?.('[data-asoma]')) e.preventDefault(); };
  const fuera = () => { if (g) { soltar(g.el); g = null; } cerrar(); };
  document.addEventListener('pointerdown', baja); document.addEventListener('pointermove', mueve); document.addEventListener('pointerup', sube); document.addEventListener('pointercancel', sube);
  document.addEventListener('click', clic, true); document.addEventListener('contextmenu', contexto); window.addEventListener('blur', fuera);
  return () => {
    fuera();
    document.removeEventListener('pointerdown', baja); document.removeEventListener('pointermove', mueve); document.removeEventListener('pointerup', sube); document.removeEventListener('pointercancel', sube);
    document.removeEventListener('click', clic, true); document.removeEventListener('contextmenu', contexto); window.removeEventListener('blur', fuera);
  };
}
