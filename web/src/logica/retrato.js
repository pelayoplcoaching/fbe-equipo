// (personalización 2, tanda 4) Que sea suyo y que al coach le llegue personal: su retrato de atleta («Tu ADN FBE», solo
// de su entrenamiento), la carta del mes (un borrador para el coach), «Para hablarle» en la ficha y la foto de
// motivación (en el móvil). Lógica pura.
import { diasEntre, sumarDias, fechaMadrid } from './fechas.js';
import { g, segunTono } from './trato.js';
import { costumbres, FRANJAS } from './perfil.js';
import { NOMBRE_GRUPO } from './calculos.js';
import { cuentaMeta } from './rumbo.js';

const DIAS_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const DIAS_UNO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const n1 = (v) => String(Math.round(Number(v) * 10) / 10).replace('.', ',');
const minus = (s) => (s ? s.charAt(0).toLocaleLowerCase('es') + s.slice(1) : s);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ---------- 18. Su retrato de atleta («Tu ADN FBE») ----------
// Tras 8 semanas y 12 sesiones. Solo de su entrenamiento: cuándo entrena, su grupo fuerte, su constancia, «su»
// ejercicio y si entrena con su música. Nada de salud ni de rasgos de personalidad.
export function adnFbe({ entrenos = [], progreso = null, fechaAlta = null, hoy, conMusica = false } = {}, t = null) {
  const alta = String(fechaAlta || '').slice(0, 10);
  if (!alta || !hoy) return null;
  const dias = diasEntre(alta, hoy);
  const c = costumbres(entrenos, hoy);
  if (dias < 56 || c.sesiones < 12) return null;
  const rasgos = [];
  // cuándo
  const fav = c.favoritos.length === 1 ? DIAS_PLURAL[c.favoritos[0]] : c.favoritos.length === 2 ? `${DIAS_PLURAL[c.favoritos[0]]} y ${DIAS_PLURAL[c.favoritos[1]]}` : null;
  const franja = c.franja ? minus(FRANJAS.find(([k]) => k === c.franja)?.[1] || '') : null;
  if (fav || franja) rasgos.push({ clave: 'cuando', titulo: 'Cuándo', texto: [fav && `Los ${fav}`, franja].filter(Boolean).join(', ') });
  // su fuerte (el grupo con más series) y su ejercicio (el que más ha hecho)
  const ejs = (progreso?.ejercicios || []).filter((e) => e.series > 0);
  const porGrupo = {};
  for (const e of ejs) { const gr = (e.grupos_musculares || [])[0]; if (gr) porGrupo[gr] = (porGrupo[gr] || 0) + e.series; }
  const fuerte = Object.entries(porGrupo).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (fuerte && NOMBRE_GRUPO[fuerte]) rasgos.push({ clave: 'fuerte', titulo: 'Tu fuerte', texto: NOMBRE_GRUPO[fuerte] });
  const suyo = [...ejs].sort((a, b) => b.series - a.series)[0];
  if (suyo) rasgos.push({ clave: 'suyo', titulo: 'Tu ejercicio', texto: suyo.nombre });
  // constancia
  const semanas = Math.max(1, dias / 7);
  const porSemana = c.sesiones / semanas;
  rasgos.push({ clave: 'constancia', titulo: 'Constancia', texto: `${n1(porSemana)} sesiones por semana` });
  if (conMusica) rasgos.push({ clave: 'musica', titulo: 'Banda sonora', texto: 'La tuya' });
  // la frase: de su día favorito, de su constancia o de su franja
  const quien = g(t, 'de las que', 'de los que', 'de quienes');
  let frase;
  if (c.favoritos.length === 1 && porSemana >= 2) frase = `Eres ${quien} no fallan un ${DIAS_UNO[c.favoritos[0]]}.`;
  else if (porSemana >= 3) frase = `Eres ${quien} vienen pase lo que pase: ${n1(porSemana)} sesiones por semana.`;
  else if (c.franja === 'manana') frase = `Eres ${quien} entrenan antes de que el día empiece.`;
  else if (c.franja === 'noche') frase = `Eres ${quien} cierran el día entrenando.`;
  else frase = `Eres ${quien} vuelven siempre: ${c.sesiones} sesiones y contando.`;
  const titulo = segunTono(t, { cercano: 'Tu ADN FBE', directo: 'Tu ADN FBE', tope: '¡Tu ADN FBE!' });
  const compartir = `${titulo}\n${frase}\n${rasgos.map((r) => `${r.titulo}: ${r.texto}`).join('\n')}`;
  return { titulo, frase, rasgos, compartir, sesiones: c.sesiones };
}

