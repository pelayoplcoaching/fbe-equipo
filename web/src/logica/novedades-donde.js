// (belleza 341) Dónde está lo nuevo: el icono y el nombre del sitio de la app del que habla cada frase de «Novedades».
// Se mira solo cómo empieza (hasta los primeros dos puntos o punto, y sus seis primeras palabras): las frases se escriben a
// mano empezando por el sitio («En Ajustes, …», «Hoy, …», «Al terminar, tu sesión…»), y así no hay que marcarlas. Va
// aparte, con la lista (novedades.js): solo se pide cuando hay novedades que enseñar. Las tildes de las expresiones, como
// \u (una tilde dentro de una expresión regular rompe la app empaquetada).
const DONDE = [
  [/\bAjustes\b/, 'ajustes', 'En Ajustes'],
  [/\u00abM\u00e1s\u00bb/, 'opciones', 'En «Más»'],
  [/\bRevisar\b/, 'video', 'En Revisar'],
  [/\bcompart|fondo de pantalla/i, 'compartir', 'Al compartir'],
  [/\b(la|tu) sesi\u00f3n\b|\bAl terminar una sesi\u00f3n\b|\bserie\b|\bdescanso\b/i, 'play', 'En la sesión'],
  [/\bchat\b|\bMensajes\b/i, 'mensaje', 'En Mensajes'],
  [/\bbiblioteca\b/i, 'biblioteca', 'En la biblioteca'],
  [/\bProgreso\b/, 'progreso', 'En Progreso'],
  [/\bSemana\b/, 'semana', 'En Semana'],
  [/\bComidas\b|\brecetas?\b|\bmen\u00fa/i, 'receta', 'En Comidas'],
  [/\bcheck-in\b/i, 'checkin', 'En el check-in'],
  [/^Hoy\b|\ben Hoy\b/, 'hoy', 'En Hoy'],
  [/\bAprende\b|\bgu\u00edas?\b|\bapuntes\b/i, 'biblioteca', 'En Aprende'],
];
// [icono, lugar], o null si la frase no empieza por un sitio
export function dondeNovedad(t) {
  const inicio = String(t || '').split(/[:.]/)[0].split(/\s+/).slice(0, 6).join(' ');
  const x = DONDE.find(([re]) => re.test(inicio));
  return x ? [x[1], x[2]] : null;
}
