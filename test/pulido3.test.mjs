// Pulido, tercera tanda: lo que se puede comprobar sin navegador (la capa de datos sobre la demo en memoria).
//   node test/pulido3.test.mjs
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Un backend en memoria que cuenta las lecturas por tabla y las funciones; sin048: como una base sin la migración 048
const DATOS = semillaDemo();   // (los mismos datos para todos: la demo se inventa ids nuevos cada vez)
function montar({ sin048 = false } = {}) {
  const b = crearBackendMemoria({ semilla: () => structuredClone(DATOS), persistir: false });
  const cuenta = {};
  const sel = b.select.bind(b), rpc = b.rpc.bind(b);
  b.select = (t, ...a) => { cuenta[t] = (cuenta[t] || 0) + 1; return sel(t, ...a); };
  b.rpc = (n, ...a) => {
    cuenta[`rpc:${n}`] = (cuenta[`rpc:${n}`] || 0) + 1;
    if (sin048 && /^(conversaciones_resumen|ultimas_series)$/.test(n)) return Promise.reject(new Error(`Could not find the function public.${n} in the schema cache`));
    return rpc(n, ...a);
  };
  return { b, api: crearApi(b), cuenta, n: (t) => cuenta[t] || 0 };
}
const sinVolatil = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'foto' ? undefined : v)));

console.log('1. El historial: lo antiguo, guardado; de la base, solo lo reciente');
{
  const con = montar(), sin = montar({ sin048: true });
  sin.b.rpc = ((orig) => (n, ...a) => (n === 'historial_huella' ? Promise.reject(new Error('Could not find the function public.historial_huella in the schema cache')) : orig(n, ...a)))(sin.b.rpc);
  // Lo que se pide de series cada vez: cuántas filas llegan
  const pedidas = [];
  con.b.select = ((orig) => async (t, f, ...a) => { const r = await orig(t, f, ...a); if (t === 'series' && !f?.cols) pedidas.push({ desde: f?.gte?.registrada_en || null, filas: r.length }); return r; })(con.b.select);
  for (const m of [con, sin]) await m.b.auth.entrar('pelayo@fbe.demo', 'demo');
  const ana = (await con.api.atletas()).find((a) => a.nombre === 'Ana López');
  const h1 = await con.api.historialSinCompartir(ana.id);
  const viejas = h1.filter((x) => Date.parse(x.registrada_en) < Date.now() - 7 * 86400000).length;
  check(h1.length > 40 && viejas > 20 && pedidas.length === 1 && pedidas[0].desde === null && pedidas[0].filas === h1.length, `la primera vez se baja entero (${h1.length} series, ${viejas} de hace más de una semana)`);
  const h2 = await con.api.historialSinCompartir(ana.id);
  const s2 = await sin.api.historialSinCompartir(ana.id);
  check(JSON.stringify(h2) === JSON.stringify(h1) && JSON.stringify(h2) === JSON.stringify(s2), 'la segunda vez sale idéntico (y idéntico al de una base sin la migración, serie a serie)');
  check(pedidas.length === 2 && pedidas[1].desde && pedidas[1].filas === h1.length - viejas && con.n('rpc:historial_huella') >= 2, `y de la base solo llegan las series de la última semana (${pedidas[1]?.filas} en vez de ${h1.length}), tras comprobar la huella de lo guardado`);
  // Algo nuevo: se ve
  const pauta = (await con.b.select('sesion_ejercicios', {})).find((p) => h1.some((x) => x.sesion_ejercicio_id === p.id));
  const numero = Math.max(...h1.filter((x) => x.sesion_ejercicio_id === pauta.id).map((x) => x.numero)) + 1;
  await con.b.insert('series', [{ sesion_ejercicio_id: pauta.id, atleta_id: ana.id, numero, kg: 77, reps: 3 }]);
  const h3 = await con.api.historialSinCompartir(ana.id);
  check(h3.length === h1.length + 1 && h3.some((x) => x.kg === 77 && x.reps === 3 && x.ejercicio), 'una serie nueva aparece (con su ejercicio)');
  // Cambios en lo antiguo hechos desde otro dispositivo (aquí, directos a la base): la huella lo nota y se baja todo
  const vieja = h1.find((x) => Date.parse(x.registrada_en) < Date.now() - 10 * 86400000);
  await con.b.sql?.('select 1').catch(() => {});
  const tabla = (await con.b.select('series', { eq: { id: vieja.id } }))[0];
  await con.b.update('series', { kg: (Number(tabla.kg) || 0) + 2.5 }, { eq: { id: vieja.id } });
  const antes = pedidas.length;
  const h4 = await con.api.historialSinCompartir(ana.id);
  check(h4.find((x) => x.id === vieja.id).kg === (Number(tabla.kg) || 0) + 2.5 && pedidas[antes].desde === null, 'si se corrige una serie antigua, la huella cambia y el historial se baja entero: nunca se enseña lo de antes');
  const h5 = await con.api.historialSinCompartir(ana.id);
  check(pedidas[pedidas.length - 1].desde !== null && JSON.stringify(h5) === JSON.stringify(h4), 'y a la siguiente vuelve a pedir solo lo reciente');
  await con.b.delete('series', { eq: { id: vieja.id } });
  const h6 = await con.api.historialSinCompartir(ana.id);
  check(!h6.some((x) => x.id === vieja.id) && h6.length === h4.length - 1, 'una serie antigua borrada desaparece');
  // Cambiar el ejercicio de una pauta antigua (lo hace el coach al corregir una variante) también se nota
  const otraVieja = h6.find((x) => Date.parse(x.registrada_en) < Date.now() - 10 * 86400000 && !x.sustituto);
  const otroEj = (await con.api.biblioteca()).find((e) => e.id !== otraVieja.ejercicio_id);
  await con.api.historialSinCompartir(ana.id);
  await con.b.update('sesion_ejercicios', { ejercicio_id: otroEj.id }, { eq: { id: otraVieja.sesion_ejercicio_id } });
  const h7 = await con.api.historialSinCompartir(ana.id);
  check(h7.find((x) => x.id === otraVieja.id).ejercicio_id === otroEj.id && h7.find((x) => x.id === otraVieja.id).ejercicio === otroEj.nombre, 'y si se cambia el ejercicio de una pauta antigua, sus series salen con el nuevo');
  // Sin la migración: entero cada vez, como hasta ahora
  await espera(2100);   // (fuera de la ventana de consultas compartidas)
  const antesSin = sin.n('series');
  await sin.api.historialSinCompartir(ana.id);
  check(sin.n('series') === antesSin + 1 && sin.n('rpc:historial_huella') <= 1, 'sin la migración se baja entero cada vez, como hasta ahora (y no insiste con la función que falta)');
  // Otro atleta: su historial es el suyo
  const ruben = (await con.api.atletas()).find((a) => a.nombre === 'Rubén Martín');
  const hr = await con.api.historialSinCompartir(ruben.id);
  check(hr.every((x) => x.atleta_id === ruben.id) && (await con.api.historialSinCompartir(ana.id)).every((x) => x.atleta_id === ana.id), 'lo guardado de un atleta no se mezcla con lo de otro');
}

