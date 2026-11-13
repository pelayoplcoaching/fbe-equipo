// Personalización 2, tanda 3 (que la app le conozca), en la demo y en un móvil simulado: el coach escribe el aviso de
// una zona («Avisos por zona», con el de ejemplo) y a Ana, que dijo en el cuestionario que le molesta el hombro (y con su
// consentimiento de salud), le sale en los ejercicios que lo cargan; y no en los que no.
//   Suelta:  npm run build && node test/e2e-personal-t3.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPersonalConocerte } = await import('./e2e-personal-t3.mjs'); await probarPersonalConocerte({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarPersonalConocerte({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  try {
    // --- El coach: el aviso del hombro ---
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    await irASeccion(p, 'Cuenta');
    const sec = p.locator('section.avisos-zona');
    await sec.waitFor({ timeout: 8000 });
    await sec.scrollIntoViewIfNeeded();
    check(await sec.locator('li').count() === 9 && /Sin aviso: no sale nada/.test(await sec.textContent()), 'en su cuenta, «Avisos por zona»: nueve zonas, sin aviso de entrada');
    await sec.getByRole('button', { name: 'Tu hombro: escribir el aviso' }).click();
    const hoja = p.getByRole('dialog', { name: /Aviso: hombro/ });
    await hoja.waitFor();
    await hoja.getByRole('button', { name: 'Usar el de ejemplo' }).click();
    check(/^Tu hombro: rango cómodo/.test((await hoja.locator('.muestra blockquote').textContent()).trim()), 'con el de ejemplo y cómo lo verá («Tu hombro: …»)');
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await hoja.waitFor({ state: 'detached' });
    check(/rango cómodo y sin dolor/.test(await sec.textContent()), 'guardado');

    // --- Ana: su aviso en la sesión ---
    const q = await ctx.newPage();
    q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(`${base}/?demo`);
    // (la demo recuerda la cuenta: si entra como el coach, se cambia de cuenta)
    const anaB = q.locator('button.persona', { hasText: 'Ana López' }).first();
    await Promise.race([anaB.waitFor({ timeout: 8000 }), q.locator('nav.tabs').waitFor({ timeout: 8000 })]).catch(() => {});
    for (let i = 0; i < 4 && !(await anaB.isVisible().catch(() => false)); i++) {
      for (let j = 0; j < 4; j++) { await q.waitForTimeout(300); if (!(await q.locator('[role=dialog]').last().isVisible().catch(() => false))) break; await q.keyboard.press('Escape'); }
      await q.getByRole('button', { name: 'Cambiar de cuenta' }).first().click({ timeout: 4000 }).catch(() => {});
      await q.waitForTimeout(500);
    }
    await anaB.click();
    await q.locator('nav.tabs').waitFor();
    for (let i = 0; i < 4; i++) { await q.waitForTimeout(300); if (!(await q.locator('[role=dialog]').last().isVisible().catch(() => false))) break; await q.keyboard.press('Escape'); }
    const guardado = await q.evaluate(() => globalThis.__fbeDemo.rpc('mensajes_coach', {}).then((l) => l.some((m) => m.momento === 'molestia_hombro')));
    check(guardado, 'el aviso del coach le llega');
    // (lo que sale encima al entrar, como las medallas nuevas, puede tardar: se cierra y se reintenta)
    for (let i = 0; i < 4; i++) {
      if (await q.locator('.hero-dia .btn-hero').click({ timeout: 4000 }).then(() => true).catch(() => false)) break;
      for (let j = 0; j < 4; j++) { await q.waitForTimeout(300); if (!(await q.locator('[role=dialog]').last().isVisible().catch(() => false))) break; await q.keyboard.press('Escape'); }
    }
    await q.getByRole('button', { name: 'Empezar', exact: true }).click();
    await q.locator('.sesion-vista .ejercicio').first().waitFor();
    for (const b of await q.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    let conAviso = null, sinAviso = null;
    for (const ej of await q.locator('.sesion-vista .ejercicio').all()) {
      if (!(await ej.locator('.ejercicio-cuerpo').count())) { await ej.locator('.ejercicio-cab').click(); await q.waitForTimeout(250); }
      const nombre = (await ej.locator('.ejercicio-cab .nombre').textContent()).trim();
      if (await ej.locator('.aviso-zona').count()) conAviso ||= { nombre, texto: (await ej.locator('.aviso-zona').textContent()).trim() };
      else sinAviso ||= nombre;
      if (conAviso && sinAviso) break;
    }
    check(!!conAviso && /^Tu hombro: rango cómodo/.test(conAviso.texto), `en un ejercicio que carga el hombro (${conAviso?.nombre || 'ninguno'}), su aviso`);
    check(!!sinAviso, `y en uno que no (${sinAviso || 'ninguno'}), nada`);
    const desborda = await q.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Personalización (conocerte): ${e.message.split('\n').slice(0, 3).join(' ')}`);
    await ctx.pages().at(-1)?.screenshot({ path: '/tmp/t3-fallo.png' }).catch(() => {});
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nQue la app le conozca');
  try { await probarPersonalConocerte({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
