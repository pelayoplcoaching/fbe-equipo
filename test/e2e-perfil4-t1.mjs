// El perfil del atleta, tanda 4, T1 (rama perfil-4), en la demo y en un móvil de 390 px:
//   · «Tu perfil, al N %» con lo que falta, y que cada hueco abra su hoja
//   · el índice (Tú · Lo tuyo · Ajustes) y el buscador del perfil
//   · el día 1 y hoy (Resumen) y las marcas por repeticiones (Logros)
//   · «Lo que te ha corregido tu coach» (Tu asesoría)
//   · sin errores, sin desbordes y sin fallos de accesibilidad
//   Suelta:  npm run build && node test/e2e-perfil4-t1.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function entrarPerfil(ctx, nombre, base, errores) {
  const { irASeccion } = await import('./secciones.mjs');
  const q = await ctx.newPage();
  q.on('pageerror', (e) => errores.push(e.message));
  await q.goto(`${base}/?demo`);
  await q.locator('button.persona', { hasText: nombre }).first().click();
  await q.locator('nav.tabs').waitFor();
  for (let i = 0; i < 6; i++) { await q.waitForTimeout(350); if (!(await q.locator('[role=dialog]').last().isVisible().catch(() => false))) break; await q.keyboard.press('Escape'); }
  await irASeccion(q, 'Perfil');
  await q.locator('.perfil-cabeza').waitFor({ timeout: 10000 });
  return q;
}
export async function axeEn(q, sel, errores, paso) {
  if (!(await q.evaluate(() => !!window.axe))) await q.addScriptTag({ path: AXE });
  const v = await q.evaluate(async (s) => (await window.axe.run(document.querySelector(s) || document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, rules: { region: { enabled: false } },
  })).violations.map((x) => `${x.id}: ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`), sel);
  if (v.length) errores.push(`${paso}: accesibilidad: ${v.join(' || ')}`);
}

