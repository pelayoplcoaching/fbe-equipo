// La comunidad viva (comunidad-viva.css), en la demo y en un móvil simulado: la franja de la manada al entrar, la
// publicación que llega, la encuesta que se llena, las barras y el marcador de los retos, el podio del ranking, la mano
// del ánimo y la insignia nueva. Con «reducir movimiento», nada se mueve.
//   Suelta:  npm run build && node test/e2e-comunidad-viva.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarComunidadViva } = await import('./e2e-comunidad-viva.mjs'); await probarComunidadViva({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarComunidadViva({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  async function abrir({ quieto = false } = {}) {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, reducedMotion: quieto ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    return { ctx, p };
  }
  const cerrarDialogos = async (p) => {
    for (let i = 0; i < 6; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir', 'Empezar']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
    }
  };
  const animadas = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].flatMap((el) => el.getAnimations().map((a) => `${a.animationName || 'transicion'}:${a.playState}`)), sel);
  const quietas = (p, sel) => p.waitForFunction((s) => ![...document.querySelectorAll(s)].some((el) => el.getAnimations().some((a) => a.playState === 'running')), sel, { timeout: 6000 });
  const entrar = async (p) => {
    await cerrarDialogos(p);
    await irASeccion(p, 'Equipo');
    await p.locator('.entrar-equipo').waitFor();
  };
  const dentro = async (p) => {
    await p.getByRole('button', { name: 'Leer las normas' }).click();
    await p.getByRole('dialog').last().getByRole('button', { name: 'He leído las normas' }).click();
    await p.getByRole('button', { name: /quiero entrar/ }).click();
    await p.locator('.muro .post').first().waitFor();
    await cerrarDialogos(p);
  };
  const VIVAS = '.franja-viva *, .post, .eo-barra, .eo-pct, .eo-texto svg, .reto .barra-equipo > span, .me-equipo .num, .re-total, .podio-sitio *, .fila-ranking, .fila-ranking .barra-equipo > span, .btn-animar, .btn-animar *, .pe-insignias .insignia, .cp-llamas, .cp-llamas *';

  let { ctx, p } = await abrir();
  try {
    // 8. La franja de la manada, al entrar
    await entrar(p);
    const manada = p.locator('.entrar-equipo .franja-manada');
    await manada.locator('img').waitFor();
    const m = await animadas(p, '.franja-manada *');
    check(await manada.getAttribute('aria-hidden') === 'true' && m.some((x) => x.startsWith('cv-franja')) && m.some((x) => x.startsWith('cv-respira')) && m.filter((x) => x.startsWith('cv-titila')).length === 8,
      'al entrar al equipo, la manada se acerca despacio, la luna respira y las estrellas titilan (adorno)');
    check(await manada.evaluate((el) => { const r = el.getBoundingClientRect(); return Math.abs(r.width / r.height - 2.4) < 0.05 && getComputedStyle(el).overflow === 'hidden' && !el.getAnimations({ subtree: true }).some((a) => a.effect.getTiming().iterations === Infinity); }),
      'en su hueco de siempre (2,4:1), recortada, y ninguna de sus animaciones es sin fin');
    await dentro(p);
    // 5. El muro: la publicación que llega
    check(await p.locator('.post.post-llega').count() === 0, 'al abrir el muro, ninguna publicación «llega»: están todas');
    await p.locator('#eq-texto').first().fill('Probando la comunidad viva');
    await p.getByRole('button', { name: 'Publicar' }).first().click();
    const llega = p.locator('.post.post-llega');
    await llega.first().waitFor();
    check(await llega.count() === 1 && /mia/.test(await llega.getAttribute('class')) && /Probando la comunidad viva/.test(await llega.textContent()) && (await animadas(p, '.post.post-llega')).some((x) => x.startsWith('cv-post-llega')),
      'al publicar, la tuya (y solo ella) entra con su gesto');
    await p.waitForFunction(() => !document.querySelector('.post.post-llega'), null, { timeout: 5000 });
    check(await p.locator('.post', { hasText: 'Probando la comunidad viva' }).count() === 1, 'y después es una más');
    // 6. La encuesta
    const enc = p.locator('.encuesta').first();
    if (await enc.count() && await enc.locator('button.encuesta-opcion').count()) {
      await enc.scrollIntoViewIfNeeded();
      const sinVotar = await enc.locator('.eo-barra').count();
      await enc.locator('button.encuesta-opcion').first().click();
      await enc.locator('.eo-barra').first().waitFor();
      const a = await animadas(p, '.encuesta .eo-barra, .encuesta .eo-texto svg');
      await quietas(p, '.encuesta *');
      const barras = await enc.locator('.eo-barra').evaluateAll((els) => els.map((e) => { const pct = Number(e.style.getPropertyValue('--pct')); const r = e.getBoundingClientRect(), c = e.parentElement.getBoundingClientRect(); return Math.abs(r.width / c.width - pct) < 0.02 && e.offsetWidth >= c.width - 4; }));
      check(sinVotar === 0 && a.some((x) => x.startsWith('cv-barra-crece')) && a.some((x) => x.startsWith('cv-golpe')) && barras.length >= 2 && barras.every(Boolean),
        'al votar en la encuesta, las barras se llenan hasta su porcentaje (con transform: el ancho no cambia) y tu opción da un golpe');
    } else check(true, 'no hay encuesta abierta en el muro: sin barras que mirar');
    // 2, 3 y 8. Los retos
    await p.getByRole('tab', { name: /Retos/ }).click();
    await p.locator('.reto').first().waitFor();
    const r = await animadas(p, '.reto .barra-equipo > span, .franja-reto *, .me-equipo .num');
    check(r.some((x) => x.startsWith('cv-barra-crece')) && r.some((x) => x.startsWith('cv-franja')) && await p.locator('.franja-reto[aria-hidden="true"] .fv-cumbre').count() === 1,
      'en los retos, las barras crecen desde cero y la franja de la montaña se acerca, con la luz en la cumbre');
    await quietas(p, '.reto .barra-equipo > span');
    check(await p.locator('.reto .barra-equipo > span').evaluateAll((els) => els.every((e) => { const t = getComputedStyle(e).transform; return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)'; })) && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'al acabar quedan en su medida de siempre, sin desbordes');
    const marcador = p.locator('.marcador-equipos');
    if (await marcador.count()) check(await marcador.locator('.me-equipo.delante').count() <= 1 && r.some((x) => x.startsWith('cv-cifra-sube')), 'en el marcador por equipos, las cifras suben a su sitio y solo el que va por delante da el empujón');
    // 4 y 1. El ranking y el ánimo
    await p.getByRole('tab', { name: /Ranking/ }).click();
    await p.locator('.ranking .podio-sitio, .ranking .fila-ranking').first().waitFor();
    const k = await animadas(p, '.podio-sitio *, .fila-ranking');
    const hayPodio = await p.locator('.podio-sitio').count();
    check(!hayPodio || (k.some((x) => x.startsWith('cv-peana-sube')) && k.some((x) => x.startsWith('cv-cae'))), 'en el ranking, el podio sube y los suyos caen encima');
    await quietas(p, '.ranking *');
    check(await p.locator('.ranking .podio-peana, .ranking .fila-ranking').evaluateAll((els) => els.every((e) => { const c = getComputedStyle(e); return Number(c.opacity) === 1 && e.getBoundingClientRect().height > 0; })), 'y al acabar todo está en su sitio y a la vista');
    const mano = p.locator('.ranking .btn-animar:not(.hecho)').first();
    if (await mano.count()) {
      await mano.click();
      const recien = p.locator('.ranking .btn-animar.recien').first();
      await recien.waitFor();
      check((await animadas(p, '.ranking .btn-animar.recien, .ranking .btn-animar.recien > span')).some((x) => x.startsWith('cv-mano-salta')) && await recien.evaluate((el) => getComputedStyle(el, '::after').animationName === 'cv-mano-vuela'),
        'al mandar un ánimo, la mano salta y sale volando');
      await p.locator('.aviso-flotante, [role=status]').first().waitFor({ timeout: 3000 }).catch(() => {});
    } else check(true, 'no queda nadie a quien animar esta semana: sin mano que mirar');
    // 9. La insignia nueva, en tu perfil
    const yoEn = p.locator('.ranking .yo .btn-persona, .ranking .yo button').first();
    await yoEn.click();
    const perfil = p.getByRole('dialog').last();
    await perfil.locator('.pe-insignias .insignia, .insignias-perfil, .pe-sub').first().waitFor();
    const cuantas = await perfil.locator('.pe-insignias .insignia').count();
    check(await perfil.locator('.pe-insignias .insignia.nueva').count() === 0, 'la primera vez que abres tu perfil, ninguna insignia se mueve (no se sabe cuál es nueva)');
    const clave = await p.evaluate(() => Object.keys(localStorage).find((x) => x.startsWith('fbe-insignias-vistas:')) || null);
    if (cuantas && clave) {
      await p.keyboard.press('Escape');
      await perfil.waitFor({ state: 'detached' });
      await p.evaluate((c) => localStorage.setItem(c, '[]'), clave);
      await yoEn.click();
      const otra = p.getByRole('dialog').last();
      await otra.locator('.pe-insignias .insignia.nueva').first().waitFor();
      check(await otra.locator('.pe-insignias .insignia.nueva').count() === cuantas && (await animadas(p, '.pe-insignias .insignia.nueva')).some((x) => x.startsWith('cv-insignia-llega')) && JSON.parse(await p.evaluate((c) => localStorage.getItem(c), clave)).length === cuantas,
        `la insignia que aún no habías visto llega girando (${cuantas}) y queda apuntada como vista en este móvil`);
    } else check(!!clave, 'sin insignias todavía: nada que llegar (pero queda apuntado que se han mirado)');
    await p.keyboard.press('Escape');
  } catch (e) {
    check(false, `La comunidad viva: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }

  // Con «reducir movimiento», nada se mueve (y las barras de la encuesta siguen midiendo)
  ({ ctx, p } = await abrir({ quieto: true }));
  try {
    await entrar(p);
    await p.locator('.franja-manada img').waitFor();
    const quietaManada = (await animadas(p, VIVAS)).length;
    await dentro(p);
    await p.locator('#eq-texto').first().fill('Sin movimiento');
    await p.getByRole('button', { name: 'Publicar' }).first().click();
    await p.locator('.post', { hasText: 'Sin movimiento' }).first().waitFor();
    const quietoMuro = (await animadas(p, VIVAS)).length;
    const enc = p.locator('.encuesta').first();
    let barraBien = true;
    if (await enc.count() && await enc.locator('button.encuesta-opcion').count()) {
      await enc.locator('button.encuesta-opcion').first().click();
      await enc.locator('.eo-barra').first().waitFor();
      barraBien = await enc.locator('.eo-barra').evaluateAll((els) => els.every((e) => { const pct = Number(e.style.getPropertyValue('--pct')); return Math.abs(e.getBoundingClientRect().width / e.parentElement.getBoundingClientRect().width - pct) < 0.02 && !e.getAnimations().length; }));
    }
    await p.getByRole('tab', { name: /Retos/ }).click();
    await p.locator('.reto').first().waitFor();
    const quietoRetos = (await animadas(p, VIVAS)).length;
    await p.getByRole('tab', { name: /Ranking/ }).click();
    await p.locator('.ranking .podio-sitio, .ranking .fila-ranking').first().waitFor();
    check(quietaManada === 0 && quietoMuro === 0 && quietoRetos === 0 && (await animadas(p, VIVAS)).length === 0 && barraBien,
      'con «reducir movimiento», ni la manada, ni el muro, ni los retos, ni el ranking se mueven (y las barras de la encuesta miden igual)');
  } catch (e) {
    check(false, `La comunidad, con «reducir movimiento»: ${e.message.split('\n')[0]}`);
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
  console.log('\nLa comunidad viva');
  try { await probarComunidadViva({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
