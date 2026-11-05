// v0.66: modo gimnasio y «Bien hecho» del coach, en la demo, en un iPhone de Playwright. Lo llama e2e.test.mjs.
//   · Perfil → Este móvil → «Modo gimnasio»: en la sesión, las cifras y ✓ crecen (64 px) y cabe a 360 px en oscuro;
//   · el coach, en la Actividad de Ana, dice «Bien hecho» a un entreno con un toque: un mensaje en el hilo de esa sesión.
import { createRequire } from 'node:module';
import { devices } from 'playwright';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarV066({ navegador, check, base = 'http://localhost:4174' }) {
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

    // ---------------------------------------------------------------- modo gimnasio
    await p.evaluate(() => { location.hash = '#perfil'; });
    const sw = p.getByRole('switch', { name: /Modo gimnasio/ });
    await sw.scrollIntoViewIfNeeded();
    check(!(await sw.isChecked()) && !(await p.evaluate(() => document.documentElement.hasAttribute('data-gimnasio'))), '«Modo gimnasio» sale en Este móvil, apagado de serie');
    await sw.check();
    check(await esperar(() => document.documentElement.hasAttribute('data-gimnasio')) && await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes') || '{}').gimnasio === true),
      'al encenderlo, se aplica en el momento y se guarda en el móvil');
    await entrarSesion();
    const ej = p.locator('.sesion-vista .ejercicio').first();
    await abrir(ej);
    const medidas = await ej.locator('.serie').first().evaluate((f) => ({ celda: f.querySelector('.celda').getBoundingClientRect().height, hecho: f.querySelector('.hecho-btn').getBoundingClientRect().height }));
    check(Math.round(medidas.celda) === 64 && Math.round(medidas.hecho) === 64, `en la sesión, las cifras y ✓ más grandes (${Math.round(medidas.celda)} px)`);
    await revisar('gimnasio');
    check(await estrecho('gimnasio'), 'el modo gimnasio cabe a 360 px en oscuro');
    await p.locator('.sesion-vista .cabecera').getByRole('button', { name: 'Volver' }).click();
    await p.locator('nav.tabs').waitFor();

    // ---------------------------------------------------------------- «Bien hecho» del coach
    if (!(await p.getByRole('button', { name: 'Cambiar de cuenta' }).isVisible().catch(() => false))) await p.locator('.tab', { hasText: 'Hoy' }).first().click();
    await p.getByRole('button', { name: 'Cambiar de cuenta' }).first().click();
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await p.locator('.tab', { hasText: 'Atletas' }).click();
    await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
    await p.getByRole('tab', { name: 'Actividad' }).click();
    const kudos = p.locator('.actividad-kudos').first();
    await kudos.waitFor();
    const boton = p.getByRole('button', { name: /^Decirle «Bien hecho» por / }).first();
    check(await boton.count() === 1, 'en la Actividad, cada entreno terminado tiene «💪 Bien hecho»');
    const antes = await p.evaluate(() => (JSON.parse(localStorage.getItem('fbe-demo-v2')).comentarios || []).filter((c) => c.autor === 'coach' && /Bien hecho/.test(c.texto)).length);
    await boton.click();
    await p.locator('.toast', { hasText: '«Bien hecho» enviado a Ana' }).waitFor();
    const enviado = await esperar((n) => (JSON.parse(localStorage.getItem('fbe-demo-v2')).comentarios || []).filter((c) => c.autor === 'coach' && /^💪 ¡Bien hecho/.test(c.texto) && c.sesion_id).length === n + 1, antes);
    check(enviado && await p.locator('.actividad-kudos.hecho', { hasText: '«Bien hecho» enviado' }).count() >= 1,
      'un toque: le llega «💪 ¡Bien hecho…! He visto tu entreno.» en el hilo de esa sesión, y el botón pasa a «enviado»');
    await revisar('kudos');
    check(await estrecho('kudos'), '«Bien hecho» cabe a 360 px en oscuro');
  } catch (e) {
    check(false, `v0.66: ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-v066')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-066.png', import.meta.url).pathname }).catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}
