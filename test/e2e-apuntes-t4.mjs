// «Apuntes» con los demás y en otros formatos (tanda D), en la demo y en un móvil simulado: el coach graba (sube) una
// audio-píldora en su novedad y ve «El equipo en apuntes» (solo cuentas); la atleta la escucha, la ve como historia a
// pantalla completa, escribe su nota y subraya, suma en la liga de la semana y reta a un duelo de cinco preguntas.
//   Suelta:  npm run build && node test/e2e-apuntes-t4.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarApuntesSocial } = await import('./e2e-apuntes-t4.mjs'); await probarApuntesSocial({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';
import { GLOSARIO } from '../web/src/logica/apuntes.js';
import { VERSION_COMUNIDAD } from '../web/src/datos/api.js';
import { VERSION_NORMAS } from '../web/src/datos/normas-comunidad.js';

// Un segundo de silencio en WAV (para la audio-píldora)
function wav(segundos = 2) {
  const tasa = 8000, n = tasa * segundos, b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(tasa, 24); b.writeUInt32LE(tasa, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44);
  return b;
}

export async function probarApuntesSocial({ navegador, check, base = 'http://localhost:4174' }) {
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
  const TITULO = 'Descansa lo que pide la serie';

  try {
    // --- El coach: una novedad con su audio-píldora ---
    await p.goto(`${base}/?demo`);
    await entrar('Pelayo');
    await irASeccion(p, 'Biblioteca');
    await p.getByRole('tab', { name: 'Guías' }).click();
    const zona = p.locator('.novedades-coach');
    await zona.waitFor();
    await zona.getByRole('button', { name: /Nueva/ }).click();
    const form = p.locator('.novedad-form');
    await form.waitFor();
    check(await form.locator('.audio-coach').count() === 1 && await form.locator('.audio-subir input[type=file]').count() === 1, 'en el editor de la novedad, «Audio-píldora» (grabar o subir)');
    await form.getByLabel('Título').fill(TITULO);
    await form.getByLabel('Texto').fill('Entre series pesadas, de dos a tres minutos rinden más que uno. En las ligeras basta con menos. Si dudas, descansa un poco más.');
    await form.locator('.audio-subir input[type=file]').setInputFiles({ name: 'pildora.wav', mimeType: 'audio/wav', buffer: wav(2) });
    await form.locator('.audio-coach audio').waitFor({ timeout: 4000 });
    check(await form.locator('.audio-coach audio').count() === 1, 'subido, se oye antes de guardar');
    await form.getByRole('button', { name: 'Guardar y publicar' }).click();
    await form.waitFor({ state: 'detached' });
    const nov = (await p.evaluate(() => globalThis.__fbeDemo.select('novedades', {}))).find((n) => n.titulo === TITULO);
    check(/^audio\/[0-9a-f-]{36}\.wav$/.test(nov?.audio_ruta || '') && nov.audio_segundos === 2, `guardada con su audio (${nov?.audio_ruta}, ${nov?.audio_segundos} s)`);

    // --- La atleta: el audio, la historia, su nota y sus subrayados ---
    await cambiarA('Ana López');
    // (Ana está en la comunidad del equipo: la liga y los duelos son de allí)
    await p.evaluate(([v, n]) => globalThis.__fbeDemo.rpc('comunidad_unirme', { p_nombre: 'Ana L.', p_version: v, p_normas: n }), [VERSION_COMUNIDAD, VERSION_NORMAS]);
    const enHoy = p.locator('.apuntes-tarjeta:not(.repaso)');
    await enHoy.scrollIntoViewIfNeeded();
    check(/Descansa lo que pide/.test(await enHoy.textContent()), 'en Hoy, su novedad de la semana');
    await enHoy.getByRole('button', { name: 'Leer' }).click();
    await tarjeta.waitFor();
    check((await tarjeta.locator('h2').textContent()) === TITULO && await tarjeta.locator('.audio-pildora').count() === 1, 'la novedad lleva el audio de su coach');
    await tarjeta.getByRole('button', { name: 'Escuchar el audio de tu coach' }).click();
    await tarjeta.locator('.audio-pildora audio').waitFor({ state: 'attached', timeout: 4000 });
    check(/^blob:/.test(await tarjeta.locator('.audio-pildora audio').getAttribute('src')), 'al tocarlo, se pide y suena (enlace firmado; aquí, de la demo)');
    await tarjeta.getByRole('button', { name: '1×' }).click();
    check(await tarjeta.locator('.audio-velocidad').getAttribute('aria-pressed') === 'true' && /1,5×/.test(await tarjeta.locator('.audio-velocidad').textContent()), 'a 1,5×');
    await tarjeta.getByRole('button', { name: 'Verla como historia' }).click();
    const hist = p.locator('.ap-historia');
    await hist.waitFor();
    const nDiap = await hist.locator('.ap-historia-barras span').count();
    check(nDiap >= 3 && (await hist.locator('h2').textContent()) === TITULO && await hist.getAttribute('aria-modal') === 'true', `como historia: ${nDiap} diapositivas a pantalla completa, con su barra cada una`);
    await hist.getByRole('button', { name: 'Siguiente' }).click();
    check(await hist.locator('.ap-historia-barras span.vista').count() === 1 && await hist.locator('.ap-historia-cuerpo p').count() === 1, 'tocar a la derecha pasa');
    await hist.getByRole('button', { name: 'Anterior' }).click();
    check(await hist.locator('.ap-historia-barras span.vista').count() === 0, 'a la izquierda, vuelve');
    for (let i = 0; i < nDiap; i++) { if (!(await hist.count())) break; await hist.locator('.ap-historia-zona.alante').click(); await p.waitForTimeout(120); }
    check(await hist.count() === 0, 'tras la última, se cierra sola');
    // su nota y sus subrayados
    await tarjeta.getByRole('button', { name: 'Tu nota' }).click();
    await tarjeta.getByLabel('Tu nota').fill('Pesadas: 3 minutos y sin mirar el móvil');
    await tarjeta.getByRole('button', { name: 'Guardar nota' }).click();
    check(/Tu nota: Pesadas: 3 minutos/.test(await tarjeta.locator('.apunte-tu-nota').textContent()), 'escribe su nota y queda en el apunte');
    await tarjeta.getByRole('button', { name: 'Subrayar' }).click();
    await tarjeta.locator('.apunte-frase').first().click();
    await tarjeta.getByRole('button', { name: 'Hecho' }).click();
    check(await tarjeta.locator('mark.apunte-subrayado').count() === 1, 'subraya una frase (queda marcada)');
    const e1 = await estado();
    const id = Object.keys(e1.notas || {})[0];
    check(id && e1.subrayados?.[id]?.[0] === 0 && e1.guardados?.includes(id), 'la nota y el subrayado, guardados (y el apunte, en «Guardados»)');
    for (let i = 0; i < 3; i++) {
      if (await hoja.locator('.apunte-recordar').count()) { await hoja.locator('.apunte-recordar').click(); await hoja.getByRole('button', { name: /^Bien/ }).click(); }
      else if (await tarjeta.locator('.apunte-destapar').count()) { await tarjeta.locator('.apunte-destapar').click(); await hoja.getByRole('button', { name: 'Lo sabía', exact: true }).click(); }
      else await hoja.locator('.apuntes-pie .btn').last().click();
      await p.waitForTimeout(380);
    }
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });

    // --- La liga y un duelo ---
    await p.waitForTimeout(600);
    await irASeccion(p, 'Semana');
    const enSemana = p.locator('.apuntes-tarjeta.repaso');
    await enSemana.waitFor({ timeout: 8000 });
    check(await enSemana.getByRole('button', { name: /^Guardados \(/ }).count() === 1, 'en Semana, sus «Guardados»');
    await enSemana.getByRole('button', { name: 'Tu progreso' }).click();
    const prog = p.locator('.hoja-progreso-apuntes');
    await prog.waitFor();
    const liga = prog.locator('.prog-liga');
    await liga.waitFor({ timeout: 5000 }).catch(() => {});
    check(await liga.count() === 1 && await liga.locator('li.yo').count() === 1 && /\(tú\)/.test(await liga.locator('li.yo').textContent()), `la liga de la semana, con ella dentro (${(await liga.locator('li.yo').textContent().catch(() => '')).replace(/\s+/g, ' ')})`);
    const filas = await liga.locator('li').count();
    await prog.getByRole('button', { name: 'Retar a alguien' }).click();
    const gente = prog.locator('.duelo-gente .chip');
    check(await gente.count() >= 1, `se puede retar a la gente de la comunidad (${await gente.count()})`);
    const rival = (await gente.first().textContent()).trim();
    await gente.first().click();
    await tarjeta.waitFor();
    check((await hoja.locator('.apuntes-titulo').textContent()).includes(`Duelo con ${rival}`) && /Pregunta 1 de 5/.test(await tarjeta.locator('.apunte-de').textContent()), `el duelo con ${rival}: cinco preguntas`);
    let bien = 0;
    for (let i = 0; i < 5; i++) {
      const t = (await tarjeta.locator('h2').textContent()).match(/«(.+)»/)[1];
      const def = GLOSARIO.find(([x]) => x === t)?.[1];
      const ops = await tarjeta.locator('.apunte-opcion').allTextContents();
      const k = i < 4 ? Math.max(0, ops.indexOf(def)) : ops.findIndex((o) => o !== def);
      if (ops[k] === def) bien += 1;
      await tarjeta.locator('.apunte-opcion').nth(k).click();
      await hoja.locator('.apuntes-pie .btn-primario').click();
      await p.waitForTimeout(300);
    }
    const nota = hoja.locator('.examen-nota');
    await nota.waitFor({ timeout: 4000 });
    check(/Duelo/.test(await nota.textContent()) && new RegExp(`${bien} de 5`).test(await nota.textContent()) && new RegExp(`Cuando conteste ${rival}`).test(await nota.textContent()), `al acabar, sus aciertos (${bien} de 5) y que falta el rival`);
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    await enSemana.getByRole('button', { name: 'Tu progreso' }).click();
    await prog.waitFor();
    await prog.locator('.duelo-fila').first().waitFor({ timeout: 5000 }).catch(() => {});
    check(new RegExp(`Esperando a ${rival} \\(tú, ${bien} de 5\\)`).test(await prog.locator('.prog-duelos').textContent()), 'en «Tu progreso», el duelo esperando al rival');
    check(filas >= 1 && await prog.getByRole('button', { name: 'Retar a alguien' }).count() === 1, 'y se puede retar a otro');
    await p.keyboard.press('Escape');

    // --- El coach: el equipo en apuntes ---
    await cambiarA('Pelayo');
    await irASeccion(p, 'Biblioteca');
    await p.getByRole('tab', { name: 'Guías' }).click();
    const eq = p.locator('.equipo-apuntes');
    await eq.waitFor({ timeout: 6000 }).catch(() => {});
    check(await eq.count() === 1 && await eq.locator('.equipo-semana').count() === 6 && /nunca quién/.test(await eq.textContent()), '«El equipo en apuntes»: quién aprende cada semana (seis), en cuentas');
    check(!/Ana/.test(await eq.textContent()), 'sin nombres');
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Apuntes con los demás: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nApuntes con los demás');
  try { await probarApuntesSocial({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
