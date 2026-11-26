// FBE Esencial, tanda 9 (v0.250): la comida, acompañada (para quien lleva nutrición). Lógica pura sobre lo que ya
// devuelve api.resumenNutricion (plan, planes, registros, pesos, gasto, ajuste, ritmo, pesoKg, entrenos) y sobre el
// ajuste de cada semana de esencial-nutricion.js, que no cambia. Lo que es regla nueva o texto de salud va apagado
// (APAGADO de esencial-respuestas.js, con su sitio en «Por revisar» del panel) hasta que Pelayo lo vea.
// Con antecedente de trastorno de la conducta alimentaria (TCA): nada de déficit, ni «Me he pasado», ni ritmos de
// bajada, ni «¿Cuándo me peso?», ni el aviso para pesarse (eso, en la base).
import { fmtKcal, kcalMediaPlan, planVigente, textoRitmo, KCAL_POR_KG, gastoAdaptativo, objetivoDelDia } from './nutricion.js';
import { diasEntre, sumarDias, lunesDe } from './fechas.js';
import { num, signo, tendenciaPeso, ritmoPeso } from './calculos.js';
import { ajusteComidaEsencial } from './esencial-nutricion.js';

const MOTIVO_AJUSTE = 'Ajuste de la semana';
export const esAjuste = (plan) => typeof plan?.motivo === 'string' && plan.motivo.startsWith(MOTIVO_AJUSTE);
const ordenados = (planes = []) => [...(planes || [])].filter((p) => p?.desde).sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
const kcalDe = (plan) => (plan ? Number(kcalMediaPlan(plan, 2) ?? plan.kcal) : null);
const r50 = (v) => Math.round(v / 50) * 50;
const fechaCorta = (iso) => { const [, m, d] = String(iso).split('-').map(Number); return `${d}/${m}`; };
// (v0.252) cada cuántos días se revisa un plan del motor de nutrición (REVISION_DIAS de nutricion-motor.js; aquí aparte para
// no traer el motor a este módulo)
const REVISION_MOTOR = 28;

// ---------- (101) El cambio de esta semana: el último ajuste de la app de los últimos siete días ----------
// → { desde, antes, ahora, delta, motivo } o null
export function cambioDeLaSemana(planes = [], hoy) {
  const xs = ordenados(planes).filter((p) => p.desde <= hoy);
  for (let i = xs.length - 1; i > 0; i--) {
    const p = xs[i];
    if (diasEntre(p.desde, hoy) >= 7) break;
    if (!esAjuste(p)) continue;
    const antes = kcalDe(xs[i - 1]), ahora = kcalDe(p);
    if (!(antes > 0) || !(ahora > 0)) return null;
    // (el motivo, sin su final «: bajas 148 kcal.», que ya dice la frase)
    const motivo = p.motivo.slice(MOTIVO_AJUSTE.length).replace(/^\s*:\s*/, '').replace(/:\s*(?:sube|baja)s\s[\d.]+\skcal[^.]*\.?$/, '.');
    return { desde: p.desde, antes, ahora, delta: Math.round(ahora - antes), motivo: motivo ? motivo.charAt(0).toUpperCase() + motivo.slice(1) : '' };
  }
  return null;
}

