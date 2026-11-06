// «Programar según FBE» (fase 1b): las propuestas guardadas. Cada vez que el coach aplica una propuesta, queda apuntado
// en la semana que programa qué propuso el motor en cada ejercicio y qué hizo él con ello; después, comparándolo con
// cómo queda la semana, se mide el acuerdo real sin tener que adjuntar copias. Lógica pura.
//
// Decisión de Pelayo (5/11/2026): se guarda en la propia semana (`semanas.propuesta_motor`, jsonb). El atleta nunca lo
// ve en la app, pero la fila de su semana sí llega a su dispositivo: por eso aquí NO van motivos, ni señales de
// descarga, ni nada del check-in o de las molestias. Solo qué se propuso y qué se aplicó, en corto:
//   { v: 1, en: '2026-11-05T21:00:00.000Z', base: '<id de la semana hecha>', tipo: 'normal', pk: 2,
//     filas: [{ e: '<ejercicio>', p: '<pauta de destino>', t: 'subir', m: 'por_serie', c: 'alta', f: 'peaking', r: 1,
//               d: 'aplicada' | 'alternativa' | 'no' | 'igual' | 'fuera', pr: <lo propuesto>, a: 'mantener', ap: <lo aplicado> }] }
//   Una pauta en corto: { d: [[reps, kg], …] } si va serie a serie; si no, { s: series, r: [mín, máx], k: kg, b: % back-off }
import { tieneDetalle } from '../calculos.js';
import { tieneRegla } from './guardadas.js';

export const VERSION_REGISTRO = 1;
export const MAX_FILAS_REGISTRO = 80;
export const DECISIONES = ['aplicada', 'alternativa', 'no', 'igual', 'fuera'];
const TIPOS = ['subir', 'reps', 'series', 'mantener', 'bajar', 'tope', 'peaking', 'sin_tocar', 'descarga', 'vuelta', 'mantenimiento'];
const CONFIANZAS = ['alta', 'media', 'baja'];
const SEMANAS = ['normal', 'descarga', 'vuelta', 'repetir', 'mantenimiento'];

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const n = (x) => (x == null || x === '' || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100) / 100);
const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

// Una pauta (o una propuesta) en corto: solo series, repeticiones y kilos, que es lo que se compara
export function pautaCompacta(p) {
  if (!p) return null;
  if (tieneDetalle(p)) return { d: p.series_detalle.map((x) => [n(x.reps), n(x.kg)]) };
  return { s: n(p.series), r: [n(p.reps_min), n(p.reps_max)], k: n(p.carga_sugerida_kg), ...(n(p.backoff_pct) ? { b: n(p.backoff_pct) } : {}) };
}
// El registro de una aplicación.
//   vistas: las filas de la hoja [{ f: fila del motor, actual: pauta de destino o null, propuesta: la elegida, alternativa }]
//   marcadas: Set de pauta_id (de la base) que se aplican · base: la semana hecha · semana: r.semana del motor
//   guardadas: las reglas del atleta (para apuntar qué filas llevaban regla propia) · ahora: Date o ISO
export function registroDePropuesta({ vistas = [], marcadas = new Set(), base = null, semana = {}, descarga = false, guardadas = null, ahora = new Date() } = {}) {
  const filas = vistas.slice(0, MAX_FILAS_REGISTRO).map(({ f, actual, propuesta, alternativa }) => {
    // ¿Proponía algo? Solo cuentan series, repeticiones y kilos: pasar una pauta de RIR a RPE no es una propuesta
    const proponia = !!actual && !igual(pautaCompacta(actual), pautaCompacta(f.propuesta));
    const marcada = marcadas.has(f.pauta_id);
    const d = !actual ? 'fuera' : alternativa ? (marcada || alternativa.id === 'mantener' ? 'alternativa' : 'no') : !proponia ? 'igual' : marcada ? 'aplicada' : 'no';
    return { e: f.ejercicio_id, p: actual?.id ?? null, t: f.tipo, m: f.modelo, c: f.confianza, ...(f.fase === 'peaking' ? { f: 'peaking' } : {}), ...(tieneRegla(guardadas, f.ejercicio_id) ? { r: 1 } : {}),
      d, pr: pautaCompacta(f.propuesta), ...(d === 'alternativa' ? { a: alternativa.id, ap: pautaCompacta(propuesta) } : {}) };
  });
  return { v: VERSION_REGISTRO, en: new Date(ahora).toISOString(), base: base?.id ?? null, tipo: descarga ? 'descarga' : semana.tipo || 'normal', ...(semana.peaking ? { pk: semana.peaking } : {}), filas };
}

