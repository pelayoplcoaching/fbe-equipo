// v0.114: tu perfil, más bonito y más social (como Strava, Hevy o Apple Fitness), debajo de la cabecera y del carné:
//   · «Resumen»: tus cifras de esta semana, este año y siempre; tus 12 semanas en barras (sesiones, horas o volumen) y
//     el calendario de constancia de 16 semanas;
//   · «Logros»: tu vitrina (tus tres mejores récords), tus ejercicios, tus medallas y tus hitos en FBE;
//   · «Actividad»: tus últimos entrenos como tarjetas;
//   · «En el equipo» (si estás en la comunidad): tu racha, retos, compañeros y los ánimos de esta semana, y «Ver cómo te
//     ven tus compañeros» (tu perfil en el equipo). Solo lo que ya ven ellos: aquí no se comparte nada nuevo.
// Todo sale de lo que ya hay (sus entrenos, su progreso, la comunidad).
import { historiaEnUnaLinea } from '../../logica/rumbo.js';
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Segmentos, Pestanas, Vacio } from '../comunes.jsx';
import { perezoso } from '../perezoso.jsx';
import { Logros } from '../Logros.jsx';
import { Huella } from '../Social.jsx';
import { MapaConstancia } from './Progreso.jsx';
import { TusEjercicios } from './Personal.jsx';
import { num, NOMBRE_GRUPO } from '../../logica/calculos.js';
import { hoyISO, fmtCorta, fmtConDia } from '../../logica/fechas.js';
import { cifrasPeriodo, semanasPerfil, textoHoras, hitosDe, mejoresRecords, comparacionPeriodo, textoDiferencia, anioDias, costumbres, textoFavoritos,
  DIAS_CORTOS, FRANJAS, mejoresConstancia, gruposRecientes, ejerciciosMasHechos, proximosHitos, actividadPorMes, esCardio, datosPerfilCompartir } from '../../logica/perfil.js';
import { datosRecord } from '../../logica/compartir.js';
import { HojaCompartir } from '../Compartir.jsx';
import { mejorRacha } from '../../logica/bienvenida.js';
import { pesoNum, pesoTxt, etiquetaPeso } from '../../logica/unidades.js';

const HojaPerfilEquipo = perezoso(() => import('../Comunidad.jsx'), 'HojaPerfilEquipo', { mientras: null });
const toneladas = (kg) => num(Math.round((Number(kg) || 0) / 100) / 10, 1);

const PESTANAS = [['resumen', 'Resumen'], ['estadisticas', 'Datos'], ['logros', 'Logros'], ['actividad', 'Actividad']];
// (personalización 2, tanda 2) «Tu historia en una línea»: cuánto lleva, con quién, cuántas sesiones y su mayor subida
function HistoriaLinea({ sesiones, progreso, hoy }) {
  const { api, atleta, propio } = useApp();
  const coach = useCarga(() => (propio ? Promise.resolve(null) : api.nombreCoach().catch(() => null)), []);
  const h = historiaEnUnaLinea({ fechaAlta: atleta.fecha_alta, sesiones, progreso, coach: coach.datos || '', hoy });
  if (!h) return null;
  return <p class="panel panel-pad historia-linea" aria-label="Tu historia en una línea"><Icono n="historial" /><span>{h.texto}</span></p>;
}

