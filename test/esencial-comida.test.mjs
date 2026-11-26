// FBE Esencial, tanda 9 (v0.250): «La comida, acompañada». La lógica pura (logica/esencial-comida.js) y doce semanas de
// comida simuladas (pierde, mantiene, gana, con antecedente de TCA, no se pesa y de viaje): el ajuste de cada semana no
// cambia (los mismos topes de siempre) y las dos reglas nuevas (viaje y celebraciones) solo actúan si están encendidas.
import { cambioDeLaSemana, porQueNoCambia, comidaDeLaSemana, proteinaDeHoy, momentoViaje, mantenimientoDe, pesosSinCelebraciones, ajusteConReglas,
  avisoDelPeso, cambioDeObjetivo, ritmoDelTrimestre, panelComida, leccionComida, LECCIONES_COMIDA, checkinComida, necesitasComida, NECESITAS_COMIDA,
  HOJAS_COMIDA, RESPUESTAS_COMIDA, respuestasComida, AVISOS_PESO, esAjuste } from '../web/src/logica/esencial-comida.js';
import { RESPUESTAS, APAGADO, respuestas, fijarAjustes, encendido, AVISO_ABRE } from '../web/src/logica/esencial-respuestas.js';
import { REVISAR_POR } from '../web/src/logica/esencial-ajustes.js';
import { ajusteComidaEsencial, planComidaEsencial } from '../web/src/logica/esencial-nutricion.js';
import { gastoAdaptativo, planVigente, objetivoDelDia } from '../web/src/logica/nutricion.js';
import { tendenciaPeso, ritmoPeso } from '../web/src/logica/calculos.js';
import { sumarDias, lunesDe } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const HOY = '2027-02-17';  // un miércoles
const plan = (desde, kcal, extra = {}) => ({ id: `p-${desde}`, desde, modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal, proteina_g: 130, carbos_g: Math.round((kcal - 520 - 558) / 4), grasa_g: 62, motivo: 'Plan de partida, con tus datos.', ...extra });
const AJ = 'Ajuste de la semana: gastas unas 2040 kcal al día y, para bajar un 0,5 % del peso a la semana, te tocan unas 1690: bajas 148 kcal.';

