import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CabCoach } from './CabCoach.jsx';
import { useApp, useCarga, Siluetas, Vacio, Avatar, Icono, CabeceraGrande, ErrorCaja } from '../comunes.jsx';
import { HojaNuevaTarea } from '../Tareas.jsx';
import { HojaPlatosSemana } from '../Platos.jsx';
import { fechaMadrid, sumarDias, desdeISO } from '../../logica/fechas.js';
import { avisosRevision, avisosPanel, partirPausados, ordenarRevision, ORDENES, moverEnOrden, FILTROS_REVISION, filtrarRevision, cuentaFiltro, TEXTO_PROXIMA, LOTES, destinatariosLote, siguientePendiente,
  ESTADOS_REVISION, TEXTO_ESTADO, pasosRevision, puntoDelBloque, resumenRevision, COLUMNAS_TABLA, ordenarTabla, ajustesDeRevision, pestanasDe } from '../../logica/revision.js';
import { ChatRevision, ChatRapido, VideosRevision, ProgramarRevision, HojaProgramar, CierreRevision, olvidarBandeja } from './RevisionTodo.jsx';
import { mensajeParaAlerta } from '../../logica/cierre.js';
import { ProgresoRevision, Semaforo } from './RevisionProgreso.jsx';
import { ChispaSesiones } from './Panel.jsx';
import { Dictar } from '../Dictar.jsx';
import { DetalleRevision, HojaBorrador, HojaLote, SemanaPasada, prefRevision, guardarPref, olvidarDetalle } from './RevisionDetalle.jsx';

const SIN_SUBIR = 'fbe-revision-sin-subir';

// (v0.192) los avisos que se le pueden pedir con un mensaje ya escrito (logica/cierre.js: mensajeParaAlerta)
const PEDIBLES = new Set(['sin_entrenar', 'sesion_abierta', 'sin_peso', 'cumplimiento', 'esfuerzo', 'habitos']);
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const rango = (lunes) => {
  const a = desdeISO(lunes), b = desdeISO(sumarDias(lunes, 6));
  return a.getMonth() === b.getMonth() ? `${a.getDate()} al ${b.getDate()} ${MES[b.getMonth()]}` : `${a.getDate()} ${MES[a.getMonth()]} al ${b.getDate()} ${MES[b.getMonth()]}`;
};

