// (v0.279) Vista (251-300), sexta vuelta, en el navegador: el afinado que se ve, medido.
//   · Ningún nombre cortado con puntos suspensivos: la cabecera pegada de Semana con un bloque de nombre largo (dos líneas
//     o letra más estrecha) y el «Después» del modo enfoque.
//   · 44 px de toque: las filas de los músculos y «Leer más».
//   · El mismo hueco bajo el título de cada fila de Hoy (10 px).
//   · Letra «Muy grande» a 360 px: ningún texto se sale de su caja ni de la pantalla en Hoy, Semana y Progreso.
//   Suelta:  npm run build && node test/e2e-vista-6.mjs
import { pathToFileURL } from 'node:url';
import { irASeccion, subProgreso } from './secciones.mjs';

export async function probarVista6({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(100); } return !!(await fn().catch(() => false)); };
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const b = p.locator('[aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Ahora no"), [aria-modal="true"] button:has-text("Entendido"), .bienvenida button:has-text("Saltar")').first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await p.waitForTimeout(350); } else break;
    }
  };
  const nuevo = async ({ ancho = 390, letra = null } = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: 800 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, reducedMotion: 'reduce' });
    p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    await p.addInitScript(([l]) => { try { localStorage.setItem('fbe-escena-200', '1'); localStorage.setItem('fbe-bienvenida-vista', '1'); localStorage.setItem('fbe-nec-todas', '1'); if (l) localStorage.setItem('fbe-ajustes', JSON.stringify({ letra: l })); } catch { /* */ } }, [letra]);
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
  // El texto que se sale de su caja (por su propio texto: lo que agranda el toque por fuera no cuenta) o de la pantalla
  const salidos = () => p.evaluate(() => {
    const vw = document.documentElement.clientWidth, out = [];
    const recorta = (e) => { for (let a = e; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') return true; } return false; };
    for (const e of document.querySelectorAll('main *, .cabecera *')) {
      const textos = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
      if (!textos.length || e.closest('[aria-hidden="true"], .sr')) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const caja = e.getBoundingClientRect();
      if (!caja.width) continue;
      const rg = document.createRange();
      let der = -Infinity;
      for (const n of textos) { rg.selectNodeContents(n); for (const r of rg.getClientRects()) der = Math.max(der, r.right); }
      if (der > caja.right + 1.5 && !recorta(e.parentElement) && cs.overflowX === 'visible') out.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} «${e.textContent.trim().slice(0, 30)}» (+${Math.round(der - caja.right)} px)`);
      else if (der > vw + 1 && !recorta(e)) out.push(`fuera de la pantalla: ${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} «${e.textContent.trim().slice(0, 30)}»`);
    }
    return [...new Set(out)];
  });

  // ------------------------------------------------------------ 290, 294 y 295, a 390 px
  {
    const ctx = await nuevo();
    try {
      await entrar('/?demo', /Carlos/);
      await irASeccion(p, 'Semana');
      await p.waitForTimeout(1000);
      await cerrarDialogos();
      await p.evaluate(() => window.scrollTo(0, 700));
      const h = p.locator('.cabecera-grande.compacta .titulo h1');
      const compacta = await h.waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
      const m = compacta ? await h.evaluate((e) => ({ t: e.textContent.trim(), cabe: e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1, corte: getComputedStyle(e).textOverflow })) : null;
      check(compacta && m.cabe && m.corte !== 'ellipsis', `(290) la cabecera pegada de Semana dice el nombre entero: «${m?.t}» (en dos líneas si hace falta, sin «…»)`);
    } finally { await ctx.close(); }
  }
  {
    const ctx = await nuevo();
    try {
      await entrar('/?demo=esencial', /Tomás/);
      const tramo = p.locator('section.tramo').first();
      if (await tramo.count()) {
        const g = await tramo.evaluate((e) => getComputedStyle(e).rowGap);
        check(g === '10px', `(294) bajo el título de cada fila de Hoy, el mismo hueco que en el resto (${g})`);
      } else check(false, 'las filas de Hoy');
      const mas = p.locator('.tres-mas').first();
      if (await mas.count()) {
        const alto = await mas.evaluate((e) => { const r = e.getBoundingClientRect(), a = getComputedStyle(e, '::after'); return r.height - Math.min(0, parseFloat(a.top) || 0) - Math.min(0, parseFloat(a.bottom) || 0); });
        check(alto >= 43.5, `(295) «Leer más» se toca en 44 px de alto (${Math.round(alto)})`);
      }
      await irASeccion(p, 'Progreso');
      await p.waitForTimeout(1000);
      await cerrarDialogos();
      await subProgreso(p, 'fuerza');
      const fila = p.locator('.mmt-fila').first();
      if (await fila.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) {
        const alto = await fila.evaluate((e) => e.getBoundingClientRect().height);
        check(alto >= 43.5, `(295) cada fila de los músculos, 44 px de alto (${Math.round(alto)})`);
      } else check(true, '(295) sin filas de músculos en esta demo');
      // el enfoque: el «Después» con su nombre entero
      await irASeccion(p, 'Hoy');
      await p.waitForTimeout(800);
      await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).first().click();
      const portada = p.locator('.portada-vista');
      if (await portada.waitFor({ timeout: 10000 }).then(() => true).catch(() => false)) await portada.getByRole('button', { name: /^\s*Empezar\s*$/ }).last().click();
      await p.waitForTimeout(1200);
      await cerrarDialogos();
      const enf = p.getByRole('button', { name: /Modo enfoque|Enfoque/ }).first();
      if (await enf.count()) {
        await enf.click();
        const d = p.locator('.enfoque-despues span:last-child');
        if (await d.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) {
          const r = await d.evaluate((e) => ({ t: e.textContent.trim(), cabe: e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1, corte: getComputedStyle(e).textOverflow }));
          check(r.cabe && r.corte !== 'ellipsis', `(290) en el modo enfoque, «Después»: «${r.t}», entero`);
        }
      }
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ 298: «Muy grande» a 360 px
  for (const [url, quien] of [['/?demo=esencial', /Tomás/], ['/?demo', /Carlos/]]) {
    const ctx = await nuevo({ ancho: 360, letra: 'muy-grande' });
    try {
      await entrar(url, quien);
      const fuera = [];
      fuera.push(...(await salidos()).map((x) => `Hoy: ${x}`));
      await irASeccion(p, 'Semana'); await p.waitForTimeout(1000); await cerrarDialogos();
      fuera.push(...(await salidos()).map((x) => `Semana: ${x}`));
      await irASeccion(p, 'Progreso'); await p.waitForTimeout(1000); await cerrarDialogos();
      for (const sp of ['resumen', 'fuerza']) { await subProgreso(p, sp); await p.waitForTimeout(900); fuera.push(...(await salidos()).map((x) => `Progreso ${sp}: ${x}`)); }
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      check(!fuera.length && sw <= 360, `(298) ${String(quien).replace(/\//g, '')}, con «Muy grande» a 360 px: ningún texto se sale (Hoy, Semana y Progreso)${fuera.length ? `: ${fuera.slice(0, 4).join(' · ')}` : ''}`);
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `el afinado, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4200);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Vista, sexta vuelta: el afinado que se ve (v0.279)');
  try { await probarVista6({ navegador, check, base: 'http://localhost:4200' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
