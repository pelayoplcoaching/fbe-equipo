// Compartir (rama compartir): lo que no depende de la pantalla. Los formatos de la imagen, la pegatina, el @ de cada
// uno, el pie de foto, el resumen en texto y los datos de las tarjetas de logro (récord, racha, semana completa, la
// semana del equipo y las publicaciones del muro). Ninguna lleva peso corporal, salud ni nutrición.
import { num } from './calculos.js';
import { pesoTxt, pesoNum, etiquetaPeso } from './unidades.js';
import { fmtCorta, diasEntre, hoyISO } from './fechas.js';
import { textoCardioHecho, cardioHechoValido, NOMBRE_MODALIDAD, ritmo } from './cardio.js';
import { PEGATINAS, textoPegatina, textoAniversario } from './celebracion.js';
import { textoRacha, unidadReto } from './comunidad.js';

// ---------- formatos ----------
// [clave, nombre, ayuda, ancho, alto]. La publicación (4:5) es la de siempre; la historia (9:16) deja arriba y abajo el
// hueco que tapan los controles de Instagram y de WhatsApp.
export const FORMATOS = [
  ['publicacion', 'Publicación', '4:5, para el muro', 1080, 1350],
  ['historia', 'Historia', '9:16, para historias', 1080, 1920],
];
export const formatoValido = (f) => FORMATOS.some(([k]) => k === f);
export const tamanoFormato = (f) => { const x = FORMATOS.find(([k]) => k === f) || FORMATOS[0]; return { W: x[3], H: x[4] }; };

// ---------- la pegatina ----------
export const PEGATINAS_TARJETA = [['', 'Ninguna'], ...PEGATINAS];
export const pegatinaTarjeta = (k) => (k ? textoPegatina(k) : null);

// ---------- los @ ----------
// Instagram deja letras, números, puntos y guiones bajos, hasta 30. Se guarda sin la arroba.
export function limpiarHandle(t) {
  const s = String(t || '').trim().replace(/^@+/, '').replace(/\s+/g, '');
  if (!s) return '';
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) throw new Error('Un nombre de Instagram lleva letras, números, puntos o guiones bajos (hasta 30).');
  return s;
}
export const conArroba = (h) => (h ? `@${String(h).replace(/^@+/, '')}` : '');
// El @ del equipo: lo pone el coach en config.js (instagram: 'fbecoaching'); sin él, no sale
export function handleEquipo(cfg = globalThis.FBE_CONFIG) {
  try { return limpiarHandle(cfg?.instagram); } catch { return ''; }
}
export const PREF_HANDLE = 'fbe-compartir-handle';

// ---------- lo que va en el texto ----------
export const HASHTAGS = ['#FBE', '#FuerzaBasadaEnEvidencia', '#Entreno'];
const junta = (xs, sep = ' · ') => xs.filter(Boolean).join(sep);

// Las cifras de una sesión en texto corto: «45 min · 18 series · 4,2 t · 1 récord»
export function cifrasTexto(d = {}) {
  if (d.cardio) return textoCardioHecho(d.cardio);
  const out = [];
  if (d.minutos) out.push(`${d.minutos} min`);
  if (d.series) out.push(`${d.series} ${d.series === 1 ? 'serie' : 'series'}`);
  if (d.tonelaje > 0) out.push(`${num(Math.round(d.tonelaje / 100) / 10, 1)} t`);
  const r = (d.records || []).length;
  if (r) out.push(`${r} ${r === 1 ? 'récord' : 'récords'}`);
  return out.join(' · ');
}

