// FBE Esencial (acompañamiento, tanda 4, v0.245): el centro de respuestas. Que cada respuesta tenga su tema, que nada
// apunte a una respuesta que no existe («¿Qué necesitas?», las dudas de cada ejercicio y de cada pantalla, lo que abre
// cada aviso), que el buscador encuentre sin tildes, que lo que Pelayo aún no ha visto esté apagado (y se vea con la vista
// previa), que no se hable de «tu coach» y que las pantallas nuevas lleven su trozo y sus estilos donde toca.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIAS, RESPUESTAS, PENDIENTES, APAGADO, encendido, respuestas, respuestaDe, buscarRespuestas, PALABRAS, DUDAS_EJERCICIO, NECESITAS, necesitasPara, DUDAS_PANTALLA, AVISO_ABRE, caminoDe, PLAN_EXPLICADO,
  LECCIONES_MOMENTO, momentoDe, checkinResponde, fijarAjustes, conDirecto } from '../web/src/logica/esencial-respuestas.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const lee = (r) => readFileSync(join(raiz, r), 'utf8');
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Las respuestas');
const cats = CATEGORIAS.map((c) => c[0]);
check(RESPUESTAS.length >= 40 && new Set(RESPUESTAS.map((x) => x.id)).size === RESPUESTAS.length && RESPUESTAS.every((x) => /^[a-z0-9-]+$/.test(x.id)), `${RESPUESTAS.length} respuestas, cada una con su clave, sin repetir`);
check(CATEGORIAS.length === 9 && RESPUESTAS.every((x) => cats.includes(x.cat)) && cats.every((c) => RESPUESTAS.filter((x) => x.cat === c).length >= 4), 'nueve temas (con «Antes de empezar», v0.248), y en cada uno al menos cuatro respuestas');
check(RESPUESTAS.every((x) => x.q.length >= 8 && x.q.length <= 60 && x.r.length >= 60 && x.r.length <= 430), 'preguntas cortas y respuestas de un párrafo');
check(/tu tendencia, que es lo que importa/.test(respuestaDe('peso').r), 'el peso de un día no dice nada: la tendencia');
const todo = [...RESPUESTAS, ...PENDIENTES].map((x) => `${x.q} ${x.r}`).join(' ');
check(!/tu coach|tu entrenador/i.test(todo), 'ninguna habla de «tu coach»: quien va por su cuenta no tiene');
check(!/\b(RIR|RPE)\b/.test(todo), 'ni de RIR o RPE: se dice «te sobran»');
check(RESPUESTAS.filter((x) => x.enlace).every((x) => /^[a-z-]+\.html$/.test(x.enlace[1]) && x.enlace[0]), 'los enlaces a la web, a páginas suyas');
check(RESPUESTAS.filter((x) => x.ir).every((x) => ['directo', 'pausa', 'dias', 'revision', 'rutina'].includes(x.ir)), 'lo que una respuesta puede abrir: algo que la app sabe hacer');
// Lo de salud que sale: solo lo ya aprobado (las preguntas frecuentes de antes, la lección 7, las agujetas y el check-in)
const salud = RESPUESTAS.filter((x) => x.cat === 'salud').map((x) => x.id);
check(JSON.stringify(salud) === JSON.stringify(['agujetas', 'dolor', 'enfermedad', 'molestia-checkin']), `de salud solo sale lo ya aprobado (${salud.join(', ')})`);
check(/para y habla con tu médico/.test(respuestaDe('dolor').r) && /La app no valora el dolor/.test(respuestaDe('dolor').r), 'y «¿Y si me duele algo?» conserva las señales para parar y que la app no valora el dolor');

console.log('\nLo apagado hasta que Pelayo lo vea');
check(APAGADO.has('salud_nueva') && APAGADO.has('lecciones_momento') && APAGADO.has('checkin_responde') && !encendido('salud_nueva') && encendido('salud_nueva', true) && encendido('otra_cosa') && APAGADO.size === 24
  && ['enfermo', 'molestia_sigue', 'salud_al_dia', 'alarma', 'molestia_frena', 'suave', 'dos_duras', 'variante'].every((k) => APAGADO.has(k)), 'lo apagado (veinticuatro cosas: las cinco de antes, las ocho de la tanda 6, las dos de la tanda 7 y las nueve de la comida, de la 9); la vista previa lo enciende');
check(PENDIENTES.length >= 3 && PENDIENTES.every((x) => x.cat === 'salud') && !respuestas().some((x) => PENDIENTES.some((p) => p.id === x.id)) && respuestas({ previa: true }).filter((x) => x.pendiente).length === PENDIENTES.length,
  `las ${PENDIENTES.length} respuestas de salud nuevas no salen; en la vista previa, marcadas como pendientes`);
