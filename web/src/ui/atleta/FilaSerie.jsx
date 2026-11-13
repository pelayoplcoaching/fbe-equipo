// v0.112: todo lo de la fila (lo escrito, lo propuesto, la serie hecha y «ant.») va en la unidad de la app; la sesión
// pasa a kilos al guardar (Sesion.jsx, guardar)
// Una serie: kilos y repeticiones con lo propuesto como pista gris (lo pautado o lo de la vez anterior).
// Al marcarla con los campos vacíos se usa la pista, como en un cuaderno.
// anterior: el peso de esta serie la última vez, en un recuadro pequeño (solo si el coach no ha pautado carga)
// v0.63 (antes, dentro de Sesion.jsx):
//  · lo escrito lo lleva el ejercicio (valores / cambiar), para que un cambio pueda pasar a las series siguientes que
//    llevaban lo mismo (alComprometer, al soltar el campo: logica/propagar.js);
//  · con el teclado de la app (Teclado.jsx), los campos no sacan el del móvil (inputmode="none") y el RPE es un botón que
//    abre sus valores; «Siguiente» pasa de kilos a repeticiones, al RPE si tu coach lo pide y marca la serie;
//  · deslizar a la derecha una serie sin hacer la marca (lo mismo que ✓: con lo escrito o, si no, con lo propuesto, y
//    arranca el descanso). Hasta los 10 px no se sabe si es la página: luego se fija el eje (en vertical, la página baja
//    como siempre). Pasado el umbral, un toque de vibración y el fondo ✓ entero; volviendo atrás antes de soltar, nada.
//    Mantenerla pulsada (medio segundo quieta) abre el teclado en los kilos. Sin gestos, lo mismo con ✓ y tocando los campos.
import { sonarFBE } from '../sonido.js';
import { notaRpe } from '../../logica/sonido.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, useApp } from '../comunes.jsx';
import { sinMovimiento } from '../transiciones.js';
import { Placas } from '../Herramientas.jsx';
import { num } from '../../logica/calculos.js';
import { nombrePeso, etiquetaPeso } from '../../logica/unidades.js';
import { RPES, aNumero, problemaSerie } from './sesion-comun.jsx';
import { vibrar } from '../hapticos.js';
import { Teclado, usarTecladoMovil } from './Teclado.jsx';
import { siguienteCampo, discosCon } from '../../logica/teclado.js';
import { ejeGesto, estadoDeslizar, cruceUmbral, sigueLarga, LARGA_MS } from '../../logica/deslizar.js';

const fmt = (v, d) => (v == null ? '' : num(v, d));
const mismoNum = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 1e-9);

