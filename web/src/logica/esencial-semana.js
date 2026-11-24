// FBE Esencial (tanda 3): la semana siguiente de quien va por su cuenta, sola. Lógica pura: qué toca preparar al abrir la
// app (nada, el bloque de novato de la semana 5 o la semana siguiente) y desde qué lunes. Lo prepara el motor en su móvil
// y lo guarda la base (migración 092), que vuelve a comprobarlo todo.
import { NOMBRE_PRIMERAS_4 } from './esencial.js';

const DIA = 864e5;
const sumar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const lunesDe = (iso) => { const d = new Date(`${iso}T12:00:00Z`).getUTCDay(); return sumar(iso, -((d + 6) % 7)); };

// bloque: el actual (o null); semanas: las suyas publicadas de ese bloque; sesiones: { semana_id: [{ completada }] }.
// Devuelve null (nada que preparar) o { tipo: 'novato' | 'siguiente', base, inicio }:
//  · la última semana del bloque (base) está hecha entera, o ya ha llegado el lunes siguiente;
//  · tras «Primeras 4 semanas» (su última semana, la de marcas): el bloque de novato desde ese lunes;
//  · si lleva más de una semana sin abrir la app, desde el lunes de esta semana (no se rellenan las que se ha saltado).
export function siguientePaso({ bloque = null, semanas = [], sesiones = {}, hoy }) {
  if (!bloque || !hoy) return null;
  const propias = semanas.filter((w) => w.bloque_id === bloque.id && w.fecha_inicio && w.programacion === 'programada').sort((a, b) => a.numero - b.numero);
  const base = propias[propias.length - 1];
  if (!base) return null;
  let inicio = sumar(base.fecha_inicio, 7);
  const lista = sesiones[base.id] || [];
  const hecha = lista.length > 0 && lista.every((s) => s.completada);
  if (!hecha && hoy < inicio) return null;
  if (hoy > sumar(inicio, 6)) inicio = lunesDe(hoy);
  const primeras = bloque.nombre === NOMBRE_PRIMERAS_4;
  if (primeras && !base.marcas) return null;   // (las cuatro semanas de la guía ya están publicadas: hasta la de marcas, nada)
  return { tipo: primeras ? 'novato' : 'siguiente', base, inicio };
}
