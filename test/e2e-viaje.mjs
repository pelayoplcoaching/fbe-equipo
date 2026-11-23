// (v0.143) De viaje por zona horaria, en la demo: Ana con el móvil en Ciudad de México.
//   · En Hoy, el aviso de viaje (qué hora es en cada sitio); con las notificaciones por email, a qué hora le llegaría la
//     de la sesión y «Ajustarlas a mi hora mientras viajo» (nada de noche allí); «Entendido» lo quita.
//   · En la sesión, «¿Dónde entrenas hoy?»: el material de viaje a un toque.
//   · De vuelta (el móvil en Madrid, con lo guardado): «Volver a como las tenía» las deja como estaban.
//   A 390 px, sin errores, desbordes ni fallos de accesibilidad.
//   Dentro de e2e.test.mjs:  const { probarViaje } = await import('./e2e-viaje.mjs'); await probarViaje({ navegador, check });
import { createRequire } from 'node:module';
import { irAAjustesPorEnlace } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

// (v0.206.1) Las horas de España y de Ciudad de México se separan 7 h en invierno y 8 h con el horario de verano de
// España (México ya no lo cambia): lo esperado se calcula con la diferencia de ese momento. Salió pasando la prueba el
// 28/3/2027, el día del cambio de hora.
function desfaseMexico() {
  const ahora = new Date();
  const enZona = (tz) => { const x = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(ahora).map((q) => [q.type, q.value])); return Date.UTC(+x.year, +x.month - 1, +x.day, +x.hour, +x.minute); };
  return Math.round((enZona('Europe/Madrid') - enZona('America/Mexico_City')) / 3600000);
}
const hh = (h, m = 0) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const bonita = (h) => h.replace(/^0(\d)/, '$1');

