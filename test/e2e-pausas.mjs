// Pausar la asesoría (rama pausa-1, migración 078), en la demo y en un móvil de 390 px:
//   · el coach pone en pausa a Iván desde su ficha (Datos), con motivo, vuelta y un mensaje; sale «En pausa» en el panel
//   · Iván lo ve en Hoy; el coach la termina hoy y todo vuelve a como estaba
//   Suelta:  npm run build && node test/e2e-pausas.mjs
import { axeEn } from './e2e-perfil4-t1.mjs';

export async function probarPausas({ navegador, check, base = 'http://localhost:4174' }) {
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
  const aviso = p.locator('.aviso-pausa');
  const abrirDatos = async () => {
    await pestana('Atletas');
    await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Iván Prieto' }).first().click();
    await p.getByRole('tab', { name: 'Datos' }).first().click();
    await p.locator('.pausa-coach').waitFor({ timeout: 10000 });
  };
  try {
    await p.goto(`${base}/?demo`);
    await entrarComo('Pelayo');
    await abrirDatos();
    const caja = p.locator('.pausa-coach');
    check(/no recibe recordatorios/.test(await caja.textContent()), 'en la ficha (Datos), la pausa de la asesoría, con lo que hace');
    await caja.getByRole('button', { name: 'Poner en pausa' }).click();
    const d = p.getByRole('dialog', { name: 'Poner en pausa' });
    await d.waitFor();
    await d.locator('#pa-motivo').selectOption('personal');
    const en7 = await p.evaluate(() => { const x = new Date(Date.now() + 7 * 86400000); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(x); });
    await d.locator('#pa-hasta').fill(en7);
    await d.locator('#pa-nota').fill('Recupérate bien, aquí seguimos');
    await axeEn(p, '[role=dialog]', errores, 'poner en pausa');
    await d.getByRole('button', { name: 'Poner en pausa' }).click();
    await d.waitFor({ state: 'hidden', timeout: 8000 });
    await caja.getByRole('button', { name: 'Terminar hoy' }).waitFor({ timeout: 8000 });
    check(/En pausa hasta el/.test(await caja.textContent()) && /\(motivos personales\)/.test(await caja.textContent()), 'el coach la pone en pausa con su motivo y su vuelta');
    await caja.scrollIntoViewIfNeeded();
    await axeEn(p, '.pausa-coach', errores, 'pausa en la ficha');
    await pestana('Atletas');
    const tarjeta = p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Iván Prieto' }).first();
    await tarjeta.waitFor({ timeout: 8000 });
    check(/En pausa/.test(await tarjeta.textContent()), 'en el panel sale «En pausa»');

    await entrarComo('Iván');
    await aviso.waitFor({ timeout: 10000 });
    const t = await aviso.textContent();
    check(/Tu asesoría está en pausa/.test(t) && /Vuelves el/.test(t) && /tu racha te espera/.test(t) && /Recupérate bien, aquí seguimos/.test(t), 'el atleta lo ve en Hoy: hasta cuándo, que su racha le espera y el mensaje de su coach');
    await axeEn(p, '.aviso-pausa', errores, 'aviso de pausa');

    await entrarComo('Pelayo');
    await abrirDatos();
    await caja.getByRole('button', { name: 'Terminar hoy' }).click();
    await caja.getByRole('button', { name: 'Poner en pausa' }).waitFor({ timeout: 8000 });
    await pestana('Atletas');
    await tarjeta.waitFor({ timeout: 8000 });
    check(!/En pausa/.test(await tarjeta.textContent()), '«Terminar hoy»: vuelve a estar activo');
    await entrarComo('Iván');
    await p.locator('.cabecera').first().waitFor();
    await p.waitForTimeout(1500);
    check(await aviso.count() === 0, 'y al atleta ya no le sale el aviso');
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
  await probarPausas({ navegador, check });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