// ---------- 19. La carta del mes ----------
// Un borrador para cada atleta con sus datos del mes (sesiones, récords, su porqué, su meta) y lo que viene, en el tono
// que elija el coach. mes: 'AAAA-MM' (el que se cuenta); entrenos: los suyos (api.entrenamientos).
export function mesDeLaCarta(hoy) {
  // del 1 al 7, la del mes pasado; desde el 24, la de este; entre medias, la de este (lo que lleva)
  const [a, m, d] = String(hoy).split('-').map(Number);
  if (d <= 7) { const pm = m === 1 ? 12 : m - 1; return `${m === 1 ? a - 1 : a}-${String(pm).padStart(2, '0')}`; }
  return `${a}-${String(m).padStart(2, '0')}`;
}
export function cartaDelMes({ nombre = '', personal = null, entrenos = [], mes, hoy, tono = 'cercano', firma = '' } = {}) {
  const t = { nombre: personal?.apodo || String(nombre || '').trim().split(/\s+/)[0] || '', genero: personal?.genero || 'n', tono };
  const delMes = (entrenos || []).filter((x) => String(x?.fecha || '').slice(0, 7) === mes);
  const sesiones = delMes.length, records = delMes.reduce((s, x) => s + (Number(x.records) || 0), 0);
  const nombreMes = MESES[Number(String(mes).slice(5, 7)) - 1] || '';
  const hola = segunTono(t, { cercano: `¡Hola, ${t.nombre}!`, directo: `${t.nombre}:`, tope: `¡${t.nombre}, qué mes!` }).replace(/^\u00a1Hola, !$|^:$|^\u00a1, qu\u00e9 mes!$/, '\u00a1Hola!');
  const partes = [hola];
  if (sesiones) {
    const rec = records ? ` y ${records === 1 ? 'un récord' : `${records} récords`}` : '';
    partes.push(segunTono(t, {
      cercano: `Este ${nombreMes} has hecho ${sesiones === 1 ? '1 sesión' : `${sesiones} sesiones`}${rec}. ${records ? 'Se nota el trabajo.' : 'Cada una suma, aunque no se vea en la báscula del récord.'}`,
      directo: `${nombreMes.charAt(0).toLocaleUpperCase('es')}${nombreMes.slice(1)}: ${sesiones} ${sesiones === 1 ? 'sesión' : 'sesiones'}${rec}.`,
      tope: `${sesiones === 1 ? '1 sesión' : `${sesiones} sesiones`}${rec} en ${nombreMes}: ${records ? '¡brutal!' : '¡a seguir sumando!'}`,
    }));
  } else {
    partes.push(segunTono(t, { cercano: `Este ${nombreMes} ha costado entrenar, y no pasa nada: lo importante es volver.`, directo: `En ${nombreMes} no hubo sesiones. Volvemos.`, tope: `${nombreMes.charAt(0).toLocaleUpperCase('es')}${nombreMes.slice(1)} se nos escapó: ¡el siguiente es nuestro!` }));
  }
  if (personal?.porque) partes.push(`Me acuerdo de tu porqué: «${personal.porque}». Vamos a por ello.`);
  const m = cuentaMeta(personal, hoy);
  if (m && !m.pasada && m.dias != null) partes.push(`${m.texto}: ${m.dias <= 30 ? 'estamos en la recta final' : 'vamos bien de tiempo'}.`);
  else if (m && m.dias == null) partes.push(`Seguimos a por tu meta: ${minus(m.nombre)}.`);
  partes.push(segunTono(t, { cercano: 'El mes que viene, a seguir: cualquier cosa, aquí me tienes.', directo: 'Siguiente mes: mismo plan. Cualquier duda, me dices.', tope: '¡El mes que viene, más y mejor!' }));
  if (firma) partes.push(firma);
  return partes.join('\n\n');
}

