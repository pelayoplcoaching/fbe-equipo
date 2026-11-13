// (personalización 3, tanda 8) Que le acompañe más allá de la app: el reto del mes hecho para él, su compañero afín y su
// álbum de hitos. Lógica pura.
import { diasEntre, sumarDias } from './fechas.js';

const DIAS_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dow = (f) => (new Date(`${f}T12:00:00Z`).getUTCDay() + 6) % 7;
const mesDe = (f) => String(f).slice(0, 7);
const n1 = (v) => String(Math.round(Number(v) * 10) / 10).replace('.', ',');

// ---------- 14. El reto del mes, hecho para él ----------
// El del coach (agenda tipo 'reto' de este mes) manda. Si no: su día flojo (el día que suele entrenar pero no siempre:
// del 40 al 85 % de las semanas en las últimas 8) → «Este mes, todos los jueves»; si no, sesiones del mes (su media + 1).
export function retoDelMes({ entrenos = [], agenda = [], hoy } = {}) {
  const mes = mesDe(hoy);
  const nombreMes = MESES[Number(mes.slice(5, 7)) - 1];
  const delCoach = (agenda || []).filter((x) => x.tipo === 'reto' && mesDe(x.fecha) === mes).sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)))[0];
  if (delCoach) return { tipo: 'coach', titulo: delCoach.titulo, mes: nombreMes, texto: `Tu reto de ${nombreMes}, de tu coach: ${delCoach.titulo}` };
  const fechas = [...new Set((entrenos || []).map((x) => x?.fecha).filter((f) => f && f <= hoy))];
  const inicioMes = `${mes}-01`;
  const hace8 = sumarDias(inicioMes, -56);
  const base = fechas.filter((f) => f >= hace8 && f < inicioMes).sort();
  const delMes = fechas.filter((f) => mesDe(f) === mes);
  if (base.length < 6) return null;
  // su día flojo: el que suele entrenar pero no siempre
  const semanasCon = Array.from({ length: 7 }, () => 0);
  for (const f of base) semanasCon[dow(f)] += 1;
  const semanas = Math.max(1, Math.round(diasEntre(base[0], inicioMes) / 7));
  const candidatos = semanasCon.map((n, i) => ({ i, p: n / semanas })).filter((x) => x.p >= 0.4 && x.p <= 0.85).sort((a, b) => b.p - a.p);
  if (candidatos.length) {
    const d = candidatos[0].i;
    // cuántos de ese día lleva este mes y cuántos ha habido hasta hoy (y quedan)
    const total = [], hechos = new Set(delMes.filter((f) => dow(f) === d));
    for (let f = `${mes}-01`; mesDe(f) === mes; f = sumarDias(f, 1)) if (dow(f) === d) total.push(f);
    return { tipo: 'dia', dia: d, mes: nombreMes, objetivo: total.length, hechos: total.filter((f) => hechos.has(f)).length,
      titulo: `Este mes, todos los ${DIAS_PLURAL[d]}`, texto: `Tu reto de ${nombreMes}: entrenar todos los ${DIAS_PLURAL[d]} (es el día que más se te escapa).` };
  }
  const porSemana = base.length / semanas;
  const objetivo = Math.max(4, Math.round(porSemana * 4.3) + 1);
  return { tipo: 'sesiones', mes: nombreMes, objetivo, hechos: delMes.length, titulo: `${objetivo} sesiones en ${nombreMes}`, texto: `Tu reto de ${nombreMes}: ${objetivo} sesiones (una más que tu media).` };
}

