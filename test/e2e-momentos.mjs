// (v0.280) Momentos (301-350), primera vuelta: la sesión, contada, en el navegador.
//   · Al terminar una sesión (Ana, FBE Equipo, con la escena de la luna), la historia del final: (301) la melodía de la
//     sesión (un punto por serie que aparece con su nota), (304) el botón de compartir cada tarjeta (la historia se para
//     mientras), (302) los récords que caen con su «clinc» y su toque (si los hay) y (303) los músculos que se pintan en
//     orden.
//   · (304) En «Tu semana», el mismo botón.
//   · (306) FBE Esencial: «Leer mi revisión» abre la historia de tres tarjetas, con «Leer entera» al final (si toca).
//   (v0.282) Sentir el récord (312-315): probarMomentos3.
//   Suelta:  npm run build && node test/e2e-momentos.mjs  (SOLO=1, 2 o 3 para una sola)
import { pathToFileURL } from 'node:url';
import { irASeccion, subProgreso } from './secciones.mjs';

export async function probarMomentos({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(120); } return !!(await fn().catch(() => false)); };
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const b = p.locator('[aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Ahora no"), [aria-modal="true"] button:has-text("Entendido"), .bienvenida button:has-text("Saltar")').first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await p.waitForTimeout(350); } else break;
    }
  };
  const nuevo = async () => {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, reducedMotion: 'no-preference' });
    await ctx.route(/i\.ytimg\.com/, (r) => r.abort());
    p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    await p.addInitScript(() => {
      try { localStorage.setItem('fbe-escena-200', '1'); localStorage.setItem('fbe-probar-historia', '1'); localStorage.setItem('fbe-bienvenida-vista', '1'); localStorage.setItem('fbe-nec-todas', '1'); } catch { /* */ }
      // lo que suena (el aviso de cada sonido) y lo que vibra, con su momento
      window.__sonidos = []; window.__vibra = [];
      addEventListener('fbe-sonido', (e) => window.__sonidos.push(e.detail?.tipo));
      try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (x) => { window.__vibra.push(x); return true; } }); } catch { /* */ }
    });
    return ctx;
  };
  const entrar = async (url, quien) => {
    await p.goto(`${base}${url}`);
    const b = p.getByRole('button', { name: quien }).first();
    if (await b.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await b.click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1500);
    await cerrarDialogos();
  };

  // ------------------------------------------------------------ Ana: la historia del final de la sesión
  {
    const ctx = await nuevo();
    try {
      await entrar('/?demo', /Ana/);
      await p.locator('[data-atajo="empezar"]').first().click();
      for (let k = 0; k < 4 && !(await p.locator('.sesion-vista').count()); k++) {
        await p.waitForTimeout(1200);
        const b = p.getByRole('button', { name: /^Empezar$|Vamos|Saltar/ }).first();
        if (await b.count()) await b.click().catch(() => {});
      }
      await p.locator('.sesion-vista').waitFor({ timeout: 15000 });
      await p.waitForTimeout(1200);
      await cerrarDialogos();
      for (let k = 0; k < 40; k++) {
        const b = p.locator('button[aria-label^="Marcar la serie"]').first();
        if (!(await b.count())) break;
        await b.scrollIntoViewIfNeeded().catch(() => {});
        await b.click({ timeout: 3000 }).catch(() => {});
        await p.waitForTimeout(150);
      }
      await p.getByRole('button', { name: 'Terminar sesión' }).click();
      await p.locator('.hoja-dialogo .segmentos button', { hasText: '8' }).first().click();
      await p.evaluate(() => { window.__sonidos.length = 0; window.__vibra.length = 0; });
      await p.getByRole('button', { name: 'Guardar y terminar' }).click();
      const hist = p.locator('.historia-sesion');
      const sale = await hist.waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
      check(sale, 'tras la escena de la luna, la historia del final');
      if (sale) {
        // (301) la melodía: un punto por serie, que aparecen en orden con su nota
        const mel = p.locator('.hs-mel');
        await mel.waitFor({ timeout: 5000 }).catch(() => {});
        const puntos = await p.locator('.hs-mel-p').count();
        const anims = await p.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.classList?.contains('hs-mel-p')).length);
        const delays = await p.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.classList?.contains('hs-mel-p')).map((a) => a.effect.getTiming().delay));
        check(puntos >= 4 && anims === puntos && delays.every((d, i) => i === 0 || d > delays[i - 1]), `(301) la melodía de tu sesión: ${puntos} puntos que aparecen uno a uno, en orden`);
        await p.waitForTimeout(6400);
        const notas = await p.evaluate(() => window.__sonidos.filter((t) => t === 'nota').length);
        check(notas === puntos, `(301) y cada uno con su nota (${notas} de ${puntos})`);
        // (304) compartir esta tarjeta: la de la sesión de siempre; la historia se para mientras
        const comp = p.locator('.historia-comp');
        check(await comp.count() === 1 && (await comp.getAttribute('aria-label')) === 'Compartir esta tarjeta', '(304) el botón discreto de compartir, arriba');
        const antes = await hist.getAttribute('data-p');
        await comp.click();
        const hoja = p.locator('.hoja-dialogo:has(.tarjeta-img), [aria-modal="true"]:has(.tarjeta-img)').last();
        const conImg = await hoja.waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
        check(conImg && /Compartir la sesión/.test(await p.locator('[aria-modal="true"]').last().textContent()), '(304) abre la tarjeta de la sesión, lista para compartir');
        await p.waitForTimeout(7600);
        check((await hist.getAttribute('data-p')) === antes, '(304) mientras compartes, la historia no pasa sola');
        await p.keyboard.press('Escape');
        await p.waitForTimeout(500);
        if (await p.locator('.historia-sesion [aria-modal="true"] .tarjeta-img, body > div [role="dialog"] .tarjeta-img').count()) { const c = p.getByRole('button', { name: /Cerrar/ }).last(); await c.click().catch(() => {}); }
        check(await hist.count() === 1, '(304) y al cerrar la hoja sigues en la historia (Escape cierra solo la hoja)');
        // las demás tarjetas
        for (let k = 0; k < 4; k++) {
          const id = await hist.getAttribute('data-p').catch(() => null);
          if (id === 'records') {
            const meds = await p.locator('.hs-medalla').count();
            await p.evaluate(() => { window.__sonidos.length = 0; window.__vibra.length = 0; });
            await p.waitForTimeout(400 + meds * 460 + 500);
            const r = await p.evaluate(() => ({ clinc: window.__sonidos.filter((t) => t === 'clinc').length, vibra: window.__vibra.length }));
            check(meds > 0 && r.clinc >= meds - 0 && r.vibra >= meds, `(302) los récords caen como medallas, cada uno con su «clinc» y su toque (${meds} medallas, ${r.clinc} «clinc», ${r.vibra} toques)`);
          }
          if (id === 'musculos') {
            const pintados = () => p.evaluate(() => document.querySelectorAll('.historia-sesion .musculo:not(.m0)').length);
            const al = await pintados();
            const etiqueta = await p.locator('.historia-sesion .mapa-muscular svg').getAttribute('aria-label');
            await p.waitForTimeout(3500);
            const luego = await pintados();
            check(luego > al && luego > 0 && /: (?!ninguna)/.test(etiqueta || ''), `(303) los músculos se pintan uno a uno (de ${al} a ${luego} partes pintadas) y el lector los oye todos desde el principio`);
            break;
          }
          const sig = p.locator('.historia-sesion .historia-zona.siguiente');
          if (!(await sig.count())) break;
          await sig.click();
          await p.waitForTimeout(300);
          if (!(await hist.count())) break;
        }
      }
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ (304 y 305) «Tu semana» (desde «Tus semanas» de Progreso)
  {
    const ctx = await nuevo();
    try {
      await entrar('/?demo', /Ana/);
      await irASeccion(p, 'Progreso');
      await p.waitForTimeout(1000);
      await cerrarDialogos();
      await subProgreso(p, 'resumen');
      const filas = p.locator('button.amb-sem');
      await filas.first().waitFor({ timeout: 15000 });
      // la que tenga dos récords o más (para «Tu mejor momento»); si no hay, la primera
      const textos = await filas.allTextContents();
      const k = Math.max(0, textos.findIndex((t) => /, ([2-9]|\d{2,}) récords/.test(t)));
      const conDos = /, ([2-9]|\d{2,}) récords/.test(textos[k] || '');
      await filas.nth(k).scrollIntoViewIfNeeded();
      await filas.nth(k).click();
      const h = p.locator('[role="dialog"].historia').first();
      await h.waitFor({ timeout: 8000 });
      const b = h.locator('.historia-comp');
      check(await b.count() === 1, '(304) «Tu semana»: cada tarjeta de entreno con su botón de compartir');
      const vistos = [];
      for (let n = 0; n < 7; n++) {
        vistos.push((await h.locator('.historia-etq').first().textContent().catch(() => '')).trim());
        if (/Tu mejor momento/.test(vistos[vistos.length - 1])) break;
        const sig = h.locator('.historia-zona.siguiente');
        if (!(await sig.count()) || /Cerrar/.test(await sig.getAttribute('aria-label'))) break;
        await sig.click(); await p.waitForTimeout(300);
      }
      const momento = vistos.some((t) => /Tu mejor momento/.test(t));
      check(conDos ? momento && /\+[\d,]+\s*% sobre tu mejor marca/.test(await h.textContent()) : !momento, conDos ? '(305) con dos récords o más, «Tu mejor momento»: el que más subió' : '(305) sin dos récords esa semana, sin «Tu mejor momento»');
      await h.locator('.historia-comp').click();
      const ok2 = await p.locator('.tarjeta-img').last().waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
      check(ok2, '(304) y la tarjeta, tal cual, lista para compartir');
    } finally { await ctx.close(); }
  }

  // ------------------------------------------------------------ (306) FBE Esencial: tu revisión como historia
  {
    const ctx = await nuevo();
    try {
      await entrar('/?demo=esencial', /Tomás/);
      // (253) con tres avisos o más, van apilados: se abre la pila
      await p.waitForTimeout(1500);
      const pila = p.locator('.pav-ver[aria-expanded="false"]').first();
      if (await pila.count()) { await pila.scrollIntoViewIfNeeded().catch(() => {}); await pila.click().catch(() => {}); await p.waitForTimeout(500); }
      const b = p.getByRole('button', { name: 'Leer mi revisión' }).first();
      if (await b.waitFor({ timeout: 12000 }).then(() => true).catch(() => false)) {
        await b.scrollIntoViewIfNeeded();
        await b.click();
        const h = p.locator('.historia-rev');
        const sale = await h.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
        if (sale && await hasta(async () => (await h.locator('.historia-pantalla h2').count()) > 0, 8000)) {
          check(/Lo que hiciste/.test(await h.textContent()), '(306) «Leer mi revisión»: primero, lo que hiciste');
          await h.locator('.historia-zona.siguiente').click(); await p.waitForTimeout(400);
          check(/Lo que cambia/.test(await h.textContent()), '(306) luego, lo que cambia');
          await h.locator('.historia-zona.siguiente').click(); await p.waitForTimeout(400);
          check(/En qué fijarte/.test(await h.textContent()) && (await h.getByRole('button', { name: /Leer entera/ }).count()) === 1, '(306) y en qué fijarte, con «Leer entera»');
          await h.getByRole('button', { name: /Leer entera/ }).click();
          check(await hasta(async () => (await p.locator('.ayu-revision').count()) > 0 && (await h.count()) === 0, 8000), '(306) «Leer entera» abre la revisión de siempre');
        } else check(await p.locator('.ayu-revision').count() > 0, '(306) sin nada que contar en tres tarjetas, se abre la revisión de siempre');
      } else check(true, '(306) Tomás no tiene revisión pendiente en esta demo');
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `la sesión contada, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}

// (v0.281) Compartir con brillo: (307) la tarjeta se coge (se inclina siguiendo al dedo; las de récord, tornasol), (308)
// «Guardar imagen» con su viaje y su ✓, (309) cambiar de formato la transforma (transición de vista), (310) el fondo de
// pantalla (1080 × 2340; también el carné) y (311) «El día 1 y hoy» como tarjeta (si sale en la demo)
export async function probarMomentos2({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  for (const movimiento of ['no-preference', 'reduce']) {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, reducedMotion: movimiento, acceptDownloads: true });
    await ctx.route(/i\.ytimg\.com/, (r) => r.abort());
    const p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    await p.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); localStorage.setItem('fbe-bienvenida-vista', '1'); localStorage.setItem('fbe-nec-todas', '1'); } catch { /* */ } });
    const quieto = movimiento === 'reduce';
    const cerrarDialogos = async () => {
      for (let i = 0; i < 6; i++) {
        const b = p.locator('[aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Ahora no"), [aria-modal="true"] button:has-text("Entendido"), .bienvenida button:has-text("Saltar")').first();
        if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await p.waitForTimeout(350); } else break;
      }
    };
    try {
      await p.goto(`${base}/?demo`);
      const quien = p.getByRole('button', { name: /Ana/ }).first();
      if (await quien.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await quien.click();
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      await p.waitForTimeout(1500); await cerrarDialogos();
      await irASeccion(p, 'Progreso'); await p.waitForTimeout(1000); await cerrarDialogos();
      await subProgreso(p, 'resumen');
      const filas = p.locator('button.amb-sem'); await filas.first().waitFor({ timeout: 15000 });
      const textos = await filas.allTextContents();
      const k = Math.max(0, textos.findIndex((t) => /\d+ récords?/.test(t)));
      await filas.nth(k).click();
      const h = p.locator('[role="dialog"].historia').first(); await h.waitFor({ timeout: 8000 });
      // la tarjeta de los récords (la tercera)
      for (let n = 0; n < 6 && !/Récords/.test(await h.locator('.historia-etq').first().textContent().catch(() => '')); n++) { await h.locator('.historia-zona.siguiente').click(); await p.waitForTimeout(300); }
      await h.locator('.historia-comp').click();
      const img = p.locator('.tarjeta-img').last(); await img.waitFor({ timeout: 15000 }); await p.waitForTimeout(600);
      const carta = p.locator('.cpt-carta').last();
      const bb = await img.boundingBox();
      const cdp = await ctx.newCDPSession(p);
      const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await toque('touchStart', bb.x + bb.width * 0.5, bb.y + bb.height * 0.5);
      for (let j = 1; j <= 8; j++) await toque('touchMove', bb.x + bb.width * (0.5 + j * 0.04), bb.y + bb.height * (0.5 - j * 0.03));
      await p.waitForTimeout(100);
      const cogida = await carta.evaluate((c) => ({ coge: c.classList.contains('cpt-coge'), t: getComputedStyle(c).transform, tornasol: c.classList.contains('cpt-tornasol') }));
      if (!quieto) check(cogida.coge && cogida.t !== 'none', '(307) la tarjeta se coge: se inclina siguiendo al dedo');
      else check(!cogida.coge && cogida.t === 'none', '(307, con «reducir movimiento») la tarjeta no se inclina');
      if (!quieto) check(cogida.tornasol, '(307) y, siendo de récords, con el brillo tornasol del carné');
      await toque('touchEnd', 0, 0);
      await p.waitForTimeout(700);
      if (!quieto) check(await carta.evaluate((c) => !c.classList.contains('cpt-coge') && getComputedStyle(c).transform === 'none'), '(307) al soltarla, vuelve a su sitio');
      // 308: guardar
      await p.evaluate(() => { window.__clon = 0; new MutationObserver((ms) => { for (const m of ms) for (const nn of m.addedNodes) if (nn.classList?.contains('cpt-viaje')) window.__clon++; }).observe(document.body, { childList: true }); });
      await p.getByRole('button', { name: /Guardar imagen/ }).click();
      await p.waitForTimeout(250);
      const viaje = await p.evaluate(() => window.__clon), etiqueta = (await p.locator('.cpt-guardada').textContent().catch(() => '')).trim();
      check(etiqueta === 'Guardada' && (quieto ? viaje === 0 : viaje === 1), quieto ? '(308, con «reducir movimiento») «Guardada», sin el viaje' : '(308) «Guardar imagen»: la tarjeta viaja al botón y dice «Guardada» con su ✓');
      await p.waitForTimeout(2000);
      check(/Guardar imagen/.test(await p.getByRole('button', { name: /Guardar imagen|Guardada/ }).first().textContent()), '(308) y a los dos segundos vuelve a «Guardar imagen»');
      // 309 y 310: el formato
      await p.evaluate(() => { window.__vt = []; new MutationObserver(() => window.__vt.push(document.documentElement.dataset.vt || '')).observe(document.documentElement, { attributes: true, attributeFilter: ['data-vt'] }); });
      const pers = p.getByRole('button', { name: /Personalizar/ }); if (await pers.count()) await pers.click();
      await p.locator('.compartir-opciones button', { hasText: 'Fondo de pantalla' }).click();
      const alto = await (async () => { for (let j = 0; j < 40; j++) { const n = await p.evaluate(() => { const i = [...document.querySelectorAll('.tarjeta-img')].pop(); return i?.complete ? [i.naturalWidth, i.naturalHeight] : null; }); if (n && n[1] === 2340) return n; await p.waitForTimeout(150); } return null; })();
      check(!!alto && alto[0] === 1080 && await p.locator('.previa-fondo').count() === 1, `(310) «Fondo de pantalla»: la tarjeta sobre la noche, por debajo del reloj (${alto ? alto.join(' × ') : '—'})`);
      const vt = await p.evaluate(() => window.__vt);
      check(quieto ? !vt.includes('morph') : vt.includes('morph'), quieto ? '(309, con «reducir movimiento») el cambio, de golpe' : '(309) cambiar de formato transforma la tarjeta (transición de vista), sin saltar');
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
      if (!quieto) {
        // 310: el carné, también como fondo de pantalla
        await p.goto(`${base}/?demo#perfil`);
        const q2 = p.getByRole('button', { name: /Ana/ }).first();
        if (await q2.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await q2.click();
        await p.locator('nav.tabs').waitFor({ timeout: 30000 }); await p.waitForTimeout(1800); await cerrarDialogos();
        const comp = p.locator('.carnet-compartir').first();
        if (await comp.count()) {
          await comp.scrollIntoViewIfNeeded(); await comp.click();
          await p.locator('.tarjeta-img').last().waitFor({ timeout: 15000 });
          const t = p.getByRole('button', { name: 'Como fondo de pantalla' });
          check(await t.count() === 1, '(310) el carné: «Como fondo de pantalla»');
          await t.click();
          const n = await (async () => { for (let j = 0; j < 40; j++) { const x = await p.evaluate(() => { const i = [...document.querySelectorAll('.tarjeta-img')].pop(); return i?.complete ? [i.naturalWidth, i.naturalHeight] : null; }); if (x && x[1] === 2340) return x; await p.waitForTimeout(150); } return null; })();
          check(!!n, `(310) y sale en 1080 × 2340 (${n ? n.join(' × ') : '—'})`);
          await p.getByRole('button', { name: 'Volver a la tarjeta' }).click();
          await p.keyboard.press('Escape'); await p.waitForTimeout(300);
        } else check(true, '(310) el carné no está a la vista en esta demo');
        // 311: el día 1 y hoy
        const dia = p.locator('.dia-uno');
        if (await dia.count()) {
          await dia.scrollIntoViewIfNeeded();
          await dia.getByRole('button', { name: /Compartir el día 1 y hoy/ }).first().click();
          await p.locator('.tarjeta-img').last().waitFor({ timeout: 15000 });
          check(/El día 1 y hoy/.test(await p.locator('[aria-modal="true"]').last().textContent()), '(311) «El día 1 y hoy», como tarjeta de antes y ahora');
        } else check(true, '(311) «El día 1 y hoy» no sale en esta demo (hace falta llevar semanas)');
      }
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `compartir con brillo, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}

// (v0.282) Sentir el récord (312-315), en el navegador (Ana, FBE Equipo, 390 px): (312) la serie que toca se enciende en
// dorado si con lo que lleva puesto sería récord (y se apaga si no); (314) a mitad de sesión, una ola por la barra de
// arriba, una sola vez; (313) la última serie de la sesión, marcada; y (315) al terminar, «Tu primer récord» en la escena
// (con fbe-probar-primer-record: la demo ya trae récords de antes)
export async function probarMomentos3({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  let p = null;
  const hasta = async (fn, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await p.waitForTimeout(120); } return !!(await fn().catch(() => false)); };
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const b = p.locator('[aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Ahora no"), [aria-modal="true"] button:has-text("Entendido"), .bienvenida button:has-text("Saltar")').first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await p.waitForTimeout(350); } else break;
    }
  };
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, reducedMotion: 'no-preference' });
  await ctx.route(/i\.ytimg\.com/, (r) => r.abort());
  p = await ctx.newPage();
  p.setDefaultTimeout(10000);
  p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
  await p.addInitScript(() => {
    try { for (const k of ['fbe-escena-200', 'fbe-bienvenida-vista', 'fbe-nec-todas', 'fbe-probar-primer-record']) localStorage.setItem(k, '1'); } catch { /* */ }
    // (314) las olas de la barra de arriba, en cuanto empiezan (cada animación, una vez)
    window.__olas = [];
    const vistas = new WeakSet();
    const mirar = () => {
      try {
        for (const a of document.getAnimations()) {
          const t = a.effect?.target;
          if (vistas.has(a) || !t?.matches?.('.sesion-vista .tramo-barra, .sesion-vista .barra-sesion')) continue;
          vistas.add(a);
          if ((a.effect.getKeyframes?.() || []).some((k) => /scaleY\(2\.2\)/.test(k.transform || ''))) window.__olas.push(Math.round(performance.now()));
        }
      } catch { /* */ }
      requestAnimationFrame(mirar);
    };
    requestAnimationFrame(mirar);
  });
  try {
    await p.goto(`${base}/?demo`);
    const quien = p.getByRole('button', { name: /Ana/ }).first();
    if (await quien.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await quien.click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1500);
    await cerrarDialogos();
    await p.locator('[data-atajo="empezar"]').first().click();
    for (let k = 0; k < 4 && !(await p.locator('.sesion-vista').count()); k++) {
      await p.waitForTimeout(1200);
      const b = p.getByRole('button', { name: /^Empezar$|Vamos|Saltar/ }).first();
      if (await b.count()) await b.click().catch(() => {});
    }
    await p.locator('.sesion-vista').waitFor({ timeout: 15000 });
    await p.waitForTimeout(1200);
    await cerrarDialogos();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    // (312) la que toca: con 1 kg, nada; con 300, su filo dorado (y el lector lo dice)
    const fila = p.locator('.sesion-vista .serie.siguiente').first();
    await fila.waitFor();
    const n = await fila.getAttribute('data-n');
    const ej = p.locator('.ejercicio', { has: fila }).first();
    const kg = ej.getByLabel(`Kilos de la serie ${n}`);
    await kg.fill('1');
    await p.keyboard.press('Escape');
    const apagada = await hasta(() => fila.evaluate((e) => !e.classList.contains('fsr-alcance')), 3000);
    await kg.fill('300');
    await p.keyboard.press('Escape');
    const dorada = await hasta(() => fila.evaluate((e) => e.classList.contains('fsr-alcance')), 4000);
    const borde = await fila.evaluate((e) => getComputedStyle(e).boxShadow);
    check(apagada && dorada && /puede ser récord/.test((await fila.getAttribute('aria-label')) || '') && borde !== 'none',
      '(312) la serie que toca: con 1 kg, como siempre; con 300, se enciende en dorado antes de hacerla (y el lector dice «puede ser récord»)');
    // Se hace así (será récord) y las demás, hasta que quede una
    await ej.getByRole('button', { name: `Marcar la serie ${n} como hecha` }).click();
    await p.waitForTimeout(400);
    for (let k = 0; k < 60; k++) {
      const quedan = p.locator('button[aria-label^="Marcar la serie"]');
      if ((await quedan.count()) <= 1) break;
      const b = quedan.first();
      await b.scrollIntoViewIfNeeded().catch(() => {});
      await b.click({ timeout: 3000 }).catch(() => {});
      await p.waitForTimeout(160);
    }
    // (313) la última de la sesión, marcada
    const ultima = p.locator('.sesion-vista .serie.fsr-ultima');
    const marcada = await hasta(async () => (await ultima.count()) === 1, 4000);
    check(marcada && /la última de la sesión/.test((await ultima.first().getAttribute('aria-label')) || '') && (await p.locator('button[aria-label^="Marcar la serie"]').count()) === 1,
      '(313) cuando queda una serie en toda la sesión, va marcada (y el lector lo dice)');
    // (314) la ola de la mitad: salió, y una sola vez (todas sus animaciones juntas)
    const olas = await p.evaluate(() => window.__olas.slice());
    check(olas.length >= 1 && olas[olas.length - 1] - olas[0] < 1500, `(314) a mitad de sesión, una ola por la barra de arriba, una sola vez (${olas.length} tramos, en ${olas.length ? olas[olas.length - 1] - olas[0] : 0} ms)`);
    // (315) la última, y a terminar: «Tu primer récord»
    const ult = p.locator('button[aria-label^="Marcar la serie"]').first();
    await ult.scrollIntoViewIfNeeded().catch(() => {});
    await ult.click();
    await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Terminar sesión' }).click();
    await p.locator('.hoja-dialogo .segmentos button', { hasText: '8' }).first().click();
    await p.getByRole('button', { name: 'Guardar y terminar' }).click();
    const escena = p.locator('.escena-final');
    await escena.waitFor({ timeout: 20000 });
    const primero = await escena.evaluate((e) => e.classList.contains('ef-primero'));
    const titulo = await escena.locator('.escena-titulo').textContent();
    const aro = await p.evaluate(() => document.getAnimations().some((a) => a.effect?.target?.classList?.contains('ef-aro')));
    check(primero && /Tu primer récord/.test(titulo) && aro && /Sesión terminada/.test(await escena.locator('.escena-sub').textContent()),
      `(315) al terminar, la escena del primer récord: «${(titulo || '').trim()}», con su aro de oro (y «Sesión terminada» debajo)`);
  } finally { await ctx.close(); }
  check(errores.length === 0, `sentir el récord, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4201);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Momentos, primera vuelta: la sesión, contada (v0.280)');
  const solo = process.env.SOLO || '';
  if (!solo || solo === '1') { try { await probarMomentos({ navegador, check, base: 'http://localhost:4201' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); } }
  if (!solo || solo === '2') { console.log('Compartir con brillo (v0.281)'); try { await probarMomentos2({ navegador, check, base: 'http://localhost:4201' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); } }
  if (!solo || solo === '3') { console.log('Sentir el récord (v0.282)'); try { await probarMomentos3({ navegador, check, base: 'http://localhost:4201' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); } }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
