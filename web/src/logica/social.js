// La parte social del equipo (tanda «social», migración 053): lo que se calcula sin la base (o con lo que ya da el muro).
// Lo usan ui/Social.jsx, Comunidad.jsx, Hoy.jsx y PerfilSocial.jsx. Sin nombres de nadie aquí: todo viene en los datos.
import { lunesDe, sumarDias, fmtCorta, fechaMadrid } from './fechas.js';

// Las cuatro insignias sociales (también están en INSIGNIAS, logica/comunidad.js): [clave, emoji, nombre]
export const INSIGNIAS_SOCIALES = [['animador_25', '📣', 'Animador'], ['anfitrion_3', '👋', 'Anfitrión'], ['padrino_1', '🤲', 'Padrino'], ['puntual_3', '📍', 'Puntual']];

const fechaDe = (iso) => fechaMadrid(new Date(iso));
const nombreSesion = (p) => String(p?.resumen?.nombre || p?.resumen?.sesion || '').trim();

// «Misma sesión»: los entrenos compartidos hoy con el mismo nombre de sesión por personas distintas
// → [{ nombre, ids: [post ids], nombres: [autores], autores: [perfil ids] }], de más gente a menos
export function mismaSesion(posts = [], hoy = fechaMadrid()) {
  const por = new Map();
  for (const p of posts || []) {
    if (p?.tipo !== 'entreno' || !p.creado_en || fechaDe(p.creado_en) !== hoy) continue;
    const n = nombreSesion(p);
    if (!n) continue;
    const k = n.toLocaleLowerCase('es');
    const g = por.get(k) || { nombre: n, ids: [], nombres: [], autores: [] };
    if (g.autores.includes(p.autor_id)) continue;
    g.ids.push(p.id); g.nombres.push(p.autor?.nombre || 'Alguien del equipo'); g.autores.push(p.autor_id);
    por.set(k, g);
  }
  return [...por.values()].filter((g) => g.ids.length >= 2).sort((a, b) => b.ids.length - a.ids.length);
}

const cuantas = (r) => Object.values(r || {}).reduce((s, xs) => s + (xs?.length || 0), 0);

// «Lo mejor de la semana» (lunes y martes, de la semana pasada): la publicación más aplaudida, la más comentada, cuántos
// entrenos se compartieron, los récords (los pasa quien llama) y los nuevos. null si no toca o no hubo nada.
export function loMejorDeLaSemana(posts = [], hoy = fechaMadrid(), { nuevos = [], records = 0 } = {}) {
  const dow = new Date(`${hoy}T12:00:00Z`).getUTCDay();
  if (dow !== 1 && dow !== 2) return null;
  const desde = sumarDias(lunesDe(hoy), -7), hasta = sumarDias(desde, 6);
  const semana = (posts || []).filter((p) => p?.creado_en && p.tipo !== 'momento' && p.tipo !== 'aniversario' && fechaDe(p.creado_en) >= desde && fechaDe(p.creado_en) <= hasta);
  if (!semana.length) return null;
  const aplaudida = [...semana].sort((a, b) => cuantas(b.reacciones) - cuantas(a.reacciones))[0];
  const comentada = [...semana].sort((a, b) => (b.comentarios || 0) - (a.comentarios || 0))[0];
  return {
    desde, hasta,
    aplaudida: cuantas(aplaudida.reacciones) > 0 ? aplaudida : null,
    comentada: (comentada.comentarios || 0) > 0 ? comentada : null,
    entrenos: semana.filter((p) => p.tipo === 'entreno').length,
    records: Number(records) || 0,
    nuevos: (nuevos || []).map((x) => x.nombre).filter(Boolean),
  };
}

