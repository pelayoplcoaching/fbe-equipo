// FBE Esencial (sin coach, tanda 3; migración 099): «Tu rutina». Elegirla al empezar (con «Tus gustos»), sus dos o tres
// recomendadas con su porqué, la ficha de cada una (sus días y sus ejercicios, de la base), todo el catálogo con filtros y
// avisos, y cambiarla después (lo recomendable: mantenerla 12 semanas, salvo estancamiento). En su trozo: solo lo descarga
// quien va por su cuenta, al abrirlo.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Segmentos } from '../comunes.jsx';
import { rutinaDe, recomendar, catalogoPara, preguntasGustos, limpiarGustos, gustosCompletos, necesitaPrimeras, consejoCambio, buenMomento, textoMaterial,
  NOMBRE_NIVEL, DE_TEMPORADA, SEMANAS_RUTINA } from '../../logica/esencial-catalogo.js';
import { NOMBRE_PRIMERAS_4 } from '../../logica/esencial.js';
import { fechaLarga } from '../../logica/esencial-alta.js';
import { hoyISO, sumarDias, lunesDe } from '../../logica/fechas.js';
import { EXPERIENCIA, LUGARES } from '../../logica/cuestionario.js';
import { duracionEstimada } from '../../logica/calculos.js';
import { DIAS_SEMANA, nombreDias, seguidos, PROPUESTA_DIAS, leerDias, guardarDias, diasDeSemana } from '../../logica/esencial-dias.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { anadirImagenes } from '../../logica/imagenes.js';
import IMAGENES_RUTINAS from '../../datos/imagenes-rutinas.json';
import { Arte } from './EsencialArte.jsx';

// Las ilustraciones de las rutinas: su lista llega con este trozo (no con lo que se descarga al abrir la app)
anadirImagenes(IMAGENES_RUTINAS);

// Lo que hay en casa que cambia qué rutinas encajan (el resto del material, en su cuestionario)
const EN_CASA = [['mancuernas', 'Mancuernas'], ['banco', 'Banco'], ['gomas', 'Gomas'], ['dominadas', 'Barra de dominadas']];
const enGimnasio = (c) => ['gimnasio', 'gimnasio_basico'].includes(c?.lugar || 'gimnasio');
const sinLunes = (iso) => fechaLarga(iso).replace(/^lunes /, '');

// Dónde está: sin plan, con su plan por empezar, en «Primeras 4 semanas» o con su rutina en marcha
export function situacionRutina(p, hoy = hoyISO()) {
  const bloque = p?.bloque || null;
  const empezado = !!bloque?.fecha_inicio && bloque.fecha_inicio <= hoy;
  const primeras = bloque?.nombre === NOMBRE_PRIMERAS_4;
  const semanas = (p?.semanas || []).filter((w) => w.fecha_inicio && (w.programacion || 'programada') === 'programada');
  const hechas = semanas.filter((w) => w.fecha_inicio <= hoy).length;
  // (su semana de marcas, la 4, ya ha empezado: desde ahí elige con qué sigue)
  const marcas = primeras && semanas.some((w) => w.marcas && w.fecha_inicio <= hoy);
  const modo = !bloque ? 'sin_plan' : primeras ? 'primeras' : !empezado ? 'previo' : 'cambio';
  // (la rutina de antes: el último de sus bloques anteriores que es una rutina del catálogo y no de temporada)
  const anterior = (p?.bloques || []).filter((b) => b.id !== bloque?.id && b.estado !== 'cancelado' && b.nombre !== NOMBRE_PRIMERAS_4 && rutinaDe(b.nombre) && !DE_TEMPORADA.includes(rutinaDe(b.nombre).familia))
    .sort((x, y) => String(y.fecha_inicio || '').localeCompare(String(x.fecha_inicio || '')))[0]?.nombre || null;
  const hizoPrimeras = primeras || (p?.bloques || []).some((b) => b.nombre === NOMBRE_PRIMERAS_4 && b.estado !== 'cancelado');
  return { bloque, modo, empezado, primeras, hizoPrimeras, marcas, semanas: hechas, descarga: empezado && p?.actual?.foco === 'descarga', anterior,
    lunes: sumarDias(lunesDe(hoy), 7) };
}

// «3 × 8-12» · «3 × 30-40 s»
const pauta = (e) => {
  const reps = e.reps_min && e.reps_max && e.reps_min !== e.reps_max ? `${e.reps_min}-${e.reps_max}` : e.reps_max || e.reps_min || null;
  return `${e.series}${reps ? ` × ${reps}${e.por_tiempo ? ' s' : ''}` : ' series'}`;
};
// «Sesiones de unos 45-55 min»: la misma cuenta que hace la app en cada sesión (40 s por serie y sus descansos). Si el
// nombre de la rutina ya lo dice («25–30 minutos»), manda el nombre.
function duracion(r, ficha) {
  const m = /(\d+(?:\D\d+)?) minutos/.exec(r.nombre);
  if (m) return `Sesiones de ${m[1]} minutos`;
  const mins = (ficha?.sesiones || []).map((s) => duracionEstimada((s.ejercicios || []).map((e, i) => ({ ...e, id: i })))).filter((x) => x > 0);
  if (!mins.length) return null;
  const a = Math.min(...mins), b = Math.max(...mins);
  return `Sesiones de unos ${a === b ? a : `${a}-${b}`} min`;
}

