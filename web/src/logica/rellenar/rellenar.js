// «Rellenar la semana»: propone el menú de la semana con las recetas del recetario del atleta. Lógica pura.
//
// No busca que cuadren los macros: las recetas de cada comida ya están calculadas para su plan (cualquier combinación de
// una receta por comida cae en sus kcal). Lo que hace es ahorrar el trabajo de elegir 28 recetas una a una:
//   · solo rellena los huecos (lo ya apuntado se respeta y no se repite) y, en la semana en curso, solo desde hoy;
//   · comidas y cenas: «variada» (una distinta cada día, hasta donde dé el recetario) o «cocinar para dos días» (cada
//     receta, dos días seguidos; las cenas van un día desplazadas respecto a las comidas, para no cocinar todo el mismo día);
//   · desayunos, medias mañanas y meriendas: dos opciones que se alternan por días;
//   · prioridad a las favoritas y a lo que no salió la semana pasada; la misma receta no sale dos veces el mismo día;
//   · los días sin la comida opcional («hoy sin merienda») se respetan, con las recetas de ese tipo de día.
// La misma entrada da siempre la misma propuesta; «Otra propuesta» cambia el intento.
import { diasDeSemana, paraElDia, tomasDelDia, ordenarTomas, entradaMenu, totalesDia } from '../comidas.js';
import { sumarDias } from '../fechas.js';
import { planVigente, objetivoDelDia } from '../nutricion.js';

export const MODOS_RELLENO = ['variada', 'dos_dias'];
export const NOMBRE_MODO_RELLENO = { variada: 'Variada', dos_dias: 'Cocinar para dos días' };
export const TOMAS_PRINCIPALES = ['comida', 'cena'];
export const OPCIONES_LIGERAS = 2;     // cuántas opciones de desayuno, media mañana o merienda se alternan
export const DESCUADRE_AVISO = 5;      // % de kcal a partir del cual se avisa al coach de que el recetario no cuadra con el plan