export function PerfilSecciones({ salud, irA }) {
  const { api, atleta } = useApp();
  const hoy = hoyISO();  // (v0.143) el día del móvil, como la fecha de sus entrenos
  const entrenos = useCarga(() => api.entrenamientos(atleta.id).catch(() => []), [atleta.id]);
  const progreso = useCarga(() => api.progreso(atleta.id).catch(() => null), [atleta.id]);
  const constancia = useCarga(() => api.constancia(atleta.id).catch(() => null), [atleta.id]);
  const [pest, setPest] = useState('resumen');
  const lista = entrenos.datos || [];
  return (
    <section class="perfil-social" aria-label="Tu actividad en FBE">
      <CompartirPerfil entrenos={lista} hoy={hoy} racha={constancia.datos?.racha || 0} progreso={progreso.datos} cargando={entrenos.cargando && !entrenos.datos} />
      <Pestanas idBase="perfil-pest" clase="perfil-pestanas" etiqueta="Tu actividad" opciones={PESTANAS} valor={pest} alCambiar={setPest} />
      <div role="tabpanel" id="perfil-pest-panel" aria-labelledby={`perfil-pest-${pest}`} class="pila perfil-panel">
        {pest === 'resumen' && (
          <>
            <HistoriaLinea sesiones={lista.length} progreso={progreso.datos} hoy={hoy} />
            <CifrasPerfil entrenos={lista} hoy={hoy} cargando={entrenos.cargando && !entrenos.datos} />
            <SemanasPerfil entrenos={lista} hoy={hoy} />
            <section class="seccion perfil-sec" aria-labelledby="perfil-constancia-t">
              <h2 id="perfil-constancia-t">Constancia</h2>
              <div class="panel panel-pad"><MapaConstancia atletaId={atleta.id} /></div>
            </section>
          </>
        )}
        {pest === 'estadisticas' && (
          <>
            <AnioPerfil entrenos={lista} hoy={hoy} />
            <CostumbresPerfil entrenos={lista} hoy={hoy} />
            <MarcasConstancia entrenos={lista} hoy={hoy} semanas={constancia.datos?.semanas} />
            <GruposPerfil entrenos={lista} hoy={hoy} />
            <MasHechos entrenos={lista} />
          </>
        )}
        {pest === 'logros' && (
          <>
            <VitrinaPerfil progreso={progreso.datos} irA={irA} />
            <ProximosHitos entrenos={lista} hoy={hoy} />
            <TusEjercicios progreso={progreso.datos} />
            <Logros salud={salud} />
            <HitosPerfil entrenos={lista} fechaAlta={atleta.fecha_alta} hoy={hoy} />
          </>
        )}
        {pest === 'actividad' && <ActividadPerfil entrenos={lista} cargando={entrenos.cargando && !entrenos.datos} irA={irA} />}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- tus cifras (como las de Strava)
const PERIODOS = [['semana', 'Esta semana'], ['anio', 'Este año'], ['siempre', 'Siempre']];
function CifrasPerfil({ entrenos, hoy, cargando }) {
  const [periodo, setPeriodo] = useState('semana');
  const c = cifrasPeriodo(entrenos, hoy)[periodo];
  // v0.116: frente al periodo de antes, hasta el mismo día (la semana pasada, el año pasado)
  const antes = comparacionPeriodo(entrenos, hoy)[periodo];
  const tiles = [
    ['sesiones', 'Sesiones', String(c.sesiones), null, antes && textoDiferencia(c.sesiones, antes.sesiones)],
    ['tiempo', 'Tiempo', textoHoras(c.minutos), null, antes && (c.minutos !== antes.minutos ? `${c.minutos > antes.minutos ? '+' : '−'}${textoHoras(Math.abs(c.minutos - antes.minutos))}` : '=')],
    ['toneladas', 'Toneladas', toneladas(c.tonelaje), 't', antes && (Math.round(c.tonelaje / 100) !== Math.round(antes.tonelaje / 100) ? `${c.tonelaje > antes.tonelaje ? '+' : '−'}${toneladas(Math.abs(c.tonelaje - antes.tonelaje))}` : '=')],
    ['records', 'Récords', String(c.records), null, antes && textoDiferencia(c.records, antes.records)],
  ];
  const frente = periodo === 'semana' ? 'la semana pasada hasta hoy' : periodo === 'anio' ? 'el año pasado hasta hoy' : '';
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-cifras-t">
      <div class="seccion-cab"><h2 id="perfil-cifras-t">Tus cifras</h2></div>
      <Segmentos clase="seg-compacto" etiqueta="Periodo de tus cifras" opciones={PERIODOS} valor={periodo} alCambiar={(v) => v && setPeriodo(v)} />
      <dl class="perfil-tiles" aria-busy={cargando ? 'true' : undefined}>
        {tiles.map(([k, t, v, u, dif]) => (
          <div key={k} data-k={k} class="perfil-tile">
            <dt>{t}</dt>
            <dd class="num">{cargando ? <span class="sil" style="width:3ch;height:1em;display:inline-block" /> : <>{v}{u && <small> {u}</small>}</>}</dd>
            {!cargando && dif && <dd class={`perfil-dif ${dif.startsWith('+') ? 'sube' : dif.startsWith('−') ? 'baja' : ''}`}><span class="sr">Frente a {frente}: </span>{dif}</dd>}
          </div>
        ))}
      </dl>
      {frente && <p class="mini terciario">Las cifras pequeñas, frente a {frente}.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- tus 12 semanas (como la gráfica de Hevy)
const MEDIDAS = [['sesiones', 'Sesiones'], ['minutos', 'Horas'], ['tonelaje', 'Volumen']];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function SemanasPerfil({ entrenos, hoy }) {
  const [medida, setMedida] = useState('sesiones');
  const semanas = semanasPerfil(entrenos, hoy, 12);
  // v0.116: tocar una barra (o moverse con las flechas) enseña su semana; de entrada, la actual
  const [sel, setSel] = useState(11);
  const valor = (w) => (medida === 'minutos' ? w.minutos / 60 : medida === 'tonelaje' ? w.tonelaje / 1000 : w.sesiones);
  const max = Math.max(0.0001, ...semanas.map(valor));
  const fmt = (w) => (medida === 'minutos' ? textoHoras(w.minutos) : medida === 'tonelaje' ? `${toneladas(w.tonelaje)} t` : `${w.sesiones} ${w.sesiones === 1 ? 'sesión' : 'sesiones'}`);
  const total = semanas.reduce((t, w) => t + valor(w), 0);
  const media = total / semanas.length;
  const etiqueta = `${MEDIDAS.find(([k]) => k === medida)[1]} por semana, las últimas 12: ${semanas.map((w) => `semana del ${fmtCorta(w.lunes)}, ${fmt(w)}`).join('; ')}`;
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-semanas-t">
      <div class="seccion-cab"><h2 id="perfil-semanas-t">Tus 12 semanas</h2></div>
      <Segmentos clase="seg-compacto" etiqueta="Qué ver en la gráfica" opciones={MEDIDAS} valor={medida} alCambiar={(v) => v && setMedida(v)} />
      <div class="panel panel-pad pila-s">
        <p class="perfil-barras-sel" aria-live="polite"><strong class="num">{fmt(semanas[sel])}</strong> <span class="secundario">{sel === 11 ? 'esta semana' : `la semana del ${fmtCorta(semanas[sel].lunes)}`}</span></p>
        <div class="perfil-barras" role="img" aria-label={etiqueta}
          onKeyDown={(e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)); } if (e.key === 'ArrowRight') { e.preventDefault(); setSel((x) => Math.min(11, x + 1)); } }} tabIndex={0}>
          {semanas.map((w, i) => {
            const v = valor(w);
            const mes = i === 0 || w.lunes.slice(5, 7) !== semanas[i - 1].lunes.slice(5, 7) ? MESES[Number(w.lunes.slice(5, 7)) - 1] : '';
            return (
              <span key={w.lunes} class={`pb-col ${i === semanas.length - 1 ? 'actual' : ''} ${i === sel ? 'sel' : ''}`} aria-hidden="true" onClick={() => setSel(i)}>
                <span class="pb-barra" style={{ '--h': `${v > 0 ? Math.max(6, Math.round((v / max) * 100)) : 0}%` }} title={fmt(w)} />
                <span class="pb-mes">{mes}</span>
              </span>
            );
          })}
        </div>
        <p class="mini terciario">Media: {medida === 'minutos' ? textoHoras(media * 60) : medida === 'tonelaje' ? `${num(media, 1)} t` : num(media, 1)} {medida === 'sesiones' ? 'sesiones' : ''} por semana{medida === 'tonelaje' ? ' (kilos movidos: carga × repeticiones)' : ''}. La de esta semana, en color.</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- tu vitrina (tus tres mejores récords)
function VitrinaPerfil({ progreso, irA }) {
  const [compartir, setCompartir] = useState(null);
  if (!progreso) return <div class="sil" style="height:120px;border-radius:16px" />;
  const top = mejoresRecords(progreso.vitrina, 3);
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-vitrina-t">
      <div class="seccion-cab"><h2 id="perfil-vitrina-t">Tu vitrina</h2>{irA && top.length > 0 && <button class="btn-texto" onClick={() => irA('progreso')}>Ver todos</button>}</div>
      {!top.length ? <div class="panel"><Vacio ilustracion="records" titulo="Aún no tienes récords">Cuando superes una marca tuya, tus tres mejores saldrán aquí.</Vacio></div> : (
        <ol class="perfil-vitrina">
          {top.map((x, i) => (
            <li key={x.id} class="perfil-trofeo" data-puesto={i + 1}>
              <span class="pt-puesto" aria-hidden="true"><Icono n="trofeo" /></span>
              <span class="pt-nombre">{x.nombre}</span>
              <span class="pt-valor num">{pesoNum(x.e1rm.valor, 1)}<small> {etiquetaPeso()}</small></span>
              <span class="mini secundario num">1RM estimado · {pesoTxt(x.e1rm.kg, 2)} × {x.e1rm.reps}{x.e1rm.fecha ? ` · ${fmtCorta(x.e1rm.fecha)}` : ''}</span>
              <button type="button" class="btn-icono plano pt-compartir" aria-label={`Compartir el récord de ${x.nombre}`} onClick={() => setCompartir(x)}><Icono n="compartir" /></button>
            </li>
          ))}
        </ol>
      )}
      {compartir && <HojaCompartir logro tipo="record" titulo="Compartir el récord" datos={datosRecord(compartir)} equipo={{ tema: 'logros' }} alCerrar={() => setCompartir(null)} />}
    </section>
  );
}

// ---------------------------------------------------------------- tus hitos (la línea del tiempo de tu historia en FBE)
function HitosPerfil({ entrenos, fechaAlta, hoy }) {
  const [todos, setTodos] = useState(false);
  const hitos = hitosDe({ fechaAlta, entrenos }, hoy);
  if (!hitos.length) return null;
  const ver = todos ? hitos : hitos.slice(0, 6);
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-hitos-t">
      <h2 id="perfil-hitos-t">Tus hitos</h2>
      <ol class="perfil-hitos panel panel-pad">
        {ver.map((h) => (
          <li key={h.id} data-hito={h.id}>
            <span class="ph-ico" aria-hidden="true"><Icono n={h.icono} /></span>
            <span class="pila-xs"><span class="ph-texto">{h.texto}</span><span class="mini terciario">{fmtConDia(h.fecha)}</span></span>
          </li>
        ))}
      </ol>
      {hitos.length > ver.length && <button class="btn-texto" style="justify-self:start" onClick={() => setTodos(true)}>Ver los {hitos.length} hitos</button>}
    </section>
  );
}

