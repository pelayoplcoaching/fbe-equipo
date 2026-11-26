// FBE Esencial (v0.255): «Tus pruebas». Los cortes y los textos de las herramientas de la web (silla, equilibrio,
// cintura/altura, prensión y SPPB), pasados a tú; cuándo toca repetirlas, la vez anterior y lo que se guarda.
import { readFileSync } from 'node:fs';
import * as P from '../web/src/logica/esencial-pruebas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('La silla en 30 segundos (Rikli y Jones 1999 y 2013)');
const s = (veces, edad, sexo) => P.resultadoSilla({ veces, edad, sexo });
check(s(13, 66, 'mujer').zona === 'medio' && s(13, 66, 'mujer').a === 11 && s(13, 66, 'mujer').b === 16 && s(13, 66, 'mujer').u === 15 && /mujeres de 65 a 69 años/.test(s(13, 66, 'mujer').texto),
  'una mujer de 66 con 13: dentro de lo normal (11 a 16), por debajo del umbral de autonomía (15)');
check(/hay margen para ganar fuerza/.test(s(13, 66, 'mujer').texto) && /Y llegas al umbral/.test(s(15, 66, 'mujer').texto), 'por debajo del umbral, margen para ganar fuerza; en el umbral, «llegas»');
check(s(10, 66, 'mujer').zona === 'bajo' && /STEADI/.test(s(10, 66, 'mujer').texto) && /coméntalo con tu médico/.test(s(10, 66, 'mujer').texto), 'por debajo del rango: más riesgo de caídas (STEADI) y a su médico');
check(s(20, 61, 'hombre').zona === 'alto' && /Mejor que 3 de cada 4 hombres de 60 a 64 años/.test(s(20, 61, 'hombre').texto), 'por encima: mejor que 3 de cada 4 de su grupo');
check(s(0, 70, 'h').zona === 'bajo' && /sin los brazos/.test(s(0, 70, 'h').titulo), 'con 0 (le hacen falta los brazos): a su médico');
check(s(12, 97, 'mujer').grupo === 'mujeres de 90 a 94 años' && /más de 94 años/.test(s(12, 97, 'mujer').texto), 'con más de 94, el grupo de 90 a 94 (y lo dice)');
check(s(15, 45, 'hombre').zona === null && /60 a 94 años/.test(s(15, 45, 'hombre').titulo) && /compárate contigo/.test(s(15, 45, 'hombre').texto) && s(15, 70, null).zona === null,
  'con menos de 60, o sin su sexo, sin referencia: frente a la vez anterior (pregunta 7a)');
check(s(-1, 70, 'h') === null && s(61, 70, 'h') === null && s(2.5, 70, 'h') === null, 'un número raro: nada');
check(P.NORMAS_SILLA.mujer.length === 7 && P.NORMAS_SILLA.hombre.length === 7 && P.NORMAS_SILLA.hombre[0].join() === '60,14,19,17' && P.NORMAS_SILLA.mujer[6].join() === '90,4,11,9',
  'las tablas de la web, tal cual');

console.log('\n10 segundos sobre una pierna (Araujo 2022)');
const e = (intentos, edad = 60) => P.resultadoEquilibrio({ intentos, edad });
check(e([10]).zona === 'alto' && e([10]).valor === 10 && /8 de cada 10/.test(e([10]).texto) && e([4, 10]).titulo === 'Diez segundos a una pierna (al intento 2)', 'conseguido (y en qué intento)');
check(e([4]) === null && e([4, 6]) === null, 'sin conseguirlo y con intentos por delante, aún nada');
check(e([4, 6, 7.5]).zona === 'bajo' && e([4, 6, 7.5]).valor === 7.5 && /7 años siguientes/.test(e([4, 6, 7.5]).texto) && /asociación, no una condena/.test(e([4, 6, 7.5]).texto), 'tres intentos sin llegar: la señal, con su mejor tiempo');
check(e([10], 45).zona === null && /51 a 75 años/.test(e([10], 45).texto) && e([3, 3, 3], 80).zona === null, 'fuera de 51 a 75, sin zona: frente a la vez anterior');

