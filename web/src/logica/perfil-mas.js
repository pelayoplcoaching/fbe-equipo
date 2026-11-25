// (perfil, tanda 4) Las cuentas de las 20 mejoras del perfil del atleta. Aquí no hay nada del navegador: se prueba en
// test/perfil4.test.mjs. Todo sale de lo que ya se guarda (sus series, sus sesiones, su ficha personal); nada cambia la
// programación del coach.
import { e1rm } from './calculos.js';
import { mejorReciente } from './objetivos.js';
import { diasEntre } from './fechas.js';

const conCarga = (s) => Number(s?.kg) > 0 && Number(s?.reps) > 0 && s?.fecha;
const r1 = (v) => Math.round(v * 10) / 10;

// ---------- 1. El día 1 y hoy ----------
// Sus ejercicios (los tres suyos; si no, los tres con más series): la mejor serie del primer día que lo hizo (por 1RM
// estimado), su mejor 1RM estimado de ahora (6 semanas; si no entrena ese ejercicio desde entonces, el mejor de siempre)
// y cuánto ha subido. Hace falta que el primer día quede a 4 semanas o más de hoy.
export const DIAS_MIN_DIA_UNO = 28;
export function diaUnoYHoy(series = [], { favoritos = [], hoy, max = 3 } = {}) {
  const porEj = {};
  for (const s of series || []) if (s.ejercicio_id && conCarga(s)) (porEj[s.ejercicio_id] ||= []).push(s);
  const ids = [...(favoritos || []).filter((id) => porEj[id]),
    ...Object.keys(porEj).filter((id) => !(favoritos || []).includes(id)).sort((a, b) => porEj[b].length - porEj[a].length)].slice(0, max);
  const out = [];
  for (const id of ids) {
    const ss = porEj[id];
    const primerDia = ss.reduce((m, s) => (s.fecha < m ? s.fecha : m), ss[0].fecha);
    if (!hoy || diasEntre(primerDia, hoy) < DIAS_MIN_DIA_UNO) continue;
    const delDia = ss.filter((s) => s.fecha === primerDia && e1rm(s));
    if (!delDia.length) continue;
    const mejor1 = delDia.reduce((m, s) => (e1rm(s) > e1rm(m) ? s : m));
    const ahora = mejorReciente(ss, hoy) ?? Math.max(...ss.map((s) => e1rm(s) || 0));
    const antes = e1rm(mejor1);
    if (!ahora || !antes) continue;
    out.push({ id, nombre: ss[0].ejercicio || 'Ejercicio', fecha: primerDia, kg: Number(mejor1.kg), reps: Number(mejor1.reps), antes: r1(antes), ahora: r1(ahora),
      pct: Math.round(((ahora - antes) / antes) * 100), dias: diasEntre(primerDia, hoy) });
  }
  return out;
}

// ---------- 3. Tus marcas por repeticiones ----------
// Por ejercicio, el mejor peso con el que hizo al menos 1, 3, 5, 8, 10 y 12 repeticiones (con la fecha de la primera
// vez que lo consiguió). Sin ninguna, null en ese tramo.
export const TRAMOS_REPS = [1, 3, 5, 8, 10, 12];
export function marcasPorReps(series = [], ejercicioId) {
  const ss = (series || []).filter((s) => s.ejercicio_id === ejercicioId && conCarga(s));
  return TRAMOS_REPS.map((n) => {
    const validas = ss.filter((s) => Number(s.reps) >= n);
    if (!validas.length) return { reps: n, kg: null, fecha: null };
    const kg = Math.max(...validas.map((s) => Number(s.kg)));
    const fecha = validas.filter((s) => Number(s.kg) === kg).map((s) => s.fecha).sort()[0];
    return { reps: n, kg, fecha };
  });
}
// Los ejercicios con marcas (los que tienen alguna serie con carga), los de más series primero
export function ejerciciosConMarcas(series = []) {
  const n = {}, nombre = {};
  for (const s of series || []) if (s.ejercicio_id && conCarga(s)) { n[s.ejercicio_id] = (n[s.ejercicio_id] || 0) + 1; nombre[s.ejercicio_id] ||= s.ejercicio || 'Ejercicio'; }
  return Object.keys(n).sort((a, b) => n[b] - n[a] || nombre[a].localeCompare(nombre[b], 'es')).map((id) => ({ id, nombre: nombre[id], series: n[id] }));
}

