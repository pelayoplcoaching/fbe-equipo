// Tu medicación y el ejercicio (v0.254): reconocer lo que escribe en «Tomo alguna medicación a diario» con los nombres de
// Pauta Activa (datos/pauta-activa-nombres.json), su dosis y sus tomas, la lista que se guarda y el enlace que abre Pauta
// Activa con ella (el mismo formato que «Copiar enlace con mi lista» de Pauta Activa).
import { readFileSync } from 'node:fs';
import * as M from '../web/src/logica/medicacion.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const base = JSON.parse(readFileSync(new URL('../web/src/datos/pauta-activa-nombres.json', import.meta.url), 'utf8'));
const pids = (t) => M.reconocer(t, base).encontrados.map((x) => x.pid).join();
const uno = (t) => M.reconocer(t, base).encontrados[0] || null;

console.log('Los nombres de Pauta Activa');
const ids = new Set(base.p.map((p) => p[0]));
check(/^\d{4}\.\d{2}\.\d{2}$/.test(base.version) && base.p.length >= 400 && ids.size === base.p.length, `su versión y sus principios activos, sin repetir (${base.version}: ${base.p.length})`);
check(base.p.every(([id, nombre, familia, marcas]) => /^[a-z0-9_]{2,60}$/.test(id) && nombre && base.f[familia] && Array.isArray(marcas)), 'cada uno con su id, su nombre, su familia y sus marcas');
check(base.x.length >= 50 && base.x.every(([, , cs, ds]) => cs.length >= 1 && cs.every((c) => ids.has(c)) && ds.length === cs.length), 'las combinaciones, con sus componentes (todos conocidos; alguna, de una sola familia) y sus dosis');
check(!JSON.stringify(base).includes('"general"') && !JSON.stringify(base).includes('texto'), 'sin reglas ni textos de salud: solo nombres');

console.log('\nReconocer su texto');
check(pids('Bisoprolol 5 mg') === 'bisoprolol' && pids('BISOPROLOL') === 'bisoprolol' && pids('bisoprolol.') === 'bisoprolol', 'por su nombre, en mayúsculas o con un punto detrás');
check(pids('Adiro 100') === 'aas' && pids('Sintrom') === 'acenocumarol' && pids('Eutirox 75') === 'levotiroxina' && pids('Ozempic') === 'semaglutida', 'por sus marcas (Adiro, Sintrom, Eutirox, Ozempic)');
check(pids('valsartán 160') === 'valsartan' && pids('Losartán') === 'losartan', 'con o sin tildes');
check(pids('Entresto 49/51') === 'sacubitrilo_valsartan' && pids('sacubitrilo/valsartán') === 'sacubitrilo_valsartan', 'lo más largo primero: «sacubitrilo/valsartán» no es «valsartán»');
check(pids('Eliquis 5 mg 1-0-1 y Atorvastatina 40 mg 0-0-1') === 'apixaban,atorvastatina', 'dos en la misma línea');
check(pids('Bisoprolol 5 mg; Metformina 850 mg') === 'bisoprolol,metformina' && pids('Bisoprolol\nEmconcor 2,5') === 'bisoprolol', 'separados por «;» o en líneas; el mismo dos veces, una sola');
check(pids('glargina 20 unidades') === 'insulina_basal', 'un nombre suelto entre paréntesis en Pauta Activa («Insulina basal (glargina, …)»)');
check(pids('Fentanilo parche') === 'fentanilo' && pids('parche de nicotina') === '', 'pero no las palabras que no son un medicamento («parche»)');
const rx = M.reconocer('Omeprazol 20 mg\nUn jarabe para la tos\nvitaminas\n\n  \n', base);
check(rx.encontrados.length === 1 && rx.sinReconocer.join('|') === 'Un jarabe para la tos|vitaminas', 'lo que no reconoce, aparte (y las líneas vacías, fuera)');
check(M.reconocer('', base).encontrados.length === 0 && M.reconocer(null, base).sinReconocer.length === 0 && M.reconocer('Bisoprolol', null).encontrados.length === 0, 'sin texto o sin la base, nada');
check(uno('Bisoprolol 5 mg')?.nombre === 'Bisoprolol' && uno('Bisoprolol 5 mg')?.familia === 'Betabloqueantes' && uno('Adiro')?.nombre === 'Ácido acetilsalicílico', 'con su nombre y su familia (sin la lista de ejemplos de Pauta Activa)');

