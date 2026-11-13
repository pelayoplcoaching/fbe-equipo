// (apuntes, tanda C) Camino y progreso: los temas y su dominio (de «Visto» a «Dominado»), la prueba de nivel del
// principio, la ruta «Fundamentos FBE» con su examen final y su certificado, el objetivo diario con sus puntos y el
// comodín de racha, y «Tu mes en apuntes». Lógica pura, sobre lo guardado en el móvil (logica/apuntes.js).
import { limpiarVistos, examenDe, cursosDe, progresoCurso, GLOSARIO } from './apuntes.js';
import { sumarDias, lunesDe } from './fechas.js';
import { normal } from './busqueda.js';

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const lista = (x) => (Array.isArray(x) ? x : []);

// ---------- Los temas ----------
export const TEMAS = [['tecnica', 'Técnica'], ['programacion', 'Programación'], ['nutricion', 'Nutrición'], ['recuperacion', 'Recuperación'], ['mentalidad', 'Mentalidad']];
export const nombreTema = (t) => TEMAS.find(([k]) => k === t)?.[1] || '';
const POR_GUIA = {
  manual: 'programacion', rutinas: 'programacion', progresion: 'programacion', deload: 'programacion', volver: 'programacion', cardio: 'programacion', calentamiento: 'programacion',
  composicion: 'nutricion', nutricion: 'nutricion', proteina: 'nutricion', recetas: 'nutricion', suplementos: 'nutricion', dieta: 'nutricion',
  sueno: 'recuperacion', descanso: 'recuperacion', recuperacion: 'recuperacion', lesiones: 'recuperacion', dolor: 'recuperacion',
  motivacion: 'mentalidad', habitos: 'mentalidad', mentalidad: 'mentalidad', constancia: 'mentalidad',
};
const porPalabras = (s) => {
  const t = normal(s);
  if (/nutri|dieta|comid|protein|caloria|grasa|carbohidrat|suplement|creatina/.test(t)) return 'nutricion';
  if (/sueno|dormir|descans|recupera|lesion|dolor|estira/.test(t)) return 'recuperacion';
  if (/motiva|habito|ganas|constancia|mental|estres/.test(t)) return 'mentalidad';
  if (/tecnica|postura|agarre|rango|movimiento/.test(t)) return 'tecnica';
  return null;
};
// El tema de un apunte (o null: las dudas de la app, las novedades sueltas…)
export function temaDe(a) {
  if (!a || a.efimero) return null;
  if (['clave', 'error', 'musculo', 'clip', 'correccion'].includes(a.tipo)) return 'tecnica';
  if (a.tipo === 'glosario') return 'programacion';
  if (a.tipo === 'test' && /^q:/.test(a.id || '')) return 'tecnica';
  if ((a.tipo === 'idea' || a.tipo === 'mito') && a.guia) {
    if (a.tipo === 'mito') return porPalabras(`${a.de} ${a.titulo}`) || 'programacion';
    return POR_GUIA[a.guia] || porPalabras(`${a.de} ${a.guia}`) || 'tecnica';
  }
  if (['coach', 'apunte'].includes(a.tipo) || a.coach) return a.ejercicio ? 'tecnica' : porPalabras(`${a.titulo} ${a.texto}`);
  return null;
}

// ---------- El dominio de cada tema ----------
// visto: lo ha visto; practicado: lo ha recordado o acertado alguna vez (caja 1 o más, o lo sabía); dominado: caja 3 o
// más (ha pasado por tres repasos espaciados). El nivel del tema: «Dominado» con el 70 % dominado; «Practicado» con
// la mitad practicada; «Visto» con la mitad vista; si no, «Empezando» (o «Sin empezar»).
export const NIVELES = { nuevo: 'Sin empezar', empezando: 'Empezando', visto: 'Visto', practicado: 'Practicado', dominado: 'Dominado' };
export function dominio(apuntes = [], estado = null) {
  const v = limpiarVistos(estado).vistos;
  const vistos = new Set();
  const out = TEMAS.map(([tema, nombre]) => ({ tema, nombre, total: 0, vistos: 0, practicados: 0, dominados: 0 }));
  for (const a of lista(apuntes)) {
    const t = temaDe(a);
    if (!t || vistos.has(a.id)) continue;
    vistos.add(a.id);
    const fila = out.find((x) => x.tema === t), x = v[a.id];
    fila.total += 1;
    if (x) fila.vistos += 1;
    if (x && ((x.c || 0) >= 1 || x.s === true)) fila.practicados += 1;
    if (x && (x.c || 0) >= 3) fila.dominados += 1;
  }
  return out.filter((f) => f.total > 0).map((f) => {
    const nivel = f.dominados >= f.total * 0.7 ? 'dominado' : f.practicados >= f.total / 2 ? 'practicado' : f.vistos >= f.total / 2 ? 'visto' : f.vistos > 0 ? 'empezando' : 'nuevo';
    return { ...f, nivel, etiqueta: NIVELES[nivel], pct: Math.round(((f.vistos + f.practicados + f.dominados) / (3 * f.total)) * 100) };
  });
}

