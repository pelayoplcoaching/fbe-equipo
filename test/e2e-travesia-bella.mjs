// «La travesía», más bonita (tanda de belleza), en la demo y en un móvil simulado: la tarjeta con el cielo de la hora y
// su lobo al trote, la ruta que se dibuja, el juego que entra y se va fundiéndose, la estrella que vuela a su contador,
// el marco de los diez últimos segundos, el paisaje que se funde con el siguiente y el final que cuenta hacia arriba.
// Con «reducir movimiento», nada de eso se mueve.
//   Suelta:  npm run build && node test/e2e-travesia-bella.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarTravesiaBella } = await import('./e2e-travesia-bella.mjs'); await probarTravesiaBella({ navegador, check });
import { pathToFileURL } from 'node:url';

export async function probarTravesiaBella({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  async function abrir({ quieto = false, total = 0 } = {}) {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, reducedMotion: quieto ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
    if (total > 0) await p.evaluate(async (t) => { const yo = (await globalThis.__fbeDemo.select('atletas', {}))[0]; localStorage.setItem(`fbe-travesia-${yo.id}`, JSON.stringify({ total: t, estrellas: 14, mejor: 300 })); }, total);
    return { ctx, p };
  }
  const nombres = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].flatMap((el) => el.getAnimations().map((a) => a.animationName || 'transicion')), sel);
  // Un punto del lienzo, en px de CSS → [r, g, b]
  const punto = (p, x, y) => p.evaluate(([px, py]) => {
    const c = document.querySelector('.travesia-lienzo'), k = c.width / c.getBoundingClientRect().width;
    return [...c.getContext('2d').getImageData(Math.round(px * k), Math.round(py * k), 1, 1).data].slice(0, 3);
  }, [x, y]);
  // Hasta el descanso de la primera serie, con el reloj a la vista
  const alDescanso = async (p) => {
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    const prep = p.locator('.preparacion');
    if (await prep.count()) await prep.getByRole('button', { name: 'Ahora no' }).click();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const primero = p.locator('.ejercicio').first();
    await primero.getByLabel('Kilos de la serie 1').fill('30');
    await primero.getByLabel('Repeticiones de la serie 1').fill('8');
    await p.keyboard.press('Escape');
    await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    const reloj = p.locator('.temporizador');
    await reloj.waitFor();
    return reloj;
  };
  const seg = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  const acortar = async (reloj, hasta) => {
    await reloj.getByRole('button', { name: 'Quitar 1 minuto' }).click().catch(() => {});
    for (let i = 0; i < 12 && seg(await reloj.locator('.cuenta').textContent()) > hasta; i++) await reloj.getByRole('button', { name: 'Quitar 15 segundos' }).click();
    return seg(await reloj.locator('.cuenta').textContent());
  };

  // ---------- La tarjeta, la ruta y la práctica ----------
  {
    const { ctx, p } = await abrir({ total: 31000 });
    try {
      const tarjeta = p.locator('.travesia-tarjeta');
      await tarjeta.scrollIntoViewIfNeeded();
      await p.locator('.travesia-tarjeta.tv-vista').waitFor();
      const fase = await tarjeta.getAttribute('data-fase');
      const lobo = await p.evaluate(() => { const l = document.querySelector('.travesia-tarjeta-paso'); return l ? { oculto: l.getAttribute('aria-hidden'), ancho: l.querySelector('svg').getBoundingClientRect().width } : null; });
      const trote = await nombres(p, '.travesia-tarjeta-paso, .travesia-tarjeta-lobo');
      check(/^(noche|alba|dia|ocaso)$/.test(fase) && lobo?.oculto === 'true' && lobo.ancho > 20 && trote.includes('tv-cruza') && trote.includes('tv-trote'),
        `la tarjeta lleva el cielo de la hora (${fase}) y su lobo, que la cruza al trote una vez, decorativo`);

      // «Tu travesía»: la ruta se dibuja y el lobo llega a su punto
      await tarjeta.getByRole('button', { name: /Ver tu travesía/ }).click();
      await p.locator('.tv-ruta').waitFor();
      const ruta0 = await nombres(p, '.tv-ruta-hecho, .tv-ruta-carril');
      await p.waitForFunction(() => ![...document.querySelectorAll('.tv-ruta-hecho, .tv-ruta-carril')].some((el) => el.getAnimations().some((a) => a.playState === 'running')));
      const sitio = await p.evaluate(() => {
        const r = document.querySelector('.tv-ruta').getBoundingClientRect(), h = document.querySelector('.tv-ruta-hecho').getBoundingClientRect(), l = document.querySelector('.tv-ruta-lobo').getBoundingClientRect();
        return { fin: h.right - r.left, lobo: l.left + l.width / 2 - r.left, ancho: r.width };
      });
      check(ruta0.includes('tv-ruta-crece') && ruta0.includes('tv-ruta-anda') && sitio.fin > 4 && Math.abs(sitio.fin - sitio.lobo) < 3 && sitio.lobo < sitio.ancho,
        `en «Tu travesía», la ruta se dibuja y el lobo camina hasta su punto (a ${Math.round(sitio.lobo)} px de ${Math.round(sitio.ancho)})`);
      await p.keyboard.press('Escape');
      await p.locator('.tv-ruta').waitFor({ state: 'detached' });

      // La práctica: entra fundiéndose; en calma, las estrellas se cogen al paso y vuelan a su contador
      await tarjeta.getByRole('button', { name: /Practicar/ }).click();
      const juego = p.locator('.travesia');
      await juego.waitFor();
      const entra = await nombres(p, '.travesia, .travesia-arriba');
      check(entra.includes('tv-entra') && entra.includes('tv-baja'), 'el juego entra fundiéndose y sus números bajan a su sitio');
      await juego.getByRole('button', { name: 'Calma' }).click();
      await p.waitForFunction(() => document.querySelector('.travesia-dato.oro')?.classList.contains('late'), null, { timeout: 15000 });
      const cuantas = Number(await p.locator('.travesia-dato.oro b').textContent());
      check(cuantas >= 1, `la estrella cogida vuela a su contador, que da un latido (${cuantas})`);
      // Se va fundiéndose
      await juego.getByRole('button', { name: 'Cerrar el juego' }).click();
      const seVa = await juego.evaluate((e) => e.classList.contains('se-va')).catch(() => true);
      await juego.waitFor({ state: 'detached' });
      check(seVa, 'al cerrarlo, se va fundiéndose y vuelve la pantalla de antes');
    } catch (e) {
      check(false, `La travesía, bonita (tarjeta y práctica): ${e.message.split('\n')[0]}`);
    } finally { await ctx.close(); }
  }

  // ---------- En un descanso: el paisaje se funde, el aro del final y la tarjeta de la etapa ----------
  {
    const { ctx, p } = await abrir({ total: 4935 });   // (a 65 m del bosque: lo cruza en este descanso)
    try {
      const reloj = await alDescanso(p);
      const quedaban = await acortar(reloj, 26);
      await reloj.getByRole('button', { name: 'Jugar' }).click();
      const juego = p.locator('.travesia');
      await juego.waitFor();
      await p.waitForTimeout(500);
      const h = 844, ySuelo = Math.round(h * 0.66) + 4;
      const antes = await punto(p, 386, ySuelo);
      // (el marco: un punto en mitad de su lado de abajo, 6 px por debajo de la caja de la cuenta)
      const marco = await p.evaluate(() => { const c = document.querySelector('.travesia-lienzo').getBoundingClientRect(), q = document.querySelector('.travesia-cuenta').getBoundingClientRect(); return { x: q.left - c.left + q.width / 2, y: Math.max(3, q.top - c.top - 6) + q.height + 12 }; });
      const enAro = async () => { const l = []; for (const d of [-1.5, 0, 1.5]) l.push(await punto(p, marco.x - 8, marco.y + d)); return l.sort((m, n) => n[0] - m[0])[0]; };
      const sinAro = await enAro();
      for (let i = 0; i < 40 && seg(await p.locator('.travesia-cuenta b').textContent()) > 8; i++) { await p.touchscreen.tap(200, 520); await p.waitForTimeout(450); }
      if (process.env.FOTO) await p.screenshot({ path: '/tmp/marco.png' });
      const conAro = await enAro();
      const claro = (c) => c[0] > 200 && c[1] > 190;
      check(!claro(sinAro) && claro(conAro), `en los diez últimos segundos, un marco alrededor de la cuenta, que se vacía (${conAro.join(',')})`);
      const fin = p.locator('.travesia-final');
      await fin.waitFor({ timeout: (quedaban + 8) * 1000 });
      if (process.env.FOTO) { await p.waitForTimeout(1400); await p.screenshot({ path: '/tmp/final.png' }); }
      const despues = await punto(p, 386, ySuelo);
      check(antes[0] > antes[1] && despues[1] > despues[0], `el paisaje se ha ido fundiendo con el siguiente: del monte (${antes.join(',')}) al bosque (${despues.join(',')})`);
      const cifra = fin.locator('strong');
      const meta = await cifra.getAttribute('aria-label');
      const cae = await nombres(p, '.travesia-final-det > span, .travesia-final .btn');
      await p.waitForFunction((m) => document.querySelector('.travesia-final strong')?.textContent === m, meta, { timeout: 4000 });
      check(/\d/.test(meta) && cae.includes('tv-cae'), `al acabar, los metros suben hasta su cifra (${meta}) y lo conseguido va cayendo`);
      await juego.waitFor({ state: 'detached', timeout: 8000 });
    } catch (e) {
      check(false, `La travesía, bonita (en el descanso): ${e.message.split('\n')[0]}`);
    } finally { await ctx.close(); }
  }

  // ---------- Con «reducir movimiento» ----------
  {
    const { ctx, p } = await abrir({ quieto: true, total: 31000 });
    try {
      const tarjeta = p.locator('.travesia-tarjeta');
      await tarjeta.scrollIntoViewIfNeeded();
      const trote = await nombres(p, '.travesia-tarjeta-paso, .travesia-tarjeta-lobo');
      await tarjeta.getByRole('button', { name: /Practicar/ }).click();
      const juego = p.locator('.travesia');
      await juego.waitFor();
      const entra = await nombres(p, '.travesia, .travesia-arriba');
      await p.waitForTimeout(600);
      const pintado = await punto(p, 195, 800);
      await juego.getByRole('button', { name: 'Cerrar el juego' }).click();
      const yaNo = await juego.count();
      check(trote.length === 0 && entra.length === 0 && pintado[2] > 20 && yaNo === 0, 'con «reducir movimiento», ni la tarjeta ni la entrada se mueven, el juego se pinta igual y se cierra al momento');
    } catch (e) {
      check(false, `La travesía, bonita, con «reducir movimiento»: ${e.message.split('\n')[0]}`);
    } finally { await ctx.close(); }
  }

  check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 5).join(' ## ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nLa travesía, más bonita');
  try { await probarTravesiaBella({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
