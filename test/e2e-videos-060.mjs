// v0.60: los vídeos de técnica, tanda B (primera mitad), de punta a punta en la demo (un contexto aparte, a 390 px, con la
// cámara y el micro de prueba de Chromium: --use-fake-device-for-media-stream). Lo llama e2e.test.mjs y se puede lanzar
// suelto (node test/e2e-videos-060.mjs, con dist/ ya construido):
//   · (11) la cámara guiada: sin 60 fps, «Cámara lenta» no sale (y se explica); con 120, sale;
//   · (13) la atleta envía un vídeo con «Difuminar la cara»: sin cara en el vídeo, se dice y no se envía; con cara, la vista
//     previa y se envía el difuminado (no el original); (9) y «Añadir otro ángulo» después, enlazado al primero;
//   · (1 y 2) el coach graba su revisión (con su cara en la burbuja), la ve y la envía; y responde con la cámara de delante;
//   · (3) exporta el vídeo con sus correcciones (un MP4/WebM de verdad, que se descarga);
//   · (9) «Dos ángulos»: los dos a la vez, el desfase y guardarlo;
//   · la atleta ve las dos respuestas en vídeo en su hilo y responde con la suya;
//   · todo a 360 px, en oscuro, con el teclado y sin fallos de accesibilidad.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const VIDEO = readFileSync(new URL('./video-quieto-mueve.webm', import.meta.url));

