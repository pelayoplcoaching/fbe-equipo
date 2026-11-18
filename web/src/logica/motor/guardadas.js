// «Programar según FBE» (fase 1b): las reglas que el coach guarda para un atleta. Lógica pura.
//
// Decisiones de Pelayo (5/11/2026):
//   · Por atleta se puede cambiar el perfil, los rangos de repeticiones de cada tipo de ejercicio y hasta qué RPE se
//     suma una repetición.
//   · Por ejercicio: cómo progresa (el modelo), su rango de repeticiones, su salto de carga y ese mismo RPE.
//   · La regla de un ejercicio vale solo para ese atleta: se guarda en su ficha, no en la biblioteca.
// (16/11/2026, reglas propias de cada atleta) Por atleta, además: cuántas repeticiones baja al subir de kilos (en vez de
// volver al mínimo), el rango y el RPE propios de la serie top, y que no se le proponga descarga por señales.
//
// Se guardan en `atletas.reglas_motor` (jsonb; solo lo escribe el coach), con esta forma:
//   { v: 1, perfil: 'intermedio_fuerza',
//     atleta: { porSerie: { rpeSube: 8.5, rangos: { basico: [5, 8] }, bajaAlSubir: 2 }, topSet: { rango: [1, 8], rpeSube: 8.5 }, descarga: { cuando: 'manual' } },
//     porEjercicio: { '<id del ejercicio>': { modelo: 'doble', porSerie: { rango: [12, 20], rpeSube: 8 }, salto: { tipo: 'kg', valor: 1 } } } }
// Aquí solo entra lo que la pantalla sabe editar: lo demás se descarta al leer, igual que un valor fuera de rango.
import { limpiarReglas, PERFILES, MODELOS_DISPONIBLES, NOMBRE_MODELO, REGLAS_FBE } from './reglas.js';
import { num } from '../calculos.js';

export const VERSION_GUARDADAS = 1;
export const MAX_EJERCICIOS_CON_REGLA = 200;
export const TIPOS_RANGO = [['basico', 'Básicos'], ['multiarticular', 'Multiarticulares'], ['aislamiento', 'Aislamiento']];
// Los perfiles que se pueden elegir a mano (sin perfil, sale el del nivel del atleta: todos serie a serie)
export const PERFILES_ELEGIBLES = [
  ['intermedio_fuerza', 'Fuerza', 'Top set + back-off en los básicos; si hay descarga, de volumen.'],
  ['novato_lineal', 'Novato, lineal en básicos', 'Los básicos suben kilos cada semana mientras salgan; el resto, doble progresión.'],
  ['casa', 'En casa o de viaje', 'Solo repeticiones: no se proponen kilos.'],
  ['readaptacion', 'Readaptación', 'Serie a serie, con RPE 7 como máximo; si hay descarga, de intensidad.'],
  ['mantenimiento', 'Mantenimiento', 'Mantiene cargas y recorta series.'],
];
// Hasta qué RPE se suma una repetición: los valores que se ofrecen
export const VALORES_RPE_SUBE = [7, 7.5, 8, 8.5, 9, 9.5, 10];
// Al subir de kilos en el tope del rango: cuántas repeticiones baja ('' = vuelve al mínimo)
export const VALORES_BAJA = [1, 2, 3, 4];
// (v0.181) El salto de las mancuernas del gimnasio del atleta, si no es el de partida (2,5 kg)
export const VALORES_MANCUERNAS = [2, 1];
export const VACIAS = Object.freeze({ perfil: null, atleta: {}, porEjercicio: {} });

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

