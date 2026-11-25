// FBE Esencial (tanda 7, «La espera»): de la reserva al lunes en que empieza. Lógica pura y pequeña.
// Quien reserva el 15/12 entra, rellena su cuestionario, elige sus días… y hasta su lunes no hay sesiones. Para que esas
// semanas no sean la misma pantalla un mes (y antes del primer cobro, que es cuando más fácil es echarse atrás), cada día
// hay UNA cosa pequeña («Lo de hoy»), una lista de lo que le falta para estar listo y, la víspera, su primera sesión.
// Nada de salud nuevo salvo lo marcado como apagado (la hoja para su médico): eso espera al visto bueno de Pelayo.

export const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
const esFecha = (x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ''));

// ---------- (61) Lo de cada día: una cosa pequeña ----------
// Cada cosa tiene su tramo en días que faltan para su lunes (de «desde» a «hasta»). La de hoy es la del tramo de hoy si
// no está hecha; si ya lo está, la primera que ya ha llegado y sigue sin hacer (solo las prácticas: el gimnasio, los avisos
// y el calendario; las demás, pasado su tramo, se dejan); y si no queda ninguna de esas, la siguiente que aún no ha llegado
// (quien va adelantado, adelanta). plan: solo con su plan ya preparado (sin él no hay ejercicios ni sesiones).
//   ejercicio: uno al día (los de su semana 1); vispera: siempre la víspera.
export const PASOS_ESPERA = [
  { id: 'porque', desde: 99, hasta: 25, titulo: 'Tu porqué', texto: 'Una frase tuya para los días que cuestan. Te la devolvemos cuando más falta haga.' },
  { id: 'gimnasio', desde: 24, hasta: 22, plan: true, recupera: true, titulo: 'Prepara tu gimnasio', texto: 'Mira si en tu gimnasio están las máquinas de tu semana 1. Si falta alguna, la app deja puesta su alternativa antes del primer día.' },
  { id: 'ejercicio', desde: 21, hasta: 17, plan: true, titulo: 'Un ejercicio al día', texto: 'Hoy, uno de tus ejercicios: su vídeo y dos cosas en las que fijarte.' },
  { id: 'partida', desde: 16, hasta: 14, titulo: 'Tu punto de partida', texto: 'Si quieres, apunta hoy tu peso y tu cintura: en tu trimestre verás cómo han cambiado. Es opcional.' },
  { id: 'calendario', desde: 13, hasta: 11, plan: true, recupera: true, titulo: 'Tus entrenos, en tu calendario', texto: 'Cada sesión con su día sale como un evento en el calendario de tu móvil, con su aviso.' },
  { id: 'ensayo', desde: 10, hasta: 8, titulo: 'Ensaya una serie', texto: 'Apunta una serie de mentira para aprender los botones antes del primer día. No se guarda nada.' },
  { id: 'companeros', desde: 7, hasta: 5, titulo: 'No empiezas solo', texto: 'Mira cuántos empezáis a la vez y, si quieres, preséntate en Equipo.' },
  { id: 'avisos', desde: 4, hasta: 3, recupera: true, titulo: '¿Te llegan los avisos?', texto: 'Mándate un aviso de prueba: si no te llega, te decimos cómo arreglarlo en tu móvil.' },
  { id: 'primer_dia', desde: 2, hasta: 2, titulo: 'Tu primer día, paso a paso', texto: 'Qué llevar, cuánto dura, qué hacer al llegar y qué hacer si la máquina está ocupada.' },
  { id: 'vispera', desde: 1, hasta: 1, plan: true, titulo: 'Mañana, tu primera sesión', texto: 'Ya la puedes ver: cuánto dura y lo importante.' },
];
export const PASO_ESPERA = Object.fromEntries(PASOS_ESPERA.map((x) => [x.id, x]));
// (73) Si entra tarde (le quedan cuatro días o menos al reservar): solo lo imprescindible
export const PASOS_CORTA = ['avisos', 'primer_dia', 'vispera'];
export const DIAS_CORTA = 4;