// ---------- 15. Su compañero afín ----------
// yo / otro: { franja, dias: [isodow 1..7], por_semana }. Más puntos si entrenan en la misma franja, los mismos días y
// con un ritmo parecido
export function puntuarAfin(yo, otro) {
  if (!yo || !otro) return 0;
  let p = 0;
  if (yo.franja && yo.franja === otro.franja) p += 3;
  const comunes = (yo.dias || []).filter((d) => (otro.dias || []).includes(d)).length;
  p += comunes * 1.5;
  if (Number(yo.por_semana) > 0 && Number(otro.por_semana) > 0 && Math.abs(yo.por_semana - otro.por_semana) <= 1) p += 1;
  return p;
}
const FRANJA_TXT = { manana: 'por la mañana', mediodia: 'a mediodía', tarde: 'por la tarde', noche: 'por la noche' };
export function textoAfin(x, yo = null) {
  const dias = (x.dias || []).map((d) => DIAS_PLURAL[d - 1]).filter(Boolean);
  const partes = [];
  if (x.franja) partes.push(`Entrena ${FRANJA_TXT[x.franja] || ''}`.trim());
  if (dias.length) partes.push(`sobre todo los ${dias.length === 1 ? dias[0] : `${dias.slice(0, -1).join(', ')} y ${dias.at(-1)}`}`);
  if (Number(x.por_semana) > 0) partes.push(`${n1(x.por_semana)} por semana`);
  const comun = yo && x.franja && yo.franja === x.franja ? ' · a tu misma hora' : '';
  return (partes.length ? partes.join(', ') : 'Aún sin entrenos recientes') + comun;
}
export function ordenarAfines(r) {
  const lista = r?.afines || [];
  const yo = lista.find((x) => x.yo) || null;
  return { yo, afines: lista.filter((x) => !x.yo).map((x) => ({ ...x, puntos: puntuarAfin(yo, x) })).sort((a, b) => b.puntos - a.puntos || String(a.nombre).localeCompare(String(b.nombre), 'es')) };
}

// ---------- 16. Su álbum de hitos ----------
// Las primeras veces que ve la app (primera sesión, sesiones 10/50/100/200, primer récord, primer 1RM estimado de 100 kg,
// primera dominada, sus aniversarios) y los que añade él (agenda tipo 'hito'). Ordenados de lo más reciente a lo primero.
export function albumHitos({ entrenos = [], progreso = null, fechaAlta = null, agenda = [], hoy } = {}) {
  const h = [];
  const ses = [...(entrenos || [])].filter((x) => x?.fecha && x.fecha <= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (ses[0]) h.push({ clave: 'primera', fecha: ses[0].fecha, titulo: 'Tu primera sesión', icono: 'hecho' });
  for (const n of [10, 50, 100, 200, 300, 500]) if (ses[n - 1]) h.push({ clave: `ses-${n}`, fecha: ses[n - 1].fecha, titulo: `Sesión ${n}`, icono: 'llama' });
  const rec = ses.find((x) => Number(x.records) > 0);
  if (rec) h.push({ clave: 'record', fecha: rec.fecha, titulo: 'Tu primer récord', icono: 'trofeo' });
  let cien = null, dom = null;
  for (const e of progreso?.ejercicios || []) {
    for (const p of e.puntos || []) {
      if (Number(p.valor) >= 100 && p.semana && (!cien || p.semana < cien.fecha)) cien = { fecha: p.semana, ej: e.nombre };
    }
    if (/dominada|pull ?up|chin ?up/i.test(e.nombre || '') && e.puntos?.[0]?.semana && (!dom || e.puntos[0].semana < dom.fecha)) dom = { fecha: e.puntos[0].semana };
  }
  if (cien) h.push({ clave: 'cien', fecha: cien.fecha, titulo: `Tu primer 1RM estimado de 100 kg (${cien.ej.charAt(0).toLocaleLowerCase('es')}${cien.ej.slice(1)})`, icono: 'trofeo' });
  if (dom) h.push({ clave: 'dominada', fecha: dom.fecha, titulo: 'Tus primeras dominadas', icono: 'estrella' });
  const alta = String(fechaAlta || '').slice(0, 10);
  if (alta) {
    for (const [m, t] of [[6, 'Medio año en el equipo'], [12, 'Un año en el equipo'], [24, 'Dos años en el equipo']]) {
      const d = new Date(`${alta}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + m);
      const f = d.toISOString().slice(0, 10);
      if (f <= hoy) h.push({ clave: `aniv-${m}`, fecha: f, titulo: t, icono: 'calendario' });
    }
  }
  for (const x of agenda || []) if (x.tipo === 'hito' && x.fecha <= hoy) h.push({ clave: `suyo-${x.id}`, id: x.id, fecha: x.fecha, titulo: x.titulo, icono: 'bandera', suyo: true, autor: x.autor });
  return h.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.clave.localeCompare(b.clave));
}
export const textoAlbum = (hitos, nombre = '') => `${nombre ? `El álbum de ${nombre}` : 'Mi álbum'} en FBE\n${(hitos || []).slice(0, 10).map((x) => `· ${x.titulo} (${x.fecha.slice(8, 10)}/${x.fecha.slice(5, 7)}/${x.fecha.slice(0, 4)})`).join('\n')}`;
