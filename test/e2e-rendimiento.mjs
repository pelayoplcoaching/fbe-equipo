// Cómo va la app en cada dispositivo (pulido 4), en la demo y en un móvil simulado: la app mide sola mientras se usa,
// lo guarda en el dispositivo, lo manda resumido y el coach lo ve en Cuenta → Cómo va la app, sin nombres.
//   Suelta:  npm run build && node test/e2e-rendimiento.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarRendimiento } = await import('./e2e-rendimiento.mjs'); await probarRendimiento({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarRendimiento({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: 'es-ES' });
  try {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Sin conexi/.test(m.text())) errores.push(`${m.text()} ${m.location()?.url || ''}`); });
    await p.addInitScript(() => {
      window.__rpc = [];
      let b0;
      Object.defineProperty(globalThis, '__fbeDemo', { configurable: true, get() { return b0; }, set(b) { b0 = b; const f = b.rpc.bind(b); b.rpc = (n, ...a) => { window.__rpc.push(n); return f(n, ...a); }; } });
    });
    const cerrarAvisos = async () => {
      await p.waitForTimeout(350);
      for (let i = 0; i < 6; i++) {
        const d = p.locator('[role=dialog]').last();
        if (!(await d.isVisible().catch(() => false))) break;
        let hecho = false;
        for (const n of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir', 'Empezar', 'Luego']) { const b = d.getByRole('button', { name: n, exact: true }).first(); if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; } }
        if (!hecho) await p.keyboard.press('Escape');
        await p.waitForTimeout(350);
      }
    };
    const medido = () => p.evaluate(() => JSON.parse(localStorage.getItem('fbe-rend-v1') || 'null'));

    // ---------- Un atleta usa la app: se mide sola
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia').waitFor();
    await cerrarAvisos();
    await p.waitForTimeout(5600);
    const alEntrar = await medido();
    // Abrir la app con la sesión ya dentro (lo de cada día): eso sí es «lo que tarda en abrir»
    await p.reload();
    await p.locator('.hero-dia').waitFor();
    await cerrarAvisos();
    await irASeccion(p, 'Semana');
    await p.locator('.semana-vista').first().waitFor();
    await p.waitForTimeout(400);
    await irASeccion(p, 'Progreso');
    await p.locator('.pestanas [role=tab]').first().waitFor();
    await p.waitForTimeout(400);
    await irASeccion(p, 'Hoy');
    await p.locator('.hero-dia').waitFor();
    await p.waitForTimeout(5600);   // (lo medido se escribe en el dispositivo cada cinco segundos)
    const m = await medido();
    const d = m?.datos || {};
    check(!!m && /^\d{4}-\d{2}-\d{2}$/.test(m.dia) && d.arranque?.n === 1 && d.consulta?.n > 20 && d['pantalla:semana']?.n === 1 && d['pantalla:progreso']?.n === 1 && d['pantalla:hoy']?.n === 1,
      `mientras se usa, la app mide sola: el arranque, cada pantalla que se abre y cada consulta a la base (${Object.entries(d).map(([k, v]) => `${k} ${v.n}`).join(', ')})`);
    check(!alEntrar?.datos?.arranque && (d.arranque?.max || 0) < 20000, 'entrar eligiendo cuenta (o escribiendo la contraseña) no cuenta como «abrir la app»; abrirla con la sesión dentro, sí');
    const texto = JSON.stringify(m || {});
    check(!/Ana|López|fbe\.demo|Mozilla|Torso/.test(texto) && Object.keys(m || {}).sort().join() === 'datos,dia,quien,sucio', 'lo guardado en el dispositivo son solo recuentos de tiempos: ni nombres ni nada de lo que se hace');
    check((await p.evaluate(() => window.__rpc.filter((n) => /^rendimiento_/.test(n)).length)) === 0, 'en la demo no se manda nada solo');
    // Se manda (en la app de verdad, cada diez minutos y al dejarla)
    const mandado = await p.evaluate(() => globalThis.__fbeRendimiento({ forzar: true }));
    const otra = await p.evaluate(() => globalThis.__fbeRendimiento());
    check(mandado === true && otra === false && (await medido()).sucio === false, 'al mandarlo queda apuntado como enviado, y sin nada nuevo no se vuelve a mandar');

    // ---------- El coach lo ve en Cuenta, sin nombres
    await p.getByRole('button', { name: 'Cambiar de cuenta' }).first().click();
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarAvisos();
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await cerrarAvisos();
    await irASeccion(p, 'Cuenta');
    const seccion = p.locator('section.seccion', { has: p.getByRole('heading', { name: 'Cómo va la app' }) });
    await seccion.getByText(/2 dispositivos en los últimos 14 días/).waitFor({ timeout: 10000 });
    const corto = await seccion.innerText();
    check(/Abrir la app/.test(corto) && /Abrir Hoy/.test(corto) && /Cada consulta a la base/.test(corto) && /normal/.test(corto) && /lento/.test(corto) && !/Ana|López/.test(corto),
      'el coach ve en Cuenta → Cómo va la app cuánto tarda abrir, cada pantalla y cada consulta (lo normal y lo lento), sin nombres');
    // Lo medido con la cuenta de Ana en este mismo dispositivo no se le apunta a la del coach
    const filas = await p.evaluate(() => globalThis.__fbeDemo.rpc('rendimiento_resumen', { p_dias: 14 }));
    const delCoach = filas.find((x) => x.rol === 'coach'), deAtleta = filas.find((x) => x.rol === 'atleta');
    check(filas.length === 2 && !!deAtleta?.datos['pantalla:progreso'] && !!delCoach && !delCoach.datos['pantalla:progreso'] && !delCoach.datos['pantalla:semana'] && !!delCoach.datos.consulta,
      'al cambiar de cuenta en el mismo dispositivo, lo medido con la anterior no se le apunta a la nueva');
    await seccion.getByRole('button', { name: 'Ver todo' }).click();
    await seccion.getByText('Los que más tardan en abrir').waitFor();
    const largo = await seccion.innerText();
    check(/ATLETAS|Atletas/.test(largo) && /TU CUENTA|Tu cuenta/.test(largo) && /Abrir Semana/.test(largo) && /Abrir Progreso/.test(largo) && (await seccion.getByRole('button', { name: /Copiar para Claude/ }).count()) === 1 && !/Ana|López/.test(largo),
      'al desplegarlo: atletas y coach por separado, todas las pantallas, los dispositivos que más tardan en abrir (sin decir de quién son) y «Copiar para Claude»');
    // Borrar: pide confirmación; después solo queda lo de este dispositivo, que se vuelve a mandar al mirar
    await seccion.getByRole('button', { name: 'Borrar las medidas' }).click();
    await seccion.getByRole('button', { name: 'Sí, borrar todas' }).click();
    await seccion.getByText(/1 dispositivo en los últimos 14 días/).waitFor({ timeout: 10000 });
    check(true, 'borrar las medidas pide confirmación y las borra todas (queda la de este dispositivo, que se manda al mirar)');
    check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  } catch (e) {
    if (process.env.DEPURAR) console.log(e.stack.split('\n').slice(0, 14).join('\n'));
    check(false, `Rendimiento: ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  } finally {
    await ctx.close();
  }
}

// Suelta
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4176);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('Cómo va la app en cada dispositivo');
  await probarRendimiento({ navegador, check, base: 'http://localhost:4176' });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