check(respuestaDe('resfriado') === null && respuestaDe('resfriado', { previa: true })?.pendiente === true, 'ni se llega a ellas por su clave');
const PUB = [{ id: 'x1', pregunta: '¿Cuánto tardo en notar el peso muerto?', respuesta: 'Unas semanas.' }, { id: 'x2', pregunta: '', respuesta: 'sin pregunta' }];
check(!respuestas({ publicas: PUB }).some((x) => x.directo), '(v0.251) con el directo oculto, las dudas del directo hechas públicas no entran');
fijarAjustes([{ clave: 'directo', encendido: true }]);
const pub = respuestas({ publicas: PUB });
check(pub.filter((x) => x.directo).length === 1 && pub.find((x) => x.directo).cat === 'directo', 'con «El directo de dudas» encendido, entran en su tema (y las que no tienen pregunta escrita, no)');
fijarAjustes([]);
check(Object.keys(LECCIONES_MOMENTO).length === 5 && momentoDe({ semana: 'descarga' }) === 'descarga' && momentoDe({ semana: 'normal', porque: [{ estancado: true }] }) === 'estancado' && momentoDe({ tipo: 'primera', semana: 'normal' }) === 'rutina'
  && momentoDe({ semana: 'normal', porque: [] }) === null && Object.values(LECCIONES_MOMENTO).every(([t, x]) => t && x.length <= 240), 'las cinco lecciones que saltan cuando toca, escritas y con su momento');
check(checkinResponde({ horas_sueno: '5-6', motivacion: 4 }).length === 1 && checkinResponde({ horas_sueno: '7-8', motivacion: 3, energia: 1 }).length === 0 && checkinResponde({ horas_sueno: '<5', motivacion: 1 }).length === 2 && checkinResponde().length === 0,
  'el check-in contesta a lo que no tenía respuesta (poco sueño y poca motivación): escrito, y apagado');

console.log('\nNada apunta a una respuesta que no existe');
const ids = new Set(RESPUESTAS.map((x) => x.id));
check(DUDAS_EJERCICIO.length === 5 && DUDAS_EJERCICIO.every(([t, id]) => t && ids.has(id)), 'las cinco dudas de cada ejercicio');
check(Object.values(DUDAS_PANTALLA).every((id) => ids.has(id)) && ['cierre', 'perdida', 'marcas', 'leccion', 'dias'].every((k) => DUDAS_PANTALLA[k]), 'el «¿Dudas?» de cada pantalla');
check(NECESITAS.length === 13 && NECESITAS.every(([id, t, icono, que]) => id && t && icono && (/^accion:(dias|rutina|plan|directo|viaje|molestia|sitio|ejercicios|objetivo|enfermo|suave)$/.test(que) || (que.startsWith('respuesta:') && ids.has(que.slice(10))))),
  '«¿Qué necesitas?»: trece cosas (v0.247), cada una con su respuesta o con lo que abre');
{
  // (v0.247) lo que le sale a cada uno: sin plan, sin la tabla de notas, con todo y con la vista previa
  const de = (o) => necesitasPara(o).map((x) => x[0]).join();
  check(de({}) === 'viaje,duele' && necesitasPara({})[0][3] === 'respuesta:viaje' && ids.has('viaje'), 'sin plan y sin la migración 100: «Me voy de viaje» (su respuesta de siempre) y «Me duele algo»');
  check(de({ con100: true }) === 'viaje,duele,objetivo' && necesitasPara({ con100: true })[0][3] === 'accion:viaje', 'sin plan, con la 100: además su objetivo (el viaje, con fechas); la pregunta para el directo, oculta (v0.251)');
  check(de({ conPlan: true }) === 'falle,viaje,duele,tiempo,sitio,ejercicio,dias,rutina,plan', 'con plan y sin la 100: lo que no guarda notas');
  check(de({ con100: true, conPlan: true }) === 'falle,viaje,duele,tiempo,sitio,ejercicio,dias,rutina,objetivo,plan', 'con todo: diez (ni lo apagado ni el directo, que está oculto)');
  check(de({ con100: true, conPlan: true, previa: true }) === NECESITAS.map((x) => x[0]).filter((id) => id !== 'directo').join() && de({ conPlan: true, previa: true }).includes('enfermo') && !de({ conPlan: true, previa: true }).includes('suave'),
    'con la vista previa, también «Estoy enfermo» y «Necesito una semana suave» (esta, solo con la 100); el directo, tampoco ahí: no espera visto bueno');
}

