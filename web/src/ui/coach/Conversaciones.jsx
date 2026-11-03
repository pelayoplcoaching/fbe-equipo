import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Fragment } from 'preact';
import { CabeceraGrande, useApp, useCarga, Siluetas, Icono, Avatar, ErrorCaja, Vacio, Hoja, cuando } from '../comunes.jsx';
import { Chat } from '../Chat.jsx';
import { BandaDemo } from '../App.jsx';
import { ordenarConversaciones, filtrarConversaciones, vistaPrevia, leerBorrador, resaltar, normalLetras } from '../../logica/mensajes.js';
import { silenciado, textoSilencio } from '../../logica/chat.js';
import { conTransicion } from '../transiciones.js';
import { HojaDifusion } from './Difusion.jsx';
import { HojaSilenciar } from '../chat/InfoContacto.jsx';
import { cacheChat } from '../../datos/cacheChat.js';

// Mensajes del coach (v0.18): una conversación por atleta, como la lista de chats de WhatsApp.
// v0.54, más WhatsApp: fijar (3), archivar (con su fila «Archivados» arriba; un mensaje nuevo del atleta la saca),
// «Marcar como no leído», los filtros «Todos / No leídos / Fijados», buscar por nombre y en el texto de los mensajes, y
// en cada fila la foto, el nombre, la hora, el último mensaje (con ✓/✓✓ en lo tuyo y «📷 Foto»), lo sin leer,
// «escribiendo…» y «Borrador: …». Lo de fijar, archivar y «no leído» se guarda en la base (conversacion_estado: solo
// lo ve el coach).
// v0.55: el chat entra y sale deslizándose desde la derecha (en el móvil), 🔇 en las silenciadas (y «Silenciar» en sus
// opciones), «Nuevo mensaje de difusión» y, al tocar una notificación, se abre esa conversación.
const FILTROS = [['todos', 'Todos'], ['no-leidos', 'No leídos'], ['fijados', 'Fijados']];
const almacen = () => { try { return window.localStorage; } catch { return null; } };

