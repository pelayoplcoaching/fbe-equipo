// «La travesía», tanda 3, en la demo y en un móvil simulado: «Tu travesía» (el mapa, las postales, la clasificación de
// la manada con su duelo y lo del equipo, los lobos y las constelaciones), y en el juego, el lobo elegido, los que le
// siguen, quién más ha corrido hoy y la postal al llegar a un sitio.
//   Suelta:  npm run build && node test/e2e-travesia3.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarTravesia3 } = await import('./e2e-travesia3.mjs'); await probarTravesia3({ navegador, check });
import { pathToFileURL } from 'node:url';
import { VERSION_COMUNIDAD } from '../web/src/datos/api.js';
import { VERSION_NORMAS } from '../web/src/datos/normas-comunidad.js';
import { lunesDe, sumarDias, fechaMadrid } from '../web/src/logica/fechas.js';

export async function probarTravesia3({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const trozos = [];
  p.on('request', (r) => { if (/\/chunks\/TravesiaHoja-/.test(r.url())) trozos.push(r.url()); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const guardado = () => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^fbe-travesia-[0-9a-f]{8}-/.test(x)); return k ? JSON.parse(localStorage.getItem(k)) : null; });
  // (cuántos píxeles del lienzo tienen justo ese color, en una franja de x: el cuerpo del lobo es de un color plano)
  const pixeles = ([r, g, b], desde, hasta) => p.evaluate(([r, g, b, desde, hasta]) => {
    const c = document.querySelector('.travesia-lienzo'); const x = c.getContext('2d');
    const x0 = Math.round(c.width * desde), w = Math.max(1, Math.round(c.width * (hasta - desde)));
    const y0 = Math.round(c.height * 0.5), d = x.getImageData(x0, y0, w, Math.round(c.height * 0.2)).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r) < 3 && Math.abs(d[i + 1] - g) < 3 && Math.abs(d[i + 2] - b) < 3) n++;
    return n;
  }, [r, g, b, desde, hasta]);

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();
    // Ana entra en la comunidad y lleva casi 12 km (a un paso de Pola de Lena), tres semanas seguidas y cinco retos
    await p.evaluate(([v, n]) => globalThis.__fbeDemo.rpc('comunidad_unirme', { p_nombre: 'Ana L.', p_version: v, p_normas: n }), [VERSION_COMUNIDAD, VERSION_NORMAS]);
    const lunes = lunesDe(fechaMadrid());
    await p.evaluate(async ([l0, l1, l2]) => {
      const yo = (await globalThis.__fbeDemo.select('atletas', {}))[0];
      localStorage.setItem(`fbe-travesia-${yo.id}`, JSON.stringify({ total: 11960, estrellas: 38, mejor: 500, retos: 5, rios: 0, semanas: { [l0]: 300, [l1]: 500, [l2]: 400 } }));
    }, [lunes, sumarDias(lunes, -7), sumarDias(lunes, -14)]);
    await p.waitForTimeout(450);
    await p.reload();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();

    // --- «Tu travesía»: la tarjeta se abre ---
    const tarjeta = p.locator('.travesia-tarjeta');
    await tarjeta.scrollIntoViewIfNeeded();
    check(/Tu lobo lleva 12 km/.test(await tarjeta.textContent()) && trozos.length === 0, 'en Hoy, la tarjeta dice lo que lleva su lobo (y «Tu travesía» no se descarga hasta abrirla)');
    await tarjeta.getByRole('button', { name: /Ver tu travesía/ }).click();
    const hoja = p.locator('.tv-hoja');
    await hoja.waitFor();
    await p.locator('.tv-manada').waitFor();
    check(trozos.length === 1 && await p.getByRole('dialog', { name: 'Tu travesía' }).count() === 1, 'al tocarla se abre «Tu travesía» (su trozo, una vez)');
    const mapa = await p.locator('.tv-mapa').textContent();
    check(/De Mieres a Madrid/.test(mapa) && /pasado Mieres, a 0,1 km de Pola de Lena/.test(mapa) && await p.locator('.tv-hito').count() === 10 && await p.locator('.tv-hito.pasado').count() === 1 && /Madrid · 450 km/.test(mapa),
      `el mapa: de Mieres a Madrid, con sus diez hitos; va pasado Mieres, a 0,1 km de Pola de Lena («${mapa.slice(0, 120)}», ${await p.locator('.tv-hito').count()} hitos, ${await p.locator('.tv-hito.pasado').count()} pasados)`);
    check(await p.locator('.tv-postal').count() === 2 && /Mieres/.test(await p.locator('.tv-postal').first().textContent()) && /Pola de Lena/.test(await p.locator('.tv-postal.pendiente').textContent()),
      'las postales: la de Mieres y, con su candado, la siguiente');
    const filas = p.locator('.tv-fila');
    check(await filas.count() === 3 && /^1Rubén M\. · hoy4,2 km/.test(await filas.first().textContent()) && await p.locator('.tv-fila.yo').count() === 0,
      'la manada, esta semana: los del equipo que han corrido, de más a menos (Ana aún no ha subido nada)');
    await filas.nth(1).getByRole('button', { name: 'Retar' }).click();
    const duelo = await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('fbe-travesia-duelo-')); return k ? JSON.parse(localStorage.getItem(k)) : null; });
    check(await filas.nth(1).getByRole('button', { name: 'En duelo' }).getAttribute('aria-pressed') === 'true' && duelo?.rival === 'Carlos V.' && duelo.semana === lunes && /Duelo con Carlos V\.: 2,3 km por detrás/.test(await p.locator('.tv-manada .tv-donde').textContent()),
      'se puede retar a un compañero: el duelo de la semana se guarda en el móvil y dice cómo va (2,3 km por detrás)');
    check(/Entre todos, este mes/.test(await p.locator('.tv-equipo').textContent()) && /de 50 km · 3 lobos/.test(await p.locator('.tv-equipo').textContent()), 'y lo que suma el equipo en el mes, con su meta');
    const lobos = p.locator('.tv-lobo');
    check(await lobos.count() === 7 && await lobos.first().getAttribute('aria-pressed') === 'true' && await lobos.nth(4).isDisabled() && /Recorre 25 km/.test(await lobos.nth(4).textContent()) && await lobos.nth(3).isEnabled(),
      'sus lobos: el de tiza, elegido; el dorado ya lo tiene (cinco retos) y el de nieve dice cómo se consigue');
    await lobos.nth(3).click();
    check(await lobos.nth(3).getAttribute('aria-pressed') === 'true' && await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes') || '{}').loboJuego) === 'oro', 'elige el dorado, y se recuerda');
    check(/Te siguen 3 lobos/.test(await hoja.textContent()), 'tres semanas seguidas: le siguen tres lobos');
    const cielo = p.locator('.tv-constelacion');
    check(await cielo.count() === 6 && /El Lobo7 de 8/.test(await cielo.first().textContent()) && /0 de 6/.test(await p.locator('#tv-cielo-t').textContent()), 'las constelaciones: con 38 estrellas, siete de las ocho de El Lobo');
    await p.getByRole('button', { name: 'Contarlo' }).click();
    await p.waitForTimeout(300);
    const copiado = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    check(/^Mi lobo lleva 12 km en La travesía \(de Mieres a Madrid\)/.test(copiado) && /Avanza solo cuando entreno\.$/.test(copiado), '«Contarlo» deja el texto listo para pegar');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'nada se sale de la pantalla');
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });

    // --- En el descanso: su lobo, los que le siguen, quién corre hoy y la postal ---
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    const prep = p.locator('.preparacion');
    if (await prep.count()) {
      for (const [g, r] of [['¿Cómo has dormido?', 'Bien'], ['¿Cómo tienes la energía?', 'Normal'], ['¿Agujetas o molestias?', 'Ninguna']]) {
        await prep.getByRole('group', { name: g }).getByRole('button', { name: r, exact: true }).click();
        await p.waitForTimeout(350);
      }
    }
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const primero = p.locator('.ejercicio').first();
    await primero.getByLabel('Kilos de la serie 1').fill('30');
    await primero.getByLabel('Repeticiones de la serie 1').fill('8');
    await p.keyboard.press('Escape');
    await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    const reloj = p.locator('.temporizador');
    await reloj.waitFor();
    const seg = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
    await reloj.getByRole('button', { name: 'Quitar 1 minuto' }).click();
    for (let i = 0; i < 12 && seg(await reloj.locator('.cuenta').textContent()) > 24; i++) await reloj.getByRole('button', { name: 'Quitar 15 segundos' }).click();
    const quedaban = seg(await reloj.locator('.cuenta').textContent());
    await reloj.getByRole('button', { name: 'Jugar' }).click();
    const juego = p.locator('.travesia');
    await juego.waitFor();
    // (nada más abrir: antes del primer obstáculo, con el lobo en el suelo)
    let oro = 0, tiza = 0, detras = 0;
    for (let i = 0; i < 6 && oro < 150; i++) { await p.waitForTimeout(160); oro = await pixeles([247, 215, 102], 0.08, 0.36); tiza = await pixeles([241, 240, 246], 0.12, 0.3); detras = await pixeles([217, 211, 247], 0, 0.2); }
    await p.locator('.travesia-manada').waitFor({ timeout: 4000 }).catch(() => {});
    check(/Hoy también han corrido: Rubén M\., Carlos V\./.test(await p.locator('.travesia-manada').textContent().catch(() => '')), 'en el juego, quién más ha corrido hoy');
    check(oro > 150 && tiza < oro / 4, `su lobo corre con el color elegido (${oro} px dorados)`);
    check(detras > 60, `y detrás van los de su manada (${detras} px)`);
    await p.locator('.travesia-final').waitFor({ timeout: (quedaban + 8) * 1000 });
    const final = await p.locator('.travesia-final').textContent();
    check(/Has llegado a Pola de Lena/.test(final), 'al pasar el kilómetro 12, la etapa lo dice: «Has llegado a Pola de Lena»');
    check(/Duelo con Carlos V\.: vas .* por detrás/.test(final), 'y cómo va el duelo');
    await juego.waitFor({ state: 'detached', timeout: 12000 });
    const g = await guardado();
    check(g.total > 12000 && g.semanas[lunes] > 300, 'lo corrido se suma al total y a la semana');
    if (await reloj.count()) await p.locator('.temporizador .saltar').click().catch(() => {});
    await p.getByRole('button', { name: 'Volver' }).first().click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    await p.locator('.travesia-tarjeta').scrollIntoViewIfNeeded();
    await p.locator('.travesia-tarjeta').getByRole('button', { name: /Ver tu travesía/ }).click();
    await p.locator('.tv-fila.yo').waitFor({ timeout: 8000 });
    check(await p.locator('.tv-fila').count() === 4 && /Tú/.test(await p.locator('.tv-fila.yo').textContent()) && /Vas el 4\.º de 4/.test(await p.locator('.tv-manada .tv-donde').textContent()),
      'ya subida, Ana sale en la clasificación de la semana: «Tú», la cuarta de cuatro');
    check(await p.locator('.tv-postal').count() === 3 && /Pola de Lena/.test(await p.locator('.tv-postal').first().textContent()) && /Puerto de Pajares/.test(await p.locator('.tv-postal.pendiente').textContent()) && trozos.length === 1,
      'y en el álbum, la postal de Pola de Lena; la siguiente, el Puerto de Pajares');
    await p.keyboard.press('Escape');
  } catch (e) {
    check(false, `La travesía, tanda 3: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
  check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 5).join(' ## ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nLa travesía, tanda 3: el mapa, la manada y los lobos');
  try { await probarTravesia3({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
