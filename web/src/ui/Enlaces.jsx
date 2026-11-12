import { Fragment } from 'preact';
import { trozosConEnlaces, tarjetaEnlace } from '../logica/enlaces.js';
import { Icono } from './comunes.jsx';
import { VideoYoutube } from './YouTube.jsx';
import { tokensDeMensaje } from '../logica/formato.js';
import { resaltar } from '../logica/mensajes.js';

// Un texto con sus enlaces que se pueden tocar y, debajo, la miniatura de los vídeos de YouTube que lleve (v0.48).
// La miniatura sale de i.ytimg.com (lo único de fuera que se carga); el enlace normal sigue funcionando.
export function TextoConEnlaces({ texto, como = 'p', clase = '', conVista = true }) {
  const trozos = trozosConEnlaces(texto);
  const videos = conVista ? [...new Map(trozos.filter((x) => x.youtube).map((x) => [x.youtube, x])).values()].slice(0, 3) : [];
  const Etiqueta = como;
  if (!trozos.some((x) => x.tipo === 'enlace')) return <Etiqueta class={clase}>{texto}</Etiqueta>;
  return (
    <>
      <Etiqueta class={clase}>
        {trozos.map((x, i) => (x.tipo === 'texto' ? <Fragment key={i}>{x.valor}</Fragment>
          : <a key={i} href={x.valor} target="_blank" rel="noopener noreferrer" class="enlace-texto">{x.valor.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}{x.valor.length > 70 ? '…' : ''}</a>))}
      </Etiqueta>
      {/* (YouTube) el vídeo se ve aquí mismo, con sus marcas de tiempo si el texto las lleva */}
      {videos.map((v) => <VideoYoutube key={v.youtube} url={v.valor} notas={videos.length === 1 ? texto : ''} compacto clase="vista-youtube-yt" />)}
    </>
  );
}

// v0.54: el texto de un mensaje del chat con el formato de WhatsApp (*negrita*, _cursiva_, ~tachado~, `mono`), sus
// enlaces y sus vistas de YouTube. Se pinta con etiquetas (strong, em, s, code, a), nunca como HTML. resaltar: lo que se
// busca en el chat (se marca donde coincide, con <mark>).
// fin (v0.55): lo que va al final del párrafo (el hueco para la hora y los ✓ de la burbuja, como WhatsApp)
export function TextoChat({ id = null, texto, clase = '', resaltar: consulta = '', conVista = true, fin = null }) {
  const tokens = tokensDeMensaje(id, texto);
  const enlaces = [];
  const juntar = (ts) => { for (const x of ts) { if (x.t === 'enlace') enlaces.push(x); else if (x.hijos) juntar(x.hijos); } };
  juntar(tokens);
  // (v0.56) con el «ahorro de datos» del móvil, sin miniaturas de YouTube (no se pide nada a Google): una tarjeta, como
  // los demás enlaces; de los que no son de YouTube, la tarjeta del primero, con su dominio (sin pedir nada a esa web)
  const ahorro = typeof navigator !== 'undefined' && !!navigator.connection?.saveData;
  const videos = conVista && !ahorro ? [...new Map(enlaces.filter((x) => x.youtube).map((x) => [x.youtube, x])).values()].slice(0, 3) : [];
  const otro = conVista ? enlaces.find((x) => !x.youtube || ahorro) : null;
  const tarjeta = otro ? tarjetaEnlace(otro.v) : null;
  const hoja = (v, k) => (consulta ? resaltar(v, consulta).map((p, i) => (p.marca ? <mark key={`${k}-${i}`} class="chat-marca">{p.v}</mark> : <Fragment key={`${k}-${i}`}>{p.v}</Fragment>)) : v);
  const pintar = (ts, base = 'f') => ts.map((x, i) => {
    const k = `${base}-${i}`;
    if (x.t === 'texto') return <Fragment key={k}>{hoja(x.v, k)}</Fragment>;
    if (x.t === 'mono') return <code key={k} class="chat-mono">{hoja(x.v, k)}</code>;
    if (x.t === 'enlace') return <a key={k} href={x.v} target="_blank" rel="noopener noreferrer" class="enlace-texto">{x.v.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}{x.v.length > 70 ? '…' : ''}</a>;
    const Et = x.t === 'negrita' ? 'strong' : x.t === 'cursiva' ? 'em' : 's';
    return <Et key={k}>{pintar(x.hijos, k)}</Et>;
  });
  return (
    <>
      <p class={clase}>{pintar(tokens)}{fin}</p>
      {/* (YouTube) en el chat, el vídeo se ve dentro de la burbuja */}
      {videos.map((v) => <VideoYoutube key={v.youtube} url={v.v} notas={videos.length === 1 ? texto : ''} compacto clase="vista-youtube-yt" />)}
      {tarjeta && (
        <a class="vista-enlace" href={otro.v} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${otro.youtube ? 'el vídeo de YouTube' : tarjeta.dominio} (en otra pestaña)`}>
          <span class="vista-enlace-ico" aria-hidden="true"><Icono n={otro.youtube ? 'video' : 'enlace'} /></span>
          <span class="pila-xs"><strong class="vista-enlace-dominio">{otro.youtube ? 'YouTube' : tarjeta.dominio}</strong>{tarjeta.ruta && <span class="mini secundario vista-enlace-ruta">{tarjeta.ruta}</span>}</span>
        </a>
      )}
    </>
  );
}
