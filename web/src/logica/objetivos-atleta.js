// Los objetivos que propone el atleta (migración 076): contesta un cuestionario (ahora y al empezar cada bloque) y lo
// que escribe le llega al coach como propuesta. El coach la acepta (ajustándola si quiere) o la descarta; solo lo
// aceptado sale como objetivo. Lógica pura: la usan la app, la demo y las pruebas.
import { num } from './calculos.js';
import { pesoTxt } from './unidades.js';
import { fmtTiempo, fmtRitmo, ritmoDe } from './carrera.js';
import { diasEntre, sumarDias, fechaMadrid } from './fechas.js';

export const TIPOS_PROPUESTA = [
  ['fuerza', 'Una marca de fuerza', 'Unos kilos y unas repeticiones en un ejercicio'],
  ['peso', 'Mi peso', 'El peso al que quieres llegar'],
  ['carrera', 'Una marca corriendo', 'Una distancia en un tiempo'],
  ['libre', 'Otra cosa', 'Lo que quieras conseguir, con tus palabras'],
];
export const NOMBRE_TIPO_PROPUESTA = { fuerza: 'Fuerza', peso: 'Peso', carrera: 'Carrera', libre: 'Otro' };
export const MAX_PROPUESTAS = 5;
export const MAX_TITULO = 80, MAX_MOTIVO = 200, MAX_NOTA = 200;
export const DIAS_POSPUESTO = 7;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

// Los tipos que puede pedir: el peso, solo con el consentimiento de datos de salud; la carrera, a quien se la llevan;
// la fuerza, a quien entrena (no a quien solo lleva la nutrición)
export function tiposPara({ salud = false, carrera = false, entrena = true } = {}) {
  return TIPOS_PROPUESTA.filter(([k]) => (k === 'fuerza' ? entrena : k === 'peso' ? salud : k === 'carrera' ? carrera && entrena : true));
}

const numero = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const texto = (v) => String(v ?? '').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim();

// Lo que se manda a la base de una propuesta del formulario: { datos } o { error } (el mismo criterio que la 076)
export function limpiarPropuesta(x = {}, hoy = fechaMadrid()) {
  const tipo = x.tipo;
  if (!TIPOS_PROPUESTA.some(([k]) => k === tipo)) return { error: 'Elige qué quieres conseguir.' };
  const motivo = texto(x.motivo) || null;
  if (motivo && motivo.length > MAX_MOTIVO) return { error: `El porqué, como mucho ${MAX_MOTIVO} caracteres.` };
  const fecha = x.fecha || null;
  if (fecha && (!DIA.test(fecha) || fecha < hoy || fecha > sumarDias(hoy, 730))) return { error: 'La fecha tiene que estar entre hoy y dentro de dos años.' };
  const base = { tipo, ejercicio_id: null, kg: null, reps: null, peso_kg: null, distancia_km: null, tiempo_seg: null, titulo: null, motivo, fecha };
  if (tipo === 'fuerza') {
    const kg = numero(x.kg), reps = numero(x.reps);
    if (!x.ejercicio_id) return { error: 'Elige el ejercicio.' };
    if (kg == null || kg < 0.5 || kg > 1000) return { error: 'Pon los kilos de tu marca.' };
    if (reps == null || !Number.isInteger(reps) || reps < 1 || reps > 12) return { error: 'Las repeticiones, de 1 a 12.' };
    return { datos: { ...base, ejercicio_id: x.ejercicio_id, kg: Math.round(kg * 100) / 100, reps } };
  }
  if (tipo === 'peso') {
    const peso = numero(x.peso_kg);
    if (peso == null || peso < 30 || peso > 300) return { error: 'Pon el peso al que quieres llegar (entre 30 y 300 kg).' };
    return { datos: { ...base, peso_kg: Math.round(peso * 100) / 100 } };
  }
  if (tipo === 'carrera') {
    const km = numero(x.distancia_km), seg = numero(x.tiempo_seg);
    if (km == null || km < 0.1 || km > 500) return { error: 'Pon la distancia en kilómetros.' };
    if (seg == null || seg < 30 || seg > 360000) return { error: 'Pon el tiempo, por ejemplo 50:00 o 1:45:00.' };
    return { datos: { ...base, distancia_km: Math.round(km * 100) / 100, tiempo_seg: Math.round(seg) } };
  }
  const titulo = texto(x.titulo);
  if (!titulo) return { error: 'Escribe tu objetivo.' };
  if (titulo.length > MAX_TITULO) return { error: `Tu objetivo, como mucho ${MAX_TITULO} caracteres.` };
  return { datos: { ...base, titulo } };
}

