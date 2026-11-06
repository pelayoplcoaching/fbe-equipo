// Lo que este móvil recuerda del equipo (v0.47; aparte desde el pulido 2.10, para que la app pueda leerlo al arrancar
// sin cargar toda la pantalla Equipo, ui/Comunidad.jsx): la última vez que se vio el muro (para «Nuevo» y la insignia
// de Equipo), los logros ya celebrados y «Compartir mis entrenos sin preguntar». Si el navegador no deja guardar (sin
// almacenamiento o lleno), se recuerda mientras la app está abierta.
import { leerPreferencia, guardarPreferencia } from './preferencias.js';

const claveVisto = (uid) => `fbe-equipo-visto:${uid || ''}`;
const claveCelebrados = (uid) => `fbe-equipo-celebrados:${uid || ''}`;
const enMemoria = new Map();
const leerLocal = (k) => { try { const v = localStorage.getItem(k); if (v != null) return v; } catch { /* */ } return enMemoria.get(k) ?? null; };
const guardarLocal = (k, v) => { enMemoria.set(k, v); try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: queda en memoria */ } };
export function leerVistoEquipo(uid) {
  return leerLocal(claveVisto(uid)) || null;
}
export function guardarVistoEquipo(uid, iso) {
  guardarLocal(claveVisto(uid), iso);
  try { window.dispatchEvent(new Event('fbe-equipo-visto')); } catch { /* */ }
}
export function leerCelebrados(uid) {
  try { const v = JSON.parse(leerLocal(claveCelebrados(uid)) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function marcarCelebrado(uid, id) {
  guardarLocal(claveCelebrados(uid), JSON.stringify([...new Set([...leerCelebrados(uid), id])].slice(-200)));
}

// v0.69: «Compartir mis entrenos sin preguntar», un ajuste de este móvil (por cuenta). Lo lee el resumen de la sesión
const claveAutoCompartir = (uid) => `fbe-equipo-autocompartir:${uid || ''}`;
export const leerAutoCompartir = (uid) => leerPreferencia(claveAutoCompartir(uid), false) === true;
export const guardarAutoCompartir = (uid, v) => guardarPreferencia(claveAutoCompartir(uid), !!v);
