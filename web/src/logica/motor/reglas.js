// «Programar según FBE» (motor de progresión): las reglas.
// Todo lo que el motor decide sale de aquí. Son valores de partida («reglas FBE») que el coach puede cambiar
// para un atleta, un bloque o un ejercicio; manda siempre lo más cercano al ejercicio:
//   reglas FBE → perfil del atleta (por su nivel) → atleta → bloque → ejercicio
// Decisiones de Pelayo del 5/11/2026: la doble progresión sube con todas las series menos una al tope; la descarga
// la proponen solo las señales (sin calendario); las molestias se avisan y no frenan; el esfuerzo va siempre en RPE.

export const MODELOS = [
  ['por_serie', 'Progresión serie a serie'], ['doble', 'Doble progresión'], ['triple', 'Triple progresión'], ['lineal', 'Lineal'], ['solo_reps', 'Solo repeticiones'],
  ['porcentajes', 'Porcentajes'], ['top_set', 'Top set + back-off por RPE'], ['rir_progresivo', 'RIR progresivo'],
  ['carga_calculada', 'Carga calculada'], ['apre', 'APRE'], ['mantener', 'Mantener'], ['a_mano', 'A mano'],
];
export const NOMBRE_MODELO = Object.fromEntries(MODELOS);
// Los que ya decide el motor. El resto llega en fases posteriores: mientras tanto se usa el modelo de partida
// y la fila lo dice (modelo pedido y modelo usado).
export const MODELOS_DISPONIBLES = ['por_serie', 'top_set', 'doble', 'triple', 'lineal', 'solo_reps', 'mantener', 'a_mano'];
// El modelo de partida, y el que se usa mientras el pedido no esté disponible
export const MODELO_BASE = 'por_serie';

export const CRITERIOS_SUBIDA = ['todas', 'todas_menos_una', 'primera', 'suma'];
export const TIPOS_DESCARGA = ['ligera', 'volumen', 'intensidad', 'tecnica'];

