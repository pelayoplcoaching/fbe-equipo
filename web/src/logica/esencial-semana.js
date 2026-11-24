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

// ---------- La plancha (los ejercicios por tiempo) ----------
// El motor no sabe de segundos (sus rangos son de repeticiones), así que la plancha sube con su propia regla (Pelayo,
// 24/11: «no la haría por encima de 45-50 segundos; a partir de ahí, carga o algo de dificultad»):
//  · si en todas sus series llega arriba del rango, con el peso pautado: 5 s más la semana siguiente, hasta 40-50 s;
//  · con 50 s en todas: peso (5 kg la primera vez, luego 2,5 más) y vuelta a 35-45 s, para subir otra vez de 5 en 5;
//  · no sube en una semana que no sea normal (descarga, a medias o tras un parón), con una molestia en su zona, si hizo
//    la alternativa (el curl) o si la hizo con menos peso del pautado (por ejemplo, la versión difícil sin disco).
export const PLANCHA = { paso: 5, techo: 50, vuelta: [35, 45], primerPeso: 5, salto: 2.5 };

// p: la pauta de la semana hecha; hechas: sus series apuntadas. Devuelve { reps_min, reps_max, carga_sugerida_kg } o
// null (se queda igual).
export function planchaSiguiente(p, hechas = [], { normal = true } = {}) {
  const max = Number(p?.reps_max), min = Number(p?.reps_min), kg = Number(p?.carga_sugerida_kg) || 0;
  const n = Math.max(1, Number(p?.series) || 1);
  if (!normal || !(max > 0)) return null;
  const series = [...(hechas || [])].filter((s) => Number(s.reps) > 0).sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0)).slice(0, n);
  if (series.length < n || series.some((s) => s.sustituto_id)) return null;
  if (!series.every((s) => Number(s.reps) >= max && (Number(s.kg) || 0) >= kg)) return null;
  if (max < PLANCHA.techo) {
    const nuevoMax = Math.min(PLANCHA.techo, max + PLANCHA.paso);
    const ancho = min > 0 && min <= max ? max - min : 10;
    return { reps_min: Math.max(1, nuevoMax - ancho), reps_max: nuevoMax, carga_sugerida_kg: kg > 0 ? kg : null };
  }
  return { reps_min: PLANCHA.vuelta[0], reps_max: PLANCHA.vuelta[1], carga_sugerida_kg: kg > 0 ? kg + PLANCHA.salto : PLANCHA.primerPeso };
}

// La de una pauta de la semana hecha, con lo que dice el motor de ella (fila): en la semana 5 manda la plantilla, y con
// una posible errata por confirmar, un «no tocar» o una molestia en su zona, se queda igual.
export function planchaDeLaSemana({ p, fila = null, hechas = [], soloKilos = false, normal = true }) {
  if (soloKilos || ['pregunta', 'sin_tocar'].includes(fila?.tipo) || (fila?.avisos || []).some((a) => a.tipo === 'molestia')) return null;
  return planchaSiguiente(p, hechas, { normal });
}

// ---------- De la propuesta del motor a la semana que se guarda ----------
// Los campos que cambia el motor (los de motor/modelos.js: series, repeticiones, esfuerzo, kilos y el detalle por serie)
const DEL_MOTOR = ['series', 'reps_min', 'reps_max', 'rir_objetivo', 'rpe_objetivo', 'carga_sugerida_kg', 'backoff_pct', 'series_detalle'];
// Lo que se copia de cada pauta tal cual (el resto de su prescripción)
const DE_LA_PAUTA = ['ejercicio_id', 'orden', 'superserie', 'prioridad', 'descanso_seg', 'tempo', 'notas_coach', 'variante'];

// La semana siguiente: las sesiones y pautas de `molde` (la semana hecha o la plantilla de novato), con lo que propone el
// motor para cada una. pares: { id de la pauta del molde: fila del motor } (las filas «pregunta» y «sin_tocar» no cambian
// nada). soloKilos: en la semana 5 se respeta la plantilla (series, repeticiones y esfuerzo) y solo se toman los kilos.
// Los ejercicios por tiempo (la plancha), con su regla (planchaSiguiente): hechas, { id de la pauta: series apuntadas };
// normal, si la semana que propone el motor es una normal (ni descarga, ni a medias, ni tras un parón).
// alternativas (094): { ejercicio: alternativa } que ha elegido para siempre (solo entre ejercicios que se miden igual);
// si la semana hecha aún llevaba el de la guía, va la alternativa, sin kilos (son de otro ejercicio), como
// esencial_semana_siguiente de la base. ejercicios tiene que llevar también las alternativas.
// Devuelve [{ orden, nombre, tipo, pautas: [...] }] para la función de la base.
export function semanaDesdePropuesta({ sesiones = [], pautas = {}, pares = {}, soloKilos = false, ejercicios = {}, hechas = {}, normal = true, alternativas = {} }) {
  return [...sesiones].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map((s) => ({
    orden: s.orden, nombre: s.nombre, tipo: s.tipo || 'fuerza',
    pautas: [...(pautas[s.id] || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map((p) => {
      const base = Object.fromEntries([...DE_LA_PAUTA, ...DEL_MOTOR].map((c) => [c, p[c] ?? null]));
      const alt = alternativas?.[p.ejercicio_id];
      if (alt && alt !== p.ejercicio_id && ejercicios[alt] && !!ejercicios[alt].por_tiempo === !!ejercicios[p.ejercicio_id]?.por_tiempo) {
        return { ...base, ejercicio_id: alt, carga_sugerida_kg: null, series_detalle: null };
      }
      const f = pares[p.id];
      if (ejercicios[p.ejercicio_id]?.por_tiempo) {
        const sube = planchaDeLaSemana({ p, fila: f, hechas: hechas[p.id], soloKilos, normal });
        return sube ? { ...base, ...sube } : base;
      }
      if (!f || ['pregunta', 'sin_tocar'].includes(f.tipo) || !f.propuesta) return base;
      if (soloKilos) return { ...base, carga_sugerida_kg: f.propuesta.carga_sugerida_kg ?? base.carga_sugerida_kg };
      return { ...base, ...Object.fromEntries(DEL_MOTOR.map((c) => [c, f.propuesta[c] ?? null])) };
    }),
  }));
}
