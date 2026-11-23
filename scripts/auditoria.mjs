// Auditoría de pantallas (v0.210). Un robot recorre la demo como atleta y como coach, pestaña a pestaña, toca lo que abre
// hojas o pantallas (una o dos capas) y apunta lo que va mal: errores de consola o sin recoger, fallos de accesibilidad
// (axe), la página o un texto que se salen o se cortan, botones pequeños, imágenes rotas y bloqueos largos.
// No es una prueba que falle: deja un informe (informe.md e informe.json) para arreglar lo que salga.
//   npm run build
//   node scripts/auditoria.mjs [--conf=movil,oscuro-estrecho,letra,ordenador,contraste,sinred] [--quien=atleta,coach]
//                              [--atletas=Ana López,Carlos Vera] [--hondo] [--salida=/tmp/auditoria] [--dist=dist] [--puerto=4410]
//                              [--raros] [--capturas=/tmp/cap-210] [--sin-axe]
// --hondo: también explora dentro de cada hoja (una capa más). Sin él, solo abre y revisa.
// --capturas: guarda una captura de cada estado (con el mismo nombre en cada pasada: para comparar dos construcciones con
//   compara.mjs, como los estilos repartidos de la v0.210).
// --raros: con la demo llevada al extremo (scripts/datos-raros.mjs): dos años de Ana, un chat de 1.500 mensajes, 60 atletas,
//   nombres larguísimos y un atleta sin nada. Mejor con --atletas="Ana López,Rubén Martín,Iván Prieto".
// Lo que toca no envía, borra, graba, sube ni comparte nada (lista NO_TOCAR); la demo guarda sus datos en el propio
// navegador, así que lo que marque (una serie, un hábito) se queda en esa pasada.
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { servir } from '../test/servidor.mjs';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { rarificar } from './datos-raros.mjs';

const arg = (k, def) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : def; };
const hondo = process.argv.includes('--hondo');
const sinAxe = process.argv.includes('--sin-axe');
const RAROS = process.argv.includes('--raros') ? (() => { const db = semillaDemo(); console.log('datos raros:', rarificar(db, { hoy: new Date().toISOString().slice(0, 10) })); return JSON.stringify(db); })() : null;
const SALIDA = resolve(arg('salida', '/tmp/auditoria'));
const DIST = resolve(arg('dist', 'dist'));
const PUERTO = Number(arg('puerto', '4410'));
const CAPTURAS = arg('capturas', null) ? resolve(arg('capturas')) : null;
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });
const nombresCaptura = new Map();
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
mkdirSync(SALIDA, { recursive: true });

const CONFS = {
  movil: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' },
  'oscuro-estrecho': { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, colorScheme: 'dark' },
  letra: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light', ajustes: { letra: 'muy-grande' } },
  ordenador: { viewport: { width: 1280, height: 860 }, colorScheme: 'light' },
  contraste: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark', ajustes: { altoContraste: true } },
  // (sin conexión desde que entra: la demo hace como el de verdad con «fbe-demo-sin-red»)
  sinred: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light', sinRed: true },
};
const confs = arg('conf', 'movil').split(',').filter((c) => CONFS[c]);
const quienes = arg('quien', 'atleta,coach').split(',');
const atletas = arg('atletas', 'Ana López').split(',').map((x) => x.trim()).filter(Boolean);

const PESTANAS = {
  atleta: ['hoy', 'semana', 'progreso', 'mensajes', 'comidas', 'recetas', 'aprende', 'checkin', 'equipo', 'perfil'],
  coach: ['atletas', 'revisar', 'revision', 'radar', 'mensajes', 'equipo', 'plantillas', 'biblioteca', 'cuenta'],
};
// Lo que no se toca: lo que escribe fuera, borra, sale, pide permisos o abre otra app
const NO_TOCAR = /borrar|eliminar|quitar|salir|cerrar sesi|dar de baja|baja\b|cancelar la|enviar|publicar|grabar|c[aá]mara|subir|descargar|exportar|compartir|instalar|copiar|llamar|whatsapp|activar las notificaciones|permitir|micr[oó]fono|probar el sonido|reiniciar|restablecer|empezar de cero|vaciar|olvidar|modo atleta|entrar como|cambiar de cuenta|archivar|terminar hoy|pausar la asesor|nuevo c[oó]digo|reenviar|programar el mensaje|enviarlo/i;
// Lo que solo cierra o vuelve (no abre nada nuevo)
const SOLO_CIERRA = /^(cerrar|volver|atr[aá]s|hecho|vale|entendido|ahora no|cancelar|listo|ok|no, gracias|seguir|continuar)$/i;

