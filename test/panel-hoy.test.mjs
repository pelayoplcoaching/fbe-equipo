// (v0.140) Hoy a tu gusto: el orden y lo oculto de las secciones de Hoy, y los diales nuevos (Comida y Pasos).
import { SECCIONES_HOY, leerPanel, seccionesHoy, moverSeccion, alternarSeccion, alternarDial, panelPorDefecto, nombreSeccion } from '../web/src/logica/hoy-panel.js';
import { dialComida, dialPasos, dialSueno, horasMin, relojDeUnVistazo, pasosCortos } from '../web/src/logica/tablero.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const IDS = SECCIONES_HOY.map((s) => s.id);

console.log('El orden de las secciones');
check(leerPanel(null).orden.join() === IDS.join() && panelPorDefecto(null) && panelPorDefecto({}), 'sin nada guardado, el orden de siempre');
check(leerPanel({ orden: ['peso', 'inventada', 'peso', 'sesion'] }).orden.join() === 'peso,sesion,semana,carrera,menu,nutricion,habitos', 'lo guardado, limpio (sin repetidas ni desconocidas) y lo que falte en su sitio');
check(leerPanel({ orden: ['habitos', 'peso'] }).orden.join() === 'sesion,semana,carrera,menu,nutricion,habitos,peso', 'si solo había unas, las demás vuelven por delante de ellas, como venían');
const sub = moverSeccion(null, 'peso', -1);
check(sub.orden.join() === 'sesion,semana,carrera,menu,nutricion,peso,habitos' && !panelPorDefecto(sub), 'subir una la cambia por la de encima');
check(moverSeccion(null, 'sesion', -1).orden.join() === IDS.join() && moverSeccion(null, 'peso', 1).orden.join() === IDS.join(), 'arriba del todo no sube; abajo del todo no baja');
// sin carrera ni menú (no los tiene): «subir» Nutrición la pone delante de Esta semana, saltándose las que no salen
const disp = ['sesion', 'semana', 'nutricion', 'habitos', 'peso'];
const s2 = moverSeccion(null, 'nutricion', -1, disp);
check(seccionesHoy(s2, disp).visibles.join() === 'sesion,nutricion,semana,habitos,peso', 'se mueve entre las que salen hoy (las que no tiene no cuentan)');
check(seccionesHoy(s2).visibles.indexOf('carrera') > seccionesHoy(s2).visibles.indexOf('nutricion'), 'y las que no salían quedan donde estaban');

console.log('Ocultar');
const oc = alternarSeccion(null, 'semana');
check(seccionesHoy(oc).visibles.indexOf('semana') < 0 && seccionesHoy(oc).ocultas.join() === 'semana', 'oculta: no sale entre las visibles, va a «Lo que has ocultado»');
check(seccionesHoy(alternarSeccion(oc, 'semana')).ocultas.length === 0 && panelPorDefecto(alternarSeccion(oc, 'semana')), 'otra vez: vuelve');
check(leerPanel(alternarSeccion(null, 'mito')).ocultas.has('mito') && leerPanel(alternarSeccion(null, 'mes')).ocultas.has('mes'), 'las tarjetas de arriba (mes y mito) también se ocultan');
check(leerPanel(alternarSeccion(null, 'hero')).ocultas.size === 0 && leerPanel(alternarSeccion(null, 'avisos')).ocultas.size === 0, 'lo que no se puede quitar (la tarjeta del día, los avisos) no se oculta');
check(seccionesHoy(oc, ['sesion', 'peso']).ocultas.length === 0, 'una oculta que hoy no tiene nada no sale en «Lo que has ocultado»');
const dd = alternarDial(null, 'carga');
check(leerPanel(dd).dialesOcultos.has('carga') && !leerPanel(alternarDial(dd, 'carga')).dialesOcultos.size && !leerPanel(alternarDial(null, 'inventado')).dialesOcultos.size, 'los diales, uno a uno (y solo los que existen)');
check(nombreSeccion('peso') === 'Tu peso' && nombreSeccion('mito') === 'El mito de la semana', 'los nombres, para la hoja y lo que se anuncia');

console.log('El dial de la comida');
const obj = { kcal: 2400, proteina: 160 };
check(dialComida(null) === null && dialComida({ kcal: null }) === null, 'sin kcal en el plan (o «sin contar»), no hay dial');
const m0 = dialComida(obj, null);
check(m0.estado === 'sin_apuntar' && m0.quedan === 2400 && m0.valor === 0 && m0.proteina === 160, 'sin nada apuntado: le queda todo');
const m1 = dialComida(obj, { kcal: 1800, proteina_g: 120 });
check(m1.estado === 'queda' && m1.quedan === 600 && m1.valor === 0.75 && m1.proteina === 40 && m1.etiqueta === 'Te quedan', 'a mitad del día: lo que le queda de kcal y de proteína');
check(dialComida(obj, { kcal: 2250 }).estado === 'en_objetivo' && dialComida(obj, { kcal: 2500 }).estado === 'en_objetivo', 'a menos de un 10 % de llegar, o pasándose menos de un 5 %: en su objetivo');
const m3 = dialComida(obj, { kcal: 2700, proteina_g: 180 });
check(m3.estado === 'pasado' && m3.quedan === -300 && m3.valor === 1 && m3.proteina === 0, 'pasado: por encima (y la proteína, cumplida)');

