// Modo reloj (migración 058): el entreno desde el Apple Watch con la app Atajos. Lógica pura: la usa la función «reloj»
// de Supabase para decir, a partir de lo que devuelve reloj_estado, qué serie toca, con qué carga y qué hacer después.
// Es la misma lógica que la sesión del móvil (serieQueToca, trasSerie, propuestaSerie, sugerenciaProgresion, back-off,
// pauta serie a serie) con tres diferencias, porque el reloj no tiene lo que guarda cada móvil:
//   · el orden es el que pautó el coach (no el que el atleta cambió en su móvil);
//   · el descanso es el del coach o, si no lo puso, 2 minutos (no el que eligió el atleta en su móvil);
//   · en un día flojo o malo («¿Cómo llegas hoy?»), no propone subir carga (en el móvil lo puede elegir).
// Las alternativas no se eligen en el reloj: si en el móvil ya cambió un ejercicio, el reloj sigue con el cambiado.
import { serieQueToca, objetivoEsfuerzo, nombreSerie } from './ahora-toca.js';
import { trasSerie, propuestaSerie, sugerenciaProgresion, propuestaBackoff, objetivoSerie, tieneDetalle, esTopBackoff,
  descansoEfectivo, DESCANSO_DEFECTO, etiquetasSuperserie, mmss, num } from './calculos.js';
import { consejoPreparacion } from './preparacion.js';
import { pesoTxt, vista, deVista, redondearCarga } from './unidades.js';
import { numero as leerNumero } from './integraciones.js';

export const ATAJO_RELOJ = 'FBE Reloj';
export const CLAVE = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Las opciones del menú del reloj (el atajo las enseña tal cual y manda la acción que corresponde a la elegida)
export const OPCION = {
  hecha: '✓ Hecha',
  cambiar: '✎ Cambiar kilos o reps',
  saltar: '⏭ Saltar este ejercicio',
  terminar: '■ Terminar la sesión',
  otra: '↺ Otra sesión',
};

// La unidad: 'kg' o 'lb'
const unidadDe = (u) => (u === 'lb' ? 'lb' : 'kg');
export const cargaTxt = (kg, u) => pesoTxt(kg, 2, unidadDe(u));

// Las series hechas: por pauta y número ({ id: { numero: serie } }) y cuántas lleva cada una ({ id: n })
export function mapasHechas(hechas = []) {
  const porPauta = {}, cuenta = {};
  for (const s of hechas || []) {
    (porPauta[s.sesion_ejercicio_id] ||= {})[s.numero] = s;
  }
  for (const [id, m] of Object.entries(porPauta)) cuenta[id] = Object.keys(m).length;
  return { porPauta, cuenta };
}

// La propuesta de una serie (kilos y repeticiones), como prepararEjercicio de la sesión del móvil. hechasSe: { numero: serie }
// de esa pauta hoy. cambiado: si en el móvil la cambió por una alternativa (sin la carga pautada del original).
export function propuestaReloj(se, ultimas, numero, hechasSe = {}, { foco = null, progresionAuto = true, frenar = false, cambiado = false } = {}) {
  const nombre = se?.ejercicio?.nombre || '';
  const prescripcion = cambiado ? { ...se, carga_sugerida_kg: null, series_detalle: se.series_detalle ? se.series_detalle.map(({ kg, ...resto }) => resto) : se.series_detalle } : se;
  const ult = cambiado ? null : ultimas;
  const detalle = tieneDetalle(prescripcion);
  const sugerencia = progresionAuto && !frenar && !detalle ? sugerenciaProgresion(prescripcion, ult?.series, { nombre, foco, pautaAnterior: ult?.pauta }) : null;
  const deLaTop = propuestaSerie(prescripcion, ult?.series, 1, { sugerencia, pautaAnterior: ult?.pauta });
  const bo = esTopBackoff(prescripcion) ? propuestaBackoff(prescripcion, numero, hechasSe, deLaTop, nombre) : null;
  if (bo) return bo;
  const previa = hechasSe[numero - 1];
  const o = objetivoSerie(prescripcion, numero);
  if (o) {
    const base = previa ? { kg: previa.kg, reps: previa.reps } : propuestaSerie(prescripcion, ult?.series, numero, { pautaAnterior: ult?.pauta });
    return { kg: o.kg ?? base.kg, reps: o.reps ?? base.reps, rpe: o.rpe ?? null, objetivo: o };
  }
  return previa ? { kg: previa.kg, reps: previa.reps } : propuestaSerie(prescripcion, ult?.series, numero, { sugerencia, pautaAnterior: ult?.pauta });
}

// El descanso tras una serie de esa pauta (0 = seguir sin descanso, dentro de una superserie)
const resolverReloj = (x) => descansoEfectivo(x, { defecto: DESCANSO_DEFECTO }).seg;

