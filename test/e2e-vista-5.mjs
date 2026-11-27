// (v0.278) Vista (251-300), quinta vuelta, en el navegador: luz y materia.
//   · La luz cálida de noche: con el ajuste, a las 23:00 los blancos son más cálidos (en claro, las superficies; en oscuro,
//     el texto); a mediodía y con alto contraste, no. El interruptor está en Ajustes.
//   · Con el móvil inclinado (permiso dado), la tarjeta de Hoy se mueve en dos planos; con «reducir movimiento», no.
//   · El reflejo de la barra de abajo va ligado al desplazamiento (y no está con «reducir movimiento»).
//   · Las fotos de los platos, en oscuro, bajan un punto de luz. Los vídeos sin miniatura llevan el arte de su tema.
//   · Los dibujos de línea de los vacíos, sobre la noche de la marca.
//   Sin errores, sin desbordes y con accesibilidad.
//   Suelta:  npm run build && node test/e2e-vista-5.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion, irAAjustes } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarVista5({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(100); } return !!(await fn().catch(() => false)); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    // Con las hojas aún entrando (o el velo a medias), axe mide el color a medio camino: se espera a que acaben
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 2500)),
    ]));
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
  }
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const b = p.locator('[aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Ahora no"), [aria-modal="true"] button:has-text("Entendido"), .bienvenida button:has-text("Saltar")').first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await p.waitForTimeout(350); } else break;
    }
  };
  // hora: 'HH:MM' de hoy en Madrid; ajustes: lo que se guarda en fbe-ajustes; incl: el permiso del móvil dado
  const nuevo = async ({ hora = null, oscuro = false, movimiento = 'reduce', ajustes = null, incl = false, ancho = 390, movil = true } = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: 844 }, isMobile: movil, hasTouch: movil, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, colorScheme: oscuro ? 'dark' : 'light', reducedMotion: movimiento });
    if (hora) {
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
      const fecha = [1, 2].map((o) => new Date(`${hoy}T${hora}:00+0${o}:00`)).find((d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) === hora);
      await ctx.clock.setFixedTime(fecha);
    }
    await ctx.route(/i\.ytimg\.com/, (r) => r.abort());   // sin miniaturas de YouTube (como sin red para ellas)
    p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    await p.addInitScript(([a, i]) => {
      try {
        localStorage.setItem('fbe-escena-200', '1'); localStorage.setItem('fbe-bienvenida-vista', '1');
        if (a) localStorage.setItem('fbe-ajustes', JSON.stringify(a));
        if (i) sessionStorage.setItem('fbe-inclinacion', '1');
      } catch { /* */ }
    }, [ajustes, incl]);
    return ctx;
  };
  const entrar = async (url, quien) => {
    await p.goto(`${base}${url}`);
    const b = p.getByRole('button', { name: quien }).first();
    if (await b.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await b.click();
    await p.waitForTimeout(1500);
    await cerrarDialogos();
  };
  const raiz = (k) => p.evaluate((x) => getComputedStyle(document.documentElement).getPropertyValue(x).trim(), k);
  const calida = () => p.evaluate(() => document.documentElement.hasAttribute('data-calida'));

  // ------------------------------------------------------------ La luz cálida de noche (282)
  {
    const ctx = await nuevo({ hora: '23:00', ajustes: { calida: true } });
    try {
      await entrar('/?demo=esencial', /Tomás/);
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      check(await calida() && /color-mix|255, 2[0-4]\d/.test(await raiz('--hoja')) && !/^#?f{6}$/i.test((await raiz('--hoja')).replace('#', '')), '(282) a las 23:00, con el ajuste, las tarjetas un punto más cálidas');
      await revisar('Hoy con la luz cálida');
    } finally { await ctx.close(); }
  }
  {
    const ctx = await nuevo({ hora: '23:00', oscuro: true, ajustes: { calida: true } });
    try {
      await entrar('/?demo=esencial', /Tomás/);
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      check(await calida() && /color-mix/.test(await raiz('--tinta')), '(282) y en oscuro, el texto');
      await revisar('Hoy con la luz cálida, en oscuro');
    } finally { await ctx.close(); }
  }
  {
    const ctx = await nuevo({ hora: '12:00', ajustes: { calida: true } });
    try {
      await entrar('/?demo=esencial', /Tomás/);
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      check(!(await calida()) && /^#FFFFFF$/i.test(await raiz('--hoja')), 'a mediodía, como siempre');
    } finally { await ctx.close(); }
  }
  {
    const ctx = await nuevo({ hora: '23:00', ajustes: { calida: true, altoContraste: true } });
    try {
      await entrar('/?demo=esencial', /Tomás/);
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      check(!(await calida()), 'con alto contraste, nunca');
    } finally { await ctx.close(); }
  }
  {
    const ctx = await nuevo({ hora: '23:00' });
    try {
      await entrar('/?demo=esencial', /Tomás/);
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      check(!(await calida()), 'sin el ajuste (de serie), tampoco');
      await irAAjustes(p);
      const sw = p.locator('#aj-calida');
      const hay = await sw.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      if (hay) { await sw.scrollIntoViewIfNeeded(); await sw.click(); }
      check(hay && await hasta(calida, 4000) && /Luz cálida de noche/.test(await p.locator('main').textContent()), 'el interruptor «Luz cálida de noche», en Ajustes: al encenderlo a las 23:00, se aplica');
      await revisar('Ajustes con la luz cálida');
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ El móvil inclinado (285) y el reflejo (286)
  {
    const ctx = await nuevo({ movimiento: 'no-preference', incl: true });
    try {
      await entrar('/?demo=esencial', /Tomás/);
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(300);
      await p.evaluate(() => { window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 45, gamma: 0 })); });
      await p.waitForTimeout(80);
      await p.evaluate(() => { window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 52, gamma: 15 })); });
      const sigue = await hasta(() => p.evaluate(() => { const h = document.querySelector('.hero-dia'); return !!h?.hasAttribute('data-incl') && Number(h.style.getPropertyValue('--incl-x')) > 0.5; }), 3000);
      check(sigue, '(285) con el móvil inclinado (y su permiso), la tarjeta de Hoy lo sigue');
      const reflejo = await p.evaluate(() => { const t = document.querySelector('.tabs-flota'); return t ? getComputedStyle(t, '::after').animationName : null; });
      check(reflejo === 'vtc-reflejo' || reflejo === null, `(286) el reflejo de la barra, ligado al desplazamiento (${reflejo || 'sin barra flotante'})`);
    } finally { await ctx.close(); }
  }
  {
    const ctx = await nuevo({ movimiento: 'reduce', incl: true });
    try {
      await entrar('/?demo=esencial', /Tomás/);
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      await p.evaluate(() => { window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 45, gamma: 0 })); window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 52, gamma: 15 })); });
      await p.waitForTimeout(400);
      const quieta = await p.evaluate(() => !document.querySelector('.hero-dia')?.hasAttribute('data-incl'));
      const reflejo = await p.evaluate(() => { const t = document.querySelector('.tabs-flota'); return t ? getComputedStyle(t, '::after').animationName : 'none'; });
      check(quieta && reflejo === 'none', 'con «reducir movimiento», ni la tarjeta se mueve ni hay reflejo');
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ Los vídeos sin miniatura (288) y los platos en oscuro (287)
  {
    const ctx = await nuevo({ oscuro: true });
    try {
      await entrar('/?demo', /Ana López/);
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      await irASeccion(p, 'Aprende');
      await p.waitForTimeout(1200);
      await cerrarDialogos();
      const arte = p.locator('.tarjeta-video-img img.vtc-arte');
      check(await hasta(async () => (await arte.count()) > 0, 8000), '(288) los vídeos sin miniatura llevan el arte de su tema');
      await revisar('Aprende, con los vídeos sin miniatura');
    } finally { await ctx.close(); }
  }
  {
    const ctx = await nuevo({ oscuro: true });
    try {
      await entrar('/?demo', /Carlos/);
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      await irASeccion(p, 'Recetas');
      await p.waitForTimeout(1200);
      await cerrarDialogos();
      const foto = p.locator('img.receta-foto').first();
      const hayFoto = await foto.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
      const filtro = hayFoto ? await foto.evaluate((e) => getComputedStyle(e).filter) : '';
      check(hayFoto && /brightness\(0\.88\)/.test(filtro), `(287) en oscuro, las fotos de los platos bajan un punto de luz (${filtro || 'sin foto'})`);
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ Los dibujos de línea (289), en el panel del coach
  {
    const ctx = await nuevo({ ancho: 1100, movil: false });
    try {
      await entrar('/?demo', /Pelayo/);
      await p.waitForTimeout(1500);
      await p.getByRole('link', { name: /Biblioteca/ }).first().click().catch(async () => { await p.getByRole('button', { name: /Biblioteca/ }).first().click().catch(() => {}); });
      await p.waitForTimeout(1200);
      const buscar = p.getByRole('searchbox').first();
      if (await buscar.count()) await buscar.fill('zzzzqqq');
      const dibujo = p.locator('.vacio.con-ilustracion:not(.con-escena) > svg.ilustracion').first();
      const hay = await dibujo.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
      const fondo = hay ? await dibujo.evaluate((e) => getComputedStyle(e).backgroundImage) : '';
      check(hay && /radial-gradient/.test(fondo), '(289) el dibujo de línea de un vacío, sobre la noche de la marca');
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `luz y materia, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4199);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Vista, quinta vuelta: luz y materia (v0.278)');
  try { await probarVista5({ navegador, check, base: 'http://localhost:4199' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
