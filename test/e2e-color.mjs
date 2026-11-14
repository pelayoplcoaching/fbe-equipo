// La tanda de color (claude/color-mejoras.md), en la demo y en un móvil simulado: la tarjeta del día con su tono y su
// degradado, los iconos a dos tintas, los ocho acentos (Océano), el alto contraste, la ayuda para daltonismo, la barra
// del sistema y la página «Paleta» (?demo&paleta). La paleta y el contraste, en test/color.test.mjs.
//   Suelta:  npm run build && node test/e2e-color.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarColor } = await import('./e2e-color.mjs'); await probarColor({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';
import * as P from '../web/src/logica/paleta.js';

export async function probarColor({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, colorScheme: 'light' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      if (!(await p.locator('[role=dialog]').last().isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const varRaiz = (n) => p.evaluate((x) => getComputedStyle(document.documentElement).getPropertyValue(x).trim().toUpperCase(), n);
  const colorDe = (sel, prop) => p.evaluate(([s, pr]) => { const el = document.querySelector(s); if (!el) return null; const c = document.createElement('canvas').getContext('2d'); c.fillStyle = getComputedStyle(el)[pr]; return c.fillStyle.toUpperCase(); }, [sel, prop]);

  try {
    // --- La paleta, de un vistazo (solo en la demo) ---
    await p.goto(`${base}/?demo&paleta`);
    await p.getByRole('heading', { name: 'Paleta de FBE Equipo' }).waitFor();
    check(await p.locator('.pal-escala').count() === 11 && await p.locator('.pal-escala').first().locator('.pal-muestra').count() === 11, '«Paleta» (?demo&paleta): las diez escalas de 50 a 950 y la noche');
    check(await p.locator('.pal-estado').count() === 4 && await p.locator('.pal-grad').count() === 4 && await p.locator('.pal-acento').count() === 8, 'los cuatro estados, los cuatro degradados y los ocho acentos');
    check(await varRaiz('--marca-600') === P.ESCALAS.marca[600] && await varRaiz('--tiza') !== '' && (await colorDe('body', 'backgroundColor')) !== null, 'las primitivas y los tokens de color.css están en la página');

    // --- La app ---
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia').waitFor();
    await fueraAvisos();
    const tono = await p.locator('.hero-dia').first().getAttribute('data-tono');
    check(['fuerza', 'cardio', 'movilidad', 'descarga', 'descanso', 'hecha'].includes(tono), `la tarjeta del día lleva el tono de lo que toca (${tono})`);
    const fondoHero = await p.evaluate(() => getComputedStyle(document.querySelector('.hero-dia')).backgroundImage);
    check(/gradient/.test(fondoHero), 'y el degradado Noche FBE');
    check(await colorDe('body', 'color') !== null && await varRaiz('--tinta') === P.valor('claro', 'tinta'), `el texto, en la tinta de la paleta (${P.valor('claro', 'tinta')})`);
    check(await p.evaluate(() => document.querySelector('meta[name="theme-color"][media*="light"]')?.content) === P.valor('claro', 'tiza'), 'la barra del sistema, del color exacto del fondo');

    // --- En Perfil (ajustes de este móvil): Océano, alto contraste y daltonismo ---
    await irASeccion(p, 'Perfil');
    await p.locator('.acento-op').first().waitFor();
    check(await p.locator('.acento-op').count() === 8, 'ocho acentos para elegir');
    await p.locator('.acento-op', { hasText: 'Océano' }).click();
    const oceano = P.ACENTOS.find((a) => a.id === 'oceano').claro.morado;
    check(await varRaiz('--morado') === oceano, `Océano: el acento pasa a ${oceano}`);
    const contraste = p.getByRole('switch', { name: /Alto contraste/ });
    await contraste.click();
    check(await p.evaluate(() => document.documentElement.getAttribute('data-contraste')) === 'alto' && await varRaiz('--tinta-2') === P.ALTO_CONTRASTE.claro['tinta-2'], 'alto contraste: los textos, al máximo');
    await contraste.click();
    check(await p.evaluate(() => !document.documentElement.hasAttribute('data-contraste')) && await varRaiz('--tinta-2') === P.valor('claro', 'tinta-2'), 'y al quitarlo, vuelven');
    const dalt = p.getByRole('switch', { name: /Ayuda para daltonismo/ });
    await dalt.click();
    check(await varRaiz('--ok') === P.DALTONISMO.claro.ok && await varRaiz('--alerta') === P.DALTONISMO.claro.alerta, 'daltonismo: lo hecho en azul y lo que falla en naranja');
    await dalt.click();
    await p.locator('.acento-op', { hasText: 'Morado FBE' }).click();
    check(await varRaiz('--morado') === P.ACENTOS[0].claro.morado && await varRaiz('--ok') === P.valor('claro', 'ok'), 'y todo vuelve a lo de serie');
    await p.keyboard.press('Escape');
    // los iconos a dos tintas
    const duo = await p.locator('.ios-ico .icono-duo').count();
    check(duo > 0, `los iconos de las listas, a dos tintas (${duo})`);

    // --- En oscuro ---
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.waitForTimeout(200);
    check(await varRaiz('--tiza') === P.valor('oscuro', 'tiza') && await varRaiz('--tinta') === P.valor('oscuro', 'tinta'), 'en oscuro, la noche y el texto hueso de la paleta');
    check(/inset/i.test(await varRaiz('--sombra')), 'y la profundidad, con un filo de luz');
  } catch (e) {
    check(false, `Color: ${e.message.split('\n')[0]}`);
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
  console.log('\nColor');
  try { await probarColor({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
