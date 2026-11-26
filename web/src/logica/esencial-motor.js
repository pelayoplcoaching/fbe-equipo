// FBE Esencial (tanda 3): la propuesta del motor para la semana siguiente de quien va por su cuenta, lista para guardar.
// Lógica pura (sin base de datos); se carga solo cuando hace falta (con el motor entero). La usa api.prepararSemanaEsencial.
import { proponerSemana, entradaDesdeBloque, pautasDeSemana, paraElMotor, leerGuardadas, notaDeSemana, claseParaNota, emparejar, saltoDe } from './motor/index.js';
import { reglasVueltaEsencial, segundaSemanaVuelta } from './constancia.js';
import { semanaDesdePropuesta, planchaDeLaSemana, planchaEnTope, estancado, kilosBajada, planchaBajada, ESTANCADO } from './esencial-semana.js';
import { num } from './calculos.js';
import { estadoZonas } from './dolor.js';
import { frenosSemana, notaFrenos, zonasAjustadas, textoFreno, textoVuelta, USO } from './dolor-sesion.js';
import { cargaDe } from './zonas-ejercicio.js';
import { consejoPreparacion } from './preparacion.js';

// ---------- (v0.259, D9, P: 'descarga_senales') Una descarga por señales, si llega antes que la de su plantilla ----------
// Dos semanas seguidas (la que acaba y la anterior) con la mitad o más de sus sesiones contestadas en «regular» o «mal» (o
// día flojo o difícil de las tres preguntas) y las marcas cayendo: dos o más de sus ejercicios principales (los básicos, los
// multiarticulares o lo obligatorio) con la tendencia a la baja. (Qué es «las marcas cayendo», criterio de Claude.)
// → null o { bajan: [nombres] }
const d10 = (x) => String(x || '').slice(0, 10);
const restaDias = (iso, n) => { const t = new Date(`${iso}T12:00:00Z`); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10); };
export function descargaPorSenales({ d, base, filas = [], ejercicios = {} }) {
  if (!base?.fecha_inicio || base.foco === 'descarga') return null;
  const antes = (d.semanas || []).find((w) => d10(w.fecha_inicio) === restaDias(d10(base.fecha_inicio), 7));
  if (!antes || antes.foco === 'descarga') return null;
  const flojas = (w) => {
    const xs = (d.sesiones?.[w.id] || []).filter((s) => s.completada && consejoPreparacion(s.preparacion));
    return xs.length > 0 && xs.filter((s) => consejoPreparacion(s.preparacion).nivel !== 'bien').length / xs.length >= 0.5;
  };
  if (!flojas(base) || !flojas(antes)) return null;
  const principal = (f) => { const t = ejercicios[f.ejercicio_id]?.tipo || []; return f.prioridad === 'alta' || t.includes('basico') || t.includes('multiarticular'); };
  const bajan = [...new Set((filas || []).filter((f) => principal(f) && f.tendencia === 'bajando').map((f) => f.ejercicio || ejercicios[f.ejercicio_id]?.nombre || ''))].filter(Boolean);
  return bajan.length >= 2 ? { bajan } : null;
}
export const notaDescargaSenales = (ds) => `Llevas dos semanas llegando regular o mal a tus sesiones y tus marcas bajan (${ds.bajan.map((n) => n.toLowerCase()).join(', ')}): esta semana toca descarga, antes de la que venía en tu plan.`;

// Lo que cambia en la plancha, para la nota: «5 segundos más: de 40 a 50» o «con peso: 5 kg encima y otra vez de 35 a 45
// segundos».
function frasePlancha(antes, nueva) {
  const kgA = Number(antes.carga_sugerida_kg) || 0, kgN = Number(nueva.carga_sugerida_kg) || 0;
  if (kgN > kgA) return `${kgA ? `${num(kgN - kgA)} kg más (${num(kgN)} kg)` : `con peso: ${num(kgN)} kg encima`} y otra vez de ${nueva.reps_min} a ${nueva.reps_max} segundos`;
  return `${nueva.reps_max - Number(antes.reps_max)} segundos más: de ${nueva.reps_min} a ${nueva.reps_max}`;
}
const unir = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

