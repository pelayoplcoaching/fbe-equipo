// Las ilustraciones vivas (imagenes.css, bloque V), en la demo y en un móvil simulado: la portada de la sesión se acerca
// despacio, la bienvenida lleva la luz de la hora, «¿Dónde entrenas hoy?» funde una imagen sobre otra y el resumen
// aparece al levantarse el telón. Con «reducir movimiento», nada se mueve; con la app en segundo plano, se paran; y no
// se pide ninguna imagen de más.
//   Suelta:  npm run build && node test/e2e-vivas.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarVivas } = await import('./e2e-vivas.mjs'); await probarVivas({ navegador, check });
import { pathToFileURL } from 'node:url';

export async function probarVivas({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  async function abrir({ quieto = false, bienvenida = false } = {}) {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, reducedMotion: quieto ? 'reduce' : 'no-preference' });
    if (bienvenida) await ctx.addInitScript(() => { try { localStorage.setItem('fbe-probar-bienvenida', '1'); } catch { /* */ } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    const imagenes = [];
    p.on('request', (r) => { if (/\/imagenes\//.test(r.url())) imagenes.push(r.url().split('/imagenes/')[1]); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    return { ctx, p, imagenes };
  }
  const cerrarDialogos = async (p) => {
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
  const animadas = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].flatMap((el) => el.getAnimations().map((a) => `${a.animationName || 'transicion'}:${a.playState}`)), sel);
  const VIVAS = 'img.portada-foto, .bdia-fondo, .bdia-luz, .bdia-luz *, .franja-cruce img, .resumen-hero img.hero-foto, .hero-brillo';

  // 1. La bienvenida del día: la luz de la hora y el fondo que deriva; en segundo plano, paradas
  let { ctx, p } = await abrir({ bienvenida: true });
  try {
    await p.locator('.bdia .bdia-fondo').waitFor();
    const luz = p.locator('.bdia-luz');
    check(await luz.count() === 1 && /bdia-luz-(manana|tarde|noche)/.test(await luz.getAttribute('class')) && await luz.getAttribute('aria-hidden') === 'true', 'la bienvenida del día lleva encima la luz de la hora (adorno)');
    const a = await animadas(p, '.bdia-fondo, .bdia-luz, .bdia-luz *');
    check(a.some((x) => x.startsWith('bdia-deriva')) && a.some((x) => /bdia-(rayo|calida|titila):running/.test(x)), `el fondo deriva y la luz respira (${[...new Set(a.map((x) => x.split(':')[0]))].join(', ')})`);
    check(await p.evaluate(() => document.documentElement.dataset.vivas === '1' && !document.documentElement.hasAttribute('data-oculta')), 'con la app a la vista, nada parado');
    await p.evaluate(() => document.documentElement.setAttribute('data-oculta', ''));
    const paradas = await p.evaluate(() => [...document.querySelectorAll('.bdia-fondo, .bdia-rayo, .bdia-luz-tarde, .bdia-estrella')].map((el) => getComputedStyle(el).animationPlayState));
    check(paradas.length > 0 && paradas.every((x) => x.split(', ').every((y) => y === 'paused')), 'con la app en segundo plano, se paran');
    await p.evaluate(() => document.documentElement.removeAttribute('data-oculta'));
    check(await p.evaluate(() => { const b = document.querySelector('.bdia'), l = document.querySelector('.bdia-luz'); const rb = b.getBoundingClientRect(), rl = l.getBoundingClientRect(); return Math.abs(rb.width - rl.width) < 1 && Math.abs(rb.height - rl.height) < 1 && document.documentElement.scrollWidth <= innerWidth; }), 'la luz no cambia el tamaño de nada ni desborda');
  } catch (e) {
    check(false, `La bienvenida viva: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  // 2. La portada (se acerca despacio y sigue recogiéndose al bajar), dónde entrenas (fundido) y el resumen (aparece)
  let imagenes;
  ({ ctx, p, imagenes } = await abrir());
  try {
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos(p);
    const deSesion = () => imagenes.filter((x) => x.startsWith('sesion/'));
    const antesPortada = deSesion().length;
    await p.locator('.btn-hero').first().click();
    const foto = p.locator('img.portada-foto');
    await foto.waitFor();
    const escala = () => foto.evaluate((el) => Number(getComputedStyle(el).scale) || 1);
    const e0 = await escala();
    await p.waitForTimeout(1200);
    const e1 = await escala();
    check(e0 >= 1 && e1 > e0 && e1 <= 1.0601 && (await animadas(p, 'img.portada-foto')).some((x) => x === 'portada-viva:running'), `la portada de la sesión se acerca muy despacio (${e0.toFixed(3)} → ${e1.toFixed(3)}, hasta 1,06)`);
    check(await foto.evaluate((el) => { const r = el.parentElement.getBoundingClientRect(); return getComputedStyle(el.parentElement).overflow === 'hidden' && Math.round(r.width) === innerWidth; }), 'dentro de su hueco de siempre (lo que crece queda recortado)');
    check(deSesion().length - antesPortada === 1 && new Set(imagenes).size === imagenes.length, `sin descargas de más: al abrir la portada se pide una imagen, la suya, y ninguna dos veces (${deSesion().length - antesPortada})`);
    await p.getByRole('button', { name: 'Empezar' }).last().click();
    const franja = p.locator('.franja-cruce');
    await franja.waitFor();
    await cerrarDialogos(p);
    const alto = await franja.evaluate((el) => Math.round(el.getBoundingClientRect().height));
    const antes = imagenes.filter((x) => x.startsWith('donde/')).length;
    check(await franja.locator('img').count() === 1 && antes === 1, 'en «¿Dónde entrenas hoy?» solo está (y solo se ha pedido) la imagen del sitio elegido');
    await p.locator('.donde-entrenas .segmentos button', { hasText: 'Casa' }).click();
    await p.waitForFunction(() => document.querySelectorAll('.franja-cruce img').length === 2, null, { timeout: 4000 });
    const medio = await franja.locator('img').evaluateAll((els) => els.map((e) => e.dataset.imagen).join());
    check(medio === 'donde-gimnasio,donde-casa' && await franja.evaluate((el) => Math.round(el.getBoundingClientRect().height)) === alto, 'al cambiar de sitio, la imagen nueva entra encima de la anterior, en el mismo hueco');
    await p.waitForFunction(() => { const i = document.querySelectorAll('.franja-cruce img'); return i.length === 1 && getComputedStyle(i[0]).opacity === '1'; }, null, { timeout: 4000 });
    check(await franja.locator('img').getAttribute('data-imagen') === 'donde-casa' && imagenes.filter((x) => x.startsWith('donde/')).length === antes + 1, 'acabado el fundido queda solo la nueva (y se ha pedido una imagen más, la suya)');
    await p.getByRole('button', { name: 'Terminar sesión' }).click();
    await p.getByRole('button', { name: 'Guardar y terminar' }).click();
    const heroe = p.locator('.resumen-hero img.hero-foto');
    await heroe.waitFor({ timeout: 9000 });
    const op0 = await heroe.evaluate((el) => Number(getComputedStyle(el).opacity));
    await p.waitForFunction(() => { const el = document.querySelector('.resumen-hero img.hero-foto'); return el && !el.getAnimations().some((a) => a.animationName === 'hero-amanece' && a.playState === 'running'); }, null, { timeout: 5000 });
    const op1 = await heroe.evaluate((el) => Number(getComputedStyle(el).opacity));
    check(op0 < op1 && Math.abs(op1 - 0.62) < 0.01 && await p.locator('.resumen-hero .hero-brillo[aria-hidden="true"]').count() === 1, `en el resumen, la ilustración aparece al levantarse el telón (opacidad ${op0.toFixed(2)} → ${op1.toFixed(2)})`);
  } catch (e) {
    check(false, `La portada, dónde entrenas y el resumen: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  // 3. Con «reducir movimiento», todo quieto (y el cambio de sitio, sin fundido)
  ({ ctx, p } = await abrir({ quieto: true, bienvenida: true }));
  try {
    await p.locator('.bdia .bdia-fondo').waitFor();
    check((await animadas(p, VIVAS)).length === 0 && await p.locator('.bdia-luz').count() === 1, 'con «reducir movimiento», la bienvenida tiene su luz pero nada se mueve');
    await p.locator('.bdia-empezar').click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos(p);
    await p.locator('.btn-hero').first().click();
    await p.locator('img.portada-foto').waitFor();
    await p.waitForTimeout(300);
    check((await animadas(p, VIVAS)).length === 0 && await p.locator('img.portada-foto').evaluate((el) => (getComputedStyle(el).scale || 'none') === 'none' || getComputedStyle(el).scale === '1'), 'y la portada se queda quieta');
    await p.getByRole('button', { name: 'Empezar' }).last().click();
    await p.locator('.franja-cruce').waitFor();
    await cerrarDialogos(p);
    await p.locator('.donde-entrenas .segmentos button', { hasText: 'Viaje' }).click();
    await p.waitForFunction(() => { const i = document.querySelectorAll('.franja-cruce img'); return i.length === 1 && i[0].dataset.imagen === 'donde-viaje' && getComputedStyle(i[0]).opacity === '1'; }, null, { timeout: 5000 });
    check((await animadas(p, VIVAS)).length === 0, 'el cambio de sitio, sin fundido');
  } catch (e) {
    check(false, `Con «reducir movimiento»: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 5).join(' ## ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nLas ilustraciones vivas');
  try { await probarVivas({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
