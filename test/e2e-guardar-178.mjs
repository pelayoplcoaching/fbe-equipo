// v0.178: «Guardar en mi móvil» para el vídeo grabado con la cámara de la app (en la demo, a 390 px, con la cámara de prueba de
// Chromium). Lo llama e2e.test.mjs y se puede lanzar suelto (node test/e2e-guardar-178.mjs, con dist/ ya construido):
//   · tras grabar con guía y «Usar este vídeo», la hoja ofrece «Guardar en mi móvil» y dice que no queda en sus fotos;
//   · al tocarlo, el vídeo grabado va al menú de compartir del móvil (aquí, uno de prueba que apunta lo que recibe);
//   · con un vídeo elegido de la galería, el botón no sale (ya está en el móvil).
import { readFileSync } from 'node:fs';
import { subProgreso } from './secciones.mjs';

const VIDEO = readFileSync(new URL('./video-quieto-mueve.webm', import.meta.url));

export async function probarGuardar178({ navegador, check, base = 'http://localhost:4174' }) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true });
  await ctx.grantPermissions(['camera', 'microphone']);
  await ctx.addInitScript(() => {
    window.__compartido = [];
    navigator.canShare = (d) => !!d?.files?.length;
    navigator.share = async (d) => { window.__compartido.push((d.files || []).map((f) => ({ nombre: f.name, tipo: f.type, bytes: f.size }))); };
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  const cerrarAvisos = async () => {
    for (let i = 0; i < 5; i++) {
      await p.waitForTimeout(350);
      if (!(await p.locator('[role=dialog]').last().isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  try {
    await p.goto(`${base}/?demo`);
    await p.locator('button.persona', { hasText: 'Ana López' }).click();
    await p.locator('nav.tabs').waitFor();
    await cerrarAvisos();
    await p.locator('.tab', { hasText: 'Progreso' }).first().click();
    await subProgreso(p, 'fuerza');
    await p.locator('.diario').getByRole('button', { name: 'Subir vídeo' }).click();
    const hs = p.getByRole('dialog', { name: 'Subir un vídeo' });
    await hs.getByRole('button', { name: 'Elegir o grabar el vídeo' }).click();
    await p.getByRole('button', { name: 'Grabar con guía' }).click();
    const cam = p.locator('.camara-video');
    await cam.locator('.camara-cab').waitFor();
    await p.waitForFunction(() => { const v = document.querySelector('.camara-video video'); return v && v.readyState >= 1; }, null, { timeout: 10000 });
    await cam.locator('.camara-disparo').click();
    await cam.getByRole('button', { name: 'Parar la grabación' }).waitFor({ timeout: 20000 });
    await p.waitForTimeout(1500);
    await cam.getByRole('button', { name: 'Parar la grabación' }).click();
    await cam.getByRole('button', { name: 'Usar este vídeo' }).click();
    const boton = p.getByRole('button', { name: 'Guardar en mi móvil' });
    await boton.waitFor({ timeout: 10000 });
    check(/no queda en tus fotos/.test(await p.locator('.guardar-movil').textContent()), 'tras grabar con la cámara de la app, «Guardar en mi móvil» (y dice que lo grabado no queda en sus fotos)');
    await boton.click();
    await p.waitForFunction(() => window.__compartido.length === 1, null, { timeout: 5000 }).catch(() => {});
    const c = await p.evaluate(() => window.__compartido);
    check(c.length === 1 && c[0].length === 1 && /^grabacion-\d+\./.test(c[0][0].nombre) && /^video\//.test(c[0][0].tipo) && c[0][0].bytes > 0, `al tocarlo, el vídeo grabado va al menú de compartir del móvil (${c[0]?.[0]?.tipo || 'nada'}, ${c[0]?.[0]?.bytes || 0} bytes)`);
    check(await p.getByRole('button', { name: /Enviar/ }).first().isVisible(), 'y sigue en la hoja, listo para enviarlo a su coach');
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'cabe a 390 px');
    // De la galería: no hace falta
    for (let i = 0; i < 4 && await p.locator('[role=dialog]').count(); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    await p.locator('.diario').getByRole('button', { name: 'Subir vídeo' }).click();
    await p.getByRole('dialog', { name: 'Subir un vídeo' }).locator('input[type=file][aria-label="Elegir vídeo"]').setInputFiles({ name: 'serie.webm', mimeType: 'video/webm', buffer: VIDEO });
    await p.getByLabel('¿Qué quieres que mire?').waitFor({ timeout: 10000 });
    check(await p.getByRole('button', { name: 'Guardar en mi móvil' }).count() === 0, 'con un vídeo elegido de la galería, el botón no sale');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Guardar en mi móvil (v0.178): ${e.message.split('\n').slice(0, 4).join(' / ')}`);
  } finally { await ctx.close(); }
}

// Suelto: node test/e2e-guardar-178.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4179);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarGuardar178({ navegador, check, base: 'http://localhost:4179' });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
