// «Apuntes», segunda tanda, en la demo y en un móvil simulado: lo tuyo primero (tus números), las preguntas de tres
// opciones, guardar un apunte y leer su guía, llevarse una clave a la siguiente serie («¿Lo has hecho?»), «No lo entiendo»
// (le llega al coach), los guardados en Semana y el apunte «al paso» en las filas de Hoy.
//   Suelta:  npm run build && node test/e2e-apuntes2.mjs
//   Dentro de e2e.test.mjs:  const { probarApuntes2 } = await import('./e2e-apuntes2.mjs'); await probarApuntes2({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarApuntes2({ navegador, check, base = 'http://localhost:4174' }) {
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
  const estado = () => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('fbe-apuntes-')); return k ? JSON.parse(localStorage.getItem(k)) : { vistos: {} }; });
  const hoja = p.locator('.apuntes'), tarjeta = hoja.locator('article.apunte');
  const chip = () => tarjeta.locator('.apunte-etq .chip').textContent();
  const otro = async () => { await hoja.getByRole('button', { name: /Otro apunte|Siguiente/ }).click(); await p.waitForTimeout(220); };
  // pasa apuntes hasta dar con uno de esa etiqueta (o se rinde)
  const hasta = async (etiqueta, max = 40) => { for (let i = 0; i < max; i++) { if (await tarjeta.count() && await chip() === etiqueta) return true; if (!(await hoja.getByRole('button', { name: /Otro apunte/ }).count())) return false; await otro(); } return false; };

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();

    // --- Hoy: el apunte «al paso», al abrir una fila ---
    const peso = p.locator('details.plegable-hoy[data-plegable="peso"]');
    await peso.scrollIntoViewIfNeeded();
    check(await p.locator('.apunte-al-paso').count() === 0, 'en Hoy, con las filas plegadas, el apunte «al paso» no pide nada ni se ve');
    await peso.locator('summary').click();
    const alPaso = peso.locator('.apunte-al-paso');
    await alPaso.waitFor({ timeout: 8000 });
    check((await alPaso.locator('p').textContent()).length > 15 && await alPaso.getByRole('button', { name: 'Leer la guía' }).count() === 1, `al abrir «Tu peso», un apunte de la guía que viene a cuento («${(await alPaso.locator('p').textContent()).slice(0, 50)}…»)`);
    await peso.locator('summary').click();

    // --- En la sesión ---
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const primero = p.locator('.ejercicio').first();
    const marcar = async (n) => {
      await primero.getByLabel(`Kilos de la serie ${n}`).fill('30');
      await primero.getByLabel(`Repeticiones de la serie ${n}`).fill('8');
      await p.keyboard.press('Escape');
      await primero.getByRole('button', { name: `Marcar la serie ${n} como hecha` }).click();
      await p.locator('.temporizador').waitFor();
    };
    await marcar(1);
    const reloj = p.locator('.temporizador');
    await reloj.getByRole('button', { name: 'Aprender' }).click();
    await tarjeta.waitFor();
    const c0 = await chip();
    check(['Tus números', 'Te lo corrigió tu coach'].includes(c0), `lo primero del descanso es lo suyo (${c0}: «${(await tarjeta.textContent()).replace(c0, '').slice(0, 70)}»)`);
    if (c0 !== 'Tus números') await hasta('Tus números', 3);
    check(await chip() === 'Tus números' && /Ahora: /.test(await tarjeta.locator('h2').textContent()) && /La última vez hiciste|primera vez/.test(await tarjeta.locator('.apunte-texto').textContent()) && await tarjeta.getByRole('button', { name: /Guardar/ }).count() === 0,
      'sus números: lo que le toca ahora y lo de la última vez (no se guarda: es de este momento)');

    // Una clave: llevársela a la siguiente serie
    check(await hasta('La clave'), 'después, las claves del ejercicio');
    const clave = await tarjeta.locator('.apunte-texto').textContent();
    check(await tarjeta.getByRole('button', { name: 'Escuchar' }).count() <= 1 && await tarjeta.getByRole('button', { name: 'Lo pruebo en la siguiente serie' }).count() === 1 && await tarjeta.getByRole('button', { name: 'No lo entiendo' }).count() === 1, 'cada apunte trae sus acciones: guardar, llevárselo a la serie, «No lo entiendo»…');
    await tarjeta.getByRole('button', { name: 'No lo entiendo' }).click();
    await p.locator('.toast', { hasText: 'Enviado a tu coach' }).waitFor();
    const mensajes = await p.evaluate(() => globalThis.__fbeDemo.select('comentarios', {}).then((cs) => cs.filter((c) => /No entiendo este apunte/.test(c.texto || '')).map((c) => c.texto)));
    check(mensajes.length === 1 && mensajes[0].includes(clave.slice(0, 20)), '«No lo entiendo» le manda la duda a su coach, con el apunte');
    await tarjeta.getByRole('button', { name: 'Lo pruebo en la siguiente serie' }).click();
    await hoja.waitFor({ state: 'detached' });
    check((await estado()).reto?.texto === clave, '«Lo pruebo en la siguiente serie» cierra los apuntes y se lleva la clave');
    await p.locator('.temporizador .saltar').click();
    await marcar(2);
    await tarjeta.waitFor({ timeout: 5000 });
    check(await chip() === '¿Lo has hecho?' && await tarjeta.locator('.apunte-texto').textContent() === clave && await hoja.getByRole('button', { name: 'Sí, lo he hecho' }).count() === 1, 'en el siguiente descanso, lo primero: «¿Lo has hecho?», con la clave');
    await hoja.getByRole('button', { name: 'Sí, lo he hecho' }).click();
    await p.waitForTimeout(250);
    const e1 = await estado();
    check(!e1.reto && Object.values(e1.vistos).some((v) => v.s === true), 'contestado: queda apuntado y ya no vuelve a preguntar');

    // Una pregunta de tres opciones
    check(await hasta('Pregunta'), 'entre los apuntes hay preguntas');
    const opciones = tarjeta.locator('.apunte-opcion');
    check(await opciones.count() === 3 && await tarjeta.locator('.apunte-acciones').count() === 0, 'la pregunta trae tres opciones (y aún no sus acciones)');
    await opciones.first().click();
    check(await tarjeta.locator('.apunte-opcion.buena').count() === 1 && /^(Eso es\.|Era «)/.test(await tarjeta.locator('.apunte-texto').textContent()) && await opciones.first().isDisabled(), 'al contestar se marca la buena y dice si has acertado');

    // Una idea de las guías: guardarla y leer su guía
    check(await hasta('Idea clave') || await hasta('Mito'), 'y las ideas de las guías');
    if (await hoja.locator('.apunte-destapar').count()) await hoja.locator('.apunte-destapar').click();
    const tituloIdea = await tarjeta.locator('h2').textContent();
    await tarjeta.getByRole('button', { name: 'Guardar' }).click();
    check(await tarjeta.getByRole('button', { name: 'Guardado' }).getAttribute('aria-pressed') === 'true' && (await estado()).guardados?.length === 1, 'se guarda para luego');
    await tarjeta.getByRole('button', { name: 'Leer la guía' }).click();
    const guia = p.locator('.hoja-dialogo').last();
    await guia.waitFor();
    await p.waitForTimeout(600);   // (la hoja entra con su muelle)
    const encima = await guia.evaluate((g) => { const r = g.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, Math.max(r.top, 0) + 40); return g.contains(el); });
    check(encima && (await guia.textContent()).length > 80, '«Leer la guía» la abre encima, entera');
    await guia.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await guia.waitFor({ state: 'detached' });
    check(await hoja.count() === 1, 'y al cerrarla sigue en los apuntes');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    await p.locator('.temporizador .saltar').click();

    // --- Semana: los guardados ---
    await p.getByRole('button', { name: 'Volver' }).first().click();
    await p.locator('nav.tabs').waitFor();
    await irASeccion(p, 'Semana');
    const enSemana = p.locator('.apuntes-tarjeta.repaso');
    await enSemana.waitFor({ timeout: 8000 });
    await enSemana.scrollIntoViewIfNeeded();
    await enSemana.getByRole('button', { name: 'Guardados (1)' }).click();
    await tarjeta.waitFor();
    check(/Guardados/.test(await hoja.locator('.apuntes-titulo').textContent()) && await tarjeta.locator('h2').textContent() === tituloIdea, 'en Semana, «Guardados (1)» abre el que guardó');
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
  } catch (e) {
    check(false, `Apuntes, tanda 2: ${e.message.split('\n')[0]}`);
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
  console.log('\nApuntes, tanda 2');
  try { await probarApuntes2({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
