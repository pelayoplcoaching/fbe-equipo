// «La travesía» al nivel de los mejores (tanda 3): lo que da motivos para volver. Misiones de tres en tres con su rango,
// adornos que se ganan por rango y logros con nombre. Solo funciones puras: lo guardado en el móvil lo lleva ui/travesia.js
// (y la tanda 4, a la base). Solo cuentan las etapas de los descansos de una sesión: la práctica no.
import { azar } from './travesia.js';

// ---------- Rangos ----------
export const RANGOS = ['Cachorro', 'Explorador', 'Rastreador', 'Corredor', 'Cazador', 'Guía de la manada', 'Alfa', 'Leyenda'];
export const nombreRango = (n) => {
  const i = Math.max(0, Math.floor(Number(n) || 0));
  return i < RANGOS.length ? RANGOS[i] : `${RANGOS[RANGOS.length - 1]} ${i - RANGOS.length + 2}`;
};

// ---------- Misiones ----------
// tipo 'etapa': en una sola etapa; 'suma': entre todas las etapas desde que salió la misión. campo: lo que se mira del
// resultado de la etapa (logica/travesia.js, resultado) o, si es 'cuenta', lo que hace que cuente (se suma 1).
// base: la meta en el rango 0; sube un 25 % por rango (hasta el 8) y se redondea a algo que se lea bien.
export const MISIONES = [
  { id: 'lejos', tipo: 'etapa', campo: 'metros', base: 350, texto: (m) => `Llega a ${m} m en una etapa` },
  { id: 'estrellas1', tipo: 'etapa', campo: 'estrellas', base: 8, texto: (m) => `Coge ${m} estrellas en una etapa` },
  { id: 'limpia', tipo: 'etapa', campo: 'limpia', base: 1, fija: true, texto: () => 'Haz una etapa entera sin tropezar' },
  { id: 'combo', tipo: 'etapa', campo: 'combo', base: 2, max: 4, texto: (m) => `Llega a un combo ×${m}` },
  { id: 'roces1', tipo: 'etapa', campo: 'roces', base: 1, max: 4, texto: (m) => (m === 1 ? 'Pasa una vez por los pelos' : `Pasa ${m} veces por los pelos en una etapa`) },
  { id: 'arriba1', tipo: 'etapa', campo: 'arriba', base: 8, texto: (m) => `Corre ${m} m por encima de las cornisas en una etapa` },
  { id: 'pot1', tipo: 'etapa', campo: 'potenciadores', base: 1, fija: true, texto: () => 'Coge un potenciador' },
  { id: 'rio1', tipo: 'etapa', campo: 'rios', base: 1, fija: true, texto: () => 'Cruza un río' },
  { id: 'metros', tipo: 'suma', campo: 'metros', base: 1500, texto: (m) => `Recorre ${textoKm(m)} entre tus descansos` },
  { id: 'estrellas', tipo: 'suma', campo: 'estrellas', base: 30, texto: (m) => `Coge ${m} estrellas` },
  { id: 'etapas', tipo: 'suma', campo: 'etapa', base: 5, texto: (m) => `Juega en ${m} descansos` },
  { id: 'roces', tipo: 'suma', campo: 'roces', base: 4, texto: (m) => `Pasa ${m} veces por los pelos` },
  { id: 'rios', tipo: 'suma', campo: 'rios', base: 2, texto: (m) => `Cruza ${m} ríos` },
  { id: 'pots', tipo: 'suma', campo: 'potenciadores', base: 3, texto: (m) => `Coge ${m} potenciadores` },
  { id: 'arriba', tipo: 'suma', campo: 'arriba', base: 40, texto: (m) => `Corre ${m} m por encima de las cornisas` },
  { id: 'limpias', tipo: 'suma', campo: 'limpia', base: 3, texto: (m) => `Haz ${m} etapas sin tropezar` },
];
const textoKm = (m) => (m < 1000 ? `${m} m` : `${String(Math.round(m / 100) / 10).replace('.', ',')} km`);
const legible = (v) => (v < 10 ? Math.round(v) : v < 100 ? Math.round(v / 5) * 5 : v < 1000 ? Math.round(v / 50) * 50 : Math.round(v / 250) * 250);
export function metaDe(mision, rango) {
  if (mision.fija) return mision.base;
  const v = legible(mision.base * (1 + 0.25 * Math.min(8, Math.max(0, rango))));
  return mision.max ? Math.min(mision.max, Math.max(mision.base, Math.round(mision.base + rango * 0.5))) : Math.max(1, v);
}
// Las tres misiones de un rango: siempre las mismas para ese rango (salen de su número), de tres cosas distintas, y al
// menos una de cada tipo
export function misionesDeRango(rango) {
  const r = azar(1000 + Math.max(0, rango) * 97), etapa = MISIONES.filter((m) => m.tipo === 'etapa'), suma = MISIONES.filter((m) => m.tipo === 'suma');
  const coge = (l) => l.splice(Math.floor(r() * l.length), 1)[0];
  const a = coge(etapa), b = coge(suma.filter((m) => m.campo !== a.campo));
  // (la tercera, de algo distinto de las otras dos: no dos misiones de rozar)
  const libres = (l) => l.filter((m) => m.campo !== a.campo && m.campo !== b.campo);
  const c = coge(r() < 0.5 ? libres(etapa) : libres(suma));
  return [a, b, c].map((m) => ({ id: m.id, valor: 0 }));
}
export const misionPorId = (id) => MISIONES.find((m) => m.id === id) || null;
export const textoMision = (id, rango) => { const m = misionPorId(id); return m ? m.texto(metaDe(m, rango)) : ''; };

