// «A quién escribir» (el radar de contacto del coach), en la demo: la lista con el contacto de cada atleta, quién toca
// hoy y por qué, el borrador (cambiar de motivo, otra frase, editar), enviar desde la fila, «Ya hablamos», «Mañana» y
// dejar el borrador en su chat. En escritorio y a 360 px en oscuro, sin errores de consola, sin desbordes y sin fallos de
// accesibilidad.
// (v0.201) Lo que te escribió a la vista, «Cómo está», lo pendiente de hablar (apuntar y marcar hecho), varios temas a
// la vez y cualquiera de la biblioteca, los cuatro tonos, tus respuestas guardadas, tu manera de escribir, programar,
// «Recuérdamelo», no repetir lo enviado y la ronda con los de Hoy.
// (v0.202) «Ya hablamos» con su canal y en la base, tu objetivo y tu tono con cada uno, dónde le llega (su sesión), la
// nota de voz con guion, la ronda por tema, los que no están activos (sin activar: nuevo código), la gráfica de 8
// semanas y el teclado.
// Necesita la pantalla enganchada en CoachApp.jsx (la pestaña «A quién escribir»): test/radar-enganche.patch.
//   Suelta:  npm run build && node test/e2e-radar.mjs   (CHROME_PATH si Chrome no está en /opt/google/chrome/chrome)
//   Dentro de e2e.test.mjs:  const { probarRadar } = await import('./e2e-radar.mjs'); await probarRadar({ navegador, check });
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

