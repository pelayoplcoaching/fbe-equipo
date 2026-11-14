// Música 3, tanda 1 (la música durante la sesión, sin migración), en la demo y en un móvil simulado, con Spotify simulado
// (su ficha, su portada y un reproductor de pega que cuenta su estado y apunta las órdenes que recibe):
//   · la voz del coach pausa el reproductor de la app que suena y luego lo reanuda (y no toca uno parado)
//   · «Abrir en la app de Spotify» (se recuerda en el móvil)
//   · «Pon tu canción» en el ejercicio que toca (prioridad alta, sin series)
//   · en el cardio: la cadencia por tramos (con los tramos de la carrera del coach si los hay) y «¿A cuántos bpm va lo
//     que suena?»
//   Suelta:  npm run build && node test/e2e-musica3-t1.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarMusica3Sesion } = await import('./e2e-musica3-t1.mjs'); await probarMusica3Sesion({ navegador, check });
import { pathToFileURL } from 'node:url';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
// El reproductor de pega: dice que suena y apunta lo que le mandan (y lo cuenta como el de verdad)
const REPRODUCTOR = `<!doctype html><html><body style="margin:0;background:#222;color:#fff;font:12px sans-serif">reproductor
<script>
  window.ordenes = [];
  let parado = location.search.includes('parado');
  const contar = () => parent.postMessage({ type: 'playback_update', payload: { isPaused: parado, isBuffering: false, duration: 180000, position: 1000 } }, '*');
  addEventListener('message', (e) => { const c = e.data && e.data.command; if (!c) return; ordenes.push(c); if (c === 'pause') parado = true; if (c === 'resume') parado = false; contar(); });
  parent.postMessage({ type: 'ready' }, '*');
  setTimeout(contar, 50);
</script></body></html>`;

