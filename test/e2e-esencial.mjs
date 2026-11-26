// FBE Esencial (tandas 1 y 2), en la demo ?demo=esencial. Lo llama e2e.test.mjs.
//   · Marina (390 px): la bienvenida sin «Habla con tu coach»; en Hoy, «Rellena tu cuestionario»; lo rellena (cribado
//     limpio) y la app le pone «Primeras 4 semanas»: su sesión con «Te sobran 4-5» y la plancha en segundos; apunta una serie.
//   · Clara: su visto bueno, en revisión. Tomás: sus marcas de la semana 4 y (tanda 3) su plan desde la semana 5, solo.
//   · Inés (tanda 4, con nutrición; v0.252, con el cuestionario de nutrición del motor): en Hoy, «Tu plan de comida»;
//     contesta los siete pasos, ve su plan y lo guarda: «Nutrición de hoy» y el toque de cada día.
//   · Inés (alta, tanda 3): su primera semana: la guía de la primera sesión, «¿Qué peso pongo?», «Tu primera sesión, hecha»,
//     «Semana 1 hecha»; en Perfil, sin «Mensajes con tu coach» y con sus preguntas frecuentes; la nota de su check-in.
//   · El coach (1280 px): el chip «Esencial» en la lista; en la ficha de Clara (Datos), «Confirmar visto bueno» y su plan;
//     sin la pestaña Mensajes; «Añadir atleta» de FBE Esencial con su mensaje de invitación.
//   · Tomás (sin coach, 20): recorre la app entera abriendo cada fila y cada hoja: ni rastro de «tu coach»; sus avisos al
//     móvil, el check-in con una molestia («Qué pasa ahora con tu check-in» y qué hacer) y «Más» en la sesión.
//   · Tomás (sin coach, tanda 2; 098), con el reloj en el domingo: la pausa («Esta semana no puedo» y «Volver ya») y, desde
//     las 21:00, la pregunta: repetir esta semana o pasar a la siguiente.
//   Sin errores ni desbordes.
import { devices } from 'playwright';

