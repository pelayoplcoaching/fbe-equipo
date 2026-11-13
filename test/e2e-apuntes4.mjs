// Apuntes, tanda 4, en la demo y en un móvil simulado: el coach escribe un apunte suelto para un ejercicio y se lo manda
// a un atleta; el atleta sigue el curso de la semana, hace su examen, ve su racha y su medalla; y el coach ve «Lo que
// más se falla» (solo cuentas).
//   Suelta:  npm run build && node test/e2e-apuntes4.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarApuntes4 } = await import('./e2e-apuntes4.mjs'); await probarApuntes4({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';
import { GLOSARIO } from '../web/src/logica/apuntes.js';
import { lunesDe, sumarDias, fechaMadrid } from '../web/src/logica/fechas.js';

export async function probarApuntes4({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
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
  const entrar = async (quien) => { await p.getByRole('button', { name: new RegExp(quien) }).first().click(); await p.locator('nav.tabs').waitFor(); await fueraAvisos(); };
  const cambiarA = async (quien) => { await p.waitForTimeout(450); await p.evaluate(() => { localStorage.removeItem('fbe-demo-v2-sesion'); }); await p.goto(`${base}/?demo`); await entrar(quien); };
  const tabla = (t) => p.evaluate((n) => globalThis.__fbeDemo.select(n, {}), t);
  const estado = () => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('fbe-apuntes-')); return k ? JSON.parse(localStorage.getItem(k)) : { vistos: {} }; });
  const hoja = p.locator('.apuntes'), tarjeta = hoja.locator('article.apunte');
  const chip = () => tarjeta.locator('.apunte-etq .chip').textContent();
  const TITULO = 'Piernas activas en este ejercicio';
  const aGuias = async () => { await irASeccion(p, 'Biblioteca'); await p.getByRole('tab', { name: 'Guías' }).click(); await p.locator('.novedades-coach').waitFor(); };

  try {
    // --- El primer ejercicio de la sesión de hoy de Ana (para escribirle un apunte) ---
    await p.goto(`${base}/?demo`);
    await entrar('Ana López');
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    const textoEj = await p.locator('.ejercicio').first().textContent();
    const biblioteca = await tabla('ejercicios');
    const ejercicio = biblioteca.filter((e) => textoEj.includes(e.nombre)).sort((a, b) => b.nombre.length - a.nombre.length)[0];

    // --- El coach: un apunte suelto para ese ejercicio ---
    await cambiarA('Pelayo');
    await aGuias();
    const zona = p.locator('.novedades-coach');
    check(await p.locator('.fallados-coach').count() === 0, 'el coach, en Guías: sin nada fallado todavía, «Lo que más se falla» no sale');
    await zona.getByRole('button', { name: /Nueva/ }).click();
    const form = p.locator('.novedad-form');
    await form.waitFor();
    const tipos = form.locator('.novedad-tipo button');
    check(await tipos.count() === 2 && await tipos.nth(0).getAttribute('aria-pressed') === 'true' && await form.getByLabel(/Ejercicio/).count() === 0, 'al escribir, se elige qué es: «Novedad de la semana» (de entrada) o «Apunte suelto»');
    await tipos.nth(1).click();
    await form.getByLabel('Título').fill(TITULO);
    await form.getByLabel('Texto').fill('Aprieta el suelo con los pies durante toda la serie: el cuerpo, un bloque.');
    await form.getByLabel(/Ejercicio/).fill('Un ejercicio que no existe');
    await form.getByRole('button', { name: 'Guardar y publicar' }).click();
    await p.locator('.toast', { hasText: 'No encuentro ese ejercicio' }).waitFor();
    check(await form.count() === 1, 'el apunte suelto puede ser de un ejercicio de la biblioteca: si no lo encuentra, lo dice y no guarda');
    await form.getByLabel(/Ejercicio/).fill(ejercicio.nombre);
    await form.getByRole('button', { name: 'Guardar y publicar' }).click();
    await form.waitFor({ state: 'detached' });
    const fila = zona.locator('.novedad-fila', { hasText: TITULO });
    await fila.waitFor();
    const nov = (await tabla('novedades')).find((n) => n.titulo === TITULO);
    check(/Apunte suelto/.test(await fila.textContent()) && nov?.tipo === 'apunte' && nov.ejercicio_id === ejercicio.id && nov.publicada === true, `guardado como apunte suelto de «${ejercicio.nombre}»`);

    // --- Mandárselo a un atleta ---
    await fila.click();
    await form.waitFor();
    // (el nombre del ejercicio sale cuando llega la biblioteca: se espera a que llegue)
    for (let i = 0; i < 50 && (await form.getByLabel(/Ejercicio/).inputValue()) !== ejercicio.nombre; i++) await p.waitForTimeout(100);
    check(await form.getByLabel(/Ejercicio/).inputValue() === ejercicio.nombre && await tipos.nth(1).getAttribute('aria-pressed') === 'true', 'al abrirlo, su tipo y su ejercicio');
    const antes = (await tabla('comentarios')).length;
    await form.getByRole('button', { name: /Mandar a un atleta/ }).click();
    const mandar = p.locator('.mandar-apunte');
    await mandar.waitFor();
    check((await mandar.locator('blockquote').textContent()).startsWith(`Un apunte para ti: ${TITULO}`) && await mandar.getByRole('button', { name: /Ana López/ }).count() === 1, '«Mandar a un atleta»: el mensaje ya escrito y la lista de atletas');
    await mandar.getByRole('button', { name: /Ana López/ }).click();
    await p.locator('.toast', { hasText: 'Enviado a Ana' }).waitFor();
    const mensajes = await tabla('comentarios');
    check(mensajes.length === antes + 1 && mensajes.some((m) => m.autor === 'coach' && String(m.texto || '').startsWith(`Un apunte para ti: ${TITULO}`)), 'le llega por Mensajes, como un mensaje del coach');
    await p.keyboard.press('Escape');

    // --- Ana: el curso de la semana ---
    await cambiarA('Ana López');
    await irASeccion(p, 'Semana');
    const enSemana = p.locator('.apuntes-tarjeta.repaso');
    await enSemana.scrollIntoViewIfNeeded();
    check(await enSemana.getByRole('button', { name: 'Curso de la semana' }).count() === 1 && await enSemana.getByRole('button', { name: /Examen/ }).count() === 0, 'en Semana, «Curso de la semana»; el examen, cuando haya visto una docena de apuntes');
    await enSemana.getByRole('button', { name: 'Curso de la semana' }).click();
    const barra = p.locator('.apuntes-curso');
    await barra.waitFor();
    await tarjeta.waitFor();
    const curso1 = await barra.locator('strong').textContent(), lecciones = await barra.locator('.apuntes-curso-puntos i').count();
    // (una lección: si es una idea, se lee y «Siguiente lección»; si es un mito, se destapa y se contesta)
    const leer = async () => {
      if (await hoja.getByRole('button', { name: 'Siguiente lección' }).count()) await hoja.getByRole('button', { name: 'Siguiente lección' }).click();
      else { await tarjeta.locator('.apunte-destapar').click(); await hoja.getByRole('button', { name: 'Lo sabía', exact: true }).click(); }
      await p.waitForTimeout(250);
    };
    check(/^Lección 1 de \d+$/.test(await barra.locator('.apuntes-curso-t .peq').textContent()) && lecciones >= 2 && lecciones <= 7 && ['Idea clave', 'Mito'].includes(await chip()),
      `el curso de la semana: una guía, lección a lección («${curso1}», ${lecciones} lecciones)`);
    await leer();
    const hechas = await barra.locator('.apuntes-curso-puntos i.hecha').count();
    check(hechas >= 1 && hechas <= 2 && Object.keys((await estado()).vistos).length >= 1, 'cada lección leída se marca');
    await barra.getByRole('button', { name: 'Cambiar de curso' }).click();
    const otros = barra.locator('.apuntes-curso-otro');
    const n = await otros.count();
    const otro = otros.filter({ hasNotText: curso1 }).first();
    const nombreOtro = (await otro.textContent()).split(' · ')[0];
    await otro.click();
    await p.waitForTimeout(300);
    check(n >= 2 && await barra.locator('strong').textContent() === nombreOtro && /^Lección 1 de/.test(await barra.locator('.apuntes-curso-t .peq').textContent()) && typeof (await estado()).curso?.clave === 'string',
      `se puede cambiar de curso (${n} cursos): ahora, «${nombreOtro}», y se recuerda`);
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });

    // --- La racha, la medalla y el examen ---
    const lunes = lunesDe(fechaMadrid());
    await p.evaluate(([d1, d2, ids]) => {
      const k = Object.keys(localStorage).find((x) => x.startsWith('fbe-apuntes-')); const e = JSON.parse(localStorage.getItem(k));
      for (const id of ids) e.vistos[id] ||= { n: 1, t: d1 };
      e.dias = [...(e.dias || []), d1, d2];
      localStorage.setItem(k, JSON.stringify(e));
    }, [sumarDias(lunes, -3), sumarDias(lunes, -10), ['g:rir', 'g:rpe', 'g:tempo', 'g:1rm', 'g:backoff', 'g:descarga', 'g:superserie', 'g:hipertrofia', 'g:volumen']]);
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    await irASeccion(p, 'Semana');
    await enSemana.scrollIntoViewIfNeeded();
    const texto = await enSemana.textContent();
    check(/3 semanas seguidas aprendiendo/.test(texto) && /Curioso/.test(texto) && /faltan \d+ para «Aplicado»/.test(texto), 'la racha de aprendizaje (tres semanas seguidas) y la medalla: «Curioso», y cuánto falta para la siguiente');
    await enSemana.getByRole('button', { name: 'Examen' }).click();
    await tarjeta.waitFor();
    let aciertos = 0, falladas = 0, total = 0, fallada = null;
    for (let i = 0; i < 12; i++) {
      if (!(await tarjeta.count())) break;
      total += 1;
      const titulo = await tarjeta.locator('h2').textContent(), opciones = tarjeta.locator('.apunte-opcion');
      if (i === 0) check(/^Pregunta 1 de 8$/.test(await tarjeta.locator('.apunte-de').textContent()) && await chip() === 'Examen' && await opciones.count() >= 2, `el examen: ocho preguntas con lo visto («${titulo.slice(0, 50)}»)`);
      const termino = /^¿Qué es «(.+)»\?$/.exec(titulo)?.[1];
      const buena = termino ? GLOSARIO.find(([t]) => t === termino)?.[1] : null;
      // (la primera del glosario se falla a propósito; las demás del glosario, bien; en «¿Verdad o mito?», siempre «Verdad»)
      if (buena && !fallada) { fallada = termino; await opciones.filter({ hasNotText: buena }).first().click(); }
      else if (buena) await opciones.filter({ hasText: buena }).first().click();
      else await opciones.first().click();
      await p.waitForTimeout(150);
      if (await tarjeta.locator('.apunte-opcion.mala').count()) falladas += 1; else aciertos += 1;
      await hoja.getByRole('button', { name: /Siguiente|Ver la nota/ }).click();
      await p.waitForTimeout(250);
    }
    const nota = p.locator('.examen-nota');
    await nota.waitFor();
    const ex = (await estado()).examenes || [];
    check(total === 8 && fallada && falladas >= 1 && (await nota.locator('h2').textContent()).startsWith(`${aciertos} de 8`) && ex.length === 1 && ex[0].aciertos === aciertos && ex[0].total === 8,
      `al acabar, la nota (${aciertos} de 8) y queda apuntada; lo fallado vuelve a salir`);
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    await p.waitForTimeout(300);
    check(new RegExp(`Último examen: ${aciertos}/8`).test(await enSemana.textContent()), 'y en la tarjeta, la nota del último examen');
    const slug = fallada.toLowerCase().replace(/[^a-z0-9]/g, '');
    const subidos = await tabla('apuntes_vistos');
    check(subidos.some((x) => x.apunte === `g:${slug}` && x.sabia === false), 'lo que no sabía sube a la base (también el glosario)');

    // --- En el descanso de ese ejercicio: el apunte de su coach ---
    await irASeccion(p, 'Hoy');
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('.hero-dia .btn-hero').click();
    await p.locator('.ejercicio').first().waitFor();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const primero = p.locator('.ejercicio').first();
    await primero.getByLabel('Kilos de la serie 1').fill('30');
    await primero.getByLabel('Repeticiones de la serie 1').fill('8');
    await p.keyboard.press('Escape');
    await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    const reloj = p.locator('.temporizador');
    await reloj.waitFor();
    await reloj.getByRole('button', { name: 'Aprender' }).click();
    await tarjeta.waitFor();
    let visto = false;
    for (let i = 0; i < 6 && !visto; i++) { if (await chip() === 'De tu coach') { visto = true; break; } await hoja.getByRole('button', { name: /Otro apunte/ }).click(); await p.waitForTimeout(220); }
    check(visto && await tarjeta.locator('h2').textContent() === TITULO && /Aprieta el suelo/.test(await tarjeta.locator('.apunte-texto').textContent()), 'en el descanso de ese ejercicio sale el apunte de su coach: «De tu coach»');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();

    // --- El coach: lo que más se falla ---
    // (solo sale de dos atletas en adelante: otro atleta de la demo tampoco lo sabía)
    await p.waitForTimeout(600);
    await p.evaluate((ap) => {
      const db = JSON.parse(localStorage.getItem('fbe-demo-v2'));
      const otro = db.atletas.find((x) => /Carlos/.test(x.nombre));
      db.apuntes_vistos.push({ atleta_id: otro.id, apunte: ap, veces: 1, ultimo: new Date().toISOString().slice(0, 10), sabia: false });
      localStorage.setItem('fbe-demo-v2', JSON.stringify(db));
    }, `g:${slug}`);
    await cambiarA('Pelayo');
    await aGuias();
    const fallados = p.locator('.fallados-coach');
    await fallados.waitFor({ timeout: 8000 });
    const filaF = fallados.locator('.fallado-fila', { hasText: fallada });
    check(await filaF.count() === 1 && /Glosario · 2 atletas no lo sabían/.test(await filaF.textContent()) && !/Ana|Carlos/.test(await fallados.textContent()), `«Lo que más se falla»: «${fallada}», 2 atletas no lo sabían (sin decir quiénes)`);
    const antes2 = (await tabla('comentarios')).length;
    await filaF.getByRole('button', { name: 'Mandar a…' }).click();
    await p.locator('.mandar-apunte').getByRole('button', { name: /Ana López/ }).click();
    await p.locator('.toast', { hasText: 'Enviado a Ana' }).waitFor();
    check((await tabla('comentarios')).length === antes2 + 1, 'y desde ahí también se le puede mandar a un atleta');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'todo cabe a 390 px');
  } catch (e) {
    check(false, `Apuntes, tanda 4: ${e.message.split('\n')[0]}`);
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
  console.log('\nApuntes, tanda 4: el curso, el examen y lo del coach');
  try { await probarApuntes4({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