export const REGLAS_FBE = Object.freeze({
  // Modelo de partida según el tipo de ejercicio; `modelo` (a nivel de ejercicio) manda sobre los dos
  modelos: { basico: 'por_serie', resto: 'por_serie' },
  modelo: null,
  // Progresión serie a serie (reglas de Pelayo tras la prueba en sombra del 5/11/2026): cada serie progresa sola.
  //   · llega al tope del rango → sube kilos y vuelve al suelo del rango
  //   · va sobrada (RPE ≤ sobradoRpe; de partida solo en básicos) → sube kilos con las mismas repeticiones
  //   · RPE ≤ rpeSube → una repetición más · por encima → igual
  porSerie: {
    rangos: { basico: [6, 10], multiarticular: [8, 12], aislamiento: [10, 15] },
    rango: null,            // [mín, máx] propio de un ejercicio (manda sobre todo lo demás)
    rangoDeLaPauta: true,   // si la pauta (no serie a serie) trae un rango mín–máx, se respeta
    sobradoRpe: 7,
    sobradoEn: 'basicos',   // 'basicos' | 'todos' | 'ninguno'
    rpeSube: 9,
    variasAlTope: 'faciles', // 'todas' | 'primera' | 'faciles' (todas las de RPE ≤ topeFacilRpe; del resto, solo la primera)
    topeFacilRpe: 8,
    sinKilos: 'solo_reps',  // donde por el nivel la carga la elige el atleta: 'no_tocar' | 'solo_reps' | 'como_los_demas'
  },
  // Serie top + back-off y peaking en los básicos (decisiones de Pelayo del 5/11/2026, con sus datos delante; ver
  // topset.js). Top = la serie o series a la carga más alta; back-off = las demás.
  topSet: {
    detectar: true,       // un básico cuya primera serie es la más pesada se trata como top + back-off sin pedirlo
    backoff: 'faciles',   // 'faciles' (igual, salvo RPE ≤ backoffFacilRpe: suben kilos) | 'solas' (como cualquier serie) | 'igual' (nunca se tocan)
    backoffFacilRpe: 7,
    peaking: {
      cuando: 'foco',      // 'foco' (las semanas con foco «peaking») | 'nunca'
      reps: 1,             // repeticiones que baja la top cada semana
      suelo: 1,            // hasta cuántas repeticiones baja; al llegar, solo se ajustan los kilos
      kilos: 'calculados', // 'calculados' (los que mantienen el esfuerzo, desde el 1RM estimado) | 'salto' (un salto fijo)
      rpe: 'hecho',        // el esfuerzo que se mantiene: 'hecho' (el RPE al que le salió la top) | 'pauta' (el pautado; si no lo hay, el que hizo)
      rpeMin: 8,           // … que nunca baja de aquí: una top fácil no se queda fácil
      duraRpe: 9,          // por encima, la top se repite tal cual
      maxPct: 10,          // tope de subida de kilos de una semana a otra
    },
  },
  // Salto de carga: el del ejercicio (2,5 kg barra, 2 kg mancuernas, 2,5 o 5 kg máquinas), unos kilos fijos o un %
  salto: { tipo: 'ejercicio', valor: null },
  doble: {
    criterio: 'todas_menos_una', // cuándo sube: ver CRITERIOS_SUBIDA
    margen: 0.5,                 // puntos de RPE por encima del objetivo que aún valen como «sin pasarse»
    sobrado: 1,                  // saltos si va sobrado (1 o 2)
    porDebajo: 'bajar_segunda',  // 'mantener' | 'bajar_segunda' (un salto a la segunda semana) | 'bajar_pct'
    bajarPct: 10,
  },
  triple: { seriesMin: null, seriesMax: null, seriesExtra: 2 },
  lineal: { fallosAntesDeBajar: 2, bajadaPct: 10, bajadasParaSalir: 2 },
  soloReps: { sube: 'una_total' }, // 'una_total' | 'una_cada_serie'
  descarga: {
    cuando: 'senales',  // 'senales' | 'programada' | 'mixta' | 'manual'
    cadaSemanas: 5,     // solo con 'programada' o 'mixta'
    tipo: 'ligera',     // ver TIPOS_DESCARGA
    intensidadPct: 15,  // recorte de kilos en la de intensidad
    tecnicaPct: 20,     // recorte de kilos en la de técnica
  },
  // Vuelta tras un parón: el tramo más alto cuyo «desde» (días parado) se cumple. Empieza en 10 días y no en 7
  // para que quien entrena un día por semana no cuente como parado entre una sesión y la siguiente.
  vuelta: [
    { desde: 10, kgPct: 10, series: 1, rpeMax: null },
    { desde: 14, kgPct: 20, series: 1, rpeMax: null },
    { desde: 28, kgPct: 30, series: 1, rpeMax: 7 },
  ],
  mantenimiento: { activo: false, series: 0.5 },
  frenos: {
    semanaAMedias: 0.5,   // por debajo de esta parte de las sesiones hechas, la semana se repite tal cual
    paron: 10,            // días sin entrenar a partir de los cuales es un parón
    pasadoDeEsfuerzo: 1,  // puntos de RPE por encima del objetivo
    sobrado: 2,           // puntos de RPE por debajo del objetivo
    datoRaroPct: 30,      // % de diferencia de kilos frente a lo pautado y a la última vez
    datoRaroSaltos: 2,    // … y además, como mínimo, estos saltos de carga
    datoRaroReps: 2,      // veces el tope del rango
    checkinBajo: 2,       // energía o recuperación (1–5) en este valor o menos: no se añaden series
    detalleCorta: 2,      // serie a serie: repeticiones que faltan para contar como «por debajo»
  },
  // Molestias del check-in (0–3): 'avisar' no frena nada; 'leve' | 'moderada' | 'grave' frenan desde ese nivel
  molestias: 'avisar',
  semana: { maxSeriesPorMusculo: 2, maxSeriesPct: 10 },
  tendencia: { sube: 1, semanasEstancado: 3 },
  escala: 'rpe', // 'rpe' | 'rir' | 'pauta' (la que traiga cada pauta)
});