// ---------- 20. «Para hablarle» ----------
// Todo lo que hace falta para escribirle de un vistazo, y una idea de qué decirle. ultimoCoach: la fecha (ISO) del
// último mensaje del coach.
const NOMBRE_GENERO = { f: 'En femenino', m: 'En masculino', n: 'Sin marcar' };
const NOMBRE_TONO = { cercano: 'Cercano', directo: 'Directo', tope: 'A tope' };
export function paraHablarle({ nombre = '', personal = null, entrenos = [], ultimoCoach = null, hoy } = {}) {
  const p = personal || {};
  const filas = [];
  filas.push(['Cómo le llamamos', p.apodo || String(nombre || '').trim().split(/\s+/)[0] || '—']);
  filas.push(['Cómo le hablamos', `${NOMBRE_GENERO[p.genero] || 'Sin marcar'} · ${NOMBRE_TONO[p.tono] || 'Cercano'}`]);
  if (p.porque) filas.push(['Su porqué', `«${p.porque}»`]);
  const m = cuentaMeta(p, hoy);
  if (m) filas.push(['Su meta', m.texto]);
  const hechos = (entrenos || []).filter((x) => x?.fecha && x.fecha <= hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const conRecord = hechos.find((x) => Number(x.records) > 0);
  if (conRecord) filas.push(['Su último hito', `${conRecord.records === 1 ? 'Un récord' : `${conRecord.records} récords`} el ${conRecord.fecha.slice(8, 10)}/${conRecord.fecha.slice(5, 7)}${conRecord.nombre ? ` (${conRecord.nombre})` : ''}`]);
  // (el último mensaje es un instante: su día, el de Madrid; y si el reloj del móvil va por detrás, «Hoy», nunca «Hace -1 días»)
  const diaCoach = !ultimoCoach ? null : /^\d{4}-\d{2}-\d{2}$/.test(String(ultimoCoach)) ? String(ultimoCoach) : (Number.isNaN(new Date(ultimoCoach).getTime()) ? String(ultimoCoach).slice(0, 10) : fechaMadrid(new Date(ultimoCoach)));
  const diasCoach = diaCoach ? diasEntre(diaCoach, hoy) : null;
  filas.push(['Le escribiste', diasCoach == null || Number.isNaN(diasCoach) ? 'Nunca' : diasCoach <= 0 ? 'Hoy' : diasCoach === 1 ? 'Ayer' : `Hace ${diasCoach} días`]);
  // la idea: lo más oportuno primero
  const ultimo = hechos[0]?.fecha || null;
  const sinEntrenar = ultimo ? diasEntre(ultimo, hoy) : null;
  const semana = hechos.filter((x) => x.fecha > sumarDias(hoy, -7)).length;
  let idea;
  if (m && !m.pasada && m.dias != null && m.dias <= 14) idea = `Su meta está cerca (${minus(m.texto)}): un mensaje de ánimo para la recta final.`;
  else if (conRecord && diasEntre(conRecord.fecha, hoy) <= 3) idea = 'Acaba de batir un récord: felicítale por él.';
  else if (sinEntrenar != null && sinEntrenar >= 10) idea = `Lleva ${sinEntrenar} días sin entrenar: pregúntale cómo está, sin agobiar.`;
  else if (semana >= 3) idea = `${semana} sesiones esta semana: reconócele la constancia.`;
  else if (p.porque) idea = 'Recuérdale su porqué y pregúntale qué tal lo lleva.';
  else if (diasCoach == null || diasCoach >= 14) idea = 'Hace tiempo que no le escribes: un «¿qué tal vas?» basta.';
  else idea = 'Pregúntale cómo se siente con el bloque.';
  return { filas, idea };
}
