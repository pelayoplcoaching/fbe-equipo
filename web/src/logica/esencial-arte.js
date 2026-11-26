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

// (v0.253) F1 · Tu plan de comida: cada paso del cuestionario de nutrición (sus claves, las de nutricion-cuestionario.js:
// pasosNutricion); la tarjeta de Hoy es 'esencial-nutri-preparar' y, cuando la app no calcula el plan, 'esencial-nutri-excluido'
// (prompts en «claude/esencial-imagenes-prompts-3.md»)
export const ARTE_NUTRI = {
  tu: 'esencial-nutri-tu', salud: 'esencial-nutri-salud', scoff: 'esencial-nutri-scoff', medidas: 'esencial-nutri-medidas', dia: 'esencial-nutri-dia',
  objetivo: 'esencial-nutri-objetivo', comer: 'esencial-nutri-comer', plan: 'esencial-nutri-plan',
};
// (v0.253) La revisión de cada 4 semanas, por lo que salió (las de F6, que llegan con la N4; «profesional», la de «excluido»)
export const ARTE_REVISION = {
  bien: 'esencial-nutri-va-bien', recomposicion: 'esencial-nutri-va-bien', baja: 'esencial-nutri-ajuste', sube: 'esencial-nutri-ajuste',
  simplificar: 'esencial-nutri-simplificar', profesional: 'esencial-nutri-excluido', suelo: 'esencial-nutri-revision', datos: 'esencial-nutri-revision',
};

// (v0.253) F2 · La comida, acompañada: las hojas de comida de «¿Qué necesitas?» (sus claves, las de NECESITAS_COMIDA de
// esencial-comida.js); tu comida en la revisión de la semana es 'esencial-comida-semana' y la comida de viaje en Hoy,
// 'esencial-comida-viaje'
export const ARTE_COMIDA = {
  proteina: 'esencial-comida-proteina', fuera: 'esencial-comida-fuera', hambre: 'esencial-comida-hambre', pasado: 'esencial-comida-pasado',
  celebracion: 'esencial-comida-celebracion', pesarme: 'esencial-comida-pesarme',
};

// Todas (para comprobar que lo que se usa existe y que la lista de archivos no trae nada de más)
export const ARTE = [
  ...Object.values(ARTE_HERO), 'esencial-hoy-empiezas',
  'esencial-bienvenida-plan', 'esencial-bienvenida-lunes', 'esencial-bienvenida-serie', 'esencial-bienvenida-avisos',
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(arteLeccion),
  'esencial-domingo', 'esencial-semana-lista', 'esencial-pausa', 'esencial-repite', 'esencial-sesion-perdida', 'esencial-otro-dia',
  'esencial-semana-1-hecha', 'esencial-marcas', 'esencial-cuatro-semanas', 'esencial-doce-semanas', 'esencial-estancado', 'esencial-descarga',
  'esencial-primera-sesion', 'esencial-que-peso', 'esencial-te-sobran', 'esencial-ajustar-maquina', 'esencial-fin-primera',
  'esencial-preguntas', 'esencial-molestia', 'esencial-checkin-enviado', 'esencial-equipo',
  'esencial-nutri-preparar', ...Object.values(ARTE_NUTRI), 'esencial-nutri-excluido',
  'esencial-nutri-va-bien', 'esencial-nutri-ajuste', 'esencial-nutri-simplificar', 'esencial-nutri-revision',
  'esencial-comida-semana', ...Object.values(ARTE_COMIDA), 'esencial-comida-viaje',
  // (v0.253) F3 · «¿Qué necesitas?», Respuestas y las hojas que abren (las de «Me duele algo», «He faltado» y «Cambiar de
  // rutina» son las que ya había)
  'esencial-necesitas', 'esencial-respuestas', 'esencial-poco-tiempo', 'esencial-plan-explicado', 'esencial-suscripcion', 'esencial-viaje',
  'esencial-enfermo', 'esencial-otro-sitio', 'esencial-cambiar-ejercicio', 'esencial-objetivo', 'esencial-marcas-ahora', 'esencial-suave',
  // (v0.253) F4 · Antes de tu lunes: una arriba de cada hoja de lo que puede ir haciendo mientras espera (la de «Qué pedirle a
  // tu médico» es la del visto bueno)
  'esencial-avisos-prueba', 'esencial-prepara-gimnasio', 'esencial-porque', 'esencial-partida', 'esencial-ensayo', 'esencial-primer-dia', 'esencial-kilos-partida',
  // F5 · Tu revisión de la semana, lo que la app ha hecho por ti y tu trimestre
  'esencial-revision-semana', 'esencial-app-hizo', 'esencial-trimestre',
  // (v0.254) F7 · las agujetas del día siguiente y la vuelta tras unos días sin entrenar (EsencialCerca.jsx)
  'esencial-agujetas', 'esencial-vuelta',
  // (v0.254) G · «Más herramientas» y «Mi medicación y el ejercicio» (EsencialHerramientas.jsx; sin imagen todavía)
  'esencial-herramientas', 'esencial-medicacion',
  // (v0.255) G1 · «Tus pruebas»: la hoja y su tarjeta, cada prueba, el resultado y el informe para tu médico (EsencialPruebas.jsx;
  // sin imagen todavía)
  'esencial-pruebas', 'esencial-prueba-silla', 'esencial-prueba-equilibrio', 'esencial-prueba-prension', 'esencial-prueba-cintura', 'esencial-prueba-sppb',
  'esencial-prueba-tandem', 'esencial-prueba-marcha', 'esencial-pruebas-resultado', 'esencial-pruebas-mejora', 'esencial-pruebas-otra-vez',
  'esencial-pruebas-consulta', 'esencial-informe-medico',
];
