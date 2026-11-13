// Personalización 3, tanda 6 (que la app sepa de su vida), en la demo y en un móvil simulado: en «Lo tuyo», lo que viene
// en su vida; en Hoy, el ánimo del día y la pregunta de después («¿Qué tal…?»); y «Esta semana va a ser difícil», que lo
// apunta, avisa al coach y deja a mano lo obligatorio (sin tocar la programación).
//   Suelta:  npm run build && node test/e2e-personal-t6.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPersonalVida } = await import('./e2e-personal-t6.mjs'); await probarPersonalVida({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function probarPersonalVida({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 5; i++) {
      await p.waitForTimeout(350);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  try {
    await p.goto(`${base}/?demo`);
    await p.locator('button.persona', { hasText: 'Ana López' }).click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();

    // --- «Lo tuyo»: lo que viene en su vida ---
    await irASeccion(p, 'Perfil');
    const grupo = p.locator('section[aria-labelledby="grupo-lo-tuyo"]');
    await grupo.waitFor({ timeout: 8000 });
    await grupo.scrollIntoViewIfNeeded();
    await grupo.getByRole('button', { name: 'Apuntar lo que viene en tu vida' }).click();
    const hoja = p.getByRole('dialog', { name: 'Lo que viene en tu vida' });
    await hoja.waitFor();
    await hoja.getByLabel('Qué').fill('La mudanza');
    await hoja.getByLabel('Cuándo').fill(dia(0));
    await hoja.getByRole('button', { name: 'Apuntarlo' }).click();
    await hoja.locator('.agenda-fila', { hasText: 'La mudanza' }).waitFor({ timeout: 5000 });
    await hoja.getByLabel('Qué').fill('El examen de la oposición');
    await hoja.getByLabel('Cuándo').fill(dia(-2));
    await hoja.getByRole('button', { name: 'Apuntarlo' }).click();
    await p.waitForTimeout(500);
    const ag = await p.evaluate(() => globalThis.__fbeDemo.rpc('agenda_lista', {}));
    check(ag.length === 2 && ag.every((x) => x.autor === 'atleta'), 'apunta lo que viene en su vida (va a la base: lo ve su coach)');
    check(await hoja.locator('.agenda-fila').count() === 1, 'en la lista, lo que viene (lo pasado, no)');
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });

    // --- Hoy: el ánimo del día y la pregunta de después ---
    await irASeccion(p, 'Hoy');
    const tv = p.locator('.tarjeta-vida');
    await tv.waitFor({ timeout: 8000 });
    check(/Hoy: La mudanza\. ¡Mucho ánimo, Ana!/.test(await tv.textContent()), 'en Hoy, el ánimo del día con su nombre');
    check(/¿Qué tal el examen de la oposición\?/.test(await tv.textContent()), 'y la pregunta por lo de hace dos días');
    await tv.getByRole('button', { name: 'Bien', exact: true }).click();
    await tv.getByLabel('Si quieres, cuéntalo').fill('Aprobado');
    await tv.getByRole('button', { name: 'Contestar' }).click();
    await p.locator('.toast', { hasText: 'tu coach lo verá' }).waitFor({ timeout: 5000 });
    const resp = (await p.evaluate(() => globalThis.__fbeDemo.rpc('agenda_lista', {}))).find((x) => x.titulo === 'El examen de la oposición');
    check(resp?.respuesta === 'bien' && resp.respuesta_nota === 'Aprobado', 'contesta qué tal fue (lo verá su coach)');
    await p.waitForTimeout(400);
    check(!/¿Qué tal el examen/.test(await tv.textContent().catch(() => '')), 'y la pregunta se va');

    // --- Esta semana va a ser difícil ---
    const boton = p.getByRole('button', { name: 'Esta semana va a ser difícil' });
    await boton.scrollIntoViewIfNeeded();
    await boton.click();
    const hd = p.getByRole('dialog', { name: 'Una semana difícil' });
    await hd.waitFor();
    check(/Tu programación no cambia/.test(await hd.textContent()), 'la hoja deja claro que la programación no cambia');
    await hd.getByLabel(/¿Por qué\?/).fill('exámenes');
    await hd.getByRole('button', { name: 'Apuntarlo' }).click();
    await hd.waitFor({ state: 'detached' });
    const ag2 = await p.evaluate(() => globalThis.__fbeDemo.rpc('agenda_lista', {}));
    check(ag2.some((x) => x.tipo === 'dificil' && x.nota === 'exámenes'), 'apuntada la semana difícil');
    await p.locator('.vida-dificil').waitFor({ timeout: 6000 });
    check(/Si solo te da para lo obligatorio, con eso vale/.test(await p.locator('.vida-dificil').textContent()), 'en Hoy, el consejo de la semana difícil');
    check(await p.getByRole('button', { name: 'Esta semana va a ser difícil' }).count() === 0, 'y el botón ya no sale esta semana');
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Personalización (vida): ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nQue la app sepa de su vida');
  try { await probarPersonalVida({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
