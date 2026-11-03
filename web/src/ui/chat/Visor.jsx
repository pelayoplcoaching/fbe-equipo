import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Capa, Icono, useApp, useAtraparFoco } from '../comunes.jsx';
import { TextoChat } from '../Enlaces.jsx';
import { sinMovimiento } from '../transiciones.js';
import { cuandoInfo, esMarcador } from '../../logica/mensajes.js';

// El visor de fotos y vídeos del chat a pantalla completa (v0.55), como WhatsApp: se pasa de uno a otro deslizando a
// los lados (todos los del chat, en orden), las fotos se amplían pellizcando o con dos toques (y se mueven ampliadas),
// y deslizar hacia abajo lo cierra mientras el fondo se desvanece. Arriba, quién y cuándo; abajo, el pie (el texto del
// mensaje) y Responder, Reenviar (el coach), Guardar y Compartir. Con el teclado: ← y → para pasar y Escape para cerrar;
// el foco se queda dentro. Todo con transform (por el compositor) y, con «reducir movimiento», sin animaciones.
// medios: [{ mensaje, archivo }] (de lo más antiguo a lo más reciente); inicio: el que se abre.
const ZOOM_MAX = 4;
const ZOOM_DOBLE = 2.5;

export function Visor(props) { return <Capa><VisorDentro {...props} /></Capa>; }

