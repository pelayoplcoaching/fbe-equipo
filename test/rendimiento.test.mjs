// Cómo va la app en cada dispositivo (pulido 4): los recuentos por tramos, el módulo que mide en el dispositivo y lo
// que guarda y enseña la capa de datos (con la base de la demo). Sin navegador.
//   node test/rendimiento.test.mjs
import { CORTES, metricaVacia, apuntarTiempo, leerMetrica, leerDatos, sumarMetricas, sumarDatos, percentil, entornoDe, leerEntorno, claseDe, nombreMedida, textoMs,
  resumenRendimiento, medidasDe, textoRendimiento, nombreValido, MAX_METRICAS } from '../web/src/logica/rendimiento.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Los tiempos, resumidos por tramos');
{
  const m = metricaVacia();
  for (const ms of [10, 20, 30, 40, 60, 150, 300, 700, 2000, 20000]) apuntarTiempo(m, ms);
  check(m.n === 10 && m.h.join() === '4,1,1,1,1,0,1,0,0,1' && m.max === 20000 && m.h.length === CORTES.length + 1, 'cada tiempo cae en su tramo (menos de 50 ms, de 100, de 200…) y se guarda el peor');
  for (const malo of [-1, NaN, Infinity, 'x', null, 11 * 60 * 1000]) apuntarTiempo(m, malo);
  check(m.n === 10, 'lo que no es un tiempo razonable (negativo, sin número, más de diez minutos) no se apunta');
  const normal = percentil(m, 0.5), lento = percentil(m, 0.9), peor = percentil(m, 1);
  check(normal >= 50 && normal <= 100 && lento >= 1500 && lento <= 3000 && peor === 20000, `de ahí salen lo normal (${normal} ms), lo lento (${lento} ms) y lo peor (${peor} ms)`);
  check(percentil(metricaVacia(), 0.5) === null && percentil(null, 0.5) === null, 'sin nada apuntado, no hay cifra');
  // Una sola medida: lo normal no pasa del peor
  const una = apuntarTiempo(metricaVacia(), 120);
  check(percentil(una, 0.5) <= 120 && percentil(una, 0.9) <= 120 && percentil(una, 0.5) >= 100, 'con una sola medida, la cifra no pasa de lo que tardó');
  // Sumar dispositivos y días es sumar sus recuentos
  const a = metricaVacia(), b = metricaVacia(), junta = metricaVacia();
  for (const ms of [30, 80, 500]) { apuntarTiempo(a, ms); apuntarTiempo(junta, ms); }
  for (const ms of [900, 70, 4000, 45]) { apuntarTiempo(b, ms); apuntarTiempo(junta, ms); }
  const s = sumarMetricas(a, b);
  check(JSON.stringify(s) === JSON.stringify(junta) && a.n === 3 && b.n === 4 && sumarMetricas(null, b).n === 4 && sumarMetricas(a, null).n === 3,
    'sumar lo de dos dispositivos da lo mismo que si lo hubiera medido uno solo (y no cambia lo de cada uno)');
  const d = sumarDatos({ arranque: a }, { arranque: b, consulta: a });
  check(d.arranque.n === 7 && d.consulta.n === 3, 'y lo mismo con todas sus medidas a la vez');
}

console.log('\nLo que llega de fuera se sanea');
{
  check(leerMetrica({ n: 99, h: [1, 2, 0, 0, 0, 0, 0, 0, 0, 0], max: 80 }).n === 3 && leerMetrica({ h: [1, 2] }) === null && leerMetrica(null) === null && leerMetrica({ h: new Array(10).fill(0) }) === null
    && leerMetrica({ h: [-5, 'x', 2.9, 0, 0, 0, 0, 0, 0, 0], max: -3 }).h.join() === '0,0,2,0,0,0,0,0,0,0', 'una medida se cuenta por sus tramos (no por lo que diga su total) y sin tramos válidos no vale');
  const datos = leerDatos({ arranque: { h: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], max: 20 }, 'Nombre Raro': { h: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, '<script>': { h: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, vacia: { h: new Array(10).fill(0) }, 'pantalla:hoy': { h: [0, 3, 0, 0, 0, 0, 0, 0, 0, 0], max: 90 } });
  check(Object.keys(datos).sort().join() === 'arranque,pantalla:hoy' && Object.keys(leerDatos('x')).length === 0 && Object.keys(leerDatos([1])).length === 0, 'solo pasan las medidas con nombre de medida y algo apuntado');
  const muchas = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`m${i}`, { h: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }]));
  check(Object.keys(leerDatos(muchas)).length === MAX_METRICAS && nombreValido('pantalla:hoy') && !nombreValido('Pantalla') && !nombreValido('a'.repeat(41)) && !nombreValido(''), `como mucho ${MAX_METRICAS} medidas por dispositivo y día`);
}