// ---------- El objetivo diario, los puntos y el comodín de racha ----------
export const META_DEFECTO = 3;
export const PUNTOS = { visto: 5, sabia: 10, no: 2 };
export const PREMIO_META = 20;          // al cumplir el objetivo del día
export const MAX_COMODINES = 2;
export const metaDe = (estado) => limpiarVistos(estado).meta || META_DEFECTO;
export function elegirMeta(estado, n) {
  const e = limpiarVistos(estado);
  return limpiarVistos({ ...e, meta: [1, 3, 5].includes(n) ? n : null });
}
// Uno más hoy (r: 'visto', 'sabia' o 'no'), con sus puntos
export function sumarDiario(estado, hoy, r = 'visto') {
  const e = limpiarVistos(estado);
  if (!DIA.test(hoy || '')) return e;
  const d = e.diario?.[hoy] || { n: 0, xp: 0 };
  return limpiarVistos({ ...e, diario: { ...(e.diario || {}), [hoy]: { n: d.n + 1, xp: d.xp + (PUNTOS[r] ?? PUNTOS.visto) } } });
}
export function hoyEnApuntes(estado, hoy) {
  const e = limpiarVistos(estado), meta = metaDe(e), d = e.diario?.[hoy] || { n: 0, xp: 0 };
  return { n: d.n, meta, hecho: d.n >= meta, xp: d.xp + (d.n >= meta ? PREMIO_META : 0), falta: Math.max(0, meta - d.n) };
}
// La racha de días cumpliendo el objetivo. Cada semana (de lunes a domingo) con el objetivo cumplido cinco días o más da
// un comodín (dos como mucho guardados); un día sin cumplir se tapa solo con un comodín, si hay. Hoy, si aún no lo ha
// cumplido, no rompe la racha (aún está a tiempo).
export function rachaDiaria(estado, hoy) {
  const e = limpiarVistos(estado), meta = metaDe(e), diario = e.diario || {};
  const dias = Object.keys(diario).filter((d) => d < hoy).sort();
  const res = { dias: 0, comodines: 0, usados: 0, hoyHecho: (diario[hoy]?.n || 0) >= meta };
  if (!DIA.test(hoy || '')) return res;
  if (dias.length) {
    let racha = 0, stock = 0, usados = 0, semana = 0;
    for (let d = dias[0]; d < hoy; d = sumarDias(d, 1)) {
      const hecho = (diario[d]?.n || 0) >= meta;
      if (hecho) { racha += 1; semana += 1; }
      else if (racha > 0 && stock > 0) { stock -= 1; usados += 1; }
      else { racha = 0; usados = 0; }
      if (sumarDias(d, 1) === sumarDias(lunesDe(d), 7)) { if (semana >= 5) stock = Math.min(MAX_COMODINES, stock + 1); semana = 0; }
    }
    Object.assign(res, { dias: racha, comodines: stock, usados });
  }
  if (res.hoyHecho) res.dias += 1;
  return res;
}
export function puntosTotales(estado) {
  const e = limpiarVistos(estado), meta = metaDe(e);
  return Object.values(e.diario || {}).reduce((s, d) => s + d.xp + (d.n >= meta ? PREMIO_META : 0), 0);
}

