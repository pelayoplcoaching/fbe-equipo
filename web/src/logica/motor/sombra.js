// «Programar según FBE»: la prueba en sombra, repetible. Compara lo que propone el motor para una semana con lo que
// el coach programó de verdad, sobre una copia completa de la app (la que se descarga desde Cuenta). Lógica pura: no
// lee ni escribe nada.
//
// Por cada atleta y cada par de semanas seguidas de un bloque (la primera con series registradas, la segunda con
// pautas), el motor propone la segunda a partir de la primera, igual que en el editor, y se compara serie a serie:
//   dirección  ¿hace lo mismo que el coach con esa serie respecto a lo que se hizo? (más kilos, más repeticiones,
//              igual o baja)
//   idéntica   ¿deja la serie con los mismos kilos y las mismas repeticiones que el coach?
// El informe solo lleva cifras agregadas y los ids de los atletas (nunca nombres): se puede enseñar y guardar. La
// copia lleva datos de salud: se queda donde esté, fuera del repositorio.
import { cargaBackoff, esTopBackoff, tieneDetalle, enReserva, num } from '../calculos.js';
import { sumarDias } from '../fechas.js';
import { proponerSemana } from './proponer.js';
import { entradaDesdeBloque, pautasDeSemana, emparejar } from './adaptador.js';
import { limpiarReglas } from './reglas.js';

export const CLASES = ['sube_kilos', 'sube_reps', 'igual', 'baja'];
export const NOMBRE_CLASE = { sube_kilos: 'Más kilos', sube_reps: 'Más repeticiones', igual: 'Igual', baja: 'Baja' };
const TIPO_A_CLASE = { subir: 'sube_kilos', series: 'sube_reps', reps: 'sube_reps', bajar: 'baja', descarga: 'baja', vuelta: 'baja', mantenimiento: 'baja', peaking: 'baja' };

const numero = (v) => (v == null || v === '' ? null : Number(v));
const pct = (a, b) => (b > 0 ? Math.round((1000 * a) / b) / 10 : null);

// Lo pautado, serie a serie: el detalle si lo hay; si no, tantas series como diga la pauta con el tope del rango y
// la carga (con top + back-off, las back-off llevan su % menos)
export function seriesPautadas(p, nombre = '') {
  if (!p) return [];
  if (tieneDetalle(p)) return p.series_detalle.map((x) => ({ reps: numero(x.reps), kg: numero(x.kg) }));
  const n = Math.max(1, Number(p.series) || 1), reps = numero(p.reps_max ?? p.reps_min), kg = numero(p.carga_sugerida_kg);
  return Array.from({ length: n }, (_, i) => ({ reps, kg: i > 0 && esTopBackoff(p) && kg != null ? cargaBackoff(kg, p.backoff_pct, nombre) ?? kg : kg }));
}

// Qué le pasa a una serie respecto a lo que se hizo en ella. Sin kilos pautados solo cuentan las repeticiones.
export function claseDeSerie(objetivo, hecha) {
  const kg = Number(hecha.kg) || 0, reps = Number(hecha.reps) || 0;
  if (objetivo.kg != null && kg > 0) {
    if (objetivo.kg > kg + 0.01) return 'sube_kilos';
    if (objetivo.kg < kg - 0.01) return 'baja';
  }
  if (objetivo.reps == null) return 'igual';
  return objetivo.reps > reps ? 'sube_reps' : objetivo.reps < reps ? 'baja' : 'igual';
}

const mismaSerie = (a, b) => !!a && !!b && a.reps === b.reps && ((a.kg == null && b.kg == null) || (a.kg != null && b.kg != null && Math.abs(a.kg - b.kg) < 0.01));

