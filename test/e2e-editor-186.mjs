// (v0.186) El editor manual, tercera tanda, en la demo: cómo le fue cada sesión, la vista compacta de la semana, el 1RM
// estimado junto a los kilos, el candado y la nota solo para el coach, más avisos antes de publicar, los cambios que
// esperan a la conexión, traer una sesión de otro atleta, quién queda por programar y la barra del móvil.
//   Suelta:  npm run build && node test/e2e-editor-186.mjs
//   Dentro de e2e.test.mjs:  const { probarEditor186 } = await import('./e2e-editor-186.mjs'); await probarEditor186({ navegador, check });
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarEditor186({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
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

  const semanaN = async () => Number((await p.locator('.semanas-tabs button[aria-pressed="true"]').first().textContent()).match(/S(\d+)/)[1]);

  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true });
  try {
    await abrir(ctx);
    const n0 = await filas().count();
    const primero = await nombreDe(0);
    const semanaActual = await semanaN();

    // --- cómo le fue
    const fue = await p.locator('.como-fue').allTextContents();
    check(fue.length >= 1 && fue.some((t) => /Semana \d+: (hecha|«)/.test(t) || /^Hecha/.test(t.trim())), `cada sesión dice cómo le fue (${fue.length}: ${(fue[0] || '').trim().slice(0, 90)})`);

    // --- (arreglo) el menú de cada ejercicio no se monta sobre la variante
    const montados = await p.evaluate(() => [...document.querySelectorAll('.tabla-pauta tbody > tr[data-fila] .col-ejercicio')].filter((td) => {
      const a = td.querySelector('.mas-ejercicio')?.getBoundingClientRect(), b = td.querySelector('.variante-tempo')?.getBoundingClientRect();
      return a && b && a.width && b.width && !(a.top >= b.bottom - 1 || a.bottom <= b.top + 1 || a.left >= b.right - 1 || a.right <= b.left + 1);
    }).length);
    check(montados === 0, `«Mover, llevar, historial…» va en su línea, sin montarse sobre la variante (${montados} montados)`);

    // --- vista compacta de toda la semana
    await p.getByRole('button', { name: 'Vista compacta' }).click();
    const todas = () => p.locator('table.tabla-pauta > tbody > tr[data-fila]');
    check(await hasta(async () => (await todas().count()) === (await p.locator('table.tabla-pauta > tbody > tr[data-fila].sin-detalle').count()))
      && await kg(0).isVisible() && await p.getByRole('button', { name: 'Ver el detalle', exact: true }).count() === 1, 'la vista compacta deja solo la fila de cada ejercicio en toda la semana, y se sigue pudiendo escribir');
    await foto('editor186-compacta');
    await p.getByRole('button', { name: 'Ver el detalle', exact: true }).click();
    await hay(p.locator('table.tabla-pauta > tbody > tr[data-fila].sin-detalle'), 0);

    // --- 1RM estimado junto a los kilos
    const rm = await p.locator('.pct-rm').allTextContents();
    check(rm.length >= 1 && /\d+ % de su mejor 1RM estimado \(\d/.test(rm[0]), `en los básicos con kilos dice qué parte de su mejor 1RM estimado son (${rm.length}: ${(rm[0] || '').trim()})`);

    // --- candado
    await mas(0).selectOption('candado');
    check(await hay(fila(0).locator('.chip-fijado'), 1), 'el candado deja el ejercicio marcado como «Fijado»');
    await p.getByRole('button', { name: 'Preparar las siguientes' }).click();
    check(await hasta(async () => /con candado pasan? tal cual/.test(await p.getByRole('dialog').last().textContent())), '«Preparar las siguientes» avisa de que los de candado pasan tal cual');
    await p.keyboard.press('Escape');
    await hay(p.getByRole('dialog'), 0);

    if (await p.getByRole('button', { name: 'Programar según FBE', exact: true }).count()) {
      await p.getByRole('button', { name: 'Programar según FBE', exact: true }).click();
      const hojaFbe = p.getByRole('dialog').last();
      await hojaFbe.locator('.carga-sug').first().waitFor();
      const fijadas = hojaFbe.locator('.carga-sug', { has: p.locator('.chip-fijado') });
      const marcadas = await fijadas.locator('input[type="checkbox"]:checked').count();
      check(await fijadas.count() >= 1 && marcadas === 0, `«Programar según FBE» lo señala como fijado y no lo trae marcado (${await fijadas.count()})`);
      await revisar('Programar según FBE con candado');
      await p.keyboard.press('Escape');
      await hay(p.getByRole('dialog'), 0);
    }

    // --- nota solo para ti
    const priv = () => fila(0).locator('.nota-solo-coach input');
    await priv().fill('Subir cuando no le moleste el hombro');
    await priv().press('Tab');
    await guardado();
    await semanaTab(semanaActual - 1).click();
    await p.waitForTimeout(400);
    await semanaTab(semanaActual).click();
    await sesion().waitFor();
    check(await hasta(async () => (await priv().inputValue()) === 'Subir cuando no le moleste el hombro') && await fila(0).locator('.chip-fijado').count() === 1, 'la nota solo para ti y el candado siguen ahí al volver a la semana');
    await sesion().evaluate((el) => window.scrollTo(0, scrollY + el.getBoundingClientRect().top - 70));
    await p.waitForTimeout(300);
    await foto('editor186-candado');
    await revisar('editor con candado y nota');
    await p.getByRole('tab', { name: /Notas/ }).first().click();
    await p.locator('#nota-nueva').waitFor();
    check(!/#ej:/.test(await p.locator('main').first().textContent()), 'y no se cuela entre las notas privadas de la ficha');
    await p.getByRole('tab', { name: /Programa/ }).first().click();
    await sesion().waitFor();
    await mas(0).selectOption('candado');
    check(await hay(fila(0).locator('.chip-fijado'), 0), 'el candado se quita igual');

    // --- más avisos antes de publicar
    await fila(0).getByRole('button', { name: /^Duplicar / }).click();
    await hay(filas(), n0 + 1);
    await p.getByRole('button', { name: 'Publicar al atleta' }).or(p.getByRole('button', { name: 'Retirar' })).first().waitFor();
    if (await p.getByRole('button', { name: 'Publicar al atleta' }).count()) {
      await p.getByRole('button', { name: 'Publicar al atleta' }).click();
      const dlg = p.getByRole('dialog').last();
      check(await hasta(async () => new RegExp(`${primero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} está 2 veces`).test(await dlg.textContent())), 'antes de publicar avisa de un ejercicio repetido en la sesión');
      await foto('editor186-avisos');
      await p.getByRole('button', { name: 'Volver al editor' }).click();
      await hay(p.getByRole('dialog'), 0);
    } else check(true, 'antes de publicar avisa de un ejercicio repetido en la sesión (la semana ya estaba publicada: no se prueba aquí)');
    await p.waitForTimeout(300);
    await fila(1).getByRole('button', { name: 'Quitar ejercicio' }).click();
    await hay(filas(), n0);

    // --- sin conexión: lo escrito se queda marcado y se guarda solo al volver
    const antes = await kg(0).inputValue();
    await p.evaluate(() => localStorage.setItem('fbe-demo-sin-red', '1'));
    await ctx.setOffline(true);
    await kg(0).fill('77,5');
    await kg(0).press('Tab');
    check(await hay(p.locator('.sin-guardar-aviso'), 1) && await hay(filas().and(p.locator('tr.sin-guardar')), 1) && (await kg(0).inputValue()) === '77,5',
      'sin conexión, el cambio se queda a la vista, marcado como sin guardar');
    await foto('editor186-sin-guardar');
    await revisar('editor sin conexión');
    await ctx.setOffline(false);
    await p.evaluate(() => { localStorage.removeItem('fbe-demo-sin-red'); window.dispatchEvent(new Event('online')); });
    check(await hay(p.locator('.sin-guardar-aviso'), 0) && await hay(p.locator('tr.sin-guardar'), 0) && (await kg(0).inputValue()) === '77,5', 'y al volver la conexión se guarda solo');
    await kg(0).fill(antes);
    await kg(0).press('Tab');
    await guardado();

    // --- traer una sesión de otro atleta
    const nSes = await sesiones().count();
    await p.getByRole('button', { name: 'Traer de otro atleta' }).click();
    const hoja = p.getByRole('dialog').last();
    await hoja.locator('#de-otro-atleta').waitFor();
    const opciones = await hoja.locator('#de-otro-atleta option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    let traida = false;
    for (const v of opciones) {
      await hoja.locator('#de-otro-atleta').selectOption(v);
      if (await hasta(async () => (await hoja.locator('.elegir-fila').count()) > 0, 2500)) { await hoja.locator('.elegir-fila button').first().click(); traida = true; break; }
    }
    check(traida && await hay(sesiones(), nSes + 1), `«Traer de otro atleta» copia una sesión suya al final de la semana (${opciones.length} atletas para elegir)`);
    await revisar('editor con la sesión traída');

    // --- quién queda por programar
    const sig = p.locator('.siguiente-atleta');
    check(await hay(sig, 1) && /^Por programar: \d+\./.test((await sig.textContent()).trim()), `abajo dice cuántos quedan por programar (${((await sig.textContent().catch(() => '')) || '').trim().slice(0, 80)})`);
    await sig.scrollIntoViewIfNeeded();
    await foto('editor186-por-programar');
    const boton = sig.getByRole('button', { name: /^Ir a / });
    const quien = (await boton.textContent()).replace('Ir a', '').trim();
    await boton.click();
    check(await hasta(async () => (await p.locator('h1, h2').allTextContents()).some((t) => t.includes(quien))) && await hasta(async () => (await p.locator('.semanas-tabs, .vacio').count()) > 0),
      `«Ir a ${quien}» abre su programa`);
    await revisar('programa del siguiente atleta');
    await p.close();

    // --- móvil, en oscuro
    const movil = await navegador.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-ES', bypassCSP: true, colorScheme: 'dark', hasTouch: true });
    try {
      await abrir(movil);
      // la pantalla se desliza: se espera a que se pare antes de mirar dónde ha quedado
      const quieta = async () => { let a = -1; for (let k = 0; k < 40; k++) { const y = await p.evaluate(() => scrollY); if (y === a) return y; a = y; await p.waitForTimeout(250); } return a; };
      const arriba = (i) => filas().nth(i).evaluate((el) => Math.round(el.getBoundingClientRect().top));
      await p.getByRole('button', { name: 'Ir al ejercicio siguiente' }).click();
      await quieta();
      const enPrimero = Math.abs(await arriba(0) - 96) <= 4;
      await p.getByRole('button', { name: 'Ir al ejercicio siguiente' }).click();
      await quieta();
      const enSegundo = Math.abs(await arriba(1) - 96) <= 4;
      await p.getByRole('button', { name: 'Ir al ejercicio anterior' }).click();
      await quieta();
      const deVuelta = Math.abs(await arriba(0) - 96) <= 4;
      check(enPrimero && enSegundo && deVuelta, `en el móvil, los botones de abajo llevan al ejercicio siguiente y al anterior (${enPrimero}, ${enSegundo}, ${deVuelta})`);
      const cabe = await p.evaluate(() => ['.barra-editor', '.como-fue', '.nota-solo-coach', '.anadir-sesiones'].every((q) => { const r = document.querySelector(q)?.getBoundingClientRect(); return !!r && r.width > 20 && r.left >= 0 && r.right <= innerWidth + 1; }));
      check(cabe, 'y caben la barra, cómo le fue, la nota solo para ti y los botones de añadir sesión');
      await revisar('editor en el móvil');
      await foto('editor186-movil');
    } finally { await movil.close(); }
    check(errores.length === 0, `el editor: sin errores de consola, sin desbordes y sin fallos de accesibilidad${errores.length ? ` · ${errores.slice(0, 4).join(' ## ')}` : ''}`);
  } catch (e) {
    await foto('editor186-error').catch(() => {});
    check(false, `Editor manual (v0.186): ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
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
  console.log('Editor manual, tercera tanda (v0.186)');
  await probarEditor186({ navegador, check, base: 'http://localhost:4177', capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
