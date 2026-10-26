// Hábitos diarios: lo que el coach pide cada día (o unos días a la semana) y lo que el atleta apunta.
// Un hábito numérico se cumple al llegar al objetivo («al menos 10.000 pasos») o al no pasarse
// («como mucho 2 cafés»); uno de sí/no, al marcarlo como hecho.
import { sumarDias, lunesDe, diasEntre, hoyISO, aISO } from './fechas.js';
import { num } from './calculos.js';

export const ICONOS_HABITO = [
  ['pasos', 'Pasos'], ['proteina', 'Proteína'], ['agua', 'Agua'], ['sueno', 'Sueño'],
  ['movilidad', 'Movilidad'], ['verdura', 'Fruta y verdura'], ['libre', 'Otro'],
];

// Plantillas para que el coach los ponga en dos toques (los números son un punto de partida, se cambian)
export const PLANTILLAS_HABITO = [
  { nombre: 'Pasos', tipo: 'numero', objetivo: 8000, unidad: 'pasos', icono: 'pasos', dias_semana: 7 },
  { nombre: 'Proteína', tipo: 'numero', objetivo: 120, unidad: 'g', icono: 'proteina', dias_semana: 7 },
  { nombre: 'Agua', tipo: 'numero', objetivo: 2, unidad: 'l', icono: 'agua', dias_semana: 7 },
  { nombre: 'Horas de sueño', tipo: 'numero', objetivo: 7, unidad: 'h', icono: 'sueno', dias_semana: 7 },
  { nombre: 'Raciones de fruta y verdura', tipo: 'numero', objetivo: 5, unidad: 'raciones', icono: 'verdura', dias_semana: 7 },
  { nombre: '10 min de movilidad', tipo: 'si_no', icono: 'movilidad', dias_semana: 3 },
];

// Cuánto se suma o se resta con cada toque al apuntar (según la unidad)
const unidadDe = (h) => String(h.unidad || '').trim().toLowerCase().replace(/\.$/, '');
export function pasoHabito(h) {
  const u = unidadDe(h);
  if (u === 'pasos') return 500;
  if (['l', 'litro', 'litros'].includes(u)) return 0.25;
  if (['h', 'hora', 'horas'].includes(u)) return 0.5;
  if (u === 'km') return 0.5;
  if (u === 'g') return Number(h.objetivo) >= 60 ? 10 : 5;
  if (u === 'ml') return 250;
  if (u === 'kcal') return 100;
  return Number(h.objetivo) >= 1000 ? 500 : Number(h.objetivo) >= 100 ? 10 : 1;
}

// Decimales al apuntar: ninguno en lo que se cuenta de uno en uno a lo grande (pasos, kcal, ml); en el resto,
// hasta dos (1,5 l; 7,5 h; 2,25 l), sea cual sea cómo haya escrito el coach la unidad («L», «litros»…)
export function decimalesHabito(h) {
  const u = unidadDe(h);
  return u === 'pasos' || u === 'kcal' || u === 'ml' || Number(h.objetivo) >= 1000 ? 0 : 2;
}

export function cumpleHabito(h, valor) {
  if (valor == null || valor === '') return false;
  const v = Number(valor);
  if (!Number.isFinite(v)) return false;
  if (h.tipo === 'si_no') return v >= 1;
  return h.sentido === 'como_mucho' ? v <= Number(h.objetivo) : v >= Number(h.objetivo);
}

// Fracción del anillo (0–1): en los numéricos «al menos», lo apuntado frente al objetivo; en el resto, 0 o 1
export function fraccionHabito(h, valor) {
  if (valor == null) return 0;
  if (h.tipo === 'numero' && h.sentido !== 'como_mucho') return Math.max(0, Math.min(1, Number(valor) / Number(h.objetivo)));
  return cumpleHabito(h, valor) ? 1 : 0;
}

// «8000 pasos» (en español, los de cuatro cifras van sin punto), «12.000 pasos», «120 g», «2 l», «Hecho»
export function textoValor(h, valor, { conUnidad = true } = {}) {
  if (valor == null) return '—';
  if (h.tipo === 'si_no') return Number(valor) >= 1 ? 'Hecho' : 'No';
  const v = Number(valor);
  const t = v >= 1000 ? Math.round(v).toLocaleString('es-ES') : num(v, v % 1 ? 2 : 0);
  return conUnidad && h.unidad ? `${t} ${h.unidad}` : t;
}

export function textoObjetivo(h) {
  if (h.tipo === 'si_no') return h.dias_semana < 7 ? `${h.dias_semana} días a la semana` : 'Cada día';
  const base = `${h.sentido === 'como_mucho' ? 'Como mucho' : 'Al menos'} ${textoValor(h, h.objetivo)}`;
  return h.dias_semana < 7 ? `${base}, ${h.dias_semana} días a la semana` : `${base} al día`;
}

