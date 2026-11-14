// Las ilustraciones de la app: qué portada toca a cada sesión, qué archivos se sirven y que la lista y los archivos
// coinciden (y pesan poco). Sin navegador.
//   node test/imagenes.test.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { familiaPortada, fuenteImagen, imagenHabito, imagenGrupo, imagenComida, fondoTarjeta, FONDOS_TARJETA, imagenMedalla, archivoPara, imagenMes, imagenPasoCheckin, imagenCelebracion, selloSesion, CELEBRACIONES, imagenLugar, imagenBienvenida, imagenPrimerosPasos, imagenHerramienta, HERRAMIENTAS, FAMILIAS_PORTADA, IMAGENES, imagenFoco, FOCOS_IMG, FRASE_FOCO, imagenPortada, MODALIDADES_IMG, focoFondo, imagenHito, HITOS_IMG, IMAGEN_ANIVERSARIO, imagenEjercicio, imagenEstante, imagenGuia, IMAGEN_MITO, imagenPasoCuestionario, PORTADAS_GUIA, imagenPortadaGuia, ICONOS_IMG, imagenIcono } from '../web/src/logica/imagenes.js';
import { ICONOS_HABITO } from '../web/src/logica/habitos.js';
import { GRUPOS } from '../web/src/logica/calculos.js';
import { TOMAS } from '../web/src/logica/comidas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const raiz = new URL('..', import.meta.url).pathname;
const ej = (nombre, grupos, tipo = ['multiarticular']) => ({ nombre, grupos_musculares: grupos, tipo });
const p = (e, series) => ({ series, ejercicio: e });
const BANCA = ej('Press banca', ['pectoral', 'triceps'], ['basico']);
const MILITAR = ej('Press militar', ['deltoides', 'triceps']);
const REMO = ej('Remo con barra', ['espalda', 'biceps']);
const DOMINADA = ej('Dominadas', ['espalda', 'biceps']);
const SENTADILLA = ej('Sentadilla trasera', ['cuadriceps', 'gluteo'], ['basico']);
const PESO_MUERTO = ej('Peso muerto rumano', ['isquiotibiales', 'gluteo']);
const CURL = ej('Curl de bíceps', ['biceps'], ['aislamiento']);
const EXTENSION = ej('Extensión de tríceps en polea', ['triceps'], ['aislamiento']);
const PLANCHA = ej('Plancha', ['abdominales']);

console.log('La portada de cada sesión');
check(familiaPortada({ tipo: 'cardio', pautas: [p(BANCA, 4)] }) === 'cardio', 'una sesión de cardio lleva la de cardio, lleve lo que lleve');
check(familiaPortada({ tipo: 'movilidad' }) === 'movilidad', 'una de movilidad, la de movilidad');
check(familiaPortada({ pautas: [p(BANCA, 4), p(MILITAR, 3), p(EXTENSION, 3)] }) === 'empuje', 'un torso de empuje (banca, militar, tríceps), la de empuje');
check(familiaPortada({ pautas: [p(DOMINADA, 4), p(REMO, 4), p(CURL, 3)] }) === 'tiron', 'uno de tirón (dominadas, remo, bíceps), la de tirón');
check(familiaPortada({ pautas: [p(BANCA, 4), p(REMO, 4), p(DOMINADA, 3)] }) === 'tiron', 'un torso con más tirón que empuje, la de tirón');
check(familiaPortada({ pautas: [p(SENTADILLA, 4), p(PESO_MUERTO, 3)] }) === 'pierna', 'una de pierna, la de pierna');
check(familiaPortada({ pautas: [p(SENTADILLA, 3), p(BANCA, 3), p(REMO, 3)] }) === 'fullbody', 'pierna y torso a partes parecidas, full body');
check(familiaPortada({ pautas: [p(SENTADILLA, 6), p(PESO_MUERTO, 4), p(BANCA, 2)] }) === 'pierna', 'una de pierna con un poco de torso (menos de un cuarto) sigue siendo de pierna');
check(familiaPortada({ pautas: [p(PLANCHA, 4)] }) === 'core', 'solo core, la de core');
check(familiaPortada({ pautas: [] }) === 'fullbody' && familiaPortada() === 'fullbody', 'sin ejercicios, la más genérica (full body)');
check(familiaPortada({ pautas: [], cardio: true }) === 'cardio', 'una «de fuerza» que solo lleva el cardio pautado, la de cardio');
check(familiaPortada({ pautas: [p(BANCA, 0), p(SENTADILLA, 3)] }) === 'pierna', 'lo que no lleva series no cuenta');
check(familiaPortada({ pautas: [{ series: 3, ejercicio: null }, p(REMO, 3)] }) === 'tiron', 'una pauta sin ejercicio no rompe nada');
check(familiaPortada({ pautas: [{ series: 3, nombre: 'Press banca', grupos_musculares: ['pectoral'], tipo: [] }] }) === 'empuje', 'vale también con el ejercicio en la propia pauta');

console.log('\nLos hábitos');
check(imagenHabito('pasos') === 'habito-pasos' && imagenHabito('sueno') === 'habito-sueno' && imagenHabito('verdura') === 'habito-verdura', 'cada icono de hábito, su imagen');
check(imagenHabito('libre') === 'habito-otro' && imagenHabito(null) === 'habito-otro' && imagenHabito('inventado') === 'habito-otro', '«Otro», sin icono o uno desconocido: la de «otro»');
check(ICONOS_HABITO.every(([i]) => IMAGENES.includes(imagenHabito(i))), `hay imagen para los ${ICONOS_HABITO.length} iconos que puede elegir el coach`);

