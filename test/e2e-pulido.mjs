// Pulido de fluidez, en la demo y en un móvil simulado (táctil): que lo pulsable responda al pulsarlo, que no se pierda el
// sitio al volver, que «atrás» cierre lo abierto en vez de salir, y lo demás de web/src/ui/pulido.js y pulido.css.
//   Suelta:  npm run build && node test/e2e-pulido.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPulido } = await import('./e2e-pulido.mjs'); await probarPulido({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarPulido({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const abrir = async (quien, opciones = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: 'es-ES', ...opciones });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: quien }).first().tap();
    await p.locator('nav.tabs').waitFor();
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const n of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir', 'Empezar', 'Luego']) { const b = d.getByRole('button', { name: n, exact: true }).first(); if (await b.isVisible().catch(() => false)) { await b.tap(); hecho = true; break; } }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
    return { ctx, p, cdp: await ctx.newCDPSession(p) };
  };
  // Lo que se ve de un elemento, en reposo y pulsado (se fuerza :active, como hace el dedo)
  // (mirar: dónde se ve el cambio, si no es en el propio elemento; p. ej. el icono de una pestaña de la barra)
  const pulsado = async (p, cdp, selector, mirar = selector) => {
    const leer = () => p.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const c = getComputedStyle(el); return [c.transform, c.opacity, c.backgroundColor, c.filter, c.color].join('|'); }, mirar);
    const antes = await leer();
    if (antes == null) return null;
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
    await p.waitForTimeout(220);
    const despues = await leer();
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    return antes !== despues;
  };

  try {
    // ---------- 1. Todo responde al pulsar
    {
      const { ctx, p, cdp } = await abrir(/Ana López/);
      const r = [await pulsado(p, cdp, 'nav.tabs .tab:not([aria-current])', 'nav.tabs .tab:not([aria-current]) > span:first-child'), await pulsado(p, cdp, '.btn'), await pulsado(p, cdp, '.btn-icono')];
      await irASeccion(p, 'Progreso');
      await p.locator('.pestanas [role=tab]').first().waitFor();
      r.push(await pulsado(p, cdp, '.pestanas [role=tab]:not([aria-selected="true"])'));
      await irASeccion(p, 'Semana');
      await p.locator('.tira-chip, .fila-dia, .dia').first().waitFor();
      r.push(await pulsado(p, cdp, '.tira-chip, .fila-dia, .dia'));
      check(r.every((x) => x === true), `al pulsar, cambian a la vista la pestaña de la barra, el botón, el botón de icono, la sub-pestaña y un día de la semana (${r.join(', ')})`);
      const sinToque = await p.evaluate(() => [...document.querySelectorAll('button, a[href], [role=tab], summary')].filter((el) => el.getBoundingClientRect().width > 0 && !['manipulation', 'none', 'pan-y', 'pan-x'].includes(getComputedStyle(el).touchAction)).length);
      check(sinToque === 0, 'ningún botón espera al «doble toque» (touch-action: manipulation)');
      await ctx.close();
    }
    {
      const { ctx, p, cdp } = await abrir(/Pelayo/);
      await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().tap();
      await p.locator('.pestanas [role=tab]').first().waitFor();
      const r = [await pulsado(p, cdp, '.pestanas [role=tab]:not([aria-selected="true"])'), await pulsado(p, cdp, '.selector-chips button:not([aria-pressed="true"]), .semanas-tabs button:not([aria-pressed="true"])')];
      await p.getByRole('tab', { name: 'Nutrición' }).first().tap();
      await p.locator('.segmentos button, .pestanas-sub [role=tab]').first().waitFor();
      r.push(await pulsado(p, cdp, '.pestanas-sub [role=tab]:not([aria-selected="true"])'));
      check(r.every((x) => x === true), `en la ficha del coach, también las pestañas y los chips (${r.join(', ')})`);
      await ctx.close();
    }
    {
      // Con «reducir movimiento» sigue habiendo respuesta, sin encoger nada
      const { ctx, p, cdp } = await abrir(/Ana López/, { reducedMotion: 'reduce' });
      const leer = () => p.evaluate(() => { const c = getComputedStyle(document.querySelector('.btn')); return { t: c.transform, o: c.opacity }; });
      await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
      const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.btn' });
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
      await p.waitForTimeout(150);
      const x = await leer();
      check(x.t === 'none' && Number(x.o) < 1, 'con «reducir movimiento» el botón no se encoge, pero sí se atenúa');
      await ctx.close();
    }
    check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  } catch (e) {
    check(false, `Pulido: ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  }
}

// Suelta
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4179);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Pulido de fluidez');
  await probarPulido({ navegador, check, base: 'http://localhost:4179' });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