// Una fila del motor frente a la pauta que programó el coach para ese mismo hueco.
//   hechas: las series registradas en la semana de la que se parte
// Devuelve { series: [{ numero, conKilos, coach, motor, identica, hecha, pautado, propuesto }], pautaIdentica } o null si
// no hay nada que comparar (sin series hechas o sin repeticiones pautadas).
export function compararFila({ fila, real, hechas = [], nombre = '' }) {
  const propias = (hechas || []).filter((s) => !s.sustituto_id && Number(s.reps) > 0);
  if (!real || !propias.length) return null;
  const porNumero = Object.fromEntries(propias.map((s) => [Number(s.numero), s]));
  const coach = seriesPautadas(real, nombre), motor = seriesPautadas(fila.propuesta, nombre);
  // Si la propuesta no es serie a serie, sus repeticiones son el tope de un rango, no un objetivo: vale el tipo de la fila
  const porTipo = !tieneDetalle(fila.propuesta);
  const series = [];
  coach.forEach((o, i) => {
    const h = porNumero[i + 1];
    if (!h || o.reps == null) return;
    const m = motor[i] || null;
    series.push({ numero: i + 1, conKilos: o.kg != null && Number(h.kg) > 0, coach: claseDeSerie(o, h), motor: porTipo || !m ? TIPO_A_CLASE[fila.tipo] || 'igual' : claseDeSerie(m, h),
      identica: mismaSerie(o, m), hecha: { kg: Number(h.kg) || 0, reps: Number(h.reps), rpe: enReserva(h) == null ? null : 10 - enReserva(h) }, pautado: o, propuesto: m });
  });
  if (!series.length) return null;
  return { series, pautaIdentica: coach.length === motor.length && coach.every((o, i) => mismaSerie(o, motor[i])) };
}

// El bloque como lo carga el editor (api.bloqueCompleto), sacado de la copia
function bloqueDeCopia(copia, bloque, indices) {
  const semanas = (indices.semanas[bloque.id] || []).slice().sort((a, b) => a.numero - b.numero);
  const sesiones = {}, pautas = {}, series = {};
  for (const w of semanas) {
    sesiones[w.id] = indices.sesiones[w.id] || [];
    for (const s of sesiones[w.id]) {
      pautas[s.id] = indices.pautas[s.id] || [];
      for (const p of pautas[s.id]) series[p.id] = indices.series[p.id] || [];
    }
  }
  return { bloque, semanas, sesiones, pautas, series };
}
const agrupar = (lista, clave) => (lista || []).reduce((m, x) => { (m[x[clave]] ||= []).push(x); return m; }, {});
const tieneSeries = (d, w) => (d.sesiones[w.id] || []).some((s) => (d.pautas[s.id] || []).some((p) => (d.series[p.id] || []).some((x) => !x.sustituto_id && Number(x.reps) > 0)));
const tienePautas = (d, w) => (d.sesiones[w.id] || []).some((s) => (d.pautas[s.id] || []).length > 0);

const vacio = () => ({ series: 0, direccion: 0, identicas: 0 });
const sumar = (t, s) => { t.series++; if (s.coach === s.motor) t.direccion++; if (s.identica) t.identicas++; };
const conPct = (t) => ({ ...t, direccionPct: pct(t.direccion, t.series), identicasPct: pct(t.identicas, t.series) });
const tipoDe = (ej) => { const t = Array.isArray(ej?.tipo) ? ej.tipo : []; return t.includes('basico') ? 'basico' : t[0] === 'aislamiento' ? 'aislamiento' : 'multiarticular'; };

