// FBE Esencial (acompañamiento, tanda 4): el porqué de cada decisión, en palabras. Lógica pura.
// La app decide con el motor (logica/esencial-motor.js) y aquí se cuenta: «Tu revisión de la semana», el «¿Por qué?» de
// cada ejercicio, «Tu sesión, en claro» y «Lo de hoy». Entra un «hecho» por ejercicio (propuestaEsencial().porque):
//   { sesion, sesion_nombre, ejercicio_id, nuevo_id, nombre, por_tiempo, tipo, diagnostico, frenos, mal_dia, molestia,
//     semana, novato, estancado, hecho: [{ kg, reps, rpe }], antes: { kg, min, max, series }, despues: { … } | null }
// No decide nada: solo explica lo que ya está decidido. Si algo no encaja con lo que conoce, se queda en lo que se ve
// (lo que hiciste y lo que toca), sin inventar un motivo.
import { num, tendenciaPeso } from './calculos.js';

const unir = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const kilos = (kg) => `${num(kg)} kg`;
const repes = (h) => unir((h.hecho || []).map((s) => String(s.reps)));
const rango = (x) => (x?.min != null && x?.max != null && Number(x.min) !== Number(x.max) ? `${x.min} a ${x.max}` : `${x?.max ?? x?.min ?? ''}`);
const SUBE = ['superado', 'sobrado'];
const igualQue = (a, b) => !!a && !!b && Number(a.kg || 0) === Number(b.kg || 0) && Number(a.min) === Number(b.min) && Number(a.max) === Number(b.max) && Number(a.series) === Number(b.series);
// Los kilos que movió de verdad (los de su serie más pesada), por si no son los pautados
const movidos = (h) => Math.max(0, ...(h.hecho || []).map((s) => Number(s.kg) || 0)) || null;

// Lo que le queda, en corto (para la etiqueta de cada ejercicio)
function queda(h) {
  const d = h.despues;
  if (!d) return '';
  const u = h.por_tiempo ? 'segundos' : 'repeticiones';
  const r = d.max != null ? `${d.series ? `${d.series} × ` : ''}${rango(d)} ${u}` : '';
  return [d.kg != null && d.kg > 0 ? kilos(d.kg) : null, r].filter(Boolean).join(' · ');
}

