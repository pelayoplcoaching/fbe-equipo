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
    if (antes) await antes(p);
    await p.goto(`${base}/?demo`);
    if (quien) await entrar(p, quien);
    return { ctx, p, cdp: await ctx.newCDPSession(p) };
  };
  const entrar = async (p, quien) => {
    await p.getByRole('button', { name: quien }).first().tap();
    await p.locator('nav.tabs').waitFor();
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
      await p.evaluate(() => { window.__q = []; });
      await irASeccion(p, 'Revisar'); await p.waitForTimeout(400);
      await irASeccion(p, 'Mensajes'); await p.waitForTimeout(400);
      await irASeccion(p, 'Atletas'); await p.waitForTimeout(600);
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