console.log('\n(v0.251) El directo de dudas, oculto (FBE Esencial no tiene directos), pero en el código');
{
  const de = (o) => necesitasPara(o).map((x) => x[0]).join();
  const pel = respuestaDe('pelayo'), tec = respuestaDe('tecnica');
  check(!conDirecto() && !/directo/i.test(`${pel.r} ${tec.r}`) && !pel.ir && !tec.ir && /respuestas, con buscador, y la comunidad de la app/.test(pel.r) && !APAGADO.has('directo'),
    'de serie, apagado: «¿Hablo con Pelayo?» y «No sé si lo hago bien» no lo nombran ni llevan a él (y no es de lo que espera su visto bueno)');
  fijarAjustes([{ clave: 'directo', encendido: true }]);
  const pel2 = respuestaDe('pelayo'), tec2 = respuestaDe('tecnica');
  check(conDirecto() && de({ con100: true }) === 'viaje,duele,objetivo,directo' && !de({}).includes('directo') && pel2.ir === 'directo' && /un directo al mes/.test(pel2.r) && tec2.ir === 'directo' && /directo del mes/.test(tec2.r),
    'si Pelayo lo enciende en su panel: vuelve «Preguntar a Pelayo» (con la tabla de notas) y los textos de antes, que llevan a la pregunta');
  fijarAjustes([{ clave: 'directo', encendido: false }]);
  check(!conDirecto() && !de({ con100: true, conPlan: true }).includes('directo'), 'y apagado otra vez, se oculta');
  fijarAjustes([]);
}
// (v0.250) y «pesarme»: el aviso para pesarse abre «¿Cuándo me peso?» (lo resuelve QueNecesitas)
const ABRE = new Set(['plan', 'cierre', 'revision', 'rutina', 'agujetas', 'vuelta', 'viajando', 'pesarme']);
check(Object.values(AVISO_ABRE).every((a) => ABRE.has(a)) && ['manana', 'hoy', 'empezamos', 'domingo', 'auto', 'lunes', 'rutina', 'elige', 'plan_auto'].every((k) => AVISO_ABRE[k]), 'cada aviso de FBE Esencial tiene qué abrir');
const iconos = lee('web/src/ui/comunes.jsx');
check([...CATEGORIAS.map((c) => c[2]), ...NECESITAS.map((n) => n[2])].every((i) => new RegExp(`\\n  ${i}: `).test(iconos) || new RegExp(`\\n  '${i}': `).test(iconos)), 'los iconos existen');

console.log('\nEl buscador');
check(buscarRespuestas('agujetas')[0]?.id === 'agujetas' && buscarRespuestas('maquina ocupada')[0]?.id === 'maquina' && buscarRespuestas('MÁQUINA')[0]?.id === 'maquina', 'encuentra sin tildes ni mayúsculas, primero lo que está en la pregunta');
check(buscarRespuestas('viaje').some((x) => x.id === 'viaje') && buscarRespuestas('descanso')[0]?.id === 'descanso' && buscarRespuestas('zzzz').length === 0 && buscarRespuestas('de').length === 0, 'por una palabra de la respuesta; sin nada, nada');
check(buscarRespuestas('darme baja')[0]?.id === 'baja' && buscarRespuestas('cobra')[0]?.id === 'cobro', 'también lo de su suscripción');

console.log('\nLas palabras, su plan y su camino');
check(Object.keys(PALABRAS).length >= 8 && Object.values(PALABRAS).every(([t, x]) => t && x.length <= 190) && PALABRAS.sobran && PALABRAS.descarga && PALABRAS.marcas, 'las palabras que se explican al tocarlas');
check(PLAN_EXPLICADO.length === 4 && PLAN_EXPLICADO.every(([t, x]) => t && x.length <= 260), '«Tu plan, explicado»: cómo progresa y qué pasa cada domingo, cada cuatro y cada doce semanas');
let c = caminoDe({ n: 6, primeras: true });
check(c.length === 6 && c.filter((x) => x.estado === 'ahora').length === 1 && c.find((x) => x.estado === 'ahora').de === 5 && c.filter((x) => x.estado === 'hecho').length === 3 && c[0].cuando === 'Semanas 1 a 2' && c[5].cuando === 'Desde la semana 13',
  'su camino, si empezó de cero: en la semana 6 está en «la app te prepara cada semana», con lo anterior hecho');
c = caminoDe({ n: 1, primeras: false });
check(c.length === 4 && c[0].estado === 'ahora' && c.slice(1).every((x) => x.estado === 'despues') && caminoDe({ n: null }).every((x) => x.estado === 'despues'), 'y si ya entrenaba: cuatro tramos, desde «coger el pulso a tu rutina»');

