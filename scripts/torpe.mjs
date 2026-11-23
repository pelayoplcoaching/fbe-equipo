// Uso torpe (v0.210): lo que hace la gente con prisa o con el móvil en una mano, en la demo. Doble toque en lo que guarda,
// pestañas muy seguidas, «atrás» con una hoja abierta, girar el móvil, recargar a mitad de guardar sin conexión.
// Comprueba que no se duplica nada, que no salen errores y que nada se queda a medias. No es una prueba de npm: informe.
//   npm run build && node scripts/torpe.mjs [--dist=dist]
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { servir } from '../test/servidor.mjs';

const arg = (k, def) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : def; };
const DIST = resolve(arg('dist', 'dist'));
const PUERTO = Number(arg('puerto', '4430'));
const srv = await servir(DIST, PUERTO);
const base = `http://localhost:${PUERTO}`;
const nav = await chromium.launch();
let ok = 0, mal = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { mal++; console.log('  ✗', m); } };

async function entrar(nombre, opciones = {}) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', ...opciones });
  await ctx.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* */ } });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(`sin recoger: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errores.push(`consola: ${m.text().slice(0, 160)}`); });
  await p.goto(`${base}/?demo`);
  await p.getByRole('button', { name: nombre }).first().click();
  const cod = p.getByLabel('Código', { exact: true });
  await Promise.race([cod.waitFor({ timeout: 6000 }).catch(() => {}), p.locator('nav.tabs').waitFor({ timeout: 15000 })]);
  if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
  await p.locator('nav.tabs').waitFor({ timeout: 15000 });
  await p.waitForTimeout(1500);
  await cerrar(p);
  return { ctx, p, errores };
}
async function cerrar(p) { for (let i = 0; i < 5; i++) { if (!(await p.locator('[aria-modal="true"]').count())) break; await p.keyboard.press('Escape'); await p.waitForTimeout(350); } }
const toasts = (p) => p.locator('.toast.error, [role="alert"]').allTextContents().catch(() => []);
const contar = (p, tabla, filtro) => p.evaluate(async ([t, f]) => (await globalThis.__fbeDemo.select(t, f)).length, [tabla, filtro]);

console.log('Atleta: doble toque en lo que guarda');
{
  const { ctx, p, errores } = await entrar(/Ana López/);
  // 1. El peso de hoy: doble toque en «Apuntar el de hoy» y guardar dos veces seguidas
  const apuntar = p.getByRole('button', { name: 'Apuntar el de hoy' }).first();
  if (await apuntar.isVisible().catch(() => false)) {
    await apuntar.dblclick();
    await p.locator('#peso-hoy').fill('70,6');
    await p.locator('#peso-hoy').press('Enter');
    await p.locator('#peso-hoy').press('Enter').catch(() => {});
    await p.waitForTimeout(1200);
    const hoy = await p.evaluate(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }));
    const n = await p.evaluate(async (f) => (await globalThis.__fbeDemo.select('pesos', {})).filter((x) => x.fecha === f).length, hoy);
    check(n <= 1, `el peso de hoy, una sola vez aunque se toque dos veces (${n})`);
  } else check(true, '(sin «Apuntar el de hoy» a la vista: ya apuntado)');
  // 2. Una serie: doble toque en marcar
  const empezar = p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).first();
  if (await empezar.isVisible().catch(() => false)) {
    await empezar.tap();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor({ timeout: 15000 });
    if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).tap();
    await p.locator('.ejercicio').first().waitFor({ timeout: 15000 });
    await cerrar(p);
    const b = p.locator('.ejercicio').first().getByRole('button', { name: /Marcar la serie 1 como hecha/ });
    if (await b.count()) {
      const seId = await p.locator('.ejercicio').first().getAttribute('data-se');
      await b.dblclick();
      await p.waitForTimeout(1500);
      const n = await contar(p, 'series', { eq: { sesion_ejercicio_id: seId } });
      check(n === 1, `una serie con doble toque se apunta una vez (${n})`);
      // Toques rapidísimos en las siguientes
      for (let i = 2; i <= 3; i++) { const bi = p.locator('.ejercicio').first().getByRole('button', { name: new RegExp(`Marcar la serie ${i} como hecha`) }); if (await bi.count()) { await bi.click(); } }
      await p.waitForTimeout(1500);
      const nums = await p.evaluate(async (id) => (await globalThis.__fbeDemo.select('series', { eq: { sesion_ejercicio_id: id } })).map((x) => x.numero).sort(), seId);
      check(new Set(nums).size === nums.length, `sin series repetidas al marcar seguido (${nums.join(',')})`);
    }
    await cerrar(p);
    await p.locator('.sesion-vista .cabecera').getByRole('button', { name: 'Volver' }).first().tap().catch(() => {});
    await p.locator('.hero-dia').waitFor({ timeout: 15000 }).catch(() => {});
  }
  // 3. Mensajes: doble toque en Enviar
  await p.evaluate(() => { location.hash = 'mensajes'; });
  const area = p.locator('.chat-area, .chat-barra textarea').first();
  if (await area.waitFor({ timeout: 8000 }).then(() => true, () => false)) {
    const texto = `Prueba doble toque ${Date.now() % 10000}`;
    await area.fill(texto);
    const enviar = p.getByRole('button', { name: 'Enviar', exact: true });
    await enviar.dblclick().catch(() => {});
    await p.waitForTimeout(1800);
    const n = await p.evaluate(async (t) => (await globalThis.__fbeDemo.select('comentarios', {})).filter((x) => x.texto === t).length, texto);
    check(n === 1, `un mensaje con doble toque en Enviar sale una vez (${n})`);
  }
  // 4. Pestañas muy seguidas
  const tabs = p.locator('nav.tabs .tab');
  const nTabs = await tabs.count();
  for (let i = 0; i < 16; i++) await tabs.nth(i % Math.max(1, nTabs - 1)).click({ timeout: 2000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const atasco = await p.locator('.siluetas').count();
  check(!atasco, `tras cambiar 16 veces de pestaña muy seguido, nada se queda cargando (${atasco} siluetas)`);
  // 5. «Atrás» con una hoja abierta: cierra la hoja, no sale de la pantalla
  await p.evaluate(() => { location.hash = 'hoy'; });
  await p.waitForTimeout(1200); await cerrar(p);
  const mas = p.locator('nav.tabs button', { hasText: 'Más' }).first();
  if (await mas.count()) {
    const h0 = await p.evaluate(() => location.hash);
    await mas.click();
    await p.locator('[aria-modal="true"]').first().waitFor({ timeout: 5000 }).catch(() => {});
    await p.goBack().catch(() => {});
    await p.waitForTimeout(900);
    const abiertas = await p.locator('[aria-modal="true"]').count();
    const h1 = await p.evaluate(() => location.hash).catch(() => '');
    check(abiertas === 0 && h1 === h0 && (await p.locator('nav.tabs').count()) === 1, `«atrás» con «Más» abierto cierra la hoja y se queda en ${h0} (${h1}, ${abiertas} hojas)`);
  }
  // 6. Girar el móvil con una hoja abierta
  if (await mas.count()) {
    await mas.click();
    await p.locator('[aria-modal="true"]').first().waitFor({ timeout: 5000 }).catch(() => {});
    await p.setViewportSize({ width: 844, height: 390 });
    await p.waitForTimeout(800);
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    const hoja = await p.evaluate(() => { const h = document.querySelector('[aria-modal="true"]'); if (!h) return null; const r = h.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, alto: innerHeight }; });
    check(ancho <= 844 && hoja && hoja.top >= -1, `en horizontal, la hoja abierta cabe (ancho ${ancho}, arriba ${Math.round(hoja?.top)})`);
    await p.setViewportSize({ width: 390, height: 844 });
    await cerrar(p);
  }
  const malos = await toasts(p);
  check(!errores.length && !malos.length, `sin errores ni avisos de error${errores.length || malos.length ? `: ${[...errores, ...malos].slice(0, 4).join(' | ')}` : ''}`);
  await ctx.close();
}

console.log('\nAtleta: sin conexión a mitad de la sesión');
{
  const { ctx, p, errores } = await entrar(/Ana López/);
  const empezar = p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).first();
  if (await empezar.isVisible().catch(() => false)) {
    await empezar.tap();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor({ timeout: 15000 });
    if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).tap();
    await p.locator('.ejercicio').first().waitFor({ timeout: 15000 });
    await cerrar(p);
    const ej = p.locator('.ejercicio').nth(1);
    const seId = await ej.getAttribute('data-se');
    // (la demo hace como que no hay red con «fbe-demo-sin-red»; recargar sin red ya lo prueba e2e-sinred)
    await p.evaluate(() => localStorage.setItem('fbe-demo-sin-red', '1'));
    await ctx.setOffline(true);
    const b1 = ej.getByRole('button', { name: /Marcar la serie 1 como hecha/ });
    if (await b1.count()) {
      await b1.dblclick();
      await p.waitForTimeout(500);
      const b2 = ej.getByRole('button', { name: /Marcar la serie 2 como hecha/ });
      if (await b2.count()) await b2.click();
      await p.waitForTimeout(800);
      const antes = await contar(p, 'series', { eq: { sesion_ejercicio_id: seId } }).catch(() => -1);
      await p.evaluate(() => localStorage.removeItem('fbe-demo-sin-red'));
      await ctx.setOffline(false);
      await p.waitForTimeout(4000);
      const nums = await p.evaluate(async (id) => (await globalThis.__fbeDemo.select('series', { eq: { sesion_ejercicio_id: id } })).map((x) => x.numero).sort(), seId).catch(() => []);
      check(antes === 0 && nums.join(',') === '1,2', `dos series marcadas sin conexión (una con doble toque): al volver la red, en la base una vez cada una (antes ${antes}, después ${nums.join(',')})`);
      const pendientes = await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-cola-v1') || '[]').length);
      check(pendientes === 0, `y la cola queda vacía (${pendientes})`);
    }
  }
  check(!errores.filter((e) => !/Sin conexión|Failed to fetch|NetworkError/.test(e)).length, `sin errores (salvo los de no tener red)${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

console.log('\nCoach: doble toque');
{
  const { ctx, p, errores } = await entrar(/Pelayo/, { viewport: { width: 1280, height: 860 }, isMobile: false, hasTouch: false });
  await p.locator('[data-atleta]').first().click();
  await p.locator('[role="tab"]').first().waitFor({ timeout: 15000 });
  // Nota privada: doble clic en guardar
  const tabs = await p.locator('[role="tab"]').allTextContents();
  check(tabs.length > 2, `la ficha abre con sus pestañas (${tabs.length})`);
  // Tareas o mensajes rápidos desde la ficha: abrir y cerrar seguidas las pestañas
  for (let i = 0; i < 12; i++) await p.locator('[role="tab"]').nth(i % tabs.length).click({ timeout: 2000 }).catch(() => {});
  await p.waitForTimeout(2500);
  check(!(await p.locator('.siluetas').count()), 'tras cambiar 12 veces de pestaña en la ficha, nada se queda cargando');
  const malos = await toasts(p);
  check(!errores.length && !malos.length, `sin errores${errores.length || malos.length ? `: ${[...errores, ...malos].slice(0, 4).join(' | ')}` : ''}`);
  await ctx.close();
}
await nav.close(); srv.close?.();
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(0);
