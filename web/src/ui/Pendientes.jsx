import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono } from './comunes.jsx';
import { capturarPoster } from './Archivos.jsx';
import { EVENTO_PENDIENTES, listarPendientes, quitarPendiente, marcarPendiente, archivoDe, conCerrojo, ponerSubida, sigueEnElMovil, PERDIDO } from '../datos/pendientes.js';
import { leerRed, motivoEspera, ETIQUETA_ESPERA, TEXTO_ESPERA } from '../logica/red.js';
import { ajuste } from './ajustes.js';
import { subidaEmpieza, subidaProgreso, subidaAcaba, subidaActual, alCambiarSubida } from '../datos/subidas.js';

// (v0.61, 20) Lo que se ha pedido subir ya aunque no haya wifi («Subir ahora»): solo mientras la app está abierta
const forzados = new Set();
// ¿Espera este pendiente a la wifi (o por el ahorro de datos)? null si no
export const esperaDe = (p, red = leerRed()) => (p && !p.error && (p.opciones?.tipo === 'video_tecnica' || /^video/.test(p.mime || ''))
  ? motivoEspera({ soloWifi: ajuste('soloWifi') === true, red, forzado: forzados.has(p.id) }) : null);

// Envía solos los vídeos que se quedaron guardados en el móvil sin cobertura (v0.33): al abrir la app, al volver
// a ella, al recuperar la conexión y cada minuto mientras quede alguno. Va siempre (en cualquier pestaña).
// v0.57: sigue por el trozo en que iba (la dirección de su subida se guarda con él), dice cuánto lleva, se puede cancelar
// y, si el móvil ha perdido el vídeo, pide volver a elegirlo.
// v0.61 (20): con «Subir los vídeos solo con wifi» (o el ahorro de datos) y datos móviles, espera («Esperando wifi», con
// «Subir ahora») y sale solo al cambiar a una wifi (el evento «change» de la conexión, en Chrome de Android); y la píldora de
// arriba enseña cuánto lleva. En segundo plano sigue mientras el navegador deje viva la página (pantalla bloqueada en
// Android, a veces); en el iPhone, con la app suspendida no corre nada: sigue por donde iba al volver a ella. No se usan
// Background Fetch ni Background Sync: no sirven para una subida por trozos (TUS) con el permiso de la sesión, que caduca.
export function usePendientesArchivos(api, atletaId, aviso) {
  const [lista, setLista] = useState([]);
  const [envio, setEnvio] = useState(null); // { id, progreso }
  const [red, setRed] = useState(() => leerRed());
  const ocupado = useRef(false);
  const vivo = useRef(0); // generación: al cerrar sesión (o cambiar de atleta) el envío en marcha deja de seguir
  const senal = useRef(null); // el envío en marcha, para «Cancelar»

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
        if (esperaDe(p)) continue; // (v0.61) espera a la wifi (o «Subir ahora»)
        let enviado = false, seguir = true;
        const r = await conCerrojo(p.id, async () => {
          setEnvio({ id: p.id, progreso: p.progreso || 0 });
          subidaEmpieza(p.id, { nombre: 'Vídeo guardado' }); subidaProgreso(p.id, p.progreso || 0);
          // (v0.57) si el navegador ya no tiene el vídeo (se borró el almacenamiento del móvil), hay que volver a elegirlo
          if (!(await sigueEnElMovil(p))) { await marcarPendiente(p.id, PERDIDO).catch(() => {}); return; }
          const s = senal.current = {};
          try {
            const f = archivoDe(p);
            const cap = /^video/.test(f.type || '') || p.opciones?.tipo === 'video_tecnica' ? await capturarPoster(f).catch(() => null) : null;
            let ultimo = 0;
            const hecho = await api.subirArchivo(atletaId, f, { ...p.opciones, poster: cap?.poster || null, duracion_seg: p.opciones?.duracion_seg ?? cap?.duracion ?? null, senal: s,
              urlSubida: p.urlSubida || null, alUrlSubida: (url) => ponerSubida(p.id, { url }).catch(() => {}),
              alProgreso: (x) => { setEnvio({ id: p.id, progreso: x }); subidaProgreso(p.id, x); if (x - ultimo >= 0.05) { ultimo = x; ponerSubida(p.id, { progreso: x }).catch(() => {}); } } });
            enviado = hecho?.anguloPerdido ? 'sin-angulo' : true;
          } catch (e) {
            if (e?.cancelado) { seguir = false; await api.descartarSubida(p.opciones?.ruta).catch(() => {}); await quitarPendiente(p.id).catch(() => {}); aviso?.('Envío cancelado'); return; }
            if (e?.sinConexion) { seguir = false; return; } // sigue sin cobertura: se reintenta luego (por donde iba)
            if (g === vivo.current) await marcarPendiente(p.id, e?.message || 'No se ha podido enviar').catch(() => {});
          }
        });
        if (r !== 'ocupado') subidaAcaba(p.id, { ok: !!enviado });
        if (r === 'ocupado') continue; // lo está enviando la hoja de subir u otra pestaña
        if (enviado) {
          forzados.delete(p.id);
          await quitarPendiente(p.id).catch(() => {});
          // (v0.60) si su otro ángulo ya no estaba, sale sin el enlace (y se dice)
          aviso?.(enviado === 'sin-angulo' ? 'Vídeo pendiente enviado, pero ya no va como otro ángulo: el vídeo con el que iba se ha borrado o ya tiene pareja'
            : p.opciones?.tipo === 'video_tecnica' ? 'Vídeo pendiente enviado a tu coach' : 'Foto pendiente guardada');
        }
        if (!seguir) break;
      }
    } finally { ocupado.current = false; senal.current = null; setEnvio(null); leer(); }
  }

  useEffect(() => {
    leer();
    intentar();
    const cambio = () => leer();
    const conexion = () => intentar();
    const visible = () => { if (document.visibilityState === 'visible') intentar(); };
    // (v0.61) al cambiar de red (de datos móviles a wifi), lo que esperaba sale solo
    const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
    const cambiaRed = () => { setRed(leerRed()); intentar(); };
    conn?.addEventListener?.('change', cambiaRed);
    window.addEventListener(EVENTO_PENDIENTES, cambio);
    window.addEventListener('online', conexion);
    document.addEventListener('visibilitychange', visible);
    const cada = setInterval(() => intentar(), 60000);
    return () => { vivo.current++; conn?.removeEventListener?.('change', cambiaRed); window.removeEventListener(EVENTO_PENDIENTES, cambio); window.removeEventListener('online', conexion); document.removeEventListener('visibilitychange', visible); clearInterval(cada); };
  }, [atletaId]);
  // Al guardarse uno nuevo, se intenta enseguida (por si la cobertura ha vuelto)
  useEffect(() => { if (lista.some((p) => !p.error) && !ocupado.current) { const t = setTimeout(() => intentar(), 4000); return () => clearTimeout(t); } return undefined; }, [lista.length]);

  return {
    lista: lista.map((p) => ({ ...p, espera: esperaDe(p, red) })), envio,
    subirAhora: (id) => { forzados.add(id); setLista((l) => [...l]); intentar(); },
    reintentar: () => intentar({ todos: true }),
    cancelar: () => { const s = senal.current; if (s?.abortar) s.abortar(); else if (s) s.cancelada = true; },
    // Descartar: también su registro, si llegó a hacerse (no debe quedar un vídeo sin archivo)
    descartar: async (id) => { const p = lista.find((x) => x.id === id); await api.descartarSubida(p?.opciones?.ruta).catch(() => {}); await quitarPendiente(id); },
  };
}