// ---------- 9. Lo que te ha corregido tu coach ----------
// Por ejercicio: sus recordatorios activos (los que el coach fijó) y los ✗ de su último vídeo corregido de ese
// ejercicio (sin repetir los que ya son recordatorio), con la fecha de la corrección. Los ejercicios con algo,
// los de la corrección más reciente primero.
const plano = (t) => String(t || '').replace(/\s+/g, ' ').trim();
export function correccionesPorEjercicio({ videos = [], recordatorios = [], nombres = {} } = {}) {
  const out = {};
  const de = (id, nombre) => (out[id] ||= { id, nombre: nombre || nombres[id] || 'Ejercicio', recordatorios: [], fallos: [], fecha: null, videoId: null });
  for (const r of recordatorios || []) if (r.ejercicio_id && plano(r.texto)) {
    const x = de(r.ejercicio_id);
    x.recordatorios.push(plano(r.texto));
    if (r.actualizado_el && (!x.fecha || r.actualizado_el > x.fecha)) x.fecha = r.actualizado_el;
  }
  const ultimos = {};
  for (const v of videos || []) {
    const id = v?.ejercicio?.id || v?.ejercicio_id;
    if (!id || v.tipo !== 'video_tecnica' || !v.revision?.corregido_el) continue;
    if (!v.revision?.checklist?.puntos?.some((p) => p.e === 'mal')) continue;
    if (!ultimos[id] || String(v.revision.corregido_el) > String(ultimos[id].revision.corregido_el)) ultimos[id] = v;
  }
  for (const [id, v] of Object.entries(ultimos)) {
    const x = de(id, v.ejercicio?.nombre);
    const ya = new Set(x.recordatorios.map((t) => t.toLowerCase()));
    x.fallos = v.revision.checklist.puntos.filter((p) => p.e === 'mal').map((p) => plano(p.t)).filter((t) => t && !ya.has(t.toLowerCase()));
    x.videoId = v.id;
    if (!x.fecha || v.revision.corregido_el > x.fecha) x.fecha = v.revision.corregido_el;
  }
  return Object.values(out).filter((x) => x.recordatorios.length || x.fallos.length)
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || a.nombre.localeCompare(b.nombre, 'es'));
}

// ---------- 15. Completa tu perfil ----------
// Lo que le falta de lo que más ayuda a que la app (y su coach) le conozcan, con para qué sirve y la fila que lo abre
// (su etiqueta, la de «Lo tuyo» o la de su foto). Los de entrenar, solo si entrena. Al 100 %, nada.
export const HUECOS_PERFIL = [
  { clave: 'foto', titulo: 'Tu foto', para: 'Tu coach y el equipo te reconocen al momento.', fila: 'foto' },
  { clave: 'porque', titulo: 'Tu porqué', para: 'Sale los días que cuestan.', fila: 'Escribir tu porqué' },
  { clave: 'meta', titulo: 'Tu meta', para: 'Una fecha para la que entrenar, con su cuenta atrás.', fila: 'Poner tu meta' },
  { clave: 'favoritos', titulo: 'Tus tres ejercicios', para: 'Tus marcas de siempre, arriba en Progreso.', fila: 'Elegir tus tres ejercicios', entreno: true },
  { clave: 'musica', titulo: 'Tu música', para: 'A un toque al empezar cada sesión.', fila: 'Poner el enlace a tu música', entreno: true },
  { clave: 'cumple', titulo: 'Tu cumpleaños', para: 'Para felicitarte ese día.', fila: 'Poner tu cumpleaños' },
  // (coach: true) solo le sirve a un coach: quien va por su cuenta (FBE Esencial) no lo tiene
  { clave: 'manual', titulo: 'Cómo te gusta que te entrenen', para: 'Tu coach sabe cómo hablarte y qué evitar.', fila: 'Escribir cómo te gusta que te entrenen', coach: true },
];
const tiene = {
  foto: (p, x) => !!x.foto,
  porque: (p) => !!plano(p.porque),
  meta: (p) => !!plano(p.meta_nombre),
  favoritos: (p) => (p.favoritos || []).length >= 1,
  musica: (p) => !!p.musica_url,
  cumple: (p) => !!(p.cumple_mes && p.cumple_dia),
  manual: (p) => !!plano(p.manual_texto || p.manual?.texto || '') || !!(Array.isArray(p.manual) ? p.manual.length : p.manual && Object.keys(p.manual).length),
};
export function completarPerfil(p = {}, { foto = null, entrena = true, manualEscrito = null, sinCoach = false } = {}) {
  const huecos = HUECOS_PERFIL.filter((h) => (entrena || !h.entreno) && !(sinCoach && h.coach))
    .map((h) => (sinCoach && h.clave === 'foto' ? { ...h, para: 'El equipo te reconoce al momento.' } : h));
  const hecho = (h) => (h.clave === 'manual' && manualEscrito != null ? manualEscrito : tiene[h.clave](p || {}, { foto }));
  const faltan = huecos.filter((h) => !hecho(h));
  return { pct: Math.round(((huecos.length - faltan.length) / huecos.length) * 100), faltan, total: huecos.length };
}

