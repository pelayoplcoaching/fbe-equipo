// v0.64: «Máquina ocupada» y el orden de la sesión, de punta a punta en la demo, en un iPhone de Playwright (táctil y móvil).
// Lo llama e2e.test.mjs y se puede lanzar suelto (node test/e2e-sesion-064.mjs, con dist/). Un solo recorrido, sin gestos
// (arrastrar se prueba en logica) ni nada que dependa del tiempo:
//   · «Máquina ocupada · hacerlo luego»: el ejercicio pasa al final y «Ahora toca» (en el descanso que ya corría) lo sigue;
//   · «Cambiar el orden» con «Subir» (el camino sin arrastrar, para el teclado y el lector de pantalla);
//   · el coach ve «Hecho en otro orden»;
//   · 360 px en oscuro, sin fallos de accesibilidad.
import { createRequire } from 'node:module';
import { devices } from 'playwright';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarSesion064({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const esperar = async (f, arg, ms = 10000) => { try { await p.waitForFunction(f, arg, { timeout: ms }); return true; } catch { return false; } };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const sinNombre = await p.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const nombre = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
        const etiqueta = el.id && document.querySelector(`label[for="${el.id}"]`);
        return !nombre && !etiqueta && !el.closest('label');
      }).map((el) => el.outerHTML.slice(0, 90)));
    if (sinNombre.length) errores.push(`${paso}: controles sin nombre accesible: ${sinNombre.join(' | ')}`);
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
  // A 360 px en oscuro (sin animaciones) y de vuelta a 390
  const estrecho = async (paso) => {
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar(`${paso}-360-oscuro`);
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360
      && [...document.querySelectorAll('.ord-fila, .orden-real, .btn-luego')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
    return cabe;
  };
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const nombres = () => p.locator('.sesion-vista .ejercicio .ejercicio-cab .nombre').evaluateAll((xs) => xs.map((x) => x.textContent.replace(/^[A-Z]\d/, '').trim()));
  const nombreDe = async (ej) => (await ej.locator('.ejercicio-cab .nombre').textContent()).replace(/^[A-Z]\d/, '').trim();
  const abrir = async (ej) => {
    const cab = ej.locator('.ejercicio-cab');
    if (await cab.getAttribute('aria-expanded') !== 'true') await cab.click();
    await ej.locator('.ejercicio-cuerpo').waitFor();
  };
  const saltar = async () => { if (await p.locator('.temporizador').count()) { await p.locator('.temporizador').getByRole('button', { name: /^(Saltar|Cerrar)$/ }).first().click(); await hay(p.locator('.temporizador'), 0); } };
  const entrarSesion = async () => {
    await p.locator('.tab', { hasText: 'Hoy' }).click();
    await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).click();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor();
    if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    if (await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).count()) await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).click();
    await p.waitForTimeout(600);
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
  };

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    const cod = p.getByLabel('Código', { exact: true });
    await Promise.race([cod.waitFor({ timeout: 8000 }).catch(() => {}), p.locator('nav.tabs').waitFor()]);
    if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await entrarSesion();

    // ---------------------------------------------------------------- «Máquina ocupada · hacerlo luego», con el descanso en marcha
    const ej = p.locator('.sesion-vista .ejercicio').first();
    await abrir(ej);
    const primero = await nombreDe(ej);
    const antes = await nombres();
    await ej.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    await p.locator('.temporizador .ahora-toca').waitFor();
    const luego = ej.getByRole('button', { name: /^Máquina ocupada: hacer/ });
    await luego.scrollIntoViewIfNeeded();
    await luego.click();
    const toast = p.locator('.toast', { hasText: `${primero}, para luego` });
    await toast.waitFor();
    await esperar((n) => [...document.querySelectorAll('.sesion-vista .ejercicio .ejercicio-cab .nombre')].pop()?.textContent.replace(/^[A-Z]\d/, '').trim() === n, primero);
    const trasLuego = await nombres();
    const siguiente = antes[1];
    check(trasLuego[trasLuego.length - 1] === primero && trasLuego[0] === siguiente && trasLuego.length === antes.length,
      `«Máquina ocupada · hacerlo luego»: ${primero} pasa al final y toca ${siguiente}`);
    check(await esperar((n) => document.querySelector('.temporizador .ahora-nombre')?.textContent.replace(/^[A-Z]\d/, '').trim() === n, siguiente)
      && (await p.locator('.temporizador .ahora-etq').textContent()) === 'Siguiente ejercicio',
      '«Ahora toca», en el descanso que ya corría, sigue el orden nuevo');
    check(await esperar((n) => { const k = Object.keys(localStorage).find((x) => x.startsWith('fbe-en-curso-')); const x = k && JSON.parse(localStorage.getItem(k)); return !!x && x.ejercicio === n && (x.descanso?.aviso || x.descanso?.texto || '').includes(n); }, siguiente),
      'y la píldora y la pantalla de bloqueo (el texto del descanso) también');
    await saltar();

    // ---------------------------------------------------------------- «Cambiar el orden» sin arrastrar (Subir / Bajar)
    const prim = p.locator('.sesion-vista .ejercicio').first();
    await abrir(prim);
    await prim.getByRole('button', { name: /^Más herramientas/ }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Cambiar el orden' }).click();
    const hoja = p.getByRole('dialog', { name: 'Cambiar el orden' });
    await hoja.waitFor();
    const filasO = hoja.locator('.ord-fila');
    const n2 = (await filasO.nth(1).locator('.ord-nombre').textContent()).trim();
    check(await filasO.count() >= 3 && /Empezado/.test(await filasO.last().textContent()) && await filasO.last().locator('.ord-nombre', { hasText: primero }).count() === 1
      && await filasO.first().locator('.ord-subir[aria-disabled="true"]').count() === 1,
      'la hoja «Cambiar el orden»: lo que queda (lo empezado, al final, donde se dejó), con «Subir» y «Bajar» en cada fila');
    await revisar('cambiar-orden');
    check(await estrecho('cambiar-orden'), 'la hoja cabe a 360 px en oscuro');
    await filasO.nth(1).getByRole('button', { name: /^Subir / }).click();
    check(await esperar((n) => document.querySelector('.ord-fila .ord-nombre')?.textContent.trim() === n, n2) && /ahora el primero de/.test(await hoja.locator('[aria-live]').textContent())
      && await p.evaluate(() => document.activeElement?.closest('.ord-fila') === document.querySelector('.ord-fila')),
      `«Subir» (sin arrastrar): ${n2} pasa a ser el primero, se anuncia y el foco va con la fila`);
    await hoja.getByRole('button', { name: 'Listo' }).click();
    await hay(hoja, 0);
    const trasSubir = await nombres();
    const yNombre = trasSubir[0], xNombre = trasSubir[1];
    check(xNombre === trasLuego[0] && await esperar((n) => document.querySelector('.sesion-vista .ejercicio.en-curso .nombre')?.textContent.replace(/^[A-Z]\d/, '').trim() === n, yNombre),
      'la sesión sigue el orden nuevo: lo que toca ahora es el que se ha subido');
    // Una serie de cada uno, en el orden nuevo (para que el coach lo vea)
    for (const nombre of [yNombre, xNombre]) {
      const x = p.locator('.sesion-vista .ejercicio').filter({ has: p.locator('.ejercicio-cab .nombre', { hasText: nombre }) }).first();
      await abrir(x);
      await x.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).first().click();
      await x.getByRole('button', { name: 'Quitar la serie 1' }).first().waitFor();
      await saltar();
    }

    // ---------------------------------------------------------------- el coach ve «Hecho en otro orden»
    await p.locator('.sesion-vista .cabecera').getByRole('button', { name: 'Volver' }).click();
    await p.locator('nav.tabs').waitFor();
    if (!(await p.getByRole('button', { name: 'Cambiar de cuenta' }).isVisible().catch(() => false))) await p.locator('.tab', { hasText: 'Hoy' }).first().click();
    await p.getByRole('button', { name: 'Cambiar de cuenta' }).first().click();
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await p.locator('.tab', { hasText: 'Atletas' }).click();
    await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
    await p.getByRole('tab', { name: 'Registro' }).click();
    const orden = p.locator('.orden-real').first();
    await orden.waitFor();
    const lista = (await orden.locator('li').allTextContents()).map((t) => t.replace(/^[A-Z]\d /, '').trim());
    const iY = lista.findIndex((t) => t.includes(yNombre)), iX = lista.findIndex((t) => t.includes(xNombre));
    check((await orden.textContent()).includes('Hecho en otro orden') && lista.length === 3 && lista[0].includes(primero) && iY === 1 && iX === 2,
      `el coach ve «Hecho en otro orden» con el orden de verdad (${lista.join(' → ')}), sacado de la hora de cada serie`);
    await orden.scrollIntoViewIfNeeded();
    await revisar('coach-orden');
    check(await estrecho('coach-orden'), '«Hecho en otro orden» cabe a 360 px en oscuro');
  } catch (e) {
    check(false, `la sesión de la v0.64: ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-sesion-064')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-064.png', import.meta.url).pathname }).catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}

// Suelto: node test/e2e-sesion-064.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarSesion064({ navegador, check });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
