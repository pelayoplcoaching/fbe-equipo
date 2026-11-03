import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Hoja, Icono, useApp, useCarga, Cargando, Vacio, ErrorCaja } from '../comunes.jsx';
import { ElegirAtletas } from '../chat/Reenviar.jsx';
import { HojaProgramar } from '../Programar.jsx';
import { capturarPoster } from '../Archivos.jsx';
import { fmtProgramado } from '../../logica/fechas.js';
import { planDifusion, textoSaltados, esPdf, paginasPdf, PDF_MAX_MB, tamanoTexto, nombreSeguroPdf } from '../../logica/chat.js';
import { LIMITE_ARCHIVO_MB } from '../../datos/api.js';
import { HojaEncuesta } from '../chat/Encuesta.jsx';

// Las listas de difusión del coach (v0.55, migración 033), como las de WhatsApp: listas con nombre («Nutrición»,
// «Compiten»…) y un mensaje que llega a cada uno por separado, en su chat (lo que contesten, a cada chat). Nadie ve la
// lista ni quién más está. Los de baja se saltan (y se dice cuántos). Con texto, se puede programar.
export function HojaDifusion({ alCerrar, alEnviado }) {
  const { api } = useApp();
  const listas = useCarga(() => api.listasDifusion(), []);
  const atletas = useCarga(() => api.atletas(), []);
  const [vista, setVista] = useState({ paso: 'elegir' });  // elegir | editar (lista|null) | escribir (lista)
  const A = useMemo(() => [...(atletas.datos || [])].sort((a, b) => (a.estado === 'baja') - (b.estado === 'baja') || a.nombre.localeCompare(b.nombre)), [atletas.datos]);
  const volver = () => { setVista({ paso: 'elegir' }); listas.recargar(true); };
  if (vista.paso === 'editar') return <HojaLista lista={vista.lista} atletas={A} alCerrar={volver} alGuardada={volver} />;
  if (vista.paso === 'escribir') {
    return <HojaEscribirDifusion lista={vista.lista} atletas={A} alCerrar={volver} alEnviado={(r) => { alEnviado?.(r); alCerrar(); }} />;
  }
  return (
    <Hoja titulo="Nuevo mensaje de difusión" alCerrar={alCerrar} medio>
      <p class="peq secundario">Le llega a cada atleta de la lista por separado, en su chat contigo. No ven la lista ni a los demás.</p>
      <ErrorCaja error={listas.error} reintentar={listas.recargar} />
      {listas.cargando && !listas.datos ? <Cargando /> : !listas.error && (
        <>
          {!(listas.datos || []).length ? (
            <Vacio icono="equipo" titulo="Sin listas de difusión">Crea una con los atletas a los que sueles escribir lo mismo (los que compiten, los de nutrición…).</Vacio>
          ) : (
            <ul class="lista hoja-acciones difusion-listas">
              {listas.datos.map((l) => {
                const { destinos, saltados } = planDifusion(l.miembros, A);
                return (
                  <li key={l.id} class="difusion-lista">
                    <button type="button" class="accion-fila" onClick={() => setVista({ paso: 'escribir', lista: l })}>
                      <span class="ico"><Icono n="equipo" /></span>
                      <span class="pila-xs"><strong>{l.nombre}</strong><span class="peq secundario">{destinos.length === 1 ? '1 atleta' : `${destinos.length} atletas`}{saltados ? ` · ${textoSaltados(saltados)}` : ''}</span></span>
                      <Icono n="derecha" class="cola" />
                    </button>
                    <button type="button" class="btn btn-icono plano" aria-label={`Cambiar la lista ${l.nombre}`} onClick={() => setVista({ paso: 'editar', lista: l })}><Icono n="editar" /></button>
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" class="btn" onClick={() => setVista({ paso: 'editar', lista: null })}><Icono n="mas" /> Nueva lista</button>
        </>
      )}
    </Hoja>
  );
}

function HojaLista({ lista, atletas, alCerrar, alGuardada }) {
  const { api, aviso } = useApp();
  const [nombre, setNombre] = useState(lista?.nombre || '');
  const [miembros, setMiembros] = useState(lista?.miembros || []);
  const [ocupado, setOcupado] = useState(false);
  const [borrar, setBorrar] = useState(false);
  async function guardar(e) {
    e?.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    try { await api.guardarListaDifusion({ id: lista?.id || null, nombre, miembros }); aviso(lista ? 'Lista guardada' : 'Lista creada'); alGuardada(); }
    catch (err) { aviso(err.message, 'error'); } finally { setOcupado(false); }
  }
  async function quitar() {
    try { await api.borrarListaDifusion(lista.id); aviso('Lista borrada (los mensajes enviados se quedan en cada chat)'); alGuardada(); } catch (err) { aviso(err.message, 'error'); }
  }
  return (
    <Hoja titulo={lista ? `Lista «${lista.nombre}»` : 'Nueva lista de difusión'} alCerrar={alCerrar} medio>
      <form class="pila" onSubmit={guardar}>
        <div class="campo"><label for="difusion-nombre">Nombre de la lista</label>
          <input id="difusion-nombre" class="entrada" maxLength={40} required value={nombre} placeholder="Nutrición, Compiten…" onInput={(e) => setNombre(e.currentTarget.value)} /></div>
        <ElegirAtletas atletas={atletas} elegidos={miembros} alCambiar={setMiembros} etiqueta="Quién está en la lista" />
        <p class="peq secundario" role="status">{miembros.length === 1 ? '1 atleta' : `${miembros.length} atletas`}</p>
        <div class="fila-envolver hoja-pie-fijo">
          <button class="btn btn-primario" disabled={ocupado || !nombre.trim()}><Icono n="hecho" /> Guardar</button>
          {lista && <button type="button" class="btn btn-peligro" onClick={() => setBorrar(true)}><Icono n="basura" /> Borrar la lista</button>}
        </div>
      </form>
      {borrar && (
        <Hoja titulo="¿Borrar la lista?" alCerrar={() => setBorrar(false)}>
          <p class="secundario">Se borra la lista; lo que ya enviaste se queda en el chat de cada uno.</p>
          <div class="fila-envolver"><button type="button" class="btn btn-peligro" onClick={quitar}><Icono n="basura" /> Borrar</button><button type="button" class="btn plano" onClick={() => setBorrar(false)}>No borrar</button></div>
        </Hoja>
      )}
    </Hoja>
  );
}

function HojaEscribirDifusion({ lista, atletas, alCerrar, alEnviado }) {
  const { api, aviso } = useApp();
  const [texto, setTexto] = useState('');
  const [adjunto, setAdjunto] = useState(null); // { archivo, url, esPdf, esVideo, paginas }
  const [enviando, setEnviando] = useState(false);
  const [programar, setProgramar] = useState(false);
  const [encuesta, setEncuesta] = useState(false); // v0.56: una encuesta a la lista (cada uno, la suya)
  const { destinos, saltados } = planDifusion(lista.miembros, atletas);
  // Este envío (su id y lo ya subido): al reintentar tras un fallo se reutiliza (no sale dos veces); con otro texto u
  // otro archivo, es otro envío
  const envio = useRef({});
  useEffect(() => { envio.current = {}; }, [texto, adjunto]);
  useEffect(() => () => { if (adjunto?.url) URL.revokeObjectURL(adjunto.url); }, [adjunto]);
  async function elegir(e) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    if (f.type === 'application/pdf') {
      if (f.size > PDF_MAX_MB * 1024 * 1024) { aviso(`El PDF pesa más de ${PDF_MAX_MB} MB`, 'error'); return; }
      const cab = new Uint8Array(await f.slice(0, 1024).arrayBuffer());
      if (!esPdf(cab)) { aviso('Ese archivo no es un PDF', 'error'); return; }
      const paginas = f.size <= 8 * 1048576 ? paginasPdf(new TextDecoder('latin1').decode(await f.arrayBuffer())) : null;
      setAdjunto({ archivo: f, esPdf: true, paginas });
      return;
    }
    if (!/^(image|video)\//.test(f.type || '')) { aviso('Fotos, vídeos o PDF', 'error'); return; }
    if (f.size > LIMITE_ARCHIVO_MB * 1024 * 1024) { aviso(`Pesa más de ${LIMITE_ARCHIVO_MB} MB`, 'error'); return; }
    let url = null;
    try { url = URL.createObjectURL(f); } catch { /* */ }
    setAdjunto({ archivo: f, url, esVideo: /^video\//.test(f.type) });
  }
  async function enviar(enviarEn = null) {
    if (enviando) return;
    setEnviando(true);
    try {
      let poster = null, duracion_seg = null;
      if (adjunto?.esVideo) { const cap = await capturarPoster(adjunto.archivo).catch(() => null); poster = cap?.poster || null; duracion_seg = cap?.duracion ?? null; }
      const r = await api.difundir({ listaId: lista.id, texto, archivo: adjunto?.archivo || null, enviarEn, paginas: adjunto?.paginas || null, poster, duracion_seg, envio: envio.current });
      aviso([enviarEn ? `Programada para el ${fmtProgramado(enviarEn)} a ${r.enviados}` : `Enviada a ${r.enviados} ${r.enviados === 1 ? 'atleta' : 'atletas'}`, textoSaltados(r.saltados)].filter(Boolean).join('. '));
      alEnviado?.(r);
    } catch (e) { aviso(e.message, 'error'); } finally { setEnviando(false); setProgramar(false); }
  }
  return (
    <Hoja titulo={`Difusión: ${lista.nombre}`} alCerrar={alCerrar} medio>
      <form class="pila" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        <p class="peq">{destinos.length === 1 ? 'Para 1 atleta' : `Para ${destinos.length} atletas`}, cada uno en su chat.{saltados ? <> <strong>{textoSaltados(saltados)}.</strong></> : null}</p>
        <div class="campo"><label for="difusion-texto">{adjunto ? 'Pie (opcional)' : 'Mensaje'}</label>
          <textarea id="difusion-texto" class="area" rows={4} maxLength={4000} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="Escribe el mensaje…" /></div>
        {adjunto ? (
          <div class="difusion-adjunto">
            {adjunto.esPdf ? <span class="doc-chat mini" aria-hidden="true"><span class="doc-chat-ico"><Icono n="documento" /><span>PDF</span></span><span class="doc-chat-texto"><strong class="doc-chat-nombre">{nombreSeguroPdf(adjunto.archivo.name)}</strong><span class="mini secundario">{tamanoTexto(adjunto.archivo.size)}</span></span></span>
              : adjunto.url && (adjunto.esVideo ? <video src={adjunto.url} muted playsInline preload="metadata" /> : <img src={adjunto.url} alt="" />)}
            <button type="button" class="btn btn-peq" onClick={() => setAdjunto(null)}><Icono n="cerrar" /> Quitar {adjunto.esPdf ? 'el documento' : adjunto.esVideo ? 'el vídeo' : 'la foto'}</button>
          </div>
        ) : (
          <label class="btn btn-peq difusion-adjuntar"><Icono n="clip" /> Adjuntar foto, vídeo o PDF
            <input type="file" class="sr" accept="image/*,video/*,application/pdf,.pdf" onChange={elegir} /></label>
        )}
        <div class="fila-envolver">
          <button class="btn btn-primario" disabled={enviando || !destinos.length || (!texto.trim() && !adjunto)}><Icono n="enviar" /> {enviando ? 'Enviando…' : 'Enviar'}</button>
          <button type="button" class="btn" disabled={enviando || !texto.trim() || !!adjunto || !destinos.length} onClick={() => setProgramar(true)}><Icono n="reloj" /> Programar</button>
          <button type="button" class="btn" disabled={enviando || !destinos.length} onClick={() => setEncuesta(true)}><Icono n="encuesta" /> Encuesta</button>
        </div>
      </form>
      {encuesta && <HojaEncuesta listaId={lista.id} para={`«${lista.nombre}»`} alCerrar={() => setEncuesta(false)} alEnviada={(r) => { setEncuesta(false); alEnviado?.(r); }} />}
      {programar && <HojaProgramar titulo={`Programar la difusión «${lista.nombre}»`} alCerrar={() => setProgramar(false)} alGuardar={({ enviarEn }) => enviar(enviarEn)} />}
    </Hoja>
  );
}
