// Las imágenes de la app (ilustraciones generadas para FBE): qué imagen toca en cada sitio y qué archivos servir.
// La lista de archivos está en datos/imagenes.json (la escribe la herramienta de conversión: id → proporción y un
// archivo WebP por ancho, con su huella en el nombre). Aquí no hay nada del navegador: se prueba en test/imagenes.test.mjs.
// (v0.207, rendimiento) Las dos listas (datos/imagenes.json, unos 160 KB, y la de los ejercicios) van en su propio trozo,
// fuera del arranque: main.jsx las pide al abrir la app, a la vez que lo demás, y espera a tenerlas antes de pintar (así no
// cambia ningún dibujo por su ilustración al llegar). El service worker las guarda con su huella: al actualizar la app,
// si no han cambiado, no se vuelven a bajar. Hasta que llegan (o si no llegan), sin ilustraciones: los dibujos de siempre.
const LISTA = {};
const EJERCICIOS_IMG = { porId: {}, porNombre: {} };
let cargando = null;
// (las de un trozo que trae su propia lista, como las de las rutinas de FBE Esencial)
export const anadirImagenes = (extra) => { Object.assign(LISTA, extra); };
export function cargarListaImagenes() {
  cargando ||= import('../datos/lista-imagenes.js').then((m) => {
    Object.assign(LISTA, m.LISTA);
    Object.assign(EJERCICIOS_IMG, m.EJERCICIOS_IMG);
    IMAGENES.splice(0, IMAGENES.length, ...Object.keys(LISTA));
    return true;
  }).catch((e) => { cargando = null; throw e; });
  return cargando;
}
import { patronEjercicio } from './diseno.js';

// ---------- La portada de la sesión ----------
// Siete portadas: empuje, tirón, pierna, core, full body, cardio y movilidad. Para una sesión de fuerza se cuentan sus
// series por familia de movimiento (el patrón de cada ejercicio, el mismo de sus pictogramas): si la pierna y el torso
// (empuje más tirón) se llevan cada uno al menos un cuarto, es full body; si no, la familia con más series. Los bíceps
// cuentan como tirón y los tríceps como empuje. Sin ejercicios que contar, full body (la más genérica).
// Con las 249 sesiones de la copia del 5/11: 87 full body, 74 empuje, 62 pierna, 26 tirón.
export const FAMILIAS_PORTADA = ['empuje', 'tiron', 'pierna', 'core', 'fullbody', 'cardio', 'movilidad'];
const FAMILIA = { empuje_h: 'empuje', empuje_v: 'empuje', tiron_h: 'tiron', tiron_v: 'tiron', sentadilla: 'pierna', bisagra: 'pierna', unilateral: 'pierna', pierna: 'pierna', core: 'core' };
const BRAZO = { biceps: 'tiron', triceps: 'empuje' };
export const MIN_MEZCLA = 0.25;

export function familiaPortada({ tipo = 'fuerza', pautas = [], cardio = false } = {}) {
  if (tipo === 'cardio') return 'cardio';
  if (tipo === 'movilidad') return 'movilidad';
  const series = { empuje: 0, tiron: 0, pierna: 0, core: 0 };
  for (const p of pautas || []) {
    const n = Number(p?.series) || 0;
    if (n <= 0) continue;
    const e = p.ejercicio || p;
    const grupos = Array.isArray(e.grupos_musculares) ? e.grupos_musculares : [];
    const f = FAMILIA[patronEjercicio(e.nombre || '', grupos, e.tipo || [])] || BRAZO[grupos[0]];
    if (f) series[f] += n;
  }
  const total = series.empuje + series.tiron + series.pierna + series.core;
  // Una sesión «de fuerza» que solo lleva el cardio pautado
  if (!total) return cardio ? 'cardio' : 'fullbody';
  const torso = series.empuje + series.tiron;
  if (series.pierna / total >= MIN_MEZCLA && torso / total >= MIN_MEZCLA) return 'fullbody';
  // La que más; a igualdad, en este orden
  return ['empuje', 'tiron', 'pierna', 'core'].reduce((a, b) => (series[b] > series[a] ? b : a));
}

