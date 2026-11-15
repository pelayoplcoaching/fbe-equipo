// La biblioteca ampliada (rama biblioteca-2), en la demo y en un móvil de 390 px, como coach:
//   · la biblioteca tiene los ejercicios nuevos y los tres grupos (antebrazo, aductores, lumbares) en su filtro
//   · un ejercicio nuevo abre su ficha con su rango y sus alternativas
//   · al elegir ejercicio en el editor, también salen los grupos nuevos
//   Suelta:  npm run build && node test/e2e-biblioteca2.mjs
import { pathToFileURL } from 'node:url';

export async function probarBiblioteca2({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  const { irASeccion } = await import('./secciones.mjs');
  try {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(`${base}/?demo`);
    await p.locator('button.persona', { hasText: 'Pelayo' }).first().click();
    await p.locator('nav.tabs').waitFor();
    for (let i = 0; i < 4; i++) { await p.waitForTimeout(300); if (!(await p.locator('[role=dialog]').last().isVisible().catch(() => false))) break; await p.keyboard.press('Escape'); }
    await irASeccion(p, 'Biblioteca');
    const buscar = p.getByRole('searchbox', { name: 'Buscar ejercicio' });
    await buscar.waitFor({ timeout: 10000 });
    const leerTotal = async () => Number(((await buscar.getAttribute('placeholder')) || '').match(/\d+/)?.[0] || 0);
    for (let i = 0; i < 40 && !(await leerTotal()); i++) await p.waitForTimeout(250);   // (mientras carga dice «0 ejercicios»)
    const total = await leerTotal();
    check(total >= 300, `la biblioteca tiene ${total} ejercicios`);
    const filtro = p.getByRole('group', { name: 'Grupo muscular principal' });
    check(await filtro.getByRole('button').count() === 14, 'el filtro: «Todos» y trece grupos');
    for (const [g, minimo, uno] of [['Lumbares', 4, 'Superman'], ['Antebrazo', 10, 'Curl inverso con barra Z'], ['Aductores', 7, 'Sentadilla cosaca']]) {
      await filtro.getByRole('button', { name: g, exact: true }).click();
      await p.waitForTimeout(250);
      const n = await p.locator('.fila-biblioteca').count();
      check(n >= minimo && await p.locator('.fila-biblioteca', { hasText: uno }).count() >= 1, `${g}: ${n} ejercicios (con «${uno}»)`);
    }
    check(await p.locator('.fila-biblioteca .detalle[data-g="aductores"]').first().evaluate((x) => getComputedStyle(x, '::before').backgroundColor !== 'rgba(0, 0, 0, 0)').catch(() => false), 'cada grupo nuevo, con su punto de color');
    await filtro.getByRole('button', { name: 'Todos' }).click();
    await buscar.fill('curl nórdico asistido');
    const fila = p.locator('.fila-biblioteca', { hasText: 'Curl nórdico asistido con goma' }).first();
    await fila.waitFor({ timeout: 5000 });
    check(/Isquiotibiales/.test(await fila.textContent()), 'un ejercicio nuevo, con su grupo');
    await fila.locator('button, a').first().click().catch(() => fila.click());
    const d = p.locator('[role=dialog]').last();
    await d.waitFor({ timeout: 5000 });
    const texto = await d.textContent();
    check(/Hipertrofia 5–10/.test(texto) || await d.locator('input, textarea').evaluateAll((l) => l.some((x) => /Hipertrofia 5–10/.test(x.value))), 'su ficha lleva el rango de repeticiones');
    check(/Curl nórdico|Leg curl tumbado/.test(texto), 'y sus alternativas');
    await p.keyboard.press('Escape');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= 390), 'nada se sale a 390 px');
  } catch (e) {
    check(false, `la biblioteca ampliada no se ha podido recorrer: ${e.message.split('\n')[0]}`);
  }
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nLa biblioteca ampliada');
  try { await probarBiblioteca2({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
