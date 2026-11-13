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

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