// faltan: días que faltan para su lunes (1 = mañana); hechos: { id: true } (ejercicio: cuántos ha visto, en «vistos»);
// conPlan: si ya tiene plan; corta: si entró tarde; ejercicios: cuántos tiene su semana 1; vistoHoy: si ya vio hoy su
// ejercicio del día. → { id, …PASO, n? (el ejercicio que toca, desde 0) } o null (no queda nada: «Todo listo»)
export function pasoDeHoy({ faltan, hechos = {}, conPlan = false, corta = false, ejercicios = 0, vistoHoy = false } = {}) {
  const f = Number(faltan);
  if (!Number.isFinite(f) || f <= 0) return null;
  const vale = (x) => (!x.plan || conPlan) && (!corta || PASOS_CORTA.includes(x.id)) && (x.id !== 'ejercicio' || ejercicios > 0);
  const hecho = (x) => (x.id === 'ejercicio' ? (Number(hechos.vistos) || 0) >= ejercicios && !vistoHoy : !!hechos[x.id]);
  const con = (x) => (x.id === 'ejercicio' ? { ...x, n: Math.min(ejercicios - 1, Math.max(0, (Number(hechos.vistos) || 0) - (vistoHoy ? 1 : 0))), visto: vistoHoy } : { ...x });
  const lista = PASOS_ESPERA.filter(vale);
  if (f === 1 && conPlan) return con(PASO_ESPERA.vispera);
  const deHoy = lista.find((x) => x.desde >= f && f >= x.hasta);
  if (deHoy && !hecho(deHoy)) return con(deHoy);
  const atrasada = lista.find((x) => x.recupera && x.desde >= f && !hecho(x));
  if (atrasada) return con(atrasada);
  // (adelanta: la siguiente que aún no ha llegado, sin la víspera, que es de su día)
  const siguiente = lista.find((x) => x.hasta < f && x.desde < f && x.id !== 'vispera' && !hecho(x));
  return siguiente ? con(siguiente) : null;
}

// ---------- (62) Lo que le falta para estar listo ----------
// estado: el de estadoEsencial ('cuestionario' | 'salud' | 'rutina' | 'visto_bueno' | 'revision' | 'preparando' | 'espera');
// pideVistoBueno: su cribado pide valoración médica; dias, avisos, gimnasio: true si ya lo tiene.
export function listaListo({ estado = null, pideVistoBueno = false, conPlan = false, dias = false, avisos = false, gimnasio = false } = {}) {
  const sinCuestionario = ['cuestionario', 'salud', 'rutina'].includes(estado);
  const items = [
    { id: 'cuestionario', titulo: estado === 'rutina' ? 'Elegir tu rutina' : 'Tu cuestionario', hecho: !sinCuestionario },
    ...(pideVistoBueno ? [{ id: 'visto_bueno', titulo: 'El visto bueno de tu médico', hecho: !['visto_bueno', 'revision'].includes(estado) && !sinCuestionario, espera: estado === 'revision' }] : []),
    { id: 'dias', titulo: 'Tus días', hecho: conPlan && !!dias, sinPlan: !conPlan },
    { id: 'avisos', titulo: 'Los avisos', hecho: !!avisos },
    { id: 'gimnasio', titulo: 'Tu gimnasio', hecho: conPlan && !!gimnasio, sinPlan: !conPlan },
  ];
  const quedan = items.filter((x) => !x.hecho).length;
  return { items, quedan, listo: quedan === 0 };
}
export const tituloListo = (quedan) => (quedan === 0 ? 'Todo listo para tu lunes' : `Te ${quedan === 1 ? 'queda 1 cosa' : `quedan ${quedan} cosas`} para estar listo`);

