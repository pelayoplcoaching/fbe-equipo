import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Cargando, Hoja, Avatar, cuando } from './comunes.jsx';
import { Hilo, HojaRespuestas } from './Hilo.jsx';
import { VerArchivo, capturarPoster } from './Archivos.jsx';
import { LIMITE_ARCHIVO_MB } from '../datos/api.js';
import { hoyISO, sumarDias, fmtConDia, aISO, fmtProgramado } from '../logica/fechas.js';
import { TextoConEnlaces } from './Enlaces.jsx';
import { HojaProgramar } from './Programar.jsx';
import { gruposChat } from '../logica/visual.js';
import { sinMovimiento } from './transiciones.js';

// El chat (v0.18): todos los mensajes con una persona en un solo hilo, como en WhatsApp pero sin más.
// Lo que viene de una sesión, un check-in o un vídeo lleva su etiqueta, que abre ese sitio; lo que se escribe
// aquí es un mensaje general. Fotos y vídeos se envían con el clip; un vídeo puede ir al diario (de técnica).
// yo: 'coach' o 'atleta'. irContexto({tipo, id}): abrir la sesión, el check-in o el archivo.
export function Chat({ atletaId, nombreAtleta = 'Atleta', nombreCoach = 'Tu coach', fotoOtro = null, irContexto, alLeer, alCambiar }) {
  const { api, perfil, aviso, modo } = useApp();
  const yo = perfil?.rol === 'coach' ? 'coach' : 'atleta';
  const conv = useCarga(() => api.conversacion(atletaId), [atletaId]);
  const [texto, setTexto] = useState('');
  const [adjunto, setAdjunto] = useState(null);      // { archivo, url, esVideo, enDiario }
  const [enviando, setEnviando] = useState(false);
  const [guardadas, setGuardadas] = useState(false);
  const [abierto, setAbierto] = useState(null);      // archivo abierto a pantalla completa
  const [borrando, setBorrando] = useState(null);    // id del mensaje con el menú de borrar abierto
  const [programar, setProgramar] = useState(null);  // v0.48: null | { nuevo: true } | mensaje programado a cambiar
  const lista = useRef(null);
  const raiz = useRef(null);
  const fin = useRef(null);
  // v0.49: «Mensajes nuevos» cuando llega algo y estás leyendo más arriba; se va al llegar abajo
  const [nuevos, setNuevos] = useState(false);
  const [abajo, setAbajo] = useState(true);
  const area = useRef(null);
  const input = useRef(null);
  const recargar = useRef(null);
  recargar.current = conv.recargar;

  // Al momento: por Realtime (fbe-mensaje), tras cualquier escritura propia (fbe-cambio), al llegar una
  // notificación y, por si acaso, cada medio minuto mientras la pantalla está visible
  useEffect(() => {
    let t = null;
    const pronto = () => { clearTimeout(t); t = setTimeout(() => recargar.current?.(true), 250); };
    const cada = setInterval(() => { if (document.visibilityState === 'visible') recargar.current?.(true); }, 30000);
    const visible = () => { if (document.visibilityState === 'visible') pronto(); };
    for (const ev of ['fbe-mensaje', 'fbe-notificacion']) window.addEventListener(ev, pronto);
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(t); clearInterval(cada); for (const ev of ['fbe-mensaje', 'fbe-notificacion']) window.removeEventListener(ev, pronto); document.removeEventListener('visibilitychange', visible); };
  }, []);

  // Lo que escribió la otra parte queda leído al verlo: solo con la pantalla a la vista (un mensaje que llega
  // con la pestaña en segundo plano sigue sin leer hasta que vuelves)
  useEffect(() => {
    const marcar = () => {
      if (document.visibilityState !== 'visible') return;
      const ids = (conv.datos || []).filter((c) => c.autor !== yo && !c.leido_en).map((c) => c.id);
      if (ids.length) api.marcarLeidos(ids).then(() => alLeer?.()).catch(() => {});
    };
    marcar();
    document.addEventListener('visibilitychange', marcar);
    return () => document.removeEventListener('visibilitychange', marcar);
  }, [conv.datos]);

  // Abajo del todo al cargar, al mandar algo y cuando llega un mensaje estando ya cerca del final; si estás
  // leyendo más arriba, no te mueve
  const n = conv.datos?.length || 0;
  const ultimoMio = mensajes_ultimo(conv.datos) === yo;
  const primeraCarga = useRef(true);
  const nPrevio = useRef(0);
  useLayoutEffect(() => {
    const doc = document.documentElement;
    const cerca = doc.scrollHeight - doc.scrollTop - window.innerHeight < 240;
    if (primeraCarga.current || cerca || ultimoMio || adjunto) window.scrollTo(0, doc.scrollHeight);
    else if (n > nPrevio.current) setNuevos(true);
    if (n) primeraCarga.current = false;
    nPrevio.current = n;
  }, [n, !!adjunto]);
  // El final de la lista a la vista (sin escuchar el scroll)
  useEffect(() => {
    const el = fin.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => { setAbajo(e.isIntersecting); if (e.isIntersecting) setNuevos(false); }, { rootMargin: '0px 0px 120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [!!conv.datos]);
  // Los separadores de día se quedan pegados justo debajo de la cabecera de la pantalla (mida lo que mida)
  useLayoutEffect(() => {
    const cab = document.querySelector('.cabecera');
    const el = raiz.current;
    if (!cab || !el) return undefined;
    const poner = () => el.style.setProperty('--chat-sep-top', `${Math.round(cab.getBoundingClientRect().height)}px`);
    poner();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(poner) : null;
    ro?.observe(cab);
    return () => ro?.disconnect();
  }, []);
  const irAbajo = () => { setNuevos(false); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: sinMovimiento() ? 'auto' : 'smooth' }); };

  const urlAdjunto = adjunto?.url || null;
  useEffect(() => () => { if (urlAdjunto) URL.revokeObjectURL(urlAdjunto); }, [urlAdjunto]);

  function elegido(e) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    if (f.size > LIMITE_ARCHIVO_MB * 1024 * 1024) { aviso(`Pesa más de ${LIMITE_ARCHIVO_MB} MB. Graba solo la serie (unos 30 segundos).`, 'error'); return; }
    const esVideo = /^video\//.test(f.type || '');
    let url = null;
    try { url = URL.createObjectURL(f); } catch { /* */ }
    setAdjunto({ archivo: f, url, esVideo, enDiario: esVideo && yo === 'atleta' });
    area.current?.focus();
  }

  async function enviar(e) {
    e?.preventDefault();
    const t = texto.trim();
    if ((!t && !adjunto) || enviando) return;
    setEnviando(true);
    try {
      let poster = null, duracion_seg = null;
      if (adjunto?.esVideo) {
        const cap = await capturarPoster(adjunto.archivo).catch(() => null);
        poster = cap?.poster || null; duracion_seg = cap?.duracion ?? null;
      }
      await api.enviarMensaje(atletaId, { texto: t, archivo: adjunto?.archivo || null, autor: yo, enDiario: !!adjunto?.enDiario, poster, duracion_seg });
      setTexto(''); setAdjunto(null);
      if (area.current) area.current.style.height = 'auto';
      await conv.recargar(true);
      alCambiar?.();
    } catch (err) { aviso(err.message, 'error'); } finally { setEnviando(false); }
  }

  // v0.48: el coach programa el mensaje para más tarde (solo texto)
  async function enviarProgramado({ enviarEn }) {
    const t = texto.trim();
    try {
      await api.enviarMensaje(atletaId, { texto: t, autor: yo, enviarEn });
      setTexto(''); setProgramar(null);
      if (area.current) area.current.style.height = 'auto';
      aviso(`Programado para el ${fmtProgramado(enviarEn)}`);
      await conv.recargar(true); alCambiar?.();
    } catch (err) { aviso(err.message, 'error'); }
  }
  async function reprogramar(c, cambios) {
    try {
      await api.reprogramarMensaje(c.id, cambios);
      setProgramar(null); setBorrando(null);
      aviso(cambios.enviarEn ? `Ahora sale el ${fmtProgramado(cambios.enviarEn)}` : 'Enviado');
      await conv.recargar(true); alCambiar?.();
    } catch (err) { aviso(err.message, 'error'); }
  }

  async function borrar(c) {
    try { await api.borrarMensaje(c); setBorrando(null); await conv.recargar(true); alCambiar?.(); }
    catch (err) { aviso(err.message, 'error'); }
  }

  const mensajes = conv.datos || [];
  const primerNombre = nombreAtleta.split(' ')[0];
  const otro = yo === 'coach' ? primerNombre : nombreCoach;
  // Separadores por día
  const hoy = hoyISO(), ayer = sumarDias(hoy, -1);
  const diaDe = (iso) => { const d = aISO(new Date(iso)); return d === hoy ? 'Hoy' : d === ayer ? 'Ayer' : fmtConDia(d); };
  const grupos = [];
  for (const c of mensajes) {
    const dia = diaDe(c.creado_en);
    const g = grupos[grupos.length - 1];
    if (g && g.dia === dia) g.items.push(c); else grupos.push({ dia, items: [c] });
  }
  const etiqueta = (c) => {
    if (!c.contexto) return null;
    if (c.contexto.tipo === 'sesion') return `En ${c.contexto.nombre}`;
    if (c.contexto.tipo === 'checkin') return yo === 'coach' ? 'En su check-in' : 'En tu check-in';
    if (!c.contexto.nombre) return null;
    return yo === 'coach' ? `En su ${c.contexto.nombre}` : `En tu ${c.contexto.nombre}`;
  };
  const esMarcador = (c) => c.archivo && (c.texto === 'Foto' || c.texto === 'Vídeo');
  // v0.49: los mensajes seguidos de la misma persona van juntos (solo el último lleva el pico y la hora)
  const agrupado = Object.fromEntries(gruposChat(mensajes.map((c) => ({ ...c, contexto: etiqueta(c) ? c.contexto : null })), { dia: (iso) => aISO(new Date(iso)) }).map((x) => [x.id, x]));

  return (
    <div class="chat" ref={raiz} aria-label={`Chat con ${otro}`}>
      <div class="chat-lista" ref={lista}>
        {conv.cargando && !conv.datos ? <Cargando texto="Cargando los mensajes" /> : !mensajes.length ? (
          <div class="chat-vacio">
            <Avatar nombre={otro} foto={fotoOtro} clase="grande" ampliable />
            <p><strong>{yo === 'coach' ? `Tu conversación con ${primerNombre}` : `Tu conversación con ${nombreCoach}`}</strong></p>
            <p class="peq secundario">{yo === 'coach'
              ? 'Para lo que no es de una sesión concreta. Lo que escribas aquí le llega al momento; lo de sus sesiones, check-ins y vídeos también sale en este hilo con su etiqueta.'
              : 'Para lo que no es de una sesión concreta: un viaje, una molestia, un cambio de horario, una duda. Tu coach lo recibe al momento. Puedes mandar fotos y vídeos con el clip.'}</p>
          </div>
        ) : grupos.map((g) => (
          <section key={g.dia} class="chat-dia" aria-label={g.dia}>
            <span class="chat-sep">{g.dia}</span>
            {g.items.map((c) => {
              const mio = c.autor === yo;
              const etq = etiqueta(c);
              const gr = agrupado[c.id] || { primero: true, ultimo: true };
              return (
                <article key={c.id} class={`burbuja ${mio ? 'mia' : 'suya'} ${c.archivo ? 'con-medio' : ''} ${c.programado ? 'programada' : ''} ${gr.primero ? '' : 'sigue'} ${gr.ultimo ? 'cola' : 'sin-cola'}`}>
                  {etq && (
                    <button type="button" class="burbuja-ctx" onClick={() => c.contexto.tipo === 'archivo' ? setAbierto(c) : irContexto?.(c.contexto)}>
                      <Icono n={c.contexto.tipo === 'sesion' ? 'hoy' : c.contexto.tipo === 'checkin' ? 'checkin' : 'video'} />{etq}
                    </button>
                  )}
                  {c.archivo && <MedioChat archivo={c.archivo} alAbrir={() => setAbierto(c)} />}
                  {!esMarcador(c) && <TextoConEnlaces texto={c.texto} clase="burbuja-texto" />}
                  <span class="burbuja-pie">
                    {c.programado ? <span class="programado"><Icono n="reloj" />Programado para el {fmtProgramado(c.enviar_en)}</span> : <span class={gr.ultimo ? '' : 'sr'}>{horaDe(c.creado_en)}</span>}
                    {mio && !c.programado && !gr.ultimo && <span class="sr">{c.leido_en ? 'visto' : 'enviado'}</span>}
                    {mio && !c.programado && gr.ultimo && <span class="visto" title={c.leido_en ? 'Visto' : 'Enviado'} aria-label={c.leido_en ? 'visto' : 'enviado'}>{c.leido_en ? '✓✓' : '✓'}</span>}
                    {(mio || yo === 'coach') && (
                      <button type="button" class="burbuja-mas" aria-label="Opciones del mensaje" onClick={() => setBorrando(borrando === c.id ? null : c.id)}><Icono n="abajo" /></button>
                    )}
                  </span>
                  {borrando === c.id && (
                    <span class="burbuja-menu">
                      {c.programado && <button type="button" class="btn btn-peq" onClick={() => setProgramar(c)}><Icono n="editar" /> Cambiar</button>}
                      <button type="button" class="btn btn-peq btn-peligro" onClick={() => borrar(c)}><Icono n="basura" /> {c.programado ? 'Cancelar el envío' : 'Borrar'}</button>
                      <button type="button" class="btn btn-peq plano" onClick={() => setBorrando(null)}>Cancelar</button>
                    </span>
                  )}
                </article>
              );
            })}
          </section>
        ))}
        {modo === 'demo' && !conv.cargando && <p class="mini terciario chat-nota">En la demo no hay nadie al otro lado: lo que escribas se queda aquí.</p>}
        <span ref={fin} class="chat-fin" aria-hidden="true" />
      </div>
      {nuevos && !abajo && <button type="button" class="chat-nuevos" onClick={irAbajo}>Mensajes nuevos <Icono n="abajo" /></button>}
      <p class="sr" aria-live="polite">{nuevos && !abajo ? 'Hay mensajes nuevos más abajo' : ''}</p>

      <form class="chat-barra" onSubmit={enviar}>
        <div class="chat-barra-in">
          {adjunto && (
            <div class="chat-adjunto">
              {adjunto.url && (adjunto.esVideo ? <video src={adjunto.url} muted playsInline preload="metadata" /> : <img src={adjunto.url} alt="" />)}
              <div class="pila-xs">
                <strong class="peq">{adjunto.esVideo ? 'Vídeo' : 'Foto'} <span class="terciario">({mb(adjunto.archivo.size)} MB)</span></strong>
                {adjunto.esVideo && yo === 'atleta' && (
                  <label class="casilla mini"><input type="checkbox" checked={adjunto.enDiario} onChange={(e) => setAdjunto({ ...adjunto, enDiario: e.currentTarget.checked })} /><span>Guardarlo en mi diario como vídeo de técnica (tu coach lo revisa)</span></label>
                )}
              </div>
              <button type="button" class="btn btn-icono plano" aria-label="Quitar el adjunto" onClick={() => setAdjunto(null)}><Icono n="cerrar" /></button>
            </div>
          )}
          <div class="chat-escribir">
            <input ref={input} type="file" accept="image/*,video/*" class="sr" tabIndex={-1} aria-label="Archivo para adjuntar" onChange={elegido} />
            <button type="button" class="btn btn-icono plano" aria-label="Adjuntar foto o vídeo" onClick={() => input.current?.click()}><Icono n="camara" /></button>
            {yo === 'coach' && <button type="button" class="btn btn-icono plano" aria-label="Respuestas guardadas" onClick={() => setGuardadas(true)}><Icono n="rayo" /></button>}
            {yo === 'coach' && <button type="button" class="btn btn-icono plano" aria-label="Programar envío" title="Programar envío" disabled={!texto.trim() || !!adjunto} onClick={() => setProgramar({ nuevo: true })}><Icono n="reloj" /></button>}
            <textarea ref={area} class="area chat-area" rows={1} aria-label={yo === 'coach' ? `Escribir a ${primerNombre}` : 'Escribir a tu coach'}
              placeholder={adjunto ? 'Pie de foto (opcional)…' : yo === 'coach' ? `Escribe a ${primerNombre}…` : 'Escribe a tu coach…'} value={texto}
              onInput={(e) => { setTexto(e.currentTarget.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${Math.min(140, e.currentTarget.scrollHeight)}px`; }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) enviar(e); }} />
            <button class="btn btn-primario btn-icono chat-enviar" aria-label="Enviar" disabled={enviando || (!texto.trim() && !adjunto)}><Icono n="enviar" /></button>
          </div>
        </div>
      </form>

      {abierto && (
        <Hoja titulo={abierto.archivo?.tipo === 'adjunto' ? (/^image\//.test(abierto.archivo.mime || '') ? 'Foto' : 'Vídeo') : abierto.archivo?.tipo === 'foto_progreso' ? 'Foto de progreso' : 'Vídeo de técnica'} alCerrar={() => setAbierto(null)} ancho={760}>
          {abierto.archivo && <VerArchivo archivo={abierto.archivo} />}
          {abierto.archivo?.tipo !== 'adjunto' && <Hilo atletaId={atletaId} archivoId={abierto.archivoId} nombreAtleta={nombreAtleta} alCambiar={() => { conv.recargar(true); alCambiar?.(); }} vacio="Sin comentarios en este vídeo." />}
        </Hoja>
      )}
      {programar?.nuevo && <HojaProgramar titulo={`Programar el mensaje a ${primerNombre}`} alCerrar={() => setProgramar(null)} alGuardar={enviarProgramado} />}
      {programar && !programar.nuevo && (
        <HojaProgramar titulo="Cambiar el mensaje programado" inicial={programar.enviar_en} conTexto texto={programar.texto} boton="Guardar"
          alCerrar={() => setProgramar(null)} alGuardar={({ enviarEn, texto: t }) => reprogramar(programar, { enviarEn, texto: t })}
          alEnviarYa={({ texto: t }) => reprogramar(programar, { enviarEn: null, texto: t })} />
      )}
      {guardadas && (
        <HojaRespuestas nombre={primerNombre} texto={texto} alCerrar={() => setGuardadas(false)}
          alElegir={(t) => { setTexto((x) => (x.trim() ? `${x.trimEnd()}\n\n${t}` : t)); setGuardadas(false); area.current?.focus(); }} />
      )}
    </div>
  );
}

// La foto o el vídeo dentro de la burbuja: la miniatura si la hay; si no (o si no carga), el propio archivo.
// v0.49: mientras llega, un hueco neutro con un brillo suave; al cargar, aparece fundido; si falla, lo dice con
// «Reintentar» (en lugar del icono de imagen rota del navegador).
function MedioChat({ archivo, alAbrir }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [sinPoster, setSinPoster] = useState(false);
  const [lista, setLista] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);
  const esFoto = archivo.tipo === 'foto_progreso' || /^image\//.test(archivo.mime || '');
  const conPoster = !!archivo.poster_ruta && !sinPoster;
  useEffect(() => {
    let vivo = true;
    setUrl(null); setLista(false); setFallo(false);
    api.urlArchivo(conPoster ? archivo.poster_ruta : archivo.ruta).then((u) => vivo && setUrl(u)).catch(() => { if (!vivo) return; if (conPoster) setSinPoster(true); else setFallo(true); });
    return () => { vivo = false; };
  }, [archivo.ruta, archivo.poster_ruta, conPoster, intento]);
  const error = () => { if (conPoster) setSinPoster(true); else setFallo(true); };
  if (fallo) {
    return (
      <div class="medio-chat medio-fallo" role="group" aria-label={esFoto ? 'Imagen no disponible' : 'Vídeo no disponible'}>
        <Icono n={esFoto ? 'imagen' : 'video'} />
        <span class="peq">{esFoto ? 'No se pudo cargar la imagen' : 'No se pudo cargar el vídeo'}</span>
        {/* «Abrir» como siempre: un vídeo HEVC o una foto HEIC que aquí no se pintan pueden verse o descargarse en el visor */}
        <span class="fila-envolver medio-fallo-acciones">
          <button type="button" class="btn btn-peq" onClick={() => setIntento((x) => x + 1)}><Icono n="reiniciar" /> Reintentar</button>
          <button type="button" class="btn btn-peq" onClick={alAbrir} aria-label={esFoto ? 'Abrir la foto' : 'Abrir el vídeo'}><Icono n="ojo" /> Abrir</button>
        </span>
      </div>
    );
  }
  return (
    <button type="button" class={`medio-chat ${lista ? 'listo' : ''}`} onClick={alAbrir} aria-label={esFoto ? 'Abrir la foto' : 'Abrir el vídeo'}>
      <span class="medio-chat-hueco" aria-hidden="true" />
      {url && (esFoto || conPoster
        ? <img key={`${url}:${intento}`} src={url} alt="" loading="lazy" onLoad={() => setLista(true)} onError={error} />
        : <video key={`${url}:${intento}`} src={url} muted playsInline preload="metadata" onLoadedData={() => setLista(true)} onError={error} />)}
      {!esFoto && <span class="medio-chat-play" aria-hidden="true"><Icono n="play" />{archivo.duracion_seg ? <span class="num">{mmssCorto(archivo.duracion_seg)}</span> : null}</span>}
    </button>
  );
}

const mensajes_ultimo = (lista) => (lista && lista.length ? lista[lista.length - 1].autor : null);
const horaDe = (iso) => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const mb = (bytes) => (bytes < 104858 ? '<0,1' : (bytes / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 }));
export const mmssCorto = (seg) => `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, '0')}`;
export { cuando };
