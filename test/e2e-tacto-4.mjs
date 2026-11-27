// (v0.273) Tacto (201-250), tercera vuelta, en el navegador (un móvil de 390 px, con el dedo):
//   · Ana (FBE Equipo). El buscador único, en «Más»: tus ejercicios, tus sesiones, las secciones y los ajustes desde
//     el mismo sitio; un ejercicio abre su ficha, un ajuste lleva a Ajustes con su fila a la vista y una sesión se abre.
//     Al volver de una sesión, la pantalla se queda donde estaba y su fila se marca un instante. En Aprende, el índice
//     lateral salta de estantería en estantería.
//   · Tomás (FBE Esencial). El índice lateral de Recetas, y una receta buscada en «Más» abre Recetas con ese texto.
//   · Con «reducir movimiento»: lo nuevo de la tanda sigue funcionando, quieto (la medalla se da la vuelta sin girar,
//     asomarse, los viajes sin transición y la ficha del plan en su día sin volar).
//   Sin errores, sin desbordes y con accesibilidad.
//   Suelta:  npm run build && node test/e2e-tacto-4.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { irASeccion, subProgreso } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarTacto4({ navegador, check, base = 'http://localhost:4174' }) {
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
  const nuevo = async (movimiento) => {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, reducedMotion: movimiento });
    p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    await p.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* */ } });
    const cdp = await ctx.newCDPSession(p);
    return { ctx, dedo: (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] }) };
  };
  const entrar = async (url, quien) => {
    await p.goto(`${base}${url}`);
    const b = p.getByRole('button', { name: quien }).first();
    if (await b.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await b.click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1500);
    await cerrarDialogos();
    await hasta(() => p.evaluate(() => performance.getEntriesByType('resource').some((r) => /barra-gestos/.test(r.name))), 8000);
    await p.waitForTimeout(400);
  };
  const tab = (nombre) => p.locator('nav.tabs').getByRole('button', { name: nombre }).first();
  // (con la máquina cargada, el primer toque puede caer mientras algo se cierra encima: se cierra y se repite)
  const irATab = async (nombre) => { for (let k = 0; k < 3; k++) { if (await tab(nombre).click({ timeout: 4000 }).then(() => true).catch(() => false)) return; await cerrarDialogos(); await p.waitForTimeout(600); } await tab(nombre).click(); };
  const abrirBuscador = async () => {
    await p.locator('nav.tabs .tab-mas').click();
    await p.locator('.hoja-mas .mas-buscar').waitFor();
    await p.locator('.hoja-mas .mas-buscar').locator('xpath=descendant-or-self::*[self::button or self::a][1]').click();
    await p.locator('.bus-raiz input').waitFor();
  };
  const escribir = async (q) => { await p.locator('.bus-raiz input').fill(q); await p.waitForTimeout(450); };
  const grupos = () => p.locator('.bus-raiz section').evaluateAll((ss) => ss.map((s) => `${s.getAttribute('aria-label')}: ${[...s.querySelectorAll('.bus-titulo')].map((x) => x.textContent.trim()).join(' / ')}`).join(' | '));
  const indice = async (dedo, nombre) => {
    const r = p.locator('.ind-raiz');
    if (!(await r.waitFor({ timeout: 6000 }).then(() => true).catch(() => false))) { check(false, `(242) ${nombre}: sale el índice lateral`); return; }
    const letras = await r.locator('.ind-letra').allTextContents();
    const b = await r.boundingBox();
    const y0 = await p.evaluate(() => Math.round(scrollY));
    const vistos = [];
    await dedo('touchStart', b.x + b.width / 2, b.y + 6);
    for (let k = 0; k <= 20; k++) { await dedo('touchMove', b.x + b.width / 2, b.y + 6 + (b.height - 12) * k / 20); await p.waitForTimeout(30); const g = await p.locator('.ind-globo').textContent().catch(() => null); if (g && vistos[vistos.length - 1] !== g) vistos.push(g); }
    const y1 = await p.evaluate(() => Math.round(scrollY));
    await dedo('touchEnd');
    await p.waitForTimeout(300);
    check(letras.length >= 3 && vistos.length === letras.length && vistos.every((v, k) => v.slice(0, 3).toLowerCase() === letras[k].toLowerCase()) && y1 > y0 + 200 && await p.locator('.ind-globo').count() === 0 && await r.getAttribute('aria-hidden') === 'true',
      `(242) ${nombre}: el índice lateral (${letras.join(' · ')}) salta de capítulo en capítulo al arrastrar el pulgar (${vistos.join(' → ')}), con su nombre en un globo`);
  };

  // ============================================================ Ana (FBE Equipo)
  let { ctx, dedo } = await nuevo('no-preference');
  try {
    await entrar('/?demo', /Ana/);
    // ---- 243: el buscador único
    await abrirBuscador();
    check(await p.locator('.bus-raiz section').count() === 0 && /al menos dos letras/.test(await p.locator('.bus-raiz').innerText()) && await p.evaluate(() => document.activeElement?.type === 'search'), '(243) «Buscar en la app», en «Más»: se abre con el cursor puesto y dice qué busca');
    await escribir('press');
    const gPress = await grupos();
    check(/^Ejercicios: Press /.test(gPress) && await p.locator('.bus-raiz [role="status"]').textContent().then((t) => /^\d+ resultados$/.test(t.trim())), `«press» → ${gPress.slice(0, 110)}`);
    await revisar('el buscador único');
    await escribir('zzzz');
    check(await grupos() === '' && /Nada con «zzzz»/.test(await p.locator('.bus-raiz').innerText()), 'lo que no existe lo dice («Nada con «zzzz»»)');
    await escribir('sentadilla');
    await p.locator('.bus-fila[data-tipo="ejercicio"]').first().click();
    check(await hasta(async () => await p.locator('[aria-modal="true"]').count() === 2, 5000) && /Sentadilla/.test(await p.locator('[aria-modal="true"]').last().locator('h2').first().textContent()), 'un ejercicio abre su ficha (gráficas, récords e historial) sin salir del buscador');
    await p.keyboard.press('Escape');
    await hasta(async () => await p.locator('[aria-modal="true"]').count() === 1, 4000);
    await escribir('mano izquierda');
    const gZ = await grupos();
    await p.locator('.bus-fila[data-tipo="ajuste"]').first().click();
    check(gZ === 'Ajustes: Modo zurdo' && await hasta(() => p.evaluate(() => { const r = document.getElementById('aj-zurdo')?.getBoundingClientRect(); return !!r && r.top > 60 && r.bottom < innerHeight - 60 && document.querySelector('[role=tab][aria-selected="true"]')?.textContent.trim() === 'Ajustes'; }), 8000),
      '«mano izquierda» encuentra «Modo zurdo» y lleva a Ajustes con su fila a la vista');
    await abrirBuscador();
    await escribir('torso a');
    await p.locator('.bus-fila[data-tipo="sesion"]').first().click();
    check(await p.locator('.portada-vista, .sesion-vista').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false) && /Torso A/.test(await p.locator('h1').first().textContent()), 'una sesión se abre desde el buscador');
    await p.goBack();
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(600);
    // ---- 244: volver te deja donde estabas, con la fila marcada
    await irATab(/^Semana/);
    const entreno = p.locator('button.entreno[data-asoma]').first();
    await entreno.waitFor();
    await entreno.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForTimeout(500);
    const yAntes = await p.evaluate(() => Math.round(scrollY));
    const sel = `[data-asoma="${await entreno.getAttribute('data-asoma')}"]`;
    await entreno.click();
    await p.locator('.portada-vista, .sesion-vista').first().waitFor();
    await p.waitForTimeout(700);
    await p.goBack();
    await p.locator('nav.tabs').waitFor();
    const marcada = await hasta(() => p.evaluate((s) => [...document.querySelectorAll(s)].some((el) => el.getAnimations().some((a) => a.playState === 'running' || a.playState === 'pending')), sel), 4000);
    const yDespues = await p.evaluate(() => Math.round(scrollY));
    check(yAntes > 400 && Math.abs(yDespues - yAntes) < 12 && marcada, `(244) al volver de una sesión, la pantalla se queda donde estaba (${yAntes} px) y su fila se marca un instante`);
    // ---- 242: el índice lateral de Aprende
    await irASeccion(p, 'Aprende');
    await p.waitForTimeout(900);
    await indice(dedo, 'Aprende');
    await revisar('Aprende con su índice lateral');
  } finally { await ctx.close(); }

  // ============================================================ Tomás (FBE Esencial)
  ({ ctx, dedo } = await nuevo('no-preference'));
  try {
    await entrar('/?demo=esencial', /Tomás/);
    await irATab(/^Recetas/);
    await p.locator('[data-receta]').first().waitFor();
    await p.waitForTimeout(900);
    await indice(dedo, 'Recetas');
    await abrirBuscador();
    await escribir('pollo');
    const gP = await grupos();
    const titulo = (await p.locator('.bus-fila[data-tipo="receta"] .bus-titulo').first().textContent()).trim();
    await p.locator('.bus-fila[data-tipo="receta"]').first().click();
    check(/^Recetas: /.test(gP) && await hasta(async () => (await p.locator('main input[type="search"]').first().inputValue()) === titulo && await p.locator('[data-receta]').count() === 1, 6000),
      `una receta buscada en «Más» abre Recetas con ese texto ya puesto («${titulo}»)`);
  } finally { await ctx.close(); }

  // ============================================================ con «reducir movimiento» (250): lo mismo, quieto
  ({ ctx, dedo } = await nuevo('reduce'));
  try {
    await entrar('/?demo', /Ana/);
    const dial = p.locator('.diales button.dial').first();
    await dial.click();
    check(await p.locator('[aria-modal="true"] .dial-arriba .dial-esfera').waitFor({ timeout: 5000 }).then(() => true).catch(() => false), '(250) con «reducir movimiento»: el dial sale en la cabecera de su hoja, sin viaje');
    await p.keyboard.press('Escape');
    await p.locator('[aria-modal="true"]').waitFor({ state: 'detached' });
    await irATab(/^Semana/);
    const dia = p.locator('button.dia[data-asoma]').first();
    await dia.waitFor();
    await dia.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForTimeout(700);
    const b = await dia.boundingBox();
    await dedo('touchStart', b.x + 100, b.y + b.height / 2);
    const asomada = await hasta(async () => await p.locator('.aso-tarjeta').count() === 1 && await p.locator('.aso-tarjeta .aso-lineas li').count() >= 1, 5000);
    const quieta = asomada && await p.locator('.aso-tarjeta').evaluate((e) => e.getAnimations().length === 0);
    await dedo('touchEnd');
    await p.waitForTimeout(500);
    check(asomada && quieta && await p.locator('.aso-tarjeta').count() === 0, 'asomarse funciona igual, sin el salto de la tarjeta');
    const ficha = p.locator('.tira-semana button.tira-chip').first();
    if (await ficha.count()) {
      const diaDe = () => p.locator('.tira-semana button.tira-chip').first().evaluate((e) => e.closest('[data-d]').dataset.d);
      const antes = await diaDe();
      await ficha.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await ficha.click();
      const ops = p.locator('.elegir-dia button');
      await ops.first().waitFor();
      await ops.nth((await ops.nth(6).getAttribute('aria-pressed')) === 'true' ? 5 : 6).click();
      check(await hasta(async () => await diaDe() !== antes, 4000) && await p.locator('.tira-semana [data-ses]').evaluateAll((xs) => xs.every((x) => x.getAnimations().length === 0)), 'la ficha del plan aparece en su día, sin volar');
    } else check(true, 'esta semana no queda ninguna sesión por colocar');
    await irATab(/^Progreso/);
    await p.waitForTimeout(900);
    await subProgreso(p, 'logros');
    const medalla = p.locator('.logros button.logro').first();
    await medalla.waitFor();
    await medalla.click();
    const giro = p.locator('[data-llega="medalla"] .mdl-giro');
    await giro.waitFor();
    const gb = await giro.boundingBox();
    // (arrastrarla no la mueve; un toque le da la vuelta de golpe)
    await dedo('touchStart', gb.x + 30, gb.y + gb.height / 2);
    for (let k = 1; k <= 6; k++) { await dedo('touchMove', gb.x + 30 + k * 10, gb.y + gb.height / 2); await p.waitForTimeout(20); }
    const alArrastrar = await giro.evaluate((e) => e.style.transform || 'nada');
    await dedo('touchEnd');
    await p.waitForTimeout(300);
    await giro.focus();
    await p.keyboard.press('Enter');
    const girada = await hasta(() => giro.getAttribute('aria-pressed').then((v) => v === 'true'), 3000);
    const alFinal = await giro.evaluate((e) => `${e.style.transform} · ${e.getAnimations().length} animaciones`);
    check((alArrastrar === 'nada' || /^rotateY\(0(\.0)?deg\)$/.test(alArrastrar)) && girada && /^rotateY\(180(\.0)?deg\) · 0 animaciones$/.test(alFinal),
      `la medalla no sigue al dedo (${alArrastrar}) y se da la vuelta sin girar con Intro (${alFinal})`);
    await p.keyboard.press('Escape');
    check(errores.length === 0, `el buscador, el índice y lo quieto, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4194);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Tacto, tercera vuelta: el buscador único, el índice lateral y lo quieto (v0.273)');
  try { await probarTacto4({ navegador, check, base: 'http://localhost:4194' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
