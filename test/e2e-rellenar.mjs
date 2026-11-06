// «Rellenar la semana» del menú, en la demo: el coach abre el menú de una atleta, pasa a la semana que viene, pide la
// propuesta (variada y «cocinar para dos días»), cambia y quita comidas, pide otra propuesta, la apunta y ve el menú
// relleno y la lista de la compra; después la atleta, en el móvil y en oscuro, rellena lo que queda de su semana desde hoy.
// Sin errores de consola, sin desbordes y sin fallos de accesibilidad.
// Necesita el botón enganchado en ComidasComun.jsx: test/rellenar-enganche.patch.
//   Suelta:  npm run build && node test/e2e-rellenar.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarRellenar } = await import('./e2e-rellenar.mjs'); await probarRellenar({ navegador, check });
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRellenar({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const foto = async (nombre) => { if (capturas) await p.screenshot({ path: `${capturas}/${nombre}.png` }); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 1280;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const fuera = await p.evaluate((w) => [...document.querySelectorAll('[role=dialog] .btn, [role=dialog] .btn-texto, [role=dialog] .segmentos, [role=dialog] .toma-dia')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > w + 1); }).length, vista);
    if (fuera) errores.push(`${paso}: ${fuera} elementos de la hoja se salen de la pantalla`);
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ]));
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
  }
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir', 'Empezar']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const hoja = () => p.getByRole('dialog', { name: 'Rellenar la semana' });
  const filas = () => hoja().locator('.toma-dia');
  const nombres = () => hoja().locator('.toma-dia > span').allTextContents();
  const botonApuntar = () => hoja().getByRole('button', { name: /^Apuntar \d+ comidas?$/ });

  try {
    // El coach, desde la ficha de Lucía (solo nutrición; algunos días sin merienda)
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Lucía Ferrer' }).first().click();
    await p.getByRole('tab', { name: 'Nutrición' }).click();
    await p.getByRole('tab', { name: 'Su menú' }).click();
    await p.locator('.menu-semana').waitFor();
    await p.getByRole('button', { name: 'Semana siguiente' }).click();
    await p.locator('.nav-semana', { hasText: 'La semana que viene' }).waitFor();
    const boton = p.getByRole('button', { name: 'Rellenar la semana' });
    check(await boton.count() === 1, 'en el menú de la semana hay un botón «Rellenar la semana»');
    await boton.click();
    await filas().first().waitFor();
    check(await filas().count() === 28 && await hoja().locator('section.panel').count() === 7, 'propone la semana que viene entera: 28 comidas en 7 días');
    check(/28 comidas: \d+ recetas distintas, 14 veces de cocinar comidas y cenas/.test(await hoja().textContent()), 'con su resumen: recetas distintas y veces de cocinar');
    check(/lo que ya está apuntado se queda como está/.test(await hoja().textContent()) && /de su recetario/.test(await hoja().textContent()), 'dice que respeta lo ya apuntado (y al coach le habla del recetario del atleta)');
    check((await hoja().locator('section.panel').first().textContent()).includes('kcal'), 'cada día, con sus kcal');
    await revisar('propuesta');
    await foto('rellenar-1-propuesta');

    // Cocinar para dos días
    await hoja().getByRole('group', { name: 'Cómo repartir comidas y cenas' }).getByRole('button', { name: 'Cocinar para dos días' }).click();
    check(await hay(hoja().locator('.toma-dia', { hasText: 'la misma que el día anterior' }), 6), '«Cocinar para dos días»: seis comidas repiten la del día anterior');
    check(/8 veces de cocinar/.test(await hoja().textContent()), 'y se cocina 8 veces en vez de 14');
    await hoja().getByRole('group', { name: 'Cómo repartir comidas y cenas' }).getByRole('button', { name: 'Variada' }).click();
    check(await hay(hoja().locator('.toma-dia', { hasText: 'la misma que el día anterior' }), 0), 'de vuelta a «Variada», ninguna repite');

    // Cambiar, quitar y otra propuesta
    const antes = await nombres();
    await hoja().getByRole('button', { name: /^Cambiar comida/ }).first().click();
    const tras = await nombres();
    check(tras.length === 28 && tras.filter((x, i) => x !== antes[i]).length === 1, '«Cambiar» pone otra receta en esa comida y deja las demás');
    await hoja().getByRole('button', { name: /^Quitar cena/ }).first().click();
    check(await hay(filas(), 27) && await botonApuntar().textContent().then((t) => /Apuntar 27 comidas/.test(t)), '«Quitar» la saca de la propuesta: quedan 27');
    await hoja().getByRole('button', { name: 'Otra propuesta' }).click();
    await p.waitForTimeout(200);
    const otra = await nombres();
    check(otra.length === 28 && otra.filter((x, i) => x !== tras[i]).length >= 5, '«Otra propuesta» vuelve a las 28 con otras recetas');
    await revisar('cambios');

    // Apuntar
    await hoja().getByRole('button', { name: /^Quitar cena/ }).first().click();
    await hay(filas(), 27);
    await botonApuntar().click();
    await p.locator('.toast', { hasText: '27 comidas apuntadas en el menú' }).waitFor();
    check(await hay(hoja(), 0), 'al apuntar, avisa y cierra');
    await p.locator('.menu-semana .entrada-menu').first().waitFor();
    check(await p.locator('.menu-semana .entrada-menu').count() >= 3, 'el menú de la semana ya tiene comidas');
    const enBase = await p.evaluate(async () => {
      const b = globalThis.__fbeDemo; const hoy = new Date(); const d = (hoy.getDay() + 6) % 7; const l = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - d + 7);
      const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      const fin = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 6);
      const filas = await b.select('menu_comidas', { gte: { fecha: iso(l) }, lte: { fecha: iso(fin) } });
      return { n: filas.length, conReceta: filas.filter((f) => f.receta_id && f.kcal > 0).length, atletas: new Set(filas.map((f) => f.atleta_id)).size };
    });
    check(enBase.n === 27 && enBase.conReceta === 27 && enBase.atletas === 1, 'en la base: 27 comidas de la semana que viene, con su receta y sus macros');
    check(!(await p.getByRole('button', { name: 'Lista de la compra' }).isDisabled()), 'y la lista de la compra ya se puede abrir');
    // Volver a rellenar: solo el hueco que quedó
    await boton.click();
    await filas().first().waitFor();
    check(await filas().count() === 1 && /Apuntar 1 comida/.test(await botonApuntar().textContent()), 'al volver a rellenar solo propone el hueco que quedó (la cena quitada)');
    await botonApuntar().click();
    await p.locator('.toast', { hasText: '1 comida apuntada en el menú' }).waitFor();
    await boton.click();
    check(await hay(hoja().locator('.vacio', { hasText: 'Esta semana ya está completa' }), 1), 'y con la semana completa lo dice, sin nada que apuntar');
    check(await botonApuntar().count() === 0 || await hoja().getByRole('button', { name: /Apuntar/ }).isDisabled(), 'con el botón de apuntar apagado');
    await revisar('completa');
    await foto('rellenar-2-completa');
    await hoja().getByRole('button', { name: 'Cancelar' }).click();
    check(await hay(hoja(), 0), '«Cancelar» cierra sin tocar nada');

    // La atleta, en el móvil y en oscuro: lo que queda de su semana, desde hoy
    await p.setViewportSize({ width: 360, height: 760 });
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.getByRole('button', { name: 'Volver a atletas' }).click();
    await p.getByRole('button', { name: 'Cambiar de cuenta' }).first().click();
    await p.getByRole('button', { name: /Lucía Ferrer/ }).click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await irASeccion(p, 'Comidas');
    await p.getByRole('tab', { name: 'Tu semana' }).click();
    await p.locator('.menu-semana').waitFor();
    await p.getByRole('button', { name: 'Semana siguiente' }).click();
    await p.getByRole('button', { name: 'Semana siguiente' }).click();
    await p.getByRole('button', { name: 'Rellenar la semana' }).click();
    await filas().first().waitFor();
    check(await filas().count() === 28 && /de tu recetario/.test(await hoja().textContent()), 'la atleta también lo tiene, y le habla de su recetario');
    check(!/revisa el factor/.test(await hoja().textContent()), 'a la atleta no se le habla de factores ni de descuadres');
    await revisar('movil');
    await foto('rellenar-3-movil');
    await hoja().getByRole('group', { name: 'Cómo repartir comidas y cenas' }).getByRole('button', { name: 'Cocinar para dos días' }).click();
    await hay(hoja().locator('.toma-dia', { hasText: 'la misma que el día anterior' }), 6);
    await botonApuntar().click();
    await p.locator('.toast', { hasText: '28 comidas apuntadas en el menú' }).waitFor();
    await p.locator('.menu-semana .entrada-menu').first().waitFor();
    check(await p.locator('.menu-semana .entrada-menu').count() >= 3, 'y su menú queda relleno');
    check(errores.length === 0, `sin errores de consola, desbordes ni fallos de accesibilidad${errores.length ? `: ${errores.slice(0, 4).join(' ## ')}` : ''}`);
  } catch (e) {
    await foto('rellenar-error');
    check(false, `Rellenar la semana: ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  } finally {
    await ctx.close();
  }
}

// Suelta
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4177);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Rellenar la semana');
  await probarRellenar({ navegador, check, base: 'http://localhost:4177', capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
