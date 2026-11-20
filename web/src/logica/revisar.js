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

// ================================================================ v0.196: segunda tanda
// ---------------------------------------------------------------- la gráfica del ejercicio principal de la sesión
// El que más series tiene en la sesión (a igualdad, el de más 1RM estimado) y su mejor 1RM estimado en cada una de sus
// últimas sesiones (hasta 8, terminando en esta): { ejercicio_id, ejercicio, puntos: [{ fecha, valor }] } o null
export function principalSesion(series, sesion, max = 8) {
  if (!sesion?.id) return null;
  const de = (series || []).filter((s) => s.sesion_id === sesion.id && Number(s.reps) > 0 && s.ejercicio_id);
  if (!de.length) return null;
  const cuenta = new Map();
  for (const s of de) {
    const c = cuenta.get(s.ejercicio_id) || { n: 0, v: 0, nombre: s.ejercicio || 'Ejercicio' };
    c.n++; c.v = Math.max(c.v, e1rmDe(s) || 0);
    cuenta.set(s.ejercicio_id, c);
  }
  const [id, info] = [...cuenta.entries()].sort((a, b) => b[1].n - a[1].n || b[1].v - a[1].v)[0];
  const dia = sesion.fecha_realizada || de[0].fecha;
  const porSesion = new Map();
  for (const s of series || []) {
    if (s.ejercicio_id !== id || !s.fecha || s.fecha > dia || !s.sesion_id) continue;
    const v = e1rmDe(s);
    if (v == null) continue;
    const x = porSesion.get(s.sesion_id);
    if (!x || v > x.valor) porSesion.set(s.sesion_id, { fecha: s.fecha, valor: Math.round(v * 10) / 10, esta: s.sesion_id === sesion.id });
  }
  const puntos = [...porSesion.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)).slice(-max);
  return puntos.length >= 2 ? { ejercicio_id: id, ejercicio: info.nombre, puntos } : null;
}

// ---------------------------------------------------------------- filtrar por motivo
export const MOTIVOS_REVISAR = [['molestias', 'Molestias'], ['preguntas', 'Preguntas'], ['rpe10', 'RPE 10'], ['esperando', 'Más de 3 días']];
const PRUEBA_MOTIVO = {
  molestias: (m) => /^Molestia|Lleg\u00f3 en un d\u00eda dif\u00edcil/.test(m),
  preguntas: (m) => m === 'Te pregunta algo',
  rpe10: (m) => m === 'Alguna serie a RPE 10',
  esperando: (m) => m === 'Lleva más de 3 días esperando',
};
export const cumpleMotivo = (x, k, ahora = new Date()) => !k || urgenciaItem(x, ahora).motivos.some(PRUEBA_MOTIVO[k] || (() => false));

// ---------------------------------------------------------------- tus frases, por tipo
export const TIPOS_FRASES = [['sesiones', 'Para sesiones'], ['checkins', 'Para check-ins'], ['videos', 'Para vídeos'], ['todo', 'Para todo']];
// Las de ese tipo primero y luego las de todo, sin repetir (hasta 8)
export function frasesPara(tipo, porTipo, generales) {
  const propias = tipo && tipo !== 'todo' ? (porTipo?.[tipo] || []) : [];
  return [...new Set([...propias, ...(generales || [])].map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 8);
}
export function conFraseTipo(porTipo, tipo, frase, max = 20) {
  const t = String(frase || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!t) return porTipo || {};
  const lista = (porTipo?.[tipo] || []).filter((x) => x !== t);
  return { ...(porTipo || {}), [tipo]: [...lista, t].slice(-max) };
}
export const sinFraseTipo = (porTipo, tipo, frase) => ({ ...(porTipo || {}), [tipo]: (porTipo?.[tipo] || []).filter((x) => x !== frase) });
// El texto de «Visto»: el tuyo (corto) o el de siempre
export const textoVisto = (t) => { const x = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 60); return x || 'Visto 💪'; };
export const EMOJIS_REVISAR = ['👍', '💪', '❤️', '🙏'];