// (rutinas.css) Cada regla va en un elemento de este archivo con su clase escrita tal cual: por eso las imágenes van en un
// marco (.rut-marco) y los iconos sueltos en un span (.rut-i). Así sus estilos viajan enteros con este trozo.
const ico = (n, t = 16) => <Icono n={n} width={t} height={t} />;
function ImagenRutina({ r, tamanos = '(min-width: 720px) 640px, 100vw' }) {
  return hayImagen(r.imagen)
    ? <Imagen id={r.imagen} clase="rut-img" tamanos={tamanos} />
    : <span class="rut-img rut-sin-img" aria-hidden="true"><b class="num rut-sin-n">{r.dias}</b><span class="rut-sin-t">días</span></span>;
}
// «Cuerpo entero · Máquinas y mancuernas»: el reparto, y debajo su opción
const partes = (r) => { const i = r.titulo.indexOf(' \u00b7 '); return i < 0 ? [r.titulo, null] : [r.titulo.slice(0, i), r.titulo.slice(i + 3)]; };
const Titulo = ({ r }) => { const [a, b] = partes(r); return <>{a}{b && <span class="rut-h-op">{b}</span>}</>; };
const Mini = ({ r }) => <span class="rut-marco rut-marco-mini"><ImagenRutina r={r} tamanos="112px" /></span>;
const Etiquetas = ({ r, mas = null }) => (
  <span class="rut-etiquetas">
    <span class="chip num">{r.dias} días</span>
    <span class="chip">{textoMaterial(r)}</span>
    {DE_TEMPORADA.includes(r.familia) && <span class="chip aviso">De temporada</span>}
    {mas}
  </span>
);
const Franja = ({ id }) => (hayImagen(id) ? <span class="rut-marco rut-marco-franja"><Imagen id={id} clase="rut-img" tamanos="(min-width: 720px) 640px, 100vw" /></span> : null);

