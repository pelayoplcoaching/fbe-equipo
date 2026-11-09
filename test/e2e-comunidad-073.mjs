// v0.73: la comunidad, quinta tanda (migración 045), en la demo, a tamaño de móvil. Lo llama e2e.test.mjs.
//   · el aniversario: Lucía (su alta, hoy hace 1 mes; se simula en la demo) ve su tarjeta en Hoy y en Equipo, y en el muro sale
//     «Lucía F. cumple 1 mes en FBE 🎉»;
//   · un hito del equipo (10 retos conseguidos: se simulan en la demo) se celebra una vez y se comparte en el muro;
//   · «<Mes> en el equipo» y «Tu <mes>», con «Compartir» (la imagen de siempre);
//   · una reacción nueva (❤️) y una pegatina como comentario;
//   · un momento de 24 h (y que uno caducado ya no sale: se simula en la demo);
//   · 360 px en oscuro, sin fallos de accesibilidad.
import { createRequire } from 'node:module';
import { irASeccion } from './secciones.mjs';
import { readFileSync } from 'node:fs';
import { sumarMesesFecha, aniversarioDe, mesEquipoDe, tituloMesEquipo, textoAniversario } from '../web/src/logica/celebracion.js';
import { fechaMadrid, sumarDias } from '../web/src/logica/fechas.js';
import { nombreMes } from '../web/src/logica/mes.js';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const PNG = readFileSync(new URL('../web/iconos/icono-180.png', import.meta.url));

