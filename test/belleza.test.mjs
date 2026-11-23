// (v0.200) La tanda de belleza: lo puro (el cielo de la hora, la temporada, los copos, la escena de la 200, el aro de la
// semana, el resumen del día del coach y el color de las columnas del tablero) y lo que tiene que estar en su sitio
// (la hoja belleza.css, ASCII y con tokens; los dos colores nuevos; los dibujos nuevos; el ajuste de temporada).
//   node test/belleza.test.mjs
import { readFileSync } from 'node:fs';
import * as C from '../web/src/logica/cielo.js';
import * as B from '../web/src/logica/belleza.js';
import { ACENTOS, contraste } from '../web/src/logica/acentos.js';
import { textosDe } from '../web/src/logica/paleta.js';
import { normalizarAjustes } from '../web/src/ui/ajustes.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('El cielo de la hora');
{
  // En diciembre se hace de noche pronto; en junio, tarde
  check(C.momentoDelDia(18.5, '2026-12-15') === 'noche' && C.momentoDelDia(18.5, '2026-06-15') === 'dia', 'a las seis y media: de noche en diciembre, de día en junio');
  check(C.momentoDelDia(8.6, '2026-12-15') === 'amanecer' && C.momentoDelDia(7, '2026-06-15') === 'amanecer', 'el amanecer sigue a la salida del sol de cada mes');
  check(C.momentoDelDia(17, '2026-12-15') === 'atardecer' && C.momentoDelDia(21, '2026-06-15') === 'atardecer', 'y el atardecer, a la puesta');
  check(C.momentoDelDia(13, '2026-11-20') === 'dia' && C.momentoDelDia(2, '2026-11-20') === 'noche' && C.momentoDelDia(23.9, '2026-07-01') === 'noche', 'el mediodía, de día; la madrugada, de noche');
  check(C.momentoDelDia(13) === 'dia' && C.momentoDelDia(null) === null && C.momentoDelDia(24) === null && C.momentoDelDia('x') === null, 'sin fecha, el sol de marzo; una hora que no vale, nada');
  check(C.SOL_MADRID.length === 12 && C.SOL_MADRID.every(([s, p]) => s > 5 && s < 9 && p > 17 && p < 22.5 && p - s > 8), 'el sol de Madrid, mes a mes, con sentido');
  // Cada hora del año cae en un momento conocido
  const todos = new Set();
  for (let m = 1; m <= 12; m++) for (let h = 0; h < 24; h += 0.25) todos.add(C.momentoDelDia(h, `2026-${String(m).padStart(2, '0')}-10`));
  check([...todos].sort().join() === [...C.MOMENTOS_CIELO].sort().join(), 'a lo largo del año salen los cuatro momentos, y solo esos');
  check(C.horaDecimal(new Date(2026, 10, 20, 18, 30)) === 18.5, 'la hora del móvil, con sus minutos');
  check(C.ESTRELLAS_CIELO.length >= 8 && C.ESTRELLAS_CIELO.every(([x, y, r]) => x >= 0 && x <= 100 && y >= 0 && y <= 60 && r > 0 && r < 2), 'las estrellas, dentro de la parte alta');
}

