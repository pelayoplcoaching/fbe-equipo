// (v0.143) De viaje por zona horaria y el día del móvil: desfases (con el horario de verano de cada sitio), las horas de
// aquí y de España, el «no molestar» para la noche de allí, y que lo del atleta en el móvil va con el día del móvil.
import {
  ZONAS_CASA, desfaseMin, horaEn, moverHora, horaBonita, nombreZona, textoDesfase, estadoViaje, horaAqui, silencioDeViaje, silencioCubreNoche,
  ajusteDeViaje, ajusteAplicado, previoDeViaje, deshacerViaje, prefsDeCasa,
} from '../web/src/logica/viaje.js';
import { preferenciasValidas, conDefecto } from '../web/src/logica/notificaciones.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(join(raiz, f), 'utf8');
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

const nov = Date.parse('2026-11-12T18:40:00Z');   // 19:40 en Madrid (UTC+1)
const jul = Date.parse('2026-07-01T10:00:00Z');   // 12:00 en Madrid (UTC+2)
const mar = Date.parse('2026-03-20T12:00:00Z');   // EE. UU. ya en verano; Europa, aún no

console.log('Desfases y horas');
check(desfaseMin('Europe/Madrid', nov) === 60 && desfaseMin('Europe/Madrid', jul) === 120 && desfaseMin('America/Mexico_City', nov) === -360 && desfaseMin('Asia/Kolkata', nov) === 330, 'cuánto va cada zona por delante de UTC (con su horario de verano)');
check(desfaseMin('No/Existe', nov) === null && horaEn('No/Existe', nov) === null, 'una zona que no existe, nada (sin romper)');
check(horaEn('Europe/Madrid', nov) === '19:40' && horaEn('America/Mexico_City', nov) === '12:40', 'la hora en cada sitio');
check(moverHora('23:00', 420) === '06:00' && moverHora('01:30', -120) === '23:30' && moverHora('08:30', -420) === '01:30' && moverHora('x', 1) === null, 'mover una hora, dando la vuelta al día');
check(horaBonita('08:30') === '8:30' && horaBonita('19:40') === '19:40' && horaBonita('00:15') === '0:15', 'las horas sin el cero de delante');
check(nombreZona('America/Mexico_City') === 'Ciudad de México' && nombreZona('America/Indiana/Knox') === 'Knox' && nombreZona('Pacific/Port_Moresby') === 'Port Moresby' && nombreZona(null) === null, 'el nombre del sitio (en español si lo sabe)');
check(textoDesfase(-420) === '7 h menos que en España' && textoDesfase(270) === '4 h y 30 min más que en España' && textoDesfase(-30) === '30 min menos que en España' && textoDesfase(0) === 'la misma hora que en España', 'el desfase en palabras');

console.log('¿De viaje?');
const mx = estadoViaje({ tz: 'America/Mexico_City', ahora: nov });
check(mx.deViaje && mx.desfase === -420 && mx.aqui === '12:40' && mx.espana === '19:40' && mx.nombre === 'Ciudad de México', 'en Ciudad de México en noviembre: 7 h menos (12:40 allí, 19:40 en España)');
check(estadoViaje({ tz: 'America/New_York', ahora: nov }).desfase === -360 && estadoViaje({ tz: 'America/New_York', ahora: mar }).desfase === -300 && estadoViaje({ tz: 'America/New_York', ahora: jul }).desfase === -360, 'Nueva York: 6 h, salvo las semanas de marzo en que EE. UU. cambia de hora antes (5 h)');
check(!estadoViaje({ tz: 'Europe/Paris', ahora: nov }).deViaje && !estadoViaje({ tz: 'Europe/Madrid', ahora: nov }).deViaje, 'en París (misma hora) o en casa, no es viaje');
check(ZONAS_CASA.includes('Atlantic/Canary') && !estadoViaje({ tz: 'Atlantic/Canary', ahora: nov }).deViaje && estadoViaje({ tz: 'Europe/Lisbon', ahora: nov }).deViaje, 'Canarias es casa (aunque vaya una hora menos); Lisboa, viaje');
check(!estadoViaje({ tz: 'Europe/Lisbon', ahora: nov, casa: ['Europe/Lisbon'] }).deViaje && !estadoViaje({ tz: null }).deViaje && !estadoViaje({ tz: 'No/Existe', ahora: nov }).deViaje, '«Vivo aquí» lo deja de contar como viaje; sin zona o con una rara, tampoco');