console.log('\nEl tipo de dispositivo, sin identificarlo');
{
  const iphone = entornoDe({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15', tactil: true, instalada: true, nucleos: 6 });
  const ipad = entornoDe({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', tactil: true });
  const android = entornoDe({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130', tactil: true, red: '4g', memoria: 8, nucleos: 8 });
  const mac = entornoDe({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', tactil: false, red: 'wifi-de-casa', memoria: -2 });
  check(iphone.so === 'ios' && iphone.instalada && ipad.so === 'ios' && android.so === 'android' && android.red === '4g' && android.memoria === 8 && mac.so === 'otro' && !('red' in mac) && !('memoria' in mac),
    'iPhone, iPad (que dice ser un Mac), Android y ordenador se distinguen; la red y la memoria, solo si son las que da el navegador');
  check(!JSON.stringify([iphone, ipad, android, mac]).match(/Mozilla|Pixel|iPhone OS|AppleWebKit/), 'del navegador y del modelo no se guarda nada');
  check(claseDe(iphone) === 'iPhone o iPad' && claseDe(android) === 'Android' && claseDe(mac) === 'Ordenador u otro' && leerEntorno({ so: 'ios', instalada: true, modelo: 'x' }).so === 'ios' && !('modelo' in leerEntorno({ so: 'ios', modelo: 'x' }))
    && leerEntorno(null).so === 'otro', 'y al leerlo de la base, lo mismo');
}

console.log('\nEl resumen del equipo');
{
  const m = (...ms) => { const x = metricaVacia(); for (const t of ms) apuntarTiempo(x, t); return x; };
  const filas = [
    { dispositivo: 'aaaa1111', dia: '2026-11-05', rol: 'atleta', version: '0.92', entorno: { so: 'ios', instalada: true }, datos: { arranque: m(900, 1100), consulta: m(120, 130, 140, 150), 'pantalla:hoy': m(300, 20) } },
    { dispositivo: 'aaaa1111', dia: '2026-11-06', rol: 'atleta', version: '0.92', entorno: { so: 'ios', instalada: true }, datos: { arranque: m(1000), consulta: m(110, 125) } },
    { dispositivo: 'bbbb2222', dia: '2026-11-06', rol: 'atleta', version: '0.92', entorno: { so: 'android', instalada: false, red: '3g', memoria: 2 }, datos: { arranque: m(5200, 4800), consulta: m(600, 700, 900), guardar: m(800) } },
    { dispositivo: 'cccc3333', dia: '2026-11-06', rol: 'coach', version: '0.91', entorno: { so: 'otro', instalada: false }, datos: { arranque: m(400), consulta: m(40, 45, 50), 'pantalla:atletas': m(200) } },
    { dispositivo: 'dddd4444', dia: '2026-11-06', rol: 'atleta', version: '0.92', entorno: { so: 'ios' }, datos: {} },   // (sin medidas: no cuenta)
    null, 'basura',
  ];
  const r = resumenRendimiento(filas);
  check(r.filas === 4 && r.todo.dispositivos === 3 && r.todo.dias === 4 && r.desde === '2026-11-05' && r.hasta === '2026-11-06' && r.todo.datos.arranque.n === 6 && r.todo.datos.consulta.n === 12,
    `suma todas las filas con medidas (${r.filas} de ${filas.length}): ${r.todo.dispositivos} dispositivos, ${r.todo.dias} días de uso`);
  const clases = Object.fromEntries(r.porClase.map((g) => [g.clave, g]));
  check(r.porClase.length === 3 && clases['iPhone o iPad, instalada'].dispositivos === 1 && clases['iPhone o iPad, instalada'].dias === 2 && clases['Android, en el navegador'].datos.arranque.n === 2 && !!clases['Ordenador u otro'],
    `por tipo de dispositivo: ${r.porClase.map((g) => g.clave).join(' · ')}`);
  check(r.porRol.map((g) => `${g.clave}:${g.dispositivos}`).sort().join() === 'atleta:2,coach:1' && r.porVersion.map((g) => g.clave).join() === '0.92,0.91', 'por papel (atletas y coach) y por versión');
  check(r.dispositivos.map((d) => d.clave).join() === 'bbbb2222,aaaa1111,cccc3333' && r.dispositivos[0].clase === 'Android' && r.dispositivos[0].arranque > 3000 && r.dispositivos[2].arranque < 800,
    `los dispositivos, del que más tarda en abrir al que menos (${r.dispositivos.map((d) => textoMs(d.arranque)).join(', ')})`);
  const med = medidasDe(r.todo.datos);
  check(med[0].k === 'arranque' && med[1].k === 'pantalla:hoy' && med.some((x) => x.k === 'consulta') && med.every((x) => x.n > 0 && x.normal <= x.lento && x.lento <= x.peor),
    `las medidas salen en su orden (abrir, las pantallas, la base…), cada una con lo normal, lo lento y lo peor: ${med.map((x) => x.nombre).join(' · ')}`);
  check(nombreMedida('pantalla:sesion') === 'Abrir una sesión' && nombreMedida('pantalla:ficha') === 'Abrir la ficha de un atleta' && nombreMedida('consulta') === 'Cada consulta a la base' && nombreMedida('pantalla:nueva') === 'Abrir nueva',
    'cada medida tiene su nombre de la calle');
  check(textoMs(40) === '40 ms' && textoMs(1234) === '1,2 s' && textoMs(15000) === '15 s' && textoMs(null) === '—', 'los tiempos se leen en milisegundos o en segundos');
  const t = textoRendimiento(r);
  check(t.includes('ANDROID') && t.includes('LOS QUE PEOR ABREN') && t.includes('bbbb2222') && t.includes('red 3g') && t.split('\n').length > 15 && textoRendimiento(resumenRendimiento([])) === 'Sin medidas todavía.',
    'y «Copiar para Claude» lo da todo en texto, solo con cifras');
}

console.log('\nEl módulo que mide en el dispositivo');
{
  const guardado = new Map();
  globalThis.localStorage = { getItem: (k) => (guardado.has(k) ? guardado.get(k) : null), setItem: (k, v) => { guardado.set(k, String(v)); }, removeItem: (k) => { guardado.delete(k); } };
  const R = await import('../web/src/rendimiento.js');
  const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
  const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
  const { crearApi } = await import('../web/src/datos/api.js');
  let ahora = new Date();
  const enviadas = [];
  let respuesta = true;
  R.reiniciarRendimiento();
  guardado.clear();
  R.instalarRendimiento(async (fila) => { enviadas.push(structuredClone(fila)); return respuesta; }, '0.92 · prueba', { ahora: () => ahora });
  // Sin nada apuntado no se manda nada
  check(await R.enviarRendimiento() === false && enviadas.length === 0, 'sin nada medido, no se manda nada');
  R.medir('consulta', 120); R.medir('consulta', 80); R.medir('guardar', 300); R.medir('Nombre Malo', 5); R.medir('consulta', -3);
  const fin = R.cronometro('pantalla:hoy'); fin(); fin();
  check(await R.enviarRendimiento() === true && enviadas.length === 1 && enviadas[0].datos.consulta.n === 2 && enviadas[0].datos.guardar.n === 1 && enviadas[0].datos['pantalla:hoy'].n === 1 && !('Nombre Malo' in enviadas[0].datos)
    && /^[0-9a-f-]{36}$/.test(enviadas[0].dispositivo) && /^\d{4}-\d{2}-\d{2}$/.test(enviadas[0].dia) && enviadas[0].version === '0.92 · prueba' && enviadas[0].entorno.so === 'otro',
    'lo medido se manda resumido: el día, un identificador al azar del dispositivo, la versión, el tipo de dispositivo y las medidas');
  check(await R.enviarRendimiento() === false && enviadas.length === 1, 'si no hay nada nuevo, no se vuelve a mandar');
  R.medir('consulta', 60);
  await R.enviarRendimiento();
  check(enviadas.length === 2 && enviadas[1].datos.consulta.n === 3 && enviadas[1].dispositivo === enviadas[0].dispositivo && enviadas[1].dia === enviadas[0].dia,
    'con algo nuevo se manda otra vez la fila entera del día (la base la sustituye: no cuenta doble)');
  // Si la base no lo guarda (sin conexión, sin la migración), queda pendiente
  respuesta = false;
  R.medir('consulta', 70);
  const noGuardo = await R.enviarRendimiento();
  respuesta = true;
  const ahoraSi = await R.enviarRendimiento();
  check(noGuardo === false && ahoraSi === true && enviadas.at(-1).datos.consulta.n === 4, 'si no se pudo guardar, queda pendiente y se manda a la siguiente');
  // Lo del día queda escrito en el dispositivo: tras cerrar la app sigue ahí
  R.medir('guardar', 250);
  await new Promise((r) => setTimeout(r, 5200));
  const escrito = JSON.parse(guardado.get('fbe-rend-v1'));
  check(escrito.sucio === true && escrito.datos.guardar.n === 2 && escrito.datos.consulta.n === 4 && !JSON.stringify(escrito).includes('Mozilla'), 'lo medido se guarda en el dispositivo cada pocos segundos (por si la app se cierra antes de mandarlo)');
  // Al cambiar de día, lo de ayer se manda con su fecha y se empieza de cero
  const ayer = enviadas.at(-1).dia;
  ahora = new Date(ahora.getTime() + 26 * 3600 * 1000);
  const n0 = enviadas.length;
  R.medir('consulta', 90);
  await new Promise((r) => setTimeout(r, 20));
  await R.enviarRendimiento();
  const deAyer = enviadas.slice(n0).find((x) => x.dia === ayer), deHoy = enviadas.slice(n0).find((x) => x.dia !== ayer);
  check(!!deAyer && deAyer.datos.guardar.n === 2 && !!deHoy && deHoy.datos.consulta.n === 1 && !deHoy.datos.guardar, 'al cambiar de día, lo de ayer se manda con su fecha y lo de hoy empieza de cero');
  // Lo medido es de la cuenta que usa el dispositivo: con otra cuenta (o al salir) se empieza de cero
  R.rendimientoDe('cuenta-1');
  R.medir('guardar', 111);
  R.rendimientoDe('cuenta-1');
  await R.enviarRendimiento();
  const conLaMisma = enviadas.at(-1).datos.guardar?.n;
  R.rendimientoDe('cuenta-2');
  R.medir('consulta', 50);
  await R.enviarRendimiento();
  const conOtra = enviadas.at(-1).datos;
  R.rendimientoDe(null);
  R.medir('consulta', 50);
  R.rendimientoDe('cuenta-2');
  await R.enviarRendimiento();
  check(conLaMisma === 1 && !conOtra.guardar && conOtra.consulta.n === 1 && enviadas.at(-1).datos.consulta.n === 1,
    'lo medido con una cuenta no se le apunta a otra que entre en el mismo dispositivo: al cambiar de cuenta o salir se empieza de cero');
  // El arranque se apunta una sola vez por carga
  R.hitoArranque(); R.hitoArranque();
  await R.enviarRendimiento();
  check((enviadas.at(-1).datos.arranque?.n || 0) <= 1, 'el arranque se apunta una sola vez por carga de la app');

  console.log('\nLo que guarda la base (la de la demo) y lo que ve el coach');
  const b = crearBackendMemoria({ semilla: () => semillaDemo() });
  await b.iniciar();
  const api = crearApi(b);
  const entrar = async (email) => { await b.auth.salir().catch(() => {}); await b.auth.entrar(email, 'demo'); };
  const medida = (...ms) => { const x = metricaVacia(); for (const t of ms) apuntarTiempo(x, t); return x; };
  const hoy = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const D1 = '11111111-1111-4111-8111-111111111111', D2 = '22222222-2222-4222-8222-222222222222';
  await entrar('ana@fbe.demo');
  const g1 = await api.apuntarRendimiento({ dia: hoy, dispositivo: D1, version: '0.92', entorno: { so: 'ios', instalada: true, modelo: 'no' }, datos: { arranque: medida(900), consulta: medida(100, 120) } });
  const g2 = await api.apuntarRendimiento({ dia: hoy, dispositivo: D1, version: '0.92', entorno: { so: 'ios', instalada: true }, datos: { arranque: medida(900, 1000), consulta: medida(100, 120, 140) } });
  await api.apuntarRendimiento({ dia: '2020-01-01', dispositivo: D1, datos: { arranque: medida(1) } });
  await api.apuntarRendimiento({ dia: hoy, dispositivo: 'no-es-un-id', datos: { arranque: medida(1) } });
  const deAtleta = await api.rendimientoEquipo(14);
  check(g1 === true && g2 === true && deAtleta.length === 0, 'un atleta apunta lo suyo, pero no ve las medidas (ni las suyas)');
  await entrar('pelayo@fbe.demo');
  await api.apuntarRendimiento({ dia: hoy, dispositivo: D2, version: '0.92', entorno: { so: 'otro' }, datos: { arranque: medida(300) } });
  const filas = await api.rendimientoEquipo(14);
  const anaId = (await b.select('atletas', {})).find((a) => a.nombre === 'Ana López')?.perfil_id;
  check(filas.length === 2 && filas.find((f) => f.rol === 'atleta').datos.arranque.n === 2 && filas.find((f) => f.rol === 'atleta').datos.consulta.n === 3 && !!filas.find((f) => f.rol === 'coach'),
    'el coach ve una fila por dispositivo y día; la del mismo día se sustituye; las de otro día lejano o con un identificador raro no entran');
  check(filas.every((f) => /^[0-9a-f]{8}$/.test(f.dispositivo) && Object.keys(f).sort().join() === 'datos,dia,dispositivo,entorno,rol,version') && !JSON.stringify(filas).includes(anaId) && !JSON.stringify(filas).includes(D1) && !JSON.stringify(filas).includes('modelo'),
    'sin decir de quién es cada una: un código por dispositivo, ni el identificador de la persona ni el del dispositivo ni su modelo');
  const r = resumenRendimiento(filas);
  check(r.todo.dispositivos === 2 && r.porRol.length === 2 && r.todo.datos.arranque.n === 3, 'y con eso sale el resumen de la pantalla de Cuenta');
  await api.borrarRendimiento();
  check((await api.rendimientoEquipo(14)).length === 0, 'el coach puede borrar todas las medidas');
  // Medir no cuenta como «se ha escrito algo» (no hace recargar las pantallas) ni se mide a sí mismo
  const ev = [];
  globalThis.window = { dispatchEvent: (e) => { ev.push(e.type); return true; }, addEventListener() {}, removeEventListener() {} };
  globalThis.Event ||= class { constructor(t) { this.type = t; } };
  R.reiniciarRendimiento(); guardado.clear();
  R.instalarRendimiento(async () => true, 'x', {});
  await api.apuntarRendimiento({ dia: hoy, dispositivo: D2, version: '0.92', entorno: { so: 'otro' }, datos: { arranque: medida(300) } });
  await api.rendimientoEquipo(14);
  const trasMedir = JSON.parse(JSON.stringify(ev));
  await api.borrarRendimiento();
  delete globalThis.window;
  check(!trasMedir.includes('fbe-escritura') && !trasMedir.includes('fbe-cambio'), 'apuntar y leer las medidas no avisa a las pantallas de que «se ha escrito algo» (no hace recargar nada)');
  // La capa de datos mide sola cada consulta y cada escritura
  R.reiniciarRendimiento(); guardado.clear();
  const vistas = [];
  R.instalarRendimiento(async (fila) => { vistas.push(structuredClone(fila)); return true; }, 'x', {});
  await api.atletas(); await api.atletas();
  const at = (await b.select('atletas', {}))[0];
  await api.actualizar('atletas', at.id, { objetivo: at.objetivo || '' });
  await api.apuntarRendimiento({ dia: hoy, dispositivo: D2, datos: { arranque: medida(1) } });
  await new Promise((r) => setTimeout(r, 10));
  await R.enviarRendimiento();
  check(vistas.length === 1 && vistas[0].datos.consulta.n >= 1 && vistas[0].datos.guardar.n === 1, `cada consulta a la base y cada cosa que se guarda quedan medidas solas (${vistas[0]?.datos.consulta.n} consultas, ${vistas[0]?.datos.guardar.n} guardado)`);
  // Sin la migración 049: no se guarda, no se rompe nada y no se insiste
  const b2 = crearBackendMemoria({ semilla: () => semillaDemo() });
  await b2.iniciar();
  const rpc = b2.rpc.bind(b2); let intentos = 0;
  b2.rpc = async (n, ...a) => { if (/^rendimiento_/.test(n)) { intentos++; throw new Error(`Could not find the function public.${n}(p_dia) in the schema cache`); } return rpc(n, ...a); };
  const api2 = crearApi(b2);
  await b2.auth.entrar('pelayo@fbe.demo', 'demo');
  const s1 = await api2.apuntarRendimiento({ dia: hoy, dispositivo: D2, datos: { arranque: medida(1) } });
  const s2 = await api2.apuntarRendimiento({ dia: hoy, dispositivo: D2, datos: { arranque: medida(1) } });
  check(s1 === false && s2 === false && intentos === 1 && (await api2.rendimientoEquipo(14)) === null, 'sin la migración 049 no se guarda nada, no falla nada y no se insiste; la pantalla sabe que falta');
  delete globalThis.localStorage;
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
