// v0.62: «Avisar aunque bloquees el móvil» y el descanso en la pantalla de bloqueo, de punta a punta en la demo (contextos
// aparte, a 390 px). Lo llama e2e.test.mjs y se puede lanzar suelto (node test/e2e-pista-062.mjs, con dist/ ya construido).
//   · el ajuste no sale donde no puede funcionar (este Chromium de escritorio; un iPhone sin audioSession) y sí en un iPhone
//     con Safari 16.4+ (el agente de iPhone y un navigator.audioSession de prueba), con lo que cuesta (la música se pausa);
//   · «Probar con el móvil bloqueado»: arranca la pista de prueba y se suelta al apagarlo;
//   · con él encendido, marcar una serie arranca la pista (el <audio> suena, el MP3 compuesto dura lo que debe, la sesión de
//     audio pasa a «playback») y la pantalla de bloqueo (Media Session) dice «Descanso · m:ss», «FBE Equipo» y lo siguiente;
//   · +15 rehace la pista; los botones de la pantalla de bloqueo (los handlers de Media Session) pausan, siguen y suman 15 s;
//   · al acabar, suena el aviso de la pista y la voz del móvil dice la serie siguiente una sola vez (sin cuenta hablada ni
//     pitidos de la página), y se anula el aviso al móvil; el aviso al móvil se programa igual (con la carga);
//   · «Saltar» la para y lo suelta todo (vuelve «ambient»); fuera de la sesión, la píldora la lleva y ⏭ la salta;
//   · a 360 px en oscuro, con el teclado y sin fallos de accesibilidad.
import { createRequire } from 'node:module';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