// El pie de foto para Instagram, Facebook o WhatsApp: una frase, las cifras, los @ y las etiquetas. tipo: sesion |
// record | racha | semana | equipo | mes | anio | logro
export function pieDeFoto(d = {}, { tipo = 'sesion', handle = '', equipo = handleEquipo() } = {}) {
  const t = tipo === 'sesion' && d.cardio ? 'cardio' : tipo;
  const frases = {
    sesion: `${d.nombre || 'Sesión'} ✅ ${cifrasTexto(d)}`,
    cardio: `${d.nombre || 'Cardio'} 🏃 ${cifrasTexto(d)}`,
    record: `🏆 Nuevo récord en ${d.nombre}: ${d.cifra?.v || ''}${d.cifra?.u ? ` ${d.cifra.u}` : ''}${d.lineas?.[0] ? ` · ${d.lineas[0]}` : ''}`,
    racha: `🔥 ${d.cifra?.v || ''} ${d.cifra?.t || ''}: ${d.lineas?.[0] || 'sin fallar una semana'}`,
    semana: `✅ Semana completa: ${junta(d.lineas || [])}`,
    equipo: `💪 Esta semana en el equipo: ${junta(d.lineas || [], ', ')}`,
    mes: `📆 ${d.nombre || 'Mi mes'}: ${cifrasTexto(d)}`,
    anio: `🗓️ ${d.nombre || 'Mi año'}: ${cifrasTexto(d)}`,
    logro: `🏅 ${d.nombre || 'Logro'}${d.lineas?.[0] ? `: ${d.lineas[0]}` : ''}`,
  };
  const records = tipo === 'sesion' ? (d.records || []).slice(0, 3).map((r) => `🏆 ${r.nombre}: ${r.texto}`) : [];
  const firma = junta([handle ? conArroba(handle) : '', equipo ? `Entreno con ${conArroba(equipo)}` : 'Entrenado con FBE Coaching'], ' · ');
  return [frases[t] || frases.sesion, ...records, firma, HASHTAGS.join(' ')].filter(Boolean).join('\n');
}

// El resumen en texto plano (para el grupo de WhatsApp, sin imagen): el nombre, las cifras, la mejor serie de cada
// ejercicio y los récords. conKilos: con los kilos (si no, solo los nombres)
export function resumenTexto(d = {}, { conKilos = true, handle = '', equipo = handleEquipo() } = {}) {
  const lineas = [`🏋️ ${d.nombre || 'Sesión'}${d.fecha ? ` · ${fmtCorta(d.fecha)}` : ''}`];
  const cifras = cifrasTexto(d);
  if (cifras) lineas.push(cifras);
  if (d.cardio && cardioHechoValido(d.cardio)) lineas.push(`${NOMBRE_MODALIDAD[d.cardio.modalidad] || 'Cardio'}: ${textoCardioHecho(d.cardio)}`);
  const records = d.records || [];
  if (records.length) { lineas.push(''); for (const r of records) lineas.push(`🏆 ${r.nombre}: ${r.texto}`); }
  const mejores = (d.mejores || []).filter((m) => !records.some((r) => r.nombre === m.nombre));
  if (mejores.length) {
    lineas.push('');
    for (const m of mejores) lineas.push(conKilos && m.serie ? `• ${m.nombre}: ${m.serie}` : `• ${m.nombre}`);
  }
  lineas.push('', junta([handle ? conArroba(handle) : '', equipo ? `Entreno con ${conArroba(equipo)}` : 'Entrenado con FBE Coaching'], ' · '));
  return lineas.join('\n');
}

// ---------- las tarjetas de logro ----------
// Todas con la misma forma: { tipo, etiqueta (arriba, en dorado), nombre (en grande), cifra { v, u, t }, lineas [texto…],
// fecha (ISO), subtitulo }. Las pinta dibujarLogro (ui/Compartir.jsx).
const red1 = (n) => Math.round(Number(n) * 10) / 10;