// De una capa cualquiera, solo lo que se edita por atleta (rpeSube y rangos por tipo)
function capaAtleta(capa, descartado, donde = 'atleta') {
  const { reglas, descartado: mal } = limpiarReglas(esObjeto(capa) ? { porSerie: capa.porSerie, topSet: capa.topSet, descarga: capa.descarga, salto: capa.salto } : {});
  mal.forEach((x) => descartado.push(`${donde}.${x}`));
  if (esObjeto(capa)) Object.keys(capa).filter((k) => !['porSerie', 'topSet', 'descarga', 'salto'].includes(k)).forEach((k) => descartado.push(`${donde}.${k}`));
  const p = reglas.porSerie || {}, out = {}, fin = {};
  if (p.rpeSube != null) out.rpeSube = p.rpeSube;
  if (p.rangos) out.rangos = p.rangos;
  if (p.bajaAlSubir != null) out.bajaAlSubir = p.bajaAlSubir;
  Object.keys(p).filter((k) => !['rpeSube', 'rangos', 'bajaAlSubir'].includes(k)).forEach((k) => descartado.push(`${donde}.porSerie.${k}`));
  if (Object.keys(out).length) fin.porSerie = out;
  // De la serie top, solo su rango y su RPE; de la descarga, solo «manual» (sin señales)
  const t = reglas.topSet || {}, top = {};
  if (t.rango) top.rango = t.rango;
  if (t.rpeSube != null) top.rpeSube = t.rpeSube;
  Object.keys(t).filter((k) => !['rango', 'rpeSube'].includes(k)).forEach((k) => descartado.push(`${donde}.topSet.${k}`));
  if (Object.keys(top).length) fin.topSet = top;
  if (reglas.descarga?.cuando === 'manual') fin.descarga = { cuando: 'manual' };
  else if (esObjeto(capa) && capa.descarga != null) descartado.push(`${donde}.descarga`);
  // (v0.181) del salto, por atleta, solo el de las mancuernas de su gimnasio (2,5 es el de partida: no se guarda)
  if (VALORES_MANCUERNAS.includes(reglas.salto?.mancuernas)) fin.salto = { mancuernas: reglas.salto.mancuernas };
  else if (esObjeto(capa) && capa.salto != null && capa.salto.mancuernas !== 2.5) descartado.push(`${donde}.salto`);
  return fin;
}

// De una capa cualquiera, solo lo que se edita por ejercicio (modelo, rango, salto en kilos y rpeSube)
function capaEjercicio(capa, descartado, donde) {
  if (!esObjeto(capa)) { descartado.push(donde); return null; }
  const { reglas, descartado: mal } = limpiarReglas({ modelo: capa.modelo, porSerie: capa.porSerie, salto: capa.salto });
  mal.forEach((x) => descartado.push(`${donde}.${x}`));
  Object.keys(capa).filter((k) => !['modelo', 'porSerie', 'salto'].includes(k)).forEach((k) => descartado.push(`${donde}.${k}`));
  const out = {};
  if (reglas.modelo && MODELOS_DISPONIBLES.includes(reglas.modelo)) out.modelo = reglas.modelo; else if (capa.modelo != null) descartado.push(`${donde}.modelo`);
  const p = reglas.porSerie || {}, ps = {};
  if (p.rango) ps.rango = p.rango;
  if (p.rpeSube != null) ps.rpeSube = p.rpeSube;
  Object.keys(p).filter((k) => !['rango', 'rpeSube'].includes(k)).forEach((k) => descartado.push(`${donde}.porSerie.${k}`));
  if (Object.keys(ps).length) out.porSerie = ps;
  // El salto propio siempre es en kilos
  if (reglas.salto?.tipo === 'kg' && reglas.salto.valor != null) out.salto = { tipo: 'kg', valor: reglas.salto.valor };
  else if (capa.salto != null) descartado.push(`${donde}.salto`);
  return Object.keys(out).length ? out : null;
}