// ---------------------------------------------------------------- tu actividad (tus últimos entrenos, como un feed)
const FILTROS = [['todo', 'Todo'], ['fuerza', 'Fuerza'], ['cardio', 'Cardio']];
function ActividadPerfil({ entrenos, cargando, irA }) {
  const [cuantos, setCuantos] = useState(8);
  const [filtro, setFiltro] = useState('todo');
  if (cargando) return <div class="sil" style="height:180px;border-radius:16px" />;
  if (!entrenos.length) {
    return <div class="panel"><Vacio ilustracion="semana" titulo="Aún no has terminado ningún entreno"
      accion={irA ? <button class="btn btn-peq" onClick={() => irA('hoy')}><Icono n="play" /> Ir a tu sesión de hoy</button> : null}>Cuando termines tu primera sesión, saldrá aquí.</Vacio></div>;
  }
  // v0.116: por meses, con un filtro (todo, fuerza o cardio; el filtro solo sale si ha hecho cardio)
  const hayCardio = entrenos.some(esCardio);
  const lista = entrenos.filter((x) => (filtro === 'cardio' ? esCardio(x) : filtro === 'fuerza' ? !esCardio(x) : true));
  const meses = actividadPorMes(lista.slice(0, cuantos));
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-actividad-t">
      <h2 id="perfil-actividad-t" class="sr">Tus últimos entrenos</h2>
      {hayCardio && <Segmentos clase="seg-compacto" etiqueta="Qué entrenos ver" opciones={FILTROS} valor={filtro} alCambiar={(v) => { if (v) { setFiltro(v); setCuantos(8); } }} />}
      {meses.map((m) => (
      <section key={m.mes} class="perfil-mes" aria-label={m.titulo}>
      <h3 class="perfil-mes-t">{m.titulo} <span class="terciario">· {m.entrenos.length}</span></h3>
      <ul class="perfil-feed">
        {m.entrenos.map((x) => (
          <li key={x.id} class="panel perfil-entreno">
            <div class="pe-cab">
              <span class="pe-ico" aria-hidden="true"><Icono n={x.tipo === 'cardio' ? 'rayo' : x.tipo === 'movilidad' ? 'movilidad' : 'disco'} /></span>
              <span class="pila-xs"><strong class="pe-titulo">{x.nombre}</strong><span class="mini terciario">{x.fecha ? fmtConDia(x.fecha) : ''}{x.bloque ? ` · Bloque ${x.bloque.numero}${x.semana ? `, semana ${x.semana}` : ''}` : ''}</span></span>
              {x.records > 0 && <span class="chip aviso pe-records"><Icono n="trofeo" />{x.records}</span>}
            </div>
            <dl class="pe-cifras">
              {x.duracion_min ? <div><dt>Tiempo</dt><dd class="num">{textoHoras(x.duracion_min)}</dd></div> : null}
              <div><dt>Series</dt><dd class="num">{x.series}</dd></div>
              {x.tonelaje > 0 && <div><dt>Volumen</dt><dd class="num">{toneladas(x.tonelaje)} t</dd></div>}
              {x.rpe_sesion ? <div><dt>Esfuerzo</dt><dd class="num">{num(x.rpe_sesion)}</dd></div> : null}
            </dl>
            {x.musculos?.length > 0 && <p class="mini secundario pe-musculos">{x.musculos.map((g) => NOMBRE_GRUPO[g] || g).join(' · ')}</p>}
          </li>
        ))}
      </ul>
      </section>
      ))}
      {!lista.length && <p class="peq secundario">No hay entrenos de este tipo.</p>}
      {lista.length > cuantos && <button class="btn-texto" style="justify-self:start" onClick={() => setCuantos(cuantos + 10)}>Ver más ({lista.length - cuantos})</button>}
    </section>
  );
}

