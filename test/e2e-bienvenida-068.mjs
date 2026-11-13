// v0.68: la bienvenida del día, en la demo, en un iPhone de Playwright. Lo llama e2e.test.mjs. (En un navegador automático
// solo sale si la prueba lo pide con «fbe-probar-bienvenida»: si no, taparía las demás pruebas.)
//   · el atleta: «Hola de nuevo, Ana» y un mensaje según cómo va, «Empezar»; una vez al día (al volver a abrir, ya no);
//   · el coach: «Valar morghulis, coach supremo»;
//   · 360 px en oscuro, sin fallos de accesibilidad.
import { createRequire } from 'node:module';
import { devices } from 'playwright';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarBienvenida068({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('fbe-probar-bienvenida', '1'); } catch { /* */ } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const esperar = async (f, arg, ms = 10000) => { try { await p.waitForFunction(f, arg, { timeout: ms }); return true; } catch { return false; } };
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
  const estrecho = async (paso) => {
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar(`${paso}-360-oscuro`);
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360
      && [...document.querySelectorAll('.bdia-nombre, .bdia-empezar')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
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
  const nombres = () => p.locator('.sesion-vista .ejercicio .ejercicio-cab .nombre').evaluateAll((xs) => xs.map((x) => x.textContent.replace(/^[A-Z]\d/, '').trim()));
  const nombreDe = async (ej) => (await ej.locator('.ejercicio-cab .nombre').textContent()).replace(/^[A-Z]\d/, '').trim();
  const abrir = async (ej) => {
    const cab = ej.locator('.ejercicio-cab');
    if (await cab.getAttribute('aria-expanded') !== 'true') await cab.click();
    await ej.locator('.ejercicio-cuerpo').waitFor();
  };
  const saltar = async () => { if (await p.locator('.temporizador').count()) { await p.locator('.temporizador').getByRole('button', { name: /^(Saltar|Cerrar)$/ }).first().click(); await hay(p.locator('.temporizador'), 0); } };
  const entrarSesion = async () => {
    await p.locator('.tab', { hasText: 'Hoy' }).click();
    await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).click();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor();
    if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    if (await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).count()) await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).click();
    await p.waitForTimeout(600);
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
  };

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    const cod = p.getByLabel('Código', { exact: true });
    const bv = p.getByRole('dialog', { name: /Hola|Buen[oa]s (días|tardes|noches)|bienvenid/i });
    await Promise.race([cod.waitFor({ timeout: 8000 }).catch(() => {}), bv.waitFor({ timeout: 8000 }).catch(() => {}), p.locator('nav.tabs').waitFor()]);
    if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
    await bv.waitFor();
    const empezar = bv.getByRole('button', { name: 'Empezar' });
    await empezar.waitFor();
    await esperar(() => document.activeElement?.classList.contains('bdia-empezar'));
    const titulo = (await bv.locator('h1').textContent()).replace(/\s+/g, ' ').trim();
    const mensaje = (await bv.locator('.bdia-mensaje').textContent()).trim();
    check(/^(Hola( de nuevo)?|Buen[oa]s (días|tardes|noches)(, madrugador[a]?:)?|Te damos la bienvenida|¡Bienvenid[ao]),? Ana$/.test(titulo) && mensaje.length > 5 && !/Preparando/.test(mensaje) && await p.evaluate(() => document.activeElement?.classList.contains('bdia-empezar')),
      `al abrir la app, la bienvenida: «${titulo}» y «${mensaje}», con «Empezar» (y el foco en él)`);
    await revisar('bienvenida');
    check(await estrecho('bienvenida'), 'la bienvenida cabe a 360 px en oscuro');
    await empezar.click();
    await hay(p.locator('.bdia'), 0);
    await p.locator('nav.tabs').waitFor();
    check(await p.locator('.bdia').count() === 0 && await p.locator('.hero-dia').count() === 1, '«Empezar» la quita y deja Hoy');
    await p.reload();
    await p.locator('.hero-dia').waitFor();
    await p.waitForTimeout(800);
    check(await p.locator('.bdia').count() === 0, 'una vez al día: al volver a abrir la app hoy, ya no sale');
    // El coach
    // (otra cuenta: se sale de la demo y se elige al coach)
    await p.evaluate(() => { localStorage.removeItem('fbe-demo-v2-sesion'); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    const bc = p.getByRole('dialog', { name: /Valar morghulis/ });
    await bc.waitFor();
    check((await bc.locator('h1').textContent()).replace(/\s+/g, ' ').trim() === 'Valar morghulis, coach supremo', 'al coach: «Valar morghulis, coach supremo»');
    await revisar('bienvenida-coach');
    await bc.getByRole('button', { name: 'Empezar' }).click();
    await hay(p.locator('.bdia'), 0);
    check(await p.locator('nav.tabs').count() === 1, 'y «Empezar» le deja en su panel');
  } catch (e) {
    check(false, `v0.68: ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-bienvenida-068')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-068.png', import.meta.url).pathname }).catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}
