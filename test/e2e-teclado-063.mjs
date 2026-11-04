// v0.63: apuntar las series con el dedo, de punta a punta en la demo, en un iPhone de Playwright (táctil y móvil, como la
// prueba del chat de la v0.58.1). Lo llama e2e.test.mjs y se puede lanzar suelto (node test/e2e-teclado-063.mjs, con dist/).
//   · el teclado de la app sale en lugar del del móvil (inputmode="none") y sus −/+ y cifras funcionan;
//   · «Siguiente» va de kilos a repeticiones, al RPE y marca la serie (arranca el descanso);
//   · cambiar las repeticiones de la primera serie pasa a las siguientes iguales, con «También en las series 2 y 3 · Deshacer»;
//   · deslizar una serie a la derecha la marca; deslizar y volver atrás no; mantenerla pulsada abre el teclado en los kilos;
//   · «Ahora toca» en el descanso dice la serie siguiente con lo que propone la fila; tocarla lleva a ella con el teclado;
//   · el modo enfoque, con el teclado y «Ahora toca»;
//   · volver al teclado del móvil (desde el teclado y en Perfil) y a 360 px en oscuro, sin fallos de accesibilidad.
import { createRequire } from 'node:module';
import { devices } from 'playwright';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarTeclado063({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true });
  // Cuántas veces se guarda una serie (la demo deja su base en __fbeDemo antes de crear la api, que se queda con su upsert)
  await ctx.addInitScript(() => {
    window.__guardadas = 0;
    let demo = null;
    Object.defineProperty(window, '__fbeDemo', { configurable: true, get: () => demo, set: (v) => {
      demo = v;
      const o = v.upsert.bind(v);
      v.upsert = (t, filas, ...r) => { if (t === 'series') window.__guardadas += (filas || []).length; return o(t, filas, ...r); };
    } });
  });
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
    const r = await p.evaluate(() => {
      const t = document.querySelector('.teclado-serie')?.getBoundingClientRect();
      return { cabe: document.documentElement.scrollWidth <= 360, teclado: t ? t.left >= 0 && t.right <= 360 && t.bottom <= innerHeight + 1 : true };
    });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
    return r.cabe && r.teclado;
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
  const cdp = await ctx.newCDPSession(p);
  const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  // Un dedo que se desliza en horizontal por la fila (pasos: los dx de cada movimiento)
  async function deslizar(fila, pasos) {
    await fila.scrollIntoViewIfNeeded();
    const r = await fila.boundingBox();
    const x0 = r.x + 12, y = r.y + r.height / 2;
    await toque('touchStart', x0, y);
    for (const dx of pasos) { await toque('touchMove', x0 + dx, y); await p.waitForTimeout(16); }
    await toque('touchEnd');
  }
  async function pulsarLargo(fila) {
    await fila.scrollIntoViewIfNeeded();
    const r = await fila.boundingBox();
    await toque('touchStart', r.x + 12, r.y + r.height / 2);
    await p.waitForTimeout(700);
    await toque('touchEnd');
  }
  const teclado = p.locator('.teclado-serie');
  const tecla = (nombre) => teclado.getByRole('button', { name: nombre, exact: true });
  const enFoco = () => p.evaluate(() => document.activeElement?.getAttribute('aria-label') || null);
  const saltar = async () => { if (await p.locator('.temporizador').count()) { await p.locator('.temporizador').getByRole('button', { name: /^(Saltar|Cerrar)$/ }).click(); await hay(p.locator('.temporizador'), 0); } };

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    const cod = p.getByLabel('Código', { exact: true });
    await Promise.race([cod.waitFor({ timeout: 8000 }).catch(() => {}), p.locator('nav.tabs').waitFor()]);
    if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(800);
    await cerrarDialogos();
    await p.evaluate(() => { window.__vib = []; Object.defineProperty(navigator, 'vibrate', { value: (x) => { window.__vib.push(x); return true; }, configurable: true }); });
    await p.locator('.tab', { hasText: 'Hoy' }).click();
    await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).click();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor();
    if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    if (await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).count()) await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).click();
    const ej = p.locator('.ejercicio').first();

    // ---------------------------------------------------------------- la pista de la primera vez
    const pistaD = p.locator('.pista', { hasText: 'Desliza una serie a la derecha' });
    check(await hay(pistaD, 1) && /Mantenla pulsada para abrir el teclado/.test(await pistaD.textContent()), 'la primera vez, en el móvil, una pista: deslizar para marcar y mantener pulsado para el teclado');
    await pistaD.getByRole('button', { name: 'Entendido' }).click();
    check(await hay(pistaD, 0), 'y con «Entendido» no vuelve');

    // ---------------------------------------------------------------- 1. el teclado de la app
    const kg1 = ej.getByLabel('Kilos de la serie 1');
    check(await kg1.getAttribute('inputmode') === 'none' && await ej.getByLabel('Repeticiones de la serie 1').getAttribute('inputmode') === 'none' && await ej.getByRole('button', { name: /^RPE de la serie 1/ }).count() === 1,
      'los kilos y las repeticiones no sacan el teclado del móvil (inputmode="none") y el RPE es un botón');
    await kg1.click();
    await teclado.waitFor();
    // (cuando acaba de subir: sin «reducir movimiento», entra con una animación corta)
    await p.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
    await p.waitForTimeout(400);
    const t0 = await p.evaluate(() => {
      const t = document.querySelector('.teclado-serie').getBoundingClientRect(), f = document.querySelector('.ejercicio .serie[data-n="1"]').getBoundingClientRect();
      return { campo: document.querySelector('.teclado-serie').dataset.campo, abajo: Math.round(innerHeight - t.bottom), filaEncima: f.bottom <= t.top + 1, foco: document.activeElement?.getAttribute('aria-label'),
        teclas: document.querySelectorAll('.teclado-serie .teclado-teclas .tecla').length, min: Math.min(...[...document.querySelectorAll('.teclado-serie .teclado-teclas .tecla')].map((b) => b.getBoundingClientRect().height)) };
    });
    check(t0.campo === 'kg' && Math.abs(t0.abajo) <= 1 && t0.filaEncima && /^Kilos de la serie 1/.test(t0.foco) && t0.teclas >= 15 && t0.min >= 44,
      `al tocar los kilos sale el teclado de la app, abajo, con teclas grandes (${t0.min}px), y la fila queda encima, nunca debajo ${JSON.stringify(t0)}`);
    const mas = teclado.getByRole('button', { name: /^Añadir .* kilos$/ });
    const paso = Number((await mas.getAttribute('aria-label')).match(/Añadir ([\d,]+) kilos/)[1].replace(',', '.'));
    const prop = Number((await kg1.getAttribute('placeholder')).replace(',', '.'));
    await mas.click();
    const trasMas = Number((await kg1.inputValue()).replace(',', '.'));
    await teclado.getByRole('button', { name: /^Quitar .* kilos$/ }).click();
    await teclado.getByRole('button', { name: /^Quitar .* kilos$/ }).click();
    const trasMenos = Number((await kg1.inputValue()).replace(',', '.'));
    check(paso > 0 && Math.abs(trasMas - (prop + paso)) < 0.001 && Math.abs(trasMenos - (prop - paso)) < 0.001,
      `−/+ suben y bajan el salto de este ejercicio desde lo propuesto (${prop} → ${trasMas} → ${trasMenos}, de ${paso} en ${paso})`);
    await tecla('4').click(); await tecla('2').click(); await tecla('Coma decimal').click(); await tecla('5').click();
    const escrito = await kg1.inputValue();
    await tecla('Borrar').click();
    check(escrito === '42,5' && await kg1.inputValue() === '42,' && /Kilos: 42,/.test(await teclado.locator('[aria-live]').textContent()),
      `tras −/+, lo que se teclea sustituye a lo que había (${escrito}); borrar quita la última cifra; cada cambio se anuncia`);
    await tecla('5').click();
    await revisar('teclado-kilos');
    check(await estrecho('teclado-kilos'), 'el teclado y la fila caben a 360 px en oscuro');

    // ---------------------------------------------------------------- «Siguiente»: kilos → repeticiones → RPE → hecha
    await teclado.getByRole('button', { name: /^Siguiente/ }).click();
    await esperar(() => document.querySelector('.teclado-serie')?.dataset.campo === 'reps');
    check(await enFoco() === 'Repeticiones de la serie 1', '«Siguiente» pasa de los kilos a las repeticiones');
    await teclado.getByRole('button', { name: 'Una repetición más' }).click();
    const repsMas = await ej.getByLabel('Repeticiones de la serie 1').inputValue();
    await tecla('7').click();
    check(Number(repsMas) === Number(await ej.getByLabel('Repeticiones de la serie 1').getAttribute('placeholder')) + 1 && await ej.getByLabel('Repeticiones de la serie 1').inputValue() === '7',
      `en las repeticiones, ±1 (${repsMas}) y las cifras`);
    await teclado.getByRole('button', { name: /^Siguiente/ }).click();
    await esperar(() => document.querySelector('.teclado-serie')?.dataset.campo === 'rpe');
    const rpes = await teclado.locator('.teclado-rpe .tecla').allTextContents();
    check(rpes.slice(0, 9).join(' ') === '6 6,5 7 7,5 8 8,5 9 9,5 10' && /^RPE de la serie 1/.test(await enFoco()), 'luego el RPE (tu coach lo pide): del 6 al 10 de medio en medio');
    await revisar('teclado-rpe');
    await tecla('8,5').click();
    await esperar(() => /: 8,5$/.test(document.querySelector('.ejercicio .serie[data-n="1"] .rpe-boton')?.getAttribute('aria-label') || ''));
    await teclado.getByRole('button', { name: /^Hecha: marcar la/ }).click();
    await p.locator('.temporizador').waitFor();
    check(await ej.getByRole('button', { name: 'Quitar la serie 1' }).count() === 1 && await hay(teclado, 0) && (await ej.locator('.serie[data-n="1"] .celda').first().inputValue()) === '42,5'
      && await ej.getByLabel('Repeticiones de la serie 1').inputValue() === '7' && await p.evaluate(() => window.__vib.includes(14) && window.__vib.includes(8)),
      'y «Hecha» marca la serie con lo escrito (42,5 × 7 @8,5), arranca el descanso y se va el teclado (un toque suave en cada tecla)');

    // ---------------------------------------------------------------- 8. «Ahora toca» en el descanso
    const tarjeta = p.locator('.temporizador .ahora-toca');
    await tarjeta.waitFor();
    const filaSig = ej.locator('.serie[data-n="2"]');
    const kgSig = await filaSig.locator('.celda').first().getAttribute('placeholder'), repsSig = await filaSig.locator('.celda').nth(1).getAttribute('placeholder');
    const nombreEj = (await ej.locator('.ejercicio-cab .nombre').textContent()).trim();
    const at = { etq: await tarjeta.locator('.ahora-etq').textContent(), nombre: await tarjeta.locator('.ahora-nombre').textContent(), carga: (await tarjeta.locator('.ahora-carga').textContent()).replace(/\s+/g, ' ').trim(),
      serie: await tarjeta.locator('.ahora-serie').textContent(), etiqueta: await tarjeta.getAttribute('aria-label'), esfuerzo: await tarjeta.locator('.ahora-esfuerzo').count() };
    check(at.etq === 'Ahora toca' && at.nombre === nombreEj && at.carga === `${kgSig} kg × ${repsSig}` && /2/.test(at.serie) && at.esfuerzo === 1 && /^Ahora toca: .+\. Toca para ir a esa serie$/.test(at.etiqueta)
      && await p.locator('.temporizador .que').count() === 0,
      `durante el descanso, «Ahora toca»: la serie siguiente con lo que propone su fila y el esfuerzo objetivo («${at.serie}: ${at.carga}»)`);
    const cifra = await tarjeta.locator('.ahora-carga').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    check(cifra >= 32, `para leerla de lejos: cifras grandes (${cifra}px)`);
    await tarjeta.scrollIntoViewIfNeeded();
    await revisar('ahora-toca');
    check(await estrecho('ahora-toca'), '«Ahora toca» cabe a 360 px en oscuro');
    await tarjeta.click();
    await esperar(() => document.querySelector('.teclado-serie')?.dataset.campo === 'kg');
    check(/^Kilos de la serie 2/.test(await enFoco()) && await p.evaluate(() => document.activeElement?.closest('.ejercicio') === document.querySelector('.ejercicio')) && await p.locator('.temporizador').count() === 1,
      'tocarla lleva a esa serie con el teclado en los kilos (y el descanso sigue)');
    await teclado.getByRole('button', { name: 'Ocultar el teclado' }).click();
    await hay(teclado, 0);
    await saltar();

    // ---------------------------------------------------------------- 3. deslizar y mantener pulsado
    const fila2 = ej.locator('.serie[data-n="2"]');
    await deslizar(fila2, [12, 40, 80, 120, 160, 120, 60, 20]);
    await p.waitForTimeout(400);
    check(await ej.getByRole('button', { name: 'Marcar la serie 2 como hecha' }).count() === 1 && await p.locator('.temporizador').count() === 0 && await p.locator('.serie-fondo').count() === 0,
      'deslizar y volver atrás antes de soltar no marca nada');
    await p.evaluate(() => { window.__vib = []; });
    await deslizar(fila2, [12, 40, 80, 120, 160, 200]);
    await p.locator('.temporizador').waitFor();
    check(await ej.getByRole('button', { name: 'Quitar la serie 2' }).count() === 1 && await p.evaluate(() => window.__vib.includes(8) && window.__vib.includes(14))
      && (await fila2.locator('.celda').first().inputValue()) === kgSig && (await fila2.locator('.celda').nth(1).inputValue()) === repsSig,
      `deslizar a la derecha marca la serie con lo propuesto (${kgSig} × ${repsSig}), con un toque al pasar el umbral, y arranca el descanso`);
    await saltar();
    await ej.getByRole('button', { name: 'Quitar la serie 2' }).click();
    await p.locator('.toast', { hasText: 'Serie 2 quitada' }).waitFor();
    check(await ej.getByRole('button', { name: 'Marcar la serie 2 como hecha' }).count() === 1, 'y se deshace como siempre (✓ otra vez)');
    // (al subir la página con el dedo, la fila no se mueve)
    const r2 = await fila2.boundingBox();
    await toque('touchStart', r2.x + 30, r2.y + r2.height / 2);
    for (let i = 1; i <= 8; i++) { await toque('touchMove', r2.x + 30 + i * 2, r2.y + r2.height / 2 - i * 14); await p.waitForTimeout(16); }
    await toque('touchEnd');
    await p.waitForTimeout(300);
    check(await ej.getByRole('button', { name: 'Marcar la serie 2 como hecha' }).count() === 1 && await p.locator('.serie-fondo').count() === 0, 'en vertical es la página: la fila no se desliza ni se marca');
    await pulsarLargo(ej.locator('.serie[data-n="3"]'));
    await esperar(() => document.querySelector('.teclado-serie')?.dataset.campo === 'kg');
    check(/^Kilos de la serie 3/.test(await enFoco()) && await ej.getByRole('button', { name: 'Marcar la serie 3 como hecha' }).count() === 1, 'mantener pulsada una serie abre el teclado en sus kilos (sin marcarla)');
    await teclado.getByRole('button', { name: 'Ocultar el teclado' }).click();
    await hay(teclado, 0);
    // (revisión M1) mantener pulsado más de un segundo sobre ✓ y soltar: el clic de detrás no marca ni desmarca nada
    for (const [n, hecha] of [[1, true], [3, false]]) {
      const b = ej.locator(`.serie[data-n="${n}"] .hecho-btn`);
      await b.scrollIntoViewIfNeeded();
      const rb = await b.boundingBox();
      await toque('touchStart', rb.x + rb.width / 2, rb.y + rb.height / 2);
      await p.waitForTimeout(1500);
      await toque('touchEnd');
      await p.waitForTimeout(800);
      check(await b.getAttribute('aria-pressed') === (hecha ? 'true' : 'false') && await p.locator('.toast', { hasText: `Serie ${n} quitada` }).count() === 0,
        `mantener pulsado 1,5 s el ✓ de la serie ${n} (${hecha ? 'hecha' : 'sin hacer'}) y soltar no la ${hecha ? 'quita' : 'marca'}`);
      if (await teclado.count()) { await teclado.getByRole('button', { name: 'Ocultar el teclado' }).click(); await hay(teclado, 0); }
    }
    await saltar();

    // ---------------------------------------------------------------- 2. el cambio pasa a las series siguientes, con «Deshacer»
    // Un ejercicio con series iguales (sin top ni back-off) y ninguna hecha
    const ejs = p.locator('.ejercicio');
    let iguales = null;
    for (let i = 1; i < await ejs.count() && !iguales; i++) {
      const x = ejs.nth(i);
      if (!(await x.locator('.ejercicio-cuerpo').count())) await x.locator('.ejercicio-cab').click();
      await x.locator('.ejercicio-cuerpo').waitFor();
      const ns = await x.locator('.serie .n').allTextContents();
      const reps = await x.locator('.serie').evaluateAll((fs) => fs.map((f) => f.querySelectorAll('.celda')[1]?.getAttribute('placeholder')));
      // (con carga: el récord del aviso conjunto sale de los kilos)
      const kgs = await x.locator('.serie').evaluateAll((fs) => fs.map((f) => f.querySelectorAll('.celda')[0]?.getAttribute('placeholder')));
      if (ns.slice(0, 3).join() === '1,2,3' && reps[0] && reps[0] === reps[1] && reps[1] === reps[2] && /^\d/.test(kgs[0] || '') && kgs[0] === kgs[1] && kgs[1] === kgs[2]
        && await x.getByRole('button', { name: /^Quitar la serie/ }).count() === 0) iguales = x;
    }
    if (!iguales) check(false, 'hay un ejercicio con tres series iguales para probar el cambio que pasa a las siguientes');
    else {
      const reps1 = iguales.getByLabel('Repeticiones de la serie 1');
      const pr = await reps1.getAttribute('placeholder');
      const nuevo = String(Math.max(1, Number(pr) - 2));
      await reps1.click();
      await esperar(() => document.querySelector('.teclado-serie')?.dataset.campo === 'reps');
      for (const c of nuevo) await tecla(c).click();
      await teclado.getByRole('button', { name: /^Siguiente/ }).click();
      const aviso = p.locator('.toast', { hasText: 'También en las series 2 y 3' });
      await aviso.waitFor();
      check(await iguales.getByLabel('Repeticiones de la serie 2').inputValue() === nuevo && await iguales.getByLabel('Repeticiones de la serie 3').inputValue() === nuevo
        && await aviso.getByRole('button', { name: 'Deshacer' }).count() === 1 && await esperar(() => { const t = document.querySelector('.toast')?.getBoundingClientRect(), k = document.querySelector('.teclado-serie')?.getBoundingClientRect(); return t && k && t.bottom <= k.top; }),
        `cambiar las repeticiones de la serie 1 (${pr} → ${nuevo}) las cambia en la 2 y la 3, que llevaban lo mismo: «También en las series 2 y 3 · Deshacer» (encima del teclado)`);
      await aviso.getByRole('button', { name: 'Deshacer' }).click();
      await esperar(() => true, null, 200);
      check(await hay(iguales.locator('.serie[data-n="2"] .celda').nth(1).and(p.locator('[value=""]')), 1, 3000) || (await iguales.getByLabel('Repeticiones de la serie 2').inputValue() === '' && await iguales.getByLabel('Repeticiones de la serie 3').inputValue() === ''),
        'tras «Deshacer», la 2 y la 3 vuelven exactamente a como estaban (vacías, con lo propuesto en gris)');
      check(await iguales.getByLabel('Repeticiones de la serie 2').inputValue() === '' && await iguales.getByLabel('Repeticiones de la serie 3').inputValue() === '' && await reps1.inputValue() === nuevo,
        'y la serie 1 se queda como la dejaste');
      if (await teclado.count()) { await teclado.getByRole('button', { name: 'Ocultar el teclado' }).click(); await hay(teclado, 0); }
      // (revisión M2 y L3) deslizar con el teclado abierto: como «Hecha», suelta el campo (el cambio pasa a las siguientes), cierra
      // el teclado y guarda la serie una sola vez; el aviso junta el récord y «También en las series 2 y 3 · Deshacer»
      await p.evaluate(() => { window.__guardadas = 0; });
      const kgI = iguales.getByLabel('Kilos de la serie 1');
      await kgI.click();
      await esperar(() => document.querySelector('.teclado-serie')?.dataset.campo === 'kg');
      for (const c of '200') await tecla(c).click();
      await deslizar(iguales.locator('.serie[data-n="1"]'), [12, 40, 80, 120, 160, 200]);
      const avisoD = p.locator('.toast', { hasText: 'También en las series 2 y 3' });
      await avisoD.waitFor();
      await p.waitForTimeout(1500);
      await p.locator('.sesion-vista .cabecera h1').click();
      await p.waitForTimeout(800);
      const textoD = (await avisoD.textContent().catch(() => '')) || '';
      check(await iguales.getByRole('button', { name: 'Quitar la serie 1' }).count() === 1 && await hay(teclado, 0) && await p.evaluate(() => window.__guardadas) === 1
        && await iguales.getByLabel('Kilos de la serie 2').inputValue() === '200' && await iguales.getByLabel('Kilos de la serie 3').inputValue() === '200',
        `deslizar con el teclado abierto marca la serie, cierra el teclado, pasa los 200 kg a la 2 y la 3 y la guarda una sola vez (${await p.evaluate(() => window.__guardadas)})`);
      check(/¡Récord en .+! · También en las series 2 y 3/.test(textoD) && await avisoD.getByRole('button', { name: 'Deshacer' }).count() === 1,
        `el récord y el cambio en un solo aviso, con «Deshacer» a mano («${textoD.replace('Deshacer', '').trim()}»)`);
      await avisoD.getByRole('button', { name: 'Deshacer' }).click();
      check(await esperar(() => { const f = [...document.querySelectorAll('.ejercicio')].find((x) => x.querySelector('.serie[data-n="1"] .hecho-btn[aria-pressed="true"]') && x !== document.querySelector('.ejercicio'));
        return f && f.querySelector('.serie[data-n="2"] .celda').value === '' && f.querySelector('.serie[data-n="3"] .celda').value === ''; }, null, 3000)
        && await iguales.getByRole('button', { name: 'Quitar la serie 1' }).count() === 1,
        'y «Deshacer» devuelve la 2 y la 3 a como estaban (la serie marcada se queda)');
      await saltar();
    }

    // ---------------------------------------------------------------- volver al teclado del móvil (y a la app)
    await kg1.scrollIntoViewIfNeeded();
    const kg3 = ej.getByLabel('Kilos de la serie 3');
    await kg3.click();
    await teclado.waitFor();
    await teclado.getByRole('button', { name: 'Usar el teclado del móvil' }).click();
    await hay(teclado, 0);
    check(await kg3.getAttribute('inputmode') === 'decimal' && await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes')).tecladoApp === false) && await ej.locator('select.rpe').count() > 0
      && await p.locator('.toast', { hasText: 'Vuelve el teclado del móvil' }).count() === 1,
      '«Usar el teclado del móvil» vuelve al de siempre (los campos con su teclado y el RPE en su desplegable) y se guarda en este móvil');
    await p.locator('.sesion-vista .cabecera').getByRole('button', { name: 'Volver' }).click();
    await p.locator('nav.tabs').waitFor();
    await p.evaluate(() => { location.hash = '#perfil'; });
    const sw = p.getByRole('switch', { name: /Teclado de la app al apuntar las series/ });
    await sw.waitFor();
    check(!(await sw.isChecked()), 'en Perfil → Este móvil, «Teclado de la app al apuntar las series», apagado');
    await sw.check();
    check(await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes')).tecladoApp === true), 'y se vuelve a encender ahí');
    await p.locator('.tab', { hasText: 'Hoy' }).click();
    await p.locator('.hero-dia').getByRole('button', { name: /Continuar sesión|Empezar sesión/ }).click();
    await p.locator('.ejercicio').first().waitFor();

    // ---------------------------------------------------------------- el modo enfoque
    await p.getByRole('button', { name: 'Modo enfoque' }).click();
    const enf = p.getByRole('dialog', { name: 'Modo enfoque' });
    await enf.waitFor();
    await enf.getByLabel('Kilos', { exact: true }).click();
    await enf.locator('.teclado-serie').waitFor();
    check(await enf.getByLabel('Kilos', { exact: true }).getAttribute('inputmode') === 'none' && await enf.locator('.teclado-serie').getAttribute('data-campo') === 'kg',
      'en el modo enfoque, el mismo teclado (dentro de su pantalla)');
    await enf.locator('.teclado-serie').getByRole('button', { name: /^Siguiente/ }).click();
    await esperar(() => document.querySelector('.enfoque .teclado-serie')?.dataset.campo === 'reps');
    await enf.locator('.teclado-serie').getByRole('button', { name: /^Siguiente/ }).click();
    await esperar(() => document.querySelector('.enfoque .teclado-serie')?.dataset.campo === 'rpe');
    const hechasAntes = await enf.locator('.chip-serie.hecha').count();
    await enf.locator('.teclado-serie').getByRole('button', { name: /^Hecha: marcar la/ }).click();
    await hay(enf.locator('.chip-serie.hecha'), hechasAntes + 1);
    check(await enf.locator('.teclado-serie').count() === 0, 'y «Siguiente» llega a «Hecha», que marca la serie');
    const tarjetaE = enf.locator('.temporizador .ahora-toca');
    if (await hay(tarjetaE, 1, 4000)) {
      await revisar('enfoque-ahora-toca');
      await tarjetaE.click();
      await esperar(() => document.querySelector('.enfoque .teclado-serie')?.dataset.campo === 'kg');
      check(await enFoco() === 'Kilos', 'en el modo enfoque, «Ahora toca» también lleva a esa serie con el teclado en los kilos');
      await p.keyboard.press('Escape');
      await hay(enf.locator('.teclado-serie'), 0);
      check(await enf.isVisible(), 'Escape cierra el teclado, no el modo enfoque');
    } else check(false, 'en el modo enfoque, tras marcar, el descanso trae «Ahora toca»');
  } catch (e) {
    check(false, `apuntar las series de la v0.63: ${e.message.split('\n').slice(0, 6).join(' ')}`);
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}

// Suelto: node test/e2e-teclado-063.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarTeclado063({ navegador, check });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
