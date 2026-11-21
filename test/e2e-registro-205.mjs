// (v0.205) Registro y Actividad del atleta, en su ficha, en el navegador: elegir bloque y semana, la vez anterior, el 1RM
// del día, toneladas y hora, lo saltado, el descanso, ajustar su próxima sesión, su historial y «Bien hecho»; y en la
// Actividad, la cabecera, su día, lo que no hizo, la hora, lo nuevo, los filtros y buscar, ir justo a cada cosa, ver la
// sesión ahí mismo, contestarle y felicitarle. A 390 px en claro y a 360 en oscuro, con accesibilidad.
//   Suelta:  npm run build && node test/e2e-registro-205.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRegistro205({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(120); } return !!(await fn().catch(() => false)); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 1280;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 2500)),
    ]));
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: { region: { enabled: false } },
      exclude: [['.chat-dia-flotante']],
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
  }
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      await p.waitForTimeout(350);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const contexto = (o = {}) => navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true, isMobile: true, bypassCSP: true, ...o });

  for (const [ancho, tema] of [[390, 'light'], [360, 'dark']]) {
    errores.length = 0;
    const primera = ancho === 390;
    const ctx = await contexto({ viewport: { width: ancho, height: 800 }, colorScheme: tema });
    try {
      p = await ctx.newPage();
      p.on('pageerror', (e) => errores.push(e.message));
      await p.goto(`${base}/?demo`);
      await p.locator('button.persona', { hasText: 'Pelayo' }).first().click();
      await p.locator('nav.tabs').waitFor();
      await cerrarDialogos();
      await p.locator('nav.tabs .tab', { hasText: 'Atletas' }).first().click();
      await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().click();

      // ---------------------------------------------------------------- Registro
      await p.getByRole('tab', { name: 'Registro' }).first().click();
      const ses = p.locator('.registro-sesion').first();
      await ses.waitFor({ timeout: 10000 });
      if (primera) {
        const sel = p.locator('#reg-bloque');
        if (await sel.count()) {
          const ops = await sel.locator('option').count();
          check(ops >= 2 && /\(activo\)/.test(await sel.locator('option:checked').textContent()), `(1) se elige el bloque (${ops}), de entrada el activo`);
        } else check(true, '(1) (Ana tiene un solo bloque)');
        const chips = p.getByRole('group', { name: 'Qué semana ver' });
        const sem = chips.getByRole('button').nth(1);
        const txtSem = await sem.textContent();
        await sem.click();
        check(await hasta(async () => (await p.locator('.registro-sesion .registro-titulo').allTextContents()).every((t) => t.startsWith(`${txtSem}:`))), `y se salta a una semana (${txtSem})`);
        await chips.getByRole('button', { name: 'Todas' }).click();
        check(await hasta(async () => (await p.locator('.registro-meta .registro-antes').count()) >= 1) && /^La vez anterior \(\d+ \w+\): /.test(await p.locator('.registro-antes').first().textContent()), '(2) en cada ejercicio, lo que hizo la vez anterior');
        check(/1RM \d/.test(await p.locator('.registro-meta').first().textContent()), '(3) y su 1RM estimado del día');
        check(/\d+ series?, [\d,]+ t/.test(await ses.locator('.registro-cifras').textContent()), `(4) la sesión, con sus series y sus toneladas («${(await ses.locator('.registro-cifras').textContent()).trim()}»)`);
        check(await p.locator('.registro-cifras', { hasText: /De \d\d:\d\d a \d\d:\d\d \(\d+ min\)/ }).count() >= 1, '(8) y su hora de inicio, de fin y lo que duró');
        check(await p.locator('.registro-meta', { hasText: /Descanso \d+:\d\d/ }).count() >= 1, '(8) el descanso que hizo de verdad');
        check(await p.locator('.serie-ficha').count() >= 3 && (await p.locator('.serie-ficha[class*="esf-"]').count()) === (await p.locator('.serie-ficha').count()), 'las fichas de color siguen ahí');
        // Su próxima sesión
        const mas = p.getByRole('button', { name: /^Subir 2,5 kg .* en su próxima sesión$/ }).first();
        await mas.click();
        check(await hasta(async () => (await p.locator('.toast', { hasText: '→' }).count()) >= 1 || (await p.locator('.toast', { hasText: 'No tiene' }).count()) >= 1), '(9) «+2,5» cambia la carga de su próxima sesión (o dice que no la tiene)');
        // Su historial
        await p.getByRole('button', { name: 'Su historial' }).first().click();
        const hist = p.locator('.hoja-dialogo').last();
        check(await hasta(async () => await hist.isVisible()), '(9) «Su historial» abre el de ese ejercicio');
        await p.keyboard.press('Escape');
        await hist.waitFor({ state: 'hidden' }).catch(() => {});
        // Sin revisar
        const sr = p.getByRole('button', { name: /^Sin revisar \(\d+\)$/ });
        await sr.click();
        check(await hasta(async () => (await p.locator('.registro-sesion:not(.por-revisar)').count()) === 0), '(10) «Sin revisar» deja solo las que faltan por revisar');
        await sr.click();
        const bien = p.getByRole('button', { name: /^Decirle «Bien hecho» por / }).first();
        if (await bien.count()) {
          await bien.click();
          check(await hasta(async () => (await p.locator('.registro-sesion .chip', { hasText: '«Bien hecho» enviado' }).count()) >= 1), '(10) «Bien hecho» desde el registro');
        } else check(await p.locator('.registro-sesion .chip', { hasText: 'Ya le has escrito' }).count() >= 1, '(10) donde ya le escribiste, lo dice');
      }
      await revisar(`registro-${ancho}`);

      // ---------------------------------------------------------------- Actividad
      await p.getByRole('tab', { name: 'Actividad' }).first().click();
      await p.locator('.actividad-item').first().waitFor({ timeout: 10000 });
      if (primera) {
        const cab = p.locator('.actividad-cabecera');
        check(await cab.count() === 1 && /Último entreno/.test(await cab.textContent()) && await cab.locator('.act-mapa i').count() === 30, '(19) arriba, de un vistazo: su último entreno, esta semana, su racha, su check-in y sus 30 días');
        check(await p.locator('.act-dia, .actividad-item.act-dia').count() >= 1 && /hábito|kcal|pasos|sueño|plan/.test(await p.locator('.actividad-item.act-dia').first().textContent()), '(11) su día, en una línea');
        check(await p.locator('.actividad-hora').count() >= 1 && /^\d\d:\d\d$/.test(await p.locator('.actividad-hora').first().textContent()), '(13) la hora de cada cosa');
        // Filtros y buscar
        await p.getByRole('group', { name: 'Qué ver' }).getByRole('button', { name: 'Comidas y hábitos' }).click();
        check(await hasta(async () => (await p.locator('.actividad-item').count()) >= 1 && (await p.locator('.actividad-item:not(.act-dia)').count()) === 0), '(20) filtro «Comidas y hábitos»');
        await p.getByRole('group', { name: 'Qué ver' }).getByRole('button', { name: 'Todo' }).click();
        await p.getByRole('searchbox', { name: 'Buscar por ejercicio' }).fill('sentadilla');
        check(await hasta(async () => (await p.locator('.actividad-item').count()) >= 1 && (await p.locator('.actividad-item.act-checkin').count()) === 0), '(20) buscar por ejercicio');
        await p.getByRole('searchbox', { name: 'Buscar por ejercicio' }).fill('');
        // Ver la sesión ahí mismo
        const ver = p.getByRole('button', { name: 'Ver las series' }).first();
        await ver.click();
        check(await hasta(async () => (await p.locator('.actividad-series .serie-ficha').count()) >= 1), '(15) «Ver las series»: la sesión ahí mismo, en fichas de color');
        await revisar('actividad-series');
        // Contestarle
        const resp = p.getByRole('button', { name: 'Responder' }).first();
        if (await resp.count()) {
          await resp.click();
          const caja = p.locator('.actividad-respuesta textarea');
          await caja.fill('Lo vemos en la revisión');
          await p.locator('.actividad-respuesta').getByRole('button', { name: 'Enviar' }).click();
          check(await hasta(async () => (await p.locator('.actividad-kudos.hecho', { hasText: 'Contestado' }).count()) >= 1), '(16) «Responder» le contesta desde la misma tarjeta');
        }
        // Felicitar un check-in
        const gracias = p.getByRole('button', { name: 'Darle las gracias por el check-in' }).first();
        if (await gracias.count()) {
          await gracias.click();
          check(await hasta(async () => (await p.locator('.actividad-kudos.hecho', { hasText: 'Agradecido' }).count()) >= 1), '(18) «Gracias» a un check-in');
        }
        // Otras frases
        const otras = p.getByRole('button', { name: 'Otras frases para felicitarle' }).first();
        if (await otras.count()) {
          await otras.click();
          check(await p.getByRole('group', { name: 'Otras frases' }).first().getByRole('button').count() >= 3, '(18) y otras frases para felicitarle');
        }
        // Lo nuevo: la segunda vez, nada nuevo (se apuntó la visita)
        const clave = await p.evaluate(() => Object.keys(localStorage).find((k) => k.startsWith('fbe-actividad-vista:')));
        check(!!clave, '(17) se apunta tu visita para saber lo nuevo la próxima vez');
        await p.evaluate((k) => localStorage.setItem(k, String(Date.parse(new Date(Date.now() - 3 * 864e5).toISOString()))), clave);
        await p.getByRole('tab', { name: 'Registro' }).first().click();
        await p.getByRole('tab', { name: 'Actividad' }).first().click();
        await p.locator('.actividad-item').first().waitFor();
        check(await hasta(async () => (await p.locator('.chip-nuevo').count()) >= 1) && await p.locator('.actividad-visto', { hasText: 'Hasta aquí lo viste' }).count() === 1, '(17) lo de después de tu última visita, «Nuevo», y la raya «Hasta aquí lo viste»');
        // Ir justo a cada cosa: una sesión, a su sitio en Registro
        const sesion = p.locator('.actividad-item.act-sesion').first();
        const nombre = (await sesion.locator('.actividad-titulo').textContent()).replace(/^Hizo /, '').replace(/\d\d:\d\d.*$/, '').replace(/Nuevo$/, '').trim();
        await sesion.click();
        check(await hasta(async () => await p.locator('.registro-sesion.enfocada').count() === 1 && (await p.locator('.registro-sesion.enfocada .registro-titulo').textContent()).includes(nombre)), `(14) tocar una sesión lleva a esa sesión en Registro (${nombre})`);
        await p.getByRole('tab', { name: 'Actividad' }).first().click();
        await p.locator('.actividad-item').first().waitFor();
        const ck = p.locator('.actividad-item.act-checkin').first();
        if (await ck.count()) {
          await ck.click();
          check(await hasta(async () => (await p.getByRole('dialog').count()) >= 1 && /check-in|Check-in|Semana/.test(await p.getByRole('dialog').last().textContent())), '(14) y un check-in, a ese check-in abierto');
          await p.keyboard.press('Escape');
        }
      }
      if (!primera) { await p.getByRole('button', { name: 'Ver las series' }).first().click(); await p.locator('.actividad-series').first().waitFor(); }
      await revisar(`actividad-${ancho}`);
      check(errores.length === 0, `Registro y Actividad a ${ancho} px en ${tema === 'dark' ? 'oscuro' : 'claro'}, sin errores ni problemas de accesibilidad${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
    } finally { await ctx.close(); }
  }

  // ---------------------------------------------------------------- Lo que no hizo (Iván: días sin entrenar)
  errores.length = 0;
  const ctx = await contexto();
  try {
    p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(`${base}/?demo`);
    await p.locator('button.persona', { hasText: 'Pelayo' }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await p.locator('nav.tabs .tab', { hasText: 'Atletas' }).first().click();
    const ivan = p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Iván' }).first();
    if (await ivan.count()) {
      await ivan.click();
      await p.getByRole('tab', { name: 'Actividad' }).first().click();
      await p.locator('.actividad-item').first().waitFor({ timeout: 10000 });
      await p.getByRole('group', { name: 'Qué ver' }).getByRole('button', { name: 'Lo que no hizo' }).click();
      check(await hasta(async () => (await p.locator('.actividad-item.act-paron, .actividad-item.act-saltada').count()) >= 1) && /días sin entrenar|No hizo/.test(await p.locator('.actividad-item').first().textContent()), '(12) «Lo que no hizo»: los días seguidos sin entrenar');
      await revisar('no-hizo');
    }
    check(errores.length === 0, `«Lo que no hizo», sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4195);
  const navegador = await chromium.launch();
  console.log('Registro y Actividad del atleta (v0.205)');
  try { await probarRegistro205({ navegador, check, base: 'http://localhost:4195' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n')[0]); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