// Resumen de un hábito a una fecha. registros: [{ fecha, valor }] de ese hábito (en cualquier orden).
//  · semana: los 7 días de esta semana (lunes a domingo), cuántos cumple y cuántos se piden
//  · rachaDias: días seguidos cumpliéndolo hasta hoy (hoy cuenta si ya está; si aún no, no rompe)
//  · rachaSemanas: semanas seguidas llegando a los días pedidos (la semana en curso suma si ya llega, y no rompe)
//  · pct7 / pct30: de lo que tocaba en los últimos 7 o 30 días (desde que existe el hábito), cuánto cumplió.
//    Hoy solo cuenta si ya está cumplido: por la mañana, sin apuntar aún, no baja el % (ni salta el aviso del coach)
//  · media7: media de lo apuntado los últimos 7 días (solo numéricos; solo los días con dato)
export function resumenHabito(h, registros = [], hoy = hoyISO()) {
  const porDia = new Map(registros.map((r) => [String(r.fecha).slice(0, 10), Number(r.valor)]));
  const cumpleDia = (iso) => cumpleHabito(h, porDia.get(iso));
  const desde = h.creado_en ? aISO(new Date(h.creado_en)) : null;
  const lunes = lunesDe(hoy);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const iso = sumarDias(lunes, i);
    return { iso, valor: porDia.get(iso) ?? null, cumple: cumpleDia(iso), futuro: iso > hoy, hoy: iso === hoy };
  });
  const cumplidosSemana = dias.filter((d) => d.cumple).length;

  let rachaDias = 0;
  for (let iso = cumpleDia(hoy) ? hoy : sumarDias(hoy, -1); cumpleDia(iso); iso = sumarDias(iso, -1)) rachaDias++;

  const llegaSemana = (l) => Array.from({ length: 7 }, (_, i) => sumarDias(l, i)).filter(cumpleDia).length >= h.dias_semana;
  let rachaSemanas = 0;
  for (let l = llegaSemana(lunes) ? lunes : sumarDias(lunes, -7); llegaSemana(l) && (!desde || sumarDias(l, 6) >= desde); l = sumarDias(l, -7)) rachaSemanas++;

  const pct = (n) => {
    const fin = cumpleDia(hoy) ? hoy : sumarDias(hoy, -1);
    let ini = sumarDias(fin, -(n - 1));
    if (desde && desde > ini) ini = desde;
    const dentro = diasEntre(ini, fin) + 1;
    if (dentro <= 0) return { pct: 0, dias: 0, cumplidos: 0 };
    let cumplidos = 0;
    for (let iso = ini; iso <= fin; iso = sumarDias(iso, 1)) if (cumpleDia(iso)) cumplidos++;
    const pedidos = (h.dias_semana * dentro) / 7;
    return { pct: Math.min(100, Math.round((cumplidos / pedidos) * 100)), dias: dentro, cumplidos };
  };

  const ult7 = Array.from({ length: 7 }, (_, i) => porDia.get(sumarDias(hoy, -i))).filter((v) => v != null);
  return {
    habito: h,
    hoy: porDia.get(hoy) ?? null,
    cumpleHoy: cumpleDia(hoy),
    fraccionHoy: fraccionHabito(h, porDia.get(hoy) ?? null),
    semana: { dias, cumplidos: cumplidosSemana, pedidos: h.dias_semana, llega: cumplidosSemana >= h.dias_semana },
    rachaDias,
    rachaSemanas,
    pct7: pct(7),
    pct30: pct(30),
    media7: h.tipo === 'numero' && ult7.length ? ult7.reduce((t, v) => t + v, 0) / ult7.length : null,
    diasConDato7: ult7.length,
    // Los últimos 28 días (del más antiguo a hoy), para el calendario de Progreso; antes de existir, «antes»
    ultimos28: Array.from({ length: 28 }, (_, i) => {
      const iso = sumarDias(hoy, i - 27);
      return { iso, valor: porDia.get(iso) ?? null, cumple: cumpleDia(iso), antes: !!desde && iso < desde };
    }),
  };
}

// Cumplimiento conjunto (para el panel del coach): media de los % a 7 días de sus hábitos activos con al menos
// una semana de vida (los recién puestos no cuentan todavía)
export function cumplimientoHabitos(habitos, registrosPorHabito, hoy = hoyISO()) {
  const maduros = habitos.filter((h) => h.activo !== false && (!h.creado_en || diasEntre(aISO(new Date(h.creado_en)), hoy) >= 6));
  if (!maduros.length) return null;
  const pcts = maduros.map((h) => resumenHabito(h, registrosPorHabito[h.id] || [], hoy).pct7.pct);
  return { pct: Math.round(pcts.reduce((t, x) => t + x, 0) / pcts.length), n: maduros.length };
}
