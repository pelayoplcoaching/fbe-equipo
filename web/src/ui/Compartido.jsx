import { useEffect, useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Cargando, Icono } from './comunes.jsx';
import { SubirArchivo } from './Archivos.jsx';
import { queToca } from '../logica/plan.js';

// «Compartir → FBE Equipo» un vídeo desde la galería (v0.48, Android con la app instalada). El service worker lo deja
// en una caché aparte del móvil y abre la app con ?compartido=1; aquí se coge, se elige el ejercicio y se envía como
// vídeo de técnica con el recorte y la subida de siempre (por trozos, y guardado en el móvil si no hay cobertura).
// En iPhone una app web no puede recibir lo que se comparte: allí se sigue enviando desde la sesión o el diario.
const CACHE = 'fbe-compartido';
const CLAVE = 'compartido/video';
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
export async function leerCompartido() {
  if (typeof caches === 'undefined') return null;
  try {
    const r = await (await caches.open(CACHE)).match(CLAVE);
    if (!r) return null;
    const blob = await r.blob();
    const nombre = decodeURIComponent(r.headers.get('x-nombre') || 'video.mp4');
    return new File([blob], nombre, { type: blob.type || r.headers.get('content-type') || 'video/mp4' });
  } catch { return null; }
}
export async function borrarCompartido() {
  try { if (typeof caches !== 'undefined') await (await caches.open(CACHE)).delete(CLAVE); } catch { /* */ }
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
    leerCompartido().then((f) => { setMirado(true); if (f) setArchivo(f); else if (ok) aviso('No ha llegado el vídeo: vuelve a compartirlo', 'error'); });
  }, []);
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
        <button class="btn" onClick={cerrar}>Descartarlo</button>
      </div>
    </Hoja>
  );
}
