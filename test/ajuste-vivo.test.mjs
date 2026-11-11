// Ajuste en vivo serie a serie: cuándo se corrige la carga de la serie siguiente por el RPE de la anterior, cuánto, y
// cuándo no se toca nada.
import { ajusteEnVivo, rpeObjetivo, repsSiguiente, textoAjuste, MARGEN_RPE, TOPE_CAMBIO } from '../web/src/logica/ajuste-vivo.js';
import { e1rm, kgPara } from '../web/src/logica/calculos.js';
import { readFileSync } from 'node:fs';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('El RPE objetivo');
check(rpeObjetivo({ rpe: 8 }) === 8 && rpeObjetivo({ rir: 2 }) === 8 && rpeObjetivo({ rpe: '7,5'.replace(',', '.') }) === 7.5, 'RPE tal cual, o 10 − RIR');
check(rpeObjetivo({}) === null && rpeObjetivo({ rir: '' }) === null, 'sin esfuerzo pautado, nada');
check(MARGEN_RPE === 1 && TOPE_CAMBIO === 0.1, 'las reglas: 1 punto de margen y como mucho un 10 %');

console.log('Bajar cuando la anterior fue más dura de lo pautado');
const a = ajusteEnVivo({ previa: { kg: 80, reps: 6, rpe: 9.5 }, objetivo: { rpe: 8 }, reps: 6, nombre: 'Press banca con barra' });
check(a && a.kg === 77.5 && a.sentido === 'bajar' && a.de === 80 && a.reps === 6, `press banca 80 × 6 a RPE 9,5 (pautado 8) → 77,5 kg (${a?.kg})`);
// la misma cuenta, a mano: 1RM de hoy y carga para 6 dejando 2
const uno = e1rm({ kg: 80, reps: 6, rpe: 9.5 });
check(Math.abs(kgPara(uno, 6, 2, 2.5) - 77.5) < 1e-9, 'es la carga de la tabla de RPE de la propia app (e1rm → kgPara)');
const b = ajusteEnVivo({ previa: { kg: 30, reps: 10, rpe: 10 }, objetivo: { rir: 2 }, reps: 10, nombre: 'Press inclinado con mancuernas' });
check(b && b.kg === 28 && b.rpeObjetivo === 8, `mancuernas: a saltos de 2 kg (30 a RPE 10, RIR 2 pautado → ${b?.kg})`);
const c = ajusteEnVivo({ previa: { kg: 100, reps: 5, rpe: 10 }, objetivo: { rpe: 6 }, reps: 5, nombre: 'Sentadilla con barra' });
check(c && c.kg === 90, `como mucho un 10 % de una vez (100 → ${c?.kg}, no 87,5)`);
const m = ajusteEnVivo({ previa: { kg: 60, reps: 12, rpe: 10 }, objetivo: { rpe: 8 }, reps: 12, nombre: 'Prensa' });
check(m && m.kg === 55, `máquina de 50 kg o más: a saltos de 5 (60 → ${m?.kg})`);

console.log('Subir cuando fue más fácil');
const s = ajusteEnVivo({ previa: { kg: 80, reps: 8, rpe: 6.5 }, objetivo: { rpe: 8 }, reps: 8, nombre: 'Press banca con barra' });
check(s && s.kg === 82.5 && s.sentido === 'subir', `80 × 8 a RPE 6,5 (pautado 8) → 82,5 kg (${s?.kg})`);
check(ajusteEnVivo({ previa: { kg: 80, reps: 8, rpe: 6.5 }, objetivo: { rpe: 8 }, reps: 8, nombre: 'Press banca con barra', subir: false }) === null, 'sin progresión automática (o si hoy llega flojo), no sube');
check(ajusteEnVivo({ previa: { kg: 80, reps: 6, rpe: 9.5 }, objetivo: { rpe: 8 }, reps: 6, nombre: 'Press banca con barra', subir: false })?.kg === 77.5, 'pero bajar, sí');

