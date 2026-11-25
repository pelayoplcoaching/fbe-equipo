// FBE Esencial: lo de quien va por su cuenta en Hoy: la bienvenida (en lugar del mensaje del coach, que promete respuesta),
// la tarjeta grande de antes de empezar (cuestionario, visto bueno y su lunes) y sus marcas de la semana 4.
// Con las piezas de siempre (la tarjeta de aviso de Hoy, la hoja y la lista): sin estilos nuevos.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Capa } from '../comunes.jsx';
import { esPorSuCuenta, NOMBRE_PRIMERAS_4, WEB_FBE, CORREO_CONTACTO } from '../../logica/esencial.js';
import { MENSAJE_ESENCIAL, estadoEsencial, fechaLarga, plantillaEsencial, PORTAL_ESENCIAL } from '../../logica/esencial-alta.js';
import { hoyISO, sumarDias, hace, lunesDe } from '../../logica/fechas.js';
import { semanaDelPlan, leccionDe } from '../../logica/esencial-lecciones.js';
import { NOVATOS } from '../../logica/esencial-semana.js';
import { estadoCierre, textoCierre, puedePausar, horaMadrid, HORA_AUTO, HORA_AUTO_098 } from '../../logica/esencial-cierre.js';
import { Ilustracion } from '../Ilustraciones.jsx';
import { Imagen } from '../Imagen.jsx';
import { Arte, hayArte } from './EsencialArte.jsx';
import { ARTE_HERO, ARTE_CIERRE, arteLeccion, arteSemanaHecha } from '../../logica/esencial-arte.js';
import { Pantallas, esIosNavegador, esAppInstalada } from './Bienvenida.jsx';
import { estadoPush, activarPush, suscripcionActual, conEmail } from '../../datos/push.js';
import { PRIMERAS_4 } from '../../logica/esencial-plantilla.js';
import { DIAS_SEMANA, nombreDias, seguidos, PROPUESTA_DIAS, diasDeSemana, planDias, leerDias, guardarDias } from '../../logica/esencial-dias.js';
import { perezoso } from '../perezoso.jsx';

const FichaEjercicio = perezoso(() => import('../FichaEjercicio.jsx'), 'FichaEjercicio', { mientras: null });
// (099) «Tu rutina» (elegirla, sus recomendadas, el catálogo): en su trozo, con el catálogo entero
const HojaRutinas = perezoso(() => import('./EsencialRutinas.jsx'), 'HojaRutinas', { mientras: null });
const TuRutina = perezoso(() => import('./EsencialRutinas.jsx'), 'TuRutina', { mientras: null });
// (v0.245) cada tarjeta, con su «¿Dudas?», y en Perfil, todas las respuestas (en el trozo de la ayuda)
const Dudas = perezoso(() => import('./EsencialAyuda.jsx'), 'Dudas', { mientras: null });
const TodasLasRespuestas = perezoso(() => import('./EsencialAyuda.jsx'), 'TodasLasRespuestas', { mientras: null });

// ---------- (alta, 28-32) Antes de empezar ----------
// Un consejo de las guías cada día de la cuenta atrás (textos de las lecciones aprobadas por Pelayo y de la guía)
export const CONSEJOS_ANTES = [
  'El primer día, pide a alguien de sala que te ajuste las máquinas: son cinco minutos y te ahorran un mes de dudas.',
  'El primer día no lo sabe nadie: empieza con poco peso, haz doce repeticiones y pregúntate cuántas más habrías podido hacer.',
  'Elige dos días que no vayan seguidos: así descansas entre uno y otro.',
  'Las agujetas de las dos primeras semanas son normales: luego bajan, y no dicen si entrenaste bien o mal.',
  'Si fallas una sesión, no la recuperes doblando al día siguiente: sigue donde tocaba.',
  'El objetivo de enero es llegar a febrero.',
  'Mira los vídeos de tus ejercicios antes del primer día: irás con el gesto en la cabeza.',
];
export const consejoDe = (faltan) => CONSEJOS_ANTES[Math.abs(Number(faltan) || 0) % CONSEJOS_ANTES.length];

// (alta, 29) El camino del piloto, de un vistazo
function CaminoEsencial() {
  return (
    <ol class="alta-camino" aria-label="Tu camino">
      <li><strong>Semanas 1 a 4</strong><span class="mini">las de la guía</span></li>
      <li><strong>Semana 4</strong><span class="mini">tus marcas</span></li>
      <li><strong>Desde la 5</strong><span class="mini">la app te prepara cada semana</span></li>
    </ol>
  );
}

// Cuántas sesiones por semana: las de su semana 1 (con plan) o, sin plan, las de su plantilla (la guía, dos)
function sesionesPorSemana(p, cuestionario) {
  const w = [...(p?.semanas || [])].sort((a, b) => a.numero - b.numero)[0];
  if (w) return (p.sesiones?.[w.id] || []).length || 2;
  return !cuestionario || (cuestionario.experiencia || 'ninguna') === 'ninguna' ? 2 : Math.min(5, Math.max(2, Number(cuestionario.dias_semana) || 2));
}

// (alta, 31) Elige tus días: que no vayan seguidos. Pone cada sesión de sus semanas en su día (lo usa el aviso «Hoy toca»)
// y se recuerda en este móvil para las semanas que prepare la app después.
export function HojaTusDias({ p, cuestionario = null, alCerrar, alGuardar }) {
  const { api, atleta, aviso } = useApp();
  const n = sesionesPorSemana(p, cuestionario);
  const w1 = [...(p?.semanas || [])].sort((a, b) => a.numero - b.numero).find((w) => w.fecha_inicio >= lunesDe(hoyISO())) || null;
  const [dias, setDias] = useState(() => leerDias(atleta.id) || (w1 && diasDeSemana(p.sesiones?.[w1.id] || [])) || PROPUESTA_DIAS[n] || PROPUESTA_DIAS[2]);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const cambiar = (d) => setDias((x) => (x.includes(d) ? x.filter((y) => y !== d) : x.length >= n ? x : [...x, d].sort((a, b) => a - b)));
  const guardar = () => una(async () => {
    setError(null);
    if (dias.length !== n) { setError(n === 1 ? 'Elige un día.' : `Elige ${n} días.`); return; }
    try {
      guardarDias(atleta.id, dias);
      const cambios = p?.bloque ? planDias({ semanas: p.semanas, sesiones: p.sesiones, dias, hoy: hoyISO() }) : [];
      for (const c of cambios) await api.planificarSesion(c.id, c.dia);
      aviso(`Tus días: ${nombreDias(dias)}`);
      alGuardar?.(dias, cambios.length);
      alCerrar();
    } catch (e) { setError(e.message); }
  });
  return (
    <Hoja titulo="Elige tus días" alCerrar={alCerrar}>
      <div class="pila">
        <p class="secundario">{n === 2 ? 'Dos días a la semana' : `${n} días a la semana`}, mejor que no vayan seguidos: así descansas entre uno y otro. La app pone cada sesión en su día y, por la mañana, te avisa de que hoy toca.</p>
        <div class="alta-dias" role="group" aria-label="Tus días">
          {DIAS_SEMANA.map(([d, corto, largo]) => (
            <button type="button" key={d} aria-pressed={dias.includes(d) ? 'true' : 'false'} aria-label={largo} disabled={!dias.includes(d) && dias.length >= n} onClick={() => cambiar(d)}>{corto}</button>
          ))}
        </div>
        <p class="peq" role="status">{dias.length ? `Entrenas ${nombreDias(dias)}.` : 'Aún no has elegido ninguno.'}{dias.length === n && seguidos(dias) ? ' Van seguidos: si puedes, deja un día entre uno y otro.' : ''}</p>
        {error && <p class="error" role="alert">{error}</p>}
        <button type="button" class="btn btn-primario btn-grande" disabled={ocupado} onClick={guardar}>Guardar mis días</button>
      </div>
    </Hoja>
  );
}