// Lo guardado en la ficha, ya limpio: { perfil, atleta, porEjercicio, descartado }. Nunca falla: con null, un texto o
// algo roto devuelve unas reglas vacías.
export function leerGuardadas(valor) {
  const descartado = [];
  if (!esObjeto(valor)) return { ...VACIAS, atleta: {}, porEjercicio: {}, descartado };
  const perfil = PERFILES_ELEGIBLES.some(([id]) => id === valor.perfil) ? valor.perfil : null;
  if (valor.perfil != null && !perfil) descartado.push('perfil');
  const atleta = capaAtleta(valor.atleta, descartado);
  const porEjercicio = {};
  if (esObjeto(valor.porEjercicio)) {
    for (const [id, capa] of Object.entries(valor.porEjercicio).slice(0, MAX_EJERCICIOS_CON_REGLA)) {
      const limpia = capaEjercicio(capa, descartado, `porEjercicio.${id}`);
      if (limpia) porEjercicio[id] = limpia;
    }
    if (Object.keys(valor.porEjercicio).length > MAX_EJERCICIOS_CON_REGLA) descartado.push('porEjercicio (demasiados)');
  } else if (valor.porEjercicio != null) descartado.push('porEjercicio');
  Object.keys(valor).filter((k) => !['v', 'perfil', 'atleta', 'porEjercicio'].includes(k)).forEach((k) => descartado.push(k));
  return { perfil, atleta, porEjercicio, descartado };
}

export const hayGuardadas = (g) => !!g && (!!g.perfil || Object.keys(g.atleta || {}).length > 0 || Object.keys(g.porEjercicio || {}).length > 0);

// Lo que se escribe en `atletas.reglas_motor`: null si no queda ninguna regla propia
export function paraGuardar(g) {
  const limpio = leerGuardadas({ perfil: g?.perfil, atleta: g?.atleta, porEjercicio: g?.porEjercicio });
  if (!hayGuardadas(limpio)) return null;
  return { v: VERSION_GUARDADAS, ...(limpio.perfil ? { perfil: limpio.perfil } : {}), ...(Object.keys(limpio.atleta).length ? { atleta: limpio.atleta } : {}),
    ...(Object.keys(limpio.porEjercicio).length ? { porEjercicio: limpio.porEjercicio } : {}) };
}

// Lo que el motor necesita: el perfil va en `atleta.perfil` y las capas en `reglas`
export const paraElMotor = (g) => ({ perfil: g?.perfil || null, reglas: { atleta: g?.atleta || {}, porEjercicio: g?.porEjercicio || {} } });

// ---------- Lo que enseña y recoge la pantalla ----------
const rangoDeTexto = (min, max) => {
  const a = String(min ?? '').trim(), b = String(max ?? '').trim();
  if (!a && !b) return { rango: null };
  const x = Number(a), y = Number(b);
  if (!a || !b || !Number.isInteger(x) || !Number.isInteger(y) || x < 1 || y > 50 || x > y) return { error: true };
  return { rango: [x, y] };
};

// Las reglas del atleta tal como se editan: { perfil, rpeSube, rangos: { basico: [mín, máx] | null, … } }
export function reglasDeAtleta(g) {
  const p = g?.atleta?.porSerie || {};
  return { perfil: g?.perfil || null, rpeSube: p.rpeSube ?? null, rangos: Object.fromEntries(TIPOS_RANGO.map(([t]) => [t, p.rangos?.[t] || null])),
    bajaAlSubir: p.bajaAlSubir ?? null, rangoTop: g?.atleta?.topSet?.rango || null, rpeSubeTop: g?.atleta?.topSet?.rpeSube ?? null, sinDescarga: g?.atleta?.descarga?.cuando === 'manual', mancuernas: g?.atleta?.salto?.mancuernas ?? null };
}

