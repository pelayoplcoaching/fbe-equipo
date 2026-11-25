// FBE Esencial: lo de quien va por su cuenta en Hoy: la bienvenida (en lugar del mensaje del coach, que promete respuesta),
// la tarjeta grande de antes de empezar (cuestionario, visto bueno y su lunes) y sus marcas de la semana 4.
// Con las piezas de siempre (la tarjeta de aviso de Hoy, la hoja y la lista): sin estilos nuevos.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja } from '../comunes.jsx';
import { esPorSuCuenta, NOMBRE_PRIMERAS_4 } from '../../logica/esencial.js';
import { MENSAJE_ESENCIAL, estadoEsencial, fechaLarga } from '../../logica/esencial-alta.js';
import { hoyISO, sumarDias, hace, lunesDe } from '../../logica/fechas.js';
import { semanaDelPlan, leccionDe } from '../../logica/esencial-lecciones.js';
import { NOVATOS } from '../../logica/esencial-semana.js';
import { Ilustracion } from '../Ilustraciones.jsx';

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
        <Icono n="trofeo" />
        <div class="pila-s">
          <strong>Ya tienes tus marcas de la semana {d.semana.numero}</strong>
          <span class="peq">El peso y las repeticiones de tu mejor serie en cada ejercicio: el punto de partida para todo lo que venga.</span>
          <button type="button" class="btn btn-primario btn-peq" style="justify-self:start" onClick={() => setAbierta(true)}>Ver tus marcas</button>
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
  const e = estadoEsencial({ bloque, cuestionario, ficha: ficha.datos, hoy });
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
      <Ilustracion n="espera" clase="hero-ilu" />
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
  if (e.tipo === 'visto_bueno') {
    return marco(null, 'alerta', 'Antes de empezar', 'El visto bueno de tu médico', MENSAJE_ESENCIAL[e.resultado] || MENSAJE_ESENCIAL.valorar_antes,
      <button class="btn btn-grande btn-hero" disabled={ocupado} onClick={() => una(async () => {
        setError(null);
        try { await api.esencialPedirVistoBueno(); ficha.recargar(true); } catch (err) { setError(err.message); }
      })}><Icono n="hecho" /> Ya tengo el visto bueno</button>,
      <p class="peq secundario">Cuando te lo dé (o si haces una Puesta a punto con Pelayo), márcalo aquí. Pelayo lo confirma y la app te prepara tu plan.</p>);
  }
  if (e.tipo === 'revision') {
    return marco(null, 'reloj', 'En revisión', 'Pelayo está revisando tu visto bueno',
      `Lo marcaste ${hace(String(e.desde).slice(0, 10), hoy)}. En cuanto lo confirme, aquí verás tu plan.`);
  }
  if (e.tipo === 'preparando') {
    return marco(null, 'reloj', 'Un momento', 'Preparando tu plan', 'Con tus respuestas, la app elige tu plan y lo deja listo desde tu lunes.',
      error ? <button class="btn btn-grande btn-hero" onClick={() => { pedido.current = false; setError(null); setIntento((n) => n + 1); }}><Icono n="reiniciar" /> Reintentar</button> : null);
  }
  // espera: con su plan, antes de su lunes
  return marco(`Tu plan: ${bloque.nombre}`, 'calendario', e.faltan === 1 ? 'Mañana' : `Faltan ${e.faltan} días`, `Empiezas el ${fechaLarga(e.inicio)}`,
    bloque.nombre === NOMBRE_PRIMERAS_4
      ? 'Tus cuatro primeras semanas son las de la guía. Mientras llega el día, mira tu semana 1 y piensa qué dos días te vienen mejor.'
      : 'Tu plan ya está listo. Mientras llega el día, mira tu semana 1 y piensa qué días te vienen mejor.',
    <button class="btn btn-grande btn-hero" onClick={() => irA?.('semana')}><Icono n="semana" /> Ver tu semana 1</button>);
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

// ---------- Lo de esta semana (Pelayo, 25/11) ----------
// De la semana 1 a la 8 de quien empezó con «Primeras 4 semanas»: una lección corta de sus guías, con «Leer más» si la tiene
export function LeccionSemana({ p }) {
  const [abierta, setAbierta] = useState(false);
  const n = semanaDelPlan(p?.bloques, p?.actual?.fecha_inicio);
  const l = leccionDe(n);
  if (!l) return null;
  return (
    <section class="nota-coach leccion-esencial" aria-labelledby="leccion-t">
      <Icono n="biblioteca" />
      <div class="pila-s">
        <span class="mini terciario">Lo de esta semana · semana {n}</span>
        <strong id="leccion-t">{l.titulo}</strong>
        <span class="peq">{l.texto}</span>
        {l.mas && (abierta
          ? <><strong class="peq">{l.mas.titulo}</strong><span class="peq">{l.mas.texto}</span></>
          : <button type="button" class="btn-texto" style="justify-self:start" onClick={() => setAbierta(true)}>Leer más: {l.mas.titulo.charAt(0).toLowerCase()}{l.mas.titulo.slice(1)}</button>)}
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
