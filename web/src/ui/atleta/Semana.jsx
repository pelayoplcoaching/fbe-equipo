import { useEffect, useRef, useState } from 'preact/hooks';
import { CabeceraGrande, Siluetas, useApp, useCarga, Icono, Vacio, ErrorCaja, Pista } from '../comunes.jsx';
import { DiaSesion } from './Hoy.jsx';
import { PlanSemana, TiraSemana } from './Plan.jsx';
import { HojaBloque } from './TuBloque.jsx';
import { TextoConEnlaces } from '../Enlaces.jsx';
import { NOMBRE_FOCO, NOMBRE_GRUPO, NOMBRE_TIPO_SESION, num } from '../../logica/calculos.js';
import { rangoSemana, desdeISO, fmtConDia, hoyISO, sumarDias } from '../../logica/fechas.js';
import { useDeslizar } from '../deslizar.js';

// (diseño, tanda 26) El día de la semana en la hoja de calendario de «Tus entrenamientos»
const DIA_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export function Semana({ programa, abrirSesion, noLeidos = [] }) {
  const { api } = useApp();
  const { datos: p, cargando, error, recargar } = programa;
  const [elegida, setElegida] = useState(null);
  const [bloque, setBloque] = useState(false);
  // v0.50: hacia dónde se ha cambiado de semana (para que la nueva entre por ese lado)
  const [dir, setDir] = useState(0);
  useEffect(() => { if (p?.actual && !elegida) setElegida(p.actual.id); }, [p]);
  const semana = p?.semanas.find((s) => s.id === elegida) || p?.actual || null;
  const sesiones = semana ? p.sesiones[semana.id] || [] : [];
  // Lo que trae cada sesión (músculos, minutos, pictogramas): solo de la semana que se ve
  const ids = sesiones.map((s) => s.id).join(',');
  const pautas = useCarga(() => (ids ? api.pautasSemana(ids.split(',')).catch(() => ({})) : Promise.resolve({})), [ids], { recuerdo: ids ? `pautas:${ids}` : null });
  const idx = semana ? p.semanas.findIndex((s) => s.id === semana.id) : -1;
  const irA = (d) => { const j = idx + d; if (j >= 0 && j < p.semanas.length) { setDir(d); setElegida(p.semanas[j].id); } };
  // (diseño, tanda 22) el gesto de la casa (ui/deslizar.js): sigue al dedo, asoma la semana de al lado y se puede lanzar
  const gesto = useDeslizar(irA, { ignorar: '.velo, [aria-modal="true"]', hay: (d) => !!p?.semanas?.[idx + d], nombre: (d) => (p?.semanas?.[idx + d] ? `Semana ${p.semanas[idx + d].numero}` : null) });

  if (cargando && !p) return <div class="contenido"><Siluetas forma="lista" n={4} texto="Cargando tu programa" /></div>;
  const siguiente = sesiones.find((s) => !s.completada);
  // El plan, para la semana en curso o una que aún no ha empezado
  const planificable = semana?.fecha_inicio && sumarDias(semana.fecha_inicio, 6) >= hoyISO() && sesiones.some((s) => !s.completada);
  const conMensajes = new Set(noLeidos.map((c) => c.sesion_id).filter(Boolean));
  const hechasSemana = sesiones.filter((x) => x.completada).length;
  const anterior = idx > 0 ? p.semanas[idx - 1] : null, posterior = idx >= 0 && idx < (p?.semanas.length || 0) - 1 ? p.semanas[idx + 1] : null;

  return (
    <div class="contenido">
      <CabeceraGrande>
        <div class="titulo">
          <h1>{p?.bloque ? `Bloque ${p.bloque.numero}: ${p.bloque.nombre}` : 'Tu programa'}</h1>
          {p?.bloque?.objetivo && <div class="sub">{p.bloque.objetivo}</div>}
        </div>
        {p?.bloque && <button class="btn btn-peq" onClick={() => setBloque(true)}><Icono n="semana" /> Tu bloque entero</button>}
      </CabeceraGrande>
      {bloque && <HojaBloque alCerrar={() => setBloque(false)} abrirSesion={(id) => { setBloque(false); abrirSesion(id); }} />}
      <ErrorCaja error={error} reintentar={recargar} />
      {p?.semanas.length > 0 && <Pista id="semana" icono="semana">Aquí está tu bloque entero: cada semana con sus sesiones. Desliza los días a los lados para cambiar de semana. Para entrenar, vuelve a Hoy y toca «Empezar»; aquí puedes ver lo que viene y lo que ya hiciste.</Pista>}
      {!p?.semanas.length ? (
        <div class="panel"><Vacio ilustracion="espera" titulo="Sin semanas publicadas" accion={null}>Cuando tu coach publique una semana, aparecerá aquí.</Vacio></div>
      ) : (
        <>
          <div class="semanas-tabs" role="group" aria-label="Semanas del bloque">
            {p.semanas.map((s, i) => {
              const ss = p.sesiones[s.id] || [];
              const hechas = ss.filter((x) => x.completada).length;
              return (
                <button key={s.id} aria-pressed={s.id === semana?.id ? 'true' : 'false'} class={hechas === ss.length && ss.length ? 'programada' : ''} style={{ '--f': ss.length ? hechas / ss.length : 0 }} onClick={() => { setDir(i > idx ? 1 : -1); setElegida(s.id); }}>
                  S{s.numero}
                  <span class="est">{hechas}/{ss.length}{s.id === p.actual?.id ? ' ahora' : ''}</span>
                </button>
              );
            })}
          </div>
          {semana && (
            <section class="seccion semana-vista" aria-labelledby="semana-titulo">
              <div class="semana-nav">
                <button type="button" class="btn btn-icono plano" disabled={!anterior} onClick={() => irA(-1)} aria-label={anterior ? `Semana anterior (semana ${anterior.numero})` : 'Semana anterior'}><Icono n="atras" /></button>
                <div class="semana-nav-titulo">
                  <h2 id="semana-titulo">Semana {semana.numero}{semana.id === p.actual?.id ? <span class="chip morado">Ahora</span> : null}</h2>
                  <span class="peq secundario num">{semana.fecha_inicio ? rangoSemana(semana.fecha_inicio) : 'Sin fecha'} · {hechasSemana} de {sesiones.length} hechas</span>
                </div>
                <button type="button" class="btn btn-icono plano" disabled={!posterior} onClick={() => irA(1)} aria-label={posterior ? `Semana siguiente (semana ${posterior.numero})` : 'Semana siguiente'}><Icono n="derecha" /></button>
              </div>
              {/* Los días: se desliza a los lados para cambiar de semana (los botones de arriba hacen lo mismo) */}
              <div class={`dias-deslizar ${dir > 0 ? 'desde-der' : dir < 0 ? 'desde-izq' : ''}`} key={semana.id} {...gesto}>
                {planificable
                  ? <PlanSemana semana={semana} sesiones={sesiones} alCambiar={() => recargar(true)} soloTira />
                  : semana.fecha_inicio && <div class="panel panel-pad"><TiraSemana semana={semana} sesiones={sesiones} /></div>}
              </div>
              {/* v0.53.2: la semana que toca ya pasó en el calendario (el coach la publicó con fechas de la anterior) */}
              {semana.id === p.actual?.id && !planificable && semana.fecha_inicio && sumarDias(semana.fecha_inicio, 6) < hoyISO() && sesiones.some((s) => !s.completada) && (
                <p class="aviso-suave peq">Las fechas de esta semana ya han pasado. Puedes hacer sus sesiones igual (al terminar, la app te pregunta qué día fue); para colocarlas por días, pídele a tu coach que mueva la semana a estas fechas.</p>
              )}
              {(semana.foco || semana.nota_coach) && (
                <div class="pila-s">
                  {semana.foco && <span class="chip morado" style="justify-self:start">Foco: {NOMBRE_FOCO[semana.foco]?.toLowerCase()}</span>}
                  {semana.nota_coach && <div class="nota-coach"><Icono n="mensaje" /><div><strong>Tu coach: </strong><TextoConEnlaces texto={semana.nota_coach} como="span" /></div></div>}
                </div>
              )}
              <div class="semana-dias">
                {sesiones.map((s) => <DiaSesion key={s.id} sesion={s} semana={semana} resumen={pautas.datos?.[s.id] || null} llegando={pautas.cargando && !pautas.datos} actual={semana.id === p.actual?.id && s.id === siguiente?.id} mensajes={conMensajes.has(s.id)} abrir={() => abrirSesion(s.id)} />)}
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

// (el gesto de deslizar entre semanas, desde la tanda 22 de diseño, es el de ui/deslizar.js)

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
                    <span class="entreno-dia num" aria-hidden="true">{e.fecha && <i>{DIA_CORTO[desdeISO(e.fecha).getDay()]}</i>}<b>{e.fecha ? desdeISO(e.fecha).getDate() : '—'}</b></span>
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
                    {e.rpe_sesion ? <span class="entreno-rpe num" data-rpe={Math.round(e.rpe_sesion)} title="Esfuerzo de la sesión">{e.rpe_sesion}<small>/10</small></span> : <span />}
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
