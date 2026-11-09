// v0.59: los vídeos de técnica, tanda A, de punta a punta en la demo (un contexto aparte, a 390 px, con su propia demo).
// Lo llama e2e.test.mjs y se puede lanzar suelto (node test/e2e-videos-059.mjs, con dist/ ya construido):
//   · la atleta envía un vídeo (8 s: quieta, se mueve del 0:03 al 0:05 y quieta) y la app propone el recorte (con un
//     segundo de margen); elige «Sin recortar» y cuenta cómo la ha notado (RPE, lo que nota y una molestia);
//   · el coach: lo que espera y cuánto (colores con su objetivo, orden y sus tiempos), lo que nota ella arriba de la
//     revisión, la tira de miniaturas, las marcas de repetición con [ y ], una frase de un toque, fijar un recordatorio,
//     «Comparar con su mejor», subir un vídeo modelo y compararse con él superpuestos;
//   · la atleta ve «Recuerda: …» en su sesión y abre el momento corregido;
//   · el coach pasa el vídeo a otro atleta (como desde el SQL Editor): ella deja de ver su hilo y su recordatorio.
import { createRequire } from 'node:module';
import { subProgreso } from './secciones.mjs';
import { readFileSync } from 'node:fs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const VIDEO = readFileSync(new URL('./video-quieto-mueve.webm', import.meta.url));

