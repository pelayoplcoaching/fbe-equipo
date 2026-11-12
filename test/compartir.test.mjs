// Compartir (rama compartir): la lógica pura de logica/compartir.js (formatos, pegatina, los @, el pie de foto, el
// resumen en texto y los datos de las tarjetas de logro). Uso: node test/compartir.test.mjs
import { FORMATOS, formatoValido, tamanoFormato, PEGATINAS_TARJETA, pegatinaTarjeta, limpiarHandle, conArroba, handleEquipo, cifrasTexto, pieDeFoto,
  resumenTexto, datosRecord, datosRecordDeSesion, datosRacha, datosSemanaCompleta, datosEquipoSemana, datosDePost, cifrasCardio, nombreArchivo,
  recordatorioCompartir, HASHTAGS } from '../web/src/logica/compartir.js';
import { PLANTILLAS_TARJETA } from '../web/src/logica/arte.js';
import { PALETAS, paletaValida, paletaDe, limpiarFrase, hashtagsEquipo, TONOS, textoAlternativo, datosComparativa, datosPlanSemana, datosReto, anotarCompartido, textoCompartido, MAX_COMPARTIDOS } from '../web/src/logica/compartir.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lanza = (f) => { try { f(); return false; } catch { return true; } };

console.log('Formatos, plantillas y pegatinas');
check(FORMATOS.length === 2 && formatoValido('historia') && !formatoValido('cuadrado') && tamanoFormato('historia').H === 1920 && tamanoFormato('nada').H === 1350, 'publicación (4:5) e historia (9:16); lo raro, publicación');
check(PLANTILLAS_TARJETA.some(([k]) => k === 'poster') && PALETAS.length === 6 && paletaValida('clara') && !paletaValida('rosa') && paletaDe('bosque').clara === false && paletaDe('clara').clara, 'la plantilla «Póster» y las seis paletas');
check(PEGATINAS_TARJETA[0][0] === '' && PEGATINAS_TARJETA.length === 7 && pegatinaTarjeta('pr') === 'PR' && pegatinaTarjeta('') === null && pegatinaTarjeta('x') === null, 'las pegatinas del equipo, y ninguna');

console.log('\nLos @');
check(limpiarHandle(' @Ana_Fit.21 ') === 'Ana_Fit.21' && limpiarHandle('') === '' && limpiarHandle(null) === '' && conArroba('ana') === '@ana' && conArroba('@ana') === '@ana' && conArroba('') === '', 'sin la arroba al guardar, con ella al enseñar');
check(lanza(() => limpiarHandle('ana lópez')) && lanza(() => limpiarHandle('a'.repeat(31))) && lanza(() => limpiarHandle('ana!')), 'lo que Instagram no admite, no');
check(handleEquipo({ instagram: '@fbe.coaching' }) === 'fbe.coaching' && handleEquipo({}) === '' && handleEquipo({ instagram: 'mal!nombre' }) === '' && handleEquipo(undefined) === '', 'el @ del equipo, de config.js (y si no vale, ninguno)');

console.log('\nEl texto');
const d = { nombre: 'Pierna A', fecha: '2026-11-08', minutos: 52, series: 18, tonelaje: 4230, records: [{ nombre: 'Sentadilla', texto: '1RM estimado 120 kg (antes 117,5)' }],
  mejores: [{ nombre: 'Sentadilla', serie: '100 kg × 5' }, { nombre: 'Prensa', serie: '180 kg × 10' }, { nombre: 'Zancadas', serie: '20 kg × 12' }] };