console.log('El cambio de esta semana y «¿Por qué no cambia?» (101 y 102)');
{
  const p0 = plan('2027-01-13', 1838), p1 = plan('2027-02-14', 1690, { motivo: AJ });
  const c = cambioDeLaSemana([p1, p0], HOY);
  check(c && c.delta === -148 && c.antes === 1838 && c.ahora === 1690 && c.motivo === 'Gastas unas 2040 kcal al día y, para bajar un 0,5 % del peso a la semana, te tocan unas 1690.', `el último ajuste de la semana, con su motivo (sin repetir lo que baja: ${c?.motivo})`);
  check(cambioDeLaSemana([p0, plan('2027-02-01', 1690, { motivo: AJ })], HOY) === null, 'uno de hace más de siete días ya no es «de esta semana»');
  check(cambioDeLaSemana([p0, plan('2027-02-14', 1700, { motivo: 'Plan de partida, con tus datos.' })], HOY) === null && esAjuste(p1) && !esAjuste(p0), 'rehacer el plan no cuenta como ajuste de la app');
  const nuevo = porQueNoCambia({ plan: plan('2027-02-14', 1838) }, { hoy: HOY });
  check(nuevo?.clave === 'nuevo' && /cumpla una semana \(desde el 21\/2\)/.test(nuevo.texto), `plan nuevo: el primer ajuste, a la semana (${nuevo?.texto})`);
  const rec = porQueNoCambia({ plan: p1 }, { hoy: HOY });
  check(rec?.clave === 'reciente' && /hace 3 días/.test(rec.texto), 'recién ajustado: no vuelve a tocarlo hasta que pase una semana');
  check(porQueNoCambia({ plan: p0, gasto: { kcal: null, falta: '3 días más con las kcal apuntadas y 2 pesadas más' } }, { hoy: HOY }).texto.includes('necesita 3 días más con las kcal apuntadas y 2 pesadas más'), 'le faltan datos: lo que le falta, tal cual lo calcula la app');
  check(porQueNoCambia({ plan: p0, gasto: { kcal: 2100, margen: 350 }, ajuste: { tipo: 'esperar' } }, { hoy: HOY }).clave === 'esperar', 'con el gasto poco preciso, espera');
  const bien = porQueNoCambia({ plan: p0, gasto: { kcal: 2100, margen: 90 }, ajuste: { tipo: 'mantener', objetivo: 1850 } }, { hoy: HOY });
  check(bien.clave === 'bien' && /bajar un 0,5 % del peso a la semana te tocan unas 1850 kcal/.test(bien.texto), 'va bien: lo dice, con su cifra');
  check(porQueNoCambia({ plan: p0, gasto: { kcal: 2100 }, ajuste: { tipo: 'revisar' } }, { hoy: HOY }).clave === 'minimo', 'en el mínimo: no lo baja más');
  check(porQueNoCambia({ plan: p0, gasto: { kcal: 2100 }, ajuste: { tipo: 'bajar' } }, { hoy: HOY, tca: true }).clave === 'tca', 'con antecedente de TCA, nunca baja sola (y lo dice)');
  check(porQueNoCambia({ plan: p0, gasto: { kcal: 2100 }, ajuste: { tipo: 'bajar' } }, { hoy: HOY }) === null && porQueNoCambia({ plan: p0, gasto: { kcal: 2100 }, ajuste: { tipo: 'subir' } }, { hoy: HOY }) === null, 'si toca cambiarlo, no hay nada que explicar (lo cambia la app)');
  check(porQueNoCambia({ plan: p0 }, { hoy: HOY, viaje: true }).clave === 'viaje', 'de viaje (regla encendida): lo dice');
  const s = comidaDeLaSemana({ plan: p1, planes: [p0, p1], ritmo: { pctSemana: -0.4, dias: 21 } }, { hoy: HOY });
  check(s.lineas.map((x) => x.k).join() === 'plan,cambio,ritmo' && /^Tu plan: 1690 kcal al día, con 130 g de proteína\.$/.test(s.lineas[0].texto) && /^Esta semana baja 148 kcal\. Gastas/.test(s.lineas[1].texto) && /−0,4 % a la semana \(lo previsto: −0,5 %\)/.test(s.lineas[2].texto),
    `en su revisión: su plan, lo que cambia y su ritmo (${s.lineas[1].texto.slice(0, 40)}…)`);
  const st = comidaDeLaSemana({ plan: p1, planes: [p0, p1], ritmo: { pctSemana: -0.4, dias: 21 } }, { hoy: HOY, tca: true });
  check(!st.lineas.some((x) => x.k === 'ritmo'), 'con antecedente de TCA, sin ritmos de peso');
  check(comidaDeLaSemana({ plan: { ...p0, modo: 'sin_contar' } }, { hoy: HOY }) === null && comidaDeLaSemana({}, { hoy: HOY }) === null, 'sin plan con cifras, nada');
}