// ---------- (61 y 73) La espera de hoy ----------
// hoy, inicio: 'AAAA-MM-DD'; alta: el día en que se dio de alta (atletas.fecha_alta) → { faltan, corta, titulo } o null
// (ya ha empezado o no hay fecha)
export function esperaDe({ hoy, inicio, alta = null } = {}) {
  if (!esFecha(hoy) || !esFecha(inicio)) return null;
  const faltan = diasEntre(hoy, inicio);
  if (faltan <= 0) return null;
  const alReservar = esFecha(alta) ? diasEntre(String(alta).slice(0, 10), inicio) : faltan;
  const corta = alReservar <= DIAS_CORTA;
  const cuando = faltan === 1 ? 'Mañana empiezas' : `Faltan ${faltan} días`;
  return { faltan, corta, titulo: corta ? `${cuando}: lo imprescindible` : 'Hasta tu lunes', cuando };
}

// ---------- (65) Un ejercicio al día: dos cosas en las que fijarse ----------
// Salen de las notas de Pelayo del ejercicio (sus «instrucciones»: una por línea o por frase); sin notas, la de la guía y
// el vídeo. Nada inventado. → [frase, frase]
export function dosCosas(ejercicio = {}, nota = null) {
  // (una por línea o por frase; sin viñetas ni números delante. Sin «lookbehind» ni letras con tilde en las expresiones:
  // lo primero no lo entienden los iPhone antiguos y lo segundo rompe el empaquetado)
  const trozos = String(ejercicio?.instrucciones || '').replace(/([.!?])\s+/g, '$1\n').split(/\n+/)
    .map((t) => t.replace(/^\s*(?:\d+[.)]\s+|[-*]\s+)/, '').replace(/^[^\p{L}\p{N}]+/u, '').trim()).filter((t) => t.length >= 8);
  const out = trozos.slice(0, 2).map((t) => (/[.!?]$/.test(t) ? t : `${t}.`));
  if (out.length < 2 && nota) out.push(/[.!?]$/.test(nota) ? nota : `${nota}.`);
  if (out.length < 2) out.push('Mira el vídeo entero una vez antes de tu primer día: irás con el gesto en la cabeza.');
  return out.slice(0, 2);
}

// ---------- (66) Tu primer día, paso a paso ----------
// (de lo que ya dicen la guía, las preguntas frecuentes y la bienvenida: nada nuevo de salud)
export function primerDia({ minutos = null, primeras = true } = {}) {
  return [
    { id: 'llevar', titulo: 'Qué llevar', texto: 'Ropa cómoda, agua y el móvil con la app: ahí tienes tu sesión y ahí apuntas cada serie. Funciona aunque el gimnasio no tenga cobertura.' },
    { id: 'dura', titulo: 'Cuánto dura', texto: minutos ? `Unos ${minutos} minutos.${primeras ? ' La semana 1 es una serie de cada ejercicio: media hora y a casa.' : ''}` : primeras ? 'La semana 1 es una serie de cada ejercicio: media hora y a casa.' : 'Lo verás en la portada de la sesión, antes de empezar.' },
    { id: 'llegar', titulo: 'Al llegar', texto: 'Pide a alguien de sala que te ajuste las máquinas: son cinco minutos y te ahorran un mes de dudas. Luego abre la sesión en Hoy y sigue el orden.' },
    { id: 'peso', titulo: 'El peso', texto: 'El primer día no lo sabe nadie: empieza con poco peso, haz doce repeticiones y pregúntate cuántas más habrías podido hacer.' },
    { id: 'ocupada', titulo: 'Si la máquina está ocupada', texto: 'Haz el siguiente ejercicio y vuelve después, o usa su alternativa: cada ejercicio trae una, con las mismas series y repeticiones.' },
  ];
}