console.log('2. La lista de conversaciones, resumida en la base (migración 048)');
{
  const con = montar(), sin = montar({ sin048: true });
  for (const m of [con, sin]) await m.b.auth.entrar('pelayo@fbe.demo', 'demo');
  // Algo más de variedad que la demo: un programado, uno eliminado y uno largo
  for (const m of [con, sin]) {
    const ana = (await m.api.atletas()).find((a) => a.nombre === 'Ana López');
    await m.b.insert('comentarios', [{ atleta_id: ana.id, autor: 'coach', texto: 'Para mañana', enviar_en: new Date(Date.now() + 86400000).toISOString() }]);
  }
  const a = await con.api.conversaciones(), s = await sin.api.conversaciones();
  const corta = (l) => l.map((x) => ({ atleta: x.atleta.nombre, ultimo: x.ultimo ? { autor: x.ultimo.autor, texto: String(x.ultimo.texto).slice(0, 300), medio: x.ultimo.medio || null, eliminado: !!x.ultimo.eliminado_en } : null, sinLeer: x.sinLeer, programados: x.programados, estado: x.estado }));
  check(a.length > 3 && JSON.stringify(corta(a)) === JSON.stringify(corta(s)), `la lista sale igual con la función nueva que contando los mensajes como antes (${a.length} conversaciones, mismo orden, último, no leídos y programados)`);
  check(a.some((x) => x.programados >= 1) && a.some((x) => x.sinLeer > 0) && a.every((x) => !x.ultimo || !x.ultimo.enviar_en || Date.parse(x.ultimo.enviar_en) <= Date.now()), 'con sus programados aparte (nunca como último mensaje) y sus no leídos');
  check(con.n('rpc:conversaciones_resumen') === 1 && con.n('comentarios') === 0, 'con la migración, la lista no baja ni un mensaje: una sola llamada');
  check(sin.n('comentarios') >= 1, 'sin la migración, lo pide como hasta ahora (y funciona igual)');
  await espera(2100);
  const antes = sin.n('rpc:conversaciones_resumen');
  await sin.api.conversaciones();
  check(sin.n('rpc:conversaciones_resumen') === antes, 'y no vuelve a intentar la función que no está en cada visita');
  // Un atleta también puede llamarla y solo recibe lo suyo (la app no lo usa, pero la base lo permite)
  await con.b.auth.entrar('ana@fbe.demo', 'demo');
  const deAna = await con.b.rpc('conversaciones_resumen');
  check(deAna.length <= 1, 'un atleta solo recibe su conversación');
}

