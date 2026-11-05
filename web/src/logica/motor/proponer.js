// «Programar según FBE», pasos 4 y 5: frenar y proponer. Arma la propuesta de la semana siguiente a partir de la
// que el atleta acaba de hacer. Es cálculo puro: con los mismos datos da siempre la misma propuesta, no lee ni
// escribe nada y nunca publica. Cada fila lleva lo que hizo, lo que se propone, el motivo, la confianza, los frenos
// que han actuado y hasta dos alternativas.
//
// Entrada:
//   pautas     [sesion_ejercicios] de la semana hecha       sesiones  [sesiones] de esa semana
//   series     { pauta_id: [series] } lo hecho              ejercicios { id: { nombre, grupos_musculares, tipo } }
//   historial  { pauta_id o ejercicio_id: [{ foco, pauta, series, malDia }] } semanas anteriores, de la más antigua a la más reciente
//   atleta     { nivel, perfil, volumen_objetivo }
//   reglas     { fbe, atleta, bloque, porEjercicio: { ejercicio_id: {…} }, porPauta: { pauta_id: {…} } } capas ya limpias
//   contexto   { checkins, molestias, carga: { ratio }, diasSinEntrenar, focoAnterior, focoSiguiente, semanasDesdeDescarga }
import { seriesPautadasPorGrupo, rangoVolumen, esBarra, NOMBRE_ZONA } from '../calculos.js';
import { resolverReglas, fusionar, modeloDe, esBasico, NOMBRE_MODELO } from './reglas.js';
import { leerEjercicio, tendencia, SIN_DATOS } from './lectura.js';
import { MODELO, CAMPOS, campos, falloLineal } from './modelos.js';
import { compararVolumen } from './volumen.js';
import { senalesDescarga, aplicarDescarga, motivoDescarga, tramoVuelta, aplicarVuelta, motivoVuelta, aplicarMantenimiento, esMalDia, NOMBRE_DESCARGA } from './semana.js';

const RANGO_PRIORIDAD = { alta: 0, media: 1, baja: 2, muy_baja: 3 };
const NIVEL_MOLESTIA = ['sin dolor', 'leve', 'moderada', 'grave'];
const UMBRAL_MOLESTIA = { leve: 1, moderada: 2, grave: 3 };
const ZONA_GRUPOS = {
  hombros: ['deltoides'], pectoral: ['pectoral'], triceps: ['triceps'], espalda_alta: ['espalda'],
  femoral_gluteo: ['isquiotibiales', 'gluteo'], cuadriceps: ['cuadriceps'],
};
// ¿Carga este ejercicio esa zona? Cuenta el músculo como principal o secundario. La zona lumbar no tiene músculo
// equivalente: de partida, bisagras y sentadillas con barra. Aductor y «otra» no se pueden asignar a ejercicios.
export function cargaZona(zona, ejercicio) {
  const grupos = ejercicio?.grupos_musculares || [];
  if (ZONA_GRUPOS[zona]) return ZONA_GRUPOS[zona].some((g) => grupos.includes(g));
  if (zona === 'zona_lumbar') return esBarra(ejercicio?.nombre || '') && ['isquiotibiales', 'gluteo', 'cuadriceps'].includes(grupos[0]);
  return false;
}

const iguales = (a, b) => (a == null && b == null) || (typeof a === 'number' || typeof b === 'number' ? a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005 : JSON.stringify(a) === JSON.stringify(b));
const cambiosDe = (antes, despues) => CAMPOS.filter((c) => !iguales(antes[c], despues[c]));

