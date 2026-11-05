// v0.64 (4): «Cambiar el orden» de lo que queda de la sesión (solo hoy y en este móvil: la pauta de tu coach no cambia). Cada
// fila es un ejercicio suelto o una superserie entera (nunca se parte). Se mueve arrastrando el asa (con el dedo o el ratón)
// o con «Subir» / «Bajar» (con el teclado o el lector de pantalla): el cambio vale al momento y se anuncia («Remo con barra:
// ahora el 1.º de 4»). Lo ya hecho no sale (no se mueve).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Hoja, Icono } from '../comunes.jsx';
import { bloquesPendientes } from '../../logica/orden-sesion.js';

const quieto = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ejercicios, hechas: los de la sesión (en el orden de ahora); nombreDe(se): el que se hace (con la alternativa);
// reordenar(claves) → orden | null; subir(seId, ±1) → orden | null; alMover(orden): lo guarda
export function OrdenarSesion({ ejercicios, hechas, etiquetas = {}, nombreDe, reordenar, subir, alMover, alCerrar }) {
  const pend = bloquesPendientes(ejercicios, hechas);
  const porId = Object.fromEntries(ejercicios.map((e) => [e.id, e]));
  const nombreBloque = (b) => (b.letra ? `Superserie ${b.letra}: ${b.ids.map((x) => nombreDe(porId[x])).join(' y ')}` : nombreDe(porId[b.ids[0]]));
  const [anuncio, setAnuncio] = useState('');
  const lista = useRef(null);
  const [arr, setArr] = useState(null); // { clave, desde, y0, dy, hasta }
  const arrRef = useRef(null);
  arrRef.current = arr;
  const decir = (clave, claves) => {
    const b = pend.find((x) => x.clave === clave);
    const i = claves.indexOf(clave);
    if (b) setAnuncio(`${nombreBloque(b)}: ahora ${i === 0 ? 'el primero' : i === claves.length - 1 ? 'el último' : `el ${i + 1}.º`} de ${claves.length}`);
  };
  const mover = (b, d) => {
    const o = subir(b.clave, d);
    if (!o) return;
    alMover(o);
    const claves = pend.map((x) => x.clave);
    const i = claves.indexOf(b.clave);
    [claves[i], claves[i + d]] = [claves[i + d], claves[i]];
    decir(b.clave, claves);
    // El foco sigue al botón que se ha tocado (en su fila nueva); si ya no se puede seguir en esa dirección, al otro
    requestAnimationFrame(() => {
      const fila = lista.current?.querySelector(`[data-clave="${b.clave}"]`);
      const btn = fila?.querySelector(d < 0 ? '.ord-subir' : '.ord-bajar');
      (btn && btn.getAttribute('aria-disabled') !== 'true' ? btn : fila?.querySelector(d < 0 ? '.ord-bajar' : '.ord-subir'))?.focus({ preventScroll: true });
    });
  };

  // ---------- arrastrar por el asa (puntero: dedo o ratón)
  const alturas = useRef([]);
  const alBajar = (b, i) => (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const filas = [...(lista.current?.querySelectorAll('.ord-fila') || [])];
    alturas.current = filas.map((f) => { const r = f.getBoundingClientRect(); return { top: r.top, alto: r.height }; });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
    setArr({ clave: b.clave, desde: i, y0: e.clientY, dy: 0, hasta: i, id: e.pointerId });
  };
  const alMoverP = (e) => {
    const a = arrRef.current;
    if (!a || e.pointerId !== a.id) return;
    const dy = e.clientY - a.y0;
    const h = alturas.current;
    const centro = h[a.desde].top + h[a.desde].alto / 2 + dy;
    let hasta = 0;
    for (let k = 0; k < h.length; k++) if (centro > h[k].top + h[k].alto / 2) hasta = k;
    if (centro < h[0].top + h[0].alto / 2) hasta = 0;
    setArr({ ...a, dy, hasta });
  };
  const alSoltar = (e) => {
    const a = arrRef.current;
    if (!a || e.pointerId !== a.id) return;
    setArr(null);
    if (a.hasta === a.desde) return;
    const claves = pend.map((x) => x.clave);
    const [c] = claves.splice(a.desde, 1);
    claves.splice(a.hasta, 0, c);
    const o = reordenar(claves);
    if (o) { alMover(o); decir(c, claves); }
  };
  // Mientras se arrastra, las demás filas dejan su hueco
  const desplazamiento = (i) => {
    if (!arr) return 0;
    if (i === arr.desde) return arr.dy;
    const alto = alturas.current[arr.desde]?.alto || 0;
    if (arr.desde < arr.hasta && i > arr.desde && i <= arr.hasta) return -alto;
    if (arr.desde > arr.hasta && i < arr.desde && i >= arr.hasta) return alto;
    return 0;
  };
  useEffect(() => () => setArr(null), []);

  return (
    <Hoja titulo="Cambiar el orden" alCerrar={alCerrar}>
      <p class="peq secundario">Lo que te queda de hoy. Arrastra por el asa o usa las flechas. Solo cambia esta sesión: la pauta de tu coach se queda como está y verá el orden en que lo hiciste.</p>
      {pend.length < 2 ? <p class="peq">No queda nada que reordenar.</p> : (
        <ol class={`lista ord-lista ${arr ? 'arrastrando' : ''}`} ref={lista} aria-label="Lo que te queda, en orden">
          {pend.map((b, i) => {
            const nombre = nombreBloque(b);
            const empezado = b.ids.some((x) => Object.keys(hechas[x] || {}).length);
            return (
              <li key={b.clave} data-clave={b.clave} class={`ord-fila ${arr?.clave === b.clave ? 'levantada' : ''}`}
                style={arr ? { transform: `translateY(${desplazamiento(i)}px)`, transition: arr.clave === b.clave || quieto() ? 'none' : 'transform .15s ease' } : undefined}>
                {/* (el asa es para el dedo o el ratón; con el teclado o el lector de pantalla, «Subir» y «Bajar») */}
                <span class="ord-asa" aria-hidden="true" title="Arrastrar"
                  onPointerDown={alBajar(b, i)} onPointerMove={alMoverP} onPointerUp={alSoltar} onPointerCancel={alSoltar}>
                  <Icono n="asa" />
                </span>
                <span class="ord-pos num" aria-hidden="true">{i + 1}</span>
                <span class="ord-nombre">
                  {b.letra ? b.ids.map((x) => <span key={x}>{etiquetas[x] && <span class="ss-etq">{etiquetas[x]}</span>}{nombreDe(porId[x])}</span>) : <span>{nombre}</span>}
                  {empezado && <span class="mini terciario">Empezado</span>}
                </span>
                <span class="ord-flechas">
                  {/* (aria-disabled y no disabled: el botón sigue enfocable y el foco no se pierde al llegar arriba o abajo) */}
                  <button type="button" class="btn btn-icono ord-subir" aria-disabled={i === 0 ? 'true' : undefined} aria-label={`Subir ${nombre}`} onClick={() => i > 0 && mover(b, -1)}><Icono n="arriba" /></button>
                  <button type="button" class="btn btn-icono ord-bajar" aria-disabled={i === pend.length - 1 ? 'true' : undefined} aria-label={`Bajar ${nombre}`} onClick={() => i < pend.length - 1 && mover(b, 1)}><Icono n="abajo" /></button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p class="sr" aria-live="polite">{anuncio}</p>
      <button type="button" class="btn btn-primario btn-ancho" onClick={alCerrar}>Listo</button>
    </Hoja>
  );
}