// Un récord de la vitrina (Progreso): x = { nombre, e1rm: { valor, kg, reps, rpe, fecha }, repsSinCarga, ultimoRecord };
// h = historiaRecords (puntos [{ x: fecha, y: valor }] y veces). Lo que ha subido desde el récord anterior y desde la
// primera marca.
export function datosRecord(x = {}, h = null, hoy = hoyISO()) {
  const conKg = !!x.e1rm;
  const valor = conKg ? Number(x.e1rm.valor) : Number(x.repsSinCarga) || 0;
  const puntos = (h?.puntos || []).filter((p) => p.y != null);
  const anterior = [...puntos].reverse().find((p) => Number(p.y) < valor) || null;
  const primero = puntos.length && Number(puntos[0].y) < valor ? puntos[0] : null;
  const fecha = conKg ? x.e1rm.fecha || x.ultimoRecord || hoy : x.ultimoRecord || hoy;
  const lineas = [];
  if (conKg) lineas.push(`${pesoTxt(x.e1rm.kg, 2)} × ${x.e1rm.reps}${x.e1rm.rpe ? ` a RPE ${num(x.e1rm.rpe)}` : ''}`);
  if (anterior) {
    const dif = valor - Number(anterior.y);
    lineas.push(conKg ? `+${pesoNum(dif, 1)} ${etiquetaPeso()} desde el anterior (${fmtCorta(anterior.x)})` : `+${Math.round(dif)} desde el anterior (${fmtCorta(anterior.x)})`);
  }
  if (primero && primero !== anterior) {
    const pct = Math.round(((valor - Number(primero.y)) / Number(primero.y)) * 100);
    if (pct > 0) lineas.push(`+${pct} % desde tu primera marca (${fmtCorta(primero.x)})`);
  }
  return {
    tipo: 'record', etiqueta: 'Nuevo récord', nombre: x.nombre || 'Ejercicio', fecha,
    cifra: conKg ? { v: pesoNum(valor, 1), u: etiquetaPeso(), t: '1RM estimado' } : { v: String(valor), u: '', t: 'repeticiones' },
    lineas, subtitulo: null,
  };
}
// Un récord del resumen de la sesión: x = { nombre, s (la serie), r: { tipo, valor, antes, reps, kg, texto } }
export function datosRecordDeSesion(x = {}, fecha = hoyISO()) {
  const r = x.r || {};
  const cifra = r.tipo === 'e1rm' ? { v: pesoNum(r.valor, 1), u: etiquetaPeso(), t: '1RM estimado' }
    : r.tipo === 'kg' ? { v: pesoNum(r.kg, 2), u: etiquetaPeso(), t: `a ${r.reps} ${r.reps === 1 ? 'repetición' : 'repeticiones'}` }
    : { v: String(r.reps || 0), u: '', t: 'repeticiones' };
  const lineas = [];
  if (x.s) lineas.push(Number(x.s.kg) > 0 ? `${pesoTxt(x.s.kg, 2)} × ${x.s.reps ?? '—'}` : `${x.s.reps ?? '—'} repeticiones`);
  if (r.antes != null) {
    const dif = (r.tipo === 'e1rm' ? Number(r.valor) : r.tipo === 'kg' ? Number(r.kg) : Number(r.reps)) - Number(r.antes);
    lineas.push(r.tipo === 'reps' ? `+${Math.round(dif)} desde el anterior` : `+${pesoNum(dif, r.tipo === 'e1rm' ? 1 : 2)} ${etiquetaPeso()} desde el anterior`);
  }
  return { tipo: 'record', etiqueta: 'Nuevo récord', nombre: x.nombre || 'Ejercicio', fecha, cifra, lineas, subtitulo: null };
}
// La racha: n semanas seguidas con todo hecho; semanas: las últimas (para contar los entrenos de la racha, si vienen)
export function datosRacha(racha = 0, { sesiones = null, desde = null, hoy = hoyISO() } = {}) {
  const n = Number(racha) || 0;
  const lineas = [n >= 1 ? 'Todas las sesiones de cada semana, hechas' : 'La racha empieza con una semana completa'];
  if (sesiones) lineas.push(`${sesiones} ${sesiones === 1 ? 'sesión' : 'sesiones'} en la racha`);
  if (desde) lineas.push(`Desde el ${fmtCorta(desde)}`);
  return { tipo: 'racha', etiqueta: 'Racha', nombre: n >= 2 ? 'Sin fallar una semana' : textoRacha(n), fecha: hoy, cifra: { v: String(n), u: '', t: n === 1 ? 'semana seguida' : 'semanas seguidas' }, lineas, subtitulo: null, llama: true };
}
// La semana completa: resumen = { lunes, domingo, hechas, previstas, minutos, tonelaje, records, racha }
export function datosSemanaCompleta(r = {}, hoy = hoyISO()) {
  const lineas = [`${r.hechas || 0} de ${r.previstas || r.hechas || 0} sesiones`];
  if (r.minutos) lineas.push(`${r.minutos} min entrenando`);
  if (r.tonelaje > 0) lineas.push(`${num(Math.round(r.tonelaje / 100) / 10, 1)} t movidas`);
  if (r.records) lineas.push(`${r.records} ${r.records === 1 ? 'récord' : 'récords'}`);
  const nombre = r.lunes && r.domingo ? `Del ${fmtCorta(r.lunes)} al ${fmtCorta(r.domingo)}` : 'Esta semana';
  return { tipo: 'semana', etiqueta: 'Semana completa', nombre, fecha: r.domingo || hoy, cifra: { v: String(r.hechas || 0), u: '', t: (r.hechas || 0) === 1 ? 'sesión hecha' : 'sesiones hechas' },
    lineas: lineas.concat(r.racha > 1 ? [`🔥 ${textoRacha(r.racha)}`] : []), subtitulo: null };
}
// La semana del equipo (comunidad_resumen_semana): { sesiones, semana_completa, miembros, records, retos }
export function datosEquipoSemana(x = {}, hoy = hoyISO()) {
  const lineas = [];
  if (x.semana_completa) lineas.push(`${x.semana_completa} de ${x.miembros || '—'} con la semana completa`);
  if (x.records) lineas.push(`${x.records} ${x.records === 1 ? 'récord' : 'récords'}`);
  if (x.retos) lineas.push(`${x.retos} ${x.retos === 1 ? 'reto en marcha' : 'retos en marcha'}`);
  return { tipo: 'equipo', etiqueta: 'El equipo', nombre: 'Esta semana en FBE', fecha: hoy, cifra: { v: String(x.sesiones || 0), u: '', t: (x.sesiones || 0) === 1 ? 'sesión hecha' : 'sesiones hechas' }, lineas, subtitulo: null };
}
// Una publicación mía del muro, para sacarla fuera: un entreno (resumen de la base) o un logro
export function datosDePost(post = {}) {
  const r = post.resumen || {};
  const fecha = (post.creado_en || '').slice(0, 10) || hoyISO();
  if (post.tipo === 'entreno') {
    const ejercicios = r.ejercicios || [];
    const records = ejercicios.filter((e) => e.record).map((e) => ({ nombre: e.nombre, texto: r.con_kilos && e.e1rm ? `1RM estimado ${pesoTxt(e.e1rm, 1)}` : 'Récord' }));
    return {
      tipo: 'sesion', nombre: r.nombre || 'Sesión', fecha: r.fecha || fecha, minutos: r.minutos || null, series: r.series || 0,
      tonelaje: 0, records,
      mejores: ejercicios.map((e) => ({ nombre: e.nombre, serie: r.con_kilos && e.kg ? `${pesoTxt(e.kg, 2)} × ${e.reps ?? '—'}` : '', kg: e.kg ?? null, reps: e.reps ?? null, e1rm: e.e1rm ?? null })),
      sinTonelaje: true,
    };
  }
  if (post.tipo === 'aniversario') {
    const meses = Number(r.meses) || 1;
    return { tipo: 'logro', etiqueta: 'Aniversario', nombre: `${textoAniversario(meses)} en FBE`, fecha, cifra: { v: String(meses < 12 ? meses : Math.floor(meses / 12)), u: '', t: meses < 12 ? (meses === 1 ? 'mes entrenando' : 'meses entrenando') : meses < 24 ? 'año entrenando' : 'años entrenando' }, lineas: ['Entrenando con cabeza y con el equipo'], subtitulo: null };
  }
  // logro: un reto conseguido (comunidad_logro_reto): { titulo, hechas, objetivo, medida, modo, equipo, desde, hasta }
  const titulo = r.titulo || post.texto || 'Reto conseguido';
  const u = (n) => unidadReto(r.medida || 'sesiones', n);
  const equipo = r.modo === 'equipo', equipos = r.modo === 'equipos';
  const lineas = [equipo ? `${r.hechas} ${u(r.hechas)} entre todo el equipo (el objetivo era ${r.objetivo})`
    : equipos ? `${r.hechas} ${u(r.hechas)} su equipo (el objetivo era ${r.objetivo})` : `${r.hechas} de ${r.objetivo} ${u(r.objetivo)}`];
  if (r.desde && r.hasta) lineas.push(`Del ${fmtCorta(r.desde)} al ${fmtCorta(r.hasta)}`);
  return { tipo: 'logro', etiqueta: equipos ? `Reto por equipos conseguido${r.equipo ? ` · ${r.equipo}` : ''}` : equipo ? 'Reto de equipo conseguido' : 'Reto conseguido', nombre: titulo, fecha,
    cifra: r.hechas != null ? { v: String(r.hechas), u: '', t: u(r.hechas) } : null, lineas, subtitulo: null };
}
// Una sesión de cardio: las cifras de su tarjeta
export function cifrasCardio(c = {}) {
  if (!cardioHechoValido(c)) return [];
  const out = [{ k: 'minutos', v: String(c.minutos), u: 'min', t: 'Duración' }];
  if (c.km) out.push({ k: 'km', v: num(c.km, c.km % 1 ? 1 : 0), u: 'km', t: 'Distancia' });
  const r = ritmo(c.minutos, c.km, c.modalidad);
  if (r) { const m = r.match(/^([\d:.,]+)\s*(.*)$/); if (m) out.push({ k: 'ritmo', v: m[1], u: m[2], t: 'Ritmo' }); }
  return out;
}