// El porqué de un ejercicio → { clase, corto, texto, queda } (clase: 'sube' | 'reps' | 'serie' | 'igual' | 'baja' |
// 'descarga' | 'vuelta' | 'cambio' | 'marca' | 'otra'); null si no hay nada que contar
export function explicar(h) {
  if (!h || !h.despues) return null;
  const a = h.antes || {}, d = h.despues;
  const con = (clase, corto, texto) => ({ clase, corto, texto, queda: queda(h) });
  const hizo = (h.hecho || []).length ? repes(h) : null;
  const u = h.por_tiempo ? 'segundos' : 'repeticiones';
  // Un ejercicio que la semana pasada no estaba
  if (h.nuevo) return con('cambio', 'Nuevo', `Es nuevo esta semana${d.kg != null && d.kg > 0 ? `: empiezas con ${kilos(d.kg)}` : ': va sin kilos puestos, así que busca tu peso como el primer día'}.`);
  // Lo que tiene delante no es lo que saldría hoy de lo apuntado (corrigió algo después): solo lo que se ve
  if (h.sin_motivo) return con('otra', 'Esta semana', `Esta semana toca ${queda(h)}.${hizo ? ` La semana pasada hiciste ${hizo}${movidos(h) ? ` con ${kilos(movidos(h))}` : ''}.` : ''}`);
  // Lo cambió por su alternativa para siempre: otro ejercicio, sin kilos
  if (h.nuevo_id && h.nuevo_id !== h.ejercicio_id) {
    return con('cambio', 'Su alternativa', 'Lo has cambiado por su alternativa. Como es otro ejercicio, va sin kilos puestos: busca tu peso como el primer día.');
  }
  // La semana 5: sale de sus marcas
  if (h.novato) {
    if (h.por_tiempo) return con('marca', 'Con tus marcas', 'Empiezas donde lo dejaste en tu semana de marcas.');
    if (d.kg == null) return con('marca', 'Busca tu peso', 'No quedó ningún peso apuntado en tu semana de marcas: busca el peso como el primer día.');
    return con('marca', `Sales con ${kilos(d.kg)}`, `Empiezas con ${kilos(d.kg)}: sale de lo que moviste en tu semana de marcas${movidos(h) && movidos(h) !== d.kg ? ` (${kilos(movidos(h))}, y te salió con margen)` : ''}.`);
  }
  if (h.semana === 'descarga' || h.tipo === 'descarga') {
    return con('descarga', 'Descarga', 'Semana de descarga: menos carga o menos series que la semana pasada, para recuperar. No es para apretar: quédate lejos del fallo.');
  }
  if (h.semana === 'vuelta' || h.tipo === 'vuelta') {
    return con('vuelta', 'Vuelta suave', 'Vuelves después de unos días sin entrenar: esta semana va con algo menos de carga para retomar con buenas sensaciones.');
  }
  if (h.semana === 'mantenimiento' || h.tipo === 'mantenimiento') return con('igual', 'Mantenimiento', 'Semana de mantenimiento: mismas cargas con menos series.');
  // Tres semanas igual: un 10 % menos para volver a subir
  if (h.estancado) {
    if (h.por_tiempo || !(a.kg > 0) || d.kg == null) return con('baja', 'Baja un poco', 'Baja un poco: llevabas tres semanas igual. Con algo menos vuelves a sumar y a subir.');
    return con('baja', `Baja a ${kilos(d.kg)}`, `Bajas de ${kilos(a.kg)} a ${kilos(d.kg)}: llevabas tres semanas con el mismo peso y las mismas repeticiones. Con un poco menos vuelves a sumar repeticiones y a subir.`);
  }
  if (h.tipo === 'pregunta' || h.frenos?.includes('dato_raro') || h.diagnostico === 'dato_raro') {
    return con('igual', 'Se queda igual', 'Se queda igual: algo de lo que apuntaste parecía una errata y la app no lo ha usado para decidir.');
  }
  if (h.semana === 'repetir' || h.frenos?.includes('semana_a_medias')) {
    return con('igual', 'Se repite', 'La semana pasada quedó a medias, así que se repite tal cual: mismos kilos y mismas repeticiones.');
  }
  // La plancha (por tiempo), con su regla: 5 segundos más cuando aguanta arriba en todas; con 50, peso
  if (h.por_tiempo) {
    if (Number(d.kg || 0) > Number(a.kg || 0)) return con('sube', a.kg > 0 ? `Sube a ${kilos(d.kg)}` : `Con ${kilos(d.kg)}`, `Aguantaste ${a.max} segundos en todas tus series: ahora ${a.kg > 0 ? 'con algo más de peso' : 'con peso'} (${kilos(d.kg)}) y otra vez de ${rango(d)} segundos.`);
    if (Number(d.max) > Number(a.max)) return con('sube', `${Number(d.max) - Number(a.max)} segundos más`, `Aguantaste ${a.max} segundos en todas tus series: ahora, de ${rango(d)} segundos.`);
    if (h.molestia) return con('igual', 'Se queda igual', 'Se queda igual: hay una molestia apuntada en esa zona, y con una molestia la app no sube.');
    return con('igual', 'Se queda igual', `Se queda en ${rango(d)} segundos: sube cuando aguantes ${d.max} en todas tus series.`);
  }
  const mas = d.kg != null && a.kg != null && Number(d.kg) > Number(a.kg);
  const menos = d.kg != null && a.kg != null && Number(d.kg) < Number(a.kg);
  if (h.tipo === 'subir') {
    const porque = SUBE.includes(h.diagnostico) && hizo ? `hiciste ${hizo} y cumpliste en todas tus series` : hizo ? `hiciste ${hizo}` : 'lo que apuntaste da para un salto más';
    const tope = Math.max(0, ...(h.hecho || []).map((x) => x.reps));
    const objetivo = d.max != null && Number(d.max) < tope ? ` Con más peso, el objetivo de esta semana baja a ${rango(d)} repeticiones.` : ' Con más peso es normal que cueste un poco más: no hace falta ir al límite.';
    if (mas) return con('sube', `Sube a ${kilos(d.kg)}`, `Subes de ${kilos(a.kg)} a ${kilos(d.kg)}: ${porque}.${objetivo}`);
    if (d.kg != null) return con('sube', `Sube a ${kilos(d.kg)}`, `Te toca ${kilos(d.kg)}, un salto más de lo que moviste: ${porque}.`);
    return con('sube', 'Sube un poco', `Te toca subir un poco el peso respecto a la semana pasada: ${porque}.`);
  }
  if (h.tipo === 'reps') {
    return con('reps', 'Una repetición más', `Mismo peso${d.kg != null ? ` (${kilos(d.kg)})` : ''} y un poco más de repeticiones${hizo ? `: la semana pasada hiciste ${hizo}` : ''}; esta, a por ${rango(d)}.`);
  }
  if (h.tipo === 'series') {
    return con('serie', 'Una serie más', `Una serie más (${d.series} en total)${hizo ? `: hiciste ${hizo} y llegaste arriba en todas` : ''}.`);
  }
  if (h.tipo === 'bajar' || h.tipo === 'menos' || (menos && h.tipo !== 'mantener')) {
    if (menos) return con('baja', `Baja a ${kilos(d.kg)}`, `Bajas de ${kilos(a.kg)} a ${kilos(d.kg)}: llevas dos semanas sin llegar al mínimo${a.min != null ? ` (${a.min} ${u})` : ''}. Con menos peso vuelves a hacerlas bien y a subir.`);
    return con('baja', 'Baja un poco', 'Baja un poco respecto a la semana pasada, para volver a hacerlo bien y a subir.');
  }
  if (h.tipo === 'tope') {
    return con('igual', 'Se queda igual', `Has llegado arriba del rango (${rango(d)}) sin peso que subir, así que se queda igual. Si te sobra, hazlo más despacio o prueba su versión más difícil.`);
  }
  if (h.tipo === 'sin_tocar') return con('igual', 'Se queda igual', 'Este ejercicio no lo mueve la app: se queda como estaba.');
  // Se queda igual: por qué
  const peso = d.kg != null && d.kg > 0 ? ` ${kilos(d.kg)}` : '';
  const bajo = menos ? ` La app parte de lo que moviste de verdad (${kilos(d.kg)}), no de lo que tenías puesto.` : '';
  if (h.frenos?.includes('tope_semana')) return con('igual', 'Se queda igual', 'Tocaba una serie más, pero la semana ya llega a su tope de series: se queda igual.');
  if (h.frenos?.includes('molestia')) return con('igual', 'Se queda igual', 'Tocaba subir, pero hay una molestia apuntada en esa zona: con una molestia, la app no sube.');
  if (h.frenos?.includes('checkin_bajo')) return con('igual', 'Se queda igual', 'Tocaba una serie más, pero tu check-in venía bajo de energía o de recuperación: esta semana no se añade.');
  if (h.frenos?.includes('tras_descarga')) return con('igual', 'Se queda igual', 'Vienes de una semana de descarga: retomas donde lo dejaste la última semana normal, sin subir todavía.');
  if (h.diagnostico === 'por_debajo') {
    if (h.mal_dia) return con('igual', `Repites${peso}`, `Repites${peso}: no llegaste al mínimo, pero marcaste que era un mal día, y un mal día no cuenta.${bajo}`);
    return con('igual', `Repites${peso}`, `Repites${peso}${hizo ? `: hiciste ${hizo}` : ''}${a.min != null ? `${hizo ? ' y' : ':'} en alguna serie no llegaste a ${a.min}` : ''}. Si vuelve a pasar, la app baja un poco el peso.${bajo}`);
  }
  if (h.diagnostico === 'pasado') return con('igual', `Repites${peso}`, `Repites${peso}: llegaste a las repeticiones, pero apretando más de lo previsto. Mismo peso hasta que salga con el margen que te marca la app.${bajo}`);
  if (h.diagnostico === 'a_medias') return con('igual', 'Se queda igual', `Se queda igual: te faltó alguna serie por hacer o por apuntar${hizo ? ` (apuntaste ${(h.hecho || []).length} de ${a.series})` : ''}.`);
  if (h.diagnostico === 'sin_registrar') return con('igual', 'Se queda igual', 'Se queda igual: no apuntaste este ejercicio y, sin datos, la app no lo mueve.');
  if (h.diagnostico === 'cambiado') return con('igual', 'Se queda igual', 'Se queda igual: ese día lo cambiaste por otro ejercicio.');
  if (h.diagnostico === 'en_rango') return con('igual', `Repites${peso}`, `Repites${peso} y el mismo objetivo${hizo ? `: hiciste ${hizo}` : ''}. Cuando te salgan ${rango(d)} en todas tus series, la app da el paso siguiente.${bajo}`);
  if (igualQue(a, d)) return con('igual', 'Se queda igual', 'Se queda igual que la semana pasada.');
  return con('igual', 'Esta semana', `Esta semana toca ${queda(h)}.`);
}

