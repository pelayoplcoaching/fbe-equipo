// v0.65: abrir sin cobertura y «Novedades», de punta a punta en la demo, en un iPhone de Playwright (táctil y móvil), con el
// service worker de verdad (en localhost solo con «fbe-sw-local») y la demo sin «base» cuando no hay red («fbe-demo-sin-red»:
// sin esto, la demo vive en el navegador y funciona entera sin red). Lo llama e2e.test.mjs y se puede lanzar suelto
// (node test/e2e-sinred-065.mjs, con dist/). Un solo recorrido:
//   · con conexión: Hoy y la sesión de hoy; la semana se queda en el móvil (la copia);
//   · sin conexión, se recarga: Hoy y la sesión salen de la copia, con «Sin conexión · se guardará al volver» y sin errores;
//   · se apunta una serie sin conexión (a la cola); se cierra y se vuelve a abrir la app sin conexión: la serie sigue ahí;
//   · vuelve la conexión: la serie llega a la base una sola vez;
//   · «Novedades»: no sale la primera vez; tras cambiar de versión, sale una vez (con «Vale») y no vuelve. 360 px en oscuro.
import { createRequire } from 'node:module';
import { devices } from 'playwright';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarSinRed065({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, serviceWorkers: 'allow' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  // (sin red, lo que no se puede descargar —una foto de fuera— sale en la consola del navegador: eso no es un fallo de la app)
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const sinNombre = await p.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const nombre = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
        const etiqueta = el.id && document.querySelector(`label[for="${el.id}"]`);
        return !nombre && !etiqueta && !el.closest('label');
      }).map((el) => el.outerHTML.slice(0, 90)));
    if (sinNombre.length) errores.push(`${paso}: controles sin nombre accesible: ${sinNombre.join(' | ')}`);
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ]));
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
  }
  // A 360 px en oscuro (sin animaciones) y de vuelta a 390
  const estrecho = async (paso, sel) => {
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar(`${paso}-360-oscuro`);
    const cabe = await p.evaluate((s) => document.documentElement.scrollWidth <= 360
      && [...document.querySelectorAll(s)].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }), sel);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
    return cabe;
  };
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const saltar = async () => { if (await p.locator('.temporizador').count()) { await p.locator('.temporizador').getByRole('button', { name: /^(Saltar|Cerrar)$/ }).first().click(); await hay(p.locator('.temporizador'), 0); } };
  const entrarSesion = async () => {
    await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).click();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor();
    if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    if (await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).count()) await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).click();
    await p.waitForTimeout(400);
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
  };
  const volverAHoy = async () => {
    await p.locator('.sesion-vista .cabecera').getByRole('button', { name: 'Volver' }).click();
    await p.locator('.hero-dia').waitFor();
  };
  // Lo guardado en la copia del móvil (las claves «cuenta|qué»)
  const enCopia = () => p.evaluate(() => new Promise((ok) => {
    const r = indexedDB.open('fbe-chat-v1');
    r.onsuccess = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('copia')) { d.close(); ok([]); return; }
      const t = d.transaction('copia').objectStore('copia').getAllKeys();
      t.onsuccess = () => { d.close(); ok(t.result.map(String)); };
      t.onerror = () => { d.close(); ok([]); };
    };
    r.onerror = () => ok([]);
  }));
  const seriesEnBase = (se, n) => p.evaluate(([s, k]) => (JSON.parse(localStorage.getItem('fbe-demo-v2')).series || []).filter((x) => x.sesion_ejercicio_id === s && x.numero === k).length, [se, n]);
  const novedades = p.getByRole('dialog', { name: 'Novedades' });

  try {
    await p.goto(`${base}/manifest.webmanifest`);
    await p.evaluate(() => { localStorage.setItem('fbe-sw-local', '1'); localStorage.setItem('fbe-demo-sin-red', '1'); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    const cod = p.getByLabel('Código', { exact: true });
    await Promise.race([cod.waitFor({ timeout: 8000 }).catch(() => {}), p.locator('nav.tabs').waitFor()]);
    if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
    await p.locator('.hero-dia').waitFor();
    await p.waitForTimeout(1200);
    check(await novedades.count() === 0, '«Novedades» no sale la primera vez (en este móvil, con esta cuenta)');
    await cerrarDialogos();
    const uid = await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-demo-v2-sesion')).user.id);

    // ---------------------------------------------------------------- con conexión: la semana se queda en el móvil
    check(await p.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 15000 }).then(() => true, () => false), 'el service worker se instala y lleva la app');
    const titulo = (await p.locator('.hero-dia .titular h2').textContent()).trim();
    await entrarSesion();
    const ej = p.locator('.sesion-vista .ejercicio').first();
    const se = await ej.getAttribute('data-se');
    const nEj = await p.locator('.sesion-vista .ejercicio').count();
    await volverAHoy();
    // Las que quedan por hacer de la semana actual (como mucho 3), según el programa guardado
    const pendientes = () => p.evaluate((u) => new Promise((ok) => {
      const r = indexedDB.open('fbe-chat-v1');
      r.onsuccess = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('copia')) { d.close(); ok(null); return; }
        const t = d.transaction('copia').objectStore('copia').getAll();
        t.onsuccess = () => {
          d.close();
          const pr = t.result.find((x) => x.uid === u && String(x.clave).startsWith('programa:'))?.datos;
          ok(pr?.actual ? (pr.sesiones[pr.actual.id] || []).filter((x) => !x.completada).slice(0, 3).map((x) => x.id) : null);
        };
        t.onerror = () => { d.close(); ok(null); };
      };
      r.onerror = () => ok(null);
    }), uid);
    let claves = [], quedan = null;
    const lista = () => quedan?.length && ['perfil', 'atleta', 'consentimientos'].every((k) => claves.includes(`${uid}|${k}`))
      && quedan.every((id) => claves.includes(`${uid}|sesion:${id}`) && claves.includes(`${uid}|marcas:${id}`));
    for (let i = 0; i < 60 && !lista(); i++) { await p.waitForTimeout(250); claves = await enCopia(); quedan = await pendientes(); }
    check(lista() && claves.every((k) => k.startsWith(`${uid}|`)),
      `tras una visita con conexión, tu semana queda en el móvil, solo para tu cuenta: perfil, ficha, programa y las ${quedan?.length} sesiones que quedan, con sus marcas`);

    // ---------------------------------------------------------------- sin conexión: abrir la app
    await ctx.setOffline(true);
    const t0 = Date.now();
    await p.reload();
    await p.locator('.hero-dia .titular h2').waitFor({ timeout: 10000 });
    const ms = Date.now() - t0;
    check((await p.locator('.hero-dia .titular h2').textContent()).trim() === titulo && ms < 5000, `sin conexión, la app abre con Hoy y la sesión de hoy al momento (${ms} ms), desde la copia del móvil`);
    const banda = p.locator('.banda-conexion.sin-red');
    check(await banda.count() === 1 && /^Sin conexión · se guardará al volver$/.test((await banda.textContent()).trim()) && await p.locator('.toast.error, .error[role=alert]').count() === 0,
      'con una línea tranquila, «Sin conexión · se guardará al volver», sin errores ni esperas');
    await revisar('hoy-sin-red');
    check(await estrecho('hoy-sin-red', '.banda-conexion, .hero-dia'), 'Hoy sin conexión cabe a 360 px en oscuro');
    await entrarSesion();
    check(await p.locator('.sesion-vista .ejercicio').count() === nEj && await p.locator('.sesion-vista .banda-conexion.sin-red').count() === 1, `la sesión también abre sin conexión, entera (${nEj} ejercicios), con la misma línea`);

    // ---------------------------------------------------------------- apuntar sin conexión
    const ej1 = p.locator(`.sesion-vista .ejercicio[data-se="${se}"]`);
    if (await ej1.locator('.ejercicio-cab').getAttribute('aria-expanded') !== 'true') await ej1.locator('.ejercicio-cab').click();
    await ej1.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    await ej1.getByRole('button', { name: 'Quitar la serie 1' }).waitFor();
    await saltar();
    check(await ej1.locator('.pendiente-envio', { hasText: 'Serie 1 guardada en el móvil' }).count() === 1 && /1 pendiente/.test(await p.locator('.banda-conexion').first().textContent()) && await seriesEnBase(se, 1) === 0,
      'una serie apuntada sin conexión se guarda en el móvil (la base aún no la tiene) y la línea dice «1 pendiente»');
    // Se cierra la app y se vuelve a abrir, aún sin conexión: la serie sigue ahí
    await p.reload();
    await p.locator('.hero-dia').waitFor();
    check(await p.locator('.hero-dia').getByRole('button', { name: /Continuar sesión/ }).count() === 1, 'al volver a abrir la app sin conexión, Hoy sabe que la sesión está empezada');
    await entrarSesion();
    if (await ej1.locator('.ejercicio-cab').getAttribute('aria-expanded') !== 'true') await ej1.locator('.ejercicio-cab').click();
    check(await ej1.getByRole('button', { name: 'Quitar la serie 1' }).count() === 1 && await ej1.locator('.pendiente-envio', { hasText: 'Serie 1 guardada en el móvil' }).count() === 1,
      'y en la sesión, la serie apuntada sigue hecha, guardada en el móvil');
    await revisar('sesion-sin-red');

    // ---------------------------------------------------------------- vuelve la conexión
    await ctx.setOffline(false);
    check(await hay(p.locator('.banda-conexion'), 0, 25000) && await hay(ej1.locator('.pendiente-envio'), 0, 5000), 'al volver la conexión, la serie sale sola y la línea se va');
    await p.waitForTimeout(800);
    check(await seriesEnBase(se, 1) === 1 && await ej1.getByRole('button', { name: 'Quitar la serie 1' }).count() === 1, 'la serie llega a la base una sola vez (sin duplicados)');
    // (revisión) lo apuntado con conexión (y lo que salió de la cola) también queda en la copia del móvil: al volver a abrir
    // sin red, las series siguen hechas y no se propone otra vez la serie 1 (que pisaría la de verdad)
    await ej1.getByRole('button', { name: 'Marcar la serie 2 como hecha' }).click();
    await ej1.getByRole('button', { name: 'Quitar la serie 2' }).waitFor();
    await saltar();
    const fin2 = Date.now() + 10000;
    while (Date.now() < fin2 && await seriesEnBase(se, 2) !== 1) await p.waitForTimeout(200);
    await p.waitForTimeout(600);
    await ctx.setOffline(true);
    await p.reload();
    await p.locator('.hero-dia').waitFor();
    await entrarSesion();
    if (await ej1.locator('.ejercicio-cab').getAttribute('aria-expanded') !== 'true') await ej1.locator('.ejercicio-cab').click();
    check(await ej1.getByRole('button', { name: 'Quitar la serie 1' }).count() === 1 && await ej1.getByRole('button', { name: 'Quitar la serie 2' }).count() === 1 && await ej1.locator('.pendiente-envio').count() === 0,
      'al volver a abrir sin conexión, las series ya enviadas (la de la cola y la apuntada con conexión) siguen hechas en la copia del móvil');
    await ctx.setOffline(false);
    await hay(p.locator('.banda-conexion'), 0, 25000);
    await volverAHoy();

    // ---------------------------------------------------------------- «Novedades» tras actualizar
    await p.evaluate((u) => localStorage.setItem(`fbe-version-vista-${u}`, '0.64.0'), uid);
    await p.reload();
    await novedades.waitFor({ timeout: 10000 });
    const texto = await novedades.textContent();
    check(/sin cobertura/i.test(texto) && !/Máquina ocupada/.test(texto) && await novedades.locator('li').count() >= 2 && await novedades.getByRole('button', { name: 'Vale' }).count() === 1,
      'tras cambiar de versión (de la 0.64 a esta), «Novedades» sale con lo nuevo de las versiones que no ha visto (no lo de la 0.64) y «Vale»');
    await revisar('novedades');
    check(await estrecho('novedades', '.hoja-novedades li, .hoja-novedades .btn'), '«Novedades» cabe a 360 px en oscuro');
    await novedades.getByRole('button', { name: 'Vale' }).click();
    await hay(novedades, 0);
    await p.reload();
    await p.locator('.hero-dia').waitFor();
    await p.waitForTimeout(1200);
    check(await novedades.count() === 0 && await p.evaluate((u) => localStorage.getItem(`fbe-version-vista-${u}`), uid) !== '0.64.0', 'y no vuelve a salir');
  } catch (e) {
    check(false, `sin cobertura (v0.65): ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-sinred-065')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-065.png', import.meta.url).pathname }).catch(() => {});
  }
  await ctx.setOffline(false).catch(() => {});
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}

// Suelto: node test/e2e-sinred-065.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarSinRed065({ navegador, check });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
