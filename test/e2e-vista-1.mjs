// (v0.274) Vista (251-300), primera vuelta, en el navegador (un móvil de 390 px, con el dedo): Hoy, más tranquilo.
//   · Ana (FBE Equipo). Hoy por tramos, en este orden: la tarjeta de hoy y los diales, «Tu día», lo de tu coach, tus
//     historias, para aprender y el detalle de hoy. El estante de «Para aprender» se desliza de lado sin cambiar de
//     pestaña y su título se queda arriba al pasar. El aviso largo de su coach, en tres líneas con «Leer más». Un solo
//     botón relleno a la vista y las filas de acciones del pie, del mismo tamaño. La tarjeta, «Empezar» y la primera fila
//     de diales, sin deslizar (sin la banda de la demo, como la ve un atleta).
//   · Tomás (FBE Esencial). Sus avisos que solo cuentan algo, apilados: uno encima y «Ver los N avisos»; los que piden
//     algo, siempre a la vista. Se abren y se recogen; en «Ordenar Hoy», «Apilar los avisos» los deja enteros. «¿Qué
//     necesitas?», recogida: cuatro y «Ver todas»; lo que más abre pasa a estar a la vista.
//   · Con «reducir movimiento»: la pila se abre sin moverse.
//   Sin errores, sin desbordes y con accesibilidad.
//   Suelta:  npm run build && node test/e2e-vista-1.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarVista1({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(100); } return !!(await fn().catch(() => false)); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    // Con las hojas aún entrando (o el velo a medias), axe mide el color a medio camino: se espera a que acaben
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 2500)),
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
    await p.waitForTimeout(600);
  };
  const tramo = (t) => p.locator(`section.tramo[aria-label="${t}"]`);

  // ------------------------------------------------------------ Ana, FBE Equipo
  {
    const { ctx, dedo } = await nuevo();
    try {
      await entrar('/?demo', /Ana/);
      await tramo('Para aprender').waitFor({ timeout: 15000 });
      const orden = await p.evaluate(() => {
        const y = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : null; };
        return [y('.hero-dia'), y('.diales'), y('.tu-dia'), ...[...document.querySelectorAll('section.tramo')].map((t) => (t.getBoundingClientRect().height > 0 ? t.getBoundingClientRect().top + scrollY : null))]
          .concat([...document.querySelectorAll('section.tramo')].map((t) => t.getAttribute('aria-label')).join('|'));
      });
      const nombres = orden.pop();
      check(nombres === 'De tu coach|Tus historias|Para aprender|El detalle de hoy' && orden.every((v, i) => v !== null && (i === 0 || v > orden[i - 1])),
        `(255, 258) Hoy por tramos y en orden: la tarjeta, los diales, «Tu día» y luego ${nombres.replace(/\|/g, ', ')}`);
      // (258) el primer vistazo, sin la banda de la demo
      const vistazo = await p.evaluate(() => {
        document.querySelector('.banda-demo')?.remove(); scrollTo(0, 0);
        const b = (s) => document.querySelector(s)?.getBoundingClientRect();
        const dial1 = [...document.querySelectorAll('.diales > .dial')].slice(0, 3).map((d) => d.getBoundingClientRect().bottom);
        return { hero: b('.hero-dia').bottom, empezar: b('[data-atajo="empezar"]')?.bottom || 0, fila1: Math.max(...dial1), tabs: (b('.tabs-flota') || b('nav.tabs')).top };
      });
      check(vistazo.hero < vistazo.tabs && vistazo.empezar > 0 && vistazo.empezar < vistazo.tabs && vistazo.fila1 < vistazo.tabs,
        `(258) sin deslizar: la tarjeta, «Empezar» y la primera fila de diales (hasta ${Math.round(vistazo.fila1)} px; la barra empieza en ${Math.round(vistazo.tabs)})`);
      // (251) el estante se desliza de lado, empieza al principio y no cambia de pestaña
      const fila = tramo('Para aprender').locator('.tramo-fila');
      await fila.scrollIntoViewIfNeeded();
      await p.waitForTimeout(300);
      const f0 = await fila.evaluate((e) => ({ izq: e.scrollLeft, ancho: e.scrollWidth, caja: e.clientWidth, n: e.children.length }));
      check(f0.n >= 3 && f0.ancho > f0.caja + 100 && f0.izq === 0, `(251) «Para aprender», en un estante: ${f0.n} piezas, empieza al principio`);
      const fb = await fila.boundingBox();
      const y = fb.y + Math.min(80, fb.height / 2);
      await dedo('touchStart', 330, y);
      for (let k = 1; k <= 10; k++) { await dedo('touchMove', 330 - k * 24, y); await p.waitForTimeout(16); }
      await dedo('touchEnd');
      await p.waitForTimeout(700);
      const izq = await fila.evaluate((e) => e.scrollLeft);
      const enHoy = await p.locator('nav.tabs [aria-current="page"]').first().textContent().catch(() => '');
      check(izq > 60 && /Hoy/.test(enHoy), `con el dedo se desliza de lado (${Math.round(izq)} px) y sigue en Hoy`);
      // (255) su título se queda arriba al pasar
      await p.evaluate(() => { const t = document.querySelector('section.tramo[aria-label="Para aprender"]'); scrollBy(0, t.getBoundingClientRect().top + 90); });
      await p.waitForTimeout(400);
      const pegado = await p.evaluate(() => { const t = document.querySelector('section.tramo[aria-label="Para aprender"]'); const h = t.querySelector('.tramo-t'); return { sec: t.getBoundingClientRect().top, tit: h.getBoundingClientRect().top }; });
      check(pegado.sec < 0 && Math.abs(pegado.tit - 54) <= 3, `(255) el título del tramo se queda arriba al pasar (a ${Math.round(pegado.tit)} px)`);
      // (257) el aviso de su coach: con una línea de más se lee entero («Leer más» ocuparía lo mismo)
      await p.evaluate(() => scrollTo(0, 0));
      const aviso = tramo('De tu coach').locator('.aviso-coach').first();
      await aviso.scrollIntoViewIfNeeded();
      const lineas = await aviso.locator('.aviso-texto').evaluate((e) => Math.round(e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).lineHeight) || 20)));
      check(lineas <= 4 && (await aviso.locator('.tres-corta').count()) === 0 && (await aviso.getByRole('button', { name: 'Leer más' }).count()) === 0,
        `(257) el aviso de su coach (${lineas} líneas: solo una de más) se lee entero, sin «Leer más»`);
      check(/Para ti|congreso/.test(await aviso.textContent()) && !/De tu coach/.test(await aviso.textContent()), 'bajo el título «De tu coach», el aviso no lo repite');
      // (256) un solo botón relleno a la vista
      const rellenos = await p.evaluate(() => [...document.querySelectorAll('main .contenido .btn-primario')].filter((b) => b.getClientRects().length && !b.closest('[aria-modal="true"], .hoja, dialog') && getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)').map((b) => b.textContent.trim().slice(0, 30)));
      check(rellenos.length <= 1, `(256) en Hoy, un solo botón relleno (${rellenos.join(' · ') || 'el de la tarjeta'})`);
      // (254) las filas de acciones del pie: mismo tamaño y a todo lo ancho
      const pie = await p.evaluate(() => { const g = document.querySelector('.ordenar-hoy-pie'); return [...g.querySelectorAll(':scope > .btn-texto')].map((b) => ({ h: b.getBoundingClientRect().height, w: Math.round(b.getBoundingClientRect().width), g: Math.round(g.getBoundingClientRect().width) })); });
      check(pie.length >= 1 && pie.every((x) => x.h >= 44 && Math.abs(x.w - x.g) <= 1) && new Set(pie.map((x) => x.w)).size === 1, `(254) «Ordenar Hoy» y los demás, en filas de acciones iguales (${pie.length})`);
      await revisar('Hoy de Ana, por tramos');
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ Tomás, FBE Esencial
  {
    const { ctx } = await nuevo();
    try {
      await entrar('/?demo=esencial', /Tomás/);
      const ver = p.locator('.pav-ver');
      const hay = await ver.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      const estado = () => p.evaluate(() => {
        const infos = [...document.querySelectorAll('[data-aviso="info"]')];
        return { total: infos.length, vistos: infos.filter((e) => e.getClientRects().length).length, cima: infos.findIndex((e) => 'cima' in e.dataset), rotulo: document.querySelector('.pav-ver-t')?.textContent || '' };
      });
      const e0 = await estado();
      check(hay && e0.total >= 3 && e0.vistos === 1 && e0.cima >= 0 && e0.rotulo === `Ver los ${e0.total} avisos`, `(253) sus ${e0.total} avisos que solo cuentan algo, apilados: uno encima y «${e0.rotulo}»`);
      const piden = await p.evaluate(() => [...document.querySelectorAll('.cer-vuelta, .vid-mudo, .dias-esencial, .cer-vamos')].filter((e) => e.getClientRects().length).length);
      check(piden >= 2, `los que piden algo (volver, los avisos, sus días, «¿Cómo vamos?»), a la vista (${piden})`);
      await ver.click();
      check(await hasta(async () => { const e = await estado(); return e.vistos === e.total && /Recoger los avisos/.test(e.rotulo); }, 3000) && (await ver.getAttribute('aria-expanded')) === 'true',
        'al tocarlo se abren todos y el botón pasa a «Recoger los avisos»');
      // (257) lo de esta semana, largo: tres líneas y «Seguir leyendo» (ya tiene su propio «Leer más»)
      const leccion = p.locator('.leccion-esencial');
      if (await leccion.count()) {
        await leccion.scrollIntoViewIfNeeded();
        const seguir = leccion.getByRole('button', { name: 'Seguir leyendo' });
        const l3 = await leccion.locator('.tres-corta').evaluate((e) => Math.round(e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).lineHeight) || 20))).catch(() => 0);
        check(l3 === 3 && await seguir.count() === 1, `(257) «Lo de esta semana», en tres líneas (${l3}) con «Seguir leyendo»`);
        await seguir.click().catch(() => {});
        check(await hasta(async () => (await leccion.locator('.tres-corta').count()) === 0 && (await seguir.count()) === 0, 2000), 'y al tocarlo se lee entero');
      } else check(false, '(257) «Lo de esta semana» en Hoy de Tomás');
      await revisar('la pila de avisos, abierta');
      await ver.click();
      check(await hasta(async () => (await estado()).vistos === 1, 3000), 'y se recogen otra vez');
      // «Apilar los avisos», en «Ordenar Hoy»
      await p.getByRole('button', { name: 'Ordenar Hoy' }).click();
      const hoja = p.getByRole('dialog', { name: 'Ordenar Hoy' });
      await hoja.waitFor();
      const sw = hoja.getByRole('switch', { name: /Apilar los avisos/ });
      check(await sw.isChecked(), '«Apilar los avisos», en «Ordenar Hoy», encendido de serie');
      await sw.click();
      check(await hasta(async () => (await ver.count()) === 0 && (await estado()).vistos === e0.total, 3000), 'apagado, cada aviso se ve entero y no hay pila');
      await sw.click();
      check(await hasta(async () => (await ver.count()) === 1 && (await estado()).vistos === 1, 3000), 'y encendido, vuelve la pila');
      await hoja.getByRole('button', { name: 'Listo' }).click();
      await hoja.waitFor({ state: 'detached' });
      // (259) «¿Qué necesitas?», recogida
      const nec = p.locator('.ayu-necesitas');
      await nec.scrollIntoViewIfNeeded();
      const verTodas = nec.locator('.ayu-nec-ver');
      const n0 = await nec.locator('.ayu-nec').count();
      const rot = (await verTodas.textContent()) || '';
      const total = Number((/\((\d+)\)/.exec(rot) || [])[1] || 0);
      check(n0 === 4 && total > 5 && await nec.getByRole('button', { name: 'Me duele algo' }).count() === 1, `(259) «¿Qué necesitas?»: cuatro a la vista (con «Me duele algo») y «${rot.trim()}»`);
      await verTodas.click();
      check(await hasta(async () => (await nec.locator('.ayu-nec').count()) === total, 2000) && /Ver menos/.test(await verTodas.textContent()), `«Ver todas»: las ${total}`);
      await nec.getByRole('button', { name: 'Cambiar mis días' }).click();
      const hDias = p.locator('[aria-modal="true"]').last();
      await hDias.waitFor();
      await p.keyboard.press('Escape');
      await hDias.waitFor({ state: 'detached' }).catch(() => {});
      await verTodas.click();
      check(await hasta(async () => (await nec.locator('.ayu-nec').count()) === 4, 2000), '«Ver menos»: otra vez cuatro');
      await p.reload();
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      await cerrarDialogos();
      await nec.waitFor({ timeout: 15000 });
      await nec.scrollIntoViewIfNeeded();
      const vistas = await nec.locator('.ayu-nec').allTextContents();
      check(vistas.length === 4 && vistas.some((t) => /Cambiar mis días/.test(t)) && vistas.some((t) => /Me duele algo/.test(t)), `lo que más abre pasa a estar a la vista (${vistas.map((t) => t.trim()).join(', ')})`);
      await revisar('Hoy de Tomás, con la pila y «¿Qué necesitas?» recogida');
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ con «reducir movimiento»
  {
    const { ctx } = await nuevo('reduce');
    try {
      await entrar('/?demo=esencial', /Tomás/);
      const ver = p.locator('.pav-ver');
      await ver.waitFor({ timeout: 15000 });
      await ver.click();
      const quietas = await p.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.matches?.('[data-aviso="info"]')).length);
      check(quietas === 0 && (await ver.getAttribute('aria-expanded')) === 'true', '(con «reducir movimiento») la pila se abre sin moverse');
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `Hoy por tramos, la pila y «¿Qué necesitas?», sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4195);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Vista, primera vuelta: Hoy, más tranquilo (v0.274)');
  try { await probarVista1({ navegador, check, base: 'http://localhost:4195' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
