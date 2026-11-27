// (v0.280) Momentos (301-350), primera vuelta: la sesión, contada (301-306). Aquí, lo puro (la melodía de la sesión, el
// orden de los músculos, el mejor momento de la semana y lo que lleva cada tarjeta al compartirla) y que cada pieza está
// en su sitio; en el navegador, test/e2e-momentos.mjs. (v0.282) Sentir el récord (312-315): la serie que puede serlo, la
// última de la sesión, la ola de la mitad y el primer récord de tu vida.
//   node test/momentos.test.mjs
import { readFileSync } from 'node:fs';
import { melodiaSesion, ordenMusculos, esPrimerRecord, CLAVE_PRIMER_RECORD } from '../web/src/logica/sesion-final.js';
import { nota, SONIDOS, puedeSonar, prioridadDe, duracionDe, volumenDe, ESCUCHAR, SUSURRO } from '../web/src/logica/sonido.js';
import { subidaRecord, resumenSemanal } from '../web/src/logica/calculos.js';
import { cartaSesion, cartaSemana, cartaMes, cartaAnio, CARTAS } from '../web/src/logica/historia-cartas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('301 · La melodía de tu sesión');
const filas = [
  { nombre: 'Sentadilla', puntos: [{ t: 'medio', rec: false }, { t: 'medio', rec: false }, { t: 'fuerte', rec: true }] },
  { nombre: 'Press banca', puntos: [{ t: 'suave', rec: false }, { t: 'medio', rec: false }] },
];
const m = melodiaSesion(filas, nota);
check(m.length === 5 && m.every((x, i) => i === 0 || x.d > m[i - 1].d), 'una nota por serie, en el orden de la sesión');
check(m[0].f === nota(0) && m[1].f === nota(1) && m[3].f === nota(0), 'la n-ésima serie de un ejercicio sube un escalón (y el siguiente ejercicio empieza abajo)');
check(m[2].rec && m[2].f === nota(2 + 5) && m[2].dura > m[1].dura, 'un récord, una octava más arriba y más largo');
check(m[3].d - m[2].d > m[1].d - m[0].d, 'entre ejercicio y ejercicio, un respiro');
const muchas = melodiaSesion(Array.from({ length: 10 }, () => ({ puntos: Array.from({ length: 8 }, () => ({ t: 'medio' })) })), nota);
check(muchas.length === 80 && muchas[muchas.length - 1].d <= 6.2 && muchas[1].d - muchas[0].d >= 0.07, `con muchas series, más deprisa, como un arpegio (última a ${muchas[muchas.length - 1].d} s; nunca menos de 0,07 s entre notas)`);
const pocas = melodiaSesion([{ puntos: [{ t: 'suave' }, { t: 'suave' }] }], nota);
check(pocas[1].d - pocas[0].d <= 0.42, 'con pocas series, sin hacerse eternas (como mucho 0,42 s entre notas)');
check(melodiaSesion([], nota).length === 0 && melodiaSesion(filas, null).length === 0, 'sin series (o sin escala), sin melodía');

console.log('302 · Los récords caen como medallas');
check(SONIDOS.clinc && SONIDOS.clinc.apartado === 'entreno' && SONIDOS.clinc.notas().length === 2, 'el «clinc»: dos notas altas y cortas, de la familia');
check(puedeSonar({}, 'clinc') && !puedeSonar({ sonidoSerie: false }, 'clinc'), 'suena con los sonidos de la sesión, y se calla si los apagas');

console.log('303 · Los músculos, en orden');
check(JSON.stringify(ordenMusculos({ pecho: 2, triceps: 1, hombro: 0, biceps: 0.5 })) === '["pecho","triceps","biceps"]', 'en el orden en que salieron, y solo los que tienen series');