// (imágenes, bloque Q) Una sesión de cardio con su modalidad lleva la portada de esa modalidad (la pista, el camino, la
// bici, la elíptica, el remo, la piscina o la comba); «Otro» o sin modalidad, la de cardio de siempre
const CARDIO_IMG = { carrera: 'carrera', andar: 'andar', bici: 'bici', eliptica: 'eliptica', remo: 'remo', nadar: 'nadar', cuerda: 'comba' };
export const MODALIDADES_IMG = Object.keys(CARDIO_IMG);
// (imágenes, tanda 8) Cada familia tiene tres portadas (la de siempre, -2 y -3). Con `semilla` (el id de la sesión), una
// de las tres, siempre la misma para esa sesión: como cada semana sus sesiones son otras, la portada va cambiando sin
// saltar a mitad de semana. Si la variante no está, la de siempre.
export function imagenPortada(familia, modalidad = null, semilla = null) {
  if (!familia) return null;
  if (familia === 'cardio' && CARDIO_IMG[modalidad]) return `cardio-${CARDIO_IMG[modalidad]}`;
  const base = `sesion-${familia}`;
  if (semilla == null || semilla === '') return base;
  let h = 0;
  for (const c of String(semilla)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const v = h % 3;
  const id = v ? `${base}-${v + 1}` : base;
  return LISTA[id] ? id : base;
}

// ---------- Los hábitos ----------
// Una por icono de hábito (logica/habitos.js: ICONOS_HABITO); «Otro» (libre) y lo que no se conozca, la de las piedras
const HABITOS = ['pasos', 'proteina', 'agua', 'sueno', 'movilidad', 'verdura'];
export function imagenHabito(icono) { return `habito-${HABITOS.includes(icono) ? icono : 'otro'}`; }

// ---------- Los grupos musculares ----------
// La estatua de su grupo principal (el primero de grupos_musculares, el que cuenta 1 serie); sin grupo conocido, nada
const GRUPOS_IMG = ['pectoral', 'espalda', 'deltoides', 'cuadriceps', 'gluteo', 'isquiotibiales', 'biceps', 'triceps', 'abdominales', 'gemelo', 'antebrazo', 'aductores', 'lumbares'];
export function imagenGrupo(grupo) {
  const g = Array.isArray(grupo) ? grupo[0] : grupo;
  return GRUPOS_IMG.includes(g) ? `grupo-${g}` : null;
}

// ---------- Las estanterías de «Aprende» ----------
// La tarjeta de una guía: la estatua de su grupo si lo tiene; si no, la de su estantería (la brújula para empezar, el
// rack para entrenar, el plato, la almohada, el corazón y los libros). Las de «Músculo a músculo» sin grupo, el rack.
const ESTANTES_IMG = { empieza: 'guia-empieza', entrenar: 'guia-entrenar', musculos: 'guia-entrenar', comer: 'guia-comer', cabeza: 'guia-cabeza', salud: 'guia-salud', mas: 'guia-mas' };
export const imagenEstante = (estante) => ESTANTES_IMG[estante] || 'guia-mas';
// La portada de cada guía (la cabecera del lector, 12:5) y su recorte cuadrado (la tarjeta); sin portada, la de su estantería
export const PORTADAS_GUIA = ['bienvenida', 'manual', 'introduccion', 'rutinas', 'deload', 'estancamiento', 'volver', 'cardio', 'dieta-flexible', 'composicion', 'suplementacion', 'sueno', 'motivacion', 'salud-cardiometabolica', 'dislipidemia', 'mujer', 'mitos', 'proteina', 'medidas', 'primeros-dias', 'rodilla', 'baremos', 'volver-40', 'calentamiento', 'material', 'viaje', 'diccionario', 'dolor', 'seguridad', 'creatina', 'numero-proteina', 'suplementos-12', 'cuatro-formulas', 'bebidas-alcohol', 'definicion', 'comer-fuera', 'hambre', 'guardias', 'estres', 'tension-pesas', 'analitica', 'grasa-visceral', 'despues-de-comer', 'alcohol', 'sarcopenia', 'hospital'];
export const imagenPortadaGuia = (clave) => (PORTADAS_GUIA.includes(clave) ? `portada-${clave}` : null);
export const imagenGuia = (g, estante) => imagenGrupo(g?.grupo) || (imagenPortadaGuia(g?.clave) ? `${imagenPortadaGuia(g.clave)}-cuadrada` : null) || imagenEstante(estante);
// El mito de la semana (la tarjeta de Hoy) y los cinco pasos del cuestionario inicial
export const IMAGEN_MITO = 'mito-semana';
const PASOS_CUESTIONARIO = ['objetivo', 'tiempo', 'lugar', 'salud', 'lesiones'];
export const imagenPasoCuestionario = (clave) => (PASOS_CUESTIONARIO.includes(clave) ? `cuestionario-${clave}` : null);

// ---------- Cada ejercicio de la biblioteca ----------
// La figura maniquí en el momento clave del ejercicio (claude/imagenes-ejercicios.md). Por el id del ejercicio de la
// biblioteca de FBE; si no está (otra biblioteca, la genérica, la demo, un ejercicio renombrado en otra copia), por el
// nombre sin tildes ni mayúsculas. Sin imagen, nada: la ficha sigue con la estatua del grupo.
const normalNombre = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export function imagenEjercicio(ej) {
  if (!ej) return null;
  return EJERCICIOS_IMG.porId[ej.id] || EJERCICIOS_IMG.porNombre[normalNombre(ej.nombre)] || null;
}

// ---------- Las comidas ----------
// Una por toma (logica/comidas.js: TOMAS); «Antes de dormir», la de la cena
const COMIDAS = { desayuno: 'desayuno', media_manana: 'media-manana', comida: 'comida', merienda: 'merienda', cena: 'cena', recena: 'cena' };
export function imagenComida(toma) { return COMIDAS[toma] ? `comida-${COMIDAS[toma]}` : null; }

// ---------- Las figuras de dentro de una guía ----------
// (imágenes, tanda 11) Una tira de figuras de ejemplo al principio de una guía. Hoy solo la de calentamiento: diez
// movimientos de movilidad. Son ejemplos para hacerse una idea; no cambian lo que el coach haya puesto en la sesión.
const TIRAS_GUIA = {
  calentamiento: {
    titulo: 'Movimientos de ejemplo',
    figuras: [
      ['mov-gato-camello', 'Gato-camello'], ['mov-rotacion-toracica', 'Rotación torácica'], ['mov-cadera-90-90', 'Cadera 90/90'],
      ['mov-flexor-cadera', 'Flexor de cadera'], ['mov-tobillo-pared', 'Tobillo a la pared'], ['mov-hombro-goma', 'Hombros con goma'],
      ['mov-sentadilla-profunda', 'Sentadilla profunda'], ['mov-zancada-rotacion', 'Zancada con rotación'],
      ['mov-isquios-dinamico', 'Isquios dinámico'], ['mov-circulos-brazos', 'Círculos de brazos'],
    ],
  },
  material: {
    titulo: 'Material para entrenar en casa',
    figuras: [
      ['material-mancuernas', 'Mancuernas'], ['material-gomas', 'Gomas'], ['material-kettlebell', 'Kettlebell'],
      ['material-barra-dominadas', 'Barra de dominadas'], ['material-esterilla', 'Esterilla'], ['material-banco', 'Banco'],
      ['material-anillas', 'Suspensión (TRX)'], ['material-barra-discos', 'Barra y discos'],
    ],
  },
};
// El suplemento de la lista de FBE (por su clave; los que el atleta escribe con sus palabras no llevan)
const SUPLEMENTOS_IMG = ['creatina', 'proteina', 'cafeina', 'vitamina-d', 'omega-3', 'magnesio', 'citrulina', 'beta-alanina'];
export function imagenSuplemento(s) { return s?.clave && SUPLEMENTOS_IMG.includes(s.clave) ? `supl-${s.clave}` : null; }
// El objetivo del cuestionario (logica/cuestionario.js: fuerza, musculo, perder_grasa, salud, rendimiento, otro)
const OBJETIVOS_IMG = ['fuerza', 'musculo', 'perder_grasa', 'salud', 'rendimiento', 'otro'];
export function imagenObjetivo(clave) { return OBJETIVOS_IMG.includes(clave) ? `objetivo-${clave.replace(/_/g, '-')}` : null; }
// Los días especiales: lo que más pesa en «¿Cómo llegas hoy?» cuando el día sale flojo o difícil (molestias, mala noche
// o sin energía); la semana difícil, la guardia y la pausa por vacaciones llevan el suyo donde se avisan.
export function imagenDia(prep) {
  if (!prep) return null;
  if (prep.molestias === 1) return 'dia-molestias';
  if (prep.sueno === 1) return 'dia-mala-noche';
  if (prep.energia === 1) return 'dia-enfermo';
  return null;
}
// El material de «¿Dónde entrenas hoy?» (logica/material.js): los que tienen dibujo
const MATERIAL_IMG = { mancuernas: 'mancuernas', gomas: 'gomas', kettlebells: 'kettlebell', dominadas: 'barra-dominadas', banco: 'banco', barra: 'barra-discos' };
export function imagenMaterial(clave) { return MATERIAL_IMG[clave] ? `material-${MATERIAL_IMG[clave]}` : null; }
export function tiraGuia(clave) { return TIRAS_GUIA[clave] || null; }

// ---------- El plato tipo de una receta sin foto ----------
// (imágenes, tanda 11) Cada atleta tiene sus recetas, así que no se enlazan una a una: se reconoce la familia por el
// nombre («Lentejas estofadas…» -> legumbres). Gana lo que se nombra antes («Tostadas con huevo» -> tostadas); la carne
// con arroz o con pasta es un plato de arroz o de pasta. Si no se reconoce nada, null: se queda la escena de su toma.
const PLATOS = [
  ['batido', /\b(batidos?|smoothies?)\b/],
  ['avena', /\b(avena|porridge|gachas|overnight)\b/],
  ['yogur', /\b(yogur(es)?|yogurt|skyr|kefir|queso batido|queso fresco batido)\b/],
  ['tostadas', /\b(tostadas?|tostas?)\b/],
  ['bocadillo', /\b(bocadillos?|bocatas?|sandwich(es)?|wraps?|burritos?|fajitas?)\b/],
  ['ensalada', /\b(ensaladas?|ensaladilla|poke)\b/],
  ['pasta', /\b(pasta|espaguetis?|macarrones|tallarines|fideos|lasana|noodles)\b/],
  ['legumbres', /\b(lentejas?|garbanzos?|alubias?|fabada|potaje|hummus|judiones)\b/],
  ['arroz', /\b(arroz|risotto|paella)\b/],
  ['huevos', /\b(tortillas?|huevos?|revueltos?|claras)\b/],
  ['pescado', /\b(pescado|salmon|merluza|bacalao|atun|lubina|dorada|gambas?|langostinos?|sepia|calamar(es)?|emperador)\b/],
  ['carne', /\b(pollo|pavo|ternera|cerdo|lomo|solomillo|filetes?|carne|hamburguesas?|albondigas?|entrecot|chuletas?)\b/],
];
export function imagenReceta(nombre) {
  const n = normalNombre(nombre);
  if (!n) return null;
  let mejor = null;
  for (const [id, re] of PLATOS) {
    const m = re.exec(n);
    if (m && (!mejor || m.index < mejor.en)) mejor = { id, en: m.index };
  }
  if (!mejor) return null;
  if (mejor.id === 'carne' || mejor.id === 'pescado') {
    const base = PLATOS.find(([id, re]) => (id === 'arroz' || id === 'pasta') && re.test(n));
    if (base) return `receta-${base[0]}`;
  }
  return `receta-${mejor.id}`;
}

// ---------- Las tarjetas para compartir ----------
// La de la propia tarjeta (d.fondo: el bloque, el mes del equipo o el tuyo) o, en la de una sesión, la del récord si lo
// hubo y la de la barra si no
export const FONDOS_TARJETA = ['sesion', 'record', 'mes', 'bloque', 'racha'];
export function fondoTarjeta(d = {}) {
  if (FONDOS_TARJETA.includes(d.fondo)) return `compartir-${d.fondo}`;
  if (d.records?.length) return 'compartir-record';
  // (bloque Q) una sesión de cardio, con la portada de su modalidad
  if (d.cardio && CARDIO_IMG[d.cardio.modalidad]) return `cardio-${CARDIO_IMG[d.cardio.modalidad]}`;
  return 'compartir-sesion';
}
// (v0.187) Los fondos que se pueden elegir en la hoja de compartir: [id, nombre, grupo]. Los cinco primeros son los de
// siempre; los demas salen en la lista segun van llegando sus imagenes (los que no estan, no se ofrecen).
export const FONDOS_COMPARTIR = [
  ['compartir-sesion', 'Barra y magnesio', 'sesion'], ['compartir-record', 'Luz dorada', 'record'], ['compartir-racha', 'Brasas', 'racha'],
  ['compartir-mes', 'Fases de la luna', 'tiempo'], ['compartir-bloque', 'Cordillera', 'tiempo'],
  ['compartir-rack', 'Rack', 'sesion'], ['compartir-discos', 'Discos', 'sesion'], ['compartir-mancuernas', 'Mancuernas', 'sesion'], ['compartir-magnesio', 'Magnesio', 'sesion'],
  ['compartir-banco', 'Banco', 'sesion'], ['compartir-barra-suelo', 'Barra en el suelo', 'sesion'], ['compartir-kettlebells', 'Kettlebells', 'sesion'],
  ['compartir-trofeo', 'Trofeo', 'record'], ['compartir-cima', 'Cima', 'record'], ['compartir-confeti', 'Confeti', 'record'], ['compartir-barra-oro', 'Barra arriba', 'record'], ['compartir-estrella', 'Estrella', 'record'],
  ['compartir-hoguera', 'Hoguera', 'racha'], ['compartir-cadena', 'Cadena', 'racha'], ['compartir-huellas', 'Huellas', 'racha'], ['compartir-escalera', 'Escalera', 'racha'],
  ['compartir-luna', 'Luna llena', 'tiempo'], ['compartir-amanecer', 'Amanecer', 'tiempo'], ['compartir-sendero', 'Sendero', 'tiempo'], ['compartir-bosque', 'Bosque', 'tiempo'], ['compartir-constelacion', 'Constelación', 'tiempo'],
  ['compartir-pista', 'Pista', 'cardio'], ['compartir-carretera', 'Carretera', 'cardio'], ['compartir-zapatillas', 'Zapatillas', 'cardio'], ['compartir-bici', 'Bici', 'cardio'],
  ['compartir-manada', 'Manada', 'equipo'], ['compartir-lobo-luna', 'Lobo y luna', 'equipo'], ['compartir-lobos-nieve', 'Lobos en la nieve', 'equipo'], ['compartir-fogata-equipo', 'Fogata', 'equipo'], ['compartir-gimnasio', 'Gimnasio de noche', 'equipo'],
];
export const fondoValido = (id) => id === 'auto' || id === '' || FONDOS_COMPARTIR.some(([k]) => k === id);
// Los que tienen imagen (lista: la de imagenes.json), con los del grupo de la tarjeta delante
export function fondosDisponibles(grupo = null, lista = LISTA) {
  const hay = FONDOS_COMPARTIR.filter(([id]) => Object.prototype.hasOwnProperty.call(lista, id) && lista[id]?.archivos);
  return grupo ? [...hay.filter((f) => f[2] === grupo), ...hay.filter((f) => f[2] !== grupo)] : hay;
}
// El fondo de una tarjeta de logro, segun lo que cuenta (si su imagen aun no esta, el de siempre de ese tipo o ninguno)
const FONDO_LOGRO = { record: ['compartir-record'], logro: ['compartir-record'], racha: ['compartir-racha'], semana: ['compartir-mes'], plan: ['compartir-mes'], mes: ['compartir-mes'], anio: ['compartir-bloque'],
  comparativa: ['compartir-bloque'], reto: ['compartir-manada', 'compartir-bloque'], equipo: ['compartir-manada', 'compartir-mes'] };
export function fondoLogro(d = {}, lista = LISTA) {
  if (FONDOS_TARJETA.includes(d.fondo)) return `compartir-${d.fondo}`;
  const c = FONDO_LOGRO[d.llama ? 'racha' : d.tipo] || [];
  return c.find((id) => Object.prototype.hasOwnProperty.call(lista, id)) || null;
}
// El grupo de fondos que le va a una tarjeta (para ponerlos delante en la lista)
export function grupoFondo(d = {}, tipo = 'sesion') {
  if (d.cardio) return 'cardio';
  if (tipo === 'record' || tipo === 'logro' || d.records?.length) return 'record';
  if (tipo === 'racha' || d.llama) return 'racha';
  if (tipo === 'equipo' || tipo === 'reto') return 'equipo';
  return tipo === 'sesion' ? 'sesion' : 'tiempo';
}
// Lo elegido en la hoja: 'auto' (el de la tarjeta), '' (sin dibujo) o uno de la lista (si no existe, el de la tarjeta)
export function fondoElegido(elegido, porDefecto, lista = LISTA) {
  if (elegido === '') return null;
  if (elegido && elegido !== 'auto' && Object.prototype.hasOwnProperty.call(lista, elegido) && FONDOS_COMPARTIR.some(([k]) => k === elegido)) return elegido;
  return porDefecto || null;
}
// Dónde va el motivo de un fondo apaisado al recortarlo para una tarjeta vertical (0 izquierda, 1 derecha): las de
// cardio lo llevan a la derecha
export function focoFondo(id) { return String(id || '').startsWith('cardio-') ? 0.8 : 0.5; }

// ---------- Las medallas ----------
// Una por logro (logica/logros.js) y nivel: bronce, plata, oro y diamante (el cuarto nivel)
const MEDALLA_DE = { sesiones: 'constancia', racha: 'semanas', toneladas: 'toneladas', records: 'records', videos: 'tecnica', checkins: 'checkins', peso: 'bascula' };
const NIVEL_IMG = [null, 'bronce', 'plata', 'oro', 'diamante'];
export function imagenMedalla(logro, nivel) {
  return MEDALLA_DE[logro] && NIVEL_IMG[nivel] ? `medalla-${MEDALLA_DE[logro]}-${NIVEL_IMG[nivel]}` : null;
}
// El archivo para un tamaño en pantalla (en px): el más pequeño que llegue a tres veces ese tamaño, o el mayor
export function archivoPara(id, tam, lista = LISTA) {
  const x = id && Object.prototype.hasOwnProperty.call(lista, id) ? lista[id] : null;
  if (!x?.archivos) return null;
  const anchos = Object.keys(x.archivos).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  if (!anchos.length) return null;
  return x.archivos[anchos.find((a) => a >= tam * 3) || anchos[anchos.length - 1]];
}

// ---------- Los meses ----------
// Un paisaje por mes del año: «2026-10» (o una fecha «2026-10-31») → mes-10
export function imagenMes(mes) {
  const m = /^\d{4}-(\d{2})/.exec(String(mes || ''));
  return m && Number(m[1]) >= 1 && Number(m[1]) <= 12 ? `mes-${m[1]}` : null;
}

// ---------- El check-in ----------
// Una franja por apartado del paso que se está contestando (molestias: la bolsa de frío, la cinta y la venda); el repaso,
// la de inicio; las respuestas ya enviadas, el avión de papel.
const CHECKIN_DE = {
  peso: 'medidas', medidas: 'medidas',
  sueno: 'descanso', energia: 'descanso', recuperacion: 'descanso',
  motivacion: 'animo', molestias: 'molestias',
  adherencia: 'alimentacion', saciedad: 'alimentacion', satisfaccion: 'alimentacion',
  reloj: 'inicio', notas: 'inicio',
};
export function imagenPasoCheckin(paso, { revision = false, enviado = false } = {}) {
  if (revision) return enviado ? 'checkin-enviado' : 'checkin-inicio';
  const id = String(paso || '');
  if (id.startsWith('p-')) return 'checkin-inicio'; // las preguntas de su coach
  return CHECKIN_DE[id] ? `checkin-${CHECKIN_DE[id]}` : null;
}

// ---------- Las celebraciones ----------
export const CELEBRACIONES = ['record', 'semana', 'bloque', 'primera', 'racha'];
export function imagenCelebracion(que) { return CELEBRACIONES.includes(que) ? `celebra-${que}` : null; }
// El sello del resumen de una sesión: récord si lo ha habido; si no, la primera vez que hace esa sesión; si no, nada
export function selloSesion({ records = 0, primera = false } = {}) {
  return records > 0 ? 'celebra-record' : primera ? 'celebra-primera' : null;
}

// ---------- Dónde entrenas, bienvenida, primeros pasos, herramientas, equipo y carné ----------
const LUGARES = ['gimnasio', 'casa', 'viaje'];
export function imagenLugar(lugar) { return LUGARES.includes(lugar) ? `donde-${lugar}` : 'donde-gimnasio'; }
// La bienvenida del día: de 6 a 13:59, la mañana; de 14 a 20:59, la tarde; si no, la noche (hora de Madrid)
// (imágenes, tanda 8) Con `fecha` («AAAA-MM-DD»), la de su estación: primavera (marzo a mayo), verano (junio a agosto),
// otoño (septiembre a noviembre) e invierno (diciembre a febrero); si no está, la de siempre
export const ESTACIONES = ['invierno', 'invierno', 'primavera', 'primavera', 'primavera', 'verano', 'verano', 'verano', 'otono', 'otono', 'otono', 'invierno'];
export function imagenBienvenida(hora, fecha = null) {
  const h = Number(hora);
  if (!Number.isFinite(h)) return null;
  const base = h >= 6 && h < 14 ? 'bienvenida-manana' : h >= 14 && h < 21 ? 'bienvenida-tarde' : 'bienvenida-noche';
  const mes = Number(String(fecha || '').slice(5, 7));
  if (!(mes >= 1 && mes <= 12)) return base;
  const id = `${base}-${ESTACIONES[mes - 1]}`;
  return LISTA[id] ? id : base;
}
// Las pantallas de la primera vez (atleta/Bienvenida.jsx): la de instalar sigue con su dibujo
const PRIMEROS = { programa: 'programa', serie: 'sesion', coach: 'checkin' };
export function imagenPrimerosPasos(dibujo) { return PRIMEROS[dibujo] ? `primeros-${PRIMEROS[dibujo]}` : null; }
export const HERRAMIENTAS = ['camara', 'metronomo', 'intervalos', 'comparar'];
export function imagenHerramienta(que) { return HERRAMIENTAS.includes(que) ? `herr-${que}` : null; }

// ---------- Los hitos de la racha y el aniversario (bloque R) ----------
// El fuego crece de un hito a otro: 4 semanas, una vela; 52, la gran hoguera. Más allá de 52 (104, 156…), la de 52.
// Entre hitos (no debería pasar), la del hito alcanzado más alto; por debajo de 4, ninguna
export const HITOS_IMG = [4, 8, 12, 26, 52];
export function imagenHito(semanas) {
  const n = Number(semanas) || 0;
  const h = HITOS_IMG.filter((x) => x <= n).pop();
  return h ? `hito-${h}` : null;
}
export const IMAGEN_ANIVERSARIO = 'aniversario';

// ---------- El foco de la semana ----------
// Una cabecera por foco (logica/calculos.js: FOCOS), con lo que significa esa semana en una frase; sin foco, nada
export const FOCOS_IMG = ['adaptacion', 'tecnica', 'volumen', 'intensidad', 'descarga', 'mixto', 'evaluacion', 'peaking'];
export function imagenFoco(foco) { return FOCOS_IMG.includes(foco) ? `foco-${foco}` : null; }
export const FRASE_FOCO = {
  adaptacion: 'Para coger el ritmo: cargas cómodas y la técnica en su sitio.',
  tecnica: 'Cada repetición, limpia: algo menos de kilos y mucha precisión.',
  volumen: 'Más series que de costumbre: el trabajo que te hace crecer.',
  intensidad: 'Menos repeticiones y más kilos: aprieta en lo importante.',
  descarga: 'Algo menos de carga para recuperar y llegar fresco a lo siguiente.',
  mixto: 'Un poco de todo: fuerza, volumen y trabajo general.',
  evaluacion: 'Semana de medir: vemos dónde estás para ajustar lo que viene.',
  peaking: 'Afinando para tu mejor marca: poco volumen y mucha intensidad.',
};

// ---------- Los archivos ----------
// { src, srcset, ancho, alto } de una imagen, o null si no está (o si esta construcción no lleva imágenes: la demo de un
// solo archivo). `lista` se puede cambiar en las pruebas.
export function fuenteImagen(id, lista = LISTA) {
  const x = id && Object.prototype.hasOwnProperty.call(lista, id) ? lista[id] : null;
  if (!x || !x.archivos) return null;
  const anchos = Object.keys(x.archivos).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  if (!anchos.length) return null;
  const [pa, pb] = Array.isArray(x.proporcion) && x.proporcion[0] > 0 && x.proporcion[1] > 0 ? x.proporcion : [16, 9];
  // La de en medio como src (la que usa un navegador sin srcset), todas en srcset
  const base = anchos[Math.min(1, anchos.length - 1)];
  return {
    src: x.archivos[base],
    // (visual 12) su color, para pintarlo mientras carga (scripts/colores-imagenes.py)
    color: /^#[0-9a-f]{6}$/i.test(x.color || '') ? x.color : null,
    srcset: anchos.map((a) => `${x.archivos[a]} ${a}w`).join(', '),
    ancho: base,
    alto: Math.round((base * pb) / pa),
  };
}

export const IMAGENES = [];   // (se llena al llegar la lista: cargarListaImagenes)

// ---------- Los iconos ilustrados ----------
// 45 iconos de los cuadraditos (ios-ico) llevan su ilustración (cinco láminas de 3×3, claude/iconos-prompts.md). Se
// pinta encima del dibujo de líneas, que queda debajo si no carga. Los demás iconos, y los cuadraditos con tono de estado
// (ok, aviso, alerta), siguen con su dibujo de líneas.
export const ICONOS_IMG = [
  'hoy', 'disco', 'semana', 'calendario', 'progreso', 'diana', 'trofeo', 'llama', 'estrella',
  'bandera', 'movilidad', 'pasos', 'reloj', 'bascula', 'sueno', 'agua', 'proteina', 'verdura',
  'nutricion', 'receta', 'atletas', 'equipo', 'perfil', 'mensaje', 'video', 'imagen', 'micro',
  'altavoz', 'campana', 'checkin', 'plantillas', 'biblioteca', 'historial', 'bandeja', 'escudo', 'candado',
  'privacidad', 'tema', 'paleta', 'sol', 'nube', 'lluvia', 'nieve', 'niebla', 'tormenta',
];
export const imagenIcono = (n) => (ICONOS_IMG.includes(n) ? `ico-${n}` : null);

// ---------- (imágenes de las 48 h, bloque AA) Los apuntes ----------
// Una por tema («Tus temas»), y las de la prueba de nivel, la ruta, el certificado, la liga, el repaso, el objetivo del día,
// las historias y el audio del coach
export const TEMAS_APUNTES_IMG = ['tecnica', 'programacion', 'nutricion', 'recuperacion', 'mentalidad'];
export const imagenTemaApuntes = (tema) => (TEMAS_APUNTES_IMG.includes(tema) ? `apuntes-tema-${tema}` : null);

// ---------- (imágenes de las 48 h) Bloque AB: su meta y su historia ----------
// El aniversario: la vela con la luna (1 y 3 meses), las seis lunas (6 meses) y el laurel (el año y los siguientes)
export const imagenAniversarioMeses = (m) => (!Number.isInteger(m) || m < 1 ? null : m >= 12 ? 'aniversario-ano' : m >= 6 ? 'aniversario-medio' : 'aniversario-mes');
// La cuenta atrás de su meta (rumbo.cuentaMeta): el reloj de arena con el camino; el día, la bandera dorada; pasada, la siguiente
export const imagenMeta = (c) => (!c ? null : c.pasada ? 'meta-siguiente' : c.dias === 0 ? 'meta-dia' : 'meta-cuenta');

// ---------- (imágenes de las 48 h) Bloques AC, AD y AE: la sesión de hoy, su vida y que le acompañe ----------
// Su álbum: la huella en el escalón (primera sesión), la barra cargada (los 100 kg) y la barra de dominadas
const HITOS_ALBUM_IMG = { primera: 'hito-primera', cien: 'hito-cien', dominada: 'hito-dominada' };
export const imagenHitoAlbum = (clave) => HITOS_ALBUM_IMG[clave] || null;