export function Conversaciones({ abrirAtleta, alCambiar, peticion = null }) {
  const { api, perfil, aviso } = useApp();
  const lista = useCarga(() => api.conversaciones(), []);
  const [abierta, setAbierta] = useState(null); // { atleta, saltarA }
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [archivadas, setArchivadas] = useState(false);
  const [opciones, setOpciones] = useState(null); // la fila con su hoja de opciones
  const [vuelta, setVuelta] = useState(0);        // para releer los borradores al volver de un chat
  const [difusion, setDifusion] = useState(false);
  const [silenciar, setSilenciar] = useState(null); // la fila a silenciar (elegir cuánto)
  const silencios = useCarga(() => api.silencios(), [vuelta]);
  const recargar = useRef(null);
  recargar.current = lista.recargar;
  // (revisión) En este móvil no se guarda la copia del chat de quien ya no está (borrado o de baja)
  useEffect(() => {
    if (!lista.datos || !perfil?.id) return;
    cacheChat().purgar(perfil.id, { conservar: lista.datos.filter((r) => r.atleta.estado !== 'baja').map((r) => r.atleta.id) }).catch(() => {});
  }, [lista.datos]);
  // (una vez por petición: al volver a la lista, no se vuelve a abrir esa conversación)
  const atendida = useRef(null);
  useEffect(() => {
    if (!peticion?.atletaId || atendida.current === peticion.id) return;
    const a = lista.datos?.find((x) => x.atleta.id === peticion.atletaId)?.atleta;
    if (a) { atendida.current = peticion.id; abrir(a); }
  }, [peticion?.id, lista.datos]);
  // Al momento: por Realtime o notificación, y cada medio minuto
  useEffect(() => {
    let t = null;
    const pronto = () => { clearTimeout(t); t = setTimeout(() => recargar.current?.(true), 300); };
    const cada = setInterval(() => { if (document.visibilityState === 'visible') recargar.current?.(true); }, 30000);
    for (const ev of ['fbe-mensaje', 'fbe-notificacion', 'fbe-cambio']) window.addEventListener(ev, pronto);
    return () => { clearTimeout(t); clearInterval(cada); for (const ev of ['fbe-mensaje', 'fbe-notificacion', 'fbe-cambio']) window.removeEventListener(ev, pronto); };
  }, []);

  // «escribiendo…» en cada fila (el canal privado de cada conversación; sin él, nada)
  const filasTodas = useMemo(() => ordenarConversaciones(lista.datos || []), [lista.datos]);
  const escribiendo = useEscribiendo(abierta ? [] : filasTodas.map((x) => x.atleta.id).slice(0, 40));

  // Buscar en los mensajes (en la base, solo el coach), con una pausa al escribir
  const q = buscar.trim();
  const [enMensajes, setEnMensajes] = useState({ q: '', filas: [] });
  useEffect(() => {
    if (q.length < 2) { setEnMensajes({ q: '', filas: [] }); return undefined; }
    const t = setTimeout(() => { api.buscarMensajes(q).then((filas) => setEnMensajes({ q, filas })).catch((e) => { setEnMensajes({ q, filas: [] }); aviso(e.message, 'error'); }); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function abrir(atleta, saltarA = null) {
    conTransicion(() => setAbierta({ atleta, saltarA }), 'abrir');
    const e = (lista.datos || []).find((x) => x.atleta.id === atleta.id)?.estado;
    if (e?.no_leida) api.cambiarEstadoConversacion(atleta.id, { noLeida: false }).then(() => lista.recargar(true)).catch(() => {});
  }
  async function cambiarSilencio(fila, opcion) {
    setOpciones(null); setSilenciar(null);
    try { await api.silenciar(fila.atleta.id, opcion); aviso(opcion ? `${fila.atleta.nombre.split(' ')[0]}: silenciada` : 'Notificaciones activadas'); await silencios.recargar(true); }
    catch (err) { aviso(err.message, 'error'); }
  }
  async function cambiarEstado(fila, cambios, hecho) {
    setOpciones(null);
    try { await api.cambiarEstadoConversacion(fila.atleta.id, cambios); aviso(hecho); await lista.recargar(true); alCambiar?.(); }
    catch (err) { aviso(err.message, 'error'); }
  }

  if (abierta) {
    const a = abierta.atleta;
    const volver = () => { conTransicion(() => setAbierta(null), 'cerrar'); setVuelta((v) => v + 1); lista.recargar(true); alCambiar?.(); };
    return (
      <div class="contenido coach chat-pagina">
        <Chat atletaId={a.id} nombreAtleta={a.nombre} fotoOtro={a.foto} perfilOtro={a.perfil_id || null} saltarA={abierta.saltarA}
          alCambiar={() => { lista.recargar(true); alCambiar?.(); }} alLeer={() => { lista.recargar(true); alCambiar?.(); }}
          irContexto={(ctx) => abrirAtleta(a.id, ctx.tipo === 'sesion' ? 'registro' : ctx.tipo === 'checkin' ? 'seguimiento' : 'videos')}
          cabecera={{
            izquierda: <><button class="btn btn-icono plano" onClick={volver} aria-label="Volver a mensajes"><Icono n="atras" /></button><Avatar nombre={a.nombre} foto={a.foto} ampliable /></>,
            titulo: a.nombre, sub: a.objetivo || '', verFicha: () => abrirAtleta(a.id, 'programa'),
            derecha: <button class="btn btn-peq" onClick={() => abrirAtleta(a.id, 'programa')}>Ficha</button>,
          }} />
      </div>
    );
  }

  const nq = normalLetras(q);
  const porNombre = (x) => !nq || normalLetras(x.atleta.nombre).includes(nq);
  const nArchivadas = filasTodas.filter((x) => x.estado?.archivada_en).length;
  const filas = filtrarConversaciones(filasTodas, q ? 'todos' : filtro, { archivadas: archivadas && !q }).filter(porNombre);
  const nFijadas = filasTodas.filter((x) => x.estado?.fijada_en).length;
  const sinLeer = (lista.datos || []).reduce((t, x) => t + x.sinLeer, 0);
  const A = Object.fromEntries((lista.datos || []).map((x) => [x.atleta.id, x.atleta]));
  const mensajesEncontrados = enMensajes.q && enMensajes.q === q ? enMensajes.filas.filter((m) => A[m.atleta_id]) : [];
  return (
    <div class="contenido coach">
      <CabeceraGrande>
        <div class="titulo"><h1>{archivadas ? 'Archivados' : 'Mensajes'}</h1><div class="sub">{archivadas ? `${nArchivadas} ${nArchivadas === 1 ? 'conversación' : 'conversaciones'}` : sinLeer ? `${sinLeer} sin leer` : 'Al día'}</div></div>
        {archivadas && <button type="button" class="btn btn-peq" onClick={() => setArchivadas(false)}><Icono n="atras" /> Todas</button>}
      </CabeceraGrande>
      <BandaDemo />
      <ErrorCaja error={lista.error} reintentar={lista.recargar} />
      <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" placeholder="Buscar atleta o mensaje" aria-label="Buscar atleta o mensaje" value={buscar} onInput={(e) => setBuscar(e.currentTarget.value)} /></div>
      {!q && !archivadas && (
        <div class="selector-chips conv-filtros" role="group" aria-label="Qué conversaciones ver">
          {FILTROS.map(([v, t]) => <button type="button" key={v} aria-pressed={filtro === v ? 'true' : 'false'} onClick={() => setFiltro(v)}>{t}</button>)}
        </div>
      )}
      {!q && !archivadas && (
        <button type="button" class="conv-difusion" onClick={() => setDifusion(true)}>
          <span class="ico" aria-hidden="true"><Icono n="equipo" /></span><strong>Nuevo mensaje de difusión</strong><Icono n="derecha" class="cola" />
        </button>
      )}
      {lista.cargando && !lista.datos ? <Siluetas forma="filas" n={5} texto="Cargando las conversaciones" /> : (
        <>
          {!q && !archivadas && nArchivadas > 0 && (
            <button type="button" class="conv-archivados" onClick={() => setArchivadas(true)}>
              <span class="ico" aria-hidden="true"><Icono n="bandeja" /></span><strong>Archivados</strong><span class="num secundario">{nArchivadas}</span>
            </button>
          )}
          {!filas.length ? (
            <div class="panel"><Vacio icono="mensaje" titulo={q ? 'Ningún atleta con ese nombre' : archivadas ? 'Nada archivado' : filtro === 'no-leidos' ? 'Todo leído' : filtro === 'fijados' ? 'Sin conversaciones fijadas' : 'Sin conversaciones'}>
              {q ? (q.length >= 2 ? 'Mira abajo si sale en algún mensaje.' : 'Escribe al menos dos letras.') : filtro === 'fijados' ? 'Fija hasta 3 desde las opciones de cada conversación.' : !lista.datos?.length ? 'Cuando des de alta a un atleta, su chat aparecerá aquí.' : 'Nada por aquí.'}
            </Vacio></div>
          ) : (
            <div class="panel">
              {q && <h2 class="conv-titulo-busqueda mini terciario">Chats</h2>}
              <ul class="lista conversaciones">
                {filas.map((fila) => (
                  <FilaConversacion key={fila.atleta.id} fila={fila} perfilId={perfil?.id} escribiendo={escribiendo.has(fila.atleta.id)} vuelta={vuelta} consulta={q} silencio={silencios.datos?.[fila.atleta.id] || null}
                    alAbrir={() => abrir(fila.atleta)} alOpciones={() => setOpciones(fila)} />
                ))}
              </ul>
            </div>
          )}
          {q.length >= 2 && (
            <section class="seccion" aria-labelledby="conv-en-mensajes">
              <h2 id="conv-en-mensajes" class="mini terciario conv-titulo-busqueda">Mensajes</h2>
              {enMensajes.q !== q ? <p class="peq terciario">Buscando…</p> : !mensajesEncontrados.length ? <p class="peq terciario">Ningún mensaje con «{q}».</p> : (
                <div class="panel">
                  <ul class="lista conversaciones">
                    {mensajesEncontrados.map((m) => (
                      <li key={m.id}>
                        <button type="button" class="conversacion conv-resultado" onClick={() => abrir(A[m.atleta_id], m.id)}>
                          <Avatar nombre={A[m.atleta_id].nombre} foto={A[m.atleta_id].foto} clase="grande" />
                          <span class="conv-texto">
                            <span class="conv-cab"><strong>{A[m.atleta_id].nombre}</strong><span class="mini terciario">{cuando(m.creado_en)}</span></span>
                            <span class="conv-ultimo">{m.autor === 'coach' && <span class="terciario">Tú: </span>}{resaltar(m.texto.replace(/\s+/g, ' '), q).map((p, i) => (p.marca ? <mark key={i} class="chat-marca">{p.v}</mark> : <Fragment key={i}>{p.v}</Fragment>))}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </>
      )}
      {difusion && <HojaDifusion alCerrar={() => setDifusion(false)} alEnviado={() => { lista.recargar(true); alCambiar?.(); }} />}
      {silenciar && <HojaSilenciar alCerrar={() => setSilenciar(null)} alElegir={(o) => cambiarSilencio(silenciar, o)} />}
      {opciones && (
        <Hoja titulo={opciones.atleta.nombre} alCerrar={() => setOpciones(null)}>
          <ul class="lista hoja-acciones">
            {!opciones.estado?.archivada_en && (
              <li><button type="button" class="accion-fila" disabled={!opciones.estado?.fijada_en && nFijadas >= 3}
                onClick={() => cambiarEstado(opciones, { fijada: !opciones.estado?.fijada_en }, opciones.estado?.fijada_en ? 'Ya no está fijada' : 'Fijada arriba')}>
                <span class="ico"><Icono n="chincheta" /></span>
                <span class="pila-xs"><strong>{opciones.estado?.fijada_en ? 'Desfijar' : 'Fijar arriba'}</strong>{!opciones.estado?.fijada_en && nFijadas >= 3 && <span class="peq secundario">Ya tienes 3 fijadas: desfija alguna antes</span>}</span><span />
              </button></li>
            )}
            <li><button type="button" class="accion-fila" onClick={() => cambiarEstado(opciones, { archivada: !opciones.estado?.archivada_en }, opciones.estado?.archivada_en ? 'Ya no está archivada' : 'Archivada: vuelve sola si te escribe')}>
              <span class="ico"><Icono n="bandeja" /></span><span class="pila-xs"><strong>{opciones.estado?.archivada_en ? 'Desarchivar' : 'Archivar'}</strong>{!opciones.estado?.archivada_en && <span class="peq secundario">Sale de la lista hasta que te vuelva a escribir</span>}</span><span />
            </button></li>
            <li><button type="button" class="accion-fila" onClick={() => { const f = opciones; if (silenciado(silencios.datos?.[f.atleta.id])) cambiarSilencio(f, null); else { setOpciones(null); setSilenciar(f); } }}>
              <span class="ico"><Icono n={silenciado(silencios.datos?.[opciones.atleta.id]) ? 'campana' : 'silencio'} /></span>
              <span class="pila-xs"><strong>{silenciado(silencios.datos?.[opciones.atleta.id]) ? 'Activar las notificaciones' : 'Silenciar'}</strong><span class="peq secundario">{textoSilencio(silencios.datos?.[opciones.atleta.id]) || 'Sin avisos de esta conversación (sigue contando como sin leer)'}</span></span><span />
            </button></li>
            {opciones.estado?.no_leida ? (
              <li><button type="button" class="accion-fila" onClick={() => cambiarEstado(opciones, { noLeida: false }, 'Marcada como leída')}><span class="ico"><Icono n="hecho" /></span><span class="pila-xs"><strong>Marcar como leído</strong></span><span /></button></li>
            ) : opciones.sinLeer === 0 && (
              <li><button type="button" class="accion-fila" onClick={() => cambiarEstado(opciones, { noLeida: true }, 'Marcada como no leída')}><span class="ico"><Icono n="mensaje" /></span><span class="pila-xs"><strong>Marcar como no leído</strong><span class="peq secundario">Para acordarte de contestar</span></span><span /></button></li>
            )}
          </ul>
        </Hoja>
      )}
    </div>
  );
}

// Una fila de la lista: tocarla abre el chat; mantenerla pulsada (o el botón derecho, o «Opciones») abre sus opciones
function FilaConversacion({ fila, perfilId, escribiendo, vuelta, consulta, silencio = null, alAbrir, alOpciones }) {
  const { atleta, ultimo, sinLeer: n, estado } = fila;
  const borrador = useMemo(() => leerBorrador(almacen(), perfilId, atleta.id)?.texto || null, [perfilId, atleta.id, vuelta]);
  const prev = vistaPrevia(ultimo, { borrador });
  const largo = useRef(null);
  const suprimir = useRef(false);
  const bajar = (e) => { if (e.pointerType === 'mouse') return; clearTimeout(largo.current); largo.current = setTimeout(() => { suprimir.current = true; alOpciones(); }, 500); };
  const cancelar = () => clearTimeout(largo.current);
  const noLeida = n > 0 || !!estado?.no_leida;
  const nombre = consulta ? resaltar(atleta.nombre, consulta).map((p, i) => (p.marca ? <mark key={i} class="chat-marca">{p.v}</mark> : <Fragment key={i}>{p.v}</Fragment>)) : atleta.nombre;
  return (
    <li class="conv-fila">
      <button class={`conversacion ${noLeida ? 'sin-leer' : ''} ${estado?.fijada_en ? 'fijada' : ''}`} onClick={() => { if (suprimir.current) { suprimir.current = false; return; } alAbrir(); }}
        onPointerDown={bajar} onPointerUp={cancelar} onPointerCancel={cancelar} onPointerMove={(e) => { if (Math.abs(e.movementY) > 4) cancelar(); }}
        onContextMenu={(e) => { e.preventDefault(); cancelar(); alOpciones(); }}>
        <Avatar nombre={atleta.nombre} foto={atleta.foto} clase="grande" />
        <span class="conv-texto">
          <span class="conv-cab"><strong>{nombre}</strong><span class="conv-hora mini terciario">{silenciado(silencio) && <Icono n="silencio" titulo="Silenciada" class="conv-silencio" />}{estado?.fijada_en && <Icono n="chincheta" titulo="Fijada" />}{ultimo && cuando(ultimo.creado_en)}</span></span>
          <span class="conv-ultimo">
            {escribiendo ? <span class="conv-escribiendo">escribiendo…</span>
              : !prev ? <span class="terciario">Sin mensajes todavía</span>
              : prev.borrador ? <><span class="conv-borrador">Borrador:</span> {prev.texto}</>
              : <>{prev.mio && <span class={`visto ${prev.visto ? 'leido' : prev.entregado ? 'entregado' : ''}`} aria-label={prev.visto ? 'Tú, visto:' : prev.entregado ? 'Tú, entregado:' : 'Tú, enviado:'}>{prev.visto || prev.entregado ? '✓✓' : '✓'} </span>}<span class={prev.eliminado ? 'conv-eliminado' : ''}>{prev.texto}</span></>}
          </span>
        </span>
        {n > 0 ? <span class="conv-n num" aria-label={`${n} sin leer`}>{n}</span> : estado?.no_leida ? <span class="conv-n conv-punto" role="img" aria-label="Marcada como no leída" /> : null}
      </button>
      <button type="button" class="btn btn-icono plano conv-opciones" aria-label={`Opciones de la conversación con ${atleta.nombre}`} onClick={alOpciones}><Icono n="opciones" /></button>
    </li>
  );
}

// Quién está escribiendo (por los canales privados de esas conversaciones): un Set de atleta_id
function useEscribiendo(ids) {
  const { api } = useApp();
  const [quien, setQuien] = useState(new Set());
  const clave = [...ids].sort().join(',');
  useEffect(() => {
    let vivo = true;
    const tiempos = new Map();
    const handles = [];
    const quitar = (id) => { tiempos.delete(id); setQuien((s) => { if (!s.has(id)) return s; const n = new Set(s); n.delete(id); return n; }); };
    api.miPresencia().catch(() => ({ visible: true })).then(({ visible }) => {
      if (!vivo) return;
      for (const id of ids) {
        const h = api.canalChat(id, {
          rol: 'coach', visible,
          alEscribir: (r) => {
            if (r === 'coach') return;
            clearTimeout(tiempos.get(id));
            tiempos.set(id, setTimeout(() => quitar(id), 5000));
            setQuien((s) => (s.has(id) ? s : new Set([...s, id])));
          },
          alCambio: () => {},
        });
        if (h) handles.push(h);
      }
    });
    const releer = () => { for (const id of [...tiempos.keys()]) quitar(id); };
    window.addEventListener('fbe-mensaje', releer);
    return () => { vivo = false; for (const h of handles) h.soltar(); for (const t of tiempos.values()) clearTimeout(t); window.removeEventListener('fbe-mensaje', releer); };
  }, [clave]);
  return quien;
}