// ---------- La prueba de nivel ----------
// Ocho preguntas, dos por tema que tenga con qué preguntar: del glosario («¿Qué es…?») para Programación y «¿Verdad o
// mito?» con las ideas y los mitos de cada tema. Se ofrece al empezar (con menos de cinco vistos y sin hacerla).
export const puedeHacerPrueba = (estado) => { const e = limpiarVistos(estado); return !e.prueba && Object.keys(e.vistos).length < 5; };
export function pruebaDeNivel(apuntes = [], hoy = '', n = 8) {
  const preguntas = [];
  for (const [tema] of TEMAS) {
    const delTema = lista(apuntes).filter((a) => temaDe(a) === tema && ['idea', 'mito', 'glosario'].includes(a.tipo));
    if (!delTema.length) continue;
    const examen = examenDe(delTema.concat(tema === 'programacion' ? [] : lista(apuntes).filter((a) => a.tipo === 'glosario')), null, { hoy: `${hoy}:${tema}`, n: 6 }) || [];
    const propias = examen.filter((q) => delTema.some((a) => a.id === q.origen)).slice(0, 2);
    for (const q of propias) preguntas.push({ ...q, id: `n:${q.origen}`, etiqueta: 'Prueba de nivel', tema });
  }
  return preguntas.length >= 4 ? preguntas.slice(0, n) : null;
}
// Al acabar: los temas en los que acertó todas (con dos preguntas o más) se dan por sabidos: lo básico de ese tema queda
// visto (caja 2: vuelve a repasarse en una semana) y no le sale como nuevo
export function aplicarNivel(estado, preguntas = [], aciertos = [], apuntes = [], hoy = '') {
  const e = limpiarVistos(estado);
  const porTema = new Map();
  lista(preguntas).forEach((q, i) => { const t = porTema.get(q.tema) || { bien: 0, total: 0 }; t.total += 1; if (aciertos[i]) t.bien += 1; porTema.set(q.tema, t); });
  const saltados = [...porTema].filter(([, t]) => t.total >= 2 && t.bien === t.total).map(([tema]) => tema);
  const vistos = { ...e.vistos };
  if (DIA.test(hoy || '')) {
    for (const a of lista(apuntes)) {
      if (!saltados.includes(temaDe(a)) || !['idea', 'glosario'].includes(a.tipo) || vistos[a.id]) continue;
      vistos[a.id] = { n: 1, t: hoy, s: true, c: 2, p: sumarDias(hoy, 7) };
    }
  }
  const total = lista(preguntas).length, bien = aciertos.filter(Boolean).length;
  return limpiarVistos({ ...e, vistos, prueba: { dia: hoy, aciertos: bien, total, saltados } });
}

// ---------- La ruta «Fundamentos FBE» ----------
// Los cursos de las guías (cada uno, un módulo) en un orden que va de lo básico a lo demás; hasta seis. Con todos
// hechos, el examen final (diez preguntas de lo de la ruta y del glosario): con el 80 %, el certificado.
export const ORDEN_RUTA = ['manual', 'rutinas', 'progresion', 'calentamiento', 'deload', 'volver', 'composicion', 'nutricion', 'proteina', 'sueno', 'descanso', 'motivacion', 'habitos', 'cardio', 'mitos'];
export const APRUEBA = 0.8;
export function rutaFundamentos(apuntes = []) {
  const pos = (c) => { const i = ORDEN_RUTA.indexOf(c.clave); return i < 0 ? ORDEN_RUTA.indexOf('mitos') - 0.5 : i; };   // (las de músculos y demás, antes de los mitos)
  return cursosDe(apuntes).sort((a, b) => pos(a) - pos(b)).slice(0, 6);
}
export function progresoRuta(modulos = [], estado = null) {
  const e = limpiarVistos(estado);
  const pr = modulos.map((m) => ({ ...m, ...progresoCurso(m, e) }));
  const hechos = pr.filter((m) => m.hecho).length;
  return { modulos: pr, hechos, total: modulos.length, todo: modulos.length > 0 && hechos === modulos.length, certificado: e.certificado || null, siguiente: pr.find((m) => !m.hecho) || null };
}
export function examenFinal(modulos = [], apuntes = [], estado = null, hoy = '') {
  const ids = new Set(modulos.flatMap((m) => m.lecciones));
  const base = lista(apuntes).filter((a) => ids.has(a.id) || a.tipo === 'glosario');
  const x = examenDe(base, estado, { hoy: `${hoy}:final`, n: 10 });
  return x ? x.map((q) => ({ ...q, etiqueta: 'Examen final' })) : null;
}
export const aprobado = (aciertos, total) => total > 0 && aciertos / total >= APRUEBA;
export function apuntarFinal(estado, { dia, aciertos, total }) {
  const e = limpiarVistos(estado);
  if (!aprobado(aciertos, total) || (e.certificado && e.certificado.aciertos / e.certificado.total >= aciertos / total)) return e;
  return limpiarVistos({ ...e, certificado: { dia, aciertos, total } });
}

