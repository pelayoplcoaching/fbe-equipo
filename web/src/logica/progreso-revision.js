// v0.194: el progreso del atleta, de un vistazo, en la revisión semanal. Todo puro: recibe lo que ya hay en la base
// (pesos, medidas, objetivo de peso, plan de nutrición, registros, menú, check-ins, Salud del iPhone, hábito de pasos)
// y devuelve las comparaciones, el semáforo de cuatro puntos (peso, medidas, comida, descanso) y una frase.
// Los umbrales del semáforo están juntos en UMBRALES_PROGRESO: son el criterio del coach, para cambiarlos en un sitio.
import { tendenciaPeso, ritmoPeso } from './calculos.js';
import { progresoPeso } from './objetivos.js';

export const UMBRALES_PROGRESO = {
  // Peso (ritmo de la tendencia, % del peso por semana, frente al que busca su plan)
  pesoMargenRelativo: 0.3,      // verde: a ±30 % del ritmo buscado...
  pesoMargenMinimo: 0.15,       // ...o, si eso es muy poco, a ±0,15 puntos
  pesoRapido: 1,                // rojo: un 1 %/semana o más fuera de lo buscado
  pesoMantenerAmbar: 0.25,      // mantener: verde hasta ±0,25 %/semana, ámbar hasta ±0,5, rojo más
  pesoMantenerRojo: 0.5,
  // Medidas (cintura, cm desde la medición anterior)
  cinturaEstable: 0.5,
  cinturaRojo: 1,               // perder o recomposición: rojo si sube 1 cm o más
  cinturaRojoGanar: 2,          // ganar: rojo si sube 2 cm o más
  medidasViejas: 28,            // días: más de 4 semanas sin medirse, ámbar (y «pedírselo»)
  // Comida (adherencia media del check-in, de 1 a 5; o el % del menú marcado como hecho)
  adherenciaVerde: 4,
  adherenciaAmbar: 3,
  menuVerde: 80,
  menuAmbar: 60,
  // Descanso
  suenoVerde: 7,                // horas por noche
  suenoAmbar: 6,
  nocheCorta: 6,
  fcSube: 5,                    // pulso en reposo: +5 ppm sobre su media de las 4 semanas anteriores, aviso
  hrvBaja: 15,                  // VFC: un 15 % por debajo de su media de las 4 semanas anteriores, aviso
};
const U = UMBRALES_PROGRESO;

