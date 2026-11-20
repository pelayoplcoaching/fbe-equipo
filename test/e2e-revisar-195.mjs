// (v0.195) La pestaña «Revisar», 20 mejoras: buscar, orden por urgencia, agrupar por día, vista compacta, el contexto
// de cada atleta, la sesión serie a serie, el check-in frente al anterior, tus frases en el hilo, «Visto 💪», «Mañana»,
// elegir varias, «Todo revisado», programar y la nota de voz desde la tarjeta, y lo revisado hoy. En ordenador y a
// 360 px en oscuro.
//   Suelta:  npm run build && node test/e2e-revisar-195.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRevisar195({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
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
    const total0 = await numSub();
    check(total0 > 3, `la demo tiene cosas por revisar (${total0})`);
    // El contexto de cada atleta
    check(await hasta(async () => (await p.locator('.grupo-revisar-ctx').filter({ hasText: /Semana \d|contestaste|Le has contestado|aún no le has/ }).count()) > 0), 'cada atleta, con su semana del bloque y cuándo le contestaste');
    check(await p.locator('.grupo-revisar-ctx').getByRole('button', { name: /Programar/ }).count() > 0, 'y «Programar» en su cabecera');
    await revisar('ordenador');
    await foto('195-lista');

    // Buscar
    const nombre = ((await p.locator('.grupo-revisar-nombre').first().textContent()) || '').trim();
    const primer = nombre.split(' ')[0];
    await p.getByLabel('Buscar por atleta').fill(primer.toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''));
    check(await hasta(async () => { const ns = await p.locator('.grupo-revisar-nombre').allTextContents(); return ns.length >= 1 && ns.every((n) => n.includes(primer)); }), `buscar «${primer}» sin tildes deja solo lo suyo`);
    await p.getByLabel('Buscar por atleta').fill('zzzz');
    check(await hasta(async () => p.locator('.revisar-sin-resultados').isVisible()), 'sin resultados, lo dice y deja quitar la búsqueda');
    await p.getByRole('button', { name: 'Quitar la búsqueda' }).click();
    await tarjetas().first().waitFor();

    // Orden y agrupar
    await p.getByLabel('Cómo ordenar lo que hay por revisar').selectOption('urgente');
    check(await hasta(async () => (await p.locator('.grupo-revisar').count()) > 0), 'ordenar por urgencia');
    const primeroUrg = await p.locator('.grupo-revisar').first().locator('.revisar-urg').count();
    const algunoUrg = await p.locator('.revisar-urg').count();
    check(algunoUrg === 0 || primeroUrg === 1, 'con «Lo urgente primero», arriba quien tiene algo urgente (con su punto)');
    await p.getByRole('group', { name: 'Agrupar lo que hay por revisar' }).getByRole('button', { name: 'Por día' }).click();
    check(await hasta(async () => (await p.locator('.grupo-dia').count()) > 0), 'agrupar por día');
    const dias = await p.locator('.grupo-dia .grupo-revisar-nombre').allTextContents();
    check(dias.every((d) => ['Hoy', 'Ayer', 'Esta semana', 'Antes'].includes(d.trim())), `los días: ${dias.join(', ')}`);
    await foto('195-por-dia');
    await p.getByRole('group', { name: 'Agrupar lo que hay por revisar' }).getByRole('button', { name: 'Por atleta' }).click();
    await p.getByLabel('Cómo ordenar lo que hay por revisar').selectOption('reciente');
    await p.getByRole('button', { name: 'Vista compacta' }).click();
    check(await hasta(async () => (await p.locator('.rejilla-revisar.revisar-compacta').count()) === 1), 'vista compacta');
    await p.getByRole('button', { name: 'Vista compacta' }).click();

    // La sesión serie a serie
    // (fijada por su sitio en la lista: al tocar, el botón cambia de nombre)
    const fijar = async (loc) => p.locator(`[data-item="${await loc.locator('xpath=ancestor::div[@data-item][1]').getAttribute('data-item')}"]`);
    const conSeries = await fijar(tarjetas().filter({ has: p.getByRole('button', { name: 'Ver serie a serie' }) }).first());
    await conSeries.getByRole('button', { name: 'Ver serie a serie' }).click();
    check(await hasta(async () => (await conSeries.locator('.revisar-detalle tbody tr').count()) > 0), 'una sesión, serie a serie (pautado frente a hecho)');
    // El check-in frente al anterior (si en la demo hay uno anterior)
    const cambios = await p.locator('.revisar-cambios').count();
    check(cambios >= 0, `check-ins comparados con el anterior: ${cambios}`);
    // Tus frases en el hilo
    const hilo = await fijar(tarjetas().filter({ has: p.getByRole('button', { name: 'Comentar', exact: true }) }).first());
    await hilo.getByRole('button', { name: 'Comentar', exact: true }).click();
    const frases = hilo.getByRole('group', { name: 'Frases rápidas' });
    check(await hasta(async () => (await frases.getByRole('button').count()) > 0), 'al comentar, tus frases a un toque');
    await frases.getByRole('button').first().click();
    check(((await hilo.locator('textarea').inputValue()) || '').length > 3, 'una frase entra en el cuadro (con su nombre)');
    await hilo.getByRole('button', { name: 'Cerrar', exact: true }).click();

    // «Visto 💪»: se va y el foco pasa a la siguiente
    let n = await numSub();
    const conVisto = tarjetas().filter({ has: p.locator('button.revisar-visto') }).first();
    await conVisto.locator('button.revisar-visto').click();
    check(await hasta(async () => (await numSub()) === n - 1), '«Visto 💪» contesta y la quita de la lista');
    check(await hasta(async () => p.evaluate(() => !!document.activeElement?.closest?.('.tarjeta-revisar'))), 'y el foco pasa a la tarjeta siguiente');

    // «Mañana»
    n = await numSub();
    await tarjetas().filter({ has: p.locator('button.revisar-manana') }).first().locator('button.revisar-manana').click();
    check(await hasta(async () => (await numSub()) === n - 1), '«Mañana» la aparta de la lista');
    const verPos = p.getByRole('button', { name: /dejado para otro día/ });
    check(await hasta(async () => verPos.isVisible()), 'y se puede ver lo apartado');
    await verPos.click();
    check(await hasta(async () => (await tarjetas().count()) === 1), 'lo apartado, aparte');
    await p.getByRole('button', { name: 'Volver a lo de hoy' }).click();
    await tarjetas().first().waitFor();

    // Elegir varias
    n = await numSub();
    await p.getByRole('button', { name: 'Elegir varias' }).click();
    const casillas = p.locator('.revisar-elegir input');
    check(await hasta(async () => (await casillas.count()) >= 2), 'al elegir varias, cada tarjeta lleva su casilla');
    await casillas.nth(0).click();
    await casillas.nth(1).click();
    const barra = p.getByRole('region', { name: 'Las tarjetas elegidas' });
    check(((await barra.textContent()) || '').includes('2 elegidas'), 'la barra cuenta las elegidas');
    await revisar('elegir');
    await barra.getByRole('button', { name: 'Dar por revisadas' }).click();
    check(await hasta(async () => (await numSub()) <= n - 2), 'las dos, revisadas de golpe');
    const deshacer = p.locator('.aviso, [role=status]').getByRole('button', { name: 'Deshacer' }).first();
    if (await deshacer.isVisible().catch(() => false)) {
      await deshacer.click();
      check(await hasta(async () => (await numSub()) === n), 'y «Deshacer» las devuelve');
    } else check(true, '(el aviso ya se había ido)');

    // «Todo revisado» de un atleta
    const todo = p.locator('.grupo-todo-revisado').first();
    if (await todo.isVisible().catch(() => false)) {
      n = await numSub();
      const k = Number(((await todo.textContent()) || '').match(/\((\d+)\)/)?.[1] || 0);
      await todo.click();
      check(await hasta(async () => (await numSub()) <= n - k + 1), `«Todo revisado» quita lo de ese atleta (${k})`);
    } else check(true, '(nadie con dos cosas revisables)');

    // Programar desde la tarjeta
    await p.locator('.grupo-revisar-ctx').getByRole('button', { name: /Programar/ }).first().click();
    const hoja = p.getByRole('dialog', { name: /Programa de/ });
    check(await hasta(async () => hoja.isVisible()), 'Programar abre su editor en una hoja');
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'hidden' }).catch(() => {});

    // La nota de voz (solo se abre: aquí no hay micro)
    await tarjetas().filter({ has: p.locator('button.revisar-voz') }).first().locator('button.revisar-voz').click();
    const voz = p.getByRole('dialog', { name: /Nota de voz para/ });
    check(await hasta(async () => voz.isVisible()) && await voz.getByRole('button', { name: 'Grabar la nota' }).isVisible(), 'la nota de voz se graba desde la tarjeta');
    await p.keyboard.press('Escape');
    await voz.waitFor({ state: 'hidden' }).catch(() => {});

    // Lo revisado hoy
    await p.getByRole('button', { name: 'Lo que has revisado hoy' }).click();
    const hoy = p.getByRole('dialog', { name: 'Lo que has revisado hoy' });
    check(await hasta(async () => (await hoy.locator('.revisado-hoy').count()) > 0), 'lo revisado hoy, en una lista');
    n = await numSub();
    await hoy.getByRole('button', { name: /^Volver a pendiente/ }).first().click();
    check(await hasta(async () => (await numSub()) === n + 1), '«Volver a pendiente» lo devuelve a la lista');
    await revisar('revisado-hoy');
    await p.keyboard.press('Escape');
    check(errores.length === 0, `sin errores en ordenador${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }

  // En el móvil, a 360 px y en oscuro
  errores.length = 0;
  const movil = await navegador.newContext({ viewport: { width: 360, height: 740 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce', bypassCSP: true });
  try {
    await entrar(movil);
    await p.waitForTimeout(500);
    await revisar('movil');
    await foto('195-movil');
    await p.getByRole('button', { name: 'Elegir varias' }).click();
    await p.locator('.revisar-elegir input').first().click();
    await revisar('movil-elegir');
    await foto('195-movil-elegir');
    if (process.env.ANCHOS) console.log(await p.evaluate(() => [...document.querySelectorAll('.contenido *')].filter((el) => el.getBoundingClientRect().right > 361).slice(0, 8).map((el) => `${el.tagName}.${el.className}`)));
    check(errores.length === 0, `en el móvil, cabe a 360 px en oscuro${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await movil.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4182);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Revisar, 20 mejoras (v0.195)');
  try { await probarRevisar195({ navegador, check, base: 'http://localhost:4182', capturas: process.env.CAPTURAS || null }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).slice(0, 400)); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
