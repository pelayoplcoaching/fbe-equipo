// (v0.200) La tanda de belleza, en el navegador: la escena de la versión 200 (una vez, antes de «Novedades»), el cielo de
// la hora en Hoy y al entrar, el aro de la semana, la decoración de temporada (y su ajuste), la onda al pulsar, el coach
// (el día en el saludo, el aro en la lista, el tablero con color, la ficha con el color de su etiqueta y las barras con
// degradado que crecen) y los dibujos de los vacíos; a 360 px en oscuro y con accesibilidad.
//   Suelta:  npm run build && node test/e2e-belleza-200.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarBelleza200({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(120); } return !!(await fn().catch(() => false)); };
  const foto = async (nombre) => { if (capturas) await p.screenshot({ path: `${capturas}/${nombre}.png`, fullPage: false }); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 1280;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 2500)),
    ]));
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
  }
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no', 'Vale', 'Empezar']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const nuevoContexto = (extra = {}) => navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, ...extra });
  async function entrarComo(ctx, quien, antes = null) {
    p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    if (antes) await p.addInitScript(antes);
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: quien }).first().click();
    await p.locator('nav.tabs').waitFor();
  }

  // ---------------------------------------------------------------- La atleta: escena, cielo y aro (en el móvil, en oscuro)
  const movil = await nuevoContexto({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, colorScheme: 'dark' });
  try {
    await entrarComo(movil, /Ana López/, () => { try { if (!localStorage.getItem('fbe-probar-cielo')) localStorage.setItem('fbe-probar-cielo', 'noche'); } catch { /* */ } });   // (solo la primera vez: al recargar manda lo que ponga la prueba)
    await cerrarDialogos();
    await p.locator('.hero-dia').waitFor();
    // El cielo de la noche detrás de la portada
    check(await hasta(async () => (await p.locator('.hero-dia > .cielo-hora.cielo-noche .cielo-estrella').count()) >= 8), 'Hoy, de noche: estrellas detrás de la portada');
    check(await p.locator('.hero-dia > .cielo-hora').getAttribute('aria-hidden') === 'true', 'el cielo es solo adorno (aria-hidden)');
    // El aro de la semana alrededor de su foto
    const aro = p.locator('.btn-avatar .con-aro');
    check(await aro.count() === 1 && /^\d+\/\d+$/.test(await aro.getAttribute('data-aro') || '') && await aro.locator('svg.aro-semana circle.aro-pista').count() >= 1, `el aro de su semana alrededor de su foto (${await aro.getAttribute('data-aro').catch(() => '')})`);
    check(await p.getByRole('button', { name: 'Tu perfil', exact: true }).count() === 1, 'y el botón de su perfil se sigue llamando igual');
    await revisar('hoy-noche');
    await foto('200-hoy-noche');

    // La escena de la 200: a quien venía de una versión anterior, una vez, y luego «Novedades»
    const clave = await p.evaluate(() => Object.keys(localStorage).find((k) => k.startsWith('fbe-version-vista-')));
    await p.evaluate((k) => { localStorage.setItem(k, '0.199.0'); localStorage.setItem('fbe-probar-escena-200', '1'); localStorage.removeItem('fbe-escena-200'); localStorage.setItem('fbe-probar-cielo', 'atardecer'); }, clave);
    await p.reload();
    // (la bienvenida del día, si sale, va antes)
    const escena = p.getByRole('dialog', { name: 'La app llega a la versión 200' });
    for (let i = 0; i < 20 && !(await escena.isVisible().catch(() => false)); i++) {
      const bd = p.getByRole('button', { name: 'Empezar', exact: true });
      if (await bd.isVisible().catch(() => false)) await bd.click();
      await p.waitForTimeout(300);
    }
    check(await escena.isVisible(), 'al venir de la 0.199: la escena de la versión 200');
    check(await escena.locator('.e200-lobo .e200-trazo').count() === 1 && (await escena.locator('.e200-cifra').textContent()).trim() === '200' && /Gracias por entrenar/.test(await escena.textContent()), 'con el lobo, el 200 y su texto');
    await revisar('escena-200');
    await foto('200-escena');
    await escena.getByRole('button', { name: 'Seguir' }).click();
    check(await hasta(async () => (await escena.count()) === 0), 'Seguir la cierra');
    const nov = p.getByRole('dialog', { name: 'Novedades' });
    const { NOVEDADES } = await import('../web/src/novedades.js');
    check(await hasta(async () => (await nov.textContent()).includes(NOVEDADES['0.200'].atleta[0])), 'y después, «Novedades» con lo de la 0.200');
    await nov.getByRole('button', { name: 'Vale' }).click();
    check(await hasta(async () => (await p.locator('.hero-dia > .cielo-hora.cielo-atardecer .cielo-sol').count()) === 1), 'de tarde: el sol que se pone detrás de la portada');
    await p.reload();
    await p.locator('.hero-dia').waitFor();
    await p.waitForTimeout(1200);
    check(await escena.count() === 0 && await p.evaluate(() => localStorage.getItem('fbe-escena-200')) === '1', 'y la escena no vuelve a salir en este móvil');
    check(errores.length === 0, `la atleta, sin errores ni problemas de accesibilidad a 360 px en oscuro${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await movil.close(); }

  // ---------------------------------------------------------------- La temporada (en Navidad) y la onda
  errores.length = 0;
  const nav = await nuevoContexto();
  try {
    await nav.clock.setFixedTime(new Date('2026-12-24T11:00:00+01:00'));
    await entrarComo(nav, /Ana López/, () => { try { localStorage.setItem('fbe-probar-belleza', '1'); } catch { /* */ } });
    await cerrarDialogos();
    check(await hasta(async () => (await p.evaluate(() => document.documentElement.getAttribute('data-temporada'))) === 'navidad'), 'en Nochebuena: la decoración de Navidad');
    check(await p.locator('.temporada-capa.temporada-navidad i').count() === 14 && await p.locator('.temporada-capa').getAttribute('aria-hidden') === 'true', 'catorce copos, solo de adorno');
    check(await p.evaluate(() => { const r = document.querySelector('.temporada-capa').getBoundingClientRect(); return getComputedStyle(document.querySelector('.temporada-capa')).pointerEvents === 'none' && r.top === 0 && r.right <= innerWidth; }), 'arriba, sin recibir toques y sin salirse');
    // La onda al pulsar un botón
    await p.evaluate(() => { window.__ondas = 0; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList?.contains('onda-capa')) window.__ondas++; }))).observe(document.body, { childList: true }); });
    await p.locator('nav.tabs .tab').nth(1).click();
    check(await hasta(async () => (await p.evaluate(() => window.__ondas)) >= 1, 2000), 'al pulsar, la onda');
    check(await hasta(async () => (await p.locator('.onda-capa').count()) === 0, 3000), 'y se va sola');
    // Se apaga en Ajustes
    await p.evaluate(() => { location.hash = '#ajustes'; });
    const sw = p.getByRole('switch', { name: /Decoración de temporada/ });
    await sw.waitFor();
    check(await sw.isChecked(), 'en Ajustes, «Decoración de temporada», encendida de serie');
    await sw.click();
    check(await hasta(async () => (await p.locator('.temporada-capa').count()) === 0 && !(await p.evaluate(() => document.documentElement.hasAttribute('data-temporada')))), 'al apagarla, se van los copos');
    await sw.click();
    check(await hasta(async () => (await p.locator('.temporada-capa i').count()) === 14), 'y al encenderla, vuelven');
    check(await p.locator('.acento-op').count() === 11 && await p.locator('.acento-op', { hasText: 'Abeto' }).count() === 1 && await p.locator('.acento-op', { hasText: 'Granada' }).count() === 1, 'los dos colores nuevos, para elegir: Abeto y Granada');
    await p.locator('.acento-op', { hasText: 'Granada' }).click();
    check(await hasta(async () => /oklch|#|rgb/.test(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--morado'))) && (await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes')).acento)) === 'granada'), 'y se aplica Granada');
    await revisar('ajustes-navidad');
    await foto('200-ajustes');
    check(errores.length === 0, `en Navidad, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await nav.close(); }

  // ---------------------------------------------------------------- El coach: saludo, aro, tablero, ficha con color, barras
  errores.length = 0;
  const ctx = await nuevoContexto();
  try {
    await entrarComo(ctx, /Pelayo/);
    await cerrarDialogos();
    await p.locator('[data-atleta]').first().waitFor();
    // El aro en la lista
    check(await hasta(async () => (await p.locator('tr[data-atleta] .con-aro').count()) > 0), 'el aro de la semana en las fotos de la lista');
    // El día en el saludo (si sale la cabecera ilustrada)
    if (await p.locator('.cab-coach').count()) {
      const dia = p.locator('.cab-coach-dia');
      check(await hasta(async () => (await dia.count()) === 0 || /sesión hoy|te ha(n)? escrito/.test(await dia.textContent())), `el saludo dice quién tiene sesión hoy o te ha escrito («${(await dia.textContent().catch(() => '')) || 'sin nada hoy'}»)`);
    }
    if (await p.locator('.cab-coach').count()) check(await p.locator('.cab-coach > .cab-cielo').count() === 1, 'el saludo del coach, con el cielo de la hora');
    // El tablero con color
    await p.getByRole('button', { name: 'Tablero' }).click();
    check(await hasta(async () => (await p.locator('.tablero-columna').count()) > 0), 'el tablero');
    const cols = await p.locator('.tablero-columna').evaluateAll((xs) => xs.map((x) => ({ tono: x.dataset.tono, n: Number(x.querySelector('.tablero-cuenta')?.textContent), items: x.querySelectorAll('.tablero-tarjeta').length })));
    check(cols.every((c) => ['morado', 'azul', 'verde', 'ambar', 'rojo', 'gris'].includes(c.tono) && c.n === c.items), `cada columna con su color y su cuenta (${cols.map((c) => `${c.tono} ${c.n}`).join(', ')})`);
    await revisar('tablero');
    await foto('200-tablero');
    await p.getByRole('button', { name: 'Tablero' }).click();
    // Una etiqueta y la ficha toma su color
    const fila = p.locator('tr[data-atleta]').filter({ hasNot: p.locator('text=Marta') }).first();
    const nombre = (await fila.locator('.nombre-linea').evaluate((x) => x.firstChild.textContent)).trim();
    const corto = nombre.split(' ')[0];
    await fila.getByRole('button', { name: `Desplegar lo de ${corto}` }).click();
    const det = p.locator('.detalle-atleta').first();
    await det.waitFor();
    await det.getByLabel('Etiqueta nueva').fill('Preboda');
    await det.getByRole('button', { name: 'Poner' }).click();
    await hasta(async () => (await fila.locator('.chip-etiqueta').allTextContents()).includes('Preboda'));
    await fila.locator('.nombre-linea').click();
    const cab = p.locator('.cabecera-grande').first();
    check(await hasta(async () => /cab-etiqueta cab-etq-(morado|azul|verde|ambar|rojo|gris)/.test(await cab.getAttribute('class'))), `en su ficha, la cabecera con el color de su etiqueta (${await cab.getAttribute('class')})`);
    check(await hasta(async () => (await p.locator('.ficha-etiquetas .chip-etiqueta').allTextContents()).includes('Preboda')), 'y la etiqueta, bajo su nombre');
    // Las barras de las gráficas: con degradado, y crecen al verse
    check(await p.locator('#defs-belleza linearGradient').count() === 4, 'los degradados de las barras, una vez en la página');
    const carga = p.locator('svg.grafica-carga');
    if (await carga.count()) {
      await carga.scrollIntoViewIfNeeded();
      check(await hasta(async () => (await carga.getAttribute('class')).includes('grafica-crece')), 'la carga de entrenamiento: las barras crecen al verse');
      check(await carga.locator('rect.barra').first().evaluate((r) => getComputedStyle(r).fill.startsWith('url(')), 'y llevan degradado');
    }
    await revisar('ficha');
    await foto('200-ficha');
    check(errores.length === 0, `el coach, sin errores ni problemas de accesibilidad${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }

  // ---------------------------------------------------------------- Segunda tanda: luna, lluvia, fuegos, lobo, estrellas y «Con el sol»
  errores.length = 0;
  const noche = await nuevoContexto({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark' });
  try {
    await noche.clock.setFixedTime(new Date('2026-11-20T23:15:00+01:00'));
    await entrarComo(noche, /Ana López/, () => { try { localStorage.setItem('fbe-probar-cielo', 'noche'); localStorage.setItem('fbe-probar-luna', '0.62'); } catch { /* */ } });
    await cerrarDialogos();
    await p.locator('.hero-dia').waitFor();
    check(await hasta(async () => (await p.locator('.hero-dia > .cielo-hora .cielo-luna').getAttribute('data-ilum')) === '0.62'), 'de noche, la luna en su fase (62 %)');
    check(await p.locator('.temporada-capa.temporada-estrellas i').count() === 16 && await p.locator('.temporada-capa.temporada-estrellas').isVisible(), 'fuera de temporada, de noche y en oscuro: estrellas tenues de fondo');
    // El lobo aúlla con tres toques
    const marca = p.locator('header.cabecera .titulo').first();
    for (let i = 0; i < 3; i++) await marca.click();
    check(await hasta(async () => /lobo-aulla/.test(await marca.getAttribute('class')), 2000), 'tres toques al lobo de arriba: aúlla');
    check(await hasta(async () => !/lobo-aulla/.test(await marca.getAttribute('class')), 4000), 'y vuelve a su sitio');
    // Lluvia y fuegos (lo que diría la previsión y la fecha)
    await p.evaluate(() => { localStorage.setItem('fbe-probar-clima', 'lluvia'); localStorage.setItem('fbe-probar-fiesta', '1'); });
    await p.reload();
    await p.locator('.hero-dia').waitFor();
    check(await hasta(async () => (await p.locator('.hero-dia > .cielo-hora.con-lluvia .cielo-gota').count()) >= 10), 'si llueve donde está, llueve en la portada');
    check(await p.locator('.hero-dia > .cielo-hora .cielo-fuego').count() === 4 && await p.locator('.hero-dia .toca-hoy.fiesta').count() === 1, 'en Nochevieja, fuegos y su pastilla');
    await revisar('hoy-lluvia-fiesta');
    await foto('200-lluvia-fiesta');
    await p.evaluate(() => { localStorage.removeItem('fbe-probar-clima'); localStorage.removeItem('fbe-probar-fiesta'); });
    // «Con el sol»: a las 23:15, oscuro
    await p.evaluate(() => { location.hash = '#ajustes'; });
    const tema = p.getByRole('group', { name: 'Tema', exact: true });
    await tema.waitFor();
    await tema.getByRole('button', { name: /Con el sol/ }).click();
    check(await hasta(async () => (await p.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark' && (await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes')).tema)) === 'sol'), 'tema «Con el sol» a las 23:15: oscuro');
    await revisar('ajustes-sol');
    check(errores.length === 0, `la segunda tanda, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await noche.close(); }

  // ---------------------------------------------------------------- La pantalla de entrar, con su cielo (y con reducir movimiento)
  errores.length = 0;
  const fuera = await nuevoContexto({ viewport: { width: 360, height: 740 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  try {
    p = await fuera.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fbe-probar-cielo', 'amanecer'); } catch { /* */ } });
    await p.goto(`${base}/?demo`);
    await p.locator('.acceso-caja').first().waitFor();
    check(await p.locator('.app > .acceso-cielo.cielo-amanecer .cielo-sol').count() === 1, 'al entrar, el cielo de la hora (el amanecer)');
    check(await p.evaluate(() => getComputedStyle(document.querySelector('.acceso-cielo .cielo-sol')).animationName) === 'none', 'con «reducir movimiento», quieto');
    await revisar('entrar');
    await foto('200-entrar');
    check(errores.length === 0, `la pantalla de entrar, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await fuera.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4189);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('La tanda de belleza (v0.200)');
  try { await probarBelleza200({ navegador, check, base: 'http://localhost:4189', capturas: process.env.CAPTURAS || null }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n')[0]); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
