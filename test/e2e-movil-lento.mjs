// (v0.207) «Móvil lento»: lo de cada día con el procesador frenado 4 veces (como un Android de gama media) y la base
// contestando como con un 4G regular (unos 170 ms cada consulta; la demo los espera con «fbe-demo-retraso»). La app ya
// instalada (con el service worker, que es como la abren los atletas): abrirla hasta ver Hoy, empezar la sesión y pasar
// a Progreso. Cada cosa tiene un tiempo máximo: si una versión lo pasa, algo se ha vuelto lento.
//   Suelta:  npm run build && node test/suelta.mjs e2e-movil-lento
// Los tiempos máximos (MAXIMOS, en ms) son unas dos veces y media lo medido en la v0.207 en un ordenador normal: así
// aguantan una máquina cargada (GitHub) y saltan con lo que de verdad se nota, como Revisar pasando de 70 ms a 4,5 s.
import { irASeccion } from './secciones.mjs';

// (v0.207, medido en un ordenador normal: abrir unos 2 s, empezar la sesión unos 3,4 s —con su animación de entrada—, Progreso 1 s)
export const MAXIMOS = { abrir: 5000, sesion: 8500, progreso: 2500 };
const FRENO_CPU = 4, RETRASO_BASE_MS = 170;

export async function probarMovilLento({ navegador, check, base = 'http://localhost:4174' }) {
  const ctx = await navegador.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: 'es-ES' });
  const errores = [];
  try {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    // La app instalada: el service worker guarda la app y la demo
    await p.goto(`${base}/manifest.webmanifest`);
    await p.evaluate(() => { localStorage.setItem('fbe-sw-local', '1'); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().tap();
    await p.locator('.hero-dia').waitFor({ timeout: 30000 });
    const conSw = await p.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 20000 }).then(() => true, () => false);
    // (que se guarde también lo que se carga al abrir cada pantalla, y que la demo tenga su código guardado)
    await p.waitForTimeout(4000);
    const cerrarAvisos = async () => {
      for (let i = 0; i < 6; i++) {
        const d = p.locator('[role=dialog]').last();
        if (!(await d.isVisible().catch(() => false))) break;
        let hecho = false;
        for (const n of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir', 'Luego', 'Vale']) { const b = d.getByRole('button', { name: n, exact: true }).first(); if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; } }
        if (!hecho) await p.keyboard.press('Escape');
        await p.waitForTimeout(300);
      }
    };
    await cerrarAvisos();
    // Ahora, el móvil lento
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: FRENO_CPU });
    await p.evaluate((ms) => { localStorage.setItem('fbe-demo-retraso', String(ms)); }, RETRASO_BASE_MS);
    const medir = async (accion, listo) => { const t0 = Date.now(); await accion(); await listo(); return Date.now() - t0; };
    // 1. Abrir la app (con la sesión ya dentro) hasta ver Hoy
    const abrir = await medir(() => p.reload(), () => p.locator('.hero-dia').waitFor({ timeout: 30000 }));
    await p.waitForTimeout(600);
    await cerrarAvisos();
    // 2. Empezar la sesión (con su portada, si sale) hasta ver su primer ejercicio
    const boton = p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ });
    const hayBoton = await boton.first().isVisible().catch(() => false);
    const sesion = hayBoton ? await medir(async () => {
      await boton.first().tap();
      await p.locator('.portada-sesion, .ejercicio').first().waitFor({ timeout: 30000 });
      if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).tap();
    }, () => p.locator('.ejercicio').first().waitFor({ timeout: 30000 })) : null;
    // (de vuelta a Hoy)
    if (hayBoton) {
      await cerrarAvisos();
      await p.locator('.sesion-vista .cabecera').getByRole('button', { name: 'Volver' }).first().tap().catch(() => {});
      await p.locator('nav.tabs').first().waitFor({ timeout: 15000 }).catch(() => {});
      await cerrarAvisos();
    }
    // 3. Pasar a Progreso hasta ver sus pestañas
    const progreso = await medir(() => irASeccion(p, 'Progreso'), () => p.locator('.pestanas [role=tab]').first().waitFor({ timeout: 30000 }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    check(conSw, 'la app, instalada (con el service worker), como la abren los atletas');
    check(abrir <= MAXIMOS.abrir, `con un móvil lento (procesador ×${FRENO_CPU}, base a ${RETRASO_BASE_MS} ms), la app abre hasta Hoy en ${abrir} ms (como mucho ${MAXIMOS.abrir})`);
    check(sesion != null && sesion <= MAXIMOS.sesion, `empezar la sesión, hasta su primer ejercicio: ${sesion ?? 'sin sesión que empezar'} ms (como mucho ${MAXIMOS.sesion})`);
    check(progreso <= MAXIMOS.progreso, `pasar a Progreso: ${progreso} ms (como mucho ${MAXIMOS.progreso})`);
    check(!errores.length, `sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
  } finally {
    await ctx.close();
  }
}