// ---------- «Tu revisión de la semana» ----------
// Una por ejercicio (si en todos sus días se dice lo mismo) o una por día
function agrupar(porque = []) {
  const todas = porque.map((h) => ({ h, e: explicar(h) })).filter((x) => x.e);
  const out = [];
  for (const nombre of [...new Set(todas.map((x) => x.h.nombre))]) {
    const suyas = todas.filter((x) => x.h.nombre === nombre);
    const iguales = suyas.every((x) => x.e.texto === suyas[0].e.texto);
    if (iguales) out.push({ nombre, dia: null, ...suyas[0].e });
    else for (const x of suyas) out.push({ nombre, dia: x.h.sesion_nombre || `Día ${x.h.sesion + 1}`, ...x.e });
  }
  return out;
}

// Una sola cosa en la que fijarse, según lo que más se repite en lo apuntado
export const FOCOS = {
  descarga: 'Esta semana no se aprieta. Acaba cada serie con margen de sobra: descansar también es entrenar.',
  vuelta: 'Sin prisa: esta semana es para volver a coger el ritmo, no para recuperar lo que no hiciste.',
  repetir: 'Lo único que importa esta semana es hacer tus sesiones. Los kilos ya vendrán.',
  marca: 'Tus kilos salen de tus marcas, pero el primer día manda la sensación: si un peso se te queda grande, bájalo y apúntalo; la app parte de lo que hagas.',
  pasado: 'No vayas al límite. Acaba cada serie con las repeticiones de margen que te marca la app: así es como sube el peso semana a semana.',
  por_debajo: 'Elige el peso con el que llegas al mínimo de repeticiones en todas las series. Mejor quedarse corto de kilos que de repeticiones.',
  sin_apuntar: 'Apunta todas tus series, aunque salgan mal: con lo que no se apunta, la app no puede ajustar.',
  baja: 'Bajar un poco no es ir hacia atrás: es coger carrerilla. Haz estas semanas con buena técnica y vuelve a sumar repeticiones.',
  sube: 'En lo que sube de peso, es normal hacer alguna repetición menos. No lo compenses apretando al límite: vuelve a buscar el tope del rango poco a poco.',
  igual: 'Una repetición más que la semana pasada, en la serie que puedas: ese es el objetivo cuando el peso no cambia.',
};
export function focoDe({ tipo = 'siguiente', semana = 'normal', porque = [] } = {}) {
  if (tipo === 'novato') return FOCOS.marca;
  if (FOCOS[semana] && semana !== 'normal') return FOCOS[semana];
  const cuantos = (...ds) => porque.filter((h) => ds.includes(h.diagnostico) && !h.mal_dia).length;
  const total = Math.max(1, porque.length);
  if (cuantos('pasado') >= 2 && cuantos('pasado') / total >= 0.25) return FOCOS.pasado;
  if (cuantos('por_debajo') >= 2 && cuantos('por_debajo') / total >= 0.25) return FOCOS.por_debajo;
  if (cuantos('a_medias', 'sin_registrar') >= 2 && cuantos('a_medias', 'sin_registrar') / total >= 0.25) return FOCOS.sin_apuntar;
  const clases = porque.map((h) => explicar(h)?.clase);
  if (clases.includes('baja')) return FOCOS.baja;
  if (clases.some((c) => c === 'sube')) return FOCOS.sube;
  return FOCOS.igual;
}