// ---------- 2. Tu historia de bloques ----------
// Los bloques terminados (con algo hecho), del más reciente al primero: fechas, objetivo (y si se logró), sesiones,
// récords y la mejor subida de sus ejercicios principales. El informe entero va en `informe`.
export function historiaBloques(informes = []) {
  return (informes || []).filter((r) => r && !r.vacio && r.terminado).map((r) => {
    const mejor = (r.principales || []).filter((p) => p.cambio > 0).sort((a, b) => b.cambio - a.cambio)[0] || null;
    return {
      id: r.bloque.id, numero: r.bloque.numero, nombre: r.bloque.nombre, inicio: r.inicio, fin: r.fin,
      objetivo: r.bloque.objetivo || null, logrado: r.bloque.objetivo_logrado ?? null,
      hechas: r.sesiones?.hechas || 0, total: r.sesiones?.total || 0,
      records: Array.isArray(r.records) ? r.records.length : Number(r.records) || 0,
      mejor: mejor ? { nombre: mejor.nombre, cambio: mejor.cambio } : null, informe: r,
    };
  }).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
}

// ---------- 4. Tu palmarés ----------
// Lo conseguido, en una estantería: bloques terminados, objetivos de bloque logrados, semanas completas, récords y
// carreras terminadas (con su resultado). Solo lo que tiene algo.
export function palmares({ informes = [], semanasCompletas = 0, records = 0, eventos = [], hoy } = {}) {
  const terminados = (informes || []).filter((r) => r && !r.vacio && r.terminado);
  const carreras = (eventos || []).filter((e) => e?.resultado_seg && (!hoy || e.fecha <= hoy)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return [
    { clave: 'bloques', titulo: terminados.length === 1 ? 'Bloque terminado' : 'Bloques terminados', n: terminados.length, icono: 'semana' },
    { clave: 'objetivos', titulo: 'Objetivos de bloque logrados', n: terminados.filter((r) => r.bloque?.objetivo_logrado === true).length, icono: 'diana' },
    { clave: 'semanas', titulo: semanasCompletas === 1 ? 'Semana completa' : 'Semanas completas', n: Number(semanasCompletas) || 0, icono: 'llama' },
    { clave: 'records', titulo: records === 1 ? 'Récord' : 'Récords', n: Number(records) || 0, icono: 'trofeo' },
    { clave: 'carreras', titulo: carreras.length === 1 ? 'Carrera terminada' : 'Carreras terminadas', n: carreras.length, icono: 'pasos', detalle: carreras[0]?.nombre || null },
  ].filter((x) => x.n > 0);
}

// ---------- 5. Logros secretos ----------
// No se ven hasta conseguirlos. Cada uno, con el día en que se consiguió (null si aún no). Las horas, las de Madrid.
const FMT_HORA = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('es-ES', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' }) : null;
export const horaMadrid = (ts) => { if (!ts || !FMT_HORA) return null; const d = new Date(ts); return Number.isNaN(d.getTime()) ? null : Number(FMT_HORA.format(d)); };
const diaSemana = (f) => new Date(`${f}T12:00:00Z`).getUTCDay();
const lunesIso = (f) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const enesima = (lista, n) => (lista.length >= n ? lista[n - 1].fecha : null);
export const SECRETOS = [
  { clave: 'madrugador', titulo: 'Madrugador', texto: '5 sesiones empezadas antes de las 7', fecha: (o) => enesima(o.filter((x) => { const h = horaMadrid(x.inicio); return h != null && h >= 4 && h < 7; }), 5) },
  { clave: 'nocturno', titulo: 'Búho', texto: '5 sesiones empezadas a las 22 o más tarde', fecha: (o) => enesima(o.filter((x) => { const h = horaMadrid(x.inicio); return h != null && (h >= 22 || h < 2); }), 5) },
  { clave: 'finde', titulo: 'Fin de semana de hierro', texto: '10 sesiones en sábado o domingo', fecha: (o) => enesima(o.filter((x) => [0, 6].includes(diaSemana(x.fecha))), 10) },
  { clave: 'mes', titulo: 'Mes de doce', texto: '12 sesiones en un mismo mes', fecha: (o) => { const n = {}; for (const x of o) { const m = x.fecha.slice(0, 7); n[m] = (n[m] || 0) + 1; if (n[m] === 12) return x.fecha; } return null; } },
  { clave: 'vuelta', titulo: 'De vuelta', texto: 'Volver a entrenar tras 3 semanas o más sin hacerlo', fecha: (o) => { for (let i = 1; i < o.length; i++) if (diasEntre(o[i - 1].fecha, o[i].fecha) >= 21) return o[i].fecha; return null; } },
  { clave: 'lluvia', titulo: 'Lluvia de récords', texto: '5 récords en una sola sesión', fecha: (o) => o.find((x) => Number(x.records) >= 5)?.fecha || null },
  { clave: 'larga', titulo: 'Sin prisa', texto: 'Una sesión de 90 minutos o más', fecha: (o) => o.find((x) => Number(x.duracion_min) >= 90)?.fecha || null },
  { clave: 'cuatro', titulo: 'Cuatro de tres', texto: '4 semanas seguidas con 3 sesiones o más', fecha: (o) => {
    const n = {}, cuando = {};
    for (const x of o) { const l = lunesIso(x.fecha); n[l] = (n[l] || 0) + 1; if (n[l] === 3) cuando[l] = x.fecha; }
    const llenas = Object.keys(cuando).sort();
    for (let i = 3; i < llenas.length; i++) if (diasEntre(llenas[i - 3], llenas[i]) === 21) return cuando[llenas[i]];
    return null;
  } },
];
export function logrosSecretos(entrenos = []) {
  const o = (entrenos || []).filter((x) => x?.fecha).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.inicio || '').localeCompare(String(b.inicio || '')));
  const todos = SECRETOS.map((s) => ({ clave: s.clave, titulo: s.titulo, texto: s.texto, fecha: s.fecha(o) }));
  const conseguidos = todos.filter((x) => x.fecha).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return { conseguidos, quedan: todos.length - conseguidos.length, total: todos.length };
}

