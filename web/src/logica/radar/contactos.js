// Radar de contacto: cuánto contacto personal tiene el coach con cada atleta. Lógica pura (sin red ni pantalla).
//
// Un «contacto» es un día (de Madrid) en que el coach le escribe algo solo a ese atleta: chat, nota de voz o un comentario
// en una sesión, un vídeo o un check-in. Cinco mensajes el mismo día son un contacto. No cuentan las difusiones (el mismo
// mensaje a varios), los mensajes programados que aún no han salido ni los eliminados.
import { fechaMadrid, sumarDias, diasEntre } from '../fechas.js';

export const VENTANA_DIAS = 7;        // los últimos 7 días, con hoy
export const SEMANAS_HISTORIA = 4;    // cuántas ventanas de 7 días se enseñan hacia atrás
export const DIAS_HISTORIA = VENTANA_DIAS * SEMANAS_HISTORIA;
export const DIAS_SIN_CONTESTAR = 14; // un mensaje suyo más antiguo ya no se da por pendiente

// Cuándo llega un mensaje: los programados, a su hora
const instante = (c) => Date.parse(c.enviar_en || c.creado_en);
export const haSalido = (c, ahora = Date.now()) => !c.enviar_en || Date.parse(c.enviar_en) <= ahora;
const vale = (c, ahora) => !!c && !c.eliminado_en && Number.isFinite(instante(c)) && haSalido(c, ahora);

// Los mensajes del coach que son una difusión: el mismo envío (cliente_id) para dos o más atletas o, sin ese dato, tres o
// más atletas en el mismo instante exacto (la difusión los inserta de una vez). Devuelve un Set con sus ids.
export function difusiones(comentarios = []) {
  const porEnvio = new Map(), porInstante = new Map();
  for (const c of comentarios) {
    if (!c || c.autor !== 'coach') continue;
    if (c.cliente_id) { if (!porEnvio.has(c.cliente_id)) porEnvio.set(c.cliente_id, []); porEnvio.get(c.cliente_id).push(c); }
    const t = c.enviar_en || c.creado_en;
    if (t) { if (!porInstante.has(t)) porInstante.set(t, []); porInstante.get(t).push(c); }
  }
  const ids = new Set();
  const marcar = (grupos, minimo) => {
    for (const lista of grupos.values()) {
      if (new Set(lista.map((c) => c.atleta_id)).size >= minimo) for (const c of lista) ids.add(c.id);
    }
  };
  marcar(porEnvio, 2);
  marcar(porInstante, 3);
  return ids;
}

const vacio = () => ({ dias: [], en7: 0, mensajes7: 0, ultimo: null, diasSin: null, semanas: Array(SEMANAS_HISTORIA).fill(0), teEscribio: null, fuera: [] });

// El contacto con cada atleta: { [atleta_id]: { dias, en7, mensajes7, ultimo, diasSin, semanas, teEscribio, fuera } }
//   dias: los días con contacto personal de los últimos 28 (ISO, de más antiguo a más reciente), con los apuntados a mano
//   en7: cuántos de esos días caen en los últimos 7 (con hoy); mensajes7: cuántos mensajes personales en esos 7 días
//   ultimo: el último día con contacto (o null); diasSin: días desde entonces (0 = hoy; null = nunca en 28 días)
//   semanas: días con contacto en cada ventana de 7 días, de la más antigua a la actual
//   teEscribio: { dia, hace } si el último mensaje de la conversación es del atleta (y no un resumen automático)
//   fuera: los días apuntados a mano («Ya hablamos»), que cuentan como contacto
// hoy: el día de Madrid; fuera: { [atleta_id]: [dias ISO] } (lo guarda el propio dispositivo: ver local.js)
export function contactosPorAtleta(comentarios = [], { hoy = fechaMadrid(), ahora = Date.now(), fuera = {} } = {}) {
  const desde = sumarDias(hoy, -(DIAS_HISTORIA - 1));
  const masivos = difusiones(comentarios);
  const acc = {};
  const de = (id) => (acc[id] ||= { dias: new Set(), mensajes7: 0, ultimoCoach: -Infinity, ultimoAtleta: -Infinity });
  const semana = sumarDias(hoy, -(VENTANA_DIAS - 1));
  for (const c of comentarios) {
    if (!vale(c, ahora) || !c.atleta_id) continue;
    const t = instante(c), dia = fechaMadrid(new Date(t));
    if (dia > hoy) continue;
    const a = de(c.atleta_id);
    if (c.autor === 'coach') {
      if (masivos.has(c.id)) continue;
      if (t > a.ultimoCoach) a.ultimoCoach = t;
      if (dia < desde) continue;
      a.dias.add(dia);
      if (dia >= semana) a.mensajes7++;
    } else if (c.autor === 'atleta' && !c.resumen_sesion) {
      if (t > a.ultimoAtleta) a.ultimoAtleta = t;
    }
  }
  const res = {};
  const ids = new Set([...Object.keys(acc), ...Object.keys(fuera || {})]);
  for (const id of ids) {
    const a = acc[id] || { dias: new Set(), mensajes7: 0, ultimoCoach: -Infinity, ultimoAtleta: -Infinity };
    const aMano = [...new Set((fuera?.[id] || []).filter((d) => typeof d === 'string' && d >= desde && d <= hoy))].sort();
    const dias = [...new Set([...a.dias, ...aMano])].sort();
    const ultimo = dias.length ? dias[dias.length - 1] : null;
    const semanas = Array.from({ length: SEMANAS_HISTORIA }, (_, i) => {
      const fin = sumarDias(hoy, -VENTANA_DIAS * (SEMANAS_HISTORIA - 1 - i)), ini = sumarDias(fin, -(VENTANA_DIAS - 1));
      return dias.filter((d) => d >= ini && d <= fin).length;
    });
    // Sin contestar: lo último de la conversación es suyo, y no has apuntado a mano que habéis hablado ese día o después
    let teEscribio = null;
    if (a.ultimoAtleta > a.ultimoCoach && Number.isFinite(a.ultimoAtleta)) {
      const dia = fechaMadrid(new Date(a.ultimoAtleta));
      const hace = diasEntre(dia, hoy);
      if (hace <= DIAS_SIN_CONTESTAR && !aMano.some((d) => d >= dia)) teEscribio = { dia, hace };
    }
    res[id] = { dias, en7: semanas[SEMANAS_HISTORIA - 1], mensajes7: a.mensajes7, ultimo, diasSin: ultimo ? diasEntre(ultimo, hoy) : null, semanas, teEscribio, fuera: aMano };
  }
  return res;
}

export const contactoDe = (contactos, atletaId) => contactos?.[atletaId] || vacio();

// «hoy», «ayer», «hace 3 días» (para «último contacto»); null: «nunca»
export function haceDias(n) {
  if (n == null) return 'nunca';
  if (n <= 0) return 'hoy';
  if (n === 1) return 'ayer';
  return `hace ${n} días`;
}

// «1 de 2 días de contacto en los últimos 7 · último: ayer»
export function textoContacto(c, { objetivo = 2 } = {}) {
  const n = c?.en7 || 0;
  const ultimo = c?.ultimo ? `último: ${haceDias(c.diasSin)}` : 'sin mensajes tuyos en 4 semanas';
  return `${n} de ${objetivo} ${objetivo === 1 ? 'día' : 'días'} de contacto en los últimos 7 · ${ultimo}`;
}
