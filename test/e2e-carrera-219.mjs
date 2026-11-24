// v0.219: carrera, tanda 1 de las 20 mejoras, en la demo con Carlos. Lo llama e2e.test.mjs.
//   · El coach (ficha → Carrera): la tabla de zonas con sus ritmos; el ritmo umbral desde una carrera reciente; la
//     biblioteca FBE (en la ficha y en «Desde la biblioteca…» de una semana del plan); la previsión de tiempo en una carrera.
//   · El atleta: en la sesión de calidad, su porqué y la zona con su ritmo (sin salirse en el móvil); «Tu carrera» con
//     la columna de ritmos. Sin errores ni desbordes, también a 360 px en oscuro.
import { devices } from 'playwright';
import { BIBLIOTECA_FBE } from '../web/src/logica/carrera-biblioteca.js';

export async function probarCarrera219({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const vigilar = (p) => {
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|blob:|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  };
  const cerrar = async (p) => {
    for (let i = 0; i < 6; i++) {
      const b = p.locator('[aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Cerrar"), [aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] .hoja-cerrar').first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await p.waitForTimeout(400); } else break;
    }
  };
  const desborda = async (p, paso) => { const w = p.viewportSize()?.width || 390; const a = await p.evaluate(() => document.documentElement.scrollWidth); if (a > w) errores.push(`${paso}: la página se desborda (${a} > ${w})`); };
  const iniciar = async (ctx) => ctx.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* sin almacenamiento */ } });

  // 1) El coach, en la ficha de Carlos → Carrera
  const ctxC = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await iniciar(ctxC);
  const pc = await ctxC.newPage();
  vigilar(pc);
  await pc.goto(`${base}/?demo`);
  await pc.getByRole('button', { name: /Pelayo/ }).first().click();
  await pc.waitForTimeout(1500);
  await cerrar(pc);
  await pc.locator('text=Carlos').first().click();
  await pc.getByRole('tab', { name: /Carrera/ }).first().click();
  const zonas = pc.locator('.carrera-zonas').first();
  await zonas.waitFor({ timeout: 15000 });
  check((await zonas.locator('thead th').allTextContents()).join('|') === 'Zona y cómo se siente|FC|Ritmo', 'Zonas y test: la tabla de zonas con la columna de ritmo (sale de su ritmo umbral)');
  await zonas.getByRole('button', { name: /Calcular el ritmo umbral desde una carrera/ }).click();
  await zonas.locator('.umbral-carrera input').fill('48:30');
  check(/Ritmo umbral de unos 4:55 min\/km/.test(await zonas.locator('.umbral-carrera').textContent()), 'el ritmo umbral desde un 10 km en 48:30: unos 4:55 min/km (lo que aguantaría unos 60 minutos)');
  await zonas.getByRole('button', { name: 'Usarlo' }).click();
  check(await zonas.locator('input[placeholder="5:10-5:20"]').inputValue() === '4:50-5:00', '«Usarlo» lo deja escrito como su ritmo umbral (4:50-5:00), listo para guardar');
  // La biblioteca FBE, en la ficha
  const bib = pc.locator('.carrera-biblioteca').first();
  await bib.getByRole('button', { name: /Biblioteca FBE/ }).click();
  check(await bib.locator('.biblioteca-fbe > ul > li').count() === BIBLIOTECA_FBE.length, `la biblioteca FBE en la ficha: ${BIBLIOTECA_FBE.length} sesiones con su porqué`);
  // Y en «Desde la biblioteca…» de una semana del plan
  await pc.locator('.carrera-semanas .semana-carrera-btn').first().click();
  const hoja = pc.locator('[aria-modal="true"]').last();
  await hoja.locator('button:has-text("Partes")').first().click();
  const fbe = hoja.locator('optgroup[label="Biblioteca FBE"] option');
  check(await fbe.count() === BIBLIOTECA_FBE.length, 'en una semana del plan, «Desde la biblioteca…» trae la biblioteca FBE');
  await pc.keyboard.press('Escape');
  await pc.waitForTimeout(500);
  await cerrar(pc);
  // La previsión: con el resultado del 10K, la de la media
  const ev = pc.locator('.carrera-eventos').first();
  await ev.locator('.evento-btn', { hasText: '10K del barrio' }).first().click();
  await pc.locator('input[placeholder="1:58:43"]').fill('52:30');
  await pc.getByRole('button', { name: 'Guardar' }).last().click();
  await pc.waitForTimeout(1000);
  await ev.locator('.evento-btn', { hasText: 'Media maratón de primavera' }).first().click();
  const prev = pc.locator('.prevision-carrera').first();
  check(await prev.waitFor({ timeout: 8000 }).then(() => true, () => false) && /1:55:51/.test(await prev.textContent()), 'al preparar la media: la previsión con su 10K (52:30 → 1:55:51)');
  await prev.getByRole('button', { name: /Usarlo como objetivo/ }).click();
  check(await pc.locator('input[placeholder="1:59:00"]').inputValue() === '1:55:51', '«Usarlo como objetivo» rellena el tiempo objetivo');
  await desborda(pc, 'ficha del coach');
  await ctxC.close();

  // 2) Carlos, en el móvil
  const ctx = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await iniciar(ctx);
  const p = await ctx.newPage();
  vigilar(p);
  await p.goto(`${base}/?demo`);
  await p.getByRole('button', { name: /Carlos/ }).first().click();
  await p.locator('nav.tabs').waitFor({ timeout: 30000 });
  await p.waitForTimeout(1200);
  await cerrar(p);
  await p.locator('nav.tabs').getByRole('button', { name: /^Semana/ }).first().click();
  await p.waitForTimeout(1200);
  await cerrar(p);
  await p.locator('.semana-vista .semana-dias .dia', { hasText: /Umbral/ }).first().click();
  const porque = p.locator('.carrera-porque').first();
  check(await porque.waitFor({ timeout: 10000 }).then(() => true, () => false) && /La sesión dura de la semana/.test(await porque.textContent()), 'en la sesión de calidad, una línea con su porqué');
  const chip = p.locator('.zona-chip').first();
  const caja = await chip.boundingBox();
  check(/Z4 \(\d+–\d+ ppm · \d:\d\d–\d:\d\d min\/km\)/.test(await chip.textContent()) && !!caja && caja.x + caja.width <= 390, 'la zona con su pulso y su ritmo, sin salirse de la pantalla');
  await desborda(p, 'sesión de carrera');
  await p.goBack().catch(() => {});
  await p.waitForTimeout(800);
  await cerrar(p);
  await p.locator('nav.tabs').getByRole('button', { name: /^Hoy/ }).first().click();
  await p.waitForTimeout(800);
  await p.locator('.tarjeta-carrera-hoy').first().click();
  const tabla = p.locator('.tabla-zonas').first();
  check(await tabla.waitFor({ timeout: 8000 }).then(() => true, () => false) && (await tabla.locator('thead th').allTextContents()).includes('Ritmo'), '«Tu carrera»: sus zonas con la columna de ritmo');
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.setViewportSize({ width: 360, height: 740 });
  await p.waitForTimeout(500);
  await desborda(p, '«Tu carrera» a 360 px en oscuro');
  await ctx.close();
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}
