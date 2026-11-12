// YouTube dentro de la app: la lógica pura (logica/youtube.js) y, más abajo, la migración 059 en un Postgres local
// (PGlite) y la demo. Uso: node test/youtube.test.mjs
import {
  segundosDe, textoSegundos, videoDe, urlConTramo, cambiarTramo, textoTramo, srcIncrustado, leerMensaje, marcasDeTiempo,
  posicionAGuardar, sumarVisto, vistoEntero, vistaAApuntar, videosDeTexto, masVistos, textoVista, orden,
} from '../web/src/logica/youtube.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Tiempos');
check(segundosDe('1:20') === 80 && segundosDe('01:02:03') === 3723 && segundosDe('80') === 80 && segundosDe('1m20s') === 80 && segundosDe('2m') === 120 && segundosDe('45s') === 45 && segundosDe(42) === 42, '«1:20», «1:02:03», «80», «1m20s», «2m», «45s» y números');
check(segundosDe('') === null && segundosDe('hola') === null && segundosDe('1:2') === null && segundosDe(-3) === null && segundosDe(null) === null, 'lo que no es un tiempo, null');
check(textoSegundos(80) === '1:20' && textoSegundos(5) === '0:05' && textoSegundos(3725) === '1:02:05', '80 → «1:20»; 3725 → «1:02:05»');

console.log('El vídeo de un enlace y su tramo');
const v = videoDe('https://www.youtube.com/watch?v=gMgvBspQ9lk&t=42s&end=58');
check(v && v.id === 'gMgvBspQ9lk' && v.inicio === 42 && v.fin === 58 && !v.vertical, 'watch?v=…&t=42s&end=58: id, desde y hasta');
check(videoDe('https://youtu.be/gMgvBspQ9lk?t=1m5s').inicio === 65 && videoDe('https://youtube.com/shorts/gMgvBspQ9lk').vertical && videoDe('https://www.youtube.com/live/gMgvBspQ9lk').directo, 'youtu.be con t=1m5s; los Shorts, en vertical; los directos');
check(videoDe('https://www.youtube.com/watch?v=gMgvBspQ9lk&t=60&end=30').fin === null && videoDe('https://vimeo.com/123') === null && videoDe('nada') === null, 'un final antes del principio no vale; lo que no es YouTube, null');
check(urlConTramo('gMgvBspQ9lk', 42, 58) === 'https://www.youtube.com/watch?v=gMgvBspQ9lk&t=42s&end=58' && urlConTramo('gMgvBspQ9lk') === 'https://www.youtube.com/watch?v=gMgvBspQ9lk' && urlConTramo('malo') === null, 'el enlace con su tramo');
check(cambiarTramo('https://youtu.be/gMgvBspQ9lk', '0:42', '0:58') === 'https://www.youtube.com/watch?v=gMgvBspQ9lk&t=42s&end=58' && cambiarTramo('https://ejemplo.com/x', 1, 2) === 'https://ejemplo.com/x', 'cambiar el tramo de cualquier enlace (lo que no es YouTube, igual)');
check(textoTramo(v) === '0:42–0:58' && textoTramo({ inicio: 30 }) === '0:30 en adelante' && textoTramo({}) === '', 'el tramo en texto');
const src = srcIncrustado(v, { origen: 'https://fbe.app' });
check(src.startsWith('https://www.youtube-nocookie.com/embed/gMgvBspQ9lk?') && /enablejsapi=1/.test(src) && /start=42/.test(src) && /end=58/.test(src) && /playsinline=1/.test(src) && /origin=https%3A%2F%2Ffbe.app/.test(src), 'el reproductor: youtube-nocookie, con mensajes, el tramo, en línea y el origen');
check(/start=200/.test(srcIncrustado({ id: 'gMgvBspQ9lk' }, { desde: 200 })) && !/start=/.test(srcIncrustado({ id: 'gMgvBspQ9lk' })), 'seguir por donde iba: start=');

