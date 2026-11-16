// Los objetivos que propone el atleta (rama objetivos-1, migración 076), en la demo y en un móvil de 390 px:
//   · quien ya contestó en este bloque (Ana) no ve la tarjeta en Hoy; Iván, que no ha contestado, sí
//   · Iván contesta el cuestionario (una marca de fuerza y otra cosa), lo ve esperando en Progreso y retira una
//   · al coach le llega a Revisar: la contesta ajustando los kilos, con una nota, y sale el objetivo en la ficha
//   · Iván ve la respuesta de su coach y su objetivo nuevo («Lo propusiste tú»)
//   · «Ahora no» esconde la tarjeta
//   Suelta:  npm run build && node test/e2e-objetivos.mjs
import { axeEn } from './e2e-perfil4-t1.mjs';
import { subProgreso } from './secciones.mjs';

export async function probarObjetivos({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid', bypassCSP: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const entrarComo = async (quien) => {
    await p.waitForTimeout(600); // la demo guarda en el navegador con 150 ms de margen: cambiar de cuenta antes lo perderia
    for (let intento = 0; intento < 3; intento++) {
      await cerrarDialogos();
      const cambiar = p.getByRole('button', { name: 'Cambiar de cuenta' });
      if (await cambiar.count()) await cambiar.first().click().catch(() => {});
      else if (!(await p.locator('button.persona').count())) await p.goto(`${base}/?demo`);
      const boton = p.locator('button.persona', { hasText: quien }).first();
      if (await boton.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) { await boton.click(); break; }
    }
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(800);
    await cerrarDialogos();
  };
  const pestana = async (nombre) => { await p.locator('nav.tabs .tab', { hasText: nombre }).first().click(); await p.waitForTimeout(500); };
  const tarjeta = p.locator('.tarjeta-objetivos');
  try {
    await p.goto(`${base}/?demo`);
    await entrarComo('Ana');
    await p.locator('.cabecera').first().waitFor();
    await p.waitForTimeout(1200);
    check(await tarjeta.count() === 0, 'quien ya contestó en este bloque no ve la tarjeta en Hoy');

    await entrarComo('Iván');
    await tarjeta.waitFor({ timeout: 10000 });
    check(/Qué quieres conseguir/.test(await tarjeta.textContent()), 'a quien no ha contestado le sale en Hoy «¿Qué quieres conseguir?»');
    await tarjeta.getByRole('button', { name: 'Contestar' }).click();
    let d = p.getByRole('dialog', { name: 'Tus objetivos' });
    await d.waitFor();
    const opciones = d.locator('.opciones-objetivo button');
    check(await opciones.count() >= 2 && /Paso 1 de 1/.test(await d.textContent()), 'el cuestionario empieza por qué quiere conseguir (una cosa o varias)');
    await d.getByRole('button', { name: 'Siguiente' }).click();
    check(/Elige al menos una cosa/.test(await d.locator('[role=alert]').textContent().catch(() => '')), 'sin elegir nada no avanza (o dice que sigue igual)');
    await d.getByRole('button', { name: /Una marca de fuerza/ }).click();
    await d.getByRole('button', { name: /Otra cosa/ }).click();
    check(/Paso 1 de 3/.test(await d.textContent()), 'un paso por cada cosa elegida');
    await axeEn(p, '[role=dialog]', errores, 'cuestionario de objetivos');
    await d.getByRole('button', { name: 'Siguiente' }).click();
    const ej = d.locator('#ob-ej');
    await ej.waitFor();
    for (let i = 0; i < 40 && await ej.locator('option').count() < 2; i++) await p.waitForTimeout(200);
    await d.getByRole('button', { name: 'Siguiente' }).click();
    check(/Elige el ejercicio/.test(await d.locator('[role=alert]').textContent().catch(() => '')), 'la marca pide su ejercicio');
    const nombres = await ej.locator('option').allTextContents();
    const elegido = nombres.find((n) => /sentadilla|press banca|peso muerto/i.test(n)) || nombres[1];
    await ej.selectOption({ label: elegido });
    await d.locator('#ob-kg').fill('120'); await d.locator('#ob-kg').blur();
    await d.locator('#ob-reps').fill('3'); await d.locator('#ob-reps').blur();
    await d.locator('#ob-porque').fill('Mi número redondo');
    await p.waitForTimeout(300);
    check(/1RM estimado/.test(await d.textContent()), 'con su 1RM estimado de ahora o el que supone la marca');
    await axeEn(p, '[role=dialog]', errores, 'paso de fuerza');
    await d.getByRole('button', { name: 'Siguiente' }).click();
    await d.locator('#ob-libre').fill('Hacer mi primera dominada');
    await d.getByRole('button', { name: 'Enviar a tu coach' }).click();
    d = p.getByRole('dialog', { name: 'Enviado a tu coach' });
    await d.waitFor({ timeout: 8000 });
    check(/tus 2 objetivos/.test(await d.textContent()), 'al enviarlo: «Tu coach ya tiene tus 2 objetivos»');
    await d.getByRole('button', { name: 'Hecho' }).click();
    await p.waitForTimeout(500);
    check(await tarjeta.count() === 0, 'y la tarjeta de Hoy desaparece');

    await pestana('Progreso');
    await subProgreso(p, 'logros');
    const filas = p.locator('.propuesta-fila');
    await filas.first().waitFor({ timeout: 8000 });
    check(await filas.count() === 2 && /Esperando a tu coach/.test(await filas.first().textContent()) && (await filas.first().textContent()).includes(`${elegido} 120 kg × 3`), 'en Progreso ve sus dos propuestas esperando a su coach');
    await p.locator('.seccion-objetivos').scrollIntoViewIfNeeded();
    await axeEn(p, '.seccion-objetivos', errores, 'propuestas en Progreso');
    await filas.nth(1).getByRole('button', { name: /Retirar/ }).click();
    await p.waitForTimeout(800);
    check(await filas.count() === 1, 'retira la que quiera mientras espera');

    await entrarComo('Pelayo');
    await pestana('Revisar');
    const chip = p.getByRole('group', { name: 'Qué revisar' }).getByRole('button', { name: /Objetivos \(1\)/ });
    await chip.waitFor({ timeout: 10000 });
    await chip.click();
    const tr = p.locator('.tarjeta-revisar', { hasText: 'Propone un objetivo' });
    await tr.waitFor({ timeout: 5000 });
    check(/Iván/.test(await p.locator('.rejilla-revisar').textContent()) && (await tr.textContent()).includes('120 kg × 3') && /Mi número redondo/.test(await tr.textContent()), 'al coach le llega a Revisar: quién, qué y por qué');
    await tr.getByRole('button', { name: 'Contestar' }).click();
    d = p.getByRole('dialog', { name: 'Objetivo propuesto' });
    await d.waitFor();
    check(await d.locator('#pr-kg').inputValue() === '120' && await d.locator('#pr-reps').inputValue() === '3', 'su hoja trae lo que pidió, para ajustarlo');
    await axeEn(p, '[role=dialog]', errores, 'hoja de la propuesta');
    await d.locator('#pr-kg').fill('110'); await d.locator('#pr-kg').blur();
    await d.locator('#pr-nota').fill('Primero 110, luego vamos a por 120');
    await d.getByRole('button', { name: 'Aceptar' }).click();
    await d.waitFor({ state: 'hidden', timeout: 8000 });
    await p.waitForTimeout(800);
    check(await p.locator('.tarjeta-revisar', { hasText: 'Propone un objetivo' }).count() === 0, 'al aceptarla sale de Revisar');
    await pestana('Atletas');
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Iván Prieto' }).first().click();
    await p.getByRole('tab', { name: 'Objetivos' }).first().click();
    const fila = p.locator('.objetivo-fila', { hasText: '110 kg × 3' });
    await fila.waitFor({ timeout: 8000 });
    check(/lo propuso el atleta/.test(await fila.textContent()) && /automático/.test(await fila.textContent()), 'y en su ficha está el objetivo, con lo que ajustó el coach (automático; lo propuso el atleta)');

    await entrarComo('Iván');
    await pestana('Progreso');
    await subProgreso(p, 'logros');
    const sec = p.locator('.seccion-objetivos');
    await sec.locator('.objetivo', { hasText: '110 kg × 3' }).waitFor({ timeout: 8000 });
    const texto = await sec.textContent();
    check(/Lo propusiste tú/.test(texto) && /Tu coach lo ha aceptado/.test(texto) && /Primero 110, luego vamos a por 120/.test(texto), 'el atleta ve su objetivo («Lo propusiste tú») y la respuesta de su coach, con su nota');
    await pestana('Hoy');
    await p.waitForTimeout(800);
    check(await tarjeta.count() === 0, 'y, contestado, la tarjeta no vuelve en este bloque');

    // «Ahora no»: en una demo nueva, Iván la esconde (una semana, en ese móvil)
    const ctx2 = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid' });
    try {
      const q = await ctx2.newPage();
      q.on('pageerror', (e) => errores.push(e.message));
      await q.goto(`${base}/?demo`);
      await q.locator('button.persona', { hasText: 'Iván' }).first().click();
      await q.locator('nav.tabs').waitFor();
      for (let i = 0; i < 4; i++) { await q.waitForTimeout(300); if (!(await q.locator('[role=dialog]').last().isVisible().catch(() => false))) break; await q.keyboard.press('Escape'); }
      const t2 = q.locator('.tarjeta-objetivos');
      await t2.waitFor({ timeout: 10000 });
      await t2.getByRole('button', { name: 'Ahora no' }).click();
      await q.waitForTimeout(400);
      const fuera = await t2.count() === 0;
      await q.reload();
      await q.locator('nav.tabs').waitFor();
      await q.waitForTimeout(1500);
      check(fuera && await t2.count() === 0, '«Ahora no» la esconde (y sigue escondida al volver a abrir la app)');
    } finally { await ctx2.close(); }
    check(errores.length === 0, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.slice(0, 3).join(' /// ')}` : ''}`);
  } finally { await ctx.close(); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarObjetivos({ navegador, check });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
