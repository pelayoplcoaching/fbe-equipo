// El perfil del atleta, tanda 4, T4 (rama perfil-4), en la demo y en un móvil de 390 px:
//   · tus atajos (tres, arriba) · tu descanso y tus pasos (Datos, con Salud conectada)
//   · tu privacidad de un vistazo y «Así te ve tu coach» · tu correo, cerrar en todos y tu último acceso
//   · tus datos en una hoja de cálculo (CSV)
//   Suelta:  npm run build && node test/e2e-perfil4-t4.mjs
import { pathToFileURL } from 'node:url';
import { entrarPerfil, axeEn } from './e2e-perfil4-t1.mjs';

export async function probarPerfil4T4({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid', bypassCSP: true, acceptDownloads: true });
  try {
    const p = await entrarPerfil(ctx, 'Ana López', base, errores);
    // 16. Tus atajos
    const atajos = p.getByRole('navigation', { name: 'Tus atajos' });
    await atajos.waitFor({ timeout: 8000 });
    check((await atajos.locator('.atajo-perfil').allTextContents()).map((t) => t.trim()).join('|') === 'Check-in|Progreso|Mensajes|Cambiar', 'tus atajos: check-in, progreso y mensajes (y «Cambiar»)');
    await atajos.getByRole('button', { name: 'Elegir tus atajos' }).click();
    let h = p.getByRole('dialog', { name: 'Tus atajos' });
    await h.waitFor();
    await h.getByRole('button', { name: /Mensajes/ }).click();
    await h.getByRole('button', { name: /Tu carné/ }).click();
    check(await h.getByRole('button', { name: /Equipo/ }).isDisabled(), 'con tres elegidos, no caben más');
    await axeEn(p, '[role=dialog]', errores, 'atajos');
    await h.getByRole('button', { name: 'Listo' }).click();
    await h.waitFor({ state: 'detached' });
    check((await atajos.locator('.atajo-perfil').allTextContents()).map((t) => t.trim()).join('|') === 'Check-in|Progreso|Tu carné|Cambiar', 'y se cambian (se guardan en este móvil)');
    await atajos.getByRole('button', { name: 'Progreso' }).click();
    await p.locator('nav.tabs [aria-current="page"], nav.tabs .activa').first().waitFor({ timeout: 3000 }).catch(() => {});
    check(await p.locator('.perfil-cabeza').count() === 0, 'un atajo lleva a su sitio (Progreso)');
    const { irASeccion } = await import('./secciones.mjs');
    await irASeccion(p, 'Perfil');
    await p.locator('.perfil-cabeza').waitFor();
    // 12. Tu descanso y tus pasos (Ana tiene Salud conectada en la demo)
    const pest = p.locator('.perfil-pestanas');
    await pest.scrollIntoViewIfNeeded();
    await pest.getByRole('tab', { name: 'Datos' }).click();
    const dp = p.locator('.descanso-pasos');
    if (await dp.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) {
      check(/Sueño, de media/.test(await dp.textContent()) || /Pasos al día/.test(await dp.textContent()), `tu descanso y tus pasos: ${(await dp.locator('.dp-dato b').allTextContents()).join(' y ')}`);
      await axeEn(p, '.descanso-pasos', errores, 'descanso');
    } else check(false, 'tu descanso y tus pasos no sale (Ana tiene Salud conectada en la demo)');
    // 17. Privacidad de un vistazo (desde la v0.166, la cuenta está en «Ajustes»)
    const { irAAjustes } = await import('./secciones.mjs');
    await irAAjustes(p);
    const cuenta = p.locator('section[aria-labelledby="grupo-cuenta"]');
    await cuenta.locator('[aria-label="Tu privacidad, de un vistazo"]').scrollIntoViewIfNeeded();
    await cuenta.locator('[aria-label="Tu privacidad, de un vistazo"]').click();
    h = p.getByRole('dialog', { name: 'Tu privacidad' });
    await h.waitFor();
    await h.locator('.privacidad-lista').first().waitFor();
    check(await h.getByRole('heading', { name: /Lo que ve tu coach/ }).count() === 1 && await h.getByRole('heading', { name: /Lo que ve el equipo/ }).count() === 1 && await h.getByRole('heading', { name: /Lo que se queda en tu móvil/ }).count() === 1, 'tu privacidad: lo que ve tu coach, el equipo y lo que se queda en tu móvil');
    check(/Salud del iPhone/.test(await h.textContent()), 'con Salud conectada, lo dice');
    // La hoja entra con su animación: el contraste se mide cuando ha terminado (en CI, a veces se medía a mitad)
    await p.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 1500))]));
    await axeEn(p, '[role=dialog]', errores, 'privacidad');
    await h.getByRole('button', { name: 'Así te ve tu coach' }).click();
    const asi = p.getByRole('dialog', { name: 'Así te ve tu coach' });
    await asi.waitFor();
    check(/Ana López/.test(await asi.textContent()) && /rincón de ánimo no lo ve/.test(await asi.textContent()), '«Así te ve tu coach»');
    await p.keyboard.press('Escape'); await asi.waitFor({ state: 'detached' }).catch(() => {});
    await p.keyboard.press('Escape'); await h.waitFor({ state: 'detached' }).catch(() => {});
    // 18. Último acceso, cambiar el correo
    const todos = cuenta.locator('[aria-label="Cerrar sesión en todos tus dispositivos"]');
    await todos.scrollIntoViewIfNeeded();
    check(/Tu último inicio de sesión: \d/.test(await todos.textContent()), `tu último acceso: «${(await todos.locator('.peq').textContent()).trim()}»`);
    await cuenta.locator('[aria-label="Cambiar el correo"]').click();
    h = p.getByRole('dialog', { name: 'Cambiar el correo' });
    await h.waitFor();
    await h.getByRole('textbox', { name: 'Correo nuevo' }).fill('no-vale');
    await h.getByRole('button', { name: 'Cambiar el correo' }).click();
    check(await h.getByRole('textbox', { name: 'Correo nuevo' }).evaluate((x) => !x.validity.valid), 'un correo que no vale, no');
    await h.getByRole('textbox', { name: 'Correo nuevo' }).fill('ana.nueva@fbe.demo');
    await axeEn(p, '[role=dialog]', errores, 'correo');
    await h.getByRole('button', { name: 'Cambiar el correo' }).click();
    await h.waitFor({ state: 'detached', timeout: 5000 });
    check(/ana\.nueva@fbe\.demo/.test(await cuenta.locator('[aria-label="Cambiar el correo"]').textContent()), 'cambia el correo (en la demo, sin enlace)');
    // 19. La hoja de cálculo
    await cuenta.locator('[aria-label="Tus datos en una hoja de cálculo"]').click();
    h = p.getByRole('dialog', { name: 'Tus datos en una hoja de cálculo' });
    await h.waitFor();
    const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), h.getByRole('button', { name: 'Tus series' }).click()]);
    const ruta = await descarga.path();
    const { readFileSync } = await import('node:fs');
    const texto = readFileSync(ruta, 'utf8');
    check(/^fbe-series-\d{4}-\d{2}-\d{2}\.csv$/.test(descarga.suggestedFilename()) && texto.startsWith('﻿Fecha;Ejercicio;Kg;Repeticiones;RPE') && texto.split('\r\n').length > 5, `tus series en CSV (${texto.split('\r\n').length - 2} filas)`);
    await p.keyboard.press('Escape'); await h.waitFor({ state: 'detached' }).catch(() => {});
    // 18. Cerrar en todos (al final: sale)
    await todos.click();
    h = p.getByRole('dialog', { name: 'Cerrar sesión en todos' });
    await h.waitFor();
    await h.getByRole('button', { name: 'Cerrar sesión en todos' }).click();
    check(await p.locator('button.persona').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false), 'cerrar sesión en todos: vuelve a la entrada');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= 390), 'nada se sale a 390 px');
  } catch (e) {
    check(false, `la T4 del perfil no se ha podido recorrer: ${e.message.split('\n')[0]}`);
  }
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nEl perfil, tanda 4, T4');
  try { await probarPerfil4T4({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
