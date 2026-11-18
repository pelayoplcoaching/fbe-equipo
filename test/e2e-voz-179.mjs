// v0.179: las notas de voz del chat, como WhatsApp (en la demo, a 390 px, con el micro de prueba de Chromium). Lo llama
// e2e.test.mjs y se puede lanzar suelto (node test/e2e-voz-179.mjs, con dist/ ya construido):
//   · el permiso: la primera vez (el sistema pregunta) no se graba a ciegas, se dice que el micro ya está listo; si está
//     bloqueado, sale «Activar el micro» con los pasos; y si el aviso del sistema se lleva el toque, no se queda colgada;
//   · mantener y SOLTAR envía la nota (sin pasar por la revisión);
//   · tocar: graba sin el dedo, con papelera, pausar y seguir (el tiempo no corre en pausa), escucharla y enviar;
//   · al salir de la app mientras se graba, lo grabado queda para escucharlo; y lo grabado sin enviar se conserva al
//     cambiar de pantalla;
//   · al acabar una nota suena la siguiente; solo suena una a la vez; la nota recuerda por dónde se dejó;
//   · con un enlace caducado, se pide otro y suena.
export async function probarVoz179({ navegador, check, base = 'http://localhost:4174' }) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true });
  await ctx.grantPermissions(['microphone']);
  await ctx.addInitScript(() => {
    // Lo que «dice el navegador» del permiso del micro (la prueba lo cambia) y cuánto tarda en llegar el micro
    window.__permisoMicro = 'granted';
    window.__esperaMicro = 0;
    try {
      const orig = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (d) => (d?.name === 'microphone' ? Promise.resolve({ state: window.__permisoMicro }) : orig(d));
    } catch { /* */ }
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__pistas = [];
    navigator.mediaDevices.getUserMedia = async (c) => {
      if (window.__permisoMicro === 'denied') { const e = new Error('denegado'); e.name = 'NotAllowedError'; throw e; }
      if (window.__esperaMicro) await new Promise((r) => setTimeout(r, window.__esperaMicro));
      const s = await gum(c); window.__pistas.push(...s.getTracks()); return s;
    };
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  const demo = () => p.evaluate(() => JSON.parse(localStorage.getItem('fbe-demo-v2')));
  const nVoz = async () => (await demo()).archivos.filter((a) => a.tipo === 'audio').length;
  const cerrarAvisos = async () => {
    for (let i = 0; i < 5; i++) {
      await p.waitForTimeout(350);
      if (!(await p.locator('[role=dialog]').last().isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const micro = p.getByRole('button', { name: /^Grabar una nota de voz/ });
  const grabando = p.getByRole('group', { name: 'Grabando una nota de voz' });
  const revisar = p.getByRole('group', { name: 'Nota de voz grabada' });
  const centro = async () => { const c = await micro.boundingBox(); return [c.x + c.width / 2, c.y + c.height / 2]; };
  const micSuelto = () => p.evaluate(() => window.__pistas.every((t) => t.readyState === 'ended'));
  try {
    await p.goto(`${base}/?demo`);
    await p.locator('button.persona', { hasText: 'Ana López' }).click();
    await p.locator('nav.tabs').waitFor();
    await cerrarAvisos();
    await p.locator('.tab', { hasText: 'Mensajes' }).first().click();
    await micro.waitFor({ timeout: 15000 });
    await p.waitForFunction(() => /hasta 2 minutos/.test(document.querySelector('.chat-micro')?.getAttribute('aria-label') || ''), null, { timeout: 8000 }).catch(() => {});
    check(/hasta 2 minutos/.test(await micro.getAttribute('aria-label')), 'el micro dice el límite nuevo: hasta 2 minutos (con la 081)');

    // ---- El permiso
    // La primera vez (el sistema pregunta): no graba a ciegas; (v0.180) sale la hoja «Activar el micro», con su prueba
    await p.evaluate(() => { window.__permisoMicro = 'prompt'; });
    let [cx, cy] = await centro();
    const antes = await nVoz();
    await p.mouse.move(cx, cy); await p.mouse.down();
    const activar = p.getByRole('dialog', { name: 'Activar el micro' });
    await activar.waitFor({ timeout: 8000 });
    await p.mouse.up();
    check(await grabando.count() === 0 && await revisar.count() === 0 && await p.evaluate(() => window.__pistas.length === 0) && await nVoz() === antes, 'la primera vez (el sistema va a preguntar por el micro) no se graba a ciegas: sale «Activar el micro», sin abrir aún el micro');
    await activar.getByRole('button', { name: 'Activar el micro' }).click();
    await activar.getByRole('meter', { name: 'Nivel del micro' }).waitFor({ timeout: 8000 });
    check(/Micro activado/.test(await activar.textContent()) && /Di algo/.test(await activar.textContent()), '(v0.180) al tocar el botón se activa y se prueba: «Micro activado. Di algo para probarlo», con su medidor');
    await activar.getByRole('button', { name: 'Listo' }).waitFor({ timeout: 9000 });
    check(/se te oye|se oye/i.test(await activar.textContent()) && await micSuelto() && await p.evaluate(() => localStorage.getItem('fbe-micro-activado') === '1'), 'a los 4 segundos dice cómo se oye, suelta el micro y lo recuerda en este aparato');
    await activar.getByRole('button', { name: 'Listo' }).click();
    await activar.waitFor({ state: 'detached' });
    // Y si el navegador sigue diciendo «preguntar» después de darlo (no lo recuerda), a la segunda ya graba
    await p.locator('.toast').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await micro.focus(); await p.keyboard.press('Enter');
    await p.getByRole('button', { name: 'Parar y escucharla' }).waitFor({ timeout: 8000 }).catch(() => {});
    check(await grabando.count() === 1 && await p.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Parar y escucharla', 'a la segunda, aunque el navegador siga diciendo «preguntar», ya graba (y con el teclado, el foco va a «Parar y escucharla»)');
    await p.getByRole('button', { name: 'Eliminar la grabación' }).click();
    await grabando.waitFor({ state: 'detached' });
    // Bloqueado: los pasos para activarlo
    await p.evaluate(() => { window.__permisoMicro = 'denied'; });
    await p.locator('.toast').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await micro.focus(); await p.keyboard.press('Enter');
    const ayuda = p.getByRole('dialog', { name: 'Activar el micro' });
    await ayuda.waitFor({ timeout: 8000 });
    check(await ayuda.locator('ol.ayuda-micro li').count() >= 3 && /bloqueado/.test(await ayuda.textContent()), 'con el micro bloqueado, «Activar el micro»: los pasos para ese aparato (en vez de un error sin más)');
    await ayuda.getByRole('button', { name: 'Entendido' }).click();
    await ayuda.waitFor({ state: 'detached' });
    check(await grabando.count() === 0, 'y no se queda nada grabando');
    // El micro tarda y el dedo ya se ha ido (lo soltó): no se queda colgada
    await p.evaluate(() => { window.__permisoMicro = 'granted'; window.__esperaMicro = 900; });
    [cx, cy] = await centro();
    await p.mouse.move(cx, cy); await p.mouse.down();
    await p.waitForTimeout(450);
    await p.mouse.up();
    await p.locator('.toast', { hasText: 'Mantén pulsado el micro' }).waitFor({ timeout: 8000 });
    check(await grabando.count() === 0 && await micSuelto(), 'si se suelta antes de que llegue el micro, no se queda grabando sola: «Mantén pulsado el micro mientras hablas»');
    await p.evaluate(() => { window.__esperaMicro = 0; });
    await p.locator('.toast').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});

    // ---- Mantener y soltar: se envía
    const n0 = await nVoz();
    [cx, cy] = await centro();
    await p.mouse.move(cx, cy); await p.mouse.down();
    await grabando.waitFor();
    await p.locator('.chat-candado').waitFor({ timeout: 5000 }).catch(() => {});
    check(await p.locator('.chat-candado').count() === 1 && /Desliza para cancelar/.test(await grabando.textContent()), 'manteniendo: el candado encima del micro y «‹ Desliza para cancelar»');
    await p.waitForTimeout(1800);
    await p.mouse.up();
    await p.waitForFunction((n) => (JSON.parse(localStorage.getItem('fbe-demo-v2')).archivos || []).filter((a) => a.tipo === 'audio').length === n + 1, n0, { timeout: 10000 }).catch(() => {});
    check(await nVoz() === n0 + 1 && await revisar.count() === 0 && await micSuelto(), 'al soltar, la nota se envía (sin pasar por la revisión) y el micro se suelta');
    const f1 = (await demo()).archivos.filter((a) => a.tipo === 'audio').at(-1);
    check(f1.duracion_seg >= 1 && f1.duracion_seg <= 3 && f1.onda?.length === 40, `con su duración (${f1.duracion_seg} s) y su onda`);

    // ---- Tocar: sin el dedo, con pausa
    [cx, cy] = await centro();
    await p.mouse.move(cx, cy); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up();
    await p.getByRole('button', { name: 'Pausar la grabación' }).waitFor({ timeout: 8000 });
    check(await p.getByRole('button', { name: 'Eliminar la grabación' }).count() === 1 && await p.getByRole('button', { name: 'Parar y escucharla' }).count() === 1
      && await grabando.getByRole('button', { name: 'Enviar la nota de voz' }).count() === 1 && await micro.count() === 0, 'un toque: graba sin el dedo, con papelera, pausar, escucharla y enviar');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'cabe a 390 px');
    await p.waitForTimeout(1200);
    await p.getByRole('button', { name: 'Pausar la grabación' }).click();
    await p.getByRole('button', { name: 'Seguir grabando' }).waitFor();
    const t1 = (await grabando.locator('.chat-grabando-tiempo').textContent()).trim();
    await p.waitForTimeout(1600);
    const t2 = (await grabando.locator('.chat-grabando-tiempo').textContent()).trim();
    check(t1 === t2 && /En pausa/.test(await grabando.textContent()), `en pausa el tiempo no corre (${t1})`);
    await p.getByRole('button', { name: 'Seguir grabando' }).click();
    await p.getByRole('button', { name: 'Pausar la grabación' }).waitFor();
    await p.waitForTimeout(1300);
    const n1 = await nVoz();
    await grabando.getByRole('button', { name: 'Enviar la nota de voz' }).click();
    await p.waitForFunction((n) => (JSON.parse(localStorage.getItem('fbe-demo-v2')).archivos || []).filter((a) => a.tipo === 'audio').length === n + 1, n1, { timeout: 10000 }).catch(() => {});
    const f2 = (await demo()).archivos.filter((a) => a.tipo === 'audio').at(-1);
    check(await nVoz() === n1 + 1 && f2.duracion_seg >= 2 && f2.duracion_seg <= 4, `se sigue grabando y «Enviar» la manda: dura lo grabado, sin la pausa (${f2?.duracion_seg} s)`);

    // ---- Salir de la app mientras se graba: lo grabado se queda; y el borrador se conserva al cambiar de pantalla
    [cx, cy] = await centro();
    await p.mouse.move(cx, cy); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up();
    await p.getByRole('button', { name: 'Pausar la grabación' }).waitFor({ timeout: 8000 });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await revisar.waitFor({ timeout: 8000 });
    await p.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    check(/Has salido de la app/.test(await revisar.textContent()) && await micSuelto(), 'al salir de la app mientras se graba, se para y lo grabado queda para escucharlo («Has salido de la app…»)');
    await p.locator('.tab', { hasText: 'Hoy' }).first().click();
    await p.waitForTimeout(600);
    await cerrarAvisos();
    await p.locator('.tab', { hasText: 'Mensajes' }).first().click();
    await revisar.waitFor({ timeout: 10000 }).catch(() => {});
    check(await revisar.count() === 1, 'y lo grabado sin enviar sigue ahí al cambiar de pantalla y volver');
    const n2 = await nVoz();
    await revisar.getByRole('button', { name: 'Enviar la nota de voz' }).click();
    await p.waitForFunction((n) => (JSON.parse(localStorage.getItem('fbe-demo-v2')).archivos || []).filter((a) => a.tipo === 'audio').length === n + 1, n2, { timeout: 10000 }).catch(() => {});
    check(await nVoz() === n2 + 1 && await revisar.count() === 0, 'se envía desde la revisión');

    // Cambiar de pantalla MIENTRAS se graba: lo grabado queda de borrador (y al volver, el foco no va a «Enviar»)
    [cx, cy] = await centro();
    await p.mouse.move(cx, cy); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up();
    await p.getByRole('button', { name: 'Pausar la grabación' }).waitFor({ timeout: 8000 });
    await p.waitForTimeout(1500);
    await p.locator('.tab', { hasText: 'Hoy' }).first().click();
    await p.waitForTimeout(700);
    check(await micSuelto(), 'al cambiar de pantalla mientras se graba, el micro se suelta');
    await cerrarAvisos();
    await p.locator('.tab', { hasText: 'Mensajes' }).first().click();
    await revisar.waitFor({ timeout: 10000 }).catch(() => {});
    check(await revisar.count() === 1 && await p.evaluate(() => document.activeElement?.getAttribute('aria-label')) !== 'Enviar la nota de voz', 'y lo grabado está al volver, sin el foco en «Enviar» (un Enter no la manda sin querer)');
    await revisar.getByRole('button', { name: 'Eliminar la nota de voz' }).click();
    await revisar.waitFor({ state: 'detached' });

    // ---- Reproducir: una a la vez, la siguiente sola, y por dónde se dejó
    const burbujas = p.locator('.burbuja.mia.con-voz');
    await p.waitForFunction(() => document.querySelectorAll('.burbuja.mia.con-voz .voz-play').length >= 3, null, { timeout: 15000 }).catch(() => {});
    const total = await burbujas.count();
    const b1 = burbujas.nth(total - 3), b2 = burbujas.nth(total - 2), b3 = burbujas.nth(total - 1);
    await b2.locator('.voz-play').click();
    await b2.locator('.voz.sonando').waitFor({ timeout: 10000 });
    await b3.locator('.voz-play').click();
    await b3.locator('.voz.sonando').waitFor({ timeout: 10000 });
    check(await b2.locator('.voz.sonando').count() === 0, 'solo suena una nota a la vez: al empezar otra, la anterior se pausa');
    await b3.locator('.voz-play').click();
    await p.waitForTimeout(300);
    // La primera de las tres: al acabar, suena la segunda sola
    await b1.locator('.voz-play').click();
    await b1.locator('.voz.sonando').waitFor({ timeout: 10000 });
    await b2.locator('.voz.sonando').waitFor({ timeout: 15000 }).catch(() => {});
    check(await b2.locator('.voz.sonando').count() === 1 && await b1.locator('.voz.sonando').count() === 0, 'al acabar una nota, suena sola la siguiente (si va justo después)');
    await p.waitForTimeout(900);
    await b2.locator('.voz-play').click();
    const pos = await b2.locator('audio').evaluate((a) => a.currentTime);
    // Por dónde se dejó: se guarda y vuelve al reabrir el chat
    await p.locator('.tab', { hasText: 'Hoy' }).first().click();
    await p.waitForTimeout(500);
    await cerrarAvisos();
    await p.locator('.tab', { hasText: 'Mensajes' }).first().click();
    await p.waitForFunction(() => document.querySelectorAll('.burbuja.mia.con-voz .voz-play').length >= 3, null, { timeout: 15000 }).catch(() => {});
    const b2b = p.locator('.burbuja.mia.con-voz').nth(total - 2);
    const guardada = Number(await b2b.locator('.voz-barra').inputValue());
    check(pos > 0.3 && Math.abs(guardada - pos) < 0.6, `la nota recuerda por dónde se dejó al volver al chat (${pos.toFixed(1)} s → ${guardada.toFixed(1)} s)`);

    // ---- Un enlace caducado: se pide otro y suena
    const b3b = p.locator('.burbuja.mia.con-voz').nth(total - 1);
    await b3b.locator('.voz-play').click();
    await b3b.locator('audio').waitFor({ state: 'attached', timeout: 10000 });
    await b3b.locator('.voz.sonando').waitFor({ timeout: 10000 });
    const src0 = await b3b.locator('audio').getAttribute('src');
    await p.evaluate(() => { window.__pedidas = 0; });
    await b3b.locator('audio').evaluate((a) => { a.dispatchEvent(new Event('error')); });
    await p.waitForTimeout(1200);
    check(!/No se pudo/.test(await b3b.textContent()) && await b3b.locator('audio').evaluate((a) => !a.error), `si el enlace del audio falla mientras suena (caduca a la hora), se pide otro y sigue, sin error (${src0 ? 'con enlace' : 'sin enlace'})`);
    // Con la nota parada, mover la barra con un enlace caducado no la pone a sonar sola
    await b3b.locator('audio').evaluate((a) => a.pause());
    await p.waitForTimeout(300);
    await b3b.locator('audio').evaluate((a) => { a.dispatchEvent(new Event('error')); });
    await p.waitForTimeout(800);
    check(await b3b.locator('.voz.sonando').count() === 0, 'y con la nota parada, un fallo del enlace no la pone a sonar sola');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Notas de voz (v0.179): ${e.message.split('\n').slice(0, 4).join(' / ')}`);
  } finally { await ctx.close(); }
}

// Suelto: node test/e2e-voz-179.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4181);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarVoz179({ navegador, check, base: 'http://localhost:4181' });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