// Sus días puestos en las semanas que aún no los tienen (las que prepara la app cada semana), con lo elegido en este móvil
export function AplicarDias({ p, recargarPrograma }) {
  const { api, atleta } = useApp();
  useEffect(() => {
    const dias = leerDias(atleta.id);
    if (!dias || !p?.bloque) return;
    const cambios = planDias({ semanas: p.semanas, sesiones: p.sesiones, dias, hoy: hoyISO(), soloSinDia: true });
    if (!cambios.length) return;
    (async () => {
      try { for (const c of cambios) await api.planificarSesion(c.id, c.dia); recargarPrograma?.(); } catch { /* lo intenta la próxima vez */ }
    })();
  }, [p?.bloque?.id, p?.actual?.id, (p?.semanas || []).length]);
  // (099) y, en Hoy, «Tu rutina» cuando hay algo que decir (su plan por empezar, elegir tras sus cuatro primeras semanas,
  // un cambio pendiente, estancamiento o una de temporada)
  return p?.bloque ? <TuRutina p={p} recargarPrograma={recargarPrograma} enHoy /> : null;
}

// (alta, 28 y 30) Su semana 1, ejercicio a ejercicio: cómo se hace cada uno (su ficha, con el vídeo) y su alternativa. Con
// plan, la de su plan; sin plan (esperando el visto bueno), la de la guía si es la suya.
export function SemanaUnoEsencial({ p = null, cuestionario = null, mientras = false }) {
  const { api, atleta } = useApp();
  const [ficha, setFicha] = useState(null);
  const conPlan = !!p?.bloque;
  const lista = useCarga(async () => {
    if (conPlan) {
      const w = [...(p.semanas || [])].sort((a, b) => a.numero - b.numero)[0];
      const vistos = new Map();
      for (const s of (w ? (p.sesiones?.[w.id] || []) : [])) {
        const d = await api.sesion(s.id, atleta.id);
        for (const x of d?.ejercicios || []) if (x.ejercicio && !vistos.has(x.ejercicio.id)) vistos.set(x.ejercicio.id, { ejercicio: x.ejercicio, nota: x.notas_coach || null });
      }
      return [...vistos.values()];
    }
    if (plantillaEsencial(cuestionario || {}) !== NOMBRE_PRIMERAS_4) return [];
    const ej = await api.ejerciciosPorNombre(PRIMERAS_4.ejercicios.map((e) => e.nombre));
    const por = new Map((ej || []).map((x) => [x.nombre, x]));
    return PRIMERAS_4.ejercicios.map((e) => ({ ejercicio: por.get(e.nombre) || { nombre: e.nombre }, nota: e.nota }));
  }, [conPlan ? p.bloque.id : `sin:${cuestionario?.experiencia}`], { recuerdo: `semana1-esencial:${atleta.id}:${conPlan ? p.bloque.id : 'guia'}` });
  const xs = lista.datos || [];
  if (!xs.length) return null;
  return (
    <section class="panel panel-pad pila-s alta-semana1" aria-labelledby="alta-s1-t">
      <strong id="alta-s1-t">Tu semana 1, ejercicio a ejercicio</strong>
      <span class="peq secundario">{mientras
        ? 'Mientras esperas el visto bueno, ve conociendo tus ejercicios: cómo se hace cada uno y qué hacer si no hay máquina.'
        : 'Para verlos en casa antes de tu primer día: cómo se hace cada uno y qué hacer si no hay máquina.'}</span>
      <ul class="alta-ejercicios">
        {xs.map(({ ejercicio, nota }) => (
          <li key={ejercicio.id || ejercicio.nombre}>
            <span class="pila-xs">
              <strong class="peq">{ejercicio.nombre}</strong>
              {nota && <span class="mini terciario">{nota}</span>}
            </span>
            {ejercicio.id && (ejercicio.video_url || ejercicio.instrucciones) && (
              <button type="button" class="btn btn-peq" aria-label={`Cómo se hace: ${ejercicio.nombre}`} onClick={() => setFicha(ejercicio)}><Icono n="video" /> Cómo se hace</button>
            )}
          </li>
        ))}
      </ul>
      {ficha && <FichaEjercicio atletaId={atleta.id} ejercicio={ficha} inicial="tecnica" alCerrar={() => setFicha(null)} />}
    </section>
  );
}

// (alta, 31) La tarjeta de sus días antes de empezar: los que eligió o «Elige tus días»
export function TusDiasTarjeta({ p, cuestionario = null }) {
  const { atleta } = useApp();
  const [hoja, setHoja] = useState(false);
  const [dias, setDias] = useState(() => leerDias(atleta.id));
  const w = [...(p?.semanas || [])].sort((a, b) => a.numero - b.numero)[0];
  const puestos = dias || (w && diasDeSemana(p.sesiones?.[w.id] || []));
  return (
    <section class="nota-coach alta-tus-dias" aria-label="Tus días">
      <Icono n="calendario" />
      <div class="pila-s">
        <span class="peq">{puestos ? `Entrenas ${nombreDias(puestos)}. Cada sesión ya está en su día y esa mañana te avisamos.` : 'Elige qué días vas a entrenar (mejor que no vayan seguidos): la app pone cada sesión en su día y esa mañana te avisa.'}</span>
        <button type="button" class={`btn btn-peq ${puestos ? '' : 'btn-primario'}`} style="justify-self:start" onClick={() => setHoja(true)}>{puestos ? 'Cambiar mis días' : 'Elegir mis días'}</button>
      </div>
      {hoja && <HojaTusDias p={p} cuestionario={cuestionario} alCerrar={() => setHoja(false)} alGuardar={(d) => setDias(d)} />}
    </section>
  );
}

// Lo de antes de empezar, debajo de la tarjeta grande: esperando el visto bueno, su semana 1 de la guía; con su plan y antes
// de su lunes, sus días y su semana 1 con sus vídeos
export function AntesDeEmpezar({ p, cuestionario }) {
  const { api, atleta } = useApp();
  const hoy = hoyISO();
  const ficha = useCarga(() => api.estadoEsencial(atleta.id), [atleta.id, cuestionario?.completado_en, cuestionario?.resultado], { recuerdo: `estado-esencial:${atleta.id}` });
  const e = estadoEsencial({ bloque: p?.bloque || null, cuestionario, ficha: ficha.datos, hoy, rutina: atleta.esencial_plantilla ?? null, con099: 'esencial_plantilla' in atleta });
  if (!e || ficha.datos?.falta091) return null;
  if (e.tipo === 'visto_bueno' || e.tipo === 'revision') return <SemanaUnoEsencial cuestionario={cuestionario} mientras />;
  if (e.tipo !== 'espera') return null;
  return <><TusDiasTarjeta p={p} cuestionario={cuestionario} /><SemanaUnoEsencial p={p} /></>;
}

