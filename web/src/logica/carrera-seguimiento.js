// v0.223: carrera, tanda 5 de las 20 mejoras: las revisiones quincenales que se rellenan solas (18), la gráfica de su
// forma aeróbica (19) y su carrera en el calendario del móvil (20). Todo puro. Reglas de «claude/carrera-reglas-propuesta.md»
// (§4), aprobadas por Pelayo el 24/11/2026:
//   · Eficiencia aeróbica: el ritmo de los rodajes suaves con el mismo pulso. Si mejora un 2 % o más, verde; si se queda
//     igual, ámbar; si empeora más de un 3 %, rojo.
//   · Cumplimiento: el 80 % o más de los km previstos, verde; 60-80 %, ámbar; menos, rojo.
//   · Semáforos y dolor de esas dos semanas. La revisión toma el peor de los tres; el coach la confirma o la cambia.
// La eficiencia se mide en metros por latido (la velocidad entre las pulsaciones medias) en los rodajes suaves con pulso.
// (v0.227) Con la revisión del experto («claude/carrera-revision-experto-respuesta.md»):
//   · R29 La eficiencia, por la mediana de 3 o más rodajes suaves de 30 min o más frente a la de las 4 semanas anteriores,
//     con cortes de ±5 % (el pulso a un ritmo dado varía varios puntos de un día a otro: ±2-3 % es ruido). Por sí sola nunca
//     pasa de ámbar: estable o mejor, verde; un 5 % peor o más, ámbar.
//   · R30 Cumplimiento con los cortes de los avisos: 90 % o más, verde; 70-89 %, ámbar; menos del 70 %, rojo. Sin las
//     carreras (el plan va sin ellas) y, si el plan va en minutos y no hay km apuntados, por minutos.
//   · R32 La revisión toma el peor de los tres (la eficiencia, como mucho ámbar).
import { sumarDias, lunesDe } from './fechas.js';
import { minutosPlan } from './carrera-avisos.js';

const SUAVES = ['facil', 'recuperacion', 'larga'];
const r2 = (x) => Math.round(x * 100) / 100;
const kmPlan = (s) => (s?.km_min != null || s?.km_max != null ? (Number(s.km_min ?? s.km_max) + Number(s.km_max ?? s.km_min)) / 2 : null);
const NIVEL = { verde: 0, ambar: 1, rojo: 2 };
export const NOMBRE_COLOR = { verde: 'verde', ambar: 'ámbar', rojo: 'rojo' };

// Metros por latido de una salida suave con pulso (o null): la velocidad (m/min) entre las pulsaciones medias. minMin: los
// minutos mínimos de la salida (10 para la gráfica; 30 para la revisión, R29)
export function eficienciaDe(s, minMin = 10) {
  const c = s?.cardio_hecho;
  if (!c || c.modalidad !== 'carrera') return null;
  const tipo = s?.cardio?.tipo;
  const suave = SUAVES.includes(tipo) || (!tipo && (s?.cardio?.zona ?? 2) <= 2);
  const min = (Number(c.minutos) || 0) + (Number(c.seg) || 0) / 60;
  const km = Number(c.km) || 0;
  const fc = Number(c.fc_media) || 0;
  if (!suave || !(km > 0) || !(min >= minMin) || !(fc >= 80 && fc <= 220)) return null;
  const ritmo = (min * 60) / km; // s/km
  if (ritmo < 150 || ritmo > 720) return null;
  return r2((km * 1000) / min / fc);
}

