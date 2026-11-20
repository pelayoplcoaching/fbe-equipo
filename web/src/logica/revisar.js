// (v0.195) La pestaña «Revisar» del coach: lo que hay que mirar primero, agrupar por día, apartar hasta mañana, buscar
// por nombre, los récords de cada sesión y el contexto de cada atleta. Todo puro: sin base, sin pantalla.
import { e1rmDe } from './revision.js';
import { consejoPreparacion } from './preparacion.js';
import { normal } from './busqueda.js';

const n1 = (v) => (Math.round(Number(v) * 10) / 10).toLocaleString('es-ES');
const pad = (n) => String(n).padStart(2, '0');
const aISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const masDias = (iso, n) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); const x = new Date(y, m - 1, d); x.setDate(x.getDate() + n); return aISO(x); };
const esDia = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
// El día (en la hora del aparato) de una fecha o de un instante
export function diaDe(v) {
  if (!v) return null;
  if (esDia(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : aISO(d);
}

// ---------------------------------------------------------------- cuándo llegó cada cosa
// Lo que se usa para «Hoy / Ayer / Esta semana» y para saber cuánto lleva esperando: un instante o un día
export function fechaItem(x) {
  if (!x) return null;
  if (x.tipo === 'mensajes') return x.h?.ultimo?.creado_en || null;
  if (x.tipo === 'sesiones') return x.s?.fecha_realizada || null;
  if (x.tipo === 'checkins') return x.c?.creado_en || x.c?.enviado_en || (x.c?.semana_inicio ? masDias(x.c.semana_inicio, 6) : null);
  if (x.tipo === 'videos') return x.g ? x.g.videos.map((v) => v.creado_en).filter(Boolean).sort()[0] || null : x.a?.creado_en || x.a?.fecha || null;
  if (x.tipo === 'tareas') return x.t?.hecha_en || null;
  if (x.tipo === 'recetas') return x.r?.cambio_pedido_en || null;
  if (x.tipo === 'objetivos') return x.o?.creado_en || null;
  if (x.tipo === 'comunidad') return x.r?.creado_en || null;
  return null;
}
// Horas desde que llegó (un día suelto cuenta desde su mediodía)
export function horasDesde(v, ahora = new Date()) {
  if (!v) return null;
  const t = esDia(v) ? new Date(`${v}T12:00:00`).getTime() : Date.parse(v);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (ahora.getTime() - t) / 3600000);
}

// ---------------------------------------------------------------- lo urgente
// Qué hace urgente una cosa: { nivel: 'alta' | 'media' | null, motivos: [texto] }
export function urgenciaItem(x, ahora = new Date()) {
  const motivos = [];
  let alta = false, media = false;
  const pon = (t, a = false) => { motivos.push(t); if (a) alta = true; else media = true; };
  if (x?.tipo === 'checkins') {
    const c = x.c || {};
    const fuerte = (c.molestias || []).find((m) => Number(m.intensidad) >= 3);
    const media2 = (c.molestias || []).find((m) => Number(m.intensidad) === 2);
    if (fuerte) pon('Molestia fuerte', true); else if (media2) pon('Molestia moderada');
    if ((c.energia != null && Number(c.energia) <= 2) || (c.recuperacion != null && Number(c.recuperacion) <= 2)) pon(Number(c.energia) <= 2 ? 'Energía baja' : 'Recuperación baja');
  } else if (x?.tipo === 'sesiones') {
    const s = x.s || {};
    if (Number(s.rpeMax) >= 10) pon('Alguna serie a RPE 10');
    if (s.preparacion && consejoPreparacion(s.preparacion)?.nivel === 'malo') pon('Llegó en un día difícil');
  } else if (x?.tipo === 'mensajes') {
    if (String(x.h?.ultimo?.texto || '').includes('?')) pon('Te pregunta algo');
  } else if (x?.tipo === 'videos') {
    const vs = x.g ? x.g.videos : [x.a];
    if (vs.some((v) => v?.autoevaluacion?.molestia)) pon('Molestia en el vídeo', true);
  } else if (x?.tipo === 'objetivos') pon('Espera tu respuesta a un objetivo');
  const h = horasDesde(fechaItem(x), ahora);
  if (h != null && h >= 72 && x?.tipo !== 'comunidad') pon('Lleva más de 3 días esperando');
  return { nivel: alta ? 'alta' : media ? 'media' : null, motivos, horas: h };
}
const PESO = { alta: 2, media: 1 };
export const pesoUrgencia = (u) => PESO[u?.nivel] || 0;
// El nivel de un atleta (el de lo más urgente suyo) y sus motivos, sin repetir
export function urgenciaGrupo(items, ahora = new Date()) {
  const us = (items || []).map((x) => urgenciaItem(x, ahora));
  const max = Math.max(0, ...us.map(pesoUrgencia));
  return { nivel: max === 2 ? 'alta' : max === 1 ? 'media' : null, motivos: [...new Set(us.flatMap((u) => u.motivos))] };
}
// Lo urgente primero: dentro de cada grupo, sus cosas por urgencia (y, a igualdad, la que más espera); los grupos, por
// la más urgente que tengan y, a igualdad, por la que más espera
export function ordenarUrgente(grupos, ahora = new Date()) {
  const clave = (x) => { const u = urgenciaItem(x, ahora); return [pesoUrgencia(u), u.horas ?? -1]; };
  const cmp = (a, b) => b[0] - a[0] || b[1] - a[1];
  return (grupos || []).map((g) => {
    const items = [...g.items].map((x) => [x, clave(x)]).sort((a, b) => cmp(a[1], b[1]));
    return { ...g, items: items.map(([x]) => x), _k: items[0]?.[1] || [0, -1] };
  }).sort((a, b) => cmp(a._k, b._k)).map(({ _k, ...g }) => g);
}

// ---------------------------------------------------------------- agrupar por día
export const DIAS_REVISAR = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Esta semana'], ['antes', 'Antes']];
export function tramoDia(v, hoy) {
  const d = diaDe(v);
  if (!d) return 'antes';
  if (d >= hoy) return 'hoy';
  if (d === masDias(hoy, -1)) return 'ayer';
  if (d >= masDias(hoy, -6)) return 'semana';
  return 'antes';
}
// [{ id: 'dia-hoy', titulo: 'Hoy', items, n, tipos }], lo más nuevo arriba dentro de cada uno
export function agruparPorDia(items, hoy) {
  const grupos = new Map(DIAS_REVISAR.map(([k, t]) => [k, { id: `dia-${k}`, titulo: t, dia: k, atleta: null, items: [] }]));
  for (const x of items || []) grupos.get(tramoDia(fechaItem(x), hoy)).items.push(x);
  const t = (x) => { const f = fechaItem(x); return f ? (esDia(f) ? `${f}T12:00:00` : f) : ''; };
  return [...grupos.values()].filter((g) => g.items.length).map((g) => {
    const lista = [...g.items].sort((a, b) => (t(a) < t(b) ? 1 : t(a) > t(b) ? -1 : 0));
    const tipos = {};
    for (const x of lista) tipos[x.tipo] = (tipos[x.tipo] || 0) + 1;
    return { ...g, items: lista, n: lista.length, tipos };
  });
}

// ---------------------------------------------------------------- «Recordármelo mañana»
// mapa: { clave: 'YYYY-MM-DD' } (el día en que vuelve a salir). Solo quedan las que aún no han vuelto.
export function pospuestosVigentes(mapa, hoy) {
  const out = {};
  for (const [k, d] of Object.entries(mapa || {})) if (esDia(d) && d > hoy) out[k] = d;
  return out;
}
export const posponer = (mapa, clave, hoy, dias = 1) => ({ ...pospuestosVigentes(mapa, hoy), [clave]: masDias(hoy, dias) });
export function sinPosponer(mapa, clave) { const { [clave]: _fuera, ...resto } = mapa || {}; return resto; }

// ---------------------------------------------------------------- buscar por nombre
export const normalTexto = (t) => normal(t).trim();
export function coincideNombre(nombre, q) {
  const b = normalTexto(q);
  if (!b) return true;
  const n = normalTexto(nombre);
  return b.split(/\s+/).every((p) => n.includes(p));
}

// ---------------------------------------------------------------- lo nuevo que llega mientras miras
// Lo que no estaba al entrar (o al tocar «Ver lo nuevo») se queda aparte para no mover la lista
export function separarNuevas(items, conocidas) {
  if (!conocidas) return { vistas: items || [], nuevas: [] };
  const vistas = [], nuevas = [];
  for (const x of items || []) (conocidas.has(x.clave) ? vistas : nuevas).push(x);
  return { vistas, nuevas };
}

// ---------------------------------------------------------------- dar por revisado varias a la vez
// Las cosas que se pueden dar por revisadas sin contestar: [{ clave, marcas: [{ tipo, id }] }]
export function revisablesDe(items) {
  const out = [];
  for (const x of items || []) {
    if (x.tipo === 'sesiones') out.push({ clave: x.clave, marcas: [{ tipo: 'sesion', id: x.s.id }] });
    else if (x.tipo === 'checkins') out.push({ clave: x.clave, marcas: [{ tipo: 'checkin', id: x.c.id }] });
    else if (x.tipo === 'videos' && x.g) out.push({ clave: x.clave, marcas: x.g.videos.map((v) => ({ tipo: 'archivo', id: v.id })) });
    else if (x.tipo === 'videos' && x.a) out.push({ clave: x.clave, marcas: [{ tipo: 'archivo', id: x.a.id }] });
    else if (x.tipo === 'tareas') out.push({ clave: x.clave, marcas: [{ tipo: 'tarea', id: x.t.id }] });
  }
  return out;
}
const LISTA_DE = { sesion: 'sesiones', checkin: 'checkins', archivo: 'archivos', tarea: 'tareas' };
// La bandeja sin esas marcas (para verlo al momento mientras se guarda): da lo mismo si se aplica dos veces
export function bandejaSin(d, marcas) {
  if (!d) return d;
  const fuera = {};
  for (const m of marcas || []) (fuera[LISTA_DE[m.tipo]] ||= new Set()).add(m.id);
  let quitadas = 0;
  const out = { ...d };
  for (const [lista, ids] of Object.entries(fuera)) {
    const antes = d[lista] || [];
    const queda = antes.filter((x) => !ids.has(x.id));
    quitadas += antes.length - queda.length;
    out[lista] = queda;
  }
  // Los vídeos de una misma sesión cuentan como una cosa en el total (como se ven): se cuenta por tarjeta, aproximado
  return quitadas ? { ...out, total: Math.max(0, (d.total || 0) - Math.min(quitadas, (marcas || []).length)) } : d;
}

// ---------------------------------------------------------------- récords y bajadas de una sesión
// series: las de su historial (api.historial: fecha, sesion_id, ejercicio_id, ejercicio, kg, reps, rpe, rir, registrada_en)
// Devuelve { records: [{ ejercicio_id, ejercicio, marca }], bajas: [{ ejercicio_id, ejercicio, marca, antes }] }:
// récord = su mejor 1RM estimado de siempre (con algo antes con que comparar); baja = un 3 % o más por debajo de la
// última vez que lo hizo
export function marcasSesion(series, sesion) {
  const vacio = { records: [], bajas: [] };
  if (!sesion?.id) return vacio;
  const de = (series || []).filter((s) => s.sesion_id === sesion.id && Number(s.reps) > 0);
  if (!de.length) return vacio;
  const dia = sesion.fecha_realizada || de[0].fecha;
  const primera = de.map((s) => s.registrada_en).filter(Boolean).sort()[0] || null;
  const antesDe = (s) => s.sesion_id !== sesion.id && s.fecha && (s.fecha < dia || (s.fecha === dia && primera && s.registrada_en && s.registrada_en < primera));
  const mejorPor = (lista) => {
    const m = new Map();
    for (const s of lista) {
      const v = e1rmDe(s);
      if (v == null || !s.ejercicio_id) continue;
      const ya = m.get(s.ejercicio_id);
      if (!ya || v > ya.v) m.set(s.ejercicio_id, { v, kg: Number(s.kg), reps: Number(s.reps), nombre: s.ejercicio || 'Ejercicio' });
    }
    return m;
  };
  const hoy = mejorPor(de);
  const previas = (series || []).filter(antesDe);
  const records = [], bajas = [];
  for (const [id, x] of hoy) {
    const suyas = previas.filter((s) => s.ejercicio_id === id);
    if (!suyas.length) continue;
    const mejorAntes = mejorPor(suyas).get(id);
    const marca = `${n1(x.kg)} kg x ${x.reps}`;
    if (mejorAntes && x.v > mejorAntes.v * 1.001) { records.push({ ejercicio_id: id, ejercicio: x.nombre, marca }); continue; }
    // La última vez: la sesión más reciente de antes en que lo hizo
    const ultima = suyas.reduce((a, s) => (!a || s.fecha > a.fecha || (s.fecha === a.fecha && String(s.registrada_en || '') > String(a.registrada_en || '')) ? s : a), null);
    const deUltima = mejorPor(suyas.filter((s) => s.sesion_id === ultima.sesion_id)).get(id);
    if (deUltima && x.v < deUltima.v * 0.97) bajas.push({ ejercicio_id: id, ejercicio: x.nombre, marca, antes: `${n1(deUltima.kg)} kg x ${deUltima.reps}` });
  }
  const porNombre = (a, b) => a.ejercicio.localeCompare(b.ejercicio, 'es');
  return { records: records.sort(porNombre), bajas: bajas.sort(porNombre) };
}

// ---------------------------------------------------------------- el contexto de cada atleta
// ctx: { semana, total, bloque, ultima } (ultima: instante de tu última respuesta, o null)
export function textoContexto(ctx, ahora = new Date()) {
  if (!ctx) return '';
  const partes = [];
  if (ctx.semana != null) partes.push(ctx.total ? `Semana ${ctx.semana} de ${ctx.total}${ctx.bloque ? ` de «${ctx.bloque}»` : ''}` : `Semana ${ctx.semana}`);
  if (ctx.ultima) {
    const dias = Math.round((new Date(aISO(ahora)).getTime() - new Date(diaDe(ctx.ultima)).getTime()) / 86400000);
    partes.push(dias <= 0 ? 'le has contestado hoy' : dias === 1 ? 'le contestaste ayer' : `le contestaste hace ${dias} días`);
  } else if (ctx.ultima === null) partes.push('aún no le has contestado nada');
  const t = partes.join(', ');
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}
// De los bloques y semanas de un atleta, en qué semana va hoy: { semana, total, bloque, bloqueId } o null
export function semanaDelBloque(bloques, semanas, hoy) {
  const lunes = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); const x = new Date(y, m - 1, d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return aISO(x); };
  const lh = lunes(hoy);
  const conFecha = (semanas || []).filter((w) => w.fecha_inicio);
  let w = conFecha.find((x) => lunes(x.fecha_inicio) === lh) || null;
  if (!w) w = conFecha.filter((x) => x.fecha_inicio <= hoy).sort((a, b) => (a.fecha_inicio < b.fecha_inicio ? 1 : -1))[0] || null;
  if (!w) {
    // Sin fechas: el bloque más reciente (el último creado), su primera semana sin publicar o la última
    const b = [...(bloques || [])].sort((a, z) => String(z.creado_en || z.fecha_inicio || '').localeCompare(String(a.creado_en || a.fecha_inicio || '')))[0];
    if (!b) return null;
    return { semana: null, total: (semanas || []).filter((x) => x.bloque_id === b.id).length || null, bloque: b.nombre || null, bloqueId: b.id };
  }
  const b = (bloques || []).find((x) => x.id === w.bloque_id) || null;
  return { semana: w.numero ?? null, total: (semanas || []).filter((x) => x.bloque_id === w.bloque_id).length || null, bloque: b?.nombre || null, bloqueId: w.bloque_id };
}

// ---------------------------------------------------------------- el check-in frente al anterior (corto, para la tarjeta)
// lineas: las de lineasCheckin(c, anterior). Solo las que cambian: [{ etiqueta, valor, antes, cambio }]
export const cambiosCheckin = (lineas) => (lineas || []).filter((l) => l.antes && (l.cambio || l.clave === 'horas_sueno'));

// ---------------------------------------------------------------- lo revisado hoy
export const NOMBRE_REVISADO = { sesion: 'Sesión', checkin: 'Check-in', archivo: 'Vídeo', tarea: 'Tarea' };
export function textoCuentaDia(n) {
  if (!n) return '';
  return n === 1 ? 'Hoy has revisado 1 cosa.' : `Hoy has revisado ${n} cosas.`;
}
