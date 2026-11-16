// La foto del plato y comer fuera (rama comidas-foto, migración 079), en la demo y en un móvil de 390 px:
//   · Ana hace la foto de su comida desde «Tu semana»: queda apuntada, hecha y con su miniatura; al abrirla, la foto entera
//   · apunta que cena fuera: le sale la pauta corta (con su proteína) y cuenta como hecha
//   · en Hoy tiene los dos accesos; el coach ve las fotos de la semana en la revisión semanal
//   Suelta:  npm run build && node test/e2e-platos.mjs
import { axeEn } from './e2e-perfil4-t1.mjs';
import { irASeccion } from './secciones.mjs';

export async function probarPlatos({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true, timezoneId: 'Europe/Madrid', bypassCSP: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  const foto = async (nombre) => { if (capturas) await p.screenshot({ path: `${capturas}/${nombre}.png` }).catch(() => {}); };
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
  try {
    await p.goto(`${base}/?demo`);
    await entrarComo('Ana');
    // Una foto de verdad (un JPEG de 1600 x 1200 pintado en el propio navegador)
    const b64 = await p.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 1600; c.height = 1200;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 1600, 1200); g.addColorStop(0, '#d9a441'); g.addColorStop(1, '#3f7d4e');
      x.fillStyle = g; x.fillRect(0, 0, 1600, 1200);
      x.fillStyle = '#f4efe6'; x.beginPath(); x.arc(800, 600, 430, 0, 7); x.fill();
      x.fillStyle = '#b5462f'; x.beginPath(); x.arc(700, 560, 150, 0, 7); x.fill();
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    });
    const archivo = { name: 'plato.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };

    await irASeccion(p, 'Comidas');
    const menu = p.locator('.menu-semana');
    await menu.locator('.tomas-dia').waitFor({ timeout: 10000 });
    await menu.getByRole('button', { name: 'Añadir a comida', exact: true }).click();
    let d = p.getByRole('dialog').last();
    await d.locator('.platos-botones').waitFor();
    check(await d.locator('.plato-boton').count() === 2, 'al añadir una comida, arriba: «Foto del plato» y «Como fuera»');
    await d.getByRole('button', { name: 'Foto del plato' }).click();
    d = p.getByRole('dialog', { name: 'Foto del plato' });
    await d.waitFor();
    check(await d.getByRole('button', { name: 'Guardar y marcar como hecha' }).isDisabled(), 'sin foto, no se guarda');
    await d.locator('input[aria-label="Elegir la foto del plato"]').setInputFiles(archivo);
    await d.locator('img.plato-vista').waitFor({ timeout: 10000 });
    const lado = await d.locator('img.plato-vista').evaluate((i) => new Promise((ok) => { const x = new Image(); x.onload = () => ok([x.naturalWidth, x.naturalHeight, i.src.length]); x.src = i.src; }));
    check(lado[0] === 1024 && lado[1] === 768 && lado[2] < 380000, `la foto se reduce en el móvil (1024 de lado largo, ${Math.round(lado[2] / 1024)} KB en texto)`);
    check(/tu coach y tú/.test(await d.textContent()) && /30 días/.test(await d.textContent()) && /sin la ubicación/.test(await d.textContent()), 'y dice quién la ve, cuánto se guarda y que va sin ubicación');
    await p.waitForTimeout(700); // la hoja aun esta entrando
    await axeEn(p, '[role=dialog]', errores, 'foto del plato');
    await foto('platos-1-foto');
    await d.getByRole('button', { name: 'Guardar y marcar como hecha' }).click();
    await d.waitFor({ state: 'hidden', timeout: 8000 });
    const fila = menu.locator('.entrada-menu.con-foto', { hasText: 'Foto del plato' });
    await fila.waitFor({ timeout: 8000 });
    await fila.locator('img.plato-mini').waitFor({ timeout: 8000 });
    check(/hecha/.test(await fila.getAttribute('class')) && await fila.locator('.casilla-redonda').getAttribute('aria-pressed') === 'true', 'la comida queda apuntada y hecha, con su miniatura');
    const mini = await fila.locator('img.plato-mini').evaluate((i) => new Promise((ok) => { const x = new Image(); x.onload = () => ok([x.naturalWidth, x.naturalHeight]); x.src = i.src; }));
    check(mini[0] === 160 && mini[1] === 160, 'la miniatura, cuadrada y de 160 px');
    await fila.scrollIntoViewIfNeeded();
    await foto('platos-2-menu');
    await fila.locator('.plato-mini-boton').click();
    d = p.getByRole('dialog', { name: 'Foto del plato' });
    await d.locator('img.plato-vista').waitFor({ timeout: 8000 });
    check(await d.getByRole('button', { name: 'Cambiar la foto' }).count() === 1 && await d.getByRole('button', { name: 'Quitar la foto' }).count() === 1 && await d.getByText('Raciones').count() === 0, 'al abrirla: la foto entera, cambiarla o quitarla (sin raciones)');
    await p.waitForTimeout(700); // la hoja aun esta entrando
    await axeEn(p, '[role=dialog]', errores, 'comida con foto');
    await p.keyboard.press('Escape');
    await d.waitFor({ state: 'hidden' });

    await menu.getByRole('button', { name: 'Añadir a cena', exact: true }).click();
    d = p.getByRole('dialog').last();
    await d.getByRole('button', { name: 'Como fuera' }).click();
    d = p.getByRole('dialog', { name: 'Como fuera' });
    await d.locator('.pauta-fuera').waitFor();
    const pauta = await d.locator('.pauta-fuera').textContent();
    check(await d.locator('.pauta-fuera-lista li').count() === 5 && /Elige primero la proteína/.test(pauta) && /Busca unos \d+ g\./.test(pauta), 'comer fuera: la pauta corta, con la proteína de su plan');
    await p.waitForTimeout(700); // la hoja aun esta entrando
    await axeEn(p, '[role=dialog]', errores, 'como fuera');
    await foto('platos-3-fuera');
    await d.locator('input.entrada').fill('Cena con amigos');
    await d.getByRole('button', { name: 'Apuntarla como hecha' }).click();
    await d.waitFor({ state: 'hidden', timeout: 8000 });
    const fuera = menu.locator('.entrada-menu', { hasText: 'Cena con amigos' });
    await fuera.waitFor({ timeout: 8000 });
    check(/hecha/.test(await fuera.getAttribute('class')) && /Fuera/.test(await fuera.locator('.chip-fuera').textContent()), 'queda en el menú como hecha, con su marca de «Fuera»');
    await fuera.scrollIntoViewIfNeeded();
    await axeEn(p, '.menu-semana', errores, 'menú con foto y comida fuera');
    await foto('platos-4-menu');
    await fuera.locator('button.entrada-texto').click();
    d = p.getByRole('dialog', { name: 'Cena con amigos' });
    await d.locator('.pauta-fuera').waitFor();
    check(await d.getByRole('button', { name: 'Hacerle la foto al plato' }).count() === 1, 'al abrirla vuelve a ver la pauta, y le puede hacer la foto');
    await p.keyboard.press('Escape');
    await d.waitFor({ state: 'hidden' });

    await irASeccion(p, 'Hoy');
    await p.locator('.cabecera').first().waitFor();
    const enHoy = p.locator('.platos-botones.en-hoy').first();
    await enHoy.waitFor({ state: 'attached', timeout: 10000 });
    await enHoy.scrollIntoViewIfNeeded().catch(() => {});
    check(await enHoy.locator('.plato-boton').count() === 2, 'en Hoy tiene los dos accesos');
    await foto('platos-5-hoy');

    await entrarComo('Pelayo');
    await p.locator('nav.tabs .tab', { hasText: 'Revisión semanal' }).first().click();
    const filaRev = p.locator('.revision-fila', { hasText: 'Ana López' }).first();
    await filaRev.waitFor({ timeout: 10000 });
    const btn = filaRev.getByRole('button', { name: '1 plato' });
    await btn.waitFor({ timeout: 8000 });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    d = p.getByRole('dialog', { name: 'Platos de Ana' });
    await d.locator('.plato-celda').first().waitFor({ timeout: 8000 });
    check(await d.locator('.plato-celda').count() === 1 && /Comida/.test(await d.locator('.plato-celda').first().textContent()), 'el coach ve en la revisión semanal las fotos de la semana, por días');
    await p.waitForTimeout(700); // la hoja aun esta entrando
    await axeEn(p, '[role=dialog]', errores, 'platos de la semana');
    await foto('platos-6-coach');
    await d.locator('.plato-celda').first().click();
    await p.getByRole('dialog').last().locator('img.plato-vista').waitFor({ timeout: 8000 });
    check(true, 'y, al tocar una, la foto entera');
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
  await probarPlatos({ navegador, check, capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