// ---------------------------------------------------------------- utilidades
const dia = (iso) => String(iso || '').slice(0, 10);
const masDias = (iso, n) => { const d = new Date(`${dia(iso)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.round((Date.parse(`${dia(b)}T12:00:00Z`) - Date.parse(`${dia(a)}T12:00:00Z`)) / 86400000);
const r1 = (x) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 10) / 10);
const r2 = (x) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100) / 100);
const media = (xs) => { const v = (xs || []).map(Number).filter((x) => Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
export const num = (x, d = 1) => (x == null ? '-' : Number(x).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: d }));
export const conSigno = (x, d = 1) => (x == null ? '-' : `${x > 0 ? '+' : x < 0 ? '−' : '±'}${num(Math.abs(x), d)}`);
const nombreCorto = (n) => String(n || '').split(' ')[0];
const PEOR = { rojo: 3, ambar: 2, verde: 1, gris: 0 };

// Las n semanas (lunes) que acaban en la de `lunes`, de la más antigua a la más nueva
export const semanasHasta = (lunes, n) => Array.from({ length: n }, (_, i) => masDias(lunes, -7 * (n - 1 - i)));
const enSemana = (fecha, l) => dia(fecha) >= l && dia(fecha) <= masDias(l, 6);

// ---------------------------------------------------------------- peso
const RITMO_TIPICO = { perder: -0.5, ganar: 0.25, mantener: 0, recomposicion: 0 };
export function buscaRitmo(plan) {
  const r = plan?.ritmo_pct;
  if (r != null && r !== '' && Number.isFinite(Number(r))) return Number(r);
  return plan?.fase ? RITMO_TIPICO[plan.fase] ?? null : null;
}
// Estado del peso según el ritmo real (de la tendencia) frente al buscado; contrario: las dos últimas medias semanales
// se han movido en sentido contrario al buscado
export function estadoRitmo(pct, busca, contrario = false) {
  if (pct == null) return 'gris';
  if (busca == null) return 'gris';
  if (Math.abs(busca) < 0.1) {
    const a = Math.abs(pct);
    return a <= U.pesoMantenerAmbar ? 'verde' : a <= U.pesoMantenerRojo ? 'ambar' : 'rojo';
  }
  const desvio = Math.abs(pct - busca);
  if (desvio >= U.pesoRapido || contrario) return 'rojo';
  if (desvio <= Math.max(U.pesoMargenRelativo * Math.abs(busca), U.pesoMargenMinimo)) return 'verde';
  return 'ambar';
}
export function progresoDePeso({ pesos = [], plan = null, objetivo = null, lunes, hoy }) {
  const semanas = semanasHasta(lunes, 8).map((l) => {
    const xs = pesos.filter((p) => enSemana(p.fecha, l)).map((p) => Number(p.kg)).filter((x) => x > 0);
    return { lunes: l, media: r2(media(xs)), dias: xs.length };
  });
  const conDatos = semanas.filter((w) => w.media != null);
  const esta = conDatos[conDatos.length - 1] || null;
  const antes = esta ? [...semanas].reverse().find((w) => w.lunes < esta.lunes && w.media != null) || null : null;
  const serie = tendenciaPeso(pesos.filter((p) => dia(p.fecha) <= (hoy || masDias(lunes, 6))));
  const ult = serie[serie.length - 1];
  const reciente = ult && diasEntre(ult.fecha, hoy || masDias(lunes, 6)) <= 14;
  const ritmo = reciente ? ritmoPeso(serie) : null;
  const busca = buscaRitmo(plan);
  // ¿Las dos últimas medias semanales van en contra de lo buscado?
  const ult3 = conDatos.slice(-3);
  const contrario = busca != null && Math.abs(busca) >= 0.1 && ult3.length === 3
    && Math.sign(ult3[1].media - ult3[0].media) === -Math.sign(busca) && Math.sign(ult3[2].media - ult3[1].media) === -Math.sign(busca)
    && Math.abs(ult3[2].media - ult3[0].media) >= 0.2;
  const estado = estadoRitmo(ritmo?.pctSemana ?? null, busca, contrario);
  const obj = objetivo ? progresoPeso(objetivo, pesos, hoy || masDias(lunes, 6)) : null;
  const buscaKg = busca != null && ult ? r2((busca / 100) * ult.tendencia) : null;
  const dif = esta && antes ? r2(esta.media - antes.media) : null;
  return {
    esta, antes, dif, difPct: dif != null ? r1((dif / antes.media) * 100) : null, semanas,
    diasEsta: semanas[semanas.length - 1].dias,
    ritmo, busca, buscaKg, contrario, estado, fase: plan?.fase || null,
    meta: obj?.meta ?? null, actual: obj?.actual ?? (ult ? r1(ult.tendencia) : null),
    falta: obj?.meta != null && obj?.actual != null ? r1(obj.meta - obj.actual) : null,
    llegado: !!obj?.llegado, prevision: obj?.prevision || null, alejandose: !!obj?.alejandose,
    sinPesos: !pesos.length,
  };
}
export function textoRitmo(p) {
  if (!p.ritmo) return p.sinPesos ? 'Sin pesos' : 'Faltan pesos para ver su ritmo';
  const real = `${p.ritmo.kgSemana < 0 ? 'baja' : p.ritmo.kgSemana > 0 ? 'sube' : 'se mantiene'} ${num(Math.abs(p.ritmo.kgSemana), 2)} kg/semana`;
  if (p.buscaKg == null) return `${real.charAt(0).toUpperCase()}${real.slice(1)}`;
  const quiere = Math.abs(p.busca) < 0.1 ? 'su plan busca mantener' : `su plan busca ${p.buscaKg < 0 ? 'bajar' : 'subir'} ${num(Math.abs(p.buscaKg), 2)}`;
  return `${real.charAt(0).toUpperCase()}${real.slice(1)}; ${quiere}`;
}

// ---------------------------------------------------------------- medidas
export const PERIMETROS = [['cintura_cm', 'Cintura'], ['cadera_cm', 'Cadera'], ['pecho_cm', 'Pecho'], ['brazo_cm', 'Brazo'], ['muslo_cm', 'Muslo'], ['pantorrilla_cm', 'Pantorrilla']];
const conAlguna = (m) => PERIMETROS.some(([k]) => m[k] != null && Number(m[k]) > 0);
export function progresoDeMedidas({ medidas = [], fase = null, bloqueInicio = null, hoy, peso = null }) {
  const lista = medidas.filter(conAlguna).sort((a, b) => (dia(a.fecha) < dia(b.fecha) ? -1 : 1)).filter((m) => dia(m.fecha) <= hoy);
  if (!lista.length) return { estado: 'gris', nunca: true, cambios: [], pedir: false };
  const ultima = lista[lista.length - 1], anterior = lista.length > 1 ? lista[lista.length - 2] : null;
  const primera = bloqueInicio ? lista.find((m) => dia(m.fecha) >= dia(bloqueInicio)) || null : null;
  const delBloque = primera && primera !== ultima ? primera : null;
  const cambios = PERIMETROS.filter(([k]) => ultima[k] != null).map(([k, etq]) => ({
    clave: k, etiqueta: etq, ultima: r1(ultima[k]),
    dif: anterior?.[k] != null ? r1(ultima[k] - anterior[k]) : null,
    difBloque: delBloque?.[k] != null ? r1(ultima[k] - delBloque[k]) : null,
  }));
  const diasDesde = diasEntre(ultima.fecha, hoy);
  const cintura = cambios.find((c) => c.clave === 'cintura_cm');
  let estado = 'gris';
  if (cintura?.dif != null) {
    const d = cintura.dif;
    if (fase === 'ganar') estado = d >= U.cinturaRojoGanar ? 'rojo' : d > U.cinturaRojo ? 'ambar' : 'verde';
    else if (fase === 'mantener') estado = Math.abs(d) >= U.cinturaRojoGanar ? 'rojo' : Math.abs(d) > U.cinturaRojo ? 'ambar' : 'verde';
    else estado = d >= U.cinturaRojo ? 'rojo' : d > U.cinturaEstable ? 'ambar' : 'verde';
  }
  const viejas = diasDesde > U.medidasViejas;
  if (viejas && estado !== 'rojo') estado = 'ambar';
  // Peso y cintura juntos: lo que dicen a la vez
  let juntos = null;
  if (cintura?.dif != null && peso?.dif != null) {
    const pt = Math.abs(peso.dif) < 0.3 ? 'peso estable' : `peso ${conSigno(peso.dif)} kg`;
    const ct = Math.abs(cintura.dif) < U.cinturaEstable ? 'cintura estable' : `cintura ${conSigno(cintura.dif)} cm`;
    const lectura = Math.abs(peso.dif) < 0.3 && cintura.dif <= -U.cinturaEstable ? ': buena señal de recomposición'
      : peso.dif >= 0.3 && cintura.dif >= U.cinturaRojo && fase !== 'ganar' ? ': sube por grasa más que por músculo, probablemente' : '';
    juntos = `${pt.charAt(0).toUpperCase()}${pt.slice(1)} y ${ct}${lectura}`;
  }
  return { estado, nunca: false, ultima: dia(ultima.fecha), anterior: anterior ? dia(anterior.fecha) : null, primeraBloque: delBloque ? dia(delBloque.fecha) : null, cambios, diasDesde, pedir: viejas, juntos };
}

// ---------------------------------------------------------------- comida
export const COMIDAS = [['adherencia_desayuno', 'Desayuno'], ['adherencia_comida', 'Comida'], ['adherencia_merienda', 'Merienda'], ['adherencia_cena', 'Cena']];
const adhMedia = (c) => (c ? media(COMIDAS.map(([k]) => c[k]).filter((x) => x != null && Number(x) > 0)) : null);
const ckDe = (checkins, l) => (checkins || []).find((c) => dia(c.semana_inicio) === l) || null;
export function progresoDeComida({ checkins = [], menu = [], registros = [], plan = null, lunes }) {
  const sem6 = semanasHasta(lunes, 6);
  // El check-in de esta semana o, si aún no lo ha mandado, el de la pasada
  const lEsta = ckDe(checkins, lunes) ? lunes : masDias(lunes, -7);
  const c = ckDe(checkins, lEsta), cAntes = ckDe(checkins, masDias(lEsta, -7));
  const esta = r1(adhMedia(c)), antes = r1(adhMedia(cAntes));
  const porComida = COMIDAS.filter(([k]) => c?.[k] != null).map(([k, etq]) => ({ clave: k, etiqueta: etq, esta: Number(c[k]), antes: cAntes?.[k] != null ? Number(cAntes[k]) : null }));
  const peor = porComida.length > 1 ? [...porComida].sort((a, b) => a.esta - b.esta)[0] : null;
  const serie = sem6.map((l) => ({ lunes: l, valor: r1(adhMedia(ckDe(checkins, l))) }));
  // Menú: lo pautado en la semana y lo marcado como hecho, día a día
  const dias = Array.from({ length: 7 }, (_, i) => { const f = masDias(lunes, i); const xs = menu.filter((m) => dia(m.fecha) === f); return { fecha: f, total: xs.length, hechas: xs.filter((m) => m.hecho).length }; });
  const total = dias.reduce((t, d) => t + d.total, 0), hechas = dias.reduce((t, d) => t + d.hechas, 0);
  const menuAntes = menu.filter((m) => enSemana(m.fecha, masDias(lunes, -7)));
  const pctMenu = total ? Math.round((hechas / total) * 100) : null;
  const pctMenuAntes = menuAntes.length ? Math.round((menuAntes.filter((m) => m.hecho).length / menuAntes.length) * 100) : null;
  // Calorías: lo que apunta (registros completos de la semana) o la media del check-in, frente a su plan
  const regs = registros.filter((r) => enSemana(r.fecha, lunes));
  const kcalReg = media(regs.filter((r) => r.completo !== false && Number(r.kcal) > 0).map((r) => r.kcal));
  const kcal = kcalReg != null ? Math.round(kcalReg) : c?.calorias_media != null ? Number(c.calorias_media) : null;
  const kcalPlan = plan?.kcal ? Number(plan.kcal) : null;
  let estado = 'gris';
  if (esta != null) estado = esta >= U.adherenciaVerde ? 'verde' : esta >= U.adherenciaAmbar ? 'ambar' : 'rojo';
  else if (pctMenu != null) estado = pctMenu >= U.menuVerde ? 'verde' : pctMenu >= U.menuAmbar ? 'ambar' : 'rojo';
  return {
    estado, deEstaSemana: lEsta === lunes, adherencia: { esta, antes, porComida, peor }, serie,
    menu: { dias, total, hechas, pct: pctMenu, pctAntes: pctMenuAntes },
    kcal: kcal != null ? { media: kcal, plan: kcalPlan, dif: kcalPlan ? kcal - kcalPlan : null, fuente: kcalReg != null ? 'registro' : 'checkin', dias: regs.length } : null,
    saciedad: c?.saciedad ?? null, saciedadAntes: cAntes?.saciedad ?? null,
    satisfaccion: c?.satisfaccion_dieta ?? null,
    diasApuntados: regs.length,
  };
}

// ---------------------------------------------------------------- descanso
const TRAMO_H = { '<5': 4.5, '5-6': 5.5, '6-7': 6.5, '7-8': 7.5, '>8': 8.5 };
export function progresoDeDescanso({ checkins = [], salud = null, pasosObjetivo = null, lunes }) {
  const sl = (salud || []).filter((d) => d && d.fecha);
  const deSem = (l) => sl.filter((d) => enSemana(d.fecha, l));
  const lEsta = ckDe(checkins, lunes) ? lunes : masDias(lunes, -7);
  const c = ckDe(checkins, lEsta), cAntes = ckDe(checkins, masDias(lEsta, -7));
  // Sueño: del iPhone si lo tiene (horas medias y noches cortas), si no, el tramo del check-in
  const suenoSalud = (l) => { const xs = deSem(l).map((d) => Number(d.sueno_min)).filter((x) => x > 0); return xs.length ? { h: r1(media(xs) / 60), cortas: xs.filter((x) => x < U.nocheCorta * 60).length, noches: xs.length } : null; };
  const sE = suenoSalud(lunes) || suenoSalud(masDias(lunes, -7));
  const sA = sE ? suenoSalud(masDias(suenoSalud(lunes) ? lunes : masDias(lunes, -7), -7)) : null;
  const sueno = sE ? { esta: sE.h, antes: sA?.h ?? null, cortas: sE.cortas, noches: sE.noches, fuente: 'salud' }
    : c?.horas_sueno ? { esta: TRAMO_H[c.horas_sueno] ?? null, antes: cAntes?.horas_sueno ? TRAMO_H[cAntes.horas_sueno] ?? null : null, tramo: c.horas_sueno, tramoAntes: cAntes?.horas_sueno || null, cortas: null, fuente: 'checkin' } : null;
  // Pasos
  const pasosSalud = (l) => r1(media(deSem(l).map((d) => d.pasos).filter((x) => x != null && Number(x) > 0)));
  const pE = pasosSalud(lunes) ?? pasosSalud(masDias(lunes, -7));
  const pasos = pE != null ? { esta: Math.round(pE), antes: (() => { const x = pasosSalud(masDias(pasosSalud(lunes) != null ? lunes : masDias(lunes, -7), -7)); return x != null ? Math.round(x) : null; })(), objetivo: pasosObjetivo, fuente: 'salud' }
    : c?.pasos_media != null ? { esta: Number(c.pasos_media), antes: cAntes?.pasos_media != null ? Number(cAntes.pasos_media) : null, objetivo: pasosObjetivo, fuente: 'checkin' } : null;
  // Pulso en reposo y VFC: la semana frente a su media de las 4 anteriores
  const valSem = (campo, l) => { const xs = deSem(l).map((d) => d[campo]).filter((x) => x != null && Number(x) > 0); if (xs.length) return media(xs); const ck = ckDe(checkins, l); return ck?.[campo] != null && Number(ck[campo]) > 0 ? Number(ck[campo]) : null; };
  const comparaBase = (campo) => {
    const esta = valSem(campo, lunes) ?? valSem(campo, masDias(lunes, -7));
    if (esta == null) return null;
    const desde = valSem(campo, lunes) != null ? lunes : masDias(lunes, -7);
    const base = media([1, 2, 3, 4].map((i) => valSem(campo, masDias(desde, -7 * i))).filter((x) => x != null));
    return { esta: r1(esta), base: base != null ? r1(base) : null, dif: base != null ? r1(esta - base) : null, difPct: base ? r1(((esta - base) / base) * 100) : null };
  };
  const fc = comparaBase('fc_reposo'), hrv = comparaBase('hrv');
  // Energía, recuperación y motivación de las 6 últimas semanas
  const sem6 = semanasHasta(lunes, 6);
  const series = Object.fromEntries(['energia', 'recuperacion', 'motivacion'].map((k) => [k, sem6.map((l) => ({ lunes: l, valor: ckDe(checkins, l)?.[k] ?? null }))]));
  let estado = 'gris';
  if (sueno?.esta != null) estado = sueno.esta >= U.suenoVerde ? 'verde' : sueno.esta >= U.suenoAmbar ? 'ambar' : 'rojo';
  const avisos = [];
  if (fc?.dif != null && fc.dif >= U.fcSube) avisos.push(`pulso en reposo ${conSigno(fc.dif, 0)} ppm sobre su media`);
  if (hrv?.difPct != null && hrv.difPct <= -U.hrvBaja) avisos.push(`VFC un ${num(Math.abs(hrv.difPct), 0)} % por debajo de su media`);
  if (c?.recuperacion != null && Number(c.recuperacion) <= 2) avisos.push('recuperación baja en el check-in');
  if (avisos.length && estado === 'verde') estado = 'ambar';
  if (avisos.length && estado === 'gris') estado = 'ambar';
  return { estado, sueno, pasos, fc, hrv, series, avisos };
}

// ---------------------------------------------------------------- todo junto
export const PUNTOS = [['peso', 'Peso'], ['medidas', 'Medidas'], ['comida', 'Comida'], ['descanso', 'Descanso']];
export const TEXTO_ESTADO_PROGRESO = { verde: 'bien', ambar: 'a vigilar', rojo: 'mal', gris: 'sin datos' };
export function progresoAtleta(datos, { lunes, hoy, nombre = '' } = {}) {
  const d = datos || {};
  const h = hoy || masDias(lunes, 6);
  const peso = progresoDePeso({ pesos: d.pesos || [], plan: d.plan || null, objetivo: d.objetivo || null, lunes, hoy: h });
  const medidas = progresoDeMedidas({ medidas: d.medidas || [], fase: d.plan?.fase || null, bloqueInicio: d.bloqueInicio || null, hoy: h, peso });
  const comida = d.nutricion === false ? { estado: 'gris', fuera: true } : progresoDeComida({ checkins: d.checkins || [], menu: d.menu || [], registros: d.registros || [], plan: d.plan || null, lunes });
  const descanso = progresoDeDescanso({ checkins: d.checkins || [], salud: d.salud || null, pasosObjetivo: d.pasosObjetivo ?? null, lunes });
  const semaforo = { peso: peso.estado, medidas: medidas.estado, comida: comida.estado, descanso: descanso.estado };
  const est = Object.values(semaforo);
  return {
    peso, medidas, comida, descanso, semaforo,
    rojos: est.filter((x) => x === 'rojo').length, ambar: est.filter((x) => x === 'ambar').length,
    peorEstado: est.reduce((a, x) => (PEOR[x] > PEOR[a] ? x : a), 'gris'),
    // Cuánto se aleja de lo que busca (para ordenar): desvío del ritmo, en puntos de %/semana
    desvio: peso.ritmo && peso.busca != null ? Math.abs(peso.ritmo.pctSemana - peso.busca) : 0,
    frase: fraseProgreso({ peso, medidas, comida, descanso }),
    paraAtleta: lineasProgresoAtleta({ peso, medidas }, nombre),
  };
}

const ARTICULO = { Desayuno: 'el desayuno', Comida: 'la comida', Merienda: 'la merienda', Cena: 'la cena' };
// La frase de arriba, para el coach: lo esencial, en una línea
export function fraseProgreso({ peso, medidas, comida, descanso }) {
  const out = [];
  if (peso?.ritmo) {
    if (peso.busca == null) out.push(peso.ritmo.kgSemana < -0.05 ? 'Baja de peso' : peso.ritmo.kgSemana > 0.05 ? 'Sube de peso' : 'Peso estable');
    else out.push(peso.estado === 'verde' ? (Math.abs(peso.busca) < 0.1 ? 'Peso estable, como busca' : `${peso.busca < 0 ? 'Baja' : 'Sube'} al ritmo previsto`)
      : peso.contrario ? `El peso va al revés de lo buscado` : peso.estado === 'rojo' ? `${peso.ritmo.kgSemana < 0 ? 'Baja' : 'Sube'} demasiado rápido`
        : `${Math.abs(peso.ritmo.pctSemana) > Math.abs(peso.busca) ? 'Algo más rápido' : 'Algo más despacio'} de lo previsto`);
  } else if (peso && !peso.sinPesos) out.push('pocos pesos para ver su ritmo');
  else out.push('sin pesos');
  const cin = medidas?.cambios?.find((c) => c.clave === 'cintura_cm');
  if (medidas?.pedir) out.push(`sin medirse desde hace ${Math.round(medidas.diasDesde / 7)} semanas`);
  else if (cin?.dif != null && medidas.diasDesde <= 14) out.push(Math.abs(cin.dif) < U.cinturaEstable ? 'cintura estable' : `cintura ${conSigno(cin.dif)} cm`);
  if (comida && !comida.fuera) {
    if (comida.estado === 'verde') out.push('come bien');
    else if (comida.estado === 'ambar') out.push(comida.adherencia?.peor ? `le cuesta ${ARTICULO[comida.adherencia.peor.etiqueta] || comida.adherencia.peor.etiqueta.toLowerCase()}` : 'la comida, regular');
    else if (comida.estado === 'rojo') out.push('le cuesta seguir el plan');
  }
  if (descanso) {
    if (descanso.sueno?.esta != null && descanso.estado === 'rojo') out.push('duerme poco');
    else if (descanso.sueno?.esta != null && descanso.sueno.esta < U.suenoVerde) out.push('duerme algo justo');
    else if (descanso.sueno?.esta != null) out.push('descansa bien');
    if (descanso.avisos?.length) out.push(descanso.avisos[0]);
  }
  const t = out.filter(Boolean).join(', ');
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : '';
}

// Las líneas para el mensaje de repaso (al atleta, de tú): solo peso y medidas, que el resto ya lo cuenta el check-in
export function lineasProgresoAtleta({ peso, medidas }) {
  const out = [];
  if (peso?.esta && peso?.antes && peso.dif != null) {
    const base = `Peso medio de la semana: ${num(peso.esta.media, 1)} kg (${conSigno(peso.dif)} frente a la anterior)`;
    out.push(peso.estado === 'verde' && peso.busca != null ? `${base}, justo al ritmo que buscamos.` : `${base}.`);
  }
  const cin = medidas?.cambios?.find((c) => c.clave === 'cintura_cm');
  if (cin?.dif != null && medidas.diasDesde <= 10) out.push(`Cintura: ${num(cin.ultima)} cm (${conSigno(cin.dif)} desde la última medición).`);
  if (medidas?.pedir) out.push('Cuando puedas, mándame tus medidas: hace más de un mes de las últimas.');
  return out;
}

// ---------------------------------------------------------------- para la lista
// El orden «lo que peor va primero»: más rojos, más ámbar y, a igualdad, quien más se aleja de lo que busca
export function compararProgreso(a, b) {
  const pa = a?.progreso, pb = b?.progreso;
  return ((pb?.rojos || 0) - (pa?.rojos || 0)) || ((pb?.ambar || 0) - (pa?.ambar || 0)) || ((pb?.desvio || 0) - (pa?.desvio || 0));
}
export const MENSAJE_MEDIDAS = (nombre) => `Hola, ${nombreCorto(nombre) || 'qué tal'}. Hace tiempo que no me mandas tus medidas: cuando puedas, mídete cintura, cadera, pecho, brazo, muslo y pantorrilla (en ayunas, por la mañana) y apúntalas en Progreso. ¡Gracias!`;
