// Música 3, tanda 2 (su música, migración 072), en la demo y en un móvil simulado, con Spotify simulado:
//   · «Lo tuyo»: sus listas por momento (con su etiqueta) y sus himnos
//   · en la sesión, la música de la fase (para calentar, antes de la primera serie)
//   · abrir una música desde la portada se apunta a esa sesión y se cuenta en su mes
//   · el coach ve sus listas y sus himnos en «Lo suyo»
//   Suelta:  npm run build && node test/e2e-musica3-t2.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarMusica3Suya } = await import('./e2e-musica3-t2.mjs'); await probarMusica3Suya({ navegador, check });
import { pathToFileURL } from 'node:url';
import { simularSpotify } from './e2e-musica3-t1.mjs';

export async function probarMusica3Suya({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  await simularSpotify(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  const fueraAvisos = async (q = p) => {
    for (let i = 0; i < 5; i++) {
      await q.waitForTimeout(350);
      const d = q.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await q.keyboard.press('Escape');
    }
  };
  const { irASeccion } = await import('./secciones.mjs');
  const L = (id) => `https://open.spotify.com/playlist/${id.repeat(22).slice(0, 22)}`;
  try {
    await p.goto(`${base}/?demo`);
    await p.locator('button.persona', { hasText: 'Ana López' }).click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    // --- «Lo tuyo»: sus listas por momento ---
    await irASeccion(p, 'Perfil');
    const grupo = p.locator('section[aria-labelledby="grupo-lo-tuyo"]');
    await grupo.waitFor({ timeout: 8000 });
    await grupo.scrollIntoViewIfNeeded();
    await grupo.getByRole('button', { name: 'Poner tus listas por momento' }).click();
    const h = p.getByRole('dialog', { name: 'Tus listas por momento' });
    await h.waitFor();
    for (const [id, etq] of [['C', 'calentamiento'], ['T', 'tranquila']]) {
      await h.getByLabel('Enlace a la lista').fill(L(id));
      await h.getByLabel('Para', { exact: true }).selectOption(etq);
      await h.getByRole('button', { name: 'Añadir a la lista' }).click();
    }
    check(await h.locator('.lista-musica-fila').count() === 2, 'añade dos listas, cada una con su momento');
    check(await h.locator('.lista-musica-fila').first().locator('select').inputValue() === 'calentamiento', 'y su etiqueta se puede cambiar en la lista');
    await h.getByRole('button', { name: 'Guardar' }).click();
    await h.waitFor({ state: 'detached' });
    await grupo.locator('button', { hasText: 'Tus listas por momento' }).filter({ hasText: '2 listas' }).waitFor({ timeout: 5000 });
    check(true, 'en «Lo tuyo», «2 listas»');
    // (y su lista de siempre)
    await grupo.getByRole('button', { name: 'Poner el enlace a tu música' }).click();
    const hl = p.getByRole('dialog').last();
    await hl.getByLabel(/Enlace/).first().fill(L('P'));
    await hl.getByRole('button', { name: /Guardar/ }).click();
    await hl.waitFor({ state: 'detached' });
    // --- sus himnos ---
    await grupo.getByRole('button', { name: 'Elegir tus himnos' }).click();
    const hh = p.getByRole('dialog', { name: 'Tus himnos' });
    await hh.getByLabel('Para la última serie').fill('https://open.spotify.com/track/2HHtWyy5CgaQbC7XSoOb0e');
    await hh.getByLabel('Para volver tras un parón').fill('https://ejemplo.com/x');
    check(await hh.getByRole('button', { name: 'Guardar' }).isDisabled(), 'un enlace que no es de música no se guarda');
    await hh.getByLabel('Para volver tras un parón').fill('');
    await hh.getByRole('button', { name: 'Guardar' }).click();
    await hh.waitFor({ state: 'detached' });
    const mio = await p.evaluate(() => globalThis.__fbeDemo.rpc('personal_mio', {}));
    check(mio.musica_listas.length === 2 && mio.himno_ultima_url === 'https://open.spotify.com/track/2HHtWyy5CgaQbC7XSoOb0e' && mio.himno_vuelta_url === null, 'guardados: sus listas y su himno de la última serie (los ve su coach)');
    // --- la portada y la sesión ---
    await irASeccion(p, 'Hoy');
    await fueraAvisos();
    for (let i = 0; i < 4; i++) {
      if (await p.locator('.hero-dia .btn-hero').click({ timeout: 4000 }).then(() => true).catch(() => false)) break;
      await fueraAvisos();
    }
    const musica = p.locator('section.musica-sesion');
    await musica.waitFor({ timeout: 8000 });
    // abrir la primera (sin la app de Spotify: el enlace de siempre, en otra pestaña)
    const [nueva] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), musica.getByRole('link', { name: /Abrir en/ }).first().click()]);
    await nueva?.close().catch(() => {});
    await p.waitForTimeout(500);
    const [{ m: mes }] = [{ m: await p.evaluate(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7)) }];
    const mas = await p.evaluate((m) => globalThis.__fbeDemo.rpc('musica_mas_abierta', { p_desde: m, p_hasta: m }), mes);
    check(Array.isArray(mas) && mas.length === 1 && mas[0].n === 1, 'abrir una música desde la portada se cuenta en su mes');
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.sesion-vista .ejercicio').first().waitFor();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const fase = p.locator('.musica-fase[data-fase="calentamiento"]');
    await fase.waitFor({ timeout: 6000 }).catch(() => {});
    check(await fase.count() === 1 && /Para calentar/.test(await fase.textContent()), 'en la sesión, antes de la primera serie, su música para calentar');
    await fase.getByRole('button', { name: 'Cerrar' }).click();
    check(await p.locator('.musica-fase').count() === 0, 'y se puede cerrar');
    await p.getByRole('button', { name: /Tu música/ }).first().click();
    const hm = p.getByRole('dialog', { name: 'Tu música' });
    await hm.waitFor();
    check(/Para calentar/.test(await hm.locator('.tarjeta-musica').first().textContent()), 'en «Tu música», la de la fase la primera');
    await p.keyboard.press('Escape');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= 390), 'nada se sale a 390 px');
  } catch (e) {
    check(false, `la tanda 2 de música no se ha podido recorrer: ${e.message.split('\n')[0]}`);
  }
  // --- el coach: «Lo suyo» ---
  const q = await ctx.newPage();
  q.on('pageerror', (e) => errores.push(e.message));
  try {
    await q.goto(`${base}/?demo`);
    const pel = q.locator('button.persona', { hasText: 'Pelayo' }).first();
    await Promise.race([pel.waitFor({ timeout: 8000 }), q.locator('nav.tabs').waitFor({ timeout: 8000 })]).catch(() => {});
    for (let i = 0; i < 4 && !(await pel.isVisible().catch(() => false)); i++) {
      await fueraAvisos(q);
      await q.getByRole('button', { name: 'Cambiar de cuenta' }).first().click({ timeout: 4000 }).catch(() => {});
      await q.waitForTimeout(500);
    }
    await pel.click();
    await q.locator('nav.tabs').waitFor();
    await fueraAvisos(q);
    await q.locator('.tab', { hasText: 'Atletas' }).click();
    await q.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
    await q.getByRole('tab', { name: 'Objetivos' }).click();
    const suyo = q.locator('.lo-suyo, section:has(> h2:text("Lo suyo"))').first();
    await q.getByText('Sus listas', { exact: true }).first().waitFor({ timeout: 8000 });
    check(await q.getByText('Su himno de la última serie', { exact: true }).count() >= 1 && suyo !== null, 'el coach ve sus listas y su himno en «Lo suyo»');
  } catch (e) {
    check(false, `«Lo suyo» del coach: ${e.message.split('\n')[0]}`);
  }
  check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nMúsica 3, tanda 2: su música');
  try { await probarMusica3Suya({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
