// (v0.254) «Más herramientas», en «¿Qué necesitas?»: las herramientas de la web que no están dentro de la app. Decisión de
// Pelayo del 26/11/2026 (claude/esencial-herramientas-integracion.md): dentro de la app, solo lo que la app puede usar
// para ajustar el plan o seguir en el tiempo; lo que se consulta una vez, como enlace a la web. Cada enlace lleva el título
// y la descripción que ya tiene en la web (HERR_MAS de fbe-web y la entradilla de cada página, sin las cifras que cambian):
// nada de salud nuevo. Lo que ya está en la app (las preguntas de salud, el 1RM y los discos, el temporizador, las calorías
// y la proteína) no sale aquí.
import { WEB_FBE } from './esencial.js';

// [página de la web, título, descripción, icono]
export const MAS_HERRAMIENTAS = [
  ['chequeo.html', 'Chequeo de 10 minutos', 'Cuatro pruebas cortas: si conviene pasar antes por el médico, cuánto te mueves, la fuerza de tus piernas y tu grasa abdominal. Al final, un resumen.', 'checkin'],
  ['tension.html', 'Tensión en casa', 'Tu semana de tomas como pide la guía europea, con tu media y la hoja para tu médico.', 'calendario'],
  ['cafeina.html', 'Cafeína y sueño', 'Miligramos del día, límite de la EFSA y cuánta te queda al acostarte.', 'luna'],
  ['suplementos.html', 'Suplementos con evidencia', 'Grupo de evidencia, dosis para tu peso y qué vigilar.', 'proteina'],
  ['zonas-pulso.html', 'Zonas de pulso y esfuerzo', 'Tu pulso máximo y tus zonas, y cómo guiarte si tu medicación cambia el pulso.', 'rayo'],
  ['pasos.html', 'Pasos al día', 'Cuántos pasos necesitas según tu edad, y a qué ritmo andas.', 'pasos'],
];
export const APRENDE_WEB = [
  ['mitos.html', 'Mitos y evidencia', 'Ideas que se repiten en el gimnasio y en la consulta, contrastadas con revisiones, ensayos y guías clínicas.', 'pregunta'],
  ['glosario.html', 'Glosario de fuerza', 'Palabras que salen por toda la web, explicadas en dos líneas y con un enlace para probarlo o leer más.', 'letra'],
  ['fuentes.html', 'De dónde sale cada número', 'Las referencias que hay detrás de las herramientas, los mitos y la portada. Cada una, comprobada en PubMed o en la web oficial de quien la publica.', 'documento'],
  ['videos.html', 'Lo que publico en YouTube', 'Fuerza, nutrición y salud, explicadas por un médico internista.', 'video'],
];
export const TODAS_HERRAMIENTAS = 'herramientas.html';
export const urlWeb = (pagina) => `${WEB_FBE}/${pagina}`;