// ---------- el nombre del archivo ----------
export const nombreArchivo = (d = {}, formato = 'publicacion') =>
  `fbe-${d.fecha || hoyISO()}-${String(d.nombre || d.tipo || 'tarjeta').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}${formato === 'historia' ? '-historia' : ''}.png`;

// ---------- el recordatorio de Hoy ----------
export const PREF_RECORDATORIO = 'fbe-compartir-recordatorio';
// Lo último que merece compartirse y aún no se compartió: un récord o un hito de racha de los 3 últimos días. estado:
// { sesionId, fecha, records: [nombre…], compartida } guardado en el móvil al terminar la sesión.
export function recordatorioCompartir(estado, hoy = hoyISO()) {
  if (!estado || estado.compartida || estado.quitado) return null;
  if (!estado.fecha || diasEntre(estado.fecha, hoy) > 3) return null;
  const records = estado.records || [];
  if (!records.length) return null;
  const cuando = estado.fecha === hoy ? 'de hoy' : diasEntre(estado.fecha, hoy) === 1 ? 'de ayer' : `del ${fmtCorta(estado.fecha)}`;
  return { sesionId: estado.sesionId, titulo: records.length === 1 ? `Tu récord ${cuando} en ${records[0]}` : `Tus ${records.length} récords ${cuando}`, texto: 'Merece una historia. ¿Lo compartes?' };
}

export { textoCardioHecho, PEGATINAS, red1 };