// Siempre en la escala que quiere el coach (decisión: RPE). No cuenta como cambio de la pauta.
function enEscala(p, escala) {
  // Si una pauta trae las dos cosas manda el RIR, como en el resto de la app
  if (escala === 'rpe' && p.rir_objetivo != null) return { ...p, rpe_objetivo: Math.max(1, Math.min(10, 10 - Number(p.rir_objetivo))), rir_objetivo: null };
  if (escala === 'rir' && p.rpe_objetivo != null && p.rir_objetivo == null && !p.series_detalle) return { ...p, rir_objetivo: Math.max(0, Math.min(10, 10 - Number(p.rpe_objetivo))), rpe_objetivo: null };
  return p;
}
// Tope de RPE (readaptación, vuelta): baja el objetivo si lo pasa. Devuelve [pauta, ¿cambió?]
function conTope(p, rpeMax) {
  if (rpeMax == null) return [p, false];
  let cambio = false;
  const f = { ...p };
  if (f.rpe_objetivo != null && Number(f.rpe_objetivo) > rpeMax) { f.rpe_objetivo = rpeMax; cambio = true; }
  if (f.rir_objetivo != null && Number(f.rir_objetivo) < 10 - rpeMax) { f.rir_objetivo = 10 - rpeMax; cambio = true; }
  if (Array.isArray(f.series_detalle)) {
    f.series_detalle = f.series_detalle.map((x) => { if (x.rpe != null && Number(x.rpe) > rpeMax) { cambio = true; return { ...x, rpe: rpeMax }; } return x; });
  }
  return [f, cambio];
}

function confianzaDe({ modo, l, r, frenos, previa, pendiente, sinHistorial }) {
  if (modo !== 'normal') return 'baja';
  if (r.tipo === 'sin_tocar') return 'alta';
  if (SIN_DATOS.includes(l.diagnostico) || l.banderas.raras.length || sinHistorial) return 'baja';
  if (l.banderas.sinEsfuerzo || l.banderas.otraCarga || l.banderas.malDia || frenos.length || pendiente || r.tipo === 'tope' || (previa && SIN_DATOS.includes(previa.diagnostico))) return 'media';
  return 'alta';
}

