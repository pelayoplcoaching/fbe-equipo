// v0.58.1: el chat del atleta en el iPhone con mucho historial (más de dos páginas), desplazando con el dedo. Lo llama
// e2e.test.mjs (y se puede lanzar suelto). Un contexto aparte con el iPhone 13 de Playwright (táctil y móvil): sin la
// copia del móvil, con ella (y la base lenta, como con poca cobertura) e «ir a una fecha».
// Chromium ancla el desplazamiento por su cuenta (scroll anchoring) y Safari no: la app lo apaga en el chat
// (overflow-anchor: none), así que aquí se prueba el mismo camino que en el iPhone.
import { devices } from 'playwright';

const ANTIGUOS = 650;

export async function probarChatIphone({ navegador, check, base = 'http://localhost:4174' }) {
  const ctx = await navegador.newContext({ ...devices['iPhone 13'], locale: 'es-ES' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  // Cada vez que crece la lista: dónde estaba (en el fotograma de antes) y dónde está después el mensaje que se leía
  await p.addInitScript(() => {
    window.__anclas = [];
    const medir = () => {
      const tope = document.querySelector('.cabecera')?.getBoundingClientRect().bottom || 0;
      for (const b of document.querySelectorAll('.chat-lista .burbuja[id]')) { const r = b.getBoundingClientRect(); if (r.bottom > tope + 4) return { id: b.id, top: r.top }; }
      return null;
    };
    let previo = null, n = 0;
    const tic = () => {
      const k = document.querySelectorAll('.chat-lista .burbuja').length;
      if (k > n && n && previo) {
        const el = document.getElementById(previo.id);
        window.__anclas.push({ id: previo.id, antes: Math.round(previo.top), despues: el ? Math.round(el.getBoundingClientRect().top) : null, n0: n, n1: k,
          abajo: Math.round(document.documentElement.scrollHeight - scrollY - innerHeight) });
      }
      n = k; previo = medir();
      requestAnimationFrame(tic);
    };
    requestAnimationFrame(tic);
  });
  const cdp = await ctx.newCDPSession(p);
  // Un dedo que baja (el contenido sube: hacia lo antiguo); si el táctil no mueve nada, la rueda
  const deslizar = async (dy = 420) => {
    const y0 = await p.evaluate(() => scrollY);
    const x = 195, desde = 260;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: desde }] });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: desde + (dy * i) / 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(140);
    if (y0 > 0 && (await p.evaluate(() => scrollY)) === y0) { await p.mouse.move(195, 400); await p.mouse.wheel(0, -dy); await p.waitForTimeout(140); }
  };
  const estado = () => p.evaluate(() => ({ n: document.querySelectorAll('.chat-lista .burbuja').length, y: Math.round(scrollY),
    abajo: Math.round(document.documentElement.scrollHeight - scrollY - innerHeight), mas: !!document.querySelector('.chat-anteriores'),
    primero: !!document.querySelector('.chat-lista .burbuja')?.textContent.includes('Mensaje antiguo 0 ') }));
  // Sube con el dedo hasta el primer mensaje de todos (o hasta que se acaben los intentos)
  const subirHastaElPrincipio = async (max = 160) => {
    for (let i = 0; i < max; i++) {
      const e = await estado();
      if (e.primero && e.y <= 2 && !e.mas) return true;
      await deslizar();
    }
    const e = await estado();
    return e.primero && e.y <= 2 && !e.mas;
  };
  const anclasBien = (xs, tol = 40) => xs.length > 0 && xs.every((a) => a.despues != null && Math.abs(a.despues - a.antes) <= tol);

  await p.goto(`${base}/?demo`);
  await p.getByRole('heading', { name: 'Entra en tu cuenta' }).waitFor();
  await p.getByRole('button', { name: /Ana López/ }).first().click();
  await p.locator('nav.tabs').waitFor();
  await p.waitForFunction(() => !!JSON.parse(localStorage.getItem('fbe-demo-v2') || 'null')?.atletas?.length);
  // Su conversación, con ANTIGUOS mensajes de antes (de las últimas semanas, cada dos horas), con la app cerrada
  await p.goto(`${base}/manifest.webmanifest`);
  const diaPrimero = await p.evaluate((n) => {
    const d = JSON.parse(localStorage.getItem('fbe-demo-v2'));
    const ana = d.atletas.find((a) => a.nombre.startsWith('Ana'));
    const t0 = Date.now() - 1000 * 3600 * 24 * 90, visto = new Date().toISOString();
    for (let i = 0; i < n; i++) {
      d.comentarios.push({ id: crypto.randomUUID(), atleta_id: ana.id, sesion_id: null, checkin_id: null, archivo_id: null, autor: i % 2 ? 'coach' : 'atleta', adjunto: false, dibujo: null,
        texto: `Mensaje antiguo ${i} `, creado_en: new Date(t0 + i * 2 * 3600 * 1000).toISOString(), leido_en: visto, entregado_en: visto });
    }
    localStorage.setItem('fbe-demo-v2', JSON.stringify(d));
    const f = new Date(t0);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  }, ANTIGUOS);

  // 1. Sin la copia del móvil: abre en la primera página, abajo del todo
  await p.goto(`${base}/?demo#mensajes`);
  await p.locator('.chat-lista .burbuja').first().waitFor();
  await p.locator('.chat-anteriores').waitFor();
  await p.waitForTimeout(600);
  const e0 = await estado();
  // (abajo, o en «N mensajes sin leer»: Ana tiene alguno de su coach en la demo)
  check(e0.n === 400 && e0.abajo < 1500 && e0.mas, `(v0.58.1) iPhone, sin la copia del móvil: abre con la primera página (${e0.n} mensajes), al final (a ${e0.abajo} px)`);
  // (la base algo lenta: cada página llega cuando el dedo ya ha parado)
  await p.evaluate(() => { localStorage.setItem('fbe-demo-retraso', '350'); window.__anclas = []; });
  const alPrincipio = await subirHastaElPrincipio();
  const frio = await p.evaluate(() => window.__anclas);
  check(alPrincipio, '(v0.58.1) con el dedo hacia arriba se cargan las páginas anteriores, hasta el primer mensaje de todos');
  check(frio.filter((a) => a.n0 >= 400).length >= 2 && anclasBien(frio), `(v0.58.1) y al llegar cada una, el mensaje que se leía se queda donde estaba (${frio.map((a) => `${a.n0}→${a.n1}: ${a.antes}→${a.despues}`).join(', ')})`);
  await p.evaluate(() => localStorage.removeItem('fbe-demo-retraso'));

  // 2. Con la copia del móvil (IndexedDB) y la base lenta (poca cobertura): abre al momento con lo guardado
  await p.waitForFunction(() => new Promise((ok) => { const r = indexedDB.open('fbe-chat-v1'); r.onsuccess = () => { const d = r.result; if (!d.objectStoreNames.contains('conversaciones')) { d.close(); ok(false); return; } const t = d.transaction('conversaciones').objectStore('conversaciones').getAll(); t.onsuccess = () => { d.close(); ok(t.result.some((x) => x.mensajes.length >= 200)); }; }; r.onerror = () => ok(false); }));
  // (se recarga la app con la copia ya en el móvil; después, con la base lenta, se sale del chat y se vuelve)
  await p.reload();
  await p.locator('.chat-anteriores').waitFor();
  await p.evaluate(() => { location.hash = '#hoy'; });
  await p.locator('.chat-lista').waitFor({ state: 'detached' });
  // (pulido 2.2: una consulta idéntica a otra de hace menos de 2 s se comparte; aquí se quiere ver la base lenta de verdad)
  await p.waitForTimeout(2300);
  await p.evaluate(() => { localStorage.setItem('fbe-demo-retraso', '5000'); location.hash = '#mensajes'; });
  await p.locator('.chat-lista .burbuja').first().waitFor({ timeout: 4000 });
  await p.waitForTimeout(300);
  const e1 = await estado();
  check(e1.n === 200 && e1.abajo < 300, `(v0.58.1) con la copia del móvil y la base lenta: al momento, lo guardado (${e1.n}), abajo del todo`);
  await p.evaluate(() => { window.__anclas = []; });
  // Sube con el dedo por lo guardado hasta arriba (antes de que conteste la base)
  for (let i = 0; i < 40 && (await estado()).y > 2 && (await estado()).n === 200; i++) await deslizar();
  const e2 = await estado();
  check(e2.n === 200 && e2.y <= 2 && await p.locator('.chat-anteriores', { hasText: 'Cargando los anteriores' }).count() === 1,
    '(v0.58.1) arriba de lo guardado, mientras contesta la base: «Cargando los anteriores…» (lo guardado no es todo el chat)');
  await p.evaluate(() => localStorage.removeItem('fbe-demo-retraso'));
  await p.waitForFunction(() => document.querySelectorAll('.chat-lista .burbuja').length > 200, null, { timeout: 20000 });
  await p.waitForTimeout(400);
  const cambio = (await p.evaluate(() => window.__anclas)).find((a) => a.n0 === 200);
  const e3 = await estado();
  check(!!cambio && anclasBien([cambio]) && e3.abajo > 5000, `(v0.58.1) al contestar la base, NO salta abajo: sigue en el mensaje que leía, con lo anterior ya encima (${cambio ? `${cambio.antes}→${cambio.despues}, a ${e3.abajo} px del final` : 'sin cambio'})`);
  await p.evaluate(() => { localStorage.setItem('fbe-demo-retraso', '350'); window.__anclas = []; });
  const alPrincipio2 = await subirHastaElPrincipio();
  await p.evaluate(() => localStorage.removeItem('fbe-demo-retraso'));
  const caliente = await p.evaluate(() => window.__anclas);
  check(alPrincipio2 && anclasBien(caliente), `(v0.58.1) y sigue subiendo con el dedo hasta el primer mensaje, sin saltos (${caliente.map((a) => `${a.n0}→${a.n1}: ${a.antes}→${a.despues}`).join(', ')})`);

  // 3. «Ir a una fecha»: el día del primer mensaje, desde la primera página
  await p.reload();
  await p.locator('.chat-anteriores').waitFor();
  await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Buscar en el chat' }).click();
  await p.getByRole('group', { name: 'Buscar por tipo o ir a una fecha' }).getByLabel('Ir a una fecha').fill(diaPrimero);
  const fecha = await p.locator('.burbuja.resaltada', { hasText: 'Mensaje antiguo 0 ' }).waitFor({ timeout: 8000 }).then(() => true, () => false);
  check(fecha && await p.locator('.burbuja.resaltada', { hasText: 'Mensaje antiguo 0 ' }).isVisible(), '(v0.58.1) «ir a una fecha» (el día del primero): carga hasta ahí y va a ese mensaje');

  check(!errores.length, `(v0.58.1) el chat del iPhone, sin errores${errores.length ? `: ${errores.join(' | ').slice(0, 300)}` : ''}`);
  await ctx.close();
}