// Un generador de números al azar que se puede repetir (mulberry32) y su semilla a partir de un texto
function semilla(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function azar(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clave = (fecha, toma) => `${fecha}|${toma}`;

// Lo común a rellenar y a cambiar una propuesta: los días que se pueden rellenar, lo que ya hay y cuánto se ha usado cada receta
function contexto({ recetario, entradas = [], anteriores = [], diasSin = [], lunes, hoy }) {
  const semana = diasDeSemana(lunes);
  const dias = semana.filter((d) => !hoy || d >= hoy);
  const op = recetario?.opcional || null;
  const sin = new Set(op ? diasSin : []);
  const ocupado = new Map();          // fecha|toma → entradas ya apuntadas
  const delDia = new Map();           // fecha → Set de recetas (ya apuntadas) ese día
  const usadas = new Map();           // receta → cuántas veces esta semana (lo ya apuntado)
  for (const e of entradas) {
    if (!semana.includes(e.fecha)) continue;
    const k = clave(e.fecha, e.toma);
    if (!ocupado.has(k)) ocupado.set(k, []);
    ocupado.get(k).push(e);
    if (e.receta_id) {
      if (!delDia.has(e.fecha)) delDia.set(e.fecha, new Set());
      delDia.get(e.fecha).add(e.receta_id);
      usadas.set(e.receta_id, (usadas.get(e.receta_id) || 0) + 1);
    }
  }
  const previas = new Set(anteriores.filter((e) => e.receta_id).map((e) => e.receta_id));
  const tomas = ordenarTomas(recetario?.tomas || []);
  // Las comidas de un día (sin la opcional, si ese día no la hace) y las recetas que valen ese día
  const tomasDe = (d) => tomasDelDia(tomas, op, sin.has(d), []);
  const candidatas = (d, t) => paraElDia(recetario?.porToma?.[t] || [], !!op && sin.has(d));
  return { semana, dias, op, sin, ocupado, delDia, usadas, previas, tomas, tomasDe, candidatas };
}

// La propuesta de la semana.
//   recetario: lo que devuelve api.recetario (tomas, opcional, porToma con la receta dentro de cada asignación)
//   entradas: el menú que ya tiene esa semana; anteriores: el de la semana anterior (para no repetir)
//   diasSin: los días de la semana sin su comida opcional; lunes: el de la semana; hoy: no se rellenan días pasados
//   modo: 'variada' | 'dos_dias'; intento: 0, 1, 2… («Otra propuesta»); atletaId: para que cada atleta tenga la suya
// Devuelve { propuestas: [{ fecha, toma, asignacion, repite }], dias, sinRecetas: [tomas], huecos, recetas, cocinar }
export function rellenarSemana({ recetario, entradas = [], anteriores = [], diasSin = [], lunes, hoy = null, modo = 'variada', intento = 0, atletaId = '' }) {
  const c = contexto({ recetario, entradas, anteriores, diasSin, lunes, hoy });
  const rnd = azar(semilla(`${atletaId}|${lunes}|${intento}`));
  // Un número al azar fijo por receta, para desempatar (en orden de id, para que sea repetible)
  const rango = new Map();
  for (const id of [...new Set(Object.values(recetario?.porToma || {}).flat().map((a) => a.receta_id))].sort()) rango.set(id, rnd());
  const usadas = new Map(c.usadas);
  const delDia = new Map([...c.delDia].map(([d, s]) => [d, new Set(s)]));
  const propuestas = [];
  const sinRecetas = new Set();
  let huecos = 0;
  const poner = (fecha, toma, asignacion, repite = false) => {
    propuestas.push({ fecha, toma, asignacion, repite });
    usadas.set(asignacion.receta_id, (usadas.get(asignacion.receta_id) || 0) + 1);
    if (!delDia.has(fecha)) delDia.set(fecha, new Set());
    delDia.get(fecha).add(asignacion.receta_id);
  };
  const hueco = (d, t) => c.tomasDe(d).includes(t) && !c.ocupado.has(clave(d, t));
  // De mejor a peor: lo que no está ya ese día, lo menos usado esta semana, lo que no se comió la víspera, lo que no salió la
  // semana pasada, las favoritas y, a igualdad, al azar
  const porOrden = (cand, d) => [...cand].sort((x, y) => (Number(delDia.get(d)?.has(x.receta_id) || false) - Number(delDia.get(d)?.has(y.receta_id) || false))
    || ((usadas.get(x.receta_id) || 0) - (usadas.get(y.receta_id) || 0))
    || (Number(delDia.get(sumarDias(d, -1))?.has(x.receta_id) || false) - Number(delDia.get(sumarDias(d, -1))?.has(y.receta_id) || false))
    || (Number(c.previas.has(x.receta_id)) - Number(c.previas.has(y.receta_id)))
    || (Number(!!y.favorita) - Number(!!x.favorita))
    || (rango.get(x.receta_id) - rango.get(y.receta_id)));

  let principales = 0;
  for (const t of c.tomas) {
    const dias = c.dias.filter((d) => hueco(d, t));
    if (!dias.length) continue;
    huecos += dias.length;
    if (TOMAS_PRINCIPALES.includes(t)) {
      // En «dos días», la segunda comida principal empieza con una receta de un solo día: así las parejas van desplazadas
      let previa = null;
      const suelta = modo === 'dos_dias' && principales > 0;
      principales++;
      let primera = true;
      for (const d of dias) {
        const cand = c.candidatas(d, t);
        if (!cand.length) { sinRecetas.add(t); continue; }
        if (modo === 'dos_dias' && previa && !previa.completa && previa.fecha === sumarDias(d, -1)) {
          const misma = cand.find((a) => a.receta_id === previa.receta) || null;
          if (misma && !delDia.get(d)?.has(misma.receta_id)) { poner(d, t, misma, true); previa.completa = true; continue; }
        }
        const elegida = porOrden(cand, d)[0];
        poner(d, t, elegida);
        previa = { fecha: d, receta: elegida.receta_id, completa: suelta && primera };
        primera = false;
      }
    } else {
      // Dos opciones que se alternan por días; una para los días con la comida opcional y otra para los días sin ella
      const fondos = new Map();
      for (const d of dias) {
        const tipo = c.sin.has(d) ? 'sin' : 'con';
        if (!fondos.has(tipo)) {
          const cand = c.candidatas(d, t);
          // Lo que ya tiene apuntado esa semana en esa comida va primero: se sigue con lo mismo
          const yaEnToma = new Set(entradas.filter((e) => e.toma === t && e.receta_id && c.semana.includes(e.fecha)).map((e) => e.receta_id));
          const orden = [...cand].sort((x, y) => (Number(yaEnToma.has(y.receta_id)) - Number(yaEnToma.has(x.receta_id)))
            || (Number(!!y.favorita) - Number(!!x.favorita))
            || (Number(c.previas.has(x.receta_id)) - Number(c.previas.has(y.receta_id)))
            || (rango.get(x.receta_id) - rango.get(y.receta_id)));
          const vistas = new Set();
          fondos.set(tipo, orden.filter((a) => (vistas.has(a.receta_id) ? false : vistas.add(a.receta_id))).slice(0, OPCIONES_LIGERAS));
        }
        const fondo = fondos.get(tipo);
        if (!fondo.length) { sinRecetas.add(t); continue; }
        poner(d, t, fondo[c.semana.indexOf(d) % fondo.length]);
      }
    }
  }
  propuestas.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : c.tomas.indexOf(x.toma) - c.tomas.indexOf(y.toma)));
  return {
    propuestas, dias: c.dias, sinRecetas: ordenarTomas([...sinRecetas]), huecos,
    recetas: new Set(propuestas.map((p) => p.asignacion.receta_id)).size,
    // cuántas veces hay que cocinar comidas y cenas (lo que repite del día anterior no cuenta)
    cocinar: propuestas.filter((p) => TOMAS_PRINCIPALES.includes(p.toma) && !p.repite).length,
  };
}