export async function probarComunidad073({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  // (v0.76) el navegador en hora de Madrid, como la prueba (fechaMadrid): en CI (UTC), de 0:00 a 1:00 en Madrid la app aún
  // estaba en el día anterior y el aniversario de «hoy» no salía
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, acceptDownloads: true });
  // «<Mes> en el equipo» sale del 1 al 7: fuera de esos días, el reloj del navegador va al día 3 del mes que viene (y sigue corriendo)
  const ahora = new Date();
  let hoy = fechaMadrid(ahora);
  if (!mesEquipoDe(hoy)) {
    const [a, m] = hoy.split('-').map(Number);
    const dia3 = new Date(Date.UTC(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 3, 9, 0, 0));
    await ctx.clock.install({ time: dia3 });
    hoy = fechaMadrid(dia3);
  }
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const sinNombre = await p.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const nombre = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
        const etiqueta = el.id && document.querySelector(`label[for="${el.id}"]`);
        return !nombre && !etiqueta && !el.closest('label');
      }).map((el) => el.outerHTML.slice(0, 90)));
    if (sinNombre.length) errores.push(`${paso}: controles sin nombre accesible: ${sinNombre.join(' | ')}`);
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ]));
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
  }
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Seguir', 'Entendido', 'Vale', 'Cerrar', 'Ahora no']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { hecho = await b.click({ timeout: 4000 }).then(() => true, () => false); break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const entrarComo = async (nombre) => {
    if (!(await p.getByRole('heading', { name: 'Entra en tu cuenta' }).isVisible().catch(() => false))) {
      await p.waitForTimeout(500);
      await p.evaluate(() => { localStorage.removeItem('fbe-demo-v2-sesion'); });
      await p.goto(`${base}/?demo`);
    }
    await p.getByRole('button', { name: new RegExp(nombre) }).first().click();
    const cod = p.getByLabel('Código', { exact: true });
    await Promise.race([cod.waitFor({ timeout: 8000 }).catch(() => {}), p.locator('nav.tabs').waitFor()]);
    if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(800);
    await cerrarDialogos();
  };
  const irAEquipo = async () => {
    await irASeccion(p, 'Equipo');
    await p.locator('.post').first().waitFor();
    await p.waitForTimeout(800);
  };
  const abrirEquipo = async () => { await irAEquipo(); await cerrarDialogos(); };
  const recargar = async () => {
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(600);
    await cerrarDialogos();
  };
  // Cambiar la demo guardada en este navegador (se espera a que se guarde: 150 ms después de cada cambio)
  const enLaDemo = async (fn, arg) => { await p.waitForTimeout(500); await p.evaluate(fn, arg); };
  const toast = (texto) => p.locator('.toast', { hasText: texto }).first().waitFor();
  const post = (texto) => p.locator('article.post', { hasText: texto });
  // El alta de Lucía: hoy hace 1 mes (los días que no lo permiten, 1 año)
  const alta = [1, 12, 24].map((n) => sumarMesesFecha(hoy, -n)).find((a) => aniversarioDe(a, hoy));
  const meses = aniversarioDe(alta, hoy).meses;
  const MES = mesEquipoDe(hoy);

  try {
    await p.goto(`${base}/?demo`);
    await entrarComo('Lucía');
    // (simulado en la demo: el alta de Lucía, y ocho retos cortos ya terminados que Rubén y Carlos han conseguido: con los dos de
    // la demo, el equipo llega a 10 retos conseguidos)
    await enLaDemo(({ alta, desde, hasta }) => {
      const db = JSON.parse(localStorage.getItem('fbe-demo-v2'));
      db.atletas.find((a) => a.nombre === 'Lucía Ferrer').fecha_alta = alta;
      for (let i = 1; i <= 8; i++) {
        db.comunidad_retos.push({ id: crypto.randomUUID(), titulo: `Minirreto ${i}`, descripcion: null, desde, hasta, objetivo: 1, modo: 'individual', medida: 'sesiones', equipos: null, creado_en: new Date().toISOString() });
      }
      localStorage.setItem('fbe-demo-v2', JSON.stringify(db));
    }, { alta, desde: sumarDias(hoy, -20), hasta: sumarDias(hoy, -1) });
    await recargar();
    // ---------------- El aniversario en Hoy
    const tarjetaHoy = p.locator('section.aniversario');
    await tarjetaHoy.waitFor();
    check((await tarjetaHoy.textContent()).includes(`¡Hoy hace ${textoAniversario(meses)} que entrenas con FBE!`), `en Hoy, «¡Hoy hace ${textoAniversario(meses)} que entrenas con FBE!»`);
    await revisar('aniversario-hoy-073');
    // ---------------- Equipo: primero, la celebración del hito
    await irAEquipo();
    const hojaHito = p.getByRole('dialog', { name: '¡Hito del equipo!' });
    await hojaHito.waitFor();
    check(/10 retos conseguidos/.test(await hojaHito.textContent()), 'al entrar en Equipo, la celebración del hito: «10 retos conseguidos»');
    await revisar('hito-073');
    await hojaHito.getByRole('button', { name: 'Compartir en el muro' }).click();
    await toast('Compartido en el muro');
    await post('¡10 retos conseguidos entre todo el equipo! 🎉').waitFor();
    check(true, '«Compartir en el muro» publica el hito');
    await p.locator('.tab', { hasText: 'Hoy' }).first().click();
    await p.waitForTimeout(400);
    await irAEquipo();
    check(!(await p.getByRole('dialog', { name: '¡Hito del equipo!' }).isVisible().catch(() => false)), 'y no se vuelve a celebrar');
    await cerrarDialogos();
    // ---------------- El aniversario en Equipo y en el muro
    const deLucia = post(`Lucía F. cumple ${textoAniversario(meses)} en FBE 🎉`);
    await deLucia.waitFor();
    check(await p.locator('section.aniversario').count() === 1, `arriba de Equipo, su tarjeta; en el muro, «Lucía F. cumple ${textoAniversario(meses)} en FBE 🎉»`);
    // ---------------- «<Mes> en el equipo»
    const mesEq = p.locator('section.mes-equipo', { hasText: tituloMesEquipo(MES.mes) });
    await mesEq.waitFor();
    const mio = p.locator('section.mes-mio');
    check(/sesiones?/.test(await mesEq.textContent()) && /racha más larga|semanas? completas?/.test(await mesEq.textContent()) && (await mio.textContent()).includes(`Tu ${nombreMes(MES.mes)}`)
      && /ánimos? recibidos?/.test(await mio.textContent()), `«${tituloMesEquipo(MES.mes)}» (los recuentos del equipo) y «Tu ${nombreMes(MES.mes)}» (solo para ella)`);
    await mesEq.getByRole('button', { name: /^Compartir/ }).click();
    const hojaComp = p.getByRole('dialog', { name: `Compartir «${tituloMesEquipo(MES.mes)}»` });
    await hojaComp.locator('img.tarjeta-img').waitFor();
    const alt = await hojaComp.locator('img.tarjeta-img').getAttribute('alt');
    check(alt.startsWith(`${tituloMesEquipo(MES.mes)}:`) && /sesion/.test(alt) && !/kg|peso/i.test(alt), '«Compartir» prepara la imagen de siempre (solo recuentos)');
    await revisar('mes-compartir-073');
    await hojaComp.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await hojaComp.waitFor({ state: 'detached' });
    // ---------------- Una reacción nueva y una pegatina
    const deRuben = post('Rubén M.').filter({ has: p.locator('.reacciones') }).first();
    await deRuben.getByRole('button', { name: 'Más reacciones' }).click();
    await deRuben.getByRole('button', { name: /^Me encanta: / }).click();
    await deRuben.locator('button.reaccion[aria-pressed="true"]', { hasText: '❤️' }).waitFor();
    check(true, '«Más reacciones» enseña ❤️ 😂 🏆 y Lucía reacciona con ❤️');
    await deRuben.locator('.post-comentar').click();
    const hojaCom = p.getByRole('dialog', { name: 'Comentarios' });
    await hojaCom.getByRole('button', { name: 'Pegatina' }).click();
    await revisar('pegatinas-073');
    await hojaCom.getByRole('button', { name: 'Mandar la pegatina «Día de pierna»' }).click();
    await hojaCom.locator('svg.pegatina-comentario[aria-label="Pegatina: Día de pierna"]').waitFor();
    check(true, 'manda la pegatina «Día de pierna» como comentario');
    await hojaCom.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await hojaCom.waitFor({ state: 'detached' });
    // ---------------- Un momento de 24 horas
    await p.locator('.tira-momentos').getByRole('button', { name: 'Tu momento' }).click();
    const hojaMom = p.getByRole('dialog', { name: 'Tu momento' });
    check(/Nada sobre el cuerpo, el peso o el físico/.test(await hojaMom.textContent()), 'el compositor recuerda la norma en una línea');
    await hojaMom.locator('input[type=file][aria-label="Foto del momento"]').setInputFiles([{ name: 'atardecer.png', mimeType: 'image/png', buffer: PNG }]);
    await hojaMom.locator('.nm-previa img').waitFor();
    await hojaMom.getByLabel('Una línea (opcional)').fill('Atardecer después de la sesión');
    await revisar('momento-nuevo-073');
    await hojaMom.getByRole('button', { name: 'Publicar momento' }).click();
    await toast('Momento publicado: se verá 24 horas');
    const miMomento = p.locator('.tira-momentos').getByRole('button', { name: /^Momento de ti/ });
    await miMomento.waitFor();
    await miMomento.click();
    const verMom = p.getByRole('dialog', { name: 'Momento de ti' });
    await verMom.getByText('Atardecer después de la sesión').waitFor();
    check(/Quedan (23|24) h/.test(await verMom.textContent()) && await post('Atardecer después de la sesión').count() === 0,
      'publica un momento: sale en la tira (no en el muro) y le quedan 24 horas');
    await revisar('momento-ver-073');
    await verMom.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await verMom.waitFor({ state: 'detached' });
    // (pasan 24 horas: se simula atrasando su hora en la demo)
    await enLaDemo(() => {
      const db = JSON.parse(localStorage.getItem('fbe-demo-v2'));
      db.comunidad_posts.find((x) => x.tipo === 'momento' && x.texto === 'Atardecer después de la sesión').creado_en = new Date(Date.now() - 25 * 3600e3).toISOString();
      localStorage.setItem('fbe-demo-v2', JSON.stringify(db));
    });
    await recargar();
    await abrirEquipo();
    await p.locator('.tira-momentos').getByRole('button', { name: 'Tu momento' }).waitFor();
    check(await p.locator('.tira-momentos').getByRole('button', { name: /^Momento de ti/ }).count() === 0, 'pasadas 24 horas, ya no sale (y la demo lo borra)');
    // ---------------- 360 px en oscuro
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar('equipo-073-360-oscuro');
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360
      && [...document.querySelectorAll('.aniversario, .mes-equipo, .tira-momentos, .reacciones')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    check(cabe, 'a 360 px en oscuro, el aniversario, el mes en el equipo, los momentos y las reacciones caben');
    await p.getByRole('tab', { name: 'Ranking' }).click();
    await p.locator('section.hitos-equipo').waitFor();
    check(/10 retos conseguidos\s*Conseguido/.test(await p.locator('section.hitos-equipo').textContent()), 'en Ranking, «Hitos del equipo» con el conseguido');
    await revisar('hitos-073-360-oscuro');
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
  } catch (e) {
    check(false, `v0.73: ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-comunidad-073')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-073.png', import.meta.url).pathname }).catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}
