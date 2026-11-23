// Móvil lento (v0.211): lo de cada día con el procesador frenado (4× de serie, como un Android de gama media) y la base
// como un 4G regular, midiendo lo que se nota: cuánto tarda cada toque en verse (la «respuesta al toque», como INP),
// los bloqueos (ratos de más de 50 ms sin responder) y cuánto tarda en salir cada pantalla. No falla: deja una tabla.
//   npm run build && node scripts/lento.mjs [--freno=4] [--quien=atleta,coach] [--perfil] [--dist=dist] [--salida=/tmp/lento]
// --perfil: guarda además el perfil de CPU de cada paso (abrir en Chrome → Rendimiento) y las funciones que más tiempo se
// llevan (con una construcción legible, scripts/build-legible, se ven sus nombres).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { servir } from '../test/servidor.mjs';

const arg = (k, def) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : def; };
const FRENO = Number(arg('freno', '4'));
const DIST = resolve(arg('dist', 'dist'));
const SALIDA = resolve(arg('salida', '/tmp/lento'));
const PUERTO = Number(arg('puerto', '4420'));
const conPerfil = process.argv.includes('--perfil');
const quienes = arg('quien', 'atleta,coach').split(',');
mkdirSync(SALIDA, { recursive: true });

const srv = await servir(DIST, PUERTO);
const base = `http://localhost:${PUERTO}`;
const nav = await chromium.launch();
const filas = [];

async function sesion(nombre, movil) {
  const ctx = await nav.newContext(movil ? { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' }
    : { viewport: { width: 1280, height: 860 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* */ }
    window.__ev = []; window.__lt = [];
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ n: e.name, d: e.duration, t: e.startTime }); }).observe({ type: 'event', durationThreshold: 16, buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ d: e.duration, t: e.startTime }); }).observe({ type: 'longtask', buffered: true });
    } catch { /* */ }
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`${base}/?demo`);
  await p.getByRole('button', { name: nombre }).first().click();
  const cod = p.getByLabel('Código', { exact: true });
  await Promise.race([cod.waitFor({ timeout: 6000 }).catch(() => {}), p.locator('nav.tabs').waitFor({ timeout: 20000 })]);
  if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
  await p.locator('nav.tabs').waitFor({ timeout: 20000 });
  await p.waitForTimeout(2500);
  await cerrar(p);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: FRENO });
  await p.evaluate(() => { localStorage.setItem('fbe-demo-retraso', '170'); });
  if (conPerfil) await cdp.send('Profiler.enable');
  return { ctx, p, cdp, errores };
}
async function cerrar(p) {
  for (let i = 0; i < 5; i++) {
    if (!(await p.locator('[aria-modal="true"]').count())) break;
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  }
}

