// FBE Esencial sin coach (tanda 1 de las 60 del 25/11/2026, lógica pura): lo que ve quien va por su cuenta no habla de
// «tu coach» (avisos al móvil, medallas, perfil, privacidad, guías) y lo que la app hace con su check-in y sus molestias.
// Lo que se ve en pantalla lo recorre el e2e (test/e2e-esencial.mjs, «ni rastro de tu coach»).
import { readFileSync, readdirSync } from 'node:fs';
import { esPorSuCuenta, quienLee, sinTuCoach, SIN_TU_COACH } from '../web/src/logica/esencial.js';
import { tuDia } from '../web/src/logica/dia.js';
import { textoVasJusto } from '../web/src/logica/sesion-tuya.js';
import { hoyPorComoEstas } from '../web/src/logica/conocerte.js';
import { TIPOS_ATLETA, tiposAtleta, preferenciasValidas, PREFERENCIAS_DEFECTO } from '../web/src/logica/notificaciones.js';
import { LOGROS, calcularLogros } from '../web/src/logica/logros.js';
import { completarPerfil, privacidadDeUnVistazo, HUECOS_PERFIL } from '../web/src/logica/perfil-mas.js';
import { GUIAS_CON_COACH } from '../web/src/logica/guias.js';
import { trasElCheckin, queHacerConMolestia, URL_SEMAFORO } from '../web/src/logica/esencial-checkin.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const sinCoach = (x) => !/coach/i.test(JSON.stringify(x));
const suyo = { modalidad: 'por_su_cuenta' }, conCoach = { modalidad: 'seguimiento' };

console.log('Quién va por su cuenta');
check(esPorSuCuenta(suyo) && !esPorSuCuenta(conCoach) && !esPorSuCuenta(null), 'por su cuenta: solo con esa modalidad');
check(quienLee(suyo) === 'Pelayo' && quienLee(conCoach) === 'tu coach' && quienLee(null) === 'tu coach', 'quién lee lo suyo: Pelayo; con seguimiento, «tu coach»');

console.log('\nLos textos de la lógica común');
const dirLogica = new URL('../web/src/logica/', import.meta.url);
const fuentes = readdirSync(dirLogica).filter((n) => n.endsWith('.js') && n !== 'esencial.js').map((n) => readFileSync(new URL(n, dirLogica), 'utf8')).join('\n');
const huerfanas = SIN_TU_COACH.filter(([a]) => !fuentes.includes(a)).map(([a]) => a);
check(SIN_TU_COACH.length >= 6 && huerfanas.length === 0, `cada frase que se cambia sigue existiendo en la lógica${huerfanas.length ? `: faltan ${huerfanas.join(' | ')}` : ''}`);
check(SIN_TU_COACH.every(([, b]) => !/coach/i.test(b)), 'y lo que se pone en su lugar no habla de «coach»');
check(sinTuCoach('Enviado a tu coach', suyo) === 'Enviado' && sinTuCoach('Enviado a tu coach', conCoach) === 'Enviado a tu coach' && sinTuCoach(null, suyo) === null && sinTuCoach(undefined, suyo) === undefined,
  'solo para quien va por su cuenta (y sin romperse con nada)');
const dia = tuDia({ cuestionario: { pendiente: true }, checkin: { hecho: true } }, '2027-01-13');
check(dia.length === 2 && !sinCoach(dia.map((x) => x.detalle)) && sinCoach(dia.map((x) => sinTuCoach(x.detalle, suyo))), '«Tu día»: el cuestionario pendiente y el check-in enviado, sin «tu coach»');
const justo = textoVasJusto({ cabe: false, quitar: [], minutos: 50, total: 60 }, 30);
check(/cuéntaselo a tu coach/.test(justo) && sinTuCoach(justo, suyo).endsWith('haz las primeras series de lo importante.'), '«Voy justo»: sin «cuéntaselo a tu coach»');
const tocado = hoyPorComoEstas({ prep: { sueno: 1, energia: 1, molestias: 1 } });
check(tocado && /tu coach/.test(tocado.texto) && sinTuCoach(tocado.texto, suyo).endsWith('si algo duele, para.'), '«Hoy, por cómo estás»: «si algo duele, para»');
check(sinTuCoach('Pregunta de tu coach', suyo) === 'Pregunta de Pelayo' && sinTuCoach('De tu coach', suyo) === 'De Pelayo', 'los apuntes de Pelayo, a su nombre');