// ---------- (67) ¿Te llegan los avisos? ----------
// Lo que contesta la base al aviso de prueba ('ok' | 'sin_canal' | 'espera') y, si no llega, qué mirar en su móvil
export const PRUEBA_AVISO = {
  ok: 'Te acabamos de mandar uno. ¿Te ha llegado?',
  sin_canal: 'Ahora mismo no tienes los avisos activados ni en el móvil ni por correo: actívalos y vuelve a probar.',
  espera: 'Te mandamos uno hace un momento: espera un minuto y vuelve a probar.',
};
export const ARREGLAR_AVISOS = {
  ios: [
    'En iPhone, los avisos solo llegan a la app instalada: ábrela desde el icono de tu pantalla de inicio, no desde Safari.',
    'En Ajustes › Notificaciones, busca la app y deja «Permitir notificaciones» activado.',
    'Mira que no tengas activado un modo de concentración (No molestar, Dormir…) a esa hora.',
  ],
  android: [
    'En Ajustes › Aplicaciones › Chrome › Notificaciones, deja permitidas las de esta web (o las de la app, si la instalaste).',
    'Si tu móvil ahorra batería, quita ese ahorro para Chrome o para la app: si no, a veces los retrasa.',
    'Mira que no tengas activado «No molestar» a esa hora.',
  ],
  otro: [
    'Mira que el navegador tenga permitidos los avisos de esta web (el candado junto a la dirección).',
    'Si no te llegan nunca, actívalos por correo: te llegarán como mucho uno por hora.',
  ],
};
export const sistemaDe = (ua = '') => (/iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'otro');

// ---------- (71) No empiezas solo ----------
// n: cuántos empiezan ese lunes (sale de la base; null si son menos de tres o sin la migración 102)
export function textoCompaneros(n, inicio, fechaLarga = (x) => x) {
  if (!Number.isFinite(Number(n)) || Number(n) < 3) return null;
  return `Empezáis ${Number(n)} el ${fechaLarga(inicio)}.`;
}

