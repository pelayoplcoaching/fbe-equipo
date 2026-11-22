// Simula otra fecha y hora en las pruebas, sin parar el reloj: el tiempo sigue corriendo desde la fecha elegida.
// Vale para node (npm test, las pruebas de lógica y la base en memoria) y para el navegador de las pruebas de punta a
// punta (a cada contexto de playwright se le añade el mismo desfase antes de que cargue la página).
//
// Uso (siempre con la zona de Madrid, como en GitHub):
//   TZ=Europe/Madrid FBE_FECHA='2026-11-23T08:00:00+01:00' NODE_OPTIONS="--import $PWD/test/fecha-simulada.mjs" npm test
//   TZ=Europe/Madrid FBE_FECHA='2026-12-31T23:40:00+01:00' NODE_OPTIONS="--import $PWD/test/fecha-simulada.mjs" npm run e2e
// o con el atajo: node test/por-fechas.mjs (pasa npm test por una lista de fechas y resume qué falla en cada una).
//
// Sin FBE_FECHA no hace nada.

function instalarFecha(desfase) {
  const g = globalThis;
  if (g.__fbeFechaSimulada != null) return;
  const Real = g.Date;
  // (si la prueba pone su propio reloj de Playwright, clock.install o setFixedTime, manda el suyo: ver abajo)
  const ahora = () => Real.now() + (g.__fbeSinFechaSimulada ? 0 : desfase);
  function Date(...a) {
    if (!new.target) return new Real(ahora()).toString();
    return a.length ? new Real(...a) : new Real(ahora());
  }
  Date.prototype = Real.prototype;
  Date.now = ahora;
  Date.parse = Real.parse;
  Date.UTC = Real.UTC;
  g.Date = Date;
  // Intl.DateTimeFormat#format() y formatToParts() sin fecha usan el reloj de verdad: se les da la simulada.
  const DTF = g.Intl && g.Intl.DateTimeFormat;
  if (DTF) {
    const desc = Object.getOwnPropertyDescriptor(DTF.prototype, 'format');
    if (desc && desc.get) {
      Object.defineProperty(DTF.prototype, 'format', {
        configurable: true,
        get() { const f = desc.get.call(this); return (d) => f(d === undefined ? ahora() : d); },
      });
    }
    const partes = DTF.prototype.formatToParts;
    DTF.prototype.formatToParts = function (d) { return partes.call(this, d === undefined ? ahora() : d); };
  }
  g.__fbeFechaSimulada = desfase;
}

const objetivo = process.env.FBE_FECHA;
if (objetivo) {
  const t = Date.parse(objetivo);
  if (Number.isNaN(t)) throw new Error(`FBE_FECHA no es una fecha: «${objetivo}»`);
  const desfase = t - Date.now();
  instalarFecha(desfase);
  const guion = `(${instalarFecha.toString()})(${desfase});`;
  let pw = null;
  try { pw = await import('playwright'); } catch { /* las pruebas sin navegador no lo necesitan */ }
  // Las pruebas que ponen su propio reloj de Playwright (ctx.clock.install / setFixedTime / setSystemTime: radar, comunidad
  // 073, belleza 200) quieren esa hora exacta: en ese contexto la fecha simulada no se pone (o, si ya había páginas, se
  // aparta) y manda el reloj de la prueba. Por eso el desfase se añade al abrir la primera página, no al crear el contexto.
  const conFecha = (ctx) => {
    let reloj = false, puesta = false;
    if (ctx.clock) {
      for (const m of ['install', 'setFixedTime', 'setSystemTime']) {
        const orig = ctx.clock[m]?.bind(ctx.clock);
        if (!orig) continue;
        ctx.clock[m] = async (...a) => {
          reloj = true;
          if (puesta) {
            await ctx.addInitScript(() => { globalThis.__fbeSinFechaSimulada = true; });
            for (const pg of ctx.pages()) await pg.evaluate(() => { globalThis.__fbeSinFechaSimulada = true; }).catch(() => {});
          }
          return orig(...a);
        };
      }
    }
    const nueva = ctx.newPage.bind(ctx);
    ctx.newPage = async (...a) => {
      if (!reloj && !puesta) { puesta = true; await ctx.addInitScript(guion); }
      return nueva(...a);
    };
    return ctx;
  };
  const envolver = (navegador) => {
    const contexto = navegador.newContext.bind(navegador);
    navegador.newContext = async (...a) => conFecha(await contexto(...a));
    // (browser.newPage crea su contexto con newContext y su página con newPage: ya pasa por lo de arriba)
    return navegador;
  };
  for (const tipo of [pw?.chromium, pw?.firefox, pw?.webkit].filter(Boolean)) {
    const lanzar = tipo.launch.bind(tipo);
    tipo.launch = async (...a) => envolver(await lanzar(...a));
    if (tipo.launchPersistentContext) {
      const persistente = tipo.launchPersistentContext.bind(tipo);
      tipo.launchPersistentContext = async (...a) => { const c = await persistente(...a); await c.addInitScript(guion); return c; };
    }
  }
}