check(cifrasTexto(d) === '52 min · 18 series · 4,2 t · 1 récord' && cifrasTexto({ series: 1 }) === '1 serie' && cifrasTexto({}) === '', 'las cifras en una línea');
const pie = pieDeFoto(d, { handle: 'ana_fit', equipo: 'fbecoaching' });
check(pie.startsWith('Pierna A ✅ 52 min · 18 series · 4,2 t · 1 récord\n🏆 Sentadilla: 1RM estimado 120 kg (antes 117,5)\n@ana_fit · Entreno con @canal-demo\n') && pie.endsWith(HASHTAGS.join(' ')), 'el pie de foto: la frase, los récords, los @ y las etiquetas');
check(pieDeFoto(d, { equipo: '' }).includes('Entrenado con FBE Coaching') && !pieDeFoto(d, { equipo: '' }).includes('@'), 'sin @, la firma de siempre');
check(pieDeFoto({ nombre: 'Rodillo', cardio: { modalidad: 'bici', minutos: 40, km: 20 } }, { equipo: '' }).startsWith('Rodillo 🏃 40 min, 20 km (30 km/h)'), 'una sesión de cardio');
check(pieDeFoto({ nombre: 'Sentadilla', cifra: { v: '120', u: 'kg' }, lineas: ['100 kg × 5'] }, { tipo: 'record', equipo: '' }).startsWith('🏆 Nuevo récord en Sentadilla: 120 kg · 100 kg × 5'), 'un récord');
check(pieDeFoto({ cifra: { v: '8', t: 'semanas seguidas' }, lineas: ['Todas las sesiones de cada semana, hechas'] }, { tipo: 'racha', equipo: '' }).startsWith('🔥 8 semanas seguidas: Todas'), 'la racha');
const res = resumenTexto(d, { equipo: '' });
check(res.startsWith('🏋️ Pierna A · 8 nov\n52 min · 18 series · 4,2 t · 1 récord\n\n🏆 Sentadilla: 1RM estimado 120 kg (antes 117,5)\n\n• Prensa: 180 kg × 10\n• Zancadas: 20 kg × 12\n'), 'el resumen para el grupo: cifras, récords y las mejores series (los ejercicios con récord no se repiten)');
check(!resumenTexto(d, { conKilos: false, equipo: '' }).includes('180 kg') && resumenTexto(d, { conKilos: false, equipo: '' }).includes('• Prensa'), 'sin kilos, solo los nombres');

console.log('\nLas tarjetas de logro');
const rec = datosRecord({ nombre: 'Sentadilla', e1rm: { valor: 120, kg: 100, reps: 5, rpe: 8, fecha: '2026-11-08' } }, { puntos: [{ x: '2026-06-01', y: 100 }, { x: '2026-09-10', y: 112.5 }, { x: '2026-11-08', y: 120 }] });
check(rec.tipo === 'record' && rec.cifra.v === '120' && rec.cifra.u === 'kg' && rec.lineas[0] === '100 kg × 5 a RPE 8' && rec.lineas[1] === '+7,5 kg desde el anterior (10 sep)' && rec.lineas[2] === '+20 % desde tu primera marca (1 jun)', 'un récord de la vitrina: la serie, lo que sube desde el anterior y desde el primero');
check(datosRecord({ nombre: 'Dominadas', repsSinCarga: 14, ultimoRecord: '2026-11-01' }, { puntos: [{ x: '2026-10-01', y: 12 }] }).cifra.t === 'repeticiones' && datosRecord({ nombre: 'Dominadas', repsSinCarga: 14 }, null).lineas.length === 0, 'sin carga, las repeticiones; sin historia, solo la cifra');
const rs = datosRecordDeSesion({ nombre: 'Press banca', s: { kg: 80, reps: 6, rir: 2 }, r: { tipo: 'e1rm', valor: 97.6, antes: 95, texto: '…' } }, '2026-11-08');
check(rs.cifra.v === '97,6' && rs.lineas[0] === '80 kg × 6' && rs.lineas[1] === '+2,6 kg desde el anterior' && rs.fecha === '2026-11-08', 'un récord del resumen de la sesión');
check(datosRecordDeSesion({ nombre: 'Flexiones', s: { reps: 30 }, r: { tipo: 'reps', reps: 30, antes: 27 } }).lineas[1] === '+3 desde el anterior' && datosRecordDeSesion({ nombre: 'Peso muerto', s: { kg: 150, reps: 3 }, r: { tipo: 'kg', kg: 150, reps: 3, antes: 145 } }).cifra.t === 'a 3 repeticiones', 'de repeticiones y de kilos a esas repeticiones');
const ra = datosRacha(8, { hoy: '2026-11-08' });
check(ra.nombre === 'Sin fallar una semana' && ra.cifra.v === '8' && ra.cifra.t === 'semanas seguidas' && ra.llama && ra.lineas[0].includes('hechas'), 'la racha');
const se = datosSemanaCompleta({ lunes: '2026-11-02', domingo: '2026-11-08', hechas: 4, previstas: 4, minutos: 210, tonelaje: 16400, records: 2, racha: 3 });
check(se.etiqueta === 'Semana completa' && se.nombre === 'Del 2 nov al 8 nov' && se.lineas.join('|') === '4 de 4 sesiones|210 min entrenando|16,4 t movidas|2 récords|🔥 3 semanas seguidas', 'la semana completa');
const eq = datosEquipoSemana({ sesiones: 42, semana_completa: 5, miembros: 12, records: 3, retos: 1 });
check(eq.cifra.v === '42' && eq.lineas.join('|') === '5 de 12 con la semana completa|3 récords|1 reto en marcha', 'la semana del equipo (solo recuentos)');
const pe = datosDePost({ tipo: 'entreno', creado_en: '2026-11-07T18:00:00Z', resumen: { nombre: 'Torso B', fecha: '2026-11-07', minutos: 50, series: 16, con_kilos: true, ejercicios: [{ nombre: 'Press banca', kg: 80, reps: 6, e1rm: 97.6, record: true }, { nombre: 'Remo', kg: 60, reps: 10 }] } });
check(pe.tipo === 'sesion' && pe.nombre === 'Torso B' && pe.series === 16 && pe.records[0].nombre === 'Press banca' && pe.mejores[1].serie === '60 kg × 10' && pe.sinTonelaje, 'un entreno del muro, para fuera');
check(datosDePost({ tipo: 'entreno', resumen: { nombre: 'X', ejercicios: [{ nombre: 'A', kg: 50, reps: 5 }] } }).mejores[0].serie === '', 'sin kilos en el muro, sin kilos fuera');
const pl = datosDePost({ tipo: 'logro', creado_en: '2026-11-07T18:00:00Z', resumen: { titulo: 'Noviembre a tope', hechas: 12, objetivo: 12, medida: 'sesiones', modo: 'individual', desde: '2026-11-01', hasta: '2026-11-30' } });
check(pl.tipo === 'logro' && pl.etiqueta === 'Reto conseguido' && pl.cifra.v === '12' && pl.lineas[0] === '12 de 12 sesiones' && pl.lineas[1] === 'Del 1 nov al 30 nov', 'un reto conseguido');
const pa = datosDePost({ tipo: 'aniversario', creado_en: '2026-11-07T18:00:00Z', resumen: { meses: 12 } });
check(pa.etiqueta === 'Aniversario' && pa.nombre === '1 año en FBE' && pa.cifra.v === '1' && pa.cifra.t === 'año entrenando', 'un aniversario');
check(cifrasCardio({ modalidad: 'carrera', minutos: 30, km: 5 }).map((c) => `${c.v} ${c.u}`).join('|') === '30 min|5 km|6:00 min/km' && cifrasCardio({ modalidad: 'bici', minutos: 60 }).length === 1 && cifrasCardio(null).length === 0, 'las cifras del cardio');
check(nombreArchivo(d) === 'fbe-2026-11-08-pierna-a.png' && nombreArchivo(d, 'historia') === 'fbe-2026-11-08-pierna-a-historia.png' && nombreArchivo({ tipo: 'record' }).includes('-record'), 'el nombre del archivo');

