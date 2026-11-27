// (v0.276) Vista (251-300), tercera vuelta, en el navegador (un móvil de 390 px): los primeros días y leer a gusto.
//   · Marina (FBE Esencial, acaba de entrar). En Progreso, la silueta de lo que vendrá: la fuerza y el tonelaje, su
//     primera semana dibujada y los marcos de sus primeros récords.
//   · Ana (FBE Equipo). En «Aprende», la guía con su barra de lectura (los minutos que quedan bajan al leer), el modo
//     lectura (letra un punto mayor e interlineado amplio) y, al acabar, «Guía leída» y la siguiente, que se abre al
//     tocarla; en la lista, la leída lleva su «Leída».
//   · Tomás (FBE Esencial). Su revisión semanal, con su barra de lectura en la hoja.
//   Sin errores, sin desbordes y con accesibilidad.
//   Suelta:  npm run build && node test/e2e-vista-3.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion, subProgreso } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarVista3({ navegador, check, base = 'http://localhost:4174' }) {
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
  const nuevo = async () => {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true });
    p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    await p.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); localStorage.setItem('fbe-bienvenida-vista', '1'); } catch { /* */ } });
    return ctx;
  };
  const entrar = async (url, quien) => {
    await p.goto(`${base}${url}`);
    const b = p.getByRole('button', { name: quien }).first();
    if (await b.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await b.click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1500);
    await cerrarDialogos();
  };

  // ------------------------------------------------------------ Marina: el primer día en Progreso
  {
    const ctx = await nuevo();
    try {
      await entrar('/?demo=esencial', /Marina/);
      await irASeccion(p, 'Progreso');
      await p.waitForTimeout(1500);
      await cerrarDialogos();
      await subProgreso(p, 'resumen');
      const semanas = p.locator('.sfa-fila');
      check(await hasta(async () => (await semanas.count()) === 1, 6000) && /Cuando acabe tu primera semana/.test(await p.locator('.sfa-txt').textContent()), '(269) en «Tus semanas», su primera semana dibujada y lo que saldrá');
      await subProgreso(p, 'fuerza');
      await p.waitForTimeout(1000);
      const fuerza = p.locator('section.seccion:has(h2:text-is("Fuerza (1RM estimado)")) .vacio');
      const ton = p.locator('section.seccion:has(h2:text-is("Tonelaje por semana")) .grafica-fantasma');
      check(await fuerza.count() === 1 && /Sin datos todavía/.test(await fuerza.textContent()) && await ton.count() === 1, '(269) el tonelaje, con la silueta de lo que vendrá (la línea de puntos); la fuerza, con la ilustración de su vacío');
      const huecos = p.locator('.vit-huecos .vit-hueco');
      check(await huecos.count() === 2 && /Tu primer récord/.test(await huecos.first().textContent()) && await p.getByRole('button', { name: /Ir a tu sesión de hoy/ }).count() === 1, '(270) la vitrina, con los marcos de sus primeros récords (y el camino a su sesión)');
      await revisar('Progreso de Marina, el primer día');
      await subProgreso(p, 'logros');
      check(await hasta(async () => /sin medalla/i.test(await p.locator('main').textContent()), 5000), '(270) el álbum de medallas ya tenía sus huecos («Sin medalla», con lo que falta): ya estaba');
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ Ana: una guía de «Aprende»
  {
    const ctx = await nuevo();
    try {
      await entrar('/?demo', /Ana/);
      await irASeccion(p, 'Aprende');
      await p.waitForTimeout(1200);
      await cerrarDialogos();
      const primera = p.locator('.tarjeta-guia').first();
      const titulo = (await primera.locator('strong').first().textContent()).trim();
      await primera.click();
      const barra = p.locator('.lec-barra');
      await barra.waitFor({ timeout: 10000 });
      await p.waitForTimeout(500);
      const t0 = await barra.getAttribute('aria-valuetext');
      const tam = await p.evaluate(() => { const q = document.querySelector('.lec-modo .guia-seccion > p'); if (!q) return null; const c = getComputedStyle(q); return { f: parseFloat(c.fontSize), l: parseFloat(c.lineHeight) / parseFloat(c.fontSize) }; });
      check(/^Te queda/.test(t0 || '') && (await barra.getAttribute('aria-valuenow')) === '0', `(271) la guía, con su barra de lectura arriba («${t0}»)`);
      check(!!tam && tam.f >= 16.5 && tam.l >= 1.6, `(272) en modo lectura: un punto más de letra e interlineado amplio (${tam?.f} px, ${tam?.l?.toFixed(2)})`);
      await p.evaluate(() => document.querySelector('.lec-fin').scrollIntoView({ block: 'center' }));
      const leida = p.locator('.lec-leida[data-si]');
      const alFinal = await hasta(async () => (await leida.count()) === 1 && (await barra.getAttribute('aria-valuetext')) === 'Leído', 4000);
      check(alFinal && (await barra.getAttribute('aria-valuenow')) === '100',
        `(273) al llegar al final: «Guía leída» y la barra, entera (${await leida.count()}, «${await barra.getAttribute('aria-valuetext')}», ${await barra.getAttribute('aria-valuenow')})`);
      const pegada = await p.evaluate(() => { const b = document.querySelector('.lec-barra'); const c = document.querySelector('main .cabecera'); return Math.abs(b.getBoundingClientRect().top - c.getBoundingClientRect().bottom) <= 2; });
      check(pegada, 'y la barra va pegada justo debajo de la cabecera');
      const sig = p.locator('.lec-sig .tarjeta-guia');
      const nombreSig = (await sig.locator('strong').first().textContent().catch(() => '')).trim();
      check(nombreSig.length > 2 && nombreSig !== titulo, `la siguiente guía asoma debajo («${nombreSig}»)`);
      await revisar('una guía, al final');
      await sig.click();
      check(await hasta(async () => (await p.locator('main .cabecera h1').first().textContent()).trim() === nombreSig, 4000) && (await p.evaluate(() => scrollY)) < 50, 'al tocarla se abre, desde arriba');
      await p.getByRole('button', { name: 'Todas las guías' }).click();
      const chip = p.locator('.tarjeta-guia', { hasText: titulo }).locator('.lec-chip');
      check(await hasta(async () => (await chip.count()) === 1, 4000) && JSON.parse(await p.evaluate(() => localStorage.getItem('fbe-guias-leidas'))).length >= 1, 'en la lista, la leída lleva su «Leída» (en el móvil, solo su clave)');
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ Tomás: su revisión semanal
  {
    const ctx = await nuevo();
    try {
      await p.addInitScript(() => { try { localStorage.setItem('fbe-avisos-apilados', '0'); } catch { /* */ } });
      await entrar('/?demo=esencial', /Tomás/);
      const leer = p.getByRole('button', { name: 'Leer mi revisión' });
      if (await leer.waitFor({ timeout: 15000 }).then(() => true).catch(() => false)) {
        await leer.click();
        const hoja = p.locator('[aria-modal="true"]').last();
        await hoja.locator('.ayu-rev-t').waitFor({ timeout: 15000 });
        const barra = hoja.locator('.lec-barra');
        check(await barra.count() === 1 && (await barra.getAttribute('data-en')) === 'hoja' && /^Te queda|^Leído/.test(await barra.getAttribute('aria-valuetext')), `(271) su revisión semanal, con su barra de lectura en la hoja («${await barra.getAttribute('aria-valuetext')}»)`);
        await revisar('la revisión, con su barra');
      } else check(false, 'la revisión de Tomás en Hoy');
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `los primeros días y leer a gusto, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4197);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Vista, tercera vuelta: los primeros días y leer a gusto (v0.276)');
  try { await probarVista3({ navegador, check, base: 'http://localhost:4197' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
