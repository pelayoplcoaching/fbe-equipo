// v0.223: carrera, tanda 5 de las 20 mejoras, en la demo con Carlos. Lo llama e2e.test.mjs.
//   · El coach (ficha → Carrera): en «Lo último que ha corrido», la gráfica de su forma aeróbica (metros por latido en sus
//     rodajes suaves); en una revisión, «Lo que dicen los datos» y «Usar esto», que pone su color.
//   · Carlos (390 px): en «Tu carrera», «Tu forma aeróbica» y «Al calendario del móvil», que descarga sus carreras y sus
//     sesiones clave (con aviso la víspera de cada carrera). Sin errores ni desbordes.
import { devices } from 'playwright';
import { readFileSync } from 'node:fs';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { serieEficiencia } from '../web/src/logica/carrera-seguimiento.js';

export async function probarCarrera223({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  // Cuántos rodajes suaves con pulso tiene Carlos en la demo (la gráfica sale con 3 o más; con menos, no sale)
  const db = semillaDemo();
  const carlos = db.atletas.find((a) => /Carlos/.test(a.nombre));
  const bl = new Set(db.bloques.filter((b) => b.atleta_id === carlos.id && !b.es_plantilla).map((b) => b.id));
  const ws = new Set(db.semanas.filter((w) => bl.has(w.bloque_id)).map((w) => w.id));
  const puntos = serieEficiencia(db.sesiones.filter((s) => ws.has(s.semana_id) && s.completada && s.cardio_hecho?.modalidad === 'carrera')).length;
  const conGrafica = puntos >= 3;
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

  // 1) El coach
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await iniciar(ctx);
  const p = await ctx.newPage();
  vigilar(p);
  await p.goto(`${base}/?demo`);
  await p.getByRole('button', { name: /Pelayo/ }).first().click();
  await p.waitForTimeout(1500);
  await cerrar(p);
  await p.locator('.tab', { hasText: 'Atletas' }).first().click();
  await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Carlos Vera' }).first().click();
  await p.getByRole('tab', { name: /Carrera/ }).first().click();
  await p.locator('.carrera-hecho').waitFor({ timeout: 15000 });
  const forma = p.locator('.carrera-hecho .forma-aerobica');
  if (conGrafica) {
    await forma.waitFor({ timeout: 8000 });
    const pie = (await forma.locator('figcaption').textContent()).trim();
    check(/^De \d,\d\d a \d,\d\d metros por latido \([+−]?\d+(,\d)? %\)/.test(pie) && await forma.locator('.forma-punto').count() === puntos, `la gráfica de su forma aeróbica («${pie.slice(0, 90)}…»)`);
  } else check(await forma.count() === 0, `con ${puntos} rodajes suaves con pulso (menos de 3), aún sin la gráfica de su forma aeróbica`);
  // Una revisión: lo que dicen los datos
  await p.locator('.lista-revisiones .revision-btn').first().click();
  const hoja = p.getByRole('dialog').last();
  const auto = hoja.locator('.rev-auto');
  await auto.waitFor({ timeout: 8000 });
  const colores = await auto.locator('li').evaluateAll((l) => l.map((x) => x.dataset.color));
  const peor = colores.includes('rojo') ? 'rojo' : colores.includes('ambar') ? 'ambar' : 'verde';
  await auto.getByRole('button', { name: /Usar esto/ }).click();
  const pulsado = await hoja.getByRole('group', { name: 'Cómo salió' }).locator('button[aria-pressed="true"]').getAttribute('data-v');
  check(colores.length >= 1 && pulsado === peor, `en la revisión, «Lo que dicen los datos» (${colores.join(', ')}) y «Usar esto» pone el peor (${pulsado})`);
  await p.keyboard.press('Escape');
  await desborda(p, 'la ficha del coach');
  await ctx.close();

  // 2) Carlos, en el móvil
  const ctxM = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce', acceptDownloads: true });
  await iniciar(ctxM);
  const pm = await ctxM.newPage();
  vigilar(pm);
  await pm.goto(`${base}/?demo`);
  await pm.getByRole('button', { name: /Carlos/ }).first().click();
  await pm.locator('nav.tabs').waitFor({ timeout: 30000 });
  await pm.waitForTimeout(1200);
  await cerrar(pm);
  await pm.locator('.tarjeta-carrera-hoy').first().click();
  const tu = pm.getByRole('dialog', { name: 'Tu carrera' });
  await tu.waitFor();
  await tu.locator('.tu-carrera').waitFor({ timeout: 10000 });
  const seccion = tu.locator('section', { has: pm.locator('#tc-forma') });
  check(conGrafica ? await seccion.count() === 1 && /tus rodajes suaves con pulso/.test(await seccion.textContent()) : await seccion.count() === 0,
    conGrafica ? 'en «Tu carrera», «Tu forma aeróbica», con el texto para él' : 'en «Tu carrera», sin «Tu forma aeróbica» hasta tener 3 rodajes suaves con pulso');
  const [descarga] = await Promise.all([pm.waitForEvent('download', { timeout: 10000 }), tu.getByRole('button', { name: /Al calendario del móvil/ }).click()]);
  const ics = readFileSync(await descarga.path(), 'utf8');
  check(descarga.suggestedFilename() === 'mi-carrera.ics' && /BEGIN:VCALENDAR/.test(ics) && /SUMMARY:Carrera: Media maratón de primavera/.test(ics) && /TRIGGER:-PT780M/.test(ics),
    '«Al calendario del móvil»: sus carreras (con aviso la víspera) y sus sesiones clave, en un archivo de calendario');
  await desborda(pm, '«Tu carrera» con la forma aeróbica');
  await ctxM.close();
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}