// ---------- (102) «¿Por qué no cambia?»: cuando la app no toca el plan, el motivo, dicho claro ----------
// r: lo de api.resumenNutricion; viaje: si la regla de los viajes está encendida y está de viaje o acaba de volver.
// → { clave, texto } o null (si hoy toca cambiarlo, lo cambia AjusteComidaEsencial al abrir Hoy y no hay nada que explicar)
export function porQueNoCambia({ plan, gasto = null, ajuste = null } = {}, { hoy, tca = false, viaje = false } = {}) {
  if (!plan || plan.modo !== 'macros') return null;
  const dias = diasEntre(plan.desde, hoy);
  // (v0.252, R2) un plan del motor de nutrición (con su mantenimiento) no cambia cada semana: se revisa cada 4
  if (plan.mantenimiento != null) {
    if (tca) return { clave: 'tca', texto: 'Tu plan es para mantener tu peso: la app no lo baja nunca sola.' };
    return dias < REVISION_MOTOR
      ? { clave: 'motor', texto: `La app revisa tu plan cada 4 semanas, no cada semana: la próxima vez, el ${fechaCorta(sumarDias(plan.desde, REVISION_MOTOR))}, con lo que lo hayas seguido, tu peso y tu cintura.` }
      : { clave: 'motor', texto: 'La app revisa tu plan cada 4 semanas, con lo que lo hayas seguido, tu peso y tu cintura.' };
  }
  if (dias < 7) {
    const cuando = fechaCorta(sumarDias(plan.desde, 7));
    return esAjuste(plan)
      ? { clave: 'reciente', texto: `Tu plan cambió hace ${dias === 0 ? 'nada' : dias === 1 ? 'un día' : `${dias} días`}: la app no vuelve a tocarlo hasta que pase una semana (desde el ${cuando}).` }
      : { clave: 'nuevo', texto: `Tu plan es nuevo: la app lo ajusta por primera vez cuando cumpla una semana (desde el ${cuando}), con lo que apuntes y lo que peses.` };
  }
  if (viaje) return { clave: 'viaje', texto: 'Estás de viaje o acabas de volver: esta semana la app no toca tu plan. Esos días, come para mantener.' };
  if (!gasto || gasto.kcal == null) return { clave: 'faltan', texto: `Para ajustarlo, la app necesita ${gasto?.falta || 'más días apuntados y más pesadas'}. Con eso calcula lo que gastas de verdad.` };
  if (ajuste?.tipo === 'esperar') return { clave: 'esperar', texto: `Con lo apuntado hasta ahora, lo que gastas aún sale poco preciso (±${fmtKcal(gasto.margen)} kcal): la app espera a tener más días completos y más pesadas antes de tocar nada.` };
  if (ajuste?.tipo === 'mantener') return { clave: 'bien', texto: `Va bien: para ${textoRitmo(plan.ritmo_pct)} te tocan unas ${fmtKcal(ajuste.objetivo)} kcal al día, y tu plan ya está ahí.` };
  if (ajuste?.tipo === 'revisar') return { clave: 'minimo', texto: 'La app no lo baja más: tu plan ya está en lo mínimo que propone.' };
  if (tca && ajuste?.tipo === 'bajar') return { clave: 'tca', texto: 'Tu plan es para mantener tu peso: la app no lo baja nunca sola.' };
  return null;
}

// ---------- (101) La comida, en «Tu revisión de la semana» ----------
// → { lineas: [{ k, texto }] } o null (sin plan de comida con cifras)
export function comidaDeLaSemana(r = {}, { hoy, tca = false, viaje = false } = {}) {
  const plan = r?.plan;
  if (!plan || plan.modo !== 'macros' || !(Number(plan.kcal) > 0)) return null;
  const lineas = [{ k: 'plan', texto: `Tu plan: ${fmtKcal(plan.kcal)} kcal al día, con ${num(plan.proteina_g, 0)} g de proteína.` }];
  const c = cambioDeLaSemana(r.planes || [plan], hoy);
  if (c && !(tca && c.delta < 0)) lineas.push({ k: 'cambio', texto: `Esta semana ${c.delta > 0 ? 'sube' : 'baja'} ${fmtKcal(Math.abs(c.delta))} kcal${c.motivo ? `. ${c.motivo}` : '.'}` });
  else { const p = porQueNoCambia(r, { hoy, tca, viaje }); if (p) lineas.push({ k: p.clave, texto: p.texto }); }
  if (!tca && r.ritmo && Number(r.ritmo.dias) >= 7 && plan.ritmo_pct != null) {
    lineas.push({ k: 'ritmo', texto: `Tu peso, en tendencia: ${signo(r.ritmo.pctSemana)} % a la semana (lo previsto: ${Number(plan.ritmo_pct) === 0 ? 'mantenerlo' : `${signo(Number(plan.ritmo_pct), 2)} %`}).` });
  }
  return { lineas };
}

