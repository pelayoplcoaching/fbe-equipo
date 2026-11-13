// El remate de «La travesía» (claude/descansos-mejoras-5.md), en la demo y en un móvil simulado: el coach pone el reto de
// la semana del juego; en «Tu travesía», el diario del lobo, «Tu lobo en números», su liga de la semana y el reto del coach;
// y la etapa del día con el lobo de un compañero. Lo de dentro del juego va en test/travesia-remate.test.mjs y lo de la
// base en test/travesia-remate-base.test.mjs.
//   Suelta:  npm run build && node test/e2e-travesia-remate.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarTravesiaRemate } = await import('./e2e-travesia-remate.mjs'); await probarTravesiaRemate({ navegador, check });
import { pathToFileURL } from 'node:url';
import { VERSION_COMUNIDAD } from '../web/src/datos/api.js';
import { VERSION_NORMAS } from '../web/src/datos/normas-comunidad.js';
import { irASeccion } from './secciones.mjs';

export async function probarTravesiaRemate({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };

  try {
    // --- El coach pone el reto de La travesía de esta semana (Equipo → Retos) ---
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    await irASeccion(p, 'Equipo');
    await p.getByRole('tab', { name: 'Retos' }).click();
    const caja = p.locator('.tv-reto-coach');
    await caja.waitFor();
    check(/El reto de La travesía/.test(await caja.textContent()) && await caja.getByRole('button', { name: 'Poner el reto' }).isDisabled(), 'el coach tiene «El reto de La travesía» en Retos (sin kilómetros, no se puede poner)');
    await caja.getByLabel('Kilómetros entre todos').fill('40');
    await caja.getByLabel('Frase (opcional)').fill('Entre todos, hasta Covadonga');
    await caja.getByRole('button', { name: 'Poner el reto' }).click();
    await caja.getByRole('button', { name: 'Cambiar el reto' }).waitFor();
    check(/de 40 km/.test(await caja.textContent()), 'el reto queda puesto (y se ve lo que lleva el equipo)');

    // --- Ana: el diario, los números, la liga y el reto ---
    await p.waitForTimeout(600);   // (la demo guarda a los 150 ms)
    await p.evaluate(() => { localStorage.removeItem('fbe-demo-v2-sesion'); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();
    await p.evaluate(async () => {
      const yo = (await globalThis.__fbeDemo.select('atletas', {}))[0];
      const lunes = (() => { const d = new Date(); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return d.toISOString().slice(0, 10); })();
      localStorage.setItem(`fbe-travesia-${yo.id}`, JSON.stringify({ total: 41000, estrellas: 300, mejor: 900, semanas: { [lunes]: 1800 } }));
      localStorage.setItem(`fbe-juego-meta-${yo.id}`, JSON.stringify({ rango: 2, activas: [], hechas: 6, logros: {}, numeros: { saltos: 321, roces: 12, combo: 4, etapas: 40, escapadas: 2, porPaisaje: [120, 80, 60, 40] } }));
    });
    await p.reload();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();
    await p.evaluate(([v, n]) => globalThis.__fbeDemo.rpc('comunidad_unirme', { p_nombre: 'Ana L.', p_version: v, p_normas: n }), [VERSION_COMUNIDAD, VERSION_NORMAS]);
    // (en la liga solo entra quien ha jugado en las semanas: una etapa suya, ya en la base)
    await p.evaluate(() => globalThis.__fbeDemo.rpc('sumar_travesia', { p_metros: 1800, p_estrellas: 3, p_etapas: 1 }));
    const tarjeta = p.locator('.travesia-tarjeta');
    await tarjeta.scrollIntoViewIfNeeded();
    await tarjeta.getByRole('button', { name: /Ver tu travesía/ }).click();
    const hoja = p.locator('.hoja-travesia');
    const diario = hoja.locator('.tv-diario');
    await diario.waitFor();
    const primera = await diario.locator('li').first().textContent();
    check(/Puerto de Pajares/.test(primera) && await diario.locator('li').count() === 3, `el diario del lobo: la última página arriba («${primera.slice(0, 40)}…») y tres a la vista`);
    await diario.getByRole('button', { name: /Ver las/ }).click().catch(() => {});
    const numeros = hoja.locator('.tv-numeros');
    const txt = (await numeros.textContent()).replace(/\s+/g, ' ');
    check(/Saltos ?321/.test(txt) && /×4/.test(txt) && /Las cumbres nevadas ?60/.test(txt) && await numeros.locator('.tv-semana').count() === 0, `«Tu lobo en números»: saltos, mejor combo y estrellas por paisaje (${txt.slice(0, 70)}…)`);
    const reto = hoja.locator('.tv-reto');
    await reto.waitFor({ timeout: 5000 });
    check(/hasta Covadonga/.test(await reto.textContent()), 'en «Tu travesía», el reto del coach con su barra');
    const liga = hoja.locator('.tv-liga');
    await liga.locator('.tv-liga-fila.yo').waitFor({ timeout: 5000 });
    check(/Liga de bronce/.test(await liga.textContent()) && await liga.locator('.tv-liga-fila.yo').count() === 1 && await liga.locator('.tv-liga-fila').count() <= 5, `su liga de la semana: bronce, en un grupo de ${await liga.locator('.tv-liga-fila').count()}`);
    await p.keyboard.press('Escape');

    // --- La etapa del día con el lobo de un compañero: uno de la comunidad de la demo ya ha corrido hoy (su rastro) ---
    const companero = await p.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('fbe-demo-v2') || 'null');
      const m = db?.comunidad_miembros?.find((x) => x.nombre !== 'Ana L.' && !x.sin_ranking && !x.salido_en && !x.bloqueado);
      if (!m) return null;
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
      const rastro = []; for (let i = 0; i < 240; i++) rastro.push(Math.round(i * 0.25 * 9 * 10), 0);
      (db.travesia_dia ||= []).push({ atleta_id: m.atleta_id, dia: hoy, metros: 540, estrellas: 9, intentos: 1, rastro, actualizada_en: new Date().toISOString() });
      localStorage.setItem('fbe-demo-v2', JSON.stringify(db));
      return m.nombre;
    });
    await p.reload();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();
    await p.evaluate(([v, n]) => globalThis.__fbeDemo.rpc('comunidad_unirme', { p_nombre: 'Ana L.', p_version: v, p_normas: n }), [VERSION_COMUNIDAD, VERSION_NORMAS]);
    await tarjeta.scrollIntoViewIfNeeded();
    await tarjeta.getByRole('button', { name: /Ver tu travesía/ }).click();
    await hoja.locator('.tv-dia-correr').click();
    const juego = p.locator('.travesia');
    await juego.waitFor();
    const visto = await p.waitForFunction((nombre) => (document.querySelector('.travesia-cartel')?.textContent || '').includes(`lobo de ${nombre}`), companero, { timeout: 9000 }).then(() => true).catch(() => false);
    check(!!companero && visto, `en la etapa del día corre el lobo de un compañero (${companero}), con su cartel`);
    await p.keyboard.press('Escape');
  } catch (e) {
    check(false, `El remate de La travesía: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
  check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 5).join(' ## ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nEl remate de La travesía');
  try { await probarTravesiaRemate({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
