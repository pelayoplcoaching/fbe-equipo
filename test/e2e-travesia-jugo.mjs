// El jugo de «La travesía» (claude/descansos-mejoras-6.md), en la demo y en un móvil simulado: una etapa de un descanso con
// la barra hacia el siguiente sitio de la ruta, y su tarjeta final con el sello frente a su media y las estrellas contadas.
// Lo de dentro del juego (caída limpia, constelaciones, lluvia de estrellas…) va en test/travesia-jugo.test.mjs.
//   Suelta:  npm run build && node test/e2e-travesia-jugo.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarTravesiaJugo } = await import('./e2e-travesia-jugo.mjs'); await probarTravesiaJugo({ navegador, check });
import { pathToFileURL } from 'node:url';

export async function probarTravesiaJugo({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const seg = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();
    // Lleva 40,5 km (camino de La Robla) y tres etapas de media 30 m: casi cualquier etapa saca un sello alto
    await p.evaluate(async () => {
      const yo = (await globalThis.__fbeDemo.select('atletas', {}))[0];
      localStorage.setItem(`fbe-travesia-${yo.id}`, JSON.stringify({ total: 40500, estrellas: 200, mejor: 5000, sesiones: { 'antes-1': { metros: 60, estrellas: 2, etapas: 2 }, 'antes-2': { metros: 30, estrellas: 1, etapas: 1 } } }));
      const a = JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'); a.juegoUnToque = false; localStorage.setItem('fbe-ajustes', JSON.stringify(a));
    });
    await p.reload();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    const prep = p.locator('.preparacion');
    if (await prep.count()) await prep.getByRole('button', { name: 'Ahora no' }).click();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const primero = p.locator('.ejercicio').first();
    await primero.getByLabel('Kilos de la serie 1').fill('30');
    await primero.getByLabel('Repeticiones de la serie 1').fill('8');
    await p.keyboard.press('Escape');
    await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    const reloj = p.locator('.temporizador');
    await reloj.waitFor();
    await reloj.getByRole('button', { name: 'Quitar 1 minuto' }).click().catch(() => {});
    for (let i = 0; i < 12 && seg(await reloj.locator('.cuenta').textContent()) > 20; i++) await reloj.getByRole('button', { name: 'Quitar 15 segundos' }).click();
    const quedaban = seg(await reloj.locator('.cuenta').textContent());
    await reloj.getByRole('button', { name: 'Jugar' }).click();
    const juego = p.locator('.travesia');
    await juego.waitFor();
    // --- La barra hacia el siguiente sitio de la ruta ---
    const ruta = p.locator('.travesia-ruta');
    await ruta.waitFor({ timeout: 4000 });
    const t1 = await ruta.textContent();
    check(/44,5 km a La Robla/.test(t1), `arriba, hacia el siguiente sitio de la ruta («${t1.trim()}»)`);
    const lleno = await ruta.locator('.travesia-ruta-lleno').evaluate((el) => el.style.transform);
    check(/scaleX\(0\.0[4-6]/.test(lleno), `la barra va por donde va en el tramo (${lleno})`);
    for (let i = 0; i < 8; i++) { await p.touchscreen.tap(200, 520); await p.waitForTimeout(500); }
    const lleno2 = await ruta.locator('.travesia-ruta-lleno').evaluate((el) => el.style.transform);
    check(parseFloat(lleno2.slice(7)) > parseFloat(lleno.slice(7)), `y se llena mientras corre (${lleno2})`);
    // --- La tarjeta final: el sello y las estrellas contadas ---
    const fin = p.locator('.travesia-final');
    await fin.waitFor({ timeout: (quedaban + 8) * 1000 });
    const sello = fin.locator('.travesia-sello');
    check(await sello.count() === 1 && /Sello de (oro|plata|bronce)/.test(await sello.getAttribute('aria-label')), `el sello de la etapa frente a su media (${await sello.getAttribute('aria-label').catch(() => 'ninguno')})`);
    const estrellas = fin.locator('.travesia-final-det .oro .num').first();
    if (await estrellas.count()) {
      await p.waitForTimeout(1600);
      check(/^\d+$/.test(await estrellas.textContent()), `las estrellas de la etapa, contadas hasta su número (${await estrellas.textContent()})`);
    } else check(true, '(en esta etapa no cogió estrellas)');
    await fin.getByRole('button', { name: 'A por la serie' }).click();
    await juego.waitFor({ state: 'detached', timeout: 9000 });
  } catch (e) {
    check(false, `El jugo de La travesía: ${e.message.split('\n')[0]}`);
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
  console.log('\nEl jugo de La travesía');
  try { await probarTravesiaJugo({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
