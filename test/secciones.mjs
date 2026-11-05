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
