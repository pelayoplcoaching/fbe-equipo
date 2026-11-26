// FBE Esencial (acompañamiento, tanda 6, v0.247): «Automatizaciones: la vida real». Lógica pura.
// Lo que un coach arreglaría con un mensaje y aquí arregla la app: me voy de viaje, entreno en otro sitio, he cambiado de
// gimnasio, mis días de verdad son otros, cámbiame este ejercicio, ¿paso a tres días?, tengo un objetivo con fecha, mis
// marcas de antes y de ahora, el final de «Primeras 4 semanas», cuando la app no basta y los avisos por correo. Para el
// coach, el resumen de la semana.
// Casi todo junta piezas que ya existían (la pausa, la rutina de viaje, las alternativas de cada ejercicio, «¿Dónde
// entrenas hoy?», pasar a tres días) para que no haya que saber dónde está cada una.
// Lo que toca salud o cambia cómo se progresa (estoy enfermo, el seguimiento de una molestia, la semana suave, dos
// sesiones duras seguidas, repasar la salud cada seis meses, la señal de alarma) está hecho y APAGADO
// (logica/esencial-respuestas.js) hasta que Pelayo lo vea.
// En `esencial_notas` no se guarda nada de salud: de un viaje, las fechas y qué va a hacer; de un objetivo, su texto y
// su fecha; de una semana suave, su lunes.

const DIA = 864e5;
const d10 = (x) => (x ? String(x).slice(0, 10) : null);
const sumar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const entre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA);
const diaSemana = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay() || 7;   // 1 lunes … 7 domingo
const lunesDe = (iso) => sumar(iso, 1 - diaSemana(iso));
// (una fecha de verdad: el 30 de febrero no vale, aunque el navegador lo convierta en el 2 de marzo)
const esFecha = (x) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x || ''))) return false; const t = Date.parse(`${x}T12:00:00Z`); return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === x; };
const cuantas = (n, una, varias) => (n === 1 ? una : varias.replace('%', String(n)));
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const fechaCorta = (iso) => (esFecha(iso) ? `${DIAS[diaSemana(iso) - 1]} ${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}` : '');