// ---------- (105) «No llego a la proteína»: lo que lleva hoy y tres recetas del recetario para llegar ----------
// reg: lo apuntado hoy ({ proteina_g, kcal }); obj: lo de hoy (objetivoDelDia: { proteina, kcal }); recetas: las del
// recetario del equipo (por ración) → { lleva, objetivo, falta, texto, ideas: [{ id, nombre, proteina_g, kcal }] } o null
export function proteinaDeHoy({ reg = null, obj = null, plan = null, recetas = [] } = {}) {
  const objetivo = Number(obj?.proteina ?? plan?.proteina_g);
  if (!(objetivo > 0)) return null;
  const lleva = reg?.proteina_g != null && Number.isFinite(Number(reg.proteina_g)) ? Math.round(Number(reg.proteina_g)) : null;
  const falta = lleva == null ? Math.round(objetivo) : Math.max(0, Math.round(objetivo - lleva));
  const texto = lleva == null ? `Hoy aún no has apuntado nada: tu objetivo es de ${num(objetivo, 0)} g de proteína.`
    : falta <= 5 ? `Hoy llevas ${lleva} de ${num(objetivo, 0)} g de proteína: ya casi está.`
      : `Hoy llevas ${lleva} de ${num(objetivo, 0)} g de proteína: te faltan ${falta} g.`;
  const densidad = (x) => Number(x.proteina_g) / Math.max(1, Number(x.kcal));
  const ideas = (recetas || []).filter((x) => x && Number(x.proteina_g) >= 20 && Number(x.kcal) > 0)
    .sort((a, b) => densidad(b) - densidad(a) || Number(b.proteina_g) - Number(a.proteina_g)).slice(0, 3)
    .map((x) => ({ id: x.id, nombre: x.nombre, proteina_g: Math.round(Number(x.proteina_g)), kcal: Math.round(Number(x.kcal)) }));
  return { lleva, objetivo: Math.round(objetivo), falta, texto, ideas };
}

// ---------- (109, P) De viaje: esos días la comida pasa a mantener y no se ajusta ----------
// viaje: la nota «viaje» de la 101 ({ desde, hasta, datos: { modo } }) → 'antes' | 'durante' | 'vuelta' (los siete días
// después de volver: el peso de la vuelta aún trae el viaje) | null
export function momentoViaje(viaje, hoy) {
  const desde = String(viaje?.desde || viaje?.datos?.desde || '').slice(0, 10), hasta = String(viaje?.hasta || viaje?.datos?.hasta || '').slice(0, 10);
  if (!desde || !hasta || !hoy) return null;
  if (hoy < desde) return diasEntre(hoy, desde) <= 7 ? 'antes' : null;
  if (hoy <= hasta) return 'durante';
  return diasEntre(hasta, hoy) <= 7 ? 'vuelta' : null;
}
// Lo que come para mantener: lo que gasta (si la app ya lo sabe con precisión) o su plan sin el déficit o el superávit
export function mantenimientoDe({ plan = null, gasto = null, pesoKg = null } = {}) {
  if (gasto?.kcal && gasto.fiabilidad && gasto.fiabilidad !== 'baja') return r50(gasto.kcal);
  const k = kcalDe(plan), ritmo = Number(plan?.ritmo_pct || 0);
  if (!(k > 0)) return null;
  return r50(k - (pesoKg > 0 ? (ritmo / 100) * pesoKg * KCAL_POR_KG / 7 : 0));
}

// ---------- (110, P) Celebraciones: el peso de ese día y de los dos siguientes no cuenta para el ajuste ----------
// celebraciones: ['AAAA-MM-DD'] → los pesos sin esos días
export function pesosSinCelebraciones(pesos = [], celebraciones = []) {
  const fuera = new Set();
  for (const f of celebraciones || []) if (/^\d{4}-\d{2}-\d{2}$/.test(String(f))) for (let i = 0; i <= 2; i++) fuera.add(sumarDias(String(f), i));
  return (pesos || []).filter((p) => !fuera.has(String(p.fecha).slice(0, 10)));
}

// ---------- El ajuste de la semana, con las dos reglas nuevas (apagadas: viaje y celebraciones) ----------
// r: lo de api.resumenNutricion. reglas: { viaje: 'durante' | 'vuelta' | … (si la regla está encendida), celebraciones:
// [fechas] (si está encendida) }. → lo mismo que ajusteComidaEsencial (o null), sin tocar sus topes ni su cálculo.
export function ajusteConReglas(r = {}, { hoy, tca = false, viaje = null, celebraciones = [] } = {}) {
  if (!r?.plan) return null;
  if (viaje === 'durante' || viaje === 'vuelta') return null;
  let gasto = r.gasto;
  if ((celebraciones || []).length && (r.pesos || []).length) {
    const planes = r.planes || [r.plan];
    const entrenos = r.entrenos instanceof Set ? r.entrenos : new Set(r.entrenos || []);
    const objetivoDe = (f) => objetivoDelDia(planVigente(planes, f), entrenos.has(f))?.kcal ?? null;
    gasto = gastoAdaptativo({ registros: r.registros || [], pesos: pesosSinCelebraciones(r.pesos, celebraciones) }, hoy, { objetivoDe });
  }
  return ajusteComidaEsencial({ plan: r.plan, gasto, pesoKg: r.pesoKg, diasEntreno: r.diasEntreno ?? 2, tca, hoy });
}

