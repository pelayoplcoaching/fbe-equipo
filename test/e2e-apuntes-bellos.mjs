// «Apuntes», más bonitos, en la demo y en un móvil simulado: cada tipo con su tono y su sello, la hoja de cuaderno con su
// mazo, el rotulador, destapar dándose la vuelta, el sello al contestar y los puntos del rato, las palabras del glosario
// en el texto con su bocadillo, el marcapáginas, deslizar con el dedo, la cuenta como barra, la nota del examen con su aro
// y su sello, la medalla nueva en grande, la semana encendida en Semana y, con «reducir movimiento», todo quieto.
//   Suelta:  npm run build && node test/e2e-apuntes-bellos.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarApuntesBellos } = await import('./e2e-apuntes-bellos.mjs'); await probarApuntesBellos({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';
import { TONOS, palabraClave } from '../web/src/logica/apuntes-arte.js';
import { lunesDe, sumarDias, fechaMadrid } from '../web/src/logica/fechas.js';

export async function probarApuntesBellos({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const abrir = async (opciones = {}, vistos = []) => {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid', ...opciones });
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
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    if (vistos.length) {
      const l = lunesDe(fechaMadrid());
      await p.evaluate(async ([ids, d0, d1]) => {
        const yo = (await globalThis.__fbeDemo.select('atletas', {}))[0], v = {};
        for (const id of ids) v[id] = { n: 1, t: d1 };
        localStorage.setItem(`fbe-apuntes-${yo.id}`, JSON.stringify({ vistos: v, dias: [d0, d1] }));
      }, [vistos, sumarDias(l, 1) <= fechaMadrid() ? sumarDias(l, 1) : l, sumarDias(l, -6)]);
      await p.waitForTimeout(300);
      await p.reload();
      await p.locator('nav.tabs').waitFor();
      await fueraAvisos();
    }
    return { ctx, p, fueraAvisos };
  };
  const NUEVE = ['g:1rm', 'g:backoff', 'g:descarga', 'g:superserie', 'g:hipertrofia', 'g:volumen', 'g:fallo', 'g:rpe', 'g:tempo'];

  // --- «El apunte de hoy»: la hoja, el sello, el rotulador, el mazo, la medalla nueva, la vuelta, el sello al contestar ---
  let { ctx, p } = await abrir({}, NUEVE);
  try {
    const t = p.locator('.apuntes-tarjeta:not(.repaso)');
    await t.scrollIntoViewIfNeeded();
    await t.getByRole('button', { name: 'Leer' }).click();
    const hoja = p.locator('.apuntes'), tarjeta = hoja.locator('article.apunte');
    await tarjeta.waitFor();
    // (con el décimo apunte, la primera medalla, en grande)
    const nueva = hoja.locator('.apuntes-medalla-nueva');
    await nueva.waitFor({ timeout: 4000 }).catch(() => {});
    check(await nueva.count() === 1 && /Nueva medalla/.test(await nueva.textContent()) && /Curioso/.test(await nueva.textContent()) && await nueva.locator('.metal-bronce').count() === 1 && await nueva.getAttribute('role') === 'status',
      'con el décimo apunte, la medalla nueva se presenta en grande (de bronce: «Curioso»)');
    await nueva.waitFor({ state: 'detached', timeout: 5000 });
    const clase = await tarjeta.getAttribute('class');
    const tono = (/tono-(\w+)/.exec(clase) || [])[1];
    check(TONOS.includes(tono) && await tarjeta.locator('.apunte-etq .apunte-sello svg').count() === 1 && new RegExp(`fondo-${tono}`).test(await hoja.getAttribute('class')),
      `cada tarjeta lleva el tono de su tipo (${tono}), su sello dibujado y el fondo de la pantalla a juego`);
    check(await tarjeta.locator('.apunte-esquina').count() === 1 && await hoja.locator('.apunte-mazo').getAttribute('data-mazo') === '2' && await tarjeta.evaluate((el) => getComputedStyle(el).backgroundImage.includes('repeating-linear-gradient')),
      'es una hoja de cuaderno (renglones, esquina doblada) con un mazo detrás');
    let rotulador = false, vuelta = false, sello = false, terminos = false, guardado = false;
    for (let i = 0; i < 30 && !(rotulador && vuelta && terminos); i++) {
      const h2 = tarjeta.locator('h2');
      if (!rotulador && await h2.count()) {
        const titulo = await h2.textContent(), k = palabraClave(titulo);
        if (k) { rotulador = await h2.locator('mark.apunte-rotulador').textContent() === k.palabra && titulo === k.antes + k.palabra + k.despues; check(rotulador, `el rotulador subraya «${k.palabra}» y el título se lee entero («${titulo}»)`); }
      }
      if (!terminos && await tarjeta.locator('.apunte-termino-en').count()) {
        const pal = tarjeta.locator('.apunte-termino-en').first(), texto = await tarjeta.locator('.apunte-texto').textContent();
        await pal.click();
        const def = tarjeta.locator('.apunte-definicion');
        terminos = await def.count() === 1 && (await def.textContent()).startsWith(await pal.textContent()) === false ? (await def.textContent()).length > 10 : await def.count() === 1;
        check(terminos && await pal.getAttribute('aria-expanded') === 'true' && await tarjeta.locator('.apunte-texto').textContent() === texto,
          `las palabras del glosario van subrayadas en el texto; al tocar «${await pal.textContent()}», su definición en un bocadillo`);
        if (!guardado && await tarjeta.getByRole('button', { name: 'Guardar' }).count()) {
          await tarjeta.getByRole('button', { name: 'Guardar' }).click();
          guardado = await tarjeta.locator('.apunte-marcapaginas').count() === 1;
          check(guardado, 'al guardarlo, un marcapáginas cae en la esquina');
        }
      }
      if (!vuelta && await tarjeta.locator('.apunte-destapar').count()) {
        await tarjeta.locator('.apunte-destapar').click();
        vuelta = /girando/.test(await tarjeta.getAttribute('class')) && await tarjeta.locator('.apunte-texto').count() === 1;
        check(vuelta, 'al destapar el mito o el error, la tarjeta se da la vuelta (y el texto ya está)');
        await p.waitForTimeout(550);
        const puntos0 = await hoja.locator('.apuntes-puntos i').count();
        await hoja.getByRole('button', { name: 'Lo sabía', exact: true }).click();
        const ida = hoja.locator('.apunte-saliente');
        sello = await ida.count() === 1 && /¡Lo sabías!/.test(await ida.textContent()) && /va-derecha/.test(await ida.getAttribute('class')) && await ida.getAttribute('aria-hidden') === 'true';
        check(sello && await hoja.locator('.apuntes-puntos i').count() === puntos0 + 1 && await hoja.locator('.apuntes-puntos i').last().getAttribute('class') === 'sabia',
          '«Lo sabía»: la tarjeta se va a la derecha con el sello «¡Lo sabías!» y arriba se enciende un punto verde');
        await ida.waitFor({ state: 'detached', timeout: 2000 });
        continue;
      }
      await hoja.getByRole('button', { name: /Otro apunte/ }).click();
      await p.waitForTimeout(250);
    }
    check(rotulador && vuelta && terminos, 'en unos cuantos apuntes salen el rotulador, la vuelta y las palabras del glosario');
    // Deslizar con el dedo: a la izquierda, el siguiente
    await hoja.locator('.apunte-saliente').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
    if (await tarjeta.locator('.apunte-destapar').count()) { await hoja.getByRole('button', { name: /Otro apunte/ }).click(); await p.waitForTimeout(700); }
    await p.waitForTimeout(500);
    await hoja.locator('.apuntes-cuerpo').evaluate((el) => { el.scrollTop = 0; });
    await p.waitForTimeout(100);
    const antes = await tarjeta.textContent(), caja = await tarjeta.boundingBox();
    // (por el medio del texto, dentro de la pantalla)
    const x = caja.x + caja.width * 0.6, y = Math.min(700, Math.max(caja.y + 40, caja.y + Math.min(caja.height / 2, 180)));
    await p.mouse.move(x, y);
    await p.mouse.down();
    await p.mouse.move(x - 60, y + 3, { steps: 5 });
    const arrastre = await tarjeta.evaluate((el) => [el.classList.contains('arrastrando'), el.style.transform, el.querySelector('.apunte-deslizar')?.textContent || '']);
    await p.mouse.move(x - 170, y + 6, { steps: 6 });
    await p.mouse.up();
    await p.waitForTimeout(120);
    if (!arrastre[0]) console.log('    (arrastre)', JSON.stringify(caja), await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return `${e.tagName}.${e.className}`; }, [x, y]), await tarjeta.getAttribute('class'));
    check(arrastre[0] && /translateX\(-\d/.test(arrastre[1]) && /rotate\(-/.test(arrastre[1]) && arrastre[2] === 'Siguiente' && await tarjeta.textContent() !== antes && await hoja.locator('.apunte-saliente.va-izquierda').count() === 1,
      'deslizando con el dedo: la tarjeta sigue al dedo, gira un poco, asoma «Siguiente» y al soltar pasa al siguiente');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'nada se sale de la pantalla');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();

    // --- En Semana: los siete días y la medalla dibujada ---
    await irASeccion(p, 'Semana');
    const ts = p.locator('.apuntes-tarjeta.repaso');
    await ts.scrollIntoViewIfNeeded();
    const dias = ts.locator('.apuntes-semana span');
    check(await dias.count() === 7 && (await dias.allTextContents()).join('') === 'LMXJVSD' && await ts.locator('.apuntes-semana span.hecho').count() >= 1 && await ts.locator('.apuntes-semana span.hoy').count() === 1
      && /de 7 días/.test(await ts.locator('.apuntes-semana').getAttribute('aria-label')), 'en Semana, los siete días, encendidos los que ha aprendido algo');
    check(await ts.locator('.apuntes-medalla .apuntes-medalla-dibujo.metal-bronce').count() === 1, 'y la medalla, dibujada con su metal');
  } catch (e) {
    check(false, `Apuntes bellos: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  // --- En un descanso: la cuenta como barra; y el examen con su aro y su sello ---
  ({ ctx, p } = await abrir({}, [...NUEVE, 'g:rir', 'g:amrap', 'g:cadencia', 'm:1']));
  try {
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    const prep = p.locator('.preparacion');
    if (await prep.count()) {
      for (const [g, r] of [['¿Cómo has dormido?', 'Bien'], ['¿Cómo tienes la energía?', 'Normal'], ['¿Agujetas o molestias?', 'Ninguna']]) {
        await prep.getByRole('group', { name: g }).getByRole('button', { name: r, exact: true }).click();
        await p.waitForTimeout(350);
      }
    }
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const primero = p.locator('.ejercicio').first();
    await primero.getByLabel('Kilos de la serie 1').fill('30');
    await primero.getByLabel('Repeticiones de la serie 1').fill('8');
    await p.keyboard.press('Escape');
    await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    const reloj = p.locator('.temporizador');
    await reloj.waitFor();
    await reloj.getByRole('button', { name: 'Aprender' }).click();
    const hoja = p.locator('.apuntes');
    await hoja.locator('article.apunte').waitFor();
    const barra = hoja.locator('.apuntes-barra i');
    const k1 = await barra.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    await p.waitForTimeout(1600);
    const k2 = await barra.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    check(k1 > 0.9 && k2 < k1 && await hoja.locator('.apuntes-cuenta').count() === 1, `la cuenta del descanso, además, como una barra que se vacía (${k1.toFixed(3)} → ${k2.toFixed(3)})`);
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await p.locator('.temporizador .saltar').click().catch(() => {});
    await p.getByRole('button', { name: 'Volver' }).first().click().catch(() => {});
    await p.locator('nav.tabs').waitFor();
    for (let i = 0; i < 4; i++) { await p.waitForTimeout(300); const d = p.locator('[role=dialog]').last(); if (!(await d.isVisible().catch(() => false))) break; await p.keyboard.press('Escape'); }
    await irASeccion(p, 'Semana');
    const ts = p.locator('.apuntes-tarjeta.repaso');
    await ts.scrollIntoViewIfNeeded();
    await ts.getByRole('button', { name: /Examen/ }).click();
    const tarjeta = hoja.locator('article.apunte');
    await tarjeta.waitFor();
    let falladas = 0;
    for (let i = 0; i < 10; i++) {
      if (await hoja.locator('.examen-nota').count()) break;
      const ops = tarjeta.locator('.apunte-opcion');
      await ops.last().click();
      await p.waitForTimeout(80);
      if (await tarjeta.locator('.apunte-opcion.mala').count()) {
        falladas += 1;
        if (falladas === 1) check(await tarjeta.locator('.apunte-opcion.buena .apunte-marca-buena path').count() === 1 && await tarjeta.locator('.apunte-opcion.mala').evaluate((el) => getComputedStyle(el).animationName) === 'ap-tiembla',
          'en la pregunta, la buena se marca con un trazo que se dibuja y la mala tiembla');
      }
      await hoja.getByRole('button', { name: /Siguiente|Ver la nota/ }).click();
      await p.waitForTimeout(150);
    }
    const nota = hoja.locator('.examen-nota');
    await nota.waitFor();
    const h2 = await nota.locator('h2').textContent();
    check(await nota.locator('.examen-aro .lleno').count() === 1 && /^\d+%$/.test(await nota.locator('.examen-pct').textContent()) && /^\d de 8 /.test(h2) && /Sobresaliente|Notable|Aprobado|Toca repasar/.test(await nota.locator('.examen-sello').textContent()),
      `la nota del examen: un aro que se llena, el porcentaje y la nota como un sello («${h2}»)`);
    const conConfeti = await nota.locator('.apuntes-confeti').count() === 1, nAciertos = Number(h2.split(' ')[0]);
    check(conConfeti === nAciertos / 8 >= 0.7, `confeti solo de notable para arriba (${nAciertos} de 8: ${conConfeti ? 'con' : 'sin'} confeti)`);
  } catch (e) {
    check(false, `Apuntes bellos, en el descanso y el examen: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  // --- Con «reducir movimiento» y en oscuro: se lee igual, sin tarjetas que vuelen ni dedos que arrastren ---
  ({ ctx, p } = await abrir({ reducedMotion: 'reduce', colorScheme: 'dark' }));
  try {
    const t = p.locator('.apuntes-tarjeta:not(.repaso)');
    await t.scrollIntoViewIfNeeded();
    await t.getByRole('button', { name: 'Leer' }).click();
    const hoja = p.locator('.apuntes'), tarjeta = hoja.locator('article.apunte');
    await tarjeta.waitFor();
    const fondo = await tarjeta.evaluate((el) => getComputedStyle(el).backgroundColor);
    await hoja.getByRole('button', { name: /Otro apunte/ }).click();
    check(await hoja.locator('.apunte-saliente').count() === 0 && await tarjeta.evaluate((el) => getComputedStyle(el).animationName) === 'none', 'con «reducir movimiento», ni la tarjeta se va volando ni entra moviéndose');
    check(/rgb\((2[0-9]|1[0-9]), (2[0-9]|1[0-9]), (4[0-9]|3[0-9])\)/.test(fondo), `en oscuro, la hoja es oscura (${fondo})`);
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
  } catch (e) {
    check(false, `Apuntes bellos, con reducir movimiento: ${e.message.split('\n')[0]}`);
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
  console.log('\nApuntes, más bonitos');
  try { await probarApuntesBellos({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
