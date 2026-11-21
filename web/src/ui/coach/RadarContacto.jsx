import { useEffect, useMemo, useState } from 'preact/hooks';
import { CabCoach } from './CabCoach.jsx';
import { useApp, useCarga, Siluetas, Vacio, Avatar, Icono, CabeceraGrande, ErrorCaja } from '../comunes.jsx';
import { fechaMadrid } from '../../logica/fechas.js';
import { contactosPorAtleta, programadosPorAtleta, radar, textoResumenRadar, textoContacto, cuandoFue, cuandoSale,
  leerLocal, marcarHablado, posponer, NOMBRE_GRUPO_RADAR, objetivoPrincipal, limpiarEstilo, ESTILO_DEFECTO, normalFrase } from '../../logica/radar/index.js';
import { datosRadar, recordsRecientes, abrirRadar } from '../../datos/radar.js';
import { Borrador, HojaEstilo } from './RadarBorrador.jsx';

const almacen = () => { try { return window.localStorage; } catch { return null; } };
const uuid = () => globalThis.crypto?.randomUUID?.() || `radar-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
const FILTROS = ['hoy', 'pronto', 'al_dia', 'pospuesto', 'todos'];
// El hito que ya sale como tema no se repite como chip
const HITO_MOTIVO = { cumple: 'cumple', aniversario: 'aniversario', bloque: 'fin_bloque', carrera: 'carrera_antes', pausa: 'vuelta_pausa' };
// (v0.201) Tu manera de escribir, en este aparato si la base aún no tiene la 086
const claveEstilo = (uid) => `fbe-radar-estilo-${uid || 'x'}`;
const estiloLocal = (uid) => { try { return limpiarEstilo(JSON.parse(almacen()?.getItem(claveEstilo(uid)) || 'null')); } catch { return { ...ESTILO_DEFECTO }; } };

// «A quién escribir»: el contacto personal del coach con cada atleta (días con un mensaje solo para él en los últimos 7,
// sin contar difusiones), a quién toca escribir hoy y por qué, y un borrador que se edita y se envía desde aquí, se
// programa o se deja en su chat. «Ya hablamos» y «Mañana» se quedan en este dispositivo. La lógica está en
// logica/radar (LEEME.md).
// (v0.201) Más de cada atleta (lo que te escribió, «Cómo está», lo pendiente de hablar, si se enfría, lo próximo), una
// biblioteca en cuatro tonos con varios temas a la vez, tus respuestas guardadas, tu manera de escribir, programar el
// mensaje y la ronda: los de Hoy, uno detrás de otro.
//   abrirAtleta(atletaId, pestana, extra): la misma función que usa la revisión semanal para abrir la ficha de un atleta
export function RadarContacto({ abrirAtleta }) {
  const { api, backend, perfil, aviso } = useApp();
  const hoy = useMemo(() => fechaMadrid(), []);
  const res = useCarga(() => datosRadar({ api, backend }, { hoy }), [hoy]);
  const [local, setLocal] = useState(() => leerLocal(almacen(), perfil?.id, hoy));
  const [enviados, setEnviados] = useState([]);   // los mensajes enviados (o programados) desde aquí, para contarlos sin recargar
  const [records, setRecords] = useState({});     // atleta_id → sus récords recientes (se piden al abrir su fila)
  const [abiertos, setAbiertos] = useState({});   // atleta_id → { objetivos, enviados } (al abrir su fila)
  const [pend, setPend] = useState({ nuevos: {}, hechos: [] });   // tus pendientes apuntados o hechos desde aquí
  const [abierta, setAbierta] = useState(null);
  const [filtro, setFiltro] = useState('hoy');
  const [estilo, setEstilo] = useState(() => estiloLocal(perfil?.id));
  const [verEstilo, setVerEstilo] = useState(false);
  const [ronda, setRonda] = useState(null);       // { ids, i, enviados, saltados } | null
  const datos = res.datos;

  useEffect(() => {
    let vivo = true;
    api.estiloRadar?.().then((e) => { if (vivo && e) setEstilo(e); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const x = useMemo(() => {
    if (!datos) return null;
    const todos = [...datos.comentarios, ...enviados];
    const contactos = contactosPorAtleta(todos, { hoy, fuera: local.fuera });
    const extra = {};
    for (const [id, e] of Object.entries(datos.extra || {})) {
      const propios = [...(e.pendientes || []), ...(pend.nuevos[id] || [])].filter((p) => !pend.hechos.includes(p.id));
      extra[id] = { ...e, pendientes: propios, objetivo: abiertos[id] ? objetivoPrincipal(abiertos[id].objetivos) : null };
    }
    return radar({ resumenes: datos.resumenes, contactos, sesiones: datos.sesiones, checkins: datos.checkins, records, pospuestos: local.pospuestos, hoy, extra, programados: programadosPorAtleta(todos) });
  }, [datos, enviados, local, records, abiertos, pend, hoy]);

  const abrir = (f, forzar = false) => {
    const id = !forzar && abierta === f.atleta_id ? null : f.atleta_id;
    setAbierta(id);
    if (!id) return;
    if (!(id in records) && f.servicio !== 'nutricion') {
      setRecords((r) => ({ ...r, [id]: [] }));
      recordsRecientes({ api }, id, { hoy }).then((lista) => setRecords((r) => ({ ...r, [id]: lista }))).catch(() => {});
    }
    if (!(id in abiertos)) {
      setAbiertos((a) => ({ ...a, [id]: { objetivos: [], enviados: [] } }));
      abrirRadar({ api, backend }, id, { hoy }).then((d) => setAbiertos((a) => ({ ...a, [id]: d }))).catch(() => {});
    }
  };
  // En la ronda, lo hecho con uno pasa al siguiente
  const siguiente = (que) => setRonda((r) => {
    if (!r) return r;
    const n = { ...r, i: r.i + 1, enviados: r.enviados + (que === 'enviado' ? 1 : 0), saltados: r.saltados + (que === 'saltado' ? 1 : 0) };
    return n;
  });
  const hablado = (f, si) => {
    setLocal(marcarHablado(almacen(), perfil?.id, f.atleta_id, hoy, si));
    if (si) {
      if (ronda) siguiente('hecho'); else setAbierta(null);
      aviso(`Apuntado: hoy has hablado con ${f.primerNombre}`, 'ok', { texto: 'Deshacer', fn: () => setLocal(marcarHablado(almacen(), perfil?.id, f.atleta_id, hoy, false)) });
    }
  };
  const dejar = (f, dias) => {
    setLocal(posponer(almacen(), perfil?.id, f.atleta_id, hoy, dias));
    if (dias > 0) { if (ronda) siguiente('saltado'); else setAbierta(null); }
  };
  const alEnviar = (f, { enviarEn = null, texto = '' } = {}) => {
    setEnviados((l) => [...l, { id: `radar-${uuid()}`, atleta_id: f.atleta_id, autor: 'coach', creado_en: new Date().toISOString(), enviar_en: enviarEn }]);
    // (lo enviado cuenta ya para no repetírselo)
    if (texto) setAbiertos((a) => ({ ...a, [f.atleta_id]: { objetivos: a[f.atleta_id]?.objetivos || [], enviados: [normalFrase(texto), ...(a[f.atleta_id]?.enviados || [])] } }));
    if (ronda) siguiente('enviado'); else setAbierta(null);
  };
  const alPendiente = (f, cambio) => setPend((p) => (cambio.hecho
    ? { ...p, hechos: [...p.hechos, cambio.hecho] }
    : { ...p, nuevos: { ...p.nuevos, [f.atleta_id]: [...(p.nuevos[f.atleta_id] || []), cambio.nuevo] } }));
  const guardarEstilo = async (e) => {
    const l = limpiarEstilo(e);
    setEstilo(l);
    setVerEstilo(false);
    let enBase = false;
    try { enBase = !!(await api.guardarEstiloRadar?.(l)); } catch (err) { aviso(err?.message || 'No se ha podido guardar', 'error'); return; }
    if (!enBase) { try { almacen()?.setItem(claveEstilo(perfil?.id), JSON.stringify(l)); } catch { /* sin almacenamiento: vale mientras esté abierta */ } }
    aviso(enBase ? 'Guardado: así saldrán tus borradores (en el móvil y en el ordenador)' : 'Guardado en este dispositivo', 'ok');
  };

  const cuenta = x?.cuenta || {};
  const filas = x?.filas || [];
  const filtros = FILTROS.filter((k) => k !== 'pospuesto' || cuenta.pospuesto > 0);
  const actual = filtros.includes(filtro) ? filtro : 'hoy';
  const vista = filas.filter((f) => actual === 'todos' || f.grupo === actual);
  const deHoy = filas.filter((f) => f.grupo === 'hoy');
  const empezarRonda = () => {
    if (!deHoy.length) return;
    setFiltro('hoy');
    setRonda({ ids: deHoy.map((f) => f.atleta_id), i: 0, enviados: 0, saltados: 0 });
  };
  const enRonda = ronda && ronda.i < ronda.ids.length ? filas.find((f) => f.atleta_id === ronda.ids[ronda.i]) || null : null;
  // Al pasar al siguiente de la ronda, se abre su borrador (con sus récords y objetivos)
  useEffect(() => { if (enRonda) abrir(enRonda, true); }, [ronda?.i, ronda?.ids?.length]);
  const terminarRonda = () => { setRonda(null); setAbierta(null); };

  return (
    <div class="contenido coach revision radar">
      <CabeceraGrande>
        <div class="titulo"><h1>A quién escribir</h1>{x && <div class="sub">Objetivo: {x.objetivo} días de contacto por semana con cada atleta</div>}</div>
      </CabeceraGrande>
      {/* (imágenes, bloque S) el faro: que nadie se quede sin noticias tuyas */}
      <CabCoach id="coach-radar" titulo="Que nadie se quede a oscuras"><span class="peq">Primero, quien lleva más días sin saber de ti. Un mensaje corto basta.</span></CabCoach>
      {res.cargando && !datos ? <Siluetas forma="lista" n={6} texto="Cargando el contacto con tus atletas" /> : res.error ? (
        <ErrorCaja error={res.error} reintentar={() => res.recargar()} />
      ) : !filas.length ? (
        <div class="panel"><Vacio ilustracion="atletas" titulo="Aún no tienes atletas activos">Cuando alguien active su cuenta, saldrá aquí con el contacto que lleváis.</Vacio></div>
      ) : ronda ? (
        <div class="pila">
          <div class="panel panel-pad rad-ronda" role="status">
            {enRonda ? (
              <>
                <div class="fila-entre"><strong>Ronda: {ronda.i + 1} de {ronda.ids.length}</strong><span class="peq secundario">{ronda.enviados} {ronda.enviados === 1 ? 'enviado' : 'enviados'}</span></div>
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
              <FilaRadar key={enRonda.atleta_id} f={enRonda} hoy={hoy} abierta={abierta === enRonda.atleta_id} conGrupo alAbrir={() => abrir(enRonda)}
                alHablado={(si) => hablado(enRonda, si)} alDejar={(d) => dejar(enRonda, d)} alEnviar={(o) => alEnviar(enRonda, o)} abrirAtleta={abrirAtleta}
                estilo={estilo} abierto={abiertos[enRonda.atleta_id]} alPendiente={(c) => alPendiente(enRonda, c)} />
            </ul>
          )}
        </div>
      ) : (
        <div class="pila">
          <div class="panel panel-pad revision-progreso">
            <div class="fila-entre"><strong>{textoResumenRadar(x)}</strong>{x.resumen.cumplen === x.resumen.atletas && <span class="chip ok"><Icono n="hecho" /> Todos al día</span>}</div>
            <div class="barra-revision" role="progressbar" aria-label="Atletas con el contacto al día" aria-valuemin="0" aria-valuemax={x.resumen.atletas} aria-valuenow={x.resumen.cumplen}><span style={{ width: `${Math.round((x.resumen.cumplen / x.resumen.atletas) * 100)}%` }} /></div>
            <div class="revision-acciones rad-cab-acciones">
              {deHoy.length > 0 && <button class="btn btn-peq btn-primario" onClick={empezarRonda}><Icono n="play" /> Escribir a los de Hoy ({deHoy.length})</button>}
              <button class="btn btn-peq" onClick={() => setVerEstilo(true)}><Icono n="ajustes" /> Tu manera de escribir</button>
            </div>
            <details class="peq secundario">
              <summary>Cómo se cuenta</summary>
              <p style={{ margin: '8px 0 0' }}>Un contacto es un día en que le escribes algo solo a él: chat, nota de voz o un comentario en una sesión, un vídeo o un check-in. Varios mensajes el mismo día son un contacto, y las difusiones no cuentan. «Hoy» salen quienes van por debajo del objetivo y no han sabido de ti ni hoy ni ayer, quien te escribió y tiene el último mensaje, quien apuntó una molestia fuerte o llegó en un día difícil y aún no habéis hablado, y quien tiene hoy algo especial (su cumpleaños, una carrera, la vuelta de una pausa o un tema que te apuntaste). Con un mensaje programado, pasa a «En unos días». «Ya hablamos» y «Mañana» se guardan solo en este dispositivo.</p>
            </details>
          </div>
          <div class="selector-chips" role="group" aria-label="Qué ver">
            {filtros.map((k) => (
              <button key={k} aria-pressed={actual === k ? 'true' : 'false'} onClick={() => { setFiltro(k); setAbierta(null); }}>
                {k === 'todos' ? `Todos (${filas.length})` : `${NOMBRE_GRUPO_RADAR[k]} (${cuenta[k] || 0})`}
              </button>
            ))}
          </div>
          {!vista.length ? (
            <div class="panel"><Vacio icono="hecho" ilustracion={actual === 'hoy' ? 'todo' : null} titulo={actual === 'hoy' ? 'Hoy no le debes un mensaje a nadie' : 'Nadie aquí'}>{actual === 'hoy' ? 'Todos han sabido de ti hace poco o ya van al día esta semana.' : 'Cambia de vista para ver al resto.'}</Vacio></div>
          ) : (
            <ul class="revision-lista" aria-label="Atletas">
              {vista.map((f) => (
                <FilaRadar key={f.atleta_id} f={f} hoy={hoy} abierta={abierta === f.atleta_id} conGrupo={actual === 'todos'} alAbrir={() => abrir(f)}
                  alHablado={(si) => hablado(f, si)} alDejar={(d) => dejar(f, d)} alEnviar={(o) => alEnviar(f, o)} abrirAtleta={abrirAtleta}
                  estilo={estilo} abierto={abiertos[f.atleta_id]} alPendiente={(c) => alPendiente(f, c)} />
              ))}
            </ul>
          )}
        </div>
      )}
      {verEstilo && <HojaEstilo estilo={estilo} alGuardar={guardarEstilo} alCerrar={() => setVerEstilo(false)} />}
    </div>
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

function FilaRadar({ f, hoy, abierta, conGrupo, alAbrir, alHablado, alDejar, alEnviar, abrirAtleta, estilo, abierto, alPendiente }) {
  const c = f.contacto;
  const habladoHoy = c.fuera.includes(hoy);
  // Los chips: lo que pasa, sin repetir lo que ya se dice aparte (te escribió, lo pendiente se cuenta)
  const chips = f.motivos.filter((m) => !['saludo', 'responder', 'enfriando'].includes(m.id) && m.grupo !== 'pendiente').slice(0, 3);
  const nPend = f.pendientes.filter((m) => m.grupo === 'pendiente' && m.id !== 'responder').length;
  const idPanel = `radar-${f.atleta_id}`;
  return (
    <li class={`panel revision-fila ${f.grupo === 'al_dia' ? 'hecha' : ''}`}>
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
        {f.programado && <li class="chip info"><Icono n="reloj" /> Programado: {cuandoSale(f.programado.enviar_en, hoy)}</li>}
        {f.enfriando && <li class="chip aviso">Se está enfriando</li>}
        {nPend > 0 && <li class="chip morado">{nPend === 1 ? '1 tema pendiente' : `${nPend} temas pendientes`}</li>}
        {f.hito && !f.motivos.some((m) => m.id === HITO_MOTIVO[f.hito.tipo]) && <li class="chip info"><Icono n="calendario" /> {f.hito.texto}</li>}
        {chips.map((m) => <li key={m.clave} class={`chip ${m.nivel}`}>{m.etiqueta}</li>)}
      </ul>
      <p class="peq secundario" style={{ margin: 0 }}>{f.porque}</p>
      <div class="revision-acciones">
        <button class={`btn btn-peq ${f.grupo === 'hoy' && !abierta ? 'btn-primario' : ''}`} aria-expanded={abierta ? 'true' : 'false'} aria-controls={idPanel} onClick={alAbrir}><Icono n="mensaje" /> {abierta ? 'Cerrar' : 'Escribirle'}</button>
        <button class="btn btn-peq" aria-pressed={habladoHoy ? 'true' : 'false'} onClick={() => alHablado(!habladoHoy)}>Ya hablamos</button>
        {f.grupo === 'pospuesto'
          ? <button class="btn btn-peq" onClick={() => alDejar(0)}>Proponer ya</button>
          : <button class="btn btn-peq" onClick={() => alDejar(1)} disabled={f.grupo === 'al_dia'}>Mañana</button>}
      </div>
      {abierta && <Borrador id={idPanel} f={f} hoy={hoy} alEnviar={alEnviar} abrirAtleta={abrirAtleta} estilo={estilo} abierto={abierto} alPendiente={alPendiente} />}
    </li>
  );
}
