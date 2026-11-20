// (v0.197) «Revisar», tercera tanda: la respuesta redactada, tus frases con huecos, contestar a varias y más tarde, lo
// revisado (7 días, buscador y ✓✓), la vez anterior y ajustar su próxima sesión, el volumen de su semana, los avisos de
// patrón, el chat en una hoja, todo a mañana, etiquetas, lo siguiente más importante, cuánto te queda y deslizar a la
// izquierda en el móvil.
//   Suelta:  npm run build && node test/e2e-revisar-197.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRevisar197({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
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
    const conSeries = async () => fijar(tarjetas().filter({ has: p.getByRole('button', { name: 'Ver serie a serie' }) }).first());

    // Cuánto te queda y lo siguiente más importante
    check(/Te quedan unos? \d+/.test((await p.locator('.revisar-restante').textContent().catch(() => '')) || ''), 'cuánto te queda');
    await p.getByRole('button', { name: 'Lo siguiente más importante' }).click();
    check(await hasta(async () => p.evaluate(() => !!document.activeElement?.closest?.('.tarjeta-revisar'))), 'lo siguiente más importante: el foco va a esa tarjeta');

    // La respuesta redactada y los huecos de tus frases
    const ses = await conSeries();
    await ses.getByRole('button', { name: 'Comentar', exact: true }).click();
    await ses.getByRole('button', { name: 'Redactar con sus datos' }).click();
    const borrador = await ses.locator('textarea').inputValue();
    check(/^¡Bien, \S+! .+series/.test(borrador), `la respuesta redactada con sus datos («${borrador.slice(0, 60)}…»)`);
    await ses.locator('textarea').fill('');
    await ses.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await p.getByRole('button', { name: 'Tus frases' }).click();
    const hf = p.getByRole('dialog', { name: 'Tus frases' });
    await hf.getByLabel('Frase nueva').fill('{series} series y esfuerzo {esfuerzo}, {nombre}');
    await hf.getByRole('button', { name: 'Añadir' }).click();
    await cerrarHoja(hf);
    const ses2 = await conSeries();
    await ses2.getByRole('button', { name: 'Comentar', exact: true }).click();
    const fr = await ses2.getByRole('group', { name: 'Frases rápidas' }).getByRole('button').first().textContent();
    check(/^\d+\/\d+ series/.test(fr || '') && !/\{/.test(fr || ''), `los huecos de tus frases, rellenos («${fr}»)`);
    await ses2.getByRole('button', { name: 'Cerrar', exact: true }).click();

    // La vez anterior, ajustar su próxima sesión y su volumen
    const s3 = await conSeries();
    await s3.getByRole('button', { name: 'Ver serie a serie' }).click();
    check(await hasta(async () => (await s3.locator('thead th').allTextContents()).includes('La vez anterior')), 'serie a serie, con lo que hizo la vez anterior');
    const subir = s3.getByRole('button', { name: /^Subir 2,5 kg a / }).first();
    if (await subir.isVisible().catch(() => false)) {
      await subir.click();
      check(await hasta(async () => (await p.locator('.toast', { hasText: / kg en «/ }).count()) > 0 || (await p.locator('.toast', { hasText: /ninguna sesión por delante/ }).count()) > 0), 'subir 2,5 kg en su próxima sesión, en un toque');
    } else check(true, '(sin ejercicios con kilos)');
    check(await hasta(async () => (await s3.locator('.revisar-volumen .chip').count()) > 0), 'su semana por músculo');
    await s3.getByRole('button', { name: 'Ocultar las series' }).click();

    // Etiquetas
    const t1 = await fijar(tarjetas().filter({ has: p.locator('button.revisar-mas-btn') }).first());
    await (await mas(t1)).getByRole('button', { name: 'Ponerle una etiqueta' }).click();
    const he = p.getByRole('dialog', { name: 'Etiqueta' });
    await he.getByRole('button', { name: 'Para la llamada' }).click();
    check(await hasta(async () => (await t1.locator('.revisar-etiqueta').textContent().catch(() => '') || '').includes('Para la llamada')), 'una etiqueta, a la vista en la tarjeta');
    const n0 = await numSub();
    await p.getByRole('group', { name: 'Tus etiquetas' }).getByRole('button', { name: /Para la llamada/ }).click();
    check(await hasta(async () => (await tarjetas().count()) === 1), 'filtrar por tu etiqueta');
    await p.getByRole('group', { name: 'Tus etiquetas' }).getByRole('button', { name: /Para la llamada/ }).click();
    check(await hasta(async () => (await numSub()) === n0), 'y quitar el filtro');

    // Contestar más tarde
    let n = await numSub();
    const t2 = await fijar(tarjetas().filter({ hasText: 'Check-in' }).filter({ has: p.locator('button.revisar-mas-btn') }).first());
    await (await mas(t2)).getByRole('button', { name: 'Contestar más tarde' }).click();
    const hp = p.getByRole('dialog', { name: /más tarde/ });
    await hp.getByLabel('Mensaje').fill('Mañana lo vemos con calma');
    check(/T08:00$/.test(await hp.getByLabel('Cuándo sale la respuesta').inputValue()), 'por defecto, mañana a las 8');
    await hp.getByRole('button', { name: 'Programar' }).click();
    check(await hasta(async () => (await numSub()) === n - 1), 'programada: le llegará a su chat y la tarjeta sale de la lista');

    // Contestar a varias
    n = await numSub();
    await p.getByRole('button', { name: 'Elegir varias' }).click();
    const casillas = p.locator('.revisar-item.eligiendo').filter({ has: p.locator('.tarjeta-revisar strong') }).locator('.revisar-elegir input');
    await casillas.nth(0).click();
    await casillas.nth(1).click();
    await p.getByRole('region', { name: 'Las tarjetas elegidas' }).getByRole('button', { name: 'Contestar a todas' }).click();
    const hv = p.getByRole('dialog', { name: /Contestar a/ });
    await hv.getByLabel('Mensaje para todas').fill('¡Buen trabajo, {nombre}!');
    check(((await hv.textContent()) || '').includes('¡Buen trabajo, Ana!'), 'contestar a varias: se ve cómo le llega a uno');
    await hv.getByRole('button', { name: /^Contestar a/ }).click();
    check(await hasta(async () => (await numSub()) <= n - 1), 'y se contestan todas a la vez');

    // El chat en una hoja y todo a mañana
    await p.locator('.grupo-chat').first().click();
    const hc = p.getByRole('dialog', { name: /Chat con/ });
    check(await hasta(async () => hc.isVisible()), 'su chat, en una hoja');
    await revisar('chat-hoja');
    await cerrarHoja(hc);
    n = await numSub();
    const g0 = p.locator('.grupo-revisar').filter({ has: p.locator('.grupo-manana') }).first();
    const k = await g0.locator('.tarjeta-revisar').count();
    await g0.locator('.grupo-manana').click();
    check(await hasta(async () => (await numSub()) === n - k), `todo lo de un atleta, para mañana (${k})`);

    // Lo revisado: 7 días, buscador y ✓✓
    await p.getByRole('button', { name: 'Lo que has revisado hoy' }).click();
    const hr = p.getByRole('dialog', { name: /Lo que has revisado/ });
    await hr.getByRole('group', { name: 'Desde cuándo' }).getByRole('button', { name: '7 días' }).click();
    check(await hasta(async () => (await hr.locator('.revisado-hoy').count()) > 0), 'lo revisado en 7 días');
    check(await hasta(async () => /ha leído tu respuesta/.test((await hr.textContent()) || '')), 'con si ha leído tu respuesta');
    await hr.getByLabel('Buscar en lo revisado').fill('zzzz');
    check(await hasta(async () => (await hr.locator('.revisado-hoy').count()) === 0), 'y su buscador');
    await revisar('revisado-7');
    await cerrarHoja(hr);
    check(errores.length === 0, `sin errores en ordenador${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }

  // En el móvil: deslizar a la izquierda = «Mañana»
  errores.length = 0;
  const movil = await navegador.newContext({ viewport: { width: 360, height: 740 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce', bypassCSP: true });
  try {
    await entrar(movil);
    const n = await numSub();
    const desl = p.locator('.deslizable').filter({ has: p.locator('button.revisar-manana') }).first();
    await desl.scrollIntoViewIfNeeded();
    await desl.evaluate((el) => {
      const b = el.getBoundingClientRect(), y = b.top + 24, x0 = b.right - 30;
      const blanco = el.querySelector('.tarjeta-revisar strong, .tarjeta-revisar .cita, .tarjeta-revisar');
      const ev = (t, x) => blanco.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 42, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
      ev('pointerdown', x0);
      for (let i = 1; i <= 8; i++) ev('pointermove', x0 - i * 28);
      ev('pointerup', x0 - 8 * 28);
    });
    check(await hasta(async () => (await numSub()) === n - 1), 'en el móvil, deslizar a la izquierda la deja para mañana');
    await revisar('movil');
    await foto('197-movil');
    check(errores.length === 0, `en el móvil, cabe a 360 px en oscuro${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await movil.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4186);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Revisar, tercera tanda (v0.197)');
  try { await probarRevisar197({ navegador, check, base: 'http://localhost:4186', capturas: process.env.CAPTURAS || null }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).slice(0, 400)); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
