// «Aprende» (migración 057), en la demo: el atleta abre las guías, lee una, abre la ficha de un ejercicio desde la guía y
// desde el buscador, y ve esa misma ficha en la pestaña «Técnica» del ejercicio (desde Progreso), con el enlace a su guía;
// el coach ve sus guías en Biblioteca, esconde una y enlaza un ejercicio con una ficha. A 390 px en claro, a 360 px en
// oscuro y en escritorio, sin errores de consola, sin desbordes y sin fallos de accesibilidad.
//   Suelta:  npm run build && node test/e2e-guias.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarGuias } = await import('./e2e-guias.mjs'); await probarGuias({ navegador, check });
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion, haySeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarGuias({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
  const errores = [];
  async function abrir({ ancho = 390, alto = 844, oscuro = false } = {}) {
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, locale: 'es-ES', bypassCSP: true, hasTouch: ancho < 700, colorScheme: oscuro ? 'dark' : 'light' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.goto(`${base}/?demo`);
    return { ctx, p };
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
  const entrar = async (p, quien) => {
    await p.getByRole('button', { name: new RegExp(quien) }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos(p);
  };
  const hay = async (p, loc, n, ms = 8000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  async function revisar(p, paso) {
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ]));
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const fuera = await p.evaluate((w) => [...document.querySelectorAll('[role=dialog] .btn, [role=dialog] li, [role=dialog] table, .guia-caja, .tarjeta-guia, .ideas-guia li, .fila-ficha')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > w + 1) && !el.closest('.selector-chips, .tabla-desliza'); }).length, vista);
    if (fuera) errores.push(`${paso}: ${fuera} elementos se salen de la pantalla`);
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
    if (capturas) await p.screenshot({ path: `${capturas}/guias-${paso}.png` });
  }
  const leer = async (p, anchoMin) => {
    await irASeccion(p, 'Aprende');
    await p.locator('.tarjeta-guia').first().waitFor();
    check(await p.locator('.tarjeta-guia').count() === 2 && /2 ejercicios/.test(await p.locator('.tarjeta-guia', { hasText: 'Pectoral' }).textContent()), `«Aprende»: las dos guías, con cuántos ejercicios tiene cada una (${anchoMin} px)`);
    await revisar(p, `lista-${anchoMin}`);
    await p.locator('.tarjeta-guia', { hasText: 'Pectoral' }).click();
    await p.locator('.lector-guia .guia-seccion').first().waitFor();
    check(await p.locator('h1', { hasText: /^Pectoral$/ }).count() === 1 && await p.locator('.lector-guia .guia-seccion').count() === 4 && await p.locator('.lector-guia .guia-caja').count() === 3
      && await p.locator('.lector-guia .guia-cita').count() === 1 && await p.locator('.lector-guia .ideas-guia li').count() === 2 && await p.locator('.lector-guia strong', { hasText: 'cómo se hace' }).count() === 1
      && !(await p.locator('.lector-guia').textContent()).includes('**'), 'la guía entera: la cita, las secciones con sus cajas y su negrita, y las ideas clave');
    await revisar(p, `guia-${anchoMin}`);
    await p.locator('.lector-guia .fila-ficha', { hasText: 'Press de banca con barra' }).click();
    const hoja = p.getByRole('dialog', { name: 'Press de banca con barra' });
    await hoja.locator('.ficha-fbe').waitFor();
    check(await hoja.locator('.pasos-guia li').count() === 5 && await hoja.locator('.errores-guia li').count() === 3 && await hoja.locator('.niveles-guia > div').count() === 3
      && await hoja.locator('.tabla-guia tbody tr').count() === 3 && await hoja.getByText('Sí, cuando').count() === 1 && await hoja.getByText('No, cuando').count() === 1, 'la ficha de un ejercicio: cinco pasos, tres errores, tres niveles, cuándo sí y cuándo no, y la tabla por objetivo');
    await revisar(p, `ficha-${anchoMin}`);
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });
    await p.getByRole('button', { name: 'Volver a las guías' }).click();
    await p.locator('.tarjeta-guia').first().waitFor();
  };

  // 1. El atleta: Aprende, una guía, una ficha, el buscador y la pestaña «Técnica» del ejercicio
  let { ctx, p } = await abrir();
  try {
    await entrar(p, 'Ana López');
    check(await haySeccion(p, 'Aprende'), 'quien entrena tiene «Aprende»');
    await leer(p, 390);
    await p.getByRole('searchbox', { name: 'Buscar un ejercicio en las guías' }).fill('sentadilla');
    check(await hay(p, p.locator('.aprende .fila-ficha'), 1) && /Cuádriceps/.test(await p.locator('.aprende .fila-ficha').textContent()), 'el buscador encuentra un ejercicio de cualquier guía y dice de cuál es');
    await p.getByRole('searchbox', { name: 'Buscar un ejercicio en las guías' }).fill('zzz');
    check(await hay(p, p.getByText('Ningún ejercicio con eso'), 1), 'sin resultados, lo dice');
    // La misma ficha, dentro del ejercicio
    await irASeccion(p, 'Progreso');
    const abierta = await p.evaluate(async () => {
      const b = globalThis.__fbeDemo;
      const e = (await b.select('ejercicios', {})).find((x) => x.nombre === 'Press banca');
      return e?.id || null;
    });
    await p.locator('main button', { hasText: /^Fuerza$/ }).first().click();
    await p.locator('main button:visible', { hasText: /^Press banca$/ }).first().click();
    await p.locator('button:visible', { hasText: 'Gráficas, récords e historial' }).first().click();
    const fichaEj = p.locator('.hoja-dialogo.ficha-ejercicio');
    await fichaEj.waitFor();
    const titulo = (await fichaEj.locator('h2').first().textContent()).trim();
    if (titulo === 'Press banca' && abierta) {
      await fichaEj.getByRole('tab', { name: 'Técnica' }).click();
      await fichaEj.locator('.ficha-fbe').waitFor();
      check(await fichaEj.locator('.pasos-guia li').count() === 5 && await fichaEj.getByRole('button', { name: 'Ver la guía de Pectoral' }).count() === 1, 'en la ficha del ejercicio, la pestaña «Técnica» enseña su ficha de las guías');
      await revisar(p, 'tecnica');
      await fichaEj.getByRole('button', { name: 'Ver la guía de Pectoral' }).click();
      const guia = p.getByRole('dialog', { name: 'Pectoral', exact: true });
      await guia.locator('.lector-guia .guia-seccion').first().waitFor();
      check(await guia.locator('.guia-seccion').count() === 4, 'y desde ahí se abre su guía');
      await p.keyboard.press('Escape');
      await guia.waitFor({ state: 'detached' });
    } else check(false, `no se pudo abrir la ficha de «Press banca» desde Progreso (se abrió «${titulo}»)`);
  } catch (e) {
    check(false, `Aprende, del atleta: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  // 2. A 360 px en oscuro
  ({ ctx, p } = await abrir({ ancho: 360, alto: 760, oscuro: true }));
  try {
    await entrar(p, 'Carlos');
    await leer(p, 360);
  } catch (e) {
    check(false, `Aprende a 360 px en oscuro: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  // 3. Quien solo lleva la nutrición no tiene «Aprende»; el coach: sus guías, esconder una y enlazar un ejercicio
  ({ ctx, p } = await abrir({ ancho: 1280, alto: 900 }));
  try {
    await entrar(p, 'Lucía');
    check(!(await p.locator('nav.tabs .tab', { hasText: 'Aprende' }).count()), 'quien solo lleva la nutrición no tiene «Aprende»');
    await p.evaluate(() => { localStorage.removeItem('fbe-demo-v2-sesion'); });
    await p.goto(`${base}/?demo`);
    await entrar(p, 'Pelayo');
    await irASeccion(p, 'Biblioteca');
    await p.getByRole('tab', { name: 'Guías' }).click();
    await p.locator('.tarjeta-guia').first().waitFor();
    check(await p.locator('.tarjeta-guia').count() === 2 && /3 ejercicios enlazados/.test(await p.locator('#bib-panel').textContent()), 'el coach ve sus guías en Biblioteca y cuántos ejercicios llevan ficha');
    await revisar(p, 'coach');
    await p.locator('.tarjeta-guia', { hasText: 'Cuádriceps' }).click();
    const hoja = p.getByRole('dialog', { name: 'Cuádriceps' });
    await hoja.locator('.lector-guia').waitFor();
    await revisar(p, 'coach-guia');
    await hoja.getByRole('switch', { name: /Publicada/ }).click();
    await p.getByText('Escondida: tus atletas ya no la ven').waitFor();
    await hoja.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await hoja.waitFor({ state: 'detached' });
    check(await hay(p, p.locator('.tarjeta-guia .chip', { hasText: 'Sin publicar' }), 1), 'esconde una guía: queda marcada «Sin publicar»');
    await p.getByRole('tab', { name: 'Ejercicios' }).click();
    await p.getByRole('searchbox').first().fill('Remo con barra');
    await p.locator('#bib-panel button', { hasText: 'Remo con barra' }).first().click();
    const editar = p.getByRole('dialog', { name: 'Editar ejercicio' });
    const selector = editar.getByLabel(/Ficha de técnica/);
    await selector.waitFor();
    check(await selector.inputValue() === '', 'al editar un ejercicio sin ficha, el selector dice «Sin ficha»');
    await selector.selectOption({ label: 'Press de banca con barra (Pectoral)' });
    await p.getByText('Ficha enlazada: sus atletas la ven en «Técnica»').waitFor();
    check(await hay(p, editar.getByRole('button', { name: 'Ver la ficha' }), 1), 'le pone una ficha de sus guías (y la puede ver)');
    await revisar(p, 'coach-enlazar');
  } catch (e) {
    check(false, `Las guías, del coach: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  check(errores.length === 0, `sin errores de consola, desbordes ni fallos de accesibilidad${errores.length ? `: ${errores.slice(0, 5).join(' ## ')}` : ''}`);
}

// Suelta
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4177);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('«Aprende»: las guías y la ficha de cada ejercicio');
  await probarGuias({ navegador, check, base: 'http://localhost:4177', capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