console.log('Hablar con el reproductor');
check(JSON.parse(orden('setPlaybackRate', [0.5])).func === 'setPlaybackRate' && JSON.parse(orden('seekTo', [80, true])).args[0] === 80, 'las órdenes (velocidad, saltar)');
const m1 = leerMensaje(JSON.stringify({ event: 'infoDelivery', info: { currentTime: 12.5, duration: 300, playerState: 1, playbackRate: 0.5 } }));
check(m1.tiempo === 12.5 && m1.duracion === 300 && m1.estado === 1 && m1.velocidad === 0.5, 'lo que cuenta: tiempo, duración, estado y velocidad');
check(leerMensaje({ event: 'onStateChange', info: 0 }).estado === 0 && leerMensaje('{malo') === null && leerMensaje({ event: 'otro' }) === null && leerMensaje(null) === null, 'los cambios de estado; lo que no entiende, nada');

console.log('Marcas de tiempo');
const notas = 'Claves:\n0:15 colocación de los pies\n- 1:20: la bajada, controlada\nSin tiempo aquí\n(2:05) el bloqueo · 0:15 repetida';
const mk = marcasDeTiempo(notas);
check(mk.length === 3 && mk[0].seg === 15 && mk[0].texto === 'colocación de los pies' && mk[1].seg === 80 && mk[1].texto === 'la bajada, controlada' && mk[2].seg === 125 && mk[2].texto === 'el bloqueo', 'una por línea (o tras «·»), en orden, sin repetir y con su texto limpio');
check(marcasDeTiempo('quedamos a las 10:30 en el gimnasio').length === 0 && marcasDeTiempo('1:20 x', 60).length === 0 && marcasDeTiempo('').length === 0, 'un tiempo en mitad de una frase no es una marca; lo que pasa del final del vídeo, tampoco');

console.log('Por dónde iba y lo visto');
check(posicionAGuardar(200, 600) === 200 && posicionAGuardar(10, 600) === null && posicionAGuardar(590, 600) === null && posicionAGuardar(50, 90) === null, 'se recuerda en los largos, ya empezados y sin estar acabando');
let c = null;
for (const t of [0, 1, 2, 3, 4, 50, 51, 52]) c = sumarVisto(c, t);
check(Math.round(c.visto) === 6, 'lo visto suma el avance normal, no los saltos');
check(vistoEntero(270, 300) && !vistoEntero(200, 300) && vistoEntero(15, 300, { inicio: 42, fin: 58 }) && !vistoEntero(5, 300, { inicio: 42, fin: 58 }), 'entero: el 90 % del vídeo o de su tramo');
const va = vistaAApuntar({ id: 'gMgvBspQ9lk', titulo: '  Técnica:   sentadilla ', visto: 280, duracion: 300 });
check(va.video === 'gMgvBspQ9lk' && va.titulo === 'Técnica: sentadilla' && va.segundos === 280 && va.completo === true, 'lo que se apunta: vídeo, título limpio, segundos y si fue entero');
check(vistaAApuntar({ id: 'gMgvBspQ9lk', visto: 3 }) === null && vistaAApuntar({ id: 'x', visto: 100 }) === null, 'menos de 5 s o un id que no es de YouTube, nada');

console.log('Vídeos de un texto y resumen para el coach');
const vt = videosDeTexto('mira https://youtu.be/gMgvBspQ9lk?t=30 y https://www.youtube.com/watch?v=gMgvBspQ9lk otra vez y https://youtube.com/shorts/abcdefghijk');
check(vt.length === 2 && vt[0].inicio === 30 && vt[1].vertical, 'sin repetir, con su tramo y si es vertical');
const mv = masVistos([
  { atleta_id: 'a', video: 'v1', titulo: 'Sentadilla', veces: 2, segundos: 300, completo: true },
  { atleta_id: 'b', video: 'v1', titulo: null, veces: 1, segundos: 100, completo: false },
  { atleta_id: 'a', video: 'v2', titulo: 'Peso muerto', veces: 5, segundos: 900, completo: true },
]);
check(mv[0].video === 'v1' && mv[0].atletas === 2 && mv[0].veces === 3 && mv[0].completos === 1 && mv[0].titulo === 'Sentadilla' && mv[1].video === 'v2', 'los más vistos: primero los que han visto más atletas');
check(textoVista({ veces: 2, completo: true }) === 'Visto 2 veces, hasta el final' && textoVista({ veces: 1, segundos: 80 }) === 'Visto una vez (1:20)', '«Visto 2 veces, hasta el final»');