export async function probarVideos060({ navegador, check, base = 'http://localhost:4174' }) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true, acceptDownloads: true });
  await ctx.grantPermissions(['camera', 'microphone']);
  // La cámara de prueba dice los fotogramas por segundo que se le pidan (window.__fpsMax) y los puntos del cuerpo de prueba
  // ponen una cara (o ninguna) donde diga window.__caraPrueba
  await ctx.addInitScript(() => {
    const T = globalThis.MediaStreamTrack?.prototype;
    if (T) {
      const orig = T.getCapabilities;
      T.getCapabilities = function () { const c = orig ? orig.call(this) : {}; return this.kind === 'video' && typeof window.__fpsMax === 'number' ? { ...c, frameRate: { min: 1, max: window.__fpsMax } } : c; };
    }
    window.__fbePosePrueba = (t) => {
      const c = window.__caraPrueba;
      if (!c) return null;
      return Array.from({ length: 33 }, (_, i) => (i <= 10 ? { x: c[0] + 0.02 * Math.sin(t) + ((i % 5) - 2) * 0.012, y: c[1] + (i % 3) * 0.01, visibility: 0.95 } : { x: 0.5, y: 0.7, visibility: 0.9 }));
    };
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  p.on('requestfailed', (r) => { if (process.env.DEPURAR) console.log('requestfailed', r.url().slice(0, 80), r.failure()?.errorText); });
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const demo = () => p.evaluate(() => JSON.parse(localStorage.getItem('fbe-demo-v2')));
  const enDemo = async (f, veces = 80) => { for (let i = 0; i < veces; i++) { if (f(await demo())) return true; await p.waitForTimeout(150); } return false; };
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
  const estrecho = async (paso) => {
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar(`${paso}-360-oscuro`);
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
    return cabe;
  };
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Seguir', 'Entendido', 'Cerrar', 'Cerrar la cámara']) {
        const b2 = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b2.isVisible().catch(() => false)) { await b2.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const entrarComo = async (nombre) => {
    await cerrarDialogos();
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
    const cod = p.getByLabel('Código', { exact: true });
    await Promise.race([cod.waitFor({ timeout: 8000 }).catch(() => {}), p.locator('nav.tabs').waitFor()]);
    if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(800);
    await cerrarDialogos();
  };
  const tipoEsperado = await (async () => 'video/mp4')();
  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('heading', { name: 'Entra en tu cuenta' }).waitFor();
    await p.waitForFunction(() => !document.getElementById('portada'));
    const formato = await p.evaluate(() => (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01F') || MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm'));

    // ---------------------------------------------------------------- 11. La cámara lenta
    await entrarComo('Ana López');
    await p.locator('.tab', { hasText: 'Progreso' }).first().click();
    const abrirCamara = async () => {
      await p.locator('.diario').getByRole('button', { name: 'Subir vídeo' }).click();
      const hs = p.getByRole('dialog', { name: 'Subir un vídeo' });
      await hs.getByRole('button', { name: 'Elegir o grabar el vídeo' }).click();
      await p.getByRole('button', { name: 'Grabar con guía' }).click();
      const cam = p.getByRole('dialog', { name: 'Elegir o grabar el vídeo' }).filter({ has: p.locator('.camara-cab') });
      await cam.locator('.camara-cab').waitFor();
      await p.waitForFunction(() => { const v = document.querySelector('.camara-video video'); return v && v.readyState >= 1; }, null, { timeout: 10000 });
      return cam;
    };
    await p.evaluate(() => { window.__fpsMax = 30; });
    let cam = await abrirCamara();
    await cam.getByRole('button', { name: '¿Y la cámara lenta?' }).waitFor();
    check(await cam.getByRole('button', { name: /^Cámara lenta/ }).count() === 0, '(11) con una cámara de 30 fps, «Cámara lenta» no sale');
    await cam.getByRole('button', { name: '¿Y la cámara lenta?' }).click();
    check(/galería/.test(await cam.locator('.camara-pista[role=note]').textContent()), 'y se explica por qué (con la cámara lenta del móvil y elegirlo de la galería)');
    await revisar('camara-sin-lenta');
    await cam.getByRole('button', { name: 'Cerrar la cámara' }).click();
    await cerrarDialogos();
    await p.evaluate(() => { window.__fpsMax = 120; });
    cam = await abrirCamara();
    const lenta = cam.getByRole('button', { name: 'Cámara lenta (120 fps)' });
    await lenta.waitFor();
    check(await lenta.getAttribute('aria-pressed') === 'false', '(11) con una de 120 fps, «Cámara lenta (120 fps)» sale (apagada)');
    await lenta.click();
    await p.waitForTimeout(1200);
    check(await cam.getByRole('button', { name: /^Cámara lenta/ }).count() === 1 && !(await cam.locator('.camara-error').count()), 'y se puede poner (si la cámara no llega, vuelve a la normal sin error)');
    await cam.getByRole('button', { name: 'Cerrar la cámara' }).click();
    await cerrarDialogos();
    await p.evaluate(() => { delete window.__fpsMax; });

    // ---------------------------------------------------------------- 13. Difuminar la cara (y 9: otro ángulo después)
    await p.locator('.diario').getByRole('button', { name: 'Subir vídeo' }).click();
    const hojaSub = p.getByRole('dialog', { name: 'Subir un vídeo' });
    await hojaSub.locator('input[type=file]').setInputFiles({ name: 'serie.webm', mimeType: 'video/webm', buffer: VIDEO });
    const hojaEnv = p.getByRole('dialog', { name: 'Elegir o grabar el vídeo' });
    await hojaEnv.locator('.recorte-auto', { hasText: 'Recortado solo' }).waitFor({ timeout: 20000 });
    const interruptor = hojaEnv.getByRole('switch', { name: 'Difuminar la cara' });
    check(!(await interruptor.isChecked()), '(13) «Difuminar la cara», apagado de serie');
    await interruptor.check();
    check(await hojaEnv.getByRole('button', { name: 'Primero, la vista previa' }).isDisabled(), 'encendido, no se envía nada hasta tener la vista previa');
    // Sin cara en ningún fotograma: se dice y no se envía
    await p.evaluate(() => { window.__caraPrueba = null; });
    await hojaEnv.getByRole('button', { name: 'Preparar la vista previa' }).click();
    await hojaEnv.getByText('No se ha encontrado tu cara en el vídeo').waitFor({ timeout: 30000 });
    check(await hojaEnv.getByRole('button', { name: 'Primero, la vista previa' }).isDisabled() && !(await hojaEnv.locator('video.difuminado-vista').count()), 'sin cara en el vídeo, lo dice y no deja enviar un vídeo «difuminado» que no lo está');
    await revisar('difuminar-sin-cara');
    // Con su cara
    await p.evaluate(() => { window.__caraPrueba = [0.5, 0.2]; });
    await hojaEnv.getByRole('button', { name: 'Probar otra vez' }).click();
    const previa = hojaEnv.locator('video.difuminado-vista');
    await previa.waitFor({ timeout: 60000 });
    const bytesPrevia = Number(await previa.getAttribute('data-bytes'));
    const tipoPrevia = await previa.getAttribute('data-tipo');
    check(bytesPrevia > 0 && tipoPrevia === formato && /se ha encontrado en el 100 %/.test(await hojaEnv.locator('.difuminar [role=status]').textContent()),
      `con su cara: la vista previa (${tipoPrevia}, ${bytesPrevia} bytes) y cuánto se ha encontrado`);
    await previa.evaluate((v) => new Promise((ok) => { if (v.readyState >= 2) ok(); else v.addEventListener('loadeddata', ok, { once: true }); }));
    await revisar('difuminar-vista-previa');
    await hojaEnv.getByRole('checkbox', { name: 'Añadir otro ángulo de esta serie después' }).check();
    const tamOriginal = VIDEO.length;
    await hojaEnv.getByRole('button', { name: 'Enviar el difuminado' }).click();
    await p.locator('.toast', { hasText: 'Vídeo enviado a tu coach' }).waitFor({ timeout: 20000 });
    let idDif = null;
    check(await enDemo((d) => { const a = d.archivos.filter((x) => x.tipo === 'video_tecnica' && Number(x.bytes) === bytesPrevia); if (a[0]) idDif = a[0].id; return a.length === 1 && a[0].mime === formato; })
      && !(await demo()).archivos.some((x) => x.tipo === 'video_tecnica' && Number(x.bytes) === tamOriginal), '(13) se envía el difuminado (el de la vista previa), nunca el original');
    // 9. «¿Otro ángulo de la misma serie?»
    const otro = p.getByRole('dialog', { name: '¿Otro ángulo de la misma serie?' });
    await otro.waitFor();
    await revisar('otro-angulo');
    const [elegir] = await Promise.all([p.waitForEvent('filechooser'), otro.getByRole('button', { name: 'Elegirlo de la galería' }).click()]);
    await elegir.setFiles({ name: 'frente.webm', mimeType: 'video/webm', buffer: VIDEO });
    await hojaEnv.getByText('Va como otro ángulo de la misma serie').waitFor();
    if (await hojaEnv.getByRole('switch', { name: 'Difuminar la cara' }).isChecked()) await hojaEnv.getByRole('switch', { name: 'Difuminar la cara' }).uncheck();
    await hojaEnv.locator('.recorte-auto', { hasText: 'Recortado solo' }).waitFor({ timeout: 20000 });
    await hojaEnv.getByRole('button', { name: 'Sin recortar' }).click();
    await hojaEnv.getByRole('button', { name: 'Enviar a tu coach' }).click();
    await p.locator('.toast', { hasText: 'Vídeo enviado a tu coach' }).last().waitFor({ timeout: 20000 });
    let idOtro = null;
    check(await enDemo((d) => { const a = d.archivos.find((x) => x.angulo_de === idDif); if (a) idOtro = a.id; return !!a; }), '(9) y el otro ángulo, enlazado al primero');
    if (await hojaSub.isVisible().catch(() => false)) { await hojaSub.getByRole('button', { name: 'Cerrar' }).first().click(); }
    await cerrarDialogos();

    // ---------------------------------------------------------------- 1 y 2. El coach graba su revisión
    await entrarComo('Pelayo');
    await p.locator('.tab', { hasText: 'Atletas' }).first().click();
    await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
    await p.getByRole('tab', { name: 'Vídeos y fotos' }).click();
    const abrirVideo = async (id) => {
      await p.locator(`.diario-item[data-id="${id}"]`).first().click();
      const d = p.getByRole('dialog').filter({ has: p.locator('video.medio') }).last();
      await d.locator('video.medio').first().waitFor();
      await p.waitForFunction(() => [...document.querySelectorAll('[role=dialog] video.medio')].some((v) => v.readyState >= 2), null, { timeout: 15000 });
      return d;
    };
    let det = await abrirVideo(idDif);
    await det.getByRole('button', { name: '4 de 5: Buena' }).click();
    await det.getByRole('button', { name: 'Guardar la corrección' }).click();
    await p.locator('.toast', { hasText: 'Corrección guardada' }).waitFor();
    await det.getByRole('button', { name: 'Grabar la revisión', exact: true }).click();
    const gr = p.getByRole('dialog', { name: 'Grabar la revisión' });
    await gr.locator('video.medio').first().waitFor();
    await p.waitForFunction(() => { const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('aria-label') === 'Grabar la revisión' || x.querySelector('h2')?.textContent === 'Grabar la revisión'); const v = d?.querySelector('video.medio'); return v && v.readyState >= 2; }, null, { timeout: 15000 });
    check((await gr.textContent()).includes('tu voz con el micro'), '(1) antes de empezar dice qué se graba (el reproductor y tu voz con el micro)');
    await gr.getByRole('switch', { name: 'Tu cara en una burbuja (cámara de delante)' }).check();
    await gr.getByRole('button', { name: 'Burbuja arriba a la izquierda' }).click();
    check(await gr.locator('.burbuja-cara.burbuja-arriba-izq').count() === 1 && (await gr.textContent()).includes('tu cara con la cámara de delante'), '(2) con su cara en una burbuja, en la esquina que elige (y lo dice)');
    await revisar('grabar-revision-preparar');
    await gr.getByRole('button', { name: 'Empezar a grabar' }).click();
    await gr.getByRole('button', { name: 'Parar' }).waitFor({ timeout: 10000 });
    await gr.getByRole('button', { name: 'Reproducir' }).first().click();
    await p.waitForTimeout(1500);
    await gr.getByRole('button', { name: '0,5×' }).first().click();
    await p.waitForTimeout(1200);
    check(await p.evaluate(() => [...document.querySelectorAll('video')].some((v) => v.srcObject && v.srcObject.getTracks().some((t) => t.readyState === 'live'))), 'mientras graba, la cámara de delante está abierta');
    await gr.getByRole('button', { name: 'Parar' }).click();
    const rev = gr.locator('video[aria-label="La revisión que acabas de grabar"]');
    await rev.waitFor({ timeout: 15000 });
    const bytesRev = Number(await rev.getAttribute('data-bytes'));
    check(bytesRev > 0 && /^video\/(mp4|webm)$/.test(await rev.getAttribute('data-tipo')), `la revisión grabada, para verla antes de enviarla (${await rev.getAttribute('data-tipo')}, ${bytesRev} bytes)`);
    check(await p.evaluate(() => ![...document.querySelectorAll('video')].some((v) => v.srcObject && v.srcObject.getTracks().some((t) => t.readyState === 'live'))), 'al parar, la cámara y el micro se sueltan');
    check(await gr.getByRole('button', { name: 'Repetir' }).count() === 1, 'con «Enviar» y «Repetir»');
    await revisar('grabar-revision-revisar');
    await gr.getByRole('button', { name: 'Enviar' }).click();
    await p.locator('.toast', { hasText: 'Revisión enviada a Ana' }).waitFor({ timeout: 20000 });
    check(await enDemo((d) => d.comentarios.some((c) => c.archivo_id === idDif && c.autor === 'coach' && c.video_respuesta_id && c.texto === 'Revisión grabada')
      && d.archivos.some((a) => a.tipo === 'adjunto' && /^video\//.test(a.mime) && Number(a.bytes) === bytesRev)), '(1) llega al hilo del vídeo como su respuesta (un vídeo del chat de siempre)');
    await det.locator('video.respuesta-video').first().waitFor({ timeout: 10000 });
    check(true, 'y se ve en el hilo');
    // 2. Responder con la cámara de delante
    await det.getByRole('button', { name: 'Responder con vídeo' }).click();
    const rc = p.getByRole('dialog', { name: 'Responder con vídeo' });
    check(/la cámara de delante y el micro/.test(await rc.textContent()), '(2) «Responder con vídeo» dice qué se graba (hasta un minuto)');
    await rc.getByRole('button', { name: 'Abrir la cámara de delante' }).click();
    await rc.getByRole('button', { name: 'Grabar' }).click();
    await p.waitForTimeout(1500);
    await rc.getByRole('button', { name: 'Parar' }).click();
    const prc = rc.locator('video[aria-label="El vídeo que acabas de grabar"]');
    await prc.waitFor({ timeout: 10000 });
    check(Number(await prc.getAttribute('data-bytes')) > 0, 'graba y lo enseña antes de enviarlo');
    await revisar('responder-con-video');
    await rc.getByRole('button', { name: 'Enviar' }).click();
    await p.locator('.toast', { hasText: 'Vídeo enviado en su hilo' }).waitFor({ timeout: 20000 });
    check(await hay(det.locator('video.respuesta-video'), 2), 'y queda en el hilo (dos respuestas en vídeo)');

    // ---------------------------------------------------------------- 3. Exportar con correcciones
    await det.getByRole('button', { name: 'Exportar con correcciones' }).click();
    const ex = p.getByRole('dialog', { name: 'Exportar con correcciones' });
    check(/sin subir nada/.test(await ex.textContent()) && /la nota/.test(await ex.textContent()), '(3) exportar dice que se hace en el dispositivo, sin subir nada (con la nota)');
    await ex.getByRole('button', { name: 'Preparar el vídeo' }).click();
    const exp = ex.locator('video.exportado');
    await exp.waitFor({ timeout: 60000 });
    const bytesExp = Number(await exp.getAttribute('data-bytes'));
    check(bytesExp > 0 && await exp.getAttribute('data-tipo') === formato, `el vídeo exportado: un Blob de ${bytesExp} bytes, ${await exp.getAttribute('data-tipo')}`);
    const subidosAntes = (await demo()).archivos.length;
    const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), ex.getByRole('button', { name: 'Guardar en el móvil' }).click()]);
    check(/-corregido\.(mp4|webm)$/.test(descarga.suggestedFilename()) && (await demo()).archivos.length === subidosAntes, `«Guardar en el móvil» lo descarga (${descarga.suggestedFilename()}) y no se sube nada`);
    await revisar('exportar-hecho');
    await ex.getByRole('button', { name: 'Cerrar' }).first().click();

    // ---------------------------------------------------------------- 9. Dos ángulos
    await det.getByRole('button', { name: 'Dos ángulos' }).click();
    const da = p.getByRole('dialog', { name: 'Dos ángulos' });
    await da.locator('video.medio').nth(1).waitFor();
    check(await da.locator('video.medio').count() === 2, '(9) «Dos ángulos»: los dos vídeos a la vez');
    await da.getByRole('button', { name: 'Desfase: 0,05 segundos más' }).click();
    await da.getByRole('button', { name: 'Desfase: 0,05 segundos más' }).click();
    await da.getByRole('button', { name: 'Desfase: un fotograma más' }).click();
    check((await da.locator('label[for^="desfase-"]').textContent()).includes('+0,133 s'), `el desfase, de 0,05 s en 0,05 s y de fotograma en fotograma (${(await da.locator('label[for^="desfase-"]').textContent()).trim()})`);
    await da.getByRole('button', { name: 'Reproducir los dos' }).click();
    await p.waitForTimeout(600);
    const sync = await da.locator('video.medio').evaluateAll((vs) => ({ jugando: vs.every((v) => !v.paused), d: vs[1].currentTime - vs[0].currentTime }));
    check(sync.jugando && Math.abs(sync.d - 0.133) < 0.2, `un mando para los dos: se reproducen a la vez, el segundo con su desfase (${sync.d.toFixed(2)} s)`);
    await da.getByRole('button', { name: 'Pausar los dos' }).click();
    await da.getByRole('button', { name: 'Guardar el desfase con la corrección' }).click();
    await p.locator('.toast', { hasText: 'Desfase guardado con la corrección' }).waitFor();
    check(await enDemo((d) => d.video_revisiones.some((r) => r.archivo_id === idDif && r.dos_angulos?.con === idOtro && Math.abs(r.dos_angulos.desfase - 0.133) < 0.001)), 'el coach lo guarda con la corrección');
    await da.getByRole('button', { name: 'Dibujar en este' }).nth(1).click();
    check(await da.locator('.rep-dibujo').count() === 1, 'y dibuja en cualquiera de los dos');
    await da.getByRole('group', { name: 'Dibujar sobre el vídeo' }).getByRole('button', { name: 'Cancelar' }).click();
    const dosA = await p.evaluate(() => { const ps = [...document.querySelectorAll('.dos-angulos-pane')].map((x) => x.getBoundingClientRect()); return ps.length === 2 && ps[1].top >= ps[0].bottom - 1; });
    check(dosA, 'en un móvil, uno encima del otro');
    check(await estrecho('dos-angulos'), 'a 360 px en oscuro, «Dos ángulos» cabe');
    await revisar('dos-angulos');
    await da.getByRole('button', { name: 'Cerrar' }).first().click();
    check(await estrecho('revision-coach-v060'), 'a 360 px en oscuro, la revisión (grabar, exportar, dos ángulos y las respuestas en vídeo) cabe');
    await cerrarDialogos();

    // ---------------------------------------------------------------- La atleta ve las respuestas y contesta con la suya
    await entrarComo('Ana López');
    await p.locator('.tab', { hasText: 'Progreso' }).first().click();
    const detA = await abrirVideo(idDif);
    await detA.locator('video.respuesta-video').nth(1).waitFor({ timeout: 10000 });
    check(await detA.getByRole('button', { name: 'Exportar con correcciones' }).count() === 1 && await detA.getByRole('button', { name: 'Dos ángulos' }).count() === 1, 'Ana ve las dos respuestas en vídeo de su coach, y puede exportar su vídeo corregido y verlo en dos ángulos');
    await detA.getByRole('button', { name: 'Responder con vídeo' }).click();
    const rcA = p.getByRole('dialog', { name: 'Responder con vídeo' });
    await rcA.getByRole('button', { name: 'Abrir la cámara de delante' }).click();
    await rcA.getByRole('button', { name: 'Grabar' }).click();
    await p.waitForTimeout(1200);
    await rcA.getByRole('button', { name: 'Parar' }).click();
    await rcA.locator('video[aria-label="El vídeo que acabas de grabar"]').waitFor({ timeout: 10000 });
    await rcA.getByRole('button', { name: 'Enviar' }).click();
    await p.locator('.toast', { hasText: 'Vídeo enviado a tu coach' }).waitFor({ timeout: 20000 });
    check(await hay(detA.locator('video.respuesta-video'), 3) && await enDemo((d) => d.comentarios.some((c) => c.archivo_id === idDif && c.autor === 'atleta' && c.video_respuesta_id)), '(2) y responde con la suya (la cámara de delante)');
    check(await estrecho('hilo-atleta-v060'), 'a 360 px en oscuro, su vídeo con las respuestas cabe');
    // «Este móvil»: difuminar la cara de serie
    await cerrarDialogos();
    await p.evaluate(() => { location.hash = '#perfil'; });
    const aj = p.getByRole('switch', { name: 'Difuminar la cara al enviar un vídeo' });
    await aj.waitFor({ timeout: 8000 }).catch(() => {});
    if (await aj.count()) {
      await aj.check();
      check(await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes') || '{}').difuminarCara === true), '(13) «Difuminar la cara al enviar un vídeo», de serie en este móvil');
    } else check(false, '(13) el ajuste «Difuminar la cara» de este móvil está en el perfil');
  } catch (e) {
    check(false, `v0.60: el flujo se ha interrumpido: ${e.message.split('\n').slice(0, 10).join('\n      ')}`);
    await p.screenshot({ path: new URL('./e2e-fallo-060.png', import.meta.url).pathname }).catch(() => {});
  }
  void tipoEsperado;
  check(errores.length === 0, errores.length ? `v0.60, sin errores: ${errores.join(' || ')}` : 'v0.60: sin errores de consola, desbordes, controles sin nombre ni fallos de accesibilidad');
  await ctx.close();
}

// Suelto: node test/e2e-videos-060.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4176);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarVideos060({ navegador, check, base: 'http://localhost:4176' });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
