// Música 3, tanda 4 (para el coach y fuera de Spotify, migración 072), en la demo y en un móvil simulado:
//   · su biblioteca de música (con etiquetas, energía y bpm; con buscador) y, en el editor, «De tu biblioteca» a un toque
//   · «Qué música funciona»
//   · YouTube de primera: su portada y su reproductor (youtube-nocookie)
//   Suelta:  npm run build && node test/e2e-musica3-t4.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarMusica3Coach } = await import('./e2e-musica3-t4.mjs'); await probarMusica3Coach({ navegador, check });
import { pathToFileURL } from 'node:url';
import { simularSpotify } from './e2e-musica3-t1.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

export async function probarMusica3Coach({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  await simularSpotify(ctx);
  await ctx.route(/^https:\/\/i\.ytimg\.com\//, (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await ctx.route(/^https:\/\/www\.youtube-nocookie\.com\//, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body>youtube</body>' }));
  const { irASeccion } = await import('./secciones.mjs');
  const fuera = async (q) => {
    for (let i = 0; i < 5; i++) {
      await q.waitForTimeout(350);
      const d = q.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await q.keyboard.press('Escape');
    }
  };
  const entrar = async (nombre) => {
    const q = await ctx.newPage();
    q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(`${base}/?demo`);
    const b = q.locator('button.persona', { hasText: nombre }).first();
    await Promise.race([b.waitFor({ timeout: 8000 }), q.locator('nav.tabs').waitFor({ timeout: 8000 })]).catch(() => {});
    for (let i = 0; i < 5 && !(await b.isVisible().catch(() => false)); i++) {
      await fuera(q);
      await q.getByRole('button', { name: 'Cambiar de cuenta' }).first().click({ timeout: 4000 }).catch(() => {});
      await q.waitForTimeout(500);
    }
    await b.click();
    await q.locator('nav.tabs').waitFor();
    await fuera(q);
    return q;
  };
  const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  try {
    const c = await entrar('Pelayo');
    await irASeccion(c, 'Cuenta');
    const bib = c.locator('.biblioteca-musica');
    await bib.waitFor({ timeout: 8000 });
    await bib.scrollIntoViewIfNeeded();
    const anadir = async ({ url, etiquetas, energia = null, bpm = null }) => {
      await bib.getByRole('button', { name: 'Añadir' }).click();
      const h = c.getByRole('dialog', { name: 'Añadir a tu biblioteca' });
      await h.getByLabel('Enlace').fill(url);
      await h.getByLabel(/Etiquetas/).fill(etiquetas);
      if (energia) await h.getByRole('group', { name: 'Energía' }).getByRole('button', { name: energia }).click();
      if (bpm) await h.getByLabel('bpm aprox.').fill(String(bpm));
      await h.getByRole('button', { name: 'Guardar' }).click();
      await h.waitFor({ state: 'detached' });
    };
    await anadir({ url: 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP', etiquetas: 'pierna, calentar', energia: 'A tope', bpm: 128 });
    await anadir({ url: YT, etiquetas: 'calma' });
    await bib.locator('.biblioteca-fila').nth(1).waitFor({ timeout: 5000 });
    const txt = await bib.textContent();
    check(await bib.locator('.biblioteca-fila').count() === 2 && /A tope · 128 bpm · pierna, calentar/.test(txt), 'su biblioteca: dos listas, con su energía, su bpm y sus etiquetas');
    const uso = c.locator('.uso-musica');
    check(await uso.count() === 1 && /sesiones? hechas? del equipo con música/.test(await uso.textContent()), '«Qué música funciona»: las sesiones del equipo con música y sus listas más abiertas');
    // el editor: «De tu biblioteca», a un toque
    await c.locator('.tab', { hasText: 'Atletas' }).click();
    await c.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
    await c.getByRole('tab', { name: 'Programa' }).first().click();
    const campo = c.locator('.editor-sesion .campo-musica').first();
    await campo.waitFor({ timeout: 8000 });
    await campo.scrollIntoViewIfNeeded();
    await campo.click();
    const hm = c.getByRole('dialog').last();
    const deBib = hm.locator('.de-tu-biblioteca');
    await deBib.waitFor({ timeout: 5000 });
    check(await deBib.locator('button').count() === 2, 'al enlazar la música de una sesión, «De tu biblioteca»');
    await deBib.locator('button').first().click();
    await hm.waitFor({ state: 'detached' });
    await c.locator('.editor-sesion .campo-musica', { hasText: 'Música de la sesión' }).first().waitFor({ timeout: 5000 });
    check(true, 'y con un toque queda puesta en la sesión');
    await c.waitForTimeout(400); await c.close();
    // --- YouTube de primera ---
    const a = await entrar('Ana López');
    await irASeccion(a, 'Perfil');
    const grupo = a.locator('section[aria-labelledby="grupo-lo-tuyo"]');
    await grupo.waitFor({ timeout: 8000 });
    await grupo.scrollIntoViewIfNeeded();
    await grupo.getByRole('button', { name: 'Poner el enlace a tu música' }).click();
    const hl = a.getByRole('dialog').last();
    await hl.getByLabel(/Enlace/).first().fill(YT);
    await hl.getByRole('button', { name: /Guardar/ }).click();
    await hl.waitFor({ state: 'detached' });
    await irASeccion(a, 'Hoy');
    await fuera(a);
    for (let i = 0; i < 4; i++) {
      if (await a.locator('.hero-dia .btn-hero').click({ timeout: 4000 }).then(() => true).catch(() => false)) break;
      await fuera(a);
    }
    const musica = a.locator('section.musica-sesion');
    await musica.waitFor({ timeout: 8000 });
    const mas = musica.getByRole('button', { name: /Otra opción|opciones más/ });
    if (await mas.count()) await mas.click();
    const yt = musica.locator('.tarjeta-musica', { hasText: 'YouTube' }).first();
    await yt.waitFor({ timeout: 5000 });
    check(await yt.locator('img.tarjeta-musica-portada').count() === 1, 'una tarjeta de YouTube, con la portada del vídeo');
    await yt.getByRole('button', { name: 'Escuchar aquí' }).click();
    const src = await yt.locator('iframe').getAttribute('src');
    check(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?playsinline=1/.test(src || ''), 'y su reproductor en la app (youtube-nocookie, como los vídeos de técnica)');
    check(await a.evaluate(() => document.documentElement.scrollWidth <= 390), 'nada se sale a 390 px');
    await a.close();
  } catch (e) {
    check(false, `la tanda 4 de música no se ha podido recorrer: ${e.message.split('\n')[0]}`);
  }
  check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nMúsica 3, tanda 4: para el coach y fuera de Spotify');
  try { await probarMusica3Coach({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
