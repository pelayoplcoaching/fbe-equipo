// FBE Esencial (sin coach, tanda 2): el cierre de la semana de quien va por su cuenta. Lógica pura: qué enseñar en Hoy
// según su semana (la pregunta del domingo, lo que eligió, la semana que viene ya lista, la pausa) y los textos.
// Lo que se elige se apunta en la propia semana (migración 098): esencial_cierre ('pasar' | 'auto' | 'repetir' | 'pausa'),
// esencial_cierre_lunes (el lunes de la semana natural en que se eligió) y esencial_repetida (cuántas veces).
const DIA = 864e5;
const sumar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const lunesDe = (iso) => { const d = new Date(`${iso}T12:00:00Z`).getUTCDay(); return sumar(iso, -((d + 6) % 7)); };
const dia = (v) => (v ? String(v).slice(0, 10) : null);

export const HORA_PREGUNTA = '21:00';   // el domingo, desde esa hora, se pregunta (hora de Madrid)
export const HORA_AUTO = '23:30';       // sin respuesta a esa hora, se pasa a la siguiente (lo hace la base y avisa)
export const MAX_REPETIR = 2;           // la misma semana, como mucho dos veces (como en la base)

// «21:37» en Madrid (para saber si ya toca preguntar)
export function horaMadrid(d = new Date()) {
  try {
    const p = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
    const h = p.find((x) => x.type === 'hour')?.value, m = p.find((x) => x.type === 'minute')?.value;
    return `${h === '24' ? '00' : h}:${m}`;
  } catch { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
}

// ¿Lo elegido para esa semana es de esta semana natural? (una semana repetida vuelve a preguntarse el domingo siguiente)
export const cierreDe = (w, lunes) => (w && w.esencial_cierre && dia(w.esencial_cierre_lunes) === lunes ? w.esencial_cierre : null);

// semanas: las suyas publicadas (las del bloque en marcha); sesiones: { semana_id: [{ completada, fecha_realizada, orden }] }
// hoy: 'AAAA-MM-DD' (Madrid); hora: 'HH:MM' (Madrid).
// Devuelve { tipo, … }:
//  · 'pausa':     su semana está en pausa (corrida al lunes que viene esta misma semana): vuelve, o «Volver ya»
//  · 'pregunta':  domingo desde las 21:00, con sesiones sin hacer y sin elegir: pasar o repetir (puedeRepetir)
//  · 'pasada':    ya eligió pasar (o se pasó a las 23:30): la siguiente, mañana
//  · 'lista':     semana completa y la siguiente ya preparada: se puede adelantar su primera sesión (si hoy no ha hecho otra)
//  · 'repite':    esta semana es una repetida: lo que le queda
//  · null:        nada que decir
export function estadoCierre({ semanas = [], sesiones = {}, hoy, hora = '00:00' } = {}) {
  if (!hoy) return null;
  const lunes = lunesDe(hoy), domingo = sumar(lunes, 6), proximo = sumar(lunes, 7);
  const propias = semanas.filter((w) => w.fecha_inicio && (w.programacion || 'programada') === 'programada');
  const de = (w) => sesiones[w.id] || [];
  const faltanDe = (w) => de(w).filter((s) => !s.completada).length;
  const enPausa = propias.find((w) => dia(w.fecha_inicio) === proximo && cierreDe(w, lunes) === 'pausa');
  if (enPausa) return { tipo: 'pausa', semana: enPausa, vuelve: proximo, faltan: faltanDe(enPausa) };
  const w = propias.find((x) => dia(x.fecha_inicio) === lunes);
  if (!w || !de(w).length) return null;
  const faltan = faltanDe(w), total = de(w).length;
  const siguiente = propias.find((x) => dia(x.fecha_inicio) === proximo) || null;
  if (!faltan) {
    if (!siguiente) return null;
    const hechaHoy = propias.some((x) => de(x).some((s) => s.completada && dia(s.fecha_realizada) === hoy));
    const primera = [...de(siguiente)].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).find((s) => !s.completada) || null;
    return { tipo: 'lista', semana: w, siguiente, primera, puedeAdelantar: !!primera && !hechaHoy, empezada: de(siguiente).some((s) => s.completada) };
  }
  const elegido = cierreDe(w, lunes);
  if (elegido === 'pasar' || elegido === 'auto') return { tipo: 'pasada', semana: w, faltan, total, auto: elegido === 'auto', siguiente };
  if (hoy === domingo && hora >= HORA_PREGUNTA) {
    return { tipo: 'pregunta', semana: w, faltan, total, puedeRepetir: (Number(w.esencial_repetida) || 0) < MAX_REPETIR, hastaLas: HORA_AUTO };
  }
  if ((Number(w.esencial_repetida) || 0) > 0 && w.esencial_cierre === 'repetir') return { tipo: 'repite', semana: w, faltan, total, veces: Number(w.esencial_repetida) };
  return null;
}

