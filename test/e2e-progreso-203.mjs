// (v0.203) Progreso y seguimiento, más bonitos, en el navegador: la meta y la previsión dentro de la gráfica del 1RM, los
// tests como rombos, la semana en curso del tonelaje, la vitrina con su minilínea, las marcas en tarjetas, «Series por
// músculo» de esta semana o la pasada, las medidas sobre la figura (sin pisarse), el color de cada pestaña, la cifra del
// objetivo con su camino, los objetivos frente al plazo y el bloque en aros; en la ficha del coach, el índice, las
// tendencias y los check-ins en color (tarjetas en el móvil), los hábitos en una fila, la carga con su zona y la gráfica
// de muestra de quien aún no tiene datos. A 390 px y a 360 en oscuro, con accesibilidad.
//   Suelta:  npm run build && node test/e2e-progreso-203.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarProgreso203({ navegador, check, base = 'http://localhost:4174' }) {
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
  const entrar = async (ctx, nombre) => {
    p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(`${base}/?demo`);
    await p.locator('button.persona', { hasText: nombre }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
  };
  const sub = async (nombre) => { await p.getByRole('tab', { name: nombre, exact: true }).first().click(); await p.waitForTimeout(700); };
  const contexto = (o = {}) => navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true, isMobile: true, bypassCSP: true, ...o });

  // ---------------------------------------------------------------- El atleta: su progreso
  for (const [ancho, tema] of [[390, 'light'], [360, 'dark']]) {
    errores.length = 0;
    const ctx = await contexto({ viewport: { width: ancho, height: 800 }, colorScheme: tema });
    try {
      await entrar(ctx, 'Ana López');
      await p.locator('nav.tabs .tab', { hasText: 'Progreso' }).first().click();
      await p.locator('.cifra-objetivo').waitFor({ timeout: 10000 });
      const primera = ancho === 390;
      if (primera) {
        check(await hasta(async () => (await p.locator('.cifra-objetivo .mini-linea').count()) === 1), 'la cifra de tu objetivo, con su minilínea');
        const camino = p.locator('.cifra-objetivo .cifra-camino');
        check(await camino.count() === 1 && /empezaste en .* vas por .* la meta es/.test(await camino.getAttribute('aria-label')), `y su camino hacia la meta de tu objetivo («${await camino.getAttribute('aria-label').catch(() => '')}»)`);
      }
      await revisar(`resumen-${ancho}`);

      await sub('Fuerza');
      const secF = p.locator('.seccion', { has: p.getByRole('heading', { name: 'Fuerza (1RM estimado)' }) });
      await secF.scrollIntoViewIfNeeded();
      if (primera) {
        check(await hasta(async () => (await secF.locator('svg.grafica .meta').count()) === 1), 'la gráfica del 1RM lleva la meta de su objetivo');
        check(/^Meta: \d/.test(await secF.locator('svg.grafica text.meta-etq').textContent()) && await secF.locator('svg.grafica .prevision').count() === 1, 'con su cifra y la previsión punteada');
        check(/Meta: .*a este ritmo|Meta: .*previsión sigue/.test(await secF.locator('.grafica-caja .sr').textContent()), 'y el resumen para los lectores de pantalla la cuenta');
        await secF.getByRole('button', { name: 'Todo', exact: true }).click();
        check(await hasta(async () => (await secF.locator('svg.grafica .marca-test').count()) >= 1), 'en Todo, el test de esa sentadilla como rombo dorado (el eje empieza en él)');
        // El globo del dedo, en oro sobre un récord
        const caja = secF.locator('.grafica-tactil');
        await caja.focus();
        await p.keyboard.press('End');
        const globo = secF.locator('.grafica-globo');
        check(await hasta(async () => (await globo.count()) === 1), 'al elegir un punto, su globo');
        const esRecord = /récord/.test(await caja.getAttribute('aria-valuetext'));
        check(!esRecord || await globo.evaluate((g) => g.classList.contains('globo-record') && !!g.querySelector('svg')), `y en oro con su trofeo si es un récord (${await caja.getAttribute('aria-valuetext')})`);
        await secF.getByRole('button', { name: '3M', exact: true }).click();
        await p.keyboard.press('Escape');
        // El tonelaje: la semana de ahora, en claro
        const secT = p.locator('.seccion', { has: p.getByRole('heading', { name: 'Tonelaje por semana' }) });
        const curso = await secT.locator('svg.grafica .punto.en-curso').count();
        check(curso <= 1 && (!curso || (await secT.locator('svg.grafica .linea-curso').count() === 1 && (await secT.locator('svg.grafica text.valor').textContent()).includes('en curso'))), `el tonelaje: la semana de ahora va en claro y discontinua (${curso ? 'con datos esta semana' : 'sin datos esta semana'})`);
        // La vitrina: minilínea y lo que subió
        check(await p.locator('.trofeo-tarjeta .trofeo-linea').count() >= 1 && await p.locator('.trofeo-tarjeta .trofeo-subida').count() >= 1, 'cada trofeo con su minilínea y lo que subió frente al récord anterior');
        check(/frente al récord anterior/.test(await p.locator('.trofeo-tarjeta', { has: p.locator('.trofeo-subida') }).first().getAttribute('aria-label')), 'y lo dice al lector de pantalla');
        // Las marcas, en tarjetas
        const marcas = p.locator('.marca-tarjeta');
        check(await marcas.count() >= 1 && await p.locator('.marca-tarjeta .marca-sello').count() === await marcas.count(), 'las marcas, en tarjetas con su sello');
        await marcas.first().click();
        const hojaM = p.getByRole('dialog').last();
        check(await hasta(async () => (await hojaM.getByRole('button', { name: 'Borrar la marca' }).count()) === 1), 'borrar una marca, desde su hoja');
        await p.keyboard.press('Escape');
        await hojaM.waitFor({ state: 'hidden' }).catch(() => {});
        // Series por músculo: esta semana o la pasada
        const grupoSem = p.getByRole('group', { name: 'Qué semana de series ver' });
        await grupoSem.getByRole('button', { name: 'La pasada' }).click();
        check(await hasta(async () => (await p.locator('.barra-fila.vol-curso').count()) === 0 && (await p.locator('.barra-fila').count()) > 0), 'series por músculo de la semana pasada (cerrada: nada en curso)');
        await grupoSem.getByRole('button', { name: 'Esta semana' }).click();
        await p.waitForTimeout(300);
        check(await p.locator('.barra-fila.vol-bajo').count() === 0, 'y en la de ahora, lo que aún no llega no sale en gris (va rayado, en curso)');
      }
      await revisar(`fuerza-${ancho}`);

      await sub('Cuerpo');
      const fig = p.getByRole('group', { name: 'Medida' });
      await fig.scrollIntoViewIfNeeded();
      check(await hasta(async () => (await fig.locator('.cc-etq').count()) >= 2), `las medidas, sobre la figura (${ancho} px)`);
      const pisadas = await fig.evaluate((el) => {
        const malas = [];
        for (const lado of el.querySelectorAll('.cc-lado')) {
          const rs = [...lado.querySelectorAll('.cc-etq')].map((b) => b.getBoundingClientRect()).sort((a, b) => a.top - b.top);
          for (let i = 1; i < rs.length; i++) if (rs[i].top < rs[i - 1].bottom - 1) malas.push(i);
        }
        return malas.length;
      });
      check(pisadas === 0, 'y sus etiquetas no se pisan');
      if (primera) {
        const cadera = fig.getByRole('button', { name: /^Cadera:/ });
        await cadera.click();
        check(await hasta(async () => (await cadera.getAttribute('aria-pressed')) === 'true'), 'tocar una medida la elige (y su gráfica pasa a ser la suya)');
        const colores = await p.evaluate(() => {
          const l = document.querySelector('.progreso-panel[data-sub="cuerpo"] .seccion-peso .grafica .linea');
          return l ? getComputedStyle(l).stroke : '';
        });
        await sub('Fuerza');
        const colorF = await p.evaluate(() => { const l = document.querySelector('.progreso-panel[data-sub="fuerza"] .grafica .linea'); return l ? getComputedStyle(l).stroke : ''; });
        check(colores && colorF && colores !== colorF, `cada pestaña con su color: Cuerpo (${colores}) no es Fuerza (${colorF})`);
        await sub('Cuerpo');
      }
      await revisar(`cuerpo-${ancho}`);

      await sub('Logros');
      if (primera) {
        check(await hasta(async () => (await p.locator('.bloque-aros li').count()) >= 1), 'las semanas del bloque, en aros');
        check(await p.locator('.bloque-aros li.actual').count() <= 1 && /Semana \d+: \d+ de \d+ sesiones/.test(await p.locator('.bloque-aros li .sr').first().textContent()), 'con la de ahora resaltada y su texto para el lector');
        check(await p.locator('.objetivo .objetivo-ico').count() >= 1, 'cada objetivo con el icono de su tipo');
        const marca = p.locator('.objetivo .progreso-barra .barra-tiempo');
        check(await marca.count() >= 1 && /del plazo: va por (delante|detrás)/.test(await p.locator('.objetivo .progreso-barra:has(.barra-tiempo)').first().getAttribute('aria-label')), 'y la marca de cuánto plazo ha pasado (va por delante o por detrás)');
      }
      await revisar(`logros-${ancho}`);
      check(errores.length === 0, `el progreso del atleta a ${ancho} px${tema === 'dark' ? ' en oscuro' : ''}, sin errores ni problemas de accesibilidad${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
    } finally { await ctx.close(); }
  }

  // ---------------------------------------------------------------- El coach: la ficha (Seguimiento)
  errores.length = 0;
  const ctxC = await contexto();
  try {
    await entrar(ctxC, 'Pelayo');
    await p.locator('nav.tabs .tab', { hasText: 'Atletas' }).first().click();
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().click();
    await p.getByRole('tab', { name: 'Seguimiento' }).first().click();
    const indice = p.getByRole('navigation', { name: 'Apartados de Seguimiento' });
    await indice.waitFor({ timeout: 10000 });
    check((await indice.getByRole('button').allTextContents()).join() === 'Cumplimiento,Hábitos,Progreso,Carga,Check-ins,Meses', 'Seguimiento lleva su índice (Cumplimiento, Hábitos, Progreso, Carga, Check-ins y Meses)');
    await indice.getByRole('button', { name: 'Check-ins' }).click();
    const secCk = p.locator('#seg-a-checkins');
    check(await hasta(async () => (await indice.getByRole('button', { name: 'Check-ins' }).getAttribute('aria-current')) === 'true'
      && await secCk.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight * 0.6; })), 'tocar un apartado te lleva a él y lo marca en el índice');
    check(await p.evaluate(() => { const n = document.querySelector('.indice-seg'); const r = n.getBoundingClientRect(); return getComputedStyle(n).position === 'sticky' && r.top >= 0 && r.top < 160; }), 'y el índice se queda arriba al bajar');
    check(await secCk.locator('.tendencias-checkin li').count() >= 3, `la tendencia de cada respuesta del check-in (${await secCk.locator('.tendencias-checkin li').count()} baldosas)`);
    check(await secCk.locator('.tabla-checkins td.nivel-bien').count() >= 1 && await secCk.locator('.tabla-checkins td[class*="nivel-"]').count() >= 5, 'los check-ins, cada casilla con el color de su escala');
    check(await secCk.locator('.tabla-checkins tbody tr').first().evaluate((tr) => getComputedStyle(tr).display) === 'grid', 'y en el móvil, una tarjeta por semana');
    await revisar('seguimiento-checkins');
    // Los hábitos, en una fila
    await indice.getByRole('button', { name: 'Hábitos' }).click();
    const fila = p.locator('.habito-coach-fila').first();
    await fila.waitFor();
    check(/^Cambiar .+: .+ % en 7 días/.test(await fila.getAttribute('aria-label')), 'cada hábito, en una fila que dice cómo lo lleva');
    await fila.click();
    const hojaH = p.getByRole('dialog', { name: /^Cambiar «/ });
    check(await hasta(async () => (await hojaH.getByRole('button', { name: 'Quitar el hábito' }).count()) === 1), 'y al tocarla, su hoja, con «Quitar el hábito»');
    await p.keyboard.press('Escape');
    await hojaH.waitFor({ state: 'hidden' }).catch(() => {});
    // La carga, con su zona
    await indice.getByRole('button', { name: 'Carga' }).click();
    const carga = p.locator('svg.grafica-carga');
    if (await carga.count()) {
      check(await carga.locator('rect.zona-carga').count() === 1 && /zona normal, de \d+ a \d+ UA/.test(await carga.getAttribute('aria-label')), 'la carga, con su zona normal (y lo dice)');
    }
    await revisar('seguimiento-carga');
    check(errores.length === 0, `la ficha de Ana, sin errores ni problemas de accesibilidad${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
    // Quien aún no tiene datos: la gráfica de muestra
    errores.length = 0;
    await p.getByRole('button', { name: 'Volver a atletas' }).click();
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Marta Gil' }).first().click();
    await p.getByRole('tab', { name: 'Seguimiento' }).first().click();
    check(await hasta(async () => (await p.locator('.grafica-fantasma').count()) >= 1), 'sin pesos todavía: la gráfica de muestra con lo que falta');
    await revisar('seguimiento-vacio');
    check(errores.length === 0, `la ficha sin datos, sin errores ni problemas de accesibilidad${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctxC.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4190);
  const navegador = await chromium.launch();
  console.log('Progreso y seguimiento, más bonitos (v0.203)');
  try { await probarProgreso203({ navegador, check, base: 'http://localhost:4190' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n')[0]); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