console.log('\n«No llego a la proteína» (105)');
{
  const recetas = [{ id: 'a', nombre: 'Tortilla de claras', proteina_g: 32, kcal: 250 }, { id: 'b', nombre: 'Pollo al curry', proteina_g: 40, kcal: 520 }, { id: 'c', nombre: 'Yogur con avena', proteina_g: 22, kcal: 300 },
    { id: 'd', nombre: 'Ensalada', proteina_g: 8, kcal: 200 }, { id: 'e', nombre: 'Atún con patata', proteina_g: 35, kcal: 380 }];
  const x = proteinaDeHoy({ reg: { proteina_g: 80 }, obj: { proteina: 130 }, recetas });
  check(x.lleva === 80 && x.falta === 50 && x.texto === 'Hoy llevas 80 de 130 g de proteína: te faltan 50 g.', `lo que lleva y lo que le falta (${x.texto})`);
  check(x.ideas.map((i) => i.id).join() === 'a,e,b' && !x.ideas.some((i) => i.id === 'd'), 'tres recetas, las de más proteína por caloría (y ninguna con menos de 20 g)');
  check(proteinaDeHoy({ reg: null, obj: { proteina: 130 }, recetas: [] }).texto.startsWith('Hoy aún no has apuntado nada') && proteinaDeHoy({ reg: { proteina_g: 127 }, obj: { proteina: 130 } }).texto.includes('ya casi está'), 'sin apuntar, su objetivo; a 3 g, «ya casi está»');
  check(proteinaDeHoy({ obj: null, plan: null }) === null && proteinaDeHoy({ obj: null, plan: { proteina_g: 120 } }).objetivo === 120, 'sin objetivo, nada; sin el de hoy, el de su plan');
}

console.log('\nDe viaje y celebraciones (109 y 110, reglas apagadas)');
{
  const v = { desde: '2027-02-20', hasta: '2027-02-27', datos: { modo: 'pausa' } };
  check(momentoViaje(v, '2027-02-17') === 'antes' && momentoViaje(v, '2027-02-22') === 'durante' && momentoViaje(v, '2027-03-02') === 'vuelta' && momentoViaje(v, '2027-03-08') === null && momentoViaje(v, '2027-02-01') === null,
    'el momento del viaje: antes (la semana de antes), durante, la semana de la vuelta y después');
  const p0 = plan('2027-01-13', 1838);
  check(mantenimientoDe({ plan: p0, gasto: { kcal: 2104, fiabilidad: 'alta' } }) === 2100 && mantenimientoDe({ plan: p0, gasto: { kcal: 2104, fiabilidad: 'baja' }, pesoKg: 72 }) === 2250,
    'para mantener: lo que gasta (si es fiable) o su plan sin el déficit, redondeado a 50');
  check(mantenimientoDe({ plan: { ...p0, ritmo_pct: 0 } }) === 1850, 'con plan de mantener, su plan');
  const ps = [{ fecha: '2027-02-10', kg: 72 }, { fecha: '2027-02-11', kg: 73.2 }, { fecha: '2027-02-12', kg: 73 }, { fecha: '2027-02-13', kg: 72.6 }, { fecha: '2027-02-14', kg: 71.9 }];
  check(pesosSinCelebraciones(ps, ['2027-02-11']).map((p) => p.fecha).join() === '2027-02-10,2027-02-14', 'una celebración: fuera el peso de ese día y de los dos siguientes');
}

