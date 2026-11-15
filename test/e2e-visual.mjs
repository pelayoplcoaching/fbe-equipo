// Visual (claude/visual-mejoras.md), en la demo y en un móvil simulado: Perfil en dos vistas con el índice de los
// ajustes y #ajustes, las tarjetas que miran su hueco, Progreso y Perfil a dos columnas en el escritorio, las cifras con
// su chip, Tus 12 semanas (semanas vacías y media), la miniatura de cada semana, el color de las imágenes al cargar y
// atenuadas en oscuro, la cabecera de las hojas que se queda arriba, los avisos de la barra, sin saltos al cargar y
// el contraste (axe) de las dos vistas de Perfil en claro y en oscuro.
//   Sola:  CHROME_PATH=/usr/bin/google-chrome node test/e2e-visual.mjs
//   Dentro de e2e.test.mjs:  const { probarVisual } = await import('./e2e-visual.mjs'); await probarVisual({ navegador, check });
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { irASeccion, irAAjustes } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarVisual({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, colorScheme: 'light', bypassCSP: true });
  const p = await ctx.newPage();
  // los saltos de la página al cargar (layout shift), desde el principio
  await p.addInitScript(() => {
    window.__saltos = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__saltos.push(e.value); }).observe({ type: 'layout-shift', buffered: true }); } catch { /* sin soporte */ }
  });
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      if (!(await p.locator('[role=dialog]').last().isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const saltos = () => p.evaluate(() => { const s = window.__saltos.reduce((t, v) => t + v, 0); window.__saltos = []; return s; });
  const contraste = async () => {
    await p.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 1500))]));
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    return p.evaluate(async () => (await window.axe.run(document, { runOnly: ['color-contrast', 'aria-valid-attr-value', 'aria-required-children', 'list', 'listitem'] })).violations.flatMap((v) => v.nodes.slice(0, 3).map((n) => `${v.id}: ${n.target.join(' ')}`)));
  };

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(2500);
    // (19) sin saltos al cargar: Hoy, Progreso y Perfil
    const sHoy = await saltos();
    await fueraAvisos();
    await irASeccion(p, 'Progreso');
    await p.locator('.progreso-panel').waitFor();
    await p.waitForTimeout(2500);
    const sProg = await saltos();
    check(sHoy < 0.02 && sProg < 0.02, `(19) sin saltos al cargar (layout shift): Hoy ${sHoy.toFixed(3)}, Progreso ${sProg.toFixed(3)}`);

    // (9) cada semana, su miniatura: el aro de sesiones (entero y con el Amanecer si se completó) y la medalla de sus récords
    const sellos = p.locator('.fila-semana .sello-semana');
    if (await sellos.count()) {
      const s0 = await sellos.first().evaluate((el) => ({ p: getComputedStyle(el).getPropertyValue('--p').trim(), completa: el.classList.contains('completa'), fondo: getComputedStyle(el).backgroundImage, texto: el.textContent }));
      check(/conic-gradient/.test(s0.fondo) && /^\d+\/\d+/.test(s0.texto) && (s0.completa ? Number(s0.p) >= 1 : Number(s0.p) < 1) && await p.locator('section:has(> .panel .sello-semana) .fila-semana').count() === await sellos.count(),
        `(9) «Tus semanas»: cada una con su aro de sesiones (${s0.texto}), no el mismo lobo`);
    } else check(true, '(9) (sin semanas resumidas en esta demo: nada que ver)');

    // (12) las ilustraciones, con su color mientras cargan
    const img = p.locator('img[data-imagen]').first();
    if (await img.count()) {
      const c = await img.evaluate((el) => [el.style.getPropertyValue('--color-imagen'), getComputedStyle(el).backgroundColor]);
      check(/^#[0-9a-f]{6}$/i.test(c[0]) && c[1] !== 'rgba(0, 0, 0, 0)', `(12) las ilustraciones llevan su color de fondo mientras cargan (${c[0]})`);
    } else check(true, '(12) (sin ilustraciones en esta construcción)');

    // (3) Perfil, en dos vistas
    await irASeccion(p, 'Perfil');
    await fueraAvisos();
    const tu = p.getByRole('tab', { name: 'Tú', exact: true }), aj = p.getByRole('tab', { name: 'Ajustes', exact: true });
    await tu.waitFor();
    check(await tu.getAttribute('aria-selected') === 'true' && await p.locator('#grupo-lo-tuyo').count() === 1 && await p.locator('#grupo-este-movil').count() === 0 && await p.locator('.perfil-cabeza').count() === 1,
      '(3) Perfil se abre en «Tú»: tu cabecera, tu carné, tu actividad, tu asesoría y lo tuyo (sin los ajustes)');
    const altoTu = await p.evaluate(() => document.documentElement.scrollHeight);
    const malTu = await contraste();
    check(malTu.length === 0, `y en claro, sin fallos de contraste ni de estructura (axe)${malTu.length ? `: ${malTu.join(' | ')}` : ''}`);
    // (7) las cifras: la variación, en su chip
    const chips = await p.locator('.perfil-dif').evaluateAll((xs) => xs.map((x) => [x.textContent.trim(), getComputedStyle(x).borderRadius, x.className]));
    check(chips.length === 0 || chips.every(([, r]) => parseFloat(r) > 50), `(7) «Tus cifras»: la variación, en su chip (${chips.map((x) => x[0].replace(/^Frente a [^:]*: /, '')).join(', ') || 'sin variaciones'})`);
    // (8 y 10) Tus 12 semanas: las semanas sin nada, con su marca, y la media de fondo
    const barras = p.locator('.perfil-barras');
    if (await barras.count()) {
      const b = await barras.evaluate((el) => ({ m: Number(el.style.getPropertyValue('--m')), linea: getComputedStyle(el, '::before').borderTopStyle, vacias: el.querySelectorAll('.pb-col.vacia').length, altoVacia: el.querySelector('.pb-col.vacia .pb-barra')?.getBoundingClientRect().height ?? null }));
      check(b.m > 0 && b.m <= 1 && b.linea === 'dashed' && (b.vacias === 0 || b.altoVacia >= 2), `(8 y 10) «Tus 12 semanas»: la media de fondo, discontinua (${Math.round(b.m * 100)} % del alto), y ${b.vacias} semanas sin nada con su marca en el suelo`);
    }
    // (4) los ajustes, en su vista, con su índice
    await aj.click();
    await p.locator('#grupo-este-movil').waitFor();
    const grupos = await p.locator('.perfil-cuerpo > .grupo-ios > h2').allTextContents();
    const indice = await p.locator('.ajustes-indice .chip').allTextContents();
    check(indice.length >= 4 && indice.join() === grupos.join() && await p.locator('#grupo-lo-tuyo').count() === 0, `(4) «Ajustes»: un acceso por grupo arriba (${indice.join(', ')})`);
    const icoLinea = await p.locator('.perfil-cuerpo .ios-ico:not(.ok):not(.aviso):not(.alerta):not(.con-img)').first().evaluate((el) => getComputedStyle(el).backgroundImage).catch(() => 'none');
    check(icoLinea === 'none', '(4) los iconos de línea de los ajustes, en una tinta sobre gris (sin degradado de color)');
    await p.locator('.ajustes-indice .chip', { hasText: 'Cuenta' }).click();
    check(await p.waitForFunction(() => { const r = document.querySelector('#grupo-cuenta').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight * 0.6; }, null, { timeout: 4000 }).then(() => true, () => false), 'tocar «Cuenta» lleva a su grupo');
    check(await p.evaluate(() => document.documentElement.scrollHeight) < 9000 && altoTu < 9000, `y Perfil ya no es una página de 9.700 px («Tú» ${altoTu} px)`);
    // (17) en una hoja, la cabecera se queda arriba al bajar
    await p.evaluate(() => scrollTo(0, 0));
    await p.getByRole('button', { name: /^Sonido y vibración/ }).click();
    const hoja = p.locator('.hoja-dialogo');
    await hoja.waitFor();
    const cab0 = await hoja.locator('.hoja-cab').evaluate((el) => el.getBoundingClientRect().top);
    await hoja.evaluate((el) => { el.scrollTop = 400; });
    await p.waitForTimeout(250);
    const cab1 = await hoja.locator('.hoja-cab').evaluate((el) => [el.getBoundingClientRect().top, getComputedStyle(el).position, el.closest('.hoja-dialogo').getBoundingClientRect().top]);
    check(cab1[1] === 'sticky' && Math.abs(cab1[0] - cab1[2]) < 2 && await hoja.getByRole('button', { name: 'Cerrar' }).first().isVisible(), `(17) en una hoja, la cabecera (título y cerrar) se queda arriba al bajar (${Math.round(cab0)} → ${Math.round(cab1[0])} px)`);
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' }).catch(() => {});
    // en oscuro: (13) las fotos, un punto atenuadas, y el contraste de los ajustes
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.waitForTimeout(300);
    const malAj = await contraste();
    check(malAj.length === 0, `«Ajustes» en oscuro, sin fallos de contraste ni de estructura (axe)${malAj.length ? `: ${malAj.join(' | ')}` : ''}`);
    await tu.click();
    await p.waitForTimeout(400);
    const filtro = await p.locator('img[data-imagen]').first().evaluate((el) => getComputedStyle(el).filter).catch(() => null);
    check(filtro === null || /brightness\(0?\.92\)/.test(filtro), `(13) en oscuro, las ilustraciones un punto atenuadas (${filtro || 'sin ilustraciones'})`);
    const malTuO = await contraste();
    check(malTuO.length === 0, `«Tú» en oscuro, sin fallos de contraste (axe)${malTuO.length ? `: ${malTuO.join(' | ')}` : ''}`);
    await p.emulateMedia({ colorScheme: 'light' });
    // (18) los avisos de la barra, con un borde del color de la barra
    const borde = await p.evaluate(() => { const t = document.querySelector('.tab .punto'); return t ? getComputedStyle(t, '::after').borderTopColor : null; });
    const tiza = await p.evaluate(() => { const d = document.createElement('div'); d.style.color = 'var(--tiza)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    check(borde === null || borde === tiza, `(18) el punto de aviso de la barra, con un borde del color del fondo (${borde || 'sin aviso ahora'})`);
    // (3) #ajustes abre Perfil en «Ajustes»
    await irASeccion(p, 'Hoy');
    await p.waitForTimeout(500);
    await p.evaluate(() => { location.hash = '#ajustes'; });
    await p.locator('#grupo-este-movil').waitFor({ timeout: 8000 }).catch(() => {});
    check(await p.getByRole('tab', { name: 'Ajustes', exact: true }).getAttribute('aria-selected') === 'true', '(3) el enlace #ajustes abre Perfil en «Ajustes»');

    // (6) y (5) en el escritorio: Progreso y Perfil a dos columnas, y las tarjetas se reparten según su hueco
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.waitForTimeout(500);
    const colsAj = await p.locator('.perfil-cuerpo').evaluate((el) => [getComputedStyle(el).columnCount, el.closest('.contenido').getBoundingClientRect().width]);
    check(colsAj[0] === '2' && colsAj[1] > 900, `(6) en el escritorio, Perfil a dos columnas en una página más ancha (${Math.round(colsAj[1])} px)`);
    await irASeccion(p, 'Progreso');
    await p.locator('.progreso-panel').waitFor();
    await p.waitForTimeout(800);
    const prog = await p.locator('.progreso-panel').evaluate((el) => getComputedStyle(el).columnCount);
    const cifras = await p.locator('.progreso-panel .cifras').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length).catch(() => null);
    check(prog === '2' && (cifras === null || cifras === 2), `(6 y 5) Progreso, a dos columnas, y sus cifras, en dos (su columna es estrecha)${cifras === null ? '' : ` (${cifras})`}`);
    const desborde = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    check(desborde, 'y nada se sale de lado en el escritorio');
    await p.setViewportSize({ width: 390, height: 844 });
  } catch (e) {
    check(false, `Visual: ${e.message.split('\n')[0]}`);
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
  console.log('\nVisual');
  try { await probarVisual({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
