import { useEffect, useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, Icono, Vacio, ErrorCaja, Pista } from '../comunes.jsx';
import { DiaSesion } from './Hoy.jsx';
import { PlanSemana } from './Plan.jsx';
import { NOMBRE_FOCO, NOMBRE_GRUPO, NOMBRE_TIPO_SESION, num } from '../../logica/calculos.js';
import { rangoSemana, desdeISO, fmtConDia, hoyISO, sumarDias } from '../../logica/fechas.js';

export function Semana({ programa, abrirSesion, noLeidos = [] }) {
  const { datos: p, cargando, error, recargar } = programa;
  const [elegida, setElegida] = useState(null);
  useEffect(() => { if (p?.actual && !elegida) setElegida(p.actual.id); }, [p]);

  if (cargando && !p) return <div class="contenido"><Siluetas forma="lista" n={4} texto="Cargando tu programa" /></div>;
  const semana = p?.semanas.find((s) => s.id === elegida) || p?.actual;
  const sesiones = semana ? p.sesiones[semana.id] || [] : [];
  const siguiente = sesiones.find((s) => !s.completada);
  // El plan, para la semana en curso o una que aún no ha empezado
  const planificable = semana?.fecha_inicio && sumarDias(semana.fecha_inicio, 6) >= hoyISO() && sesiones.some((s) => !s.completada);
  const conMensajes = new Set(noLeidos.map((c) => c.sesion_id).filter(Boolean));

  return (
    <div class="contenido">
      <header class="cabecera">
        <div class="titulo">
          <h1>{p?.bloque ? `Bloque ${p.bloque.numero}: ${p.bloque.nombre}` : 'Tu programa'}</h1>
          {p?.bloque?.objetivo && <div class="sub">{p.bloque.objetivo}</div>}
        </div>
      </header>
      <ErrorCaja error={error} reintentar={recargar} />
      {p?.semanas.length > 0 && <Pista id="semana" icono="semana">Aquí está tu bloque entero: cada semana con sus sesiones. Para entrenar, vuelve a Hoy y toca «Empezar»; aquí puedes ver lo que viene y lo que ya hiciste.</Pista>}
      {!p?.semanas.length ? (
        <div class="panel"><Vacio icono="semana" titulo="Sin semanas publicadas">Cuando tu coach publique una semana, aparecerá aquí.</Vacio></div>
      ) : (
        <>
          <div class="semanas-tabs" role="group" aria-label="Semanas del bloque">
            {p.semanas.map((s) => {
              const ss = p.sesiones[s.id] || [];
              const hechas = ss.filter((x) => x.completada).length;
              return (
                <button key={s.id} aria-pressed={s.id === semana?.id ? 'true' : 'false'} class={hechas === ss.length && ss.length ? 'programada' : ''} onClick={() => setElegida(s.id)}>
                  S{s.numero}
                  <span class="est">{hechas}/{ss.length}{s.id === p.actual?.id ? ' ahora' : ''}</span>
                </button>
              );
            })}
          </div>
          {semana && (
            <section class="seccion">
              <div class="seccion-cab">
                <h2>Semana {semana.numero}{semana.fecha_inicio ? `, ${rangoSemana(semana.fecha_inicio)}` : ''}</h2>
                {semana.foco && <span class="chip morado">{NOMBRE_FOCO[semana.foco]}</span>}
              </div>
              {semana.nota_coach && <div class="nota-coach"><Icono n="mensaje" /><div><strong>Tu coach: </strong>{semana.nota_coach}</div></div>}
              {planificable && (
                <div class="pila-s">
                  <h3 class="sub-seccion">Tu plan</h3>
                  <PlanSemana semana={semana} sesiones={sesiones} alCambiar={() => recargar(true)} soloTira />
                </div>
              )}
              <div class="semana-dias">
                {sesiones.map((s) => <DiaSesion key={s.id} sesion={s} semana={semana} actual={semana.id === p.actual?.id && s.id === siguiente?.id} mensajes={conMensajes.has(s.id)} abrir={() => abrirSesion(s.id)} />)}
              </div>
              {semana.id !== p.actual?.id && <p class="peq secundario">Puedes abrir cualquier sesión para repasarla o registrar una que hiciste otro día.</p>}
            </section>
          )}
        </>
      )}
      <Entrenamientos abrirSesion={abrirSesion} />
    </div>
  );
}

// Todas las sesiones hechas, de todos los bloques, agrupadas por meses (como el historial de Hevy)
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function Entrenamientos({ abrirSesion }) {
  const { api, atleta } = useApp();
  const lista = useCarga(() => api.entrenamientos(atleta.id).catch(() => []), [atleta.id]);
  const [cuantos, setCuantos] = useState(12);
  const todos = lista.datos || [];
  if (!todos.length) return null;
  const visibles = todos.slice(0, cuantos);
  const meses = [];
  for (const e of visibles) {
    const f = e.fecha ? desdeISO(e.fecha) : null;
    const clave = f ? `${MESES[f.getMonth()]} de ${f.getFullYear()}` : 'Sin fecha';
    let m = meses.find((x) => x.clave === clave);
    if (!m) { m = { clave, items: [] }; meses.push(m); }
    m.items.push(e);
  }
  return (
    <section class="seccion">
      <div class="seccion-cab"><h2>Tus entrenamientos</h2><span class="peq secundario num">{todos.length} en total</span></div>
      {meses.map((m) => (
        <div class="pila-s" key={m.clave}>
          <span class="mes-etq">{m.clave.charAt(0).toUpperCase() + m.clave.slice(1)}</span>
          <div class="panel">
            <ul class="lista">
              {m.items.map((e) => (
                <li key={e.id}>
                  <button class="entreno" onClick={() => abrirSesion(e.id)}>
                    <span class="entreno-dia num" aria-hidden="true"><b>{e.fecha ? desdeISO(e.fecha).getDate() : '—'}</b></span>
                    <span class="pila-xs">
                      <span class="entreno-nombre">{e.nombre}{e.records > 0 && <span class="chip morado"><Icono n="trofeo" />{e.records}</span>}</span>
                      <span class="peq secundario">
                        {e.fecha ? fmtConDia(e.fecha) : ''}
                        {e.tipo && e.tipo !== 'fuerza' ? `, ${NOMBRE_TIPO_SESION[e.tipo].toLowerCase()}` : ''}
                        {e.duracion_min ? `, ${e.duracion_min} min` : ''}
                        {e.series ? `, ${e.series} series, ${num(Math.round(e.tonelaje / 100) / 10)} t` : ''}
                      </span>
                      {e.musculos.length > 0 && <span class="mini terciario">{e.musculos.map((g) => NOMBRE_GRUPO[g]).join(', ')}</span>}
                    </span>
                    {e.rpe_sesion ? <span class="entreno-rpe num" title="Esfuerzo de la sesión">{e.rpe_sesion}<small>/10</small></span> : <span />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
      {todos.length > cuantos && <button class="btn" onClick={() => setCuantos(cuantos + 12)}>Ver más ({todos.length - cuantos})</button>}
    </section>
  );
}
