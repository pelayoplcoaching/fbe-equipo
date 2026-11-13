// La familia sonora de FBE (claude/sonido-mejoras.md), sin pantalla: las notas, cuándo puede sonar cada cosa, los perfiles,
// los avisos del descanso y la pista del móvil bloqueado. Uso: node test/sonido.test.mjs
import * as S from '../web/src/logica/sonido.js';
import { normalizarAjustes } from '../web/src/ui/ajustes.js';
import * as PI from '../web/src/logica/pista.js';
import { CLIPS } from '../web/src/datos/pista-descanso.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('\nLa familia: la escala y el motivo');
{
  check(S.nota(0) === 659.25 && S.nota(5) === 1318.5 && Math.abs(S.nota(3) - 987.77) < 0.02 && S.nota(-2) < S.nota(0), 'la escala pentatónica de mi (mi5, si5, mi6… y hacia abajo)');
  check(S.MOTIVO.length === 3 && S.MOTIVO[0] === S.nota(0) && S.MOTIVO[2] === S.nota(5), 'el motivo de FBE: mi, si y mi una octava arriba');
  const todos = Object.entries(S.SONIDOS);
  check(todos.every(([, s]) => ['entreno', 'chat', 'avisos'].includes(s.apartado) && (s.soplo || s.notas({}).every(([f, d, dura, v]) => f > 200 && f < 5000 && d >= 0 && dura > 0 && dura < 1 && v > 0 && v <= 1))), `los ${todos.length} sonidos, con su apartado y notas razonables (y cortas: menos de un segundo cada una)`);
  const series = [1, 2, 3, 4].map((n) => S.SONIDOS.serie.notas({ n, total: 4 }));
  check(series[0][0][0] < series[1][0][0] && series[1][0][0] < series[2][0][0] && series[3].length === 2 && series[3][1][0] > series[3][0][0] && series[2].length === 1, 'las series suben de nota y la última resuelve (dos notas, la segunda arriba)');
  const cuenta = [5, 4, 3, 2, 1].map((segundo) => S.SONIDOS.cuenta.notas({ segundo })[0][0]);
  check(cuenta.every((f, i) => i === 0 || f > cuenta[i - 1]), 'la cuenta atrás sube de los cinco al uno');
  check(S.SONIDOS['record-peso'].notas().length === 4 && S.SONIDOS['record-reps'].notas().length === 4 && JSON.stringify(S.SONIDOS['record-peso'].notas()) !== JSON.stringify(S.SONIDOS['record-reps'].notas()), 'dos fanfarrias de récord distintas: peso y repeticiones');
  check(S.SONIDOS['fin-sesion'].notas({ adorno: true }).length > S.SONIDOS['fin-sesion'].notas().length, 'el fin de sesión con adorno (récord o semana completa) lleva notas de más');
  const nl = [0, 1, 2, 3].map((nivel) => S.SONIDOS.logro.notas({ nivel }));
  check(nl[3].length > nl[0].length && Math.max(...nl[3].map(([f]) => f)) > Math.max(...nl[0].map(([f]) => f)), 'cada nivel de logro suena más alto y más largo que el anterior');
  check(S.ESCUCHAR.every(([k]) => S.SONIDOS[k]), '«Escuchar todos» solo toca sonidos de la familia');
}