const informe = [];   // { conf, quien, donde, tipo, detalle }
const apuntar = (ctx, tipo, detalle) => { informe.push({ ...ctx, tipo, detalle }); };

// Lo que se revisa en cada estado (dentro de la página)
function revisarEnPagina() {
  const out = { desborde: null, cortados: [], fuera: [], pequenos: [], rotas: [], raros: [] };
  const vw = innerWidth;
  const sw = document.documentElement.scrollWidth;
  if (sw > vw + 1) out.desborde = `${sw} px de ancho en una pantalla de ${vw}`;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && !el.closest('[aria-hidden="true"], [inert], .sr');
  };
  const desc = (el) => {
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48);
    const c = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${c ? `.${c}` : ''} «${t}»`;
  };
  const desplazable = (el) => { for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1) return true; } return false; };
  const conTexto = [...document.querySelectorAll('body *')].filter((el) => !['SCRIPT', 'STYLE', 'svg', 'SVG', 'OPTION', 'TEXTAREA'].includes(el.tagName)
    && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) && visible(el));
  const vistos = new Set();
  for (const el of conTexto) {
    const cs = getComputedStyle(el);
    if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none' && cs.webkitLineClamp) continue;
    const r = el.getBoundingClientRect();
    if (/(hidden|clip)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) { out.cortados.push(desc(el)); continue; }
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ca = getComputedStyle(a);
      if (/(auto|scroll)/.test(ca.overflowX)) break;
      if (/(hidden|clip)/.test(ca.overflowX) && ca.textOverflow !== 'ellipsis') {
        const ra = a.getBoundingClientRect();
        if (ra.width > 4 && (r.right > ra.right + 2 || r.left < ra.left - 2) && !vistos.has(a)) { vistos.add(a); out.cortados.push(`${desc(el)} (no cabe en ${desc(a).slice(0, 40)})`); }
        break;
      }
    }
    if (r.right > vw + 1 && r.left < vw - 1 && getComputedStyle(el).position !== 'fixed' && !desplazable(el)) out.fuera.push(desc(el));
  }
  for (const el of document.querySelectorAll('button, a[href], [role="button"], [role="tab"], select, input[type="checkbox"], input[type="radio"], summary')) {
    if (!visible(el)) continue;
    if (el.tagName === 'A' && el.closest('p, li p, .texto, .md')) continue;   // los enlaces dentro de un texto no cuentan
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) out.pequenos.push(`${desc(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  for (const im of document.querySelectorAll('img')) if (im.complete && im.naturalWidth === 0 && im.getAttribute('src') && visible(im)) out.rotas.push((im.getAttribute('src') || '').slice(0, 80));
  // Textos que delatan un fallo: NaN, undefined, null, Invalid Date, [object Object], Infinity (en lo que se ve y en lo que se lee)
  const RARO = /(^|[^\p{L}\p{N}_])(NaN|undefined|null|Invalid Date|\[object Object\]|-?Infinity)(?![\p{L}\p{N}_])/gu;
  const textos = [document.body.innerText || ''];
  for (const el of document.querySelectorAll('[aria-label], [title], [placeholder], [aria-valuetext]')) for (const a of ['aria-label', 'title', 'placeholder', 'aria-valuetext']) { const v = el.getAttribute(a); if (v) textos.push(v); }
  for (const t of textos) for (const m of t.matchAll(RARO)) { if (out.raros.length < 6) out.raros.push(`«${t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, ' ').trim()}»`); }
  return out;
}

async function axe(p) {
  try {
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    await p.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 1200))]));
    return await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} [${v.impact}] (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
  } catch (e) { return [`axe no pudo mirar: ${e.message.slice(0, 80)}`]; }
}

