// (v0.185) El editor manual, segunda tanda, en la demo: rehacer, la duración de cada sesión, «Qué cambia respecto a la
// semana anterior», la revisión antes de publicar, cambiar varios ejercicios a la vez, el historial de un ejercicio,
// moverlo a otra sesión, llevar un cambio a las semanas siguientes, las notas frecuentes, las sesiones guardadas y el
// buscador con los recientes y los del bloque. En escritorio y a 390 px en oscuro, sin errores de consola, sin
// desbordes y sin fallos de accesibilidad.
//   Suelta:  npm run build && node test/e2e-editor-185.mjs
//   Dentro de e2e.test.mjs:  const { probarEditor185 } = await import('./e2e-editor-185.mjs'); await probarEditor185({ navegador, check });
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarEditor185({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
  const errores = [];
  let p = null;
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(120); } return !!(await fn().catch(() => false)); };
  const foto = async (nombre) => { if (capturas) await p.screenshot({ path: `${capturas}/${nombre}.png` }); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 1280;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
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
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  async function abrir(ctx) {
    p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().click();
    await p.getByRole('tab', { name: /Programa/ }).first().click();
    await p.locator('.semanas-tabs').waitFor();
    await p.locator('section.editor-sesion').first().waitFor();
  }
  const sesion = () => p.locator('section.editor-sesion').first();
  const filas = () => sesion().locator('table.tabla-pauta > tbody > tr[data-fila]');
  const fila = (i) => filas().nth(i);
  const nombreDe = async (i) => (await fila(i).locator('.btn-ejercicio').textContent()).trim();
  const guardado = () => hasta(async () => (await p.locator('.guardado').first().textContent()).trim() === 'Guardado');
  const deshacer = () => p.getByRole('button', { name: 'Deshacer', exact: true });
  const kg = (i) => fila(i).locator('td[data-col="Kilos"] input');

  const sesiones = () => p.locator('section.editor-sesion');
  const menu = (loc, valor) => loc.selectOption(valor);
  const mas = (i) => fila(i).locator('select.mas-ejercicio');
  const semanaTab = (n) => p.locator('.semanas-tabs button', { hasText: new RegExp(`^S${n}`) }).first();
  const rehacer = () => p.getByRole('button', { name: 'Rehacer', exact: true });

  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true });
  try {
    await abrir(ctx);
    const n0 = await filas().count();
    const primero = await nombreDe(0);
    const nombreSesion = await sesion().locator('input[aria-label="Nombre de la sesión"]').inputValue();
    const semanaN = Number((await p.locator('.semanas-tabs button[aria-pressed="true"]').first().textContent()).match(/S(\d+)/)[1]);

    // --- rehacer
    const antes = await kg(0).inputValue();
    check(await rehacer().isDisabled(), 'al abrir no hay nada que rehacer');
    await fila(0).getByRole('button', { name: /^Más kilos en / }).click();
    await guardado();
    const subido = await kg(0).inputValue();
    await deshacer().click();
    await hasta(async () => (await kg(0).inputValue()) === antes);
    check(!(await rehacer().isDisabled()) && /^Rehacer: Kilos de /.test(await rehacer().getAttribute('title')), 'tras deshacer, «Rehacer» dice qué va a rehacer');
    await p.waitForTimeout(300);
    await rehacer().click();
    check(await hasta(async () => (await kg(0).inputValue()) === subido) && await rehacer().isDisabled(), 'rehacer vuelve a poner el cambio');
    await p.waitForTimeout(300);
    await deshacer().click();
    await hasta(async () => (await kg(0).inputValue()) === antes);

    // --- duración y qué cambia
    check(/unos \d+ min/.test(await sesion().locator('.duracion-sesion').textContent()), 'cada sesión dice lo que dura, a ojo');
    const resumen = (await p.locator('details.cambios-semana > summary').textContent()).trim();
    await p.locator('details.cambios-semana > summary').click();
    const lineas = await p.locator('details.cambios-semana .lista-cambios li').allTextContents();
    check(new RegExp(`^Qué cambia respecto a la semana ${semanaN - 1} \\(\\d+\\)$`).test(resumen) && lineas.length >= 1 && lineas.some((t) => /\d → \d.* kg/.test(t)), `«Qué cambia respecto a la semana anterior» lo resume en una lista (${lineas.length}: ${lineas[0]})`);
    await revisar('qué cambia');

    // --- revisar antes de publicar
    await kg(0).fill('95');
    await kg(0).press('Tab');
    await guardado();
    await p.getByRole('button', { name: 'Publicar al atleta' }).click();
    const rev = p.getByRole('dialog').last();
    await rev.locator('.lista-avisos li').first().waitFor();
    const tr = (await rev.textContent()).replace(/\s+/g, ' ');
    check(new RegExp(`Antes de publicar la semana ${semanaN}`).test(tr) && tr.includes(primero) && /a 95 kg \(\+\d+ %\)/.test(tr), 'al publicar, avisa de un salto de kilos que parece un despiste');
    await revisar('antes de publicar');
    await foto('editor185-publicar');
    await rev.getByRole('button', { name: 'Volver al editor' }).click();
    await hay(p.getByRole('dialog'), 0);
    check((await p.locator('.semanas-tabs button[aria-pressed="true"]').first().textContent()).includes('Borrador'), 'y «Volver al editor» no publica nada');
    await deshacer().click();
    await hasta(async () => (await kg(0).inputValue()) === antes);

    // --- cambiar varios a la vez
    await p.waitForTimeout(300);
    const descansos = () => filas().locator('select[aria-label="Descanso"]').evaluateAll((ss) => ss.map((x) => x.value));
    const d0 = await descansos();
    await menu(sesion().locator('select.menu-sesion'), 'varios');
    const varios = p.getByRole('dialog').last();
    await varios.locator('.varios-fila').first().waitFor();
    await varios.locator('label.campo', { hasText: 'Descanso' }).locator('select').selectOption('240');
    await revisar('cambiar varios');
    await foto('editor185-varios');
    await varios.getByRole('button', { name: /^Cambiar \d+ ejercicios$/ }).click();
    check(await hasta(async () => (await descansos()).every((v) => v === '240')), 'varios ejercicios cambian de descanso de una vez');
    await p.waitForTimeout(300);
    await deshacer().click();
    check(await hasta(async () => JSON.stringify(await descansos()) === JSON.stringify(d0)), 'y se deshace en un solo paso');

    // --- historial
    await p.waitForTimeout(300);
    await menu(mas(0), 'historial');
    const hist = p.getByRole('dialog').last();
    await hist.locator('.historial-editor li').first().waitFor();
    const th = (await hist.textContent()).replace(/\s+/g, ' ');
    check(th.includes(`Historial de ${primero}`) && /\d kg × \d+ reps/.test(th) && /1RM estimado: \d/.test(th), 'el historial del ejercicio, sin salir del editor: lo que hizo cada día y su 1RM estimado');
    await revisar('historial');
    await p.keyboard.press('Escape');
    await hay(p.getByRole('dialog'), 0);

    // --- mover a otra sesión (y volver)
    const s2 = sesiones().nth(1);
    const n2 = await s2.locator('table.tabla-pauta > tbody > tr[data-fila]').count();
    const ultimoNombre = await nombreDe(n0 - 1);
    const destino = await mas(n0 - 1).locator('option', { hasText: /^Mover a / }).first().getAttribute('value');
    await menu(mas(n0 - 1), destino);
    check(await hay(filas(), n0 - 1) && await hay(s2.locator('table.tabla-pauta > tbody > tr[data-fila]'), n2 + 1) && (await s2.locator('table.tabla-pauta > tbody > tr[data-fila]').last().locator('.btn-ejercicio').textContent()).trim() === ultimoNombre, 'un ejercicio se mueve a otra sesión de la semana');
    await p.waitForTimeout(300);
    const vuelta = await s2.locator('tr[data-fila]').last().locator('select.mas-ejercicio option', { hasText: `Mover a ${nombreSesion}` }).getAttribute('value');
    await menu(s2.locator('tr[data-fila]').last().locator('select.mas-ejercicio'), vuelta);
    check(await hay(filas(), n0) && (await nombreDe(n0 - 1)) === ultimoNombre, 'y vuelve');

    // --- llevar a las semanas siguientes (desde la semana anterior)
    await p.waitForTimeout(300);
    await semanaTab(semanaN - 1).click();
    await p.locator('section.editor-sesion').first().waitFor();
    await p.waitForTimeout(400);
    const nota = `Prueba ${Date.now() % 10000}: codos pegados`;
    if (await fila(0).locator('input[aria-label="Nota para el atleta"]').count() === 0) await fila(0).getByRole('button', { name: 'Nota para el atleta' }).click();
    const campoNota = fila(0).locator('input[aria-label="Nota para el atleta"]');
    await campoNota.fill(nota);
    await campoNota.press('Tab');
    await guardado();
    check(!!(await campoNota.getAttribute('list')) && await p.locator(`datalist#${await campoNota.getAttribute('list')} option`).evaluateAll((os, t) => os.some((o) => o.value === t), nota), 'las notas que escribes quedan a mano para la siguiente');
    await menu(mas(0), 'llevar');
    const llevar = p.getByRole('dialog').last();
    await llevar.locator('.varios-fila').first().waitFor();
    const tl = (await llevar.textContent()).replace(/\s+/g, ' ');
    check(tl.includes(`Semana ${semanaN}`) && await llevar.locator('label.varios-fila', { hasText: 'La nota para el atleta' }).locator('input').isChecked(), 'llevar a las semanas siguientes: marca solo lo que cambia y enseña a qué semanas');
    await revisar('llevar');
    await llevar.getByRole('button', { name: /^Cambiar en \d+ semanas?$/ }).click();
    await hay(p.getByRole('dialog'), 0);
    await p.waitForTimeout(300);
    await semanaTab(semanaN).click();
    await p.locator('section.editor-sesion').first().waitFor();
    check(await hasta(async () => (await fila(0).locator('input[aria-label="Nota para el atleta"]').inputValue().catch(() => '')) === nota), 'y la nota aparece en la semana siguiente');
    for (let i = 0; i < 2; i++) { await p.waitForTimeout(350); await deshacer().click(); }
    check(await hasta(async () => (await fila(0).locator('input[aria-label="Nota para el atleta"]').count()) === 0 || (await fila(0).locator('input[aria-label="Nota para el atleta"]').inputValue()) !== nota), 'deshaciendo, se quita de las dos');

    // --- sesiones guardadas
    await p.waitForTimeout(300);
    const nSes = await sesiones().count();
    await menu(sesion().locator('select.menu-sesion'), 'guardar');
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: 'Añadir sesión guardada' }).click();
    const guard = p.getByRole('dialog').last();
    await guard.locator('.elegir-fila').first().waitFor();
    check((await guard.textContent()).includes(nombreSesion) && new RegExp(`${n0} ejercicios`).test(await guard.textContent()), 'una sesión guardada aparece en «Añadir sesión guardada»');
    await revisar('sesiones guardadas');
    await guard.locator('.elegir-fila button').first().click();
    check(await hay(sesiones(), nSes + 1) && await sesiones().last().locator('tr[data-fila]').count() === n0, 'y se añade a la semana con todos sus ejercicios');
    await p.waitForTimeout(300);
    await sesiones().last().getByRole('button', { name: `Borrar ${nombreSesion}` }).click();
    await p.getByRole('dialog').last().getByRole('button', { name: /Borrar/ }).click();
    await hay(sesiones(), nSes);

    // --- buscador
    await p.waitForTimeout(300);
    await sesion().getByRole('button', { name: 'Añadir ejercicio' }).click();
    const elegir = p.getByRole('dialog').last();
    await elegir.locator('.lista-elegir .elegir-fila').first().waitFor();
    const marcas = await elegir.locator('.lista-elegir .elegir-fila').evaluateAll((fs) => fs.slice(0, 6).map((f) => f.querySelector('.marca-buscador')?.textContent || ''));
    check(marcas[0] === 'en este bloque' && marcas.filter(Boolean).length >= 3, `el buscador pone arriba los ejercicios que ya salen en el bloque (${marcas.filter(Boolean).length} de los 6 primeros)`);
    await revisar('buscador');
    await elegir.locator('.lista-elegir .elegir-fila button').nth(1).click();
    await hay(filas(), n0 + 1);
    await p.waitForTimeout(300);
    const elegido = await nombreDe(n0);
    await fila(n0).getByRole('button', { name: 'Quitar ejercicio' }).click();
    await hay(filas(), n0);
    await p.waitForTimeout(300);
    await sesion().getByRole('button', { name: 'Añadir ejercicio' }).click();
    await p.getByRole('dialog').last().locator('.lista-elegir .elegir-fila').first().waitFor();
    const primera = (await p.getByRole('dialog').last().locator('.lista-elegir .elegir-fila').first().textContent());
    check(primera.includes(elegido) && primera.includes('reciente'), 'y el último que has puesto sale el primero, como «reciente»');
    await p.keyboard.press('Escape');
    await hay(p.getByRole('dialog'), 0);
    await revisar('editor');
    await p.close();

    // --- móvil, en oscuro
    const movil = await navegador.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-ES', bypassCSP: true, colorScheme: 'dark', hasTouch: true });
    try {
      await abrir(movil);
      const ok = await sesion().evaluate((el) => ['.duracion-sesion', 'select.mas-ejercicio', '.menu-sesion'].every((q) => { const r = el.querySelector(q)?.getBoundingClientRect(); return !!r && r.width > 20 && r.left >= 0 && r.right <= innerWidth; }));
      check(ok && await p.getByRole('button', { name: 'Añadir sesión guardada' }).count() === 1, 'en el móvil están a la vista la duración, el menú de cada ejercicio y «Añadir sesión guardada»');
      await revisar('editor en el móvil');
      await menu(sesion().locator('select.menu-sesion'), 'varios');
      await p.getByRole('dialog').last().locator('.varios-fila').first().waitFor();
      await revisar('cambiar varios en el móvil');
      await foto('editor185-movil');
    } finally { await movil.close(); }
    check(errores.length === 0, `el editor: sin errores de consola, sin desbordes y sin fallos de accesibilidad${errores.length ? ` · ${errores.slice(0, 4).join(' ## ')}` : ''}`);
  } catch (e) {
    await foto('editor185-error').catch(() => {});
    check(false, `Editor manual (v0.185): ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
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
  console.log('Editor manual, segunda tanda (v0.185)');
  await probarEditor185({ navegador, check, base: 'http://localhost:4177', capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
