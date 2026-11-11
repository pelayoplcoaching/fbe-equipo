// v0.133: la carrera (migración 056) en la demo. Lo llama e2e.test.mjs.
//   · El coach: la pestaña Carrera de Carlos (zonas de su FC umbral, macrociclo, semanas del plan, carreras, revisiones y
//     biblioteca), añade una carrera, prepara una semana con una sesión de la biblioteca y, en el editor, pasa las
//     sesiones de carrera del plan a la semana de entreno; el interruptor en Datos.
//   · El atleta: en Hoy, su carrera con la cuenta atrás; «Tu carrera»; la sesión de calidad por partes con sus zonas y el
//     semáforo (en ámbar, las series tachadas); al terminar, cómo llegó, la FC y el dolor; el coach lo ve.
//   · Sin errores ni fallos de accesibilidad, también a 360 px en oscuro.
import { createRequire } from 'node:module';
import { devices } from 'playwright';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarCarrera133({ navegador, check, base = 'http://localhost:4174', fotos = process.env.FOTOS || null }) {
  const errores = [];
  const ctx = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|blob:/.test(m.text())) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const foto = async (nombre, loc = null) => { if (fotos) await (loc || p).screenshot({ path: `${fotos}/${nombre}.png`, ...(loc ? {} : { fullPage: false }) }); };
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
  const estrecho = async (paso) => {
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar(`${paso}-360-oscuro`);
    await foto(`${paso}-360-oscuro`);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
  };
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const entrarComo = async (quien) => {
    for (let intento = 0; intento < 3; intento++) {
      await cerrarDialogos();
      const cambiar = p.getByRole('button', { name: 'Cambiar de cuenta' });
      if (await cambiar.count()) await cambiar.first().click().catch(() => {});
      else await p.goto(`${base}/?demo`);
      const boton = p.getByRole('button', { name: quien }).first();
      if (await boton.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) { await boton.click(); break; }
    }
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(800);
    await cerrarDialogos();
  };
  const abrirCarlos = async (pestana) => {
    await p.locator('.tab', { hasText: 'Atletas' }).click();
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Carlos Vera' }).first().click();
    await p.getByRole('tab', { name: pestana }).first().click();
  };

  try {
    // ---------------------------------------------------------------- el coach
    await entrarComo(/Pelayo/);
    await abrirCarlos('Carrera');
    const ficha = p.locator('.carrera-ficha');
    await ficha.waitFor();
    const zonas = ficha.locator('.tabla-zonas tbody tr');
    await zonas.first().waitFor();
    check(await zonas.count() === 5 && (await zonas.nth(3).textContent()).includes('168–175 ppm') && (await zonas.nth(0).textContent()).includes('≤149 ppm'),
      'la pestaña Carrera: sus cinco zonas salen de su FC umbral (176): Z4 168–175 ppm, Z1 hasta 149');
    check(await ficha.locator('.macro-fase').count() === 5 && (await ficha.locator('.macro-fase.actual').textContent()).includes('Base'), 'el macrociclo con sus 5 fases, y la de ahora (Base) marcada');
    check(await ficha.locator('.semana-carrera').count() === 19 && (await ficha.locator('.semana-carrera.actual').textContent()).includes('1.a calidad'), 'las 19 semanas del plan, con la de esta semana (S6, «1.a calidad») marcada');
    check(await ficha.locator('.evento-carrera').count() === 3 && /Faltan \d+ semanas/.test(await ficha.locator('.carrera-resumen').textContent()), 'sus tres carreras y, arriba, la objetivo con la cuenta atrás');
    check(await ficha.locator('.lista-revisiones li').count() === 2 && (await ficha.locator('.lista-hecho-carrera li').count()) >= 1, 'las revisiones y lo último que ha corrido');
    await foto('1-coach-carrera');
    await revisar('coach-carrera');

    // Una carrera nueva
    await ficha.getByRole('button', { name: 'Carrera', exact: true }).click();
    let hoja = p.getByRole('dialog', { name: 'Nueva carrera' });
    await hoja.waitFor();
    await hoja.getByLabel('Nombre').fill('San Silvestre');
    const finAno = `${new Date().getFullYear()}-12-31`;
    await hoja.getByLabel('Fecha').fill(finAno);
    await hoja.getByLabel('Distancia (km)').fill('10');
    await hoja.getByRole('group', { name: 'Prioridad' }).getByRole('button', { name: 'C', exact: true }).click();
    await hoja.getByLabel('Tiempo objetivo').fill('50:00');
    await revisar('coach-carrera-nueva');
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    check(await hay(ficha.locator('.evento-carrera', { hasText: 'San Silvestre' }), 1) && (await ficha.locator('.evento-carrera', { hasText: 'San Silvestre' }).textContent()).includes('objetivo 50:00 (5:00 min/km)'),
      'el coach añade una carrera: sale en su lista con el objetivo y su ritmo');

    // Una semana: una sesión de la biblioteca
    await ficha.locator('.semana-carrera', { hasText: 'S9' }).getByRole('button').click();
    hoja = p.getByRole('dialog').last();
    await hoja.getByRole('button', { name: 'Sesión', exact: true }).click();
    const ses = hoja.locator('.sesion-plan').last();
    await ses.getByLabel(/tipo/).selectOption('calidad');
    await ses.getByRole('button', { name: /Partes/ }).click();
    await ses.locator('select').filter({ hasText: 'Desde la biblioteca' }).focus();
    await p.waitForTimeout(300);
    await ses.locator('select').filter({ hasText: 'Desde la biblioteca' }).selectOption({ label: 'Umbral 3 × 6 min' });
    await ses.locator('.parte-fila').nth(2).waitFor();
    check(await ses.locator('.parte-fila').count() === 3 && (await ses.getByLabel(/título/).inputValue()) === 'Umbral 3 × 6 min', 'en una semana del plan, «Desde la biblioteca» trae las partes de una sesión de calidad');
    await hoja.getByLabel('Etiqueta').fill('Construir');
    await hoja.getByLabel('Km (mínimo)').fill('16');
    await hoja.getByLabel('Km (máximo)').fill('18');
    await foto('2-coach-semana');
    await revisar('coach-semana');
    await hoja.getByRole('button', { name: 'Guardar la semana' }).click();
    await hay(p.getByRole('dialog'), 0);
    const s9 = ficha.locator('.semana-carrera', { hasText: 'S9' });
    check(/Umbral 3 × 6 min/.test(await s9.textContent()) && /16–18 km/.test(await s9.textContent()), 'la semana guardada: su etiqueta, sus km y la sesión');

    // El editor: la carrera de la semana en borrador (S8 del plan) se pasa a la semana de entreno
    await p.getByRole('tab', { name: 'Programa' }).first().click();
    const plan = p.locator('.plan-carrera-semana');
    await plan.waitFor();
    check(/10K/.test(await plan.textContent()) && /semana 8 de 19/.test(await plan.textContent()), 'en el editor, lo que el plan prevé para esa semana (S8, la de la 10K)');
    await plan.getByRole('button', { name: /Añadir las 2 sesiones de carrera/ }).click();
    const sesion10k = p.locator('.editor-sesion').filter({ has: p.locator('input[aria-label="Nombre de la sesión"][value="10K del barrio"]') });
    await sesion10k.first().waitFor();
    check(await hay(p.locator('.plan-carrera-semana', { hasText: 'Ya están en la semana' }), 1), 'un toque y las sesiones de carrera del plan pasan a la semana de entreno (y no se repiten)');
    const rodaje = p.locator('.editor-sesion').filter({ has: p.locator('input[aria-label="Nombre de la sesión"][value="Rodaje fácil"]') }).first();
    check(await rodaje.locator('.campos-carrera').count() === 1 && await rodaje.locator('.campos-carrera select').first().inputValue() === 'facil', 'en el editor, la sesión de carrera lleva su tipo, rangos, zona y partes');
    await foto('3-coach-editor', p.locator('.plan-carrera-semana'));
    await foto('3b-coach-editor-rodaje', rodaje);
    await revisar('coach-editor');

    await p.getByRole('tab', { name: 'Datos' }).first().click();
    check(await p.locator('#d-carrera').isChecked(), 'en Datos, «También le llevas la carrera», encendido');
    await p.getByRole('button', { name: 'Volver a atletas' }).click();

    // ---------------------------------------------------------------- el atleta
    await entrarComo(/Carlos Vera/);
    await p.locator('.tab', { hasText: 'Hoy' }).click();
    const tarjeta = p.locator('.tarjeta-carrera-hoy');
    await tarjeta.waitFor();
    check(/Media maratón de primavera: faltan \d+ semanas/.test(await tarjeta.textContent()) && /semana 6 de 19/.test(await tarjeta.textContent()), 'en Hoy, su carrera: la cuenta atrás y la semana del plan');
    await tarjeta.click();
    hoja = p.getByRole('dialog', { name: 'Tu carrera' });
    await hoja.waitFor();
    await hoja.locator('.tabla-zonas').waitFor();
    check(/Faltan \d+ semanas/.test(await hoja.locator('.carrera-objetivo').textContent()) && await hoja.locator('.macro-fase').count() === 5 && (await hoja.textContent()).includes('Esta semana (semana 6)'),
      '«Tu carrera»: la objetivo con la cuenta atrás, el macrociclo y esta semana');
    check(await hoja.locator('.tabla-zonas tbody tr').count() === 5 && await hoja.locator('.evento-carrera').count() === 4 && await hoja.locator('.km-semana').count() >= 5, 'sus zonas, sus cuatro carreras y los km de cada semana');
    await foto('4-tu-carrera');
    await revisar('tu-carrera');
    await estrecho('tu-carrera');
    await hoja.getByRole('button', { name: 'Cerrar' }).first().click();

    // La sesión de calidad por partes y el semáforo
    await p.locator('.tab', { hasText: 'Semana' }).click();
    await p.locator('.dia', { hasText: 'Umbral 2 × 6 min' }).first().click();
    await p.locator('.portada-sesion, .sesion-vista').first().waitFor();
    if (await p.locator('.portada-sesion').count()) {
      check(await hay(p.locator('.detalle-carrera .lista-partes .parte'), 4), 'ya en la portada de la sesión, sus partes y el semáforo');
      await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    }
    const det = p.locator('.sesion-vista .detalle-carrera');
    await det.waitFor();
    check(await det.locator('.lista-partes .parte').count() === 4 && /Z4 \(168–175 ppm\)/.test(await det.textContent()) && /2 × 6 min/.test(await det.textContent()),
      'la sesión de calidad, por partes: calentar, strides, 2 × 6 min en Z4 con sus pulsaciones y enfriar');
    await det.getByRole('button', { name: 'Regular' }).click();
    check(/min suaves en Z1–Z2, sin series/.test(await det.locator('.semaforo-texto').textContent()) && await det.locator('.lista-partes.en-ambar').count() === 1, 'el semáforo en ámbar: le dice qué hacer hoy y tacha las series');
    await p.waitForTimeout(1200);
    await foto('5-sesion-carrera', p.locator('.sesion-vista .tarjeta-cardio'));
    await revisar('sesion-carrera');
    await p.getByRole('button', { name: 'Terminar sesión' }).click();
    hoja = p.getByRole('dialog', { name: 'Terminar sesión' });
    await hoja.waitFor();
    check(await hoja.getByRole('group', { name: 'Cómo llegaste' }).getByRole('button', { name: 'Ámbar' }).getAttribute('aria-pressed') === 'true', 'al terminar, «¿Cómo llegaste?» trae el semáforo que eligió');
    await hoja.getByLabel('minutos de cardio', { exact: true }).fill('38');
    await hoja.getByLabel('kilómetros', { exact: true }).fill('6');
    await hoja.locator('.mas-carrera summary').click();
    await hoja.getByLabel('pulsaciones medias', { exact: true }).fill('158');
    await hoja.getByLabel('pulsaciones máximas', { exact: true }).fill('176');
    await hoja.getByLabel(/Dolor/).selectOption('2');
    await hoja.getByRole('group', { name: 'RPE de la sesión' }).getByRole('button', { name: '6', exact: true }).click();
    await foto('6-terminar-carrera');
    await revisar('terminar-carrera');
    await hoja.getByRole('button', { name: 'Guardar y terminar' }).click();
    await p.getByRole('heading', { name: 'Sesión terminada' }).waitFor();
    check(true, 'guarda lo hecho de la carrera');
    await p.getByRole('button', { name: 'Volver a hoy' }).click();

    // El coach lo ve
    await entrarComo(/Pelayo/);
    await abrirCarlos('Carrera');
    const hecho = p.locator('.lista-hecho-carrera li', { hasText: 'Umbral 2 × 6 min' });
    await hecho.waitFor();
    const t = await hecho.textContent();
    check(/38 min, 6 km/.test(t) && /FC media 158, máx\. 176/.test(t) && /dolor 2\/10/.test(t) && /Ámbar/.test(t), 'el coach ve lo que corrió: minutos, km, la FC, el dolor y que llegó en ámbar');
    await estrecho('coach-carrera');
  } catch (e) {
    errores.push(`se cortó: ${e.message.split('\n').slice(0, 4).join(' / ')}`);
    await foto('fallo').catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 1200)}` : ''}`);
  await ctx.close();
}

// Suelto: node test/e2e-carrera-133.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarCarrera133({ navegador, check });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