export async function probarPista062({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const vigilar = (pg) => {
    pg.on('pageerror', (e) => errores.push(e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  };
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await loc.page().waitForTimeout(100); } return (await loc.count()) === n; };
  const esperar = async (pg, f, arg, ms = 10000) => { try { await pg.waitForFunction(f, arg, { timeout: ms }); return true; } catch { return false; } };
  async function revisar(paso, pg) {
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
  const estrecho = async (paso, pg) => {
    await pg.setViewportSize({ width: 360, height: 740 });
    await pg.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await pg.waitForTimeout(300);
    await revisar(`${paso}-360-oscuro`, pg);
    const cabe = await pg.evaluate(() => document.documentElement.scrollWidth <= 360);
    await pg.setViewportSize({ width: 390, height: 844 });
    await pg.emulateMedia({ colorScheme: null, reducedMotion: null });
    return cabe;
  };
  const cerrarDialogos = async (pg) => {
    for (let i = 0; i < 6; i++) {
      const d = pg.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no']) {
        const b2 = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b2.isVisible().catch(() => false)) { await b2.click(); hecho = true; break; }
      }
      if (!hecho) await pg.keyboard.press('Escape');
      await pg.waitForTimeout(250);
    }
  };
  async function entrarAna(pg) {
    await pg.goto(`${base}/?demo`);
    await pg.getByRole('button', { name: /Ana López/ }).first().click();
    const cod = pg.getByLabel('Código', { exact: true });
    await Promise.race([cod.waitFor({ timeout: 8000 }).catch(() => {}), pg.locator('nav.tabs').waitFor()]);
    if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await pg.getByRole('button', { name: 'Entrar' }).click(); }
    await pg.locator('nav.tabs').waitFor();
    await pg.waitForTimeout(800);
    await cerrarDialogos(pg);
  }
  async function hojaSonido(pg) {
    await cerrarDialogos(pg);
    await pg.evaluate(() => { location.hash = '#perfil'; });
    await pg.getByRole('button', { name: /^Sonido y vibración/ }).click();
    const h = pg.getByRole('dialog', { name: 'Sonido y vibración' });
    await h.waitFor();
    return h;
  }

  // ---------------------------------------------------------------- dónde no sale
  for (const [nombre, opciones, init] of [
    ['este Chromium de escritorio', {}, null],
    ['un iPhone sin audioSession (Safari de antes de la 16.4)', { userAgent: IPHONE }, () => { try { delete Navigator.prototype.audioSession; } catch { /* */ } }],
  ]) {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true, ...opciones });
    if (init) await ctx.addInitScript(init);
    const pg = await ctx.newPage();
    vigilar(pg);
    try {
      await entrarAna(pg);
      const h = await hojaSonido(pg);
      check(await h.getByLabel('Entrenador por voz').count() === 1 && await h.locator('#aj-bloqueo').count() === 0,
        `«Avisar aunque bloquees el móvil» no sale en ${nombre} (no funcionaría)`);
    } catch (e) { check(false, `sin el ajuste en ${nombre}: ${e.message.split('\n')[0]}`); }
    await ctx.close();
  }

  // ---------------------------------------------------------------- un iPhone con Safari 16.4+
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true, userAgent: IPHONE });
  await ctx.grantPermissions(['notifications'], { origin: base });
  await ctx.addInitScript(() => {
    // La sesión de audio de Safari (navigator.audioSession), de prueba: se apunta cada tipo que le ponen
    const s = { _t: 'auto', tipos: [] };
    Object.defineProperty(s, 'type', { get() { return this._t; }, set(v) { this._t = v; this.tipos.push(v); } });
    Object.defineProperty(navigator, 'audioSession', { value: s, configurable: true });
    // Los botones de la pantalla de bloqueo: se guardan para poder «tocarlos» desde la prueba
    window.__acciones = {};
    if (navigator.mediaSession) {
      const orig = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
      navigator.mediaSession.setActionHandler = (k, f) => { if (f) window.__acciones[k] = f; else delete window.__acciones[k]; try { orig(k, f); } catch { /* */ } };
    }
    // El aviso al móvil (programar_descanso / cancelar_descanso): la demo deja su base en __fbeDemo antes de crear la api
    window.__rpcs = [];
    let demo = null;
    Object.defineProperty(window, '__fbeDemo', { configurable: true, get: () => demo, set: (v) => {
      demo = v;
      const o = v.rpc.bind(v);
      v.rpc = (n, a) => { if (/descanso/.test(n)) window.__rpcs.push([n, a || {}]); return o(n, a); };
    } });
    // Lo que dice la voz del móvil
    window.__habla = [];
    if (window.speechSynthesis) {
      const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = (u) => { if (u.text) window.__habla.push(u.text); try { orig(u); } catch { /* */ } };
    }
  });
  const p = await ctx.newPage();
  vigilar(p);
  const pista = () => p.evaluate(() => {
    const a = document.getElementById('fbe-pista');
    const m = navigator.mediaSession;
    return a ? { src: a.getAttribute('src') || '', paused: a.paused, fin: Number(a.dataset.fin) || null, cue: Number(a.dataset.cue) || null, duracionPlan: Number(a.dataset.duracion) || null,
      duracion: a.duration, final: a.dataset.final || '', tiempo: a.currentTime, tipo: navigator.audioSession.type, titulo: m?.metadata?.title || null, artista: m?.metadata?.artist || null,
      album: m?.metadata?.album || null, arte: (m?.metadata?.artwork || []).map((x) => x.src), estado: m?.playbackState || null, acciones: Object.keys(window.__acciones).sort().join() } : null;
  });
  const rpcs = () => p.evaluate(() => window.__rpcs || []);
  try {
    await entrarAna(p);
    // ---------- el ajuste
    let h = await hojaSonido(p);
    const fila = h.locator('#aj-bloqueo');
    const ayuda = await h.locator('label[for="aj-bloqueo"]').textContent();
    check(await fila.count() === 1 && !(await fila.isChecked()) && /aunque el móvil esté bloqueado o en silencio/.test(ayuda) && /pantalla de bloqueo enseña lo que queda/.test(ayuda)
      && /tu música \(Spotify, Apple Music…\) se pausa en cada descanso/.test(ayuda) && await h.getByRole('button', { name: 'Probar con el móvil bloqueado' }).count() === 0,
      'en un iPhone con Safari 16.4+, «Avisar aunque bloquees el móvil» sale apagado, junto al entrenador por voz, y dice lo que cuesta: la música se pausa en cada descanso');
    await h.getByLabel('Entrenador por voz').check();
    await fila.check();
    await h.getByRole('button', { name: 'Probar con el móvil bloqueado' }).waitFor();
    const ayuda2 = await h.locator('label[for="aj-bloqueo"]').textContent();
    check(await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes')).vozBloqueo === true) && /no habla la voz del móvil: suena el aviso/.test(ayuda2),
      'al encenderlo se guarda en el móvil y, con la voz encendida, avisa de que con el móvil bloqueado suena el aviso (no la voz del móvil)');
    await revisar('ajuste-bloqueo', p);
    check(await estrecho('ajuste-bloqueo', p), 'la hoja de «Sonido y vibración» cabe a 360 px en oscuro');
    // Probar: una pista de 10 s
    await esperar(p, () => true, null, 300);
    await h.getByRole('button', { name: 'Probar con el móvil bloqueado' }).click();
    await esperar(p, () => !!document.getElementById('fbe-pista')?.getAttribute('src'));
    const pr = await pista();
    check(pr && pr.src.startsWith('blob:') && !pr.paused && pr.tipo === 'playback' && pr.titulo?.startsWith('Prueba del aviso') && pr.artista === 'FBE Equipo' && pr.cue >= 9900 && pr.cue <= 10100,
      `«Probar con el móvil bloqueado» arranca una pista de 10 s en «playback», con su título en la pantalla de bloqueo (${pr?.titulo})`);
    await fila.uncheck();
    await esperar(p, () => !document.getElementById('fbe-pista')?.getAttribute('src'));
    const pr2 = await pista();
    check(pr2 && !pr2.src && pr2.tipo === 'ambient' && pr2.titulo === null && pr2.acciones === '', 'al apagarlo, la pista se para y lo suelta todo: vuelve «ambient» y se limpia la pantalla de bloqueo');
    await fila.check();
    await p.keyboard.press('Escape');
    await h.waitFor({ state: 'detached' });

    // ---------- una sesión: marcar una serie arranca la pista
    await p.locator('.tab', { hasText: 'Hoy' }).click();
    await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).click();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor();
    if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    if (await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).count()) await p.locator('.preparacion').getByRole('button', { name: 'Ahora no' }).click();
    const ej = p.locator('.ejercicio').first();
    await ej.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    await p.locator('.temporizador').waitFor();
    await esperar(p, () => { const a = document.getElementById('fbe-pista'); return a && a.getAttribute('src') && a.duration > 0; });
    const t1 = await pista();
    const quedan = await p.evaluate(() => { const [m, s] = document.querySelector('.temporizador .cuenta').textContent.split(':').map(Number); return m * 60 + s; });
    check(t1 && !t1.paused && t1.src.startsWith('blob:') && t1.tipo === 'playback' && Math.abs(t1.fin - Date.now() - quedan * 1000) < 3000
      && Math.abs(t1.duracion * 1000 - t1.duracionPlan) < 30 && t1.duracionPlan > t1.cue && t1.final === 'tres-beeps',
      `al marcar la serie, con el ajuste encendido, suena la pista del descanso en «playback»: el MP3 compuesto en el móvil dura lo que debe (${t1?.duracion?.toFixed(2)} s, el aviso a los ${((t1?.cue || 0) / 1000).toFixed(1)} s)`);
    check(/^Descanso · \d:\d\d$/.test(t1.titulo) && t1.artista === 'FBE Equipo' && /^Después: /.test(t1.album) && t1.arte.some((u) => u.endsWith('/icono-512.png')) && t1.estado === 'playing'
      && t1.acciones === 'nexttrack,pause,play,seekbackward,seekforward,stop',
      `la pantalla de bloqueo (Media Session): «${t1.titulo}», «FBE Equipo», «${t1.album}», el icono de la app y sus botones (play/pausa, ±15 s, saltar)`);
    check(await p.locator('.temporizador .pista-activa', { hasText: 'Te avisa aunque bloquees el móvil' }).count() === 1, 'el temporizador lo dice: «Te avisa aunque bloquees el móvil»');
    await esperar(p, () => (window.__rpcs || []).some(([n]) => n === 'programar_descanso'), null, 4000);
    const prog = (await rpcs()).filter(([n]) => n === 'programar_descanso');
    check(prog.length >= 1 && Math.abs(new Date(prog.at(-1)[1].p_fin).getTime() - t1.fin) < 50 && /^serie 2 de .+ · [\d,]+ kg × \d+$/.test(prog.at(-1)[1].p_despues),
      `el aviso al móvil se programa igual, por si la pista no suena («Ahora: ${prog.at(-1)?.[1].p_despues}»)`);
    await revisar('descanso-con-pista', p);
    // +15: se rehace
    await p.getByRole('button', { name: 'Añadir 15 segundos' }).click();
    await esperar(p, (f) => Number(document.getElementById('fbe-pista')?.dataset.fin) > f + 10000, t1.fin);
    const t2 = await pista();
    check(Math.abs(t2.fin - t1.fin - 15000) < 1500 && t2.src !== t1.src && !t2.paused && t2.cue > t1.cue + 10000, '+15 s rehace la pista: el aviso cae 15 s más tarde');
    // Los botones de la pantalla de bloqueo: pausa, seguir, +15
    await p.evaluate(() => window.__acciones.pause());
    await p.locator('.temporizador-etq', { hasText: 'Descanso en pausa' }).waitFor();
    const t3 = await pista();
    const cuentaPausa = await p.locator('.temporizador .cuenta').textContent();
    await p.waitForTimeout(1300);
    check(t3.paused && t3.estado === 'paused' && /en pausa/.test(t3.titulo) && await p.locator('.temporizador .cuenta').textContent() === cuentaPausa
      && await p.getByRole('button', { name: 'Seguir' }).count() === 1 && (await rpcs()).at(-1)[0] === 'cancelar_descanso',
      'pausa en la pantalla de bloqueo: el descanso se para (la cuenta, quieta), la pista también, sale «Seguir» y se anula el aviso al móvil');
    await revisar('descanso-en-pausa', p);
    check(await estrecho('descanso-en-pausa', p), 'el descanso en pausa cabe a 360 px en oscuro');
    await p.evaluate(() => window.__acciones.play());
    await p.locator('.temporizador-etq', { hasText: /^Descanso$/ }).waitFor();
    await esperar(p, () => !document.getElementById('fbe-pista').paused);
    await esperar(p, () => (window.__rpcs || []).at(-1)?.[0] === 'programar_descanso', null, 4000);
    const t4 = await pista();
    check(!t4.paused && t4.estado === 'playing' && /^Descanso · /.test(t4.titulo) && (await rpcs()).at(-1)[0] === 'programar_descanso', 'play en la pantalla de bloqueo: sigue donde iba (pista y aviso al móvil otra vez)');
    await p.evaluate(() => window.__acciones.seekforward());
    await esperar(p, (f) => Number(document.getElementById('fbe-pista')?.dataset.fin) > f + 10000, t4.fin);
    check(Math.abs((await pista()).fin - t4.fin - 15000) < 1500, '⏩ en la pantalla de bloqueo suma 15 s (al descanso de la app y a la pista)');

    // ---------- al acabar: el aviso de la pista, la voz una vez, sin pitidos de la página
    const segs = async () => { const [m, s] = (await p.locator('.temporizador .cuenta').textContent()).split(':').map(Number); return m * 60 + s; };
    for (let i = 0; i < 20 && (await segs()) > 70; i++) { await p.getByRole('button', { name: 'Quitar 1 minuto' }).click(); await p.waitForTimeout(80); }
    for (let i = 0; i < 20 && (await segs()) > 20; i++) { await p.getByRole('button', { name: 'Quitar 15 segundos' }).click(); await p.waitForTimeout(80); }
    await esperar(p, () => { const a = document.getElementById('fbe-pista'); return a && !a.paused && Math.abs(Number(a.dataset.fin) - Date.now()) < 22000; });
    const voz = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('fbe-en-curso-')))).descanso.voz);
    await p.evaluate(() => { window.__habla.length = 0; window.__sonoPista = false; window.addEventListener('fbe-pista-sono', () => { window.__sonoPista = true; }); });
    const n0 = (await rpcs()).length;
    await p.locator('.temporizador.fin').waitFor({ timeout: 30000 });
    await esperar(p, () => window.__sonoPista === true, null, 4000);
    await p.waitForTimeout(2600);
    const habla = await p.evaluate(() => window.__habla.slice());
    const trasFin = (await rpcs()).slice(n0).map(([n]) => n);
    check(await p.evaluate(() => window.__sonoPista) && habla.length === 1 && habla[0] === voz && !habla.some((x) => /^(Tres|Dos|Uno|Diez segundos)$/.test(x)) && trasFin.includes('cancelar_descanso'),
      `al acabar suena el aviso de la pista y la voz del móvil dice una sola vez la serie siguiente («${habla.join(' | ')}»), sin la cuenta hablada; y se anula el aviso al móvil (ya ha avisado)`);
    await esperar(p, () => !document.getElementById('fbe-pista').getAttribute('src'), null, 6000);
    const t5 = await pista();
    check(!t5.src && t5.tipo === 'ambient' && t5.titulo === null, 'cuando acaba la pista, se suelta sola: vuelve «ambient» y se limpia la pantalla de bloqueo');

    // ---------- «Saltar» la para y lo suelta todo
    await p.getByRole('button', { name: 'Cerrar' }).click().catch(() => {});
    const n1 = (await rpcs()).length;
    await ej.getByRole('button', { name: 'Marcar la serie 2 como hecha' }).click();
    await esperar(p, () => !!document.getElementById('fbe-pista')?.getAttribute('src'));
    await esperar(p, (n) => (window.__rpcs || []).slice(n).some(([x]) => x === 'programar_descanso'), n1, 4000);
    await p.getByRole('button', { name: 'Saltar' }).click();
    await esperar(p, () => !document.getElementById('fbe-pista').getAttribute('src'));
    await p.waitForTimeout(300);
    const t6 = await pista();
    check(!t6.src && t6.paused && t6.tipo === 'ambient' && t6.titulo === null && t6.acciones === '' && (await rpcs()).slice(n1).some(([n]) => n === 'cancelar_descanso'),
      '«Saltar» para la pista y lo suelta todo (sin pantalla de bloqueo, de vuelta a «ambient»), y anula el aviso al móvil');

    // ---------- fuera de la sesión: la lleva la píldora, y ⏭ en la pantalla de bloqueo la salta
    await ej.getByRole('button', { name: 'Marcar la serie 3 como hecha' }).click();
    await esperar(p, () => !!document.getElementById('fbe-pista')?.getAttribute('src'));
    const t7 = await pista();
    await p.getByRole('button', { name: 'Volver' }).first().click();
    await p.locator('.encurso-pildora').waitFor();
    await p.waitForTimeout(400);
    const t8 = await pista();
    check(t8.src === t7.src && !t8.paused && await p.locator('.encurso-cuenta').count() === 1, 'al salir de la sesión con el descanso en marcha, la pista sigue (la píldora «Sesión en curso» lleva el descanso)');
    const n2 = (await rpcs()).length;
    await p.evaluate(() => window.__acciones.nexttrack());
    await esperar(p, () => !document.getElementById('fbe-pista').getAttribute('src'));
    await hay(p.locator('.encurso-cuenta'), 0);
    check(!(await pista()).src && await p.locator('.encurso-cuenta').count() === 0 && (await rpcs()).slice(n2).some(([n]) => n === 'cancelar_descanso'),
      '⏭ en la pantalla de bloqueo, con la sesión cerrada: salta el descanso (la píldora lo quita), para la pista y anula el aviso al móvil');
    // Quien no lo enciende sigue como siempre: sin pista y en «ambient»
    await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('fbe-ajustes')); a.vozBloqueo = false; localStorage.setItem('fbe-ajustes', JSON.stringify(a)); });
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos(p);
    await p.locator('.encurso-pildora').click();
    await p.getByRole('button', { name: 'Volver a la sesión' }).click();
    await p.locator('.ejercicio').first().waitFor();
    await p.evaluate(() => { navigator.audioSession.tipos.length = 0; });
    const libre = p.getByRole('button', { name: /^Marcar la serie \d+ como hecha$/ }).first();
    if (await libre.count()) {
      await libre.click();
      await p.locator('.temporizador').waitFor();
      await p.waitForTimeout(500);
      const t9 = await pista();
      check(t9 === null && await p.evaluate(() => navigator.audioSession.type === 'ambient' && !navigator.audioSession.tipos.includes('playback')) && await p.locator('.pista-activa').count() === 0,
        'con el ajuste apagado, como siempre: ni pista ni «playback» (la sesión de audio sigue en «ambient», la música no se corta)');
    } else check(false, 'quedaba una serie por marcar para probar el ajuste apagado');
  } catch (e) {
    check(false, `el flujo de la pista se ha interrumpido: ${e.message.split('\n').slice(0, 6).join(' / ')}`);
    await p.screenshot({ path: new URL('./e2e-fallo.png', import.meta.url).pathname, fullPage: true }).catch(() => {});
  }
  check(errores.length === 0, errores.length ? `sin errores: ${errores.join(' || ')}` : 'sin errores de consola, desbordes ni fallos de accesibilidad');
  await ctx.close();
}

// Suelto: node test/e2e-pista-062.mjs (con dist/ construido)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  await probarPista062({ navegador, check });
  await navegador.close();
  srv.close();
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
}