// Si ya había una propuesta aplicada desde la misma semana, la nueva no borra lo que se decidió entonces: una fila que
// ahora sale «igual» porque ya se aplicó conserva su decisión de la primera vez.
export function fusionarRegistro(previo, nuevo) {
  if (!previo || !nuevo || previo.base !== nuevo.base) return nuevo;
  const clave = (x) => x.p || `e:${x.e}`;
  const antes = Object.fromEntries(previo.filas.map((x) => [clave(x), x]));
  return { ...nuevo, filas: nuevo.filas.map((x) => { const a = antes[clave(x)]; return x.d === 'igual' && a && ['aplicada', 'alternativa'].includes(a.d) ? a : x; }) };
}

const compactaVale = (c) => esObjeto(c) && (Array.isArray(c.d)
  ? c.d.length <= 20 && c.d.every((x) => Array.isArray(x) && x.length === 2 && x.every((y) => y === null || typeof y === 'number'))
  : (c.s === null || typeof c.s === 'number') && Array.isArray(c.r) && c.r.length === 2);

// Lo guardado en la semana, comprobado. Con algo que no se entienda devuelve null (nunca falla).
export function leerRegistro(valor) {
  if (!esObjeto(valor) || valor.v !== VERSION_REGISTRO || !Array.isArray(valor.filas) || typeof valor.en !== 'string' || Number.isNaN(Date.parse(valor.en))) return null;
  const filas = valor.filas.slice(0, MAX_FILAS_REGISTRO).filter((x) => esObjeto(x) && typeof x.e === 'string' && DECISIONES.includes(x.d) && TIPOS.includes(x.t) && CONFIANZAS.includes(x.c) && compactaVale(x.pr)
    && (x.p === null || typeof x.p === 'string') && (x.ap === undefined || compactaVale(x.ap)));
  return { v: VERSION_REGISTRO, en: valor.en, base: typeof valor.base === 'string' ? valor.base : null, tipo: SEMANAS.includes(valor.tipo) ? valor.tipo : 'normal', ...(Number(valor.pk) > 0 ? { pk: Number(valor.pk) } : {}), filas };
}

const vacio = () => ({ propuestas: 0, aplicadas: 0, alternativas: 0, noAplicadas: 0, retocadas: 0, borradas: 0, comoElMotor: 0 });
const cuenta = (t, fila, final) => {
  t.propuestas++;
  if (fila.d === 'aplicada') t.aplicadas++; else if (fila.d === 'alternativa') t.alternativas++; else t.noAplicadas++;
  if (final === undefined) { t.borradas++; return; }
  const ahora = pautaCompacta(final);
  if (igual(ahora, fila.pr)) t.comoElMotor++;
  if (fila.d !== 'no' && !igual(ahora, fila.ap ?? fila.pr)) t.retocadas++;
};
const conPct = (t) => ({ ...t, comoElMotorPct: t.propuestas ? Math.round((1000 * t.comoElMotor) / t.propuestas) / 10 : null });

// El acuerdo de una semana: lo guardado frente a cómo está ahora la semana.
//   pautasPorId: { id: pauta } de la semana de destino (si un id falta, el ejercicio se borró)
// Solo cuentan las filas en las que el motor proponía cambiar algo (las «igual» y las «fuera» no).
//   { propuestas, aplicadas, alternativas, noAplicadas, retocadas (aplicadas y luego cambiadas a mano), borradas,
//     comoElMotor (hoy está exactamente como propuso el motor), comoElMotorPct }
export function acuerdoDeRegistro(registro, pautasPorId = {}) {
  const t = vacio();
  for (const fila of registro?.filas || []) { if (fila.d === 'igual' || fila.d === 'fuera') continue; cuenta(t, fila, fila.p ? pautasPorId[fila.p] : undefined); }
  return conPct(t);
}

// En una frase, para la hoja: «Aplicaste 12 de 18 propuestas (2 con otra opción). Después has cambiado 1 a mano.»
export function textoAcuerdo(a) {
  if (!a || !a.propuestas) return 'No había nada que cambiar.';
  const hechas = a.aplicadas + a.alternativas;
  const partes = [`Aplicaste ${hechas} de ${a.propuestas} ${a.propuestas === 1 ? 'propuesta' : 'propuestas'}${a.alternativas ? ` (${a.alternativas} con otra opción)` : ''}.`];
  if (a.retocadas) partes.push(`Después has cambiado ${a.retocadas} a mano.`);
  if (a.borradas) partes.push(`${a.borradas === 1 ? 'Un ejercicio ya no está' : `${a.borradas} ejercicios ya no están`} en la semana.`);
  return partes.join(' ');
}

