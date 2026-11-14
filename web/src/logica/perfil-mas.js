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