// ---------- (111, P) Bajar demasiado deprisa · (112, P) El peso parado tres semanas ----------
// Solo para quien busca perder (con TCA, su plan es mantener: nunca). → { clave, titulo, texto } o null
export const LIMITE_DEPRISA = -1;  // % del peso por semana
// Los textos (Pelayo los puede corregir en su panel: «aviso_peso:deprisa» y «aviso_peso:parado»); el dato, aparte
export const AVISOS_PESO = {
  deprisa: ['Estás bajando más deprisa de lo previsto', 'Bajar tan deprisa se lleva también músculo y cuesta mantenerlo: en el ajuste de la semana, si tiene días apuntados y pesadas de sobra, la app sube tu plan. Si notas mucha hambre o que no rindes, no esperes: come un poco más y apúntalo.'],
  parado: ['Tu peso lleva tres semanas parado', 'Pasa, y no siempre es que no baje la grasa: el agua y la sal tapan unas semanas lo que pasa debajo. Si tienes días apuntados y pesadas de sobra, la app baja tu plan en el ajuste de la semana; si no, lo que más ayuda es completar lo que apuntas, también el fin de semana. Y si te está costando, también vale pasar a mantener unas semanas («Cambiar mi objetivo o mis datos», en tu plan de comida).'],
};
// → { clave: 'deprisa' | 'parado', dato: la frase con sus cifras (o null) } o null
export function avisoDelPeso({ plan = null, planes = [], pesos = [] } = {}, { hoy, tca = false } = {}) {
  if (tca || !plan || !(Number(plan.ritmo_pct) < 0)) return null;
  const serie = tendenciaPeso((pesos || []).filter((p) => p.fecha <= hoy && Number(p.kg) > 0));
  if (!serie.length || diasEntre(serie[serie.length - 1].fecha, hoy) > 7) return null;
  const tres = ritmoPeso(serie, 21);
  const dos = ritmoPeso(serie, 14);
  const primero = ordenados(planes.length ? planes : [plan])[0];
  if (dos && dos.dias >= 10 && dos.pctSemana <= LIMITE_DEPRISA) {
    return { clave: 'deprisa', dato: `Tu tendencia baja un ${num(Math.abs(dos.pctSemana))} % a la semana y tu plan busca un ${num(Math.abs(Number(plan.ritmo_pct)))} %.` };
  }
  if (tres && tres.dias >= 18 && Math.abs(tres.pctSemana) < 0.1 && primero && diasEntre(primero.desde, hoy) >= 28) return { clave: 'parado', dato: null };
  return null;
}

// ---------- (116) Cambiar de objetivo: qué cambia y cuándo ----------
export function cambioDeObjetivo(actual = null, nuevo = null) {
  if (!actual || !nuevo || !(Number(actual.kcal) > 0) || !(Number(nuevo.kcal) > 0)) return null;
  const dk = Math.round(Number(nuevo.kcal) - Number(actual.kcal));
  const kcal = dk === 0 ? `Tus kcal se quedan en ${fmtKcal(nuevo.kcal)} al día` : `Pasas de ${fmtKcal(actual.kcal)} a ${fmtKcal(nuevo.kcal)} kcal al día`;
  const prot = Number(actual.proteina_g) !== Number(nuevo.proteina_g) ? ` y de ${num(actual.proteina_g, 0)} a ${num(nuevo.proteina_g, 0)} g de proteína` : '';
  return `${kcal}${prot}. Tu plan nuevo empieza hoy; la app lo vuelve a ajustar cuando cumpla una semana, con lo que apuntes y lo que peses.`;
}

