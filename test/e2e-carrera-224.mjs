// v0.224: carrera, mejora 13 (el modo guiado de series), en la demo con Carlos (390 px). Lo llama e2e.test.mjs.
//   · En su sesión de calidad (Umbral, por partes), «Guiarme por las partes» abre el guiado: la lista de tramos y «Empezar».
//   · Al empezar: «Tramo 1 de N», «Calentar» y el reloj que va hacia atrás; «Pausa» lo para y «Seguir» lo sigue; saltar
//     lleva al tramo siguiente. Escape sale. Sin errores ni desbordes (también en oscuro).
import { devices } from 'playwright';
import { tramosGuiados } from '../web/src/logica/carrera-guiada.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';

export async function probarCarrera224({ navegador, check, base = 'http://localhost:4174' }) {
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
  // Los tramos que debería tener su «Umbral 2 × 6 min» de esta semana (el de la demo)
  const db = semillaDemo();
  const umbral = (db.sesiones || []).find((s) => s.nombre === 'Umbral 2 × 6 min' && !s.completada && s.cardio?.partes);
  const n = umbral ? tramosGuiados(umbral.cardio).length : 0;

  const ctx = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce', colorScheme: 'dark' });
  await ctx.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* sin almacenamiento */ } });
  const p = await ctx.newPage();
  vigilar(p);
  await p.goto(`${base}/?demo`);
  await p.getByRole('button', { name: /Carlos/ }).first().click();
  await p.locator('nav.tabs').waitFor({ timeout: 30000 });
  await p.waitForTimeout(1200);
  await cerrar(p);
  await p.locator('nav.tabs').getByRole('button', { name: /^Semana/ }).first().click();
  await p.waitForTimeout(1000);
  await cerrar(p);
  await p.locator('.semana-vista .semana-dias .dia', { hasText: /Umbral/ }).first().click();
  const abrir = p.getByRole('button', { name: 'Guiarme por las partes' });
  await abrir.waitFor({ timeout: 10000 });
  await abrir.click();
  const guia = p.locator('.gser');
  await guia.waitFor();
  check(n > 3 && await guia.locator('.gser-lista li').count() === n && /tramos/.test(await guia.locator('.gser-que').textContent()), `el guiado: la lista de sus ${n} tramos antes de empezar`);
  await guia.getByRole('button', { name: 'Empezar' }).click();
  await guia.locator('.gser-n', { hasText: `Tramo 1 de ${n}` }).waitFor();
  const t1 = await guia.locator('.gser-reloj').textContent();
  await p.waitForTimeout(2200);
  const t2 = await guia.locator('.gser-reloj').textContent();
  check(/Calentar/.test(await guia.locator('.gser-que').textContent()) && /^\d+:\d\d$/.test(t1) && t2 !== t1, `al empezar: «Tramo 1 de ${n}», «Calentar» y el reloj hacia atrás (${t1} → ${t2})`);
  await guia.getByRole('button', { name: /Pausa/ }).click();
  const p1 = await guia.locator('.gser-reloj').textContent();
  await p.waitForTimeout(1500);
  check(await guia.locator('.gser-reloj').textContent() === p1 && await guia.getByRole('button', { name: /Seguir/ }).count() === 1, '«Pausa» para el reloj y el botón pasa a «Seguir»');
  await guia.getByRole('button', { name: /Seguir/ }).click();
  await guia.getByRole('button', { name: 'Saltar al siguiente tramo' }).click();
  check(await guia.locator('.gser-n', { hasText: `Tramo 2 de ${n}` }).count() === 1, 'saltar lleva al tramo siguiente');
  await desborda(p, 'el guiado a 390 px en oscuro');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  check(await p.locator('.gser').count() === 0, 'Escape sale del guiado');
  await ctx.close();
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}