console.log('\nLos avisos al móvil');
const tipos = tiposAtleta(true);
check(tiposAtleta(false) === TIPOS_ATLETA && tiposAtleta() === TIPOS_ATLETA, 'con coach, los de siempre');
check(tipos.length === TIPOS_ATLETA.length - 2 && !tipos.some(([t]) => t === 'respuesta' || t === 'tarea'), 'sin coach: fuera las respuestas del coach y sus tareas');
check(sinCoach(tipos), 'sin coach: ningún nombre ni explicación habla de «coach»');
check(tipos.every(([t]) => TIPOS_ATLETA.some(([a]) => a === t)) && tipos.every((x) => x.length === 3 && x[1] && x[2]), 'cada tipo es uno de los de siempre, con su nombre y su explicación');
check(tipos.find(([t]) => t === 'semana')[2].includes('la app') && tipos.find(([t]) => t === 'aviso')[1].includes('Pelayo'), 'la semana se la prepara la app y los avisos son de Pelayo');
check(preferenciasValidas({ ...PREFERENCIAS_DEFECTO, desactivados: ['respuesta', 'tarea'] }), 'las preferencias guardadas siguen valiendo (los tipos no cambian en la base)');

console.log('\nMedallas y perfil');
const ids = (xs) => xs.map((l) => l.id);
check(LOGROS.some((l) => l.coach) && ids(calcularLogros({}, { sinCoach: true })).length === ids(calcularLogros({})).length - LOGROS.filter((l) => l.coach).length, 'sin coach: fuera las medallas que dependen de un coach');
check(!ids(calcularLogros({ videos: 9 }, { sinCoach: true })).includes('videos') && ids(calcularLogros({ videos: 9 })).includes('videos'), 'la de los vídeos de técnica: solo con coach');
check(sinCoach(calcularLogros({ sesiones: 400, videos: 40, racha: 60 }, { sinCoach: true }).map((l) => [l.titulo, l.conseguido, l.siguiente?.texto])), 'ninguna medalla de quien va por su cuenta habla de «coach»');
const perfil = completarPerfil({}, { sinCoach: true });
check(HUECOS_PERFIL.some((h) => h.coach) && perfil.total === completarPerfil({}).total - HUECOS_PERFIL.filter((h) => h.coach).length && !perfil.faltan.some((h) => h.clave === 'manual'), 'completar el perfil: sin «Cómo te gusta que te entrenen»');
check(sinCoach(perfil.faltan.map((h) => [h.titulo, h.para, h.fila])), 'ningún hueco del perfil habla de «coach»');
check(completarPerfil({}, { sinCoach: true, entrena: false }).total <= perfil.total, 'y sin entrenamiento, los mismos o menos');

console.log('\nTu privacidad, de un vistazo');
const todo = { salud: true, saludConectada: true, comunidad: true, portada: true, evitados: 2, material: true };
// (la clave de lo que ve quien le lleva se llama «coach»: se miran los textos)
const textos = (x) => Object.values(x);
check(sinCoach(textos(privacidadDeUnVistazo({ ...todo, suyo: true }))) && sinCoach(textos(privacidadDeUnVistazo({ suyo: true }))), 'en versión FBE Esencial, sin «coach»');
check(!sinCoach(textos(privacidadDeUnVistazo(todo))), 'con seguimiento, como siempre (lo que ve tu coach)');
check(JSON.stringify(privacidadDeUnVistazo({ ...todo, suyo: true })).includes('Pelayo'), 'y dice quién lo ve: Pelayo');

