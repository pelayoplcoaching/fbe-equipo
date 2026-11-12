// «Apuntes», formación en los descansos, en la demo y en un móvil simulado: el apunte del día en Hoy, «Aprender» en el
// descanso (primero, una clave del ejercicio del que se descansa), las tarjetas con vuelta («Lo sabía» / «No lo sabía»),
// que se cierra sola al acabar el descanso y se abre sola en el siguiente, y el repaso en Semana.
//   Suelta:  npm run build && node test/e2e-apuntes.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarApuntes } = await import('./e2e-apuntes.mjs'); await probarApuntes({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarApuntes({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const trozos = [];
  p.on('request', (r) => { if (/\/chunks\/Apuntes-/.test(r.url())) trozos.push(r.url()); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const vistos = () => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('fbe-apuntes-')); return k ? JSON.parse(localStorage.getItem(k)).vistos : {}; });
  const ajustes = () => p.evaluate(() => { const a = JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'); return { apunte: a.apunteDescanso === true, juego: a.juegoDescanso === true }; });
  const seg = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  const hoja = p.locator('.apuntes');
  const tarjeta = hoja.locator('article.apunte');
  const idActual = async () => `${await tarjeta.locator('.chip').textContent()}|${(await tarjeta.locator('h2').count()) ? await tarjeta.locator('h2').textContent() : ''}|${(await tarjeta.locator('.apunte-texto').count()) ? await tarjeta.locator('.apunte-texto').textContent() : ''}`;

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();

    // --- Hoy: el apunte del día ---
    const enHoy = p.locator('.apuntes-tarjeta:not(.repaso)');
    await enHoy.scrollIntoViewIfNeeded();
    check(await enHoy.count() === 1 && /El apunte de hoy/.test(await enHoy.textContent()) && trozos.length === 0, 'en Hoy, «El apunte de hoy», en una línea; su pantalla no se descarga hasta abrirla');
    await enHoy.getByRole('button', { name: 'Leer' }).click();
    await tarjeta.waitFor();
    const chip0 = await tarjeta.locator('.chip').textContent();
    check(trozos.length === 1 && await hoja.getAttribute('role') === 'dialog' && /El apunte de hoy/.test(await hoja.locator('.apuntes-titulo').textContent()) && await hoja.locator('.apuntes-cuenta').count() === 0,
      'al abrirla: una pantalla con el apunte, sin cuenta (no hay descanso)');
    check(['Idea clave', 'Mito'].includes(chip0) && (await tarjeta.locator('h2').textContent()).length > 3, `el del día es de las guías (${chip0}: «${(await tarjeta.locator('h2').textContent()).slice(0, 40)}»)`);
    const a0 = await idActual();
    await hoja.getByRole('button', { name: /Otro apunte/ }).click();
    await p.waitForTimeout(250);
    check(await idActual() !== a0, '«Otro apunte» trae otro');
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });
    const v0 = await vistos();
    check(Object.keys(v0).length >= 1 && Object.values(v0).every((x) => /^\d{4}-\d\d-\d\d$/.test(x.t) && x.n === 1), `lo visto se apunta en el móvil (${Object.keys(v0).length})`);

    // --- En la sesión: «Aprender» en el descanso ---
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const primero = p.locator('.ejercicio').first();
    const nombreEj = await primero.textContent();
    const marcar = async (n) => {
      await primero.getByLabel(`Kilos de la serie ${n}`).fill('30');
      await primero.getByLabel(`Repeticiones de la serie ${n}`).fill('8');
      await p.keyboard.press('Escape');
      await primero.getByRole('button', { name: `Marcar la serie ${n} como hecha` }).click();
      await p.locator('.temporizador').waitFor();
    };
    await marcar(1);
    const reloj = p.locator('.temporizador');
    const aprender = reloj.getByRole('button', { name: 'Aprender' });
    check(await aprender.count() === 1 && await reloj.getByRole('button', { name: 'Jugar' }).count() === 1 && await hoja.count() === 0, 'en el descanso, «Aprender» junto a «Respira» y «Jugar»; de entrada no se abre solo');
    const anchoExtras = await reloj.locator('.descanso-extras').evaluate((e) => ({ dentro: e.scrollWidth <= e.clientWidth + 1, filas: new Set([...e.children].map((b) => Math.round(b.getBoundingClientRect().top))).size }));
    check(anchoExtras.dentro && anchoExtras.filas === 1, 'los tres botones caben en una fila a 390 px');
    await aprender.click();
    await tarjeta.waitFor();
    const cuentaA = await hoja.locator('.apuntes-cuenta').textContent();
    check(Math.abs(seg(cuentaA) - seg(await reloj.locator('.cuenta').textContent())) <= 1, `arriba, la cuenta del descanso (${cuentaA})`);
    const chip1 = await tarjeta.locator('.chip').textContent(), de1 = await tarjeta.locator('.apunte-de').textContent();
    check(chip1 === 'La clave' && nombreEj.includes(de1) && (await tarjeta.locator('.apunte-texto').textContent()).length > 10, `el primero, una clave del ejercicio del que descansa (${de1}: «${(await tarjeta.locator('.apunte-texto').textContent()).slice(0, 50)}…»)`);
    const aj1 = await ajustes();
    check(aj1.apunte && !aj1.juego, 'queda apuntado que aprende en los descansos');
    await hoja.getByRole('button', { name: /Otro apunte/ }).click();
    await p.waitForTimeout(250);
    check(['Idea clave', 'Mito'].includes(await tarjeta.locator('.chip').textContent()), 'el segundo, uno de las guías (no todo es técnica)');
    // hasta dar con uno que tenga vuelta (un error típico o un mito)
    let conVuelta = false;
    for (let i = 0; i < 14 && !conVuelta; i++) {
      conVuelta = await hoja.locator('.apunte-destapar').count() === 1;
      if (!conVuelta) { await hoja.getByRole('button', { name: /Otro apunte/ }).click(); await p.waitForTimeout(200); }
    }
    const tituloVuelta = conVuelta ? await tarjeta.locator('h2').textContent() : '';
    check(conVuelta && await tarjeta.locator('.apunte-texto').count() === 0 && await hoja.getByRole('button', { name: 'Lo sabía', exact: true }).count() === 0, `los errores típicos y los mitos van tapados: delante, solo «${tituloVuelta.slice(0, 40)}»`);
    await hoja.locator('.apunte-destapar').click();
    check((await tarjeta.locator('.apunte-texto').textContent()).length > 15 && await hoja.getByRole('button', { name: 'Lo sabía', exact: true }).count() === 1 && await hoja.getByRole('button', { name: 'No lo sabía' }).count() === 1, 'al destaparlo, el porqué y «Lo sabía» / «No lo sabía»');
    await hoja.getByRole('button', { name: 'No lo sabía' }).click();
    await p.waitForTimeout(250);
    const v1 = await vistos();
    check(Object.values(v1).filter((x) => x.s === false).length === 1, 'el que no sabía queda apuntado para repasar');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    check(!(await ajustes()).apunte && await reloj.count() === 1, 'cerrados a mano: vuelve al reloj y ya no se abren solos');

    // El descanso se acorta y se lee hasta el final: se cierran solos
    await reloj.getByRole('button', { name: 'Quitar 1 minuto' }).click();
    for (let i = 0; i < 12 && seg(await reloj.locator('.cuenta').textContent()) > 24; i++) await reloj.getByRole('button', { name: 'Quitar 15 segundos' }).click();
    const quedaban = seg(await reloj.locator('.cuenta').textContent());
    await aprender.click();
    await tarjeta.waitFor();
    await hoja.locator('.apuntes-cuenta', { hasText: '¡Vamos!' }).waitFor({ timeout: (quedaban + 5) * 1000 });
    check(await tarjeta.count() === 1, 'al acabar el descanso, arriba «¡Vamos!» (lo que estaba leyendo sigue ahí un momento)');
    await hoja.waitFor({ state: 'detached', timeout: 7000 });
    check((await ajustes()).apunte, 'y se cierran solos: manda el descanso. Como estaba leyendo, sigue apuntado');
    if (await p.locator('.temporizador').count()) await p.locator('.temporizador .saltar').click();
    await marcar(2);
    await tarjeta.waitFor({ timeout: 5000 });
    check(true, 'en el siguiente descanso se abren solos');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    // (o el juego o los apuntes)
    await reloj.getByRole('button', { name: 'Jugar' }).click();
    await p.locator('.travesia').waitFor();
    const aj2 = await ajustes();
    await p.locator('.travesia').getByRole('button', { name: 'Cerrar el juego' }).click();
    await p.locator('.travesia').waitFor({ state: 'detached' });
    check(aj2.juego && !aj2.apunte, 'al jugar, lo que se abre solo pasa a ser el juego (o lo uno o lo otro)');
    await p.locator('.temporizador .saltar').click();

    // --- Semana: lo visto y el repaso ---
    await p.getByRole('button', { name: 'Volver' }).first().click();
    await p.locator('nav.tabs').waitFor();
    await irASeccion(p, 'Semana');
    const enSemana = p.locator('.apuntes-tarjeta.repaso');
    await enSemana.waitFor({ timeout: 8000 });
    await enSemana.scrollIntoViewIfNeeded();
    const ts = (await enSemana.textContent()).replace(/\s+/g, ' ');
    check(/Tus apuntes/.test(ts) && /\d+ apuntes? esta semana/.test(ts) && /1 por repasar/.test(ts), `en Semana, «Tus apuntes» (${ts.replace('Tus apuntes', '').replace('Repasar', '').trim()})`);
    await enSemana.getByRole('button', { name: 'Repasar' }).click();
    await tarjeta.waitFor();
    check(/Repaso/.test(await hoja.locator('.apuntes-titulo').textContent()) && await tarjeta.locator('h2').textContent() === tituloVuelta && await hoja.locator('.apunte-destapar').count() === 1,
      'el repaso empieza por el que no sabía, otra vez tapado');
    await hoja.locator('.apunte-destapar').click();
    await hoja.getByRole('button', { name: 'Lo sabía', exact: true }).click();
    await p.waitForTimeout(250);
    check(Object.values(await vistos()).filter((x) => x.s === false).length === 0 && await hoja.getByRole('button', { name: 'Siguiente' }).count() + await hoja.locator('.apunte-destapar').count() >= 1, 'ahora lo sabía: ya no queda por repasar; y sigue con los de la semana');
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    check(!/por repasar/.test(await enSemana.textContent()), 'y la tarjeta ya no dice «por repasar»');
  } catch (e) {
    check(false, `Apuntes: ${e.message.split('\n')[0]}`);
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
  console.log('\nApuntes, formación en los descansos');
  try { await probarApuntes({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
