// (v0.198) La lista de Atletas a tu gusto: buscar, ordenar por columna, elegir columnas, desplegar, fijar, etiquetas,
// nota, contadores y filtros, vistas guardadas, agrupar, vista compacta, varios a la vez, teclas, el anterior y el
// siguiente desde la ficha, volver como la dejaste y, en el móvil, los atajos de cada tarjeta.
//   Suelta:  npm run build && node test/e2e-atletas-198.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarAtletas198({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
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
    await p.locator('[data-atleta]').first().waitFor();
  }
  const cerrarHoja = async (h) => { await p.keyboard.press('Escape'); await h.waitFor({ state: 'hidden' }).catch(() => {}); };
  const filas = () => p.locator('tr[data-atleta]');
  const nombres = async () => filas().locator('.nombre-linea').evaluateAll((xs) => xs.map((x) => x.firstChild.textContent.trim()));
  const fila = (nombre) => filas().filter({ hasText: nombre }).first();

  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true });
  try {
    await entrar(ctx);
    const total = await filas().count();
    check(total >= 5 && await p.locator('.contadores-panel button').count() === 5, `la lista con sus herramientas y los cinco contadores (${total} atletas)`);

    // Buscar
    const buscar = p.getByLabel('Buscar atletas');
    await buscar.fill('ANA lopez');
    check(await hasta(async () => (await filas().count()) === 1 && (await nombres())[0].startsWith('Ana')), 'buscar en la propia lista (sin tildes ni mayúsculas)');
    await buscar.fill('zzzz');
    check(await hasta(async () => (await p.getByText('Nadie coincide con «zzzz».').count()) === 1), 'sin nadie, lo dice');
    await buscar.press('Escape');
    check(await hasta(async () => (await filas().count()) === total), 'Escape vacía el buscador');

    // Ordenar por una columna
    await p.locator('thead').getByRole('button', { name: 'Atleta' }).click();
    const az = await nombres();
    check(await hasta(async () => (await p.locator('thead th[aria-sort="ascending"]').count()) === 1) && JSON.stringify(az) === JSON.stringify([...az].sort((a, b) => a.localeCompare(b, 'es'))), `ordenar tocando el título (${az.join(', ')})`);
    await p.locator('thead').getByRole('button', { name: 'Atleta' }).click();
    check(await hasta(async () => (await p.locator('thead th[aria-sort="descending"]').count()) === 1 && (await nombres())[0] === az.at(-1)), 'y otra vez, al revés');
    await p.getByLabel('Ordenar la lista por').selectOption('urgencia');

    // Columnas
    await p.getByRole('button', { name: 'Columnas' }).click();
    const hc = p.getByRole('dialog', { name: 'Columnas de la lista' });
    await hc.getByRole('checkbox', { name: 'Tu nota' }).check();
    await hc.getByRole('checkbox', { name: 'Semana que viene' }).check();
    await hc.getByRole('button', { name: 'Subir Semana que viene' }).click();
    await cerrarHoja(hc);
    const ths = (await p.locator('thead th').allTextContents()).map((t) => t.trim());
    check(ths.includes('Tu nota') && ths.indexOf('Semana que viene') === ths.indexOf('Tu nota') - 1, `elegir y ordenar columnas (${ths.join(', ')})`);
    check(await hasta(async () => (await p.locator('tbody .chip', { hasText: /Publicada|En borrador|Sin programar|Sin bloque/ }).count()) > 0), 'la semana que viene de cada uno');

    // Desplegar, fijar, etiqueta y nota
    const primeroAntes = (await nombres())[0];
    const elegido = (await nombres()).find((n) => n !== primeroAntes && !/Marta/.test(n));
    const corto = elegido.split(' ')[0];
    await fila(elegido).getByRole('button', { name: `Desplegar lo de ${corto}` }).click();
    const det = p.locator(`.detalle-atleta`).first();
    await det.waitFor();
    check(/Último check-in/.test(await det.textContent()) && await det.getByRole('button', { name: 'Chat', exact: true }).count() === 1, 'desplegar: lo suyo de un vistazo y sus atajos');
    await det.getByRole('button', { name: 'Fijar arriba' }).click();
    check(await hasta(async () => (await nombres())[0] === elegido), `fijado: ${corto} sube arriba`);
    await det.getByLabel('Etiqueta nueva').fill('Preboda');
    await det.getByRole('button', { name: 'Poner' }).click();
    check(await hasta(async () => (await fila(elegido).locator('.etq').allTextContents()).includes('Preboda')), 'una etiqueta, a la vista en su fila');
    await det.getByLabel('Tu nota').fill('Revisar rodilla');
    await det.getByRole('button', { name: 'Guardar nota' }).click();
    check(await hasta(async () => (await fila(elegido).locator('.nota-linea').textContent().catch(() => '')) === 'Revisar rodilla'), 'tu nota, en su fila');
    check(await hasta(async () => (await fila(elegido).locator('td.celda-nota').textContent().catch(() => '')) === 'Revisar rodilla'), 'y en su columna');
    await revisar('desplegado');
    await foto('198-desplegado');
    await fila(elegido).getByRole('button', { name: `Plegar lo de ${corto}` }).click();

    // Buscar por la nota o la etiqueta
    await buscar.fill('rodilla');
    check(await hasta(async () => (await filas().count()) === 1), 'buscar también en tu nota');
    await buscar.fill('');

    // Contadores y filtros
    const molestias = p.locator('.contador-panel[data-k="molestias"]');
    if (await molestias.isEnabled()) {
      const n = Number(await molestias.locator('.contador-n').textContent());
      await molestias.click();
      check(await hasta(async () => (await filas().count()) === n) && (await molestias.getAttribute('aria-pressed')) === 'true', `un contador filtra al tocarlo (${n} con molestias)`);
      await molestias.click();
    } else check(true, '(nadie con molestias)');
    await p.getByRole('button', { name: /^Filtros/ }).click();
    const hf = p.getByRole('dialog', { name: 'Filtrar la lista' });
    await hf.getByLabel('Etiqueta').selectOption('Preboda');
    await hf.getByRole('button', { name: 'Ver la lista' }).click();
    check(await hasta(async () => (await filas().count()) === 1 && /«Preboda»/.test(await p.locator('.filtros-activos').textContent())), 'filtrar por tu etiqueta, con el resumen a la vista');

    // Vistas guardadas
    await p.getByRole('button', { name: 'Tus vistas' }).click();
    const hv = p.getByRole('dialog', { name: 'Tus vistas' });
    await hv.getByLabel('Nombre de la vista').fill('Preboda');
    await hv.getByRole('button', { name: 'Guardar esta vista' }).click();
    await cerrarHoja(hv);
    await p.locator('.filtros-activos').getByRole('button', { name: 'Quitar los filtros' }).click();
    check(await hasta(async () => (await filas().count()) === total), 'quitar los filtros');
    await p.getByRole('group', { name: 'Tus vistas guardadas' }).getByRole('button', { name: 'Preboda' }).click();
    check(await hasta(async () => (await filas().count()) === 1), 'una vista guardada vuelve con un toque');
    await p.locator('.filtros-activos').getByRole('button', { name: 'Quitar los filtros' }).click();

    // Agrupar y vista compacta
    await p.getByLabel('Agrupar la lista').selectOption('etiqueta');
    check(await hasta(async () => (await p.locator('tr.fila-grupo').allTextContents()).some((t) => /Preboda/.test(t))), 'agrupar por etiqueta');
    await p.getByLabel('Agrupar la lista').selectOption('');
    await p.getByRole('button', { name: 'Vista compacta' }).click();
    check(await hasta(async () => (await p.locator('.panel-atletas.compacta').count()) === 1), 'la vista compacta');
    await p.getByRole('button', { name: 'Vista compacta' }).click();

    // Varios a la vez: una etiqueta a dos
    await p.getByRole('button', { name: 'Elegir varios' }).click();
    const dos = (await nombres()).slice(0, 2);
    for (const n of dos) await fila(n).locator('input.elegir-atleta').check();
    await p.getByRole('button', { name: 'Mensaje o etiqueta' }).click();
    const hva = p.getByRole('dialog', { name: 'Con 2 atletas' });
    await hva.getByRole('button', { name: 'Etiqueta', exact: true }).click();
    await hva.getByLabel('Etiqueta').fill('Revisión domingo');
    await hva.getByRole('button', { name: 'Ponérsela' }).click();
    check(await hasta(async () => (await Promise.all(dos.map(async (n) => (await fila(n).locator('.etq').allTextContents()).includes('Revisión domingo')))).every(Boolean)), 'una etiqueta a varios a la vez');
    check(await hasta(async () => (await p.locator('input.elegir-atleta').count()) === 0), 'y se deja de elegir');

    // Teclas
    await filas().first().focus();
    await p.keyboard.press('j');
    check(await hasta(async () => p.evaluate(() => document.activeElement?.matches?.('tr[data-atleta]') && document.activeElement === document.querySelectorAll('tr[data-atleta]')[1])), 'j baja por la lista');
    await p.keyboard.press('?');
    const ht = p.getByRole('dialog', { name: 'Teclas de la lista' });
    check(await hasta(async () => ht.isVisible()), '? enseña las teclas');
    await cerrarHoja(ht);

    // Anterior y siguiente desde la ficha; al volver, la lista sigue como estaba
    await buscar.fill('');
    await p.getByLabel('Ordenar la lista por').selectOption('nombre');
    const orden = await nombres();
    await fila(orden[0]).click();
    await p.getByRole('button', { name: 'Volver a atletas' }).waitFor();
    const prox = p.getByRole('button', { name: /^Próximo atleta de tu lista/ });
    await prox.waitFor();
    check((await p.locator('.vecinos-ficha').textContent()).includes(`1/${orden.length}`), 'en la ficha, su puesto en tu lista');
    await prox.click();
    check(await hasta(async () => (await p.locator('h1').first().textContent()) === orden[1]), `el siguiente de tu lista (${orden[1]})`);
    await p.getByRole('button', { name: /^Atleta anterior de tu lista/ }).click();
    check(await hasta(async () => (await p.locator('h1').first().textContent()) === orden[0]), 'y el anterior');
    await p.getByRole('button', { name: 'Volver a atletas' }).click();
    await filas().first().waitFor();
    await buscar.fill('lo');
    const conLo = await filas().count();
    await filas().first().click();
    await p.getByRole('button', { name: 'Volver a atletas' }).click();
    await filas().first().waitFor();
    check(await hasta(async () => (await buscar.inputValue()) === 'lo' && (await filas().count()) === conLo), 'al volver de una ficha, la lista sigue como la dejaste');
    await buscar.fill('');

    // Se queda guardado (en la demo, como con la 085)
    await p.reload();
    await p.locator('[data-atleta]').first().waitFor();
    check(await hasta(async () => (await nombres())[0] === elegido && (await fila(elegido).locator('.etq').allTextContents()).includes('Preboda')), 'al volver a entrar, lo fijado, las etiquetas y la nota siguen ahí');
    await revisar('ancho');
    await foto('198-ancho');
    check(errores.length === 0, `sin errores ni problemas de accesibilidad en el ordenador${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }

  // En el móvil: los atajos de cada tarjeta, desplegar y sin desbordes a 360 px en oscuro
  errores.length = 0;
  const movil = await navegador.newContext({ viewport: { width: 360, height: 740 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce', bypassCSP: true });
  try {
    await entrar(movil);
    const t = p.locator('.tarjeta-atleta-env').first();
    const corto = (await t.locator('.tarjeta-atleta strong').textContent()).split(' ')[0];
    check(await t.getByRole('button', { name: `Chat con ${corto}` }).count() === 1, 'cada tarjeta, con sus atajos debajo');
    await t.getByRole('button', { name: `Desplegar lo de ${corto}` }).click();
    check(await hasta(async () => (await t.locator('.detalle-atleta').count()) === 1), 'y se despliega en el móvil');
    await t.getByRole('button', { name: `Chat con ${corto}` }).click();
    check(await hasta(async () => (await p.getByRole('tab', { name: 'Mensajes', selected: true }).count()) === 1), 'el atajo del chat abre su ficha en Mensajes');
    await p.getByRole('button', { name: 'Volver a atletas' }).click();
    await p.locator('.tarjeta-atleta').first().waitFor();
    await revisar('movil');
    await foto('198-movil');
    check(errores.length === 0, `en el móvil, cabe a 360 px en oscuro${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await movil.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4187);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Atletas a tu gusto (v0.198)');
  try { await probarAtletas198({ navegador, check, base: 'http://localhost:4187', capturas: process.env.CAPTURAS || null }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 3).join(' ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