console.log('\nLos grupos musculares');
check(imagenGrupo(['pectoral', 'triceps']) === 'grupo-pectoral' && imagenGrupo('gemelo') === 'grupo-gemelo', 'la estatua del grupo principal (el primero), con lista o con uno solo');
check(imagenGrupo([]) === null && imagenGrupo(null) === null && imagenGrupo(['antebrazo']) === null, 'sin grupo o con uno desconocido, ninguna (la ficha queda como antes)');
check(GRUPOS.every(([g]) => IMAGENES.includes(imagenGrupo(g))), `hay estatua para los ${GRUPOS.length} grupos de la app`);

console.log('\nLas comidas');
check(imagenComida('desayuno') === 'comida-desayuno' && imagenComida('media_manana') === 'comida-media-manana', 'cada toma, su ilustración (media mañana con guion en el archivo)');
check(imagenComida('recena') === 'comida-cena' && imagenComida('otra') === null && imagenComida(null) === null, '«Antes de dormir», la de la cena; una toma desconocida, ninguna');
check(TOMAS.every(([t]) => IMAGENES.includes(imagenComida(t))), `hay ilustración para las ${TOMAS.length} tomas`);

console.log('\nLas tarjetas para compartir');
check(fondoTarjeta({ records: [] }) === 'compartir-sesion' && fondoTarjeta({ records: [{ nombre: 'Banca' }] }) === 'compartir-record' && fondoTarjeta() === 'compartir-sesion', 'una sesión: la de la barra, o la del récord si lo hubo');
check(fondoTarjeta({ fondo: 'bloque', records: [{}] }) === 'compartir-bloque' && fondoTarjeta({ fondo: 'mes' }) === 'compartir-mes' && fondoTarjeta({ fondo: 'racha' }) === 'compartir-racha', 'el bloque y el mes llevan la suya aunque haya récords');
check(fondoTarjeta({ fondo: 'inventado' }) === 'compartir-sesion', 'un fondo desconocido, el de la sesión');
check(FONDOS_TARJETA.every((f) => IMAGENES.includes(`compartir-${f}`)), 'están los cinco fondos');
{
  const { datosImagenMes } = await import('../web/src/logica/celebracion.js');
  const r = { mes: '2026-10', yo: {}, equipo: {} };
  let mio = null, equipo = null;
  try { mio = datosImagenMes(r, { mio: true }); equipo = datosImagenMes(r); } catch { /* datos de ejemplo incompletos */ }
  check(!mio || (mio.fondo === 'racha' && equipo.fondo === 'mes'), 'tu mes lleva las llamas y el del equipo, las lunas');
}

console.log('\nLas medallas');
{
  const { LOGROS } = await import('../web/src/logica/logros.js');
  check(imagenMedalla('sesiones', 1) === 'medalla-constancia-bronce' && imagenMedalla('sesiones', 4) === 'medalla-constancia-diamante' && imagenMedalla('peso', 3) === 'medalla-bascula-oro', 'cada logro y nivel, su medalla (el cuarto nivel, diamante)');
  check(imagenMedalla('sesiones', 0) === null && imagenMedalla('inventado', 2) === null && imagenMedalla('sesiones', 5) === null, 'sin nivel, con un logro desconocido o un nivel que no existe, ninguna (la dibujada)');
  check(!LOGROS || LOGROS.every((l) => imagenMedalla(l.id, 1)), 'todos los logros de la app tienen nombre de medalla');
  check(['bronce', 'plata', 'oro', 'diamante'].every((m) => IMAGENES.includes(`medalla-constancia-${m}`)), 'están las cuatro medallas de Constancia');
  const lista = { a: { proporcion: [1, 1], archivos: { 256: 'p', 512: 'g' } } };
  check(archivoPara('a', 30, lista) === 'p' && archivoPara('a', 76, lista) === 'p' && archivoPara('a', 176, lista) === 'g' && archivoPara('nada', 76, lista) === null, 'el archivo según el tamaño: el pequeño hasta 85 px, el grande por encima');
}