// ---------- (alta, 11-15) La bienvenida de FBE Esencial: cómo funciona, hasta su lunes, los avisos e instalarla ----------
const DibujoCalendario = () => (
  <svg viewBox="0 0 200 150" aria-hidden="true">
    <rect x="44" y="16" width="112" height="120" rx="14" class="b-marco" />
    <path d="M58 16h84a14 14 0 0 1 14 14v14H44V30a14 14 0 0 1 14-14z" class="b-morado" />
    {[0, 1, 2, 3, 4, 5, 6].map((c) => <rect key={c} x={55 + c * 13.5} y="54" width="9" height="5" rx="2.5" class="b-linea-suave" />)}
    {[0, 1, 2, 3].flatMap((f) => [0, 1, 2, 3, 4, 5, 6].map((c) => (
      <rect key={`${f}${c}`} x={53 + c * 13.5} y={66 + f * 16} width="12" height="11" rx="3" class={f === 1 && c === 0 ? 'b-ok' : 'b-hoja'} />
    )))}
    <path d="M55.5 87.5l3 3 5-6" class="b-check" style="stroke-width:2.5" />
  </svg>
);
const DibujoAvisos = () => (
  <svg viewBox="0 0 200 150" aria-hidden="true">
    <path d="M100 20c-21 0-35 15-35 37v23l-11 17h92l-11-17V57c0-22-14-37-35-37z" class="b-hoja" />
    <path d="M87 104a13 13 0 0 0 26 0z" class="b-linea" />
    <circle cx="130" cy="32" r="12" class="b-morado" />
    <rect x="62" y="122" width="76" height="7" rx="3.5" class="b-linea-suave" />
  </svg>
);

export function BienvenidaInicioEsencial({ nombre, alTerminar }) {
  const { atleta } = useApp();
  const hoy = hoyISO();
  const inicio = atleta?.esencial_inicio || null;
  const antes = !!inicio && inicio > hoy;
  const ios = esIosNavegador();
  // (v0.244) con su ilustración si ha llegado; si no, el dibujo de siempre
  const foto = (id, sin) => (hayArte(id) ? <Imagen id={id} clase="bienvenida-foto" tamanos="(min-width: 500px) 460px, 92vw" prioridad /> : sin);
  const pantallas = [
    { dibujo: foto('esencial-bienvenida-plan', 'programa'), titulo: `Hola, ${nombre}`, texto: 'Aquí tendrás tu plan. Así funciona FBE Esencial:', extra: (
      <ol class="alta-tres">
        <li><strong>Tu cuestionario.</strong> Unos minutos: tu experiencia, tus días, dónde entrenas y unas preguntas de salud.</li>
        <li><strong>Tu plan.</strong> Con tus respuestas, la app te lo prepara.</li>
        <li><strong>{antes ? `Empiezas el ${fechaLarga(inicio)}.` : 'Empiezas.'}</strong> Cada semana, la app te prepara la siguiente con lo que apuntas.</li>
      </ol>
    ) },
    ...(antes ? [{ dibujo: foto('esencial-bienvenida-lunes', <DibujoCalendario />), titulo: 'Hasta tu lunes',
      texto: `Hasta el ${fechaLarga(inicio)}, rellena tu cuestionario y, en cuanto tengas tu plan, mira tu semana 1 y los vídeos de sus ejercicios. Las sesiones se abren ese día.` }] : []),
    { dibujo: foto('esencial-bienvenida-serie', 'serie'), titulo: 'Apunta cada serie', texto: 'Kilos, repeticiones y cuántas te sobraban. Si haces justo lo que te propone la app, basta con tocar ✓. Funciona aunque el gimnasio no tenga cobertura.' },
    { dibujo: foto('esencial-bienvenida-avisos', <DibujoAvisos />), titulo: 'Los avisos',
      texto: 'Te avisamos si te falta el cuestionario, la víspera y el día en que empiezas y si llevas días sin entrenar. Sin avisos activados, no te llega ninguno.', extra: <PasoAvisos /> },
    ...(esAppInstalada() ? [] : [{ dibujo: 'instalar', instalar: true, titulo: 'Tenla a mano',
      texto: ios ? 'En Safari, toca Compartir (el cuadrado con la flecha hacia arriba) y luego «Añadir a pantalla de inicio». Se abrirá como una app y te podrán llegar los avisos.'
        : 'En Chrome, toca «Instalar» o el menú ⋮ y luego «Instalar aplicación» (o «Añadir a pantalla de inicio»). Se abrirá como una app.' }]),
  ];
  return <Capa><Pantallas pantallas={pantallas} alTerminar={alTerminar} etiqueta="Bienvenida a FBE Esencial" /></Capa>;
}

// (alta, 37) Los avisos, desde sus primeros pasos: para qué son y cómo activarlos
export function HojaAvisosEsencial({ alCerrar }) {
  return (
    <Hoja titulo="Los avisos" alCerrar={alCerrar}>
      <div class="pila">
        <p class="secundario">Te avisamos si te falta el cuestionario, la víspera y el día en que empiezas, el día que toca entrenar y si llevas días sin entrenar. Sin avisos activados, no te llega ninguno.</p>
        <PasoAvisos />
        <p class="peq terciario">Qué te llega y a qué hora, lo eliges en Perfil, en «Notificaciones».</p>
      </div>
    </Hoja>
  );
}

// (alta, 13 y 14) Activar los avisos durante el alta: en el móvil (el permiso se pide al tocar, nunca solo) o, si no se
// puede o no quiere, por correo
export function PasoAvisos() {
  const { api, modo, aviso } = useApp();
  const estado = estadoPush(modo);
  const [hecho, setHecho] = useState(null);   // 'movil' | 'correo'
  const [bloqueado, setBloqueado] = useState(estado === 'bloqueado');
  const [ocupado, una] = useUnaVez();
  useEffect(() => { if (estado === 'ok') suscripcionActual().then((s) => { if (s) setHecho('movil'); }).catch(() => {}); }, []);
  const movil = () => una(async () => {
    try {
      const r = await activarPush(api);
      if (r === 'activadas') { setHecho('movil'); api.probarNotificacion().catch(() => {}); aviso('Avisos activados: te llegará uno de prueba'); }
      else if (r === 'bloqueado') setBloqueado(true);
    } catch (e) { aviso(`No se han podido activar: ${e.message}`, 'error'); }
  });
  const correo = () => una(async () => {
    try { const p = await api.preferenciasNotificaciones(); await api.guardarPreferenciasNotificaciones({ ...p, email: true }); setHecho('correo'); }
    catch (e) { aviso(e.message, 'error'); }
  });
  if (hecho) return <p class="alta-hecho" role="status"><Icono n="hecho" /> {hecho === 'movil' ? 'Activados en este móvil.' : 'Te llegarán por correo, como mucho uno por hora.'}</p>;
  const empuje = estado === 'ok' && !bloqueado;
  return (
    <div class="pila-s alta-avisos">
      {empuje && <button type="button" class="btn btn-primario" disabled={ocupado} onClick={movil}><Icono n="campana" /> Activar los avisos</button>}
      {estado === 'ios_instalar' && <p class="peq secundario">En iPhone, los avisos solo llegan a la app instalada: añádela a tu pantalla de inicio, ábrela desde ahí y actívalos en tu perfil.</p>}
      {bloqueado && <p class="peq secundario">Los tienes bloqueados para esta web: permítelos en los ajustes del navegador o del móvil.</p>}
      {estado === 'demo' && <p class="peq secundario">En la demo no se envían avisos al móvil.</p>}
      {(conEmail() || modo === 'demo') && <button type="button" class="btn" disabled={ocupado} onClick={correo}><Icono n="mensaje" /> {empuje ? 'Prefiero por correo' : 'Avisarme por correo'}</button>}
    </div>
  );
}