// Lo que cuenta de una etapa para cada campo
function valorDe(campo, r) {
  if (campo === 'etapa') return 1;
  if (campo === 'limpia') return r.tropiezos === 0 && !r.calma && r.segundos >= 30 ? 1 : 0;
  if (campo === 'potenciadores') return Array.isArray(r.potenciadores) ? r.potenciadores.length : 0;
  return Math.max(0, Math.round(Number(r[campo]) || 0));
}

// ---------- Adornos ----------
// Se ganan por rango y se ponen o se quitan en «Tu travesía» (lo que lleva puesto, en los ajustes del móvil)
export const ADORNOS = [
  { id: 'huellas', nombre: 'Huellas de luz', rango: 1 },
  { id: 'estela', nombre: 'Estela de estrellas', rango: 2 },
  { id: 'panuelo', nombre: 'Pañuelo al viento', rango: 3 },
  { id: 'collar', nombre: 'Collar de luna', rango: 4 },
  { id: 'aura', nombre: 'Aura plateada', rango: 5 },
];
export const adornosDe = (rango) => ADORNOS.map((a) => ({ ...a, tiene: Math.max(0, rango) >= a.rango }));
// Los que lleva puestos (de los que tiene): sin elegir nada, todos los que tiene
export function adornosPuestos(rango, elegidos) {
  const tiene = adornosDe(rango).filter((a) => a.tiene).map((a) => a.id);
  return Array.isArray(elegidos) ? elegidos.filter((id) => tiene.includes(id)) : tiene;
}

// ---------- Logros ----------
// prueba(r, total, ctx): r, el resultado de la etapa; total, lo guardado de la travesía tras sumarla; ctx: { fase, paisaje }
export const LOGROS = [
  { id: 'km1', nombre: 'Primer kilómetro', como: 'Recorre 1 km entre tus descansos', prueba: (r, g) => g.total >= 1000 },
  { id: 'km10', nombre: 'Diez kilómetros', como: 'Recorre 10 km', prueba: (r, g) => g.total >= 10000 },
  { id: 'maraton', nombre: 'Maratón', como: 'Recorre 42,2 km', prueba: (r, g) => g.total >= 42195 },
  { id: 'rasguno', nombre: 'Sin un rasguño', como: 'Dos minutos de etapa sin tropezar', prueba: (r) => r.tropiezos === 0 && !r.calma && r.segundos >= 120 },
  { id: 'pelos', nombre: 'Por los pelos', como: 'Tres veces por los pelos en una etapa', prueba: (r) => r.roces >= 3 },
  { id: 'combo4', nombre: 'Combo ×4', como: 'Llega al combo más alto', prueba: (r) => r.combo >= 4 },
  { id: 'cornisas', nombre: 'Por las alturas', como: '40 m por encima de las cornisas en una etapa', prueba: (r) => r.arriba >= 40 },
  { id: 'monte1', nombre: 'Un monte de un salto', como: 'Salta un monte sin el doble salto (mantén el dedo)', prueba: (r) => r.montesUno >= 1 },
  { id: 'estampida', nombre: 'La estampida', como: 'Supera una estampida', prueba: (r) => (r.momentos || []).includes('estampida') },
  { id: 'puente', nombre: 'El puente colgante', como: 'Cruza el puente colgante', prueba: (r) => (r.momentos || []).includes('puente') },
  { id: 'tormenta', nombre: 'Bajo la tormenta', como: 'Corre durante una tormenta', prueba: (r) => (r.momentos || []).includes('tormenta') },
  { id: 'trio', nombre: 'Los tres poderes', como: 'Coge el imán, la luna llena y el aullido (en cualquier etapa)', prueba: (r, g, ctx) => ['iman', 'luna', 'aullido'].every((p) => (ctx.potenciadores || []).includes(p)) },
  { id: 'nocturno', nombre: 'Lobo nocturno', como: 'Juega una etapa de noche', prueba: (r, g, ctx) => ctx.fase === 'noche' },
  { id: 'alba', nombre: 'Al alba', como: 'Juega una etapa al amanecer', prueba: (r, g, ctx) => ctx.fase === 'alba' },
  { id: 'nieve', nombre: 'Cumbres nevadas', como: 'Llega a las cumbres nevadas', prueba: (r, g, ctx) => ctx.paisaje === 2 },
  { id: 'estrellas500', nombre: 'Coleccionista', como: 'Coge 500 estrellas', prueba: (r, g) => g.estrellas >= 500 },
  // (remate, tanda 6)
  { id: 'dorada1', nombre: 'El primer secreto', como: 'Coge una estrella dorada (salto largo y doble salto)', prueba: (r, g, ctx) => (ctx.doradas || 0) >= 1 },
  { id: 'dorada5', nombre: 'Buscador de secretos', como: 'Coge cinco estrellas doradas', prueba: (r, g, ctx) => (ctx.doradas || 0) >= 5 },
  { id: 'ventisca', nombre: 'Más rápido que la ventisca', como: 'Escapa de la ventisca sin que te alcance', prueba: (r) => r.escapadas >= 1 },
  { id: 'dorado', nombre: 'Día dorado', como: 'Juega una etapa dorada (tras un récord en la serie)', prueba: (r, g, ctx) => !!ctx.dorada },
  { id: 'fiestas', nombre: 'Lobo de fiesta', como: 'Juega en Navidad, en Halloween o con luna llena', prueba: (r, g, ctx) => !!ctx.fecha },
];

