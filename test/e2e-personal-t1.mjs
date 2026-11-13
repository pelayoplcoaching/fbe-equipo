// Personalización 2, tanda 1 (que la app le hable a cada uno), en la demo y en un móvil simulado: en «Lo tuyo», cómo te
// hablamos (género y tono, con un ejemplo) y qué celebrar; la bienvenida con el saludo de su hora y su género; la portada
// de la sesión con su nombre («Ana, hoy toca»); y el resumen con su titular.
//   Suelta:  npm run build && node test/e2e-personal-t1.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPersonalTrato } = await import('./e2e-personal-t1.mjs'); await probarPersonalTrato({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarPersonalTrato({ navegador, check, base = 'http://localhost:4174' }) {
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
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();

    // --- «Lo tuyo»: cómo te hablamos ---
    await irASeccion(p, 'Perfil');
    const grupo = p.locator('section[aria-labelledby="grupo-lo-tuyo"]');
    await grupo.waitFor({ timeout: 8000 });
    await grupo.scrollIntoViewIfNeeded();
    check(await grupo.getByRole('button', { name: 'Elegir cómo te hablamos' }).count() === 1 && await grupo.getByRole('button', { name: 'Elegir qué celebrar' }).count() === 1, 'en «Lo tuyo», «Cómo te hablamos» y «Qué celebrar»');
    await grupo.getByRole('button', { name: 'Elegir cómo te hablamos' }).click();
    const hoja = p.getByRole('dialog', { name: 'Cómo te hablamos' });
    await hoja.waitFor();
    check(await hoja.getByRole('button', { name: 'Sin marcar' }).getAttribute('aria-pressed') === 'true' && /¡Qué sesión, Ana!/.test(await hoja.locator('.trato-ejemplo').textContent()), 'de entrada, sin marcar y cercano (con un ejemplo de cómo se lo diríamos)');
    await hoja.getByRole('button', { name: 'En femenino' }).click();
    await hoja.getByLabel(/A tope/).check();
    check(/¡Brutal, Ana!/.test(await hoja.locator('.trato-ejemplo').textContent()) && /imparable/.test(await hoja.locator('.trato-ejemplo').textContent()), 'el ejemplo cambia al elegir: en femenino y a tope');
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await hoja.waitFor({ state: 'detached' });
    const pers = await p.evaluate(() => globalThis.__fbeDemo.rpc('personal_mio', {}));
    check(pers?.genero === 'f' && pers.tono === 'tope', 'guardado (lo ve su coach)');
    check(/En femenino · A tope/.test(await grupo.textContent()), 'y la fila lo dice');

    // --- Qué celebrar ---
    await grupo.getByRole('button', { name: 'Elegir qué celebrar' }).click();
    const hc = p.getByRole('dialog', { name: 'Qué celebrar' });
    await hc.waitFor();
    await hc.getByRole('group', { name: 'Récords' }).getByRole('button', { name: 'Solo vibración' }).click();
    await hc.getByRole('group', { name: 'Semanas completas' }).getByRole('button', { name: 'Nada' }).click();
    const aj = await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes') || '{}').celebrar);
    check(aj?.record === 'vibrar' && aj.semana === 'nada' && aj.racha === 'todo', 'qué celebrar y cómo, en este móvil (récords con vibración, semanas sin nada)');
    await p.keyboard.press('Escape');
    check(/A tu manera/.test(await grupo.textContent()), 'la fila: «A tu manera»');

    // (la bienvenida con el saludo de su hora: en test/e2e-bienvenida-068.mjs y en las pruebas de la lógica)
    // --- La portada de la sesión, con su nombre ---
    await irASeccion(p, 'Hoy');
    await p.locator('.hero-dia .btn-hero').click();
    const para = p.locator('.portada-para');
    await para.waitFor({ timeout: 6000 });
    check((await para.textContent()) === 'Ana, hoy toca', 'en la portada de la sesión: «Ana, hoy toca»');
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Personalización (trato): ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nQue la app le hable a cada uno');
  try { await probarPersonalTrato({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