// ---------- (41) «Me voy de viaje» ----------
// Qué va a hacer esos días: [id, etiqueta, lo que pasa]
export const MODOS_VIAJE = [
  ['pausa', 'No voy a entrenar', 'Esos días no te llegan avisos de entreno. A la vuelta sigues con lo que llevabas: no hay nada que recuperar.'],
  ['viaje', 'Entrenaré con lo que haya', 'En «Tu rutina» tienes una de viaje: dos sesiones cortas, sin material. A la vuelta, la app te ofrece volver a la tuya.'],
  ['igual', 'Tendré gimnasio: sigo igual', 'No cambia nada. Si allí falta alguna máquina, en la sesión, «¿Dónde entrenas hoy?» o «Cambiar» en ese ejercicio.'],
];
export const VIAJE_MAX_DIAS = 60;
// → null si vale | el motivo, en llano
export function validarViaje({ desde, hasta, hoy } = {}) {
  if (!esFecha(desde) || !esFecha(hasta)) return 'Pon el día que te vas y el día que vuelves.';
  if (hasta < desde) return 'El día de vuelta va después del de ida.';
  if (hoy && hasta < hoy) return 'Ese viaje ya ha pasado.';
  if (entre(desde, hasta) + 1 > VIAJE_MAX_DIAS) return `Como mucho, ${VIAJE_MAX_DIAS} días: para más tiempo, mejor una rutina nueva para donde vayas.`;
  if (hoy && entre(hoy, desde) > 180) return 'Queda mucho para ese viaje: apúntalo cuando falte menos.';
  return null;
}
// notas: las suyas de tipo 'viaje' ({ id, desde, hasta, datos: { modo } }) → null | el viaje que cuenta hoy:
// { id, desde, hasta, modo, dias, estado: 'antes' (faltan ≤ 14 días) | 'durante' | 'vuelta' (los 3 días de después), faltan, quedan }
export function viajeDe(notas = [], hoy) {
  if (!hoy) return null;
  const vs = (notas || []).filter((n) => esFecha(d10(n?.desde)) && esFecha(d10(n?.hasta)) && d10(n.hasta) >= d10(n.desde))
    .map((n) => ({ id: n.id, desde: d10(n.desde), hasta: d10(n.hasta), modo: MODOS_VIAJE.some(([m]) => m === n?.datos?.modo) ? n.datos.modo : 'pausa' }))
    .filter((v) => sumar(v.hasta, 3) >= hoy && entre(hoy, v.desde) <= 14)
    .sort((a, b) => a.desde.localeCompare(b.desde));
  const v = vs[0];
  if (!v) return null;
  const estado = hoy < v.desde ? 'antes' : hoy <= v.hasta ? 'durante' : 'vuelta';
  return { ...v, dias: entre(v.desde, v.hasta) + 1, estado, faltan: Math.max(0, entre(hoy, v.desde)), quedan: Math.max(0, entre(hoy, v.hasta)) };
}
// El que tiene por delante (o en marcha), falte lo que falte: para verlo y cambiarlo en «Me voy de viaje» aunque aún no
// salga en Hoy → null | { id, desde, hasta, modo }
export function proximoViaje(notas = [], hoy) {
  if (!hoy) return null;
  return (notas || []).filter((n) => esFecha(d10(n?.desde)) && esFecha(d10(n?.hasta)) && d10(n.hasta) >= hoy)
    .map((n) => ({ id: n.id, desde: d10(n.desde), hasta: d10(n.hasta), modo: MODOS_VIAJE.some(([m]) => m === n?.datos?.modo) ? n.datos.modo : 'pausa' }))
    .sort((a, b) => a.desde.localeCompare(b.desde))[0] || null;
}
// ¿Calla los avisos de entreno ese día? (lo mismo que hace la base con la migración 101: con «sigo igual», no)
export const viajeCalla = (v) => !!v && v.estado === 'durante' && v.modo !== 'igual';
// Lo que se le dice en Hoy → { titulo, texto }
export function textoViaje(v) {
  if (!v) return null;
  const vuelve = fechaCorta(v.hasta), sale = fechaCorta(v.desde);
  if (v.estado === 'antes') {
    return { titulo: v.faltan === 1 ? 'Mañana te vas' : `Te vas el ${sale}`,
      texto: v.modo === 'pausa' ? `Mientras estés fuera (hasta el ${vuelve}), la app no te manda avisos de entreno. Hasta que te vayas, tu semana sigue como siempre.`
        : v.modo === 'viaje' ? 'Antes de irte, elige la rutina de viaje en «Tu rutina»: entra con la semana siguiente.'
          : 'Sigues con tu plan también allí.' };
  }
  if (v.estado === 'durante') {
    return { titulo: v.quedan === 0 ? 'De viaje: hoy es el último día' : `De viaje hasta el ${vuelve}`,
      texto: v.modo === 'pausa' ? 'Sin avisos de entreno y sin nada que recuperar. Si un día te apetece moverte, tu sesión sigue aquí.'
        : v.modo === 'viaje' ? 'Con lo que haya: una sesión corta cuenta igual. Si algún día no sale, no pasa nada.'
          : 'Sigues con tu plan. Si falta una máquina, «Cambiar» en ese ejercicio.' };
  }
  return { titulo: '¿Ya de vuelta?',
    texto: v.modo === 'viaje' ? 'Tu rutina de siempre te espera: en «Tu rutina», vuelve a ella. La primera sesión, sin prisa.'
      : 'Tu plan te espera, con lo que llevabas. La primera sesión, sin prisa: si llevas tiempo parado, la app prepara la vuelta con algo menos de carga.' };
}

// ---------- (44 y 45) «Hoy entreno en otro sitio» y «He cambiado de gimnasio» ----------
// [id, etiqueta, lo que hace la app, a dónde lleva]
export const SITIOS = [
  ['hoy', 'Solo hoy entreno en otro sitio', 'Al abrir la sesión, «¿Dónde entrenas hoy?» cambia lo que allí no puedas hacer por sus alternativas, solo para esa sesión. Y en cada ejercicio, «Cambiar».', null],
  ['gimnasio', 'He cambiado de gimnasio', 'Mira qué ejercicios de tu rutina no puedes hacer allí y cámbialos por su alternativa: tus próximas sesiones ya vendrán con ella. Los kilos de los que no cambian, se quedan.', 'ejercicios'],
  ['casa', 'Ahora entreno en casa', 'Con poco material cambia casi todo: mejor una rutina hecha para casa. Entra con la semana siguiente.', 'rutina'],
];

