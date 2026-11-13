// «La travesía», el juego del descanso, en la demo y en un móvil simulado: la tarjeta de Hoy y de Semana con su minuto
// de práctica, el botón «Jugar» del descanso, que la etapa acaba con el descanso y se cierra sola, lo que se guarda en el
// móvil y que el juego se abre solo en el siguiente descanso hasta que se cierra a mano.
//   Suelta:  npm run build && node test/e2e-travesia.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarTravesia } = await import('./e2e-travesia.mjs'); await probarTravesia({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarTravesia({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const trozos = [];
  p.on('request', (r) => { if (/\/chunks\/Travesia-/.test(r.url())) trozos.push(r.url()); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const guardado = () => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('fbe-travesia-')); return k ? JSON.parse(localStorage.getItem(k)) : null; });
  const ajuste = () => p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes') || '{}').juegoDescanso === true);
  const metros = async () => parseInt((await p.locator('.travesia-dato b').first().textContent()).replace(/\D/g, ''), 10);
  // (el lienzo tiene dibujo: el cielo, pintado, y la línea clara del suelo a dos tercios; el cielo y la luna cambian con la
  // hora y la fase de verdad, así que no se mira su color)
  const pintado = () => p.evaluate(() => {
    const c = document.querySelector('.travesia-lienzo'); const x = c.getContext('2d');
    const cielo = x.getImageData(4, 4, 1, 1).data;
    const fila = Math.round(c.height * 0.66) + 1;
    const d = x.getImageData(0, fila - 3, c.width, 6).data; let claro = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 200 && d[i] > 120) claro++;
    return { ancho: c.width, cielo: [...cielo], claro };
  });

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();

    // --- Hoy: la tarjeta, en una línea, y un minuto de práctica ---
    const tarjeta = p.locator('.travesia-tarjeta');
    await tarjeta.scrollIntoViewIfNeeded();
    check(await tarjeta.count() === 1 && /La travesía/.test(await tarjeta.textContent()) && /avanza solo cuando entrenas/.test(await tarjeta.textContent()) && (await tarjeta.getAttribute('class')).includes('compacta'),
      'en Hoy, «La travesía» en una línea: el juego de tus descansos, que avanza solo cuando entrenas');
    check(trozos.length === 0, 'el juego no se descarga hasta que se abre');
    await tarjeta.getByRole('button', { name: /Practicar/ }).click();
    const juego = p.locator('.travesia');
    await juego.waitFor();
    await p.waitForTimeout(700);
    check(trozos.length === 1, 'al abrirlo, se pide su trozo (una vez)');
    const pin = await pintado();
    check(pin.ancho >= 390 && pin.cielo[3] === 255 && pin.claro > 200, `a pantalla completa: el cielo y la línea del suelo, pintados (lienzo de ${pin.ancho} px)`);
    check(await juego.getAttribute('role') === 'dialog' && await juego.evaluate((e) => e === document.activeElement) && /^(1:00|0:5\d)$/.test(await p.locator('.travesia-cuenta b').textContent()) && /práctica/i.test(await p.locator('.travesia-cuenta').textContent()),
      'la práctica dura un minuto y el foco entra en el juego');
    check(await p.locator('.travesia-pista').count() === 1, 'la primera vez, la pista: «Toca para saltar»');
    const m0 = await metros();
    await p.touchscreen.tap(200, 520);
    await p.waitForTimeout(150);
    check(await p.locator('.travesia-pista').count() === 0, 'al primer toque salta y la pista se va');
    await p.waitForTimeout(1200);
    const m1 = await metros();
    check(m1 > m0 + 4, `el lobo corre solo (de ${m0} a ${m1} m)`);
    await p.keyboard.press(' ');
    // (tanda 1) el sonido y el modo calma, que se recuerdan en el móvil
    const modos = juego.locator('.travesia-modo');
    // (top, tanda 3: detrás del sonido, la música)
    check(await modos.count() === 3 && await modos.nth(0).getAttribute('aria-pressed') === 'false' && await modos.nth(1).getAttribute('aria-pressed') === 'false' && await modos.nth(2).getAttribute('aria-pressed') === 'false', 'en el juego: «Calma», el sonido y la música, apagados de entrada');
    await modos.nth(1).click();
    await modos.nth(0).click();
    await p.waitForTimeout(1300);
    const mc0 = await metros();
    await p.keyboard.press('ArrowDown');
    await p.touchscreen.tap(200, 520);
    await p.waitForTimeout(1500);
    const mc1 = await metros();
    const ajustesJ = await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'); return [a.calmaJuego, a.sonidoJuego]; });
    check(await juego.evaluate((e) => e.classList.contains('en-calma')) && mc1 - mc0 >= 2 && mc1 - mc0 <= 5 && ajustesJ[0] === true && ajustesJ[1] === true, `en calma, el lobo va al paso (${mc1 - mc0} m en segundo y medio) y la etapa vuelve a empezar; se recuerda`);
    await modos.nth(0).click(); await modos.nth(1).click();
    await p.keyboard.press('Escape');
    await juego.waitFor({ state: 'detached' });
    check(!((await guardado())?.total > 0), 'cerrada a medias, la práctica no apunta nada');

    // --- En la sesión: «Jugar» en el descanso ---
    await p.evaluate(() => window.scrollTo(0, 0));
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
    const marcar = async (n) => {
      await primero.getByLabel(`Kilos de la serie ${n}`).fill('30');
      await primero.getByLabel(`Repeticiones de la serie ${n}`).fill('8');
      await p.keyboard.press('Escape');
      await primero.getByRole('button', { name: `Marcar la serie ${n} como hecha` }).click();
      await p.locator('.temporizador').waitFor();
    };
    await marcar(1);
    const reloj = p.locator('.temporizador');
    const jugar = reloj.getByRole('button', { name: 'Jugar' });
    check(await jugar.count() === 1 && await reloj.getByRole('button', { name: 'Respira' }).count() === 1 && !(await ajuste()) && await juego.count() === 0,
      'en el descanso, «Jugar» junto a «Respira»; de entrada no se abre solo');
    await jugar.click();
    await juego.waitFor();
    const cuentaJ = await p.locator('.travesia-cuenta b').textContent(), cuentaR = await reloj.locator('.cuenta').textContent();
    const seg = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
    check(Math.abs(seg(cuentaJ) - seg(cuentaR)) <= 1 && /descanso/i.test(await p.locator('.travesia-cuenta').textContent()), `el juego lleva la cuenta del descanso (${cuentaJ}, como el reloj)`);
    check(/^Después: /.test(await p.locator('.travesia-despues').textContent()) && await ajuste(), 'abajo, lo que toca después; y queda apuntado que juega en los descansos');
    // (el reto lo escribe el primer cuadro del juego: se espera a que salga)
    await p.waitForFunction(() => /^Reto de hoy/.test(document.querySelector('.travesia-reto')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    check(/^Reto de hoy/.test(await p.locator('.travesia-reto').textContent()), `y el reto del día («${(await p.locator('.travesia-reto').textContent()).slice(0, 60)}»)`);
    await juego.getByRole('button', { name: 'Cerrar el juego' }).click();
    await juego.waitFor({ state: 'detached' });
    check(!(await ajuste()) && await reloj.count() === 1 && !((await guardado())?.total > 0), 'cerrado a mano nada más abrirlo: vuelve al reloj, no apunta nada (menos de 20 m) y ya no se abre solo');

    // El descanso se acorta y se juega hasta el final: la etapa acaba con él y se cierra sola
    await reloj.getByRole('button', { name: 'Quitar 1 minuto' }).click();
    for (let i = 0; i < 12 && seg(await reloj.locator('.cuenta').textContent()) > 24; i++) await reloj.getByRole('button', { name: 'Quitar 15 segundos' }).click();
    const quedaban = seg(await reloj.locator('.cuenta').textContent());
    await jugar.click();
    await juego.waitFor();
    for (let i = 0; i < 4; i++) { await p.touchscreen.tap(200, 520); await p.waitForTimeout(700); }
    const fin = p.locator('.travesia-final');
    await fin.waitFor({ timeout: (quedaban + 6) * 1000 });
    const textoFin = await fin.textContent();
    const g1 = await guardado();
    const idSesion = g1 ? Object.keys(g1.sesiones)[0] : null;
    check(/¡Vamos!/.test(textoFin) && /\d+ m/.test(textoFin) && await fin.getByRole('button', { name: 'A por la serie' }).count() === 1, `al acabar el descanso, la etapa se para: «${textoFin.replace(/\s+/g, ' ').trim().slice(0, 40)}»`);
    check(g1 && g1.total > 20 && idSesion && g1.sesiones[idSesion].metros === g1.total && g1.sesiones[idSesion].etapas === 1 && g1.mejor === g1.total && g1.practica === 0,
      `y se apunta en el móvil, en su sesión (${g1?.total} m, 1 etapa)`);
    await juego.waitFor({ state: 'detached', timeout: 6000 });
    check(await p.locator('.temporizador.fin').count() === 1 || await p.locator('.temporizador').count() === 0, 'se cierra sola y deja delante el reloj: manda el descanso, no el juego');
    check(await ajuste(), 'como estaba jugando al acabar, sigue apuntado que juega en los descansos');

    // En el siguiente descanso se abre solo
    if (await p.locator('.temporizador').count()) await p.locator('.temporizador .saltar').click();
    await marcar(2);
    await juego.waitFor({ timeout: 4000 });
    check(true, 'en el siguiente descanso, el juego se abre solo');
    await p.waitForTimeout(4500);
    await juego.getByRole('button', { name: 'Cerrar el juego' }).click();
    await juego.waitFor({ state: 'detached' });
    const g2 = await guardado();
    check(!(await ajuste()) && g2.total > g1.total + 15 && g2.sesiones[idSesion].etapas === 2 && g2.sesiones[idSesion].metros === g2.total, `hasta que lo cierra a mano; lo corrido hasta ahí cuenta (${g2.total} m en 2 etapas)`);
    await p.locator('.temporizador .saltar').click();

    // --- Semana: la tarjeta, con lo recorrido y sus marcas ---
    await p.getByRole('button', { name: 'Volver' }).first().click();
    await p.locator('nav.tabs').waitFor();
    await irASeccion(p, 'Semana');
    const enSemana = p.locator('.travesia-tarjeta:not(.compacta)');
    await enSemana.waitFor({ timeout: 8000 });
    await enSemana.scrollIntoViewIfNeeded();
    const ts = (await enSemana.textContent()).replace(/\s+/g, ' ');
    check(/Reto de hoy/.test(ts), 'en Semana, también el reto del día');
    check(/Tu lobo lleva \d+ m/.test(ts) && /Mejor etapa: \d+ m/.test(ts), `en Semana, lo que lleva su lobo y su mejor etapa («${ts.trim().slice(0, 70)}»)`);
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'la tarjeta cabe a 390 px');
  } catch (e) {
    check(false, `La travesía: ${e.message.split('\n')[0]}`);
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
  console.log('\nLa travesía, el juego del descanso');
  try { await probarTravesia({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
