// (v0.256) El motor de molestias de FBE Esencial, la base: el semáforo de 0 a 10, las diez zonas del cuestionario de
// lesiones, el estado de cada zona, las señales para parar y consultar y cuándo ver a un profesional.
import { readFileSync } from 'node:fs';
import * as D from '../web/src/logica/dolor.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('El semáforo (M1) y las zonas (M2)');
check([0, 1, 2].every((v) => D.semaforo(v) === 'verde') && [3, 4, 5].every((v) => D.semaforo(v) === 'ambar') && [6, 8, 10].every((v) => D.semaforo(v) === 'rojo')
  && D.semaforo(11) === null && D.semaforo(-1) === null && D.semaforo('') === null && D.semaforo(null) === null, '0-2 verde, 3-5 ámbar, 6 o más rojo (y nada fuera de 0 a 10)');
check([[0, 0], [1, 1], [2, 1], [3, 2], [5, 2], [6, 3], [10, 3]].every(([v, i]) => D.intensidadDe(v) === i), 'a la escala de siempre de la tabla de molestias: 0, leve, moderada o grave');
check(D.ZONA_DOLOR_IDS.join() === 'cuello,hombro,codo,muneca_mano,espalda_alta,zona_lumbar,cadera,rodilla,tobillo_pie,otra' && D.NOMBRE_ZONA_DOLOR.muneca_mano === 'Muñeca o mano',
  'las diez zonas del cuestionario de lesiones');
check(D.MARGEN === 3 && /hasta 3 sobre 10/.test(D.REGLA) && /admite hasta 5/.test(D.REGLA) && /mañana siguiente/.test(D.REGLA), 'la regla, con el margen de Pelayo (hasta 3; el semáforo admite hasta 5)');
check(/no deben subir de carga ni de series/.test(D.QUE_HACER.ambar.pasos.join(' ')) && /con 4, mantén la carga/.test(D.QUE_HACER.ambar.pasos.join(' ')) && /un 10 % menos/.test(D.QUE_HACER.ambar.pasos.join(' '))
  && /alternativa sin dolor del mismo grupo/.test(D.QUE_HACER.rojo.pasos.join(' ')) && /dos semanas/.test(D.QUE_HACER.rojo.pasos.join(' ')), 'qué hacer en ámbar (M4, M5 y M7) y en rojo (M7 y M10)');
check(D.SENALES.length === 7 && D.SENALES.some(([, t]) => /Hormigueo/.test(t)) && /112/.test(D.PARA_YA.pecho), 'las siete señales para parar y consultar ya (M9)');

console.log('\nEl estado de cada zona');
const hoy = '2027-02-10';
const r = (zona, valor, fecha, momento = 'ahora') => ({ zona, valor, fecha, momento });
const e1 = D.estadoZonas({ registros: [r('rodilla', 4, '2027-02-01'), r('rodilla', 5, '2027-02-08'), r('hombro', 2, '2027-02-09'), r('codo', 6, '2027-01-10')], hoy });
const rod = e1.find((z) => z.zona === 'rodilla'), hom = e1.find((z) => z.zona === 'hombro'), cod = e1.find((z) => z.zona === 'codo');
check(rod.abierta && rod.semaforo === 'ambar' && rod.desde === '2027-02-01' && rod.valor === 5 && rod.tendencia === 'peor', 'la rodilla: abierta (ámbar) desde el día 1, y peor que la semana anterior');
check(!hom.abierta && hom.semaforo === 'verde' && !cod.abierta && cod.dias === 31, 'el hombro en verde, cerrada; el codo, en rojo hace un mes, ya no cuenta como abierta (3 semanas sin apuntarla)');
check(e1[0].zona === 'hombro' && e1.length === 3, 'de la más reciente a la más antigua');
const e2 = D.estadoZonas({ registros: [r('rodilla', 6, '2027-01-30'), r('rodilla', 2, '2027-02-03'), r('rodilla', 4, '2027-02-09')], hoy });
check(e2[0].desde === '2027-02-09' && e2[0].tendencia === 'mejor', 'una racha nueva empieza tras un verde (y, de una semana a otra, lo más alto baja de 6 a 4: mejor)');
const e3 = D.estadoZonas({ checkins: [{ zona: 'rodilla', valor: 5, semana_inicio: '2027-02-01' }, { zona: 'pectoral', intensidad: 2, semana_inicio: '2027-02-01' }, { zona: 'cadera', valor: 3, semana_inicio: '2027-02-08' }], hoy });
check(e3.length === 2 && e3.find((z) => z.zona === 'rodilla').fecha === '2027-02-07' && e3.find((z) => z.zona === 'cadera').fecha === hoy,
  'su check-in cuenta (el domingo de esa semana, o hoy si aún no ha llegado); las zonas musculares de siempre, no');
