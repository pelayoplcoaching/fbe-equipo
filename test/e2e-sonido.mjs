// El sonido de la app (claude/sonido-mejoras.md), en la demo y en un móvil simulado: los perfiles, «Escuchar todos» y el
// volumen de cada apartado en Sonido y vibración; en la sesión, las series que suben, +15, la cuenta atrás que sube y «¿Cuánto
// queda?»; y, el coach, «Tus frases, con tu voz» en su Cuenta. Lo que suena se mira por el evento «fbe-sonido» (en las pruebas
// no hay altavoz). Las notas y los ajustes, en test/sonido.test.mjs; las frases del coach en la base, en test/sonido-base.test.mjs.
//   Suelta:  npm run build && node test/e2e-sonido.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarSonido } = await import('./e2e-sonido.mjs'); await probarSonido({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarSonido({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  await p.addInitScript(() => {
    window.__son = []; window.addEventListener('fbe-sonido', (e) => window.__son.push(e.detail?.tipo));
    // (la voz del móvil: lo que diría)
    window.__dicho = [];
    try {
      const falsa = { speak: (u) => window.__dicho.push(u.text), cancel() {}, getVoices: () => [], speaking: false, pending: false, addEventListener() {} };
      Object.defineProperty(window, 'speechSynthesis', { value: falsa, configurable: true });
      if (typeof window.SpeechSynthesisUtterance !== 'function') window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    } catch { /* */ }
  });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const son = () => p.evaluate(() => window.__son.slice());
  const seg = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Ana López/ }).first().click();
    await p.locator('.hero-dia .btn-hero').waitFor();
    await fueraAvisos();
    // --- Sonido y vibración: los perfiles, «Escuchar todos» y cada apartado ---
    await irASeccion(p, 'Perfil');
    await p.getByRole('button', { name: /^Sonido y vibración/ }).click();
    const hoja = p.getByRole('dialog', { name: 'Sonido y vibración' });
    const perfiles = hoja.getByRole('group', { name: 'Cuánto suena la app' });
    await perfiles.waitFor();
    check(await perfiles.getByRole('button', { name: 'Equilibrado' }).getAttribute('aria-pressed') === 'true', 'de serie, el perfil «Equilibrado»');
    await perfiles.getByRole('button', { name: 'Todo' }).click();
    const aj = () => p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes') || '{}'));
    const a1 = await aj();
    check(a1.sonidosInterfaz === true && a1.avisoMitad === true && await hoja.getByRole('switch', { name: /Sonidos de la interfaz/ }).isChecked(), '«Todo» enciende también la interfaz y el aviso de la mitad');
    await hoja.getByRole('switch', { name: /Sonidos de la interfaz/ }).click();
    check(await perfiles.locator('[aria-pressed="true"]').count() === 0 && /A tu manera/.test(await hoja.locator('.aj-perfil-sonido').textContent()), 'tocar uno a uno es «a tu manera»');
    check(await hoja.locator('.aj-apartado input[type=range]').count() === 4 && await hoja.getByLabel('Volumen').count() === 1, 'el volumen general y el de cada apartado (entreno, juego, chat, logros y comunidad)');
    await hoja.locator('#aj-vol-chat').fill('0.3');
    check((await aj()).volumenes?.chat === 0.3, 'el volumen de un apartado se guarda');
    await p.evaluate(() => { window.__son = []; });
    await hoja.getByRole('button', { name: 'Escuchar todos' }).click();
    await hoja.getByRole('status').filter({ hasText: 'Suena:' }).waitFor({ timeout: 3000 });
    await p.waitForTimeout(2100);
    const oidos = await son();
    check(oidos.length >= 3 && oidos[0] === 'serie', `«Escuchar todos» toca la familia en orden (${oidos.slice(0, 4).join(', ')}…)`);
    await hoja.getByRole('button', { name: 'Parar' }).click();
    const queSuena = hoja.getByLabel('Qué suena');
    check((await queSuena.locator('option').allTextContents()).some((t) => /FBE/.test(t)), 'el aviso de fin de descanso «FBE» se puede elegir');
    await p.keyboard.press('Escape');
    await hoja.waitFor({ state: 'detached' });

    // --- En la sesión: las series, +15, la cuenta atrás y «¿Cuánto queda?» ---
    await irASeccion(p, 'Hoy');
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    const prep = p.locator('.preparacion');
    if (await prep.count()) await prep.getByRole('button', { name: 'Ahora no' }).click();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    await p.evaluate(() => { window.__son = []; });
    const primero = p.locator('.ejercicio').first();
    await primero.getByLabel('Kilos de la serie 1').fill('30');
    await primero.getByLabel('Repeticiones de la serie 1').fill('8');
    await p.keyboard.press('Escape');
    await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    const reloj = p.locator('.temporizador');
    await reloj.waitFor();
    check((await son()).includes('serie'), 'marcar una serie suena (la familia: «serie»)');
    await reloj.getByRole('button', { name: 'Añadir 15 segundos' }).click();
    check((await son()).includes('mas-15'), '+15 suena (sube)');
    // «¿Cuánto queda?»: dos toques seguidos en el reloj
    const cuenta = reloj.locator('.reloj-descanso .cuenta');
    await cuenta.click(); await p.waitForTimeout(120); await cuenta.click();
    await p.waitForTimeout(200);
    const dicho = await p.evaluate(() => window.__dicho.slice());
    check(dicho.some((t) => /^Queda/.test(t)), `dos toques en el reloj dicen cuánto queda («${dicho.at(-1) || 'nada'}»)`);
    // La cuenta atrás que sube: con el descanso a 20 s o menos
    await reloj.getByRole('button', { name: 'Quitar 1 minuto' }).click().catch(() => {});
    for (let i = 0; i < 16 && seg(await reloj.locator('.cuenta').textContent()) > 20; i++) await reloj.getByRole('button', { name: 'Quitar 15 segundos' }).click();
    await p.evaluate(() => { window.__son = []; });
    await reloj.locator('.temporizador-etq', { hasText: 'Descanso terminado' }).waitFor({ timeout: 30000 });
    const final = await son();
    check(final.filter((x) => x === 'cuenta').length >= 3, `la cuenta atrás suena en los últimos segundos (${final.filter((x) => x === 'cuenta').length} notas)`);
    await reloj.getByRole('button', { name: 'Cerrar' }).click().catch(() => {});

    // --- El coach: sus frases, con su voz ---
    await p.waitForTimeout(400);
    await p.evaluate(() => { localStorage.removeItem('fbe-demo-v2-sesion'); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await fueraAvisos();
    await irASeccion(p, 'Cuenta');
    const voces = p.locator('.voces-coach');
    await voces.waitFor();
    check(await voces.locator('.voz-frase').count() === 10 && /«¡Vamos!»/.test(await voces.textContent()) && /«Última serie»/.test(await voces.textContent()) && /«Último ejercicio»/.test(await voces.textContent()), 'en su Cuenta, el coach tiene «Tus frases, con tu voz»: diez para grabar (con las cuatro de la 065)');
  } catch (e) {
    check(false, `El sonido: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
  check(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 5).join(' ## ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  console.log('\nEl sonido de la app');
  try { await probarSonido({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
