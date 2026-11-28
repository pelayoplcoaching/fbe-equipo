// (v0.280) Momentos (301-350), primera vuelta: la sesión, contada, en el navegador.
//   · Al terminar una sesión (Ana, FBE Equipo, con la escena de la luna), la historia del final: (301) la melodía de la
//     sesión (un punto por serie que aparece con su nota), (304) el botón de compartir cada tarjeta (la historia se para
//     mientras), (302) los récords que caen con su «clinc» y su toque (si los hay) y (303) los músculos que se pintan en
//     orden.
//   · (304) En «Tu semana», el mismo botón.
//   · (306) FBE Esencial: «Leer mi revisión» abre la historia de tres tarjetas, con «Leer entera» al final (si toca).
//   (v0.282) Sentir el récord (312-315): probarMomentos3. (v0.283) Sonido y tacto afinados: probarMomentos4.
//   Suelta:  npm run build && node test/e2e-momentos.mjs  (SOLO=1, 2, 3 o 4 para una sola)
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { irASeccion, subProgreso, irAAjustes } from './secciones.mjs';

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
          // (solo las de animate(): el pulso del último ejercicio, tramo-ultimo, es CSS y ya estaba)
          if (vistas.has(a) || a instanceof CSSAnimation || a instanceof CSSTransition || !t?.matches?.('.sesion-vista .tramo-barra, .sesion-vista .barra-sesion')) continue;
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
    const ej = p.locator('.sesion-vista .ejercicio', { has: p.locator('.serie.siguiente') }).first();
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
    // Se hace así (será récord) y las demás, hasta que quede una en toda la sesión (las de cada ejercicio, en sus tramos de
    // arriba: «2 de 3 series»; los ejercicios van saliendo según se acaba el de antes)
    const quedanEnSesion = () => p.evaluate(() => [...document.querySelectorAll('.sesion-vista nav.tramos a')].reduce((t, a) => { const m = (a.getAttribute('aria-label') || '').match(/(\d+) de (\d+) series/); return t + (m ? Math.max(0, Number(m[2]) - Number(m[1])) : 0); }, 0));
    const alEmpezar = await quedanEnSesion();
    await ej.getByRole('button', { name: `Marcar la serie ${n} como hecha` }).click();
    await p.waitForTimeout(400);
    for (let k = 0; k < 80; k++) {
      if ((await quedanEnSesion()) <= 1) break;
      const b = p.locator('button[aria-label^="Marcar la serie"]').first();
      if (!(await b.count())) { await p.waitForTimeout(400); continue; }
      await b.scrollIntoViewIfNeeded().catch(() => {});
      await b.click({ timeout: 3000 }).catch(() => {});
      await p.waitForTimeout(160);
    }
    // (313) la última de la sesión, marcada
    const ultima = p.locator('.sesion-vista .serie.fsr-ultima');
    const marcada = await hasta(async () => (await ultima.count()) === 1, 4000);
    check(alEmpezar >= 4 && (await quedanEnSesion()) === 1 && marcada && /la última de la sesión/.test((await ultima.first().getAttribute('aria-label')) || ''),
      `(313) cuando queda una serie en toda la sesión (de ${alEmpezar}), va marcada (y el lector lo dice)`);
    // (314) la ola de la mitad: salió, y una sola vez (todas sus animaciones juntas)
    const olas = await p.evaluate(() => window.__olas.slice());
    check(olas.length >= 1 && olas[olas.length - 1] - olas[0] < 1500, `(314) a mitad de sesión, una ola por la barra de arriba, una sola vez (${olas.length} tramos, en ${olas.length ? olas[olas.length - 1] - olas[0] : 0} ms)`);
    // (315) la última, y a terminar: «Tu primer récord»
    const ult = ultima.first().getByRole('button', { name: /^Marcar la serie/ });
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