export function FilaSerie({ numero, hecha, propuesta, activa, siguiente = false, pendiente, guardar, quitar, nombre, barra, record, tipo = null, anterior = null, ultima = null,
  valores = { kg: '', reps: '', rpe: '' }, cambiar, alComprometer = null, teclado = null, conRpe = false, paso = 2.5, objetivoEsfuerzo = null, conDiscos = false }) {
  const { aviso } = useApp();
  const { kg, reps, rpe } = valores;
  const app = !!teclado?.app;
  const valoresDe = (k = kg, r = reps, e = rpe) => ({
    kg: aNumero(k) ?? propuesta.kg ?? null,
    reps: aNumero(r) ?? propuesta.reps ?? null,
    rpe: e === '' || e == null ? '' : Number(e),
  });
  // Si ya está hecha, cada cambio se guarda al soltar el campo (o al elegir el RPE)
  const confirmar = (k, r, e) => {
    if (!hecha) return;
    const v = valoresDe(k, r, e);
    const problema = problemaSerie(v);
    // Si lo escrito no vale, se avisa y se vuelve a lo guardado
    if (problema) { aviso(problema, 'error'); cambiar('kg', fmt(hecha.kg, 2)); cambiar('reps', fmt(hecha.reps, 0)); return; }
    // (revisión M2) lo mismo que ya está guardado no se vuelve a guardar (ni a la cola sin conexión)
    const guardada = { kg: hecha.kg == null ? null : Number(hecha.kg), reps: hecha.reps == null ? null : Number(hecha.reps), rpe: hecha.rpe == null || hecha.rpe === '' ? '' : Number(hecha.rpe) };
    if (mismoNum(v.kg, guardada.kg) && mismoNum(v.reps, guardada.reps) && (v.rpe === '' ? guardada.rpe === '' : mismoNum(v.rpe, guardada.rpe))) return;
    guardar(v);
  };
  // (diseño, tanda 49) la cifra que se está escribiendo da un salto con cada tecla (solo el campo que se edita)
  const cifraAntes = useRef({ kg, reps });
  useEffect(() => {
    const antes = cifraAntes.current;
    cifraAntes.current = { kg, reps };
    const c = campoRef.current;
    if ((c !== 'kg' && c !== 'reps') || antes[c] === (c === 'kg' ? kg : reps) || sinMovimiento()) return;
    const el = refs[c].current;
    try { el?.animate?.([{ transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 190, easing: 'cubic-bezier(.2, .8, .2, 1)' }); } catch { /* */ }
  }, [kg, reps]);
  const [recien, setRecien] = useState(false);
  const [mejora, setMejora] = useState(null);
  useEffect(() => { if (!mejora) return undefined; const t = setTimeout(() => setMejora(null), 2200); return () => clearTimeout(t); }, [mejora]);
  useEffect(() => { if (!recien) return undefined; const t = setTimeout(() => setRecien(false), 600); return () => clearTimeout(t); }, [recien]);
  const marcar = () => {
    if (hecha) { quitar(); return; }
    const v = valoresDe();
    if (v.reps == null) return;
    const problema = problemaSerie(v);
    if (problema) { aviso(problema, 'error'); return; }
    // (revisión M2) lo que estaba a medio escribir se suelta antes (el cambio que pasa a las siguientes, con su aviso) y no
    // queda pendiente: así, al soltar el campo después, no se vuelve a guardar la serie
    for (const c of Object.keys(inicio.current)) comprometer(c);
    cambiar('kg', fmt(v.kg, 2)); cambiar('reps', fmt(v.reps, 0));
    setRecien(true);
    // (diseño, tanda 47) más que la última vez en esta misma serie: una pastilla verde con la diferencia (más kilos; o,
    // con los mismos kilos, más repeticiones). No es un récord: es la mejora pequeña de cada día.
    const ant = ultima && ultima.reps != null ? { kg: Number(ultima.kg) || 0, reps: Number(ultima.reps) } : null;
    if (ant && v.reps != null) {
      const dk = Math.round(((Number(v.kg) || 0) - ant.kg) * 100) / 100, dr = Number(v.reps) - ant.reps;
      setMejora(dk > 0 ? `+${num(dk, 2)} ${etiquetaPeso()}` : dk === 0 && dr > 0 ? `+${dr} ${dr === 1 ? 'rep' : 'reps'}` : null);
    }
    guardar(v);
  };

  // ---------- el campo que se edita y el teclado
  const fila = useRef(null);
  const refs = { kg: useRef(null), reps: useRef(null), rpe: useRef(null) };
  const [campo, setCampo] = useState(null);
  const campoRef = useRef(null);
  campoRef.current = campo;
  // Lo que había al entrar en cada campo: al soltarlo, si ha cambiado, se guarda (hecha) o se propone a las siguientes
  const inicio = useRef({});
  const dentro = (el) => !!el && Object.values(refs).some((r) => r.current && (r.current === el || r.current.contains(el)));
  const comprometer = (c) => {
    if (!(c in inicio.current)) return;
    const antes = inicio.current[c];
    delete inicio.current[c];
    const ahora = c === 'rpe' ? rpe : valores[c];
    // (revisión M2) se comparan los valores, no el texto: «42,50» y «42,5», o vacío y lo propuesto (el gris), son lo mismo
    if (mismoValor(c, antes, ahora)) return;
    if (hecha) confirmar(kg, reps, rpe);
    else if (c !== 'rpe') alComprometer?.(numero, c, String(antes ?? ''), String(ahora ?? ''));
  };
  const efectivo = (c, t) => {
    if (c === 'rpe') return t === '' || t == null ? null : Number(t);
    return aNumero(t) ?? propuesta[c] ?? null;
  };
  const mismoValor = (c, a, b) => mismoNum(efectivo(c, a), efectivo(c, b));
  // (lo que se escribe con el foco ya dentro, p. ej. tras marcarla: también se guarda al soltar el campo)
  const escribir = (c, t) => { if (!(c in inicio.current)) inicio.current[c] = valores[c]; cambiar(c, t); };
  const alEntrar = (c) => (e) => {
    if (!(c in inicio.current)) inicio.current[c] = c === 'rpe' ? rpe : valores[c];
    // (con el teclado de la app, lo primero que se teclea ya sustituye: sin seleccionar, que en el iPhone saca su menú de copiar)
    if (c !== 'rpe' && !app) e.currentTarget.select?.();
    if (app) setCampo(c);
  };
  const alSalir = (c) => (e) => {
    comprometer(c);
    if (!app) return;
    // (el foco pasa a otro campo de la fila con «Siguiente»: el teclado sigue; a cualquier otro sitio: se cierra)
    const a = e.relatedTarget;
    if (dentro(a)) return;
    setTimeout(() => { if (!dentro(document.activeElement) && !document.activeElement?.closest?.('.teclado-serie')) setCampo((x) => (campoRef.current === c ? null : x)); }, 0);
  };
  const enfocar = (c) => { const el = refs[c].current; if (el) { el.focus({ preventScroll: true }); if (app) setCampo(c); } };
  const cerrar = () => {
    const a = document.activeElement;
    const c = campoRef.current;
    setCampo(null);
    if (dentro(a)) a.blur(); else if (c) comprometer(c);
  };
  const siguienteDe = (c) => {
    const s = siguienteCampo(c, { conRpe });
    if (s === 'hecho') { cerrar(); if (!hecha) marcar(); return; }
    enfocar(s);
  };
  const finalDe = (c) => (siguienteCampo(c, { conRpe }) === 'hecho' ? (hecha ? 'listo' : 'hecha') : null);
  // Un teclado físico: Intro hace lo de «Siguiente»
  const alTecla = (c) => (e) => { if (app && e.key === 'Enter') { e.preventDefault(); siguienteDe(c); } };
  const elegirRpe = (v) => { cambiar('rpe', v); if (hecha) { delete inicio.current.rpe; confirmar(kg, reps, v); } };
  const alMovil = () => {
    const c = campoRef.current;
    usarTecladoMovil();
    setCampo(null);
    // En el mismo toque, el campo con el teclado del móvil (en el iPhone solo sale si se enfoca dentro del toque)
    const el = c && c !== 'rpe' ? refs[c].current : refs.kg.current;
    if (el) { el.inputMode = c === 'reps' ? 'numeric' : 'decimal'; el.blur(); el.focus(); }
    aviso('Vuelve el teclado del móvil. Lo puedes cambiar en Perfil, en «Este móvil».');
  };
  // Al dejar de usar el teclado de la app (el ajuste), fuera
  useEffect(() => { if (!app && campo) setCampo(null); }, [app]);

  // ---------- deslizar y mantener pulsado
  const gesto = useRef(null);
  const [arrastre, setArrastre] = useState(null); // null | { pasado }
  const bloquearClic = useRef(0);
  const poner = (x) => { const el = fila.current; if (el) el.style.transform = x ? `translateX(${x}px)` : ''; };
  const pararLarga = (g) => { if (g.raf) cancelAnimationFrame(g.largo); else clearTimeout(g.largo); };
  const soltarGesto = () => { const g = gesto.current; if (g) pararLarga(g); gesto.current = null; };
  useEffect(() => () => soltarGesto(), []);
  const alBajar = (e) => {
    if (bloquearClic.current === Infinity) bloquearClic.current = 0; // (por si no llegó el levantar del dedo de la pulsación larga)
    if (e.pointerType === 'mouse' || !e.isPrimary || gesto.current) return;
    const g = { id: e.pointerId, x: e.clientX, y: e.clientY, eje: null, pasado: false, ancho: fila.current?.getBoundingClientRect().width || 320 };
    // (v0.63.1) la pulsación larga se decide en el siguiente fotograma: si el móvil va cargado (justo tras saltar un descanso,
    // p. ej.), el temporizador puede vencer con los movimientos del dedo aún en cola; Chrome los entrega antes del fotograma,
    // así que un deslizamiento que empezó a tiempo se queda como deslizamiento y no abre el teclado por error
    g.largo = setTimeout(() => { g.largo = requestAnimationFrame(() => largaVencida(g)); g.raf = true; }, LARGA_MS);
    gesto.current = g;
  };
  const largaVencida = (g) => {
    if (gesto.current !== g || g.eje) return;
    g.hecho = true;
    vibrar('toque');
    // (revisión M1) el clic que llega al levantar el dedo (en el iPhone, tras un toque largo, puede caer en ✓) no cuenta:
    // se bloquea mientras siga pulsado y hasta 400 ms después de soltar, se suelte donde se suelte
    bloquearClic.current = Infinity;
    const soltar = (ev) => {
      if (ev.pointerId !== g.id) return;
      window.removeEventListener('pointerup', soltar, true); window.removeEventListener('pointercancel', soltar, true);
      bloquearClic.current = Date.now() + 400;
    };
    window.addEventListener('pointerup', soltar, true); window.addEventListener('pointercancel', soltar, true);
    // Con el teclado de la app, se abre en los kilos; con el del móvil, el campo queda enfocado (en el iPhone, el teclado
    // del sistema solo sale si se enfoca dentro de un toque: hace falta tocar el campo otra vez; en Android sale)
    enfocar('kg');
  };
  const alMover = (e) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!sigueLarga(dx, dy)) pararLarga(g);
    if (!g.eje) {
      g.eje = ejeGesto(dx, dy);
      if (!g.eje) return;
      // En vertical (o en una serie ya hecha, o tras la pulsación larga) es la página: nada que hacer
      if (g.eje === 'y' || hecha || g.hecho) { soltarGesto(); return; }
      try { fila.current?.setPointerCapture(e.pointerId); } catch { /* */ }
      setArrastre({ pasado: false });
    }
    const s = estadoDeslizar(dx, g.ancho);
    poner(s.x);
    fila.current?.style.setProperty('--progreso', String(s.progreso));
    if (cruceUmbral(g.pasado, s.pasado)) { vibrar('toque'); g.pasado = s.pasado; setArrastre({ pasado: s.pasado }); }
  };
  const alSoltar = (e) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.id) return;
    soltarGesto();
    if (g.eje !== 'x') return;
    bloquearClic.current = Date.now() + 400;
    const completar = g.pasado && e.type === 'pointerup';
    setArrastre(null);
    poner(0);
    if (!completar || hecha) return;
    // (revisión M2) como «Hecha» en el teclado: primero se suelta el campo que se editaba (se guarda lo escrito y el cambio
    // pasa a las siguientes, con su aviso) y se cierra el teclado; luego se marca
    if (campoRef.current || dentro(document.activeElement)) cerrar();
    marcar();
  };
  // (tras un deslizamiento o una pulsación larga, el clic que viene detrás no cuenta: ni marca ni enfoca otra cosa)
  const alClicCaptura = (e) => { if (Date.now() < bloquearClic.current) { e.preventDefault(); e.stopPropagation(); } };

  const etiquetaRpe = `RPE de la serie ${numero}${propuesta.rpe != null ? ` (objetivo ${num(propuesta.rpe)})` : ''}`;
  const pista = (propuesta.rpe != null ? `→ ${num(propuesta.rpe)}` : 'RPE');
  const serieTxt = tipo === 'top' ? 'Serie top' : tipo === 'backoff' ? `Back-off, serie ${numero}` : `Serie ${numero}`;
  const kgBase = propuesta.kg ?? null;
  return (
    <>
      <div class={`serie-desliza ${arrastre ? 'arrastrando' : ''} ${arrastre?.pasado ? 'pasado' : ''}`}>
        {arrastre && <div class="serie-fondo" aria-hidden="true"><Icono n="hecho" /><span>Hecha</span></div>}
        <div ref={fila} data-n={numero} class={`serie ${hecha ? 'hecha' : ''} ${activa ? 'activa' : ''} ${siguiente && !hecha ? 'siguiente' : ''} ${recien ? 'recien' : ''} ${record && recien ? 'con-record' : ''} ${tipo ? `serie-${tipo}` : ''} ${campo ? 'editando' : ''}`} role="group" aria-current={siguiente && !hecha ? 'step' : undefined}
          aria-label={`${nombre}, serie ${numero}${tipo === 'top' ? ' (top)' : tipo === 'backoff' ? ' (back-off)' : ''}`}
          onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar} onClickCapture={alClicCaptura}
          onMouseDownCapture={(e) => { if (Date.now() < bloquearClic.current) e.preventDefault(); }}
          onTouchEnd={(e) => { if (Date.now() < bloquearClic.current && e.cancelable) e.preventDefault(); }}
          onContextMenu={(e) => { if (gesto.current || Date.now() < bloquearClic.current) e.preventDefault(); }}>
          <span class="n" title={tipo === 'top' ? 'Serie top' : tipo === 'backoff' ? 'Back-off' : undefined}>{tipo === 'top' ? 'T' : tipo === 'backoff' ? 'B' : numero}</span>
          <span class="celda-kg">
            <input ref={refs.kg} class={`celda ${campo === 'kg' ? 'en-teclado' : ''}`} inputMode={app ? 'none' : 'decimal'} enterKeyHint="next" aria-label={`${nombrePeso(undefined, { mayuscula: true })} de la serie ${numero}${anterior != null ? ` (la última vez, ${num(anterior, 2)} ${etiquetaPeso()})` : ''}`} value={kg}
              placeholder={fmt(propuesta.kg, 2) || '–'} onInput={(e) => escribir('kg', e.currentTarget.value)} autoComplete="off"
              onFocus={alEntrar('kg')} onBlur={alSalir('kg')} onKeyDown={alTecla('kg')} />
            {anterior != null && <span class="peso-anterior" aria-hidden="true" title="Tu peso de la última vez en esta serie"><small>ant.</small> {num(anterior, 2)}</span>}
          </span>
          <input ref={refs.reps} class={`celda ${campo === 'reps' ? 'en-teclado' : ''}`} inputMode={app ? 'none' : 'numeric'} enterKeyHint="done" aria-label={`Repeticiones de la serie ${numero}`} value={reps}
            placeholder={fmt(propuesta.reps, 0) || '–'} onInput={(e) => escribir('reps', e.currentTarget.value)} autoComplete="off"
            onFocus={alEntrar('reps')} onBlur={alSalir('reps')} onKeyDown={alTecla('reps')} />
          {app ? (
            <button ref={refs.rpe} type="button" data-rpe={rpe === '' || rpe == null ? undefined : Math.floor(Number(rpe))} class={`rpe rpe-boton ${propuesta.rpe != null && rpe === '' ? 'rpe-objetivo' : ''} ${campo === 'rpe' ? 'en-teclado' : ''}`}
              aria-label={`${etiquetaRpe}: ${rpe === '' || rpe == null ? 'sin poner' : num(rpe)}`} aria-expanded={campo === 'rpe' ? 'true' : 'false'}
              onFocus={alEntrar('rpe')} onBlur={alSalir('rpe')} onKeyDown={alTecla('rpe')}
              onClick={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.focus({ preventScroll: true }); setCampo('rpe'); if (!('rpe' in inicio.current)) inicio.current.rpe = rpe; }}>
              {rpe === '' || rpe == null ? pista : num(rpe)}
            </button>
          ) : (
            <select ref={refs.rpe} data-rpe={rpe === '' || rpe == null ? undefined : Math.floor(Number(rpe))} class={`rpe ${propuesta.rpe != null && rpe === '' ? 'rpe-objetivo' : ''}`} aria-label={etiquetaRpe} value={rpe} onChange={(e) => {
              const v = e.currentTarget.value === '' ? '' : Number(e.currentTarget.value);
              elegirRpe(v);
              if (v !== '') sonarFBE('rpe', { f: notaRpe(v) });   // (sonido 2) el esfuerzo suena
            }}>
              {RPES.map((r) => <option key={r} value={r}>{r === '' ? pista : num(r)}</option>)}
            </select>
          )}
          <button class="hecho-btn" onClick={marcar} aria-pressed={hecha ? 'true' : 'false'}
            aria-label={hecha ? `Quitar la serie ${numero}` : `Marcar la serie ${numero} como hecha`}>
            <Icono n="hecho" />
          </button>
        </div>
        {/* (diseño, tanda 47) dentro de la fila que se desliza, que es su caja: sobre su borde de abajo, sin empujar nada */}
        {mejora && hecha && !record && <div class="serie-mejora" aria-hidden="true"><Icono n="arriba" /><span class="num">{mejora}</span><span>que la última vez</span></div>}
      </div>
      {record && <div class="record-serie"><Icono n="trofeo" /><span><strong>Récord</strong>: {record.texto}</span></div>}
      {activa && barra && !hecha && <div class="serie-discos"><Placas kg={aNumero(kg) ?? propuesta.kg} discos={teclado ? discosCon(teclado.discoMinimo) : undefined} /></div>}
      {pendiente && hecha && <div class="pendiente-envio">Serie {numero} guardada en el móvil; se enviará al volver la conexión.</div>}
      {app && campo && (
        <Teclado enCapa campo={campo} clave={`${numero}`} texto={campo === 'rpe' ? '' : valores[campo]} rpe={rpe} base={campo === 'kg' ? kgBase : propuesta.reps ?? null}
          paso={paso} serie={serieTxt} anterior={anterior != null ? `${num(anterior, 2)} ${etiquetaPeso()}` : null} objetivo={propuesta.rpe != null ? `RPE ${num(propuesta.rpe)}` : objetivoEsfuerzo}
          final={finalDe(campo)} alTexto={(t) => escribir(campo, t)} alRpe={elegirRpe} alSiguiente={() => siguienteDe(campo)} alCerrar={cerrar}
          ancla={() => fila.current} dentro={dentro} barra={barra} discoMinimo={teclado.discoMinimo} alDisco={teclado.alDisco && conDiscos ? teclado.alDisco : null}
          lugar={teclado.lugar} alCalculadora={barra && teclado.alCalculadora ? teclado.alCalculadora : null} alMovil={alMovil} />
      )}
    </>
  );
}