// (Pelayo, 25/11) Las pautas de cada ejercicio en las semanas anteriores del bloque, de la más antigua a la semana hecha:
// { id de la pauta de la semana hecha: [pauta de hace 2 semanas, de hace 1, la de la semana hecha] } (solo las que hay)
function historiaDe(d, base, sesiones, pautas, n = ESTANCADO.semanas) {
  const previas = (d.semanas || []).filter((w) => w.bloque_id === base.bloque_id && w.numero < base.numero && w.programacion === 'programada')
    .sort((a, b) => b.numero - a.numero).slice(0, n - 1);
  const h = Object.fromEntries(pautas.map((p) => [p.id, [p]]));
  for (const w of previas) {   // (de la más reciente a la más antigua: cada una, delante)
    const prev = pautasDeSemana(d, w);
    const pares = emparejar(pautas, sesiones, prev.pautas, prev.sesiones);
    for (const p of pautas) if (pares[p.id] && h[p.id].length === base.numero - w.numero) h[p.id].unshift(pares[p.id]);
  }
  return h;
}

// (099) Cuántos ejercicios de esa semana llevan tres semanas con la misma pauta (sin conseguir subir): con dos o más, la
// app propone cambiar de rutina (Pelayo, 25/11: «salvo que se produzca un estancamiento durante 3 semanas»)
export function estancadosDe(d, base) {
  if (!d || !base) return 0;
  const { sesiones, pautas } = pautasDeSemana(d, base);
  const h = historiaDe(d, base, sesiones, pautas);
  return pautas.filter((p) => estancado(h[p.id])).length;
}
// (v0.247) …y cuáles son (sus ids, sin repetir)
export function estancadosIds(d, base) {
  if (!d || !base) return [];
  const { sesiones, pautas } = pautasDeSemana(d, base);
  const h = historiaDe(d, base, sesiones, pautas);
  return [...new Set(pautas.filter((p) => estancado(h[p.id])).map((p) => p.ejercicio_id))];
}

