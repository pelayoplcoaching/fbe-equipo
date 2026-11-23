// (v0.209) El modo ligero (logica/ligero.js y ui/ligero.js): cuándo va lento un móvil, cuánto vale lo decidido y que
// con «Siempre» o «Nunca» manda lo elegido. Y el detector, con un navegador de mentira.
//   node test/ligero.test.mjs
import { vaLento, memoriaBaja, lentoVigente, ligeroActivo, opcionLigero, DIAS_LENTO } from '../web/src/logica/ligero.js';
import { normalizarAjustes } from '../web/src/ui/ajustes.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('¿Va lento?');
const b = (inicio, duracion) => ({ inicio, duracion });
check(!vaLento([]) && !vaLento([b(6000, 300), b(9000, 200)]), 'un par de bloqueos, no');
check(vaLento(Array.from({ length: 8 }, (_, i) => b(6000 + i * 5000, 130))), 'ocho bloqueos largos en los dos primeros minutos, sí');
check(!vaLento(Array.from({ length: 12 }, (_, i) => b(100 + i * 300, 300))), 'los de los primeros segundos (abrir siempre cuesta) no cuentan');
check(!vaLento(Array.from({ length: 12 }, (_, i) => b(130000 + i * 1000, 300))), 'ni los de después de los dos minutos');
check(vaLento([b(10000, 1600), b(20000, 1500)]) && !vaLento([b(10000, 1400), b(20000, 1500)]), 'tres segundos bloqueada en total, sí; menos, no');
check(!vaLento([{ inicio: 'x', duracion: 5000 }, null]), 'lo que no se entiende, no cuenta');
check(memoriaBaja(2) && memoriaBaja(1) && memoriaBaja(0.5) && !memoriaBaja(4) && !memoriaBaja(undefined) && !memoriaBaja(0), 'con 2 GB de memoria o menos, de entrada');

console.log('\nLo decidido vale un tiempo, y lo elegido manda');
check(lentoVigente({ lento: true, desde: '2026-11-01' }, '2026-11-23') && !lentoVigente({ lento: true, desde: '2026-10-01' }, '2026-11-23'), `vale ${DIAS_LENTO} días y luego se vuelve a mirar`);
check(!lentoVigente(null, '2026-11-23') && !lentoVigente({ lento: false, desde: '2026-11-20' }, '2026-11-23') && !lentoVigente({ lento: true, desde: 'ayer' }, '2026-11-23') && !lentoVigente({ lento: true, desde: '2026-12-01' }, '2026-11-23'), 'sin nada guardado (o mal guardado, o del futuro), no');
check(ligeroActivo('si', false) && !ligeroActivo('no', true) && ligeroActivo('auto', true) && !ligeroActivo('auto', false), '«Siempre» y «Nunca» mandan; «Automático», según el móvil');
check(opcionLigero('si') === 'si' && opcionLigero('raro') === 'auto' && opcionLigero(undefined) === 'auto', 'una opción que no es de las tres vuelve a «Automático»');
check(normalizarAjustes({}).ligero === 'auto' && normalizarAjustes({ ligero: 'no' }).ligero === 'no' && normalizarAjustes({ ligero: 7 }).ligero === 'auto', 'en los ajustes del móvil, «Automático» de serie');

console.log('\nEl detector, con un navegador de mentira');
const guardado = new Map();
globalThis.localStorage = { getItem: (k) => (guardado.has(k) ? guardado.get(k) : null), setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) };
globalThis.window = globalThis.window || {};
const { instalarLigero } = await import('../web/src/ui/ligero.js');
let observado = null;
class Obs { constructor(fn) { this.fn = fn; observado = this; this.cortado = false; } observe() {} disconnect() { this.cortado = true; } }
Obs.supportedEntryTypes = ['longtask'];
instalarLigero({ nav: { webdriver: true }, Observador: Obs });
check(observado === null && !guardado.has('fbe-lento'), 'en las pruebas automáticas (webdriver), no mira nada');
instalarLigero({ nav: { deviceMemory: 2 }, Observador: Obs });
check(JSON.parse(guardado.get('fbe-lento') || '{}').por === 'memoria' && observado === null, 'con poca memoria, se apunta de entrada');
guardado.clear();
instalarLigero({ nav: { deviceMemory: 8 }, Observador: Obs });
check(!!observado && !guardado.has('fbe-lento'), 'con memoria de sobra, mira los bloqueos');
observado.fn({ getEntries: () => Array.from({ length: 8 }, (_, i) => ({ startTime: 6000 + i * 4000, duration: 140 })) });
const l = JSON.parse(guardado.get('fbe-lento') || '{}');
check(l.lento === true && l.por === 'bloqueos' && /^\d{4}-\d{2}-\d{2}$/.test(l.desde) && observado.cortado, 'y si va lento, lo apunta (con el día) y deja de mirar');
observado = null;
instalarLigero({ nav: { deviceMemory: 8 }, Observador: Obs });
check(observado === null, 'ya apuntado, no vuelve a mirar hasta que pase el plazo');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