console.log('\nLa temporada y sus copos');
{
  check(C.temporadaDe('2026-12-20') === 'navidad' && C.temporadaDe('2026-12-31') === 'navidad' && C.temporadaDe('2027-01-06') === 'navidad', 'Navidad: del 20 de diciembre a Reyes');
  check(C.temporadaDe('2026-12-19') === 'invierno' && C.temporadaDe('2027-01-07') === 'invierno' && C.temporadaDe('2027-02-28') === 'invierno', 'invierno: el resto de diciembre, enero y febrero');
  check(C.temporadaDe('2026-11-20') === null && C.temporadaDe('2027-03-01') === null && C.temporadaDe('2026-07-15') === null && C.temporadaDe('') === null && C.temporadaDe('2026-13-01') === null, 'fuera de eso (y con una fecha que no vale), nada');
  const n = C.coposDe('navidad', C.semillaDia('2026-12-24')), i = C.coposDe('invierno', 7), nada = C.coposDe(null, 1);
  check(n.length === 14 && i.length === 7 && nada.length === 0, 'pocos copos: 14 en Navidad, 7 en invierno, ninguno fuera');
  check(n.every((c) => c.x >= -5 && c.x <= 105 && c.tam >= 2 && c.tam <= 5 && c.dura >= 9 && c.dura <= 18 && c.espera <= 0 && Math.abs(c.deriva) <= 20 && c.op > 0.3 && c.op < 0.85 && c.y >= 8 && c.y <= 88), 'cada copo, con su sitio, tamaño, ritmo, deriva, luz y altura dentro de lo previsto');
  check(JSON.stringify(C.coposDe('navidad', 20261224)) === JSON.stringify(C.coposDe('navidad', 20261224)) && JSON.stringify(C.coposDe('navidad', 20261224)) !== JSON.stringify(C.coposDe('navidad', 20261225)), 'el mismo día, los mismos copos; otro día, otros');
  check(normalizarAjustes({}).temporada === true && normalizarAjustes({ temporada: false }).temporada === false && normalizarAjustes({ temporada: 'x' }).temporada === true, 'la decoración, encendida de serie y se puede apagar');
}

console.log('\nLa escena de la versión 200');
{
  check(B.tocaEscena200({ vistaVersion: '0.199.0', actual: '0.200.0' }) === true, 'a quien venía de la 0.199, sale');
  check(B.tocaEscena200({ vistaVersion: '0.150.0', actual: '0.203.1' }) === true, 'y a quien venía de antes, mientras la app esté en la 0.20x');
  check(B.tocaEscena200({ vistaVersion: '0.200.0', actual: '0.200.0' }) === false && B.tocaEscena200({ vistaVersion: null, actual: '0.200.0' }) === false, 'a quien empieza ya en la 0.200 (o sin versión vista), no');
  check(B.tocaEscena200({ vista: '1', vistaVersion: '0.199.0', actual: '0.200.0' }) === false, 'una sola vez en este móvil');
  check(B.tocaEscena200({ vistaVersion: '0.199.0', actual: '0.210.0' }) === false && B.tocaEscena200({ vistaVersion: '0.190.0', actual: '0.199.0' }) === false, 'ni antes de la 0.200 ni pasada la 0.209');
  check(B.tocaEscena200({ vistaVersion: '0.199.0', actual: '0.200.0', automatico: true }) === false, 'en las pruebas, solo si se pide');
}

console.log('\nEl aro de la semana');
{
  const a = B.aroSemana(2, 4);
  check(a.parte === 0.5 && a.tramos === 4 && !a.completa && a.texto === '2 de 4 sesiones esta semana', 'dos de cuatro: la mitad, a tramos');
  check(B.aroSemana(5, 4).completa && B.aroSemana(5, 4).hechas === 4 && B.aroSemana(5, 4).parte === 1, 'una de más no pasa del todo: completa');
  check(B.aroSemana(3, 12).tramos === 0 && B.aroSemana(0, 3).parte === 0, 'muchas sesiones, aro seguido; ninguna hecha, aro vacío');
  check(B.aroSemana(2, 0) === null && B.aroSemana(null, null) === null && B.aroSemana('x', 'y') === null, 'sin nada previsto, sin aro');
}