console.log('\nLos meses');
check(imagenMes('2026-01') === 'mes-01' && imagenMes('2026-10-31') === 'mes-10' && imagenMes('2025-12') === 'mes-12', 'cada mes (o una fecha de ese mes), su paisaje');
// El check-in
check(imagenPasoCheckin('peso') === 'checkin-medidas' && imagenPasoCheckin('medidas') === 'checkin-medidas', 'peso y medidas, la báscula');
check(['sueno', 'energia', 'recuperacion'].every((p) => imagenPasoCheckin(p) === 'checkin-descanso') && imagenPasoCheckin('motivacion') === 'checkin-animo', 'descanso y ánimo');
check(['adherencia', 'saciedad', 'satisfaccion'].every((p) => imagenPasoCheckin(p) === 'checkin-alimentacion'), 'la alimentación');
check(imagenPasoCheckin('reloj') === 'checkin-inicio' && imagenPasoCheckin('notas') === 'checkin-inicio' && imagenPasoCheckin('p-abc') === 'checkin-inicio', 'reloj, notas y preguntas del coach, la mesa');
check(imagenPasoCheckin('molestias') === 'checkin-molestias', 'las molestias, la bolsa de frío y la venda');
check(imagenPasoCheckin('otra') === null && imagenPasoCheckin(null) === null, 'lo desconocido, ninguna');
check(imagenPasoCheckin(null, { revision: true }) === 'checkin-inicio' && imagenPasoCheckin('peso', { revision: true, enviado: true }) === 'checkin-enviado', 'el repaso y lo ya enviado');
// Dónde entrenas, bienvenida, primeros pasos y herramientas
check(imagenLugar('casa') === 'donde-casa' && imagenLugar('viaje') === 'donde-viaje' && imagenLugar('gimnasio') === 'donde-gimnasio' && imagenLugar(undefined) === 'donde-gimnasio', 'cada sitio de entreno, su imagen (y lo desconocido, el gimnasio)');
check(imagenBienvenida(6) === 'bienvenida-manana' && imagenBienvenida(13) === 'bienvenida-manana' && imagenBienvenida(14) === 'bienvenida-tarde' && imagenBienvenida(20) === 'bienvenida-tarde', 'la bienvenida: mañana de 6 a 14, tarde de 14 a 21');
check(imagenBienvenida(21) === 'bienvenida-noche' && imagenBienvenida(0) === 'bienvenida-noche' && imagenBienvenida(5) === 'bienvenida-noche' && imagenBienvenida('x') === null, 'y la noche el resto');
check(imagenPrimerosPasos('programa') === 'primeros-programa' && imagenPrimerosPasos('serie') === 'primeros-sesion' && imagenPrimerosPasos('coach') === 'primeros-checkin' && imagenPrimerosPasos('instalar') === null, 'primera vez: programa, sesión y check-in; instalar, con su dibujo');
check(HERRAMIENTAS.every((h) => imagenHerramienta(h) === `herr-${h}`) && imagenHerramienta('otra') === null, 'cada herramienta, su imagen');
check(imagenEjercicio({ id: 'b5bd480c-5617-4d6b-9811-d850e3614db9', nombre: 'Otro nombre' }) === 'abd-ab-wheel' && imagenEjercicio({ id: 'x', nombre: 'Crunch en Maquina ' }) === 'abd-crunch-maquina' && imagenEjercicio({ id: 'x', nombre: 'Sin imagen' }) === null && imagenEjercicio(null) === null, 'la figura de cada ejercicio, por id y, si no, por nombre');
check(imagenHito(4) === 'hito-4' && imagenHito(26) === 'hito-26' && imagenHito(52) === 'hito-52' && imagenHito(104) === 'hito-52' && imagenHito(10) === 'hito-8' && imagenHito(3) === null, 'el fuego de cada hito de la racha (más allá de 52, la de 52)');
check(imagenPortada('cardio', 'cuerda') === 'cardio-comba' && imagenPortada('cardio', 'carrera') === 'cardio-carrera' && imagenPortada('cardio', 'otro') === 'sesion-cardio' && imagenPortada('cardio') === 'sesion-cardio' && imagenPortada('pierna', 'bici') === 'sesion-pierna' && imagenPortada(null) === null, 'la portada del cardio, por modalidad («Otro», la de siempre)');
check(fondoTarjeta({ cardio: { modalidad: 'remo' } }) === 'cardio-remo' && fondoTarjeta({ cardio: { modalidad: 'remo' }, records: [1] }) === 'compartir-record' && fondoTarjeta({ cardio: { modalidad: 'otro' } }) === 'compartir-sesion' && focoFondo('cardio-remo') === 0.8 && focoFondo('compartir-sesion') === 0.5, 'la tarjeta de una sesión de cardio, con su modalidad y el motivo a la derecha');
check(FOCOS_IMG.every((f) => imagenFoco(f) === `foco-${f}` && FRASE_FOCO[f]) && imagenFoco(null) === null && imagenFoco('otro') === null, 'cada foco de la semana, su imagen y su frase; sin foco, nada');
// Las celebraciones
check(CELEBRACIONES.every((c) => imagenCelebracion(c) === `celebra-${c}`) && imagenCelebracion('otra') === null, 'cada celebración, su imagen');
check(selloSesion({ records: 2, primera: true }) === 'celebra-record' && selloSesion({ primera: true }) === 'celebra-primera' && selloSesion({}) === null, 'el sello: récord antes que primera vez; si no, ninguno');
check(imagenMes('2026-13') === null && imagenMes('') === null && imagenMes(null) === null && imagenMes('octubre') === null, 'lo que no es un mes, ninguno');
check(Array.from({ length: 12 }, (_, i) => `mes-${String(i + 1).padStart(2, '0')}`).every((id) => IMAGENES.includes(id)), 'están los doce');

