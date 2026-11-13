// «Apuntes» que se quedan (tanda A), en la demo y en un móvil simulado: lo que toca repasar hoy (en Hoy y en Semana),
// recordar antes de leer («Piénsalo y destápalo»), las tres notas con cuándo vuelve cada una, la pregunta del coach con
// el «por qué no» de la mala, y sin conexión, los apuntes con lo guardado.
//   Suelta:  npm run build && node test/e2e-apuntes-t1.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarApuntesRepaso } = await import('./e2e-apuntes-t1.mjs'); await probarApuntesRepaso({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';
import { sumarDias, fechaMadrid } from '../web/src/logica/fechas.js';
import { textoProxima } from '../web/src/logica/apuntes.js';

export async function probarApuntesRepaso({ navegador, check, base = 'http://localhost:4174' }) {
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
  const estado = () => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^fbe-apuntes-[0-9a-f-]{36}$/.test(x)); return k ? JSON.parse(localStorage.getItem(k)) : { vistos: {} }; });
  const hoja = p.locator('.apuntes'), tarjeta = hoja.locator('article.apunte');
  const hoy = fechaMadrid();
  const TOCAN = ['g:1rm', 'g:rpe', 'g:tempo'];
  const PREGUNTA = '¿Cuánto descansar entre series pesadas?';

  try {
    // --- Tres del glosario, vistos hace días, que tocan hoy ---
    await p.goto(`${base}/?demo`);
    await entrar('Ana López');
    await p.evaluate(async ([ids, t, pr]) => {
      const yo = (await globalThis.__fbeDemo.select('atletas', {}))[0], v = {};
      for (const id of ids) v[id] = { n: 1, t, c: 1, p: pr };
      localStorage.setItem(`fbe-apuntes-${yo.id}`, JSON.stringify({ vistos: v, dias: [t] }));
    }, [TOCAN, sumarDias(hoy, -4), sumarDias(hoy, -1)]);
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();

    // --- Hoy: lo que toca repasar ---
    const enHoy = p.locator('.apuntes-tarjeta:not(.repaso)');
    await enHoy.scrollIntoViewIfNeeded();
    check(/3 por repasar hoy/.test(await enHoy.textContent()) && await enHoy.getByRole('button', { name: 'Repasar (3)' }).count() === 1,
      'en Hoy, la tarjeta dice cuántos tocan repasar hoy, con su botón «Repasar (3)»');

    // --- Recordar antes de leer ---
    await enHoy.getByRole('button', { name: 'Repasar (3)' }).click();
    await tarjeta.waitFor();
    const pregunta = hoja.locator('.apunte-pregunta-recordar');
    check(/Repaso/.test(await hoja.locator('.apuntes-titulo').textContent()) && await pregunta.count() === 1 && /^¿Qué es «.+»\?$/.test(await pregunta.textContent())
      && await hoja.locator('.apunte-recordar').count() === 1 && await tarjeta.locator('.apunte-texto').count() === 0,
      `el repaso empieza tapado, con una pregunta («${await pregunta.textContent().catch(() => '')}») y «Piénsalo y destápalo»`);
    check(await hoja.getByRole('button', { name: 'Saltar por ahora' }).count() === 1 && await hoja.locator('.apunte-nota').count() === 0, 'antes de destaparlo no hay notas que poner: se puede saltar');
    const primero = Object.keys((await estado()).vistos).find((id) => TOCAN.includes(id));
    await hoja.locator('.apunte-recordar').click();
    await hoja.locator('.apunte-nota').first().waitFor();
    const notas = hoja.locator('.apunte-nota');
    const textos = await notas.allTextContents();
    check(textos.length === 3 && /Otra vez/.test(textos[0]) && textos[0].includes(textoProxima(0)) && /Bien/.test(textos[1]) && textos[1].includes(textoProxima(2)) && /Fácil/.test(textos[2]) && textos[2].includes(textoProxima(3)),
      `destapado: tres notas con cuándo vuelve cada una (${textos.map((x) => x.replace(/\s+/g, ' ')).join(' / ')})`);
    check(await tarjeta.locator('.apunte-pregunta-recordar').count() === 0 && (await tarjeta.textContent()).length > 40, 'y se lee el apunte entero');
    const idActual = async () => { const e = await estado(); return Object.entries(e.vistos).filter(([id]) => TOCAN.includes(id)).sort((a, b) => (b[1].t || '').localeCompare(a[1].t || ''))[0]; };
    await notas.nth(1).click();
    await p.waitForTimeout(450);
    const tras = (await estado()).vistos;
    const bien = TOCAN.find((id) => tras[id].t === hoy);
    check(!!bien && tras[bien].c === 2 && tras[bien].p === sumarDias(hoy, 7) && tras[bien].s === true, `«Bien»: sube de caja y vuelve en una semana (${JSON.stringify(tras[bien] || {})})`);

    // --- «Otra vez»: mañana ---
    await hoja.locator('.apunte-recordar').waitFor({ timeout: 4000 });
    await hoja.locator('.apunte-recordar').click();
    await hoja.getByRole('button', { name: /Otra vez/ }).click();
    await p.waitForTimeout(450);
    const tras2 = (await estado()).vistos;
    const otra = TOCAN.find((id) => id !== bien && tras2[id].t === hoy);
    check(!!otra && tras2[otra].c === 0 && tras2[otra].p === sumarDias(hoy, 1) && tras2[otra].s === false, '«Otra vez»: vuelve a la primera caja, mañana');
    void primero; void idActual;
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    check(/Uno por repasar hoy/.test(await enHoy.textContent()), 'al cerrar, a la tarjeta le queda uno');

    // --- Semana: también lo dice ---
    await irASeccion(p, 'Semana');
    const enSemana = p.locator('.apuntes-tarjeta.repaso');
    await enSemana.waitFor({ timeout: 8000 });
    check(await enSemana.getByRole('button', { name: 'Repasar (1)' }).count() === 1, 'en Semana, «Repasar (1)»');

    // --- Sin conexión: lo guardado ---
    const guardado = await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('fbe-fuentes-apuntes-') && !x.includes('-dia-')); return k ? JSON.parse(localStorage.getItem(k)) : null; });
    check(!!guardado?.guias?.d?.length && guardado.guias.d.every((g) => !g.contenido || !g.contenido.bloques || g.clave === 'mitos'), `con red, los apuntes dejan guardadas las guías, recortadas (${guardado?.guias?.d?.length || 0})`);
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    await p.evaluate(() => {
      const b = globalThis.__fbeDemo, s = b.select.bind(b);
      b.select = (t, ...r) => (['guias', 'novedades'].includes(t) ? Promise.reject(new TypeError('Failed to fetch')) : s(t, ...r));
    });
    await irASeccion(p, 'Semana');
    await enSemana.waitFor({ timeout: 8000 });
    await enSemana.getByRole('button', { name: /Repasar/ }).last().click();
    await tarjeta.waitFor();
    await hoja.locator('.apuntes-sin-red').waitFor({ timeout: 4000 }).catch(() => {});
    check(await hoja.locator('.apuntes-sin-red').count() === 1 && /Sin conexión: con lo guardado/.test(await hoja.locator('.apuntes-sin-red').textContent()), 'sin conexión, los apuntes salen con lo guardado y lo dicen arriba');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });

    // --- El coach escribe una pregunta ---
    await cambiarA('Pelayo');
    await irASeccion(p, 'Biblioteca');
    await p.getByRole('tab', { name: 'Guías' }).click();
    const zona = p.locator('.novedades-coach');
    await zona.waitFor();
    await zona.getByRole('button', { name: /Nueva/ }).click();
    const form = p.locator('.novedad-form');
    await form.waitFor();
    await form.getByRole('button', { name: 'Pregunta', exact: true }).click();
    check(await form.getByLabel('La pregunta').count() === 1 && await form.getByLabel(/^Opción \d$/).count() === 3 && await form.getByLabel(/Ejercicio/).count() === 1,
      'el coach puede escribir una «Pregunta»: la pregunta, tres opciones (hasta cuatro) y, si quiere, un ejercicio');
    await form.getByLabel('La pregunta').fill(PREGUNTA);
    await form.getByLabel('Opción 1', { exact: true }).fill('30 segundos');
    await form.getByLabel('Opción 2', { exact: true }).fill('De 2 a 3 minutos o más');
    await form.getByLabel('Opción 3', { exact: true }).fill('Lo mínimo posible');
    await form.getByLabel('La buena es la opción 2').check();
    check(await form.getByLabel(/^Por qué no es la opción/).count() === 2, 'las malas piden su «por qué no» (opcional); la buena, no');
    await form.getByLabel('Por qué no es la opción 1').fill('Con tan poco, rindes menos en la siguiente serie.');
    await form.getByLabel('La explicación').fill('Descansar lo suficiente deja hacer más repeticiones con el mismo peso.');
    await form.getByRole('button', { name: 'Guardar y publicar' }).click();
    await form.waitFor({ state: 'detached' });
    const fila = zona.locator('.novedad-fila', { hasText: PREGUNTA });
    await fila.waitFor();
    const nov = (await p.evaluate(() => globalThis.__fbeDemo.select('novedades', {}))).find((n) => n.titulo === PREGUNTA);
    check(/Pregunta/.test(await fila.textContent()) && nov?.tipo === 'pregunta' && nov.correcta === 1 && nov.opciones.length === 3 && nov.explicaciones[0].startsWith('Con tan poco') && nov.explicaciones[2] === '',
      'guardada como pregunta, con la buena y el porqué de la mala');

    // --- La atleta la contesta mal: por qué no ---
    await cambiarA('Ana López');
    const enHoy2 = p.locator('.apuntes-tarjeta:not(.repaso)');
    await enHoy2.scrollIntoViewIfNeeded();
    await enHoy2.getByRole('button', { name: 'Leer' }).click();
    await tarjeta.waitFor();
    let vista = false;
    for (let i = 0; i < 25 && !vista; i++) {
      vista = (await tarjeta.locator('h2').textContent().catch(() => '')) === PREGUNTA;
      if (!vista) {
        const recordar = hoja.locator('.apunte-recordar');
        if (await recordar.count()) { await recordar.click(); await hoja.getByRole('button', { name: /Bien/ }).click(); }
        else if (await hoja.locator('.apunte-destapar').count()) { await hoja.locator('.apunte-destapar').click(); await hoja.getByRole('button', { name: 'Lo sabía', exact: true }).click(); }
        else await hoja.getByRole('button', { name: /Otro apunte|Siguiente/ }).first().click();
        await p.waitForTimeout(380);
      }
    }
    check(vista && /Pregunta de tu coach/.test(await tarjeta.textContent()), 'la pregunta sale en los apuntes como «Pregunta de tu coach»');
    if (vista) {
      await tarjeta.getByRole('button', { name: '30 segundos' }).click();
      const porque = tarjeta.locator('.apunte-porque');
      await porque.waitFor({ timeout: 3000 }).catch(() => {});
      check(await porque.count() === 1 && /Por qué no «30 segundos»/.test(await porque.textContent()) && /rindes menos/.test(await porque.textContent()),
        'al fallarla, ve por qué no era esa (lo que escribió su coach)');
    }
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Apuntes que se quedan: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nApuntes que se quedan');
  try { await probarApuntesRepaso({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
