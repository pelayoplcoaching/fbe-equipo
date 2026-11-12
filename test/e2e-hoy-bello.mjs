// Belleza de hoy y de la sesión, en la demo y en un móvil simulado: «Tu día» con lo pendiente arriba, el botón de
// empezar a mano al bajar, y «¿Cómo llegas hoy?» de una en una. Con «reducir movimiento», lo mismo sin moverse.
//   Suelta:  npm run build && node test/e2e-hoy-bello.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarHoyBello } = await import('./e2e-hoy-bello.mjs'); await probarHoyBello({ navegador, check });
import { pathToFileURL } from 'node:url';

export async function probarHoyBello({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  async function abrir({ quieto = false } = {}) {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, reducedMotion: quieto ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await p.locator('.fila-dia').first().waitFor();
    for (let i = 0; i < 4; i++) {   // la bienvenida del día u otro aviso, fuera
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
    return { ctx, p };
  }
  const bajar = (p, y) => p.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
  const grupos = (p) => p.locator('.preparacion [role=group]').evaluateAll((l) => l.map((e) => e.getAttribute('aria-label')));

  {
    const { ctx, p } = await abrir();
    try {
      // Tu día: lo hecho, debajo de lo que queda
      const estados = await p.locator('.fila-dia').evaluateAll((l) => l.map((e) => e.classList.contains('hecho')));
      const primeraHecha = estados.indexOf(true);
      check(estados.length > 2 && primeraHecha > 0 && estados.slice(primeraHecha).every(Boolean) && !estados[0],
        '«Tu día» pone arriba lo que queda y debajo lo ya hecho');

      // La barra de empezar: solo al bajar, y se va al volver arriba
      const arriba = await p.locator('.hoy-a-mano').count();
      await bajar(p, 900);
      await p.locator('.hoy-a-mano').waitFor();
      await p.waitForFunction(() => !document.querySelector('.hoy-a-mano').getAnimations().some((a) => a.playState === 'running'));
      const nombre = await p.locator('.hero-dia .titular h2').innerText();
      const texto = await p.locator('.hoy-a-mano').innerText();
      const sobre = await p.evaluate(() => { const b = document.querySelector('.hoy-a-mano').getBoundingClientRect(), t = document.querySelector('nav.tabs').getBoundingClientRect(); return b.bottom <= t.top && b.height >= 44; });
      check(arriba === 0 && texto.toLowerCase().includes(nombre.trim().toLowerCase()) && /Empezar|Continuar/.test(texto) && sobre,
        'al bajar por Hoy, el botón de empezar se queda a mano en una barra sobre las pestañas (arriba no sale)');
      await bajar(p, 0);
      await p.locator('.hoy-a-mano').waitFor({ state: 'detached' });
      await bajar(p, 900);
      await p.locator('.hoy-a-mano').click();
      await p.getByRole('button', { name: 'Empezar', exact: true }).click();
      await p.locator('.preparacion').waitFor();
      check(true, 'la barra se va al volver arriba y, al tocarla, abre la sesión');

      // ¿Cómo llegas hoy?, de una en una
      const uno = await grupos(p);
      await p.locator('.preparacion').getByRole('group', { name: '¿Cómo has dormido?' }).getByRole('button', { name: 'Normal' }).click();
      await p.locator('.preparacion').getByRole('group', { name: '¿Cómo tienes la energía?' }).waitFor();
      const dos = await grupos(p), hechas = await p.locator('.prep-hecha').allInnerTexts();
      check(uno.length === 1 && uno[0] === '¿Cómo has dormido?' && dos.length === 1 && hechas.length === 1 && /Sueño/.test(hechas[0]) && /Normal/.test(hechas[0]),
        '«¿Cómo llegas hoy?» pregunta de una en una: al contestar entra la siguiente y la contestada queda arriba');
      await p.locator('.prep-hecha').first().click();
      await p.locator('.preparacion').getByRole('group', { name: '¿Cómo has dormido?' }).getByRole('button', { name: 'Bien' }).click();
      await p.locator('.preparacion').getByRole('group', { name: '¿Cómo tienes la energía?' }).getByRole('button', { name: 'Alta' }).click();
      const tres = await p.locator('.prep-hecha').allInnerTexts();
      await p.locator('.preparacion').getByRole('group', { name: '¿Agujetas o molestias?' }).getByRole('button').first().click();
      await p.locator('.preparacion').waitFor({ state: 'detached' });
      check(tres.length === 2 && /Bien/.test(tres[0]) && /Alta/.test(tres[1]),
        'una ya contestada se toca para cambiarla, y con la tercera se guarda y la tarjeta se recoge');
    } catch (e) {
      check(false, `Hoy y la sesión, bonitos: ${e.message.split('\n')[0]}`);
    } finally { await ctx.close(); }
  }
  {
    const { ctx, p } = await abrir({ quieto: true });
    try {
      await bajar(p, 900);
      await p.locator('.hoy-a-mano').waitFor();
      const quieta = await p.evaluate(() => document.querySelector('.hoy-a-mano').getAnimations().length);
      await p.locator('.hoy-a-mano').click();
      await p.getByRole('button', { name: 'Empezar', exact: true }).click();
      await p.locator('.preparacion').waitFor();
      await p.locator('.preparacion').getByRole('group', { name: '¿Cómo has dormido?' }).getByRole('button', { name: 'Normal' }).click();
      await p.locator('.prep-hecha').waitFor();
      const quietas = await p.evaluate(() => [...document.querySelectorAll('.preparacion .prep-fila, .preparacion .prep-hecha')].flatMap((e) => e.getAnimations()).length);
      check(quieta === 0 && quietas === 0, 'con «reducir movimiento», la barra y las preguntas salen sin moverse');
    } catch (e) {
      check(false, `Hoy y la sesión, con «reducir movimiento»: ${e.message.split('\n')[0]}`);
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 5).join(' ## ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nHoy y la sesión, bonitos');
  try { await probarHoyBello({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