async function revisar(p, ctx, { conAxe = true } = {}) {
  if (CAPTURAS) {
    const base0 = `${ctx.conf}-${ctx.quien}-${ctx.donde}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 120).toLowerCase();
    const n = (nombresCaptura.get(base0) || 0) + 1;
    nombresCaptura.set(base0, n);
    await p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())).catch(() => {});
    await p.screenshot({ path: join(CAPTURAS, `${base0}${n > 1 ? `-${n}` : ''}.png`), animations: 'disabled' }).catch(() => {});
  }
  const r = await p.evaluate(revisarEnPagina).catch(() => null);
  if (r) {
    if (r.desborde) apuntar(ctx, 'desborde', r.desborde);
    for (const x of r.cortados.slice(0, 6)) apuntar(ctx, 'cortado', x);
    for (const x of r.fuera.slice(0, 6)) apuntar(ctx, 'fuera', x);
    for (const x of r.pequenos.slice(0, 8)) apuntar(ctx, 'pequeño', x);
    for (const x of r.rotas.slice(0, 4)) apuntar(ctx, 'imagen rota', x);
    for (const x of r.raros) apuntar(ctx, 'texto raro', x);
  }
  if (conAxe && !sinAxe) for (const x of await axe(p)) apuntar(ctx, 'accesibilidad', x);
  const lt = await p.evaluate(() => { const l = (window.__lt || []).splice(0); return l; }).catch(() => []);
  for (const t of lt) if (t > 200) apuntar(ctx, 'bloqueo', `${Math.round(t)} ms`);
}

const srv = await servir(DIST, PUERTO);
const base = `http://localhost:${PUERTO}`;
const nav = await chromium.launch();
let estados = 0;
const t0 = Date.now();

async function entrar(conf, nombre) {
  const c = CONFS[conf];
  const ctx = await nav.newContext({ viewport: c.viewport, isMobile: !!c.isMobile, hasTouch: !!c.hasTouch, colorScheme: c.colorScheme, locale: 'es-ES', timezoneId: 'Europe/Madrid', reducedMotion: 'reduce' });
  // (con capturas, la hora quieta: dos pasadas comparables)
  if (CAPTURAS) await ctx.clock.setFixedTime(new Date(`${new Date().toISOString().slice(0, 10)}T11:00:00+01:00`));
  if (RAROS) await ctx.addInitScript((db) => {
    // una vez por pestaña (al recargar se queda lo que haya cambiado la app)
    try { if (!sessionStorage.getItem('fbe-raros')) { localStorage.setItem('fbe-demo-v2', db); sessionStorage.setItem('fbe-raros', '1'); } } catch (e) { console.error(`datos raros: no caben (${e.message})`); }
  }, RAROS);
  await ctx.addInitScript((aj) => {
    try { localStorage.setItem('fbe-escena-200', '1'); if (aj && !localStorage.getItem('fbe-ajustes')) localStorage.setItem('fbe-ajustes', JSON.stringify(aj)); } catch { /* */ }
    window.__lt = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: true }); } catch { /* */ }
  }, c.ajustes || null);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(`sin recoger: ${String(e.message).slice(0, 160)}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|favicon/.test(m.text())) errores.push(`consola: ${m.text().slice(0, 160)}`); });
  await p.goto(`${base}/?demo`);
  await p.getByRole('button', { name: nombre }).first().click();
  const cod = p.getByLabel('Código', { exact: true });
  await Promise.race([cod.waitFor({ timeout: 6000 }).catch(() => {}), p.locator('nav.tabs').waitFor({ timeout: 15000 })]);
  if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
  await p.locator('nav.tabs').waitFor({ timeout: 15000 });
  await p.waitForTimeout(1500);
  if (RAROS) {
    // (que de verdad ha cargado los datos raros: si no cupieran en el almacenamiento, saldría la demo de siempre)
    const n = await p.evaluate(async () => ({ atletas: (await globalThis.__fbeDemo.select('atletas', {})).length, mensajes: (await globalThis.__fbeDemo.select('comentarios', {})).length })).catch(() => null);
    console.log(`datos raros en el navegador (${nombre}): ${JSON.stringify(n)}`);
  }
  if (c.sinRed) { await p.evaluate(() => localStorage.setItem('fbe-demo-sin-red', '1')); await ctx.setOffline(true); await p.waitForTimeout(500); }
  return { ctx, p, errores };
}

const nModales = (p) => p.locator('[aria-modal="true"]').count().catch(() => 0);
async function cerrarModales(p, hasta = 0) {
  for (let i = 0; i < 6 && (await nModales(p)) > hasta; i++) {
    await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(350);
    if (i >= 3) { const x = p.locator('[aria-modal="true"] .cerrar-hoja, [aria-modal="true"] button[aria-label="Cerrar"]').last(); if (await x.count()) await x.click({ timeout: 1500 }).catch(() => {}); }
  }
  return (await nModales(p)) <= hasta;
}
async function irA(p, pestana) {
  if ((await nModales(p)) > 0) await cerrarModales(p);
  const ok = await p.locator('nav.tabs').count();
  if (!ok) { await p.goto(`${base}/?demo#${pestana}`); await p.locator('nav.tabs').waitFor({ timeout: 15000 }).catch(() => {}); }
  await p.evaluate((h) => { if (location.hash !== `#${h}`) location.hash = h; }, pestana);
  await p.waitForTimeout(900);
  await cerrarModales(p);
}
const firma = (p) => p.evaluate(() => `${location.hash}|${document.querySelector('nav.tabs') ? 1 : 0}|${(document.querySelector('main h1, .contenido h1, h1')?.textContent || '').trim().slice(0, 40)}`).catch(() => '');