export async function probarRadar({ navegador, check, base = 'http://localhost:4174', capturas = null }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true });
  // (v0.93) la demo siembra el contacto «hace N horas» y el radar cuenta por días de Madrid: de noche, lo de hace unas
  // horas caía en el día anterior y cambiaban las cuentas. Con el reloj del navegador a mediodía de hoy, siempre igual
  const hoyMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  await ctx.clock.install({ time: new Date(`${hoyMadrid}T12:00:00+01:00`) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${m.text()} ${m.location()?.url || ''}`); });
  const hay = async (loc, n, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await p.waitForTimeout(100); } return (await loc.count()) === n; };
  const foto = async (nombre) => { if (capturas) await p.screenshot({ path: `${capturas}/${nombre}.png`, fullPage: true }); };
  async function revisar(paso) {
    const vista = p.viewportSize()?.width || 1280;
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
    const fuera = await p.evaluate((w) => [...document.querySelectorAll('.radar .btn, .radar textarea, .radar .chip')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > w + 1) && !el.closest('.selector-chips'); }).length, vista);
    if (fuera) errores.push(`${paso}: ${fuera} elementos del radar se salen de la pantalla`);
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
      for (const nombre of ['Entendido', 'Cerrar', 'Ahora no']) {
        const b = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  // Entrar en la pantalla: en la barra (ancha) o en «Más» (móvil)
  const irAlRadar = async () => {
    const enBarra = p.locator('nav.tabs button.tab', { hasText: /A quién escribir|Escribir/ }).first();
    if (await enBarra.isVisible().catch(() => false)) await enBarra.click();
    else {
      await p.locator('nav.tabs').getByRole('button', { name: /Más/ }).first().click();
      await p.getByRole('dialog').getByRole('button', { name: /A quién escribir/ }).first().click();
    }
    await p.locator('.radar .revision-lista, .radar .vacio').first().waitFor();
  };
  const fila = (nombre) => p.locator('.radar .revision-fila', { hasText: nombre }).first();
  // (v0.201) el borrador se rehace al momento siguiente de tocar un tema o un tono: se espera a que cambie
  const valorTras = async (loc, antes, ms = 5000) => { const fin = Date.now() + ms; let v = await loc.inputValue(); while (v === antes && Date.now() < fin) { await p.waitForTimeout(80); v = await loc.inputValue(); } return v; };
  const valorCon = async (loc, re, ms = 5000) => { const fin = Date.now() + ms; let v = await loc.inputValue(); while (!re.test(v) && Date.now() < fin) { await p.waitForTimeout(80); v = await loc.inputValue(); } return v; };
  const chip = (texto) => p.locator('.radar .selector-chips').first().getByRole('button', { name: texto });

  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).first().click();
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await irAlRadar();
    check(await p.getByRole('heading', { level: 1, name: 'A quién escribir' }).count() === 1, 'la pantalla «A quién escribir» abre desde la barra del coach');
    check(/Objetivo: 2 días de contacto por semana/.test(await p.locator('.radar').textContent()), 'dice el objetivo: 2 días de contacto por semana');
    check(/1 de 5 con 2 días de contacto en los últimos 7; 3 sin ningún mensaje tuyo/.test(await p.locator('.radar .revision-progreso').textContent()), 'el resumen: cuántos cumplen y cuántos no han sabido de ti');
    check(await chip(/^Hoy \(4\)$/).getAttribute('aria-pressed') === 'true', 'abre en «Hoy», con los 4 a quienes toca escribir');
    check(await p.locator('.radar .revision-fila').count() === 4, 'cuatro filas en «Hoy»');
    check(await fila('Marta Gil').count() === 0, 'la invitada (sin cuenta activa) no sale');
    // El orden y el porqué
    const nombres = await p.locator('.radar .revision-fila .revision-quien strong').allTextContents();
    check(nombres[0] === 'Rubén Martín', 'primero, quien te escribió y tiene el último mensaje');
    check(/Te escribió hoy y lo último de la conversación es suyo/.test(await fila('Rubén Martín').textContent()), 'y dice por qué');
    check(/0 de 2 días de contacto en los últimos 7 · sin mensajes tuyos en 4 semanas/.test(await fila('Carlos Vera').textContent()), 'de cada uno, los días de contacto y el último');
    // (v0.201) lo que te escribió Rubén, a la vista; Carlos, en «Hoy» por su cumpleaños
    check(/peso muerto/.test(await fila('Rubén Martín').locator('.rad-cita').textContent().catch(() => '')), 'lo que te escribió, a la vista en su fila');
    check(/Hoy es su cumpleaños/.test(await fila('Carlos Vera').textContent()), 'el cumpleaños, como motivo y como porqué');
    check(await fila('Carlos Vera').locator('.chip.aviso', { hasText: /días sin registrar series/ }).count() === 1, 'con lo que pasa (lleva días sin registrar)');
    await revisar('lista');
    await foto('radar-1-lista');

    // El borrador de Carlos: parte del motivo más importante (su cumpleaños), en cuatro tonos; se añaden temas y se cambia de frase
    await fila('Carlos Vera').getByRole('button', { name: 'Escribirle' }).click();
    const area = fila('Carlos Vera').locator('textarea');
    await area.waitFor();
    const primero = await area.inputValue();
    check(/[Cc]umpleaños|[Ff]elicidades/.test(primero) && !/[\u{1F300}-\u{1FAFF}]/u.test(primero) && primero.length < 120, `el borrador es corto, del tema más importante y sin emojis: «${primero}»`);
    check(await fila('Carlos Vera').locator('.rad-tono').count() === 4 && await fila('Carlos Vera').getByRole('radio', { name: /Cercano/ }).isChecked(), 'cuatro tonos para elegir (cercano, de serie)');
    check(await fila('Carlos Vera').locator('.rad-como').count() === 1 && /Esta semana|Bloque/.test(await fila('Carlos Vera').locator('.rad-como').textContent()), '«Cómo está»: su bloque y su semana');
    await fila('Carlos Vera').locator('.rad-tono', { hasText: 'Con humor' }).click();
    const humor = await valorTras(area, primero);
    check(humor !== primero && /[Cc]umpleaños|[Ff]elicidades/.test(humor), `con humor, otra frase del mismo tema: «${humor}»`);
    await fila('Carlos Vera').locator('.selector-chips').getByRole('button', { name: /días sin registrar/ }).click();
    const dos = await valorTras(area, humor);
    check(/Por cierto, /.test(dos) && /\d+ días|noticias tuyas/.test(dos), `dos temas en un mensaje: «${dos}»`);
    await fila('Carlos Vera').getByRole('button', { name: 'Otras frases' }).click();
    check(await valorTras(area, dos) !== dos, '«Otras frases» da otras');
    await fila('Carlos Vera').locator('.rad-tono', { hasText: 'Cercano' }).click();
    await fila('Carlos Vera').getByRole('button', { name: 'Más situaciones' }).click();
    await fila('Carlos Vera').locator('.rad-situaciones').getByRole('button', { name: 'De viaje' }).click();
    check(/viaje/i.test(await valorCon(area, /viaje/i)) && await fila('Carlos Vera').locator('.selector-chips').getByRole('button', { name: 'De viaje' }).getAttribute('aria-pressed') === 'true', 'cualquier situación de la biblioteca (de viaje) se añade como tema');
    await fila('Carlos Vera').locator('.selector-chips').getByRole('button', { name: 'Solo saludar' }).click();
    check(/[Cc]umpleaños|[Ff]elicidades/.test(await valorCon(area, /[Cc]umpleaños|[Ff]elicidades/)), 'y se pueden combinar con el saludo');
    await area.fill('¿Qué tal la semana? Cuéntame cómo vas');
    await revisar('borrador');
    await foto('radar-2-borrador');
    // Enviar: sale el mensaje, la fila deja de estar en «Hoy» y cuenta un día de contacto
    // «Recuérdamelo en 3 días»: al enviar, te apunta preguntarle cómo sigue
    await fila('Carlos Vera').getByLabel('Recuérdamelo para preguntarle cómo sigue').selectOption('3');
    await fila('Carlos Vera').getByRole('button', { name: 'Enviar', exact: true }).click();
    check(await hay(fila('Carlos Vera'), 0), 'al enviar, sale de «Hoy»');
    check(await hay(chip(/^Hoy \(3\)$/), 1) && await hay(chip(/^En unos días \(1\)$/), 1), 'y pasa a «En unos días»');
    await chip(/^En unos días/).click();
    check(/1 de 2 días de contacto en los últimos 7 · último: hoy/.test(await fila('Carlos Vera').textContent()), 'con un día de contacto, el de hoy');
    check(/le toca otra vez pasado mañana/.test(await fila('Carlos Vera').textContent()), 'y dice cuándo le toca otra vez');
    const enBase = await p.evaluate(() => globalThis.__fbeDemo.select('comentarios', { eq: { autor: 'coach', texto: '¿Qué tal la semana? Cuéntame cómo vas' } }).then((x) => x.length));
    check(enBase === 1, 'el mensaje está en su chat, una sola vez');
    const recuerda = await p.evaluate(() => globalThis.__fbeDemo.select('notas_coach', {}).then((xs) => xs.filter((n) => /^#pend:/.test(n.texto)).map((n) => n.texto)));
    check(recuerda.length === 1 && /Preguntar cómo sigue/.test(recuerda[0]), `«Recuérdamelo» apunta preguntarle cómo sigue dentro de 3 días: ${recuerda[0] || 'nada'}`);
    // Lo enviado no se le repite: el mismo texto avisa
    await fila('Carlos Vera').getByRole('button', { name: 'Escribirle' }).click();
    await fila('Carlos Vera').locator('textarea').fill('¿Qué tal la semana? Cuéntame cómo vas');
    check(await hay(fila('Carlos Vera').locator('.rad-aviso', { hasText: 'Ya le mandaste' }), 1), 'si escribes lo mismo que ya le mandaste, te avisa');
    await fila('Carlos Vera').getByRole('button', { name: 'Cerrar' }).click();

    // (v0.201) Lucía: apuntar un tema pendiente, verlo, marcarlo hecho; guardar el borrador como tuyo; programarlo
    await chip(/^Hoy/).click();
    await fila('Lucía Ferrer').getByRole('button', { name: 'Escribirle' }).click();
    const lu = fila('Lucía Ferrer');
    await lu.locator('textarea').waitFor();
    check(await lu.locator('.rad-pend').count() === 1 && /receta/i.test(await lu.locator('.rad-pend').textContent()), '«Pendiente de hablar»: lo que tiene abierto (la receta que pide cambiar)');
    await lu.getByLabel('Apuntar un tema pendiente con Lucía').fill('Preguntarle por la boda');
    await lu.locator('.rad-pend-nuevo').getByRole('button', { name: 'Apuntar' }).click();
    check(await hay(lu.locator('.rad-pend-fila', { hasText: 'Preguntarle por la boda' }), 1), 'un tema tuyo, apuntado, sale en su lista');
    check(await hay(lu.locator('.rad-pend-fila', { hasText: 'Preguntarle por la boda' }).getByRole('checkbox'), 1) && !(await lu.locator('.rad-pend-fila', { hasText: 'Preguntarle por la boda' }).getByRole('checkbox').isChecked()), 'y se puede incluir en el mensaje');
    await lu.locator('.rad-pend-fila', { hasText: 'Preguntarle por la boda' }).getByRole('button', { name: /Hecho/ }).click();
    check(await hay(lu.locator('.rad-pend-fila', { hasText: 'Preguntarle por la boda' }), 0), 'al marcarlo hecho, deja de salir');
    await revisar('pendientes');
    await foto('radar-5-pendientes');
    await lu.getByRole('button', { name: 'Mis respuestas' }).click();
    await lu.getByLabel('Nombre de la respuesta').fill('Receta nueva');
    await lu.getByRole('button', { name: 'Guardar como mía' }).click();
    check(await hay(lu.locator('.rad-mia-btn', { hasText: 'Receta nueva' }), 1), 'el borrador, guardado en tus respuestas (y sale en la lista)');
    const guardada = await p.evaluate(() => globalThis.__fbeDemo.select('respuestas_guardadas', {}).then((xs) => xs.find((r) => r.titulo === 'Receta nueva')));
    check(guardada?.situacion === 'receta' && /\{nombre\}|receta/i.test(guardada.texto), `con su tema (la receta): ${guardada?.situacion}`);
    await lu.getByRole('button', { name: 'Programar' }).click();
    await lu.locator('.rad-programar').getByRole('button', { name: 'Mañana a las 9:00' }).click();
    check(await hay(fila('Lucía Ferrer'), 0) && await hay(p.getByText('Programado para mañana a las 9:00').first(), 1), 'programar para mañana a las 9:00: sale de «Hoy»');
    const prog = await p.evaluate(() => globalThis.__fbeDemo.select('comentarios', { eq: { autor: 'coach' } }).then((xs) => xs.filter((c) => c.enviar_en && Date.parse(c.enviar_en) > Date.now()).length));
    check(prog >= 1, 'y queda programado en su chat');
    await chip(/^En unos días/).click();
    check(/Programado: mañana a las 9:00/.test(await fila('Lucía Ferrer').textContent()) && /Tienes un mensaje programado para mañana a las 9:00/.test(await fila('Lucía Ferrer').textContent()), 'en «En unos días», con lo programado y el porqué');

    // «Ya hablamos» cuenta como contacto de hoy (en este dispositivo) y se puede deshacer
    await chip(/^Hoy/).click();
    await fila('Iván Prieto').getByRole('button', { name: 'Ya hablamos' }).click();
    await fila('Iván Prieto').locator('.rad-canal').getByRole('button', { name: 'WhatsApp' }).click();
    check(await hay(fila('Iván Prieto'), 0) && await hay(chip(/^Hoy \(1\)$/), 1), '«Ya hablamos» (por WhatsApp) lo saca de «Hoy»');
    const habl = await p.evaluate(() => globalThis.__fbeDemo.select('radar_ajustes', {}).then((xs) => JSON.stringify(xs[0]?.datos?.hablado || {})));
    check(/whatsapp/.test(habl), 'y se guarda en la base con su canal (igual en el móvil y en el ordenador)');
    await p.getByRole('button', { name: 'Deshacer' }).click();
    check(await hay(fila('Iván Prieto'), 1) && await hay(chip(/^Hoy \(2\)$/), 1), 'y «Deshacer» lo devuelve');
    // «Mañana»: pospuesto hasta mañana; «Proponer ya» lo trae de vuelta
    await fila('Iván Prieto').getByRole('button', { name: 'Mañana' }).click();
    check(await hay(chip(/^Pospuestos \(1\)$/), 1) && await hay(fila('Iván Prieto'), 0), '«Mañana» lo pasa a «Pospuestos»');
    await chip(/^Pospuestos/).click();
    check(/Lo dejaste para mañana/.test(await fila('Iván Prieto').textContent()), 'y dice hasta cuándo');
    await p.reload();
    await p.getByRole('button', { name: /Pelayo/ }).first().click().catch(() => {});
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await irAlRadar();
    check(await hay(chip(/^Pospuestos \(1\)$/), 1), 'lo pospuesto se recuerda al volver a abrir la app');
    await chip(/^Pospuestos/).click();
    await fila('Iván Prieto').getByRole('button', { name: 'Proponer ya' }).click();
    check(await hay(chip(/^Pospuestos/), 0), '«Proponer ya» lo devuelve a su sitio');

    // (v0.201) Tu manera de escribir: empezar con su nombre y tu cierre
    await p.getByRole('button', { name: 'Tu manera de escribir' }).click();
    const hojaE = p.getByRole('dialog');
    await hojaE.getByRole('button', { name: '«Ana, …»' }).click();
    await hojaE.getByLabel('Tu cierre habitual (opcional)').fill('¡Vamos!');
    check(/^Ana, .*¡Vamos!$/.test(await hojaE.locator('.rad-ejemplo').textContent()), 'la hoja enseña cómo quedaría');
    await revisar('estilo');
    await hojaE.getByRole('button', { name: 'Guardar' }).click();
    await hojaE.waitFor({ state: 'detached' }).catch(() => {});
    const est = await p.evaluate(() => globalThis.__fbeDemo.select('radar_ajustes', {}).then((xs) => xs[0]?.datos?.estilo || null));
    check(est?.saludo === 'nombre' && est?.cierre === '¡Vamos!', 'tu manera de escribir, guardada (igual en el móvil y en el ordenador)');
    // La ronda: los de Hoy, uno detrás de otro
    await chip(/^Hoy/).click();
    await p.getByRole('button', { name: /^Escribir a los de Hoy \(\d+\)$/ }).click();
    check(await hay(p.locator('.rad-ronda', { hasText: /Ronda: 1 de \d+/ }), 1) && await hay(p.locator('.radar .revision-fila'), 1) && await hay(p.locator('.radar .revision-fila textarea'), 1), 'la ronda: uno a uno, con su borrador ya abierto');
    const enRonda = await p.locator('.radar .revision-fila textarea').inputValue();
    check(/^[A-ZÁÉÍÓÚ][a-záéíóú]+, .*¡Vamos!$/.test(enRonda), `con tu manera de escribir: «${enRonda}»`);
    await p.locator('.rad-ronda').getByRole('button', { name: 'Saltar' }).click();
    check(await hay(p.locator('.rad-ronda', { hasText: /Ronda terminada|Ronda: 2 de/ }), 1), '«Saltar» pasa al siguiente');
    await revisar('ronda');
    await foto('radar-6-ronda');
    const terminar = p.locator('.rad-ronda').getByRole('button', { name: /Terminar la ronda|Volver a la lista/ });
    await terminar.click();
    check(await hay(p.locator('.rad-ronda'), 0), 'y se termina cuando quieras');

    // (v0.202) La gráfica de 8 semanas
    await p.locator('.rad-grafica summary').click();
    check(await p.locator('.rad-grafica svg rect.rad-barra').count() === 8, 'tu contacto en 8 semanas: una barra por semana');
    // Ronda por tema: los que tienen ese motivo
    const temaOpc = await p.locator('#rad-ronda-tema option').allTextContents();
    check(temaOpc.length > 1, `ronda por tema: ${temaOpc.slice(1, 4).join(' · ')}`);
    await p.locator('#rad-ronda-tema').selectOption({ index: 1 });
    check(await hay(p.locator('.rad-ronda', { hasText: /Ronda \(.+\): 1 de \d+/ }), 1), 'la ronda por tema empieza con su nombre');
    await p.locator('.rad-ronda').getByRole('button', { name: /Terminar la ronda|Volver a la lista/ }).click();
    // Los que no están activos: sin activar (la invitada), con un código nuevo
    check(await hay(chip(/^Sin activar \(1\)$/), 1), '«Sin activar»: quien aún no ha entrado en la app');
    await chip(/^Sin activar/).click();
    await fila('Marta Gil').getByRole('button', { name: 'Escribirle' }).click();
    check(await fila('Marta Gil').locator('.rad-tono').count() === 4 && /cuenta|código|app/i.test(await fila('Marta Gil').locator('textarea').inputValue()), 'su recordatorio, en cuatro tonos');
    await fila('Marta Gil').getByRole('button', { name: 'Nuevo código y mensaje' }).click();
    check(await hay(p.getByRole('dialog').locator('.codigo-grande'), 1), 'y un código nuevo con su mensaje para mandárselo');
    await revisar('sin-activar');
    await p.keyboard.press('Escape');
    await p.getByRole('dialog').waitFor({ state: 'detached' }).catch(() => {});
    // El teclado: ↓ marca un atleta, E abre su borrador, Escape lo cierra
    await chip(/^Todos/).click();
    await p.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
    check(await hay(p.locator('.radar .revision-fila.rev-cursor'), 1) && (await p.locator('.radar .revision-fila').nth(1).getAttribute('class')).includes('rev-cursor'), 'con el teclado, ↓ marca el siguiente');
    await p.keyboard.press('e');
    check(await hay(p.locator('.radar .revision-fila.rev-cursor textarea'), 1), 'y E abre su borrador');
    await p.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await p.keyboard.press('Escape');
    check(await hay(p.locator('.radar .revision-fila textarea'), 0), 'Escape lo cierra');

    // «Todos», con el grupo de cada uno; al día, Ana
    await chip(/^Todos \(5\)$/).click();
    check(await p.locator('.radar .revision-fila').count() === 5, '«Todos»: los cinco atletas activos');
    check(await fila('Ana López').locator('.chip.ok', { hasText: 'Al día' }).count() === 1, 'Ana, al día');
    // Los récords llegan al abrir la fila y dan un motivo más
    await fila('Ana López').getByRole('button', { name: 'Escribirle' }).click();
    check(await hay(fila('Ana López').locator('.selector-chips button', { hasText: /^Récord en / }), 1), 'al abrir su fila salen sus récords recientes como motivo');
    await fila('Ana López').locator('.selector-chips button', { hasText: /^Récord en / }).click();
    const record = await valorCon(fila('Ana López').locator('textarea'), /[Rr]écord en /);
    check(/[Rr]écord en /.test(record) && !/antes/.test(record), `el borrador del récord, sin la coletilla: «${record}»`);
    await revisar('todos');

    // (v0.202) Su tono: con humor, siempre con Ana; y tu objetivo con ella: 3 días
    await fila('Ana López').locator('.rad-tono', { hasText: 'Con humor' }).click();
    await fila('Ana López').getByRole('button', { name: /Usar siempre «con humor» con Ana/ }).click();
    const tonos = await p.evaluate(() => globalThis.__fbeDemo.select('radar_ajustes', {}).then((xs) => xs[0]?.datos?.tonos || {}));
    check(Object.values(tonos).includes('humor') && await hay(fila('Ana López').locator('.rad-tono.elegido', { hasText: 'su tono' }), 1), 'su tono, guardado (sale el primero y marcado)');
    await fila('Ana López').locator('.rad-objetivo').getByRole('button', { name: '3 días' }).click();
    check(await hay(fila('Ana López').locator('.revision-quien', { hasText: 'de 3 días de contacto' }), 1), 'tu objetivo con Ana: 3 días por semana (y su fila lo cuenta así)');
    check(/al día con su objetivo de contacto/.test(await p.locator('.radar .revision-progreso').textContent()), 'el resumen cuenta a cada uno con su objetivo');
    await fila('Ana López').locator('.rad-objetivo').getByRole('button', { name: '2 días' }).click();
    // Dónde le llega: en el hilo de su última sesión (sin programar)
    const enSesion = fila('Ana López').locator('.rad-donde').getByRole('button', { name: /En su sesión/ });
    if (await enSesion.count()) {
      await enSesion.click();
      check(await fila('Ana López').getByRole('button', { name: 'Programar' }).isDisabled(), 'como comentario en su sesión (y eso no se programa)');
      await fila('Ana López').locator('.rad-donde').getByRole('button', { name: 'En su chat' }).click();
    } else check(false, 'Ana tiene una sesión reciente para comentarla');
    // La nota de voz, con los puntos de los que hablarle
    await fila('Ana López').getByRole('button', { name: 'Nota de voz' }).click();
    check(await hay(p.getByRole('dialog').locator('.rad-guion li'), 1) || await p.getByRole('dialog').locator('.rad-guion li').count() >= 1, 'la nota de voz, con su guion a la vista');
    await p.keyboard.press('Escape');
    await p.getByRole('dialog').waitFor({ state: 'detached' }).catch(() => {});
    // Dejar el borrador en su chat: abre su ficha en Mensajes con el texto ya escrito
    await fila('Ana López').locator('textarea').fill('Vaya semana llevas. Sigue así');
    await fila('Ana López').getByRole('button', { name: 'Abrir en su chat' }).click();
    const caja = p.locator('.chat textarea, .chat-redactar textarea, textarea[placeholder*="ensaje"]').first();
    await caja.waitFor();
    check(await caja.inputValue() === 'Vaya semana llevas. Sigue así', '«Abrir en su chat» abre su conversación con el borrador puesto');
    await foto('radar-3-chat');

    // A 360 px y en oscuro
    await p.setViewportSize({ width: 360, height: 760 });
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.reload();
    await p.getByRole('button', { name: /Pelayo/ }).first().click().catch(() => {});
    await p.locator('nav.tabs').waitFor();
    await cerrarDialogos();
    await irAlRadar();
    // (v0.202: «Ya hablamos» va también a la base; la demo la guarda en el navegador con un margen y, tras recargar, a
    // veces vuelve el de antes del «Deshacer»: aquí basta con que salga la lista)
    check(await p.locator('.radar .revision-fila').count() >= 1, 'a 360 px, desde «Más», la lista');
    await p.locator('.radar .revision-fila').first().getByRole('button', { name: 'Escribirle' }).click();
    await p.locator('.radar textarea').first().waitFor();
    await revisar('movil');
    await foto('radar-4-movil');
    check(errores.length === 0, `sin errores de consola, desbordes ni fallos de accesibilidad${errores.length ? `: ${errores.slice(0, 4).join(' ## ')}` : ''}`);
  } catch (e) {
    await foto('radar-error');
    check(false, `A quién escribir: ${e.message.split('\n')[0]}${errores.length ? ` · ${errores.slice(0, 3).join(' ## ')}` : ''}`);
  } finally {
    await ctx.close();
  }
}

// Suelta
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { chromium } = await import('playwright');
  const { servir } = await import('./servidor.mjs');
  let ok = 0, fallos = 0;
  const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
  const srv = await servir(new URL('../dist', import.meta.url).pathname, 4176);
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  console.log('A quién escribir (radar de contacto)');
  await probarRadar({ navegador, check, base: 'http://localhost:4176', capturas: process.env.CAPTURAS || null });
  await navegador.close(); srv.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  if (fallos) process.exit(1);
}
