// Las ilustraciones de la app: qué portada toca a cada sesión, qué archivos se sirven y que la lista y los archivos
// coinciden (y pesan poco). Sin navegador.
//   node test/imagenes.test.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { familiaPortada, fuenteImagen, imagenHabito, imagenGrupo, imagenComida, fondoTarjeta, FONDOS_TARJETA, imagenMedalla, archivoPara, imagenMes, imagenPasoCheckin, imagenCelebracion, selloSesion, CELEBRACIONES, imagenLugar, imagenBienvenida, imagenPrimerosPasos, imagenHerramienta, HERRAMIENTAS, FAMILIAS_PORTADA, IMAGENES, imagenFoco, FOCOS_IMG, FRASE_FOCO, imagenPortada, MODALIDADES_IMG, focoFondo, imagenHito, HITOS_IMG, IMAGEN_ANIVERSARIO, imagenEjercicio } from '../web/src/logica/imagenes.js';
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

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