// Los botones de la zona activa (la hoja de encima o la pantalla), marcados para poder tocarlos
const candidatos = (p) => p.evaluate(({ noTocar, soloCierra }) => {
  const NT = new RegExp(noTocar, 'i'), SC = new RegExp(soloCierra, 'i');
  const top = [...document.querySelectorAll('[aria-modal="true"]')].pop();
  const zona = top || document.querySelector('main') || document.body;
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[inert], [aria-hidden="true"]'); };
  document.querySelectorAll('[data-aud]').forEach((x) => x.removeAttribute('data-aud'));
  const out = [];
  for (const el of zona.querySelectorAll('button, [role="button"], [role="tab"], summary, a[href^="#"]')) {
    if (!visible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('nav.tabs')) continue;
    const nombre = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ');
    if (!nombre || NT.test(nombre) || SC.test(nombre)) continue;
    if (el.closest('form') && el.type === 'submit') continue;
    const clave = `${el.tagName}|${nombre.slice(0, 40)}|${typeof el.className === 'string' ? el.className.split(/\s+/)[0] : ''}`;
    el.setAttribute('data-aud', String(out.length));
    out.push({ i: out.length, clave, nombre: nombre.slice(0, 50) });
  }
  return out;
}, { noTocar: NO_TOCAR.source, soloCierra: SOLO_CIERRA.source }).catch(() => []);

async function explorar(s, ctx, pestana, nivel, maximo) {
  const { p } = s;
  const vistos = new Set();
  const base0 = await nModales(p);
  const firma0 = await firma(p);
  for (let vuelta = 0; vuelta < maximo; vuelta++) {
    const lista = await candidatos(p);
    const c = lista.find((x) => !vistos.has(x.clave));
    if (!c) break;
    vistos.add(c.clave);
    const antes = s.errores.length;
    const el = p.locator(`[data-aud="${c.i}"]`).first();
    try { await el.scrollIntoViewIfNeeded({ timeout: 1500 }); await el.click({ timeout: 2500 }); } catch { continue; }
    await p.waitForTimeout(750);
    estados++;
    const donde = `${ctx.donde} › ${c.nombre}`;
    const m = await nModales(p);
    const f = await firma(p);
    const ctxe = { ...ctx, donde };
    if (m > base0) {
      await revisar(p, ctxe);
      if (nivel < (hondo ? 1 : 0)) await explorar(s, ctxe, pestana, nivel + 1, 14);
      if (!(await cerrarModales(p, base0))) { await irA(p, pestana); if (nivel > 0) return; }
    } else if (f !== firma0) {
      await revisar(p, ctxe);
      // de vuelta a donde estaba
      if (nivel === 0) await irA(p, pestana); else { await cerrarModales(p, 0); return; }
    } else {
      await revisar(p, ctxe, { conAxe: false });
    }
    for (const e of s.errores.slice(antes)) apuntar(ctxe, 'error', e);
  }
}

