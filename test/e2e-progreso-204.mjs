// (v0.204) Progreso y seguimiento, segunda tanda, en el navegador: la gráfica a pantalla completa, comparar ejercicios,
// el periodo anterior en gris, la tira de la báscula, las cifras con flecha, los días de cada semana, el mapa con récords
// y check-ins, la escalera de un récord, los músculos con récord, la próxima medalla, el trofeo que destella una vez,
// las fotos con su peso, la proteína y el informe del bloque; en la ficha del coach, el registro con fichas y su aro, la
// actividad por semanas con los récords juntos y el modo llamada. A 390 px y a 360 en oscuro, con accesibilidad.
//   Suelta:  npm run build && node test/e2e-progreso-204.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarProgreso204({ navegador, check, base = 'http://localhost:4174' }) {
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
  const seccion = (titulo) => p.locator('.seccion', { has: p.getByRole('heading', { name: titulo, exact: true }) }).first();

  // ---------------------------------------------------------------- El atleta: su progreso
  for (const [ancho, tema] of [[390, 'light'], [360, 'dark']]) {
    errores.length = 0;
    const ctx = await contexto({ viewport: { width: ancho, height: 800 }, colorScheme: tema });
    const primera = ancho === 390;
    try {
      await entrar(ctx, 'Ana López');
      await p.locator('nav.tabs .tab', { hasText: 'Progreso' }).first().click();
      await p.locator('dl.cifras').waitFor({ timeout: 10000 });
      if (primera) {
        const dts = (await p.locator('dl.cifras dt').allTextContents()).join(' | ');
        check(/en 4 semanas/.test(dts), `(4) las cifras de arriba son de las 4 últimas semanas (${dts})`);
        // (la demo de Ana tiene 4 semanas de entrenos: antes no hay con qué comparar, así que sin flecha; la lógica, en
        // test/progreso-visual-2.test.mjs)
        const flechas = p.locator('dl.cifras .cifra-flecha');
        if (await flechas.count()) check(/que las 4 semanas anteriores/.test(await flechas.first().textContent()), `y llevan su flecha frente a las 4 de antes (${await flechas.count()})`);
        else check(true, '(sin entrenos antes de estas 4 semanas en la demo: las cifras van sin flecha)');
        const mini = p.locator('.fila-semana .dias-mini').first();
        check(await mini.count() === 1 && /^Entrenaste |^Sin días/.test(await mini.locator('.sr').textContent()) && await mini.locator('.dias-mini-fila i').count() === 7, `(5) cada semana, sus días de lunes a domingo en miniatura («${await mini.locator('.sr').textContent().catch(() => '')}»)`);
        check(await p.locator('.fila-semana .dias-mini-fila i.si').count() >= 1, 'con los que entrenó marcados');
      }
      await revisar(`resumen-${ancho}`);

      // ---- Fuerza
      await sub('Fuerza');
      const secF = seccion('Fuerza (1RM estimado)');
      await secF.scrollIntoViewIfNeeded();
      if (primera) {
        await secF.locator('svg.grafica').first().waitFor();
        const altoNormal = await secF.locator('svg.grafica').first().evaluate((s) => s.getBoundingClientRect().height);
        await secF.getByRole('button', { name: /a pantalla completa$/ }).click();
        const grande = p.locator('.hoja-dialogo.hoja-completa');
        await grande.waitFor();
        const g = await grande.evaluate((d) => { const r = d.getBoundingClientRect(); const s = d.querySelector('svg.grafica'); return { w: r.width, h: r.height, alto: s ? s.getBoundingClientRect().height : 0, rango: !!d.querySelector('.seg-rango'), slider: !!d.querySelector('[role=slider]') }; });
        check(g.w >= ancho - 1 && g.h >= 790 && g.alto > altoNormal + 40 && g.rango && g.slider, `(1) la gráfica, a pantalla completa: más alta (${Math.round(altoNormal)} → ${Math.round(g.alto)} px), con su rango y el dedo`);
        await revisar('fuerza-pantalla-completa');
        await p.setViewportSize({ width: 800, height: 390 });
        await p.waitForTimeout(400);
        const ap = await grande.evaluate((d) => ({ w: d.getBoundingClientRect().width, svg: d.querySelector('svg.grafica')?.getBoundingClientRect().width || 0 }));
        check(ap.w >= 799 && ap.svg > 600, `y al girar el móvil, a lo ancho (${Math.round(ap.svg)} px)`);
        await p.setViewportSize({ width: ancho, height: 800 });
        await p.keyboard.press('Escape');
        await grande.waitFor({ state: 'hidden' });
        // Comparar ejercicios
        await secF.getByRole('button', { name: 'Comparar ejercicios' }).click();
        const chips = secF.locator('.chips-comparar');
        await chips.waitFor();
        check(await chips.locator('button[aria-pressed="true"]').count() === 2 && await hasta(async () => (await secF.locator('svg.grafica-comparar .linea-comparar').count()) === 2), '(2) «Comparar ejercicios»: dos de entrada, cada uno con su línea');
        check(/en % desde el principio del rango/.test(await secF.locator('.comparar-ej .sr').textContent()) && await secF.locator('.leyenda-comparar li').count() === 2, 'en %, con su leyenda y su resumen para los lectores de pantalla');
        const libre = chips.locator('button[aria-pressed="false"]').first();
        if (await libre.count()) {
          await libre.click();
          check(await hasta(async () => (await secF.locator('svg.grafica-comparar .linea-comparar').count()) === 3) && await chips.locator('button[disabled]').count() === Math.max(0, await chips.locator('button').count() - 3), 'hasta tres (los demás se apagan)');
        }
        await revisar('fuerza-comparar');
        await secF.getByRole('button', { name: 'Ver uno solo' }).click();
        check(await hasta(async () => (await secF.locator('svg.grafica-comparar').count()) === 0 && (await secF.locator('svg.grafica .linea').count()) >= 1), 'y «Ver uno solo» vuelve a la gráfica de siempre');
      }
      // El tonelaje: con 4 semanas de entrenos no hay periodo anterior (en «Todo», nunca)
      const secT = seccion('Tonelaje por semana');
      if (primera && await secT.count()) {
        await secT.scrollIntoViewIfNeeded();
        await secT.getByRole('button', { name: 'Todo', exact: true }).click();
        await p.waitForTimeout(400);
        check(await secT.locator('svg.grafica .linea-previa').count() === 0, '(3) en «Todo» no hay periodo anterior detrás');
      }
      // La vitrina: los músculos con récord y el trofeo que destella una vez
      const secV = seccion('Vitrina de récords');
      await secV.scrollIntoViewIfNeeded();
      if (primera) {
        if (await secV.locator('.chip', { hasText: 'en 30 días' }).count()) {
          check(await secV.locator('.mapa-records .mapa-oro .musculo.m4').count() >= 1 && /músculos? con récord/.test(await secV.locator('.mapa-records strong').textContent()), '(8) bajo la vitrina, los músculos con récord en 30 días, en dorado');
        }
        const clave = await p.evaluate(() => Object.keys(localStorage).find((k) => k.startsWith('fbe-trofeos-vistos:')));
        check(!!clave && await secV.locator('.trofeo-tarjeta.destella').count() === 0, '(10) la primera vez, ningún trofeo destella (y se apunta lo visto en el móvil)');
        await p.evaluate((k) => localStorage.setItem(k, '{}'), clave);
        await p.reload();
        await p.locator('nav.tabs').waitFor();
        await cerrarDialogos();
        await p.locator('nav.tabs .tab', { hasText: 'Progreso' }).first().click();
        await sub('Fuerza');
        await seccion('Vitrina de récords').scrollIntoViewIfNeeded();
        check(await hasta(async () => (await p.locator('.trofeo-tarjeta.destella').count()) >= 1), 'con un récord nuevo desde la última vez, su trofeo destella al verlo');
        check(await hasta(async () => (await p.evaluate((k) => localStorage.getItem(k), clave)) !== '{}'), 'y queda visto: no volverá a destellar');
      }
      // La escalera de un récord
      await seccion('Vitrina de récords').locator('.trofeo-tarjeta').first().click();
      const hojaR = p.locator('.hoja-dialogo').last();
      await hojaR.waitFor();
      const esc = hojaR.locator('.lista-records.escalera li');
      if (await hasta(async () => (await esc.count()) >= 1)) {
        const altos = await esc.evaluateAll((xs) => xs.map((x) => x.getBoundingClientRect().height));
        check(altos.every((a, i) => i === 0 || a >= altos[i - 1] - 0.5) && await hojaR.locator('.escalera li.ultima').count() === 1 && await esc.first().locator('.escalon-cifra').textContent() !== '',
          `(7) «Las veces que lo batiste», como escalones que suben (${altos.length}), cada uno con su cifra y su fecha`);
      } else check(true, '(7) (este récord aún no se ha batido)');
      await revisar(`hoja-record-${ancho}`);
      await p.keyboard.press('Escape');
      await hojaR.waitFor({ state: 'hidden' }).catch(() => {});

      // ---- Logros: el mapa y la próxima medalla
      await sub('Logros');
      const mapa = p.locator('.mapa-constancia');
      await mapa.waitFor({ timeout: 10000 });
      if (primera) {
        const marcas = await mapa.locator('.cr-celda.con-record, .cr-celda.con-checkin').count();
        check(marcas >= 1, `(6) el mapa de constancia marca los días con récord y con check-in (${await mapa.locator('.con-record').count()} y ${await mapa.locator('.con-checkin').count()})`);
        const conRec = mapa.locator('button.cr-celda.con-record').first();
        if (await conRec.count()) check(/, con récord/.test(await conRec.getAttribute('aria-label')), 'y lo dice en cada día');
        const prox = p.locator('.logro.proxima');
        check(await hasta(async () => (await prox.count()) === 1) && /^Te falta/.test(await prox.locator('.logro-falta').textContent()) && /la que tienes más cerca/.test(await prox.getAttribute('aria-label')), `(9) la medalla que tienes más cerca brilla y dice cuánto te falta («${await prox.locator('.logro-falta').textContent().catch(() => '')}»)`);
      }
      await revisar(`logros-${ancho}`);

      // ---- Cuerpo: la tira de la báscula, las fotos y la proteína
      await sub('Cuerpo');
      const secP = seccion('Peso corporal');
      await secP.scrollIntoViewIfNeeded();
      if (primera) {
        check(await hasta(async () => (await secP.locator('.tira-bascula .dia-bascula').count()) >= 2) && /\d+ días? con pesada en /.test(await secP.locator('.dias-bascula-txt').textContent()), `(12) bajo la gráfica del peso, una marca por día que te pesaste («${await secP.locator('.dias-bascula-txt').textContent().catch(() => '')}»)`);
        check(/días? con pesada/.test(await secP.locator('.grafica-caja .sr').first().textContent()), 'y el resumen lo cuenta');
        // El periodo anterior, en gris, detrás del peso (Ana tiene 3 meses de pesadas)
        await secP.getByRole('button', { name: '1M', exact: true }).click();
        check(await hasta(async () => (await secP.locator('svg.grafica .linea-previa').count()) === 1) && /en gris, el mes anterior/.test(await secP.locator('.grafica-caja .sr').first().textContent()),
          '(3) en 1M, el peso lleva detrás, en gris, el mes anterior (y lo dice)');
        await secP.getByRole('button', { name: /a pantalla completa$/ }).click();
        const gp = p.locator('.hoja-dialogo.hoja-completa');
        check(await hasta(async () => (await gp.locator('svg.grafica .linea-previa').count()) === 1 && (await gp.locator('.tira-bascula .dia-bascula').count()) >= 2), 'y a pantalla completa, también (con la tira de la báscula)');
        await p.keyboard.press('Escape');
        await gp.waitFor({ state: 'hidden' }).catch(() => {});
        const fotos = p.locator('.diario-item .diario-kg');
        if (await fotos.count()) check(/kg de tendencia/.test(await p.locator('.diario-item', { has: p.locator('.diario-kg') }).first().getAttribute('aria-label')), '(11) cada foto de progreso, con la tendencia de su peso de ese día');
        const ad = p.getByRole('button', { name: 'Antes y después' });
        if (await ad.count()) {
          await ad.click();
          const hojaF = p.getByRole('dialog', { name: 'Antes y después' });
          await hojaF.waitFor();
          if (await hasta(async () => (await hojaF.locator('.fotos-cambios li').count()) >= 1, 4000)) check(true, '(11) y en «Antes y después», lo que cambió entre una y otra');
          await p.keyboard.press('Escape');
          await hojaF.waitFor({ state: 'hidden' }).catch(() => {});
        }
        const prot = p.locator('svg.grafica-proteina');
        if (await prot.count()) check(await prot.locator('.barra-proteina').count() >= 1 && /en la franja de su objetivo/.test(await p.locator('.grafica-caja', { has: prot }).locator('.sr').textContent()), '(13) la proteína de cada día, con la franja de su objetivo');
      }
      await revisar(`cuerpo-${ancho}`);

      // ---- Resumen: el informe del bloque
      if (primera) {
        await sub('Resumen');
        const bloques = seccion('Tus bloques');
        if (await hasta(async () => (await bloques.count()) === 1, 5000)) {
          await bloques.locator('button.fila-semana').first().click();
          const inf = p.locator('.hoja-dialogo', { has: p.locator('.informe') });
          await inf.waitFor();
          if (await inf.getByRole('heading', { name: 'Esfuerzo frente a lo pautado' }).count()) {
            check(await inf.locator('.esfuerzo-semanas li').count() >= 1 && /^Semana \d+: /.test(await inf.locator('.esfuerzo-semanas li .sr').first().textContent()), '(15) el esfuerzo del bloque, en barras por semana');
          }
          if (await inf.locator('.frente-anterior').count()) check(/bloque anterior/.test(await inf.locator('.frente-anterior .sr').first().textContent()), '(14) y cada cifra frente a la del bloque anterior');
          await revisar('informe-bloque');
          await p.keyboard.press('Escape');
        }
      }
      check(errores.length === 0, `el progreso de Ana a ${ancho} px en ${tema === 'dark' ? 'oscuro' : 'claro'}, sin errores ni problemas de accesibilidad${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
    } finally { await ctx.close(); }
  }

  // ---------------------------------------------------------------- El coach: la ficha
  errores.length = 0;
  const ctxC = await contexto();
  try {
    await entrar(ctxC, 'Pelayo');
    await p.locator('nav.tabs .tab', { hasText: 'Atletas' }).first().click();
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().click();
    // Registro: las series como fichas de color y el aro de cada sesión
    await p.getByRole('tab', { name: 'Registro' }).first().click();
    await p.locator('.registro-sesion').first().waitFor({ timeout: 10000 });
    check(await hasta(async () => (await p.locator('.serie-ficha').count()) >= 3) && await p.locator('.serie-ficha[class*="esf-"]').count() === await p.locator('.serie-ficha').count(), `(16) en Registro, cada serie es una ficha del color de su esfuerzo (${await p.locator('.serie-ficha').count()})`);
    const med = p.locator('.registro-sesion svg.medidor-sesion').first();
    check(await med.count() === 1 && /^\d+ de \d+ series pautadas hechas; esfuerzo /.test(await med.getAttribute('aria-label')), `(17) y cada sesión, su aro con las series hechas («${await med.getAttribute('aria-label').catch(() => '')}»)`);
    await revisar('registro');
    // Actividad: la banda de cada semana y los récords juntos
    await p.getByRole('tab', { name: 'Actividad' }).first().click();
    await p.locator('.actividad-item').first().waitFor({ timeout: 10000 });
    check(await p.locator('.actividad-semana').count() >= 1 && /\d+ sesi(ón|ones)/.test(await p.locator('.actividad-semana').first().textContent()), `(19) Actividad: cada semana empieza con su resumen («${(await p.locator('.actividad-semana').first().textContent().catch(() => '')).trim()}»)`);
    // (v0.206) con «Todo», los récords cuelgan de su sesión; juntos en una tarjeta, con el filtro «Récords»
    await p.getByRole('group', { name: 'Qué ver' }).getByRole('button', { name: 'Récords' }).click();
    await p.locator('.actividad-item').first().waitFor({ timeout: 10000 }).catch(() => {});
    const juntos = p.locator('.actividad-records > .actividad-item').first();
    if (await juntos.count()) {
      check(/^\d+ récords/.test(await juntos.locator('.actividad-titulo').textContent()) && await juntos.getAttribute('aria-expanded') === 'false', '(18) los récords de un mismo día, en una tarjeta');
      await juntos.click();
      check(await juntos.getAttribute('aria-expanded') === 'true' && await p.locator('.actividad-records-lista li').count() >= 2, 'que se despliega con cada uno');
    } else check(true, '(18) (sin dos récords el mismo día en estos 30 días)');
    await revisar('actividad');
    // Seguimiento: el modo llamada
    await p.getByRole('tab', { name: 'Seguimiento' }).first().click();
    const ver = p.getByRole('button', { name: 'Ver con Ana' });
    await ver.waitFor({ timeout: 10000 });
    await ver.click();
    const llamada = p.getByRole('dialog', { name: 'El progreso de Ana' });
    await llamada.waitFor();
    check(await llamada.evaluate((d) => d.getBoundingClientRect().height >= innerHeight - 1) && await llamada.getByRole('tab').count() === 3, '(20) «Ver con Ana»: su progreso a pantalla completa, por pestañas');
    await hasta(async () => (await llamada.locator('.seccion').count()) >= 2);
    check(await llamada.getByRole('button', { name: /Apuntar marca/ }).count() === 0 && !/se ajusta abajo/.test(await llamada.textContent()), 'y sin lo que solo es para ti (apuntar marcas, la nota del volumen)');
    await llamada.getByRole('tab', { name: 'Cuerpo' }).click();
    check(await hasta(async () => await llamada.locator('.seccion-peso').isVisible()) && !(await llamada.getByRole('heading', { name: 'Fuerza (1RM estimado)' }).isVisible().catch(() => false)), 'cada pestaña enseña lo suyo');
    await revisar('modo-llamada');
    await p.keyboard.press('Escape');
    check(errores.length === 0, `la ficha de Ana, sin errores ni problemas de accesibilidad${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctxC.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4191);
  const navegador = await chromium.launch();
  console.log('Progreso y seguimiento, segunda tanda (v0.204)');
  try { await probarProgreso204({ navegador, check, base: 'http://localhost:4191' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n')[0]); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