export async function probarEsencial({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const vigilar = (p) => {
    p.setDefaultTimeout(10000);
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|blob:|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  };
  const cerrar = async (p) => {
    for (let i = 0; i < 6; i++) {
      const b = p.locator('[aria-modal="true"] button:has-text("Seguir"), [aria-modal="true"] button:has-text("Cerrar"), [aria-modal="true"] button:has-text("Vale"), [aria-modal="true"] .hoja-cerrar').first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await p.waitForTimeout(400); } else break;
    }
  };
  // (la demo guarda su base 150 ms después del último cambio: antes de cambiar de cuenta, se espera a que esté guardada; si
  // se pasa lo que tiene que estar, como el código recién creado, hasta que esté)
  const salirDeLaCuenta = async (p, debeIncluir = null) => {
    if (debeIncluir) await p.waitForFunction((c) => (localStorage.getItem('fbe-demo-esencial-v2') || '').includes(c), debeIncluir, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(400);
    await p.evaluate(() => { localStorage.removeItem('fbe-demo-esencial-v2-sesion'); });
  };
  const desborda = async (p, paso) => { const w = p.viewportSize()?.width || 390; const a = await p.evaluate(() => document.documentElement.scrollWidth); if (a > w) errores.push(`${paso}: la página se desborda (${a} > ${w})`); };
  const movil = async () => {
    const ctx = await navegador.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('fbe-escena-200', '1'); } catch { /* sin almacenamiento */ } });
    const p = await ctx.newPage();
    vigilar(p);
    return { ctx, p };
  };
  const entrar = async (p, quien) => {
    await p.goto(`${base}/?demo=esencial`);
    await p.getByRole('button', { name: quien }).first().click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.waitForTimeout(800);
  };
  // La sesión de la semana 1 de «Primeras 4 semanas», desde Hoy: «te sobran» en la portada y en los ejercicios, la plancha
  // en segundos y sin la conversación con el coach
  const probarSesion = async (p, quien) => {
    check(/Esta semana:/.test(await p.locator('.hero-dia').first().textContent().catch(() => '')), 'la nota de la semana, «Esta semana:» (no «Tu coach:»)');
    await p.getByRole('button', { name: /Empezar sesión/ }).first().click();
    // La portada de la sesión: el esfuerzo explicado con «te sobran» (no «RIR 2»)
    const portada = p.locator('.portada-vista');
    if (await portada.waitFor({ timeout: 10000 }).then(() => true).catch(() => false)) {
      const tPor = await portada.textContent();
      check(!/«RIR 2»/.test(tPor) && !/las pesadas/.test(tPor), 'la portada de la sesión, sin «RIR 2» ni «las pesadas» (semana de aprender)');
      await portada.getByRole('button', { name: /^\s*Empezar\s*$/ }).last().click();
    }
    await p.locator('article.ejercicio, .enfoque').first().waitFor({ timeout: 15000 }).catch(async (e) => {
      if (process.env.FBE_CAPTURAS) await p.screenshot({ path: `${process.env.FBE_CAPTURAS}/esencial-sesion.png` });
      throw e;
    });
    const tSes = await p.locator('main').first().textContent();
    check(/Te sobran 4-5/.test(tSes) && /20–30 s/.test(tSes), `la sesión (${quien}): «Te sobran 4-5» y la plancha en segundos`);
    check(!/Comentarios con tu coach/.test(tSes), 'sin «Comentarios con tu coach»');
    await desborda(p, `la sesión de ${quien}`);
  };

  // ---------------------------------------------------------------- Marina: del cuestionario a su semana 1
  {
    const { ctx, p } = await movil();
    await entrar(p, /Marina/);
    const bienv = p.locator('.bienvenida');
    if (await bienv.isVisible().catch(() => false)) {
      check(/Aquí tendrás tu plan/.test(await bienv.textContent()), 'la bienvenida de quien va por su cuenta: «Aquí tendrás tu plan», sin hablar con su coach');
      for (let i = 0; i < 3; i++) { await bienv.getByRole('button', { name: /Siguiente/ }).click().catch(() => {}); await p.waitForTimeout(250); }
      check(!/Habla con tu coach/.test(await p.locator('body').textContent()), '(ninguna pantalla dice «Habla con tu coach»)');
      await bienv.getByRole('button', { name: /Saltar|Empezar|Vamos|Listo/ }).first().click().catch(() => {});
      await p.waitForTimeout(400);
    }
    await cerrar(p);
    const hero = p.locator('section.hero-espera');
    await hero.first().waitFor({ timeout: 15000 }).catch(() => {});
    check(/Rellena tu cuestionario/.test(await hero.first().textContent().catch(() => '')), 'en Hoy, sin plan: «Rellena tu cuestionario» (no «tu coach lo publicará»)');
    await desborda(p, 'Hoy de Marina');
    await hero.getByRole('button', { name: /Empezar|Seguir/ }).click();
    const hoja = p.locator('[aria-modal="true"]').last();
    await hoja.getByRole('button', { name: 'Siguiente' }).waitFor();
    check(!/Cuéntalo con tus palabras/.test(await hoja.textContent()) && /Para saber qué buscas/.test(await hoja.textContent()), 'su cuestionario, más corto (sin «Cuéntalo con tus palabras») y con por qué se pregunta');
    await hoja.locator('.opciones button, [role="group"] button').first().click();   // un objetivo
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(300);
    check(/Guardado/.test(await hoja.locator('.alta-guardado').textContent().catch(() => '')) && /la app elige tu plan/.test(await hoja.textContent()) && !/otro deporte/.test(await hoja.textContent()),
      'cada paso, «Guardado»; sin «¿Haces otro deporte?»');
    // Experiencia, días y minutos: la primera opción de cada grupo (nunca ha entrenado, 1 día…) y, después, 3 días
    const grupos2 = hoja.locator('[role="group"]');
    for (let i = 0; i < await grupos2.count(); i++) await grupos2.nth(i).locator('button').first().click().catch(() => {});
    await hoja.getByRole('group', { name: 'Días a la semana' }).getByRole('button', { name: '3', exact: true }).click();
    check(/Empiezas con dos días/.test(await hoja.locator('.alta-dos-dias').textContent().catch(() => '')), 'nunca ha entrenado y marca 3 días: «Empiezas con dos días, como en la guía…»');
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(300);
    check((await hoja.locator('.alta-mat-b svg.alta-mat').count()) === 10, 'el material, con un dibujo cada uno');
    await hoja.locator('[role="group"]').first().locator('button').first().click().catch(() => {});   // el lugar
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(300);
    // Salud: «No» a las dos y «Ninguna de estas» en las listas
    const grupos4 = hoja.locator('[role="group"]');
    for (let i = 0; i < await grupos4.count(); i++) {
      const g = grupos4.nth(i);
      if (await g.getByRole('button', { name: /^No$/ }).count()) await g.getByRole('button', { name: /^No$/ }).click();
      if (await g.locator('label.ninguna input').count()) await g.locator('label.ninguna input').check();
    }
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(400);
    const enviar = hoja.getByRole('button', { name: 'Enviar', exact: true });
    check(await enviar.isVisible().catch(() => false), 'el último paso dice «Enviar» (no «Enviar a tu coach»)');
    await enviar.click();
    const fin = p.locator('[aria-modal="true"]').last();
    await fin.getByRole('button', { name: 'Hecho' }).waitFor({ timeout: 15000 });
    const tFin = await fin.textContent();
    check(/No hace falta que te vea un médico/.test(tFin) && /la app te prepara tu plan/.test(tFin) && !/tu coach lo verá/.test(tFin),
      'al enviarlo: el resultado del cribado y «la app te prepara tu plan», sin «tu coach lo verá»');
    await fin.getByRole('button', { name: 'Hecho' }).click();
    await cerrar(p);
    // (097) su tanda es este lunes: de lunes a miércoles empieza este lunes (Día 1 en Hoy); desde el jueves, el siguiente
    const tardeE = ['Thu', 'Fri', 'Sat', 'Sun'].includes(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short' }).format(new Date()));
    if (!tardeE) {
      const conPlan = await p.waitForFunction(() => /Día 1/.test(document.querySelector('.hero-dia')?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
      check(conPlan, 'y en Hoy, su plan: «Primeras 4 semanas», Día 1');
      await probarSesion(p, 'Marina');
    } else {
      const espera = await p.waitForFunction(() => /Empiezas el lunes/.test(document.querySelector('section.hero-espera')?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
      check(espera, 'y en Hoy (de jueves a domingo, su semana 1 sería ya media semana): «Empiezas el lunes…», el siguiente');
    }
    await ctx.close();
    // (de jueves a domingo, la sesión de la semana 1 se mira con Inés, que empezó este lunes)
    if (tardeE) {
      const { ctx: ctx2, p: p2 } = await movil();
      await entrar(p2, /Inés/);
      await p2.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click().catch(() => {});
      await cerrar(p2);
      await p2.waitForFunction(() => /Día 1/.test(document.querySelector('.hero-dia')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
      await probarSesion(p2, 'Inés');
      await ctx2.close();
    }
  }

  // ---------------------------------------------------------------- Clara: su visto bueno, en revisión
  {
    const { ctx, p } = await movil();
    await entrar(p, /Clara/);
    await p.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click().catch(() => {});
    await cerrar(p);
    const hero = p.locator('section.hero-espera');
    await hero.first().waitFor({ timeout: 15000 }).catch(() => {});
    check(/Pelayo está revisando tu visto bueno/.test(await hero.first().textContent().catch(() => '')), 'Clara (cribado con valoración médica): «Pelayo está revisando tu visto bueno»');
    check(!(await p.locator('nav.tabs').getByText('Mensajes').count()), 'sin la pestaña Mensajes');
    await ctx.close();
  }

  // ---------------------------------------------------------------- Tomás: sus marcas
  {
    const { ctx, p } = await movil();
    await entrar(p, /Tomás/);
    await p.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click().catch(() => {});
    await cerrar(p);
    const tarjeta = p.locator('.tarjeta-marcas');
    const sale = await tarjeta.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check(sale, 'Tomás: «Ya tienes tus marcas de la semana 4»');
    if (sale) {
      await tarjeta.getByRole('button', { name: 'Ver tus marcas' }).click();
      const h = p.locator('[aria-modal="true"]').last();
      await h.locator('.lista-marcas li').first().waitFor();
      check((await h.locator('.lista-marcas li').count()) === 5 && /85\s?kg × 12/.test((await h.textContent()).replace(/ /g, ' ')), 'sus cinco marcas (85 kg × 12 en la prensa)');
    }
    // (tanda 3) y, al abrir la app, su plan desde la semana 5, con los kilos de sus marcas
    await cerrar(p);
    const listo = await p.waitForFunction(() => /Novato 2 días · FBE Esencial/.test(document.querySelector('.hero-dia')?.textContent || ''), null, { timeout: 20000 }).then(() => true).catch(() => false);
    check(listo, 'Tomás, tras sus cuatro semanas: la app le prepara «Novato 2 días · FBE Esencial» (la semana 5)');
    if (listo) check(/Tu plan desde ahora/.test(await p.locator('.hero-dia').first().textContent()), 'con la nota de la plantilla');
    // (25/11) lo de esta semana (la 5) y sus días: pide tres
    const leccion = p.locator('.leccion-esencial');
    const conLeccion = await leccion.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(conLeccion && /semana 5/.test(await leccion.textContent()) && /Desde aquí, la app/.test(await leccion.textContent()), 'en Hoy, «Lo de esta semana · semana 5»: «Desde aquí, la app»');
    const dias = p.locator('.dias-esencial');
    const conDias = await dias.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(conDias && /Entrenas 2 días a la semana/.test(await dias.textContent()), 'y sus días: «Entrenas 2 días a la semana»');
    if (conDias) {
      await dias.getByRole('button', { name: 'Pasar a tres días' }).click();
      const hd = p.locator('[aria-modal="true"]').last();
      await hd.getByRole('button', { name: 'Pasar a tres días' }).click();
      const pedido = await p.waitForFunction(() => /Desde la semana que viene, tres/.test(document.querySelector('.dias-esencial')?.textContent || ''), null, { timeout: 10000 }).then(() => true).catch(() => false);
      check(pedido, 'pide tres días: «Desde la semana que viene, tres»');
      await desborda(p, 'lo de esta semana y sus días');
    }
    await ctx.close();
  }

  // ---------------------------------------------------------------- Inés (tanda 4): su plan de comida
  {
    const { ctx, p } = await movil();
    await entrar(p, /Inés/);
    await p.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click().catch(() => {});
    await cerrar(p);
    const tarjeta = p.locator('section.seccion-nutricion').filter({ hasText: 'Tu plan de comida' });
    const sale = await tarjeta.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check(sale, 'Inés (con nutrición y sin plan de comida): en Hoy, «Tu plan de comida»');
    if (sale) {
      // (v0.252) con la 105 (en la demo, siempre): el cuestionario de nutrición por pasos
      await tarjeta.getByRole('button', { name: 'Preparar mi plan' }).click();
      const h = p.locator('[aria-modal="true"]').last();
      const pasoT = async () => (await h.locator('#nm-titulo').textContent().catch(() => '')).trim();
      const sig = () => h.getByRole('button', { name: 'Siguiente' }).click();
      await h.locator('#nm-titulo').waitFor({ timeout: 10000 });
      check(await pasoT() === 'Tú' && /Paso 1 de 7/.test(await h.textContent()) && (await h.locator('#nm-peso').inputValue()) === '68,4',
        'Inés: el cuestionario de nutrición, en siete pasos; su último peso, ya puesto (68,4)');
      await h.getByRole('button', { name: 'Mujer' }).click();
      await h.locator('#nm-edad').fill('36');
      await h.locator('#nm-altura').fill('168');
      await sig();
      await h.getByRole('button', { name: 'No', exact: true }).click();
      check(await pasoT() === 'Tu salud' && !(await h.getByText('¿Te pasa algo de esto?').count()), '«Tu salud»: la pregunta de TCA de siempre (las preguntas de salud nuevas, apagadas)');
      await sig();
      check(await pasoT() === 'Tus medidas' && /en ayunas y después de orinar/.test(await h.textContent()), '«Tus medidas»: cómo medirse, con su dibujo');
      await sig();
      check(/Escribe tu cintura/.test(await h.locator('.error').textContent().catch(() => '')), 'sin cintura no sigue');
      await h.locator('#nm-cintura').fill('80');
      await sig();
      await h.getByRole('button', { name: 'Sentado casi todo el día' }).click();
      await h.getByRole('button', { name: 'De 5.000 a 7.499' }).click();
      await h.locator('#nm-dias').fill('3');
      await sig();
      await h.getByRole('button', { name: 'Perder grasa' }).click();
      check(await h.getByRole('button', { name: /0,5 % de tu peso a la semana, unos 340 g \(recomendado\)/ }).getAttribute('aria-pressed') === 'true', '«Tu objetivo»: perder, con el ritmo recomendado ya marcado (0,5 %, unos 340 g)');
      await sig();
      check(await pasoT() === 'Cómo comes', '«Cómo comes»');
      await sig();
      const tPlan = (await h.textContent()).replace(/\u00a0/g, ' ');
      check(await pasoT() === 'Tu plan' && /1803/.test(tPlan) && /145 g/.test(tPlan) && /Gastas unas 2160 kcal al día/.test(tPlan) && /¿Has seguido tu plan\?/.test(tPlan),
        'su plan antes de guardarlo: 1803 kcal y 145 g de proteína, con su porqué (gasta unas 2160) y lo que viene');
      await desborda(p, 'el cuestionario de nutrición, su plan');
      await h.getByRole('button', { name: 'Guardar mi plan' }).click();
      const lista = await p.waitForFunction(() => { const d = document.querySelector('details[data-plegable="nutricion"]'); return !!d && !d.hidden && d.open && /1803/.test(d.textContent); }, null, { timeout: 15000 }).then(() => true).catch(() => false);
      check(lista && !(await tarjeta.count()), 'guardado: «Nutrición de hoy», abierta y con su objetivo (1803 kcal); la tarjeta ya no sale');
      const toque = p.locator('.nm-toque');
      const conToque = await toque.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      check(conToque && /cada 4 semanas/i.test(await toque.textContent()), 'y, debajo, el toque de cada día: «¿Has seguido tu plan hoy?» (la revisión, cada 4 semanas)');
      if (conToque) {
        await toque.getByRole('group', { name: '¿Has seguido tu plan hoy?' }).getByRole('button', { name: 'Sí' }).click();
        const marcado = await p.waitForFunction(() => document.querySelector('.nm-toque .elegido-2')?.getAttribute('aria-pressed') === 'true', null, { timeout: 10000 }).then(() => true).catch(() => false);
        check(marcado, 'marca «Sí» de un toque');
        await desborda(p, 'Hoy con el plan del motor y su toque');
      }
    }
    await ctx.close();
  }

  // ---------------------------------------------------------------- (alta, tanda 3) La primera semana, con Inés (empezó este lunes)
  {
    const { ctx, p } = await movil();
    await entrar(p, /Inés/);
    await p.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click().catch(() => {});
    await cerrar(p);
    await p.waitForFunction(() => /Día 1/.test(document.querySelector('.hero-dia')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const empezarSesion = async (nombre = null) => {
      // (la segunda, el mismo día: desde la lista de la semana, porque Hoy ya no ofrece «Adelantar»)
      if (nombre) {
        const b = p.locator('button.dia', { hasText: nombre }).first();
        await b.evaluate((el) => { const d = el.closest('details'); if (d) d.open = true; });   // (va en «Tu semana», plegada)
        await b.click();
      } else await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).first().click();
      const portada = p.locator('.portada-vista');
      if (await portada.waitFor({ timeout: 10000 }).then(() => true).catch(() => false)) await portada.getByRole('button', { name: /^\s*Empezar\s*$/ }).last().click();
      await p.locator('article.ejercicio, .enfoque').first().waitFor({ timeout: 15000 });
    };
    const terminar = async () => {
      await p.getByRole('button', { name: 'Terminar sesión' }).click();
      await p.locator('.hoja-dialogo .segmentos button', { hasText: '8' }).first().click();
      await p.getByRole('button', { name: 'Guardar y terminar' }).click();
      await p.getByRole('heading', { name: 'Sesión terminada' }).waitFor({ timeout: 15000 });
    };
    await empezarSesion();
    const guia = p.locator('.alta-guia');
    check(/Tu primera sesión, en tres cosas/.test(await guia.textContent().catch(() => '')) && /ajuste las máquinas/.test(await guia.textContent().catch(() => '')),
      'su primera sesión: la guía corta (cómo se apunta, «te sobran», el ✓ y que le ajusten las máquinas)');
    await guia.getByRole('button', { name: 'Entendido' }).click();
    check(await p.locator('.alta-guia').count() === 0, '«Entendido» la quita');
    check(!(await p.locator('.mensaje-coach').count()) && /Tres toques: te da un consejo para hoy/.test(await p.locator('.preparacion').first().textContent().catch(() => '')),
      'sin mensajes de «Tu coach» («Primera vez con…, luego me cuentas») y «¿Cómo llegas hoy?» sin «Tu coach lo verá»');
    const qp = p.locator('.alta-que-peso').first();
    await qp.getByRole('button', { name: /Qué peso pongo/ }).click();
    check(/El primer día no lo sabe nadie/.test(await qp.textContent()) && /cuatro o cinco/.test(await qp.textContent()), '«¿Qué peso pongo?», junto al ejercicio sin kilos: el texto de la guía (que te sobren cuatro o cinco)');
    await desborda(p, 'la primera sesión de Inés');
    await terminar();
    const fin = p.locator('.alta-fin-primera');
    const tFin1 = await fin.textContent({ timeout: 10000 }).catch(() => '');
    check(/Tu primera sesión, hecha/.test(tFin1) && /La siguiente, «Día 2»/.test(tFin1) && /agujetas/.test(tFin1), 'al terminarla: «Tu primera sesión, hecha», cuándo es la siguiente («Día 2») y las agujetas');
    // (acompañamiento, tanda 4) al terminar: «¿Cómo ha ido?», de un toque y con respuesta, y «Tu sesión, en claro»
    const tras = p.locator('.ayu-tras');
    const conTras = await tras.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(conTras && (await tras.locator('.ayu-palabra').count()) === 4, 'al terminar, «¿Cómo ha ido?»: cuatro opciones de un toque');
    if (conTras) {
      await tras.getByRole('button', { name: 'Dura', exact: true }).click();
      check(/Hay días así/.test(await tras.locator('.ayu-def').textContent().catch(() => '')) && (await tras.getByRole('button', { name: 'Dura', exact: true }).getAttribute('aria-pressed')) === 'true', 'toca «Dura» y la app le contesta en el momento');
      await tras.getByRole('button', { name: 'Algo me molestó' }).click();
      check(/check-in de la semana/.test(await tras.locator('.ayu-def').textContent().catch(() => '')) && (await tras.getByRole('button', { name: '¿Y si me duele algo?' }).count()) === 1, '«Algo me molestó»: que lo apunte en su check-in, y a un toque, «¿Y si me duele algo?»');
      const claro = tras.locator('.ayu-claro');
      const conClaro = await claro.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      if (conClaro) await claro.locator('summary').click();
      const tClaro = conClaro ? await claro.textContent() : '';
      check(conClaro && (await claro.locator('.ayu-claro-f').count()) === 5 && /Tu sesión, en claro/.test(tClaro) && !/La app |la app te/.test(tClaro),
        '«Tu sesión, en claro»: sus cinco ejercicios, cada uno con cómo fue (en las semanas de la guía, sin «la app hará…»: aún no mueve nada)');
      await desborda(p, 'el final de la sesión con «¿Cómo ha ido?»');
    }
    await p.getByRole('button', { name: 'Volver a hoy' }).click();
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(600);
    await cerrar(p);
    const conOtroDia = await p.waitForFunction(() => /Lo siguiente: Día 2, otro día: deja uno entre una y otra/.test(document.querySelector('.hero-dia')?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
    check(conOtroDia && !(await p.locator('.hero-dia').getByRole('button', { name: /Adelantar/ }).count()), 'en Hoy, tras la primera: «Lo siguiente: Día 2, otro día…», sin «Adelantar» (dos el mismo día, no)');
    await empezarSesion('Día 2');
    check(await p.locator('.alta-guia').count() === 0, 'en la segunda, ya sin la guía');
    await terminar();
    check(await p.locator('.alta-fin-primera').count() === 0, 'y sin la celebración de la primera');
    await p.getByRole('button', { name: 'Volver a hoy' }).click();
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(600);
    await cerrar(p);
    const hecha = p.locator('.alta-semana-hecha');
    const conHecha = await hecha.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(conHecha && /Semana 1 hecha: tus 2 sesiones/.test(await hecha.textContent()) && /La semana que viene, dos series/.test(await hecha.textContent()),
      'con las dos hechas: «Semana 1 hecha» y lo de la semana que viene (dos series)');
    await desborda(p, 'Hoy de Inés con la semana 1 hecha');
    // Su perfil: sin «Mensajes con tu coach» (no tiene chat); en Ajustes, sus preguntas frecuentes y a quién escribir
    await p.goto(`${base}/?demo=esencial#perfil`);
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await cerrar(p);
    const aAjustes = p.getByRole('button', { name: /Ajustes, guías y cuenta/ });
    await aAjustes.waitFor({ timeout: 15000 }).catch(() => {});
    check(!(await p.getByText('Mensajes con tu coach').count()), 'en su perfil, sin «Mensajes con tu coach» (no tiene chat)');
    await aAjustes.click().catch(() => {});
    const faq = p.locator('.alta-faq');
    const conFaq = await faq.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(conFaq && /preguntas frecuentes/.test(await faq.textContent()) && /pelayofbe@fuerzabasadaenevidencia\.com/.test(await faq.textContent()) && (await faq.locator('details').count()) >= 6,
      'en Perfil, las preguntas frecuentes de FBE Esencial y el correo para lo que falle en la app o en el cobro');
    // Su check-in: para qué es (nadie lo contesta uno a uno)
    await p.goto(`${base}/?demo=esencial#checkin`);
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await cerrar(p);
    check(/Pelayo no lo contesta uno a uno/.test(await p.locator('.alta-checkin').textContent({ timeout: 10000 }).catch(() => '')), 'su check-in: para qué es y que Pelayo no lo contesta uno a uno');
    await ctx.close();
  }

  // ---------------------------------------------------------------- El coach
  {
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', bypassCSP: true, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    vigilar(p);
    await p.goto(`${base}/?demo=esencial`);
    await p.getByRole('button', { name: /Coach: panel/ }).first().click();
    await p.getByRole('heading', { name: 'Atletas' }).first().waitFor({ timeout: 30000 });
    await p.waitForTimeout(1200);
    await cerrar(p);
    check((await p.getByText('Esencial', { exact: true }).count()) >= 4, 'en la lista, el chip «Esencial» en los cuatro');
    // (v0.235) el panel del piloto, debajo de la lista, y la encuesta de la semana 6
    const piloto = p.locator('details.corr-panel').filter({ hasText: 'FBE Esencial' });
    if ((await piloto.getAttribute('open').catch(() => null)) === null) await piloto.locator('summary').click().catch(() => {});
    check(/Tomás Rey/.test(await piloto.textContent().catch(() => '')) && /han entrenado/.test(await piloto.textContent().catch(() => '')), 'en Atletas, el panel «FBE Esencial»: cada uno y quién ha entrenado esta semana');
    await piloto.getByRole('button', { name: /encuesta/ }).click();
    const he = p.locator('[aria-modal="true"]').last();
    await he.getByRole('button', { name: /Mandarla a 7 atletas/ }).click();
    const mandada = await he.getByRole('button', { name: 'Ya la tienen todos' }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(mandada && /Sin contestar: /.test(await he.textContent().catch(() => '')), 'la encuesta de la semana 6, mandada a los seis (y quién no ha contestado)');
    // (v0.248, 77) «Listos para el lunes»: Clara (su visto bueno, por confirmar) y Andrés empiezan el lunes que viene
    const listos = piloto.locator('#lun-coach-t');
    const conListos = await listos.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    const tListos = conListos ? (await listos.locator('xpath=..').textContent()) || '' : '';
    check(conListos && /Listos para el lunes \d+ de \w+: 0 de 2/.test(tListos) && /Andrés Mora/.test(tListos) && /Clara Prieto/.test(tListos) && /confirmar visto bueno/.test(tListos) && /días · avisos · gimnasio|avisos · gimnasio/.test(tListos),
      `en el panel, «Listos para el lunes»: 0 de 2, con lo que le falta a cada uno (${tListos.replace(/\s+/g, ' ').slice(0, 160)})`);
    await he.getByRole('button', { name: /^Cerrar/ }).first().click().catch(() => {});
    await p.getByText('Clara Prieto').first().click();
    await p.getByRole('tab', { name: 'Datos' }).click().catch(async () => { await p.getByRole('button', { name: 'Datos' }).first().click(); });
    const sec = p.locator('section[aria-labelledby="esencial-coach"]');
    await sec.waitFor({ timeout: 15000 });
    // (su cuestionario llega después de la sección: hasta entonces, «—»)
    const dice = await p.waitForFunction(() => /Dice que lo tiene/.test(document.querySelector('section[aria-labelledby="esencial-coach"]')?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
    check(dice, 'su ficha (Datos): FBE Esencial, «Dice que lo tiene»');
    check(!(await p.getByRole('tab', { name: 'Mensajes' }).count()), 'sin la pestaña Mensajes en su ficha');
    await sec.getByRole('button', { name: /Confirmar visto bueno/ }).click();
    const conPlan = await p.waitForFunction(() => /Primeras 4 semanas/.test(document.querySelector('section[aria-labelledby="esencial-coach"]')?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
    check(conPlan, 'al confirmar su visto bueno, la app le prepara su plan («Primeras 4 semanas»)');

    // (alta, tanda 2) Clara, con su plan desde el lunes que viene: su camino, un consejo, sus días y su semana 1
    await salirDeLaCuenta(p);
    await p.goto(`${base}/?demo=esencial`);
    await p.getByRole('button', { name: /Clara/ }).first().click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click({ timeout: 8000 }).catch(() => {});
    await cerrar(p);
    const heroC = p.locator('section.hero-espera').first();
    await heroC.waitFor({ timeout: 15000 }).catch(() => {});
    const tHero = await heroC.textContent().catch(() => '');
    check(/Empiezas el lunes/.test(tHero) && /Semanas 1 a 4/.test(tHero) && /Desde la 5/.test(tHero) && /Para hoy:/.test(tHero), 'Clara, antes de su lunes: «Empiezas el lunes…», su camino (semanas 1 a 4, marcas, desde la 5) y un consejo para hoy');
    const pasosC = await p.locator('.primeros-pasos').textContent().catch(() => '');
    check(/Activa los avisos/.test(pasosC) && /Elige tus días/.test(pasosC) && !/Escribe tu porqué/.test(pasosC), 'sus primeros pasos, los de FBE Esencial (avisos, sus días…), sin los de siempre');
    await p.locator('.alta-tus-dias').getByRole('button', { name: 'Elegir mis días' }).click();
    const hd2 = p.locator('[aria-modal="true"]').last();
    check(/Entrenas lunes y jueves/.test(await hd2.textContent()), 'elegir sus días: de entrada, lunes y jueves (no van seguidos)');
    await hd2.getByRole('button', { name: 'jueves' }).click();
    await hd2.getByRole('button', { name: 'martes' }).click();
    check(/Van seguidos/.test(await hd2.textContent()), 'lunes y martes: «Van seguidos»');
    await hd2.getByRole('button', { name: 'martes' }).click();
    await hd2.getByRole('button', { name: 'viernes' }).click();
    await hd2.getByRole('button', { name: 'Guardar mis días' }).click();
    const conDias = await p.waitForFunction(() => /Entrenas lunes y viernes/.test(document.querySelector('.alta-tus-dias')?.textContent || ''), null, { timeout: 10000 }).then(() => true).catch(() => false);
    check(conDias, 'guardados: «Entrenas lunes y viernes» (y cada sesión, en su día)');
    const s1 = p.locator('.alta-semana1');
    const conS1 = await s1.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(conS1 && (await s1.locator('li').count()) === 5 && /Prensa de piernas/.test(await s1.textContent()), 'su semana 1, ejercicio a ejercicio (los cinco, con qué hacer si no hay máquina)');
    await desborda(p, 'Hoy de Clara antes de su lunes');
    await salirDeLaCuenta(p);
    await p.goto(`${base}/?demo=esencial`);
    await p.getByRole('button', { name: /Coach: panel/ }).first().click();
    await p.getByRole('heading', { name: 'Atletas' }).first().waitFor({ timeout: 30000 });
    await p.waitForTimeout(1000);
    await cerrar(p);
    // Añadir atleta de FBE Esencial
    await p.getByRole('button', { name: /Atletas/ }).first().click().catch(() => {});
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: /Añadir atleta/ }).first().click();
    const h = p.locator('[aria-modal="true"]').last();
    await h.getByRole('button', { name: 'FBE Esencial' }).click();
    await h.getByLabel('Nombre y apellidos').fill('Prueba Esencial');
    await h.getByRole('button', { name: /Crear y generar código/ }).click();
    const inv = p.locator('[aria-modal="true"]').last();
    const msg = await p.waitForFunction(() => /Ya tienes tu plaza en FBE Esencial/.test(document.querySelector('[aria-modal="true"]:last-of-type, [role="dialog"]:last-of-type')?.textContent || document.body.textContent), null, { timeout: 15000 }).then(() => true).catch(() => false);
    check(msg && /que empieza el lunes/.test(await inv.textContent().catch(() => '')), 'el alta de FBE Esencial: su mensaje de invitación, con su lunes de inicio');
    // (v0.236) varios de una vez: pegar la lista, ver lo que entiende la app y crear sus fichas con su código
    await inv.getByRole('button', { name: /^Cerrar/ }).first().click().catch(() => {});
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: /Atletas/ }).first().click().catch(() => {});   // (al cerrar se abre su ficha)
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: /Añadir atleta/ }).first().click();
    const h2 = p.locator('[aria-modal="true"]').last();
    await h2.getByRole('button', { name: 'FBE Esencial' }).click();
    await h2.getByRole('button', { name: /Son varios/ }).click();
    const hv = p.locator('[aria-modal="true"]').last();
    await hv.locator('#alt-texto').fill('Nuria Sanz, nuria@correo.com\nDiego Mora; diego@correo.com; nutrición\nsolo@correo.com');
    const prev = await hv.getByRole('heading', { name: /Lo que ha entendido la app: 2 de 3/ }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
    check(prev && /Falta el nombre/.test(await hv.textContent()) && /Con nutrición/.test(await hv.textContent()), 'varios de FBE Esencial: lo que entiende la app de la lista (2 de 3; a uno le falta el nombre)');
    await hv.getByRole('button', { name: /Crear 2 fichas con su código/ }).click();
    const invs = p.locator('[aria-modal="true"]').last();
    const listas = await invs.getByText(/Creadas 2 fichas/).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    const correos = await invs.locator('a[href^="mailto:"]').evaluateAll((as) => as.map((x) => x.getAttribute('href')));
    check(listas && correos.length === 2 && correos.every((h) => /subject=/.test(h) && /FBE%20Esencial/.test(h)), 'sus invitaciones: «Correo» de cada uno, ya escrito con su código');
    await invs.getByRole('button', { name: 'Hecho' }).click();
    const enLista = await p.waitForFunction(() => /Nuria Sanz/.test(document.body.textContent) && /Diego Mora/.test(document.body.textContent), null, { timeout: 10000 }).then(() => true).catch(() => false);
    check(enLista, 'y los dos salen en la lista de Atletas');

    // (alta, v0.239) en el panel, el embudo del alta y quién no ha activado su cuenta, con «Mandar otra vez» (a todos)
    await p.waitForTimeout(800);
    const pil = p.locator('details.corr-panel').filter({ hasText: 'FBE Esencial' });
    if ((await pil.getAttribute('open').catch(() => null)) === null) await pil.locator('summary').click().catch(() => {});
    const sinAct = await pil.getByRole('heading', { name: /Sin activar su cuenta \(3\)/ }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(sinAct && /El alta/.test(await pil.textContent()) && (await pil.getByRole('button', { name: /Mandar otra vez la invitación a Nuria Sanz/ }).count()) === 1,
      'el panel: «El alta» (el embudo) y «Sin activar su cuenta (3)», cada uno con «Mandar otra vez»');
    await pil.getByRole('button', { name: /Mandar otra vez a los 3/ }).click();
    const hr = p.locator('[aria-modal="true"]').last();
    await hr.getByRole('button', { name: /Generar sus 3 códigos nuevos/ }).click();
    const nuevos = await hr.getByText(/3 códigos nuevos/).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    const cuerpos = (await p.locator('[aria-modal="true"]').last().locator('a[href^="mailto:"]').evaluateAll((as) => as.map((x) => decodeURIComponent(x.getAttribute('href').split('&body=')[1] || ''))));
    const deNuria = cuerpos.find((x) => /Hola, Nuria/.test(x)) || '';
    const codigoNuria = (deNuria.match(/codigo=(FBE-[A-Z0-9]{5}-[A-Z0-9]{5})&plan=esencial/) || [])[1];
    check(nuevos && !!codigoNuria && /Sirve una sola vez, hasta el /.test(deNuria), 'mandar otra vez a los tres: un código nuevo para cada uno y su mensaje, con el enlace que lleva el código (y hasta cuándo vale)');
    await p.locator('[aria-modal="true"]').last().getByRole('button', { name: 'Hecho' }).click().catch(() => {});

    // (alta, v0.239) Nuria abre el enlace: «Activa tu cuenta» con su código puesto; sin el consentimiento de salud, se avisa
    await salirDeLaCuenta(p, codigoNuria);
    // (Nuria, en su móvil: sin lo que dejó Clara en este, como su bienvenida ya vista)
    await p.evaluate(() => { localStorage.removeItem('fbe-bienvenida-vista'); });
    await p.goto(`${base}/?demo=esencial&codigo=${codigoNuria}&plan=esencial`);
    await p.getByRole('heading', { name: 'Activa tu cuenta' }).waitFor({ timeout: 20000 });
    check(await p.locator('#act-codigo').inputValue() === codigoNuria && /Ya viene puesto desde tu invitación/.test(await p.locator('form').textContent())
      && /En FBE Esencial lo necesitas/.test(await p.locator('form').textContent()) && !/codigo=/.test(p.url()),
      'con el enlace: directamente «Activa tu cuenta», el código ya escrito, por qué necesita el consentimiento de salud, y el código ya no está en la dirección');
    await p.getByLabel('Tu nombre').fill('Nuria');
    await p.getByLabel('Email').fill('nuria.app@correo.test');
    await p.getByLabel('Crea una contraseña').fill('una-contraseña-segura');
    await p.getByRole('button', { name: 'Mostrar la contraseña' }).click();
    check(await p.locator('#act-pass').getAttribute('type') === 'text', 'el ojo enseña la contraseña');
    await p.locator('label.casilla input').nth(0).check();
    await p.getByRole('button', { name: 'Activar cuenta' }).click();
    check(/no podrá prepararte el plan de FBE Esencial/.test(await p.locator('.alta-aviso-salud').textContent().catch(() => '')), 'sin el consentimiento de salud, se le avisa antes de seguir');
    await p.locator('label.casilla input').nth(1).check();
    await p.getByRole('button', { name: 'Activar cuenta' }).click();
    const bv = p.getByRole('dialog', { name: 'Bienvenida a FBE Esencial' });
    const conBienvenida = await bv.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    const t1 = conBienvenida ? await bv.textContent() : '';
    check(conBienvenida && /Hola, Nuria/.test(t1) && /Tu cuestionario/.test(t1) && /Tu plan/.test(t1) && /Empiezas el lunes/.test(t1), 'su bienvenida de FBE Esencial: los tres pasos (cuestionario, plan y su lunes)');
    const titulos = [];
    for (let i = 0; i < 6 && conBienvenida; i++) {
      titulos.push(await bv.locator('h2').textContent());
      if (titulos.at(-1) === 'Los avisos') {
        await bv.getByRole('button', { name: /Avisarme por correo/ }).click();
        check(await bv.getByText(/Te llegarán por correo/).waitFor({ timeout: 5000 }).then(() => true).catch(() => false), 'los avisos, durante el alta: por correo (en la demo no hay móvil)');
      }
      const sig = bv.getByRole('button', { name: 'Siguiente' });
      if (await sig.count()) await sig.click(); else break;
      await p.waitForTimeout(200);
    }
    check(titulos.join(' · ') === 'Hola, Nuria · Hasta tu lunes · Apunta cada serie · Los avisos · Tenla a mano', `sus pantallas: ${titulos.join(' · ')}`);
    await bv.getByRole('button', { name: 'Empezar' }).click().catch(() => {});
    await cerrar(p);
    const heroN = await p.locator('section.hero-espera').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check(heroN && /Rellena tu cuestionario/.test(await p.locator('section.hero-espera').first().textContent()), 'y en Hoy, su cuestionario');
    await desborda(p, 'Hoy de Nuria');

    // El coach lo ve: su cuenta activa y sus avisos por correo
    await salirDeLaCuenta(p);
    await p.goto(`${base}/?demo=esencial`);
    await p.getByRole('button', { name: /Coach: panel/ }).first().click();
    await p.getByRole('heading', { name: 'Atletas' }).first().waitFor({ timeout: 30000 });
    await p.waitForTimeout(1200);
    await cerrar(p);
    const pil2 = p.locator('details.corr-panel').filter({ hasText: 'FBE Esencial' });
    if ((await pil2.getAttribute('open').catch(() => null)) === null) await pil2.locator('summary').click().catch(() => {});
    const filaN = pil2.locator('.corr-fila', { hasText: 'Nuria Sanz' });
    const tN = await filaN.textContent({ timeout: 10000 }).catch(() => '');
    check(/Cuenta activa desde el/.test(tN) && /Avisos por correo/.test(tN) && /Sin activar su cuenta \(2\)/.test(await pil2.textContent()), 'en el panel: Nuria, con su cuenta activa y los avisos por correo; quedan 2 sin activar');

    // Un código que no existe: al crear la cuenta, por qué no vale
    await salirDeLaCuenta(p);
    await p.goto(`${base}/?demo=esencial`);
    await p.getByRole('button', { name: 'Activa tu cuenta' }).click();
    await p.locator('#act-codigo').fill('FBE-ZZZZZ-ZZZZZ');
    await p.getByLabel('Tu nombre').fill('Alguien');
    await p.getByLabel('Email').fill('alguien@correo.test');
    await p.getByLabel('Crea una contraseña').fill('una-contraseña-segura');
    await p.locator('label.casilla input').nth(0).check();
    await p.getByRole('button', { name: 'Activar cuenta' }).click();
    const noExiste = await p.getByText(/Ese código no existe/).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check(noExiste && await p.getByRole('heading', { name: 'Introduce tu código' }).count() === 1, 'con un código que no existe: al crear la cuenta, «Ese código no existe» (y puede escribir el bueno)');
    await p.getByRole('button', { name: /Cerrar sesión/ }).click().catch(() => {});

    // Un email que ya tiene cuenta: «Entrar» (con su email ya escrito) o «He olvidado mi contraseña»
    await p.getByRole('heading', { name: 'Entra en tu cuenta' }).waitFor({ timeout: 15000 }).catch(() => {});
    await p.getByRole('button', { name: 'Activa tu cuenta' }).click();
    await p.locator('#act-codigo').fill('FBE-YYYYY-YYYYY');
    await p.getByLabel('Tu nombre').fill('Marina');
    await p.getByLabel('Email').fill('marina@fbe.demo');
    await p.getByLabel('Crea una contraseña').fill('otra-contraseña-larga');
    await p.locator('label.casilla input').nth(0).check();
    await p.getByRole('button', { name: 'Activar cuenta' }).click();
    const existe = await p.locator('.alta-existe').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(existe && /Ya hay una cuenta con marina@fbe.demo/.test(await p.locator('.alta-existe').textContent()) && (await p.locator('.alta-existe').getByRole('button', { name: 'He olvidado mi contraseña' }).count()) === 1,
      'con un email que ya tiene cuenta: lo dice claro, con «Entrar» y «He olvidado mi contraseña»');
    await p.locator('.alta-existe').getByRole('button', { name: 'Entrar' }).click();
    check(await p.locator('#acc-email').inputValue().catch(() => '') === 'marina@fbe.demo', 'y al tocar «Entrar», su email ya escrito');
    await desborda(p, 'La entrada');
    await ctx.close();
  }
  // ---------- (sin coach, 20) Ni rastro de «tu coach» ----------
  // Tomás (semana 5, la app entera) recorre sus pestañas, abre una a una las filas de Perfil y de Ajustes y las hojas de
  // Hoy, mira sus avisos al móvil, hace el check-in con una molestia moderada y abre «Más» en la sesión. En nada de lo
  // que ve puede salir «tu coach» ni «mi coach». No cuenta la política de privacidad (texto legal con versión: lleva su
  // aclaración arriba) ni, en Equipo, «el coach» como papel de quien modera.
  {
    const { ctx, p } = await movil();
    await ctx.addInitScript(() => { try { localStorage.setItem('fbe-bienvenida-vista', '1'); } catch { /* sin almacenamiento */ } });
    await entrar(p, /Tomás/);
    await cerrar(p);
    const hallado = new Set();
    let pantallas = 0;
    const mirar = async (donde) => {
      pantallas++;
      const ts = await p.evaluate(() => {
        const r = [], RE = /\b(tu|mi) coach\b/i;
        const visible = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; };
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = w.nextNode())) {
          const el = n.parentElement;
          if (!RE.test(n.nodeValue) || !el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || !visible(el)) continue;
          r.push(n.nodeValue.replace(/\s+/g, ' ').trim().slice(0, 120));
        }
        for (const el of document.querySelectorAll('[aria-label], [placeholder], [title], [alt]')) {
          for (const a of ['aria-label', 'placeholder', 'title', 'alt']) { const v = el.getAttribute(a); if (v && RE.test(v)) r.push(`(${a}) ${v.slice(0, 120)}`); }
        }
        return r;
      });
      for (const t of ts) hallado.add(`${donde}: ${t}`);
    };
    const cerrarHojas = async () => {
      for (let i = 0; i < 4; i++) {
        if (!(await p.locator('[aria-modal="true"]').count())) break;
        await p.keyboard.press('Escape').catch(() => {});
        await p.waitForTimeout(250);
        const b = p.locator('[aria-modal="true"] .hoja-cerrar, [aria-modal="true"] button:has-text("Cerrar"), [aria-modal="true"] button:has-text("Cancelar"), [aria-modal="true"] button:has-text("Ahora no")').first();
        if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(250); }
      }
    };
    const ir = async (t) => {
      await p.evaluate((h) => { if (location.hash !== `#${h}`) location.hash = `#${h}`; }, t);
      await p.waitForTimeout(800);
      await cerrarHojas();
      await p.evaluate(async () => {
        for (const d of document.querySelectorAll('details')) d.open = true;
        for (let y = 0; y < document.documentElement.scrollHeight; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
        window.scrollTo(0, 0);
      });
      await p.waitForTimeout(300);
    };
    // (lo que no se abre: salir, borrar, compartir o descargar algo, y la política de privacidad)
    const NO = /reiniciar|demo|cambiar de cuenta|cerrar sesi|salir|borrar|eliminar|quitar|baja|descargar|exportar|instalar|activar|conectar|enviar|publicar|subir|compartir|copiar|calendario|imprimir|pdf|privacidad/i;
    const FILAS = 'main button.fila-ios-nav:not(.peligro), main [aria-haspopup="dialog"]';
    let hojas = 0;
    for (const t of ['hoy', 'semana', 'progreso', 'equipo', 'aprende', 'perfil', 'ajustes']) {
      await ir(t);
      await mirar(t);
      if (!['perfil', 'ajustes', 'hoy'].includes(t)) continue;
      const n = Math.min(await p.locator(FILAS).count(), 45);
      for (let i = 0; i < n; i++) {
        const b = p.locator(FILAS).nth(i);
        const txt = `${(await b.textContent().catch(() => '')) || ''} ${(await b.getAttribute('aria-label').catch(() => '')) || ''}`.replace(/\s+/g, ' ').trim().slice(0, 60);
        if (NO.test(txt) || !(await b.isVisible().catch(() => false))) continue;
        await b.click({ timeout: 1500 }).catch(() => {});
        await p.waitForTimeout(350);
        if (await p.locator('[aria-modal="true"]').count()) hojas++;
        await mirar(`${t} › ${txt}`);
        await cerrarHojas();
        if (!(await p.evaluate((h) => location.hash === `#${h}`, t))) await ir(t);
      }
    }
    // Sus avisos al móvil: sin las respuestas ni las tareas de un coach; la semana se la prepara la app
    await ir('ajustes');
    await p.locator('.fila-notificaciones button').first().click({ timeout: 5000 }).catch(() => {});
    const hn = p.locator('[aria-modal="true"]').last();
    const conTipos = await hn.locator('#nt-semana').waitFor({ state: 'attached', timeout: 10000 }).then(() => true).catch(() => false);
    const tn = conTipos ? await hn.textContent() : '';
    check(conTipos && /Semana nueva/.test(tn) && /Cuando la app te prepara tu semana/.test(tn) && /Avisos de Pelayo/.test(tn) && (await hn.locator('#nt-respuesta, #nt-tarea').count()) === 0,
      'sus avisos al móvil: «Semana nueva» (se la prepara la app) y «Avisos de Pelayo»; sin respuestas ni tareas de un coach');
    await mirar('Notificaciones');
    await cerrarHojas();
    // La política de privacidad: arriba, quién es «tu coach» para quien va por su cuenta
    await ir('ajustes');
    await p.locator('main button.fila-ios-nav', { hasText: 'Política de privacidad' }).first().click({ timeout: 5000 }).catch(() => {});
    check(await p.locator('[aria-modal="true"]').last().getByText(/«tu coach» \(y «mi coach» en el consentimiento\) es Pelayo Fernández Cidón/).waitFor({ timeout: 8000 }).then(() => true).catch(() => false),
      'la política de privacidad: arriba, quién es «tu coach» para quien va por su cuenta');
    await cerrarHojas();
    // El check-in, con una molestia moderada: en el paso, qué hacer; al enviarlo, lo que la app hace con él
    await ir('checkin');
    let dolorEnPaso = false, enviado = false;
    // (si su check-in de la semana ya está enviado, se abre en el repaso: desde ahí, a la pregunta de las molestias)
    let marcada = false;
    for (let i = 0; i < 30; i++) {
      await mirar(`check-in, paso ${i + 1}`);
      const zonas = p.locator('.zonas');
      if (!marcada && await zonas.isVisible().catch(() => false)) {
        const z = zonas.locator('button', { hasText: 'Zona lumbar' }).first();
        if ((await z.getAttribute('aria-pressed').catch(() => null)) !== 'true') await z.click().catch(() => {});
        await p.locator('.segmentos.dolor button', { hasText: 'Moderada' }).first().click({ timeout: 3000 }).catch(() => {});
        marcada = true;
        dolorEnPaso = await p.locator('.sinco-dolor').getByText(/5 sobre 10/).waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
        await mirar('check-in, molestia moderada');
      }
      const enviar = p.getByRole('button', { name: /^Enviar$|Actualizar check-in/ });
      if (await enviar.isVisible().catch(() => false)) {
        const fila = p.locator('button.ck-repaso-fila[aria-label^="Cambiar: ¿Te ha molestado algo?"]');
        if (!marcada && await fila.count()) { await fila.first().click().catch(() => {}); await p.waitForTimeout(450); continue; }
        await enviar.click().catch(() => {});
        enviado = true;
        break;
      }
      const sig = p.getByRole('button', { name: /^(Siguiente|Repasar|Volver al repaso)/ }).first();
      if (await sig.isVisible().catch(() => false)) await sig.click().catch(() => {}); else break;
      await p.waitForTimeout(350);
    }
    const tras = p.locator('section.sinco-tras');
    const conTras = enviado && await tras.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    const tt = conTras ? await tras.textContent() : '';
    check(dolorEnPaso, 'el check-in, con una molestia moderada: en el mismo paso, qué hacer (la regla del 5 sobre 10 y cuándo consultar)');
    check(conTras && /Qué pasa ahora con tu check-in/.test(tt) && /Queda en tu progreso/.test(tt) && /molestia moderada en zona lumbar/.test(tt) && /Nadie te lo contesta uno a uno/.test(tt)
      && (await tras.locator('.sinco-dolor a[href*="semaforo-dolor"]').count()) === 1,
      'enviado: «Qué pasa ahora con tu check-in» (dónde queda, que la app lo usa, su molestia y que nadie lo contesta) y el semáforo del dolor');
    await mirar('check-in enviado');
    await desborda(p, 'El check-in enviado de Tomás');
    // La sesión: «Más» en el primer ejercicio (y Hoy, con el check-in ya enviado: «Tu día»)
    await ir('hoy');
    await mirar('hoy, con el check-in enviado');
    const emp = p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).first();
    if (await emp.count()) {
      await emp.click().catch(() => {});
      const portada = p.locator('.portada-vista');
      if (await portada.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) { await mirar('portada de la sesión'); await portada.getByRole('button', { name: /^\s*Empezar\s*$/ }).last().click().catch(() => {}); }
      await p.locator('article.ejercicio, .enfoque').first().waitFor({ timeout: 12000 }).catch(() => {});
      await p.waitForTimeout(600);
      await mirar('sesión');
      await p.locator('article.ejercicio').first().getByRole('button', { name: /Más/ }).first().click({ timeout: 3000 }).catch(() => {});
      await p.waitForTimeout(500);
      await mirar('sesión › Más');
      // (cada herramienta de «Más», en su hoja: el orden, las alternativas, el historial y el descanso)
      for (const h of [/^Cambiar el orden/, /^Cambiar(?! el orden)/, /^Historial/, /^Descanso/]) {
        if (!(await p.locator('[aria-modal="true"]').count())) { await p.locator('article.ejercicio').first().getByRole('button', { name: /Más/ }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(400); }
        const b = p.locator('[aria-modal="true"]').last().getByRole('button', { name: h }).first();
        if (!(await b.count())) continue;
        await b.click({ timeout: 3000 }).catch(() => {});
        await p.waitForTimeout(500);
        if (await p.locator('[aria-modal="true"]').count()) hojas++;
        await mirar(`sesión › ${h.source}`);
        await cerrarHojas();
      }
    }
    check(pantallas >= 30 && hojas >= 12, `recorrido de Tomás: ${pantallas} pantallas y hojas (${hojas} hojas abiertas una a una)`);
    check(hallado.size === 0, `ni rastro de «tu coach» en lo que ve quien va por su cuenta${hallado.size ? `: ${[...hallado].slice(0, 5).join(' | ')}` : ''}`);
    await ctx.close();
  }
  // ---------- (sin coach, tanda 2; 098) El cierre de la semana, con el reloj en el domingo ----------
  // Tomás acaba de pasar a su plan de la semana 5 y llega al domingo sin hacer sus dos sesiones. A las 20:30 aún no se le
  // pregunta (y puede poner la semana en pausa y volver); a las 21:30 elige: repetir esta o pasar a la siguiente.
  {
    const hoyM = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
    const dM = new Date(`${hoyM}T12:00:00Z`);
    const domingo = new Date(dM.getTime() + (6 - ((dM.getUTCDay() + 6) % 7)) * 864e5).toISOString().slice(0, 10);
    const enMadrid = (hhmm) => [1, 2].map((o) => new Date(`${domingo}T${hhmm}:00+0${o}:00`))
      .find((d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) === hhmm);
    const tomasEl = async (hhmm) => {
      const { ctx, p } = await movil();
      await ctx.addInitScript(() => { try { localStorage.setItem('fbe-bienvenida-vista', '1'); } catch { /* sin almacenamiento */ } });
      await ctx.clock.setFixedTime(enMadrid(hhmm));
      await entrar(p, /Tomás/);
      await cerrar(p);
      return { ctx, p };
    };
    const tarjeta = (p, tipo) => p.locator(`.cierre-semana[data-cierre="${tipo}"]`);
    // A las 20:30: sin pregunta; «Esta semana no puedo» → en pausa → «Volver ya»
    {
      const { ctx, p } = await tomasEl('20:30');
      const enlace = p.getByRole('button', { name: 'Esta semana no puedo' });
      const hay = await enlace.first().waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
      check(hay && (await tarjeta(p, 'pregunta').count()) === 0, 'el domingo a las 20:30, con la semana sin hacer: aún no se pregunta; sí puede decir «Esta semana no puedo»');
      await enlace.first().click();
      const hp = p.locator('[aria-modal="true"]').last();
      check(/Tu plan se corre una semana/.test(await hp.textContent().catch(() => '')), 'la hoja lo explica: el plan se corre una semana y no llegan avisos de sus sesiones');
      await hp.getByRole('button', { name: 'Poner la semana en pausa' }).click();
      const pausa = await tarjeta(p, 'pausa').waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      check(pausa && /Tu semana está en pausa/.test(await tarjeta(p, 'pausa').textContent()) && /Vuelves el lunes/.test(await tarjeta(p, 'pausa').textContent()), 'en pausa: lo dice en Hoy, con el lunes en que vuelve');
      await desborda(p, 'Hoy de Tomás, con la semana en pausa');
      await tarjeta(p, 'pausa').getByRole('button', { name: 'Volver ya' }).click();
      const vuelta = await p.getByRole('button', { name: 'Esta semana no puedo' }).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      check(vuelta && (await tarjeta(p, 'pausa').count()) === 0, '«Volver ya»: su semana, donde estaba');
      await ctx.close();
    }
    // A las 21:30: la pregunta; «Repetir esta semana»
    {
      const { ctx, p } = await tomasEl('21:30');
      const hay = await tarjeta(p, 'pregunta').waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
      const t = hay ? await tarjeta(p, 'pregunta').textContent() : '';
      check(hay && /Tu semana acaba hoy y te quedan 2 sesiones/.test(t) && /Pasar: /.test(t) && /Repetir: /.test(t) && /antes de las 22:00, pasamos a la siguiente/.test(t),
        'el domingo a las 21:30: «Tu semana acaba hoy y te quedan 2 sesiones», qué hace cada opción y hasta cuándo');
      await desborda(p, 'Hoy de Tomás, con la pregunta del domingo');
      await tarjeta(p, 'pregunta').getByRole('button', { name: 'Repetir esta semana' }).click();
      const fuera = await tarjeta(p, 'pregunta').waitFor({ state: 'detached', timeout: 15000 }).then(() => true).catch(() => false);
      const guardado = await p.waitForFunction(() => /"esencial_repetida":1/.test(localStorage.getItem('fbe-demo-esencial-v2') || ''), null, { timeout: 5000 }).then(() => true).catch(() => false);
      check(fuera && guardado, 'repetir: la pregunta se va y su semana queda apuntada como repetida (pasa al lunes)');
      await ctx.close();
    }
    // A las 21:30: «Pasar a la siguiente» (la app la prepara en el momento)
    {
      const { ctx, p } = await tomasEl('21:30');
      await tarjeta(p, 'pregunta').waitFor({ timeout: 25000 }).catch(() => {});
      await tarjeta(p, 'pregunta').getByRole('button', { name: 'Pasar a la siguiente' }).click().catch(() => {});
      const lista = await tarjeta(p, 'pasada').waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
      check(lista && /Tu semana siguiente ya está lista/.test(await tarjeta(p, 'pasada').textContent()), 'pasar: «Tu semana siguiente ya está lista» (preparada al momento, sin esperar al lunes)');
      await desborda(p, 'Hoy de Tomás, tras pasar a la siguiente');
      await ctx.close();
    }
  }
  // ---------- (sin coach, tanda 3; 099) Tu rutina: recomendadas, ficha, catálogo y cambio ----------
  // Tomás lleva su plan de novato: en Semana ve «Tu rutina» y la cambia (el cuestionario corto, sus recomendadas, la ficha
  // de una, todo el catálogo y confirmar: le avisa de las 12 semanas). Después, «Seguir con la mía».
  {
    const { ctx, p } = await movil();
    await ctx.addInitScript(() => { try { localStorage.setItem('fbe-bienvenida-vista', '1'); } catch { /* sin almacenamiento */ } });
    await entrar(p, /Tomás/);
    await cerrar(p);
    await p.locator('nav.tabs').getByRole('button', { name: /Semana/ }).click();
    const tuya = p.locator('.rut-tuya');
    const hay = await tuya.waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
    const t0 = hay ? await tuya.textContent() : '';
    check(hay && /Tu rutina/.test(t0) && /Novato/.test(t0) && /al menos 12/.test(t0), 'en Semana, «Tu rutina»: cuál lleva, desde cuándo y «lo recomendable es mantenerla al menos 12»');
    await tuya.scrollIntoViewIfNeeded().catch(() => {});
    await tuya.getByRole('button', { name: 'Cambiar de rutina' }).click();
    const hoja = p.locator('[aria-modal="true"]').last();
    await hoja.locator('.rut-gustos').waitFor();
    const tg = await hoja.textContent();
    check(/Cuánto llevas entrenando fuerza/.test(tg) && /Cuántos días puedes entrenar/.test(tg) && /Dónde entrenas/.test(tg) && /Qué quieres priorizar/.test(tg) && /60 años o más/.test(tg),
      'antes de cambiar: un cuestionario corto (experiencia, días y sitio) y «Tus gustos»');
    for (const q of await hoja.locator('.rut-pregunta').all()) {
      if (!(await q.locator('button[aria-pressed="true"]').count()) && !(await q.locator('input').count())) await q.locator('button').first().click();
    }
    await hoja.getByRole('button', { name: 'Ver mis rutinas recomendadas' }).click();
    await hoja.locator('.rut-recomendadas').waitFor();
    const n = await hoja.locator('.rut-tarjeta').count();
    check(n >= 2 && n <= 3 && (await hoja.locator('.rut-tarjeta[data-primera] .rut-sello').count()) === 1 && (await hoja.locator('.rut-porque-l').count()) >= n,
      `sus recomendadas: ${n}, la primera marcada («La que mejor te encaja») y cada una con su porqué`);
    check((await hoja.locator('.rut-tarjeta img.rut-img').count()) >= 1 && (await hoja.locator('.rut-temporada .rut-fila').count()) >= 1, 'con su ilustración; y aparte, las de temporada (de viaje, mantenimiento)');
    await desborda(p, 'las rutinas recomendadas');
    await hoja.locator('.rut-tarjeta').first().getByRole('button', { name: 'Ver sus días' }).click();
    await hoja.locator('.rut-ficha').waitFor();
    const tf = await hoja.textContent();
    check(/Para quién/.test(tf) && /Cuánto dura/.test(tf) && /Qué hace falta/.test(tf) && (await hoja.locator('.rut-dia').count()) >= 2 && (await hoja.locator('.rut-dia[open] .rut-ej').count()) >= 3,
      'la ficha: para quién, cuánto dura, qué hace falta y sus días con sus ejercicios');
    await desborda(p, 'la ficha de una rutina');
    await hoja.getByRole('button', { name: 'Volver' }).click();
    await hoja.getByRole('button', { name: /Ver todo el catálogo/ }).click();
    await hoja.locator('.rut-catalogo').waitFor();
    const total = await hoja.locator('.rut-fila').count();
    const laTuya = await hoja.locator('.rut-fila[data-actual]').count();
    await hoja.locator('.rut-filtro').first().getByRole('button', { name: '3 días' }).click();
    const tres = await hoja.locator('.rut-fila').count();
    check(total >= 8 && laTuya === 1 && tres > 0 && tres < total && /ceñirte a tus recomendadas/.test(await hoja.textContent()), `todo el catálogo (${total}), con la suya marcada, el filtro por días (${tres} de 3 días) y el consejo de ceñirse a las recomendadas`);
    await desborda(p, 'el catálogo de rutinas');
    await hoja.getByRole('button', { name: 'Volver a mis recomendadas' }).click();
    await hoja.locator('.rut-tarjeta').nth(1).getByRole('button', { name: 'Elegir esta' }).click();
    await hoja.locator('.rut-confirmar').waitFor();
    const tc = await hoja.textContent();
    check(/Empiezas con ella el lunes/.test(tc) && /sigues con tus kilos/.test(tc) && /al menos 12/.test(tc) && (await hoja.getByRole('button', { name: 'Cambiar de todos modos' }).count()) === 1,
      'al confirmar: desde qué lunes, sus kilos y, con una semana en la suya, el aviso de las 12 semanas («Cambiar de todos modos»)');
    if (await hoja.locator('.rut-tecla').count()) check((await hoja.locator('.rut-tecla[aria-pressed="true"]').count()) >= 2, '(y sus días, si aún no los había elegido)');
    await hoja.getByRole('button', { name: 'Cambiar de todos modos' }).click();
    const despues = await tuya.locator('.rut-despues').waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check(despues && /Desde el lunes/.test(await tuya.locator('.rut-despues').textContent()), 'elegida: «Tu rutina» dice desde qué lunes y cuál');
    await p.locator('nav.tabs').getByRole('button', { name: /Hoy/ }).click();
    const enHoy = await p.locator('.rut-tuya .rut-despues').waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check(enHoy, 'y en Hoy también, mientras esté pendiente');
    await desborda(p, 'Hoy de Tomás, con un cambio de rutina pendiente');
    await p.locator('.rut-tuya').getByRole('button', { name: 'Seguir con la mía' }).click();
    const fuera = await p.locator('.rut-tuya .rut-despues').waitFor({ state: 'detached', timeout: 15000 }).then(() => true).catch(() => false);
    check(fuera, '«Seguir con la mía»: el cambio se quita');
    await ctx.close();
  }
  // Marina, con experiencia, un viernes: tras su cuestionario, «Elige tu rutina» («Tus gustos», sus recomendadas y elegir);
  // la app le prepara el plan con esa rutina y, antes de su lunes, la cambia: el plan se rehace.
  {
    const hoyM = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
    const dM = new Date(`${hoyM}T12:00:00Z`);
    const viernes = new Date(dM.getTime() + (4 - ((dM.getUTCDay() + 6) % 7)) * 864e5).toISOString().slice(0, 10);
    const alas10 = [1, 2].map((o) => new Date(`${viernes}T10:00:00+0${o}:00`)).find((d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) === '10:00');
    const { ctx, p } = await movil();
    await ctx.addInitScript(() => { try { localStorage.setItem('fbe-bienvenida-vista', '1'); } catch { /* sin almacenamiento */ } });
    await ctx.clock.setFixedTime(alas10);
    await entrar(p, /Marina/);
    await cerrar(p);
    const hero = p.locator('section.hero-espera');
    await hero.first().waitFor({ timeout: 15000 }).catch(() => {});
    await hero.getByRole('button', { name: /Empezar|Seguir/ }).click();
    let hoja = p.locator('[aria-modal="true"]').last();
    await hoja.getByRole('button', { name: 'Siguiente' }).waitFor();
    await hoja.locator('.opciones button, [role="group"] button').first().click();
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(300);
    const g2 = hoja.locator('[role="group"]');
    for (let i = 0; i < await g2.count(); i++) await g2.nth(i).locator('button').first().click().catch(() => {});
    await hoja.getByRole('button', { name: 'De 1 a 3 años' }).click();
    await hoja.getByRole('group', { name: 'Días a la semana' }).getByRole('button', { name: '3', exact: true }).click();
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(300);
    await hoja.locator('[role="group"]').first().locator('button').first().click().catch(() => {});
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(300);
    const g4 = hoja.locator('[role="group"]');
    for (let i = 0; i < await g4.count(); i++) {
      const g = g4.nth(i);
      if (await g.getByRole('button', { name: /^No$/ }).count()) await g.getByRole('button', { name: /^No$/ }).click();
      if (await g.locator('label.ninguna input').count()) await g.locator('label.ninguna input').check();
    }
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(400);
    await hoja.getByRole('button', { name: 'Enviar', exact: true }).click();
    await p.locator('[aria-modal="true"]').last().getByRole('button', { name: 'Hecho' }).click({ timeout: 15000 });
    await cerrar(p);
    const elige = await p.waitForFunction(() => /Elige tu rutina/.test(document.querySelector('section.hero-espera')?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
    check(elige, 'con experiencia, tras el cuestionario: «Elige tu rutina» (la app no le pone un plan sin preguntarle)');
    await hero.getByRole('button', { name: 'Empezar' }).click();
    hoja = p.locator('[aria-modal="true"]').last();
    await hoja.locator('.rut-gustos').waitFor();
    const preguntas = await hoja.locator('.rut-leyenda').allTextContents();
    check(preguntas.length === 6 && /Entrenas fuerza ahora mismo/.test(preguntas[0]) && /Te manejas con/.test(preguntas[1]) && /con barra/.test(preguntas[2]) && !/Cuántos días/.test(preguntas.join()),
      `«Tus gustos»: seis preguntas cortas (las tres primeras deciden si le hacen falta las cuatro primeras semanas)`);
    await desborda(p, '«Tus gustos»');
    for (const q of await hoja.locator('.rut-pregunta').all()) await q.locator('button').first().click();
    await hoja.getByRole('button', { name: 'Ver mis rutinas recomendadas' }).click();
    await hoja.locator('.rut-recomendadas').waitFor();
    const elegida = (await hoja.locator('.rut-tarjeta').first().locator('.rut-h').textContent()).trim();
    const otra = (await hoja.locator('.rut-tarjeta').nth(1).locator('.rut-h').textContent()).trim();
    await hoja.locator('.rut-tarjeta').first().getByRole('button', { name: 'Elegir esta' }).click();
    await hoja.locator('.rut-confirmar').waitFor();
    check(/La app te prepara tu plan con ella/.test(await hoja.textContent()) && (await hoja.locator('.rut-tecla').count()) === 7 && (await hoja.locator('.rut-tecla[aria-pressed="true"]').count()) === 3,
      'al confirmar: «La app te prepara tu plan con ella» y elige sus tres días');
    await hoja.getByRole('button', { name: 'Elegir esta rutina' }).click();
    const conPlan = await p.waitForFunction(() => /Empiezas el lunes/.test(document.querySelector('section.hero-espera')?.textContent || ''), null, { timeout: 20000 }).then(() => true).catch(() => false);
    const nombres = () => p.evaluate(() => { const d = JSON.parse(localStorage.getItem('fbe-demo-esencial-v2') || '{}'); const a = (d.atletas || []).find((x) => x.email === 'marina@fbe.demo'); return (d.bloques || []).filter((b) => !b.es_plantilla && b.atleta_id === a?.id).map((b) => b.nombre); });
    await p.waitForTimeout(600);
    const b1 = await nombres();
    check(conPlan && b1.length === 1 && /Full body/.test(b1[0]) && elegida.length > 0, `y la app le prepara su plan con esa rutina («${b1[0] || ''}»), desde su lunes`);
    // antes de su lunes: «Tu rutina» en Hoy, y la cambia
    const tuya = p.locator('.rut-tuya');
    const hayTuya = await tuya.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check(hayTuya && /Empiezas el lunes/.test(await tuya.textContent()) && /tu plan se rehace/.test(await tuya.textContent()), 'en Hoy, antes de su lunes: «Tu rutina», y que aún puede cambiarla');
    await tuya.scrollIntoViewIfNeeded().catch(() => {});
    await tuya.getByRole('button', { name: 'Cambiar de rutina' }).click();
    hoja = p.locator('[aria-modal="true"]').last();
    await hoja.locator('.rut-recomendadas').waitFor();
    await hoja.locator('.rut-tarjeta').first().getByRole('button', { name: 'Elegir esta' }).click();
    await hoja.locator('.rut-confirmar').waitFor();
    check(/Tu plan empieza con ella el lunes/.test(await hoja.textContent()), 'al cambiarla antes de empezar: «Tu plan empieza con ella el lunes…»');
    await hoja.getByRole('button', { name: 'Elegir esta rutina' }).click();
    await hoja.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(900);
    const b2 = await nombres();
    check(b2.length === 1 && b2[0] !== b1[0] && otra.length > 0, `su plan se rehace con la nueva («${b2[0] || ''}») y sigue teniendo uno solo`);
    await desborda(p, 'Hoy de Marina, con su rutina elegida');
    await ctx.close();
  }
  // Marina, con menos de un año y más de tres meses parada: la criba la manda a «Primeras 4 semanas», y la hoja se lo
  // explica antes de cerrarse (antes se cerraba sola al guardar sus gustos, sin decirle por qué no elegía rutina)
  {
    // (un viernes, como arriba: así su plan empieza el lunes siguiente, sea cual sea el día en que se pasa la prueba)
    const hoyM = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
    const dM = new Date(`${hoyM}T12:00:00Z`);
    const viernes = new Date(dM.getTime() + (4 - ((dM.getUTCDay() + 6) % 7)) * 864e5).toISOString().slice(0, 10);
    const alas10 = [1, 2].map((o) => new Date(`${viernes}T10:00:00+0${o}:00`)).find((d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) === '10:00');
    const { ctx, p } = await movil();
    await ctx.addInitScript(() => { try { localStorage.setItem('fbe-bienvenida-vista', '1'); } catch { /* sin almacenamiento */ } });
    await ctx.clock.setFixedTime(alas10);
    await entrar(p, /Marina/);
    await cerrar(p);
    const hero = p.locator('section.hero-espera');
    await hero.first().waitFor({ timeout: 15000 }).catch(() => {});
    await hero.getByRole('button', { name: /Empezar|Seguir/ }).click();
    let hoja = p.locator('[aria-modal="true"]').last();
    await hoja.getByRole('button', { name: 'Siguiente' }).waitFor();
    await hoja.locator('.opciones button, [role="group"] button').first().click();
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(300);
    const g2 = hoja.locator('[role="group"]');
    for (let i = 0; i < await g2.count(); i++) await g2.nth(i).locator('button').first().click().catch(() => {});
    await hoja.getByRole('button', { name: 'Menos de un año' }).click();
    await hoja.getByRole('group', { name: 'Días a la semana' }).getByRole('button', { name: '3', exact: true }).click();
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(300);
    await hoja.locator('[role="group"]').first().locator('button').first().click().catch(() => {});
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(300);
    const g4 = hoja.locator('[role="group"]');
    for (let i = 0; i < await g4.count(); i++) {
      const g = g4.nth(i);
      if (await g.getByRole('button', { name: /^No$/ }).count()) await g.getByRole('button', { name: /^No$/ }).click();
      if (await g.locator('label.ninguna input').count()) await g.locator('label.ninguna input').check();
    }
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(400);
    await hoja.getByRole('button', { name: 'Enviar', exact: true }).click();
    await p.locator('[aria-modal="true"]').last().getByRole('button', { name: 'Hecho' }).click({ timeout: 15000 });
    await cerrar(p);
    await p.waitForFunction(() => /Elige tu rutina/.test(document.querySelector('section.hero-espera')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    await hero.getByRole('button', { name: 'Empezar' }).click();
    hoja = p.locator('[aria-modal="true"]').last();
    await hoja.locator('.rut-gustos').waitFor();
    const qs = await hoja.locator('.rut-pregunta').all();
    for (const [i, q] of qs.entries()) await (i === 0 ? q.getByRole('button', { name: 'Llevo más de tres meses sin entrenar' }) : q.locator('button').first()).click();
    await hoja.getByRole('button', { name: 'Ver mis rutinas recomendadas' }).click();
    const explica = await p.getByRole('heading', { name: 'Empiezas por las primeras 4 semanas' }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    hoja = p.locator('[aria-modal="true"]').last();
    const txt = explica ? await hoja.textContent() : '';
    check(explica && /Con lo que nos cuentas, lo mejor es empezar por las cuatro semanas/.test(txt) && /Al llegar a la semana 4 eliges con qué rutina sigues/.test(txt) && (await hoja.locator('.rut-tarjeta').count()) === 0,
      'la criba: menos de un año y más de tres meses parada → la hoja le explica que empieza por «Primeras 4 semanas» (sin ofrecerle otras)');
    await desborda(p, '«Empiezas por las primeras 4 semanas»');
    await hoja.getByRole('button', { name: 'De acuerdo' }).click();
    const conPlan = await p.waitForFunction(() => /Empiezas el lunes/.test(document.querySelector('section.hero-espera')?.textContent || ''), null, { timeout: 20000 }).then(() => true).catch(() => false);
    // (la demo guarda su copia un instante después de pintar: como arriba, se le da ese margen antes de leerla)
    await p.waitForTimeout(600);
    const suyos = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('fbe-demo-esencial-v2') || '{}'); const a = (d.atletas || []).find((x) => x.email === 'marina@fbe.demo'); return (d.bloques || []).filter((b) => !b.es_plantilla && b.atleta_id === a?.id).map((b) => b.nombre); });
    check(conPlan && suyos.length === 1 && suyos[0] === 'Primeras 4 semanas', `y al cerrarla la app le prepara su plan: «${suyos[0] || ''}»`);
    await ctx.close();
  }
  // ---------- (acompañamiento, tanda 4; v0.245) Respuestas: todo explicado, con Tomás (su semana 5) ----------
  {
    const { ctx, p } = await movil();
    await entrar(p, /Tomás/);
    await p.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click().catch(() => {});
    await cerrar(p);
    await p.waitForFunction(() => /Novato 2 días · FBE Esencial/.test(document.querySelector('.hero-dia')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1200);
    await cerrar(p);
    const seguir = p.getByRole('button', { name: 'Seguir', exact: true }).first();
    if (await seguir.isVisible().catch(() => false)) { await seguir.click(); await p.waitForTimeout(400); }
    // Su revisión de la semana: la tarjeta, la hoja y, leída, se queda en una línea
    const tarjeta = p.locator('.ayu-rev-tarjeta');
    const conTarjeta = await tarjeta.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check(conTarjeta && /Tu revisión de la semana 5/.test(await tarjeta.textContent()), 'Tomás, en su semana 5: «Tu revisión de la semana 5» en Hoy');
    if (conTarjeta) {
      await tarjeta.getByRole('button', { name: 'Leer mi revisión' }).click();
      let hoja = p.locator('[aria-modal="true"]').last();
      const lista = await hoja.locator('.ayu-rev-t').waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      const t = lista ? await hoja.textContent() : '';
      check(lista && /Tu plan desde hoy sale de tus marcas/.test(t) && /Empiezas con 85 kg: sale de lo que moviste en tu semana de marcas/.test(t) && /hiciste tus 2 sesiones/.test(t) && (await hoja.locator('.ayu-fila').count()) >= 5,
        'la revisión: lo que hizo, con qué empieza cada ejercicio (85 kg en la prensa: de sus marcas) y por qué');
      check(/Esta semana, una sola cosa/.test(t) && /No la ha leído nadie/.test(t) && (await hoja.locator('.ayu-momento').count()) === 0, 'con una sola cosa en la que fijarse, dicho que no la ha leído nadie, y sin lo que está apagado');
      await hoja.locator('.ayu-palabra', { hasText: 'Te sobran' }).click();
      check(/dos más/.test(await hoja.locator('.ayu-def').textContent().catch(() => '')), 'las palabras se explican al tocarlas («Te sobran»)');
      await desborda(p, 'la revisión de la semana');
      await hoja.locator('.cerrar-hoja').click();
      const leida = await p.locator('.ayu-rev-linea').waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
      check(leida && (await p.locator('.ayu-rev-tarjeta').count()) === 0, 'leída, la tarjeta se queda en una línea para releerla');
    }
    // (acompañamiento, tanda 5; v0.246) Que no entrenen solos: el saludo del día, el reto de la semana, el diario y «¿Cómo vamos?»
    // (de jueves a domingo, su última sesión, la del jueves pasado, queda a siete días o más: en lugar del saludo sale «Llevas
    // N días sin entrenar», que es lo que toca; la prueba vale los dos)
    const saludo = p.locator('.cer-saludo');
    const vuelta = p.locator('.cer-vuelta');
    const conSaludo = await saludo.or(vuelta).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    const enVuelta = conSaludo && !(await saludo.count()) && (await vuelta.count()) > 0;
    const tSaludo = conSaludo ? ((enVuelta ? await vuelta.textContent() : await saludo.textContent()) || '') : '';
    check((await p.locator('.cer-nota').count()) === 0 && (await p.locator('.cer-dia').count()) === 0, 'sin la nota de Pelayo ni el día a día (apagados hasta que los vea)');
    check(conSaludo && (enVuelta ? /Llevas \d+ días sin entrenar/.test(tSaludo) : /Hoy toca|Mañana toca|te quedan? |Hoy descansas|Ayer entrenaste|Semana hecha/.test(tSaludo)) && !/coach/i.test(tSaludo),
      `arriba en Hoy, el saludo del día (o, desde el jueves, «Llevas N días sin entrenar») («${tSaludo.replace(/\s+/g, ' ').trim().slice(0, 60)}…»)`);
    const reto = p.locator('.cer-reto');
    await reto.scrollIntoViewIfNeeded().catch(() => {});
    check(/Reto de la semana: tus 2 sesiones\. Llevas 0\./.test(await reto.textContent().catch(() => '')) && /0\/2/.test(await reto.textContent().catch(() => '')), 'el reto de la semana: sus dos sesiones (con menos de cinco personas, sin cifras de los demás)');
    const vamos = p.locator('.cer-vamos');
    const conVamos = await vamos.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(conVamos && /Un mes ya\. ¿Cómo vamos\?/.test(await vamos.textContent()) && (await vamos.locator('.cer-n').count()) === 10, 'en su semana 5, «Un mes ya. ¿Cómo vamos?», del 1 al 10');
    if (conVamos) {
      await vamos.getByRole('button', { name: '9', exact: true }).click();
      await vamos.locator('.cer-area').fill('Me gustaría ver mis vídeos de técnica');
      await desborda(p, 'Hoy con «¿Cómo vamos?»');
      await vamos.getByRole('button', { name: 'Enviar' }).click();
      const fuera = await p.waitForFunction(() => !document.querySelector('.cer-vamos'), null, { timeout: 10000 }).then(() => true).catch(() => false);
      check(fuera, 'pone un 9, cuenta qué echa de menos y, enviada, la tarjeta se va');
    }
    await p.locator('.cer-pie').getByRole('button', { name: /Lo que la app ha hecho por ti/ }).click();
    let hojaC = p.locator('[aria-modal="true"]').last();
    await hojaC.locator('.cer-diario').waitFor({ timeout: 10000 }).catch(() => {});
    check((await hojaC.locator('.cer-diario-f').count()) >= 2 && /Te preparó tu plan: «Novato 2 días · FBE Esencial»/.test(await hojaC.textContent()) && /«Primeras 4 semanas»/.test(await hojaC.textContent()),
      '«Lo que la app ha hecho por ti»: cada decisión con su porqué (sus dos planes)');
    await desborda(p, 'el diario de la app');
    await hojaC.locator('.cerrar-hoja').click();
    await p.locator('.cer-pie').getByRole('button', { name: /Lo que llevas/ }).click();
    hojaC = p.locator('[aria-modal="true"]').last();
    const conTri = await p.waitForFunction(() => /Aún no hay bastante que comparar|semanas?: tu trimestre|Lo que llevas:/.test(document.querySelector('.cer-trimestre')?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
    check(conTri, '«Lo que llevas»: con una sola semana de su rutina nueva, aún no hay con qué comparar (y lo dice)');
    await hojaC.locator('.cerrar-hoja').click();
    // «¿Qué necesitas?»: el centro de respuestas (en su respuesta), el buscador y su plan; (v0.251) sin la pregunta para el
    // directo, que está oculto (FBE Esencial no tiene directos) hasta que Pelayo lo encienda en su panel
    const nec = p.locator('.ayu-necesitas');
    await nec.scrollIntoViewIfNeeded().catch(() => {});
    check((await nec.locator('.ayu-nec').count()) === 11 && /Me voy de viaje/.test(await nec.textContent()) && !/Preguntar a Pelayo/.test(await nec.textContent()) && !/Estoy enfermo|semana suave/.test(await nec.textContent()),
      'en Hoy, «¿Qué necesitas?»: lo que más se pregunta, a un toque (ni lo apagado ni el directo, que está oculto)');
    // (v0.247) «Me duele algo»: dónde y cuánto → qué hacer con su plan mientras tanto (los textos de su check-in); y de ahí, a su respuesta
    await nec.getByRole('button', { name: 'Me duele algo' }).click();
    const hMol = p.locator('[aria-modal="true"]').last();
    await hMol.locator('.vid-molestia').waitFor({ timeout: 15000 }).catch(() => {});
    await hMol.getByRole('button', { name: 'Zona lumbar' }).click();
    await hMol.getByRole('button', { name: 'Moderada' }).click();
    check(/Con una molestia moderada: baja la carga, no pares del todo/.test(await hMol.locator('.vid-que').textContent().catch(() => '')) && /hasta 5 sobre 10/.test(await hMol.textContent()) && /Nada de esto se guarda/.test(await hMol.textContent()),
      '«Me duele algo»: con la zona y la intensidad, qué hacer con su plan mientras tanto (sin guardar nada)');
    await desborda(p, '«Me duele algo»');
    await hMol.getByRole('button', { name: '¿Cuándo preocuparse?' }).click();
    let hoja = p.locator('[aria-modal="true"]').last();
    await hoja.locator('.ayu-p[open]').waitFor({ timeout: 10000 }).catch(() => {});
    check(/La app no valora el dolor/.test(await hoja.locator('.ayu-p[open]').textContent().catch(() => '')) && (await hoja.locator('.ayu-p').count()) === 4 && (await hoja.locator('.ayu-pendiente').count()) === 0,
      'y de ahí, «Respuestas» en su respuesta; de salud, solo las cuatro ya aprobadas');
    await hoja.locator('.ayu-buscar-c').fill('maquina ocupada');
    check(/La máquina está ocupada/.test(await hoja.locator('.ayu-p').first().textContent().catch(() => '')), 'el buscador encuentra sin tildes («maquina ocupada»)');
    await hoja.locator('.ayu-buscar-c').fill('');
    await hoja.getByRole('button', { name: 'Todos los temas' }).click();
    check((await hoja.locator('.ayu-cat').count()) === 9, 'y sus nueve temas (con «Antes de empezar», v0.248)');
    const conEquipo = await hoja.locator('.ayu-pie', { hasText: 'Pregúntala en Equipo' }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(conEquipo && /¿No está tu duda\? Pregúntala en Equipo, la comunidad de la app/.test(await hoja.locator('.ayu-pie').textContent()) && !/directo/i.test(await hoja.textContent()),
      '(v0.251) sin el directo: si la duda no está, «Pregúntala en Equipo» (la comunidad, abierta en la demo); del directo, nada');
    await desborda(p, 'el centro de respuestas');
    await hoja.locator('.cerrar-hoja').click();
    await p.locator('[aria-modal="true"]').last().locator('.cerrar-hoja').click();   // (y «Me duele algo», que estaba debajo)
    await nec.getByRole('button', { name: 'Entender mi plan' }).click();
    hoja = p.locator('[aria-modal="true"]').last();
    await hoja.locator('.ayu-camino').waitFor({ timeout: 10000 }).catch(() => {});
    await p.waitForFunction(() => /min/.test(document.querySelector('.ayu-sesiones')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
    const tPlan = await hoja.textContent();
    check(/Novato 2 días · FBE Esencial · semana 5/.test(tPlan) && (await hoja.locator('.ayu-sesion').count()) === 2 && /unos \d+ min · 5 ejercicios/.test(tPlan) && /Cómo progresa/.test(tPlan) && /Cada doce semanas/.test(tPlan),
      '«Tu plan, explicado»: sus dos sesiones, lo que duran, cómo progresa y qué pasa cada cuatro y cada doce semanas');
    check(/estás aquí/.test(await hoja.locator('.ayu-paso[aria-current="step"]').textContent().catch(() => '')) && /La app te prepara cada semana/.test(await hoja.locator('.ayu-paso[aria-current="step"]').textContent().catch(() => '')) && (await hoja.locator('.ayu-paso[data-estado="hecho"]').count()) === 3,
      'y «Tu camino»: está en «La app te prepara cada semana», con sus tres tramos anteriores hechos');
    await desborda(p, 'tu plan, explicado');
    await hoja.locator('.cerrar-hoja').click();
    // Un aviso que lleva a su explicación: «#hoy/lunes» abre la revisión
    await p.evaluate(() => { location.hash = '#hoy/lunes'; });
    const abierta = await p.locator('[aria-modal="true"] .ayu-revision').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(abierta && (await p.evaluate(() => location.hash)) === '#hoy', 'un aviso que lleva a «#hoy/lunes» abre su revisión de la semana (y el enlace vuelve a «#hoy»)');
    if (abierta) await p.locator('[aria-modal="true"]').last().locator('.cerrar-hoja').click();
    // …y con la app cerrada (se abre en frío desde el aviso: la dirección pasa a «#hoy» antes de que cargue la ayuda)
    {
      await p.waitForTimeout(600);
      const p2 = await ctx.newPage();
      vigilar(p2);
      await p2.goto(`${base}/?demo=esencial#hoy/lunes`);
      await p2.locator('nav.tabs').waitFor({ timeout: 30000 });
      const enFrio = await p2.locator('[aria-modal="true"] .ayu-revision').waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
      check(enFrio && (await p2.evaluate(() => location.hash)) === '#hoy', 'y con la app cerrada, al abrirla desde el aviso, también');
      await p2.close();
    }
    // La sesión: «Lo de hoy» en la portada y, en cada ejercicio, «¿Por qué esto?» y «Dudas»
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión/ }).first().click();
    const portada = p.locator('.portada-vista');
    await portada.waitFor({ timeout: 10000 }).catch(() => {});
    const hoy = portada.locator('.ayu-hoy');
    const conHoy = await hoy.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(conHoy && /Lo de hoy, en 20 segundos/.test(await hoy.textContent()) && /Unos \d+ minutos: 5 ejercicios, 14 series/.test(await hoy.textContent()) && /Lo importante: Prensa de piernas/.test(await hoy.textContent()),
      'en la portada de la sesión, «Lo de hoy, en 20 segundos»: lo que dura y lo importante');
    await desborda(p, 'la portada con «Lo de hoy»');
    await portada.getByRole('button', { name: /^\s*Empezar\s*$/ }).last().click();
    await p.locator('article.ejercicio, .enfoque').first().waitFor({ timeout: 15000 });
    const ej = p.locator('.ayu-ej').first();
    const conEj = await ej.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    if (conEj) {
      await ej.getByRole('button', { name: '¿Por qué esto?' }).click();
      const dicho = await p.waitForFunction(() => /semana de marcas/.test(document.querySelector('.ayu-ej .ayu-ej-x')?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
      check(dicho && /Empiezas con 85 kg/.test(await ej.locator('.ayu-ej-x').textContent()), 'en el ejercicio, «¿Por qué esto?»: «Empiezas con 85 kg: sale de lo que moviste en tu semana de marcas»');
      await ej.getByRole('button', { name: 'Dudas' }).click();
      check((await ej.locator('.ayu-ej-d .ayu-palabra').count()) === 5, 'y «Dudas»: las cinco de siempre');
      await ej.getByRole('button', { name: 'No llego a las repeticiones' }).click();
      check(/Apunta las que hagas, sin maquillarlas/.test(await ej.locator('.ayu-ej-x').textContent().catch(() => '')), 'con su respuesta en el sitio («No llego a las repeticiones»)');
      await desborda(p, 'el ejercicio con su «¿Por qué?» y sus dudas');
    } else check(false, 'en el ejercicio, «¿Por qué esto?» y «Dudas»');
    // Pelayo, en su panel de FBE Esencial: (v0.251) con el directo oculto, ni sus preguntas ni su recuento
    await salirDeLaCuenta(p);
    await p.setViewportSize({ width: 1280, height: 900 });
    const alPanel = async () => {
      await p.goto(`${base}/?demo=esencial`);
      await p.getByRole('button', { name: /Coach: panel/ }).first().click();
      await p.getByRole('heading', { name: 'Atletas' }).first().waitFor({ timeout: 30000 });
      await p.waitForTimeout(1200);
      await cerrar(p);
      const pl = p.locator('details.corr-panel').filter({ hasText: 'FBE Esencial' });
      if ((await pl.getAttribute('open').catch(() => null)) === null) await pl.locator('summary').click().catch(() => {});
      return pl;
    };
    const piloto = await alPanel();
    let directoEncendido = false;
    // (tanda 6) la semana de FBE Esencial, en cifras
    const rs = piloto.locator('.ecp-caja[data-ecp="semana"]');
    const conRs = await rs.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(conRs && /Esta semana, en FBE Esencial/.test(await rs.textContent()) && /con semana en marcha/.test(await rs.textContent()) && (await rs.locator('.ecp-cifra').count()) >= 3 && !/directo/.test(await rs.textContent()),
      'y el resumen de la semana: cuántos han entrenado y cuántos la tienen completa (del directo, oculto, nada)');
    check(!(await piloto.locator('.ecp-caja[data-ecp="directo"]').count()), '(v0.251) con el directo oculto, en su panel no sale «Preguntas para el directo»');
    // (tanda 5) y lo que Tomás contestó a «¿Cómo vamos?»; y a quién escribir, con el mensaje preparado
    const cv = piloto.locator('.ecp-caja[data-ecp="vamos"]');
    const conCv = await cv.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(conCv && /«¿Cómo vamos\?»: 9 de 10 \(una respuesta\)/.test(await cv.textContent()) && /ver mis vídeos de técnica/.test(await cv.textContent()), 'y «¿Cómo vamos?»: 9 de 10, con lo que echa de menos');
    const esc = piloto.locator('.ecp-caja[data-ecp="escribir"]');
    if (await esc.count()) {
      await esc.getByRole('button', { name: 'Ver el mensaje preparado' }).first().click();
      const msg = await esc.locator('.ecp-area').first().inputValue().catch(() => '');
      check(/^Hola, [^:]+:/.test(msg) && /Pelayo$/.test(msg) && /La app no envía nada/.test(await esc.textContent()), '«A quién escribir»: con el mensaje preparado para copiar (lo manda él: la app no envía nada)');
      // (v0.249, 90) «Ya le he escrito»: sale de la lista una semana y queda apuntado abajo
      const cuantos = async () => Number(((await esc.locator('#ecp-escribir-t').textContent()) || '').match(/\((\d+)\)/)?.[1] || -1);
      const antes = await cuantos();
      const quien = ((await esc.locator('.ecp-fila').first().locator('button.btn-texto').first().textContent()) || '').trim();
      await esc.getByRole('button', { name: 'Ya le he escrito' }).first().click();
      const apuntado = await p.waitForFunction(() => /Ya les has escrito esta semana/.test(document.querySelector('.ecp-caja[data-ecp="escribir"]')?.textContent || ''), null, { timeout: 10000 }).then(() => true).catch(() => false);
      const despues = await cuantos();
      check(apuntado && despues === antes - 1 && ((await esc.textContent()) || '').includes(`Ya les has escrito esta semana: ${quien}`), `«Ya le he escrito» (v0.249): ${quien} sale de la lista y queda apuntado abajo (${antes} → ${despues})`);
    }
    // (v0.249, tanda 8) «Por revisar y el piloto»: lo apagado con su interruptor, sus textos, el registro con «Deshacer»…
    const prv = piloto.locator('details.prv-caja');
    const conPrv = await prv.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    if (conPrv) {
      await prv.locator('summary').click();
      const items = prv.locator('.prv-item');
      await items.first().waitFor({ timeout: 10000 }).catch(() => {});
      // (las cosas apagadas; debajo, «Los avisos y tu lunes», con la misma clase pero sin «Ver como en la demo»)
      const nItems = await items.filter({ has: p.getByRole('link', { name: /Ver como en la demo/ }) }).count();
      check(nItems === 25 && /25 cosas apagadas/.test(await prv.locator('summary').textContent()), `«Por revisar»: las 25 cosas apagadas, cada una con su interruptor (${nItems})`);
      const enfermo = items.filter({ hasText: '«Estoy enfermo»' });
      await enfermo.locator('input[role="switch"]').check();
      const encendida = await p.waitForFunction(() => /24 cosas apagadas/.test(document.querySelector('details.prv-caja summary')?.textContent || ''), null, { timeout: 10000 }).then(() => true).catch(() => false);
      const reg = prv.locator('[aria-labelledby="prv-reg-t"]');
      const conReg = await reg.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      check(encendida && conReg && /Encendiste «Estoy enfermo»/.test(await reg.textContent()), 'al encender «Estoy enfermo»: 24 apagadas y, en «Lo que has cambiado», «Encendiste «Estoy enfermo»»');
      if (conReg) {
        await reg.getByRole('button', { name: /Deshacer/ }).click();
        const deshecho = await p.waitForFunction(() => /25 cosas apagadas/.test(document.querySelector('details.prv-caja summary')?.textContent || ''), null, { timeout: 10000 }).then(() => true).catch(() => false);
        check(deshecho && !(await enfermo.locator('input[role="switch"]').isChecked()) && /Quitaste lo tuyo de «Estoy enfermo»/.test(await reg.textContent()), '«Deshacer»: vuelve a estar apagada (y queda apuntado)');
      }
      // sus textos: escribe la nota del lunes de la semana 1 (apagada: nadie la ve aún) y vuelve a la de la app
      await items.filter({ hasText: 'Tu nota de cada lunes' }).getByRole('button', { name: /Sus textos/ }).click();
      const ht = p.locator('[aria-modal="true"]').last();
      const conHt = await ht.locator('.prv-area').first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      if (conHt) {
        check(/Escritos por ti: 0 de 8/.test(await ht.textContent()), 'sus textos: las ocho notas de los lunes (semanas 1 a 6, 8 y 12), ninguna escrita aún');
        await ht.locator('.prv-area').first().fill('Semana 1: lo único que cuenta es venir. Nos vemos dentro.');
        await ht.getByRole('button', { name: /Guardar/ }).first().click();
        const escrita = await p.waitForFunction(() => /Escritos por ti: 1 de 8/.test(document.body.textContent), null, { timeout: 10000 }).then(() => true).catch(() => false);
        check(escrita && /Semana 1 · el tuyo/.test(await ht.textContent()), 'escribe la de la semana 1: «Escritos por ti: 1 de 8» y «el tuyo»');
        await ht.getByRole('button', { name: /El de la app/ }).first().click();
        await ht.getByRole('button', { name: /Guardar/ }).first().click();
        const vuelta = await p.waitForFunction(() => /Escritos por ti: 0 de 8/.test(document.body.textContent), null, { timeout: 10000 }).then(() => true).catch(() => false);
        check(vuelta, 'y «El de la app» + «Guardar» la devuelve a la de la app');
        await ht.locator('.cerrar-hoja').click().catch(() => {});
      } else check(false, 'sus textos: la hoja para escribir las notas de los lunes');
      // (v0.251) «El directo de dudas», en «Los avisos, tu lunes y el directo»: apagado de serie; lo enciende (y abajo, Marina
      // ve la pregunta para el directo y la manda, y a él le sale en su panel)
      const dir = items.filter({ hasText: 'El directo de dudas' });
      check((await dir.count()) === 1 && !(await dir.locator('input[role="switch"]').isChecked()) && /Apagado: FBE Esencial no tiene directos/.test(await dir.textContent()) && /Los avisos, tu lunes y el directo/.test(await prv.textContent()),
        '(v0.251) «El directo de dudas», con su interruptor en «Los avisos, tu lunes y el directo»: apagado de serie');
      await dir.locator('input[role="switch"]').check();
      directoEncendido = await p.waitForFunction(() => /Encendiste El directo de dudas/.test(document.querySelector('[aria-labelledby="prv-reg-t"]')?.textContent || ''), null, { timeout: 10000 }).then(() => true).catch(() => false);
      check(directoEncendido, 'lo enciende y queda en «Lo que has cambiado»');
      // el piloto: «tal cual», la curva y el repaso de seguridad del motor, en el navegador
      await prv.getByRole('tab', { name: 'El piloto' }).click();
      const tc = await prv.locator('#prv-panel').filter({ hasText: '«Tal cual»' }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      check(tc && /semanas terminadas/.test(await prv.locator('#prv-panel').textContent()) && /La curva/.test(await prv.locator('#prv-panel').textContent()), 'el piloto: «Tal cual» (semanas hechas como las propuso la app) y la curva');
      await prv.getByRole('button', { name: /Hacer el repaso/ }).click();
      const repaso = await p.waitForFunction(() => /propuestas en \d+ semanas?: ninguna fuera de regla/.test(document.querySelector('#prv-panel')?.textContent || ''), null, { timeout: 20000 }).then(() => true).catch(() => false);
      check(repaso, 'el repaso de seguridad del motor, desde el panel: «ninguna fuera de regla»');
      // (v0.250, 118) la comida: quién lleva nutrición, quién no tiene aún su plan de comida, quién no se pesa…
      await prv.getByRole('tab', { name: 'La comida' }).click();
      const com = await p.waitForFunction(() => /La comida de FBE Esencial/.test(document.querySelector('#prv-panel')?.textContent || ''), null, { timeout: 10000 }).then(() => true).catch(() => false);
      const tCom = (await prv.locator('#prv-panel').textContent()) || '';
      check(com && /Sin plan de comida todavía: Inés Gil/.test(tCom) && /con su plan de comida/.test(tCom) && /Solo recuentos/.test(tCom), 'la comida (v0.250): quién lleva nutrición y quién no tiene aún su plan de comida (Inés), solo en recuentos');
      // herramientas: Stripe frente a la app
      await prv.getByRole('tab', { name: 'Herramientas' }).click();
      await prv.locator('#prv-panel textarea').first().fill('sub_1,marina@fbe.demo,active\nsub_2,tomas@fbe.demo,canceled\nnadie@x.com active');
      await prv.getByRole('button', { name: 'Comparar' }).click();
      const cmp = await p.waitForFunction(() => /3 suscripciones leídas/.test(document.querySelector('#prv-panel')?.textContent || ''), null, { timeout: 10000 }).then(() => true).catch(() => false);
      const tCmp = (await prv.locator('#prv-panel').textContent()) || '';
      check(cmp && /nadie@x\.com: no tiene ficha en la app/.test(tCmp) && /De baja en Stripe y activos en la app \(1\)/.test(tCmp) && /Tomás Rey/.test(tCmp), 'Stripe frente a la app: quién ha pagado y no tiene acceso y quién se dio de baja y sigue activo');
      await prv.locator('summary').click();
    } else check(false, 'en el panel de FBE Esencial, «Por revisar y el piloto»');
    // (v0.251) con el directo encendido, Marina (aún sin plan) ve «Preguntar a Pelayo» y manda su duda
    await salirDeLaCuenta(p, '"clave":"directo"');
    await p.setViewportSize({ width: 390, height: 844 });
    await entrar(p, /Marina/);
    await p.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click().catch(() => {});
    await cerrar(p);
    const nec2 = p.locator('.ayu-necesitas');
    const conNec = await nec2.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check(conNec && !/Cambiar de rutina|Entender mi plan/.test(await nec2.textContent()), 'Marina, aún sin plan: «¿Qué necesitas?» sin lo que pide tener plan');
    if (conNec) {
      const preg = nec2.getByRole('button', { name: 'Preguntar a Pelayo' });
      const conPreg = directoEncendido && await preg.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      check(conPreg, '(v0.251) con «El directo de dudas» encendido, vuelve «Preguntar a Pelayo» en «¿Qué necesitas?»');
      if (conPreg) {
        await preg.click();
        const hp = p.locator('[aria-modal="true"]').last();
        await hp.locator('.ayu-area').fill('En el peso muerto rumano noto más la espalda que la pierna, ¿qué miro?');
        await hp.getByRole('button', { name: 'Enviar' }).click();
        const enviada = await hp.locator('.ayu-mia').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
        check(enviada && /noto más la espalda/.test(await hp.locator('.ayu-mia').textContent()) && /No es un chat/.test(await hp.textContent()), 'manda su pregunta para el directo del mes (dicho que no es un chat) y le queda en «Tus preguntas»');
        await hp.locator('.cerrar-hoja').click();
      }
      await nec2.getByRole('button', { name: 'Otra cosa' }).click();
      const h2 = p.locator('[aria-modal="true"]').last();
      // (v0.249, 92) «¿Puedo darme de baja?» → «Tu suscripción»: antes del portal, «¿nos dices por qué?» (opcional)
      const catSus = h2.locator('.ayu-cat', { hasText: 'Tu suscripción' });
      if (await catSus.count()) {
        await catSus.first().click();
        const pBaja = h2.locator('.ayu-p[data-id="baja"]');
        const conBaja = await pBaja.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
        if (conBaja) {
          await pBaja.locator('summary').click();
          await pBaja.getByRole('button', { name: /Tu suscripción/ }).click();
          // (la hoja se busca por su enlace: al enviar el motivo, la pregunta «¿nos dices por qué?» deja de estar)
          const hb = p.locator('[aria-modal="true"]').filter({ has: p.getByRole('link', { name: /Ir a mi suscripción/ }) }).last();
          const conHb = await hb.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
          const nOps = conHb ? await hb.locator('.ayu-baja-op').count() : 0;
          check(conHb && nOps === 6 && /¿nos dices por qué\?/.test(await hb.textContent()), `«¿Puedo darme de baja?» → «Tu suscripción»: el porqué, opcional (${nOps} motivos), y el enlace a su suscripción`);
          if (conHb) {
            await hb.getByRole('button', { name: 'Es caro para mí' }).click();
            await hb.getByRole('button', { name: 'Enviarlo' }).click();
            const gracias = await hb.getByText('Gracias por decírnoslo.').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
            check(gracias, 'elige «Es caro para mí» y lo envía: «Gracias por decírnoslo» (a Pelayo le sale en su panel)');
            await hb.locator('.cerrar-hoja').click().catch(() => {});
          }
        } else check(false, 'en «Tu suscripción», «¿Puedo darme de baja?»');
      }
      await h2.locator('.cerrar-hoja').click().catch(() => {});
    }
    // …y a Pelayo le sale en su panel: la contesta y la saca en «Respuestas» para todos
    if (directoEncendido) {
      await salirDeLaCuenta(p, 'noto más la espalda');
      await p.setViewportSize({ width: 1280, height: 900 });
      const caja = (await alPanel()).locator('.ecp-caja[data-ecp="directo"]');
      const conCaja = await caja.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      check(conCaja && /1 sin contestar/.test(await caja.textContent()) && /Marina/.test(await caja.textContent()) && /noto más la espalda/.test(await caja.textContent()), 'Pelayo, en su panel de FBE Esencial: «Preguntas para el directo · 1 sin contestar», con quién pregunta');
      if (conCaja) {
        await caja.getByRole('button', { name: 'Contestar' }).click();
        await caja.locator('.ecp-area').fill('Baja el peso, saca cadera hacia atrás y para cuando la espalda empiece a redondearse.');
        await caja.getByRole('checkbox').check();
        await caja.locator('.ecp-campo').fill('En el peso muerto rumano noto más la espalda que la pierna');
        await caja.getByRole('button', { name: 'Guardar' }).click();
        const guardada = await p.waitForFunction(() => /Tu respuesta \(pública\)/.test(document.querySelector('.ecp-caja[data-ecp="directo"]')?.textContent || ''), null, { timeout: 10000 }).then(() => true).catch(() => false);
        check(guardada && !/sin contestar/.test(await caja.textContent()), 'la contesta y la hace pública (con la pregunta escrita por él, sin el nombre de nadie)');
      }
    }
    await ctx.close();
  }
  // (acompañamiento, tanda 6; v0.247) La vida real: entreno en otro sitio, cambiar un ejercicio y un objetivo con fecha
  {
    const { ctx, p } = await movil();
    await ctx.addInitScript(() => { try { localStorage.setItem('fbe-bienvenida-vista', '1'); } catch { /* sin almacenamiento */ } });
    await entrar(p, /Tomás/);
    await cerrar(p);
    await p.waitForTimeout(1500);
    await cerrar(p);
    const nec = p.locator('.ayu-necesitas');
    const conNec = await nec.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    if (conNec) {
      const modal = () => p.locator('[aria-modal="true"]').last();
      await nec.scrollIntoViewIfNeeded().catch(() => {});
      await nec.getByRole('button', { name: 'Entreno en otro sitio' }).click();
      await modal().locator('.vid-sitio').waitFor({ timeout: 15000 }).catch(() => {});
      await modal().getByRole('button', { name: 'Solo hoy entreno en otro sitio' }).click();
      check(/«¿Dónde entrenas hoy\?» cambia lo que allí no puedas hacer/.test(await modal().locator('.vid-que').textContent().catch(() => '')), '«Entreno en otro sitio», solo hoy: lo arregla la sesión («¿Dónde entrenas hoy?»)');
      await modal().getByRole('button', { name: 'He cambiado de gimnasio' }).click();
      await modal().getByRole('button', { name: 'Ver mis ejercicios' }).click();
      const filas = p.locator('.vid-ejercicios .vid-fila');
      const conFilas = await filas.first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      check(conFilas && (await filas.count()) === 5 && /Va por tiempo: se cambia en cada sesión/.test(await p.locator('.vid-ejercicios').textContent()), 'he cambiado de gimnasio: los cinco ejercicios de su semana (la plancha, que va por tiempo, se cambia en la sesión)');
      if (conFilas) {
        const fila = filas.filter({ hasText: 'Peso muerto rumano' });
        await fila.getByRole('button', { name: 'Cambiar' }).click();
        await desborda(p, '«Cambiar un ejercicio»');
        await fila.locator('.vid-alt').first().click();
        const cambiada = p.locator('.vid-ejercicios .vid-fila', { hasText: 'En lugar de Peso muerto rumano' });
        check(await cambiada.waitFor({ timeout: 10000 }).then(() => true).catch(() => false), 'lo cambia por su alternativa para siempre: su semana ya la lleva («En lugar de Peso muerto rumano…»)');
        await cambiada.getByRole('button', { name: 'Cambiar' }).click().catch(() => {});
        await cambiada.getByRole('button', { name: /Volver a Peso muerto rumano/ }).click().catch(() => {});
        check(await p.locator('.vid-ejercicios .vid-fila', { hasText: 'En lugar de' }).first().waitFor({ state: 'detached', timeout: 10000 }).then(() => true).catch(() => false), 'y puede volver al de su rutina');
      }
      await modal().locator('.cerrar-hoja').click();
      // su objetivo
      await nec.getByRole('button', { name: 'Ponerme un objetivo' }).click();
      await modal().locator('.vid-objetivo-h').waitFor({ timeout: 15000 }).catch(() => {});
      await modal().getByRole('button', { name: 'Apuntar mi objetivo' }).click();
      check(/Escribe qué quieres conseguir/.test(await modal().locator('.error').textContent().catch(() => '')), 'un objetivo: sin texto no se guarda');
      await modal().locator('.vid-area').fill('No faltar ninguna semana hasta el verano');
      const en = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
      await p.locator('#vid-obj-f').fill(en(100));
      await modal().getByRole('button', { name: 'Apuntar mi objetivo' }).click();
      const obj = p.locator('.vid-objetivo');
      const conObj = await obj.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      check(conObj && /No faltar ninguna semana hasta el verano/.test(await obj.textContent()) && /Quedan 1[45] semanas/.test(await obj.textContent()) && (await obj.locator('.vid-barra').count()) === 1, 'apuntado: arriba en Hoy, su objetivo, con lo que queda');
      await desborda(p, 'Hoy con su objetivo');
      if (conObj) {
        await obj.getByRole('button', { name: 'Cambiar' }).click();
        await modal().getByRole('button', { name: 'Quitar mi objetivo' }).click();
        check(await p.locator('.vid-objetivo').waitFor({ state: 'detached', timeout: 10000 }).then(() => true).catch(() => false), 'y lo puede quitar');
      }
      // sin avisos en el móvil ni por correo: se lo dice y le deja el correo a un toque
      const mudo = p.locator('.vid-mudo');
      const conMudo = await mudo.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      check(conMudo && /No te está llegando ningún aviso/.test(await mudo.textContent()), 'sin avisos de ningún tipo: «No te está llegando ningún aviso»');
      if (conMudo) {
        await mudo.getByRole('button', { name: 'Avisarme por correo' }).click();
        check(await mudo.locator('.alta-hecho').waitFor({ timeout: 10000 }).then(() => true).catch(() => false) && /Te llegarán por correo/.test(await mudo.textContent()), 'y los activa por correo de un toque');
      }
    } else check(false, 'la vida real: «¿Qué necesitas?» de Tomás');
    await ctx.close();
  }
  // (tanda 5) «¿Te vas?»: con el reloj en el 15 de diciembre, a Tomás le sale antes de Navidad
  {
    const anio = new Date().getFullYear();
    const dic = [1, 2].map((o) => new Date(`${anio}-12-15T10:00:00+0${o}:00`)).find((d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) === '10:00');
    const { ctx, p } = await movil();
    await ctx.addInitScript(() => { try { localStorage.setItem('fbe-bienvenida-vista', '1'); } catch { /* sin almacenamiento */ } });
    await ctx.clock.setFixedTime(dic);
    await entrar(p, /Tomás/);
    await cerrar(p);
    await p.waitForTimeout(1500);
    await cerrar(p);
    const seguir = p.getByRole('button', { name: 'Seguir', exact: true }).first();
    if (await seguir.isVisible().catch(() => false)) { await seguir.click(); await p.waitForTimeout(400); }
    const va = p.locator('.cer-va');
    const conVa = await va.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    check(conVa && /¿Te vas estas navidades\?/.test(await va.textContent()), 'dos semanas antes de Navidad: «¿Te vas estas navidades?»');
    if (conVa) {
      await va.getByRole('button', { name: 'Sí: ver qué hago' }).click();
      const h = p.locator('[aria-modal="true"]').last();
      const conViaje = await h.locator('.vid-viaje').waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      check(conViaje && (await h.locator('.vid-modo').count()) === 3 && /No voy a entrenar/.test(await h.textContent()) && /Solo se guardan las fechas/.test(await h.textContent()), '(tanda 6) «Sí» abre «Me voy de viaje»: las fechas y tres maneras de irse');
      if (conViaje) {
        await h.getByRole('button', { name: 'Apuntar el viaje' }).click();
        check(/Pon el día que te vas/.test(await h.locator('.error').textContent().catch(() => '')), 'sin fechas no se guarda, y dice qué falta');
        await p.locator('#vid-desde').fill(`${anio}-12-20`);
        await p.locator('#vid-hasta').fill(`${anio + 1}-01-02`);
        await desborda(p, '«Me voy de viaje»');
        await h.getByRole('button', { name: 'Apuntar el viaje' }).click();
        const tarjeta = p.locator('[data-vida="viaje"]');
        const conTarjeta = await tarjeta.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
        check(conTarjeta && /Te vas el \S+ 20 de diciembre/.test(await tarjeta.textContent()) && /no te manda avisos de entreno/.test(await tarjeta.textContent()) && (await p.locator('.cer-va').count()) === 0,
          'apuntado: la pregunta se va y arriba en Hoy sale su viaje («Te vas el… 20 de diciembre»: esos días, sin avisos de entreno)');
        // …y el día 22, ya fuera
        await p.waitForTimeout(700);
        await ctx.clock.setFixedTime(new Date(dic.getTime() + 7 * 864e5));
        await p.reload();
        await p.locator('nav.tabs').waitFor({ timeout: 30000 });
        await cerrar(p);
        const fuera = p.locator('[data-vida="viaje"]');
        const conFuera = await fuera.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
        check(conFuera && /De viaje hasta el \S+ 2 de enero/.test(await fuera.textContent()) && /nada que recuperar/.test(await fuera.textContent()), 'una semana después, fuera: «De viaje hasta el… 2 de enero», sin nada que recuperar');
        if (conFuera) {
          await fuera.getByRole('button', { name: 'Cambiar' }).click();
          const h2 = p.locator('[aria-modal="true"]').last();
          await h2.getByRole('button', { name: 'Al final no me voy: quitarlo' }).click();
          check(await p.locator('[data-vida="viaje"]').waitFor({ state: 'detached', timeout: 10000 }).then(() => true).catch(() => false), '«Al final no me voy» lo quita, y todo sigue como siempre');
        }
      }
    }
    await ctx.close();
  }
  // (tanda 5) Las agujetas: Inés hace su primera sesión un martes y, el miércoles, la app le pregunta
  {
    const hoyM = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
    const dM = new Date(`${hoyM}T12:00:00Z`);
    const dia = (n) => new Date(dM.getTime() + (n - ((dM.getUTCDay() + 6) % 7)) * 864e5).toISOString().slice(0, 10);
    const alas10 = (iso) => [1, 2].map((o) => new Date(`${iso}T10:00:00+0${o}:00`)).find((d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) === '10:00');
    const { ctx, p } = await movil();
    await ctx.addInitScript(() => { try { localStorage.setItem('fbe-bienvenida-vista', '1'); } catch { /* sin almacenamiento */ } });
    await ctx.clock.setFixedTime(alas10(dia(1)));
    await entrar(p, /Inés/);
    await cerrar(p);
    await p.waitForFunction(() => /Día 1/.test(document.querySelector('.hero-dia')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    check((await p.locator('.cer-agujetas').count()) === 0, 'antes de su primera sesión, nadie le pregunta por las agujetas');
    await p.locator('.hero-dia').getByRole('button', { name: /Empezar sesión|Continuar sesión/ }).first().click();
    const portada = p.locator('.portada-vista');
    if (await portada.waitFor({ timeout: 10000 }).then(() => true).catch(() => false)) await portada.getByRole('button', { name: /^\s*Empezar\s*$/ }).last().click();
    await p.locator('article.ejercicio, .enfoque').first().waitFor({ timeout: 15000 });
    await p.getByRole('button', { name: 'Terminar sesión' }).click();
    await p.locator('.hoja-dialogo .segmentos button', { hasText: '8' }).first().click();
    await p.getByRole('button', { name: 'Guardar y terminar' }).click();
    await p.getByRole('heading', { name: 'Sesión terminada' }).waitFor({ timeout: 15000 });
    check((await p.locator('.ayu-hito').count()) === 0, 'al terminar la primera, sin hito repetido (ya tiene «Tu primera sesión, hecha»)');
    await p.waitForTimeout(700);
    // …y al día siguiente
    await ctx.clock.setFixedTime(alas10(dia(2)));
    // (cambiar solo la almohadilla no recarga la página, y con la sesión abierta no se sale de ella: se abre de nuevo,
    // como quien toca el aviso con la app cerrada)
    await p.goto(`${base}/?demo=esencial#hoy/agujetas`);
    await p.reload();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await cerrar(p);
    const ag = p.locator('.cer-agujetas');
    const conAg = await ag.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    check(conAg && /Ayer, tu primera sesión\. ¿Qué tal las agujetas\?/.test(await ag.textContent()) && (await ag.locator('.cer-op').count()) === 3, 'el día después de su primera sesión: «¿Qué tal las agujetas?», con tres respuestas de un toque');
    check(/Ayer entrenaste: hoy toca descansar/.test(await p.locator('.cer-saludo').textContent().catch(() => '')), 'y el saludo del día después: «Ayer entrenaste: hoy toca descansar…»');
    if (conAg) {
      await ag.getByRole('button', { name: 'Muchas' }).click();
      check(/eso no son agujetas/.test(await ag.textContent()) && (await ag.getByRole('button', { name: '¿Y si me duele algo?' }).count()) === 1, '«Muchas»: lo normal y cuándo «eso no son agujetas», con «¿Y si me duele algo?» a un toque');
      await desborda(p, 'Hoy con las agujetas');
      await ag.getByRole('button', { name: 'Vale' }).click();
      check((await p.locator('.cer-agujetas').count()) === 0, '«Vale» la quita');
    }
    await ctx.close();
  }
  // (la vista previa de lo apagado, para Pelayo: «?previa=1» en la demo)
  {
    const { ctx, p } = await movil();
    await p.goto(`${base}/?demo=esencial&previa=1`);
    await p.getByRole('button', { name: /Tomás/ }).first().click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click().catch(() => {});
    await p.waitForTimeout(1500);
    await cerrar(p);
    const seguir = p.getByRole('button', { name: 'Seguir', exact: true }).first();
    if (await seguir.isVisible().catch(() => false)) { await seguir.click(); await p.waitForTimeout(400); }
    const nec = p.locator('.ayu-necesitas');
    const conNec = await nec.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    if (conNec) {
      await nec.getByRole('button', { name: 'Me duele algo' }).click();
      const hMol = p.locator('[aria-modal="true"]').last();
      await hMol.locator('.vid-molestia').waitFor({ timeout: 15000 }).catch(() => {});
      await hMol.getByRole('button', { name: 'Hombros' }).click();
      await hMol.getByRole('button', { name: 'Leve' }).click();
      check(/Con una molestia leve: puedes seguir/.test(await hMol.locator('.vid-que').textContent().catch(() => '')), 'una molestia leve: puede seguir, con la regla del semáforo');
      await hMol.getByRole('button', { name: '¿Cuándo preocuparse?' }).click();
      const hoja = p.locator('[aria-modal="true"]').last();
      await hoja.locator('.ayu-p[open]').waitFor({ timeout: 10000 }).catch(() => {});
      check((await hoja.locator('.ayu-p').count()) === 8 && (await hoja.locator('.ayu-pendiente').count()) === 4 && /Pendiente del visto bueno de Pelayo/.test(await hoja.textContent()),
        'con «?previa=1» en la demo se ve lo apagado: las cuatro respuestas de salud nuevas, marcadas como pendientes');
      await hoja.locator('.cerrar-hoja').click();
      await p.locator('[aria-modal="true"]').last().locator('.cerrar-hoja').click();
      // (tanda 6) y, en «¿Qué necesitas?», «Estoy enfermo» y «Necesito una semana suave», como borradores
      check(/Estoy enfermo/.test(await nec.textContent()) && /Necesito una semana suave/.test(await nec.textContent()), 'con la vista previa salen también «Estoy enfermo» y «Necesito una semana suave»');
      await nec.getByRole('button', { name: 'Estoy enfermo' }).click();
      const hEnf = p.locator('[aria-modal="true"]').last();
      await hEnf.locator('.vid-enfermo').waitFor({ timeout: 15000 }).catch(() => {});
      check(/lo primero es recuperarte/.test(await hEnf.textContent()) && (await hEnf.locator('.vid-paso').count()) === 4 && /Borrador, pendiente del visto bueno de Pelayo/.test(await hEnf.textContent()), '«Estoy enfermo»: qué hacer, marcado como borrador (no guarda nada)');
      await hEnf.locator('.cerrar-hoja').click();
      await nec.getByRole('button', { name: 'Necesito una semana suave' }).click();
      const hSu = p.locator('[aria-modal="true"]').last();
      await hSu.locator('.vid-suave-h').waitFor({ timeout: 15000 }).catch(() => {});
      await hSu.getByRole('button', { name: 'Esta semana, suave' }).click();
      const suave = p.locator('.vid-suave');
      check(await suave.waitFor({ timeout: 10000 }).then(() => true).catch(() => false) && /Quita una serie de cada ejercicio/.test(await suave.textContent().catch(() => '')), '«Necesito una semana suave»: al pedirla, arriba en Hoy sale qué hacer esta semana');
      check(/borrador, pendiente de su visto bueno/.test(await p.locator('.cer-nota').textContent().catch(() => '')), 'y la nota de Pelayo de su semana, como borrador (sin la vista previa no sale)');
    } else check(false, 'la vista previa de lo apagado');
    await ctx.close();
  }
  // ---------- (la espera, tanda 7; v0.248) Lucía empieza de cero dentro de dos lunes; Andrés ya entrena y empieza el lunes ----------
  {
    const { ctx, p } = await movil();
    await entrar(p, /Lucía/);
    await p.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click().catch(() => {});
    await p.waitForTimeout(800);
    await cerrar(p);
    const t = p.locator('.lun-tarjeta');
    const conT = await t.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    const faltan = conT ? Number(await t.getAttribute('data-faltan')) : 0;
    check(conT && faltan >= 8 && faltan <= 14 && /Hasta tu lunes/.test(await t.textContent()), `Lucía (empieza dentro de dos lunes): en Hoy, «Hasta tu lunes» (faltan ${faltan})`);
    check(/Te quedan 3 cosas para estar listo/.test(await t.locator('.lun-lista').textContent().catch(() => '')) && (await t.locator('.lun-item-si').count()) === 1,
      'lo que le falta para estar listo: sus días, los avisos y su gimnasio (el cuestionario, hecho)');
    check((await t.locator('.lun-hoy').count()) === 1 && (await t.locator('.lun-extra').count()) === 0, 'una sola cosa para hoy, y sin lo apagado (sus kilos de partida, lo de su médico)');
    // la espera día a día (solo en la demo): cada día, lo suyo
    const dia = async (f) => {
      await t.locator('#lun-dia').evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, f);
      await p.waitForTimeout(300);
      return (await t.locator('.lun-hoy').textContent().catch(() => '')) || '';
    };
    const mal = [];
    for (const [f, re] of [[27, /Tu porqué/], [23, /Prepara tu gimnasio/], [20, /Un ejercicio al día/], [15, /Tu punto de partida/], [12, /calendario/], [9, /Ensaya una serie/], [4, /¿Te llegan los avisos\?/], [2, /Tu primer día/], [1, /Mañana, tu primera sesión/]]) {
      if (!re.test(await dia(f))) mal.push(f);
    }
    check(!mal.length, `la espera día a día: su porqué, su gimnasio, un ejercicio, su punto de partida, el calendario, ensayar, los avisos, el primer día y la víspera${mal.length ? ` (mal: ${mal.join(', ')})` : ''}`);
    check(/Unos \d+ minutos: 5 ejercicios/.test(await dia(1)) && /Lo importante: Prensa de piernas/.test(await dia(1)), 'la víspera: su primera sesión, cuánto dura y lo importante');
    // el ejercicio del día: dos cosas y «Visto»
    await dia(20);
    check((await t.locator('.lun-hoy .lun-cosa').count()) === 2, 'el ejercicio del día, con dos cosas en las que fijarse');
    await t.getByRole('button', { name: 'Visto', exact: true }).click();
    check(/Visto\. Mañana, el siguiente/.test(await t.locator('.lun-hoy').textContent()), '«Visto»: mañana, el siguiente');
    // su gimnasio: «No está» → su alternativa → «Todo listo»
    await dia(23);
    await t.locator('.lun-hoy').getByRole('button', { name: 'Mirar mi gimnasio' }).click();
    const hg = p.locator('[aria-modal="true"]').last();
    await hg.locator('.lun-fila').first().waitFor({ timeout: 15000 }).catch(() => {});
    check((await hg.locator('.lun-fila').count()) === 5, 'su gimnasio: los cinco ejercicios de su semana 1');
    await hg.locator('.lun-fila').first().getByRole('button', { name: 'No está' }).click();
    await hg.locator('.lun-alt').first().click();
    check(await hg.getByText(/En lugar de Prensa de piernas/).waitFor({ timeout: 10000 }).then(() => true).catch(() => false), 'la prensa no está en su gimnasio: deja puesta su alternativa');
    await hg.getByRole('button', { name: /Todo listo en mi gimnasio/ }).click();
    await p.waitForTimeout(800);
    check(/Te quedan 2 cosas/.test(await t.locator('.lun-lista').textContent().catch(() => '')), '«Todo listo en mi gimnasio»: una cosa menos en su lista');
    // ensayar una serie (no se guarda nada)
    await dia(9);
    await t.locator('.lun-hoy').getByRole('button', { name: 'Ensayar' }).click();
    const he = p.locator('[aria-modal="true"]').last();
    await he.locator('.lun-serie').waitFor({ timeout: 10000 }).catch(() => {});
    await he.getByRole('button', { name: 'Más peso' }).click();
    await he.locator('.lun-op', { hasText: '3' }).click();
    await he.getByRole('button', { name: /Apuntar la serie/ }).click();
    check(/Apuntada: 22,5 kg × 12, te sobraban 3/.test(await he.textContent()), 'ensaya una serie: «Apuntada: 22,5 kg × 12, te sobraban 3» (y no se guarda)');
    await desborda(p, 'ensayar una serie');
    await he.locator('.cerrar-hoja').click();
    // el aviso de prueba (en la demo no hay móvil: sin avisos activados, lo dice)
    await dia(4);
    await t.locator('.lun-hoy').getByRole('button', { name: 'Probar' }).click();
    const ha = p.locator('[aria-modal="true"]').last();
    await ha.getByRole('button', { name: /aviso de prueba/ }).click();
    check(await ha.getByText(/no tienes los avisos activados/).waitFor({ timeout: 10000 }).then(() => true).catch(() => false), 'el aviso de prueba: sin avisos activados, se lo dice y le deja activarlos');
    await ha.locator('.cerrar-hoja').click();
    // su primer día, paso a paso
    await dia(2);
    await t.locator('.lun-hoy').getByRole('button', { name: 'Verlo' }).click();
    const hp = p.locator('[aria-modal="true"]').last();
    await hp.locator('.lun-p').first().waitFor({ timeout: 10000 }).catch(() => {});
    check((await hp.locator('.lun-p').count()) === 5 && /media hora y a casa/.test(await hp.textContent()), 'su primer día, en cinco pasos');
    await hp.locator('.cerrar-hoja').click();
    await t.getByRole('button', { name: 'Volver a hoy' }).click();
    await desborda(p, 'la espera de Lucía');
    await ctx.close();
  }
  {
    const { ctx, p } = await movil();
    await p.goto(`${base}/?demo=esencial&previa=1`);
    await p.getByRole('button', { name: /Andrés/ }).first().click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click().catch(() => {});
    await p.waitForTimeout(800);
    await cerrar(p);
    const t = p.locator('.lun-tarjeta');
    const conT = await t.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check(conT && Number(await t.getAttribute('data-faltan')) <= 7 && (await t.locator('.lun-extra').count()) === 1 && /Apunta con cuántos kilos vas ahora/.test(await t.textContent()),
      'Andrés (ya entrena, empieza el lunes que viene), con la vista previa: «Mis kilos», en borrador');
    if (conT) {
      await t.getByRole('button', { name: 'Mis kilos' }).click();
      const hk = p.locator('[aria-modal="true"]').last();
      const conK = await hk.locator('.lun-kg').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      if (conK) {
        await hk.locator('.lun-kg').first().fill('40');
        await hk.getByRole('button', { name: /Guardar/ }).click();
      }
      check(conK && await p.getByText('Tus kilos de partida, guardados').waitFor({ timeout: 8000 }).then(() => true).catch(() => false), 'apunta sus kilos de partida y se guardan');
    }
    await desborda(p, 'la espera de Andrés');
    await ctx.close();
  }
  // (v0.250, tanda 9) La comida, acompañada: Carmen (con nutrición; la app le ajustó el plan hace tres días). Con la vista
  // previa, también lo apagado
  {
    const { ctx, p } = await movil();
    await p.goto(`${base}/?demo=esencial&previa=1`);
    await p.getByRole('button', { name: /Carmen/ }).first().click();
    await p.locator('nav.tabs').waitFor({ timeout: 30000 });
    await p.locator('.bienvenida').getByRole('button', { name: /Saltar/ }).click().catch(() => {});
    await p.waitForTimeout(800);
    await cerrar(p);
    const porque = p.locator('details.cmd-porque');
    const conPorque = await porque.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    if (conPorque) await porque.locator('summary').click();
    check(conPorque && /Tu plan cambió hace 3 días: la app no vuelve a tocarlo hasta que pase una semana/.test(await porque.textContent()),
      'Carmen, en Hoy: «¿Por qué no cambia tu plan?» (cambió hace tres días; hasta que pase una semana, no lo toca)');
    const nec = p.locator('.ayu-necesitas');
    await nec.waitFor({ timeout: 15000 });
    await nec.locator('[data-comida]').first().waitFor({ timeout: 15000 }).catch(() => {});
    const deComida = await nec.locator('[data-comida]').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-comida')));
    check(deComida.join() === 'proteina,fuera,hambre,pasado,celebracion,pesarme', `«¿Qué necesitas?», con las seis de comida (vista previa: ${deComida.join()})`);
    if (deComida.length) {
      await nec.locator('[data-comida="proteina"]').click();
      const hp = p.locator('[aria-modal="true"]').last();
      const prot = await hp.locator('.cmd-prot').waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      await hp.locator('.cmd-idea').first().waitFor({ timeout: 10000 }).catch(() => {});
      check(prot && /Hoy llevas 80 de 130 g de proteína: te faltan 50 g\./.test(await hp.locator('.cmd-prot').textContent()) && (await hp.locator('.cmd-idea').count()) === 3,
        '«No llego a la proteína»: lo que lleva hoy (80 de 130 g) y tres recetas del recetario');
      await hp.locator('.cerrar-hoja').click();
      await nec.locator('[data-comida="pasado"]').click();
      const hpa = p.locator('[aria-modal="true"]').last();
      const conPa = await hpa.locator('.cmd-lineas').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      check(conPa && /Un día no cambia nada/.test(await hpa.textContent()) && /Pendiente del visto bueno de Pelayo/.test(await hpa.textContent()), '«Me he pasado» (vista previa): sin compensar, y marcada como pendiente de Pelayo');
      await hpa.locator('.cerrar-hoja').click();
      await nec.locator('[data-comida="celebracion"]').click();
      const hc = p.locator('[aria-modal="true"]').last();
      const conFecha = await hc.locator('.cmd-fecha').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      if (conFecha) await hc.getByRole('button', { name: /Apuntarla/ }).click();
      check(conFecha && await hc.locator('.cmd-celebra-f').first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false), '«Tengo una celebración»: apunta el día y sale en su lista');
      await hc.locator('.cerrar-hoja').click();
      await nec.getByRole('button', { name: 'Otra cosa' }).click();
      const hr = p.locator('[aria-modal="true"]').last();
      const catCom = hr.locator('.ayu-cat', { hasText: 'La comida' });
      const conCat = await catCom.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      check(conCat && /15/.test(await catCom.textContent()), 'en «Respuestas», el tema «La comida», con sus quince respuestas (vista previa)');
      await hr.locator('.cerrar-hoja').click();
    }
    // su revisión de la semana (la abre el aviso de los lunes): la comida, con lo que cambió y su porqué
    await p.evaluate(() => { location.hash = '#hoy/lunes'; });
    const cs = p.locator('.cmd-semana');
    const conCs = await cs.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    check(conCs && /Tu plan: 1690 kcal al día, con 130 g de proteína\./.test(await cs.textContent()) && /Esta semana baja 148 kcal\. Gastas unas 2040 kcal al día/.test(await cs.textContent()),
      'en su revisión de la semana, «Tu comida esta semana»: su plan y lo que ha cambiado, con su porqué');
    await desborda(p, 'la comida de Carmen');
    await ctx.close();
  }
  check(errores.length === 0, `FBE Esencial sin errores ni desbordes${errores.length ? `: ${errores.slice(0, 4).join(' | ')}` : ''}`);
}