console.log('\nSu dosis y sus tomas');
const d = (t) => { const x = uno(t); return x ? `${x.dosis}·${x.tomas}` : null; };
check(d('Bisoprolol 5 mg 1-0-0') === '5·1' && d('Metformina 850 mg 1-0-1') === '850·2' && d('Metformina 850mg 2-0-0') === '850·2', 'la pauta «1-0-1»: las tomas del día (las pastillas)');
check(d('Paracetamol 1 g cada 8 horas') === '1000·3' && d('Omeprazol 20 mg cada 24 h') === '20·1' && d('valsartán 160 mg dos veces al día') === '160·2' && d('Lexatin 1,5 mg una vez al día') === '1.5·1', '«cada 8 horas», «dos veces al día», gramos y decimales con coma');
check(d('Ozempic 1 mg semanal') === 'null·null' && d('Prolia cada 6 meses') === 'null·null' && d('Entresto 49/51 mg cada 12 horas') === 'null·2', 'lo que no es diario, sin dosis (que la ponga en Pauta Activa); dos cifras («49/51»), tampoco');
check(d('Eutirox 75 microgramos') === 'null·null' && d('Eutirox 75 µg') === 'null·null' && d('glargina 20 unidades') === 'null·null', 'en microgramos o unidades, sin dosis (no se confunde «µg» con gramos)');
check(d('Ibuprofeno 600 mg si dolor') === '600·null' && d('Bisoprolol') === 'null·null', 'sin pauta, sin tomas');
check(M.dosisTexto({ dosis: 5, tomas: 1 }) === '5 mg, 1 vez al día' && M.dosisTexto({ dosis: 1.5, tomas: 2 }) === '1,5 mg, 2 al día' && M.dosisTexto({}) === 'sin dosis', 'y cómo se lee');

console.log('\nLa lista que se guarda');
const l = M.limpiarLista([{ pid: 'bisoprolol', nombre: ' Bisoprolol ', dosis: 5, tomas: 1 }, { pid: 'bisoprolol', nombre: 'Otra vez' }, { pid: 'MAL!', nombre: 'x' },
  { pid: 'aas', nombre: 'Ácido acetilsalicílico', dosis: 0, tomas: 13, texto: 'Adiro 100' }, { pid: 'omeprazol', nombre: '' }]);
check(l.length === 2 && l[0].nombre === 'Bisoprolol' && l[1].dosis === null && l[1].tomas === null && l[1].texto === 'Adiro 100', 'sin repetir, sin ids raros ni nombres vacíos, y sin dosis o tomas fuera de sus límites');
check(M.limpiarLista(Array.from({ length: 40 }, (_, i) => ({ pid: `p${i}x`, nombre: 'X' }))).length === 30 && M.limpiarLista(null).length === 0, 'como mucho 30');

console.log('\nEl enlace a Pauta Activa');
const r = M.reconocer('Bisoprolol 5 mg 1-0-0\nMetformina 850 mg 1-0-1\nAdiro', base).encontrados;
const url = M.enlacePautaActiva(r);
const est = M.listaDelEnlace(url);
check(url.startsWith(`${M.PAUTA_ACTIVA}#lista=`) && /^[^?]*#lista=[A-Za-z0-9_-]+$/.test(url), 'Pauta Activa con la lista en el fragmento, en base64url (no viaja al servidor)');
check(JSON.stringify(est) === JSON.stringify({ m: [['bisoprolol', 5, 1, null, 0, ''], ['metformina', 850, 2, null, 0, ''], ['aas', null, null, null, 0, '']] }),
  'cada fármaco como lo guarda Pauta Activa ([id, dosis, tomas, null, 0, ""]) y nada más: ni nombre ni edad');
check(M.enlacePautaActiva([]) === M.PAUTA_ACTIVA && M.listaDelEnlace(M.PAUTA_ACTIVA) === null, 'sin medicación, la portada de Pauta Activa');

console.log('\n¿Toma medicación?');
check(M.tomaMedicacion({ otras: ['medicacion'] }) && !M.tomaMedicacion({ otras: ['cirugia'] }) && !M.tomaMedicacion(null), 'lo dice su respuesta de «Tomo alguna medicación a diario»');
check(!/[^\x00-\x7F]/.test(readFileSync(new URL('../web/src/logica/medicacion.js', import.meta.url), 'utf8').split('\n').filter((x) => /\/[^/]*\[[^\]]*\]/.test(x) && /\.(test|exec|replace)\(|= \//.test(x)).map((x) => (x.match(/\/(?:\\.|[^/\n])+\/[gimsuy]*/g) || []).join('')).join('')),
  'sus expresiones regulares, solo ASCII (las tildes, con \\u)');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