console.log('\nLa función youtube-canal');
{
  const { leerFeed, idDePagina, canalValido, atender } = await import('../supabase/functions/youtube-canal/canal.js');
  const feed = `<?xml version="1.0"?><feed xmlns:yt="x" xmlns:media="y"><title>FBE Coaching</title>
<entry><yt:videoId>gMgvBspQ9lk</yt:videoId><title>Sentadilla: los 3 errores &amp; cómo evitarlos</title><published>2026-11-01T10:00:00+00:00</published><media:group><media:description>Hoy  vemos
la técnica</media:description><media:community><media:statistics views="1234"/></media:community></media:group></entry>
<entry><yt:videoId>malo</yt:videoId><title>x</title></entry>
<entry><yt:videoId>abcdefghijk</yt:videoId><title><![CDATA[Peso muerto <rumano>]]></title><published>no</published></entry></feed>`;
  const L = leerFeed(feed);
  check(L.titulo === 'FBE Coaching' && L.videos.length === 2 && L.videos[0].titulo === 'Sentadilla: los 3 errores & cómo evitarlos' && L.videos[0].descripcion === 'Hoy vemos la técnica' && L.videos[0].vistas === 1234
    && L.videos[1].titulo === 'Peso muerto <rumano>' && L.videos[1].publicado === null, 'lee el feed: título del canal, vídeos con su id válido, título, fecha y descripción');
  check(idDePagina('<link rel="alternate" href="https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv">') === 'UCabcdefghijklmnopqrstuv' && idDePagina('"externalId":"UCabcdefghijklmnopqrstuv"') === 'UCabcdefghijklmnopqrstuv' && idDePagina('nada') === null, 'el id de un canal en su página');
  check(canalValido('@canal-demo') && canalValido('UCabcdefghijklmnopqrstuv') && !canalValido('fbe') && !canalValido('@a'), 'canal: UC… o @nombre');
  const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };
  const peticion = (auth = 'Bearer a.b.c', metodo = 'POST') => new Request('https://f/youtube-canal', { method: metodo, headers: auth ? { authorization: auth } : {} });
  const llamadas = [];
  const fx = (canal) => async (url, o = {}) => {
    llamadas.push(url);
    if (url.includes('/rest/v1/youtube_canal')) return o.headers?.authorization === 'Bearer a.b.c' ? new Response(JSON.stringify(canal ? [{ canal, activo: true }] : []), { status: 200 }) : new Response('', { status: 401 });
    if (url.includes('/@canal-demo')) return new Response('"externalId":"UCabcdefghijklmnopqrstuv"', { status: 200 });
    if (url.includes('feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv')) return new Response(feed, { status: 200 });
    return new Response('', { status: 404 });
  };
  check((await atender(peticion(null), { env, fetch: fx('@canal-demo') })).status === 401 && (await atender(peticion('Bearer x'), { env, fetch: fx('@canal-demo') })).status === 401, 'sin sesión, no');
  check((await atender(peticion('Bearer a.b.c', 'OPTIONS'), { env, fetch: fx(null) })).status === 204 && (await atender(peticion('Bearer a.b.c', 'GET'), { env, fetch: fx(null) })).status === 405, 'CORS y solo POST');
  const sin = await (await atender(peticion(), { env, fetch: fx(null) })).json();
  check(sin.canal === null && sin.videos.length === 0, 'sin canal (o apagado para el atleta), una lista vacía');
  const r = await (await atender(peticion(), { env, fetch: fx('@canal-demo'), ahora: () => 1e12 })).json();
  check(r.canal.id === 'UCabcdefghijklmnopqrstuv' && r.canal.titulo === 'FBE Coaching' && r.videos.length === 2, 'con un @nombre: busca su id y lee su feed');
  const antes = llamadas.length;
  await atender(peticion(), { env, fetch: fx('@canal-demo'), ahora: () => 1e12 + 60000 });
  check(llamadas.length === antes + 1, 'lo guarda media hora (solo vuelve a preguntar a la base)');
  check((await atender(peticion(), { env: {}, fetch: fx('@canal-demo') })).status === 500, 'sin SUPABASE_URL, avisa');
  const { generarFuncionPanel } = await import('../scripts/funcion-panel.mjs');
  const { readFileSync } = await import('node:fs');
  check(readFileSync(new URL('../supabase/youtube-canal-panel.ts', import.meta.url), 'utf8') === await generarFuncionPanel('youtube-canal'), 'supabase/youtube-canal-panel.ts está al día (si no, «npm run funcion-panel»)');
}

