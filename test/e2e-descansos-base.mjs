// Los descansos con la base (migración 060), en la demo y en un móvil simulado: el coach escribe la novedad de la semana
// y el atleta la ve en Hoy y en sus apuntes; lo que recorre en La travesía y los apuntes que ve suben a la base, y en
// un móvil nuevo (sin nada guardado) vuelven de ella.
//   Suelta:  npm run build && node test/e2e-descansos-base.mjs
//   Dentro de e2e.test.mjs:  const { probarDescansosBase } = await import('./e2e-descansos-base.mjs'); await probarDescansosBase({ navegador, check });
import { pathToFileURL } from 'node:url';
import { irASeccion } from './secciones.mjs';

export async function probarDescansosBase({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const fueraAvisos = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(300);
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      await p.keyboard.press('Escape');
    }
  };
  const entrar = async (quien) => { await p.getByRole('button', { name: new RegExp(quien) }).first().click(); await p.locator('nav.tabs').waitFor(); await fueraAvisos(); };
  // (la demo guarda lo suyo un momento después de cada cambio: se espera antes de recargar)
  const cambiarA = async (quien) => { await p.waitForTimeout(450); await p.evaluate(() => { localStorage.removeItem('fbe-demo-v2-sesion'); }); await p.goto(`${base}/?demo`); await entrar(quien); };
  const tabla = (t) => p.evaluate((n) => globalThis.__fbeDemo.select(n, {}), t);
  const seg = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  const TITULO = 'Dormir poco resta fuerza al día siguiente';

  try {
    // --- El coach escribe la novedad de la semana ---
    await p.goto(`${base}/?demo`);
    await entrar('Pelayo');
    await irASeccion(p, 'Biblioteca');
    await p.getByRole('tab', { name: 'Guías' }).click();
    const zona = p.locator('.novedades-coach');
    await zona.waitFor();
    check(/La novedad de la semana/.test(await zona.textContent()) && await zona.locator('.novedad-fila').count() === 0, 'el coach, en Biblioteca → Guías: «La novedad de la semana», aún vacía');
    await zona.getByRole('button', { name: /Nueva/ }).click();
    const form = p.locator('.novedad-form');
    await form.waitFor();
    await form.getByLabel('Título').fill(TITULO);
    await form.getByLabel('Texto').fill('Un ensayo con 20 personas entrenadas: tras dormir 4 horas hicieron menos repeticiones con el mismo peso. Si has dormido mal, baja una serie, no el peso.');
    await form.getByLabel(/De dónde sale/).fill('Apellido et al., Revista de prueba, 2026');
    await form.getByLabel(/Enlace/).fill('https://pubmed.ncbi.nlm.nih.gov/12345678/');
    check(/\d+\/500/.test(await form.locator('.cuenta-letras').textContent()) && await form.getByRole('switch').isChecked(), 'el formulario cuenta las letras del texto y viene con «Publicada» puesto');
    await form.getByRole('button', { name: 'Guardar y publicar' }).click();
    await form.waitFor({ state: 'detached' });
    const fila = zona.locator('.novedad-fila');
    await fila.first().waitFor();
    check(await fila.count() === 1 && (await fila.textContent()).includes(TITULO) && /Publicada/.test(await fila.textContent()) && /Apellido et al\./.test(await fila.textContent()), 'guardada y publicada: sale en su lista, con su fecha y su fuente');
    const [nov] = await tabla('novedades');

    // --- El atleta la ve en Hoy y en sus apuntes ---
    await cambiarA('Ana López');
    await p.locator('.hero-dia .btn-hero').waitFor();
    const enHoy = p.locator('.apuntes-tarjeta:not(.repaso)');
    await enHoy.scrollIntoViewIfNeeded();
    await p.locator('.apuntes-tarjeta.con-novedad').waitFor({ timeout: 8000 });
    check(/Novedad de la semana/.test(await enHoy.textContent()) && (await enHoy.textContent()).includes(TITULO.slice(0, 20)), 'en Hoy, la tarjeta de apuntes pasa a ser «Novedad de la semana», con su título');
    await enHoy.getByRole('button', { name: 'Leer' }).click();
    const hoja = p.locator('.apuntes'), tarjeta = hoja.locator('article.apunte');
    await tarjeta.waitFor();
    const enlace = tarjeta.locator('.apunte-fuente a');
    check(await tarjeta.locator('.chip').textContent() === 'Novedad de la semana' && await tarjeta.locator('h2').textContent() === TITULO && /menos repeticiones/.test(await tarjeta.locator('.apunte-texto').textContent()), 'al abrirla, la novedad: su título y su texto');
    check(/Apellido et al\./.test(await tarjeta.locator('.apunte-fuente').textContent()) && await enlace.getAttribute('href') === 'https://pubmed.ncbi.nlm.nih.gov/12345678/' && await enlace.getAttribute('target') === '_blank' && /noopener/.test(await enlace.getAttribute('rel')), 'con de dónde sale y «Ver el estudio» (en otra pestaña)');
    await hoja.getByRole('button', { name: 'Cerrar los apuntes' }).click();
    await hoja.waitFor({ state: 'detached' });
    await p.waitForTimeout(400);
    check(!/Novedad de la semana/.test(await enHoy.textContent()) && /El apunte de hoy/.test(await enHoy.textContent()), 'una vez leída, la tarjeta vuelve a «El apunte de hoy»');
    const av = await tabla('apuntes_vistos');
    check(av.length === 1 && av[0].apunte === `n:${nov.id}` && av[0].veces === 1, 'y lo visto sube a la base');

    // --- La travesía sube a la base ---
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('.hero-dia .btn-hero').click();
    await p.getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const primero = p.locator('.ejercicio').first();
    await primero.getByLabel('Kilos de la serie 1').fill('30');
    await primero.getByLabel('Repeticiones de la serie 1').fill('8');
    await p.keyboard.press('Escape');
    await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    const reloj = p.locator('.temporizador');
    await reloj.waitFor();
    await reloj.getByRole('button', { name: 'Quitar 1 minuto' }).click();
    for (let i = 0; i < 12 && seg(await reloj.locator('.cuenta').textContent()) > 24; i++) await reloj.getByRole('button', { name: 'Quitar 15 segundos' }).click();
    const quedaban = seg(await reloj.locator('.cuenta').textContent());
    await reloj.getByRole('button', { name: 'Jugar' }).click();
    await p.locator('.travesia').waitFor();
    await p.locator('.travesia-final').waitFor({ timeout: (quedaban + 6) * 1000 });
    await p.locator('.travesia').waitFor({ state: 'detached', timeout: 7000 });
    await p.waitForTimeout(500);
    const ts = await tabla('travesia_semanas');
    const local = await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('fbe-travesia-')); return JSON.parse(localStorage.getItem(k)); });
    check(ts.length === 1 && ts[0].metros === local.total && ts[0].metros > 20 && ts[0].etapas === 1 && new Date(`${ts[0].semana}T12:00:00Z`).getUTCDay() === 1, `la etapa jugada sube a la base, en su semana (${ts[0]?.metros} m)`);
    check(local.pend.metros === 0, 'y en el móvil ya no queda nada pendiente de subir');
    if (await reloj.count()) await p.locator('.temporizador .saltar').click({ timeout: 8000 }).catch(() => {});
    // (CI) si algo se ha puesto encima (un aviso, «¿Seguimos?»), se cierra y se vuelve a intentar
    if (!(await p.getByRole('button', { name: 'Volver' }).first().click({ timeout: 8000 }).then(() => true, () => false))) {
      for (let i = 0; i < 3; i++) await p.keyboard.press('Escape');
      await p.getByRole('button', { name: 'Volver' }).first().click({ timeout: 15000 });
    }
    await p.locator('nav.tabs').waitFor();

    // --- Un móvil nuevo: lo suyo vuelve de la base ---
    await p.waitForTimeout(450);
    await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('fbe-travesia-') || k.startsWith('fbe-apuntes-')) localStorage.removeItem(k); });
    await p.goto(`${base}/?demo`);
    await p.locator('nav.tabs').waitFor().catch(() => {});
    if (!(await p.locator('nav.tabs').count())) await entrar('Ana López'); else await fueraAvisos();
    await irASeccion(p, 'Semana');
    const lobo = p.locator('.travesia-tarjeta:not(.compacta)');
    await lobo.waitFor({ timeout: 8000 });
    await p.waitForFunction((m) => new RegExp(`Tu lobo lleva ${m} m`).test(document.querySelector('.travesia-tarjeta:not(.compacta)')?.textContent || ''), ts[0].metros, { timeout: 8000 }).catch(() => {});
    const tl = (await lobo.textContent()).replace(/\s+/g, ' ');
    check(new RegExp(`Tu lobo lleva ${ts[0].metros} m`).test(tl) && new RegExp(`Esta semana: ${ts[0].metros} m`).test(tl), `sin nada guardado en el móvil, la travesía vuelve de la base («${tl.replace('Practicar', '').trim().slice(0, 80)}»)`);
    const ap = p.locator('.apuntes-tarjeta.repaso');
    await p.waitForFunction(() => /1 en total/.test(document.querySelector('.apuntes-tarjeta.repaso')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
    check(/1 apunte esta semana · 1 en total/.test((await ap.textContent()).replace(/\s+/g, ' ')), 'y sus apuntes vistos, también');

    // --- El coach la despublica: deja de verse ---
    await cambiarA('Pelayo');
    await p.evaluate(async (id) => { await globalThis.__fbeDemo.update('novedades', { publicada: false }, { eq: { id } }); }, nov.id);
    const [nov2] = await tabla('novedades');
    await cambiarA('Ana López');
    const visibles = await tabla('novedades');
    check(nov2.publicada === false && nov2.publicada_en === null && visibles.length === 0, 'si el coach la despublica, el atleta deja de verla');
  } catch (e) {
    check(false, `Los descansos con la base: ${e.message.split('\n')[0]}`);
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
  console.log('\nLos descansos con la base (060)');
  try { await probarDescansosBase({ navegador, check }); } finally { await navegador.close(); srv.close(); }
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}