// Pone las reglas del atleta a partir del formulario. rangos: { basico: ['5', '8'], … } con textos (vacío = el de siempre).
// Devuelve { guardadas } o { errores: ['Básicos: …'] }.
export function conReglasDeAtleta(g, { perfil = null, rpeSube = null, rangos = {}, bajaAlSubir = null, rangoTop = [], rpeSubeTop = null, sinDescarga = false, mancuernas = null } = {}) {
  const errores = [], rs = {};
  for (const [t, nombre] of TIPOS_RANGO) {
    const r = rangoDeTexto(rangos[t]?.[0], rangos[t]?.[1]);
    if (r.error) errores.push(`${nombre}: el rango va de un mínimo a un máximo entre 1 y 50 repeticiones`);
    else if (r.rango) rs[t] = r.rango;
  }
  const rpe = rpeSube == null || rpeSube === '' ? null : Number(rpeSube);
  if (rpe != null && !VALORES_RPE_SUBE.includes(rpe)) errores.push('El RPE tiene que ser uno de la lista');
  if (perfil && !PERFILES_ELEGIBLES.some(([id]) => id === perfil)) errores.push('Ese perfil no existe');
  const baja = bajaAlSubir == null || bajaAlSubir === '' ? null : Number(bajaAlSubir);
  if (baja != null && !VALORES_BAJA.includes(baja)) errores.push('Al subir de kilos se bajan de 1 a 4 repeticiones');
  const rt = rangoDeTexto(rangoTop?.[0], rangoTop?.[1]);
  if (rt.error) errores.push('Serie top: el rango va de un mínimo a un máximo entre 1 y 50 repeticiones');
  const rpeTop = rpeSubeTop == null || rpeSubeTop === '' ? null : Number(rpeSubeTop);
  if (rpeTop != null && !VALORES_RPE_SUBE.includes(rpeTop)) errores.push('El RPE de la serie top tiene que ser uno de la lista');
  const man = mancuernas == null || mancuernas === '' ? null : Number(mancuernas);
  if (man != null && !VALORES_MANCUERNAS.includes(man)) errores.push('Las mancuernas suben de 2,5, de 2 o de 1 kg');
  if (errores.length) return { errores };
  const porSerie = { ...(rpe != null ? { rpeSube: rpe } : {}), ...(Object.keys(rs).length ? { rangos: rs } : {}), ...(baja != null ? { bajaAlSubir: baja } : {}) };
  const topSet = { ...(rt.rango ? { rango: rt.rango } : {}), ...(rpeTop != null ? { rpeSube: rpeTop } : {}) };
  const atleta = { ...(Object.keys(porSerie).length ? { porSerie } : {}), ...(Object.keys(topSet).length ? { topSet } : {}), ...(sinDescarga ? { descarga: { cuando: 'manual' } } : {}), ...(man != null ? { salto: { mancuernas: man } } : {}) };
  return { guardadas: { perfil: perfil || null, atleta, porEjercicio: { ...(g?.porEjercicio || {}) } } };
}

// La regla de un ejercicio tal como se edita: { modelo, rango, salto, rpeSube } (null = el de siempre)
export function reglaDeEjercicio(g, ejercicioId) {
  const r = g?.porEjercicio?.[ejercicioId] || {};
  return { modelo: r.modelo || null, rango: r.porSerie?.rango || null, salto: r.salto?.valor ?? null, rpeSube: r.porSerie?.rpeSube ?? null };
}
export const tieneRegla = (g, ejercicioId) => !!g?.porEjercicio?.[ejercicioId];

