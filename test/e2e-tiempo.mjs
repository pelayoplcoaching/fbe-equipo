// (v0.142) El tiempo para salir, en la demo, con Open-Meteo de mentira (las tres direcciones se contestan aquí):
//   · Carlos (lleva carrera) ve en Hoy «El tiempo para salir»; elige su zona con la ubicación del móvil: a Open-Meteo solo
//     le llega la zona redondeada (40.4, -3.7), sin cookies; el tiempo de ahora, los avisos (calor y aire), las próximas
//     horas y el resumen en el plegable cerrado. Se queda solo en el móvil.
//   · Cambia la zona escribiendo su ciudad; en la sesión de carrera, los avisos de ahora encima de la pauta.
//   · «Quitar el tiempo» lo borra del móvil y «Ahora no» lo pliega al final. A 390 px, sin errores, desbordes ni axe.
//   Dentro de e2e.test.mjs:  const { probarTiempo } = await import('./e2e-tiempo.mjs'); await probarTiempo({ navegador, check });
import { createRequire } from 'node:module';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

// 48 horas desde las 00:00 UTC de hoy (desfase 0): 30 °C con 33 de sensación, aire malo (70) y poca lluvia
function prevision() {
  const d0 = new Date(); d0.setUTCHours(0, 0, 0, 0);
  const time = Array.from({ length: 48 }, (_, i) => new Date(d0.getTime() + i * 3600e3).toISOString().slice(0, 16));
  const H = (t) => Number(t.slice(11, 13));
  return {
    tiempo: { utc_offset_seconds: 0, timezone: 'GMT', hourly: {
      time, temperature_2m: time.map(() => 30), apparent_temperature: time.map(() => 33), precipitation_probability: time.map(() => 10), precipitation: time.map(() => 0),
      weather_code: time.map(() => 1), wind_speed_10m: time.map(() => 12), wind_gusts_10m: time.map(() => 20), uv_index: time.map((t) => (H(t) >= 10 && H(t) <= 16 ? 5 : 0)), is_day: time.map((t) => (H(t) >= 7 && H(t) <= 18 ? 1 : 0)),
    } },
    aire: { hourly: { time, european_aqi: time.map(() => 70) } },
  };
}

