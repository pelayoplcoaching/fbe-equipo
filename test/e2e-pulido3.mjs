// Pulido de fluidez, tercera tanda, en la demo y en un móvil simulado (táctil): historial y biblioteca guardados en el
// dispositivo, la lista del coach sin pintar dos veces, no volver a pedir lo recién pedido, listas largas por tramos,
// la copia al instante, apuntar sin conexión y salidas suaves.
//   Suelta:  npm run build && node test/e2e-pulido3.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPulido3 } = await import('./e2e-pulido3.mjs'); await probarPulido3({ navegador, check });
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, statSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { irASeccion } from './secciones.mjs';

export async function probarPulido3({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  // lecturas: cuenta las consultas de la demo (window.__q: «tabla filtro»; las funciones, «rpc:nombre»)
  const abrir = async (quien, opciones = {}, { antes = null, retraso = 0 } = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: 'es-ES', ...opciones });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Sin conexi/.test(m.text())) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.addInitScript((r) => {
      if (r) { try { localStorage.setItem('fbe-demo-retraso', String(r)); } catch { /* */ } }
      window.__q = [];
      let b0;
      Object.defineProperty(globalThis, '__fbeDemo', { configurable: true, get() { return b0; }, set(b) {
        b0 = b;
        const s = b.select.bind(b), f = b.rpc.bind(b);
        b.select = (t, x, ...a) => { window.__q.push(`${t} ${JSON.stringify(x || {})}`); return s(t, x, ...a); };
        b.rpc = (n, ...a) => { window.__q.push(`rpc:${n}`); return f(n, ...a); };
      } });
    }, retraso);
    if (antes) await antes(p);
    await p.goto(`${base}/?demo`);
    if (quien) await entrar(p, quien);
    return { ctx, p };
  };
  const entrar = async (p, quien) => {
    await p.getByRole('button', { name: quien }).first().click();
    await p.locator('nav.tabs, nav').first().waitFor();
    await cerrarAvisos(p);
  };
  // Los avisos de primera vez (bienvenida, novedades, medallas…), fuera
  const cerrarAvisos = async (p) => {
    await p.waitForTimeout(350);
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const n of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir', 'Empezar', 'Luego']) { const b = d.getByRole('button', { name: n, exact: true }).first(); if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; } }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(350);
    }
  };
  // Recargar la app (en la demo vuelve a la elección de cuenta, o sigue dentro: vale para las dos)
  const recargar = async (p, quien) => {
    await p.reload();
    const dentro = await p.locator('nav.tabs').first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
    if (!dentro) await entrar(p, quien); else await cerrarAvisos(p);
  };
  const lecturas = (p, patron) => p.evaluate((x) => window.__q.filter((q) => new RegExp(x).test(q)).length, patron);
  const vaciar = (p) => p.evaluate(() => { window.__q = []; });
  // (las consultas iguales se comparten dos segundos: para contar las de una visita hay que dejar pasar ese rato)
  const COMPARTIDAS = 2300;
  // Que pasen los segundos sin esperarlos: el reloj de la página, adelantado
  const adelantar = (p, ms) => p.evaluate((m) => { const real = Date.now.bind(Date); const ya = window.__adelanto || 0; window.__adelanto = ya + m; if (!window.__reloj) { window.__reloj = real; Date.now = () => window.__reloj() + window.__adelanto; } }, ms);
  const filasAtletas = (p) => p.locator('tr:visible, button.tarjeta-atleta:visible');
  // El historial entero (todas las series del atleta, sin «desde») y el que solo pide lo nuevo
  const HISTORIAL_ENTERO = '^series \\{"eq":\\{"atleta_id":"[^"]+"\\},"order":\\[\\["registrada_en","asc"\\]\\]\\}$';
  const HISTORIAL_NUEVO = '^series \\{"eq":\\{"atleta_id":"[^"]+"\\},"gte":\\{"registrada_en":"[^"]+"\\},"order":\\[\\["registrada_en","asc"\\]\\]\\}$';

  try {
    // ---------- 1. El historial se guarda en el dispositivo y solo se pide lo nuevo
    {
      const { ctx, p } = await abrir(/Ana López/);
      await irASeccion(p, 'Progreso');
      await p.locator('.pestanas [role=tab]').first().waitFor();
      await p.waitForTimeout(900);
      const entero1 = await lecturas(p, HISTORIAL_ENTERO), nota = await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-historial-hay') || '[]').length);
      check(entero1 >= 1 && nota === 1, `la primera vez el historial se baja entero y queda guardado en el dispositivo (${entero1} descargas, ${nota} guardado)`);
      // En la misma visita, ya no se vuelve a bajar entero
      await p.waitForTimeout(COMPARTIDAS);
      await vaciar(p);
      await irASeccion(p, 'Hoy'); await p.waitForTimeout(400);
      await p.evaluate(() => window.dispatchEvent(new Event('focus')));   // (como si se volviera a la app: se pide lo fresco)
      await irASeccion(p, 'Progreso');
      await p.locator('.pestanas [role=tab]').first().waitFor();
      await p.waitForTimeout(900);
      const entero2 = await lecturas(p, HISTORIAL_ENTERO), nuevo2 = await lecturas(p, HISTORIAL_NUEVO), huella2 = await lecturas(p, '^rpc:historial_huella');
      check(entero2 === 0 && nuevo2 >= 1 && huella2 >= 1, `al volver a Progreso solo se pide lo de los últimos días, tras comprobar que lo guardado sigue valiendo (${entero2} enteras, ${nuevo2} de lo nuevo, ${huella2} comprobaciones)`);
      const marcas = await p.locator('main').innerText();
      // Al abrir la app otro día (recargar), sale de lo guardado en el dispositivo
      await recargar(p, /Ana López/);
      await irASeccion(p, 'Progreso');
      await p.locator('.pestanas [role=tab]').first().waitFor();
      await p.waitForTimeout(900);
      const entero3 = await lecturas(p, HISTORIAL_ENTERO), nuevo3 = await lecturas(p, HISTORIAL_NUEVO);
      const marcas3 = await p.locator('main').innerText();
      check(entero3 === 0 && nuevo3 >= 1, `al reabrir la app el historial sale de lo guardado: no se vuelve a bajar entero (${entero3} enteras, ${nuevo3} de lo nuevo)`);
      check(marcas3 === marcas && marcas.length > 200, 'y Progreso enseña exactamente lo mismo que antes de reabrir');
      await ctx.close();
    }
    // ---------- 3. La lista del coach se pinta una sola vez (tarjetas en el móvil, tabla en el ordenador)
    {
      const { ctx, p } = await abrir(/Pelayo/);
      await filasAtletas(p).first().waitFor();
      const movil = await p.evaluate(() => ({ filas: document.querySelectorAll('main table tbody tr').length, tarjetas: document.querySelectorAll('main button.tarjeta-atleta').length }));
      check(movil.filas === 0 && movil.tarjetas >= 5, `en el móvil, la lista de atletas son solo las tarjetas (${movil.tarjetas} tarjetas, ${movil.filas} filas de tabla escondidas)`);
      await ctx.close();
      const ancho = await abrir(/Pelayo/, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
      await filasAtletas(ancho.p).first().waitFor();
      const orde = await ancho.p.evaluate(() => ({ filas: document.querySelectorAll('main table tbody tr').length, tarjetas: document.querySelectorAll('main button.tarjeta-atleta').length }));
      check(orde.tarjetas === 0 && orde.filas >= 5, `en el ordenador, solo la tabla (${orde.filas} filas, ${orde.tarjetas} tarjetas escondidas)`);
      // Y al cambiar el ancho de la ventana se pasa de una a otra
      await ancho.p.setViewportSize({ width: 700, height: 800 });
      await ancho.p.locator('main button.tarjeta-atleta').first().waitFor({ timeout: 5000 });
      const estrecha = await ancho.p.evaluate(() => ({ filas: document.querySelectorAll('main table tbody tr').length, tarjetas: document.querySelectorAll('main button.tarjeta-atleta').length }));
      check(estrecha.filas === 0 && estrecha.tarjetas === orde.filas, `al estrechar la ventana, la tabla deja paso a las tarjetas, con los mismos atletas (${estrecha.tarjetas})`);
      await ancho.ctx.close();
    }
    // ---------- 4. No se vuelve a pedir lo recién pedido (20 segundos)
    {
      const { ctx, p } = await abrir(/Pelayo/);
      await filasAtletas(p).first().waitFor();
      await p.waitForTimeout(600);
      // Ir a otra pestaña y volver: cuántas consultas hace la vuelta
      const vuelta = async (otra = 'Revisar', a = 'Atletas') => {
        await irASeccion(p, otra); await p.waitForTimeout(COMPARTIDAS);
        await vaciar(p);
        await irASeccion(p, a);
        await (a === 'Atletas' ? filasAtletas(p).first() : p.locator('main').first()).waitFor();
        await p.waitForTimeout(700);
        return lecturas(p, '.');
      };
      const enseguida = await vuelta();
      const filasAntes = await filasAtletas(p).count();
      await adelantar(p, 21000);
      const pasado = await vuelta();
      check(enseguida <= 2 && pasado >= 10, `coach: volver a la lista de atletas a los pocos segundos no vuelve a pedirlo todo; pasados 20 s, sí (${enseguida} y ${pasado} consultas)`);
      check(filasAntes >= 5 && await filasAtletas(p).count() === filasAntes, `y la lista se ve igual, con sus ${filasAntes} atletas`);
      // Lo que llega de fuera (un mensaje, una notificación) hace que se pida de nuevo
      const otraVez = await vuelta();
      await p.evaluate(() => window.dispatchEvent(new Event('fbe-notificacion')));
      const trasAviso = await vuelta();
      check(otraVez <= 2 && trasAviso >= 10, `si entre medias llega una notificación, la vuelta sí pide lo fresco (${otraVez} sin aviso, ${trasAviso} con él)`);
      // Lo que se escribe desde aquí, también
      const sinEscribir = await vuelta();
      await p.evaluate(async () => { const b = globalThis.__fbeDemo; const a = (await b.select('atletas', {}))[0]; await b.update('atletas', { objetivo: a.objetivo || '' }, { eq: { id: a.id } }); });
      const trasEscribir = await vuelta();
      check(sinEscribir <= 2 && trasEscribir >= 10, `y tras guardar algo, también (${sinEscribir} sin escribir, ${trasEscribir} después)`);
      // Tirar para recargar pide siempre
      await p.waitForTimeout(COMPARTIDAS);
      await vaciar(p);
      await p.evaluate(() => window.dispatchEvent(new Event('fbe-recargar')));
      await p.waitForTimeout(700);
      const alTirar = await lecturas(p, '.');
      check(alTirar >= 10, `«tirar para recargar» pide siempre, aunque se acabe de cargar (${alTirar} consultas)`);
      await ctx.close();
    }
    {
      const { ctx, p } = await abrir(/Ana López/);
      await p.waitForTimeout(800);
      const vuelta = async () => {
        await irASeccion(p, 'Semana'); await p.waitForTimeout(COMPARTIDAS);
        await vaciar(p);
        await irASeccion(p, 'Hoy');
        await p.waitForTimeout(800);
        return lecturas(p, '.');
      };
      await vuelta();   // (la primera pasada deja cargado y recordado todo lo de Hoy y Semana)
      const enseguida = await vuelta();
      const hoyAntes = await p.locator('main').innerText();
      await adelantar(p, 21000);
      const pasado = await vuelta();
      check(pasado >= 8 && enseguida <= 3, `atleta: volver a Hoy a los pocos segundos pide ${enseguida} consultas; pasados 20 s, ${pasado}`);
      check(hoyAntes.length > 100 && await p.locator('main').innerText() === hoyAntes, 'y Hoy enseña lo mismo las dos veces');
      await ctx.close();
    }
    // ---------- 5. La biblioteca de ejercicios se guarda en el dispositivo y solo se baja cuando cambia
    {
      const ENTERA = '^ejercicios \\{"order":\\[\\["nombre","asc"\\]\\]\\}$';
      const { ctx, p } = await abrir(/Pelayo/);
      await filasAtletas(p).first().waitFor();
      await irASeccion(p, 'Biblioteca');
      await p.locator('main input[type=search], main .buscador input, main input').first().waitFor();
      await p.waitForTimeout(900);
      const primera = await lecturas(p, ENTERA);
      const cuantos = await p.evaluate(async () => (await globalThis.__fbeDemo.select('ejercicios', {})).length);
      await p.waitForTimeout(COMPARTIDAS);
      await vaciar(p);
      await irASeccion(p, 'Atletas'); await p.waitForTimeout(300);
      await irASeccion(p, 'Biblioteca');
      await p.waitForTimeout(900);
      const segunda = await lecturas(p, ENTERA), huellas = await lecturas(p, '^rpc:biblioteca_huella');
      check(primera >= 1 && segunda === 0 && huellas >= 1, `la biblioteca (${cuantos} ejercicios) se baja la primera vez; después basta con comprobar que no ha cambiado (${primera} y ${segunda} descargas, ${huellas} comprobaciones)`);
      // Al reabrir la app, sale del dispositivo
      await recargar(p, /Pelayo/);
      if (!(await p.evaluate(() => location.hash === '#biblioteca'))) await irASeccion(p, 'Biblioteca');
      await p.waitForTimeout(1200);
      const alReabrir = await lecturas(p, ENTERA);
      const texto = await p.locator('main').innerText();
      check(alReabrir === 0 && texto.length > 300, `al reabrir la app, la biblioteca sale de lo guardado en el dispositivo (${alReabrir} descargas)`);
      // Si alguien cambia un ejercicio, se vuelve a bajar y se ve el cambio
      await p.evaluate(async () => { const b = globalThis.__fbeDemo; const e = (await b.select('ejercicios', { order: [['nombre', 'asc']] }))[0]; await b.update('ejercicios', { nombre: 'AAA Ejercicio cambiado' }, { eq: { id: e.id } }); });
      await p.waitForTimeout(COMPARTIDAS);
      await vaciar(p);
      await irASeccion(p, 'Atletas'); await p.waitForTimeout(300);
      await irASeccion(p, 'Biblioteca');
      await p.getByText('AAA Ejercicio cambiado').first().waitFor({ timeout: 6000 }).catch(() => {});
      const trasCambio = await lecturas(p, ENTERA);
      check(trasCambio >= 1 && await p.getByText('AAA Ejercicio cambiado').count() >= 1, `si un ejercicio cambia, se vuelve a bajar y se ve el cambio (${trasCambio} descarga)`);
      await ctx.close();
    }
    // ---------- 6. Las listas largas se pintan por tramos
    {
      const { ctx, p } = await abrir(/Pelayo/);
      await filasAtletas(p).first().waitFor();
      // 150 recetas de más en la biblioteca (la de verdad tiene más de 500)
      await p.evaluate(async () => { const b = globalThis.__fbeDemo; const r = (await b.select('recetas', {}))[0]; const filas = []; for (let i = 0; i < 150; i++) { const { id, ...x } = r; filas.push({ ...x, nombre: `Receta de prueba ${String(i).padStart(3, '0')}` }); } await b.insert('recetas', filas); });
      await irASeccion(p, 'Biblioteca');
      await p.locator('#bib-recetas').click();
      await p.locator('.rejilla-recetas .tarjeta-receta').first().waitFor();
      await p.waitForTimeout(500);
      const mirar = () => p.evaluate(() => ({ n: document.querySelectorAll('.rejilla-recetas .tarjeta-receta').length, alto: document.documentElement.scrollHeight, boton: document.querySelector('.ver-mas-tramo')?.textContent || '' }));
      const total = await p.evaluate(async () => (await globalThis.__fbeDemo.select('recetas', {})).length);
      const alAbrir = await mirar();
      check(total >= 150 && alAbrir.n === 40 && /sin mostrar/.test(alAbrir.boton), `de ${total} recetas, al abrir la biblioteca se pintan las 40 primeras (${alAbrir.boton})`);
      // Al bajar, llegan las siguientes solas, hasta la última
      let bajando = alAbrir;
      for (let i = 0; i < 8 && bajando.n < total; i++) { await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(400); bajando = await mirar(); }
      check(bajando.n === total && !bajando.boton, `al bajar van llegando las demás, hasta la última (${bajando.n})`);
      // Buscar mira en todas, no solo en las pintadas; y al borrar lo buscado se vuelve al primer tramo
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.locator('main input[type=search]').first().fill('prueba 149');
      await p.waitForTimeout(400);
      const buscando = await mirar();
      await p.locator('main input[type=search]').first().fill('');
      await p.waitForTimeout(400);
      const sinBuscar = await mirar();
      check(buscando.n === 1 && sinBuscar.n === 40, `el buscador encuentra también las que aún no se habían pintado (${buscando.n}); al borrarlo, vuelta a las 40 primeras`);
      // Con el botón también se puede (teclado, lector de pantalla)
      await p.locator('.ver-mas-tramo').evaluate((el) => el.click());
      await p.waitForTimeout(300);
      check((await mirar()).n >= 80, 'y el botón «Ver 40 recetas más» también las trae');
      await ctx.close();
    }
    // ---------- 7. Actualizar la app: solo se descarga lo que ha cambiado (con el service worker de verdad)
    {
      const dist = fileURLToPath(new URL('../dist/', import.meta.url));
      // Una «versión siguiente» de la app en la que solo cambia el icono (y, claro, el propio service worker)
      const otra = mkdtempSync(join(tmpdir(), 'fbe-v2-'));
      cpSync(dist, otra, { recursive: true });
      const icono = `${readFileSync(join(dist, 'icono.svg'), 'utf8')}\n<!-- version siguiente -->\n`;
      writeFileSync(join(otra, 'icono.svg'), icono);
      const sha = (t) => createHash('sha256').update(t).digest('hex');
      const swA = readFileSync(join(dist, 'sw.js'), 'utf8');
      const vA = /const VERSION = '([^']+)'/.exec(swA)[1];
      const hA = sha(readFileSync(join(dist, 'icono.svg')));
      writeFileSync(join(otra, 'sw.js'), swA.replace(`const VERSION = '${vA}'`, "const VERSION = 'siguiente'").replaceAll(hA, sha(icono)));
      const precarga = JSON.parse(/const ARCHIVOS = (\[[^\]]*\]);/.exec(swA)[1]);
      const deDemo = JSON.parse(/const DEMO = typeof (\[[^\]]*\]) !==/.exec(swA)[1]);
      // Un servidor aparte, que apunta lo que se le pide y puede pasar de una versión a la otra
      const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
      let raiz = dist; let pedidas = [];
      const srv = createServer((req, res) => {
        const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        pedidas.push(ruta);
        let fich = join(raiz, ruta);
        if (existsSync(fich) && statSync(fich).isDirectory()) fich = join(fich, 'index.html');
        if (!existsSync(fich)) { res.writeHead(404); res.end('no'); return; }
        res.writeHead(200, { 'content-type': TIPOS[extname(fich)] || 'application/octet-stream', 'cache-control': 'no-cache' });
        res.end(readFileSync(fich));
      });
      await new Promise((ok) => srv.listen(0, ok));
      const aqui = `http://localhost:${srv.address().port}`;
      const ctx = await navegador.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: 'es-ES' });
      try {
        const p = await ctx.newPage();
        p.on('pageerror', (e) => errores.push(e.message));
        await p.goto(`${aqui}/manifest.webmanifest`);
        await p.evaluate(() => localStorage.setItem('fbe-sw-local', '1'));
        await p.goto(`${aqui}/?demo`);
        await p.getByRole('button', { name: /Ana López/ }).first().waitFor();
        const lleva = await p.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 20000 }).then(() => true, () => false);
        // Lo que hay guardado de la app: por caché, sus claves (rutas) y, de una, su texto
        const guardado = () => p.evaluate(async () => { const out = {}; for (const k of (await caches.keys()).filter((x) => x.startsWith('fbe-atletas-'))) out[k] = (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search); return out; });
        const esperar = async (f, ms = 15000) => { const fin = Date.now() + ms; for (;;) { const v = await f(); if (v || Date.now() > fin) return v; await p.waitForTimeout(250); } };
        const conDemo = await esperar(async () => { const g = (await guardado())[`fbe-atletas-${vA}`] || []; return deDemo.every((u) => g.includes(`/${u}`)) ? g : null; });
        check(lleva && deDemo.length >= 3 && deDemo.every((u) => !precarga.includes(u)) && !!conDemo, `el código de la demo (${deDemo.length} archivos) ya no va en la instalación: se guarda al abrir la demo`);
        // Sale la versión siguiente
        raiz = otra; pedidas = [];
        const instalada = await p.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          await reg.update();
          const fin = Date.now() + 20000;
          while (!reg.waiting && Date.now() < fin) await new Promise((r) => setTimeout(r, 200));
          return !!reg.waiting;
        });
        const bajadas = pedidas.filter((x) => x !== '/sw.js');
        check(instalada && bajadas.includes('/icono.svg') && bajadas.length <= 3 && !bajadas.some((x) => x.startsWith('/chunks/')),
          `al salir una versión en la que solo cambia un archivo, la actualización descarga ${bajadas.length} de ${precarga.length} (${bajadas.join(', ')}); antes, todos`);
        // Se activa («Actualizar») y la app queda entera con lo nuevo
        await p.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); reg.waiting?.postMessage('activar'); });
        const trasActivar = await esperar(async () => { const g = await guardado(); return Object.keys(g).length === 1 && g['fbe-atletas-siguiente'] ? g['fbe-atletas-siguiente'] : null; });
        const iconoGuardado = await p.evaluate(async () => { const r = await (await caches.open('fbe-atletas-siguiente')).match('icono.svg'); return r ? r.text() : ''; });
        const falta = trasActivar ? precarga.map((u) => (u === './' ? '/' : `/${u}`)).filter((u) => !trasActivar.includes(u)) : ['todo'];
        check(falta.length === 0 && iconoGuardado === icono, `la versión nueva queda guardada entera (${trasActivar ? trasActivar.length : 0} archivos${falta.length ? `; faltan ${falta.join(', ')}` : ''}), con el archivo cambiado, y la anterior se borra`);
        // Y abre sin conexión (la demo, tras guardarse su código en la versión nueva)
        await p.reload();
        await p.getByRole('button', { name: /Ana López/ }).first().waitFor();
        await esperar(async () => { const g = (await guardado())['fbe-atletas-siguiente'] || []; return deDemo.every((u) => g.includes(`/${u}`)); });
        await ctx.setOffline(true);
        pedidas = [];
        await p.reload();
        const abre = await p.getByRole('button', { name: /Ana López/ }).first().waitFor({ timeout: 10000 }).then(() => true, () => false);
        check(abre, 'tras actualizar así, la app abre sin conexión');
        await ctx.setOffline(false);
      } finally {
        await ctx.close();
        srv.close();
        rmSync(otra, { recursive: true, force: true });
      }
    }
    // ---------- 8. Al abrir la app, la copia del móvil sale al instante; lo de la base llega después y se pone en su sitio
    {
      const { ctx, p } = await abrir(/Ana López/);
      await p.locator('.hero-dia').waitFor();
      await p.waitForTimeout(2500);   // (la copia de la semana se guarda al llegar de la base)
      const titulo = (await p.locator('.hero-dia .titular h2').textContent()).trim();
      // Con la base lenta (0,7 s por consulta), reabrir la app
      await p.evaluate(() => localStorage.setItem('fbe-demo-retraso', '700'));
      const t0 = Date.now();
      await p.reload();
      await p.locator('.hero-dia .titular h2').waitFor();
      const tarda = Date.now() - t0;
      const titulo2 = (await p.locator('.hero-dia .titular h2').textContent()).trim();
      check(tarda < 1500 && titulo2 === titulo, `con la base lenta (0,7 s por consulta), al reabrir la app Hoy se ve a los ${tarda} ms, con la sesión de la copia («${titulo2}»); antes esperaba 1,2 s por cada dato`);
      // Mientras tanto el coach cambia el nombre de esa sesión: al reabrir sale la copia y, al llegar lo de la base, el nombre nuevo
      await p.waitForTimeout(4000);
      await p.evaluate(async (t) => { const b = globalThis.__fbeDemo; const ss = await b.select('sesiones', { eq: { nombre: t } }); for (const x of ss) await b.update('sesiones', { nombre: 'Sesión renombrada' }, { eq: { id: x.id } }); }, titulo);
      await p.waitForTimeout(600);
      await p.reload();
      await p.locator('.hero-dia .titular h2').waitFor();
      const alAbrir = (await p.locator('.hero-dia .titular h2').textContent()).trim();
      const llega = await p.locator('.hero-dia .titular h2', { hasText: 'Sesión renombrada' }).waitFor({ timeout: 15000 }).then(() => true, () => false);
      check(llega, `lo que ha cambiado en la base llega solo unos segundos después, sin recargar (al abrir: «${alAbrir}»; después: «Sesión renombrada»)`);
      // Dentro de la app, lo de siempre: tras guardar algo se espera a la base (no se enseña lo de antes)
      await p.evaluate(() => localStorage.setItem('fbe-demo-retraso', '0'));
      await ctx.close();
    }
    check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  } catch (e) {
    if (process.env.DEPURAR) console.log(e.stack.split('\n').slice(0, 14).join('\n'));
    check(false, `Pulido 3: ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  }
}

// Suelta
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4177);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Pulido de fluidez, tercera tanda');
  await probarPulido3({ navegador, check, base: 'http://localhost:4177' });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