console.log('\nCuándo puede sonar');
{
  const a = normalizarAjustes({});
  check(a.volumenes.entreno === 1 && a.sonidosAvisos && !a.sonidosInterfaz && !a.avisoMitad && a.avisoDiez && a.respiraSonido && !a.sonidoBrillante, 'de serie: logros y comunidad sí, interfaz no, mitad no, diez segundos sí, el soplo de «Respira» sí, sin brillo');
  check(normalizarAjustes({ volumenes: { entreno: 4, chat: -1, juego: 'x' } }).volumenes.entreno === 1 && normalizarAjustes({ volumenes: { chat: -1 } }).volumenes.chat === 0 && normalizarAjustes({ volumenes: { juego: 'x' } }).volumenes.juego === 1, 'los volúmenes se limpian (de 0 a 1)');
  check(S.volumenDe({ volumen: 0.5, volumenes: { chat: 0.4 } }, 'chat') === 0.2 && S.volumenDe({}, 'entreno') === 1, 'el volumen de un apartado es el general por el suyo');
  check(S.puedeSonar(a, 'serie') && !S.puedeSonar({ ...a, sonidoSerie: false }, 'serie') && !S.puedeSonar({ ...a, sonidoSerie: false }, 'fin-sesion'), 'la serie y el fin de sesión, con «Sonido al marcar una serie»');
  check(!S.puedeSonar(a, 'ui') && S.puedeSonar({ ...a, sonidosInterfaz: true }, 'ui') && !S.puedeSonar({ ...a, sonidosAvisos: false }, 'logro'), 'la interfaz, solo si se pide; los logros, salvo que se quiten');
  check(!S.puedeSonar(a, 'mitad') && S.puedeSonar({ ...a, avisoMitad: true }, 'mitad') && !S.puedeSonar({ ...a, avisoMitad: true, sonido: false }, 'mitad') && S.puedeSonar(a, 'diez'), 'los avisos de dentro del descanso, con el sonido del descanso');
  check(!S.puedeSonar(a, 'respira-dentro') && S.puedeSonar({ ...a, respira: true }, 'respira-dentro') && !S.puedeSonar({ ...a, respira: true, respiraSonido: false }, 'respira-fuera'), 'el soplo, solo con «Respira» puesto');
  check(S.puedeSonar(a, 'coach') && !S.puedeSonar({ ...a, sonidosChat: false }, 'coach') && !S.puedeSonar(a, 'no-existe'), 'el chat, con «Sonidos del chat»');
}

console.log('\nLos perfiles');
{
  check(['justo', 'equilibrado', 'todo'].every((k) => S.perfilDe({ ...normalizarAjustes({}), ...S.PERFILES[k].ajustes }) === k), 'cada perfil se reconoce después de ponerlo');
  check(S.perfilDe(normalizarAjustes({})) === 'equilibrado', 'de serie, «Equilibrado»');
  check(S.perfilDe({ ...normalizarAjustes({}), sonidosInterfaz: true }) === null, 'una combinación propia es «a tu manera»');
  const j = { ...normalizarAjustes({}), ...S.PERFILES.justo.ajustes };
  check(!S.puedeSonar(j, 'serie') && !S.puedeSonar(j, 'coach') && S.puedeSonar(j, 'fin-descanso') && S.puedeSonar(j, 'cuenta'), '«Solo lo justo»: el final del descanso y su cuenta, nada más');
}

console.log('\nLos avisos del descanso y «¿Cuánto queda?»');
{
  check(S.avisoDescanso(45, 90) === 'mitad' && S.avisoDescanso(10, 90) === 'diez' && S.avisoDescanso(15, 30) === null && S.avisoDescanso(10, 25) === null && S.avisoDescanso(12, 24) === null, 'la mitad en descansos de 40 s o más; los diez segundos, de 30 s o más');
  check(S.fraseQueda(42) === 'Quedan 42 segundos' && S.fraseQueda(60) === 'Queda un minuto' && S.fraseQueda(135) === 'Quedan 2 minutos y 15 segundos' && S.fraseQueda(0) === 'Se acabó el descanso', 'lo que dice la voz al tocar dos veces el reloj');
}

console.log('\nLa pista del móvil bloqueado');
{
  const B = PI.FORMATO_PISTA.bytes;
  const largos = Object.fromEntries(Object.entries(CLIPS).map(([k, v]) => [k, Buffer.from(v, 'base64').length / B]));
  check(['fbe', 'mitad', 'diez', 'c1', 'c2', 'c3', 'c4', 'c5'].every((k) => largos[k] > 0) && largos.fbe * 24 < 2500, 'sus sonidos de la familia: el aviso FBE (menos de 2,5 s), la mitad, los diez segundos y la cuenta que sube');
  const p = PI.planPista({ restanteMs: 60000, total: 90, clips: largos, sonido: 'fbe', avisoMitad: true, avisoDiez: true });
  const orden = p.partes.filter(([k]) => k).map(([k]) => k);
  check(orden.join() === 'mitad,diez,c5,c4,c3,c2,c1,fbe', `con 60 s de un descanso de 90: la mitad, los diez segundos, la cuenta que sube y el aviso FBE (${orden.join()})`);
  const corto = PI.planPista({ restanteMs: 8000, total: 15, clips: largos, sonido: 'fbe' });
  check(corto.partes.filter(([k]) => k).map(([k]) => k).join() === 'c3,c2,c1,fbe', 'en un descanso corto, solo los tres últimos');
}