// ---------- (117) «Tu trimestre», con la comida: el ritmo real frente al previsto ----------
// peso: { antes, ahora, fechaAntes, fechaAhora } (antesYAhora); plan: el vigente → { nombre, texto } o null
export function ritmoDelTrimestre(peso = null, plan = null) {
  if (!peso || !plan || plan.ritmo_pct == null || !(Number(peso.antes) > 0)) return null;
  const dias = diasEntre(peso.fechaAntes, peso.fechaAhora);
  if (!(dias >= 14)) return null;
  const pct = ((Number(peso.ahora) - Number(peso.antes)) / Number(peso.antes)) * 100 / (dias / 7);
  const previsto = Number(plan.ritmo_pct);
  return { nombre: 'Tu ritmo', texto: `${signo(Math.round(pct * 100) / 100, 2)} % a la semana (lo previsto: ${previsto === 0 ? 'mantener' : `${signo(previsto, 2)} %`})` };
}

// ---------- (118) Tu panel: quién no se pesa, quién no apunta y cuántos ajustes ha hecho la app ----------
// filas: las de esencial_comida_panel() [{ atleta_id, plan, tca, pesadas_14, dias_7, ajustes, ajustes_7 }]; nombres: { id: nombre }
export function panelComida(filas = [], nombres = {}) {
  const xs = (filas || []).filter((f) => f && f.atleta_id);
  if (!xs.length) return null;
  const nombre = (f) => nombres[f.atleta_id] || 'Sin nombre';
  const conPlan = xs.filter((f) => f.plan);
  return {
    total: xs.length, conPlan: conPlan.length, sinPlan: xs.filter((f) => !f.plan).map(nombre),
    sinPesar: conPlan.filter((f) => !f.tca && Number(f.pesadas_14) === 0).map(nombre),
    sinApuntar: conPlan.filter((f) => Number(f.dias_7) === 0).map(nombre),
    ajustes: conPlan.reduce((a, f) => a + (Number(f.ajustes) || 0), 0),
    ajustes7: conPlan.reduce((a, f) => a + (Number(f.ajustes_7) || 0), 0),
  };
}

// ---------- (114, P) Cuatro lecciones que saltan cuando toca ----------
export const LECCIONES_COMIDA = {
  primer_ajuste: ['Tu primer ajuste', 'La app ha cambiado tu plan por primera vez. No sale de una fórmula: sale de lo que comes y de cómo cambia tu peso. Cambios pequeños y de semana en semana: así no se notan en el hambre ni en el entreno.'],
  sin_bajar: ['Una semana sin bajar', 'Pasa a menudo y no quiere decir que no funcione: el agua tapa unos días lo que baja. Lo que cuenta es la tendencia de varias semanas, no la de una.'],
  primer_finde: ['Tu primer fin de semana', 'El fin de semana se come distinto, y está bien. Apúntalo igual: un fin de semana normal está dentro de tu plan; lo único que no sirve es dejarlo en blanco.'],
  primera_fuera: ['Tu primera comida fuera', 'Comer fuera no rompe nada. Elige con calma, apunta una estimación y al día siguiente, tu plan de siempre.'],
};
// vistas: Set de las ya vistas; fuera: si ha abierto «Hoy como fuera» → la clave de la que toca, o null
export function leccionComida({ planes = [], ritmo = null, plan = null } = {}, { hoy, tca = false, vistas = new Set(), fuera = false } = {}) {
  const xs = ordenados(planes);
  if (!xs.length) return null;
  const toca = [];
  const ajustes = xs.filter((p) => esAjuste(p));
  if (ajustes.length >= 1 && diasEntre(ajustes[0].desde, hoy) < 7) toca.push('primer_ajuste');
  if (!tca && plan && Number(plan.ritmo_pct) < 0 && ritmo && Number(ritmo.dias) >= 7 && Number(ritmo.pctSemana) >= 0 && diasEntre(xs[0].desde, hoy) >= 14) toca.push('sin_bajar');
  const d0 = diasEntre(xs[0].desde, hoy);
  if (d0 >= 2 && d0 <= 9 && lunesDe(hoy) === hoy) toca.push('primer_finde');
  if (fuera) toca.push('primera_fuera');
  return toca.find((k) => !vistas.has(k)) || null;
}

