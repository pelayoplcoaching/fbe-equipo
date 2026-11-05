// «Programar según FBE» (fase 1a), en la demo: el coach abre el programa de una atleta, pide la propuesta para la
// semana en borrador, la revisa (lo que hizo, lo propuesto, el motivo, la confianza), elige una alternativa, aplica y
// comprueba que la semana sigue en borrador con las pautas cambiadas. También la vista de peaking, el volumen por
// músculo y las reglas guardadas del atleta y de un ejercicio (fase 1b). En escritorio y a 360 px en oscuro, sin errores
// de consola, sin desbordes y sin fallos de accesibilidad.
//   Suelta:  npm run build && node test/e2e-programar-fbe.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarProgramarFBE } = await import('./e2e-programar-fbe.mjs'); await probarProgramarFBE({ navegador, check });
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarProgramarFBE({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const foto = async (nombre) => { if (capturas) await p.screenshot({ path: `${capturas}/${nombre}.png` }); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 1280;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const fuera = await p.evaluate((w) => [...document.querySelectorAll('[role=dialog] .carga-sug, [role=dialog] .selector-chips, [role=dialog] .btn')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > w + 1) && !el.closest('.selector-chips'); }).length, vista);
    if (fuera) errores.push(`${paso}: ${fuera} elementos de la hoja se salen de la pantalla`);
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
  // El texto de la pauta de un ejercicio en el editor (sus campos), para ver que cambió
  const semanaActiva = () => p.locator('.semanas-tabs button[aria-pressed="true"]').first().textContent();

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().click();
    await p.getByRole('tab', { name: /Programa/ }).first().click();
    await p.locator('.semanas-tabs').waitFor();

    // La semana en borrador que sigue a una con series: el botón está y no publica nada
    const boton = p.getByRole('button', { name: 'Programar según FBE', exact: true });
    check(await hay(boton, 1), 'en la semana en borrador que sigue a una hecha está «Programar según FBE»');
    const antes = (await semanaActiva()).trim();
    await boton.click();
    const hoja = p.getByRole('dialog').last();
    await hoja.locator('.carga-sug').first().waitFor();
    const filas = await hoja.locator('.carga-sug').count();
    check(filas >= 4 && /Programar la semana \d+ según FBE/.test(await hoja.textContent()), `la hoja enseña la propuesta ejercicio a ejercicio (${filas} filas)`);
    const texto = await hoja.textContent();
    check(/Hizo: /.test(texto) && /Confianza (alta|media|baja)/.test(texto) && /sigue en borrador/.test(texto), 'cada fila trae lo que hizo y la confianza, y la hoja dice que la semana sigue en borrador');
    check(await hoja.locator('.carga-sug input[type=checkbox]').count() >= 1 && /→/.test(texto), 'las filas que cambian se pueden marcar y enseñan el antes y el después');
    await foto('fbe-1-hoja-escritorio');
    await revisar('hoja-escritorio');

    // Reglas del atleta (fase 1b): un perfil cambia la propuesta entera, se guarda en su ficha y se puede deshacer
    const reglas = hoja.getByRole('region', { name: 'Reglas de este atleta' });
    check(await hay(reglas, 1) && /Reglas de Ana López/.test(await reglas.textContent()) && /Las de partida para su nivel/.test(await reglas.textContent()), 'la hoja enseña las reglas del atleta: de partida, las de su nivel');
    const suben = () => hoja.locator('.carga-sug .chip', { hasText: /^Sube kilos$/ }).count();
    const subenAntes = await suben();
    await reglas.getByRole('button', { name: 'Cambiar', exact: true }).click();
    await reglas.getByLabel('Perfil').selectOption({ label: 'En casa o de viaje' });
    await foto('fbe-6-reglas-atleta');
    await revisar('reglas-atleta');
    await reglas.getByRole('button', { name: 'Guardar reglas', exact: true }).click();
    check(await hay(reglas.getByText('Perfil En casa o de viaje.'), 1) && subenAntes >= 1 && await suben() === 0, `con el perfil «En casa o de viaje» ya no se proponen kilos (antes subían ${subenAntes})`);
    await reglas.getByRole('button', { name: 'Cambiar', exact: true }).click();
    await reglas.getByLabel('Básicos: mínimo de repeticiones').fill('9');
    await reglas.getByLabel('Básicos: máximo de repeticiones').fill('5');
    await reglas.getByRole('button', { name: 'Guardar reglas', exact: true }).click();
    check(await hay(reglas.getByRole('alert'), 1) && /Básicos: el rango/.test(await reglas.getByRole('alert').textContent()), 'un rango al revés no se guarda y dice por qué');
    await reglas.getByRole('button', { name: 'Volver a las de partida', exact: true }).click();
    check(await hay(reglas.getByText(/Las de partida para su nivel/), 1) && await suben() === subenAntes, 'al volver a las de partida, la propuesta es la de antes');

    // Regla propia de un ejercicio: se pone en su fila, cambia solo esa fila y sigue ahí al volver a abrir la hoja
    const filaSube = hoja.locator('.carga-sug', { has: p.locator('.chip', { hasText: /^Sube kilos$/ }) }).first();
    const ejercicio = (await filaSube.locator('strong').first().textContent()).trim();
    const fila = () => hoja.locator('.carga-sug', { has: p.locator('strong', { hasText: new RegExp(`^${ejercicio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
    await fila().getByRole('button', { name: `Poner una regla propia de ${ejercicio}`, exact: true }).click();
    const editor = hoja.getByRole('group', { name: `Regla propia de ${ejercicio}` });
    await editor.getByLabel('Cómo progresa').selectOption({ label: 'Mantener como está' });
    await editor.getByLabel('Salto de carga (kg)').fill('1,25');
    await foto('fbe-7-regla-ejercicio');
    await revisar('regla-ejercicio');
    await editor.getByRole('button', { name: 'Guardar regla', exact: true }).click();
    check(await hay(fila().locator('.chip', { hasText: /^Regla propia$/ }), 1) && await fila().locator('.chip', { hasText: /^Sube kilos$/ }).count() === 0 && /Regla propia: Mantener · sube de 1,25 kg en 1,25 kg\./.test(await fila().textContent()) && await suben() === subenAntes - 1,
      `la regla propia de ${ejercicio} cambia su fila y solo la suya`);
    check(await hay(reglas.getByText('1 ejercicio con regla propia.'), 1), 'y cuenta en el resumen de las reglas del atleta');
    await hoja.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await hay(p.getByRole('dialog'), 0);
    await boton.click();
    await hoja.locator('.carga-sug').first().waitFor();
    check(await hay(fila().locator('.chip', { hasText: /^Regla propia$/ }), 1), 'la regla está guardada en la ficha: sigue ahí al volver a abrir la hoja');
    await fila().getByRole('button', { name: `Cambiar la regla de ${ejercicio}`, exact: true }).click();
    await editor.getByRole('button', { name: 'Quitar regla', exact: true }).click();
    check(await hay(hoja.locator('.carga-sug .chip', { hasText: /^Regla propia$/ }), 0) && await suben() === subenAntes && await hay(reglas.getByText(/Las de partida para su nivel/), 1), 'al quitarla, todo vuelve a como estaba');

    // El volumen por músculo de la semana que quedaría: plegado, con el recuento y el rango de cada músculo
    const resumenVol = hoja.locator('details.vol-desglose summary');
    check(await resumenVol.count() === 1 && /Series por músculo en la semana \d+ con lo marcado/.test(await resumenVol.textContent()), 'la hoja resume las series por músculo de la semana que quedaría');
    if (await resumenVol.count()) {
      await resumenVol.click();
      const chipsVol = await hoja.locator('.vol-chips .vol-chip').count();
      check(chipsVol >= 4 && /\d+–\d+/.test(await hoja.locator('.vol-chips').textContent()), `al abrirlo, cada músculo con sus series y su rango (${chipsVol})`);
      await hoja.locator('details.vol-desglose').scrollIntoViewIfNeeded();
      await foto('fbe-5-volumen');
      await revisar('hoja-volumen');
    }

    // Ver la semana como peaking: en los básicos baja la top y se dice; al quitarlo, vuelve la propuesta normal
    const comoPico = hoja.getByRole('button', { name: 'Ver la semana como peaking', exact: true });
    check(await comoPico.count() === 1, 'con básicos en la semana, se puede ver como peaking');
    if (await comoPico.count()) {
      await comoPico.click();
      const enPico = await hay(hoja.getByText('Semana de peaking.'), 1);
      const chips = await hoja.locator('.carga-sug .chip', { hasText: /^Peaking$/ }).count();
      check(enPico && chips >= 1 && /por peaking/.test(await hoja.textContent()), `en peaking, los básicos lo dicen en su fila y en el motivo (${chips})`);
      check(await hoja.getByRole('button', { name: 'Sin peaking', exact: true }).count() >= 1, 'y cada uno se puede dejar sin peaking de un toque');
      await foto('fbe-4-peaking');
      await revisar('hoja-peaking');
      await hoja.getByRole('button', { name: 'Ver la semana sin peaking', exact: true }).click();
      check(await hay(hoja.locator('.carga-sug .chip', { hasText: /^Peaking$/ }), 0) && await hoja.getByText('Semana de peaking.').count() === 0, 'al quitarlo vuelve la propuesta normal');
    }

    // Marcar todas, elegir «Mantener» en una fila (deja de contar como cambio) y volver a la propuesta
    await hoja.getByRole('button', { name: 'Todas', exact: true }).click();
    const aplicar = hoja.locator('.btn-primario');
    const nTodas = Number((await aplicar.textContent()).match(/\d+/)?.[0] || 0);
    check(nTodas >= 1, `«Todas» marca las filas con cambios (${nTodas})`);
    const mantener = hoja.getByRole('button', { name: 'Mantener', exact: true }).first();
    if (await mantener.count()) {
      const fila = mantener.locator('xpath=ancestor::li[1]');
      const antesTxt = (await fila.textContent()).includes('→');
      await mantener.click();
      const despues = Number((await aplicar.textContent()).match(/\d+/)?.[0] || 0);
      check(await mantener.getAttribute('aria-pressed') === 'true' && (!antesTxt || despues <= nTodas), 'una alternativa de un toque cambia lo que se aplicaría en esa fila');
      await fila.getByRole('button', { name: 'Propuesta', exact: true }).click();
    }
    await hoja.getByRole('button', { name: 'Ninguna', exact: true }).click();
    check(await aplicar.isDisabled(), 'sin nada marcado no se puede aplicar');
    await hoja.getByRole('button', { name: 'Todas', exact: true }).click();

    // A 360 px en oscuro
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(400);
    await foto('fbe-2-hoja-360-oscuro');
    await revisar('hoja-360-oscuro');
    // Los dos formularios de reglas, también en estrecho y en oscuro
    await hoja.locator('.carga-sug').first().getByRole('button', { name: /^Poner una regla propia de / }).click();
    await hoja.getByRole('region', { name: 'Reglas de este atleta' }).getByRole('button', { name: 'Cambiar', exact: true }).click();
    await hoja.getByRole('group', { name: /^Regla propia de / }).scrollIntoViewIfNeeded();
    await foto('fbe-8-reglas-360-oscuro');
    await revisar('reglas-360-oscuro');
    await hoja.getByRole('group', { name: /^Regla propia de / }).getByRole('button', { name: 'Cancelar', exact: true }).click();
    await hoja.getByRole('region', { name: 'Reglas de este atleta' }).getByRole('button', { name: 'Cerrar', exact: true }).click();
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });

    // Aplicar: la hoja se cierra, la semana sigue siendo la misma y en borrador, y hay pautas serie a serie nuevas
    const n = Number((await aplicar.textContent()).match(/\d+/)?.[0] || 0);
    await aplicar.click();
    check(await hay(p.getByRole('dialog'), 0), 'al aplicar se cierra la hoja');
    await p.waitForTimeout(800);
    const ahora = (await semanaActiva()).trim();
    check(ahora === antes && /Borrador/.test(ahora), `la semana sigue en borrador tras aplicar ${n} cambios (${ahora})`);
    check(await p.getByText('Borrador: el atleta no verá esta semana hasta que la publiques.').count() === 1, 'nada se ha publicado');
    await foto('fbe-3-editor-despues');
    // Volver a abrir: lo aplicado ya no sale como cambio
    await boton.click();
    await hoja.locator('.carga-sug').first().waitFor();
    await hoja.getByRole('button', { name: 'Todas', exact: true }).click();
    const quedan = Number((await hoja.locator('.btn-primario').textContent()).match(/\d+/)?.[0] || 0);
    check(quedan === 0, `al volver a abrir no queda nada por aplicar (${quedan})`);
    await hoja.getByRole('button', { name: 'Cancelar', exact: true }).click();

    // En una semana hecha y con la siguiente ya creada, el botón lleva a la siguiente
    const tabs = p.locator('.semanas-tabs button');
    const total = await tabs.count();
    const siguiente = p.getByRole('button', { name: 'Programar la siguiente según FBE', exact: true });
    let visto = false;
    for (let i = 0; i < total && !visto; i++) {
      if (!/^S\d/.test((await tabs.nth(i).textContent()).trim())) continue;   // «Vacía» crea una semana: no se toca
      await tabs.nth(i).click();
      await p.waitForTimeout(250);
      if (await siguiente.count()) visto = true;
    }
    check(visto, 'en una semana hecha, el botón propone programar la siguiente');
    if (visto) {
      const desde = Number((await semanaActiva()).match(/S(\d+)/)?.[1] || 0);
      await siguiente.click();
      await hoja.locator('.carga-sug').first().waitFor();
      check(new RegExp(`Programar la semana ${desde + 1} según FBE`).test(await hoja.textContent()), `desde la semana ${desde} abre la propuesta de la ${desde + 1}`);
      await hoja.getByRole('button', { name: 'Cancelar', exact: true }).click();
      check(await hay(p.getByRole('dialog'), 0), 'cancelar cierra sin tocar nada');
    }
    await revisar('editor');
    check(errores.length === 0, `sin errores de consola, desbordes ni fallos de accesibilidad${errores.length ? `: ${errores.slice(0, 4).join(' ## ')}` : ''}`);
  } catch (e) {
    await foto('fbe-error');
    check(false, `Programar según FBE: ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
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
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4175);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Programar según FBE');
  await probarProgramarFBE({ navegador, check, base: 'http://localhost:4175', capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
