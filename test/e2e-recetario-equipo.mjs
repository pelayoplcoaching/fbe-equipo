// El recetario del equipo (migración 055), en la demo: quien solo entrena tiene la pestaña «Recetas» (capítulos, buscador,
// filtros, la ficha de la receta y guardarla); quien lleva la nutrición lo tiene dentro de Comidas y además la apunta en su
// menú; el coach ve en su biblioteca cuáles son para todo el equipo, lo abre como lo ven ellos y quita una. A 390 px en
// claro y a 360 px en oscuro, sin errores de consola, sin desbordes y sin fallos de accesibilidad.
//   Suelta:  npm run build && node test/e2e-recetario-equipo.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarRecetarioEquipo } = await import('./e2e-recetario-equipo.mjs'); await probarRecetarioEquipo({ navegador, check });
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion, haySeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRecetarioEquipo({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
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
    // (con todo quieto: el panel de una pestaña entra deslizándose)
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ]));
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const fuera = await p.evaluate((w) => [...document.querySelectorAll('[role=dialog] .btn, [role=dialog] .chip, [role=dialog] .panel, [role=dialog] li, .tarjeta-equipo')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > w + 1) && !el.closest('.selector-chips'); }).length, vista);
    if (fuera) errores.push(`${paso}: ${fuera} elementos se salen de la pantalla`);
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
    if (capturas) await p.screenshot({ path: `${capturas}/recetario-equipo-${paso}.png` });
  }
  const ficha = (p) => p.locator('[role=dialog] .receta-equipo');

  // 1. Quien solo entrena: la pestaña «Recetas»
  let { ctx, p } = await abrir();
  try {
    await entrar(p, 'Carlos');
    check(await haySeccion(p, 'Recetas') && !(await haySeccion(p, 'Comidas')), 'quien solo entrena tiene «Recetas» (y no «Comidas»)');
    await irASeccion(p, 'Recetas');
    await p.locator('.recetario-equipo .tarjeta-equipo').first().waitFor();
    const total = await p.locator('.recetario-equipo .tarjeta-equipo').count();
    check(total === 10 && /10 recetas en 4 capítulos/.test(await p.locator('.recetario-equipo [role=status]').textContent()) && await p.locator('.recetario-equipo h2').count() === 4,
      `el recetario entero, por capítulos (${total} recetas)`);
    await revisar(p, 'lista');
    await p.locator('.capitulos-equipo button', { hasText: 'Cenas' }).click();
    check(await hay(p, p.locator('.recetario-equipo .tarjeta-equipo'), 2) && await p.locator('.recetario-equipo h2').count() === 1, 'un capítulo: solo sus recetas');
    await p.locator('.capitulos-equipo button', { hasText: 'Todo' }).click();
    await p.getByRole('searchbox', { name: 'Buscar en el recetario' }).fill('platano avena');
    check(await hay(p, p.locator('.recetario-equipo .tarjeta-equipo'), 1), 'buscar por ingredientes, sin tildes: una receta');
    await p.getByRole('searchbox', { name: 'Buscar en el recetario' }).fill('zzz');
    check(await hay(p, p.locator('.recetario-equipo .tarjeta-equipo'), 0) && await p.getByText('Nada con eso').count() === 1, 'sin resultados, lo dice');
    await p.getByRole('searchbox', { name: 'Buscar en el recetario' }).fill('');
    await p.getByRole('button', { name: '15 min o menos' }).click();
    const rapidas = await p.locator('.recetario-equipo .tarjeta-equipo').count();
    check(rapidas > 0 && rapidas < 10, `el filtro «15 min o menos» (${rapidas})`);
    await p.getByRole('button', { name: 'Todas', exact: true }).click();
    // La ficha
    await p.locator('.recetario-equipo .tarjeta-equipo', { hasText: 'Tostadas con huevo y aguacate' }).click();
    await ficha(p).waitFor();
    const lineas = await ficha(p).locator('.ingredientes li').allTextContents();
    check(lineas[0] === '60 g de pan integral (2 rebanadas)' && await ficha(p).locator('.pasos-receta li').count() === 4 && /Nota de tu coach/.test(await ficha(p).textContent())
      && await ficha(p).locator('.receta-equipo-entrada').count() === 1, 'la ficha: la entrada, los ingredientes con su medida casera, los pasos numerados y la nota');
    check(await ficha(p).getByRole('button', { name: /Añadir a tu menú/ }).count() === 0, 'sin nutrición, no se ofrece el menú');
    await revisar(p, 'ficha');
    await ficha(p).getByRole('button', { name: 'Aumentar raciones que cocinas' }).or(ficha(p).locator('.paso button').last()).first().click();
    check((await ficha(p).locator('.ingredientes li').first().textContent()) === '120 g de pan integral', 'para dos raciones, el doble (y sin la medida casera)');
    await ficha(p).getByRole('button', { name: 'Guardar' }).click();
    check(await hay(p, ficha(p).getByRole('button', { name: 'Guardada', pressed: true }), 1), 'se la guarda');
    await p.keyboard.press('Escape');
    await ficha(p).waitFor({ state: 'detached' });
    await p.getByRole('button', { name: /^Favoritas/ }).click();
    check(await hay(p, p.locator('.recetario-equipo .tarjeta-equipo'), 1) && /Favoritas \(1\)/.test(await p.getByRole('button', { name: /^Favoritas/ }).textContent()), 'y sale en sus favoritas');
    // (la demo guarda en el navegador con un pequeño retraso: se espera a que la guardada esté escrita)
    await p.waitForFunction(() => Object.keys(localStorage).some((k) => /"recetas_favoritas":\[\{/.test(localStorage.getItem(k) || '')), null, { timeout: 5000 }).catch(() => {});
    await p.reload();
    await p.locator('nav.tabs').waitFor(); await cerrarDialogos(p);
    await irASeccion(p, 'Recetas');
    const vuelve = await hay(p, p.locator('.recetario-equipo .tarjeta-equipo'), 1);
    check(vuelve, `al volver a abrir la app, sigue guardada (y el filtro, donde lo dejó)${vuelve ? '' : ` [tarjetas: ${await p.locator('.recetario-equipo .tarjeta-equipo').count()}; filtros: ${(await p.locator('.recetario-equipo .selector-chips button[aria-pressed=true]').allTextContents()).join('/')}; h1: ${await p.locator('h1').first().textContent()}; guardadas: ${await p.evaluate(async () => (await globalThis.__fbeDemo.select('recetas_favoritas', {})).length)}]`}`);
  } catch (e) {
    check(false, `Recetas de quien solo entrena: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  // 2. Quien lleva la nutrición: dentro de Comidas, y al menú. A 360 px en oscuro
  ({ ctx, p } = await abrir({ ancho: 360, alto: 760, oscuro: true }));
  try {
    await entrar(p, 'Ana López');
    await p.evaluate(() => { location.hash = 'recetas'; });
    await p.waitForTimeout(400);
    check(await haySeccion(p, 'Comidas') && await p.locator('h1', { hasText: /^Recetas$/ }).count() === 0, 'quien lleva la nutrición no tiene pestaña aparte');
    await irASeccion(p, 'Comidas');
    await p.getByRole('tab', { name: 'Recetario' }).click();
    await p.locator('.recetario-equipo .tarjeta-equipo').first().waitFor();
    await revisar(p, 'comidas-oscuro');
    await p.locator('.recetario-equipo .tarjeta-equipo', { hasText: 'Lentejas estofadas' }).click();
    await ficha(p).waitFor();
    check(/Para varios días \(4 raciones\)/.test(await ficha(p).textContent()) && /da para 4 raciones/.test(await ficha(p).textContent()), 'una receta de varias raciones dice para cuántas da');
    await revisar(p, 'ficha-oscuro');
    await ficha(p).getByRole('button', { name: /Añadir a tu menú/ }).click();
    const elegir = p.getByRole('dialog', { name: 'Añadir a tu menú' });
    await elegir.waitFor();
    await elegir.getByRole('button', { name: /^Añadir el/ }).click();
    await elegir.waitFor({ state: 'detached' });
    check(await hay(p, p.getByRole('tab', { name: 'Tu semana', selected: true }), 1) && await hay(p, p.locator('#comidas-panel').getByText('Lentejas estofadas con verduras').first(), 1),
      'la apunta en su menú de hoy y vuelve a su semana');
    await revisar(p, 'menu-oscuro');
  } catch (e) {
    check(false, `El recetario dentro de Comidas: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  // 3. El coach: cuáles ve todo el equipo, cómo lo ven y quitar una
  ({ ctx, p } = await abrir({ ancho: 1280, alto: 900 }));
  try {
    await entrar(p, 'Pelayo');
    await irASeccion(p, 'Biblioteca');
    await p.getByRole('tab', { name: 'Recetas' }).click();
    await p.locator('.rejilla-recetas .tarjeta-receta').first().waitFor();
    check(await hay(p, p.locator('.rejilla-recetas .chip', { hasText: 'Todo el equipo' }), 10), 'en su biblioteca, cada receta del equipo lleva su marca');
    await p.getByRole('button', { name: /Recetario del equipo/ }).click();
    const hoja = p.getByRole('dialog', { name: 'Recetario del equipo' });
    await hoja.locator('.tarjeta-equipo').first().waitFor();
    check(await hoja.locator('.tarjeta-equipo').count() === 10 && await hoja.getByRole('button', { name: /^Favoritas/ }).count() === 0, 'lo abre como lo ven sus atletas (sin favoritas)');
    await revisar(p, 'coach');
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });
    await p.locator('.rejilla-recetas .tarjeta-receta', { hasText: 'Batido de proteína' }).click();
    const editar = p.getByRole('dialog', { name: 'Editar receta' });
    const interruptor = editar.getByRole('switch', { name: /Para todo el equipo/ });
    await interruptor.waitFor();
    check(await interruptor.isChecked(), 'al editarla, el interruptor «Para todo el equipo» está puesto');
    await revisar(p, 'coach-editar');
    await interruptor.click();
    await p.getByText('Ya solo la ve quien la tenga en su recetario').waitFor();
    await editar.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await editar.waitFor({ state: 'detached' });
    check(await hay(p, p.locator('.rejilla-recetas .chip', { hasText: 'Todo el equipo' }), 9), 'la quita del equipo: quedan nueve');
    await p.getByRole('button', { name: /Para todo el equipo \(9\)/ }).click();
    check(await hay(p, p.locator('.rejilla-recetas .tarjeta-receta'), 9), 'y puede ver solo las del equipo');
  } catch (e) {
    check(false, `El recetario del equipo, del coach: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  check(errores.length === 0, `sin errores de consola, desbordes ni fallos de accesibilidad${errores.length ? `: ${errores.slice(0, 5).join(' ## ')}` : ''}`);
}

// Suelta
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4179);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('El recetario del equipo');
  await probarRecetarioEquipo({ navegador, check, base: 'http://localhost:4179', capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
