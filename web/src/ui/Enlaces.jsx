import { Fragment } from 'preact';
import { trozosConEnlaces, miniaturaYoutube } from '../logica/enlaces.js';
import { Icono } from './comunes.jsx';

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
      {videos.map((v) => (
        <a key={v.youtube} class="vista-youtube" href={v.valor} target="_blank" rel="noopener noreferrer" aria-label="Ver el vídeo en YouTube">
          <img src={miniaturaYoutube(v.youtube)} alt="" loading="lazy" width="320" height="180" referrerpolicy="no-referrer" />
          <span class="vista-youtube-play" aria-hidden="true"><Icono n="play" /></span>
          <span class="vista-youtube-pie mini"><Icono n="video" />YouTube</span>
        </a>
      ))}
    </>
  );
}
