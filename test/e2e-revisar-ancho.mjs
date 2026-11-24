// v0.220: revisar los vídeos de técnica en el ordenador, en columnas (petición de Pelayo: «no todo en vertical como en
// el móvil, para tener todas las opciones en la pantalla para cada vídeo»). En la demo, el vídeo de sentadilla de Ana.
// Lo llama e2e.test.mjs.
//   · «Revisar los vídeos seguidos» a 1440 × 900: tres columnas (el vídeo con todos sus mandos, la corrección y el hilo)
//     una al lado de otra, el vídeo y sus mandos enteros a la vista sin bajar, y cada columna baja por su cuenta.
//     A 1100 px, dos columnas (el vídeo y, al lado, la corrección y el hilo).
//   · En la bandeja, «Ver y comentar» en un vídeo: la tarjeta ocupa toda la fila, el vídeo a la izquierda y la corrección
//     al lado; al bajar, el vídeo se queda a la vista.
//   · La ficha de Ana → Vídeos → el vídeo: la hoja, ancha y en tres columnas.
//   · En el móvil, como siempre: una cosa debajo de otra. Sin errores ni desbordes.
// v0.226 (petición de Pelayo: «la parte de escribir y dibujar sobre el vídeo, fijas debajo del mismo»): en columnas, el
//   cuadro de la respuesta y las herramientas (dibujar sobre el vídeo, comentar el momento…) van debajo del vídeo, en su
//   columna, siempre a la vista; si la columna no cabe, baja por su cuenta hasta los mandos y lo de escribir se queda abajo.
import { devices } from 'playwright';

