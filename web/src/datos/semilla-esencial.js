// La demo de FBE Esencial (?demo=esencial): tres atletas ficticios que van por su cuenta y la plantilla «Primeras 4
// semanas» de la guía del vídeo del 3/1/2027, como la crea la migración 091. Sirve para grabar 10-15 segundos de la app
// (el cuestionario de salud, la semana 1 con los cinco ejercicios, apuntar kilos y la pantalla de marcas) y para las
// capturas de la web. Sin datos reales: nombres, cifras y respuestas inventados. Va aparte de la demo de siempre (otra
// clave en el almacenamiento), para no cambiar nada de lo que miran las pruebas.
//   · Marina Ortega: acaba de entrar y aún no ha rellenado el cuestionario. Al enviarlo, la app le prepara «Primeras 4
//     semanas» desde este lunes (en la demo, su tanda es esta semana): la semana 1, para apuntar sus kilos.
//   · Tomás Rey: ha terminado las cuatro semanas; sus marcas de la semana 4 están para verlas.
//   · Clara Prieto: su cribado pide valoración médica y ha marcado que ya tiene el visto bueno. Pelayo lo confirma en su
//     ficha (Datos) y la app le prepara su plan, desde el lunes que viene.
//   · Inés Gil (093): el nivel con nutrición. Empieza esta semana con «Primeras 4 semanas» y aún no tiene plan de comida:
//     en Hoy, «Tu plan de comida» le hace las preguntas y la app se lo calcula.
//   · Lucía Vidal y Andrés Mora (v0.248): la espera. Lucía empieza de cero dentro de dos lunes; Andrés ya entrena, eligió
//     su rutina y empieza el lunes que viene. En Hoy, la cuenta atrás, lo que les falta y una cosa pequeña cada día.
import { MODALIDAD_POR_SU_CUENTA } from '../logica/esencial.js';
import { filasPrimeras4, PRIMERAS_4, NOVATO_2, NOVATO_3, filasNovato3 } from '../logica/esencial-plantilla.js';
import { sumarDias, lunesDe } from '../logica/fechas.js';
import { datosComidaValidos, planComidaEsencial } from '../logica/esencial-nutricion.js';
import { planMotor, datosMotorValidos, adherencia, scoffPositivo } from '../logica/nutricion-motor.js';

// Los ejercicios de la guía con su nombre de la guía (la demo los añade si no están): grupos, tipo y si van por tiempo
const EJERCICIOS_GUIA = [
  ['Prensa de piernas', ['cuadriceps', 'gluteo'], ['multiarticular']],
  ['Sentadilla a un banco', ['cuadriceps', 'gluteo'], ['multiarticular']],
  ['Peso muerto rumano con mancuernas', ['isquiotibiales', 'gluteo'], ['multiarticular']],
  ['Puente de glúteo', ['gluteo', 'isquiotibiales'], ['multiarticular']],
  ['Press de pecho en máquina', ['pectoral', 'triceps', 'deltoides'], ['multiarticular']],
  ['Flexiones', ['pectoral', 'triceps', 'deltoides'], ['multiarticular']],
  ['Jalón al pecho', ['espalda', 'biceps'], ['multiarticular']],
  ['Remo en máquina', ['espalda', 'biceps'], ['multiarticular']],
  ['Plancha abdominal', ['abdominales'], ['aislamiento'], true],
  ['Curl de bíceps con mancuernas', ['biceps'], ['aislamiento']],
];

// Lo que hizo Tomás cada semana (kilos de la mejor serie; la plancha, segundos): sube como dice la guía
const TOMAS = {
  'Prensa de piernas': [60, 70, 80, 85],
  'Peso muerto rumano con mancuernas': [10, 12, 14, 16],
  'Press de pecho en máquina': [25, 30, 32.5, 35],
  'Jalón al pecho': [30, 35, 37.5, 40],
  'Plancha abdominal': [25, 30, 36, 42],
};

// La copia de una plantilla a nombre de un atleta, como fbe_privado.esencial_copiar_plantilla() de la 091: un bloque
// suyo desde su lunes (activo si no tiene otro activo), con las semanas publicadas y la semana de marcas. t(nombre) da la
// tabla: la usan la semilla y la función esencial_asignar_plan de la demo (backend-memoria.js).
export function copiarPlantillaEsencial(t, { plantilla, atletaId, inicio, uuid, ahoraISO }) {
  const semanas = t('semanas').filter((w) => w.bloque_id === plantilla.id).sort((a, b) => a.numero - b.numero);
  const previos = t('bloques').filter((x) => x.atleta_id === atletaId && !x.es_plantilla);
  const b = {
    id: uuid(), atleta_id: atletaId, es_plantilla: false, numero: Math.max(0, ...previos.map((x) => x.numero || 0)) + 1, nombre: plantilla.nombre,
    foco: plantilla.foco ?? null, objetivo: plantilla.objetivo ?? null, descripcion: plantilla.descripcion ?? null,
    fecha_inicio: inicio, fecha_fin: sumarDias(inicio, 7 * Math.max(1, semanas.length) - 1),
    estado: previos.some((x) => ['activo', 'ajustado'].includes(x.estado)) ? 'planificado' : 'activo', creado_en: ahoraISO, objetivo_logrado: null,
  };
  t('bloques').push(b);
  for (const w of semanas) {
    const nw = { id: uuid(), bloque_id: b.id, numero: w.numero, foco: w.foco ?? null, fecha_inicio: sumarDias(inicio, 7 * (w.numero - 1)), nota_coach: w.nota_coach ?? null,
      programacion: 'programada', marcas: !!w.marcas };
    t('semanas').push(nw);
    for (const s of t('sesiones').filter((x) => x.semana_id === w.id).sort((a, c) => a.orden - c.orden)) {
      const ns = { id: uuid(), semana_id: nw.id, orden: s.orden, nombre: s.nombre, tipo: s.tipo, intencion: s.intencion ?? null, dinamica: s.dinamica ?? null,
        fecha_realizada: null, completada: false, nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null };
      t('sesiones').push(ns);
      for (const p of t('sesion_ejercicios').filter((x) => x.sesion_id === s.id)) t('sesion_ejercicios').push({ ...p, id: uuid(), sesion_id: ns.id });
    }
  }
  return b;
}