console.log('El dial de los pasos');
const hoy = '2026-11-11';
const dias = [{ fecha: '2026-11-08', pasos: 8000 }, { fecha: '2026-11-09', pasos: 10000 }, { fecha: '2026-11-10', pasos: 9000 }, { fecha: hoy, pasos: 4500 }];
const p1 = dialPasos(dias, hoy);
check(p1.pasos === 4500 && p1.media === 9000 && p1.valor === 0.5 && p1.estado === 'por_debajo', 'los de hoy frente a su media de los 14 días anteriores');
check(dialPasos([...dias.slice(0, 3), { fecha: hoy, pasos: 9500 }], hoy).estado === 'en_media', 'al llegar a su media, el dial se llena');
check(dialPasos(dias.slice(0, 3), hoy) === null && dialPasos([{ fecha: hoy, pasos: null }], hoy) === null, 'si hoy no ha llegado nada de Salud, no hay dial');
const p2 = dialPasos([{ fecha: '2026-11-10', pasos: 9000 }, { fecha: hoy, pasos: 3000 }], hoy);
check(p2.media === null && p2.estado === 'sin_media' && p2.valor === 0, 'con menos de 3 días, sin media (no se inventa un objetivo)');
check(dialPasos([{ fecha: '2026-10-01', pasos: 20000 }, { fecha: '2026-10-02', pasos: 20000 }, { fecha: '2026-10-03', pasos: 20000 }, { fecha: hoy, pasos: 5000 }], hoy).media === null, 'lo de hace más de 14 días no cuenta');
check(pasosCortos(842).cifra === '842' && pasosCortos(8432).cifra === '8,4' && pasosCortos(8432).unidad === 'mil' && pasosCortos(12600).cifra === '13', 'en el centro del dial, en miles con una cifra');

console.log('(v0.141) El sueño y tu reloj de un vistazo');
const ds = [{ fecha: '2026-11-08', sueno_min: 420, fc_reposo: 56, hrv: 50, pasos: 8000 }, { fecha: '2026-11-09', sueno_min: 440, fc_reposo: 58, hrv: 52, pasos: 10000 }, { fecha: '2026-11-10', sueno_min: 400, fc_reposo: 57, hrv: 48, pasos: 9000 }, { fecha: hoy, sueno_min: 330, fc_reposo: 60, hrv: 41, pasos: null }];
const s1 = dialSueno(ds, hoy);
check(s1.min === 330 && s1.media === 420 && s1.estado === 'menos' && s1.etiqueta === 'Menos que otras', 'el sueño de anoche frente a su media: menos que otras noches');
check(dialSueno([...ds.slice(0, 3), { fecha: hoy, sueno_min: 410 }], hoy).estado === 'como_siempre' && dialSueno([...ds.slice(0, 3), { fecha: hoy, sueno_min: 500 }], hoy).estado === 'mas', 'entre el 90 y el 110 %, como siempre; por encima, más');
check(dialSueno(ds.slice(0, 3), hoy) === null && dialSueno([{ fecha: hoy, sueno_min: 400 }], hoy).estado === 'sin_media', 'sin la fila de hoy, no hay dial; sin 3 días, sin media');
check(horasMin(395) === '6:35' && horasMin(60) === '1:00', 'las horas, como en un reloj (6:35)');
const rv = relojDeUnVistazo(ds, hoy);
check(rv.map((x) => x.clave).join() === 'pasos,sueno_min,fc_reposo,hrv' && rv[0].hoy === null && rv[0].media === 9000 && rv[3].hoy === 41 && rv[3].media === 50, 'tu reloj de un vistazo: hoy y tu media de pasos, sueño, pulso en reposo y HRV');
check(relojDeUnVistazo([], hoy).length === 0, 'sin nada de Salud, nada');

console.log('En la pantalla');
const hoyJsx = readFileSync(join(raiz, 'web/src/ui/atleta/Hoy.jsx'), 'utf8');
const diales = readFileSync(join(raiz, 'web/src/ui/atleta/Diales.jsx'), 'utf8');
check(/fbe-hoy-panel:\$\{api\.uid\(\)\}/.test(hoyJsx) && hoyJsx.includes('visibles.map') && hoyJsx.includes('Lo que has ocultado') && hoyJsx.includes('Ordenar Hoy'), 'Hoy sigue el orden del atleta, pliega lo oculto y lleva «Ordenar Hoy»');
check(/fuera\.open = true/.test(hoyJsx), '«Tu día» abre también una sección oculta');
check(diales.includes("ocultos.has('comida')") && diales.includes("api.saludDiaria(atleta.id") && diales.includes('verPasos ?'), 'los diales nuevos solo piden lo suyo si se ven');
const css = readFileSync(join(raiz, 'web/src/panel-hoy.css'), 'utf8');
check(!/[^\x00-\x7F]/.test(css) && !/#[0-9a-f]{3,6}\b/i.test(css), 'su hoja de estilos: solo ASCII y solo tokens de color');
check(readFileSync(join(raiz, 'web/src/main.jsx'), 'utf8').includes("import './panel-hoy.css';"), 'y se carga');

console.log(`\n${ok} comprobaciones bien, ${fallos} mal`);
if (fallos) process.exit(1);
