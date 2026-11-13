// «Apuntes»: camino y progreso (tanda C), en la demo y en un móvil simulado: la prueba de nivel al empezar, el objetivo
// diario (el anillo que se cierra y se celebra), «Tu progreso» (objetivo y racha, temas, ruta «Fundamentos FBE», tu mes)
// y, con la ruta hecha, el examen final y el certificado.
//   Suelta:  npm run build && node test/e2e-apuntes-t3.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarApuntesCamino } = await import('./e2e-apuntes-t3.mjs'); await probarApuntesCamino({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';
import { apuntesDeGuias, apuntesDeGlosario, GLOSARIO } from '../web/src/logica/apuntes.js';
import { rutaFundamentos } from '../web/src/logica/apuntes-camino.js';
import { GUIAS_DEMO } from '../web/src/datos/semilla-guias.js';
import { fechaMadrid } from '../web/src/logica/fechas.js';

export async function probarApuntesCamino({ navegador, check, base = 'http://localhost:4174' }) {
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
  const estado = () => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^fbe-apuntes-[0-9a-f-]{36}$/.test(x)); return k ? JSON.parse(localStorage.getItem(k)) : { vistos: {} }; });
  const hoja = p.locator('.apuntes'), tarjeta = hoja.locator('article.apunte');
  const enSemana = p.locator('.apuntes-tarjeta.repaso');
  const hoy = fechaMadrid();
  const todos = [...apuntesDeGuias(GUIAS_DEMO), ...apuntesDeGlosario()];
  // La buena de una pregunta de examen (de lo que hay en las guías y el glosario)
  const buena = (titulo, opciones) => {
    const q = titulo.match(/^¿Qué es «(.+)»\?$/);
    if (q) { const def = GLOSARIO.find(([t]) => t === q[1])?.[1]; return opciones.indexOf(def); }
    const vm = titulo.match(/^¿Verdad o mito\? (.+)$/);
    if (vm) {
      const t = vm[1];
      const a = todos.find((x) => x.tipo === 'mito' && x.titulo === t) || todos.find((x) => x.tipo === 'idea' && `«${x.titulo.replace(/[.:]$/, '')}»` === t);
      return a ? opciones.indexOf(a.tipo === 'mito' ? 'Mito' : 'Verdad') : 0;
    }
    return 0;
  };
  const contestar = async (bien = true) => {
    const titulo = await tarjeta.locator('h2').textContent();
    const opciones = await tarjeta.locator('.apunte-opcion').allTextContents();
    let i = bien ? buena(titulo, opciones) : 0;
    if (i < 0) i = 0;
    await tarjeta.locator('.apunte-opcion').nth(i).click();
    await hoja.locator('.apuntes-pie .btn-primario').click();
    await p.waitForTimeout(350);
  };

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^fbe-apuntes-/.test(k)) localStorage.removeItem(k); });
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();

    // --- La prueba de nivel, al empezar ---
    await irASeccion(p, 'Semana');
    await enSemana.waitFor({ timeout: 8000 });
    await enSemana.scrollIntoViewIfNeeded();
    check(await enSemana.getByRole('button', { name: 'Prueba de nivel' }).count() === 1 && await enSemana.getByRole('button', { name: 'Tu progreso' }).count() === 1, 'al empezar, en Semana: «Prueba de nivel» y «Tu progreso»');
    await enSemana.getByRole('button', { name: 'Prueba de nivel' }).click();
    await tarjeta.waitFor();
    check(/Prueba de nivel/.test(await hoja.locator('.apuntes-titulo').textContent()) && /Pregunta 1 de \d/.test(await tarjeta.locator('.apunte-de').textContent()), 'la prueba: preguntas una a una («Pregunta 1 de …»)');
    for (let i = 0; i < 9 && await tarjeta.locator('.apunte-opcion').count(); i++) await contestar(true);
    const nota = hoja.locator('.examen-nota');
    await nota.waitFor({ timeout: 4000 });
    const e1 = await estado();
    check(/Prueba de nivel/.test(await nota.textContent()) && e1.prueba?.total >= 4 && e1.prueba.aciertos === e1.prueba.total && e1.prueba.saltados.length >= 1 && /ya lo sabes: te lo salto/.test(await nota.textContent()),
      `acertándolo todo: «${(await nota.locator('.apunte-texto').textContent()).slice(0, 80)}»`);
    check(Object.values(e1.vistos).some((v) => v.c === 2), 'lo básico de esos temas queda visto, para repasarlo en una semana');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    check(await enSemana.getByRole('button', { name: 'Prueba de nivel' }).count() === 0, 'hecha, ya no se ofrece');

    // --- El objetivo del día: tres apuntes cierran el anillo ---
    await enSemana.getByRole('button', { name: 'Tu progreso' }).click();
    const prog = p.locator('.hoja-progreso-apuntes');
    await prog.waitFor();
    check(await prog.locator('.anillo-meta').count() >= 1 && await prog.getByRole('button', { name: '3 al día' }).getAttribute('aria-pressed') === 'true', '«Tu progreso»: el anillo del día y el objetivo (3 al día, de entrada)');
    await prog.getByRole('button', { name: '1 al día' }).click();
    check((await estado()).meta === 1, 'se cambia el objetivo (1, 3 o 5)');
    await prog.getByRole('button', { name: '3 al día' }).click();
    const temas = prog.locator('.prog-tema');
    check(await temas.count() >= 2 && /Programación/.test(await prog.locator('.prog-temas').textContent()) && await prog.locator('.prog-barra[role=img]').count() === await temas.count(),
      `tus temas, cada uno con su barra y su nivel (${(await prog.locator('.prog-tema-cab').allTextContents()).join(' · ')})`);
    check(await prog.locator('.prog-modulos li').count() >= 1 && await prog.getByRole('button', { name: /^Seguir con «/ }).count() === 1, 'la ruta «Fundamentos FBE»: sus módulos y «Seguir con…»');
    check(await prog.locator('.prog-mes-cifras > span').count() === 4, 'tu mes en apuntes: sus cifras');
    const modulo = (await prog.getByRole('button', { name: /^Seguir con «/ }).textContent()).match(/«(.+)»/)[1];
    await prog.getByRole('button', { name: /^Seguir con «/ }).click();
    await tarjeta.waitFor();
    check(/Curso de la semana/.test(await hoja.locator('.apuntes-titulo').textContent()) && (await hoja.locator('.apuntes-curso-t strong').textContent()) === modulo, `«Seguir con…» abre ese módulo como curso («${modulo}»)`);
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });

    await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^fbe-apuntes-[0-9a-f-]{36}$/.test(x)); const e = JSON.parse(localStorage.getItem(k)); delete e.diario; localStorage.setItem(k, JSON.stringify(e)); });
    await irASeccion(p, 'Hoy');
    const enHoy = p.locator('.apuntes-tarjeta:not(.repaso)');
    await enHoy.scrollIntoViewIfNeeded();
    await enHoy.getByRole('button', { name: 'Leer' }).click();
    await tarjeta.waitFor();
    check(await hoja.locator('.apuntes-cab .anillo-meta').getAttribute('aria-label') === 'Hoy, 0 de 3 apuntes', 'arriba, el anillo del día (0 de 3)');
    for (let i = 0; i < 3; i++) {
      if (await hoja.locator('.apunte-recordar').count()) { await hoja.locator('.apunte-recordar').click(); await hoja.getByRole('button', { name: /^Bien/ }).click(); }
      else if (await tarjeta.locator('.apunte-destapar').count()) { await tarjeta.locator('.apunte-destapar').click(); await hoja.getByRole('button', { name: 'Lo sabía', exact: true }).click(); }
      else await hoja.locator('.apuntes-pie .btn').last().click();
      await p.waitForTimeout(380);
    }
    await p.locator('.toast', { hasText: '¡Objetivo de hoy cumplido!' }).waitFor({ timeout: 4000 }).catch(() => {});
    check(await p.locator('.toast', { hasText: '¡Objetivo de hoy cumplido!' }).count() >= 1 && await hoja.locator('.apuntes-cab .anillo-meta.hecho').count() === 1, 'con el tercero, el anillo se cierra y se celebra («¡Objetivo de hoy cumplido!»)');
    const dia = (await estado()).diario?.[hoy];
    check(dia?.n === 3 && dia.xp >= 15, `y cuenta, con sus puntos (${JSON.stringify(dia)})`);
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    check(await enHoy.locator('.anillo-meta.hecho').count() === 1, 'en Hoy, la tarjeta lleva el anillo cerrado');

    // --- La ruta hecha: el examen final y el certificado ---
    const ruta = rutaFundamentos(todos);
    await p.evaluate(([ids, d]) => {
      const k = Object.keys(localStorage).find((x) => /^fbe-apuntes-[0-9a-f-]{36}$/.test(x)); const e = JSON.parse(localStorage.getItem(k));
      for (const id of ids) e.vistos[id] ||= { n: 1, t: d };
      localStorage.setItem(k, JSON.stringify(e));
    }, [ruta.flatMap((m) => m.lecciones), hoy]);
    await irASeccion(p, 'Semana');
    await enSemana.waitFor({ timeout: 8000 });
    await enSemana.getByRole('button', { name: 'Tu progreso' }).click();
    await prog.waitFor();
    check(await prog.getByRole('button', { name: 'Hacer el examen final' }).count() === 1 && /80 %/.test(await prog.locator('.prog-ruta').textContent()), 'con todos los módulos, «Hacer el examen final» (con el 80 %, el certificado)');
    await prog.getByRole('button', { name: 'Hacer el examen final' }).click();
    await tarjeta.waitFor();
    check(/Examen final/.test(await hoja.locator('.apuntes-titulo').textContent()), 'el examen final');
    for (let i = 0; i < 11 && await tarjeta.locator('.apunte-opcion').count(); i++) await contestar(true);
    const cert = hoja.locator('.certificado');
    await cert.waitFor({ timeout: 4000 }).catch(() => {});
    check(await cert.count() === 1 && /Fundamentos FBE/.test(await cert.textContent()) && /Ana/.test(await cert.textContent()) && await cert.getByRole('button', { name: 'Compartir' }).count() === 1,
      'aprobado: el certificado, con su nombre, la fecha y la nota, para compartir');
    check((await estado()).certificado?.aciertos >= 1, 'y queda guardado');
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    await enSemana.getByRole('button', { name: 'Tu progreso' }).click();
    await prog.waitFor();
    check(await prog.locator('.certificado').count() === 1 && await prog.getByRole('button', { name: 'Hacer el examen final' }).count() === 0, 'en «Tu progreso», el certificado en su ruta');
    await p.keyboard.press('Escape');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Apuntes, camino: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nApuntes, camino y progreso');
  try { await probarApuntesCamino({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
