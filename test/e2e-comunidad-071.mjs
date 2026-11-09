// v0.71: la comunidad, tercera tanda (migración 043), en la demo, a tamaño de móvil. Lo llama e2e.test.mjs.
//   · Ana entra y publica con un tema (Técnica): el filtro «Técnica» la enseña;
//   · Ana pregunta al coach (con la línea de las normas); el coach contesta, la guarda como pregunta frecuente y sale en
//     «Preguntas» (también para los atletas);
//   · una publicación con 3 fotos (quita una: 2) y su galería (Anterior / Siguiente);
//   · guardar y el filtro «Guardados»; buscar por texto y por nombre;
//   · la mejor respuesta (Lucía la cambia en su publicación: sale primero, con su distintivo);
//   · 360 px en oscuro, sin fallos de accesibilidad.
import { createRequire } from 'node:module';
import { irASeccion, abrirCompositor } from './secciones.mjs';
import { readFileSync } from 'node:fs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const PNG = readFileSync(new URL('../web/iconos/icono-180.png', import.meta.url));

export async function probarComunidad071({ navegador, check, base = 'http://localhost:4174' }) {
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
    await p.waitForTimeout(800);
    await cerrarDialogos();
  };
  const toast = (texto) => p.locator('.toast', { hasText: texto }).waitFor();
  const filtro = (nombre) => p.getByRole('group', { name: 'Qué ver en el muro' }).getByRole('button', { name: nombre, exact: true });
  const post = (texto) => p.locator('article.post', { hasText: texto });

  try {
    await p.goto(`${base}/?demo`);
    // ---------------- Ana entra y publica con un tema
    await entrarComo('Ana López');
    await irASeccion(p, 'Equipo');
    await p.getByRole('button', { name: 'Leer las normas' }).click();
    await p.getByRole('dialog', { name: 'Normas del equipo' }).getByRole('button', { name: 'He leído las normas' }).click();
    await p.getByRole('button', { name: 'Sí, quiero entrar' }).click();
    await p.locator('.post').first().waitFor();
    const tema = p.getByLabel('Tema', { exact: true });
    await abrirCompositor(p); // (diseño) el cuadro de publicar empieza plegado en una línea
    await tema.waitFor();
    check(await tema.inputValue() === 'charla' && (await tema.locator('option').allTextContents()).join() === 'Charla,Técnica,Logros,Pregunta para el coach'
      && /Pregunta para el coach/.test(await p.locator('.compositor-nota').textContent()),
      'el compositor: un tema (Charla de entrada; Técnica, Logros o Pregunta para el coach; «Avisos» no) y una línea que manda las dudas de salud al coach');
    await tema.selectOption('tecnica');
    await p.getByLabel('Tu publicación').fill('Mi truco para la sentadilla: respirar hondo y apretar el abdomen antes de bajar.');
    await p.getByRole('button', { name: 'Publicar', exact: true }).click();
    await toast('Publicado en el equipo');
    await post('Mi truco para la sentadilla').waitFor();
    check(await tema.inputValue() === 'charla', 'publicada (y el tema vuelve a «Charla»)');
    await filtro('Técnica').click();
    await p.locator('article.post', { hasText: 'juntar las escápulas' }).waitFor();   // (el truco de Rubén: algunos días el entreno de Carlos también lleva press banca)
    // (en una máquina lenta, la lista filtrada sustituye a la de antes un poco después: se espera a que quede solo lo filtrado)
    await p.waitForFunction(() => { const xs = [...document.querySelectorAll('article.post .post-quien .mini')].map((x) => x.textContent); return xs.length === 2 && xs.every((t) => t.startsWith('Técnica · ')); }, null, { timeout: 10000 }).catch(() => {});
    const metas = await p.locator('article.post .post-quien .mini').allTextContents();
    check(await post('Mi truco para la sentadilla').count() === 1 && metas.length === 2 && metas.every((t) => t.startsWith('Técnica · ')) && await filtro('Técnica').getAttribute('aria-pressed') === 'true',
      'el filtro «Técnica»: la suya y el truco de Rubén, con su tema');
    // ---------------- Una pregunta para el coach
    await filtro('Todo').click();
    await post('Mi truco para la sentadilla').waitFor();
    await tema.selectOption('pregunta');
    check(/Te contesta tu coach en los comentarios/.test(await p.locator('.compositor-nota').textContent()) && /salud, lesiones, fármacos, suplementos o dieta/.test(await p.locator('.compositor-nota').textContent()),
      'con «Pregunta para el coach», la línea dice que contesta el coach y que es el sitio de las dudas de salud, lesiones, fármacos, suplementos o dieta');
    await p.getByLabel('Tu pregunta para el coach').fill('¿Cuántas series de aproximación hago antes de las de trabajo?');
    await p.getByRole('button', { name: 'Preguntar', exact: true }).click();
    await toast('Pregunta publicada');
    await filtro('Preguntas').click();
    const miPregunta = post('series de aproximación');
    await miPregunta.waitFor();
    check(/Pregunta para el coach/.test(await miPregunta.textContent()) && !/Respondida por el coach/.test(await miPregunta.textContent()), 'en «Preguntas», la suya, aún sin responder');
    await revisar('pregunta-071');
    // ---------------- Varias fotos
    await filtro('Todo').click();
    await post('Mi truco para la sentadilla').waitFor();
    await p.locator('input[type=file][aria-label="Fotos para la publicación"]').setInputFiles([
      { name: 'uno.png', mimeType: 'image/png', buffer: PNG }, { name: 'dos.png', mimeType: 'image/png', buffer: PNG }, { name: 'tres.png', mimeType: 'image/png', buffer: PNG }]);
    const miniaturas = p.locator('.compositor-fotos li');
    await p.waitForFunction(() => document.querySelectorAll('.compositor-fotos li').length === 3);
    check(await p.getByRole('button', { name: 'Otra foto' }).count() === 1, 'elige tres fotos (reducidas en el móvil) y aún puede añadir otra');
    await p.getByRole('button', { name: 'Quitar la foto 3' }).click();
    check(await miniaturas.count() === 2, 'quita una: quedan dos');
    await p.getByLabel('Tu publicación').fill('Dos fotos del gimnasio nuevo');
    await p.getByRole('button', { name: 'Publicar', exact: true }).click();
    await toast('Publicado en el equipo');
    const conFotos = post('Dos fotos del gimnasio nuevo');
    const galeria = conFotos.getByRole('group', { name: /^2 fotos de Ana L\./ });
    await galeria.waitFor();
    await conFotos.locator('img.post-foto').nth(1).waitFor();
    const anterior = conFotos.getByRole('button', { name: 'Foto anterior' }), siguiente = conFotos.getByRole('button', { name: 'Foto siguiente' });
    check(await conFotos.locator('img.post-foto').count() === 2 && await anterior.isDisabled() && /Foto 1 de 2/.test(await conFotos.locator('.galeria-pie .sr').textContent()),
      'la publicación sale con sus dos fotos en una galería (en la primera)');
    await siguiente.click();
    await conFotos.locator('.galeria-pie .sr', { hasText: 'Foto 2 de 2' }).waitFor();
    check(await siguiente.isDisabled() && !(await anterior.isDisabled()) && (await conFotos.locator('img.post-foto').nth(1).getAttribute('alt')) === 'Foto 2 de 2 de Ana L.',
      '«Foto siguiente» pasa a la segunda (y se anuncia «Foto 2 de 2»)');
    await revisar('galeria-071');
    // ---------------- Guardar y buscar
    // (el truco de Rubén por una frase solo suya: algunos días el entreno compartido de Carlos también lleva press banca)
    const truco = post('juntar las escápulas');
    const guardar = truco.getByRole('button', { name: 'Guardar', exact: true });
    check(await guardar.getAttribute('aria-pressed') === 'false', 'cada publicación con «Guardar»');
    await guardar.click();
    await toast('Guardada');
    await p.waitForFunction(() => [...document.querySelectorAll('article.post')].some((a) => /juntar las escápulas/.test(a.textContent) && a.querySelector('.post-guardar[aria-pressed="true"]')));
    await filtro('Guardados').click();
    await p.waitForFunction(() => document.querySelectorAll('article.post').length === 1 && /juntar las escápulas/.test(document.querySelector('article.post').textContent));
    check(true, '«Guardar» en el truco de Rubén: es lo único que sale en «Guardados»');
    await filtro('Todo').click();
    await post('Dos fotos del gimnasio nuevo').waitFor();
    const caja = p.getByRole('searchbox', { name: 'Buscar en el muro' });
    await caja.fill('PRESS banca');
    await caja.press('Enter');
    await p.locator('.busqueda-activa').waitFor();
    await p.waitForFunction(() => document.querySelectorAll('article.post').length === 1);
    check(/press banca/.test(await p.locator('article.post').textContent()) && /Resultados de «PRESS banca»/.test(await p.locator('.busqueda-activa').textContent()),
      'buscar «PRESS banca» (sin distinguir mayúsculas): sale el truco de Rubén');
    await caja.fill('Lucía');
    await caja.press('Enter');
    await p.locator('.busqueda-activa', { hasText: 'Lucía' }).waitFor();
    await p.waitForFunction(() => { const a = [...document.querySelectorAll('article.post')]; return a.length >= 1 && a.every((x) => /Lucía F\./.test(x.getAttribute('aria-label') || '')); });
    check(true, 'y por el nombre: «Lucía» da sus publicaciones');
    await p.getByRole('button', { name: 'Quitar la búsqueda' }).click();
    await p.locator('.busqueda-activa').waitFor({ state: 'detached' });
    await post('Mi truco para la sentadilla').waitFor();
    // ---------------- El coach contesta y la guarda como pregunta frecuente
    await entrarComo('Pelayo');
    await irASeccion(p, 'Equipo');
    await p.locator('.post').first().waitFor();
    await filtro('Preguntas').click();
    const pregCoach = post('series de aproximación');
    await pregCoach.waitFor();
    await pregCoach.getByRole('button', { name: /Comentar|comentario/ }).click();
    const hojaC = p.getByRole('dialog', { name: 'Comentarios' });
    await hojaC.getByLabel('Tu comentario').fill('Dos o tres, subiendo de carga hasta la de trabajo, con pocas repeticiones.');
    await hojaC.getByRole('button', { name: 'Comentar', exact: true }).click();
    const guardarFaq = hojaC.getByRole('button', { name: 'Guardar como pregunta frecuente' });
    await guardarFaq.waitFor();
    check(await hojaC.getByRole('button', { name: /como respuesta del coach$/ }).count() === 1, 'en su respuesta, «Respuesta del coach» y «Guardar como pregunta frecuente»');
    await guardarFaq.click();
    const hojaF = p.getByRole('dialog', { name: 'Guardar como pregunta frecuente' });
    check(await hojaF.getByLabel('Pregunta').inputValue() === '¿Cuántas series de aproximación hago antes de las de trabajo?' && /^Dos o tres/.test(await hojaF.getByLabel('Respuesta').inputValue())
      && /sin el nombre de quien preguntó/.test(await hojaF.textContent()), 'la hoja trae la pregunta y su respuesta (que puede retocar) y dice que va sin el nombre de quien preguntó');
    await revisar('faq-071');
    await hojaF.getByRole('button', { name: 'Guardar como pregunta frecuente' }).click();
    await toast('Guardada en «Preguntas del equipo»');
    await hojaC.locator('.comentario-equipo.mejor .insignia-mejor', { hasText: 'Respuesta del coach' }).waitFor();
    check(true, 'su comentario queda marcado como «Respuesta del coach»');
    await hojaC.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await pregCoach.locator('.chip', { hasText: 'Respondida por el coach' }).waitFor();
    await p.getByRole('tab', { name: 'Preguntas' }).click();
    await p.locator('.pregunta-equipo', { hasText: 'series de aproximación' }).waitFor();
    check(await p.locator('.pregunta-equipo').count() === 2, 'en la pestaña «Preguntas» del coach, la nueva (con la de la demo)');
    // ---------------- Lucía: ve las preguntas del equipo y cambia la mejor respuesta de su publicación
    await entrarComo('Lucía');
    await abrirEquipo();
    await p.getByRole('tab', { name: 'Preguntas' }).click();
    const faq = p.locator('.pregunta-equipo', { hasText: 'series de aproximación' });
    await faq.waitFor();
    await faq.locator('summary').click();
    await faq.getByText(/^Dos o tres, subiendo de carga/).waitFor();
    check(/Respuesta del coach/.test(await faq.textContent()) && !/Ana/.test(await faq.textContent()), 'Lucía ve la pregunta en «Preguntas» con la respuesta del coach (sin el nombre de Ana)');
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar('preguntas-071-360-oscuro');
    await p.getByRole('tab', { name: 'Muro' }).click();
    const suya = post('primera hora');
    await suya.waitFor();
    await suya.getByRole('button', { name: /comentario/ }).click();
    const hojaL = p.getByRole('dialog', { name: 'Comentarios' });
    await hojaL.locator('.comentario-equipo').first().waitFor();
    const primero = () => hojaL.locator('ul.comentarios-equipo > li').first();
    check(/Rubén M\./.test(await primero().textContent()) && /Mejor respuesta/.test(await primero().locator('.insignia-mejor').textContent()), 'en su publicación, la mejor respuesta (la de Rubén) sale primero, con su distintivo');
    await hojaL.getByRole('button', { name: 'Marcar el comentario de Carlos V. como mejor respuesta' }).click();
    await toast('Marcada como mejor respuesta');
    await hojaL.locator('ul.comentarios-equipo > li:first-child .insignia-mejor').waitFor();
    await p.waitForFunction(() => /Carlos V\./.test(document.querySelector('[role=dialog] ul.comentarios-equipo > li')?.textContent || ''));
    check(await hojaL.locator('.insignia-mejor').count() === 1, 'Lucía elige la de Carlos: ahora sale primero (y solo hay una)');
    await revisar('mejor-respuesta-071-360-oscuro');
    await hojaL.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await hojaL.waitFor({ state: 'detached' });
    await revisar('muro-071-360-oscuro');
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360
      && [...document.querySelectorAll('.compositor, .buscar-muro, .filtros-muro, .post, .galeria-post')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    check(cabe, 'a 360 px en oscuro, el compositor, la búsqueda, los filtros y el muro caben');
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
  } catch (e) {
    check(false, `v0.71: ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-comunidad-071')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-071.png', import.meta.url).pathname }).catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}
