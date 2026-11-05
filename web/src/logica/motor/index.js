// «Programar según FBE»: el motor de progresión (fase 0). Lógica pura, sin pantallas ni base de datos.
//   reglas.js    las reglas FBE, los perfiles y la herencia FBE → atleta → bloque → ejercicio
//   lectura.js   paso 1: el diagnóstico de cada ejercicio y su tendencia
//   modelos.js   paso 2: doble progresión, triple progresión, lineal, solo repeticiones, mantener y a mano
//   semana.js    paso 3: descarga por señales, vuelta tras un parón y mantenimiento
//   proponer.js  pasos 4 y 5: frenos, confianza y la propuesta de la semana
//   adaptador.js del bloque del editor a la entrada del motor, y de la propuesta a lo que se guarda
export * from './reglas.js';
export * from './lectura.js';
export * from './modelos.js';
export * from './semana.js';
export { proponerSemana, cargaZona } from './proponer.js';
export * from './adaptador.js';
