// v0.180: la segunda tanda de las notas de voz (en la demo, a 390 px, con el micro de prueba de Chromium). Lo llama
// e2e.test.mjs y se puede lanzar suelto (node test/e2e-voz-180.mjs, con dist/ ya construido):
//   · Ajustes → Mensajes: «Micrófono» con su estado (Sin activar, Activado, Bloqueado) y su botón (activar, probar, cómo);
//   · con el micro bloqueado, el botón del chat lo avisa («!») y lleva a los pasos;
//   · grabando: la barra del límite; en pausa, «Escuchar lo grabado» sin parar, y se puede seguir y enviar;
//   · si no se oye nada, la nota no sale sola y se avisa;
//   · con «Escuchar las notas de voz antes de enviarlas», al soltar no sale: se revisa;
//   · al sonar una nota, los mandos de la pantalla de bloqueo llevan su título; y al grabar, se calla la que sonaba.
import { irAAjustes } from './secciones.mjs';

export async function probarVoz180({ navegador, check, base = 'http://localhost:4174' }) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true });
  await ctx.grantPermissions(['microphone']);
  await ctx.addInitScript(() => {
    window.__permisoMicro = 'prompt';
    window.__mudo = false;
    try {
      const orig = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (d) => (d?.name === 'microphone' ? Promise.resolve({ state: window.__permisoMicro }) : orig(d));
    } catch { /* */ }
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__pistas = [];
    navigator.mediaDevices.getUserMedia = async (c) => {
      if (window.__permisoMicro === 'denied') { const e = new Error('denegado'); e.name = 'NotAllowedError'; throw e; }
      const s = await gum(c); window.__pistas.push(...s.getTracks()); window.__permisoMicro = 'granted'; return s;
    };
    // Un micro que no oye nada (tapado o silenciado): la onda, plana
    const A = globalThis.AnalyserNode?.prototype;
    if (A) { const o = A.getByteTimeDomainData; A.getByteTimeDomainData = function (b) { if (window.__mudo) b.fill(128); else o.call(this, b); }; }
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  const demo = () => p.evaluate(() => JSON.parse(localStorage.getItem('fbe-demo-v2')));
  const nVoz = async () => (await demo()).archivos.filter((a) => a.tipo === 'audio').length;
  const esperaVoz = (n) => p.waitForFunction((k) => (JSON.parse(localStorage.getItem('fbe-demo-v2')).archivos || []).filter((a) => a.tipo === 'audio').length === k, n, { timeout: 10000 }).catch(() => {});
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
  const tocar = async () => { const [cx, cy] = await centro(); await p.mouse.move(cx, cy); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); };
  const alChat = async () => { await p.locator('.tab', { hasText: 'Mensajes' }).first().click(); await micro.waitFor({ timeout: 15000 }); };
  try {
    await p.goto(`${base}/?demo`);
    await p.locator('button.persona', { hasText: 'Ana López' }).click();
    await p.locator('nav.tabs').waitFor();
    await cerrarAvisos();

    // ---- Ajustes → Mensajes → Micrófono
    await irAAjustes(p);
    const grupo = p.locator('section[aria-labelledby="grupo-mensajes"], section:has(> #grupo-mensajes)').first();
    await grupo.waitFor({ timeout: 10000 });
    await grupo.scrollIntoViewIfNeeded();
    const fila = grupo;
    check(/sin activar/.test(await fila.textContent()) && await fila.getByRole('button', { name: 'Activar el micro' }).count() === 1, 'en Ajustes → Mensajes, «Micrófono»: Sin activar, con el botón «Activar el micro»');
    await fila.getByRole('button', { name: 'Activar el micro' }).click();
    const activar = p.getByRole('dialog', { name: 'Activar el micro' });
    await activar.getByRole('button', { name: 'Activar el micro' }).click();
    await activar.getByRole('meter', { name: 'Nivel del micro' }).waitFor({ timeout: 8000 });
    await activar.getByRole('button', { name: 'Listo' }).waitFor({ timeout: 9000 });
    await activar.getByRole('button', { name: 'Listo' }).click();
    await activar.waitFor({ state: 'detached' });
    await p.waitForFunction(() => /Micrófono: activado/.test(document.querySelector('#grupo-mensajes')?.parentElement?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    check(/Micrófono: activado/.test(await fila.textContent()) && await fila.getByRole('button', { name: 'Probar el micro' }).count() === 1 && await micSuelto(), 'tras activarlo: «Activado», con «Probar el micro» (y el micro, suelto)');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'cabe a 390 px');
    // Bloqueado: lo dice y enseña cómo
    await p.evaluate(() => { window.__permisoMicro = 'denied'; window.dispatchEvent(new Event('fbe-micro')); });
    await p.waitForFunction(() => /Micrófono: bloqueado/.test(document.querySelector('#grupo-mensajes')?.parentElement?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    check(/Micrófono: bloqueado/.test(await fila.textContent()) && await fila.getByRole('button', { name: 'Cómo activarlo' }).count() === 1, 'si el micro está bloqueado: «Bloqueado», con «Cómo activarlo»');
    await fila.getByRole('button', { name: 'Cómo activarlo' }).click();
    const ayuda = p.getByRole('dialog', { name: 'Activar el micro' });
    check(await ayuda.locator('ol.ayuda-micro li').count() >= 3, 'y sus pasos');
    await ayuda.getByRole('button', { name: 'Entendido' }).click();
    await ayuda.waitFor({ state: 'detached' });
    // «Escuchar antes de enviar»
    const conmutador = grupo.getByRole('switch', { name: 'Escuchar las notas de voz antes de enviarlas' });
    check(await conmutador.count() === 1 && !(await conmutador.isChecked()), 'y el ajuste «Escuchar las notas de voz antes de enviarlas», apagado de serie');
    await conmutador.check();
    await cerrarAvisos();

    // ---- En el chat, con el micro bloqueado: el botón lo avisa
    await alChat();
    await p.locator('.chat-micro.sin-permiso').waitFor({ timeout: 8000 }).catch(() => {});
    check(await p.locator('.chat-micro.sin-permiso .chat-micro-aviso').count() === 1 && /bloqueado/.test(await micro.getAttribute('aria-label')), 'con el micro bloqueado, el botón del chat lo avisa («!»)');
    await micro.focus(); await p.keyboard.press('Enter');
    await p.getByRole('dialog', { name: 'Activar el micro' }).getByRole('button', { name: 'Entendido' }).click();
    await p.evaluate(() => { window.__permisoMicro = 'granted'; window.dispatchEvent(new Event('fbe-micro')); });
    await p.locator('.chat-micro.sin-permiso').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    check(await p.locator('.chat-micro.sin-permiso').count() === 0, 'y al desbloquearlo, el aviso se va solo');

    // ---- «Escuchar antes de enviar» encendido: al soltar, se revisa
    let n = await nVoz();
    let [cx, cy] = await centro();
    await p.mouse.move(cx, cy); await p.mouse.down();
    await grabando.waitFor();
    await grabando.locator('.chat-grabando-progreso').waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
    check(await grabando.locator('.chat-grabando-progreso').count() === 1, 'grabando: la barra del límite');
    await p.waitForTimeout(1600);
    await p.mouse.up();
    await revisar.waitFor({ timeout: 8000 });
    check(await nVoz() === n, 'con «Escuchar antes de enviar», al soltar no sale: queda para escucharla');
    await revisar.getByRole('button', { name: 'Eliminar la nota de voz' }).click();
    await revisar.waitFor({ state: 'detached' });
    await revisar.waitFor({ state: 'detached' }).catch(() => {});
    await irAAjustes(p);
    await grupo.scrollIntoViewIfNeeded();
    await conmutador.uncheck();
    await cerrarAvisos();
    await alChat();
    await p.waitForTimeout(800);

    // ---- En pausa: escuchar lo grabado sin parar, seguir y enviar
    await tocar();
    await p.getByRole('button', { name: 'Pausar la grabación' }).waitFor({ timeout: 8000 });
    await p.waitForTimeout(1500);
    await p.getByRole('button', { name: 'Pausar la grabación' }).click();
    await p.getByRole('button', { name: 'Escuchar lo grabado' }).click();
    await grabando.locator('audio[src^="blob:"]').waitFor({ state: 'attached', timeout: 8000 });
    check(await grabando.getByRole('button', { name: 'Seguir grabando' }).count() === 1 && await grabando.getByRole('button', { name: /^Escuchar la nota de voz/ }).count() === 1
      && await p.evaluate(() => window.__pistas.some((t) => t.readyState === 'live')), 'en pausa, «Escuchar lo grabado» lo enseña para oírlo sin parar la grabación (el micro sigue abierto)');
    await grabando.getByRole('button', { name: /^Escuchar la nota de voz/ }).click();
    const suena = await grabando.locator('.voz.sonando').waitFor({ timeout: 8000 }).then(() => true, () => false);
    check(suena, 'y suena');
    await grabando.getByRole('button', { name: 'Seguir grabando' }).click();
    await p.getByRole('button', { name: 'Pausar la grabación' }).waitFor({ timeout: 8000 });
    await p.waitForTimeout(1300);
    n = await nVoz();
    await grabando.getByRole('button', { name: 'Enviar la nota de voz' }).click();
    await esperaVoz(n + 1);
    const f = (await demo()).archivos.filter((a) => a.tipo === 'audio').at(-1);
    check(await nVoz() === n + 1 && f.duracion_seg >= 2 && f.duracion_seg <= 4 && await micSuelto(), `después se sigue grabando y se envía entera (${f?.duracion_seg} s)`);

    // ---- No se oye nada: no sale sola
    await p.evaluate(() => { window.__mudo = true; });
    n = await nVoz();
    [cx, cy] = await centro();
    await p.mouse.move(cx, cy); await p.mouse.down();
    await grabando.waitFor();
    await p.waitForTimeout(1800);
    await p.mouse.up();
    await revisar.waitFor({ timeout: 8000 });
    check(/No se oye nada/.test(await revisar.textContent()) && await nVoz() === n, 'si no se oye nada (micro tapado o silenciado), la nota no sale sola: «No se oye nada en la grabación»');
    await revisar.getByRole('button', { name: 'Eliminar la nota de voz' }).click();
    await p.evaluate(() => { window.__mudo = false; });

    // ---- Al sonar: los mandos de la pantalla de bloqueo; y al grabar, se calla
    const burbuja = p.locator('.burbuja.mia.con-voz').last();
    await burbuja.locator('.voz-play').waitFor({ timeout: 10000 });
    await burbuja.locator('.voz-play').click();
    await burbuja.locator('.voz.sonando').waitFor({ timeout: 10000 });
    check(await p.evaluate(() => navigator.mediaSession?.metadata?.title || '') === 'Nota de voz', 'al sonar una nota, la pantalla de bloqueo y los auriculares llevan su título y sus mandos');
    await tocar();
    await p.getByRole('button', { name: 'Pausar la grabación' }).waitFor({ timeout: 8000 });
    check(await burbuja.locator('.voz.sonando').count() === 0 && await p.evaluate(() => !navigator.mediaSession?.metadata), 'y al empezar a grabar, la nota que sonaba se calla');
    await p.getByRole('button', { name: 'Eliminar la grabación' }).click();
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Notas de voz, segunda tanda (v0.180): ${e.message.split('\n').slice(0, 4).join(' / ')}`);
  } finally { await ctx.close(); }
}

// Suelto: node test/e2e-voz-180.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4184);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarVoz180({ navegador, check, base: 'http://localhost:4184' });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