export async function probarTiempo({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const pedidas = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, hasTouch: true, geolocation: { latitude: 40.41678, longitude: -3.70379 }, permissions: ['geolocation'] });
  const { tiempo, aire } = prevision();
  const responder = (cuerpo) => async (ruta) => {
    pedidas.push({ url: ruta.request().url(), cookie: (await ruta.request().allHeaders()).cookie || null });
    await ruta.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(cuerpo) });
  };
  await ctx.route('https://api.open-meteo.com/**', responder(tiempo));
  await ctx.route('https://air-quality-api.open-meteo.com/**', responder(aire));
  await ctx.route('https://geocoding-api.open-meteo.com/**', responder({ results: [{ name: 'Valencia', latitude: 39.46975, longitude: -0.37739, admin1: 'Comunidad Valenciana', country: 'España' }] }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|blob:/.test(m.text())) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir', 'Empezar']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const axe = async (paso) => {
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ]));
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > 390) errores.push(`${paso}: la página se desborda en horizontal (${ancho} px)`);
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations
      .filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (r.length) errores.push(`${paso}: ${r.join(' · ')}`);
  };
  const zonaGuardada = () => p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('fbe-tiempo-zona:')).map((k) => JSON.parse(localStorage.getItem(k))).find(Boolean) || null);
  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Carlos Vera/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    const sec = p.locator('details.plegable-hoy[data-plegable="tiempo"]');
    await sec.waitFor({ timeout: 15000 });
    check(/la mejor hora para salir/i.test(await sec.locator('summary').textContent()) && pedidas.length === 0, 'Carlos (lleva carrera) ve «El tiempo para salir» en Hoy; sin zona, no se pide nada a nadie');
    await sec.locator('summary').click();
    await sec.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await sec.locator('.tiempo-ahora').waitFor();
    const prev = pedidas.find((x) => x.url.startsWith('https://api.open-meteo.com/'));
    check(!!prev && /latitude=40\.4&longitude=-3\.7&/.test(prev.url) && !/40\.41/.test(prev.url) && pedidas.every((x) => !x.cookie) && pedidas.some((x) => x.url.startsWith('https://air-quality-api.open-meteo.com/')),
      'con su ubicación: a Open-Meteo solo le llega la zona redondeada (40.4, -3.7), sin cookies (previsión y aire)');
    const z = await zonaGuardada();
    check(z && z.lat === 40.4 && z.lon === -3.7 && z.origen === 'ubicacion' && Object.keys(z).sort().join() === 'lat,lon,nombre,origen', 'la zona se queda en el móvil, redondeada (y nada más)');
    const txt = await sec.textContent();
    check(/30\s*°C/.test(await sec.locator('.tiempo-grados').textContent()) && /sensación de 33 °C/.test(txt) && /Malo/.test(await sec.locator('.tiempo-datos').textContent()), 'el tiempo de ahora: 30 °C (33 de sensación), lluvia, viento y el aire');
    const avisos = await sec.locator('.tiempo-aviso strong').allTextContents();
    check(avisos.some((x) => /^Calor fuerte/.test(x)) && avisos.includes('Aire malo') && await sec.locator('.tiempo-aviso[data-nivel="alto"]').first().textContent().then((t) => /Calor fuerte/.test(t)), `los avisos, el de más peso primero (${avisos.join(' · ')})`);
    const nHoras = await sec.locator('.tiempo-horas li').count();
    const hUtc = new Date().getUTCHours();
    check(hUtc >= 21 || (nHoras >= 2 && (await sec.locator('.tiempo-mejor').count()) === 1), `las próximas horas (${nHoras}) y la mejor hora para salir`);
    check(/30 °C, algunas nubes/.test(await sec.locator('summary .mini').textContent()), 'el resumen del plegable: los grados y el cielo (se ve aunque esté cerrado)');
    await axe('tiempo-hoy');
    // Cambiar la zona por su ciudad
    await sec.getByRole('button', { name: 'Cambiar la zona' }).click();
    await sec.getByLabel('Tu ciudad').fill('Valencia');
    await sec.getByRole('button', { name: 'Buscar' }).click();
    await sec.locator('.zona-opcion', { hasText: 'Valencia' }).click();
    await sec.locator('.tiempo-pie', { hasText: 'Valencia' }).waitFor();
    // (la previsión de la zona nueva se pide justo después: se espera a que salga, no basta con el nombre en el pie)
    for (let i = 0; i < 50 && !pedidas.some((x) => /latitude=39\.5&longitude=-0\.4&/.test(x.url)); i++) await p.waitForTimeout(100);
    check(pedidas.some((x) => /geocoding-api\.open-meteo\.com\/v1\/search\?name=Valencia&/.test(x.url)) && pedidas.some((x) => /latitude=39\.5&longitude=-0\.4&/.test(x.url)) && (await zonaGuardada())?.nombre === 'Valencia',
      'cambiar la zona escribiendo su ciudad: busca «Valencia» y pide su previsión (39.5, -0.4)');
    // En la sesión de carrera: los avisos de ahora encima de la pauta
    await p.locator('.tab', { hasText: 'Semana' }).click();
    await p.locator('.dia', { hasText: 'Umbral 2 × 6 min' }).first().click();
    await p.locator('.portada-sesion, .sesion-vista').first().waitFor();
    if (await p.locator('.portada-sesion').count() && !(await p.locator('.tiempo-sesion').count())) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    const ts = p.locator('.tiempo-sesion').first();
    await ts.waitFor();
    check(/Ahora, 30 °C \(sensación de 33 °C\)/.test(await ts.textContent()) && /Calor fuerte/.test(await ts.textContent()) && !/Buen tiempo para salir/.test(await ts.textContent()), 'en la sesión de carrera: el tiempo de ahora y sus avisos, encima de la pauta');
    await axe('tiempo-sesion');
    // Volver a Hoy: quitar el tiempo y «Ahora no»
    await p.goto(`${base}/?demo`);
    await p.locator('nav.tabs, button.persona').first().waitFor();
    if (await p.locator('button.persona').count()) await p.getByRole('button', { name: /Carlos Vera/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await sec.waitFor();
    if (!(await sec.evaluate((d) => d.open))) await sec.locator('summary').click();
    await sec.getByRole('button', { name: 'Quitar el tiempo' }).click();
    await sec.getByRole('button', { name: 'Usar mi ubicación' }).waitFor();
    check(await zonaGuardada() === null && await p.evaluate(() => localStorage.getItem('fbe-tiempo-cache')) === null, '«Quitar el tiempo» borra la zona y la previsión del móvil');
    await sec.getByRole('button', { name: /Ahora no/ }).click();
    await p.locator('details.ocultas-hoy details[data-plegable="tiempo"]').waitFor({ state: 'attached' });
    check(true, '«Ahora no» lo pliega al final, en «Lo que has ocultado»');
    check(!errores.length, `el tiempo para salir, sin errores, desbordes ni fallos de accesibilidad${errores.length ? `: ${errores.slice(0, 4).join(' | ')}` : ''}`);
  } finally {
    await ctx.close();
  }
}
