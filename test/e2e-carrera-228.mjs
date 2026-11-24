// v0.228: carrera, tanda 2 de la revisión del experto, en la demo con Carlos. Lo llama e2e.test.mjs.
//   · El coach (1280 px): en su ficha, pestaña Carrera, «Salud para correr»: con enfermedad o síntomas y sin el visto bueno
//     médico, el aviso de que no hay test de 30 min, Z5 ni carreras; con un fármaco que cambia el pulso (guardado), sus
//     zonas de «Zonas y test» van por esfuerzo, sin la columna de FC.
//   · Carlos (390 px): tras su tirada larga de ayer, en Hoy «¿Cómo te has levantado?»; con 4/10 en un punto del hueso de la
//     espinilla, «Puede ser el hueso» (rojo). Su coach lo ve en «Avisos y ajuste» y en «Lo último que ha corrido».
//   · Sin errores ni desbordes.
import { devices } from 'playwright';
import { hoyISO, sumarDias } from '../web/src/logica/fechas.js';

export async function probarCarrera228({ navegador, check, base = 'http://localhost:4174' }) {
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
  const entrarComo = async (p, quien) => {
    for (let intento = 0; intento < 3; intento++) {
      await cerrar(p);
      const cambiar = p.getByRole('button', { name: 'Cambiar de cuenta' });
      if (await cambiar.count()) await cambiar.first().click().catch(() => {});
      else if (!(await p.locator('button.persona').count())) await p.goto(`${base}/?demo`);
      const boton = p.locator('button.persona', { hasText: quien }).first();
      if (await boton.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) { await boton.click(); break; }
    }
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1000);
    await cerrar(p);
  };
  const abrirCarlos = async (p) => {
    await p.locator('.tab', { hasText: 'Atletas' }).first().click();
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Carlos Vera' }).first().click();
    await p.getByRole('tab', { name: /Carrera/ }).first().click();
    await p.locator('.carrera-ficha').waitFor({ timeout: 15000 });
  };

  // 1) El coach: «Salud para correr»
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await iniciar(ctx);
  const p = await ctx.newPage();
  vigilar(p);
  await p.goto(`${base}/?demo`);
  await entrarComo(p, /Pelayo/);
  await abrirCarlos(p);
  const salud = p.locator('.carrera-salud');
  await salud.waitFor({ timeout: 15000 });
  check((await salud.locator('h2').textContent()).trim() === 'Salud para correr' && await salud.getByRole('button', { name: 'Guardar' }).count() === 1,
    'en su pestaña Carrera, «Salud para correr» (la ficha de salud para correr)');
  await salud.getByLabel(/Enfermedad del corazón/).check();
  const bloqueo = salud.locator('.cs-bloqueo');
  check(await bloqueo.isVisible() && /nada de test de 30 minutos, de Z5 ni de carreras/.test(await bloqueo.textContent()), 'con enfermedad o síntomas y sin el visto bueno médico: ni test, ni Z5, ni carreras');
  await salud.getByLabel('Visto bueno médico para correr').fill(sumarDias(hoyISO(), -3));
  check(!(await bloqueo.count()), 'con la fecha del visto bueno, el aviso se va');
  await salud.getByLabel(/Enfermedad del corazón/).uncheck();
  await salud.getByLabel(/fármaco que cambia el pulso/).check();
  await salud.getByLabel('Último cambio de dosis').fill(hoyISO());
  await salud.getByRole('button', { name: 'Guardar' }).click();
  await p.getByText('Salud para correr guardada').first().waitFor({ timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const cab = (await p.locator('.carrera-zonas .tabla-zonas thead th').allTextContents()).join('|');
  check(/Esfuerzo \(0-10\)/.test(cab) && !cab.split('|').includes('FC') && /esfuerzo y el test del habla/.test(await salud.textContent()),
    `con un fármaco que cambia el pulso (guardado), sus zonas van por esfuerzo y el test del habla (${cab})`);
  await desborda(p, 'la ficha con «Salud para correr»');
  await ctx.close();

  // 2) Carlos: la mañana siguiente
  const ctxM = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await iniciar(ctxM);
  const pm = await ctxM.newPage();
  vigilar(pm);
  await pm.goto(`${base}/?demo`);
  await entrarComo(pm, /Carlos Vera/);
  // (en la demo guardada, su última salida pasa a ayer y a tirada larga: así toca la pregunta de esta mañana)
  await pm.waitForTimeout(800);
  const movida = await pm.evaluate((ayer) => {
    const db = JSON.parse(localStorage.getItem('fbe-demo-v2') || 'null');
    const carlos = db?.atletas?.find((a) => /Carlos/.test(a.nombre));
    if (!carlos) return false;
    const bl = new Set(db.bloques.filter((b) => b.atleta_id === carlos.id).map((b) => b.id));
    const ws = new Set(db.semanas.filter((w) => bl.has(w.bloque_id)).map((w) => w.id));
    const s = db.sesiones.filter((x) => ws.has(x.semana_id) && x.completada && x.cardio_hecho?.modalidad === 'carrera').sort((a, b) => (a.fecha_realizada < b.fecha_realizada ? 1 : -1))[0];
    if (!s) return false;
    s.fecha_realizada = ayer;
    s.cardio = { ...(s.cardio || {}), modalidad: 'carrera', tipo: 'larga' };
    localStorage.setItem('fbe-demo-v2', JSON.stringify(db));
    return true;
  }, sumarDias(hoyISO(), -1));
  check(movida, 'la demo de Carlos, con una tirada larga ayer');
  await pm.reload();
  if (!(await pm.locator('nav.tabs').waitFor({ timeout: 8000 }).then(() => true).catch(() => false))) await entrarComo(pm, /Carlos Vera/);
  await pm.waitForTimeout(1000);
  await cerrar(pm);
  const m = pm.locator('.cm-manana');
  const sale = await m.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check(sale && /¿Cómo te has levantado\?/.test(await m.textContent()), 'en Hoy, tras su tirada larga de ayer: «¿Cómo te has levantado?»');
  if (sale) {
    await m.scrollIntoViewIfNeeded();
    await m.locator('input[type="range"]').evaluate((e) => { e.value = '4'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await m.getByRole('group', { name: 'Comparado con antes de salir' }).getByRole('button', { name: 'Peor' }).click();
    await m.locator('select').selectOption('tibia');
    await m.getByLabel(/punto concreto del hueso/).check();
    await desborda(pm, 'la pregunta de la mañana en el móvil');
    await m.getByRole('button', { name: 'Guardar' }).click();
    const rojo = await pm.locator('.cm-manana[data-nivel="rojo"]').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    check(rojo && /Puede ser el hueso/.test(await pm.locator('.cm-manana').textContent()), 'con 4/10 en un punto del hueso de la espinilla: «Puede ser el hueso» (no corras hoy)');

    // 3) Su coach lo ve
    await entrarComo(pm, /Pelayo/);
    await abrirCarlos(pm);
    const av = pm.locator('.carrera-avisos');
    const hay = await av.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(hay && /Puede ser el hueso/.test(await av.textContent()), 'su coach lo ve en «Avisos y ajuste»: puede ser el hueso, parar y valorar');
    const ult = pm.locator('.ch-manana').first();
    check(await ult.count() === 1 && /peor que antes de salir/.test(await ult.textContent()) && await ult.getAttribute('data-nivel') === 'rojo',
      'y en «Lo último que ha corrido», cómo se levantó tras esa salida');
    await desborda(pm, 'la ficha de Carlos en el móvil');
  }
  await ctxM.close();
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}
