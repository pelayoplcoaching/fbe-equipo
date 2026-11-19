// (v0.193) La revisión semanal, tercera tanda, en la demo: uno a uno con pestañas (su semana con el chat rápido al lado,
// el chat completo, los vídeos y el editor), citar un dato, corregir un vídeo ahí mismo, programar sin salir (también
// desde la lista, en una hoja), comentar el check-in, la opción de «Revisar» y el cierre. En ordenador y a 360 px.
//   Suelta:  npm run build && node test/e2e-revision-193.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRevision193({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(120); } return !!(await fn().catch(() => false)); };
  const foto = async (nombre) => { if (capturas) await p.screenshot({ path: `${capturas}/${nombre}.png`, fullPage: true }); };
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
  async function entrar(ctx) {
    p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await irASeccion(p, 'Revisión semanal');
    await p.locator('.revision-fila').first().waitFor();
  }
  const filas = () => p.locator('.revision-lista > .revision-fila');
  const filaDe = (nombre) => p.locator('.revision-lista > .revision-fila', { hasText: nombre }).first();
  const nombres = () => filas().locator('.revision-quien strong').allTextContents();

  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true });
  try {
    await entrar(ctx);
    const total = await filas().count();

    // 11: la ventana al editor, desde la lista
    const conBloque = p.locator('.revision-lista > .revision-fila', { has: p.locator('.rev-punto') }).first();
    const quienProg = (await conBloque.locator('.revision-quien strong').textContent()).trim();
    await conBloque.getByRole('button', { name: 'Programar', exact: true }).click();
    let hoja = p.getByRole('dialog').last();
    check(await hasta(async () => (await hoja.locator('.semanas-tabs').count()) === 1 && (await hoja.locator('section.editor-sesion').count()) >= 1, 15000), '«Programar» abre el editor de su programa sin salir de la revisión');
    check(await hoja.locator('.rev-editor-lado .rev-detalle').count() === 1 && await hoja.getByRole('button', { name: 'Abrir en su ficha' }).count() === 1, 'con su semana al lado y la salida a su ficha');
    await revisar('editor-en-hoja');
    await foto('193-editor');
    await hoja.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    check(await hasta(async () => (await p.getByRole('dialog').count()) === 0) && await p.locator('.revision-progreso').count() === 1, 'al cerrar, sigues en la revisión');

    // 16: uno a uno con pestañas
    await filaDe(quienProg).getByRole('button', { name: 'Uno a uno desde aquí' }).click();
    const uno = p.locator('.rev-uno');
    await uno.waitFor();
    const pest = uno.getByRole('tablist', { name: 'Qué ver de este atleta' });
    check((await pest.getByRole('tab').allTextContents()).map((t) => t.replace(/ \(\d+\)$/, '')).join().startsWith('Su semana,Chat') && await pest.getByRole('tab', { name: 'Programar' }).count() === 1, 'uno a uno tiene pestañas: Su semana, Chat, (Vídeos) y Programar');
    // 1, 3 y 5: el chat rápido al lado
    const rapido = uno.locator('.rev-chat-rapido');
    check(await hasta(async () => (await rapido.count()) === 1 && (await uno.locator('.rev-dos .revision-fila').count()) === 1), 'en ancho, su semana y el chat rápido van lado a lado');
    // 4: citar un dato
    await hasta(async () => (await uno.locator('.rev-detalle .rev-bloque').count()) >= 2);
    const citable = uno.locator('.rev-citar.ok').first();
    if (await citable.count()) {
      await citable.click();
      check(await hasta(async () => /Récord en /.test(await rapido.locator('textarea').inputValue())), 'tocar un récord lo cita en lo que estás escribiendo');
    } else {
      await uno.locator('.rev-sesion-cab').first().click();
      await uno.getByRole('button', { name: 'Citar en el chat' }).first().click();
      check(await hasta(async () => (await rapido.locator('textarea').inputValue()).length > 3), 'una sesión se cita en lo que estás escribiendo');
    }
    await rapido.locator('textarea').fill('Mensaje de prueba 193');
    await rapido.getByRole('button', { name: 'Enviar', exact: true }).click();
    check(await hasta(async () => (await rapido.locator('.rev-ultimos li.mio', { hasText: 'Mensaje de prueba 193' }).count()) === 1) && await hasta(async () => (await uno.locator('.rev-pasos li.hecho', { hasText: 'Le has escrito' }).count()) === 1), 'se envía desde el chat rápido, sale en la conversación y tacha el paso');
    check(await rapido.getByRole('button', { name: 'Nota de voz' }).count() === 1, 'y se puede grabar una nota de voz');
    await revisar('uno-semana');
    await foto('193-uno');
    // 2: el chat completo, en su pestaña (con el teclado)
    await uno.locator('.rev-uno-barra strong').click();
    await p.keyboard.press('2');
    check(await hasta(async () => (await uno.locator('.rev-chat .chat-escribir').count()) === 1 && (await uno.locator('.rev-chat', { hasText: 'Mensaje de prueba 193' }).count()) === 1, 15000), 'la tecla 2 abre el chat completo, con lo que acabas de mandar');
    await foto('193-chat');
    // 11 y 14: programar en su pestaña
    await pest.getByRole('tab', { name: 'Programar' }).click();
    check(await hasta(async () => (await uno.locator('.rev-editor .semanas-tabs').count()) === 1, 15000) && await uno.locator('.rev-editor-lado').count() === 1, 'la pestaña «Programar» es el editor, con su semana al lado');
    await revisar('uno-programar');
    await pest.getByRole('tab', { name: 'Su semana' }).click();
    // 17: comentar el check-in
    const comentar = uno.getByRole('button', { name: 'Comentar el check-in' });
    if (await comentar.count()) {
      await comentar.click();
      check(await hasta(async () => (await uno.locator('.rev-detalle textarea, .rev-detalle [contenteditable]').count()) >= 1), 'el check-in se comenta ahí mismo');
      await uno.getByRole('button', { name: 'Cerrar los comentarios' }).first().click();
    } else check(true, '(el primero no ha enviado check-in: nada que comentar)');
    await uno.getByRole('button', { name: 'Ver la lista' }).click();
    await p.locator('.revision-progreso').waitFor();

    // 6 a 10: corregir un vídeo ahí mismo
    const conVideo = p.locator('.revision-lista > .revision-fila', { has: p.locator('.chip', { hasText: /vídeos? sin revisar/ }) }).first();
    if (await conVideo.count()) {
      const quienV = (await conVideo.locator('.revision-quien strong').textContent()).trim();
      await conVideo.getByRole('button', { name: 'Uno a uno desde aquí' }).click();
      await uno.waitFor();
      await pest.getByRole('tab', { name: /^Vídeos/ }).click();
      check(await hasta(async () => (await uno.locator('.rev-video-panel').count()) === 1, 15000) && await uno.getByRole('button', { name: 'Pedir que lo repita' }).count() === 1 && await uno.getByRole('button', { name: 'Vídeo revisado' }).count() === 1, 'la pestaña «Vídeos» trae el vídeo con su corrección, pedir que lo repita y darlo por revisado');
      await foto('193-video');
      await uno.getByRole('button', { name: 'Pedir que lo repita' }).click();
      hoja = p.getByRole('dialog').last();
      check(await hasta(async () => (await hoja.locator('input').evaluateAll((xs) => xs.some((x) => /^Repite el vídeo/.test(x.value))))), '«Pedir que lo repita» deja la tarea de vídeo escrita');
      await p.keyboard.press('Escape');
      await hasta(async () => (await p.getByRole('dialog').count()) === 0);
      await uno.getByRole('button', { name: 'Vídeo revisado' }).click();
      check(await hasta(async () => /No tiene vídeos por revisar/.test(await uno.textContent()) || (await uno.locator('.rev-video-panel').count()) === 1), 'al darlo por revisado pasa al siguiente (o no queda ninguno)');
      await uno.getByRole('button', { name: 'Ver la lista' }).click();
      await p.locator('.revision-progreso').waitFor();
      check(quienV.length > 0, '(vídeo corregido)');
    } else { check(true, '(nadie con vídeos sin revisar en la demo de hoy)'); }

    // 19: la opción de «Revisar», apagada de primeras
    const opcion = p.locator('.rev-opcion input');
    check(await opcion.count() === 1 && !(await opcion.isChecked()), 'dar por revisado lo de «Revisar» es una opción, apagada de primeras');

    // 20: el cierre, al revisar al último en uno a uno
    for (let i = 0; i < total + 2; i++) {
      const c = filas().first().getByLabel(/^Revisión de .* terminada$/);
      if (!(await c.count()) || (await filas().count()) <= 1) break;
      await c.check();
      await p.waitForTimeout(350);
    }
    await p.getByRole('button', { name: 'Revisar uno a uno' }).click();
    await uno.waitFor();
    await uno.getByLabel(/^Revisión de .* terminada$/).check();
    check(await hasta(async () => (await p.locator('.rev-cierre').count()) === 1) && /Revisión terminada/.test(await p.locator('.rev-cierre h2').textContent()), 'al revisar al último sale el cierre de la revisión');
    await revisar('cierre');
    await foto('193-cierre');
    await p.locator('.rev-cierre').getByRole('button', { name: 'Hecho' }).click();
    check(await hasta(async () => (await p.locator('.revision-progreso').count()) === 1), 'y vuelve a la lista');
    check(errores.length === 0, `sin errores en ordenador${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }

  // En el móvil, a 360 px y en oscuro: uno a uno sin columnas, con el chat rápido debajo
  errores.length = 0;
  const movil = await navegador.newContext({ viewport: { width: 360, height: 740 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce', bypassCSP: true });
  try {
    await entrar(movil);
    await p.getByRole('button', { name: 'Revisar uno a uno' }).click();
    const uno = p.locator('.rev-uno');
    await uno.waitFor();
    await uno.locator('.rev-chat-rapido').waitFor();
    await p.waitForTimeout(600);
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360 && [...document.querySelectorAll('.revision-fila, .rev-pestanas, .rev-chat-rapido, .rev-uno-barra')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    await revisar('movil-uno');
    await foto('193-movil');
    check(cabe && await uno.locator('.rev-dos').count() === 0 && errores.length === 0, `en el móvil, uno a uno cabe a 360 px en oscuro, sin columnas${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await movil.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4180);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('La revisión semanal, tercera tanda (v0.193)');
  try { await probarRevision193({ navegador, check, base: 'http://localhost:4180', capturas: process.env.CAPTURAS || null }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).slice(0, 400)); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