check(D.estadoZonas({ registros: [r('rodilla', 3, '2027-02-12')], hoy }).length === 0 && D.estadoZonas({ hoy: null }).length === 0, 'lo de días que aún no han llegado, no');
check(D.estadoZonas({ registros: [r('rodilla', 5, '2027-02-02'), r('rodilla', 3, '2027-02-09')], hoy })[0].tendencia === 'mejor', 'mejor que la semana anterior');

console.log('\nCuándo ver a un profesional (M10)');
check(D.profesional({ senal: true }).motivo === 'senal', 'con una señal de M9, al momento');
const sem = (l, valor) => ({ semana_inicio: l, zona: 'rodilla', valor });
check(D.profesional({ semanas: [sem('2027-01-04', 3), sem('2027-01-11', 5), sem('2027-01-18', 2), sem('2027-01-25', 6)], hoy })?.motivo === 'semanas', '3 de las últimas 6 semanas con 3 o más (moderada o grave, como ahora en «Cuando la app no basta»)');
check(D.profesional({ semanas: [{ semana_inicio: '2027-01-04', zona: 'pectoral', intensidad: 2 }, { semana_inicio: '2027-01-11', zona: 'pectoral', intensidad: 3 }, { semana_inicio: '2027-01-18', zona: 'cuadriceps', intensidad: 2 }], hoy })?.motivo === 'semanas',
  '(y con el check-in de siempre, moderada o grave)');
check(D.profesional({ semanas: [sem('2027-01-04', 4), sem('2027-01-11', 3), sem('2027-01-18', 2), sem('2027-01-25', 1)], hoy }) === null, 'con menos, no');
const larga = D.estadoZonas({ registros: [r('rodilla', 5, '2027-01-25'), r('rodilla', 5, '2027-02-02'), r('rodilla', 5, '2027-02-09')], hoy });
check(D.profesional({ estado: larga, hoy })?.motivo === 'dos_semanas' && /rodilla lleva dos semanas sin mejorar/.test(D.profesional({ estado: larga, hoy }).texto), 'una zona abierta dos semanas sin mejorar');
const mejora = D.estadoZonas({ registros: [r('rodilla', 5, '2027-01-25'), r('rodilla', 5, '2027-02-02'), r('rodilla', 3, '2027-02-09')], hoy });
check(D.profesional({ estado: mejora, hoy }) === null, 'si está mejorando, todavía no');
{
  const lineas = readFileSync(new URL('../web/src/logica/dolor.js', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l) && /\.(test|exec|replace|match|split)\(/.test(l));
  const regs = lineas.flatMap((l) => l.match(/\/(?:\\.|[^/\n])+\/[gimsuy]*(?=\.|\))/g) || []);
  check(regs.every((x) => !/[^\x00-\x7F]/.test(x)), `sus expresiones regulares, solo ASCII (${regs.length})`);
}

console.log('\nEn su check-in (de 0 a 10) y después');
const C = await import('../web/src/logica/esencial-checkin.js');
check(C.queHacerDolor({}) === null && C.queHacerDolor({ rodilla: 2, hombro: 0 }) === null, 'sin molestias o en verde: nada que hacer');
const am = C.queHacerDolor({ rodilla: 4, hombro: 2 }), ro = C.queHacerDolor({ rodilla: 4, cadera: 7 });
check(am && !am.grave && am.titulo === D.QUE_HACER.ambar.titulo && am.zonas === 'rodilla' && ro.grave && ro.titulo === D.QUE_HACER.rojo.titulo && ro.zonas === 'rodilla y cadera',
  'en ámbar, lo del ámbar (solo las zonas de 3 o más); con alguna en rojo, lo del rojo');
check(D.SENALES.every(([, t]) => C.CONSULTA.includes(t.toLowerCase())) && am.consulta === C.CONSULTA, 'cuándo consultar: las siete señales de «Me duele algo», en una frase');
const tras = (o) => C.trasElCheckin(o).find((l) => l.id === 'molestia')?.texto || '';
check(/una molestia de 4 sobre 10 en rodilla/.test(tras({ valores: { rodilla: 4, hombro: 1 }, molestias: { rodilla: 2, hombro: 1 } }))
  && /molestias de 3 o más sobre 10 en rodilla y hombro/.test(tras({ valores: { rodilla: 4, hombro: 6 } })) && tras({ valores: { rodilla: 2 } }) === ''
  && /una molestia moderada en cuádriceps/.test(tras({ molestias: { cuadriceps: 2 } })), 'después de enviarlo, lo que ha marcado (de 0 a 10 o, como antes, leve, moderada o grave)');
