// FBE Esencial (tanda 3): la propuesta del motor para la semana siguiente de quien va por su cuenta, lista para guardar.
// Lógica pura (sin base de datos); se carga solo cuando hace falta (con el motor entero). La usa api.prepararSemanaEsencial.
import { proponerSemana, entradaDesdeBloque, pautasDeSemana, paraElMotor, leerGuardadas, notaDeSemana, claseParaNota, emparejar, saltoDe } from './motor/index.js';
import { semanaDesdePropuesta, planchaDeLaSemana, planchaEnTope, estancado, kilosBajada, planchaBajada, ESTANCADO } from './esencial-semana.js';
import { num } from './calculos.js';

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

// d: api.bloqueCompleto del bloque de la semana hecha; base: esa semana; tipo: 'novato' (tras «Primeras 4 semanas») o
// 'siguiente'; ejercicios: { id: ejercicio }; atleta: su fila (nivel, volumen_objetivo, reglas_motor); checkins y
// molestias: las suyas.
// Devuelve { sesiones, nota, descarga, preguntas: [{ pauta_id, ejercicio_id, texto, series: [{ numero, kg, reps }] }] }.
export function propuestaEsencial({ d, base, tipo = 'siguiente', ejercicios = {}, atleta = {}, checkins = [], molestias = [], hoy }) {
  const suyas = paraElMotor(leerGuardadas(atleta?.reglas_motor ?? null));
  const entrada = entradaDesdeBloque({
    d, base, destino: null, ejercicios, hoy, checkins, molestias, reglas: suyas.reglas,
    atleta: { nivel: atleta?.nivel ?? 'novato', perfil: suyas.perfil, volumen_objetivo: atleta?.volumen_objetivo ?? null, modalidad: 'por_su_cuenta' },
  });
  const r = proponerSemana(entrada);
  const descarga = r.semana?.tipo === 'descarga';
  const pares = Object.fromEntries((r.filas || []).map((f) => [f.pauta_id, f]));
  const { sesiones, pautas } = pautasDeSemana(d, base);
  const porSesion = {};
  for (const p of pautas) (porSesion[p.sesion_id] ||= []).push(p);
  // (la plancha sube con su regla solo en una semana normal: ni descarga, ni a medias, ni tras un parón)
  const normal = !descarga && (r.semana?.tipo || 'normal') === 'normal';
  const hechas = entrada.series || {};
  const soloKilos = tipo === 'novato';
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
  const preguntas = (r.filas || []).filter((f) => f.tipo === 'pregunta' && f.pregunta)
    .map((f) => ({ pauta_id: f.pauta_id, sesion_id: f.sesion_id, ejercicio_id: f.ejercicio_id, texto: f.pregunta.texto, series: f.pregunta.series }));
  // La nota de la semana: lo que cambia (la de la plantilla de novato ya la pone la base si no hay nada que contar). Lo
  // que el motor diga de la plancha no vale (cuenta repeticiones): de ella se cuenta lo que hace su regla.
  if (soloKilos) return { sesiones: semana, nota: null, descarga, preguntas };
  const tiempo = (id) => !!ejercicios[id]?.por_tiempo;
  const nombre = (p) => ejercicios[p.ejercicio_id]?.nombre || p.ejercicio_id;
  // (094) lo que pasa a su alternativa para siempre no se cuenta como si siguiera (es otro ejercicio, sin kilos)
  const alts = atleta?.esencial_alternativas || {};
  const cambiado = (id) => !!alts[id] && alts[id] !== id && !!ejercicios[alts[id]] && tiempo(alts[id]) === tiempo(id);
  const bajado = new Set(bajadas.map((x) => x.p.id));
  const filasNota = (r.filas || []).filter((f) => !['pregunta', 'sin_tocar'].includes(f.tipo) && !tiempo(f.ejercicio_id) && !cambiado(f.ejercicio_id) && !bajado.has(f.pauta_id))
    .map((f) => ({ ejercicio: f.ejercicio, clase: claseParaNota({ fila: f, propuesta: f.propuesta, hechas: entrada.series[f.pauta_id] }) })).filter((x) => x.clase);
  const sesionDe = Object.fromEntries(sesiones.map((s) => [s.id, s]));
  const planchas = pautas.filter((p) => tiempo(p.ejercicio_id) && !bajado.has(p.id)).map((p) => {
    const nueva = planchaDeLaSemana({ p, fila: pares[p.id], hechas: hechas[p.id], soloKilos, normal });
    return { p, frase: nueva ? frasePlancha(p, nueva) : null };
  });
  const cambian = planchas.filter((x) => x.frase);
  const nombres = (ps) => new Set(ps.map(nombre)).size;
  const semanaTipo = descarga ? 'descarga' : r.semana?.tipo || 'normal';
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
  return { sesiones: semana, nota, descarga, preguntas };
}
