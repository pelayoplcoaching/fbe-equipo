// (tacto 237-241, v0.272) Recetas con las manos. Los ingredientes se tachan al tocarlos (lo que ya tienes en casa; se
// recuerda ese día, en este móvil) y sus cantidades ruedan al cambiar las raciones. Los tiempos de los pasos se tocan:
// «10 minutos» arranca su temporizador, que sigue en una pastilla mientras cocinas (uno a la vez; suena y vibra al
// acabar). Guardar una receta hace saltar la estrella con tres chispas, y dos toques en la foto también la guardan. Y el
// modo cocina: los pasos a pantalla completa y con letra grande, uno por pantalla; se pasan deslizando (o con sus
// botones) y la pantalla no se apaga.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Capa, Icono, Odometro, useApp, useAtraparFoco } from './comunes.jsx';
import { vibrar } from './hapticos.js';
import { contexto, sonarFBE } from './sonido.js';
import { sinMovimiento } from './transiciones.js';
import { soloBotones } from './ajustes.js';
import { hoyISO } from '../logica/fechas.js';
import { cifraIngrediente, trozosDePaso, textoReloj, textoDuracion, tengoDe, tengoCon, quedaDe } from '../logica/cocina.js';
import { decidirGesto, destinoLado } from '../logica/historia-gesto.js';

// ---------------------------------------------------------------- el temporizador de un paso
// Uno a la vez, y de toda la app mientras siga abierta: si se cierra la receta, sigue contando y avisa igual
let reloj = null, tic = null;
const oyentes = new Set();
const pintar = () => { for (const f of oyentes) f(); };
const parar = () => { reloj = null; clearInterval(tic); tic = null; pintar(); };
function arrancar({ receta, nombre, texto, seg, aviso }) {
  contexto();
  reloj = { receta, nombre, texto, total: seg, fin: Date.now() + seg * 1000, hecho: false, acabo: 0 };
  clearInterval(tic);
  tic = setInterval(() => {
    if (!reloj) return;
    if (!reloj.hecho && Date.now() >= reloj.fin) {
      reloj.hecho = true; reloj.acabo = Date.now();
      vibrar('checkin', { sonido: false }); sonarFBE('fin-descanso');
      aviso?.(`Listo: ${reloj.texto}${reloj.nombre ? ` de «${reloj.nombre}»` : ''}`);
    }
    // (un minuto después de acabar, se quita solo)
    if (reloj.hecho && Date.now() - reloj.acabo > 60000) { parar(); return; }
    pintar();
  }, 500);
  vibrar('elegir');
  pintar();
}
export function useRelojCocina() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((x) => x + 1); oyentes.add(f); return () => { oyentes.delete(f); }; }, []);
  return reloj;
}

// (239) Un paso, con sus tiempos como botones: al tocar uno, arranca su temporizador
export function PasoConTiempos({ texto, receta, nombre }) {
  const { aviso } = useApp();
  const r = useRelojCocina();
  const trozos = trozosDePaso(texto);
  // (la coma o el punto que sigue a un tiempo va pegado a él: que no empiece la línea siguiente)
  const signo = (k) => (trozos[k + 1] && !trozos[k + 1].seg ? /^[,.;:)]+/.exec(trozos[k + 1].t)?.[0] || '' : '');
  return (
    <>{trozos.map((x, k) => (x.seg
      ? <span key={k} class="coc-junto"><button type="button" class="coc-tiempo" aria-pressed={r && !r.hecho && r.receta === receta && r.texto === x.t ? 'true' : 'false'}
          aria-label={`${x.t}: poner un temporizador de ${textoDuracion(x.seg)}`} onClick={() => arrancar({ receta, nombre, texto: x.t, seg: x.seg, aviso })}><Icono n="reloj" />{x.t}</button>{signo(k)}</span>
      : (k > 0 && trozos[k - 1].seg ? x.t.slice(signo(k - 1).length) : x.t)))}</>
  );
}

// La pastilla del temporizador: lo que queda, un minuto más y quitarlo
export function PastillaCocina() {
  const r = useRelojCocina();
  if (!r) return null;
  const q = quedaDe(r, Date.now());
  return (
    <div class={`coc-pastilla${r.hecho ? ' coc-lista' : ''}`} role="timer" aria-live="off" aria-label={r.hecho ? `Temporizador terminado: ${r.texto}` : `Temporizador de ${r.texto}: quedan ${textoDuracion(Math.ceil(q))}`}>
      <Icono n="reloj" />
      <span class="coc-pastilla-t"><strong class="coc-pastilla-n num">{r.hecho ? '¡Listo!' : textoReloj(q)}</strong><span class="coc-pastilla-de">{r.texto}</span></span>
      {!r.hecho && <button type="button" class="coc-pastilla-b" onClick={() => { reloj.fin += 60000; reloj.total += 60; vibrar('elegir'); pintar(); }} aria-label="Un minuto más">+1 min</button>}
      <button type="button" class="coc-pastilla-b" onClick={parar} aria-label={r.hecho ? 'Quitar el aviso' : 'Parar el temporizador'}><Icono n="cerrar" /></button>
    </div>
  );
}

