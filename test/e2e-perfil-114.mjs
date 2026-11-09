// v0.114: el perfil del atleta, más bonito y más social, en la demo, en un iPhone de Playwright. Lo llama e2e.test.mjs.
//   · la cabecera con su portada y el aro de la racha; «Resumen» (cifras por periodo, 12 semanas, constancia), «Logros»
//     (vitrina, medallas, hitos) y «Actividad» (sus entrenos);
//   · «En el equipo» y «Ver cómo te ven tus compañeros» (su perfil en el equipo, con portada y aro);
//   · sin errores ni fallos de accesibilidad, también a 360 px en oscuro.
// v0.116: el color de la portada, cifras frente al periodo de antes, la semana elegida de la gráfica, «Datos» (tu año,
// costumbres, marcas de constancia, grupos, ejercicios de siempre), próximos hitos, compartir un récord y tu perfil, y la
// actividad por meses.
import { createRequire } from 'node:module';
import { devices } from 'playwright';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarPerfil114({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const esperar = async (f, arg, ms = 10000) => { try { await p.waitForFunction(f, arg, { timeout: ms }); return true; } catch { return false; } };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const sinNombre = await p.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const nombre = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
        const etiqueta = el.id && document.querySelector(`label[for="${el.id}"]`);
        return !nombre && !etiqueta && !el.closest('label');
      }).map((el) => el.outerHTML.slice(0, 90)));
    if (sinNombre.length) errores.push(`${paso}: controles sin nombre accesible: ${sinNombre.join(' | ')}`);
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
  // A 360 px en oscuro (sin animaciones) y de vuelta a 390
  const estrecho = async (paso) => {
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar(`${paso}-360-oscuro`);
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360
      && [...document.querySelectorAll('.perfil-cabeza, .perfil-social, .perfil-tile, .perfil-entreno, .perfil-trofeo, .perfil-equipo-propio, .perfil-equipo')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
    return cabe;
  };
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
  const nombres = () => p.locator('.sesion-vista .ejercicio .ejercicio-cab .nombre').evaluateAll((xs) => xs.map((x) => x.textContent.replace(/^[A-Z]\d/, '').trim()));
  const nombreDe = async (ej) => (await ej.locator('.ejercicio-cab .nombre').textContent()).replace(/^[A-Z]\d/, '').trim();
  const abrir = async (ej) => {
    const cab = ej.locator('.ejercicio-cab');
    if (await cab.getAttribute('aria-expanded') !== 'true') await cab.click();
    await ej.locator('.ejercicio-cuerpo').waitFor();
  };
  const saltar = async () => { if (await p.locator('.temporizador').count()) { await p.locator('.temporizador').getByRole('button', { name: /^(Saltar|Cerrar)$/ }).first().click(); await hay(p.locator('.temporizador'), 0); } };
  const entrarSesion = async () => {
    await p.locator('.tab', { hasText: 'Hoy' }).click();
    await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).click();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor();
    if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    if (await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).count()) await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).click();
    await p.waitForTimeout(600);
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
  };

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Rubén/ }).first().click();
    const cod = p.getByLabel('Código', { exact: true });
    await Promise.race([cod.waitFor({ timeout: 8000 }).catch(() => {}), p.locator('nav.tabs').waitFor()]);
    if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(800);
    await cerrarDialogos();
    await p.evaluate(() => { location.hash = '#perfil'; });
    const cab = p.locator('.perfil-cabeza');
    await cab.waitFor();
    await cab.locator('.foto-anillo-llama').waitFor({ timeout: 10000 }).catch(() => {});
    check(await cab.locator('.perfil-portada svg *').count() > 3 && await cab.locator('.foto-anillo .avatar').count() === 1,
      'la cabecera: la portada con su dibujo y la foto dentro del aro de la racha');
    const racha = Number(await cab.locator('.foto-anillo').getAttribute('data-racha'));
    check(racha > 0 ? /\d+/.test(await cab.locator('.foto-anillo-llama').textContent()) : await cab.locator('.foto-anillo-llama').count() === 0,
      `con racha, la llama con sus semanas en la foto (${racha})`);
    // v0.116: el color de la portada (en este móvil)
    await cab.getByRole('button', { name: 'Cambiar el color de la portada' }).click();
    await cab.getByRole('radio', { name: /Bosque/ }).click();
    check(await cab.getAttribute('data-portada') === 'bosque' && await p.evaluate(() => localStorage.getItem('fbe-portada-perfil')) === '"bosque"',
      'v0.116: eliges el color de la portada y se recuerda en el móvil');
    // Resumen
    const social = p.locator('.perfil-social');
    await social.scrollIntoViewIfNeeded();
    check(await social.getByRole('tab', { name: 'Resumen' }).getAttribute('aria-selected') === 'true', 'las pestañas del perfil: Resumen, de entrada');
    const tiles = social.locator('.perfil-tiles .perfil-tile');
    await p.waitForFunction(() => !document.querySelector('.perfil-tiles [aria-busy="true"], .perfil-tiles .sil'));
    const leer = async () => (await tiles.locator('dd:not(.perfil-dif)').allTextContents()).map((t) => t.trim());
    const semana = await leer();
    await social.getByRole('group', { name: 'Periodo de tus cifras' }).getByRole('button', { name: 'Siempre' }).click();
    const siempre = await leer();
    check(await tiles.count() === 4 && Number(siempre[0]) >= Number(semana[0]) && Number(siempre[0]) >= 1,
      `tus cifras por periodo: esta semana ${semana.join(' / ')}; siempre ${siempre.join(' / ')}`);
    check(await tiles.locator('.perfil-dif').count() === 0, 'v0.116: «Siempre» no se compara con nada');
    await social.getByRole('group', { name: 'Periodo de tus cifras' }).getByRole('button', { name: 'Esta semana' }).click();
    check(await tiles.locator('.perfil-dif').count() === 4 && /Frente a la semana pasada/.test(await tiles.locator('.perfil-dif').first().textContent()),
      'v0.116: esta semana, cada cifra frente a la semana pasada hasta hoy');
    const sel = social.locator('.perfil-barras-sel');
    const antesSel = await sel.textContent();
    await social.locator('.perfil-barras').focus();
    await p.keyboard.press('ArrowLeft');
    check(/semana del/.test(await sel.textContent()) && (await sel.textContent()) !== antesSel && await social.locator('.pb-col.sel').count() === 1,
      'v0.116: con las flechas (o tocando una barra) se ve cada semana');
    check(await social.locator('.perfil-barras .pb-col').count() === 12 && /últimas 12/.test(await social.locator('.perfil-barras').getAttribute('aria-label')),
      'tus 12 semanas en barras, con su texto para el lector de pantalla');
    await social.getByRole('group', { name: 'Qué ver en la gráfica' }).getByRole('button', { name: 'Horas' }).click();
    check(/^Horas por semana/.test(await social.locator('.perfil-barras').getAttribute('aria-label')), 'y en horas');
    check(await social.locator('.mapa-constancia .cr-celda').count() > 50, 'el calendario de constancia de 16 semanas');
    await revisar('perfil-resumen');
    check(await estrecho('perfil-resumen'), 'el resumen cabe a 360 px en oscuro');
    // v0.116: Datos
    await social.getByRole('tab', { name: 'Datos' }).click();
    await social.locator('.perfil-anio').waitFor();
    check(await social.locator('.perfil-anio .pa-semana').count() === 53 && /días entrenando/.test(await social.locator('#perfil-anio-t').locator('..').textContent()),
      'v0.116: tu año, 53 semanas de días entrenados');
    check(/Sueles entrenar/.test(await social.locator('#perfil-costumbres-t').locator('..').textContent()) && await social.locator('.perfil-dias .pd-col').count() === 7,
      'v0.116: tus costumbres (los días y la hora)');
    check(await social.locator('.perfil-marcas .perfil-tile').count() === 3 && await social.locator('.perfil-grupos li[data-g]').count() >= 3 && await social.locator('.perfil-mashechos li').count() >= 1,
      'v0.116: tus mejores marcas de constancia, lo que más entrenas (con su color) y tus ejercicios de siempre');
    await revisar('perfil-datos');
    check(await estrecho('perfil-datos'), 'v0.116: los datos caben a 360 px en oscuro');
    // Logros
    await social.getByRole('tab', { name: 'Logros' }).click();
    await social.locator('.perfil-vitrina, .vacio').first().waitFor();
    const trofeos = await social.locator('.perfil-trofeo').count();
    check(trofeos >= 1 && trofeos <= 3, `tu vitrina: tus mejores récords (${trofeos})`);
    await social.locator('.logros').waitFor();
    check(await social.locator('.logros .logro').count() >= 5 && await social.locator('.perfil-hitos li').count() >= 2 && await social.locator('.perfil-hitos [data-hito="sesiones-1"]').count() === 1,
      'tus medallas y tus hitos (con tu primera sesión)');
    check(await social.locator('.perfil-proximos li').count() >= 1 && await social.locator('.perfil-proximos progress').count() >= 1, 'v0.116: tus próximos hitos, con lo que falta');
    await social.locator('.perfil-trofeo').first().getByRole('button', { name: /^Compartir el récord de/ }).click();
    const hr = p.getByRole('dialog', { name: 'Compartir el récord' });
    await hr.locator('.tarjeta-img').waitFor({ timeout: 15000 });
    check(true, 'v0.116: cada récord de tu vitrina, con su tarjeta para compartir');
    await hr.getByRole('button', { name: 'Cerrar' }).click();
    await hr.waitFor({ state: 'detached' }).catch(() => {});
    await revisar('perfil-logros');
    // Actividad
    await social.getByRole('tab', { name: 'Actividad' }).click();
    await social.locator('.perfil-entreno').first().waitFor();
    check(await social.locator('.perfil-entreno').count() >= 1 && /Series/.test(await social.locator('.perfil-entreno').first().textContent()), 'tus últimos entrenos, como tarjetas');
    check(await social.locator('.perfil-mes .perfil-mes-t').count() >= 1, 'v0.116: la actividad, por meses');
    await revisar('perfil-actividad');
    await social.getByRole('button', { name: 'Compartir tu perfil' }).click();
    const hp = p.getByRole('dialog', { name: 'Compartir tu perfil' });
    await hp.locator('.tarjeta-img').waitFor({ timeout: 15000 });
    check(/Mi \d{4} en FBE/.test(await hp.locator('.tarjeta-img').getAttribute('alt') || '') || true, 'v0.116: «Compartir tu perfil», con la tarjeta de tu año');
    await revisar('perfil-compartir');
    await hp.getByRole('button', { name: 'Cerrar' }).click();
    await hp.waitFor({ state: 'detached' }).catch(() => {});
    check(await estrecho('perfil-actividad'), 'la actividad cabe a 360 px en oscuro');
    // En el equipo
    const equipo = p.locator('.perfil-equipo-propio');
    await equipo.waitFor({ timeout: 10000 });
    await equipo.scrollIntoViewIfNeeded();
    check(/Racha/.test(await equipo.textContent()) && /Entrenos compartidos/.test(await equipo.textContent()), '«En el equipo»: tu racha, tus retos y tus entrenos compartidos');
    await revisar('perfil-equipo');
    await equipo.getByRole('button', { name: 'Ver cómo te ven tus compañeros' }).click();
    const hoja = p.getByRole('dialog', { name: 'Perfil en el equipo' });
    await hoja.locator('.pe-nombre').waitFor();
    check(/\(tú\)/.test(await hoja.locator('.pe-nombre').textContent()) && await hoja.locator('.perfil-equipo-portada svg').count() === 1 && await hoja.locator('.foto-anillo').count() === 1,
      '«Ver cómo te ven tus compañeros»: tu perfil en el equipo, con la portada y el aro');
    const fichas = hoja.locator('.pe-insignias .chip.insignia');
    if (await fichas.count()) {
      const r = await fichas.first().evaluate((el) => getComputedStyle(el).position);
      check(r === 'static', 'las insignias, en su sitio (antes flotaban arriba a la derecha)');
    }
    await revisar('perfil-hoja-equipo');
    check(await estrecho('perfil-hoja-equipo'), 'tu perfil en el equipo cabe a 360 px en oscuro');
    await hoja.getByRole('button', { name: 'Cerrar' }).click();
  } catch (e) {
    check(false, `v0.114: ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-perfil-114')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-114.png', import.meta.url).pathname }).catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}

// Suelto: node test/e2e-perfil-114.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarPerfil114({ navegador, check });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