const V = await import('../web/src/logica/vida.js');
check(/en la rodilla y el hombro: ¿cómo siguen\?/.test(V.seguimientoCheckin('molestias', null, [{ zona: 'rodilla', intensidad: 2 }, { zona: 'hombro', intensidad: 1 }]) || ''), 'la semana siguiente, «¿cómo siguen?» también con las zonas nuevas');
const { NOMBRE_ZONA } = await import('../web/src/logica/calculos.js');
check(D.ZONA_DOLOR_IDS.every((z) => NOMBRE_ZONA[z]) && NOMBRE_ZONA.cuadriceps === 'Cuádriceps' && NOMBRE_ZONA.rodilla === 'Rodilla', 'el panel y la ficha del coach nombran las zonas nuevas (y las de siempre)');
const Bo = await import('../web/src/logica/cierre.js');
{
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
  Bo.guardarBorradorCheckin('a1', '2027-02-08', { molestias10: { rodilla: 4, hombro: 0, codo: 12, cadera: 2.5 } });
  const bor = Bo.leerBorradorCheckin('a1', '2027-02-08');
  check(JSON.stringify(bor?.molestias10) === '{"rodilla":4}', 'a medias, se queda en el móvil (solo las de 1 a 10)');
  delete globalThis.localStorage;
}
const VE = await import('../web/src/logica/esencial-vida.js');
check(/sin pasar de 3 sobre 10/.test(VE.MOLESTIA_SIGUE.find(([k]) => k === 'mejor')[2]), '«¿Cómo va tu molestia?», «Mejor»: con el margen de Pelayo (hasta 3)');

console.log('\nLa privacidad (2026-12.46, solo con la 109), lo que se descarga, las pantallas y los estilos');
const legal = await import('../web/src/legal.js');
const PN = await import('../web/src/logica/privacidad-novedades.js');
const sec = legal.PRIVACIDAD.find((x) => x[0] === 'Tus molestias')?.[1] || '';
check(legal.VERSION_LEGAL === '2026-12.46' && legal.VERSION_LEGAL_SIN_109 === '2026-12.45' && PN.NOVEDADES_PRIVACIDAD[0][3] === '2026-12.46' && PN.NOVEDADES_PRIVACIDAD[0][2].length <= 260
  && PN.novedadesDesde('2026-12.45', '2026-12.46').length === 1, 'la versión 2026-12.46 (sin la 109, la 2026-12.45) y su novedad, corta');
check(/consentimiento de datos de salud/.test(sec) && /de 0 a 10/.test(sec) && /tu coach/.test(sec) && /borrar/.test(sec) && /no se guarda/.test(sec) && /Descargar mis datos/.test(sec),
  'su sección cuenta qué se guarda (con el consentimiento), quién lo ve, cómo se borra y que las señales no se guardan');
const fuente = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');
const apiSrc = fuente('datos/api.js');
check(/VERSION_LEGAL_SIN_109/.test(apiSrc) && /hay109/.test(apiSrc) && /'dolor_registros'\]\) out\[t\]/.test(apiSrc) && /'dolor_registros'/.test(fuente('datos/copia-tablas.js')),
  'la versión, según esté la 109; sus molestias, en «Descargar mis datos» y en la copia');
const jsx = fuente('ui/atleta/EsencialDolor.jsx');
check(!/hasta 5 sobre 10/.test(jsx + fuente('logica/esencial-checkin.js').replace(/^\/\/.*$/gm, '')) && !/hasta 5 sobre 10/.test(fuente('ui/atleta/EsencialVida.jsx')),
  'en la app ya no sale «hasta 5 sobre 10» (P3: la web lo explica; la app, con margen)');
check(/EsencialDolor\.jsx'\), 'HojaMolestia'/.test(fuente('ui/atleta/EsencialAyuda.jsx')) && !/export function HojaMolestia/.test(fuente('ui/atleta/EsencialVida.jsx')),
  '«Me duele algo» es la nueva (la de antes, fuera)');
const css = fuente('dolor.css');
check(/^[\x00-\x7F]*$/.test(css) && !/margin|font-size|font-weight|\[/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')) && (css.match(/^\.([a-z0-9-]+)/gm) || []).every((x) => /^\.dol-/.test(x))
  && /prefers-reduced-motion/.test(css) && /import '\.\/dolor\.css'/.test(fuente('main.jsx')), 'dolor.css: ASCII, sin márgenes ni tamaños de letra ni atributos, solo clases dol-* y con «reducir movimiento»');
{
  const enClase = [...jsx.matchAll(/class=(?:"([^"]*)"|\{([^}]*)\})/g)].map((m) => m[1] || m[2]).join(' ');
  const usadas = new Set([...enClase.matchAll(/\bdol-[a-z0-9-]+/g)].map((m) => m[0]).filter((c) => !c.endsWith('-')));
  for (const s of ['verde', 'ambar', 'rojo']) for (const p of ['dol-n', 'dol-que', 'dol-badge']) usadas.add(`${p}-${s}`);
  const definidas = new Set((css.match(/^\.(dol-[a-z0-9-]+)/gm) || []).map((x) => x.slice(1)));
  const sinEstilo = [...usadas].filter((c) => !definidas.has(c));
  check(sinEstilo.length === 0, `cada clase dol-* de la pantalla tiene su estilo${sinEstilo.length ? `: faltan ${sinEstilo.join(', ')}` : ''}`);
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
