// FBE Esencial (tandas 1 y 2), en la demo ?demo=esencial. Lo llama e2e.test.mjs.
//   · Marina (390 px): la bienvenida sin «Habla con tu coach»; en Hoy, «Rellena tu cuestionario»; lo rellena (cribado
//     limpio) y la app le pone «Primeras 4 semanas»: su sesión con «Te sobran 4-5» y la plancha en segundos; apunta una serie.
//   · Clara: su visto bueno, en revisión. Tomás: sus marcas de la semana 4 y (tanda 3) su plan desde la semana 5, solo.
//   · Inés (tanda 4, con nutrición): en Hoy, «Tu plan de comida»; contesta, ve su plan y lo guarda: «Nutrición de hoy».
//   · El coach (1280 px): el chip «Esencial» en la lista; en la ficha de Clara (Datos), «Confirmar visto bueno» y su plan;
//     sin la pestaña Mensajes; «Añadir atleta» de FBE Esencial con su mensaje de invitación.
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
    await hoja.locator('.opciones button, [role="group"] button').first().click();   // un objetivo
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(300);
    // Experiencia, días y minutos: la primera opción de cada grupo (nunca ha entrenado, 2 días…)
    const grupos2 = hoja.locator('[role="group"]');
    for (let i = 0; i < await grupos2.count(); i++) await grupos2.nth(i).locator('button').first().click().catch(() => {});
    await hoja.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(300);
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
      await tarjeta.getByRole('button', { name: 'Preparar mi plan' }).click();
      const h = p.locator('[aria-modal="true"]').last();
      await h.getByRole('button', { name: 'Mujer' }).click();
      await h.locator('#ec-edad').fill('36');
      await h.locator('#ec-altura').fill('168');
      await h.locator('#ec-peso').fill('68,4');
      await h.getByRole('button', { name: /^Activo/ }).first().click();
      await h.getByRole('button', { name: 'Perder grasa' }).click();
      await h.getByRole('button', { name: 'No', exact: true }).click();
      check(/Tu plan: 1795 kcal al día/.test((await h.locator('.nota').textContent().catch(() => '')).replace(/\u00a0/g, ' ')) && /unos 340 g/.test(await h.locator('.nota').textContent().catch(() => '')),
        'contesta y ve su plan antes de guardarlo (1795 kcal; bajar un 0,5 % a la semana, unos 340 g)');
      await desborda(p, 'la hoja del plan de comida');
      await h.getByRole('button', { name: 'Guardar mi plan' }).click();
      const lista = await p.waitForFunction(() => { const d = document.querySelector('details[data-plegable="nutricion"]'); return !!d && !d.hidden && d.open && /1795/.test(d.textContent); }, null, { timeout: 15000 }).then(() => true).catch(() => false);
      check(lista && !(await tarjeta.count()), 'guardado: «Nutrición de hoy», abierta y con su objetivo (1795 kcal); la tarjeta ya no sale');
    }
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
    await he.getByRole('button', { name: /Mandarla a 4 atletas/ }).click();
    const mandada = await he.getByRole('button', { name: 'Ya la tienen todos' }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check(mandada && /Sin contestar: /.test(await he.textContent().catch(() => '')), 'la encuesta de la semana 6, mandada a los cuatro (y quién no ha contestado)');
    await he.getByRole('button', { name: /^Cerrar/ }).first().click().catch(() => {});
    await p.getByText('Clara Prieto').first().click();
    await p.getByRole('tab', { name: 'Datos' }).click().catch(async () => { await p.getByRole('button', { name: 'Datos' }).first().click(); });
    const sec = p.locator('section[aria-labelledby="esencial-coach"]');
    await sec.waitFor({ timeout: 15000 });
    check(/Dice que lo tiene/.test(await sec.textContent()), 'su ficha (Datos): FBE Esencial, «Dice que lo tiene»');
    check(!(await p.getByRole('tab', { name: 'Mensajes' }).count()), 'sin la pestaña Mensajes en su ficha');
    await sec.getByRole('button', { name: /Confirmar visto bueno/ }).click();
    const conPlan = await p.waitForFunction(() => /Primeras 4 semanas/.test(document.querySelector('section[aria-labelledby="esencial-coach"]')?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
    check(conPlan, 'al confirmar su visto bueno, la app le prepara su plan («Primeras 4 semanas»)');
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
    await p.evaluate(() => { localStorage.removeItem('fbe-demo-esencial-v1-sesion'); });
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
    await p.evaluate(() => { localStorage.removeItem('fbe-demo-esencial-v1-sesion'); });
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
    await p.evaluate(() => { localStorage.removeItem('fbe-demo-esencial-v1-sesion'); });
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
  check(errores.length === 0, `FBE Esencial sin errores ni desbordes${errores.length ? `: ${errores.slice(0, 4).join(' | ')}` : ''}`);
}