// ---------- Tu mes en apuntes ----------
// mes: 'AAAA-MM'. { apuntes, dias, puntos, rachaMax, metaDias, temaFuerte, examenes: { n, media } }
export function tuMesApuntes(estado, apuntes = [], mes = '') {
  const e = limpiarVistos(estado), meta = metaDe(e);
  const enMes = (d) => typeof d === 'string' && d.slice(0, 7) === mes;
  const dias = Object.entries(e.diario || {}).filter(([d]) => enMes(d));
  const aprendidos = new Set([...(e.dias || []).filter(enMes), ...dias.filter(([, x]) => x.n > 0).map(([d]) => d)]);
  let rachaMax = 0, r = 0;
  const todos = [...aprendidos].sort();
  for (let i = 0; i < todos.length; i++) { r = i && sumarDias(todos[i - 1], 1) === todos[i] ? r + 1 : 1; rachaMax = Math.max(rachaMax, r); }
  const porTema = new Map();
  for (const a of lista(apuntes)) {
    const t = temaDe(a), v = e.vistos[a.id];
    if (t && v && enMes(v.t)) porTema.set(t, (porTema.get(t) || 0) + 1 + ((v.c || 0) >= 1 ? 1 : 0));
  }
  const fuerte = [...porTema].sort((a, b) => b[1] - a[1])[0];
  const ex = (e.examenes || []).filter((x) => enMes(x.dia));
  const vistosMes = Object.values(e.vistos).filter((v) => enMes(v.t)).length;
  return {
    mes,
    apuntes: Math.max(vistosMes, dias.reduce((s, [, x]) => s + x.n, 0)),
    dias: aprendidos.size,
    puntos: dias.reduce((s, [, x]) => s + x.xp + (x.n >= meta ? PREMIO_META : 0), 0),
    metaDias: dias.filter(([, x]) => x.n >= meta).length,
    rachaMax,
    temaFuerte: fuerte ? { tema: fuerte[0], nombre: nombreTema(fuerte[0]) } : null,
    examenes: { n: ex.length, media: ex.length ? Math.round((ex.reduce((s, x) => s + x.aciertos / x.total, 0) / ex.length) * 100) : null },
  };
}
export const glosarioTotal = () => GLOSARIO.length;