console.log('\nCintura y altura (NICE NG246)');
const c = (cintura, altura) => P.resultadoCintura({ cintura, altura });
check(c(80, 170).zona === 'alto' && c(80, 170).categoria === 'Saludable (0,4 a 0,49)' && /por debajo de 85 cm/.test(c(80, 170).texto), 'saludable, con su cintura máxima para su altura');
check(c(88, 170).valor === 0.52 && c(88, 170).zona === 'medio' && /Pide a tu médico/.test(c(88, 170).texto), 'aumentada (0,52): a su médico');
check(c(105, 170).zona === 'bajo' && c(105, 170).categoria === 'Alta (0,6 o más)', 'alta desde 0,6');
check(c(65, 170).categoria === 'Por debajo de 0,4' && /perdido peso sin buscarlo/.test(c(65, 170).texto), 'por debajo de 0,4: fuera del rango de la guía');
check(c(88, 171).texto.includes('85,5 cm') && c(88, 90) === null && c(10, 170) === null, 'la mitad de su altura, con un decimal si lo tiene; alturas o cinturas raras, nada');

console.log('\nLa prensión (EWGSOP2)');
const g = (intentos, sexo) => P.resultadoPrension({ intentos, sexo });
check(g([24, 26, 25], 'hombre').zona === 'bajo' && g([24, 26, 25], 'hombre').valor === 26 && /27 kg/.test(g([24, 26, 25], 'hombre').texto), 'un hombre con 26 de mejor: baja (menos de 27)');
check(g([16], 'mujer').zona === 'alto' && /tres intentos el resultado es más fiable/.test(g([16], 'mujer').texto) && g([15.5, 14], 'm').zona === 'bajo', 'una mujer con 16: por encima (el corte es 16; con menos de tres intentos, lo dice)');
check(g([], 'mujer') === null && g([20], null) === null, 'sin intentos o sin su sexo, nada');

console.log('\nEl SPPB (Guralnik 1994)');
const sp = (d) => P.puntuarSPPB(d);
check(sp({ lado: 10, semi: 10, tandem: 10, marcha: [4.5], silla: 10 }).total === 12 && sp({ lado: 10, semi: 10, tandem: 10, marcha: [4.5], silla: 10 }).zona === 'alto', '12: rendimiento alto');
check(sp({ lado: 10, semi: 10, tandem: 5, marcha: [5.1, 4.9], silla: 12.5 }).total === 9 && /margen de mejora/.test(sp({ lado: 10, semi: 10, tandem: 5, marcha: [5.1, 4.9], silla: 12.5 }).texto)
  && !/8 o menos/.test(sp({ lado: 10, semi: 10, tandem: 5, marcha: [5.1, 4.9], silla: 12.5 }).texto), '9: intermedio (cuenta el mejor de las dos marchas)');
check(/8 o menos/.test(sp({ lado: 10, semi: 10, tandem: 2, marcha: [6], silla: 13 }).texto) && sp({ lado: 10, semi: 10, tandem: 2, marcha: [6], silla: 13 }).total === 8, '8: intermedio, y el bajo rendimiento de EWGSOP2');
check(sp({ lado: 5, marcha: null, silla: 0 }).total === 0 && sp({ lado: 5, marcha: null, silla: 0 }).zona === 'bajo', 'sin poder hacer ninguna: 0, bajo');
check(sp({ lado: 10, semi: 8 }).partes.equilibrio === 1 && sp({ lado: 10, semi: 8 }).total === null && sp({}).total === null, 'a medias: las partes que hay, sin total');
check([[4.81, 4], [4.82, 3], [6.2, 3], [6.21, 2], [8.7, 2], [8.71, 1]].every(([t, p]) => sp({ lado: 0, marcha: [t], silla: 0 }).partes.marcha === p)
  && [[11.19, 4], [11.2, 3], [13.69, 3], [16.69, 2], [60, 1], [61, 0]].every(([t, p]) => sp({ lado: 0, marcha: [5], silla: t }).partes.silla === p), 'los cortes de la marcha y de la silla, los de la web');