// ---------------------------------------------------------------- los ingredientes
const CLAVE = 'fbe-receta-tengo';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { return {}; } };
const guardar = (g) => { try { localStorage.setItem(CLAVE, JSON.stringify(g)); } catch { /* sin almacenamiento: vale para esta visita */ } };

// (237 y 241) lineas: [{ texto, medida }] (logica/recetario-equipo.js). Cada uno es una casilla: marcada, «ya lo tengo»
export function Ingredientes({ receta, lineas }) {
  const hoy = hoyISO();
  const [tengo, setTengo] = useState(() => tengoDe(leer(), receta, hoy));
  const marcar = (k, si) => { const g = tengoCon(leer(), receta, hoy, k, si); guardar(g); setTengo(tengoDe(g, receta, hoy)); };
  return (
    <ul class="ingredientes coc-ingredientes" aria-label="Ingredientes: marca los que ya tienes">
      {lineas.map((x, k) => {
        const c = cifraIngrediente(x.texto);
        const si = tengo.includes(k);
        return (
          <li key={k}>
            <label class="coc-ing">
              <input type="checkbox" class="coc-casilla" checked={si} onChange={(e) => marcar(k, e.currentTarget.checked)} />
              <span class="coc-marca" aria-hidden="true"><Icono n="hecho" /></span>
              <span class="coc-ing-t">{c.cifra != null && <Odometro texto={c.cifra} />}{c.resto}{x.medida && <span class="terciario"> ({x.medida})</span>}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- guardar con cariño
// (240) La estrella del botón salta y suelta tres chispas (una vez, al guardar)
export function estrellaSalta(boton) {
  const e = boton?.querySelector?.('svg');
  if (!e || sinMovimiento() || !e.animate) return;
  try {
    e.animate([{ transform: 'none' }, { transform: 'scale(1.7) rotate(-14deg)' }, { transform: 'scale(.88)' }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2, .9, .3, 1.2)' });
    const r = e.getBoundingClientRect(), b = boton.getBoundingClientRect();
    for (let k = 0; k < 3; k++) {
      const s = document.createElement('i');
      s.className = 'coc-chispa';
      s.style.left = `${r.left - b.left + r.width / 2}px`; s.style.top = `${r.top - b.top + r.height / 2}px`;
      boton.appendChild(s);
      const ang = ((-90 + (k - 1) * 55) * Math.PI) / 180;
      const a = s.animate([{ transform: 'translate(-50%, -50%) scale(1)' }, { transform: `translate(calc(-50% + ${(Math.cos(ang) * 30).toFixed(1)}px), calc(-50% + ${(Math.sin(ang) * 30).toFixed(1)}px)) scale(0)` }], { duration: 520, easing: 'cubic-bezier(.2, .8, .3, 1)' });
      a.onfinish = () => s.remove();
    }
  } catch { /* sin animaciones: se guarda igual */ }
}

// La foto de la receta: dos toques seguidos la guardan (como el botón), con una estrella grande que sale y se va
export function FotoGuardable({ puede, alGuardar, children }) {
  const ultimo = useRef(0);
  const caja = useRef(null);
  const toque = (e) => {
    if (!puede) return;
    const t = e.timeStamp;
    if (t - ultimo.current > 340) { ultimo.current = t; return; }
    ultimo.current = 0;
    alGuardar();
    const el = caja.current?.querySelector('.coc-estrella');
    if (el && !sinMovimiento() && el.animate) {
      try { el.animate([{ transform: 'translate(-50%, -50%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1.15)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%, -50%) scale(1.3)', opacity: 0 }], { duration: 820, easing: 'ease-out' }); } catch { /* */ }
    }
  };
  return <div ref={caja} class="coc-foto" onClick={toque}>{children}{puede && <span class="coc-estrella" aria-hidden="true"><Icono n="estrella" /></span>}</div>;
}

// ---------------------------------------------------------------- el modo cocina
export function ModoCocina(props) { return <Capa><CocinaDentro {...props} /></Capa>; }

function CocinaDentro({ receta, nombre, pasos, lineas = [], alCerrar }) {
  const n = pasos.length;
  const [i, setI] = useState(0);
  const [verIng, setVerIng] = useState(false);
  const raiz = useRef(null), paso = useRef(null);
  useAtraparFoco(raiz);
  const llega = useRef(0);
  const ir = (d) => { const j = Math.max(0, Math.min(n - 1, i + d)); if (j === i) return; llega.current = d; setI(j); vibrar('elegir'); };
  const vivo = useRef(null);
  vivo.current = { i, ir };
  // La pantalla no se apaga mientras se cocina (si el móvil sabe)
  useEffect(() => {
    let candado = null, sigue = true;
    const pedir = async () => { try { if (sigue && document.visibilityState === 'visible') candado = await navigator.wakeLock?.request('screen'); } catch { /* no disponible */ } };
    pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => { sigue = false; document.removeEventListener('visibilitychange', pedir); try { candado?.release(); } catch { /* */ } };
  }, []);
  // El foco entra y vuelve; Escape lo cierra (solo a él) y las flechas pasan de paso
  useEffect(() => {
    const antes = document.activeElement;
    raiz.current?.focus({ preventScroll: true });
    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); alCerrar(); }
      else if (e.key === 'ArrowRight') vivo.current.ir(1);
      else if (e.key === 'ArrowLeft') vivo.current.ir(-1);
    };
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('keydown', tecla, true); try { if (antes?.isConnected) antes.focus({ preventScroll: true }); } catch { /* */ } };
  }, []);
  // El paso que llega entra desde su lado
  useEffect(() => {
    const d = llega.current; llega.current = 0;
    const el = paso.current;
    if (!d || !el || sinMovimiento() || !el.animate) return;
    try { el.animate([{ transform: `translateX(${d * 64}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2, .9, .3, 1.1)' }); } catch { /* */ }
  }, [i]);
  // Deslizar de lado: el paso sigue al dedo (de arriba abajo, un paso largo se desplaza como siempre)
  const g = useRef(null);
  const baja = (e) => { if (e.button > 0 || soloBotones() || e.target.closest?.('button, a, input')) return; g.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lado: false, ux: e.clientX, ut: e.timeStamp, vx: 0 }; };
  const mueve = (e) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    s.vx = (e.clientX - s.ux) / Math.max(1, e.timeStamp - s.ut); s.ux = e.clientX; s.ut = e.timeStamp;
    if (!s.lado) { if (decidirGesto(dx, dy) !== 'lado') return; s.lado = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } }
    const tope = (dx > 0 && i === 0) || (dx < 0 && i === n - 1);
    if (paso.current) paso.current.style.transform = `translateX(${(tope ? dx * 0.28 : dx).toFixed(1)}px)`;
  };
  const sube = (e) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    g.current = null;
    if (!s.lado) return;
    const el = paso.current, desde = el?.style.transform || 'none';
    if (el) el.style.transform = '';
    const d = e.type === 'pointercancel' ? 0 : destinoLado(e.clientX - s.x, s.vx, { i, n });
    if (d === 1 || d === -1) { ir(d); return; }
    if (el && !sinMovimiento() && el.animate) { try { el.animate([{ transform: desde }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2, .9, .3, 1.1)' }); } catch { /* */ } }
  };
  return (
    <div ref={raiz} class="coc-raiz" role="dialog" aria-modal="true" aria-label={`Modo cocina: ${nombre}`} tabIndex={-1} data-sin-deslizar="">
      <div class="coc-cab">
        <span class="coc-cab-t"><strong class="coc-nombre">{nombre}</strong><span class="coc-de num">{verIng ? 'Ingredientes' : `Paso ${i + 1} de ${n}`}</span></span>
        <button type="button" class="coc-icono" aria-pressed={verIng ? 'true' : 'false'} onClick={() => setVerIng(!verIng)} aria-label="Ver los ingredientes"><Icono n="receta" /></button>
        <button type="button" class="coc-icono" onClick={alCerrar} aria-label="Salir del modo cocina"><Icono n="cerrar" /></button>
      </div>
      <div class="coc-barras" aria-hidden="true">{pasos.map((_, k) => <i key={k} class={`coc-b${k < i ? ' coc-hecho' : k === i ? ' coc-ahora' : ''}`} />)}</div>
      {verIng
        ? <div class="coc-cuerpo coc-cuerpo-ing" tabIndex={0} role="group" aria-label="Ingredientes"><Ingredientes receta={receta} lineas={lineas} /></div>
        : (
          <div class="coc-cuerpo" tabIndex={0} role="group" aria-label={`Paso ${i + 1} de ${n}`} onPointerDown={baja} onPointerMove={mueve} onPointerUp={sube} onPointerCancel={sube}>
            <p key={i} ref={paso} class="coc-paso" aria-live="polite"><PasoConTiempos texto={pasos[i]} receta={receta} nombre={nombre} /></p>
          </div>
        )}
      <PastillaCocina />
      <div class="coc-pie">
        <button type="button" class="btn btn-grande" disabled={verIng || i === 0} onClick={() => ir(-1)}><Icono n="atras" /> Anterior</button>
        {verIng ? <button type="button" class="btn btn-primario btn-grande" onClick={() => setVerIng(false)}>Volver al paso {i + 1}</button>
          : i < n - 1 ? <button type="button" class="btn btn-primario btn-grande" onClick={() => ir(1)}>Siguiente <Icono n="derecha" /></button>
            : <button type="button" class="btn btn-primario btn-grande" onClick={alCerrar}><Icono n="hecho" /> Hecho</button>}
      </div>
    </div>
  );
}
