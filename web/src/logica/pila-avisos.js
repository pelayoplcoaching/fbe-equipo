// (vista 253, v0.274) Los avisos de Hoy en FBE Esencial, apilados: con tres o más avisos que solo cuentan algo (la nota
// de Pelayo, tus marcas, tu revisión, lo de esta semana, el reto…), se ve uno y los demás quedan debajo, con «Ver los N».
// Los que piden algo (contestar, elegir, activar) no entran nunca en la pila. Aquí, las cuentas; lo que se ve, en
// ui/atleta/pila-avisos.jsx.
export const MIN_PILA = 3;

// ¿Se apilan? n: cuántos avisos que solo cuentan algo hay; quiere: su ajuste («Apilar los avisos», encendido de serie)
export const seApila = (n, quiere = true) => !!quiere && n >= MIN_PILA;

// Cuál queda encima: el primero de los marcados como principales (tu revisión, tus marcas); si no hay, el primero.
// lista: [{ cima: boolean }]. Devuelve su posición (-1 sin avisos)
export function cimaDe(lista) {
  if (!lista?.length) return -1;
  const i = lista.findIndex((a) => a.cima);
  return i >= 0 ? i : 0;
}

// Lo que dice el botón: cerrada, «Ver los 4 avisos»; abierta, «Recoger los avisos»
export const rotuloPila = (n, abierta) => (abierta ? 'Recoger los avisos' : `Ver los ${n} avisos`);

// Lo que hay debajo, por su nombre (sin el de encima): hasta «max» (dos: cabe sin cortarse), y «y N más» si quedan
export function debajoDe(nombres, iCima, max = 2) {
  const resto = (nombres || []).filter((x, i) => i !== iCima && x);
  if (!resto.length) return '';
  const ver = resto.slice(0, max);
  const mas = resto.length - ver.length;
  return ver.join(' · ') + (mas > 0 ? ` · y ${mas} más` : '');
}