console.log('Cuándo no se toca nada');
check(ajusteEnVivo({ previa: { kg: 80, reps: 6, rpe: 8.5 }, objetivo: { rpe: 8 }, reps: 6 }) === null, 'medio punto de diferencia: igual');
check(ajusteEnVivo({ previa: { kg: 80, reps: 6, rpe: 7.5 }, objetivo: { rpe: 8 }, reps: 6 }) === null, 'medio punto por debajo: igual');
check(ajusteEnVivo({ previa: { kg: 80, reps: 6, rpe: 9.5 }, objetivo: {}, reps: 6 }) === null, 'sin esfuerzo pautado: igual');
check(ajusteEnVivo({ previa: { kg: 80, reps: 6, rpe: '' }, objetivo: { rpe: 8 }, reps: 6 }) === null, 'sin RPE apuntado: igual');
check(ajusteEnVivo({ previa: { kg: 80, reps: 6, rpe: 9.5 }, objetivo: { rpe: 8 }, reps: 6, kgFijado: true }) === null, 'el coach fijó los kilos: se respeta');
check(ajusteEnVivo({ previa: { kg: 0, reps: 10, rpe: 10 }, objetivo: { rpe: 8 }, reps: 10 }) === null, 'sin carga (peso corporal): igual');
check(ajusteEnVivo({ previa: { kg: 50, reps: 15, rpe: 10 }, objetivo: { rpe: 8 }, reps: 15 }) === null, 'más de 12 repeticiones: la estimación no vale');
check(ajusteEnVivo({ previa: { kg: 20, reps: 10, rpe: 9 }, objetivo: { rpe: 8 }, reps: 10, nombre: 'Curl con barra' }) === null, 'el cambio no llega a un salto (20 kg en barra, 1 punto): igual');
check(ajusteEnVivo({ previa: { kg: 80, reps: 6, rpe: 3 }, objetivo: { rpe: 8 }, reps: 6 }) === null, 'un RPE de menos de 5 (seguramente mal puesto): igual');
check(ajusteEnVivo({}) === null && ajusteEnVivo() === null, 'sin serie anterior: nada');

console.log('Las repeticiones que se proponen');
check(repsSiguiente(8, { reps_min: 6, reps_max: 8 }) === 8 && repsSiguiente(12, { reps_min: 6, reps_max: 8 }) === 8 && repsSiguiente(4, { reps_min: 6, reps_max: 8 }) === 6, 'las de la anterior, dentro del rango');
check(repsSiguiente(null, { reps_min: 6, reps_max: 8 }) === 8 && repsSiguiente(9, {}) === 9, 'sin anterior, el tope; sin rango, las mismas');
const r = ajusteEnVivo({ previa: { kg: 80, reps: 12, rpe: 9.5 }, objetivo: { rpe: 8 }, reps: repsSiguiente(12, { reps_min: 6, reps_max: 8 }), nombre: 'Press banca con barra' });
check(r === null, 'si se pasó del rango (12 con 6–8) a RPE alto, no se propone subir: nunca al revés de lo que dice el RPE');

console.log('El texto');
check(textoAjuste(a) === 'Tu serie anterior fue RPE 9,5 (pautado RPE 8): baja a 77,5 kg', 'bajar');
check(textoAjuste(b).startsWith('Tu serie anterior fue RPE 10 (pautado RIR 2): baja a 28 kg'), 'con RIR pautado, lo dice en RIR');
check(textoAjuste(s, '180 lb') === 'Tu serie anterior fue RPE 6,5 (pautado RPE 8): sube a 180 lb', 'subir, con la carga en la unidad de la app');
check(textoAjuste(null) === '', 'sin ajuste, nada');

console.log('Dónde va');
const comun = readFileSync(new URL('../web/src/ui/atleta/sesion-comun.jsx', import.meta.url), 'utf8');
check(comun.includes('ajusteEnVivo({ previa, objetivo: { rpe: prescripcion.rpe_objetivo, rir: prescripcion.rir_objetivo }') && comun.includes('kgFijado: prescripcion.carga_sugerida_kg != null'), 'la propuesta de cada serie lo usa (sin tocar la carga pautada del coach)');
const ses = readFileSync(new URL('../web/src/ui/atleta/Sesion.jsx', import.meta.url), 'utf8');
check(ses.includes('ajuste-nota') && ses.includes('textoAjuste('), 'la sesión dice por qué cambia la carga, en la serie que toca');

console.log(`\n${ok} comprobaciones bien, ${fallos} mal`);
if (fallos) process.exit(1);