// ---------- 6. Equivalencias ----------
// Una frase divertida con lo levantado este año (kilos) o lo recorrido (km), una distinta cada día entre las que dan
// una cifra que se pueda imaginar (de 1 a 999).
export const EQUIV_KG = [['ballena azul', 'ballenas azules', 150000], ['autobús', 'autobuses', 12000], ['elefante', 'elefantes', 6000], ['coche', 'coches', 1500], ['piano de cola', 'pianos de cola', 500], ['oso polar', 'osos polares', 450]];
export const EQUIV_KM = [['maratón', 'maratones', 42.195], ['viaje de Madrid a Toledo', 'viajes de Madrid a Toledo', 72], ['Camino de Santiago francés', 'Caminos de Santiago franceses', 780], ['vuelta a una pista de atletismo', 'vueltas a una pista de atletismo', 0.4]];
const cifraEq = (v) => (v < 10 ? Math.round(v * 10) / 10 : Math.round(v)).toLocaleString('es-ES');
export function equivalencias({ kg = 0, km = 0 } = {}) {
  const out = [];
  for (const [s, p, u] of EQUIV_KG) { const n = kg / u; if (n >= 1 && n < 1000) out.push(`Este año has levantado lo que ${n < 1.05 ? 'pesa' : 'pesan'} ${cifraEq(n)} ${n < 1.05 ? s : p}`); }
  for (const [s, p, u] of EQUIV_KM) { const n = km / u; if (n >= 1 && n < 1000) out.push(`Este año has recorrido ${cifraEq(n)} ${n < 1.05 ? s : p}`); }
  return out;
}
export function equivalenciaDelDia(datos, hoy) {
  const l = equivalencias(datos);
  if (!l.length) return null;
  const d = hoy ? diasEntre('2026-01-01', hoy) : 0;
  return l[((d % l.length) + l.length) % l.length];
}
export function delAnio(entrenos = [], hoy) {
  const anio = String(hoy || '').slice(0, 4);
  const del = (entrenos || []).filter((x) => String(x.fecha || '').startsWith(anio));
  return { kg: del.reduce((t, x) => t + (Number(x.tonelaje) || 0), 0), km: Math.round(del.reduce((t, x) => t + (Number(x.cardio_hecho?.km) || 0), 0) * 10) / 10 };
}