console.log('\n(Tanda 2) paletas, frase, tonos y texto alternativo');
check(limpiarFrase('  Hoy   no apetecía  ') === 'Hoy no apetecía' && limpiarFrase('a'.repeat(90)).length === 70 && limpiarFrase(null) === '', 'la frase propia, limpia y hasta 70');
check(hashtagsEquipo({ hashtags: ['fbe', '#TeamFBE', 'mal nombre!'] }).join(' ') === '#fbe #TeamFBE #malnombre' && hashtagsEquipo({}).join(' ') === '#FBE #FuerzaBasadaEnEvidencia #Entreno', 'los hashtags del equipo (de config.js) o los de FBE');
check(TONOS.length === 3 && pieDeFoto(d, { tono: 'chispa', equipo: '' }).split('\n').length === 5 && pieDeFoto(d, { tono: 'sobrio', equipo: '' }).split('\n').length === 4, 'con chispa o con humor, una línea más; sobrio, no');
check(pieDeFoto(d, { tono: 'humor', equipo: '' }) === pieDeFoto(d, { tono: 'humor', equipo: '' }) && pieDeFoto({ ...d, frase: 'Sin excusas' }, { equipo: '' }).includes('«Sin excusas»'), 'el remate no cambia entre dos llamadas; la frase propia va en el texto');
check(textoAlternativo(d).startsWith('Tarjeta de entrenamiento de FBE Equipo: Pierna A, 8 nov. 52 min') && textoAlternativo(ra, 'racha').includes('8') && textoAlternativo(ra, 'racha').includes('semanas seguidas'), 'el texto alternativo');

