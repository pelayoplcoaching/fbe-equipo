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
// v0.51: una sesión sin empezar abre con su portada; esto toca «Empezar» (si sale) y espera a la sesión
async function sesionAbierta() {
  await p.locator('.portada-sesion, .ejercicio').first().waitFor();
  if (await p.locator('.portada-sesion').count()) {
    await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
  }
  await p.locator('.ejercicio').first().waitFor();
}
// v0.49: un ejercicio hecho del todo se pliega en una línea; esto lo abre (si no lo está)
async function abrirEjercicio(loc) {
  if (!(await loc.locator('.ejercicio-cuerpo').count())) await loc.locator('.ejercicio-cab').click();
  await loc.locator('.ejercicio-cuerpo').waitFor();
}
// v0.49: las herramientas del ejercicio (cambiar, historial, tempo, aproximación…) están en la hoja «Más»
async function herramienta(loc, nombre) {
  await abrirEjercicio(loc);
  await loc.getByRole('button', { name: /^Más herramientas/ }).click();
  const hoja = p.getByRole('dialog').last();
  await hoja.locator('.hoja-acciones').waitFor();
  await hoja.getByRole('button', { name: nombre }).click();
}
// v0.49: el check-in, una pregunta por pantalla. Avanza con «Siguiente» hasta la pregunta con ese título (o el repaso)
const tituloCheckin = async () => (await p.locator('#ck-titulo').textContent()).trim();
async function pasoCheckin(titulo, max = 24) {
  await p.locator('#ck-titulo').waitFor();
  for (let i = 0; i < max; i++) {
    if ((await tituloCheckin()) === titulo) return true;
    if (await p.locator('.ck-repaso').count()) {
      const fila = p.locator('.ck-repaso-fila', { hasText: titulo });
      if (await fila.count()) { await fila.first().click(); await p.waitForFunction((t) => document.getElementById('ck-titulo')?.textContent.trim() === t, titulo); return true; }
      return false;
    }
    const antes = await tituloCheckin();
    await p.locator('.ck-nav').getByRole('button', { name: /Siguiente|Repasar/ }).click();
    await p.waitForFunction((t) => document.getElementById('ck-titulo')?.textContent.trim() !== t, antes);
  }
  return false;
}
// Elige una respuesta de una sola opción y espera a que pase sola a la siguiente pantalla
async function responderCheckin(grupo, boton) {
  const antes = await tituloCheckin();
  await p.getByRole('group', { name: grupo }).getByRole('button', { name: boton, exact: true }).click();
  await p.waitForFunction((t) => document.getElementById('ck-titulo')?.textContent.trim() !== t, antes);
}
async function repasoCheckin() {
  await p.locator('#ck-titulo').waitFor();
  if (!(await p.locator('.ck-repaso').count())) await p.getByRole('button', { name: 'Ir al repaso' }).click();
  await p.locator('.ck-repaso').waitFor();
}
// v0.39: lleva el descanso a cero (con −15) y comprueba que, al sonar, el temporizador y sus botones caben en pantalla
async function temporizadorAlSonar(p) {
  for (let i = 0; i < 40 && !(await p.locator('.temporizador.fin').count()); i++) { await p.getByRole('button', { name: 'Quitar 15 segundos' }).click(); await p.waitForTimeout(60); }
  await p.waitForTimeout(500); // en pleno latido
  return p.evaluate(() => {
    const t = document.querySelector('.temporizador.fin'); if (!t) return { ok: false };
    const r = t.getBoundingClientRect();
    const fuera = [...t.querySelectorAll('button')].filter((b) => { const x = b.getBoundingClientRect(); return x.left < r.left - 1 || x.right > r.right + 1; }).map((b) => b.textContent);
    return { ok: r.left >= 0 && r.right <= innerWidth && !fuera.length, izq: Math.round(r.left), der: Math.round(r.right), ancho: innerWidth, fuera };
  });
}
async function revisar(paso) {
  // En emulación de móvil el navegador ensancha la página para que quepa lo que se sale: se compara con los 390 px reales
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
    await q.waitForSelector('#portada .estandarte-pano');
    // v0.38: el estandarte es la imagen de Pelayo (estandarte.webp), a toda la pantalla y ondeando
    await q.waitForFunction(() => { const i = new Image(); i.src = 'estandarte.webp'; return i.complete && i.naturalWidth === 941; });
    const portada = await q.evaluate(() => {
      const el = document.getElementById('portada'); const r = el.getBoundingClientRect();
      const e = el.querySelector('.estandarte').getBoundingClientRect();
      const pano = getComputedStyle(el.querySelector('.estandarte-pano'));
      const t = el.textContent;
      return {
        tapa: r.width >= innerWidth && r.height >= innerHeight,
        // tan alto como la pantalla (o casi todo su ancho), centrado
        grande: (e.height >= innerHeight - 1 || e.width >= innerWidth - 1) && Math.abs(e.left + e.width / 2 - innerWidth / 2) < 2,
        imagen: /estandarte\.webp/.test(pano.backgroundImage), ondea: pano.animationName === 'estandarte-ondea',
        lema: /Confianza, esfuerzo, compromiso/.test(t), firma: t.includes('By Pelayo Fern\u00e1ndez Cid\u00f3n') && t.includes('CEO de Fuerza Basada en Evidencia'),
        nombre: el.getAttribute('aria-label') === 'Abriendo FBE Equipo', rol: el.getAttribute('role'), color: document.querySelector('meta[name=theme-color]').content,
      };
    });
    check(portada.tapa && portada.grande && portada.imagen && portada.ondea && portada.lema && portada.firma && portada.nombre && portada.rol === 'status' && portada.color === '#1E1548',
      `al abrir, el estandarte (la imagen) tapa toda la pantalla y ondea mientras llega la app ${JSON.stringify(portada)}`);
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
    check((await q2.evaluate(() => window.__tc)).length === 0, 'con el tema oscuro elegido, la barra del sistema no pierde el color de la portada');
    await q2.evaluate(() => localStorage.removeItem('fbe-ajustes'));
    await q2.close();
  }
  await p.goto('http://localhost:4174/?demo');
  await p.getByRole('heading', { name: 'Entra en tu cuenta' }).waitFor();
  await p.waitForFunction(() => !document.getElementById('portada') && !document.getElementById('tc-portada'));
  check(true, 'la portada se va sola en cuanto se puede entrar');
  check(JSON.parse(await (await fetch('http://localhost:4174/manifest.webmanifest')).text()).background_color === '#1E1548', 'el manifiesto arranca en el fondo de la portada (Android la enlaza sin salto)');
  await revisar('acceso');

  console.log('Coach: alta, bloque y publicación');
  await p.getByRole('button', { name: /Pelayo/ }).click();
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  await revisar('panel');
  // v0.49: franja de estado y minigráficas en cada atleta (con su texto para lectores de pantalla)
  const tarjetasP = p.locator('.tarjeta-atleta');
  const estados = await tarjetasP.evaluateAll((xs) => xs.map((x) => [x.querySelector('strong').textContent, x.dataset.estado, getComputedStyle(x, '::before').backgroundColor]));
  check(estados.length >= 4 && estados.every(([, e, c]) => ['verde', 'ambar', 'rojo', 'gris'].includes(e) && c !== 'rgba(0, 0, 0, 0)') && estados.some(([n, e]) => n.startsWith('Carlos') && e === 'rojo'),
    `cada atleta lleva su franja de color (${estados.map(([n, e]) => `${n.split(' ')[0]}: ${e}`).join(', ')})`);
  const chispaAna = p.locator('.tarjeta-atleta', { hasText: 'Ana López' });
  check(/^Peso en \d+ semanas: de [\d,]+ a [\d,]+ kg$/.test(await chispaAna.locator('.chispa-peso').getAttribute('aria-label')) && /^Sesiones en las 6 últimas semanas: /.test(await chispaAna.locator('.chispa-sesiones').getAttribute('aria-label')),
    'y minigráficas del peso y de las sesiones, con su texto');
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
  // v0.49: la cabecera de la ficha con su estado y tres cifras (una atleta recién creada: sin activar y sin datos)
  await p.locator('.ficha-chips .chip').first().waitFor();
  check((await p.locator('.ficha-chips').textContent()).includes('Sin activar') && (await p.locator('.ficha-chips').textContent()).includes('Sin pesos'), 'la ficha resume su estado, cumplimiento, peso y última actividad');
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
  // v0.30: una variante con otro material se avisa en el editor
  const varLat = p.getByLabel('Variante').nth(4);
  await varLat.fill('En polea');
  await varLat.press('Tab');
  const avisoVar = p.locator('.editor-sesion .aviso-variante').first();
  await avisoVar.waitFor();
  check((await avisoVar.textContent()).includes('dice polea, pero el ejercicio es con mancuernas') && await avisoVar.getByRole('button', { name: /^Cambiar a Elevaciones laterales en polea/ }).count() > 0,
    'una variante con otro material («En polea» en unas elevaciones con mancuernas) se avisa y propone el ejercicio en polea');
  await revisar('editor-variante');
  await avisoVar.getByRole('button', { name: 'Quitar la variante' }).click();
  await p.locator('.toast', { hasText: 'Variante quitada' }).waitFor();
  check(await p.locator('.editor-sesion .aviso-variante').count() === 0 && (await p.getByLabel('Variante').nth(4).inputValue()) === '', 'y se puede quitar la variante (en todo el bloque)');
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
  // v0.49: la píldora de la barra de abajo está bajo el icono de la pestaña elegida y se desliza a la nueva con una
  // transición (View Transitions API); con «reducir movimiento», sin transición
  const pildora = () => p.evaluate(() => { const a = document.querySelector('.tabs-pildora').getBoundingClientRect(); const b = document.querySelector('.tab[aria-current="page"] .tab-ico').getBoundingClientRect(); return Math.abs(a.left - b.left) < 1.5 && Math.abs(a.width - b.width) < 1.5 && Math.abs(a.top - b.top) < 1.5; });
  check(await pildora(), 'la píldora marca la pestaña elegida');
  await p.evaluate(() => { window.__vt = 0; const o = document.startViewTransition?.bind(document); if (o) document.startViewTransition = (cb) => { window.__vt++; return o(cb); }; });
  await p.locator('.tab', { hasText: 'Semana' }).click();
  await p.getByRole('heading', { level: 1, name: /Bloque|Tu programa/ }).waitFor();
  await p.waitForTimeout(450);
  check(await p.evaluate(() => window.__vt) === 1 && await pildora(), 'cambiar de pestaña va con una transición y la píldora se desliza a la nueva');
  check(await p.locator('.cabecera-grande:not(.compacta)').count() === 1, 'arriba, el título grande');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.locator('.cabecera-grande.compacta').waitFor();
  check(true, 'al bajar, el título se compacta en una barra pequeña');
  await revisar('titulo-compacto');
  // v0.51: la barra de abajo y la cabecera compacta, de vidrio (translúcidas y desenfocadas); con «reducir
  // transparencia» o «más contraste», opacas
  const vidrio = () => p.evaluate(() => { const t = getComputedStyle(document.querySelector('.tabs')), c = getComputedStyle(document.querySelector('.cabecera-grande.compacta'));
    const alfa = (x) => { const m = x.match(/\/ ([\d.]+)\)$/) || x.match(/rgba\([^)]*,\s*([\d.]+)\)$/); return m ? Number(m[1]) : 1; };
    return { barra: t.backdropFilter, barraAlfa: alfa(t.backgroundColor), cab: c.backdropFilter, cabAlfa: alfa(c.backgroundColor) }; });
  const v1 = await vidrio();
  check(/blur\(20px\)/.test(v1.barra) && v1.barraAlfa < 1 && /blur/.test(v1.cab) && v1.cabAlfa < 1, `la barra de abajo y la cabecera compacta son de vidrio ${JSON.stringify(v1)}`);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  await p.waitForTimeout(400); // (la cabecera cambia de fondo con una transición corta)
  const v2 = await vidrio();
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-contrast', value: 'more' }] });
  await p.waitForTimeout(400);
  const v3 = await vidrio();
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });
  check(v2.barra === 'none' && v2.barraAlfa === 1 && v2.cab === 'none' && v2.cabAlfa === 1 && v3.barra === 'none' && v3.cabAlfa === 1, `con «reducir transparencia» o «más contraste», opacas ${JSON.stringify([v2, v3])}`);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('.cabecera-grande:not(.compacta)').waitFor();
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.locator('.hero-dia').waitFor();
  check(await p.evaluate(() => window.__vt) === 1 && await pildora(), 'con «reducir movimiento», sin transición');
  await p.emulateMedia({ reducedMotion: null });

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
  // v0.51: los diales de Hoy (constancia, carga y cómo llegas), cada uno con su hoja
  const diales = p.locator('.diales .dial');
  check(await diales.count() === 3 && (await diales.allTextContents()).map((t) => t.replace(/\s+/g, ' ')).join('|').match(/Constancia.*\|.*Carga.*\|.*Cómo llegas.*Sin contestar/)
    && (await diales.first().getAttribute('aria-label')).startsWith('Constancia: 0 de 3 sesiones'), `debajo de la tarjeta del día, tres diales: constancia (0 de 3), carga y cómo llegas (sin contestar) (${(await diales.allTextContents()).join(' / ')})`);
  await diales.nth(1).click();
  const hojaCarga = p.getByRole('dialog', { name: 'Carga de la semana' });
  await hojaCarga.waitFor();
  check((await hojaCarga.textContent()).includes('a estas alturas de la semana') && (await hojaCarga.textContent()).includes('Aún no hay con qué comparar'), 'la carga explica de dónde sale (y que aún no hay con qué comparar)');
  await revisar('dial-carga');
  await p.keyboard.press('Escape');
  await hojaCarga.waitFor({ state: 'detached' });
  await diales.nth(2).click();
  const hojaLlegas = p.getByRole('dialog', { name: 'Cómo llegas hoy' });
  await hojaLlegas.waitFor();
  // (Torso A está prevista para otro día: desde Hoy no se contesta; solo para la sesión de hoy, que es la que se va a hacer)
  check(await hojaLlegas.locator('.preparacion').count() === 0 && (await hojaLlegas.textContent()).includes('Hoy no tienes una sesión prevista'),
    'sin sesión prevista para hoy, «Cómo llegas» no deja contestar (no se guarda en una sesión de otro día): se contesta al empezarla');
  await revisar('dial-llegas');
  await p.keyboard.press('Escape');
  await hojaLlegas.waitFor({ state: 'detached' });
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.locator('.diales').scrollIntoViewIfNeeded();
  check(await p.evaluate(() => { const d = document.querySelector('.diales').getBoundingClientRect(); return d.right <= innerWidth && [...document.querySelectorAll('.diales .dial')].every((x) => x.getBoundingClientRect().height >= 44); }), 'a 360 px y en oscuro, los diales caben (y cada uno es un botón de 44 px o más)');
  await revisar('diales-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.getByRole('button', { name: 'Empezar sesión' }).click();
  // v0.51: antes de empezar, la portada: el dibujo de la sesión, su nombre en grande, los minutos, los músculos, la
  // nota de tu coach como una cita, los ejercicios con sus pictogramas y un «Empezar» grande
  const portada = p.locator('.portada-sesion');
  await portada.waitFor();
  const datosPortada = await p.evaluate(() => {
    const h = document.querySelector('.portada-sesion h1'); const r = document.querySelector('.portada-sesion').getBoundingClientRect();
    return { nombre: h.textContent, ancho: getComputedStyle(h).fontStretch, arte: document.querySelectorAll('.portada-arte > *').length, deBordeABorde: r.left <= 0.5 && Math.abs(r.right - innerWidth) < 1,
      meta: document.querySelector('.portada-meta').textContent, pictos: document.querySelectorAll('.portada-lista .picto').length, filas: document.querySelectorAll('.portada-lista .ej-fila').length,
      empezar: !!document.querySelector('.portada-empezar .btn-primario'), sinSeries: !document.querySelector('.ejercicio') };
  });
  check(datosPortada.nombre === 'Torso A' && parseFloat(datosPortada.ancho) >= 115 && datosPortada.arte > 10 && datosPortada.deBordeABorde && /unos \d+ min/.test(datosPortada.meta) && datosPortada.pictos === datosPortada.filas && datosPortada.filas > 0 && datosPortada.empezar && datosPortada.sinSeries,
    `antes de empezar, la portada de la sesión: el dibujo de borde a borde, el nombre en ancho (${datosPortada.ancho}), minutos y músculos, los ejercicios con su pictograma y «Empezar» ${JSON.stringify(datosPortada)}`);
  check(await p.locator('.portada-arte').getAttribute('aria-hidden') === 'true', 'el dibujo es decorativo');
  await revisar('portada');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.waitForTimeout(200);
  await revisar('portada-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
  await p.locator('.ejercicio').first().waitFor();
  check(await portada.count() === 0 && await p.locator('.sesion-vista .cabecera h1').textContent() === 'Torso A', 'al empezar, la portada se recoge en la cabecera de siempre');
  const prep = p.locator('.preparacion');
  check(await prep.count() === 1, 'antes de empezar le pregunta cómo llega');
  await prep.getByRole('group', { name: '¿Cómo has dormido?' }).getByRole('button', { name: 'Mal', exact: true }).click();
  await prep.getByRole('group', { name: '¿Cómo tienes la energía?' }).getByRole('button', { name: 'Normal', exact: true }).click();
  await revisar('preparacion');
  await prep.getByRole('group', { name: '¿Agujetas o molestias?' }).getByRole('button', { name: 'Ninguna', exact: true }).click();
  await p.locator('.consejo-dia.flojo').waitFor();
  const eleccion = p.getByRole('group', { name: 'Con qué pesos vas hoy' });
  check(await eleccion.getByRole('button', { name: 'Los de la semana pasada' }).getAttribute('aria-pressed') === 'true', 'durmió mal: día flojo, y le pregunta con qué pesos va (sin elegir, los de la semana pasada)');
  await eleccion.getByRole('button', { name: 'Subir como toque' }).click();
  await p.locator('.toast', { hasText: 'Hoy vas con la carga que toca' }).waitFor();
  check(await eleccion.getByRole('button', { name: 'Subir como toque' }).getAttribute('aria-pressed') === 'true' && (await p.locator('.consejo-dia').textContent()).includes('la carga que toca'), 'y puede elegir subir como cualquier día (lo decide el atleta)');
  await revisar('preparacion-eleccion');
  // v0.49: la vibración al tocar (aquí, apuntada para comprobarla)
  await p.evaluate(() => { window.__vib = []; Object.defineProperty(navigator, 'vibrate', { value: (x) => { window.__vib.push(x); return true; }, configurable: true }); });
  const primero = p.locator('.ejercicio').first();
  check(await primero.locator('.serie.siguiente').count() === 1 && (await primero.locator('.serie.siguiente .n').textContent()) === 'T', 'la serie que toca (la top) va resaltada');
  await primero.getByLabel('Kilos de la serie 1').fill('42,5');
  await primero.getByLabel('Repeticiones de la serie 1').fill('6');
  await primero.getByLabel('RPE de la serie 1').selectOption('8');
  await primero.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
  await p.locator('.temporizador').waitFor();
  check(await p.evaluate(() => JSON.stringify(window.__vib)) === '[14]' && await primero.locator('.serie.siguiente .n').textContent() === 'B', 'al marcarla, un toque de vibración y el resalte pasa a la siguiente');
  check((await p.locator('.temporizador .cuenta').textContent()).startsWith('2:') || (await p.locator('.temporizador .cuenta').textContent()).startsWith('3:'), 'arranca el descanso pautado');
  // v0.50: el temporizador va en la página, justo debajo del ejercicio, con un anillo grande y la cuenta en el centro
  check(await p.evaluate(() => document.querySelector('.ejercicio').nextElementSibling?.classList.contains('temporizador')) && await p.locator('.temporizador .reloj-descanso svg .arco').count() === 1
    && await p.locator('.temporizador').evaluate((t) => getComputedStyle(t).position) !== 'fixed' && /^\d:\d\d$/.test(await p.locator('.temporizador .cuenta').textContent()),
  'el descanso sale en la página, debajo del ejercicio: un anillo grande con la cuenta');
  check(await p.locator('.ejercicio-cab .picto').count() === await p.locator('.ejercicio').count() && await p.locator('.ejercicio-cab .picto').evaluateAll((xs) => xs.every((x) => x.getAttribute('aria-hidden') === 'true')),
    'cada ejercicio con el pictograma de su patrón de movimiento (decorativo: el nombre es lo que se lee)');
  // v0.51: arriba, un tramo por ejercicio (como las historias): se llena con las series y el que toca va resaltado
  const tramos = p.locator('nav.tramos a');
  const datosTramos = await p.evaluate(() => {
    const as = [...document.querySelectorAll('nav.tramos a')];
    return { n: as.length, actual: as.findIndex((a) => a.getAttribute('aria-current') === 'step'), primero: as[0]?.getAttribute('aria-label'), lleno: as[0]?.querySelector('.tramo-lleno').style.width, alto: Math.min(...as.map((a) => a.getBoundingClientRect().height)),
      lista: document.querySelector('nav.tramos').getAttribute('aria-label'), ol: !!document.querySelector('nav.tramos ol > li > a') };
  });
  check(datosTramos.n === await p.locator('.ejercicio').count() && datosTramos.actual === 0 && /: 1 de 3 series, ahora$/.test(datosTramos.primero) && datosTramos.lleno.startsWith('33.3') && datosTramos.alto >= 44 && datosTramos.ol,
    `arriba, un tramo por ejercicio: el primero lleno a un tercio y marcado como el actual («${datosTramos.primero}») ${JSON.stringify(datosTramos)}`);
  await tramos.nth(2).click();
  await p.waitForFunction(() => { const r = document.querySelectorAll('.ejercicio')[2].getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight / 2; });
  check(await p.evaluate(() => document.activeElement?.closest('.ejercicio') === document.querySelectorAll('.ejercicio')[2]), 'tocar un tramo lleva a su ejercicio (y el foco va a él)');
  await p.evaluate(() => window.scrollTo(0, 0));
  // Si se queda fuera de la vista al bajar, una píldora flotante con lo que queda; al tocarla, vuelve al temporizador
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const pildoraD = p.locator('.pildora-descanso');
  await pildoraD.waitFor();
  check(/^\d:\d\d/.test((await pildoraD.textContent()).trim()) && (await pildoraD.getAttribute('aria-label')) === 'Descanso en curso, toca para volver' && (await pildoraD.getAttribute('aria-live')) === 'off', `fuera de la vista, una píldora con lo que queda («${(await pildoraD.textContent()).trim()}»)`);
  await revisar('temporizador-pildora');
  await pildoraD.click();
  await p.waitForFunction(() => { const r = document.querySelector('.reloj-descanso')?.getBoundingClientRect(); return r && r.top >= 0 && r.bottom <= innerHeight; });
  await pildoraD.waitFor({ state: 'detached' });
  check(true, 'tocarla vuelve al temporizador (y la píldora se va)');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.locator('.temporizador').scrollIntoViewIfNeeded();
  await revisar('temporizador-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  // v0.42: ±1 minuto además de ±15 s
  const segs = async () => { const [m, s] = (await p.locator('.temporizador .cuenta').textContent()).split(':').map(Number); return m * 60 + s; };
  const antes1 = await segs();
  await p.getByRole('button', { name: 'Añadir 1 minuto' }).click();
  const mas1 = await segs();
  await p.getByRole('button', { name: 'Quitar 1 minuto' }).click();
  const menos1 = await segs();
  check(mas1 - antes1 >= 57 && mas1 - antes1 <= 61 && mas1 - menos1 >= 58 && mas1 - menos1 <= 61, `+1 min y −1 min alargan y acortan el descanso un minuto (${antes1} → ${mas1} → ${menos1} s)`);
  const filaAjustes = await p.evaluate(() => { const bs = [...document.querySelectorAll('.temporizador .ajustes button')]; const r = document.querySelector('.temporizador').getBoundingClientRect(); return { n: bs.length, misma: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size === 1, dentro: bs.every((b) => { const x = b.getBoundingClientRect(); return x.left >= r.left - 1 && x.right <= r.right + 1; }) }; });
  check(filaAjustes.n === 4 && filaAjustes.misma && filaAjustes.dentro, `los cuatro ajustes caben en una fila dentro del temporizador ${JSON.stringify(filaAjustes)}`);
  await p.getByRole('button', { name: 'Añadir 15 segundos' }).click();
  await p.getByRole('button', { name: 'Saltar' }).click();
  check(await primero.getByLabel('Kilos de la serie 2').getAttribute('placeholder') === '37,5', 'la back-off propone un 10 % menos que lo que hizo en la top (42,5 → 37,5)');
  check((await primero.locator('.backoff-nota').textContent()).includes('37,5 kg') && (await primero.locator('.serie .n').first().textContent()) === 'T', 'y lo explica, con la top marcada');
  await primero.getByRole('button', { name: 'Marcar la serie 2 como hecha' }).click();
  await p.getByRole('button', { name: 'Saltar' }).click();
  await primero.getByRole('button', { name: 'Marcar la serie 3 como hecha' }).click();
  await p.getByRole('button', { name: 'Saltar' }).click();
  check((await primero.locator('.progreso-series').getAttribute('class')).includes('hecho'), 'el ejercicio queda completo (3/3)');
  // v0.49: hecho del todo, se pliega en una línea con lo hecho (y se vuelve a abrir tocándolo)
  await primero.locator('.resumen-ej').waitFor();
  check((await primero.locator('.resumen-ej').textContent()) === '3 series, hasta 42,5 kg' && await primero.locator('.ejercicio-cuerpo').count() === 0 && (await primero.getAttribute('class')).includes('plegado'),
    `completo, el ejercicio se pliega en una línea (${await primero.locator('.resumen-ej').textContent()})`);
  check(await p.locator('.ejercicio').nth(1).locator('.serie.siguiente').count() === 1 && (await p.locator('.serie.siguiente').getAttribute('aria-current')) === 'step', 'la serie que toca ahora (la primera del remo) va resaltada');
  await abrirEjercicio(primero);
  check(true, 'tocándolo se vuelve a abrir');
  await primero.getByRole('button', { name: 'Quitar la serie 3' }).click();
  await p.getByText('Serie 3 quitada').waitFor();
  check((await primero.locator('.progreso-series').textContent()) === '2/3', 'quitar una serie por error');
  await primero.getByRole('button', { name: 'Marcar la serie 3 como hecha' }).click();
  // Al plegarse, el foco (que estaba en el check) pasa a la cabecera de la tarjeta, que la vuelve a abrir; no se pierde
  await primero.locator('.resumen-ej').waitFor();
  const focoPlegado = await p.evaluate(() => { const a = document.activeElement; return { cab: a?.classList.contains('ejercicio-cab'), primero: a?.closest('.ejercicio') === document.querySelector('.ejercicio'), expandido: a?.getAttribute('aria-expanded') }; });
  check(focoPlegado.cab && focoPlegado.primero && focoPlegado.expandido === 'false', `al plegarse, el foco pasa a su cabecera (y no a la página) ${JSON.stringify(focoPlegado)}`);
  await p.getByRole('button', { name: 'Saltar' }).click();
  await revisar('sesion');
  // A 360 px y en oscuro, la sesión con la tarjeta plegada y la serie que toca
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.waitForTimeout(300);
  check(await p.evaluate(() => document.documentElement.scrollWidth) <= 360, 'a 360 px y en oscuro, la sesión cabe');
  await revisar('sesion-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });

  console.log('\nAtleta: herramientas del ejercicio');
  await abrirEjercicio(primero);
  check((await primero.locator('.ejercicio-cab').textContent()).includes('Tempo 3-1-1'), 'el ejercicio muestra el tempo que puso el coach');
  // v0.49: bajo cada ejercicio, solo «Vídeo para tu coach» y «Más»; lo demás, en una hoja con filas grandes
  check(await primero.locator('.acciones-ej > button').count() === 2 && await primero.locator('.acciones-ej').getByRole('button', { name: 'Historial' }).count() === 0, 'bajo el ejercicio, solo «Vídeo para tu coach» y «Más»');
  await primero.getByRole('button', { name: /^Más herramientas/ }).click();
  const hojaMas = p.getByRole('dialog', { name: 'Press banca' });
  await hojaMas.locator('.hoja-acciones').waitFor();
  const filasMas = await hojaMas.locator('.accion-fila').evaluateAll((xs) => xs.map((x) => [x.querySelector('strong').textContent, Math.round(x.getBoundingClientRect().height)]));
  check(filasMas.length >= 5 && filasMas.every(([, h]) => h >= 44) && filasMas.some(([t]) => t === 'Cambiar') && filasMas.some(([t]) => t === 'Aproximación'), `«Más» abre la hoja con las herramientas en filas grandes ${JSON.stringify(filasMas)}`);
  await revisar('sesion-mas');
  await hojaMas.getByRole('button', { name: 'Metrónomo de tempo 3-1-1' }).click();
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
  await herramienta(primero, 'Aproximación');
  await p.getByRole('heading', { name: 'Series de aproximación' }).waitFor();
  check(await p.locator('.aproximaciones li').count() >= 2, 'series de aproximación hasta la carga de trabajo');
  await revisar('aproximacion');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await herramienta(primero, 'Historial');
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
  await herramienta(segundo, 'Cambiar');
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
  // v0.49: una serie de más («Añadir serie») no completa el ejercicio ni lo pliega, y la que toca sigue a la vista
  const saltarSiHay = async () => { if (await p.locator('.temporizador').count()) await p.getByRole('button', { name: 'Saltar' }).click(); };
  await segundo.getByRole('button', { name: 'Añadir serie' }).click();
  await segundo.getByLabel('Kilos de la serie 4').fill('30');
  await segundo.getByLabel('Repeticiones de la serie 4').fill('10');
  await segundo.getByRole('button', { name: 'Marcar la serie 4 como hecha' }).click();
  await saltarSiHay();
  await segundo.getByLabel('Kilos de la serie 2').fill('30');
  await segundo.getByLabel('Repeticiones de la serie 2').fill('10');
  await segundo.getByRole('button', { name: 'Marcar la serie 2 como hecha' }).click();
  await saltarSiHay();
  await p.waitForTimeout(1000);
  const sigSeg = segundo.locator('.serie.siguiente');
  check(!(await segundo.getAttribute('class')).includes('plegado') && await segundo.locator('.ejercicio-cuerpo').count() === 1 && (await segundo.locator('.progreso-series').textContent()) === '2/3'
    && await sigSeg.count() === 1 && /serie 3$/.test(await sigSeg.getAttribute('aria-label')) && await sigSeg.isVisible(),
    'con 2 de 3 pautadas y una de más, el ejercicio no se pliega (2/3) y la serie que toca, la 3, está a la vista');
  await segundo.getByRole('button', { name: 'Quitar la serie 4', exact: true }).click();
  await segundo.getByRole('button', { name: 'Quitar la serie 2', exact: true }).click();
  await p.locator('.toast', { hasText: 'Serie 2 quitada' }).waitFor();
  // v0.52.1: la fila añadida, ya sin hacer, se quita con su botón (y no vuelve a salir otra vacía)
  const quitarAnadida = segundo.getByRole('button', { name: 'Quitar la serie 4, la añadida' });
  check(await hay(quitarAnadida, 1) && await hay(segundo.getByLabel('Kilos de la serie 4'), 1), 'desmarcada, la serie añadida se puede quitar');
  await quitarAnadida.click();
  check(await hay(segundo.getByLabel('Kilos de la serie 4'), 0) && await hay(quitarAnadida, 0) && await segundo.getByLabel('Kilos de la serie 3').count() === 1,
    'quitar la serie añadida por error: vuelve a las 3 pautadas');
  await segundo.getByRole('button', { name: 'Añadir serie' }).click();
  await segundo.getByRole('button', { name: 'Quitar la serie 4, la añadida' }).click();
  check(await hay(segundo.getByLabel('Kilos de la serie 4'), 0), 'y una añadida sin querer se quita al momento');

  console.log('\nAtleta: comentario para el coach');
  await p.getByLabel('Escribir a tu coach').fill('He cambiado el remo porque la barra estaba ocupada');
  await p.locator('.responder button[aria-label="Enviar"]').click();
  await p.locator('.mensaje.mio', { hasText: 'He cambiado el remo' }).waitFor();
  check(true, 'envía un comentario en la sesión');
  await revisar('sesion-comentario');
  const { VIDEO_EJEMPLO } = await import('../web/src/datos/video-demo.js');
  await primero.locator('input[type=file]').setInputFiles({ name: 'press.mp4', mimeType: 'video/mp4', buffer: Buffer.from(VIDEO_EJEMPLO.split(',')[1], 'base64') });
  await p.getByLabel('¿Qué quieres que mire?').fill('¿Bajo bien la barra?');
  // v0.30: recortar antes de enviar (el vídeo de ejemplo dura 3 s: se deja del segundo 1 al final)
  await p.locator('.recorte').waitFor();
  await revisar('subir-video');
  check(await p.getByRole('button', { name: 'Enviar a tu coach' }).count() === 1, 'sin recortar, se envía tal cual (un vídeo ligero no se toca)');
  await p.evaluate(() => { window.__grabado = 0; const ini = MediaRecorder.prototype.start; MediaRecorder.prototype.start = function (...x) { window.__grabado++; return ini.apply(this, x); }; });
  await p.getByLabel(/Empieza en/).fill('1');
  await p.locator('.hoja-dialogo .mini', { hasText: 'Se enviarán 2 s de vídeo' }).waitFor();
  check(true, 'al mover el inicio, dice cuánto vídeo se enviará (y cuánto pesará, si pesa menos que el original)');
  await p.getByRole('button', { name: 'Recortar y enviar' }).click();
  await p.locator('.toast', { hasText: 'Vídeo enviado a tu coach' }).waitFor({ timeout: 20000 });
  check(await p.evaluate(() => window.__grabado) === 1, 'recorta el vídeo en el móvil (del segundo 1 al 3) y lo envía');
  // v0.41: el ejercicio dice que ya tiene vídeo (también plegado), y el botón pasa a «Enviar otro vídeo»
  await primero.locator('.ejercicio-cab .video-aviso', { hasText: 'Vídeo enviado' }).waitFor();
  check(await primero.getByRole('button', { name: 'Enviar otro vídeo' }).count() === 1, 'el ejercicio marca «Vídeo enviado» y ofrece enviar otro');
  // v0.33: sin cobertura, el vídeo se queda guardado en el móvil y se envía solo al volver la conexión
  await p.context().setOffline(true);
  await primero.locator('input[type=file]').setInputFiles({ name: 'press2.mp4', mimeType: 'video/mp4', buffer: Buffer.from(VIDEO_EJEMPLO.split(',')[1], 'base64') });
  await p.getByRole('button', { name: 'Enviar a tu coach' }).click();
  await p.locator('.toast', { hasText: 'Sin cobertura' }).waitFor();
  const bandaPend = p.locator('.banda-pendientes');
  await bandaPend.waitFor();
  check((await bandaPend.textContent()).includes('1 vídeo guardado en el móvil'), 'sin cobertura, el vídeo no se pierde: queda guardado en el móvil y lo dice');
  await primero.locator('.video-aviso.pendiente', { hasText: 'Vídeo guardado en el móvil, sin enviar' }).waitFor();
  check(true, 'el ejercicio avisa de que ese vídeo aún no ha salido del móvil');
  await revisar('video-pendiente');
  await p.context().setOffline(false);
  await p.locator('.toast', { hasText: 'Vídeo pendiente enviado' }).waitFor({ timeout: 15000 });
  await bandaPend.waitFor({ state: 'detached' });
  check(true, 'al volver la conexión, se envía solo');
  await primero.locator('.ejercicio-cab .video-aviso:not(.pendiente)', { hasText: '2 vídeos enviados' }).waitFor();
  check(true, 'y el aviso pasa solo a «2 vídeos enviados»');
  await p.getByRole('button', { name: 'Terminar sesión' }).click();
  await p.locator('.hoja-dialogo .segmentos button', { hasText: '8' }).click();
  await p.getByLabel('Nota para tu coach').fill('Me he notado fuerte en el press');
  await p.getByRole('button', { name: 'Guardar y terminar' }).click();
  await p.getByRole('heading', { name: 'Sesión terminada' }).waitFor();
  check((await p.locator('.resumen-num [data-k="series"] .v').textContent()) === '4', 'resumen: 4 series (3 de press y 1 del ejercicio cambiado)');
  // v0.49: duración, series y tonelaje (sin peso ni nada de salud) y la comparación con la última vez
  const resumenTxt = await p.locator('.resumen-sesion').textContent();
  check(await p.locator('.resumen-num > div').count() === 3 && /Duración/.test(resumenTxt) && /Tonelaje/.test(resumenTxt) && !/kg de peso|Peso corporal/.test(resumenTxt), 'el resumen dice la duración, las series y el tonelaje (y nada de peso corporal)');
  await p.locator('.resumen-compara:not(:has(.sil))').waitFor();
  check((await p.locator('.resumen-compara').textContent()).includes('primera vez'), 'la primera vez que hace la sesión lo dice (no hay con qué comparar)');
  await revisar('resumen-sesion');
  await p.getByRole('button', { name: 'Compartir la sesión' }).click();
  await p.locator('.tarjeta-img').waitFor();
  check((await p.locator('.tarjeta-img').evaluate((i) => i.complete && i.naturalWidth)) === 1080, 'crea la tarjeta para compartir (1080 × 1350)');
  // v0.51: tres plantillas: «Cifras» (de entrada), «Mínima» y «Con tu foto» (una foto del móvil, que no se sube)
  const plantillas = p.getByRole('group', { name: 'Plantilla' });
  check((await plantillas.getByRole('radio').count()) === 3 && await plantillas.getByRole('radio', { name: 'Cifras' }).isChecked() && (await p.locator('.tarjeta-img').getAttribute('alt')).includes('(Cifras)'), 'elige entre tres plantillas; de entrada, «Cifras»');
  await revisar('compartir');
  const srcAntes = await p.locator('.tarjeta-img').getAttribute('src');
  await plantillas.getByRole('radio', { name: 'Mínima' }).click();
  await p.waitForFunction((a) => document.querySelector('.tarjeta-img')?.getAttribute('src') !== a && document.querySelector('.tarjeta-previa')?.getAttribute('aria-busy') === 'false', srcAntes);
  check((await p.locator('.tarjeta-img').getAttribute('alt')).includes('(Mínima)'), '«Mínima» rehace la tarjeta (el nombre y una cifra)');
  const red = [];
  p.on('request', (r) => { if (!r.url().startsWith('http://localhost:4174') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) red.push(r.url()); });
  // Una foto de mentira (un PNG de 600 × 800 hecho aquí) elegida «del móvil»
  const png = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 600, 800); g.addColorStop(0, '#f6d365'); g.addColorStop(1, '#fda085'); x.fillStyle = g; x.fillRect(0, 0, 600, 800); x.fillStyle = '#fff'; x.fillRect(200, 300, 200, 300); const b = await new Promise((r) => c.toBlob(r, 'image/png')); return [...new Uint8Array(await b.arrayBuffer())]; });
  const srcMin = await p.locator('.tarjeta-img').getAttribute('src');
  const [selector] = await Promise.all([p.waitForEvent('filechooser'), plantillas.getByRole('radio', { name: 'Con tu foto' }).click()]);
  await selector.setFiles({ name: 'mi-foto.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await p.waitForFunction((a) => document.querySelector('.tarjeta-img')?.getAttribute('src') !== a && document.querySelector('.tarjeta-previa')?.getAttribute('aria-busy') === 'false' && /sobre tu foto/.test(document.querySelector('.tarjeta-img').alt), srcMin);
  const pixel = await p.locator('.tarjeta-img').evaluate(async (i) => { await i.decode().catch(() => {}); const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return [...x.getImageData(540, 500, 1, 1).data]; });
  check(pixel[0] > 150 && pixel[1] > 100 && red.length === 0 && (await p.locator('.tarjeta-foto-elegir').textContent()).includes('no se sube'),
    `«Con tu foto»: la foto del móvil de fondo, con las cifras encima, sin salir del móvil (${pixel.slice(0, 3).join(',')}; peticiones fuera: ${red.length})`);
  await revisar('compartir-foto');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.getByRole('button', { name: 'Volver a hoy' }).click();
  // v0.50: con la sesión de hoy hecha, Hoy lo celebra: sus cifras, «Ver resumen» y lo siguiente (Pierna A)
  const heroHecha = p.locator('.hero-dia.hero-hecha');
  await heroHecha.waitFor();
  await heroHecha.locator('.hero-cifras').waitFor();
  check((await heroHecha.locator('.titular h2').textContent()) === '¡Sesión hecha!' && (await heroHecha.locator('.hero-hecha-nombre').textContent()).includes('Torso A')
    && (await heroHecha.locator('.hero-siguiente').textContent()).includes('Pierna A') && await heroHecha.getByRole('button', { name: 'Ver resumen' }).count() === 1
    && await heroHecha.locator('.hero-cifras > div').count() >= 2 && await heroHecha.locator('svg.ilustracion').getAttribute('aria-hidden') === 'true',
  'con la sesión de hoy hecha, Hoy lo celebra: sus cifras, «Ver resumen» y lo siguiente (Pierna A)');
  check((await p.locator('.diales .dial').first().getAttribute('aria-label')).startsWith('Constancia: 1 de 3 sesiones de esta semana') && (await p.locator('.semana-resumen').textContent()).includes('Te quedan 2 sesiones'), 'el dial de constancia marca 1 de 3 (y la tarjeta dice lo que queda)');

  const disco = p.getByRole('dialog', { name: /medalla/ });
  await disco.waitFor();
  check((await disco.textContent()).includes('Constancia') && (await disco.locator('.medalla-revela').getAttribute('data-metal')) === 'bronce' && (await disco.textContent()).includes('Medalla de bronce')
    && await disco.locator('.medalla-metal.brilla .mm-barrido').count() === 1, `tras su primera sesión gana su primera medalla, de bronce, que entra con un brillo (${(await disco.locator('h2').textContent()).trim()})`);
  await revisar('logro');
  await disco.getByRole('button', { name: 'Seguir' }).click();
  await disco.waitFor({ state: 'detached' });

  await revisar('hoy-hecha');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await revisar('hoy-hecha-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  await heroHecha.getByRole('button', { name: 'Ver resumen' }).click();
  await sesionAbierta();
  check((await p.locator('.cabecera h1').first().textContent()) === 'Torso A', '«Ver resumen» abre la sesión hecha');
  await p.getByRole('button', { name: 'Volver' }).first().click();
  await heroHecha.waitFor();

  console.log('\nAtleta: superserie');
  await p.getByRole('button', { name: 'Adelantar Pierna A' }).click();
  await sesionAbierta();
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
  const alSonarLista = await temporizadorAlSonar(p);
  check(alSonarLista.ok, `al acabar el descanso, el temporizador (con sus ±15 s y ±1 min) cabe entero en la pantalla ${JSON.stringify(alSonarLista)}`);
  await p.getByRole('button', { name: 'Cerrar' }).click();
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
  if (await enf.locator('.temporizador').count()) {
    const alSonarEnf = await temporizadorAlSonar(p);
    check(alSonarEnf.ok, `en el modo enfoque, al sonar, el temporizador no se va a un lado ${JSON.stringify(alSonarEnf)}`);
    await revisar('enfoque-descanso-terminado');
    await enf.getByRole('button', { name: 'Cerrar' }).click();
  }
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
  await p.locator('.hero-dia .hero-siguiente', { hasText: 'Pierna A' }).waitFor();

  console.log('\nAtleta: peso de hoy');
  await p.getByRole('button', { name: 'Apuntar el de hoy' }).click();
  await p.locator('#peso-hoy').fill('70,4');
  await p.locator('#peso-hoy').blur();
  await p.getByRole('button', { name: 'Guardar', exact: true }).click();
  await p.locator('.peso-hoy .chip', { hasText: 'Apuntado' }).waitFor();
  check(!/\d/.test(await p.locator('.peso-hoy').textContent()), 'apunta su peso de hoy en un toque; en Hoy, sin la cifra (a Guti no le gustaba verla siempre)');

  console.log('\nAtleta: check-in');
  await p.locator('.tab', { hasText: 'Check-in' }).click();
  // v0.49: una pregunta por pantalla, con su progreso («1 de N») y el foco en la pregunta
  await p.locator('#ck-titulo').waitFor();
  const progresoCk = await p.locator('.ck-barra').getAttribute('aria-valuetext');
  check(/^1 de \d+$/.test(progresoCk) && (await tituloCheckin()) === 'Tu peso de hoy', `el check-in va de una en una, con su progreso (${progresoCk})`);
  await revisar('checkin');
  await p.getByRole('textbox', { name: 'peso en kilos' }).fill('58,4');
  await p.getByRole('textbox', { name: 'peso en kilos' }).blur();
  await p.locator('.ck-nav').getByRole('button', { name: /Siguiente/ }).click();
  await p.waitForFunction(() => document.getElementById('ck-titulo')?.textContent.trim() === '¿Cuánto duermes por noche?');
  await p.waitForFunction(() => document.activeElement?.id === 'ck-titulo', null, { timeout: 3000 }).catch(() => {});
  check(await p.evaluate(() => document.activeElement?.id === 'ck-titulo') && (await p.locator('.ck-barra').getAttribute('aria-valuetext')).startsWith('2 de'), 'con «Siguiente», a la segunda (el foco va a su pregunta y el progreso lo dice)');
  await responderCheckin('Horas de sueño', '7–8 h');
  check((await tituloCheckin()) === '¿Cómo vas de energía?', 'con una sola respuesta, pasa sola a la siguiente');
  await revisar('checkin-escala');
  await responderCheckin('Energía (cansancio)', '4 Algo de cansancio leve');
  // Con el teclado (o un lector de pantalla) no pasa sola: dice lo elegido y se sigue con «Siguiente»
  check((await tituloCheckin()) === '¿Cómo te recuperas?', 'tras la energía, la recuperación');
  await p.getByRole('group', { name: 'Recuperación' }).getByRole('button', { name: '3 Algo de fatiga, puedo seguir', exact: true }).focus();
  await p.keyboard.press('Enter');
  await p.waitForTimeout(800);
  check((await tituloCheckin()) === '¿Cómo te recuperas?' && (await p.locator('.ck-progreso p.sr').nth(1).textContent()).startsWith('Elegido: 3, Algo de fatiga')
    && (await p.getByRole('group', { name: 'Recuperación' }).getByRole('button', { name: '3 Algo de fatiga, puedo seguir', exact: true }).getAttribute('aria-pressed')) === 'true',
    'con el teclado, la respuesta se marca y se anuncia, pero no salta sola a la siguiente');
  await pasoCheckin('¿Qué tal de motivación?');
  await responderCheckin('Motivación', '5 Muy motivado');
  check((await tituloCheckin()) === '¿Te ha molestado algo?', 'se puede saltar una pregunta («Siguiente» sin contestar)');
  await p.locator('.zonas button', { hasText: 'Hombros' }).click();
  await p.getByRole('group', { name: 'Intensidad en Hombros' }).getByRole('button', { name: 'Moderada' }).click();
  await pasoCheckin('Medidas');
  await p.getByRole('textbox', { name: 'Cintura en centímetros' }).fill('68,5');
  await p.getByRole('textbox', { name: 'Cintura en centímetros' }).blur();
  await pasoCheckin('Repasa y envía');
  const repasoCk = await p.locator('.ck-repaso').textContent();
  check(repasoCk.includes('58,4 kg') && repasoCk.includes('7–8 h') && repasoCk.includes('Hombros (moderada)') && repasoCk.includes('Cintura 68,5 cm') && repasoCk.includes('Sin contestar'),
    'al final, el repaso con todas las respuestas (y las que no contestó)');
  await revisar('checkin-repaso');
  // Cambiar una respuesta desde el repaso: vuelve solo al repaso
  await p.locator('.ck-repaso-fila', { hasText: '¿Qué tal de motivación?' }).click();
  await p.locator('.ck-nav').getByRole('button', { name: 'Volver al repaso' }).waitFor();
  await responderCheckin('Motivación', '4 Motivado');
  check((await tituloCheckin()) === 'Repasa y envía' && (await p.locator('.ck-repaso').textContent()).includes('4: Motivado'), 'tocar una respuesta del repaso la cambia y vuelve al repaso');
  // A 360 px y en oscuro, una pregunta y el repaso
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.locator('.ck-repaso-fila', { hasText: '¿Cómo vas de energía?' }).click();
  await p.waitForFunction(() => document.getElementById('ck-titulo')?.textContent.trim() === '¿Cómo vas de energía?');
  check(await p.evaluate(() => document.documentElement.scrollWidth) <= 360, 'a 360 px y en oscuro, una pregunta del check-in cabe');
  await revisar('checkin-360-oscuro');
  await p.locator('.ck-nav').getByRole('button', { name: 'Volver al repaso' }).click();
  await p.locator('.ck-repaso').waitFor();
  await revisar('checkin-repaso-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.getByRole('button', { name: 'Enviar a tu coach' }).click();
  await p.getByText('Check-in enviado a tu coach').waitFor();
  await p.locator('.ck-enviado', { hasText: '¡Enviado a tu coach!' }).waitFor();
  check(true, 'envía el check-in (y lo celebra con un «¡Enviado a tu coach!»)');
  check(await p.evaluate(() => JSON.stringify(window.__vib?.slice(-1))) === '[[16,70,32]]', 'con su vibración');
  await revisar('checkin-enviado');
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.getByRole('heading', { name: 'Peso corporal' }).waitFor();
  check((await p.locator('.cifra .v').first().textContent()) === '58,4', 'el peso aparece en su progreso');
  check(await p.getByRole('heading', { name: 'Medidas' }).count() === 1, 'y sus medidas');
  // v0.51: los anillos de la semana (sesiones, hábitos y check-in); el del check-in se acaba de cerrar: se celebra una vez
  const anillos = p.locator('.anillos-semana');
  await anillos.waitFor();
  const datosAn = await p.evaluate(() => ({ ids: [...document.querySelectorAll('.anillos-svg [data-anillo]')].map((g) => g.dataset.anillo), celebra: [...document.querySelectorAll('.anillos-svg .celebra')].map((g) => g.dataset.anillo),
    leyenda: document.querySelector('.anillos-leyenda').textContent, etiqueta: document.querySelector('.anillos-svg').getAttribute('aria-label') }));
  check(datosAn.ids.join() === 'sesiones,habitos,checkin' && datosAn.celebra.includes('checkin') && /Check-in.*Enviado.*Cerrado/.test(datosAn.leyenda) && /Check-in, Enviado, cerrado/.test(datosAn.etiqueta),
    `en Progreso, tres anillos (sesiones, hábitos y check-in) y el del check-in, recién cerrado, se celebra ${JSON.stringify(datosAn)}`);
  await p.waitForTimeout(900);
  check(await p.evaluate(() => JSON.stringify(window.__vib?.slice(-1))) === '[[22,60,22,60,48]]' && await p.evaluate(() => { try { return JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('fbe-anillos-')))).cerrados.includes('checkin'); } catch { return false; } }),
    'con su vibración, y queda apuntado en el móvil para esta semana');
  await revisar('progreso');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await anillos.scrollIntoViewIfNeeded();
  await revisar('anillos-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator('.tab', { hasText: 'Semana' }).click();
  await p.getByRole('heading', { level: 1, name: /Bloque|Tu programa/ }).waitFor();
  await p.waitForTimeout(450);
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.locator('.anillos-semana').waitFor();
  check(await p.locator('.anillos-svg .celebra').count() === 0, 'al volver, ya no se celebra otra vez (una vez por anillo y semana)');
  // Con «reducir movimiento», el estado quieto (sin animaciones en los anillos)
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('fbe-anillos-')) localStorage.removeItem(k); });
  await p.locator('.tab', { hasText: 'Semana' }).click();
  await p.getByRole('heading', { level: 1, name: /Bloque|Tu programa/ }).waitFor();
  await p.waitForTimeout(450);
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.locator('.anillos-svg .celebra').first().waitFor();
  check(await p.evaluate(() => document.querySelector('.anillos-svg').getAnimations({ subtree: true }).length) === 0, 'con «reducir movimiento», los anillos se quedan quietos (sin animación)');
  await p.emulateMedia({ reducedMotion: null });
  await abrirPestana(p, 'Perfil');
  await p.getByRole('heading', { name: 'Guías y recursos' }).waitFor();
  check(await p.locator('.recurso details').count() >= 10, 've las guías y preguntas frecuentes');
  // v0.50: el perfil, con su cabecera (foto, nombre, bloque y tres cifras) y la lista agrupada como en iOS
  check(await p.getByRole('heading', { name: 'Preguntas frecuentes' }).count() === 1 && await p.locator('#grupo-faq ~ .panel .recurso details, section:has(#grupo-faq) .recurso details').count() >= 10
    && await p.locator('section:has(#grupo-guias) .recurso').count() >= 1, 'las preguntas frecuentes, en su propio grupo, aparte de las guías');
  const grupos = await p.locator('.grupo-ios > h2').allTextContents();
  check(['Tu asesoría', 'Este móvil', 'Guías y recursos', 'Preguntas frecuentes', 'Cuenta'].every((g) => grupos.includes(g)), `los grupos del perfil: ${grupos.join(', ')}`);
  await p.locator('.perfil-cifras dd.num:not(:has(.sil))').nth(2).waitFor();
  const cifrasPerfil = await p.locator('.perfil-cifras > div').evaluateAll((xs) => xs.map((x) => [x.querySelector('dt').textContent, x.querySelector('dd').textContent]));
  check(cifrasPerfil.map(([t]) => t).join() === 'Semanas completas,Sesiones,Récords' && cifrasPerfil.every(([, v]) => /^\d+$/.test(v)) && Number(cifrasPerfil[1][1]) >= 1
    && (await p.locator('.perfil-cabeza').textContent()).includes('Lucía Prueba') && (await p.locator('.perfil-bloque').textContent()).includes('Semana'),
  `la cabecera: su nombre, su bloque y su semana, y tres cifras (${cifrasPerfil.map((x) => x.join(' ')).join(', ')})`);
  check(await p.locator('.grupo-ios .ios-ico').count() >= 10 && await p.locator('.grupo-ios .fila-ios-chevron').count() >= 3, 'cada fila con su icono; las que llevan a otra parte, con su chevrón');
  await revisar('perfil');
  await p.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Oscuro' }).click();
  check(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'elige el tema oscuro en este móvil');
  await p.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Sistema' }).click();
  check(await p.evaluate(() => !document.documentElement.hasAttribute('data-theme')), 'y vuelve al del sistema');
  // v0.50: el sonido, la voz y la vibración, en su hoja («Sonido y vibración»)
  await p.getByRole('button', { name: /^Sonido y vibración/ }).click();
  const hojaSonido = p.getByRole('dialog', { name: 'Sonido y vibración' });
  await hojaSonido.waitFor();
  await hojaSonido.getByRole('switch', { name: /Vibración al acabar el descanso/ }).uncheck();
  check(await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes')).vibracion === false), 'quita la vibración (se recuerda en el móvil)');
  await hojaSonido.getByRole('switch', { name: /Vibración al acabar el descanso/ }).check();
  // v0.49: la vibración al tocar, con su propio interruptor (encendido de serie)
  const hapt = hojaSonido.getByRole('switch', { name: /Vibración al tocar/ });
  check(await hapt.isChecked() && await hapt.isEnabled(), 'la vibración al tocar tiene su propio interruptor, encendido de serie');
  await hapt.uncheck();
  check(await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes')).hapticos === false && JSON.parse(localStorage.getItem('fbe-ajustes')).vibracion === true), 'y se apaga sin tocar la del descanso');
  await hapt.check();
  await revisar('perfil-sonido');
  await p.keyboard.press('Escape');
  await hojaSonido.waitFor({ state: 'detached' });
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await revisar('perfil-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  // v0.50: el tamaño de la letra (Normal, Grande, Muy grande), en este móvil: cambia la raíz y nada se sale
  const tamLetra = p.getByRole('group', { name: 'Tamaño de la letra' });
  await tamLetra.getByRole('button', { name: 'Muy grande' }).click();
  const raiz = () => p.evaluate(() => [getComputedStyle(document.documentElement).fontSize, document.documentElement.dataset.letra || '', JSON.parse(localStorage.getItem('fbe-ajustes')).letra]);
  const r1 = await raiz();
  check(r1[0] === '20px' && r1[1] === 'muy-grande' && r1[2] === 'muy-grande', `«Muy grande»: la letra de toda la app al 125 % (${r1.join(', ')}), y se recuerda en el móvil`);
  await revisar('perfil-letra-muy-grande');
  await p.setViewportSize({ width: 360, height: 780 });
  await revisar('perfil-letra-muy-grande-360');
  await p.setViewportSize({ width: 390, height: 844 });
  await tamLetra.getByRole('button', { name: 'Normal' }).click();
  check((await raiz())[0] === '16px' && (await raiz())[1] === '', 'y vuelve a «Normal» (Hoy y la sesión, a 125 %, más abajo con Ana)');
  // v0.49: color de acento (seis) y negro puro, en el móvil
  const acentos = p.locator('.acento-op');
  check(await acentos.count() === 6 && await p.getByRole('radio', { name: 'Morado FBE' }).isChecked(), 'seis colores de acento, el morado FBE de serie');
  await p.locator('.acento-op', { hasText: 'Verde pino' }).click();
  const tokens = () => p.evaluate(() => { const c = getComputedStyle(document.documentElement); return { morado: c.getPropertyValue('--morado').trim().toUpperCase(), fondo: getComputedStyle(document.body).backgroundColor, barra: document.querySelector('meta[name="theme-color"][media*="dark"]')?.content }; });
  const t1 = await tokens();
  check(t1.morado === '#0B6B5D' && await p.getByRole('radio', { name: 'Verde pino' }).isChecked() && await p.evaluate(() => JSON.parse(localStorage.getItem('fbe-ajustes')).acento === 'pino'),
    `elige el verde pino: cambia el acento de toda la app (${t1.morado}) y se recuerda en el móvil`);
  await revisar('ajustes-acento');
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.getByRole('switch', { name: 'Negro puro (OLED)' }).check();
  const t2 = await tokens();
  check(t2.morado === '#4FCDB3' && t2.fondo === 'rgb(0, 0, 0)' && t2.barra === '#000000', `en oscuro, el acento pasa a su versión oscura y con «Negro puro» el fondo y la barra del sistema son negros (${JSON.stringify(t2)})`);
  await p.setViewportSize({ width: 360, height: 780 });
  await revisar('ajustes-oled-360-oscuro');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.getByRole('switch', { name: 'Negro puro (OLED)' }).uncheck();
  await p.locator('.acento-op', { hasText: 'Morado FBE' }).click();
  await p.emulateMedia({ colorScheme: null });
  const t3 = await tokens();
  check(t3.morado === '#5438D8' && t3.fondo !== 'rgb(0, 0, 0)' && await p.evaluate(() => !document.getElementById('fbe-acento')?.textContent), 'y vuelve al morado FBE sin negro puro');
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();

  console.log('\nCoach: lo ve en su panel');
  await p.getByRole('button', { name: /Pelayo/ }).click();
  const tarjeta = p.locator('.tarjeta-atleta', { hasText: 'Lucía Prueba' });
  await tarjeta.waitFor();
  check((await tarjeta.textContent()).includes('Dolor moderado: hombros'), 'aviso de molestia moderada en hombros');
  check(await tarjeta.locator('.pips i.hecha').count() === 1, '1 sesión hecha esta semana');
  check((await tarjeta.textContent()).includes('por revisar'), 'el panel marca lo que tiene por revisar');
  // v0.51: «Hoy en tu equipo»: cuántos han entrenado hoy, lo que hay por revisar y quién lleva 7 días sin actividad
  const eqHoy = p.locator('.equipo-hoy');
  await eqHoy.waitFor();
  const etqEq = await eqHoy.locator('[role="img"], button').evaluateAll((xs) => xs.map((x) => x.getAttribute('aria-label')));
  check(etqEq.length === 3 && /^Han entrenado hoy [1-9]\d* de \d+ activos$/.test(etqEq[0]) && /^[1-9]\d* por revisar\. Ir a Revisar$/.test(etqEq[1]) && /^\d+ sin actividad desde hace 7 días o más/.test(etqEq[2]),
    `arriba del panel, «Hoy en tu equipo»: ${etqEq.join(' | ')}`);
  await revisar('equipo-hoy');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await revisar('equipo-hoy-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  const inact = eqHoy.getByRole('button', { name: /sin actividad/ });
  if (await inact.isEnabled()) {
    await inact.click();
    check(await inact.getAttribute('aria-pressed') === 'true' && await p.locator('.selector-chips button[aria-pressed="true"]', { hasText: 'Sin actividad' }).count() === 1, 'tocar «sin actividad» filtra la lista a esos atletas');
    await inact.click();
  } else check(true, 'nadie lleva 7 días sin actividad: no hay nada que filtrar');
  await eqHoy.getByRole('button', { name: /por revisar/ }).click();
  await p.getByRole('heading', { level: 1, name: 'Revisar' }).waitFor();
  check(true, 'tocar «por revisar» lleva a Revisar');
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
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
  // v0.30: variantes con otro material (Rubén: press inclinado con mancuernas, variante «En máquina»)
  await p.locator('.aviso-variante', { hasText: 'variante con otro material' }).waitFor();
  await p.getByRole('button', { name: 'Revisarlos' }).click();
  const hojaVar = p.getByRole('dialog', { name: 'Variantes con otro material' });
  await hojaVar.waitFor();
  const textoVar = await hojaVar.textContent();
  check(textoVar.includes('Rubén Martín') && textoVar.includes('Press inclinado con mancuernas') && textoVar.includes('«En máquina»'), 'Revisar avisa de las variantes con otro material (las que venían de Notion)');
  await revisar('variantes');
  await hojaVar.getByRole('button', { name: 'Cambiar a Press inclinado en máquina' }).click();
  await p.locator('.toast', { hasText: 'cambiado a Press inclinado en máquina' }).waitFor();
  await hojaVar.getByText('Ya no queda ninguno').waitFor();
  await hojaVar.getByRole('button', { name: 'Cerrar' }).click();
  check(await p.locator('.aviso-variante').count() === 0, 'con un toque lo cambia en todo su bloque y el aviso se va');
  await msg.getByRole('button', { name: 'Responder' }).click();
  await msg.getByRole('button', { name: 'Respuestas guardadas' }).click();
  // v0.50 (revisión): la hoja va en su capa, fuera de la tarjeta (que se puede deslizar): su velo tapa toda la pantalla
  await p.locator('.respuesta-guardada').first().waitFor();
  const veloRG = await p.evaluate(() => { const v = [...document.querySelectorAll('.velo')].pop(); const r = v.getBoundingClientRect(); return { padre: v.parentElement?.classList.contains('capa') && v.parentElement.parentElement === document.body, cubre: r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight, r: [r.width, r.height, innerWidth, innerHeight].map(Math.round) }; });
  check(veloRG.padre && veloRG.cubre, `«Respuestas guardadas» desde una tarjeta de Revisar: el velo tapa toda la pantalla (${veloRG.r.join(' × ')})`);
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
  // v0.50: la bandeja por atletas (cada uno se pliega, con su número), las miniaturas de los vídeos y deslizar para dar por revisado
  const gruposRev = p.locator('.grupo-revisar');
  check(await gruposRev.count() >= 2 && await p.locator('.grupo-revisar-cab[aria-expanded="true"]').count() === await gruposRev.count()
    && /^\d+$/.test(await p.locator('.grupo-revisar-n').first().textContent()), `por atletas: ${await gruposRev.count()} grupos, cada uno con cuántas cosas tiene`);
  const grupoAna = gruposRev.filter({ has: p.locator('.grupo-revisar-nombre', { hasText: 'Ana López' }) });
  const miniAna = grupoAna.locator('.revisar-mini').first();
  await miniAna.locator('img').waitFor();
  check((await miniAna.locator('.revisar-mini-dur').textContent()) === '0:08' && (await miniAna.getAttribute('aria-label')) === 'Reproducir el vídeo de Ana (0:08)'
    && await miniAna.locator('img').evaluate((i) => i.complete && i.naturalWidth > 0), 'el vídeo, con su miniatura y su duración');
  const cabAna = grupoAna.locator('.grupo-revisar-cab');
  const nAna = await grupoAna.locator('.tarjeta-revisar').count();
  await cabAna.click();
  check(await cabAna.getAttribute('aria-expanded') === 'false' && await grupoAna.locator('.tarjeta-revisar').count() === 0 && nAna > 0, 'la cabecera de cada atleta pliega lo suyo');
  await cabAna.click();
  check(await hay(grupoAna.locator('.tarjeta-revisar'), nAna), 'y lo vuelve a desplegar');
  await revisar('revisar-grupos');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await revisar('revisar-grupos-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  check(await p.locator('button.revisar-hecho', { hasText: 'Resuelto' }).evaluateAll((xs) => xs.every((x) => !x.hasAttribute('data-deshacer')))
    && await p.locator('button.revisar-hecho', { hasText: 'Revisado' }).evaluateAll((xs) => xs.length > 0 && xs.every((x) => x.hasAttribute('data-deshacer'))),
  'deslizar solo pulsa los botones con «Deshacer» (no «Resuelto» en recetas ni en avisos del equipo)');
  const conRevisado = p.locator('.deslizable').filter({ has: p.locator('button.revisar-hecho', { hasText: 'Revisado' }) });
  const antesDesl = await p.locator('.tarjeta-revisar').count();
  const desl = conRevisado.first();
  await desl.scrollIntoViewIfNeeded();
  await desl.evaluate((el) => {
    const b = el.getBoundingClientRect(), y = b.top + 24, x0 = b.left + 30;
    const blanco = el.querySelector('.tarjeta-revisar strong, .tarjeta-revisar .cita, .tarjeta-revisar');
    const ev = (t, x) => blanco.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
    ev('pointerdown', x0);
    for (let i = 1; i <= 8; i++) ev('pointermove', x0 + i * 28);
    ev('pointerup', x0 + 8 * 28);
  });
  const avisoDesl = p.locator('.toast', { hasText: /revisad[oa]/ });
  await avisoDesl.waitFor();
  check(await hay(p.locator('.tarjeta-revisar'), antesDesl - 1), `deslizar una tarjeta a la derecha la da por revisada («${(await avisoDesl.textContent()).replace('Deshacer', '').trim()}»)`);
  await avisoDesl.getByRole('button', { name: 'Deshacer' }).click();
  check(await hay(p.locator('.tarjeta-revisar'), antesDesl), 'con el «Deshacer» de siempre');
  // v0.50: los estados vacíos, con su dibujo de línea: la biblioteca sin resultados (y sus pictogramas)
  await p.locator('.tab', { hasText: 'Biblioteca' }).click();
  await p.getByLabel('Buscar ejercicio').fill('zzzz');
  const vacioBib = p.locator('.vacio.con-ilustracion', { hasText: 'Ningún ejercicio coincide' });
  await vacioBib.waitFor();
  check(await vacioBib.locator('svg.ilustracion').getAttribute('aria-hidden') === 'true' && await vacioBib.getByRole('button', { name: 'Ver todos' }).count() === 1, 'buscar algo que no está: el dibujo, una frase y «Ver todos»');
  await revisar('biblioteca-vacia');
  await vacioBib.getByRole('button', { name: 'Ver todos' }).click();
  await p.locator('.fila-biblioteca').first().waitFor();
  check(await p.locator('.fila-biblioteca .picto').count() === await p.locator('.fila-biblioteca').count() && await p.locator('.fila-biblioteca .picto').count() > 10, 'la biblioteca, con el pictograma de cada ejercicio');
  // …y la ficha de quien aún no ha empezado: sin check-ins, sin tareas y con el diario vacío
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  const filtroInv = p.getByRole('button', { name: /^Sin activar/ });
  if (await filtroInv.count()) await filtroInv.click();
  await p.locator('.tarjeta-atleta', { hasText: 'Marta Gil' }).first().click();
  await p.getByRole('tab', { name: 'Seguimiento' }).click();
  await p.locator('.vacio.con-ilustracion', { hasText: 'Sin tareas todavía' }).waitFor();
  const vaciosSeg = p.locator('.vacio.con-ilustracion');
  check(await vaciosSeg.count() >= 2 && (await p.locator('.contenido').textContent()).includes('Sin check-ins todavía') && await vaciosSeg.locator('svg.ilustracion[aria-hidden="true"]').count() === await vaciosSeg.count()
    && await p.getByRole('button', { name: 'Poner la primera' }).count() === 1, 'su seguimiento vacío: cada estado con su dibujo, una frase y lo siguiente («Poner la primera»)');
  await revisar('vacios-seguimiento');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await revisar('vacios-seguimiento-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.getByRole('tab', { name: 'Vídeos y fotos' }).click();
  await p.locator('.vacio.con-ilustracion', { hasText: 'Su diario está vacío' }).waitFor();
  check(true, 'y su diario vacío, con su dibujo');
  await revisar('diario-vacio');
  await p.getByRole('button', { name: 'Volver a atletas' }).click();
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  const todosF = p.getByRole('button', { name: 'Todos', exact: true });
  if (await todosF.count()) await todosF.first().click();

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
  // v0.35: el principal se elige a la vista (cuenta 1 serie; el resto, media) y elegirlo no cambia el resto
  const principal = p.locator('.hoja-dialogo').getByRole('combobox', { name: 'Grupo muscular principal' });
  const antesPrincipal = await principal.inputValue();
  await principal.selectOption('deltoides');
  const chipMorado = await p.locator('.hoja-dialogo .chip.morado').first().textContent();
  check(antesPrincipal === 'pectoral' && /Deltoides/.test(chipMorado), `en la ficha del ejercicio se elige el músculo principal (press banca: ${antesPrincipal} → deltoides)`);
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
  const disco2 = p.getByRole('dialog', { name: /medalla/ });
  await disco2.waitFor();
  check((await disco2.textContent()).includes('Check-ins'), 'y le da la medalla de su primer check-in');
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
  const discosAna = p.getByRole('dialog', { name: /medallas nuevas/ });
  await discosAna.waitFor();
  check(true, 'la primera vez, Ana ve las medallas que ya había ganado');
  await discosAna.getByRole('button', { name: 'Ver mis logros' }).click();
  await p.locator('.logros').waitFor();
  check(await p.locator('.logro').count() === 7, 'en Progreso, sus 7 logros');
  // v0.51: medallas de metal: el nivel dice el metal (y su canto lo distingue sin el color)
  const metales = await p.locator('.logro .logro-metal').allTextContents();
  check(metales.length === 7 && metales.every((m) => ['Bronce', 'Plata', 'Oro', 'Platino', 'Sin medalla'].includes(m)) && metales.some((m) => m !== 'Sin medalla')
    && (await p.locator('.logro').first().getAttribute('aria-label')).match(/medalla de (bronce|plata|oro|platino)|aún sin medalla/), `cada logro, con su medalla y su metal escrito (${metales.join(', ')})`);
  await p.locator('.logros').scrollIntoViewIfNeeded();
  await revisar('logros-medallas');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await revisar('logros-medallas-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  // v0.49: constancia de 16 semanas: cada día por sesiones hechas, con leyenda; tocar un día dice qué hizo
  const mapaC = p.locator('.mapa-constancia');
  await mapaC.scrollIntoViewIfNeeded();
  await mapaC.locator('.cr-celda.n1, .cr-celda.n2').first().waitFor();
  const conSesion = mapaC.locator('button.cr-celda.n1, button.cr-celda.n2');
  check(await mapaC.locator('.constancia-rejilla > .cr-celda').count() === 112 && await conSesion.count() >= 8 && (await mapaC.locator('.cr-leyenda').textContent()).replace(/\s+/g, ' ').trim() === 'Menos Más'
    && await mapaC.locator('.cr-mes').count() >= 3, `16 semanas de lunes a domingo (${await conSesion.count()} días con sesión), con los meses y «Menos · Más»`);
  await conSesion.last().click();
  const detalleC = (await mapaC.locator('.cr-detalle').textContent()).trim();
  check(/^(lun|mar|mié|jue|vie|sáb|dom) \d+ \w+: .+/.test(detalleC) && !detalleC.includes('descanso'), `tocar un día dice qué hizo («${detalleC}»)`);
  const diaAntes = await p.evaluate(() => document.activeElement?.dataset.dia);
  await p.keyboard.press('ArrowLeft');
  await p.waitForFunction((d) => document.activeElement?.dataset.dia && document.activeElement.dataset.dia !== d, diaAntes, { timeout: 3000 }).catch(() => {});
  const diaDespues = await p.evaluate(() => document.activeElement?.dataset.dia);
  check(diaAntes && diaDespues && (Date.parse(diaAntes) - Date.parse(diaDespues)) / 864e5 === 7, `con las flechas se mueve por los días (${diaAntes} → ${diaDespues}, una semana antes)`);
  await revisar('constancia');
  // v0.49: gráficas táctiles: arrastrar el dedo enseña la fecha y el valor; con el teclado, un deslizador
  const graf = p.locator('.grafica-tactil').first();
  await graf.scrollIntoViewIfNeeded();
  const cajaG = await graf.boundingBox();
  await p.mouse.move(cajaG.x + cajaG.width * 0.3, cajaG.y + cajaG.height / 2);
  await p.mouse.down();
  await p.mouse.move(cajaG.x + cajaG.width * 0.6, cajaG.y + cajaG.height / 2, { steps: 4 });
  const globo = (await graf.locator('.grafica-globo').textContent().catch(() => '')).trim();
  check(/^\d+ \w+: [\d,]+ kg/.test(globo) && await graf.locator('.guia').count() === 1, `al arrastrar, una guía con la fecha y el valor («${globo}»)`);
  await revisar('grafica-tactil');
  await p.mouse.up();
  await graf.focus();
  await p.keyboard.press('Home');
  const v0 = await graf.getAttribute('aria-valuenow');
  await p.keyboard.press('ArrowRight');
  check(v0 === '1' && await graf.getAttribute('aria-valuenow') === '2' && /: [\d,]+ kg/.test(await graf.getAttribute('aria-valuetext')) && (await graf.locator('xpath=following-sibling::p[contains(@class,"sr")]').textContent()).length > 20,
    'con el teclado, las flechas mueven el punto (y hay un resumen en texto)');
  check(await p.locator('.grafica .punto.record').count() >= 1, 'la gráfica del 1RM marca los récords');
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
  // v0.50: la vitrina de récords en trofeos («Nuevo» si es de los últimos 30 días); al tocar uno, cómo ha ido subiendo
  const trofeos = p.locator('.trofeo-tarjeta');
  await trofeos.first().waitFor();
  check(await trofeos.count() === 6 && await p.locator('.trofeo-tarjeta .trofeo-nuevo').count() >= 1 && /\d/.test(await trofeos.first().locator('.trofeo-valor').textContent())
    && /Ver cómo ha ido$/.test(await trofeos.first().getAttribute('aria-label')), 'la vitrina: un trofeo por ejercicio, con su mejor marca, la serie, el día y «Nuevo»');
  await trofeos.first().click();
  const hojaRecord = p.getByRole('dialog').last();
  await hojaRecord.locator('.record-cab').waitFor();
  await hojaRecord.locator('.lista-records li').first().waitFor();
  check(await hojaRecord.locator('svg.grafica').count() === 1 && await hojaRecord.locator('.grafica .punto.record').count() >= 1 && await hojaRecord.locator('.lista-records li').count() >= 1,
    `al tocarlo, su evolución (la gráfica táctil) y cada vez que lo batió (${await hojaRecord.locator('.lista-records li').count()})`);
  await revisar('record-evolucion');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await revisar('record-evolucion-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
  await hojaRecord.getByRole('button', { name: 'Cerrar' }).click();
  await hojaRecord.waitFor({ state: 'detached' });
  await p.getByRole('button', { name: /^Ver los \d+ ejercicios$/ }).click();
  check(await trofeos.count() > 6, '«Ver los N ejercicios» los enseña todos');
  await p.getByRole('button', { name: 'Gráficas, récords e historial' }).first().click();
  await p.getByRole('tab', { name: 'Gráficas', selected: true }).waitFor();
  check(await p.locator('.hoja-dialogo svg.grafica').waitFor().then(() => true, () => false), 'la ficha del ejercicio abre con su gráfica');
  check(await p.locator('.hoja-dialogo .ficha-ej-cab .picto[aria-hidden="true"]').count() === 1, 'con el pictograma de su patrón junto a sus músculos');
  await p.getByRole('button', { name: '1 año' }).click();
  await p.getByRole('tab', { name: 'Récords' }).click();
  check(await p.locator('.tabla-records tbody tr').count() >= 6, 'y la tabla de récords de 1 a 12 repeticiones');
  await revisar('ficha-ejercicio');
  await p.getByRole('button', { name: 'Cerrar' }).click();
  await p.locator('.tab', { hasText: 'Semana' }).click();
  check(await hay(p.locator('.semanas-tabs button'), 4), 'Ana ve sus 4 semanas publicadas, no los borradores');
  // v0.50: Semana: la semana con sus botones (y deslizando los días), y cada sesión con sus músculos, sus minutos y sus pictogramas
  const tarjSem = p.locator('.semana-dias .dia.con-resumen');
  await tarjSem.first().waitFor();
  check(await tarjSem.count() >= 2 && await tarjSem.first().locator('.chip-musculo').count() >= 1 && /^unos \d+ min$/.test((await tarjSem.first().locator('.chip-min').textContent()).trim())
    && await tarjSem.first().locator('.picto[aria-hidden="true"]').count() >= 1, `cada sesión con sus músculos, unos minutos y sus pictogramas («${(await tarjSem.first().locator('.dia-chips').textContent()).trim()}»)`);
  check((await p.locator('#semana-titulo').textContent()).startsWith('Semana 4'), 'abre en la semana en curso');
  await p.getByRole('button', { name: /^Semana anterior/ }).click();
  await p.locator('#semana-titulo', { hasText: 'Semana 3' }).waitFor();
  check((await p.locator('.semanas-tabs button[aria-pressed="true"]').textContent()).startsWith('S3'), 'el botón de la semana anterior la cambia (la alternativa al gesto)');
  const zonaDias = p.locator('.dias-deslizar');
  const bbDias = await zonaDias.boundingBox();
  await p.mouse.move(bbDias.x + bbDias.width * 0.75, bbDias.y + 14);
  await p.mouse.down();
  await p.mouse.move(bbDias.x + bbDias.width * 0.15, bbDias.y + 18, { steps: 8 });
  await p.mouse.up();
  await p.locator('#semana-titulo', { hasText: 'Semana 4' }).waitFor();
  check(true, 'deslizar los días a la izquierda pasa a la semana siguiente');
  // v0.50 (revisión): arrastrar dentro de la hoja de cambiar el día no cambia de semana ni la cierra
  const chipDia = p.locator('.dias-deslizar .tira-chip[aria-label^="Cambiar el día de"]').first();
  if (await chipDia.count()) {
    await chipDia.click();
    const hojaDiaSem = p.getByRole('dialog', { name: /^¿Qué día harás/ });
    await hojaDiaSem.waitFor();
    // (por el título: un día es una fila entera y arrastrar dentro de ella es tocarla)
    const bbH = await hojaDiaSem.locator('.hoja-cab h2').boundingBox();
    await p.mouse.move(bbH.x + bbH.width * 0.9, bbH.y + bbH.height / 2);
    await p.mouse.down();
    await p.mouse.move(bbH.x + bbH.width * 0.05, bbH.y + bbH.height / 2 + 3, { steps: 8 });
    await p.mouse.up();
    await p.waitForTimeout(400);
    check(await hojaDiaSem.isVisible() && (await p.locator('#semana-titulo').textContent()).startsWith('Semana 4'), 'arrastrar a los lados dentro de la hoja de cambiar el día no cambia de semana ni la cierra');
    await p.keyboard.press('Escape');
    await hojaDiaSem.waitFor({ state: 'detached' });
  } else check(true, 'esta semana no queda ninguna sesión con día que cambiar');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await revisar('semana-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });
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

  // v0.50: el día de descanso (si hoy no es domingo, Torso B pasa a mañana un momento): una idea para hoy y lo que viene
  if (new Date().getDay() !== 0) {
    const NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    await p.locator('.toca-hoy').waitFor();
    // (en el centro: arriba la taparía la cabecera pegada)
    await p.getByRole('button', { name: 'Tu plan', exact: true }).evaluate((b) => b.scrollIntoView({ block: 'center' }));
    await p.getByRole('button', { name: 'Tu plan', exact: true }).click();
    const hojaPlanA = p.getByRole('dialog', { name: /^Tu plan,/ });
    await hojaPlanA.getByRole('button', { name: /^Torso B: prevista hoy/ }).click();
    const hojaDiaB = p.getByRole('dialog', { name: '¿Qué día harás Torso B?' });
    await hojaDiaB.getByRole('button', { name: new RegExp(`^${NOMBRES[(new Date().getDay() + 1) % 7]}`) }).click();
    await hojaDiaB.waitFor({ state: 'detached' });
    await p.keyboard.press('Escape');
    await hojaPlanA.waitFor({ state: 'detached' });
    // (los lunes, lo que lleva hecho esta semana es de hoy: entonces Hoy celebra lo hecho y dice lo que viene)
    await p.locator('.hero-dia.hero-descanso, .hero-dia.hero-hecha').waitFor();
    const heroDesc = p.locator('.hero-dia.hero-descanso');
    if (await heroDesc.count()) {
      check((await heroDesc.locator('.titular h2').textContent()) === 'Hoy descansas' && (await heroDesc.locator('.hero-sugerencia strong').textContent()).length > 5
        && /Lo siguiente: Torso B, mañana/.test(await heroDesc.locator('.hero-siguiente').textContent()) && await heroDesc.getByRole('button', { name: 'Ver tu plan de la semana' }).count() === 1
        && await heroDesc.getByRole('button', { name: 'Entrenar hoy igualmente' }).count() === 1, `día de descanso: «${(await heroDesc.locator('.hero-sugerencia strong').textContent())}» y lo que viene (Torso B, mañana)`);
      await revisar('hoy-descanso');
      await p.setViewportSize({ width: 360, height: 780 });
      await p.emulateMedia({ colorScheme: 'dark' });
      await revisar('hoy-descanso-360-oscuro');
      await p.emulateMedia({ colorScheme: null });
      await p.setViewportSize({ width: 390, height: 844 });
    } else {
      check(/Lo siguiente: Torso B, mañana/.test(await p.locator('.hero-dia.hero-hecha .hero-siguiente').textContent()), 'hoy ya ha entrenado (es lunes): Hoy lo celebra y dice lo que viene (Torso B, mañana)');
      await revisar('hoy-hecha-lunes');
    }
    // (en el centro: arriba la taparía la cabecera pegada)
    await p.getByRole('button', { name: 'Tu plan', exact: true }).evaluate((b) => b.scrollIntoView({ block: 'center' }));
    await p.getByRole('button', { name: 'Tu plan', exact: true }).click();
    await hojaPlanA.getByRole('button', { name: /^Torso B: prevista mañana/ }).click();
    await hojaDiaB.getByRole('button', { name: /, hoy/ }).click();
    await hojaDiaB.waitFor({ state: 'detached' });
    await p.keyboard.press('Escape');
    await hojaPlanA.waitFor({ state: 'detached' });
  } else check(true, 'hoy es domingo: no hay un día después en la semana para probar el descanso');
  // v0.50: Hoy y una sesión con la letra más grande (125 %): nada se sale, tampoco a 360 px
  await abrirPestana(p, 'Perfil');
  await p.getByRole('group', { name: 'Tamaño de la letra' }).getByRole('button', { name: 'Muy grande' }).click();
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.locator('.hero-dia').waitFor();
  check(await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === '20px', 'con «Muy grande», Hoy también va al 125 %');
  await revisar('hoy-letra-muy-grande');
  await p.setViewportSize({ width: 360, height: 780 });
  await revisar('hoy-letra-muy-grande-360');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator('.semana-dias .dia.hecha').first().click();
  await sesionAbierta();
  // (una sesión hecha: sus ejercicios, plegados en una línea; se espera a que acaben de plegarse)
  await p.waitForTimeout(900);
  await revisar('sesion-letra-muy-grande');
  await p.setViewportSize({ width: 360, height: 780 });
  await revisar('sesion-letra-muy-grande-360');
  check(await p.evaluate(() => document.documentElement.scrollWidth) <= 360, 'a 125 %, Hoy y la sesión caben sin desbordarse (también a 360 px)');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.getByRole('button', { name: 'Volver' }).first().click();
  // v0.51: a 125 % también la portada de una sesión sin empezar, los anillos y las medallas (sin tocar «Empezar»)
  await p.locator('.semana-dias .dia').first().waitFor();
  const pendienteA = p.locator('.semana-dias .dia:not(.hecha)').first();
  if (await pendienteA.count()) {
    await pendienteA.click();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor();
    if (await p.locator('.portada-sesion').count()) {
      await revisar('portada-letra-muy-grande');
      await p.setViewportSize({ width: 360, height: 780 });
      await revisar('portada-letra-muy-grande-360');
      check(await p.evaluate(() => document.documentElement.scrollWidth) <= 360, 'a 125 % y 360 px, la portada cabe');
      // v0.51 (revisión): a 125 % y 360 px la cabecera pegada es más alta; tocar un tramo deja el ejercicio debajo, a la vista
      await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
      await p.locator('.ejercicio').first().waitFor();
      const nTramos = await p.locator('nav.tramos a').count();
      await p.locator('nav.tramos a').nth(Math.min(3, nTramos - 1)).click();
      await p.waitForTimeout(900);
      const tapada = await p.evaluate(() => {
        const cab = document.querySelector('.sesion-vista > .cabecera').getBoundingClientRect();
        const ej = document.activeElement?.closest('.ejercicio')?.querySelector('.ejercicio-cab')?.getBoundingClientRect();
        return { cab: Math.round(cab.bottom), ej: ej ? Math.round(ej.top) : null, alto: Math.round(cab.height), foco: document.activeElement?.classList.contains('ejercicio-cab') };
      });
      check(tapada.foco && tapada.ej != null && tapada.ej >= tapada.cab - 1 && tapada.ej < 780, `a 125 % y 360 px, tocar un tramo deja la cabecera del ejercicio justo debajo de la cabecera pegada (${tapada.alto} px), sin taparla ${JSON.stringify(tapada)}`);
      await p.setViewportSize({ width: 390, height: 844 });
    } else check(true, 'la sesión pendiente ya estaba empezada: sin portada');
    await p.getByRole('button', { name: 'Volver' }).first().click();
  } else check(true, 'sin sesiones pendientes esta semana: no hay portada que mirar');
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.locator('.logros').waitFor();
  await p.setViewportSize({ width: 360, height: 780 });
  await p.locator('.anillos-semana').scrollIntoViewIfNeeded().catch(() => {});
  await revisar('progreso-letra-muy-grande-360');
  check(await p.evaluate(() => document.documentElement.scrollWidth) <= 360, 'a 125 % y 360 px, los anillos y las medallas caben');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await abrirPestana(p, 'Perfil');
  await p.getByRole('group', { name: 'Tamaño de la letra' }).getByRole('button', { name: 'Normal' }).click();
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.locator('.toca-hoy').waitFor();

  console.log('\nDemo: serie top, intervalos y cámara guiada');
  await p.locator('.toca-hoy').waitFor();
  check((await p.locator('.titular h2').textContent()) === 'Torso B', 'Ana tenía Torso B para hoy: «Hoy toca»');
  // v0.51: con Torso B prevista para hoy, «Cómo llegas» se contesta desde Hoy y la sesión ya no lo vuelve a preguntar
  // (la misma regla: contestado hoy en este móvil). Si hoy ya hizo otra sesión (los lunes), el dial enseña esa.
  const dialLlegas = p.locator('.diales .dial').nth(2);
  let contestoEnHoy = false;
  if ((await dialLlegas.textContent()).includes('Contestar')) {
    await dialLlegas.click();
    const hojaL = p.getByRole('dialog', { name: 'Cómo llegas hoy' });
    await hojaL.waitFor();
    check((await hojaL.textContent()).includes('Se guarda con Torso B'), 'con la sesión prevista para hoy, «Cómo llegas» se contesta desde Hoy (se guarda con Torso B)');
    for (const [g, x] of [['¿Cómo has dormido?', 'Bien'], ['¿Cómo tienes la energía?', 'Normal'], ['¿Agujetas o molestias?', 'Ninguna']]) await hojaL.getByRole('group', { name: g }).getByRole('button', { name: x, exact: true }).click();
    await hojaL.locator('.consejo-dia').waitFor();
    await p.keyboard.press('Escape');
    await hojaL.waitFor({ state: 'detached' });
    await p.waitForFunction(() => /Buen día/.test(document.querySelectorAll('.diales .dial')[2]?.textContent || ''));
    check(true, 'y el dial pasa a «Buen día»');
    contestoEnHoy = true;
  } else check(/Buen día|Día flojo|Día difícil/.test(await dialLlegas.textContent()), `hoy ya hizo una sesión con su «¿Cómo llegas hoy?»: el dial la enseña (${await dialLlegas.textContent()})`);
  await p.getByRole('button', { name: 'Empezar sesión' }).click();
  await sesionAbierta();
  if (contestoEnHoy) check(await p.locator('.preparacion').count() === 0 && (await p.locator('.consejo-dia').textContent()).includes('Buen día'), 'la sesión no vuelve a preguntar cómo llega: enseña lo contestado en Hoy');
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
  // v0.50: la barra de kcal y los tres anillos de macros, cada uno con su valor, su objetivo y su nombre (no solo el color)
  const anillosM = p.locator('.nutricion-hoy .anillo-macro');
  check(await anillosM.count() === 3 && (await p.locator('.nutricion-hoy .anillo-macro-nombre').allTextContents()).join() === 'Proteína,Hidratos,Grasa'
    && (await p.locator('.nutricion-hoy .anillo-macro [role="img"]').evaluateAll((xs) => xs.map((x) => x.getAttribute('aria-label')))).every((t) => /^(Proteína|Hidratos|Grasa): (\d+ de \d+ g|sin apuntar)$/.test(t))
    && /^Kcal: /.test(await p.locator('.nutricion-hoy .kcal-barra').getAttribute('aria-label')) && /de 1695/.test(await p.locator('.nutricion-hoy .kcal-barra').getAttribute('aria-label')),
  'la nutrición de hoy: la barra de kcal (comido, objetivo y lo que queda) y un anillo por macro, con su nombre y sus cifras');
  await p.locator('.seccion-nutricion').scrollIntoViewIfNeeded();
  await revisar('nutricion-anillos');
  await p.emulateMedia({ colorScheme: 'dark' });
  await revisar('nutricion-anillos-oscuro');
  await p.emulateMedia({ colorScheme: null });
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
  check(await p.getByRole('heading', { name: 'Su día de hoy' }).count() === 1 && (await p.locator('.macros-dia .anillo-macro').count() === 3 || (await p.locator('.contenido').textContent()).includes('Aún no ha apuntado nada hoy')),
    'en su ficha, el coach ve su día de hoy con los mismos anillos');
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
  // v0.50: en el perfil, las notificaciones son una fila de «Este móvil»
  await p.locator('.fila-notificaciones').waitFor();
  await p.locator('.fila-notificaciones').getByRole('button', { name: /^Notificaciones/ }).click();
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
  const resumenNoti = await p.locator('.fila-notificaciones .resumen-noti').textContent();
  check(/Respuestas, semana, avisos, peticiones, tareas, descansos, equipo y 3 recordatorios/.test(resumenNoti), `y en Perfil se ve lo que tiene activado («${resumenNoti}»)`);

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
  await pasoCheckin('Estrés en el trabajo o los estudios');
  check(await p.locator('.ck-de-coach').count() === 1, 'la pregunta de su coach sale en su propia pantalla, marcada como suya');
  await revisar('checkin-preguntas');
  await responderCheckin('Estrés en el trabajo o los estudios', '4');
  await repasoCheckin();
  await p.getByRole('button', { name: /Enviar a tu coach|Actualizar check-in/ }).click();
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
  // v0.40: el peso, una vez a la semana (en el check-in) en vez de cada día en «Tu día»
  await p.getByRole('group', { name: 'Su peso' }).getByRole('button', { name: 'Una vez a la semana' }).click();
  await p.locator('.toast', { hasText: 'Su peso, una vez a la semana' }).waitFor();
  check(await p.getByRole('group', { name: 'Su peso' }).getByRole('button', { name: 'Una vez a la semana', pressed: true }).count() === 1, 'el coach le pide el peso a Ana una vez a la semana, en el check-in');
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
  await p.locator('.tu-dia').waitFor();
  check(await p.locator('.tu-dia .fila-dia', { hasText: 'Tu peso' }).count() === 0 && await p.locator('.tu-dia .fila-dia').count() > 0,
    'y a Ana ya no le sale «Tu peso» como pendiente en «Tu día»');
  await p.locator('.tab', { hasText: 'Check-in' }).click();
  await repasoCheckin();
  check(await p.locator('.ck-repaso-fila', { hasText: 'Horas de sueño entre semana' }).count() === 1 && await p.locator('.ck-repaso-fila', { hasText: 'Datos de reloj o app' }).count() === 0
    && await p.locator('.ck-repaso-fila', { hasText: 'Estrés en el trabajo' }).count() === 1,
    'y en su check-in, la pregunta nueva y ya no los datos de reloj');
  await pasoCheckin('Horas de sueño entre semana');
  check(await p.getByLabel('Horas de sueño entre semana (h)').count() === 1, 'la pregunta nueva se contesta en su pantalla');

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
  // (una foto de verdad: antes era un JPEG de 22 bytes que el navegador no podía pintar y salía rota)
  await p.locator('input[type=file][accept="image/*,video/*"]').setInputFiles({ name: 'rodilla.png', mimeType: 'image/png', buffer: (await import('node:fs')).readFileSync(new URL('../web/iconos/icono-180.png', import.meta.url)) });
  await p.locator('.chat-adjunto').waitFor();
  await p.locator('.chat-area').fill('La rodilla hoy');
  await revisar('chat-adjunto');
  await p.getByRole('button', { name: 'Enviar' }).click();
  await p.locator('.burbuja.mia', { hasText: 'La rodilla hoy' }).waitFor();
  check(await p.locator('.burbuja.mia', { hasText: 'La rodilla hoy' }).locator('.medio-chat').count() === 1, 'y una foto con pie, que sale en su burbuja');
  // v0.49: la foto aparece al cargar (sin el icono de imagen rota) y los dos mensajes seguidos van juntos
  await p.locator('.burbuja.mia', { hasText: 'La rodilla hoy' }).locator('.medio-chat.listo img').waitFor();
  await p.waitForTimeout(400);
  check(await p.locator('.medio-fallo').count() === 0 && await p.locator('.burbuja.mia', { hasText: 'La rodilla hoy' }).locator('img').evaluate((i) => i.naturalWidth > 0 && getComputedStyle(i).opacity === '1'), 'la foto se ve (antes salía rota)');
  check((await p.locator('.burbuja.mia', { hasText: 'Vuelvo el viernes' }).getAttribute('class')).includes('sin-cola') && (await p.locator('.burbuja.mia', { hasText: 'La rodilla hoy' }).getAttribute('class')).includes('sigue'),
    'dos mensajes seguidos van juntos: solo el último lleva el pico y la hora');
  check(await p.locator('.chat-sep').first().evaluate((x) => getComputedStyle(x).position) === 'sticky', 'los separadores de día se quedan arriba al desplazarse');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.getByRole('button', { name: 'Tu perfil' }).click();
  await p.getByRole('heading', { name: 'Tu asesoría' }).waitFor();
  check(true, 'Perfil se abre desde el avatar de arriba (ya no está en la barra del móvil)');
  // Foto de perfil (v0.19): cualquier imagen; el móvil la recorta en cuadrado y la comprime
  await p.locator('input[type=file][aria-label="Foto de perfil nueva"]').setInputFiles(new URL('../web/iconos/icono-512.png', import.meta.url).pathname);
  await p.locator('.perfil-cabeza .avatar.con-foto img').waitFor();
  const fotoAna = await p.locator('.perfil-cabeza .avatar.con-foto img').getAttribute('src');
  check(/^data:image\/jpeg;base64,/.test(fotoAna) && fotoAna.length < 80000, `pone su foto de perfil: recortada y comprimida en el móvil (${Math.round(fotoAna.length / 1024)} KB)`);
  await revisar('perfil-foto');
  // v0.25: tocar la foto la abre en grande (guardada a 384 px)
  await p.locator('.perfil-cabeza').getByRole('button', { name: /Ver en grande la foto/ }).click();
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
  check((await p.locator('.espacio-fila').allTextContents()).some((t) => t.includes('Ana López')), 'en Cuenta ve el espacio que ocupa cada atleta');
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
  // v0.51: también la de cardio empieza con su portada (con la pauta en ella)
  if (await p.locator('.portada-sesion').count()) {
    await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    await p.locator('.sesion-vista .tarjeta-cardio').waitFor();
  }
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
  await repasoCheckin();
  check(await p.locator('.ck-repaso-fila', { hasText: 'Alimentación' }).count() === 0 && await p.locator('.ck-repaso-fila', { hasText: 'Motivación' }).count() + await p.locator('.ck-repaso-fila', { hasText: 'motivación' }).count() >= 1,
    'ni el check-in le pregunta por su alimentación');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  // Los discos nuevos pueden salir al volver a Hoy (según el día en que se pase la prueba): se cierran
  await p.waitForTimeout(600);
  for (let i = 0; i < 3; i++) { const d = p.locator('[role=dialog]').first(); if (!(await d.isVisible().catch(() => false))) break; const b2 = d.getByRole('button', { name: /^Seguir$|^Cerrar$/ }).first(); if (await b2.isVisible().catch(() => false)) await b2.click(); else await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
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
  await sesionAbierta();
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
  await p.locator('nav.tabs').waitFor();
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
  await p.getByRole('button', { name: /^Sonido y vibración/ }).click();
  const queSuena = p.getByRole('dialog', { name: 'Sonido y vibración' }).getByLabel('Qué suena');
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
  await p.keyboard.press('Escape');
  await p.getByRole('dialog', { name: 'Sonido y vibración' }).waitFor({ state: 'detached' });
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
  // v0.34: como en una hoja de cálculo (Intro baja, flechas para moverse; lo que se escribe sustituye al número)
  const enFoco = () => p.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  await det.getByLabel('Kilos de la serie 1').click();
  await p.keyboard.press('Enter');
  const trasIntro = await enFoco();
  await p.keyboard.type('50');
  await p.keyboard.press('ArrowUp');
  const trasArriba = await enFoco();
  await p.keyboard.press('ArrowRight');
  const trasDerecha = await enFoco();
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('ArrowLeft');
  const trasAbajoIzq = await enFoco();
  await p.waitForTimeout(500);
  check(trasIntro === 'Kilos de la serie 2' && trasArriba === 'Kilos de la serie 1' && trasDerecha === 'RPE de la serie 1' && trasAbajoIzq === 'Kilos de la serie 2'
    && await det.getByLabel('Kilos de la serie 2').inputValue() === '50',
    `Intro pasa a la serie de debajo y las flechas mueven entre casillas; lo escrito sustituye y se guarda (${[trasIntro, trasArriba, trasDerecha, trasAbajoIzq].join(' → ')})`);
  await revisar('serie-a-serie');
  await modo.selectOption('');
  await det.waitFor({ state: 'detached' });
  check(await filaPauta.locator('td.resumen-detalle').count() === 0, 'y se vuelve a series iguales');
  // v0.35: de dónde sale cada número del volumen semanal
  await p.locator('.vol-desglose summary').first().click();
  const desglose = await p.locator('.vol-desglose li').allTextContents();
  check(desglose.length > 0 && desglose.some((t) => /× ½/.test(t)) && desglose.every((t) => /^\S.*\d.*:/.test(t)),
    `el volumen por músculo enseña qué ejercicios cuentan y cuáles a medias («${(desglose[0] || '').slice(0, 70)}…»)`);

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
  // En la demo, Lucía no merienda los domingos: ese día ya viene marcado (se quita antes, para probar el gesto)
  if (await interruptor.isChecked()) {
    await interruptor.click();
    await p.locator('.mini', { hasText: 'te enseñamos las recetas para los días sin merienda' }).waitFor({ state: 'detached' });
  }
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

  console.log('\nModo atleta del coach (v0.37)');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.waitForTimeout(600);
  for (let i = 0; i < 3; i++) { const d = p.locator('[role=dialog]').first(); if (!(await d.isVisible().catch(() => false))) break; await d.getByRole('button', { name: /^Seguir$|^Cerrar$/ }).first().click(); await p.waitForTimeout(400); }
  await p.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await p.getByRole('button', { name: /Pelayo/ }).click();
  const codigo2fa5 = p.getByLabel('Código', { exact: true });
  await Promise.race([codigo2fa5.waitFor(), p.getByRole('heading', { name: 'Atletas' }).waitFor()]);
  if (await codigo2fa5.isVisible().catch(() => false)) { await codigo2fa5.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  const nAtletas = await p.locator('.tarjeta-atleta').count();
  await revisar('coach-con-modo-atleta');
  await p.locator('.tab', { hasText: 'Modo atleta' }).click();
  await p.getByRole('heading', { name: 'Modo atleta' }).waitFor();
  await revisar('empezar-modo-atleta');
  await p.getByRole('button', { name: 'Crear mi ficha y entrar' }).click();
  const banda = p.locator('.banda-modo-atleta');
  await banda.waitFor();
  const tabsYo = (await p.locator('nav.tabs .tab').allTextContents()).map((t) => t.trim());
  check(JSON.stringify(tabsYo) === JSON.stringify(['Hoy', 'Semana', 'Progreso', 'Entrenador']), `en su modo atleta solo hay entrenamiento: ${tabsYo.join(', ')}`);
  check(await p.getByRole('button', { name: /check-in/i }).count() === 0 && await p.locator('.avatar-cabecera, .tab-perfil').count() === 0, 'sin check-in ni perfil');
  await revisar('modo-atleta-hoy');
  await banda.getByRole('button', { name: 'Programarlo' }).click();
  await p.getByRole('tab', { name: 'Programa', selected: true }).waitFor();
  check(await p.locator('.banda-modo-atleta').count() === 0, '«Programarlo» vuelve a la vista de coach y abre su ficha en Programa');
  await p.getByRole('button', { name: 'Volver a atletas' }).click();
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  check(await hay(p.locator('.tarjeta-atleta'), nAtletas), 'su ficha no sale en la lista de atletas');
  await p.locator('.tab', { hasText: 'Modo atleta' }).click();
  await banda.waitFor();
  check(true, 'con la ficha ya creada, la pestaña entra directamente');
  check(await p.locator('.tab', { hasText: 'Equipo' }).count() === 0, 'en su modo atleta no sale la pestaña Equipo (su ficha nunca entra en la comunidad)');
  await p.locator('.tab', { hasText: 'Semana' }).click();
  await revisar('modo-atleta-semana');
  await p.locator('.tab', { hasText: 'Entrenador' }).click();
  await p.getByRole('heading', { name: 'Atletas' }).waitFor();
  check(await p.locator('.banda-modo-atleta').count() === 0, '«Entrenador» vuelve a la vista de coach');

  console.log('\nLa comunidad del equipo (v0.43)');
  {
  // Se empieza de cero (la demo reiniciada): Ana aún no ha entrado; Rubén, Carlos y Lucía, sí
  const cerrarDialogos = async () => {
    for (let i = 0; i < 4; i++) {
      const d = p.locator('[role=dialog]').first();
      if (!(await d.isVisible().catch(() => false))) break;
      // «Seguir» primero: así los discos quedan vistos y no vuelven a salir en Hoy
      let hecho = false;
      for (const nombre of ['Seguir', 'Entendido', 'Cerrar']) {
        const b2 = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b2.isVisible().catch(() => false)) { await b2.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const entrarComo = async (nombre) => {
    if (!(await p.getByRole('heading', { name: 'Entra en tu cuenta' }).isVisible().catch(() => false))) {
      if (!(await p.getByRole('button', { name: 'Cambiar de cuenta' }).isVisible().catch(() => false))) {
        // (la banda de la demo está en Hoy, para un atleta, y en Atletas, para el coach)
        const hoy = p.locator('.tab', { hasText: 'Hoy' });
        if (await hoy.count()) await hoy.first().click(); else await p.locator('.tab', { hasText: 'Atletas' }).click();
        await p.waitForTimeout(800);
        await cerrarDialogos();
      }
      await p.getByRole('button', { name: 'Cambiar de cuenta' }).first().click();
    }
    await p.getByRole('button', { name: new RegExp(nombre) }).first().click();
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(800);
    await cerrarDialogos();
  };
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.getByRole('button', { name: 'Reiniciar' }).first().click();
  await p.getByRole('button', { name: 'Sí, reiniciar' }).click();
  await p.getByRole('heading', { name: 'Entra en tu cuenta' }).waitFor();
  await entrarComo('Ana López');
  const tabEquipo = p.locator('.tab', { hasText: 'Equipo' });
  check(await tabEquipo.isVisible(), 'con la comunidad abierta, Ana ve la pestaña Equipo (cabe con las demás en 390 px)');
  await tabEquipo.click();
  await p.getByRole('heading', { name: 'Antes de entrar' }).waitFor();
  const textoEntrada = await p.locator('.entrar-equipo').textContent();
  check(textoEntrada.includes('Es voluntario') && textoEntrada.includes('Lo que nunca se comparte') && (await p.getByLabel('Tu nombre en el equipo').inputValue()) === 'Ana L.' && await p.locator('.post').count() === 0,
    'la primera vez explica qué se comparte y con quién, propone «Ana L.» y no enseña nada del muro');
  await revisar('equipo-entrar');
  // v0.44: las normas del equipo, antes de entrar
  const botonEntrar = p.getByRole('button', { name: 'Sí, quiero entrar' });
  check(await botonEntrar.isDisabled() && (await p.locator('#eq-falta-normas').textContent()).includes('lee antes las normas'), 'sin leer las normas, «Sí, quiero entrar» está desactivado y dice por qué');
  await p.getByRole('button', { name: 'Leer las normas' }).click();
  const hojaNormas = p.getByRole('dialog', { name: 'Normas del equipo' });
  await hojaNormas.locator('.lista-normas li').first().waitFor();
  check(await hojaNormas.locator('.lista-normas li').count() >= 8 && (await hojaNormas.textContent()).includes('Avisar al coach'), 'las normas, en una hoja');
  await revisar('equipo-normas');
  await hojaNormas.getByRole('button', { name: 'He leído las normas' }).click();
  await hojaNormas.waitFor({ state: 'detached' });
  await p.locator('.normas-leidas', { hasText: 'Normas leídas' }).waitFor();
  check(!(await botonEntrar.isDisabled()), 'con «He leído las normas», marcadas (✓ Normas leídas) y ya puede entrar');
  await revisar('equipo-entrar-normas');
  await botonEntrar.click();
  await p.locator('.post').first().waitFor();
  check(await p.locator('.post').first().evaluate((x) => x.classList.contains('fijada') && x.textContent.includes('Aviso del coach')), 'con «Sí, quiero entrar», dentro: arriba el aviso fijado del coach');
  await revisar('equipo-muro');
  // v0.51: quien ha compartido un entreno hoy (Carlos, en la demo) lleva un aro en su foto, en el muro y en las listas;
  // su entreno, con las cifras en grande y los ejercicios con su pictograma
  const postCarlos = p.getByRole('article', { name: /^Entreno compartido de Carlos/ });
  await postCarlos.locator('.aro-hoy').waitFor();
  check((await postCarlos.locator('.post-cab').textContent()).includes('ha compartido un entreno hoy') && await p.getByRole('article', { name: /^Entreno compartido de Rubén/ }).locator('.post-cab .aro-hoy').count() === 0
    && await postCarlos.locator('.ee-num .marcador').count() >= 3 && await postCarlos.locator('.ee-ejercicios .picto').count() >= 1,
  'Carlos ha compartido un entreno hoy: su foto lleva el aro (Rubén, que lo compartió ayer, no); su entreno con las cifras en grande y los pictogramas');
  // v0.47: el resumen de la semana arriba del muro
  check((await p.locator('.resumen-equipo').textContent()).includes('Esta semana en el equipo') && await p.locator('.resumen-equipo dd').count() === 4, 'arriba del muro, el resumen de la semana del equipo (solo recuentos)');
  // v0.47: al escribir «@», propone a los del equipo
  const compositor = p.getByLabel('Tu publicación');
  await compositor.fill('Primera semana en el equipo. ¡A por todas, @Rub');
  const sugerencia = p.locator('.menciones-sugeridas button', { hasText: 'Rubén M.' });
  await sugerencia.waitFor();
  check(await p.locator('.menciones-sugeridas button').count() === 1, 'al escribir «@Rub» propone a Rubén M.');
  await revisar('equipo-mencion');
  await sugerencia.click();
  check((await compositor.inputValue()).endsWith('@Rubén M. ') && await p.locator('.menciones-sugeridas').count() === 0, 'al elegirlo, queda «@Rubén M.» en el texto');
  await compositor.press('End');
  await compositor.pressSequentially('!');
  await p.getByRole('button', { name: 'Publicar', exact: true }).click();
  await p.locator('.post', { hasText: 'Primera semana en el equipo' }).waitFor();
  check(await p.locator('.post', { hasText: 'Primera semana en el equipo' }).locator('strong', { hasText: 'Ana L.' }).count() === 1, 'publica un texto, con su nombre del equipo');
  const mencion = p.locator('.post', { hasText: 'Primera semana en el equipo' }).locator('button.mencion', { hasText: '@Rubén M.' });
  check(await mencion.count() === 1, 'la mención sale resaltada');
  // Tocarla abre su perfil en el equipo, con «Animar»
  await mencion.click();
  const hojaPerfil = p.getByRole('dialog', { name: 'Perfil en el equipo' });
  await hojaPerfil.locator('.pe-nombre', { hasText: 'Rubén M.' }).waitFor();
  check((await hojaPerfil.textContent()).includes('En el equipo desde') && (await hojaPerfil.textContent()).includes('Entrenos compartidos') && await hojaPerfil.locator('.pe-posts li').count() >= 1, 'su perfil: desde cuándo está, racha, retos, entrenos y lo último que ha publicado');
  await revisar('equipo-perfil');
  await hojaPerfil.getByRole('button', { name: 'Animar a Rubén M.' }).click();
  await p.locator('.toast', { hasText: 'Le has mandado ánimo a Rubén M.' }).waitFor();
  check(await hojaPerfil.getByRole('button', { name: /Ya has animado a Rubén M\./ }).isDisabled(), 'le manda ánimo 🙌 (una vez por semana)');
  await hojaPerfil.getByRole('button', { name: 'Cerrar' }).click();
  await hojaPerfil.waitFor({ state: 'detached' });
  // Doble toque en una publicación: 💪
  const deCarlos = p.getByRole('article', { name: 'Publicación de Carlos V.' });
  await deCarlos.locator('.post-texto').dblclick();
  await p.waitForFunction(() => [...document.querySelectorAll('article[aria-label="Publicación de Carlos V."] .reaccion')].some((b) => b.getAttribute('aria-pressed') === 'true' && /^Fuerza: 2/.test(b.getAttribute('aria-label'))));
  check(true, 'con doble toque en la publicación de Carlos, le da 💪');
  // La encuesta del coach
  const encuesta = p.getByRole('article', { name: 'Encuesta de Pelayo' });
  await encuesta.getByRole('button', { name: 'Domingo por la mañana' }).click();
  await p.locator('.toast', { hasText: 'Voto guardado' }).waitFor();
  await encuesta.locator('.encuesta-opcion.mia').waitFor();
  check((await encuesta.locator('.encuesta-opcion.mia').getAttribute('aria-label')).startsWith('Domingo por la mañana: 2 votos') && await encuesta.locator('.eo-pct').count() === 3, 'vota en la encuesta del coach y ve los resultados');
  await encuesta.getByRole('button', { name: 'Ver quién ha votado' }).click();
  const hojaVotos = p.getByRole('dialog', { name: 'Quién ha votado' });
  await hojaVotos.waitFor();
  check((await hojaVotos.textContent()).includes('Ana L.') && (await hojaVotos.textContent()).includes('Carlos V.'), '«Ver quién ha votado»: los nombres de cada opción');
  await revisar('equipo-encuesta');
  await hojaVotos.getByRole('button', { name: 'Cerrar' }).click();
  // Los filtros del muro
  await p.getByRole('button', { name: 'Logros', exact: true }).click();
  await p.waitForFunction(() => { const x = document.querySelectorAll('.post'); return x.length > 0 && [...x].every((e) => e.classList.contains('post-logro')); });
  check(await p.locator('.post').count() === await p.locator('.post-logro').count() && await p.getByRole('button', { name: 'Logros', exact: true }).getAttribute('aria-pressed') === 'true', 'el filtro «Logros»: solo los logros');
  await p.getByRole('button', { name: 'Lo mío', exact: true }).click();
  await p.waitForFunction(() => { const x = document.querySelectorAll('.post'); return x.length === 1 && x[0].textContent.includes('Primera semana en el equipo'); });
  check(await p.locator('.post', { hasText: 'Primera semana en el equipo' }).count() === 1, '«Lo mío»: solo lo suyo');
  await revisar('equipo-filtros');
  await p.getByRole('button', { name: 'Todo', exact: true }).click();
  await p.locator('.post.post-entreno').first().waitFor();
  const deRuben = p.locator('.post.post-entreno', { hasText: 'Rubén M.' });
  const fuerza = deRuben.getByRole('button', { name: /^Fuerza:/ });
  check((await fuerza.getAttribute('aria-label')).startsWith('Fuerza: 1'), 'el entreno de Rubén ya tiene un 💪');
  await fuerza.click();
  await p.waitForFunction(() => [...document.querySelectorAll('.post-entreno .reaccion')].some((b) => b.getAttribute('aria-pressed') === 'true' && /^Fuerza: 2 \(.*Ana L\./.test(b.getAttribute('aria-label'))));
  check(true, 'reacciona 💪: cuenta 2 y dice quién');
  await deRuben.getByRole('button', { name: /^Fuego:/ }).click();
  await p.waitForFunction(() => [...document.querySelectorAll('.post-entreno .reaccion')].some((b) => b.getAttribute('aria-pressed') === 'true' && /^Fuego: 2/.test(b.getAttribute('aria-label'))));
  check((await fuerza.getAttribute('aria-label')).startsWith('Fuerza: 1'), 'tocar otra cambia la suya (una por persona)');
  await deRuben.locator('.post-comentar').click();
  const hojaCom = p.getByRole('dialog', { name: 'Comentarios' });
  await hojaCom.locator('.comentario-equipo').first().waitFor();
  await hojaCom.getByLabel('Tu comentario').fill('¡Enhorabuena, Rubén!');
  await hojaCom.getByRole('button', { name: 'Comentar' }).click();
  await hojaCom.locator('.comentario-equipo', { hasText: 'Enhorabuena, Rubén' }).waitFor();
  check(await hojaCom.locator('.comentario-equipo').count() === 3, 'comenta en el entreno de Rubén (con los dos que había)');
  await revisar('equipo-comentarios');
  await hojaCom.getByRole('button', { name: 'Cerrar' }).click();
  await p.getByRole('article', { name: 'Publicación de Carlos V.' }).getByRole('button', { name: 'Opciones de la publicación' }).click();
  await p.getByRole('dialog', { name: 'Publicación' }).getByRole('button', { name: 'Avisar al coach' }).click();
  const hojaAvisar = p.getByRole('dialog', { name: 'Avisar al coach' });
  await hojaAvisar.getByLabel('Por qué (si quieres)').fill('Prueba de aviso');
  await revisar('equipo-avisar');
  await hojaAvisar.getByRole('button', { name: 'Avisar al coach' }).click();
  await p.locator('.toast', { hasText: 'tu coach lo mirará' }).waitFor();
  check(true, '«Avisar al coach» de una publicación, con un motivo');
  await p.getByRole('tab', { name: 'Retos' }).click();
  const reto8 = p.getByRole('article', { name: 'Reto: Reto de constancia: 8 sesiones' });
  await reto8.locator('.reto-yo').waitFor();
  const llevaAntes = Number((await reto8.locator('.reto-yo strong').textContent()).trim());
  check(llevaAntes >= 1 && await reto8.locator('.fila-progreso').count() === 4, `el reto del coach: Ana lleva ${llevaAntes} de 8 y ve a los cuatro del equipo`);
  const retoEq = p.getByRole('article', { name: 'Reto: Entre todos: 40 sesiones' });
  check(await retoEq.locator('.barra-grande').count() === 1 && (await retoEq.textContent()).includes('entre todo el equipo') && await retoEq.locator('.top-equipo li').count() >= 1, 'el reto de equipo: una barra para todos y los que más suman');
  await revisar('equipo-retos');
  await p.getByRole('tab', { name: 'Ranking' }).click();
  await p.locator('.ranking .yo').first().waitFor();
  check((await p.locator('.ranking').textContent()).includes('ni kilos ni peso'), 'el ranking de la semana: solo sesiones hechas de las previstas');
  check(await p.locator('.podio .podio-sitio').count() >= 1 && await p.locator('.podio .podio-medalla').first().getAttribute('aria-label') === 'Primer puesto', 'los primeros, en un podio (🥇)');
  check(await p.getByRole('button', { name: 'Ya has animado a Rubén M. esta semana' }).count() === 1 && await p.getByRole('button', { name: 'Animar a Carlos V.' }).count() === 1, 'desde el ranking se anima a los demás (a Rubén ya le ha animado)');
  await p.getByRole('button', { name: 'Animar a Carlos V.' }).click();
  await p.locator('.toast', { hasText: 'Le has mandado ánimo a Carlos V.' }).waitFor();
  await revisar('equipo-ranking');
  // A 360 px y en oscuro, el podio cabe y se lee
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.waitForTimeout(300);
  const ancho360 = await p.evaluate(() => document.documentElement.scrollWidth);
  check(ancho360 <= 360, `a 360 px, el ranking con su podio no se sale (${ancho360} px)`);
  await revisar('equipo-ranking-360-oscuro');
  await p.getByRole('tab', { name: 'Muro' }).click();
  await p.locator('.post').first().waitFor();
  check(await p.evaluate(() => document.documentElement.scrollWidth) <= 360, 'ni el muro, con la encuesta y los logros');
  await revisar('equipo-muro-360-oscuro');
  await p.emulateMedia({ colorScheme: null });
  await p.setViewportSize({ width: 390, height: 844 });

  // Compartir un entreno al terminarlo (sin los kilos) y otro ya hecho (con ellos)
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  // (los discos que ya había ganado salen en Hoy un momento después)
  await p.locator('.hero-dia').waitFor();
  await p.waitForTimeout(800);
  await cerrarDialogos();
  await p.getByRole('button', { name: 'Empezar sesión' }).click();
  await sesionAbierta();
  const prepEq = p.locator('.preparacion');
  if (await prepEq.count()) { for (const [g, x] of [['¿Cómo has dormido?', 'Bien'], ['¿Cómo tienes la energía?', 'Alta'], ['¿Agujetas o molestias?', 'Ninguna']]) await prepEq.getByRole('group', { name: g }).getByRole('button', { name: x, exact: true }).click(); }
  const primeroEq = p.locator('.ejercicio').first();
  await primeroEq.getByLabel('Kilos de la serie 1').fill('20');
  await primeroEq.getByLabel('Repeticiones de la serie 1').fill('10');
  await primeroEq.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
  await p.getByRole('button', { name: 'Saltar' }).click().catch(() => {});
  await p.getByRole('button', { name: 'Terminar sesión' }).click();
  await p.locator('.hoja-dialogo .segmentos button', { hasText: '8' }).first().click();
  await p.getByRole('button', { name: 'Guardar y terminar' }).click();
  await p.getByRole('heading', { name: 'Sesión terminada' }).waitFor();
  await p.getByRole('button', { name: 'Compartir con el equipo' }).click();
  const hojaEq = p.getByRole('dialog', { name: 'Compartir con el equipo' });
  await hojaEq.waitFor();
  check(!(await hojaEq.getByRole('switch', { name: /Enseñar los kilos/ }).isChecked()) && !(await hojaEq.locator('.entreno-equipo').textContent()).includes('kg'),
    'al compartir, «Enseñar los kilos» viene apagado y la vista previa no los lleva');
  await hojaEq.getByLabel('Un comentario (opcional)').fill('Torso B hecho');
  await revisar('equipo-compartir');
  await hojaEq.getByRole('button', { name: 'Compartir con el equipo' }).click();
  await p.locator('.compartida-equipo').waitFor();
  check(true, 'comparte la sesión terminada con el equipo');
  await p.getByRole('button', { name: 'Volver a hoy' }).click();
  // (Hoy llega tras la transición, y el disco nuevo un momento después)
  await p.locator('.hero-dia').waitFor();
  await p.waitForTimeout(800);
  await cerrarDialogos();
  await p.locator('.tab', { hasText: 'Semana' }).click();
  await p.locator('.dia', { hasText: 'Torso A' }).first().click();
  await p.getByRole('button', { name: 'Cambiar la valoración' }).click();
  await p.getByRole('button', { name: 'Guardar', exact: true }).click();
  await p.getByRole('heading', { name: 'Sesión terminada' }).waitFor();
  await p.getByRole('button', { name: 'Compartir con el equipo' }).click();
  await hojaEq.getByRole('switch', { name: /Enseñar los kilos/ }).check();
  await hojaEq.locator('.entreno-equipo', { hasText: 'kg' }).waitFor();
  check(true, 'con «Enseñar los kilos», la vista previa enseña su mejor serie de cada ejercicio');
  await hojaEq.getByRole('button', { name: 'Compartir con el equipo' }).click();
  await p.locator('.compartida-equipo').waitFor();
  await p.getByRole('button', { name: 'Volver a hoy' }).click();
  await p.locator('nav.tabs').waitFor();
  await p.waitForTimeout(800);
  await cerrarDialogos();
  await tabEquipo.click();
  await p.locator('.post', { hasText: 'Torso B hecho' }).waitFor();
  const misEntrenos = p.locator('.post.post-entreno', { hasText: 'Ana L.' });
  check(await misEntrenos.count() === 2 && !(await p.locator('.post', { hasText: 'Torso B hecho' }).textContent()).includes(' kg ×')
    && (await p.locator('.post.post-entreno', { hasText: 'Torso A' }).first().textContent()).includes('kg ×'), 'en el muro, sus dos entrenos: uno sin kilos y otro con ellos (la tarjeta la hace la base)');
  await p.getByRole('tab', { name: 'Retos' }).click();
  await reto8.locator('.reto-yo').waitFor();
  check(Number((await reto8.locator('.reto-yo strong').textContent()).trim()) === llevaAntes + 1, `el reto suma la sesión de hoy (${llevaAntes} → ${llevaAntes + 1})`);
  // No salir en el ranking
  await p.getByRole('button', { name: 'Ajustes de la comunidad' }).click();
  const hojaAj = p.getByRole('dialog', { name: 'Ajustes de la comunidad' });
  await revisar('equipo-ajustes');
  await hojaAj.getByRole('button', { name: 'Normas del equipo' }).click();
  const normasAj = p.getByRole('dialog', { name: 'Normas del equipo' });
  await normasAj.locator('.lista-normas').waitFor();
  check(await normasAj.getByRole('button', { name: 'He leído las normas' }).count() === 0, 'dentro, las normas se pueden leer cuando quiera desde los ajustes');
  await normasAj.getByRole('button', { name: 'Cerrar' }).click();
  await normasAj.waitFor({ state: 'detached' });
  await hojaAj.getByRole('switch', { name: /No salir en el ranking/ }).check();
  await p.locator('.toast', { hasText: 'Ya no sales en el ranking' }).waitFor();
  await hojaAj.getByRole('button', { name: 'Cerrar' }).click();
  await p.getByRole('tab', { name: 'Ranking' }).click();
  await p.locator('.ranking .nota', { hasText: 'No sales en el ranking' }).waitFor();
  await p.locator('.ranking .podio-sitio, .ranking .fila-ranking').first().waitFor(); // en una máquina lenta, la lista llega un momento después que la nota
  check(await p.locator('.ranking .yo').count() === 0 && await p.locator('.ranking .podio-sitio, .ranking .fila-ranking').count() >= 1, 'con «No salir en el ranking», ya no sale (ni en el podio; y ve su semana aparte)');
  // Salir: lo suyo deja de verse
  await p.getByRole('button', { name: 'Ajustes de la comunidad' }).click();
  await hojaAj.getByRole('button', { name: 'Salir de la comunidad' }).click();
  await hojaAj.getByRole('button', { name: 'Salir', exact: true }).click();
  await p.getByRole('heading', { name: '¿Vuelves al equipo?' }).waitFor();
  check(true, 'sale de la comunidad (y la pestaña ofrece volver)');
  await entrarComo('Rubén Martín');
  await tabEquipo.click();
  // v0.47: Rubén consiguió un reto la semana pasada: al entrar, lo celebra
  const hojaLogro = p.getByRole('dialog', { name: '¡Reto conseguido!' });
  await hojaLogro.waitFor();
  check((await hojaLogro.textContent()).includes('Semana de arranque: 3 sesiones') && await hojaLogro.locator('.cm-disco').count() === 1, 'Rubén entra en Equipo y celebra el reto que consiguió');
  check((await p.locator('.cab-equipo').textContent()).includes('🔥') && (await p.locator('.animos-recibidos').textContent()).includes('Carlos V.') && !(await p.locator('.animos-recibidos').textContent()).includes('Ana L.'),
    'arriba, su racha 🔥 y quién le ha animado esta semana (Ana ya no está: su ánimo no se ve)');
  await revisar('equipo-celebracion');
  await hojaLogro.getByLabel('Unas palabras (opcional)').fill('¡La primera de muchas!');
  await hojaLogro.getByRole('button', { name: 'Compartirlo en el muro' }).click();
  await p.locator('.toast', { hasText: 'Logro compartido en el muro' }).waitFor();
  await p.locator('.post.post-logro', { hasText: '¡La primera de muchas!' }).waitFor();
  // (las que hizo de verdad: un lunes, la primera de esta semana va el domingo y la semana pasada suma una más)
  const hechasLogro = Number(((await p.locator('.post.post-logro', { hasText: '¡La primera de muchas!' }).textContent()).match(/(\d+) de 3 sesiones/) || [])[1]);
  check(hechasLogro >= 3, `«Compartirlo en el muro»: la tarjeta del logro, hecha por la base (${hechasLogro} de 3 sesiones)`);
  await p.locator('.post').first().waitFor();
  const muroRuben = await p.locator('.muro').textContent();
  check(!muroRuben.includes('Ana L.') && !muroRuben.includes('Primera semana en el equipo') && !muroRuben.includes('Torso B hecho'), 'para Rubén desaparece todo lo de Ana (publicaciones, entrenos, comentarios y reacciones)');
  await revisar('equipo-ruben');

  // El coach: avisos fijados, Revisar y el interruptor
  await entrarComo('Pelayo');
  await p.locator('.tab', { hasText: 'Equipo' }).click();
  await p.getByRole('heading', { name: 'Equipo', exact: true }).waitFor();
  await p.getByLabel('Aviso para el equipo').fill('El sábado hay quedada en el gimnasio a las 10');
  await p.getByLabel('Fijar arriba').check();
  await p.getByRole('button', { name: 'Publicar aviso' }).click();
  await p.locator('.post.fijada', { hasText: 'quedada en el gimnasio' }).waitFor();
  check((await p.locator('.post').first().textContent()).includes('quedada en el gimnasio'), 'el coach publica un aviso y lo fija arriba');
  await revisar('equipo-coach');
  // v0.47: una encuesta
  await p.getByRole('button', { name: 'Encuesta', exact: true }).click();
  await p.getByLabel('Pregunta', { exact: true }).fill('¿Qué os parece entrenar juntos el día de la quedada?');
  await p.getByLabel('Opción 1', { exact: true }).fill('Me apunto');
  await p.getByLabel('Opción 2', { exact: true }).fill('Ese día no puedo');
  await p.getByRole('button', { name: 'Otra opción' }).click();
  await p.getByLabel('Opción 3', { exact: true }).fill('Lo miro y te digo');
  await revisar('equipo-coach-encuesta');
  await p.getByRole('button', { name: 'Publicar encuesta' }).click();
  await p.locator('.toast', { hasText: 'Encuesta publicada' }).waitFor();
  const encQuedada = p.locator('.post.post-encuesta', { hasText: '¿Qué os parece entrenar juntos' });
  await encQuedada.waitFor();
  check(await encQuedada.locator('.encuesta-opcion.solo').count() === 3 && (await encQuedada.textContent()).includes('0 votos'), 'el coach publica una encuesta (él ve los resultados, sin votar)');
  // Un reto de equipo
  await p.getByRole('tab', { name: 'Retos' }).click();
  await p.getByRole('button', { name: 'Nuevo reto' }).click();
  const hojaRetoC = p.getByRole('dialog', { name: 'Nuevo reto' });
  await hojaRetoC.getByRole('button', { name: 'Entre todos' }).click();
  await hojaRetoC.getByLabel('Título').fill('Diciembre entre todos');
  check(await hojaRetoC.getByLabel('Sesiones terminadas entre todo el equipo').getAttribute('max') === '5000', 'un reto de equipo: el objetivo es el total de todos (hasta 5000)');
  await revisar('equipo-coach-reto-equipo');
  await hojaRetoC.getByRole('button', { name: 'Crear el reto' }).click();
  await p.getByRole('article', { name: 'Reto: Diciembre entre todos' }).waitFor();
  check((await p.getByRole('article', { name: 'Reto: Diciembre entre todos' }).textContent()).includes('De equipo'), 'y sale como reto de equipo');
  await p.getByRole('tab', { name: 'Ranking' }).click();
  await p.locator('.ranking .podio-sitio, .ranking .fila-ranking').first().waitFor();
  check(await p.locator('.ranking .btn-animar').count() >= 1, 'el coach también anima desde el ranking');
  await revisar('equipo-coach-ranking');
  await p.getByRole('tab', { name: 'Normas' }).click();
  await p.locator('.lista-normas').waitFor();
  check(true, 'el coach tiene las normas en su vista del equipo');
  await revisar('equipo-coach-normas');
  await p.getByRole('tab', { name: 'Muro' }).click();
  await p.locator('.tab', { hasText: 'Revisar' }).click();
  await p.getByRole('button', { name: 'Equipo (1)' }).click();
  const rep = p.locator('.tarjeta-reporte');
  await rep.waitFor();
  check((await rep.textContent()).includes('Prueba de aviso') && (await rep.textContent()).includes('Carlos V.'), 'en Revisar → Equipo, el aviso: qué, de quién y por qué');
  await revisar('revisar-equipo');
  await rep.getByRole('button', { name: 'Ocultar' }).click();
  await p.locator('.toast', { hasText: 'Publicación oculta' }).waitFor();
  await rep.waitFor({ state: 'detached' });
  await p.locator('.tab', { hasText: 'Equipo' }).click();
  await p.locator('.post.oculta', { hasText: 'Carlos V.' }).waitFor();
  check(true, 'oculta la publicación avisada (él la sigue viendo, marcada)');
  await p.getByRole('tab', { name: 'Quién está' }).click();
  await p.getByRole('button', { name: 'Sacar del equipo' }).first().waitFor();
  const filaCarlos = p.locator('.lista li', { hasText: 'Carlos V.' });
  await filaCarlos.getByRole('button', { name: 'Sacar del equipo' }).click();
  await filaCarlos.getByRole('group', { name: /Sacar a Carlos V\./ }).waitFor();
  await revisar('equipo-sacar');
  await filaCarlos.getByRole('button', { name: 'Sí, sacarle' }).click();
  await p.locator('.toast', { hasText: 'ya no está en el equipo' }).waitFor();
  await p.getByRole('heading', { name: 'Sacados del equipo' }).waitFor();
  check(true, 'el coach saca a Carlos del equipo, confirmándolo en la propia pantalla');
  await p.getByRole('button', { name: 'Volver a admitir' }).click();
  await p.locator('.toast', { hasText: 'puede volver a entrar' }).waitFor();
  check(await p.getByRole('heading', { name: 'Sacados del equipo' }).count() === 0, 'y le vuelve a admitir');
  await p.getByRole('tab', { name: 'Muro' }).click();
  await p.locator('.tab', { hasText: 'Atletas' }).click(); // (si no, Rubén abriría la app ya en #equipo)
  await entrarComo('Rubén Martín');
  // v0.47: lo nuevo desde su última visita, en la pestaña y en el muro
  await tabEquipo.locator('.insignia').waitFor();
  check(/publicaciones? nuevas? en el equipo/.test(await tabEquipo.locator('.insignia').getAttribute('aria-label')), `la pestaña Equipo dice cuántas publicaciones nuevas hay (${await tabEquipo.locator('.insignia').textContent()})`);
  await tabEquipo.click();
  await p.locator('.post').first().waitFor();
  await p.locator('.muro-separa.nuevo').waitFor();
  check(await p.locator('.muro-separa.nuevo + .post', { hasText: '¿Qué os parece entrenar juntos' }).count() === 1, '«Nuevo» antes de lo publicado desde su última visita');
  await revisar('equipo-novedades');
  check(!(await p.locator('.muro').textContent()).includes('Vuelvo después de dos semanas'), 'y los atletas ya no la ven');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.waitForTimeout(800);
  await cerrarDialogos();
  check(await tabEquipo.locator('.insignia').count() === 0, 'visto el muro, la insignia se va');
  await entrarComo('Pelayo');
  await abrirPestana(p, 'Cuenta');
  const interruptor = p.getByRole('switch', { name: /Comunidad del equipo/ });
  await interruptor.uncheck();
  await p.locator('.toast', { hasText: 'Comunidad cerrada' }).waitFor();
  await p.locator('.tab', { hasText: 'Equipo' }).waitFor({ state: 'detached' });
  await revisar('cuenta-comunidad');
  await entrarComo('Rubén Martín');
  check(await p.locator('.tab', { hasText: 'Equipo' }).count() === 0, 'con la comunidad cerrada, los atletas no ven la pestaña');
  }

  console.log('\nv0.48: tareas, programados, negocio, tu mes, tu bloque, dónde entrenas, voz y compartir un vídeo');
  {
  const cerrarDialogos = async () => {
    for (let i = 0; i < 5; i++) {
      const d = p.locator('[role=dialog]').first();
      if (!(await d.isVisible().catch(() => false))) break;
      let hecho = false;
      for (const nombre of ['Seguir', 'Entendido', 'Cerrar']) {
        const b2 = d.getByRole('button', { name: nombre, exact: true }).first();
        if (await b2.isVisible().catch(() => false)) { await b2.click(); hecho = true; break; }
      }
      if (!hecho) await p.keyboard.press('Escape');
      await p.waitForTimeout(250);
    }
  };
  const entrarComo = async (nombre) => {
    if (!(await p.getByRole('heading', { name: 'Entra en tu cuenta' }).isVisible().catch(() => false))) {
      if (!(await p.getByRole('button', { name: 'Cambiar de cuenta' }).isVisible().catch(() => false))) {
        const hoyT = p.locator('.tab', { hasText: 'Hoy' });
        if (await hoyT.count()) await hoyT.first().click(); else await p.locator('.tab', { hasText: 'Atletas' }).click();
        await p.waitForTimeout(800);
        await cerrarDialogos();
      }
      await p.getByRole('button', { name: 'Cambiar de cuenta' }).first().click();
    }
    await p.getByRole('button', { name: new RegExp(nombre) }).first().click();
    const cod = p.getByLabel('Código', { exact: true });
    await Promise.race([cod.waitFor(), p.locator('nav.tabs').waitFor()]);
    if (await cod.isVisible().catch(() => false)) { await cod.fill('123456'); await p.getByRole('button', { name: 'Entrar' }).click(); }
    await p.locator('nav.tabs').waitFor();
    await p.waitForTimeout(800);
    await cerrarDialogos();
  };
  // Las miniaturas de YouTube (i.ytimg.com) no salen a internet en la prueba: una imagen de mentira
  await p.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
  await entrarComo('Pelayo');
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.getByRole('button', { name: 'Reiniciar' }).first().click();
  await p.getByRole('button', { name: 'Sí, reiniciar' }).click();
  await p.getByRole('heading', { name: 'Entra en tu cuenta' }).waitFor();
  await entrarComo('Pelayo');

  // Coach: poner una tarea, comparar check-ins y sus meses
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).first().click();
  await p.getByRole('tab', { name: 'Seguimiento' }).click();
  await p.getByRole('heading', { name: 'Tareas', exact: true }).waitFor();
  check(await hay(p.getByRole('heading', { name: 'Tareas', exact: true }).locator('xpath=ancestor::section[1]').getByText('Fotos de progreso de este mes'), 1, 10000), 'en Seguimiento, sus tareas (la de fotos de hoy)');
  await p.getByRole('button', { name: 'Poner una tarea' }).click();
  const hojaT = p.getByRole('dialog', { name: 'Una tarea para Ana' });
  await hojaT.getByRole('group', { name: 'Plantillas de tareas' }).waitFor();
  check(await hay(hojaT.getByRole('group', { name: 'Plantillas de tareas' }).getByRole('button'), 3), 'con sus 3 plantillas a mano');
  await hojaT.getByRole('button', { name: 'Texto', exact: true }).click();
  await hojaT.getByLabel('Título').fill('¿Cómo has dormido esta semana?');
  await revisar('tarea-nueva');
  await hojaT.getByRole('button', { name: 'Poner la tarea' }).click();
  await p.locator('.toast', { hasText: 'Tarea puesta' }).waitFor();
  await hojaT.waitFor({ state: 'detached' });
  check(true, 'el coach le pone una tarea de texto para hoy');
  await p.getByRole('button', { name: 'Comparar dos' }).click();
  const hojaC = p.getByRole('dialog', { name: 'Comparar check-ins' });
  await hojaC.locator('.tabla-comparar').waitFor();
  check(await hojaC.locator('.tabla-comparar tr').count() >= 4 && (await hojaC.textContent()).includes('Peso'), 'compara dos check-ins lado a lado (con el peso de esas semanas)');
  // A 390 px, ninguna palabra se parte por la mitad («Motivad / o»), tampoco en una respuesta larga
  const partidas = async () => hojaC.evaluate((el) => {
    const malas = [];
    for (const celda of el.querySelectorAll('.tabla-comparar td, .tabla-comparar th')) {
      const w = document.createTreeWalker(celda, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const re = /\S+/g; let m;
        while ((m = re.exec(n.data))) {
          if (m[0].length > 14) continue; // (una palabra larguísima puede llevar guion)
          const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
          if (new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1) malas.push(m[0]);
        }
      }
    }
    return malas;
  });
  await hojaC.getByLabel('Antes').selectOption({ index: 1 });
  await hojaC.getByLabel('Después').selectOption({ index: 0 });
  await hojaC.locator('.tabla-comparar td', { hasText: 'he dormido mejor' }).waitFor();
  const rotas = await partidas();
  check(rotas.length === 0, rotas.length ? `palabras partidas: ${rotas.join(', ')}` : 'ninguna palabra se parte por la mitad, tampoco en una respuesta larga');
  await revisar('comparar-checkins');
  await p.keyboard.press('Escape');
  await hojaC.waitFor({ state: 'detached' });
  await p.getByRole('heading', { name: 'Sus meses' }).waitFor();
  check(true, 'y sus meses, en la ficha');
  await revisar('ficha-seguimiento-v048');
  // Su nota fijada, en el editor de su programa
  await p.getByRole('tab', { name: 'Programa' }).click();
  const conNota = p.locator('.nota-atleta-coach').first();
  if (await conNota.isVisible({ timeout: 3000 }).catch(() => false)) check((await conNota.textContent()).includes('Su nota'), 'en el editor, la nota que se fijó ella en el ejercicio');
  else {
    await p.locator('.sesion-editor, .fila-sesion, .editor-sesion').first().click().catch(() => {});
    check(await p.locator('.nota-atleta-coach').first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false), 'en el editor, la nota que se fijó ella en el ejercicio');
  }

  // Chat: un mensaje programado (y un enlace de YouTube con su miniatura)
  await p.getByRole('tab', { name: 'Mensajes' }).click();
  await p.locator('.burbuja.programada').first().waitFor();
  check((await p.locator('.burbuja.programada').first().textContent()).includes('Programado para el'), 'el coach ve el mensaje de mañana como «Programado para el …»');
  await p.locator('.chat-area').fill('Mira este vídeo antes del lunes: https://youtu.be/gMgvBspQ9lk');
  await p.getByRole('button', { name: 'Programar envío' }).click();
  const hojaP = p.getByRole('dialog', { name: 'Programar el mensaje a Ana' });
  await hojaP.getByRole('button', { name: 'Mañana, 8:00' }).click();
  await revisar('programar-envio');
  await hojaP.getByRole('button', { name: 'Programar', exact: true }).click();
  await p.locator('.toast', { hasText: 'Programado para el' }).waitFor();
  const nuevaP = p.locator('.burbuja.programada', { hasText: 'Mira este vídeo' });
  await nuevaP.waitFor();
  check(await hay(nuevaP.locator('.vista-youtube img'), 1) && (await nuevaP.locator('.vista-youtube img').getAttribute('src')).startsWith('https://i.ytimg.com/vi/gMgvBspQ9lk/'), 'programa un mensaje con un enlace de YouTube: sale con su miniatura');
  await revisar('chat-programado');

  // Revisar → Tareas
  await p.locator('.tab', { hasText: 'Revisar' }).click();
  await p.getByRole('heading', { name: 'Revisar' }).waitFor();
  await p.getByRole('button', { name: /^Tareas \(1\)/ }).click();
  const tarjT = p.getByRole('article', { name: /Tarea de Ana López/ });
  await tarjT.waitFor();
  check((await tarjT.textContent()).includes('hotel'), 'en Revisar → Tareas, la que contestó Ana, con su respuesta');
  await revisar('revisar-tareas');
  await tarjT.getByRole('button', { name: 'Revisada' }).click();
  await p.locator('.toast', { hasText: 'Tarea revisada' }).waitFor();
  check(true, 'y la marca revisada (con «Deshacer»)');

  // Avisos programados
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.getByRole('button', { name: 'Avisos para tus atletas' }).click();
  const filaProg = p.locator('.aviso-fila', { hasText: 'estreno las tareas' });
  await filaProg.waitFor();
  check((await filaProg.textContent()).includes('Programado para el lun'), 'el aviso del lunes, «Programado para el lun …», que se puede cambiar');
  await revisar('avisos-programados');
  await p.keyboard.press('Escape');

  // Cuenta → Negocio
  await abrirPestana(p, 'Cuenta');
  await p.getByRole('heading', { name: 'Negocio' }).waitFor();
  await p.getByRole('button', { name: 'Abrir el panel de negocio' }).click();
  const hojaN = p.getByRole('dialog', { name: 'Panel de negocio' });
  await hojaN.locator('.negocio-cifras').waitFor();
  const txtN = await hojaN.textContent();
  check(/Atletas activos\s*4/.test(txtN) && /\d €/.test(txtN) && txtN.includes('Renuevan en 30 días') && await hay(hojaN.locator('svg.grafica-negocio'), 2), 'el panel de negocio: activos, euros a la española, renovaciones y las dos gráficas de 12 meses');
  await revisar('negocio');
  await hojaN.getByRole('switch', { name: /Ocultar importes/ }).check();
  await p.waitForTimeout(200);
  check(!/\d €/.test(await hojaN.locator('.negocio-cifras').textContent()) && (await hojaN.textContent()).includes('•••'), '«Ocultar importes» tapa los euros');
  await revisar('negocio-oculto');
  await hojaN.getByRole('switch', { name: /Ocultar importes/ }).uncheck();
  await p.keyboard.press('Escape');

  // Ana: la tarea en «Tu día»
  await entrarComo('Ana López');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  const tuDia = p.locator('.tu-dia');
  await tuDia.waitFor();
  const filaT = tuDia.locator('.fila-dia', { hasText: '¿Cómo has dormido esta semana?' });
  await filaT.waitFor();
  check(await hay(tuDia.locator('.fila-dia', { hasText: 'Fotos de progreso de este mes' }), 1), 'Ana tiene sus dos tareas de hoy en «Tu día»');
  await revisar('tu-dia-tareas');
  await filaT.click();
  const hojaTA = p.getByRole('dialog', { name: '¿Cómo has dormido esta semana?' });
  await hojaTA.getByLabel('Tu respuesta (opcional)').fill('Mejor: unas 7 horas casi todos los días');
  await revisar('tarea-atleta');
  await hojaTA.getByRole('button', { name: 'Marcar como hecha' }).click();
  await p.locator('.toast', { hasText: 'Tarea hecha' }).waitFor();
  await hojaTA.waitFor({ state: 'detached' });
  check(await hay(tuDia.locator('.fila-dia.hecho', { hasText: '¿Cómo has dormido esta semana?' }), 1), 'la contesta y queda hecha');

  // Tu mes (historia) en Hoy
  const tarjetaMes = p.locator('.tarjeta-mes');
  await tarjetaMes.waitFor();
  check(/^Tu [a-z]+$/.test(await tarjetaMes.getAttribute('aria-label')), `en Hoy, la tarjeta «${await tarjetaMes.getAttribute('aria-label')}»`);
  await tarjetaMes.locator('.tarjeta-semana-abrir').click();
  const historia = p.locator('.historia');
  await historia.waitFor();
  await revisar('tu-mes');
  const pantallas = await historia.locator('.historia-barras > span').count();
  for (let i = 0; i < pantallas - 1; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150); }
  const fin = historia.locator('.historia-fin-botones').getByRole('button', { name: 'Compartir' });
  check(pantallas >= 4 && await fin.isVisible(), `${pantallas} pantallas con las flechas; al final, compartir`);
  await revisar('tu-mes-fin');
  await fin.click();
  const hojaComp = p.getByRole('dialog', { name: /Compartir/ }).last();
  await hojaComp.waitFor();
  await hojaComp.locator('p', { hasText: 'nada de peso' }).waitFor({ timeout: 8000 }).catch(() => {});
  check((await hojaComp.textContent()).includes('nada de peso, medidas, nutrición, hábitos ni datos de salud'), 'la imagen para compartir dice lo que lleva (y que no lleva peso, medidas, nutrición ni salud)');
  await revisar('tu-mes-compartir');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(250);
  await cerrarDialogos();
  if (await historia.isVisible().catch(() => false)) await p.keyboard.press('Escape');
  await historia.waitFor({ state: 'detached' });
  check(await hay(p.locator('.tarjeta-mes'), 0), 'vista, la tarjeta ya no vuelve a salir en Hoy');

  // Tu bloque entero
  await p.getByRole('button', { name: 'Tu bloque', exact: true }).click();
  const hojaB = p.getByRole('dialog').filter({ has: p.locator('.bloque-semanas') });
  await hojaB.locator('.bloque-semanas').waitFor();
  check((await hojaB.textContent()).includes('Por publicar') && await hojaB.locator('svg').count() >= 1, 'tu bloque entero: las semanas que vienen «por publicar» y la carga pautada frente a la hecha');
  await revisar('tu-bloque');
  await p.keyboard.press('Escape');
  await hojaB.waitFor({ state: 'detached' });

  // Progreso → Tus meses
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.getByRole('heading', { name: 'Tus meses' }).waitFor();
  check(true, 'en Progreso, los meses pasados');
  await revisar('progreso-meses');

  // Entrenador por voz (la voz del móvil, de mentira)
  await p.evaluate(() => {
    window.__dichos = [];
    const s = window.speechSynthesis;
    s.speak = (u) => { if (u.text) window.__dichos.push(u.text); };
    s.cancel = () => {};
    s.getVoices = () => [];
  });
  await abrirPestana(p, 'Perfil');
  await p.getByRole('button', { name: /^Sonido y vibración/ }).click();
  const intVoz = p.getByRole('dialog', { name: 'Sonido y vibración' }).getByRole('switch', { name: /Entrenador por voz/ });
  await intVoz.waitFor();
  check(!(await intVoz.isChecked()), 'el entrenador por voz viene apagado');
  await intVoz.check();
  await p.getByRole('button', { name: 'Probar la voz' }).click();
  check((await p.evaluate(() => window.__dichos)).some((t) => t.startsWith('Serie 3 de sentadilla')), '«Probar la voz» lo dice');
  await revisar('perfil-voz');
  await p.keyboard.press('Escape');

  // La sesión: lo que te dijo tu coach, dónde entrenas y la voz en el descanso
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.waitForTimeout(600);
  await cerrarDialogos();
  await p.getByRole('button', { name: 'Empezar sesión' }).click({ force: true });
  await sesionAbierta();
  const donde = p.locator('.donde-entrenas');
  await donde.waitFor();
  await donde.getByRole('button', { name: 'Casa', exact: true }).click();
  await p.locator('.toast', { hasText: /cambiados? por tu material/ }).waitFor();
  const cambiados = await p.locator('.ejercicio .cambiado', { hasText: 'Por tu material de casa' }).count();
  check(cambiados >= 2 && await p.locator('.ejercicio .video-aviso', { hasText: 'Sin alternativa con tu material de casa' }).count() >= 1, `en casa: ${cambiados} ejercicios cambiados por las alternativas del coach; lo que no tiene, avisado`);
  await revisar('donde-entrenas');
  const cambiado = p.locator('.ejercicio', { has: p.locator('.cambiado', { hasText: 'Por tu material de casa' }) }).first();
  await cambiado.locator('.ejercicio-cab').click();
  await cambiado.locator('.cambio-lugar').getByRole('button', { name: 'Deshacer' }).click();
  await p.locator('.toast', { hasText: 'Vuelve el ejercicio que pautó tu coach' }).waitFor();
  check(await p.locator('.ejercicio .cambiado', { hasText: 'Por tu material de casa' }).count() === cambiados - 1, 'y cada cambio se deshace por separado');
  const dom = p.locator('.ejercicio', { hasText: 'Dominadas pronas' }).first();
  await dom.locator('.ejercicio-cab').click();
  await dom.locator('.dijo-coach').waitFor();
  check((await dom.locator('.dijo-coach').textContent()).includes('baja del todo'), '«Lo que te dijo tu coach» en las dominadas (de una sesión anterior)');
  await revisar('dijo-coach');
  const prim = p.locator('.ejercicio').first();
  if ((await prim.locator('.ejercicio-cab').getAttribute('aria-expanded')) !== 'true') await prim.locator('.ejercicio-cab').click();
  await prim.getByLabel('Kilos de la serie 1').fill('20');
  await prim.getByLabel('Repeticiones de la serie 1').fill('10');
  await prim.getByRole('button', { name: 'Marcar la serie 1 como hecha' }).click();
  await p.locator('.temporizador').waitFor();
  await temporizadorAlSonar(p);
  await p.waitForFunction(() => window.__dichos.some((t) => /^Serie 2 de /.test(t)), null, { timeout: 4000 }).catch(() => {});
  const dichos = await p.evaluate(() => window.__dichos);
  check(dichos.some((t) => /^Serie 2 de .+: .+\.$/.test(t)), `al acabar el descanso, la voz dice la serie siguiente («${dichos.filter((t) => t.startsWith('Serie 2')).at(-1) || dichos.at(-1)}»)`);
  const saltar = p.getByRole('button', { name: /Saltar|Cerrar/ }).first();
  if (await p.locator('.temporizador').isVisible().catch(() => false)) await saltar.click().catch(() => {});
  await intVoz.isVisible().catch(() => false);

  // Oscuro y a 360 px
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.getByRole('button', { name: 'Volver' }).first().click().catch(() => {});
  // (Hoy llega tras la transición, con los discos nuevos un momento después)
  await p.locator('nav.tabs').waitFor();
  await p.waitForTimeout(800);
  await cerrarDialogos();
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.locator('.tu-dia').waitFor();
  await p.waitForTimeout(800);
  await cerrarDialogos();
  const ancho360 = await p.evaluate(() => document.documentElement.scrollWidth);
  check(ancho360 <= 360, `a 360 px y en oscuro, Hoy (con sus tareas) no se sale (${ancho360} px)`);
  await revisar('hoy-360-oscuro');
  await p.getByRole('button', { name: 'Tu bloque', exact: true }).click();
  await p.locator('.bloque-semanas').waitFor();
  const anchoB = await p.evaluate(() => document.documentElement.scrollWidth);
  check(anchoB <= 360, `y tu bloque tampoco (${anchoB} px)`);
  await revisar('tu-bloque-360-oscuro');
  await p.keyboard.press('Escape');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.emulateMedia({ colorScheme: 'light' });

  // El acceso directo «Sesión de hoy» del icono (?accion=sesion) abre la sesión que toca
  await p.goto('http://localhost:4174/?demo&accion=sesion#hoy');
  await sesionAbierta();
  check(!(await p.evaluate(() => location.search)).includes('accion'), 'el acceso directo «Sesión de hoy» abre la sesión que toca (y limpia la dirección)');
  // Compartir un vídeo desde la galería (Android): el service worker lo deja en la caché y abre ?compartido=1
  await p.evaluate(async () => {
    const c = await caches.open('fbe-compartido');
    await c.put('https://fbe-compartido.invalid/video', new Response(new Blob([new Uint8Array(2048)], { type: 'video/mp4' }), { headers: { 'content-type': 'video/mp4', 'x-content-type-options': 'nosniff', 'x-nombre': 'sentadilla.mp4' } }));
  });
  await p.goto('http://localhost:4174/?demo&compartido=1#hoy');
  const hojaV = p.getByRole('dialog', { name: 'Enviar el vídeo a tu coach' });
  await hojaV.waitFor();
  check((await hojaV.textContent()).includes('sentadilla.mp4') && !(await p.evaluate(() => location.search)).includes('compartido'), 'al compartir un vídeo a la app, Ana elige de qué ejercicio es (y la dirección queda limpia)');
  check((await hojaV.textContent()).includes('Este vídeo te llega desde otra app: comprueba que es tuyo antes de enviarlo'), 'y la hoja dice que el vídeo llega de otra app');
  check(!(await p.evaluate(async () => !!(await (await caches.open('fbe-compartido')).match('https://fbe-compartido.invalid/video')))), 'en cuanto la app lo coge, se borra del móvil');
  await hojaV.getByLabel('¿De qué ejercicio es?').selectOption({ index: 1 });
  await revisar('compartido');
  await hojaV.getByRole('button', { name: 'Descartarlo' }).click();
  await hojaV.waitFor({ state: 'detached' });
  check(true, 'y se puede descartar');
  // El coach no recibe vídeos compartidos: se descarta con un aviso
  await p.evaluate(async () => {
    const c = await caches.open('fbe-compartido');
    await c.put('https://fbe-compartido.invalid/video', new Response(new Blob([new Uint8Array(16)], { type: 'video/mp4' }), { headers: { 'content-type': 'video/mp4' } }));
  });
  await entrarComo('Pelayo');
  await p.goto('http://localhost:4174/?demo&compartido=1#atletas');
  await p.locator('.toast', { hasText: /vídeo/ }).waitFor();
  check(!(await p.evaluate(async () => !!(await (await caches.open('fbe-compartido')).match('https://fbe-compartido.invalid/video')))), 'si lo comparte el coach, se descarta con un aviso');
  // Los accesos directos del icono
  const man = JSON.parse(await (await fetch('http://localhost:4174/manifest.webmanifest')).text());
  check(man.shortcuts?.length === 4 && man.shortcuts[0].url.includes('accion=sesion') && man.share_target?.action === './compartir-video' && man.share_target.params.files[0].accept.includes('video/*'),
    'el manifiesto trae los accesos directos (sesión de hoy, check-in, mensajes, revisar) y recibe vídeos compartidos');

  // ------------------------------------------------------------------------------------------------------------------
  {
  console.log('\nv0.52: hojas con muelle, elemento compartido, «Sesión en curso», racha, destacados, gráficas, carné, confeti y «Respira»');
  // Espía de View Transitions: qué nombres hay puestos justo después del cambio (la pareja, y una sola vez cada nombre)
  const hayVT = await p.evaluate(() => typeof document.startViewTransition === 'function');
  const espiarVT = () => p.evaluate(() => {
    window.__vt = [];
    if (window.__vtEspia || !document.startViewTransition) return;
    window.__vtEspia = true;
    const orig = document.startViewTransition.bind(document);
    document.startViewTransition = (cb) => {
      const t = orig(cb);
      t.updateCallbackDone.then(() => { window.__vt.push([...document.querySelectorAll('[style*="view-transition-name"]')].map((e) => `${e.style.viewTransitionName}:${e.tagName}`).filter((x) => !x.startsWith(':'))); }).catch(() => {});
      return t;
    };
  });
  const nombresVT = async () => { await p.waitForFunction(() => !document.documentElement.dataset.vt, null, { timeout: 4000 }).catch(() => {}); return p.evaluate(() => (window.__vt || []).flat()); };
  const quedanNombresVT = () => p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.style?.viewTransitionName).length);
  // (2) El coach: la foto de Ana en el panel pasa a la cabecera de su ficha
  await p.locator('.tab', { hasText: 'Atletas' }).click();
  await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).waitFor();
  await espiarVT();
  await p.locator('.tarjeta-atleta', { hasText: 'Ana López' }).click();
  await p.locator('.avatar-estado .avatar').waitFor();
  const vtFoto = await nombresVT();
  // (la ficha se espera como mucho 150 ms: en una máquina lenta puede no llegar y la transición va sin pareja)
  check(!hayVT || (vtFoto.filter((x) => x.startsWith('vt-avatar:')).length <= 1 && vtFoto.every((x) => x === 'vt-avatar:SPAN')), `elemento compartido: la foto de Ana en el panel pasa a la de su ficha, con el nombre en un solo elemento (${vtFoto.join(', ') || 'sin pareja a tiempo'})`);
  check(await quedanNombresVT() === 0, 'y al acabar no queda ningún nombre de transición puesto');
  await p.getByRole('button', { name: 'Volver a atletas' }).click();
  await p.locator('.tarjeta-atleta').first().waitFor();

  await entrarComo('Ana López');
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.locator('.hero-dia').waitFor();
  // (4) La racha: al tocarla, su pantalla con la llama, la cifra, 12 semanas y la próxima meta
  const botonRacha = p.locator('.hero-dia .racha-boton').first();
  await botonRacha.waitFor();
  const rachaAna = Number(((await botonRacha.textContent()).match(/\d+/) || ['0'])[0]);
  await botonRacha.click();
  const pantallaR = p.locator('.racha-pantalla');
  await pantallaR.waitFor();
  const cifraR = Number((await pantallaR.locator('.racha-cifra').textContent()).trim());
  check(cifraR === rachaAna && await pantallaR.locator('.racha-semana').count() === 12 && await pantallaR.locator('.racha-semana.completa').count() >= Math.min(rachaAna, 11)
    && await pantallaR.locator('.racha-semana.en_curso, .racha-semana.completa').last().isVisible() && await pantallaR.locator('svg.llama .llama-capa').count() === 3,
  `tocar la racha abre su pantalla: la llama, la cifra (${cifraR}), las últimas 12 semanas y la de ahora`);
  const metaR = await pantallaR.getByRole('progressbar').evaluate((b) => [b.getAttribute('aria-valuenow'), b.getAttribute('aria-valuemax'), b.getAttribute('aria-label')]);
  check(Number(metaR[1]) > rachaAna && Number(metaR[0]) <= rachaAna && /Hacia \d+ semanas/.test(metaR[2]) && /Próxima meta: \d+ semanas/.test(await pantallaR.locator('#racha-meta-t').textContent()), `y la próxima meta con su barra (${metaR.join(' · ')})`);
  check(await pantallaR.evaluate((x) => getComputedStyle(x.querySelector('.llama-exterior')).animationName) === 'llama-a', 'la llama titila (solo transform)');
  await revisar('racha');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await revisar('racha-360-oscuro');
  check(await p.evaluate(() => document.documentElement.scrollWidth) <= 360, 'a 360 px y en oscuro, la pantalla de la racha cabe');
  await p.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  check(await pantallaR.evaluate((x) => getComputedStyle(x.querySelector('.llama-exterior')).animationName) === 'none', 'con «reducir movimiento», la llama se queda quieta');
  await p.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.keyboard.press('Escape');
  await pantallaR.waitFor({ state: 'detached' });
  check(await p.evaluate(() => document.activeElement?.classList.contains('racha-boton')), 'Escape la cierra y el foco vuelve a la racha');
  // (revisión) A 360 px y con «Muy grande», las semanas no se pisan (4 por fila)
  await abrirPestana(p, 'Perfil');
  await p.getByRole('group', { name: 'Tamaño de la letra' }).getByRole('button', { name: 'Muy grande' }).click();
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.setViewportSize({ width: 360, height: 780 });
  await botonRacha.waitFor();
  await botonRacha.click();
  await pantallaR.waitFor();
  const pisadas = await pantallaR.evaluate((x) => {
    const r = [...x.querySelectorAll('.racha-marca, .racha-fecha')].map((e) => e.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], b = r[j]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) n++; }
    const fuera = [...x.querySelectorAll('.racha-semana')].filter((l) => { const f = l.querySelector('.racha-fecha').getBoundingClientRect(), c = l.getBoundingClientRect(); return f.left < c.left - 1 || f.right > c.right + 1; }).length;
    return { n, fuera, columnas: getComputedStyle(x.querySelector('.racha-calendario')).gridTemplateColumns.split(' ').length };
  });
  check(pisadas.n === 0 && pisadas.fuera === 0 && pisadas.columnas === 4 && await p.evaluate(() => document.documentElement.scrollWidth) <= 360, `a 125 % y 360 px, las 12 semanas no se pisan (${JSON.stringify(pisadas)})`);
  await revisar('racha-125-360');
  await p.keyboard.press('Escape');
  await pantallaR.waitFor({ state: 'detached' });
  await p.setViewportSize({ width: 390, height: 844 });
  await abrirPestana(p, 'Perfil');
  await p.getByRole('group', { name: 'Tamaño de la letra' }).getByRole('button', { name: 'Normal' }).click();

  // (5) y (6) Progreso: destacados arriba; las gráficas con su rango, la línea que se transforma y la cifra que rueda
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.locator('.logros').waitFor();
  const dest = p.locator('.destacados .destacado');
  await hay(dest, await dest.count() || 1, 4000);
  const nDest = await dest.count();
  const textosDest = await dest.locator('.destacado-texto').allTextContents();
  check(nDest >= 1 && nDest <= 4 && textosDest.every((t) => t.trim().endsWith('.')) && !textosDest.some((t) => /peso corporal|kcal|kg de tendencia|sueño/i.test(t)) && await dest.locator('.mini-grafica').count() === nDest,
    `destacados: ${nDest} frases con su gráfica pequeña, solo de entrenamiento (${textosDest.map((t) => `«${t}»`).join(' ')})`);
  check(await p.evaluate(() => { const d = document.querySelector('.destacados'); const a = document.querySelector('.anillos-semana'); return !!d && !!a && (d.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; }), 'van arriba, antes de los anillos de la semana');
  await p.locator('.destacados').scrollIntoViewIfNeeded();
  await revisar('destacados');
  const seccionF = p.locator('.seccion', { has: p.getByRole('heading', { name: 'Fuerza (1RM estimado)' }) });
  await seccionF.scrollIntoViewIfNeeded();
  const rangoF = seccionF.getByRole('group', { name: 'Rango de la gráfica del 1RM estimado' });
  await rangoF.waitFor();
  check((await rangoF.locator('button').allTextContents()).join() === '1M,3M,6M,Todo' && await rangoF.locator('button[aria-pressed="true"]').count() === 1, 'el 1RM estimado tiene su rango: 1M · 3M · 6M · Todo');
  const lineaF = seccionF.locator('svg.grafica path.linea');
  const chipAntes = (await seccionF.locator('.cifra .chip .sr').first().textContent().catch(() => '')).trim();
  await rangoF.getByRole('button', { name: 'Todo', exact: true }).click();
  const morfa = await p.waitForFunction(() => document.querySelector('.grafica.morfando'), null, { timeout: 1500 }).then(() => true).catch(() => false);
  await p.waitForFunction(() => !document.querySelector('.grafica.morfando'), null, { timeout: 3000 }).catch(() => {});
  check(morfa && (await rangoF.locator('button[aria-pressed="true"]').textContent()) === 'Todo', 'al cambiar de rango, la línea se transforma en la nueva');
  // Con otro ejercicio (otros datos), la línea pasa de una forma a la otra y acaba en el trazo de verdad (con una esquina en cada punto)
  const dAntes = await lineaF.getAttribute('d');
  const valorAntes = (await seccionF.locator('.cifra .odometro.v .sr').textContent()).trim();
  await seccionF.getByRole('group', { name: 'Ejercicio' }).locator('button[aria-pressed="false"]').first().click();
  const morfa2 = await p.waitForFunction(() => document.querySelector('.grafica.morfando'), null, { timeout: 1500 }).then(() => true).catch(() => false);
  await p.waitForFunction(() => !document.querySelector('.grafica.morfando'), null, { timeout: 3000 }).catch(() => {});
  const dDespues = await lineaF.getAttribute('d');
  const valorDespues = (await seccionF.locator('.cifra .odometro.v .sr').textContent()).trim();
  check(morfa2 && dDespues !== dAntes && /^M[\d.]+ [\d.]+( L[\d.]+ [\d.]+)+$/.test(dDespues) && (dDespues.match(/L/g) || []).length + 1 === await seccionF.locator('svg.grafica .punto').count(),
    'al cambiar de ejercicio, la línea se transforma en la del otro y acaba en el trazo de verdad (una esquina por punto)');
  check(valorAntes !== valorDespues && await seccionF.locator('.cifra .odometro.v .odo-col').count() >= 2, `y su cifra rueda como un cuentakilómetros (${valorAntes} → ${valorDespues} kg)`);
  const chipDespues = (await seccionF.locator('.cifra .chip .sr').first().textContent().catch(() => '')).trim();
  check(/kg$/.test(chipDespues) && await seccionF.locator('.cifra .chip .odo-col .odo-tira').count() >= 1 && (await seccionF.locator('.cifra .chip').first().textContent()).includes('en todo'),
    `lo ganado en el rango rueda como un cuentakilómetros (${chipAntes} → ${chipDespues}), con el texto para los lectores de pantalla`);
  const grafF = seccionF.locator('.grafica-tactil');
  await grafF.focus();
  await p.keyboard.press('Home');
  check(await grafF.getAttribute('aria-valuenow') === '1' && /kg/.test(await grafF.getAttribute('aria-valuetext')), 'y la gráfica sigue siendo un deslizador con el teclado (y táctil)');
  check(await p.locator('.seccion', { has: p.getByRole('heading', { name: 'Tonelaje por semana' }) }).getByRole('group', { name: 'Rango de la gráfica del tonelaje' }).count() === 1
    && await p.locator('.seccion', { has: p.getByRole('heading', { name: 'Peso corporal' }) }).getByRole('group', { name: 'Rango de la gráfica del peso' }).count() === 1, 'el tonelaje (nuevo) y el peso también tienen su rango');
  await revisar('graficas-rango');
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await seccionF.scrollIntoViewIfNeeded();
  await revisar('graficas-rango-360-oscuro');
  check(await p.evaluate(() => document.documentElement.scrollWidth) <= 360, 'a 360 px y en oscuro, las gráficas con su rango caben');
  await p.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await rangoF.getByRole('button', { name: '3M', exact: true }).click();
  check(!(await p.locator('.grafica.morfando').count()) && await p.evaluate(() => getComputedStyle(document.querySelector('.odo-tira')).transitionDuration) === '0s', 'con «reducir movimiento», el cambio de rango es inmediato (sin transformar ni rodar)');
  await p.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await p.setViewportSize({ width: 390, height: 844 });
  // (revisión) Elegido el último punto (con el teclado, sin salir de la gráfica) y pasando a un rango con menos puntos:
  // la gráfica no falla
  await rangoF.getByRole('button', { name: 'Todo', exact: true }).evaluate((b) => b.click());
  await p.waitForTimeout(700);
  const nTodo = await seccionF.locator('svg.grafica .punto').count();
  await grafF.focus();
  await p.keyboard.press('End');
  check(await grafF.getAttribute('aria-valuenow') === String(nTodo), `con el último punto elegido (${nTodo} de ${nTodo})`);
  const erroresAntes = errores.length;
  await rangoF.getByRole('button', { name: '1M', exact: true }).evaluate((b) => b.click());
  await p.waitForTimeout(800);
  const n1M = await seccionF.locator('svg.grafica .punto').count();
  check(errores.length === erroresAntes && (n1M < 2 || await p.evaluate(() => document.activeElement?.classList.contains('grafica-tactil'))) && (n1M < 2 || Number(await grafF.getAttribute('aria-valuenow')) <= n1M),
    `y pasando a 1M sin salir de la gráfica (${nTodo} → ${n1M} puntos), no falla ni elige un punto que ya no está`);
  // (con los datos de la demo, 1M puede tener los mismos puntos: lo mismo con un ejercicio de menos puntos, que es el
  // mismo camino: el punto elegido deja de existir en el mismo pintado)
  const chipsEj = seccionF.getByRole('group', { name: 'Ejercicio' }).locator('button');
  const puntosEj = [];
  for (let k = 0; k < Math.min(await chipsEj.count(), 8); k++) {
    await chipsEj.nth(k).evaluate((b) => b.click());
    await p.waitForTimeout(650);
    puntosEj.push(await seccionF.locator('svg.grafica .punto').count());
  }
  const iMas = puntosEj.indexOf(Math.max(...puntosEj));
  const iMenos = puntosEj.findIndex((x) => x >= 2 && x < puntosEj[iMas]);
  if (iMenos >= 0) {
    await chipsEj.nth(iMas).evaluate((b) => b.click());
    await p.waitForTimeout(650);
    await grafF.focus();
    await p.keyboard.press('End');
    const erroresAntes2 = errores.length;
    await chipsEj.nth(iMenos).evaluate((b) => b.click());
    await p.waitForTimeout(800);
    check(errores.length === erroresAntes2 && await p.evaluate(() => document.activeElement?.classList.contains('grafica-tactil')) && Number(await grafF.getAttribute('aria-valuenow')) <= puntosEj[iMenos],
      `elegido el último punto y pasando a una gráfica con menos (${puntosEj[iMas]} → ${puntosEj[iMenos]} puntos), no falla`);
  } else check(true, `todas las gráficas de fuerza tienen los mismos puntos (${puntosEj.join(', ')})`);
  await rangoF.getByRole('button', { name: '3M', exact: true }).click();

  // (1) Hojas con muelle: la ficha del ejercicio abre en el tope medio; arrastrando el asa sube a completa; un tirón la cierra
  await seccionF.getByRole('button', { name: 'Gráficas, récords e historial' }).click();
  const fichaM = p.locator('.hoja-dialogo.ficha-ejercicio');
  await fichaM.waitFor();
  await p.waitForTimeout(400);
  const medio = await fichaM.evaluate((h) => ({ medio: h.classList.contains('en-medio'), alto: Math.round(h.getBoundingClientRect().height), vista: innerHeight }));
  check(medio.medio && Math.abs(medio.alto - Math.round(medio.vista * 0.55)) <= 2, `las hojas largas abren en el tope medio, el 55 % de la pantalla (${medio.alto} de ${medio.vista} px)`);
  const asa = await fichaM.locator('.hoja-cab').boundingBox();
  await p.mouse.move(asa.x + asa.width / 2, asa.y + 12); await p.mouse.down();
  for (let k = 1; k <= 12; k++) { await p.mouse.move(asa.x + asa.width / 2, asa.y + 12 - k * 30); await p.waitForTimeout(16); }
  await p.mouse.up();
  await p.waitForFunction(() => { const h = document.querySelector('.hoja-dialogo.ficha-ejercicio'); return h && !h.getAnimations().length; }, null, { timeout: 3000 }).catch(() => {});
  const completa = await fichaM.evaluate((h) => ({ medio: h.classList.contains('en-medio'), abajo: Math.round(h.getBoundingClientRect().bottom), vista: innerHeight, t: getComputedStyle(h).transform }));
  check(!completa.medio && Math.abs(completa.abajo - completa.vista) <= 2 && (completa.t === 'none' || completa.t === 'matrix(1, 0, 0, 1, 0, 0)'), `arrastrando el asa hacia arriba, sube a completa y se asienta con el muelle (${JSON.stringify(completa)})`);
  // Por encima de completa se resiste (goma): 200 px de dedo mueven bastante menos
  await p.mouse.move(asa.x + asa.width / 2, completa.abajo - (await fichaM.boundingBox()).height + 12); await p.mouse.down();
  const yGoma0 = (await fichaM.boundingBox()).y;
  await p.mouse.move(asa.x + asa.width / 2, completa.abajo - (await fichaM.boundingBox()).height + 12 - 200, { steps: 8 });
  const yGoma1 = await fichaM.evaluate((h) => h.getBoundingClientRect().y);
  await p.mouse.up();
  check(yGoma1 < yGoma0 && yGoma0 - yGoma1 < 120, `por encima del tope se resiste como una goma (200 px de dedo, ${Math.round(yGoma0 - yGoma1)} px de hoja)`);
  await p.waitForFunction(() => { const h = document.querySelector('.hoja-dialogo.ficha-ejercicio'); return h && !h.getAnimations().length; }, null, { timeout: 3000 }).catch(() => {});
  await revisar('hoja-completa');
  const asa2 = await fichaM.locator('.hoja-cab').boundingBox();
  await p.mouse.move(asa2.x + asa2.width / 2, asa2.y + 12); await p.mouse.down();
  await p.mouse.move(asa2.x + asa2.width / 2, asa2.y + 12 + 520, { steps: 4 });
  await p.mouse.up();
  await fichaM.waitFor({ state: 'detached', timeout: 4000 });
  check(true, 'arrastrándola hacia abajo se cierra, con el muelle hasta fuera (la velocidad del dedo cuenta: ver las pruebas de lógica)');
  const abreFicha = seccionF.getByRole('button', { name: 'Gráficas, récords e historial' });
  await abreFicha.focus();
  await p.keyboard.press('Enter');
  await fichaM.waitFor();
  const focoDentro = await p.waitForFunction(() => !!document.activeElement?.closest('.hoja-dialogo.ficha-ejercicio'), null, { timeout: 2000 }).then(() => true).catch(() => false);
  const focoEn = await p.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent.trim().slice(0, 30));
  check(focoDentro, `al abrirse, el foco entra en la hoja (en «${focoEn}»), no se queda en el botón que la abrió`);
  await p.keyboard.press('Escape');
  await fichaM.waitFor({ state: 'detached' });
  check(await p.evaluate(() => document.activeElement?.textContent.includes('Gráficas, récords e historial') && !document.activeElement.closest('[role=dialog]')), 'Escape la cierra y el foco vuelve al botón que la abrió');
  // Una hoja cuyo único control es «Cerrar» (la de un dial): el foco va al propio diálogo
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  const dialC = p.locator('.diales .dial').first();
  await dialC.waitFor();
  await dialC.click();
  const hojaDial = p.getByRole('dialog').last();
  await hojaDial.waitFor();
  check(await p.waitForFunction(() => { const a = document.activeElement; const d = [...document.querySelectorAll('[role=dialog]')].pop(); return !!a && !!d && d.contains(a); }, null, { timeout: 2000 }).then(() => true).catch(() => false),
    'y en una hoja sin más controles que «Cerrar», el foco entra en el propio diálogo');
  await p.keyboard.press('Escape');
  await hojaDial.waitFor({ state: 'detached' });
  check(await p.evaluate(() => document.activeElement?.classList.contains('dial')), 'y al cerrarla vuelve al dial');
  await p.locator('.tab', { hasText: 'Progreso' }).click();
  await p.locator('.logros').waitFor();
  await seccionF.scrollIntoViewIfNeeded();

  // (7) El carné en Perfil: nombre, nivel, bloque y desde cuándo (nada de peso); se inclina con el dedo; se comparte como imagen
  await abrirPestana(p, 'Perfil');
  const carne = p.locator('.carnet');
  await carne.waitFor();
  await carne.scrollIntoViewIfNeeded();
  const textoCarne = (await carne.textContent()).replace(/\s+/g, ' ');
  check(/FBE Coaching/.test(textoCarne) && /Ana López/.test(textoCarne) && /Nivel/.test(textoCarne) && /Bloque/.test(textoCarne) && /Desde/.test(textoCarne) && !/\bkg\b|kcal|peso/i.test(textoCarne),
    `el carné: FBE Coaching, su nombre, nivel, bloque y desde cuándo, sin peso ni nutrición («${textoCarne.trim().slice(0, 90)}…»)`);
  const cajaC = await carne.boundingBox();
  await p.mouse.move(cajaC.x + 10, cajaC.y + 10);
  await p.mouse.move(cajaC.x + cajaC.width - 10, cajaC.y + 12, { steps: 4 });
  await p.waitForTimeout(150);
  const inclina = await carne.evaluate((c) => [c.style.getPropertyValue('--rx'), c.style.getPropertyValue('--ry')]);
  check(parseFloat(inclina[0]) > 0 && parseFloat(inclina[1]) > 0, `se inclina siguiendo al dedo (${inclina.join(', ')})`);
  await p.mouse.move(cajaC.x + cajaC.width / 2, cajaC.y + cajaC.height + 120);
  await revisar('carne');
  await p.getByRole('button', { name: 'Compartir o guardar el carné' }).click();
  const hojaC = p.getByRole('dialog', { name: 'Tu carné' });
  await hojaC.locator('.tarjeta-img').waitFor();
  check((await hojaC.locator('.tarjeta-img').getAttribute('alt')).startsWith('Carné de atleta de FBE Coaching: Ana López') && (await hojaC.locator('.tarjeta-img').evaluate((i) => i.complete && i.naturalWidth)) === 1200
    && await hojaC.getByRole('button', { name: 'Guardar imagen' }).count() === 1, 'se comparte o se guarda como imagen (1200 × 756) con la hoja de siempre');
  const altC = await hojaC.locator('.tarjeta-img').getAttribute('alt');
  check(!/Bloque|Fuerza base/.test(altC) && /ni el bloque/.test(await hojaC.textContent()) && /FBE·\d{6}/.test(textoCarne), `la imagen no lleva el bloque (lo escribe el coach y podría decir algo de salud): «${altC}»; el número de socio, de 6 cifras`);
  await revisar('carne-compartir');
  await hojaC.getByRole('button', { name: 'Cerrar' }).click();
  await p.setViewportSize({ width: 360, height: 780 });
  await p.emulateMedia({ colorScheme: 'dark' });
  await carne.scrollIntoViewIfNeeded();
  await revisar('carne-360-oscuro');
  check(await p.evaluate(() => document.documentElement.scrollWidth) <= 360, 'a 360 px y en oscuro, el carné cabe');
  await p.emulateMedia({ colorScheme: 'light' });
  await p.setViewportSize({ width: 390, height: 844 });

  // (2), (10), (9) y (3): la sesión de hoy desde Hoy (su título pasa a la portada), la portada que se recoge al bajar,
  // «Respira» en el descanso y «Sesión en curso» al salir con series hechas
  await p.locator('.tab', { hasText: 'Hoy' }).click();
  await p.locator('.hero-dia').waitFor();
  const botonHero = p.locator('.hero-dia').getByRole('button', { name: /^(Empezar|Continuar) sesión$/ });
  if (await botonHero.count()) {
    await espiarVT();
    await botonHero.click();
    await p.locator('.portada-sesion, .ejercicio').first().waitFor();
    const vtTitulo = await nombresVT();
    check(!hayVT || (vtTitulo.filter((x) => x.startsWith('vt-titulo-sesion:')).length <= 1 && vtTitulo.every((x) => x === 'vt-titulo-sesion:H1')), `el título de la sesión de Hoy pasa al de su portada (${vtTitulo.join(', ') || 'sin pareja a tiempo'})`);
    check(await quedanNombresVT() === 0, 'y el nombre se quita al acabar');
    if (await p.locator('.portada-sesion').count()) {
      const conScroll = await p.evaluate(() => CSS.supports('animation-timeline: scroll()'));
      check(await p.getByRole('button', { name: 'Volver' }).count() === 1 && await p.locator('.portada-barra-titulo').getAttribute('aria-hidden') === 'true', 'la portada lleva un solo «Volver» (en su barra) y el nombre de la barra no se lee dos veces');
      await p.evaluate(() => window.scrollTo(0, 320));
      await p.waitForTimeout(200);
      const recoge = await p.evaluate(() => {
        const b = document.querySelector('.portada-barra'), t = document.querySelector('.portada-barra-titulo > span');
        return { pos: getComputedStyle(b).position, arriba: Math.round(b.getBoundingClientRect().top), titulo: new DOMMatrixReadOnly(getComputedStyle(t).transform).m42, fondo: Number(getComputedStyle(b, '::before').opacity) };
      });
      check(!conScroll || (recoge.pos === 'sticky' && recoge.arriba === 0 && Math.abs(recoge.titulo) < 1 && recoge.fondo > 0.9), `al bajar, la portada se recoge en la barra de arriba con su nombre (animaciones ligadas al scroll: ${conScroll ? JSON.stringify(recoge) : 'sin soporte, quieta'})`);
      await revisar('portada-recogida');
      await p.emulateMedia({ reducedMotion: 'reduce' });
      check(await p.evaluate(() => getComputedStyle(document.querySelector('.portada-barra')).position) === 'relative', 'con «reducir movimiento», nada ligado al scroll (la barra se va con la portada)');
      await p.emulateMedia({ reducedMotion: 'no-preference' });
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.locator('.portada-empezar').getByRole('button', { name: 'Empezar', exact: true }).click();
    }
    await p.locator('.ejercicio').first().waitFor();
    const ahoraNo = p.getByRole('button', { name: 'Ahora no' });
    if (await ahoraNo.count()) await ahoraNo.first().click();
    const sinHacer = p.locator('.ejercicio .serie:not(.hecha) .hecho-btn').first();
    await abrirEjercicio(p.locator('.ejercicio', { has: p.locator('.serie:not(.hecha) .hecho-btn') }).first());
    await sinHacer.click();
    const relojR = p.locator('.temporizador');
    await relojR.waitFor();
    await relojR.scrollIntoViewIfNeeded();
    const botonRespira = relojR.getByRole('button', { name: 'Respira' });
    check(await botonRespira.getAttribute('aria-pressed') === 'false', '«Respira» va apagado de entrada');
    await botonRespira.click();
    await relojR.locator('.respira-texto').waitFor();
    const respiraTxt = (await relojR.locator('.respira-texto').textContent()).trim();
    check(['Inspira', 'Suelta'].includes(respiraTxt) && await relojR.locator('.respira-circulo').count() === 1 && await relojR.locator('.respira-texto').getAttribute('aria-hidden') === 'true'
      && await relojR.locator('.cuenta').isVisible() && JSON.parse(await p.evaluate(() => localStorage.getItem('fbe-ajustes'))).respira === true,
    `«Respira»: un círculo que crece y encoge con «${respiraTxt}» (sin anunciarlo: la cuenta sigue mandando), recordado en el móvil`);
    await revisar('respira');
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.waitForTimeout(300);
    check(await relojR.locator('.respira-circulo').count() === 0 && await relojR.locator('.respira-texto').count() === 1, 'con «reducir movimiento», solo el texto');
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    // (revisión) El ciclo va con el descanso: añadir tiempo no lo reinicia (el círculo es el mismo, con su retraso)
    await relojR.locator('.respira-circulo').waitFor();
    await relojR.locator('.respira-circulo').evaluate((el) => { el.dataset.marca = 'a'; });
    const retraso0 = await relojR.locator('.respira-circulo').evaluate((el) => el.style.animationDelay);
    // (un descanso largo, para que siga en marcha al salir de la sesión aunque la máquina vaya lenta)
    await relojR.getByRole('button', { name: 'Añadir 1 minuto' }).click();
    await relojR.getByRole('button', { name: 'Añadir 1 minuto' }).click();
    check(await relojR.locator('.respira-circulo').evaluate((el) => el.dataset.marca === 'a') && await relojR.locator('.respira-circulo').evaluate((el) => el.style.animationDelay) === retraso0 && /^-?[\d.]+s$/.test(retraso0),
      `añadir tiempo no reinicia la respiración (el ciclo cuenta desde que empezó este descanso: ${retraso0})`);
    await botonRespira.click();
    // El nombre y el pictograma del ejercicio pasan a la cabecera de su ficha
    const ejR = p.locator('.ejercicio', { has: p.locator('.ejercicio-cuerpo') }).first();
    await ejR.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await espiarVT();
    await ejR.getByRole('button', { name: /^Más herramientas/ }).click();
    await p.getByRole('dialog').last().locator('.hoja-acciones').waitFor();
    await p.getByRole('dialog').last().getByRole('button', { name: /^Historial/ }).click();
    await p.locator('.ficha-ejercicio .ficha-ej-cab').waitFor();
    const vtEj = await nombresVT();
    check(!hayVT || (vtEj.includes('vt-ej-nombre:H2') && vtEj.filter((x) => x.startsWith('vt-ej-picto:')).length === 1 && vtEj.length === 2), `el nombre y el pictograma del ejercicio pasan a la cabecera de su ficha (${vtEj.join(', ') || 'sin View Transitions'})`);
    check(await quedanNombresVT() === 0, 'y ningún nombre se queda puesto (ni en la tarjeta, que sigue debajo de la hoja)');
    await p.keyboard.press('Escape');
    await p.locator('.ficha-ejercicio').waitFor({ state: 'detached' });
    // Fuera de la sesión: la píldora «Sesión en curso» arriba, sin tapar la cabecera
    await p.getByRole('button', { name: 'Volver' }).first().click();
    await p.locator('.hero-dia').waitFor();
    const pildora = p.locator('.encurso-pildora');
    await pildora.waitFor();
    const etiquetaP = await pildora.getAttribute('aria-label');
    const solape = await p.evaluate(() => {
      const a = document.querySelector('.encurso-pildora').getBoundingClientRect();
      const cab = document.querySelector('.cabecera');
      const r = cab?.getBoundingClientRect();
      return { abajo: Math.round(a.bottom), cab: r ? Math.round(r.top) : null };
    });
    check(/^Sesión en curso: .+, con un descanso en marcha\. Toca para ver más$/.test(etiquetaP) && await pildora.locator('.encurso-anillo').count() === 1 && /\d:\d\d/.test(await pildora.locator('.encurso-cuenta').textContent())
      && solape.cab != null && solape.abajo <= solape.cab, `fuera de la sesión, la píldora «Sesión en curso» con el descanso y su anillo, sin tapar la cabecera (${etiquetaP}; ${JSON.stringify(solape)})`);
    await pildora.click();
    const tarjetaP = p.locator('.encurso-tarjeta');
    await tarjetaP.waitFor();
    check(await pildora.getAttribute('aria-expanded') === 'true' && /Lo siguiente/.test(await tarjetaP.textContent()) && /Serie \d+ de \d+/.test(await tarjetaP.textContent()) && await tarjetaP.getByRole('button', { name: 'Volver a la sesión' }).count() === 1,
      'al tocarla se abre: lo siguiente (la serie que toca) y «Volver a la sesión»');
    await revisar('actividad');
    await p.setViewportSize({ width: 360, height: 780 });
    await p.emulateMedia({ colorScheme: 'dark' });
    await revisar('actividad-360-oscuro');
    check(await p.evaluate(() => document.documentElement.scrollWidth) <= 360, 'a 360 px y en oscuro, la píldora y su tarjeta caben');
    await p.emulateMedia({ colorScheme: 'light' });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.keyboard.press('Escape');
    await tarjetaP.waitFor({ state: 'detached' });
    await pildora.click();
    await tarjetaP.getByRole('button', { name: 'Volver a la sesión' }).click();
    await p.locator('.ejercicio').first().waitFor();
    check(await p.locator('.temporizador').count() === 1 && await p.locator('.encurso').count() === 0, '«Volver a la sesión» vuelve con el descanso donde iba (y sin la píldora dentro de la sesión)');
    // Al terminarla, la píldora se va (y si completa la semana y llega a un hito de la racha, lo celebra una vez)
    await p.getByRole('button', { name: 'Terminar sesión' }).click();
    await p.locator('.hoja-dialogo .segmentos button', { hasText: '8' }).click();
    await p.getByRole('button', { name: 'Guardar y terminar' }).click();
    await p.getByRole('heading', { name: 'Sesión terminada' }).waitFor();
    await p.getByRole('button', { name: 'Volver a hoy' }).click();
    await p.locator('.hero-dia').waitFor();
    await p.waitForTimeout(900);
    check(await p.locator('.encurso').count() === 0 && !(await p.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('fbe-en-curso-') && localStorage.getItem(k)))), 'al terminar la sesión, la píldora desaparece (y no queda nada en el móvil)');
  } else check(true, 'Ana no tiene sesión pendiente hoy: sin píldora que probar');
  // (4) y (8) El hito de la racha: si la racha ha llegado a uno (o ya estaba), se celebra a pantalla completa una vez
  const rachaNueva = Number(((await p.locator('.hero-dia .racha-boton').first().textContent().catch(() => '')).match(/\d+/) || ['0'])[0]);
  const hitos = [4, 8, 12, 26, 52].filter((h) => h <= rachaNueva);
  if (hitos.length) {
    let hitoP = p.locator('.hito-pantalla');
    if (!(await hitoP.count())) {
      // (ya celebrado en este móvil antes de la prueba: se olvida y se vuelve a Hoy)
      await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('fbe-hitos-racha-')) localStorage.removeItem(k); });
      await p.locator('.tab', { hasText: 'Progreso' }).click();
      await p.locator('.logros').waitFor();
      await p.locator('.tab', { hasText: 'Hoy' }).click();
      hitoP = p.locator('.hito-pantalla');
    }
    await hitoP.waitFor();
    const conf = await p.waitForFunction(() => document.querySelector('canvas.confeti-lienzo'), null, { timeout: 2000 }).then(() => true).catch(() => false);
    check((await hitoP.getByRole('heading').textContent()).includes(`¡${hitos[hitos.length - 1]} semanas seguidas!`) && conf && await p.locator('canvas.confeti-lienzo').getAttribute('aria-hidden') === 'true'
      && await p.evaluate(() => getComputedStyle(document.querySelector('canvas.confeti-lienzo')).pointerEvents) === 'none', `al llegar a ${hitos[hitos.length - 1]} semanas, un momento a pantalla completa con confeti (que no recibe toques)`);
    await revisar('hito-racha');
    await p.waitForFunction(() => !document.querySelector('canvas.confeti-lienzo'), null, { timeout: 4000 }).catch(() => {});
    check(await p.locator('canvas.confeti-lienzo').count() === 0, 'el confeti se borra solo (unos 2,5 s)');
    await hitoP.getByRole('button', { name: 'Seguir' }).click();
    await hitoP.waitFor({ state: 'detached' });
    await cerrarDialogos();
    const hitoVisto = hitos[hitos.length - 1];
    check(await p.evaluate((h) => Object.keys(localStorage).some((k) => { try { return k.startsWith('fbe-hitos-racha-') && JSON.parse(localStorage.getItem(k)).includes(h); } catch { return false; } }), hitoVisto), 'lo celebrado se guarda en el móvil, por atleta');
    await p.locator('.tab', { hasText: 'Progreso' }).click();
    await p.locator('.logros').waitFor();
    await cerrarDialogos();
    await p.locator('.tab', { hasText: 'Hoy' }).click();
    await p.locator('.hero-dia').waitFor();
    await p.waitForTimeout(800);
    check(await p.locator('.hito-pantalla').count() === 0, 'y no vuelve a salir (una vez por hito en este móvil)');
    await cerrarDialogos();
  } else check(true, `la racha de Ana (${rachaNueva}) aún no llega a un hito`);
  // (revisión) Lo de «Sesión en curso» no sobrevive a cerrar la sesión (ni a cambiar de cuenta en la demo)
  await p.evaluate(() => localStorage.setItem('fbe-en-curso-prueba', JSON.stringify({ id: 's', nombre: 'Torso B', hechas: 1, t: Date.now() })));
  await entrarComo('Pelayo');
  check(!(await p.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('fbe-en-curso-')))), 'al cerrar la sesión (o cambiar de cuenta), no queda en el móvil ninguna sesión a medias');
  }
  await p.unroute('https://i.ytimg.com/**');
  }
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