// ---------------------------------------------------------------- en el equipo (solo si estás en la comunidad)
export function EnElEquipo() {
  const { api, atleta } = useApp();
  const yo = api.uid();
  const perfil = useCarga(() => api.perfilComunidad(yo).catch(() => null), [yo]);
  const animos = useCarga(() => api.animosComunidad().catch(() => null), [yo]);
  const parejas = useCarga(() => api.companerosComunidad().catch(() => null), [yo]);
  const [ver, setVer] = useState(false);
  const x = perfil.datos;
  if (!x || atleta.estado === 'baja') return null;
  const conmigo = (parejas.datos || []).filter((c) => c.estado === 'aceptada');
  const recibidos = animos.datos?.recibidos || [];
  return (
    <section class="seccion perfil-sec perfil-equipo-propio" aria-labelledby="perfil-equipo-t">
      <div class="seccion-cab"><h2 id="perfil-equipo-t">En el equipo</h2><span class="peq secundario">Como {x.nombre}</span></div>
      <div class="panel panel-pad pila-s">
        <dl class="perfil-tiles perfil-tiles-3">
          <div class="perfil-tile"><dt>Racha</dt><dd class="num">{x.racha > 0 ? <><Icono n="llama" />{x.racha}<small> sem.</small></> : '—'}</dd></div>
          <div class="perfil-tile"><dt>Retos</dt><dd class="num">{x.retos || 0}</dd></div>
          <div class="perfil-tile"><dt>Entrenos compartidos</dt><dd class="num">{x.entrenos || 0}</dd></div>
        </dl>
        {recibidos.length > 0 && <p class="peq"><span aria-hidden="true">🙌 </span>Esta semana te han animado: <strong>{recibidos.map((r) => r.nombre).join(', ')}</strong>.</p>}
        {conmigo.length > 0 && <p class="peq"><span aria-hidden="true">🤝 </span>Compañeros de racha: <strong>{conmigo.map((c) => `${c.nombre}${c.racha > 0 ? ` (${c.racha} ${c.racha === 1 ? 'semana' : 'semanas'})` : ''}`).join(', ')}</strong>.</p>}
        {/* (social, 053) tu huella en el equipo */}
        <Huella />
        <button type="button" class="btn" onClick={() => setVer(true)}><Icono n="ojo" /> Ver cómo te ven tus compañeros</button>
      </div>
      {ver && <HojaPerfilEquipo perfilId={yo} alCerrar={() => setVer(false)} />}
    </section>
  );
}

