// v0.134: la música también en el modo atleta del coach (rama musica-modo-atleta). Lo llama e2e.test.mjs.
//   · Sin listas en Cuenta › Música, la portada de su sesión no enseña música ni la invitación a «Lo tuyo».
//   · Con sus listas, la portada enseña «Tu música de hoy» con «Empezar con esta música».
//   · Sin errores, sin desbordarse a 390 px.
export async function probarMusicaPropio({ navegador, check, base = 'http://localhost:4174' }) {
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  const cerrar = async () => {
    for (let i = 0; i < 5; i++) {
      const d = p.locator('[role=dialog]').last();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const n of ['Entendido', 'Cerrar', 'Ahora no', 'Seguir']) {
        const b = d.getByRole('button', { name: n, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const seccion = async (nombre) => {
    const t = p.locator('nav.tabs .tab', { hasText: nombre });
    if (await t.count()) return t.first().click();
    await p.locator('nav.tabs .tab-mas').click();
    await p.getByRole('dialog').getByRole('button', { name: new RegExp(nombre) }).first().click();
  };
  try {
    await p.goto(`${base}/?demo`);
    await p.getByRole('button', { name: /Pelayo/ }).click();
    const codigo = p.getByLabel('Código', { exact: true });
    await Promise.race([codigo.waitFor(), p.getByRole('heading', { name: 'Atletas' }).waitFor()]);
    if (await codigo.isVisible().catch(() => false)) { await codigo.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
    await p.getByRole('heading', { name: 'Atletas' }).waitFor();
    // Su ficha y un bloque de plantilla, publicado
    await seccion('Modo atleta');
    await p.getByRole('button', { name: 'Crear mi ficha y entrar' }).click();
    await p.locator('.banda-modo-atleta').waitFor();
    await p.getByRole('button', { name: 'Programarlo' }).click();
    await p.getByRole('tab', { name: 'Programa', selected: true }).waitFor();
    await p.getByRole('button', { name: 'Crear su primer bloque' }).click();
    await p.getByRole('button', { name: 'Plantilla', exact: true }).click();
    await p.getByLabel('Plantilla', { exact: true }).selectOption({ label: 'Torso-pierna 3 días' });
    await p.getByRole('button', { name: 'Crear bloque' }).click();
    await p.locator('.semanas-tabs').waitFor();
    await p.waitForTimeout(500);
    const pub = p.getByRole('button', { name: /Publicar/ }).first();
    if (await pub.isVisible().catch(() => false)) {
      await pub.click(); await p.waitForTimeout(400);
      const conf = p.getByRole('dialog').getByRole('button', { name: /Publicar/ });
      if (await conf.count()) await conf.first().click();
      await p.waitForTimeout(800);
    }
    await p.getByRole('button', { name: 'Volver a atletas' }).click();
    const abrirPortada = async () => {
      await seccion('Modo atleta');
      await p.locator('.banda-modo-atleta').waitFor(); await p.waitForTimeout(600); await cerrar();
      await p.locator('.tab', { hasText: 'Semana' }).click(); await p.waitForTimeout(600); await cerrar();
      await p.locator(':is(button,a,[role=button])').filter({ hasText: 'Siguiente' }).filter({ hasText: 'Torso A' }).last().click();
      await p.getByRole('button', { name: /^Empezar$/ }).first().waitFor();
      await p.waitForTimeout(1200);
      await cerrar();
    };
    await abrirPortada();
    check(await p.locator('.empezar-musica').count() === 0 && await p.getByText('¿Entrenas con música?').count() === 0,
      'modo atleta del coach sin listas en Cuenta › Música: su portada no enseña música ni la invitación a «Lo tuyo»');
    // Sus listas por tipo de sesión
    await p.getByRole('button', { name: /Volver|Atrás|Cerrar/ }).first().click();
    await p.waitForTimeout(600);
    await p.locator('.tab', { hasText: 'Entrenador' }).click();
    await p.getByRole('heading', { name: 'Atletas' }).waitFor();
    await seccion('Cuenta');
    await p.locator('.musica-coach').waitFor();
    for (const n of ['Empuje', 'Tirón', 'Pierna', 'Full body']) {
      const b = p.locator('.musica-coach button', { hasText: n }).first();
      if (!(await b.count())) continue;
      await b.click();
      await p.locator('#musica-enlace').fill('https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP');
      await p.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
      await p.locator('#musica-enlace').waitFor({ state: 'detached' });
    }
    await abrirPortada();
    check(await p.locator('.empezar-musica').count() === 1 && await p.getByText('Tu música de hoy').count() === 1,
      'con sus listas: «Tu música de hoy» y «Empezar con esta música» en la portada de su sesión');
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    check(ancho <= 390, `la portada con su música no se desborda (${ancho} px)`);
    check(!errores.length, `música en el modo atleta sin errores${errores.length ? ': ' + errores.join(' | ') : ''}`);
  } finally {
    await ctx.close();
  }
}
