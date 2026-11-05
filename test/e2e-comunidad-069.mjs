// v0.69: la comunidad, primera tanda (migración 041), en la demo, a tamaño de móvil. Lo llama e2e.test.mjs.
//   · la bienvenida a los nuevos: la tarjeta «Lucía F. se ha unido al equipo» y «Dar la bienvenida» (una vez; sigue tras recargar);
//   · «Entrenando ahora»: Ana lo enciende y apunta una serie; Rubén la ve arriba en Equipo y le manda ánimo 🙌;
//   · responder a un comentario (sangrado debajo) y 💪 a un comentario;
//   · «Compartir mis entrenos sin preguntar»: al terminar la sesión se comparte sola, con «Deshacer» (que la quita del muro);
//   · 360 px en oscuro, sin fallos de accesibilidad.
import { createRequire } from 'node:module';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarComunidad069({ navegador, check, base = 'http://localhost:4174' }) {
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
    await p.locator('.tab', { hasText: 'Equipo' }).first().click();
    await p.locator('.post').first().waitFor();
    // (Rubén celebra al entrar un reto conseguido: «Ahora no»)
    await p.waitForTimeout(800);
    await cerrarDialogos();
  };
  const toast = (texto) => p.locator('.toast', { hasText: texto }).waitFor();

  try {
    await p.goto(`${base}/?demo`);
    // ---------------- Ana entra en el equipo
    await entrarComo('Ana López');
    await p.locator('.tab', { hasText: 'Equipo' }).first().click();
    await p.getByRole('button', { name: 'Leer las normas' }).click();
    await p.getByRole('dialog', { name: 'Normas del equipo' }).getByRole('button', { name: 'He leído las normas' }).click();
    await p.getByRole('button', { name: 'Sí, quiero entrar' }).click();
    await p.locator('.post').first().waitFor();
    // La bienvenida: Lucía entró hace tres días
    const tarjetaLucia = p.getByRole('region', { name: 'Lucía F. se ha unido al equipo' });
    await tarjetaLucia.waitFor();
    check(await tarjetaLucia.getByRole('button', { name: 'Dar la bienvenida a Lucía F.' }).isEnabled() && await p.getByRole('region', { name: /^Ana L\. se ha unido/ }).count() === 0,
      'en el muro, «Lucía F. se ha unido al equipo» con «Dar la bienvenida 👋» (a sí misma no se ve)');
    await revisar('bienvenida-nuevo');
    await tarjetaLucia.getByRole('button', { name: 'Dar la bienvenida a Lucía F.' }).click();
    await toast('Le has dado la bienvenida a Lucía F.');
    check(await tarjetaLucia.getByRole('button', { name: 'Ya le has dado la bienvenida a Lucía F.' }).isDisabled(), '«Dar la bienvenida»: una vez (queda «Bienvenida dada»)');
    await p.waitForTimeout(500);
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await abrirEquipo();
    await tarjetaLucia.waitFor();
    check(await tarjetaLucia.getByRole('button', { name: 'Ya le has dado la bienvenida a Lucía F.' }).isDisabled(), 'y sigue dada al volver a abrir la app');
    // ---------------- Ajustes: «Entrenando ahora» (apagado de entrada) y compartir sin preguntar
    await p.getByRole('button', { name: 'Ajustes de la comunidad' }).click();
    const hojaAj = p.getByRole('dialog', { name: 'Ajustes de la comunidad' });
    const entrenando = hojaAj.getByRole('switch', { name: /Que el equipo vea cuándo estoy entrenando/ });
    const auto = hojaAj.getByRole('switch', { name: /Compartir mis entrenos sin preguntar/ });
    check(!(await entrenando.isChecked()) && !(await auto.isChecked()) && /ni la hora ni lo que haces/.test(await hojaAj.textContent()),
      'en los ajustes del equipo, «Que el equipo vea cuándo estoy entrenando» y «Compartir mis entrenos sin preguntar», apagados de entrada');
    await revisar('ajustes-069');
    await entrenando.check();
    await toast('El equipo verá cuándo estás entrenando');
    await auto.check();
    await toast('Tus entrenos se compartirán solos');
    check(await entrenando.isChecked() && await auto.isChecked(), 'Ana enciende los dos');
    await hojaAj.getByRole('button', { name: 'Cerrar' }).click();
    await hojaAj.waitFor({ state: 'detached' });
    // ---------------- Ana empieza su sesión y apunta una serie (está entrenando)
    await p.locator('.tab', { hasText: 'Hoy' }).click();
    await p.locator('.hero-dia').waitFor();
    await p.waitForTimeout(800);
    await cerrarDialogos();
    await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).click();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor();
    if (await p.locator('.portada-sesion').count()) await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.ejercicio').first().waitFor();
    const prep = p.locator('.preparacion');
    if (await prep.getByRole('button', { name: 'Ahora no' }).count()) await prep.getByRole('button', { name: 'Ahora no' }).click();
    for (const b of await p.locator('.pista').getByRole('button', { name: 'Entendido' }).all()) await b.click().catch(() => {});
    const primero = p.locator('.ejercicio').first();
    if (!(await primero.locator('.ejercicio-cuerpo').count())) await primero.locator('.ejercicio-cab').click();
    await primero.getByLabel('Kilos de la serie 1').fill('20');
    await primero.getByLabel('Repeticiones de la serie 1').fill('10');
    await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
    await p.getByRole('button', { name: 'Saltar' }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    // ---------------- Rubén: la ve entrenando, le anima, le da la bienvenida, responde y da 💪
    await entrarComo('Rubén');
    await abrirEquipo();
    const ahora = p.getByRole('region', { name: 'Entrenando ahora' });
    await ahora.waitFor();
    check((await ahora.textContent()).includes('Ana L.') && !(await ahora.textContent()).includes('Rubén') && !/\d+:\d\d|min/.test(await ahora.textContent()),
      'arriba en Equipo, «Entrenando ahora»: Ana (que lo ha encendido), sin horas');
    await ahora.getByRole('button', { name: 'Animar a Ana L.' }).click();
    await toast('Le has mandado ánimo a Ana L.');
    check(await ahora.getByRole('button', { name: 'Ya has animado a Ana L. esta semana' }).isDisabled(), '«🙌» le manda ánimo (el de siempre: uno por semana)');
    const tarjetaAna = p.getByRole('region', { name: 'Ana L. se ha unido al equipo' });
    check(await p.getByRole('region', { name: 'Lucía F. se ha unido al equipo' }).getByRole('button', { name: 'Ya le has dado la bienvenida a Lucía F.' }).isDisabled(),
      'a Lucía ya le dio la bienvenida (en la demo)');
    await tarjetaAna.getByRole('button', { name: 'Dar la bienvenida a Ana L.' }).click();
    await toast('Le has dado la bienvenida a Ana L.');
    await revisar('equipo-069');
    // 360 px en oscuro
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar('equipo-069-360-oscuro');
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360
      && [...document.querySelectorAll('.entrenando-ahora, .bienvenida-nuevo, .bn-boton, .ea-persona')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    check(cabe, 'a 360 px en oscuro, «Entrenando ahora» y las tarjetas de bienvenida caben');
    // Responder a un comentario y 💪 (en la publicación de Lucía, a Carlos)
    const deLucia = p.getByRole('article', { name: 'Publicación de Lucía F.' });
    await deLucia.locator('.post-comentar').click();
    const hojaCom = p.getByRole('dialog', { name: 'Comentarios' });
    const deCarlos = hojaCom.locator('.comentarios-equipo > li', { hasText: 'yo a las 7:15' });
    await deCarlos.waitFor();
    await deCarlos.getByRole('button', { name: 'Responder a Carlos V.' }).first().click();
    const caja = hojaCom.getByLabel('Tu respuesta a Carlos V.');
    await caja.waitFor();
    check(await p.evaluate(() => document.activeElement?.id === 'eq-comentario') && (await hojaCom.locator('.respondiendo').textContent()).includes('Carlos V.'),
      '«Responder»: «Respondiendo a Carlos V.» y el foco en la caja');
    await caja.fill('¡Allí nos vemos!');
    await hojaCom.getByRole('button', { name: 'Responder', exact: true }).click();
    const respuesta = deCarlos.locator('.respuestas-equipo .comentario-equipo.respuesta', { hasText: '¡Allí nos vemos!' });
    await respuesta.waitFor();
    check(await hojaCom.locator('.respondiendo').count() === 0 && await respuesta.count() === 1
      && await respuesta.evaluate((x) => x.getBoundingClientRect().left > document.querySelector('.comentarios-equipo > li .pila-xs').getBoundingClientRect().left - 1),
      'la respuesta sale debajo del comentario de Carlos, sangrada');
    const fuerza = deCarlos.locator(':scope > .pila-xs > .comentario-acciones .fuerza-comentario');
    check(/^Fuerza: 0$/.test(await fuerza.getAttribute('aria-label')), 'el comentario de Carlos aún no tiene 💪');
    await fuerza.click();
    await p.waitForFunction(() => [...document.querySelectorAll('.fuerza-comentario')].some((b) => b.getAttribute('aria-pressed') === 'true' && /^Fuerza: 1 \(Rubén M\.\)$/.test(b.getAttribute('aria-label'))));
    check(true, '💪 al comentario de Carlos: cuenta 1 y dice quién');
    await revisar('comentarios-069-360-oscuro');
    await hojaCom.getByRole('button', { name: 'Cerrar' }).click();
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
    // ---------------- Ana termina la sesión: se comparte sola, con «Deshacer»
    await entrarComo('Ana López');
    await p.locator('.tab', { hasText: 'Hoy' }).click();
    await p.locator('.hero-dia').waitFor();
    await p.waitForTimeout(600);
    await cerrarDialogos();
    await p.locator('.hero-dia').getByRole('button', { name: /Continuar sesión|Empezar sesión/ }).click();
    await p.locator('.ejercicio').first().waitFor();
    await p.getByRole('button', { name: 'Terminar sesión' }).click();
    await p.locator('.hoja-dialogo .segmentos button', { hasText: '8' }).first().click();
    await p.getByRole('button', { name: 'Guardar y terminar' }).click();
    await p.getByRole('heading', { name: 'Sesión terminada' }).waitFor();
    const avisoCompartido = p.locator('.toast', { hasText: 'Compartido con el equipo' });
    await avisoCompartido.waitFor();
    check(await p.locator('.compartida-equipo').isVisible() && await avisoCompartido.getByRole('button', { name: 'Deshacer' }).isVisible(),
      'al terminar la sesión, se comparte sola con el equipo: «Compartido con el equipo · Deshacer»');
    await avisoCompartido.getByRole('button', { name: 'Deshacer' }).click();
    await toast('Ya no está en el muro');
    await p.getByRole('button', { name: 'Compartir con el equipo' }).waitFor();
    check(await p.locator('.compartida-equipo').count() === 0, '«Deshacer» la quita (y vuelve «Compartir con el equipo»)');
    await p.getByRole('button', { name: 'Volver a hoy' }).click();
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(600);
    await cerrarDialogos();
    await abrirEquipo();
    check(await p.getByRole('article', { name: /^Entreno compartido de Ana L\./ }).count() === 0 && (await p.locator('.animos-recibidos', { hasText: 'Te han dado la bienvenida' }).textContent()).includes('Rubén M.'),
      'en el muro ya no está su entreno; y arriba, «Te han dado la bienvenida: Rubén M.»');
  } catch (e) {
    check(false, `v0.69: ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-comunidad-069')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-069.png', import.meta.url).pathname }).catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}
