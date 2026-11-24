// v0.221: carrera, tanda 2 de las 20 mejoras, en la demo con Carlos (media maratón de primavera, prioridad A). Lo llama
// e2e.test.mjs.
//   · El asistente de plan (ficha → Carrera → El plan → «Prepararlo con el asistente»): la carrera A ya elegida, los km
//     que ha corrido las 4 últimas semanas ya puestos; con 3 días, la propuesta (las mismas semanas que calcula
//     logica/carrera-plan.js), sus fases y la lista de semanas; avisa de las semanas que se cambian; al guardar, el plan
//     y las semanas nuevas, con la de la carrera al final.
//   · «Rehacer desde esta semana» con la vuelta a correr: las semanas de esta en adelante empiezan andando.
//   · Una semana: «Un 10 % más» que la anterior y «Guardar y repetir» en la siguiente.
//   · En el móvil (360 px, oscuro), la hoja del asistente cabe. Sin errores.
import { devices } from 'playwright';
import { proponerPlan } from '../web/src/logica/carrera-plan.js';
import { hoyISO, lunesDe, sumarDias } from '../web/src/logica/fechas.js';

export async function probarCarrera221({ navegador, check, base = 'http://localhost:4174' }) {
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
  const entrar = async (p) => {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.waitForTimeout(1500);
    await cerrar(p);
    await p.locator('.tab', { hasText: 'Atletas' }).first().click();
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Carlos Vera' }).first().click();
    await p.getByRole('tab', { name: /Carrera/ }).first().click();
    await p.locator('.carrera-plan').waitFor({ timeout: 15000 });
  };

  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await iniciar(ctx);
  const p = await ctx.newPage();
  vigilar(p);
  await entrar(p);

  // 1) El asistente
  await p.getByRole('button', { name: /Prepararlo con el asistente/ }).click();
  let hoja = p.getByRole('dialog', { name: 'Preparar el plan' });
  await hoja.waitFor();
  const carrera = await hoja.locator('select').first().evaluate((s) => s.options[s.selectedIndex].text);
  check(/Media maratón de primavera/.test(carrera), `la carrera A ya elegida (${carrera})`);
  const kmAhora = await hoja.getByLabel('Km por semana ahora').inputValue();
  const ayuda = await hoja.locator('.ayuda').first().textContent();
  check(/las 4 últimas semanas/.test(ayuda), `los km que ha corrido, ya puestos (${kmAhora}: «${ayuda.trim()}»)`);
  await hoja.getByRole('group', { name: 'Días que puede correr' }).getByRole('button', { name: '3', exact: true }).click();
  const larga = await hoja.getByLabel(/salida más larga/).inputValue();
  const esperado = proponerPlan({ evento: { nombre: 'Media maratón de primavera', distancia_km: 21.1, fecha: sumarDias(lunesDe(hoy), 7 * 13 + 6) }, dias: 3,
    kmAhora: Number(String(kmAhora).replace(',', '.')) || 0, largaAhora: Number(String(larga).replace(',', '.')) || null, nivel: 'intermedio', hoy });
  const res = hoja.locator('.asis-res');
  await res.locator('.macro-fase').first().waitFor();
  check(new RegExp(`${esperado.semanas.length} semanas`).test(await res.textContent()) && await res.locator('.macro-fase').count() === esperado.fases.length,
    `la propuesta: ${esperado.semanas.length} semanas en ${esperado.fases.length} fases (${esperado.fases.map((f) => `${f.nombre} ${f.semanas}`).join(', ')})`);
  await res.locator('summary').click();
  const filas = res.locator('.asis-lista li');
  check(await filas.count() === esperado.semanas.length && /Carrera/.test(await filas.last().textContent()) && /Descarga/.test(await res.locator('.asis-lista').textContent()),
    'la lista de semanas, con sus descargas y la de la carrera al final');
  check(/se cambian por estas/.test(await res.textContent()), 'avisa de las semanas que ya tenía y se cambian');
  await desborda(p, 'el asistente a 1280 px');
  await hoja.getByRole('button', { name: 'Guardar el plan' }).click();
  await p.locator('.aviso', { hasText: 'Plan guardado' }).or(p.getByText('Plan guardado: revisa')).first().waitFor({ timeout: 10000 }).catch(() => {});
  await hoja.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  const lista = p.locator('.carrera-semanas .semana-carrera');
  const ultima = lista.last();
  await p.waitForTimeout(800);
  check(await p.locator('.carrera-plan .macro-fase').count() === esperado.fases.length && /Carrera/.test(await ultima.textContent()) && /Media maratón de primavera/.test(await ultima.textContent()),
    'guardado: el macrociclo nuevo y, al final, la semana de la carrera');
  const delPlan = lista.filter({ hasText: /^S\d+/ });
  check(await delPlan.count() === esperado.semanas.length, `las ${esperado.semanas.length} semanas del plan, numeradas`);

  // 2) Rehacer desde esta semana, con la vuelta a correr
  await p.getByRole('button', { name: /Rehacer desde esta semana/ }).click();
  hoja = p.getByRole('dialog', { name: 'Rehacer el plan desde esta semana' });
  await hoja.waitFor();
  await hoja.getByLabel(/Empezar con la vuelta a correr/).check();
  const res2 = hoja.locator('.asis-res');
  await p.waitForTimeout(300);
  check((await res2.locator('.macro-nombre').allTextContents()).some((t) => /Vuelta a correr/.test(t)), 'con la vuelta a correr, el macrociclo empieza por ella');
  await hoja.getByRole('button', { name: 'Guardar desde esta semana' }).click();
  await hoja.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(800);
  const estaSemana = lista.filter({ has: p.locator('.chip', { hasText: 'Vuelta a correr' }) });
  check(await estaSemana.count() >= 3 && /Andar 30 min sin dolor/.test(await lista.filter({ hasText: 'Vuelta a correr' }).first().textContent()),
    'rehecho: esta semana y las siguientes empiezan con la vuelta a correr (andar 30 min sin dolor…)');

  // 3) Una semana (cinco después de esta, ya pasada la vuelta a correr), como la anterior un 10 % más, y repetida en la siguiente
  const iActual = await lista.evaluateAll((l) => l.findIndex((x) => x.classList.contains('actual')));
  const w = iActual + 5;
  await lista.nth(w).locator('.semana-carrera-btn').click();
  hoja = p.getByRole('dialog').last();
  await hoja.locator('.asis-copiar').waitFor();
  await hoja.locator('.asis-copiar').getByRole('button', { name: 'Un 10 % más' }).click();
  const despues = await hoja.getByLabel('Km (mínimo)').inputValue();
  const titulos = await hoja.locator('input[aria-label$=": título"]').evaluateAll((l) => l.map((x) => x.value));
  check(Number(despues.replace(',', '.')) > 0 && titulos.length > 0, `«Un 10 % más» que la anterior: sus sesiones y sus km, un 10 % más (${despues} km como mínimo; ${titulos.join(', ')})`);
  await hoja.getByRole('button', { name: /Guardar y repetir/ }).click();
  await hoja.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(800);
  const texto = async (n) => (await lista.nth(n).locator('.mini.terciario').first().textContent()).trim();
  const t1 = await texto(w), t2 = await texto(w + 1);
  check(t1 === t2 && t1.length > 0, `«Guardar y repetir»: guardada y repetida en la siguiente («${t2}»)`);
  await desborda(p, 'la ficha tras el asistente');
  await ctx.close();

  // 4) En el móvil, la hoja del asistente cabe
  const ctxM = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 360, height: 740 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce', colorScheme: 'dark' });
  await iniciar(ctxM);
  const pm = await ctxM.newPage();
  vigilar(pm);
  await entrar(pm);
  await pm.getByRole('button', { name: /Prepararlo con el asistente/ }).click();
  const hm = pm.getByRole('dialog', { name: 'Preparar el plan' });
  await hm.locator('.asis-res .macro-fase').first().waitFor();
  await hm.locator('.asis-res summary').click();
  await pm.waitForTimeout(300);
  await desborda(pm, 'el asistente a 360 px en oscuro');
  check(await hm.locator('.asis-lista li').first().evaluate((e) => e.getBoundingClientRect().right <= 362), 'en el móvil, la hoja del asistente y su lista de semanas caben');
  await ctxM.close();
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}