// La tarjeta sale cuando ha terminado su semana de marcas y durante las tres semanas siguientes
export function TarjetaMarcas() {
  const { api, atleta } = useApp();
  const [abierta, setAbierta] = useState(false);
  const datos = useCarga(() => (esPorSuCuenta(atleta) ? api.marcasEsencial(atleta.id) : Promise.resolve(null)), [atleta?.id], { recuerdo: `marcas-esencial:${atleta?.id}` });
  const d = datos.datos;
  if (!d || !d.completa || !d.marcas.length || sumarDias(d.semana.fecha_inicio, 7 * 4) < hoyISO()) return null;
  return (
    <>
      <section class="nota-coach tarjeta-marcas" aria-label="Tus marcas">
        <Arte id="esencial-marcas" />
        <Icono n="trofeo" />
        <div class="pila-s">
          <strong>Ya tienes tus marcas de la semana {d.semana.numero}</strong>
          <span class="peq">El peso y las repeticiones de tu mejor serie en cada ejercicio: el punto de partida para todo lo que venga.</span>
          <button type="button" class="btn btn-primario btn-peq" style="justify-self:start" onClick={() => setAbierta(true)}>Ver tus marcas</button>
          <Dudas de="marcas" />
        </div>
      </section>
      {abierta && <HojaMarcas datos={d} alCerrar={() => setAbierta(false)} />}
    </>
  );
}

export function HojaMarcas({ datos, alCerrar }) {
  return (
    <Hoja titulo="Tus marcas" alCerrar={alCerrar}>
      <div class="pila">
        <p class="secundario">Semana {datos.semana.numero}{datos.bloque?.nombre ? ` de «${datos.bloque.nombre}»` : ''}: tu mejor serie en cada ejercicio.</p>
        <ul class="lista lista-marcas">
          {datos.marcas.map((m) => (
            <li key={m.ejercicio_id} class="separa" style="padding: var(--esp-12) 0">
              <span>{m.nombre}</span>
              <strong class="num">{m.texto}</strong>
            </li>
          ))}
        </ul>
        <p class="peq secundario">Desde la semana 5, la app te prepara cada semana a partir de estas marcas, con las reglas de progresión de Pelayo.</p>
        <button type="button" class="btn btn-primario" onClick={alCerrar}>Vale</button>
      </div>
    </Hoja>
  );
}

// La bienvenida de quien va por su cuenta, mientras tiene primeros pasos: qué hace la app (sin prometer respuestas)
export function BienvenidaEsencial({ bloque = null }) {
  const primeras = bloque?.nombre === NOMBRE_PRIMERAS_4;
  return (
    <section class="nota-coach bienvenida-esencial" aria-label="Bienvenida a FBE Esencial">
      <Arte id="esencial-hoy-empiezas" />
      <Icono n="diana" />
      <div class="pila-s">
        <strong>Te damos la bienvenida a FBE Esencial</strong>
        <span class="peq">{primeras
          ? 'Tus cuatro primeras semanas son las de la guía: la app te dice qué toca cada día y tú apuntas tus kilos y tus repeticiones. En la cuarta guardamos tus marcas y, desde la quinta, la app te prepara cada semana con las reglas de progresión de Pelayo.'
          : 'La app te dice qué toca cada día y tú apuntas tus kilos y tus repeticiones. Cada semana, la app te prepara la siguiente con las reglas de progresión de Pelayo, a partir de lo que apuntas.'}</span>
      </div>
    </section>
  );
}

// ---------- Antes de empezar: el cuestionario, el visto bueno y su lunes ----------
// La tarjeta grande de Hoy (en lugar de «Tu semana está en camino», que habla de su coach) mientras no tiene plan o aún
// no ha llegado su lunes. Con el cuestionario enviado y el cribado limpio (o el visto bueno confirmado), pide su plan una
// vez (lo asigna la base: esencial_asignar_plan, migración 091) y recarga el programa.
export function HeroEsencial({ p, cuestionario, abrirCuestionario, recargarPrograma, irA }) {
  const { api, atleta } = useApp();
  const ficha = useCarga(() => api.estadoEsencial(atleta.id), [atleta.id, cuestionario?.completado_en, cuestionario?.resultado], { recuerdo: `estado-esencial:${atleta.id}` });
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const pedido = useRef(false);
  const [intento, setIntento] = useState(0);
  const hoy = hoyISO();
  const bloque = p?.bloque || null;
  // (099) con la base al día, quien tiene experiencia contesta «Tus gustos» y elige su rutina antes de que la app le prepare
  // el plan. Lo que guarda la hoja (sus gustos, la rutina) se ve aquí al momento, sin esperar a recargar.
  const [mio, setMio] = useState(null);
  const [rutina, setRutina] = useState(atleta.esencial_plantilla ?? null);
  const [verRutinas, setVerRutinas] = useState(false);
  useEffect(() => { setMio(null); }, [cuestionario]);
  const cuest = mio || cuestionario;
  const e = estadoEsencial({ bloque, cuestionario: cuest, ficha: ficha.datos, hoy, rutina, con099: 'esencial_plantilla' in atleta });
  // (sin la ficha aún, el visto bueno no se sabe: se espera a ella salvo con el cribado limpio)
  const listoParaPlan = e?.tipo === 'preparando' && (cuestionario?.resultado === 'sin_valoracion' || !!ficha.datos);
  useEffect(() => {
    if (!listoParaPlan || pedido.current) return;
    pedido.current = true;
    setError(null);
    api.esencialAsignarPlan()
      .then((r) => { if (r?.bloque) recargarPrograma?.(); else setError('Tu plan aún no está listo: vuelve a intentarlo en un rato.'); })
      .catch((err) => setError(err.message || 'No se ha podido preparar tu plan.'));
  }, [listoParaPlan, intento]);
  if (!e || ficha.datos?.falta091) return null;
  const marco = (contexto, icono, chip, titulo, texto, acciones = null, extra = null) => (
    <section class="hero-dia hero-espera" aria-label={titulo}>
      {/* (v0.244) cada estado, con su ilustración arriba de la tarjeta (de fondo no se veía, tapada por el texto); sin ella,
          el dibujo de siempre */}
      {hayArte(ARTE_HERO[e?.tipo]) ? <Arte key={ARTE_HERO[e.tipo]} id={ARTE_HERO[e.tipo]} /> : <Ilustracion n="espera" clase="hero-ilu" />}
      <div class="titular">
        {contexto && <div class="contexto"><span>{contexto}</span></div>}
        <span class="chip toca-hoy descanso"><Icono n={icono} />{chip}</span>
        <h2>{titulo}</h2>
        <p class="peq secundario">{texto}</p>
        {extra}
        {error && <p class="error" role="alert">{error}</p>}
      </div>
      {acciones && <span class="hero-acciones">{acciones}</span>}
    </section>
  );
  if (e.tipo === 'cuestionario') {
    return marco(null, 'pregunta', 'Antes de empezar', e.empezado ? 'Termina tu cuestionario' : 'Rellena tu cuestionario',
      'Son unos minutos: tu experiencia, los días que puedes entrenar, dónde y con qué, y unas preguntas de salud. Con tus respuestas, la app te prepara tu plan.',
      <button class="btn btn-grande btn-hero" onClick={() => abrirCuestionario()}><Icono n="editar" /> {e.empezado ? 'Seguir' : 'Empezar'}</button>);
  }
  if (e.tipo === 'salud') {
    return marco(null, 'alerta', 'Te falta una parte', 'Completa la parte de salud',
      'Sin las preguntas de salud, la app no puede prepararte tu plan: son las que dicen si conviene que te vea un médico antes de empezar.',
      <button class="btn btn-grande btn-hero" onClick={() => abrirCuestionario('salud')}><Icono n="editar" /> Completar</button>);
  }
  if (e.tipo === 'rutina') {
    return (
      <>
        {marco(null, 'pregunta', 'Un paso más', 'Elige tu rutina',
          e.gustos ? 'Tus rutinas recomendadas ya están listas: elige con cuál empiezas.'
            : 'Unas preguntas cortas sobre cómo entrenas y qué te apetece, y la app te recomienda dos o tres rutinas.',
          <button class="btn btn-grande btn-hero" onClick={() => setVerRutinas(true)}><Icono n="editar" /> {e.gustos ? 'Ver mis rutinas' : 'Empezar'}</button>)}
        {verRutinas && <HojaRutinas p={p} cuestionario={cuest} alCerrar={() => setVerRutinas(false)}
          alCambiar={(x) => { if (x.cuestionario) setMio(x.cuestionario); if (x.rutina) setRutina(x.rutina); }} />}
      </>
    );
  }
  if (e.tipo === 'visto_bueno') {
    return marco(null, 'alerta', 'Antes de empezar', 'El visto bueno de tu médico', MENSAJE_ESENCIAL[e.resultado] || MENSAJE_ESENCIAL.valorar_antes,
      <button class="btn btn-grande btn-hero" disabled={ocupado} onClick={() => una(async () => {
        setError(null);
        try { await api.esencialPedirVistoBueno(); ficha.recargar(true); } catch (err) { setError(err.message); }
      })}><Icono n="hecho" /> Ya tengo el visto bueno</button>,
      <p class="peq secundario">Pide cita con tu médico de cabecera o haz una <a href={`${WEB_FBE}/puesta-a-punto.html`} target="_blank" rel="noopener">Puesta a punto con Pelayo</a>. Cuando lo tengas, márcalo aquí: Pelayo lo confirma y la app te prepara tu plan.</p>);
  }
  if (e.tipo === 'revision') {
    return marco(null, 'reloj', 'En revisión', 'Pelayo está revisando tu visto bueno',
      `Lo marcaste ${hace(String(e.desde).slice(0, 10), hoy)}. En cuanto lo confirme, aquí verás tu plan.`);
  }
  if (e.tipo === 'preparando') {
    return marco(null, 'reloj', 'Un momento', 'Preparando tu plan', 'Con tus respuestas, la app elige tu plan y lo deja listo desde tu lunes.',
      error ? <button class="btn btn-grande btn-hero" onClick={() => { pedido.current = false; setError(null); setIntento((n) => n + 1); }}><Icono n="reiniciar" /> Reintentar</button> : null);
  }
  // espera: con su plan, antes de su lunes. (alta, 29 y 32) Su camino de un vistazo y un consejo de la guía cada día
  return marco(`Tu plan: ${bloque.nombre}`, 'calendario', e.faltan === 1 ? 'Mañana' : `Faltan ${e.faltan} días`, `Empiezas el ${fechaLarga(e.inicio)}`,
    bloque.nombre === NOMBRE_PRIMERAS_4
      ? 'Tu plan ya está listo: tus cuatro primeras semanas son las de la guía. Mientras llega el día, elige tus días y mira tus ejercicios.'
      : 'Tu plan ya está listo. Mientras llega el día, elige tus días y mira tus ejercicios.',
    <button class="btn btn-grande btn-hero" onClick={() => irA?.('semana')}><Icono n="semana" /> Ver tu semana 1</button>,
    <>
      {bloque.nombre === NOMBRE_PRIMERAS_4 && <CaminoEsencial />}
      <p class="peq alta-consejo"><strong>Para hoy:</strong> {consejoDe(e.faltan)}</p>
    </>);
}