// La semana siguiente, como esencial_semana_siguiente() de la 092 (la demo y sus pruebas): el molde (la semana hecha o,
// tras «Primeras 4 semanas», la plantilla de novato en un bloque nuevo) con lo del motor que cuadre y quepa en los topes.
// Devuelve el id de la semana (la que ya hubiera para ese lunes, si la hay). Lanza los mismos errores que la base.
const CAMPOS_MOTOR = ['series', 'reps_min', 'reps_max', 'rir_objetivo', 'rpe_objetivo', 'backoff_pct', 'series_detalle'];
export function semanaSiguienteEsencial(t, { p = {}, atletaId, hoy, uuid, ahoraISO }) {
  const a = t('atletas').find((x) => x.id === atletaId);
  if (!a) throw new Error('Ese atleta no existe');
  if (a.modalidad !== 'por_su_cuenta') throw new Error('Solo para quien va por su cuenta (FBE Esencial)');
  if (a.estado !== 'activo') throw new Error('Su cuenta no está activa');
  const base = t('semanas').find((w) => w.id === p.base && w.programacion === 'programada');
  const bloque = base && t('bloques').find((b) => b.id === base.bloque_id && b.atleta_id === atletaId && !b.es_plantilla);
  if (!bloque) throw new Error('Esa semana no es tuya');
  const inicio = p.inicio;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio || '') || lunesDe(inicio) !== inicio || inicio <= base.fecha_inicio || inicio > sumarDias(lunesDe(hoy), 7)) throw new Error('Ese lunes no vale para la semana siguiente');
  const suyos = new Set(t('bloques').filter((b) => b.atleta_id === atletaId && !b.es_plantilla).map((b) => b.id));
  const ya = t('semanas').find((w) => suyos.has(w.bloque_id) && w.fecha_inicio === inicio && w.programacion === 'programada');
  if (ya) return ya.id;
  let molde, bloqueId, numero;
  // (096) cambiar de días: desde una plantilla de novato a la otra (la de los días que ha pedido), con sus kilos de ahora
  const NOVATOS = { 2: NOVATO_2.nombre, 3: NOVATO_3.nombre };
  const cambio = !!p.cambio && !p.novato;
  if (p.novato || cambio) {
    let destino;
    if (p.novato) {
      if (bloque.nombre !== PRIMERAS_4.nombre || !base.marcas) throw new Error('El bloque de novato va después de la semana de marcas');
      destino = NOVATOS[a.esencial_dias] || NOVATO_2.nombre;
    } else if (a.esencial_plantilla && a.esencial_plantilla !== bloque.nombre && t('bloques').some((b) => b.es_plantilla && b.esencial_catalogo && b.nombre === a.esencial_plantilla)) {
      // (099) la rutina que ha elegido de su catálogo: desde cualquier plan, pero no a mitad de «Primeras 4 semanas»
      if (bloque.nombre === PRIMERAS_4.nombre && !base.marcas) throw new Error('Hasta acabar tus cuatro primeras semanas no se cambia de rutina');
      destino = a.esencial_plantilla;
    } else {
      if (!Object.values(NOVATOS).includes(bloque.nombre)) throw new Error('Solo se cambia de días desde una plantilla de novato');
      destino = NOVATOS[a.esencial_dias];
      if (!destino || destino === bloque.nombre) throw new Error('Ya entrenas esos días');
    }
    if (p.plantilla && p.plantilla !== destino) throw new Error('Esa plantilla no es la de tus días');
    const pl = t('bloques').filter((b) => b.es_plantilla && b.nombre === destino).sort((x, y) => String(x.creado_en).localeCompare(String(y.creado_en)))[0];
    molde = pl && t('semanas').filter((w) => w.bloque_id === pl.id).sort((x, y) => x.numero - y.numero)[0];
    if (!molde) throw new Error(`No está la plantilla «${destino}»`);
    if (['activo', 'ajustado'].includes(bloque.estado)) bloque.estado = 'finalizado';
    const nb = { id: uuid(), atleta_id: atletaId, es_plantilla: false, numero: Math.max(0, ...t('bloques').filter((b) => b.atleta_id === atletaId).map((b) => b.numero || 0)) + 1,
      nombre: pl.nombre, foco: pl.foco ?? null, objetivo: pl.objetivo ?? null, descripcion: pl.descripcion ?? null, fecha_inicio: inicio, fecha_fin: sumarDias(inicio, 6), estado: 'activo', creado_en: ahoraISO, objetivo_logrado: null };
    t('bloques').push(nb);
    bloqueId = nb.id; numero = 1;
  } else {
    molde = base; bloqueId = bloque.id;
    numero = Math.max(0, ...t('semanas').filter((w) => w.bloque_id === bloqueId).map((w) => w.numero || 0)) + 1;
    bloque.fecha_fin = !bloque.fecha_fin || bloque.fecha_fin < sumarDias(inicio, 6) ? sumarDias(inicio, 6) : bloque.fecha_fin;
  }
  const nota = String(p.nota || '').trim().slice(0, 600) || (p.novato || cambio ? molde.nota_coach ?? null : null);
  const foco = p.descarga ? 'descarga' : (molde.foco && molde.foco !== 'descarga' ? molde.foco : t('bloques').find((b) => b.id === bloqueId)?.foco ?? null);
  const semana = { id: uuid(), bloque_id: bloqueId, numero, foco, fecha_inicio: inicio, nota_coach: nota, programacion: 'programada', marcas: false };
  t('semanas').push(semana);
  // Lo más que puede proponer en kilos: lo más que ha movido en ese ejercicio en sus dos últimas semanas, +10 % y un salto
  // (en la plancha, que va por tiempo y hasta 60 s, 5 kg más como mucho)
  const semanasRecientes = new Set(t('semanas').filter((w) => suyos.has(w.bloque_id) && w.fecha_inicio >= sumarDias(base.fecha_inicio, -7)).map((w) => w.id));
  const pautaDe = Object.fromEntries(t('sesion_ejercicios').map((x) => [x.id, x]));
  const sesionDe = Object.fromEntries(t('sesiones').map((x) => [x.id, x]));
  const tope = (ejercicioId) => {
    // (como max(kg) en la base: cuenta también una serie con 0 kg; las que no llevan kilos, no)
    const kgs = t('series').filter((sr) => { const x = pautaDe[sr.sesion_ejercicio_id]; return x && semanasRecientes.has(sesionDe[x.sesion_id]?.semana_id) && (sr.sustituto_id || x.ejercicio_id) === ejercicioId && sr.kg != null && sr.kg !== '' && Number.isFinite(Number(sr.kg)); }).map((sr) => Number(sr.kg));
    return kgs.length ? Math.max(...kgs) : null;
  };
  const porTiempo = (id) => !!t('ejercicios').find((e) => e.id === id)?.por_tiempo;
  // (096) al cambiar de días: los kilos que llevaba en cada ejercicio en la semana hecha (y, en la plancha, sus segundos)
  const sesBase = new Set(t('sesiones').filter((x) => x.semana_id === base.id).map((x) => x.id));
  const deAntes = (ejercicioId) => t('sesion_ejercicios').filter((x) => sesBase.has(x.sesion_id) && x.ejercicio_id === ejercicioId)
    .sort((x, y) => (Number(y.carga_sugerida_kg) || 0) - (Number(x.carga_sugerida_kg) || 0))[0] || null;
  for (const s of t('sesiones').filter((x) => x.semana_id === molde.id).sort((x, y) => x.orden - y.orden)) {
    const ns = { id: uuid(), semana_id: semana.id, orden: s.orden, nombre: s.nombre, tipo: s.tipo, intencion: s.intencion ?? null, dinamica: s.dinamica ?? null,
      fecha_realizada: null, completada: false, nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null };
    t('sesiones').push(ns);
    const js = (p.sesiones || []).find((x) => Number(x.orden) === s.orden);
    for (const q of t('sesion_ejercicios').filter((x) => x.sesion_id === s.id).sort((x, y) => x.orden - y.orden)) {
      // (094) su alternativa para siempre (solo entre ejercicios que se miden igual), sin los kilos del otro ejercicio
      const alt = (a.esencial_alternativas || {})[q.ejercicio_id];
      const ej = alt && t('ejercicios').some((e) => e.id === alt) && porTiempo(alt) === porTiempo(q.ejercicio_id) ? alt : q.ejercicio_id;
      const nueva = { ...q, id: uuid(), sesion_id: ns.id, ejercicio_id: ej };
      if (ej !== q.ejercicio_id) Object.assign(nueva, { carga_sugerida_kg: null, series_detalle: null });
      if (cambio) {
        const antes = deAntes(ej);
        nueva.carga_sugerida_kg = antes?.carga_sugerida_kg ?? null;
        if (antes && porTiempo(ej)) Object.assign(nueva, { reps_min: antes.reps_min, reps_max: antes.reps_max });
        if (porTiempo(ej) && Number(nueva.carga_sugerida_kg) > 20) nueva.carga_sugerida_kg = 20;
        // (099) las plantillas de la biblioteca no llevan esfuerzo: de partida, «te sobran 2-3»
        if (nueva.rir_objetivo == null && nueva.rpe_objetivo == null && !porTiempo(ej)) nueva.rir_objetivo = 2.5;
      }
      const jp = !cambio && js && (js.pautas || []).find((x) => Number(x.orden) === q.orden && x.ejercicio_id === ej);
      if (jp) {
        const v = { ...nueva };
        if (!p.novato) for (const c of CAMPOS_MOTOR) v[c] = jp[c] ?? null;
        if (v.series == null) v.series = q.series;
        v.carga_sugerida_kg = jp.carga_sugerida_kg ?? null;
        const tiempo = porTiempo(ej), max = 60, tp = tope(ej);
        const det = Array.isArray(v.series_detalle) && v.series_detalle.length ? v.series_detalle : null;
        const mal = !(v.series >= 1 && v.series <= 6) || (v.reps_min != null && !(v.reps_min >= 1 && v.reps_min <= max)) || (v.reps_max != null && !(v.reps_max >= 1 && v.reps_max <= max))
          || (v.reps_min != null && v.reps_max != null && v.reps_min > v.reps_max) || (v.rir_objetivo != null && !(v.rir_objetivo >= 0 && v.rir_objetivo <= 5))
          || (v.rpe_objetivo != null && !(v.rpe_objetivo >= 5 && v.rpe_objetivo <= 10)) || (v.backoff_pct != null && !(v.backoff_pct >= 0 && v.backoff_pct <= 50))
          || (v.carga_sugerida_kg != null && (v.carga_sugerida_kg < 0 || (tiempo && (v.carga_sugerida_kg > (tp ?? 0) + 5 || v.carga_sugerida_kg > 20)) || (!tiempo && (tp == null || v.carga_sugerida_kg > tp * 1.1 + 2.5))))
          || (det && (det.length !== v.series || v.backoff_pct != null || det.some((x) => x?.kg != null && (tp == null || x.kg > tp * 1.1 + 2.5))));
        if (!mal) Object.assign(nueva, v, { series_detalle: det });
      }
      t('sesion_ejercicios').push(nueva);
    }
  }
  return semana.id;
}