export function BandaPendientes({ pendientes }) {
  const { lista, envio, reintentar, descartar, cancelar, subirAhora } = pendientes;
  if (!lista.length) return null;
  const conError = lista.filter((p) => p.error);
  // (v0.61) los que esperan a la wifi (o por el ahorro de datos), aparte, con «Subir ahora»
  const enEspera = lista.filter((p) => !p.error && p.espera);
  const esperando = lista.length - conError.length - enEspera.length;
  const que = (n) => `${n} vídeo${n > 1 ? 's' : ''}`;
  return (
    <div class="banda-conexion banda-pendientes" role="status">
      <Icono n={envio ? 'enviar' : enEspera.length && !esperando && !conError.length ? 'reloj' : 'sinred'} />
      <div class="pila-xs">
        {esperando > 0 && <span>{envio
          ? <>{`Enviando ${esperando > 1 ? `${que(esperando)} guardados` : 'el vídeo guardado'}… ${Math.round((envio.progreso || 0) * 100)} %`}{' '}
              <button type="button" class="btn-texto" onClick={cancelar}>Cancelar</button></>
          : `${que(esperando)} guardado${esperando > 1 ? 's' : ''} en el móvil: se enviará${esperando > 1 ? 'n' : ''} solo${esperando > 1 ? 's' : ''} cuando haya cobertura${lista.some((p) => !p.error && p.progreso > 0) ? ', por donde iba' : ''}.`}</span>}
        {envio && <span class="banda-progreso" aria-hidden="true"><span style={{ width: `${Math.round((envio.progreso || 0) * 100)}%` }} /></span>}
        {enEspera.map((p) => (
          <span key={p.id} class="peq banda-espera"><b>{ETIQUETA_ESPERA[p.espera]}:</b> {TEXTO_ESPERA[p.espera]}{' '}
            <button type="button" class="btn-texto" onClick={() => subirAhora(p.id)}>Subir ahora</button>{' '}
            <button type="button" class="btn-texto" onClick={() => descartar(p.id)}>Descartar</button>
          </span>
        ))}
        {conError.map((p) => (
          <span key={p.id} class="peq">{p.error === PERDIDO ? p.error : `No se ha podido enviar un vídeo: ${p.error}`}{' '}
            {p.error !== PERDIDO && <><button type="button" class="btn-texto" onClick={reintentar}>Reintentar</button>{' '}</>}
            <button type="button" class="btn-texto" onClick={() => descartar(p.id)}>Descartar</button>
          </span>
        ))}
      </div>
    </div>
  );
}

// (v0.61, 20) La píldora de la subida, fuera de la hoja de enviar (en cualquier pantalla): «Subiendo el vídeo · 42 %».
// Solo dice cómo va (no se toca: no tapa nada); «Cancelar», en la hoja o en la banda de pendientes.
export function PildoraSubida() {
  const [x, setX] = useState(subidaActual);
  useEffect(() => alCambiarSubida((v) => setX(v)), []);
  if (!x) return null;
  const pct = Math.round((x.progreso || 0) * 100);
  return (
    <div class="pildora-subida" role="progressbar" aria-label="Subiendo el vídeo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct} %`}>
      <span class="pildora-subida-aro" aria-hidden="true" style={{ '--p': `${pct}%` }} />
      <span class="num">Subiendo el vídeo · {pct} %</span>
    </div>
  );
}