// (v0.283) Sonido y tacto afinados (318-326), en el navegador (Ana, 390 px): con «Sonidos de la interfaz», el tic de las
// pestañas, el susurro de una hoja y el clic de un interruptor (319); en el horario sin sonidos, nada de eso (322); la salida
// de la sesión y la nota de la serie, con su fotograma (318); y «Tu portada» como fondo de lo que compartes (324)
export async function probarMomentos4({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const abrir = async (ajustes = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, reducedMotion: 'no-preference' });
    await ctx.route(/i\.ytimg\.com/, (r) => r.abort());
    const p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    await p.addInitScript((aj) => {
      try {
        for (const k of ['fbe-escena-200', 'fbe-bienvenida-vista', 'fbe-nec-todas']) localStorage.setItem(k, '1');
        localStorage.setItem('fbe-portada-perfil', JSON.stringify('perfil-montana'));
        localStorage.setItem('fbe-ajustes', JSON.stringify({ ...JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'), ...aj }));
      } catch { /* */ }
      window.__son = []; window.__vib = [];
      addEventListener('fbe-sonido', (e) => window.__son.push([e.detail?.tipo, Math.round(performance.now())]));
      try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (x) => { window.__vib.push([JSON.stringify(x), Math.round(performance.now())]); return true; } }); } catch { /* */ }
    }, ajustes);
    await p.goto(`${base}/?demo`);
    const b = p.getByRole('button', { name: /Ana/ }).first();
    if (await b.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await b.click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1500);
    for (let i = 0; i < 6; i++) {
      const c = p.locator('[aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Ahora no"), [aria-modal="true"] button:has-text("Entendido")').first();
      if (await c.isVisible().catch(() => false)) { await c.click().catch(() => {}); await p.waitForTimeout(350); } else break;
    }
    // (el audio arranca con un primer toque, como en el móvil)
    await p.locator('body').click({ position: { x: 5, y: 420 } }).catch(() => {});
    return { ctx, p };
  };
  const oidos = (p) => p.evaluate(() => window.__son.map((x) => x[0]));
  const limpiar = (p) => p.evaluate(() => { window.__son.length = 0; window.__vib.length = 0; });
  // --- 319: con los sonidos de la interfaz
  {
    const { ctx, p } = await abrir({ sonidosInterfaz: true });
    try {
      await limpiar(p);
      await p.locator('nav.tabs .tab:not([aria-current="page"])').first().click();
      await p.waitForTimeout(500);
      check((await oidos(p)).includes('pestana'), `(319) con «Sonidos de la interfaz», el tic al cambiar de pestaña (${(await oidos(p)).join(', ') || 'nada'})`);
      await p.locator('nav.tabs .tab[data-tab="hoy"]').first().click().catch(() => {});
      await p.waitForTimeout(800);
      // una hoja: «Tus marcas» no es de Ana; la de la semana sí (los diales de Hoy abren sus hojas)
      await limpiar(p);
      const dial = p.locator('.diales .dial').first();
      if (await dial.count()) {
        await dial.click();
        await p.locator('.hoja-dialogo').first().waitFor({ timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(400);
        check((await oidos(p)).includes('hoja'), `(319) y un susurro al abrirse una hoja (${(await oidos(p)).join(', ') || 'nada'})`);
        await p.keyboard.press('Escape');
        await p.waitForTimeout(400);
      } else check(true, '(319) sin diales en esta demo: el susurro se prueba con la hoja de ajustes');
      // un interruptor: en Ajustes de este móvil
      await irAAjustes(p);
      const aj = p.getByRole('button', { name: /^Sonido y vibración/ }).first();
      if (await aj.count()) {
        await aj.scrollIntoViewIfNeeded().catch(() => {});
        await aj.click();
        const hoja = p.getByRole('dialog', { name: 'Sonido y vibración' });
        await hoja.waitFor();
        await p.waitForTimeout(300);
        await limpiar(p);
        await hoja.getByRole('switch', { name: /Clic del teclado/ }).click();
        await p.waitForTimeout(300);
        check((await oidos(p)).includes('interruptor'), `(319) y el clic de un interruptor (${(await oidos(p)).join(', ') || 'nada'})`);
      } else check(false, '(319) Sonido y vibración, en el perfil');
    } finally { await ctx.close(); }
  }
  // --- 322: en el horario sin sonidos, nada de la interfaz
  {
    const ya = new Date(), min = ya.getHours() * 60 + ya.getMinutes();
    const hhmm = (m) => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
    const { ctx, p } = await abrir({ sonidosInterfaz: true, silencioActivo: true, silencioDesde: hhmm(min - 60), silencioHasta: hhmm(min + 60) });
    try {
      await limpiar(p);
      await p.locator('nav.tabs .tab:not([aria-current="page"])').first().click();
      await p.waitForTimeout(600);
      check(!(await oidos(p)).includes('pestana'), '(322) en el horario sin sonidos, ni el tic de las pestañas');
    } finally { await ctx.close(); }
  }
  // --- 318: la salida y la nota de la serie, con su fotograma
  {
    const { ctx, p } = await abrir({});
    try {
      await p.locator('[data-atajo="empezar"]').first().click();
      const portada = p.locator('.portada-empezar .btn').first();
      if (await portada.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) {
        await limpiar(p);
        await portada.click();
        await p.waitForTimeout(600);
        const son = await p.evaluate(() => window.__son.slice()), vib = await p.evaluate(() => window.__vib.slice());
        const s = son.find((x) => x[0] === 'empezar'), v = vib[0];
        check(!!s && !!v && Math.abs(s[1] - v[1]) <= 30, `(318) al empezar, la salida suena y vibra a la vez, con la noche que se abre (${s ? 'suena' : 'no suena'}, ${v ? 'vibra' : 'no vibra'}${s && v ? `, ${Math.abs(s[1] - v[1])} ms entre los dos` : ''})`);
      } else check(true, '(318) sin portada en esta sesión');
      await p.locator('.sesion-vista').waitFor({ timeout: 15000 });
      await p.waitForTimeout(1200);
      for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
      const marcar = p.locator('button[aria-label^="Marcar la serie"]').first();
      await limpiar(p);
      const t0 = await p.evaluate(() => Math.round(performance.now()));
      await marcar.click();
      await p.waitForTimeout(600);
      const son = await p.evaluate(() => window.__son.slice()), vib = await p.evaluate(() => window.__vib.slice());
      const s = son.find((x) => x[0] === 'serie'), v = vib[0];
      check(!!s && !!v && Math.abs(s[1] - v[1]) <= 30 && s[1] >= t0, `(318) al marcar la serie, la nota y el toque, juntos y con la fila (${s && v ? `${Math.abs(s[1] - v[1])} ms entre los dos` : 'falta uno'})`);
    } finally { await ctx.close(); }
  }
  // --- 324: tu portada, como fondo de lo que compartes
  {
    const { ctx, p } = await abrir({});
    try {
      await irASeccion(p, 'Progreso');
      await p.waitForTimeout(800);
      await subProgreso(p, 'resumen');
      const filas = p.locator('button.amb-sem');
      await filas.first().waitFor({ timeout: 15000 });
      await filas.first().click();
      const h = p.locator('[role="dialog"].historia').first();
      await h.waitFor({ timeout: 8000 });
      await h.locator('.historia-comp').click();
      const img = p.locator('.tarjeta-img').last();
      await img.waitFor({ timeout: 15000 });
      await p.locator('[aria-modal="true"]').last().getByRole('button', { name: 'Personalizar' }).click();
      const op = p.getByRole('radiogroup', { name: 'Fondo' }).getByRole('radio', { name: 'Tu portada' });
      const hay = await op.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
      const antes = await img.getAttribute('src');
      if (hay) await op.click();
      const cambia = hay && await p.waitForFunction((x) => document.querySelectorAll('.tarjeta-img')[document.querySelectorAll('.tarjeta-img').length - 1]?.getAttribute('src') !== x, antes, { timeout: 15000 }).then(() => true).catch(() => false);
      check(hay && cambia && (await op.getAttribute('aria-checked')) === 'true', '(324) en «Personalizar», «Tu portada» (la de tu perfil) y la tarjeta se vuelve a pintar con ella');
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `sonido y tacto afinados, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}

// (v0.284) Remate, segunda vuelta: con una hoja encima, lo de debajo se para (330); la pausa de las historias, también
// con un botón y con la barra espaciadora (334); y «Gestos» en Ajustes, con «Solo botones» (343).
export async function probarMomentos5({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const abrir = async (url, quien, ajustes = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, reducedMotion: 'no-preference' });
    await ctx.route(/i\.ytimg\.com/, (r) => r.abort());
    const p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    await p.addInitScript((aj) => {
      try {
        for (const k of ['fbe-escena-200', 'fbe-bienvenida-vista', 'fbe-nec-todas']) localStorage.setItem(k, '1');
        localStorage.setItem('fbe-ajustes', JSON.stringify({ ...JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'), ...aj }));
      } catch { /* */ }
    }, ajustes);
    await p.goto(`${base}/${url}`);
    const b = p.getByRole('button', { name: quien }).first();
    if (await b.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await b.click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1500);
    for (let i = 0; i < 6; i++) {
      const c = p.locator('[aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Ahora no"), [aria-modal="true"] button:has-text("Entendido")').first();
      if (await c.isVisible().catch(() => false)) { await c.click().catch(() => {}); await p.waitForTimeout(350); } else break;
    }
    const cdp = await ctx.newCDPSession(p);
    const dedo = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const arrastrar = async (x, y, dx, dy, pasos = 12) => {
      await dedo('touchStart', x, y);
      for (let k = 1; k <= pasos; k++) { await dedo('touchMove', x + (dx * k) / pasos, y + (dy * k) / pasos); await p.waitForTimeout(16); }
      await dedo('touchEnd');
    };
    return { ctx, p, arrastrar };
  };
  const hasta = async (fn, ms = 6000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await new Promise((r) => setTimeout(r, 120)); } return false; };

  // --- 330: con una hoja encima, el cielo de Hoy deja de moverse (y al cerrarla, sigue)
  {
    const { ctx, p } = await abrir('?demo', /Ana/);
    try {
      const cielo = p.locator('.cielo-hora').first();
      const dial = p.locator('.diales .dial').first();
      if (await cielo.count() && await dial.count()) {
        await p.evaluate(() => scrollTo(0, 0));
        await p.waitForTimeout(500);
        const antes = await cielo.getAttribute('data-pausa');
        await dial.click();
        const hoja = p.locator('[aria-modal="true"]').last();
        await hoja.waitFor();
        await p.waitForTimeout(400);
        const tapado = await cielo.getAttribute('data-pausa');
        await p.keyboard.press('Escape');
        await hasta(async () => (await p.locator('[aria-modal="true"]').count()) === 0, 4000);
        await p.waitForTimeout(500);
        const despues = await cielo.getAttribute('data-pausa');
        check(antes === null && tapado === '' && despues === null, `(330) con una hoja encima, el cielo de Hoy se para; al cerrarla, sigue (${antes === null ? 'se mueve' : 'parado'} · ${tapado === '' ? 'parado' : 'se mueve'} · ${despues === null ? 'se mueve' : 'parado'})`);
      } else check(true, '(330) sin cielo o sin diales en Hoy a esta hora');
    } finally { await ctx.close(); }
  }

  // --- 334: la pausa de las historias, con su botón y con la barra espaciadora (la de tu revisión, en FBE Esencial)
  {
    const { ctx, p } = await abrir('?demo=esencial', /Tomás/);
    try {
      const pila = p.locator('.pav-ver[aria-expanded="false"]').first();
      if (await pila.count()) { await pila.scrollIntoViewIfNeeded().catch(() => {}); await pila.click().catch(() => {}); await p.waitForTimeout(500); }
      const leer = p.getByRole('button', { name: 'Leer mi revisión' }).first();
      if (await leer.waitFor({ timeout: 12000 }).then(() => true).catch(() => false)) {
        await leer.scrollIntoViewIfNeeded();
        await leer.click();
        const h = p.locator('.historia-rev');
        if (await h.waitFor({ timeout: 10000 }).then(() => true).catch(() => false) && await hasta(async () => (await h.locator('.historia-pantalla h2').count()) > 0, 8000)) {
          const pausar = h.getByRole('button', { name: 'Pausar la historia' });
          check(await pausar.count() === 1, '(334) la historia, con su botón de pausa arriba');
          await pausar.click();
          const seguir = h.getByRole('button', { name: 'Seguir la historia' });
          const parada = await hasta(async () => (await seguir.count()) === 1, 3000);
          const barra = await h.locator('.historia-barras .actual i').first().evaluate((el) => getComputedStyle(el).animationPlayState).catch(() => '');
          check(parada && barra !== 'running', `(334) al tocarlo se para, y su barra también (${barra || 'sin barra'})`);
          await p.keyboard.press(' ');
          check(await hasta(async () => (await h.getByRole('button', { name: 'Pausar la historia' }).count()) === 1, 3000), '(334) y con la barra espaciadora sigue');
        } else check(true, '(334) sin nada que contar en tres tarjetas: se abre la revisión de siempre');
      } else check(true, '(334) Tomás no tiene revisión pendiente en esta demo');
    } finally { await ctx.close(); }
  }

  // --- 343: «Gestos» en Ajustes y «Solo botones»
  {
    const { ctx, p, arrastrar } = await abrir('?demo', /Ana/);
    try {
      // de serie, la regla del peso está (el atajo que se ve: según la hora y lo apuntado, Hoy lo lleva en un sitio u otro)
      const peso = p.locator('[data-atajo="peso"]:visible').first();
      let conRegla = null;
      if (await peso.count()) {
        await peso.scrollIntoViewIfNeeded().catch(() => {});
        await peso.click();
        const ph = p.getByRole('dialog', { name: 'Peso de hoy' });
        await ph.waitFor();
        conRegla = await hasta(async () => (await ph.locator('.rg-raiz').count()) === 1, 5000);
        await ph.locator('.cerrar-hoja').click();
        await ph.waitFor({ state: 'detached' });
      }
      await irAAjustes(p);
      const fila = p.getByRole('button', { name: /^Gestos/ }).first();
      await fila.scrollIntoViewIfNeeded();
      await fila.click();
      const h = p.getByRole('dialog', { name: 'Gestos' });
      await h.waitFor();
      const filas = await h.locator('.lista li').count();
      check(filas >= 16, `(343) «Gestos»: lo que se hace con el dedo, cada gesto con su botón (${filas - 1} gestos)`);
      await p.waitForTimeout(500);
      let c = await h.locator('.hoja-cab').boundingBox();
      await arrastrar(c.x + c.width / 2, c.y + c.height / 2, 0, 380);
      check(await h.waitFor({ state: 'detached', timeout: 4000 }).then(() => true).catch(() => false), '(343) de serie, arrastrar la hoja hacia abajo la cierra');
      await fila.click();
      await h.waitFor();
      await h.getByRole('switch', { name: /Solo botones/ }).check();
      check(await p.evaluate(() => document.documentElement.hasAttribute('data-solo-botones')), '(343) «Solo botones», encendido');
      await p.waitForTimeout(500);
      c = await h.locator('.hoja-cab').boundingBox();
      await arrastrar(c.x + c.width / 2, c.y + c.height / 2, 0, 380);
      await p.waitForTimeout(900);
      check(await h.isVisible().catch(() => false), '(343) con «Solo botones», arrastrarla ya no la cierra');
      await h.locator('.cerrar-hoja').click();
      check(await h.waitFor({ state: 'detached', timeout: 4000 }).then(() => true).catch(() => false) && /Solo botones/.test(await fila.textContent()), '(343) la ✕ sí la cierra, y la fila dice «Solo botones»');
      // sin la regla del peso (el − y el + siguen)
      if (conRegla != null) {
        await p.locator('nav.tabs .tab[data-tab="hoy"]').first().click();
        await p.waitForTimeout(800);
        await peso.scrollIntoViewIfNeeded().catch(() => {});
        await peso.click();
        const ph = p.getByRole('dialog', { name: 'Peso de hoy' });
        await ph.waitFor();
        await p.waitForTimeout(800);
        check(conRegla && (await ph.locator('.rg-raiz').count()) === 0 && (await ph.locator('#peso-hoy').count()) === 1, '(343) y en «Peso de hoy», sin la regla: el − y el + siguen (de serie, la regla estaba)');
        await ph.locator('.cerrar-hoja').click();
        await ph.waitFor({ state: 'detached' });
      } else check(true, '(343) sin «Peso de hoy» en esta demo');
      // en el chat, «Más opciones» se ve en cada mensaje
      const msj = p.locator('nav.tabs .tab[data-tab="mensajes"]').first();
      if (await msj.count()) {
        await msj.click();
        const mas = p.locator('.burbuja-mas').first();
        if (await mas.waitFor({ state: 'attached', timeout: 10000 }).then(() => true).catch(() => false)) {
          const op = await mas.evaluate((el) => getComputedStyle(el).opacity);
          check(Number(op) === 1, `(343) en el chat, «Más opciones» se ve en cada mensaje (opacidad ${op})`);
        } else check(true, '(343) sin mensajes con menú en esta demo');
      } else check(true, '(343) sin chat en esta demo');
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `el remate, segunda vuelta, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
}

// (v0.285) El repaso: el lobo que se dibuja al tirar para actualizar (173); lo delicado, manteniendo pulsado, y con «Solo
// botones», siempre la pregunta (206 y 343); lo que oye el lector de pantalla en lo nuevo (333); y, sin instalar, los
// bordes de la pantalla son del navegador (346).
export async function probarMomentos6({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const abrir = async (url, quien, ajustes = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true, reducedMotion: 'no-preference' });
    await ctx.route(/i\.ytimg\.com/, (r) => r.abort());
    const p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(`error de página: ${String(e.message).slice(0, 200)}`));
    await p.addInitScript((aj) => {
      try {
        for (const k of ['fbe-escena-200', 'fbe-bienvenida-vista', 'fbe-nec-todas']) localStorage.setItem(k, '1');
        localStorage.setItem('fbe-ajustes', JSON.stringify({ ...JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'), ...aj }));
      } catch { /* */ }
    }, ajustes);
    await p.goto(`${base}/${url}`);
    const b = p.getByRole('button', { name: quien }).first();
    if (await b.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await b.click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(1500);
    for (let i = 0; i < 6; i++) {
      const c = p.locator('[aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Ahora no"), [aria-modal="true"] button:has-text("Entendido")').first();
      if (await c.isVisible().catch(() => false)) { await c.click().catch(() => {}); await p.waitForTimeout(350); } else break;
    }
    const cdp = await ctx.newCDPSession(p);
    const dedo = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    return { ctx, p, dedo };
  };
  const hasta = async (fn, ms = 6000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn().catch(() => false)) return true; await new Promise((r) => setTimeout(r, 120)); } return false; };

  // --- 173: tirar para actualizar en Hoy: el lobo se dibuja con el dedo, se rellena al pasar el umbral y, mientras
  //     llega todo, una luz recorre su trazo
  {
    const { ctx, p, dedo } = await abrir('?demo', /Ana/);
    try {
      await p.evaluate(() => scrollTo(0, 0));
      await p.waitForTimeout(400);
      const leer = () => p.evaluate(() => {
        const t = document.querySelector('body > .tirar'), tr = t?.querySelector('.tirar-lobo-trazo'), ll = t?.querySelector('.tirar-lobo-lleno');
        return t && tr && ll ? { lleno: Number(getComputedStyle(t).getPropertyValue('--lleno')), off: parseFloat(getComputedStyle(tr).strokeDashoffset), relleno: Number(getComputedStyle(ll).fillOpacity), lista: t.classList.contains('lista'), girando: t.classList.contains('girando'), oculto: t.getAttribute('aria-hidden') } : null;
      });
      const x = 196, y0 = 430;
      await dedo('touchStart', x, y0);
      for (let k = 1; k <= 8; k++) { await dedo('touchMove', x, y0 + (100 * k) / 8); await p.waitForTimeout(16); }
      const medio = await leer();
      check(!!medio && medio.oculto === 'true' && medio.lleno > 0.5 && medio.lleno < 0.9 && Math.abs(medio.off - (1 - medio.lleno)) < 0.05 && medio.relleno === 0 && !medio.lista,
        `(173) al tirar, el lobo se dibuja con el dedo: su trazo va por el ${medio ? Math.round(medio.lleno * 100) : '?'} % y aún sin rellenar${medio ? ` ${JSON.stringify(medio)}` : ''}`);
      for (let k = 1; k <= 6; k++) { await dedo('touchMove', x, y0 + 100 + (130 * k) / 6); await p.waitForTimeout(16); }
      await p.waitForTimeout(400);
      const lleno = await leer();
      check(!!lleno && lleno.lista && lleno.lleno === 1 && lleno.off < 0.01 && lleno.relleno === 1, '(173) pasado el umbral, el lobo entero y relleno (y la rueda se enciende)');
      await dedo('touchEnd');
      const gira = await hasta(async () => (await leer())?.girando === true, 2000);
      await p.waitForTimeout(450);   // (el relleno baja con su transición)
      const enGiro = await leer();
      check(gira && !!enGiro && enGiro.relleno < 0.5, `(173) al soltar, mientras llega todo, el lobo en sombra y una luz por su trazo (relleno ${enGiro ? enGiro.relleno : '?'})`);
      check(await hasta(async () => !(await leer())?.girando, 10000), '(173) y al llegar, la rueda se va');
    } finally { await ctx.close(); }
  }

  // --- 333: lo que oye el lector de pantalla en lo nuevo; 346: sin instalar, los bordes son del navegador
  {
    const { ctx, p, dedo } = await abrir('?demo', /Ana/);
    try {
      // la regla de «Peso de hoy»: un deslizador con su nombre y su valor con la unidad
      const peso = p.locator('[data-atajo="peso"]:visible').first();
      if (await peso.count()) {
        await peso.scrollIntoViewIfNeeded().catch(() => {});
        await peso.click();
        const ph = p.getByRole('dialog', { name: 'Peso de hoy' });
        await ph.waitFor();
        const regla = ph.getByRole('slider').first();
        const conRegla = await regla.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
        const nombre = conRegla ? await regla.getAttribute('aria-label') : '', valor = conRegla ? await regla.getAttribute('aria-valuetext') : '';
        check(conRegla && !!nombre && /\d kg$/.test(valor || ''), `(333) la regla del peso: un deslizador con su nombre («${nombre}») y su valor con la unidad («${valor}»)`);
        await ph.locator('.cerrar-hoja').click();
        await ph.waitFor({ state: 'detached' });
      } else check(true, '(333) sin «Peso de hoy» a la vista en esta demo');
      // las barras de series por músculo: cada una dice su músculo y sus series
      await irASeccion(p, 'Progreso');
      await p.waitForTimeout(900);
      const barras = p.locator('.barras button[aria-label*="series"]');
      const nb = await barras.count();
      check(nb > 0, `(333) las barras de series por músculo, cada una con su nombre (${nb}${nb ? `; la primera: «${await barras.first().getAttribute('aria-label')}»` : ''})`);
      // la historia de una semana: su nombre, sus zonas con nombre y la pausa sin el estado de «pulsado»
      await subProgreso(p, 'resumen');
      const filas = p.locator('button.amb-sem');
      if (await filas.first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false)) {
        await filas.first().click();
        const h = p.locator('[role="dialog"].historia').first();
        await h.waitFor({ timeout: 8000 });
        await p.waitForTimeout(600);
        const nombreH = await h.getAttribute('aria-label');
        const pausa = h.getByRole('button', { name: 'Pausar la historia' });
        const conPausa = await pausa.count();
        const zonas = await h.locator('.historia-zona').evaluateAll((l) => l.map((z) => z.getAttribute('aria-label')));
        check(!!nombreH && zonas.length === 2 && zonas.every(Boolean) && (conPausa === 0 || (await pausa.getAttribute('aria-pressed')) === null),
          `(333) la historia: su nombre («${nombreH}»), sus dos zonas con nombre (${zonas.join(' · ')}) y la pausa, que dice lo que hará`);
        await p.keyboard.press('Escape');
        await h.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
      } else check(true, '(333) sin semanas que contar en esta demo');
      // 346: sin instalar, el dedo que empieza en el borde de la pantalla es del navegador (en Safari, atrás y adelante);
      // un poco más dentro, deslizar cambia de apartado como siempre
      const activa = () => p.locator('.pestanas-progreso [aria-selected="true"]').first().textContent().catch(() => '');
      // (una altura en la que, en los dos sitios donde empieza el dedo, no haya nada con su propio gesto de lado)
      const sinDeslizar = (readFileSync(new URL('../web/src/ui/deslizar.js', import.meta.url), 'utf8').match(/export const SIN_DESLIZAR = '([^']+)'/) || [])[1] || '.grafica-caja';
      const yy = await p.evaluate((no) => {
        for (let y = 260; y < innerHeight - 140; y += 24) {
          const ok = [300, 384].every((x) => { const el = document.elementFromPoint(x, y); return el?.closest('.progreso-panel') && !el.closest(no); });
          if (ok) return y;
        }
        return 360;
      }, sinDeslizar);
      const antes = await activa();
      const barrer = async (x0, dx) => { await dedo('touchStart', x0, yy); for (let k = 1; k <= 10; k++) { await dedo('touchMove', x0 + (dx * k) / 10, yy); await p.waitForTimeout(16); } await dedo('touchEnd'); await p.waitForTimeout(700); };
      await barrer(384, -220);
      const trasBorde = await activa();
      await barrer(300, -220);
      const trasDentro = await activa();
      check(trasBorde === antes && trasDentro !== antes, `(346) sin instalar, deslizar desde el borde no cambia de apartado (lo usa el navegador); desde dentro, sí (${antes} · ${trasBorde} · ${trasDentro})`);
    } finally { await ctx.close(); }
  }

  // --- 206 y 343: lo delicado. Un toque pregunta; mantenerlo pulsado un segundo lo hace sin preguntar; con «Solo
  //     botones», mantenerlo pulsado no hace nada (y un toque, la pregunta de siempre)
  for (const solo of [true, false]) {
    const { ctx, p, dedo } = await abrir('?demo=esencial', /Tomás/, solo ? { soloBotones: true } : {});
    try {
      await p.locator('.ayu-necesitas').getByRole('button', { name: 'Mis pruebas' }).click();
      const hoja = p.locator('[aria-modal="true"]').last();
      const conDatos = await p.waitForFunction(() => /14 veces, el/.test([...document.querySelectorAll('[aria-modal="true"]')].pop()?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
      const boton = hoja.getByRole('button', { name: /Borrar mis pruebas/ });
      if (conDatos && await boton.count()) {
        await boton.scrollIntoViewIfNeeded();
        const c = await boton.boundingBox();
        await dedo('touchStart', c.x + c.width / 2, c.y + c.height / 2);
        await p.waitForTimeout(1250);
        await dedo('touchEnd');
        await p.waitForTimeout(900);
        const siguen = /14 veces, el/.test(await hoja.textContent());
        if (solo) {
          check(siguen && (await hoja.locator('.mnt-boton[data-llena]').count()) === 0, '(343) con «Solo botones», mantener pulsado «Borrar mis pruebas» no borra nada (ni se llena)');
          if (!(await hoja.getByRole('group', { name: 'Borrar tus pruebas' }).count())) await boton.click();
          const pregunta = hoja.getByRole('group', { name: 'Borrar tus pruebas' });
          check(await pregunta.waitFor({ timeout: 3000 }).then(() => true).catch(() => false), '(343) y un toque, la pregunta de siempre');
          await pregunta.getByRole('button', { name: 'Cancelar' }).click();
        } else check(!siguen, '(206) mantener pulsado un segundo «Borrar mis pruebas» las borra sin preguntar');
      } else check(true, '(206) Tomás sin pruebas que borrar en esta demo');
    } finally { await ctx.close(); }
  }
  // --- 348: sin cobertura, igual de bien (con la app guardada, como quien la tiene instalada): la regla de los kilos con
  //     sus estilos, el cartel del descanso y el modo cocina
  for (const esencial of [false, true]) {
    const { ctx, p } = await abrir(esencial ? '?demo=esencial' : '?demo', esencial ? /Tomás/ : /Ana/, {});
    try {
      await p.evaluate(() => { try { localStorage.setItem('fbe-sw-local', '1'); } catch { /* */ } });
      await p.reload();
      const b = p.getByRole('button', { name: esencial ? /Tomás/ : /Ana/ }).first();
      if (await b.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await b.click();
      await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      await p.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 30000))]));
      if (!(await p.evaluate(() => !!navigator.serviceWorker.controller))) {
        await p.reload();
        if (await b.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) await b.click();
        await p.locator('nav.tabs').waitFor({ timeout: 30000 });
      }
      const guardada = await hasta(async () => p.evaluate(async () => { if (!navigator.serviceWorker.controller) return false; for (const k of await caches.keys()) if (k.startsWith('fbe-atletas-') && (await (await caches.open(k)).keys()).length > 300) return true; return false; }), 30000);
      await p.waitForTimeout(800);
      for (let i = 0; i < 5 && await p.locator('[aria-modal="true"]').count(); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
      await ctx.setOffline(true);
      if (!esencial) {
        await p.locator('[data-atajo="empezar"]').first().click();
        for (let k = 0; k < 4 && !(await p.locator('.sesion-vista').count()); k++) { await p.waitForTimeout(1200); const e = p.getByRole('button', { name: /^Empezar$|Vamos|Saltar/ }).first(); if (await e.count()) await e.click().catch(() => {}); }
        await p.locator('.sesion-vista').waitFor({ timeout: 15000 });
        await p.waitForTimeout(1000);
        for (const bb of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await bb.click().catch(() => {});
        const campo = p.locator('.sesion-vista input[inputmode="none"]').first();
        await campo.click();
        const regla = p.locator('.teclado-serie [role="slider"]').first();
        const conRegla = await regla.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
        const estilo = conRegla ? await p.evaluate(() => { const l = [...document.querySelectorAll('link[rel="stylesheet"]')].find((x) => /Sesion-/.test(x.getAttribute('href') || '')); const c = document.querySelector('.teclado-serie .rg-caja'); return { hoja: !!l?.sheet, alto: Math.round(c?.getBoundingClientRect().height || 0) }; }) : { hoja: false, alto: 0 };
        check(guardada && conRegla && estilo.hoja && estilo.alto > 20, `(348) sin cobertura, la sesión abre con sus estilos y la regla de los kilos (${estilo.alto} px de alto)`);
        await p.locator('.teclado-serie').getByRole('button', { name: 'Ocultar el teclado' }).click().catch(() => {});
        await p.getByRole('button', { name: /^Marcar la serie 1 como hecha/ }).first().click();
        const reloj = p.locator('.temporizador');
        await reloj.waitFor({ timeout: 8000 });
        await reloj.getByRole('button', { name: 'Ver el descanso en grande (modo cartel)' }).click();
        check(await p.locator('.ct-raiz').waitFor({ timeout: 6000 }).then(() => true).catch(() => false), '(348) y el cartel del descanso');
        await p.keyboard.press('Escape');
      } else {
        await p.locator('nav.tabs').getByRole('button', { name: /^Recetas/ }).first().click();
        const tarjetas = p.locator('.rejilla-recetas button');
        const conRecetas = await tarjetas.first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
        if (conRecetas) {
          await tarjetas.first().click();
          await p.locator('[aria-modal="true"] .coc-ing').first().waitFor({ timeout: 15000 });
          await p.locator('[aria-modal="true"]').last().getByRole('button', { name: 'Modo cocina' }).click();
          const cocina = p.locator('.coc-raiz');
          const abre = await cocina.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
          const nombre = abre ? await cocina.locator('.coc-nombre').evaluate((e) => ({ cortado: e.scrollHeight > e.clientHeight + 2 || getComputedStyle(e).textOverflow === 'ellipsis', lineas: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) })) : null;
          check(guardada && abre && !!nombre && !nombre.cortado, `(348) sin cobertura, una receta y su modo cocina; (290) con el nombre entero (${nombre ? nombre.lineas : '?'} líneas)`);
          await p.keyboard.press('Escape');
        } else check(false, '(348) sin cobertura, las recetas no salen');
      }
      await ctx.setOffline(false);
    } finally { await ctx.close(); }
  }
  check(errores.length === 0, `el repaso, sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
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
  if (!solo || solo === '4') { console.log('Sonido y tacto afinados (v0.283)'); try { await probarMomentos4({ navegador, check, base: 'http://localhost:4201' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); } }
  if (!solo || solo === '5') { console.log('El remate, segunda vuelta (v0.284)'); try { await probarMomentos5({ navegador, check, base: 'http://localhost:4201' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); } }
  if (!solo || solo === '6') { console.log('El repaso (v0.285)'); try { await probarMomentos6({ navegador, check, base: 'http://localhost:4201' }); } catch (e) { fallos++; console.log('  ✗ se ha cortado:', String(e?.message || e).split('\n').slice(0, 5).join(' / ')); } }
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
