// v0.61 (16): el perfil carga–velocidad de un ejercicio y el 1RM estimado por la velocidad, «Estimación experimental». En
// «Mi técnica» (el atleta) y en la ficha del atleta (el coach): los puntos (la carga de la serie y la velocidad media de la
// mejor repetición de cada vídeo analizado), la recta, el R², cuántos puntos y cargas, y el 1RM con la velocidad mínima de
// ese ejercicio (la de serie o la del coach, 039). Nunca un 1RM con menos de 3 cargas distintas; con avisos si son pocas, si
// el R² es bajo o si extrapola mucho. Y, al lado, el 1RM por repeticiones y RPE de Progreso. La cuenta, en
// logica/cargaVelocidad.js.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, useAncho } from '../comunes.jsx';
import { AVISO_039 } from '../../datos/api.js';
import { fmtCorta } from '../../logica/fechas.js';
import {
  perfilCargaVelocidad, umbralDe, leerUmbral, velocidadEn, e1rmPorRepeticiones, diferenciaPct, textoUmbral, textoR2, textoKg, textoEstado, TEXTO_AVISO, MIN_CARGAS, puntosPerfil,
} from '../../logica/cargaVelocidad.js';
import { textoVel } from '../../logica/analisis.js';

export function PerfilVelocidad({ g, atletaId, esCoach = false }) {
  const { api, aviso } = useApp();
  const conPuntos = g?.id && g.id !== 'sin' && puntosPerfil(g.videos).length > 0;
  const datos = useCarga(() => (conPuntos ? api.datosPerfilVelocidad(atletaId, g.id) : Promise.resolve(null)), [atletaId, g?.id, conPuntos]);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  if (!conPuntos) return null;
  const ej = { id: g.id, nombre: g.nombre };
  const u = umbralDe(ej, datos.datos?.umbrales || {});
  const p = perfilCargaVelocidad(g.videos, { umbral: u.v, umbralGenerico: u.generico });
  const ultimo = [...g.videos].map((v) => v.fecha).filter(Boolean).sort().at(-1) || null;
  const porReps = datos.datos ? e1rmPorRepeticiones(datos.datos.series, { hasta: ultimo }) : null;
  const dif = p.e1rm != null && porReps ? diferenciaPct(p.e1rm, porReps.valor) : null;
  const con039 = datos.datos?.con039 !== false;
  const guardar = async (v) => {
    setOcupado(true);
    try { await api.guardarUmbralVelocidad(g.id, v); aviso(v == null ? 'Vuelve a la velocidad mínima de serie' : `Velocidad mínima de ${g.nombre}: ${textoUmbral(v)}`); setEditando(false); await datos.recargar(true); }
    catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const nuevo = leerUmbral(texto);
  return (
    <section class="perfil-velocidad pila-s" aria-labelledby={`pv-${g.id}`}>
      <div class="separa">
        <span class="etq" id={`pv-${g.id}`}>Perfil carga–velocidad</span>
        <span class="chip aviso experimental">Estimación experimental</span>
      </div>
      <GraficaPerfil p={p} nombre={g.nombre} />
      <p class="mini secundario num perfil-cifras">{p.n === 1 ? '1 punto' : `${p.n} puntos`} · {p.cargas === 1 ? '1 carga' : `${p.cargas} cargas distintas`}{p.r2 != null && p.cargas >= MIN_CARGAS ? ` · R² ${textoR2(p.r2)}` : ''}</p>
      {p.estado === 'ok' ? (
        <div class="perfil-e1rm" role="group" aria-label="1RM estimado">
          <span class="perfil-e1rm-cifra num">{textoKg(p.e1rm)}</span>
          <span class="mini secundario">1RM estimado por la velocidad, con {textoUmbral(u.v)} de velocidad mínima</span>
        </div>
      ) : <p class="peq secundario perfil-sin-e1rm" role="note">{textoEstado(p)}</p>}
      {porReps && (
        <p class="mini secundario">Por repeticiones y RPE (Progreso, últimas 8 semanas): <b class="num">{textoKg(porReps.valor)}</b>{dif != null ? <span class="num"> · la velocidad da un {Math.abs(dif)} % {dif >= 0 ? 'más' : 'menos'}</span> : null}</p>
      )}
      {p.avisos.length > 0 && (
        <ul class="perfil-avisos mini">
          {p.avisos.map((a) => <li key={a}><Icono n="alerta" /> {TEXTO_AVISO[a]}</li>)}
        </ul>
      )}
      <p class="mini terciario">Sale de la velocidad estimada en el vídeo (±10–15 %) y de los kilos apuntados en la serie de cada vídeo. Sirve para ver la tendencia, no sustituye a un test de 1RM.</p>
      <div class="perfil-umbral fila-envolver">
        <span class="mini">Velocidad mínima: <b class="num">{textoUmbral(u.v)}</b> <span class="terciario">{u.propio ? '(la de tu coach para este ejercicio)' : u.generico ? '(genérica)' : `(de serie para ${u.de})`}</span></span>
        {esCoach && (con039
          ? !editando && <button type="button" class="btn btn-peq plano" onClick={() => { setTexto(String(u.v).replace('.', ',')); setEditando(true); }}>Cambiarla</button>
          : <span class="mini terciario">Cambiarla: {AVISO_039}.</span>)}
      </div>
      {esCoach && editando && (
        <div class="fila-envolver perfil-umbral-editar">
          <label class="campo-linea"><span class="mini">m/s</span>
            <input class="entrada entrada-corta num" inputMode="decimal" value={texto} aria-label={`Velocidad mínima de ${g.nombre} (m/s)`} aria-invalid={texto && !nuevo ? 'true' : undefined}
              onInput={(e) => setTexto(e.currentTarget.value)} /></label>
          <button type="button" class="btn btn-peq btn-primario" disabled={ocupado || nuevo == null} onClick={() => guardar(nuevo)}>Guardar</button>
          {u.propio && <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => guardar(null)}>La de serie</button>}
          <button type="button" class="btn btn-peq plano" onClick={() => setEditando(false)}>Cancelar</button>
          <span class="mini terciario">De 0,05 a 1. Vale para este ejercicio en todos tus atletas.</span>
        </div>
      )}
    </section>
  );
}