// ---------- (46) Los días que de verdad entrena ----------
// hechas: [{ fecha }] (todas); elegidos: sus días (1 lunes … 7 domingo) o null; n: sesiones por semana
// → null | { dias, semanas } si en las últimas cuatro semanas ha entrenado casi siempre en otros días que los que eligió
export function diasReales({ hechas = [], elegidos = null, n = 0, hoy } = {}) {
  if (!hoy || !Array.isArray(elegidos) || !elegidos.length || !(n >= 1) || elegidos.length !== n) return null;
  const desde = sumar(lunesDe(hoy), -28), hasta = sumar(lunesDe(hoy), -1);   // cuatro semanas enteras, sin la de ahora
  const cuenta = new Map();
  for (const s of hechas || []) {
    const f = d10(s?.fecha);
    if (!f || f < desde || f > hasta) continue;
    const d = diaSemana(f);
    cuenta.set(d, (cuenta.get(d) || 0) + 1);
  }
  const reales = [...cuenta.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n).map(([d]) => d).sort((a, b) => a - b);
  if (reales.length !== n) return null;
  const igual = reales.every((d, i) => d === [...elegidos].sort((a, b) => a - b)[i]);
  return igual ? null : { dias: reales, semanas: 4 };
}

// ---------- (48, y 47 P: APAGADO) «Cámbiame este ejercicio» ----------
// pautas: las de su semana ([{ ejercicio_id }]); ejercicios: { id: { id, nombre, por_tiempo, alternativas: [id] } };
// puestas: atleta.esencial_alternativas ({ el de la guía: el que hace }); estancados: ids que llevan tres semanas igual
// → [{ id, nombre, guia (si lo que hace ya es una alternativa: el de su rutina), opciones: [{ id, nombre }], estancado }]
export function ejerciciosCambiables({ pautas = [], ejercicios = {}, puestas = {}, estancados = [] } = {}) {
  const vistos = new Set(), out = [];
  const deGuia = Object.fromEntries(Object.entries(puestas || {}).map(([g, a]) => [a, g]));
  for (const p of pautas || []) {
    const id = p?.ejercicio_id;
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const ej = ejercicios[id];
    if (!ej) continue;
    const guia = ejercicios[deGuia[id]] || null;
    const base = guia || ej;
    const opciones = (base.alternativas || []).map((a) => ejercicios[a]).filter((x) => x && x.id !== id && x.activo !== false && !!x.por_tiempo === !!base.por_tiempo)
      .map((x) => ({ id: x.id, nombre: x.nombre }));
    out.push({ id, nombre: ej.nombre, por_tiempo: !!ej.por_tiempo, guia: guia ? { id: guia.id, nombre: guia.nombre } : null, opciones, estancado: (estancados || []).includes(id) });
  }
  return out;
}

// ---------- (49) Subir de nivel cuando toca: de dos a tres días ----------
// Con la rutina de novato de dos días, sus cuatro últimas semanas acabadas, las cuatro completas → { semanas }
export function subirNivel({ rutina = '', actual = null, semanas = [], sesiones = {}, pedido = null } = {}) {
  if (rutina !== 'Novato 2 días · FBE Esencial' || !actual?.fecha_inicio || Number(pedido) === 3) return null;
  const previas = [...(semanas || [])].filter((w) => w.fecha_inicio && d10(w.fecha_inicio) < d10(actual.fecha_inicio) && (sesiones[w.id] || []).length)
    .sort((a, b) => d10(b.fecha_inicio).localeCompare(d10(a.fecha_inicio))).slice(0, 4);
  if (previas.length < 4 || previas.some((w) => w.esencial_cierre === 'pausa' || (sesiones[w.id] || []).some((s) => !s.completada))) return null;
  return { semanas: 4 };
}