// ---------------------------------------------------------------- «Mañana», con más opciones
// Días hasta el próximo lunes (si hoy es lunes, el de la semana que viene)
export function diasHastaLunes(hoy) {
  const [y, m, d] = String(hoy).split('-').map(Number);
  const dia = new Date(y, m - 1, d).getDay();   // 0 domingo … 6 sábado
  return ((8 - dia) % 7) || 7;
}
export const OPCIONES_APARTAR = (hoy) => [['1', 'Mañana', 1], ['3', 'En 3 días', 3], ['lunes', 'El lunes', diasHastaLunes(hoy)]];
// Las filas de la base (083) a un mapa { clave: { hasta, fijada } }; las pasadas y sin fijar, fuera (y se dicen aparte
// para borrarlas)
export function mapaApartados(filas, hoy) {
  const mapa = {}, viejas = [];
  for (const f of filas || []) {
    const vale = f.fijada || f.etiqueta || (esDia(f.hasta) && f.hasta > hoy);
    if (!vale) { viejas.push(f.clave); continue; }
    mapa[f.clave] = { hasta: esDia(f.hasta) && f.hasta > hoy ? f.hasta : null, fijada: !!f.fijada, etiqueta: f.etiqueta || null };
  }
  return { mapa, viejas };
}
// Del mapa de «Mañana» de este aparato (de antes de la 083: { clave: 'YYYY-MM-DD' }) al de ahora
export function mapaDesdeLocal(local, fijadas, hoy) {
  const mapa = {};
  for (const [k, d] of Object.entries(pospuestosVigentes(local, hoy))) mapa[k] = { hasta: d, fijada: false };
  for (const k of fijadas || []) mapa[k] = { ...(mapa[k] || { hasta: null }), fijada: true };
  return mapa;
}
export const apartadaHoy = (m, clave, hoy) => { const x = m?.[clave]; return !!(x && esDia(x.hasta) && x.hasta > hoy); };
export const fijada = (m, clave) => !!m?.[clave]?.fijada;
export { masDias as sumarDiasRevisar };