// ---------- La semana siguiente, sola (tanda 3, migración 092) ----------
// En Hoy de quien va por su cuenta y ya tiene plan: una vez al día (en este móvil), si toca, la app prepara su semana
// siguiente con el motor. Si antes de su lunes hay una posible errata en lo apuntado, pregunta (y no prepara nada hasta
// que conteste o llegue el lunes).
// hechas: las sesiones hechas de su semana (al terminar la última, se vuelve a mirar sin esperar a mañana)
export function SemanaEsencial({ recargarPrograma, abrirSesion, hechas = 0 }) {
  const { api, atleta, aviso } = useApp();
  const [preguntas, setPreguntas] = useState(null);
  const [ocupado, una] = useUnaVez();
  const hoy = hoyISO();
  const clave = `fbe-esencial-semana:${atleta.id}:${hoy}:${hechas}`;
  const preparar = async (forzar = false) => {
    try {
      if (!forzar && sessionStorage.getItem(clave)) return;
      sessionStorage.setItem(clave, '1');
    } catch { /* sin almacenamiento: se intenta igual */ }
    try {
      const r = await api.prepararSemanaEsencial(atleta.id);
      if (r?.preguntas?.length) { setPreguntas(r.preguntas); return; }
      setPreguntas(null);
      if (r?.semana) {
        aviso(r.tipo === 'novato' ? 'Tu plan desde la semana 5 ya está listo, con los kilos de tus marcas'
          : r.tipo === 'cambio' ? (r.plantilla === NOVATOS[3] ? 'Tu plan de tres días ya está listo' : 'Tu plan de dos días ya está listo') : 'Tu semana siguiente ya está lista');
        recargarPrograma?.();
      }
    } catch { /* (si falla, lo intenta mañana: nada que enseñar) */ }
  };
  useEffect(() => { preparar(); }, [atleta.id, hoy, hechas]);
  if (!preguntas?.length) return null;
  const q = preguntas[0];
  return (
    <section class="nota-coach pregunta-errata" aria-label="Una duda con lo que apuntaste">
      <Icono n="pregunta" />
      <div class="pila-s">
        <strong>Antes de prepararte la semana, una duda</strong>
        <span class="peq">{q.texto}</span>
        <div class="fila-envolver">
          <button type="button" class="btn btn-primario btn-peq" disabled={ocupado}
            onClick={() => una(async () => { await api.esencialConfirmarSeries(q.pauta_id, q.series.map((s) => s.numero)).catch(() => {}); await preparar(true); })}>Sí, es correcto</button>
          {q.sesion_id && <button type="button" class="btn btn-peq" onClick={() => abrirSesion?.(q.sesion_id)}>Corregirlo</button>}
        </div>
      </div>
    </section>
  );
}