console.log('305 · Tu mejor momento');
check(Math.abs(subidaRecord({ tipo: 'e1rm', valor: 105, antes: 100 }) - 0.05) < 1e-9 && Math.abs(subidaRecord({ tipo: 'kg', kg: 62.5, antes: 60 }) - 0.0416667) < 1e-6 && subidaRecord({ tipo: 'reps', reps: 12, antes: 10 }) === 0.2, 'cuánto sube cada récord sobre su marca de antes (1RM, kilos o repeticiones)');
check(subidaRecord({ tipo: 'kg', kg: 50, antes: 0 }) === null && subidaRecord(null) === null, 'sin marca de antes, no se inventa');
// una semana con dos récords: press banca sube un 10 % y sentadilla un 2,5 %
const S = (fecha, ejercicio_id, ejercicio, kg, reps, sesion_id) => ({ fecha, ejercicio_id, ejercicio, kg, reps, sesion_id, registrada_en: `${fecha}T10:00:00` });
const series = [
  S('2026-11-02', 'a', 'Sentadilla', 100, 5, 's1'), S('2026-11-02', 'b', 'Press banca', 50, 5, 's1'),
  S('2026-11-10', 'a', 'Sentadilla', 102.5, 5, 's2'), S('2026-11-11', 'b', 'Press banca', 55, 5, 's3'),
];
const sem = resumenSemanal({ series, sesiones: [] }, '2026-11-09');
check(sem.records.length === 2 && sem.momento && sem.momento.ejercicio === 'Press banca' && sem.momento.pct === 10 && sem.momento.fecha === '2026-11-11', `el que más subió: ${sem.momento?.ejercicio} (+${sem.momento?.pct} %)`);
check(resumenSemanal({ series: series.slice(0, 2), sesiones: [] }, '2026-11-09').momento === null, 'sin récords esa semana, sin momento');

console.log('304 · Cada tarjeta, tal cual');
const r = { tarjeta: { nombre: 'Día 1' }, records: [{ nombre: 'Sentadilla', r: { texto: '1RM estimado 110 kg (antes 105)' } }], musculos: { cuadriceps: 6, gluteo: 3, isquiotibiales: 1.5 } };
check(cartaSesion(r, 'hecho').sesion && cartaSesion(r, 'hecho').datos === r.tarjeta, '«Lo que has hecho»: la tarjeta de la sesión de siempre');
const rec1 = cartaSesion(r, 'records');
check(rec1.tipo === 'record' && rec1.nombre === 'Sentadilla' && rec1.lineas[0].startsWith('1RM'), 'un récord: su tarjeta de récord');
const rec3 = cartaSesion({ ...r, records: [r.records[0], { nombre: 'Peso muerto', r: { texto: 'x' } }, { nombre: 'Remo', r: { texto: 'y' } }, { nombre: 'Dominadas', r: { texto: 'z' } }] }, 'records');
check(rec3.tipo === 'logro' && rec3.nombre === '4 récords' && rec3.lineas.length === 3, 'varios: juntos, los tres primeros');
const mus = cartaSesion(r, 'musculos', { nombre: 'Día 1' });
check(mus.icono === 'rayo' && mus.cifra.v === '6' && mus.lineas[0] === 'Día 1' && mus.lineas.length === 3, 'los músculos: el que más, con sus series');
const semana = { lunes: '2026-11-09', domingo: '2026-11-15', sesiones: { hechas: 3, total: 3, completa: true }, series: 40, tonelaje: 8200, minutos: 150, cardio: { minutos: 0 }, records: sem.records, mejor: null, momento: sem.momento, musculoTop: { grupo: 'pecho', series: 9 }, racha: 4, peso: { antes: 80, despues: 79.6, cambio: -0.4 } };
const cs = Object.fromEntries(CARTAS.semana.map((id) => [id, cartaSemana(semana, id, { rango: 'del 9 al 15 de noviembre' })]));
check(Object.values(cs).every(Boolean) && cs.portada.nombre === 'Semana completa' && cs.volumen.cifra.v === '8,2' && cs.momento.cifra.v === '+10' && cs.momento.tipo === 'record', 'las de «Tu semana»: portada, volumen, récords, momento y músculos');
check(cartaSemana(semana, 'peso') === null && !JSON.stringify(cs).includes('79,6') && !JSON.stringify(cs).includes('79.6'), 'el peso no se comparte (ni sale en ninguna)');
const mes = { conEntreno: true, sesiones: { hechas: 12, previstas: 12 }, dias: 12, minutos: 600, tonelaje: 30000, series: 160, records: [], mejorRacha: 4, semanasCompletas: 4, cardio: { sesiones: 0 }, habitos: { media: 80 }, nutricion: { dias: 20 } };
check(cartaMes(mes, 'portada').nombre === '12 sesiones' && cartaMes(mes, 'records') === null && cartaMes(mes, 'racha').llama && cartaMes(mes, 'habitos') === null && cartaMes(mes, 'nutricion') === null, 'las de «Tu mes»: las de entreno (ni hábitos ni nutrición)');
check(cartaMes({ conEntreno: false }, 'portada') === null, 'un mes sin entreno no tiene tarjetas que compartir');
const anio = { anio: 2026, sesiones: 140, dias: 130, minutos: 9000, tonelaje: 300000, series: 2000, mesTop: { mes: 'octubre', sesiones: 15 }, records: 30, ejerciciosConRecord: 9, progreso: { ejercicio: 'Sentadilla', pct: 22.5 }, mejorRacha: 12, semanasCompletas: 30, cardio: { sesiones: 0 } };
check(CARTAS.anio.filter((id) => id !== 'cardio').every((id) => cartaAnio(anio, id)) && cartaAnio(anio, 'progreso').cifra.v === '+22,5' && cartaAnio(anio, 'musica') === null, 'las de «Tu año» (sin la de música)');

