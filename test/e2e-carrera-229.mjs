// v0.229: carrera, mejoras 16 y 17 (el día de la carrera y después), en la demo con Carlos. Lo llama e2e.test.mjs.
//   · Carlos (390 px): con su carrera en 3 días, en «Tu carrera», «Tu plan para el día»: calentar, el ritmo con sus pasos y
//     lo demás; con 30 °C a la salida, el aviso de no buscar marca. Sin desbordes.
//   · El coach (1280 px): la semana de la carrera, lo que verá; con una media hecha hace 5 días, su resultado frente a lo
//     previsto, «Actualizar su ritmo umbral» y «Poner la recuperación en su plan» (y después, «ya está en su plan»).
import { devices } from 'playwright';
import { hoyISO, sumarDias } from '../web/src/logica/fechas.js';

export async function probarCarrera229({ navegador, check, base = 'http://localhost:4174' }) {
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
  const hoy = hoyISO();
  // (en la demo guardada: su próxima carrera en 3 días con objetivo de 50 min y, si se pide, una media hecha hace 5 días)
  const preparar = (p, conMedia) => p.evaluate(([en3, hace5, conMedia]) => {
    const db = JSON.parse(localStorage.getItem('fbe-demo-v2') || 'null');
    const carlos = db?.atletas?.find((a) => /Carlos/.test(a.nombre));
    if (!carlos) return false;
    const evs = db.carrera_eventos.filter((e) => e.atleta_id === carlos.id);
    const prox = evs.find((e) => e.distancia_km && e.decision !== 'no' && !e.resultado_seg) || evs[0];
    if (!prox) return false;
    Object.assign(prox, { fecha: en3, distancia_km: 10, objetivo_seg: 3000, decision: 'va' });
    if (conMedia) db.carrera_eventos.push({ id: '00000000-0000-4000-8000-0000000c0229', atleta_id: carlos.id, nombre: 'Media de otoño', fecha: hace5, distancia_km: 21.0975, desnivel_m: null,
      prioridad: 'B', decision: 'va', objetivo_seg: null, objetivo_ritmo: null, nota: null, resultado_seg: 6600, resultado_nota: null, creado_en: new Date().toISOString() });
    localStorage.setItem('fbe-demo-v2', JSON.stringify(db));
    return true;
  }, [sumarDias(hoy, 3), sumarDias(hoy, -5), conMedia]);
  const entrar = async (p, quien) => {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: quien }).first().click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1000);
    await cerrar(p);
  };
  const recargar = async (p, quien) => {
    await p.reload();
    if (!(await p.locator('nav.tabs').waitFor({ timeout: 8000 }).then(() => true).catch(() => false))) await entrar(p, quien);
    await p.waitForTimeout(1000);
    await cerrar(p);
  };

  // 1) Carlos: su plan para el día
  const ctxM = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await iniciar(ctxM);
  const pm = await ctxM.newPage();
  vigilar(pm);
  await entrar(pm, /Carlos/);
  check(await preparar(pm, false), 'la demo de Carlos, con su carrera en 3 días');
  await recargar(pm, /Carlos/);
  await pm.locator('.tarjeta-carrera-hoy').first().click();
  const plan = pm.locator('.plan-dia');
  const hay = await plan.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  const tx = hay ? await plan.textContent() : '';
  check(hay && /Tu plan para el día/.test(tx) && /Calentar/.test(tx) && /10-15 minutos suaves/.test(tx) && /5:00 min\/km, para 50:00/.test(tx) && /Analgésicos/.test(tx),
    'en «Tu carrera», la semana de la carrera: su plan para el día (calentar, el ritmo de su objetivo, comer, beber, cafeína, analgésicos y si va mal)');
  if (hay) {
    await plan.locator('summary').first().click();
    check(await plan.locator('.pd-tabla li').count() === 10, 'sus pasos, km a km');
    await plan.getByLabel(/Temperatura prevista/).fill('30');
    await pm.waitForTimeout(300);
    check(/no es día de buscar marca/.test(await plan.textContent()), 'con 30 °C a la salida: hoy, sin buscar marca');
    await desborda(pm, 'el plan del día en el móvil');
  }
  await ctxM.close();

  // 2) El coach: la semana de la carrera y después de la media
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await iniciar(ctx);
  const p = await ctx.newPage();
  vigilar(p);
  await entrar(p, /Pelayo/);
  check(await preparar(p, true), 'la demo del coach, con la carrera en 3 días y una media hecha hace 5');
  await recargar(p, /Pelayo/);
  await p.locator('.tab', { hasText: 'Atletas' }).first().click();
  await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Carlos Vera' }).first().click();
  await p.getByRole('tab', { name: /Carrera/ }).first().click();
  const cd = p.locator('.carrera-dia');
  const sale = await cd.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  const t = sale ? await cd.textContent() : '';
  check(sale && /Su carrera: /.test(t) && /plan para el día: a 5:00 min\/km, para 50:00/.test(t) && /Hizo 1:50:00/.test(t) && /Recuperación:/.test(t) && /Una semana suave, sin calidad/.test(t),
    'el coach ve lo que verá el día y, de la media de hace 5 días, su resultado y la recuperación propuesta');
  if (sale) {
    await cd.getByRole('button', { name: 'Actualizar su ritmo umbral' }).click();
    await p.getByText('Ritmo umbral actualizado').first().waitFor({ timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(800);
    const umbral = await p.locator('.carrera-zonas input[placeholder="5:10-5:20"]').inputValue();
    check(/^\d:\d\d-\d:\d\d$/.test(umbral), `«Actualizar su ritmo umbral» lo deja en sus zonas (${umbral})`);
    await cd.getByRole('button', { name: 'Poner la recuperación en su plan' }).click();
    await cd.getByText('La recuperación ya está en su plan').waitFor({ timeout: 8000 }).catch(() => {});
    check(await cd.getByText('La recuperación ya está en su plan').count() === 1 && await p.locator('.semana-carrera', { hasText: 'Recuperación' }).count() >= 1,
      '«Poner la recuperación en su plan»: la semana de recuperación entra en su plan');
    await desborda(p, 'la ficha con el día de la carrera');
  }
  await ctx.close();
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}