// El acuerdo real de toda una copia completa: todas las semanas que llevan una propuesta guardada.
// Solo cifras e ids: { semanas, atletas, total, cortes: { tipo, confianza, modelo, regla }, porAtleta: [{ id, semanas, … }] }
export function acuerdoDeCopia(copia) {
  const pautas = {};
  for (const p of copia?.sesion_ejercicios || []) pautas[p.id] = p;
  const atletaDeBloque = Object.fromEntries((copia?.bloques || []).map((b) => [b.id, b.atleta_id]));
  const total = vacio(), cortes = { tipo: {}, confianza: {}, modelo: {}, regla: {} }, porAtleta = {};
  let semanas = 0;
  for (const w of copia?.semanas || []) {
    const reg = leerRegistro(w.propuesta_motor);
    if (!reg) continue;
    semanas++;
    const at = atletaDeBloque[w.bloque_id] || 'sin atleta';
    const suyo = (porAtleta[at] ||= { id: at, semanas: 0, ...vacio() });
    suyo.semanas++;
    for (const fila of reg.filas) {
      if (fila.d === 'igual' || fila.d === 'fuera') continue;
      const final = fila.p ? pautas[fila.p] : undefined;
      cuenta(total, fila, final); cuenta(suyo, fila, final);
      for (const [corte, clave] of [['tipo', fila.t], ['confianza', fila.c], ['modelo', fila.m || 'sin modelo'], ['regla', fila.r ? 'con regla propia' : 'sin regla propia']]) cuenta((cortes[corte][clave] ||= vacio()), fila, final);
    }
  }
  const cortar = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1].propuestas - a[1].propuestas).map(([k, v]) => [k, conPct(v)]));
  return { semanas, atletas: Object.keys(porAtleta).length, total: conPct(total), cortes: Object.fromEntries(Object.entries(cortes).map(([k, v]) => [k, cortar(v)])),
    porAtleta: Object.values(porAtleta).map(conPct).sort((a, b) => b.propuestas - a.propuestas) };
}

const NOMBRE_TIPO = { subir: 'Sube kilos', reps: 'Más repeticiones', series: 'Una serie más', mantener: 'Igual', bajar: 'Baja kilos', tope: 'Al tope', peaking: 'Menos repeticiones', sin_tocar: 'A mano',
  descarga: 'Descarga', vuelta: 'Vuelta', mantenimiento: 'Mantenimiento' };
const NOMBRE_CONFIANZA = { alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja' };

// El acuerdo real en texto, para el informe de la línea de órdenes (sin nombres salvo que se pasen)
export function textoAcuerdoDeCopia(a, { nombres = null } = {}) {
  if (!a?.semanas) return 'Acuerdo real: esta copia no tiene todavía ninguna semana con la propuesta guardada.';
  const p = (x) => (x == null ? '—' : `${String(x).replace('.', ',')} %`);
  const fila = (etiqueta, t) => `  ${etiqueta.padEnd(28)} ${String(t.propuestas).padStart(5)} propuestas · aplicadas ${String(t.aplicadas + t.alternativas).padStart(4)} · cambiadas después ${String(t.retocadas).padStart(3)} · hoy como el motor ${p(t.comoElMotorPct).padStart(7)}`;
  const L = ['Acuerdo real (propuestas guardadas al aplicar)', `Semanas con propuesta guardada: ${a.semanas} (de ${a.atletas} ${a.atletas === 1 ? 'atleta' : 'atletas'})`, '', fila('Todas', a.total)];
  for (const [corte, titulo, nombresDe] of [['confianza', 'Por confianza de la propuesta', NOMBRE_CONFIANZA], ['tipo', 'Por lo que proponía', NOMBRE_TIPO], ['modelo', 'Por modelo', {}], ['regla', 'Con o sin regla propia', {}]]) {
    if (Object.keys(a.cortes[corte]).length < 2 && corte !== 'confianza') continue;
    L.push('', titulo);
    for (const [clave, t] of Object.entries(a.cortes[corte])) L.push(fila(nombresDe[clave] || clave, t));
  }
  L.push('', 'Por atleta');
  a.porAtleta.forEach((x, i) => L.push(fila(`${nombres?.[x.id] || `Atleta ${i + 1}`} (${x.semanas} sem.)`.slice(0, 28), x)));
  return L.join('\n');
}