// ---------- (sin coach, tanda 2; migración 098) El cierre de la semana ----------
// En Hoy de quien va por su cuenta: la pregunta del domingo desde las 21:00 (pasar a la siguiente o repetir esta; a las
// 22:00 sin elegir, la base la pasa y avisa; con la base sin la 099, a las 23:30), lo elegido, la semana que viene ya lista (con adelantar su primera sesión,
// nunca dos el mismo día) y la pausa («Esta semana no puedo», con «Volver ya»).
export function CierreSemana({ p, recargarPrograma, abrirSesion }) {
  const { api, atleta, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const [hoja, setHoja] = useState(false);
  const [hora, setHora] = useState(() => horaMadrid());
  const hoy = hoyISO();
  // (con la app abierta el domingo por la tarde, a las 21:00 sale la pregunta sin recargar)
  useEffect(() => { const t = setInterval(() => setHora(horaMadrid()), 60000); return () => clearInterval(t); }, []);
  const datos = { semanas: p?.semanas || [], sesiones: p?.sesiones || {}, hoy };
  const e = estadoCierre({ ...datos, hora, horaAuto: 'esencial_plantilla' in atleta ? HORA_AUTO : HORA_AUTO_098 });
  const t = textoCierre(e, { fechaLarga });
  const pausable = (!e || e.tipo === 'repite') && puedePausar(datos);
  const cerrar = (decision, hecho) => una(async () => {
    try {
      const r = await api.esencialCerrarSemana(decision, atleta.id);
      if (r?.falta098) { aviso('Falta una actualización en la base: díselo a Pelayo.', 'error'); return; }
      setHoja(false);
      // (pasar: la semana nueva, ya; el motor se carga solo entonces)
      if (decision === 'pasar') await api.prepararSemanaEsencial(atleta.id).catch(() => null);
      aviso(hecho);
      recargarPrograma?.();
    } catch (err) { aviso(err.message, 'error'); }
  });
  const vuelve = sumarDias(lunesDe(hoy), 7);
  const hojaPausa = hoja && (
    <Hoja titulo="Esta semana no puedo" alCerrar={() => setHoja(false)}>
      <div class="pila">
        <p>Un viaje, una gripe, una semana imposible: pon la semana en pausa. Tu plan se corre una semana y lo que te queda lo haces desde el {fechaLarga(vuelve)}. Mientras, no te llegan los avisos de tus sesiones.</p>
        <p class="peq secundario">Lo que ya has hecho se queda hecho. Si cambias de idea esta misma semana, «Volver ya».</p>
        <button type="button" class="btn btn-primario btn-grande" disabled={ocupado} onClick={() => cerrar('pausa', `Semana en pausa: vuelves el ${fechaLarga(vuelve)}`)}>Poner la semana en pausa</button>
      </div>
    </Hoja>
  );
  if (!e || !t) {
    return pausable ? <p class="cierre-pausa"><button type="button" class="btn-texto mini" onClick={() => setHoja(true)}>Esta semana no puedo</button>{hojaPausa}</p> : null;
  }
  const nota = (e.tipo === 'lista' || e.tipo === 'pasada') && e.siguiente?.nota_coach ? e.siguiente.nota_coach : null;
  return (
    <section class="nota-coach cierre-semana" data-cierre={e.tipo} aria-label="Tu semana">
      <Arte id={ARTE_CIERRE[e.tipo]} />
      <Icono n={e.tipo === 'pregunta' ? 'pregunta' : e.tipo === 'pausa' ? 'reloj' : e.tipo === 'repite' ? 'reiniciar' : 'calendario'} />
      <div class="pila-s">
        <strong>{t.titulo}</strong>
        <span class="peq">{t.texto}</span>
        {nota && <span class="peq"><strong>Lo que cambia: </strong>{nota}</span>}
        {e.tipo === 'pregunta' && (
          <>
            <div class="fila-envolver">
              <button type="button" class="btn btn-primario btn-peq" disabled={ocupado} onClick={() => cerrar('pasar', 'Pasas a la siguiente: ya la tienes lista')}>Pasar a la siguiente</button>
              {e.puedeRepetir && <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => cerrar('repetir', 'Repites esta semana: lo que te falta, desde mañana')}>Repetir esta semana</button>}
            </div>
            <ul class="cierre-que peq">
              <li><strong>Pasar: </strong>{t.pasar}</li>
              {e.puedeRepetir && <li><strong>Repetir: </strong>{t.repetir}</li>}
            </ul>
            <span class="mini terciario">{t.plazo}</span>
            <Dudas de="cierre" />
          </>
        )}
        {e.tipo === 'lista' && e.puedeAdelantar && (
          <div class="fila-envolver"><button type="button" class="btn btn-peq" onClick={() => abrirSesion?.(e.primera.id)}><Icono n="play" /> Adelantar {e.primera.nombre}</button></div>
        )}
        {e.tipo === 'pausa' && (
          <div class="fila-envolver"><button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => cerrar('reanudar', 'De vuelta: tu semana sigue donde estaba')}>Volver ya</button></div>
        )}
        {pausable && <button type="button" class="btn-texto mini cierre-pausa" onClick={() => setHoja(true)}>Esta semana no puedo</button>}
      </div>
      {hojaPausa}
    </section>
  );
}

// ---------- Lo de esta semana (Pelayo, 25/11) ----------
// De la semana 1 a la 8 de quien empezó con «Primeras 4 semanas»: una lección corta de sus guías, con «Leer más» si la tiene
export function LeccionSemana({ p }) {
  const [abierta, setAbierta] = useState(false);
  const n = semanaDelPlan(p?.bloques, p?.actual?.fecha_inicio);
  const l = leccionDe(n);
  if (!l) return null;
  return (
    <section class="nota-coach leccion-esencial" aria-labelledby="leccion-t">
      <Arte id={arteLeccion(n)} />
      <Icono n="biblioteca" />
      <div class="pila-s">
        <span class="mini terciario">Lo de esta semana · semana {n}</span>
        <strong id="leccion-t">{l.titulo}</strong>
        <span class="peq">{l.texto}</span>
        {l.mas && (abierta
          ? <><strong class="peq">{l.mas.titulo}</strong><span class="peq">{l.mas.texto}</span></>
          : <button type="button" class="btn-texto" style="justify-self:start" onClick={() => setAbierta(true)}>Leer más: {l.mas.titulo.charAt(0).toLowerCase()}{l.mas.titulo.slice(1)}</button>)}
        {n >= 5 && <Dudas de="leccion" texto="¿Cómo decide la app?" />}
      </div>
    </section>
  );
}

// ---------- Tus días: pasar a 3 (o volver a 2) desde la semana siguiente (096) ----------
// Solo con una plantilla de novato (desde la semana 5). Lo pide aquí y la app le prepara la semana siguiente con la otra.
export function DiasEsencial({ p }) {
  const { api, atleta, aviso } = useApp();
  const tiene = Number(Object.keys(NOVATOS).find((k) => NOVATOS[k] === p?.bloque?.nombre)) || null;
  const [pedido, setPedido] = useState(atleta?.esencial_dias ?? null);
  const [hoja, setHoja] = useState(false);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  if (!tiene) return null;
  const pendiente = pedido && Number(pedido) !== tiene ? Number(pedido) : null;
  const otro = tiene === 2 ? 3 : 2;
  const lunes = sumarDias(lunesDe(hoyISO()), 7);
  const pedir = (dias) => una(async () => {
    setError(null);
    try {
      const r = await api.esencialCambiarDias(dias);
      if (r?.falta096) { setError('Para cambiar de días falta una actualización en la base: díselo a Pelayo.'); return; }
      setPedido(dias);
      setHoja(false);
      aviso(dias === tiene ? 'Sigues con tus días de ahora' : dias === 3 ? 'Desde la semana que viene, tres días' : 'Desde la semana que viene, dos días');
    } catch (e) { setError(e.message); }
  });
  return (
    <section class="nota-coach dias-esencial" aria-label="Tus días de entreno">
      <Icono n="calendario" />
      <div class="pila-s">
        <span class="peq">{pendiente
          ? `Entrenas ${tiene} días a la semana. Desde la semana que viene, ${pendiente === 3 ? 'tres' : 'dos'}.`
          : `Entrenas ${tiene} días a la semana.`}</span>
        <div class="fila-envolver">
          {pendiente
            ? <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => pedir(tiene)}>Seguir con {tiene === 3 ? 'tres' : 'dos'}</button>
            : <button type="button" class="btn btn-peq" onClick={() => setHoja(true)}>{otro === 3 ? 'Pasar a tres días' : 'Volver a dos días'}</button>}
        </div>
        {error && !hoja && <p class="error" role="alert">{error}</p>}
        <Dudas de="dias" texto="¿Me conviene?" />
      </div>
      {hoja && (
        <Hoja titulo={otro === 3 ? 'Pasar a tres días' : 'Volver a dos días'} alCerrar={() => setHoja(false)}>
          <div class="pila">
            {otro === 3 ? <>
              <p>Los días 1 y 3, la sesión de siempre, con los kilos que llevas; el día 2, sus alternativas (sentadilla a un banco, puente de glúteo, flexiones, remo en máquina y curl): busca el peso con el que te sobren 2. Que no vayan seguidos.</p>
              <p class="peq secundario">Antes de pedirlo, mira tu registro: si las series acaban con cuatro o cinco repeticiones de margen, no te faltan días, te falta apretar.</p>
            </> : <p>La sesión de siempre, dos días por semana que no vayan seguidos, con los kilos que llevas.</p>}
            <p class="peq secundario">Empieza con la próxima semana que te prepare la app: normalmente, la del lunes {fechaLarga(lunes).replace(/^lunes /, '')}.</p>
            {error && <p class="error" role="alert">{error}</p>}
            <button type="button" class="btn btn-primario btn-grande" disabled={ocupado} onClick={() => pedir(otro)}>{otro === 3 ? 'Pasar a tres días' : 'Volver a dos días'}</button>
          </div>
        </Hoja>
      )}
    </section>
  );
}

