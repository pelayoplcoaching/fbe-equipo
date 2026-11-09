// v0.67: «Revisión semanal» del coach, en la demo, en un iPhone de Playwright. Lo llama e2e.test.mjs.
//   · la pestaña con todos los atletas, «0 de N revisados», Pendientes / Hechos, lo que pide atención y los tres botones;
//   · marcar a uno y su nota (se guardan: siguen al volver a abrir), y «Programar» abre su ficha en Programa;
//   · 360 px en oscuro, sin fallos de accesibilidad.
import { createRequire } from 'node:module';
import { devices } from 'playwright';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRevision067({ navegador, check, base = 'http://localhost:4174' }) {
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
      && [...document.querySelectorAll('.revision-fila, .revision-acciones .btn')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
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
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    const tab = p.locator('nav.tabs .tab', { hasText: 'Revisión semanal' });
    check(await tab.count() === 1, 'el coach tiene la pestaña «Revisión semanal»');
    await tab.click();
    const vista = p.locator('.revision');
    await vista.locator('.revision-fila').first().waitFor();
    const n = await vista.locator('.revision-fila').count();
    check(/^Revisión semanal$/.test((await vista.locator('h1').textContent()).trim()) && /^Semana del \d/.test((await vista.locator('.sub').textContent()).trim())
      && (await vista.locator('.revision-progreso strong').textContent()).trim() === `0 de ${n} revisados` && await vista.getByRole('button', { name: `Pendientes (${n})` }).count() === 1,
      `todos los atletas en la lista de la semana: «0 de ${n} revisados» y «Pendientes (${n})»`);
    const fila = vista.locator('.revision-fila').first();
    const nombre = (await fila.locator('.revision-quien strong').textContent()).trim();
    check(await fila.locator('.avatar').count() === 1 && /sesiones esta semana|Solo nutrición/.test(await fila.locator('.revision-quien').textContent())
      && (await fila.locator('.revision-acciones .btn').allTextContents()).map((t) => t.trim()).join() === 'Chat,Programar,Seguimiento,Redactar mensaje,Mandar una tarea' && await fila.locator('.revision-avisos li').count() >= 1,
      `cada atleta con su foto o iniciales, sus sesiones de la semana, lo que pide atención y Chat, Programar, Seguimiento, Redactar mensaje y Mandar una tarea (${nombre})`);
    await revisar('revision');
    check(await estrecho('revision'), '«Revisión semanal» cabe a 360 px en oscuro');
    // Marcar al primero y dejarle una nota
    await fila.getByRole('button', { name: 'Añadir nota' }).click();
    const nota = fila.locator('textarea');
    await nota.fill('Subir 2,5 kg en sentadilla');
    await nota.blur();
    // (con un clic: en «Pendientes», al marcarlo se va de la lista)
    await fila.getByRole('checkbox', { name: `Revisión de ${nombre} terminada` }).click();
    await esperar((t) => document.querySelector('.revision-progreso strong')?.textContent.trim() === t, `1 de ${n} revisados`);
    check(await vista.getByRole('button', { name: `Pendientes (${n - 1})` }).count() === 1 && await vista.locator('.revision-fila', { hasText: nombre }).count() === 0 && await p.locator('.toast', { hasText: `${nombre.split(' ')[0]}, revisado` }).getByRole('button', { name: 'Deshacer' }).count() === 1,
      'al marcarlo: «1 de N revisados», sale de Pendientes y avisa con «Deshacer»');
    await vista.getByRole('button', { name: 'Hechos (1)' }).click();
    const hecho = vista.locator('.revision-fila.hecha', { hasText: nombre });
    check(await hecho.count() === 1 && await hecho.locator('textarea').inputValue() === 'Subir 2,5 kg en sentadilla', 'en Hechos, con su nota');
    // Se guarda: al volver a abrir, sigue igual (la demo guarda en el navegador 150 ms después del último cambio)
    await p.waitForTimeout(500);
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await p.locator('nav.tabs .tab', { hasText: 'Revisión semanal' }).click();
    await vista.locator('.revision-progreso strong').waitFor();
    await esperar((t) => document.querySelector('.revision-progreso strong')?.textContent.trim() === t, `1 de ${n} revisados`);
    await vista.getByRole('button', { name: 'Hechos (1)' }).click();
    check(await vista.locator('.revision-fila.hecha', { hasText: nombre }).locator('textarea').inputValue() === 'Subir 2,5 kg en sentadilla', 'se guarda: al volver a abrir la app, sigue revisado y con su nota');
    // «Programar» abre su ficha en Programa
    await vista.locator('.revision-fila', { hasText: nombre }).getByRole('button', { name: 'Programar' }).click();
    await p.getByRole('tab', { name: 'Programa', selected: true }).waitFor();
    check(await p.getByRole('tab', { name: 'Programa', selected: true }).count() === 1, '«Programar» abre su ficha en Programa');
  } catch (e) {
    check(false, `v0.67: ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-revision-067')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-067.png', import.meta.url).pathname }).catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}