console.log('\nSonido 2: los sonidos nuevos');
{
  const a = normalizarAjustes({});
  check(['nota', 'no', 'tecla', 'rpe', 'aproximacion', 'superserie', 'seguimos', 'progresion', 'hito', 'nota-empieza', 'nota-acaba', 'aviso-coach'].every((k) => S.SONIDOS[k]), 'los doce sonidos nuevos están en la familia');
  const rpes = [6, 7, 8, 9, 10].map(S.notaRpe);
  check(rpes.every((f, i) => f > 0 && (i === 0 || f > rpes[i - 1])) && S.notaRpe(5) === null && S.notaRpe('') === null, 'la nota del RPE sube del 6 al 10 (y por debajo de 6 o vacío, nada)');
  const ap = [1, 2, 3].map((n) => S.SONIDOS.aproximacion.notas({ n }));
  check(ap.every((x) => x.every(([, , , v]) => v <= 0.5)), 'las series de aproximación suenan más flojas');
  const hitos = ['racha', 'aniversario', 'bloque'].map((tipo) => JSON.stringify(S.SONIDOS.hito.notas({ tipo })));
  check(new Set(hitos).size === 3, 'tres fanfarrias distintas: racha, aniversario y bloque');
  check(S.puedeSonar(a, 'tecla') === false && S.puedeSonar({ ...a, sonidoTeclado: true }, 'tecla') === true, 'el clic del teclado, solo si se activa');
  check(S.puedeSonar(a, 'seguimos') && !S.puedeSonar({ ...a, avisoSeguimos: false }, 'seguimos'), '«¿Seguimos?» viene puesto y se puede quitar');
  check(S.puedeSonar(a, 'rpe') && !S.puedeSonar({ ...a, sonidoSerie: false }, 'rpe'), 'el RPE y las aproximaciones van con el sonido de las series');
}

console.log('\nSonido 2: prioridades y turnos');
{
  check(S.prioridadDe('fin-descanso') === 3 && S.prioridadDe('cuenta') === 3 && S.prioridadDe('serie') === 2 && S.prioridadDe('ui') === 0 && S.prioridadDe('tecla') === 0, 'el fin del descanso y la cuenta mandan; la interfaz, la última');
  check(S.turno(null, 'ui', 1).accion === 'ya', 'sin nada sonando, suena ya');
  const est = { hasta: 2, prioridad: 3 };
  check(S.turno(est, 'ui', 1).accion === 'omite', 'un clic de la interfaz no pisa el final del descanso: se omite');
  const t = S.turno(est, 'serie', 1);
  check(t.accion === 'espera' && t.retraso > 0 && t.retraso <= 1.5, 'una serie espera (como mucho segundo y medio) a que acabe');
  check(S.turno({ hasta: 2, prioridad: 1 }, 'fin-descanso', 1).accion === 'ya', 'el final del descanso suena siempre');
  check(S.duracionDe('fin-descanso') > 0 && S.duracionDe('inventado') === 0, 'cada sonido sabe lo que dura');
}