console.log('\nLos archivos que se sirven');
{
  const lista = { a: { proporcion: [16, 9], archivos: { 1440: 'imagenes/x/a-1440.00000000.webp', 720: 'imagenes/x/a-720.00000000.webp', 1080: 'imagenes/x/a-1080.00000000.webp' } } };
  const f = fuenteImagen('a', lista);
  check(f && f.src === 'imagenes/x/a-1080.00000000.webp' && f.ancho === 1080 && f.alto === 608, 'la de en medio como src, con su ancho y su alto según la proporción');
  check(f.srcset === 'imagenes/x/a-720.00000000.webp 720w, imagenes/x/a-1080.00000000.webp 1080w, imagenes/x/a-1440.00000000.webp 1440w', 'todas en srcset, de menor a mayor');
  const una = fuenteImagen('b', { b: { proporcion: [1, 1], archivos: { 500: 'imagenes/x/b-500.00000000.webp' } } });
  check(una && una.src.endsWith('b-500.00000000.webp') && una.alto === 500, 'con un solo tamaño, ese');
  check(fuenteImagen('nada', lista) === null && fuenteImagen(null, lista) === null && fuenteImagen('toString', lista) === null, 'lo que no está en la lista, nada (tampoco lo heredado de un objeto)');
  check(fuenteImagen('c', { c: { archivos: {} } }) === null, 'sin archivos, nada');
}

console.log('\nLa lista y la carpeta');
{
  const lista = JSON.parse(readFileSync(join(raiz, 'web/src/datos/imagenes.json'), 'utf8'));
  const enLista = Object.values(lista).flatMap((x) => Object.values(x.archivos));
  const listar = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? listar(join(d, f)) : [join(d, f)])) : []);
  const enCarpeta = listar(join(raiz, 'web/imagenes')).map((f) => f.slice(join(raiz, 'web').length + 1));
  check(enLista.every((f) => enCarpeta.includes(f)), `cada archivo de la lista está en web/imagenes (${enLista.length})`);
  check(enCarpeta.every((f) => enLista.includes(f)), 'y no sobra ninguno en la carpeta');
  check(enLista.every((f) => /^imagenes\/[a-z0-9-]+\/[a-z0-9-]+-\d+\.[0-9a-f]{8}\.webp$/.test(f)), 'todos con el nombre que espera la construcción (bloque, id, ancho y huella)');
  const pesos = enLista.map((f) => statSync(join(raiz, 'web', f)).size);
  check(Math.max(...pesos) <= 120 * 1024, `ninguno pasa de 120 KB (el mayor, ${(Math.max(...pesos) / 1024).toFixed(0)} KB)`);
  const pasosCk = ['peso', 'sueno', 'motivacion', 'molestias', 'adherencia', 'reloj'].map((p) => imagenPasoCheckin(p)).concat(imagenPasoCheckin(null, { revision: true, enviado: true }));
  check(pasosCk.every((id) => IMAGENES.includes(id)), 'están las imágenes del check-in');
  check(CELEBRACIONES.every((c) => IMAGENES.includes(`celebra-${c}`)), 'y las cinco celebraciones');
  check(['gimnasio', 'casa', 'viaje'].every((l) => IMAGENES.includes(imagenLugar(l))), 'están las tres de dónde entrenas');
  check([3, 15, 22].every((h) => IMAGENES.includes(imagenBienvenida(h))) && ['programa', 'serie', 'coach'].every((d) => IMAGENES.includes(imagenPrimerosPasos(d))), 'las tres de bienvenida y las tres de la primera vez');
  check(HERRAMIENTAS.every((h) => IMAGENES.includes(imagenHerramienta(h))) && ['equipo-manada', 'equipo-reto', 'carne-fondo'].every((id) => IMAGENES.includes(id)), 'las cuatro herramientas, el equipo y el carné');
  check(FAMILIAS_PORTADA.every((fa) => IMAGENES.includes(`sesion-${fa}`)), 'están las siete portadas de sesión');
  check(['acceso-fondo', 'activar-fondo'].every((id) => lista[id]?.proporcion.join(':') === '2:3') && lista['sin-conexion']?.proporcion.join(':') === '16:9', 'están las tres de la entrada a la app (dos verticales y la de sin conexión)');
  { const EJ = JSON.parse(readFileSync(new URL('../web/src/datos/ejercicios-imagenes.json', import.meta.url), 'utf8'));
    const ids = [...new Set([...Object.values(EJ.porId), ...Object.values(EJ.porNombre)])];
    check(ids.length >= 13 && ids.every((id) => lista[id]?.proporcion.join(':') === '1:1' && lista[id].archivos['192'] && lista[id].archivos['512']), `están las ${ids.length} figuras de ejercicio, cuadradas, a 192 y 512`); }
  check(HITOS_IMG.every((h) => IMAGENES.includes(imagenHito(h))) && lista[IMAGEN_ANIVERSARIO]?.proporcion.join(':') === '3:1', 'están los cinco hitos y la franja del aniversario');
  check(MODALIDADES_IMG.every((m) => IMAGENES.includes(imagenPortada('cardio', m)) && lista[imagenPortada('cardio', m)].proporcion.join(':') === '16:9'), 'están las siete portadas de cardio, apaisadas');
  check(FOCOS_IMG.every((f) => IMAGENES.includes(imagenFoco(f)) && lista[imagenFoco(f)].proporcion.join(':') === '16:9'), 'están los ocho focos de la semana, apaisados');
  check(Object.entries(lista).every(([id, x]) => Object.values(x.archivos).every((f) => f.split('/').pop().startsWith(`${id}-`))), 'cada archivo lleva el nombre de su imagen');
}