// Los puntos de la gráfica: una por salida suave con pulso, de la más antigua a la más nueva, y la media de 4 en 4
export function serieEficiencia(hechas = []) {
  const p = (hechas || []).map((s) => ({ fecha: String(s?.fecha_realizada || '').slice(0, 10), ef: eficienciaDe(s), fc: s?.cardio_hecho?.fc_media,
    ritmo: s?.cardio_hecho?.km ? Math.round((((Number(s.cardio_hecho.minutos) || 0) * 60) + (Number(s.cardio_hecho.seg) || 0)) / Number(s.cardio_hecho.km)) : null }))
    .filter((x) => x.fecha && x.ef != null).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return p.map((x, i) => {
    const ventana = p.slice(Math.max(0, i - 3), i + 1);
    return { ...x, media: r2(ventana.reduce((a, y) => a + y.ef, 0) / ventana.length) };
  });
}
const mediana = (l) => { const o = [...l].sort((a, b) => a - b); const m = o.length >> 1; return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
// (R29) El cambio de la eficiencia entre dos tramos (en %), por la mediana de los rodajes suaves de 30 min o más, con al
// menos 3 en cada uno; o null
export const EF_MIN_MIN = 30;
export const EF_CORTE = 5;
function cambioEficiencia(hechas, desde, hasta, antesDesde) {
  const de = (a, b) => (hechas || []).filter((s) => { const f = String(s?.fecha_realizada || '').slice(0, 10); return f >= a && f < b; }).map((s) => eficienciaDe(s, EF_MIN_MIN)).filter((x) => x != null);
  const ahora = de(desde, hasta), antes = de(antesDesde, desde);
  if (ahora.length < 3 || antes.length < 3) return null;
  return Math.round((mediana(ahora) / mediana(antes) - 1) * 1000) / 10;
}

// La revisión de las dos semanas antes de `fecha` (por defecto, las dos últimas terminadas): los tres datos con su color,
// el peor de los tres y un texto para la decisión. → { estado, partes: [{ k, titulo, color, texto }], texto } o null
export function revisionAuto({ semanas = [], hechas = [], fecha, hoy }) {
  const fin = lunesDe(fecha || hoy);
  const ini = sumarDias(fin, -14);
  const partes = [];
  // (R29) Eficiencia aeróbica: estable o mejor, verde; un 5 % peor o más, ámbar (nunca rojo por sí sola)
  const ef = cambioEficiencia(hechas, ini, fin, sumarDias(ini, -28));
  if (ef != null) {
    const color = ef <= -EF_CORTE ? 'ambar' : 'verde';
    const como = ef >= EF_CORTE ? 'mejora' : ef > -EF_CORTE ? 'estable (el ±5 % es ruido del día a día)' : 'empeora';
    partes.push({ k: 'eficiencia', titulo: 'Eficiencia aeróbica', color,
      texto: `${ef > 0 ? '+' : ef < 0 ? '\u2212' : ''}${String(Math.abs(ef)).replace('.', ',')} % de metros por latido en los rodajes suaves frente a las 4 semanas anteriores: ${como}` });
  }
  // (R30) Cumplimiento, sin las carreras: por km o, si el plan va en minutos y no hay km apuntados, por minutos
  const dentro = (hechas || []).filter((s) => { const f = String(s?.fecha_realizada || '').slice(0, 10); return f >= ini && f < fin && s?.cardio_hecho?.modalidad === 'carrera'; });
  const entrenos = dentro.filter((s) => s?.cardio?.tipo !== 'carrera');
  const planes = [ini, sumarDias(ini, 7)].map((l) => (semanas || []).find((s) => s.lunes === l) || null);
  const kmP = planes.map(kmPlan), minP = planes.map(minutosPlan);
  const conKm = entrenos.filter((s) => Number(s.cardio_hecho.km) > 0);
  const n1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  const colorPct = (pct) => (pct >= 90 ? 'verde' : pct >= 70 ? 'ambar' : 'rojo');
  if (kmP.every((x) => x != null) && (conKm.length || !entrenos.length)) {
    const km = conKm.reduce((a, s) => a + Number(s.cardio_hecho.km), 0);
    const pct = Math.round((km / (kmP[0] + kmP[1])) * 100);
    partes.push({ k: 'cumplimiento', titulo: 'Cumplimiento', color: colorPct(pct), texto: `${pct} % de los km previstos (${n1(km)} de ${n1(kmP[0] + kmP[1])})` });
  } else if (minP.every((x) => x != null)) {
    const min = entrenos.reduce((a, s) => a + (Number(s.cardio_hecho.minutos) || 0) + (Number(s.cardio_hecho.seg) || 0) / 60, 0);
    const pct = Math.round((min / (minP[0] + minP[1])) * 100);
    partes.push({ k: 'cumplimiento', titulo: 'Cumplimiento', color: colorPct(pct), texto: `${pct} % de los minutos previstos (${Math.round(min)} de ${Math.round(minP[0] + minP[1])})` });
  }
  // Semáforos y dolor
  if (dentro.length) {
    const n = { verde: 0, ambar: 0, rojo: 0 };
    let dolor = null;
    for (const s of dentro) { const c = s.cardio_hecho; if (n[c.semaforo] != null) n[c.semaforo]++; if (Number.isInteger(c.dolor)) dolor = Math.max(dolor ?? 0, c.dolor); }
    const color = n.rojo || (dolor ?? 0) >= 6 ? 'rojo' : n.ambar >= 2 ? 'ambar' : 'verde';
    const trozos = [n.verde ? `${n.verde} en verde` : '', n.ambar ? `${n.ambar} en ámbar` : '', n.rojo ? `${n.rojo} en rojo` : ''].filter(Boolean);
    partes.push({ k: 'semaforos', titulo: 'Semáforos y dolor', color,
      texto: `${trozos.length ? trozos.join(', ') : 'sin semáforo'}${dolor != null ? `; dolor hasta ${dolor}/10` : ''}` });
  }
  if (!partes.length) return null;
  const estado = partes.reduce((a, p) => (NIVEL[p.color] > NIVEL[a] ? p.color : a), 'verde');
  const texto = partes.map((p) => `${p.titulo}: ${p.texto} (${NOMBRE_COLOR[p.color]})`).join('. ') + '.';
  return { estado, partes, texto, desde: ini, hasta: sumarDias(fin, -1) };
}

// Su carrera en el calendario del móvil: sus carreras (con aviso la víspera, a las 20:00) y las sesiones clave del plan
// (calidad y tirada larga con día) de las semanas que vienen, para calendarioICS (logica/plan.js)
export function eventosCalendarioCarrera({ eventos = [], semanas = [], hoy, horaCarrera = '09:00', horaSesion = '18:00', semanasAdelante = 6 }) {
  const out = [];
  const [hh, mm] = horaCarrera.split(':').map(Number);
  const avisoVispera = Math.max(60, (hh * 60 + mm) + (24 * 60 - 20 * 60)); // de la hora de la carrera a las 20:00 del día antes
  for (const e of eventos || []) {
    if (!e?.fecha || e.fecha < hoy || e.decision === 'no') continue;
    const km = Number(e.distancia_km);
    out.push({ id: `carrera-${e.id || e.fecha}`, dia: e.fecha, hora: horaCarrera, minutos: km > 30 ? 300 : km > 15 ? 150 : 90,
      titulo: `Carrera: ${e.nombre}`, nombre: e.nombre, descripcion: `${km ? `${String(km).replace('.', ',')} km. ` : ''}Mañana, a tu ritmo: no al de los demás.`,
      aviso: `Mañana corres ${e.nombre}: cena como siempre, deja preparada la ropa y a dormir pronto.`, avisoMin: avisoVispera });
  }
  const hasta = sumarDias(lunesDe(hoy), 7 * semanasAdelante);
  for (const s of semanas || []) {
    if (!s?.lunes || s.lunes < lunesDe(hoy) || s.lunes >= hasta) continue;
    for (const [i, x] of (s.sesiones || []).entries()) {
      if (!x?.dia || !['calidad', 'larga'].includes(x.tipo)) continue;
      const dia = sumarDias(s.lunes, x.dia - 1);
      if (dia < hoy) continue;
      out.push({ id: `carrera-${s.lunes}-${i}`, dia, hora: horaSesion, minutos: x.minutos || (x.km ? Math.round(x.km * 6) : 60),
        titulo: `Carrera: ${x.titulo || (x.tipo === 'larga' ? 'Tirada larga' : 'Calidad')}`, nombre: x.titulo || 'tu sesión clave',
        descripcion: 'Sesión clave de tu plan de carrera (FBE Equipo).', aviso: `Hoy toca ${x.titulo || 'tu sesión clave'}`, avisoMin: 30 });
    }
  }
  return out.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0));
}