// ---------- (68) Tu punto de partida ----------
const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
// → { peso: kg | null, cintura: cm | null } si vale; null si nada vale (como en el resto de la app: 30-300 kg y 40-200 cm)
export function validarPartida({ peso = '', cintura = '' } = {}) {
  const p = num(peso), c = num(cintura);
  const pOk = String(peso ?? '').trim() === '' ? null : p != null && p >= 30 && p <= 300 ? Math.round(p * 10) / 10 : undefined;
  const cOk = String(cintura ?? '').trim() === '' ? null : c != null && c >= 40 && c <= 200 ? Math.round(c * 10) / 10 : undefined;
  if (pOk === undefined || cOk === undefined) return { error: pOk === undefined ? 'Revisa el peso: entre 30 y 300 kg.' : 'Revisa la cintura: entre 40 y 200 cm.' };
  if (pOk == null && cOk == null) return { error: 'Apunta al menos una de las dos.' };
  return { peso: pOk, cintura: cOk };
}
// En «Tu trimestre»: lo de antes (lo primero desde una semana antes de su lunes) y lo de ahora (lo último), si hay dos
// medidas distintas en el tiempo. registros: [{ fecha, valor }] → { antes, ahora, fechaAntes, fechaAhora } o null
export function antesYAhora(registros = [], inicio) {
  const xs = (registros || []).filter((r) => esFecha(String(r.fecha).slice(0, 10)) && Number.isFinite(Number(r.valor)))
    .map((r) => ({ fecha: String(r.fecha).slice(0, 10), valor: Number(r.valor) })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (xs.length < 2) return null;
  const desde = esFecha(inicio) ? new Date(Date.parse(`${inicio}T12:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10) : xs[0].fecha;
  const a = xs.find((r) => r.fecha >= desde) || null;
  const z = xs[xs.length - 1];
  if (!a || a.fecha === z.fecha) return null;
  return { antes: a.valor, ahora: z.valor, fechaAntes: a.fecha, fechaAhora: z.fecha };
}

// ---------- (69) Tu porqué, de vuelta la primera semana que falla ----------
// semanas: las de su plan ya terminadas [{ numero, fecha_inicio, hechas, total, pausa }] (de la más antigua a la última);
// → la primera semana fallada (con sesiones sin hacer y sin pausa) si es la última terminada; null si no
export function primeraFallada(semanas = []) {
  const xs = (semanas || []).filter((w) => Number(w.total) > 0 && !w.pausa);
  const i = xs.findIndex((w) => Number(w.hechas) < Number(w.total));
  return i >= 0 && i === xs.length - 1 ? xs[i] : null;
}
export const textoPorque = (porque) => (porque ? `Lo escribiste antes de empezar: «${porque}». Esta semana es otra: empieza por la primera sesión.` : null);

// ---------- (70, apagado) Sus kilos de partida (quien ya entrena) ----------
// kilos: { ejercicioId: '40' } → { ejercicioId: 40 } (solo lo que vale: de 1 a 500 kg, de medio en medio)
export function limpiarKilos(kilos = {}) {
  const out = {};
  for (const [id, v] of Object.entries(kilos || {})) {
    const n = num(v);
    if (id && n != null && n >= 1 && n <= 500) out[id] = Math.round(n * 2) / 2;
  }
  return out;
}
export const textoKilosPartida = (kg) => (Number(kg) > 0 ? `Antes de empezar apuntaste que ahora mueves ${String(kg).replace('.', ',')} kg: úsalo como referencia y busca el peso con el que te sobren las que pide la serie.` : null);

// ---------- (74, apagado: es de salud) Qué pedirle a tu médico ----------
export function textoMedico({ dias = 2, minutos = 45 } = {}) {
  return `Voy a empezar un programa de fuerza de ${dias} días por semana, de unos ${minutos} minutos, con máquinas y mancuernas y una progresión poco a poco. Al contestar las preguntas de salud (las del cribado de la ACSM) me ha salido que conviene que me valore un médico antes de empezar. ¿Hay algún motivo para que no lo haga, o alguna precaución que deba tener?`;
}
export const MIENTRAS_MEDICO = [
  'Tu plan espera: en cuanto marques en Hoy que tienes el visto bueno y Pelayo lo confirme, la app te lo prepara.',
  'Mientras, puedes ver tus ejercicios y sus vídeos.',
  'Si tu médico te pone alguna limitación, escribe a Pelayo antes de empezar.',
];

// ---------- (77) En el panel: listos para el lunes ----------
// alta: la fila de esencial_alta_estado() (con la 102: dias, gimnasio, probado) → [lo que le falta]
export function faltaDe(a = {}, hoy) {
  const falta = [];
  if (!a.activado_en) falta.push('cuenta');
  if (!a.cuestionario_en) falta.push('cuestionario');
  if (a.resultado && a.resultado !== 'sin_valoracion' && !a.visto_bueno_en) falta.push(a.visto_bueno_pedido_en ? 'confirmar visto bueno' : 'visto bueno');
  if (a.cuestionario_en && !a.plan_inicio) falta.push('plan');
  if (a.plan_inicio && a.dias === false) falta.push('días');
  if (!a.push && !a.email) falta.push('avisos');
  if (a.plan_inicio && a.gimnasio === false) falta.push('gimnasio');
  return falta;
}
// altas: las filas de esencial_alta_estado(); vivos: Map de atleta_id → nombre (sin bajas) → { proximo, lista, listos, total }
// (solo los que empiezan en los próximos 28 días)
export function listosLunes(altas = [], vivos = new Map(), hoy) {
  const xs = (altas || []).filter((a) => vivos.has(a.atleta_id) && esFecha(a.inicio) && diasEntre(hoy, a.inicio) > 0 && diasEntre(hoy, a.inicio) <= 28);
  if (!xs.length) return null;
  const proximo = xs.map((a) => a.inicio).sort()[0];
  const delLunes = xs.filter((a) => a.inicio === proximo);
  const lista = delLunes.map((a) => ({ atleta_id: a.atleta_id, nombre: vivos.get(a.atleta_id), falta: faltaDe(a, hoy) }))
    .sort((a, b) => b.falta.length - a.falta.length || String(a.nombre).localeCompare(String(b.nombre), 'es'));
  return { proximo, faltan: diasEntre(hoy, proximo), lista, listos: lista.filter((x) => !x.falta.length).length, total: lista.length };
}