// La serie que toca: la que sigue a la última que se marcó (en una superserie, el otro ejercicio) o la primera sin hacer,
// sin los ejercicios saltados en el reloj. null si no queda nada.
export function serieSiguiente(estado) {
  const saltados = new Set(estado?.saltados || []);
  const lista = (estado?.ejercicios || []).filter((x) => !saltados.has(x.id));
  const { porPauta, cuenta } = mapasHechas(estado?.hechas);
  const ultima = [...(estado?.hechas || [])].filter((s) => lista.some((x) => x.id === s.sesion_ejercicio_id))
    .sort((a, b) => String(a.registrada_en).localeCompare(String(b.registrada_en))).pop();
  const proxima = ultima ? trasSerie(lista, cuenta, ultima.sesion_ejercicio_id, resolverReloj).siguiente : null;
  const sig = serieQueToca(lista, porPauta, proxima);
  if (!sig) return null;
  const se = lista.find((x) => x.id === sig.id);
  return se ? { se, numero: sig.numero, hechasSe: porPauta[se.id] || {} } : null;
}

// ¿Frena la carga hoy? (día flojo o malo en «¿Cómo llegas hoy?»: en el reloj no se elige, así que no se sube)
export const frenaHoy = (preparacion) => !!consejoPreparacion(preparacion)?.frenar;

// Lo que enseña el reloj. hoy no hace falta: todo sale del estado.
export function vistaReloj(estado) {
  const u = unidadDe(estado?.unidad);
  const otras = (estado?.otras || []).slice(0, 12);
  const extraOtras = otras.length ? { otras: otras.map((o) => o.nombre), otras_ids: Object.fromEntries(otras.map((o) => [o.nombre, o.id])) } : { otras: [], otras_ids: {} };
  if (!estado?.sesion) {
    return { ok: true, estado: 'nada', titulo: 'Nada que entrenar', texto: 'No tienes ninguna sesión pendiente esta semana. ¡A descansar!', opciones: [], acciones: {}, ...extraOtras };
  }
  const s = estado.sesion;
  const base = { ok: true, sesion_id: s.id, sesion: s.nombre, unidad: u, ...extraOtras };
  if (s.completada) return { ...base, estado: 'nada', titulo: s.nombre, texto: `${s.nombre}: ya está hecha.`, opciones: [], acciones: {} };
  if (s.tipo === 'cardio' || !(estado.ejercicios || []).length) {
    const opciones = [OPCION.terminar, ...(otras.length ? [OPCION.otra] : [])];
    return { ...base, estado: 'cardio', titulo: s.nombre,
      texto: `${s.nombre}\n${s.tipo === 'cardio' ? 'Es de cardio: llévala con el Entreno del reloj y, al acabar, termínala aquí o en la app.' : 'No tiene ejercicios que apuntar desde el reloj.'}`,
      opciones, acciones: accionesDe(opciones) };
  }
  const sig = serieSiguiente(estado);
  if (!sig) {
    const opciones = [OPCION.terminar, ...(otras.length ? [OPCION.otra] : [])];
    return { ...base, estado: 'terminar', titulo: s.nombre, texto: `${s.nombre}\nNo queda ninguna serie. ¿La terminas?`, opciones, acciones: accionesDe(opciones) };
  }
  const { se, numero, hechasSe } = sig;
  const sustituto = Object.values(hechasSe).find((x) => x.sustituto_id)?.sustituto_id || null;
  let prop = null;
  try {
    prop = propuestaReloj(se, estado.ultimas?.[se.ejercicio_id] || null, numero, hechasSe,
      { foco: estado.foco, progresionAuto: estado.progresion_auto !== false, frenar: frenaHoy(estado.preparacion), cambiado: !!sustituto });
  } catch { prop = null; }
  let kg = prop?.kg != null && Number(prop.kg) > 0 ? Number(prop.kg) : null;
  // En libras, lo que propone la app se redondea a lo que se carga (lo que repite de la serie anterior, no)
  if (kg != null && u === 'lb' && !(hechasSe[numero - 1] && Number(hechasSe[numero - 1].kg) === kg)) kg = redondearCarga(kg, 'lb');
  const reps = prop?.reps != null ? Number(prop.reps) : null;
  const etiqueta = etiquetasSuperserie(estado.ejercicios)[se.id];
  const nombre = `${etiqueta ? `${etiqueta} ` : ''}${se.ejercicio?.nombre || 'Ejercicio'}${sustituto ? ' (cambiado)' : ''}`;
  const serie = nombreSerie(se, numero);
  const esfuerzo = objetivoEsfuerzo(se, prop);
  const carga = kg != null ? `${cargaTxt(kg, u)}${reps != null ? ` × ${reps}` : ''}` : reps != null ? `${reps} reps` : null;
  const previa = (estado.ultimas?.[se.ejercicio_id]?.series || []).find((x) => Number(x.numero) === numero);
  const ultimaVez = !sustituto && previa ? `La última vez: ${Number(previa.kg) > 0 ? `${cargaTxt(previa.kg, u)} × ${previa.reps ?? '—'}` : `${previa.reps ?? '—'} reps`}` : null;
  const opciones = [`${OPCION.hecha}${carga ? ` · ${carga}` : ''}`, OPCION.cambiar, OPCION.saltar, OPCION.terminar, ...(otras.length ? [OPCION.otra] : [])];
  const acciones = accionesDe(opciones);
  return {
    ...base, estado: 'serie', titulo: nombre,
    texto: [nombre, serie, [carga, esfuerzo].filter(Boolean).join(' · '), ultimaVez].filter(Boolean).join('\n'),
    serie, carga, esfuerzo, ref: `${se.id}:${numero}`,
    // Lo que sale por defecto al cambiar (en la unidad del reloj, sin redondeos raros)
    kg: kg != null ? vista(kg, u) : null, reps, opciones, acciones,
  };
}

