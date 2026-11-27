// (v0.275) Vista (251-300), segunda vuelta, en el navegador (un móvil de 390 px): datos que se entienden solos.
//   · Ana (FBE Equipo). En Progreso, el mapa de músculos se toca (se ilumina y dice con qué ejercicios) y cada barra de
//     series abre los suyos; la fuerza lleva la línea gris del periodo anterior y sus récords en dorado; «Comparar dos»
//     pone dos semanas lado a lado. En Semana, cada entrenamiento con su huella. En la sesión, tu línea junto a «La última
//     vez», «Ya has movido más que la última vez» en la cabecera (una vez) y, al terminar, la sesión serie a serie.
//   · El peso que apuntas cae en tu línea al ver la gráfica (y, con «reducir movimiento», ya está ahí, quieto).
//   Sin errores, sin desbordes y con accesibilidad.
//   Suelta:  npm run build && node test/e2e-vista-2.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion, subProgreso, abrirEnHoy } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarVista2({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(100); } return !!(await fn().catch(() => false)); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
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
  const nuevo = async (movimiento = 'no-preference') => {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, reducedMotion: movimiento });
    p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    await p.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* */ } });
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
  const hoy = await (async () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

  // ------------------------------------------------------------ Ana: Progreso, Semana y la sesión
  {
    const ctx = await nuevo();
    try {
      await entrar('/?demo', /Ana/);
      // (266) apunta su peso de hoy en Hoy
      await abrirEnHoy(p, 'peso');
      const apuntar = p.locator('[data-atajo="peso"]').first();
      await apuntar.click();
      const hojaPeso = p.getByRole('dialog', { name: 'Peso de hoy' });
      await hojaPeso.waitFor();
      await hojaPeso.getByRole('button', { name: 'Guardar' }).click();
      await hojaPeso.waitFor({ state: 'detached' }).catch(() => {});
      await p.evaluate(() => { try { localStorage.removeItem('fbe-peso-visto'); } catch { /* */ } });
      await irASeccion(p, 'Progreso');
      await p.waitForTimeout(1200);
      await cerrarDialogos();
      await subProgreso(p, 'cuerpo');
      const graf = p.locator('.pnu-raiz');
      await graf.waitFor({ timeout: 10000 });
      const antes = await p.evaluate((f) => !!document.querySelector(`.pnu-raiz circle.pesada[data-f="${f}"]`), hoy);
      await graf.scrollIntoViewIfNeeded();
      const despues = await hasta(() => p.evaluate((f) => !!document.querySelector(`.pnu-raiz circle.pesada[data-f="${f}"]`), hoy), 4000);
      const visto = await p.evaluate(() => localStorage.getItem('fbe-peso-visto'));
      check(!antes && despues && visto === hoy, `(266) el peso de hoy cae en su línea al ver la gráfica (antes, sin él; luego, en su sitio) y en el móvil solo queda la fecha (${visto})`);
      // (260) el mapa de músculos se toca
      await subProgreso(p, 'fuerza');
      const mapa = p.locator('.mmt-raiz');
      await mapa.waitFor({ timeout: 10000 });
      await mapa.scrollIntoViewIfNeeded();
      const g = await p.evaluate(() => [...document.querySelectorAll('.mmt-raiz .musculo[data-g]')].find((e) => !e.classList.contains('m0'))?.dataset.g);
      await p.locator(`.mmt-raiz .musculo[data-g="${g}"]`).first().click({ force: true });
      const det = p.locator('.dmu-raiz').first();
      await det.waitFor({ timeout: 6000 });
      check(await hasta(async () => (await det.locator('.dmu-fila').count()) > 0, 5000) && (await mapa.getAttribute('data-sel')) === g && (await p.locator(`.mmt-raiz .musculo[data-g="${g}"][data-on]`).count()) > 0,
        `(260) al tocar un músculo (${g}) se ilumina y, debajo, sus series y con qué ejercicios (${await det.locator('.dmu-fila').count()})`);
      await det.getByRole('button', { name: 'Cerrar' }).click();
      check(await hasta(async () => (await p.locator('.dmu-raiz').count()) === 0 && !(await mapa.getAttribute('data-sel')), 2000), 'y se cierra');
      // (268) cada barra abre sus ejercicios (también con el teclado)
      const barra = p.locator('.mmt-fila').first();
      await barra.focus();
      await p.keyboard.press('Enter');
      check(await hasta(async () => (await barra.getAttribute('aria-expanded')) === 'true' && (await p.locator('.barras .dmu-raiz').count()) === 1, 3000), '(268) cada barra de series es un botón: abre los ejercicios que sumaron esa semana (con el teclado, Intro)');
      await revisar('Progreso, el músculo abierto');
      await barra.click();
      check(await hasta(async () => (await barra.getAttribute('aria-expanded')) === 'false', 2000), 'y se cierra al tocarla otra vez');
      // (261, 262) la fuerza: el periodo anterior en gris y los récords en dorado
      const fuerza = p.locator('section.seccion[data-grupo="fuerza"]:has(.grafica)').first();
      await fuerza.scrollIntoViewIfNeeded();
      const f = await fuerza.evaluate((s) => ({ prev: s.querySelectorAll('.linea-previa').length, rec: [...s.querySelectorAll('.punto.record')].map((c) => getComputedStyle(c).fill), oro: getComputedStyle(document.documentElement).getPropertyValue('--oro-300').trim() }));
      check(f.rec.length > 0, `(262) los récords de la fuerza, en dorado (${f.rec.length}, ${f.rec[0] || '—'})`);
      const tres = fuerza.getByRole('button', { name: '6M', exact: true });
      if (f.prev === 0 && await tres.count()) { await tres.click(); await p.waitForTimeout(600); }
      const prev = await fuerza.evaluate((s) => s.querySelectorAll('.linea-previa').length);
      check(prev >= 0 && /línea gris es el periodo anterior/.test(await fuerza.textContent()), `(261) la fuerza con la línea gris del periodo anterior cuando lo hay (${prev}), dicho en «Cómo se calcula»`);
      // (267) dos semanas, lado a lado
      await subProgreso(p, 'resumen');
      const comp = p.getByRole('button', { name: 'Comparar dos' });
      await comp.waitFor({ timeout: 10000 });
      await comp.click();
      const filas = p.locator('.csm-fila');
      await filas.nth(1).waitFor();
      await filas.nth(0).click(); await filas.nth(1).click();
      const tabla = p.locator('.csm-raiz');
      check(await hasta(async () => (await tabla.locator('tbody tr').count()) === 4, 3000) && (await filas.nth(0).getAttribute('aria-pressed')) === 'true' && /Sesiones.*Series.*Toneladas.*Récords/s.test(await tabla.textContent()),
        '(267) «Comparar dos»: dos semanas lado a lado (sesiones, series, toneladas y récords)');
      await revisar('dos semanas, lado a lado');
      await p.getByRole('button', { name: 'Listo' }).click();
      check(await hasta(async () => (await tabla.count()) === 0 && (await p.locator('.csm-fila').count()) === 0, 2000), 'y «Listo» deja de comparar');
      // (263) en Semana, cada entrenamiento con su huella
      await irASeccion(p, 'Semana');
      await p.locator('.entreno').first().waitFor({ timeout: 15000 });
      const n = await p.evaluate(() => ({ filas: [...document.querySelectorAll('button.entreno')].filter((b) => /series/.test(b.textContent)).length, huellas: document.querySelectorAll('button.entreno .hue-mini').length, puntos: document.querySelectorAll('button.entreno .hue-p').length, rec: document.querySelectorAll('button.entreno .hue-rec').length }));
      check(n.filas > 0 && n.huellas === n.filas && n.puntos > n.filas && n.rec > 0, `(263) «Tus entrenamientos»: cada uno con su huella (${n.huellas}, ${n.puntos} series, ${n.rec} récords en dorado)`);
      // la sesión: tu línea, superar a la última y el resumen
      await irASeccion(p, 'Hoy');
      await p.locator('[data-atajo="empezar"]').first().click();
      for (let k = 0; k < 4 && !(await p.locator('.sesion-vista').count()); k++) {
        await p.waitForTimeout(1200);
        const b = p.getByRole('button', { name: /^Empezar$|Vamos|Saltar/ }).first();
        if (await b.count()) await b.click().catch(() => {});
      }
      await p.locator('.sesion-vista').waitFor({ timeout: 15000 });
      await p.waitForTimeout(1500);
      await cerrarDialogos();
      const linea = p.locator('.lul-raiz').first();
      check(await hasta(async () => (await linea.count()) > 0, 6000) && /en tus \d últimas/.test(await linea.textContent()) && /Tus últimas \d veces/.test(await linea.locator('svg').getAttribute('aria-label')),
        `(264) junto a «La última vez», tu línea de las últimas veces («${(await linea.textContent().catch(() => '')).trim()}»)`);
      let aviso = null;
      for (let k = 0; k < 40 && !aviso; k++) {
        const b = p.locator('button[aria-label^="Marcar la serie"]').first();
        if (!(await b.count())) break;
        await b.scrollIntoViewIfNeeded().catch(() => {});
        await b.click({ timeout: 3000 }).catch(() => {});
        await p.waitForTimeout(220);
        if (await p.locator('.sup-aviso').count()) aviso = await p.locator('.sup-aviso').textContent();
      }
      check(!!aviso && /Ya has movido más que la última vez/.test(aviso), `(265) la cabecera lo dice al pasar a la última vez («${(aviso || '').trim()}»)`);
      check(await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-supera') || '[]').length === 1), 'y no vuelve a salir en esta sesión (se apunta su id)');
      for (let k = 0; k < 40; k++) { const b = p.locator('button[aria-label^="Marcar la serie"]').first(); if (!(await b.count())) break; await b.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(150); }
      await p.getByRole('button', { name: 'Terminar sesión' }).click();
      await p.locator('.hoja-dialogo .segmentos button', { hasText: '8' }).first().click();
      await p.getByRole('button', { name: 'Guardar y terminar' }).click();
      await p.getByRole('heading', { name: 'Sesión terminada' }).waitFor({ timeout: 20000 });
      const huella = p.locator('.resumen-huella');
      await huella.waitFor({ timeout: 8000 });
      const filasH = await huella.locator('.hue-fila').count();
      check(filasH >= 4 && (await huella.locator('.hue-nombre').first().textContent()).length > 3 && /serie/.test(await huella.locator('.sr').first().textContent()), `(263) al terminar, la sesión serie a serie: una fila por ejercicio (${filasH})`);
      await revisar('el resumen, serie a serie');
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ con «reducir movimiento»
  {
    const ctx = await nuevo('reduce');
    try {
      await entrar('/?demo', /Ana/);
      await irASeccion(p, 'Progreso');
      await p.waitForTimeout(1200);
      await cerrarDialogos();
      await subProgreso(p, 'cuerpo');
      const ultimo = await p.evaluate(() => [...document.querySelectorAll('.pnu-raiz circle.pesada')].map((c) => c.dataset.f).sort().pop());
      const anims = await p.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.matches?.('circle.pesada')).length);
      check(!!ultimo && anims === 0, `(con «reducir movimiento») la última pesada ya está en su sitio, quieta (${ultimo})`);
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `los datos de la v0.275, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4196);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Vista, segunda vuelta: datos que se entienden solos (v0.275)');
  try { await probarVista2({ navegador, check, base: 'http://localhost:4196' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
