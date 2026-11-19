// (v0.187) Compartir, tercera tanda. Dos partes:
//  1) El banco de tarjetas (test/banco-tarjetas.jsx, compilado aquí): todas las plantillas en los tres formatos, con
//     nombres cortos, largos y de una sola palabra, con y sin récord, y los logros: ningún texto se sale de la imagen ni
//     se monta sobre otro.
//  2) La hoja, en la demo: la imagen arriba, las opciones plegadas en «Personalizar», el fondo, «Sorpréndeme», el
//     formato cuadrado y que se recuerda el estilo.
//   Suelta:  npm run build && node test/e2e-compartir-187.mjs
import { pathToFileURL, fileURLToPath } from 'node:url';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(AQUI, '..', 'dist');

export async function probarCompartir187({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  // ---------- 1) el banco ----------
  const esbuild = await import('esbuild');
  await esbuild.build({ entryPoints: [join(AQUI, 'banco-tarjetas.jsx')], bundle: true, format: 'iife', outfile: join(DIST, '_banco-tarjetas.js'), jsx: 'automatic', jsxImportSource: 'preact',
    loader: { '.json': 'json' }, define: { __DEMO__: 'true', __APP_VERSION__: '"0"' }, logLevel: 'error' });
  writeFileSync(join(DIST, '_banco-tarjetas.html'), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="app.css"><body><script src="_banco-tarjetas.js"></script>');
  let ctx = await navegador.newContext({ viewport: { width: 800, height: 600 } });
  try {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(`${base}/_banco-tarjetas.html`);
    const n = await p.evaluate(() => globalThis.casos().length);
    const fuera = [], montados = [], tamanos = [];
    const ALTO = { publicacion: 1350, historia: 1920, cuadrado: 1080 };
    for (let i = 0; i < n; i++) {
      const r = await p.evaluate((k) => globalThis.pintar(k), i);
      const formato = r.nombre.split('/').pop();
      if (r.ancho !== 1080 || (ALTO[formato] && r.alto !== ALTO[formato])) tamanos.push(`${r.nombre}: ${r.ancho}×${r.alto}`);
      for (const t of r.textos) if (t.x0 < 30 || t.x1 > r.ancho - 30 || t.y0 < 30 || t.y1 > r.alto - 20) fuera.push(`${r.nombre}: «${t.t}» (${Math.round(t.x0)}–${Math.round(t.x1)})`);
      for (let a = 0; a < r.textos.length; a++) for (let b = a + 1; b < r.textos.length; b++) {
        const A = r.textos[a], B = r.textos[b];
        const sx = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), sy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        if (sx > 6 && sy > 6) montados.push(`${r.nombre}: «${A.t}» y «${B.t}»`);
      }
    }
    check(n >= 70 && tamanos.length === 0, `el banco pinta ${n} tarjetas, cada una con su tamaño (publicación, historia y cuadrado)${tamanos.length ? `: ${tamanos.slice(0, 3).join(' | ')}` : ''}`);
    check(fuera.length === 0, `ningún texto se sale de la imagen${fuera.length ? `: ${fuera.slice(0, 4).join(' | ')} (${fuera.length})` : ''}`);
    check(montados.length === 0, `ningún texto se monta sobre otro${montados.length ? `: ${montados.slice(0, 4).join(' | ')} (${montados.length})` : ''}`);
  } catch (e) {
    check(false, `Compartir 187, el banco: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); rmSync(join(DIST, '_banco-tarjetas.js'), { force: true }); rmSync(join(DIST, '_banco-tarjetas.html'), { force: true }); }

  // ---------- 2) la hoja ----------
  ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  try {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    for (let i = 0; i < 4; i++) { await p.waitForTimeout(300); const d = p.locator('[role=dialog]').last(); if (!(await d.isVisible().catch(() => false))) break; await p.keyboard.press('Escape'); }
    // Un récord de la vitrina del perfil abre la hoja de un logro
    await p.evaluate(() => { location.hash = '#perfil'; });
    const social = p.locator('.perfil-social');
    await social.waitFor({ timeout: 10000 });
    await social.scrollIntoViewIfNeeded();
    await social.getByRole('tab', { name: 'Logros' }).click();
    const abrir = social.locator('.perfil-trofeo').first().getByRole('button', { name: /^Compartir el récord de/ });
    await abrir.waitFor({ timeout: 8000 });
    await abrir.click();
    const hoja = p.getByRole('dialog', { name: 'Compartir el récord' });
    await hoja.locator('.tarjeta-img').waitFor({ timeout: 15000 });
    const img = hoja.locator('.tarjeta-img');
    const medida = () => img.evaluate((i) => i.decode().then(() => `${i.naturalWidth}×${i.naturalHeight}`));
    check(await hoja.locator('#compartir-opciones').count() === 0 && await hoja.getByRole('button', { name: 'Personalizar' }).getAttribute('aria-expanded') === 'false',
      'la hoja abre corta: la imagen y los botones; las opciones, plegadas en «Personalizar»');
    const arriba = await img.evaluate((i) => i.getBoundingClientRect().top);
    check(arriba < 260, `la imagen queda arriba, a la vista (a ${Math.round(arriba)} px)`);
    await hoja.getByRole('button', { name: 'Personalizar' }).click();
    const formato = hoja.getByRole('group', { name: 'Formato de la imagen' });
    await formato.getByRole('button', { name: 'Cuadrado' }).click();
    await p.waitForFunction(() => { const i = document.querySelector('.tarjeta-img'); return i && i.naturalWidth === 1080 && i.naturalHeight === 1080; }, null, { timeout: 15000 });
    check(await medida() === '1080×1080', 'formato cuadrado: la imagen sale de 1080 × 1080');
    const fondos = hoja.getByRole('radiogroup', { name: 'Fondo' });
    const nFondos = await fondos.getByRole('radio').count();
    check(nFondos >= 7 && await fondos.getByRole('radio', { name: 'Automático' }).getAttribute('aria-checked') === 'true', `se puede elegir el fondo (${nFondos - 2} dibujos, «Automático» de entrada y «Sin dibujo»)`);
    const antes = await img.getAttribute('src');
    await fondos.getByRole('radio', { name: 'Cordillera' }).click();
    await p.waitForFunction((s) => document.querySelector('.tarjeta-img')?.getAttribute('src') !== s, antes, { timeout: 15000 });
    check(true, 'al elegir otro fondo, la imagen se vuelve a pintar');
    const antes2 = await img.getAttribute('src');
    await hoja.getByRole('button', { name: 'Sorpréndeme' }).click();
    await p.waitForFunction((s) => document.querySelector('.tarjeta-img')?.getAttribute('src') !== s, antes2, { timeout: 15000 });
    const paleta = await hoja.getByRole('radiogroup', { name: 'Colores' }).locator('[aria-checked="true"]').textContent();
    check(paleta.trim() !== 'Noche' && paleta.trim() !== 'Clara', `«Sorpréndeme» cambia de colores y de fondo (${paleta.trim()})`);
    await hoja.getByRole('radiogroup', { name: 'Pegatina' }).getByRole('radio', { name: 'Constancia' }).click();
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'hidden' });
    // Al volver, tu estilo sigue: opciones abiertas, cuadrado, la pegatina y los colores
    await abrir.click();
    await hoja.locator('.tarjeta-img').waitFor({ timeout: 15000 });
    check(await hoja.locator('#compartir-opciones').count() === 1 && await hoja.getByRole('radiogroup', { name: 'Pegatina' }).getByRole('radio', { name: 'Constancia' }).getAttribute('aria-checked') === 'true'
      && (await hoja.getByRole('radiogroup', { name: 'Colores' }).locator('[aria-checked="true"]').textContent()).trim() === paleta.trim(), 'al volver a abrirla, recuerda tu estilo (opciones, colores y pegatina)');
    // (v0.189) en historia, la vista previa es solo la tarjeta: sin el disco oscuro de «Tu semana» (chocaban los nombres)
    await hoja.getByText(/^Historia/).first().click();
    await p.waitForFunction(() => document.querySelector('.tarjeta-img')?.naturalHeight === 1920, null, { timeout: 15000 });
    const previa = await hoja.locator('.tarjeta-previa').evaluate((e) => ({ antes: getComputedStyle(e, '::before').content, clase: e.className }));
    check(previa.antes === 'none' && !/(^|\s)historia(\s|$)/.test(previa.clase), `en historia, nada tapa la vista previa (${previa.antes})`);
    await p.keyboard.press('Escape');
  } catch (e) {
    check(false, `Compartir 187, la hoja: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
  check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 4).join(' ## ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(DIST, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nCompartir, tercera tanda (v0.187)');
  try { await probarCompartir187({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