// ---------- La simulación: doce semanas ----------
// Una persona de 80 kg, con un gasto de verdad de 2500 kcal al día (que baja 22 kcal por kilo perdido). Come lo que dice su
// plan (con ruido), apunta seis de cada siete días y se pesa cada mañana (con el agua y la sal de cada día). Cada mañana se
// abre Hoy: si toca, la app ajusta (lo mismo que AjusteComidaEsencial).
function simular({ objetivo = 'perder', tca = false, pesarse = true, viaje = null, reglaViaje = false, semanas = 12, celebracion = null, reglaCelebracion = false } = {}) {
  const inicio = '2027-01-11';
  const p0 = planComidaEsencial({ sexo: 'mujer', edad: 40, altura: 168, peso: 80, actividad: 1.55, objetivo, tca });
  const planes = [{ ...p0, id: 'p0', desde: inicio }];
  const registros = [], pesos = [], cambios = [];
  let kg = 80, semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647 - 0.5; };
  for (let d = 0; d < semanas * 7; d++) {
    const hoy = sumarDias(inicio, d);
    // por la mañana: la app (si toca, ajusta)
    const r = { plan: planVigente(planes, hoy), planes, registros, pesos, entrenos: new Set(), diasEntreno: 2 };
    r.gasto = gastoAdaptativo({ registros, pesos }, hoy, { objetivoDe: (f) => objetivoDelDia(planVigente(planes, f), false)?.kcal ?? null });
    const tend = tendenciaPeso(pesos);
    r.pesoKg = tend.length ? tend[tend.length - 1].tendencia : 80;
    const mv = viaje ? momentoViaje(viaje, hoy) : null;
    const a = reglaViaje || reglaCelebracion
      ? ajusteConReglas(r, { hoy, tca, viaje: reglaViaje ? mv : null, celebraciones: reglaCelebracion && celebracion ? [celebracion] : [] })
      : ajusteComidaEsencial({ plan: r.plan, gasto: r.gasto, pesoKg: r.pesoKg, diasEntreno: 2, tca, hoy });
    if (a) { planes.push({ ...r.plan, ...a, id: `p${planes.length}`, desde: hoy, motivo: a.motivo }); cambios.push({ hoy, delta: a.delta, kcal: a.kcal, viaje: mv }); }
    // el día: come (de viaje, come más y no apunta), se pesa
    const p = planVigente(planes, hoy);
    const deViaje = mv === 'durante';
    const come = Math.round(Number(p.kcal) * (deViaje ? 1.25 : 1) + azar() * 160 + (hoy === celebracion ? 1500 : 0));
    if (!deViaje && d % 7 !== 6) registros.push({ fecha: hoy, kcal: come, proteina_g: p.proteina_g, completo: true });
    const gastoReal = 2500 - (80 - kg) * 22;
    kg += (come - gastoReal) / 7700;
    const agua = (celebracion && hoy > celebracion && diasDesde(celebracion, hoy) <= 2 ? 1.2 : 0) + azar() * 0.6;
    if (pesarse) pesos.push({ fecha: hoy, kg: Math.round((kg + agua) * 10) / 10 });
  }
  return { planes, cambios, kg, p0 };
}
const diasDesde = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
const separados = (cambios) => cambios.every((c, i) => i === 0 || diasDesde(cambios[i - 1].hoy, c.hoy) >= 7);

console.log('\nDoce semanas simuladas (120)');
{
  const pierde = simular({ objetivo: 'perder' });
  const ritmo = ((pierde.kg - 80) / 80) * 100 / 12;
  check(pierde.cambios.length >= 2 && pierde.cambios.every((c) => Math.abs(c.delta) <= 300) && separados(pierde.cambios) && pierde.planes.every((p) => Number(p.kcal) >= 1200),
    `pierde: ${pierde.cambios.length} ajustes, cada uno de 300 kcal como mucho, una semana entre uno y otro y nunca por debajo de 1200`);
  check(ritmo < -0.25 && ritmo > -0.8, `y baja a un ritmo cercano al previsto (${ritmo.toFixed(2)} % a la semana; buscaba −0,5)`);
  const mantiene = simular({ objetivo: 'mantener' });
  check(Math.abs(mantiene.kg - 80) < 2 && mantiene.cambios.every((c) => Math.abs(c.delta) <= 300), `mantiene: termina cerca de su peso (${mantiene.kg.toFixed(1)} kg)`);
  const gana = simular({ objetivo: 'ganar' });
  check(gana.kg > 80 && gana.cambios.every((c) => Math.abs(c.delta) <= 300) && separados(gana.cambios), `gana: sube (${gana.kg.toFixed(1)} kg), con los mismos topes`);
  const tca = simular({ objetivo: 'perder', tca: true });
  check(tca.p0.fase === 'mantener' && tca.cambios.every((c) => c.delta > 0), `con antecedente de TCA: plan de mantener y ningún ajuste a la baja (${tca.cambios.map((c) => c.delta).join(', ') || 'ninguno'})`);
  const sinPesar = simular({ objetivo: 'perder', pesarse: false });
  check(sinPesar.cambios.length === 0, 'si no se pesa, la app nunca ajusta (le falta el dato)');
  const viaje = { desde: '2027-02-15', hasta: '2027-02-21' };
  const conRegla = simular({ objetivo: 'perder', viaje, reglaViaje: true });
  const sinRegla = simular({ objetivo: 'perder', viaje, reglaViaje: false });
  check(!conRegla.cambios.some((c) => c.viaje === 'durante' || c.viaje === 'vuelta'), `de viaje, con la regla encendida: ningún ajuste mientras está fuera ni la semana de la vuelta (${conRegla.cambios.map((c) => c.hoy).join(', ')})`);
  check(sinRegla.cambios.length >= 1 && separados(sinRegla.cambios), 'sin la regla, el ajuste de siempre (la regla está apagada hasta que Pelayo la vea)');
  const cel = '2027-02-26';
  const sinCel = simular({ objetivo: 'perder', celebracion: cel });
  const conCel = simular({ objetivo: 'perder', celebracion: cel, reglaCelebracion: true });
  check(conCel.cambios.every((c) => Math.abs(c.delta) <= 300) && separados(conCel.cambios) && conCel.planes.every((p) => Number(p.kcal) >= 1200),
    `una celebración, con la regla: los mismos topes (${conCel.cambios.length} ajustes; sin la regla, ${sinCel.cambios.length})`);
}