function VisorDentro({ medios, inicio = 0, nombreDe, alCerrar, alResponder, alReenviar = null, puedeReenviar = () => false }) {
  const { api, aviso } = useApp();
  const [i, setI] = useState(Math.max(0, Math.min(inicio, medios.length - 1)));
  const [urls, setUrls] = useState({});
  const ref = useRef(null);
  const escena = useRef(null);
  const pista = useRef(null);
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;
  useAtraparFoco(ref);
  const m = medios[i];
  const esFoto = (a) => /^image\//.test(a?.mime || '') || a?.tipo === 'foto_progreso';

  // Al abrir: el foco dentro, la página quieta detrás y Escape/flechas; al cerrar, el foco vuelve a donde estaba
  useLayoutEffect(() => {
    const previo = document.activeElement;
    ref.current?.querySelector('.visor-cerrar')?.focus({ preventScroll: true });
    const cuerpo = document.body;
    cuerpo.dataset.hojas = String(Number(cuerpo.dataset.hojas || 0) + 1);
    cuerpo.style.overflow = 'hidden';
    return () => {
      const quedan = Math.max(0, Number(cuerpo.dataset.hojas || 1) - 1);
      if (quedan) cuerpo.dataset.hojas = String(quedan); else { delete cuerpo.dataset.hojas; cuerpo.style.overflow = ''; }
      previo?.focus?.({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const tecla = (e) => {
      const modales = document.querySelectorAll('[aria-modal="true"]');
      if (modales.length && modales[modales.length - 1] !== ref.current) return;
      if (e.key === 'Escape') { e.preventDefault(); cerrarRef.current?.(); }
      else if (e.key === 'ArrowRight' && !e.target.closest?.('video')) { e.preventDefault(); ir(1); }
      else if (e.key === 'ArrowLeft' && !e.target.closest?.('video')) { e.preventDefault(); ir(-1); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  // Los enlaces firmados del actual y de sus vecinos (para que pasar sea al momento)
  useEffect(() => {
    let vivo = true;
    for (const k of [i, i - 1, i + 1]) {
      const a = medios[k]?.archivo;
      if (!a) continue;
      for (const ruta of [a.ruta, a.poster_ruta].filter(Boolean)) {
        if (urls[ruta]) continue;
        api.urlArchivo(ruta).then((u) => vivo && setUrls((x) => ({ ...x, [ruta]: u }))).catch(() => vivo && setUrls((x) => ({ ...x, [ruta]: 'fallo' })));
      }
    }
    return () => { vivo = false; };
  }, [i]);

  // ---------------------------------------------------------------- gestos (solo transform; sin estado mientras se mueve)
  const z = useRef({ s: 1, x: 0, y: 0 });
  const g = useRef(null);
  const punteros = useRef(new Map());
  const ultimoToque = useRef({ t: 0, x: 0, y: 0 });
  const medioActual = () => escena.current?.querySelector('.visor-diapo.actual .visor-medio');
  const aplicarZoom = (anim = false) => {
    const el = medioActual();
    if (!el) return;
    el.style.transition = anim && !sinMovimiento() ? 'transform .22s cubic-bezier(.2,.8,.2,1)' : 'none';
    el.style.transform = z.current.s === 1 ? '' : `translate3d(${z.current.x}px, ${z.current.y}px, 0) scale(${z.current.s})`;
  };
  const moverPista = (dx, anim = false) => {
    if (!pista.current) return;
    pista.current.style.transition = anim && !sinMovimiento() ? 'transform .24s cubic-bezier(.2,.8,.2,1)' : 'none';
    pista.current.style.transform = dx ? `translate3d(${dx}px, 0, 0)` : '';
  };
  const bajar = (dy, anim = false) => {
    const el = escena.current?.querySelector('.visor-diapo.actual');
    if (el) {
      el.style.transition = anim && !sinMovimiento() ? 'transform .22s ease-out' : 'none';
      el.style.transform = dy ? `translate3d(0, ${dy}px, 0) scale(${Math.max(0.85, 1 - dy / 1400)})` : '';
    }
    ref.current?.style.setProperty('--velo', String(Math.max(0, 1 - Math.max(0, dy) / 420)));
  };
  const reiniciar = () => { z.current = { s: 1, x: 0, y: 0 }; aplicarZoom(); };
  function ir(paso) {
    const j = i + paso;
    if (j < 0 || j >= medios.length) { moverPista(0, true); return; }
    // El vídeo que se deja, en pausa
    escena.current?.querySelectorAll('video').forEach((v) => { try { v.pause(); } catch { /* */ } });
    reiniciar();
    const ancho = escena.current?.clientWidth || window.innerWidth;
    if (sinMovimiento() || !pista.current) { moverPista(0); setI(j); return; }
    moverPista(-paso * ancho, true);
    setTimeout(() => { moverPista(0); setI(j); }, 230);
  }
  const limitar = () => {
    const el = medioActual();
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight, s = z.current.s;
    const mx = (w * (s - 1)) / 2, my = (h * (s - 1)) / 2;
    z.current.x = Math.max(-mx, Math.min(mx, z.current.x));
    z.current.y = Math.max(-my, Math.min(my, z.current.y));
  };
  const alBajar = (e) => {
    if (e.button > 0 || e.target.closest('button, a, .visor-pie')) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
    const ps = [...punteros.current.values()];
    if (ps.length === 2 && esFoto(m?.archivo)) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      g.current = { modo: 'pellizco', d0: d || 1, s0: z.current.s, x0: z.current.x, y0: z.current.y };
      return;
    }
    if (ps.length > 1) return;
    g.current = { modo: null, x0: e.clientX, y0: e.clientY, t0: performance.now(), zx: z.current.x, zy: z.current.y, dx: 0, dy: 0 };
  };
  const alMover = (e) => {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const a = g.current;
    if (!a) return;
    if (a.modo === 'pellizco') {
      const ps = [...punteros.current.values()];
      if (ps.length < 2) return;
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      z.current.s = Math.max(1, Math.min(ZOOM_MAX, a.s0 * (d / a.d0)));
      limitar();
      aplicarZoom();
      return;
    }
    const dx = e.clientX - a.x0, dy = e.clientY - a.y0;
    a.dx = dx; a.dy = dy;
    if (z.current.s > 1) {
      // Ampliada: se mueve con el dedo
      z.current.x = a.zx + dx; z.current.y = a.zy + dy;
      limitar();
      aplicarZoom();
      return;
    }
    if (!a.modo && Math.hypot(dx, dy) > 10) a.modo = Math.abs(dx) > Math.abs(dy) ? 'lado' : dy > 0 ? 'abajo' : 'nada';
    if (a.modo === 'lado') {
      const fuera = (dx > 0 && i === 0) || (dx < 0 && i === medios.length - 1);
      moverPista(fuera ? dx / 3 : dx);
    } else if (a.modo === 'abajo') bajar(Math.max(0, dy));
  };
  const alSoltar = (e) => {
    punteros.current.delete(e.pointerId);
    const a = g.current;
    if (!a) return;
    if (a.modo === 'pellizco') {
      if (punteros.current.size) return;
      g.current = null;
      if (z.current.s < 1.05) { z.current = { s: 1, x: 0, y: 0 }; aplicarZoom(true); }
      return;
    }
    g.current = null;
    const t = performance.now() - a.t0;
    if (a.modo === 'lado') {
      const rapido = Math.abs(a.dx) / Math.max(1, t) > 0.5;
      if (a.dx < -60 || (rapido && a.dx < -20)) ir(1); else if (a.dx > 60 || (rapido && a.dx > 20)) ir(-1); else moverPista(0, true);
      return;
    }
    if (a.modo === 'abajo') {
      if (a.dy > 110 || (a.dy > 40 && a.dy / Math.max(1, t) > 0.6)) { cerrarRef.current?.(); return; }
      bajar(0, true);
      return;
    }
    // Un toque: dos seguidos amplían (en ese punto) o vuelven al tamaño normal
    if (!a.modo && Math.hypot(a.dx, a.dy) < 10 && esFoto(m?.archivo)) {
      const ahora = performance.now();
      const u = ultimoToque.current;
      if (ahora - u.t < 320 && Math.hypot(e.clientX - u.x, e.clientY - u.y) < 40) {
        ultimoToque.current = { t: 0, x: 0, y: 0 };
        if (z.current.s > 1) z.current = { s: 1, x: 0, y: 0 };
        else {
          const el = medioActual();
          const r = el?.getBoundingClientRect();
          const cx = r ? r.left + r.width / 2 : window.innerWidth / 2, cy = r ? r.top + r.height / 2 : window.innerHeight / 2;
          z.current = { s: ZOOM_DOBLE, x: (cx - e.clientX) * (ZOOM_DOBLE - 1), y: (cy - e.clientY) * (ZOOM_DOBLE - 1) };
          limitar();
        }
        aplicarZoom(true);
      } else ultimoToque.current = { t: ahora, x: e.clientX, y: e.clientY };
    }
  };
  const rueda = (e) => {
    if (!esFoto(m?.archivo) || !e.ctrlKey) return;
    e.preventDefault();
    z.current.s = Math.max(1, Math.min(ZOOM_MAX, z.current.s * (e.deltaY < 0 ? 1.1 : 0.9)));
    if (z.current.s === 1) { z.current.x = 0; z.current.y = 0; }
    limitar(); aplicarZoom();
  };

  if (!m) return null;
  const c = m.mensaje;
  const nombreArchivo = (a) => {
    const ext = (/\.([a-z0-9]{1,5})$/i.exec(a.ruta || '') || [])[1] || (esFoto(a) ? 'jpg' : 'mp4');
    const d = new Date(c.creado_en);
    return `FBE-${esFoto(a) ? 'foto' : 'video'}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.${ext.toLowerCase()}`;
  };
  async function guardar() {
    try {
      const u = await api.urlDescarga(m.archivo.ruta, nombreArchivo(m.archivo));
      const a = document.createElement('a');
      a.href = u; a.download = nombreArchivo(m.archivo); a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { aviso(e.message || 'No se ha podido guardar', 'error'); }
  }
  const puedeCompartir = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && typeof navigator.share === 'function';
  async function compartir() {
    try {
      const u = urls[m.archivo.ruta] && urls[m.archivo.ruta] !== 'fallo' ? urls[m.archivo.ruta] : await api.urlArchivo(m.archivo.ruta);
      const blob = await (await fetch(u)).blob();
      const f = new File([blob], nombreArchivo(m.archivo), { type: m.archivo.mime || blob.type });
      if (!navigator.canShare({ files: [f] })) { aviso('Este móvil no deja compartir este archivo: usa «Guardar»'); return; }
      await navigator.share({ files: [f] });
    } catch (e) { if (e?.name !== 'AbortError') aviso('No se ha podido compartir: usa «Guardar»', 'error'); }
  }
  const quien = nombreDe(c.autor);
  const tipo = esFoto(m.archivo) ? 'Foto' : 'Vídeo';
  const diapo = (k, clase) => {
    const x = medios[k];
    if (!x) return <div key={`v${k}`} class={`visor-diapo ${clase}`} aria-hidden="true" />;
    const a = x.archivo;
    const u = urls[a.ruta];
    const poster = a.poster_ruta && urls[a.poster_ruta] !== 'fallo' ? urls[a.poster_ruta] : undefined;
    return (
      <div key={`d${a.id}`} class={`visor-diapo ${clase}`} aria-hidden={clase === 'actual' ? undefined : 'true'}>
        {!u ? <span class="visor-cargando" role="status" aria-live="polite">{clase === 'actual' ? 'Cargando…' : ''}</span>
          : u === 'fallo' ? <span class="visor-fallo">No se pudo cargar</span>
          : esFoto(a) ? <img class="visor-medio" src={u} alt={x.mensaje && !esMarcador(x.mensaje) ? `Foto: ${x.mensaje.texto.slice(0, 120)}` : 'Foto'} draggable={false} />
          : <video class="visor-medio" src={clase === 'actual' ? u : undefined} poster={poster} controls playsInline preload="metadata" tabIndex={clase === 'actual' ? 0 : -1} />}
      </div>
    );
  };
  return (
    <div class="visor" role="dialog" aria-modal="true" aria-label={`${tipo} de ${quien === 'Tú' ? 'ti' : quien}`} ref={ref} tabIndex={-1}>
      <header class="visor-cab">
        <button type="button" class="btn btn-icono visor-cerrar" aria-label="Cerrar" onClick={() => cerrarRef.current?.()}><Icono n="atras" /></button>
        <div class="visor-quien"><strong>{quien}</strong><span class="mini">{cuandoInfo(c.creado_en)}</span></div>
        {medios.length > 1 && <span class="visor-n mini num" aria-label={`${i + 1} de ${medios.length}`}>{i + 1} / {medios.length}</span>}
      </header>
      <div class="visor-escena" ref={escena} onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar} onWheel={rueda}>
        <div class="visor-pista" ref={pista}>
          {diapo(i - 1, 'antes')}{diapo(i, 'actual')}{diapo(i + 1, 'despues')}
        </div>
        {i > 0 && <button type="button" class="btn btn-icono visor-paso visor-anterior" aria-label="Anterior" onClick={() => ir(-1)}><Icono n="atras" /></button>}
        {i < medios.length - 1 && <button type="button" class="btn btn-icono visor-paso visor-siguiente" aria-label="Siguiente" onClick={() => ir(1)}><Icono n="derecha" /></button>}
      </div>
      <footer class="visor-pie-zona">
        {!esMarcador(c) && c.texto && <div class="visor-pie"><TextoChat id={`visor-${c.id}`} texto={c.texto} clase="visor-pie-texto" conVista={false} /></div>}
        <div class="visor-acciones" role="group" aria-label="Acciones">
          <button type="button" class="visor-accion" onClick={() => { cerrarRef.current?.(); setTimeout(() => alResponder?.(c), 0); }}><Icono n="mensaje" /><span>Responder</span></button>
          {alReenviar && puedeReenviar(c) && <button type="button" class="visor-accion" onClick={() => { cerrarRef.current?.(); setTimeout(() => alReenviar(c), 0); }}><Icono n="reenviar" /><span>Reenviar</span></button>}
          <button type="button" class="visor-accion" onClick={guardar}><Icono n="descargar" /><span>Guardar</span></button>
          {puedeCompartir && <button type="button" class="visor-accion" onClick={compartir}><Icono n="compartir" /><span>Compartir</span></button>}
        </div>
      </footer>
    </div>
  );
}