// ---------- (50) Un objetivo con fecha ----------
export const OBJETIVO_MAX = 160;
export function validarObjetivo({ texto, fecha, hoy } = {}) {
  const t = String(texto || '').trim();
  if (t.length < 4) return 'Escribe qué quieres conseguir.';
  if (t.length > OBJETIVO_MAX) return `Más corto: como mucho, ${OBJETIVO_MAX} letras.`;
  if (!esFecha(fecha)) return 'Ponle fecha.';
  if (hoy && entre(hoy, fecha) < 14) return 'Dale al menos dos semanas.';
  if (hoy && entre(hoy, fecha) > 371) return 'Como mucho, a un año vista: un objetivo más cercano se cumple mejor.';
  return null;
}
// nota: la suya de tipo 'objetivo' ({ texto, hasta, creada_en, datos: { mitad, hecho } }) → null |
// { texto, fecha, semanas (las que faltan), total, momento: 'camino' | 'mitad' | 'final' | 'pasado', pct }
export function objetivoDe(nota, hoy) {
  const fecha = d10(nota?.hasta), ini = d10(nota?.desde) || d10(nota?.creada_en);
  if (!nota || !hoy || !esFecha(fecha) || !esFecha(ini) || nota?.datos?.hecho) return null;
  const total = Math.max(1, entre(ini, fecha)), llevo = Math.min(total, Math.max(0, entre(ini, hoy)));
  const faltan = entre(hoy, fecha);
  if (faltan < -14) return null;
  const mitad = llevo * 2 >= total && faltan > 7 && !nota?.datos?.mitad;
  const momento = faltan < 0 ? 'pasado' : faltan <= 7 ? 'final' : mitad ? 'mitad' : 'camino';
  return { texto: String(nota.texto || '').trim(), fecha, total: Math.round(total / 7), semanas: Math.max(0, Math.ceil(faltan / 7)), momento, pct: Math.round((llevo / total) * 100) };
}
export function textoObjetivo(o) {
  if (!o) return null;
  if (o.momento === 'pasado') return 'Llegó la fecha. ¿Lo has conseguido? Si no del todo, mira cuánto te has acercado: eso también cuenta.';
  if (o.momento === 'final') return 'Última semana. Lo que tenías que hacer ya está hecho: esta semana, sin inventos.';
  if (o.momento === 'mitad') return `Vas por la mitad: ${cuantas(o.semanas, 'queda una semana', 'quedan % semanas')}. Buen momento para mirar si el plan te está llevando ahí.`;
  return `${cuantas(o.semanas, 'Queda una semana', 'Quedan % semanas')}. Lo que te acerca es no faltar: semana a semana.`;
}

// ---------- (51) Sus marcas, de las primeras a las de ahora ----------
// antes y ahora: [{ ejercicio_id, nombre, kg, reps, porTiempo, texto }] (logica/esencial-alta.js: marcasDeSemana)
// → { filas: [{ nombre, antes, ahora, sube }], suben }
export function compararMarcas(antes = [], ahora = []) {
  const de = Object.fromEntries((antes || []).map((m) => [m.ejercicio_id, m]));
  const mejor = (a, b) => (b.porTiempo ? b.reps > a.reps : b.kg != null && (a.kg == null || b.kg > a.kg || (b.kg === a.kg && b.reps > a.reps))) || (b.kg == null && a.kg == null && b.reps > a.reps);
  const filas = (ahora || []).filter((m) => de[m.ejercicio_id]).map((m) => ({ nombre: m.nombre, antes: de[m.ejercicio_id].texto, ahora: m.texto, sube: mejor(de[m.ejercicio_id], m) }));
  return { filas, suben: filas.filter((f) => f.sube).length };
}

// ---------- (56) El final de «Primeras 4 semanas» ----------
// → null | { sesiones, total, lineas } cuando ha acabado su cuarta semana (o está en ella con todo hecho)
export function finPrimeras({ bloque = '', actual = null, semanas = [], sesiones = {}, marcas = 0 } = {}) {
  if (bloque !== 'Primeras 4 semanas' || !actual || Number(actual.numero) < 4) return null;
  const todas = (semanas || []).flatMap((w) => sesiones[w.id] || []);
  const hechas = todas.filter((s) => s.completada).length;
  if (!todas.length || (sesiones[actual.id] || []).some((s) => !s.completada)) return null;
  return {
    sesiones: hechas, total: todas.length,
    lineas: [
      `${cuantas(hechas, 'Una sesión hecha', '% sesiones hechas')} de ${todas.length}.`,
      'Ya sabes hacer los cinco ejercicios y apuntar cada serie.',
      'Sabes qué es acabar una serie con dos o tres repeticiones de margen.',
      marcas > 0 ? `Tienes tus marcas en ${cuantas(marcas, 'un ejercicio', '% ejercicios')}: el punto de partida.` : 'Con tus marcas, la app ya sabe por dónde empezar.',
    ],
    sigue: 'Desde ahora, la app te prepara cada semana con lo que apuntas. Y en «Tu rutina» puedes elegir con cuál seguir.',
  };
}