console.log('\n(Tanda 2) antes y ahora, el plan de la semana, el reto y lo compartido');
const cmp = datosComparativa({ nombre: 'Sentadilla' }, [{ semana: '2026-05-04', valor: 100 }, { semana: '2026-08-03', valor: 110 }, { semana: '2026-11-02', valor: 120 }], { unidad: 'kg', metrica: '1RM estimado' });
check(cmp.tipo === 'comparativa' && cmp.comparar.antes.v === '100' && cmp.comparar.ahora.v === '120' && cmp.comparar.antes.fecha === '4 may' && cmp.lineas[0] === '+20 % en 6 meses' && cmp.puntos.length === 3, 'antes y ahora, con la gráfica');
check(datosComparativa({ nombre: 'X' }, [{ semana: '2026-05-04', valor: 100 }]) === null, 'con un solo punto, nada');
const plan = datosPlanSemana({ fecha_inicio: '2026-11-09' }, [{ nombre: 'Pierna A', dia_previsto: '2026-11-10', completada: true, fecha_realizada: '2026-11-09' }, { nombre: 'Torso', dia_previsto: '2026-11-12' }, { nombre: 'Full', dia_previsto: null }], '2026-11-10');
check(plan.lista.length === 7 && plan.lista[0].texto === 'Pierna A' && plan.lista[0].hecha && plan.lista[1].texto === 'Descanso' && plan.lista[1].hoy && plan.lista[3].texto === 'Torso' && plan.lineas[0] === 'Sin día aún: Full' && plan.cifra.v === '3', 'el plan: un día por fila (la hecha, en su día real), los libres y lo sin día');
const reto = datosReto({ titulo: 'Noviembre a tope', objetivo: 12, medida: 'sesiones', modo: 'individual', desde: '2026-11-01', hasta: '2026-11-30', progreso: [{ hechas: 12 }, { hechas: 5 }, { hechas: 8 }] }, '2026-11-10');
check(reto.tipo === 'reto' && reto.cifra.v === '12' && reto.lineas[0] === '12 sesiones cada uno · 1 ya lo tiene' && reto.lineas[1] === '3 personas participan' && reto.lineas[2] === 'Quedan 20 días (hasta el 30 nov)', 'el reto en marcha, solo recuentos');
check(datosReto({ titulo: 'E', objetivo: 100, medida: 'cardio', modo: 'equipo', total: 40, hasta: '2026-11-10' }, '2026-11-10').lineas.join('|') === '40 de 100 minutos de cardio entre todo el equipo|Último día', 'de equipo, el último día');
let lista = anotarCompartido([], { datos: d, tipo: 'sesion', plantillas: true, opciones: { plantilla: 'foto', foto: {}, formato: 'historia', paleta: 'brasa' } }, '2026-11-08T20:00:00Z');
check(lista.length === 1 && lista[0].opciones.plantilla === 'minima' && !('foto' in lista[0].opciones) && lista[0].opciones.paleta === 'brasa' && textoCompartido(lista[0]) === 'Pierna A · 8 nov', 'lo compartido: qué y cómo, sin la foto (con tu foto pasa a mínima)');
lista = anotarCompartido(lista, { datos: d, tipo: 'sesion', plantillas: true, opciones: { plantilla: 'cifras' } });
check(lista.length === 1 && lista[0].opciones.plantilla === 'cifras', 'la misma tarjeta otra vez la sustituye');
for (let i = 0; i < 15; i++) lista = anotarCompartido(lista, { datos: { ...rs, nombre: `E${i}` }, tipo: 'record', logro: true });
check(lista.length === MAX_COMPARTIDOS && lista[0].logro && textoCompartido(lista[0]) === 'Nuevo récord · E14', 'como mucho 12, la última primero');

console.log('\nEl recordatorio de Hoy');
const est = { sesionId: 's1', fecha: '2026-11-07', records: ['Sentadilla'], tarjetas: [rs] };
check(recordatorioCompartir(est, '2026-11-08')?.titulo === 'Tu récord de ayer en Sentadilla' && recordatorioCompartir({ ...est, fecha: '2026-11-08' }, '2026-11-08').titulo.includes('de hoy'), 'el récord de ayer (o de hoy)');
check(recordatorioCompartir({ ...est, records: ['A', 'B'] }, '2026-11-08').titulo === 'Tus 2 récords de ayer', 'varios récords');
check(recordatorioCompartir({ ...est, compartida: true }, '2026-11-08') === null && recordatorioCompartir({ ...est, quitado: true }, '2026-11-08') === null && recordatorioCompartir(est, '2026-11-12') === null && recordatorioCompartir(null) === null && recordatorioCompartir({ ...est, records: [] }, '2026-11-08') === null, 'ya compartido, quitado, de hace más de 3 días o sin récords: nada');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