console.log('\nCuándo toca y la vez anterior');
const f = (prueba, fecha, valor) => ({ prueba, fecha, valor });
check(P.tocaPruebas([], '2027-01-04').toca && !P.tocaPruebas([f('silla', '2027-01-04', 12)], '2027-03-28').toca && P.tocaPruebas([f('silla', '2027-01-04', 12)], '2027-03-29').toca, 'sin ninguna, toca; después, a los 84 días (12 semanas)');
check(P.tocaPruebas([f('prension', '2027-01-04', 30)], '2027-01-05').toca, 'la prensión sola no cuenta (es opcional)');
const u = P.ultimasPruebas([f('silla', '2027-01-04', 12), f('silla', '2027-04-01', 14), f('silla', '2027-04-01', 15), f('cintura', '2027-01-04', 0.52)]);
check(u.silla.ultima.valor === 14 && u.silla.anterior.valor === 12 && u.cintura.ultima.valor === 0.52 && !u.cintura.anterior, 'la última de cada una y la anterior (de otro día)');
check(P.comparar('silla', { valor: 14 }, { valor: 12 }) === 'mejor' && P.comparar('cintura', { valor: 0.5 }, { valor: 0.52 }) === 'mejor' && P.comparar('cintura', { valor: 0.522 }, { valor: 0.52 }) === 'igual'
  && P.comparar('equilibrio', { valor: 6 }, { valor: 10 }) === 'peor' && P.comparar('silla', { valor: 1 }, null) === null, 'mejor, igual o peor (en la cintura, bajar es mejorar)');
check(P.pruebasDe({ edad: 40 }).join() === 'silla,equilibrio,cintura' && P.pruebasDe({ edad: 66, dinamometro: true }).join() === 'silla,equilibrio,cintura,prension,sppb', 'las tres sin material; la prensión con dinamómetro; el SPPB desde los 65');

console.log('\nLo que se guarda');
check(JSON.stringify(P.filaPrueba('silla', { veces: 14, edad: 66, sexo: 'mujer' })) === JSON.stringify({ prueba: 'silla', valor: 14, detalle: null }), 'la silla: sus veces');
check(P.filaPrueba('cintura', { cintura: 88, altura: 170 }).valor === 0.52 && P.filaPrueba('cintura', { cintura: 88, altura: 170 }).detalle.altura === 170, 'cintura y altura: el índice, con las dos medidas');
check(P.filaPrueba('equilibrio', { intentos: [4], edad: 60 }).error && P.filaPrueba('nada', {}).error && P.filaPrueba('sppb', { lado: 10 }).error, 'lo que no está completo, con su error');
check(P.valorTexto('silla', 14) === '14 veces' && P.valorTexto('equilibrio', 7.5) === '7,5 s' && P.valorTexto('cintura', 0.52) === '0,52' && P.valorTexto('prension', 26) === '26 kg' && P.valorTexto('sppb', 9) === '9 de 12', 'y cómo se lee');
check(P.comparar('cintura', { valor: 0.38 }, { valor: 0.42 }) === null && P.comparar('cintura', { valor: 0.42 }, { valor: 0.38 }) === null, 'por debajo de 0,4, la cintura no se juzga (como en la web)');

console.log('\nLo guardado: el resultado, el antes y el ahora y el informe para su médico');
check(P.resultadoSPPB(9).categoria === 'Rendimiento intermedio (7-9)' && P.resultadoSPPB(12).zona === 'alto' && P.resultadoSPPB(6).zona === 'bajo' && P.resultadoSPPB(13).total === null,
  'el SPPB con su total: las categorías de la web');