// ---------- 20. Tu resumen trimestral ----------
// El trimestre en curso; en sus 21 primeros días, el anterior entero (si tuvo algo). Sesiones, días, récords, minutos,
// toneladas, frente al trimestre de antes, y el ejercicio que más ha subido (mejor 1RM estimado del trimestre frente al
// mejor de antes de empezarlo, si sube más de un 2 %).
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const trimDe = (f) => { const a = Number(f.slice(0, 4)), m = Number(f.slice(5, 7)); return { a, t: Math.floor((m - 1) / 3) }; };
const limites = ({ a, t }) => {
  const ini = `${a}-${String(t * 3 + 1).padStart(2, '0')}-01`;
  const finMes = t * 3 + 3, ultimo = new Date(Date.UTC(a, finMes, 0)).getUTCDate();
  return { desde: ini, hasta: `${a}-${String(finMes).padStart(2, '0')}-${ultimo}`, titulo: `${MESES_CORTOS[t * 3]}–${MESES_CORTOS[t * 3 + 2]} ${a}` };
};
const anterior = ({ a, t }) => (t === 0 ? { a: a - 1, t: 3 } : { a, t: t - 1 });
export function resumenTrimestre(entrenos = [], series = [], hoy) {
  if (!hoy) return null;
  const actual = trimDe(hoy), la = limites(actual);
  const en = (l) => (entrenos || []).filter((x) => x.fecha && x.fecha >= l.desde && x.fecha <= l.hasta);
  let q = actual, l = la, completo = false;
  if (diasEntre(la.desde, hoy) < 21 && en(limites(anterior(actual))).length) { q = anterior(actual); l = limites(q); completo = true; }
  const lista = en(l);
  if (!lista.length) return null;
  const antes = en(limites(anterior(q)));
  let mejora = null;
  const porEj = {};
  for (const s of series || []) if (s.ejercicio_id && s.fecha && s.fecha <= l.hasta) (porEj[s.ejercicio_id] ||= []).push(s);
  for (const ss of Object.values(porEj)) {
    const prev = ss.filter((s) => s.fecha < l.desde).map((s) => e1rm(s) || 0).filter((v) => v > 0);
    const dentro = ss.filter((s) => s.fecha >= l.desde).map((s) => e1rm(s) || 0).filter((v) => v > 0);
    if (!prev.length || !dentro.length) continue;
    const a = Math.max(...prev), b = Math.max(...dentro), pct = (b - a) / a;
    if (pct > 0.02 && (!mejora || pct > mejora.pct / 100)) mejora = { nombre: ss[0].ejercicio || 'Ejercicio', pct: Math.round(pct * 1000) / 10, antes: r1(a), ahora: r1(b) };
  }
  return {
    titulo: l.titulo, desde: l.desde, hasta: l.hasta, completo,
    sesiones: lista.length, dias: new Set(lista.map((x) => x.fecha)).size, records: lista.reduce((t, x) => t + (Number(x.records) || 0), 0),
    minutos: lista.reduce((t, x) => t + (Number(x.duracion_min) || 0), 0), toneladas: Math.round(lista.reduce((t, x) => t + (Number(x.tonelaje) || 0), 0) / 100) / 10,
    antes: antes.length, mejora,
  };
}

