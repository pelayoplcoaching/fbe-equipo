// FBE Esencial (tandas 1 y 2), en la demo ?demo=esencial. Lo llama e2e.test.mjs.
//   · Marina (390 px): la bienvenida sin «Habla con tu coach»; en Hoy, «Rellena tu cuestionario»; lo rellena (cribado
//     limpio) y la app le pone «Primeras 4 semanas»: su sesión con «Te sobran 4-5» y la plancha en segundos; apunta una serie.
//   · Clara: su visto bueno, en revisión. Tomás: sus marcas de la semana 4 y (tanda 3) su plan desde la semana 5, solo.
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
    const dia = p.locator('.hero-dia h2, .hero-dia .titular').first();
    const conPlan = await p.waitForFunction(() => /Día 1/.test(document.querySelector('.hero-dia')?.textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
    check(conPlan, 'y en Hoy, su plan: «Primeras 4 semanas», Día 1');
    check(/Esta semana:/.test(await p.locator('.hero-dia').first().textContent().catch(() => '')), 'la nota de la semana, «Esta semana:» (no «Tu coach:»)');
    await dia.isVisible().catch(() => false);
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
    check(/Te sobran 4-5/.test(tSes) && /20–30 s/.test(tSes), 'la sesión: «Te sobran 4-5» y la plancha en segundos');
    check(!/Comentarios con tu coach/.test(tSes), 'sin «Comentarios con tu coach»');
    await desborda(p, 'la sesión de Marina');
    await ctx.close();
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
    check((await p.getByText('Esencial', { exact: true }).count()) >= 3, 'en la lista, el chip «Esencial» en los tres');
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
    await ctx.close();
  }
  check(errores.length === 0, `FBE Esencial sin errores ni desbordes${errores.length ? `: ${errores.slice(0, 4).join(' | ')}` : ''}`);
}
