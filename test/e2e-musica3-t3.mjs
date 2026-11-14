// Música 3, tanda 3 (con el equipo, migración 072), en la demo y en un móvil simulado, con Spotify simulado:
//   · el coach pone el tema del reto musical del mes (Cuenta › Música)
//   · en Equipo: el reto (proponer y votar la de otro, no la suya) y «Lo que suena en el equipo» (compartir la suya)
//   · la lista de una pareja de compañeros de racha: la pone uno y la ve el otro
//   Suelta:  npm run build && node test/e2e-musica3-t3.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarMusica3Equipo } = await import('./e2e-musica3-t3.mjs'); await probarMusica3Equipo({ navegador, check });
import { pathToFileURL } from 'node:url';
import { simularSpotify } from './e2e-musica3-t1.mjs';

export async function probarMusica3Equipo({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  await simularSpotify(ctx);
  const { irASeccion } = await import('./secciones.mjs');
  const { VERSION_COMUNIDAD } = await import('../web/src/datos/api.js');
  const { VERSION_NORMAS } = await import('../web/src/datos/normas-comunidad.js');
  const fuera = async (q) => {
    for (let i = 0; i < 5; i++) {
      await q.waitForTimeout(350);
      const d = q.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await q.keyboard.press('Escape');
    }
  };
  const entrar = async (nombre) => {
    const q = await ctx.newPage();
    q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(`${base}/?demo`);
    const b = q.locator('button.persona', { hasText: nombre }).first();
    await Promise.race([b.waitFor({ timeout: 8000 }), q.locator('nav.tabs').waitFor({ timeout: 8000 })]).catch(() => {});
    for (let i = 0; i < 5 && !(await b.isVisible().catch(() => false)); i++) {
      await fuera(q);
      await q.getByRole('button', { name: 'Cambiar de cuenta' }).first().click({ timeout: 4000 }).catch(() => {});
      await q.waitForTimeout(500);
    }
    await b.click();
    await q.locator('nav.tabs').waitFor();
    await fuera(q);
    return q;
  };
  const unirse = async (q, nombre) => { await q.evaluate(([n, v, w]) => globalThis.__fbeDemo.rpc('comunidad_unirme', { p_nombre: n, p_version: v, p_normas: w }), [nombre, VERSION_COMUNIDAD, VERSION_NORMAS]).catch(() => {}); await q.waitForTimeout(400); };
  const T = 'https://open.spotify.com/track/2HHtWyy5CgaQbC7XSoOb0e', T2 = 'https://open.spotify.com/track/3HHtWyy5CgaQbC7XSoOb0f';
  const L = 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP';
  try {
    // --- el coach pone el reto ---
    const c = await entrar('Pelayo');
    await irASeccion(c, 'Cuenta');
    const rc = c.locator('.reto-musical-coach');
    await rc.waitFor({ timeout: 8000 });
    await rc.scrollIntoViewIfNeeded();
    check(/Este mes no hay reto/.test(await rc.textContent()), 'en Cuenta › Música, el reto musical del mes (sin reto todavía)');
    await rc.getByLabel('Tema del reto').fill('Los 80');
    await rc.getByRole('button', { name: 'Poner el reto' }).click();
    await rc.locator('text=«Los 80»').waitFor({ timeout: 5000 });
    check(true, 'el coach pone el tema: «Los 80»');
    check(await c.locator('.musica-coach button[data-m="fase"]').count() === 2 && await c.locator('.musica-coach button[data-m="test"]').count() === 1 && await c.locator('.musica-coach button[data-m="podcast"]').count() === 1, 'y las listas por momento: calentar, vuelta a la calma, días de test y su pódcast');
    await c.waitForTimeout(400); await c.close();  // (la demo guarda a los 150 ms)
    // --- Rubén entra en la comunidad y propone ---
    const r = await entrar('Rubén');
    await unirse(r, 'Rubén M.');
    await r.evaluate((u) => globalThis.__fbeDemo.rpc('comunidad_reto_cancion', { p_url: u }), T2);
    const deRuben = await r.evaluate(() => globalThis.__fbeDemo.rpc('comunidad_reto_musical', {}));
    const rubenId = deRuben?.canciones?.find((x) => x.yo)?.perfil_id;
    check(!!rubenId && deRuben.tema === 'Los 80', 'otro del equipo propone una canción');
    await r.waitForTimeout(400); await r.close();  // (la demo guarda a los 150 ms)
    // --- Ana: el reto y lo que suena ---
    const a = await entrar('Ana López');
    await unirse(a, 'Ana L.');
    await a.reload(); await a.locator('nav.tabs').waitFor(); await fuera(a);
    await irASeccion(a, 'Equipo');
    await fuera(a);
    const reto = a.locator('section.reto-musical');
    await reto.waitFor({ timeout: 8000 });
    check(/Los 80/.test(await reto.textContent()) && await reto.locator('.cancion-fila').count() === 1, 'en Equipo, el reto del mes con la propuesta de Rubén');
    await reto.getByRole('button', { name: /Votar la canción de/ }).click();
    await reto.getByRole('button', { name: /Quitar tu voto a la canción de Rubén/ }).waitFor({ timeout: 5000 });
    check(/1 voto/.test(await reto.textContent()), 'Ana la vota (un voto)');
    await reto.getByRole('button', { name: 'Proponer una canción' }).click();
    const hp = a.getByRole('dialog', { name: 'Tu propuesta' });
    await hp.getByLabel('Enlace').fill(T);
    await hp.getByRole('button', { name: 'Guardar' }).click();
    await hp.waitFor({ state: 'detached' });
    await reto.locator('.cancion-fila').nth(1).waitFor({ timeout: 5000 });
    const filas = await reto.locator('.cancion-fila').allTextContents();
    check(filas.length === 2 && filas.some((t) => /^.*Tú · 0 votos/.test(t)) && await reto.getByRole('button', { name: /Votar la canción de Ana/ }).count() === 0, 'propone la suya, que no puede votarse a sí misma');
    const suena = a.locator('section.lo-que-suena');
    await suena.waitFor({ timeout: 8000 });
    await suena.getByRole('button', { name: /Compartir la mía/ }).click();
    const hs = a.getByRole('dialog', { name: 'Tu canción para el equipo' });
    await hs.getByLabel('Enlace').fill(T);
    await hs.getByRole('button', { name: 'Guardar' }).click();
    await hs.waitFor({ state: 'detached' });
    await suena.locator('.cancion-fila').first().waitFor({ timeout: 5000 });
    await suena.locator('.cancion-fila', { hasText: 'Eye of the Tiger' }).waitFor({ timeout: 5000 }).catch(() => {});
    check(/Eye of the Tiger/.test(await suena.textContent()) && /Tú/.test(await suena.textContent()), `«Lo que suena en el equipo»: comparte la suya (con el nombre de su ficha) («${(await suena.locator('.cancion-fila').first().textContent()).trim().slice(0, 50)}»)`);
    // --- la lista de la pareja ---
    await a.evaluate((id) => globalThis.__fbeDemo.rpc('comunidad_invitar_companero', { p_perfil: id }), rubenId).catch((e) => errores.push(`invitar: ${e.message}`));
    await a.waitForTimeout(400); await a.close();  // (la demo guarda a los 150 ms)
    const r2 = await entrar('Rubén');
    const pend = await r2.evaluate(() => globalThis.__fbeDemo.rpc('comunidad_companeros', {}));
    const inv = (pend || []).find((x) => x.estado === 'pendiente');
    if (inv) await r2.evaluate((id) => globalThis.__fbeDemo.rpc('comunidad_responder_companero', { p_id: id, p_aceptar: true }), inv.id);
    await r2.waitForTimeout(400); await r2.close();  // (la demo guarda a los 150 ms)
    const a2 = await entrar('Ana López');
    await a2.evaluate(() => localStorage.setItem('fbe-equipo-abierta-companeros', 'true'));
    await irASeccion(a2, 'Equipo');
    await fuera(a2);
    const pleg = a2.locator('details[data-plegable-eq="companeros"]');
    if (await pleg.count() && !(await pleg.evaluate((d) => d.open))) await pleg.locator('summary').click();
    const poner = a2.locator('section.companeros').getByRole('button', { name: /Poner vuestra lista/ });
    await poner.waitFor({ timeout: 8000 });
    await poner.click();
    const hl = a2.getByRole('dialog', { name: /Vuestra lista/ });
    await hl.getByLabel('Enlace a la lista').fill(L);
    await hl.getByRole('button', { name: 'Guardar' }).click();
    await hl.waitFor({ state: 'detached' });
    await a2.locator('section.companeros .cp-lista-musica a').waitFor({ timeout: 5000 });
    check(true, 'en sus compañeros de racha, pone la lista de la pareja');
    check(await a2.evaluate(() => document.documentElement.scrollWidth <= 390), 'nada se sale a 390 px');
    await a2.waitForTimeout(400); await a2.close();  // (la demo guarda a los 150 ms)
    const r3 = await entrar('Rubén');
    const ls = await r3.evaluate(() => globalThis.__fbeDemo.rpc('comunidad_listas_companeros', {}));
    check(Array.isArray(ls) && ls.some((x) => x.url === L && x.otro === 'Ana L.') && ls.filter((x) => x.url).length === 1, `su compañero la ve (y le sale en la portada) (${JSON.stringify(ls).slice(0, 120)})`);
    await r3.waitForTimeout(400); await r3.close();  // (la demo guarda a los 150 ms)
  } catch (e) {
    check(false, `la tanda 3 de música no se ha podido recorrer: ${e.message.split('\n')[0]}`);
  }
  check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nMúsica 3, tanda 3: con el equipo');
  try { await probarMusica3Equipo({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