console.log('\nAvisos del peso (111 y 112, apagados) y el trimestre (117)');
{
  const pesosDe = (kg0, porSemana, dias, hasta = HOY) => Array.from({ length: dias }, (_, i) => ({ fecha: sumarDias(hasta, i - dias + 1), kg: Math.round((kg0 + (porSemana / 7) * i) * 10) / 10 }));
  const p0 = plan('2026-12-30', 1838);
  const deprisa = avisoDelPeso({ plan: p0, planes: [p0], pesos: pesosDe(80, -1.2, 21) }, { hoy: HOY });
  check(deprisa?.clave === 'deprisa' && /baja un 1,\d % a la semana y tu plan busca un 0,5 %/.test(deprisa.dato), `baja más de un 1 % a la semana: el aviso, con sus cifras (${deprisa?.dato})`);
  const parado = avisoDelPeso({ plan: p0, planes: [p0], pesos: pesosDe(76, 0, 24) }, { hoy: HOY });
  check(parado?.clave === 'parado' && parado.dato === null, 'tres semanas parado (y con el plan de hace cuatro o más): el aviso');
  check(avisoDelPeso({ plan: plan('2027-02-01', 1838), planes: [plan('2027-02-01', 1838)], pesos: pesosDe(76, 0, 17) }, { hoy: HOY }) === null, 'con el plan de hace menos de cuatro semanas, aún no');
  check(avisoDelPeso({ plan: p0, planes: [p0], pesos: pesosDe(80, -1.2, 21) }, { hoy: HOY, tca: true }) === null && avisoDelPeso({ plan: { ...p0, ritmo_pct: 0 }, planes: [p0], pesos: pesosDe(76, 0, 24) }, { hoy: HOY }) === null,
    'nunca con antecedente de TCA ni a quien no busca perder');
  check(avisoDelPeso({ plan: p0, planes: [p0], pesos: pesosDe(80, -1.2, 21, '2027-02-05') }, { hoy: HOY }) === null, 'sin pesarse en la última semana, nada (el dato ya no dice mucho)');
  check(AVISOS_PESO.deprisa[1].length > 40 && AVISOS_PESO.parado[1].includes('«Cambiar mi objetivo o mis datos»'), 'sus textos (los que Pelayo puede corregir), con el botón tal como se llama');
  const rt = ritmoDelTrimestre({ antes: 80, ahora: 75.2, fechaAntes: '2026-11-18', fechaAhora: HOY }, p0);
  check(rt?.nombre === 'Tu ritmo' && /^−0,\d+ % a la semana \(lo previsto: −0,5 %\)$/.test(rt.texto), `«Tu trimestre», con su ritmo de verdad frente al previsto (${rt?.texto})`);
  check(ritmoDelTrimestre({ antes: 80, ahora: 79, fechaAntes: '2027-02-10', fechaAhora: HOY }, p0) === null && ritmoDelTrimestre(null, p0) === null, 'con menos de dos semanas, nada');
}

