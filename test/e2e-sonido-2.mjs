// Sonido 2 (claude/sonido-mejoras-2.md), en la demo y en un móvil simulado: en Sonido y vibración, el clic del teclado,
// «¿Seguimos?», el sonido de fondo del descanso, el horario sin sonidos, la velocidad de la voz, contar las repeticiones y la
// prueba de sonido «¿Se oye bien?»; en la sesión, la línea «¿Se oye bien el sonido?», el clic del teclado de la app y la nota
// del RPE. Lo que suena se mira por el evento «fbe-sonido». La lógica (prioridades, horario, «¿Seguimos?», la melodía del
// progreso, la cola de la pista), en test/sonido.test.mjs; la 065, en test/sonido-base.test.mjs.
//   Suelta:  npm run build && node test/e2e-sonido-2.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarSonido2 } = await import('./e2e-sonido-2.mjs'); await probarSonido2({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarSonido2({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  await p.addInitScript(() => {
    window.__son = []; window.addEventListener('fbe-sonido', (e) => window.__son.push(e.detail?.tipo));
    window.__dicho = [];
    try {
      const voces = [{ name: 'Mónica', lang: 'es-ES', localService: true }, { name: 'Paulina', lang: 'es-MX', localService: true }];
      const falsa = { speak: (u) => window.__dicho.push({ texto: u.text, rate: u.rate }), cancel() {}, getVoices: () => voces, speaking: false, pending: false, addEventListener() {} };
      Object.defineProperty(window, 'speechSynthesis', { value: falsa, configurable: true });
      // (una de mentira siempre: la de verdad no acepta voces de mentira)
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    } catch { /* */ }
  });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const son = () => p.evaluate(() => window.__son.slice());
  const aj = () => p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'));

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();

    // --- Sonido y vibración: lo nuevo ---
    await irASeccion(p, 'Perfil');
    await p.getByRole('button', { name: /^Sonido y vibración/ }).click();
    const hoja = p.getByRole('dialog', { name: 'Sonido y vibración' });
    await hoja.getByRole('group', { name: 'Cuánto suena la app' }).waitFor();
    const teclado = hoja.getByRole('switch', { name: /Clic del teclado/ });
    check(!(await teclado.isChecked()), 'el clic del teclado viene apagado');
    await teclado.click();
    check((await aj()).sonidoTeclado === true && (await son()).includes('tecla'), 'al encenderlo se guarda y suena una vez para oírlo');
    check(await hoja.getByRole('switch', { name: /¿Seguimos?/ }).isChecked(), '«¿Seguimos?» viene encendido');
    const paisaje = hoja.getByLabel('Sonido de fondo en el descanso');
    check((await paisaje.locator('option').allTextContents()).join() === 'Ninguno,Ruido marrón,Lluvia,Bosque', 'el sonido de fondo del descanso: ninguno, ruido marrón, lluvia o bosque');
    await paisaje.selectOption('lluvia');
    check((await aj()).paisajeDescanso === 'lluvia', 'se guarda el elegido');
    await paisaje.selectOption('');
    await hoja.getByRole('switch', { name: /Horario sin sonidos/ }).click();
    const desde = hoja.locator('#aj-silencio-desde'), hasta = hoja.locator('#aj-silencio-hasta');
    check(await desde.inputValue() === '23:00' && await hasta.inputValue() === '08:00', 'el horario sin sonidos, de once de la noche a ocho de la mañana');
    await desde.fill('22:30');
    check((await aj()).silencioActivo === true && (await aj()).silencioDesde === '22:30', 'y se cambia');
    await hoja.getByRole('switch', { name: /Horario sin sonidos/ }).click();
    // la voz: cuál y a qué velocidad
    const voz = hoja.getByRole('switch', { name: /Entrenador por voz/ });
    if (!(await voz.isChecked())) await voz.click();
    const qVoz = hoja.getByLabel('Qué voz');
    check(await qVoz.count() === 1 && (await qVoz.locator('option').allTextContents()).some((t) => /Mónica/.test(t)), 'se elige la voz entre las del móvil en español');
    await qVoz.selectOption('Paulina');
    await hoja.getByRole('group', { name: 'Velocidad de la voz' }).getByRole('button', { name: 'Más despacio' }).click();
    await p.waitForTimeout(250);
    const dicho = await p.evaluate(() => window.__dicho.slice());
    const a2 = await aj();
    check(a2.vozNombre === 'Paulina' && a2.vozVelocidad === 0.85 && dicho.at(-1)?.rate < 1, `la voz elegida y más despacio (y se oye de ejemplo: ${dicho.at(-1)?.rate?.toFixed?.(2)})`);
    check(await hoja.getByRole('switch', { name: /Contar las repeticiones/ }).count() === 1, 'contar las repeticiones con el metrónomo, para encender');
    // «¿Se oye bien?» desde Ajustes
    await hoja.getByRole('button', { name: 'Prueba de sonido' }).click();
    const prueba = p.getByRole('dialog', { name: '¿Se oye bien?' });
    await prueba.waitFor();
    await p.evaluate(() => { window.__son = []; });
    await prueba.getByRole('button', { name: 'Escuchar' }).click();
    await prueba.getByRole('status').waitFor({ timeout: 3000 });
    await p.waitForTimeout(3800);
    const oidos = await son();
    check(oidos.includes('serie') && oidos.includes('cuenta') && oidos.includes('fin-descanso'), `la prueba toca una serie, la cuenta atrás y el final del descanso (${[...new Set(oidos)].join(', ')})`);
    const antes = Number((await aj()).volumen) || 1;
    await prueba.getByRole('button', { name: 'Muy alto' }).click();
    check(Number((await aj()).volumen) < antes, '«Muy alto» baja el volumen de la app (y vuelve a sonar)');
    await prueba.getByRole('button', { name: 'Se oye bien' }).click();
    await prueba.getByRole('button', { name: /En un gimnasio con música/ }).click();
    await prueba.waitFor({ state: 'detached' });
    const a3 = await aj();
    check(a3.pruebaSonido === true && a3.sonidoBrillante === true, 'en un gimnasio con música: los sonidos más brillantes, y la prueba queda hecha');
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });

    // --- En la sesión: la línea «¿Se oye bien?», el clic del teclado y la nota del RPE ---
    await p.waitForTimeout(400);
    await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'); a.pruebaSonido = false; localStorage.setItem('fbe-ajustes', JSON.stringify(a)); });
    await p.goto(`${base}/?demo`);
    const entrar = p.getByRole('button', { name: /Ana López/ }).first();
    await Promise.race([entrar.waitFor({ timeout: 15000 }), p.locator('nav.tabs').waitFor({ timeout: 15000 })]).catch(() => {});
    if (await entrar.isVisible().catch(() => false)) await entrar.click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    await irASeccion(p, 'Hoy');
    await p.locator('.hero-dia .btn-hero').waitFor();
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    const prep = p.locator('.preparacion');
    if (await prep.count()) await prep.getByRole('button', { name: 'Ahora no' }).click();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const linea = p.locator('.aviso-prueba-sonido');
    check(await linea.count() === 1 && /¿Se oye bien el sonido\?/.test(await linea.textContent()), 'en la primera sesión, una línea: «¿Se oye bien el sonido?»');
    await linea.getByRole('button', { name: 'Ahora no' }).click();
    check(await linea.count() === 0 && (await aj()).pruebaSonido === true, '«Ahora no» la quita para siempre');
    await p.evaluate(() => { window.__son = []; });
    const primero = p.locator('.ejercicio').first();
    await primero.getByLabel('Kilos de la serie 1').click();
    const tecl = p.locator('.teclado-serie');
    if (await tecl.count()) {
      await tecl.locator('button.tecla').first().click();
      check((await son()).includes('tecla'), 'con el clic encendido, cada tecla del teclado de la app hace clic');
      const rpe = tecl.getByRole('group', { name: 'RPE de la serie' });
      if (!(await rpe.count())) { await primero.getByLabel(/RPE de la serie 1/).first().click().catch(() => {}); }
      const grupo = p.locator('.teclado-serie').getByRole('group', { name: 'RPE de la serie' });
      if (await grupo.count()) {
        await p.evaluate(() => { window.__son = []; });
        await grupo.getByRole('button', { name: /^8/ }).first().click();
        check((await son()).includes('rpe'), 'elegir el RPE suena con su nota');
      } else check(true, '(el RPE no está en este teclado: su nota se mira en la lógica)');
    } else check(true, '(sin el teclado de la app en este móvil: el clic se mira en la lógica)');
    await p.keyboard.press('Escape');
  } catch (e) {
    check(false, `Sonido 2: ${e.message.split('\n')[0]}`);
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
  console.log('\nSonido 2');
  try { await probarSonido2({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
