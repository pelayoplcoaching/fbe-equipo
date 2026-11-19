// v0.67: «Revisión semanal» del coach. Lo puro: qué pide su atención y en qué orden salen.

// Lo que pide atención de un atleta esta semana: [{ tipo, nivel ('alerta' | 'aviso' | 'info' | 'ok'), texto }]
export function avisosRevision(f) {
  const out = [];
  if (f.molestia >= 2) out.push({ tipo: 'molestia', nivel: f.molestia >= 3 ? 'alerta' : 'aviso', texto: `Molestia ${f.molestia}/5` });
  if (f.mensajes > 0) out.push({ tipo: 'mensajes', nivel: 'aviso', texto: f.mensajes === 1 ? '1 mensaje sin leer' : `${f.mensajes} mensajes sin leer` });
  if (f.videos > 0) out.push({ tipo: 'videos', nivel: 'aviso', texto: f.videos === 1 ? '1 vídeo sin revisar' : `${f.videos} vídeos sin revisar` });
  if (f.servicio !== 'nutricion' || f.checkin) out.push(f.checkin ? { tipo: 'checkin', nivel: 'ok', texto: 'Check-in enviado' } : { tipo: 'checkin', nivel: 'info', texto: 'Sin check-in' });
  return out;
}

// Cuánto le falta de sus sesiones de la semana (0 = todas hechas; 1 = ninguna); sin sesiones pautadas, 0
const falta = (f) => { const t = f.sesiones?.total || 0; return t ? Math.max(0, 1 - (f.sesiones.completadas || 0) / t) : 0; };
// Cuántas cosas piden atención (sin contar el check-in enviado)
export const pendientesDe = (f) => avisosRevision(f).filter((a) => a.nivel !== 'ok').length;

