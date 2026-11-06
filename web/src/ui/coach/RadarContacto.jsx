import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Siluetas, Vacio, Avatar, Icono, CabeceraGrande, ErrorCaja } from '../comunes.jsx';
import { fechaMadrid } from '../../logica/fechas.js';
import { leerBorrador, guardarBorrador } from '../../logica/mensajes.js';
import { contactosPorAtleta, radar, textoResumenRadar, textoContacto, borradorDe, varianteInicial, cuantasFrases, cuandoFue,
  leerLocal, marcarHablado, posponer, NOMBRE_GRUPO_RADAR, MAX_BORRADOR } from '../../logica/radar/index.js';
import { datosRadar, recordsRecientes } from '../../datos/radar.js';

const almacen = () => { try { return window.localStorage; } catch { return null; } };
const uuid = () => globalThis.crypto?.randomUUID?.() || `radar-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
const FILTROS = ['hoy', 'pronto', 'al_dia', 'pospuesto', 'todos'];

// «A quién escribir»: el contacto personal del coach con cada atleta (días con un mensaje solo para él en los últimos 7,
// sin contar difusiones), a quién toca escribir hoy y por qué, y un borrador corto que se edita y se envía desde aquí o se
// deja en su chat. Solo lee; lo único que guarda es el mensaje que envías. «Ya hablamos» y «Mañana» se quedan en este
// dispositivo. La lógica está en logica/radar (LEEME.md).
//   abrirAtleta(atletaId, pestana, extra): la misma función que usa la revisión semanal para abrir la ficha de un atleta
export function RadarContacto({ abrirAtleta }) {
  const { api, backend, perfil, aviso } = useApp();
  const hoy = useMemo(() => fechaMadrid(), []);
  const res = useCarga(() => datosRadar({ api, backend }, { hoy }), [hoy]);
  const [local, setLocal] = useState(() => leerLocal(almacen(), perfil?.id, hoy));
  const [enviados, setEnviados] = useState([]);   // los mensajes enviados desde aquí, para contarlos sin recargar
  const [records, setRecords] = useState({});     // atleta_id → sus récords recientes (se piden al abrir su fila)
  const [abierta, setAbierta] = useState(null);
  const [filtro, setFiltro] = useState('hoy');
  const datos = res.datos;

  const x = useMemo(() => {
    if (!datos) return null;
    const contactos = contactosPorAtleta([...datos.comentarios, ...enviados], { hoy, fuera: local.fuera });
    return radar({ resumenes: datos.resumenes, contactos, sesiones: datos.sesiones, checkins: datos.checkins, records, pospuestos: local.pospuestos, hoy });
  }, [datos, enviados, local, records, hoy]);

  const abrir = (f) => {
    const id = abierta === f.atleta_id ? null : f.atleta_id;
    setAbierta(id);
    if (id && !(id in records) && f.servicio !== 'nutricion') {
      setRecords((r) => ({ ...r, [id]: [] }));
      recordsRecientes({ api }, id, { hoy }).then((lista) => setRecords((r) => ({ ...r, [id]: lista }))).catch(() => {});
    }
  };
  const hablado = (f, si) => {
    setLocal(marcarHablado(almacen(), perfil?.id, f.atleta_id, hoy, si));
    if (si) { setAbierta(null); aviso(`Apuntado: hoy has hablado con ${f.primerNombre}`, 'ok', { texto: 'Deshacer', fn: () => setLocal(marcarHablado(almacen(), perfil?.id, f.atleta_id, hoy, false)) }); }
  };
  const dejar = (f, dias) => { setLocal(posponer(almacen(), perfil?.id, f.atleta_id, hoy, dias)); if (dias > 0) setAbierta(null); };
  const alEnviar = (f) => {
    setEnviados((l) => [...l, { id: `radar-${uuid()}`, atleta_id: f.atleta_id, autor: 'coach', creado_en: new Date().toISOString() }]);
    setAbierta(null);
  };

  const cuenta = x?.cuenta || {};
  const filas = x?.filas || [];
  const filtros = FILTROS.filter((k) => k !== 'pospuesto' || cuenta.pospuesto > 0);
  const actual = filtros.includes(filtro) ? filtro : 'hoy';
  const vista = filas.filter((f) => actual === 'todos' || f.grupo === actual);

  return (
    <div class="contenido coach revision radar">
      <CabeceraGrande>
        <div class="titulo"><h1>A quién escribir</h1>{x && <div class="sub">Objetivo: {x.objetivo} días de contacto por semana con cada atleta</div>}</div>
      </CabeceraGrande>
      {res.cargando && !datos ? <Siluetas forma="lista" n={6} texto="Cargando el contacto con tus atletas" /> : res.error ? (
        <ErrorCaja error={res.error} reintentar={() => res.recargar()} />
      ) : !filas.length ? (
        <div class="panel"><Vacio ilustracion="atletas" titulo="Aún no tienes atletas activos">Cuando alguien active su cuenta, saldrá aquí con el contacto que lleváis.</Vacio></div>
      ) : (
        <div class="pila">
          <div class="panel panel-pad revision-progreso">
            <div class="fila-entre"><strong>{textoResumenRadar(x)}</strong>{x.resumen.cumplen === x.resumen.atletas && <span class="chip ok"><Icono n="hecho" /> Todos al día</span>}</div>
            <div class="barra-revision" role="progressbar" aria-label="Atletas con el contacto al día" aria-valuemin="0" aria-valuemax={x.resumen.atletas} aria-valuenow={x.resumen.cumplen}><span style={{ width: `${Math.round((x.resumen.cumplen / x.resumen.atletas) * 100)}%` }} /></div>
            <details class="peq secundario">
              <summary>Cómo se cuenta</summary>
              <p style={{ margin: '8px 0 0' }}>Un contacto es un día en que le escribes algo solo a él: chat, nota de voz o un comentario en una sesión, un vídeo o un check-in. Varios mensajes el mismo día son un contacto, y las difusiones no cuentan. «Hoy» salen quienes van por debajo del objetivo y no han sabido de ti ni hoy ni ayer, quien te escribió y tiene el último mensaje, y quien apuntó una molestia fuerte o un día difícil sin que hayáis hablado. «Ya hablamos» (un contacto de hoy fuera de la app) y «Mañana» se guardan solo en este dispositivo.</p>
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
                  alHablado={(si) => hablado(f, si)} alDejar={(d) => dejar(f, d)} alEnviar={() => alEnviar(f)} abrirAtleta={abrirAtleta} />
              ))}
            </ul>
          )}
        </div>
      )}
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

function FilaRadar({ f, hoy, abierta, conGrupo, alAbrir, alHablado, alDejar, alEnviar, abrirAtleta }) {
  const c = f.contacto;
  const habladoHoy = c.fuera.includes(hoy);
  const chips = f.motivos.filter((m) => m.id !== 'saludo').slice(0, 3);
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
      <ul class="revision-avisos" aria-label={`Lo que pasa con ${f.primerNombre}`}>
        {conGrupo && <li class={`chip ${f.grupo === 'hoy' ? 'morado' : f.grupo === 'al_dia' ? 'ok' : 'info'}`}>{NOMBRE_GRUPO_RADAR[f.grupo]}</li>}
        {f.teEscribio && <li class="chip morado">Te escribió {cuandoFue(f.teEscribio.dia, hoy)}</li>}
        {chips.map((m) => <li key={m.id} class={`chip ${m.nivel}`}>{m.etiqueta}</li>)}
      </ul>
      <p class="peq secundario" style={{ margin: 0 }}>{f.porque}</p>
      <div class="revision-acciones">
        <button class={`btn btn-peq ${f.grupo === 'hoy' && !abierta ? 'btn-primario' : ''}`} aria-expanded={abierta ? 'true' : 'false'} aria-controls={idPanel} onClick={alAbrir}><Icono n="mensaje" /> {abierta ? 'Cerrar' : 'Escribirle'}</button>
        <button class="btn btn-peq" aria-pressed={habladoHoy ? 'true' : 'false'} onClick={() => alHablado(!habladoHoy)}>Ya hablamos</button>
        {f.grupo === 'pospuesto'
          ? <button class="btn btn-peq" onClick={() => alDejar(0)}>Proponer ya</button>
          : <button class="btn btn-peq" onClick={() => alDejar(1)} disabled={f.grupo === 'al_dia'}>Mañana</button>}
      </div>
      {abierta && <Borrador id={idPanel} f={f} hoy={hoy} alEnviar={alEnviar} abrirAtleta={abrirAtleta} />}
    </li>
  );
}

// El borrador: de qué hablarle (sus motivos), el texto (editable), otra frase, enviar o dejarlo en su chat
function Borrador({ id, f, hoy, alEnviar, abrirAtleta }) {
  const { api, perfil, aviso } = useApp();
  const [motivoId, setMotivoId] = useState(f.motivo?.id || 'saludo');
  const motivo = f.motivos.find((m) => m.id === motivoId) || f.motivos[0];
  const base = useMemo(() => varianteInicial(f.atleta_id, hoy), [f.atleta_id, hoy]);
  const [vuelta, setVuelta] = useState(0);
  const [texto, setTexto] = useState(() => borradorDe(motivo, { hoy, variante: base }));
  const [ocupado, una] = useUnaVez();
  const area = useRef(null);
  const enChat = useMemo(() => leerBorrador(almacen(), perfil?.id, f.atleta_id)?.texto || null, [perfil?.id, f.atleta_id]);
  useEffect(() => { area.current?.focus({ preventScroll: true }); }, []);

  const elegir = (m) => { setMotivoId(m.id); setVuelta(0); setTexto(borradorDe(m, { hoy, variante: base })); };
  const otra = () => { const v = vuelta + 1; setVuelta(v); setTexto(borradorDe(motivo, { hoy, variante: base + v })); };
  const limpio = texto.trim();
  const enviar = () => una(async () => {
    if (!limpio) return;
    try {
      await api.enviarMensaje(f.atleta_id, { texto: limpio, autor: 'coach', clienteId: uuid() });
      aviso(`Mensaje enviado a ${f.primerNombre}`, 'ok');
      alEnviar();
    } catch (e) { aviso(e?.message || 'No se ha podido enviar: vuelve a intentarlo', 'error'); }
  });
  const alChat = () => {
    if (limpio) guardarBorrador(almacen(), perfil?.id, f.atleta_id, limpio);
    abrirAtleta?.(f.atleta_id, 'mensajes', null);
  };
  const idArea = `${id}-texto`;
  return (
    <div id={id} class="pila-s">
      {f.motivos.length > 1 && (
        <div class="selector-chips" role="group" aria-label={`De qué hablarle a ${f.primerNombre}`}>
          {f.motivos.map((m) => <button key={m.id} aria-pressed={m.id === motivo.id ? 'true' : 'false'} onClick={() => elegir(m)}>{m.etiqueta}</button>)}
        </div>
      )}
      <div class="pila-xs revision-nota">
        <label class="peq secundario" for={idArea}>Mensaje para {f.primerNombre} (edítalo a tu gusto)</label>
        <textarea id={idArea} ref={area} rows="3" maxLength={MAX_BORRADOR} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
      </div>
      {enChat && enChat !== limpio && <p class="mini terciario" style={{ margin: 0 }}>En su chat tienes un borrador a medias: «Abrir en su chat» lo cambia por este.</p>}
      <div class="revision-acciones">
        <button class="btn btn-peq btn-primario" onClick={enviar} disabled={ocupado || !limpio}><Icono n="mensaje" /> {ocupado ? 'Enviando…' : 'Enviar'}</button>
        <button class="btn btn-peq" onClick={otra} disabled={cuantasFrases(motivo) < 2}>Otra frase</button>
        <button class="btn btn-peq" onClick={alChat} disabled={!abrirAtleta}>Abrir en su chat</button>
      </div>
    </div>
  );
}
