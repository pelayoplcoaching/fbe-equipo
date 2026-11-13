// Personalización 3, tanda 5 (que la sesión de hoy sea suya, como consejo), en la demo y en un móvil simulado: en la
// portada, «¿Cuánto tiempo tienes hoy?» (qué podría dejar, sin tocar la sesión) y su calentamiento; y al cambiar un
// ejercicio, la alternativa que eligió la última vez sale delante.
//   Suelta:  npm run build && node test/e2e-personal-t5.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPersonalSesionTuya } = await import('./e2e-personal-t5.mjs'); await probarPersonalSesionTuya({ navegador, check });
import { pathToFileURL } from 'node:url';

export async function probarPersonalSesionTuya({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 5; i++) {
      await p.waitForTimeout(350);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  try {
    await p.goto(`${base}/?demo`);
    await p.locator('button.persona', { hasText: 'Ana López' }).click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    for (let i = 0; i < 4; i++) {
      if (await p.locator('.hero-dia .btn-hero').click({ timeout: 4000 }).then(() => true).catch(() => false)) break;
      await fueraAvisos();
    }
    // --- ¿Cuánto tiempo tienes hoy? ---
    const th = p.locator('.tiempo-hoy');
    await th.waitFor({ timeout: 6000 });
    const seccion = p.locator('section', { has: p.getByRole('heading', { name: 'Lo que vas a hacer' }) }).first();
    const antes = await seccion.textContent();
    await th.getByRole('button', { name: '25 min' }).click();
    const r = th.locator('.tiempo-hoy-r');
    await r.waitFor();
    const t = await r.textContent();
    check(/Con 25 minutos/.test(t) && /tu sesión no cambia/.test(t), `con 25 minutos, qué podría dejar, como consejo («${t.slice(0, 70)}…»)`);
    check(await th.locator('.tiempo-hoy-lista li').count() >= 1 || /no da|no llega|toda la sesión/.test(t), 'con lo que podría dejar (o que no da)');
    check(antes.length > 0 && (await seccion.textContent()) === antes, 'la lista de la sesión sigue igual');
    // --- su calentamiento ---
    const cal = p.locator('details.calentamiento');
    await cal.locator('summary').click();
    check(await cal.locator('li').count() >= 3 && /cardio suave/.test(await cal.textContent()) && /por tu hombro/.test(await cal.textContent()), 'su calentamiento, con lo de su hombro (con su consentimiento de salud)');
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');

    // --- sus alternativas, primero ---
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.sesion-vista .ejercicio').first().waitFor();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    let elegido = null;
    for (const ej of await p.locator('.sesion-vista .ejercicio').all()) {
      if (!(await ej.locator('.ejercicio-cuerpo').count())) { await ej.locator('.ejercicio-cab').click(); await p.waitForTimeout(250); }
      const mas = ej.getByRole('button', { name: /^Más herramientas/ }).first();
      if (!(await mas.count())) continue;
      await mas.click();
      const cambiar = p.locator('[role=dialog]').last().locator('button', { hasText: 'Por una alternativa' }).first();
      await cambiar.waitFor({ timeout: 3000 }).catch(() => {});
      if (!(await cambiar.isVisible().catch(() => false))) { await p.keyboard.press('Escape'); continue; }
      await cambiar.click();
      const hoja = p.getByRole('dialog', { name: 'Cambiar ejercicio' });
      await hoja.waitFor();
      const ops = hoja.locator('.lista-elegir .opcion-con-video > button');
      const n = await ops.count();
      if (n < 2) { await p.keyboard.press('Escape'); await hoja.waitFor({ state: 'detached' }); continue; }
      elegido = (await ops.nth(n - 1).locator('span').first().textContent()).trim();
      await ops.nth(n - 1).click();
      await hoja.waitFor({ state: 'detached' });
      await mas.click();
      await p.locator('[role=dialog]').last().locator('button', { hasText: 'Por una alternativa' }).first().click();
      await hoja.waitFor();
      const segunda = (await ops.nth(1).textContent()).trim();
      check(segunda.startsWith(elegido) && /La que elegiste la última vez/.test(segunda), `al volver a cambiar, la que eligió la última vez («${elegido}») sale delante`);
      await p.keyboard.press('Escape');
      break;
    }
    if (!elegido) check(true, '(ningún ejercicio con alternativas en la demo)');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Personalización (sesión tuya): ${e.message.split('\n').slice(0, 3).join(' ')}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nQue la sesión de hoy sea suya');
  try { await probarPersonalSesionTuya({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