// Perfiles preparados. Los cuatro primeros son los de cada nivel de la app: todos parten de la progresión serie
// a serie (decisión del 5/11/2026 tras la prueba en sombra).
export const PERFILES = Object.freeze({
  novato: { nombre: 'Novato', modelos: { basico: 'por_serie', resto: 'por_serie' } },
  novato_intermedio: { nombre: 'Novato/intermedio', modelos: { basico: 'por_serie', resto: 'por_serie' } },
  intermedio: { nombre: 'Intermedio', modelos: { basico: 'por_serie', resto: 'por_serie' } },
  avanzado: { nombre: 'Avanzado', modelos: { basico: 'por_serie', resto: 'por_serie' } },
  intermedio_fuerza: { nombre: 'Fuerza', modelos: { basico: 'top_set', resto: 'por_serie' }, descarga: { tipo: 'volumen' } },
  novato_lineal: { nombre: 'Novato, lineal en básicos', modelos: { basico: 'lineal', resto: 'doble' } },
  casa: { nombre: 'En casa o de viaje', modelos: { basico: 'solo_reps', resto: 'solo_reps' } },
  readaptacion: { nombre: 'Readaptación', modelos: { basico: 'por_serie', resto: 'por_serie' }, rpeMax: 7, descarga: { tipo: 'intensidad' } },
  mantenimiento: { nombre: 'Mantenimiento', modelos: { basico: 'mantener', resto: 'mantener' }, mantenimiento: { activo: true } },
});
export const perfilDeNivel = (nivel) => (nivel && PERFILES[nivel] ? nivel : 'novato_intermedio');

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

// Une capas de reglas: lo de la derecha manda. Los objetos se mezclan clave a clave; las listas y los valores
// sueltos se sustituyen; null o undefined en una capa no pisan nada (salvo que la clave no exista aún).
export function fusionar(base, ...capas) {
  const out = esObjeto(base) ? { ...base } : {};
  for (const capa of capas) {
    if (!esObjeto(capa)) continue;
    for (const [k, v] of Object.entries(capa)) {
      if (v === undefined || (v === null && k in out)) continue;
      out[k] = esObjeto(v) && esObjeto(out[k]) ? fusionar(out[k], v) : esObjeto(v) ? fusionar({}, v) : Array.isArray(v) ? v.map((x) => (esObjeto(x) ? { ...x } : x)) : v;
    }
  }
  return out;
}

// Las reglas que valen para un ejercicio. `perfil` es el id de un perfil preparado; si no viene, sale del nivel.
export function resolverReglas({ fbe = null, nivel = null, perfil = null, atleta = null, bloque = null, ejercicio = null } = {}) {
  const id = perfil && PERFILES[perfil] ? perfil : perfilDeNivel(nivel);
  const { nombre: _n, ...delPerfil } = PERFILES[id];
  return { ...fusionar(REGLAS_FBE, fbe, delPerfil, atleta, bloque, ejercicio), perfil: id };
}