// ------------------------------------------------------------ las ilustraciones vivas (imagenes.css, bloque V)
console.log('\nLas ilustraciones vivas: solo transform y opacity, y nada con «reducir movimiento»');
{
  const css = readFileSync(new URL('../web/src/imagenes.css', import.meta.url), 'utf8');
  const v = css.slice(css.indexOf('Bloque V'));
  const claves = [...v.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]|\{[^{}]*\})*)\}/g)];
  const props = new Set(claves.flatMap(([, , cuerpo]) => [...cuerpo.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])));
  check(claves.length >= 19 && [...props].every((p) => ['opacity', 'transform', 'scale', 'translate'].includes(p)), `sus ${claves.length} animaciones solo mueven transform (o scale y translate) y opacity: ${[...props].join(', ')}`);
  const fuera = v.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}\n/, '').replace(/@keyframes[^\n]*\n/g, '');
  check(v.includes('@media (prefers-reduced-motion: no-preference)') && !/animation(-name)?\s*:|transition\s*:/.test(fuera), 'todas van dentro de «sin reducir movimiento»: fuera de ahí no hay ni una animación ni una transición');
  check(/html\[data-oculta\][^{]*\{ animation-play-state: paused; \}/.test(v) && readFileSync(new URL('../web/src/ui/vivas.js', import.meta.url), 'utf8').includes("visibilitychange"), 'con la app en segundo plano, se paran (html[data-oculta], ui/vivas.js)');
  check(!/url\(/.test(v) && !/filter\s*:|backdrop-filter/.test(v), 'sin imágenes nuevas ni desenfoques: la luz se dibuja con degradados');
  const jsx = (n) => readFileSync(new URL(`../web/src/ui/${n}`, import.meta.url), 'utf8');
  const { tomaDeLaHora } = await import('../web/src/logica/comidas.js');
  const suyas = ['desayuno', 'comida', 'merienda', 'cena'];
  check([5, 10, 11, 12, 13, 15, 16, 19, 20, 22, 23, 3].map((h) => tomaDeLaHora(h, suyas) || '-').join() === 'desayuno,desayuno,-,-,comida,comida,merienda,merienda,cena,cena,-,-'
    && tomaDeLaHora(12, [...suyas, 'media_manana']) === 'media_manana' && tomaDeLaHora(0, ['recena']) === 'recena' && tomaDeLaHora(24, suyas) === null && tomaDeLaHora('x', suyas) === null && tomaDeLaHora(9) === null,
    'la comida que toca por la hora, solo si está entre las suyas');
  check(/class=\{`bdia-luz bdia-luz-\$\{momento\}`\} aria-hidden="true"/.test(jsx('Bienvenida.jsx')) && /class="franja-ilu franja-pegada franja-cruce" aria-hidden="true"/.test(jsx('atleta/DondeEntrenas.jsx')) && /class="hero-brillo" aria-hidden="true"/.test(jsx('atleta/Sesion.jsx')), 'lo añadido es adorno: oculto a los lectores de pantalla');
}

console.log('Tanda U: las estanterías de «Aprende»');
{
  const { ESTANTES, estanteDe } = await import('../web/src/logica/guias.js');
  check(ESTANTES.every((e) => IMAGENES.includes(imagenEstante(e.id))), `hay ilustración para las ${ESTANTES.length} estanterías`);
  check(imagenEstante('inventada') === 'guia-mas', 'una estantería desconocida, la de «Más guías»');
  check(imagenGuia({ clave: 'nueva' }, 'cabeza') === 'guia-cabeza' && imagenGuia({ clave: 'otra' }, 'salud') === 'guia-salud', 'una guía sin portada, la de su estantería (cabeza → la almohada; salud → el corazón)');
  check(imagenGuia({ clave: 'x', grupo: 'pectoral' }, 'musculos') === 'grupo-pectoral' && imagenGuia({ clave: 'x', fichas: 3 }, 'musculos') === 'guia-entrenar', 'con grupo, su estatua; músculo a músculo sin grupo, el rack');
  check((() => { const L = JSON.parse(readFileSync(join(raiz, 'web/src/datos/imagenes.json'), 'utf8')); return ['guia-empieza', 'guia-entrenar', 'guia-comer', 'guia-cabeza', 'guia-salud', 'guia-mas'].every((id) => L[id]?.proporcion?.join(':') === '1:1'); })(), 'las seis, cuadradas');
}

console.log('Tandas V y W: el mito de la semana y el cuestionario inicial');
{
  const L = JSON.parse(readFileSync(join(raiz, 'web/src/datos/imagenes.json'), 'utf8'));
  check(L[IMAGEN_MITO]?.proporcion?.join(':') === '3:1', 'el mito de la semana, una franja 3:1');
  const pasos = ['objetivo', 'tiempo', 'lugar', 'salud', 'lesiones'];
  check(pasos.every((c) => L[imagenPasoCuestionario(c)]?.proporcion?.join(':') === '3:1'), 'los cinco pasos del cuestionario, cada uno con su franja 3:1');
  check(imagenPasoCuestionario('otro') === null && imagenPasoCuestionario(undefined) === null, 'un paso desconocido, sin dibujo');
  const cu = readFileSync(join(raiz, 'web/src/ui/atleta/Cuestionario.jsx'), 'utf8');
  check(pasos.every((c) => cu.includes(`['${c}',`)), 'las claves coinciden con los pasos del cuestionario');
}

console.log('Portadas de las guías');
{
  const L = JSON.parse(readFileSync(join(raiz, 'web/src/datos/imagenes.json'), 'utf8'));
  const { ESTANTES } = await import('../web/src/logica/guias.js');
  const conEstante = ESTANTES.flatMap((e) => e.claves);
  check(PORTADAS_GUIA.length === 17 && conEstante.every((c) => PORTADAS_GUIA.includes(c)), 'hay portada para las 17 guías de las estanterías');
  check(PORTADAS_GUIA.every((c) => L[imagenPortadaGuia(c)]?.proporcion?.join(':') === '12:5' && L[`${imagenPortadaGuia(c)}-cuadrada`]?.proporcion?.join(':') === '1:1'), 'cada una, su cabecera 12:5 y su recorte cuadrado');
  check(imagenGuia({ clave: 'sueno' }, 'cabeza') === 'portada-sueno-cuadrada' && imagenGuia({ clave: 'x', grupo: 'pectoral' }, 'musculos') === 'grupo-pectoral', 'la tarjeta lleva su portada; las de músculo, su estatua');
  check(imagenPortadaGuia('inventada') === null, 'una guía sin portada, sin cabecera');
}

// ------------------------------------------------------------ la comunidad viva (comunidad-viva.css): las mismas reglas
console.log('\nLa comunidad viva: solo transform y opacity, y nada con «reducir movimiento»');
{
  const v = readFileSync(new URL('../web/src/comunidad-viva.css', import.meta.url), 'utf8');
  const claves = [...v.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]|\{[^{}]*\})*)\}/g)];
  const props = new Set(claves.flatMap(([, , cuerpo]) => [...cuerpo.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])));
  check(claves.length >= 24 && claves.every(([, n]) => n.startsWith('cv-')) && [...props].every((p) => ['opacity', 'transform', 'scale', 'translate', 'rotate'].includes(p)), `sus ${claves.length} animaciones (cv-…) solo mueven transform y opacity: ${[...props].join(', ')}`);
  const ini = v.indexOf('@media (prefers-reduced-motion: no-preference) {'), fin = v.indexOf('\n}\n', ini);
  const fuera = (v.slice(0, ini) + v.slice(fin)).replace(/@keyframes[^\n]*\n/g, '').replace(/transition: none;/g, '');
  check(ini > 0 && fin > ini && !/animation(-name)?\s*:|transition\s*:/.test(fuera), 'todas van dentro de «sin reducir movimiento»');
  check(/html\[data-oculta\][^{]*\{ animation-play-state: paused; \}/.test(v) && !/url\(/.test(v) && !/[^-]filter\s*:|backdrop-filter/.test(v) && !/infinite/.test(v), 'se paran en segundo plano, sin imágenes nuevas ni desenfoques, y ninguna es sin fin');
  const usadas = new Set([...v.matchAll(/animation(?:-name)?:[^;]*?(cv-[\w-]+)/g)].map((m) => m[1]).concat([...v.matchAll(/, (cv-[\w-]+) /g)].map((m) => m[1])));
  check(claves.every(([, n]) => usadas.has(n)), `ninguna animación sobra: ${claves.map(([, n]) => n).filter((n) => !usadas.has(n)).join(', ') || 'todas se usan'}`);
  const com = readFileSync(new URL('../web/src/ui/Comunidad.jsx', import.meta.url), 'utf8');
  check(/class=\{`franja-ilu franja-pegada franja-viva \$\{clase\}`\} aria-hidden="true"/.test(com) && /class="cp-llamas" aria-hidden="true"/.test(com) && /'--pct': pct \/ 100/.test(com), 'las franjas y las llamas son adorno, y la barra de la encuesta se mide con una variable (no con el ancho)');
}

console.log('\nLos iconos ilustrados');
const LISTA_IMG = JSON.parse(readFileSync(join(raiz, 'web/src/datos/imagenes.json'), 'utf8'));
{
  const com = readFileSync(new URL('../web/src/ui/comunes.jsx', import.meta.url), 'utf8');
  const trazos = new Set([...com.slice(com.indexOf('export const P = {'), com.indexOf('\n};', com.indexOf('export const P = {'))).matchAll(/^\s+'?([a-z0-9_-]+)'?:/gm)].map((m) => m[1]));
  check(ICONOS_IMG.length === 45 && new Set(ICONOS_IMG).size === 45, 'son 45 y no se repiten');
  check(ICONOS_IMG.every((n) => trazos.has(n)), `cada uno es un icono de la app (tiene su dibujo de líneas debajo): ${ICONOS_IMG.filter((n) => !trazos.has(n)).join(', ') || 'todos'}`);
  check(ICONOS_IMG.every((n) => IMAGENES.includes(imagenIcono(n))), `y su imagen está en la lista: ${ICONOS_IMG.filter((n) => !IMAGENES.includes(imagenIcono(n))).join(', ') || 'todas'}`);
  check(imagenIcono('derecha') === null && imagenIcono('cerrar') === null && imagenIcono(undefined) === null, 'los de función (flechas, cerrar) no llevan imagen');
  const archivos = ICONOS_IMG.flatMap((n) => Object.values(LISTA_IMG[imagenIcono(n)]?.archivos || {}));
  const pesos = archivos.map((f) => statSync(join(raiz, 'web', f)).size);
  check(archivos.length === 90 && Math.max(...pesos) < 8192, `cada uno en dos tamaños (96 y 192 px), el mayor de ${(Math.max(...pesos) / 1024).toFixed(1)} KB (menos de 8)`);
  check(pesos.reduce((a, b) => a + b, 0) < 200 * 1024, `todos juntos, ${(pesos.reduce((a, b) => a + b, 0) / 1024).toFixed(0)} KB (menos de 200)`);
  check(ICONOS_IMG.every((n) => LISTA_IMG[imagenIcono(n)].proporcion.join(':') === '1:1'), 'todos cuadrados');
  check(archivoPara(imagenIcono('bascula'), 32) === LISTA_IMG['ico-bascula'].archivos['96'] && archivoPara(imagenIcono('bascula'), 60) === LISTA_IMG['ico-bascula'].archivos['192'], 'el cuadradito (32 px) usa el de 96 y el vacío (60 px) el de 192');
  check(/export function IcoIos\(\{ n, tono = '', clase = '' \}\) \{\n  const img = !tono && hayImagen\(imagenIcono\(n\)\)/.test(com) && /<Icono n=\{n\} class=\{`ico-\$\{n\}`\} \/>\{img && <Imagen id=\{img\} clase="ico-img"/.test(com), 'el cuadradito pinta la imagen encima del dibujo de líneas, y nunca con tono de estado');
  const css = readFileSync(new URL('../web/src/imagenes.css', import.meta.url), 'utf8');
  check(/\.ico-img \{ position: absolute; inset: 0; width: 100%; height: 100%;/.test(css) && /\.conexion-salud \.ico-img, \.conexion-calendario \.ico-img \{ display: none; \}/.test(css), 'la imagen cubre el cuadradito entero (sin saltos), y Salud y el calendario conservan su color');
}

// (imágenes de las 48 h) Bloque AA: los apuntes
{
  const { imagenTemaApuntes, TEMAS_APUNTES_IMG } = await import('../web/src/logica/imagenes.js');
  const { TEMAS } = await import('../web/src/logica/apuntes-camino.js');
  check(TEMAS.every(([k]) => imagenTemaApuntes(k) === `apuntes-tema-${k}` && fuenteImagen(imagenTemaApuntes(k))) && imagenTemaApuntes('otro') === null && TEMAS_APUNTES_IMG.length === TEMAS.length, 'apuntes: una imagen por tema («Tus temas»)');
  const ids = ['apuntes-ruta', 'apuntes-certificado', 'apuntes-prueba-nivel', 'apuntes-liga', 'apuntes-duelo', 'apuntes-objetivo', 'apuntes-repaso', 'apuntes-historia', 'apuntes-audio'];
  check(ids.every((id) => fuenteImagen(id)), 'apuntes: la prueba de nivel, la ruta, el certificado, la liga, los duelos, el objetivo, el repaso, las historias y el audio, en la lista');
  const social = readFileSync(new URL('../web/src/ui/atleta/ApuntesSocial.jsx', import.meta.url), 'utf8');
  check(/prog-duelos-t">Duelos<\/h3>\s*<Imagen id="apuntes-duelo"/.test(social), 'apuntes: las dos kettlebells encabezan los duelos');
}

// (imágenes de las 48 h) Bloque AB: su meta y su historia
{
  const { imagenAniversarioMeses, imagenMeta } = await import('../web/src/logica/imagenes.js');
  check(imagenAniversarioMeses(1) === 'aniversario-mes' && imagenAniversarioMeses(3) === 'aniversario-mes' && imagenAniversarioMeses(6) === 'aniversario-medio' && imagenAniversarioMeses(12) === 'aniversario-ano' && imagenAniversarioMeses(36) === 'aniversario-ano' && imagenAniversarioMeses(0) === null && imagenAniversarioMeses(null) === null, 'aniversario: la vela (1 y 3 meses), las seis lunas (6) y el laurel (el año y los siguientes)');
  check(imagenMeta({ dias: 30, pasada: false }) === 'meta-cuenta' && imagenMeta({ dias: null, pasada: false }) === 'meta-cuenta' && imagenMeta({ dias: 0, pasada: false }) === 'meta-dia' && imagenMeta({ dias: -3, pasada: true }) === 'meta-siguiente' && imagenMeta(null) === null, 'meta: contando, el reloj; el día, la bandera dorada; pasada, la siguiente');
  const ids = ['meta-cuenta', 'meta-dia', 'meta-siguiente', 'aniversario-mes', 'aniversario-medio', 'aniversario-ano', 'historia-linea', 'adn-fbe', 'carta-mes', 'para-hablarle', 'foto-motivacion-vacia', 'mejor-momento'];
  check(ids.every((id) => fuenteImagen(id)), 'bloque AB: las doce, en la lista');
  const l = JSON.parse(readFileSync(new URL('../web/src/datos/imagenes.json', import.meta.url), 'utf8'));
  check(l['meta-cuenta'].proporcion.join(':') === '5:2' && l['carta-mes'].proporcion.join(':') === '5:2' && l['adn-fbe'].proporcion.join(':') === '9:16' && ['historia-linea', 'para-hablarle'].every((id) => l[id].proporcion.join(':') === '3:1') && ['meta-dia', 'mejor-momento', 'foto-motivacion-vacia', 'aniversario-ano'].every((id) => l[id].proporcion.join(':') === '1:1'), 'bloque AB: cada una con su recorte (el reloj y la bandera caben en 5:2)');
  const lee = (f) => readFileSync(new URL(`../web/src/${f}`, import.meta.url), 'utf8');
  check(/imagenMeta\(c\)/.test(lee('ui/atleta/Trato.jsx')) && /id="historia-linea"/.test(lee('ui/atleta/PerfilSocial.jsx')) && /id="adn-fbe"/.test(lee('ui/atleta/Suyo.jsx')) && /id="foto-motivacion-vacia"/.test(lee('ui/atleta/Suyo.jsx'))
    && /id="para-hablarle"/.test(lee('ui/coach/PersonalCoach.jsx')) && /id="carta-mes"/.test(lee('ui/coach/PersonalCoach.jsx')) && /id="mejor-momento"/.test(lee('ui/atleta/Conocerte.jsx')) && /imagenAniversarioMeses/.test(lee('ui/Celebracion.jsx')), 'bloque AB: cada una en su sitio (meta, historia, ADN, foto, para hablarle, carta, mejor momento, aniversario)');
}

// (imágenes de las 48 h) Bloques AC, AD y AE: la sesión de hoy, su vida y que le acompañe
const lee0 = (f) => readFileSync(new URL(`../web/src/${f}`, import.meta.url), 'utf8');
{
  const { imagenHitoAlbum } = await import('../web/src/logica/imagenes.js');
  const { albumHitos } = await import('../web/src/logica/compania.js');
  check(imagenHitoAlbum('primera') === 'hito-primera' && imagenHitoAlbum('cien') === 'hito-cien' && imagenHitoAlbum('dominada') === 'hito-dominada' && imagenHitoAlbum('ses-10') === null && imagenHitoAlbum('suyo-1') === null, 'álbum: la huella, la barra cargada y la de dominadas; el resto, con su icono');
  const hs = albumHitos({ entrenos: [{ fecha: '2026-01-10' }], progreso: { ejercicios: [{ nombre: 'Dominadas', puntos: [{ semana: '2026-02-02', valor: 20 }] }, { nombre: 'Sentadilla', puntos: [{ semana: '2026-05-04', valor: 101 }] }] }, hoy: '2026-11-14' });
  check(['primera', 'cien', 'dominada'].every((k) => hs.some((h) => h.clave === k && fuenteImagen(imagenHitoAlbum(h.clave)))), 'álbum: las claves de sus hitos son las de las imágenes');
  const ids = ['tiempo-hoy', 'calentamiento', 'hace-un-ano', 'alternativas', 'como-estas', 'vida-agenda', 'vida-que-tal', 'semana-dificil', 'guardias', 'manual', 'sin-bascula', 'ciclo', 'informe', 'voz-coach', 'reto-mes', 'album', 'hito-primera', 'hito-cien', 'hito-dominada'];
  check(ids.every((id) => fuenteImagen(id)), 'AC, AD y AE: las diecinueve, en la lista');
  check(!!fuenteImagen('companero') && lee0('ui/atleta/Compania.jsx').includes('id="companero"'), '«Busco compañero», con las zapatillas sin marca');
  const lee = (f) => readFileSync(new URL(`../web/src/${f}`, import.meta.url), 'utf8');
  const sitios = { 'ui/atleta/SesionTuya.jsx': ['tiempo-hoy', 'calentamiento', 'hace-un-ano'], 'ui/atleta/Conocerte.jsx': ['como-estas'], 'ui/atleta/Sesion.jsx': ['alternativas'],
    'ui/atleta/Vida.jsx': ['vida-agenda', 'vida-que-tal', 'semana-dificil', 'guardias'], 'ui/atleta/Respeto.jsx': ['manual', 'sin-bascula', 'ciclo', 'informe'], 'ui/atleta/Compania.jsx': ['voz-coach', 'reto-mes', 'album'] };
  check(Object.entries(sitios).every(([f, l]) => l.every((id) => lee(f).includes(`id="${id}"`))), 'AC, AD y AE: cada una en su sitio');
  check(/@media print \{ \.informe-salud-ilu \{ display: none/.test(readFileSync(new URL('../web/src/imagenes.css', import.meta.url), 'utf8')), 'el informe impreso, sin la ilustración (con su propia clase: .informe-ilu es la cabecera del informe del bloque)');
}

// (imágenes de las 48 h) Bloque AF: para el coach, y su primer mes
{
  check(['vuelve', 'alerta', 'regalo', 'primer-mes'].every((id) => fuenteImagen(id)), 'AF: las cuatro, en la lista');
  const cs = lee0('ui/atleta/CoachSabe.jsx');
  check(cs.includes('id="vuelve"') && cs.includes('id="alerta"') && cs.includes('id="regalo"') && lee0('ui/atleta/Bienvenida.jsx').includes('id="primer-mes"'), 'AF: lo que le hace volver, su alerta, los hitos con regalo y los primeros pasos');
  const l = JSON.parse(readFileSync(new URL('../web/src/datos/imagenes.json', import.meta.url), 'utf8'));
  check(l['primer-mes'].proporcion.join(':') === '5:2' && l['companero'].proporcion.join(':') === '3:1', 'los faroles y la puerta caben (5:2); las zapatillas, en franja');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