// =====================================================================
// (T3) Lo que evita, su material y sus guardados
// =====================================================================
// 7. Los motivos para evitar un ejercicio (los mismos que admite la base, 073)
export const MOTIVOS_EVITAR = [['gusto', 'No me gusta'], ['molestia', 'Me molesta'], ['material', 'No tengo el material']];
const NOMBRE_MOTIVO = Object.fromEntries(MOTIVOS_EVITAR);
export const textoMotivo = (m) => NOMBRE_MOTIVO[m] || '';
// { ejercicio_id → motivo } de lo suyo (o de lo de un atleta, para el coach)
export function mapaEvitados(personal) {
  const out = {};
  for (const x of Array.isArray(personal?.evitados) ? personal.evitados : []) if (x?.ejercicio_id && NOMBRE_MOTIVO[x.motivo]) out[x.ejercicio_id] = x.motivo;
  return out;
}
// Las alternativas sin las que evita: { quedan, apartados } (las apartadas, con su motivo)
export function apartarEvitados(lista = [], evitados = {}) {
  const quedan = [], apartados = [];
  for (const x of lista || []) (evitados[x?.id] ? apartados : quedan).push(evitados[x?.id] ? { ...x, motivo: evitados[x.id] } : x);
  return { quedan, apartados };
}
// Añade o quita uno (sin repetir; como mucho 60, como la base)
export function alternarEvitado(evitados = [], ejercicioId, motivo = null) {
  const sin = (evitados || []).filter((x) => x.ejercicio_id !== ejercicioId);
  return motivo && NOMBRE_MOTIVO[motivo] ? [...sin, { ejercicio_id: ejercicioId, motivo }].slice(-60) : sin;
}

// 8. Su material: lo de la base si lo hay; si no, lo de este móvil (como antes)
export function materialDe(personal, local = null) {
  const m = personal?.material && typeof personal.material === 'object' ? personal.material : {};
  const base = Array.isArray(m.casa) || Array.isArray(m.viaje);
  const l = local && typeof local === 'object' ? local : {};
  return {
    casa: Array.isArray(m.casa) ? m.casa : Array.isArray(l.casa) ? l.casa : [],
    viaje: Array.isArray(m.viaje) ? m.viaje : Array.isArray(l.viaje) ? l.viaje : [],
    mancuernas_kg: Number.isFinite(Number(m.mancuernas_kg)) && m.mancuernas_kg != null ? Number(m.mancuernas_kg) : null,
    deLaBase: base,
  };
}
export function mismoMaterial(a = {}, b = {}) {
  const k = (x) => [...(x || [])].sort().join(',');
  return k(a.casa) === k(b.casa) && k(a.viaje) === k(b.viaje);
}

