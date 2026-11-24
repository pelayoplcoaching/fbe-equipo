// v0.230: el atleta apunta el resultado de su carrera (migración 090), en la demo con Carlos (390 px). Lo llama
// e2e.test.mjs.
//   · Con una carrera de hace 2 días sin resultado, en «Tu carrera»: «¿Cuánto hiciste en …?»; un tiempo mal escrito da el
//     error; con 48:30, «Hiciste 48:30» y su objetivo. Sin errores ni desbordes.
import { devices } from 'playwright';
import { hoyISO, sumarDias } from '../web/src/logica/fechas.js';

export async function probarCarrera230({ navegador, check, base = 'http://localhost:4174' }) {
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
  const ctx = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* sin almacenamiento */ } });
  const p = await ctx.newPage();
  vigilar(p);
  const entrar = async () => {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Carlos/ }).first().click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1000);
    await cerrar(p);
  };
  await entrar();
  // (en la demo guardada: su próxima carrera pasa a hace 2 días, sin resultado y con objetivo de 50 min)
  const movida = await p.evaluate((hace2) => {
    const db = JSON.parse(localStorage.getItem('fbe-demo-v2') || 'null');
    const carlos = db?.atletas?.find((a) => /Carlos/.test(a.nombre));
    if (!carlos) return null;
    const evs = db.carrera_eventos.filter((e) => e.atleta_id === carlos.id);
    const ev = evs.find((e) => e.distancia_km && e.decision !== 'no' && !e.resultado_seg) || evs[0];
    if (!ev) return null;
    Object.assign(ev, { fecha: hace2, distancia_km: 10, objetivo_seg: 3000, decision: 'va', resultado_seg: null, resultado_nota: null });
    localStorage.setItem('fbe-demo-v2', JSON.stringify(db));
    return ev.nombre;
  }, sumarDias(hoyISO(), -2));
  check(!!movida, `la demo de Carlos, con «${movida}» hace 2 días y sin resultado`);
  await p.reload();
  if (!(await p.locator('nav.tabs').waitFor({ timeout: 8000 }).then(() => true).catch(() => false))) await entrar();
  await p.waitForTimeout(1000);
  await cerrar(p);
  await p.locator('.tarjeta-carrera-hoy').first().click();
  const caja = p.locator('.res-carrera');
  const sale = await caja.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check(sale && /¿Cuánto hiciste en /.test(await caja.textContent()), 'en «Tu carrera»: «¿Cuánto hiciste en …?»');
  if (sale) {
    await caja.getByLabel('Tu tiempo').fill('mucho');
    await caja.getByRole('button', { name: 'Apuntar mi resultado' }).click();
    await caja.locator('.error').waitFor({ timeout: 5000 }).catch(() => {});
    check(/1:52:30 o 48:10/.test(await caja.textContent()), 'un tiempo mal escrito: cómo se escribe');
    await caja.getByLabel('Tu tiempo').fill('48:30');
    await caja.getByLabel(/Cómo fue/).fill('Con viento');
    await caja.getByRole('button', { name: 'Apuntar mi resultado' }).click();
    const hecho = await p.locator('.res-carrera', { hasText: 'Hiciste' }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(hecho && /Hiciste 48:30/.test(await p.locator('.res-carrera').textContent()) && /tu objetivo, 50:00/.test(await p.locator('.res-carrera').textContent()),
      'con 48:30: «Hiciste 48:30» y su objetivo (su coach ya lo ve)');
    await desborda(p, 'el resultado en «Tu carrera»');
  }
  await ctx.close();
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}
