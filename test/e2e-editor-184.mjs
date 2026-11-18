// (v0.184) El editor manual del programa, más cómodo, en la demo: títulos claros y fijos, botones + y − con el salto,
// deshacer, «Como la semana pasada» y «Lo que hizo», copiar la serie 1 a las demás, duplicar y quitar un ejercicio (y
// deshacerlo), arrastrar para reordenar, plegar sesiones y el detalle de un ejercicio, duplicar una sesión, «Como lo
// verá el atleta» y añadir varios ejercicios de una vez. En escritorio y a 390 px en oscuro, sin errores de consola,
// sin desbordes y sin fallos de accesibilidad.
//   Suelta:  npm run build && node test/e2e-editor-184.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarEditor184 } = await import('./e2e-editor-184.mjs'); await probarEditor184({ navegador, check });
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarEditor184({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
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

  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true });
  try {
    await abrir(ctx);
    // --- títulos
    const titulos = (await sesion().locator('table.tabla-pauta > thead').textContent()).replace(/\s+/g, ' ');
    check(/Superserie/.test(titulos) && /Reps de/.test(titulos) && /Reps a/.test(titulos) && /Kilos/.test(titulos) && !/Súper\.|Reps mín/.test(titulos), 'los títulos de la tabla dicen lo que son: Superserie, Reps de, Reps a, Kilos');
    check(await sesion().locator('table.tabla-pauta > thead th').first().evaluate((el) => getComputedStyle(el).position) === 'sticky'
      && await p.evaluate(() => { const e = document.querySelector('.tabla-pauta-env'); return e.scrollWidth <= e.clientWidth + 1; }), 'en pantalla ancha la tabla cabe entera y sus títulos se quedan arriba al bajar');
    check(await deshacer().isDisabled(), 'al abrir no hay nada que deshacer');

    // --- + y − y deshacer
    const n0 = await filas().count();
    const antes = await kg(0).inputValue();
    await fila(0).getByRole('button', { name: /^Más kilos en / }).click();
    await guardado();
    const mas = await kg(0).inputValue();
    check(Number(mas.replace(',', '.')) === Number(antes.replace(',', '.')) + 2.5, `el botón + sube los kilos con el salto del ejercicio (${antes} → ${mas})`);
    await fila(0).getByRole('button', { name: /^Menos kilos en / }).click();
    await guardado();
    check(await kg(0).inputValue() === antes, 'y el − los baja');
    await fila(0).getByRole('button', { name: /^Más kilos en / }).click();
    await guardado();
    check(!(await deshacer().isDisabled()) && /^Deshacer: Kilos de /.test(await deshacer().getAttribute('title')), 'el botón «Deshacer» dice qué va a deshacer');
    await deshacer().click();
    check(await hasta(async () => (await kg(0).inputValue()) === antes), 'deshacer devuelve los kilos de antes');
    await p.waitForTimeout(300);
    await deshacer().click(); await p.waitForTimeout(300); await deshacer().click();
    check(await hasta(async () => (await deshacer().isDisabled()) && (await kg(0).inputValue()) === antes), 'y se puede deshacer varias veces seguidas, hasta el principio');

    // --- lo que hizo, copiar la serie 1, como la semana pasada
    await fila(0).getByRole('button', { name: /programar lo que hizo/ }).click();
    check(await hay(fila(0).locator('.detalle-series .detalle-fila'), 3), '«Lo que hizo» deja el ejercicio serie a serie con lo que hizo en cada una');
    const reps1 = await fila(0).locator('.detalle-fila').first().locator('input[data-celda="reps"]').inputValue();
    await fila(0).locator('.detalle-fila').first().getByRole('button', { name: /^Una repetición más en la serie 1/ }).click();
    await guardado();
    check(Number(await fila(0).locator('.detalle-fila').first().locator('input[data-celda="reps"]').inputValue()) === Number(reps1) + 1, 'en serie a serie, + y − también en las repeticiones');
    await fila(0).getByRole('button', { name: /Copiar la serie 1 a las demás/ }).click();
    check(await hasta(async () => (await fila(0).locator('.detalle-fila').nth(2).locator('input[data-celda="reps"]').inputValue()) === String(Number(reps1) + 1)), '«Copiar la serie 1 a las demás» iguala las otras series');
    await guardado();
    await revisar('serie a serie');
    await foto('editor184-detalle');
    await fila(0).getByRole('button', { name: /programar como la semana/ }).click();
    check(await hay(fila(0).locator('.detalle-series'), 0) && await hasta(async () => (await kg(0).inputValue()) !== antes), '«Como la semana pasada» vuelve a series iguales con la prescripción de la semana anterior');
    for (let i = 0; i < 4; i++) { await p.waitForTimeout(350); if (await deshacer().isDisabled()) break; await deshacer().click(); }
    check(await hasta(async () => (await deshacer().isDisabled()) && (await fila(0).locator('.detalle-series').count()) === 0 && (await kg(0).inputValue()) === antes), 'deshaciendo todo, el ejercicio queda como estaba');

    // --- duplicar, quitar y deshacer el quitar
    const primero = await nombreDe(0), segundo = await nombreDe(1);
    await fila(0).getByRole('button', { name: /^Duplicar / }).click();
    check(await hay(filas(), n0 + 1) && (await nombreDe(1)) === primero, 'duplicar un ejercicio lo pone otra vez justo debajo');
    await fila(1).getByRole('button', { name: 'Quitar ejercicio' }).click();
    check(await hay(filas(), n0), 'se quita');
    await p.waitForTimeout(300);
    await deshacer().click();
    check(await hay(filas(), n0 + 1) && (await nombreDe(1)) === primero, 'y deshacer lo devuelve a su sitio');
    await p.waitForTimeout(300);
    await fila(1).getByRole('button', { name: 'Quitar ejercicio' }).click();
    await hay(filas(), n0);

    // --- arrastrar
    await p.waitForTimeout(300);
    const asa = fila(0).locator('.asa-mover');
    await asa.scrollIntoViewIfNeeded();
    const a = await asa.boundingBox(), b = await fila(1).boundingBox();
    await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await p.mouse.down();
    await p.mouse.move(a.x + a.width / 2, b.y + b.height * 0.75, { steps: 8 });
    const raya = await sesion().locator('tr.soltar-antes, tr.soltar-despues').count();
    await p.mouse.up();
    check(raya === 1 && await hasta(async () => (await nombreDe(0)) === segundo && (await nombreDe(1)) === primero), 'arrastrando por el asa, el ejercicio cambia de sitio (y una raya marca dónde cae)');
    await p.waitForTimeout(300);
    await deshacer().click();
    check(await hasta(async () => (await nombreDe(0)) === primero), 'y se deshace');

    // --- ver solo la fila, plegar
    await fila(0).getByRole('button', { name: /^Ocultar el detalle de/ }).click();
    check(await hay(fila(0).locator('.variante-tempo'), 0) && await fila(0).locator('input[data-celda="series"]').count() === 1, 'el ojo oculta el detalle de un ejercicio y deja su fila');
    await fila(0).getByRole('button', { name: /^Ver el detalle de/ }).click();
    await hay(fila(0).locator('.variante-tempo'), 1);
    const nombreSesion = await sesion().locator('input[aria-label="Nombre de la sesión"]').inputValue();
    await sesion().locator('.plegar-sesion').click();
    check(await hay(sesion().locator('table.tabla-pauta'), 0) && new RegExp(`${nombreSesion} · ${n0} ejercicios · \\d+ series`).test((await sesion().locator('.plegar-sesion').textContent()).replace(/\s+/g, ' ')), 'una sesión plegada se queda en una línea con su resumen');
    await p.getByRole('button', { name: 'Plegar todas' }).click();
    check(await hay(p.locator('section.editor-sesion.plegada'), await p.locator('section.editor-sesion').count()), '«Plegar todas» pliega la semana entera');
    await revisar('plegadas');
    await foto('editor184-plegadas');
    await p.getByRole('button', { name: 'Desplegar todas' }).click();
    check(await hay(p.locator('section.editor-sesion.plegada'), 0), 'y «Desplegar todas» las abre');

    // --- duplicar una sesión y moverla
    const nSes = await p.locator('section.editor-sesion').count();
    const valor = await sesion().locator('select.menu-sesion option', { hasText: 'Duplicar en esta semana' }).getAttribute('value');
    await sesion().locator('select.menu-sesion').selectOption(valor);
    check(await hay(p.locator('section.editor-sesion'), nSes + 1) && (await p.locator('section.editor-sesion').last().locator('input[aria-label="Nombre de la sesión"]').inputValue()) === `${nombreSesion} (copia)`
      && await p.locator('section.editor-sesion').last().locator('tr[data-fila]').count() === n0, 'una sesión se duplica entera en la misma semana, con sus ejercicios');
    check(await sesion().locator('select.menu-sesion option', { hasText: /Copiar a la semana \d/ }).count() >= 1, 'y se puede copiar a otra semana del bloque');
    await p.waitForTimeout(300);
    await p.locator('section.editor-sesion').last().locator('select.menu-sesion').selectOption('subir');
    check(await hasta(async () => (await p.locator('section.editor-sesion').nth(nSes - 1).locator('input[aria-label="Nombre de la sesión"]').inputValue()) === `${nombreSesion} (copia)`), 'una sesión sube o baja un puesto desde su menú');
    await p.waitForTimeout(300);
    await p.locator('section.editor-sesion').nth(nSes - 1).getByRole('button', { name: `Borrar ${nombreSesion} (copia)` }).click();
    await p.getByRole('dialog').last().getByRole('button', { name: /Borrar/ }).click();
    await hay(p.locator('section.editor-sesion'), nSes);

    // --- arrastrar una sesión
    await p.waitForTimeout(300);
    const s2 = await p.locator('section.editor-sesion').nth(1).locator('input[aria-label="Nombre de la sesión"]').inputValue();
    await p.getByRole('button', { name: 'Plegar todas' }).click();
    await hay(p.locator('section.editor-sesion.plegada'), nSes);
    const asaS = sesion().locator('.editor-sesion-barra .asa-mover');
    await asaS.scrollIntoViewIfNeeded();
    const c1 = await asaS.boundingBox(), c2 = await p.locator('section.editor-sesion').nth(1).boundingBox();
    await p.mouse.move(c1.x + c1.width / 2, c1.y + c1.height / 2);
    await p.mouse.down();
    await p.mouse.move(c1.x + c1.width / 2, c2.y + c2.height * 0.8, { steps: 8 });
    await p.mouse.up();
    check(await hasta(async () => (await p.locator('section.editor-sesion').first().locator('.plegar-sesion').textContent()).includes(s2)), 'las sesiones también se reordenan arrastrando');
    await p.waitForTimeout(300);
    await deshacer().click();
    check(await hasta(async () => (await p.locator('section.editor-sesion').first().locator('.plegar-sesion').textContent()).includes(nombreSesion)), 'y se deshace');
    await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Desplegar todas' }).click();
    await hay(p.locator('section.editor-sesion.plegada'), 0);

    // --- como lo verá el atleta
    await p.getByRole('button', { name: /Como lo verá el atleta/ }).click();
    const vista = p.getByRole('dialog').last();
    await vista.locator('.vista-ejercicios').first().waitFor();
    const tv = (await vista.textContent()).replace(/\s+/g, ' ');
    check(/como la verá el atleta/.test(tv) && tv.includes(nombreSesion) && tv.includes(primero) && /\d × \d+(–\d+)?/.test(tv) && /descanso \d:\d\d/.test(tv), '«Como lo verá el atleta» enseña la semana con cada ejercicio: series, repeticiones, esfuerzo, kilos y descanso');
    await revisar('vista del atleta');
    await foto('editor184-vista');
    await p.keyboard.press('Escape');
    await hay(p.getByRole('dialog'), 0);

    // --- varios ejercicios de una vez
    await sesion().getByRole('button', { name: 'Añadir ejercicio' }).click();
    const elegir = p.getByRole('dialog').last();
    await elegir.locator('.lista-elegir .elegir-fila').first().waitFor();
    await elegir.locator('.elegir-marca').nth(0).check();
    await elegir.locator('.elegir-marca').nth(2).check();
    await revisar('elegir varios');
    await elegir.getByRole('button', { name: 'Añadir 2 ejercicios' }).click();
    check(await hay(filas(), n0 + 2), 'marcando varias casillas en el buscador, entran todos de una vez');
    const nueva = fila(n0);
    check(Number(await nueva.locator('input[data-celda="series"]').inputValue()) === 3 && Number(await nueva.locator('input[data-celda="reps_min"]').inputValue()) >= 6 && Number(await nueva.locator('input[data-celda="reps_max"]').inputValue()) <= 15, 'cada uno con sus valores de partida (3 series y el rango de su tipo)');
    for (let i = 0; i < 2; i++) { await p.waitForTimeout(300); await fila(n0).getByRole('button', { name: 'Quitar ejercicio' }).click(); await hay(filas(), n0 + 1 - i); }
    check(await hay(filas(), n0), 'la sesión queda como estaba');
    await revisar('editor');
    await p.close();

    // --- móvil, en oscuro
    const movil = await navegador.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-ES', bypassCSP: true, colorScheme: 'dark', hasTouch: true });
    try {
      await abrir(movil);
      const visibles = await sesion().locator('tr[data-fila]').evaluateAll((trs) => trs.every((tr) => ['Quitar ejercicio', 'Subir', 'Bajar'].every((n) => { const b = tr.querySelector(`button[aria-label="${n}"]`); const r = b?.getBoundingClientRect(); return r && r.width >= 30 && r.left >= 0 && r.right <= innerWidth; })
        && !!tr.querySelector('.asa-mover') && !!tr.querySelector('td[data-col="Kilos"] .paso')));
      check(visibles, 'en el móvil cada ejercicio tiene a la vista su asa, sus flechas, duplicar, quitar y los botones + y − de los kilos');
      const cab = await sesion().evaluate((el) => ['.editor-sesion-cab button[aria-label^="Borrar "]', '.menu-sesion', '.plegar-sesion', '.editor-sesion-barra .asa-mover'].map((q) => { const r = el.querySelector(q)?.getBoundingClientRect(); return !!r && r.width >= 24 && r.left >= 0 && r.right <= innerWidth; }));
      check(cab.every(Boolean), `y cada sesión, su asa, plegar, el menú de copiar y mover, y borrar (${cab.map((x) => (x ? 'sí' : 'no')).join(', ')})`);
      const tabla = await sesion().locator('.fbe-series').first().evaluate((t) => { const r = t.getBoundingClientRect(); const c = t.closest('.fbe-series-caja'); return r.right <= innerWidth && c.scrollWidth <= c.clientWidth + 1 && getComputedStyle(t.querySelector('tbody td')).display === 'table-cell'; });
      check(tabla, 'y la tabla Pautado · Hizo · Programado cabe en la pantalla, como tabla');
      await revisar('editor en el móvil');
      await foto('editor184-movil');
      await p.getByRole('button', { name: /Como lo verá el atleta/ }).click();
      await p.getByRole('dialog').last().locator('.vista-ejercicios').first().waitFor();
      await revisar('vista del atleta en el móvil');
    } finally { await movil.close(); }
    check(errores.length === 0, `el editor: sin errores de consola, sin desbordes y sin fallos de accesibilidad${errores.length ? ` · ${errores.slice(0, 4).join(' ## ')}` : ''}`);
  } catch (e) {
    await foto('editor184-error').catch(() => {});
    check(false, `Editor manual (v0.184): ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
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
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4176);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Editor manual (v0.184)');
  await probarEditor184({ navegador, check, base: 'http://localhost:4176', capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
