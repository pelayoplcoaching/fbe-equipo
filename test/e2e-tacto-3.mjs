// (v0.272) Tacto (201-250), segunda vuelta, en el navegador (un móvil de 390 px, con el dedo): lo que viaja, lo que se
// asoma y lo que se hace con dos dedos.
//   · Ana (FBE Equipo). El dial que se toca sube a la cabecera de su hoja; la tarjeta de una historia se abre hasta
//     llenar la pantalla. En Semana: el bloque como una regla (deslizar por S1…S4), la ficha que vuela a su día (al
//     cambiarlo y con «Repartir por mí») y asomarse a una sesión (soltar la cierra; subir el dedo la abre) y a un
//     ejercicio de «Lo que vas a hacer». En Progreso: el titular sigue al dedo, dos dedos marcan un tramo y pellizcar
//     cambia el rango; la gráfica crece a pantalla completa y vuelve; la medalla viaja a su hoja, gira con el dedo y con
//     un toque, y se asoma; la foto de progreso crece desde su miniatura y se abre en el visor (dos toques amplían,
//     arrastrar hacia abajo cierra). En Aprende, la miniatura de un vídeo crece hasta su reproductor. Y «Actualizar» sin
//     pantallazo: vuelve a la misma pestaña y a la misma altura.
//   · Tomás (FBE Esencial). La foto de una receta crece hasta su cabecera y vuelve; y la receta se asoma.
//   Sin errores, sin desbordes y con accesibilidad.
//   Suelta:  npm run build && node test/e2e-tacto-3.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion, subProgreso } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarTacto3({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(100); } return !!(await fn().catch(() => false)); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
  }
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const b = p.locator('[aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Ahora no"), [aria-modal="true"] button:has-text("Entendido"), .bienvenida button:has-text("Saltar")').first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await p.waitForTimeout(350); } else break;
    }
  };
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, reducedMotion: 'no-preference' });
  try {
    p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    const cdp = await ctx.newCDPSession(p);
    const dedos = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    const dedo = (type, x, y) => dedos(type, type === 'touchEnd' ? [] : [[x, y]]);
    const centro = async (loc) => { await loc.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await p.waitForTimeout(450); const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
    const entrar = async (url, quien) => {
      await p.goto(`${base}${url}`);
      const b = p.getByRole('button', { name: quien }).first();
      if (await b.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await b.click();
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      await p.waitForTimeout(1500);
      await cerrarDialogos();
      // (los gestos llegan con la app ya abierta)
      await hasta(() => p.evaluate(() => performance.getEntriesByType('resource').some((r) => /barra-gestos/.test(r.name))), 8000);
      await p.waitForTimeout(400);
    };
    const conVT = async () => p.evaluate(() => typeof document.startViewTransition === 'function');
    // Los cuadros en que la pareja del viaje (vt-viaje) está animando, durante un segundo largo
    const mirarViaje = () => p.evaluate(() => { window.__vt = 0; const t0 = performance.now(); const mira = () => { if (document.getAnimations().some((a) => String(a.effect?.pseudoElement || '').includes('vt-viaje'))) window.__vt++; if (performance.now() - t0 < 1300) requestAnimationFrame(mira); }; requestAnimationFrame(mira); });
    const viajo = async () => !(await conVT()) || await hasta(() => p.evaluate(() => window.__vt > 0), 2500);
    const tocar = async (loc) => { const c = await centro(loc); await mirarViaje(); await p.touchscreen.tap(c.x, c.y); };
    const tab = (nombre) => p.locator('nav.tabs').getByRole('button', { name: nombre }).first();

    // ============================================================ Ana (FBE Equipo)
    await entrar('/?demo', /Ana/);
    // ---- 219: el dial sube a la cabecera de su hoja
    const dial = p.locator('.diales button.dial').first();
    const anchoDial = (await dial.locator('.dial-esfera').boundingBox()).width;
    await tocar(dial);
    const arriba = p.locator('[aria-modal="true"] .dial-arriba .dial-esfera');
    await arriba.waitFor();
    const anchoArriba = (await arriba.boundingBox()).width;
    check(anchoArriba > anchoDial * 1.3 && await viajo() && await p.locator('[aria-modal="true"] .dial-arriba').getAttribute('data-estado') === await dial.getAttribute('data-estado'),
      `(219) el dial que se toca sube a la cabecera de su hoja, más grande (${Math.round(anchoDial)} → ${Math.round(anchoArriba)} px) y con su mismo estado`);
    await revisar('la hoja de un dial');
    await p.keyboard.press('Escape');
    await p.locator('[aria-modal="true"]').waitFor({ state: 'detached' });
    // ---- 215: la tarjeta de una historia se abre hasta llenar la pantalla
    const historia = p.locator('.tarjeta-semana-abrir').first();
    if (await historia.count()) {
      await tocar(historia);
      await p.locator('.historia').waitFor();
      check(await viajo(), '(215) la tarjeta de una historia se abre hasta llenar la pantalla');
      await p.keyboard.press('Escape');
      await p.locator('.historia').waitFor({ state: 'detached' });
    } else check(true, '(215) hoy no hay tarjeta de historia en Hoy (nada que abrir)');

    // ---- Semana
    await tab(/^Semana/).click();
    await p.locator('.semanas-tabs').waitFor();
    await p.waitForTimeout(700);
    const titulo = () => p.locator('#semana-titulo').textContent().then((t) => t.trim());
    const semanas = await p.locator('.semanas-tabs button').count();
    if (semanas >= 2 && await p.locator('.semanas-tabs').getAttribute('data-arrastra') === '1') {
      await p.locator('.semanas-tabs').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await p.waitForTimeout(400);
      const bs = await p.locator('.semanas-tabs button').evaluateAll((xs) => xs.map((b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, on: b.getAttribute('aria-pressed') === 'true' }; }));
      const act = bs.findIndex((b) => b.on), otro = act === 0 ? bs.length - 1 : 0;
      const antes = await titulo();
      const vistos = new Set();
      await dedo('touchStart', bs[act].x, bs[act].y);
      for (let k = 1; k <= 24; k++) { await dedo('touchMove', bs[act].x + (bs[otro].x - bs[act].x) * k / 24, bs[act].y); await p.waitForTimeout(25); vistos.add(await titulo()); }
      await dedo('touchEnd');
      await p.waitForTimeout(500);
      const despues = await titulo();
      check(despues !== antes && vistos.size >= Math.min(semanas, 3) - 1 && await p.locator('.semanas-tabs button').nth(otro).getAttribute('aria-pressed') === 'true',
        `(231) el bloque como una regla: el dedo pasa de «${antes.slice(0, 9)}» a «${despues.slice(0, 9)}» semana a semana (${vistos.size} por el camino)`);
      await p.touchscreen.tap(bs[act].x, bs[act].y);
      check(await hasta(async () => await titulo() === antes, 3000), 'y un toque sigue valiendo (vuelve a la de ahora)');
    } else check(true, '(231) el bloque no cabe entero (o es de una semana): la tira se desplaza como siempre');
    // ---- 221: asomarse a una sesión
    const mantener = async (loc, ms = 800) => { const c = await centro(loc); const x = c.b.x + Math.min(c.b.width / 2, 120); await dedo('touchStart', x, c.y); await p.waitForTimeout(ms); return { x, y: c.y }; };
    const tarjeta = p.locator('.aso-tarjeta');
    const dias = p.locator('button.dia[data-asoma]');
    await dias.first().waitFor();
    await p.waitForTimeout(600);
    const y0 = await p.evaluate(() => scrollY);
    await mantener(dias.first());
    const asomada = await hasta(async () => await tarjeta.count() === 1 && await tarjeta.locator('.aso-lineas li').count() >= 1, 5000);
    const textoAso = asomada ? (await tarjeta.innerText()).replace(/\n+/g, ' | ') : '';
    check(asomada && (await dias.first().locator('.nombre').textContent()).includes((await tarjeta.locator('.aso-t').textContent()).trim()) && /Suelta para cerrar/.test(textoAso) && await p.locator('.aso-capa').getAttribute('aria-hidden') === 'true',
      `(221) mantener pulsada una sesión la asoma: «${textoAso.slice(0, 110)}…»`);
    await dedo('touchEnd');
    await p.waitForTimeout(700);
    check(await tarjeta.count() === 0 && await p.locator('button.dia[data-asoma]').count() >= 1 && await p.locator('.portada-vista, .sesion-vista').count() === 0, 'soltar la cierra, sin entrar en la sesión');
    // (deslizar la página empezando sobre una tarjeta sigue desplazándola: no se asoma)
    const c2 = await centro(dias.first());
    const y1 = await p.evaluate(() => scrollY);
    await dedo('touchStart', c2.x, c2.y);
    for (let k = 1; k <= 10; k++) { await dedo('touchMove', c2.x, c2.y - k * 14); await p.waitForTimeout(16); }
    await dedo('touchEnd');
    await p.waitForTimeout(500);
    check(Math.abs(await p.evaluate(() => scrollY) - y1) > 40 && await tarjeta.count() === 0, 'deslizar la lista desde una tarjeta la desplaza como siempre (no se asoma)');
    void y0;
    // ---- 230 y 229: la ficha vuela a su día
    const enVuelo = () => p.evaluate(() => { window.__an = 0; const t0 = performance.now(); const mira = () => { for (const el of document.querySelectorAll('.tira-semana [data-ses]')) if (el.getAnimations().some((a) => a.playState === 'running')) window.__an++; if (performance.now() - t0 < 2500) requestAnimationFrame(mira); }; requestAnimationFrame(mira); });
    const ficha = p.locator('.tira-semana button.tira-chip').first();
    if (await ficha.count()) {
      const diaDe = () => p.locator('.tira-semana button.tira-chip').first().evaluate((e) => e.closest('[data-d]').dataset.d);
      const antes = await diaDe();
      await ficha.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await ficha.click();
      const opciones = p.locator('.elegir-dia button');
      await opciones.first().waitFor();
      const k = (await opciones.nth(6).getAttribute('aria-pressed')) === 'true' ? 5 : 6;
      await enVuelo();
      await opciones.nth(k).click();
      check(await hasta(async () => await diaDe() !== antes, 4000) && await hasta(() => p.evaluate(() => window.__an > 0), 2500), `(230) al cambiarle el día, la ficha vuela hasta él (del ${antes.slice(8)} al ${(await diaDe()).slice(8)})`);
      await p.waitForTimeout(700);
      await p.locator('.tira-semana button.tira-chip').first().click();
      await p.getByRole('button', { name: 'Sin día fijo' }).click();
      const repartir = p.getByRole('button', { name: /Repartir por mí/ });
      await repartir.waitFor();
      const sinDia = await p.locator('.plan-sin-dia button').count();
      await enVuelo();
      await repartir.click();
      check(sinDia >= 1 && await hasta(async () => await p.locator('.plan-sin-dia button').count() === 0, 4000) && await hasta(() => p.evaluate(() => window.__an > 0), 2500), '(229) «Repartir por mí» reparte delante de ti: la ficha sale de «Sin día» y vuela a su día');
      await p.waitForTimeout(600);
    } else check(true, '(229 y 230) esta semana no queda ninguna sesión por colocar');
    // ---- 221 (abrir) y 222: subir el dedo abre la sesión; y en su portada, un ejercicio se asoma
    const pendiente = p.locator('button.dia[data-asoma]:not(.hecha)').first();
    if (await pendiente.count()) {
      const m = await mantener(pendiente);
      await tarjeta.waitFor();
      const yAntes = await p.evaluate(() => scrollY);
      for (let k = 1; k <= 8; k++) { await dedo('touchMove', m.x, m.y - k * 10); await p.waitForTimeout(20); }
      const pista = (await tarjeta.locator('.aso-pista').textContent()).trim();
      const quieta = Math.abs(await p.evaluate(() => scrollY) - yAntes) < 2;
      await dedo('touchEnd');
      const dentro = p.locator('.portada-vista, .sesion-vista').first();
      check(pista === 'Suelta para abrir' && quieta && await dentro.waitFor({ timeout: 8000 }).then(() => true).catch(() => false), 'subir el dedo con la tarjeta fuera dice «Suelta para abrir» (la página no se mueve) y, al soltar, entra en la sesión');
      const fila = p.locator('li.ej-fila[data-asoma]:visible').first();
      if (await fila.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) {
        await p.waitForTimeout(600);
        await mantener(fila);
        const ok = await hasta(async () => await tarjeta.count() === 1 && !/Cargando/.test(await tarjeta.innerText()), 5000);
        const t = ok ? (await tarjeta.innerText()).replace(/\n+/g, ' | ') : '';
        check(ok && (/Última vez, /.test(t) || /Aún no lo has hecho/.test(t)) && /Suelta para cerrar$/.test(t.trim()), `(222) un ejercicio de «Lo que vas a hacer» se asoma: «${t.slice(0, 120)}…»`);
        await revisar('asomarse a un ejercicio');
        await dedo('touchEnd');
        await p.waitForTimeout(500);
      } else check(false, '(222) la portada de la sesión enseña «Lo que vas a hacer»');
      await p.goBack().catch(() => {});
      await p.locator('nav.tabs').waitFor();
      await p.waitForTimeout(800);
    } else check(true, '(221 y 222) no queda ninguna sesión por hacer esta semana');

    // ---- Progreso: las gráficas con los dedos (233-235) y a pantalla completa (214)
    await tab(/^Progreso/).click();
    await p.waitForTimeout(1200);
    await subProgreso(p, 'fuerza');
    const tactil = p.locator('.grafica-tactil:visible').first();
    await tactil.waitFor();
    await p.waitForTimeout(900);
    const g = await centro(tactil);
    const panel = tactil.locator('xpath=ancestor::*[contains(@class,"panel")][1]');
    const titular = () => panel.locator('.cifra').first().evaluate((e) => [...e.children].filter((x) => getComputedStyle(x).visibility !== 'hidden').map((x) => x.textContent.trim()).join(' '));
    const rango = () => panel.locator('[role="group"][aria-label^="Rango"] button[aria-pressed="true"]').first().textContent().then((t) => t.trim());
    const titular0 = await titular(), rango0 = await rango();
    const X = (f) => g.b.x + g.b.width * f;
    await dedos('touchStart', [[X(0.35), g.y]]);
    for (let k = 1; k <= 6; k++) { await dedos('touchMove', [[X(0.35 + k * 0.02), g.y]]); await p.waitForTimeout(25); }
    const conDedo = await titular();
    check(conDedo !== titular0 && /^[\d.,]+\s*\S+ · \d+ \S+/.test(conDedo) && await panel.locator('.gdd-titular').getAttribute('aria-hidden') === 'true', `(234) el titular sigue al dedo: «${conDedo}» (antes, «${titular0.slice(0, 30).replace(/0123456789/g, '')}…»)`);
    await dedos('touchStart', [[X(0.47), g.y], [X(0.9), g.y]]);
    await p.waitForTimeout(150);
    await dedos('touchMove', [[X(0.46), g.y], [X(0.92), g.y]]);
    await p.waitForTimeout(200);
    const cambio = (await tactil.locator('.gdd-cambio').textContent().catch(() => '')).trim();
    check(/^[+−±][\d.,]+ \S+ (en \d+ (semanas|días?)|del .+ al .+)$/.test(cambio) && await tactil.locator('.gdd-tramo').count() === 1 && await panel.locator('.gdd-titular').count() === 0, `(235) dos dedos marcan un tramo y dicen cuánto ha cambiado: «${cambio}»`);
    for (let k = 1; k <= 10; k++) { await dedos('touchMove', [[X(0.46 + k * 0.015), g.y], [X(0.92 - k * 0.02), g.y]]); await p.waitForTimeout(30); }
    const alJuntar = await hasta(async () => await rango() !== rango0, 2500) ? await rango() : rango0;
    for (let k = 1; k <= 24; k++) { await dedos('touchMove', [[X(Math.max(0.05, 0.61 - k * 0.025)), g.y], [X(Math.min(0.97, 0.72 + k * 0.012)), g.y]]); await p.waitForTimeout(40); }
    await p.waitForTimeout(500);
    const alSeparar = await rango();
    await dedos('touchEnd', []);
    await p.waitForTimeout(400);
    const orden = ['1M', '3M', '6M', 'Todo'];
    check(orden.indexOf(alJuntar) === orden.indexOf(rango0) + 1 && orden.indexOf(alSeparar) < orden.indexOf(alJuntar), `(233) pellizcar cambia el rango: al juntar los dedos, de ${rango0} a ${alJuntar}; al separarlos, a ${alSeparar}`);
    check(await p.locator('.gdd-titular, .gdd-tramo, .gdd-cambio, .gdd-oculto, .gdd-dos').count() === 0 && (await titular()).replace(/\s+/g, '').length > 0, 'al soltar, el titular vuelve y no queda nada de los dedos');
    const ampliar = p.locator('.btn-ampliar:visible').first();
    await tocar(ampliar);
    await p.locator('.grafica-grande .grafica-caja').waitFor();
    check(await viajo() && await p.locator('.grafica-grande .grafica-caja.trazada .linea[pathLength]').first().evaluate((e) => getComputedStyle(e).animationName === 'none').catch(() => true), '(214) la gráfica crece de su tarjeta a la pantalla completa, ya dibujada');
    await mirarViaje();
    await p.locator('[aria-modal="true"] .cerrar-hoja').last().click();
    check(await p.locator('.grafica-grande').waitFor({ state: 'detached', timeout: 5000 }).then(() => true).catch(() => false) && await viajo() && await hasta(async () => await p.locator('[data-vuelve]').count() === 0, 3000), 'y vuelve a su tarjeta al cerrarla');

    // ---- Logros: la medalla viaja, se coge y se asoma (213, 236 y 223)
    await subProgreso(p, 'logros');
    const medallas = p.locator('.logros button.logro');
    await medallas.first().waitFor();
    await p.waitForTimeout(700);
    await mantener(medallas.first());
    const rotulo = await hasta(() => tarjeta.count().then((n) => n === 1), 3000) ? (await tarjeta.innerText()).replace(/\n+/g, ' | ') : '';
    check((await medallas.first().locator('.logro-titulo').textContent()).trim() === rotulo.split(' | ')[0] && /Suelta para cerrar/.test(rotulo), `(223) una medalla se asoma: «${rotulo.slice(0, 100)}»`);
    await dedo('touchEnd');
    await p.waitForTimeout(600);
    check(await tarjeta.count() === 0 && await p.locator('[aria-modal="true"]').count() === 0, 'y al soltar no se abre su hoja');
    await tocar(medallas.first());
    const giro = p.locator('[data-llega="medalla"] .mdl-giro');
    await giro.waitFor();
    check(await viajo() && await giro.getAttribute('aria-pressed') === 'false' && /Se ve de frente: darle la vuelta$/.test(await giro.getAttribute('aria-label')), '(213) la medalla viaja de su hueco a su hoja, en grande y de frente');
    await p.waitForTimeout(700);
    const gb = await giro.boundingBox();
    const cx = gb.x + gb.width / 2, cy = gb.y + gb.height / 2;
    const angulo = () => giro.evaluate((e) => parseFloat((e.style.transform.match(/rotateY\(([-\d.]+)deg\)/) || [0, '0'])[1]));
    await dedo('touchStart', cx - 40, cy);
    for (let k = 1; k <= 8; k++) { await dedo('touchMove', cx - 40 + k * 7, cy); await p.waitForTimeout(30); }
    const medio = await angulo();
    const luz = Number(await giro.evaluate((e) => e.style.getPropertyValue('--mdl-o')));
    await p.waitForTimeout(200);
    await dedo('touchEnd');
    check(medio > 30 && medio < 90 && luz > 0.4 && await hasta(async () => await angulo() === 0, 3000) && await giro.getAttribute('aria-pressed') === 'false', `(236) la medalla se coge: gira con el dedo (${Math.round(medio)}°, con su brillo) y, soltada despacio, vuelve de frente`);
    await p.waitForTimeout(500);
    await p.touchscreen.tap(cx, cy);
    check(await hasta(async () => await angulo() === 180 && await giro.getAttribute('aria-pressed') === 'true', 3000) && (await p.locator('.mdl-como').textContent()).trim().length > 3, `un toque le da la vuelta: detrás, cómo se ganó («${(await p.locator('.mdl-nombre').textContent()).trim()} · ${(await p.locator('.mdl-como').textContent()).trim()}»)`);
    await dedo('touchStart', cx - 50, cy);
    for (let k = 1; k <= 5; k++) { await dedo('touchMove', cx - 50 + k * 22, cy); await p.waitForTimeout(12); }
    await dedo('touchEnd');
    check(await hasta(async () => (await angulo()) >= 360 && (await angulo()) % 180 === 0, 3500), 'lanzada, sigue girando con su inercia y se para en una cara');
    await p.waitForTimeout(400);
    const a0 = await angulo();
    await giro.focus();
    await p.keyboard.press('Enter');
    check(await hasta(async () => await angulo() === a0 + 180, 3000), 'con el teclado, Intro le da la vuelta');
    await revisar('la hoja de una medalla');
    await p.keyboard.press('Escape');
    await p.locator('[aria-modal="true"]').waitFor({ state: 'detached' });

    // ---- el diario: la foto de progreso (218)
    await subProgreso(p, 'cuerpo');
    const foto = p.locator('.diario-item:not(:has(.medio-chat-play)):visible').first();
    if (await foto.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) {
      await p.waitForTimeout(600);
      await tocar(foto);
      const abrir = p.locator('.vfp-abrir');
      await abrir.locator('img').waitFor();
      check(await viajo() && await abrir.getAttribute('aria-label') === 'Ver la foto a pantalla completa', '(218) la foto de progreso crece desde su miniatura hasta su hoja');
      await revisar('la hoja de una foto de progreso');
      await p.waitForTimeout(500);
      await tocar(abrir);
      const visor = p.locator('.visor');
      await visor.waitFor();
      await visor.locator('.visor-diapo.actual img.visor-medio').waitFor();
      check(/^Foto de progreso del /.test(await visor.getAttribute('aria-label')) && /^Foto de progreso/.test((await visor.locator('.visor-quien').textContent()).trim()) && await visor.locator('.visor-accion', { hasText: 'Responder' }).count() === 0
        && await visor.locator('.visor-accion', { hasText: 'Guardar' }).count() === 1, 'y, al tocarla, se abre en el visor: con su fecha, «Guardar» y sin «Responder»');
      await p.waitForTimeout(600);
      const v = await visor.locator('.visor-diapo.actual .visor-medio').boundingBox();
      await p.touchscreen.tap(v.x + v.width / 2, v.y + v.height / 2);
      await p.waitForTimeout(120);
      await p.touchscreen.tap(v.x + v.width / 2, v.y + v.height / 2);
      check(await hasta(() => visor.locator('.visor-diapo.actual .visor-medio').evaluate((e) => /scale\(2\.5\)/.test(e.style.transform)), 2500), 'dos toques la amplían');
      await p.touchscreen.tap(v.x + v.width / 2, v.y + v.height / 2);
      await p.waitForTimeout(120);
      await p.touchscreen.tap(v.x + v.width / 2, v.y + v.height / 2);
      await p.waitForTimeout(500);
      await dedo('touchStart', 195, 400);
      for (let k = 1; k <= 10; k++) { await dedo('touchMove', 195, 400 + k * 18); await p.waitForTimeout(16); }
      await dedo('touchEnd');
      check(await visor.waitFor({ state: 'detached', timeout: 4000 }).then(() => true).catch(() => false) && await abrir.count() === 1, 'arrastrarla hacia abajo cierra el visor (la hoja sigue debajo)');
      await p.keyboard.press('Escape');
      await p.locator('[aria-modal="true"]').waitFor({ state: 'detached' });
    } else check(true, '(218) el diario de la demo no tiene fotos de progreso');

    // ---- Aprende: la miniatura de un vídeo (217)
    await irASeccion(p, 'Aprende');
    const video = p.locator('.tarjeta-video').first();
    if (await video.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) {
      await p.waitForTimeout(500);
      const c = await centro(video);
      await mirarViaje();
      await p.touchscreen.tap(c.b.x + 40, c.b.y + 40);
      check(await p.locator('.hoja-dialogo .yt-marco').waitFor({ timeout: 6000 }).then(() => true).catch(() => false) && await viajo(), '(217) la miniatura de un vídeo crece hasta su reproductor');
      await p.keyboard.press('Escape');
      await p.locator('[aria-modal="true"]').waitFor({ state: 'detached' });
    } else check(true, '(217) la videoteca de la demo no tiene tarjetas de vídeo');

    // ---- 220: actualizar sin pantallazo
    await tab(/^Semana/).click();
    await p.locator('.semanas-tabs').waitFor();
    await p.waitForTimeout(700);
    await p.evaluate(() => window.scrollTo(0, 420));
    await p.waitForTimeout(300);
    const yAntes = await p.evaluate(() => Math.round(scrollY));
    await p.evaluate(() => { window.dispatchEvent(new CustomEvent('fbe-version', { detail: { postMessage() { setTimeout(() => location.reload(), 30); } } })); });
    await p.locator('.aviso-version button', { hasText: 'Actualizar' }).click();
    await p.waitForTimeout(400);
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    const vuelta = await hasta(async () => Math.abs(await p.evaluate(() => Math.round(scrollY)) - yAntes) < 8, 8000);
    check(yAntes > 300 && vuelta && await p.evaluate(() => location.hash === '#semana' && sessionStorage.getItem('fbe-vuelta') === null), `(220) tras «Actualizar», la misma pestaña y la misma altura (${yAntes} px), y lo apuntado se gasta`);

    // ============================================================ Tomás (FBE Esencial): la receta viaja y se asoma
    await entrar('/?demo=esencial', /Tomás/);
    await tab(/^Recetas/).click();
    const recetas = p.locator('[data-receta]');
    await recetas.nth(1).waitFor();
    await p.waitForTimeout(900);
    await mantener(recetas.nth(1));
    const asoR = await hasta(() => tarjeta.count().then((n) => n === 1), 3000) ? (await tarjeta.innerText()).replace(/\n+/g, ' | ') : '';
    check(asoR.startsWith((await recetas.nth(1).locator('.nombre').textContent()).trim()) && /Por ración/.test(asoR) && await tarjeta.locator('.aso-foto').count() <= 1, `(223) una receta se asoma: «${asoR.slice(0, 110)}…»`);
    await dedo('touchEnd');
    await p.waitForTimeout(600);
    check(await tarjeta.count() === 0 && await p.locator('[aria-modal="true"]').count() === 0, 'y al soltar no se abre');
    await tocar(recetas.nth(1));
    await p.locator('.receta-equipo .receta-foto.grande').waitFor();
    check(await viajo(), '(212) la foto de la receta crece hasta ser su cabecera');
    await p.waitForTimeout(600);
    await mirarViaje();
    await p.locator('[aria-modal="true"] .cerrar-hoja').last().click();
    check(await p.locator('[aria-modal="true"]').waitFor({ state: 'detached', timeout: 5000 }).then(() => true).catch(() => false) && await viajo(), 'y vuelve a su sitio en la lista al cerrar');
    check(errores.length === 0, `los viajes, asomarse y las gráficas, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4193);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Tacto, segunda vuelta: lo que viaja, lo que se asoma y los dos dedos (v0.272)');
  try { await probarTacto3({ navegador, check, base: 'http://localhost:4193' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