console.log('\nLa migración 059 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ana = await usuario('a@x.test');
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ana]))[0].id;
const bea = await usuario('b@x.test');
const atletaB = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Bea', $1, 'activo') returning id`, [bea]))[0].id;
const suelto = await usuario('c@x.test');
const Y = 'https://www.youtube.com/watch?v=gMgvBspQ9lk';

// Recursos: el vídeo de la semana y los directos
await como(coach, 'aal2');
const [r1] = await q(`insert into recursos (titulo, categoria, url, destacado) values ('Técnica de sentadilla', 'tecnica', $1, true) returning id, destacado`, [Y]);
check(r1.destacado === true, 'el coach marca un vídeo como «vídeo de la semana»');
check(await falla(`insert into recursos (titulo, url, destacado) values ('Otro', $1, true)`, [Y]), 'solo uno a la vez');
check(await falla(`insert into recursos (titulo, url, destacado) values ('PDF', 'https://ejemplo.com/a.pdf', true)`) && await falla(`insert into recursos (titulo, url, destacado, atleta_id) values ('Para Ana', $1, false, $2); update recursos set destacado = true where titulo = 'Para Ana'`, [Y, atletaA]),
  'el destacado tiene que ser de YouTube y para todos');
const [d1] = await q(`insert into recursos (titulo, url, directo_en) values ('Directo de dudas', 'https://www.youtube.com/live/gMgvBspQ9lk', now() + interval '2 hours') returning id`);
check(!!d1.id && await falla(`insert into recursos (titulo, url, directo_en) values ('Sin enlace', null, now())`) && await falla(`insert into recursos (titulo, url, directo_en) values ('Viejo', $1, '1999-01-01')`, [Y]), 'un directo: con su enlace de YouTube y una fecha razonable');
await como(ana);
check(await falla(`update recursos set destacado = false where id = $1`, [r1.id]) || (await q(`update recursos set destacado = false where id = $1 returning id`, [r1.id])).length === 0, 'el atleta no lo cambia');
check((await q(`select destacado, directo_en from recursos where destacado or directo_en is not null`)).length === 2, 'y lo ve (el destacado y el directo)');

// El canal
await como(coach, 'aal2');
check(await falla(`insert into youtube_canal (canal) values ('mi canal')`) && await falla(`insert into youtube_canal (canal) values ('UCcorto')`), 'el canal: un id UC… o un @nombre');
await q(`insert into youtube_canal (canal) values ('@canal-demo')`);
check(await falla(`insert into youtube_canal (id, canal) values (false, '@otro')`) && await falla(`insert into youtube_canal (canal) values ('@otro')`), 'una sola fila');
await como(ana);
check((await q(`select canal from youtube_canal`))[0]?.canal === '@canal-demo' && (await q(`update youtube_canal set canal = '@mio' returning canal`)).length === 0, 'el atleta lo lee, no lo cambia');
await como(suelto);
check((await q(`select count(*)::int n from youtube_canal`))[0].n === 0, 'una cuenta sin ficha no lo ve');
await como(coach, 'aal2');
await q(`update youtube_canal set activo = false`);
await como(ana);
check((await q(`select count(*)::int n from youtube_canal`))[0].n === 0, 'apagado, los atletas no lo ven');