function accionesDe(opciones) {
  const m = {};
  for (const o of opciones) {
    if (o.startsWith(OPCION.hecha)) m[o] = 'hecha';
    else if (o === OPCION.cambiar) m[o] = 'cambiar';
    else if (o === OPCION.saltar) m[o] = 'saltar';
    else if (o === OPCION.terminar) m[o] = 'terminar';
    else if (o === OPCION.otra) m[o] = 'otra';
  }
  return m;
}

// ---------------------------------------------------------------- lo que manda el atajo
const ACCIONES = ['ver', 'hecha', 'cambiar', 'saltar', 'terminar', 'elegir', 'otra'];
// El cuerpo del atajo, limpio: { accion, ref: { pauta, numero }, kg (en kilos), reps, rir, rpe, sesion }
// Los números, como los escribe el iPhone en español («82,5»). Lo que no vale, null (y la acción, 'ver').
export function limpiarPeticion(cuerpo, unidad = 'kg') {
  const c = cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? cuerpo : {};
  const corto = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, 40) : null);
  let accion = corto(c.accion);
  accion = accion && ACCIONES.includes(accion.trim().toLowerCase()) ? accion.trim().toLowerCase() : 'ver';
  let ref = null;
  const m = corto(c.ref)?.match(/^([0-9a-f-]{36}):(\d{1,2})$/i);
  if (m && UUID.test(m[1])) ref = { pauta: m[1].toLowerCase(), numero: Number(m[2]) };
  const n = (v, { entero = false, min = 0, max = 9999 } = {}) => {
    const x = leerNumero(corto(v) ?? v, { entero });
    if (x == null || x < min || x > max) return null;
    return entero ? Math.round(x) : x;
  };
  const kgVista = n(c.kg, { max: 9999 });
  const sesion = corto(c.sesion)?.trim();
  return {
    accion, ref,
    kg: kgVista == null ? null : deVista(kgVista, unidadDe(unidad)),
    reps: n(c.reps, { entero: true, max: 1000 }),
    rir: n(c.rir, { max: 10 }),
    rpe: n(c.rpe, { min: 1, max: 10 }),
    sesion: sesion && UUID.test(sesion) ? sesion.toLowerCase() : null,
  };
}

// Tras guardar una serie: el descanso que toca (segundos; 0, seguir: superserie) y el aviso para el reloj
export function trasGuardar(estadoAntes, pauta, kg, reps, unidad) {
  const u = unidadDe(unidad);
  const saltados = new Set(estadoAntes?.saltados || []);
  const lista = (estadoAntes?.ejercicios || []).filter((x) => !saltados.has(x.id));
  const { cuenta } = mapasHechas(estadoAntes?.hechas);
  const yaEstaba = (estadoAntes?.hechas || []).some((s) => s.sesion_ejercicio_id === pauta.pauta && s.numero === pauta.numero);
  const cuentaTras = { ...cuenta, [pauta.pauta]: (cuenta[pauta.pauta] || 0) + (yaEstaba ? 0 : 1) };
  const t = lista.some((x) => x.id === pauta.pauta) ? trasSerie(lista, cuentaTras, pauta.pauta, resolverReloj) : { descanso: null };
  const descanso = Number(t.descanso) || 0;
  const hecho = Number(kg) > 0 ? `${cargaTxt(kg, u)} × ${reps ?? '—'}` : `${reps ?? '—'} reps`;
  return { descanso_seg: descanso, mensaje: `Guardada: ${hecho}.${descanso ? ` Descanso ${mmss(descanso)}.` : t.enRonda ? ' Sigue con el siguiente de la superserie.' : ''}` };
}

export const MENSAJES_RELOJ = {
  clave: 'Esta clave ya no vale: crea otra en la app (Perfil → Apple Watch) y pégala en el atajo.',
  baja: 'Tu cuenta está de baja: desde el reloj ya no se apunta nada.',
  sesion: 'Esa sesión ya no está disponible: vuelve a abrir el atajo.',
  terminada: 'Esa sesión ya está terminada.',
  datos: 'Faltan los kilos o las repeticiones (o no valen).',
};

export const textoRpe = (r) => (r == null ? '' : `esfuerzo ${num(r)}`);
