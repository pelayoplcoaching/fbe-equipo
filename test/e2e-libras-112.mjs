// v0.112: kilos o libras para las cargas, en la demo, en un iPhone de Playwright. Lo llama e2e.test.mjs.
//   · Perfil → Este móvil → «Unidad de las cargas»: libras;
//   · en la sesión, 135 lb se guardan como 61,23 kg y se siguen viendo como 135; la serie siguiente propone en libras; el teclado
//     dice «Libras» y sube de 5 en 5; cabe a 360 px en oscuro;
//   · de vuelta a kilos, la misma serie es 61,23 kg.
import { createRequire } from 'node:module';
import { devices } from 'playwright';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarLibras112({ navegador, check, base = 'http://localhost:4174' }) {
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
      && [...document.querySelectorAll('.serie, .actividad-kudos')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
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

    // ---------------------------------------------------------------- el ajuste
    await p.evaluate(() => { location.hash = '#perfil'; });
    const grupo = p.getByRole('group', { name: 'Unidad de las cargas' });
    await grupo.scrollIntoViewIfNeeded();
    check(await grupo.getByRole('button', { name: 'Kilos (kg)' }).getAttribute('aria-pressed') === 'true', '«Unidad de las cargas» sale en Este móvil, en kilos de serie');
    await grupo.getByRole('button', { name: 'Libras (lb)' }).click();
    check(await esperar(() => JSON.parse(localStorage.getItem('fbe-ajustes') || '{}').unidadPeso === 'lb'), 'al elegir libras, se guarda en el móvil');
    await revisar('ajuste-libras');

    // ---------------------------------------------------------------- la sesión en libras
    await entrarSesion();
    const ej = p.locator('.sesion-vista .ejercicio').first();
    await abrir(ej);
    check((await ej.locator('.series-cab').textContent()).includes('Lb'), 'la cabecera de las series dice «Lb»');
    const kg1 = ej.locator('.serie[data-n="1"] .celda-kg input');
    await kg1.fill('135');
    await ej.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    await ej.getByRole('button', { name: 'Quitar la serie 1' }).waitFor();
    const guardada = await esperar(() => (JSON.parse(localStorage.getItem('fbe-demo-v2')).series || []).some((s) => s.numero === 1 && Number(s.kg) === 61.23));
    check(guardada, '135 lb se guardan como 61,23 kg (la base y el coach, en kilos)');
    check(await kg1.inputValue() === '135', 'y la serie hecha se sigue viendo en libras: 135');
    await saltar();
    const kg2 = ej.locator('.serie[data-n="2"] .celda-kg input');
    // (en la demo, el primero de Ana es top + back-off: la back-off sale de la top de 135 lb, redondeada a lo que se carga en libras)
    const ph2 = Number(String(await kg2.getAttribute('placeholder')).replace(',', '.'));
    const conTop = /−10 %/.test(await ej.locator('.ejercicio-cab').textContent());
    check(conTop ? ph2 === 125 : ph2 === 135, `la serie siguiente propone en libras y redondeado a lo que se carga (${ph2} lb${conTop ? ', la back-off de 135' : ''})`);
    await kg2.click();
    const tec = p.locator('.teclado-serie');
    await tec.waitFor();
    check((await tec.locator('.teclado-titulo strong').textContent()) === 'Libras' && await tec.getByRole('button', { name: 'Añadir 5 libras' }).count() === 1
      && await tec.getByRole('button', { name: /^Tu disco más pequeño/ }).count() === 0,
      'el teclado de la app dice «Libras», sube de 5 en 5 y no pregunta el disco más pequeño (los de libras)');
    await tec.getByRole('button', { name: 'Añadir 5 libras' }).click();
    check(await kg2.inputValue() === String(ph2 + 5), `+5 sobre lo propuesto: ${ph2 + 5}`);
    await revisar('sesion-libras');
    check(await estrecho('sesion-libras'), 'la sesión en libras cabe a 360 px en oscuro');
    await tec.getByRole('button', { name: 'Ocultar el teclado' }).click().catch(() => {});
    await p.locator('.sesion-vista .cabecera').getByRole('button', { name: 'Volver' }).click();
    await p.locator('nav.tabs').waitFor();

    // ---------------------------------------------------------------- de vuelta a kilos
    await p.evaluate(() => { location.hash = '#perfil'; });
    await p.getByRole('group', { name: 'Unidad de las cargas' }).getByRole('button', { name: 'Kilos (kg)' }).click();
    await entrarSesion();
    const ejK = p.locator('.sesion-vista .ejercicio').first();
    await abrir(ejK);
    check((await ejK.locator('.series-cab').textContent()).includes('Kg') && await ejK.locator('.serie[data-n="1"] .celda-kg input').inputValue() === '61,23',
      'de vuelta a kilos, la misma serie: 61,23 kg');
  } catch (e) {
    check(false, `v0.112: ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-libras-112')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-112.png', import.meta.url).pathname }).catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}

// Suelto: node test/e2e-libras-112.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarLibras112({ navegador, check });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
