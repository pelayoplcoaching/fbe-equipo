import { useEffect, useState } from 'preact/hooks';
import { useApp, Icono } from '../comunes.jsx';
import { tamanoTexto, textoPaginas } from '../../logica/chat.js';

// Un PDF en el chat (v0.55): su icono, su nombre (el saneado que guarda la base), lo que pesa y sus páginas (si se
// supieron). Tocarlo lo abre en otra pestaña con un enlace firmado (caduca en una hora; se pide al pintarlo, para que
// abrirlo sea directo y el navegador no lo bloquee).
export function DocumentoChat({ archivo, mini = false }) {
  const { api, aviso } = useApp();
  const [url, setUrl] = useState(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vivo = true;
    setUrl(null); setFallo(false);
    api.urlArchivo(archivo.ruta).then((u) => vivo && setUrl(u)).catch(() => vivo && setFallo(true));
    return () => { vivo = false; };
  }, [archivo.ruta]);
  const nombre = archivo.nombre || 'documento.pdf';
  const detalle = ['PDF', tamanoTexto(archivo.bytes), textoPaginas(archivo.paginas)].filter(Boolean).join(' · ');
  const dentro = (
    <>
      <span class="doc-chat-ico" aria-hidden="true"><Icono n="documento" /><span>PDF</span></span>
      <span class="doc-chat-texto"><strong class="doc-chat-nombre">{nombre}</strong><span class="mini secundario">{fallo ? 'No se pudo preparar: toca para reintentar' : detalle}</span></span>
    </>
  );
  const etiqueta = `Abrir el documento ${nombre} (${detalle})`;
  if (url) return <a class={`doc-chat ${mini ? 'mini' : ''}`} href={url} target="_blank" rel="noopener noreferrer" aria-label={etiqueta}>{dentro}</a>;
  return (
    <button type="button" class={`doc-chat ${mini ? 'mini' : ''}`} aria-label={etiqueta} onClick={() => {
      api.urlArchivo(archivo.ruta).then((u) => { setUrl(u); setFallo(false); window.open(u, '_blank', 'noopener'); }).catch((e) => { setFallo(true); aviso(e.message, 'error'); });
    }}>{dentro}</button>
  );
}
