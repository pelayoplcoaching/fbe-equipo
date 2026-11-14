// Personalización 3, tanda 8 (que le acompañe más allá de la app), en la demo y en un móvil simulado: el coach graba su
// voz para un mensaje (un audio subido); a Ana, su reto del mes en Hoy, su álbum en Perfil y «Busco compañero» al
// invitar a un compañero de racha.
//   Suelta:  npm run build && node test/e2e-personal-t8.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPersonalCompania } = await import('./e2e-personal-t8.mjs'); await probarPersonalCompania({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';
import { VERSION_COMUNIDAD } from '../web/src/datos/api.js';
import { VERSION_NORMAS } from '../web/src/datos/normas-comunidad.js';

// Un WAV de un segundo de silencio (sin archivos de nadie)
function wav(seg = 1, hz = 8000) {
  const n = seg * hz, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(hz, 24); b.writeUInt32LE(hz * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

export async function probarPersonalCompania({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const fueraAvisos = async (q = p) => {
    for (let i = 0; i < 5; i++) {
      await q.waitForTimeout(350);
      const d = q.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await q.keyboard.press('Escape');
    }
  };
  try {
    // --- El coach: su voz en el mensaje del récord ---
    await p.goto(`${base}/?demo`);
    await p.locator('button.persona', { hasText: 'Pelayo' }).click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    await irASeccion(p, 'Cuenta');
    const sec = p.locator('section.mensajes-automaticos');
    // (en la pasada completa, más lenta: si algo tapa o aún carga, se cierra y se vuelve a Cuenta)
    if (!(await sec.waitFor({ timeout: 8000 }).then(() => true, () => false))) { await fueraAvisos(); await irASeccion(p, 'Cuenta'); await sec.waitFor({ timeout: 15000 }); }
    await sec.scrollIntoViewIfNeeded();
    await sec.locator('button[data-m="record"]').click();
    const hoja = p.getByRole('dialog').last();
    await hoja.waitFor();
    if (!(await hoja.locator('.voz-mensaje').count())) {
      await hoja.getByRole('button', { name: 'Usar el de ejemplo' }).click().catch(() => {});
      await hoja.getByRole('button', { name: /Guardar/ }).first().click();
      await hoja.waitFor({ state: 'detached' });
      await sec.locator('button[data-m="record"]').click();
      await p.getByRole('dialog').last().waitFor();
    }
    const h2 = p.getByRole('dialog').last();
    await h2.locator('.voz-mensaje').waitFor({ timeout: 5000 });
    check(/Tu voz/.test(await h2.locator('.voz-mensaje').textContent()) && /hasta 2 minutos/.test(await h2.locator('.voz-mensaje').textContent()), 'con el mensaje guardado, «Tu voz» (hasta 2 minutos)');
    await h2.locator('.voz-mensaje input[type=file]').setInputFiles({ name: 'voz.wav', mimeType: 'audio/wav', buffer: wav(1) });
    await h2.getByRole('button', { name: 'Guardar tu voz' }).click();
    await p.locator('.toast', { hasText: 'Tu voz, guardada' }).waitFor({ timeout: 6000 });
    const m = (await p.evaluate(() => globalThis.__fbeDemo.rpc('mensajes_coach', {}))).find((x) => x.momento === 'record');
    check(/^voz\/[0-9a-f-]{36}\.wav$/.test(m?.audio_ruta || '') && m.audio_segundos === 1, 'su voz, guardada con el mensaje');

    // --- Ana: su reto, su álbum y «Busco compañero» ---
    const q = await ctx.newPage();
    q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(`${base}/?demo`);
    const ana = q.locator('button.persona', { hasText: 'Ana López' }).first();
    await Promise.race([ana.waitFor({ timeout: 8000 }), q.locator('nav.tabs').waitFor({ timeout: 8000 })]).catch(() => {});
    for (let i = 0; i < 4 && !(await ana.isVisible().catch(() => false)); i++) {
      await fueraAvisos(q);
      await q.getByRole('button', { name: 'Cambiar de cuenta' }).first().click({ timeout: 4000 }).catch(() => {});
      await q.waitForTimeout(500);
    }
    await ana.click();
    await q.locator('nav.tabs').waitFor();
    await fueraAvisos(q);
    const reto = q.locator('.reto-mes');
    await reto.waitFor({ timeout: 8000 }).catch(() => {});
    check(await reto.count() === 1 && /Tu reto de/.test(await reto.textContent()), `en Hoy, su reto del mes («${(await reto.locator('.reto-mes-t').textContent().catch(() => '')).trim()}»)`);
    await irASeccion(q, 'Perfil');
    const album = q.locator('.album-hitos');
    // (con la prueba completa, más lenta: si algo se ha puesto encima o aún carga, se cierra y se vuelve a Perfil)
    if (!(await album.waitFor({ timeout: 8000 }).then(() => true, () => false))) { await fueraAvisos(q); await irASeccion(q, 'Perfil'); await album.waitFor({ timeout: 12000 }); }
    check(/Tu primera sesión/.test(await album.textContent()), 'en Perfil, su álbum con sus primeras veces');
    await album.getByRole('button', { name: 'Añadir un hito tuyo' }).click();
    const hh = q.getByRole('dialog', { name: 'Un hito tuyo' });
    await hh.waitFor();
    await hh.getByLabel('Qué').fill('Mi primera media maratón');
    await hh.getByRole('button', { name: 'Añadir' }).click();
    await hh.waitFor({ state: 'detached' });
    await album.locator('li', { hasText: 'Mi primera media maratón' }).waitFor({ timeout: 5000 });
    check(true, 'añade un hito suyo al álbum');
    // «Busco compañero»
    await q.evaluate(([v, n]) => globalThis.__fbeDemo.rpc('comunidad_unirme', { p_nombre: 'Ana L.', p_version: v, p_normas: n }), [VERSION_COMUNIDAD, VERSION_NORMAS]).catch(() => {});
    const enCom = await q.evaluate(() => globalThis.__fbeDemo.rpc('comunidad_afines', {}).then((r) => r !== null).catch(() => false));
    if (enCom) {
      await q.evaluate(() => localStorage.setItem('fbe-equipo-abierta-companeros', 'true'));
      await irASeccion(q, 'Equipo');
      await fueraAvisos(q);
      const pleg = q.locator('details[data-plegable-eq="companeros"]');
      await pleg.waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
      if (await pleg.count() && !(await pleg.evaluate((d) => d.open))) await pleg.locator('summary').click();
      const inv = q.locator('section.companeros').getByRole('button', { name: /Invitar/ }).first();
      await inv.waitFor({ timeout: 8000 });
      await inv.click();
      const hi = q.getByRole('dialog', { name: /Invitar a un compañero de racha/ });
      await hi.waitFor();
      await hi.getByRole('switch', { name: 'Busco compañero' }).click();
      await q.waitForFunction(() => document.querySelector('.afines input[role=switch]')?.checked === true, null, { timeout: 5000 });
      await hi.locator('.afines').getByText(/nadie más lo busca|Entrena|Aún sin/).first().waitFor({ timeout: 5000 });
      const r = await q.evaluate(() => globalThis.__fbeDemo.rpc('comunidad_afines', {}));
      check(r?.busca === true, '«Busco compañero», al invitar a un compañero de racha');
      await q.keyboard.press('Escape');
    } else check(true, '(Ana no está en la comunidad de la demo)');
    const desborda = await q.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Personalización (compañía): ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nQue le acompañe más allá de la app');
  try { await probarPersonalCompania({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
