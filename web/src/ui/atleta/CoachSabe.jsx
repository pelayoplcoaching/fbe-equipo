// (personalización 3, tanda 9) Que el coach le conozca sin esfuerzo, y que el atleta vea lo mismo: lo que le hace
// volver (solo por lo que hace en la app), su alerta temprana y los hitos que merecen algo de verdad (en el panel).
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono } from '../comunes.jsx';
import { loQueLeFunciona, alertaTemprana, enviosPendientes, IDEAS_REGALO } from '../../logica/coach-sabe.js';
import { hoyISO, fmtCorta } from '../../logica/fechas.js';
import { leerPreferencia, guardarPreferencia } from '../preferencias.js';

// Lo que le hace volver: para el coach (en «Para hablarle») y para él (en Perfil, «lo que ve tu coach»)
export function useLoQueFunciona(atletaId, entrenos) {
  const { api } = useApp();
  const m = useCarga(() => (atletaId ? api.fechasMensajesCoach(atletaId).catch(() => []) : Promise.resolve([])), [atletaId]);
  return entrenos && m.datos ? loQueLeFunciona({ entrenos, mensajes: m.datos, hoy: hoyISO() }) : null;
}
export function LoQueLeFunciona({ atletaId, entrenos, paraAtleta = false }) {
  const r = useLoQueFunciona(atletaId, entrenos);
  if (!r) return null;
  return (
    <div class={`lo-que-funciona pila-xs${paraAtleta ? ' panel panel-pad' : ''}`}>
      <span class="t-sobre">{paraAtleta ? 'Lo que te hace volver (lo ve tu coach)' : 'Lo que le hace volver'}</span>
      {!paraAtleta && <p class="peq"><strong>{r.resumen}</strong></p>}
      {r.lineas.map((l) => <p key={l.clave} class="peq">{paraAtleta ? l.texto.replace('vuelve a entrenar', 'vuelves a entrenar').replace('vuelve en', 'vuelves en') : l.texto}</p>)}
      {paraAtleta && <p class="mini secundario">Sale solo de cuándo entrenas en la app: nada de cómo eres.</p>}
    </div>
  );
}

// Su alerta temprana (en «Para hablarle», arriba)
export function AlertaTemprana({ entrenos }) {
  const r = entrenos ? alertaTemprana({ entrenos, hoy: hoyISO() }) : null;
  if (!r) return null;
  return <p class={`alerta-temprana nivel-${r.nivel}`}><Icono n="alerta" /><span><strong>{r.texto}</strong> {r.idea}</span></p>;
}
export const ideaDeAlerta = (entrenos) => (entrenos ? alertaTemprana({ entrenos, hoy: hoyISO() })?.idea || null : null);

// En el panel del coach: los envíos pendientes (un año, dos…, el día de su meta)
const CLAVE_ENVIOS = 'fbe-envios-hechos';
export function EnviosPendientes({ lista = [], abrir }) {
  const { api } = useApp();
  const personal = useCarga(() => api.personalAtletas().catch(() => []), []);
  const [hechos, setHechos] = useState(() => leerPreferencia(CLAVE_ENVIOS, {}) || {});
  const pend = enviosPendientes({ atletas: lista.map((x) => ({ id: x.atleta_id, nombre: x.nombre, fecha_alta: x.fecha_alta, estado: x.estado })), personal: personal.datos || [], hoy: hoyISO(), enviados: hechos });
  if (!pend.length) return null;
  const marcar = (k) => { const n = { ...hechos, [k]: true }; setHechos(n); guardarPreferencia(CLAVE_ENVIOS, n); };
  return (
    <section class="panel panel-pad envios-pendientes pila-s" aria-labelledby="envios-t">
      <h2 id="envios-t" class="envios-t"><Icono n="trofeo" /> Hitos que merecen algo de verdad</h2>
      <p class="mini secundario">{IDEAS_REGALO}</p>
      <ul class="lista">
        {pend.map((x) => (
          <li key={x.clave} class="envio-fila">
            <button type="button" class="btn-texto envio-quien" onClick={() => abrir?.(x.atletaId)}><strong>{x.nombre}</strong></button>
            <span class="peq">{x.que} · {fmtCorta(x.fecha)}</span>
            <button type="button" class="btn btn-peq" onClick={() => marcar(x.clave)} aria-label={`Marcar como hecho: ${x.nombre}, ${x.que}`}>Hecho</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