console.log('Las notificaciones de noche');
check(horaAqui('08:30', -420) === '01:30' && horaAqui('21:00', 330) === '02:30', 'a qué hora de aquí llega lo de España (8:30 → 1:30 en México; 21:00 → 2:30 en la India)');
const sil = silencioDeViaje(-420);
check(sil.silencio_desde === '06:00' && sil.silencio_hasta === '14:00', 'el «no molestar» para la noche de México (23:00–7:00 allí), en hora de España: de 6:00 a 14:00');
check(preferenciasValidas({ ...conDefecto(null), ...sil }) && preferenciasValidas({ ...conDefecto(null), ...silencioDeViaje(330) }) && preferenciasValidas({ ...conDefecto(null), ...silencioDeViaje(-30) }), 'y la base lo acepta (también con desfases de media hora)');
const pr = conDefecto(null);
const aMx = ajusteDeViaje(pr, -420);
check(aMx.cambios.silencio_desde === '06:00' && aMx.cambios.hora_tarde === '23:30' && !('hora_manana' in aMx.cambios) && aMx.apagados.join() === 'sesion_hoy' && aMx.cambios.desactivados.includes('sesion_hecha') && aMx.cambios.desactivados.includes('sesion_hoy'),
  'en México: la de la sesión no cabe de día (en España sale de 5:00 a 12:00, allí de noche): se apaga; las de la tarde, al borde (23:30 → 16:30 allí)');
check(aMx.lineas.length === 3 && /apagada mientras viajas/.test(aMx.lineas[1]) && /a las 16:30 de aquí/.test(aMx.lineas[2]) && preferenciasValidas({ ...pr, ...aMx.cambios }), 'lo dice en palabras, y la base lo acepta');
const aIn = ajusteDeViaje(pr, 330);
check(aIn.cambios.hora_manana === '05:00' && aIn.cambios.hora_tarde === '15:30' && !aIn.apagados.length && /10:30 de aquí/.test(aIn.lineas[1]) && /21:00 de aquí/.test(aIn.lineas[2]) && preferenciasValidas({ ...pr, ...aIn.cambios }), 'en la India: la de la sesión, lo antes que se puede (5:00 → 10:30 allí); la tarde, a sus 21:00 de allí');
const aLx = ajusteDeViaje(pr, -60);
check(aLx.cambios.hora_manana === '09:30' && aLx.cambios.hora_tarde === '22:00' && aLx.cambios.silencio_desde === '00:00' && !aLx.apagados.length, 'en Lisboa: todo una hora más tarde en España (a su hora de siempre, allí)');
check(!('hora_manana' in ajusteDeViaje({ ...pr, desactivados: ['sesion_hoy'] }, -420).cambios) && ajusteDeViaje({ ...pr, desactivados: ['sesion_hoy'] }, -420).apagados.length === 0, 'lo que ya tenía apagado ni se toca ni se vuelve a apagar');
const tras = { ...pr, ...aMx.cambios };
check(ajusteAplicado(tras, -420, previoDeViaje(pr, aMx.apagados)) && !ajusteAplicado(pr, -420) && !ajusteAplicado(null, -420) && ajusteAplicado({ ...pr, ...aLx.cambios }, -60, previoDeViaje(pr, [])), 'si ya lo tiene (contando desde las de casa), no se lo vuelve a ofrecer');
const otraZona = ajusteDeViaje(prefsDeCasa(tras, previoDeViaje(pr, aMx.apagados)), 330);
check(otraZona.cambios.hora_manana === '05:00' && !otraZona.cambios.desactivados.includes('sesion_hoy'), 'si en el mismo viaje cambia de zona (de México a la India), se ajusta desde las de casa: la de la sesión vuelve');
const previo = previoDeViaje(pr, aMx.apagados);
const vuelta = deshacerViaje({ ...tras, desactivados: [...tras.desactivados, 'comunidad'] }, previo);
check(vuelta.hora_tarde === '21:00' && vuelta.silencio_desde === '22:30' && vuelta.silencio_hasta === '08:00' && vuelta.desactivados.join() === 'sesion_hecha,comunidad', 'al volver, como estaban (y lo que apagó por su cuenta durante el viaje, se queda apagado)');
check(deshacerViaje({ ...pr, silencio_desde: '06:00', silencio_hasta: '14:00' }, previoDeViaje({ ...pr, silencio_desde: null, silencio_hasta: null }, [])).silencio_desde === null, 'si no tenía «no molestar», vuelve sin él');
check(silencioCubreNoche({ silencio_desde: '06:00', silencio_hasta: '14:00' }, -420) && !silencioCubreNoche(conDefecto(null), -420) && !silencioCubreNoche({ silencio_desde: null }, -420), 'si ya lo tiene, no se lo vuelve a ofrecer');