console.log('\nEl saludo y el día del coach');
{
  check(B.saludoCoach(9) === 'Buenos días' && B.saludoCoach(15) === 'Buenas tardes' && B.saludoCoach(22) === 'Buenas noches' && B.saludoCoach(3) === 'Buenas noches' && B.saludoCoach(NaN) === 'Hola', 'el saludo, por la hora');
  const filas = [
    { atleta_id: 'a', estado: 'activo', alertas: [] }, { atleta_id: 'b', estado: 'activo', alertas: [{ nivel: 'aviso' }] },
    { atleta_id: 'c', estado: 'activo', alertas: [] }, { atleta_id: 'd', estado: 'pausado', alertas: [{ nivel: 'alerta' }] },
  ];
  const d = B.resumenDiaCoach({ filas, hoy: { a: { hecha: true, nombre: 'Pierna' }, b: { hecha: false, nombre: 'Torso' }, d: { hecha: false } }, sinLeer: { c: 2, d: 1, a: 0 } });
  check(d.entrenan === 2 && d.hechas === 1 && d.escritos === 1 && d.atencion === 1 && d.activos === 3, 'cuenta solo a los activos: 2 entrenan (1 ya ha terminado), 1 te ha escrito, 1 pide atención');
  check(d.frase === '2 entrenan hoy (1 ya ha terminado), 1 te ha escrito, 1 pide atención.', `y lo dice en una frase («${d.frase}»)`);
  check(B.resumenDiaCoach({ filas, atencion: 0 }).frase === 'Día tranquilo: nadie te necesita ahora mismo.' && B.resumenDiaCoach({}).frase === '', 'sin nada, un día tranquilo; sin atletas, nada');
  check(B.resumenDiaCoach({ filas, atencion: 3 }).atencion === 3, 'los que piden atención pueden venir de la lista (con tus umbrales)');
}

console.log('\nEl color de las columnas del tablero');
{
  check(B.tonoColumna('estado', 'activo') === 'verde' && B.tonoColumna('estado', 'baja') === 'gris' && B.tonoColumna('estado', 'pausado') === 'ambar' && B.tonoColumna('estado', 'invitado') === 'azul', 'por estado: activos en verde, en pausa en ámbar, sin activar en azul, de baja en gris');
  check(B.tonoColumna('proxima', 'publicada') === 'verde' && B.tonoColumna('proxima', 'borrador') === 'ambar' && B.tonoColumna('proxima', 'sin') === 'rojo' && B.tonoColumna('proxima', 'sin_bloque') === 'rojo' && B.tonoColumna('proxima', 'na') === 'gris', 'por la semana que viene: publicada, borrador, sin preparar y no aplica');
  check(B.tonoColumna('etiqueta', 'preboda', 0, () => 'azul') === 'azul' && B.tonoColumna('etiqueta', '', 0, () => 'azul') === 'gris', 'por etiqueta, su color; sin etiqueta, gris');
  check(B.tonoColumna('nivel', 'intermedio', 1) === 'azul' && B.tonoColumna('nivel', 'sin', 1) === 'gris' && B.tonoColumna('fase', 'volumen', 7) === 'verde', 'lo demás, por turno; «sin…», gris');
}

console.log('\nLos dos colores de invierno');
{
  const abeto = ACENTOS.find((a) => a.id === 'abeto'), granada = ACENTOS.find((a) => a.id === 'granada');
  check(!!abeto && !!granada && abeto.nombre === 'Abeto' && granada.nombre === 'Granada', 'Abeto y Granada, para elegir');
  check([abeto, granada].every((a) => contraste(a.claro.sobre, a.claro.morado) >= 4.5 && contraste(a.oscuro.sobre, a.oscuro.morado) >= 4.5), 'el texto encima del botón se lee (AA) en claro y en oscuro');
  check([abeto, granada].every((a) => contraste(a.claro.morado, '#FFFFFF') >= 4.5), 'y el color sobre blanco, también (enlaces, iconos)');
  check([abeto, granada].every((a) => Object.keys(textosDe(a, 'oscuro')).length > 0), 'con sus textos para el oscuro');
}

