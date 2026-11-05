// «Programar según FBE»: el motor de progresión. Lógica pura, sin pantallas ni base de datos.
//   reglas.js    las reglas FBE, los perfiles y la herencia FBE → atleta → bloque → ejercicio
//   lectura.js   paso 1: el diagnóstico de cada ejercicio y su tendencia
//   modelos.js   paso 2: progresión serie a serie (con top + back-off y peaking en básicos), doble, triple, lineal,
//                solo repeticiones, mantener y a mano
//   topset.js    las cuentas de la serie top y del peaking
//   volumen.js   las series por músculo de la semana frente a la anterior y al rango del atleta (solo avisa)
//   semana.js    paso 3: descarga por señales, vuelta tras un parón y mantenimiento
//   proponer.js  pasos 4 y 5: frenos, confianza y la propuesta de la semana
//   adaptador.js del bloque del editor a la entrada del motor, y de la propuesta a lo que se guarda
//   guardadas.js las reglas que el coach guarda para un atleta (perfil, rangos, RPE y reglas por ejercicio)
//   sombra.js    la prueba en sombra: el motor frente a lo que programó el coach, sobre una copia completa
export * from './reglas.js';
export * from './lectura.js';
export * from './modelos.js';
export * from './topset.js';
export * from './volumen.js';
export * from './semana.js';
export { proponerSemana, cargaZona } from './proponer.js';
export * from './adaptador.js';
export * from './sombra.js';
export * from './guardadas.js';
