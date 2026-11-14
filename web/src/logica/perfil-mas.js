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
  { clave: 'manual', titulo: 'Cómo te gusta que te entrenen', para: 'Tu coach sabe cómo hablarte y qué evitar.', fila: 'Escribir cómo te gusta que te entrenen' },
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
export function completarPerfil(p = {}, { foto = null, entrena = true, manualEscrito = null } = {}) {
  const huecos = HUECOS_PERFIL.filter((h) => entrena || !h.entreno);
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
