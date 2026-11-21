// Radar de contacto (v0.202): lo tuyo de «A quién escribir» que se guarda en la base (radar_ajustes.datos, migración
// 086) y vale igual en el móvil y en el ordenador. Lógica pura.
//   estilo      tu manera de escribir (borrador.js)
//   objetivos   { [atleta_id]: 1 | 2 | 3 } días de contacto por semana con cada uno (de serie, 2)
//   tonos       { [atleta_id]: tono } el tono que mejor le va (sale el primero)
//   enlace      tu enlace para reservar una llamada (Calendly o el que uses)
//   envios      [{ a, t, tono }] los últimos mensajes enviados desde aquí con su tono (para «con qué tono te contesta»)
//   hablado     { [atleta_id]: [{ dia, canal }] } «Ya hablamos» y por dónde (WhatsApp, llamada, en persona)
//   pospuestos  { [atleta_id]: hasta } «Mañana»
//   reenganche  { [atleta_id]: dia } a qué antiguo atleta ya le escribiste (solo una vez)
import { limpiarEstilo, TONOS } from './borrador.js';
import { sumarDias, fechaMadrid } from '../fechas.js';
import { DIAS_HISTORIA } from './contactos.js';

export const OBJETIVO_DEFECTO = 2;
export const OBJETIVOS = [1, 2, 3];
export const CANALES = ['app', 'whatsapp', 'llamada', 'persona'];
export const NOMBRE_CANAL = { app: 'Otra vía', whatsapp: 'WhatsApp', llamada: 'Llamada', persona: 'En persona' };
export const MAX_ENVIOS = 100;   // (la fila entera cabe en 16 KB)
const UUID = /^[0-9a-fA-F-]{36}$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

