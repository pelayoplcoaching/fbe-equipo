// v0.218: «la carrera va por calendario» en la demo. Lo llama e2e.test.mjs.
//   · Iván va por microciclos (3 días por semana); se le enciende la carrera con un plan para esta semana (una carrera
//     hoy y otra sin día). El coach abre la app y la app le pone las carreras en el microciclo que está haciendo.
//   · Iván: en Hoy, «Hoy toca correr» debajo de «Tu carrera» y, en «Esta semana», «Tu carrera de esta semana» con las dos;
//     en Semana, lo mismo, y su fuerza aparte. La flecha de la tarjeta «Tu carrera», de su tamaño.
//   · El coach: en el editor, el recuadro «Carrera, por calendario» y «Comprobar que las tiene».
//   · Sin errores ni la página desbordada, también a 360 px en oscuro.
import { devices } from 'playwright';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { hoyISO, lunesDe, diasEntre } from '../web/src/logica/fechas.js';

export async function probarCarreraCalendario({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const hoy = hoyISO();
  const L = lunesDe(hoy);
  const diaHoy = diasEntre(L, hoy) + 1;
  const db = semillaDemo();
  const ivan = db.atletas.find((a) => a.nombre === 'Iván Prieto');
  ivan.carrera = true;
  db.carrera_semanas = db.carrera_semanas || [];
  db.carrera_semanas.push({ id: '00000000-0000-4000-8000-0000000c0218', atleta_id: ivan.id, lunes: L, etiqueta: 'Base 2', km_min: 15, km_max: 20, ab: null, clave: null, nota: null,
    sesiones: [{ tipo: 'facil', titulo: 'Rodaje suave', dia: diaHoy, minutos: 40, zona: 2 }, { tipo: 'larga', titulo: 'Tirada larga', km: 12 }], actualizado_en: new Date().toISOString() });
  const sembrar = async (ctx, datos) => ctx.addInitScript((d) => {
    if (window !== window.top) return;
    try { if (!sessionStorage.getItem('fbe-e2e-218')) { localStorage.setItem('fbe-demo-v2', d); sessionStorage.setItem('fbe-e2e-218', '1'); } localStorage.setItem('fbe-escena-200', '1'); } catch { /* sin almacenamiento */ }
  }, datos);
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

  // 1) El coach abre la app: le pone a Iván sus carreras de esta semana
  const ctxC = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await sembrar(ctxC, JSON.stringify(db));
  const pc = await ctxC.newPage();
  vigilar(pc);
  await pc.goto(`${base}/?demo`);
  await pc.getByRole('button', { name: /Pelayo/ }).first().click();
  const puestas = async () => pc.evaluate((id) => {
    const d = JSON.parse(localStorage.getItem('fbe-demo-v2') || '{}');
    const bl = (d.bloques || []).filter((x) => x.atleta_id === id).map((x) => x.id);
    const ws = new Set((d.semanas || []).filter((w) => bl.includes(w.bloque_id) && w.programacion === 'programada').map((w) => w.id));
    return (d.sesiones || []).filter((s) => ws.has(s.semana_id) && s.tipo === 'cardio' && ['Rodaje suave', 'Tirada larga'].includes(s.nombre)).length;
  }, ivan.id);
  let n = 0;
  for (let i = 0; i < 40 && n < 2; i++) { await pc.waitForTimeout(250); n = await puestas(); }
  check(n === 2, 'al abrir la app del coach, a Iván (microciclos y plan de carrera) se le ponen las dos carreras de esta semana');
  // El editor de su programa: el recuadro de la carrera por calendario
  await cerrar(pc);
  await pc.locator('text=Iván Prieto').first().click();
  const caja = pc.locator('.plan-carrera-semana').first();
  await caja.waitFor({ timeout: 15000 });
  check(/Carrera, por calendario/.test(await caja.textContent()) && /No hace falta añadirlas aquí/.test(await caja.textContent()) && await caja.getByRole('button', { name: /Añadir/ }).count() === 0,
    'en el editor, su recuadro dice que su carrera va por calendario (sin «Añadir las sesiones de carrera»)');
  const icoCaja = await caja.locator(':scope > .peq > svg').first().boundingBox();
  check(!!icoCaja && icoCaja.width <= 24, 'el dibujo del recuadro, de su tamaño (no ocupa media pantalla)');
  await caja.getByRole('button', { name: /Comprobar que las tiene/ }).click();
  check(await pc.locator('text=Ya tiene las carreras de esta semana').first().waitFor({ timeout: 8000 }).then(() => true, () => false), '«Comprobar que las tiene»: ya las tiene');
  const datos = await pc.evaluate(() => localStorage.getItem('fbe-demo-v2'));
  await ctxC.close();

  // 2) Iván, con la base que ha dejado el coach
  const ctx = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await sembrar(ctx, datos);
  const p = await ctx.newPage();
  vigilar(p);
  await p.goto(`${base}/?demo`);
  await p.getByRole('button', { name: /Iván Prieto/ }).first().click();
  await p.locator('nav.tabs').waitFor({ timeout: 30000 });
  await p.waitForTimeout(1500);
  await cerrar(p);
  const prox = p.locator('.carrera-proxima');
  await prox.first().waitFor({ timeout: 15000 });
  const tProx = await prox.first().textContent();
  check(/Hoy toca correr/.test(tProx) && /Rodaje suave/.test(tProx) && /40 min de carrera fácil en Z2/.test(tProx), 'en Hoy, debajo de «Tu carrera»: «Hoy toca correr», con la pauta en palabras');
  const flecha = await p.locator('.tarjeta-carrera-hoy > svg:last-child').first().boundingBox();
  check(!!flecha && flecha.width <= 24, 'la flecha de la tarjeta «Tu carrera», de su tamaño (antes, casi el ancho de la tarjeta)');
  // «Esta semana» (plegable): la fuerza de su microciclo y, aparte, sus dos carreras
  const plegable = p.locator('details[data-plegable="semana"]').first();
  if (await plegable.count() && !(await plegable.evaluate((d) => d.open))) await plegable.locator('summary').first().click();
  const lane = p.locator('.cardio-cal', { hasText: 'Tu carrera de esta semana' }).first();
  check(await lane.waitFor({ timeout: 8000 }).then(() => true, () => false), 'en «Esta semana», «Tu carrera de esta semana»');
  const nombres = await lane.evaluate((el) => [...el.nextElementSibling.querySelectorAll('.dia .nombre')].map((x) => x.textContent.trim()));
  check(nombres.join() === 'Rodaje suave,Tirada larga', 'con sus dos carreras (la de hoy y la que no tiene día)');
  const fuerza = await p.evaluate(() => [...(document.querySelector('details[data-plegable="semana"] .semana-dias')?.querySelectorAll('.dia .nombre') || [])].map((x) => x.textContent.trim()));
  check(fuerza.length > 0 && !fuerza.includes('Rodaje suave') && !fuerza.includes('Tirada larga'), 'la lista de su microciclo, con su fuerza y sin las carreras (van aparte)');
  await desborda(p, 'Hoy');
  // Semana: lo mismo
  await p.getByRole('button', { name: /^Semana/ }).first().click();
  await p.waitForTimeout(1200);
  await cerrar(p);
  const laneS = p.locator('.semana-vista .cardio-cal', { hasText: 'Tu carrera de esta semana' }).first();
  check(await laneS.waitFor({ timeout: 8000 }).then(() => true, () => false), 'en Semana, en su microciclo en curso, «Tu carrera de esta semana»');
  await desborda(p, 'Semana');
  // Abrir la carrera de hoy
  await laneS.evaluate((el) => el.nextElementSibling.querySelector('.dia').click());
  const tarjeta = p.locator('.tarjeta-cardio').first();
  const abre = await tarjeta.waitFor({ timeout: 10000 }).then(() => true, () => false);
  check(abre && /40\s*min/.test(await tarjeta.textContent()) && await p.getByText('Rodaje suave').first().isVisible(), 'al tocarla se abre la sesión de carrera, con su pauta (40 min)');
  // A 360 px en oscuro
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.setViewportSize({ width: 360, height: 740 });
  await p.goto(`${base}/?demo`);
  await p.locator('nav.tabs').waitFor({ timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1200);
  await cerrar(p);
  await desborda(p, 'Hoy a 360 px en oscuro');
  await ctx.close();
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}