// Pone (o quita, si todo viene vacío) la regla de un ejercicio a partir del formulario.
//   { modelo, rango: ['12', '20'], salto: '1', rpeSube: '8' }, con textos. Devuelve { guardadas } o { errores }.
export function conReglaDeEjercicio(g, ejercicioId, { modelo = null, rango = [], salto = null, rpeSube = null } = {}) {
  const errores = [];
  if (!ejercicioId) return { errores: ['Falta el ejercicio'] };
  const r = rangoDeTexto(rango?.[0], rango?.[1]);
  if (r.error) errores.push('El rango va de un mínimo a un máximo entre 1 y 50 repeticiones');
  const s = salto == null || String(salto).trim() === '' ? null : Number(String(salto).replace(',', '.'));
  if (s != null && !(Number.isFinite(s) && s >= 0.25 && s <= 20)) errores.push('El salto de carga va de 0,25 a 20 kg');
  const rpe = rpeSube == null || rpeSube === '' ? null : Number(rpeSube);
  if (rpe != null && !VALORES_RPE_SUBE.includes(rpe)) errores.push('El RPE tiene que ser uno de la lista');
  if (modelo && !MODELOS_DISPONIBLES.includes(modelo)) errores.push('Esa forma de progresar no existe');
  const porEjercicio = { ...(g?.porEjercicio || {}) };
  const nueva = !porEjercicio[ejercicioId];
  if (nueva && Object.keys(porEjercicio).length >= MAX_EJERCICIOS_CON_REGLA) errores.push(`Como mucho ${MAX_EJERCICIOS_CON_REGLA} ejercicios con regla propia`);
  if (errores.length) return { errores };
  const porSerie = { ...(r.rango ? { rango: r.rango } : {}), ...(rpe != null ? { rpeSube: rpe } : {}) };
  const regla = { ...(modelo ? { modelo } : {}), ...(Object.keys(porSerie).length ? { porSerie } : {}), ...(s != null ? { salto: { tipo: 'kg', valor: s } } : {}) };
  if (Object.keys(regla).length) porEjercicio[ejercicioId] = regla; else delete porEjercicio[ejercicioId];
  return { guardadas: { perfil: g?.perfil || null, atleta: g?.atleta || {}, porEjercicio } };
}

// En una línea, para la hoja: «Perfil Fuerza · suma repeticiones hasta RPE 8,5 · básicos 5–8 · 3 ejercicios con regla propia»
export function resumenGuardadas(g) {
  if (!hayGuardadas(g)) return 'Las de partida para su nivel';
  const a = reglasDeAtleta(g), partes = [];
  if (a.perfil) partes.push(`Perfil ${PERFILES[a.perfil].nombre}`);
  if (a.rpeSube != null) partes.push(`suma repeticiones hasta RPE ${num(a.rpeSube)}`);
  for (const [t, nombre] of TIPOS_RANGO) if (a.rangos[t]) partes.push(`${nombre.toLowerCase()} ${a.rangos[t][0]}–${a.rangos[t][1]}`);
  if (a.bajaAlSubir != null) partes.push(`al subir de kilos baja ${a.bajaAlSubir} ${a.bajaAlSubir === 1 ? 'repetición' : 'repeticiones'}`);
  if (a.rangoTop) partes.push(`serie top ${a.rangoTop[0]}–${a.rangoTop[1]}`);
  if (a.rpeSubeTop != null) partes.push(`la top suma hasta RPE ${num(a.rpeSubeTop)}`);
  if (a.sinDescarga) partes.push('sin descarga por señales');
  if (a.mancuernas != null) partes.push(`mancuernas de ${num(a.mancuernas)} en ${num(a.mancuernas)} kg`);
  const n = Object.keys(g.porEjercicio || {}).length;
  if (n) partes.push(`${n} ${n === 1 ? 'ejercicio con regla propia' : 'ejercicios con regla propia'}`);
  const texto = partes.join(' · ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// La regla de un ejercicio en una línea: «Doble progresión · 12–20 repeticiones · sube de 1 kg en 1 kg · suma hasta RPE 8»
export function resumenRegla(g, ejercicioId) {
  const r = reglaDeEjercicio(g, ejercicioId), partes = [];
  if (r.modelo) partes.push(NOMBRE_MODELO[r.modelo] || r.modelo);
  if (r.rango) partes.push(`${r.rango[0]}–${r.rango[1]} repeticiones`);
  if (r.salto != null) partes.push(`sube de ${num(r.salto, 2)} kg en ${num(r.salto, 2)} kg`);
  if (r.rpeSube != null) partes.push(`suma repeticiones hasta RPE ${num(r.rpeSube)}`);
  return partes.join(' · ');
}

// Los valores de partida, para enseñarlos como referencia en los campos vacíos
export const DE_PARTIDA = Object.freeze({ rpeSube: REGLAS_FBE.porSerie.rpeSube, rangos: REGLAS_FBE.porSerie.rangos });
