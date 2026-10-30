import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono } from './comunes.jsx';
import { capturarPoster } from './Archivos.jsx';
import { EVENTO_PENDIENTES, listarPendientes, quitarPendiente, marcarPendiente, archivoDe, conCerrojo } from '../datos/pendientes.js';

// Envía solos los vídeos que se quedaron guardados en el móvil sin cobertura (v0.33): al abrir la app, al volver
// a ella, al recuperar la conexión y cada minuto mientras quede alguno. Va siempre (en cualquier pestaña).
export function usePendientesArchivos(api, atletaId, aviso) {
  const [lista, setLista] = useState([]);
  const [envio, setEnvio] = useState(null); // { id, progreso }
  const ocupado = useRef(false);
  const vivo = useRef(0); // generación: al cerrar sesión (o cambiar de atleta) el envío en marcha deja de seguir

  const leer = async () => { if (atletaId) setLista(await listarPendientes(atletaId)); };
  async function intentar({ todos = false } = {}) {
    if (ocupado.current || !atletaId) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    ocupado.current = true;
    const g = vivo.current;
    try {
      for (const p of await listarPendientes(atletaId)) {
        if (g !== vivo.current) break;
        if (p.error && !todos) continue; // lo que el servidor rechazó espera a que la persona lo reintente
        let enviado = false, seguir = true;
        const r = await conCerrojo(p.id, async () => {
          setEnvio({ id: p.id, progreso: 0 });
          try {
            const f = archivoDe(p);
            const cap = /^video/.test(f.type || '') || p.opciones?.tipo === 'video_tecnica' ? await capturarPoster(f).catch(() => null) : null;
            await api.subirArchivo(atletaId, f, { ...p.opciones, poster: cap?.poster || null, duracion_seg: p.opciones?.duracion_seg ?? cap?.duracion ?? null, alProgreso: (x) => setEnvio({ id: p.id, progreso: x }) });
            enviado = true;
          } catch (e) {
            if (e?.sinConexion || e?.cancelado) { seguir = false; return; } // sigue sin cobertura: se reintenta luego
            if (g === vivo.current) await marcarPendiente(p.id, e?.message || 'No se ha podido enviar').catch(() => {});
          }
        });
        if (r === 'ocupado') continue; // lo está enviando la hoja de subir u otra pestaña
        if (enviado) {
          await quitarPendiente(p.id).catch(() => {});
          aviso?.(p.opciones?.tipo === 'video_tecnica' ? 'Vídeo pendiente enviado a tu coach' : 'Foto pendiente guardada');
        }
        if (!seguir) break;
      }
    } finally { ocupado.current = false; setEnvio(null); leer(); }
  }

  useEffect(() => {
    leer();
    intentar();
    const cambio = () => leer();
    const conexion = () => intentar();
    const visible = () => { if (document.visibilityState === 'visible') intentar(); };
    window.addEventListener(EVENTO_PENDIENTES, cambio);
    window.addEventListener('online', conexion);
    document.addEventListener('visibilitychange', visible);
    const cada = setInterval(() => intentar(), 60000);
    return () => { vivo.current++; window.removeEventListener(EVENTO_PENDIENTES, cambio); window.removeEventListener('online', conexion); document.removeEventListener('visibilitychange', visible); clearInterval(cada); };
  }, [atletaId]);
  // Al guardarse uno nuevo, se intenta enseguida (por si la cobertura ha vuelto)
  useEffect(() => { if (lista.some((p) => !p.error) && !ocupado.current) { const t = setTimeout(() => intentar(), 4000); return () => clearTimeout(t); } return undefined; }, [lista.length]);

  return {
    lista, envio,
    reintentar: () => intentar({ todos: true }),
    // Descartar: también su registro, si llegó a hacerse (no debe quedar un vídeo sin archivo)
    descartar: async (id) => { const p = lista.find((x) => x.id === id); await api.descartarSubida(p?.opciones?.ruta).catch(() => {}); await quitarPendiente(id); },
  };
}

export function BandaPendientes({ pendientes }) {
  const { lista, envio, reintentar, descartar } = pendientes;
  if (!lista.length) return null;
  const conError = lista.filter((p) => p.error);
  const esperando = lista.length - conError.length;
  const que = (n) => `${n} vídeo${n > 1 ? 's' : ''}`;
  return (
    <div class="banda-conexion banda-pendientes" role="status">
      <Icono n={envio ? 'enviar' : 'sinred'} />
      <div class="pila-xs">
        {esperando > 0 && <span>{envio
          ? `Enviando ${esperando > 1 ? `${que(esperando)} guardados` : 'el vídeo guardado'} sin cobertura… ${Math.round((envio.progreso || 0) * 100)} %`
          : `${que(esperando)} guardado${esperando > 1 ? 's' : ''} en el móvil: se enviará${esperando > 1 ? 'n' : ''} solo${esperando > 1 ? 's' : ''} cuando haya cobertura.`}</span>}
        {conError.map((p) => (
          <span key={p.id} class="peq">No se ha podido enviar un vídeo: {p.error}{' '}
            <button type="button" class="btn-texto" onClick={reintentar}>Reintentar</button>{' '}
            <button type="button" class="btn-texto" onClick={() => descartar(p.id)}>Descartar</button>
          </span>
        ))}
      </div>
    </div>
  );
}
