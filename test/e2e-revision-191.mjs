// (v0.191) La revisión semanal, más fácil de pasar, en la demo: la semana de cada atleta sin salir (sesiones con lo
// pautado frente a lo hecho, check-in, récords), el modo uno a uno, el teclado, el orden y los filtros, el mensaje con
// frases y «darlo por revisado al enviar», pedir el check-in en lote, la semana que viene, las semanas pasadas y la
// nota a la vista en el editor. En ordenador y, al final, a 360 px en oscuro.
//   Suelta:  npm run build && node test/e2e-revision-191.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRevision191({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
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
    check(total >= 5 && /^0 de \d+ revisados$/.test((await p.locator('.revision-progreso strong').first().textContent()).trim()), 'la lista de siempre, con todos por revisar');
    check(await p.locator('.revision-avisos .chip', { hasText: /Semana que viene (publicada|en borrador|sin programar)/ }).count() >= 2
      && await p.locator('.revision-acciones .btn.rev-falta').count() >= 1, 'cada tarjeta dice cómo está la semana que viene y lleva a programarla');

    // 1–7: su semana, sin salir de la tarjeta
    const ruben = filaDe('Rubén Martín');
    await ruben.getByRole('button', { name: 'Ver su semana aquí' }).click();
    await ruben.locator('.rev-detalle').waitFor();
    check(await hasta(async () => (await ruben.locator('.rev-sesion').count()) >= 2) && await ruben.locator('.rev-checkin > div').count() >= 3, 'al abrirla salen sus sesiones y su check-in');
    await ruben.locator('.rev-sesion.hecha .rev-sesion-cab').first().click();
    check(await hasta(async () => (await ruben.locator('.rev-tabla tbody tr').count()) >= 3) && /\d x \d/.test(await ruben.locator('.rev-tabla tbody tr td').first().textContent()), 'una sesión se abre con lo pautado frente a lo hecho');
    check(await ruben.locator('.rev-bloque h2', { hasText: 'Récords y parones' }).count() === 1 && await ruben.locator('.rev-bloque h2', { hasText: 'Peso, comida y hábitos' }).count() === 1, 'y sus récords, parones, peso y hábitos');
    await revisar('detalle');
    await foto('191-detalle');
    await ruben.getByRole('button', { name: 'Ocultar su semana' }).click();

    // 11–12: el orden y los filtros
    await p.getByLabel('Orden de la lista').selectOption('nombre');
    const porNombre = await nombres();
    check(porNombre.join() === [...porNombre].sort((a, b) => a.localeCompare(b, 'es')).join(), 'se puede ordenar por nombre');
    await p.getByLabel('Orden de la lista').selectOption('mio');
    const antes = await nombres();
    await filas().nth(1).getByRole('button', { name: /^Subir a / }).click();
    const despues = await nombres();
    check(despues[0] === antes[1] && despues[1] === antes[0], '«Mi orden»: se sube a uno con su flecha');
    // (la demo guarda con un pequeño margen: recargar al instante, con la máquina ocupada, a veces llegaba antes que el
    // guardado, como en la pasada del 24/12. Fuera de la demo, si se recarga antes de que llegue a la base, ya manda lo
    // del aparato: v0.206.1)
    await p.waitForTimeout(700);
    await p.reload();
    await p.locator('.revision-fila').first().waitFor();
    check((await nombres()).join() === despues.join() && await p.getByLabel('Orden de la lista').inputValue() === 'mio', 'y el orden se recuerda al volver');
    await p.getByLabel('Orden de la lista').selectOption('urgencia');
    const filtro = p.locator('.rev-filtro', { hasText: 'Sin check-in' });
    const cuantos = Number((await filtro.textContent()).match(/\((\d+)\)/)[1]);
    await filtro.click();
    check(await filas().count() === cuantos && cuantos > 0 && cuantos < total && await filas().locator('.chip', { hasText: 'Check-in enviado' }).count() === 0, 'un filtro deja solo a los que les falta eso');
    await filtro.click();

    // 9: el teclado
    await p.locator('h1').click();
    await p.keyboard.press('j');
    check(await hasta(async () => (await filas().first().getAttribute('class')).includes('rev-cursor')), 'con J se señala al primero');
    await p.keyboard.press('j'); await p.keyboard.press('k');
    const primero = (await nombres())[0];
    await p.keyboard.press('x');
    check(await hasta(async () => /^1 de \d+ revisados$/.test((await p.locator('.revision-progreso strong').first().textContent()).trim())) && !(await nombres()).includes(primero), 'con X queda revisado y sale de pendientes');
    await p.getByRole('button', { name: 'Deshacer' }).click();
    check(await hasta(async () => (await nombres()).includes(primero)), 'y «Deshacer» lo devuelve');

    // 8 y 10: uno a uno, y revisado al enviar el mensaje
    await p.getByRole('button', { name: 'Revisar uno a uno' }).click();
    await p.locator('.rev-uno').waitFor();
    const uno = p.locator('.rev-uno');
    const quien = (await uno.locator('.revision-quien strong').textContent()).trim();
    check(/^1 de \d+$/.test((await uno.locator('.rev-uno-barra strong').textContent()).trim()) && await hasta(async () => (await uno.locator('.rev-detalle .rev-bloque').count()) >= 2) && await uno.locator('.revision-fila').count() === 1, 'uno a uno: un atleta en pantalla con su semana abierta');
    await uno.getByRole('button', { name: 'Redactar mensaje' }).click();
    const hoja = p.getByRole('dialog').last();
    const area = hoja.locator('textarea');
    await hasta(async () => !/completándolo/.test(await hoja.locator('label').first().textContent()));
    check(/Repaso de tu semana/.test(await area.inputValue()) && await hoja.getByLabel('Al enviar, darlo por revisado').isChecked(), 'el mensaje sale redactado y marcará la revisión al enviarlo');
    // 14: una frase guardada y usada
    await area.fill('Hola. Muy buen trabajo esta semana.');
    await area.evaluate((a) => { a.focus(); a.setSelectionRange(6, a.value.length); });
    await hoja.getByRole('button', { name: 'Guardar lo seleccionado' }).click();
    check(await hasta(async () => (await hoja.locator('.rev-frase').count()) === 1), 'un trozo del mensaje se guarda como frase');
    await area.fill('Hola.');
    await hoja.locator('.rev-frase').first().click();
    const entra = await hasta(async () => /^Hola\.\nMuy buen trabajo esta semana\.$/.test(await area.inputValue()));
    check(entra, `y entra en el mensaje con un toque${entra ? '' : ` (el mensaje quedó: ${JSON.stringify(await area.inputValue())}; frases: ${JSON.stringify(await hoja.locator('.rev-frase').allTextContents())})`}`);
    await revisar('mensaje');
    check(await hoja.getByRole('button', { name: 'Mejor una nota de voz' }).count() === 1, 'desde ahí se puede grabar una nota de voz');
    await hoja.getByRole('button', { name: 'Enviar', exact: true }).click();
    check(await hasta(async () => (await uno.locator('.revision-quien strong').textContent()).trim() !== quien) && /^2 de \d+$/.test((await uno.locator('.rev-uno-barra strong').textContent()).trim()), 'al enviarlo queda revisado y pasa solo al siguiente');
    await uno.getByRole('button', { name: /Anterior/ }).click();
    check(await hasta(async () => (await uno.locator('.revision-quien strong').textContent()).trim() === quien) && await uno.getByLabel(/^Revisión de .* terminada$/).isChecked(), '«Anterior» vuelve a él, ya marcado');
    await uno.getByLabel(/^Revisión de .* terminada$/).uncheck();
    await uno.locator('.revision-nota textarea').fill('Nota de prueba 191');
    await uno.locator('.rev-uno-barra strong').click();
    await p.waitForTimeout(400);
    await uno.getByRole('button', { name: 'Ver la lista' }).click();
    await p.locator('.revision-progreso').waitFor();

    // 16: pedir el check-in en lote
    const lote = p.getByRole('button', { name: /^Pedir el check-in \(\d+\)$/ });
    const n = Number((await lote.textContent()).match(/\((\d+)\)/)[1]);
    await lote.click();
    const hl = p.getByRole('dialog').last();
    check(await hl.locator('.rev-lote li').count() === n && /\{nombre\}/.test(await hl.locator('textarea').inputValue()), 'pedir el check-in: la lista de a quién y el mensaje con «{nombre}»');
    await hl.locator('.rev-lote input').first().uncheck();
    check(new RegExp(`Enviar a ${n - 1} atleta`).test(await hl.locator('.btn-primario').textContent()), 'se puede quitar a alguien antes de enviar');
    await revisar('lote');
    await hl.locator('.btn-primario').click();
    check(await hasta(async () => (await p.getByRole('dialog').count()) === 0) && await hasta(async () => (await p.locator('.aviso, .toast, [role=status]', { hasText: /Mensaje enviado/ }).count()) > 0, 4000), 'y sale a los elegidos');

    // 19: semanas pasadas
    await p.getByRole('button', { name: /Semana anterior/ }).click();
    check(await hasta(async () => (await p.locator('.rev-pasada').count()) >= 5) && /Solo se puede ver/.test(await p.locator('.contenido.revision').textContent()), 'una semana pasada se puede ver (y solo ver)');
    await p.getByRole('button', { name: /Semana siguiente/ }).click();
    await p.locator('.revision-progreso').waitFor();

    // 18: la nota, a la vista al programar
    await filaDe(quien).getByRole('button', { name: /^Programar/ }).click();
    check(await hasta(async () => (await p.locator('.nota-de-revision', { hasText: 'Nota de prueba 191' }).count()) === 1, 15000), 'la nota de la revisión sale en el editor de ese atleta');
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
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360 && [...document.querySelectorAll('.revision-fila, .rev-detalle, .rev-controles, .rev-arranque .btn')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    await revisar('movil-360-oscuro');
    await foto('191-movil');
    check(cabe && errores.length === 0, `cabe a 360 px en oscuro, sin fallos${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await movil.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4178);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('La revisión semanal, más fácil de pasar (v0.191)');
  try { await probarRevision191({ navegador, check, base: 'http://localhost:4178', capturas: process.env.CAPTURAS || null }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).slice(0, 400)); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