// La gráfica: la carga (abajo) y la velocidad (a la izquierda), los puntos, la recta y la velocidad mínima (discontinua).
// Con su descripción y, en «Ver los puntos», la tabla.
function GraficaPerfil({ p, nombre }) {
  const [W, ref] = useAncho();
  const H = 170, izq = 40, der = 12, arr = 12, abj = 26;
  const todos = [...p.puntos, ...p.atipicos];
  if (!todos.length) return null;
  const kgs = todos.map((x) => x.kg);
  const extra = p.e1rm != null ? [p.e1rm] : [];
  let x0 = Math.min(...kgs), x1 = Math.max(...kgs, ...extra);
  if (x1 - x0 < 10) { x0 -= 5; x1 += 5; }
  const padX = (x1 - x0) * 0.06; x0 = Math.max(0, x0 - padX); x1 += padX;
  const vs = todos.map((x) => x.v);
  let y0 = Math.min(...vs, p.umbral), y1 = Math.max(...vs);
  const padY = Math.max(0.05, (y1 - y0) * 0.12); y0 = Math.max(0, y0 - padY); y1 += padY;
  const X = (kg) => izq + ((kg - x0) / (x1 - x0)) * (W - izq - der);
  const Y = (v) => arr + (1 - (v - y0) / (y1 - y0)) * (H - arr - abj);
  const linea = p.recta && p.cargas >= MIN_CARGAS ? [x0, x1].map((kg) => [X(kg), Y(velocidadEn(p.recta, kg))]) : null;
  const ticksY = [y0, (y0 + y1) / 2, y1];
  const ticksX = [x0, (x0 + x1) / 2, x1];
  const resumen = `Perfil carga–velocidad de ${nombre}: ${todos.length} ${todos.length === 1 ? 'vídeo' : 'vídeos'}, de ${textoKg(Math.min(...kgs))} a ${textoKg(Math.max(...kgs))}, con velocidades de ${textoVel(Math.min(...vs))} a ${textoVel(Math.max(...vs))}${p.e1rm != null ? `; la recta llega a la velocidad mínima (${textoUmbral(p.umbral)}) con ${textoKg(p.e1rm)}` : ''}.`;
  return (
    <figure class="perfil-grafica">
      <svg ref={ref} class="grafica grafica-perfil" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={resumen}>
        {ticksY.map((t, i) => <g key={`y${i}`}><line class="eje" x1={izq} x2={W - der} y1={Y(t)} y2={Y(t)} stroke-dasharray="2 4" /><text class="eje-txt num" x={izq - 6} y={Y(t) + 4} text-anchor="end">{t.toFixed(2).replace('.', ',')}</text></g>)}
        {ticksX.map((t, i) => <text key={`x${i}`} class="eje-txt num" x={X(t)} y={H - 8} text-anchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{Math.round(t)} kg</text>)}
        <line class="perfil-umbral-linea" x1={izq} x2={W - der} y1={Y(p.umbral)} y2={Y(p.umbral)} />
        {linea && <line class="perfil-recta" x1={linea[0][0]} y1={linea[0][1]} x2={linea[1][0]} y2={linea[1][1]} />}
        {p.e1rm != null && <circle class="perfil-e1rm-punto" cx={X(p.e1rm)} cy={Y(p.umbral)} r="5" />}
        {p.atipicos.map((q, i) => <circle key={`a${i}`} class="perfil-punto atipico" cx={X(q.kg)} cy={Y(q.v)} r="5"><title>{`${textoKg(q.kg)}: ${textoVel(q.v)} (fuera de la recta)`}</title></circle>)}
        {p.puntos.map((q, i) => <circle key={i} class="perfil-punto" cx={X(q.kg)} cy={Y(q.v)} r="5"><title>{`${q.fecha ? `${fmtCorta(q.fecha)}: ` : ''}${textoKg(q.kg)}, ${textoVel(q.v)}`}</title></circle>)}
      </svg>
      <figcaption class="mini terciario perfil-leyenda"><span class="perfil-ley-punto" aria-hidden="true" /> Cada vídeo · <span class="perfil-ley-recta" aria-hidden="true" /> la recta · <span class="perfil-ley-umbral" aria-hidden="true" /> velocidad mínima</figcaption>
      <details class="perfil-tabla mini">
        <summary>Ver los puntos</summary>
        <table>
          <thead><tr><th scope="col">Día</th><th scope="col">Carga</th><th scope="col">Velocidad media</th></tr></thead>
          <tbody>{todos.sort((a, b) => a.kg - b.kg).map((q, i) => <tr key={i}><td>{q.fecha ? fmtCorta(q.fecha) : '—'}</td><td class="num">{textoKg(q.kg)}</td><td class="num">{textoVel(q.v)}{p.atipicos.includes(q) ? ' (fuera)' : ''}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