// numero: la semana nueva; tipo: 'novato' | 'siguiente'; hechas y total: las sesiones de la semana hecha; porque: sus
// hechos; nota: la nota de la semana nueva. → { titulo, hiciste, sube, igual, baja, otras, foco, nota }
export function revisionDe({ numero = null, tipo = 'siguiente', semana = 'normal', hechas = 0, total = 0, porque = [], nota = null } = {}) {
  const filas = agrupar(porque);
  const de = (...cs) => filas.filter((f) => cs.includes(f.clase));
  const sube = de('sube', 'reps', 'serie'), igual = de('igual'), baja = de('baja'), otras = de('descarga', 'vuelta', 'cambio', 'marca', 'otra');
  const nombres = (xs) => new Set(xs.map((x) => x.nombre)).size;
  const series = porque.reduce((n, h) => n + (h.hecho || []).length, 0);
  const pautadas = porque.reduce((n, h) => n + (Number(h.antes?.series) || 0), 0);
  const nK = nombres(de('sube')), nR = new Set(de('reps', 'serie').map((x) => x.nombre).filter((n) => !de('sube').some((x) => x.nombre === n))).size;
  const titulo = tipo === 'primera' ? 'Tu primera semana con esta rutina'
    : tipo === 'novato' ? 'Tu plan desde hoy sale de tus marcas'
    : semana === 'descarga' ? 'Semana de descarga: toca recuperar'
      : semana === 'vuelta' ? 'De vuelta: esta semana, más suave'
        : semana === 'repetir' ? 'Repites la semana, tal cual'
          : semana === 'mantenimiento' ? 'Semana de mantenimiento'
            : nK && nR ? `Subes de peso en ${nK} y sumas repeticiones en ${nR}`
              : nK ? `Subes de peso en ${nK} ${nK === 1 ? 'ejercicio' : 'ejercicios'}`
              : nR ? `Sumas repeticiones en ${nR} ${nR === 1 ? 'ejercicio' : 'ejercicios'}`
              : nombres(baja) ? `Bajas un poco en ${nombres(baja)} ${nombres(baja) === 1 ? 'ejercicio' : 'ejercicios'} para volver a subir` : 'Esta semana, a consolidar: mismos pesos';
  const hiciste = total > 0
    ? `${hechas >= total ? (total === 1 ? 'Hiciste tu sesión' : `Hiciste tus ${total} sesiones`) : hechas === 0 ? `No hiciste ninguna de tus ${total} sesiones` : `Hiciste ${hechas} de tus ${total} sesiones`}${pautadas > 0 && hechas > 0 ? ` y apuntaste ${series} de ${pautadas} series` : ''}.`
    : null;
  return { numero, tipo, semana, titulo, hiciste, sube, igual, baja, otras, foco: focoDe({ tipo, semana, porque }), nota: nota || null };
}

