import { useEffect, useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Cargando, Icono } from './comunes.jsx';
import { SubirArchivo } from './Archivos.jsx';
import { queToca } from '../logica/plan.js';

// «Compartir → FBE Equipo» un vídeo desde la galería (v0.48, Android con la app instalada). El service worker lo deja
// en una caché aparte del móvil y abre la app con ?compartido=1; aquí se coge, se elige el ejercicio y se envía como
// vídeo de técnica con el recorte y la subida de siempre (por trozos, y guardado en el móvil si no hay cobertura).
// En iPhone una app web no puede recibir lo que se comparte: allí se sigue enviando desde la sesión o el diario.
import { LIMITE_ARCHIVO_MB } from '../datos/api.js';
import { PDF_MAX_MB } from '../logica/chat.js';
const CACHE = 'fbe-compartido';
// Como en sw.js: una dirección que no existe (nadie puede pedirla) y solo MP4, MOV o WebM de hasta LIMITE_ARCHIVO_MB
export const CLAVE_COMPARTIDO = 'https://fbe-compartido.invalid/video';
const TIPOS_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm'];
export const pideCompartido = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('compartido') != null;
// Quita de la dirección lo que solo servía para abrir la app (?compartido, ?accion), sin tocar lo demás (?demo)
export function limpiarDireccion(claves = ['compartido', 'accion']) {
  try {
    const u = new URL(location.href);
    let cambia = false;
    for (const k of claves) if (u.searchParams.has(k)) { u.searchParams.delete(k); cambia = true; }
    if (cambia) history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`);
  } catch { /* */ }
}
// Lo coge una vez: en cuanto se lee, se borra del móvil (si no se envía, hay que volver a compartirlo)
// v0.56: todo lo compartido (fotos, vídeos y PDF, hasta 10), con los mismos tipos y tamaños que el service worker
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const CLAVE_LISTA = 'https://fbe-compartido.invalid/lista';
const claveArchivo = (i) => `https://fbe-compartido.invalid/archivo/${i}`;
export const valeCompartido = (tipo, bytes) => {
  const t = String(tipo || '').toLowerCase();
  if (!(bytes > 0)) return false;
  if (t === 'application/pdf') return bytes <= PDF_MAX_MB * 1024 * 1024;
  return (TIPOS_VIDEO.includes(t) || TIPOS_FOTO.includes(t)) && bytes <= LIMITE_ARCHIVO_MB * 1024 * 1024;
};
async function aArchivo(r, nombreDefecto) {
  const tipo = String(r.headers.get('content-type') || '').toLowerCase();
  const blob = await r.blob();
  if (!valeCompartido(tipo, blob.size)) return null;
  let nombre = nombreDefecto;
  try { nombre = decodeURIComponent(r.headers.get('x-nombre') || nombre).slice(0, 120); } catch { /* */ }
  return new File([blob], nombre, { type: tipo });
}
export async function leerCompartidos() {
  if (typeof caches === 'undefined') return [];
  try {
    const c = await caches.open(CACHE);
    const out = [];
    const lista = await c.match(CLAVE_LISTA);
    if (lista) {
      const n = Math.min(10, Number((await lista.json())?.n) || 0);
      for (let i = 0; i < n; i++) { const r = await c.match(claveArchivo(i)); if (r) { const f = await aArchivo(r, 'archivo'); if (f) out.push(f); } }
    } else {
      // (lo que compartió la v0.48: un vídeo)
      const r = await c.match(CLAVE_COMPARTIDO);
      if (r) { const f = await aArchivo(r, 'video.mp4'); if (f && TIPOS_VIDEO.includes(f.type)) out.push(f); }
    }
    await borrarCompartido();
    return out;
  } catch { return []; }
}
export async function leerCompartido() {
  const fs = await leerCompartidos();
  return fs.length === 1 && TIPOS_VIDEO.includes(fs[0].type) ? fs[0] : null;
}
export async function borrarCompartido() {
  try { if (typeof caches !== 'undefined') { const c = await caches.open(CACHE); for (const k of await c.keys()) await c.delete(k); } } catch { /* */ }
}
// Para el chat: lo compartido espera aquí (en memoria) a que se abra la conversación elegida, que lo pone en su bandeja de
// adjuntos (sin enviarlo: se envía como cualquier foto, vídeo o PDF)
let paraChat = null;
export function dejarParaChat(atletaId, archivos) {
  paraChat = { atletaId, archivos };
  try { window.dispatchEvent(new CustomEvent('fbe-compartidos', { detail: { atletaId } })); } catch { /* */ }
}
export function tomarParaChat(atletaId) {
  if (!paraChat || paraChat.atletaId !== atletaId) return null;
  const x = paraChat.archivos;
  paraChat = null;
  return x;
}
const resumen = (fs) => {
  const n = fs.length;
  const fotos = fs.filter((f) => /^image\//.test(f.type)).length, videos = fs.filter((f) => /^video\//.test(f.type)).length, pdf = n - fotos - videos;
  return [fotos && `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`, videos && `${videos} ${videos === 1 ? 'vídeo' : 'vídeos'}`, pdf && `${pdf} PDF`].filter(Boolean).join(', ');
};

// Coach: lo que ha compartido, a la conversación que elija (se abre con ello en sus adjuntos)
export function RecibirCompartidoCoach({ alAbrirChat }) {
  const { api, aviso } = useApp();
  const [archivos, setArchivos] = useState(null);
  const atletas = useCarga(() => (archivos ? api.atletas() : Promise.resolve([])), [!!archivos]);
  useEffect(() => {
    if (!pideCompartido()) return;
    const ok = new URLSearchParams(location.search).get('compartido') === '1';
    limpiarDireccion(['compartido', 'accion']);
    leerCompartidos().then((fs) => { if (fs.length) setArchivos(fs); else if (ok) aviso('No ha llegado nada que se pueda enviar: fotos, vídeos o PDF', 'error'); });
  }, []);
  if (!archivos) return null;
  const lista = (atletas.datos || []).filter((a) => a.estado !== 'baja').sort((a, b) => a.nombre.localeCompare(b.nombre));
  const elegir = (a) => { dejarParaChat(a.id, archivos); setArchivos(null); alAbrirChat(a.id); };
  return (
    <Hoja titulo="Enviar a…" alCerrar={() => setArchivos(null)} medio>
      <p class="peq secundario"><Icono n="clip" /> {resumen(archivos)}. Elige la conversación: se abre con ello listo para enviar (puedes añadir un pie).</p>
      <p class="nota-coach"><Icono n="alerta" /><span>Te llega desde otra app: comprueba que es tuyo (y lo que se ve) antes de enviarlo. No sale nada hasta que lo envíes tú.</span></p>
      {atletas.cargando && !atletas.datos ? <Cargando texto="Cargando tus atletas" /> : (
        <ul class="lista hoja-acciones">
          {lista.map((a) => <li key={a.id}><button type="button" class="accion-fila" onClick={() => elegir(a)}><span class="ico"><Icono n="mensaje" /></span><span class="pila-xs"><strong>{a.nombre}</strong></span><Icono n="derecha" class="cola" /></button></li>)}
        </ul>
      )}
    </Hoja>
  );
}

// Atleta: lo que ha compartido, para enviarlo a su coach como vídeo de un ejercicio
export function RecibirCompartido({ programa }) {
  const { api, atleta, aviso, propio } = useApp();
  const [archivo, setArchivo] = useState(null);
  const [mirado, setMirado] = useState(false);
  const [ejercicio, setEjercicio] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (!pideCompartido()) return;
    const ok = new URLSearchParams(location.search).get('compartido') === '1';
    limpiarDireccion(['compartido']);
    if (propio || atleta.estado === 'baja') { borrarCompartido(); if (ok) aviso(atleta.estado === 'baja' ? 'Tu cuenta está de baja: no se puede enviar el vídeo' : 'En el modo atleta no se envían vídeos'); return; }
    // (v0.56) un vídeo solo: elegir si va como vídeo de técnica o por el chat; lo demás (fotos, PDF, varios), al chat
    leerCompartidos().then((fs) => {
      setMirado(true);
      if (fs.length === 1 && TIPOS_VIDEO.includes(fs[0].type)) setArchivo(fs[0]);
      else if (fs.length) { dejarParaChat(atleta.id, fs); irAlChat(); }
      else if (ok) aviso('No ha llegado nada que se pueda enviar: fotos, vídeos o PDF', 'error');
    });
  }, []);
  const irAlChat = () => { try { if (location.hash !== '#mensajes') location.hash = '#mensajes'; else window.dispatchEvent(new HashChangeEvent('hashchange')); } catch { /* */ } };
  // Los ejercicios de esta semana primero; si no, toda la biblioteca
  const opciones = useCarga(async () => {
    if (!archivo) return [];
    const p = programa?.datos;
    const sesiones = p?.actual ? p.sesiones[p.actual.id] || [] : [];
    const sig = p?.actual ? queToca(sesiones, p.actual).siguiente : null;
    const det = sig ? await api.sesion(sig.id, atleta.id).catch(() => null) : null;
    const semana = (det?.ejercicios || []).map((e) => e.ejercicio);
    const todos = await api.biblioteca().catch(() => []);
    const vistos = new Set(semana.map((e) => e.id));
    return [...semana.map((e) => ({ ...e, deHoy: true })), ...todos.filter((e) => e.activo !== false && !vistos.has(e.id))];
  }, [!!archivo]);
  if (!archivo || !mirado) return null;
  const cerrar = () => { setArchivo(null); borrarCompartido(); };
  const elegido = (opciones.datos || []).find((e) => e.id === ejercicio);
  if (enviando && elegido) {
    return <SubirArchivo atletaId={atleta.id} ejercicioId={elegido.id} titulo={`Vídeo: ${elegido.nombre}`} inicial={archivo}
      alSubir={() => { setEnviando(false); cerrar(); }} alGuardarEnMovil={() => { setEnviando(false); cerrar(); }} alCancelar={() => setEnviando(false)} />;
  }
  const deHoy = (opciones.datos || []).filter((e) => e.deHoy), resto = (opciones.datos || []).filter((e) => !e.deHoy);
  return (
    <Hoja titulo="Enviar el vídeo a tu coach" alCerrar={cerrar}>
      <div class="pila">
        <p class="nota-coach"><Icono n="alerta" /><span>Este vídeo te llega desde otra app: comprueba que es tuyo antes de enviarlo.</span></p>
        <p class="peq secundario"><Icono n="video" /> {archivo.name || 'Vídeo'}, {(archivo.size / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB. Antes de enviarlo podrás recortarlo para quedarte solo con la serie.</p>
        {opciones.cargando && !opciones.datos ? <Cargando texto="Cargando tus ejercicios" /> : (
          <div class="campo"><label for="compartido-ej">¿De qué ejercicio es?</label>
            <select id="compartido-ej" class="selector" value={ejercicio} onChange={(e) => setEjercicio(e.currentTarget.value)}>
              <option value="">Elige el ejercicio</option>
              {deHoy.length > 0 && <optgroup label="De tu próxima sesión">{deHoy.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</optgroup>}
              <optgroup label={deHoy.length ? 'Otros' : 'Ejercicios'}>{resto.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</optgroup>
            </select></div>
        )}
        <button class="btn btn-primario btn-grande" disabled={!elegido} onClick={() => setEnviando(true)}><Icono n="enviar" /> Seguir</button>
        <button class="btn" onClick={() => { const f = archivo; setArchivo(null); dejarParaChat(atleta.id, [f]); irAlChat(); }}><Icono n="mensaje" /> Enviarlo por el chat</button>
        <button class="btn" onClick={cerrar}>Descartarlo</button>
      </div>
    </Hoja>
  );
}
