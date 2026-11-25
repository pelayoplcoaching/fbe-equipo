// FBE Esencial (v0.244): qué ilustración va en cada sitio propio de quien va por su cuenta. Lógica pura y pequeña.
// Las ilustraciones las genera Pelayo (prompts en el doc del proyecto «claude/esencial-imagenes-prompts-2.md», bloques
// E1 a E6; el cuestionario ya tenía la suya en cada paso); su lista de archivos es datos/imagenes-esencial.json, que va con el trozo de FBE Esencial (no con el arranque).
// Cada hueco se llena solo cuando su imagen está en la lista; mientras falte, se queda lo de antes (el icono o el dibujo).

// E1 · La tarjeta grande de Hoy antes de empezar: una por estado (logica/esencial-alta.js: estadoEsencial)
export const ARTE_HERO = {
  cuestionario: 'esencial-cuestionario', salud: 'esencial-salud', rutina: 'esencial-rutina', visto_bueno: 'esencial-visto-bueno',
  revision: 'esencial-revision', preparando: 'esencial-preparando', espera: 'esencial-espera',
};
// E3 · La lección de cada semana (las ocho primeras)
export const arteLeccion = (semana) => (Number.isInteger(semana) && semana >= 1 && semana <= 8 ? `esencial-leccion-${semana}` : null);
// E4 · El cierre de la semana (logica/esencial-cierre.js: estadoCierre)
export const ARTE_CIERRE = { pregunta: 'esencial-domingo', pasada: 'esencial-semana-lista', lista: 'esencial-semana-lista', pausa: 'esencial-pausa', repite: 'esencial-repite' };
// «Semana N hecha»: la primera, cada cuatro y cada doce
export const arteSemanaHecha = (n) => (n === 1 ? 'esencial-semana-1-hecha' : n >= 4 && n % 12 === 0 ? 'esencial-doce-semanas' : n >= 4 && n % 4 === 0 ? 'esencial-cuatro-semanas' : null);

// Todas (para comprobar que lo que se usa existe y que la lista de archivos no trae nada de más)
export const ARTE = [
  ...Object.values(ARTE_HERO), 'esencial-hoy-empiezas',
  'esencial-bienvenida-plan', 'esencial-bienvenida-lunes', 'esencial-bienvenida-serie', 'esencial-bienvenida-avisos',
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(arteLeccion),
  'esencial-domingo', 'esencial-semana-lista', 'esencial-pausa', 'esencial-repite', 'esencial-sesion-perdida', 'esencial-otro-dia',
  'esencial-semana-1-hecha', 'esencial-marcas', 'esencial-cuatro-semanas', 'esencial-doce-semanas', 'esencial-estancado', 'esencial-descarga',
  'esencial-primera-sesion', 'esencial-que-peso', 'esencial-te-sobran', 'esencial-ajustar-maquina', 'esencial-fin-primera',
  'esencial-preguntas', 'esencial-molestia', 'esencial-checkin-enviado', 'esencial-equipo',
];
