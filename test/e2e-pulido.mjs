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
    // ---------- 2. No se pierde el sitio al volver
    {
      const { ctx, p } = await abrir(/Ana López/);
      const y = () => p.evaluate(() => Math.round(scrollY));
      // (antes de bajar, que la pantalla haya acabado de cargar: su alto deja de cambiar)
      const quieta = () => p.evaluate(() => new Promise((r) => { let h = -1, n = 0; const t = setInterval(() => { const a = document.documentElement.scrollHeight; if (a === h) n++; else { h = a; n = 0; } if (n >= 4) { clearInterval(t); r(); } }, 60); }));
      const bajar = async (n) => { await quieta(); await p.evaluate((v) => window.scrollTo(0, v), n); await p.waitForTimeout(150); return y(); };
      // (se espera a que la pantalla llegue a su sitio y se quede quieta; cerca: a menos de 30 px, lo que puede
      // empujar una tarjeta que llega tarde por encima sin que lo que se mira se mueva)
      const en = async (n) => { await p.waitForFunction((v) => Math.abs(scrollY - v) <= 30, n, { timeout: 4000 }).catch(() => {}); await p.waitForTimeout(450); return y(); };
      const cerca = (a, b) => Math.abs(a - b) <= 30;
      const hoy = await bajar(600);
      await irASeccion(p, 'Semana');
      await p.locator('.semana-vista').first().waitFor();
      check(hoy > 300 && await en(0) === 0, `una pestaña que no se había visitado empieza arriba (Hoy estaba en ${hoy})`);
      const semana = await bajar(240);
      await irASeccion(p, 'Hoy');
      const hoy2 = await en(hoy);
      check(cerca(hoy2, hoy), `al volver a Hoy, la pantalla está donde se dejó (${hoy} → ${hoy2})`);
      await irASeccion(p, 'Semana');
      const semana2 = await en(semana);
      check(semana > 100 && cerca(semana2, semana), `y Semana, donde se dejó (${semana} → ${semana2})`);
      // Tocar la pestaña en la que ya se está: arriba
      await p.waitForTimeout(350);   // (que acabe la transición de la pestaña)
      await p.locator('nav.tabs .tab[aria-current="page"]').tap();
      const arriba0 = await en(0);
      check(arriba0 === 0, `tocar la pestaña en la que ya se está sube arriba (${semana} → ${arriba0})`);
      // Abrir una sesión y cerrarla: Hoy sigue donde estaba, y la sesión empieza arriba
      await irASeccion(p, 'Hoy');
      await en(hoy);
      const abrirS = p.locator('.sesion-hoy .btn, .tarjeta-sesion .btn, main .btn', { hasText: /Empezar|Continuar|Ver sesi|Abrir/ }).first();
      if (await abrirS.isVisible().catch(() => false)) {
        const yAntes = await y();
        await abrirS.dispatchEvent('click');   // (sin el «traer a la vista» de Playwright, que movería la pantalla)
        await p.locator('.app.en-sesion').waitFor();
        const arriba = await en(0);
        await p.getByRole('button', { name: 'Volver', exact: true }).first().tap();
        await p.locator('nav.tabs').waitFor();
        check(arriba === 0 && cerca(await en(yAntes), yAntes), `la sesión se abre arriba y, al cerrarla, Hoy sigue donde estaba (${yAntes})`);
      } else check(false, 'no hay sesión que abrir en Hoy para probar la vuelta');
      await ctx.close();
    }
    {
      const { ctx, p } = await abrir(/Pelayo/);
      const y = () => p.evaluate(() => Math.round(scrollY));
      const en = async (n) => { await p.waitForFunction((v) => Math.abs(scrollY - v) <= 30, n, { timeout: 4000 }).catch(() => {}); await p.waitForTimeout(450); return y(); };
      await p.locator('tr:visible, button.tarjeta-atleta:visible').first().waitFor();
      await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(150);
      const lista = await y();
      await p.locator('tr:visible, button.tarjeta-atleta:visible').nth(3).dispatchEvent('click');
      await p.getByRole('button', { name: 'Volver a atletas' }).waitFor();
      const ficha = await en(0);
      await p.evaluate(() => window.scrollTo(0, 300)); await p.waitForTimeout(150);
      await p.getByRole('button', { name: 'Volver a atletas' }).tap();
      await p.locator('tr:visible, button.tarjeta-atleta:visible').first().waitFor();
      check(lista > 100 && ficha === 0 && Math.abs(await en(lista) - lista) <= 30, `coach: la ficha se abre arriba y, al volver, la lista está donde se dejó (${lista})`);
      await p.locator('tr:visible, button.tarjeta-atleta:visible').nth(1).dispatchEvent('click');
      await p.getByRole('button', { name: 'Volver a atletas' }).waitFor();
      check(await en(0) === 0, 'coach: otra ficha empieza arriba (no hereda la posición de la anterior)');
      await ctx.close();
    }
    {
      // Con la red lenta, la posición llega cuando la pantalla ya da para tanto; y si se toca antes, manda quien toca
      const { ctx, p } = await abrir(/Ana López/);
      const y = () => p.evaluate(() => Math.round(scrollY));
      await p.evaluate(() => window.scrollTo(0, 600)); await p.waitForTimeout(150);
      const hoy = await y();
      await irASeccion(p, 'Semana');
      await p.locator('.semana-vista').first().waitFor();
      await p.waitForTimeout(400);
      await p.evaluate(() => localStorage.setItem('fbe-demo-retraso', '250'));
      await irASeccion(p, 'Hoy');
      await p.waitForFunction((v) => Math.abs(scrollY - v) <= 30, hoy, { timeout: 6000 }).catch(() => {});
      await p.waitForTimeout(450);
      check(Math.abs(await y() - hoy) <= 30, `con la red lenta, Hoy vuelve a su sitio en cuanto ha cargado (${hoy})`);
      await ctx.close();
    }
    // ---------- 3. «Atrás» cierra lo último que se abrió en vez de sacar de la app
    {
      const mirar = (p) => p.evaluate(() => ({ modales: document.querySelectorAll('[aria-modal="true"]').length, tab: document.querySelector('nav.tabs [aria-current="page"]')?.textContent.replace(/^\d+/, '').trim() || '',
        sesion: !!document.querySelector('.app.en-sesion'), ficha: !!document.querySelector('[aria-label="Volver a atletas"]'), chat: !!document.querySelector('[aria-label="Volver a mensajes"]'),
        nivel: history.state?.fbe ?? null, app: !!document.querySelector('nav.tabs'), ruta: location.hash }));
      const atras = async (p) => { await p.goBack({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(650); return mirar(p); };
      {
        const { ctx, p } = await abrir(/Ana López/);
        await irASeccion(p, 'Semana');
        await p.locator('.semana-vista').first().waitFor();
        await p.waitForTimeout(350);
        const a = await mirar(p);
        const b = await atras(p);
        check(a.tab === 'Semana' && a.nivel === 1 && b.app && b.tab === 'Hoy' && b.ruta === '#hoy', `atleta: desde otra pestaña, «atrás» vuelve a Hoy sin salir de la app (${a.tab} → ${b.tab} ${b.ruta})`);
        // Una sesión abierta
        await p.locator('main .btn', { hasText: /Empezar sesi|Continuar|Ver sesi/ }).first().dispatchEvent('click');
        await p.locator('.app.en-sesion').waitFor();
        await p.waitForTimeout(400);
        const c = await atras(p);
        check(c.app && !c.sesion && c.tab === 'Hoy', '«atrás» con una sesión abierta la cierra y deja en Hoy');
        // Una ventana encima de otra pestaña: primero la ventana, luego la pestaña
        await irASeccion(p, 'Progreso');
        await p.locator('.pestanas [role=tab]').first().waitFor();
        await p.waitForTimeout(350);
        await p.locator('nav.tabs .tab-mas').tap();
        await p.locator('[aria-modal="true"]').first().waitFor();
        await p.waitForTimeout(300);
        const d = await mirar(p);
        const e = await atras(p);
        const f = await atras(p);
        check(d.modales === 1 && d.nivel === 2 && e.modales === 0 && e.tab === 'Progreso' && f.tab === 'Hoy' && f.app, `con una ventana abierta, «atrás» cierra la ventana y se queda en la pestaña; otra vez, a Hoy (${d.modales}→${e.modales} ${e.tab} → ${f.tab})`);
        // Lo que se cierra con su botón no deja toques muertos: en Hoy y sin nada abierto, «atrás» sale a la primera
        await p.locator('nav.tabs .tab-mas').tap();
        await p.locator('[aria-modal="true"]').first().waitFor();
        await p.keyboard.press('Escape');
        await p.locator('[aria-modal="true"]').first().waitFor({ state: 'detached' });
        await p.waitForTimeout(600);
        const g = await mirar(p);
        const h = await atras(p);
        check(g.nivel === 0 && g.tab === 'Hoy' && !h.app, `en Hoy y sin nada abierto, «atrás» sale de la app al primer toque (entradas de sobra: ${g.nivel})`);
        await ctx.close();
      }
      {
        const { ctx, p } = await abrir(/Pelayo/);
        const filas = p.locator('tr:visible, button.tarjeta-atleta:visible');
        await filas.first().waitFor();
        await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(150);
        const y0 = await p.evaluate(() => Math.round(scrollY));
        await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().dispatchEvent('click');
        await p.getByRole('button', { name: 'Volver a atletas' }).waitFor();
        await p.waitForTimeout(400);
        // Una hoja dentro de la ficha
        await p.getByRole('button', { name: 'Nuevo bloque' }).first().tap();
        await p.locator('[aria-modal="true"]').first().waitFor();
        await p.waitForTimeout(300);
        const a = await mirar(p);
        const b = await atras(p);
        const c = await atras(p);
        const y1 = await p.evaluate(() => Math.round(scrollY));
        check(a.modales === 1 && a.ficha && b.modales === 0 && b.ficha && !c.ficha && c.app && c.tab === 'Atletas', `coach: «atrás» cierra la hoja y deja la ficha; otra vez, cierra la ficha (${a.modales}→${b.modales}, ficha ${b.ficha}→${c.ficha})`);
        check(Math.abs(y1 - y0) <= 30, `y la lista sigue donde estaba (${y0} → ${y1})`);
        // Mensajes: conversación → lista → Atletas
        await irASeccion(p, 'Mensajes');
        await p.locator('.conv-fila, .fila-conversacion, main li button, main [role=listitem] button').first().tap();
        await p.getByRole('button', { name: 'Volver a mensajes' }).waitFor();
        await p.waitForTimeout(400);
        const d = await atras(p);
        const e = await atras(p);
        check(!d.chat && d.tab === 'Mensajes' && e.tab === 'Atletas' && e.app, `en Mensajes, «atrás» vuelve de la conversación a la lista, y de ahí a Atletas (${d.tab} → ${e.tab})`);
        // Una notificación tocada con la app abierta sigue llevando a su sección (y «atrás» vuelve)
        await p.evaluate(() => { location.hash = '#revisar'; });
        await p.waitForTimeout(600);
        const f = await mirar(p);
        const g = await atras(p);
        check(f.tab === 'Revisar' && g.tab === 'Atletas' && g.app, `una dirección nueva (#revisar) sigue llevando a su sección, y «atrás» vuelve a Atletas (${f.tab} → ${g.tab})`);
        // El buscador (otra ventana, no una hoja) también se cierra con «atrás»
        await p.getByRole('button', { name: 'Buscar' }).first().tap();
        await p.locator('.paleta').waitFor();
        await p.waitForTimeout(300);
        const h = await atras(p);
        check(h.modales === 0 && h.app && h.tab === 'Atletas', '«atrás» cierra también el buscador (cualquier ventana, sin que tenga que hacer nada)');
        await ctx.close();
      }
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
