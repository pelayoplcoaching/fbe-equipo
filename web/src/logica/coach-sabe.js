// (personalización 3, tanda 9) Que el coach le conozca sin esfuerzo (y el atleta lo vea): lo que le hace volver (solo
// por lo que hace en la app), su alerta temprana (su propio patrón de parones), los hitos que merecen algo de verdad y su
// primer mes guiado (este, en los «Primeros pasos» de Hoy). Lógica pura.
import { diasEntre, sumarDias, lunesDe } from './fechas.js';

const pct = (x) => `${Math.round(x * 100)} %`;
// ¿Entrena en los 3 días siguientes a esa fecha?
const vuelveEn3 = (fechas, d) => fechas.some((f) => f > d && diasEntre(d, f) <= 3);

// ---------- 17. Lo que le hace volver ----------
// fechas de sus sesiones; mensajes: las fechas en que le escribió el coach; records: las fechas de sesiones con récord.
// Frente a lo de siempre (cualquier día de los últimos 120), cuánto vuelve a entrenar en los 3 días siguientes.
export function loQueLeFunciona({ entrenos = [], mensajes = [], hoy } = {}) {
  const desde = sumarDias(hoy, -120), hasta = sumarDias(hoy, -3);
  const fechas = [...new Set((entrenos || []).map((x) => x?.fecha).filter((f) => f && f >= desde))].sort();
  if (fechas.length < 8) return null;
  const dias = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  const base = dias.filter((d) => vuelveEn3(fechas, d)).length / dias.length;
  const lineas = [];
  const msg = [...new Set((mensajes || []).map((m) => String(m).slice(0, 10)))].filter((d) => d >= desde && d <= hasta);
  if (msg.length >= 4) {
    const t = msg.filter((d) => vuelveEn3(fechas, d)).length / msg.length;
    lineas.push({ clave: 'mensajes', tasa: t, base, texto: `Tras un mensaje del coach, vuelve a entrenar en 3 días el ${pct(t)} de las veces (de normal, el ${pct(base)}).`, sube: t - base >= 0.15 });
  }
  const rec = [...new Set((entrenos || []).filter((x) => Number(x.records) > 0 && x.fecha >= desde && x.fecha <= hasta).map((x) => x.fecha))];
  if (rec.length >= 3) {
    const t = rec.filter((d) => vuelveEn3(fechas, d)).length / rec.length;
    lineas.push({ clave: 'records', tasa: t, base, texto: `Tras un récord, vuelve en 3 días el ${pct(t)} de las veces.`, sube: t - base >= 0.15 });
  }
  if (!lineas.length) return null;
  const mejor = lineas.filter((l) => l.sube).sort((a, b) => b.tasa - a.tasa)[0];
  return { lineas, base, resumen: mejor ? (mejor.clave === 'mensajes' ? 'Le hace volver que le escribas.' : 'Le tira batir marcas: los récords le enganchan.') : 'Ningún empujón destaca: lo suyo es la rutina.' };
}

// ---------- 18. Su alerta temprana ----------
// Sus parones (10 días o más sin entrenar) y si antes de cada uno tuvo una semana floja (menos sesiones que su mediana).
// Si le pasa a menudo (2 de cada 3 o más) y la última semana está siendo así, el aviso; o si ya lleva más días sin
// entrenar de lo que suele aguantar sin parar.
export function alertaTemprana({ entrenos = [], hoy } = {}) {
  const fechas = [...new Set((entrenos || []).map((x) => x?.fecha).filter((f) => f && f <= hoy))].sort();
  if (fechas.length < 12) return null;
  const porSemana = {};
  for (const f of fechas) { const l = lunesDe(f); porSemana[l] = (porSemana[l] || 0) + 1; }
  const vals = Object.values(porSemana).sort((a, b) => a - b);
  const mediana = vals[Math.floor(vals.length / 2)];
  const parones = [];
  for (let i = 1; i < fechas.length; i++) if (diasEntre(fechas[i - 1], fechas[i]) >= 10) parones.push({ antes: fechas[i - 1], despues: fechas[i] });
  const ultimo = fechas[fechas.length - 1];
  const sin = diasEntre(ultimo, hoy);
  const huecos = []; for (let i = 1; i < fechas.length; i++) { const d = diasEntre(fechas[i - 1], fechas[i]); if (d < 10) huecos.push(d); }
  const maxHabitual = huecos.length ? Math.max(...huecos) : 7;
  if (sin >= 10) return { nivel: 'parado', texto: `Lleva ${sin} días sin entrenar.`, idea: 'Escríbele sin agobiar: cómo está y qué le vendría bien.' };
  const semanaFloja = (l) => (porSemana[l] || 0) < mediana;
  const conFloja = parones.filter((p) => semanaFloja(lunesDe(sumarDias(p.antes, -1))) || semanaFloja(lunesDe(p.antes))).length;
  const ultimos7 = fechas.filter((f) => diasEntre(f, hoy) < 7).length;
  if (parones.length >= 2 && conFloja / parones.length >= 0.66 && ultimos7 < mediana) {
    return { nivel: 'patron', texto: `Sus parones suelen empezar con una semana floja como esta (${conFloja} de ${parones.length} veces).`, idea: 'Adelántate: un mensaje corto esta semana suele bastar.' };
  }
  if (sin > maxHabitual && sin >= 5) return { nivel: 'raro', texto: `Lleva ${sin} días sin entrenar: más de lo que suele (como mucho, ${maxHabitual}).`, idea: 'Pregúntale qué tal, por si le ha pasado algo.' };
  return null;
}

// ---------- 19. Hitos que merecen algo de verdad ----------
// atletas: [{ id, nombre, fecha_alta, estado }]; personal: lo suyo (meta_fecha). Los de los últimos 30 días: su primer o
// segundo año, el día de su meta. enviados: { clave: true } (lo marca el coach en su móvil).
export function enviosPendientes({ atletas = [], personal = [], hoy, enviados = {} } = {}) {
  const out = [];
  for (const a of atletas || []) {
    if (!a?.id || a.estado === 'baja') continue;
    const alta = String(a.fecha_alta || '').slice(0, 10);
    if (alta) {
      for (const [anios, t] of [[1, 'Cumple un año en el equipo'], [2, 'Cumple dos años en el equipo'], [3, 'Cumple tres años en el equipo']]) {
        const d = new Date(`${alta}T12:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() + anios);
        const f = d.toISOString().slice(0, 10);
        const dd = diasEntre(f, hoy);
        if (dd >= -7 && dd <= 30) out.push({ clave: `${a.id}:anio-${anios}`, atletaId: a.id, nombre: a.nombre, fecha: f, que: t });
      }
    }
    const p = (personal || []).find((x) => x.atleta_id === a.id);
    if (p?.meta_nombre && p.meta_fecha) {
      const dd = diasEntre(p.meta_fecha, hoy);
      if (dd >= 0 && dd <= 30) out.push({ clave: `${a.id}:meta-${p.meta_fecha}`, atletaId: a.id, nombre: a.nombre, fecha: p.meta_fecha, que: `Llegó el día de su meta: ${p.meta_nombre}` });
    }
  }
  return out.filter((x) => !enviados[x.clave]).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
export const IDEAS_REGALO = 'Una camiseta FBE, una carta escrita a mano o una llamada: algo que no sea una pantalla.';
