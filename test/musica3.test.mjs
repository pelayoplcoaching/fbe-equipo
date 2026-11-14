// Música 3 (rama musica-3): lo puro de la música (tocar al ritmo, la cadencia por tramos, abrir en la app, la canción
// en la imagen del récord…) y comprobaciones del código (sin scripts de fuera, el reproductor por mensajes).
//   node test/musica3.test.mjs
import { readFileSync } from 'node:fs';
const M = await import('../web/src/logica/musica.js');
const C = await import('../web/src/logica/compartir.js');
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lee = (f) => readFileSync(new URL(`../web/${f}`, import.meta.url), 'utf8');

console.log('\nTanda 1: durante la sesión');
// tocar al ritmo
check(M.bpmDeToques([0, 500, 1000, 1500, 2000]) === 120 && M.bpmDeToques([0, 500, 1000]) === null && M.bpmDeToques([]) === null && M.bpmDeToques(null) === null, 'bpm: con 4 toques o más, la mediana (120 bpm a 0,5 s)');
check(M.bpmDeToques([0, 500, 1000, 1100, 1500, 2000, 2500]) === 120, 'un toque doble suelto no lo estropea (mediana)');
check(M.bpmDeToques([0, 100, 200, 300, 400]) === null && M.bpmDeToques([0, 3000, 6000, 9000]) === null, 'fuera de 30–240 bpm, no cuenta');
const e1 = M.encajaRitmo(85, 'carrera', 170), e2 = M.encajaRitmo(150, 'carrera', 170), e3 = M.encajaRitmo(170, 'bici', 85), e4 = M.encajaRitmo(176, 'carrera', 170);
check(e1.encaja && e1.doble && /a doble o a mitad de tiempo/.test(e1.texto), '85 bpm encaja con 170 pasos (a doble tiempo)');
check(!e2.encaja && e2.dif === -20 && /No encaja con tus 170 pasos\/min: busca música a unos 170 bpm \(o 85\)/.test(e2.texto), '150 bpm no encaja con 170 pasos: a cuántos bpm buscar');
check(e3.encaja && !e3.doble && e3.objetivo === 170 && /85 pedaladas\/min/.test(e3.texto), 'en bici, la música al doble (85 pedaladas ↔ 170 bpm)');
check(e4.encaja && M.encajaRitmo(178, 'carrera', 170).encaja === false, 'con un margen pequeño (±4 %)');
check(M.encajaRitmo(96, 'remo', 24) === null && M.encajaRitmo(null, 'carrera', 170) === null && M.encajaRitmo(120, 'nadar', 30) === null, 'en remo (y sin cadencia) no se compara');
// cadencia por tramos
const t = M.normalizarTramos({ trabajo: 60, descanso: 120, rondas: 3, alta: 180, baja: 160 }, 'carrera');
check(M.duracionTramos(t) === 420, '3 × 1 min con 2 min de recuperación: 7 min');
const a = M.tramoCadencia(t, 0), b = M.tramoCadencia(t, 56), c = M.tramoCadencia(t, 61), d = M.tramoCadencia(t, 59 + 360), f = M.tramoCadencia(t, 420);
check(a.fase === 'trabajo' && a.cadencia === 180 && a.ronda === 1 && a.quedan === 60 && !a.avisar, 'empieza en el trabajo, a su cadencia');
check(b.avisar && b.quedan === 4, 'avisa 5 s antes del cambio');
check(c.fase === 'descanso' && c.cadencia === 160 && c.quedan === 119, 'y pasa a la recuperación, a la suya');
check(d.ronda === 3 && d.fase === 'trabajo' && !d.avisar, 'en el último trabajo no avisa (no hay recuperación detrás)');
check(f.fin === true, 'y termina');
const n = M.normalizarTramos({ trabajo: 'x', rondas: 99, alta: 999, baja: 1 }, 'bici');
check(n.trabajo === 60 && n.rondas === 30 && n.alta === 110 && n.baja === 60, 'lo raro se ajusta a lo posible');
check(JSON.stringify(M.tramosDeCarrera({ partes: [{ fase: 'calentar', seg: 900 }, { fase: 'bloque', reps: 6, seg: 120, rec_seg: 120 }] })) === '{"trabajo":120,"descanso":120,"rondas":6}' && M.tramosDeCarrera({ partes: [{ seg: 900 }] }) === null && M.tramosDeCarrera(null) === null, 'los tramos de la carrera del coach (la primera parte con repeticiones y recuperación)');
// abrir en la app
check(M.uriSpotify('https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP?si=abc') === 'spotify:playlist:37i9dQZF1DX76Wlfdnj7AP' && M.uriSpotify('https://open.spotify.com/intl-es/track/2HHtWyy5CgaQbC7XSoOb0e') === 'spotify:track:2HHtWyy5CgaQbC7XSoOb0e' && M.uriSpotify('https://music.apple.com/es/playlist/x') === null, 'el enlace de la app de Spotify (solo de Spotify)');
// la canción en la imagen del récord
const rec = { nombre: 'Press banca', s: { kg: 80, reps: 5 }, r: { tipo: 'kg', kg: 80, reps: 5, antes: 77.5 } };
const conC = C.datosRecordDeSesion(rec, '2026-11-14', { cancion: 'Eye of the Tiger' }), sinC = C.datosRecordDeSesion(rec, '2026-11-14');
check(conC.lineas.length === 3 && conC.lineas[2] === 'Con «Eye of the Tiger»' && sinC.lineas.length === 2, 'la imagen del récord lleva su canción (y sin ella, igual que antes)');
check(/…»$/.test(C.datosRecordDeSesion(rec, '2026-11-14', { cancion: 'Un título larguísimo que no cabe en la tarjeta del récord' }).lineas[2]), 'un título largo se corta');
// el código
const html = lee('index.html'), ctl = lee('src/ui/atleta/musica-control.js'), mus = lee('src/ui/atleta/Musica.jsx');
check(/script-src 'self' 'wasm-unsafe-eval';/.test(html) && !/script-src[^;]*https?:/.test(html) && !/iframe-api/.test(mus + ctl), 'sin scripts de fuera: el reproductor se maneja por mensajes, sin la iFrame API de Spotify');
check(/e\.origin !== ORIGEN/.test(ctl) && /contentWindow !== e\.source/.test(ctl) && /postMessage\(\{ command \}, ORIGEN\)/.test(ctl), 'solo escucha al reproductor de Spotify de la app y solo le habla a él');
check(/est\.sonando === true/.test(ctl) && /if \(est\.pausadoAqui\)/.test(ctl), 'solo pausa uno que suena y solo reanuda el que pausó');
check(['src/ui/atleta/Compania.jsx', 'src/ui/atleta/ApuntesSocial.jsx', 'src/ui/chat/NotaVoz.jsx'].every((f) => /data-pausa-musica/.test(lee(f))) && /segundos: buffers\[k\]\.duration/.test(lee('src/ui/voces-coach.js')), 'la voz del coach: sus frases en la sesión, su mensaje de voz, sus audio-píldoras y las notas de voz');
check(/siguiente && e\.prioridad === 'alta' && !Object\.keys\(hechas\)\.length && <PonTuCancion \/>/.test(lee('src/ui/atleta/Sesion.jsx')), '«Pon tu canción» en el ejercicio que toca, de prioridad alta y sin series');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