// 10. Sus guardados, juntos: [{ tipo, id, titulo, detalle }] (tipo: ejercicio, receta, publicacion, apunte), con filtro
export const TIPOS_GUARDADO = [['todo', 'Todo'], ['ejercicio', 'Ejercicios'], ['receta', 'Recetas'], ['publicacion', 'Publicaciones'], ['apunte', 'Apuntes']];
export function guardadosJuntos({ favoritos = [], nombres = {}, recetas = [], publicaciones = [], apuntes = [] } = {}) {
  const out = [];
  for (const id of favoritos || []) if (nombres[id]) out.push({ tipo: 'ejercicio', id: `e:${id}`, titulo: nombres[id], detalle: 'Uno de tus tres ejercicios' });
  for (const r of recetas || []) if (r?.nombre) out.push({ tipo: 'receta', id: `r:${r.id}`, titulo: r.nombre, detalle: r.toma ? `Receta favorita · ${r.toma}` : 'Receta favorita' });
  for (const p of publicaciones || []) {
    const t = String(p?.texto || p?.resumen?.nombre || p?.resumen?.titulo || (p?.foto_ruta ? 'Una foto' : '')).replace(/\s+/g, ' ').trim();
    if (t) out.push({ tipo: 'publicacion', id: `p:${p.id}`, titulo: t.length > 90 ? `${t.slice(0, 88)}…` : t, detalle: p.autor ? `De ${p.autor}` : 'Publicación del equipo' });
  }
  for (const a of apuntes || []) if (a?.titulo || a?.texto) out.push({ tipo: 'apunte', id: `a:${a.id}`, titulo: a.titulo || String(a.texto).slice(0, 80), detalle: a.de ? `Apunte · ${a.de}` : 'Apunte' });
  return out;
}

