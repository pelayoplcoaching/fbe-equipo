// (v0.140) Hoy a tu gusto, en la demo (Ana López: entreno, nutrición y salud): los diales con Comida, «Ordenar Hoy»
// (quitar un dial, subir una sección, ocultar otra), lo oculto plegado al final y abierto desde «Tu día», que se recuerda
// al volver a abrir la app y «Dejarlo como venía». A 390 px, sin errores, sin desbordes y con axe.
//   Dentro de e2e.test.mjs:  const { probarPanelHoy } = await import('./e2e-panel-hoy.mjs'); await probarPanelHoy({ navegador, check });
import { createRequire } from 'node:module';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarPanelHoy({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
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
  const quieto = () => p.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 1500)),
  ]));
  const axe = async (paso) => {
    await quieto();
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > 390) errores.push(`${paso}: la página se desborda en horizontal (${ancho} px)`);
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations
      .filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (r.length) errores.push(`${paso}: ${r.join(' · ')}`);
  };
  const ordenDeHoy = () => p.evaluate(() => [...document.querySelectorAll('.contenido details.plegable-hoy:not([hidden])')]
    .filter((d) => !d.closest('.ocultas-hoy')).map((d) => d.dataset.plegable));
  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await p.locator('.diales .dial').first().waitFor();
    const comida = p.locator('.diales .dial', { hasText: 'Comida' });
    await comida.waitFor({ timeout: 8000 }).catch(() => {});
    const nombres = await p.locator('.diales .dial-nombre').allTextContents();
    check(nombres.join() === 'Constancia,Carga,Cómo llegas,Comida,Sueño' && await p.locator('.diales.diales-dos-filas').count() === 1, `Ana (con nutrición y Salud) ve Comida y Sueño junto a los de siempre, en dos filas (${nombres.join(', ')})`);
    check(await p.locator('.diales .dial', { hasText: 'Pasos' }).count() === 0, 'sin pasos de hoy en Salud, el de Pasos no sale');
    await comida.click();
    const hojaC = p.getByRole('dialog', { name: 'Comida de hoy' });
    await hojaC.waitFor();
    check(await hojaC.locator('.dial-hoja-cifras > div').count() === 3 && /Tu objetivo/.test(await hojaC.textContent()), 'tocarlo abre lo apuntado, su objetivo y lo que le queda');
    await p.keyboard.press('Escape');
    await hojaC.waitFor({ state: 'detached' });
    // (v0.141) el de Sueño abre «Tu reloj, de un vistazo»
    await p.locator('.diales .dial', { hasText: 'Sueño' }).click();
    const hojaR = p.getByRole('dialog', { name: 'Tu reloj, de un vistazo' });
    await hojaR.waitFor();
    const filasR = await hojaR.locator('tbody th').allTextContents();
    check(filasR.join() === 'Pasos hoy,Sueño anoche,Pulso en reposo,HRV', `el de Sueño abre «Tu reloj, de un vistazo»: hoy y su media de pasos, sueño, pulso y HRV (${filasR.join(', ')})`);
    await axe('tu-reloj');
    await p.keyboard.press('Escape');
    await hojaR.waitFor({ state: 'detached' });
    const antes = await ordenDeHoy();
    check(antes[0] === 'sesion' || antes[0] === 'semana', `las secciones, en el orden de siempre (${antes.join(', ')})`);
    // Ordenar Hoy
    await p.getByRole('button', { name: 'Ordenar Hoy' }).click();
    const hoja = p.getByRole('dialog', { name: 'Ordenar Hoy' });
    await hoja.waitFor();
    await axe('ordenar-hoy');
    await hoja.getByRole('switch', { name: /Carga/ }).click();
    await p.waitForFunction(() => document.querySelectorAll('.diales .dial').length === 4);
    check(await p.locator('.diales .dial', { hasText: 'Carga' }).count() === 0, 'quitar el dial de Carga: se va al momento (detrás de la hoja)');
    const subirPeso = hoja.getByRole('button', { name: 'Subir Tu peso' });
    for (let i = 0; i < 8 && (await subirPeso.getAttribute('aria-disabled')) !== 'true'; i++) { await subirPeso.click(); await p.waitForTimeout(80); }
    check(/Tu peso: ahora la primera/.test(await hoja.locator('[aria-live]').textContent()), 'subir «Tu peso» arriba del todo, y se anuncia');
    await hoja.getByRole('button', { name: 'Ocultar Esta semana' }).click();
    check(await hoja.getByRole('button', { name: 'Mostrar Esta semana' }).count() === 1, 'ocultar «Esta semana» (el botón pasa a «Mostrar»)');
    await hoja.getByRole('button', { name: 'Listo' }).click();
    await hoja.waitFor({ state: 'detached' });
    const despues = await ordenDeHoy();
    check(despues[0] === 'peso' && !despues.includes('semana'), `Hoy, en su orden: primero su peso, sin «Esta semana» (${despues.join(', ')})`);
    const ocultas = p.locator('details.ocultas-hoy');
    check(/Lo que has ocultado \(1\)/.test(await ocultas.locator(':scope > summary').textContent()) && await ocultas.locator('details[data-plegable="semana"]').count() === 1, 'lo oculto, plegado al final: «Lo que has ocultado (1)»');
    await axe('hoy-ordenado');
    // Al volver a abrir la app, sigue igual
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await p.locator('.diales .dial').first().waitFor();
    await p.waitForTimeout(500);
    const tras = await ordenDeHoy();
    check(tras[0] === 'peso' && !tras.includes('semana') && await p.locator('.diales .dial', { hasText: 'Carga' }).count() === 0, 'al volver a abrir la app, Hoy sigue como lo dejó (en este móvil)');
    // Dejarlo como venía
    await p.getByRole('button', { name: 'Ordenar Hoy' }).click();
    await hoja.waitFor();
    await hoja.getByRole('button', { name: 'Dejarlo como venía' }).click();
    check(await hoja.getByRole('button', { name: 'Dejarlo como venía' }).count() === 0, '«Dejarlo como venía» deshace todo (y desaparece)');
    await hoja.getByRole('button', { name: 'Listo' }).click();
    await hoja.waitFor({ state: 'detached' });
    check((await ordenDeHoy()).join() === antes.join() && await p.locator('details.ocultas-hoy').count() === 0 && await p.locator('.diales .dial').count() === 5, 'y Hoy vuelve a ser el de siempre');
    check(!errores.length, `Hoy a tu gusto, sin errores, desbordes ni fallos de accesibilidad${errores.length ? `: ${errores.slice(0, 4).join(' | ')}` : ''}`);
  } finally {
    await ctx.close();
  }
}