console.log('3. La lista del coach: la última serie de todos en una consulta');
{
  const con = montar(), sin = montar({ sin048: true });
  for (const m of [con, sin]) await m.b.auth.entrar('pelayo@fbe.demo', 'demo');
  const a = await con.api.resumenes(), s = await sin.api.resumenes();
  check(a.length > 3 && JSON.stringify(sinVolatil(a)) === JSON.stringify(sinVolatil(s)), `el resumen de cada atleta sale idéntico por las dos vías (${a.length} atletas)`);
  check(a.some((r) => r.ultimaSerie), 'con la fecha de su última serie');
  const atletas = a.length;
  check(con.n('rpc:ultimas_series') === 1 && sin.n('series') >= con.n('series') + atletas - 1, `con la migración, ${atletas} consultas de «última serie» pasan a ser una (${sin.n('series')} lecturas de series → ${con.n('series')})`);
}

console.log('5. La biblioteca de ejercicios, solo si ha cambiado');
{
  const con = montar(), sin = montar({ sin048: true });
  sin.b.rpc = ((orig) => (n, ...a) => (n === 'biblioteca_huella' ? Promise.reject(new Error('Could not find the function public.biblioteca_huella in the schema cache')) : orig(n, ...a)))(sin.b.rpc);
  for (const m of [con, sin]) await m.b.auth.entrar('pelayo@fbe.demo', 'demo');
  const b1 = await con.api.biblioteca();
  const e1 = con.n('ejercicios');
  await espera(2100);
  const b2 = await con.api.biblioteca();
  await con.api.variantesPorRevisar();
  check(b1.length > 20 && JSON.stringify(b1) === JSON.stringify(b2) && con.n('ejercicios') === e1, `pedida otra vez (y desde Revisar), la biblioteca no se vuelve a bajar: se pregunta su huella y es la misma (${b1.length} ejercicios)`);
  b2[0].nombre = 'Tocado por una pantalla';
  check((await con.api.biblioteca())[0].nombre === b1[0].nombre, 'cada pantalla recibe su copia: lo que una cambie en la suya no llega a las demás');
  await con.api.actualizar('ejercicios', b1[3].id, { nombre: 'Nombre nuevo de prueba' });
  const b3 = await con.api.biblioteca();
  check(con.n('ejercicios') === e1 + 1 && b3.some((x) => x.nombre === 'Nombre nuevo de prueba'), 'en cuanto cambia un ejercicio, la huella cambia y se baja de nuevo');
  await con.b.sql?.(`select 1`).catch(() => {});
  const s1 = await sin.api.biblioteca(); await espera(2100); await sin.api.biblioteca();
  check(sin.n('ejercicios') === 2 && s1.length === b1.length, 'sin la migración, se baja entera cada vez, como hasta ahora');
  // Las pautas de Revisar, con las columnas justas, dan lo mismo
  const v1 = await con.api.variantesPorRevisar(), v2 = await sin.api.variantesPorRevisar();
  check(Array.isArray(v1) && v1.length === v2.length, `«variantes por revisar» sale igual con las columnas justas (${v1.length})`);
}