// La prueba entera sobre una copia completa.
//   reglas: capas { fbe, atleta, bloque, porEjercicio } (se limpian aquí) · soloAtletas: ids, para acotar
//   ejemplos: cuántas diferencias de muestra guardar (sin nombres de atletas)
export function sombraDeCopia(copia, { reglas = {}, soloAtletas = null, ejemplos = 0 } = {}) {
  const capas = Object.fromEntries(['fbe', 'atleta', 'bloque'].filter((k) => reglas[k]).map((k) => [k, limpiarReglas(reglas[k]).reglas]));
  if (reglas.porEjercicio) capas.porEjercicio = Object.fromEntries(Object.entries(reglas.porEjercicio).map(([k, v]) => [k, limpiarReglas(v).reglas]));
  const ejercicios = Object.fromEntries((copia.ejercicios || []).map((e) => [e.id, e]));
  const indices = { semanas: agrupar(copia.semanas, 'bloque_id'), sesiones: agrupar(copia.sesiones, 'semana_id'), pautas: agrupar(copia.sesion_ejercicios, 'sesion_id'), series: agrupar(copia.series, 'sesion_ejercicio_id') };
  const checkins = agrupar(copia.checkins, 'atleta_id'), molestias = agrupar(copia.molestias, 'atleta_id');
  const total = vacio(), conKilos = vacio(), sinKilos = vacio();
  const cortes = { nivel: {}, tipo: {}, prioridad: {}, confianza: {}, modelo: {}, foco: {} };
  const matriz = Object.fromEntries(CLASES.map((c) => [c, Object.fromEntries(CLASES.map((m) => [m, 0]))]));
  const patrones = {}, muestras = [], atletas = [];
  const pares = { comparados: 0, descarga: 0, noNormal: 0, sinPareja: 0, tipos: {} };
  const ej = { comparados: 0, direccion: 0, identicos: 0, sinPareja: 0, sinDatos: 0 };

  for (const at of copia.atletas || []) {
    if (soloAtletas && !soloAtletas.includes(at.id)) continue;
    const suyo = vacio();
    let paresSuyos = 0;
    for (const bloque of (copia.bloques || []).filter((b) => b.atleta_id === at.id && !b.es_plantilla)) {
      const d = bloqueDeCopia(copia, bloque, indices);
      for (let i = 0; i + 1 < d.semanas.length; i++) {
        const base = d.semanas[i], destino = d.semanas[i + 1];
        if (destino.numero !== base.numero + 1 || !tieneSeries(d, base) || !tienePautas(d, destino)) { pares.sinPareja++; continue; }
        if (base.foco === 'descarga' || destino.foco === 'descarga') { pares.descarga++; continue; }
        // Se mira como se habría visto al programar: solo lo anterior a la semana de destino, y «hoy» es su lunes
        const antes = { ...d, semanas: d.semanas.filter((w) => w.numero <= base.numero) };
        const hoy = destino.fecha_inicio || (base.fecha_inicio ? sumarDias(base.fecha_inicio, 7) : undefined);
        const entrada = entradaDesdeBloque({ d: antes, base, destino, ejercicios, atleta: { nivel: at.nivel ?? null, volumen_objetivo: at.volumen_objetivo ?? null }, reglas: capas,
          checkins: checkins[at.id] || [], molestias: molestias[at.id] || [], ...(hoy ? { hoy } : {}) });
        const r = proponerSemana(entrada);
        pares.tipos[r.semana.tipo] = (pares.tipos[r.semana.tipo] || 0) + 1;
        if (r.semana.tipo !== 'normal') { pares.noNormal++; continue; }
        const dest = pautasDeSemana(d, destino);
        const parejas = emparejar(entrada.pautas, entrada.sesiones, dest.pautas, dest.sesiones);
        pares.comparados++; paresSuyos++;
        for (const fila of r.filas) {
          const real = parejas[fila.pauta_id] || null;
          if (!real) { ej.sinPareja++; continue; }
          const c = compararFila({ fila, real, hechas: entrada.series[fila.pauta_id], nombre: fila.ejercicio });
          if (!c) { ej.sinDatos++; continue; }
          ej.comparados++;
          if (c.pautaIdentica) ej.identicos++;
          if (c.series.every((s) => s.coach === s.motor)) ej.direccion++;
          const e = ejercicios[fila.ejercicio_id];
          for (const s of c.series) {
            sumar(total, s); sumar(s.conKilos ? conKilos : sinKilos, s); sumar(suyo, s);
            const claves = { nivel: at.nivel || 'sin nivel', tipo: tipoDe(e), prioridad: fila.prioridad, confianza: fila.confianza, modelo: fila.modelo, foco: destino.foco || 'sin foco' };
            for (const [corte, clave] of Object.entries(claves)) sumar((cortes[corte][clave] ||= vacio()), s);
            matriz[s.coach][s.motor]++;
            if (s.coach !== s.motor) {
              const clave = `${claves.tipo}|${s.coach}|${s.motor}`;
              (patrones[clave] ||= { tipo: claves.tipo, coach: s.coach, motor: s.motor, series: 0 }).series++;
              if (muestras.length < ejemplos) muestras.push({ ejercicio: fila.ejercicio, tipo: claves.tipo, nivel: claves.nivel, serie: s.numero, hecha: s.hecha, coach: s.pautado, motor: s.propuesto, clases: [s.coach, s.motor], motivo: fila.motivo });
            }
          }
        }
      }
    }
    if (suyo.series) atletas.push({ id: at.id, nivel: at.nivel || null, pares: paresSuyos, ...conPct(suyo) });
  }
  const cortar = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1].series - a[1].series).map(([k, v]) => [k, conPct(v)]));
  return {
    exportado_en: copia.exportado_en || null,
    pares, ejercicios: { ...ej, direccionPct: pct(ej.direccion, ej.comparados), identicosPct: pct(ej.identicos, ej.comparados) },
    series: conPct(total), conKilos: conPct(conKilos), sinKilos: conPct(sinKilos),
    cortes: Object.fromEntries(Object.entries(cortes).map(([k, v]) => [k, cortar(v)])),
    matriz,
    diferencias: Object.values(patrones).sort((a, b) => b.series - a.series),
    atletas: atletas.sort((a, b) => b.series - a.series),
    ...(ejemplos ? { ejemplos: muestras } : {}),
  };
}