// (096) Tres días (o volver a dos) desde la semana siguiente, como esencial_cambiar_dias() de la base: solo con una
// plantilla de novato. Devuelve los días.
// (099) Elegir rutina y el catálogo, como esencial_elegir_rutina() y esencial_catalogo() de la base
export function elegirRutinaEsencialDemo(t, { nombre, atletaId }) {
  const a = t('atletas').find((x) => x.id === atletaId);
  if (!a) throw new Error('Ese atleta no existe');
  if (a.modalidad !== 'por_su_cuenta') throw new Error('Solo para quien va por su cuenta (FBE Esencial)');
  if (a.estado !== 'activo') throw new Error('Su cuenta no está activa');
  if (nombre == null || String(nombre).trim() === '') { a.esencial_plantilla = null; a.esencial_plantilla_en = null; return { rutina: null }; }
  if (nombre === PRIMERAS_4.nombre || !t('bloques').some((b) => b.es_plantilla && b.esencial_catalogo && b.nombre === nombre)) throw new Error('Esa rutina no está en el catálogo');
  a.esencial_plantilla = nombre; a.esencial_plantilla_en = new Date().toISOString();
  if (nombre === NOVATO_3.nombre) a.esencial_dias = 3; else if (nombre === NOVATO_2.nombre) a.esencial_dias = 2;
  return { rutina: nombre };
}
// Como en la base: lo que la app ya le había preparado y aún no ha empezado se quita para rehacerlo con la rutina elegida
// (de su plan en marcha, las semanas que empiezan después de hoy sin nada hecho ni apuntado y sin pausa ni repetición; no
// «Primeras 4 semanas»). Devuelve 'plan' (era su primer plan, entero por empezar: hay que asignarlo otra vez), 'preparar'
// (la app tiene que preparar la semana otra vez) o null (nada que rehacer).
export function rehacerSinEmpezarDemo(t, { atletaId, nombre, hoy }) {
  const suyos = t('bloques').filter((b) => b.atleta_id === atletaId && !b.es_plantilla);
  const b = suyos.filter((x) => ['activo', 'ajustado', 'planificado'].includes(x.estado)).sort((x, y) => (y.numero || 0) - (x.numero || 0))[0];
  if (!b || b.nombre === PRIMERAS_4.nombre || b.nombre === nombre) return null;
  const semanas = t('semanas').filter((w) => w.bloque_id === b.id);
  const sesionesDe = (w) => t('sesiones').filter((s) => s.semana_id === w.id);
  const limpia = (w) => {
    const ss = sesionesDe(w), ids = new Set(ss.map((s) => s.id));
    const pautas = new Set(t('sesion_ejercicios').filter((x) => ids.has(x.sesion_id)).map((x) => x.id));
    return String(w.fecha_inicio || '') > hoy && !w.esencial_cierre && !ss.some((s) => s.completada || s.fecha_realizada) && !t('series').some((r) => pautas.has(r.sesion_ejercicio_id));
  };
  const futuras = semanas.filter(limpia);
  if (!futuras.length) return null;
  const quitar = (tabla, f) => { const filas = t(tabla); for (let i = filas.length - 1; i >= 0; i--) if (f(filas[i])) filas.splice(i, 1); };
  const quitarSemanas = (ws) => {
    const idW = new Set(ws.map((w) => w.id)), idS = new Set(t('sesiones').filter((s) => idW.has(s.semana_id)).map((s) => s.id));
    quitar('sesion_ejercicios', (x) => idS.has(x.sesion_id));
    quitar('sesiones', (s) => idW.has(s.semana_id));
    quitar('semanas', (w) => idW.has(w.id));
  };
  if (futuras.length === semanas.length) {
    const previo = suyos.filter((x) => x.id !== b.id && x.estado === 'finalizado' && t('semanas').some((w) => w.bloque_id === x.id && String(w.fecha_inicio || '').slice(0, 10) === sumarDias(String(b.fecha_inicio).slice(0, 10), -7)))
      .sort((x, y) => (y.numero || 0) - (x.numero || 0))[0] || null;
    if (!previo && suyos.length !== 1) return null;
    quitarSemanas(semanas);
    quitar('bloques', (x) => x.id === b.id);
    if (!previo) return 'plan';
    previo.estado = 'activo';
    return 'preparar';
  }
  quitarSemanas(futuras);
  const ultima = t('semanas').filter((w) => w.bloque_id === b.id).map((w) => String(w.fecha_inicio).slice(0, 10)).sort().pop();
  if (ultima) b.fecha_fin = sumarDias(ultima, 6);
  return 'preparar';
}
export function catalogoEsencialDemo(t) {
  const vistos = new Set();
  return t('bloques').filter((b) => b.es_plantilla && b.esencial_catalogo).sort((x, y) => String(x.creado_en || '').localeCompare(String(y.creado_en || '')))
    .filter((b) => !vistos.has(b.nombre) && vistos.add(b.nombre)).map((b) => {
      const w = t('semanas').filter((x) => x.bloque_id === b.id).sort((x, y) => x.numero - y.numero)[0];
      const sesiones = w ? t('sesiones').filter((s) => s.semana_id === w.id).sort((x, y) => x.orden - y.orden) : [];
      return { nombre: b.nombre, dias: sesiones.length, sesiones: sesiones.map((s) => ({ orden: s.orden, nombre: s.nombre,
        ejercicios: t('sesion_ejercicios').filter((x) => x.sesion_id === s.id).sort((x, y) => x.orden - y.orden).map((x) => {
          const e = t('ejercicios').find((y) => y.id === x.ejercicio_id) || {};
          return { nombre: e.nombre || '', series: x.series, reps_min: x.reps_min, reps_max: x.reps_max, por_tiempo: !!e.por_tiempo, descanso_seg: x.descanso_seg ?? null, superserie: x.superserie ?? null };
        }) })) };
    }).sort((x, y) => x.nombre.localeCompare(y.nombre));
}

