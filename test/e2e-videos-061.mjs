// v0.61: los vídeos de técnica, tanda B (segunda mitad), de punta a punta en la demo (un contexto aparte, a 390 px). Lo llama
// e2e.test.mjs y se puede lanzar suelto (node test/e2e-videos-061.mjs, con dist/ ya construido). Los datos que hacen falta
// (tres vídeos de Ana de una misma sesión por revisar, y vídeos de Carlos con el análisis de la barra guardado y los kilos de su
// serie) se ponen en el almacenamiento de la demo de este contexto, no en la semilla (así no cambia nada de las demás pruebas):
//   · (5) «Revisar la sesión»: la tarjeta «Sesión del … · 3 vídeos», uno detrás de otro en el orden de la sesión (con ← y →),
//     «Revisado y siguiente» y un solo «Resumen de la sesión» (un comentario en la sesión, ninguno por vídeo);
//   · (8) la estela del movimiento: encenderla, que se pinta al reproducir, quieta con «reducir movimiento», apagarla y en
//     «Exportar con correcciones» (con ella y sin ella);
//   · (16) el perfil carga–velocidad: con 2 cargas, sin 1RM; con 3, con su 1RM; el coach cambia la velocidad mínima y Carlos ve
//     lo mismo en «Mi técnica»;
//   · (17) el informe del mes: verlo, mandárselo (la tarjeta en su chat), guardarlo como imagen y Carlos lo abre;
//   · (20) «Subir los vídeos solo con wifi»: no sale donde no se sabe el tipo de conexión (este Chromium); con una conexión
//     «cellular» de prueba, sale, y un vídeo espera («Esperando wifi») hasta «Subir ahora»;
//   · a 360 px en oscuro, con el teclado y sin fallos de accesibilidad.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { centroEn, W as VW, H as VH, DURACION } from '../scripts/video-barra-demo.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const VIDEO = readFileSync(new URL('./video-quieto-mueve.webm', import.meta.url));
const r4 = (x) => Math.round(x * 10000) / 10000;
// La trayectoria de verdad del vídeo de la barra de la demo (el mismo disco que dibuja scripts/video-barra-demo.mjs)
const BARRA = Array.from({ length: Math.floor(DURACION * 30) }, (_, i) => { const t = i / 30; const [x, y] = centroEn(t); return [r4(t), r4(x / VW), r4(y / VH)]; });
const REPS = [[0.4, 1.1, 1.9], [1.9, 2.6, 3.5], [3.5, 4.2, 5.25]];