console.log('\nEn su sitio');
{
  const css = src('belleza.css');
  check(!/[^\x00-\x7F]/.test(css), 'belleza.css, solo ASCII');
  check(!/box-shadow\s*:/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'sin sombras a mano (ni una)');
  check(!/(?:padding|margin|gap)[^;{]*:\s*[^;]*\b[1-9]\d*px/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'márgenes, rellenos y huecos, con tokens');
  check(/prefers-reduced-motion: no-preference/.test(css) && /prefers-reduced-motion: reduce/.test(css) && /forced-colors: active/.test(css), 'con «reducir movimiento» y con colores forzados');
  check((css.match(/data-theme="dark"/g) || []).length >= 1 && /prefers-color-scheme: dark/.test(css), 'sus colores propios, con su versión oscura');
  const main = src('main.jsx');
  check(main.indexOf("'./belleza.css'") > main.indexOf("'./atletas-lista.css'") && main.indexOf("'./belleza.css'") < main.indexOf("'./color-capa.css'") && /instalarBelleza\(\);/.test(main), 'se carga antes de la capa de color y se instala al arrancar');
  const ilu = src('ui/Ilustraciones.jsx');
  check(['objetivos', 'nutricion', 'biblioteca', 'actividad', 'habitos', 'preguntas'].every((k) => new RegExp(`\\n  ${k}: \\(\\) =>`).test(ilu)), 'los seis dibujos nuevos de los vacíos');
  const vacios = [];
  for (const f of ['Chat.jsx', 'RellenarSemana.jsx', 'coach/Ficha.jsx', 'coach/Actividad.jsx', 'coach/HabitosCoach.jsx', 'coach/Biblioteca.jsx', 'coach/NutricionCoach.jsx', 'coach/Conversaciones.jsx', 'Guias.jsx', 'chat/Reenviar.jsx', 'Comunidad.jsx', 'ComunidadCoach.jsx', 'coach/CarreraCoach.jsx']) {
    for (const l of src(`ui/${f}`).split('\n')) if (l.includes('<Vacio ') && !/ilustracion=|imagen=/.test(l)) vacios.push(f);
  }
  check(vacios.length === 0, `ninguna pantalla vacía sin dibujo${vacios.length ? `: ${vacios.join(', ')}` : ''}`);
  const aj = src('ui/Ajustes.jsx');
  check(/id="aj-temporada"/.test(aj) && /Decoración de temporada/.test(aj), 'el ajuste «Decoración de temporada», en Ajustes');
  check(/tipo: 'semana'/.test(src('ui/atleta/Hoy.jsx')) && /semana: 1/.test(src('logica/sonido.js')), 'la semana completa suena (con su tono propio)');
  check(/class="record-cifra"/.test(src('ui/atleta/FilaSerie.jsx')) && /class="record-cifra"/.test(src('ui/atleta/Enfoque.jsx')), 'la cifra del récord, en la letra ancha (en la serie y en el modo enfoque)');
}

console.log('\nSegunda tanda: la luna, lo que cae, fin de año, estrellas, tema con el sol y discos');
{
  const { crearParticulas } = await import('../web/src/logica/confeti.js');
  const { temaConSol } = await import('../web/src/ui/ajustes.js');
  // La luna: el 5 de diciembre de 2025 fue luna llena; el 20 de noviembre de 2025, nueva
  const llena = C.faseLuna(Date.UTC(2025, 11, 5, 0, 0)), nueva = C.faseLuna(Date.UTC(2025, 10, 20, 6, 0));
  check(llena.ilum > 0.97 && nueva.ilum < 0.03, `la fase de la luna de verdad (llena ${llena.ilum.toFixed(2)}, nueva ${nueva.ilum.toFixed(2)})`);
  check(C.lunaParaPintar(Date.UTC(2025, 10, 20, 6, 0)) === null && C.lunaParaPintar(Date.UTC(2025, 11, 5)).llena === true, 'en luna nueva no se pinta; llena, entera');
  check(C.faseLuna(Date.UTC(2025, 10, 27)).creciente === true && C.faseLuna(Date.UTC(2025, 11, 12)).creciente === false, 'creciente y menguante, cada una a su lado');
  // Lo que cae
  check(C.climaDe(61) === 'lluvia' && C.climaDe(81) === 'lluvia' && C.climaDe(73) === 'nieve' && C.climaDe(45) === 'niebla' && C.climaDe(95) === 'tormenta' && C.climaDe(0) === null && C.climaDe(null) === null, 'los códigos del tiempo: lluvia, nieve, niebla, tormenta o nada');
  const ahora = Date.UTC(2026, 11, 10, 9, 30);
  const cache = { en: ahora - 30 * 60000, prev: { offset: 3600, horas: [{ hora: '2026-12-10T10:00', codigo: 63 }, { hora: '2026-12-10T11:00', codigo: 0 }] } };
  check(C.climaDeCache(cache, ahora) === 'lluvia', 'con la previsión guardada, la hora de ahora en su zona: llueve');
  check(C.climaDeCache({ ...cache, en: ahora - 4 * 3600000 }, ahora) === null && C.climaDeCache(null, ahora) === null && C.climaDeCache({ en: ahora, prev: { horas: [] } }, ahora) === null, 'previsión vieja (más de 3 h), sin previsión o sin esa hora: nada');
  // Fin de año
  check(C.esFinDeAno('2026-12-31', 21) && C.esFinDeAno('2027-01-01', 10) && !C.esFinDeAno('2026-12-31', 12) && !C.esFinDeAno('2027-01-02', 10), 'fuegos el 31 desde las 20:00 y todo el 1 de enero');
  // Estrellas de fondo y decoración
  check(C.decoracionDe({ fecha: '2026-12-24', hora: 12 }) === 'navidad' && C.decoracionDe({ fecha: '2026-11-20', hora: 23 }) === 'estrellas' && C.decoracionDe({ fecha: '2026-11-20', hora: 12 }) === null, 'Navidad manda; fuera de temporada, de noche, estrellas; de día, nada');
  check(C.decoracionDe({ fecha: '2026-12-24', hora: 23, encendida: false }) === null && C.coposDe('estrellas', 3).length === 16, 'apagada, nada; las estrellas, 16');
  // Tema con el sol
  check(normalizarAjustes({ tema: 'sol' }).tema === 'sol' && ['claro', 'oscuro'].includes(temaConSol()), 'el tema «Con el sol» se guarda y da claro u oscuro');
  // Discos en el confeti de récord
  const ps = crearParticulas(40, { ancho: 400, alto: 800, colores: ['#000'], discos: true });
  const sin = crearParticulas(40, { ancho: 400, alto: 800, colores: ['#000'] });
  check(ps.filter((x) => x.forma === 'disco').length === 8 && sin.every((x) => x.forma !== 'disco'), 'en los récords, uno de cada cinco es un disco de pesas; en lo demás, ninguno');
  // En su sitio
  const css = src('belleza.css');
  check(!/tab-rebota/.test(css), 'sin rebote propio de la pestaña (ya había uno por icono)');
  check(/data-vt="acento"/.test(css) && /cambiarAcento\(c\.id, e\)/.test(src('ui/Ajustes.jsx')) && /\['sol', /.test(src('ui/Ajustes.jsx')), 'el barrido del acento y «Con el sol» en Ajustes');
  const hoy = src('ui/atleta/Hoy.jsx');
  check(/lobo-aulla/.test(hoy) && /estreno-bloque/.test(hoy) && /conTiempo/.test(hoy) && /fiestaAhora\(\)/.test(hoy), 'en Hoy: el lobo que aúlla, el estreno, el tiempo y la fiesta');
  check(/CieloHora/.test(src('ui/coach/CabCoach.jsx')), 'el saludo del coach, con su cielo');
  check(/discos: momento === 'record'/.test(src('ui/atleta/sesion-audio.js')), 'los récords de la sesión piden los discos');
  check(/export \{ faseLuna, climaDe \} from '\.\/cielo\.js'/.test(src('logica/travesia.js')), 'la travesía usa la misma luna y el mismo tiempo');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
