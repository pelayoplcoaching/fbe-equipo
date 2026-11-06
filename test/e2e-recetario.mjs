// El recetario al día con el plan, en la demo: el coach abre el recetario de una atleta y lo comprueba con su plan (la
// tabla del día frente al plan), corrige las calorías de dos recetas que no coinciden con sus macros, reescala con un
// factor (eligiendo comidas y viendo antes cómo quedan los macros) y, desde Biblioteca → Recetas, ve los recetarios de
// todo el equipo. En escritorio y a 360 px en oscuro, sin errores de consola, sin desbordes y sin fallos de accesibilidad.
// Necesita los dos botones enganchados en ComidasCoach.jsx: test/recetario-enganche.patch.
//   Suelta:  npm run build && node test/e2e-recetario.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarRecetario } = await import('./e2e-recetario.mjs'); await probarRecetario({ navegador, check });
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRecetario({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const foto = async (nombre) => { if (capturas) await p.screenshot({ path: `${capturas}/${nombre}.png` }); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 1280;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const fuera = await p.evaluate((w) => [...document.querySelectorAll('[role=dialog] .btn, [role=dialog] table, [role=dialog] .chip, [role=dialog] .panel')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > w + 1) && !el.closest('.selector-chips'); }).length, vista);
    if (fuera) errores.push(`${paso}: ${fuera} elementos de la hoja se salen de la pantalla`);
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
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
  const entrar = async () => {
    await p.getByRole('button', { name: /Pelayo/ }).first().click().catch(() => {});
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
  };
  const hoja = () => p.getByRole('dialog', { name: 'El recetario de Lucía y su plan' });
  const equipo = () => p.getByRole('dialog', { name: 'Los recetarios y sus planes' });
  const kcalFila = async () => (await hoja().locator('table tbody tr').first().locator('td').allTextContents()).map((t) => t.trim());

  try {
    await p.goto(`${base}/?demo`);
    await entrar();
    // Dos recetas de Lucía con las calorías cambiadas (como las que venían mal de Notion)
    const estropeadas = await p.evaluate(async () => {
      const b = globalThis.__fbeDemo;
      const lucia = (await b.select('atletas', {})).find((a) => a.nombre === 'Lucía Ferrer');
      const ids = [...new Set((await b.select('recetas_atleta', { eq: { atleta_id: lucia.id } })).filter((a) => a.toma === 'cena').map((a) => a.receta_id))].slice(0, 2);
      const rs = await b.select('recetas', { in: { id: ids } });
      for (const r of rs) await b.update('recetas', { kcal: Math.round(Number(r.kcal) * 1.25) }, { eq: { id: r.id } });
      return rs.map((r) => ({ id: r.id, nombre: r.nombre, antes: Math.round(Number(r.kcal) * 1.25), macros: Math.round(4 * r.proteina_g + 4 * r.carbos_g + 9 * r.grasa_g) }));
    });
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Lucía Ferrer' }).first().click();
    await p.getByRole('tab', { name: 'Nutrición' }).click();
    await p.getByRole('tab', { name: 'Recetario' }).click();
    const boton = p.getByRole('button', { name: 'Comprobar con el plan' });
    await boton.waitFor();
    check(await boton.count() === 1, 'en el recetario de la atleta hay un botón «Comprobar con el plan»');
    await boton.click();
    await hoja().locator('table').waitFor();
    check(await hoja().locator('.chip.alerta', { hasText: 'No cuadra con el plan' }).count() === 1, 'dice que no cuadra con el plan');
    const fila0 = await kcalFila();
    check(fila0.length === 3 && /^\d/.test(fila0[0]) && /%/.test(fila0[2]) && await hoja().locator('table tbody tr').count() === 4, `la tabla del día frente al plan, con calorías y los tres macros: ${fila0.join(' | ')}`);
    check(/Los días sin merienda: [\d.]+ kcal/.test(await hoja().textContent()), 'y lo que da un día sin su comida opcional');
    // Las recetas con las calorías mal
    const mal = hoja().locator('section', { hasText: 'recetas con las calorías mal puestas' });
    check(await mal.count() === 1 && /^2 recetas con las calorías mal puestas/.test(await mal.locator('h3').textContent()), 'detecta las 2 recetas con las calorías mal puestas');
    const textoMal = await mal.textContent();
    check(estropeadas.every((r) => textoMal.includes(`${r.nombre}: ${r.antes} → ${r.macros} kcal`)), 'cada una con las calorías de ahora y las que le tocan por sus macros');
    check(/Corrige antes las calorías de las recetas/.test(await hoja().locator('section', { hasText: 'Reescalar con un factor' }).textContent()), 'y no deja reescalar hasta corregirlas');
    await revisar('con-kcal-mal');
    await foto('recetario-1-kcal-mal');
    await mal.getByRole('button', { name: 'Corregir las calorías de 2 recetas' }).click();
    check(/no se pueden recuperar/.test(await mal.textContent()), 'antes de corregir, avisa de que las calorías de ahora se pierden');
    await mal.getByRole('button', { name: 'Sí, corregirlas' }).click();
    await p.locator('.toast', { hasText: 'Calorías corregidas en 2 recetas' }).waitFor();
    check(await hay(hoja().locator('section', { hasText: 'calorías mal puestas' }), 0), 'al corregirlas, desaparecen de la lista');
    const enBase = await p.evaluate(async (rs) => (await globalThis.__fbeDemo.select('recetas', { in: { id: rs.map((r) => r.id) } })).map((r) => [Math.round(Number(r.kcal)), Math.round(4 * r.proteina_g + 4 * r.carbos_g + 9 * r.grasa_g)]), estropeadas);
    check(enBase.length === 2 && enBase.every(([k, m]) => k === m), 'y en la base sus calorías son las de sus macros');

    // Reescalar con un factor
    const factor = hoja().locator('section', { hasText: 'Reescalar con un factor' });
    await factor.getByRole('button', { name: /^Aplicar ×/ }).waitFor();
    const texto1 = await factor.textContent();
    const f1 = /Factor ×([\d,]+) en (\d+) recetas/.exec(texto1);
    check(!!f1 && Number(f1[1].replace(',', '.')) > 1 && /El día quedaría en [\d.]+ kcal \(plan [\d.]+\): proteína \d+ g \([+−=]\d*\), hidratos \d+ g/.test(texto1), `propone un factor y dice cómo quedarían las calorías y los macros: ×${f1?.[1]} en ${f1?.[2]} recetas`);
    check(/El factor mueve todos los macros a la vez/.test(texto1), 'avisa de que el factor mueve todos los macros a la vez');
    // Sin las comidas principales: menos recetas y otro factor
    await factor.getByRole('group', { name: 'Comidas que se reescalan' }).getByRole('button', { name: 'Comida', exact: true }).click();
    await factor.getByRole('group', { name: 'Comidas que se reescalan' }).getByRole('button', { name: 'Cena', exact: true }).click();
    await p.waitForTimeout(150);
    const texto2 = await factor.textContent();
    const f2 = /Factor ×([\d,]+) en (\d+) recetas/.exec(texto2);
    check((!!f2 && Number(f2[2]) < Number(f1[2]) && f2[1] !== f1[1]) || /no se llega a las calorías del plan/.test(texto2), 'al quitar comida y cena, el factor se recalcula solo para las demás (o dice que no se llega)');
    await factor.getByRole('group', { name: 'Comidas que se reescalan' }).getByRole('button', { name: 'Comida', exact: true }).click();
    await factor.getByRole('group', { name: 'Comidas que se reescalan' }).getByRole('button', { name: 'Cena', exact: true }).click();
    await revisar('factor');
    await foto('recetario-2-factor');
    const leerFactores = () => p.evaluate(async () => { const b = globalThis.__fbeDemo; const lucia = (await b.select('atletas', {})).find((x) => x.nombre === 'Lucía Ferrer'); return Object.fromEntries((await b.select('recetas_atleta', { eq: { atleta_id: lucia.id } })).map((x) => [x.id, Number(x.factor)])); });
    const factoresAntes = await leerFactores();
    await factor.getByRole('button', { name: /^Aplicar ×/ }).click();
    check(/verá las cantidades nuevas en su app/.test(await factor.textContent()), 'antes de aplicar, avisa de que la atleta verá las cantidades nuevas');
    await factor.getByRole('button', { name: 'Sí, aplicarlo' }).click();
    await p.locator('.toast', { hasText: /Factor ×[\d,]+ aplicado a \d+ recetas/ }).waitFor();
    check(await hay(factor.locator('p', { hasText: 'Las calorías ya cuadran con el plan' }), 1), 'aplicado, las calorías ya cuadran y no propone otro factor');
    const fila1 = await kcalFila();
    const pct1 = fila1[2] === '=' ? 0 : Number((/\([+−]([\d,]+) %\)/.exec(fila1[2]) || [])[1]?.replace(',', '.'));
    check(pct1 < 5, `la tabla ya da las calorías del plan: ${fila1.join(' | ')}`);
    const factoresDespues = await leerFactores();
    const f = Number(f1[1].replace(',', '.'));
    check(Object.keys(factoresAntes).length === Number(f1[2]) && Object.entries(factoresAntes).every(([id, antes]) => Math.abs(factoresDespues[id] / antes - f) < 0.02), 'en la base, el factor de cada una de sus recetas se ha multiplicado por ese factor');
    await hoja().getByRole('button', { name: 'Cerrar' }).first().click();
    check(await hay(hoja(), 0), 'la hoja se cierra');

    // Todo el equipo, desde Biblioteca → Recetas
    await p.getByRole('button', { name: 'Volver a atletas' }).click();
    await irASeccion(p, 'Biblioteca');
    await p.getByRole('tab', { name: 'Recetas' }).click();
    await p.getByRole('button', { name: 'Comprobar recetarios' }).click();
    await equipo().locator('ul[aria-label="Recetarios"] li').first().waitFor();
    check(await equipo().locator('ul[aria-label="Recetarios"] li').count() === 2 && /\d de 2 recetarios cuadran con su plan/.test(await equipo().textContent()), 'en Biblioteca → Recetas, «Comprobar recetarios»: los dos atletas con recetario, y cuántos cuadran');
    check((await equipo().locator('ul[aria-label="Recetarios"] li').first().textContent()).includes('No cuadra con el plan'), 'primero, los que no cuadran');
    await revisar('equipo');
    await foto('recetario-3-equipo');
    await equipo().locator('ul[aria-label="Recetarios"] li button', { hasText: 'Ana López' }).click();
    await p.getByRole('dialog', { name: 'El recetario de Ana y su plan' }).locator('table').waitFor();
    check(await p.getByRole('dialog', { name: 'El recetario de Ana y su plan' }).locator('section', { hasText: 'Reescalar con un factor' }).count() === 1, 'al tocar a una atleta se abre su comprobación');
    await p.getByRole('dialog', { name: 'El recetario de Ana y su plan' }).getByRole('button', { name: 'Cerrar' }).first().click();
    check(await hay(equipo().locator('ul[aria-label="Recetarios"] li'), 2), 'y al cerrarla vuelve a la lista del equipo');

    // A 360 px y en oscuro
    await p.setViewportSize({ width: 360, height: 760 });
    await p.emulateMedia({ colorScheme: 'dark' });
    await revisar('equipo-movil');
    await equipo().locator('ul[aria-label="Recetarios"] li button', { hasText: 'Ana López' }).click();
    await p.getByRole('dialog', { name: 'El recetario de Ana y su plan' }).locator('table').waitFor();
    await revisar('atleta-movil');
    await foto('recetario-4-movil');
    check(errores.length === 0, `sin errores de consola, desbordes ni fallos de accesibilidad${errores.length ? `: ${errores.slice(0, 4).join(' ## ')}` : ''}`);
  } catch (e) {
    await foto('recetario-error');
    check(false, `El recetario y su plan: ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  } finally {
    await ctx.close();
  }
}

// Suelta
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4178);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('El recetario al día con el plan');
  await probarRecetario({ navegador, check, base: 'http://localhost:4178', capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
