// v0.59 (14): los «Entendido» de los recordatorios, en este móvil. Al cargar la app se quitan los de otros días (solo
// valen ese día) y al cerrar la sesión (con «Salir» o cuando caduca), todos. Sin almacenamiento, no pasa nada.
import { clavesEntendido } from '../../logica/correccion.js';
import { hoyISO } from '../../logica/fechas.js';

function quitar(hoy) {
  try {
    const ls = window.localStorage;
    const claves = [];
    for (let i = 0; i < ls.length; i++) claves.push(ls.key(i));
    for (const k of clavesEntendido(claves, hoy)) ls.removeItem(k);
  } catch { /* sin almacenamiento */ }
}
export const podarEntendidos = () => quitar(hoyISO());
export const olvidarEntendidos = () => quitar(null);