// ---------------------------------------------------------------- tus tiempos, de todo
const mediana = (xs) => { if (!xs.length) return null; const o = [...xs].sort((a, b) => a - b); const m = Math.floor(o.length / 2); return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
const p90 = (xs) => { if (!xs.length) return null; const o = [...xs].sort((a, b) => a - b); return o[Math.max(0, Math.ceil(0.9 * o.length) - 1)]; };
// pares: [{ llega, hecho }] (instantes, o un día suelto: su mediodía). → { mediana, p90, n } en horas
export function tiemposDe(pares) {
  const t = (v) => (esDia(v) ? new Date(`${v}T12:00:00`).getTime() : Date.parse(v));
  const hs = (pares || []).map((p) => (t(p.hecho) - t(p.llega)) / 3600000).filter((h) => Number.isFinite(h) && h >= 0);
  return { mediana: mediana(hs), p90: p90(hs), n: hs.length };
}

// ---------------------------------------------------------------- la bandeja a cero, cada día
export function conDia(dias, hoy, max = 90) { return [...new Set([...(dias || []).filter(esDia), hoy])].sort().slice(-max); }
// Días seguidos (acabando hoy o ayer) en que la dejaste a cero
export function rachaCeros(dias, hoy) {
  const s = new Set((dias || []).filter(esDia));
  let d = s.has(hoy) ? hoy : masDias(hoy, -1);
  let n = 0;
  while (s.has(d)) { n++; d = masDias(d, -1); }
  return n;
}
export const textoRacha = (n) => (n >= 2 ? `${n} días seguidos dejándola a cero` : n === 1 ? 'Hoy la has dejado a cero' : '');

// ---------------------------------------------------------------- el resumen de la tanda
export function textoResumenTanda({ revisadas = 0, contestadas = 0, desde = null, quedan = 0 }, ahora = Date.now()) {
  const min = desde ? Math.max(1, Math.round((ahora - desde) / 60000)) : null;
  const partes = [];
  partes.push(revisadas === 1 ? '1 revisada' : `${revisadas} revisadas`);
  if (contestadas) partes.push(contestadas === 1 ? '1 contestada' : `${contestadas} contestadas`);
  if (min) partes.push(min === 1 ? 'en 1 minuto' : `en ${min} minutos`);
  return `${partes.join(', ')}. ${quedan ? (quedan === 1 ? 'Queda 1.' : `Quedan ${quedan}.`) : 'No queda nada.'}`;
}

// ---------------------------------------------------------------- las teclas
export const ATAJOS_REVISAR = [
  ['j / k', 'Bajar y subir (en dos columnas, la siguiente y la anterior)'], ['r', 'Responder'], ['e', 'Dar por revisado'], ['v', 'Visto'],
  ['m', 'Para mañana'], ['p', 'Programar'], ['u', 'Deshacer lo último'], ['o', 'Abrir su ficha'], ['b', 'Buscar un atleta'], ['?', 'Ver estas teclas'],
];

// ---------------------------------------------------------------- la nota para la revisión semanal
// La nota de la semana con lo nuevo al final (como mucho 500 caracteres, cortando lo más viejo si no cabe)
export function notaConMas(nota, texto, max = 500) {
  const nuevo = String(texto || '').replace(/\s+/g, ' ').trim();
  const antes = String(nota || '').trim();
  if (!nuevo) return antes;
  let t = antes ? `${antes} · ${nuevo}` : nuevo;
  if ([...t].length > max) t = [...t].slice(-max).join('').replace(/^[^\u00b7]*\u00b7\s*/, '') || [...nuevo].slice(0, max).join('');
  return t;
}

// Una línea de lo que es cada cosa (para la lista de la vista en dos columnas)
export function resumenItem(x) {
  const corto = (t, n = 70) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
  if (x.tipo === 'mensajes') return x.h?.ultimo?.texto ? `«${corto(x.h.ultimo.texto)}»` : x.h?.ultimo?.audio ? 'Nota de voz' : 'Mensaje';
  if (x.tipo === 'sesiones') return x.s?.nombre ? `Sesión: ${corto(x.s.nombre, 50)}` : 'Sesión';
  if (x.tipo === 'checkins') return 'Check-in';
  if (x.tipo === 'videos') return x.g ? `${x.g.videos.length} vídeos de una sesión` : x.a?.tipo === 'foto_progreso' ? 'Foto de progreso' : x.a?.ejercicio?.nombre ? `Vídeo: ${corto(x.a.ejercicio.nombre, 50)}` : 'Vídeo';
  if (x.tipo === 'tareas') return x.t?.titulo ? `Tarea: ${corto(x.t.titulo, 50)}` : 'Tarea';
  if (x.tipo === 'recetas') return 'Pide cambiar una receta';
  if (x.tipo === 'objetivos') return 'Propone un objetivo';
  return 'Aviso del equipo';
}

// ================================================================ v0.197: tercera tanda
// ---------------------------------------------------------------- tus frases con huecos que se rellenan solos
// {nombre}, {récord} (o {record}), {esfuerzo}, {series} y {ejercicio}. Si un dato no está, su hueco desaparece.
export const HUECOS_FRASES = ['{nombre}', '{récord}', '{esfuerzo}', '{series}', '{ejercicio}'];
export function rellenarFrase(frase, nombre, vars = {}) {
  const primer = String(nombre || '').trim().split(/\s+/)[0] || '';
  const dato = { nombre: primer, record: vars.record, 'récord': vars.record, esfuerzo: vars.esfuerzo, series: vars.series, ejercicio: vars.ejercicio };
  return String(frase || '')
    .replace(/\{(nombre|r[e\u00e9]cord|esfuerzo|series|ejercicio)\}/gi, (_, k) => { const v = dato[k.toLowerCase()]; return v == null || v === '' ? '' : String(v); })
    .replace(/\s+([,.!?;:])/g, '$1').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').replace(/^[\s,]+/, '').replace(/[\s,;:]+$/, '').trim();
}
// Los datos de una tarjeta para esos huecos
export function variablesDe(x, marcas = {}) {
  if (x?.tipo === 'sesiones') {
    const s = x.s || {};
    const m = marcas?.[s.id];
    const r = m?.records?.[0];
    return {
      record: r ? `${r.ejercicio.toLowerCase()} (${r.marca})` : null,
      esfuerzo: s.rpe_sesion != null ? n1(s.rpe_sesion) : null,
      series: s.series ? `${s.series.hechas}/${s.series.pautadas}` : null,
      ejercicio: m?.principal?.ejercicio ? m.principal.ejercicio.toLowerCase() : null,
    };
  }
  if (x?.tipo === 'videos' && x.a) return { ejercicio: x.a.ejercicio?.nombre ? x.a.ejercicio.nombre.toLowerCase() : null };
  return {};
}

// ---------------------------------------------------------------- la respuesta redactada con sus datos
export function borradorTarjeta(x, marcas = {}, nombre = '') {
  const primer = String(nombre || x?.atleta?.nombre || '').trim().split(/\s+/)[0] || '';
  const hola = primer ? `¡Bien, ${primer}!` : '¡Bien!';
  if (x?.tipo === 'sesiones') {
    const s = x.s || {};
    const m = marcas?.[s.id] || { records: [], bajas: [] };
    const partes = [`${hola} ${s.nombre || 'La sesión'}${s.series?.pautadas ? `: ${s.series.hechas} de ${s.series.pautadas} series` : ''}${s.rpe_sesion != null ? `, con un esfuerzo de ${n1(s.rpe_sesion)}` : ''}.`];
    if (m.records.length) partes.push(m.records.length === 1 ? `Récord en ${m.records[0].ejercicio.toLowerCase()} (${m.records[0].marca}), ¡enhorabuena!` : `Récords en ${m.records.map((r) => r.ejercicio.toLowerCase()).join(' y ')}, ¡enhorabuena!`);
    if (m.bajas.length) partes.push(`En ${m.bajas[0].ejercicio.toLowerCase()} bajaste algo respecto a la última vez: ¿cómo te notaste?`);
    if (s.series && s.series.hechas < s.series.pautadas) partes.push('Te faltaron algunas series: cuéntame si fue por tiempo o porque no llegabas.');
    if (Number(s.rpeMax) >= 10) partes.push('Alguna serie se fue a RPE 10: ojo con apurar tanto, mejor dejar 1 o 2 en la recámara.');
    if (s.nota_atleta) partes.push('Gracias por la nota, me ayuda mucho.');
    return partes.join(' ');
  }
  if (x?.tipo === 'checkins') {
    const c = x.c || {};
    const partes = [`¡Gracias por el check-in${primer ? `, ${primer}` : ''}!`];
    const fuerte = (c.molestias || []).find((mm) => Number(mm.intensidad) >= 2);
    if (fuerte) partes.push('He visto la molestia que marcas: cuéntame cuándo te aparece y si va a más, y lo ajustamos.');
    if (c.energia != null && Number(c.energia) <= 2) partes.push('La energía está baja esta semana: ¿cómo vas de sueño y de estrés?');
    else if (c.energia != null && Number(c.energia) >= 4) partes.push('Me alegra ver la energía alta.');
    if (c.notas) partes.push('Leído lo que comentas, lo tengo en cuenta para la semana que viene.');
    return partes.join(' ');
  }
  if (x?.tipo === 'videos') {
    const ej = x.a?.ejercicio?.nombre ? ` de ${x.a.ejercicio.nombre.toLowerCase()}` : '';
    return `${hola} Visto el vídeo${ej}.`;
  }
  if (x?.tipo === 'mensajes') return primer ? `¡Hola, ${primer}! ` : '';
  return '';
}

// ---------------------------------------------------------------- avisos de patrón
// checkins: los suyos de las últimas semanas (cualquier orden); molestias: las suyas (con semana_inicio y zona);
// saltadas: sesiones de semanas ya pasadas que se quedaron sin hacer ([{ nombre, lunes }])
export function patronesAtleta({ checkins = [], molestias = [], saltadas = [] } = {}) {
  const out = [];
  const ck = [...checkins].sort((a, b) => (a.semana_inicio < b.semana_inicio ? 1 : -1));
  if (ck.length >= 3 && ck.slice(0, 3).every((c) => c.energia != null && Number(c.energia) <= 2)) out.push({ clave: 'energia', nivel: 'alta', texto: 'Tres semanas seguidas con la energía baja' });
  else if (ck.length >= 2 && ck.slice(0, 2).every((c) => c.recuperacion != null && Number(c.recuperacion) <= 2)) out.push({ clave: 'recuperacion', nivel: 'media', texto: 'Dos semanas seguidas recuperando mal' });
  const semanas = [...new Set(ck.map((c) => c.semana_inicio))].slice(0, 3);
  const zonas = new Map();
  for (const m of molestias) if (Number(m.intensidad) >= 1 && semanas.includes(m.semana_inicio)) { const s = zonas.get(m.zona) || new Set(); s.add(m.semana_inicio); zonas.set(m.zona, s); }
  for (const [zona, s] of zonas) if (s.size >= 2) out.push({ clave: `molestia-${zona}`, nivel: 'alta', zona, texto: `La misma molestia vuelve (${s.size} semanas)` });
  if (saltadas.length >= 2) out.push({ clave: 'saltadas', nivel: 'media', texto: `${saltadas.length} sesiones sin hacer en las últimas semanas`, sesiones: saltadas.map((x) => x.nombre) });
  else if (saltadas.length === 1) out.push({ clave: 'saltadas', nivel: null, texto: `Se quedó sin hacer: ${saltadas[0].nombre}`, sesiones: [saltadas[0].nombre] });
  return out;
}

// ---------------------------------------------------------------- lo urgente, contado (para la pestaña)
export function urgentesBandeja(d) {
  if (!d) return 0;
  let n = 0;
  for (const c of d.checkins || []) if ((c.molestias || []).some((m) => Number(m.intensidad) >= 3)) n++;
  for (const a of d.archivos || []) if (a.autoevaluacion?.molestia) n++;
  return n;
}

// ---------------------------------------------------------------- lo siguiente más importante y cuánto te queda
export function siguienteImportante(items, ahora = new Date()) {
  let mejor = null, k = null;
  for (const x of items || []) {
    const u = urgenciaItem(x, ahora);
    const v = [pesoUrgencia(u), u.horas ?? -1];
    if (!k || v[0] > k[0] || (v[0] === k[0] && v[1] > k[1])) { k = v; mejor = x; }
  }
  return mejor;
}
// Minutos por tipo (de partida) o lo que llevas de media en esta tanda (si ya llevas tres o más)
export const MINUTOS_TIPO = { mensajes: 1.5, sesiones: 2, checkins: 3, videos: 4, tareas: 1.5, recetas: 1.5, objetivos: 2, comunidad: 1 };
export function minutosRestantes(items, tanda = null, ahora = Date.now()) {
  const n = (items || []).length;
  if (!n) return 0;
  const hechas = (tanda?.revisadas || 0) + (tanda?.contestadas || 0);
  if (hechas >= 3 && tanda?.desde) return Math.max(1, Math.round(((ahora - tanda.desde) / 60000 / hechas) * n));
  return Math.max(1, Math.round((items || []).reduce((t, x) => t + (MINUTOS_TIPO[x.tipo] || 2) * (x.tipo === 'videos' && x.g ? x.g.videos.length : 1), 0)));
}
export const textoRestante = (min) => (!min ? '' : min < 60 ? `Te quedan unos ${min} min` : `Te quedan unas ${Math.floor(min / 60)} h${min % 60 >= 10 ? ` y ${min % 60} min` : ''}`);

// ---------------------------------------------------------------- tus etiquetas
export const limpiarEtiqueta = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 30);
export const ETIQUETAS_PARTIDA = ['Para la llamada', 'Esperando analítica', 'Hablar en la revisión'];
export function etiquetasDe(mapa) { return [...new Set(Object.values(mapa || {}).map((v) => v?.etiqueta).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')); }

// ---------------------------------------------------------------- el volumen de su semana, por músculo
// cuenta: { grupo: series }; rango(grupo) → [min, max]. → [{ grupo, n, min, max, estado }] (los que tienen algo)
export function volumenTarjeta(cuenta, rango) {
  return Object.entries(cuenta || {}).filter(([, n]) => n > 0).map(([grupo, n]) => {
    const [min, max] = rango(grupo);
    return { grupo, n: Math.round(n * 2) / 2, min, max, estado: n < min ? 'bajo' : n > max ? 'alto' : 'dentro' };
  }).sort((a, b) => b.n - a.n);
}

// ---------------------------------------------------------------- deslizar a la izquierda
export const esDeslizarIzquierda = (dx, dy, ancho) => dx < 0 && Math.abs(dx) > Math.max(80, ancho * 0.35) && Math.abs(dx) > Math.abs(dy) * 1.5;

// ---------------------------------------------------------------- sin conexión: lo que se hace, en cola
// cola: [{ id, op, args }]; op: 'revisar' | 'comentar' | 'leidos'
export function conOp(cola, op, args) { return [...(cola || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, op, args }].slice(-200); }