// (098) Cerrar la semana, como esencial_cerrar_semana() de la base (la demo y sus pruebas). Lanza los mismos errores.
function correrEsencial(t, w, dias) {
  const antes = w.fecha_inicio;
  const corridas = t('semanas').filter((x) => x.bloque_id === w.bloque_id && x.fecha_inicio && x.fecha_inicio >= antes);
  for (const x of corridas) x.fecha_inicio = sumarDias(x.fecha_inicio, dias);
  const ids = new Set(corridas.map((x) => x.id));
  for (const s of t('sesiones')) {
    if (!ids.has(s.semana_id) || !s.dia_previsto) continue;
    // (como en la base: lo pendiente se mueve con su semana; a lo ya hecho se le quita el día)
    s.dia_previsto = s.completada ? null : sumarDias(String(s.dia_previsto).slice(0, 10), dias);
  }
  const b = t('bloques').find((x) => x.id === w.bloque_id);
  if (b?.fecha_fin) b.fecha_fin = sumarDias(b.fecha_fin, dias);
  if (b?.fecha_inicio === antes) b.fecha_inicio = sumarDias(antes, dias);   // (la primera semana del plan: el plan empieza con ella)
}
export function cerrarSemanaEsencialDemo(t, { decision, atletaId, hoy, coach = false }) {
  const a = t('atletas').find((x) => x.id === atletaId);
  if (!a) throw new Error('Ese atleta no existe');
  if (a.modalidad !== 'por_su_cuenta') throw new Error('Solo para quien va por su cuenta (FBE Esencial)');
  if (a.estado !== 'activo') throw new Error('Su cuenta no está activa');
  if (!['pasar', 'repetir', 'pausa', 'reanudar'].includes(decision)) throw new Error('Elige pasar, repetir, pausa o reanudar');
  const lunes = lunesDe(hoy);
  const suyos = t('bloques').filter((b) => b.atleta_id === atletaId && !b.es_plantilla);
  const faltanDe = (w) => t('sesiones').filter((s) => s.semana_id === w.id && !s.completada).length;
  if (decision === 'reanudar') {
    const w = t('semanas').filter((x) => suyos.some((b) => b.id === x.bloque_id) && x.programacion === 'programada' && x.esencial_cierre === 'pausa'
      && x.esencial_cierre_lunes === lunes && x.fecha_inicio === sumarDias(lunes, 7)).sort((x, y) => x.numero - y.numero)[0];
    if (!w) throw new Error('No tienes la semana en pausa');
    correrEsencial(t, w, -7);
    w.esencial_cierre = null; w.esencial_cierre_lunes = null;
    return { decision, semana: w.id, inicio: lunes, faltan: faltanDe(w) };
  }
  const enMarcha = suyos.filter((b) => ['activo', 'ajustado'].includes(b.estado)).sort((x, y) => String(y.fecha_inicio || '').localeCompare(String(x.fecha_inicio || '')));
  const w = enMarcha.map((b) => t('semanas').filter((x) => x.bloque_id === b.id && x.programacion === 'programada' && x.fecha_inicio === lunes).sort((x, y) => y.numero - x.numero)[0]).find(Boolean);
  if (!w) throw new Error('No tienes una semana en curso');
  const faltan = faltanDe(w);
  if (!faltan) throw new Error('Tu semana ya está completa');
  if (['pasar', 'repetir'].includes(decision) && !coach && hoy !== sumarDias(lunes, 6)) throw new Error('Eso se elige el domingo');
  if (decision === 'pasar') { w.esencial_cierre = 'pasar'; w.esencial_cierre_lunes = lunes; return { decision, semana: w.id, inicio: lunes, faltan }; }
  const bloque = suyos.find((b) => b.id === w.bloque_id);
  if (bloque.nombre !== PRIMERAS_4.nombre && t('semanas').some((x) => x.bloque_id === w.bloque_id && x.numero > w.numero)) throw new Error('Tu semana siguiente ya está preparada');
  if (t('semanas').some((x) => x.bloque_id !== w.bloque_id && suyos.some((b) => b.id === x.bloque_id) && x.programacion === 'programada' && x.fecha_inicio > lunes)) throw new Error('Tu semana siguiente ya está preparada');
  if (decision === 'repetir' && (Number(w.esencial_repetida) || 0) >= 2) throw new Error('Ya has repetido esta semana dos veces: toca pasar a la siguiente');
  correrEsencial(t, w, 7);
  w.esencial_cierre = decision; w.esencial_cierre_lunes = lunes;
  w.esencial_repetida = (Number(w.esencial_repetida) || 0) + (decision === 'repetir' ? 1 : 0);
  return { decision, semana: w.id, inicio: sumarDias(lunes, 7), faltan };
}

export function cambiarDiasEsencialDemo(t, { dias, atletaId }) {
  const a = t('atletas').find((x) => x.id === atletaId);
  if (!a) throw new Error('Ese atleta no existe');
  if (a.modalidad !== 'por_su_cuenta') throw new Error('Solo para quien va por su cuenta (FBE Esencial)');
  if (a.estado !== 'activo') throw new Error('Su cuenta no está activa');
  if (![2, 3].includes(Number(dias))) throw new Error('Son 2 o 3 días');
  const actual = t('bloques').filter((b) => b.atleta_id === atletaId && !b.es_plantilla && ['activo', 'ajustado'].includes(b.estado))
    .sort((x, y) => String(y.fecha_inicio).localeCompare(String(x.fecha_inicio)))[0];
  if (![NOVATO_2.nombre, NOVATO_3.nombre].includes(actual?.nombre)) throw new Error('Puedes cambiar de días desde la semana 5');
  a.esencial_dias = Number(dias);
  return Number(dias);
}

// (094) La alternativa para siempre, como esencial_alternativa() de la base: solo entre las alternativas del ejercicio de la
// guía; cambia las sesiones sin hacer (sin series de ese ejercicio), menos la que tiene abierta. Devuelve cuántas cambió.
export function alternativaEsencialDemo(t, { ejercicio, alternativa = null, excepto = null, atletaId }) {
  const a = t('atletas').find((x) => x.id === atletaId);
  if (!a) throw new Error('Ese atleta no existe');
  if (a.modalidad !== 'por_su_cuenta') throw new Error('Solo para quien va por su cuenta (FBE Esencial)');
  if (a.estado !== 'activo') throw new Error('Su cuenta no está activa');
  const mapa = { ...(a.esencial_alternativas || {}) };
  const guia = Object.keys(mapa).find((k) => mapa[k] === ejercicio) || ejercicio;
  const desde = mapa[guia] || guia;
  let hasta;
  if (!alternativa || alternativa === guia) { hasta = guia; delete mapa[guia]; } else {
    const g = t('ejercicios').find((e) => e.id === guia);
    if (!(g?.alternativas || []).includes(alternativa)) throw new Error('Esa no es una alternativa de ese ejercicio');
    if (!!g.por_tiempo !== !!t('ejercicios').find((e) => e.id === alternativa)?.por_tiempo) throw new Error('Para siempre, solo entre ejercicios que se miden igual (la plancha se cambia en cada sesión)');
    hasta = alternativa; mapa[guia] = alternativa;
  }
  a.esencial_alternativas = mapa;
  if (desde === hasta) return 0;
  const suyos = new Set(t('bloques').filter((b) => b.atleta_id === atletaId && !b.es_plantilla && ['activo', 'ajustado', 'planificado'].includes(b.estado)).map((b) => b.id));
  const semanas = new Set(t('semanas').filter((w) => suyos.has(w.bloque_id)).map((w) => w.id));
  const sesiones = new Set(t('sesiones').filter((x) => semanas.has(x.semana_id) && !x.completada && x.id !== excepto).map((x) => x.id));
  const conSeries = new Set(t('series').map((x) => x.sesion_ejercicio_id));
  let n = 0;
  for (const q of t('sesion_ejercicios').filter((x) => sesiones.has(x.sesion_id) && x.ejercicio_id === desde && !conSeries.has(x.id))) {
    Object.assign(q, { ejercicio_id: hasta, carga_sugerida_kg: null, series_detalle: null });
    n++;
  }
  return n;
}

