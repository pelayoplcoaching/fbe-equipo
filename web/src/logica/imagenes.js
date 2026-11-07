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
