// FBE Esencial (tanda 3): la semana siguiente de quien va por su cuenta, sola. Lógica pura: qué toca preparar al abrir la
// app (nada, el bloque de novato de la semana 5 o la semana siguiente) y desde qué lunes. Lo prepara el motor en su móvil
// y lo guarda la base (migración 092), que vuelve a comprobarlo todo.
import { NOMBRE_PRIMERAS_4 } from './esencial.js';

const DIA = 864e5;
const sumar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const lunesDe = (iso) => { const d = new Date(`${iso}T12:00:00Z`).getUTCDay(); return sumar(iso, -((d + 6) % 7)); };

// Las plantillas de novato (desde la semana 5): la de 2 días y, si lo pide (096), la de 3
export const NOVATOS = { 2: 'Novato 2 días · FBE Esencial', 3: 'Novato 3 días · FBE Esencial' };
const diasDeNovato = (nombre) => Number(Object.keys(NOVATOS).find((k) => NOVATOS[k] === nombre)) || null;

// bloque: el actual (o null); semanas: las suyas publicadas de ese bloque; sesiones: { semana_id: [{ completada }] };
// dias (096): los días que ha pedido (2 o 3; null, los de su plantilla).
// Devuelve null (nada que preparar) o { tipo: 'novato' | 'siguiente' | 'cambio', base, inicio, plantilla? }:
//  · la última semana del bloque (base) está hecha entera, o ya ha llegado el lunes siguiente;
//  · tras «Primeras 4 semanas» (su última semana, la de marcas): el bloque de novato desde ese lunes (el de sus días);
//  · en un bloque de novato, si ha pedido otros días: el bloque de esa plantilla desde ese lunes («cambio»);
//  · si lleva más de una semana sin abrir la app, desde el lunes de esta semana (no se rellenan las que se ha saltado).
export function siguientePaso({ bloque = null, semanas = [], sesiones = {}, hoy, dias = null }) {
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
  const quiere = NOVATOS[dias] ? Number(dias) : 2;
  if (primeras) return { tipo: 'novato', base, inicio, plantilla: NOVATOS[quiere] };
  const tiene = diasDeNovato(bloque.nombre);
  if (tiene && NOVATOS[dias] && Number(dias) !== tiene) return { tipo: 'cambio', base, inicio, plantilla: NOVATOS[dias] };
  return { tipo: 'siguiente', base, inicio };
}

// ---------- La plancha (los ejercicios por tiempo) ----------
// El motor no sabe de segundos (sus rangos son de repeticiones), así que la plancha sube con su propia regla (Pelayo,
// 24/11: «no la haría por encima de 45-50 segundos; a partir de ahí, carga o algo de dificultad»):
//  · si en todas sus series llega arriba del rango, con el peso pautado: 5 s más la semana siguiente, hasta 40-50 s;
//  · con 50 s en todas: peso (5 kg la primera vez, luego 2,5 más) y vuelta a 35-45 s, para subir otra vez de 5 en 5;
//  · no sube en una semana que no sea normal (descarga, a medias o tras un parón), con una molestia en su zona, si hizo
//    la alternativa (el curl) o si la hizo con menos peso del pautado (por ejemplo, la versión difícil sin disco).
//  · el peso, como mucho 20 kg (Pelayo, 25/11): con 20 kg y 50 s en todas, se queda igual (y la nota propone la versión
//    difícil).
export const PLANCHA = { paso: 5, techo: 50, vuelta: [35, 45], primerPeso: 5, salto: 2.5, topePeso: 20 };

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
  if (kg >= PLANCHA.topePeso) return null;
  return { reps_min: PLANCHA.vuelta[0], reps_max: PLANCHA.vuelta[1], carga_sugerida_kg: Math.min(PLANCHA.topePeso, kg > 0 ? kg + PLANCHA.salto : PLANCHA.primerPeso) };
}

// ¿Ha llegado al tope? Con el peso máximo (20 kg) y 50 s en todas sus series (para proponerle la versión difícil)
export function planchaEnTope(p, hechas = []) {
  const kg = Number(p?.carga_sugerida_kg) || 0, n = Math.max(1, Number(p?.series) || 1);
  if (kg < PLANCHA.topePeso || Number(p?.reps_max) < PLANCHA.techo) return false;
  const series = [...(hechas || [])].filter((s) => Number(s.reps) > 0 && !s.sustituto_id).slice(0, n);
  return series.length >= n && series.every((s) => Number(s.reps) >= PLANCHA.techo && (Number(s.kg) || 0) >= kg);
}

// ---------- Si se estanca (Pelayo, 25/11) ----------
// Tres semanas seguidas con la misma pauta en un ejercicio (mismos kilos y mismas repeticiones, sin conseguir subir) y el
// motor vuelve a proponer lo mismo: la semana siguiente, un 10 % menos de peso (redondeado al salto del ejercicio, como
// poco un salto) para volver a subir. En la plancha, sin peso, 5 s menos (como poco 20-30 s); con peso, 2,5 kg menos.
// historia: sus pautas de ese ejercicio en las semanas anteriores del bloque, de la más antigua a la semana hecha.
export const ESTANCADO = { semanas: 3, bajada: 0.1 };
const mismaPauta = (a, b) => a && b && Number(a.carga_sugerida_kg || 0) === Number(b.carga_sugerida_kg || 0)
  && Number(a.reps_min) === Number(b.reps_min) && Number(a.reps_max) === Number(b.reps_max) && Number(a.series) === Number(b.series);
export function estancado(historia = [], propuesta = null) {
  const ult = historia.slice(-ESTANCADO.semanas);
  if (ult.length < ESTANCADO.semanas || !ult.every((x) => mismaPauta(x, ult[0]))) return false;
  return !propuesta || mismaPauta(propuesta, ult[ult.length - 1]);
}
// Los kilos de la bajada: un 10 % menos, al salto del ejercicio (como poco un salto)
export function kilosBajada(kg, salto = 2.5) {
  const k = Number(kg), inc = Number(salto) > 0 ? Number(salto) : 2.5;
  if (!(k > 0)) return null;
  const pasos = Math.max(1, Math.round((k * ESTANCADO.bajada) / inc - 1e-9));   // (en un empate, la bajada menor)
  const nuevo = Math.round((k - pasos * inc) * 100) / 100;
  return nuevo > 0 ? nuevo : null;
}
export function planchaBajada(p) {
  const kg = Number(p?.carga_sugerida_kg) || 0;
  if (kg > 0) return { carga_sugerida_kg: kg - PLANCHA.salto > 0 ? kg - PLANCHA.salto : null };
  const max = Number(p?.reps_max), min = Number(p?.reps_min);
  if (!(max > 30)) return null;
  const ancho = min > 0 && min <= max ? max - min : 10;
  return { reps_min: Math.max(1, max - PLANCHA.paso - ancho), reps_max: max - PLANCHA.paso };
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