// (093) La comida de quien va por su cuenta, como esencial_plan_comida() y esencial_ajuste_comida() de la base (la demo y
// sus pruebas): mismas comprobaciones, mismo cálculo (planComidaEsencial, que es planInicial, como la base) y mismos topes.
function quienComida(t, atletaId) {
  const a = t('atletas').find((x) => x.id === atletaId);
  if (!a) throw new Error('Ese atleta no existe');
  if (a.modalidad !== 'por_su_cuenta') throw new Error('Solo para quien va por su cuenta (FBE Esencial)');
  if (a.estado !== 'activo') throw new Error('Su cuenta no está activa');
  if (a.nutricion === false) throw new Error('Su plan no lleva nutrición');
  return a;
}
export function planComidaEsencialDemo(t, { p = {}, atletaId, hoy, uuid, ahoraISO }) {
  quienComida(t, atletaId);
  const datos = { sexo: p.sexo, edad: p.edad, altura: p.altura, peso: p.peso, actividad: p.actividad, objetivo: p.objetivo, tca: p.tca };
  if (datosComidaValidos(datos)) throw new Error('Revisa tus datos: sexo, edad (18 a 90), altura (130 a 220 cm), peso (35 a 250 kg), cuánto te mueves, tu objetivo y la pregunta de salud');
  const c = t('cuestionarios').find((x) => x.atleta_id === atletaId);
  if (!c) throw new Error('Antes, el cuestionario');
  c.tca = p.tca;
  const plan = planComidaEsencial(datos);
  const fila = { atleta_id: atletaId, desde: hoy, modo: 'macros', fase: plan.fase, ritmo_pct: plan.ritmo_pct, kcal: plan.kcal, proteina_g: plan.proteina_g,
    carbos_g: plan.carbos_g, grasa_g: plan.grasa_g, fibra_g: null, kcal_descanso: null, carbos_descanso_g: null, grasa_descanso_g: null, pautas: null, motivo: plan.motivo };
  const ya = t('planes_nutricion').find((x) => x.atleta_id === atletaId && x.desde === hoy);
  if (ya) Object.assign(ya, fila); else t('planes_nutricion').push({ id: uuid(), ...fila, creado_en: ahoraISO });
  if (!t('pesos').some((x) => x.atleta_id === atletaId && x.fecha === hoy)) t('pesos').push({ id: uuid(), atleta_id: atletaId, fecha: hoy, kg: Math.round(Number(p.peso) * 100) / 100, notas: null });
  const id = (ya || t('planes_nutricion').find((x) => x.atleta_id === atletaId && x.desde === hoy)).id;
  return { ...plan, id, desde: hoy };
}
export function ajusteComidaEsencialDemo(t, { p = {}, atletaId, hoy, uuid, ahoraISO }) {
  quienComida(t, atletaId);
  const ult = t('planes_nutricion').filter((x) => x.atleta_id === atletaId && x.desde <= hoy).sort((x, y) => (x.desde < y.desde ? 1 : -1))[0];
  if (!ult) throw new Error('Antes, tu plan de partida');
  if (ult.mantenimiento != null) return null;   // (105) del motor: se revisa cada 4 semanas, no cada semana
  if (ult.desde > sumarDias(hoy, -7)) return null;
  if (ult.modo !== 'macros' || ult.kcal == null || ult.kcal_descanso != null) throw new Error('Este plan no se ajusta solo');
  const [kcal, prot, carb, grasa] = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g'].map((c) => (Number.isInteger(Number(p[c])) && p[c] !== '' && p[c] != null ? Number(p[c]) : null));
  const tca = !!t('cuestionarios').find((x) => x.atleta_id === atletaId)?.tca;
  if (kcal == null || prot == null || carb == null || grasa == null || kcal < 1190 || Math.abs(kcal - Number(ult.kcal)) > 320 || prot !== Number(ult.proteina_g)
    || grasa < 10 || grasa > Number(ult.grasa_g) || carb < 0 || Math.abs(kcal - (4 * prot + 4 * carb + 9 * grasa)) > 5 || (tca && kcal < Number(ult.kcal))) {
    throw new Error('Ese ajuste se sale de los topes');
  }
  const motivo = String(p.motivo || '').trim().slice(0, 280) || 'Ajuste de la semana';
  const nuevo = { id: uuid(), atleta_id: atletaId, desde: hoy, modo: 'macros', fase: ult.fase, ritmo_pct: ult.ritmo_pct, kcal, proteina_g: prot, carbos_g: carb, grasa_g: grasa,
    fibra_g: ult.fibra_g ?? null, kcal_descanso: null, carbos_descanso_g: null, grasa_descanso_g: null, pautas: ult.pautas ?? null, motivo, creado_en: ahoraISO };
  t('planes_nutricion').push(nuevo);
  return nuevo.id;
}

// (105) El motor de nutrición en la demo, como nutricion_plan_motor() y nutricion_revision() de la base: mismas
// comprobaciones, el mismo cálculo (planMotor) y los mismos topes
const SALUD_CLAVES = ['embarazo', 'lactancia', 'renal', 'insulina', 'bariatrica', 'scoff'];
const SCOFF_CLAVES = ['vomito', 'control', 'perdida', 'gordura', 'domina'];
const saludValida = (j) => j == null || (typeof j === 'object' && !Array.isArray(j) && Object.keys(j).every((k) => SALUD_CLAVES.includes(k))
  && Object.entries(j).every(([k, v]) => (k === 'scoff' ? v == null || (typeof v === 'object' && Object.entries(v).every(([k2, v2]) => SCOFF_CLAVES.includes(k2) && typeof v2 === 'boolean')) : typeof v === 'boolean')));
const tramoPasos = (v) => { const x = Number(v) || 0; return x >= 10000 ? 10000 : x >= 7500 ? 7500 : x >= 5000 ? 5000 : 0; };
export function planMotorDemo(t, { p = {}, atletaId, hoy, uuid, ahoraISO }) {
  quienComida(t, atletaId);
  const n = (v) => (v == null || v === '' ? null : Number(v));
  const salud = p.salud ?? null;
  const d = { sexo: p.sexo, edad: n(p.edad), altura: n(p.altura), peso: n(p.peso), cintura: n(p.cintura), trabajo: p.trabajo, objetivo: p.objetivo };
  if (datosMotorValidos(d) || (p.cadera != null && p.cadera !== '' && !(n(p.cadera) >= 50 && n(p.cadera) <= 200)) || typeof p.tca !== 'boolean' || !saludValida(salud)) {
    throw new Error('Revisa tus datos: sexo, edad (18 a 90), altura (130 a 220 cm), peso (35 a 250 kg), cintura (45 a 200 cm), tu trabajo, tu objetivo y la pregunta de salud');
  }
  const c = t('cuestionarios').find((x) => x.atleta_id === atletaId);
  if (!c) throw new Error('Antes, el cuestionario');
  Object.assign(c, { tca: p.tca, nutricion_salud: salud });
  const dexa = p.composicion_metodo === 'dexa' ? n(p.masa_magra) : null;
  const perfil = { atleta_id: atletaId, sexo: p.sexo, anio_nacimiento: Number(hoy.slice(0, 4)) - Math.floor(d.edad), altura: d.altura, trabajo: p.trabajo,
    pasos: tramoPasos(p.pasos), dias_entreno: Math.min(7, Math.max(0, Math.round(n(p.dias_entreno) || 0))), objetivo: p.objetivo, ritmo_pct: n(p.ritmo_pct), experiencia: p.experiencia || null,
    meta_peso: n(p.meta_peso), meta_cintura: n(p.meta_cintura), composicion_metodo: p.composicion_metodo || null, composicion_grasa: n(p.composicion_grasa), masa_magra: dexa,
    bebidas_semana: n(p.bebidas_semana) || 0, forma_comer: p.forma_comer || 'omnivora', tomas: n(p.tomas) || 4, cocina: p.cocina || null, come_fuera: p.come_fuera || null,
    pocos_hidratos: !!p.pocos_hidratos, alimentos_si: [...(p.alimentos_si || [])], alimentos_no: [...(p.alimentos_no || [])], actualizado_en: ahoraISO };
  const ya = t('nutricion_perfiles').find((x) => x.atleta_id === atletaId);
  if (ya) Object.assign(ya, perfil); else t('nutricion_perfiles').push(perfil);
  if (!t('pesos').some((x) => x.atleta_id === atletaId && x.fecha === hoy)) t('pesos').push({ id: uuid(), atleta_id: atletaId, fecha: hoy, kg: Math.round(d.peso * 100) / 100, notas: null });
  const med = t('medidas').find((x) => x.atleta_id === atletaId && x.fecha === hoy);
  const cad = n(p.cadera) != null ? Math.round(n(p.cadera) * 10) / 10 : null;
  if (med) Object.assign(med, { cintura_cm: Math.round(d.cintura * 10) / 10, cadera_cm: cad ?? med.cadera_cm ?? null });
  else t('medidas').push({ id: uuid(), atleta_id: atletaId, fecha: hoy, cintura_cm: Math.round(d.cintura * 10) / 10, cadera_cm: cad, pecho_cm: null, brazo_cm: null, muslo_cm: null, pantorrilla_cm: null, notas: null });
  // (el embarazo, también si lo marcó en su cuestionario de entreno)
  const embarazo = !!salud?.embarazo || (p.sexo === 'mujer' && (c.otras || []).includes('embarazo'));
  const plan = planMotor({ ...d, ritmo: n(p.ritmo_pct), experiencia: p.experiencia, diasEntreno: n(p.dias_entreno), pasos: n(p.pasos), pocosHidratos: !!p.pocos_hidratos,
    bebidasSemana: n(p.bebidas_semana), tomas: n(p.tomas), masaMagraDexa: dexa, tca: p.tca, scoff: salud?.scoff, embarazo, lactancia: !!salud?.lactancia,
    renal: !!salud?.renal, insulina: !!salud?.insulina, bariatrica: !!salud?.bariatrica });
  if (!plan.automatico) return { automatico: false, motivo: plan.motivo };
  const fila = { atleta_id: atletaId, desde: hoy, modo: 'macros', fase: plan.objetivo, ritmo_pct: plan.ritmo_pct, kcal: plan.kcal, proteina_g: plan.proteina_g, carbos_g: plan.carbos_g,
    grasa_g: plan.grasa_g, fibra_g: 25, kcal_descanso: null, carbos_descanso_g: null, grasa_descanso_g: null, pautas: null, mantenimiento: plan.mantenimiento,
    motivo: plan.soloMantener ? 'Plan de partida para mantener tu peso (sin déficit).' : 'Plan de partida, con tu cuestionario de nutrición.' };
  const yaPlan = t('planes_nutricion').find((x) => x.atleta_id === atletaId && x.desde === hoy);
  if (yaPlan) Object.assign(yaPlan, fila); else t('planes_nutricion').push({ id: uuid(), ...fila, creado_en: ahoraISO });
  const idPlan = (yaPlan || t('planes_nutricion').find((x) => x.atleta_id === atletaId && x.desde === hoy)).id;
  return { objetivo: plan.objetivo, ritmo_pct: plan.ritmo_pct, reposo: plan.reposo, formula: plan.formula, factor: plan.factor, mantenimiento: plan.mantenimiento, limite: plan.limite,
    peso_referencia: plan.pesoReferencia ?? d.peso, kcal: plan.kcal, proteina_g: plan.proteina_g, grasa_g: plan.grasa_g, carbos_g: plan.carbos_g, alcohol_kcal: plan.alcohol_kcal,
    fibra_g: 25, tomas: plan.tomas, proteina_toma_g: plan.proteinaToma_g, automatico: true, id: idPlan, desde: hoy, solo_mantener: plan.soloMantener };
}
export function revisionNutricionDemo(t, { p = {}, atletaId, hoy, uuid, ahoraISO }) {
  quienComida(t, atletaId);
  const ult = t('planes_nutricion').filter((x) => x.atleta_id === atletaId && x.desde <= hoy).sort((x, y) => (x.desde < y.desde ? 1 : -1))[0];
  if (!ult) throw new Error('Antes, tu plan de partida');
  if (ult.desde > sumarDias(hoy, -28)) return null;
  if (ult.modo !== 'macros' || ult.kcal == null || ult.kcal_descanso != null) throw new Error('Este plan no se ajusta solo');
  const [kcal, prot, carb, grasa] = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g'].map((k) => (Number.isInteger(Number(p[k])) && p[k] !== '' && p[k] != null ? Number(p[k]) : null));
  const alc = p.alcohol_kcal == null ? 0 : Number(p.alcohol_kcal);
  const ad = adherencia({ registros: t('registros_nutricion').filter((x) => x.atleta_id === atletaId), pesos: t('pesos').filter((x) => x.atleta_id === atletaId) }, sumarDias(hoy, -1));
  if (!ad.buena) throw new Error('Sin buena adherencia no se tocan las kcal');
  const sexo = t('nutricion_perfiles').find((x) => x.atleta_id === atletaId)?.sexo;
  const c = t('cuestionarios').find((x) => x.atleta_id === atletaId);
  const tca = !!c?.tca || scoffPositivo(c?.nutricion_salud?.scoff || {});
  const piso = Math.max(sexo === 'mujer' ? 1500 : 1800, ult.mantenimiento ? Math.ceil((0.75 * ult.mantenimiento) / 10) * 10 : 0);
  if (kcal == null || prot == null || carb == null || grasa == null || !(alc >= 0 && alc <= 1000) || Math.abs(kcal - Number(ult.kcal)) > 255 || kcal === Number(ult.kcal)
    || prot !== Number(ult.proteina_g) || carb < 0 || grasa * 9 < 0.2 * kcal - 45 || grasa * 9 > 0.35 * kcal + 45 || Math.abs(kcal - (4 * prot + 4 * carb + 9 * grasa + alc)) > 5
    || (kcal < Number(ult.kcal) && kcal < piso - 5) || (tca && kcal < Number(ult.kcal))) {
    throw new Error('Ese cambio se sale de los topes');
  }
  const nuevo = { id: uuid(), atleta_id: atletaId, desde: hoy, modo: 'macros', fase: ult.fase, ritmo_pct: ult.ritmo_pct, kcal, proteina_g: prot, carbos_g: carb, grasa_g: grasa,
    fibra_g: ult.fibra_g ?? null, kcal_descanso: null, carbos_descanso_g: null, grasa_descanso_g: null, pautas: ult.pautas ?? null, mantenimiento: ult.mantenimiento ?? null,
    motivo: String(p.motivo || '').trim().slice(0, 280) || 'Revisión de las 4 semanas', creado_en: ahoraISO };
  t('planes_nutricion').push(nuevo);
  return nuevo.id;
}

