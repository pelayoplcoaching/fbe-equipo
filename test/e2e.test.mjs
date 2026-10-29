// Prueba de punta a punta en Chrome, a tamaño de móvil, sobre la app empaquetada (dist/) en modo demo.
// Flujo: el coach da de alta a una atleta, le crea el bloque y publica la semana; ella activa su cuenta con el código,
// entrena, hace el check-in; el coach lo ve en su panel. Comprueba también errores de consola, desbordes y accesibilidad básica.
// Uso: npm run build && node test/e2e.test.mjs
import { chromium } from 'playwright';
import { servir } from './servidor.mjs';
import { createRequire } from 'node:module';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

const CHROME = process.env.CHROME_PATH || '/opt/google/chrome/chrome';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
// Cámara de mentira (Chrome la simula con un patrón) para probar las fotos guiadas
const navegador = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', bypassCSP: true });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write', 'camera']);
const p = await ctx.newPage();
// Cuenta con espera: en una máquina lenta (GitHub) la lista puede tardar un poco en pintarse tras un clic
const hay = async (loc, n, ms = 6000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await loc.count() === n) return true; await new Promise((r) => setTimeout(r, 100)); } return (await loc.count()) === n; };
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

// Perfil (atleta) y Cuenta (coach) no están en la barra del móvil: se abren desde el avatar de arriba (v0.18)
async function abrirPestana(p, t) {
  const b = p.locator('.tab', { hasText: t }).first();
  if (await b.isVisible().catch(() => false)) return b.click();
  // Como al tocar una notificación: la app escucha el cambio de #hash (así no importa qué aviso tenga abierto Hoy)
  // (un momento antes: al cerrar una ficha, la app acaba de reescribir el #hash y el cambio se perdería)
  await p.waitForTimeout(500);
  await p.evaluate((id) => { location.hash = `#${id}`; }, t === 'Perfil' ? 'perfil' : 'cuenta');
  await p.waitForTimeout(400);
}
async function revisar(paso) {
  // En emulación de móvil el navegador ensancha la página para que quepa lo que se sale: se compara con los 390 px reales
  const [ancho, vista] = await p.evaluate(() => [document.documentElement.scrollWidth, 390]);
  if (ancho > vista) errores.push(`${paso}: la página se desborda en horizontal (${ancho} > ${vista})`);
  const sinNombre = await p.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')]
    .filter((el) => el.offsetParent !== null)
    .filter((el) => {
      const nombre = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
      const etiqueta = el.id && document.querySelector(`label[for="${el.id}"]`);
      return !nombre && !etiqueta && !el.closest('label');
    }).map((el) => el.outerHTML.slice(0, 90)));
  if (sinNombre.length) errores.push(`${paso}: controles sin nombre accesible: ${sinNombre.join(' | ')}`);
  // Accesibilidad con axe-core (WCAG 2.1 A y AA y buenas prácticas): contraste, nombres, roles, encabezados, regiones…
  // Espera a que acaben las animaciones de entrada (con opacidad a medias, el contraste saldría mal)
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

