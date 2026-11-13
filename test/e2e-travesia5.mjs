// «La travesía», tanda 5 (lo visual), en la demo y en un móvil simulado: la viñeta, el cartel del paisaje, un cielo con
// dibujo, que no se pierdan cuadros, la distancia final que rueda hasta su número y, con «reducir movimiento», todo quieto
// y sin errores. Lo demás de la tanda (fugaces, estirar, sacudida…) va en test/travesia.test.mjs.
//   Suelta:  npm run build && node test/e2e-travesia5.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarTravesia5 } = await import('./e2e-travesia5.mjs'); await probarTravesia5({ navegador, check });
import { pathToFileURL } from 'node:url';
import { NOMBRES_PAISAJE } from '../web/src/logica/travesia-efectos.js';

export async function probarTravesia5({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const abrir = async (opciones = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid', ...opciones });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
    return { ctx, p };
  };
  // (cuántos colores distintos hay en el cielo, de 16 en 16 px; y si la línea del suelo sigue ahí)
  const lienzo = (p) => p.evaluate(() => {
    const c = document.querySelector('.travesia-lienzo'); const x = c.getContext('2d');
    const alto = Math.round(c.height * 0.6), d = x.getImageData(0, 0, c.width, alto).data, colores = new Set();
    for (let y = 0; y < alto; y += 16) for (let px = 0; px < c.width; px += 16) { const i = (y * c.width + px) * 4; colores.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`); }
    const fila = Math.round(c.height * 0.66) + 1, s = x.getImageData(0, fila - 3, c.width, 6).data; let claro = 0;
    for (let i = 0; i < s.length; i += 4) if (s[i + 2] > 200 && s[i] > 120) claro++;
    return { colores: colores.size, claro };
  });
  // (lo que tarda de media un cuadro, en ms, durante un segundo y medio)
  const ritmo = (p) => p.evaluate(() => new Promise((ok) => {
    let n = 0; const t0 = performance.now();
    const paso = (t) => { n += 1; if (t - t0 < 1500) requestAnimationFrame(paso); else ok((t - t0) / n); };
    requestAnimationFrame(paso);
  }));

  // --- En un descanso corto: la viñeta, el cartel, el cielo, el ritmo y la tarjeta final ---
  let { ctx, p } = await abrir();
  try {
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    const prep = p.locator('.preparacion');
    if (await prep.count()) {
      for (const [g, r] of [['¿Cómo has dormido?', 'Bien'], ['¿Cómo tienes la energía?', 'Normal'], ['¿Agujetas o molestias?', 'Ninguna']]) {
        await prep.getByRole('group', { name: g }).getByRole('button', { name: r, exact: true }).click();
        await p.waitForTimeout(350);
      }
    }
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const primero = p.locator('.ejercicio').first();
    await primero.getByLabel('Kilos de la serie 1').fill('30');
    await primero.getByLabel('Repeticiones de la serie 1').fill('8');
    await p.keyboard.press('Escape');
    await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    const reloj = p.locator('.temporizador');
    await reloj.waitFor();
    const seg = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
    await reloj.getByRole('button', { name: 'Quitar 1 minuto' }).click();
    for (let i = 0; i < 12 && seg(await reloj.locator('.cuenta').textContent()) > 20; i++) await reloj.getByRole('button', { name: 'Quitar 15 segundos' }).click();
    const quedaban = seg(await reloj.locator('.cuenta').textContent());
    await reloj.getByRole('button', { name: 'Jugar' }).click();
    const juego = p.locator('.travesia');
    await juego.waitFor();
    const cartel = p.locator('.travesia-cartel');
    await p.waitForFunction(() => { const el = document.querySelector('.travesia-cartel'); return el && el.textContent && getComputedStyle(el).visibility === 'visible'; }, null, { timeout: 4000 }).catch(() => {});
    check(NOMBRES_PAISAJE.includes(await cartel.textContent()) && await cartel.getAttribute('aria-hidden') === 'true' && await cartel.evaluate((el) => getComputedStyle(el).visibility) === 'visible',
      `al entrar, el cartel con el nombre del paisaje («${await cartel.textContent()}»)`);
    check(await p.locator('.travesia-vineta').count() === 1 && await p.locator('.travesia-vineta').evaluate((el) => getComputedStyle(el).pointerEvents === 'none' && getComputedStyle(el).backgroundImage.includes('gradient')),
      'la viñeta oscurece un poco los bordes (y no estorba al toque)');
    await p.waitForTimeout(700);
    const pin = await lienzo(p);
    check(pin.colores >= 12 && pin.claro > 200, `el cielo tiene dibujo (${pin.colores} tonos) y la línea del suelo sigue en su sitio`);
    const ms = await ritmo(p);
    check(ms < 40, `no se pierden cuadros: ${Math.round(ms * 10) / 10} ms de media por cuadro`);
    for (let i = 0; i < 3; i++) { await p.touchscreen.tap(200, 520); await p.waitForTimeout(600); }
    const fin = p.locator('.travesia-final');
    await fin.waitFor({ timeout: (quedaban + 8) * 1000 });
    await p.waitForTimeout(1100);
    const total = await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^fbe-travesia-[0-9a-f]{8}-/.test(x)); return k ? JSON.parse(localStorage.getItem(k)).total : -1; });
    const dicho = (await fin.locator('strong').textContent()).replace(/\s+/g, ' ').trim();
    check(total > 20 && dicho === `${total} m`, `la distancia de la tarjeta final rueda hasta su número y se queda en él (${dicho})`);
    check(await p.evaluate(() => document.querySelector('.travesia-cartel').getAnimations().length <= 1), 'y los carteles no se amontonan');
    await juego.waitFor({ state: 'detached', timeout: 12000 });
  } catch (e) {
    check(false, `La travesía, tanda 5: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  // --- Con «reducir movimiento»: se pinta igual, quieto, y sin errores ---
  ({ ctx, p } = await abrir({ reducedMotion: 'reduce' }));
  try {
    const tarjeta = p.locator('.travesia-tarjeta');
    await tarjeta.scrollIntoViewIfNeeded();
    await tarjeta.getByRole('button', { name: /Practicar/ }).click();
    await p.locator('.travesia').waitFor();
    await p.waitForTimeout(900);
    const a = await p.evaluate(() => document.querySelector('.travesia-lienzo').toDataURL().length);
    const pin = await lienzo(p);
    await p.waitForTimeout(400);
    check(pin.colores >= 10 && pin.claro > 200 && a > 5000, `con «reducir movimiento», el juego se pinta igual (${pin.colores} tonos)`);
    await p.touchscreen.tap(200, 520);
    await p.waitForTimeout(500);
    check(await p.locator('.travesia').count() === 1 && /\d+ m/.test(await p.locator('.travesia-dato').first().textContent()), 'y se juega igual');
    await p.locator('.travesia-cerrar').click();
  } catch (e) {
    check(false, `La travesía, tanda 5, con reducir movimiento: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
  check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 5).join(' ## ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nLa travesía, tanda 5: lo visual');
  try { await probarTravesia5({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
