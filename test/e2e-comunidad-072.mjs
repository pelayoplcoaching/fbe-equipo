// v0.72: la comunidad, cuarta tanda (migración 044), en la demo, a tamaño de móvil. Lo llama e2e.test.mjs.
//   · el coach crea un evento; Lucía se apunta desde «Próximos» y descarga su .ics;
//   · un aviso programado: el coach lo ve en «Programados»; Lucía no lo ve hasta su hora (se simula cambiando su hora en la demo);
//   · una plantilla (guardar y usar);
//   · el panel de la comunidad y el atleta de la semana (su tarjeta arriba del muro);
//   · silenciar a Carlos 24 h (ve la línea, sin compositor) y una palabra filtrada (Lucía: «pendiente de revisión»);
//   · 360 px en oscuro, sin fallos de accesibilidad.
import { createRequire } from 'node:module';
import { irASeccion } from './secciones.mjs';
import { readFileSync } from 'node:fs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarComunidad072({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true, acceptDownloads: true });
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
  const toast = (texto) => p.locator('.toast', { hasText: texto }).first().waitFor();
  const post = (texto) => p.locator('article.post', { hasText: texto });
  const PROGRAMADO = 'Mañana, sesión especial de movilidad: traed esterilla';

  try {
    await p.goto(`${base}/?demo`);
    // ---------------- El coach: un evento nuevo
    await entrarComo('Pelayo');
    await abrirEquipo();
    const proximos = p.locator('section.proximos');
    await proximos.getByText('Quedada en el parque').waitFor();
    await proximos.getByRole('button', { name: 'Nuevo evento' }).click();
    const hojaEv = p.getByRole('dialog', { name: 'Nuevo evento' });
    await hojaEv.getByLabel('Título').fill('Movilidad en el Retiro');
    await hojaEv.getByLabel('Hora').fill('18:30');
    await hojaEv.getByLabel('Sitio o enlace').fill('Parque del Retiro, junto al estanque');
    await hojaEv.getByLabel('Plazas (opcional)').fill('10');
    await revisar('evento-nuevo-072');
    await hojaEv.getByRole('button', { name: 'Crear el evento' }).click();
    await toast('Evento creado');
    await proximos.getByText('Movilidad en el Retiro').waitFor();
    await p.locator('article.evento-equipo', { hasText: 'Movilidad en el Retiro' }).waitFor();
    check(await proximos.locator('.pr-item').count() === 2, 'el coach crea un evento: sale en «Próximos» (con la quedada de la demo) y como tarjeta en el muro');
    // ---------------- Un aviso programado
    await p.getByLabel('Aviso para el equipo').fill(PROGRAMADO);
    await p.getByRole('button', { name: 'Programar', exact: true }).click();
    const hojaProg = p.getByRole('dialog', { name: 'Programar el aviso' });
    await hojaProg.getByRole('button', { name: 'Mañana, 8:00' }).click();
    await hojaProg.getByRole('button', { name: 'Programar el aviso' }).click();
    await toast('Aviso programado');
    const programados = p.locator('section.programados');
    await programados.getByText(PROGRAMADO).waitFor();
    check(/Programados \(1\)/.test(await programados.textContent()) && /sale el .*8:00/.test(await programados.textContent()) && await post(PROGRAMADO).count() === 0,
      'el coach programa un aviso para mañana a las 8:00: sale en «Programados», no en el muro');
    // ---------------- Una plantilla
    await p.getByLabel('Aviso para el equipo').fill('Recordad estirar al acabar cada sesión');
    await p.getByRole('button', { name: 'Guardar como plantilla' }).click();
    await toast('Guardado como plantilla');
    await p.getByLabel('Aviso para el equipo').fill('');
    await p.getByRole('button', { name: 'Usar plantilla' }).click();
    const hojaPl = p.getByRole('dialog', { name: 'Plantillas de avisos' });
    await hojaPl.getByText('Recordad estirar al acabar cada sesión').waitFor();
    await revisar('plantillas-072');
    await hojaPl.getByRole('button', { name: 'Usar la plantilla 1' }).click();
    check(await p.getByLabel('Aviso para el equipo').inputValue() === 'Recordad estirar al acabar cada sesión', 'guarda una plantilla y la usa: rellena el aviso');
    await p.getByRole('button', { name: 'Publicar ahora' }).click();
    await post('Recordad estirar al acabar').waitFor();
    // ---------------- Silenciar a Carlos desde su publicación
    const deCarlos = post('Vuelvo después de dos semanas');
    await deCarlos.getByRole('button', { name: 'Opciones de la publicación' }).click();
    await p.getByRole('dialog', { name: 'Publicación' }).getByRole('button', { name: 'Silenciar a Carlos V.' }).click();
    const hojaSil = p.getByRole('dialog', { name: 'Silenciar a Carlos V.' });
    await hojaSil.getByRole('button', { name: 'Silenciar 24 h' }).click();
    await toast('Carlos V. no podrá publicar ni comentar');
    check(true, 'silencia a Carlos 24 h desde una publicación suya');
    // ---------------- El panel y el atleta de la semana
    await p.getByRole('tab', { name: 'Panel' }).click();
    const panel = p.locator('.panel-comunidad');
    await panel.locator('table.pc-tabla').waitFor();
    check(await panel.locator('table.pc-tabla thead th').count() === 5 && /Ana López/.test(await panel.textContent()) && /Los más activos/.test(await panel.textContent()),
      'el panel: las 4 últimas semanas en recuentos, quién no ha entrado nunca (Ana) y los más activos');
    await panel.getByRole('button', { name: 'Elegir', exact: true }).click();
    const hojaDs = p.getByRole('dialog', { name: 'Atleta de la semana' });
    await hojaDs.getByLabel('Quién').selectOption({ label: 'Lucía F.' });
    await hojaDs.getByLabel('Por qué (una línea)').fill('Por no fallar ni un día');
    await revisar('destacar-072');
    await hojaDs.getByRole('button', { name: /Elegir/ }).click();
    await toast('Atleta de la semana elegido');
    await panel.locator('.destacado-semana', { hasText: 'Lucía F.' }).waitFor();
    // ---------------- Una palabra filtrada
    await p.getByRole('tab', { name: 'Moderar' }).click();
    await p.getByRole('textbox', { name: /^Palabras filtradas/ }).fill('agujetazo');
    await p.getByRole('button', { name: 'Guardar', exact: true }).click();
    await toast('Moderación guardada');
    await p.locator('.moderar .silenciados, .moderar').getByText('Carlos V.').first().waitFor();
    await revisar('moderar-072');
    check(true, 'el coach elige a Lucía atleta de la semana y filtra una palabra (Carlos sale entre los silenciados)');
    // ---------------- Lucía: el atleta de la semana, el evento y su .ics, lo programado y la palabra filtrada
    await entrarComo('Lucía');
    await abrirEquipo();
    const tarjeta = p.locator('.destacado-semana');
    await tarjeta.waitFor();
    check(/Atleta de la semana/.test(await tarjeta.textContent()) && /Lucía F\./.test(await tarjeta.textContent()) && /Por no fallar ni un día/.test(await tarjeta.textContent())
      && (await tarjeta.getAttribute('aria-label')) === 'Atleta de la semana: Lucía F. · Por no fallar ni un día', 'arriba del muro, la tarjeta «Atleta de la semana: Lucía F. · Por no fallar ni un día»');
    check(await post(PROGRAMADO).count() === 0, 'lo programado no lo ve hasta su hora');
    await p.locator('section.proximos').getByRole('button', { name: /Movilidad en el Retiro/ }).click();
    const hojaVer = p.getByRole('dialog', { name: 'Evento' });
    await hojaVer.getByRole('button', { name: 'Me apunto' }).click();
    await toast('¡Apuntado!');
    await hojaVer.getByRole('button', { name: 'Vas' }).waitFor();
    check(/Va Lucía F\./.test(await hojaVer.textContent()) && /9 plazas libres/.test(await hojaVer.textContent()), 'Lucía se apunta: «Va Lucía F.» y quedan 9 plazas');
    await revisar('evento-072');
    const [descarga] = await Promise.all([p.waitForEvent('download'), hojaVer.getByRole('button', { name: 'Añadir al calendario' }).click()]);
    const ics = readFileSync(await descarga.path(), 'utf8');
    check(/\.ics$/.test(descarga.suggestedFilename()) && /SUMMARY:Movilidad en el Retiro/.test(ics) && /T183000/.test(ics) && /LOCATION:Parque del Retiro/.test(ics) && /TRIGGER:-PT120M/.test(ics),
      '«Añadir al calendario» descarga su .ics (a las 18:30, con el sitio y un aviso 2 h antes)');
    await hojaVer.getByRole('button', { name: 'Cerrar' }).click();
    await hojaVer.waitFor({ state: 'detached' });
    // (llega su hora: se simula adelantándola en la demo, que se guarda en este navegador)
    await p.waitForTimeout(500);
    await p.evaluate((texto) => {
      const db = JSON.parse(localStorage.getItem('fbe-demo-v2'));
      const x = db.comunidad_posts.find((k) => k.texto === texto);
      x.publicar_en = x.creado_en = new Date(Date.now() - 60000).toISOString();
      localStorage.setItem('fbe-demo-v2', JSON.stringify(db));
    }, PROGRAMADO);
    await p.reload();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await abrirEquipo();
    await post(PROGRAMADO).waitFor();
    check(true, 'llegada su hora, Lucía ve el aviso programado en el muro');
    await p.getByLabel('Tu publicación').fill('Qué agujetazo tengo hoy, madre mía');
    await p.getByRole('button', { name: 'Publicar', exact: true }).click();
    await toast('Tu publicación está pendiente de revisión');
    const retenida = post('Qué agujetazo tengo hoy');
    await retenida.waitFor();
    check(/Tu publicación está pendiente de revisión/.test(await retenida.textContent()), 'con una palabra filtrada, su publicación queda «pendiente de revisión» (solo la ve ella)');
    // ---------------- Carlos, silenciado: lee, sin compositor; no ve lo retenido
    await entrarComo('Carlos');
    await abrirEquipo();
    await p.locator('.silencio-linea').waitFor();
    check(/Tu coach ha pausado tus publicaciones y comentarios hasta el/.test(await p.locator('.silencio-linea').textContent()) && await p.getByLabel('Tu publicación').count() === 0
      && await post('Qué agujetazo tengo hoy').count() === 0, 'Carlos, silenciado: una línea tranquila en lugar del compositor, y no ve lo retenido de Lucía');
    // ---------------- 360 px en oscuro
    await p.setViewportSize({ width: 360, height: 740 });
    await p.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    await revisar('silenciado-072-360-oscuro');
    await entrarComo('Pelayo');
    await abrirEquipo();
    await revisar('muro-coach-072-360-oscuro');
    await p.getByRole('tab', { name: 'Panel' }).click();
    await p.locator('table.pc-tabla').waitFor();
    await revisar('panel-072-360-oscuro');
    const cabe = await p.evaluate(() => document.documentElement.scrollWidth <= 360
      && [...document.querySelectorAll('.proximos, .panel-comunidad > *, .destacado-semana')].every((el) => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= 361); }));
    check(cabe, 'a 360 px en oscuro, «Próximos», el panel y la tarjeta del atleta de la semana caben');
    await p.setViewportSize({ width: 390, height: 844 });
    await p.emulateMedia({ colorScheme: null, reducedMotion: null });
  } catch (e) {
    check(false, `v0.72: ${e.message.split('\n').slice(0, 6).join(' ')} | en: ${(e.stack || '').split('\n').find((l) => l.includes('e2e-comunidad-072')) || '?'}`);
    await p.screenshot({ path: new URL('./e2e-fallo-072.png', import.meta.url).pathname }).catch(() => {});
  }
  check(!errores.length, `sin errores ni fallos de accesibilidad${errores.length ? `: ${errores.join(' | ').slice(0, 900)}` : ''}`);
  await ctx.close();
}
