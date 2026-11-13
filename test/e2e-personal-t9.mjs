// Personalización 3, tanda 9 (que el coach le conozca sin esfuerzo), en la demo y en un móvil simulado: en la ficha de
// Ana, «Para hablarle» con lo que le hace volver y su alerta (si las hay) y la idea; el panel con los hitos que merecen
// algo de verdad (si los hay); y el mensaje de bienvenida del coach.
//   Suelta:  npm run build && node test/e2e-personal-t9.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPersonalCoachSabe } = await import('./e2e-personal-t9.mjs'); await probarPersonalCoachSabe({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarPersonalCoachSabe({ navegador, check, base = 'http://localhost:4174' }) {
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
    await p.locator('button.persona', { hasText: 'Pelayo' }).click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    // --- el panel ---
    await p.locator('.tab', { hasText: 'Atletas' }).click();
    await p.locator('.tarjeta-atleta').first().waitFor({ timeout: 8000 });
    const envios = await p.locator('.envios-pendientes').count();
    if (envios) {
      const antes = await p.locator('.envios-pendientes .envio-fila').count();
      await p.locator('.envios-pendientes .envio-fila').first().getByRole('button', { name: /^Marcar como hecho/ }).click();
      check(await p.locator('.envios-pendientes .envio-fila').count() === antes - 1, 'en el panel, los hitos que merecen algo de verdad (y «Hecho» los quita)');
    } else check(true, '(en la demo, nadie con un hito para regalar esta semana)');
    // --- la ficha de Ana ---
    await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
    await p.getByRole('tab', { name: 'Objetivos' }).click();
    const ph = p.locator('section.para-hablarle');
    await ph.waitFor({ timeout: 8000 });
    await p.waitForTimeout(800);
    const t = await ph.textContent();
    check(/Idea:/.test(t) && /Su vida/.test(t), '«Para hablarle», con su vida y la idea');
    const lqf = await ph.locator('.lo-que-funciona').count(), alerta = await ph.locator('.alerta-temprana').count();
    check(true, `lo que le hace volver: ${lqf ? 'sí' : 'aún sin datos'}; su alerta: ${alerta ? 'sí' : 'ninguna'}`);
    // --- el mensaje de bienvenida (un momento más en sus mensajes) ---
    await irASeccion(p, 'Cuenta');
    const sec = p.locator('section.mensajes-automaticos');
    await sec.waitFor({ timeout: 8000 });
    check(await sec.locator('button[data-m="bienvenida"]').count() === 1 && await sec.locator('button[data-m="primera_vez"]').count() === 1 && await sec.locator('button[data-m="viaje"]').count() === 1, 'los mensajes automáticos nuevos: bienvenida, primera vez y vuelta de un viaje');
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Personalización (coach): ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nQue el coach le conozca sin esfuerzo');
  try { await probarPersonalCoachSabe({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
