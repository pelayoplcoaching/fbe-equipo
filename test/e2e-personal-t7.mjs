// Personalización 3, tanda 7 (que respete cómo es), en la demo y en un móvil simulado: su manual de instrucciones (lo ve
// su coach), «Lo que no quieres ver» (sin báscula: el peso desaparece de Hoy), su ciclo (en el móvil) y su informe para
// el médico o el fisio.
//   Suelta:  npm run build && node test/e2e-personal-t7.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPersonalRespeto } = await import('./e2e-personal-t7.mjs'); await probarPersonalRespeto({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarPersonalRespeto({ navegador, check, base = 'http://localhost:4174' }) {
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
    const pesoAntes = await p.locator('.peso-hoy').count();

    await irASeccion(p, 'Perfil');
    const grupo = p.locator('section[aria-labelledby="grupo-lo-tuyo"]');
    await grupo.waitFor({ timeout: 8000 });
    await grupo.scrollIntoViewIfNeeded();
    // --- su manual ---
    await grupo.getByRole('button', { name: 'Escribir cómo te gusta que te entrenen' }).click();
    const hm = p.getByRole('dialog', { name: 'Cómo me gusta que me entrenen' });
    await hm.waitFor();
    await hm.getByLabel(/^Suave/).check();
    await hm.getByLabel('Los retos').check();
    await hm.getByLabel(/Lo que no quiero oír/).fill('Que me compares con otros');
    await hm.getByRole('button', { name: 'Guardar' }).click();
    await hm.waitFor({ state: 'detached' });
    const pers = await p.evaluate(() => globalThis.__fbeDemo.rpc('personal_mio', {}));
    check(pers?.manual_feedback === 'suave' && pers.manual_motiva?.includes('retos') && pers.manual_evitar === 'Que me compares con otros', 'su manual, guardado (lo ve su coach)');
    // --- lo que no quiere ver ---
    await grupo.getByRole('button', { name: 'Elegir lo que no quieres ver' }).click();
    const ho = p.getByRole('dialog', { name: 'Lo que no quieres ver' });
    await ho.waitFor();
    await ho.getByRole('switch', { name: 'Sin báscula' }).check();
    check(await p.evaluate(() => document.documentElement.hasAttribute('data-sin-peso')), 'sin báscula: se marca en toda la app');
    await p.keyboard.press('Escape');
    await ho.waitFor({ state: 'detached' });
    check(/Sin báscula/.test(await grupo.textContent()), 'y la fila lo dice');
    // --- su ciclo ---
    await grupo.getByRole('button', { name: 'Apuntar tu ciclo' }).click();
    const hc = p.getByRole('dialog', { name: 'Tu ciclo' });
    await hc.waitFor();
    check(/Se queda en este móvil/.test(await hc.textContent()), 'su ciclo: dice que se queda en el móvil');
    await hc.getByLabel('Empezó el').fill(new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10));
    await hc.getByRole('button', { name: 'Añadir' }).click();
    const guardado = await p.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('fbe-ciclo:') && JSON.parse(localStorage.getItem(k)).length === 1));
    check(guardado, 'apuntado en el móvil');
    await p.keyboard.press('Escape');
    await hc.waitFor({ state: 'detached' });
    const pc = p.locator('.patron-ciclo');
    await pc.waitFor({ timeout: 5000 });
    check(/tres inicios/.test(await pc.textContent()), 'en Perfil, que aún hacen falta más datos (sin conclusiones)');
    // --- su informe ---
    await p.getByRole('button', { name: 'Informe para tu médico o fisio' }).click();
    const hi = p.getByRole('dialog', { name: 'Tu informe' });
    await hi.locator('.informe-tabla').waitFor({ timeout: 8000 });
    check(await hi.locator('.informe-tabla tbody tr').count() === 8 && /No es un informe clínico/.test(await hi.textContent()), 'su informe: 8 semanas, y que no es un informe clínico');
    check(await hi.getByRole('button', { name: 'Guardar en PDF o imprimir' }).count() === 1, 'para guardar en PDF o imprimir');
    await p.keyboard.press('Escape');
    // --- sin báscula, en Hoy ---
    await irASeccion(p, 'Hoy');
    await p.waitForTimeout(800);
    check(await p.locator('.peso-hoy:visible').count() === 0, `en Hoy, sin su peso (antes había ${pesoAntes})`);
    const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!desborda, 'todo cabe a 390 px');
    check(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) {
    check(false, `Personalización (respeto): ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nQue respete cómo es');
  try { await probarPersonalRespeto({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
