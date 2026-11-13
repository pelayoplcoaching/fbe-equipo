// Personalización 2, tanda 2 (que sepa a qué viene), en la demo y en un móvil simulado: su meta en «Lo tuyo» (con día y
// cifra) y su cuenta atrás en Hoy; en la portada de la sesión, por qué es para ella (su objetivo y su meta); y en Perfil,
// su historia en una línea.
//   Suelta:  npm run build && node test/e2e-personal-t2.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPersonalRumbo } = await import('./e2e-personal-t2.mjs'); await probarPersonalRumbo({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

const dentroDe = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function probarPersonalRumbo({ navegador, check, base = 'http://localhost:4174' }) {
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
  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    check(await p.locator('.cuenta-meta').count() === 0, 'sin meta, en Hoy no hay cuenta atrás');

    // --- «Lo tuyo»: su meta ---
    await irASeccion(p, 'Perfil');
    const grupo = p.locator('section[aria-labelledby="grupo-lo-tuyo"]');
    await grupo.waitFor({ timeout: 8000 });
    await grupo.scrollIntoViewIfNeeded();
    await grupo.getByRole('button', { name: 'Poner tu meta' }).click();
    const hoja = p.getByRole('dialog', { name: 'Tu meta' });
    await hoja.waitFor();
    check(await hoja.getByRole('button', { name: 'Guardar' }).isDisabled(), 'sin nombre no se puede guardar');
    await hoja.getByLabel('Tu meta').fill('Mi primera competición');
    await hoja.getByLabel(/El día/).fill(dentroDe(70));
    await hoja.getByLabel(/La cifra/).fill('100');
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await hoja.waitFor({ state: 'detached' });
    const pers = await p.evaluate(() => globalThis.__fbeDemo.rpc('personal_mio', {}));
    check(pers?.meta_nombre === 'Mi primera competición' && pers.meta_fecha === dentroDe(70) && Number(pers.meta_cifra) === 100 && pers.meta_unidad === 'kg', 'guardada: nombre, día, cifra y unidad (la ve su coach)');
    check(/Faltan 10 semanas para Mi primera competición/.test(await grupo.textContent()), 'y la fila dice cuánto falta');

    // --- Perfil: su historia en una línea ---
    const historia = p.locator('.historia-linea');
    await historia.waitFor({ timeout: 8000 });
    check(/^Llevas \d+ (meses|semanas|mes)/.test((await historia.textContent()).trim()) && /sesi/.test(await historia.textContent()), `en Perfil, su historia en una línea («${(await historia.textContent()).trim().slice(0, 60)}…»)`);

    // --- Hoy: la cuenta atrás ---
    await irASeccion(p, 'Hoy');
    const cuenta = p.locator('.cuenta-meta');
    await cuenta.waitFor({ timeout: 8000 });
    check(/Faltan 10 semanas para Mi primera competición \(100 kg\)/.test(await cuenta.textContent()), 'en Hoy, la cuenta atrás de su meta (con su cifra)');

    // --- La portada: por qué esta sesión es para ella ---
    await p.locator('.hero-dia .btn-hero').click();
    const porque = p.locator('.portada-porque');
    await porque.waitFor({ timeout: 6000 });
    const t = await porque.textContent();
    check(/Por qué es para ti/.test(t) && /Para tu fuerza/.test(t) && /Un paso más hacia Mi primera competición/.test(t), 'en la portada, por qué es para ella: su objetivo (fuerza) y su meta');
    check(await p.locator('.portada-nivel').count() === 0, 'con experiencia, sin explicarle el RIR');
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');

    // --- Quitar la meta ---
    await p.getByRole('button', { name: 'Volver' }).first().click();
    await p.waitForTimeout(400);
    await irASeccion(p, 'Perfil');
    await grupo.waitFor({ timeout: 8000 });
    await grupo.getByRole('button', { name: 'Poner tu meta' }).click();
    await hoja.waitFor();
    await hoja.getByRole('button', { name: 'Quitar mi meta' }).click();
    await hoja.waitFor({ state: 'detached' });
    const sin = await p.evaluate(() => globalThis.__fbeDemo.rpc('personal_mio', {}));
    check(sin?.meta_nombre == null && sin.meta_fecha == null && sin.meta_cifra == null, 'quitar la meta la borra entera');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Personalización (rumbo): ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nQue sepa a qué viene');
  try { await probarPersonalRumbo({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