console.log('\nCambiar de objetivo (116) y tu panel (118)');
{
  const t = cambioDeObjetivo({ kcal: 1690, proteina_g: 130 }, { kcal: 2010, proteina_g: 117 });
  check(t === 'Pasas de 1690 a 2010 kcal al día y de 130 a 117 g de proteína. Tu plan nuevo empieza hoy; la app lo vuelve a ajustar cuando cumpla una semana, con lo que apuntes y lo que peses.', `qué cambia y cuándo (${t})`);
  check(cambioDeObjetivo(null, { kcal: 2000 }) === null && cambioDeObjetivo({ kcal: 2000, proteina_g: 120 }, { kcal: 2000, proteina_g: 120 }).startsWith('Tus kcal se quedan en 2000'), 'sin plan de antes, nada; si no cambia, lo dice');
  const pc = panelComida([{ atleta_id: 'a', plan: true, tca: false, pesadas_14: 0, dias_7: 0, ajustes: 2, ajustes_7: 1 }, { atleta_id: 'b', plan: true, tca: true, pesadas_14: 0, dias_7: 5, ajustes: 0, ajustes_7: 0 },
    { atleta_id: 'c', plan: false, tca: false, pesadas_14: 0, dias_7: 0, ajustes: 0, ajustes_7: 0 }], { a: 'Ana', b: 'Berta', c: 'Carla' });
  check(pc.total === 3 && pc.conPlan === 2 && pc.sinPlan.join() === 'Carla' && pc.sinPesar.join() === 'Ana' && pc.sinApuntar.join() === 'Ana' && pc.ajustes === 2 && pc.ajustes7 === 1,
    'en tu panel: sin plan, sin pesarse (nunca quien tiene antecedente de TCA), sin apuntar y los ajustes');
  check(panelComida([]) === null, 'sin nadie con nutrición, nada');
}

console.log('\nLecciones (114) y el check-in (113), apagados');
{
  const p0 = plan('2027-01-13', 1838), p1 = plan('2027-02-15', 1690, { motivo: AJ });
  check(leccionComida({ planes: [p0, p1], plan: p1 }, { hoy: HOY }) === 'primer_ajuste', 'su primer ajuste, la semana en que llega');
  check(leccionComida({ planes: [p0, p1], plan: p1 }, { hoy: HOY, vistas: new Set(['primer_ajuste']) }) === null, 'y una sola vez');
  check(leccionComida({ planes: [p0], plan: p0, ritmo: { pctSemana: 0.1, dias: 10 } }, { hoy: HOY }) === 'sin_bajar' && leccionComida({ planes: [p0], plan: p0, ritmo: { pctSemana: 0.1, dias: 10 } }, { hoy: HOY, tca: true }) === null,
    'una semana sin bajar (nunca con antecedente de TCA)');
  const lunesTras = '2027-02-22', pf = plan('2027-02-16', 1838);
  check(leccionComida({ planes: [pf], plan: pf }, { hoy: lunesTras }) === 'primer_finde' && leccionComida({ planes: [pf], plan: pf }, { hoy: '2027-02-23' }) === null, 'su primer fin de semana, el lunes de después');
  check(leccionComida({ planes: [plan('2026-12-01', 1838)], plan: plan('2026-12-01', 1838) }, { hoy: HOY, fuera: true }) === 'primera_fuera', 'su primera comida fuera, tras abrir «Hoy como fuera»');
  check(Object.keys(LECCIONES_COMIDA).length === 4 && Object.values(LECCIONES_COMIDA).every(([t, x]) => t && x.length > 40), 'las cuatro, con su texto');
  const perder = checkinComida({ saciedad: 1, energia: 2 }, { plan: p0 });
  check(perder.length === 2 && /pasa a mantener/.test(perder[0]) && /comer de menos no acelera nada/.test(perder[1]), 'con mucha hambre y poca energía, comiendo para perder: dos líneas');
  check(checkinComida({ saciedad: 1, energia: 2 }, { plan: p0, tca: true }).length === 1 && !/mantener/.test(checkinComida({ saciedad: 1 }, { plan: p0, tca: true })[0]), 'con antecedente de TCA, sin «pasa a mantener» ni lo de comer para perder');
  check(checkinComida({ saciedad: 3, energia: 4 }, { plan: p0 }).length === 0, 'si va bien, nada');
}

