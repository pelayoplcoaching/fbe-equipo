// (v0.199) Atletas, segunda tanda: tus avisos, recordatorios, orden a mano, columnas nuevas (hoy toca, último contacto,
// próximo hito, progreso) con sus medias, lo nuevo desde tu última visita, filtros por rango, tablero, panel al lado,
// chat rápido, varios a la vez (mensaje con datos y preparar la semana que viene en borrador), exportar, reenviar el
// código y, en el móvil, los datos de las tarjetas y la nota de voz.
//   Suelta:  npm run build && node test/e2e-atletas-199.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarAtletas199({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
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
  async function entrar(ctx, antes = null) {
    p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    if (antes) await p.addInitScript(antes);
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
  const contador = (k) => p.locator(`.contador-panel[data-k="${k}"]`);
  const nContador = async (k) => Number((await contador(k).locator('.contador-n').textContent()) || 0);

  // (la visita anterior, hace tres días: así hay novedades)
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, acceptDownloads: true });
  try {
    await entrar(ctx, () => { try { if (!sessionStorage.getItem('fbe-e2e-199')) { localStorage.setItem('fbe-panel-visto', JSON.stringify(new Date(Date.now() - 3 * 864e5).toISOString())); sessionStorage.setItem('fbe-e2e-199', '1'); } } catch { /* */ } });
    check(await p.locator('.contadores-panel button').count() === 8, 'ocho contadores');
    check(await hasta(async () => (await p.locator('.punto-nuevo').count()) > 0 && (await nContador('novedades')) > 0), 'lo nuevo desde tu última visita: un punto en quien ha hecho algo');

    // Tus avisos
    const atencion = async () => Number(((await p.getByRole('button', { name: /^Necesitan atención/ }).textContent()) || '').match(/\d+/)?.[0] || 0);
    const a0 = await atencion();
    await p.getByRole('button', { name: 'Tus avisos' }).click();
    const hu = p.getByRole('dialog', { name: 'Tus avisos' });
    await hu.getByLabel('Desde cuántos días sin registrar series').fill('2');
    await hu.getByLabel('Que la falta de check-in cuente como atención').check();
    await hu.getByRole('button', { name: 'Guardar mis avisos' }).click();
    check(await hasta(async () => (await atencion()) >= a0), `tus avisos cambian quién necesita atención (${a0} → ${await atencion()})`);
    await p.getByRole('button', { name: 'Tus avisos' }).click();
    check((await hu.getByLabel('Desde cuántos días sin registrar series').inputValue()) === '2', 'y se guardan');
    await hu.getByRole('button', { name: 'Los de siempre' }).click();
    await hu.getByRole('button', { name: 'Guardar mis avisos' }).click();

    // Recordatorio para hoy
    const primero = (await nombres())[0];
    const corto = primero.split(' ')[0];
    await fila(primero).getByRole('button', { name: `Desplegar lo de ${corto}` }).click();
    const det = p.locator('.detalle-atleta').first();
    await det.getByLabel(`Qué recordarte de ${corto}`).fill('Mirar su rodilla');
    await det.getByRole('button', { name: 'Guardar recordatorio' }).click();
    check(await hasta(async () => (await fila(primero).locator('.recordatorio-chip').textContent().catch(() => '')) === 'Hoy: Mirar su rodilla'), 'un recordatorio para hoy, en su fila');
    check(await hasta(async () => (await nContador('paraHoy')) === 1), 'y su contador «Para hoy»');
    await fila(primero).getByRole('button', { name: `Plegar lo de ${corto}` }).click();
    await contador('paraHoy').click();
    check(await hasta(async () => (await filas().count()) === 1), 'el contador filtra');
    await contador('paraHoy').click();

    // Orden a mano
    await p.getByLabel('Ordenar la lista por').selectOption('mano');
    const antes = await nombres();
    await fila(antes[0]).getByRole('button', { name: `Bajar a ${antes[0].split(' ')[0]} en tu orden` }).click();
    check(await hasta(async () => (await nombres())[1] === antes[0] && (await nombres())[0] === antes[1]), 'tu orden a mano: bajar un puesto');
    await p.getByLabel('Ordenar la lista por').selectOption('urgencia');

    // Columnas nuevas y medias
    await p.getByRole('button', { name: 'Columnas' }).click();
    const hc = p.getByRole('dialog', { name: 'Columnas de la lista' });
    for (const c of ['Hoy toca', 'Último contacto', 'Próximo hito', 'Progreso', 'Recordatorio']) await hc.getByRole('checkbox', { name: c }).check();
    await cerrarHoja(hc);
    const ths = (await p.locator('thead th').allTextContents()).map((t) => t.trim());
    check(['Hoy toca', 'Último contacto', 'Próximo hito', 'Progreso', 'Recordatorio'].every((c) => ths.includes(c)), 'las columnas nuevas');
    check(await hasta(async () => (await p.locator('tbody td', { hasText: /\((tú|él o ella)\)|Nunca/ }).count()) > 0), 'el último contacto de cada uno');
    check(await hasta(async () => (await p.locator('.semaforo-panel').count()) > 0, 15000), 'el semáforo de progreso, al pedir su columna');
    check(await hasta(async () => /De los \d+/.test(await p.locator('tfoot').textContent().catch(() => ''))), 'las medias al pie de la tabla');

    // Filtros por rango
    await p.getByRole('button', { name: /^Filtros/ }).click();
    const hf = p.getByRole('dialog', { name: 'Filtrar la lista' });
    await hf.getByLabel('Más de cuántos días sin entrenar').fill('5');
    await hf.getByRole('button', { name: 'Ver la lista' }).click();
    check(await hasta(async () => /más de 5 días sin entrenar/.test(await p.locator('.filtros-activos').textContent().catch(() => ''))), 'filtrar por rango (más de 5 días sin entrenar)');
    await p.locator('.filtros-activos').getByRole('button', { name: 'Quitar los filtros' }).click();

    // Chat rápido
    const conChat = (await nombres()).find((n) => !/Marta/.test(n));
    const cc = conChat.split(' ')[0];
    await fila(conChat).getByRole('button', { name: `Chat con ${cc}` }).click();
    const hch = p.getByRole('dialog', { name: `Chat con ${cc}` });
    await hch.getByLabel(`Escribir a ${conChat}`).fill('Hola desde la lista');
    await hch.getByRole('button', { name: 'Enviar', exact: true }).click();
    check(await hasta(async () => (await hch.locator('.rev-ultimos').textContent().catch(() => '')).includes('Hola desde la lista')), 'el chat rápido, sin salir de la lista');
    await cerrarHoja(hch);

    // Varios a la vez: mensaje con datos y preparar la semana que viene
    await p.getByRole('button', { name: 'Elegir varios' }).click();
    const dos = (await nombres()).filter((n) => !/Marta|Lucía/.test(n)).slice(0, 2);
    for (const n of dos) await fila(n).locator('input.marcar-atleta').check();
    await p.getByRole('button', { name: 'Hacer algo con ellos' }).click();
    const hv = p.getByRole('dialog', { name: 'Con 2 atletas' });
    await hv.getByLabel(/^Mensaje \(se rellena/).fill('Vas por la semana {semana}');
    check(/Vas por la semana (\d+ de \d+|esta)/.test(await hv.locator('p.mini.terciario').first().textContent()), 'el mensaje se rellena con lo de cada uno');
    await hv.getByRole('button', { name: 'Semana que viene' }).click();
    await hv.getByRole('button', { name: /^Preparar la de los 2/ }).click();
    check(await hasta(async () => (await hv.locator('.resultado-preparar li').count()) === 2), `preparar la semana que viene de varios, en borrador (${(await hv.locator('.resultado-preparar').textContent().catch(() => '')).trim()})`);
    await cerrarHoja(hv);
    await p.getByRole('button', { name: 'Dejar de elegir' }).click().catch(() => {});

    // Exportar
    const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.getByRole('button', { name: 'Exportar' }).click()]);
    const ruta = await descarga.path();
    const csv = readFileSync(ruta, 'utf8');
    check(/^atletas-\d{4}-\d{2}-\d{2}\.csv$/.test(descarga.suggestedFilename()) && csv.includes('Atleta;Etiquetas') && csv.split('\n').length > 3, `exportar la lista en CSV (${descarga.suggestedFilename()})`);

    // Tablero
    await p.getByRole('button', { name: 'Tablero' }).click();
    check(await hasta(async () => (await p.locator('.tablero-columna').count()) > 0), 'el tablero, por la semana que viene');
    await p.locator('.tablero-tarjeta').filter({ hasNot: p.locator('text=Sin activar') }).first().click();
    check(await hasta(async () => (await p.getByRole('tab', { name: 'Programa', selected: true }).count()) === 1), 'desde el tablero, a su programa');
    await p.getByRole('button', { name: 'Volver a atletas' }).click();
    await p.getByRole('button', { name: 'Tablero' }).click();

    // Panel al lado
    await p.getByRole('button', { name: 'Panel al lado' }).click();
    check(await hasta(async () => (await p.locator('aside.aside-atleta').count()) === 1), 'el panel de al lado');
    const otra = p.locator('.lista-lateral .tarjeta-atleta').nth(1);
    const suNombre = (await otra.locator('strong').textContent()).trim();
    await otra.click();
    check(await hasta(async () => (await p.locator('aside.aside-atleta .aside-cab strong').textContent()) === suNombre), `tocar a otro lo enseña al lado (${suNombre})`);
    await revisar('lateral');
    await p.getByRole('button', { name: 'Panel al lado' }).click();

    // Reenviar el código
    await p.getByRole('button', { name: /^Sin activar/ }).click();
    const inv = (await nombres())[0];
    await fila(inv).getByRole('button', { name: `Reenviar el código a ${inv.split(' ')[0]}` }).click();
    check(await hasta(async () => (await p.getByRole('dialog', { name: `Invitación para ${inv.split(' ')[0]}` }).count()) === 1), 'reenviar el código desde «Sin activar»');
    await cerrarDialogos();
    await p.getByRole('button', { name: 'Todos', exact: true }).click();
    await revisar('ancho');
    await foto('199-ancho');
    check(errores.length === 0, `sin errores ni problemas de accesibilidad en el ordenador${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }

  // En el móvil: los datos de las tarjetas y la nota de voz
  errores.length = 0;
  const movil = await navegador.newContext({ viewport: { width: 360, height: 740 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce', bypassCSP: true });
  try {
    await entrar(movil);
    await p.getByRole('button', { name: 'Más de la lista' }).click();
    await p.getByRole('button', { name: 'Datos de las tarjetas' }).click();
    const ht = p.getByRole('dialog', { name: 'Datos de las tarjetas' });
    await ht.getByRole('checkbox', { name: /^Último registro/ }).uncheck();
    await ht.getByRole('checkbox', { name: /^Último contacto/ }).check();
    await cerrarHoja(ht);
    check(await hasta(async () => (await p.locator('.tarjeta-atleta .datos .k', { hasText: 'Último contacto' }).count()) > 0 && (await p.locator('.tarjeta-atleta .datos .k', { hasText: 'Último registro' }).count()) === 0), 'elegir los datos de las tarjetas');
    const t = p.locator('.tarjeta-atleta-env').first();
    const corto = (await t.locator('.tarjeta-atleta strong').textContent()).split(' ')[0];
    await t.getByRole('button', { name: `Nota de voz a ${corto}` }).click();
    check(await hasta(async () => (await p.getByRole('dialog', { name: `Nota de voz para ${corto}` }).count()) === 1), 'la nota de voz desde su tarjeta');
    await cerrarDialogos();
    await revisar('movil');
    await foto('199-movil');
    check(errores.length === 0, `en el móvil, cabe a 360 px en oscuro${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await movil.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4188);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Atletas, segunda tanda (v0.199)');
  try { await probarAtletas199({ navegador, check, base: 'http://localhost:4188', capturas: process.env.CAPTURAS || null }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 3).join(' ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