// Un paso: lo que se hace y cuándo está listo. Apunta lo que tardó, el peor toque y los bloqueos de mientras
async function paso(s, quien, nombre, hacer, listo) {
  const { p, cdp } = s;
  await p.evaluate(() => { window.__ev.length = 0; window.__lt.length = 0; });
  if (conPerfil) await cdp.send('Profiler.start');
  const t0 = Date.now();
  let ok = true;
  try { await hacer(); if (listo) await listo(); } catch (e) { ok = false; s.errores.push(`${nombre}: ${e.message.slice(0, 120)}`); }
  const ms = Date.now() - t0;
  await p.waitForTimeout(700);
  const { ev, lt } = await p.evaluate(() => ({ ev: window.__ev.slice(), lt: window.__lt.slice() }));
  const peor = ev.reduce((m, e) => Math.max(m, e.d), 0);
  const bloqueo = lt.reduce((t, e) => t + Math.max(0, e.d - 50), 0);
  const largo = lt.reduce((m, e) => Math.max(m, e.d), 0);
  filas.push({ quien, paso: nombre, ok, ms, peorToque: Math.round(peor), bloqueo: Math.round(bloqueo), bloqueoMasLargo: Math.round(largo) });
  if (conPerfil) {
    const { profile } = await cdp.send('Profiler.stop');
    const fich = `${quien}-${nombre}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    writeFileSync(join(SALIDA, `${fich}.cpuprofile`), JSON.stringify(profile));
    // Las funciones con más tiempo propio
    const porNodo = new Map(profile.nodes.map((n) => [n.id, n]));
    const propio = new Map();
    const dt = profile.timeDeltas || [];
    profile.samples.forEach((id, i) => { const n = porNodo.get(id); const k = `${n.callFrame.functionName || '(anónima)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; propio.set(k, (propio.get(k) || 0) + (dt[i] || 0)); });
    const top = [...propio.entries()].filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${(v / 1000).toFixed(0)} ms ${k}`);
    filas[filas.length - 1].top = top;
  }
}

if (quienes.includes('atleta')) {
  const s = await sesion(/Ana López/, true);
  const { p } = s;
  const tab = (n) => p.locator('nav.tabs .tab', { hasText: n }).first();
  await paso(s, 'atleta', 'abrir (recargar hasta Hoy)', () => p.reload(), () => p.locator('.hero-dia').waitFor({ timeout: 30000 }));
  await p.waitForTimeout(1500); await cerrar(p);
  await paso(s, 'atleta', 'Hoy → Semana', () => tab('Semana').tap(), () => p.locator('main.vista').waitFor());
  await paso(s, 'atleta', 'Semana → Progreso', () => tab('Progreso').tap(), () => p.locator('main.vista').waitFor());
  await paso(s, 'atleta', 'desplazar Progreso', async () => { for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 500); await p.waitForTimeout(120); } });
  await paso(s, 'atleta', 'Progreso → Mensajes', () => tab('Mensajes').tap(), () => p.locator('.chat-lista, main.vista').first().waitFor());
  await paso(s, 'atleta', 'escribir en el chat', async () => { const t = p.locator('.chat-barra textarea').first(); if (await t.count()) { await t.tap(); await t.type('Hola, ¿qué tal? Ayer me costó la sentadilla', { delay: 30 }); } });
  await paso(s, 'atleta', 'Mensajes → Hoy', () => tab('Hoy').tap(), () => p.locator('.hero-dia').waitFor());
  await cerrar(p);
  const empezar = p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).first();
  if (await empezar.isVisible().catch(() => false)) {
    await paso(s, 'atleta', 'abrir la sesión (portada)', () => empezar.tap(), () => p.locator('.portada-sesion, .ejercicio').first().waitFor({ timeout: 30000 }));
    if (await p.locator('.portada-sesion').count()) await paso(s, 'atleta', 'Empezar (hasta el primer ejercicio)', () => p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).tap(), () => p.locator('.ejercicio').first().waitFor({ timeout: 30000 }));
    await cerrar(p);
    const marcar = p.locator('.ejercicio button.marcar, .ejercicio .serie button[aria-label*="Hecha"], .ejercicio button[aria-label^="Marcar"]').first();
    if (await marcar.count()) await paso(s, 'atleta', 'marcar una serie', () => marcar.tap());
    await cerrar(p);
    await paso(s, 'atleta', 'volver a Hoy', () => p.locator('.sesion-vista .cabecera').getByRole('button', { name: 'Volver' }).first().tap(), () => p.locator('.hero-dia').waitFor({ timeout: 30000 }));
  }
  await cerrar(p);
  const masBtn = p.locator('nav.tabs .tab-mas, nav.tabs button', { hasText: 'Más' }).first();
  if (await masBtn.count()) {
    await paso(s, 'atleta', 'abrir «Más»', () => masBtn.tap(), () => p.locator('[aria-modal="true"]').first().waitFor());
    await paso(s, 'atleta', 'cerrar «Más»', () => p.keyboard.press('Escape'), () => p.locator('[aria-modal="true"]').waitFor({ state: 'detached', timeout: 5000 }));
  }
  if (s.errores.length) filas.push({ quien: 'atleta', paso: 'errores', ok: false, ms: 0, detalle: s.errores.slice(0, 5) });
  await s.ctx.close();
}

if (quienes.includes('coach')) {
  const s = await sesion(/Pelayo/, false);
  const { p } = s;
  const tab = (n) => p.locator('nav.tabs .tab', { hasText: n }).first();
  await paso(s, 'coach', 'abrir (recargar hasta Atletas)', () => p.reload(), () => p.locator('[data-atleta]').first().waitFor({ timeout: 30000 }));
  await p.waitForTimeout(1500); await cerrar(p);
  await paso(s, 'coach', 'abrir la ficha de un atleta', () => p.locator('[data-atleta]').first().click(), () => p.locator('[role="tab"]').first().waitFor({ timeout: 30000 }));
  for (const t of ['Programa', 'Seguimiento', 'Nutrición', 'Datos']) {
    const b = p.getByRole('tab', { name: new RegExp(t) }).first();
    if (await b.count()) await paso(s, 'coach', `ficha → ${t}`, () => b.click());
  }
  await cerrar(p);
  for (const t of ['Revisar', 'Revisión semanal', 'A quién escribir', 'Mensajes', 'Equipo', 'Plantillas', 'Biblioteca', 'Atletas']) {
    const b = tab(t);
    if (await b.count()) await paso(s, 'coach', `→ ${t}`, () => b.click(), () => p.locator('main').first().waitFor());
    await cerrar(p);
  }
  if (s.errores.length) filas.push({ quien: 'coach', paso: 'errores', ok: false, ms: 0, detalle: s.errores.slice(0, 5) });
  await s.ctx.close();
}
await nav.close(); srv.close?.();

const lineas = [`# Móvil lento (freno ${FRENO}×, base a 170 ms)`, '', '| quién | paso | listo en | peor toque | bloqueo total | bloqueo más largo |', '|---|---|---|---|---|---|'];
for (const f of filas) lineas.push(`| ${f.quien} | ${f.paso}${f.ok === false ? ' ⚠' : ''} | ${f.ms} ms | ${f.peorToque ?? ''} ms | ${f.bloqueo ?? ''} ms | ${f.bloqueoMasLargo ?? ''} ms |`);
for (const f of filas.filter((x) => x.top)) lineas.push('', `## ${f.quien}: ${f.paso}`, ...f.top.map((x) => `- ${x}`));
for (const f of filas.filter((x) => x.detalle)) lineas.push('', `## ${f.quien}: errores`, ...f.detalle.map((x) => `- ${x}`));
writeFileSync(join(SALIDA, 'lento.md'), lineas.join('\n'));
writeFileSync(join(SALIDA, 'lento.json'), JSON.stringify(filas, null, 1));
console.log(lineas.slice(0, filas.length + 4).join('\n'));
process.exit(0);