console.log('\nLas guías');
check(Array.isArray(GUIAS_CON_COACH) && GUIAS_CON_COACH.includes('bienvenida') && GUIAS_CON_COACH.includes('manual'), 'las guías que solo valen con coach (la bienvenida y el manual) están marcadas');

console.log('\nTras el check-in');
const lineas = (x) => trasElCheckin(x).map((l) => l.id);
check(JSON.stringify(lineas({})) === '["progreso","semana","nadie"]' && JSON.stringify(lineas()) === '["progreso","semana","nadie"]', 'siempre: dónde queda, que la app lo usa y que nadie lo contesta');
check(lineas({ f: { energia: 2, recuperacion: 4 } }).includes('bajo') && lineas({ f: { energia: 4, recuperacion: 1 } }).includes('bajo') && !lineas({ f: { energia: 3, recuperacion: 3 } }).includes('bajo'),
  'con la energía o la recuperación en 2 o menos: se lo dice (el motor no añade series: frenos.checkinBajo)');
check(!lineas({ f: { energia: null, recuperacion: '' } }).includes('bajo') && !lineas({ f: { energia: 0 } }).includes('bajo'), 'sin contestar no cuenta como bajo');
check(lineas({ molestias: { cuadriceps: 2 } }).includes('molestia') && !lineas({ molestias: { cuadriceps: 1, hombros: 0 } }).includes('molestia'), 'una molestia moderada o grave se dice; una leve, no');
check(trasElCheckin({ f: { energia: 1 }, molestias: { zona_lumbar: 3 } }).every((l) => l.id && l.icono && l.texto.length > 20) && sinCoach(trasElCheckin({ f: { energia: 1 }, molestias: { zona_lumbar: 3 } })), 'cada línea, con su icono y su texto, sin «coach»');

console.log('\nQué hacer con una molestia');
check(queHacerConMolestia({}) === null && queHacerConMolestia() === null && queHacerConMolestia({ cuadriceps: 1, hombros: 0 }) === null, 'sin molestias o solo leves: nada');
const mod = queHacerConMolestia({ cuadriceps: 2, hombros: 1 }), grave = queHacerConMolestia({ cuadriceps: 2, zona_lumbar: 3 });
check(mod && !mod.grave && mod.nivel === 'moderada' && mod.zonas === 'cuádriceps', 'moderada: solo las zonas de 2 o más, en minúsculas');
check(grave && grave.grave && grave.nivel === 'grave' && grave.zonas === 'cuádriceps y zona lumbar', 'grave si alguna lo es; las zonas, unidas con «y»');
check(mod.pasos.some((t) => t.includes('hasta 3 sobre 10') && t.includes('admite hasta 5') && t.includes('mañana siguiente') && t.includes('semana')) && mod.pasos.some((t) => t.includes('«Cambiar»')),
  'moderada: la regla del semáforo con el margen de Pelayo (v0.256: hasta 3 sobre 10, el semáforo admite hasta 5; la mañana siguiente, de semana en semana) y cambiar el ejercicio');
check(grave.pasos[0].includes('médico o un fisioterapeuta') && !grave.pasos.some((t) => t.includes('sobre 10')), 'grave: que te la vean antes de seguir (sin la regla del semáforo)');
check([mod, grave].every((m) => m.consulta.includes('noche') && m.consulta.includes('hinchazón') && m.consulta.includes('hormigueo')) && sinCoach([mod, grave]), 'en las dos, las señales para consultar; sin «coach»');
check(queHacerConMolestia({ zona_rara: 2 }).zonas === 'zona_rara' && queHacerConMolestia({ otra: 2 }).zonas === 'otra zona', 'una zona sin nombre no rompe nada; «Otra zona», tal cual');
check(/^https:\/\/fuerzabasadaenevidencia\.com\/semaforo-dolor\.html$/.test(URL_SEMAFORO), 'el enlace al semáforo del dolor de la web');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