export function sembrarEsencial(db, { hoy, lunesHoy, ahoraISO, uuid, usuario, versionLegal }) {
  const t = (nombre) => (db[nombre] ||= []);
  // Los ejercicios (con sus alternativas, por id, como en Supabase)
  const ej = Object.fromEntries(db.ejercicios.map((e) => [e.nombre, e]));
  for (const [nombre, grupos, tipo, porTiempo] of EJERCICIOS_GUIA) {
    if (!ej[nombre]) {
      ej[nombre] = { id: uuid(), nombre, variante: null, grupos_musculares: grupos, video_url: null, instrucciones: null, errores: null, tipo, rango_reps: null, activo: true, creado_en: ahoraISO, alternativas: [] };
      db.ejercicios.push(ej[nombre]);
    }
    if (porTiempo) ej[nombre].por_tiempo = true;
  }
  for (const e of PRIMERAS_4.ejercicios) {
    const a = ej[e.nombre], b = ej[e.alternativa];
    if (a && b && !a.alternativas.includes(b.id)) a.alternativas = [b.id, ...a.alternativas];
  }

  // La plantilla, como la crea la 091 (sin fechas: las pone la copia)
  const plantilla = { id: uuid(), atleta_id: null, es_plantilla: true, numero: null, nombre: PRIMERAS_4.nombre, foco: PRIMERAS_4.foco, objetivo: PRIMERAS_4.objetivo,
    descripcion: PRIMERAS_4.descripcion, fecha_inicio: null, fecha_fin: null, estado: 'planificado', creado_en: ahoraISO, objetivo_logrado: null };
  t('bloques').push(plantilla);
  for (const w of filasPrimeras4()) {
    const semana = { id: uuid(), bloque_id: plantilla.id, numero: w.numero, foco: PRIMERAS_4.foco, fecha_inicio: null, nota_coach: w.nota, programacion: 'no_iniciada', marcas: w.marcas };
    t('semanas').push(semana);
    for (const s of w.sesiones) {
      const sesion = { id: uuid(), semana_id: semana.id, orden: s.orden, nombre: s.nombre, tipo: 'fuerza', intencion: null, dinamica: null, fecha_realizada: null, completada: false,
        nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null };
      t('sesiones').push(sesion);
      for (const e of s.ejercicios) {
        t('sesion_ejercicios').push({ id: uuid(), sesion_id: sesion.id, ejercicio_id: ej[e.nombre].id, orden: e.orden, superserie: null, prioridad: e.prioridad, series: e.series,
          reps_min: e.reps_min, reps_max: e.reps_max, rir_objetivo: e.rir_objetivo, rpe_objetivo: null, carga_sugerida_kg: null, descanso_seg: e.descanso_seg,
          tempo: null, notas_coach: e.notas_coach, variante: null });
      }
    }
  }

  // La plantilla de novato (desde la semana 5), como la crea la 092
  const novato = { id: uuid(), atleta_id: null, es_plantilla: true, numero: null, nombre: NOVATO_2.nombre, foco: NOVATO_2.foco, objetivo: NOVATO_2.objetivo,
    descripcion: NOVATO_2.descripcion, fecha_inicio: null, fecha_fin: null, estado: 'planificado', creado_en: ahoraISO, objetivo_logrado: null };
  t('bloques').push(novato);
  for (const w of filasPrimeras4(NOVATO_2)) {
    const semana = { id: uuid(), bloque_id: novato.id, numero: w.numero, foco: NOVATO_2.foco, fecha_inicio: null, nota_coach: w.nota, programacion: 'no_iniciada', marcas: false };
    t('semanas').push(semana);
    for (const s of w.sesiones) {
      const sesion = { id: uuid(), semana_id: semana.id, orden: s.orden, nombre: s.nombre, tipo: 'fuerza', intencion: null, dinamica: null, fecha_realizada: null, completada: false,
        nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null };
      t('sesiones').push(sesion);
      for (const e of s.ejercicios) {
        t('sesion_ejercicios').push({ id: uuid(), sesion_id: sesion.id, ejercicio_id: ej[e.nombre].id, orden: e.orden, superserie: null, prioridad: e.prioridad, series: e.series,
          reps_min: e.reps_min, reps_max: e.reps_max, rir_objetivo: e.rir_objetivo, rpe_objetivo: null, carga_sugerida_kg: null, descanso_seg: e.descanso_seg,
          tempo: null, notas_coach: e.notas_coach, variante: null });
      }
    }
  }

  // (096) La de tres días, como la crea la 096
  const novato3 = { id: uuid(), atleta_id: null, es_plantilla: true, numero: null, nombre: NOVATO_3.nombre, foco: NOVATO_3.foco, objetivo: NOVATO_3.objetivo,
    descripcion: NOVATO_3.descripcion, fecha_inicio: null, fecha_fin: null, estado: 'planificado', creado_en: ahoraISO, objetivo_logrado: null };
  t('bloques').push(novato3);
  for (const w of filasNovato3()) {
    const semana = { id: uuid(), bloque_id: novato3.id, numero: w.numero, foco: NOVATO_3.foco, fecha_inicio: null, nota_coach: w.nota, programacion: 'no_iniciada', marcas: false };
    t('semanas').push(semana);
    for (const s of w.sesiones) {
      const sesion = { id: uuid(), semana_id: semana.id, orden: s.orden, nombre: s.nombre, tipo: 'fuerza', intencion: null, dinamica: null, fecha_realizada: null, completada: false,
        nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null };
      t('sesiones').push(sesion);
      for (const e of s.ejercicios) {
        t('sesion_ejercicios').push({ id: uuid(), sesion_id: sesion.id, ejercicio_id: ej[e.nombre].id, orden: e.orden, superserie: null, prioridad: e.prioridad, series: e.series,
          reps_min: e.reps_min, reps_max: e.reps_max, rir_objetivo: e.rir_objetivo, rpe_objetivo: null, carga_sugerida_kg: null, descanso_seg: e.descanso_seg,
          tempo: null, notas_coach: e.notas_coach, variante: null });
      }
    }
  }

  // (099) El catálogo de rutinas de la demo: las tres de FBE Esencial y diez de muestra de la biblioteca (con los ejercicios
  // de la demo y sin esfuerzo pautado, como las de verdad: las de Pelayo solo están en su base)
  const dias3 = filasNovato3()[0].sesiones;
  for (const [nombre, orden] of [['2 días · Full body · B · Máquinas y mancuernas', [0, 1]], ['3 días · Full body · B · Máquinas y mancuernas', [0, 1, 2]], ['4 días · Torso-pierna · B · Máquinas y mancuernas', [0, 1, 2, 0]],
    ['2 días · Full body · C · Énfasis glúteo y pierna', [1, 0]], ['3 días · Full body A y B + torso · B · Máquinas y mancuernas', [0, 2, 1]], ['3 días · Pierna, torso y full body · B · Máquinas y mancuernas', [1, 2, 0]],
    ['3 días · Full body en casa, sin material', [2, 1, 0]], ['2 días · De viaje (hotel, 25–30 minutos)', [1, 1]], ['2 días · Mantenimiento mínimo (40 minutos)', [0, 2]], ['3 días · Salud y mayores de 60', [1, 0, 1]]]) {
    const pl = { id: uuid(), atleta_id: null, es_plantilla: true, numero: null, nombre, foco: NOVATO_3.foco, objetivo: null, descripcion: null, fecha_inicio: null, fecha_fin: null,
      estado: 'planificado', creado_en: ahoraISO, objetivo_logrado: null };
    t('bloques').push(pl);
    const semana = { id: uuid(), bloque_id: pl.id, numero: 1, foco: NOVATO_3.foco, fecha_inicio: null, nota_coach: null, programacion: 'no_iniciada', marcas: false };
    t('semanas').push(semana);
    orden.forEach((k, i) => {
      const sesion = { id: uuid(), semana_id: semana.id, orden: i + 1, nombre: `Día ${i + 1}`, tipo: 'fuerza', intencion: null, dinamica: null, fecha_realizada: null, completada: false,
        nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null };
      t('sesiones').push(sesion);
      for (const e of dias3[k].ejercicios) {
        t('sesion_ejercicios').push({ id: uuid(), sesion_id: sesion.id, ejercicio_id: ej[e.nombre].id, orden: e.orden, superserie: null, prioridad: e.prioridad, series: e.series,
          reps_min: e.reps_min, reps_max: e.reps_max, rir_objetivo: null, rpe_objetivo: null, carga_sugerida_kg: null, descanso_seg: e.descanso_seg, tempo: null, notas_coach: null, variante: null });
      }
    });
  }
  // En el catálogo: las de FBE Esencial y las de muestra de arriba (como en la base, donde entran las de la biblioteca; las
  // demás plantillas de la demo, fuera, y Pelayo las mete o las saca en Plantillas)
  const delCatalogo = new Set([PRIMERAS_4.nombre, NOVATO_2.nombre, NOVATO_3.nombre]);
  for (const b of t('bloques')) if (b.es_plantilla) b.esencial_catalogo = delCatalogo.has(b.nombre) || /^\d d\u00edas \u00b7 /.test(b.nombre);

  const atleta = ({ email, nombre, alta, objetivo, inicio, extra = {} }) => {
    const perfil = usuario(email, nombre.split(' ')[0], 'atleta');
    const a = { id: uuid(), perfil_id: perfil, nombre, email, estado: 'activo', fecha_alta: alta, objetivo, notion_url: null, progresion_auto: true, volumen_objetivo: null,
      creado_en: ahoraISO, nivel: 'novato', nutricion: false, modalidad: MODALIDAD_POR_SU_CUENTA, esencial_inicio: inicio, visto_bueno_pedido_en: null, visto_bueno_en: null, esencial_plantilla: null, esencial_plantilla_en: null, ...extra };
    db.atletas.push(a);
    for (const tipo of ['privacidad', 'datos_salud']) db.consentimientos.push({ id: uuid(), perfil_id: perfil, tipo, version: '2026-10', aceptado_en: ahoraISO, revocado_en: null });
    t('privacidad_vista').push({ usuario_id: perfil, version: versionLegal, vista_en: ahoraISO });
    // (el cuestionario de objetivos es para quien lleva seguimiento: aquí no sale)
    t('objetivos_rondas').push({ atleta_id: a.id, contestado_en: ahoraISO });
    return a;
  };
  const cuestionario = (a, dias, campos) => db.cuestionarios.push({ id: uuid(), atleta_id: a.id, objetivo: 'salud', objetivos: ['salud', 'fuerza'], otros_deportes: null,
    experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, lugar: 'gimnasio', material: ['maquinas', 'mancuernas', 'banco', 'poleas'], activo: false, enfermedad: false, sintomas: [],
    otras: [], enfermedad_detalle: null, medicacion_detalle: null, alergias: null, lesiones: [], resultado: 'sin_valoracion', pedido_en: null, revisado_en: null,
    completado_en: `${sumarDias(lunesHoy, -dias)}T20:00:00.000Z`, creado_en: `${sumarDias(lunesHoy, -dias)}T20:00:00.000Z`, actualizado_en: `${sumarDias(lunesHoy, -dias)}T20:00:00.000Z`, ...campos });

  // Marina: acaba de entrar (su tanda, en la demo, es esta semana); sin cuestionario ni plan
  const marina = atleta({ email: 'marina@fbe.demo', nombre: 'Marina Ortega', alta: sumarDias(lunesHoy, -3), objetivo: 'FBE Esencial · Entrenamiento', inicio: lunesHoy });

  // Tomás: las cuatro semanas hechas (la última terminó el domingo pasado); su cuestionario, sin necesidad de valoración
  const tomas = atleta({ email: 'tomas@fbe.demo', nombre: 'Tomás Rey', alta: sumarDias(lunesHoy, -31), objetivo: 'FBE Esencial · Entrenamiento', inicio: sumarDias(lunesHoy, -28) });
  cuestionario(tomas, 30, { objetivo_detalle: 'Llevo años sin hacer nada y quiero empezar bien.' });
  const nombreDe = Object.fromEntries(db.ejercicios.map((e) => [e.id, e.nombre]));
  const bt = copiarPlantillaEsencial(t, { plantilla, atletaId: tomas.id, inicio: sumarDias(lunesHoy, -28), uuid, ahoraISO });
  for (const w of t('semanas').filter((x) => x.bloque_id === bt.id)) {
    for (const s of t('sesiones').filter((x) => x.semana_id === w.id)) {
      const dia = sumarDias(w.fecha_inicio, s.orden === 1 ? 0 : 3);   // dos días que no vayan seguidos: lunes y jueves
      if (dia > hoy) continue;
      let minuto = 0;
      for (const p of t('sesion_ejercicios').filter((x) => x.sesion_id === s.id).sort((a, b) => a.orden - b.orden)) {
        const nombre = nombreDe[p.ejercicio_id];
        const kg = TOMAS[nombre]?.[w.numero - 1];
        if (kg == null) continue;
        for (let n = 1; n <= p.series; n++) {
          const x = nombre === 'Plancha abdominal' ? { kg: null, reps: kg - (n - 1) * 3 - (s.orden === 1 ? 2 : 0), rpe: null }
            : { kg, reps: Math.max(10, 12 - (n - 1) - (s.orden === 1 && w.numero === 4 ? 1 : 0)), rpe: w.numero === 1 ? 5.5 : w.numero === 2 ? 7 : 8 };
          minuto += 3;
          db.series.push({ id: uuid(), sesion_ejercicio_id: p.id, atleta_id: tomas.id, numero: n, kg: x.kg, reps: x.reps, rpe: x.rpe, rir: null, nota: null, sustituto_id: null,
            registrada_en: new Date(`${dia}T18:${String(Math.min(59, minuto)).padStart(2, '0')}:00`).toISOString() });
        }
      }
      Object.assign(s, { completada: true, fecha_realizada: dia, duracion_min: w.numero === 1 ? 30 : w.numero === 4 ? 45 : 38, rpe_sesion: 6, revisada_en: null });
    }
  }
  // Su peso, una vez por semana
  for (let k = 4; k >= 0; k--) db.pesos.push({ id: uuid(), atleta_id: tomas.id, fecha: k === 0 ? hoy : sumarDias(lunesHoy, -7 * k), kg: Math.round((86.4 - (4 - k) * 0.3) * 10) / 10, notas: null });

  // Clara: su cribado pide valoración médica (una enfermedad diagnosticada, sin hacer ejercicio) y ayer marcó que ya tiene
  // el visto bueno de su médico: le falta que Pelayo lo confirme. Su tanda empieza el lunes que viene.
  const clara = atleta({ email: 'clara@fbe.demo', nombre: 'Clara Prieto', alta: sumarDias(lunesHoy, -6), objetivo: 'FBE Esencial · Entrenamiento', inicio: sumarDias(lunesHoy, 7),
    extra: { visto_bueno_pedido_en: `${sumarDias(hoy, -1)}T19:30:00.000Z` } });
  cuestionario(clara, 5, { objetivo_detalle: 'Mi médico me ha dicho que me venía bien hacer fuerza.', enfermedad: true, enfermedad_detalle: 'Diabetes tipo 2', resultado: 'valorar_antes' });

  // Inés (093): con nutrición; su cuestionario, limpio; «Primeras 4 semanas» desde este lunes; sin plan de comida todavía
  const ines = atleta({ email: 'ines@fbe.demo', nombre: 'Inés Gil', alta: sumarDias(lunesHoy, -4), objetivo: 'FBE Esencial · Entrenamiento y nutrición', inicio: lunesHoy,
    extra: { nutricion: true } });
  cuestionario(ines, 3, { objetivo_detalle: 'Quiero ponerme fuerte y comer con orden.' });
  copiarPlantillaEsencial(t, { plantilla, atletaId: ines.id, inicio: lunesHoy, uuid, ahoraISO });
  db.pesos.push({ id: uuid(), atleta_id: ines.id, fecha: sumarDias(hoy, -2), kg: 68.4, notas: null });

  // (v0.248, tanda 7) Lucía: la espera de quien empieza de cero. Reservó hace unos días, su cuestionario está limpio y su
  // plan («Primeras 4 semanas») empieza dentro de dos lunes: en Hoy, la cuenta atrás, lo que le falta y lo de cada día
  const lucia = atleta({ email: 'luciav@fbe.demo', nombre: 'Lucía Vidal', alta: sumarDias(hoy, -5), objetivo: 'FBE Esencial · Entrenamiento', inicio: sumarDias(lunesHoy, 14) });
  cuestionario(lucia, 4, { objetivo_detalle: 'Quiero empezar a cuidarme y no sé por dónde.' });
  copiarPlantillaEsencial(t, { plantilla, atletaId: lucia.id, inicio: sumarDias(lunesHoy, 14), uuid, ahoraISO });

  // (v0.248) Andrés: la espera de quien ya entrena. Entrena desde hace un par de años, eligió su rutina y empieza el lunes
  // que viene
  const rutinaAndres = '2 días · Full body · B · Máquinas y mancuernas';
  const andres = atleta({ email: 'andresm@fbe.demo', nombre: 'Andrés Mora', alta: sumarDias(hoy, -9), objetivo: 'FBE Esencial · Entrenamiento', inicio: sumarDias(lunesHoy, 7),
    extra: { esencial_plantilla: rutinaAndres, esencial_plantilla_en: `${sumarDias(hoy, -8)}T20:00:00.000Z` } });
  cuestionario(andres, 8, { objetivo_detalle: 'Llevo un par de años entrenando por mi cuenta y quiero orden.', experiencia: '1_3',
    gustos: { ahora: 'si', tecnica: 'si', barra: 'no', prioridad: 'equilibrado', otro: 'no', mayor: 'no' } });
  const plA = t('bloques').find((x) => x.es_plantilla && x.nombre === rutinaAndres);
  if (plA) copiarPlantillaEsencial(t, { plantilla: plA, atletaId: andres.id, inicio: sumarDias(lunesHoy, 7), uuid, ahoraISO });
  // (v0.250, tanda 9) Carmen: entrenamiento y nutrición. Su plan de comida (perder grasa) es de hace cinco semanas y la app
  // se lo ajustó hace tres días; apunta la comida casi todos los días y se pesa cinco de cada siete. Hoy lleva 80 g de
  // proteína. Entrena con «Primeras 4 semanas» desde este lunes, como Inés.
  const carmen = atleta({ email: 'carmen@fbe.demo', nombre: 'Carmen Soto', alta: sumarDias(lunesHoy, -37), objetivo: 'FBE Esencial · Entrenamiento y nutrición', inicio: lunesHoy,
    extra: { nutricion: true } });
  cuestionario(carmen, 36, { objetivo_detalle: 'Perder algo de grasa sin dejar de comer bien.', tca: false });
  copiarPlantillaEsencial(t, { plantilla, atletaId: carmen.id, inicio: lunesHoy, uuid, ahoraISO });
  const inicioComida = sumarDias(lunesHoy, -35), ajusteComida = sumarDias(hoy, -3);
  const planComida = (desde, kcal, carbos, motivo) => ({ id: uuid(), atleta_id: carmen.id, desde, modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal, proteina_g: 130, carbos_g: carbos, grasa_g: 62,
    fibra_g: null, kcal_descanso: null, carbos_descanso_g: null, grasa_descanso_g: null, pautas: null, motivo, creado_en: `${desde}T20:00:00.000Z` });
  t('planes_nutricion').push(planComida(inicioComida, 1838, 190, 'Plan de partida, con tus datos.'),
    planComida(ajusteComida, 1690, 153, 'Ajuste de la semana: gastas unas 2040 kcal al día y, para bajar un 0,5 % del peso a la semana, te tocan unas 1690: bajas 148 kcal.'));
  for (let d = 0; sumarDias(inicioComida, d) <= hoy; d++) {
    const f = sumarDias(inicioComida, d), dow = d % 7;
    if (f < hoy && dow !== 6) {
      const base = f >= ajusteComida ? 1700 : 1820;
      t('registros_nutricion').push({ id: uuid(), atleta_id: carmen.id, fecha: f, kcal: base + ((d * 53) % 9 - 4) * 15, proteina_g: 118 + (d * 7) % 11, carbos_g: null, grasa_g: null, fibra_g: null,
        completo: true, cumplido: null, nota: null, actualizado_en: `${f}T21:00:00.000Z` });
    }
    if (dow !== 2 && dow !== 5) db.pesos.push({ id: uuid(), atleta_id: carmen.id, fecha: f, kg: Math.round((72.4 - 0.3 * (d / 7) + (((d * 37) % 7) - 3) * 0.08) * 10) / 10, notas: null });
  }
  t('registros_nutricion').push({ id: uuid(), atleta_id: carmen.id, fecha: hoy, kcal: 1100, proteina_g: 80, carbos_g: null, grasa_g: null, fibra_g: null, completo: false, cumplido: null, nota: null,
    actualizado_en: `${hoy}T14:00:00.000Z` });
  return { marina, tomas, clara, ines, lucia, andres, carmen, plantilla };
}
