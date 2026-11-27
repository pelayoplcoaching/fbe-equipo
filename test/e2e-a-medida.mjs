// «A su medida» (rama atleta-propio, migración 080), en la demo y en un móvil de 390 px:
//   · Ana ve en Hoy el saludo de su coach; en su perfil y en su carné, la imagen que le ha puesto
//   · al abrir un ejercicio con frase propia, la ve; al pasarse del RPE pautado, la de «gamberrada» (una vez)
//   · con la semana por delante de hoy, «empieza antes»: su frase y su imagen
//   · el coach, en la ficha: «A su medida» con el resumen; escribe frases, pone márgenes y sube una imagen
//   · un atleta sin nada a su medida ve lo de siempre
//   Suelta:  npm run build && node test/e2e-a-medida.mjs
import { axeEn } from './e2e-perfil4-t1.mjs';
import { irASeccion } from './secciones.mjs';

export async function probarAMedida({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
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
  const SALUDOS = ['Buenos días, Ana. Hoy, sin prisa y con la barra recta.', 'Ana, el café ya está; falta la barra.', 'Hoy toca, y lo sabes. A por ello.', '¿Paseo largo este finde? Cuenta como pasos, no como pierna.'];
  try {
    await p.goto(`${base}/?demo`);
    await entrarComo('Ana');

    // ---- Hoy: el saludo de su coach, uno al día
    const saludo = p.locator('.a-medida-hoy');
    await saludo.waitFor({ timeout: 10000 });
    const texto1 = await saludo.locator('blockquote').textContent();
    check(SALUDOS.includes(texto1) && /Tu coach/.test(await saludo.textContent()) && ['saludo', 'varias'].includes(await saludo.getAttribute('data-momento')), `en Hoy, el saludo que le dejó su coach («${texto1}»)`);
    // (v0.274, vista 258) va bajo la tarjeta del día, con lo de su coach (antes iba encima y bajaba la tarjeta)
    check(await p.evaluate(() => { const a = document.querySelector('.a-medida-hoy'), h = document.querySelector('.hero-dia'); return !!a && !!h && a.closest('section.tramo')?.getAttribute('aria-label') === 'De tu coach' && a.getBoundingClientRect().top >= h.getBoundingClientRect().bottom - 1; }), 'va bajo la tarjeta del día, en «De tu coach»');
    await axeEn(p, '.a-medida-hoy', errores, 'el saludo de Hoy');
    await foto('a-medida-1-hoy');
    await p.reload();
    await p.locator('nav.tabs').waitFor(); await p.waitForTimeout(800); await cerrarDialogos();
    await saludo.waitFor({ timeout: 10000 });
    check(await saludo.locator('blockquote').textContent() === texto1, 'y es el mismo todo el día (al volver a abrir la app no cambia)');
    check(await p.locator('.a-medida-peso').count() === 0, 'su peso baja dentro de su margen: sin aviso de ritmo');

    // ---- Su perfil y su carné: la imagen que le ha puesto su coach
    await irASeccion(p, 'Perfil');
    await p.locator('.perfil-portada img.portada-propia').waitFor({ timeout: 10000 });
    await p.locator('.carnet .carnet-suya').waitFor({ timeout: 10000 });
    const img = await p.locator('.carnet .carnet-suya').evaluate((i) => new Promise((ok) => { const x = new Image(); x.onload = () => ok([x.naturalWidth, x.naturalHeight]); x.onerror = () => ok(null); x.src = i.src; }));
    check(img && img[0] === 600 && img[1] === 400, 'en la cabecera de su perfil y en su carné, su imagen');
    await p.locator('.carnet').scrollIntoViewIfNeeded();
    await axeEn(p, '.carnet-seccion', errores, 'el carné con su imagen');
    await foto('a-medida-2-carne');

    // ---- La sesión: la frase de su ejercicio y la de pasarse de lo pautado
    await irASeccion(p, 'Hoy');
    await p.getByRole('button', { name: 'Empezar sesión' }).first().click();
    await p.locator('.portada-sesion').waitFor();
    await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    check(await p.locator('.a-medida-antes').count() === 0, 'la semana es la de ahora: nada de «empieza antes»');
    const prep = p.locator('.preparacion');
    if (await prep.count()) { const no = prep.getByRole('button', { name: /Ahora no|Saltar/ }).first(); if (await no.count()) await no.click().catch(() => {}); }
    const primero = p.locator('.ejercicio').first();
    if (!(await primero.locator('.ejercicio-cuerpo').count())) await primero.locator('.ejercicio-cab').click();
    const fraseEj = primero.locator('.a-medida-ejercicio');
    await fraseEj.waitFor({ timeout: 8000 });
    check(/Press inclinado: los codos/.test(await fraseEj.textContent()), 'al abrir el press inclinado, lo que su coach le dejó escrito para ese ejercicio');
    check(await p.locator('.ejercicio').nth(1).locator('.a-medida-ejercicio').count() === 0, 'y en los demás ejercicios, nada');
    await fraseEj.scrollIntoViewIfNeeded();
    await foto('a-medida-3-ejercicio');
    await primero.getByLabel(/^(Kilos|Libras) de la serie 1/).fill('10');
    await primero.getByLabel('Repeticiones de la serie 1').fill('6');
    await primero.getByRole('button', { name: /^RPE de la serie 1/ }).click();
    await p.locator('.teclado-serie[data-campo="rpe"]').getByRole('button', { name: '10', exact: true }).click();
    await p.waitForFunction(() => /: 10$/.test(document.querySelector('.ejercicio .serie[data-n="1"] .rpe-boton')?.getAttribute('aria-label') || ''));
    await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    const tostada = p.locator('.toast', { hasText: /Eso no estaba pautado|Un poco más de lo pautado/ });
    await tostada.waitFor({ timeout: 8000 });
    check(true, 'RPE 10 donde tocaba 8: le sale la frase de su coach para eso');
    check(await primero.locator('.a-medida-ejercicio').count() === 0, 'con el ejercicio empezado, su frase ya no ocupa sitio');
    await foto('a-medida-4-gamberrada');
    await tostada.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await primero.getByLabel(/^(Kilos|Libras) de la serie 2/).fill('10');
    await primero.getByLabel('Repeticiones de la serie 2').fill('6');
    await primero.getByRole('button', { name: /^RPE de la serie 2/ }).click();
    await p.locator('.teclado-serie[data-campo="rpe"]').getByRole('button', { name: '10', exact: true }).click();
    await p.waitForFunction(() => /: 10$/.test(document.querySelector('.ejercicio .serie[data-n="2"] .rpe-boton')?.getAttribute('aria-label') || ''));
    await primero.getByRole('button', { name: 'Marcar la serie 2 como hecha' }).click();
    await p.waitForTimeout(1200);
    check(await p.locator('.toast', { hasText: /Eso no estaba pautado|Un poco más de lo pautado/ }).count() === 0, 'y solo una vez por sesión');

    // ---- Empieza la semana antes de tiempo: la semana de ahora pasa a empezar el lunes que viene
    await p.waitForTimeout(600);
    const movida = await p.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('fbe-demo-v2'));
      const ana = db.atletas.find((a) => /Ana/.test(a.nombre));
      const bloques = new Set(db.bloques.filter((b) => b.atleta_id === ana.id).map((b) => b.id));
      const hoy = new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
      const semanas = db.semanas.filter((s) => bloques.has(s.bloque_id) && s.fecha_inicio && s.fecha_inicio <= hoy).sort((a, b) => (a.fecha_inicio < b.fecha_inicio ? 1 : -1));
      const s = semanas[0];
      if (!s) return null;
      const d = new Date(`${s.fecha_inicio}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 7);
      s.fecha_inicio = d.toISOString().slice(0, 10);
      localStorage.setItem('fbe-demo-v2', JSON.stringify(db));
      return s.fecha_inicio;
    });
    await p.reload();
    await p.locator('nav.tabs, .sesion-vista').first().waitFor();
    await p.waitForTimeout(1000);
    await cerrarDialogos();
    // (Hoy enseña la semana anterior, ya completa, con su frase; la que aún no ha empezado se abre desde «Semana»)
    await irASeccion(p, 'Hoy');
    await p.locator('.a-medida-hoy[data-momento="semana"]').waitFor({ timeout: 10000 });
    check(/Semana completa, Ana|Todas hechas/.test(await p.locator('.a-medida-hoy').textContent()), 'en Hoy, con la semana completa, la frase de su coach para eso');
    await irASeccion(p, 'Semana');
    await p.getByRole('button', { name: /^Semana siguiente/ }).click();
    await p.locator('button.dia', { hasText: 'Torso B' }).first().click();
    const empezar = p.locator('.portada-empezar').getByRole('button').first();
    if (await empezar.waitFor({ timeout: 2500 }).then(() => true).catch(() => false)) await empezar.click();
    const antes = p.locator('.a-medida-antes');
    await antes.waitFor({ timeout: 10000 });
    await antes.locator('img.a-medida-img').waitFor({ timeout: 8000 });
    check(!!movida && /Empezando la semana antes de tiempo/.test(await antes.textContent()), 'con la semana aún por empezar, al abrir la sesión: la frase de «empieza antes», con su imagen');
    await antes.scrollIntoViewIfNeeded();
    await axeEn(p, '.a-medida-antes', errores, 'empieza antes');
    await foto('a-medida-5-antes');

    // ---- El coach: «A su medida» en la ficha
    await p.goto(`${base}/?demo`);
    await entrarComo('Pelayo');
    await p.locator('.tarjeta-atleta, tr[data-estado]', { hasText: 'Ana López' }).first().click();
    await p.getByRole('tab', { name: /Objetivos/ }).click();
    const seccion = p.locator('.a-medida-coach');
    await seccion.waitFor({ timeout: 10000 });
    const resumen = await seccion.textContent();
    check(/\d+ frases · 3 imágenes · márgenes de peso/.test(resumen) && /si baja más de un 1 % a la semana/.test(resumen) && /Programar según FBE/.test(resumen), `en la ficha de Ana, «A su medida»: cuántas frases, sus imágenes y su margen de peso`);
    await seccion.scrollIntoViewIfNeeded();
    await foto('a-medida-6-ficha');
    await seccion.getByRole('button', { name: 'Cambiar' }).click();
    let d = p.getByRole('dialog', { name: 'A la medida de Ana' });
    await d.waitFor();
    check(await d.locator('textarea').count() === 11 && (await d.getByLabel('Saludo en Hoy').inputValue()).split('\n').length === 3 && await d.locator('.a-medida-hueco img').count() === 3, 'la hoja: una caja por momento (una frase por línea), sus ejercicios y sus tres imágenes');
    await p.waitForTimeout(700); // la hoja aun esta entrando
    await axeEn(p, '[role=dialog]', errores, 'la hoja de «A su medida»');
    await foto('a-medida-7-hoja');
    await d.getByLabel('Semana completa').fill('Semana redonda, Ana.\n\nSemana redonda, Ana.\nOtra más al saco.');
    await d.getByLabel('Avisar si sube más de').fill('9');
    check(/margen de subida/.test(await d.locator('.a-medida-pegas').textContent()), 'un margen que no vale se avisa antes de guardar');
    await d.getByRole('button', { name: /^Avanzado/ }).click();
    check(await d.getByLabel('Avisar si sube más de').inputValue() === '0,5' && await d.getByLabel('Avisar si baja más de').inputValue() === '1', 'el nivel pone su margen (avanzado: 0,5 % al mes)');
    // Una imagen de verdad (un PNG de 2000 x 1000 pintado en el propio navegador), en el hueco de récord
    const b64 = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 2000; c.height = 1000; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 2000, 1000); g.addColorStop(0, '#2a1d5c'); g.addColorStop(1, '#f3cc63'); x.fillStyle = g; x.fillRect(0, 0, 2000, 1000); return c.toDataURL('image/png').split(',')[1]; });
    const hueco = d.locator('.a-medida-hueco[data-hueco="record"]');
    await hueco.locator('input[type=file]').setInputFiles({ name: 'record.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await p.locator('.toast', { hasText: 'Imagen puesta' }).waitFor({ timeout: 10000 });
    await p.waitForTimeout(500);
    const nueva = await hueco.locator('img').evaluate((i) => new Promise((ok) => { const x = new Image(); x.onload = () => ok([x.naturalWidth, x.naturalHeight, i.src.slice(0, 22), i.src.length]); x.onerror = () => ok(null); x.src = i.src; }));
    check(nueva && nueva[0] === 960 && nueva[1] === 960 && nueva[2] === 'data:image/jpeg;base64' && nueva[3] < 600000, `la imagen se reduce en el navegador del coach (cuadrada, 960 px, ${nueva ? Math.round(nueva[3] / 1024) : '?'} KB en texto)`);
    await d.getByRole('button', { name: /^Guardar/ }).click();
    await d.waitFor({ state: 'hidden', timeout: 8000 });
    await p.locator('.toast', { hasText: 'Guardado' }).waitFor({ timeout: 8000 });
    await p.waitForFunction(() => /o si sube más de un 0,5 % al mes/.test(document.querySelector('.a-medida-coach')?.textContent || ''), null, { timeout: 8000 });
    check(true, 'al guardar, la ficha lo enseña (con el margen nuevo)');
    await p.waitForTimeout(600); // la demo guarda en el navegador con 150 ms de margen
    const guardado = await p.evaluate(() => { const db = JSON.parse(localStorage.getItem('fbe-demo-v2')); return db.atletas.find((a) => /Ana/.test(a.nombre)).propio; });
    check(guardado?.v === 1 && guardado.frases.semana.length === 2 && guardado.frases.semana[0] === 'Semana redonda, Ana.' && guardado.peso.sube_mes === 0.5 && guardado.peso.baja_semana === 1 && guardado.frases.saludo.length === 3,
      'lo guardado: sin líneas vacías ni frases repetidas, y lo demás como estaba');

    // ---- A quien no tiene nada a su medida, la ficha se lo ofrece; y en su app, lo de siempre
    await p.getByRole('button', { name: 'Volver a atletas' }).click();
    await p.locator('.tarjeta-atleta, tr[data-estado]', { hasText: 'Rubén Martín' }).first().click();
    await p.getByRole('tab', { name: /Objetivos/ }).click();
    await p.locator('.a-medida-coach').waitFor({ timeout: 10000 });
    check(await p.locator('.a-medida-coach').getByRole('button', { name: 'Empezar' }).count() === 1 && /sin nada, ve lo de siempre/.test(await p.locator('.a-medida-coach').textContent()), 'a Rubén, que no tiene nada, la ficha le ofrece empezar');
    await entrarComo('Rubén');
    await p.locator('.hero-dia').waitFor({ timeout: 10000 });
    await irASeccion(p, 'Perfil');
    await p.locator('.carnet').waitFor({ timeout: 10000 });
    await p.waitForTimeout(600);
    check(await p.locator('.a-medida, .a-medida-peso, .carnet-suya, .perfil-portada img.portada-propia').count() === 0, 'Rubén ve su app como siempre: ni frases ni imágenes de nadie');
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
  await probarAMedida({ navegador, check, capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