const fx = [f('silla', '2027-04-05', 13), f('silla', '2027-01-10', 11), f('cintura', '2027-04-05', 0.52), f('equilibrio', '2027-04-05', 7.5), f('prension', '2027-04-05', 17), f('sppb', '2027-04-05', 9)];
Object.assign(fx[0], { edad: 66, sexo: 'mujer' }); Object.assign(fx[1], { edad: 66, sexo: 'mujer' });
fx[2].detalle = { cintura: 88, altura: 170 }; fx[3].detalle = { intentos: [4, 6, 7.5] }; fx[3].edad = 66; fx[4].detalle = { intentos: [15.5, 17, 16] }; fx[4].sexo = 'mujer';
fx[5].detalle = { partes: { equilibrio: 3, marcha: 3, silla: 3 } };
check(P.resultadoDeFila(fx[0]).zona === 'medio' && P.resultadoDeFila(fx[3]).zona === 'bajo' && P.resultadoDeFila(fx[2]).categoria === 'Aumentada (0,5 a 0,59)'
  && P.resultadoDeFila(fx[4]).zona === 'alto' && P.resultadoDeFila(fx[5]).zona === 'medio' && P.resultadoDeFila({ prueba: 'prension', valor: 20, detalle: { intentos: [20] } }) === null,
  'el resultado de cada fila guardada, con su edad y su sexo de ese día (sin su sexo, la prensión no tiene corte)');
const aa = P.antesYAhora(fx);
check(aa.length === 1 && aa[0].prueba === 'silla' && aa[0].texto === '11 veces → 13 veces' && aa[0].mejor, '«Tu trimestre»: solo lo hecho dos veces, la vez anterior y la última');
check(P.textoEntreno({ inicio: '2027-01-11', fechas: ['2027-04-05', '2027-03-30', '2027-03-01', '2027-04-07'], hoy: '2027-04-06' }) === 'Mi entreno: fuerza con FBE Esencial desde el 11 de enero de 2027; 2 sesiones en las últimas 4 semanas.'
  && P.textoEntreno({ inicio: '2027-05-01', fechas: [], hoy: '2027-04-06' }) === null, 'su entreno: desde cuándo y las sesiones de las últimas 4 semanas');
const inf = P.informeMedico({ filas: fx, hoy: '2027-04-06', nombre: '  Ana   López ', entreno: 'Mi entreno: x.' });
check(/^Resultados de mis pruebas físicas\nFBE Esencial · Fuerza Basada en Evidencia\nFecha del informe: 6 de abril de 2027\nNombre: Ana López\nEdad: 66 años · Sexo: mujer\n/.test(inf), 'el informe: cabecera, nombre (si lo pone) y su edad y su sexo');
check(inf.includes('Levantarse de la silla en 30 segundos (Rikli y Jones): 13 veces, el 5 de abril de 2027.\nDentro del rango normal para mujeres de 65 a 69 años (de 11 a 16 veces; umbral de autonomía: 15).\nAnterior: 11 veces, el 10 de enero de 2027.')
  && inf.includes('No completado en tres intentos (mejor: 7,5 s).') && inf.includes('Índice cintura/altura (NICE): 0,52 (cintura 88 cm, altura 170 cm)')
  && inf.includes('Por encima del punto de corte de EWGSOP2 para mujeres (16 kg).') && inf.includes('SPPB (Guralnik): 9 de 12 (equilibrio 3, marcha 3, levantarse 3)'),
  'cada prueba: su valor, su categoría (las de la web) y la vez anterior');
check(inf.includes('Mi entreno: x.') && /Fuentes:\n1\. Rikli RE/.test(inf) && (inf.match(/Cruz-Jentoft/g) || []).length === 1 && inf.endsWith('Informe hecho en mi móvil con la app de FBE.') && !/Pelayo/.test(inf),
  'su entreno, las fuentes (sin repetir) y sin el nombre de Pelayo');