const NUM = (min, max) => (v) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const UNO_DE = (lista) => (v) => lista.includes(v);
const IDS_MODELO = MODELOS.map(([k]) => k);
// Qué se acepta en unas reglas guardadas (una capa: no hace falta que estén todas las claves)
const ESQUEMA = {
  modelos: { basico: UNO_DE(IDS_MODELO), resto: UNO_DE(IDS_MODELO) },
  modelo: UNO_DE(IDS_MODELO),
  salto: { tipo: UNO_DE(['ejercicio', 'kg', 'pct']), valor: NUM(0.25, 20) },
  porSerie: { rangoDeLaPauta: (v) => typeof v === 'boolean', sobradoRpe: NUM(5, 8.5), sobradoEn: UNO_DE(['basicos', 'todos', 'ninguno']), rpeSube: NUM(6, 10), variasAlTope: UNO_DE(['todas', 'primera', 'faciles']), topeFacilRpe: NUM(6, 10), sinKilos: UNO_DE(['no_tocar', 'solo_reps', 'como_los_demas']) },
  topSet: { detectar: (v) => typeof v === 'boolean', backoff: UNO_DE(['faciles', 'solas', 'igual']), backoffFacilRpe: NUM(5, 8.5) },
  doble: { criterio: UNO_DE(CRITERIOS_SUBIDA), margen: NUM(0, 1), sobrado: UNO_DE([1, 2]), porDebajo: UNO_DE(['mantener', 'bajar_segunda', 'bajar_pct']), bajarPct: NUM(2.5, 20) },
  triple: { seriesMin: NUM(1, 10), seriesMax: NUM(1, 12), seriesExtra: NUM(1, 4) },
  lineal: { fallosAntesDeBajar: NUM(1, 3), bajadaPct: NUM(5, 15), bajadasParaSalir: NUM(1, 5) },
  soloReps: { sube: UNO_DE(['una_total', 'una_cada_serie']) },
  descarga: { cuando: UNO_DE(['senales', 'programada', 'mixta', 'manual']), cadaSemanas: NUM(3, 12), tipo: UNO_DE(TIPOS_DESCARGA), intensidadPct: NUM(5, 30), tecnicaPct: NUM(5, 40) },
  mantenimiento: { activo: (v) => typeof v === 'boolean', series: NUM(0.25, 1) },
  frenos: { semanaAMedias: NUM(0, 1), paron: NUM(3, 60), pasadoDeEsfuerzo: NUM(0.5, 3), sobrado: NUM(1, 4), datoRaroPct: NUM(10, 100), datoRaroSaltos: NUM(1, 10), datoRaroReps: NUM(1.5, 5), checkinBajo: NUM(1, 4), detalleCorta: NUM(1, 5) },
  molestias: UNO_DE(['avisar', 'leve', 'moderada', 'grave']),
  semana: { maxSeriesPorMusculo: NUM(0, 6), maxSeriesPct: NUM(0, 50) },
  tendencia: { sube: NUM(0.25, 5), semanasEstancado: NUM(2, 6) },
  escala: UNO_DE(['rpe', 'rir', 'pauta']),
  rpeMax: NUM(5, 10),
};
const PEAKING = { cuando: UNO_DE(['foco', 'nunca']), reps: UNO_DE([1, 2]), suelo: UNO_DE([1, 2, 3, 4, 5]), kilos: UNO_DE(['calculados', 'salto']), rpe: UNO_DE(['pauta', 'hecho']), rpeMin: NUM(6, 9.5), duraRpe: NUM(8, 10), maxPct: NUM(2.5, 20) };
const tramoVale = (t) => esObjeto(t) && NUM(1, 365)(t.desde) && NUM(0, 50)(t.kgPct) && NUM(0, 3)(t.series) && (t.rpeMax == null || NUM(5, 10)(t.rpeMax));

