// «Apuntes»: practicar (tanda B), en la demo y en un móvil simulado: uno de cada cuatro apuntes es un ejercicio
// (emparejar contrarreloj, completar el hueco, verdadero o falso rápido) o una microlección (tu 1RM, RIR ↔ RPE); las
// tres explicaciones («Más fácil», normal, «A fondo»); en el descanso, ordenar los pasos y «Grábate y compáralo» (el
// vídeo no sale del móvil); y la primera vez con un ejercicio, sus tres claves antes de la primera serie.
//   Suelta:  npm run build && node test/e2e-apuntes-t2.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarApuntesPractica } = await import('./e2e-apuntes-t2.mjs'); await probarApuntesPractica({ navegador, check });
import { pathToFileURL } from 'node:url';
import { GLOSARIO } from '../web/src/logica/apuntes.js';
import { primeraFrase } from '../web/src/logica/apuntes-practica.js';

export async function probarApuntesPractica({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const entrar = async (quien) => { await p.getByRole('button', { name: new RegExp(quien) }).first().click(); await p.locator('nav.tabs').waitFor(); await fueraAvisos(); };
  const cambiarA = async (quien) => { await p.waitForTimeout(450); await p.evaluate(() => { localStorage.removeItem('fbe-demo-v2-sesion'); }); await p.goto(`${base}/?demo`); await entrar(quien); };
  const hoja = p.locator('.apuntes'), tarjeta = hoja.locator('article.apunte');
  const chip = async () => (await tarjeta.locator('.apunte-etq .chip').textContent().catch(() => '')).trim();
  const DEF = new Map(GLOSARIO.map(([t, x]) => [t, primeraFrase(x, 90)]));
  // Pasa al siguiente apunte con lo que pida el que hay (sin practicar: los ejercicios se saltan)
  const pasar = async () => {
    if (await hoja.locator('.apunte-recordar').count()) { await hoja.locator('.apunte-recordar').click(); await hoja.getByRole('button', { name: /^Bien/ }).click(); }
    else if (await tarjeta.locator('.apunte-destapar').count()) { await tarjeta.locator('.apunte-destapar').click(); await hoja.getByRole('button', { name: 'Lo sabía', exact: true }).click(); }
    else if (await tarjeta.locator('.apunte-opcion').count() && !(await tarjeta.locator('.apunte-opcion[disabled]').count())) { await tarjeta.locator('.apunte-opcion').first().click(); await hoja.locator('.apuntes-pie .btn-primario').click(); }
    else await hoja.locator('.apuntes-pie .btn').last().click();
    await p.waitForTimeout(380);
  };

  try {
    await p.goto(`${base}/?demo`);
    await entrar('Ana López');
    const enHoy = p.locator('.apuntes-tarjeta:not(.repaso)');
    await enHoy.scrollIntoViewIfNeeded();
    await enHoy.getByRole('button', { name: 'Leer' }).click();
    await tarjeta.waitFor();

    // --- Tres explicaciones: en el glosario, «Más fácil» acorta ---
    let niveles = false;
    const vistos = [];
    for (let i = 0; i < 3; i++) {
      vistos.push(await chip());
      if (!niveles && await tarjeta.locator('.apunte-niveles').count()) {
        const antes = await tarjeta.locator('.apunte-texto').textContent();
        const facil = tarjeta.locator('.apunte-niveles').getByRole('button', { name: 'Más fácil' });
        if (!(await facil.isDisabled())) {
          await facil.click();
          const despues = await tarjeta.locator('.apunte-texto').textContent();
          niveles = despues.length < antes.length && await facil.getAttribute('aria-pressed') === 'true';
          await tarjeta.locator('.apunte-niveles').getByRole('button', { name: 'Normal' }).click();
          niveles &&= (await tarjeta.locator('.apunte-texto').textContent()) === antes;
        }
      }
      await pasar();
    }

    // --- El cuarto: emparejar contrarreloj ---
    check(await chip() === 'Empareja' && await tarjeta.locator('.emparejar-termino').count() === 4 && await tarjeta.locator('.emparejar-def').count() === 4 && await tarjeta.locator('.practica-tiempo[role=timer]').count() === 1,
      `uno de cada cuatro, un ejercicio: el cuarto, «Empareja» (cuatro palabras, cuatro definiciones y la cuenta atrás) (antes: ${vistos.join(', ')})`);
    check(await hoja.getByRole('button', { name: /Otro apunte/ }).count() === 1 && await tarjeta.locator('.apunte-acciones').count() === 0, 'mientras se hace, se puede pasar a otro (sin las acciones de un apunte)');
    const terminos = await tarjeta.locator('.emparejar-termino').allTextContents();
    // uno mal a propósito
    await tarjeta.locator('.emparejar-termino').nth(0).click();
    const defs = await tarjeta.locator('.emparejar-def').allTextContents();
    const malaI = defs.findIndex((d) => d !== DEF.get(terminos[0]));
    await tarjeta.locator('.emparejar-def').nth(malaI).click();
    check(await tarjeta.locator('.emparejar-def.mal').count() === 1, 'una definición que no casa se agita');
    for (const t of terminos) {
      await tarjeta.locator('.emparejar-termino', { hasText: new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click();
      await tarjeta.locator('.emparejar-def', { hasText: DEF.get(t) }).first().click();
    }
    const veredicto = tarjeta.locator('.practica-veredicto');
    await veredicto.waitFor({ timeout: 3000 });
    check(/^Un fallo, en \d+ s$/.test(await veredicto.textContent()) && await tarjeta.locator('.emparejar-termino.hecho').count() === 4, `al casarlas todas: «${await veredicto.textContent()}»`);
    check(await hoja.locator('.apuntes-pie .btn-primario').count() === 1, 'y ya se sigue');
    const v = await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^fbe-apuntes-[0-9a-f-]{36}$/.test(x)); return k ? Object.keys(JSON.parse(localStorage.getItem(k)).vistos) : []; });
    check(!v.some((id) => id.startsWith('x:')), 'los ejercicios no cuentan como apuntes vistos');
    await hoja.locator('.apuntes-pie .btn-primario').click();
    await p.waitForTimeout(380);

    // --- El octavo: completar el hueco ---
    for (let i = 0; i < 3; i++) await pasar();
    check(await chip() === 'Completa el hueco' && /_____/.test(await tarjeta.locator('h2').textContent()) && await tarjeta.locator('.apunte-opcion').count() === 3, `el octavo, «Completa el hueco» («${(await tarjeta.locator('h2').textContent().catch(() => '')).slice(0, 60)}»)`);
    await tarjeta.locator('.apunte-opcion').first().click();
    check(/^(Eso es|Era «)/.test(await tarjeta.locator('.apunte-texto[role=status]').textContent()), 'se contesta como una pregunta: la frase entera al responder');
    await hoja.locator('.apuntes-pie .btn-primario').click();
    await p.waitForTimeout(380);

    // --- El duodécimo: verdadero o falso rápido ---
    for (let i = 0; i < 3; i++) await pasar();
    check(await chip() === 'Verdadero o falso' && await tarjeta.locator('.vf-frase').count() === 1 && await tarjeta.getByRole('button', { name: 'Verdadero' }).count() === 1, 'el duodécimo, «Verdadero o falso», una frase cada vez');
    for (let i = 0; i < 5; i++) { await tarjeta.getByRole('button', { name: 'Verdadero' }).click(); await p.waitForTimeout(760); }
    await tarjeta.locator('.vf-nota').waitFor({ timeout: 3000 });
    check(/\d de 5/.test(await tarjeta.locator('.vf-nota').textContent()) && (await tarjeta.locator('.vf-falladas li').count()) >= 1, `al acabar, la nota (${(await tarjeta.locator('.vf-nota').textContent()).trim()}) y las falladas con su porqué`);
    await hoja.locator('.apuntes-pie .btn-primario').click();
    await p.waitForTimeout(380);

    // --- El decimosexto: tu 1RM con los deslizadores ---
    for (let i = 0; i < 3; i++) await pasar();
    check(await chip() === 'Pruébalo' && await tarjeta.locator('input[type=range]').count() === 3, 'el decimosexto, una microlección: tu 1RM con tres deslizadores');
    const r0 = await tarjeta.locator('.micro-resultado').textContent();
    await tarjeta.getByLabel('Repeticiones', { exact: true }).fill('3');
    const r1 = await tarjeta.locator('.micro-resultado').textContent();
    check(r0 !== r1 && /\d+(,\d)? kg/.test(r1) && await tarjeta.locator('.micro-tabla > span').count() === 4, `al moverlos, cambia la cuenta (${r0.replace(/\s+/g, ' ')} → ${r1.replace(/\s+/g, ' ')})`);
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    check(niveles, 'tres explicaciones: «Más fácil» lo acorta y «Normal» lo devuelve');

    // --- La primera vez con un ejercicio: tres claves antes de la primera serie ---
    await cambiarA('Pelayo');
    const enlazado = await p.evaluate(async () => {
      const b = globalThis.__fbeDemo, ejs = await b.select('ejercicios', {});
      const dom = ejs.find((e) => e.nombre === 'Dominadas pronas'), press = ejs.find((e) => e.nombre === 'Press banca');
      const enl = (await b.select('ejercicios_fichas', {})).find((x) => x.ejercicio_id === press?.id);
      if (!dom || !enl) return false;
      await b.insert('ejercicios_fichas', [{ ejercicio_id: dom.id, ficha_id: enl.ficha_id }]);
      return (await b.select('ejercicios_fichas', {})).some((x) => x.ejercicio_id === dom.id);
    });
    await cambiarA('Ana López');
    // (sus series de otras veces con las dominadas, fuera: así es «la primera vez»)
    await p.evaluate(async () => {
      const b = globalThis.__fbeDemo, dom = (await b.select('ejercicios', {})).find((e) => e.nombre === 'Dominadas pronas');
      for (const se of (await b.select('sesion_ejercicios', {})).filter((x) => x.ejercicio_id === dom.id)) await b.delete('series', { eq: { sesion_ejercicio_id: se.id } });
    });
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    const ej1 = p.locator('.sesion-vista .ejercicio').first();
    await ej1.waitFor();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    check(await ej1.locator('.antes-de-empezar').count() === 0, 'con un ejercicio que ya ha hecho otras veces, nada antes de empezar');
    const luego = ej1.getByRole('button', { name: /^Máquina ocupada: hacer/ });
    await luego.scrollIntoViewIfNeeded();
    await luego.click();
    const dom = p.locator('.sesion-vista .ejercicio', { hasText: 'Dominadas pronas' });
    await p.waitForTimeout(600);
    if (!(await dom.locator('.ejercicio-cuerpo').count())) await dom.locator('.ejercicio-cab').click();
    const antes = dom.locator('.antes-de-empezar');
    await antes.waitFor({ timeout: 5000 }).catch(() => {});
    check(enlazado && await antes.count() === 1 && await antes.locator('li').count() === 3 && /tres claves/.test(await antes.textContent()),
      `la primera vez con «Dominadas pronas» (con su ficha), sus tres claves antes de la primera serie («${(await antes.locator('li').first().textContent().catch(() => '')).slice(0, 40)}»…)`);
    await antes.getByRole('button', { name: 'Vale, a por ello' }).click();
    check(await antes.count() === 0 && await p.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('fbe-antes-') && localStorage.getItem(k).length > 4)), 'con «Vale, a por ello» se va y no vuelve a salir');

    // --- En el descanso: ordenar los pasos y «Grábate y compáralo» ---
    await dom.getByLabel('Repeticiones de la serie 1').fill('6');
    await p.keyboard.press('Escape');
    await dom.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    const reloj = p.locator('.temporizador');
    await reloj.waitFor();
    await reloj.getByRole('button', { name: 'Aprender' }).click();
    await tarjeta.waitFor();
    let comparar = false, ordenar = false;
    for (let i = 0; i < 9 && !(comparar && ordenar); i++) {
      const c = await chip();
      if (!comparar && await tarjeta.getByRole('button', { name: 'Grábate y compáralo' }).count()) {
        await tarjeta.getByRole('button', { name: 'Grábate y compáralo' }).click();
        const sheet = p.locator('.hoja-dialogo', { hasText: 'Grábate y compáralo' });
        await sheet.waitFor();
        const input = sheet.locator('input[type=file][capture]').first();
        const pide = await input.getAttribute('accept') === 'video/*' && /se queda en este móvil/.test(await sheet.textContent());
        await input.setInputFiles({ name: 'serie.mp4', mimeType: 'video/mp4', buffer: Buffer.from('no es un vídeo de verdad') });
        await sheet.locator('video').waitFor({ timeout: 3000 }).catch(() => {});
        comparar = pide && /^blob:/.test(await sheet.locator('video').getAttribute('src').catch(() => '')) && await sheet.locator('.comparar-clave').count() === 1;
        check(comparar, '«Grábate y compáralo»: grabas tu serie y la ves aquí (del propio móvil: no se sube), con la clave encima');
        await p.keyboard.press('Escape');
        await sheet.waitFor({ state: 'detached' });
      }
      if (c === 'Ordena') {
        const pasos = await tarjeta.locator('.ordenar-paso').count();
        ordenar = pasos >= 3;
        // los toca en el orden en que salen (casi nunca es el bueno): al acabar, el orden bueno
        for (let k = 0; k < pasos; k++) await tarjeta.locator('.ordenar-paso').first().click();
        await tarjeta.locator('.practica-veredicto').waitFor({ timeout: 3000 });
        check(ordenar && await tarjeta.locator('.ordenar-resultado li').count() === pasos && /orden/.test(await tarjeta.locator('.practica-veredicto').textContent()), `en el descanso, «Ordena» los pasos de su ficha (${pasos}) y enseña el orden bueno`);
      }
      await pasar();
    }
    check(comparar && ordenar, 'en el descanso salen los dos: «Grábate y compáralo» y «Ordena»');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Apuntes, practicar: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nApuntes, practicar');
  try { await probarApuntesPractica({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
