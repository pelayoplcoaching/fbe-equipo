// (v0.194) La revisión semanal, el progreso: el semáforo de cuatro puntos y la frase en cada tarjeta, el bloque de
// progreso (peso, medidas, comida y descanso comparados con las semanas anteriores, con sus gráficas), pedir las
// medidas, el filtro «Algo en rojo», el orden «Lo que peor va primero», la columna de la tabla, el resumen y el
// peso medio en el mensaje redactado. En ordenador y a 360 px en oscuro.
//   Suelta:  npm run build && node test/e2e-revision-194.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRevision194({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(120); } return !!(await fn().catch(() => false)); };
  const foto = async (nombre) => { if (capturas) await p.screenshot({ path: `${capturas}/${nombre}.png`, fullPage: true }); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 1280;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
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
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  async function entrar(ctx) {
    p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await irASeccion(p, 'Revisión semanal');
    await p.locator('.revision-fila').first().waitFor();
  }
  const filas = () => p.locator('.revision-lista > .revision-fila');
  const filaDe = (nombre) => p.locator('.revision-lista > .revision-fila', { hasText: nombre }).first();
  const nombres = () => filas().locator('.revision-quien strong').allTextContents();

  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true });
  try {
    await entrar(ctx);
    const total = await filas().count();
    // 18 y 20: el semáforo y la frase, sin abrir nada
    check(await hasta(async () => (await p.locator('.revision-lista .rev-semaforo').count()) === total, 15000), 'cada tarjeta lleva su semáforo de progreso');
    check((await p.locator('.revision-lista .rev-semaforo').first().locator('.punto').allTextContents()).map((t) => t.replace(/:.*/, '')).join() === 'Peso,Medidas,Comida,Descanso', 'con sus cuatro puntos: peso, medidas, comida y descanso');
    check((await p.locator('.rev-prog-frase').allTextContents()).every((t) => t.trim().length > 3) && await p.locator('.rev-semaforo .punto.ok, .rev-semaforo .punto.aviso, .rev-semaforo .punto.alerta').count() > 0, 'y una frase con lo esencial de cada uno');

    // 1 a 17: el bloque de progreso
    const conPeso = p.locator('.revision-lista > .revision-fila', { has: p.locator('.rev-prog-frase', { hasText: /ritmo|despacio|rápido|Sube de peso|Baja de peso|estable/ }) }).first();
    const quien = (await conPeso.locator('.revision-quien strong').textContent()).trim();
    await conPeso.locator('.rev-prog-cab').click();
    const prog = conPeso.locator('.rev-prog-cuerpo');
    check(await hasta(async () => (await prog.locator('.rev-prog-bloque').count()) >= 3), 'al tocarlo se abre el progreso');
    const bPeso = prog.locator('.rev-prog-bloque', { has: p.locator('h2', { hasText: 'Peso' }) });
    check(/Media, semana del/.test(await bPeso.textContent()) && /antes \d/.test(await bPeso.textContent()) && /Días que se ha pesado/.test(await bPeso.textContent()), 'peso: la media de la semana frente a la anterior y los días que se ha pesado');
    check(await bPeso.locator('.rev-linea svg polyline').count() >= 1 && /8 semanas: de [\d,]+ a [\d,]+ kg/.test(await bPeso.locator('figcaption').textContent()), 'y su gráfica de 8 semanas');
    const bDesc = prog.locator('.rev-prog-bloque', { has: p.locator('h2', { hasText: 'Descanso' }) });
    check(/Sueño/.test(await bDesc.textContent()) && await bDesc.locator('.rev-linea').count() === 3, 'descanso: el sueño y las tres de energía, recuperación y motivación');
    const bComida = prog.locator('.rev-prog-bloque', { has: p.locator('h2', { hasText: 'Alimentación' }) });
    if (await bComida.count()) check(/Adherencia/.test(await bComida.textContent()), 'alimentación: la adherencia');
    await revisar('progreso');
    await foto('194-progreso');
    // 8: pedir las medidas
    const pedir = p.locator('.revision-lista').getByRole('button', { name: 'Pedirle las medidas' }).first();
    if (await pedir.count()) {
      await pedir.click();
      const h = p.getByRole('dialog').last();
      check(/mídete cintura/.test(await h.locator('textarea').inputValue()), 'a quien no se ha medido, se le piden las medidas con el mensaje ya escrito');
      await p.keyboard.press('Escape');
      await hasta(async () => (await p.getByRole('dialog').count()) === 0);
    } else {
      // abrir el progreso de alguien sin medidas
      const sin = p.locator('.revision-lista > .revision-fila', { has: p.locator('.rev-semaforo .punto.gris', { hasText: 'Medidas' }) }).first();
      await sin.locator('.rev-prog-cab').click();
      await sin.getByRole('button', { name: 'Pedirle las medidas' }).click();
      check(/mídete cintura/.test(await p.getByRole('dialog').last().locator('textarea').inputValue()), 'a quien no se ha medido, se le piden las medidas con el mensaje ya escrito');
      await p.keyboard.press('Escape');
    }
    // 20: el peso medio, en el mensaje
    await filaDe(quien).getByRole('button', { name: 'Redactar mensaje' }).click();
    const hoja = p.getByRole('dialog').last();
    await hasta(async () => !/completándolo/.test(await hoja.locator('label[for^="rev-msg-"]').textContent()));
    check(/Peso medio de la semana: [\d,]+ kg/.test(await hoja.locator('textarea').inputValue()), 'el mensaje redactado lleva el peso medio de la semana');
    await p.keyboard.press('Escape');
    await hasta(async () => (await p.getByRole('dialog').count()) === 0);

    // 19: el filtro y el orden
    const enRojo = p.locator('.rev-filtro', { hasText: /^Algo en rojo/ });
    if (await enRojo.count()) {
      const n = Number((await enRojo.textContent()).match(/\((\d+)\)/)[1]);
      await enRojo.click();
      check(await filas().count() === n && await filas().locator('.rev-semaforo').evaluateAll((xs) => xs.every((x) => x.querySelector('.punto.alerta'))), '«Algo en rojo» deja solo a los que tienen algún punto en rojo');
      await enRojo.click();
    } else check(true, '(nadie en rojo en la demo de hoy: el filtro no sale)');
    await p.getByLabel('Orden de la lista').selectOption('progreso');
    const peso = await filas().evaluateAll((xs) => xs.filter((x) => !x.classList.contains('hecha')).map((x) => (x.querySelectorAll('.rev-semaforo .punto.alerta').length * 10) + x.querySelectorAll('.rev-semaforo .punto.aviso').length));
    check(peso.every((v, i) => i === 0 || v <= peso[i - 1]), '«Lo que peor va primero» ordena por el semáforo');
    // la tabla y el resumen
    await p.getByRole('group', { name: 'Cómo verlo' }).getByRole('button', { name: 'Tabla' }).click();
    check(await hasta(async () => (await p.locator('.rev-tabla-todos tbody .rev-semaforo.compacto').count()) === total), 'la tabla tiene su columna de progreso');
    await p.getByRole('group', { name: 'Cómo verlo' }).getByRole('button', { name: 'Tarjetas' }).click();
    await p.getByLabel('Orden de la lista').selectOption('urgencia');
    // uno a uno: el progreso, ya abierto
    await p.getByRole('button', { name: 'Revisar uno a uno' }).click();
    check(await hasta(async () => (await p.locator('.rev-uno .rev-prog-cuerpo').count()) === 1), 'en uno a uno, el progreso sale ya abierto');
    check(errores.length === 0, `sin errores en ordenador${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }

  // En el móvil, a 360 px y en oscuro
  errores.length = 0;
  const movil = await navegador.newContext({ viewport: { width: 360, height: 740 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce', bypassCSP: true });
  try {
    await entrar(movil);
    await p.locator('.revision-lista .rev-prog-cab').first().waitFor({ timeout: 15000 });
    await p.locator('.revision-lista .rev-prog-cab').first().click();
    await p.locator('.rev-prog-cuerpo').first().waitFor();
    await p.waitForTimeout(500);
    if (process.env.ANCHOS) console.log(await p.evaluate(() => [...document.querySelectorAll('.contenido.revision *')].filter((el) => el.getBoundingClientRect().right > 361).slice(0, 8).map((el) => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().right)}`)));
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360 && [...document.querySelectorAll('.rev-prog, .rev-prog-bloque, .rev-semaforo')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    await revisar('movil-progreso');
    await foto('194-movil');
    check(cabe && errores.length === 0, `en el móvil, el progreso cabe a 360 px en oscuro${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await movil.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4181);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('La revisión semanal, el progreso (v0.194)');
  try { await probarRevision194({ navegador, check, base: 'http://localhost:4181', capturas: process.env.CAPTURAS || null }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).slice(0, 400)); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