// El orden: primero los que faltan por revisar; entre ellos, los que tienen algo urgente (molestia fuerte), luego los que
// tienen más cosas pendientes y los que han hecho menos de lo pautado; los ya revisados, al final. A igualdad, por nombre.
export function ordenRevision(filas) {
  const urgente = (f) => (f.molestia >= 3 ? 1 : 0);
  return [...(filas || [])].sort((a, b) => (Number(a.hecha) - Number(b.hecha))
    || (urgente(b) - urgente(a))
    || (pendientesDe(b) - pendientesDe(a))
    || (falta(b) - falta(a))
    || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
}

// ================================================================ v0.191: la revisión, más fácil de pasar
// (todo puro: lo usa la pantalla y lo prueban test/revision.test.mjs)

const lunesDeFecha = (iso) => {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const masDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nombreCorto = (n) => String(n || '').split(' ')[0];
const n1 = (v) => (Math.round(Number(v) * 10) / 10).toLocaleString('es-ES');

// Los avisos del panel que la revisión no enseñaba (sesión sin cerrar, días sin entrenar, sin peso…): los que ya salen
// como chip propio (molestia, check-in) no se repiten
const YA_SALEN = new Set(['molestia', 'sin_checkin', 'invitado']);
export function avisosPanel(f) {
  return (f?.alertas || []).filter((a) => a && a.texto && !YA_SALEN.has(a.tipo)).map((a) => ({ tipo: a.tipo, nivel: a.nivel || 'info', texto: a.texto }));
}

// Los pausados van aparte: ni cuentan en «N de M» ni salen como pendientes
export function partirPausados(filas) {
  const activos = [], pausados = [];
  for (const f of filas || []) (f.estado === 'pausado' ? pausados : activos).push(f);
  return { activos, pausados };
}

// Cuántas semanas lleva sin que lo des por revisado (0: esta ya está; 9: ninguna de las que se miran)
export function semanasSinRevisar(f, lunes) {
  if (f?.hecha) return 0;
  const hechas = (f?.historial || []).filter((h) => h.hecha && h.lunes < lunes).map((h) => h.lunes).sort();
  const ultima = hechas[hechas.length - 1];
  if (!ultima) return 9;
  return Math.max(1, Math.round((Date.parse(`${lunes}T12:00:00Z`) - Date.parse(`${ultima}T12:00:00Z`)) / (7 * 86400000)));
}

export const ORDENES = [['urgencia', 'Lo urgente primero'], ['nombre', 'Por nombre'], ['antiguedad', 'Más tiempo sin revisar'], ['mio', 'Mi orden']];
// El orden elegido. Los ya revisados, siempre al final. «mio»: los ids como los dejó el coach; los nuevos, detrás, por nombre
export function ordenarRevision(filas, modo = 'urgencia', { mio = [], lunes = null } = {}) {
  if (modo === 'urgencia' || !ORDENES.some(([k]) => k === modo)) return ordenRevision(filas);
  const porNombre = (a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
  const sitio = new Map((mio || []).map((id, i) => [id, i]));
  const cmp = modo === 'nombre' ? porNombre
    : modo === 'antiguedad' ? (a, b) => (semanasSinRevisar(b, lunes) - semanasSinRevisar(a, lunes)) || porNombre(a, b)
      : (a, b) => ((sitio.has(a.atleta_id) ? sitio.get(a.atleta_id) : 1e6) - (sitio.has(b.atleta_id) ? sitio.get(b.atleta_id) : 1e6)) || porNombre(a, b);
  return [...(filas || [])].sort((a, b) => (Number(!!a.hecha) - Number(!!b.hecha)) || cmp(a, b));
}
// Subir o bajar a uno en «Mi orden» (ids: como se ven ahora). Devuelve la lista nueva de ids
export function moverEnOrden(ids, id, delta) {
  const out = [...(ids || [])];
  const i = out.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export const FILTROS_REVISION = [['videos', 'Con vídeos'], ['mensajes', 'Con mensajes'], ['sin_checkin', 'Sin check-in'], ['molestias', 'Con molestias'], ['sin_programar', 'Sin programar']];
const CUMPLE = {
  videos: (f) => f.videos > 0,
  mensajes: (f) => f.mensajes > 0,
  sin_checkin: (f) => !f.checkin && f.servicio !== 'nutricion',
  molestias: (f) => f.molestia >= 2,
  sin_programar: (f) => f.proxima === 'sin' || f.proxima === 'borrador',
};
// Solo los que cumplen TODO lo marcado (sin nada marcado, todos)
export function filtrarRevision(filas, claves = []) {
  const ks = [...claves].filter((k) => CUMPLE[k]);
  return ks.length ? (filas || []).filter((f) => ks.every((k) => CUMPLE[k](f))) : [...(filas || [])];
}
export const cuentaFiltro = (filas, clave) => (CUMPLE[clave] ? (filas || []).filter(CUMPLE[clave]).length : 0);

// La semana que viene de su programa: 'publicada' | 'borrador' (existe, sin publicar) | 'sin' | null (su bloque no va por fechas)
export function estadoProxima(semanas, lunes) {
  const con = (semanas || []).filter((w) => w.fecha_inicio);
  if (!con.length) return null;
  const sig = masDias(lunes, 7);
  const prox = con.filter((w) => lunesDeFecha(w.fecha_inicio) >= sig);
  if (prox.some((w) => w.programacion === 'programada')) return 'publicada';
  return prox.length ? 'borrador' : 'sin';
}
export const TEXTO_PROXIMA = { publicada: 'Semana que viene publicada', borrador: 'Semana que viene en borrador', sin: 'Semana que viene sin programar' };

// ---------------------------------------------------------------- el check-in, en líneas (con el cambio frente al anterior)
const ESCALAS = [['energia', 'Energía'], ['recuperacion', 'Recuperación'], ['motivacion', 'Motivación'], ['satisfaccion_dieta', 'Satisfacción con la dieta']];
const ADH = ['adherencia_desayuno', 'adherencia_comida', 'adherencia_merienda', 'adherencia_cena'];
const media = (xs) => { const v = xs.map(Number).filter((x) => Number.isFinite(x) && x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
// [{ clave, etiqueta, valor, cambio: 'sube'|'baja'|null, antes }]; `notas`, aparte
const COMIDAS = [['adherencia_desayuno', 'Desayuno'], ['adherencia_comida', 'Comida'], ['adherencia_merienda', 'Merienda'], ['adherencia_cena', 'Cena']];
export function lineasCheckin(c, anterior = null, { porComida = false } = {}) {
  if (!c) return [];
  const out = [];
  const comparar = (a, b) => (a == null || b == null || a === b ? null : a > b ? 'sube' : 'baja');
  for (const [k, etq] of ESCALAS) if (c[k] != null) out.push({ clave: k, etiqueta: etq, valor: `${c[k]}/5`, cambio: comparar(Number(c[k]), anterior?.[k] == null ? null : Number(anterior[k])), antes: anterior?.[k] != null ? `${anterior[k]}/5` : null });
  if (c.horas_sueno) out.push({ clave: 'horas_sueno', etiqueta: 'Sueño', valor: `${c.horas_sueno} h`, cambio: null, antes: anterior?.horas_sueno && anterior.horas_sueno !== c.horas_sueno ? `${anterior.horas_sueno} h` : null });
  const adh = media(ADH.map((k) => c[k])), adhAntes = anterior ? media(ADH.map((k) => anterior[k])) : null;
  if (adh != null) out.push({ clave: 'adherencia', etiqueta: 'Adherencia a las comidas', valor: `${n1(adh)}/5`, cambio: comparar(Math.round(adh * 10), adhAntes == null ? null : Math.round(adhAntes * 10)), antes: adhAntes != null ? `${n1(adhAntes)}/5` : null });
  // (v0.192) quien es solo de nutrición: la adherencia, comida a comida
  if (porComida) for (const [k, etq] of COMIDAS) if (c[k] != null) out.push({ clave: k, etiqueta: `Adherencia: ${etq.toLowerCase()}`, valor: `${c[k]}/5`, cambio: comparar(Number(c[k]), anterior?.[k] == null ? null : Number(anterior[k])), antes: anterior?.[k] != null ? `${anterior[k]}/5` : null });
  if (c.saciedad != null) out.push({ clave: 'saciedad', etiqueta: 'Saciedad', valor: `${c.saciedad}/4`, cambio: comparar(Number(c.saciedad), anterior?.saciedad == null ? null : Number(anterior.saciedad)), antes: anterior?.saciedad != null ? `${anterior.saciedad}/4` : null });
  if (c.pasos_media != null) out.push({ clave: 'pasos_media', etiqueta: 'Pasos al día', valor: Number(c.pasos_media).toLocaleString('es-ES'), cambio: comparar(Number(c.pasos_media), anterior?.pasos_media == null ? null : Number(anterior.pasos_media)), antes: anterior?.pasos_media != null ? Number(anterior.pasos_media).toLocaleString('es-ES') : null });
  if (c.calorias_media != null) out.push({ clave: 'calorias_media', etiqueta: 'Calorías al día', valor: `${Number(c.calorias_media).toLocaleString('es-ES')} kcal`, cambio: null, antes: anterior?.calorias_media != null && anterior.calorias_media !== c.calorias_media ? `${Number(anterior.calorias_media).toLocaleString('es-ES')} kcal` : null });
  if (c.fc_reposo != null) out.push({ clave: 'fc_reposo', etiqueta: 'Pulso en reposo', valor: `${c.fc_reposo} ppm`, cambio: null, antes: anterior?.fc_reposo != null && anterior.fc_reposo !== c.fc_reposo ? `${anterior.fc_reposo} ppm` : null });
  if (c.hrv != null) out.push({ clave: 'hrv', etiqueta: 'VFC', valor: `${n1(c.hrv)} ms`, cambio: null, antes: anterior?.hrv != null && Number(anterior.hrv) !== Number(c.hrv) ? `${n1(anterior.hrv)} ms` : null });
  return out;
}

// ---------------------------------------------------------------- récords y parones de la semana
const e1rmDe = (s) => {
  const k = Number(s.kg), r = Number(s.reps);
  if (!k || !r || r < 1 || r > 12) return null;
  const reserva = s.rir != null && s.rir !== '' ? Number(s.rir) : s.rpe != null && s.rpe !== '' ? Math.max(0, 10 - Number(s.rpe)) : 0;
  const total = r + (Number.isFinite(reserva) ? reserva : 0);
  return total <= 1 ? k : k * (1 + total / 30);
};
// De cada ejercicio hecho esta semana: 'record' (su mejor 1RM estimado de siempre), 'parado' (dos semanas seguidas sin
// mejorar) o 'baja' (dos semanas seguidas bajando). Los demás no salen. series: las del historial (con fecha y ejercicio)
export function progresoSemana(series, lunes) {
  const fin = masDias(lunes, 6);
  const porEj = new Map();
  for (const s of series || []) {
    const v = e1rmDe(s);
    if (v == null || !s.ejercicio_id || !s.fecha || s.fecha > fin) continue;
    const w = lunesDeFecha(s.fecha);
    if (!porEj.has(s.ejercicio_id)) porEj.set(s.ejercicio_id, { nombre: s.ejercicio || 'Ejercicio', semanas: new Map(), mejor: null });
    const e = porEj.get(s.ejercicio_id);
    if (!e.semanas.has(w) || e.semanas.get(w).v < v) e.semanas.set(w, { v, kg: Number(s.kg), reps: Number(s.reps) });
  }
  const records = [], parados = [];
  for (const [id, e] of porEj) {
    const esta = e.semanas.get(lunes);
    if (!esta) continue;
    const antes = [...e.semanas.entries()].filter(([w]) => w < lunes).sort(([a], [b]) => (a < b ? 1 : -1));
    if (!antes.length) continue;
    const mejorAntes = Math.max(...antes.map(([, x]) => x.v));
    const marca = `${n1(esta.kg)} kg x ${esta.reps}`;
    if (esta.v > mejorAntes * 1.001) { records.push({ ejercicio_id: id, ejercicio: e.nombre, marca, sube: Math.round((esta.v - mejorAntes) * 10) / 10 }); continue; }
    if (antes.length < 2) continue;
    const [a1, a2] = [antes[0][1].v, antes[1][1].v];
    if (esta.v < a1 * 0.999 && a1 < a2 * 0.999) parados.push({ ejercicio_id: id, ejercicio: e.nombre, marca, estado: 'baja' });
    else if (esta.v <= a1 * 1.001 && a1 <= a2 * 1.001) parados.push({ ejercicio_id: id, ejercicio: e.nombre, marca, estado: 'parado' });
  }
  const porNombre = (a, b) => a.ejercicio.localeCompare(b.ejercicio, 'es');
  return { records: records.sort((a, b) => b.sube - a.sube || porNombre(a, b)), parados: parados.sort((a, b) => (a.estado === b.estado ? porNombre(a, b) : a.estado === 'baja' ? -1 : 1)) };
}

// Lo que escribió esta semana: la nota de cada sesión y las de sus series, en orden. [{ fecha, donde, texto }]
export function comentariosSemana(sesiones, series, lunes) {
  const fin = masDias(lunes, 6);
  const out = [];
  for (const x of sesiones || []) if (x.completada && String(x.nota_atleta || '').trim()) out.push({ fecha: x.fecha || '', donde: x.nombre || 'Sesión', texto: String(x.nota_atleta).trim() });
  for (const s of series || []) {
    const t = String(s.nota || '').trim();
    if (!t || !s.fecha || s.fecha < lunes || s.fecha > fin) continue;
    out.push({ fecha: s.fecha, donde: `${s.ejercicio || 'Ejercicio'}, serie ${s.numero ?? '?'}`, texto: t });
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

// Una sesión hecha, ejercicio a ejercicio: lo pautado frente a lo hecho (de api.sesion). [{ nombre, pautado, hecho, falta }]
export function pautadoFrenteAHecho(ejercicios) {
  return (ejercicios || []).map((p) => {
    const hechas = (p.hechas || []).filter((s) => Number(s.reps) > 0);
    const rango = p.reps_min && p.reps_max ? (p.reps_min === p.reps_max ? `${p.reps_min}` : `${p.reps_min}-${p.reps_max}`) : p.reps_min || p.reps_max || null;
    const pautado = [p.series ? `${p.series} x ${rango || '?'}` : null, p.rpe_objetivo != null ? `RPE ${n1(p.rpe_objetivo)}` : p.rir_objetivo != null ? `RIR ${n1(p.rir_objetivo)}` : null].filter(Boolean).join(' · ');
    const hecho = hechas.map((s) => `${s.kg != null && Number(s.kg) > 0 ? `${n1(s.kg)} x ` : ''}${s.reps}${s.rpe != null ? ` (${n1(s.rpe)})` : ''}`).join(', ');
    return { id: p.id, nombre: p.ejercicio?.nombre || 'Ejercicio', pautado: pautado || 'Sin pauta', hecho: hecho || 'Sin hacer', falta: Math.max(0, (Number(p.series) || 0) - hechas.length) };
  });
}

// ---------------------------------------------------------------- pedir lo que falta, en lote
export const LOTES = {
  checkin: { titulo: 'Pedir el check-in', quien: (f) => !f.checkin && f.servicio !== 'nutricion' && f.estado !== 'pausado', texto: (n) => `Hola, ${n}. Me falta tu check-in de la semana: son dos minutos (en Check-in) y me ayuda a ajustarte el plan. ¿Me lo mandas hoy?` },
  sesiones: { titulo: 'Preguntar por las sesiones', quien: (f) => f.servicio !== 'nutricion' && f.estado !== 'pausado' && (f.sesiones?.total || 0) > 0 && !(f.sesiones?.completadas > 0), texto: (n) => `Hola, ${n}. Veo que esta semana aún no has podido entrenar. ¿Todo bien? Si hace falta ajustamos: dime qué días puedes y lo cuadramos.` },
};
export function destinatariosLote(filas, tipo) {
  const l = LOTES[tipo];
  return l ? (filas || []).filter(l.quien).map((f) => ({ atleta_id: f.atleta_id, nombre: f.nombre, texto: l.texto(nombreCorto(f.nombre) || 'qué tal') })) : [];
}
// El mensaje con el nombre de cada uno: en la plantilla, «{nombre}»
export const conNombre = (plantilla, nombre) => String(plantilla || '').replaceAll('{nombre}', nombreCorto(nombre) || '').replace(/ ,/g, ',').trim();

// ---------------------------------------------------------------- tus frases frecuentes (en el móvil del coach)
export function conFrase(lista, frase, max = 20) {
  const t = String(frase || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!t) return [...(lista || [])];
  return [t, ...(lista || []).filter((x) => x !== t)].slice(0, max);
}
export const sinFrase = (lista, frase) => (lista || []).filter((x) => x !== frase);
// Mete la frase donde está el cursor (con su salto de línea si hace falta). → { texto, cursor }
export function insertarFrase(texto, frase, pos = null) {
  const t = String(texto || ''), i = pos == null || pos < 0 || pos > t.length ? t.length : pos;
  const antes = t.slice(0, i), despues = t.slice(i);
  const sep1 = antes && !/\n$/.test(antes) ? '\n' : '', sep2 = despues && !/^\n/.test(despues) ? '\n' : '';
  const nuevo = `${antes}${sep1}${frase}${sep2}${despues}`;
  return { texto: nuevo, cursor: (antes + sep1 + frase).length };
}

// ---------------------------------------------------------------- lo que el mensaje redactado puede nombrar
export function extraParaBorrador(detalle) {
  if (!detalle) return null;
  const pendientes = (detalle.sesiones || []).filter((x) => !x.completada).map((x) => x.nombre).filter(Boolean);
  return {
    records: (detalle.progreso?.records || []).slice(0, 3).map((r) => ({ ejercicio: r.ejercicio, marca: r.marca })),
    parados: (detalle.progreso?.parados || []).slice(0, 2).map((r) => r.ejercicio),
    pendientes,
    checkin: detalle.checkin && detalle.checkinDeEstaSemana ? { energia: detalle.checkin.energia ?? null, motivacion: detalle.checkin.motivacion ?? null, recuperacion: detalle.checkin.recuperacion ?? null, horas_sueno: detalle.checkin.horas_sueno || null, notas: String(detalle.checkin.notas || '').trim() } : null,
  };
}

// El siguiente al que pasar en «uno a uno»: el primero sin revisar después del actual (dando la vuelta); null si no queda
export function siguientePendiente(ids, hechas, actual) {
  const i = ids.indexOf(actual);
  for (let k = 1; k <= ids.length; k += 1) { const id = ids[(i + k) % ids.length]; if (id !== actual && !hechas.has(id)) return id; }
  return null;
}

// ================================================================ v0.192: segunda tanda
// ---------------------------------------------------------------- «a medias» (082)
export const ESTADOS_REVISION = [['esperando', 'Esperando su respuesta'], ['programar', 'Falta programarle']];
export const TEXTO_ESTADO = Object.fromEntries(ESTADOS_REVISION);
CUMPLE.a_medias = (f) => !!f.estadoRevision && !f.hecha;
FILTROS_REVISION.push(['a_medias', 'A medias']);

// ---------------------------------------------------------------- tus pasos con cada atleta (se tachan solos)
// [{ clave, texto, hecho }]: solo los que le tocan a ese atleta
export function pasosRevision(f) {
  const out = [];
  if (f.servicio !== 'nutricion') out.push({ clave: 'videos', texto: 'Vídeos vistos', hecho: !(f.videos > 0) });
  out.push({ clave: 'mensajes', texto: 'Mensajes leídos', hecho: !(f.mensajes > 0) });
  out.push({ clave: 'repaso', texto: 'Le has escrito', hecho: (f.escritos || 0) > 0 });
  if (f.proxima) out.push({ clave: 'programar', texto: 'Semana que viene publicada', hecho: f.proxima === 'publicada' });
  return out;
}

// ---------------------------------------------------------------- esta semana frente a la anterior
const cifrasDe = (series) => {
  const v = (series || []).filter((s) => Number(s.reps) > 0);
  const rpes = v.map((s) => Number(s.rpe)).filter((x) => Number.isFinite(x) && x > 0);
  return { series: v.length, toneladas: Math.round(v.reduce((t, s) => t + (Number(s.kg) || 0) * Number(s.reps), 0) / 100) / 10, rpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null };
};
// [{ clave, etiqueta, valor, antes, cambio }] (sin series en ninguna de las dos, nada)
export function compararSemanas(series, lunes) {
  const fin = masDias(lunes, 6), antes0 = masDias(lunes, -7), antes1 = masDias(lunes, -1);
  const a = cifrasDe((series || []).filter((s) => s.fecha >= lunes && s.fecha <= fin));
  const b = cifrasDe((series || []).filter((s) => s.fecha >= antes0 && s.fecha <= antes1));
  if (!a.series && !b.series) return [];
  const cmp = (x, y) => (x == null || y == null || !y || x === y ? null : x > y ? 'sube' : 'baja');
  return [
    { clave: 'series', etiqueta: 'Series', valor: `${a.series}`, antes: `${b.series}`, cambio: cmp(a.series, b.series) },
    { clave: 'toneladas', etiqueta: 'Toneladas', valor: n1(a.toneladas), antes: n1(b.toneladas), cambio: cmp(a.toneladas, b.toneladas) },
    { clave: 'rpe', etiqueta: 'Esfuerzo medio', valor: a.rpe == null ? '-' : n1(a.rpe), antes: b.rpe == null ? '-' : n1(b.rpe), cambio: cmp(a.rpe, b.rpe) },
  ];
}

// ---------------------------------------------------------------- dónde se quedó corto
// series: las del historial (con sesion_ejercicio_id); pautas: [{ id, reps_min, series }] de las sesiones de la semana.
// [{ ejercicio, cortas, tope, faltan }] solo de los que tienen algo
export function quedoCorto(series, pautas, lunes) {
  const fin = masDias(lunes, 6);
  const P = new Map((pautas || []).map((p) => [p.id, p]));
  const porPauta = new Map();
  for (const s of series || []) {
    if (!s.fecha || s.fecha < lunes || s.fecha > fin || !(Number(s.reps) > 0) || !P.has(s.sesion_ejercicio_id)) continue;
    if (!porPauta.has(s.sesion_ejercicio_id)) porPauta.set(s.sesion_ejercicio_id, []);
    porPauta.get(s.sesion_ejercicio_id).push(s);
  }
  const out = [];
  for (const [id, ss] of porPauta) {
    const p = P.get(id);
    const cortas = p.reps_min ? ss.filter((s) => Number(s.reps) < Number(p.reps_min)).length : 0;
    const tope = ss.filter((s) => Number(s.rpe) >= 10).length;
    const faltan = Math.max(0, (Number(p.series) || 0) - ss.length);
    if (cortas || tope || faltan) out.push({ id, ejercicio: ss[0].ejercicio || 'Ejercicio', ejercicio_id: ss[0].ejercicio_id || null, cortas, tope, faltan });
  }
  return out.sort((a, b) => (b.cortas + b.tope + b.faltan) - (a.cortas + a.tope + a.faltan) || a.ejercicio.localeCompare(b.ejercicio, 'es'));
}
export function textoCorto(x) {
  return [x.cortas ? `${x.cortas} por debajo del rango` : '', x.tope ? `${x.tope} a RPE 10` : '', x.faltan ? (x.faltan === 1 ? 'falta 1 serie' : `faltan ${x.faltan} series`) : ''].filter(Boolean).join(', ');
}

// ---------------------------------------------------------------- en qué punto del bloque está
export function puntoDelBloque(f) {
  const b = f?.bloque, w = f?.semana;
  if (!b) return '';
  return [b.numero != null ? `Bloque ${b.numero}` : b.nombre || 'Bloque', w?.numero != null ? `semana ${w.numero}${w.total ? ` de ${w.total}` : ''}` : '', w?.foco || b.foco ? `foco: ${w?.foco || b.foco}` : ''].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------- carrera: lo corrido frente a lo previsto
export function carreraDeLaSemana(sesiones, plan) {
  const hechas = (sesiones || []).filter((x) => x.completada && x.cardio_hecho && x.cardio_hecho.modalidad === 'carrera');
  const km = Math.round(hechas.reduce((t, x) => t + (Number(x.cardio_hecho.km) || 0), 0) * 10) / 10;
  if (!plan && !hechas.length) return null;
  const min = plan?.km_min != null ? Number(plan.km_min) : null, max = plan?.km_max != null ? Number(plan.km_max) : null;
  const previsto = min != null && max != null ? (min === max ? `${n1(max)} km` : `${n1(min)}-${n1(max)} km`) : max != null ? `${n1(max)} km` : min != null ? `${n1(min)} km` : null;
  const semaforos = hechas.map((x) => x.cardio_hecho.semaforo).filter(Boolean);
  const peor = semaforos.includes('rojo') ? 'rojo' : semaforos.includes('ambar') ? 'ambar' : semaforos.length ? 'verde' : null;
  return { km, salidas: hechas.length, previsto, etiqueta: plan?.etiqueta || null, clave: plan?.clave || null, semaforo: peor, estado: max != null && km > max * 1.1 ? 'de_mas' : min != null && km < min * 0.8 ? 'de_menos' : 'bien' };
}

// ---------------------------------------------------------------- el tono del mensaje
export const TONOS = [['auto', 'Automático'], ['redonda', 'Semana redonda'], ['floja', 'Semana floja'], ['sin', 'Sin entrenar']];
export function tonoDe(f) {
  const { completadas = 0, total = 0 } = f?.sesiones || {};
  if (f?.servicio === 'nutricion') return 'redonda';
  if (total > 0 && completadas === 0) return 'sin';
  if (total > 0 && completadas >= total) return 'redonda';
  return total > 0 && completadas / total < 0.67 ? 'floja' : 'redonda';
}
const ABRE = { redonda: (n) => `Hola, ${n}. Semana redonda, te la repaso:`, floja: (n) => `Hola, ${n}. Semana más floja de lo normal; sin drama, la repaso:`, sin: (n) => `Hola, ${n}. Esta semana no ha salido el entreno.` };
const CIERRA = { redonda: 'Así da gusto. A por la siguiente. 💪', floja: 'Para esta semana, un objetivo corto: cumplir las sesiones. Si algo no encaja, dímelo y lo ajusto.', sin: 'Cuéntame qué ha pasado y te lo adapto: mejor poco que nada.' };
// Cambia la primera y la última línea del redactado (las de en medio, sus datos, se quedan); 'auto': tal cual
export function conTono(texto, tono, nombre) {
  if (!ABRE[tono]) return String(texto || '');
  const lineas = String(texto || '').split('\n');
  if (lineas.length < 2) return String(texto || '');
  const medio = lineas.slice(1, -1).filter((l) => !(tono === 'sin' && /no hemos podido entrenar/.test(l)));
  return [ABRE[tono](nombreCorto(nombre) || 'qué tal'), ...medio, CIERRA[tono]].join('\n');
}

// ---------------------------------------------------------------- programar el envío: el lunes que viene a las 8 (hora del aparato)
// → 'AAAA-MM-DDTHH:MM' para un campo datetime-local. ahora: Date
export function proximoLunesALas(ahora = new Date(), hora = 8) {
  const d = new Date(ahora.getTime());
  const dias = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + dias); d.setHours(hora, 0, 0, 0);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------------------------------------------------------------- el resumen al terminar
export function resumenRevision(filas) {
  const xs = filas || [];
  const nombres = (ys) => ys.map((f) => nombreCorto(f.nombre)).sort((a, b) => a.localeCompare(b, 'es'));
  return {
    total: xs.length, revisados: xs.filter((f) => f.hecha).length,
    conRepaso: xs.filter((f) => (f.escritos || 0) > 0).length,
    porProgramar: nombres(xs.filter((f) => f.proxima === 'sin' || f.proxima === 'borrador')),
    esperando: nombres(xs.filter((f) => f.estadoRevision === 'esperando' && !f.hecha)),
    sinCheckin: nombres(xs.filter((f) => !f.checkin && f.servicio !== 'nutricion')),
  };
}

// ---------------------------------------------------------------- la vista de tabla (ordenador)
export const COLUMNAS_TABLA = [['nombre', 'Atleta'], ['sesiones', 'Sesiones'], ['checkin', 'Check-in'], ['videos', 'Vídeos'], ['mensajes', 'Mensajes'], ['molestia', 'Molestia'], ['proxima', 'Semana que viene']];
const VALOR = {
  nombre: (f) => String(f.nombre || ''),
  sesiones: (f) => (f.sesiones?.total ? (f.sesiones.completadas || 0) / f.sesiones.total : -1),
  checkin: (f) => (f.checkin ? 1 : 0),
  videos: (f) => f.videos || 0, mensajes: (f) => f.mensajes || 0, molestia: (f) => f.molestia || 0,
  proxima: (f) => ({ sin: 0, borrador: 1, publicada: 2 }[f.proxima] ?? 3),
};
export function ordenarTabla(filas, col = 'nombre', dir = 1) {
  const v = VALOR[col] || VALOR.nombre;
  return [...(filas || [])].sort((a, b) => {
    const x = v(a), y = v(b);
    const c = typeof x === 'string' ? x.localeCompare(y, 'es') : x - y;
    return (c * dir) || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
  });
}

// ---------------------------------------------------------------- los ajustes, entre aparatos (082)
// Lo de la base manda si existe; si aún no hay nada allí, se sube lo de este aparato. → { frases, orden, modo, vista }
export function ajustesDeRevision(remoto, local) {
  const l = local || {};
  if (!remoto) return { frases: [...(l.frases || [])], orden: [...(l.orden || [])], modo: l.modo || 'urgencia', vista: l.vista || 'lista' };
  return { frases: Array.isArray(remoto.frases) ? remoto.frases : [], orden: Array.isArray(remoto.orden) ? remoto.orden : [], modo: remoto.modo || l.modo || 'urgencia', vista: remoto.vista || l.vista || 'lista' };
}
// Lo que cabe en la base: frases limpias (20 de 300) y solo identificadores con forma de identificador (500)
export function ajustesParaGuardar(a) {
  return {
    frases: [...new Set((a?.frases || []).map((x) => String(x || '').replace(/\s+/g, ' ').trim().slice(0, 300)).filter(Boolean))].slice(0, 20),
    orden: (a?.orden || []).filter((x) => /^[0-9a-fA-F-]{36}$/.test(String(x))).slice(0, 500),
    modo: ORDENES.some(([k]) => k === a?.modo) ? a.modo : null,
    vista: ['lista', 'tabla'].includes(a?.vista) ? a.vista : null,
  };
}

// ================================================================ v0.193: tercera tanda
// Un dato de su semana, en una frase para citarlo en el chat
export const citaDe = {
  record: (r) => `Récord en ${r.ejercicio} (${r.marca}).`,
  parado: (r) => `${r.ejercicio}: ${r.estado === 'baja' ? 'lleva dos semanas bajando' : 'lleva dos semanas sin moverse'} (${r.marca}).`,
  corto: (c) => `${c.ejercicio}: ${textoCorto(c)}.`,
  sesion: (x) => (x.completada ? `${x.nombre}${x.rpe_sesion != null ? `, esfuerzo ${n1(x.rpe_sesion)}` : ''}${x.duracion_min != null ? `, ${x.duracion_min} min` : ''}:` : `${x.nombre}, que se quedó sin hacer:`),
  checkin: (lineas) => `Del check-in: ${(lineas || []).filter((l) => l.cambio === 'baja').map((l) => `${l.etiqueta.toLowerCase()} ${l.valor}`).join(', ') || (lineas || []).slice(0, 3).map((l) => `${l.etiqueta.toLowerCase()} ${l.valor}`).join(', ')}.`,
};
export const PESTANAS_UNO = [['semana', 'Su semana'], ['chat', 'Chat'], ['videos', 'Vídeos'], ['programar', 'Programar']];
// Las pestañas que le tocan: sin vídeos por revisar no hay «Vídeos»; quien solo lleva nutrición no tiene «Programar»
export function pestanasDe(f) {
  return PESTANAS_UNO.filter(([k]) => (k !== 'videos' || f.videos > 0) && (k !== 'programar' || f.servicio !== 'nutricion'));
}