// El hecho de un ejercicio de la semana nueva: el de su día (por orden) y, si no, el de ese ejercicio en cualquier día
export function hechoDe(porque = [], { sesion = null, ejercicioId } = {}) {
  const suyos = porque.filter((h) => (h.nuevo_id || h.ejercicio_id) === ejercicioId || h.ejercicio_id === ejercicioId);
  return suyos.find((h) => h.sesion === sesion) || suyos[0] || null;
}

// ¿Lo que se explica es lo que tiene delante? (por si después de prepararle la semana corrigió algo de la anterior)
export function casa(h, pauta) {
  if (!h?.despues || !pauta) return false;
  const kg = pauta.carga_sugerida_kg != null ? Number(pauta.carga_sugerida_kg) : null;
  if (h.novato) return h.por_tiempo || (h.despues.kg ?? null) === kg;   // (en la semana 5, las repeticiones las pone la plantilla)
  return (h.despues.kg ?? null) === kg && Number(h.despues.max ?? 0) === Number(pauta.reps_max ?? 0) && Number(h.despues.series ?? 0) === Number(pauta.series ?? 0);
}

// ---------- «Tu sesión, en claro» (al terminar una sesión) ----------
// Cómo ha ido cada ejercicio de hoy y qué suele hacer la app con eso → { estado, icono, hecho, app, texto }
// (estado: 'arriba' | 'bien' | 'corta' | 'de_mas' | 'falta' | 'nada'; hecho: cómo fue; app: lo que hace la app con eso,
// que no vale en las cuatro semanas de la guía, donde aún no mueve nada; texto: las dos cosas)
export function enClaro(h) {
  if (!h) return null;
  const a = h.antes || {};
  const hizo = (h.hecho || []).length ? repes(h) : null;
  const con = (estado, icono, hecho, app = '') => ({ estado, icono, hecho, app, texto: app ? `${hecho} ${app}` : hecho });
  if (h.diagnostico === 'cambiado') return con('nada', 'reiniciar', 'Lo cambiaste por otro ejercicio: lo que apuntaste queda a nombre del otro.', 'Este se queda como estaba.');
  if (!hizo || h.diagnostico === 'sin_registrar') return con('falta', 'alerta', 'Sin apuntar.', 'La app lo deja como está para la semana que viene.');
  if (h.diagnostico === 'dato_raro' || h.tipo === 'pregunta') return con('falta', 'pregunta', 'Algo de lo apuntado parece una errata.', 'Antes de prepararte la semana, la app te lo preguntará.');
  if (h.por_tiempo) {
    const arriba = (h.hecho || []).length >= (Number(a.series) || 1) && h.hecho.every((s) => s.reps >= Number(a.max));
    return arriba ? con('arriba', 'arriba', `Aguantaste ${hizo} segundos: arriba en todas.`, 'Lo normal es que la semana que viene suba.')
      : con('bien', 'hecho', `Aguantaste ${hizo} segundos.`, `Sube cuando llegues a ${a.max} en todas tus series.`);
  }
  if (h.diagnostico === 'a_medias') return con('falta', 'alerta', `Hiciste ${(h.hecho || []).length} de ${a.series} series (${hizo}).`, 'Con series sin hacer, la app lo deja como está.');
  if (SUBE.includes(h.diagnostico)) return con('arriba', 'arriba', `${hizo}: cumplido en todas tus series.`, 'Lo normal es que la semana que viene la app te pida un poco más (una repetición o un poco de peso).');
  if (h.diagnostico === 'en_rango') return con('bien', 'hecho', `${hizo}: dentro de lo previsto, sin llegar al objetivo en todas.`, 'La app repite el peso hasta que salga.');
  if (h.diagnostico === 'por_debajo') return con('corta', 'abajo', `${hizo}: alguna serie se quedó por debajo de ${a.min}.`, 'La app repite el peso; si vuelve a pasar, lo baja un poco.');
  if (h.diagnostico === 'pasado') return con('de_mas', 'alerta', `${hizo}: llegaste, pero apretando más de lo previsto.`, 'La app repite el peso hasta que salga con margen.');
  return con('bien', 'hecho', `${hizo}: apuntado.`);
}