// =====================================================================
// (T4) Descanso y pasos, atajos, privacidad, cuenta y la hoja de cálculo
// =====================================================================
// 12. La media de sueño y de pasos de las últimas 4 semanas (y de las 4 de antes, para la tendencia), y por semana.
//     `dias`: [{ fecha, pasos, sueno_min }] de Salud. Sin datos de algo, ese algo sale null.
export function descansoYPasos(dias = [], hoy) {
  if (!hoy) return null;
  const desde = sumar(hoy, -27), antesDesde = sumar(hoy, -55);
  const media = (l, k) => { const v = l.map((x) => Number(x[k])).filter((n) => Number.isFinite(n) && n > 0); return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const ahora = (dias || []).filter((x) => x?.fecha >= desde && x.fecha <= hoy);
  const antes = (dias || []).filter((x) => x?.fecha >= antesDesde && x.fecha < desde);
  const una = (k, umbral) => {
    const m = media(ahora, k), a = media(antes, k);
    if (m == null) return null;
    const dif = a == null ? null : (m - a) / a;
    return { media: m, antes: a, tendencia: dif == null ? null : dif > umbral ? 'sube' : dif < -umbral ? 'baja' : 'igual',
      semanas: [3, 2, 1, 0].map((i) => media(ahora.filter((x) => x.fecha > sumar(hoy, -7 * (i + 1)) && x.fecha <= sumar(hoy, -7 * i)), k)) };
  };
  const sueno = una('sueno_min', 0.05), pasos = una('pasos', 0.08);
  return sueno || pasos ? { sueno, pasos } : null;
}
function sumar(iso, d) { const t = new Date(`${iso}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); }
export const textoHoras = (min) => { const m = Math.round(min); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };

// 16. Los atajos que puede elegir (tres): [clave, texto, icono, a dónde lleva]
export const ATAJOS_PERFIL = [
  ['checkin', 'Check-in', 'checkin', 'checkin'], ['progreso', 'Progreso', 'progreso', 'progreso'], ['mensajes', 'Mensajes', 'mensaje', 'mensajes'],
  ['semana', 'Tu semana', 'semana', 'semana'], ['comidas', 'Comidas', 'receta', 'comidas'], ['aprende', 'Aprende', 'biblioteca', 'aprende'],
  ['equipo', 'Equipo', 'equipo', 'equipo'], ['carne', 'Tu carné', 'escudo', '#carne'], ['datos', 'Tus datos', 'descargar', '#datos'],
];
export const ATAJOS_DEFECTO = ['checkin', 'progreso', 'mensajes'];
export function atajosValidos(lista) {
  const ok = new Set(ATAJOS_PERFIL.map(([k]) => k));
  const l = [...new Set((Array.isArray(lista) ? lista : []).filter((k) => ok.has(k)))].slice(0, 3);
  return l.length ? l : [...ATAJOS_DEFECTO];
}
export function alternarAtajo(lista, clave) {
  const l = atajosValidos(lista);
  if (l.includes(clave)) return l.length > 1 ? l.filter((k) => k !== clave) : l;
  return l.length >= 3 ? l : [...l, clave];
}

// 17. Qué ve cada uno, de un vistazo (solo lo que de verdad pasa con lo suyo)
// suyo: va por su cuenta (FBE Esencial): sin mensajes, vídeos ni manual, y quien lo ve es Pelayo
export function privacidadDeUnVistazo({ salud = false, saludConectada = false, comunidad = false, portada = false, evitados = 0, material = false, suyo = false } = {}) {
  const coach = suyo ? ['Tus sesiones, series y notas', 'Tus fotos de progreso', 'Lo tuyo: tu porqué, tu meta y tu música']
    : ['Tus sesiones, series y notas', 'Tus mensajes y los vídeos y fotos que le envías', 'Lo tuyo: tu porqué, tu meta, tu manual y tu música'];
  if (salud) coach.push('Tu peso, tus medidas, tus check-ins y cómo llegas a cada sesión');
  if (saludConectada) coach.push('Lo que llega de Salud del iPhone (pasos, sueño, pulso)');
  if (evitados || material) coach.push('Lo que prefieres evitar y tu material');
  if (portada) coach.push('Tu foto de portada');
  const equipo = comunidad
    ? ['Tu nombre en el equipo, tu foto y tu racha', 'Lo que publicas y comentas', ...(portada ? ['Tu foto de portada'] : [])]
    : [];
  const movil = ['Los colores de tu portada y tus atajos', 'Tus ajustes de sonido, vibración y pantalla', 'Lo que has compartido desde este móvil', `Tu rincón de ánimo solo lo ves tú (está en tu cuenta, pero ni ${suyo ? 'Pelayo' : 'tu coach'} lo ve)`];
  return { coach, equipo, movil };
}

// 19. Una hoja de cálculo (CSV con «;» y coma decimal, como la abre Excel en español; con BOM para las tildes)
const celda = (v) => {
  if (v == null) return '';
  const t = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v);
  // (revisión) también lo que empieza por tabulador o retorno (OWASP: inyección de fórmulas)
  return /[";\n\r]/.test(t) || /^[=+\-@\t\r]/.test(t) ? `"${(/^[=+\-@\t\r]/.test(t) && typeof v !== 'number' ? `'${t}` : t).replace(/"/g, '""')}"` : t;
};
export function aCSV(filas = [], columnas = []) {
  return `﻿${[columnas.map(([, t]) => celda(t)).join(';'), ...filas.map((f) => columnas.map(([k]) => celda(typeof k === 'function' ? k(f) : f[k])).join(';'))].join('\r\n')}\r\n`;
}
export const CSV_SESIONES = [['fecha', 'Fecha'], [(x) => x.nombre || x.sesion || '', 'Sesión'], ['duracion_min', 'Minutos'], ['tonelaje', 'Kilos totales'], ['records', 'Récords'], [(x) => x.rpe_sesion ?? x.rpe ?? null, 'Esfuerzo (RPE)'], [(x) => x.cardio_hecho?.km ?? null, 'Km de cardio'], [(x) => x.cardio_hecho?.minutos ?? null, 'Minutos de cardio']];
export const CSV_SERIES = [['fecha', 'Fecha'], ['ejercicio', 'Ejercicio'], ['kg', 'Kg'], ['reps', 'Repeticiones'], ['rpe', 'RPE']];
export const CSV_PESOS = [['fecha', 'Fecha'], ['kg', 'Peso (kg)']];
export const CSV_MEDIDAS = [['fecha', 'Fecha'], ['cintura_cm', 'Cintura (cm)'], ['cadera_cm', 'Cadera (cm)'], ['pecho_cm', 'Pecho (cm)'], ['brazo_cm', 'Brazo (cm)'], ['muslo_cm', 'Muslo (cm)'], ['pantorrilla_cm', 'Pantorrilla (cm)'], ['notas', 'Notas']];