export async function probarViaje({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const opciones = { viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, hasTouch: true };
  let ctx = await navegador.newContext({ ...opciones, timezoneId: 'America/Mexico_City' });
  let p;
  const abrir = async (c) => {
    // (en la demo no hay notificaciones de verdad: se enciende la opción de email de config.js, como en una instalación con ella)
    await c.addInitScript(() => {
      let cfg;
      Object.defineProperty(window, 'FBE_CONFIG', { configurable: true, get: () => cfg, set: (v) => { cfg = { ...(v || {}), notificacionesEmail: true }; } });
    });
    p = await c.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|blob:/.test(m.text())) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  };
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir', 'Empezar']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const axe = async (paso) => {
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ]));
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > 390) errores.push(`${paso}: la página se desborda en horizontal (${ancho} px)`);
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations
      .filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (r.length) errores.push(`${paso}: ${r.join(' · ')}`);
  };
  const entrar = async () => {
    await p.goto(`${base}/?demo`);
    await p.locator('nav.tabs, button.persona').first().waitFor();
    if (await p.locator('button.persona').count()) await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    // La portada de carga (el lobo) tapa la app hasta que se va: con la máquina cargada tarda, y un toque con force
    // caía en ella y no hacía nada
    await p.waitForFunction(() => !document.getElementById('portada'));
    await cerrarDialogos();
  };
  const hojaNotificaciones = async () => {
    await p.waitForTimeout(400);
    await irAAjustesPorEnlace(p);
    await p.locator('.fila-notificaciones').waitFor();
    await p.locator('.fila-notificaciones').getByRole('button', { name: /^Notificaciones/ }).click();
    const h = p.getByRole('dialog', { name: 'Notificaciones' });
    await h.waitFor();
    return h;
  };
  try {
    await abrir(ctx);
    await entrar();
    const aviso = p.locator('.aviso-viaje');
    await aviso.waitFor({ timeout: 15000 });
    const tit = await aviso.locator('h2').textContent();
    let D = desfaseMexico();
    check(/^De viaje: en Ciudad de México son las \d{1,2}:\d\d$/.test(tit) && (await aviso.textContent()).includes(`${D} h menos que en España`) && await aviso.getByRole('button', { name: /Ajustarlas a mi hora/ }).count() === 0,
      `en Ciudad de México, Hoy lo dice: «${tit}», ${D} h menos que en España (sin notificaciones activadas, no habla de ellas)`);
    // Con las notificaciones por email: a qué hora le llegarían y el «no molestar» para la noche de allí
    let hoja = await hojaNotificaciones();
    await hoja.getByRole('switch', { name: /Si no las tengo activadas/ }).check();
    await p.waitForTimeout(300);
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });
    await entrar();
    await aviso.waitFor();
    await aviso.getByRole('button', { name: 'Ajustarlas a mi hora mientras viajo' }).waitFor();
    D = desfaseMexico();
    const llegaria = bonita(hh(8 - D, 30));
    check((await aviso.textContent()).includes(`la de la sesión (8:30 allí) te llegaría a las ${llegaria} de aquí`), `con las notificaciones activadas: la de la sesión (8:30 en España) le llegaría a la ${llegaria} de allí`);
    await axe('aviso-viaje');
    await aviso.getByRole('button', { name: 'Ajustarlas a mi hora mientras viajo' }).click();
    await aviso.locator('.aviso-viaje-ok').waitFor();
    const ok = await aviso.locator('.aviso-viaje-ok').textContent();
    // (la de la tarde, a las 23:30 de España como mucho: 16:30 de allí en invierno, 15:30 en verano)
    const tardeAqui = bonita(hh(23 - D, 30));
    check(/Sin notificaciones de 23:00 a 7:00 de aquí/.test(ok) && /La de la sesión de hoy: apagada mientras viajas/.test(ok) && ok.includes(`a las ${tardeAqui} de aquí`), `ajustadas: sin nada de noche aquí; la de la sesión, apagada (en México saldría de noche); las de la tarde, a las ${tardeAqui} de allí`);
    hoja = await hojaNotificaciones();
    const [desde, hasta] = [hh(23 + D), hh(7 + D)];
    check(await hoja.locator('#nt-desde').inputValue() === desde && await hoja.locator('#nt-hasta').inputValue() === hasta && await hoja.locator('#nt-tarde').inputValue() === '23:30' && !(await hoja.getByRole('switch', { name: /^Sesión de hoy/ }).isChecked()),
      `en sus notificaciones: el «no molestar», de ${bonita(desde)} a ${bonita(hasta)} de España; la tarde, a las 23:30; la de la sesión, apagada`);
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });
    await p.evaluate(() => { location.hash = '#hoy'; });
    await aviso.waitFor();
    await aviso.getByRole('button', { name: 'Entendido' }).click();
    await aviso.waitFor({ state: 'detached' });
    await entrar();
    await p.locator('.diales .dial').first().waitFor();
    await p.waitForTimeout(500);
    check(await p.locator('.aviso-viaje').count() === 0, '«Entendido»: no vuelve a salir en este viaje');
    // En la sesión: el material de viaje a un toque
    await p.getByRole('button', { name: 'Empezar sesión' }).click({ force: true });
    await p.locator('.portada-sesion, .sesion-vista').first().waitFor();
    if (await p.locator('.portada-sesion').count() && !(await p.locator('.donde-entrenas').count())) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    const donde = p.locator('.donde-entrenas');
    await donde.waitFor();
    await cerrarDialogos();
    await donde.getByRole('button', { name: 'Estás de viaje: entrenar con tu material de viaje' }).click();
    await p.waitForFunction(() => document.querySelector('.donde-entrenas .segmentos button[aria-pressed="true"], .donde-entrenas .segmentos [aria-checked="true"]')?.textContent.includes('Viaje'), null, { timeout: 5000 }).catch(() => {});
    check(await donde.getByRole('button', { name: /Estás de viaje/ }).count() === 0 && /Viaje/.test(await donde.locator('.segmentos [aria-pressed="true"], .segmentos [aria-checked="true"]').first().textContent().catch(() => '')),
      'en la sesión, de viaje: el material de viaje a un toque');
    await axe('sesion-viaje');
    // De vuelta: el móvil en Madrid (con lo guardado en este móvil)
    const estado = await ctx.storageState();
    await ctx.close();
    ctx = await navegador.newContext({ ...opciones, timezoneId: 'Europe/Madrid', storageState: estado });
    await abrir(ctx);
    await entrar();
    const vuelta = p.locator('.aviso-viaje');
    await vuelta.waitFor({ timeout: 15000 });
    check((await vuelta.locator('h2').textContent()) === 'De vuelta en hora de España', 'de vuelta en Madrid: ofrece dejar las notificaciones como estaban');
    await vuelta.getByRole('button', { name: 'Volver a como las tenía' }).click();
    await vuelta.waitFor({ state: 'detached' });
    hoja = await hojaNotificaciones();
    check(await hoja.locator('#nt-desde').inputValue() === '22:30' && await hoja.locator('#nt-hasta').inputValue() === '08:00' && await hoja.locator('#nt-tarde').inputValue() === '21:00' && await hoja.getByRole('switch', { name: /^Sesión de hoy/ }).isChecked(),
      'y las deja como estaban (el «no molestar», la hora de la tarde y la de la sesión, encendida)');
    await p.keyboard.press('Escape');
    check(!errores.length, `de viaje, sin errores, desbordes ni fallos de accesibilidad${errores.length ? `: ${errores.slice(0, 4).join(' | ')}` : ''}`);
  } finally {
    await ctx.close();
  }
}