// Un enlace http(s) razonable (sin espacios ni caracteres de control), de hasta 300 letras; si no, ''
export function limpiarEnlace(x) {
  const t = String(x || '').trim();
  if (!t || t.length > 300 || /[\s\u0000-\u001f\u007f]/.test(t)) return '';
  try { const u = new URL(t); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
}

export function limpiarAjustesRadar(d, hoy = fechaMadrid()) {
  const x = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  const objetivos = {}, tonos = {}, hablado = {}, pospuestos = {}, reenganche = {};
  for (const [id, n] of Object.entries(x.objetivos || {}).slice(0, 500)) if (UUID.test(id) && OBJETIVOS.includes(Number(n))) objetivos[id] = Number(n);
  for (const [id, t] of Object.entries(x.tonos || {}).slice(0, 500)) if (UUID.test(id) && TONOS.includes(t)) tonos[id] = t;
  const desde = sumarDias(hoy, -(DIAS_HISTORIA - 1));
  for (const [id, xs] of Object.entries(x.hablado || {}).slice(0, 500)) {
    if (!UUID.test(id) || !Array.isArray(xs)) continue;
    const v = [];
    for (const h of xs) if (h && DIA.test(h.dia) && h.dia >= desde && h.dia <= hoy && !v.some((o) => o.dia === h.dia)) v.push({ dia: h.dia, canal: CANALES.includes(h.canal) ? h.canal : 'app' });
    if (v.length) hablado[id] = v.sort((a, b) => (a.dia < b.dia ? -1 : 1));
  }
  for (const [id, h] of Object.entries(x.pospuestos || {}).slice(0, 500)) if (UUID.test(id) && DIA.test(h) && h > hoy) pospuestos[id] = h;
  for (const [id, h] of Object.entries(x.reenganche || {}).slice(0, 500)) if (UUID.test(id) && DIA.test(h)) reenganche[id] = h;
  const envios = (Array.isArray(x.envios) ? x.envios : [])
    .filter((e) => e && UUID.test(e.a) && TONOS.includes(e.tono) && !Number.isNaN(Date.parse(e.t)))
    .map((e) => ({ a: e.a, t: `${new Date(e.t).toISOString().slice(0, 16)}Z`, tono: e.tono })).slice(-MAX_ENVIOS);
  return { estilo: limpiarEstilo(x.estilo), objetivos, tonos, enlace: limpiarEnlace(x.enlace), envios, hablado, pospuestos, reenganche };
}

export const objetivoDe = (aj, atletaId) => aj?.objetivos?.[atletaId] || OBJETIVO_DEFECTO;
export const tonoPreferido = (aj, atletaId) => aj?.tonos?.[atletaId] || null;

// Apuntar un envío con su tono (los últimos MAX_ENVIOS)
export function conEnvio(aj, { atleta, tono, t = new Date().toISOString() }) {
  if (!TONOS.includes(tono)) return aj;
  return { ...aj, envios: [...(aj?.envios || []), { a: atleta, t: `${new Date(t).toISOString().slice(0, 16)}Z`, tono }].slice(-MAX_ENVIOS) };
}

// Con qué tono te contesta más: de tus envíos con tono a ese atleta, cuántos tuvieron respuesta suya en 48 h.
// comentarios: los del radar (con autor y creado_en). → { tono, contestadas, total, porTono } o null (pocos datos)
export function tonoQueContesta(envios = [], comentarios = [], atletaId) {
  const suyos = (comentarios || []).filter((c) => c && c.atleta_id === atletaId && c.autor === 'atleta' && !c.eliminado_en && !c.resumen_sesion)
    .map((c) => Date.parse(c.creado_en)).filter(Number.isFinite);
  const porTono = {};
  for (const e of (envios || []).filter((x) => x.a === atletaId)) {
    const t = Date.parse(e.t);
    const p = (porTono[e.tono] ||= { total: 0, contestadas: 0 });
    p.total++;
    if (suyos.some((s) => s > t && s - t <= 48 * 3600000)) p.contestadas++;
  }
  const mejores = Object.entries(porTono).filter(([, p]) => p.total >= 2).sort((a, b) => (b[1].contestadas / b[1].total) - (a[1].contestadas / a[1].total) || b[1].total - a[1].total);
  if (!mejores.length || !mejores[0][1].contestadas) return null;
  const [tono, p] = mejores[0];
  return { tono, contestadas: p.contestadas, total: p.total, porTono };
}

// «Ya hablamos» y «Mañana» de este aparato y de la base, juntos: { fuera: { id: [dias] }, pospuestos, canales: { id: { dia: canal } } }
export function juntarLocal(local = {}, aj = {}) {
  const fuera = {}, canales = {};
  for (const [id, dias] of Object.entries(local.fuera || {})) fuera[id] = [...dias];
  for (const [id, xs] of Object.entries(aj.hablado || {})) {
    fuera[id] = [...new Set([...(fuera[id] || []), ...xs.map((h) => h.dia)])].sort();
    canales[id] = Object.fromEntries(xs.map((h) => [h.dia, h.canal]));
  }
  for (const [id, c] of Object.entries(local.canales || {})) canales[id] = { ...(canales[id] || {}), ...c };
  const pospuestos = { ...(aj.pospuestos || {}) };
  for (const [id, h] of Object.entries(local.pospuestos || {})) if (!pospuestos[id] || h > pospuestos[id]) pospuestos[id] = h;
  return { fuera, pospuestos, canales };
}

// Apuntar (o quitar) «Ya hablamos» de hoy en lo de la base, con su canal; y «Mañana»
export function conHablado(aj, atletaId, hoy, si = true, canal = 'app') {
  const xs = (aj?.hablado?.[atletaId] || []).filter((h) => h.dia !== hoy);
  if (si) xs.push({ dia: hoy, canal: CANALES.includes(canal) ? canal : 'app' });
  const hablado = { ...(aj?.hablado || {}) };
  if (xs.length) hablado[atletaId] = xs; else delete hablado[atletaId];
  const pospuestos = { ...(aj?.pospuestos || {}) };
  if (si) delete pospuestos[atletaId];
  return { ...aj, hablado, pospuestos };
}
export function conPospuesto(aj, atletaId, hoy, n = 1) {
  const pospuestos = { ...(aj?.pospuestos || {}) };
  if (n > 0) pospuestos[atletaId] = sumarDias(hoy, Math.min(7, Math.trunc(n))); else delete pospuestos[atletaId];
  return { ...aj, pospuestos };
}
