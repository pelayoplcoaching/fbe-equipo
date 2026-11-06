// Pulido de fluidez, en la demo y en un móvil simulado (táctil): que lo pulsable responda al pulsarlo, que no se pierda el
// sitio al volver, que «atrás» cierre lo abierto en vez de salir, y lo demás de web/src/ui/pulido.js y pulido.css.
//   Suelta:  npm run build && node test/e2e-pulido.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPulido } = await import('./e2e-pulido.mjs'); await probarPulido({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarPulido({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  // escrituras: las de la demo pasan por un envoltorio que las puede hacer lentas (window.__espera, en ms) o que
  // fallen (window.__falla), y las cuenta (window.__escritas). Se pone antes de entrar: la app se queda con ellas al entrar
  const abrir = async (quien, opciones = {}, { escrituras = false, antes = null } = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: 'es-ES', ...opciones });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Sin conexi/.test(m.text())) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    if (escrituras) {
      // (la app se queda con las escrituras del backend al arrancar: el envoltorio se pone en cuanto el backend existe)
      await p.addInitScript(() => {
        window.__escritas = 0; window.__falla = false; window.__espera = 0;
        Object.defineProperty(globalThis, '__fbeDemo', { configurable: true, get() { return undefined; }, set(b) {
          for (const m of ['insert', 'update', 'upsert', 'delete']) {
            const o = b[m].bind(b);
            b[m] = async (...a) => { if (window.__espera) await new Promise((r) => setTimeout(r, window.__espera)); if (window.__falla) throw new Error('Sin conexión: no se ha podido guardar'); const r = await o(...a); window.__escritas++; return r; };
          }
          Object.defineProperty(globalThis, '__fbeDemo', { configurable: true, writable: true, value: b });
        } });
      });
    }
    if (antes) await antes(p);
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
    // ---------- 4. Al volver a una lista se ve al momento (lo último cargado) y se pone al día por detrás
    {
      const { ctx, p } = await abrir(/Pelayo/);
      const filas = p.locator('tr:visible, button.tarjeta-atleta:visible');
      await filas.first().waitFor();
      await p.evaluate(() => localStorage.setItem('fbe-demo-retraso', '250'));   // (cada consulta, 250 ms: una red de móvil)
      await irASeccion(p, 'Mensajes');
      await p.locator('main').getByText(/Ana López/).first().waitFor();
      // Mientras se está en otra sección, algo cambia en la base (otro dispositivo, el propio atleta…)
      await p.evaluate(async () => { const b = globalThis.__fbeDemo; const [a] = await b.select('atletas', { eq: { nombre: 'Rubén Martín' } }); await b.update('atletas', { nombre: 'Rubén Martín Soler' }, { eq: { id: a.id } }); });
      await irASeccion(p, 'Atletas');
      await p.waitForTimeout(350);   // (la transición; con la red a 250 ms por consulta, la lista entera tardaría más de un segundo)
      const alVolver = await p.evaluate(() => ({ filas: document.querySelectorAll('tr, button.tarjeta-atleta').length, cargando: document.querySelectorAll('main .siluetas').length, texto: document.querySelector('main')?.textContent || '' }));
      check(alVolver.filas >= 5 && alVolver.cargando === 0 && /Rubén Martín/.test(alVolver.texto), `coach: al volver a Atletas la lista está al momento, sin pantalla de carga (${alVolver.filas} filas)`);
      const alDia = await p.waitForFunction(() => /Rubén Martín Soler/.test(document.querySelector('main')?.textContent || ''), null, { timeout: 8000 }).then(() => true).catch(() => false);
      check(alDia, 'y se pone al día por detrás: el cambio hecho mientras tanto aparece solo');
      // Una ficha ya abierta, igual
      await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().dispatchEvent('click');
      await p.locator('.pestanas [role=tab]').first().waitFor({ timeout: 8000 });
      await p.getByRole('button', { name: 'Volver a atletas' }).tap();
      await filas.first().waitFor();
      await p.waitForTimeout(400);
      await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().dispatchEvent('click');
      await p.waitForTimeout(350);
      const ficha2 = await p.evaluate(() => ({ pestanas: document.querySelectorAll('.pestanas [role=tab]').length, cargandoFicha: [...document.querySelectorAll('.siluetas')].filter((e) => /la ficha/.test(e.textContent)).length }));
      check(ficha2.pestanas > 3 && ficha2.cargandoFicha === 0, 'una ficha que ya se abrió vuelve a abrirse al momento');
      await ctx.close();
    }
    {
      // Al cambiar de cuenta no queda nada de la anterior
      const { ctx, p } = await abrir(/Pelayo/);
      await p.locator('tr:visible, button.tarjeta-atleta:visible').first().waitFor();
      await p.getByRole('button', { name: 'Cambiar de cuenta' }).first().tap();
      await p.getByRole('button', { name: /Pelayo/ }).first().waitFor();
      await p.evaluate(() => localStorage.setItem('fbe-demo-retraso', '300'));
      await p.getByRole('button', { name: /Pelayo/ }).first().tap();
      await p.locator('nav.tabs').waitFor();
      const cargando = await p.locator('main .siluetas').first().waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
      check(cargando, 'al cambiar de cuenta se empieza de cero: la lista se carga de nuevo (no se enseña la de la cuenta anterior)');
      await ctx.close();
    }
    // ---------- 5. Lo que se marca se ve al momento (se guarda por detrás; si no se puede guardar, se deshace y se avisa)
    {
      // (la demo guarda al instante: aquí cada escritura tarda 1,5 s, como una red mala, o falla)
      const lenta = (p, ms) => p.evaluate((t) => { window.__espera = t; window.__escritas = 0; }, ms);
      {
        const { ctx, p } = await abrir(/Lucía Ferrer/, {}, { escrituras: true });
        await irASeccion(p, 'Comidas');
        const semana = p.getByRole('tab', { name: 'Tu semana' });
        if (await semana.isVisible().catch(() => false)) await semana.tap();
        const casillas = p.locator('.entrada-menu .casilla-redonda');
        await casillas.first().waitFor();
        await lenta(p, 1500);
        const antes = await casillas.first().getAttribute('aria-pressed');
        await casillas.first().tap();
        await p.waitForTimeout(250);
        const alMomento = { pulsada: await casillas.first().getAttribute('aria-pressed'), escritas: await p.evaluate(() => window.__escritas) };
        await p.waitForFunction(() => window.__escritas >= 1, null, { timeout: 6000 });
        await p.waitForTimeout(500);
        const despues = await casillas.first().getAttribute('aria-pressed');
        check(alMomento.pulsada !== antes && alMomento.escritas === 0 && despues === alMomento.pulsada, `una comida se marca al tocarla, antes de que la base conteste, y así se queda (${antes} → ${alMomento.pulsada})`);
        // Varias seguidas, sin esperar a ninguna
        const n = Math.min(3, await casillas.count());
        const previas = [];
        for (let i = 0; i < n; i++) previas.push(await casillas.nth(i).getAttribute('aria-pressed'));
        for (let i = 0; i < n; i++) await casillas.nth(i).tap();
        await p.waitForTimeout(200);
        const seguidas = [];
        for (let i = 0; i < n; i++) seguidas.push(await casillas.nth(i).getAttribute('aria-pressed'));
        await p.waitForFunction((k) => window.__escritas >= 1 + k, n, { timeout: 8000 });
        await p.waitForTimeout(600);
        const finales = [];
        for (let i = 0; i < n; i++) finales.push(await casillas.nth(i).getAttribute('aria-pressed'));
        check(n >= 2 && seguidas.every((x, i) => x !== previas[i]) && finales.join() === seguidas.join(), `se pueden marcar ${n} seguidas sin esperar, y quedan como se dejaron`);
        // Si no se puede guardar, se deshace y se avisa
        await p.evaluate(() => { window.__falla = true; });
        const a0 = await casillas.first().getAttribute('aria-pressed');
        await casillas.first().tap();
        await p.waitForTimeout(250);
        const a1 = await casillas.first().getAttribute('aria-pressed');
        await p.locator('.toast.error, .toast[role=alert]').first().waitFor({ timeout: 6000 }).catch(() => {});
        await p.waitForTimeout(400);
        const a2 = await casillas.first().getAttribute('aria-pressed');
        check(a1 !== a0 && a2 === a0 && await p.locator('.toast').filter({ hasText: /no se ha podido guardar/i }).count() >= 1, 'si no se puede guardar, la casilla vuelve a como estaba y se avisa');
        await ctx.close();
      }
      {
        const { ctx, p } = await abrir(/Ana López/, {}, { escrituras: true });
        // (los hábitos van en un plegable de Hoy)
        await p.locator('details.plegable-hoy[data-plegable="habitos"]').waitFor({ state: 'attached' });
        await p.evaluate(() => { document.querySelector('details.plegable-hoy[data-plegable="habitos"]').open = true; });
        const teselas = p.locator('.habito-tile');
        await teselas.first().waitFor();
        await lenta(p, 1500);
        const sinMarcar = p.locator('.habito-tile', { hasText: 'Sin marcar' }).first();
        const hay = await sinMarcar.count();
        if (hay) {
          const nombre = (await sinMarcar.locator('.habito-nombre').textContent()).trim();
          await sinMarcar.tap();
          await p.locator('[aria-modal="true"] .si-no button', { hasText: 'Hecho' }).tap();
          await p.waitForTimeout(450);
          const t = p.locator('.habito-tile', { hasText: nombre }).first();
          const r = { hoja: await p.locator('[aria-modal="true"]').count(), texto: (await t.locator('.habito-valor').textContent()).trim(), cumple: await t.locator('.anillo-habito.cumple').count(), escritas: await p.evaluate(() => window.__escritas) };
          await p.waitForFunction(() => window.__escritas >= 1, null, { timeout: 6000 });
          await p.locator('.toast').filter({ hasText: /hecho/i }).first().waitFor({ timeout: 4000 }).catch(() => {});
          check(r.hoja === 0 && r.cumple === 1 && !/Sin marcar/.test(r.texto) && r.escritas === 0 && await t.locator('.anillo-habito.cumple').count() === 1,
            `un hábito apuntado cierra su hoja y llena su anillo al momento, antes de que la base conteste («${r.texto}»)`);
        } else check(false, 'no hay un hábito de sí o no sin marcar en la demo para probarlo');
        await ctx.close();
      }
      {
        const { ctx, p } = await abrir(/Pelayo/, {}, { escrituras: true });
        await irASeccion(p, 'Revisar');
        const botones = p.locator('.tarjeta-revisar button.revisar-hecho[data-deshacer]');
        await botones.first().waitFor();
        await lenta(p, 1500);
        const n0 = await p.locator('.tarjeta-revisar').count();
        await botones.first().tap();
        await p.waitForTimeout(300);
        const r = { tarjetas: await p.locator('.tarjeta-revisar').count(), escritas: await p.evaluate(() => window.__escritas) };
        await p.waitForFunction(() => window.__escritas >= 1, null, { timeout: 6000 });
        await p.locator('.toast').filter({ hasText: /revisad/i }).first().waitFor({ timeout: 4000 }).catch(() => {});
        await p.waitForTimeout(500);
        check(r.tarjetas === n0 - 1 && r.escritas === 0 && await p.locator('.tarjeta-revisar').count() === n0 - 1, `coach: lo que se marca como revisado sale de la lista al momento (${n0} → ${r.tarjetas})`);
        await ctx.close();
      }
    }
    // ---------- 6 y 7. Vibración al tocar (también en iPhone, donde iOS lo deja) y sonido al marcar una serie
    {
      // (el navegador de las pruebas no vibra: se apunta lo que la app pide)
      const espiar = (p) => p.addInitScript(() => { window.__vib = []; try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value(x) { window.__vib.push(JSON.stringify(x)); return true; } }); } catch { /* */ } });
      {
        const ctx0 = await abrir(/Lucía Ferrer/, {}, { escrituras: true, antes: espiar });
        const { ctx, p } = ctx0;
        await irASeccion(p, 'Comidas');
        const semana = p.getByRole('tab', { name: 'Tu semana' });
        if (await semana.isVisible().catch(() => false)) await semana.tap();
        const casillas = p.locator('.entrada-menu .casilla-redonda');
        await casillas.first().waitFor();
        await p.evaluate(() => { window.__vib = []; });
        await casillas.first().tap();
        await p.waitForTimeout(200);
        const v1 = await p.evaluate(() => window.__vib.slice());
        // un fallo, además, se nota: dos golpes
        await p.evaluate(() => { window.__vib = []; window.__falla = true; });
        await casillas.first().tap();
        await p.locator('.toast').filter({ hasText: /no se ha podido guardar/i }).first().waitFor({ timeout: 5000 }).catch(() => {});
        const v2 = await p.evaluate(() => window.__vib.slice());
        check(v1.includes('8') && v2.includes('[28,60,28]'), `marcar una casilla da un toque corto, y un error, dos golpes (${v1.join(' ')} · ${v2.join(' ')})`);
        // Con «Vibración al tocar» apagada, nada
        await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'); localStorage.setItem('fbe-ajustes', JSON.stringify({ ...a, hapticos: false })); window.__falla = false; });
        await p.reload();
        await p.locator('nav.tabs').waitFor();
        await irASeccion(p, 'Comidas');
        if (await semana.isVisible().catch(() => false)) await semana.tap();
        await casillas.first().waitFor();
        await p.evaluate(() => { window.__vib = []; });
        await casillas.first().tap();
        await p.waitForTimeout(250);
        check((await p.evaluate(() => window.__vib.length)) === 0, 'con «Vibración al tocar» apagada, no vibra');
        await ctx.close();
      }
      {
        // En un iPhone (sin vibración para las webs), el toque sale del interruptor del sistema, sin que la app se entere
        const iphone = (p) => p.addInitScript(() => {
          try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: undefined }); } catch { /* */ }
          Object.defineProperty(HTMLInputElement.prototype, 'switch', { configurable: true, get() { return this.hasAttribute('switch'); } });
          window.__toques = 0; window.__clicsFuera = 0;
          const clic = HTMLLabelElement.prototype.click;
          HTMLLabelElement.prototype.click = function (...a) { if (this.querySelector('input[switch]')) window.__toques++; return clic.apply(this, a); };
          document.addEventListener('click', (e) => { if (e.target?.matches?.('label[aria-hidden], input[switch]')) window.__clicsFuera++; });
        });
        const { ctx, p } = await abrir(/Lucía Ferrer/, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1' }, { antes: iphone });
        await irASeccion(p, 'Comidas');
        const semana = p.getByRole('tab', { name: 'Tu semana' });
        if (await semana.isVisible().catch(() => false)) await semana.tap();
        const casillas = p.locator('.entrada-menu .casilla-redonda');
        await casillas.first().waitFor();
        await p.evaluate(() => { window.__toques = 0; });
        await casillas.first().tap();
        await p.waitForTimeout(250);
        const r = await p.evaluate(() => ({ toques: window.__toques, fuera: window.__clicsFuera, restos: document.querySelectorAll('head label, input[switch]').length }));
        check(r.toques === 1 && r.fuera === 0 && r.restos === 0, `en iPhone, marcar una casilla pide un toque al interruptor del sistema, sin dejar rastro en la página (${r.toques} toque, ${r.fuera} clics fuera, ${r.restos} restos)`);
        await ctx.close();
      }
      {
        const sonidos = (p) => p.addInitScript(() => { window.__son = []; window.addEventListener('fbe-sonido', (e) => window.__son.push(e.detail?.tipo)); });
        const { ctx, p } = await abrir(/Ana López/, {}, { antes: sonidos });
        const entrar = async () => {
          await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).dispatchEvent('click');
          await p.locator('.portada-sesion, .ejercicio').first().waitFor();
          if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
          await p.locator('.ejercicio').first().waitFor();
          if (await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).count()) await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).click();
          await p.waitForTimeout(400);
          for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
        };
        const marcar = async (n) => {
          const ej = p.locator('.sesion-vista .ejercicio').first();
          if (await ej.locator('.ejercicio-cab').getAttribute('aria-expanded') !== 'true') await ej.locator('.ejercicio-cab').click();
          await ej.getByRole('button', { name: `Marcar la serie ${n} como hecha` }).click();
          await ej.getByRole('button', { name: `Quitar la serie ${n}` }).waitFor();
        };
        await entrar();
        await p.evaluate(() => { window.__son = []; });
        await marcar(1);
        const s1 = await p.evaluate(() => window.__son.slice());
        check(s1.filter((x) => x === 'serie').length === 1, `al marcar una serie suena un tic (${s1.join(', ') || 'nada'})`);
        // Con su interruptor apagado, no
        await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'); localStorage.setItem('fbe-ajustes', JSON.stringify({ ...a, sonidoSerie: false })); window.dispatchEvent(new Event('fbe-ajustes')); });
        await p.reload();
        await p.locator('.hero-dia').waitFor();
        await entrar();
        await p.evaluate(() => { window.__son = []; });
        await marcar(2);
        check((await p.evaluate(() => window.__son.filter((x) => x === 'serie').length)) === 0, 'con «Sonido al marcar una serie» apagado, no suena');
        await ctx.close();
      }
      {
        // Quien tenía apagado el sonido del descanso no oye nada nuevo; y el ajuste está en su sitio
        const { ctx, p } = await abrir(/Ana López/);
        const r = await p.evaluate(async () => {
          localStorage.setItem('fbe-ajustes', JSON.stringify({ sonido: false }));
          return true;
        });
        await p.reload();
        await p.locator('nav.tabs').waitFor();
        await irASeccion(p, 'Perfil');
        await p.getByRole('button', { name: /Sonido y vibración/ }).first().tap();
        const interruptor = p.locator('#aj-sonido-serie');
        await interruptor.waitFor({ state: 'attached' });
        check(r && await interruptor.isChecked() === false, 'el ajuste «Sonido al marcar una serie» está en Sonido y vibración, y sale apagado para quien tenía apagado el sonido del descanso');
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
