// v0.114: tu perfil, más bonito y más social (como Strava, Hevy o Apple Fitness), debajo de la cabecera y del carné:
//   · «Resumen»: tus cifras de esta semana, este año y siempre; tus 12 semanas en barras (sesiones, horas o volumen) y
//     el calendario de constancia de 16 semanas;
//   · «Logros»: tu vitrina (tus tres mejores récords), tus ejercicios, tus medallas y tus hitos en FBE;
//   · «Actividad»: tus últimos entrenos como tarjetas;
//   · «En el equipo» (si estás en la comunidad): tu racha, retos, compañeros y los ánimos de esta semana, y «Ver cómo te
//     ven tus compañeros» (tu perfil en el equipo). Solo lo que ya ven ellos: aquí no se comparte nada nuevo.
// Todo sale de lo que ya hay (sus entrenos, su progreso, la comunidad).
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Segmentos, Pestanas, Vacio } from '../comunes.jsx';
import { perezoso } from '../perezoso.jsx';
import { Logros } from '../Logros.jsx';
import { Huella } from '../Social.jsx';
import { MapaConstancia } from './Progreso.jsx';
import { TusEjercicios } from './Personal.jsx';
import { num, NOMBRE_GRUPO } from '../../logica/calculos.js';
import { fechaMadrid, fmtCorta, fmtConDia } from '../../logica/fechas.js';
import { cifrasPeriodo, semanasPerfil, textoHoras, hitosDe, mejoresRecords } from '../../logica/perfil.js';
import { pesoNum, pesoTxt, etiquetaPeso } from '../../logica/unidades.js';

const HojaPerfilEquipo = perezoso(() => import('../Comunidad.jsx'), 'HojaPerfilEquipo', { mientras: null });
const toneladas = (kg) => num(Math.round((Number(kg) || 0) / 100) / 10, 1);

const PESTANAS = [['resumen', 'Resumen'], ['logros', 'Logros'], ['actividad', 'Actividad']];
export function PerfilSecciones({ salud, irA }) {
  const { api, atleta } = useApp();
  const hoy = fechaMadrid();
  const entrenos = useCarga(() => api.entrenamientos(atleta.id).catch(() => []), [atleta.id]);
  const progreso = useCarga(() => api.progreso(atleta.id).catch(() => null), [atleta.id]);
  const [pest, setPest] = useState('resumen');
  const lista = entrenos.datos || [];
  return (
    <section class="perfil-social" aria-label="Tu actividad en FBE">
      <Pestanas idBase="perfil-pest" clase="perfil-pestanas" etiqueta="Tu actividad" opciones={PESTANAS} valor={pest} alCambiar={setPest} />
      <div role="tabpanel" id="perfil-pest-panel" aria-labelledby={`perfil-pest-${pest}`} class="pila perfil-panel">
        {pest === 'resumen' && (
          <>
            <CifrasPerfil entrenos={lista} hoy={hoy} cargando={entrenos.cargando && !entrenos.datos} />
            <SemanasPerfil entrenos={lista} hoy={hoy} />
            <section class="seccion perfil-sec" aria-labelledby="perfil-constancia-t">
              <h2 id="perfil-constancia-t">Constancia</h2>
              <div class="panel panel-pad"><MapaConstancia atletaId={atleta.id} /></div>
            </section>
          </>
        )}
        {pest === 'logros' && (
          <>
            <VitrinaPerfil progreso={progreso.datos} irA={irA} />
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
  const tiles = [
    ['sesiones', 'Sesiones', String(c.sesiones), null],
    ['tiempo', 'Tiempo', textoHoras(c.minutos), null],
    ['toneladas', 'Toneladas', toneladas(c.tonelaje), 't'],
    ['records', 'Récords', String(c.records), null],
  ];
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-cifras-t">
      <div class="seccion-cab"><h2 id="perfil-cifras-t">Tus cifras</h2></div>
      <Segmentos clase="seg-compacto" etiqueta="Periodo de tus cifras" opciones={PERIODOS} valor={periodo} alCambiar={(v) => v && setPeriodo(v)} />
      <dl class="perfil-tiles" aria-busy={cargando ? 'true' : undefined}>
        {tiles.map(([k, t, v, u]) => (
          <div key={k} data-k={k} class="perfil-tile">
            <dt>{t}</dt>
            <dd class="num">{cargando ? <span class="sil" style="width:3ch;height:1em;display:inline-block" /> : <>{v}{u && <small> {u}</small>}</>}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------- tus 12 semanas (como la gráfica de Hevy)
const MEDIDAS = [['sesiones', 'Sesiones'], ['minutos', 'Horas'], ['tonelaje', 'Volumen']];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function SemanasPerfil({ entrenos, hoy }) {
  const [medida, setMedida] = useState('sesiones');
  const semanas = semanasPerfil(entrenos, hoy, 12);
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
        <div class="perfil-barras" role="img" aria-label={etiqueta}>
          {semanas.map((w, i) => {
            const v = valor(w);
            const mes = i === 0 || w.lunes.slice(5, 7) !== semanas[i - 1].lunes.slice(5, 7) ? MESES[Number(w.lunes.slice(5, 7)) - 1] : '';
            return (
              <span key={w.lunes} class={`pb-col ${i === semanas.length - 1 ? 'actual' : ''}`} aria-hidden="true">
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
            </li>
          ))}
        </ol>
      )}
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
function ActividadPerfil({ entrenos, cargando, irA }) {
  const [cuantos, setCuantos] = useState(5);
  if (cargando) return <div class="sil" style="height:180px;border-radius:16px" />;
  if (!entrenos.length) {
    return <div class="panel"><Vacio ilustracion="semana" titulo="Aún no has terminado ningún entreno"
      accion={irA ? <button class="btn btn-peq" onClick={() => irA('hoy')}><Icono n="play" /> Ir a tu sesión de hoy</button> : null}>Cuando termines tu primera sesión, saldrá aquí.</Vacio></div>;
  }
  return (
    <section class="seccion perfil-sec" aria-labelledby="perfil-actividad-t">
      <h2 id="perfil-actividad-t" class="sr">Tus últimos entrenos</h2>
      <ul class="perfil-feed">
        {entrenos.slice(0, cuantos).map((x) => (
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
      {entrenos.length > cuantos && <button class="btn-texto" style="justify-self:start" onClick={() => setCuantos(cuantos + 10)}>Ver más ({entrenos.length - cuantos})</button>}
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
