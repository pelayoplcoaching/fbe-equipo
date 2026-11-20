// (v0.196) «Revisar», segunda tanda: dos columnas, uno a uno, teclas (/ y ?), el resumen de la tanda, tus frases por
// tipo y tu «Visto», contestar con un emoji, tarea y vídeo desde la tarjeta, la nota para la revisión semanal, fijar
// arriba, «En 3 días», la gráfica de la sesión, lo último que os habéis dicho, por motivo y tus tiempos. En ordenador y
// a 360 px en oscuro.
//   Suelta:  npm run build && node test/e2e-revisar-196.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRevisar196({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
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
    await irASeccion(p, 'Revisar');
    await p.locator('.tarjeta-revisar').first().waitFor();
  }
  const tarjetas = () => p.locator('.rejilla-revisar .tarjeta-revisar');
  const sub = async () => (await p.locator('.cabecera-grande .sub, .titulo .sub').first().textContent().catch(() => '')) || '';
  const numSub = async () => Number((await sub()).match(/\d+/)?.[0] || 0);

  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true });
  try {
    await entrar(ctx);
    const fijar = async (loc) => p.locator(`[data-item="${await loc.locator('xpath=ancestor::div[@data-item][1]').getAttribute('data-item')}"]`);
    const mas = async (t) => { const b = t.locator('button.revisar-mas-btn'); if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click(); return t.getByRole('group', { name: 'Más acciones' }); };
    const cerrarHoja = async (h) => { await p.keyboard.press('Escape'); await h.waitFor({ state: 'hidden' }).catch(() => {}); };

    // Teclas: «?» y «/»
    await p.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await p.keyboard.press('?');
    const teclas = p.getByRole('dialog', { name: 'Teclas de Revisar' });
    check(await hasta(async () => teclas.isVisible()), '«?» enseña las teclas');
    await cerrarHoja(teclas);
    await p.keyboard.press('/');
    check(await hasta(async () => p.evaluate(() => document.activeElement?.closest?.('.revisar-buscar') != null)), '«/» lleva a buscar');
    await p.locator('h1').click();

    // Por motivo
    const motivos = p.getByRole('group', { name: 'Por motivo' });
    if (await motivos.isVisible().catch(() => false)) {
      const n0 = await numSub();
      await motivos.getByRole('button').first().click();
      const k = Number(((await motivos.getByRole('button').first().textContent()) || '').match(/\((\d+)\)/)?.[1] || 0);
      check(await hasta(async () => (await tarjetas().count()) === k), `por motivo: solo lo que lo cumple (${k} de ${n0})`);
      await motivos.getByRole('button').first().click();
    } else check(true, '(la demo no tiene nada urgente)');

    // La gráfica de la sesión
    const conSeries = await fijar(tarjetas().filter({ has: p.getByRole('button', { name: 'Ver serie a serie' }) }).first());
    await conSeries.getByRole('button', { name: 'Ver serie a serie' }).click();
    check(await hasta(async () => (await conSeries.locator('figure.rev-linea svg polyline').count()) > 0), 'al ver serie a serie, la gráfica del ejercicio principal');
    await conSeries.getByRole('button', { name: 'Ocultar las series' }).click();

    // Lo último que os habéis dicho
    const msj = p.locator('.tarjeta-revisar.mensaje-pendiente').first();
    if (await msj.isVisible().catch(() => false)) {
      await msj.getByRole('button', { name: 'Lo último que os habéis dicho' }).click();
      check(await hasta(async () => (await msj.locator('.revisar-ultimos li').count()) > 0), 'lo último que os habéis dicho, sin abrir el chat');
    } else check(true, '(sin mensajes en la demo)');

    // Tus frases y tu «Visto»
    await p.getByRole('button', { name: 'Tus frases' }).click();
    const hf = p.getByRole('dialog', { name: 'Tus frases' });
    await hf.getByLabel('Frase nueva').fill('Muy buena sesión, {nombre}');
    await hf.getByRole('button', { name: 'Añadir' }).click();
    check(await hasta(async () => (await hf.locator('.rev-frase').count()) > 0), 'añadir una frase para las sesiones');
    await hf.getByLabel(/Tu «Visto»/).fill('Genial 🔥');
    await hf.getByRole('button', { name: 'Guardar', exact: true }).click();
    check(await hasta(async () => ((await p.locator('button.revisar-visto').first().textContent()) || '').includes('Genial 🔥')), 'tu «Visto», en todas las tarjetas');
    const ses = await fijar(tarjetas().filter({ has: p.getByRole('button', { name: 'Ver serie a serie' }) }).first());
    await ses.getByRole('button', { name: 'Comentar', exact: true }).click();
    check(await hasta(async () => ((await ses.getByRole('group', { name: 'Frases rápidas' }).getByRole('button').first().textContent()) || '').startsWith('Muy buena sesión')), 'en una sesión, primero tus frases de sesiones (con su nombre)');
    await ses.getByRole('button', { name: 'Cerrar', exact: true }).click();

    // Fijar arriba
    const paraFijar = await fijar(tarjetas().filter({ has: p.locator('button.revisar-mas-btn') }).nth(1));
    const clave = await paraFijar.getAttribute('data-item');
    await (await mas(paraFijar)).getByRole('button', { name: 'Fijar arriba' }).click();
    check(await hasta(async () => ((await p.locator('.grupo-revisar').first().locator('.grupo-revisar-nombre').textContent()) || '').includes('Fijadas arriba') && (await p.locator('.grupo-revisar').first().locator(`[data-item="${clave}"]`).count()) === 1), 'fijada arriba, en su grupo, lo primero');
    await (await mas(p.locator(`[data-item="${clave}"]`))).getByRole('button', { name: 'Quitar de arriba' }).click();
    check(await hasta(async () => (await p.getByText('Fijadas arriba').count()) === 0), 'y se quita');

    // Tarea, vídeo y nota desde la tarjeta
    const t1 = await fijar(tarjetas().filter({ has: p.getByRole('button', { name: 'Ver serie a serie' }) }).first());
    await (await mas(t1)).getByRole('button', { name: 'Pedirle un vídeo' }).click();
    const ht = p.getByRole('dialog', { name: /Una tarea para/ });
    check(await hasta(async () => ht.isVisible()) && (await ht.getByLabel('Ejercicio').inputValue()) !== '' && /Grábame/.test(await ht.getByLabel('Título').inputValue()), 'pedir un vídeo: la tarea, con el ejercicio principal ya puesto');
    await cerrarHoja(ht);
    await (await mas(t1)).getByRole('button', { name: 'Para la revisión semanal' }).click();
    const hn = p.getByRole('dialog', { name: /Para la revisión semanal de/ });
    check(await hasta(async () => hn.isVisible()) && ((await hn.getByLabel('Nota para la revisión semanal').inputValue()) || '').length > 3, 'para la revisión semanal: una nota ya redactada');
    await hn.getByRole('button', { name: 'Guardar la nota' }).click();
    check(await hasta(async () => (await p.getByText('Te saldrá en su revisión semanal').count()) > 0), 'que se guarda para su revisión de esta semana');

    // Contestar con un emoji
    let n = await numSub();
    const ck = await fijar(tarjetas().filter({ hasText: 'Check-in' }).filter({ has: p.locator('button.revisar-mas-btn') }).first());
    await (await mas(ck)).getByRole('button', { name: 'Contestar con 👍' }).click();
    check(await hasta(async () => (await numSub()) === n - 1), 'un 👍 contesta y lo da por revisado');

    // «En 3 días»
    n = await numSub();
    const t3 = await fijar(tarjetas().filter({ has: p.locator('button.revisar-mas-btn') }).first());
    await (await mas(t3)).getByRole('button', { name: 'En 3 días' }).click();
    check(await hasta(async () => (await numSub()) === n - 1) && await p.getByRole('button', { name: /dejado para mañana/ }).isVisible(), '«En 3 días» también la aparta');

    // El resumen de la tanda
    await p.getByRole('button', { name: 'Resumen de esta tanda' }).click();
    check(await hasta(async () => /Esta tanda:.*contestada/.test((await p.locator('.revisar-resumen').textContent()) || '')), 'el resumen de esta tanda');

    // Uno a uno
    n = await numSub();
    await p.getByRole('button', { name: 'Uno a uno' }).click();
    const uno = p.getByRole('dialog', { name: 'Uno a uno' });
    check(await hasta(async () => ((await uno.textContent()) || '').includes(`1 de ${n}`)), `uno a uno: «1 de ${n}»`);
    await uno.getByRole('button', { name: /^Siguiente/ }).click();
    check(await hasta(async () => ((await uno.textContent()) || '').includes(`2 de ${n}`)), 'y «Siguiente»');
    await p.keyboard.press('ArrowLeft');
    check(await hasta(async () => ((await uno.textContent()) || '').includes(`1 de ${n}`)), 'con las flechas, también');
    await revisar('uno-a-uno');
    await cerrarHoja(uno);

    // Dos columnas
    await p.getByRole('button', { name: 'Dos columnas' }).click();
    const filas = p.locator('.revisar-col-lista .revisar-fila');
    check(await hasta(async () => (await filas.count()) === n && (await p.locator('.revisar-col-panel .tarjeta-revisar').count()) === 1), 'dos columnas: la lista y una tarjeta');
    await filas.nth(1).click();
    check(await hasta(async () => (await filas.nth(1).getAttribute('aria-current')) === 'true'), 'tocar una fila la abre a la derecha');
    await p.locator('h1').click();
    await p.keyboard.press('j');
    check(await hasta(async () => (await filas.nth(2).getAttribute('aria-current')) === 'true'), '«j» pasa a la siguiente');
    await revisar('dos-columnas');
    await foto('196-columnas');
    await p.getByRole('button', { name: 'Dos columnas' }).click();

    // Tus tiempos
    await p.getByRole('button', { name: 'Tus tiempos' }).click();
    const htp = p.getByRole('dialog', { name: 'Tus tiempos en Revisar' });
    check(await hasta(async () => (await htp.locator('tbody tr').count()) === 5), 'tus tiempos: todo, sesiones, check-ins, vídeos y mensajes');
    await cerrarHoja(htp);
    check(errores.length === 0, `sin errores en ordenador${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }

  // En el móvil, a 360 px y en oscuro: el menú «Más» abierto
  errores.length = 0;
  const movil = await navegador.newContext({ viewport: { width: 360, height: 740 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce', bypassCSP: true });
  try {
    await entrar(movil);
    await p.locator('button.revisar-mas-btn').first().click();
    await p.waitForTimeout(400);
    await revisar('movil-mas');
    await foto('196-movil');
    check(await p.getByRole('button', { name: 'Dos columnas' }).count() === 0, 'en el móvil no sale «Dos columnas»');
    check(errores.length === 0, `en el móvil, cabe a 360 px en oscuro${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await movil.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4184);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Revisar, segunda tanda (v0.196)');
  try { await probarRevisar196({ navegador, check, base: 'http://localhost:4184', capturas: process.env.CAPTURAS || null }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).slice(0, 400)); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