// ---------- La hoja: tus gustos → tus recomendadas → la ficha → confirmar (y todo el catálogo) ----------
// p: su programa; cuestionario: su fila; elegida: la que tiene apuntada; estado: { semanas, estancados, descarga } de su
// rutina de ahora; abrir: { ficha: nombre } para abrirla en la ficha de una. alCambiar({ cuestionario, rutina, rehecho }).
export function HojaRutinas({ p, cuestionario, elegida = null, estancados = 0, abrir = null, alCerrar, alCambiar }) {
  const { api, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const s = situacionRutina(p, hoy);
  const actual = s.bloque?.nombre || null;
  // (tras «Primeras 4 semanas», o con el plan de novato recién preparado: la de novato es su continuación)
  const trasPrimeras = s.primeras || (s.modo === 'previo' && rutinaDe(actual)?.familia === 'novato');
  const cambio = s.modo === 'cambio';
  const [c, setC] = useState(() => ({ ...(cuestionario || {}), material: cuestionario?.material || [],
    // (quien empezó de cero ya no está en «nunca he entrenado»: al cambiar de rutina, menos de un año)
    experiencia: cambio && (cuestionario?.experiencia || 'ninguna') === 'ninguna' ? 'menos_1' : cuestionario?.experiencia || 'ninguna' }));
  const [g, setG] = useState(() => limpiarGustos(cuestionario?.gustos || {}, cuestionario || {}));
  const preguntas = preguntasGustos(c);
  const [paso, setPaso] = useState(() => (abrir?.ficha ? { ficha: abrir.ficha, desde: null } : !cambio && gustosCompletos(g, c) ? 'recomendadas' : 'gustos'));
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const cat = useCarga(() => api.esencialCatalogo().catch(() => []), [atleta.id], { recuerdo: 'esencial-catalogo' });
  const disponibles = cat.datos?.length ? cat.datos.map((x) => x.nombre) : null;
  const recomendadas = recomendar({ cuestionario: c, gustos: g, disponibles, actual, trasPrimeras });
  const todas = catalogoPara({ cuestionario: c, gustos: g, disponibles, trasPrimeras: s.hizoPrimeras });
  const [filtro, setFiltro] = useState({ dias: null, donde: null });
  const ir = (x) => { setError(null); setPaso(x); };
  // Al cambiar de paso: arriba del todo, y el foco en la hoja (el botón que se pulsó ya no está)
  const cima = useRef(null);
  // (lo que hay que decirle a Hoy al cerrar el paso de «Primeras 4 semanas»)
  const alCerrarPrimeras = useRef(null);
  const clavePaso = typeof paso === 'string' ? paso : `${paso.ficha ? 'ficha' : 'confirmar'}:${paso.ficha || paso.confirmar}`;
  const primero = useRef(true);
  useEffect(() => {
    if (primero.current) { primero.current = false; return; }
    let el = cima.current;
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) { el.scrollTop = 0; break; }
      el = el.parentElement;
    }
    cima.current?.closest('[aria-modal="true"]')?.focus?.({ preventScroll: true });
  }, [clavePaso]);

  // --- tus gustos (y, al cambiar de rutina, lo que haya cambiado: días, sitio y experiencia)
  const guardarGustos = (ev) => una(async () => {
    ev.preventDefault();
    setError(null);
    if (!gustosCompletos(g, c)) { setError('Te queda alguna pregunta por contestar.'); return; }
    if (cambio && (!c.dias_semana || !c.lugar)) { setError('Dinos cuántos días puedes entrenar y dónde.'); return; }
    try {
      const datos = { gustos: limpiarGustos(g, c), ...(cambio ? { experiencia: c.experiencia, dias_semana: c.dias_semana, lugar: c.lugar, material: c.material } : {}) };
      const fila = await api.guardarCuestionario(atleta.id, datos);
      // (la criba: con menos de un año y parado o sin soltura, antes de empezar: «Primeras 4 semanas»)
      const aPrimeras = s.modo === 'sin_plan' && necesitaPrimeras({ experiencia: c.experiencia, gustos: g });
      // (a Hoy se le dice al cerrar: con sus gustos ya no le queda nada por elegir, y si se enterase ahora quitaría esta
      // hoja antes de explicarle por qué empieza por ahí)
      if (aPrimeras) alCerrarPrimeras.current = { cuestionario: fila }; else alCambiar?.({ cuestionario: fila });
      ir(aPrimeras ? 'primeras' : 'recomendadas');
    } catch (e) { setError(e.message); }
  });

  if (paso === 'gustos') {
    return (
      <Hoja titulo={cambio ? 'Antes de cambiar de rutina' : 'Elige tu rutina'} alCerrar={alCerrar}>
        <form class="pila rut-gustos" onSubmit={guardarGustos} noValidate ref={cima}>
          <Franja id="rutinas-gustos" />
          <p class="secundario">{cambio
            ? 'Ponemos al día cómo entrenas ahora. Con tus respuestas, la app te recomienda dos o tres rutinas.'
            : 'Unas preguntas cortas sobre cómo entrenas y qué te apetece. Con ellas y con tu cuestionario, la app te recomienda dos o tres rutinas.'}</p>
          {cambio && <>
            <fieldset class="rut-pregunta">
              <legend class="rut-leyenda">¿Cuánto llevas entrenando fuerza?</legend>
              <div class="opciones" role="group" aria-label="Cuánto llevas entrenando fuerza">
                {EXPERIENCIA.filter(([v]) => v !== 'ninguna').map(([v, t]) => <button type="button" key={v} aria-pressed={c.experiencia === v ? 'true' : 'false'} onClick={() => setC({ ...c, experiencia: v })}>{t}</button>)}
              </div>
            </fieldset>
            <fieldset class="rut-pregunta">
              <legend class="rut-leyenda">¿Cuántos días puedes entrenar a la semana?</legend>
              <Segmentos etiqueta="Días a la semana" opciones={[2, 3, 4, 5, 6].map((d) => [d, String(d)])} valor={Number(c.dias_semana) || null} alCambiar={(v) => v && setC({ ...c, dias_semana: v })} />
            </fieldset>
            <fieldset class="rut-pregunta">
              <legend class="rut-leyenda">¿Dónde entrenas?</legend>
              <div class="opciones" role="group" aria-label="Dónde entrenas">
                {LUGARES.map(([v, t]) => <button type="button" key={v} aria-pressed={c.lugar === v ? 'true' : 'false'} onClick={() => setC({ ...c, lugar: v })}>{t}</button>)}
              </div>
            </fieldset>
            {!enGimnasio(c) && (
              <fieldset class="rut-pregunta">
                <legend class="rut-leyenda">¿Qué tienes para entrenar?</legend>
                <div class="rut-material">
                  {EN_CASA.map(([v, t]) => (
                    <label class="casilla" key={v}>
                      <input type="checkbox" checked={c.material.includes(v)} onChange={(e) => setC({ ...c, material: e.currentTarget.checked ? [...c.material, v] : c.material.filter((x) => x !== v) })} />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </>}
          {preguntas.map((q) => (
            <fieldset class="rut-pregunta" key={q.id}>
              <legend class="rut-leyenda">{q.titulo}</legend>
              <div class="opciones" role="group" aria-label={q.titulo}>
                {q.opciones.map(([v, t]) => <button type="button" key={v} aria-pressed={g[q.id] === v ? 'true' : 'false'} onClick={() => setG({ ...g, [q.id]: v })}>{t}</button>)}
              </div>
            </fieldset>
          ))}
          {error && <p class="error" role="alert">{error}</p>}
          <button class="btn btn-primario btn-grande" disabled={ocupado}>Ver mis rutinas recomendadas</button>
        </form>
      </Hoja>
    );
  }

  if (paso === 'primeras') {
    const r = rutinaDe(NOMBRE_PRIMERAS_4);
    const cerrarPrimeras = () => { if (alCerrarPrimeras.current) alCambiar?.(alCerrarPrimeras.current); alCerrarPrimeras.current = null; alCerrar(); };
    return (
      <Hoja titulo="Empiezas por las primeras 4 semanas" alCerrar={cerrarPrimeras}>
        <div class="pila" ref={cima}>
          <span class="rut-marco rut-marco-ficha"><ImagenRutina r={r} /></span>
          <p>Con lo que nos cuentas, lo mejor es empezar por las cuatro semanas de la guía: dos días, cinco ejercicios y una semana final de marcas. Así coges la técnica y el hábito sin prisa.</p>
          <p class="secundario">Al llegar a la semana 4 eliges con qué rutina sigues: la app te recomendará dos o tres.</p>
          <button type="button" class="btn btn-primario btn-grande" onClick={cerrarPrimeras}>De acuerdo</button>
        </div>
      </Hoja>
    );
  }

  if (paso === 'recomendadas') {
    // (las de temporada no se recomiendan: van aparte, para unas semanas, cuando ya tiene su rutina)
    const paraUnasSemanas = s.modo === 'cambio' ? todas.filter((x) => DE_TEMPORADA.includes(x.rutina.familia) && x.rutina.nombre !== actual) : [];
    return (
      <Hoja titulo="Tus rutinas recomendadas" alCerrar={alCerrar}>
        <div class="pila rut-recomendadas" ref={cima}>
          <Franja id="rutinas-recomendadas" />
          <p class="secundario">{trasPrimeras
            ? 'La primera es la continuación de tus primeras semanas. Las otras, por si quieres probar otro reparto.'
            : 'Elegidas con tu cuestionario y tus gustos. La primera es la que mejor te encaja.'}</p>
          {!recomendadas.length && <p class="aviso-suave">Ahora mismo no hay rutinas en el catálogo. Vuelve a mirarlo en un rato.</p>}
          {recomendadas.map(({ rutina: r, porque, nota }, i) => (
            <article class="rut-tarjeta" key={r.nombre} data-primera={i === 0 ? 'si' : null} aria-label={r.titulo}>
              <div class="rut-tarjeta-img">
                <ImagenRutina r={r} />
                {i === 0 && <span class="rut-sello">{ico('estrella', 14)} La que mejor te encaja</span>}
              </div>
              <div class="rut-tarjeta-cuerpo">
                <h3 class="rut-h"><Titulo r={r} /></h3>
                <Etiquetas r={r} />
                <p class="peq secundario">{r.texto}</p>
                <ul class="rut-porque">{porque.map((x) => <li class="rut-porque-l" key={x}><span class="rut-i rut-i-ok">{ico('hecho')}</span>{x}</li>)}</ul>
                {nota && <p class="peq rut-nota"><span class="rut-i rut-i-av">{ico('calendario')}</span>{nota}</p>}
                <div class="rut-acciones">
                  <button type="button" class={`btn ${i === 0 ? 'btn-primario' : ''}`} onClick={() => ir({ confirmar: r.nombre, desde: 'recomendadas' })}>Elegir esta</button>
                  <button type="button" class="btn plano" onClick={() => ir({ ficha: r.nombre, desde: 'recomendadas' })}>Ver sus días</button>
                </div>
              </div>
            </article>
          ))}
          {paraUnasSemanas.length > 0 && (
            <section class="rut-temporada" aria-label="Para unas semanas">
              <h3 class="rut-h">¿De viaje o con poco tiempo?</h3>
              <p class="peq secundario">Para unas semanas. Después vuelves a la tuya desde «Tu rutina», con un toque.</p>
              <ul class="rut-lista">
                {paraUnasSemanas.map(({ rutina: r }) => (
                  <li key={r.nombre}>
                    <button type="button" class="rut-fila" onClick={() => ir({ ficha: r.nombre, desde: 'recomendadas' })}>
                      <Mini r={r} />
                      <span class="rut-fila-texto"><strong class="rut-nombre"><Titulo r={r} /></strong><Etiquetas r={r} /></span>
                      <span class="rut-i rut-i-gris">{ico('derecha', 18)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div class="rut-pie">
            <button type="button" class="btn ancho" onClick={() => ir('catalogo')}><Icono n="biblioteca" /> Ver todo el catálogo{todas.length ? ` (${todas.length})` : ''}</button>
            <button type="button" class="btn plano ancho" onClick={() => ir('gustos')}>Cambiar mis respuestas</button>
          </div>
        </div>
      </Hoja>
    );
  }

  if (paso === 'catalogo') {
    const hayDias = [...new Set(todas.map((x) => x.rutina.dias))].sort((a, b) => a - b);
    const lista = todas.filter((x) => (!filtro.dias || x.rutina.dias === filtro.dias) && (!filtro.donde || x.rutina.donde === filtro.donde));
    const esRecomendada = (r) => recomendadas.some((x) => x.rutina.nombre === r.nombre);
    return (
      <Hoja titulo="Todas las rutinas" alCerrar={alCerrar}>
        <div class="pila rut-catalogo" ref={cima}>
          <Franja id="rutinas-catalogo" />
          <p class="secundario">Puedes elegir cualquiera, pero lo mejor es ceñirte a tus recomendadas: están pensadas para tu nivel, tus días y lo que tienes. Las que no te encajan llevan un aviso.</p>
          <div class="rut-filtros">
            <div class="rut-filtro"><Segmentos etiqueta="Días a la semana" opciones={[[null, 'Todas'], ...hayDias.map((d) => [d, `${d} días`])]} valor={filtro.dias} alCambiar={(v) => setFiltro({ ...filtro, dias: v })} /></div>
            <div class="rut-filtro"><Segmentos etiqueta="Dónde" opciones={[[null, 'Donde sea'], ['g', 'Gimnasio'], ['c', 'Casa']]} valor={filtro.donde} alCambiar={(v) => setFiltro({ ...filtro, donde: v })} /></div>
          </div>
          <p class="peq secundario" role="status">{lista.length === 1 ? 'Una rutina' : `${lista.length} rutinas`}</p>
          <ul class="rut-lista">
            {lista.map(({ rutina: r, aviso: av }) => (
              <li key={r.nombre}>
                <button type="button" class="rut-fila" data-actual={r.nombre === actual ? 'si' : null} onClick={() => ir({ ficha: r.nombre, desde: 'catalogo' })}>
                  <Mini r={r} />
                  <span class="rut-fila-texto">
                    <strong class="rut-nombre"><Titulo r={r} /></strong>
                    <Etiquetas r={r} mas={r.nombre === actual ? <span class="chip morado">La tuya</span> : esRecomendada(r) ? <span class="chip ok">Recomendada</span> : null} />
                    {av && <span class="mini rut-aviso"><span class="rut-i">{ico('alerta', 14)}</span>{av}</span>}
                  </span>
                  <span class="rut-i rut-i-gris">{ico('derecha', 18)}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" class="btn plano ancho" onClick={() => ir('recomendadas')}><Icono n="atras" /> Volver a mis recomendadas</button>
        </div>
      </Hoja>
    );
  }

  const nombre = paso.ficha || paso.confirmar;
  const r = rutinaDe(nombre);
  if (!r) return <Hoja titulo="Rutina" alCerrar={alCerrar}><p>Esa rutina ya no está en el catálogo.</p></Hoja>;
  const av = todas.find((x) => x.rutina.nombre === nombre)?.aviso || null;
  const esLaSuya = nombre === actual;
  const temporada = DE_TEMPORADA.includes(r.familia);
  const volver = () => ir(paso.desde || 'recomendadas');

  if (paso.ficha) {
    const ficha = (cat.datos || []).find((x) => x.nombre === nombre) || null;
    const dura = duracion(r, ficha);
    return (
      <Hoja titulo={partes(r)[0]} alCerrar={alCerrar}>
        <div class="pila rut-ficha" ref={cima}>
          <span class="rut-marco rut-marco-ficha"><ImagenRutina r={r} /></span>
          {partes(r)[1] && <p class="rut-h">{partes(r)[1]}</p>}
          <Etiquetas r={r} mas={esLaSuya ? <span class="chip morado">La tuya</span> : null} />
          <p>{r.texto}</p>
          <dl class="rut-datos">
            <div class="rut-dato"><dt class="rut-dato-t">Para quién</dt><dd class="rut-dato-v">{NOMBRE_NIVEL[r.nivel]}</dd></div>
            {dura && <div class="rut-dato"><dt class="rut-dato-t">Cuánto dura</dt><dd class="rut-dato-v">{dura}</dd></div>}
            <div class="rut-dato"><dt class="rut-dato-t">Qué hace falta</dt><dd class="rut-dato-v">{textoMaterial(r)}</dd></div>
          </dl>
          {av && !esLaSuya && <p class="aviso-suave peq rut-aviso-caja"><span class="rut-i rut-i-av">{ico('alerta', 18)}</span>{av}</p>}
          <section class="rut-dias" aria-label="Sus días">
            <h3 class="rut-h">Sus días</h3>
            {cat.cargando && !ficha && <p class="peq secundario">Cargando sus ejercicios…</p>}
            {!cat.cargando && !ficha && <p class="peq secundario">Sus ejercicios los verás en tu semana, al elegirla.</p>}
            {(ficha?.sesiones || []).map((ses) => (
              <details class="rut-dia" key={ses.orden} open={ses.orden === 1}>
                <summary class="rut-dia-cab"><span class="rut-dia-n num">{ses.orden}</span><span class="rut-dia-nombre">{String(ses.nombre || `Día ${ses.orden}`).replace(/^D.a \d+:\s*/, '')}</span><span class="peq secundario num rut-dia-cuantos">{ses.ejercicios.length} ejercicios</span><span class="rut-i rut-i-gris rut-dia-flecha">{ico('abajo', 18)}</span></summary>
                <ol class="rut-ejercicios">{ses.ejercicios.map((e, i) => <li class="rut-ej" key={`${e.nombre}-${i}`}><span class="rut-ej-n">{e.nombre}</span><span class="num secundario rut-ej-p">{pauta(e)}</span></li>)}</ol>
              </details>
            ))}
          </section>
          <p class="mini secundario">El peso de cada ejercicio lo pone la app semana a semana con lo que apuntas. La primera semana, en los ejercicios nuevos, buscas el peso con el que te sobren 2 o 3 repeticiones.</p>
          {!esLaSuya && s.modo !== 'primeras' && <button type="button" class="btn btn-primario btn-grande" onClick={() => ir({ confirmar: nombre, desde: paso.desde })}>Elegir esta rutina</button>}
          {!esLaSuya && s.modo === 'primeras' && s.marcas && <button type="button" class="btn btn-primario btn-grande" onClick={() => ir({ confirmar: nombre, desde: paso.desde })}>Elegirla para después de mis 4 semanas</button>}
          {paso.desde && <button type="button" class="btn plano ancho" onClick={volver}><Icono n="atras" /> Volver</button>}
        </div>
      </Hoja>
    );
  }

  return <Confirmar {...{ r, av, s, c, p, cima, estancados, temporada, volver, alCerrar, alCambiar, error, setError, ocupado, una, api, atleta, aviso }} />;
}

// --- confirmar: cuándo empieza, sus días si cambian y el consejo de las 12 semanas
function Confirmar({ r, av, s, c, p, cima, estancados, temporada, volver, alCerrar, alCambiar, error, setError, ocupado, una, api, atleta, aviso }) {
  // (sus días: los que eligió en este móvil o, si no, los que ya tienen puestos las sesiones de su semana)
  const guardados = leerDias(atleta.id) || (p?.actual ? diasDeSemana(p.sesiones?.[p.actual.id] || []) : null);
  const pedirDias = !guardados || guardados.length !== r.dias;
  const [dias, setDias] = useState(() => (pedirDias ? PROPUESTA_DIAS[r.dias] || [] : guardados));
  const cambiar = (d) => setDias((x) => (x.includes(d) ? x.filter((y) => y !== d) : x.length >= r.dias ? x : [...x, d].sort((a, b) => a - b)));
  const cambio = s.modo === 'cambio';
  const bueno = !cambio || temporada || buenMomento({ semanas: s.semanas, estancados, descarga: s.descarga });
  const cuando = s.modo === 'sin_plan' ? 'La app te prepara tu plan con ella.'
    : s.modo === 'previo' ? `Tu plan empieza con ella el ${fechaLarga(s.bloque.fecha_inicio)}.`
      : s.modo === 'primeras' ? 'Al acabar tus cuatro primeras semanas, sigues con ella.'
        : `Empiezas con ella el lunes ${sinLunes(s.lunes)}. Hasta entonces, sigues con tu semana de ahora.`;
  const confirmar = () => una(async () => {
    setError(null);
    if (pedirDias && dias.length !== r.dias) { setError(`Elige ${r.dias} días.`); return; }
    try {
      const res = await api.esencialElegirRutina(r.nombre);
      if (res?.falta099) { setError('Para elegir rutina falta una actualización en la base: díselo a Pelayo.'); return; }
      if (pedirDias) guardarDias(atleta.id, dias);
      // (sus días pasan a ser los de la rutina, para las recomendaciones de después)
      let fila = null;
      if (Number(c.dias_semana) !== r.dias) fila = await api.guardarCuestionario(atleta.id, { dias_semana: r.dias }).catch(() => null);
      // (lo que la app ya tenía preparado y sin empezar se ha quitado: se prepara otra vez, con la elegida)
      if (res?.preparar) await api.prepararSemanaEsencial(atleta.id).catch(() => null);
      aviso(s.modo === 'cambio' || s.modo === 'previo' ? `Tu rutina: ${r.titulo}` : 'Rutina elegida');
      alCambiar?.({ rutina: r.nombre, rehecho: !!res?.rehecho, ...(fila ? { cuestionario: fila } : {}) });
      alCerrar();
    } catch (e) { setError(e.message); }
  });
  return (
    <Hoja titulo="Confirma tu rutina" alCerrar={alCerrar}>
      <div class="pila rut-confirmar" ref={cima}>
        <div class="rut-resumen">
          <Mini r={r} />
          <span class="rut-fila-texto"><strong class="rut-nombre"><Titulo r={r} /></strong><Etiquetas r={r} /></span>
        </div>
        <p class="rut-cuando"><span class="rut-i rut-i-mo">{ico('calendario', 18)}</span><span class="rut-despues-t">{cuando}</span></p>
        {cambio && <p class="peq secundario">En los ejercicios que repites sigues con tus kilos. En los nuevos, la primera semana buscas el peso con el que te sobren 2 o 3 repeticiones.</p>}
        {av && <p class="aviso-suave peq rut-aviso-caja"><span class="rut-i rut-i-av">{ico('alerta', 18)}</span>{av}</p>}
        {temporada && <p class="peq secundario">Es para unas semanas. Cuando acabe el viaje o la mala racha, vuelve a la tuya desde «Tu rutina».</p>}
        {!bueno && <p class="aviso-suave peq rut-aviso-caja"><span class="rut-i rut-i-av">{ico('reloj', 18)}</span>{consejoCambio({ semanas: s.semanas })}</p>}
        {!temporada && bueno && <p class="peq secundario">Lo recomendable es mantenerla al menos {SEMANAS_RUTINA} semanas: es lo que tarda en dar resultado.</p>}
        {pedirDias && (
          <fieldset class="rut-pregunta">
            <legend class="rut-leyenda">Elige tus {r.dias} días</legend>
            <div class="rut-teclas" role="group" aria-label="Tus días">
              {DIAS_SEMANA.map(([d, corto, largo]) => (
                <button type="button" class="rut-tecla" key={d} aria-pressed={dias.includes(d) ? 'true' : 'false'} aria-label={largo} disabled={!dias.includes(d) && dias.length >= r.dias} onClick={() => cambiar(d)}>{corto}</button>
              ))}
            </div>
            <p class="peq" role="status">{dias.length ? `Entrenas ${nombreDias(dias)}.` : 'Aún no has elegido ninguno.'}{dias.length === r.dias && r.dias <= 3 && seguidos(dias) ? ' Van seguidos: si puedes, deja un día entre uno y otro.' : ''}</p>
          </fieldset>
        )}
        {error && <p class="error" role="alert">{error}</p>}
        <button type="button" class="btn btn-primario btn-grande" disabled={ocupado} onClick={confirmar}>{!bueno ? 'Cambiar de todos modos' : cambio ? 'Cambiar a esta rutina' : 'Elegir esta rutina'}</button>
        <button type="button" class="btn plano ancho" onClick={volver}><Icono n="atras" /> Volver</button>
      </div>
    </Hoja>
  );
}

// ---------- «Tu rutina»: la tarjeta de Semana, la fila de Perfil y, en Hoy, solo cuando hay algo que decir ----------
// enHoy: solo si toca (elegir tras sus cuatro primeras semanas, un cambio pendiente, estancamiento, una de temporada o
// su plan por empezar). cuestionario: su fila, si ya está cargada (si no, se pide).
export function TuRutina({ p, cuestionario: dado = undefined, recargarPrograma = null, enHoy = false }) {
  const { api, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const s = situacionRutina(p, hoy);
  const nSemanas = (p?.semanas || []).length;
  const estado = useCarga(() => api.esencialRutina(atleta.id, { bloqueId: s.bloque?.id || null, historia: s.modo === 'cambio' && nSemanas >= 3 }).catch(() => null),
    [atleta.id, s.bloque?.id, nSemanas], { recuerdo: `esencial-rutina:${atleta.id}:${s.bloque?.id}:${nSemanas}` });
  const suyo = useCarga(() => (dado !== undefined ? Promise.resolve(dado) : api.cuestionario(atleta.id).catch(() => null)), [atleta.id, dado?.actualizado_en, dado === undefined]);
  const [local, setLocal] = useState(null);     // lo que cambia aquí sin esperar a recargar: { cuestionario, elegida }
  const [hoja, setHoja] = useState(null);       // null | {} | { ficha }
  const [ocupado, una] = useUnaVez();
  const [error, setError] = useState(null);
  if (!s.bloque || !estado.datos?.con099) return null;
  const cuestionario = local?.cuestionario || suyo.datos || null;
  const elegida = local && 'elegida' in local ? local.elegida : estado.datos.elegida;
  const estancados = estado.datos.estancados || 0;
  const actual = rutinaDe(s.bloque.nombre);
  const temporada = !!actual && DE_TEMPORADA.includes(actual.familia);
  // (lo elegido para después: otra que la que lleva; en «Primeras 4 semanas», la que sea)
  const despues = elegida && elegida !== s.bloque.nombre && rutinaDe(elegida) ? rutinaDe(elegida) : null;
  const anterior = temporada && s.anterior ? rutinaDe(s.anterior) : null;
  const toca = s.modo === 'previo' || (s.modo === 'primeras' && s.marcas) || !!despues || temporada
    || (s.modo === 'cambio' && (estancados >= 2 || (s.descarga && s.semanas >= 4)));
  if (enHoy && !toca) return null;
  const alCambiar = (x) => {
    setLocal((l) => ({ ...(l || {}), ...(x.cuestionario ? { cuestionario: x.cuestionario } : {}), ...('rutina' in x ? { elegida: x.rutina } : {}) }));
    if (x.rehecho || x.rutina) recargarPrograma?.();
    if ('rutina' in x) estado.recargar?.(true);
  };
  const elegir = (nombre, texto) => una(async () => {
    setError(null);
    try {
      const res = await api.esencialElegirRutina(nombre);
      if (res?.preparar) await api.prepararSemanaEsencial(atleta.id).catch(() => null);
      aviso(texto);
      alCambiar({ rutina: nombre, rehecho: !!res?.rehecho });
    } catch (e) { setError(e.message); }
  });
  const titulo = actual?.titulo || s.bloque.nombre;
  const desde = s.empezado ? `Desde el ${sinLunes(s.bloque.fecha_inicio)}\u00a0· ${s.semanas === 1 ? 'semana 1' : `semana ${s.semanas}`}` : `Empiezas el ${fechaLarga(s.bloque.fecha_inicio)}`;
  const texto = s.modo === 'primeras'
    ? (s.marcas ? (despues ? null : 'Estás en tu semana de marcas. Elige ya con qué sigues: si no eliges, la app te prepara la de novato de tus días.') : 'Hasta acabar tus cuatro primeras semanas no se cambia de rutina. En la semana 4 eliges con qué sigues.')
    : s.modo === 'previo' ? 'Si antes de tu lunes prefieres otra, puedes cambiarla: tu plan se rehace con ella.'
      : consejoCambio({ semanas: s.semanas, estancados, descarga: s.descarga, temporada });
  return (
    <section class="panel panel-pad rut-tuya" aria-label="Tu rutina" data-modo={s.modo}>
      {/* (v0.244) en su semana de descarga (desde la cuarta) o con dos ejercicios o más sin subir: su ilustración */}
      {s.modo === 'cambio' && <Arte id={s.descarga && s.semanas >= 4 ? 'esencial-descarga' : estancados >= 2 ? 'esencial-estancado' : null} />}
      <div class="rut-resumen">
        {actual ? <Mini r={actual} /> : null}
        <span class="rut-fila-texto">
          <span class="mini secundario">Tu rutina</span>
          <strong class="rut-nombre">{actual ? <Titulo r={actual} /> : titulo}</strong>
          <span class="peq secundario">{desde}</span>
        </span>
      </div>
      {despues && (
        <p class="rut-despues" role="status"><span class="rut-i rut-i-mo">{ico('calendario', 18)}</span>
          <span class="rut-despues-t">{s.modo === 'primeras' ? 'Después de tus cuatro primeras semanas' : `Desde el lunes ${sinLunes(s.lunes)}`}: <strong>{despues.titulo}</strong></span>
        </p>
      )}
      {texto && <p class="peq secundario">{texto}</p>}
      {error && <p class="error" role="alert">{error}</p>}
      <div class="fila-envolver">
        {s.modo === 'primeras' && s.marcas && <button type="button" class={`btn btn-peq ${despues ? '' : 'btn-primario'}`} onClick={() => setHoja({})}>{despues ? 'Elegir otra' : 'Elegir mi siguiente rutina'}</button>}
        {s.modo !== 'primeras' && anterior && <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={() => elegir(anterior.nombre, `Vuelves a tu rutina: ${anterior.titulo}`)}>Volver a {anterior.titulo}</button>}
        {s.modo !== 'primeras' && <button type="button" class="btn btn-peq" onClick={() => setHoja({})}>Cambiar de rutina</button>}
        {despues && s.modo !== 'primeras' && actual && <button type="button" class="btn btn-peq plano" disabled={ocupado} onClick={() => elegir(s.bloque.nombre, 'Sigues con tu rutina')}>Seguir con la mía</button>}
        {actual && <button type="button" class="btn btn-peq plano" onClick={() => setHoja({ ficha: s.bloque.nombre })}>Ver sus días</button>}
      </div>
      {hoja && <HojaRutinas p={p} cuestionario={cuestionario} elegida={elegida} estancados={estancados} abrir={hoja.ficha ? hoja : null} alCerrar={() => setHoja(null)} alCambiar={alCambiar} />}
    </section>
  );
}