console.log('\n7. Actualizar la app sin volver a descargar lo que no ha cambiado (el service worker)');
{
  const { readFileSync } = await import('node:fs');
  const { createHash, webcrypto } = await import('node:crypto');
  const sha = (t) => createHash('sha256').update(t).digest('hex');
  // Un navegador de mentira: cachés con nombre, una red que apunta lo que se le pide y el service worker de verdad
  const montarSw = ({ archivos, huellas, demo = [], red, guardado = {}, sinHuellas = false, criptoRota = false }) => {
    const almacenes = new Map(Object.entries(guardado).map(([k, v]) => [k, new Map(Object.entries(v))]));
    const pedidas = [];
    const resp = (texto, ok = true) => ({ ok, status: ok ? 200 : 404, texto, clone() { return resp(texto, ok); }, async arrayBuffer() { return new TextEncoder().encode(texto).buffer; } });
    const clave = (x) => (typeof x === 'string' ? x : x.url);
    const cache = (m) => ({
      async match(x) { return m.has(clave(x)) ? resp(m.get(clave(x))) : undefined; },
      async put(x, r) { m.set(clave(x), r.texto); },
      async addAll(xs) { const rs = await Promise.all(xs.map((x) => fetch(x))); if (rs.some((r) => !r.ok)) throw new TypeError('addAll'); xs.forEach((x, i) => m.set(clave(x), rs[i].texto)); },
    });
    const caches = { async open(k) { if (!almacenes.has(k)) almacenes.set(k, new Map()); return cache(almacenes.get(k)); }, async keys() { return [...almacenes.keys()]; }, async delete(k) { return almacenes.delete(k); } };
    const fetch = async (x) => { const u = clave(x); pedidas.push(u); if (!(u in red)) return resp('', false); return resp(red[u]); };
    class Request { constructor(u, o) { this.url = u; this.cache = o?.cache; } }
    const oyentes = {};
    const self = { addEventListener: (t, fn) => { oyentes[t] = fn; }, registration: { scope: 'https://fbe.test/' }, clients: { claim: async () => {} }, skipWaiting: () => {}, location: { origin: 'https://fbe.test' } };
    let codigo = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8').replace('__VERSION__', 'nueva').replace('__ARCHIVOS__', JSON.stringify(archivos)).replaceAll('__DEMO_ARCHIVOS__', JSON.stringify(demo));
    if (!sinHuellas) codigo = codigo.replaceAll('__HUELLAS__', JSON.stringify(huellas));
    const crypto = criptoRota ? { subtle: { digest: async () => { throw new Error('sin crypto'); } } } : webcrypto;
    new Function('self', 'caches', 'fetch', 'Request', 'crypto', codigo)(self, caches, fetch, Request, crypto);
    const lanzar = async (tipo, datos = {}) => { let pr = Promise.resolve(); oyentes[tipo]({ ...datos, waitUntil: (x) => { pr = x; } }); return pr; };
    return { almacenes, pedidas, lanzar };
  };
  const NUEVO = { './': '<html>v2</html>', 'app.js?v=2': 'app v2', 'chunks/a-AAAA1111.js': 'trozo a', 'chunks/b-BBBB2222.js': 'trozo b NUEVO', 'icono.svg': '<svg/>', 'fonts/letra.woff2': 'letra', 'config.js': 'config' };
  const archivos = Object.keys(NUEVO);
  const huellas = Object.fromEntries(archivos.filter((u) => u !== 'config.js').map((u) => [u, sha(NUEVO[u])]));
  const VIEJO = { './': '<html>v1</html>', 'app.js?v=1': 'app v1', 'chunks/a-AAAA1111.js': 'trozo a', 'chunks/b-BBBB2222.js': 'trozo b', 'icono.svg': '<svg/>', 'fonts/letra.woff2': 'letra', 'config.js': 'config' };
  {
    const sw = montarSw({ archivos, huellas, red: NUEVO, guardado: { 'fbe-atletas-vieja': VIEJO, 'fbe-compartido': { x: 'y' } } });
    await sw.lanzar('install');
    const nueva = sw.almacenes.get('fbe-atletas-nueva');
    check(archivos.every((u) => nueva.get(u) === NUEVO[u]), 'tras actualizar, la versión nueva tiene todos sus archivos, con el contenido nuevo');
    check(sw.pedidas.slice().sort().join() === ['./', 'app.js?v=2', 'chunks/b-BBBB2222.js', 'config.js'].sort().join(), `solo se descarga lo que ha cambiado; lo idéntico (un trozo, el icono, la letra) se copia de la versión anterior (descargas: ${sw.pedidas.join(', ')})`);
    check(sw.almacenes.get('fbe-atletas-vieja').get('./') === '<html>v1</html>' && sw.almacenes.get('fbe-compartido').get('x') === 'y', 'la versión anterior sigue entera hasta que se active la nueva, y las otras cachés no se tocan');
    await sw.lanzar('activate');
    check(!sw.almacenes.has('fbe-atletas-vieja') && sw.almacenes.has('fbe-atletas-nueva'), 'al activarse la nueva, la anterior se borra');
  }
  {
    // Un archivo con el mismo nombre pero otro contenido (o estropeado) no se aprovecha
    const sw = montarSw({ archivos, huellas, red: NUEVO, guardado: { 'fbe-atletas-vieja': { ...VIEJO, 'chunks/a-AAAA1111.js': 'trozo a ESTROPEADO' } } });
    await sw.lanzar('install');
    check(sw.pedidas.includes('chunks/a-AAAA1111.js') && sw.almacenes.get('fbe-atletas-nueva').get('chunks/a-AAAA1111.js') === 'trozo a', 'lo guardado que no coincide byte a byte con lo de esta versión no se aprovecha: se descarga');
  }
  {
    // La primera instalación (nada guardado) y un navegador que no deja comprobar el contenido: todo de la red, como siempre
    const primera = montarSw({ archivos, huellas, red: NUEVO });
    await primera.lanzar('install');
    const rota = montarSw({ archivos, huellas, red: NUEVO, guardado: { 'fbe-atletas-vieja': VIEJO }, criptoRota: true });
    await rota.lanzar('install');
    const antigua = montarSw({ archivos, huellas, red: NUEVO, guardado: { 'fbe-atletas-vieja': VIEJO }, sinHuellas: true });
    await antigua.lanzar('install');
    check([primera, rota, antigua].every((x) => x.pedidas.length === archivos.length && archivos.every((u) => x.almacenes.get('fbe-atletas-nueva').get(u) === NUEVO[u])),
      'la primera instalación, o si no se puede comprobar el contenido, lo descarga todo como hasta ahora');
  }
  {
    // Si falta algo en la red, la instalación falla entera (y se reintenta más tarde): nunca queda una versión a medias activa
    const { 'chunks/b-BBBB2222.js': _, ...sinUno } = NUEVO;
    const sw = montarSw({ archivos, huellas, red: sinUno, guardado: { 'fbe-atletas-vieja': VIEJO } });
    const fallo = await sw.lanzar('install').then(() => false, () => true);
    check(fallo && sw.almacenes.get('fbe-atletas-vieja').get('chunks/b-BBBB2222.js') === 'trozo b', 'si un archivo no se puede descargar, la actualización no se instala y la versión anterior sigue sirviendo');
  }
  {
    // El código de la demo no va en la instalación; se guarda cuando la página dice que es la demo
    const demo = ['chunks/semilla-demo-CCCC3333.js', 'chunks/backend-memoria-DDDD4444.js'];
    const sw = montarSw({ archivos, huellas, demo, red: { ...NUEVO, [demo[0]]: 'semilla', [demo[1]]: 'memoria' } });
    await sw.lanzar('install');
    const antes = demo.filter((u) => sw.almacenes.get('fbe-atletas-nueva').has(u)).length;
    await sw.lanzar('message', { data: 'guardar-demo' });
    const despues = demo.filter((u) => sw.almacenes.get('fbe-atletas-nueva').has(u)).length;
    const n = sw.pedidas.length;
    await sw.lanzar('message', { data: 'guardar-demo' });
    check(antes === 0 && despues === 2 && sw.pedidas.length === n, 'el código de la demo no se descarga al instalar; se guarda al abrir la demo, y una sola vez');
  }
  // Y la construcción escribe las huellas de verdad y deja fuera de la instalación lo de la demo
  const build = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  check(/__HUELLAS__/.test(build) && /__DEMO_ARCHIVOS__/.test(build) && /semilla-demo\|backend-memoria\|fotos-demo\|poster-demo/.test(build), 'la construcción escribe la huella de cada archivo y la lista de lo que es solo de la demo');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