// ---------- Lo que se guarda ----------
// { rango, activas: [{ id, valor }], hechas (misiones cumplidas en total), logros: { id: 'AAAA-MM-DD' }, potenciadores: [tipos ya cogidos alguna vez] }
// (remate, tanda 6) rutas: las rutas nuevas elegidas, por orden; doradas: las estrellas doradas cogidas (cuántas)
// (remate, tanda 7) numeros: lo que se cuenta para «Tu lobo en números» (saltos, roces, mejor combo, etapas, escapadas)
export const META_VACIA = () => ({ rango: 0, activas: misionesDeRango(0), hechas: 0, logros: {}, potenciadores: [], rutas: [], doradas: 0, fiestas: [], numeros: { saltos: 0, roces: 0, combo: 1, etapas: 0, escapadas: 0, porPaisaje: [0, 0, 0, 0] } });
export function limpiarMeta(m) {
  const v = META_VACIA();
  if (!m || typeof m !== 'object') return v;
  v.rango = Math.min(999, Math.max(0, Math.floor(Number(m.rango) || 0)));
  v.hechas = Math.min(1e6, Math.max(0, Math.floor(Number(m.hechas) || 0)));
  const deRango = misionesDeRango(v.rango).map((x) => x.id);
  const act = Array.isArray(m.activas) ? m.activas.filter((x) => x && deRango.includes(x.id)) : [];
  v.activas = deRango.map((id) => { const a = act.find((x) => x.id === id); return { id, valor: Math.min(1e7, Math.max(0, Math.round(Number(a?.valor) || 0))) }; });
  if (m.logros && typeof m.logros === 'object') for (const [k, d] of Object.entries(m.logros)) if (LOGROS.some((l) => l.id === k) && /^\d{4}-\d{2}-\d{2}$/.test(d)) v.logros[k] = d;
  if (Array.isArray(m.potenciadores)) v.potenciadores = [...new Set(m.potenciadores.filter((p) => ['iman', 'luna', 'aullido'].includes(p)))];
  if (Array.isArray(m.rutas)) v.rutas = m.rutas.filter((x) => ['picos', 'pirineos', 'camino'].includes(x)).slice(0, 50);
  v.doradas = Math.min(1e5, Math.max(0, Math.floor(Number(m.doradas) || 0)));
  // (remate, tanda 8) los meses en que el equipo hizo la fiesta (su postal especial): 'AAAA-MM'
  v.fiestas = [...new Set((Array.isArray(m.fiestas) ? m.fiestas : []).filter((x) => /^\d{4}-\d{2}$/.test(x)))].sort().slice(-60);
  const n = m.numeros && typeof m.numeros === 'object' ? m.numeros : {};
  const ent = (x, max) => Math.min(max, Math.max(0, Math.floor(Number(x) || 0)));
  v.numeros = { saltos: ent(n.saltos, 1e8), roces: ent(n.roces, 1e7), combo: Math.max(1, ent(n.combo, 4)), etapas: ent(n.etapas, 1e7), escapadas: ent(n.escapadas, 1e6), porPaisaje: [0, 1, 2, 3].map((i) => ent(Array.isArray(n.porPaisaje) ? n.porPaisaje[i] : 0, 1e8)) };
  return v;
}

