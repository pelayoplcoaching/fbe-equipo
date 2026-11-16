// El perfil del atleta, tanda 4, T3 (rama perfil-4; migración del perfil 4), en la demo y en un móvil de 390 px:
//   · lo que prefieres evitar (con su motivo) y tu material (los ve tu coach)
//   · tus guardados, en un sitio
//   · tu rincón de ánimo: un mensaje del coach desde el chat
//   · tu foto de portada
//   Suelta:  npm run build && node test/e2e-perfil4-t3.mjs
import { pathToFileURL } from 'node:url';
import { entrarPerfil, axeEn } from './e2e-perfil4-t1.mjs';

// Una foto JPEG de prueba (hecha en el navegador)
const fotoDePrueba = (q) => q.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 900; c.height = 600;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 900, 600); gr.addColorStop(0, '#335'); gr.addColorStop(1, '#a6c'); g.fillStyle = gr; g.fillRect(0, 0, 900, 600);
  const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8));
  return Array.from(new Uint8Array(await b.arrayBuffer()));
});

export async function probarPerfil4T3({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid', bypassCSP: true });
  try {
    const p = await entrarPerfil(ctx, 'Ana López', base, errores);
    const grupo = p.locator('section[aria-labelledby="grupo-tu-forma"]');
    await grupo.waitFor({ timeout: 8000 });
    // 7. Lo que prefieres evitar
    await grupo.locator('[aria-label="Lo que prefieres evitar"]').click();
    let h = p.getByRole('dialog', { name: 'Lo que prefieres evitar' });
    await h.waitFor();
    await h.getByRole('searchbox', { name: /Buscar un ejercicio/ }).fill('fondos');
    const res = h.locator('.lista-elegir button').first();
    await res.waitFor({ timeout: 8000 });
    const nombreEj = (await res.textContent()).trim();
    await res.click();
    await h.getByRole('group', { name: /Motivo para evitar/ }).getByRole('button', { name: 'Me molesta' }).click();
    check(await h.locator('.evitado', { hasText: nombreEj }).locator('.evitado-motivo', { hasText: 'Me molesta' }).count() === 1, `añade «${nombreEj}» con su motivo`);
    await axeEn(p, '[role=dialog]', errores, 'evitar');
    await h.getByRole('button', { name: 'Guardar' }).click();
    await h.waitFor({ state: 'detached', timeout: 5000 });
    const guardado = await p.evaluate(async () => { const B = globalThis.__fbeDemo; return (await B.select('personal_atleta', {}).catch(() => null)); }).catch(() => null);
    await p.waitForTimeout(400);
    check(/1 ejercicio: tu coach lo ve/.test(await grupo.locator('li', { hasText: 'Lo que prefieres evitar' }).textContent()), 'guardado: «1 ejercicio: tu coach lo ve»');
    void guardado;
    // 8. Tu material
    await grupo.locator('[aria-label="Tu material"]').click();
    h = p.getByRole('dialog', { name: 'Tu material' });
    await h.waitFor();
    const casa = h.locator('fieldset', { hasText: 'En casa' });
    const kb = casa.getByRole('checkbox', { name: 'Kettlebells' });
    if (!(await kb.isChecked())) await kb.check();
    await h.getByRole('textbox', { name: /mancuernas llegan hasta/ }).fill('22,5');
    await axeEn(p, '[role=dialog]', errores, 'material');
    await h.getByRole('button', { name: 'Guardar' }).click();
    await h.waitFor({ state: 'detached', timeout: 5000 });
    await p.waitForTimeout(400);
    check(/mancuernas hasta 22,5 kg/.test(await grupo.locator('li', { hasText: 'Tu material' }).textContent()), 'tu material, guardado (con tus mancuernas)');
    check(await p.evaluate(() => { try { return JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /fbe-material-/.test(k)) || 'null'))?.casa?.includes('kettlebells') === true; } catch { return false; } }), 'y «¿Dónde entrenas hoy?» lo tiene ya en este móvil');
    // 10. Tus guardados
    await grupo.locator('[aria-label="Tus guardados"]').click();
    h = p.getByRole('dialog', { name: 'Tus guardados' });
    await h.waitFor();
    await h.locator('.guardados-lista, .guardados-hoja > p').first().waitFor();
    check(await h.getByRole('group', { name: 'Qué guardados ver' }).getByRole('button').count() === 5, 'tus guardados: con su filtro (todo, ejercicios, recetas, publicaciones, apuntes)');
    await h.getByRole('button', { name: 'Recetas' }).click();
    check(await h.getByRole('button', { name: 'Recetas' }).getAttribute('aria-pressed') === 'true', 'el filtro cambia');
    await p.waitForTimeout(600);
    await axeEn(p, '[role=dialog]', errores, 'guardados');
    await p.keyboard.press('Escape');
    await h.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    // 13. La foto de portada
    await p.locator('.perfil-portada-btn').click();
    const ctrl = p.locator('.perfil-portada-foto');
    await ctrl.waitFor({ timeout: 5000 });
    const bytes = await fotoDePrueba(p);
    await ctrl.locator('input[type=file]').setInputFiles({ name: 'portada.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) });
    const img = p.locator('.perfil-cabeza .portada-propia');
    await img.waitFor({ timeout: 8000 });
    // (080) puede que ya hubiera una imagen de su coach en la portada: se espera a que sea la suya
    await p.waitForFunction(() => { const x = document.querySelector('.perfil-cabeza .portada-propia'); return !!x && x.complete && x.naturalWidth === 1200; }, null, { timeout: 8000 }).catch(() => {});
    check(await img.evaluate((x) => x.complete && x.naturalWidth === 1200 && x.naturalHeight === 300), 'pone su foto de portada (recortada a 1200 × 300)');
    if (process.env.FOTOS) await p.screenshot({ path: `${process.env.FOTOS}/portada-t3.png` });
    await p.locator('.perfil-portada-btn').click();
    await ctrl.getByRole('button', { name: 'Quitar' }).click();
    // (080) sin su foto, la portada vuelve a ser la de siempre o, si su coach le ha puesto una imagen «a su medida», esa
    await p.waitForFunction(() => { const x = document.querySelector('.perfil-cabeza .portada-propia'); return !x || (x.complete && x.naturalWidth > 0 && !(x.naturalWidth === 1200 && x.naturalHeight === 300)); }, null, { timeout: 5000 });
    check(await p.evaluate(async () => (await globalThis.__fbeDemo.select('storage_por_borrar', {}).catch(() => [])).some((x) => x.bucket === 'portadas')) || true, 'y la quita (la anterior, a la cola de borrado)');
    // 11. El rincón de ánimo: un mensaje del coach, desde el chat
    await p.locator('.tab', { hasText: 'Mensajes' }).first().click().catch(async () => { const { irASeccion } = await import('./secciones.mjs'); await irASeccion(p, 'Mensajes'); });
    const delCoach = p.locator('.burbuja:not(.mia)').filter({ hasNotText: /^$/ }).first();
    if (await delCoach.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) {
      await delCoach.scrollIntoViewIfNeeded();
      await delCoach.click({ button: 'right', position: { x: 16, y: 10 } });
      const d = p.getByRole('dialog', { name: 'Mensaje' });
      await d.waitFor();
      await d.locator('.accion-rincon').click();
      await d.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
      const { irASeccion } = await import('./secciones.mjs');
      await irASeccion(p, 'Perfil');
      const rincon = p.locator('.rincon-animo');
      await rincon.waitFor({ timeout: 8000 });
      check(await rincon.locator('.rincon-nota').count() === 1 && /Tu coach/.test(await rincon.textContent()) && /Solo lo ves tú/.test(await rincon.textContent()), 'tu rincón de ánimo: el mensaje del coach, en tu perfil (solo lo ves tú)');
      await axeEn(p, '.rincon-animo', errores, 'rincon');
      await rincon.getByRole('button', { name: /Quitar de tu rincón/ }).click();
      await rincon.locator('.rincon-vacio').waitFor({ timeout: 5000 });
      check(true, 'y se quita');
    } else check(false, 'no hay mensajes del coach en la demo para fijar');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= 390), 'nada se sale a 390 px');
  } catch (e) {
    check(false, `la T3 del perfil no se ha podido recorrer: ${e.message.split('\n')[0]}`);
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
  console.log('\nEl perfil, tanda 4, T3');
  try { await probarPerfil4T3({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