// ---------- (tanda D) La liga y los duelos ----------
// Lo de una semana (de lunes a domingo) para la liga: { puntos (con el premio de cada día cumplido), apuntes }
export function puntosDeSemana(estado, lunes) {
  const e = limpiarVistos(estado), meta = metaDe(e);
  let puntos = 0, apuntes = 0;
  if (!DIA.test(lunes || '')) return { puntos, apuntes };
  for (let i = 0; i < 7; i++) {
    const d = e.diario?.[sumarDias(lunes, i)];
    if (d) { puntos += d.xp + (d.n >= meta ? PREMIO_META : 0); apuntes += d.n; }
  }
  return { puntos: Math.min(20000, puntos), apuntes: Math.min(2000, apuntes) };
}
// Las cinco preguntas de un duelo: del glosario, iguales para los dos (salen de la semilla)
function azar(semilla) { let s = (Math.abs(Math.floor(Number(semilla) || 1)) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function barajarCon(xs, r) { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function dueloDe(semilla) {
  const r = azar(semilla);
  const elegidos = barajarCon(GLOSARIO, r).slice(0, 5);
  return elegidos.map(([t, x], i) => {
    const otras = barajarCon(GLOSARIO.filter(([u]) => u !== t), r).slice(0, 2).map(([, y]) => y);
    const opciones = barajarCon([x, ...otras], r);
    return { id: `d:${semilla}:${i}`, tipo: 'test', efimero: true, etiqueta: 'Duelo', de: 'Glosario', titulo: `¿Qué es «${t}»?`, opciones, correcta: opciones.indexOf(x), texto: '' };
  });
}
// Cómo va un duelo, en palabras: { estado: 'jugar' | 'esperando' | 'ganado' | 'perdido' | 'empate' | 'caducado', texto }
export function estadoDuelo(d) {
  if (!d) return null;
  const rival = d.rival_nombre || 'tu rival';
  if (d.mios == null) return d.acabado ? { estado: 'caducado', texto: `Con ${rival}: se acabó el plazo` } : { estado: 'jugar', texto: d.soy_retador ? `Tu duelo con ${rival}: te toca` : `${rival} te reta` };
  if (d.suyos == null) return d.acabado ? { estado: 'caducado', texto: `Con ${rival}: no llegó a contestar (tú, ${d.mios} de 5)` } : { estado: 'esperando', texto: `Esperando a ${rival} (tú, ${d.mios} de 5)` };
  const est = d.mios > d.suyos ? 'ganado' : d.mios < d.suyos ? 'perdido' : 'empate';
  return { estado: est, texto: `${est === 'ganado' ? 'Ganaste' : est === 'perdido' ? 'Perdiste' : 'Empate'} con ${rival}: ${d.mios}–${d.suyos}` };
}

// ---------- (tanda D) Historias: la novedad o las lecciones, en diapositivas ----------
const trocear = (texto, max = 110) => {   // (frases cortas: en pantalla completa se leen grandes)
  const frases = String(texto || '').replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]*/g) || [];
  const out = [];
  for (const f of frases.map((x) => x.trim()).filter(Boolean)) {
    if (out.length && (out[out.length - 1] + ' ' + f).length <= max) out[out.length - 1] += ` ${f}`;
    else out.push(f);
  }
  return out;
};
// Una novedad: portada, su texto en dos a cuatro diapositivas y, si la hay, de dónde sale
export function historiaDeNovedad(a) {
  if (!a?.titulo) return [];
  const trozos = trocear(a.texto).slice(0, 4);
  return [
    { clase: 'portada', etiqueta: a.etiqueta || 'Novedad de la semana', titulo: a.titulo, texto: '' },
    ...trozos.map((t, i) => ({ clase: 'texto', etiqueta: `${i + 1} de ${trozos.length}`, titulo: '', texto: t })),
    ...(a.fuente ? [{ clase: 'fuente', etiqueta: 'De dónde sale', titulo: '', texto: a.fuente, enlace: a.enlace || null }] : []),
  ];
}
// Unas lecciones (un curso): una diapositiva por lección, con su título y su texto (hasta seis)
export function historiaDeLecciones(lecciones = [], tituloCurso = '') {
  const ls = lista(lecciones).filter((a) => a && (a.titulo || a.texto)).slice(0, 6);
  if (!ls.length) return [];
  return [
    { clase: 'portada', etiqueta: 'Curso', titulo: tituloCurso || 'Tu curso', texto: ls.length === 1 ? 'Una lección' : `${ls.length} lecciones` },
    ...ls.map((a, i) => ({ clase: 'texto', etiqueta: `Lección ${i + 1}`, titulo: a.tipo === 'mito' ? a.titulo : a.titulo || '', texto: trocear(a.texto).slice(0, 2).join(' '), id: a.id })),
  ];
}

// ---------- (tanda D) Tus notas y subrayados ----------
export const frasesDe = (texto) => (String(texto || '').replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]*\s*/g) || []).map((x) => x.trim()).filter(Boolean);
export function ponerNota(estado, id, texto) {
  const e = limpiarVistos(estado), t = String(texto || '').trim().slice(0, 500);
  const notas = { ...(e.notas || {}) };
  if (t) notas[id] = t; else delete notas[id];
  const guardados = t && !(e.guardados || []).includes(id) ? [...(e.guardados || []), id] : e.guardados || [];
  return limpiarVistos({ ...e, notas, guardados });
}
export function alternarSubrayado(estado, id, i) {
  const e = limpiarVistos(estado), ya = e.subrayados?.[id] || [];
  const nuevo = ya.includes(i) ? ya.filter((x) => x !== i) : [...ya, i];
  const subrayados = { ...(e.subrayados || {}) };
  if (nuevo.length) subrayados[id] = nuevo; else delete subrayados[id];
  const guardados = nuevo.length && !(e.guardados || []).includes(id) ? [...(e.guardados || []), id] : e.guardados || [];
  return limpiarVistos({ ...e, subrayados, guardados });
}

// ---------- (tanda D, coach) El dominio del equipo por temas (solo cuentas) ----------
// filas: lo de apuntes_dominio_equipo() ([{ apunte, atletas, caja_media, dominan }]); apuntes: los que se saben nombrar
export function dominioEquipo(filas = [], apuntes = []) {
  const porId = new Map(lista(apuntes).filter((a) => a?.id).map((a) => [a.id, a]));
  const temas = new Map(TEMAS.map(([t, nombre]) => [t, { tema: t, nombre, apuntes: 0, vistas: 0, suma: 0, dominan: 0 }]));
  for (const f of lista(filas)) {
    const t = temaDe(porId.get(f?.apunte));
    if (!t) continue;
    const x = temas.get(t), n = Math.max(0, Math.round(Number(f.atletas) || 0));
    x.apuntes += 1; x.vistas += n; x.suma += (Number(f.caja_media) || 0) * n; x.dominan += Math.max(0, Math.round(Number(f.dominan) || 0));
  }
  const out = [...temas.values()].filter((x) => x.apuntes > 0).map((x) => ({ ...x, cajaMedia: x.vistas ? Math.round((x.suma / x.vistas) * 10) / 10 : 0, pctDominio: x.vistas ? Math.round((x.dominan / x.vistas) * 100) : 0 }));
  const flojo = out.filter((x) => x.apuntes >= 2).sort((a, b) => a.cajaMedia - b.cajaMedia || b.vistas - a.vistas)[0] || null;
  return { temas: out, flojo };
}