console.log('\nLas pantallas');
const ayuda = lee('web/src/ui/atleta/EsencialAyuda.jsx');
const css = lee('web/src/ayuda.css').replace(/\/\*[\s\S]*?\*\//g, '');
const enCss = new Set([...css.matchAll(/\.((?:ayu|ecp)-[a-z0-9-]+)/g)].map((m) => m[1]));
const coach = lee('web/src/ui/coach/EsencialPreguntas.jsx');
const usadas = (t) => new Set([...t.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((k) => /^(ayu|ecp)-/.test(k)));
check([...enCss].filter((k) => k.startsWith('ayu-')).every((k) => usadas(ayuda).has(k)) && [...enCss].filter((k) => k.startsWith('ecp-')).every((k) => usadas(coach).has(k)), 'cada clase de ayuda.css está escrita tal cual en su pantalla (así sus estilos van con su trozo)');
check(![...usadas(coach)].some((k) => k.startsWith('ayu-')) && ![...usadas(ayuda)].some((k) => k.startsWith('ecp-')), 'y las del atleta y las del coach no se mezclan');
check(!/[^\x00-\x7F]/.test(lee('web/src/ayuda.css')), 'ayuda.css, solo ASCII');
check(!/from '\.\/Esencial\.jsx'/.test(ayuda) && /perezoso\(\(\) => import\('\.\/Esencial\.jsx'\), 'HojaTusDias'/.test(ayuda), 'la ayuda no arrastra el trozo de Esencial (lo pide solo si hace falta)');
const hoy = lee('web/src/ui/atleta/Hoy.jsx');
check(/HoyEsencial = perezoso\(\(\) => import\('\.\/Esencial\.jsx'\), 'HoyEsencial'/.test(hoy) && !/EsencialAyuda/.test(hoy) && /export function HoyEsencial/.test(lee('web/src/ui/atleta/Esencial.jsx')), 'en Hoy, todo lo de FBE Esencial entra por una sola pieza perezosa');
for (const [archivo, pieza] of [['web/src/ui/atleta/Sesion.jsx', 'AyudaEjercicio'], ['web/src/ui/atleta/Sesion.jsx', 'TrasLaSesion'], ['web/src/ui/atleta/Portada.jsx', 'LoDeHoy'], ['web/src/ui/atleta/Esencial.jsx', 'TarjetaRevision'],
  ['web/src/ui/atleta/Esencial.jsx', 'QueNecesitas'], ['web/src/ui/atleta/Esencial.jsx', 'Dudas'], ['web/src/ui/atleta/Esencial.jsx', 'TodasLasRespuestas']]) {
  const t = lee(archivo);
  check(new RegExp(`const ${pieza} = perezoso\\(\\(\\) => import\\('\\./EsencialAyuda\\.jsx'\\), '${pieza}'`).test(t) && new RegExp(`<${pieza}[ />]`).test(t) && new RegExp(`export function ${pieza}\\(`).test(ayuda), `${pieza}, perezosa y puesta en ${archivo.split('/').pop()}`);
}
check(/suyo && !propio && !sesion\.completada && r\.ejercicios > 0 && <LoDeHoy/.test(lee('web/src/ui/atleta/Portada.jsx')) && /sobran && !propio && sesionId && !completo && <AyudaEjercicio/.test(lee('web/src/ui/atleta/Sesion.jsx')), 'y solo para quien va por su cuenta');
check(/\/\^#hoy\\\/\[a-z_\]\{2,20\}\$\//.test(lee('web/src/main.jsx')) && /h\.startsWith\('hoy\/'\)/.test(lee('web/src/ui/atleta/AtletaApp.jsx')), 'un aviso puede llevar a «#hoy/<clave>»: la app va a Hoy y la ayuda abre lo que anuncia');
{
  // (v0.246) y el service worker no lo tira al llegar el aviso al móvil: la misma forma que admite la base (migración 100)
  const sw = lee('web/sw.js');
  const patron = '/^#hoy\\/[a-z_]{2,20}$/';
  const reglas = [...sw.matchAll(/\/\^#[^\n]*?\$\/(?=\.test\(d\.url\))/g)].map((m) => new RegExp(m[0].slice(1, -1)));
  const pasa = (u) => reglas.some((r) => r.test(u));
  check(sw.includes(`${patron}.test(d.url)`) && lee('web/src/main.jsx').includes(`${patron}.test(h)`) && reglas.length === 3, 'el service worker y la app admiten la misma forma de «#hoy/<clave>»');
  check(Object.keys(AVISO_ABRE).every((k) => pasa(`#hoy/${k}`)) && pasa('#hoy') && pasa('#mensajes') && !pasa('#hoy/Lunes') && !pasa('#hoy/a') && !pasa('#hoy/../x') && !pasa('#hoy/lunes?x=1') && !pasa('https://x.es/#hoy/lunes'),
    'cada clave de aviso pasa por el service worker; lo que no tiene esa forma, no');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