console.log('\n«¿Qué necesitas?» de comida (103) y sus quince respuestas (104)');
{
  const todo = () => true, nada = () => false;
  check(necesitasComida({ conPlan: false, encendido: todo }).length === 0, 'sin plan de comida, ninguna');
  check(necesitasComida({ conPlan: true, encendido: nada }).map((x) => x[0]).join() === 'proteina,pesarme', 'apagadas las de Pelayo: «No llego a la proteína» y «¿Cuándo me peso?»');
  check(necesitasComida({ conPlan: true, encendido: todo }).length === 6, 'encendidas, las seis');
  check(necesitasComida({ conPlan: true, tca: true, encendido: todo }).map((x) => x[0]).join() === 'proteina,fuera,hambre,celebracion', 'con antecedente de TCA, sin «Me he pasado» ni «¿Cuándo me peso?»');
  check(NECESITAS_COMIDA.every(([, , , que, clave]) => (que === 'proteina' || HOJAS_COMIDA[que]) && (!clave || APAGADO.has(clave))), 'cada una con su hoja y, si es de Pelayo, apagada');
  check(AVISO_ABRE.pesarme === 'pesarme', 'el aviso «¿Te pesas esta semana?» abre «¿Cuándo me peso?»');
  check(RESPUESTAS_COMIDA.length === 15 && new Set(RESPUESTAS_COMIDA.map((x) => x.id)).size === 15 && !RESPUESTAS_COMIDA.some((x) => RESPUESTAS.some((y) => y.id === x.id)), 'quince respuestas, sin ids repetidos');
  const conTca = respuestasComida({ tca: true });
  check(respuestasComida().length === 15 && conTca.length < 15 && !conTca.some((x) => /perder|bajar tu plan|1\.200|pes(o|arte|arme)/.test(x.r) && x.deficit) && conTca.every((x) => x.cat === 'comida'), `con antecedente de TCA, sin las de perder, bajar el plan o pesarse (${conTca.length})`);
  check(respuestas({ comida: respuestasComida() }).filter((x) => x.cat === 'comida').length === 0, 'apagadas: no salen');
  check(respuestas({ previa: true, comida: respuestasComida() }).filter((x) => x.cat === 'comida' && x.pendiente).length === 15, 'en la vista previa, las quince, marcadas «pendiente»');
  fijarAjustes([{ clave: 'respuestas_comida', encendido: true, texto: null }, { clave: 'respuesta:c-fuera', encendido: false, texto: { r: 'Mi versión de comer fuera.' } }]);
  const enc = respuestas({ comida: respuestasComida() }).filter((x) => x.cat === 'comida');
  check(enc.length === 15 && !enc.some((x) => x.pendiente) && enc.find((x) => x.id === 'c-fuera').r === 'Mi versión de comer fuera.', 'encendidas por Pelayo: salen, y con su versión del texto si la ha corregido');
  fijarAjustes([]);
  check(!encendido('respuestas_comida') && ['respuestas_comida', 'comida_fuera', 'hambre', 'me_he_pasado', 'celebracion', 'comida_viaje', 'aviso_peso', 'checkin_comida', 'lecciones_comida'].every((k) => APAGADO.has(k) && REVISAR_POR[k]),
    'las nueve de la tanda 9, apagadas y en «Por revisar» del panel');
  check(Object.entries(HOJAS_COMIDA).every(([, h]) => h.titulo && h.lineas.length >= 2 && h.lineas.every((l) => l.length <= 220)), 'las hojas, con su título y frases cortas');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