// ================================================================ v0.116: Estadísticas
// Tu año: los días entrenados de los últimos 12 meses, como el calendario de Strava o de GitHub (se abre en lo reciente)
function AnioPerfil({ entrenos, hoy }) {
  const { semanas, diasEntrenados } = anioDias(entrenos, hoy);
  const ir = (el) => { if (el) el.scrollLeft = el.scrollWidth; };
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-anio-t">
      <div class="seccion-cab"><h2 id="perfil-anio-t">Tu año</h2><span class="peq secundario num">{diasEntrenados} {diasEntrenados === 1 ? 'día' : 'días'} entrenando</span></div>
      <div class="panel panel-pad">
        <div class="perfil-anio-marco" ref={ir} tabIndex={0} role="region" aria-label="Tu año, día a día (se desliza)">
          <div class="perfil-anio" role="img" aria-label={`Has entrenado ${diasEntrenados} días en los últimos 12 meses`}>
            {semanas.map((w) => (
              <span key={w.lunes} class="pa-semana" aria-hidden="true">
                {w.dias.map((d) => <span key={d.iso} class={`pa-dia n${d.nivel}`} title={d.nivel >= 0 ? `${fmtCorta(d.iso)}: ${d.n ? `${d.n} ${d.n === 1 ? 'sesión' : 'sesiones'}` : 'sin entrenar'}` : undefined} />)}
              </span>
            ))}
          </div>
        </div>
        <p class="mini terciario perfil-anio-ley" aria-hidden="true"><span class="pa-dia n0" /> sin entrenar <span class="pa-dia n2" /> una sesión <span class="pa-dia n3" /> dos o más</p>
      </div>
    </section>
  );
}

