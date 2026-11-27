// (v0.272) Tacto (201-250), segunda vuelta, en el navegador (un móvil de 390 px, con el dedo):
//   · Tomás (FBE Esencial). La barra de abajo: deslizar el pulgar por ella cambia de pestaña y mantener una pulsada abre
//     sus atajos («Progreso» → «Cuerpo»; «Hoy» → «Empezar la sesión»). En Recetas: los ingredientes se tachan (y se
//     recuerda), las cantidades cambian con las raciones, un tiempo de un paso arranca su temporizador (con «+1 min»), el
//     modo cocina (un paso por pantalla, deslizando) y guardar con su estrella. En la sesión: «Máquina ocupada · hacerlo
//     luego» y cambiar un ejercicio, con «Deshacer»; quitar una serie, también; y el modo zurdo (el ✓ y las teclas de
//     acción, a la izquierda).
//   Sin errores, sin desbordes y con accesibilidad.
//   Suelta:  npm run build && node test/e2e-tacto-2.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irAAjustes, irASeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarTacto2({ navegador, check, base = 'http://localhost:4174' }) {
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
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|blob:|Failed to load resource/.test(m.text())) errores.push(m.text()); });
    await p.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* */ } });
    const entrar = async () => {
      await p.goto(`${base}/?demo=esencial`);
      await p.getByRole('button', { name: /Tomás/ }).first().click();
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      await p.waitForTimeout(1500);
      await cerrarDialogos();
    };
    await entrar();
    const cdp = await ctx.newCDPSession(p);
    const dedo = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const arrastrar = async (x, y, dx, dy, { pasos = 10, cada = 18, soltar = true } = {}) => {
      await dedo('touchStart', x, y);
      for (let k = 1; k <= pasos; k++) { await dedo('touchMove', x + (dx * k) / pasos, y + (dy * k) / pasos); await p.waitForTimeout(cada); }
      if (soltar) await dedo('touchEnd');
    };
    const actual = async () => (await p.locator('.tabs-flota .tab[aria-current="page"]').getAttribute('data-tab').catch(() => null)) || (await p.locator('.tabs-flota .tab-mas[aria-current="page"]').count() ? 'mas' : null);
    const pestanas = () => p.locator('.tabs-flota button.tab').evaluateAll((bs) => bs.filter((b) => b.getClientRects().length).map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.tab || (b.classList.contains('tab-mas') ? 'mas' : ''), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; }));

    // ---------------------------------------------------------------- el modo zurdo, en sus ajustes (se queda puesto para la sesión)
    await irAAjustes(p);
    const zurdo = p.getByRole('switch', { name: /Modo zurdo/ });
    await zurdo.scrollIntoViewIfNeeded();
    const deSerie = !(await zurdo.isChecked()) && !(await p.evaluate(() => document.documentElement.hasAttribute('data-zurdo')));
    await zurdo.click();
    check(deSerie && await hasta(async () => await zurdo.isChecked() && await p.evaluate(() => document.documentElement.hasAttribute('data-zurdo') && JSON.parse(localStorage.getItem('fbe-ajustes') || '{}').zurdo === true), 3000),
      '(205) «Modo zurdo» sale en los ajustes de este móvil, apagado de serie; al encenderlo, marca la página y se recuerda');
    await irASeccion(p, 'Hoy');
    await p.locator('.hero-dia').waitFor();
    await p.waitForTimeout(500);

    // ---------------------------------------------------------------- la barra de abajo
    // (su código llega con la app ya abierta: la primera pulsación larga dice si ya está)
    let T = await pestanas();
    const hoyT = T.find((t) => t.id === 'hoy'), prog = T.find((t) => t.id === 'progreso'), sem = T.find((t) => t.id === 'semana');
    check(!!hoyT && !!prog && !!sem && T.length >= 4, `la barra, con sus pestañas marcadas (${T.map((t) => t.id).join(', ')})`);
    await p.waitForFunction(() => getComputedStyle(document.querySelector('.tabs-flota .tabs-in')).touchAction === 'none', null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(600);
    await arrastrar(hoyT.x, hoyT.y, prog.x - hoyT.x, 0, { pasos: 12, soltar: false });
    const encima = await p.locator('.tabs-flota .tab[data-sobre]').getAttribute('data-tab').catch(() => null);
    await dedo('touchEnd');
    check(encima === 'progreso' && await hasta(async () => await actual() === 'progreso', 4000), '(225) deslizar el pulgar por la barra, de «Hoy» a «Progreso»: la pestaña bajo el dedo se enciende y, al soltar, se va a ella');
    await p.waitForTimeout(300);
    await p.touchscreen.tap(sem.x, sem.y);
    check(await hasta(async () => await actual() === 'semana', 4000), 'un toque normal sigue cambiando de pestaña');
    await p.waitForTimeout(700);   // (mientras la pantalla cambia, el navegador no atiende al dedo)
    await dedo('touchStart', prog.x, prog.y);
    const menu = p.locator('.bg-menu');
    const salio = await menu.waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
    await dedo('touchEnd');
    await p.waitForTimeout(250);
    const items = (await p.locator('.bg-item').allTextContents()).map((t) => t.trim());
    check(salio && items.join('|') === 'Resumen|Fuerza|Cuerpo|Logros' && await menu.getAttribute('role') === 'menu' && await actual() === 'semana',
      `(224) mantener pulsada «Progreso» abre sus atajos (${items.join(', ')}) sin cambiar de pestaña`);
    await revisar('los atajos de la barra');
    await p.locator('.bg-item', { hasText: 'Cuerpo' }).tap();
    check(await hasta(async () => await actual() === 'progreso' && (await p.locator('.pestanas-progreso [role="tab"][aria-selected="true"]').textContent()).trim() === 'Cuerpo', 6000) && await menu.count() === 0,
      'tocar «Cuerpo» lleva a esa parte de Progreso');
    // con los atajos abiertos, subir el dedo hasta uno y soltar
    await p.waitForTimeout(700);
    await dedo('touchStart', hoyT.x, hoyT.y);
    await menu.waitFor({ timeout: 3000 });
    const itemsHoy = (await p.locator('.bg-item').allTextContents()).map((t) => t.trim());
    const primero = await p.locator('.bg-item').first().boundingBox();
    for (let k = 1; k <= 8; k++) { await dedo('touchMove', hoyT.x + ((primero.x + 70 - hoyT.x) * k) / 8, hoyT.y + ((primero.y + primero.height / 2 - hoyT.y) * k) / 8); await p.waitForTimeout(20); }
    const marcado = (await p.locator('.bg-item[data-sobre]').textContent().catch(() => '')).trim();
    await dedo('touchEnd');
    check(itemsHoy[0] === 'Empezar la sesión' && marcado === 'Empezar la sesión' && await p.locator('.portada-vista, .sesion-vista').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false),
      `mantener «Hoy» (${itemsHoy.join(', ')}), subir el dedo hasta «Empezar la sesión» y soltar: abre la sesión de hoy`);
    const portada = p.locator('.portada-vista');
    if (await portada.count()) await portada.getByRole('button', { name: /^\s*Empezar\s*$/ }).last().click();
    await p.locator('.sesion-vista input[inputmode="none"]').first().waitFor();
    await cerrarDialogos();

    // ---------------------------------------------------------------- la sesión: lo que cambia de sitio, y deshacer
    const orden = () => p.locator('[data-se] .ejercicio-cab .nombre').evaluateAll((xs) => xs.map((x) => x.textContent.trim()));
    const o0 = await orden();
    await p.getByRole('button', { name: /^Máquina ocupada: hacer / }).first().click();
    const toast = p.locator('.toast');
    await toast.waitFor();
    const o1 = await orden();
    check(o1.length === o0.length && o1[0] === o0[1] && o1.indexOf(o0[0]) > 0 && /para luego/.test(await toast.textContent()) && await toast.locator('.toast-accion').textContent() === 'Deshacer',
      `(210) «Máquina ocupada · hacerlo luego»: ${o0[0]} pasa detrás y sube ${o0[1]}, con «Deshacer» en la misma pastilla`);
    await toast.locator('.toast-accion').click();
    check(await hasta(async () => (await orden()).join('|') === o0.join('|'), 4000), '«Deshacer» lo devuelve a su sitio');
    // (la tarjeta que se dejó para luego se plegó: se vuelve a abrir)
    const tarjeta = p.locator('[data-se]').first();
    if (await tarjeta.locator('.ejercicio-cab').getAttribute('aria-expanded') !== 'true') await tarjeta.locator('.ejercicio-cab').click();
    await tarjeta.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    await p.locator('.temporizador').getByRole('button', { name: /^Saltar$/ }).click();
    await tarjeta.getByRole('button', { name: 'Quitar la serie 1' }).click();
    check(await hasta(async () => /Serie 1 quitada/.test(await toast.textContent()) && await toast.locator('.toast-accion').count() === 1, 4000), '(249) quitar una serie deja «Deshacer» en su pastilla');
    await toast.locator('.toast-accion').click();
    check(await hasta(async () => await tarjeta.getByRole('button', { name: 'Quitar la serie 1' }).count() === 1, 5000), 'y «Deshacer» la devuelve, con lo que tenía apuntado');
    const saltar = p.locator('.temporizador').getByRole('button', { name: /^Saltar$/ });
    if (await saltar.waitFor({ timeout: 2500 }).then(() => true).catch(() => false)) await saltar.click();
    await p.getByRole('button', { name: `Más herramientas de ${o0[0]}` }).click();
    await p.locator('[aria-modal="true"]').last().locator('button', { hasText: 'Por una alternativa' }).first().click();
    const hojaC = p.locator('[aria-modal="true"]').last();
    await hojaC.locator('.lista-elegir button[aria-pressed="false"]').first().waitFor();
    const otro = (await hojaC.locator('.lista-elegir button[aria-pressed="false"]').first().locator('span').first().textContent()).trim();
    await hojaC.locator('.lista-elegir button[aria-pressed="false"]').first().click();
    check(await hasta(async () => (await orden())[0] === otro && (await toast.textContent()).includes(`Ahora: ${otro}`) && await toast.locator('.toast-accion').count() === 1, 5000),
      `(211) cambiar ${o0[0]} por ${otro}: la tarjeta pasa al nuevo y la pastilla trae «Deshacer»`);
    await toast.locator('.toast-accion').click();
    check(await hasta(async () => (await orden())[0] === o0[0], 4000), 'y «Deshacer» vuelve al que tenías');

    // ---------------------------------------------------------------- el modo zurdo, en la sesión
    const campo = p.locator('[data-se]').first().locator('.serie:not(.hecha) input[inputmode="none"]').first();
    await campo.scrollIntoViewIfNeeded();
    await campo.click();
    await p.locator('.teclado-serie .teclado-teclas').waitFor();
    const fila = await campo.evaluate((el) => { const f = el.closest('.serie'); const x = (q) => Math.round(f.querySelector(q).getBoundingClientRect().x); return { visto: x('.hecho-btn'), n: x('.n'), kg: x('.celda-kg'), rpe: x('.rpe') }; });
    const teclas = await p.locator('.teclado-teclas').evaluate((e) => { const x = (b) => Math.round(b.getBoundingClientRect().x); const de = (t) => [...e.children].find((b) => b.textContent.trim() === t); return { paso: x(e.querySelector('.tecla-paso')), sig: x(e.querySelector('.tecla-siguiente')), uno: x(de('1')), tres: x(de('3')), cero: x(de('0')) }; });
    check(fila.visto < fila.n && fila.n < fila.kg && fila.kg < fila.rpe, `en la sesión, el ✓ de cada serie va a la izquierda (✓ ${fila.visto} px, serie ${fila.n}, kilos ${fila.kg}, esfuerzo ${fila.rpe})`);
    check(teclas.paso < teclas.uno && teclas.uno < teclas.tres && teclas.sig < teclas.cero, 'y en el teclado, −/+ y «Siguiente» a la izquierda, con las cifras en su orden');
    await revisar('el modo zurdo');
    await p.locator('.teclado-serie').getByRole('button', { name: 'Ocultar el teclado' }).click();

    // ---------------------------------------------------------------- recetas con las manos
    await entrar();
    await p.locator('nav.tabs').getByRole('button', { name: /^Recetas/ }).first().click();
    const tarjetas = p.locator('.rejilla-recetas button');
    await tarjetas.first().waitFor();
    let conTiempos = false;
    for (let k = 0; k < Math.min(10, await tarjetas.count()) && !conTiempos; k++) {
      await tarjetas.nth(k).scrollIntoViewIfNeeded();
      await tarjetas.nth(k).click();
      await p.locator('[aria-modal="true"] .coc-ing').first().waitFor();
      conTiempos = await p.locator('[aria-modal="true"] .coc-tiempo').count() > 0;
      if (!conTiempos) { await p.keyboard.press('Escape'); await p.locator('[aria-modal="true"]').waitFor({ state: 'detached' }); }
    }
    const hoja = p.locator('[aria-modal="true"]').last();
    const nIng = await hoja.locator('.coc-ing').count();
    check(conTiempos && nIng >= 2 && await hoja.locator('.coc-ingredientes').getAttribute('aria-label') === 'Ingredientes: marca los que ya tienes', `una receta con ${nIng} ingredientes, cada uno una casilla`);
    await hoja.locator('.coc-ing').nth(0).click();
    check(await hoja.locator('.coc-casilla:checked').count() === 1 && await hoja.locator('.coc-ing').nth(0).locator('.coc-ing-t').evaluate((e) => getComputedStyle(e).textDecorationLine.includes('line-through'))
      && await p.evaluate(() => /"k":\[0\]/.test(localStorage.getItem('fbe-receta-tengo') || '')), '(237) tocar un ingrediente lo tacha («ya lo tengo») y se recuerda en este móvil');
    const cifra = (k) => hoja.locator('.coc-ing').nth(k).locator('.odometro .sr').textContent().then((t) => Number(t.replace(',', '.')));
    const antes = await cifra(1);
    await hoja.getByRole('button', { name: /^Sumar|^Añadir|\+/ }).last().click();
    check(await hasta(async () => await cifra(1) === antes * 2, 3000), `(241) con dos raciones, las cantidades cambian (${antes} → ${antes * 2})`);
    await revisar('una receta');
    const tiempo = hoja.locator('.coc-tiempo').first();
    await tiempo.scrollIntoViewIfNeeded();
    const etq = await tiempo.getAttribute('aria-label');
    await tiempo.click();
    const pastilla = hoja.locator('.coc-pastilla');
    await pastilla.waitFor();
    const t1 = (await pastilla.locator('.coc-pastilla-n').textContent()).trim();
    check(/: poner un temporizador de \d+ (minutos?|segundos?|horas?)/.test(etq) && /^\d+:\d\d/.test(t1) && await tiempo.getAttribute('aria-pressed') === 'true' && await pastilla.getAttribute('role') === 'timer',
      `(239) tocar «${(await tiempo.textContent()).trim()}» arranca su temporizador, que sigue en una pastilla (${t1})`);
    await pastilla.getByRole('button', { name: 'Un minuto más' }).click();
    const seg = (t) => t.split(':').reduce((a, x) => a * 60 + Number(x), 0);
    check(await hasta(async () => seg((await pastilla.locator('.coc-pastilla-n').textContent()).trim()) > seg(t1) + 50, 3000), '«+1 min» le da un minuto más');
    await hoja.getByRole('button', { name: 'Modo cocina' }).click();
    const coc = p.locator('.coc-raiz');
    await coc.waitFor();
    const nPasos = await coc.locator('.coc-b').count();
    const letra = await coc.locator('.coc-paso').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    check(await coc.getAttribute('role') === 'dialog' && (await coc.locator('.coc-de').textContent()).trim() === `Paso 1 de ${nPasos}` && letra >= 22 && await coc.locator('.coc-pastilla').count() === 1,
      `(238) el modo cocina: un paso por pantalla («Paso 1 de ${nPasos}»), con letra grande (${Math.round(letra)} px) y su temporizador a la vista`);
    await revisar('el modo cocina');
    await arrastrar(300, 420, -120, 0);
    check(await hasta(async () => (await coc.locator('.coc-de').textContent()).trim() === `Paso 2 de ${nPasos}`, 3000), 'se pasa de paso deslizando');
    await coc.getByRole('button', { name: 'Anterior' }).click();
    check(await hasta(async () => (await coc.locator('.coc-de').textContent()).trim() === `Paso 1 de ${nPasos}`, 3000), 'o con sus botones');
    await coc.getByRole('button', { name: 'Ver los ingredientes' }).click();
    check(await coc.locator('.coc-ing').count() === nIng && await coc.locator('.coc-casilla:checked').count() === 1, 'y sus ingredientes, con lo que ya estaba tachado');
    await p.keyboard.press('Escape');
    await coc.waitFor({ state: 'detached' });
    check(await p.locator('[aria-modal="true"]').count() === 1, 'Escape cierra el modo cocina (solo a él: la receta sigue abierta)');
    await pastilla.getByRole('button', { name: 'Parar el temporizador' }).click();
    await pastilla.waitFor({ state: 'detached' });
    const guardar = hoja.locator('.coc-guardar');
    await guardar.scrollIntoViewIfNeeded();
    const estaba = await guardar.getAttribute('aria-pressed');
    if (estaba === 'true') { await guardar.click(); await p.waitForFunction(() => document.querySelector('.coc-guardar')?.getAttribute('aria-pressed') === 'false'); await p.waitForTimeout(300); }
    await guardar.click();
    const chispas = await hoja.locator('.coc-chispa').count();
    check(chispas === 3 && await hasta(async () => await guardar.getAttribute('aria-pressed') === 'true' && await hoja.locator('.coc-chispa').count() === 0, 4000), '(240) al guardarla, la estrella suelta tres chispas (y se van)');
    check(errores.length === 0, `la barra, la sesión y las recetas, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4192);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Tacto, segunda vuelta (v0.272)');
  try { await probarTacto2({ navegador, check, base: 'http://localhost:4192' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 4).join(' / ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
