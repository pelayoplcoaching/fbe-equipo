// (v0.277) Vista (251-300), cuarta vuelta, en el navegador (un móvil de 390 px): las hojas de FBE Esencial.
//   · Tomás (FBE Esencial). «Me voy de viaje» con el calendario de la casa: hoy marcado, el teclado (flechas e Intro) y
//     el viaje pintado entre la ida y la vuelta; las opciones con su icono y la elegida marcada. «Ponerme un objetivo»:
//     los días de antes de dos semanas, apagados. «Me duele algo»: las casillas de la casa. Respuestas con la flecha de la
//     casa. Sus marcas, como vitrina (el dibujo de cada ejercicio y la cifra, que cabe en su ficha).
//   · Carlos (FBE Equipo). La hoja de la carga: la franja de su media detrás de las semanas acabadas y su leyenda; y las
//     cinco hojas de los diales, que llegan antes de tocarlas (el dial sube a su cabecera).
//   Sin errores, sin desbordes y con accesibilidad.
//   Suelta:  npm run build && node test/e2e-vista-4.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarVista4({ navegador, check, base = 'http://localhost:4174' }) {
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
  const nuevo = async () => {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true });
    p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    await p.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); localStorage.setItem('fbe-bienvenida-vista', '1'); localStorage.setItem('fbe-nec-todas', '1'); localStorage.setItem('fbe-avisos-apilados', '0'); } catch { /* */ } });
    return ctx;
  };
  const entrar = async (url, quien) => {
    await p.goto(`${base}${url}`);
    const b = p.getByRole('button', { name: quien }).first();
    if (await b.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await b.click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1500);
    await cerrarDialogos();
    await p.waitForTimeout(600);
    await cerrarDialogos();
  };
  const modal = () => p.locator('[aria-modal="true"]').last();
  const hoyISO = () => p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });

  // ------------------------------------------------------------ Tomás: las hojas de «¿Qué necesitas?»
  {
    const ctx = await nuevo();
    try {
      await entrar('/?demo=esencial', /Tomás/);
      const nec = p.locator('.ayu-necesitas');
      await nec.waitFor({ timeout: 15000 });
      await nec.scrollIntoViewIfNeeded().catch(() => {});
      // el viaje
      await nec.getByRole('button', { name: /viaje/i }).first().click();
      const h = modal();
      const cal = h.locator('.clc-raiz');
      await cal.waitFor({ timeout: 15000 });
      const hoy = await hoyISO();
      const dHoy = cal.locator(`[data-dia="${hoy}"]`);
      check(await cal.getAttribute('role') === 'group' && /, hoy$/.test(await dHoy.getAttribute('aria-label')) && /clc-hoy/.test(await dHoy.getAttribute('class')) && await cal.locator('.clc-sem span').first().textContent() === 'L',
        '(274) «Me voy de viaje», con el calendario de la casa: el lunes primero y hoy marcado (y dicho)');
      const ida = h.locator('.clc-fecha').nth(0), vuelta = h.locator('.clc-fecha').nth(1);
      check(await ida.getAttribute('data-on') !== null && await vuelta.getAttribute('data-on') === null, 'antes de tocar nada, lo que se elige es la ida');
      // con el teclado: el día enfocable es hoy; la flecha a la derecha pasa a mañana; Intro lo elige
      await dHoy.focus();
      await p.keyboard.press('ArrowRight');
      const manana = await p.evaluate(() => document.activeElement?.dataset?.dia || '');
      await p.keyboard.press('Enter');
      check(manana > hoy && await cal.locator(`[data-dia="${manana}"]`).getAttribute('aria-pressed') === 'true' && /te vas/.test(await cal.locator(`[data-dia="${manana}"]`).getAttribute('aria-label')) && await vuelta.getAttribute('data-on') !== null,
        'con el teclado: la flecha mueve el día, Intro lo elige como ida y ahora toca la vuelta');
      await p.keyboard.press('ArrowDown');
      const otra = await p.evaluate(() => document.activeElement?.dataset?.dia || '');
      await p.keyboard.press('Enter');
      const pintados = await cal.locator('.clc-en').count();
      check(otra > manana && pintados === 8 && /vuelves/.test(await cal.locator(`[data-dia="${otra}"]`).getAttribute('aria-label')) && !/Toca/.test(await vuelta.textContent()),
        'la flecha abajo salta una semana; con la vuelta, el viaje se pinta entero (ocho días) y las dos fechas se leen arriba');
      const opciones = h.locator('.opc-fila');
      check(await opciones.count() === 3 && await h.locator('.opc-fila .opc-i svg').count() === 3 && await h.locator('.opc-fila[aria-pressed="true"] .opc-marca').count() === 1,
        '(278) las opciones, todas iguales: su icono, su texto y la elegida con su marca');
      await opciones.nth(1).click();
      check(await opciones.nth(1).getAttribute('aria-pressed') === 'true' && await opciones.nth(0).getAttribute('aria-pressed') === 'false', 'tocar otra la elige');
      await revisar('«Me voy de viaje»');
      await h.locator('.cerrar-hoja').click();
      await p.waitForTimeout(500);
      // el objetivo: los días de antes de dos semanas, apagados
      await nec.getByRole('button', { name: 'Ponerme un objetivo' }).click();
      const c2 = modal().locator('.clc-raiz');
      await c2.waitFor({ timeout: 15000 });
      const primero = await c2.locator('.clc-d:not([disabled])').first().getAttribute('data-dia');
      const dias = Math.round((new Date(`${primero}T12:00:00`) - new Date(`${hoy}T12:00:00`)) / 864e5);
      check(dias === 14 && await c2.getByRole('button', { name: /^Mes anterior/ }).isDisabled(), '(274) «¿Para cuándo?»: desde dos semanas después de hoy (los de antes, apagados, y sin ir al mes anterior)');
      await c2.locator(`[data-dia="${primero}"]`).click();
      check(/clc-elegido/.test(await c2.locator(`[data-dia="${primero}"]`).getAttribute('class')), 'tocar un día lo elige');
      await revisar('«Ponerme un objetivo»');
      await modal().locator('.cerrar-hoja').click();
      await p.waitForTimeout(500);
      // «Me duele algo»: las casillas de la casa
      await nec.getByRole('button', { name: 'Me duele algo' }).click();
      const hm = modal();
      await hm.locator('.dol-hoja').waitFor({ timeout: 15000 });
      await hm.locator('.dol-zonas').getByRole('button', { name: 'Rodilla' }).click();
      await hm.getByRole('button', { name: '4 de 10' }).click();
      const casillas = hm.locator('input.chk-casa[type="checkbox"]');
      await casillas.first().waitFor({ timeout: 8000 });
      const aspecto = await casillas.first().evaluate((e) => getComputedStyle(e).appearance);
      check(await casillas.count() >= 3 && aspecto === 'none', '(280) «Me duele algo», con las casillas de la casa (no la del navegador)');
      await casillas.first().check();
      check(await casillas.first().isChecked() && await casillas.first().evaluate((e) => getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)'), 'marcada, se rellena');
      await casillas.first().uncheck();
      await hm.getByRole('button', { name: '¿Cuándo preocuparse?' }).click();
      const r = modal();
      await r.locator('.ayu-p').first().waitFor({ timeout: 10000 });
      const flecha = await r.locator('.ayu-p .rsp-q').first().evaluate((e) => getComputedStyle(e, '::after').content);
      check(await r.locator('.ayu-p .rsp-q').count() >= 4 && flecha === '""' && await r.locator('.ayu-p .rsp-q').first().evaluate((e) => getComputedStyle(e).listStyleType) === 'none',
        '(275) Respuestas, con la flecha de la casa (no el triángulo del navegador)');
      await revisar('Respuestas');
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ Tomás: sus marcas, como vitrina
  {
    const ctx = await nuevo();
    try {
      await entrar('/?demo=esencial', /Tomás/);
      const tarjeta = p.locator('.tarjeta-marcas');
      if (await tarjeta.waitFor({ timeout: 15000 }).then(() => true).catch(() => false)) {
        await tarjeta.getByRole('button', { name: 'Ver tus marcas' }).click();
        const h = modal();
        await h.locator('.mrc-ficha').first().waitFor({ timeout: 10000 });
        const caben = await h.locator('.mrc-cifra').evaluateAll((l) => l.every((e) => e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().right <= e.closest('.mrc-ficha').getBoundingClientRect().right));
        check(await h.locator('.mrc-ficha').count() === 5 && await h.locator('.mrc-ficha .picto').count() === 5 && /Tu punto de partida/.test(await h.locator('.mrc-titulo').textContent()) && caben,
          '(277) sus marcas, como vitrina: el dibujo de cada ejercicio y la cifra, que cabe en su ficha');
        await revisar('sus marcas');
      } else check(false, 'la tarjeta de sus marcas');
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ Carlos: la carga y las hojas de los diales
  {
    const ctx = await nuevo();
    try {
      await entrar('/?demo=equipo', /Carlos/);
      const diales = p.locator('.diales .dial');
      await diales.first().waitFor({ timeout: 15000 });
      const n = await diales.count();
      let suben = 0;
      for (let i = 0; i < n; i++) {
        await diales.nth(i).click();
        const h = modal();
        if (await h.locator('.dial-arriba').waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) suben++;
        if (await h.locator('.barras-carga').count()) {
          const semanas = await h.locator('.barras-carga > div').count();
          const franjas = await h.locator('.barras-carga .bc-franja').count();
          check(semanas === 5 && (franjas === 0 || (franjas === 4 && await h.locator('.bc-ahora .bc-franja').count() === 0 && await h.locator('.bc-ley').count() === 1)) && await h.locator('.bc-ahora .bc-pista .b').count() === 1,
            '(276) la carga, como las demás gráficas: con su media, la franja detrás de las semanas acabadas (no de la de ahora, que va a medias) y su leyenda');
          await revisar('la hoja de la carga');
        }
        await h.locator('.cerrar-hoja').click();
        await p.waitForTimeout(500);
      }
      check(n >= 4 && suben === n, `las ${n} hojas de los diales llegan a tiempo: el dial sube a su cabecera en todas`);
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `las hojas de FBE Esencial, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4198);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Vista, cuarta vuelta: las hojas de FBE Esencial (v0.277)');
  try { await probarVista4({ navegador, check, base: 'http://localhost:4198' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