export function proponerSemana({ pautas = [], sesiones = [], series = {}, ejercicios = {}, historial = {}, atleta = {}, reglas: capas = {}, contexto = {} } = {}) {
  const generales = resolverReglas({ fbe: capas.fbe, nivel: atleta.nivel, perfil: atleta.perfil, atleta: capas.atleta, bloque: capas.bloque });
  const reglasDe = (p) => resolverReglas({ fbe: capas.fbe, nivel: atleta.nivel, perfil: atleta.perfil, atleta: capas.atleta, bloque: capas.bloque,
    ejercicio: fusionar(capas.porEjercicio?.[p.ejercicio_id], capas.porPauta?.[p.id]) });
  const sesionDe = Object.fromEntries(sesiones.map((s) => [s.id, s]));
  const orden = (p) => [sesionDe[p.sesion_id]?.orden ?? 0, p.orden ?? 0];
  const lista = [...pautas].sort((a, b) => orden(a)[0] - orden(b)[0] || orden(a)[1] - orden(b)[1]);

  // ---- qué tipo de semana toca ----
  const total = sesiones.length, hechas = sesiones.filter((s) => s.completada).length;
  const dias = contexto.diasSinEntrenar ?? null;
  const tramo = dias != null && dias >= generales.frenos.paron ? tramoVuelta(dias, generales) : null;
  const modo = tramo ? 'vuelta' : generales.mantenimiento.activo ? 'mantenimiento' : total > 0 && hechas / total < generales.frenos.semanaAMedias ? 'repetir' : 'normal';
  const retoma = modo === 'normal' && contexto.focoAnterior === 'descarga';
  // Peaking: lo marca el coach con el foco de la semana que se programa
  const pico = modo === 'normal' && contexto.focoSiguiente === 'peaking';
  const ultimoCheckin = [...(contexto.checkins || [])].filter((c) => c?.semana_inicio).sort((a, b) => (a.semana_inicio < b.semana_inicio ? -1 : 1)).pop() || null;
  const umbral = generales.frenos.checkinBajo;
  const checkinBajo = !!ultimoCheckin && ((ultimoCheckin.energia != null && ultimoCheckin.energia <= umbral) || (ultimoCheckin.recuperacion != null && ultimoCheckin.recuperacion <= umbral));
  const molestias = (contexto.molestias || []).filter((m) => Number(m.intensidad) >= 1);

  const filas = lista.map((p) => {
    const ej = ejercicios[p.ejercicio_id] || {};
    const nombre = ej.nombre || '';
    const R = reglasDe(p);
    const { modelo, pedido, pendiente } = modeloDe({ ejercicio: ej, reglas: R });
    // (el historial puede venir por pauta —lo más fino: mismo hueco de la semana— o por ejercicio)
    const normales = (historial[p.id] || historial[p.ejercicio_id] || []).filter((h) => h?.pauta && h.foco !== 'descarga');
    // Tras una descarga se parte de la última semana normal, no de la de descarga
    const base = retoma ? normales[normales.length - 1] || null : { pauta: p, series: series[p.id] || [], malDia: esMalDia(sesionDe[p.sesion_id]) };
    const previas = retoma ? normales.slice(0, -1) : normales;
    const lecturas = previas.map((h) => leerEjercicio({ pauta: h.pauta, series: h.series || [], nombre, reglas: R, malDia: !!h.malDia }));
    const previa = lecturas[lecturas.length - 1] || null;
    const pautaBase = base ? { ...p, ...campos(base.pauta) } : p;
    const l = base ? leerEjercicio({ pauta: pautaBase, series: base.series || [], nombre, reglas: R, malDia: !!base.malDia, ultimaVez: previa?.kgTrabajo || null })
      : leerEjercicio({ pauta: p, series: [], nombre, reglas: R });
    const frenos = [];
    const fila = { pauta_id: p.id, sesion_id: p.sesion_id, ejercicio_id: p.ejercicio_id, ejercicio: nombre, prioridad: p.prioridad || 'media',
      modelo, ...(pendiente ? { modeloPedido: pedido } : {}), diagnostico: l.diagnostico, banderas: l.banderas, hecho: l.texto,
      tendencia: tendencia([...lecturas.map((x) => x.e1rm), l.e1rm], R), antes: campos(p) };

    let r;
    if (modelo === 'a_mano') r = MODELO.a_mano(l, p);
    else if (modo === 'repetir') {
      r = { tipo: 'mantener', propuesta: campos(p), orientativa: null, motivo: `Semana a medias (${hechas} de ${total} sesiones): se repite tal cual`, alternativas: [], avisos: [] };
      frenos.push({ id: 'semana_a_medias', texto: 'Semana a medias' });
    } else if (modo === 'vuelta') {
      r = { tipo: 'vuelta', propuesta: aplicarVuelta(p, tramo, { nombre, reglas: R }), orientativa: null, motivo: motivoVuelta(dias, tramo), alternativas: [{ id: 'mantener', etiqueta: 'Mantener', propuesta: campos(p) }], avisos: [] };
      frenos.push({ id: 'paron', texto: `Parón de ${dias} días` });
    } else if (modo === 'mantenimiento') {
      r = { tipo: 'mantenimiento', propuesta: aplicarMantenimiento(p, { reglas: R }), orientativa: null, motivo: 'Mantenimiento: mismas cargas con menos series', alternativas: [{ id: 'mantener', etiqueta: 'Sin recortar', propuesta: campos(p) }], avisos: [] };
    } else if (retoma && !base) {
      r = { tipo: 'mantener', propuesta: campos(p), orientativa: null, motivo: 'Tras la descarga no hay una semana normal anterior de la que partir: revisa la carga', alternativas: [], avisos: [] };
      frenos.push({ id: 'tras_descarga', texto: 'Tras una descarga, sin semana normal anterior' });
    } else {
      // Fallos seguidos con la misma carga pautada y bajadas ya hechas (lineal); límites de series (triple)
      let fallosPrevios = 0;
      for (let i = previas.length - 1; i >= 0; i--) {
        if (!iguales(previas[i].pauta.carga_sugerida_kg, pautaBase.carga_sugerida_kg) || !falloLineal(lecturas[i])) break;
        fallosPrevios++;
      }
      const cargas = [...previas.map((h) => h.pauta.carga_sugerida_kg), pautaBase.carga_sugerida_kg].filter((x) => x != null).map(Number);
      const bajadasPrevias = cargas.filter((kg, i) => i > 0 && kg < cargas[i - 1]).length;
      const todasLasSeries = [...previas.map((h) => Number(h.pauta.series) || 0), Number(pautaBase.series) || 0].filter((x) => x > 0);
      const seriesMin = R.triple.seriesMin ?? (todasLasSeries.length ? Math.min(...todasLasSeries) : null);
      const seriesMax = R.triple.seriesMax ?? (seriesMin != null ? seriesMin + R.triple.seriesExtra : null);
      r = MODELO[modelo](l, pautaBase, { nombre, reglas: R, previa, fallosPrevios, bajadasPrevias, seriesMin, seriesMax, ejercicio: ej, nivel: atleta.nivel ?? null,
        peaking: pico, topSet: modelo === 'top_set' || (modelo === 'por_serie' && R.topSet.detectar && esBasico(ej)) });
      if (retoma) { r = { ...r, motivo: `Tras la descarga, sigue desde la última semana normal. ${r.motivo}` }; frenos.push({ id: 'tras_descarga', texto: 'Tras una descarga' }); }
      if (pendiente) r = { ...r, avisos: [...r.avisos, `El modelo «${NOMBRE_MODELO[pedido]}» aún no está disponible: se usa «${NOMBRE_MODELO[modelo]}»`] };
      const volver = () => r.alternativas.find((a) => a.id === 'mantener')?.propuesta || campos(pautaBase);
      // Freno: con el check-in bajo no se añaden series
      if (r.tipo === 'series' && checkinBajo) {
        r = { ...r, tipo: 'mantener', propuesta: volver(), motivo: `${r.motivo.split(':')[0]}, pero el check-in viene bajo: no se añade la serie`, alternativas: r.alternativas.filter((a) => a.id !== 'mantener') };
        frenos.push({ id: 'checkin_bajo', texto: 'Check-in bajo: no se añaden series' });
      }
      // Freno (solo si las reglas lo piden; de partida las molestias se avisan y no frenan)
      const desde = UMBRAL_MOLESTIA[R.molestias];
      const duele = desde ? molestias.filter((m) => Number(m.intensidad) >= desde && cargaZona(m.zona, ej)) : [];
      if (duele.length && (r.tipo === 'subir' || r.tipo === 'series')) {
        r = { ...r, tipo: 'mantener', propuesta: volver(), motivo: `${r.motivo.split(':')[0]}, pero hay una molestia ${NIVEL_MOLESTIA[Math.max(...duele.map((m) => Number(m.intensidad)))]} en esa zona: se mantiene`, alternativas: r.alternativas.filter((a) => a.id !== 'mantener') };
        frenos.push({ id: 'molestia', texto: 'Molestia en una zona que carga este ejercicio' });
      }
      if (l.diagnostico === 'pasado') frenos.push({ id: 'pasado_de_esfuerzo', texto: 'Se pasó del esfuerzo pautado' });
      if (l.banderas.raras.length) frenos.push({ id: 'dato_raro', texto: `Serie${l.banderas.raras.length > 1 ? 's' : ''} ${l.banderas.raras.join(', ')}: ¿errata? No se ha${l.banderas.raras.length > 1 ? 'n' : ''} usado` });
      if (l.banderas.malDia && l.diagnostico === 'por_debajo') frenos.push({ id: 'mal_dia', texto: 'Mal día: no cuenta para bajar' });
      if (l.diagnostico === 'sin_registrar') frenos.push({ id: 'sin_registrar', texto: 'Sin registrar' });
      if (l.diagnostico === 'cambiado') frenos.push({ id: 'cambiado', texto: 'Lo cambió por otro ejercicio' });
    }
    const avisos = [...r.avisos.map((texto) => ({ tipo: 'modelo', texto })),
      ...molestias.filter((m) => cargaZona(m.zona, ej)).map((m) => ({ tipo: 'molestia', zona: m.zona, intensidad: Number(m.intensidad), texto: `Molestia ${NIVEL_MOLESTIA[Number(m.intensidad)] || ''} en ${(NOMBRE_ZONA[m.zona] || m.zona).toLowerCase()}`.replace('  ', ' ') }))];
    return { ...fila, _l: l, _r: r, _R: R, _p: p, _previa: previa, _pendiente: pendiente, _sinHistorial: !previas.length && !retoma, frenos, avisos };
  });

  // ---- freno: tope de la semana (series por músculo y series totales) ----
  const seriesDe = (fs) => seriesPautadasPorGrupo(fs.map((f) => ({ ejercicio_id: f.ejercicio_id, series: f._r.propuesta.series })), ejercicios);
  const antes = seriesPautadasPorGrupo(pautas, ejercicios);
  const totalAntes = pautas.reduce((t, p) => t + (Number(p.series) || 0), 0);
  const margen = Math.max(1, Math.floor((totalAntes * generales.semana.maxSeriesPct) / 100));
  const excede = () => {
    const despues = seriesDe(filas);
    const totalDespues = filas.reduce((t, f) => t + (Number(f._r.propuesta.series) || 0), 0);
    if (totalDespues - totalAntes > margen) return true;
    return Object.keys(despues).some((g) => {
      const sube = despues[g] - (antes[g] || 0);
      return sube > generales.semana.maxSeriesPorMusculo || (sube > 0 && despues[g] > rangoVolumen(atleta.volumen_objetivo, g)[1]);
    });
  };
  if (modo === 'normal') {
    const candidatas = filas.filter((f) => f._r.tipo === 'series').sort((a, b) => (RANGO_PRIORIDAD[b.prioridad] ?? 1) - (RANGO_PRIORIDAD[a.prioridad] ?? 1));
    for (const f of candidatas) {
      if (!excede()) break;
      const r = f._r;
      f._r = { ...r, tipo: 'mantener', propuesta: r.alternativas.find((a) => a.id === 'mantener')?.propuesta || campos(f._p),
        motivo: `${r.motivo.split(':')[0]}, pero la semana ya llega a su tope de series: no se añade`, alternativas: r.alternativas.filter((a) => a.id !== 'mantener') };
      f.frenos.push({ id: 'tope_semana', texto: 'Tope de series de la semana' });
    }
  }

  // ---- cerrar cada fila: tope de RPE, escala, cambios, confianza ----
  const cerrar = (f, r) => {
    const R = f._R;
    const frenos = [...f.frenos];
    let [propuesta, topado] = conTope(r.propuesta, r.tipo === 'sin_tocar' ? null : R.rpeMax ?? null);
    if (topado) frenos.push({ id: 'rpe_max', texto: `RPE máximo ${R.rpeMax}` });
    const cambios = cambiosDe(f.antes, propuesta);
    propuesta = r.tipo === 'sin_tocar' ? propuesta : enEscala(propuesta, R.escala);
    const { _l, _r, _R, _p, _previa, _pendiente, _sinHistorial, ...publica } = f;
    return { ...publica, tipo: r.tipo, ...(r.fase ? { fase: r.fase } : {}), propuesta, cambios, cambia: cambios.length > 0, motivo: r.motivo, orientativa: r.orientativa ?? null,
      confianza: confianzaDe({ modo, l: _l, r, frenos, previa: _previa, pendiente: _pendiente, sinHistorial: _sinHistorial }), frenos,
      alternativas: (r.alternativas || []).slice(0, 2).map((a) => ({ ...a, propuesta: r.tipo === 'sin_tocar' ? a.propuesta : enEscala(conTope(a.propuesta, R.rpeMax ?? null)[0], R.escala) })) };
  };
  const normales = filas.map((f) => cerrar(f, f._r));

  // ---- descarga ----
  const senales = modo === 'normal' && !retoma ? senalesDescarga({ filas: filas.map((f) => ({ prioridad: f.prioridad, tendencia: f.tendencia, lectura: f._l })), checkins: contexto.checkins || [], carga: contexto.carga || null, sesiones, reglas: generales }) : [];
  const d = generales.descarga;
  const programada = modo === 'normal' && !retoma && (d.cuando === 'programada' || d.cuando === 'mixta') && contexto.semanasDesdeDescarga != null && contexto.semanasDesdeDescarga >= d.cadaSemanas - 1;
  const pedida = modo === 'normal' && contexto.focoSiguiente === 'descarga';
  const conDescarga = () => filas.map((f) => {
    if (f._r.tipo === 'sin_tocar') return cerrar(f, f._r);
    const tipo = f._R.descarga.tipo;
    return cerrar({ ...f, frenos: [] }, { tipo: 'descarga', propuesta: aplicarDescarga(f._p, { tipo, nombre: f.ejercicio, kgBase: f._l.kgTrabajo, reglas: f._R }), orientativa: null,
      motivo: motivoDescarga(tipo, f._R), alternativas: [{ id: 'mantener', etiqueta: 'Sin descarga', propuesta: campos(f._p) }], avisos: [] });
  });
  const esDescarga = pedida || programada;
  const propuestaDescarga = esDescarga || senales.length ? conDescarga() : null;
  const finales = esDescarga ? propuestaDescarga : normales;

  // ---- el volumen por músculo: solo se enseña y se avisa ----
  const volumenDe = (fs, tipo) => compararVolumen({ antes: pautas, despues: fs.map((f) => ({ ejercicio_id: f.ejercicio_id, series: f.propuesta.series })), ejercicios, objetivo: atleta.volumen_objetivo ?? null, semana: tipo, reglas: generales });

  // ---- la semana de un vistazo ----
  const cuenta = (fs, tipos) => fs.filter((f) => tipos.includes(f.tipo)).length;
  const zonasSueltas = molestias.filter((m) => !ZONA_GRUPOS[m.zona] && m.zona !== 'zona_lumbar');
  return {
    filas: finales,
    semana: {
      tipo: esDescarga ? 'descarga' : modo,
      ...(retoma ? { retoma: true } : {}),
      ...(pico && !esDescarga ? { peaking: finales.filter((f) => f.fase === 'peaking').length } : {}),
      motivo: esDescarga ? (pedida ? 'La semana está marcada como descarga' : `Toca descarga programada (cada ${d.cadaSemanas} semanas)`)
        : modo === 'vuelta' ? `Parón de ${dias} días` : modo === 'repetir' ? `Hizo ${hechas} de ${total} sesiones` : modo === 'mantenimiento' ? 'Mantenimiento activo' : null,
      resumen: {
        suben: cuenta(finales, ['subir', 'series']), mantienen: cuenta(finales, ['reps', 'mantener', 'tope', 'peaking', 'sin_tocar']), bajan: cuenta(finales, ['bajar', 'descarga', 'vuelta', 'mantenimiento']),
        confianza: { alta: finales.filter((f) => f.confianza === 'alta').length, media: finales.filter((f) => f.confianza === 'media').length, baja: finales.filter((f) => f.confianza === 'baja').length },
        seriesPorGrupo: { antes, despues: seriesPautadasPorGrupo(finales.map((f) => ({ ejercicio_id: f.ejercicio_id, series: f.propuesta.series })), ejercicios) },
      },
      volumen: volumenDe(finales, esDescarga ? 'descarga' : modo),
      avisos: zonasSueltas.map((m) => ({ tipo: 'molestia', zona: m.zona, intensidad: Number(m.intensidad), texto: `Molestia ${NIVEL_MOLESTIA[Number(m.intensidad)] || ''} en ${(NOMBRE_ZONA[m.zona] || m.zona).toLowerCase()}: no se puede asignar a ejercicios concretos` })),
    },
    descarga: {
      senales, propuesta: !esDescarga && senales.length >= 1, recomendada: !esDescarga && senales.length >= 2,
      tipo: NOMBRE_DESCARGA[d.tipo] ? d.tipo : 'ligera',
      filas: esDescarga ? null : propuestaDescarga,
      ...(!esDescarga && propuestaDescarga ? { volumen: volumenDe(propuestaDescarga, 'descarga') } : {}),
    },
    ...(esDescarga ? { sinDescarga: normales } : {}),
  };
}

