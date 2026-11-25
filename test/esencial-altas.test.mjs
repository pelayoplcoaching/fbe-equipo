// FBE Esencial, altas en grupo (logica/esencial-altas.js y la demo): leer la lista que pega el coach (a mano o copiada
// de Stripe), el mensaje de la invitación, el enlace de correo y crear varias fichas seguidas en la demo.
import { leerAltas, mensajeInvitacion, enlaceCorreo, listaCodigos, ASUNTO_ESENCIAL, MAX_ALTAS, enlaceInvitacion } from '../web/src/logica/esencial-altas.js';
import { diasInvitacion } from '../web/src/logica/esencial.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('La lista, escrita a mano');
const a = leerAltas('Ana López, ana@correo.com\nCarlos Vera; CARLOS@correo.com; nutrición\nLucía Ferrer nutrición lucia@correo.es.\n\nMarta\tmarta@correo.com\tEntrenamiento');
const [f1, f2, f3, f4] = a.filas;
check(a.filas.length === 4 && a.validas.length === 4, 'cuatro líneas (la vacía no cuenta), las cuatro bien');
check(f1.nombre === 'Ana López' && f1.email === 'ana@correo.com' && !f1.nutricion, 'con coma: Ana López, ana@correo.com, entrenamiento');
check(f2.nombre === 'Carlos Vera' && f2.email === 'carlos@correo.com' && f2.nutricion, 'con punto y coma y «nutrición»: con nutrición, el correo en minúsculas');
check(f3.nombre === 'Lucía Ferrer' && f3.email === 'lucia@correo.es' && f3.nutricion, 'sin separadores: el nombre sin la palabra «nutrición» y el correo sin el punto final');
check(f4.nombre === 'Marta' && !f4.nutricion, 'con tabuladores (de una hoja de cálculo), «Entrenamiento» no es el nombre');

console.log('\nCopiada de Stripe');
const clientes = 'id,Description,Email,Name,Created (UTC)\ncus_Pa1b2,,ana@correo.com,Ana López,2026-12-15 10:00\ncus_Pc3d4,,carlos@correo.com,"Vera, Carlos",2026-12-15 11:02';
const c = leerAltas(clientes);
check(c.ignoradas === 1 && c.validas.length === 2 && c.filas[0].nombre === 'Ana López' && c.filas[1].nombre === 'Vera, Carlos', 'clientes: sin la cabecera; el id, la fecha y lo vacío no son el nombre; «Vera, Carlos» entre comillas, entero');
const subs = 'sub_1Q2w3e,cus_9x8y7z,FBE Esencial · Entrenamiento y nutrición,Inés Gil,ines@correo.com,active,19.99,eur\nsub_4r5t6y,cus_1a2b3c,FBE Esencial · Entrenamiento,Tomás Rey,tomas@correo.com,trialing,14.99,eur';
const s = leerAltas(subs);
check(s.validas.length === 2 && s.filas[0].nombre === 'Inés Gil' && s.filas[0].nutricion && s.filas[1].nombre === 'Tomás Rey' && !s.filas[1].nutricion,
  'suscripciones: el producto dice el nivel (con nutrición o no) y no es el nombre; el estado, el precio y la moneda tampoco');

console.log('\nLo que no vale');
const e = leerAltas('Sin correo aquí\nsolo@correo.com\nAna López, ana@correo.com\nAna otra vez, ANA@correo.com\nPepe, pepe@correo.com', [{ nombre: 'Pepe Ruiz', email: 'Pepe@Correo.com' }]);
check(e.filas[0].error === 'Falta el correo' && e.filas[1].error === 'Falta el nombre', 'sin correo, o solo con el correo: no se da de alta');
check(!e.filas[2].error && e.filas[3].error === 'Repetido en la lista', 'el mismo correo dos veces: la segunda, «Repetido en la lista»');
check(e.filas[4].error === 'Ya tiene ficha (Pepe Ruiz)' && e.validas.length === 1, 'quien ya tiene ficha con ese correo: «Ya tiene ficha (Pepe Ruiz)» (sin mirar mayúsculas)');
const muchas = leerAltas(Array.from({ length: MAX_ALTAS + 1 }, (_, i) => `Persona ${i + 1}, p${i + 1}@correo.com`).join('\n'));
check(muchas.validas.length === MAX_ALTAS && muchas.filas[MAX_ALTAS].error === `Como mucho ${MAX_ALTAS} de una vez`, `como mucho ${MAX_ALTAS} de una vez`);

console.log('\nEl mensaje y el correo');
const m = mensajeInvitacion({ nombre: 'Ana López', codigo: 'K7P2QX', url: 'https://atletas.fuerzabasadaenevidencia.com/', esencial: true, inicio: '2027-01-11' });
check(/^Hola, Ana\. Ya tienes tu plaza en FBE Esencial/.test(m) && m.includes('K7P2QX') && m.endsWith('que empieza el lunes 11 de enero.'), 'FBE Esencial: su nombre, su código y «que empieza el lunes 11 de enero»');
check(mensajeInvitacion({ nombre: 'Ana', codigo: 'K7P2QX', url: 'u', esencial: true }).endsWith('la app te prepara tu plan.') && mensajeInvitacion({ nombre: 'Ana', codigo: null, url: 'u' }) === '', 'sin lunes, sin la fecha; sin código, nada');
check(mensajeInvitacion({ nombre: 'Ana', codigo: 'FBE-AB2CD-EF3GH', url: 'https://app.test/' }) === 'Hola, Ana. Ya tienes tu acceso a la app de FBE Coaching. Para activar tu cuenta, abre este enlace, que ya lleva tu código: https://app.test/?codigo=FBE-AB2CD-EF3GH (o entra en https://app.test/, toca «Activa tu cuenta» y escribe FBE-AB2CD-EF3GH). Caduca en 14 días y solo sirve una vez.',
  'con seguimiento: el enlace con el código puesto y, por si acaso, el código para escribirlo (14 días)');