// El resumen de «Tu sesión, en claro»: una frase con lo que más pesa
export function resumenEnClaro(filas = []) {
  const n = (e) => filas.filter((f) => f?.estado === e).length;
  if (!filas.length) return null;
  if (n('arriba') && n('arriba') >= filas.length / 2) return 'Muy buena sesión: en la mayoría has cumplido en todas las series.';
  if (n('de_mas') >= 2) return 'Sesión hecha, pero apretando de más: la próxima, deja el margen que te marca la app.';
  if (n('corta') >= 2) return 'Sesión hecha. En un par de ejercicios el peso se te quedó grande: la app lo tiene en cuenta.';
  if (n('falta') >= 2) return 'Sesión hecha, con cosas sin apuntar: lo que no se apunta, la app no lo puede ajustar.';
  return 'Sesión hecha, como tocaba.';
}

// ---------- (16) Su peso, en contexto: la tendencia, no el dato de un día ----------
// pesos: [{ fecha, kg }]; hoy: 'AAAA-MM-DD'. Con tres pesajes o más en las últimas cuatro semanas → { ahora, antes, n, texto }
export function pesoEnContexto(pesos = [], hoy) {
  const dia = (iso) => Math.round(Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`) / 864e5);
  const serie = tendenciaPeso(pesos || []);
  if (!hoy || !serie.length) return null;
  const mes = serie.filter((p) => dia(hoy) - dia(p.fecha) <= 28 && dia(p.fecha) <= dia(hoy));
  if (mes.length < 3) return null;
  const ahora = mes[mes.length - 1].tendencia, antes = mes[0].tendencia;
  const dif = Math.round((ahora - antes) * 10) / 10;
  const semanas = Math.max(1, Math.round((dia(mes[mes.length - 1].fecha) - dia(mes[0].fecha)) / 7));
  const cambio = Math.abs(dif) < 0.3 ? 'se mantiene' : `${dif > 0 ? 'ha subido' : 'ha bajado'} ${num(Math.abs(dif))} kg`;
  return { ahora, antes, n: mes.length, dif,
    texto: `Tu tendencia está en ${num(ahora)} kg: ${cambio} en ${semanas === 1 ? 'la última semana' : `las últimas ${semanas} semanas`} (${mes.length} pesajes). El dato de un día sube y baja con el agua y la sal: lo que cuenta es la tendencia.` };
}

// ---------- «¿Cómo ha ido?» (un toque al terminar) ----------
export const COMO_HA_IDO = [
  ['facil', 'Fácil', 'Bien. Si en todas las series te sobraban más repeticiones de las que marca la app, apúntalo así: es lo que hace que suba el peso.'],
  ['bien', 'Bien', 'Así tiene que ser casi siempre: exigente, pero con margen. Lo que has apuntado es lo que usa la app para tu próxima semana.'],
  ['dura', 'Dura', 'Hay días así, y no dicen nada malo de ti. Si has apuntado lo que hiciste de verdad, la app no te sube donde no tocaba. Hoy, cena bien y duerme.'],
  ['molestia', 'Algo me molestó', 'Apúntalo en tu check-in de la semana, con la zona: al enviarlo, la app te dice qué hacer mientras tanto. Y en la próxima sesión, «Cambiar» te da una alternativa para el ejercicio que moleste.'],
];
export const respuestaComoHaIdo = (id) => COMO_HA_IDO.find((x) => x[0] === id)?.[2] || null;

// ---------- «Lo de hoy, en 20 segundos» (antes de empezar la sesión) ----------
// ejercicios: los de la sesión de hoy [{ ejercicio: { id, nombre, por_tiempo }, series, descanso_seg, carga_sugerida_kg,
// reps_max, prioridad }]; porque: los hechos de su semana (o []); sesion: su posición en la semana (0, 1…)
// → { minutos, importante, cambia: [frases], sinKilos }
export function loDeHoy({ ejercicios = [], porque = [], sesion = null } = {}) {
  const series = ejercicios.reduce((n, e) => n + (Number(e.series) || 0), 0);
  if (!ejercicios.length || !series) return null;
  // (cada serie, unos 45 segundos de trabajo más su descanso; y 5 minutos de calentar)
  const seg = ejercicios.reduce((n, e) => n + (Number(e.series) || 0) * (45 + (Number(e.descanso_seg) || 90)), 0);
  const minutos = Math.max(15, Math.round((seg / 60 + 5) / 5) * 5);
  const principal = ejercicios.find((e) => e.prioridad === 'alta') || ejercicios[0];
  const cambia = [];
  for (const e of ejercicios) {
    const h = hechoDe(porque, { sesion, ejercicioId: e.ejercicio?.id });
    const x = h && casa(h, e) ? explicar(h) : null;
    if (x && ['sube', 'reps', 'serie', 'baja'].includes(x.clase)) cambia.push(`${e.ejercicio?.nombre || 'Un ejercicio'}: ${x.corto.charAt(0).toLowerCase()}${x.corto.slice(1)}`);
  }
  return { minutos, ejercicios: ejercicios.length, series, importante: principal?.ejercicio?.nombre || null, cambia: cambia.slice(0, 4), mas: Math.max(0, cambia.length - 4),
    sinKilos: ejercicios.filter((e) => !e.ejercicio?.por_tiempo && e.carga_sugerida_kg == null).length };
}
