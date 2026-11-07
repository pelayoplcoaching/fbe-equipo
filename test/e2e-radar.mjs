// «A quién escribir» (el radar de contacto del coach), en la demo: la lista con el contacto de cada atleta, quién toca
// hoy y por qué, el borrador (cambiar de motivo, otra frase, editar), enviar desde la fila, «Ya hablamos», «Mañana» y
// dejar el borrador en su chat. En escritorio y a 360 px en oscuro, sin errores de consola, sin desbordes y sin fallos de
// accesibilidad.
// Necesita la pantalla enganchada en CoachApp.jsx (la pestaña «A quién escribir»): test/radar-enganche.patch.
//   Suelta:  npm run build && node test/e2e-radar.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarRadar } = await import('./e2e-radar.mjs'); await probarRadar({ navegador, check });
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRadar({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true });
  // (v0.93) la demo siembra el contacto «hace N horas» y el radar cuenta por días de Madrid: de noche, lo de hace unas
  // horas caía en el día anterior y cambiaban las cuentas. Con el reloj del navegador a mediodía de hoy, siempre igual
  const hoyMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  await ctx.clock.install({ time: new Date(`${hoyMadrid}T12:00:00+01:00`) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const foto = async (nombre) => { if (capturas) await p.screenshot({ path: `${capturas}/${nombre}.png`, fullPage: true }); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 1280;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const fuera = await p.evaluate((w) => [...document.querySelectorAll('.radar .btn, .radar textarea, .radar .chip')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > w + 1) && !el.closest('.selector-chips'); }).length, vista);
    if (fuera) errores.push(`${paso}: ${fuera} elementos del radar se salen de la pantalla`);
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
  // Entrar en la pantalla: en la barra (ancha) o en «Más» (móvil)
  const irAlRadar = async () => {
    const enBarra = p.locator('nav.tabs button.tab', { hasText: /A quién escribir|Escribir/ }).first();
    if (await enBarra.isVisible().catch(() => false)) await enBarra.click();
    else {
      await p.locator('nav.tabs').getByRole('button', { name: /Más/ }).first().click();
      await p.getByRole('dialog').getByRole('button', { name: /A quién escribir/ }).first().click();
    }
    await p.locator('.radar .revision-lista, .radar .vacio').first().waitFor();
  };
  const fila = (nombre) => p.locator('.radar .revision-fila', { hasText: nombre }).first();
  const chip = (texto) => p.locator('.radar .selector-chips').first().getByRole('button', { name: texto });

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await irAlRadar();
    check(await p.getByRole('heading', { level: 1, name: 'A quién escribir' }).count() === 1, 'la pantalla «A quién escribir» abre desde la barra del coach');
    check(/Objetivo: 2 días de contacto por semana/.test(await p.locator('.radar').textContent()), 'dice el objetivo: 2 días de contacto por semana');
    check(/1 de 5 con 2 días de contacto en los últimos 7; 3 sin ningún mensaje tuyo/.test(await p.locator('.radar .revision-progreso').textContent()), 'el resumen: cuántos cumplen y cuántos no han sabido de ti');
    check(await chip(/^Hoy \(4\)$/).getAttribute('aria-pressed') === 'true', 'abre en «Hoy», con los 4 a quienes toca escribir');
    check(await p.locator('.radar .revision-fila').count() === 4, 'cuatro filas en «Hoy»');
    check(await fila('Marta Gil').count() === 0, 'la invitada (sin cuenta activa) no sale');
    // El orden y el porqué
    const nombres = await p.locator('.radar .revision-fila .revision-quien strong').allTextContents();
    check(nombres[0] === 'Rubén Martín', 'primero, quien te escribió y tiene el último mensaje');
    check(/Te escribió hoy y lo último de la conversación es suyo/.test(await fila('Rubén Martín').textContent()), 'y dice por qué');
    check(/0 de 2 días de contacto en los últimos 7 · sin mensajes tuyos en 4 semanas/.test(await fila('Carlos Vera').textContent()), 'de cada uno, los días de contacto y el último');
    check(await fila('Carlos Vera').locator('.chip.aviso', { hasText: /días sin registrar series/ }).count() === 1, 'con lo que pasa (lleva días sin registrar)');
    await revisar('lista');
    await foto('radar-1-lista');

    // El borrador de Carlos: parte del motivo más importante, se cambia de motivo y de frase
    await fila('Carlos Vera').getByRole('button', { name: 'Escribirle' }).click();
    const area = fila('Carlos Vera').locator('textarea');
    await area.waitFor();
    const primero = await area.inputValue();
    check(/\d+ días/.test(primero) && !/[\u{1F300}-\u{1FAFF}]/u.test(primero) && primero.length < 120, `el borrador es corto, con el dato y sin emojis: «${primero}»`);
    await fila('Carlos Vera').getByRole('button', { name: 'Otra frase' }).click();
    const segundo = await area.inputValue();
    check(segundo !== primero && /\d+ días/.test(segundo), `«Otra frase» da otra del mismo motivo: «${segundo}»`);
    await fila('Carlos Vera').locator('.selector-chips').getByRole('button', { name: 'Solo saludar' }).click();
    const saludo = await area.inputValue();
    check(saludo !== segundo && !/días sin|sesiones tuyas/.test(saludo), `al cambiar de motivo cambia el borrador: «${saludo}»`);
    await area.fill('¿Qué tal la semana? Cuéntame cómo vas');
    await revisar('borrador');
    await foto('radar-2-borrador');
    // Enviar: sale el mensaje, la fila deja de estar en «Hoy» y cuenta un día de contacto
    await fila('Carlos Vera').getByRole('button', { name: 'Enviar', exact: true }).click();
    check(await hay(fila('Carlos Vera'), 0), 'al enviar, sale de «Hoy»');
    check(await hay(chip(/^Hoy \(3\)$/), 1) && await hay(chip(/^En unos días \(1\)$/), 1), 'y pasa a «En unos días»');
    await chip(/^En unos días/).click();
    check(/1 de 2 días de contacto en los últimos 7 · último: hoy/.test(await fila('Carlos Vera').textContent()), 'con un día de contacto, el de hoy');
    check(/le toca otra vez pasado mañana/.test(await fila('Carlos Vera').textContent()), 'y dice cuándo le toca otra vez');
    const enBase = await p.evaluate(() => globalThis.__fbeDemo.select('comentarios', { eq: { autor: 'coach', texto: '¿Qué tal la semana? Cuéntame cómo vas' } }).then((x) => x.length));
    check(enBase === 1, 'el mensaje está en su chat, una sola vez');

    // «Ya hablamos» cuenta como contacto de hoy (en este dispositivo) y se puede deshacer
    await chip(/^Hoy/).click();
    await fila('Iván Prieto').getByRole('button', { name: 'Ya hablamos' }).click();
    check(await hay(fila('Iván Prieto'), 0) && await hay(chip(/^Hoy \(2\)$/), 1), '«Ya hablamos» lo saca de «Hoy»');
    await p.getByRole('button', { name: 'Deshacer' }).click();
    check(await hay(fila('Iván Prieto'), 1) && await hay(chip(/^Hoy \(3\)$/), 1), 'y «Deshacer» lo devuelve');
    // «Mañana»: pospuesto hasta mañana; «Proponer ya» lo trae de vuelta
    await fila('Iván Prieto').getByRole('button', { name: 'Mañana' }).click();
    check(await hay(chip(/^Pospuestos \(1\)$/), 1) && await hay(fila('Iván Prieto'), 0), '«Mañana» lo pasa a «Pospuestos»');
    await chip(/^Pospuestos/).click();
    check(/Lo dejaste para mañana/.test(await fila('Iván Prieto').textContent()), 'y dice hasta cuándo');
    await p.reload();
    await p.getByRole('button', { name: /Pelayo/ }).first().click().catch(() => {});
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await irAlRadar();
    check(await hay(chip(/^Pospuestos \(1\)$/), 1), 'lo pospuesto se recuerda al volver a abrir la app');
    await chip(/^Pospuestos/).click();
    await fila('Iván Prieto').getByRole('button', { name: 'Proponer ya' }).click();
    check(await hay(chip(/^Pospuestos/), 0), '«Proponer ya» lo devuelve a su sitio');

    // «Todos», con el grupo de cada uno; al día, Ana
    await chip(/^Todos \(5\)$/).click();
    check(await p.locator('.radar .revision-fila').count() === 5, '«Todos»: los cinco atletas activos');
    check(await fila('Ana López').locator('.chip.ok', { hasText: 'Al día' }).count() === 1, 'Ana, al día');
    // Los récords llegan al abrir la fila y dan un motivo más
    await fila('Ana López').getByRole('button', { name: 'Escribirle' }).click();
    check(await hay(fila('Ana López').locator('.selector-chips button', { hasText: /^Récord en / }), 1), 'al abrir su fila salen sus récords recientes como motivo');
    await fila('Ana López').locator('.selector-chips button', { hasText: /^Récord en / }).click();
    const record = await fila('Ana López').locator('textarea').inputValue();
    check(/[Rr]écord en /.test(record) && !/antes/.test(record), `el borrador del récord, sin la coletilla: «${record}»`);
    await revisar('todos');

    // Dejar el borrador en su chat: abre su ficha en Mensajes con el texto ya escrito
    await fila('Ana López').locator('textarea').fill('Vaya semana llevas. Sigue así');
    await fila('Ana López').getByRole('button', { name: 'Abrir en su chat' }).click();
    const caja = p.locator('.chat textarea, .chat-redactar textarea, textarea[placeholder*="ensaje"]').first();
    await caja.waitFor();
    check(await caja.inputValue() === 'Vaya semana llevas. Sigue así', '«Abrir en su chat» abre su conversación con el borrador puesto');
    await foto('radar-3-chat');

    // A 360 px y en oscuro
    await p.setViewportSize({ width: 360, height: 760 });
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.reload();
    await p.getByRole('button', { name: /Pelayo/ }).first().click().catch(() => {});
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await irAlRadar();
    check(await p.locator('.radar .revision-fila').count() >= 2, 'a 360 px, desde «Más», la lista');
    await p.locator('.radar .revision-fila').first().getByRole('button', { name: 'Escribirle' }).click();
    await p.locator('.radar textarea').first().waitFor();
    await revisar('movil');
    await foto('radar-4-movil');
    check(errores.length === 0, `sin errores de consola, desbordes ni fallos de accesibilidad${errores.length ? `: ${errores.slice(0, 4).join(' ## ')}` : ''}`);
  } catch (e) {
    await foto('radar-error');
    check(false, `A quién escribir: ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  } finally {
    await ctx.close();
  }
}

// Suelta
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4176);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('A quién escribir (radar de contacto)');
  await probarRadar({ navegador, check, base: 'http://localhost:4176', capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