export async function simularSpotify(ctx) {
  await ctx.route(/^https:\/\/open\.spotify\.com\/oembed/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ title: 'Eye of the Tiger', thumbnail_url: 'https://i.scdn.co/image/portada' }), headers: { 'access-control-allow-origin': '*' } }));
  await ctx.route(/^https:\/\/open\.spotify\.com\/embed\//, (r) => r.fulfill({ contentType: 'text/html', body: REPRODUCTOR }));
  await ctx.route(/^https:\/\/i\.scdn\.co\//, (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
}

export async function probarMusica3Sesion({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  await simularSpotify(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  const fueraAvisos = async (q = p) => {
    for (let i = 0; i < 5; i++) {
      await q.waitForTimeout(350);
      const d = q.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await q.keyboard.press('Escape');
    }
  };
  const { irASeccion } = await import('./secciones.mjs');
  try {
    await p.goto(`${base}/?demo`);
    await p.locator('button.persona', { hasText: 'Ana López' }).click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    // --- «Lo tuyo»: su lista y su canción de récord ---
    await irASeccion(p, 'Perfil');
    const grupo = p.locator('section[aria-labelledby="grupo-lo-tuyo"]');
    await grupo.waitFor({ timeout: 8000 });
    for (const [boton, campo, url] of [['Elegir tu canción de récord', 'Enlace a la canción', 'https://open.spotify.com/track/2HHtWyy5CgaQbC7XSoOb0e'], [/música/, /Enlace/, 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP']]) {
      await grupo.scrollIntoViewIfNeeded();
      await grupo.getByRole('button', { name: boton }).first().click();
      const h = p.getByRole('dialog').last();
      await h.getByLabel(campo).first().fill(url);
      await h.getByRole('button', { name: /Guardar/ }).click();
      await h.waitFor({ state: 'detached' });
    }
    check(true, 'en «Lo tuyo», su lista y su canción de récord');
    // --- la portada: el reproductor y la voz del coach ---
    await irASeccion(p, 'Hoy');
    await fueraAvisos();
    for (let i = 0; i < 4; i++) {
      if (await p.locator('.hero-dia .btn-hero').click({ timeout: 4000 }).then(() => true).catch(() => false)) break;
      await fueraAvisos();
    }
    const musica = p.locator('section.musica-sesion');
    await musica.waitFor({ timeout: 8000 });
    check(await musica.locator('.abrir-en-app input[type=checkbox]').count() === 1, '«Abrir en la app de Spotify», en la música de hoy');
    await musica.locator('.abrir-en-app input').check();
    check(await p.evaluate(() => localStorage.getItem('fbe-musica-app')) === '1', 'y se recuerda en el móvil');
    await musica.getByRole('button', { name: 'Escuchar aquí' }).first().click();
    const marco = musica.locator('iframe.reproductor-spotify');
    await marco.waitFor();
    await p.waitForTimeout(400);
    const repro = p.frames().find((f) => /open\.spotify\.com\/embed\//.test(f.url()));
    check(!!repro, 'el reproductor de la app, cargado al tocar «Escuchar aquí»');
    await p.evaluate(() => dispatchEvent(new CustomEvent('fbe-sonido', { detail: { tipo: 'voz:record', segundos: 0.4 } })));
    await p.waitForTimeout(200);
    check((await repro.evaluate(() => window.ordenes)).join() === 'pause', 'al sonar la voz del coach, el reproductor que suena se pausa');
    await p.waitForTimeout(1200);
    check((await repro.evaluate(() => window.ordenes)).join() === 'pause,resume', 'y al acabar, sigue');
    // con el reproductor ya parado por el atleta, la voz no lo toca
    await repro.evaluate(() => { window.ordenes = []; });
    await repro.evaluate(() => parent.postMessage({ type: 'playback_update', payload: { isPaused: true } }, '*'));
    await p.waitForTimeout(150);
    await p.evaluate(() => dispatchEvent(new CustomEvent('fbe-sonido', { detail: { tipo: 'voz:mitad_sesion', segundos: 0.3 } })));
    await p.waitForTimeout(1100);
    check((await repro.evaluate(() => window.ordenes)).length === 0, 'si el atleta lo tenía parado, la voz no lo toca (ni lo arranca)');
    // otros sonidos (no la voz), tampoco
    await repro.evaluate(() => parent.postMessage({ type: 'playback_update', payload: { isPaused: false } }, '*'));
    await p.waitForTimeout(150);
    await p.evaluate(() => dispatchEvent(new CustomEvent('fbe-sonido', { detail: { tipo: 'pitido' } })));
    await p.waitForTimeout(300);
    check((await repro.evaluate(() => window.ordenes)).length === 0, 'los pitidos y demás sonidos de la app no lo pausan');
    // --- «Pon tu canción» en el ejercicio que toca ---
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.sesion-vista .ejercicio').first().waitFor();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const pon = p.locator('.pon-tu-cancion');
    await pon.first().waitFor({ timeout: 6000 }).catch(() => {});
    check(await pon.count() === 1 && /Pon tu canción: Eye of the Tiger/.test(await pon.first().textContent()), `«Pon tu canción» en el ejercicio que toca («${((await pon.first().textContent().catch(() => '')) || '').trim()}»)`);
    check(await pon.first().getAttribute('href') === 'https://open.spotify.com/track/2HHtWyy5CgaQbC7XSoOb0e', 'con el enlace de su canción');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= 390), 'nada se sale a 390 px (sesión)');
  } catch (e) {
    check(false, `la tanda 1 de música no se ha podido recorrer: ${e.message.split('\n')[0]}`);
  }

  // --- el cardio de Carlos: la cadencia por tramos y tocar al ritmo ---
  const q = await ctx.newPage();
  q.on('pageerror', (e) => errores.push(e.message));
  try {
    await q.goto(`${base}/?demo`);
    const carlos = q.locator('button.persona', { hasText: 'Carlos Vera' }).first();
    await Promise.race([carlos.waitFor({ timeout: 8000 }), q.locator('nav.tabs').waitFor({ timeout: 8000 })]).catch(() => {});
    for (let i = 0; i < 4 && !(await carlos.isVisible().catch(() => false)); i++) {
      await fueraAvisos(q);
      await q.getByRole('button', { name: 'Cambiar de cuenta' }).first().click({ timeout: 4000 }).catch(() => {});
      await q.waitForTimeout(500);
    }
    await carlos.click();
    await q.locator('nav.tabs').waitFor();
    await fueraAvisos(q);
    await irASeccion(q, 'Semana');
    await fueraAvisos(q);
    await q.locator('.dia', { hasText: 'Rodaje suave' }).first().click();
    await fueraAvisos(q);
    const emp = q.getByRole('button', { name: 'Empezar', exact: true });
    if (await emp.isVisible({ timeout: 4000 }).catch(() => false)) await emp.click();
    const cad = q.locator('.cadencia').first();
    await cad.waitFor({ timeout: 8000 });
    await cad.scrollIntoViewIfNeeded();
    await cad.getByRole('button', { name: 'Por tramos' }).click();
    check(await cad.locator('.cadencia-tramos-rejilla .cadencia-tramo-campo').count() === 5, 'la cadencia por tramos: trabajo, recuperación, sus cadencias y las rondas');
    await cad.getByRole('button', { name: 'Rondas: menos' }).click();
    check(/\d+:\d\d/.test(await cad.locator('.cadencia-tramos').textContent()), 'con la duración total');
    await cad.getByRole('button', { name: 'Empezar los tramos' }).click();
    await q.waitForTimeout(400);
    check(/Trabajo · ronda 1 de \d+/.test(await cad.locator('.cadencia-tramo-ahora').textContent()), `en marcha, el tramo de ahora («${(await cad.locator('.cadencia-tramo-ahora').textContent()).trim().slice(0, 60)}»)`);
    await cad.getByRole('button', { name: 'Parar' }).click();
    // tocar al ritmo: 6 toques cada 0,5 s → 120 bpm, más lenta que 170 pasos
    await cad.getByRole('button', { name: /A cuántos bpm va lo que suena/ }).click();
    const boton = cad.locator('.tocar-ritmo-boton');
    for (let i = 0; i < 6; i++) { await boton.click(); await q.waitForTimeout(500); }
    const r = (await cad.locator('.tocar-ritmo-r').textContent()).trim();
    check(/^1[12]\d bpm/.test(r) && /No encaja con tus 170 pasos\/min/.test(r), `«¿A cuántos bpm va lo que suena?» (${r.slice(0, 70)})`);
    check(await q.evaluate(() => document.documentElement.scrollWidth <= 390), 'nada se sale a 390 px (cardio)');
  } catch (e) {
    check(false, `el cardio no se ha podido recorrer: ${e.message.split('\n')[0]}`);
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
  console.log('\nMúsica 3, tanda 1: durante la sesión');
  try { await probarMusica3Sesion({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