export async function probarVideos059({ navegador, check, base = 'http://localhost:4174' }) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true });
  await ctx.grantPermissions(['camera', 'microphone']);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const hay = async (loc, n, ms = 8000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const alMenos = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() >= n) return true; await p.waitForTimeout(100); } return (await loc.count()) >= n; };
  const demo = () => p.evaluate(() => JSON.parse(localStorage.getItem('fbe-demo-v2')));
  // (la sesión abre sola el primer ejercicio al terminar de cargar: en una CPU lenta, mirar antes de que lo haga y tocar la
  // cabecera lo volvía a cerrar. Se espera a que se asiente; si no se abrió sola, se abre y se espera a verlo abierto)
  const abrirEjercicio = async (ej) => {
    const cab = ej.locator('.ejercicio-cab');
    const sola = await p.waitForFunction((el) => el.getAttribute('aria-expanded') === 'true', await cab.elementHandle(), { timeout: 4000 }).then(() => true, () => false);
    if (!sola) await cab.click();
    await ej.locator('.ejercicio-cuerpo').waitFor();
  };
  const enDemo = async (f) => { for (let i = 0; i < 60; i++) { if (f(await demo())) return true; await p.waitForTimeout(100); } return false; };
  const tiempo = (loc) => loc.locator('video.medio').first().evaluate((v) => v.currentTime);
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const sinNombre = await p.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const nombre = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
        const etiqueta = el.id && document.querySelector(`label[for="${el.id}"]`);
        return !nombre && !etiqueta && !el.closest('label');
      }).map((el) => el.outerHTML.slice(0, 90)));
    if (sinNombre.length) errores.push(`${paso}: controles sin nombre accesible: ${sinNombre.join(' | ')}`);
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ]));
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
  }
  const cerrarDialogos = async () => {
    for (let i = 0; i < 5; i++) {
      const d = p.locator('[role=dialog]').first();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Seguir', 'Entendido', 'Cerrar']) {
        const b2 = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b2.isVisible().catch(() => false)) { await b2.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const entrarComo = async (nombre) => {
    // (desde una sesión abierta, primero se vuelve: la sesión ocupa toda la pantalla)
    if (!(await p.locator('nav.tabs').isVisible().catch(() => false)) && await p.getByRole('button', { name: 'Volver', exact: true }).count()) {
      await p.getByRole('button', { name: 'Volver', exact: true }).first().click();
      await p.locator('nav.tabs').waitFor();
    }
    if (!(await p.getByRole('heading', { name: 'Entra en tu cuenta' }).isVisible().catch(() => false))) {
      if (!(await p.getByRole('button', { name: 'Cambiar de cuenta' }).isVisible().catch(() => false))) {
        const hoy = p.locator('.tab', { hasText: 'Hoy' });
        if (await hoy.count()) await hoy.first().click(); else await p.locator('.tab', { hasText: 'Atletas' }).click();
        await p.waitForTimeout(800);
        await cerrarDialogos();
      }
      await p.getByRole('button', { name: 'Cambiar de cuenta' }).first().click();
    }
    await p.getByRole('button', { name: new RegExp(nombre) }).first().click();
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(800);
    await cerrarDialogos();
  };
  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('heading', { name: 'Entra en tu cuenta' }).waitFor();
    await p.waitForFunction(() => !document.getElementById('portada'));

    // ---------------------------------------------------------------- 10 y 12: la atleta envía su vídeo
    await entrarComo('Ana López');
    await p.locator('.tab', { hasText: 'Progreso' }).first().click();
    await subProgreso(p, 'fuerza');
    await p.locator('.diario').getByRole('button', { name: 'Subir vídeo' }).click();
    const hojaSub = p.getByRole('dialog', { name: 'Subir un vídeo' });
    await hojaSub.getByLabel('Ejercicio (opcional)').fill('Sentadilla barra');
    await hojaSub.locator('.lista-elegir button', { hasText: 'Sentadilla barra alta' }).first().click();
    await hojaSub.locator('input[type=file]').setInputFiles({ name: 'serie.webm', mimeType: 'video/webm', buffer: VIDEO });
    const hojaEnv = p.getByRole('dialog', { name: 'Elegir o grabar el vídeo' });
    const auto = hojaEnv.locator('.recorte-auto', { hasText: 'Recortado solo' });
    await auto.waitFor({ timeout: 20000 });
    const ini = Number(await hojaEnv.locator('#recorte-inicio').inputValue()), fin = Number(await hojaEnv.locator('#recorte-fin').inputValue());
    check(Math.abs(ini - 2) <= 0.6 && Math.abs(fin - 6) <= 0.6 && (await hojaEnv.getByRole('button', { name: 'Recortar y enviar' }).count()) === 1,
      `(10) la app propone el recorte sola: donde se mueve (0:03–0:05) con un segundo de margen (${ini}–${fin} s)`);
    await revisar('recorte-automatico');
    await hojaEnv.getByRole('button', { name: 'Sin recortar' }).click();
    check(Number(await hojaEnv.locator('#recorte-inicio').inputValue()) === 0 && Math.abs(Number(await hojaEnv.locator('#recorte-fin').inputValue()) - 8) < 0.2
      && await hojaEnv.getByRole('button', { name: 'Enviar a tu coach' }).count() === 1, '«Sin recortar» lo deja entero');
    await hojaEnv.getByRole('button', { name: /¿Cómo la has notado\?/ }).click();
    await hojaEnv.getByRole('button', { name: 'RPE 8,5' }).click();
    await hojaEnv.getByLabel('¿Qué notas tú?').fill('En la última se me van las rodillas hacia dentro');
    await hojaEnv.getByRole('group', { name: '¿Alguna molestia?' }).getByRole('button', { name: 'Sí', exact: true }).click();
    await hojaEnv.getByLabel('Dónde (opcional)').selectOption('rodilla');
    await revisar('autoevaluacion-envio');
    await hojaEnv.getByRole('button', { name: 'Enviar a tu coach' }).click();
    await p.locator('.toast', { hasText: 'Vídeo enviado a tu coach' }).waitFor({ timeout: 15000 });
    check(await enDemo((d) => d.video_autoevaluacion?.some((x) => Number(x.rpe) === 8.5 && x.molestia === true && x.zona === 'rodilla' && /rodillas hacia dentro/.test(x.nota || ''))),
      '(12) se envía con su valoración: RPE 8,5, lo que nota y una molestia en la rodilla (con su consentimiento de salud)');
    const idVid = (await demo()).video_autoevaluacion.find((x) => x.zona === 'rodilla').archivo_id;
    if (await hojaSub.isVisible().catch(() => false)) { await hojaSub.getByRole('button', { name: 'Cerrar', exact: true }).click(); await hojaSub.waitFor({ state: 'detached' }); }

    // ---------------------------------------------------------------- 18: la cola, con sus tiempos
    // (que lleve 30 horas esperando: con el objetivo de 24 h, pasado; con el de 48, cerca). Sin recargar: en la demo, lo
    // subido solo está hasta recargar la página
    await entrarComo('Pelayo');
    await p.evaluate(({ id, cuando }) => window.__fbeDemo.update('archivos', { creado_en: cuando }, { eq: { id } }), { id: idVid, cuando: new Date(Date.now() - 30 * 3600e3).toISOString() });
    await p.locator('.tab', { hasText: 'Revisar' }).first().click();
    await p.getByRole('heading', { name: 'Revisar' }).waitFor();
    const tarj = p.locator('.tarjeta-revisar').filter({ has: p.locator('.chip.alerta', { hasText: 'Molestia: rodilla' }) }).first();
    await tarj.waitFor();
    const chip = tarj.locator('.chip.espera');
    await p.waitForFunction(() => [...document.querySelectorAll('.chip.espera')].some((c) => c.textContent.includes('hace 30 h')), null, { timeout: 10000 }).catch(() => {});
    check((await chip.textContent()).includes('hace 30 h') && /espera-alerta/.test(await chip.getAttribute('class')), '(18) el vídeo dice cuánto lleva esperando («hace 30 h»), en rojo con el objetivo de 24 h');
    await p.getByRole('group', { name: 'Objetivo' }).getByRole('button', { name: '48 h' }).click();
    await p.waitForFunction(() => [...document.querySelectorAll('.chip.espera')].some((c) => c.textContent.includes('hace 30 h') && c.classList.contains('espera-aviso')));
    check(true, 'con el de 48 h, en ámbar (cerca del objetivo)');
    await p.getByLabel('Orden de los vídeos').selectOption('espera');
    await p.waitForTimeout(300);
    const primero = await p.locator('.tarjeta-revisar').first().locator('.chip.espera').textContent().catch(() => '');
    check(primero.includes('hace 30 h'), 'ordenado por «más tiempo esperando», el suyo va primero');
    await p.getByRole('button', { name: 'Tus tiempos de revisión' }).click();
    const datos = p.locator('.tiempos-datos');
    await datos.waitFor();
    const txtDatos = await datos.textContent();
    check(/Mediana \(30 días\)/.test(txtDatos) && /P90/.test(txtDatos) && /Revisados esta semana/.test(txtDatos) && /Elquemásespera30h/.test(txtDatos.replace(/\s+/g, '')), `y sus tiempos: mediana, p90, esta semana y el que más espera (${txtDatos.replace(/\s+/g, ' ').trim()})`);
    await revisar('revisar-tiempos');

    // ---------------------------------------------------------------- 12 (el coach), 19, 15, 4, 14, 7
    await tarj.getByRole('button', { name: 'Ver y comentar' }).click();
    await tarj.locator('video.medio').waitFor();
    await tarj.getByRole('button', { name: 'Fotograma siguiente' }).and(p.locator(':enabled')).waitFor();
    const nota = tarj.getByRole('region', { name: 'Lo que nota Ana' });
    await nota.waitFor();
    const txtNota = await nota.textContent();
    check(txtNota.includes('Ana nota:') && txtNota.includes('rodillas hacia dentro') && txtNota.includes('RPE 8,5') && txtNota.includes('Molestia: rodilla'), '(12) arriba de la revisión: «Ana nota: …», su RPE y la molestia');
    await tarj.getByRole('button', { name: '3 de 5: Correcta' }).click();
    await tarj.locator('.autoevaluacion-comparar', { hasText: 'tu nota de técnica, 3/5' }).waitFor();
    check(true, 'junto a tu nota de técnica (para leerlos juntos)');
    // 19. La tira de miniaturas
    const tira = tarj.getByRole('slider', { name: /Miniaturas del vídeo/ });
    await tira.waitFor();
    check(await alMenos(tira.locator('.tira-celda canvas'), 16, 15000), '(19) debajo del vídeo, la tira de miniaturas (sacadas en el móvil)');
    const cajaT = await tira.boundingBox();
    await tira.click({ position: { x: cajaT.width * 0.75, y: cajaT.height / 2 } });
    await p.waitForTimeout(300);
    check(Math.abs(await tiempo(tarj) - 6) < 0.3, `tocar la tira lleva a ese momento (al 75 %: ${(await tiempo(tarj)).toFixed(2)} s)`);
    await tira.focus();
    await p.keyboard.press('Home');
    await p.waitForTimeout(200);
    check(await tiempo(tarj) < 0.5, 'y con el teclado (Inicio: la primera)');
    // 15. Marcar repeticiones a mano, ir con [ y ]
    const rango = tarj.getByRole('slider', { name: 'Momento del vídeo' });
    for (const t of [3.1, 4.2]) {
      await rango.evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, t);
      await p.waitForTimeout(250);
      await tarj.getByRole('button', { name: 'Marcar una repetición aquí' }).click();
    }
    check(await hay(tarj.locator('.rep-reps-marcas .rep-rep'), 2), '(15) «Marcar rep»: dos marcas «Rep 1» y «Rep 2» encima de la barra de tiempo');
    check(await enDemo((d) => d.video_revisiones?.some((r) => r.archivo_id === idVid && r.reps_manual?.t?.length === 2)), 'que el coach guarda en la corrección');
    await rango.evaluate((el) => { el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await tarj.getByRole('button', { name: 'Reproducir' }).focus();
    await p.keyboard.press(']');
    await p.waitForTimeout(250);
    const t1 = await tiempo(tarj);
    await p.keyboard.press(']');
    await p.waitForTimeout(250);
    const t2 = await tiempo(tarj);
    await p.keyboard.press('[');
    await p.waitForTimeout(250);
    check(Math.abs(t1 - 3.1) < 0.1 && Math.abs(t2 - 4.2) < 0.1 && Math.abs(await tiempo(tarj) - 3.1) < 0.1 && (await tarj.locator('.rep-reps-cual').textContent()).includes('Rep. 1 de 2'),
      `con ] a la siguiente y con [ a la anterior (${t1.toFixed(2)} → ${t2.toFixed(2)} → ${(await tiempo(tarj)).toFixed(2)} s)`);
    await revisar('repeticiones-tira');
    // 4. Una frase de un toque
    const frases = tarj.getByRole('group', { name: 'Frases de corrección' });
    await frases.waitFor();
    const unaFrase = frases.getByRole('button', { name: /^Usar la frase: Rodillas hacia fuera/ });
    await unaFrase.click();
    const area = tarj.getByRole('textbox', { name: /Responder a Ana/ });
    check(/^0:03,1 Rodillas hacia fuera, en la línea de los pies$/.test(await area.inputValue()), `(4) la frase va al comentario con el momento del vídeo («${await area.inputValue()}»)`);
    // 14. Fijarla como recordatorio, con el momento
    await tarj.getByLabel('Nuevo recordatorio').fill('Rodillas hacia fuera al bajar');
    await tarj.getByRole('button', { name: 'Fijar como recordatorio' }).click();
    await p.locator('.toast', { hasText: 'Fijado: Ana lo verá en su sesión' }).waitFor();
    check(await enDemo((d) => d.recordatorios_tecnica?.some((r) => r.archivo_id === idVid && r.activo && Math.abs(Number(r.segundo) - 3.1) < 0.15)) && await hay(tarj.locator('.lista-recordatorios .recordatorio-fila'), 1),
      '(14) el coach la fija como recordatorio (con este momento del vídeo)');
    await revisar('recordatorio-coach');
    // 7. Comparar con su mejor
    await tarj.getByRole('button', { name: /^Comparar con su mejor/ }).click();
    const compM = p.getByRole('dialog', { name: 'Comparar dos vídeos' });
    await compM.locator('video.medio').nth(1).waitFor();
    check((await compM.getByLabel('Vídeo de la derecha').locator('option:checked').textContent()).startsWith('Su mejor'), '(7) «Comparar con su mejor»: lado a lado con el de mejor nota de ese ejercicio');
    await compM.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await compM.waitFor({ state: 'detached' });
    // 6. Subir un vídeo modelo y compararse con él, superpuestos
    await tarj.getByRole('button', { name: 'Frases y vídeo modelo' }).click();
    const tec = p.getByRole('dialog', { name: 'Técnica de Sentadilla barra alta' });
    await tec.getByRole('tab', { name: 'Vídeo modelo' }).click();
    await tec.locator('.modelo-fila').first().waitFor();
    const antes = await tec.locator('.modelo-fila').count();
    const { VIDEO_EJEMPLO } = await import('../web/src/datos/video-demo.js');
    await tec.getByLabel('Ángulo del vídeo nuevo').selectOption('De frente');
    await tec.locator('input[aria-label="Elegir el vídeo modelo"]').setInputFiles({ name: 'modelo.mp4', mimeType: 'video/mp4', buffer: Buffer.from(VIDEO_EJEMPLO.split(',')[1], 'base64') });
    await p.locator('.toast', { hasText: 'Vídeo modelo guardado' }).waitFor({ timeout: 30000 });
    check(await hay(tec.locator('.modelo-fila'), antes + 1) && await enDemo((d) => d.videos_modelo?.some((m) => m.angulo === 'De frente' && /^modelos\//.test(m.ruta))), '(6) el coach sube su vídeo modelo de la sentadilla (de frente)');
    await revisar('videos-modelo');
    await tec.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await tec.waitFor({ state: 'detached' });
    await tarj.getByRole('button', { name: 'Comparar con el vídeo modelo' }).click();
    const compMod = p.getByRole('dialog', { name: 'Comparar dos vídeos' });
    await compMod.locator('video.medio').nth(1).waitFor();
    check((await compMod.getByLabel('Vídeo de la derecha').locator('option:checked').textContent()).startsWith('Vídeo modelo') && !(await compMod.textContent()).includes('YouTube'), 'y se compara con él (sin el aviso de YouTube)');
    await compMod.getByRole('button', { name: 'Superpuestos' }).click();
    await compMod.locator('.superpuestos-marco video').nth(1).waitFor();
    check(/^modelo:/.test(await compMod.locator('select[aria-label="Vídeo de encima"]').inputValue()) && await compMod.locator('.superpuestos-marco video').count() === 2, 'superpuestos: su vídeo y el modelo, uno encima del otro');
    await compMod.getByRole('button', { name: 'Reproducir los dos' }).click();
    await p.waitForTimeout(400);
    check(await compMod.locator('.superpuestos-marco video').evaluateAll((vs) => vs.every((v) => !v.paused)), 'y se reproducen a la vez');
    await compMod.getByRole('button', { name: 'Pausar' }).click();
    await compMod.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await compMod.waitFor({ state: 'detached' });
    // A 360 px, en oscuro: la revisión con todo
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar('revision-v059-360-oscuro');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= 360), 'a 360 px en oscuro, la revisión (lo que nota, la tira, las repeticiones, las frases y los recordatorios) cabe');
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
    // (al final: comentar algo lo da por revisado y sale de la bandeja)
    await tarj.locator('button[aria-label="Enviar"]').click();
    check(await enDemo((d) => d.comentarios.some((c) => c.archivo_id === idVid && c.autor === 'coach' && c.texto.includes('Rodillas hacia fuera'))), 'y se envía en su hilo (la frase)');

    // ---------------------------------------------------------------- 14 y 6: en la sesión de la atleta
    await entrarComo('Ana López');
    await p.locator('.tab', { hasText: 'Semana' }).click();
    await p.locator('.dia', { hasText: 'Pierna A' }).first().click();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor();
    if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    const sent = p.locator('.ejercicio', { hasText: 'Sentadilla barra alta' }).first();
    await sent.waitFor();
    await abrirEjercicio(sent);
    const rec = sent.locator('.recuerda', { hasText: 'Recuerda:' });
    await rec.waitFor();
    check((await rec.textContent()).includes('Rodillas hacia fuera al bajar') && await sent.getByRole('button', { name: 'Ver el vídeo modelo' }).count() === 1,
      '(14) en su sesión, la tarjeta de la sentadilla le recuerda «Rodillas hacia fuera al bajar»; y (6) «Ver el vídeo modelo»');
    await revisar('recuerda-sesion');
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.waitForTimeout(300);
    await revisar('recuerda-sesion-360-oscuro');
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null });
    await rec.getByRole('link', { name: /^Ver el momento/ }).click();
    const det = p.getByRole('dialog', { name: /^Sentadilla barra alta,/ });
    await det.locator('video.medio').waitFor();
    await p.waitForFunction(() => { const v = document.querySelector('.hoja-dialogo video.medio'); return v && Math.abs(v.currentTime - 3.1) < 0.15; }, null, { timeout: 10000 });
    check(true, 'y abre su vídeo en el momento corregido');
    check((await det.textContent()).includes('Tu valoración') && (await det.textContent()).includes('RPE 8,5'), 'donde ve también su valoración');
    await det.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await det.waitFor({ state: 'detached' });
    await sent.getByRole('button', { name: 'Ver el vídeo modelo' }).click();
    const hm = p.getByRole('dialog', { name: 'Modelo: Sentadilla barra alta' });
    await hm.locator('video.medio').waitFor();
    check(await hm.getByRole('group', { name: 'Ángulo' }).getByRole('button').count() === 2, 'el vídeo modelo, con sus dos ángulos (de lado y de frente)');
    await hm.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await hm.waitFor({ state: 'detached' });
    await rec.getByRole('button', { name: 'Entendido' }).click();
    await sent.getByRole('button', { name: 'Recordatorio de tu coach' }).waitFor();
    check(await sent.locator('.recuerda', { hasText: 'Recuerda:' }).count() === 0, '«Entendido» lo pliega por hoy');

    // ---------------------------------------------------------------- pasar el vídeo a otro atleta
    await entrarComo('Pelayo');
    const ruben = (await demo()).atletas.find((a) => a.nombre === 'Rubén Martín');
    // (con su carpeta: la ruta y la miniatura van en la del atleta)
    const movido = await p.evaluate(async ({ id, atleta }) => {
      const [a] = await window.__fbeDemo.select('archivos', { eq: { id } });
      const aCarpeta = (r) => (r ? `${atleta}/${r.split('/').slice(1).join('/')}` : null);
      return (await window.__fbeDemo.update('archivos', { atleta_id: atleta, ruta: aCarpeta(a.ruta), poster_ruta: aCarpeta(a.poster_ruta) }, { eq: { id } })).length;
    }, { id: idVid, atleta: ruben.id });
    check(movido === 1, 'el coach pasa el vídeo de Ana a Rubén (como desde el SQL Editor)');
    check(await enDemo((d) => !d.video_autoevaluacion?.some((x) => x.archivo_id === idVid) && d.comentarios.filter((c) => c.archivo_id === idVid).every((c) => c.atleta_id === ruben.id && c.autor === 'coach')
      && d.recordatorios_tecnica?.find((r) => r.archivo_id === idVid)?.atleta_id === ruben.id), 'su valoración se borra; lo del coach en el hilo y el recordatorio pasan a Rubén');
    await entrarComo('Ana López');
    await p.evaluate((h) => { location.hash = h; }, `#videos/${idVid}@1.0`);
    const fuera = p.getByRole('dialog', { name: 'Tu vídeo' });
    await fuera.getByText('Ese vídeo ya no está en tu diario.').waitFor();
    check(true, 'Ana ya no lo tiene (el enlace dice que ya no está en su diario)');
    await fuera.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await p.locator('.tab', { hasText: 'Semana' }).click();
    await p.locator('.dia', { hasText: 'Pierna A' }).first().click();
    const sent2 = p.locator('.ejercicio', { hasText: 'Sentadilla barra alta' }).first();
    await sent2.waitFor();
    await abrirEjercicio(sent2);
    await p.waitForTimeout(800);
    check(await sent2.locator('.recuerda').count() === 0, 'ni el recordatorio enlazado a ese vídeo');
    await entrarComo('Rubén Martín');
    await p.locator('.tab', { hasText: 'Progreso' }).first().click();
    await p.evaluate((h) => { location.hash = h; }, `#videos/${idVid}`);
    const detR = p.getByRole('dialog', { name: /^Sentadilla barra alta,/ });
    await detR.locator('.mensaje', { hasText: 'Rodillas hacia fuera' }).waitFor();
    check(!(await detR.textContent()).includes('Tu valoración') || !(await detR.textContent()).includes('RPE 8,5'), 'Rubén lo ve con lo que dijo el coach (y sin la valoración de Ana)');
    await detR.getByRole('button', { name: 'Cerrar', exact: true }).first().click();

    // ---------------------------------------------------------------- «Entendido», solo de hoy (y nada al salir)
    const hoyE = await p.evaluate(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date()));
    await p.evaluate((h) => { localStorage.setItem('fbe-recuerda-viejo-2020-01-01', 'true'); localStorage.setItem(`fbe-recuerda-hoy-${h}`, 'true'); }, hoyE);
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    const claves = () => p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('fbe-recuerda-')));
    const k1 = await claves();
    check(!k1.includes('fbe-recuerda-viejo-2020-01-01') && k1.includes(`fbe-recuerda-hoy-${hoyE}`), `(L3) al abrir la app, los «Entendido» de otros días se quitan; los de hoy, no (${k1.join(', ')})`);
    await entrarComo('Ana López');
    check((await claves()).length === 0, '(L3) y al salir de la cuenta, todos');
  } catch (e) {
    check(false, `v0.59: el flujo se ha interrumpido: ${e.message.split('\n').slice(0, 10).join('\n      ')}`);
    await p.screenshot({ path: new URL('./e2e-fallo-059.png', import.meta.url).pathname }).catch(() => {});
  }
  check(errores.length === 0, errores.length ? `v0.59, sin errores: ${errores.join(' || ')}` : 'v0.59: sin errores de consola, desbordes, controles sin nombre ni fallos de accesibilidad');
  await ctx.close();
}

// Suelto: node test/e2e-videos-059.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4175);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarVideos059({ navegador, check, base: 'http://localhost:4175' });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
