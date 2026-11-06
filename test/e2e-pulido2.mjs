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
    await p.getByRole('button', { name: quien }).first().tap();
    await p.locator('nav.tabs').waitFor();
    await cerrarAvisos(p);
  };
  // Los avisos de primera vez (bienvenida, novedades…), fuera
  const cerrarAvisos = async (p) => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const n of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir', 'Empezar', 'Luego']) { const b = d.getByRole('button', { name: n, exact: true }).first(); if (await b.isVisible().catch(() => false)) { await b.tap(); hecho = true; break; } }
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
