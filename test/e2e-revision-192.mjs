// (v0.192) La revisión semanal, segunda tanda, en la demo: tus pasos, el punto del bloque, sus mensajes sin leer (y
// contestarlos ahí), la comparación con la semana anterior, sus vídeos, «pedírselo» desde un aviso, «a medias» y su
// filtro, el tono y el envío programado del mensaje, la nota convertida en tarea, la tabla, el resumen y las frases
// guardadas en la base. En ordenador y, al final, a 360 px en oscuro.
//   Suelta:  npm run build && node test/e2e-revision-192.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRevision192({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
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
    check(await p.locator('.rev-pasos').count() === total && await p.locator('.rev-pasos li.hecho').count() >= 1 && await p.locator('.rev-pasos li:not(.hecho)').count() >= 1, 'cada tarjeta lleva tus pasos, unos hechos y otros no');
    check(await p.locator('.rev-punto', { hasText: /semana \d+/ }).count() >= 2 && await p.locator('.revision-quien .chispa-sesiones').count() >= 2, 'y dice en qué punto del bloque está, con su minigráfica de seis semanas');

    // 1: sus mensajes sin leer, ahí mismo
    const conMensaje = p.locator('.revision-lista > .revision-fila', { has: p.locator('.chip', { hasText: /mensajes? sin leer/ }) }).first();
    const quienMsg = (await conMensaje.locator('.revision-quien strong').textContent()).trim();
    await conMensaje.getByRole('button', { name: 'Ver su semana aquí' }).click();
    const fm = filaDe(quienMsg);
    check(await hasta(async () => (await fm.locator('.rev-mensajes li').count()) >= 1), 'al abrir su semana salen sus mensajes sin leer');
    check(await hasta(async () => (await fm.locator('.rev-compara > div').count()) === 3), 'y la comparación con la semana anterior');
    await fm.getByLabel(`Responder a ${quienMsg}`).fill('Visto, lo miro al programar.');
    await fm.getByRole('button', { name: 'Responder' }).click();
    check(await hasta(async () => (await fm.locator('.rev-mensajes').count()) === 0 && (await fm.locator('.chip', { hasText: /mensajes? sin leer/ }).count()) === 0)
      && await hasta(async () => (await fm.locator('.rev-pasos li.hecho', { hasText: 'Mensajes leídos' }).count()) === 1), 'se contesta ahí y quedan leídos (el aviso se va y el paso se tacha)');
    await revisar('mensajes');
    await fm.getByRole('button', { name: 'Ocultar su semana' }).click();

    // 2: los vídeos sin revisar
    const conVideo = p.locator('.revision-lista > .revision-fila', { has: p.locator('.chip', { hasText: /vídeos? sin revisar/ }) }).first();
    if (await conVideo.count()) {
      await conVideo.getByRole('button', { name: 'Ver su semana aquí' }).click();
      check(await hasta(async () => (await conVideo.locator('.rev-video').count()) >= 1), 'sus vídeos sin revisar salen en la tarjeta');
      await conVideo.getByRole('button', { name: 'Ocultar su semana' }).click();
    } else check(true, '(nadie con vídeos sin revisar en la demo de hoy)');

    // 3: «pedírselo» desde un aviso
    const pedir = p.locator('.rev-pedir').first();
    check(await pedir.count() === 1, 'algún aviso se puede pedir con un mensaje');
    await pedir.click();
    let hoja = p.getByRole('dialog').last();
    check(/^Hola, /.test(await hoja.locator('textarea').inputValue()) && await hoja.locator('.rev-lote').count() === 0, 'el mensaje sale ya escrito para ese aviso');
    await hoja.locator('.btn-primario').click();
    check(await hasta(async () => (await p.getByRole('dialog').count()) === 0), 'y se envía');

    // 15: «a medias»
    const primera = filas().first();
    const quien = (await primera.locator('.revision-quien strong').textContent()).trim();
    await primera.getByLabel(`Estado de la revisión de ${quien}`).selectOption('esperando');
    check(await hasta(async () => (await filaDe(quien).locator('.chip', { hasText: 'Esperando su respuesta' }).count()) === 1) && await hasta(async () => (await p.locator('.rev-filtro', { hasText: /A medias \(1\)/ }).count()) === 1), 'un atleta se queda «esperando su respuesta» y sale su filtro');
    await p.waitForTimeout(700);   // (la demo guarda con un pequeño margen)
    await p.reload();
    await p.locator('.revision-fila').first().waitFor();
    check(await hasta(async () => (await filaDe(quien).locator('.chip', { hasText: 'Esperando su respuesta' }).count()) === 1), 'y sigue así al volver');

    // 4 y 5: el tono y el envío programado
    await filaDe(quien).getByRole('button', { name: 'Redactar mensaje' }).click();
    hoja = p.getByRole('dialog').last();
    const area = hoja.locator('textarea');
    await hasta(async () => !/completándolo/.test(await hoja.locator('label[for^="rev-msg-"]').textContent()));
    await hoja.getByRole('group', { name: 'Tono del mensaje' }).getByRole('button', { name: 'Semana floja' }).click();
    check(/más floja/.test(await area.inputValue()), 'el tono cambia cómo abre el mensaje');
    await area.fill('Hola. Lo vemos el lunes.');
    await area.evaluate((a) => { a.focus(); a.setSelectionRange(6, a.value.length); });
    await hoja.getByRole('button', { name: 'Guardar lo seleccionado' }).click();
    await hasta(async () => (await hoja.locator('.rev-frase').count()) >= 1);
    await hoja.getByLabel('Programar el envío').check();
    check(/^\d{4}-\d{2}-\d{2}T08:00$/.test(await hoja.getByLabel('Cuándo sale el mensaje').inputValue()) && await hoja.getByRole('button', { name: 'Programar', exact: true }).count() === 1, 'programar el envío: propone el lunes a las 8');
    await revisar('mensaje-192');
    await hoja.getByLabel('Al enviar, darlo por revisado').uncheck();
    await hoja.getByRole('button', { name: 'Programar', exact: true }).click();
    check(await hasta(async () => (await p.getByRole('dialog').count()) === 0), 'y queda programado');

    // 20: las frases, en la base (aunque se borre lo del aparato)
    await p.evaluate(() => localStorage.removeItem('fbe-revision-frases'));
    await p.reload();
    await p.locator('.revision-fila').first().waitFor();
    await filaDe(quien).getByRole('button', { name: 'Redactar mensaje' }).click();
    hoja = p.getByRole('dialog').last();
    check(await hasta(async () => (await hoja.locator('.rev-frase', { hasText: 'Lo vemos el lunes.' }).count()) === 1), 'la frase guardada vuelve desde la base');
    await p.keyboard.press('Escape');

    // 19 y 6: la nota, a tarea
    const f1 = filaDe(quien);
    if (await f1.getByRole('button', { name: 'Añadir nota' }).count()) await f1.getByRole('button', { name: 'Añadir nota' }).click();
    await f1.locator('.revision-nota textarea').fill('Mandar vídeo de sentadilla');
    await f1.locator('.revision-quien strong').click();
    await f1.getByRole('button', { name: 'Convertir la nota en tarea' }).click();
    hoja = p.getByRole('dialog').last();
    check(await hasta(async () => (await hoja.locator('input').evaluateAll((xs) => xs.some((x) => x.value === 'Mandar vídeo de sentadilla')))), 'la nota se convierte en una tarea ya escrita');
    await p.keyboard.press('Escape');
    await hasta(async () => (await p.getByRole('dialog').count()) === 0);

    // 17 y 18: la tabla y el resumen
    await p.getByRole('group', { name: 'Cómo verlo' }).getByRole('button', { name: 'Tabla' }).click();
    const tabla = p.locator('.rev-tabla-todos');
    check(await hasta(async () => (await tabla.locator('tbody tr').count()) === total), 'la vista de tabla, con todos en filas');
    await tabla.getByRole('button', { name: /^Atleta/ }).click();
    const orden = await tabla.locator('tbody th button').allTextContents();
    check(orden.join() === [...orden].sort((a, b) => b.localeCompare(a, 'es')).join(), 'y se ordena por una columna al tocarla');
    await revisar('tabla');
    await foto('192-tabla');
    await p.getByRole('group', { name: 'Cómo verlo' }).getByRole('button', { name: 'Tarjetas' }).click();
    await p.locator('.rev-resumen summary').click();
    check(/Revisados: 0 de \d+/.test(await p.locator('.rev-resumen').textContent()) && /Esperando respuesta de:/.test(await p.locator('.rev-resumen').textContent()), 'el resumen de la revisión dice lo que queda suelto');
    await filaDe(quien).getByLabel(`Estado de la revisión de ${quien}`).selectOption('');
    await foto('192-lista');
    check(errores.length === 0, `sin errores en ordenador${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }

  // En el móvil, a 360 px y en oscuro
  errores.length = 0;
  const movil = await navegador.newContext({ viewport: { width: 360, height: 740 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce', bypassCSP: true });
  try {
    await entrar(movil);
    await filas().first().getByRole('button', { name: 'Ver su semana aquí' }).click();
    await filas().first().locator('.rev-detalle .rev-bloque').first().waitFor();
    await p.waitForTimeout(600);
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360 && [...document.querySelectorAll('.revision-fila, .rev-detalle, .rev-pasos, .rev-extra, .rev-controles')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    await revisar('movil-360-oscuro');
    await foto('192-movil');
    check(cabe && await p.getByRole('group', { name: 'Cómo verlo' }).count() === 0 && errores.length === 0, `en el móvil cabe a 360 px en oscuro y no hay tabla${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await movil.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4179);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('La revisión semanal, segunda tanda (v0.192)');
  try { await probarRevision192({ navegador, check, base: 'http://localhost:4179', capturas: process.env.CAPTURAS || null }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).slice(0, 400)); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
