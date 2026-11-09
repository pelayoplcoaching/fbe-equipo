// Las imágenes de la app (ilustraciones generadas para FBE): qué imagen toca en cada sitio y qué archivos servir.
// La lista de archivos está en datos/imagenes.json (la escribe la herramienta de conversión: id → proporción y un
// archivo WebP por ancho, con su huella en el nombre). Aquí no hay nada del navegador: se prueba en test/imagenes.test.mjs.
import LISTA from '../datos/imagenes.json' with { type: 'json' };
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

// ---------- Los hábitos ----------
// Una por icono de hábito (logica/habitos.js: ICONOS_HABITO); «Otro» (libre) y lo que no se conozca, la de las piedras
const HABITOS = ['pasos', 'proteina', 'agua', 'sueno', 'movilidad', 'verdura'];
export function imagenHabito(icono) { return `habito-${HABITOS.includes(icono) ? icono : 'otro'}`; }

// ---------- Los grupos musculares ----------
// La estatua de su grupo principal (el primero de grupos_musculares, el que cuenta 1 serie); sin grupo conocido, nada
const GRUPOS_IMG = ['pectoral', 'espalda', 'deltoides', 'cuadriceps', 'gluteo', 'isquiotibiales', 'biceps', 'triceps', 'abdominales', 'gemelo'];
export function imagenGrupo(grupo) {
  const g = Array.isArray(grupo) ? grupo[0] : grupo;
  return GRUPOS_IMG.includes(g) ? `grupo-${g}` : null;
}

// ---------- Las comidas ----------
// Una por toma (logica/comidas.js: TOMAS); «Antes de dormir», la de la cena
const COMIDAS = { desayuno: 'desayuno', media_manana: 'media-manana', comida: 'comida', merienda: 'merienda', cena: 'cena', recena: 'cena' };
export function imagenComida(toma) { return COMIDAS[toma] ? `comida-${COMIDAS[toma]}` : null; }

// ---------- Las tarjetas para compartir ----------
// La de la propia tarjeta (d.fondo: el bloque, el mes del equipo o el tuyo) o, en la de una sesión, la del récord si lo
// hubo y la de la barra si no
export const FONDOS_TARJETA = ['sesion', 'record', 'mes', 'bloque', 'racha'];
export function fondoTarjeta(d = {}) {
  if (FONDOS_TARJETA.includes(d.fondo)) return `compartir-${d.fondo}`;
  return d.records?.length ? 'compartir-record' : 'compartir-sesion';
}

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
export function imagenBienvenida(hora) {
  const h = Number(hora);
  if (!Number.isFinite(h)) return null;
  return h >= 6 && h < 14 ? 'bienvenida-manana' : h >= 14 && h < 21 ? 'bienvenida-tarde' : 'bienvenida-noche';
}
// Las pantallas de la primera vez (atleta/Bienvenida.jsx): la de instalar sigue con su dibujo
const PRIMEROS = { programa: 'programa', serie: 'sesion', coach: 'checkin' };
export function imagenPrimerosPasos(dibujo) { return PRIMEROS[dibujo] ? `primeros-${PRIMEROS[dibujo]}` : null; }
export const HERRAMIENTAS = ['camara', 'metronomo', 'intervalos', 'comparar'];
export function imagenHerramienta(que) { return HERRAMIENTAS.includes(que) ? `herr-${que}` : null; }

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
    srcset: anchos.map((a) => `${x.archivos[a]} ${a}w`).join(', '),
    ancho: base,
    alto: Math.round((base * pb) / pa),
  };
}

export const IMAGENES = Object.keys(LISTA);