// ---------- (113, P) El check-in contesta al hambre y a la energía (quien lleva nutrición) ----------
// f: el check-in ({ saciedad 1-4, 4 = muy saciado; energia 1-5, 5 = descansado }); plan: el vigente
export function checkinComida(f = {}, { plan = null, tca = false } = {}) {
  const out = [];
  const perder = !tca && Number(plan?.ritmo_pct) < 0;
  if (Number(f?.saciedad) === 1) out.push(`Con tanta hambre, reparte la proteína en todas tus comidas y añade verdura y fruta: llenan con pocas calorías.${perder ? ' Si sigue dos semanas, pasa a mantener unas semanas en tu plan de comida.' : ''}`);
  if (f?.energia != null && Number(f.energia) >= 1 && Number(f.energia) <= 2 && perder) out.push('Con poca energía y comiendo para perder, mira que estés comiendo tu plan entero, también los días de descanso: comer de menos no acelera nada.');
  return out;
}

// ---------- (103) «¿Qué necesitas?» de comida ----------
// [id, etiqueta, icono, qué abre, la clave con la que está apagado (o null), sin TCA]
export const NECESITAS_COMIDA = [
  ['proteina', 'No llego a la proteína', 'nutricion', 'proteina', null, false],
  ['fuera', 'Hoy como fuera', 'receta', 'fuera', 'comida_fuera', false],
  ['hambre', 'Tengo mucha hambre', 'nutricion', 'hambre', 'hambre', false],
  ['pasado', 'Me he pasado', 'reiniciar', 'pasado', 'me_he_pasado', true],
  ['celebracion', 'Tengo una celebración', 'calendario', 'celebracion', 'celebracion', false],
  ['pesarme', '¿Cuándo me peso?', 'bascula', 'pesarme', null, true],
];
// encendido: (clave) => boolean (el de esencial-respuestas.js, con la vista previa)
export function necesitasComida({ conPlan = false, tca = false, encendido = () => false } = {}) {
  if (!conPlan) return [];
  return NECESITAS_COMIDA.filter(([, , , , clave, sinTca]) => (!sinTca || !tca) && (!clave || encendido(clave))).map(([id, t, icono, que]) => [id, t, icono, que]);
}

// ---------- Los textos de las hojas (los de (P), apagados) ----------
export const HOJAS_COMIDA = {
  pesarme: { titulo: 'Cuándo y cómo pesarte', lineas: [
    'Por la mañana, en ayunas, después de ir al baño y antes de beber nada.',
    'Mejor varios días a la semana (lo ideal, a diario): la app mira tu tendencia, no el peso de un día. El de un día cambia con el agua, la sal y la hora.',
    'Para ajustar tu plan, la app necesita al menos seis pesadas repartidas en diez días o más, y una de esta semana.',
  ] },
  fuera: { titulo: 'Hoy como fuera', lineas: [
    'Sin apuntar gramos: elige un plato con proteína (carne, pescado, huevos o legumbre) y acompáñalo de verdura o ensalada.',
    'El pan, el postre y la bebida con calorías, si aún tienes hambre: no hace falta todo a la vez.',
    'Al apuntarlo, una estimación vale: es mejor que dejar el día en blanco.',
  ] },
  pasado: { titulo: 'Me he pasado', lineas: [
    'Un día no cambia nada. Mañana, tu plan de siempre: no hace falta compensar comiendo menos ni entrenando más.',
    'La báscula de mañana no dice la verdad: es agua y sal, y se va en un par de días.',
    'Apúntalo tal cual. La app no cambia tu plan por un día: mira cuatro semanas, y un día suelto apenas mueve la media.',
  ] },
  hambre: { titulo: 'Tengo mucha hambre', lineas: [
    'Si es de vez en cuando, es normal comiendo para perder.',
    'Si es cada día: reparte la proteína en todas tus comidas, añade verdura y fruta (llenan con pocas calorías) y no dejes pasar muchas horas sin comer.',
    'Si sigue más de una semana, pasa a mantener unas semanas en tu plan de comida: no hace falta pasarlo mal para avanzar.',
  ] },
  celebracion: { titulo: 'Tengo una celebración', lineas: [
    'Ese día, disfruta: no hace falta compensar ni antes ni después.',
    'Los dos días siguientes la báscula sube por el agua y la sal. Si apuntas aquí el día, la app no usa esos pesos para bajar tu plan.',
  ] },
};