check(P.informeMedico({ filas: [] }) === null && P.fechaInforme('2027-01-03') === '3 de enero de 2027', 'sin pruebas, sin informe');
check(P.COMO_PRUEBA.silla.length === 5 && P.COMO_PRUEBA.equilibrio.length === 4 && /a medio camino/.test(P.COMO_PRUEBA.cintura[0]) && /90 grados/.test(P.COMO_PRUEBA.prension[0])
  && Object.keys(P.FUENTES_PRUEBA).join() === P.PRUEBAS.join() && P.SPPB_PARTES.posturas.length === 3, 'cómo se hace cada una (los textos de la web) y sus fuentes');

{
  // (las líneas de código que usan una expresión regular, sin los comentarios)
  const lineas = readFileSync(new URL('../web/src/logica/esencial-pruebas.js', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l) && /\.(test|exec|replace|match|split)\(/.test(l));
  const regs = lineas.flatMap((l) => l.match(/\/(?:\\.|[^/\n])+\/[gimsuy]*(?=\.|\))/g) || []);
  check(regs.length > 0 && regs.every((x) => !/[^\x00-\x7F]/.test(x)), `sus expresiones regulares, solo ASCII (${regs.length})`);
}

console.log('\nLa privacidad (2026-12.45, solo con la 108), lo que se descarga y los estilos');
const legal = await import('../web/src/legal.js');
const PN = await import('../web/src/logica/privacidad-novedades.js');
const sec = legal.PRIVACIDAD.find((x) => x[0] === 'Tus pruebas físicas')?.[1] || '';
check(legal.VERSION_LEGAL === '2026-12.45' && legal.VERSION_LEGAL_SIN_108 === '2026-12.44' && PN.NOVEDADES_PRIVACIDAD[0][3] === '2026-12.45' && PN.NOVEDADES_PRIVACIDAD[0][2].length <= 260
  && PN.novedadesDesde('2026-12.44', '2026-12.45').length === 1, 'la versión 2026-12.45 (sin la 108, la 2026-12.44) y su novedad, corta');
check(/consentimiento de datos de salud/.test(sec) && /tu edad y tu sexo/.test(sec) && /tu coach/.test(sec) && /borrar/.test(sec) && /informe para tu médico/.test(sec) && /no se guarda/.test(sec) && /Descargar mis datos/.test(sec),
  'su sección cuenta qué se guarda (con el consentimiento), quién lo ve, cómo se borra y que el informe se hace en el móvil');
const fuente = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');
const apiSrc = fuente('datos/api.js');
check(/VERSION_LEGAL_SIN_108/.test(apiSrc) && /hay108/.test(apiSrc) && /'pruebas_fisicas'\]\) out\[t\]/.test(apiSrc) && /'pruebas_fisicas'/.test(fuente('datos/copia-tablas.js')),
  'la versión, según esté la 108; sus pruebas, en «Descargar mis datos» y en la copia');
const css = fuente('pruebas.css');
check(/^[\x00-\x7F]*$/.test(css) && !/margin|font-size|font-weight|\[/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')) && (css.match(/^\.([a-z0-9-]+)/gm) || []).every((x) => /^\.prb-/.test(x))
  && /prefers-reduced-motion/.test(css) && /import '\.\/pruebas\.css'/.test(fuente('main.jsx')), 'pruebas.css: ASCII, sin márgenes ni tamaños de letra ni atributos, solo clases prb-* y con «reducir movimiento»');
const jsx = fuente('ui/atleta/EsencialPruebas.jsx');
check(!/Pelayo/.test(jsx.slice(jsx.indexOf('function InformeMedico'))) && /usePantallaEncendida\(\)/.test(jsx) && /He apoyado el pie/.test(jsx) && /\+1 de pie/.test(jsx),
  'la hoja: el informe sin el nombre de Pelayo, la pantalla encendida y los botones de la web («+1 de pie», «He apoyado el pie»)');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