// Suma una etapa (solo las de una sesión). Devuelve { meta, cumplidas: [textos], subeRango: nombre o null, adorno: nombre
// o null, logros: [nombres] }. r: el resultado de la etapa; total: lo guardado de la travesía ya con ella; ctx: { fase, paisaje, dia }
export function sumarMeta(meta, r, total, { fase = null, paisaje = null, dia = null, dorada = false, fecha = null } = {}) {
  const m = limpiarMeta(meta);
  const cumplidas = [];
  for (const a of m.activas) {
    const def = misionPorId(a.id), objetivo = metaDe(def, m.rango);
    if (a.valor >= objetivo) continue;
    const v = valorDe(def.campo, r);
    const antes = a.valor;
    a.valor = def.tipo === 'etapa' ? Math.max(a.valor, v) : a.valor + v;
    if (antes < objetivo && a.valor >= objetivo) { cumplidas.push(def.texto(objetivo)); m.hechas += 1; }
  }
  let subeRango = null, adorno = null;
  if (m.activas.every((a) => a.valor >= metaDe(misionPorId(a.id), m.rango))) {
    m.rango += 1; m.activas = misionesDeRango(m.rango); subeRango = nombreRango(m.rango);
    adorno = ADORNOS.find((x) => x.rango === m.rango)?.nombre || null;
  }
  m.potenciadores = [...new Set([...m.potenciadores, ...(r.potenciadores || [])])];
  m.doradas += Math.max(0, Math.round(Number(r.doradas) || 0));
  // (remate, tanda 7) los números de «Tu lobo en números»
  const nu = m.numeros;
  m.numeros = { saltos: nu.saltos + Math.max(0, r.saltos | 0), roces: nu.roces + Math.max(0, r.roces | 0), combo: Math.max(nu.combo, r.combo | 0, 1), etapas: nu.etapas + 1, escapadas: nu.escapadas + Math.max(0, r.escapadas | 0), porPaisaje: nu.porPaisaje.map((v, i) => v + (i === paisaje ? Math.max(0, r.estrellas | 0) : 0)) };
  const ctx = { fase, paisaje, potenciadores: m.potenciadores, doradas: m.doradas, dorada, fecha };
  const logros = [];
  const hoy = /^\d{4}-\d{2}-\d{2}$/.test(dia || '') ? dia : new Date().toISOString().slice(0, 10);
  for (const l of LOGROS) {
    if (m.logros[l.id]) continue;
    let ok = false;
    try { ok = !!l.prueba(r, total || {}, ctx); } catch { ok = false; }
    if (ok) { m.logros[l.id] = hoy; logros.push(l.nombre); }
  }
  return { meta: m, cumplidas, subeRango, adorno, logros };
}
// El progreso de cada misión activa, para enseñarlo: [{ id, texto, valor, meta, hecha }]
export const progresoMisiones = (meta) => {
  const m = limpiarMeta(meta);
  return m.activas.map((a) => { const def = misionPorId(a.id), objetivo = metaDe(def, m.rango); return { id: a.id, texto: def.texto(objetivo), valor: Math.min(a.valor, objetivo), meta: objetivo, hecha: a.valor >= objetivo }; });
};

// (remate, tanda 6) Elige la ruta número n del recorrido (de las nuevas): las de antes se quedan, las de después se quitan
export function elegirRuta(meta, n, id) {
  const m = limpiarMeta(meta), k = n - 3;
  if (k < 0 || !['picos', 'pirineos', 'camino'].includes(id)) return m;
  const r = m.rutas.slice(0, k);
  while (r.length < k) r.push(['picos', 'pirineos', 'camino'][r.length % 3]);
  m.rutas = [...r, id];
  return m;
}

// (remate, tanda 7) Los kilómetros de cada mes (de las semanas guardadas: cada semana cuenta en el mes de su jueves),
// de más antiguo a más nuevo: [{ mes: 'AAAA-MM', metros }]
export function metrosPorMes(semanas) {
  const porMes = new Map();
  for (const [lunes, m] of Object.entries(semanas || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lunes) || !(m > 0)) continue;
    const j = new Date(`${lunes}T12:00:00Z`); j.setUTCDate(j.getUTCDate() + 3);
    const mes = j.toISOString().slice(0, 7);
    porMes.set(mes, (porMes.get(mes) || 0) + m);
  }
  return [...porMes.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([mes, metros]) => ({ mes, metros }));
}

// (remate, tanda 8) La fiesta de la manada: apunta el mes (para su postal) y devuelve la meta nueva (o la misma)
export function apuntarFiesta(meta, mes) {
  const m = limpiarMeta(meta);
  if (!/^\d{4}-\d{2}$/.test(mes || '') || m.fiestas.includes(mes)) return m;
  return limpiarMeta({ ...m, fiestas: [...m.fiestas, mes] });
}
