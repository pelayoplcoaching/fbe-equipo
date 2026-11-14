// El perfil del atleta, tanda 4, T2 (rama perfil-4), en la demo y en un móvil de 390 px:
//   · tu palmarés y tu historia de bloques (con su informe) y los logros secretos, en Logros
//   · la equivalencia del día, en Resumen
//   · tu trimestre, en Datos
//   Suelta:  npm run build && node test/e2e-perfil4-t2.mjs
import { pathToFileURL } from 'node:url';
import { entrarPerfil, axeEn } from './e2e-perfil4-t1.mjs';

export async function probarPerfil4T2({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid', bypassCSP: true });
  try {
    const p = await entrarPerfil(ctx, 'Iván Prieto', base, errores);
    const pest = p.locator('.perfil-pestanas');
    await pest.scrollIntoViewIfNeeded();
    // Resumen: la equivalencia
    const eq = p.locator('.equivalencia');
    await eq.waitFor({ timeout: 8000 }).catch(() => {});
    check(/^Este año has (levantado lo que pes|recorrido)/.test((await eq.textContent().catch(() => '')).trim()), `la equivalencia del día: «${(await eq.textContent().catch(() => '—')).trim()}»`);
    // Datos: el trimestre
    await pest.getByRole('tab', { name: /Datos|Estad/ }).click();
    const tri = p.locator('.trimestre');
    await tri.waitFor({ timeout: 8000 });
    check(/\d/.test(await tri.locator('.trimestre-cifras').textContent()) && /–/.test(await tri.locator('.seccion-cab').textContent()), `tu trimestre: ${(await tri.locator('.seccion-cab').textContent()).replace(/\s+/g, ' ').trim()}`);
    await axeEn(p, '.trimestre', errores, 'trimestre');
    // Logros: palmarés, bloques y secretos
    await pest.getByRole('tab', { name: 'Logros' }).click();
    const pal = p.locator('.palmares');
    await pal.waitFor({ timeout: 10000 });
    const piezas = await pal.locator('.palmares-pieza').count();
    check(piezas >= 2 && await pal.locator('.palmares-pieza[data-clave="records"]').count() === 1, `tu palmarés: ${piezas} piezas (con los récords)`);
    const sec = p.locator('.logros-secretos');
    await sec.waitFor({ timeout: 8000 });
    check(/de 8/.test(await sec.locator('.seccion-cab').textContent()) && await sec.locator('.secreto').count() >= 1, `logros secretos: ${(await sec.locator('.seccion-cab span').textContent()).trim()}, y los que quedan, ocultos`);
    const hb = p.locator('.historia-bloques');
    if (await hb.count()) {
      const b = hb.locator('.historia-bloque-btn').first();
      await b.scrollIntoViewIfNeeded();
      await b.click();
      check(await p.locator('[role=dialog]').last().isVisible({ timeout: 5000 }).catch(() => false), 'tu historia de bloques: cada bloque abre su informe');
      await p.keyboard.press('Escape');
    } else {
      const terminados = await p.evaluate(async () => { const B = globalThis.__fbeDemo; const iv = (await B.select('atletas', {})).find((x) => x.nombre === 'Iván Prieto'); return (await B.select('bloques', {})).filter((x) => x.atleta_id === iv?.id && !x.es_plantilla).length; });
      check(terminados <= 1, `sin bloques terminados en la demo (${terminados} bloque), la historia no sale`);
    }
    await axeEn(p, '.palmares', errores, 'palmares');
    await axeEn(p, '.logros-secretos', errores, 'secretos');
    if (process.env.FOTOS) { await pal.scrollIntoViewIfNeeded(); await p.screenshot({ path: `${process.env.FOTOS}/logros-t2.png`, fullPage: false }); }
    check(await p.evaluate(() => document.documentElement.scrollWidth <= 390), 'nada se sale a 390 px');
  } catch (e) {
    check(false, `la T2 del perfil no se ha podido recorrer: ${e.message.split('\n')[0]}`);
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
  console.log('\nEl perfil, tanda 4, T2');
  try { await probarPerfil4T2({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