// ---------- (104, P) Quince respuestas de comida (centro de respuestas, tema «La comida») ----------
// deficit: habla de comer para perder, de bajar el plan o de pesarse (con antecedente de TCA no sale)
export const RESPUESTAS_COMIDA = [
  { id: 'c-calculo', q: '¿Cómo se calcula mi plan?', r: 'Con tus datos (sexo, edad, altura, peso y cuánto te mueves) la app estima lo que gastas y le suma o le resta según tu objetivo: perder, un 0,5 % de tu peso a la semana; mantener; o ganar, un 0,25 %. De ahí salen tus kcal, tu proteína, tus hidratos y tu grasa.', deficit: true },
  { id: 'c-cambia', q: '¿Cada cuánto cambia mi plan?', r: 'Como mucho una vez a la semana. La app mira lo que has comido y cómo ha cambiado tu peso en las últimas cuatro semanas y, si hace falta, lo ajusta: como mucho 300 kcal de una vez y nunca por debajo de 1.200.', deficit: true },
  { id: 'c-no-cambia', q: '¿Por qué no cambia mi plan?', r: 'Porque le faltan datos, porque va bien o porque acaba de cambiar. Para ajustarlo necesita al menos diez días apuntados en cuatro semanas y seis pesadas repartidas en diez días o más. En tu revisión de la semana te dice cuál es tu caso.' },
  { id: 'c-apuntar', q: '¿Tengo que apuntar todo lo que como?', r: 'Cuanto más completo, mejor ajusta la app. Un día a medias no le sirve (lo descarta para no equivocarse), así que, si un día no puedes, mejor una estimación que dejarlo en blanco.' },
  { id: 'c-pesarme', q: '¿Cuándo me peso?', r: 'Por la mañana, en ayunas y después de ir al baño, varios días a la semana. La app mira la tendencia, no el peso de un día.', deficit: true },
  { id: 'c-pasado', q: 'Me he pasado un día', r: 'No pasa nada y no hay que compensar: mañana, tu plan de siempre. Apúntalo tal cual: un día suelto apenas mueve la media de cuatro semanas.', deficit: true },
  { id: 'c-fuera', q: 'Hoy como fuera', r: 'Elige un plato con proteína y verdura, y el resto según el hambre. Apunta una estimación: vale más que un día en blanco.' },
  { id: 'c-hambre', q: 'Tengo mucha hambre', r: 'Reparte la proteína en todas las comidas, añade verdura y fruta y no dejes pasar muchas horas sin comer. Si dura más de una semana, pasa a mantener unas semanas.', deficit: true },
  { id: 'c-proteina', q: 'No llego a la proteína', r: 'Pon una ración de proteína en cada comida (carne, pescado, huevos, lácteos o legumbre). En «¿Qué necesitas?», «No llego a la proteína» te enseña lo que llevas hoy y tres recetas del recetario con mucha proteína.' },
  { id: 'c-finde', q: '¿Y los fines de semana?', r: 'Se come distinto, y está bien: apúntalo igual. La app ajusta con la media de cuatro semanas, fines de semana incluidos.' },
  { id: 'c-descanso', q: '¿Como lo mismo los días que no entreno?', r: 'Sí: tu plan es el mismo todos los días. Lo que cuenta es la media de la semana.' },
  { id: 'c-alcohol', q: '¿Y el alcohol?', r: 'Cuenta como calorías y no aporta nada a tu plan. Si bebes, apúntalo: así la app ajusta con lo que comes de verdad.' },
  { id: 'c-objetivo', q: '¿Puedo cambiar de objetivo?', r: 'Sí, cuando quieras, en tu plan de comida («Cambiar mi objetivo o mis datos»): el plan nuevo empieza ese día y la app lo vuelve a ajustar cuando cumpla una semana.' },
  { id: 'c-celebracion', q: 'Tengo una celebración', r: 'Disfrútala, sin compensar. Si la apuntas en «¿Qué necesitas?», la app no usa el peso de esos días para bajar tu plan.', deficit: true },
  { id: 'c-deprisa', q: 'Estoy bajando muy deprisa', r: 'Más de un 1 % de tu peso a la semana es demasiado: se lleva también músculo. La app sube tu plan en el ajuste de la semana si tiene datos; si notas mucha hambre o que no rindes, come un poco más y apúntalo.', deficit: true },
];
export const respuestasComida = ({ tca = false } = {}) => RESPUESTAS_COMIDA.filter((x) => !tca || !x.deficit).map((x) => ({ ...x, cat: 'comida' }));