// Limpia una capa de reglas (lo que escribe el coach o lo que viene de la base): se queda solo con lo que el motor
// entiende y con valores dentro de rango. Devuelve { reglas, descartado: ['doble.criterio', …] }.
export function limpiarReglas(capa) {
  const reglas = {}, descartado = [];
  if (!esObjeto(capa)) return { reglas, descartado };
  for (const [k, v] of Object.entries(capa)) {
    if (v == null) continue;
    if (k === 'vuelta') {
      if (Array.isArray(v) && v.length && v.length <= 6 && v.every(tramoVale)) reglas.vuelta = [...v].sort((a, b) => a.desde - b.desde).map((t) => ({ desde: t.desde, kgPct: t.kgPct, series: t.series, rpeMax: t.rpeMax ?? null }));
      else descartado.push('vuelta');
      continue;
    }
    const regla = ESQUEMA[k];
    if (!regla) { descartado.push(k); continue; }
    // Los rangos de repeticiones van aparte: [mín, máx] con mín ≤ máx
    if (k === 'porSerie' && esObjeto(v)) {
      const rangoVale = (r) => Array.isArray(r) && r.length === 2 && r.every((x) => Number.isInteger(x) && x >= 1 && x <= 50) && r[0] <= r[1];
      const dentro = {};
      if (v.rango != null) { if (rangoVale(v.rango)) dentro.rango = [...v.rango]; else descartado.push('porSerie.rango'); }
      if (v.rangos != null) {
        const rs = {};
        if (esObjeto(v.rangos)) for (const [t, r] of Object.entries(v.rangos)) { if (['basico', 'multiarticular', 'aislamiento'].includes(t) && rangoVale(r)) rs[t] = [...r]; else descartado.push(`porSerie.rangos.${t}`); }
        else descartado.push('porSerie.rangos');
        if (Object.keys(rs).length) dentro.rangos = rs;
      }
      for (const [k2, v2] of Object.entries(v)) {
        if (v2 == null || k2 === 'rango' || k2 === 'rangos') continue;
        if (regla[k2] && regla[k2](v2)) dentro[k2] = v2; else descartado.push(`${k}.${k2}`);
      }
      if (Object.keys(dentro).length) reglas[k] = dentro;
      continue;
    }
    // El peaking va un nivel más adentro
    if (k === 'topSet' && esObjeto(v)) {
      const dentro = {};
      for (const [k2, v2] of Object.entries(v)) {
        if (v2 == null) continue;
        if (k2 === 'peaking') {
          const pk = {};
          if (esObjeto(v2)) for (const [k3, v3] of Object.entries(v2)) { if (v3 == null) continue; if (PEAKING[k3] && PEAKING[k3](v3)) pk[k3] = v3; else descartado.push(`topSet.peaking.${k3}`); }
          else descartado.push('topSet.peaking');
          if (Object.keys(pk).length) dentro.peaking = pk;
        } else if (regla[k2] && regla[k2](v2)) dentro[k2] = v2; else descartado.push(`${k}.${k2}`);
      }
      if (Object.keys(dentro).length) reglas[k] = dentro;
      continue;
    }
    if (typeof regla === 'function') { if (regla(v)) reglas[k] = v; else descartado.push(k); continue; }
    if (!esObjeto(v)) { descartado.push(k); continue; }
    const dentro = {};
    for (const [k2, v2] of Object.entries(v)) {
      if (v2 == null) continue;
      if (regla[k2] && regla[k2](v2)) dentro[k2] = v2; else descartado.push(`${k}.${k2}`);
    }
    if (Object.keys(dentro).length) reglas[k] = dentro;
  }
  // Coherencia: el mínimo de series de la triple no puede pasar del máximo
  if (reglas.triple?.seriesMin != null && reglas.triple?.seriesMax != null && reglas.triple.seriesMin > reglas.triple.seriesMax) {
    delete reglas.triple.seriesMin; delete reglas.triple.seriesMax; descartado.push('triple.seriesMin', 'triple.seriesMax');
    if (!Object.keys(reglas.triple).length) delete reglas.triple;
  }
  return { reglas, descartado };
}

// ¿Es un básico? La biblioteca guarda el tipo como lista (basico · multiarticular · aislamiento)
export const esBasico = (ejercicio) => (Array.isArray(ejercicio?.tipo) ? ejercicio.tipo.includes('basico') : ejercicio?.tipo === 'basico');

// El modelo de un ejercicio: el suyo si lo tiene; si no, el del perfil según sea básico o no.
// { modelo: el que se usa, pedido: el que tocaba, pendiente: true si el pedido aún no está y se usa otro }
export function modeloDe({ ejercicio = null, reglas = REGLAS_FBE } = {}) {
  const pedido = reglas.modelo || (esBasico(ejercicio) ? reglas.modelos?.basico : reglas.modelos?.resto) || MODELO_BASE;
  if (MODELOS_DISPONIBLES.includes(pedido)) return { modelo: pedido, pedido, pendiente: false };
  return { modelo: MODELO_BASE, pedido, pendiente: true };
}
