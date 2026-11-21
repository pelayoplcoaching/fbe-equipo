// (v0.206) Registro y Actividad, segunda tanda, en el navegador: la semana arriba, el desvío de esfuerzo, la minilínea,
// comentar una serie, su día frente a lo habitual, copiar y comparar sesiones, por ejercicios y descargar el bloque; y en
// la Actividad, su ritmo, «Para mirar», lo que cuelga de cada sesión, la semana desplegada (con su resumen), cada pesada
// con su tendencia, las miniaturas, «Lo mío también», lo visto y el calendario. A 390 px en claro y a 360 en oscuro.
//   Suelta:  npm run build && node test/e2e-registro-206.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRegistro206({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(120); } return !!(await fn().catch(() => false)); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 1280;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 2500)),
    ]));
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: { region: { enabled: false } },
      exclude: [['.chat-dia-flotante']],
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
  }
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      await p.waitForTimeout(350);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const toast = (re) => hasta(async () => (await p.locator('.toast', { hasText: re }).count()) >= 1);

  for (const [ancho, tema] of [[390, 'light'], [360, 'dark']]) {
    errores.length = 0;
    const primera = ancho === 390;
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: 800 }, colorScheme: tema, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true, isMobile: true, bypassCSP: true });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base }).catch(() => {});
    try {
      p = await ctx.newPage();
      p.on('pageerror', (e) => errores.push(e.message));
      await p.goto(`${base}/?demo`);
      await p.locator('button.persona', { hasText: 'Pelayo' }).first().click();
      await p.locator('nav.tabs').waitFor();
      await cerrarDialogos();
      await p.locator('nav.tabs .tab', { hasText: 'Atletas' }).first().click();
      await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().click();

      // ---------------------------------------------------------------- Registro
      await p.getByRole('tab', { name: 'Registro' }).first().click();
      const ses = p.locator('.registro-sesion').first();
      await ses.waitFor({ timeout: 10000 });
      if (primera) {
        const sem = p.locator('.registro-semana');
        check(await sem.count() === 1 && /Semana \d+/.test(await sem.textContent()) && /Sesiones\d+de\d+/.test((await sem.textContent()).replace(/\s+/g, '')) && /Toneladas/.test(await sem.textContent()), `(2) la semana arriba: sesiones, series, toneladas y esfuerzo («${(await sem.textContent()).replace(/\s+/g, ' ').slice(0, 90)}»)`);
        check(await p.locator('.registro-ej .registro-desvio').count() >= 1 && /(por encima|por debajo) de lo pautado|justo en lo pautado/.test(await p.locator('.registro-ej .registro-desvio').first().textContent()), `(4) el desvío de esfuerzo de cada ejercicio («${await p.locator('.registro-ej .registro-desvio').first().textContent().catch(() => '')}»)`);
        check(await p.locator('.registro-ej-cab svg.registro-linea').count() >= 1, '(3) la minilínea de su 1RM en el bloque, junto al nombre');
        const rend = p.locator('.registro-dia .chip', { hasText: 'Rindió' });
        check(!(await rend.count()) || /^Rindió [+−±][\d,]+ % frente a la vez anterior$/.test((await rend.first().textContent()).trim()), `(7) su día frente a la vez anterior${await rend.count() ? ` («${(await rend.first().textContent()).trim()}»)` : ' (sin vez anterior que comparar)'}`);
        // Comentar una serie
        await ses.locator('button.serie-ficha').first().click();
        const form = p.locator('.registro-comentar');
        check(await hasta(async () => await form.isVisible()) && /^Sobre la serie \d+ de /.test(await form.locator('label').textContent()), '(5) tocar una serie abre el comentario, con la serie citada');
        await form.locator('textarea').fill('Esta, con la espalda más firme');
        await form.getByRole('button', { name: 'Enviar' }).click();
        check(await toast(/Comentario enviado/), 'y va al hilo de la sesión');
        // Copiar la sesión
        await ses.getByRole('button', { name: 'Copiar', exact: true }).click();
        check(await toast(/Sesión copiada|No se ha podido copiar/), '(9) copiar una sesión como texto');
        const pegado = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
        if (pegado) check(/^S\d+: /.test(pegado) && pegado.split('\n').length >= 2, `con cada ejercicio en su línea («${pegado.split('\n')[0]}»)`);
        // Comparar
        await ses.getByRole('button', { name: 'Comparar', exact: true }).click();
        const cmp = p.locator('[role=dialog]', { hasText: 'Comparar sesiones' }).last();
        check(await hasta(async () => (await cmp.locator('.registro-comparar tbody tr').count()) >= 1), '(8) comparar dos sesiones lado a lado');
        await revisar('comparar');
        await p.keyboard.press('Escape');
        await cmp.waitFor({ state: 'hidden' }).catch(() => {});
        // Por ejercicios
        await p.getByRole('button', { name: 'Por ejercicios', exact: true }).click();
        const tabla = p.locator('.registro-por-ejercicio table');
        check(await hasta(async () => (await tabla.locator('tbody tr').count()) >= 2) && /S1/.test(await tabla.locator('thead').textContent()), `(1) por ejercicios: cada uno con sus semanas en columnas (${await tabla.locator('tbody tr').count()})`);
        await revisar('por-ejercicios');
        await p.getByRole('button', { name: 'Por sesiones', exact: true }).click();
        await ses.waitFor();
        // Descargar el bloque
        await p.getByRole('button', { name: 'Descargar el bloque', exact: true }).click();
        const hoja = p.locator('[role=dialog]', { hasText: 'El registro del bloque' }).last();
        check(await hasta(async () => await hoja.isVisible()), '(10) descargar el registro del bloque en hoja de cálculo');
        await p.keyboard.press('Escape');
        await hoja.waitFor({ state: 'hidden' }).catch(() => {});
        // Revisar la semana de un toque
        const rev = p.getByRole('button', { name: /^Revisar (la que falta|las \d+ que faltan)$/ });
        if (await rev.count()) {
          await rev.click();
          check(await toast(/revisadas?/), '(9) revisar la semana entera de un toque');
        } else check(true, '(9) (la semana ya estaba revisada)');
      } else {
        await p.getByRole('button', { name: 'Por ejercicios', exact: true }).click();
        await p.locator('.registro-por-ejercicio table').waitFor();
        await revisar(`por-ejercicios-${ancho}`);
        await p.getByRole('button', { name: 'Por sesiones', exact: true }).click();
        await ses.locator('button.serie-ficha').first().click();
        await p.locator('.registro-comentar').waitFor();
      }
      await revisar(`registro-${ancho}`);

      // ---------------------------------------------------------------- Actividad
      await p.getByRole('tab', { name: 'Actividad' }).first().click();
      await p.locator('.actividad-item').first().waitFor({ timeout: 10000 });
      if (primera) {
        check(await hasta(async () => /Su ritmo.*\d+ entrenos? en 4 semanas/.test(await p.locator('.act-ritmo').textContent())), `(20) su ritmo: estas 4 semanas frente a las 4 anteriores («${(await p.locator('.act-ritmo').textContent().catch(() => '')).trim()}»)`);
        const mirar = p.locator('.actividad-mirar');
        check(!(await mirar.count()) || (await mirar.locator('.mirar-item .chip.aviso').count()) >= 1, `(11) «Para mirar», con su motivo (${await mirar.locator('.mirar-item').count()})`);
        const hijos = p.locator('.actividad-hijos .act-hijo-record');
        check(!(await hijos.count()) || (await hijos.first().getByRole('button', { name: /^Felicitarle por su récord en / }).count()) >= 1, `(12) los récords de una sesión, colgando de ella, con «Felicitar» (${await hijos.count()})`);
        check(await p.locator('.actividad-item.act-record').count() === 0 || await hijos.count() === 0, 'y no sueltos en el día');
        // La semana desplegada
        const banda = p.locator('button.actividad-semana').first();
        await banda.click();
        const det = p.locator('.actividad-semana-detalle').first();
        check(await hasta(async () => await det.isVisible()) && /Sesiones/.test(await det.textContent()) && /Check-in/.test(await det.textContent()) && await banda.getAttribute('aria-expanded') === 'true', '(13) la banda de la semana se despliega: sesiones, comidas, peso y su check-in');
        await det.getByRole('button', { name: 'Copiar el resumen', exact: true }).click();
        check(await toast(/Resumen copiado|No se ha podido copiar/), '(19) y su resumen, listo para pegar');
        const res = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
        if (res) check(/^Ana, semana del /.test(res) && /- Sesiones: \d+/.test(res), `con lo de esa semana («${res.split('\n')[0]}»)`);
        // Cada pesada
        const peso = p.locator('.actividad-item.act-peso').first();
        check(await peso.count() === 1 && /Tendencia [\d,]+ kg/.test(await peso.textContent()), `(16) cada pesada con su tendencia («${(await peso.locator('.secundario').first().textContent().catch(() => '')).trim()}»)`);
        check(await p.locator('.act-peso-linea svg').count() >= 1, 'y la minilínea de su semana');
        // Las miniaturas
        const mini = p.locator('.actividad-fila .registro-video').first();
        if (await mini.count()) {
          await mini.click();
          check(await hasta(async () => (await p.locator('[role=dialog]').count()) >= 1), '(15) la foto o el vídeo se abre ahí mismo');
          await cerrarDialogos();
        } else check(true, '(15) (sin fotos ni vídeos en estos 30 días)');
        // Lo mío también
        const mio = p.getByRole('button', { name: 'Lo mío también', exact: true });
        await mio.click();
        check(await hasta(async () => (await p.locator('.actividad li.mio').count()) >= 1) && /Le escribiste en una sesión|Le felicitaste/.test(await p.locator('.actividad li.mio').first().textContent()), `(17) «Lo mío también»: lo que le escribiste, en otro color (${await p.locator('.actividad li.mio').count()})`);
        await mio.click();
        check(await hasta(async () => (await p.locator('.actividad li.mio').count()) === 0), 'y se quita');
        // Visto y «Todo visto»
        const vb = p.locator('.actividad .act-visto-btn[aria-pressed="false"]').first();
        await vb.click();
        check(await hasta(async () => (await p.locator('.actividad li.apagado').count()) >= 1), '(18) marcar como visto: se apaga');
        check(await p.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('fbe-actividad-vistos:'))), 'y se acuerda (en este aparato)');
        await p.getByRole('button', { name: 'Todo visto', exact: true }).click();
        check(await hasta(async () => (await p.locator('.act-visto-btn[aria-pressed="false"]').count()) === 0) && await p.locator('.actividad-mirar').count() === 0, '«Todo visto»: todo apagado y nada en «Para mirar»');
        await revisar('actividad-vistos');
      } else {
        await p.locator('button.actividad-semana').first().click();
        await p.locator('.actividad-semana-detalle').first().waitFor();
        await p.getByRole('button', { name: 'Lo mío también', exact: true }).click();
      }
      // El calendario
      await p.getByRole('button', { name: 'Calendario', exact: true }).click();
      const cal = p.locator('.actividad-cal');
      await cal.waitFor();
      const dias = await cal.locator('.act-cal-dia').count();
      check(dias >= 28 && dias <= 31, `(14) el calendario del mes (${dias} días)`);
      const conSesion = cal.locator('.act-cal-dia.con-sesion').first();
      if (await conSesion.count()) {
        await conSesion.click();
        check(await hasta(async () => (await p.locator('.actividad-dia').count()) === 1 && (await p.locator('.actividad-dia .actividad-item').count()) >= 1) && await conSesion.getAttribute('aria-pressed') === 'true', 'tocar un día lo enseña debajo');
      } else check(true, '(sin entrenos este mes todavía)');
      if (primera) {
        const mes = await cal.locator('.act-cal-mes').textContent();
        await cal.getByRole('button', { name: 'Mes anterior' }).click();
        check(await hasta(async () => (await cal.locator('.act-cal-mes').textContent()) !== mes) && await cal.getByRole('button', { name: 'Mes siguiente' }).isEnabled(), `y se va al mes anterior (${mes} → ${await cal.locator('.act-cal-mes').textContent()})`);
        await cal.getByRole('button', { name: 'Mes siguiente' }).click();
        check(await cal.getByRole('button', { name: 'Mes siguiente' }).isDisabled(), 'sin pasar de este mes');
      }
      await revisar(`calendario-${ancho}`);
      await p.getByRole('button', { name: 'Lista', exact: true }).click();
      await p.locator('.actividad-item').first().waitFor();
      await revisar(`actividad-${ancho}`);
      check(errores.length === 0, `Registro y Actividad (segunda tanda) a ${ancho} px en ${tema === 'dark' ? 'oscuro' : 'claro'}, sin errores ni problemas de accesibilidad${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
    } finally { await ctx.close(); }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4196);
  const navegador = await chromium.launch();
  console.log('Registro y Actividad del atleta, segunda tanda (v0.206)');
  try { await probarRegistro206({ navegador, check, base: 'http://localhost:4196' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n')[0]); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
