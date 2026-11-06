// Ir a una sección de la app en las pruebas de navegador. En el móvil la barra de abajo tiene cinco huecos: las
// secciones que no caben están en la hoja «Más» (web/src/ui/BarraMas.jsx; el reparto, en web/src/logica/pestanas.js).
// Usa siempre irASeccion en lugar de pulsar '.tab' a mano: así da igual dónde esté la sección.

// Pulsa la sección en la barra o, si no está, en «Más»
export async function irASeccion(p, nombre) {
  const enBarra = p.locator('nav.tabs .tab', { hasText: nombre }).first();
  if (await enBarra.isVisible().catch(() => false)) return enBarra.click();
  await p.locator('nav.tabs .tab-mas').click();
  await p.locator('.hoja-mas .mas-fila button', { hasText: nombre }).first().click();
  await p.locator('.hoja-mas').waitFor({ state: 'detached' });
  return undefined;
}

// ¿Tiene esa sección (en la barra o en «Más»)? Deja «Más» cerrada
export async function haySeccion(p, nombre) {
  if (await p.locator('nav.tabs .tab', { hasText: nombre }).count()) return true;
  const mas = p.locator('nav.tabs .tab-mas');
  if (!(await mas.count())) return false;
  await mas.click();
  const hoja = p.locator('.hoja-mas');
  await hoja.waitFor();
  const n = await hoja.locator('.mas-fila button', { hasText: nombre }).count();
  await hoja.getByRole('button', { name: 'Cerrar' }).first().click();
  await hoja.waitFor({ state: 'detached' });
  return n > 0;
}

// Espera (hasta ms) a que la sección deje de estar
export async function esperarSinSeccion(p, nombre, ms = 6000) {
  const fin = Date.now() + ms;
  for (;;) {
    if (!(await haySeccion(p, nombre))) return true;
    if (Date.now() > fin) return false;
    await p.waitForTimeout(250);
  }
}

// Progreso tiene cuatro sub-pestañas (resumen, fuerza, cuerpo, logros): pasa a una, si no es ya la que se ve.
// Lo que está en otra sub-pestaña sigue en la página pero no se ve: antes de pulsarlo o esperarlo, hay que pasar a la
// suya. En la app del coach no hace nada; en la del atleta espera un momento a que Progreso se pinte (recién pulsada
// la pestaña, tarda lo que dura la transición) y, si no hay sub-pestañas (solo nutrición, otra pantalla), sigue.
export async function subProgreso(p, sub) {
  if (!(await p.locator('nav.tabs .tab', { hasText: 'Progreso' }).count())) return;
  const b = p.locator(`#prog-${sub}`);
  await b.waitFor({ timeout: 4000 }).catch(() => {});
  if (!(await b.count())) return;
  if ((await b.getAttribute('aria-selected')) !== 'true') await b.click();
}

// En Hoy, las secciones secundarias («Lo que vas a hacer», «Esta semana», el menú, la nutrición, los hábitos y el peso)
// van plegadas en filas: abre una antes de pulsar o esperar algo de dentro. ids: sesion, semana, menu, nutricion,
// habitos, peso. Si esa fila no existe (otra pantalla, quien solo lleva la nutrición), no hace nada.
export async function abrirEnHoy(p, id) {
  const d = p.locator(`details[data-plegable="${id}"]`);
  if (!(await p.locator('nav.tabs .tab', { hasText: 'Hoy' }).count())) return;
  await d.waitFor({ state: 'attached', timeout: 4000 }).catch(() => {});
  if (!(await d.count())) return;
  await d.evaluate((el) => { el.open = true; });
}

// En el Equipo, «Próximos», «Compañeros de racha» y los recuentos («Esta semana en el equipo», «Resumen del mes») van
// plegados en pastillas (web/src/ui/PlegableEquipo.jsx; ids: proximos, companeros, semana, mes). Lo de dentro sigue en
// la página aunque la pastilla esté cerrada, pero no se ve: antes de pulsarlo o esperarlo, hay que abrirla. Se queda
// abierta para el resto de la prueba (el navegador lo recuerda).
export async function abrirEnEquipo(p, id) {
  const d = p.locator(`details[data-plegable-eq="${id}"]`).first();
  await d.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
  await d.evaluate((el) => { el.open = true; }, null, { timeout: 2000 }).catch(() => {});
}

// El cuadro de publicar del atleta empieza plegado en una línea: el tema, las fotos y «Publicar» salen al tocarlo.
// Escribir en él ya lo abre; esto es para lo que toca antes el tema o las fotos.
export async function abrirCompositor(p) {
  await p.locator('#eq-texto').first().focus({ timeout: 5000 }).catch(() => {});
}

