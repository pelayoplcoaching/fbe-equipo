// Pulido de fluidez, tercera tanda, en la demo y en un móvil simulado (táctil): historial y biblioteca guardados en el
// dispositivo, la lista del coach sin pintar dos veces, no volver a pedir lo recién pedido, listas largas por tramos,
// la copia al instante, apuntar sin conexión y salidas suaves.
//   Suelta:  npm run build && node test/e2e-pulido3.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPulido3 } = await import('./e2e-pulido3.mjs'); await probarPulido3({ navegador, check });
import { pathToFileURL } from 'node:url';
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
