// «La travesía» al nivel de los mejores (claude/descansos-mejoras-4.md), en la demo y en un móvil simulado: «Cómo juegas»,
// el rango, las misiones, los adornos y los logros en «Tu travesía», la música, y una etapa de un descanso que suma a las
// misiones y deja hacer la foto. Lo de dentro del juego (saltos, combo, cuestas…) va en test/travesia-top.test.mjs.
//   Suelta:  npm run build && node test/e2e-travesia-top.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarTravesiaTop } = await import('./e2e-travesia-top.mjs'); await probarTravesiaTop({ navegador, check });
import { pathToFileURL } from 'node:url';
import { VERSION_COMUNIDAD } from '../web/src/datos/api.js';
import { VERSION_NORMAS } from '../web/src/datos/normas-comunidad.js';

export async function probarTravesiaTop({ navegador, check, base = 'http://localhost:4174' }) {
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
  const ajustes = () => p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'));
  const meta = () => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('fbe-juego-meta-')); return k ? JSON.parse(localStorage.getItem(k)) : null; });
  const seg = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();
    // Un atleta con algo de camino: 1,2 km, rango 2 (Rastreador) y un logro
    await p.evaluate(async () => {
      const yo = (await globalThis.__fbeDemo.select('atletas', {}))[0];
      localStorage.setItem(`fbe-travesia-${yo.id}`, JSON.stringify({ total: 1200, estrellas: 40, mejor: 400 }));
      localStorage.setItem(`fbe-juego-meta-${yo.id}`, JSON.stringify({ rango: 2, activas: [], hechas: 6, logros: { km1: '2026-11-10' } }));
    });
    await p.reload();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();

    // (Ana entra en la comunidad: para la clasificación, el aullido y la etapa del día de la tanda 4)
    await p.evaluate(([v, n]) => globalThis.__fbeDemo.rpc('comunidad_unirme', { p_nombre: 'Ana L.', p_version: v, p_normas: n }), [VERSION_COMUNIDAD, VERSION_NORMAS]);
    // --- «Tu travesía»: rango y misiones, adornos, logros y «Cómo juegas» ---
    const tarjeta = p.locator('.travesia-tarjeta');
    await tarjeta.scrollIntoViewIfNeeded();
    await tarjeta.getByRole('button', { name: /Ver tu travesía/ }).click();
    const hoja = p.locator('.hoja-travesia');
    await hoja.locator('.tv-misiones').waitFor();
    const rango = await hoja.locator('#tv-rango-t').textContent();
    const misiones = await hoja.locator('.tv-mision').count();
    check(/Rastreador/.test(rango) && misiones === 3, `«Tu travesía» enseña el rango (${rango.replace(/\s+/g, ' ').trim()}) y sus tres misiones`);
    const adornos = await hoja.locator('.tv-adorno').evaluateAll((l) => l.map((b) => `${b.disabled ? 'no' : 'si'}:${b.getAttribute('aria-pressed')}`));
    check(adornos.length === 5 && adornos.filter((a) => a.startsWith('si')).length === 2 && adornos.filter((a) => a === 'si:true').length === 2, `con rango 2, dos adornos ganados y puestos (${adornos.join(' ')})`);
    await hoja.locator('.tv-adorno').first().click();
    check((await ajustes()).adornosJuego?.length === 1 && await hoja.locator('.tv-adorno').first().getAttribute('aria-pressed') === 'false', 'un adorno se quita con un toque (y queda en el móvil)');
    const logros = await hoja.locator('.tv-logro').count(), hechos = await hoja.locator('.tv-logro.hecho').count();
    check(logros >= 12 && hechos === 1, `los logros, con el conseguido marcado (${hechos} de ${logros})`);
    const toque = hoja.getByRole('switch', { name: /Un solo toque/ });
    await toque.scrollIntoViewIfNeeded();
    await toque.check();
    await hoja.getByRole('switch', { name: /Alto contraste/ }).check();
    const a1 = await ajustes();
    check(a1.juegoUnToque === true && a1.juegoContraste === true && a1.juegoSinTemblor !== true, '«Cómo juegas»: un solo toque y alto contraste, guardados en el móvil');
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });

    // --- (tanda 4) Con la comunidad: aullar a un compañero y la etapa del día ---
    await tarjeta.getByRole('button', { name: /Ver tu travesía/ }).click();
    await hoja.locator('.tv-clasif').first().waitFor();
    const aullar = hoja.locator('.tv-aullar').first();
    const aQuien = (await aullar.getAttribute('aria-label')).replace('Aullar a ', '');
    await aullar.click();
    await p.waitForFunction(() => document.querySelector('.tv-aullar')?.disabled === true);
    check(/Auuu/.test(await hoja.locator('.tv-aullar').first().textContent()), `aúlla a ${aQuien} desde la clasificación (y el botón queda hecho por hoy)`);
    const dia = hoja.locator('.tv-dia');
    await dia.scrollIntoViewIfNeeded();
    check(/quedan 3 intentos/.test(await dia.locator('.tv-dia-correr').textContent()), 'la etapa del día: tres intentos');
    await dia.locator('.tv-dia-correr').click();
    const juegoDia = p.locator('.travesia');
    await juegoDia.waitFor();
    check(/etapa del día/i.test(await juegoDia.locator('.travesia-cuenta').textContent()), 'se corre con su cuenta de un minuto («etapa del día»)');
    for (let i = 0; i < 70 && !(await p.locator('.travesia-final').count()); i++) { await p.touchscreen.tap(200, 520); await p.waitForTimeout(900); }
    const finDia = await p.locator('.travesia-final').textContent();
    check(/La etapa del día/.test(finDia) && /Tu mejor de hoy/.test(finDia) && /quedan 2 intentos/.test(finDia), `al acabar, su mejor de hoy y los intentos que quedan («${finDia.replace(/\s+/g, ' ').trim().slice(0, 70)}»)`);
    await p.locator('.travesia-final').getByRole('button', { name: 'Cerrar' }).click();
    await juegoDia.waitFor({ state: 'detached' });
    await p.waitForFunction(() => document.querySelector('.tv-dia-clasif .tv-fila.yo'), null, { timeout: 8000 });
    check(/quedan 2 intentos/.test(await dia.locator('.tv-dia-correr').textContent()), 'y su clasificación del día, con su fila; le quedan dos intentos');
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });

    // --- La práctica, en un solo toque: su pista y la música ---
    await tarjeta.getByRole('button', { name: /Practicar/ }).click();
    const juego = p.locator('.travesia');
    await juego.waitFor();
    const pista = await juego.locator('.travesia-pista').textContent();
    check(/mantén/.test(pista) && !/doble/.test(pista), `en un solo toque, la pista no habla del doble salto («${pista}»)`);
    const musica = juego.getByRole('button', { name: 'Poner la música del juego' });
    await musica.click();
    check((await ajustes()).musicaJuego === true && await juego.getByRole('button', { name: 'Quitar la música del juego' }).count() === 1, 'la música se pone con su botón (y se recuerda)');
    await juego.getByRole('button', { name: 'Quitar la música del juego' }).click();
    check(await juego.locator('.travesia-combo').isHidden(), 'sin combo, la pastilla del combo no se ve');
    await juego.getByRole('button', { name: 'Cerrar el juego' }).click();
    await juego.waitFor({ state: 'detached' });

    // --- Una etapa de un descanso: suma a las misiones y deja hacer la foto ---
    await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'); a.juegoUnToque = false; a.juegoContraste = false; localStorage.setItem('fbe-ajustes', JSON.stringify(a)); });
    // (rango 7: una de sus misiones es «juega en N descansos», que una etapa siempre hace avanzar)
    await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('fbe-juego-meta-')); localStorage.setItem(k, JSON.stringify({ rango: 7, activas: [], hechas: 20, logros: {} })); });
    const antes = await meta();
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    const prep = p.locator('.preparacion');
    if (await prep.count()) await prep.getByRole('button', { name: 'Ahora no' }).click();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const primero = p.locator('.ejercicio').first();
    await primero.getByLabel('Kilos de la serie 1').fill('30');
    await primero.getByLabel('Repeticiones de la serie 1').fill('8');
    await p.keyboard.press('Escape');
    await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    const reloj = p.locator('.temporizador');
    await reloj.waitFor();
    await reloj.getByRole('button', { name: 'Quitar 1 minuto' }).click().catch(() => {});
    for (let i = 0; i < 12 && seg(await reloj.locator('.cuenta').textContent()) > 22; i++) await reloj.getByRole('button', { name: 'Quitar 15 segundos' }).click();
    const quedaban = seg(await reloj.locator('.cuenta').textContent());
    await reloj.getByRole('button', { name: 'Jugar' }).click();
    await juego.waitFor();
    for (let i = 0; i < 6; i++) { await p.touchscreen.tap(200, 520); await p.waitForTimeout(600); }
    const fin = p.locator('.travesia-final');
    await fin.waitFor({ timeout: (quedaban + 8) * 1000 });
    const despues = await meta();
    const sumo = despues?.rango >= 7 && (despues.activas.find((a) => a.id === 'etapas')?.valor || 0) >= 1;
    check(sumo, 'la etapa del descanso suma a las misiones (se guarda en el móvil)');
    const boton = fin.locator('.travesia-foto');
    check(await boton.count() === 1 && /foto/i.test(await boton.textContent()), 'al acabar, «Guardar la foto»');
    const descarga = p.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await boton.click();
    const d = await descarga;
    check(d && /la-travesia\.png$/.test(d.suggestedFilename()), `la foto sale como imagen (${d?.suggestedFilename() || 'nada'})`);
    await juego.waitFor({ state: 'detached', timeout: 9000 });
  } catch (e) {
    check(false, `La travesía, al nivel de los mejores: ${e.message.split('\n')[0]}`);
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
  console.log('\nLa travesía, al nivel de los mejores');
  try { await probarTravesiaTop({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