export async function probarVideos061({ navegador, check, base = 'http://localhost:4174' }) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true, acceptDownloads: true });
  const p = await ctx.newPage();
  const errores = [];
  let sembrando = false; // (la página vacía de sembrar da un 404: no cuenta)
  const vigilar = (pg) => {
    pg.on('pageerror', (e) => { if (!sembrando) errores.push(e.message); });
    pg.on('console', (m) => { if (m.type() === 'error' && !sembrando) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    pg.on('requestfailed', (r) => { if (process.env.DEPURAR) console.log('requestfailed', r.url().slice(0, 80), r.failure()?.errorText); });
  };
  vigilar(p);
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await loc.page().waitForTimeout(100); } return (await loc.count()) === n; };
  const demo = (pg = p) => pg.evaluate(() => JSON.parse(localStorage.getItem('fbe-demo-v2')));
  const enDemo = async (f, veces = 80, pg = p) => { for (let i = 0; i < veces; i++) { if (f(await demo(pg))) return true; await pg.waitForTimeout(150); } return false; };
  async function revisar(paso, pg = p) {
    const vista = pg.viewportSize()?.width || 390;
    const ancho = await pg.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const sinNombre = await pg.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const nombre = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
        const etiqueta = el.id && document.querySelector(`label[for="${el.id}"]`);
        return !nombre && !etiqueta && !el.closest('label');
      }).map((el) => el.outerHTML.slice(0, 90)));
    if (sinNombre.length) errores.push(`${paso}: controles sin nombre accesible: ${sinNombre.join(' | ')}`);
    await pg.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ]));
    if (!(await pg.evaluate(() => !!window.axe))) await pg.addScriptTag({ path: AXE });
    const axe = await pg.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
  }
  const estrecho = async (paso, pg = p) => {
    await pg.setViewportSize({ width: 360, height: 740 });
    await pg.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await pg.waitForTimeout(300);
    await revisar(`${paso}-360-oscuro`, pg);
    const cabe = await pg.evaluate(() => document.documentElement.scrollWidth <= 360);
    await pg.setViewportSize({ width: 390, height: 844 });
    await pg.emulateMedia({ colorScheme: null, reducedMotion: null });
    return cabe;
  };
  const cerrarDialogos = async (pg = p) => {
    for (let i = 0; i < 6; i++) {
      const d = pg.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Seguir', 'Entendido', 'Cerrar', 'Ahora no']) {
        const b2 = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b2.isVisible().catch(() => false)) { await b2.click(); hecho = true; break; }
      }
      if (!hecho) await pg.keyboard.press('Escape');
      await pg.waitForTimeout(250);
    }
  };
  const entrarComo = async (nombre, pg = p) => {
    await cerrarDialogos(pg);
    if (!(await pg.getByRole('heading', { name: 'Entra en tu cuenta' }).isVisible().catch(() => false))) {
      if (!(await pg.getByRole('button', { name: 'Cambiar de cuenta' }).isVisible().catch(() => false))) {
        const hoy = pg.locator('.tab', { hasText: 'Hoy' });
        if (await hoy.count()) await hoy.first().click(); else await pg.locator('.tab', { hasText: 'Atletas' }).click();
        await pg.waitForTimeout(800);
        await cerrarDialogos(pg);
      }
      await pg.getByRole('button', { name: 'Cambiar de cuenta' }).first().click();
    }
    await pg.getByRole('button', { name: new RegExp(nombre) }).first().click();
    const cod = pg.getByLabel('Código', { exact: true });
    await Promise.race([cod.waitFor({ timeout: 8000 }).catch(() => {}), pg.locator('nav.tabs').waitFor()]);
    if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await pg.getByRole('button', { name: 'Entrar' }).click(); }
    await pg.locator('nav.tabs').waitFor();
    await pg.waitForTimeout(800);
    await cerrarDialogos(pg);
  };
  // Pone datos en el almacenamiento de la demo (con la app cerrada: una página vacía del mismo sitio) y vuelve a abrirla
  const sembrar = async (fn, arg) => {
    await p.waitForTimeout(500);
    sembrando = true;
    await p.goto(`${base}/vacio-061`);
    const r = await p.evaluate(fn, arg);
    await p.goto(`${base}/?demo`);
    sembrando = false;
    await Promise.race([p.locator('nav.tabs').waitFor({ timeout: 15000 }), p.getByRole('heading', { name: 'Entra en tu cuenta' }).waitFor({ timeout: 15000 })]);
    if (await p.getByRole('heading', { name: 'Entra en tu cuenta' }).isVisible().catch(() => false)) await entrarComo('Pelayo');
    await p.waitForTimeout(600);
    await cerrarDialogos();
    return r;
  };
  const fichaCarlos = async () => {
    await cerrarDialogos();
    await p.locator('.tab', { hasText: 'Atletas' }).first().click();
    await p.locator('.tarjeta-atleta', { hasText: 'Carlos Vera' }).first().click();
    await p.getByRole('tab', { name: 'Vídeos y fotos' }).click();
    await p.locator('.mi-tecnica').waitFor({ timeout: 15000 });
  };
  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('heading', { name: 'Entra en tu cuenta' }).waitFor();
    await p.waitForFunction(() => !document.getElementById('portada'));
    await entrarComo('Pelayo');
    await p.waitForFunction(() => !!localStorage.getItem('fbe-demo-v2'), null, { timeout: 10000 });

    // ---------------------------------------------------------------- los datos de esta prueba
    const datos = await sembrar(({ barra, reps }) => {
      const d = JSON.parse(localStorage.getItem('fbe-demo-v2'));
      const id = () => crypto.randomUUID();
      const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
      const dia = (n) => { const f = new Date(); f.setDate(f.getDate() - n); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`; };
      const ana = d.atletas.find((a) => a.nombre === 'Ana López'), carlos = d.atletas.find((a) => a.nombre === 'Carlos Vera');
      const sq = d.ejercicios.find((e) => e.nombre === 'Sentadilla barra alta');
      const sesionesDe = (atletaId) => { const bl = new Set(d.bloques.filter((b) => b.atleta_id === atletaId).map((b) => b.id)); const ws = new Set(d.semanas.filter((w) => bl.has(w.bloque_id)).map((w) => w.id)); return d.sesiones.filter((s) => ws.has(s.semana_id) && s.completada).sort((a, b) => (a.fecha_realizada < b.fecha_realizada ? 1 : -1)); };
      const base = { tipo: 'video_tecnica', comentario_coach: null, nota_atleta: null, mime: 'video/mp4', bytes: 21660, duracion_seg: 8, pose: null, destacado: false, nombre: null, paginas: null, repite_de: null, angulo_de: null, fps_captura: null, subido_por: 'atleta', derivado_de: null };
      // 5. Tres vídeos de Ana de una sesión ya hecha (de tres ejercicios con series), por revisar; entran al revés
      let ses = null, ps = [];
      for (const s of sesionesDe(ana.id)) {
        const pp = d.sesion_ejercicios.filter((x) => x.sesion_id === s.id && d.series.some((y) => y.sesion_ejercicio_id === x.id)).sort((a, b) => a.orden - b.orden);
        if (pp.length >= 3 && !d.archivos.some((a) => a.tipo === 'video_tecnica' && pp.some((x) => x.id === a.sesion_ejercicio_id))) { ses = s; ps = pp.slice(0, 3); break; }
      }
      const idsAna = [];
      [...ps].reverse().forEach((pa, i) => {
        const vid = id(); idsAna.unshift(vid);
        const n = Math.min(...d.series.filter((y) => y.sesion_ejercicio_id === pa.id).map((y) => y.numero));
        d.archivos.push({ ...base, id: vid, atleta_id: ana.id, ruta: `${ana.id}/ejemplo-sentadilla.mp4`, poster_ruta: `${ana.id}/ejemplo-sentadilla.mp4.jpg`, fecha: ses.fecha_realizada, sesion_ejercicio_id: pa.id,
          ejercicio_id: pa.ejercicio_id, serie_numero: n, revisado_en: null, creado_en: hace(90 - i * 5) });
      });
      // 8 y 16. Vídeos de Carlos con el análisis de la barra guardado y los kilos de su serie (60 y 80 kg; el de 100, luego)
      const sc = sesionesDe(carlos.id)[0];
      const pauta = { id: id(), sesion_id: sc.id, ejercicio_id: sq.id, orden: 90, prioridad: 'media', series: 3, reps_min: 3, reps_max: 5, rir_objetivo: null, rpe_objetivo: null, carga_sugerida_kg: null, descanso_seg: 180, tempo: null, superserie: null, variante: null, notas: null };
      d.sesion_ejercicios.push(pauta);
      [[1, 60], [2, 80], [3, 100]].forEach(([numero, kg]) => d.series.push({ id: id(), sesion_ejercicio_id: pauta.id, atleta_id: carlos.id, numero, kg, reps: 3, rpe: 8, rir: null, nota: null, registrada_en: hace(60 * 24 * 20), sustituto_id: null }));
      const idsCarlos = [];
      [[1, 0.95, 3], [2, 0.76, 4]].forEach(([numero, vm, nota], i) => {
        const vid = id(); idsCarlos.push(vid);
        d.archivos.push({ ...base, id: vid, atleta_id: carlos.id, ruta: `${carlos.id}/ejemplo-barra.webm`, mime: 'video/webm', bytes: 154584, duracion_seg: 6, fecha: dia(3 - i), sesion_ejercicio_id: pauta.id, ejercicio_id: sq.id, serie_numero: numero,
          revisado_en: hace(60 * (40 - i)), creado_en: hace(60 * (48 - i)), destacado: i === 1 });
        (d.video_revisiones ||= []).push({ archivo_id: vid, atleta_id: carlos.id, puntuacion: nota, tempo: null, voz_archivo_id: null, voz_inicio: null, reps_manual: null, dos_angulos: null,
          checklist: { puntos: [{ t: 'Cadera y pecho suben a la vez', e: 'mal', s: 1.5 }, { t: 'Profundidad', e: 'bien' }] },
          analisis: { v: 1, barra: { p: barra }, reps: reps.map((t, k) => ({ t, vm: Math.round((vm - k * 0.02) * 100) / 100 })) },
          visto_el: dia(2 - i), corregido_en: hace(60 * (40 - i)), actualizado_en: hace(60 * (40 - i)) });
      });
      localStorage.setItem('fbe-demo-v2', JSON.stringify(d));
      return { anaId: ana.id, carlosId: carlos.id, sesId: ses?.id || null, sesNombre: ses?.nombre || '', idsAna, ejAna: ps.map((x) => d.ejercicios.find((e) => e.id === x.ejercicio_id)?.nombre || ''), idsCarlos, pauta: pauta.id, sq: sq.id,
        enSesion: d.archivos.filter((a) => a.tipo === 'video_tecnica' && !a.revisado_en && ps.some((x) => x.id === a.sesion_ejercicio_id)).length };
    }, { barra: BARRA, reps: REPS });
    check(!!datos.sesId && datos.idsAna.length === 3 && datos.enSesion === 3, `(prueba) tres vídeos de Ana de «${datos.sesNombre}» por revisar y dos de Carlos con su análisis`);

    // ---------------------------------------------------------------- 5. Revisar la sesión
    await p.locator('.tab', { hasText: 'Revisar' }).first().click();
    const tarjeta = p.locator('.tarjeta-sesion-videos', { hasText: 'Ana López' });
    await tarjeta.waitFor({ timeout: 15000 });
    const tit = await tarjeta.locator('.revisar-cab').textContent();
    check(/Sesión (de|del) .+ · 3 vídeos/.test(tit) && await tarjeta.locator('.sesion-videos-lista li').count() === 3 && !(await p.locator(`.tarjeta-revisar:not(.tarjeta-sesion-videos) [data-id="${datos.idsAna[0]}"]`).count()),
      `(5) en Revisar, una sola tarjeta para la sesión («${tit.replace(/\s+/g, ' ').trim().slice(0, 60)}»), con sus tres vídeos`);
    check(igualOrden(await tarjeta.locator('.sesion-videos-lista li .peq').allTextContents(), datos.ejAna), 'en el orden de los ejercicios de la sesión');
    await revisar('revisar-tarjeta-sesion');
    check(await estrecho('revisar-tarjeta-sesion'), 'a 360 px en oscuro, la tarjeta de la sesión cabe');
    await tarjeta.getByRole('button', { name: 'Revisar la sesión' }).click();
    const rs = p.getByRole('dialog', { name: /^Revisar la sesión/ });
    await rs.waitFor();
    const contador = rs.locator('.seguida-contador');
    check((await contador.textContent()) === 'Vídeo 1 de 3' && (await rs.locator('.seguida-tarjeta .separa .mini').first().textContent()).startsWith(datos.ejAna[0]), '«Revisar la sesión»: el primero, el del primer ejercicio de la sesión');
    await rs.locator('.sesion-series').waitFor();
    check(/la del vídeo/.test(await rs.locator('.sesion-series').textContent()), 'con las series de ese ejercicio a la vista (la del vídeo, marcada)');
    await rs.locator('.sesion-series').getByRole('button', { name: 'Toda la sesión' }).click();
    check(await rs.locator('.sesion-series-lista li').count() >= 3 && await rs.locator('.sesion-series-lista li.actual').count() === 1, 'y la sesión entera, con su ejercicio señalado');
    await revisar('revisar-sesion-primero');
    await rs.locator('.seguida-cerrar').focus();
    await p.keyboard.press('ArrowRight');
    check(await contador.textContent() === 'Vídeo 2 de 3', 'con → pasa al siguiente');
    await p.keyboard.press('ArrowLeft');
    check(await contador.textContent() === 'Vídeo 1 de 3', 'y con ← vuelve');
    await rs.getByRole('button', { name: 'Revisado y siguiente' }).click();
    await p.locator('.toast', { hasText: 'Vídeo revisado' }).waitFor();
    check(await contador.textContent() === 'Vídeo 2 de 3' && await enDemo((d) => !!d.archivos.find((a) => a.id === datos.idsAna[0])?.revisado_en), '«Revisado y siguiente», vídeo a vídeo, como siempre');
    await rs.getByRole('button', { name: 'Siguiente vídeo' }).click();
    check(await contador.textContent() === 'Vídeo 3 de 3' && await rs.getByRole('button', { name: 'Al resumen' }).count() === 1, 'el último, y «Al resumen»');
    await rs.getByRole('button', { name: 'Al resumen' }).click();
    const area = rs.getByLabel(/Tu resumen para Ana/);
    await area.waitFor();
    for (let fin = Date.now() + 10000; Date.now() < fin && !(await area.inputValue()).startsWith('Resumen'); ) await p.waitForTimeout(100);
    const borrador = await area.inputValue();
    check(borrador.startsWith('Resumen de la sesión, Ana:') && datos.ejAna.every((n) => borrador.includes(`· ${n}`)), 'al final, el borrador del resumen, con una línea por vídeo');
    await area.fill(`${borrador}Muy buena sesión: sigue así.`);
    await revisar('revisar-sesion-resumen');
    check(await estrecho('revisar-sesion-resumen'), 'a 360 px en oscuro, el resumen cabe');
    const coachAntes = (await demo()).comentarios.filter((c) => c.autor === 'coach').length;
    await rs.getByRole('button', { name: 'Enviar el resumen' }).click();
    await p.locator('.toast', { hasText: 'Resumen enviado a Ana' }).waitFor();
    check(await enDemo((dR) => dR.comentarios.filter((c) => c.autor === 'coach').length - coachAntes === 1 && dR.comentarios.filter((c) => c.sesion_id === datos.sesId && c.autor === 'coach' && c.texto.startsWith('Resumen de la sesión')).length === 1
      && !dR.comentarios.some((c) => datos.idsAna.includes(c.archivo_id) && c.autor === 'coach')), '(5) un solo mensaje para toda la sesión, en su hilo (ninguno por vídeo)');
    check(await rs.getByText('Ya le has mandado el resumen de esta sesión').count() === 1 && await rs.getByRole('button', { name: 'Enviar el resumen' }).count() === 0, 'y ya no se puede mandar otra vez');
    await p.keyboard.press('Escape');
    await rs.waitFor({ state: 'detached' });

    // ---------------------------------------------------------------- 16. El perfil, con dos cargas: sin 1RM
    await fichaCarlos();
    const perfil = p.locator('.perfil-velocidad');
    await perfil.waitFor({ timeout: 15000 });
    check(/Estimación experimental/.test(await perfil.textContent()) && /al menos 3 cargas distintas \(ahora, 2 cargas\)/.test(await perfil.textContent()) && await perfil.locator('.perfil-e1rm').count() === 0
      && await perfil.locator('.perfil-punto').count() === 2, '(16) con dos cargas, el perfil (sus dos puntos), sin 1RM: lo dice');
    await revisar('perfil-dos-cargas');

    // ---------------------------------------------------------------- 8. La estela del movimiento
    await p.locator(`.diario-item[data-id="${datos.idsCarlos[0]}"]`).first().click();
    const det = p.getByRole('dialog').filter({ has: p.locator('video.medio') }).last();
    await det.locator('video.medio').first().waitFor();
    await p.waitForFunction(() => [...document.querySelectorAll('[role=dialog] video.medio')].some((v) => v.readyState >= 2), null, { timeout: 15000 });
    const estela = det.getByRole('button', { name: 'Estela' });
    await estela.waitFor({ timeout: 10000 });
    check(await estela.getAttribute('aria-pressed') === 'false' && await det.locator('.capa-estela').count() === 0, '(8) «Estela» sale (con el análisis guardado), apagada');
    await estela.click();
    await det.locator('.capa-estela').waitFor();
    await det.getByRole('button', { name: 'Reproducir' }).first().click();
    await p.waitForTimeout(1400);
    const segs = Number(await det.locator('.capa-estela').getAttribute('data-segmentos'));
    await det.getByRole('button', { name: 'Pausar' }).first().click().catch(() => {});
    check(segs > 3 && segs < BARRA.length - 1 && await estela.getAttribute('aria-pressed') === 'true', `encendida, al reproducir se pinta la estela de los últimos fotogramas (${segs} tramos)`);
    check(await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-estela') || '{}').activa === true), 'y se recuerda en este móvil');
    await revisar('estela');
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await det.getByRole('button', { name: 'Fotograma siguiente' }).first().click();
    await p.waitForTimeout(300);
    const quieta = det.locator('.capa-estela.quieta');
    check(await quieta.count() === 1 && Number(await quieta.getAttribute('data-segmentos')) >= BARRA.length - 2, 'con «reducir movimiento», la trayectoria entera y quieta');
    await p.emulateMedia({ reducedMotion: null });
    // En «Exportar con correcciones»
    await det.getByRole('button', { name: 'Exportar con correcciones' }).click();
    const exp = p.getByRole('dialog', { name: 'Exportar con correcciones' });
    const conEstela = exp.getByRole('checkbox', { name: /Con la estela del movimiento/ });
    await conEstela.waitFor();
    check(await conEstela.isChecked(), 'al exportar, «Con la estela del movimiento», encendida (como en el reproductor)');
    await revisar('exportar-estela');
    await exp.getByRole('button', { name: 'Preparar el vídeo' }).click();
    const hecho = exp.locator('video.exportado');
    await hecho.waitFor({ timeout: 40000 });
    const conE = Number(await hecho.getAttribute('data-estela'));
    await exp.getByRole('button', { name: 'Hacerlo otra vez' }).click();
    await conEstela.uncheck();
    await exp.getByRole('button', { name: 'Preparar el vídeo' }).click();
    await hecho.waitFor({ timeout: 40000 });
    const sinE = Number(await hecho.getAttribute('data-estela'));
    check(conE > 10 && sinE === 0, `(8) el vídeo exportado lleva la estela (en ${conE} fotogramas) y, sin ella, no (${sinE})`);
    await exp.getByRole('button', { name: 'Cerrar' }).first().click();
    await estela.click();
    check(await estela.getAttribute('aria-pressed') === 'false' && await hay(det.locator('.capa-estela'), 0), 'y se apaga');
    await cerrarDialogos();

    // ---------------------------------------------------------------- 16. Con tres cargas: el 1RM; la velocidad mínima del coach
    await sembrar(({ carlosId, pauta, sq, barra, reps }) => {
      const d = JSON.parse(localStorage.getItem('fbe-demo-v2'));
      const vid = crypto.randomUUID();
      const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
      const f = new Date(); f.setDate(f.getDate() - 1);
      const fecha = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
      d.archivos.push({ id: vid, atleta_id: carlosId, tipo: 'video_tecnica', ruta: `${carlosId}/ejemplo-barra.webm`, mime: 'video/webm', bytes: 154584, duracion_seg: 6, fecha, sesion_ejercicio_id: pauta, ejercicio_id: sq, serie_numero: 3,
        revisado_en: hace(300), creado_en: hace(400), comentario_coach: null, nota_atleta: null, poster_ruta: null, pose: null, destacado: false, nombre: null, paginas: null, repite_de: null, angulo_de: null, fps_captura: null, subido_por: 'atleta', derivado_de: null });
      d.video_revisiones.push({ archivo_id: vid, atleta_id: carlosId, puntuacion: 4, checklist: null, tempo: null, voz_archivo_id: null, voz_inicio: null, reps_manual: null, dos_angulos: null,
        analisis: { v: 1, barra: { p: barra }, reps: reps.map((t) => ({ t, vm: 0.61 })) }, visto_el: fecha, corregido_en: hace(300), actualizado_en: hace(300) });
      localStorage.setItem('fbe-demo-v2', JSON.stringify(d));
    }, { carlosId: datos.carlosId, pauta: datos.pauta, sq: datos.sq, barra: BARRA, reps: REPS });
    await fichaCarlos();
    await p.locator('.perfil-e1rm-cifra').waitFor({ timeout: 15000 });
    const e1 = (await p.locator('.perfil-e1rm-cifra').textContent()).trim();
    check(/^\d+(,\d)? kg$/.test(e1) && /3 cargas distintas/.test(await perfil.textContent()) && /R² /.test(await perfil.textContent()) && /de serie para sentadilla/.test(await perfil.textContent()),
      `(16) con tres cargas, el 1RM estimado (${e1}), su R² y la velocidad mínima de serie de la sentadilla`);
    check(/Solo con 3 cargas distintas/.test(await perfil.textContent()), 'con el aviso de que son pocas cargas');
    await revisar('perfil-tres-cargas');
    check(await estrecho('perfil-tres-cargas'), 'a 360 px en oscuro, el perfil cabe');
    await perfil.getByRole('button', { name: 'Cambiarla' }).click();
    const umb = perfil.getByLabel(/Velocidad mínima de Sentadilla barra alta/);
    await umb.fill('0,25');
    await perfil.getByRole('button', { name: 'Guardar', exact: true }).click();
    await p.locator('.toast', { hasText: 'Velocidad mínima de Sentadilla barra alta' }).waitFor();
    await p.waitForFunction((antes) => document.querySelector('.perfil-e1rm-cifra')?.textContent.trim() !== antes, e1);
    const e1b = (await p.locator('.perfil-e1rm-cifra').textContent()).trim();
    check(e1b !== e1 && await enDemo((d) => d.umbrales_velocidad?.some((u) => u.ejercicio_id === datos.sq && Number(u.vmin) === 0.25)) && /\(la tuya para este ejercicio\)/.test(await perfil.textContent()),
      `el coach cambia la velocidad mínima (0,25 m/s): el 1RM pasa a ${e1b}`);

    // ---------------------------------------------------------------- 17. El informe del mes
    const chips = p.locator('.informes-mes .selector-chips button');
    await chips.first().waitFor();
    const nombreMes = (await chips.first().textContent()).trim();
    await chips.first().click();
    const inf = p.getByRole('dialog', { name: `Informe de técnica · ${nombreMes}` });
    await inf.locator('.informe-cifras').waitFor({ timeout: 15000 });
    const textoInf = await inf.textContent();
    const cifrasCoach = await inf.locator('.informe-cifras').textContent();
    check(/Vídeos enviados/.test(textoInf) && /Se revisan en/.test(textoInf) && /Cadera y pecho suben a la vez/.test(textoInf) && /El mejor vídeo del mes/.test(textoInf),
      `(17) el informe de ${nombreMes}: enviados, revisados, en cuántos días, lo que más sale a corregir y el mejor vídeo`);
    await revisar('informe-mes');
    check(await estrecho('informe-mes'), 'a 360 px en oscuro, el informe cabe');
    const [descarga] = await Promise.all([p.waitForEvent('download'), inf.getByRole('button', { name: 'Guardar como imagen' }).click()]);
    check(/^informe-tecnica-\d{4}-\d{2}\.png$/.test(descarga.suggestedFilename()) && readFileSync(await descarga.path()).subarray(1, 4).toString() === 'PNG', `«Guardar como imagen»: un PNG hecho en el móvil (${descarga.suggestedFilename()})`);
    await inf.getByRole('button', { name: 'Mandárselo a Carlos' }).click();
    await p.locator('.toast', { hasText: 'Informe enviado a Carlos' }).waitFor();
    check(await enDemo((d) => d.comentarios.filter((c) => c.atleta_id === datos.carlosId && c.autor === 'coach' && c.texto === `Tu informe de técnica de ${nombreMes}`).length === 1)
      && await inf.getByText('Ya se lo has mandado').count() === 1, 'se lo manda: un mensaje en su chat (y ya no se manda otra vez)');
    await cerrarDialogos();

    // Carlos: la tarjeta en su chat, el informe y el mismo 1RM en «Mi técnica»
    await entrarComo('Carlos Vera');
    await p.locator('.tab', { hasText: 'Mensajes' }).first().click();
    const tj = p.locator('.tarjeta-informe-chat');
    await tj.waitFor({ timeout: 15000 });
    check((await tj.textContent()).includes(nombreMes), '(17) Carlos tiene la tarjeta del informe en su chat');
    await revisar('chat-tarjeta-informe');
    await tj.getByRole('button', { name: 'Ver el informe' }).click();
    const infA = p.getByRole('dialog', { name: `Informe de técnica · ${nombreMes}` });
    await infA.locator('.informe-cifras').waitFor({ timeout: 15000 });
    check((await infA.locator('.informe-cifras').textContent()) === cifrasCoach, 'y lo abre en la app: el mismo informe que su coach');
    check(await infA.getByRole('button', { name: /Mandárselo/ }).count() === 0, 'él no lo manda a nadie');
    await cerrarDialogos();
    await p.locator('.tab', { hasText: 'Progreso' }).first().click();
    await p.locator('.mi-tecnica .perfil-e1rm-cifra').waitFor({ timeout: 15000 });
    check((await p.locator('.mi-tecnica .perfil-e1rm-cifra').textContent()).trim() === e1b && /la de tu coach para este ejercicio/.test(await p.locator('.mi-tecnica .perfil-velocidad').textContent())
      && await p.locator('.mi-tecnica .perfil-velocidad').getByRole('button', { name: 'Cambiarla' }).count() === 0,
      `(16) en «Mi técnica», Carlos ve el mismo 1RM (${e1b}) con la velocidad mínima de su coach (sin poder cambiarla)`);
    await revisar('mi-tecnica-perfil');

    // ---------------------------------------------------------------- 20. Solo con wifi
    await p.evaluate(() => { location.hash = '#perfil'; });
    await p.locator('#grupo-este-movil').waitFor({ timeout: 10000 }).catch(() => {});
    const tipo = await p.evaluate(() => navigator.connection?.type ?? null);
    check(tipo === null && await p.getByRole('switch', { name: 'Subir los vídeos solo con wifi' }).count() === 0, '(20) donde el navegador no dice el tipo de conexión (este Chromium, como el iPhone o el ordenador), la opción no sale');
  } catch (e) {
    check(false, `v0.61: el flujo se ha interrumpido: ${e.message.split('\n').slice(0, 10).join('\n      ')}`);
    await p.screenshot({ path: new URL('./e2e-fallo-061.png', import.meta.url).pathname }).catch(() => {});
  }
  await ctx.close();

  // 20. Con una conexión de datos móviles de prueba (como Chrome de Android)
  const ctx2 = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true });
  await ctx2.addInitScript(() => {
    const c = new EventTarget();
    c.type = 'cellular'; c.effectiveType = '4g'; c.saveData = false;
    window.__conexion = c;
    Object.defineProperty(Navigator.prototype, 'connection', { get: () => c, configurable: true });
  });
  const q = await ctx2.newPage();
  vigilar(q);
  try {
    await q.goto(`${base}/?demo`);
    await q.getByRole('heading', { name: 'Entra en tu cuenta' }).waitFor();
    await q.waitForFunction(() => !document.getElementById('portada'));
    await entrarComo('Ana López', q);
    await q.evaluate(() => { location.hash = '#perfil'; });
    const sw = q.getByRole('switch', { name: 'Subir los vídeos solo con wifi' });
    await sw.waitFor({ timeout: 10000 });
    check(!(await sw.isChecked()), '(20) con datos móviles (Chrome de Android), «Subir los vídeos solo con wifi» sale, apagada');
    await sw.check();
    check(await q.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes') || '{}').soloWifi === true), 'y se guarda en este móvil');
    await revisar('ajuste-solo-wifi', q);
    await q.locator('.tab', { hasText: 'Progreso' }).first().click();
    await q.locator('.diario').getByRole('button', { name: 'Subir vídeo' }).click();
    const hojaSub = q.getByRole('dialog', { name: 'Subir un vídeo' });
    await hojaSub.locator('input[type=file]').setInputFiles({ name: 'serie-wifi.webm', mimeType: 'video/webm', buffer: VIDEO });
    const hojaEnv = q.getByRole('dialog', { name: 'Elegir o grabar el vídeo' });
    await hojaEnv.locator('.recorte-auto', { hasText: 'Recortado solo' }).waitFor({ timeout: 20000 });
    await hojaEnv.getByRole('button', { name: 'Sin recortar' }).click();
    await hojaEnv.getByRole('button', { name: 'Enviar a tu coach' }).click();
    await q.locator('.toast', { hasText: 'Esperando wifi' }).waitFor({ timeout: 15000 });
    await cerrarDialogos(q);
    const banda = q.locator('.banda-espera');
    await banda.waitFor({ timeout: 10000 });
    check(/Esperando wifi/.test(await banda.textContent()) && !(await demo(q)).archivos.some((a) => a.tipo === 'video_tecnica' && Number(a.bytes) === VIDEO.length),
      '(20) el vídeo se queda en el móvil, «Esperando wifi» (no se sube nada)');
    await revisar('esperando-wifi', q);
    check(await estrecho('esperando-wifi', q), 'a 360 px en oscuro, el aviso cabe');
    await banda.getByRole('button', { name: 'Subir ahora' }).click();
    await q.locator('.toast', { hasText: 'Vídeo pendiente enviado a tu coach' }).waitFor({ timeout: 20000 });
    check(await enDemo((d) => d.archivos.some((a) => a.tipo === 'video_tecnica' && Number(a.bytes) === VIDEO.length), 80, q) && await hay(q.locator('.banda-espera'), 0), '«Subir ahora» lo sube igual (con datos móviles)');
    // Y si vuelve la wifi, lo que espera sale solo (el evento «change» de la conexión)
    await q.locator('.diario').getByRole('button', { name: 'Subir vídeo' }).click();
    await hojaSub.locator('input[type=file]').setInputFiles({ name: 'serie-wifi-2.webm', mimeType: 'video/webm', buffer: VIDEO });
    await hojaEnv.locator('.recorte-auto', { hasText: 'Recortado solo' }).waitFor({ timeout: 20000 });
    await hojaEnv.getByRole('button', { name: 'Sin recortar' }).click();
    await hojaEnv.getByRole('button', { name: 'Enviar a tu coach' }).click();
    await q.locator('.toast', { hasText: 'Esperando wifi' }).last().waitFor({ timeout: 15000 });
    await cerrarDialogos(q);
    await q.locator('.banda-espera').waitFor();
    await q.evaluate(() => { window.__conexion.type = 'wifi'; window.__conexion.dispatchEvent(new Event('change')); });
    check(await enDemo((d) => d.archivos.filter((a) => a.tipo === 'video_tecnica' && Number(a.bytes) === VIDEO.length).length === 2, 100, q) && await hay(q.locator('.banda-espera'), 0, 15000),
      'al conectarse a una wifi, lo que esperaba se sube solo');
    // (revisión M1) Un vídeo que sigue subiendo en segundo plano y, mientras, se graba o se elige otro: los dos llegan
    await q.evaluate(() => localStorage.setItem('fbe-demo-subida-lenta', '20000'));
    const notas = (d) => d.archivos.filter((a) => a.tipo === 'video_tecnica').map((a) => a.nota_atleta);
    await q.locator('.diario').getByRole('button', { name: 'Subir vídeo' }).click();
    await hojaSub.locator('input[type=file]').setInputFiles({ name: 'serie-1.webm', mimeType: 'video/webm', buffer: VIDEO });
    await hojaEnv.locator('.recorte-auto', { hasText: 'Recortado solo' }).waitFor({ timeout: 20000 });
    await hojaEnv.getByRole('button', { name: 'Sin recortar' }).click();
    await hojaEnv.getByLabel('¿Qué quieres que mire?').fill('Serie 1, la que sigue sola');
    await hojaEnv.getByRole('button', { name: 'Enviar a tu coach' }).click();
    await hojaEnv.getByRole('button', { name: 'Seguir en segundo plano' }).click();
    await hojaEnv.waitFor({ state: 'detached' });
    check(await q.locator('.pildora-subida').count() === 1 && await hojaSub.isVisible(), '(revisión M1) «Seguir en segundo plano»: la hoja se cierra, la píldora dice cómo va y se puede enviar otro');
    await hojaSub.locator('input[type=file]').setInputFiles({ name: 'serie-2.webm', mimeType: 'video/webm', buffer: VIDEO });
    await hojaEnv.locator('.recorte-auto', { hasText: 'Recortado solo' }).waitFor({ timeout: 20000 });
    await hojaEnv.getByRole('button', { name: 'Sin recortar' }).click();
    await hojaEnv.getByLabel('¿Qué quieres que mire?').fill('Serie 2, grabada mientras');
    await hojaEnv.getByRole('button', { name: 'Enviar a tu coach' }).click();
    const dosALaVez = await q.locator('.pildora-subida[data-n="2"]').waitFor({ timeout: 15000 }).then(() => true, () => false);
    check(await enDemo((d) => notas(d).includes('Serie 1, la que sigue sola') && notas(d).includes('Serie 2, grabada mientras'), 200, q),
      `y llegan los dos: el que siguió solo y el que se envió mientras (no se pierde ninguno)${dosALaVez ? ', con la píldora contando los dos' : ''}`);
    check(dosALaVez && await hay(q.locator('.pildora-subida'), 0, 40000), '(revisión L3) la píldora cuenta las dos subidas y solo se va cuando acaban todas');
    await q.evaluate(() => localStorage.removeItem('fbe-demo-subida-lenta'));
  } catch (e) {
    check(false, `v0.61 (solo con wifi): el flujo se ha interrumpido: ${e.message.split('\n').slice(0, 10).join('\n      ')}`);
    await q.screenshot({ path: new URL('./e2e-fallo-061.png', import.meta.url).pathname }).catch(() => {});
  }
  check(errores.length === 0, errores.length ? `v0.61, sin errores: ${errores.join(' || ')}` : 'v0.61: sin errores de consola, desbordes, controles sin nombre ni fallos de accesibilidad');
  await ctx2.close();
}
const igualOrden = (a, b) => a.length === b.length && a.every((x, i) => x.trim() === b[i]);

// Suelto: node test/e2e-videos-061.mjs (con dist/ ya construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4178);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarVideos061({ navegador, check, base: 'http://localhost:4178' });
  await navegador.close(); srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
