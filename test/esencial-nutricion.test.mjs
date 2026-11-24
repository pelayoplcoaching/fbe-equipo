// FBE Esencial, tanda 4 (logica/esencial-nutricion.js y la demo): el plan de comida de partida y el ajuste de la semana,
// solos, con los ritmos que decidió Pelayo (24/11) y, con antecedente de TCA, mantener y sin bajadas solas.
import { datosComidaValidos, planComidaEsencial, ajusteComidaEsencial, RITMO_ESENCIAL, MOTIVO_PARTIDA, MOTIVO_PARTIDA_TCA } from '../web/src/logica/esencial-nutricion.js';
import { planInicial } from '../web/src/logica/nutricion.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, sumarDias, fechaMadrid } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Los datos');
const datos = { sexo: 'hombre', edad: 47, altura: 176, peso: 84.6, actividad: 1.55, objetivo: 'perder', tca: false };
check(datosComidaValidos(datos) === null, 'completos, valen');
check(/sexo/.test(datosComidaValidos({ ...datos, sexo: null })) && /edad/.test(datosComidaValidos({ ...datos, edad: 17 })) && /altura/.test(datosComidaValidos({ ...datos, altura: 250 }))
  && /peso/.test(datosComidaValidos({ ...datos, peso: 20 })) && /mueves/.test(datosComidaValidos({ ...datos, actividad: 2 })) && /objetivo/.test(datosComidaValidos({ ...datos, objetivo: 'recomposicion' }))
  && /salud/.test(datosComidaValidos({ ...datos, tca: null })), 'cada cosa que falta, con su aviso (edad 18-90, altura 130-220, peso 35-250, la actividad de la lista, el objetivo y la pregunta de salud)');
check(datosComidaValidos({ ...datos, peso: '84,6' }) === null, 'el peso con coma, también');

console.log('\nEl plan de partida');
const p = planComidaEsencial(datos);
const ref = planInicial({ ...datos, fase: 'perder', ritmo: -0.5, modo: 'macros' });
check(p.kcal === ref.kcal && p.proteina_g === ref.proteina_g && p.carbos_g === ref.carbos_g && p.grasa_g === ref.grasa_g, `el de la calculadora del coach (${p.kcal} kcal, ${p.proteina_g} g de proteína)`);
check(p.fase === 'perder' && p.ritmo_pct === -0.5 && p.modo === 'macros' && p.motivo === MOTIVO_PARTIDA, 'perder: −0,5 % del peso a la semana, en kcal y macros');
check(RITMO_ESENCIAL.mantener === 0 && RITMO_ESENCIAL.ganar === 0.25 && planComidaEsencial({ ...datos, objetivo: 'ganar' }).kcal > planComidaEsencial({ ...datos, objetivo: 'mantener' }).kcal
  && planComidaEsencial({ ...datos, objetivo: 'mantener' }).kcal > p.kcal, 'mantener, 0; ganar, +0,25 % (más kcal que mantener, y mantener más que perder)');
const t = planComidaEsencial({ ...datos, tca: true });
check(t.fase === 'mantener' && t.ritmo_pct === 0 && t.kcal === planComidaEsencial({ ...datos, objetivo: 'mantener' }).kcal && t.motivo === MOTIVO_PARTIDA_TCA,
  'con antecedente de TCA, aunque elija perder: mantener, sin déficit');
let minimo = true;
for (const sexo of ['mujer', 'hombre']) for (const edad of [18, 50, 90]) for (const altura of [130, 175, 220]) for (const peso of [35, 70, 250]) for (const objetivo of ['perder', 'mantener', 'ganar']) {
  const x = planComidaEsencial({ sexo, edad, altura, peso, actividad: 1.4, objetivo, tca: false });
  if (!x || x.kcal < 1200 || x.carbos_g < 50 || Math.abs(x.kcal - (4 * x.proteina_g + 4 * x.carbos_g + 9 * x.grasa_g)) > 1) minimo = false;
}
check(minimo, 'en los extremos: nunca por debajo de 1.200 kcal, al menos 50 g de hidratos y las kcal cuadrando con los macros');