// ---------- (57) Cuando la app no basta ----------
// estancados: ejercicios tres semanas sin subir; cambios: veces que ha cambiado de rutina; semanas: las de su plan;
// molestias: semanas (de las últimas seis) con una molestia moderada o grave en su check-in; objetivo: tiene uno con fecha
// → null | { motivo, texto }
export function noBasta({ estancados = 0, cambios = 0, semanas = 0, molestias = 0, objetivo = false } = {}) {
  if (molestias >= 3) return { motivo: 'molestia', texto: 'Llevas varias semanas apuntando una molestia. Una app no puede valorarla: que te la vea un fisioterapeuta o tu médico. Y si quieres un plan hecho alrededor de ella, eso ya es un programa con seguimiento.' };
  if (estancados >= 2 && cambios >= 1 && semanas >= 16) return { motivo: 'estancado', texto: 'Has cambiado de rutina y vuelves a atascarte en varios ejercicios. A partir de aquí ayuda que alguien mire tu técnica y tu semana entera: es lo que hace un programa con seguimiento.' };
  if (objetivo && semanas >= 24) return { motivo: 'objetivo', texto: 'Llevas medio año y tienes un objetivo con fecha. Si quieres afinar para llegar, un programa con seguimiento se hace a tu medida.' };
  return null;
}

// ---------- (58) Los avisos, también por correo ----------
// → true si no le llega nada: ni avisos en un móvil ni por correo (y lleva al menos una semana de plan)
export const sinAvisos = ({ suscripciones = 0, email = false, semana = 0 } = {}) => !(suscripciones > 0) && !email && Number(semana) >= 2;

// ---------- (59) El resumen de la semana, para el coach ----------
// filas: una por atleta de FBE Esencial con plan: { nombre, total, hechas (de esta semana), pausa, viaje, dias (sin entrenar) }
// preguntas: las del directo sin contestar; notas: las de «¿Cómo vamos?» de los últimos 30 días ([{ datos: { nota } }])
export function resumenCoach({ filas = [], preguntas = 0, notas = [] } = {}) {
  const con = (filas || []).filter((f) => f.total > 0);
  const fuera = con.filter((f) => f.pausa || f.viaje);
  const cuentan = con.filter((f) => !f.pausa && !f.viaje);
  const completas = cuentan.filter((f) => f.hechas >= f.total).length;
  const entrenando = cuentan.filter((f) => f.hechas > 0).length;
  const sinEmpezar = cuentan.filter((f) => f.hechas === 0);
  const ns = (notas || []).map((x) => Number(x?.datos?.nota)).filter((x) => x >= 1 && x <= 10);
  return {
    total: con.length, completas, entrenando, sinEmpezar: sinEmpezar.length, pausa: fuera.filter((f) => f.pausa && !f.viaje).length, viaje: fuera.filter((f) => f.viaje).length,
    parados: cuentan.filter((f) => f.dias != null && f.dias >= 10).length, preguntas: Number(preguntas) || 0,
    nota: ns.length ? Math.round((ns.reduce((t, x) => t + x, 0) / ns.length) * 10) / 10 : null, notas: ns.length,
    frase: !con.length ? 'Aún no hay nadie con su plan en marcha.'
      : `De ${cuantas(cuentan.length, 'una persona', '% personas')} con semana en marcha, ${cuantas(entrenando, 'una ha entrenado', '% han entrenado')} y ${cuantas(completas, 'una la tiene completa', '% la tienen completa')}.`,
  };
}

// =====================================================================
// (P) APAGADO hasta que Pelayo lo vea: borradores. Nada de esto sale en la app sin `encendido(clave)`.
// =====================================================================

// ---------- (42, P: 'enfermo') «Estoy enfermo» ----------
// No guarda nada (ni que está enfermo ni de qué): le dice qué hacer y le deja la pausa a un toque.
export const ENFERMO = {
  titulo: 'Si estás enfermo, lo primero es recuperarte',
  pasos: [
    'Con fiebre, malestar general, tos de pecho, vómitos o diarrea: no entrenes. Pon la semana en pausa.',
    'Con un resfriado de cuello para arriba (mocos, algo de garganta) y con fuerzas: puedes hacer la sesión más suave, sin acercarte al límite.',
    'Vuelve cuando lleves un par de días bien. La primera semana, más suave de lo normal: lo que tenías vuelve rápido.',
    'Si tienes dolor en el pecho, palpitaciones o te falta el aire, no entrenes y consulta con tu médico.',
  ],
};