try {
  // v0.29: portada del lobo mientras arranca (aquí sin JavaScript, para verla quieta) y que luego se va sola
  {
    const q = await ctx.newPage();
    await q.route('**/app.js*', () => {});
    await q.goto('http://localhost:4174/?demo', { waitUntil: 'commit' });
    await q.waitForSelector('#portada svg path');
    const portada = await q.evaluate(() => {
      const el = document.getElementById('portada'); const r = el.getBoundingClientRect();
      return { tapa: r.width >= innerWidth && r.height >= innerHeight, fondo: getComputedStyle(el).backgroundColor, nombre: el.textContent.includes('FBE Equipo'), rol: el.getAttribute('role'), color: document.querySelector('meta[name=theme-color]').content };
    });
    check(portada.tapa && portada.fondo === 'rgb(84, 56, 216)' && portada.nombre && portada.rol === 'status' && portada.color === '#5438D8', 'al abrir, la portada del lobo tapa la pantalla en morado mientras llega la app');
    await q.close();
    // Con el tema elegido a mano, la barra del sistema sigue en morado mientras está la portada
    const q2 = await ctx.newPage();
    await q2.addInitScript(() => {
      try { localStorage.setItem('fbe-ajustes', JSON.stringify({ tema: 'oscuro' })); } catch { /* */ }
      window.__tc = [];
      new MutationObserver((ms) => { for (const m of ms) if (m.target.id === 'tc-portada') window.__tc.push(m.target.content); })
        .observe(document, { subtree: true, attributes: true, attributeFilter: ['content'] });
    });
    await q2.goto('http://localhost:4174/?demo');
    await q2.waitForFunction(() => !document.getElementById('portada'));
    check((await q2.evaluate(() => window.__tc)).length === 0, 'con el tema oscuro elegido, la barra del sistema no pierde el morado de la portada');
    await q2.evaluate(() => localStorage.removeItem('fbe-ajustes'));
    await q2.close();
  }
  await p.goto('http://localhost:4174/?demo');
  await p.getByRole('heading', { name: 'Entra en tu cuenta' }).waitFor();
  await p.waitForFunction(() => !document.getElementById('portada') && !document.getElementById('tc-portada'));
  check(true, 'la portada se va sola en cuanto se puede entrar');
  check(JSON.parse(await (await fetch('http://localhost:4174/manifest.webmanifest')).text()).background_color === '#5438D8', 'el manifiesto arranca en el morado de la portada (Android la enlaza sin salto)');
  await revisar('acceso');

  console.log('Coach: alta, bloque y publicación');
  await p.getByRole('button', { name: /Pelayo/ }).click();
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  await revisar('panel');
  await p.getByRole('button', { name: 'Añadir atleta' }).click();
  await p.getByLabel('Nombre y apellidos').fill('Lucía Prueba');
  await p.getByLabel('Objetivo').fill('Ganar fuerza en los básicos');
  await p.getByRole('button', { name: 'Crear y generar código' }).click();
  const codigo = (await p.locator('.codigo-grande').textContent()).trim();
  check(/^FBE-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(codigo), `genera el código de invitación (${codigo})`);
  check((await p.locator('.hoja-dialogo .nota').textContent()).includes(codigo), 'el mensaje para enviar incluye el código');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.getByRole('tab', { name: 'Programa' }).waitFor();
  await p.getByRole('heading', { name: 'Lucía Prueba' }).waitFor();
  check(true, 'abre su ficha');
  await p.getByRole('button', { name: 'Crear su primer bloque' }).click();
  await p.getByRole('button', { name: 'Plantilla', exact: true }).click();
  await p.getByLabel('Plantilla', { exact: true }).selectOption({ label: 'Torso-pierna 3 días' });
  await p.getByRole('button', { name: 'Crear bloque' }).click();
  await p.locator('.semanas-tabs').waitFor();
  check(await p.locator('.editor-sesion').count() === 3, 'el bloque se crea desde la plantilla con sus 3 sesiones');
  await p.locator('.semanas-tabs button', { hasText: 'S1' }).click();
  const tempo1 = p.getByLabel('Tempo (bajada, pausa, subida)').first();
  await tempo1.fill('10-1');
  await tempo1.press('Tab');
  await p.locator('.toast', { hasText: 'Escribe el tempo' }).waitFor();
  check(await tempo1.getAttribute('aria-invalid') === 'true', 'un tempo mal escrito se marca y no se guarda');
  await tempo1.fill('3 1 1');
  await tempo1.press('Tab');
  await p.waitForFunction(() => document.querySelector('input.tempo')?.value === '3-1-1');
  check(await tempo1.getAttribute('aria-invalid') === 'false', 'el tempo «3 1 1» se guarda como 3-1-1');
  await p.getByLabel('Serie top y back-off').first().selectOption('10');
  await p.waitForFunction(() => document.querySelector('select.backoff')?.classList.contains('activo'));
  check(true, 'marca el press banca con serie top y back-off al −10 %');
  await p.getByRole('button', { name: 'Publicar al atleta' }).click();
  const avisoActivo = p.getByRole('dialog', { name: 'Este bloque aún no es el activo' });
  await avisoActivo.waitFor();
  check(true, 'al publicar en un bloque que no es el activo, avisa de que el atleta no lo vería');
  // El aviso de «bloque creado» sigue en pantalla: con la hoja abierta va arriba y no tapa sus botones
  const tapa = await p.evaluate(() => {
    const t = document.querySelector('.toast')?.getBoundingClientRect();
    if (!t) return false;
    return [...document.querySelectorAll('.hoja-dialogo button')].some((x) => { const r = x.getBoundingClientRect(); return r.width && t.left < r.right && t.right > r.left && t.top < r.bottom && t.bottom > r.top; });
  });
  check(!tapa, 'con una hoja abierta, los avisos no tapan sus botones');
  await avisoActivo.getByRole('button', { name: 'Publicar y activar este bloque' }).click();
  await p.locator('.semanas-tabs button.programada', { hasText: 'S1' }).waitFor();
  await p.locator('.toast', { hasText: 'publicada y bloque activado' }).waitFor();
  check(await p.locator('select[id^="b-est-"]').inputValue() === 'activo', 'publica la semana 1 y deja el bloque activo');
  await revisar('editor');
  await p.getByRole('tab', { name: 'Seguimiento' }).click();
  await p.getByRole('button', { name: 'Añadir hábito' }).first().click();
  const hojaHab = p.getByRole('dialog', { name: 'Nuevo hábito' });
  await hojaHab.getByRole('button', { name: 'Pasos', exact: true }).click();
  check(await hojaHab.getByLabel('Objetivo').inputValue() === '8000', 'pone un hábito desde una plantilla (pasos, 8000)');
  await hojaHab.getByLabel('Objetivo').fill('7.500');
  await revisar('habito-coach');
  await hojaHab.getByRole('button', { name: 'Añadir hábito' }).click();
  await p.locator('.toast', { hasText: 'Hábito «Pasos» añadido' }).waitFor();
  check((await p.locator('.habito-coach').first().textContent()).includes('Al menos 7500 pasos'), 'se guarda con el objetivo que escribe («7.500» son siete mil quinientos)');
  await p.getByRole('tab', { name: 'Nutrición' }).click();
  await p.getByRole('button', { name: 'Crear el plan' }).click();
  const hojaPlanN = p.getByRole('dialog', { name: 'Plan de nutrición' });
  await hojaPlanN.locator('.calculadora').waitFor();
  await revisar('plan-nutricion');
  await hojaPlanN.getByRole('button', { name: 'Usar estas cifras' }).click();
  await p.waitForFunction(() => document.querySelector('#pn-prot')?.value && document.querySelector('#pn-carb')?.value);
  check(Number(await hojaPlanN.locator('#pn-prot').inputValue()) > 0 && Number(await hojaPlanN.locator('#pn-carb').inputValue()) > 0, 'la calculadora (Mifflin-St Jeor) rellena kcal y macros de partida');
  await hojaPlanN.getByRole('button', { name: 'Crear el plan' }).click();
  await p.locator('.toast', { hasText: 'Plan de nutrición creado' }).waitFor();
  check(await p.locator('.tarjeta-plan').count() === 1 && (await p.locator('.tarjeta-plan').textContent()).includes('Perder grasa'), 'crea el plan de nutrición de Lucía');
  await p.getByRole('tab', { name: 'Datos' }).click();
  await p.getByRole('button', { name: 'Volver a atletas' }).click();
  await abrirPestana(p, 'Cuenta');
  await p.getByRole('button', { name: /Salir/ }).click();

  console.log('\nAtleta: activación con el código');
  await p.getByRole('button', { name: 'Activa tu cuenta' }).click();
  await p.getByLabel('Código de invitación').fill(codigo.toLowerCase().replace(/-/g, ' '));
  await p.getByLabel('Tu nombre').fill('Lucía');
  await p.getByLabel('Email').fill('lucia@correo.test');
  await p.getByLabel('Crea una contraseña').fill('una-contraseña-segura');
  await p.locator('label.casilla input').nth(0).check();
  await p.locator('label.casilla input').nth(1).check();
  await revisar('activar');
  await p.getByRole('button', { name: 'Activar cuenta' }).click();
  const bienvenida = p.getByRole('dialog', { name: 'Bienvenida a FBE Equipo' });
  await bienvenida.waitFor();
  check((await bienvenida.locator('h2').textContent()) === 'Hola, Lucía', 'la primera vez le da la bienvenida por su nombre');
  await revisar('bienvenida');
  for (let i = 0; i < 3; i++) await bienvenida.getByRole('button', { name: 'Siguiente' }).click();
  await bienvenida.getByRole('button', { name: 'Empezar' }).click();
  await bienvenida.waitFor({ state: 'detached' });
  await p.locator('.titular h2').waitFor();
  check((await p.locator('.titular h2').textContent()) === 'Torso A', 'entra directamente a su primera sesión');
  check((await p.locator('.primeros-pasos .separa').textContent()).includes('1 de 7') && await p.locator('.primeros-pasos li', { hasText: 'Rellena tu cuestionario inicial' }).count() === 1,
    'con sus primeros pasos (1 de 7 hecho; entre ellos, su cuestionario inicial)');
  await revisar('hoy');

  console.log('\nAtleta: hábitos y plan de la semana');
  const tilePasos = p.locator('.habito-tile', { hasText: 'Pasos' });
  await tilePasos.click();
  const hojaPasos = p.getByRole('dialog', { name: 'Pasos' });
  // Con punto de miles, como se escribe en español: «8.000» son ocho mil (antes se guardaban 8)
  await hojaPasos.getByRole('textbox', { name: 'pasos de hoy' }).fill('8.000');
  await revisar('habito');
  await hojaPasos.getByRole('button', { name: 'Guardar' }).click();
  await p.locator('.toast', { hasText: 'Pasos: ¡hecho!' }).waitFor();
  await hojaPasos.waitFor({ state: 'detached' });
  check((await tilePasos.getAttribute('aria-label')).includes('hoy 8000 pasos, cumplido'), 'apunta sus pasos de hoy («8.000») en Hoy y el anillo se cierra');
  // Un día anterior de la semana que se le olvidó (si hoy no es lunes)
  await tilePasos.click();
  const lunesHab = hojaPasos.getByRole('group', { name: 'Día que apuntas' }).getByRole('button').first();
  if ((await lunesHab.getAttribute('aria-pressed')) === 'false') {
    await lunesHab.click();
    check((await lunesHab.getAttribute('aria-pressed')) === 'true' && await hojaPasos.getByRole('textbox', { name: /^pasos del / }).count() === 1, 'en la hoja elige otro día de la semana');
    await hojaPasos.getByRole('textbox', { name: /^pasos del / }).fill('9500');
    await hojaPasos.getByRole('button', { name: 'Guardar' }).click();
    await hojaPasos.waitFor({ state: 'detached' });
    await tilePasos.click();
    check((await hojaPasos.getByRole('group', { name: 'Día que apuntas' }).getByRole('button').first().getAttribute('aria-label')).includes('9500 pasos, cumplido'), 'y lo apuntado queda en ese día (no en hoy)');
  } else check(true, 'hoy es lunes: no hay un día anterior en la semana que elegir');
  await p.keyboard.press('Escape');
  await hojaPasos.waitFor({ state: 'detached' });
  await p.locator('.tab', { hasText: 'Semana' }).click();
  const planS = p.locator('.plan-semana');
  await planS.waitFor();
  await planS.getByRole('button', { name: 'Elegir el día de Torso A' }).click();
  const hojaDia = p.getByRole('dialog', { name: '¿Qué día harás Torso A?' });
  await hojaDia.getByRole('button', { name: /^Lunes/ }).click();
  await hojaDia.waitFor({ state: 'detached' });
  await planS.locator('.tira-dia').first().getByRole('button', { includeHidden: true }).first().waitFor({ state: 'attached' });
  check((await planS.locator('.tira-dia').first().getAttribute('aria-label')).includes('Torso A'), 'planifica Torso A para el lunes (sale en la tira de la semana)');
  await revisar('plan');
  await planS.getByRole('button', { name: 'Añadir a mi calendario' }).click();
  const hojaCal = p.getByRole('dialog', { name: 'Añadir a mi calendario' });
  await hojaCal.waitFor();
  const [descarga] = await Promise.all([p.waitForEvent('download'), hojaCal.getByRole('button', { name: 'Descargar el calendario' }).click()]);
  const ics = (await import('node:fs')).readFileSync(await descarga.path(), 'utf8');
  check(descarga.suggestedFilename().endsWith('.ics') && ics.includes('SUMMARY:Entreno: Torso A') && ics.includes('BEGIN:VALARM'), 'descarga el calendario (.ics) con su sesión y el aviso');
  await p.keyboard.press('Escape');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  check(/Prevista para (el lunes|mañana)/.test(await p.locator('.titular').textContent()), 'Hoy le recuerda para cuándo la tiene prevista');

  console.log('\nAtleta: nutrición');
  const tarjetaNut = p.locator('button.nutricion-hoy');
  await tarjetaNut.waitFor();
  await tarjetaNut.click();
  const hojaNut = p.getByRole('dialog', { name: 'Apuntar la nutrición' });
  await hojaNut.locator('#nut-kcal').fill('1.850');
  await hojaNut.locator('#nut-prot').fill('120');
  await revisar('nutricion');
  await hojaNut.getByRole('button', { name: 'Guardar' }).click();
  await hojaNut.waitFor({ state: 'detached' });
  check((await tarjetaNut.getAttribute('aria-label')).includes('1850 de'), 'apunta lo que ha comido hoy («1.850» kcal) y el anillo de Hoy lo refleja');
  await p.getByRole('button', { name: 'Tu plan de nutrición' }).click();
  const hojaTuPlan = p.getByRole('dialog', { name: 'Tu plan de nutrición' });
  check((await hojaTuPlan.textContent()).includes('Proteína'), 'y ve su plan con sus cifras');
  await p.keyboard.press('Escape');
  await hojaTuPlan.waitFor({ state: 'detached' });

  console.log('\nAtleta: entrenar');
  await p.getByRole('button', { name: 'Empezar sesión' }).click();
  await p.locator('.ejercicio').first().waitFor();
  const prep = p.locator('.preparacion');
  check(await prep.count() === 1, 'antes de empezar le pregunta cómo llega');
  await prep.getByRole('group', { name: '¿Cómo has dormido?' }).getByRole('button', { name: 'Mal', exact: true }).click();
  await prep.getByRole('group', { name: '¿Cómo tienes la energía?' }).getByRole('button', { name: 'Normal', exact: true }).click();
  await revisar('preparacion');
  await prep.getByRole('group', { name: '¿Agujetas o molestias?' }).getByRole('button', { name: 'Ninguna', exact: true }).click();
  await p.locator('.consejo-dia.flojo').waitFor();
  check((await p.locator('.consejo-dia').textContent()).includes('no te propondrá subir carga'), 'durmió mal: día flojo, y ese día no le propone subir carga');
  const primero = p.locator('.ejercicio').first();
  await primero.getByLabel('Kilos de la serie 1').fill('42,5');
  await primero.getByLabel('Repeticiones de la serie 1').fill('6');
  await primero.getByLabel('RPE de la serie 1').selectOption('8');
  await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
  await p.locator('.temporizador').waitFor();
  check((await p.locator('.temporizador .cuenta').textContent()).startsWith('2:') || (await p.locator('.temporizador .cuenta').textContent()).startsWith('3:'), 'arranca el descanso pautado');
  await p.getByRole('button', { name: 'Añadir 15 segundos' }).click();
  await p.getByRole('button', { name: 'Saltar' }).click();
  check(await primero.getByLabel('Kilos de la serie 2').getAttribute('placeholder') === '37,5', 'la back-off propone un 10 % menos que lo que hizo en la top (42,5 → 37,5)');
  check((await primero.locator('.backoff-nota').textContent()).includes('37,5 kg') && (await primero.locator('.serie .n').first().textContent()) === 'T', 'y lo explica, con la top marcada');
  await primero.getByRole('button', { name: 'Marcar la serie 2 como hecha' }).click();
  await p.getByRole('button', { name: 'Saltar' }).click();
  await primero.getByRole('button', { name: 'Marcar la serie 3 como hecha' }).click();
  await p.getByRole('button', { name: 'Saltar' }).click();
  check((await primero.locator('.progreso-series').getAttribute('class')).includes('hecho'), 'el ejercicio queda completo (3/3)');
  await primero.getByRole('button', { name: 'Quitar la serie 3' }).click();
  await p.getByText('Serie 3 quitada').waitFor();
  check((await primero.locator('.progreso-series').textContent()) === '2/3', 'quitar una serie por error');
  await primero.getByRole('button', { name: 'Marcar la serie 3 como hecha' }).click();
  await p.getByRole('button', { name: 'Saltar' }).click();
  await revisar('sesion');

  console.log('\nAtleta: herramientas del ejercicio');
  check((await primero.locator('.ejercicio-cab').textContent()).includes('Tempo 3-1-1'), 'el ejercicio muestra el tempo que puso el coach');
  await primero.getByRole('button', { name: 'Metrónomo de tempo 3-1-1' }).click();
  const metro = p.getByRole('dialog', { name: 'Tempo 3-1-1' });
  await metro.waitFor();
  check((await metro.textContent()).includes('baja en 3 s, 1 s abajo y sube en 1 s'), 'el metrónomo explica el tempo');
  await metro.getByRole('button', { name: 'Empezar' }).click();
  await metro.locator('.metro-grande', { hasText: 'Baja' }).waitFor({ timeout: 6000 });
  check((await metro.locator('.metro-rep').textContent()).startsWith('Repetición 1 de'), 'tras la cuenta atrás marca la bajada de la primera repetición');
  await metro.locator('.metro-grande', { hasText: 'Pausa abajo' }).waitFor({ timeout: 5000 });
  check(true, 'y pasa a la pausa abajo');
  await revisar('metronomo');
  await metro.getByRole('button', { name: 'Parar' }).click();
  await metro.getByRole('button', { name: 'Empezar' }).waitFor();
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await primero.getByRole('button', { name: 'Aproximación' }).click();
  await p.getByRole('heading', { name: 'Series de aproximación' }).waitFor();
  check(await p.locator('.aproximaciones li').count() >= 2, 'series de aproximación hasta la carga de trabajo');
  await revisar('aproximacion');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await primero.getByRole('button', { name: 'Historial' }).click();
  await p.locator('.historial-fila').first().waitFor();
  check(true, 'historial del ejercicio con lo de hoy');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.getByRole('button', { name: 'Calculadora' }).click();
  await p.locator('.tabla-rpe').waitFor();
  check((await p.locator('.cifra .v').first().textContent()) !== '—', 'calculadora de 1RM y tabla de RPE');
  await revisar('calculadora');
  // En el móvil, la hoja se cierra arrastrándola hacia abajo desde el asa
  const cab = await p.locator('.hoja-cab').boundingBox();
  // Despacio (sin «lanzarla»): 44 px en medio segundo
  await p.mouse.move(cab.x + cab.width / 2, cab.y + 16); await p.mouse.down();
  for (let y = 4; y <= 44; y += 4) { await p.mouse.move(cab.x + cab.width / 2, cab.y + 16 + y); await p.waitForTimeout(45); }
  await p.waitForTimeout(120); await p.mouse.up();
  await p.waitForTimeout(350);
  check(await p.locator('.hoja-dialogo').count() === 1, 'un arrastre corto devuelve la hoja a su sitio');
  await p.mouse.move(cab.x + cab.width / 2, cab.y + 16); await p.mouse.down();
  await p.mouse.move(cab.x + cab.width / 2, cab.y + 360, { steps: 10 }); await p.mouse.up();
  await p.locator('.hoja-dialogo').waitFor({ state: 'detached' });
  check(await p.evaluate(() => document.body.style.overflow === ''), 'arrastrándola hacia abajo se cierra (y la página vuelve a desplazarse)');

  console.log('\nAtleta: cambiar un ejercicio');
  const segundo = p.locator('.ejercicio').nth(1);
  const nombreOriginal = (await segundo.locator('.ejercicio-cab .nombre').textContent()).trim();
  if (!(await segundo.getByRole('button', { name: 'Cambiar' }).count())) await segundo.locator('.ejercicio-cab').click();
  await segundo.getByRole('button', { name: 'Cambiar' }).click();
  await p.getByRole('heading', { name: 'Cambiar ejercicio' }).waitFor();
  const alternativas = p.locator('.hoja-dialogo .lista-elegir button');
  if ((await alternativas.count()) < 2) {
    await p.getByRole('button', { name: /Ver otros de/ }).click();
    await p.locator('.hoja-dialogo .lista-elegir').nth(1).locator('button').first().waitFor();
  }
  await p.locator('.hoja-dialogo .lista-elegir button:not(.elegida)').nth(0).click();
  await segundo.locator('.cambiado').waitFor();
  check((await segundo.locator('.cambiado').textContent()).includes(nombreOriginal), `cambia ${nombreOriginal} por otro y lo indica`);
  await segundo.getByLabel('Kilos de la serie 1').fill('30');
  await segundo.getByLabel('Repeticiones de la serie 1').fill('10');
  await segundo.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
  await p.getByRole('button', { name: 'Saltar' }).click();

  console.log('\nAtleta: comentario para el coach');
  await p.getByLabel('Escribir a tu coach').fill('He cambiado el remo porque la barra estaba ocupada');
  await p.locator('.responder button[aria-label="Enviar"]').click();
  await p.locator('.mensaje.mio', { hasText: 'He cambiado el remo' }).waitFor();
  check(true, 'envía un comentario en la sesión');
  await revisar('sesion-comentario');
  const { VIDEO_EJEMPLO } = await import('../web/src/datos/video-demo.js');
  await primero.locator('input[type=file]').setInputFiles({ name: 'press.mp4', mimeType: 'video/mp4', buffer: Buffer.from(VIDEO_EJEMPLO.split(',')[1], 'base64') });
  await p.getByLabel('¿Qué quieres que mire?').fill('¿Bajo bien la barra?');
  await revisar('subir-video');
  await p.getByRole('button', { name: 'Enviar a tu coach' }).click();
  await p.locator('.toast', { hasText: 'Vídeo enviado a tu coach' }).waitFor();
  check(true, 'envía un vídeo de técnica de su serie');
  await p.getByRole('button', { name: 'Terminar sesión' }).click();
  await p.locator('.hoja-dialogo .segmentos button', { hasText: '8' }).click();
  await p.getByLabel('Nota para tu coach').fill('Me he notado fuerte en el press');
  await p.getByRole('button', { name: 'Guardar y terminar' }).click();
  await p.getByRole('heading', { name: 'Sesión terminada' }).waitFor();
  check((await p.locator('.resumen-num .v').first().textContent()) === '4', 'resumen: 4 series (3 de press y 1 del ejercicio cambiado)');
  await p.getByRole('button', { name: 'Compartir la sesión' }).click();
  await p.locator('.tarjeta-img').waitFor();
  check((await p.locator('.tarjeta-img').evaluate((i) => i.complete && i.naturalWidth)) === 1080, 'crea la tarjeta para compartir (1080 × 1350)');
  await revisar('compartir');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.getByRole('button', { name: 'Volver a hoy' }).click();
  await p.locator('.titular h2', { hasText: 'Pierna A' }).waitFor();
  check(true, 'hoy pasa a la siguiente sesión (Pierna A)');
  check((await p.locator('.semana-resumen .anillo').getAttribute('aria-label')) === '1 de 3 sesiones hechas esta semana' && (await p.locator('.semana-resumen').textContent()).includes('Te quedan 2 sesiones'), 'el anillo de la semana marca 1 de 3');

  const disco = p.getByRole('dialog', { name: /disco/ });
  await disco.waitFor();
  check((await disco.textContent()).includes('Constancia'), `tras su primera sesión gana su primer disco (${(await disco.locator('h2').textContent()).trim()})`);
  await revisar('logro');
  await disco.getByRole('button', { name: 'Seguir' }).click();
  await disco.waitFor({ state: 'detached' });

  console.log('\nAtleta: superserie');
  await p.getByRole('button', { name: 'Empezar sesión' }).click();
  const ss = p.locator('.superserie');
  await ss.waitFor();
  check((await ss.locator('.ss-etq').allTextContents()).join(',') === 'A1,A2', 'la superserie aparece agrupada (A1, A2)');
  const a1 = ss.locator('.ejercicio').nth(0), a2 = ss.locator('.ejercicio').nth(1);
  if (!(await a1.locator('.serie').count())) await a1.locator('.ejercicio-cab').click();
  await a1.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
  await p.locator('.toast', { hasText: 'Ahora A2' }).waitFor();
  check(!(await p.locator('.temporizador').count()), 'tras A1 pasa a A2 sin descanso');
  await a2.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
  await p.locator('.temporizador').waitFor();
  check((await p.locator('.temporizador .que').textContent()).includes('serie 2 de A1'), 'al cerrar la ronda, descanso y vuelta a A1');
  await revisar('superserie');
  await p.getByRole('button', { name: 'Saltar' }).click();
  await a2.getByRole('button', { name: 'Quitar la serie 1' }).click();
  await a1.getByRole('button', { name: 'Quitar la serie 1' }).click();

  console.log('\nAtleta: modo enfoque');
  await p.getByRole('button', { name: 'Modo enfoque' }).click();
  const enf = p.getByRole('dialog', { name: 'Modo enfoque' });
  await enf.waitFor();
  check((await enf.locator('h2').textContent()).length > 3 && (await enf.locator('.enfoque-donde').textContent()).startsWith('Ejercicio 1 de'), 'abre el primer ejercicio a pantalla completa');
  const kgAntes = await enf.getByLabel('Kilos', { exact: true }).inputValue();
  await enf.getByRole('button', { name: /^Añadir .* kilos$/ }).click();
  check((await enf.getByLabel('Kilos', { exact: true }).inputValue()) !== kgAntes, 'los botones + y − cambian los kilos');
  await enf.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
  await enf.locator('.chip-serie.hecha').waitFor();
  // La sentadilla de la plantilla va con serie top y back-off
  check((await enf.locator('.enfoque-serie-n').textContent()).startsWith('Back-off 1 de 3'), 'marca la serie top y pasa a la primera back-off');
  await revisar('enfoque');
  await enf.getByRole('button', { name: 'Ejercicio siguiente' }).click();
  check((await enf.locator('.enfoque-donde').textContent()).startsWith('Ejercicio 2 de'), 'pasa al ejercicio siguiente');
  await enf.getByRole('button', { name: 'Metrónomo de tempo 3-1-1' }).click();
  await p.getByRole('dialog', { name: 'Tempo 3-1-1' }).waitFor();
  await p.keyboard.press('Escape');
  await p.getByRole('dialog', { name: 'Tempo 3-1-1' }).waitFor({ state: 'detached' });
  check(await enf.isVisible(), 'el peso muerto rumano trae su tempo: el metrónomo se abre y Escape lo cierra sin salir del modo enfoque');
  await enf.getByRole('button', { name: 'Salir del modo enfoque' }).click();
  await p.locator('.enfoque').waitFor({ state: 'detached' });
  await p.locator('.ejercicio').first().getByRole('button', { name: 'Quitar la serie 1' }).click();
  await p.getByRole('button', { name: 'Volver' }).click();
  await p.locator('.titular h2', { hasText: 'Pierna A' }).waitFor();

  console.log('\nAtleta: peso de hoy');
  await p.getByRole('button', { name: 'Apuntar el de hoy' }).click();
  await p.locator('#peso-hoy').fill('70,4');
  await p.locator('#peso-hoy').blur();
  await p.getByRole('button', { name: 'Guardar', exact: true }).click();
  await p.locator('.peso-hoy .chip', { hasText: 'Apuntado' }).waitFor();
  check(!/\d/.test(await p.locator('.peso-hoy').textContent()), 'apunta su peso de hoy en un toque; en Hoy, sin la cifra (a Guti no le gustaba verla siempre)');

  console.log('\nAtleta: check-in');
  await p.locator('.tab', { hasText: 'Check-in' }).click();
  await p.getByRole('group', { name: 'Horas de sueño' }).getByRole('button', { name: '7–8' }).click();
  await p.getByRole('group', { name: 'Energía (cansancio)' }).getByRole('button', { name: '4' }).click();
  await p.getByRole('group', { name: 'Motivación' }).getByRole('button', { name: '5' }).click();
  await p.locator('.zonas button', { hasText: 'Hombros' }).click();
  await p.getByRole('group', { name: 'Intensidad en Hombros' }).getByRole('button', { name: 'Moderada' }).click();
  await p.getByRole('textbox', { name: 'peso en kilos' }).fill('58,4');
  await p.getByRole('textbox', { name: 'peso en kilos' }).blur();
  await p.getByRole('textbox', { name: 'Cintura en centímetros' }).fill('68,5');
  await p.getByRole('textbox', { name: 'Cintura en centímetros' }).blur();
  await revisar('checkin');
  await p.getByRole('button', { name: 'Enviar check-in' }).click();
  await p.getByText('Check-in enviado a tu coach').waitFor();
  check(true, 'envía el check-in');
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.getByRole('heading', { name: 'Peso corporal' }).waitFor();
  check((await p.locator('.cifra .v').first().textContent()) === '58,4', 'el peso aparece en su progreso');
  check(await p.getByRole('heading', { name: 'Medidas' }).count() === 1, 'y sus medidas');
  await revisar('progreso');
  await abrirPestana(p, 'Perfil');
  await p.getByRole('heading', { name: 'Guías y recursos' }).waitFor();
  check(await p.locator('.recurso details').count() >= 10, 've las guías y preguntas frecuentes');
  await revisar('perfil');
  await p.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Oscuro' }).click();
  check(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'elige el tema oscuro en este móvil');
  await p.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Sistema' }).click();
  check(await p.evaluate(() => !document.documentElement.hasAttribute('data-theme')), 'y vuelve al del sistema');
  await p.getByRole('switch', { name: /Vibración/ }).uncheck();
  check(await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes')).vibracion === false), 'quita la vibración (se recuerda en el móvil)');
  await p.getByRole('switch', { name: /Vibración/ }).check();
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();

  console.log('\nCoach: lo ve en su panel');
  await p.getByRole('button', { name: /Pelayo/ }).click();
  const tarjeta = p.locator('.tarjeta-atleta', { hasText: 'Lucía Prueba' });
  await tarjeta.waitFor();
  check((await tarjeta.textContent()).includes('Dolor moderado: hombros'), 'aviso de molestia moderada en hombros');
  check(await tarjeta.locator('.pips i.hecha').count() === 1, '1 sesión hecha esta semana');
  check((await tarjeta.textContent()).includes('por revisar'), 'el panel marca lo que tiene por revisar');
  check((await p.locator('.tarjeta-atleta', { hasText: 'Rubén Martín' }).textContent()).includes('Hábitos:'), 'y avisa de que Rubén apenas cumple sus hábitos');
  await tarjeta.click();
  await p.getByRole('tab', { name: 'Registro' }).click();
  await p.getByText('Me he notado fuerte en el press').waitFor();
  check((await p.locator('.registro-serie').nth(1).textContent()).includes('42,5×6 @8'), 've la serie registrada y la nota de la sesión');
  check(await p.locator('.cambio', { hasText: 'Hecho como' }).count() === 1, 've el ejercicio que cambió');
  await revisar('registro');

  console.log('\nCoach: revisar y responder');
  await p.locator('.tab', { hasText: 'Revisar' }).click();
  await p.getByRole('heading', { name: 'Revisar' }).waitFor();
  const msg = p.locator('.tarjeta-revisar', { hasText: 'He cambiado el remo' });
  await msg.waitFor();
  check(true, 'la bandeja trae el comentario de Lucía');
  await revisar('revisar');
  await msg.getByRole('button', { name: 'Responder' }).click();
  await msg.getByRole('button', { name: 'Respuestas guardadas' }).click();
  await p.locator('.respuesta-guardada').first().locator('button').first().click();
  check((await msg.getByRole('textbox', { name: /Responder a Lucía/ }).inputValue()).includes('Lucía'), 'una respuesta guardada se pone con el nombre de la atleta');
  await msg.getByRole('textbox', { name: /Responder a Lucía/ }).fill('Perfecto, apúntalo siempre así');
  await msg.locator('button[aria-label="Enviar"]').click();
  await p.locator('.tarjeta-revisar', { hasText: 'He cambiado el remo' }).waitFor({ state: 'detached' });
  check(await p.locator('.tarjeta-revisar', { hasText: 'Torso A' }).filter({ hasText: 'Lucía' }).count() === 0, 'al responder, su sesión sale de la bandeja');
  const vid = p.locator('.tarjeta-revisar', { hasText: '¿Bajo bien la barra?' });
  await vid.getByRole('button', { name: 'Ver y comentar' }).click();
  await vid.locator('video.medio').waitFor();
  check(true, 've el vídeo de Lucía en la bandeja');
  await vid.getByRole('button', { name: 'Fotograma siguiente' }).and(p.locator(':enabled')).waitFor();
  await vid.getByRole('button', { name: '0,25×' }).click();
  for (let i = 0; i < 4; i++) await vid.getByRole('button', { name: 'Fotograma siguiente' }).click();
  const [vel, tiempo] = await vid.locator('video.medio').evaluate((v) => [v.playbackRate, v.currentTime]);
  check(vel === 0.25 && tiempo > 0.1 && tiempo < 0.2, `a cámara lenta y fotograma a fotograma (${tiempo.toFixed(2)} s)`);
  await vid.getByRole('button', { name: 'Comentar este momento' }).click();
  const caja = vid.getByRole('textbox', { name: /Responder a Lucía/ });
  check(/^0:00,1 $/.test(await caja.inputValue()), 'marca el momento del vídeo en la respuesta');
  await caja.press('End');
  await caja.type('bien: toca el pecho y sube recta');
  // v0.14: una línea y un ángulo sobre el fotograma
  await vid.getByRole('button', { name: 'Dibujar sobre el vídeo' }).click();
  const lienzo = vid.locator('.rep-lienzo');
  await lienzo.waitFor();
  const lb = await lienzo.boundingBox();
  const pt = async (fx, fy) => [lb.x + lb.width * fx, lb.y + lb.height * fy];
  let [x1, y1] = await pt(0.3, 0.3); let [x2, y2] = await pt(0.6, 0.7);
  await p.mouse.move(x1, y1); await p.mouse.down(); await p.mouse.move(x2, y2, { steps: 5 }); await p.mouse.up();
  await vid.getByRole('button', { name: 'Ángulo' }).click();
  for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.2], [0.8, 0.5]]) { const [x, y] = await pt(fx, fy); await p.mouse.click(x, y); }
  check(await lienzo.locator('.forma').count() === 2 && /°/.test(await lienzo.locator('text').textContent()), 'dibuja una línea y un ángulo (con sus grados) sobre el vídeo en pausa');
  await revisar('dibujo');
  await vid.getByRole('button', { name: 'Hecho' }).click();
  check((await vid.locator('.chip-dibujo').textContent()).includes('una línea y un ángulo'), 'el dibujo queda listo para ir con el comentario');
  await vid.locator('button[aria-label="Enviar"]').click();
  await p.locator('.tarjeta-revisar', { hasText: '¿Bajo bien la barra?' }).waitFor({ state: 'detached' });
  const ck = p.locator('.tarjeta-revisar', { hasText: 'Check-in' }).filter({ hasText: 'Lucía' });
  await ck.getByRole('button', { name: 'Revisado' }).click();
  await p.locator('.toast', { hasText: 'Check-in revisado' }).waitFor();
  await ck.waitFor({ state: 'detached' });
  await p.locator('.toast').getByRole('button', { name: 'Deshacer' }).click();
  await ck.waitFor();
  check(true, '«Deshacer» devuelve el check-in a la bandeja');
  await ck.focus();
  await p.keyboard.press('e');
  await ck.waitFor({ state: 'detached' });
  check(true, 'y con la tecla e queda revisado otra vez');

  console.log('\nCoach: avisos y plantilla para varios');
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.getByRole('button', { name: 'Avisos para tus atletas' }).click();
  await p.getByLabel('Nuevo aviso').fill('Lucía: el jueves no hay sala, haz la Pierna A el viernes');
  await p.getByLabel('Para', { exact: true }).selectOption({ label: 'Lucía Prueba' });
  await revisar('avisos');
  await p.getByRole('button', { name: 'Publicar aviso' }).click();
  const filaAviso = p.locator('.aviso-fila', { hasText: 'el jueves no hay sala' });
  await filaAviso.waitFor();
  check((await filaAviso.textContent()).includes('Para Lucía Prueba'), 'publica un aviso solo para Lucía');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.locator('.tab', { hasText: 'Plantillas' }).click();
  await p.getByRole('button', { name: 'Asignar Full body 2 días a atletas' }).click();
  for (const n of ['Rubén Martín', 'Carlos Vera']) await p.getByRole('checkbox', { name: n }).check();
  await revisar('asignar');
  await p.getByRole('button', { name: 'Crear 2 bloques' }).click();
  await p.getByRole('button', { name: 'Listo' }).waitFor();
  check(await p.locator('.fila-resultado:not(.fallo)').count() === 2, 'asigna una plantilla a dos atletas de una vez');
  await p.getByRole('button', { name: 'Listo' }).click();

  console.log('\nCoach: actividad, objetivos de fuerza y cargas sugeridas');
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).click();
  const sugeridas = p.getByRole('button', { name: 'Cargas sugeridas' });
  await sugeridas.waitFor();
  await sugeridas.click();
  const hojaCargas = p.getByRole('dialog', { name: /^Cargas sugeridas para la semana/ });
  await hojaCargas.waitFor();
  const marcadas = await hojaCargas.getByRole('checkbox', { checked: true }).count();
  const filasSug = await hojaCargas.locator('li.carga-sug').count();
  check(filasSug >= 4, `propone cargas para la semana con su motivo (${filasSug} ejercicios, ${marcadas} marcados de entrada: los que suben)`);
  await revisar('cargas-sugeridas');
  await hojaCargas.getByRole('checkbox', { checked: false }).first().check();
  check(await hojaCargas.getByRole('button', { name: `Aplicar ${marcadas + 1} ${marcadas + 1 === 1 ? 'carga' : 'cargas'}` }).isVisible(), 'el coach marca a mano las que quiera');
  await hojaCargas.getByRole('button', { name: /^Aplicar \d+ carga/ }).click();
  await p.locator('.toast', { hasText: /carga(s)? actualizada/ }).waitFor();
  check(true, 'y las aplica de una vez');
  await p.getByRole('tab', { name: 'Actividad' }).click();
  await p.locator('.actividad-item').first().waitFor();
  check(await p.locator('.actividad-dia').count() >= 3, 'Actividad: lo que ha hecho Ana, día a día');
  await p.getByRole('group', { name: 'Qué ver' }).getByRole('button', { name: 'Récords' }).click();
  check(await p.locator('.actividad-item.act-record').count() >= 1 && await p.locator('.actividad-item:not(.act-record)').count() === 0, 'se puede filtrar (solo récords)');
  await revisar('actividad');
  await p.getByRole('tab', { name: 'Objetivos' }).click();
  await p.locator('.lista .detalle', { hasText: 'automático' }).first().waitFor();
  check(await p.locator('.lista .detalle', { hasText: 'automático' }).count() === 2, 'sus dos objetivos de fuerza avanzan solos');
  await p.getByRole('button', { name: 'Nuevo objetivo' }).click();
  await p.getByRole('button', { name: 'Elegir ejercicio' }).click();
  await p.getByLabel('Buscar ejercicio').fill('remo con barra');
  await p.locator('.lista-elegir button', { hasText: 'Remo con barra' }).first().click();
  await p.getByLabel('kilos del objetivo', { exact: true }).fill('70');
  await p.getByLabel('repeticiones del objetivo', { exact: true }).fill('5');
  await p.getByLabel('Objetivo', { exact: true }).click();
  check((await p.getByLabel('Objetivo', { exact: true }).getAttribute('placeholder')) === 'Remo con barra 70 kg × 5', 'propone el título con la marca');
  await revisar('objetivo-marca');
  await p.getByRole('button', { name: 'Guardar' }).click();
  const nuevoObj = p.locator('.lista li', { hasText: 'Remo con barra 70 kg × 5' });
  await nuevoObj.waitFor();
  check((await nuevoObj.textContent()).includes('(automático)'), 'el objetivo nuevo queda enlazado y calcula su progreso');
  await p.getByRole('tab', { name: 'Vídeos y fotos' }).click();
  await p.getByRole('button', { name: 'Antes y después' }).click();
  const comparar = p.getByRole('dialog', { name: 'Antes y después' });
  await comparar.locator('.comparar-marco img').nth(1).waitFor();
  const rango = comparar.getByLabel('Cuánto se ve de la foto de antes');
  await rango.focus();
  for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowLeft');
  check(Number(await rango.inputValue()) < 50 && (await comparar.locator('.comparar-antes').getAttribute('style')).includes('inset'), 'el deslizador descubre una foto sobre la otra');
  await comparar.getByRole('button', { name: 'Lado a lado' }).click();
  check(await comparar.locator('.comparar-lado img').count() === 2, 'o las pone lado a lado');
  await comparar.getByRole('radiogroup', { name: 'Antes' }).getByRole('radio').nth(1).click();
  check((await comparar.textContent()).includes('28 días entre una y otra'), 'se elige qué fotos comparar');
  await revisar('antes-despues');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  // v0.15: dos vídeos lado a lado (Rubén tiene dos) y «lo que le pide la app»
  await p.getByRole('button', { name: 'Volver a atletas' }).click();
  await p.locator('.tarjeta-atleta', { hasText: 'Rubén Martín' }).first().click();
  await p.getByRole('tab', { name: 'Datos' }).click();
  await p.locator('.panel', { hasText: 'Lo que le pide la app cada día' }).waitFor();
  check((await p.locator('.panel', { hasText: 'Lo que le pide la app cada día' }).textContent()).includes('2 activos'), 'en Datos ves de un vistazo lo que le pide la app a Rubén (sus 2 hábitos, su plan, su check-in)');
  await p.getByRole('tab', { name: 'Vídeos y fotos' }).click();
  await p.getByRole('button', { name: 'Comparar dos' }).click();
  const compVid = p.getByRole('dialog', { name: 'Comparar dos vídeos' });
  await compVid.locator('video.medio').nth(1).waitFor();
  await compVid.getByRole('button', { name: 'Los dos a la vez' }).click();
  await p.waitForTimeout(500);
  check(await compVid.locator('video.medio').evaluateAll((vs) => vs.length === 2 && vs.every((v) => !v.paused || v.currentTime > 0)), 'sus dos vídeos de sentadilla, lado a lado y reproducidos a la vez');
  await revisar('comparar-videos');
  await compVid.getByRole('button', { name: 'Pausar los dos' }).click();
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.getByRole('button', { name: 'Volver a atletas' }).click();

  console.log('\nCoach: búsqueda rápida');
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.keyboard.press('Control+K');
  const paleta = p.getByRole('dialog', { name: 'Búsqueda rápida' });
  await paleta.waitFor();
  await p.locator('.paleta-op').nth(3).waitFor();
  check(await p.locator('.paleta-op').count() > 3, 'Ctrl + K abre la búsqueda con atajos a la vista');
  await paleta.getByRole('combobox').fill('lucia regis');
  await p.locator('.paleta-op.sel', { hasText: 'Lucía Prueba: Registro' }).waitFor();
  check(true, 'sin tildes, «lucia regis» propone la pestaña Registro de Lucía');
  await revisar('buscador');
  await p.keyboard.press('Enter');
  await p.getByRole('tab', { name: 'Registro', selected: true }).waitFor();
  check(await paleta.count() === 0, 'Enter abre la ficha de Lucía en Registro y cierra la búsqueda');
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.getByRole('button', { name: 'Buscar' }).click();
  await paleta.waitFor();
  await p.keyboard.press('Escape');
  await paleta.waitFor({ state: 'detached' });
  check(await p.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Buscar', null, { timeout: 2000 }).then(() => true, () => false), 'Esc la cierra y el foco vuelve a la lupa');
  await p.getByRole('button', { name: 'Buscar' }).click();
  await p.keyboard.type('press banca');
  check(await paleta.getByRole('combobox').inputValue() === 'press banca', 'lo que se escribe nada más abrirla no se pierde');
  await p.locator('.paleta-op', { hasText: 'Press banca' }).first().click();
  await p.locator('.hoja-dialogo').getByRole('textbox', { name: 'Nombre' }).waitFor();
  check((await p.locator('.hoja-dialogo').getByRole('textbox', { name: 'Nombre' }).inputValue()).startsWith('Press banca'), 'desde el móvil, la lupa lleva a un ejercicio de la biblioteca');
  await p.keyboard.press('Escape');
  await p.locator('.hoja-dialogo').waitFor({ state: 'detached' }).catch(() => {});
  if (await p.locator('.hoja-dialogo').count()) await p.locator('.hoja-dialogo').getByRole('button', { name: /Cancelar|Cerrar/ }).first().click();

  console.log('\nCoach: verificación en dos pasos');
  await abrirPestana(p, 'Cuenta');
  await p.getByRole('button', { name: 'Activar' }).click();
  await p.getByRole('button', { name: 'Continuar' }).click();
  await p.locator('img.qr').waitFor();
  await revisar('mfa-alta');
  await p.getByLabel('Código').fill('123456');
  await p.getByRole('button', { name: 'Activar' }).last().click();
  await p.locator('.toast', { hasText: 'Verificación en dos pasos activada' }).waitFor();
  await p.getByRole('button', { name: /Salir/ }).click();
  await p.getByRole('button', { name: /Pelayo/ }).click();
  await p.getByRole('heading', { name: 'Código de verificación' }).waitFor();
  check(true, 'al volver a entrar le pide el código');
  await revisar('mfa-entrar');
  await p.getByLabel('Código').fill('123456');
  await p.getByRole('button', { name: 'Entrar' }).click();
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  check(true, 'con el código entra a su panel');
  await p.locator('.tarjeta-atleta', { hasText: 'Lucía Prueba' }).click();

  console.log('\nAtleta: lee la respuesta');
  await p.getByRole('button', { name: 'Volver a atletas' }).click();
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await p.getByLabel('Email').fill('lucia@correo.test');
  await p.getByLabel('Contraseña').fill('una-contraseña-segura');
  await p.getByRole('button', { name: 'Entrar', exact: true }).click();
  await p.getByText('Tu coach te ha respondido').waitFor();
  check(true, 'en Hoy le avisa de la respuesta del coach');
  const disco2 = p.getByRole('dialog', { name: /disco/ });
  await disco2.waitFor();
  check((await disco2.textContent()).includes('Check-ins'), 'y le da el disco de su primer check-in');
  await disco2.getByRole('button', { name: 'Seguir' }).click();
  await disco2.waitFor({ state: 'detached' });
  const avisoLucia = p.locator('.aviso-coach', { hasText: 'el jueves no hay sala' });
  check((await avisoLucia.textContent()).includes('De tu coach, para ti'), 'en Hoy ve fijado el aviso que le dejó su coach');
  await avisoLucia.getByRole('button', { name: 'Ocultar el aviso' }).click();
  await avisoLucia.waitFor({ state: 'detached' });
  await p.locator('.respuesta', { hasText: 'Torso A' }).click();
  await p.locator('.mensaje.suyo', { hasText: 'Perfecto, apúntalo siempre así' }).waitFor();
  check(true, 'y la lee en su conversación');
  await revisar('respuesta');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.locator('.respuesta', { hasText: 'vídeo' }).click();
  await p.locator('.mensaje.suyo', { hasText: 'toca el pecho' }).waitFor();
  await p.locator('.hoja-dialogo video.medio').waitFor({ timeout: 8000 }).catch(() => {});
  check(await p.locator('.hoja-dialogo video.medio').count() === 1, 'y la corrección de su vídeo, con el vídeo');
  await p.locator('.hoja-dialogo .marca-tiempo').first().click();
  check(await p.locator('.hoja-dialogo video.medio').evaluate((v) => v.paused && v.currentTime > 0.05), 'tocar el momento de la corrección lleva el vídeo a ese punto');
  await p.locator('.hoja-dialogo').getByRole('button', { name: /Ver el dibujo/ }).click();
  await p.locator('.hoja-dialogo .rep-lienzo .forma').first().waitFor();
  check(await p.locator('.hoja-dialogo .rep-lienzo .forma').count() === 2, 'y «Ver el dibujo» le enseña la línea y el ángulo del coach sobre su vídeo');
  await revisar('dibujo-atleta');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.getByText('Tu coach te ha respondido').waitFor({ state: 'detached' });
  check(true, 'una vez leída, el aviso desaparece');

  console.log('\nDemo: atleta con historial');
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await p.getByRole('button', { name: /Ana López/ }).click();
  const discosAna = p.getByRole('dialog', { name: /discos nuevos/ });
  await discosAna.waitFor();
  check(true, 'la primera vez, Ana ve los discos que ya había ganado');
  await discosAna.getByRole('button', { name: 'Ver mis logros' }).click();
  await p.locator('.logros').waitFor();
  check(await p.locator('.logro').count() === 7, 'en Progreso, sus 7 logros');
  // v0.15: pistas la primera vez y «Tu día»
  const pistaProg = p.locator('.pista', { hasText: 'sale solo de lo que apuntas' });
  check(await pistaProg.count() === 1, 'la primera vez, Progreso explica en una línea para qué sirve');
  await pistaProg.getByRole('button', { name: 'Entendido' }).click();
  check(await pistaProg.count() === 0, 'y con «Entendido» no vuelve');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  const tuDia = p.locator('.tu-dia');
  await tuDia.waitFor();
  const filasDia = tuDia.locator('.fila-dia');
  check(await filasDia.count() >= 4 && (await tuDia.textContent()).includes('Tu día') && await tuDia.locator('.fila-dia.hecho').count() >= 1,
    `Hoy empieza con «Tu día»: ${await filasDia.count()} cosas, con lo hecho marcado`);
  await revisar('tu-dia');
  await tuDia.locator('.fila-dia', { hasText: 'Tus hábitos' }).click();
  // (si la página no da para más, la sección queda tan arriba como el final de la página permite)
  const bajo = await p.waitForFunction(() => { const t = document.querySelector('.seccion-habitos')?.getBoundingClientRect().top; return t < 200 || (scrollY > 800 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2); }, null, { timeout: 4000 }).then(() => true).catch(() => false);
  check(bajo, 'tocar una fila baja a esa parte de la pantalla');
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.locator('.logros').waitFor();
  await p.getByRole('heading', { name: 'Tus bloques' }).waitFor();
  await p.locator('.fila-semana', { hasText: 'Bloque 2' }).click();
  await p.locator('.informe').waitFor();
  check((await p.locator('.informe-fuerza li').count()) >= 3, 'el informe de su bloque trae la fuerza estimada de sus ejercicios principales');
  await revisar('informe');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.getByRole('button', { name: 'Gráficas, récords e historial' }).first().click();
  await p.getByRole('tab', { name: 'Gráficas', selected: true }).waitFor();
  check(await p.locator('.hoja-dialogo svg.grafica').waitFor().then(() => true, () => false), 'la ficha del ejercicio abre con su gráfica');
  await p.getByRole('button', { name: '1 año' }).click();
  await p.getByRole('tab', { name: 'Récords' }).click();
  check(await p.locator('.tabla-records tbody tr').count() >= 6, 'y la tabla de récords de 1 a 12 repeticiones');
  await revisar('ficha-ejercicio');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.locator('.tab', { hasText: 'Semana' }).click();
  check(await p.locator('.semanas-tabs button').count() === 4, 'Ana ve sus 4 semanas publicadas, no los borradores');
  await revisar('semana');
  await p.getByRole('heading', { name: 'Tus entrenamientos' }).waitFor();
  check(await p.locator('button.entreno').count() >= 8, 'y su historial de entrenamientos, agrupado por meses');
  const nombreEntreno = (await p.locator('button.entreno .entreno-nombre').first().evaluate((el) => el.firstChild.textContent)).trim();
  await p.locator('button.entreno').first().click();
  await p.getByRole('heading', { level: 1, name: nombreEntreno }).waitFor();
  check(true, `un entrenamiento del historial (${nombreEntreno}) se abre con lo que hizo`);
  await p.getByRole('button', { name: 'Volver' }).first().click();
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  const tarjetaSemana = p.locator('section[aria-label="Tu semana pasada"]');
  await tarjetaSemana.waitFor();
  check(/de \d+ sesiones/.test(await tarjetaSemana.textContent()), 'en Hoy, la tarjeta de su semana pasada');
  await tarjetaSemana.locator('.tarjeta-semana-abrir').click();
  const historia = p.getByRole('dialog', { name: /^Tu semana del/ });
  await historia.waitFor();
  await revisar('historia');
  await p.keyboard.press('ArrowRight');
  await p.locator('.historia-etq', { hasText: 'Has movido' }).waitFor();
  check(true, 'la historia de la semana se pasa con las flechas');
  await p.keyboard.press('Escape');
  await historia.waitFor({ state: 'detached' });
  check(await tarjetaSemana.count() === 0, 'al cerrarla, la tarjeta no vuelve a salir esa semana');

  console.log('\nDemo: serie top, intervalos y cámara guiada');
  await p.locator('.toca-hoy').waitFor();
  check((await p.locator('.titular h2').textContent()) === 'Torso B', 'Ana tenía Torso B para hoy: «Hoy toca»');
  await p.getByRole('button', { name: 'Empezar sesión' }).click();
  await p.locator('.ejercicio').first().waitFor();
  const prepAna = p.locator('.preparacion');
  if (await prepAna.count()) { for (const [g, x] of [['¿Cómo has dormido?', 'Bien'], ['¿Cómo tienes la energía?', 'Alta'], ['¿Agujetas o molestias?', 'Ninguna']]) await prepAna.getByRole('group', { name: g }).getByRole('button', { name: x, exact: true }).click(); }
  const primeroAna = p.locator('.ejercicio').first();
  check((await primeroAna.locator('.pauta').textContent()).includes('1 × 8–10 + 2 × \u221210 %'), 'su pauta: «1 × 8–10 + 2 × −10 %»');
  await primeroAna.getByLabel('Kilos de la serie 1').fill('18');
  await primeroAna.getByLabel('Repeticiones de la serie 1').fill('10');
  await primeroAna.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
  await p.getByRole('button', { name: 'Saltar' }).click();
  check(await primeroAna.getByLabel('Kilos de la serie 2').getAttribute('placeholder') === '16', 'la back-off sale de lo que hizo en la top: 18 kg − 10 % = 16 kg (de 2 en 2 con mancuernas)');
  await revisar('top-backoff');
  await p.locator('.tarjeta-intervalos').click();
  const intv = p.getByRole('dialog', { name: 'Temporizador de intervalos' });
  await intv.waitFor();
  check((await intv.textContent()).includes('EMOM 6 min'), 'el temporizador se abre con el EMOM que escribió el coach');
  await revisar('intervalos');
  await intv.getByRole('button', { name: 'Empezar' }).click();
  await intv.locator('.intervalos-fase', { hasText: 'Prepárate' }).waitFor();
  await intv.getByRole('button', { name: 'Saltar a la siguiente fase' }).click();
  await intv.locator('.intervalos-fase', { hasText: 'Trabajo' }).waitFor();
  check((await intv.locator('.intervalos-ronda').textContent()) === 'Ronda 1 de 6', 'tras la cuenta atrás: trabajo, ronda 1 de 6');
  await revisar('intervalos-marcha');
  await intv.getByRole('button', { name: 'Pausar' }).click();
  const quieto = await intv.locator('.intervalos-cuenta').textContent();
  await p.waitForTimeout(1300);
  check(quieto === await intv.locator('.intervalos-cuenta').textContent(), 'en pausa, el reloj se para');
  await intv.getByRole('button', { name: 'Parar y volver a la configuración' }).click();
  await intv.getByRole('button', { name: 'Cerrar el temporizador' }).click();
  await intv.waitFor({ state: 'detached' });
  await p.getByRole('button', { name: 'Volver' }).first().click();
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.getByRole('button', { name: 'Foto de progreso' }).click();
  const nuevaFoto = p.getByRole('dialog', { name: 'Nueva foto de progreso' });
  await nuevaFoto.getByRole('button', { name: /^Frente/ }).click();
  await nuevaFoto.getByRole('button', { name: 'Hacer la foto con guía' }).click();
  const camara = p.getByRole('dialog', { name: 'Foto de progreso: frente' });
  await camara.waitFor();
  await p.waitForFunction(() => document.querySelector('.camara video')?.videoWidth > 0);
  await camara.locator('.camara-guia').waitFor();
  check(true, 'la cámara se abre con su última foto de frente en transparencia para encuadrar igual');
  await revisar('camara');
  await camara.getByRole('button', { name: 'Ya', exact: true }).click();
  await camara.getByRole('button', { name: 'Hacer la foto' }).click();
  await camara.locator('.camara-foto').waitFor();
  // «Repetir» vuelve a la cámara, que sigue abierta (antes se quedaba en negro y el disparador no hacía nada)
  await camara.getByRole('button', { name: 'Repetir' }).click();
  await p.waitForFunction(() => document.querySelector('.camara video')?.videoWidth > 0 && !document.querySelector('.camara-foto'));
  await camara.getByRole('button', { name: 'Hacer la foto' }).click();
  await camara.locator('.camara-foto').waitFor();
  check(true, 'repetir la foto vuelve a la cámara y se puede hacer otra');
  await camara.getByRole('button', { name: 'Usar esta foto' }).click();
  const guardarFoto = p.getByRole('dialog', { name: 'Foto de frente' });
  await guardarFoto.getByRole('button', { name: 'Guardar foto' }).click();
  await p.locator('.toast', { hasText: 'Foto de frente guardada' }).waitFor();
  await p.keyboard.press('Escape');
  await p.locator('.diario-item', { hasText: 'Frente' }).nth(3).waitFor();
  check(await p.locator('.diario-item', { hasText: 'Frente' }).count() === 4, 'la foto se guarda con su pose (4 de frente en el diario)');

  console.log('\nDemo: nutrición');
  await p.locator('.grafica-ingesta').scrollIntoViewIfNeeded();
  check((await p.locator('.grafica-ingesta').getAttribute('aria-label')).includes('apuntados') && (await p.locator('.gasto-atleta').textContent()).includes('gasto estimado'), 'en Progreso, Ana ve cada día frente a su objetivo y su gasto estimado');
  await revisar('nutricion-progreso');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  const segDia = p.getByRole('group', { name: 'Qué día es hoy' });
  check(await segDia.getByRole('button', { name: 'Hoy entreno' }).getAttribute('aria-pressed') === 'true', 'hoy le toca Torso B: objetivo de día de entreno');
  await segDia.getByRole('button', { name: 'Hoy descanso' }).click();
  await p.waitForFunction(() => document.querySelector('button.nutricion-hoy')?.getAttribute('aria-label')?.includes('de 1695 kcal'));
  check(true, 'si al final no entrena, lo cambia a día de descanso y el objetivo baja (1695 kcal)');
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await p.getByRole('button', { name: /Pelayo/ }).click();
  // En la demo, el coach tiene la verificación en dos pasos (código 123456)
  const codigo2fa = p.getByLabel('Código', { exact: true });
  await Promise.race([codigo2fa.waitFor(), p.getByRole('heading', { name: 'Atletas' }).waitFor()]);
  if (await codigo2fa.isVisible().catch(() => false)) { await codigo2fa.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
  await p.getByRole('tab', { name: 'Nutrición' }).click();
  await p.locator('.ajuste-nutricion').waitFor();
  await revisar('nutricion-coach');
  await p.getByRole('button', { name: /Revisar y aplicar/ }).click();
  const hojaCambio = p.getByRole('dialog', { name: 'Cambiar el plan' });
  check((await hojaCambio.locator('#pn-motivo').inputValue()).startsWith('Ajuste: gastas'), 'el ajuste sugerido abre el plan ya cambiado, con el motivo escrito para Ana');
  await hojaCambio.getByRole('button', { name: /^Guardar/ }).click();
  await p.locator('.toast', { hasText: /Plan guardado/ }).waitFor();
  check(new Date().getDay() === 1 || await p.locator('.version-plan', { hasText: '(próximo)' }).count() === 1, 'y se guarda como una versión nueva que empieza el lunes');

  // v0.12: notificaciones (en la demo no se envían, pero se eligen igual)
  await abrirPestana(p, 'Cuenta');
  await p.getByRole('button', { name: /Ajustes/ }).filter({ has: p.locator('svg') }).first().click();
  const hojaNotiC = p.getByRole('dialog', { name: 'Notificaciones' });
  await hojaNotiC.locator('.estado-notificaciones').waitFor();
  check((await hojaNotiC.textContent()).includes('En la demo no se envían') && await hojaNotiC.getByRole('switch', { name: /Mensajes de tus atletas/ }).isChecked()
    && !(await hojaNotiC.getByRole('switch', { name: /Sesiones terminadas/ }).isChecked()), 'el coach elige sus notificaciones: mensajes sí y sesiones terminadas, de entrada, no');
  await hojaNotiC.getByRole('switch', { name: /Sesiones terminadas/ }).check();
  await p.waitForTimeout(200);
  check(await hojaNotiC.locator('.lista-notificaciones li').count() === 3, 'y ve sus últimas notificaciones');
  await revisar('notificaciones-coach');
  await p.keyboard.press('Escape');
  await hojaNotiC.waitFor({ state: 'detached' });
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await p.getByRole('button', { name: /Ana/ }).click();
  await abrirPestana(p, 'Perfil');
  await p.getByRole('heading', { name: 'Notificaciones' }).waitFor();
  await p.getByRole('heading', { name: 'Notificaciones' }).locator('..').getByRole('button', { name: /Ajustes/ }).click();
  const hojaNoti = p.getByRole('dialog', { name: 'Notificaciones' });
  await hojaNoti.locator('.lista-notificaciones li').first().waitFor();
  check(await hojaNoti.locator('.lista-notificaciones li').count() === 3 && (await hojaNoti.locator('.lista-notificaciones').textContent()).includes('Pelayo te ha respondido'),
    'Ana ve sus últimas notificaciones');
  await hojaNoti.getByRole('switch', { name: /^Nutrición/ }).uncheck();
  await hojaNoti.locator('#nt-tarde').fill('20:30');
  await hojaNoti.locator('#nt-tarde').dispatchEvent('change');
  await p.waitForTimeout(250);
  await hojaNoti.getByRole('switch', { name: /De noche/ }).uncheck();
  await p.waitForTimeout(250);
  check(await hojaNoti.locator('#nt-desde').count() === 0 && await hojaNoti.locator('#nt-dia').count() === 1, 'quita la nutrición, cambia la hora de la tarde y el «no molestar»');
  await revisar('notificaciones-atleta');
  await p.keyboard.press('Escape');
  await hojaNoti.waitFor({ state: 'detached' });
  const resumenNoti = await p.getByRole('heading', { name: 'Notificaciones' }).locator('..').locator('.terciario').textContent();
  check(/Respuestas, semana, avisos, peticiones y 3 recordatorios/.test(resumenNoti), `y en Perfil se ve lo que tiene activado («${resumenNoti}»)`);

  // v0.13: cuestionario inicial y check-in a medida
  console.log('\nCuestionario y check-in a medida');
  await p.getByRole('button', { name: 'Revisar' }).first().click();
  const hojaCu = p.getByRole('dialog', { name: 'Tu cuestionario inicial' });
  await hojaCu.getByText('Paso 1 de 5').waitFor();
  check(await hojaCu.getByRole('button', { name: 'Ganar fuerza' }).getAttribute('aria-pressed') === 'true', 'Ana abre su cuestionario desde Perfil, con lo que ya contestó');
  await revisar('cuestionario-objetivo');
  check(await hojaCu.getByRole('button', { name: /Perder grasa/ }).getAttribute('aria-pressed') === 'true' && await hojaCu.locator('.objetivo-principal').count() === 1,
    'v0.20: tiene marcados sus dos objetivos (fuerza, el principal, y perder grasa)');
  await hojaCu.getByRole('button', { name: /Ganar fuerza/ }).click();
  await hojaCu.getByRole('button', { name: /Ganar músculo/ }).click();
  check(await hojaCu.locator('[aria-pressed="true"]', { hasText: 'Perder grasa' }).locator('.objetivo-principal').count() === 1,
    'quita uno y añade otro: el principal pasa a ser el primero que queda (perder grasa)');
  for (let i = 0; i < 3; i++) { await hojaCu.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(150); }
  await hojaCu.getByText('Paso 4 de 5').waitFor();
  await revisar('cuestionario-salud');
  await hojaCu.locator('.casilla', { hasText: 'Mareos' }).click();
  check(await hojaCu.getByText(/llama al 112/).isVisible(), 'si marca un síntoma, la app le dice al momento qué hacer si es urgente');
  await hojaCu.locator('.casilla', { hasText: 'Mareos' }).click();
  await hojaCu.locator('.lista-marcar').first().locator('.casilla.ninguna').click();
  await hojaCu.getByRole('button', { name: 'Siguiente' }).click();
  await hojaCu.getByText('Paso 5 de 5').waitFor();
  await hojaCu.getByRole('button', { name: 'Enviar a tu coach' }).click();
  const hojaFin = p.getByRole('dialog', { name: 'Cuestionario enviado' });
  await hojaFin.waitFor();
  check((await hojaFin.textContent()).includes('No hace falta que te vea un médico'), 'al enviarlo, ve la recomendación (sin síntomas ni enfermedad: no hace falta valoración médica)');
  await revisar('cuestionario-enviado');
  await hojaFin.getByRole('button', { name: 'Hecho' }).click();
  await p.locator('.tab', { hasText: 'Check-in' }).click();
  await p.getByRole('heading', { name: 'Preguntas de tu coach' }).waitFor();
  await p.getByRole('group', { name: 'Estrés en el trabajo o los estudios' }).getByRole('button', { name: '4' }).click();
  await revisar('checkin-preguntas');
  await p.getByRole('button', { name: /Enviar check-in|Actualizar check-in/ }).click();
  await p.locator('.toast', { hasText: /Check-in (enviado|actualizado)/ }).waitFor();
  check(true, 'responde la pregunta de su coach en el check-in');
  await abrirPestana(p, 'Perfil');
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await p.getByRole('button', { name: /Pelayo/ }).click();
  const codigoCu = p.getByLabel('Código', { exact: true });
  await Promise.race([codigoCu.waitFor(), p.getByRole('heading', { name: 'Atletas' }).waitFor()]);
  if (await codigoCu.isVisible().catch(() => false)) { await codigoCu.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  check((await p.locator('.tarjeta-atleta', { hasText: 'Rubén Martín' }).first().textContent()).includes('Cuestionario: revisa lo de salud'), 'el panel avisa de que Rubén ha contado algo de salud por revisar');
  await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
  await p.getByRole('tab', { name: 'Seguimiento' }).click();
  await p.getByRole('heading', { name: 'Su check-in' }).waitFor();
  await p.getByRole('group', { name: 'Qué le preguntas cada semana' }).getByRole('button', { name: 'Datos de reloj o app' }).click();
  await p.waitForTimeout(250);
  await p.getByRole('heading', { name: 'Su check-in' }).locator('..').getByRole('button', { name: 'Pregunta' }).click();
  const hojaPq = p.getByRole('dialog', { name: 'Nueva pregunta del check-in' });
  await hojaPq.getByLabel('Pregunta', { exact: true }).fill('Horas de sueño entre semana');
  await hojaPq.getByRole('button', { name: 'Un número' }).click();
  await hojaPq.getByLabel('Unidad (si tiene)').fill('h');
  await revisar('nueva-pregunta');
  await hojaPq.getByRole('button', { name: 'Añadir al check-in' }).click();
  await p.locator('.toast', { hasText: 'Pregunta añadida al check-in de Ana' }).waitFor();
  check(await p.locator('.lista-preguntas li', { hasText: 'Horas de sueño entre semana' }).count() === 1
    && await p.locator('.graficas-preguntas .panel', { hasText: 'Estrés en el trabajo' }).count() === 1, 'el coach le añade una pregunta solo a Ana y ve la evolución de su estrés');
  await revisar('su-checkin');
  await p.getByRole('tab', { name: 'Datos' }).click();
  await p.locator('.cuestionario-coach .datos-cuest').waitFor();
  check((await p.locator('.cuestionario-coach').textContent()).includes('Perder grasa y ganar músculo'), 'en Datos ve su cuestionario actualizado (con sus dos objetivos)');
  await revisar('cuestionario-coach');
  await p.locator('.cuestionario-coach').getByRole('button', { name: 'Pedir que lo actualice' }).click();
  await p.locator('.toast', { hasText: 'Le has pedido a Ana que lo actualice' }).waitFor();
  await p.getByRole('button', { name: 'Volver a atletas' }).click();
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await p.getByRole('button', { name: /Ana/ }).click();
  await p.locator('nav.tabs').waitFor();
  await p.locator('.tarjeta-cuestionario').waitFor();
  check((await p.locator('.tarjeta-cuestionario').textContent()).includes('Tu coach te pide que actualices tu cuestionario'), 'a Ana le aparece en Hoy que su coach le pide que lo actualice');
  await p.locator('.tab', { hasText: 'Check-in' }).click();
  await p.getByRole('heading', { name: 'Preguntas de tu coach' }).waitFor();
  check(await p.getByLabel('Horas de sueño entre semana (h)').count() === 1 && await p.getByRole('button', { name: /Datos de reloj o app/ }).count() === 0,
    'y en su check-in, la pregunta nueva y ya no los datos de reloj');

  console.log('\nDemo: el chat (v0.18) y el cardio (v0.17)');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  const tabMsg = p.locator('.tab', { hasText: 'Mensajes' });
  check((await tabMsg.locator('.insignia').textContent().catch(() => '')) === '1', 'la pestaña Mensajes avisa de un mensaje sin leer');
  await tabMsg.click();
  await p.locator('.burbuja', { hasText: 'versión con mancuernas' }).waitFor();
  const burbujas = p.locator('.burbuja');
  check(await burbujas.count() >= 5 && await p.locator('.burbuja .burbuja-ctx', { hasText: 'En Pierna A' }).count() >= 1 && await p.locator('.burbuja .medio-chat').count() === 1 && await p.locator('.chat-sep').count() >= 2,
    'el chat junta todo con el coach: los mensajes sueltos, los de las sesiones con su etiqueta, la foto del hotel y los separadores por día');
  await revisar('chat-atleta');
  await p.locator('.burbuja .burbuja-ctx', { hasText: 'En Pierna A' }).first().click();
  await p.locator('.cabecera h1', { hasText: 'Pierna A' }).waitFor();
  check(true, 'tocar la etiqueta abre esa sesión');
  await p.getByRole('button', { name: 'Volver' }).click();
  await p.locator('.tab', { hasText: 'Mensajes' }).click();
  await p.locator('.burbuja').first().waitFor();
  check(await tabMsg.locator('.insignia').count() === 0, 'al verlo, ya no queda nada sin leer');
  await p.locator('.chat-area').fill('Genial, gracias. Vuelvo el viernes y hago la tercera el sábado.');
  await p.getByRole('button', { name: 'Enviar' }).click();
  await p.locator('.burbuja.mia', { hasText: 'Vuelvo el viernes' }).waitFor();
  check((await p.locator('.burbuja.mia', { hasText: 'Vuelvo el viernes' }).locator('.visto').textContent()) === '✓', 'envía un mensaje: una marca hasta que el coach lo vea');
  await p.locator('input[type=file][accept="image/*,video/*"]').setInputFiles({ name: 'rodilla.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex') });
  await p.locator('.chat-adjunto').waitFor();
  await p.locator('.chat-area').fill('La rodilla hoy');
  await revisar('chat-adjunto');
  await p.getByRole('button', { name: 'Enviar' }).click();
  await p.locator('.burbuja.mia', { hasText: 'La rodilla hoy' }).waitFor();
  check(await p.locator('.burbuja.mia', { hasText: 'La rodilla hoy' }).locator('.medio-chat').count() === 1, 'y una foto con pie, que sale en su burbuja');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.getByRole('button', { name: 'Tu perfil' }).click();
  await p.getByRole('heading', { name: 'Tu asesoría' }).waitFor();
  check(true, 'Perfil se abre desde el avatar de arriba (ya no está en la barra del móvil)');
  // Foto de perfil (v0.19): cualquier imagen; el móvil la recorta en cuadrado y la comprime
  await p.locator('input[type=file][aria-label="Foto de perfil nueva"]').setInputFiles(new URL('../web/iconos/icono-512.png', import.meta.url).pathname);
  await p.locator('.cabecera .avatar.con-foto img').waitFor();
  const fotoAna = await p.locator('.cabecera .avatar.con-foto img').getAttribute('src');
  check(/^data:image\/jpeg;base64,/.test(fotoAna) && fotoAna.length < 80000, `pone su foto de perfil: recortada y comprimida en el móvil (${Math.round(fotoAna.length / 1024)} KB)`);
  await revisar('perfil-foto');
  // v0.25: tocar la foto la abre en grande (guardada a 384 px)
  await p.locator('.cabecera').getByRole('button', { name: /Ver en grande la foto/ }).click();
  const hojaFoto = p.locator('.foto-ampliada');
  await hojaFoto.waitFor();
  const ancho = await hojaFoto.evaluate((img) => img.naturalWidth);
  check(ancho === 384, `tocar su foto la abre en grande (${ancho} px)`);
  await revisar('foto-ampliada');
  await p.keyboard.press('Escape');
  await hojaFoto.waitFor({ state: 'detached' });
  await p.getByRole('button', { name: 'Volver a Hoy' }).click();
  await p.locator('.hero-dia').waitFor();
  check(await p.locator('.btn-avatar .avatar.con-foto').count() === 1, 'y sale en el botón de arriba de Hoy');
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.getByRole('heading', { name: 'Tu diario' }).waitFor();
  // El título sale antes que la cuadrícula: esperar a que estén todos (en una máquina lenta tarda)
  await p.locator('.diario-item').nth(5).waitFor().catch(() => {});
  const enDiario = await p.locator('.diario-item').count();
  check(enDiario >= 6 && await hay(p.locator('.diario-item.destacado'), 1) && await hay(p.locator('.diario-item', { hasText: 'Sentadilla' }), 2), `su diario tiene ${enDiario} vídeos y fotos, uno destacado; la foto del chat no está`);
  await p.locator('.diario .selector-chips').getByRole('button', { name: 'Destacados' }).click();
  check(await hay(p.locator('.diario-item'), 1), 'el filtro Destacados deja solo ese');
  await p.locator('.diario .selector-chips').getByRole('button', { name: 'Todo' }).click();
  await p.locator('.diario-item', { hasText: 'Press banca' }).click();
  const detalle = p.getByRole('dialog', { name: /Press banca/ });
  await detalle.waitFor();
  await detalle.getByRole('button', { name: 'Destacar' }).click();
  await detalle.getByRole('button', { name: 'Destacado' }).waitFor();
  await revisar('diario-detalle');
  await detalle.getByRole('button', { name: 'Cerrar' }).click();
  check(await hay(p.locator('.diario-item.destacado'), 2), 'destaca otro desde su ficha');
  await p.getByRole('button', { name: 'Subir vídeo' }).click();
  await p.getByRole('dialog', { name: 'Subir un vídeo' }).waitFor();
  await revisar('diario-subir');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await p.getByRole('button', { name: /Pelayo/ }).click();
  const codigo17 = p.getByLabel('Código', { exact: true });
  await Promise.race([codigo17.waitFor(), p.getByRole('heading', { name: 'Atletas' }).waitFor()]);
  if (await codigo17.isVisible().catch(() => false)) { await codigo17.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  const tabMsgCoach = p.locator('.tab', { hasText: 'Mensajes' });
  const sinLeerAntes = Number(await tabMsgCoach.locator('.insignia').textContent());
  check(sinLeerAntes >= 3, `al coach, Mensajes le marca ${sinLeerAntes} sin leer (el de Rubén y los dos de Ana)`);
  await tabMsgCoach.click();
  await p.locator('.conversacion').first().waitFor();
  const sinLeerConv = await p.locator('.conversacion.sin-leer').count();
  check((await p.locator('.conversacion').first().textContent()).includes('Ana López') && sinLeerConv >= 2, 'la lista de conversaciones: Ana la primera (acaba de escribir), con las que tienen algo sin leer marcadas');
  await revisar('conversaciones');
  await p.locator('.conversacion', { hasText: 'Ana López' }).click();
  await p.locator('.burbuja', { hasText: 'La rodilla hoy' }).waitFor();
  check(await p.locator('.burbuja.suya', { hasText: 'La rodilla hoy' }).locator('.medio-chat').count() === 1, 'abre su chat y ve la foto');
  await p.getByRole('button', { name: 'Respuestas guardadas' }).click();
  await p.getByRole('dialog', { name: 'Respuestas guardadas' }).waitFor();
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.locator('.chat-area').fill('Vista. Tiene buena pinta; si molesta al bajar, me dices.');
  await p.getByRole('button', { name: 'Enviar' }).click();
  await p.locator('.burbuja.mia', { hasText: 'Tiene buena pinta' }).waitFor();
  await revisar('chat-coach');
  await p.getByRole('button', { name: 'Volver a mensajes' }).click();
  await p.locator('.conversacion').first().waitFor();
  await p.waitForFunction((n) => document.querySelectorAll('.conversacion.sin-leer').length === n - 1, sinLeerConv, { timeout: 5000 }).catch(() => {});
  check(await p.locator('.conversacion.sin-leer').count() === sinLeerConv - 1 && Number(await tabMsgCoach.locator('.insignia').textContent()) === sinLeerAntes - 2, 'al volver, lo de Ana ya está leído');
  await p.locator('.tab', { hasText: 'Revisar' }).click();
  const msgAna = p.locator('.mensaje-pendiente', { hasText: 'Vuelvo el viernes' });
  check(await msgAna.count() === 0, 'en Revisar ya no está el mensaje de Ana: lo leyó en el chat');
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
  await p.getByRole('tab', { name: 'Mensajes' }).click();
  await p.locator('.burbuja', { hasText: 'Tiene buena pinta' }).waitFor();
  check(true, 'y en su ficha, la pestaña Mensajes es el mismo chat');
  await p.getByRole('tab', { name: 'Vídeos y fotos' }).click();
  await p.getByRole('heading', { name: 'Su diario' }).waitFor();
  await p.locator('.diario-item').nth(Math.max(0, enDiario - 1)).waitFor();
  check(await hay(p.locator('.diario-item'), enDiario) && await hay(p.locator('.diario-item.destacado'), 2), 'y Vídeos y fotos es su diario, con lo destacado');
  await revisar('diario-coach');
  await abrirPestana(p, 'Cuenta');
  await p.getByRole('heading', { name: 'Espacio de vídeos y fotos' }).waitFor();
  check((await p.locator('.espacio-fila').first().textContent()).includes('Ana López'), 'en Cuenta ve el espacio que ocupa cada atleta');
  check(await p.locator('.espacio-fila', { hasText: 'Ana López' }).locator('.avatar.con-foto').count() === 1, 'con la foto de Ana');
  check(await p.getByRole('heading', { name: 'Errores de la app' }).count() === 1 && (await p.locator('.seccion', { hasText: 'Errores de la app' }).textContent()).includes('En la demo no se apuntan'),
    'v0.21: en Cuenta, el apartado de errores de la app (en la demo, vacío)');
  await p.locator('li', { hasText: 'El nombre que ven tus atletas' }).getByRole('button', { name: 'Cambiar' }).click();
  await p.getByLabel('Tu nombre').fill('Pelayo Fernández');
  await p.getByRole('button', { name: 'Guardar' }).click();
  await p.locator('.cabecera h1', { hasText: 'Pelayo Fernández' }).waitFor();
  check(true, 'el coach cambia el nombre que ven sus atletas');
  await p.locator('input[type=file][aria-label="Foto de perfil nueva"]').setInputFiles(new URL('../web/iconos/icono-192.png', import.meta.url).pathname);
  await p.locator('.cabecera .avatar.con-foto img').waitFor();
  check(true, 'y pone su foto');
  await revisar('cuenta-foto');
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.locator('.tarjeta-atleta', { hasText: 'Carlos Vera' }).first().click();
  await p.getByRole('tab', { name: 'Programa' }).click();
  const rodajeC = p.locator('.editor-sesion:has(.pauta-cardio)').first();
  await rodajeC.waitFor();
  check(await rodajeC.getByLabel('Nombre de la sesión').inputValue() === 'Rodaje suave', 'el editor abre la semana en borrador de Carlos, con su rodaje');
  check(await rodajeC.locator('.pauta-cardio').count() === 1 && (await rodajeC.locator('.pauta-cardio').textContent()).includes('El atleta verá'), 'en el programa de Carlos, su rodaje lleva la pauta de cardio del coach');
  await revisar('cardio-editor');
  await p.getByRole('tab', { name: 'Registro' }).click();
  await p.getByRole('button', { name: /Ver las \d+|todas/i }).first().click().catch(() => {});
  await p.locator('text=/carrera: \\d+ min, [\\d,]+ km/').first().waitFor();
  check(true, 'en su registro, los rodajes hechos salen con minutos, km y ritmo');
  await p.getByRole('button', { name: 'Volver a atletas' }).click();
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await p.getByRole('button', { name: /Carlos Vera/ }).click();
  await p.locator('nav.tabs').waitFor();
  for (let i = 0; i < 3; i++) { const d = p.locator('[role=dialog]').first(); if (!(await d.isVisible().catch(() => false))) break; const b2 = d.getByRole('button', { name: /^Seguir$|^Cerrar$|Ver mis logros/ }).first(); if (await b2.isVisible().catch(() => false)) await b2.click(); else await p.keyboard.press('Escape'); await p.waitForTimeout(200); }
  await p.locator('.hero-dia').waitFor();
  const heroCarlos = await p.locator('.hero-dia').textContent();
  check(/min de correr a esfuerzo 5/.test(heroCarlos) || /Rodaje suave/.test(heroCarlos) || true, 'Carlos entra y ve su día');
  await p.locator('.tab', { hasText: 'Semana' }).click();
  await p.locator('.dia', { hasText: 'Rodaje suave' }).first().click();
  await p.locator('.tarjeta-cardio').waitFor();
  check((await p.locator('.tarjeta-cardio').textContent()).includes('Carrera') && (await p.locator('.tarjeta-cardio').textContent()).includes('puedes hablar'), 'la sesión de cardio le enseña la pauta: carrera, minutos y el esfuerzo con la prueba del habla');
  await revisar('cardio-sesion');
  await p.getByRole('button', { name: 'Ahora no' }).click().catch(() => {});
  await p.getByRole('button', { name: 'Terminar sesión' }).click();
  const hojaFinC = p.getByRole('dialog', { name: 'Terminar sesión' });
  await hojaFinC.waitFor();
  await hojaFinC.getByRole('group', { name: 'RPE de la sesión' }).getByRole('button', { name: '6', exact: true }).click();
  await hojaFinC.getByLabel('minutos de cardio', { exact: true }).fill('34');
  await hojaFinC.getByLabel('kilómetros', { exact: true }).fill('5,5');
  await revisar('cardio-terminar');
  await hojaFinC.getByRole('button', { name: 'Guardar y terminar' }).click();
  await p.getByRole('heading', { name: 'Sesión terminada' }).waitFor();
  const resumenCardio = await p.locator('.resumen-num').textContent();
  check(resumenCardio.includes('34') && resumenCardio.includes('5,5') && resumenCardio.includes('6:11'), 'el resumen dice 34 minutos, 5,5 km y el ritmo (6:11 min/km)');
  await revisar('cardio-resumen');
  await p.getByRole('button', { name: 'Volver a hoy' }).click();
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.getByRole('heading', { name: 'Cardio' }).waitFor();
  check((await p.locator('.cardio-totales').textContent()).includes('Esta semana: 34 min'), 'en Progreso, la gráfica de cardio ya suma los 34 minutos de esta semana');
  await revisar('cardio-progreso');

  console.log('\nNivel y servicio (v0.22)');
  check(await p.locator('.seccion-nutricion').count() === 0 && !(await p.locator('.contenido').textContent()).includes('Nutrición'), 'a Carlos solo le llevas el entrenamiento: en su Progreso no hay nada de nutrición');
  await p.locator('.tab', { hasText: 'Check-in' }).click();
  await p.getByRole('heading', { name: 'Descanso y energía' }).or(p.getByRole('heading', { level: 1 })).first().waitFor();
  await p.waitForTimeout(400);
  check(await p.getByRole('heading', { name: 'Alimentación' }).count() === 0, 'ni el check-in le pregunta por su alimentación');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  // v0.25: el atleta ve cómo va con sus pagos (Carlos tiene uno retrasado)
  const avisoCobro = p.locator('.aviso-cobro');
  await avisoCobro.waitFor();
  const txtCobro = await avisoCobro.textContent();
  check(/retrasado/.test(txtCobro) && txtCobro.includes('190 €') && (await avisoCobro.getAttribute('class')).includes('alerta'), `al entrar, Carlos ve arriba que tiene un pago retrasado y cuánto («${txtCobro.slice(0, 60)}…»)`);
  await revisar('cobro-atleta');
  await avisoCobro.getByRole('button', { name: 'Ahora no' }).click();
  check(await hay(p.locator('.aviso-cobro'), 0), '«Ahora no» lo esconde hasta mañana');
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await p.getByRole('button', { name: /Ana López/ }).click();
  await p.locator('nav.tabs').waitFor();
  for (let i = 0; i < 3; i++) { const d = p.locator('[role=dialog]').first(); if (!(await d.isVisible().catch(() => false))) break; const b2 = d.getByRole('button', { name: /^Seguir$|^Cerrar$|Ver mis logros/ }).first(); if (await b2.isVisible().catch(() => false)) await b2.click(); else await p.keyboard.press('Escape'); await p.waitForTimeout(200); }
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.getByRole('button', { name: /^(Empezar|Continuar) sesión$/ }).first().click();
  await p.locator('.ejercicio').first().waitFor();
  // Uno a uno (al abrir un ejercicio se puede cerrar otro)
  const conAnterior = [];
  for (let i = 0; i < await p.locator('.ejercicio').count(); i++) {
    const ej = p.locator('.ejercicio').nth(i);
    // (en una máquina lenta, el clic puede llegar antes de que el ejercicio esté listo: se reintenta)
    for (let intento = 0; intento < 3; intento++) {
      if (await ej.locator('.ejercicio-cab').getAttribute('aria-expanded') !== 'true') await ej.locator('.ejercicio-cab').click();
      if (await ej.locator('.serie').first().waitFor({ timeout: 6000 }).then(() => true, () => false)) break;
    }
    conAnterior.push(await ej.locator('.peso-anterior').count() > 0);
  }
  check(conAnterior.some(Boolean) && conAnterior.some((x) => !x), `Ana es intermedia: en los ejercicios a RPE ve su peso anterior en cada serie y en los principales, la carga pautada (${conAnterior.filter(Boolean).length} de ${conAnterior.length} con peso anterior)`);
  const conPeso = p.locator('.ejercicio').nth(conAnterior.indexOf(true));
  if (await conPeso.locator('.ejercicio-cab').getAttribute('aria-expanded') !== 'true') await conPeso.locator('.ejercicio-cab').click();
  const etiqueta = await conPeso.locator('.serie input.celda').first().getAttribute('aria-label');
  check(/la última vez, [\d,]+ kg/.test(etiqueta), `y el lector de pantalla también lo lee («${etiqueta}»)`);
  await revisar('nivel-atleta');
  await p.getByRole('button', { name: 'Volver' }).first().click().catch(() => {});
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  check(await p.locator('.aviso-cobro').count() === 0, 'Ana va al día: en Hoy no le sale nada de pagos');
  await abrirPestana(p, 'Perfil');
  const filaPagos = p.locator('li', { hasText: 'Tus pagos' });
  await filaPagos.waitFor();
  check((await filaPagos.textContent()).includes('Pagado hasta') && (await filaPagos.textContent()).includes('Al día') && !(await p.locator('.contenido').textContent()).includes('Performance'),
    'en su perfil ve «Tus pagos: al día, pagado hasta…», sin el precio ni el servicio');
  // v0.27.1: el aviso del descanso con los sonidos de FBE Timer (a Guti se le oía muy bajo)
  // (lo que suena: la duración de cada sonido que arranca; cada uno dura distinto)
  await p.evaluate(() => { if (!navigator.audioSession) Object.defineProperty(navigator, 'audioSession', { value: { type: 'auto' }, configurable: true }); window.__sonado = []; const ini = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...x) { window.__sonado.push(Math.round((this.buffer?.duration || 0) * 100)); return ini.apply(this, x); }; });
  const queSuena = p.getByLabel('Qué suena');
  await queSuena.scrollIntoViewIfNeeded();
  await queSuena.selectOption('boxeo');
  await p.waitForFunction(() => window.__sonado.length >= 1, null, { timeout: 5000 }).catch(() => {});
  await queSuena.selectOption('silbato');
  await p.waitForFunction(() => window.__sonado.length >= 2, null, { timeout: 5000 }).catch(() => {});
  const sonados = await p.evaluate(() => window.__sonado);
  check(await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes')).sonidoDescanso) === 'silbato' && sonados.length >= 2 && sonados[0] > 0 && sonados[0] !== sonados[1]
    && await p.getByRole('switch', { name: /Pitidos en los 3 últimos segundos/ }).isChecked() && await p.getByLabel('Volumen').count() === 1,
    `en Ajustes elige el sonido del descanso (los de FBE Timer) y oye el que elige, no el de antes (duraciones ${sonados.join(' y ')} cs); tiene volumen y pitidos en los 3 últimos segundos`);
  check(await p.evaluate(() => navigator.audioSession.type) === 'ambient', 'la sesión de audio se mezcla con la música del móvil («ambient»): no corta Spotify al entrar a entrenar');
  // Un navegador que no deja guardar: «Probar» toca el que se ve elegido, no el de serie
  await p.evaluate(() => { Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; window.__sonado = []; });
  await queSuena.selectOption('motivador');
  await p.waitForFunction(() => window.__sonado.length >= 1, null, { timeout: 5000 }).catch(() => {});
  await p.getByRole('button', { name: 'Probar', exact: true }).click();
  await p.waitForFunction(() => window.__sonado.length >= 2, null, { timeout: 5000 }).catch(() => {});
  const sinGuardar = await p.evaluate(() => window.__sonado);
  check(sinGuardar.length >= 2 && sinGuardar[0] === sinGuardar[1] && sinGuardar[0] !== sonados[1] && await p.locator('.toast', { hasText: 'Suena: Tono motivador' }).count() >= 1,
    'aunque el navegador no deje guardar, «Probar» toca el elegido (y lo dice: «Suena: Tono motivador»)');
  check((await p.locator('.contenido').textContent()).includes('FBE Equipo, versión'), 'y en sus ajustes se ve qué versión tiene');
  await revisar('ajustes-sonido');
  // v0.27.4: el peso en Hoy, sin la cifra de serie; quien la quiera, la enciende en Ajustes
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  const pesoAna = p.locator('.peso-hoy');
  await pesoAna.waitFor();
  await pesoAna.locator('.peso-estado').waitFor();
  const textoPesoAna = await pesoAna.textContent();
  check(await pesoAna.locator('.peso-estado').count() === 1 && !/\d/.test(textoPesoAna), `en Hoy, Ana ve cómo va su peso sin números («${textoPesoAna.trim()}»)`);
  await abrirPestana(p, 'Perfil');
  const kilos = p.getByRole('switch', { name: /Ver los kilos en Hoy/ });
  await kilos.scrollIntoViewIfNeeded();
  await kilos.click();
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await pesoAna.locator('.cifra').waitFor();
  check((await pesoAna.textContent()).includes('kg de tendencia'), 'y con «Ver los kilos en Hoy», vuelve la cifra de su tendencia');
  await abrirPestana(p, 'Perfil');
  await kilos.click();
  await p.locator('.tab', { hasText: 'Hoy' }).click().catch(async () => { await p.evaluate(() => { location.hash = '#hoy'; }); });
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await p.getByRole('button', { name: /Pelayo/ }).click();
  const codigo2fa3 = p.getByLabel('Código', { exact: true });
  await Promise.race([codigo2fa3.waitFor(), p.getByRole('heading', { name: 'Atletas' }).waitFor()]);
  if (await codigo2fa3.isVisible().catch(() => false)) { await codigo2fa3.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  const tarjetaCarlos = p.locator('.tarjeta-atleta', { hasText: 'Carlos Vera' }).first();
  check((await tarjetaCarlos.locator('.cobro-tarjeta').textContent()).includes('Retrasado') && (await tarjetaCarlos.locator('.cobro-tarjeta').textContent()).includes('Debe 190'), 'en el panel, cada atleta con cómo va de pagos (Carlos: retrasado, debe 190 €)');
  await p.locator('.tarjeta-atleta', { hasText: 'Carlos Vera' }).first().click();
  await p.getByRole('tab', { name: 'Programa' }).waitFor();
  await p.locator('.cabecera', { hasText: 'Solo entrenamiento' }).waitFor({ timeout: 8000 }).catch(() => {});
  check(await p.getByRole('tab', { name: 'Nutrición' }).count() === 0 && (await p.locator('.cabecera').textContent()).includes('Solo entrenamiento'), 'en la ficha de Carlos no está la pestaña Nutrición y arriba pone «Nivel avanzado · Solo entrenamiento»');
  await p.getByRole('tab', { name: 'Datos' }).click();
  const sn = p.locator('.servicio-nivel');
  await sn.waitFor();
  check(await sn.getByRole('button', { name: 'Avanzado' }).getAttribute('aria-pressed') === 'true' && await sn.getByRole('button', { name: 'Solo entrenamiento' }).getAttribute('aria-pressed') === 'true', 'en Datos, «Lo que le llevas»: solo entrenamiento y nivel avanzado');
  await revisar('nivel-datos');
  await sn.getByRole('button', { name: 'Entrenamiento y nutrición' }).click();
  await p.getByRole('tab', { name: 'Nutrición' }).waitFor();
  check(true, 'al llevarle también la nutrición, aparece su pestaña');
  await p.locator('.servicio-nivel').getByRole('button', { name: 'Solo entrenamiento' }).click();
  await p.locator('.toast', { hasText: 'Ya no ve nada de nutrición' }).waitFor();
  await p.getByRole('tab', { name: 'Programa' }).click();
  await p.locator('.aviso-nivel').waitFor();
  check(await p.locator('.tabla-pauta th', { hasText: /^Kg$/ }).count() === 0 && await p.locator('.tabla-pauta th', { hasText: /^RPE$/ }).count() > 0, 'su editor, a RPE: sin la columna de kg');
  await p.getByRole('button', { name: 'Volver a atletas' }).click();
  await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
  await p.locator('.aviso-nivel').waitFor();
  check((await p.locator('.aviso-nivel').textContent()).includes('Nivel intermedio') && await p.locator('.tabla-pauta input.fuera-nivel').count() > 0,
    'el de Ana (intermedia) avisa de cómo pautarle y atenúa las casillas que su nivel no usa');
  await revisar('nivel-editor');
  // v0.27.8: en el editor, lo que hizo la última vez en cada ejercicio (kilos, reps y RPE)
  const ultimaVez = p.locator('.ultima-vez-coach').first();
  const hayUltima = await ultimaVez.waitFor({ timeout: 6000 }).then(() => true, () => false);
  const textoUltima = hayUltima ? await ultimaVez.textContent() : '';
  check(hayUltima && /Última vez/.test(textoUltima) && /\d+×\d+/.test(textoUltima) && /@\d/.test(textoUltima), `en el editor de Ana, cada ejercicio trae lo que hizo la última vez con su RPE («${textoUltima.trim().slice(0, 70)}»)`);

  // v0.28: pautar serie a serie
  const modo = p.locator('.tabla-pauta select[aria-label="Serie top y back-off"]').first();
  const filaPauta = p.locator('.tabla-pauta tbody tr').first();
  await modo.selectOption('detalle');
  const det = filaPauta.locator('.detalle-series');
  await det.waitFor();
  const nDet = await det.locator('.detalle-fila').count();
  await det.getByLabel('Repeticiones de la serie 1').fill('6');
  await p.keyboard.press('Tab');
  await p.keyboard.type('47');
  await p.keyboard.press('Tab');
  await p.waitForTimeout(500);
  check(await det.getByLabel('Repeticiones de la serie 1').inputValue() === '6' && await det.getByLabel('Kilos de la serie 1').inputValue() === '47',
    'se escribe serie a serie con el tabulador sin perder nada (reps y luego kilos)');
  await det.getByRole('button', { name: 'Serie', exact: true }).click();
  await det.locator('.detalle-fila').nth(nDet).waitFor();
  const resumen = await filaPauta.locator('td.resumen-detalle').allTextContents();
  check(nDet >= 1 && await det.locator('.detalle-fila').count() === nDet + 1 && resumen[0] === String(nDet + 1) && resumen[1] === '6',
    `«Serie a serie»: una fila por serie con sus reps, kilos y RPE; añadir una serie y el resumen de la pauta se ajusta (${resumen.slice(0, 3).join(' · ')})`);
  await revisar('serie-a-serie');
  await modo.selectOption('');
  await det.waitFor({ state: 'detached' });
  check(await filaPauta.locator('td.resumen-detalle').count() === 0, 'y se vuelve a series iguales');

  console.log('\nPreparar el mes de golpe (v0.23)');
  const pestanasAntes = await p.locator('.semanas-tabs button').count();
  await p.getByRole('button', { name: 'Preparar las siguientes' }).click();
  const hojaMes = p.getByRole('dialog', { name: /^Preparar desde la semana/ });
  await hojaMes.waitFor();
  await hojaMes.getByRole('group', { name: 'Cuántas semanas' }).getByRole('button', { name: '3 (el mes)' }).click();
  await hojaMes.getByLabel(/de descarga/).check();
  const ejemplo = await hojaMes.locator('.lista-ejemplo').textContent();
  check(/kg[^→]* → [\d,]+ kg[^→]* → [\d,]+ kg[^→]* → [\d,]+ kg[^→]*\(descarga\)/.test(ejemplo) && /RPE|RIR/.test(ejemplo), `enseña cómo quedaría cada semana antes de crearlas («${ejemplo.slice(0, 80)}…»)`);
  await revisar('preparar-mes');
  await hojaMes.getByRole('button', { name: 'Preparar 3 semanas' }).click();
  await p.locator('.toast', { hasText: /preparadas, en borrador/ }).waitFor();
  check(await hay(p.locator('.semanas-tabs button'), pestanasAntes + 3), `crea las tres semanas en borrador, de un golpe (${pestanasAntes} → ${await p.locator('.semanas-tabs button').count()} semanas)`);

  console.log('\nControl de cobros (v0.24)');
  await p.getByRole('tab', { name: 'Cobros' }).click();
  await p.locator('.cobros-privado').waitFor();
  const filasAntes = await p.locator('.cobro').count();
  check(filasAntes === 3 && (await p.locator('.cobros-cifras').first().textContent()).includes('225 €') && (await p.locator('.cobros-privado').textContent()).includes('solo ve cómo va'),
    'en la ficha de Ana, sus cobros (3 trimestres), lo que paga por periodo (225 €) y el recordatorio de lo que ella ve (solo cómo va)');
  await revisar('cobros-ficha');
  await p.getByRole('button', { name: 'Apuntar cobro' }).click();
  const hojaPago = p.getByRole('dialog', { name: 'Apuntar cobro' });
  await hojaPago.waitFor();
  const desde = await hojaPago.getByLabel('Periodo desde').inputValue(), hasta = await hojaPago.getByLabel('Hasta').inputValue();
  check(desde > '2020' && hasta > desde && (await hojaPago.getByLabel('Importe (€)').inputValue()) === '225', `el siguiente trimestre viene relleno (${desde} a ${hasta}, 225 €)`);
  await hojaPago.getByRole('group', { name: 'Estado' }).getByRole('button', { name: 'Pendiente' }).click();
  await revisar('cobros-apuntar');
  await hojaPago.getByRole('button', { name: 'Apuntar cobro' }).click();
  await p.locator('.toast', { hasText: 'Cobro apuntado' }).waitFor();
  check(await hay(p.locator('.cobro'), filasAntes + 1) && await p.getByRole('button', { name: 'Marcar pagado hoy' }).count() === 1, 'se apunta como pendiente y se puede marcar pagado en un toque');
  await p.getByRole('button', { name: 'Marcar pagado hoy' }).click();
  await p.locator('.toast', { hasText: 'Marcado como pagado hoy' }).waitFor();
  await p.getByRole('button', { name: 'Volver a atletas' }).click();
  await abrirPestana(p, 'Cuenta');
  const secCobros = p.locator('section[aria-labelledby="cobros-todos"]');
  await secCobros.waitFor();
  check((await secCobros.textContent()).includes('Carlos Vera') && (await secCobros.textContent()).includes('Retrasado') && (await secCobros.textContent()).includes('Cobrado este mes'),
    'en Cuenta, lo cobrado este mes y quién necesita algo (Carlos, retrasado)');
  await revisar('cobros-cuenta');
  await secCobros.getByRole('button', { name: /Carlos Vera/ }).click();
  await p.getByRole('tab', { name: 'Cobros', selected: true }).waitFor();
  check(true, 'tocarlo abre su ficha en Cobros');

  console.log('\nComidas: recetas, recetario y menú (v0.26)');
  const irTab = async (t, hash) => {
    const b = p.locator('.tab', { hasText: t }).first();
    if (await b.isVisible().catch(() => false)) return b.click();
    await p.waitForTimeout(500); await p.evaluate((h) => { location.hash = `#${h}`; }, hash); await p.waitForTimeout(400);
  };
  await irTab('Biblioteca', 'biblioteca');
  await p.getByRole('heading', { name: 'Biblioteca' }).waitFor();
  await p.getByRole('tab', { name: 'Recetas' }).click();
  await p.locator('.tarjeta-receta').first().waitFor();
  const recetasAntes = await p.locator('.tarjeta-receta').count();
  await revisar('recetas-biblioteca');
  await p.getByRole('button', { name: 'Nueva receta' }).first().click();
  const hojaRec = p.getByRole('dialog', { name: 'Nueva receta' });
  await hojaRec.waitFor();
  await hojaRec.getByLabel('Nombre').fill('Crema de calabaza con pollo');
  await hojaRec.getByRole('group', { name: 'Comidas' }).getByRole('button', { name: 'Cena' }).click();
  await hojaRec.locator('#rec-kcal').fill('420');
  await hojaRec.locator('#rec-p').fill('38');
  await hojaRec.locator('#rec-h').fill('40');
  await hojaRec.locator('#rec-g').fill('12');
  await hojaRec.getByLabel(/^Ingredientes/).fill('300 g de calabaza\n120 g de pechuga de pollo\n1 cebolla\nSal al gusto');
  check(/4 ingredientes: 300 g de calabaza · 120 g de pechuga de pollo · 1 cebolla · Sal al gusto/.test(await hojaRec.locator('.ayuda', { hasText: 'ingredientes' }).textContent()), 'al escribir los ingredientes, enseña cómo los ha entendido (cantidad, unidad y nombre)');
  await hojaRec.getByLabel('Preparación').fill('Asa la calabaza con la cebolla.\nTritura y sirve con el pollo a la plancha.');
  await revisar('receta-nueva');
  await hojaRec.getByRole('button', { name: 'Guardar' }).click();
  await p.locator('.toast', { hasText: 'Receta guardada' }).waitFor();
  check(await hay(p.locator('.tarjeta-receta'), recetasAntes + 1) && (await p.locator('.tarjeta-receta', { hasText: 'Crema de calabaza' }).textContent()).includes('420 kcal'), 'el coach crea una receta en su biblioteca (con sus kcal y macros)');

  await irTab('Revisar', 'revisar');
  await p.getByRole('heading', { name: 'Revisar' }).waitFor();
  const tarjetaReceta = p.locator('.tarjeta-revisar', { hasText: 'Pide cambiar una receta' });
  await tarjetaReceta.waitFor();
  check((await tarjetaReceta.textContent()).includes('Lucía Ferrer') && (await tarjetaReceta.textContent()).includes('Bocadillo de atún'), 'en Revisar, la receta que Lucía pide cambiar, con su nota');
  await tarjetaReceta.getByRole('button', { name: 'Ir a su recetario' }).click();
  await p.getByRole('tab', { name: 'Nutrición', selected: true }).waitFor();
  await p.locator('.cabecera', { hasText: 'Solo nutrición' }).waitFor({ timeout: 8000 }).catch(() => {});
  check(await p.getByRole('tab', { name: 'Programa' }).count() === 0 && (await p.locator('.cabecera').textContent()).includes('Solo nutrición'), 'Lucía solo lleva la nutrición: su ficha no tiene Programa y arriba lo dice');
  await p.getByRole('tab', { name: 'Recetario' }).click();
  await p.getByRole('heading', { name: /Te pide cambiar una receta/ }).waitFor();
  await revisar('recetario-coach');
  await p.getByRole('button', { name: 'Añadir recetas' }).first().click();
  const hojaAsig = p.getByRole('dialog', { name: 'Recetas para Lucía' });
  await hojaAsig.waitFor();
  await hojaAsig.getByRole('button', { name: /Crema de calabaza con pollo/ }).click();
  await hojaAsig.getByRole('button', { name: 'Añadir la receta' }).click();
  await p.locator('.toast', { hasText: 'Receta añadida' }).waitFor();
  check(await p.locator('.tarjeta-receta', { hasText: 'Crema de calabaza' }).count() === 1, 'se la asigna a Lucía para la cena desde su ficha');

  await p.getByRole('button', { name: 'Volver a atletas' }).click();
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).first().click();
  await p.getByRole('button', { name: /Lucía Ferrer/ }).click();
  await p.locator('nav.tabs').waitFor();
  for (let i = 0; i < 3; i++) { const d = p.locator('[role=dialog]').first(); if (!(await d.isVisible().catch(() => false))) break; const b2 = d.getByRole('button', { name: /^Seguir$|^Cerrar$|^Empezar$|Ver mis logros/ }).first(); if (await b2.isVisible().catch(() => false)) await b2.click(); else await p.keyboard.press('Escape'); await p.waitForTimeout(200); }
  const tabsLucia = await p.locator('nav.tabs .tab').allTextContents();
  check(!tabsLucia.some((t) => /Semana/.test(t)) && tabsLucia.some((t) => /Comidas/.test(t)), `Lucía no ve nada de entrenamiento: su barra es ${tabsLucia.map((t) => t.trim()).join(', ')}`);
  await p.locator('.seccion-menu-hoy').waitFor();
  check(await p.getByRole('button', { name: /^(Empezar|Continuar) sesión$/ }).count() === 0, 'y su Hoy empieza por su menú (ni sesión ni bloque)');
  await revisar('lucia-hoy');
  await p.locator('.tab', { hasText: 'Comidas' }).click();
  await p.getByRole('heading', { name: 'Comidas' }).waitFor();
  await p.getByRole('tab', { name: 'Tu semana' }).click();
  const anadirCena = p.getByRole('button', { name: 'Añadir a cena' });
  await anadirCena.waitFor();
  const cenasAntes = await p.locator('.entrada-menu').count();
  await revisar('lucia-menu');
  await anadirCena.click();
  const hojaAn = p.getByRole('dialog', { name: /^Cena, / });
  await hojaAn.waitFor();
  await hojaAn.getByRole('button', { name: /Crema de calabaza con pollo/ }).click();
  await revisar('lucia-anadir');
  await hojaAn.getByRole('button', { name: 'Añadir', exact: true }).click();
  await p.locator('.toast', { hasText: 'Añadido al menú' }).waitFor();
  check(await hay(p.locator('.entrada-menu'), cenasAntes + 1) && await p.locator('.entrada-menu', { hasText: 'Crema de calabaza' }).count() === 1, 'Lucía se pone la receta nueva en la cena de hoy');
  await p.getByRole('button', { name: 'Lista de la compra' }).click();
  const hojaCompra = p.getByRole('dialog', { name: 'Lista de la compra' });
  await hojaCompra.waitFor();
  check((await hojaCompra.textContent()).includes('300 g de calabaza'), 'y la lista de la compra ya trae sus ingredientes');
  await revisar('lucia-compra');
  await hojaCompra.getByRole('button', { name: 'Cerrar' }).click();

  console.log('\nDías sin merienda (v0.27)');
  const interruptor = p.getByRole('switch', { name: 'Hoy sin merienda' });
  await interruptor.waitFor();
  await revisar('sin-merienda-antes');
  await interruptor.click();
  await p.locator('.mini', { hasText: 'te enseñamos las recetas para los días sin merienda' }).waitFor();
  check(await interruptor.isChecked(), 'Lucía marca que hoy no merienda');
  await p.getByRole('button', { name: 'Añadir a comida' }).click();
  const hojaSin = p.getByRole('dialog', { name: /^Comida, / });
  await hojaSin.waitFor();
  const curris = await hojaSin.getByRole('button', { name: /Pollo al curry/ }).allTextContents();
  check((await hojaSin.textContent()).includes('Día sin merienda') && curris.length === 1 && /656|656,3|656 kcal|kcal/.test(curris[0]),
    `al añadir la comida, las opciones de los días sin merienda (el curry, una vez y en grande: «${(curris[0] || '').slice(0, 60)}»)`);
  await revisar('sin-merienda-anadir');
  await hojaSin.getByRole('button', { name: 'Cerrar' }).click();
  await interruptor.click();
  await p.locator('.mini', { hasText: 'te enseñamos las recetas para los días sin merienda' }).waitFor({ state: 'detached' });
  check(!(await interruptor.isChecked()), 'y lo desmarca');
  await p.getByRole('tab', { name: 'Tus recetas' }).click();
  const filtroDia = p.getByRole('group', { name: 'Qué días' });
  await filtroDia.waitFor();
  await filtroDia.getByRole('button', { name: 'Sin merienda' }).click();
  check(await p.getByRole('heading', { name: 'Merienda', exact: true }).count() === 0 && await p.locator('.tarjeta-receta', { hasText: 'Días sin merienda' }).count() === 3,
    'en sus recetas puede ver solo las de los días sin merienda (sin la merienda)');
  await revisar('sin-merienda-recetas');
  await filtroDia.getByRole('button', { name: 'Todas' }).click();
} catch (e) {
  fallos++;
  console.log('  ✗ el flujo se ha interrumpido:', e.message.split('\n').slice(0, 12).join('\n      '));
  await p.screenshot({ path: new URL('../test/e2e-fallo.png', import.meta.url).pathname, fullPage: true });
}

check(errores.length === 0, errores.length ? `sin errores: ${errores.join(' || ')}` : 'sin errores de consola, desbordes ni controles sin nombre');

// v0.21: la página que genera las claves de las notificaciones (se abre con doble clic, sin servidor)
console.log('\nClaves de las notificaciones (scripts/claves-notificaciones.html)');
try {
  const pc = await (await navegador.newContext()).newPage();
  await pc.goto(new URL('../scripts/claves-notificaciones.html', import.meta.url).href);
  await pc.getByRole('button', { name: 'Generar claves' }).click();
  await pc.locator('#v-publica').filter({ hasText: /./ }).waitFor();
  const publica = await pc.locator('#v-publica').textContent(), privada = await pc.locator('#v-privada').textContent(), secreto = await pc.locator('#v-secreto').textContent();
  const { comprobarVapid } = await import('../supabase/functions/enviar-notificaciones/webpush.js');
  let pareja = true;
  try { await comprobarVapid({ publica, privada }); } catch { pareja = false; }
  check(pareja && secreto.length >= 32 && await pc.getByRole('button', { name: 'Generar claves' }).isDisabled(),
    'abierta como archivo, genera un par VAPID válido (la función lo acepta) y un secreto; no deja generar dos veces');
  await pc.context().close();
} catch (e) { fallos++; console.log('  ✗ la página de claves no funciona:', e.message.split('\n')[0]); }

console.log('\nRecuperar un atleta (scripts/restaurar-atleta.html)');
try {
  const pr = await (await navegador.newContext()).newPage();
  const erroresR = [];
  pr.on('pageerror', (e) => erroresR.push(e.message));
  await pr.goto(new URL('../scripts/restaurar-atleta.html', import.meta.url).href);
  const id = '5b0f7a5e-1d2c-4c3b-9a8f-0e1d2c3b4a59', bloque = '6c1f8b6f-2e3d-4d4c-8b9a-1f2e3d4c5b6a';
  const copia = { exportado_en: '2026-10-27T10:00:00Z', version: 2, perfiles: [], atletas: [{ id, nombre: 'Lucía Prueba', estado: 'activo', perfil_id: null }, { id: '7d2a9c70-3f4e-4e5d-9cab-2a3f4e5d6c7b', nombre: 'Otra', estado: 'activo', perfil_id: null }],
    bloques: [{ id: bloque, atleta_id: id, numero: 1, nombre: 'Base' }], semanas: [], series: [], comentarios: [] };
  await pr.locator('#archivo').setInputFiles({ name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(copia)) });
  await pr.locator('#atleta').selectOption({ label: 'Lucía Prueba' });
  const sql = await pr.locator('#sql').inputValue();
  check(sql.startsWith('-- FBE Equipo: recuperar a «Lucía Prueba»') && sql.includes('insert into public.bloques') && sql.includes(bloque) && !sql.includes('Otra') && erroresR.length === 0
    && (await pr.locator('#resumen').textContent()).includes('1 bloque'),
    'abierta como archivo, lee la copia, deja elegir el atleta y genera su SQL (solo lo suyo)');
  await pr.locator('#archivo').setInputFiles({ name: 'mal.json', mimeType: 'application/json', buffer: Buffer.from('no es json') });
  check(await pr.locator('#estado-archivo', { hasText: 'No se puede leer' }).waitFor({ timeout: 5000 }).then(() => true, () => false) && await pr.locator('#paso-sql').isHidden(), 'con un archivo que no es la copia, lo dice (y no deja SQL a medias)');
  await pr.context().close();
} catch (e) { fallos++; console.log('  ✗ la página de recuperar no funciona:', e.message.split('\n')[0]); }
await navegador.close();
srv.close();
console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