console.log('\nEl ajuste de la semana');
const hoy = '2027-02-15';
const plan = { id: 'p1', desde: '2027-02-01', modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal: p.kcal, proteina_g: p.proteina_g, carbos_g: p.carbos_g, grasa_g: p.grasa_g };
const gasto = (kcal) => ({ kcal, fiabilidad: 'alta', margen: 90 });
const baja = ajusteComidaEsencial({ plan, gasto: gasto(p.kcal + 330 - 500), pesoKg: 84, hoy });
check(baja && baja.delta < 0 && Math.abs(baja.delta) <= 300 && baja.proteina_g === plan.proteina_g && /Ajuste de la semana: gastas unas/.test(baja.motivo) && /bajas/.test(baja.motivo) && baja.motivo.length <= 280,
  `si gasta menos de lo que creía la fórmula, baja (como mucho 300): «${baja?.motivo}»`);
check(ajusteComidaEsencial({ plan, gasto: gasto(p.kcal + 330 - 500), pesoKg: 84, hoy, tca: true }) === null, 'con antecedente de TCA, no baja sola');
check(ajusteComidaEsencial({ plan: { ...plan, desde: '2027-02-10' }, gasto: gasto(p.kcal + 900), pesoKg: 84, hoy }) === null, 'con un plan de menos de 7 días, nada');
check(ajusteComidaEsencial({ plan, gasto: { kcal: 2900, fiabilidad: 'baja', margen: 400 }, pesoKg: 84, hoy }) === null, 'con el gasto aún poco fiable, nada (espera a tener más días apuntados)');
check(ajusteComidaEsencial({ plan: { ...plan, kcal_descanso: 1900, carbos_descanso_g: 150, grasa_descanso_g: 60 }, gasto: gasto(p.kcal + 900), pesoKg: 84, hoy }) === null,
  'un plan con días de descanso distintos (hecho por un coach) no se ajusta solo');
const sube = ajusteComidaEsencial({ plan, gasto: gasto(p.kcal + 330 + 600), pesoKg: 84, hoy, tca: true });
check(sube && sube.delta > 0 && sube.delta <= 300 && /como mucho 300 de una vez/.test(sube.motivo), `subir, sí (también con TCA), como mucho 300 de una vez: «${sube?.motivo}»`);

console.log('\nEn la demo: Inés prepara su plan de comida');
const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
const apiD = crearApi(bd);
await bd.auth.entrar('ines@fbe.demo', 'demo');
const ines = (await bd.select('atletas', { eq: { email: 'ines@fbe.demo' } }))[0];
const r0 = await apiD.resumenNutricion(ines.id);
check(ines?.nutricion === true && ines.modalidad === 'por_su_cuenta' && !r0.plan && !r0.siguiente, 'va por su cuenta, con nutrición y aún sin plan');
const di = { sexo: 'mujer', edad: 36, altura: 168, peso: 68.4, actividad: 1.4, objetivo: 'mantener', tca: false };
const hecho = await apiD.esencialPlanComida(di);
const r1 = await apiD.resumenNutricion(ines.id);
check(hecho?.kcal === planComidaEsencial(di).kcal && r1.plan?.kcal === hecho.kcal && r1.plan.desde === fechaMadrid() && r1.plan.fase === 'mantener', `su plan, desde hoy: ${r1.plan?.kcal} kcal`);
check((await apiD.esencialAjusteComida({ kcal: hecho.kcal + 100, proteina_g: hecho.proteina_g, carbos_g: hecho.carbos_g + 25, grasa_g: hecho.grasa_g, motivo: 'x' })) === null, 'el mismo día, el ajuste aún no toca');
check((await apiD.esencialTca(ines.id)) === false, 'su respuesta de salud queda en su cuestionario');
let err = null;
try { await apiD.esencialPlanComida({ ...di, edad: 12 }); } catch (e) { err = e; }
check(/Revisa tus datos/.test(err?.message || ''), 'con datos imposibles, la demo dice lo mismo que la base');
await bd.auth.entrar('tomas@fbe.demo', 'demo');
err = null;
try { await apiD.esencialPlanComida(di); } catch (e) { err = e; }
check(/no lleva nutrición/.test(err?.message || ''), 'Tomás (sin nutrición) no tiene plan de comida');
check(sumarDias(hoyISO(), 0) === hoyISO(), '(fin)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