// «Sentadilla 100 kg × 3», «Pesar 72 kg», «10 km en 50:00», o lo que escribió
export const textoCarrera = (km, seg) => `${num(Number(km), Number(km) % 1 ? (Number(km) * 10) % 1 ? 2 : 1 : 0)} km en ${fmtTiempo(Number(seg))}`;
export const ritmoCarrera = (km, seg) => { const r = ritmoDe(Number(seg), Number(km)); return r ? `${fmtRitmo(r)} min/km` : ''; };
export function textoPropuesta(p) {
  if (!p) return '';
  if (p.tipo === 'fuerza') return `${p.ejercicio || 'Ejercicio'} ${pesoTxt(Number(p.kg), 2)}${Number(p.reps) > 1 ? ` × ${p.reps}` : ' a una repetición'}`;
  if (p.tipo === 'peso') return `Pesar ${num(Number(p.peso_kg), 1)} kg`;
  if (p.tipo === 'carrera') return textoCarrera(p.distancia_km, p.tiempo_seg);
  return p.titulo || '';
}

// El tipo de un objetivo: el suyo o, en los de antes de la 076, por si lleva ejercicio
export const tipoDeObjetivo = (o) => o?.tipo || (o?.ejercicio_id ? 'fuerza' : 'libre');

// La fila del objetivo que crea el coach al aceptar una propuesta tal cual (después la puede ajustar en su hoja)
export function objetivoDePropuesta(p) {
  const fila = { titulo: textoPropuesta(p), descripcion: p.motivo || null, fecha_limite: p.fecha || null, estado: 'en_curso', tipo: p.tipo, propuesto_por_atleta: true };
  if (p.tipo === 'fuerza') Object.assign(fila, { ejercicio_id: p.ejercicio_id, kg_objetivo: Number(p.kg), reps_objetivo: Number(p.reps) });
  if (p.tipo === 'peso') fila.peso_objetivo = Number(p.peso_kg);
  if (p.tipo === 'carrera') Object.assign(fila, { distancia_km: Number(p.distancia_km), tiempo_seg: Number(p.tiempo_seg) });
  return fila;
}

// ¿Le toca el cuestionario? Si nunca lo ha contestado, o si su bloque de ahora empezó después de la última vez; no,
// mientras lo tenga pospuesto («Ahora no», una semana) o con propuestas esperando al coach.
// contestadoEn: instante (ISO) o null; inicioBloque: el día (ISO) en que empezó su bloque activo, o null
export function tocaCuestionario({ contestadoEn = null, inicioBloque = null, pospuestoHasta = null, pendientes = 0, hoy = fechaMadrid() } = {}) {
  if (pendientes > 0) return false;
  if (pospuestoHasta && DIA.test(pospuestoHasta) && hoy < pospuestoHasta) return false;
  if (!contestadoEn) return true;
  const dia = fechaMadrid(new Date(contestadoEn));
  return !!inicioBloque && DIA.test(inicioBloque) && inicioBloque <= hoy && dia < inicioBloque;
}
export const posponerHasta = (hoy = fechaMadrid()) => sumarDias(hoy, DIAS_POSPUESTO);
// «por primera vez» o «para este bloque»
export const motivoCuestionario = ({ contestadoEn = null } = {}) => (contestadoEn ? 'bloque' : 'primera');

// Lo que ve el atleta de sus propuestas: las que esperan y las contestadas hace poco (14 días), lo último primero
export function propuestasVisibles(lista = [], hoy = fechaMadrid()) {
  const pendientes = lista.filter((p) => p.estado === 'pendiente');
  const recientes = lista.filter((p) => p.estado !== 'pendiente' && p.resuelto_en && diasEntre(fechaMadrid(new Date(p.resuelto_en)), hoy) <= 14)
    .sort((a, b) => (a.resuelto_en < b.resuelto_en ? 1 : -1));
  return { pendientes, recientes };
}
