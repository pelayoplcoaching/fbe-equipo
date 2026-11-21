import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CabCoach } from './CabCoach.jsx';
import { useApp, useCarga, Siluetas, Vacio, Avatar, Icono, CabeceraGrande, ErrorCaja } from '../comunes.jsx';
import { fechaMadrid, desdeISO } from '../../logica/fechas.js';
import { contactosPorAtleta, programadosPorAtleta, radar, textoResumenRadar, textoContacto, cuandoFue, cuandoSale,
  leerLocal, marcarHablado, posponer, NOMBRE_GRUPO_RADAR, objetivoPrincipal, limpiarEstilo, ESTILO_DEFECTO, normalFrase,
  limpiarAjustesRadar, objetivoDe, juntarLocal, conHablado, conPospuesto, conEnvio, tonoQueContesta, horaHabitual,
  historiaContacto, cumplimientoContacto, NOMBRE_CANAL, NOMBRE_SITUACION } from '../../logica/radar/index.js';
import { datosRadar, recordsRecientes, abrirRadar } from '../../datos/radar.js';
import { Borrador, BorradorOtro, HojaEstilo } from './RadarBorrador.jsx';

const almacen = () => { try { return window.localStorage; } catch { return null; } };
const uuid = () => globalThis.crypto?.randomUUID?.() || `radar-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
const FILTROS = ['hoy', 'pronto', 'al_dia', 'pospuesto', 'todos', 'invitado', 'pausado', 'antiguo'];
const NOMBRE_OTRO = { invitado: 'Sin activar', pausado: 'En pausa', antiguo: 'Antiguos' };
// El hito que ya sale como tema no se repite como chip
const HITO_MOTIVO = { cumple: 'cumple', aniversario: 'aniversario', bloque: 'fin_bloque', carrera: 'carrera_antes', pausa: 'vuelta_pausa' };
// (v0.201) Tu manera de escribir, en este aparato si la base aún no tiene la 086 (v0.202: con ella, todo lo tuyo va a la base)
const claveEstilo = (uid) => `fbe-radar-estilo-${uid || 'x'}`;
const estiloLocal = (uid) => { try { return limpiarEstilo(JSON.parse(almacen()?.getItem(claveEstilo(uid)) || 'null')); } catch { return { ...ESTILO_DEFECTO }; } };
const enOrdenador = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

// «A quién escribir»: el contacto personal del coach con cada atleta (días con un mensaje solo para él en los últimos 7,
// sin contar difusiones), a quién toca escribir hoy y por qué, y un borrador que se edita y se envía desde aquí, se
// programa o se deja en su chat. La lógica está en logica/radar (LEEME.md).
// (v0.201) Más de cada atleta, lo pendiente de hablar, mensajes en cuatro tonos, tus respuestas, tu manera de escribir,
// programar y la ronda con los de Hoy.
// (v0.202) Tu objetivo y tu tono con cada uno, «Ya hablamos» y «Mañana» en todos tus aparatos (con la 086) y por dónde,
// si no ha leído tu último mensaje, ronda por tema y cierre del domingo, los que no están activos (sin activar, en pausa,
// antiguos), tu contacto en 8 semanas y el teclado en el ordenador.
//   abrirAtleta(atletaId, pestana, extra): la misma función que usa la revisión semanal para abrir la ficha de un atleta
export function RadarContacto({ abrirAtleta }) {
  const { api, backend, perfil, aviso } = useApp();
  const hoy = useMemo(() => fechaMadrid(), []);
  const res = useCarga(() => datosRadar({ api, backend }, { hoy }), [hoy]);
  const [local, setLocal] = useState(() => leerLocal(almacen(), perfil?.id, hoy));
  const [aj, setAj] = useState(() => limpiarAjustesRadar({ estilo: estiloLocal(perfil?.id) }, hoy));
  const [enBase, setEnBase] = useState(false);     // ¿lo tuyo se guarda en la base (086)?
  const [enviados, setEnviados] = useState([]);   // los mensajes enviados (o programados) desde aquí, para contarlos sin recargar
  const [records, setRecords] = useState({});     // atleta_id → sus récords recientes (se piden al abrir su fila)
  const [abiertos, setAbiertos] = useState({});   // atleta_id → { objetivos, enviados, mesCifras, bloqueCifras } (al abrir su fila)
  const [pend, setPend] = useState({ nuevos: {}, hechos: [] });   // tus pendientes apuntados o hechos desde aquí
  const [abierta, setAbierta] = useState(null);
  const [filtro, setFiltro] = useState('hoy');
  const [verEstilo, setVerEstilo] = useState(false);
  const [ronda, setRonda] = useState(null);       // { ids, i, enviados, saltados, tema } | null
  const [cursor, setCursor] = useState(-1);       // (v0.202) el atleta marcado con el teclado
  const datos = res.datos;

  useEffect(() => {
    let vivo = true;
    api.radarAjustes?.().then((x) => { if (vivo && x) { setAj(x); setEnBase(true); } }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  // Guardar lo tuyo: en la base si está la 086 (lo que cambia), y lo de «Ya hablamos» y «Mañana» también en el aparato.
  // (siempre sobre lo último, aunque lo llame un «Deshacer» de antes)
  // (de uno en uno y en orden: «Ya hablamos» y su «Deshacer» seguidos no se pisan)
  const ajRef = useRef(aj); ajRef.current = aj;
  const cola = useRef(Promise.resolve());
  const guardarAj = (nuevo, cambios) => {
    ajRef.current = nuevo;
    setAj(nuevo);
    if (!enBase) return;
    cola.current = cola.current.then(() => api.guardarRadarAjustes?.(cambios)).catch((e) => aviso(e?.message || 'No se ha podido guardar en la base: se queda en este dispositivo', 'error'));
  };

  const x = useMemo(() => {
    if (!datos) return null;
    const todos = [...datos.comentarios, ...enviados];
    const junto = juntarLocal(local, aj);
    const contactos = contactosPorAtleta(todos, { hoy, fuera: junto.fuera });
    const extra = {};
    for (const [id, e] of Object.entries(datos.extra || {})) {
      const propios = [...(e.pendientes || []), ...(pend.nuevos[id] || [])].filter((p) => !pend.hechos.includes(p.id));
      const ab = abiertos[id];
      extra[id] = { ...e, pendientes: propios, objetivo: ab ? objetivoPrincipal(ab.objetivos) : null, enlace: aj.enlace,
        mesCifras: ab?.mesCifras || null, bloqueCifras: ab?.bloqueCifras || null };
    }
    const r = radar({ resumenes: datos.resumenes, contactos, sesiones: datos.sesiones, checkins: datos.checkins, records, pospuestos: junto.pospuestos, hoy, extra,
      programados: programadosPorAtleta(todos), objetivoDe: (id) => objetivoDe(aj, id), extraOtros: datos.otros || {}, reenganche: aj.reenganche });
    const historia = historiaContacto(todos, { hoy, fuera: junto.fuera });
    return { ...r, canales: junto.canales, historia, grafica: cumplimientoContacto(historia, r.filas.map((f) => f.atleta_id), (id) => objetivoDe(aj, id), { hoy }) };
  }, [datos, enviados, local, aj, records, abiertos, pend, hoy]);

  const abrir = (f, forzar = false) => {
    const id = !forzar && abierta === f.atleta_id ? null : f.atleta_id;
    setAbierta(id);
    if (!id || !f.motivos) return;
    if (!(id in records) && f.servicio !== 'nutricion' && f.estado !== 'invitado' && f.grupo !== 'antiguo') {
      setRecords((r) => ({ ...r, [id]: [] }));
      recordsRecientes({ api }, id, { hoy }).then((lista) => setRecords((r) => ({ ...r, [id]: lista }))).catch(() => {});
    }
    if (!(id in abiertos)) {
      setAbiertos((a) => ({ ...a, [id]: { objetivos: [], enviados: [] } }));
      const mes = f.motivos.some((m) => m.id === 'mes');
      const bloqueId = f.motivos.some((m) => m.id === 'fin_bloque') ? f.resumen?.bloque?.id || null : null;
      abrirRadar({ api, backend }, id, { hoy, mes, bloqueId }).then((d) => setAbiertos((a) => ({ ...a, [id]: d }))).catch(() => {});
    }
  };
  // En la ronda, lo hecho con uno pasa al siguiente
  const siguiente = (que) => setRonda((r) => (r ? { ...r, i: r.i + 1, enviados: r.enviados + (que === 'enviado' ? 1 : 0), saltados: r.saltados + (que === 'saltado' ? 1 : 0) } : r));
  const hablado = (f, si, canal = 'app') => {
    setLocal(marcarHablado(almacen(), perfil?.id, f.atleta_id, hoy, si));
    const n = conHablado(ajRef.current, f.atleta_id, hoy, si, canal);
    guardarAj(n, { hablado: n.hablado, pospuestos: n.pospuestos });
    if (si) {
      if (ronda) siguiente('hecho'); else setAbierta(null);
      aviso(`Apuntado: hoy has hablado con ${f.primerNombre}${canal !== 'app' ? ` (${NOMBRE_CANAL[canal].toLowerCase()})` : ''}`, 'ok', { texto: 'Deshacer', fn: () => hablado(f, false) });
    }
  };
  const dejar = (f, dias) => {
    setLocal(posponer(almacen(), perfil?.id, f.atleta_id, hoy, dias));
    const n = conPospuesto(ajRef.current, f.atleta_id, hoy, dias);
    guardarAj(n, { pospuestos: n.pospuestos });
    if (dias > 0) { if (ronda) siguiente('saltado'); else setAbierta(null); }
  };
  const alEnviar = (f, { enviarEn = null, texto = '', tono = null } = {}) => {
    setEnviados((l) => [...l, { id: `radar-${uuid()}`, atleta_id: f.atleta_id, autor: 'coach', creado_en: new Date().toISOString(), enviar_en: enviarEn }]);
    // (lo enviado cuenta ya para no repetírselo)
    if (texto) setAbiertos((a) => ({ ...a, [f.atleta_id]: { ...(a[f.atleta_id] || { objetivos: [] }), enviados: [normalFrase(texto), ...(a[f.atleta_id]?.enviados || [])] } }));
    // (y su tono, para saber con cuál te contesta más)
    if (tono) { const n = conEnvio(ajRef.current, { atleta: f.atleta_id, tono }); guardarAj(n, { envios: n.envios }); }
    if (ronda) siguiente('enviado'); else setAbierta(null);
  };
  const alPendiente = (f, cambio) => setPend((p) => (cambio.hecho
    ? { ...p, hechos: [...p.hechos, cambio.hecho] }
    : { ...p, nuevos: { ...p.nuevos, [f.atleta_id]: [...(p.nuevos[f.atleta_id] || []), cambio.nuevo] } }));
  // Lo de cada atleta (objetivo y tono) y lo de los antiguos («ya le escribí»)
  const ponerObjetivo = (f, n) => { const a = ajRef.current, o = { ...a.objetivos }; if (n === 2) delete o[f.atleta_id]; else o[f.atleta_id] = n; guardarAj({ ...a, objetivos: o }, { objetivos: o }); };
  const ponerTono = (f, t) => { const a = ajRef.current, o = { ...a.tonos }; if (!t) delete o[f.atleta_id]; else o[f.atleta_id] = t; guardarAj({ ...a, tonos: o }, { tonos: o }); };
  const yaEscrito = (f) => { const a = ajRef.current, o = { ...a.reenganche, [f.atleta_id]: hoy }; guardarAj({ ...a, reenganche: o }, { reenganche: o }); aviso(`Apuntado: ya le escribiste a ${f.primerNombre}`, 'ok'); };
  const guardarEstilo = async ({ estilo, enlace }) => {
    const l = limpiarEstilo(estilo);
    setVerEstilo(false);
    const n = limpiarAjustesRadar({ ...aj, estilo: l, enlace }, hoy);
    setAj(n);
    let ok = false;
    try { ok = !!(enBase ? await api.guardarRadarAjustes?.({ estilo: l, enlace: n.enlace }) : await api.guardarEstiloRadar?.(l)); } catch (err) { aviso(err?.message || 'No se ha podido guardar', 'error'); return; }
    if (!ok) { try { almacen()?.setItem(claveEstilo(perfil?.id), JSON.stringify(l)); } catch { /* sin almacenamiento: vale mientras esté abierta */ } }
    aviso(ok ? 'Guardado: así saldrán tus borradores (en el móvil y en el ordenador)' : 'Guardado en este dispositivo', 'ok');
  };

  const cuenta = x?.cuenta || {};
  const filas = x?.filas || [];
  const otros = x?.otros || { invitado: [], pausado: [], antiguo: [] };
  const filtros = FILTROS.filter((k) => (k === 'pospuesto' ? cuenta.pospuesto > 0 : NOMBRE_OTRO[k] ? otros[k].length > 0 : true));
  const actual = filtros.includes(filtro) ? filtro : 'hoy';
  const esOtro = !!NOMBRE_OTRO[actual];
  const vista = esOtro ? otros[actual] : filas.filter((f) => actual === 'todos' || f.grupo === actual);
  const deHoy = filas.filter((f) => f.grupo === 'hoy');
  // (v0.202) Ronda por tema: los que tienen ese motivo (y el domingo, el cierre de la semana)
  const temas = useMemo(() => {
    const n = {};
    for (const f of filas) for (const m of f.motivos) if (!['saludo', 'responder', 'pendiente_mio', 'recordatorio', 'fiestas'].includes(m.id)) n[m.id] = (n[m.id] || 0) + 1;
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([id, k]) => [id, k]);
  }, [filas]);
  const domingo = desdeISO(hoy).getDay() === 0;
  const deCierre = domingo ? filas.filter((f) => f.motivos.some((m) => m.id === 'semana_completa' || m.id === 'semana_corta')) : [];
  const empezarRonda = (ids, tema = null) => {
    if (!ids.length) return;
    setFiltro('hoy');
    setRonda({ ids, i: 0, enviados: 0, saltados: 0, tema });
  };
  const enRonda = ronda && ronda.i < ronda.ids.length ? filas.find((f) => f.atleta_id === ronda.ids[ronda.i]) || null : null;
  // Al pasar al siguiente de la ronda, se abre su borrador (con sus récords y objetivos)
  useEffect(() => { if (enRonda) abrir(enRonda, true); }, [ronda?.i, ronda?.ids?.length]);
  const terminarRonda = () => { setRonda(null); setAbierta(null); };

  // (v0.202) El teclado en el ordenador: ↑ ↓ para moverse, E para escribirle, Escape para cerrar (Ctrl+Intro envía en el borrador)
  const vistaRef = useRef(vista); vistaRef.current = vista;
  const estado = useRef({}); estado.current = { cursor, abierta, ronda };
  useEffect(() => {
    const tecla = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target, escribe = t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
      if (document.querySelector('.hoja-dialogo, [role=dialog]') || estado.current.ronda) return;
      const xs = vistaRef.current || [];
      if (e.key === 'Escape' && estado.current.abierta) { e.preventDefault(); setAbierta(null); return; }
      if (escribe || !xs.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = Math.max(0, Math.min(xs.length - 1, estado.current.cursor + (e.key === 'ArrowDown' ? 1 : -1)));
        setCursor(n);
        requestAnimationFrame(() => document.querySelector(`[data-radar-fila="${xs[n].atleta_id}"]`)?.scrollIntoView({ block: 'nearest' }));
      } else if ((e.key === 'e' || e.key === 'E') && estado.current.cursor >= 0 && xs[estado.current.cursor]) {
        e.preventDefault();
        abrir(xs[estado.current.cursor]);
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [datos, aj, records, abiertos]);
  useEffect(() => { setCursor(-1); }, [actual]);

  const propsFila = (f) => ({
    f, hoy, abierta: abierta === f.atleta_id, alAbrir: () => abrir(f), abrirAtleta, estilo: aj.estilo, abierto: abiertos[f.atleta_id], alPendiente: (c) => alPendiente(f, c),
    alHablado: (si, canal) => hablado(f, si, canal), alDejar: (d) => dejar(f, d), alEnviar: (o) => alEnviar(f, o), canalHoy: x?.canales?.[f.atleta_id]?.[hoy] || null,
    objetivo: objetivoDe(aj, f.atleta_id), alObjetivo: (n) => ponerObjetivo(f, n), tono: aj.tonos[f.atleta_id] || null, alTono: (t) => ponerTono(f, t),
    tonoContesta: datos ? tonoQueContesta(aj.envios, datos.comentarios, f.atleta_id) : null, hora: datos ? horaHabitual(datos.comentarios, f.atleta_id) : null,
    historia: x?.historia?.[f.atleta_id] || null,
  });

  return (
    <div class="contenido coach revision radar">
      <CabeceraGrande>
        <div class="titulo"><h1>A quién escribir</h1>{x && <div class="sub">{x.variosObjetivos ? 'Con el objetivo de contacto de cada atleta' : `Objetivo: ${x.objetivo} días de contacto por semana con cada atleta`}</div>}</div>
      </CabeceraGrande>
      {/* (imágenes, bloque S) el faro: que nadie se quede sin noticias tuyas */}
      <CabCoach id="coach-radar" titulo="Que nadie se quede a oscuras"><span class="peq">Primero, quien lleva más días sin saber de ti. Un mensaje corto basta.</span></CabCoach>
      {res.cargando && !datos ? <Siluetas forma="lista" n={6} texto="Cargando el contacto con tus atletas" /> : res.error ? (
        <ErrorCaja error={res.error} reintentar={() => res.recargar()} />
      ) : !filas.length && !otros.invitado.length && !otros.pausado.length ? (
        <div class="panel"><Vacio ilustracion="atletas" titulo="Aún no tienes atletas activos">Cuando alguien active su cuenta, saldrá aquí con el contacto que lleváis.</Vacio></div>
      ) : ronda ? (
        <div class="pila">
          <div class="panel panel-pad rad-ronda" role="status">
            {enRonda ? (
              <>
                <div class="fila-entre"><strong>Ronda{ronda.tema ? ` (${ronda.tema === 'cierre' ? 'cierre de semana' : (NOMBRE_SITUACION[ronda.tema] || ronda.tema).toLowerCase()})` : ''}: {ronda.i + 1} de {ronda.ids.length}</strong><span class="peq secundario">{ronda.enviados} {ronda.enviados === 1 ? 'enviado' : 'enviados'}</span></div>
                <div class="barra-revision" role="progressbar" aria-label="Ronda de mensajes" aria-valuemin="0" aria-valuemax={ronda.ids.length} aria-valuenow={ronda.i}><span style={{ width: `${Math.round((ronda.i / ronda.ids.length) * 100)}%` }} /></div>
                <div class="revision-acciones">
                  <button class="btn btn-peq" onClick={() => siguiente('saltado')}>Saltar</button>
                  <button class="btn btn-peq" onClick={terminarRonda}>Terminar la ronda</button>
                </div>
              </>
            ) : (
              <>
                <strong>Ronda terminada</strong>
                <p class="peq secundario" style={{ margin: 0 }}>{ronda.enviados} {ronda.enviados === 1 ? 'mensaje enviado' : 'mensajes enviados'}{ronda.saltados ? `, ${ronda.saltados} ${ronda.saltados === 1 ? 'saltado' : 'saltados'}` : ''}.</p>
                <div class="revision-acciones"><button class="btn btn-peq btn-primario" onClick={terminarRonda}>Volver a la lista</button></div>
              </>
            )}
          </div>
          {enRonda && (
            <ul class="revision-lista" aria-label="Atleta de la ronda">
              <FilaRadar key={enRonda.atleta_id} {...propsFila(enRonda)} conGrupo temaInicial={ronda.tema} />
            </ul>
          )}
        </div>
      ) : (
        <div class="pila">
          <div class="panel panel-pad revision-progreso">
            <div class="fila-entre"><strong>{textoResumenRadar(x)}</strong>{x.resumen.cumplen === x.resumen.atletas && x.resumen.atletas > 0 && <span class="chip ok"><Icono n="hecho" /> Todos al día</span>}</div>
            <div class="barra-revision" role="progressbar" aria-label="Atletas con el contacto al día" aria-valuemin="0" aria-valuemax={x.resumen.atletas} aria-valuenow={x.resumen.cumplen}><span style={{ width: `${x.resumen.atletas ? Math.round((x.resumen.cumplen / x.resumen.atletas) * 100) : 0}%` }} /></div>
            <div class="revision-acciones rad-cab-acciones">
              {deHoy.length > 0 && <button class="btn btn-peq btn-primario" onClick={() => empezarRonda(deHoy.map((f) => f.atleta_id))}><Icono n="play" /> Escribir a los de Hoy ({deHoy.length})</button>}
              {deCierre.length > 0 && <button class="btn btn-peq" onClick={() => empezarRonda(deCierre.map((f) => f.atleta_id), 'cierre')}><Icono n="calendario" /> Cierre de semana ({deCierre.length})</button>}
              <button class="btn btn-peq" onClick={() => setVerEstilo(true)}><Icono n="ajustes" /> Tu manera de escribir</button>
            </div>
            {temas.length > 0 && (
              <div class="fila-envolver rad-ronda-tema">
                <label class="peq secundario" for="rad-ronda-tema">Ronda por tema</label>
                <select id="rad-ronda-tema" value="" onChange={(e) => { const t = e.currentTarget.value; if (t) empezarRonda(filas.filter((f) => f.motivos.some((m) => m.id === t)).map((f) => f.atleta_id), t); }}>
                  <option value="">Elige un tema…</option>
                  {temas.map(([id, n]) => <option key={id} value={id}>{NOMBRE_SITUACION[id] || id} ({n})</option>)}
                </select>
              </div>
            )}
            <GraficaContacto x={x} />
            <details class="peq secundario">
              <summary>Cómo se cuenta</summary>
              <p style={{ margin: '8px 0 0' }}>Un contacto es un día en que le escribes algo solo a él: chat, nota de voz o un comentario en una sesión, un vídeo o un check-in. Varios mensajes el mismo día son un contacto, y las difusiones no cuentan. «Hoy» salen quienes van por debajo de su objetivo y no han sabido de ti ni hoy ni ayer, quien te escribió y tiene el último mensaje, quien apuntó una molestia fuerte o llegó en un día difícil y aún no habéis hablado, y quien tiene hoy algo especial (su cumpleaños, una carrera, la vuelta de una pausa, sus primeros días o un tema que te apuntaste). Si no ha leído tu último mensaje o tienes uno programado, pasa a «En unos días». {enBase ? '«Ya hablamos» y «Mañana» valen en todos tus dispositivos.' : '«Ya hablamos» y «Mañana» se guardan solo en este dispositivo.'}</p>
            </details>
            {enOrdenador() && <p class="mini terciario rad-atajos" style={{ margin: 0 }}>Con el teclado: ↑ ↓ para moverte, E para escribirle, Ctrl+Intro para enviar y Escape para cerrar.</p>}
          </div>
          <div class="selector-chips" role="group" aria-label="Qué ver">
            {filtros.map((k) => (
              <button key={k} aria-pressed={actual === k ? 'true' : 'false'} onClick={() => { setFiltro(k); setAbierta(null); }}>
                {k === 'todos' ? `Todos (${filas.length})` : NOMBRE_OTRO[k] ? `${NOMBRE_OTRO[k]} (${otros[k].length})` : `${NOMBRE_GRUPO_RADAR[k]} (${cuenta[k] || 0})`}
              </button>
            ))}
          </div>
          {!vista.length ? (
            <div class="panel"><Vacio icono="hecho" ilustracion={actual === 'hoy' ? 'todo' : null} titulo={actual === 'hoy' ? 'Hoy no le debes un mensaje a nadie' : 'Nadie aquí'}>{actual === 'hoy' ? 'Todos han sabido de ti hace poco o ya van al día esta semana.' : 'Cambia de vista para ver al resto.'}</Vacio></div>
          ) : esOtro ? (
            <ul class="revision-lista" aria-label={NOMBRE_OTRO[actual]}>
              {vista.map((f, i) => <FilaOtro key={f.atleta_id} f={f} hoy={hoy} abierta={abierta === f.atleta_id} cursor={cursor === i} alAbrir={() => abrir(f)} estilo={aj.estilo}
                alEnviar={(o) => alEnviar(f, o)} alYaEscrito={() => yaEscrito(f)} />)}
            </ul>
          ) : (
            <ul class="revision-lista" aria-label="Atletas">
              {vista.map((f, i) => <FilaRadar key={f.atleta_id} {...propsFila(f)} conGrupo={actual === 'todos'} cursor={cursor === i} />)}
            </ul>
          )}
        </div>
      )}
      {verEstilo && <HojaEstilo estilo={aj.estilo} enlace={aj.enlace} enBase={enBase} alGuardar={guardarEstilo} alCerrar={() => setVerEstilo(false)} />}
    </div>
  );
}

// (v0.202) Tu contacto en 8 semanas: qué parte de tus atletas llegó a su objetivo cada semana, y a quién se te escapa más
function GraficaContacto({ x }) {
  const g = x?.grafica || [];
  if (!g.length || !x.filas.length) return null;
  const escapan = x.filas.map((f) => ({ f, dias: (x.historia[f.atleta_id] || []).reduce((a, b) => a + b, 0), objetivo: f.objetivo }))
    .map((e) => ({ ...e, falta: e.objetivo * g.length - e.dias })).filter((e) => e.falta > 0).sort((a, b) => b.falta - a.falta).slice(0, 3);
  const W = 320, H = 96, bw = W / g.length;
  return (
    <details class="rad-grafica">
      <summary class="peq">Tu contacto en 8 semanas</summary>
      <figure class="rad-grafica-fig">
        <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`Atletas al día con su objetivo, semana a semana: ${g.map((s) => `${s.pct} %`).join(', ')}`}>
          {g.map((s, i) => {
            const h = Math.max(2, Math.round((s.pct / 100) * H));
            return (
              <g key={i}>
                <rect class={`rad-barra ${i === g.length - 1 ? 'actual' : ''}`} x={i * bw + 6} y={H - h} width={bw - 12} height={h} rx="3" />
                <text class="rad-barra-txt" x={i * bw + bw / 2} y={H + 13} text-anchor="middle">{s.pct}%</text>
              </g>
            );
          })}
        </svg>
        <figcaption class="mini terciario">De cada semana (la última es la actual), qué parte de tus atletas tuvo los días de contacto de su objetivo.</figcaption>
      </figure>
      {escapan.length > 0 && (
        <div class="pila-xs">
          <span class="peq">Se te escapan más</span>
          <ul class="rad-escapan">{escapan.map((e) => <li key={e.f.atleta_id} class="peq">{e.f.nombre}: {e.dias} {e.dias === 1 ? 'día' : 'días'} de contacto en 8 semanas (su objetivo, {e.objetivo} por semana)</li>)}</ul>
        </div>
      )}
    </details>
  );
}

// Los días de contacto de los últimos 7 frente al objetivo, como cuadritos
function Pips({ n, objetivo }) {
  const total = Math.max(objetivo, Math.min(n, 5));
  return (
    <span class="mini-grafica pips" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => <i key={i} class={i < n ? 'pip-lleno' : 'pip-vacio'} />)}
    </span>
  );
}

function FilaRadar(p) {
  const { f, hoy, abierta, conGrupo, alAbrir, alHablado, alDejar, cursor = false, canalHoy } = p;
  const c = f.contacto;
  const habladoHoy = c.fuera.includes(hoy);
  const [verCanal, setVerCanal] = useState(false);
  // Los chips: lo que pasa, sin repetir lo que ya se dice aparte (te escribió, lo pendiente se cuenta)
  const chips = f.motivos.filter((m) => !['saludo', 'responder', 'enfriando'].includes(m.id) && m.grupo !== 'pendiente').slice(0, 3);
  const nPend = f.pendientes.filter((m) => m.grupo === 'pendiente' && m.id !== 'responder').length;
  const idPanel = `radar-${f.atleta_id}`;
  const canal = (k) => { setVerCanal(false); alHablado(true, k); };
  return (
    <li class={`panel revision-fila ${f.grupo === 'al_dia' ? 'hecha' : ''} ${cursor ? 'rev-cursor' : ''}`} data-radar-fila={f.atleta_id}>
      <div class="revision-cab">
        <Avatar nombre={f.nombre} foto={f.foto} />
        <div class="pila-xs revision-quien">
          <strong>{f.nombre}</strong>
          <span class="peq secundario">{textoContacto(c, { objetivo: f.objetivo })}</span>
          <span class="mini terciario">4 últimas semanas: {c.semanas.join(' · ')}</span>
        </div>
        <Pips n={c.en7} objetivo={f.objetivo} />
      </div>
      {/* (v0.201) lo que te escribió, a la vista */}
      {f.mensajeAtleta?.texto && (
        <blockquote class="rad-cita">
          <span class="mini terciario">Te escribió {cuandoFue(f.mensajeAtleta.dia, hoy)}:</span>
          <span class="rad-cita-texto">{f.mensajeAtleta.texto}</span>
        </blockquote>
      )}
      <ul class="revision-avisos" aria-label={`Lo que pasa con ${f.primerNombre}`}>
        {conGrupo && <li class={`chip ${f.grupo === 'hoy' ? 'morado' : f.grupo === 'al_dia' ? 'ok' : 'info'}`}>{NOMBRE_GRUPO_RADAR[f.grupo]}</li>}
        {f.teEscribio && !f.mensajeAtleta?.texto && <li class="chip morado">Te escribió {cuandoFue(f.teEscribio.dia, hoy)}</li>}
        {f.sinLeer && <li class="chip info">No ha leído tu último mensaje</li>}
        {f.programado && <li class="chip info"><Icono n="reloj" /> Programado: {cuandoSale(f.programado.enviar_en, hoy)}</li>}
        {habladoHoy && canalHoy && canalHoy !== 'app' && <li class="chip ok">Hablasteis hoy: {NOMBRE_CANAL[canalHoy]}</li>}
        {f.enfriando && <li class="chip aviso">Se está enfriando</li>}
        {nPend > 0 && <li class="chip morado">{nPend === 1 ? '1 tema pendiente' : `${nPend} temas pendientes`}</li>}
        {f.hito && !f.motivos.some((m) => m.id === HITO_MOTIVO[f.hito.tipo]) && <li class="chip info"><Icono n="calendario" /> {f.hito.texto}</li>}
        {chips.map((m) => <li key={m.clave} class={`chip ${m.nivel}`}>{m.etiqueta}</li>)}
      </ul>
      <p class="peq secundario" style={{ margin: 0 }}>{f.porque}</p>
      <div class="revision-acciones">
        <button class={`btn btn-peq ${f.grupo === 'hoy' && !abierta ? 'btn-primario' : ''}`} aria-expanded={abierta ? 'true' : 'false'} aria-controls={idPanel} onClick={alAbrir}><Icono n="mensaje" /> {abierta ? 'Cerrar' : 'Escribirle'}</button>
        <button class="btn btn-peq" aria-pressed={habladoHoy ? 'true' : 'false'} aria-expanded={!habladoHoy ? (verCanal ? 'true' : 'false') : undefined} onClick={() => (habladoHoy ? alHablado(false) : setVerCanal(!verCanal))}>Ya hablamos</button>
        {f.grupo === 'pospuesto'
          ? <button class="btn btn-peq" onClick={() => alDejar(0)}>Proponer ya</button>
          : <button class="btn btn-peq" onClick={() => alDejar(1)} disabled={f.grupo === 'al_dia'}>Mañana</button>}
      </div>
      {/* (v0.202) por dónde habéis hablado */}
      {verCanal && !habladoHoy && (
        <div class="fila-envolver rad-canal" role="group" aria-label={`Por dónde has hablado hoy con ${f.primerNombre}`}>
          <span class="peq secundario">¿Por dónde?</span>
          {['whatsapp', 'llamada', 'persona', 'app'].map((k) => <button key={k} class="btn btn-peq" onClick={() => canal(k)}>{NOMBRE_CANAL[k]}</button>)}
        </div>
      )}
      {abierta && <Borrador id={idPanel} {...p} />}
    </li>
  );
}

// (v0.202) Quien no está activo: sin activar su cuenta, en pausa o antiguo atleta
function FilaOtro({ f, hoy, abierta, cursor, alAbrir, estilo, alEnviar, alYaEscrito }) {
  const idPanel = `radar-${f.atleta_id}`;
  return (
    <li class={`panel revision-fila ${cursor ? 'rev-cursor' : ''}`} data-radar-fila={f.atleta_id}>
      <div class="revision-cab">
        <Avatar nombre={f.nombre} foto={f.foto} />
        <div class="pila-xs revision-quien">
          <strong>{f.nombre}</strong>
          <span class="peq secundario">{f.porque}</span>
          {f.contacto?.ultimo && <span class="mini terciario">Tu último mensaje: {cuandoFue(f.contacto.ultimo, hoy)}</span>}
        </div>
      </div>
      <div class="revision-acciones">
        <button class={`btn btn-peq ${!abierta ? 'btn-primario' : ''}`} aria-expanded={abierta ? 'true' : 'false'} aria-controls={idPanel} onClick={alAbrir}><Icono n="mensaje" /> {abierta ? 'Cerrar' : 'Escribirle'}</button>
        {f.grupo === 'antiguo' && <button class="btn btn-peq" onClick={alYaEscrito}>Ya le escribí</button>}
      </div>
      {abierta && <BorradorOtro id={idPanel} f={f} hoy={hoy} estilo={estilo} alEnviar={alEnviar} alYaEscrito={alYaEscrito} />}
    </li>
  );
}