// d: api.bloqueCompleto del bloque de la semana hecha; base: esa semana; tipo: 'novato' (tras «Primeras 4 semanas») o
// 'siguiente'; ejercicios: { id: ejercicio }; atleta: su fila (nivel, volumen_objetivo, reglas_motor); checkins y
// molestias: las suyas.
// Devuelve { sesiones, nota, descarga, preguntas: [{ pauta_id, ejercicio_id, texto, series: [{ numero, kg, reps }] }] }.
// (v0.247, P: APAGADO hasta que Pelayo lo decida; sin `extras` no cambia nada) extras.molestiaFrena: con una molestia
// moderada o grave en la zona, los ejercicios que la cargan no suben de peso ni suman series (la regla `molestias` del
// motor, que de serie solo avisa; sumar repeticiones con el mismo peso, sí); extras.conservar ('suave' | 'duras'): tras una semana que pidió suave, o con sus dos últimas sesiones a 9 o
// más, la semana siguiente repite la carga tal cual (ni sube ni baja). Solo en una semana normal, fuera de las cuatro
// primeras.
// (v0.257, P: 'molestias_zona') extras.zonasDolor ({ registros, checkins, hoy }): el motor de molestias en la semana (M6 y el
// ámbar de M7, con la tabla de zonas de M8): con una zona en ámbar o rojo, o que va a peor, los ejercicios que la cargan no
// suben de carga ni de series; y lo que bajó por el ajuste de la mañana siguiente (M5) vuelve a lo de antes.
export const NOTA_CONSERVAR = {
  suave: 'La semana pasada la pediste suave: esta repites la carga de antes, sin subir ni bajar nada.',
  duras: 'Tus dos últimas sesiones fueron muy duras: esta semana repites la carga, sin subir, para recuperarte.',
  // (v0.260, C2, P: 'vuelta_esencial') después de más de 4 semanas parado, la vuelta dura dos semanas: la segunda repite la carga
  vuelta2: 'Segunda semana de tu vuelta: repites la carga de la semana pasada, sin subir. La que viene, la app vuelve a subir.',
};
const FRENO_CONSERVAR = { suave: 'suave', duras: 'dos_duras', vuelta2: 'vuelta_dos' };
export function propuestaEsencial({ d, base, tipo = 'siguiente', ejercicios = {}, atleta = {}, checkins = [], molestias = [], hoy, extras = null }) {
  const guardadas = paraElMotor(leerGuardadas(atleta?.reglas_motor ?? null));
  // (las reglas van por capas: la del atleta manda sobre las de FBE; si Pelayo ya le hubiera puesto la suya, se respeta)
  let suyas = extras?.molestiaFrena
    ? { ...guardadas, reglas: { ...guardadas.reglas, atleta: { ...(guardadas.reglas?.atleta || {}), molestias: guardadas.reglas?.atleta?.molestias ?? 'moderada' } } }
    : guardadas;
  // (v0.260, C2, P: 'vuelta_esencial') la vuelta tras un parón con la escala de Pelayo: desde 2 semanas parado, una serie menos
  // y un 10 % menos; desde más de 4, un 20 % menos (y la semana siguiente, otra de vuelta: repite la carga)
  if (extras?.vueltaEsencial) suyas = { ...suyas, reglas: reglasVueltaEsencial(suyas.reglas || {}) };
  const entrada = entradaDesdeBloque({
    d, base, destino: null, ejercicios, hoy, checkins, molestias, reglas: suyas.reglas,
    atleta: { nivel: atleta?.nivel ?? 'novato', perfil: suyas.perfil, volumen_objetivo: atleta?.volumen_objetivo ?? null, modalidad: 'por_su_cuenta' },
  });
  let r = proponerSemana(entrada);
  // (v0.259, D9) dos semanas llegando regular o mal y las marcas cayendo: esta semana, descarga (como si la semana viniera
  // marcada como descarga: la hace el motor con sus reglas de siempre)
  const ds = extras?.descargaSenales && tipo !== 'novato' && (r.semana?.tipo || 'normal') === 'normal'
    ? descargaPorSenales({ d, base, filas: r.filas || [], ejercicios }) : null;
  if (ds) r = proponerSemana(entradaDesdeBloque({ d, base, destino: { foco: 'descarga' }, ejercicios, hoy, checkins, molestias, reglas: suyas.reglas,
    atleta: { nivel: atleta?.nivel ?? 'novato', perfil: suyas.perfil, volumen_objetivo: atleta?.volumen_objetivo ?? null, modalidad: 'por_su_cuenta' } }));
  const descarga = r.semana?.tipo === 'descarga';
  const pares = Object.fromEntries((r.filas || []).map((f) => [f.pauta_id, f]));
  const { sesiones, pautas } = pautasDeSemana(d, base);
  const porSesion = {};
  for (const p of pautas) (porSesion[p.sesion_id] ||= []).push(p);
  // (la plancha sube con su regla solo en una semana normal: ni descarga, ni a medias, ni tras un parón)
  const normal = !descarga && (r.semana?.tipo || 'normal') === 'normal';
  const hechas = entrada.series || {};
  const soloKilos = tipo === 'novato';
  const conservar = extras?.conservar || (extras?.vueltaEsencial && !soloKilos && normal && segundaSemanaVuelta({ d, base }) ? 'vuelta2' : null);
  if (NOTA_CONSERVAR[conservar] && !soloKilos && normal) {
    const freno = FRENO_CONSERVAR[conservar] || 'dos_duras';
    const igual = semanaDesdePropuesta({ sesiones, pautas: porSesion, pares: {}, soloKilos, ejercicios, hechas, normal: false, alternativas: atleta?.esencial_alternativas || {} });
    const campos = (x) => ({ kg: x.carga_sugerida_kg != null ? Number(x.carga_sugerida_kg) : null, min: x.reps_min ?? null, max: x.reps_max ?? null, series: x.series ?? null });
    const porque = [];
    [...sesiones].sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0)).forEach((ses, i) => {
      [...(porSesion[ses.id] || [])].sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0)).forEach((p, j) => {
        const nueva = igual[i]?.pautas?.[j] || null;
        const ej = ejercicios[p.ejercicio_id] || {};
        porque.push({
          sesion: i, sesion_nombre: ses.nombre || '', ejercicio_id: p.ejercicio_id, nuevo_id: nueva?.ejercicio_id ?? null, nombre: ej.nombre || '', por_tiempo: !!ej.por_tiempo,
          tipo: 'mantener', diagnostico: pares[p.id]?.diagnostico || null, frenos: [freno], mal_dia: false, molestia: false, semana: 'normal', novato: false, estancado: false,
          hecho: [...(hechas[p.id] || [])].filter((x) => Number(x.reps) > 0 && !x.sustituto_id).sort((x, y) => (Number(x.numero) || 0) - (Number(y.numero) || 0))
            .map((x) => ({ kg: Number(x.kg) > 0 ? Number(x.kg) : null, reps: Number(x.reps), rpe: x.rpe != null ? Number(x.rpe) : null })),
          antes: campos(p), despues: nueva ? campos(nueva) : null,
        });
      });
    });
    return { sesiones: igual, nota: NOTA_CONSERVAR[conservar], descarga: false, preguntas: [], porque, semana: 'normal', conservada: conservar };
  }
  const semana = semanaDesdePropuesta({ sesiones, pautas: porSesion, pares, soloKilos, ejercicios, hechas, normal, alternativas: atleta?.esencial_alternativas || {} });
  // (Pelayo, 25/11) Si un ejercicio lleva tres semanas igual y el motor vuelve a proponer lo mismo: un 10 % menos para
  // volver a subir (solo en una semana normal y sin una posible errata por confirmar)
  const bajadas = [];
  if (!soloKilos && normal) {
    const historia = historiaDe(d, base, sesiones, pautas);
    const ordenadas = [...sesiones].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    ordenadas.forEach((ses, i) => {
      [...(porSesion[ses.id] || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).forEach((p, j) => {
        const nueva = semana[i]?.pautas?.[j];
        if (!nueva || nueva.ejercicio_id !== p.ejercicio_id || pares[p.id]?.tipo === 'pregunta' || !estancado(historia[p.id], nueva)) return;
        const ej = ejercicios[p.ejercicio_id] || {};
        const cambio = ej.por_tiempo ? planchaBajada(p)
          : Number(p.carga_sugerida_kg) > 0 ? { carga_sugerida_kg: kilosBajada(p.carga_sugerida_kg, saltoDe(ej.nombre, p.carga_sugerida_kg, suyas.reglas)), series_detalle: null } : null;
        if (!cambio) return;
        Object.assign(nueva, cambio);
        bajadas.push({ p, nueva, nombre: ej.nombre || '' });
      });
    });
  }
  const bajado = new Set(bajadas.map((x) => x.p.id));
  // (v0.257, P: 'molestias_zona') El motor de molestias en la semana: lo que no sube por una zona (M6 y el ámbar de M7) y lo
  // que vuelve a lo de antes tras el ajuste de un día (M5). La alternativa en rojo va en la sesión: la semana no la cambia.
  const frenosZona = {};
  const zd = extras?.zonasDolor;
  if (zd?.hoy) {
    const estado = estadoZonas({ registros: zd.registros || [], checkins: zd.checkins || [], hoy: zd.hoy });
    const fz = frenosSemana({ estado, registros: zd.registros || [], checkins: zd.checkins || [], ejercicios, ids: [...new Set(pautas.map((p) => p.ejercicio_id))], hoy: zd.hoy });
    const hechasSemana = sesiones.filter((x) => x.completada && x.fecha_realizada).map((x) => ({ id: x.id, fecha: String(x.fecha_realizada).slice(0, 10), pautas: porSesion[x.id] || [] }));
    const ajustadas = [...zonasAjustadas({ registros: zd.registros || [], checkins: zd.checkins || [], sesiones: hechasSemana, ejercicios, hoy: zd.hoy })];
    const n = (x) => (x == null || x === '' ? null : Number(x));
    [...sesiones].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).forEach((ses, i) => {
      [...(porSesion[ses.id] || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).forEach((p, j) => {
        const nueva = semana[i]?.pautas?.[j];
        if (!nueva || nueva.ejercicio_id !== p.ejercicio_id) return;
        const ej = ejercicios[p.ejercicio_id] || {};
        const f = fz[p.ejercicio_id] || null;
        const m5 = !bajado.has(p.id) ? ajustadas.find((z) => cargaDe(z, ej) >= USO.preguntaDesde) || null : null;
        if (!f && !m5) return;
        if (f) {
          if (n(p.carga_sugerida_kg) != null && n(nueva.carga_sugerida_kg) > n(p.carga_sugerida_kg)) nueva.carga_sugerida_kg = p.carga_sugerida_kg;
          if (!soloKilos && n(p.series) != null && n(nueva.series) > n(p.series)) nueva.series = p.series;
          if (ej.por_tiempo && n(p.reps_max) != null && n(nueva.reps_max) > n(p.reps_max)) { nueva.reps_min = p.reps_min; nueva.reps_max = p.reps_max; }
          if (Array.isArray(nueva.series_detalle) && Array.isArray(p.series_detalle)) {
            nueva.series_detalle = nueva.series_detalle.slice(0, soloKilos ? nueva.series_detalle.length : p.series_detalle.length)
              .map((x, k) => (n(p.series_detalle[k]?.kg) != null && n(x.kg) > n(p.series_detalle[k].kg) ? { ...x, kg: p.series_detalle[k].kg } : x));
          }
        }
        if (m5) {
          if (n(p.carga_sugerida_kg) != null && n(nueva.carga_sugerida_kg) != null && n(nueva.carga_sugerida_kg) < n(p.carga_sugerida_kg)) nueva.carga_sugerida_kg = p.carga_sugerida_kg;
          if (!soloKilos && n(p.series) != null && n(nueva.series) < n(p.series)) nueva.series = p.series;
        }
        frenosZona[p.id] = f || { zona: m5, motivo: 'manana' };
      });
    });
  }
  // (v0.245) Los hechos de cada ejercicio, para «Tu revisión de la semana» y el «¿Por qué?» (logica/esencial-porque.js los
  // pone en palabras): lo que hizo, lo que tenía pautado, lo que le queda para la semana nueva y qué leyó el motor.
  const semanaTipo = descarga ? 'descarga' : r.semana?.tipo || 'normal';
  const porque = [];
  [...sesiones].sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0)).forEach((ses, i) => {
    [...(porSesion[ses.id] || [])].sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0)).forEach((p, j) => {
      const f = pares[p.id] || null;
      const nueva = semana[i]?.pautas?.[j] || null;
      const ej = ejercicios[p.ejercicio_id] || {};
      const campos = (x) => ({ kg: x.carga_sugerida_kg != null ? Number(x.carga_sugerida_kg) : null, min: x.reps_min ?? null, max: x.reps_max ?? null, series: x.series ?? null });
      porque.push({
        sesion: i, sesion_nombre: ses.nombre || '', ejercicio_id: p.ejercicio_id, nuevo_id: nueva?.ejercicio_id ?? null, nombre: ej.nombre || '', por_tiempo: !!ej.por_tiempo,
        tipo: f?.tipo || null, diagnostico: f?.diagnostico || null, frenos: [...(f?.frenos || []).map((x) => x.id), ...(frenosZona[p.id] ? ['molestia_zona'] : [])], mal_dia: !!f?.banderas?.malDia,
        molestia: (f?.avisos || []).some((x) => x.tipo === 'molestia') || !!frenosZona[p.id], semana: semanaTipo, novato: soloKilos, estancado: bajado.has(p.id),
        ...(frenosZona[p.id] ? { zona_dolor: { ...frenosZona[p.id], texto: frenosZona[p.id].motivo === 'manana' ? textoVuelta(frenosZona[p.id].zona) : textoFreno(frenosZona[p.id]) } } : {}),
        hecho: [...(hechas[p.id] || [])].filter((x) => Number(x.reps) > 0 && !x.sustituto_id).sort((x, y) => (Number(x.numero) || 0) - (Number(y.numero) || 0))
          .map((x) => ({ kg: Number(x.kg) > 0 ? Number(x.kg) : null, reps: Number(x.reps), rpe: x.rpe != null ? Number(x.rpe) : null })),
        antes: campos(p), despues: nueva ? campos(nueva) : null,
      });
    });
  });
  const preguntas = (r.filas || []).filter((f) => f.tipo === 'pregunta' && f.pregunta)
    .map((f) => ({ pauta_id: f.pauta_id, sesion_id: f.sesion_id, ejercicio_id: f.ejercicio_id, texto: f.pregunta.texto, series: f.pregunta.series }));
  // La nota de la semana: lo que cambia (la de la plantilla de novato ya la pone la base si no hay nada que contar). Lo
  // que el motor diga de la plancha no vale (cuenta repeticiones): de ella se cuenta lo que hace su regla.
  if (soloKilos) return { sesiones: semana, nota: null, descarga, preguntas, porque, semana: semanaTipo };
  const tiempo = (id) => !!ejercicios[id]?.por_tiempo;
  const nombre = (p) => ejercicios[p.ejercicio_id]?.nombre || p.ejercicio_id;
  // (094) lo que pasa a su alternativa para siempre no se cuenta como si siguiera (es otro ejercicio, sin kilos)
  const alts = atleta?.esencial_alternativas || {};
  const cambiado = (id) => !!alts[id] && alts[id] !== id && !!ejercicios[alts[id]] && tiempo(alts[id]) === tiempo(id);
  const filasNota = (r.filas || []).filter((f) => !['pregunta', 'sin_tocar'].includes(f.tipo) && !tiempo(f.ejercicio_id) && !cambiado(f.ejercicio_id) && !bajado.has(f.pauta_id) && !frenosZona[f.pauta_id])
    .map((f) => ({ ejercicio: f.ejercicio, clase: claseParaNota({ fila: f, propuesta: f.propuesta, hechas: entrada.series[f.pauta_id] }) })).filter((x) => x.clase);
  const sesionDe = Object.fromEntries(sesiones.map((s) => [s.id, s]));
  const planchas = pautas.filter((p) => tiempo(p.ejercicio_id) && !bajado.has(p.id) && !frenosZona[p.id]).map((p) => {
    const nueva = planchaDeLaSemana({ p, fila: pares[p.id], hechas: hechas[p.id], soloKilos, normal });
    return { p, frase: nueva ? frasePlancha(p, nueva) : null };
  });
  const cambian = planchas.filter((x) => x.frase);
  const nombres = (ps) => new Set(ps.map(nombre)).size;
  // (cuántos ejercicios distintos hay: los dos días son iguales; sin la plancha si se cuenta aparte)
  const total = nombres(pautas.filter((p) => !(cambian.length && tiempo(p.ejercicio_id)) && !cambiado(p.ejercicio_id)));
  let nota = notaDeSemana({ semana: semanaTipo, descarga: r.descarga?.tipo, total, filas: filasNota }) || null;
  if (cambian.length && nota) {
    // «En la plancha, …» (si no cambia en los dos días igual, se dice en cuál)
    const frases = [...new Set(cambian.map((x) => x.frase))];
    const dias = (fr) => cambian.filter((x) => x.frase === fr).map((x) => sesionDe[x.p.sesion_id]?.nombre).filter(Boolean);
    const todas = cambian.length === planchas.length && frases.length === 1;
    const texto = frases.map((fr) => `en la plancha${todas ? '' : ` (${unir(dias(fr))})`}, ${fr}`).join('; ');
    const RESTO = 'El resto, igual que la semana pasada.';
    if (nota.startsWith('Esta semana repites')) nota = `Esta semana, ${texto}. ${RESTO}`;
    else if (nota.endsWith(RESTO)) nota = `${nota.slice(0, -RESTO.length)}${texto.charAt(0).toUpperCase()}${texto.slice(1)}. ${RESTO}`;
    else nota = `${nota} ${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`;
  }
  // (25/11) Lo que baja por estancarse y la plancha en su tope de peso, al final de la nota
  const extra = [];
  const bajan = [...new Map(bajadas.map((x) => [x.nombre.toLowerCase(), x])).values()];
  if (bajan.length) {
    const kilos = bajan.filter((x) => x.nueva.carga_sugerida_kg != null && Number(x.p.carga_sugerida_kg) > 0 && !tiempo(x.p.ejercicio_id));
    const otros = bajan.filter((x) => !kilos.includes(x));
    if (kilos.length) extra.push(`En ${unir(kilos.map((x) => `${x.nombre.toLowerCase()} (de ${num(x.p.carga_sugerida_kg)} a ${num(x.nueva.carga_sugerida_kg)} kg)`))} bajas un poco el peso para volver a subir: llevabas tres semanas igual.`);
    if (otros.length) extra.push(`En ${unir(otros.map((x) => x.nombre.toLowerCase()))} bajas un poco para volver a subir: llevabas tres semanas igual.`);
  }
  // (v0.257) lo que no sube por una zona (lo del ajuste de un día no se cuenta: vuelve a lo de antes sin más)
  const porZona = Object.fromEntries(pautas.filter((p) => frenosZona[p.id] && frenosZona[p.id].motivo !== 'manana').map((p) => [p.ejercicio_id, frenosZona[p.id]]));
  if (Object.keys(porZona).length) extra.push(notaFrenos(porZona, ejercicios));
  if (ds && descarga) extra.unshift(notaDescargaSenales(ds));
  if (pautas.some((p) => tiempo(p.ejercicio_id) && !bajado.has(p.id) && planchaEnTope(p, hechas[p.id]))) {
    extra.push('En la plancha ya llevas el peso máximo (20 kg): para que siga costando, prueba su versión difícil (codos más adelantados o un pie en el aire).');
  }
  if (extra.length) {
    const RESTO = 'El resto, igual que la semana pasada.';
    if (!nota) nota = `${extra.join(' ')} ${RESTO}`;
    else if (nota.startsWith('Esta semana repites')) nota = `${extra.join(' ')} ${RESTO}`;
    else if (nota.endsWith(RESTO)) nota = `${nota.slice(0, -RESTO.length)}${extra.join(' ')} ${RESTO}`;
    else nota = `${nota} ${extra.join(' ')}`;
  }
  return { sesiones: semana, nota, descarga, preguntas, porque, semana: semanaTipo };
}