export async function probarRevisarAncho({ navegador, check, base = 'http://localhost:4174' }) {
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
  const caja = (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) }; });
  const entrarCoach = async (p) => {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.waitForTimeout(1500);
    await cerrar(p);
  };
  const abrirSeguidos = async (p) => {
    await p.locator('.tab', { hasText: 'Revisar' }).first().click();
    await p.getByRole('button', { name: /Revisar los vídeos seguidos/ }).first().click();
    const s = p.getByRole('dialog', { name: 'Revisar los vídeos seguidos' });
    await s.locator('.seguida-tarjeta video').first().waitFor({ timeout: 15000 });
    await p.waitForTimeout(600);
    return s;
  };

  // 1) «Revisar los vídeos seguidos» en un portátil (1440 × 900)
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* sin almacenamiento */ } });
  const p = await ctx.newPage();
  vigilar(p);
  await entrarCoach(p);
  let s = await abrirSeguidos(p);
  const ver = await caja(s.locator('.revdos-ver'));
  const cor = await caja(s.locator('.revdos-corregir'));
  const hab = await caja(s.locator('.revdos-hablar'));
  check(ver.r <= cor.x && cor.r <= hab.x && Math.abs(ver.y - cor.y) < 40 && Math.abs(cor.y - hab.y) < 40,
    `«Revisar seguidos» a 1440 px: el vídeo, la corrección y el hilo en tres columnas, una al lado de otra (${ver.w}, ${cor.w} y ${hab.w} px)`);
  const pie = await caja(s.locator('.seguida-pie'));
  // (v0.226) la parte de escribir, debajo del vídeo y a la vista
  const medio = await caja(s.locator('.revdos-ver .medio').first());
  const escribir = await caja(s.locator('.revdos-ver .hilo-escribir'));
  check(escribir.y >= medio.b && escribir.b <= pie.y && escribir.x >= ver.x && escribir.r <= ver.r + 1
    && await s.locator('.revdos-ver .hilo-escribir textarea').isVisible() && await s.locator('.revdos-ver .hilo-escribir').getByRole('button', { name: 'Dibujar sobre el vídeo' }).isVisible()
    && await s.locator('.revdos-hablar textarea').count() === 0,
  `la parte de escribir (el cuadro y «Dibujar sobre el vídeo»), debajo del vídeo en su columna y a la vista (de ${escribir.y} a ${escribir.b} px)`);
  // Si la columna no cabe, baja por su cuenta: abajo del todo, los mandos de velocidad, encima de la parte de escribir
  await s.locator('.revdos-ver').evaluate((e) => { e.scrollTop = e.scrollHeight; });
  await p.waitForTimeout(200);
  const velocidad = await caja(s.locator('.revdos-ver .reproductor').last());
  const escribirAbajo = await caja(s.locator('.revdos-ver .hilo-escribir'));
  check(velocidad.b <= escribirAbajo.y + 1 && escribirAbajo.b <= pie.y, 'y bajando por la columna del vídeo se llega a todos sus mandos (la velocidad, encima de lo de escribir)');
  await s.locator('.revdos-ver').evaluate((e) => { e.scrollTop = 0; });
  check(await s.getByRole('heading', { name: 'Corrección' }).isVisible(), 'a la vez, la corrección');
  const baja = await s.locator('.revdos-corregir').evaluate((e) => { const antes = e.scrollTop; e.scrollTop = 400; return getComputedStyle(e).overflowY === 'auto' && e.scrollTop > antes; });
  check(baja && await s.locator('.seguida-cuerpo').evaluate((e) => e.scrollHeight <= e.clientHeight + 2) && (await caja(s.locator('.revdos-ver'))).y === ver.y,
    'la corrección baja por su cuenta y el vídeo no se mueve');
  await desborda(p, 'seguidos a 1440 px');
  // A 1100 px, dos columnas
  await p.setViewportSize({ width: 1100, height: 760 });
  await p.waitForTimeout(500);
  // (a 1100 px las cajas de la corrección y del hilo no cuentan: se mide lo de dentro)
  const ver2 = await caja(s.locator('.revdos-ver'));
  const cor2 = await caja(s.locator('.revdos-corregir .correccion').first());
  const hab2 = await caja(s.locator('.revdos-ver textarea').first());
  const medio2 = await caja(s.locator('.revdos-ver .medio').first());
  check(ver2.r <= cor2.x && hab2.r <= cor2.x && hab2.y >= medio2.b, 'a 1100 px, dos columnas: el vídeo con lo de escribir debajo y, al lado, la corrección');
  await desborda(p, 'seguidos a 1100 px');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);

  // 2) La bandeja: «Ver y comentar» en el vídeo (1440 × 900)
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.waitForTimeout(400);
  const t = p.locator('.tarjeta-revisar', { hasText: 'Vídeo: Sentadilla barra alta' }).first();
  await t.getByRole('button', { name: /Ver y comentar/ }).click();
  await t.locator('.revdos-tarjeta video').first().waitFor({ timeout: 15000 });
  await p.waitForTimeout(600);
  const fila = await caja(p.locator('.grupo-revisar-items', { has: t }).first());
  const tc = await caja(t);
  const v3 = await caja(t.locator('.revdos-ver'));
  const c3 = await caja(t.locator('.revdos-corregir .correccion').first());
  check(tc.w >= fila.w - 4 && v3.r <= c3.x && c3.y < v3.b, `en la bandeja, el vídeo abierto ocupa toda la fila (${tc.w} px) con el vídeo a la izquierda y la corrección al lado`);
  await t.locator('.revdos-corregir').evaluate((e) => e.scrollIntoView({ block: 'start' }));
  await p.evaluate(() => window.scrollBy(0, 500));
  await p.waitForTimeout(400);
  const v4 = await caja(t.locator('.revdos-ver'));
  const e4 = await caja(t.locator('.revdos-ver .hilo-escribir'));
  check(v4.y >= 0 && v4.y < 140 && v4.b <= 900 && e4.b <= 900 && e4.y > v4.y, 'al bajar por la corrección, el vídeo se queda a la vista, con lo de escribir debajo');
  await desborda(p, 'bandeja a 1440 px');

  // 3) La ficha de Ana → Vídeos → el vídeo de hoy: la hoja, ancha y en tres columnas
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().click();
  await p.getByRole('tab', { name: /Vídeos/ }).first().click();
  await p.locator('button.diario-item[aria-label^="Sentadilla barra alta"]').first().click();
  const hoja = p.locator('.hoja-dialogo.revdos-hoja').last();
  await hoja.locator('video').first().waitFor({ timeout: 15000 });
  await p.waitForTimeout(600);
  const hv = await caja(hoja.locator('.revdos-ver'));
  const hc = await caja(hoja.locator('.revdos-corregir'));
  const hh = await caja(hoja.locator('.revdos-hablar'));
  check((await caja(hoja)).w > 1100 && hv.r <= hc.x && hc.r <= hh.x, 'en la ficha (Vídeos), el vídeo se abre en una hoja ancha con tres columnas');
  check(await hoja.locator('.revdos-ver .hilo-escribir textarea').isVisible() && await hoja.locator('.revdos-hablar textarea').count() === 0, 'y ahí también, lo de escribir debajo del vídeo');
  await desborda(p, 'la hoja del diario a 1440 px');
  await ctx.close();

  // 4) En el móvil, como siempre: una cosa debajo de otra
  const ctxM = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
  await ctxM.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* sin almacenamiento */ } });
  const pm = await ctxM.newPage();
  vigilar(pm);
  await entrarCoach(pm);
  s = await abrirSeguidos(pm);
  const vm = await caja(s.locator('.seguida-tarjeta video').first());
  const cm = await caja(s.locator('.correccion').first());
  const tm = await caja(s.locator('.revdos-hablar textarea').first());
  check(cm.y > vm.b && tm.y > cm.y && vm.w >= 340, 'en el móvil, como siempre: el vídeo a todo lo ancho, debajo la corrección y después el hilo');
  check(await s.locator('.seguida-cuerpo').evaluate((e) => getComputedStyle(e).overflowY === 'auto'), 'y se baja todo junto, como antes');
  await desborda(pm, 'seguidos en el móvil');
  await ctxM.close();
  check(errores.length === 0, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}