// Tus costumbres: los días en que sueles entrenar, a qué hora y cuánto te duran las sesiones
function CostumbresPerfil({ entrenos, hoy }) {
  const c = costumbres(entrenos, hoy);
  if (c.sesiones < 3) return null;
  const max = Math.max(1, ...c.dias);
  const fav = textoFavoritos(c.favoritos);
  const franja = FRANJAS.find(([k]) => k === c.franja)?.[1];
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-costumbres-t">
      <h2 id="perfil-costumbres-t">Tus costumbres</h2>
      <div class="panel panel-pad pila-s">
        <p class="peq">{fav ? <>Sueles entrenar <strong>{fav}</strong>{franja ? <>, <strong>{franja.toLowerCase()}</strong></> : null}.</> : 'Aún no hay un día que se repita.'}</p>
        <div class="perfil-dias" role="img" aria-label={`Sesiones por día de la semana: ${c.dias.map((n, i) => `${DIAS_CORTOS[i]} ${n}`).join(', ')}`}>
          {c.dias.map((n, i) => (
            <span key={i} class={`pd-col ${c.favoritos.includes(i) ? 'fav' : ''}`} aria-hidden="true">
              <span class="pd-n num">{n || ''}</span>
              <span class="pd-barra" style={{ '--h': `${n ? Math.max(8, Math.round((n / max) * 100)) : 0}%` }} />
              <span class="pd-dia">{DIAS_CORTOS[i]}</span>
            </span>
          ))}
        </div>
        {c.media && <p class="mini secundario">Tus sesiones duran de media <strong>{textoHoras(c.media)}</strong>{c.larga ? <>; la más larga, {textoHoras(c.larga.duracion_min)} ({c.larga.nombre}, {fmtCorta(c.larga.fecha)})</> : null}.</p>}
      </div>
    </section>
  );
}

