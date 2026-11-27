// (v0.271) Tacto (201-250), primera vuelta, en el navegador (un móvil de 390 px, con el dedo):
//   · Tomás (FBE Esencial): en su sesión, la regla sobre el teclado de la app: se arrastra y cambia los kilos de salto en
//     salto, las teclas la mueven, es un deslizador para el teclado y, en las repeticiones, lleva la zona de su pauta;
//     marca una serie: la pastilla del descanso, el modo cartel (se abre, −15 s, Escape, se queda puesto para el descanso
//     siguiente), la luz del borde en los últimos segundos y «Te toca» al acabar; y, al terminar, la escala del esfuerzo
//     (del 5 al 10) se arrastra.
//   · Ana (FBE Equipo): «Tu peso» con su regla (de 100 en 100 g) y «Tu semana» con las manos: mantener pulsado la para,
//     de lado pasa de tarjeta y hacia abajo se cierra.
//   Sin errores, sin desbordes y con accesibilidad.
//   Suelta:  npm run build && node test/e2e-tacto.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarTacto({ navegador, check, base = 'http://localhost:4174' }) {
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
  const movil = (extra = {}) => navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, ...extra });
  async function entrar(ctx, demo, quien) {
    p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|blob:|Failed to load resource/.test(m.text())) errores.push(m.text()); });
    await p.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* */ } });
    await p.goto(`${base}/${demo}`);
    await p.getByRole('button', { name: quien }).first().click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1200);
    await cerrarDialogos();
    const cdp = await ctx.newCDPSession(p);
    const dedo = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    // arrastrar con el dedo de (x, y) a (x + dx, y + dy), en pasos; soltar: si se levanta al final
    const arrastrar = async (x, y, dx, dy, { pasos = 10, cada = 16, soltar = true } = {}) => {
      await dedo('touchStart', x, y);
      for (let k = 1; k <= pasos; k++) { await dedo('touchMove', x + (dx * k) / pasos, y + (dy * k) / pasos); await p.waitForTimeout(cada); }
      if (soltar) await dedo('touchEnd');
    };
    return { dedo, arrastrar };
  }
  const aNum = (t) => Number(String(t).replace(',', '.').replace(/[^\d.]/g, ''));

  // ---------------------------------------------------------------- Tomás: la regla, el descanso y la escala
  const ctxT = await movil({ reducedMotion: 'reduce' });
  try {
    const { dedo, arrastrar } = await entrar(ctxT, '?demo=esencial', /Tomás/);
    await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión|Empezar|Hacer/ }).first().click();
    const portada = p.locator('.portada-vista');
    if (await portada.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) await portada.getByRole('button', { name: /^\s*Empezar\s*$/ }).last().click();
    await p.locator('.sesion-vista input[inputmode="none"]').first().waitFor();
    await cerrarDialogos();
    const campo = p.locator('.sesion-vista input[inputmode="none"]').first();
    await campo.scrollIntoViewIfNeeded();
    await campo.click();
    const teclado = p.locator('.teclado-serie');
    const regla = teclado.locator('.rg-caja');
    await regla.waitFor();
    const paso = aNum(await teclado.locator('.tecla-paso').last().textContent());
    const propuesto = aNum(await regla.getAttribute('aria-valuenow'));
    check(await regla.getAttribute('role') === 'slider' && /^Regla de kilos: desliza para cambiar de /.test(await regla.getAttribute('aria-label')) && /^[\d,]+ kg$/.test(await regla.getAttribute('aria-valuetext')) && paso > 0 && propuesto > 0,
      `(201) al tocar los kilos, sobre el teclado sale la regla, en lo que te propone la app (${await regla.getAttribute('aria-valuetext')}; saltos de ${paso})`);
    check(await teclado.locator('.teclado-teclas .tecla').count() >= 12 && await campo.inputValue() === '', 'el teclado sigue debajo, y abrirlo no escribe nada');
    await revisar('la regla de los kilos');
    const caja = await regla.boundingBox();
    const cx = caja.x + caja.width / 2, cy = caja.y + caja.height / 2;
    await arrastrar(cx, cy, -84, 0, { soltar: false });
    await p.waitForTimeout(150);
    const enVuelo = aNum(await campo.inputValue());
    check(enVuelo > propuesto && Math.abs((enVuelo / paso) - Math.round(enVuelo / paso)) < 1e-6 && await p.locator('.rg-raiz[data-activo]').count() === 1 && aNum(await p.locator('.rg-burbuja').textContent()) === enVuelo,
      `arrastrarla sube los kilos de salto en salto (${propuesto} → ${enVuelo}), con la cifra en grande mientras se mueve`);
    await dedo('touchEnd');
    check(await hasta(async () => await p.locator('.rg-raiz[data-activo]').count() === 0 && /^Kilos: /.test(await teclado.locator('p.sr').textContent()), 3000) && aNum(await regla.getAttribute('aria-valuenow')) === aNum(await campo.inputValue()),
      'al soltar, la cifra grande se va, el valor se anuncia y la regla y el campo dicen lo mismo');
    const antes = aNum(await campo.inputValue()), desplazada = await regla.evaluate((e) => e.scrollLeft);
    await teclado.locator('.tecla-paso').last().click();
    check(await hasta(async () => aNum(await campo.inputValue()) === antes + paso && aNum(await regla.getAttribute('aria-valuenow')) === antes + paso && await regla.evaluate((e) => e.scrollLeft) === desplazada + 12, 3000),
      `«+${paso}» la mueve un salto (${antes} → ${antes + paso}): la regla sigue a las teclas`);
    await regla.focus();
    await p.keyboard.press('ArrowLeft');
    check(await hasta(async () => aNum(await campo.inputValue()) === antes, 3000), 'con el teclado, la flecha izquierda baja un salto');
    await teclado.locator('.tecla-siguiente').click();
    await p.waitForFunction(() => /repeticiones/.test(document.querySelector('.teclado-serie .rg-caja')?.getAttribute('aria-label') || ''));
    const zona = await teclado.locator('.rg-z').count();
    check(zona >= 1 && zona <= 12 && await teclado.locator('.rg-z1').count() === 1 && await teclado.locator('.rg-z2').count() === 1 && /reps$/.test(await regla.getAttribute('aria-valuetext')),
      `(202) en las repeticiones, la zona de su pauta en verde (${zona} marcas)`);
    await revisar('la regla de las repeticiones');
    await teclado.getByRole('button', { name: 'Ocultar el teclado' }).click();
    await teclado.waitFor({ state: 'detached' });

    // el descanso
    await p.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).first().click();
    const reloj = p.locator('.temporizador');
    await reloj.waitFor();
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const pastilla = p.locator('.pildora-descanso');
    await pastilla.waitFor();
    const primera = await pastilla.getAttribute('data-pst');
    check(['hecha', 'cuenta'].includes(primera) && await hasta(async () => await pastilla.getAttribute('data-pst') === 'cuenta' && /^\d:\d\d/.test((await pastilla.textContent()).trim()), 4000) && await pastilla.getAttribute('aria-label') === 'Descanso en curso, toca para volver',
      `(209) la pastilla del descanso: ${primera === 'hecha' ? '«Hecha» nada más marcar la serie y, enseguida, ' : ''}lo que queda («${(await pastilla.textContent()).trim()}»)`);
    await pastilla.click();
    await pastilla.waitFor({ state: 'detached' });
    await reloj.getByRole('button', { name: 'Ver el descanso en grande (modo cartel)' }).click();
    const cartel = p.locator('.ct-raiz');
    await cartel.waitFor();
    const cifra = async () => { const [m, s] = (await cartel.locator('.ct-cifra').textContent()).trim().split(':').map(Number); return m * 60 + s; };
    check(await cartel.getAttribute('role') === 'dialog' && /^\d:\d\d$/.test((await cartel.locator('.ct-cifra').textContent()).trim()) && /^Después: .+ · Serie 2/.test((await cartel.locator('.ct-pie').textContent()).trim()) && await p.evaluate(() => document.activeElement?.classList.contains('ct-cerrar')),
      `(207) el modo cartel: la cuenta atrás a toda pantalla («${(await cartel.locator('.ct-cifra').textContent()).trim()}») y lo que viene después; el foco, en su botón de salir`);
    const tam = await cartel.locator('.ct-cifra').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    check(tam >= 120, `con cifras para leer de lejos (${Math.round(tam)} px en un móvil de 390)`);
    await revisar('el modo cartel');
    const t0 = await cifra();
    await cartel.getByRole('button', { name: 'Quitar 15 segundos' }).click();
    check(await hasta(async () => { const t = await cifra(); return t <= t0 - 14 && t >= t0 - 17; }, 3000), '«−15 s» también desde el cartel');
    await p.keyboard.press('Escape');
    await cartel.waitFor({ state: 'detached' });
    check(await p.locator('.sesion-vista').count() === 1 && await reloj.count() === 1 && await p.evaluate(() => Object.keys(localStorage).some((k) => /"cartel":false/.test(localStorage.getItem(k) || ''))),
      'Escape lo cierra (solo a él: la sesión y el descanso siguen) y ya no sale solo');
    await reloj.getByRole('button', { name: 'Ver el descanso en grande (modo cartel)' }).click();
    await cartel.waitFor();
    for (let k = 0; k < 10 && await cifra() > 27; k++) { await cartel.getByRole('button', { name: 'Quitar 15 segundos' }).click(); await p.waitForTimeout(150); }
    const luz = p.locator('.lb-borde');
    check(await luz.count() === 0 || await cifra() <= 10, 'la luz del borde no sale antes de los últimos 10 segundos');
    await luz.waitFor({ state: 'attached', timeout: 30000 });
    const quedan = await cifra();
    check(quedan <= 10 && await luz.getAttribute('aria-hidden') === 'true' && await luz.evaluate((e) => getComputedStyle(e).pointerEvents === 'none' && Number(getComputedStyle(e).opacity) > 0.5),
      `(208) a falta de ${quedan} s, la luz del borde está encendida (de adorno: ni se anuncia ni estorba al dedo)`);
    await p.waitForFunction(() => /ct-toca/.test(document.querySelector('.ct-raiz')?.className || ''), null, { timeout: 20000 });
    check((await cartel.locator('.ct-etq').textContent()).trim() === 'Te toca' && /kg × \d+/.test((await cartel.locator('.ct-carga').textContent()).trim()) && /^Serie 2 de \d/.test((await cartel.locator('.ct-pie').textContent()).trim()),
      `al acabar, «Te toca» con sus kilos en grande («${(await cartel.locator('.ct-carga').textContent()).trim()}»)`);
    await cartel.waitFor({ state: 'detached', timeout: 12000 });
    check(await reloj.count() === 0 && await luz.count() === 0, 'y se quita solo con el descanso (la luz, también)');
    // se queda puesto: el descanso siguiente sale en grande sin tocar nada
    await p.getByRole('button', { name: 'Marcar la serie 2 como hecha' }).first().click();
    check(await cartel.waitFor({ timeout: 6000 }).then(() => true).catch(() => false), 'el cartel se queda puesto: el descanso siguiente sale en grande');
    await cartel.getByRole('button', { name: 'Salir del modo cartel' }).click();
    await cartel.waitFor({ state: 'detached' });
    await reloj.getByRole('button', { name: /^Saltar$/ }).click();
    await reloj.waitFor({ state: 'detached' });

    // la escala del esfuerzo, al terminar
    await p.getByRole('button', { name: /Terminar sesión/ }).first().click();
    const escala = p.locator('[aria-modal="true"] .seg-rpe-sesion');
    await escala.waitFor();
    await escala.scrollIntoViewIfNeeded();
    const ce = await escala.boundingBox();
    const xs = await escala.locator('button').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return Math.round(r.x + r.width / 2); }));
    await arrastrar(xs[1], ce.y + ce.height / 2, xs[4] - xs[1], 0, { pasos: 12, cada: 20, soltar: false });
    const durante = (await escala.locator('button[aria-pressed="true"]').textContent().catch(() => '')).trim();
    await dedo('touchEnd');
    await p.waitForTimeout(250);
    check(durante === '9' && (await escala.locator('button[aria-pressed="true"]').textContent()).trim() === '9' && /Muy dura/.test(await p.locator('[aria-modal="true"] .escala-frase').first().textContent()),
      '(204) la escala del esfuerzo se arrastra: del 6 al 9 con el dedo, y al soltar se queda en el 9 («Muy dura»)');
    await escala.getByRole('button', { name: '7', exact: true }).tap();
    check(await hasta(async () => (await escala.locator('button[aria-pressed="true"]').textContent()).trim() === '7', 2000), 'tocar sigue valiendo');
    await revisar('la escala del esfuerzo');
    await p.keyboard.press('Escape');
    check(errores.length === 0, `la regla y el descanso, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctxT.close(); }

  // ---------------------------------------------------------------- Ana: tu peso y tu semana
  errores.length = 0;
  const ctxA = await movil({ reducedMotion: 'no-preference' });
  try {
    const { dedo, arrastrar } = await entrar(ctxA, '?demo', /Ana López/);
    const plegable = p.getByRole('button', { name: /^Tu peso/ }).first();
    if (await plegable.count() && !(await p.getByRole('button', { name: /Apuntar el de hoy|Cambiarlo/ }).count())) { await plegable.scrollIntoViewIfNeeded(); await plegable.click(); }
    const apuntar = p.getByRole('button', { name: /Apuntar el de hoy|Cambiarlo/ }).first();
    await apuntar.scrollIntoViewIfNeeded();
    await apuntar.click();
    const hoja = p.locator('[aria-modal="true"]').last();
    const rp = hoja.locator('.rg-peso .rg-caja');
    await rp.waitFor();
    const campoP = hoja.locator('#peso-hoy');
    const ultimo = aNum(await campoP.inputValue());
    check(ultimo > 30 && aNum(await rp.getAttribute('aria-valuenow')) === ultimo && /de 100 en 100 gramos/.test(await rp.getAttribute('aria-label')), `(203) «Peso de hoy» con su regla, en tu último peso (${ultimo} kg)`);
    await p.waitForTimeout(500);
    await revisar('la regla del peso');
    const cp = await rp.boundingBox();
    await arrastrar(cp.x + cp.width / 2, cp.y + cp.height / 2, 78, 0);
    const d10 = (a, b) => Math.round((a - b) * 10);
    check(await hasta(async () => { const v = aNum(await campoP.inputValue()); return v < ultimo && d10(ultimo, v) >= 2 && d10(ultimo, v) <= 8 && aNum(await rp.getAttribute('aria-valuenow')) === v; }, 3000),
      `arrastrarla a la derecha lo baja de 100 en 100 g (${ultimo} → ${await campoP.inputValue()}), y el campo la sigue`);
    const trasArrastrar = aNum(await campoP.inputValue());
    await hoja.getByRole('button', { name: /Sumar|más|\+/ }).last().click().catch(() => {});
    check(await hasta(async () => d10(aNum(await campoP.inputValue()), trasArrastrar) === 1 && aNum(await rp.getAttribute('aria-valuenow')) === aNum(await campoP.inputValue()), 3000), 'y «+» mueve la regla un salto');
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' }).catch(() => {});

    // tu semana, con las manos
    const tarjeta = p.getByRole('button', { name: /^Tu semana del/ }).first();
    await tarjeta.scrollIntoViewIfNeeded();
    await tarjeta.click();
    const h = p.locator('.historia');
    await h.waitFor();
    await p.waitForFunction(() => document.querySelector('.historia')?.style.touchAction === 'none', null, { timeout: 8000 });
    const est = () => p.evaluate(() => { const e = document.querySelector('.historia'); if (!e) return null; const b = e.querySelector('.historia-barras .corre i'); return { vistas: e.querySelectorAll('.historia-barras span.vista').length, barra: b ? getComputedStyle(b).animationPlayState : null, ancho: b ? b.getBoundingClientRect().width : null, barras: getComputedStyle(e.querySelector('.historia-barras')).visibility, tr: e.style.transform, pa: e.querySelector('.historia-pantalla')?.style.transform || '' }; });
    await dedo('touchStart', 250, 500);
    await p.waitForTimeout(520);
    const p1 = await est();
    await p.waitForTimeout(500);
    const p2 = await est();
    check(p1.barra === 'paused' && p1.barras === 'hidden' && p2.ancho === p1.ancho && p2.vistas === 0, '(226) mantener pulsado para la historia (la barra no avanza) y quita las barras y la ✕');
    await dedo('touchEnd');
    check(await hasta(async () => { const e = await est(); return e.barra === 'running' && e.barras === 'visible' && e.vistas === 0; }, 2000), 'al soltar sigue, en la misma tarjeta');
    await arrastrar(300, 500, -120, 0, { soltar: false });
    const lado = await est();
    await dedo('touchEnd');
    check(/translateX\(-1\d\d/.test(lado.pa) && await hasta(async () => (await est()).vistas === 1, 2000), '(228) de lado, la tarjeta sigue al dedo y pasa a la siguiente');
    await arrastrar(100, 500, 120, 0);
    check(await hasta(async () => (await est()).vistas === 0, 2000), 'y hacia el otro lado, vuelve a la anterior');
    await p.waitForTimeout(250);
    await p.touchscreen.tap(330, 500);
    check(await hasta(async () => (await est()).vistas === 1, 2000), 'tocar a la derecha sigue pasando de tarjeta');
    await arrastrar(200, 300, 0, 60, { pasos: 6, cada: 50, soltar: false });
    const bajando = await est();
    await p.waitForTimeout(200);
    await dedo('touchEnd');
    check(/translateY\(60px\) scale\(0\.98\)/.test(bajando.tr) && await hasta(async () => (await est())?.tr === '', 2000) && await h.count() === 1, '(227) hacia abajo, la historia baja con el dedo; con poco recorrido, vuelve');
    await arrastrar(200, 300, 0, 220);
    check(await h.waitFor({ state: 'detached', timeout: 4000 }).then(() => true).catch(() => false), 'y con más, se cierra');
    await revisar('tras cerrar la historia');
    check(errores.length === 0, `tu peso y tu semana, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally { await ctxA.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4191);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Tacto, primera vuelta (v0.271)');
  try { await probarTacto({ navegador, check, base: 'http://localhost:4191' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 4).join(' / ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
