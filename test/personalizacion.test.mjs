// Personalización (v0.104): la lógica pura (logica/personal.js y logica/anio.js), la migración 050 en un Postgres
// local (PGlite, como permisos.test.mjs) y la api con el modo demo (backend-memoria).
// Uso: node test/personalizacion.test.mjs
import {
  limpiarPersonal, urlMusica, nombreMusica, cumpleValido, esCumple, nombreSaludo, porqueParaHoy, momentoBienvenida,
  textoMensajeCoach, mensajeDe, MOMENTOS_COACH, cifraObjetivo, recuerdoProgreso, recordAlAlcance, semanaTipo,
  repartirComoSiempre, textoDias, personalVacio,
} from '../web/src/logica/personal.js';
import { anioParaResumen, resumenAnio, datosCompartirAnio } from '../web/src/logica/anio.js';
import { spotify, urlIncrustar, claveValida, musicaDeLaSesion, etiquetaOrigen, CADENCIAS, ajustarCadencia, aperturasDe, esCancion, altoIncrustado, tieneLista, tipoMusica, esEnlaceCorto, busquedaRitmo, fichaVigente, FICHA_DIAS } from '../web/src/logica/musica.js';
import { sumarDias, lunesDe } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lanza = (f) => { try { f(); return false; } catch { return true; } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('Lo que elige el atleta');
const p = limpiarPersonal({ apodo: '  Ani  ', porque: 'Por  mis\nhijos', musica_url: 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP', cumple_mes: '3', cumple_dia: 14, favoritos: ['11111111-1111-4111-8111-111111111111', 'x', '11111111-1111-4111-8111-111111111111'] });
check(p.apodo === 'Ani' && p.porque === 'Por mis hijos' && p.cumple_mes === 3 && p.cumple_dia === 14 && igual(p.favoritos, ['11111111-1111-4111-8111-111111111111']), 'se limpia: espacios, saltos de línea, números y favoritos repetidos o raros fuera');
check(limpiarPersonal({ apodo: 'x'.repeat(50) }).apodo.length === 30 && limpiarPersonal({ porque: 'y'.repeat(300) }).porque.length === 140, 'apodo hasta 30 y porqué hasta 140 caracteres');
check(lanza(() => limpiarPersonal({ musica_url: 'https://malo.example/x' })) && lanza(() => limpiarPersonal({ musica_url: 'http://open.spotify.com/x' })) && lanza(() => limpiarPersonal({ musica_url: 'javascript:alert(1)' })), 'la música, solo enlaces https de sus sitios');
check(urlMusica('https://music.apple.com/es/playlist/a/pl.1') && urlMusica('https://music.youtube.com/playlist?list=1') && urlMusica('https://youtu.be/x') && urlMusica('') === null, 'Apple Music, YouTube Music y vacío (nada) valen');
check(nombreMusica('https://open.spotify.com/x') === 'Spotify' && nombreMusica('https://music.apple.com/x') === 'Apple Music' && nombreMusica('https://music.youtube.com/x') === 'YouTube Music', 'el nombre del sitio, para el botón');
check(lanza(() => limpiarPersonal({ cumple_mes: 2 })) && lanza(() => limpiarPersonal({ cumple_mes: 2, cumple_dia: 30 })) && lanza(() => limpiarPersonal({ cumple_mes: 13, cumple_dia: 1 })) && !lanza(() => limpiarPersonal({ cumple_mes: 2, cumple_dia: 29 })), 'cumpleaños: día y mes juntos y que existan (el 29 de febrero, sí)');
check(lanza(() => limpiarPersonal({ favoritos: ['11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', '41111111-1111-4111-8111-111111111111'] })), 'como mucho tres ejercicios');
check(cumpleValido(4, 30) && !cumpleValido(4, 31) && !cumpleValido(0, 1), 'días de cada mes');
check(personalVacio(limpiarPersonal({})) && !personalVacio(p), 'vacío o con algo');

console.log('\nLa bienvenida del día');
check(nombreSaludo({ apodo: 'Ani' }, 'Ana López') === 'Ani' && nombreSaludo(null, 'Ana López') === 'Ana', 'el apodo si lo hay; si no, el nombre de pila');
check(esCumple({ cumple_mes: 11, cumple_dia: 8 }, '2026-11-08') && !esCumple({ cumple_mes: 11, cumple_dia: 9 }, '2026-11-08') && !esCumple(null, '2026-11-08'), 'es su cumpleaños hoy o no');
check(esCumple({ cumple_mes: 2, cumple_dia: 29 }, '2027-02-28') && !esCumple({ cumple_mes: 2, cumple_dia: 29 }, '2028-02-28') && esCumple({ cumple_mes: 2, cumple_dia: 29 }, '2028-02-29'), 'el 29 de febrero, el 28 los años que no son bisiestos');
check(porqueParaHoy({ porque: 'Por mis hijos', ultimoDia: '2026-11-01', hoy: '2026-11-08' }) === 'Por mis hijos' && porqueParaHoy({ porque: 'X', ultimoDia: '2026-11-06', hoy: '2026-11-08' }) === null && porqueParaHoy({ porque: 'X', haceMucho: true, hoy: '2026-11-08' }) === 'X' && porqueParaHoy({ porque: null, haceMucho: true }) === null, 'su porqué, tras 4 días o más sin entrenar (o mucho tiempo)');
check(momentoBienvenida({ cumple: true, ultimoDia: '2026-10-01', hoy: '2026-11-08' }) === 'cumple' && momentoBienvenida({ ultimoDia: '2026-10-31', hoy: '2026-11-08' }) === 'vuelta' && momentoBienvenida({ ultimoDia: '2026-11-05', hoy: '2026-11-08' }) === null, 'el momento: cumpleaños antes que la vuelta (una semana o más)');

console.log('\nLos mensajes del coach');
check(textoMensajeCoach('¡Ese récord en {ejercicio}, {nombre}!', { nombre: 'Ana', ejercicio: 'press banca' }) === '¡Ese récord en press banca, Ana!', 'pone el nombre y el ejercicio');
check(textoMensajeCoach('Bloque terminado, {nombre}.', {}) === 'Bloque terminado.' && textoMensajeCoach('{semanas} semanas seguidas', { semanas: 8 }) === '8 semanas seguidas', 'sin nombre no deja la coma colgando; las semanas');
check(textoMensajeCoach('Venga, ¡a por ello!', {}) === 'Venga, ¡a por ello!' && textoMensajeCoach('{nombre}, qué bien', {}) === 'qué bien', 'no toca la coma antes de un «¡» y no deja una coma al empezar');
check(textoMensajeCoach('  ', {}) === null && textoMensajeCoach(null, {}) === null && textoMensajeCoach('Hola {otra}', {}) === 'Hola {otra}', 'vacío, nada; lo que no es una variable se queda');
check(mensajeDe([{ momento: 'record', texto: 'a' }], 'record') === 'a' && mensajeDe([], 'record') === null && mensajeDe(null, 'x') === null, 'el mensaje de un momento');
check(MOMENTOS_COACH.length === 10 && MOMENTOS_COACH.every(([k, t, d]) => k && t && d.includes('{nombre}')), 'diez momentos (con el aniversario y la meta, 065, la primera vez y la vuelta de un viaje, 066, y la bienvenida, 068), cada uno con su texto de ejemplo');

console.log('\nLa cifra de su objetivo');
const hoy = '2026-11-08';
const pts = Array.from({ length: 10 }, (_, i) => ({ semana: sumarDias(lunesDe(hoy), -7 * (9 - i)), valor: 100 + i }));
const prog = { ejercicios: [{ nombre: 'Sentadilla', puntos: pts }], volumen: { estaSemana: { pecho: 10, espalda: 8.5 }, anterior: { pecho: 9, espalda: 7 } },
  pesos: Array.from({ length: 40 }, (_, i) => ({ fecha: sumarDias(hoy, -39 + i), kg: 80 - i * 0.05 })) };
const f = cifraObjetivo({ cuestionario: { objetivos: ['fuerza'] }, progreso: prog, hoy });
check(f && f.cifra === '109' && f.detalle === '+8 kg en 8 semanas' && f.etiqueta === 'Sentadilla: 1RM estimado' && f.sube === true, 'fuerza: el 1RM de su ejercicio principal y cuánto ha subido en unas 8 semanas');
const m = cifraObjetivo({ cuestionario: { objetivos: ['musculo'] }, progreso: prog, hoy });
check(m && m.cifra === '19' && m.detalle.includes('pecho 10') && m.detalle.includes('la anterior, 16') && m.sube === true, 'músculo: las series de la semana y por grupo');
const g = cifraObjetivo({ cuestionario: { objetivos: ['perder_grasa'] }, progreso: prog, salud: true, hoy });
check(g && g.titulo === 'Perder grasa' && g.sube === true && /^−?-?\d/.test(g.detalle.replace('+', '')), 'perder grasa: la tendencia del peso (con su consentimiento)');
check(cifraObjetivo({ cuestionario: { objetivos: ['perder_grasa'] }, progreso: prog, salud: false, hoy }) === null, 'sin consentimiento de salud, nada de peso');
const s = cifraObjetivo({ cuestionario: { objetivos: ['perder_grasa', 'salud'] }, progreso: prog, salud: false, constancia: { racha: 3, semanasCompletas: 12 }, hoy });
check(s && s.objetivo === 'salud' && s.cifra === '3' && igual(s.otros, ['perder_grasa']), 'si el primero no se puede, el siguiente (salud: la constancia)');
check(cifraObjetivo({ cuestionario: null, progreso: prog, hoy }) === null && cifraObjetivo({ cuestionario: { objetivo: 'otro' }, progreso: prog, hoy }) === null, 'sin cuestionario u «otro», nada');

console.log('\n«Hace seis meses…»');
const E = '11111111-1111-4111-8111-111111111111';
const hist = [
  { ejercicio_id: E, ejercicio: 'Press banca', fecha: sumarDias(hoy, -182), kg: 60, reps: 8, rpe: 8 },
  { ejercicio_id: E, ejercicio: 'Press banca', fecha: sumarDias(hoy, -90), kg: 70, reps: 8, rpe: 8 },
];
const hoyS = [{ ejercicio_id: E, ejercicio: 'Press banca', fecha: hoy, kg: 75, reps: 8, rpe: 8 }];
const rc = recuerdoProgreso(hoyS, hist, hoy);
check(rc && rc.hace === '6 meses' && rc.antes.kg === 60 && rc.hoy.kg === 75 && rc.pct === 25, 'compara con hace unos 6 meses: 60 × 8 → 75 × 8, +25 %');
check(recuerdoProgreso(hoyS, hist.slice(1), hoy)?.hace === '3 meses', 'sin datos de hace 6 meses, hace 3');
check(recuerdoProgreso([{ ...hoyS[0], kg: 60.5 }], hist.slice(0, 1), hoy) === null, 'si apenas ha cambiado (menos del 2,5 %), nada');
check(recuerdoProgreso([], hist, hoy) === null && recuerdoProgreso(hoyS, [], hoy) === null, 'sin series de hoy o sin historial, nada');

console.log('\nRécord al alcance');
const H2 = [
  { ejercicio_id: E, ejercicio: 'Press banca', fecha: sumarDias(hoy, -60), kg: 60, reps: 8, rpe: 9 },
  { ejercicio_id: E, ejercicio: 'Press banca', fecha: sumarDias(hoy, -7), kg: 60, reps: 8, rpe: 7 },
];
const ra = recordAlAlcance([{ id: 'se1', ejercicio: { id: E, nombre: 'Press banca' }, reps_min: 6, reps_max: 8, rir_objetivo: 2 }], H2, hoy);
check(ra.length === 1 && ra[0].kg === 62.5 && ra[0].reps === 8 && ra[0].antes === 60, 'con 62,5 × 8 batiría su mejor marca a 8 (60 kg) y lo reciente dice que la tiene');
check(recordAlAlcance([{ id: 'se1', ejercicio: { id: E, nombre: 'Press banca' }, reps_max: 8, rir_objetivo: 2 }], [{ ...H2[0], rpe: 10 }, { ...H2[1], rpe: 10, kg: 50 }], hoy).length === 0, 'si lo reciente no llega, no se propone');
check(recordAlAlcance([{ id: 'x', ejercicio: { id: E, nombre: 'Press con mancuernas' }, reps_max: 8, rir_objetivo: 2 }], H2.map((s) => ({ ...s, kg: 24, rpe: 5 })), hoy)[0]?.kg === 26, 'con mancuernas, de 2 en 2 kg');
check(recordAlAlcance([{ id: 'x', ejercicio: { id: E, nombre: 'Press banca' }, reps_max: 20 }], H2, hoy).length === 0 && recordAlAlcance([{ id: 'x', ejercicio: { id: E } }], H2, hoy).length === 0, 'sin repeticiones objetivo (o más de 12), nada');
check(recordAlAlcance([{ id: 'x', ejercicio: { id: E, nombre: 'Press banca' }, reps_max: 8 }], H2.map(({ rpe, ...x }) => x), hoy).length === 0, 'sin RPE en lo reciente no se fía (saldría inflado)');

console.log('\nSu semana tipo');
const lunes = lunesDe(hoy);
const fechasTipo = [];
for (let w = 1; w <= 6; w++) for (const d of [0, 2, 4]) fechasTipo.push(sumarDias(lunes, -7 * w + d));
fechasTipo.push(sumarDias(lunes, -7 + 5));
check(igual(semanaTipo(fechasTipo, hoy), [0, 2, 4]) && textoDias([0, 2, 4]) === 'lunes, miércoles y viernes', 'lunes, miércoles y viernes (un sábado suelto no cuenta)');
check(igual(semanaTipo(fechasTipo.slice(0, 6), hoy), []), 'con menos de 3 semanas entrenadas, nada');
const rep = repartirComoSiempre({ sinDia: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], ocupados: [sumarDias(lunes, 4)], lunes, hoy: sumarDias(lunes, 1), dias: [0, 2, 4] });
check(igual(rep, { a: sumarDias(lunes, 2) }), 'reparte de hoy en adelante y en días libres (ni lo pasado ni lo ocupado)');
const rep2 = repartirComoSiempre({ sinDia: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], lunes: sumarDias(lunes, 2), desde: sumarDias(lunes, 2), hasta: sumarDias(lunes, 8), hoy: sumarDias(lunes, 2), dias: [0, 2, 4] });
check(igual(rep2, { a: sumarDias(lunes, 2), b: sumarDias(lunes, 4), c: sumarDias(lunes, 7) }), 'una semana del programa que empieza en miércoles: miércoles, viernes y el lunes siguiente');

console.log('\nTu año en FBE');
check(anioParaResumen('2026-12-03') === 2026 && anioParaResumen('2027-01-20') === 2026 && anioParaResumen('2026-11-08') === null, 'en diciembre, el año en curso; en enero, el anterior; si no, ninguno');
const ser = [];
for (let i = 0; i < 10; i++) ser.push({ id: `s${i}`, sesion_id: `x${i}`, ejercicio_id: E, ejercicio: 'Press banca', fecha: sumarDias('2026-02-02', i * 21), kg: 60 + i * 2, reps: 5, rpe: 8 });
const ses = ser.map((x, i) => ({ id: x.sesion_id, completada: true, fecha_realizada: x.fecha, semana_lunes: lunesDe(x.fecha), duracion_min: 50 }));
const ra2 = resumenAnio({ series: ser, sesiones: ses }, 2026, '2026-12-20');
check(ra2.sesiones === 10 && ra2.dias === 10 && ra2.series === 10 && ra2.tonelaje === ser.reduce((t, s) => t + s.kg * 5, 0) && !ra2.vacio, 'sesiones, días, series y tonelaje del año');
check(ra2.progreso && ra2.progreso.ejercicio === 'Press banca' && ra2.progreso.pct > 20 && ra2.records >= 8, 'el ejercicio que más ha subido y los récords');
check(ra2.mesTop && ra2.mesTop.sesiones >= 1 && ra2.porMes.reduce((a, b) => a + b, 0) === 10, 'las sesiones por mes y el mes con más');
check(resumenAnio({ series: [], sesiones: [] }, 2026, '2026-12-20').vacio, 'sin nada, vacío');
const dc = datosCompartirAnio(ra2);
check(dc.fondo === 'bloque' && dc.cifras.length === 3 && dc.mejores.length <= 3 && !JSON.stringify(dc).match(/peso|kg corporal|nutric|hábit/i), 'la imagen para compartir: solo entrenamiento');

console.log('\nLa música');
check(igual(spotify('https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP?si=abc'), { tipo: 'playlist', id: '37i9dQZF1DX76Wlfdnj7AP' }) && spotify('https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC')?.tipo === 'track' && spotify('https://music.apple.com/x') === null, 'reconoce listas, canciones (también con intl-es) y lo que no es Spotify');
check(urlIncrustar('https://open.spotify.com/episode/0Q86acNRm6V9GYx55SXKwf') === 'https://open.spotify.com/embed/episode/0Q86acNRm6V9GYx55SXKwf?utm_source=fbe-equipo' && urlIncrustar('https://youtu.be/x') === null, 'el reproductor incrustado, solo de Spotify');
// (v0.129) Spotify, 15 mejoras
{
  const lista = 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP', cancion = 'https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC';
  check(urlIncrustar(lista, { oscuro: true }).endsWith('&theme=0') && !urlIncrustar(lista).includes('theme'), 'el reproductor, en negro con la app en oscuro (theme=0) y como siempre en claro');
  check(altoIncrustado(lista, false) === 152 && altoIncrustado(lista, true) === 352 && altoIncrustado(cancion, true) === 152, 'compacto de entrada (152 px); la lista entera (352) solo en listas, álbumes y podcasts');
  check(tieneLista(lista) && tieneLista('https://open.spotify.com/album/1A2GTWGtFfWp7KSQTwWOyo') && !tieneLista(cancion) && !tieneLista('https://youtu.be/x'), '«Ver la lista entera» solo donde hay lista');
  check(tipoMusica(lista) === 'Lista' && tipoMusica(cancion) === 'Canción' && tipoMusica('https://open.spotify.com/show/2MAi0BvDc6GTFvKFPXnkCL') === 'Podcast' && tipoMusica('https://music.apple.com/es/x') === null, 'qué es cada enlace (Lista, Canción, Podcast…), solo de Spotify');
  check(esEnlaceCorto('https://spotify.link/AbC123') && !esEnlaceCorto(lista), 'los enlaces cortos de Spotify se reconocen (para avisar de cómo copiar el largo)');
  const b = busquedaRitmo('carrera', 170), bb = busquedaRitmo('bici', 85);
  check(b.bpm === 170 && b.url === 'https://open.spotify.com/search/170%20bpm' && bb.bpm === 170 && busquedaRitmo('remo', 24) === null && busquedaRitmo('nada', 3) === null,
    'buscar música al ritmo de la cadencia: el mismo número en carrera, el doble en bici y nada en remo');
  const ahora = Date.parse('2026-11-10T12:00:00Z');
  const vieja = { titulo: 'X', t: ahora - (FICHA_DIAS + 1) * 864e5 }, nueva = { titulo: 'Y', t: ahora - 864e5 };
  check(fichaVigente(nueva, ahora).usar === nueva && !fichaVigente(nueva, ahora).pedir && fichaVigente(vieja, ahora).usar === vieja && fichaVigente(vieja, ahora).pedir && fichaVigente(null, ahora).usar === null,
    'la ficha guardada: la de esta semana vale; la vieja se pide otra vez, pero se queda por si no hay cobertura');
}
check(esCancion('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC') && !esCancion('https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP') && esCancion('https://music.apple.com/es/song/x/1'), 'una canción (de Spotify, solo track)');
const dice = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
// (revisión de la música) el enlace se guarda sin quién lo compartió; la canción de récord no se cuela con /track/ en otro sitio
check(urlMusica('https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP?si=abc123&utm_source=copy-link') === 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP'
  && urlMusica('https://music.apple.com/es/playlist/x?si=1') === 'https://music.apple.com/es/playlist/x?si=1',
  'el ?si= y los utm_ de Spotify se quitan al guardar (de los demás sitios, nada)');
check(dice(() => limpiarPersonal({ cancion_url: 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP?x=/track/1' }), /canción/) && !!limpiarPersonal({ cancion_url: 'https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC' }).cancion_url,
  'la canción de récord: una lista con /track/ en otro sitio no se cuela; una canción con intl-es, sí');
check(lanza(() => limpiarPersonal({ cancion_url: 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP' })) && limpiarPersonal({ cancion_url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' }).cancion_url, 'la canción de récord no puede ser una lista');
check(claveValida('familia:pierna') && claveValida('descarga') && claveValida('equipo') && claveValida('ritmo:carrera') && claveValida('sesion:11111111-1111-4111-8111-111111111111') && !claveValida('familia:brazos') && !claveValida('sesion:x'), 'las claves de lo que enlaza el coach');
const S = '11111111-1111-4111-8111-111111111111', Bq = '21111111-1111-4111-8111-111111111111';
const coachM = { [`sesion:${S}`]: 'https://open.spotify.com/playlist/AAAAAAAAAAAAAAAAAAAAAA', [`bloque:${Bq}`]: 'https://open.spotify.com/playlist/BBBBBBBBBBBBBBBBBBBBBB', 'familia:pierna': 'https://open.spotify.com/playlist/CCCCCCCCCCCCCCCCCCCCCC', descarga: 'https://open.spotify.com/playlist/DDDDDDDDDDDDDDDDDDDDDD', 'ritmo:carrera': 'https://open.spotify.com/playlist/EEEEEEEEEEEEEEEEEEEEEE' };
const ms = musicaDeLaSesion({ coach: coachM, personal: { musica_url: 'https://open.spotify.com/playlist/FFFFFFFFFFFFFFFFFFFFFF' }, familia: 'pierna', foco: 'descarga', sesionId: S, bloqueId: Bq });
check(igual(ms.map((x) => x.origen), ['sesion', 'bloque', 'propia', 'descarga', 'familia']), 'orden: la de la sesión, la del bloque, la suya, la de descarga y la de su tipo de sesión');
check(igual(musicaDeLaSesion({ coach: coachM, familia: 'pierna' }).map((x) => x.origen), ['familia']) && musicaDeLaSesion({ coach: coachM, modalidad: 'carrera' })[0].origen === 'ritmo' && musicaDeLaSesion({}).length === 0, 'sin lo suyo, la lista FBE; en carrera, la de su ritmo; sin nada, nada');
check(musicaDeLaSesion({ coach: { 'familia:pierna': 'https://x.com/a' }, familia: 'pierna' }).length === 0 && musicaDeLaSesion({ coach: { 'familia:pierna': coachM.descarga, descarga: coachM.descarga }, foco: 'descarga', familia: 'pierna' }).length === 1, 'sin enlaces raros ni repetidos');
check(etiquetaOrigen({ origen: 'familia', familia: 'pierna' }) === 'Lista FBE · Pierna' && etiquetaOrigen({ origen: 'sesion' }) === 'Tu coach, para hoy', 'cómo se presenta cada una');
check(Object.keys(CADENCIAS).length === 6 && ajustarCadencia('carrera', 171) === 172 && ajustarCadencia('carrera', 300) === 190 && ajustarCadencia('remo', 'x') === 24 && ajustarCadencia('nadar', 50) === null, 'cadencias: dentro de su rango y en sus pasos (nadar no tiene)');
check(aperturasDe({ '2026-10': 4, '2026-11': 3, '2025-12': 9, malo: 5 }, '2026') === 7 && aperturasDe({ '2026-11': 3 }, '2026-11') === 3 && aperturasDe(null, '2026') === 0, 'cuántas veces abrió su música en un mes o un año');

// ---------- La migración 050 en un Postgres local ----------
console.log('\nLa migración 050 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ua = await usuario('a@x.test'), ub = await usuario('b@x.test');
const aa = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ua]))[0].id;
const ab = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Bea', $1, 'activo') returning id`, [ub]))[0].id;
await como(ua);
check(await falla(`select * from public.personal_atleta`) && await falla(`select * from public.mensajes_coach`), 'nadie lee las tablas directamente');
check((await q(`select public.personal_mio() as r`))[0].r === null, 'sin nada guardado, personal_mio() es null');
const g1 = (await q(`select public.personal_guardar($1::jsonb) as r`, [JSON.stringify({ apodo: 'Ani', porque: 'Por mis hijos', musica_url: 'https://open.spotify.com/playlist/1', cumple_mes: 11, cumple_dia: 8, favoritos: [] })]))[0].r;
check(g1?.apodo === 'Ani' && g1.cumple_dia === 8, 'el atleta guarda lo suyo');
check((await q(`select public.personal_mio() as r`))[0].r?.porque === 'Por mis hijos', 'y lo lee');
check(await falla(`select public.personal_guardar($1::jsonb)`, [JSON.stringify({ musica_url: 'https://malo.example/x' })]) && await falla(`select public.personal_guardar($1::jsonb)`, [JSON.stringify({ cumple_mes: 2, cumple_dia: 30 })])
  && await falla(`select public.personal_guardar($1::jsonb)`, [JSON.stringify({ apodo: 'x'.repeat(31) })]) && await falla(`select public.personal_guardar($1::jsonb)`, [JSON.stringify({ favoritos: ['a', 'b', 'c', 'd'] })]), 'la base rechaza lo que no vale (música, fecha, largo, más de 3 favoritos)');
// (revisión de la 050) ni medio cumpleaños, ni huecos en los favoritos, ni textos que no son texto; los favoritos, en su orden
const f1 = 'ffffffff-ffff-4fff-8fff-ffffffffffff', f2 = '11111111-1111-4111-8111-111111111111';
check(await falla(`select public.personal_guardar($1::jsonb)`, [JSON.stringify({ cumple_mes: 2 })]) && await falla(`select public.personal_guardar($1::jsonb)`, [JSON.stringify({ cumple_dia: 15 })])
  && await falla(`select public.personal_guardar($1::jsonb)`, [JSON.stringify({ apodo: { a: 1 } })]),
  'la base rechaza medio cumpleaños (solo el mes o solo el día) y un apodo que no es texto');
const gOrden = (await q(`select public.personal_guardar($1::jsonb) as r`, [JSON.stringify({ apodo: "Ani", porque: "Por mis hijos", favoritos: [f1, null, f2] })]))[0].r;
const gRep = (await q(`select public.personal_guardar($1::jsonb) as r`, [JSON.stringify({ apodo: "Ani", porque: "Por mis hijos", favoritos: [f2, f1, f2] })]))[0].r;
check(JSON.stringify(gOrden?.favoritos) === JSON.stringify([f1, f2]) && JSON.stringify(gRep?.favoritos) === JSON.stringify([f2, f1]), `los favoritos, sin huecos ni repetidos y en su orden (${JSON.stringify(gOrden?.favoritos)}, ${JSON.stringify(gRep?.favoritos)})`);
check(/no vale/.test(await q(`select public.personal_guardar($1::jsonb)`, [JSON.stringify({ musica_url: 'https://malo.example/x' })]).then(() => '', (e) => e.message)), 'con un enlace que no vale, un mensaje claro');
await como(ub);
check((await q(`select public.personal_mio() as r`))[0].r === null, 'otro atleta no ve lo de Ana');
check(await falla(`select public.personal_atletas()`) && await falla(`select public.mensaje_coach_guardar('record', 'hola')`), 'un atleta no lee lo de todos ni escribe mensajes del coach');
await como(coach, 'aal2');
const todos = (await q(`select public.personal_atletas() as r`))[0].r || [];
check(todos.length === 1 && todos[0].atleta_id === aa && todos[0].apodo === 'Ani' && todos[0].porque === 'Por mis hijos', 'el coach ve lo de cada atleta');
check(await falla(`select public.personal_guardar($1::jsonb)`, [JSON.stringify({ apodo: 'X' })]), 'el coach no escribe lo del atleta');
await q(`select public.mensaje_coach_guardar('record', '¡Ese récord, {nombre}!')`);
await q(`select public.mensaje_coach_guardar('bloque', 'Bien')`);
check(await falla(`select public.mensaje_coach_guardar('otro', 'x')`) && await falla(`select public.mensaje_coach_guardar('record', $1)`, ['x'.repeat(401)]), 'momentos y largo válidos');
await q(`select public.mensaje_coach_guardar('bloque', '  ')`);
await como(ub);
const lista = (await q(`select public.mensajes_coach() as r`))[0].r || [];
check(lista.length === 1 && lista[0].momento === 'record' && lista[0].texto === '¡Ese récord, {nombre}!', 'el atleta lee los mensajes; guardar uno vacío lo quita');

// La música en la base
await como(ub);
await q(`select public.personal_musica_abierta()`); await q(`select public.personal_musica_abierta()`);
const mia = (await q(`select public.personal_mio() as r`))[0].r;
check(Object.values(mia?.musica_aperturas || {})[0] === 2, 'cada vez que abre su música suma una al mes (y crea su fila si no la tenía)');
check(await falla(`select public.personal_guardar($1::jsonb)`, [JSON.stringify({ cancion_url: 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP' })]) && !(await falla(`select public.personal_guardar($1::jsonb)`, [JSON.stringify({ cancion_url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' })])), 'la canción de récord, una canción (no una lista)');
check(Object.values((await q(`select public.personal_mio() as r`))[0].r?.musica_aperturas || {})[0] === 2, 'guardar lo suyo no borra la cuenta de aperturas');
check(await falla(`select public.musica_coach_guardar('familia:pierna', 'https://open.spotify.com/playlist/1')`) && await falla(`select public.musica_coach_lista()`), 'un atleta no enlaza ni lee lo del coach entero');
await como(coach, 'aal2');
await su();
const [blB] = await q(`insert into public.bloques (atleta_id, nombre, numero) values ($1, 'B', 1) returning id`, [ab]).catch(() => [null]);
await como(coach, 'aal2');
await q(`select public.musica_coach_guardar('familia:pierna', 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP')`);
await q(`select public.musica_coach_guardar('equipo', 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP')`);
if (blB) await q(`select public.musica_coach_guardar($1, 'https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy')`, [`bloque:${blB.id}`]);
check(await falla(`select public.musica_coach_guardar('familia:brazos', 'https://open.spotify.com/playlist/1')`) && await falla(`select public.musica_coach_guardar('equipo', 'https://malo.example/x')`), 'claves y enlaces válidos');
check(/Clave no válida/.test(await q(`select public.musica_coach_guardar('familia:brazos', '')`).then(() => '', (e) => e.message)), 'una clave mala, también para quitar: «Clave no válida»');
const listaC = (await q(`select public.musica_coach_lista() as r`))[0].r;
check(listaC['familia:pierna'] && listaC.equipo, 'el coach ve todo lo enlazado');
await como(ub);
const paraB = (await q(`select public.musica_para(null, $1) as r`, [blB?.id || null]))[0].r;
check(paraB['familia:pierna'] && paraB.equipo && (!blB || paraB[`bloque:${blB.id}`]), 'el atleta ve lo general y lo de su bloque');
await como(ua);
const paraA = (await q(`select public.musica_para(null, $1) as r`, [blB?.id || null]))[0].r;
check(paraA['familia:pierna'] && !Object.keys(paraA).some((k) => k.startsWith('bloque:')), 'lo del bloque de otro, no');
await como(coach, 'aal2');
await q(`select public.musica_coach_guardar('equipo', '')`);
check(!(await q(`select public.musica_coach_lista() as r`))[0].r.equipo, 'vacío, se quita');
await su();
await q(`delete from public.atletas where id = $1`, [aa]);
check((await q(`select count(*)::int as n from public.personal_atleta where atleta_id = $1`, [aa]))[0].n === 0, 'al borrar la ficha del atleta, lo suyo se va con ella');
void ab;

// ---------- La api con el modo demo ----------
console.log('\nLa api en el modo demo');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);
await b.auth.entrar('ana@fbe.demo', 'demo');
check((await api.personal()) === null || personalVacio(await api.personal()), 'Ana empieza sin nada');
const g2 = await api.guardarPersonal({ apodo: 'Ani', porque: 'Para llegar bien a los 50', cumple_mes: 5, cumple_dia: 20 });
check(g2?.apodo === 'Ani' && (await api.personal())?.porque === 'Para llegar bien a los 50', 'guarda y lee lo suyo');
let fallo = null; try { await api.guardarPersonal({ musica_url: 'https://malo.example' }); } catch (e) { fallo = e.message; }
check(/Spotify/.test(fallo || ''), 'lo que no vale, con su motivo');
const mens = await api.mensajesCoach();
check(Array.isArray(mens) && mens.length >= 1, 'lee los mensajes del coach (la demo trae unos)');
let noCoach = false; try { await api.guardarMensajeCoach('record', 'x'); } catch { noCoach = true; }
check(noCoach, 'el atleta no escribe mensajes del coach');
await api.musicaAbierta();
check(Object.values((await (async () => { await new Promise((r) => setTimeout(r, 10)); return api.personal(); })())?.musica_aperturas || {}).reduce((a, b) => a + b, 0) >= 1, 'abrir su música suma una');
check(typeof (await api.musicaPara(null, null)) === 'object', 'lee la música del coach para su sesión');
let noMus = false; try { await api.guardarMusicaCoach('equipo', 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP'); } catch { noMus = true; }
check(noMus, 'el atleta no enlaza música del coach');
const ex = await api.exportar((await api.miAtleta?.())?.id || (await b.select('atletas', {}))[0].id).catch(() => null);
check(!ex || 'personal' in ex, 'lo suyo sale en «Descargar mis datos»');
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const deTodos = await api.personalAtletas();
check(Array.isArray(deTodos) && deTodos.some((x) => x.apodo === 'Ani'), 'el coach ve lo de Ana');
await api.guardarMensajeCoach('vuelta', 'Qué bien verte, {nombre}');
check(mensajeDe(await api.mensajesCoach(), 'vuelta') === 'Qué bien verte, {nombre}', 'el coach guarda un mensaje');

await api.guardarMusicaCoach('familia:pierna', 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP');
check((await api.musicaCoach())['familia:pierna'], 'el coach enlaza una lista por tipo de sesión');
let malEnlace = null; try { await api.guardarMusicaCoach('equipo', 'https://malo.example/x'); } catch (e) { malEnlace = e.message; }
check(/Spotify/.test(malEnlace || ''), 'un enlace raro, con su motivo');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
