// v0.70: la comunidad, segunda tanda (migración 042), en la demo, a tamaño de móvil. Lo llama e2e.test.mjs.
//   · compañeros de racha: Ana invita a Rubén, Rubén acepta y ve sus parejas («Tú y Ana L.»);
//   · insignias en su perfil (la siguiente, con su progreso) y en el ranking;
//   · un reto por equipos (dos barras) y uno de cardio («Contar mis minutos»);
//   · el coach: un reto de una plantilla de un toque y uno por equipos repartido igualado;
//   · 360 px en oscuro, sin fallos de accesibilidad.
import { createRequire } from 'node:module';
import { irASeccion, abrirEnEquipo } from './secciones.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarComunidad070({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 390;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const sinNombre = await p.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const nombre = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
        const etiqueta = el.id && document.querySelector(`label[for="${el.id}"]`);
        return !nombre && !etiqueta && !el.closest('label');
      }).map((el) => el.outerHTML.slice(0, 90)));
    if (sinNombre.length) errores.push(`${paso}: controles sin nombre accesible: ${sinNombre.join(' | ')}`);
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ]));
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const axe = await p.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } },
    })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    if (axe.length) errores.push(`${paso}: accesibilidad: ${axe.join(' || ')}`);
  }
  const cerrarDialogos = async () => {
    for (let i = 0; i < 6; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Seguir', 'Entendido', 'Vale', 'Cerrar', 'Ahora no']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { hecho = await b.click({ timeout: 4000 }).then(() => true, () => false); break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  // Cambiar de cuenta en la demo (lo guardado se queda: se espera a que se guarde, 150 ms después de cada cambio)
  const entrarComo = async (nombre) => {
    if (!(await p.getByRole('heading', { name: 'Entra en tu cuenta' }).isVisible().catch(() => false))) {
      await p.waitForTimeout(500);
      await p.evaluate(() => { localStorage.removeItem('fbe-demo-v2-sesion'); });
      await p.goto(`${base}/?demo`);
    }
    await p.getByRole('button', { name: new RegExp(nombre) }).first().click();
    const cod = p.getByLabel('Código', { exact: true });
    await Promise.race([cod.waitFor({ timeout: 8000 }).catch(() => {}), p.locator('nav.tabs').waitFor()]);
    if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(800);
    await cerrarDialogos();
  };
  const abrirEquipo = async () => {
    await irASeccion(p, 'Equipo');
    await p.locator('.post').first().waitFor();
    // (Rubén celebra al entrar un reto conseguido: «Ahora no»)
    await p.waitForTimeout(800);
    await cerrarDialogos();
  };
  const toast = (texto) => p.locator('.toast', { hasText: texto }).waitFor();

  try {
    await p.goto(`${base}/?demo`);
    // ---------------- Ana entra en el equipo e invita a Rubén a ser compañeros de racha
    await entrarComo('Ana López');
    await irASeccion(p, 'Equipo');
    await p.getByRole('button', { name: 'Leer las normas' }).click();
    await p.getByRole('dialog', { name: 'Normas del equipo' }).getByRole('button', { name: 'He leído las normas' }).click();
    await p.getByRole('button', { name: 'Sí, quiero entrar' }).click();
    await p.locator('.post').first().waitFor();
    const companeros = p.getByRole('region', { name: 'Compañeros de racha' });
    await abrirEnEquipo(p, 'companeros'); // (diseño) va plegado en una pastilla
    await companeros.waitFor();
    check(/Invita a hasta 3/.test(await companeros.textContent()), 'arriba en Equipo, «Compañeros de racha» (sin ninguno aún: «Invita a hasta 3…»)');
    await companeros.getByRole('button', { name: 'Invitar', exact: true }).click();
    const hojaInv = p.getByRole('dialog', { name: 'Invitar a un compañero de racha' });
    await hojaInv.getByRole('button', { name: 'Invitar a Rubén M.' }).waitFor();
    check(await hojaInv.getByRole('button', { name: /^Invitar a Ana/ }).count() === 0, 'la lista para invitar: los del equipo (ella no)');
    await revisar('invitar-companero');
    await hojaInv.getByRole('button', { name: 'Invitar a Rubén M.' }).click();
    await toast('Invitación enviada a Rubén M.');
    await hojaInv.waitFor({ state: 'detached' });
    await companeros.getByText('Invitación enviada a').waitFor();
    check((await companeros.textContent()).includes('Invitación enviada a Rubén M.'), 'Ana invita a Rubén: «Invitación enviada a Rubén M.»');
    // ---------------- Rubén acepta y ve sus parejas
    await entrarComo('Rubén');
    await abrirEquipo();
    await companeros.waitFor();
    const aceptar = companeros.getByRole('button', { name: 'Aceptar a Ana L. como compañero de racha' });
    await aceptar.waitFor();
    check((await companeros.textContent()).includes('Ana L. te invita a ser compañeros de racha'), 'a Rubén le sale la invitación de Ana, con «Aceptar» y «Ahora no»');
    await revisar('invitacion-recibida');
    await aceptar.click();
    await toast('Ana L. y tú ya sois compañeros de racha');
    await companeros.locator('.cp-pareja', { hasText: 'Ana L.' }).waitFor();
    const parejas = (await companeros.locator('.cp-pareja').allTextContents()).map((t) => t.replace('Ver el perfil de ', ''));
    const textoCp = await companeros.textContent();
    check(parejas.some((t) => t.startsWith('Tú y Ana L.')) && parejas.some((t) => t.startsWith('Tú y Carlos V.')) && /Esta semana: tú .+ · Ana L\./.test(textoCp),
      'Rubén acepta: «Tú y Ana L.» junto a «Tú y Carlos V.», con cómo va la semana de cada uno');
    // ---------------- Su perfil: insignias (la siguiente, con su progreso) y sus compañeros
    // (v0.117) con lo social encima, la lista de compañeros queda más abajo y la cabecera se recoge: se sube arriba para ver «Estás como…»
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
    await p.getByRole('button', { name: /Ver tu perfil en el equipo/ }).click();
    const hojaPerfil = p.getByRole('dialog', { name: 'Perfil en el equipo' });
    await hojaPerfil.locator('.insignias-perfil').waitFor();
    await hojaPerfil.locator('.pe-parejas').waitFor();
    check(await hojaPerfil.locator('.pe-insignias .insignia', { hasText: 'Primera publicación' }).count() === 1
      && await hojaPerfil.locator('.insignia-siguiente [role=progressbar]').count() === 1 && /Siguiente:/.test(await hojaPerfil.locator('.insignia-siguiente').textContent()),
      'en su perfil, sus insignias («Primera publicación») y la siguiente con su progreso');
    check(/Tú y Ana L\./.test(await hojaPerfil.locator('.pe-parejas').textContent()) && /Tú y Carlos V\./.test(await hojaPerfil.locator('.pe-parejas').textContent()), 'y sus compañeros de racha');
    await revisar('perfil-insignias');
    await hojaPerfil.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await hojaPerfil.waitFor({ state: 'detached' });
    // ---------------- Retos: por equipos y de cardio
    await p.getByRole('tab', { name: 'Retos' }).click();
    const rq = p.getByRole('article', { name: 'Reto: Rojos contra azules: 15 sesiones' });
    await rq.waitFor();
    check(await rq.getByRole('progressbar', { name: /^Rojos: \d+ de 15 sesiones$/ }).count() === 1 && await rq.getByRole('progressbar', { name: /^Azules: \d+ de 15 sesiones$/ }).count() === 1
      && (await rq.textContent()).includes('Rojos (el tuyo)') && /Quien más suma|Aún nadie/.test(await rq.textContent()) && (await rq.textContent()).includes('Por equipos'),
      'un reto por equipos: una barra y un total por equipo, quién suma más en cada uno y cuál es el suyo');
    const rc = p.getByRole('article', { name: 'Reto: Mes de cardio: 400 minutos entre todos' });
    await rc.waitFor();
    check((await rc.textContent()).includes('400 minutos de cardio') && await rc.getByRole('progressbar', { name: /minutos de cardio$/ }).count() === 1,
      'un reto de cardio: cuenta minutos de cardio (con su barra)');
    const contar = rc.getByRole('button', { name: 'Contar mis minutos' });
    check(await contar.isVisible() && /no cuentan/.test(await rc.textContent()), 'mientras no lo encienda, sus minutos no cuentan y se lo dice, con «Contar mis minutos»');
    await contar.click();
    await toast('Tus minutos de cardio ya cuentan en los retos');
    await rc.getByRole('button', { name: 'Contar mis minutos' }).waitFor({ state: 'detached' });
    check(true, '«Contar mis minutos»: desde ese momento, sus minutos cuentan');
    // 360 px en oscuro
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar('retos-070-360-oscuro');
    const cabeRetos = await p.evaluate(() => document.documentElement.scrollWidth <= 360
      && [...document.querySelectorAll('.marcador-equipos, .me-equipo, .reto-cardio-optin, .reto')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    check(cabeRetos, 'a 360 px en oscuro, los retos por equipos y de cardio caben');
    await p.getByRole('tab', { name: 'Muro' }).click();
    await companeros.waitFor();
    await revisar('companeros-360-oscuro');
    const cabeCp = await p.evaluate(() => [...document.querySelectorAll('.companeros, .cp-fila')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    check(cabeCp, 'y los compañeros de racha también');
    await p.getByRole('tab', { name: 'Ranking' }).click();
    await p.locator('.ranking .podio-sitio, .ranking .fila-ranking').first().waitFor();
    await p.locator('.ranking .insignias-mini').first().waitFor();
    check(/^Insignias: /.test(await p.locator('.ranking .insignias-mini').first().getAttribute('aria-label')), 'en el ranking, las insignias junto al nombre (con su nombre para los lectores de pantalla)');
    await revisar('ranking-070-360-oscuro');
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
    // ---------------- El coach: un reto de una plantilla y uno por equipos
    await p.waitForTimeout(500);
    await p.evaluate(() => { localStorage.removeItem('fbe-demo-v2-sesion'); });
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(600);
    await cerrarDialogos();
    await irASeccion(p, 'Equipo');
    await p.getByRole('tab', { name: 'Retos' }).click();
    await p.getByRole('button', { name: 'Nuevo reto' }).click();
    let hojaReto = p.getByRole('dialog', { name: 'Nuevo reto' });
    const plantillas = hojaReto.locator('.plantillas-reto');
    await plantillas.getByRole('button', { name: 'Minutos de cardio', exact: true }).waitFor();
    check(await plantillas.getByRole('button').count() === 5, 'al crear un reto, cinco plantillas de un toque');
    await plantillas.getByRole('button', { name: 'Minutos de cardio', exact: true }).click();
    const obj = hojaReto.getByLabel('Minutos de cardio entre todo el equipo');
    check(await hojaReto.getByLabel('Título').inputValue() === 'Minutos de cardio' && await obj.inputValue() === '1000' && await obj.getAttribute('max') === '30000'
      && /^\d{4}-\d{2}-\d{2}$/.test(await hojaReto.getByLabel('Desde').inputValue()) && await hojaReto.getByRole('group', { name: 'Qué cuenta' }).getByRole('button', { name: 'Minutos de cardio' }).getAttribute('aria-pressed') === 'true',
      '«Minutos de cardio» rellena el reto: título, minutos entre todos, fechas (que se pueden cambiar) y qué cuenta');
    await revisar('reto-plantilla');
    await hojaReto.getByRole('button', { name: 'Crear el reto' }).click();
    await toast('Reto creado');
    const rNuevo = p.getByRole('article', { name: 'Reto: Minutos de cardio' });
    await rNuevo.waitFor();
    check((await rNuevo.textContent()).includes('1000 minutos de cardio entre todos'), 'y queda creado: un reto de minutos de cardio entre todos');
    await p.getByRole('button', { name: 'Nuevo reto' }).click();
    hojaReto = p.getByRole('dialog', { name: 'Nuevo reto' });
    await hojaReto.getByRole('button', { name: 'Por equipos', exact: true }).click();
    await hojaReto.locator('.reparto-fila').first().waitFor();
    await hojaReto.getByRole('button', { name: 'Repartir igualados' }).click();
    const enA = await hojaReto.locator('.reparto-fila button[aria-pressed="true"]', { hasText: 'Equipo rojo' }).count();
    const enB = await hojaReto.locator('.reparto-fila button[aria-pressed="true"]', { hasText: 'Equipo azul' }).count();
    check(enA >= 1 && enB >= 1 && enA + enB === await hojaReto.locator('.reparto-fila').count(), `«Por equipos»: repartidos igualados por sus sesiones recientes (${enA} y ${enB}), y se pueden cambiar`);
    await hojaReto.getByLabel('Título').fill('Rojo contra azul');
    await revisar('reto-equipos');
    await hojaReto.getByRole('button', { name: 'Crear el reto' }).click();
    await toast('Reto creado');
    const rEq = p.getByRole('article', { name: 'Reto: Rojo contra azul' });
    await rEq.waitFor();
    await rEq.getByRole('progressbar', { name: /^Equipo azul: / }).waitFor();
    check(await rEq.getByRole('progressbar', { name: /^Equipo rojo: / }).count() === 1, 'y su tarjeta sale con los dos equipos');
  } catch (e) {
    check(false, `v0.70: ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-comunidad-070')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-070.png', import.meta.url).pathname }).catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}
