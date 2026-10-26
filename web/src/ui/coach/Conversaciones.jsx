import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Siluetas, Icono, Avatar, ErrorCaja, Vacio, cuando } from '../comunes.jsx';
import { Chat } from '../Chat.jsx';
import { BandaDemo } from '../App.jsx';

// Mensajes del coach (v0.18): una conversación por atleta, como la lista de chats de WhatsApp.
// Las que tienen algo sin leer van primero; dentro, el chat entero con esa persona.
export function Conversaciones({ abrirAtleta, alCambiar, peticion = null }) {
  const { api } = useApp();
  const lista = useCarga(() => api.conversaciones(), []);
  const [abierta, setAbierta] = useState(null); // atleta
  const [filtro, setFiltro] = useState('');
  const recargar = useRef(null);
  recargar.current = lista.recargar;
  useEffect(() => { if (peticion?.atletaId) { const a = lista.datos?.find((x) => x.atleta.id === peticion.atletaId)?.atleta; if (a) setAbierta(a); } }, [peticion?.id, lista.datos]);
  // Al momento: por Realtime o notificación, y cada medio minuto
  useEffect(() => {
    let t = null;
    const pronto = () => { clearTimeout(t); t = setTimeout(() => recargar.current?.(true), 300); };
    const cada = setInterval(() => { if (document.visibilityState === 'visible') recargar.current?.(true); }, 30000);
    for (const ev of ['fbe-mensaje', 'fbe-notificacion', 'fbe-cambio']) window.addEventListener(ev, pronto);
    return () => { clearTimeout(t); clearInterval(cada); for (const ev of ['fbe-mensaje', 'fbe-notificacion', 'fbe-cambio']) window.removeEventListener(ev, pronto); };
  }, []);

  if (abierta) {
    return (
      <div class="contenido coach chat-pagina">
        <header class="cabecera cabecera-chat">
          <button class="btn btn-icono plano" onClick={() => { setAbierta(null); lista.recargar(true); alCambiar?.(); }} aria-label="Volver a mensajes"><Icono n="atras" /></button>
          <Avatar nombre={abierta.nombre} />
          <div class="titulo"><h1>{abierta.nombre}</h1><div class="sub">{abierta.objetivo || ''}</div></div>
          <button class="btn btn-peq" onClick={() => abrirAtleta(abierta.id, 'programa')}>Ficha</button>
        </header>
        <Chat atletaId={abierta.id} nombreAtleta={abierta.nombre} alCambiar={() => { lista.recargar(true); alCambiar?.(); }} alLeer={() => { lista.recargar(true); alCambiar?.(); }}
          irContexto={(ctx) => abrirAtleta(abierta.id, ctx.tipo === 'sesion' ? 'registro' : ctx.tipo === 'checkin' ? 'seguimiento' : 'videos')} />
      </div>
    );
  }

  const filas = (lista.datos || []).filter((x) => !filtro.trim() || x.atleta.nombre.toLowerCase().includes(filtro.trim().toLowerCase()));
  const sinLeer = (lista.datos || []).reduce((t, x) => t + x.sinLeer, 0);
  return (
    <div class="contenido coach">
      <header class="cabecera">
        <div class="titulo"><h1>Mensajes</h1><div class="sub">{sinLeer ? `${sinLeer} sin leer` : 'Al día'}</div></div>
      </header>
      <BandaDemo />
      <ErrorCaja error={lista.error} reintentar={lista.recargar} />
      {(lista.datos?.length || 0) > 6 && (
        <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" placeholder="Buscar atleta" aria-label="Buscar atleta" value={filtro} onInput={(e) => setFiltro(e.currentTarget.value)} /></div>
      )}
      {lista.cargando && !lista.datos ? <Siluetas forma="filas" n={5} texto="Cargando las conversaciones" /> : !filas.length ? (
        <div class="panel"><Vacio icono="mensaje" titulo="Sin conversaciones">Cuando des de alta a un atleta, su chat aparecerá aquí.</Vacio></div>
      ) : (
        <div class="panel">
          <ul class="lista conversaciones">
            {filas.map(({ atleta, ultimo, sinLeer: n }) => (
              <li key={atleta.id}>
                <button class={`conversacion ${n ? 'sin-leer' : ''}`} onClick={() => setAbierta(atleta)}>
                  <Avatar nombre={atleta.nombre} clase="grande" />
                  <span class="conv-texto">
                    <span class="conv-cab"><strong>{atleta.nombre}</strong>{ultimo && <span class="mini terciario">{cuando(ultimo.creado_en)}</span>}</span>
                    <span class="conv-ultimo">{ultimo ? <>{ultimo.autor === 'coach' ? <span class="terciario">Tú: </span> : null}{ultimo.archivo_id && (ultimo.texto === 'Foto' || ultimo.texto === 'Vídeo') ? <><Icono n="camara" /> {ultimo.texto}</> : ultimo.texto}</> : <span class="terciario">Sin mensajes todavía</span>}</span>
                  </span>
                  {n > 0 && <span class="conv-n num" aria-label={`${n} sin leer`}>{n}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
