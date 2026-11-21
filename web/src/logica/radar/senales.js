// Radar de contacto (v0.201): lo que se lee de cada atleta para entender cómo está. Lógica pura.
//   · enfriandoDe: «se está enfriando», cuando se juntan varias señales (con el porqué de cada una)
//   · resumenCheckin: su último check-in en una línea (sueño, energía, motivación, comida y su nota)
//   · objetivoPrincipal: su objetivo en curso y cómo va (de lo que ya calcula api.objetivos)
import { diasEntre } from '../fechas.js';

export const DIAS_SIN_ABRIR = 7;

const num = (x, d = 1) => String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ',');

// resumen: la fila del panel (chispas.sesiones: las 6 semanas de la minigráfica, la última es la actual);
// mensajes: { ult, prev } (mensajesDelAtleta); conexion: su última conexión (ISO) o null si no se sabe o la oculta
export function enfriandoDe({ resumen: r, mensajes = null, conexion = null, hoy }) {
  const razones = [];
  if (conexion) {
    const dias = diasEntre(String(conexion).slice(0, 10), hoy);
    if (dias >= DIAS_SIN_ABRIR) razones.push({ id: 'app', texto: `No abre la app desde hace ${dias} días`, dias });
  }
  const sem = r?.servicio !== 'nutricion' ? (r?.chispas?.sesiones || []) : [];
  if (sem.length >= 5) {
    // Las dos últimas semanas acabadas frente a las tres de antes
    const ult = sem.slice(-3, -1), prev = sem.slice(-6, -3).filter(Boolean);
    const media = (xs) => (xs.length ? xs.reduce((t, w) => t + (Number(w?.hechas) || 0), 0) / xs.length : 0);
    const mu = media(ult), mp = media(prev);
    if (prev.length >= 2 && mp >= 1.5 && mu <= mp * 0.6) razones.push({ id: 'entrena', texto: `Entrena menos que su media (${num(mu)} sesiones por semana, antes ${num(mp)})` });
  }
  if (mensajes && mensajes.prev >= 4 && mensajes.ult <= mensajes.prev / 2) {
    razones.push({ id: 'escribe', texto: `Te escribe menos que antes (${mensajes.ult} ${mensajes.ult === 1 ? 'mensaje' : 'mensajes'} en 2 semanas, antes ${mensajes.prev})` });
  }
  return razones.length >= 2 ? { razones } : null;
}

const SUENO = { '<5': 'menos de 5 h', '5-6': '5-6 h', '6-7': '6-7 h', '7-8': '7-8 h', '>8': 'más de 8 h' };
const ADH = { 1: 25, 2: 40, 3: 60, 4: 85, 5: 100 };   // la marca de cada respuesta de adherencia, para hacer la media

// c: la fila del check-in (o null). → { semana, partes: ['Sueño 6-7 h', 'Energía 3/5', …], nota, bajo: [...] }
export function resumenCheckin(c) {
  if (!c) return null;
  const partes = [], bajo = [];
  if (c.horas_sueno && SUENO[c.horas_sueno]) { partes.push(`Sueño ${SUENO[c.horas_sueno]}`); if (c.horas_sueno === '<5' || c.horas_sueno === '5-6') bajo.push('sueño'); }
  if (c.energia) { partes.push(`Energía ${c.energia}/5`); if (c.energia <= 2) bajo.push('energía'); }
  if (c.recuperacion) { partes.push(`Recuperación ${c.recuperacion}/5`); if (c.recuperacion <= 2) bajo.push('recuperación'); }
  if (c.motivacion) { partes.push(`Motivación ${c.motivacion}/5`); if (c.motivacion <= 2) bajo.push('motivación'); }
  const adh = ['adherencia_desayuno', 'adherencia_comida', 'adherencia_merienda', 'adherencia_cena'].map((k) => ADH[c[k]]).filter((x) => x != null);
  if (adh.length) {
    const pct = Math.round(adh.reduce((a, b) => a + b, 0) / adh.length / 5) * 5;
    partes.push(`Comida ${pct} %`);
    if (pct < 50) bajo.push('comida');
  }
  const nota = String(c.notas || '').trim() || null;
  return { semana: c.semana_inicio || null, partes, nota, bajo, revisado: !!c.revisado_en };
}

// lista: lo que devuelve api.objetivos(atletaId). El primero en curso (el de fecha más cercana), con su progreso:
// { titulo, pct, conseguido, cerca, aTiempo, prevision, peso: { alejandose, parado } | null }
export function objetivoPrincipal(lista = []) {
  const vivos = (lista || []).filter((o) => o && !['completado', 'descartado'].includes(o.estado));
  const o = vivos[0];
  if (!o) return null;
  const a = o.auto || null, p = o.autoPeso || null;
  const pct = a?.pct ?? p?.pct ?? (Number.isFinite(Number(o.progreso_pct)) ? Number(o.progreso_pct) : null);
  const conseguido = !!(a?.conseguido || a?.yaLoPermite || p?.llegado);
  const prevision = a?.prevision || p?.prevision || null;
  return {
    id: o.id, titulo: o.titulo || o.ejercicio || 'Su objetivo', pct: pct == null ? null : Math.max(0, Math.min(100, Math.round(pct))),
    conseguido, cerca: !conseguido && pct != null && pct >= 85,
    aTiempo: prevision?.aTiempo ?? null, prevision: prevision?.fecha || null, fecha: o.fecha_limite || null,
    peso: p ? { alejandose: !!p.alejandose, parado: !p.llegado && !p.prevision && !p.alejandose && !p.sinRecientes && !p.sinPesos } : null,
  };
}