// ---------- (alta, tanda 3) La primera semana, en Hoy ----------
// (47) Una sesión que tenía día y ese día pasó sin hacerla: la frase de la guía (no se recupera doblando: se sigue donde
// tocaba) y pasarla a otro día de esta semana (de hoy al domingo, sin otro día con sesión)
export function SesionPerdida({ p, recargarPrograma }) {
  const { api, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const hoy = hoyISO();
  const w = p?.actual;
  const ss = w ? (p.sesiones?.[w.id] || []) : [];
  const perdida = ss.filter((s) => !s.completada && s.dia_previsto && String(s.dia_previsto).slice(0, 10) < hoy)
    .sort((a, b) => String(a.dia_previsto).localeCompare(String(b.dia_previsto)))[0];
  // (sin coach, 29) «Hoy no puedo»: la que toca hoy, a otro día de esta semana, de un toque
  const deHoy = !perdida && ss.find((s) => !s.completada && s.dia_previsto && String(s.dia_previsto).slice(0, 10) === hoy);
  if (deHoy && w?.fecha_inicio) return <HoyNoPuedo sesion={deHoy} semana={w} sesiones={ss} recargarPrograma={recargarPrograma} />;
  if (!perdida || !w?.fecha_inicio) return null;
  const ocupados = new Set(ss.filter((s) => s.id !== perdida.id && s.dia_previsto).map((s) => String(s.dia_previsto).slice(0, 10)));
  const libres = Array.from({ length: 7 }, (_, i) => sumarDias(w.fecha_inicio, i)).filter((d) => d >= hoy && !ocupados.has(d));
  const mover = (d) => una(async () => {
    try { await api.planificarSesion(perdida.id, d); aviso(`«${perdida.nombre}», el ${fechaLarga(d)}`); recargarPrograma?.(); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <section class="nota-coach alta-perdida" aria-label="Una sesión que no pudiste hacer">
      <Arte id="esencial-sesion-perdida" />
      <Icono n="calendario" />
      <div class="pila-s">
        <strong>El {fechaLarga(String(perdida.dia_previsto).slice(0, 10))} no pudiste hacer «{perdida.nombre}»</strong>
        <span class="peq">No la recuperes doblando: sigue donde tocaba. {libres.length ? '¿La pasas a otro día de esta semana?' : 'Esta semana ya no quedan días libres: la semana que viene, sigues.'}</span>
        <Dudas de="perdida" />
        {libres.length > 0 && (
          <div class="fila-envolver">
            {libres.map((d) => <button type="button" key={d} class="btn btn-peq" disabled={ocupado} onClick={() => mover(d)}>{d === hoy ? 'Hoy' : fechaLarga(d).split(' ')[0].replace(/^./, (c) => c.toUpperCase())}</button>)}
          </div>
        )}
      </div>
    </section>
  );
}

function HoyNoPuedo({ sesion, semana, sesiones, recargarPrograma }) {
  const { api, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const [abierto, setAbierto] = useState(false);
  const hoy = hoyISO();
  const ocupados = new Set(sesiones.filter((s) => s.id !== sesion.id && s.dia_previsto).map((s) => String(s.dia_previsto).slice(0, 10)));
  const libres = Array.from({ length: 7 }, (_, i) => sumarDias(semana.fecha_inicio, i)).filter((d) => d > hoy && !ocupados.has(d));
  if (!libres.length) return null;
  const mover = (d) => una(async () => {
    try { await api.planificarSesion(sesion.id, d); aviso(`«${sesion.nombre}», el ${fechaLarga(d)}`); recargarPrograma?.(); } catch (e) { aviso(e.message, 'error'); }
  });
  if (!abierto) return <p class="cierre-pausa"><button type="button" class="btn-texto mini" onClick={() => setAbierto(true)}>Hoy no puedo</button></p>;
  return (
    <section class="nota-coach alta-perdida" aria-label="Pasar la sesión de hoy a otro día">
      <Arte id="esencial-otro-dia" />
      <Icono n="calendario" />
      <div class="pila-s">
        <span class="peq"><strong>¿Hoy no puedes?</strong> Pasa «{sesion.nombre}» a otro día de esta semana (mejor sin otra sesión el día de antes ni el de después).</span>
        <div class="fila-envolver">
          {libres.map((d) => <button type="button" key={d} class="btn btn-peq" disabled={ocupado} onClick={() => mover(d)}>{fechaLarga(d).split(' ')[0].replace(/^./, (c) => c.toUpperCase())}</button>)}
        </div>
      </div>
    </section>
  );
}

// (48) Semana 1 hecha (todas sus sesiones, aún en esa semana): el resumen y lo de la semana que viene (la lección 2).
// (sin coach, 33) Y cada cuatro semanas, con la semana hecha: lo que lleva y dónde verlo
export function SemanaHecha({ p }) {
  const n = semanaDelPlan(p?.bloques, p?.actual?.fecha_inicio);
  const ss = p?.actual ? (p.sesiones?.[p.actual.id] || []) : [];
  if (!ss.length || ss.some((s) => !s.completada)) return null;
  if (n >= 4 && n % 4 === 0) {
    return (
      <section class="nota-coach alta-semana-hecha" aria-label="Cuatro semanas más">
        <Arte id={arteSemanaHecha(n)} />
        <Icono n="progreso" />
        <div class="pila-s">
          <strong>Semana {n} hecha: ya llevas {n} semanas</strong>
          <span class="peq">En Progreso tienes lo que has subido en cada ejercicio estas cuatro semanas y tu constancia.</span>
        </div>
      </section>
    );
  }
  if (n !== 1) return null;
  const l = leccionDe(2);
  return (
    <section class="nota-coach alta-semana-hecha" aria-labelledby="alta-sh-t">
      <Arte id={arteSemanaHecha(1)} />
      <Icono n="hecho" />
      <div class="pila-s">
        <strong id="alta-sh-t">Semana 1 hecha: {ss.length === 1 ? 'tu sesión' : `tus ${ss.length} sesiones`}</strong>
        {l && <span class="peq"><strong>La semana que viene, {l.titulo.charAt(0).toLowerCase()}{l.titulo.slice(1)}:</strong> {l.texto}</span>}
      </div>
    </section>
  );
}

// (51) En sus dos primeras semanas, la invitación a presentarse en Equipo (si está dentro de la comunidad). «Ahora no» la
// quita en este móvil.
export function PresentateEquipo({ p, irA }) {
  const { api, atleta } = useApp();
  const n = semanaDelPlan(p?.bloques, p?.actual?.fecha_inicio);
  const clave = `fbe-esencial-equipo:${atleta.id}`;
  const [fuera, setFuera] = useState(() => { try { return localStorage.getItem(clave) === '1'; } catch { return false; } });
  const dentro = useCarga(async () => {
    if (fuera || !(n >= 1 && n <= 2)) return false;
    const [c, m] = await Promise.all([api.comunidad(), api.miembroComunidad()]);
    return !!c?.activa && api.dentroDeComunidad(m);
  }, [n, fuera], { recuerdo: `esencial-equipo:${atleta.id}:${n}` });
  if (fuera || dentro.datos !== true) return null;
  const quitar = () => { try { localStorage.setItem(clave, '1'); } catch { /* */ } setFuera(true); };
  return (
    <section class="nota-coach alta-equipo" aria-label="Preséntate en Equipo">
      <Arte id="esencial-equipo" />
      <Icono n="equipo" />
      <div class="pila-s">
        <span class="peq"><strong>¿Te presentas en Equipo?</strong> Di quién eres y qué te ha traído: hay más gente empezando esta semana.</span>
        <span class="fila-envolver">
          <button type="button" class="btn btn-peq btn-primario" onClick={() => { quitar(); irA?.('equipo'); }}>Ir a Equipo</button>
          <button type="button" class="btn btn-peq" onClick={quitar}>Ahora no</button>
        </span>
      </div>
    </section>
  );
}

// (52 y 53) Las preguntas frecuentes de FBE Esencial (las de la web, para quien ya está dentro) y a quién escribir si algo
// falla en la app o en el cobro
export function FaqEsencial() {
  const { atleta } = useApp();
  const inicio = atleta?.esencial_inicio || null;
  const enlace = (ruta, texto) => <a href={`${WEB_FBE}/${ruta}`} target="_blank" rel="noopener">{texto}</a>;
  const faq = [
    ['¿Hablo con Pelayo?', <>No hay chat ni revisión de tu semana: eso lo llevan los {enlace('programas.html', 'programas con seguimiento')}. Sí hay un directo al mes para resolver dudas y la comunidad de la app.</>],
    ['¿Cuántos días a la semana?', 'Si empiezas de cero, dos: las cuatro semanas de la guía y, desde la quinta, una plantilla de dos días (desde Hoy puedes pasar a tres). Si ya entrenas, los que pusiste en el cuestionario.'],
    ['¿Qué material necesito?', 'Tu plantilla se elige con el material que pusiste en el cuestionario. Las cuatro semanas de la guía son de gimnasio, y cada ejercicio trae su alternativa.'],
    ['¿Y si tengo una enfermedad o tomo medicación?', <>Antes de empezar contestas unas preguntas de salud. Si sale que conviene consultar, no empiezas sin el visto bueno de tu médico o una {enlace('puesta-a-punto.html', 'Puesta a punto')} con Pelayo.</>],
    ['¿Y si me duele algo?', <>La app no valora el dolor. Si con el esfuerzo notas dolor u opresión en el pecho, falta de aire que no cuadra con lo que estás haciendo, mareos o palpitaciones, para y habla con tu médico. Para las molestias al entrenar tienes el {enlace('semaforo-dolor.html', 'semáforo del dolor')}.</>],
    ['¿Cuándo se me cobra?', `Al reservar dejaste tu tarjeta, sin cobrar nada. La primera cuota se cobra ${inicio ? `el ${fechaLarga(inicio)}` : 'el día en que empieza tu tanda'} y, desde ahí, cada mes o cada año, según lo que elegiste, con el mismo precio de fundador.`],
    ['¿Puedo darme de baja?', <>Sí, cuando quieras, desde <a href={PORTAL_ESENCIAL} target="_blank" rel="noopener">tu suscripción</a>, con el correo con el que reservaste. Sigues dentro hasta el final del periodo pagado.</>],
  ];
  return (
    <section class="seccion alta-faq" aria-labelledby="alta-faq-t">
      <h2 id="alta-faq-t">FBE Esencial: preguntas frecuentes</h2>
      <div class="panel panel-pad pila-s">
        <Arte id="esencial-preguntas" />
        {faq.map(([q, r]) => <details key={q} class="alta-faq-p"><summary>{q}</summary><p class="peq secundario">{r}</p></details>)}
        <TodasLasRespuestas />
        <p class="peq alta-contacto"><Icono n="mensaje" /> <span>¿Algún problema con la app o con el cobro? Escribe a <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a> y Pelayo te contesta por correo.</span></p>
      </div>
    </section>
  );
}

// ---------- (v0.245) Todo lo suyo de Hoy, en una pieza ----------
// Sus tarjetas de Hoy, en su orden. Van juntas aquí (y no una a una en Hoy.jsx) para que lo que se le añada a quien va por
// su cuenta no pese al abrir la app a los demás. recargar: vuelve a pedir su programa.
const TarjetaRevision = perezoso(() => import('./EsencialAyuda.jsx'), 'TarjetaRevision', { mientras: null });
const QueNecesitas = perezoso(() => import('./EsencialAyuda.jsx'), 'QueNecesitas', { mientras: null });
export function HoyEsencial({ p, cuestionario = null, recargar, abrirSesion, irA }) {
  const { atleta } = useApp();
  if (atleta.estado === 'baja') return <TarjetaMarcas />;
  const conPlan = !!p?.bloque;
  return (
    <>
      {/* sus marcas de la semana 4, en cuanto termina esa semana */}
      <TarjetaMarcas />
      {/* (alta, 28-31) antes de empezar: sus días y su semana 1, ejercicio a ejercicio (o la de la guía, esperando el visto bueno) */}
      <AntesDeEmpezar p={p} cuestionario={cuestionario} />
      {conPlan && <AplicarDias p={p} recargarPrograma={recargar} />}
      {/* (098) el cierre de la semana y (v0.245) su revisión: lo que cambia y por qué */}
      {conPlan && <CierreSemana p={p} recargarPrograma={recargar} abrirSesion={abrirSesion} />}
      {conPlan && <TarjetaRevision p={p} />}
      {/* (alta, 47, 48 y 51) una sesión que no pudo hacer, la semana hecha y presentarse en Equipo */}
      {conPlan && <SesionPerdida p={p} recargarPrograma={recargar} />}
      {conPlan && <SemanaHecha p={p} />}
      {conPlan && <PresentateEquipo p={p} irA={irA} />}
      {/* la semana siguiente, que prepara la app (con la pregunta si hay una posible errata) */}
      {conPlan && <SemanaEsencial recargarPrograma={recargar} abrirSesion={abrirSesion} hechas={(p.actual ? (p.sesiones[p.actual.id] || []) : []).filter((s) => s.completada).length} />}
      {/* (25/11) lo de esta semana (de la 1 a la 8) y, desde la semana 5, sus días (pasar a tres o volver a dos) */}
      {conPlan && <LeccionSemana p={p} />}
      {conPlan && <DiasEsencial p={p} />}
      {/* (v0.245) «¿Qué necesitas?»: lo que más se pregunta, a un toque, y lo que abre cada aviso */}
      <QueNecesitas p={p} cuestionario={cuestionario} recargarPrograma={recargar} />
    </>
  );
}