function guardarInforme() {
  // El informe: agrupado por tipo y por lo que dice (lo mismo en varias pantallas, una línea con dónde)
  const grupos = new Map();
  for (const x of informe) {
    const clave = `${x.tipo}|${x.detalle.replace(/\d+(\.\d+)?/g, '#')}`;
    if (!grupos.has(clave)) grupos.set(clave, { tipo: x.tipo, detalle: x.detalle, donde: [] });
    const g = grupos.get(clave);
    if (g.donde.length < 6) g.donde.push(`${x.conf} · ${x.quien} · ${x.donde}`);
    g.n = (g.n || 0) + 1;
  }
  const orden = ['error', 'texto raro', 'desborde', 'fuera', 'cortado', 'imagen rota', 'accesibilidad', 'bloqueo', 'pequeño'];
  const lineas = [`# Auditoría de pantallas (${new Date().toISOString().slice(0, 16)})`, '', `${estados} estados revisados en ${Math.round((Date.now() - t0) / 1000)} s; ${informe.length} hallazgos en ${grupos.size} grupos. Configuraciones: ${confs.join(', ')}.`, ''];
  for (const tipo of orden) {
    const gs = [...grupos.values()].filter((g) => g.tipo === tipo).sort((a, b) => b.n - a.n);
    if (!gs.length) continue;
    lineas.push(`## ${tipo} (${gs.length})`, '');
    for (const g of gs) lineas.push(`- ${g.detalle} — ${g.n}× · ${g.donde.join(' | ')}`);
    lineas.push('');
  }
  writeFileSync(join(SALIDA, 'informe.md'), lineas.join('\n'));
  writeFileSync(join(SALIDA, 'informe.json'), JSON.stringify(informe, null, 1));
  return grupos.size;

}

for (const conf of confs) {
  for (const quien of quienes) {
    const personas = quien === 'coach' ? ['Pelayo'] : atletas;
    for (const nombre of personas) {
      const s = await entrar(conf, new RegExp(nombre));
      for (const pestana of PESTANAS[quien]) {
        const ctx = { conf, quien: `${quien} (${nombre})`, donde: pestana };
        await irA(s.p, pestana);
        const actual = await s.p.evaluate(() => location.hash.slice(1));
        if (actual !== pestana) continue;
        const antes = s.errores.length;
        await revisar(s.p, ctx);
        for (const e of s.errores.slice(antes)) apuntar(ctx, 'error', e);
        await explorar(s, ctx, pestana, 0, conf === 'movil' ? 40 : 18);
        guardarInforme();
        process.stdout.write(`${conf} ${quien} ${pestana}: ${informe.length} hallazgos, ${estados} estados, ${Math.round((Date.now() - t0) / 1000)} s\n`);
      }
      // El coach: la ficha de un atleta, pestaña a pestaña
      if (quien === 'coach') {
        await irA(s.p, 'atletas');
        const fila = s.p.locator('[data-atleta]').first();
        if (await fila.count()) {
          await fila.click().catch(() => {});
          await s.p.waitForTimeout(1200);
          const tabs = await s.p.locator('[role="tab"]').allTextContents().catch(() => []);
          for (const t of tabs.slice(0, 10)) {
            const ctx = { conf, quien: 'coach (Pelayo)', donde: `ficha › ${t.trim().slice(0, 24)}` };
            await s.p.getByRole('tab', { name: t.trim() }).first().click({ timeout: 2000 }).catch(() => {});
            await s.p.waitForTimeout(900);
            await revisar(s.p, ctx);
          }
        }
      }
      await s.ctx.close();
    }
  }
}
await nav.close();
srv.close?.();

const nGrupos = guardarInforme();
console.log(`\n${estados} estados, ${informe.length} hallazgos (${nGrupos} grupos) → ${join(SALIDA, 'informe.md')}`);
process.exit(0);