console.log('\nSonido 2: el horario sin sonidos');
{
  const a = { ...normalizarAjustes({}), silencioActivo: true, silencioDesde: '23:00', silencioHasta: '08:00' };
  const h = (hh, mm = 0) => { const d = new Date(2026, 0, 5, hh, mm); return d; };
  check(S.enSilencio(a, h(23, 30)) && S.enSilencio(a, h(3)) && !S.enSilencio(a, h(8)) && !S.enSilencio(a, h(15)), 'de once a ocho, cruzando la medianoche');
  check(!S.enSilencio({ ...a, silencioActivo: false }, h(3)), 'apagado, nunca');
  check(S.enSilencio({ ...a, silencioDesde: '14:00', silencioHasta: '16:00' }, h(15)) && !S.enSilencio({ ...a, silencioDesde: '14:00', silencioHasta: '16:00' }, h(17)), 'y un tramo de día');
  const ahora = new Date(); const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const ya = { ...a, silencioDesde: hhmm(new Date(ahora - 3600e3)), silencioHasta: hhmm(new Date(+ahora + 3600e3)) };
  check(!S.puedeSonar(ya, 'nota-empieza') && !S.puedeSonar(ya, 'aviso-coach') && S.puedeSonar(ya, 'fin-descanso'), 'en esas horas no suenan el chat ni los avisos; el entreno, sí');
  check(S.horaValida('07:30') && !S.horaValida('25:00') && !S.horaValida('hola'), 'las horas, bien escritas');
}

console.log('\nSonido 2: «¿Seguimos?», el tempo y escuchar el progreso');
{
  check(!S.tocaSeguimos(30, 0) && S.tocaSeguimos(61, 0) && !S.tocaSeguimos(100, 1) && S.tocaSeguimos(181, 1) && !S.tocaSeguimos(500, 2), 'un aviso al minuto, otro a los tres y no más');
  const fases = [0, 1, 2, 3].map((f) => S.notaTempo(f, true));
  check(new Set(fases.map((x) => x.f)).size === 4 && S.notaTempo(2, true).v > S.notaTempo(2, false).v, 'cada fase del tempo, su nota; el primer segundo, con acento');
  const m = S.melodiaDe([100, 105, 110, 108, 120]);
  check(m.length === 5 && m[4].f > m[0].f && m[3].f < m[2].f && m.every((x, i) => i === 0 || x.d > m[i - 1].d), 'la evolución hecha melodía: sube cuando sube y baja cuando baja');
  check(S.melodiaDe([100]).length === 0 && S.melodiaDe(Array.from({ length: 30 }, (_, i) => i)).length === 16, 'con un solo punto, nada; con muchos, las 16 últimas semanas');
  check(S.ESCUCHAR.every(([k]) => S.SONIDOS[k]), '«Escuchar todos» sigue tocando solo sonidos de la familia');
}

console.log('\nSonido 2: los ajustes nuevos');
{
  const a = normalizarAjustes({});
  check(a.silencioActivo === false && a.silencioDesde === '23:00' && a.silencioHasta === '08:00' && a.sonidoTeclado === false && a.avisoSeguimos === true && a.contarReps === false && a.paisajeDescanso === null && a.auricularesSerie === false && a.vozVelocidad === 1 && a.pruebaSonido === false, 'los valores de partida');
  const r = normalizarAjustes({ vozVelocidad: 3, paisajeDescanso: 'discoteca', silencioDesde: '99:99' });
  check(r.vozVelocidad === 1 && r.paisajeDescanso === null && r.silencioDesde === '23:00', 'lo raro vuelve a lo de partida');
  check(normalizarAjustes({ vozVelocidad: 1.15, paisajeDescanso: 'lluvia' }).paisajeDescanso === 'lluvia', 'lo válido se queda');
}

console.log('\nSonido 2: la cola de la pista para los auriculares');
{
  const B = PI.FORMATO_PISTA.bytes;
  const largos = Object.fromEntries(Object.entries(CLIPS).map(([k, v]) => [k, Buffer.from(v, 'base64').length / B]));
  const base = { restanteMs: 30000, total: 60, clips: largos, sonido: 'fbe' };
  const normal = PI.planPista(base), larga = PI.planPista({ ...base, colaMs: PI.COLA_AURICULARES_MS }), enorme = PI.planPista({ ...base, colaMs: 10 * 60e3 });
  const tramas = (p) => p.partes.reduce((n, [, t]) => n + (t || 0), 0);
  check(PI.COLA_AURICULARES_MS === 90000 && tramas(larga) > tramas(normal), 'con los auriculares, la pista sigue minuto y medio en silencio tras el aviso');
  check(tramas(enorme) === tramas(larga), 'y nunca más de eso');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
