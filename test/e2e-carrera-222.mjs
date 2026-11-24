// v0.222: carrera, tanda 3 de las 20 mejoras, en la demo con Carlos. Lo llama e2e.test.mjs.
//   · En Atletas, al final, «Corredores»: Carlos con sus km de esta semana frente al plan y su próxima carrera; un toque
//     abre su ficha en la pestaña Carrera.
//   · Ficha → Carrera: «Avisos y ajuste», con el ajuste de esta semana (seguir, repetir o bajar) calculado con lo que hizo
//     la pasada; si cambia algo, «Aplicar» lo pone en su plan y queda «Aplicado».
//   · En el móvil (390 px), el panel de corredores cabe. Sin errores.
import { devices } from 'playwright';

export async function probarCarrera222({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const vigilar = (p) => {
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|blob:|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  };
  const cerrar = async (p) => {
    for (let i = 0; i < 6; i++) {
      const b = p.locator('[aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Cerrar"), [aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] .hoja-cerrar').first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await p.waitForTimeout(400); } else break;
    }
  };
  const desborda = async (p, paso) => { const w = p.viewportSize()?.width || 390; const a = await p.evaluate(() => document.documentElement.scrollWidth); if (a > w) errores.push(`${paso}: la página se desborda (${a} > ${w})`); };
  const iniciar = async (ctx) => ctx.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* sin almacenamiento */ } });
  const entrar = async (p) => {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.waitForTimeout(1500);
    await cerrar(p);
    await p.locator('.tab', { hasText: 'Atletas' }).first().click();
  };

  // 1) El panel de corredores, en Atletas
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await iniciar(ctx);
  const p = await ctx.newPage();
  vigilar(p);
  await entrar(p);
  const panel = p.locator('.corr-panel');
  await panel.waitFor({ timeout: 15000 });
  if (!(await panel.evaluate((e) => e.open))) await panel.locator('summary').click();
  const fila = panel.locator('.corr-fila', { hasText: 'Carlos Vera' });
  const texto = await fila.textContent();
  check(await panel.locator('.corr-fila').count() === 1 && /km/.test(texto) && /10K del barrio: faltan \d+ (semanas|días)/.test(texto),
    `en Atletas, «Corredores»: Carlos, con sus km de esta semana y su próxima carrera («${texto.replace(/\s+/g, ' ').trim().slice(0, 110)}»)`);
  await fila.click();
  await p.locator('.carrera-ficha').waitFor({ timeout: 15000 });
  check(await p.getByRole('tab', { name: 'Carrera' }).first().getAttribute('aria-selected') === 'true', 'un toque abre su ficha en la pestaña Carrera');

  // 2) Avisos y ajuste
  const av = p.locator('.carrera-avisos');
  await av.waitFor({ timeout: 10000 });
  const aj = av.locator('.cav-ajuste');
  const tAj = (await aj.textContent()).replace(/\s+/g, ' ');
  check(/La semana del \d+ \S+: (Seguir el plan|Repetir el volumen|Bajar un 25 %)/.test(tAj) && /Con lo de la semana del/.test(tAj), `el ajuste de esta semana, con lo que hizo la pasada («${tAj.trim().slice(0, 140)}»)`);
  const aplicar = aj.getByRole('button', { name: /^Aplicar/ });
  if (await aplicar.count()) {
    await aplicar.click();
    await aj.getByText('Aplicado').waitFor({ timeout: 8000 });
    check(true, 'con «Aplicar», el ajuste pasa a su plan y queda «Aplicado»');
  } else check(/Seguir el plan/.test(tAj), 'si todo fue bien, sigue el plan (nada que aplicar)');
  await desborda(p, 'la ficha con los avisos');
  await ctx.close();

  // 3) En el móvil
  const ctxM = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await iniciar(ctxM);
  const pm = await ctxM.newPage();
  vigilar(pm);
  await entrar(pm);
  const pM = pm.locator('.corr-panel');
  await pM.waitFor({ timeout: 15000 });
  if (!(await pM.evaluate((e) => e.open))) await pM.locator('summary').click();
  await pM.scrollIntoViewIfNeeded();
  const caja = await pM.locator('.corr-fila').first().boundingBox();
  check(!!caja && caja.x >= 0 && caja.x + caja.width <= 390, 'en el móvil, el panel de corredores cabe');
  await desborda(pm, 'Atletas en el móvil');
  await ctxM.close();
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}
