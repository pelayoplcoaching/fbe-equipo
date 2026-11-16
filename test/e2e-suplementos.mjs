// Los suplementos de cada atleta (rama suplementos-1, migración 077), en la demo y en un móvil de 390 px:
//   · el coach le pauta la creatina de la lista de FBE a Iván, ajustando la dosis
//   · Iván la ve en Hoy, la marca con un toque (y sigue marcada), añade los suyos, se pone un aviso y quita el suyo
//   · el coach ve en la ficha lo que marca, su aviso y lo que añadió él
//   Suelta:  npm run build && node test/e2e-suplementos.mjs
import { axeEn } from './e2e-perfil4-t1.mjs';

export async function probarSuplementos({ navegador, check, base = 'http://localhost:4174' }) {
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
  const tarjeta = p.locator('.tarjeta-suplementos');
  try {
    await p.goto(`${base}/?demo`);
    await entrarComo('Iván');
    await p.locator('.cabecera').first().waitFor();
    await p.waitForTimeout(1200);
    check(await tarjeta.count() === 0, 'sin suplementos, en Hoy no sale nada');

    await entrarComo('Pelayo');
    await pestana('Atletas');
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Iván Prieto' }).first().click();
    await p.getByRole('tab', { name: 'Seguimiento' }).first().click();
    const sec = p.locator('.suplementos-coach');
    await sec.waitFor({ timeout: 10000 });
    await sec.scrollIntoViewIfNeeded();
    check(/No toma ninguno/.test(await sec.textContent()), 'en la ficha, el coach ve que no toma ninguno');
    await sec.getByRole('button', { name: 'Pautar' }).click();
    let d = p.getByRole('dialog', { name: 'Pautar suplemento' });
    await d.waitFor();
    await d.getByRole('button', { name: 'Creatina monohidrato' }).click();
    check(await d.locator('#sc-nombre').inputValue() === 'Creatina monohidrato' && await d.locator('#sc-dosis').inputValue() === '3-5 g al día', 'de la lista de FBE: con su dosis habitual, para ajustarla');
    await axeEn(p, '[role=dialog]', errores, 'pautar suplemento');
    await d.locator('#sc-dosis').fill('5 g al día');
    await d.getByRole('button', { name: 'Pautar', exact: true }).click();
    await d.waitFor({ state: 'hidden', timeout: 8000 });
    const filaC = sec.locator('.suplemento-coach-fila', { hasText: 'Creatina monohidrato' });
    await filaC.waitFor({ timeout: 8000 });
    check(/5 g al día/.test(await filaC.textContent()), 'y queda pautado con la dosis que puso');

    await entrarComo('Iván');
    await tarjeta.waitFor({ timeout: 10000 });
    await tarjeta.scrollIntoViewIfNeeded();
    const fila = tarjeta.locator('.suplemento-fila', { hasText: 'Creatina monohidrato' });
    check(/Te queda 1/.test(await tarjeta.textContent()) && await fila.getAttribute('aria-pressed') === 'false' && /5 g al día/.test(await fila.textContent()), 'al atleta le sale en Hoy, con su dosis: «Te queda 1»');
    await axeEn(p, '.tarjeta-suplementos', errores, 'tarjeta de suplementos');
    await fila.click();
    await p.waitForTimeout(600);
    check(await fila.getAttribute('aria-pressed') === 'true' && /Hecho por hoy/.test(await tarjeta.textContent()), 'lo marca con un toque: «Hecho por hoy»');
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await tarjeta.waitFor({ timeout: 10000 });
    check(await tarjeta.locator('.suplemento-fila').first().getAttribute('aria-pressed') === 'true', 'y sigue marcado al volver a abrir la app');
    await tarjeta.getByRole('button', { name: 'Añadir, quitar o poner un aviso' }).click();
    d = p.getByRole('dialog', { name: 'Tus suplementos' });
    await d.waitFor();
    check(/Te lo ha pautado tu coach/.test(await d.textContent()) && await d.getByRole('button', { name: 'Quitar Creatina monohidrato' }).count() === 0, 'en su hoja, el del coach no se puede quitar ni cambiar');
    await d.getByRole('button', { name: /^Magnesio/ }).click();
    await d.locator('.suplementos-mios li', { hasText: 'Magnesio' }).waitFor({ timeout: 8000 });
    check(await d.locator('.suplementos-mios li').count() === 2 && await d.getByRole('button', { name: 'Quitar Magnesio' }).count() === 1, 'añade el suyo de la lista de FBE');
    await axeEn(p, '[role=dialog]', errores, 'hoja de suplementos');
    const hora = d.locator('.suplementos-mios li', { hasText: 'Creatina' }).locator('input[type=time]');
    await hora.fill('08:30');
    await hora.blur();
    await d.getByRole('button', { name: 'Quitar aviso' }).waitFor({ timeout: 8000 });
    check(await hora.inputValue() === '08:30' && /hora de España/.test(await d.textContent()), 'se pone un aviso al móvil a su hora, también en el que le pautó su coach');
    await d.getByRole('button', { name: 'Quitar Magnesio' }).click();
    await p.waitForTimeout(900);
    check(await d.locator('.suplementos-mios li').count() === 1, 'y quita el que añadió él');
    await d.getByRole('button', { name: 'Añadir otro' }).click();
    const d2 = p.getByRole('dialog', { name: 'Añadir suplemento' });
    await d2.waitFor();
    await d2.locator('#su-nombre').fill('Zinc');
    await d2.locator('#su-dosis').fill('15 mg');
    await d2.getByRole('button', { name: 'Añadir', exact: true }).click();
    d = p.getByRole('dialog', { name: 'Tus suplementos' });
    await d.locator('.suplementos-mios li', { hasText: 'Zinc' }).waitFor({ timeout: 8000 });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
    check(await tarjeta.locator('.suplemento-fila').count() === 2 && /Te queda 1/.test(await tarjeta.textContent()), 'o uno con sus palabras: sale en Hoy para marcarlo');

    await entrarComo('Pelayo');
    await pestana('Atletas');
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Iván Prieto' }).first().click();
    await p.getByRole('tab', { name: 'Seguimiento' }).first().click();
    await sec.waitFor({ timeout: 10000 });
    await sec.locator('.suplemento-coach-fila', { hasText: 'Zinc' }).waitFor({ timeout: 8000 });
    const t = await sec.textContent();
    check(/aviso a las 08:30/.test(t) && /1\/1/.test(t) && /lo añadió él/.test(t), 'el coach ve que lo ha marcado hoy (1/1), su aviso y lo que añadió él');
    await sec.scrollIntoViewIfNeeded();
    await axeEn(p, '.suplementos-coach', errores, 'suplementos en la ficha');
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
  await probarSuplementos({ navegador, check });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