// ---------- (43, P: 'molestia_sigue') El seguimiento de una molestia, a los tres y a los siete días ----------
// En este móvil solo se guarda la fecha en que lo dijo (ni la zona ni la intensidad).
export const MOLESTIA_SIGUE = [
  ['mejor', 'Mejor', 'Buena señal. Vuelve poco a poco a la carga de antes, sin prisa: que siga sin pasar de 3 sobre 10 y sin ir a más al día siguiente.'],
  ['igual', 'Igual', 'Sigue con la carga baja o con la alternativa una semana más. Si a las dos semanas no ha mejorado, que te la vean.'],
  ['peor', 'Peor', 'Para ese ejercicio y los que carguen esa zona, y consulta con un fisioterapeuta o con tu médico antes de seguir.'],
];
// dicho: 'AAAA-MM-DD' (cuándo lo dijo), respondido: los días ya contestados ([3], [3, 7]) → null | 3 | 7
export function molestiaToca({ dicho, respondido = [], hoy } = {}) {
  if (!esFecha(dicho) || !hoy) return null;
  const dias = entre(dicho, hoy);
  if (dias >= 7 && dias <= 13 && !respondido.includes(7)) return 7;
  if (dias >= 3 && dias <= 6 && !respondido.includes(3)) return 3;
  return null;
}

// ---------- (52, P: 'suave') «Esta semana la necesito suave» ----------
export const SUAVE = {
  titulo: 'Esta semana, suave',
  texto: 'Quita una serie de cada ejercicio y acaba cada serie con tres o cuatro repeticiones de margen. La app no lo cuenta como fallo: la semana que viene repites la carga de esta, sin bajar nada.',
  pedir: 'Una semana suave no te hace perder nada y, si llegas justo de sueño o de trabajo, es lo que más te conviene. Como mucho, una de cada cuatro.',
};
// notas: las suyas de tipo 'suave' ({ desde: el lunes de esa semana }) → ¿puede pedirla esta semana?
export function suaveDe(notas = [], hoy) {
  if (!hoy) return { esta: false, puede: false };
  const lunes = lunesDe(hoy);
  const fechas = (notas || []).map((n) => d10(n?.desde)).filter(esFecha);
  const esta = fechas.includes(lunes);
  return { esta, puede: !esta && !fechas.some((f) => f < lunes && entre(f, lunes) < 28), lunes };
}

// ---------- (53, P: 'dos_duras') Dos sesiones «duras» seguidas: la siguiente semana no sube ----------
// hechas: sus sesiones hechas de esa semana, en orden ([{ rpe }]) → ¿las dos últimas con 9 o más?
export const dosDuras = (hechas = []) => { const u = (hechas || []).slice(-2); return u.length === 2 && u.every((s) => Number(s?.rpe) >= 9); };

// ---------- (54, P: 'salud_al_dia') Su salud, al día: cada seis meses ----------
// fecha: cuándo contestó (o repasó) sus preguntas de salud → ¿toca repasarlas?
export const saludAlDia = ({ fecha, hoy } = {}) => !!(esFecha(d10(fecha)) && hoy && entre(d10(fecha), hoy) >= 183);
export const SALUD_AL_DIA = 'Hace seis meses que contestaste tus preguntas de salud. Si algo ha cambiado (una enfermedad, una medicación, una operación, un embarazo), actualízalas: es un minuto.';

// ---------- (55, P: 'alarma') Una señal de alarma ----------
export const ALARMA = {
  titulo: 'Para y consulta antes de seguir',
  texto: 'Dolor u opresión en el pecho, falta de aire que no cuadra con el esfuerzo, mareo, desmayo o palpitaciones no son cosas de entrenar: deja la sesión y habla con tu médico. Si es intenso o no cede en reposo, llama al 112.',
  despues: 'Cuando te lo hayan visto, sigues con tu plan donde lo dejaste. Si te dicen que pares un tiempo, pon la semana en pausa.',
};