// ¿Se puede poner en pausa esta semana? (con una semana en curso y sesiones sin hacer; no en pausa ya)
export function puedePausar({ semanas = [], sesiones = {}, hoy } = {}) {
  const e = estadoCierre({ semanas, sesiones, hoy, hora: '00:00' });
  if (e?.tipo === 'pausa' || e?.tipo === 'pasada' || e?.tipo === 'lista') return false;
  const lunes = lunesDe(hoy);
  const w = semanas.find((x) => dia(x.fecha_inicio) === lunes && (x.programacion || 'programada') === 'programada');
  return !!w && (sesiones[w.id] || []).some((s) => !s.completada);
}

const n = (k, uno, varios) => (k === 1 ? uno : `${k} ${varios}`);
// Los textos de cada caso (para la tarjeta de Hoy y para probarlos)
export function textoCierre(e, { fechaLarga = (x) => x } = {}) {
  if (!e) return null;
  if (e.tipo === 'pregunta') {
    return {
      titulo: `Tu semana acaba hoy y te ${e.faltan === 1 ? 'queda una sesión' : `quedan ${e.faltan} sesiones`}`,
      texto: e.puedeRepetir ? '¿Pasas a la semana siguiente o repites esta?' : 'Ya has repetido esta semana dos veces: toca pasar a la siguiente.',
      pasar: 'La app te prepara la semana nueva con lo que has apuntado. Lo que no has hecho no se recupera doblando.',
      repetir: 'Tu plan se corre una semana: lo hecho se queda hecho y haces lo que te falta de lunes a domingo.',
      plazo: `Si no eliges antes de las ${e.hastaLas}, pasamos a la siguiente.`,
    };
  }
  if (e.tipo === 'pasada') {
    return { titulo: e.siguiente ? 'Tu semana siguiente ya está lista' : 'Mañana, semana nueva',
      texto: e.auto ? 'Como no elegiste, te hemos dejado programada tu siguiente semana.' : 'Pasas a la siguiente: empieza el lunes.' };
  }
  if (e.tipo === 'lista') {
    return { titulo: 'Tu semana que viene ya está lista',
      texto: e.empezada ? 'Ya has adelantado su primera sesión: el resto, desde el lunes.'
        : e.puedeAdelantar ? 'Semana hecha. Si te viene mejor, puedes adelantar su primera sesión (no dos el mismo día).'
          : 'Semana hecha. Desde mañana puedes adelantar su primera sesión, si te viene mejor.' };
  }
  if (e.tipo === 'pausa') {
    return { titulo: 'Tu semana está en pausa', texto: `Vuelves el ${fechaLarga(e.vuelve)}, con ${n(e.faltan, 'la sesión que te quedaba', 'las sesiones que te quedaban')}. Mientras, no te llegan avisos de entreno.` };
  }
  if (e.tipo === 'repite') {
    return { titulo: `Repites esta semana: te ${e.faltan === 1 ? 'queda una sesión' : `quedan ${e.faltan} sesiones`}`, texto: 'Lo que hiciste la semana pasada se queda hecho.' };
  }
  return null;
}
