// Pulido de fluidez, segunda tanda, en la demo y en un móvil simulado (táctil): fotos de perfil ligeras, consultas
// compartidas, pantallas que no se mueven al cargar, zonas de toque, botones que avisan, teclado y arranque.
//   Suelta:  npm run build && node test/e2e-pulido2.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarPulido2 } = await import('./e2e-pulido2.mjs'); await probarPulido2({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarPulido2({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  // lecturas: cuenta las consultas de la demo (window.__q: «tabla filtro»; las funciones, «rpc:nombre»)
  const abrir = async (quien, opciones = {}, { antes = null, retraso = 0 } = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: 'es-ES', ...opciones });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Sin conexi/.test(m.text())) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.addInitScript((r) => {
      if (r) { try { localStorage.setItem('fbe-demo-retraso', String(r)); } catch { /* */ } }
      window.__q = [];
      let b0;
      Object.defineProperty(globalThis, '__fbeDemo', { configurable: true, get() { return b0; }, set(b) {
        b0 = b;
        const s = b.select.bind(b), f = b.rpc.bind(b);
        b.select = (t, x, ...a) => { window.__q.push(`${t} ${JSON.stringify(x || {})}`); return s(t, x, ...a); };
        b.rpc = (n, ...a) => { window.__q.push(`rpc:${n}`); return f(n, ...a); };
        // (6) window.__lento: ms que tarda cada escritura (para ver el botón mientras guarda)
        for (const m of ['insert', 'update', 'upsert', 'delete']) { const w = b[m].bind(b); b[m] = async (...a) => { if (window.__lento) await new Promise((r) => setTimeout(r, window.__lento)); return w(...a); }; }
      } });
    }, retraso);
    // (3) cada fotograma: cuánto se mueve, sin desplazar la pantalla, lo que ya se estaba viendo (window.__mov, en px)
    await p.addInitScript(() => {
      window.__mov = 0; window.__huecos = 0;
      const antes = new WeakMap(); let sy = 0;
      const bloques = () => { const m = document.querySelector('main'); const out = []; if (!m) return out;
        const baja = (n, prof) => { for (const h of n.children) { if (h.classList.contains('reserva')) { baja(h, prof); continue; } if (h.classList.contains('reserva-hueco')) continue; out.push(h); if (prof < 3 && h.children.length && !/^(svg|button|ul|table)$/i.test(h.tagName)) baja(h, prof + 1); } };
        baja(m, 0); return out; };
      const paso = () => {
        const y = window.scrollY, alto = window.innerHeight; let max = 0;
        for (const el of bloques()) { const r = el.getBoundingClientRect(); if (!r.width && !r.height) { antes.delete(el); continue; } const a = antes.get(el);
          if (a && y === sy && a.top < alto && a.top + a.h > 0) max = Math.max(max, Math.abs(r.top - a.top));
          antes.set(el, { top: r.top, h: r.height }); }
        if (max > 3) window.__mov += Math.round(max);
        window.__huecos = Math.max(window.__huecos, document.querySelectorAll('.reserva-hueco[data-hueco]').length);
        sy = y; requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
    if (antes) await antes(p);
    await p.goto(`${base}/?demo`);
    if (quien) await entrar(p, quien);
    return { ctx, p, cdp: await ctx.newCDPSession(p) };
  };
  const entrar = async (p, quien) => {
    await p.getByRole('button', { name: quien }).first().click();
    await p.locator('nav.tabs, nav').first().waitFor();
    await cerrarAvisos(p);
  };
  // Los avisos de primera vez (bienvenida, novedades…), fuera
  const cerrarAvisos = async (p) => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const n of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir', 'Empezar', 'Luego']) { const b = d.getByRole('button', { name: n, exact: true }).first(); if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; } }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  // Recargar la app (en la demo vuelve a la elección de cuenta, o sigue dentro: vale para las dos)
  const recargar = async (p, quien) => {
    await p.reload();
    const dentro = await p.locator('nav.tabs').first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
    if (!dentro) await entrar(p, quien);
  };
  const lecturas = (p, patron) => p.evaluate((x) => window.__q.filter((q) => new RegExp(x).test(q)).length, patron);
  const filasAtletas = (p) => p.locator('tr:visible, button.tarjeta-atleta:visible');

  try {
    // ---------- 1. Fotos de perfil ligeras
    {
      const { ctx, p } = await abrir(/Pelayo/);
      await filasAtletas(p).first().waitFor();
      // Dos atletas con la foto de siempre (384 px) aún entera en «foto», como están hoy todas
      const grande = await p.evaluate(async () => {
        const c = document.createElement('canvas'); c.width = 384; c.height = 384; const x = c.getContext('2d');
        // (con ruido, para que pese como una foto de verdad)
        const im = x.createImageData(384, 384); for (let i = 0; i < im.data.length; i += 4) { im.data[i] = (i * 7) % 255; im.data[i + 1] = Math.random() * 255; im.data[i + 2] = (i >> 9) % 255; im.data[i + 3] = 255; } x.putImageData(im, 0, 0);
        let foto = null; for (const q of [0.7, 0.5, 0.3, 0.2, 0.1]) { foto = c.toDataURL('image/jpeg', q); if (foto.length <= 80000) break; }
        const b = globalThis.__fbeDemo;
        const atletas = await b.select('atletas', {});
        for (const n of ['Ana López', 'Rubén Martín']) await b.update('perfiles', { foto }, { eq: { id: atletas.find((a) => a.nombre === n).perfil_id } });
        return foto.length;
      });
      await p.waitForTimeout(500);   // (la demo guarda sus datos en el navegador un momento después de cada cambio)
      await recargar(p, /Pelayo/);
      await filasAtletas(p).first().waitFor();
      // La app del coach las aligera sola, en segundo plano
      let ligeras = null;
      for (let i = 0; i < 30 && !ligeras; i++) {
        await p.waitForTimeout(400);
        ligeras = await p.evaluate(async () => {
          const ps = (await globalThis.__fbeDemo.select('perfiles', {})).filter((x) => x.foto);
          return ps.length === 2 && ps.every((x) => x.foto.length < 16000 && x.foto_grande?.length > 20000) ? ps.map((x) => x.foto.length) : null;
        });
      }
      check(grande > 20000 && !!ligeras, `las fotos de perfil que iban enteras (${Math.round(grande / 1024)} kB cada una) se aligeran solas: en las listas viaja la miniatura (${ligeras ? Math.round(ligeras[0] / 1024) : '?'} kB) y la grande se guarda aparte`);
      // En la lista se ve la miniatura; y de una sección a otra las fotos no se vuelven a pedir
      await irASeccion(p, 'Revisar'); await p.waitForTimeout(500);
      await irASeccion(p, 'Atletas');
      await p.locator('button.tarjeta-atleta:visible .avatar.con-foto img').first().waitFor({ timeout: 8000 });
      // (con pausas de más de dos segundos: si no, las consultas se comparten y casi no hay ninguna que mirar)
      await p.waitForTimeout(2300);
      await p.evaluate(() => { window.__q = []; });
      await irASeccion(p, 'Revisar'); await p.waitForTimeout(2300);
      await irASeccion(p, 'Mensajes'); await p.waitForTimeout(2300);
      await irASeccion(p, 'Atletas'); await p.waitForTimeout(800);
      const total = await lecturas(p, '.'), deFotos = await lecturas(p, '^perfiles .*"cols":"id,foto"');
      check(total > 20 && deFotos === 0, `al pasar por Revisar, Mensajes y Atletas las fotos no se vuelven a bajar (${total} consultas, ${deFotos} de fotos)`);
      // Al ampliarla, la grande
      await p.locator('tr:visible, button.tarjeta-atleta:visible', { hasText: 'Ana López' }).first().dispatchEvent('click');
      await p.locator('.avatar-ampliable').first().waitFor();
      const mini = await p.locator('.avatar-ampliable img').first().evaluate((i) => i.src.length);
      await p.locator('.avatar-ampliable').first().tap();
      const enGrande = await p.waitForFunction((n) => { const i = document.querySelector('.foto-ampliada'); return i && i.src.length > n * 2 ? i.src.length : false; }, mini, { timeout: 5000 }).then((h) => h.jsonValue()).catch(() => 0);
      check(mini < 16000 && enGrande > 20000, `en la ficha se ve la miniatura (${Math.round(mini / 1024)} kB) y, al tocarla, la foto grande (${Math.round(enGrande / 1024)} kB)`);
      await ctx.close();
    }
    // ---------- 2. Las consultas idénticas se comparten
    {
      const repetidas = (p) => p.evaluate(() => { const c = {}; for (const q of window.__q) if (!q.startsWith('rpc:')) c[q] = (c[q] || 0) + 1; return { total: window.__q.filter((q) => !q.startsWith('rpc:')).length, repetidas: Object.values(c).reduce((s, n) => s + n - 1, 0) }; });
      const { ctx, p } = await abrir(null, {}, { retraso: 120 });
      await p.evaluate(() => { window.__q = []; });
      await entrar(p, /Ana López/);
      await p.locator('.hero-dia').waitFor();
      await p.waitForTimeout(2500);
      const alAbrir = await repetidas(p);
      await cerrarAvisos(p);
      check(alAbrir.total > 30 && alAbrir.repetidas <= 8, `al abrir la app, el atleta ya casi no repite consultas (${alAbrir.total} consultas, ${alAbrir.repetidas} repetidas; antes, 116 y 37)`);
      // Ir y volver deprisa entre pestañas no vuelve a pedir lo que se acaba de pedir
      await p.evaluate(() => { localStorage.removeItem('fbe-demo-retraso'); });
      await irASeccion(p, 'Semana'); await p.waitForTimeout(300);
      await p.evaluate(() => { window.__q = []; });
      await irASeccion(p, 'Hoy'); await p.waitForTimeout(250);
      await irASeccion(p, 'Semana'); await p.waitForTimeout(250);
      await irASeccion(p, 'Hoy'); await p.waitForTimeout(600);
      const idaYVuelta = await repetidas(p);
      check(idaYVuelta.repetidas === 0, `ir y volver deprisa entre dos pestañas no repite ninguna consulta (${idaYVuelta.total} consultas, ${idaYVuelta.repetidas} repetidas)`);
      // Y lo que se cambia se ve: tras marcar algo, se vuelve a leer de verdad
      const abrirHabitos = async () => { await p.locator('details.plegable-hoy[data-plegable="habitos"]').waitFor({ state: 'attached' }); await p.evaluate(() => { document.querySelector('details.plegable-hoy[data-plegable="habitos"]').open = true; }); await p.locator('.habito-tile').first().waitFor(); };
      await abrirHabitos();
      const tesela = p.locator('.habito-tile', { hasText: 'Sin marcar' }).first();
      if (await tesela.count()) {
        const nombre = (await tesela.locator('.habito-nombre').textContent()).trim();
        await tesela.tap();
        await p.locator('[aria-modal="true"] .si-no button', { hasText: 'Hecho' }).tap();
        await p.locator('.toast').filter({ hasText: /hecho/i }).first().waitFor({ timeout: 5000 });
        await irASeccion(p, 'Semana'); await p.waitForTimeout(200);
        await irASeccion(p, 'Hoy');
        await abrirHabitos();
        const sigue = await p.locator('.habito-tile', { hasText: nombre }).first().locator('.anillo-habito.cumple').waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
        check(sigue, 'tras marcar un hábito e ir y volver enseguida, sigue marcado (lo cambiado nunca se lee de una consulta compartida anterior)');
      } else check(false, 'no hay un hábito sin marcar en la demo para probarlo');
      await ctx.close();
    }
    // ---------- 3. Pantallas que no se mueven al cargar
    {
      const quieta = (p) => p.evaluate(() => new Promise((r) => { let h = -1, n = 0; const i = setInterval(() => { const a = document.documentElement.scrollHeight + document.querySelectorAll('.siluetas, .reserva-hueco[data-hueco]').length * 100000; if (a === h) n++; else { h = a; n = 0; } if (n >= 10) { clearInterval(i); r(); } }, 80); }));
      const medir = async (p, accion) => { await p.evaluate(() => { window.__mov = 0; window.__huecos = 0; }); await accion(); await p.waitForTimeout(300); await quieta(p); return p.evaluate(() => ({ px: window.__mov, huecos: window.__huecos, quedan: document.querySelectorAll('.reserva-hueco[data-hueco]').length })); };
      for (const [quien, listo, otras] of [[/Ana López/, '.hero-dia', ['Semana', 'Comidas', 'Progreso']], [/Pelayo/, 'button.tarjeta-atleta:visible', ['Revisar']]]) {
        const { ctx, p } = await abrir(null, {}, { retraso: 200 });
        // La primera vez en este dispositivo no se sabe cuánto ocupa cada cosa: se pasa por las pantallas y se apunta
        const primera = await medir(p, async () => { await entrar(p, quien); await p.locator(listo).first().waitFor(); });
        await p.waitForTimeout(1200); await cerrarAvisos(p);
        for (const s of otras) { await irASeccion(p, s); await quieta(p); }
        const altos = await p.evaluate(() => new Promise((r) => setTimeout(() => r(Object.keys(JSON.parse(localStorage.getItem('fbe-altos') || '{}')).length), 900)));
        check(altos >= (otras.length > 1 ? 8 : 2), `${quien.source}: el dispositivo apunta cuánto ocupa cada bloque que llega tarde (${altos} apuntados; la primera vez se movieron ${primera.px} px)`);
        // Al volver a abrir la app, lo que llega tarde ya tiene su sitio: nada de lo que se ve se mueve
        await p.goto('about:blank'); await p.goto(`${base}/?demo`);
        const dentro = await p.locator('nav.tabs').first().waitFor({ timeout: 2500 }).then(() => true).catch(() => false);
        const segunda = await medir(p, async () => { if (!dentro) { await p.getByRole('button', { name: quien }).first().tap(); await p.locator('nav.tabs').waitFor(); } await p.locator(listo).first().waitFor(); });
        check(segunda.px <= 24 && segunda.huecos > 0 && segunda.quedan === 0, `${quien.source}: al volver a abrir la app, lo que llega tarde ya tiene su sitio guardado y nada se mueve al cargar (${segunda.px} px; antes ${primera.px}; ${segunda.huecos} huecos reservados, ninguno al acabar)`);
        await p.waitForTimeout(1200); await cerrarAvisos(p);
        for (const s of otras) {
          const r = await medir(p, () => irASeccion(p, s));
          check(r.px <= 12 && r.quedan === 0, `${quien.source}: ${s} tampoco se mueve al cargar (${r.px} px)`);
        }
        const hoy = await medir(p, () => irASeccion(p, quien.source.includes('Ana') ? 'Hoy' : 'Atletas'));
        check(hoy.px === 0, `${quien.source}: y al volver a la primera pantalla sale entera al momento (${hoy.px} px)`);
        await ctx.close();
      }
    }

    // ---------- 4. El recetario, ligero
    {
      const { ctx, p } = await abrir(/Ana López/);
      await p.locator('.hero-dia').waitFor();
      await p.waitForTimeout(2500);
      const enHoy = await lecturas(p, '^recetas ');
      check(enHoy === 0 && await lecturas(p, '^recetas_atleta ') > 0, `Hoy ya no baja el recetario: mira qué recetas tienes, sin traerlas (${enHoy} lecturas de recetas)`);
      const aRecetas = async () => {
        await irASeccion(p, 'Comidas');
        const pestana = p.locator('main button', { hasText: 'Tus recetas' }).first();
        await pestana.waitFor();
        if (!(await p.locator('.tarjeta-receta').first().isVisible().catch(() => false))) await pestana.tap();
        await p.locator('.tarjeta-receta').first().waitFor();
      };
      await aRecetas();
      const conFoto = () => p.evaluate(() => [...document.querySelectorAll('.tarjeta-receta img')].filter((i) => i.getAttribute('src')?.startsWith('data:image')).length);
      const fotos1 = await conFoto();
      const minis1 = await lecturas(p, '^recetas .*"cols":"id,foto_mini"');
      check(fotos1 > 0 && minis1 === 1, `la primera vez, Comidas pide las miniaturas una vez y las recetas salen con su foto (${fotos1} con foto)`);
      await irASeccion(p, 'Hoy'); await p.waitForTimeout(2300);
      await p.evaluate(() => { window.__q = []; });
      await aRecetas();
      await p.waitForTimeout(600);
      check(await conFoto() === fotos1 && await lecturas(p, '"cols":"id,foto_mini"') === 0, 'al volver, las fotos de las recetas no se vuelven a bajar y siguen ahí');
      await ctx.close();
    }
    // ---------- 5. Zonas de toque de 44 px
    {
      // De cada cosa pequeña que se pulsa: lo que mide a la vista y la zona en la que responde (con su ampliación invisible)
      const zonas = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && !e.closest('[inert]'); }).map((e) => {
        const r = e.getBoundingClientRect(); let w = r.width, h = r.height;
        for (const ps of ['::after', '::before']) { const c = getComputedStyle(e, ps); if (c.content !== 'none' && c.position === 'absolute') { w = Math.max(w, parseFloat(c.width) || 0); h = Math.max(h, parseFloat(c.height) || 0); } }
        return { w: Math.round(w), h: Math.round(h), rw: Math.round(r.width), rh: Math.round(r.height) };
      }), sel);
      const PEQUENOS = '.btn-peq, .btn-icono, .btn-texto, .casilla-redonda, .pista-cerrar, .selector-chips button, .segmentos button, .tira-chip';
      const { ctx, p } = await abrir(/Lucía Ferrer/);
      await p.locator('.seccion-menu-hoy .casilla-redonda').first().waitFor();
      const hoy = await zonas(p, PEQUENOS);
      const cas = await zonas(p, '.casilla-redonda');
      check(hoy.length >= 8 && hoy.every((z) => z.w >= 44 && z.h >= 44), `en Hoy, todo lo pequeño que se pulsa responde en 44 × 44 px o más (${hoy.length} botones; el menor, ${Math.min(...hoy.map((z) => Math.min(z.w, z.h)))} px)`);
      check(cas.length > 0 && cas.every((z) => z.rw === 26 && z.rh === 26 && z.w >= 44 && z.h >= 44), 'la casilla de «comido» sigue midiendo 26 px a la vista y se pulsa en 44');
      // Y de verdad: un toque 7 px por fuera de la casilla (arriba y a su izquierda) le da a la casilla
      const fuera = await p.evaluate(() => { const e = document.querySelector('.seccion-menu-hoy .casilla-redonda'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect();
        const en = (x, y) => document.elementFromPoint(x, y) === e; return { arriba: en(r.left + r.width / 2, r.top - 7), izquierda: en(r.left - 7, r.top + r.height / 2), derecha: en(r.right + 7, r.top + r.height / 2), lejos: en(r.left + r.width / 2, r.top - 14) }; });
      check(fuera.arriba && fuera.izquierda && fuera.derecha && !fuera.lejos, 'un toque 7 px por fuera de la casilla (arriba, a la izquierda o hacia el texto) la marca; uno a 14 px, no');
      await ctx.close();
      const c = await abrir(/Pelayo/);
      await c.p.locator('button.tarjeta-atleta:visible').first().waitFor();
      const panel = await zonas(c.p, PEQUENOS);
      const chips = await zonas(c.p, '.selector-chips button');
      check(panel.length >= 6 && panel.every((z) => z.w >= 44 && z.h >= 44) && chips.every((z) => z.rh < 44), `en la lista del coach, lo mismo: los filtros miden ${chips[0]?.rh} px de alto y se pulsan en 44 (${panel.length} botones pequeños)`);
      await c.ctx.close();
    }
    // ---------- 6. El botón pulsado enseña que está guardando
    {
      const { ctx, p } = await abrir(/Lucía Ferrer/);
      const abrirPeso = p.locator('.peso-hoy button').first();
      await abrirPeso.waitFor();
      await abrirPeso.scrollIntoViewIfNeeded();
      await abrirPeso.tap();
      const guardar = p.locator('[aria-modal="true"]').getByRole('button', { name: 'Guardar', exact: true });
      await guardar.waitFor();
      await p.waitForTimeout(400);
      const antes = await guardar.evaluate((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
      await p.evaluate(() => { window.__lento = 1500; });
      await guardar.tap();
      await p.waitForTimeout(120);
      const pronto = await guardar.evaluate((b) => ({ marca: b.hasAttribute('data-guardando'), ocupado: b.getAttribute('aria-busy'), desactivado: b.disabled, texto: getComputedStyle(b).webkitTextFillColor }));
      check(pronto.marca && pronto.desactivado && pronto.ocupado === 'true' && !/rgba\(0, 0, 0, 0\)/.test(pronto.texto), 'al pulsar «Guardar», el botón queda marcado como guardando; en el primer cuarto de segundo aún no cambia a la vista');
      await p.waitForTimeout(450);
      const mientras = await guardar.evaluate((b) => { const r = b.getBoundingClientRect(); const c = getComputedStyle(b, '::before'); return { w: Math.round(r.width), h: Math.round(r.height), texto: getComputedStyle(b).webkitTextFillColor, rueda: c.content !== 'none' && parseFloat(c.width) >= 16 && c.animationName.includes('tirar-gira'), opacidad: c.opacity, dice: b.textContent.trim() }; });
      check(mientras.rueda && Number(mientras.opacidad) === 1 && /rgba\(0, 0, 0, 0\)/.test(mientras.texto) && mientras.w === antes.w && mientras.h === antes.h && mientras.dice === 'Guardar',
        `si tarda, el texto deja paso a una rueda que gira y el botón no cambia de tamaño (${antes.w} × ${antes.h} px)`);
      await p.locator('.toast').filter({ hasText: /Peso guardado/ }).first().waitFor({ timeout: 6000 });
      check(await p.locator('button[data-guardando]').count() === 0, 'al guardarse, no queda ninguna rueda');
      // Un botón que se desactiva sin que se esté guardando nada (un «−» en su mínimo, «Enviar» sin texto) no la lleva
      await p.evaluate(() => { window.__lento = 0; });
      const suelto = await p.evaluate(async () => {
        const espera = (ms) => new Promise((r) => setTimeout(r, ms));
        const b = document.createElement('button'); b.textContent = 'Prueba'; document.body.appendChild(b);
        b.click(); b.disabled = true; await espera(60);
        const sinNada = b.hasAttribute('data-guardando');
        window.dispatchEvent(new CustomEvent('fbe-guardando', { detail: 1 })); await espera(30);
        const guardando = b.hasAttribute('data-guardando');
        window.dispatchEvent(new CustomEvent('fbe-guardando', { detail: 0 })); await espera(60);
        const enseguida = b.hasAttribute('data-guardando');   // (entre dos pasos de un guardado no parpadea)
        await espera(250);
        const luego = b.hasAttribute('data-guardando');
        window.dispatchEvent(new CustomEvent('fbe-guardando', { detail: 1 })); await espera(30);
        b.disabled = false; await espera(60);
        const activo = b.hasAttribute('data-guardando');
        window.dispatchEvent(new CustomEvent('fbe-guardando', { detail: 0 }));
        b.remove();
        return { sinNada, guardando, enseguida, luego, activo };
      });
      check(!suelto.sinNada && suelto.guardando && suelto.enseguida && !suelto.luego && !suelto.activo,
        'un botón que se desactiva sin nada guardándose no lleva rueda; con algo guardándose, sí, hasta que acaba o el botón vuelve a estar activo');
      await ctx.close();
    }
    // ---------- 7. Teclado y formularios
    {
      // Un visualViewport de mentira (el de verdad no cambia sin un teclado de verdad): window.__vv.pon(alto) lo encoge
      const conTeclado = (p) => p.addInitScript(() => {
        const vv = new EventTarget(); vv.height = window.innerHeight; vv.offsetTop = 0; vv.scale = 1; vv.width = window.innerWidth;
        vv.pon = (tapa) => { vv.height = window.innerHeight - tapa; vv.dispatchEvent(new Event('resize')); };
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv }); window.__vv = vv;
      });
      const { ctx, p } = await abrir(/Pelayo/, {}, { antes: conTeclado });
      await p.locator('button.tarjeta-atleta:visible').first().waitFor();
      await p.getByRole('button', { name: 'Añadir atleta' }).first().tap();
      const hoja = p.locator('[aria-modal="true"]');
      await hoja.waitFor();
      await p.waitForTimeout(500);
      // La tecla Intro dice lo que hace y pasa de campo en campo; en el último, envía
      await p.locator('#na-nombre').focus();
      const pista1 = await p.locator('#na-nombre').getAttribute('enterkeyhint');
      await p.locator('#na-nombre').fill('Prueba Pulido');
      await p.keyboard.press('Enter');
      const tras1 = await p.evaluate(() => document.activeElement?.id);
      await p.keyboard.press('Enter');
      const tras2 = await p.evaluate(() => document.activeElement?.id);
      await p.keyboard.press('Enter');
      const tras3 = await p.evaluate(() => ({ id: document.activeElement?.id, pista: document.activeElement?.getAttribute('enterkeyhint') }));
      check(pista1 === 'next' && tras1 === 'na-email' && tras2 === 'na-obj' && tras3.id === 'na-notion' && tras3.pista === 'done' && await p.locator('#na-nombre').count() === 1,
        'en el móvil, Intro pasa al campo siguiente (la tecla dice «Siguiente») sin enviar el formulario a medias; en el último dice «Hecho»');
      // Con el teclado abierto, la hoja sube encima de él y el botón de guardar queda a la vista
      const alto = await p.evaluate(() => window.innerHeight);
      const antes = await hoja.evaluate((h) => Math.round(h.getBoundingClientRect().bottom));
      await p.evaluate(() => window.__vv.pon(320));
      await p.waitForTimeout(250);
      const con = await hoja.evaluate((h) => { const r = h.getBoundingClientRect(); const c = document.activeElement.getBoundingClientRect(); return { abajo: Math.round(r.bottom), arriba: Math.round(r.top), campoAbajo: Math.round(c.bottom), campoArriba: Math.round(c.top), v: getComputedStyle(document.documentElement).getPropertyValue('--teclado-hoja').trim() }; });
      check(antes === alto && con.v === '320px' && con.abajo === alto - 320 && con.arriba >= 0 && con.campoAbajo <= alto - 320 && con.campoArriba >= con.arriba,
        `con el teclado abierto (320 px), la hoja queda entera encima de él y el campo en el que se escribe, a la vista (la hoja acaba en ${con.abajo} de ${alto} px)`);
      await p.evaluate(() => window.__vv.pon(0));
      await p.waitForTimeout(250);
      check(await hoja.evaluate((h) => Math.round(h.getBoundingClientRect().bottom)) === alto && await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--teclado-hoja').trim()) === '', 'al cerrarse el teclado, la hoja vuelve a su sitio');
      // En el último campo, Intro envía (como siempre)
      await p.keyboard.press('Enter');
      const creado = await p.locator('[aria-modal="true"]').getByText(/código/i).first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
      check(creado && await p.locator('#na-nombre').count() === 0, 'y en el último campo, Intro envía el formulario');
      await ctx.close();
      // Con teclado de verdad (ordenador), Intro sigue enviando desde cualquier campo
      const o = await abrir(/Pelayo/, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
      await o.p.getByRole('button', { name: 'Añadir atleta' }).first().click();
      await o.p.locator('#na-nombre').fill('Prueba Ordenador');
      await o.p.locator('#na-nombre').press('Enter');
      const enviado = await o.p.locator('[aria-modal="true"]').getByText(/código/i).first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
      check(enviado, 'en el ordenador no cambia nada: Intro envía desde el primer campo');
      const metaPc = await o.p.evaluate(() => document.querySelector('meta[name="viewport"]').content);
      await o.ctx.close();
      // En el iPhone, entrar en un campo pequeño ya no amplía la página (y en Android se puede seguir ampliando con los dedos)
      const i = await abrir(null, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
      const metaIos = await i.p.evaluate(() => document.querySelector('meta[name="viewport"]').content);
      await i.ctx.close();
      const a = await abrir(null, { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' });
      const metaAndroid = await a.p.evaluate(() => document.querySelector('meta[name="viewport"]').content);
      await a.ctx.close();
      check(/maximum-scale=1/.test(metaIos) && !/user-scalable/.test(metaIos) && !/maximum-scale/.test(metaAndroid) && !/maximum-scale/.test(metaPc),
        'en el iPhone, la página ya no se amplía sola al entrar en un campo pequeño (maximum-scale=1, solo en iOS: en Android y en el ordenador no se toca)');
    }
    // ---------- 8. Sin lupa ni menú de copiar en lo que se pulsa
    {
      const sel = (p, lista) => p.evaluate((ss) => Object.fromEntries(ss.map((s) => { const e = [...document.querySelectorAll(s)].find((x) => x.getClientRects().length); return [s, e ? getComputedStyle(e).userSelect || getComputedStyle(e).webkitUserSelect : null]; })), lista);
      const PULSABLE = ['nav.tabs .tab', '.hero-dia .btn-hero', '.cabecera .sub', '.tu-dia .fila-dia', '.plegable-hoy > summary', '.chip'];
      const CONTENIDO = ['.hero-dia .nota-coach', '.aviso-coach p', '.tu-dia .mini'];
      const { ctx, p } = await abrir(/Ana López/);
      await p.locator('.tu-dia').waitFor();
      const pul = await sel(p, PULSABLE);
      const con = await sel(p, CONTENIDO);
      check(Object.values(pul).every((v) => v === 'none'), `en el móvil, lo que se pulsa no se selecciona al dejar el dedo: pestañas, botones, cabecera, filas, chips (${Object.entries(pul).filter(([, v]) => v !== 'none').map(([k, v]) => `${k}: ${v}`).join(', ') || 'todo'})`);
      check(con['.hero-dia .nota-coach'] !== 'none' && con['.aviso-coach p'] !== 'none' && Object.values(con).some((v) => v), `el contenido sí se puede seleccionar y copiar: la nota del coach, sus avisos (${JSON.stringify(con)})`);
      await irASeccion(p, 'Comidas');
      await p.getByRole('tab', { name: 'Tus recetas' }).tap();
      await p.locator('.tarjeta-receta').first().tap();
      await p.locator('[aria-modal="true"]').waitFor();
      const receta = await p.evaluate(() => { const h = document.querySelector('[aria-modal="true"]'); const t = [...h.querySelectorAll('li, p')].find((x) => x.textContent.trim().length > 8 && !x.closest('button')); return t ? getComputedStyle(t).userSelect : null; });
      check(receta && receta !== 'none', 'los ingredientes y los pasos de una receta también');
      await ctx.close();
      const o = await abrir(/Pelayo/, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
      await o.p.locator('tr:visible, button.tarjeta-atleta:visible').first().waitFor();
      const pc = await sel(o.p, ['.cabecera h1', '.chip']);
      check(pc['.cabecera h1'] !== 'none', 'con ratón no cambia nada: los títulos y los chips se siguen pudiendo seleccionar');
      await o.ctx.close();
      // Y en los campos se sigue pudiendo seleccionar siempre
      const c = await abrir(/Pelayo/);
      await c.p.getByRole('button', { name: 'Añadir atleta' }).first().tap();
      await c.p.locator('#na-nombre').waitFor();
      check(await c.p.locator('#na-nombre').evaluate((e) => getComputedStyle(e).userSelect) !== 'none', 'en los campos de escribir se selecciona como siempre');
      await c.ctx.close();
    }
    check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  } catch (e) {
    if (process.env.DEPURAR) console.log(e.stack.split('\n').slice(0, 12).join('\n'));
    check(false, `Pulido 2: ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  }
}

// Suelta
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4178);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Pulido de fluidez, segunda tanda');
  await probarPulido2({ navegador, check, base: 'http://localhost:4178' });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