// Sigue este vídeo en una sesión
await su();
const [bl] = await q(`insert into bloques (atleta_id, nombre, fecha_inicio) values ($1, 'B', current_date) returning id`, [atletaA]);
const [sem] = await q(`insert into semanas (bloque_id, numero, programacion, fecha_inicio) values ($1, 1, 'programada', current_date) returning id`, [bl.id]);
const [ses] = await q(`insert into sesiones (semana_id, orden, nombre) values ($1, 1, 'Pierna') returning id`, [sem.id]);
await como(coach, 'aal2');
check((await q(`update sesiones set video_url = $2, video_titulo = 'Calentamiento' where id = $1 returning video_url`, [ses.id, Y]))[0].video_url === Y, 'el coach pone un vídeo a la sesión');
check(await falla(`update sesiones set video_url = 'https://ejemplo.com/v' where id = $1`, [ses.id]) && await falla(`update sesiones set video_url = null, video_titulo = 'Solo título' where id = $1`, [ses.id]), 'solo de YouTube, y sin vídeo no hay título');
await como(ana);
check((await q(`select video_url from sesiones where id = $1`, [ses.id]))[0]?.video_url === Y, 'el atleta lo ve en su sesión');
check(await falla(`update sesiones set video_url = null where id = $1`, [ses.id]), 'pero no lo quita');
check((await q(`update sesiones set completada = true, fecha_realizada = current_date where id = $1 returning completada`, [ses.id]))[0]?.completada === true, 'y sigue pudiendo marcar su sesión');

// Lo visto
await como(ana);
await q(`select apuntar_video_visto('gMgvBspQ9lk', 'Técnica: sentadilla', 120, false)`);
await q(`select apuntar_video_visto('gMgvBspQ9lk', null, 100, true)`);
let vv = (await q(`select * from videos_vistos`))[0];
check(vv.atleta_id === atletaA && vv.veces === 1 && vv.segundos === 220 && vv.completo === true && vv.titulo === 'Técnica: sentadilla', 'el atleta apunta lo visto: suma segundos, no cuenta otra vez antes de media hora y recuerda si lo vio entero');
await su();
await q(`update videos_vistos set ultima_vez = now() - interval '2 hours'`);
await como(ana);
await q(`select apuntar_video_visto('gMgvBspQ9lk', 'x', 30, false)`);
vv = (await q(`select * from videos_vistos`))[0];
check(vv.veces === 2 && vv.completo === true && vv.titulo === 'x', 'pasada media hora, cuenta otra vez (y lo entero no se olvida)');
check(await falla(`select apuntar_video_visto('no vale', null, 10, false)`) && await falla(`insert into videos_vistos (atleta_id, video) values ($1, 'abcdefghijk')`, [atletaA])
  && await falla(`update videos_vistos set segundos = 99999`) && (await q(`select apuntar_video_visto('abcdefghijk', null, 999999999, false)`), (await q(`select segundos from videos_vistos where video = 'abcdefghijk'`))[0].segundos === 21600),
  'solo con la función, con un id de YouTube y como mucho 6 h por vez');
await como(bea);
await q(`select apuntar_video_visto('gMgvBspQ9lk', 'Técnica', 50, false)`);
check((await q(`select count(*)::int n from videos_vistos`))[0].n === 1, 'cada atleta ve solo lo suyo');
await como(suelto);
await q(`select apuntar_video_visto('gMgvBspQ9lk', 'x', 50, false)`);
await como(coach, 'aal2');
await q(`select apuntar_video_visto('gMgvBspQ9lk', 'x', 50, false)`);
const todos = await q(`select atleta_id from videos_vistos`);
check(todos.length === 3 && !todos.some((x) => !x.atleta_id), 'el coach ve lo de todos; ni él ni una cuenta sin ficha apuntan nada');
await db.exec(`reset role; ${claims('', '')} set role anon;`);
check(await falla(`select apuntar_video_visto('gMgvBspQ9lk', 'x', 50, false)`) && await falla(`select * from videos_vistos`), 'nadie sin entrar');
await como(ana);
check((await q(`delete from videos_vistos where video = 'abcdefghijk' returning video`)).length === 1, 'el atleta puede borrar lo suyo');
await su();
await q(`delete from atletas where id = $1`, [atletaB]);
check((await q(`select count(*)::int n from videos_vistos where atleta_id = $1`, [atletaB]))[0].n === 0, 'al borrar la ficha, se va lo visto');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