console.log('El día del atleta, el del móvil');
const prep = leer('web/src/ui/atleta/prep-hoy.js');
check(/import \{ hoyISO \}/.test(prep) && !/fechaMadrid/.test(prep), '«¿Cómo llegas hoy?» marcado hoy: con el día del móvil (como las series de hoy)');
const ses = leer('web/src/ui/atleta/Sesion.jsx');
check(/prepSaltadaDia === hoyISO\(\)/.test(ses) && !/fechaMadrid\(/.test(ses), 'en la sesión, «saltar la pregunta» vale el día del móvil');
const bien = leer('web/src/ui/Bienvenida.jsx');
check(!/Europe\/Madrid/.test(bien) && !/fechaMadrid/.test(bien) && /new Date\(\)\.getHours\(\)/.test(bien), 'la bienvenida (una vez al día, «buenos días» y la fecha), con la hora del móvil');
check(/const hoy = hoyISO\(\);/.test(leer('web/src/ui/atleta/Progreso.jsx')) && /const hoy = hoyISO\(\);/.test(leer('web/src/ui/atleta/PerfilSocial.jsx')), 'el mapa de constancia y tu actividad, con el día del móvil (como la fecha de las sesiones hechas)');
check(/api\.revisionSemanal\(fechaMadrid\(\)\)/.test(leer('web/src/ui/coach/RevisionSemanal.jsx')) && /fechaMadrid/.test(leer('web/src/ui/Programar.jsx')), 'lo que se compara con la base (la revisión del coach, lo programado) sigue con la hora de España');

console.log('En la pantalla');
const hoy = leer('web/src/ui/atleta/Hoy.jsx');
const vj = leer('web/src/ui/atleta/Viaje.jsx');
check(/<AvisoViaje \/>/.test(hoy) && /fbe-viaje:\$\{/.test(vj) && /guardarPreferenciasNotificaciones/.test(vj) && /guardado\.previo \? \{ \.\.\.guardado\.previo/.test(vj), 'en Hoy, el aviso de viaje; lo de antes se guarda una sola vez para poder volver');
check(/viaje\.deViaje/.test(leer('web/src/ui/atleta/DondeEntrenas.jsx')) && /alElegir\('viaje', perfiles\)/.test(leer('web/src/ui/atleta/DondeEntrenas.jsx')), 'en «¿Dónde entrenas hoy?», de viaje, el material de viaje a un toque');
const css = leer('web/src/viaje.css');
check(!/[^\x00-\x7F]/.test(css) && !/#[0-9a-f]{3,6}\b/i.test(css) && leer('web/src/main.jsx').includes("import './viaje.css';"), 'su hoja de estilos: ASCII, solo tokens, y se carga');

console.log(`\n${ok} comprobaciones bien, ${fallos} mal`);
if (fallos) process.exit(1);