// v0.67: «Revisión semanal». Todos tus atletas en una lista para la revisión del finde: sus sesiones de la semana, lo que
// pide tu atención (check-in, vídeos, mensajes, molestias), una casilla para darla por terminada y una nota corta que te sale
// la semana siguiente; y, de cada uno, chat, programar y seguimiento a un toque. La casilla y la nota se guardan en la base
// (040), por atleta y semana: el lunes empieza una semana nueva y la anterior queda en el historial.
export function RevisionSemanal({ abrirAtleta }) {
  const { api, aviso } = useApp();
  const res = useCarga(() => api.revisionSemanal(fechaMadrid()) /* (la semana de Madrid, también si abres la app de viaje) */, []);
  const [filtro, setFiltro] = useState('pendientes');
  const [cambios, setCambios] = useState({}); // atleta_id → { hecha?, nota? } (lo tocado aquí, encima de lo cargado)
  // (v0.191) el orden y lo que se filtra; el modo «uno a uno»; el cursor del teclado; una semana pasada; pedir en lote
  const [pref, setPref] = useState(prefRevision);
  const [marcados, setMarcados] = useState(() => new Set());
  const [foco, setFoco] = useState(null);       // { ids, actual }: el recorrido uno a uno
  const [cursor, setCursor] = useState(null);   // atleta_id señalado con el teclado
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [atras, setAtras] = useState(0);        // semanas hacia atrás (0: esta)
  const [lote, setLote] = useState(null);
  const [pedirHoja, setPedirHoja] = useState(null);   // { id, hoja }: abrir una hoja de una fila desde el teclado
  // (v0.192) las frases y el orden, también en la base (082) para tenerlos en todos tus aparatos; la tabla, en pantallas anchas
  const [frases, setFrases] = useState(() => { try { return JSON.parse(localStorage.getItem('fbe-revision-frases') || '[]'); } catch { return []; } });
  const enLaBase = useRef(false);
  // (v0.206.1) mientras un cambio no llega a la base queda una marca en el aparato: si se recarga antes, lo de aquí manda
  const subidas = useRef(0);
  const subir = (a) => {
    const marca = `${Date.now()}-${++subidas.current}`;
    try { localStorage.setItem(SIN_SUBIR, marca); } catch { /* */ }
    if (!enLaBase.current) return;
    api.guardarRevisionAjustes(a).then((ok) => { try { if (ok && localStorage.getItem(SIN_SUBIR) === marca) localStorage.removeItem(SIN_SUBIR); } catch { /* */ } }).catch(() => {});
  };
  useEffect(() => {
    let vivo = true;
    api.revisionAjustes().then((remoto) => {
      if (!vivo || remoto === undefined) return;
      enLaBase.current = true;
      let sinSubir = false;
      try { sinSubir = !!localStorage.getItem(SIN_SUBIR); } catch { /* */ }
      // (lo de este aparato, leído ahora: puede haber cambiado mientras llegaba la base)
      const p = prefRevision();
      let fr = frases;
      try { fr = JSON.parse(localStorage.getItem('fbe-revision-frases') || '[]'); } catch { /* */ }
      const local = { frases: fr, orden: p.mio, modo: p.orden, vista: p.vista };
      const a = ajustesDeRevision(remoto, local, sinSubir);
      if (!remoto || sinSubir) { if (sinSubir || local.frases.length || local.orden.length) subir(a); return; }
      setFrases(a.frases); try { localStorage.setItem('fbe-revision-frases', JSON.stringify(a.frases)); } catch { /* */ }
      setPref((x) => { const n = { ...x, orden: a.modo, mio: a.orden, vista: a.vista }; guardarPref(n); return n; });
    }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  const ponerFrases = (l) => { setFrases(l); subir({ frases: l, orden: pref.mio, modo: pref.orden, vista: pref.vista }); };
  const [ancha, setAncha] = useState(() => typeof matchMedia === 'function' && matchMedia('(min-width: 1000px)').matches);
  useEffect(() => { if (typeof matchMedia !== 'function') return undefined; const m = matchMedia('(min-width: 1000px)'); const f = () => setAncha(m.matches); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f); }, []);
  const [colTabla, setColTabla] = useState({ col: 'nombre', dir: 1 });
  const [pedir, setPedir] = useState(null);   // { f, alerta }: «pedírselo» desde un aviso
  // (v0.193) uno a uno con pestañas (su semana, chat, vídeos, programar), lo que se cita en el chat y el cierre
  const [pestana, setPestana] = useState('semana');
  const [cita, setCita] = useState(null);
  const [programar, setProgramar] = useState({ modo: null, ejercicio: null });
  const [cierre, setCierre] = useState(false);
  const [chatVersion, setChatVersion] = useState(0);
  const datos = res.datos;
  // (079) cuántas fotos de sus platos ha subido cada uno esta semana
  const platos = useCarga(() => (datos?.lunes ? api.platosDeLaSemana(datos.lunes).catch(() => ({})) : Promise.resolve({})), [datos?.lunes]);
  // (v0.194) el progreso de cada uno (peso, medidas, comida, descanso), que llega después de la lista
  const progresos = useCarga(() => (datos?.lunes ? api.progresoEquipo(datos.filas, datos.lunes).catch(() => ({})) : Promise.resolve({})), [datos?.lunes, datos?.filas?.length]);
  const todas = useMemo(() => (datos?.filas || []).map((f) => ({ ...f, ...(cambios[f.atleta_id] || {}), progreso: progresos.datos ? progresos.datos[f.atleta_id] || null : undefined })), [datos, cambios, progresos.datos]);
  // (v0.191) los pausados, aparte: ni cuentan ni salen como pendientes
  const { activos: filas, pausados } = useMemo(() => partirPausados(todas), [todas]);
  const ordenadas = useMemo(() => ordenarRevision(filas, pref.orden, { mio: pref.mio, lunes: datos?.lunes }), [filas, pref.orden, pref.mio, datos?.lunes]);
  const hechas = filas.filter((f) => f.hecha).length;
  const deEstado = ordenadas.filter((f) => filtro === 'todos' || (filtro === 'hechos' ? f.hecha : !f.hecha));
  const vista = filtrarRevision(deEstado, marcados);
  const cambiarPref = (c) => setPref((x) => { const n = { ...x, ...c }; guardarPref(n); subir({ frases, orden: n.mio, modo: n.orden, vista: n.vista }); return n; });
  const enTabla = ancha && pref.vista === 'tabla';

  const guardar = async (f, c, { callado = false } = {}) => {
    const antes = cambios[f.atleta_id] || {};
    setCambios((x) => ({ ...x, [f.atleta_id]: { ...antes, ...c, ...('estado' in c ? { estadoRevision: c.estado } : {}) } }));
    try {
      await api.marcarRevision(f.atleta_id, datos.lunes, c);
      // (al marcarlo, en «Pendientes» se va de la lista: por si fue sin querer, «Deshacer»)
      if (c.hecha === true && !callado) {
        // (v0.193, opcional) también lo suyo que espera en «Revisar»; «Deshacer» lo devuelve todo
        let mas = [];
        if (pref.revisarTodo) { mas = await api.revisarLoDe(f.atleta_id).catch(() => []); olvidarBandeja(); if (mas.length) setCambios((x) => ({ ...x, [f.atleta_id]: { ...(x[f.atleta_id] || {}), videos: 0 } })); }
        aviso(`${f.nombre.split(' ')[0]}, revisado${mas.length ? ` (y ${mas.length} en «Revisar»)` : ''}`, 'ok', { texto: 'Deshacer', fn: async () => { if (mas.length) { await api.deshacerRevisados(mas); olvidarBandeja(); res.recargar(true); } guardar(f, { hecha: false }); } });
      }
      return true;
    } catch (e) { setCambios((x) => ({ ...x, [f.atleta_id]: antes })); aviso(e?.message || 'No se ha podido guardar: vuelve a intentarlo', 'error'); return false; }
  };
  // Marcar (o desmarcar) desde una fila: en «uno a uno», al darlo por revisado se pasa solo al siguiente
  const marcar = async (f, c) => {
    const bien = await guardar(f, c);
    if (bien && c.hecha === true && foco?.actual === f.atleta_id) {
      const yaHechas = new Set(filas.filter((x) => x.hecha || x.atleta_id === f.atleta_id).map((x) => x.atleta_id));
      const sig = siguientePendiente(foco.ids, yaHechas, f.atleta_id);
      if (sig) { setFoco({ ids: foco.ids, actual: sig }); setPestana('semana'); } else { setFoco(null); setCierre(true); }
    }
  };
  const empezar = (desde = null) => {
    const ids = (vista.length ? vista : ordenadas).map((f) => f.atleta_id);
    if (!ids.length) return;
    setPestana('semana'); setCierre(false);
    setFoco({ ids, actual: desde && ids.includes(desde) ? desde : ids[0] });
  };
  const mover = (delta) => { if (!foco) return; const i = foco.ids.indexOf(foco.actual), j = i + delta; if (j >= 0 && j < foco.ids.length) { setFoco({ ids: foco.ids, actual: foco.ids[j] }); setPestana('semana'); setProgramar({ modo: null, ejercicio: null }); } };
  const alternar = (id) => setAbiertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const moverMio = (id, delta) => cambiarPref({ mio: moverEnOrden(ordenadas.map((f) => f.atleta_id), id, delta) });

  // (v0.191) Con teclado (ordenador): J/K o flechas para moverte, X revisado, M mensaje, Intro detalle, U uno a uno
  const teclas = useRef(null);
  teclas.current = (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || atras > 0) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const lista = foco ? foco.ids : vista.map((f) => f.atleta_id);
    const actual = foco ? foco.actual : cursor;
    const fila = todas.find((f) => f.atleta_id === actual) || null;
    const ir = (d) => { if (foco) { mover(d); return; } if (!lista.length) return; const i = lista.indexOf(actual); const j = i < 0 ? 0 : Math.max(0, Math.min(lista.length - 1, i + d)); setCursor(lista[j]); };
    if (k === 'j' || (foco && k === 'ArrowRight')) { e.preventDefault(); ir(1); }
    else if (k === 'k' || (foco && k === 'ArrowLeft')) { e.preventDefault(); ir(-1); }
    else if (k === 'x' && fila && datos?.revisiones) { e.preventDefault(); marcar(fila, { hecha: !fila.hecha }); }
    else if (k === 'm' && fila) { e.preventDefault(); setPedirHoja({ id: fila.atleta_id, hoja: 'mensaje', n: Date.now() }); }
    else if (k === 'Enter' && fila && !foco && t === document.body) { e.preventDefault(); alternar(fila.atleta_id); }
    else if (k === 'u' && !foco) { e.preventDefault(); empezar(actual); }
    else if (foco && fila && /^[1-4]$/.test(k)) { const ps = pestanasDe(fila); if (ps[Number(k) - 1]) { e.preventDefault(); setPestana(ps[Number(k) - 1][0]); } }
    else if (k === 'Escape' && foco) { e.preventDefault(); setFoco(null); }
  };
  useEffect(() => { const f = (e) => teclas.current?.(e); document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, []);
  useEffect(() => { if (cursor && !foco) document.getElementById(`rev-fila-${cursor}`)?.scrollIntoView({ block: 'nearest' }); }, [cursor]);
  useEffect(() => { if (foco) document.querySelector('.contenido.revision')?.scrollIntoView({ block: 'start' }); }, [foco?.actual]);

  const lunesVisto = datos ? sumarDias(datos.lunes, -7 * atras) : null;
  const enFoco = foco ? todas.find((f) => f.atleta_id === foco.actual) : null;
  const propsFila = (f) => ({ f, con040: datos.revisiones, guardar: (c) => (('hecha' in c) ? marcar(f, c) : guardar(f, c)), abrirAtleta, lunes: datos.lunes, platos: platos.datos?.[f.atleta_id] || 0, pedirHoja: pedirHoja?.id === f.atleta_id ? pedirHoja : null,
    con082: datos.con082, ancha, frases, alFrases: ponerFrases, alPedir: (alerta) => setPedir({ f, alerta }), alPedirTexto: (texto) => setPedir({ f, texto }), alCambiar: (c) => setCambios((x) => ({ ...x, [f.atleta_id]: { ...(x[f.atleta_id] || {}), ...c } })) });

  return (
    <div class="contenido coach revision">
      <CabeceraGrande>
        <div class="titulo"><h1>Revisión semanal</h1>{datos && (
          <>
            <div class="sub">Semana del {rango(lunesVisto)}</div>
            <div class="rev-semana">
              <button type="button" class="btn btn-peq" disabled={atras >= 7} onClick={() => { setFoco(null); setAtras((n) => Math.min(7, n + 1)); }}><span aria-hidden="true">‹</span> Semana anterior</button>
              {atras > 0 && <button type="button" class="btn btn-peq" onClick={() => setAtras((n) => Math.max(0, n - 1))}>Semana siguiente <span aria-hidden="true">›</span></button>}
              {atras > 1 && <button type="button" class="btn-texto mini" onClick={() => setAtras(0)}>Volver a esta semana</button>}
            </div>
          </>
        )}</div>
      </CabeceraGrande>
      {/* (imágenes, bloque S) las carpetas de la semana */}
      {!foco && atras === 0 && <CabCoach id="coach-revision-semanal" titulo="El repaso de la semana"><span class="peq">Uno a uno: sesiones, check-in, molestias y vídeos. Escríbele y márcalo como revisado.</span></CabCoach>}
      {res.cargando && !datos ? <Siluetas forma="lista" n={6} texto="Cargando la revisión" /> : res.error ? (
        <ErrorCaja error={res.error} reintentar={() => res.recargar()} />
      ) : atras > 0 ? <SemanaPasada lunes={lunesVisto} abrirAtleta={abrirAtleta} />
        : !todas.length ? (
        <div class="panel"><Vacio ilustracion="atletas" titulo="Aún no tienes atletas">Cuando des de alta a alguien, saldrá aquí para tu revisión de cada semana.</Vacio></div>
      ) : cierre ? (
        <CierreRevision filas={filas} abrirAtleta={abrirAtleta} alSeguir={() => setCierre(false)} />
      ) : foco && enFoco ? (
        <div class="pila rev-uno">
          <div class="panel panel-pad rev-uno-barra">
            <button type="button" class="btn btn-peq" disabled={foco.ids.indexOf(foco.actual) === 0} onClick={() => mover(-1)}><span aria-hidden="true">‹</span> Anterior</button>
            <strong class="num" aria-live="polite">{foco.ids.indexOf(foco.actual) + 1} de {foco.ids.length}</strong>
            <button type="button" class="btn btn-peq" disabled={foco.ids.indexOf(foco.actual) === foco.ids.length - 1} onClick={() => mover(1)}>Siguiente <span aria-hidden="true">›</span></button>
            <button type="button" class="btn-texto mini rev-uno-salir" onClick={() => setFoco(null)}>Ver la lista</button>
          </div>
          {(() => {
            const ps = pestanasDe(enFoco), actual = ps.some(([k]) => k === pestana) ? pestana : 'semana';
            const citar = (t) => { setCita({ texto: t, n: Date.now() }); aviso('Citado: lo tienes en el chat rápido y en el chat completo'); };
            const alEscribir = () => { olvidarDetalle(enFoco.atleta_id); setCambios((x) => ({ ...x, [enFoco.atleta_id]: { ...(x[enFoco.atleta_id] || {}), mensajes: 0, escritos: (enFoco.escritos || 0) + 1 } })); };
            const ajustar = (ej) => { setProgramar({ modo: null, ejercicio: ej }); setPestana('programar'); };
            const tarjeta = <ul class="revision-lista"><FilaRevision key={enFoco.atleta_id} {...propsFila(enFoco)} abierta unoAUno alChat={() => setPestana('chat')} alProgramar={(modo = null) => { setProgramar({ modo, ejercicio: null }); setPestana('programar'); }} alCitar={citar} alAjustar={ajustar} /></ul>;
            return (
              <>
                <div class="selector-chips rev-pestanas" role="group" aria-label="Qué ver de este atleta">
                  {ps.map(([k, t], n) => <button key={k} type="button" aria-pressed={actual === k ? 'true' : 'false'} title={`Tecla ${n + 1}`} onClick={() => setPestana(k)}>{t}{k === 'videos' ? ` (${enFoco.videos})` : ''}</button>)}
                </div>
                {actual === 'semana' && (ancha ? (
                  <div class="rev-dos">
                    {tarjeta}
                    <div class="rev-lado-chat"><div class="panel panel-pad"><ChatRapido key={`${enFoco.atleta_id}-${chatVersion}`} f={enFoco} insertar={cita} alChat={() => setPestana('chat')} alEnviado={alEscribir} /></div></div>
                  </div>
                ) : <>{tarjeta}<div class="panel panel-pad"><ChatRapido key={`${enFoco.atleta_id}-${chatVersion}`} f={enFoco} insertar={cita} n={3} alChat={() => setPestana('chat')} alEnviado={alEscribir} /></div></>)}
                {actual === 'chat' && <ChatRevision f={enFoco} insertar={cita} alCambiar={() => setChatVersion((n) => n + 1)} />}
                {actual === 'videos' && <div class="panel panel-pad"><VideosRevision f={enFoco} alCambiar={(n) => setCambios((x) => ({ ...x, [enFoco.atleta_id]: { ...(x[enFoco.atleta_id] || {}), videos: Math.max(0, (enFoco.videos || 0) + n) } }))} /></div>}
                {actual === 'programar' && (
                  <div class={`rev-editor-env ${ancha ? 'con-lado' : ''}`}>
                    {ancha && <aside class="panel panel-pad rev-editor-lado" aria-label="Su semana"><strong>{enFoco.nombre}</strong>{enFoco.nota && <p class="peq rev-tu-nota"><span><strong>Tu nota:</strong> {enFoco.nota}</span></p>}<DetalleRevision f={enFoco} lunes={datos.lunes} abrirAtleta={abrirAtleta} compacto /></aside>}
                    <div class="panel panel-pad rev-editor-caja"><ProgramarRevision f={enFoco} modo={programar.modo} ejercicio={programar.ejercicio} abrirAtleta={abrirAtleta} alCambiar={() => res.recargar(true)} /></div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <div class="pila">
          <div class="panel panel-pad revision-progreso">
            <div class="fila-entre"><strong>{hechas} de {filas.length} revisados</strong>{filas.length > 0 && hechas === filas.length && <span class="chip ok"><Icono n="hecho" /> Todo revisado</span>}</div>
            <div class="barra-revision" role="progressbar" aria-label="Revisados" aria-valuemin="0" aria-valuemax={filas.length} aria-valuenow={hechas}><span style={{ width: `${filas.length ? Math.round((hechas / filas.length) * 100) : 0}%` }} /></div>
            {!datos.revisiones && <p class="peq secundario">La casilla de revisado y las notas, disponibles tras la migración 040 (supabase/migraciones/040_revision_semanal.sql). Lo demás ya funciona.</p>}
            <div class="fila-envolver rev-arranque">
              {vista.length > 0 && <button type="button" class="btn btn-primario btn-peq" onClick={() => empezar(null)}><Icono n="play" /> Revisar uno a uno</button>}
              {Object.keys(LOTES).map((tipo) => { const n = destinatariosLote(filas, tipo).length; return n > 0 && <button key={tipo} type="button" class="btn btn-peq" onClick={() => setLote(tipo)}><Icono n="enviar" /> {LOTES[tipo].titulo} ({n})</button>; })}
            </div>
            {datos.revisiones && <label class="rev-marcar rev-opcion"><input type="checkbox" checked={!!pref.revisarTodo} onChange={(e) => cambiarPref({ revisarTodo: e.currentTarget.checked })} /> <span>Al dar a alguien por revisado, dar también por revisado lo suyo que espera en «Revisar» (sesiones, check-in y vídeos)</span></label>}
            {(() => { const r = resumenRevision(filas); return (
              <details class="rev-resumen">
                <summary>Resumen de la revisión</summary>
                <ul>
                  <li>Revisados: <b class="num">{r.revisados} de {r.total}</b>. Les has escrito esta semana a <b class="num">{r.conRepaso}</b>.</li>
                  {r.porProgramar.length > 0 && <li>Falta la semana que viene de {r.porProgramar.length}: {r.porProgramar.join(', ')}.</li>}
                  {r.esperando.length > 0 && <li>Esperando respuesta de: {r.esperando.join(', ')}.</li>}
                  {r.sinCheckin.length > 0 && <li>Sin check-in: {r.sinCheckin.join(', ')}.</li>}
                  {r.enRojo.length > 0 && <li>Con algo de su progreso en rojo: {r.enRojo.join(', ')}.</li>}
                  {!r.porProgramar.length && !r.esperando.length && !r.sinCheckin.length && !r.enRojo.length && <li>No queda nada suelto.</li>}
                </ul>
              </details>
            ); })()}
            <p class="peq secundario rev-atajos"><Icono n="teclado" /> Con teclado: J y K para moverte, X revisado, M mensaje, Intro para ver su semana, U uno a uno.</p>
          </div>
          <div class="selector-chips" role="group" aria-label="Qué ver">
            {[['pendientes', `Pendientes (${filas.length - hechas})`], ['hechos', `Hechos (${hechas})`], ['todos', 'Todos']].map(([k, t]) => (
              <button key={k} aria-pressed={filtro === k ? 'true' : 'false'} onClick={() => setFiltro(k)}>{t}</button>
            ))}
          </div>
          <div class="rev-controles">
            <label class="rev-orden"><span class="peq secundario">Orden</span>
              <select value={pref.orden} onChange={(e) => cambiarPref({ orden: e.currentTarget.value })} aria-label="Orden de la lista">{ORDENES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            </label>
            {ancha && <div class="selector-chips rev-vista" role="group" aria-label="Cómo verlo">
              {[['lista', 'Tarjetas'], ['tabla', 'Tabla']].map(([k, t]) => <button key={k} type="button" aria-pressed={(pref.vista || 'lista') === k ? 'true' : 'false'} onClick={() => cambiarPref({ vista: k })}>{t}</button>)}
            </div>}
            <div class="rev-filtros" role="group" aria-label="Solo los que tienen">
              {FILTROS_REVISION.map(([k, t]) => { const n = cuentaFiltro(deEstado, k); return (n > 0 || marcados.has(k)) && (
                <button key={k} type="button" class="chip rev-filtro" aria-pressed={marcados.has(k) ? 'true' : 'false'} onClick={() => setMarcados((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; })}>{t} ({n})</button>
              ); })}
            </div>
          </div>
          {!vista.length ? (
            <div class="panel"><Vacio icono="hecho" ilustracion={filtro === 'pendientes' && !marcados.size ? 'todo' : null} titulo={marcados.size ? 'Nadie con eso' : filtro === 'pendientes' ? '¡Revisión terminada!' : 'Nadie revisado aún'}>{marcados.size ? 'Quita algún filtro para ver a los demás.' : filtro === 'pendientes' ? 'Has revisado a todos esta semana.' : 'Marca a cada atleta cuando acabes con él.'}</Vacio></div>
          ) : enTabla ? (
            <div class="panel rev-tabla-env">
              <table class="rev-tabla rev-tabla-todos">
                <thead><tr>
                  {COLUMNAS_TABLA.map(([k, t]) => <th key={k} scope="col" aria-sort={colTabla.col === k ? (colTabla.dir > 0 ? 'ascending' : 'descending') : 'none'}><button type="button" class="btn-texto" onClick={() => setColTabla((c) => ({ col: k, dir: c.col === k ? -c.dir : 1 }))}>{t}{colTabla.col === k ? (colTabla.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>)}
                  <th scope="col">Revisado</th>
                </tr></thead>
                <tbody>{ordenarTabla(vista, colTabla.col, colTabla.dir).map((f) => (
                  <tr key={f.atleta_id} class={f.hecha ? 'hecha' : ''}>
                    <th scope="row"><button type="button" class="btn-texto" onClick={() => empezar(f.atleta_id)}>{f.nombre}</button>{f.estadoRevision && !f.hecha ? <span class="chip info">{TEXTO_ESTADO[f.estadoRevision]}</span> : null}</th>
                    <td class="num">{f.servicio === 'nutricion' ? '-' : f.sesiones.total ? `${f.sesiones.completadas} de ${f.sesiones.total}` : f.sesiones.completadas || '-'}</td>
                    <td>{f.checkin ? 'Enviado' : f.servicio === 'nutricion' ? '-' : 'Falta'}</td>
                    <td class="num">{f.videos || '-'}</td>
                    <td class="num">{f.mensajes || '-'}</td>
                    <td class="num">{f.molestia >= 2 ? `${f.molestia}/5` : '-'}</td>
                    <td>{f.proxima ? TEXTO_PROXIMA[f.proxima].replace('Semana que viene ', '') : '-'}</td>
                    <td>{f.progreso ? <Semaforo progreso={f.progreso} compacto /> : <span class="peq secundario">...</span>}</td>
                    <td>{datos.revisiones && <input type="checkbox" checked={f.hecha} onChange={(e) => marcar(f, { hecha: e.currentTarget.checked })} aria-label={`Revisión de ${f.nombre} terminada`} />}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <ul class="revision-lista">
              {vista.map((f, i) => <FilaRevision key={f.atleta_id} {...propsFila(f)} abierta={abiertos.has(f.atleta_id)} alternar={() => alternar(f.atleta_id)} senalada={cursor === f.atleta_id}
                alFoco={() => empezar(f.atleta_id)} alChat={() => { empezar(f.atleta_id); setPestana('chat'); }} alCitar={(t) => { empezar(f.atleta_id); setCita({ texto: t, n: Date.now() }); aviso('Citado en su chat'); }} mover={pref.orden === 'mio' && !marcados.size ? { subir: i > 0 ? () => moverMio(f.atleta_id, -1) : null, bajar: i < vista.length - 1 ? () => moverMio(f.atleta_id, 1) : null } : null} />)}
            </ul>
          )}
          {pausados.length > 0 && (
            <details class="panel panel-pad rev-pausados">
              <summary><strong>En pausa ({pausados.length})</strong> <span class="peq secundario">No cuentan en la revisión</span></summary>
              <ul>{pausados.map((f) => (
                <li key={f.atleta_id}><Avatar nombre={f.nombre} foto={f.foto} /><span class="pila-xs"><strong>{f.nombre}</strong><span class="peq secundario">{f.pausa?.hasta ? `En pausa hasta el ${desdeISO(f.pausa.hasta).getDate()} ${MES[desdeISO(f.pausa.hasta).getMonth()]}` : 'En pausa, sin fecha de vuelta'}{f.mensajes > 0 ? ` · ${f.mensajes === 1 ? '1 mensaje sin leer' : `${f.mensajes} mensajes sin leer`}` : ''}</span></span>
                  <button type="button" class="btn btn-peq" onClick={() => abrirAtleta(f.atleta_id, 'mensajes', null)}><Icono n="mensaje" /> Chat</button></li>
              ))}</ul>
            </details>
          )}
        </div>
      )}
      {lote && <HojaLote titulo={LOTES[lote].titulo} destinatarios={destinatariosLote(filas, lote)} alCerrar={() => setLote(null)} />}
      {pedir && <HojaLote titulo={`Pedírselo a ${pedir.f.nombre.split(' ')[0]}`} destinatarios={[{ atleta_id: pedir.f.atleta_id, nombre: pedir.f.nombre, texto: pedir.texto || mensajeParaAlerta(pedir.alerta, pedir.f.nombre) }]} uno alCerrar={() => setPedir(null)} />}
    </div>
  );
}

function FilaRevision({ f, con040, guardar, abrirAtleta, lunes = null, platos = 0, abierta = false, alternar = null, unoAUno = false, senalada = false, alFoco = null, mover = null, pedirHoja = null, con082 = false, frases = null, alFrases = null, alPedir = null, alPedirTexto = null, alCambiar = null, alChat = null, alProgramar = null, alCitar = null, alAjustar = null, ancha = false }) {
  const [nota, setNota] = useState(f.nota || '');
  const [verNota, setVerNota] = useState(!!f.nota || unoAUno);
  const area = useRef(null);
  useEffect(() => { setNota(f.nota || ''); }, [f.nota]);
  const avisos = avisosRevision(f);
  const extra = avisosPanel(f);
  const { completadas, total } = f.sesiones;
  const idCasilla = `rev-${f.atleta_id}`;
  const soltarNota = () => { if ((nota || '').trim() !== (f.nota || '').trim()) guardar({ nota }); };
  const [hoja, setHoja] = useState(null);   // (054) 'mensaje' | 'tarea' | (079) 'platos' | (v0.193) 'chat' | 'programar'
  const [prog, setProg] = useState({ modo: null, ejercicio: null });
  const citar = alCitar;
  const programarAqui = (modo = null, ejercicio = null) => { if (alProgramar && !ejercicio) alProgramar(modo); else if (alAjustar && ejercicio) alAjustar(ejercicio); else { setProg({ modo, ejercicio }); setHoja('programar'); } };
  useEffect(() => { if (pedirHoja?.hoja) setHoja(pedirHoja.hoja); }, [pedirHoja?.n]);
  const sinProgramar = f.proxima === 'sin' || f.proxima === 'borrador';
  const punto = puntoDelBloque(f);
  const pasos = pasosRevision(f);
  return (
    <li id={`rev-fila-${f.atleta_id}`} class={`panel revision-fila ${f.hecha ? 'hecha' : ''} ${senalada ? 'rev-cursor' : ''}`}>
      <div class="revision-cab">
        <Avatar nombre={f.nombre} foto={f.foto} />
        <div class="pila-xs revision-quien">
          <strong>{f.nombre}</strong>
          <span class="peq secundario">{f.servicio === 'nutricion' ? 'Solo nutrición' : total ? `${completadas} de ${total} sesiones esta semana` : completadas ? `${completadas} sesiones esta semana` : 'Sin sesiones esta semana'}{f.peso?.kg != null ? ` · ${String(f.peso.kg).replace('.', ',')} kg${f.peso.cambio ? ` (${f.peso.cambio > 0 ? '+' : ''}${String(f.peso.cambio).replace('.', ',')})` : ''}` : ''}</span>
          {punto && <span class="peq secundario rev-punto">{punto}{f.bloque?.objetivo ? ` · Objetivo: ${f.bloque.objetivo}` : ''}</span>}
          {f.chispa && f.servicio !== 'nutricion' && <ChispaSesiones semanas={f.chispa} />}
          {total > 0 && <span class="barra-sesiones" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.round((completadas / total) * 100))}%` }} /></span>}
        </div>
        {con040 && (
          <label class="revision-casilla" for={idCasilla}>
            <input id={idCasilla} type="checkbox" checked={f.hecha} onChange={(e) => guardar({ hecha: e.currentTarget.checked })} aria-label={`Revisión de ${f.nombre} terminada`} />
            <span aria-hidden="true">Revisado</span>
          </label>
        )}
      </div>
      {(avisos.length > 0 || extra.length > 0 || f.proxima) && (
        <ul class="revision-avisos" aria-label="Lo que pide tu atención">
          {avisos.map((a) => <li key={a.tipo} class={`chip ${a.nivel}`}>{a.texto}</li>)}
          {extra.map((a, i) => (alPedir && PEDIBLES.has(a.tipo)
            ? <li key={`${a.tipo}-${i}`}><button type="button" class={`chip rev-pedir ${a.nivel}`} title="Pedírselo con un mensaje" onClick={() => alPedir(a)}>{a.texto} <Icono n="enviar" /></button></li>
            : <li key={`${a.tipo}-${i}`} class={`chip ${a.nivel}`}>{a.texto}</li>))}
          {f.cobro && <li class="chip info rev-cobro">Cobro pendiente</li>}
          {f.estadoRevision && !f.hecha && <li class="chip aviso">{TEXTO_ESTADO[f.estadoRevision]}</li>}
          {f.proxima && <li class={`chip ${f.proxima === 'publicada' ? 'ok' : 'aviso'}`}>{TEXTO_PROXIMA[f.proxima]}</li>}
        </ul>
      )}
      <ul class="rev-pasos" aria-label="Tus pasos con este atleta">
        {pasos.map((x) => <li key={x.clave} class={x.hecho ? 'hecho' : ''}><Icono n={x.hecho ? 'hecho' : 'reloj'} /> <span>{x.texto}</span><span class="sr">{x.hecho ? ' (hecho)' : ' (pendiente)'}</span></li>)}
      </ul>
      {f.progreso !== null && <ProgresoRevision key={`prog-${f.atleta_id}-${unoAUno ? 1 : 0}`} f={f} abierto={unoAUno} alPedir={alPedirTexto} />}
      {f.notaAnterior && <p class="peq revision-anterior"><Icono n="historial" /> La semana pasada: {f.notaAnterior}</p>}
      {!unoAUno && alternar && (
        <div class="fila-envolver rev-abrir">
          <button type="button" class="btn-texto mini" aria-expanded={abierta ? 'true' : 'false'} onClick={alternar}><Icono n={abierta ? 'arriba' : 'abajo'} /> {abierta ? 'Ocultar su semana' : 'Ver su semana aquí'}</button>
          {alFoco && <button type="button" class="btn-texto mini" onClick={alFoco}>Uno a uno desde aquí</button>}
          {sinProgramar && f.bloque?.id && <button type="button" class="btn-texto mini" onClick={() => programarAqui('fbe')}>Propuesta según FBE</button>}
          {mover && <span class="rev-mover"><button type="button" class="btn-icono plano" aria-label={`Subir a ${f.nombre}`} disabled={!mover.subir} onClick={mover.subir || undefined}><Icono n="arriba" /></button><button type="button" class="btn-icono plano" aria-label={`Bajar a ${f.nombre}`} disabled={!mover.bajar} onClick={mover.bajar || undefined}><Icono n="abajo" /></button></span>}
        </div>
      )}
      {abierta && lunes && <DetalleRevision f={f} lunes={lunes} abrirAtleta={abrirAtleta} alCambiar={alCambiar} alCitar={citar} alAjustar={f.servicio === 'nutricion' ? null : (ej) => programarAqui(null, ej)} />}
      {con040 && (verNota ? (
        <label class="pila-xs revision-nota">
          <span class="fila-entre"><span class="peq secundario">Nota de esta semana (te saldrá la próxima y al programarle)</span><Dictar etiqueta="Dictar la nota" alTexto={(t) => { const n = nota ? `${nota.trimEnd()} ${t}` : t; setNota(n.slice(0, 500)); guardar({ nota: n.slice(0, 500) }); }} /></span>
          <textarea ref={area} rows="2" maxLength={500} value={nota} onInput={(e) => setNota(e.currentTarget.value)} onBlur={soltarNota} placeholder="Ej.: subir 2,5 kg en sentadilla; preguntar por el hombro" />
        </label>
      ) : <button class="btn-texto mini" onClick={() => { setVerNota(true); requestAnimationFrame(() => area.current?.focus()); }}>Añadir nota</button>)}
      {con040 && (verNota || con082) && (
        <div class="fila-envolver rev-extra">
          {verNota && nota.trim() && <button type="button" class="btn-texto mini" onClick={() => setHoja('tarea-nota')}><Icono n="hecho" /> Convertir la nota en tarea</button>}
          {con082 && !f.hecha && (
            <label class="rev-estado"><span class="peq secundario">A medias</span>
              <select value={f.estadoRevision || ''} aria-label={`Estado de la revisión de ${f.nombre}`} onChange={(e) => guardar({ estado: e.currentTarget.value || null })}>
                <option value="">No</option>
                {ESTADOS_REVISION.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      <div class="revision-acciones">
        <button class="btn btn-peq" onClick={() => (alChat ? alChat() : abrirAtleta(f.atleta_id, 'mensajes', null))}><Icono n="mensaje" /> Chat</button>
        <button class={`btn btn-peq ${sinProgramar ? 'rev-falta' : ''}`} title={sinProgramar ? 'Le falta la semana que viene' : undefined} onClick={() => (f.servicio === 'nutricion' || !f.bloque?.id ? abrirAtleta(f.atleta_id, 'programa', null) : programarAqui())}><Icono n="semana" /> Programar</button>
        <button class="btn btn-peq" onClick={() => abrirAtleta(f.atleta_id, 'seguimiento', null)}><Icono n="progreso" /> Seguimiento</button>
        {/* (054) el mensaje de repaso, ya redactado con sus datos; y una tarea, sin salir de aquí */}
        <button class="btn btn-peq" onClick={() => setHoja('mensaje')}><Icono n="editar" /> Redactar mensaje</button>
        <button class="btn btn-peq" onClick={() => setHoja('tarea')}><Icono n="hecho" /> Mandar una tarea</button>
        {/* (079) las fotos de sus platos de la semana */}
        {platos > 0 && <button class="btn btn-peq" onClick={() => setHoja('platos')}><Icono n="camara" /> {platos === 1 ? '1 plato' : `${platos} platos`}</button>}
      </div>
      {hoja === 'platos' && <HojaPlatosSemana atleta={{ id: f.atleta_id, nombre: f.nombre }} lunes={lunes} alCerrar={() => setHoja(null)} />}
      {hoja === 'mensaje' && <HojaBorrador f={f} lunes={lunes} alCerrar={() => setHoja(null)} frases={frases} alFrases={alFrases} alEnviado={(marcar) => { olvidarDetalle(f.atleta_id); alCambiar?.({ escritos: (f.escritos || 0) + 1 }); if (marcar && con040) guardar({ hecha: true }); }} />}
      {hoja === 'tarea-nota' && <HojaNuevaTarea atleta={{ id: f.atleta_id, nombre: f.nombre }} inicial={{ tipo: 'texto', titulo: nota.trim().slice(0, 80), detalle: nota.trim().length > 80 ? nota.trim() : '' }} alCerrar={() => setHoja(null)} />}
      {hoja === 'programar' && <HojaProgramar f={f} modo={prog.modo} ejercicio={prog.ejercicio} abrirAtleta={abrirAtleta} alCerrar={() => { setHoja(null); alCambiar?.({}); }}
        lado={ancha && lunes ? <><button type="button" class="btn-texto mini" onClick={() => abrirAtleta(f.atleta_id, 'programa', null)}>Abrir en su ficha</button>{f.nota && <p class="peq rev-tu-nota"><span><strong>Tu nota:</strong> {f.nota}</span></p>}<DetalleRevision f={f} lunes={lunes} abrirAtleta={abrirAtleta} compacto /></> : <button type="button" class="btn-texto mini" onClick={() => abrirAtleta(f.atleta_id, 'programa', null)}>Abrir en su ficha</button>} />}
      {hoja === 'tarea' && <HojaNuevaTarea atleta={{ id: f.atleta_id, nombre: f.nombre }} alCerrar={() => setHoja(null)} />}
    </li>
  );
}