const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const tituloMes = (mes) => `${MESES_LARGO[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;

// El álbum del equipo: las fotos de las publicaciones que se ven, por meses (el más reciente primero)
// → [{ mes: '2026-11', titulo, fotos: [{ ruta, post, autor, creado_en }] }]
export function albumPorMeses(posts = []) {
  const por = new Map();
  for (const p of posts || []) {
    const fotos = Array.isArray(p?.fotos) && p.fotos.length ? p.fotos : p?.foto_ruta ? [p.foto_ruta] : [];
    if (!fotos.length || !p.creado_en || p.tipo === 'momento') continue;
    const mes = fechaDe(p.creado_en).slice(0, 7);
    const g = por.get(mes) || { mes, titulo: tituloMes(mes), fotos: [] };
    for (const ruta of fotos) g.fotos.push({ ruta: typeof ruta === 'string' ? ruta : ruta?.ruta || '', post: p.id, autor: p.autor?.nombre || '', creado_en: p.creado_en });
    por.set(mes, g);
  }
  return [...por.values()].sort((a, b) => b.mes.localeCompare(a.mes)).map((g) => ({ ...g, fotos: g.fotos.sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en))) }));
}

// La nota de «hoy entreno a las…», limpia y de hasta 40 letras
export const limpiarNotaIntencion = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 40);
const horaCorta = (h) => (h ? String(h).slice(0, 5) : '');

// «Hoy a las 18:00 · Gimnasio del barrio», «Mañana», «Mañana a las 7:30»
export function textoIntencion(i, hoy = fechaMadrid()) {
  if (!i) return '';
  const dia = i.fecha === hoy ? 'Hoy' : i.fecha === sumarDias(hoy, 1) ? 'Mañana' : fmtCorta(i.fecha);
  const h = horaCorta(i.hora);
  return `${dia}${h ? ` a las ${h.replace(/^0/, '')}` : ''}${i.nota ? ` · ${i.nota}` : ''}`;
}

// El duelo, en una línea
export function textoDuelo(d, hoy = fechaMadrid()) {
  if (!d) return '';
  const cuando = d.semana > lunesDe(hoy) ? 'la semana que viene' : d.semana < lunesDe(hoy) ? 'la semana pasada' : 'esta semana';
  if (d.estado === 'pendiente') return d.soy_retador ? `Has retado a ${d.rival_nombre} para ${cuando}` : `${d.rival_nombre} te reta ${cuando}`;
  if (d.estado === 'rechazado') return `${d.rival_nombre} no ha aceptado`;
  // (053) si el rival ya no está en el equipo o en el ranking, sus sesiones no se enseñan
  if (d.estado === 'aceptado' && d.suyas == null) return d.acabado ? `Duelo con ${d.rival_nombre}: hiciste ${d.mias}` : `Llevas ${d.mias} en el duelo con ${d.rival_nombre}`;
  if (d.acabado) {
    const r = resultadoDuelo(d);
    return r === 'ganado' ? `Ganaste ${d.mias} a ${d.suyas} a ${d.rival_nombre}` : r === 'perdido' ? `${d.rival_nombre} ganó ${d.suyas} a ${d.mias}` : `Empate a ${d.mias} con ${d.rival_nombre}`;
  }
  return `Vas ${d.mias} a ${d.suyas} con ${d.rival_nombre}`;
}
// 'ganado' | 'perdido' | 'empate' cuando la semana acabó; si no, null
export function resultadoDuelo(d) {
  if (!d?.acabado || d.estado !== 'aceptado' || d.suyas == null) return null;
  return d.mias > d.suyas ? 'ganado' : d.mias < d.suyas ? 'perdido' : 'empate';
}
// A quién puedo retar: los del equipo menos yo y menos con quien ya tengo duelo esa semana
export function candidatosDuelo(personas = [], yo, duelos = [], semana) {
  const ocupados = new Set((duelos || []).filter((d) => d.semana === semana && d.estado !== 'rechazado').map((d) => d.rival));
  return (personas || []).filter((p) => p.perfil_id !== yo && !p.coach && !ocupados.has(p.perfil_id)).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// La huella, en frases cortas (lo que es cero no sale)
export function huellaFrases(h) {
  if (!h) return [];
  const n = (k) => Number(h[k]) || 0;
  const pl = (v, uno, varios) => `${v} ${v === 1 ? uno : varios}`;
  const out = [];
  if (n('animos_dados')) out.push(`Has mandado ${pl(n('animos_dados'), 'ánimo', 'ánimos')}`);
  if (n('animos_recibidos')) out.push(`Te han mandado ${pl(n('animos_recibidos'), 'ánimo', 'ánimos')}`);
  if (n('semanas_animando') > 1) out.push(`Llevas ${n('semanas_animando')} semanas seguidas animando a alguien`);
  if (n('bienvenidas')) out.push(`Has dado la bienvenida a ${pl(n('bienvenidas'), 'persona', 'personas')}`);
  if (n('comentarios')) out.push(`${pl(n('comentarios'), 'comentario', 'comentarios')} en el muro`);
  if (n('reacciones')) out.push(`${pl(n('reacciones'), 'reacción', 'reacciones')}`);
  if (n('quedadas')) out.push(`Has ido a ${pl(n('quedadas'), 'quedada', 'quedadas')}`);
  if (n('ahijados')) out.push(`Has acompañado a ${pl(n('ahijados'), 'persona', 'personas')} en su primer mes`);
  if (n('duelos_ganados')) out.push(`${pl(n('duelos_ganados'), 'duelo ganado', 'duelos ganados')}`);
  if (n('elegido')) out.push(`El equipo te ha elegido compañero de la semana ${n('elegido') === 1 ? 'una vez' : `${n('elegido')} veces`}`);
  return out;
}

// ¿Es hoy su cumpleaños? (lo que puso en Lo tuyo: mes y día)
export const esCumpleHoy = (p, hoy = fechaMadrid()) => !!p && Number(p.cumple_mes) === Number(hoy.slice(5, 7)) && Number(p.cumple_dia) === Number(hoy.slice(8, 10));

// «Hoy es el cumple de Rubén» / «Hoy es el cumple de Rubén y de Ana»
export function textoCumples(lista = []) {
  const otros = (lista || []).filter((x) => !x.soy_yo).map((x) => x.nombre);
  if (!otros.length) return '';
  return `Hoy es el cumple de ${otros.length === 1 ? otros[0] : `${otros.slice(0, -1).join(', ')} y ${otros[otros.length - 1]}`}`;
}