// Las otras recetas que valen para un hueco de la propuesta, de mejor a peor (para «Cambiar»): primero lo que no está ya
// ese día ni en el resto de la semana (apuntado o propuesto), luego lo que no salió la pasada, las favoritas y por nombre
export function opcionesDe({ recetario, entradas = [], anteriores = [], diasSin = [], lunes, propuestas = [], fecha, toma }) {
  const c = contexto({ recetario, entradas, anteriores, diasSin, lunes, hoy: null });
  const actual = propuestas.find((p) => p.fecha === fecha && p.toma === toma)?.asignacion?.receta_id || null;
  const usadas = new Map(c.usadas);
  const delDia = new Set(c.delDia.get(fecha) || []);
  for (const p of propuestas) {
    if (p.fecha === fecha && p.toma === toma) continue;
    usadas.set(p.asignacion.receta_id, (usadas.get(p.asignacion.receta_id) || 0) + 1);
    if (p.fecha === fecha) delDia.add(p.asignacion.receta_id);
  }
  return c.candidatas(fecha, toma).filter((a) => a.receta_id !== actual)
    .sort((x, y) => (Number(delDia.has(x.receta_id)) - Number(delDia.has(y.receta_id)))
      || ((usadas.get(x.receta_id) || 0) - (usadas.get(y.receta_id) || 0))
      || (Number(c.previas.has(x.receta_id)) - Number(c.previas.has(y.receta_id)))
      || (Number(!!y.favorita) - Number(!!x.favorita))
      || String(x.receta?.nombre || '').localeCompare(String(y.receta?.nombre || ''), 'es'));
}

// «Cambiar»: la siguiente receta para ese hueco. vistas: las que ya se han enseñado ahí (para pasar por todas antes de
// repetir). Devuelve { propuestas, vistas } (las mismas si no hay otra receta).
export function cambiarPropuesta(datos, { fecha, toma, vistas = [] }) {
  const { propuestas = [] } = datos;
  const i = propuestas.findIndex((p) => p.fecha === fecha && p.toma === toma);
  if (i < 0) return { propuestas, vistas };
  const actual = propuestas[i].asignacion.receta_id;
  const opciones = opcionesDe({ ...datos, fecha, toma });
  if (!opciones.length) return { propuestas, vistas };
  let ya = [...new Set([...vistas, actual])];
  let siguiente = opciones.find((a) => !ya.includes(a.receta_id));
  if (!siguiente) { ya = [actual]; siguiente = opciones[0]; }   // ya han salido todas: se vuelve a empezar
  const nuevas = propuestas.map((p, j) => (j === i ? { ...p, asignacion: siguiente, repite: false } : p));
  return { propuestas: nuevas, vistas: ya };
}

// Las filas que se guardan en menu_comidas (las mismas que crea la app al apuntar una receta a mano)
export function filasDePropuesta(atletaId, propuestas = []) {
  return propuestas.map((p) => ({ ...entradaMenu({ fecha: p.fecha, toma: p.toma, asignacion: p.asignacion, orden: 0 }), atleta_id: atletaId }));
}

// Los totales de cada día con lo ya apuntado y lo propuesto: { [fecha]: { kcal, proteina_g, …, completo } }
// completo: el día tiene algo en todas sus comidas (solo esos días se comparan con el plan)
export function totalesDePropuesta({ recetario, entradas = [], diasSin = [], lunes, propuestas = [] }) {
  const c = contexto({ recetario, entradas, diasSin, lunes, hoy: null });
  const out = {};
  for (const d of c.semana) {
    const filas = [...entradas.filter((e) => e.fecha === d), ...propuestas.filter((p) => p.fecha === d).map((p) => entradaMenu({ fecha: d, toma: p.toma, asignacion: p.asignacion }))];
    const tomas = new Set(filas.map((f) => f.toma));
    out[d] = { ...totalesDia(filas), completo: c.tomasDe(d).length > 0 && c.tomasDe(d).every((t) => tomas.has(t)) };
  }
  return out;
}

// ¿Los días completos se alejan de su plan? { pct, kcal, objetivo, dias } (pct con signo; null si no hay plan o días completos)
export function descuadreDePlan(totales = {}, planes = []) {
  let suma = 0, objetivo = 0, dias = 0;
  for (const [d, t] of Object.entries(totales)) {
    const obj = objetivoDelDia(planVigente(planes, d), true);
    if (!t.completo || !obj?.kcal || t.conDatos < t.total) continue;
    suma += t.kcal; objetivo += obj.kcal; dias++;
  }
  if (!dias) return null;
  return { pct: Math.round(((suma - objetivo) / objetivo) * 1000) / 10, kcal: Math.round(suma / dias), objetivo: Math.round(objetivo / dias), dias };
}

// «12 comidas: 9 recetas distintas, 6 veces de cocinar comidas y cenas»
export function textoPropuesta(r) {
  const n = r?.propuestas?.length || 0;
  if (!n) return 'No hay huecos que rellenar';
  const partes = [`${r.recetas === 1 ? '1 receta' : `${r.recetas} recetas distintas`}`];
  if (r.cocinar) partes.push(`${r.cocinar === 1 ? '1 vez' : `${r.cocinar} veces`} de cocinar comidas y cenas`);
  return `${n === 1 ? '1 comida' : `${n} comidas`}: ${partes.join(', ')}`;
}