check(m.includes('https://atletas.fuerzabasadaenevidencia.com/?codigo=K7P2QX&plan=esencial') && !m.includes('caduca en 14'), 'FBE Esencial: el enlace lleva el código y que es de FBE Esencial');
const mc = mensajeInvitacion({ nombre: 'Ana', codigo: 'K7P2QX', url: 'u', esencial: true, inicio: '2027-01-11', caduca: '2027-01-18' });
check(mc.includes('Sirve una sola vez, hasta el lunes 18 de enero.') && mc.endsWith('que empieza el lunes 11 de enero.'), 'y hasta cuándo vale su código: «hasta el lunes 18 de enero»');
check(enlaceInvitacion('https://app.test/?demo=1#hoy', 'FBE-A B') === 'https://app.test/?codigo=FBE-A%20B' && enlaceInvitacion('u', null) === '', 'el enlace: sin lo que llevara detrás la dirección y con el código escapado; sin código, nada');
check(diasInvitacion({ esencial: true, inicio: '2027-01-11', hoy: '2026-12-15' }) === 34 && diasInvitacion({ esencial: true, inicio: '2027-01-11', hoy: '2027-01-08' }) === 14
  && diasInvitacion({ esencial: true, inicio: '2027-04-05', hoy: '2026-12-15' }) === 60 && diasInvitacion({ esencial: false, inicio: '2027-01-11', hoy: '2026-12-15' }) === 14 && diasInvitacion({ esencial: true, hoy: '2026-12-15' }) === 14,
  'cuánto vale el código: en FBE Esencial, hasta una semana después de su lunes (el 15/12 para el 11/1, 34 días; como poco 14 y como mucho 60); con seguimiento o sin lunes, 14');
const l = enlaceCorreo('ana@correo.com', ASUNTO_ESENCIAL, m);
check(l.startsWith('mailto:ana@correo.com?subject=') && !/\s/.test(l) && decodeURIComponent(l.split('&body=')[1]) === m && enlaceCorreo('no es un correo', 'a', 'b') === null, 'el correo ya escrito (asunto y mensaje, sin espacios en el enlace); sin correo válido, nada');
check(listaCodigos([{ nombre: 'Ana López', email: 'ana@correo.com', nutricion: true, codigo: 'K7P2QX' }, { nombre: 'X', email: 'x@y.es', codigo: null }]) === 'Ana López\tana@correo.com\tCon nutrición\tK7P2QX', 'la lista de códigos, para pegarla en una hoja (sin quien no se creó)');

console.log('\nEn la demo: Pelayo da de alta a tres de una vez');
const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
const apiD = crearApi(bd);
await bd.auth.entrar('pelayo@fbe.demo', 'demo');
const antes = await apiD.atletas();
const lista = leerAltas('Nuria Sanz, nuria@correo.com\nDiego Mora; diego@correo.com; nutrición\nRaúl Peña, raul@correo.com', antes);
const hechos = [];
for (const f of lista.validas) hechos.push({ ...f, ...(await apiD.crearAtletaEsencial({ nombre: f.nombre, email: f.email, nutricion: f.nutricion, inicio: '2027-01-11' })) });
const despues = await apiD.atletas();
const nuevos = despues.filter((x) => ['nuria@correo.com', 'diego@correo.com', 'raul@correo.com'].includes(x.email));
check(nuevos.length === 3 && nuevos.every((x) => x.modalidad === 'por_su_cuenta' && x.esencial_inicio === '2027-01-11') && hechos.every((h) => /^[A-Z0-9-]{6,}$/.test(h.codigo || '')),
  'tres fichas de FBE Esencial que empiezan el 11 de enero, cada una con su código');
const inv = (await bd.select('invitaciones', {})).filter((i) => nuevos.some((x) => x.id === i.atleta_id));
const hasta = hoyISO() < '2027-01-11' ? diasInvitacion({ esencial: true, inicio: '2027-01-11', hoy: hoyISO() }) : 14;
check(inv.length === 3 && inv.every((i) => Math.abs((Date.parse(i.caduca_en) - Date.now()) / 864e5 - hasta) < 0.01) && hechos.every((h) => !!h.caduca),
  `y sus códigos valen hasta una semana después de su lunes (${hasta} días desde hoy), no los 14 de siempre`);
check(nuevos.find((x) => x.email === 'diego@correo.com')?.nutricion === true && nuevos.find((x) => x.email === 'nuria@correo.com')?.nutricion === false, 'Diego, con nutrición; Nuria, solo entrenamiento');
check(leerAltas('Nuria Sanz, nuria@correo.com', despues).filas[0].error === 'Ya tiene ficha (Nuria Sanz)', 'pegar la misma lista otra vez no los duplica');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