// Dos informes de la misma copia (por ejemplo, con dos juegos de reglas): cuánto cambia cada cifra, en puntos
export function compararInformes(a, b) {
  const dif = (x, y) => (x == null || y == null ? null : Math.round((y - x) * 10) / 10);
  const fila = (x, y) => ({ series: [x?.series ?? 0, y?.series ?? 0], direccion: [x?.direccionPct ?? null, y?.direccionPct ?? null, dif(x?.direccionPct, y?.direccionPct)], identicas: [x?.identicasPct ?? null, y?.identicasPct ?? null, dif(x?.identicasPct, y?.identicasPct)] });
  const cortes = {};
  for (const corte of Object.keys(a.cortes)) {
    cortes[corte] = {};
    for (const clave of new Set([...Object.keys(a.cortes[corte]), ...Object.keys(b.cortes[corte] || {})])) cortes[corte][clave] = fila(a.cortes[corte][clave], b.cortes[corte]?.[clave]);
  }
  return { series: fila(a.series, b.series), conKilos: fila(a.conKilos, b.conKilos), sinKilos: fila(a.sinKilos, b.sinKilos), cortes };
}

const NOMBRES = {
  nivel: { novato: 'Novato', novato_intermedio: 'Novato/intermedio', intermedio: 'Intermedio', avanzado: 'Avanzado' },
  tipo: { basico: 'Básicos', multiarticular: 'Multiarticulares', aislamiento: 'Aislamiento' },
  prioridad: { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja', muy_baja: 'Prioridad muy baja' },
  confianza: { alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja' },
};
const TITULOS = { nivel: 'Por nivel del atleta', tipo: 'Por tipo de ejercicio', prioridad: 'Por prioridad del ejercicio', confianza: 'Por confianza de la propuesta', modelo: 'Por modelo', foco: 'Por foco de la semana programada' };
const p100 = (x) => (x == null ? '—' : `${num(x, 1)} %`);

// El informe en texto, para leerlo o pegarlo. nombres: { id del atleta: nombre } solo si se quiere ver quién es quién
// (no guardar esa salida en sitios compartidos).
export function textoInforme(inf, { nombres = null, otro = null } = {}) {
  const L = [];
  const fila = (etiqueta, t) => `  ${etiqueta.padEnd(28)} ${String(t.series).padStart(5)} series · dirección ${p100(t.direccionPct).padStart(7)} · idéntica ${p100(t.identicasPct).padStart(7)}`;
  L.push('Prueba en sombra del motor «Programar según FBE»', inf.exportado_en ? `Copia del ${String(inf.exportado_en).slice(0, 10)}` : '', '');
  L.push(`Semanas comparadas: ${inf.pares.comparados} (de ${inf.atletas.length} atletas). Fuera: ${inf.pares.descarga} con descarga, ${inf.pares.noNormal} que el motor trata como vuelta, repetición o mantenimiento.`);
  L.push(`Ejercicios comparados: ${inf.ejercicios.comparados} · misma dirección en todas sus series ${p100(inf.ejercicios.direccionPct)} · pauta idéntica ${p100(inf.ejercicios.identicosPct)}`, '');
  L.push(fila('Todas las series', inf.series), fila('Donde el coach pauta kilos', inf.conKilos), fila('Donde no pauta kilos', inf.sinKilos));
  for (const [corte, titulo] of Object.entries(TITULOS)) {
    if (!Object.keys(inf.cortes[corte] || {}).length) continue;
    L.push('', titulo);
    for (const [clave, t] of Object.entries(inf.cortes[corte])) L.push(fila(NOMBRES[corte]?.[clave] || clave, t));
  }
  L.push('', 'Qué hizo el coach con cada serie (filas) y qué propone el motor (columnas)');
  L.push(`  ${''.padEnd(18)}${CLASES.map((c) => NOMBRE_CLASE[c].padStart(18)).join('')}`);
  for (const c of CLASES) L.push(`  ${NOMBRE_CLASE[c].padEnd(18)}${CLASES.map((m) => String(inf.matriz[c][m]).padStart(18)).join('')}`);
  if (inf.diferencias.length) {
    L.push('', 'Dónde no coinciden (las diez más frecuentes)');
    for (const x of inf.diferencias.slice(0, 10)) L.push(`  ${String(x.series).padStart(4)} series · ${NOMBRES.tipo[x.tipo]}: el coach «${NOMBRE_CLASE[x.coach].toLowerCase()}», el motor «${NOMBRE_CLASE[x.motor].toLowerCase()}»`);
  }
  L.push('', 'Por atleta');
  inf.atletas.forEach((a, i) => L.push(fila(`${nombres?.[a.id] || `Atleta ${i + 1}`} (${NOMBRES.nivel[a.nivel] || 'sin nivel'})`.slice(0, 28), a)));
  if (otro) {
    const c = compararInformes(inf, otro);
    const signo = (x) => (x == null ? '—' : `${x > 0 ? '+' : ''}${num(x, 1)}`);
    L.push('', 'Con las otras reglas (puntos de diferencia)');
    const f2 = (etiqueta, x) => `  ${etiqueta.padEnd(28)} dirección ${p100(x.direccion[0]).padStart(7)} → ${p100(x.direccion[1]).padStart(7)} (${signo(x.direccion[2])}) · idéntica ${p100(x.identicas[0]).padStart(7)} → ${p100(x.identicas[1]).padStart(7)} (${signo(x.identicas[2])})`;
    L.push(f2('Todas las series', c.series), f2('Donde el coach pauta kilos', c.conKilos));
    for (const corte of ['nivel', 'tipo']) for (const [clave, x] of Object.entries(c.cortes[corte])) L.push(f2(NOMBRES[corte]?.[clave] || clave, x));
  }
  if (inf.ejemplos?.length) {
    const s = (x) => (x ? `${x.reps ?? '–'}×${x.kg ?? '–'}` : '—');
    L.push('', 'Ejemplos de diferencias');
    for (const x of inf.ejemplos) L.push(`  ${x.ejercicio} (${NOMBRES.nivel[x.nivel] || x.nivel}), serie ${x.serie}: hizo ${x.hecha.reps}×${x.hecha.kg}${x.hecha.rpe != null ? ` @${num(x.hecha.rpe)}` : ''} · coach ${s(x.coach)} · motor ${s(x.motor)}`);
  }
  return L.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
}