export async function probarPerfil4T1({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid', bypassCSP: true });
  try {
    const p = await entrarPerfil(ctx, 'Ana López', base, errores);
    // Completa tu perfil
    const comp = p.locator('.completa-perfil');
    await comp.waitFor({ timeout: 8000 });
    const titulo = await comp.locator('#completa-perfil-t').textContent();
    const n = await comp.locator('.completa-hueco').count();
    check(/Tu perfil, al \d+ %/.test(titulo) && n >= 1, `«${titulo.trim()}», con ${n} cosas por rellenar`);
    const primero = (await comp.locator('.completa-titulo').first().textContent()).trim();
    const objetivo = comp.locator('.completa-hueco', { hasText: 'Tu porqué' }).first();
    if (await objetivo.count()) {
      await objetivo.click();
      const h = p.getByRole('dialog', { name: 'Tu porqué' });
      check(await h.isVisible({ timeout: 5000 }).catch(() => false), 'cada hueco abre su hoja (Tu porqué)');
      await p.keyboard.press('Escape');
      await h.waitFor({ state: 'detached' }).catch(() => {});
    } else check(!!primero, `el primero que falta: ${primero}`);
    await axeEn(p, '.completa-perfil', errores, 'completa');
    // Índice y buscador
    const ind = p.locator('.indice-perfil');
    check(await ind.locator('.indice-chip').count() === 3, 'el índice: Tú · Lo tuyo · Ajustes');
    await ind.getByRole('button', { name: 'Ajustes' }).click();
    await p.waitForTimeout(900);
    check(await p.evaluate(() => { const r = document.querySelector('#grupo-conexiones, #grupo-este-movil')?.getBoundingClientRect(); return !!r && r.top < innerHeight && r.bottom > 0; }), '«Ajustes» lleva a los ajustes');
    await ind.locator('input[type=search]').scrollIntoViewIfNeeded();
    await ind.locator('input[type=search]').fill('privacidad');
    const res = ind.locator('.indice-resultado').first();
    await res.waitFor({ timeout: 4000 });
    await p.waitForTimeout(300);   // (el buscador busca al escribir)
    check(/Política de privacidad/.test(await ind.locator('.indice-resultados').textContent()), `el buscador encuentra «Política de privacidad» (sin tildes ni mayúsculas): ${(await ind.locator('.indice-resultado').allTextContents()).join(' | ')}`);
    await res.click();
    await p.waitForTimeout(400);
    check(await p.locator('.destello-busqueda').count() === 1, 'y lleva hasta ella, resaltada');
    await axeEn(p, '.indice-perfil', errores, 'indice');
    // (desde la v0.166, «Ajustes» es otra vista: se vuelve a «Tú» para lo demás)
    await p.getByRole('tab', { name: 'Tú', exact: true }).click();
    await p.locator('.perfil-cabeza').waitFor();
    // El día 1 y hoy, y las marcas por repeticiones
    await p.locator('.perfil-pestanas').scrollIntoViewIfNeeded();
    const dia = p.locator('.dia-uno');
    await dia.waitFor({ timeout: 8000 }).catch(() => {});
    const filas = await dia.locator('.dia-uno-fila').count();
    // (la demo crea su historial hacia atrás desde hoy: si no llega a 4 semanas, la sección no sale)
    const dias = await p.evaluate(async () => { const B = globalThis.__fbeDemo; const ana = (await B.select('atletas', {})).find((x) => x.nombre === 'Ana López'); const f = (await B.select('series', {})).filter((x) => x.atleta_id === ana?.id).map((x) => x.registrada_en).filter(Boolean).sort()[0]; return f ? Math.floor((Date.now() - Date.parse(f)) / 864e5) : 0; });
    check(dias >= 30 ? filas >= 1 && /\d/.test(await dia.locator('.dia-uno-hoy').first().textContent()) : filas === 0, `el día 1 y hoy: ${filas} ejercicios (la demo tiene ${dias} días de historial; hacen falta 4 semanas)`);
    await p.locator('.perfil-pestanas').getByRole('tab', { name: 'Logros' }).click();
    const mr = p.locator('.marcas-reps');
    await mr.waitFor({ timeout: 8000 });
    check(await mr.locator('tbody tr').count() === 6 && await mr.locator('tbody td.num').filter({ hasText: /\d/ }).count() >= 1, 'las marcas por repeticiones: 1, 3, 5, 8, 10 y 12, con su mejor peso');
    const opciones = await mr.locator('select option').count();
    if (opciones > 1) { await mr.locator('select').selectOption({ index: 1 }); await p.waitForTimeout(200); }
    check(opciones >= 1, `se puede elegir el ejercicio (${opciones})`);
    await axeEn(p, '.marcas-reps', errores, 'marcas');
    // Lo que te ha corregido tu coach
    const fila = p.getByRole('button', { name: 'Ver lo que te ha corregido tu coach' });
    await fila.scrollIntoViewIfNeeded();
    await fila.click();
    const hc = p.getByRole('dialog', { name: 'Lo que te ha corregido tu coach' });
    await hc.waitFor({ timeout: 5000 });
    await p.waitForFunction(() => !document.querySelector('.correcciones-hoja [role=status]'), null, { timeout: 8000 }).catch(() => {});
    const nItems = await hc.locator('.correccion-ej').count();
    check(nItems >= 1 || /Aún no hay correcciones/.test(await hc.textContent()), `«Lo que te ha corregido tu coach»: ${nItems ? `${nItems} ejercicios` : 'vacío, con su explicación'}`);
    await p.keyboard.press('Escape');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= 390), 'nada se sale a 390 px');
    await p.close();
    // Iván lleva más de 4 semanas en la demo: el día 1 y hoy, con sus ejercicios
    const ctx2 = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid', bypassCSP: true });
    const iv = await entrarPerfil(ctx2, 'Iván Prieto', base, errores);
    const d1 = iv.locator('.dia-uno');
    await d1.waitFor({ timeout: 10000 }).catch(() => {});
    const fi = await d1.locator('.dia-uno-fila').count();
    check(fi >= 1 && /\+?\d+ %|igual/.test(await d1.locator('.dia-uno-hoy').first().textContent()), `el día 1 y hoy (Iván): ${fi} ejercicios, con lo que ha subido`);
    await d1.scrollIntoViewIfNeeded().catch(() => {});
    if (process.env.FOTOS) await d1.screenshot({ path: `${process.env.FOTOS}/dia-uno.png` }).catch(() => {});
    await axeEn(iv, '.dia-uno', errores, 'dia-uno');
    await ctx2.close();
  } catch (e) {
    check(false, `la T1 del perfil no se ha podido recorrer: ${e.message.split('\n')[0]}`);
  }
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nEl perfil, tanda 4, T1');
  try { await probarPerfil4T1({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