// Tus mejores marcas de constancia: la racha más larga, la mejor semana y el mejor mes
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function MarcasConstancia({ entrenos, hoy, semanas }) {
  const m = mejoresConstancia(entrenos, hoy);
  const racha = semanas ? mejorRacha(semanas, hoy) : 0;
  if (!m.semana && !racha) return null;
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-marcas-t">
      <h2 id="perfil-marcas-t">Tus mejores marcas de constancia</h2>
      <dl class="perfil-tiles perfil-tiles-3 perfil-marcas">
        <div class="perfil-tile"><dt>Racha más larga</dt><dd class="num">{racha ? <><Icono n="llama" />{racha}<small> sem.</small></> : '—'}</dd></div>
        <div class="perfil-tile"><dt>Mejor semana{m.semana ? `, del ${fmtCorta(m.semana.lunes)}` : ''}</dt><dd class="num">{m.semana ? <>{m.semana.sesiones}<small> ses.</small></> : '—'}</dd></div>
        <div class="perfil-tile"><dt>Mejor mes{m.mes ? `, ${MESES_L[Number(m.mes.mes.slice(5, 7)) - 1]}` : ''}</dt><dd class="num">{m.mes ? <>{m.mes.sesiones}<small> ses.</small></> : '—'}</dd></div>
      </dl>
    </section>
  );
}

// Lo que más entrenas: las series por grupo muscular de las últimas 4 semanas, con el color de cada grupo
function GruposPerfil({ entrenos, hoy }) {
  const g = gruposRecientes(entrenos, hoy, 28);
  if (!g.length) return null;
  const max = g[0].series;
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-grupos-t">
      <div class="seccion-cab"><h2 id="perfil-grupos-t">Lo que más entrenas</h2><span class="peq secundario">4 últimas semanas</span></div>
      <ul class="panel panel-pad perfil-grupos">
        {g.slice(0, 8).map((x) => (
          <li key={x.grupo} data-g={x.grupo}>
            <span class="pg-nombre">{NOMBRE_GRUPO[x.grupo] || x.grupo}</span>
            <span class="pg-barra" aria-hidden="true"><span style={{ '--w': `${Math.max(4, Math.round((x.series / max) * 100))}%` }} /></span>
            <span class="pg-n num">{num(x.series, 1)}<small> series</small></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Tus ejercicios más repetidos (en cuántas sesiones has hecho cada uno)
function MasHechos({ entrenos }) {
  const top = ejerciciosMasHechos(entrenos, 5);
  if (!top.length) return null;
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-mashechos-t">
      <h2 id="perfil-mashechos-t">Tus ejercicios de siempre</h2>
      <ol class="panel perfil-mashechos">
        {top.map((x, i) => (
          <li key={x.id}><span class="pm-puesto num" aria-hidden="true">{i + 1}</span><span class="pila-xs" style="min-width:0"><span class="pm-nombre">{x.nombre}</span><span class="mini terciario">Última vez: {x.ultima ? fmtCorta(x.ultima) : '—'}</span></span><span class="pm-n num">{x.sesiones}<small> {x.sesiones === 1 ? 'sesión' : 'sesiones'}</small></span></li>
        ))}
      </ol>
    </section>
  );
}

// ================================================================ v0.116: lo que te falta para los siguientes hitos
function ProximosHitos({ entrenos, hoy }) {
  const h = proximosHitos(entrenos, hoy);
  if (!h.length) return null;
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-proximos-t">
      <h2 id="perfil-proximos-t">Tus próximos hitos</h2>
      <ul class="panel panel-pad perfil-proximos">
        {h.map((x) => (
          <li key={x.id}>
            <span class="pila-xs"><strong>{x.texto}</strong><span class="mini secundario">{x.falta}</span></span>
            <progress max={x.meta} value={Math.min(x.actual, x.meta)} aria-label={`${x.texto}: ${x.falta}`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ================================================================ v0.116: compartir tu perfil («Mi año en FBE»)
function CompartirPerfil({ entrenos, hoy, racha, progreso, cargando }) {
  const { atleta } = useApp();
  const [abierta, setAbierta] = useState(false);
  if (cargando || !entrenos.length) return null;
  const top = mejoresRecords(progreso?.vitrina, 1)[0];
  const mejor = top ? `${top.nombre}, ${pesoTxt(top.e1rm.valor, 1)}` : null;
  return (
    <>
      <button type="button" class="btn btn-peq perfil-compartir" onClick={() => setAbierta(true)}><Icono n="compartir" /> Compartir tu perfil</button>
      {abierta && <HojaCompartir logro tipo="logro" titulo="Compartir tu perfil" datos={datosPerfilCompartir({ nombre: atleta.nombre, entrenos, racha, mejor, hoy })} equipo={{ tema: 'logros' }} alCerrar={() => setAbierta(false)} />}
    </>
  );
}