console.log('307-311 · Compartir con brillo');
const { FORMATOS, tamanoFormato } = await import('../web/src/logica/compartir.js');
const { cartaDiaUno } = await import('../web/src/logica/historia-cartas.js');
check(FORMATOS.some(([k]) => k === 'fondo') && tamanoFormato('fondo').W === 1080 && tamanoFormato('fondo').H === 2340, '(310) el formato «Fondo de pantalla»: 1080 × 2340');
const d1 = cartaDiaUno({ id: 'a', nombre: 'Sentadilla', fecha: '2026-06-01', kg: 60, reps: 8, antes: 74.4, ahora: 101.3, pct: 36, dias: 179 }, '2026-11-27');
check(d1.tipo === 'comparativa' && d1.etiqueta === 'El día 1 y hoy' && d1.comparar.antes.v === '74,4' && d1.comparar.ahora.v === '101,3' && d1.comparar.ahora.fecha === 'Hoy' && d1.lineas[0] === '+36 % en 6 meses', '(311) «El día 1 y hoy», como tarjeta de antes y ahora (con su unidad)');
check(cartaDiaUno({ nombre: 'x', antes: 0, ahora: 10, fecha: '2026-01-01' }) === null, '(311) sin las dos cifras, sin tarjeta');
const cp = src('ui/Compartir.jsx');
check(/class=\{`cpt-carta\$\{/.test(cp) && /--cpt-ry/.test(cp) && /--cpt-rx/.test(cp) && /if \(sinMovimiento\(\) \|\| \(e\.pointerType === 'mouse' && e\.button !== 0\)/.test(cp) && /cpt-tornasol/.test(cp), '(307) la tarjeta se coge siguiendo al dedo (no con «reducir movimiento»); las de récord, tornasol');
check(/const viajeGuardar = \(\) =>/.test(cp) && /c\.className = 'cpt-viaje'/.test(cp) && /guardada \? 'Guardada' : 'Guardar imagen'/.test(cp), '(308) «Guardar imagen» con su viaje y su ✓');
check(/conTransicion\(poner, 'morph', \[\{ nombre: 'vt-viaje', desde: carta\.current, hasta: '\.cpt-carta' \}\]\)/.test(cp) && /antes\.plantilla !== plantilla \|\| antes\.forma !== forma/.test(cp) && /await im\.decode\(\)/.test(cp), '(309) cambiar de plantilla o de formato transforma la tarjeta (con la nueva ya decodificada)');
check(/async function pintarFondoPantalla\(blob, paleta = 'noche'\)/.test(cp) && /Como fondo de pantalla/.test(cp), '(310) el fondo de pantalla, también para el carné');
check(/import\('\.\.\/\.\.\/logica\/historia-cartas\.js'\)\.then\(\(m\) => \{ const d = m\.cartaDiaUno\(x\)/.test(src('ui/atleta/PerfilMas.jsx')), '(311) el botón en «El día 1 y hoy» (la tarjeta se prepara al tocar)');

console.log('Cada pieza, en su sitio');
const hs = src('ui/atleta/HistoriaSesion.jsx');
check(/function Melodia\(\{ filas \}\)/.test(hs) && /melodiaSesion\(filas, nota\)/.test(hs) && /puedeSonar\(leerAjustes\(\), 'serie'\)/.test(hs) && /sonarFBE\('nota'/.test(hs) && /fill: 'backwards'/.test(hs), '(301) la melodía: cada punto con su nota, solo con los sonidos de la sesión encendidos');
check(/\.hs-medalla/.test(hs) && /sonarFBE\('clinc'\)/.test(hs) && /vibrar\('toque'\)/.test(hs) && /pantallas\[i\]\?\.id !== 'records' \|\| quieto/.test(hs), '(302) las medallas caen con su «clinc» y su toque (no con «reducir movimiento»)');
check(/function MusculosEnOrden/.test(hs) && /ordenMusculos\(musculos\)/.test(hs) && /<MapaMuscular series=\{parcial\} todas=\{musculos\}/.test(hs), '(303) los músculos se pintan en orden (y el lector oye todos desde el principio)');
check(/historia-cerrar historia-comp/.test(hs) && /parada: !!carta/.test(hs) && /import\('\.\.\/\.\.\/logica\/historia-cartas\.js'\)/.test(hs), '(304) el botón de compartir en cada tarjeta (la historia se para mientras)');
check(/<PonTuCancion \/>/.test(hs), '(325) en la de récords, tu canción de récord (si la elegiste)');
const ts = src('ui/atleta/TuSemana.jsx');
check(/id: 'momento'/.test(ts) && /r\.momento && r\.records\.length > 1/.test(ts) && /Tu mejor momento/.test(ts), '(305) «Tu mejor momento», con dos récords o más');
check(['TuSemana', 'TuMes', 'TuAnio'].every((f) => /historia-cerrar historia-comp/.test(src(`ui/atleta/${f}.jsx`)) && /import\('\.\.\/\.\.\/logica\/historia-cartas\.js'\)/.test(src(`ui/atleta/${f}.jsx`))), '(304) también en «Tu semana», «Tu mes» y «Tu año» (las tarjetas se preparan al tocar: no pesan al abrir)');
check(!/historia-cartas/.test(src('ui/atleta/Hoy.jsx')) && !/from '\.\.\/\.\.\/logica\/historia-cartas\.js'/.test(ts), 'historia-cartas.js no entra en el arranque (solo con import())');
const ay = src('ui/atleta/EsencialAyuda.jsx');
check(/export function HistoriaRevision/.test(ay) && /Lo que hiciste/.test(ay) && /Lo que cambia/.test(ay) && /En qué fijarte/.test(ay) && /Leer entera/.test(ay), '(306) tu revisión como historia: lo que hiciste, lo que cambia y en qué fijarte, con «Leer entera»');
check(/onClick=\{\(\) => setHistoria\(true\)\}>Leer mi revisión/.test(ay) && /r\.tipo !== 'primera' \? revisionDe\(r\)/.test(ay) && /alEntera\(\)/.test(ay), '(306) «Leer mi revisión» la abre así; sin nada que contar (la primera semana), la hoja de siempre');
check(!/from '\.\.\/historia-tacto\.js'/.test(ay) && /import\('\.\/historia-gestos\.js'\)/.test(ay), '(306) con los gestos de las historias, sin partir el arranque');
const cssM = src('momentos.css');
const sin = cssM.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/[^\x00-\x7f]/.test(cssM) && !/#[0-9a-f]{3,8}\b/i.test(sin) && !/rgba?\(/.test(sin) && !/infinite|@keyframes/.test(sin), 'la hoja de la tanda F: solo ASCII, colores por ficha y nada que se mueva sin parar');
check((sin.match(/\{/g) || []).length === (sin.match(/:not\(#n\):not\(#n\):not\(#n\)/g) || []).length + (sin.match(/@media/g) || []).length, 'cada regla nueva con su especificidad propia (no empata con las de otras pantallas)');
check(/import '\.\/momentos\.css';/.test(src('main.jsx')), 'y entra detrás de las demás');

console.log('312-315 · Sentir el récord');
{
  const S = src('ui/atleta/Sesion.jsx'), F = src('ui/atleta/FilaSerie.jsx'), E = src('ui/atleta/EscenaFinal.jsx'), C = src('momentos.css');
  check(/seriaRecord/.test(S) && /recordsDeSesion\(enOrden\(\{ \.\.\.hechas, \[e\.id\]/.test(S) && /fsr-alcance/.test(F) && /puede ser récord/.test(F) && /\.fsr-alcance/.test(C),
    '(312) la serie que toca lleva filo dorado si, con lo puesto, sería récord: la misma cuenta que al marcarla, y el lector lo dice');
  check(/quedanPautadas === 1/.test(S) && /fsr-ultima/.test(F) && /la última de la sesión/.test(F) && /\.fsr-ultima/.test(C), '(313) la última serie de la sesión, marcada (y dicha)');
  check(/const pulsoMitad = \(\) => \{\s*if \(window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches\) return;/.test(S) && /antesN \+ 1 >= totalP \/ 2\) pulsoMitad\(\)/.test(S), '(314) a mitad de sesión, una ola por la barra de arriba, una vez y nunca con «reducir movimiento»');
  check(/primero \? 'Tu primer récord'/.test(E) && /ef-aro/.test(E) && /\.ef-aro/.test(C) && /esPrimerRecord\(\(x\) => api\.historial\(x\)/.test(S), '(315) el primer récord de tu vida, a lo grande en la escena del final');
}
{
  const almacen = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
  const serie = (id, ses, fecha, kg, reps) => ({ id, sesion_id: ses, fecha, ejercicio_id: 'e1', ejercicio: 'Sentadilla', kg, reps });
  const base = [serie(1, 'a', '2026-11-02', 60, 8), serie(2, 'a', '2026-11-02', 60, 8)];   // una sesión sola: es la base, no un récord
  const conRecord = [...base, serie(3, 'b', '2026-11-09', 70, 8)];                        // la segunda bate a la primera
  const a1 = almacen();
  check(await esPrimerRecord(async () => base, 'at1', 'hoy', { almacen: a1, hoy: '2026-11-27' }) === true && a1.m.get(`${CLAVE_PRIMER_RECORD}:at1`) === '2026-11-27', '(315) sin récords antes, es el primero (y se apunta el día)');
  check(await esPrimerRecord(async () => base, 'at1', 'otra', { almacen: a1 }) === false, '(315) una sola vez en el móvil');
  const a2 = almacen();
  check(await esPrimerRecord(async () => conRecord, 'at2', 'hoy', { almacen: a2 }) === false && a2.m.get(`${CLAVE_PRIMER_RECORD}:at2`) === 'antes', '(315) con récords de antes, no (y no se vuelve a mirar)');
  check(await esPrimerRecord(async () => conRecord, 'at3', 'b', { almacen: almacen() }) === true, '(315) los de la sesión de hoy no cuentan como de antes');
  check(await esPrimerRecord(() => new Promise((ok) => setTimeout(() => ok(base), 120)), 'at4', 'hoy', { almacen: almacen(), espera: 20 }) === false, '(315) si el historial tarda, la escena de siempre');
  check(await esPrimerRecord(async () => { throw new Error('sin red'); }, 'at5', 'hoy', { almacen: almacen() }) === false && await esPrimerRecord(async () => base, 'at6', 'hoy', { almacen: null }) === false, '(315) si falla, o sin almacén, tampoco');
  const a7 = almacen(); a7.setItem('fbe-probar-primer-record', '1');
  check(await esPrimerRecord(async () => conRecord, 'at7', 'hoy', { almacen: a7 }) === true, '(315) en las pruebas del navegador, fbe-probar-primer-record hace como si lo fuera');
}

console.log('319-322 · Sonido y tacto, afinados');
{
  const hhmm = (min) => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const ya = new Date(), ahora = ya.getHours() * 60 + ya.getMinutes();
  const silencio = { silencioActivo: true, silencioDesde: hhmm(ahora - 60), silencioHasta: hhmm(ahora + 60) };
  const nuevos = ['pestana', 'interruptor', 'hoja'];
  check(nuevos.every((k) => SONIDOS[k]?.interfaz && SONIDOS[k].apartado === 'avisos' && prioridadDe(k) === 0), '(319) el tic de las pestañas, el clic de los interruptores y el susurro de las hojas, de la interfaz (y nunca por encima de otro sonido)');
  check(nuevos.every((k) => !puedeSonar({}, k) && puedeSonar({ sonidosInterfaz: true }, k)), '(319) solo con «Sonidos de la interfaz» puesto (de serie, apagado)');
  const on = SONIDOS.interruptor.notas({ on: true }), off = SONIDOS.interruptor.notas({ on: false });
  check(on[1][0] > on[0][0] && off[1][0] < off[0][0], '(319) el interruptor sube al encender y baja al apagar');
  check(duracionDe('hoja') === SUSURRO && SUSURRO < 0.4 && duracionDe('pestana') < 0.05, `(319) cortos: el tic, ${duracionDe('pestana').toFixed(3)} s; el susurro, ${SUSURRO} s`);
  check(nuevos.every((k) => ESCUCHAR.some(([c]) => c === k)) && ESCUCHAR.some(([c]) => c === 'regla'), '(319, 320) y se pueden escuchar en «Escuchar todos»');
  check(puedeSonar({ sonidoTeclado: true }, 'regla') && puedeSonar({ sonidosInterfaz: true }, 'regla') && !puedeSonar({}, 'regla') && prioridadDe('regla') === 0
    && SONIDOS.regla.notas({ mayor: true })[0][3] > SONIDOS.regla.notas({})[0][3], '(320) la regla, un tic por salto (más marcado en sus números), con el sonido del teclado o con los de la interfaz');
  check(/sonarFBE\('regla', \{ mayor: i % a\.m === 0 \}\)/.test(src('ui/Regla.jsx')) && /sonarFBE\('hoja'\)/.test(src('ui/comunes.jsx')) && /sonarFBE\('pestana'\)/.test(src('ui/pulido.js')) && /sonarFBE\('interruptor'/.test(src('ui/pulido.js')), '(319, 320) suenan donde toca: la regla, las hojas, las pestañas y los interruptores');
  check(nuevos.every((k) => !puedeSonar({ ...silencio, sonidosInterfaz: true }, k)) && !puedeSonar({ ...silencio, sonidosInterfaz: true }, 'regla') && puedeSonar({ ...silencio, sonidoTeclado: true }, 'regla'),
    '(322) en el horario sin sonidos, nada de la interfaz (la regla, solo si suena el teclado, que es del entreno)');
  check(volumenDe({ volumenes: { avisos: 0 } }, SONIDOS.hoja.apartado) === 0 && volumenDe({ volumenes: { entreno: 0.5 } }, SONIDOS.regla.apartado) === 0.5 && volumenDe({ volumenes: { entreno: 0 } }, SONIDOS.clinc.apartado) === 0,
    '(322) y cada uno con el volumen de su apartado (los de la interfaz, el de «Logros y comunidad»; la regla y el «clinc», el del entreno)');
}

console.log('323 · Tu color, en todo lo nuevo');
{
  const nuevos = ['tacto-a.css', 'tacto-b.css', 'vista-a.css', 'vista-b.css', 'vista-c.css', 'momentos.css'];
  const fijos = nuevos.filter((f) => /var\(--marca-\d+\)|#593EDE/i.test(src(f)));
  check(fijos.length === 0, `(323) lo nuevo de las tres tandas toma el acento que elijas, nunca el morado fijo de la marca${fijos.length ? `: ${fijos.join(', ')}` : ''}`);
  check(/var\(--morado\)/.test(src('tacto-a.css')) && /getPropertyValue\('--morado'\)/.test(src('ui/confeti.js')), '(323) la luz del borde, el cartel y el confeti, con el color de tu acento');
}

console.log('326 · La app te va conociendo');
{
  const H = src('ui/atleta/Hoy.jsx');
  check(/esPorSuCuenta\(atleta\) && p\.bloque\.nombre === NOMBRE_PRIMERAS_4 && semana\.numero >= 1 && semana\.numero <= 4 && <AroConociendo/.test(H) && /La app te va conociendo · semana \{n\} de 4/.test(H),
    '(326) FBE Esencial, en sus cuatro primeras semanas: «La app te va conociendo · semana N de 4» en la tarjeta de hoy');
  check(/const lleno = k < n - 1 \? 1 : k === n - 1 \? parte : 0;/.test(H) && !/\.cnc-/.test(src('momentos.css')), '(326) el aro: las semanas pasadas, llenas; la de ahora, con lo que llevas de ella (con atributos: sin estilos nuevos en el arranque)');
}

console.log(`\n${ok} bien, ${fallos} mal`);
if (fallos) process.exit(1);
