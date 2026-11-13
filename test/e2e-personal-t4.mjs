// Personalización 2, tanda 4 (que sea suyo y que al coach le llegue personal), en la demo y en un móvil simulado: su
// foto de motivación (se queda en el móvil) en «Lo tuyo» y en la portada de la sesión; y en la ficha del coach, «Para
// hablarle» y la carta del mes, que se manda como un mensaje.
//   Suelta:  npm run build && node test/e2e-personal-t4.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPersonalSuyo } = await import('./e2e-personal-t4.mjs'); await probarPersonalSuyo({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

// Un PNG de 8×8 morado (para la foto, sin archivos de nadie)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGNgYGD4z4AFMAJ9AAH/AAG2AQVYAAAAAElFTkSuQmCC', 'base64');

export async function probarPersonalSuyo({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const fueraAvisos = async (q = p) => {
    for (let i = 0; i < 4; i++) {
      await q.waitForTimeout(300);
      const d = q.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await q.keyboard.press('Escape');
    }
  };
  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();

    // --- «Lo tuyo»: su foto de motivación ---
    await irASeccion(p, 'Perfil');
    const grupo = p.locator('section[aria-labelledby="grupo-lo-tuyo"]');
    await grupo.waitFor({ timeout: 8000 });
    await grupo.scrollIntoViewIfNeeded();
    await grupo.getByRole('button', { name: 'Elegir tu foto de motivación' }).click();
    const hoja = p.getByRole('dialog', { name: 'Tu foto de motivación' });
    await hoja.waitFor();
    check(/no se sube/.test(await hoja.textContent()), 'la hoja dice que la foto no sale del móvil');
    await hoja.getByLabel('Elegir tu foto de motivación').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
    await hoja.locator('.foto-motivacion-vista').waitFor({ timeout: 8000 });
    const guardada = await p.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('fbe-foto-motivacion:') && localStorage.getItem(k).startsWith('data:image/jpeg')));
    check(guardada, 'guardada en el móvil (reducida, en JPEG)');
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });
    check(/En este móvil/.test(await grupo.textContent()), 'la fila: «En este móvil»');
    check(await p.locator('.adn-fbe').count() === 0, '«Tu ADN FBE», todavía no (Ana lleva menos de 12 sesiones)');

    // --- La portada, con su foto ---
    await irASeccion(p, 'Hoy');
    await p.locator('.hero-dia .btn-hero').click();
    const foto = p.locator('.foto-motivacion.en-portada');
    await foto.waitFor({ timeout: 6000 });
    check(await foto.locator('img').count() === 1, 'en la portada de la sesión, su foto');
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');

    // --- El coach: «Para hablarle» y la carta del mes ---
    const q = await ctx.newPage();
    q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(`${base}/?demo`);
    const pel = q.locator('button.persona', { hasText: 'Pelayo' }).first();
    await Promise.race([pel.waitFor({ timeout: 8000 }), q.locator('nav.tabs').waitFor({ timeout: 8000 })]).catch(() => {});
    // (la demo recuerda la cuenta de Ana: se cambia, cerrando antes lo que salga encima, que puede tardar)
    for (let i = 0; i < 4 && !(await pel.isVisible().catch(() => false)); i++) {
      await fueraAvisos(q);
      await q.getByRole('button', { name: 'Cambiar de cuenta' }).first().click({ timeout: 4000 }).catch(() => {});
      await q.waitForTimeout(500);
    }
    await pel.click();
    await q.locator('nav.tabs').waitFor();
    await fueraAvisos(q);
    await q.locator('.tab', { hasText: 'Atletas' }).click();
    await q.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
    await q.getByRole('tab', { name: 'Objetivos' }).click();
    const ph = q.locator('section.para-hablarle');
    await ph.waitFor({ timeout: 8000 });
    const t = await ph.textContent();
    check(/Cómo le llamamos/.test(t) && /Cómo le hablamos/.test(t) && /Le escribiste/.test(t) && /Idea:/.test(t), '«Para hablarle»: cómo le llamamos y le hablamos, cuándo le escribiste y una idea');
    await ph.getByRole('button', { name: /^La carta de / }).click();
    const carta = q.getByRole('dialog', { name: /^La carta de / });
    await carta.waitFor();
    const borrador = await carta.locator('textarea').inputValue();
    check(/^¡Hola, Ana!/.test(borrador) && /sesi/.test(borrador), `un borrador con su nombre y sus sesiones («${borrador.split('\n')[2]?.slice(0, 50) || ''}…»)`);
    await carta.getByRole('button', { name: 'Directo' }).click();
    check(/^Ana:/.test(await carta.locator('textarea').inputValue()), 'al cambiar el tono, cambia el borrador');
    await carta.getByRole('button', { name: /^Enviar a / }).click();
    await carta.waitFor({ state: 'detached' });
    await q.locator('.toast', { hasText: 'Carta enviada' }).waitFor({ timeout: 5000 });
    check(true, 'enviada como un mensaje del coach');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Personalización (suyo): ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nQue sea suyo');
  try { await probarPersonalSuyo({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
