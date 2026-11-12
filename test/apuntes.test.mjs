// «Apuntes», formación en los descansos: la lógica pura (logica/apuntes.js). Uso: node test/apuntes.test.mjs
import { apuntesDeFicha, apuntesDeGuias, limpiarVistos, apuntarVisto, elegirApunte, apunteDelDia, resumenApuntes, paraRepasar, textoApuntes,
  apuntesDeCorrecciones, apunteDeNumeros, apunteDeClip, apunteDeMusculo, preguntasDeFicha, apuntesDeDudas, apuntesDeGlosario, GLOSARIO, terminosDe, videoDeGuia, guiasACuento,
  alternarGuardado, llevarReto, retoPendiente, pendienteDeSubir } from '../web/src/logica/apuntes.js';
import { FAQ } from '../web/src/datos/faq.js';
import { GUIAS_DEMO } from '../web/src/datos/semilla-guias.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

const fila = { id: 'f1', nombre: 'Press banca', ficha: {
  pasos: ['Pies firmes y **escápulas** juntas y abajo.', 'Baja la barra al esternón en 2 segundos.'],
  errores: ['**Rebotar la barra**: quita tensión al pectoral y carga el esternón. Para un instante abajo.', '**Chocar las mancuernas** arriba: se pierde la tensión.', 'Codos en cruz'],
} };

console.log('Los apuntes de la ficha de un ejercicio');
{
  const a = apuntesDeFicha(fila, 'Press banca con barra');
  check(a.length === 5 && a.filter((x) => x.tipo === 'clave').length === 2 && a.filter((x) => x.tipo === 'error').length === 3, 'una clave por paso y un error típico por error');
  check(a[0].id === 'p:f1:0' && a[0].texto === 'Pies firmes y escápulas juntas y abajo.' && a[0].de === 'Press banca con barra' && !a[0].vuelta, 'la clave: el paso, sin asteriscos, con el nombre del ejercicio de la sesión; sin vuelta');
  check(a[2].titulo === 'Rebotar la barra' && a[2].texto.startsWith('Quita tensión') && a[2].vuelta === true, 'el error: delante su título; detrás, por qué y cómo se corrige (empezando en mayúscula)');
  check(a[3].texto === 'Chocar las mancuernas arriba: se pierde la tensión.', 'si el título sigue la frase, detrás va la frase entera');
  check(a[4].titulo === 'Codos en cruz' && !a[4].vuelta, 'un error sin explicación no tiene vuelta');
  check(apuntesDeFicha(null).length === 0 && apuntesDeFicha({ id: 'x', ficha: {} }).length === 0 && apuntesDeFicha({ ficha: fila.ficha }).length === 0, 'sin ficha (o sin su id), ninguno');
  const largo = apuntesDeFicha({ id: 'l', ficha: { pasos: [`${'Una frase corta. '.repeat(40)}`] } })[0].texto;
  check(largo.length <= 420 && largo.endsWith('.'), `un paso larguísimo se corta en una frase entera (${largo.length} letras)`);
}

console.log('Los apuntes de las guías');
{
  const guias = [
    { clave: 'sueno', titulo: 'Dormir', publicada: true, contenido: { ideas: [{ titulo: 'La **hora** manda', x: 'Acuéstate a la misma hora.' }, { titulo: '', x: '' }] } },
    { clave: 'oculta', titulo: 'Borrador', publicada: false, contenido: { ideas: [{ titulo: 'No sale', x: 'x' }] } },
    { clave: 'mitos', titulo: 'Mitos', publicada: true, contenido: { secciones: [{ titulo: 'Sobre entrenar', bloques: [
      { t: 'caja', titulo: 'MITO 3 · "Sudar más es quemar más"', bloques: [{ t: 'p', x: '**Lo que se sabe**: el sudor es agua.' }, { t: 'ul', xs: ['no sale'] }, { t: 'p', x: 'Se recupera al beber.' }] },
      { t: 'caja', titulo: 'Una nota cualquiera', bloques: [{ t: 'p', x: 'no es un mito' }] }] }] } },
  ];
  const a = apuntesDeGuias(guias);
  check(a.length === 2 && a[0].id === 'i:sueno:0' && a[0].tipo === 'idea' && a[0].titulo === 'La hora manda' && a[0].texto === 'Acuéstate a la misma hora.' && a[0].de === 'Dormir', 'las ideas clave de las guías publicadas (las de un borrador, no)');
  check(a[1].id === 'm:3' && a[1].tipo === 'mito' && a[1].titulo === '«Sudar más es quemar más»' && a[1].texto === 'Lo que se sabe: el sudor es agua. Se recupera al beber.' && a[1].vuelta && a[1].de === 'Sobre entrenar', 'los mitos: delante el mito; detrás, lo que se sabe (sus párrafos)');
  check(apuntesDeGuias(null).length === 0 && apuntesDeGuias([{}, null, { clave: 'x' }]).length === 0, 'sin guías o sin contenido, ninguno');
  const demo = apuntesDeGuias(GUIAS_DEMO.map((g) => ({ ...g, publicada: true })));
  check(demo.filter((x) => x.tipo === 'idea').length >= 5 && demo.filter((x) => x.tipo === 'mito').length >= 2 && new Set(demo.map((x) => x.id)).size === demo.length, `en la demo salen ${demo.filter((x) => x.tipo === 'idea').length} ideas y ${demo.filter((x) => x.tipo === 'mito').length} mitos, sin repetir`);
  const fd = GUIAS_DEMO.flatMap((g) => g.fichas || []).flatMap((f) => apuntesDeFicha({ id: f.nombre, ...f }, f.nombre));
  check(fd.length >= 4 && fd.every((x) => x.texto || x.titulo), `y de sus fichas de técnica, ${fd.length} claves y errores`);
}

console.log('Lo visto, en el móvil');
{
  let e = apuntarVisto(null, 'a', '2026-11-10');
  e = apuntarVisto(e, 'a', '2026-11-10');
  check(e.vistos.a.n === 1 && e.vistos.a.t === '2026-11-10' && !('s' in e.vistos.a), 'verlo dos veces el mismo día cuenta una');
  e = apuntarVisto(e, 'a', '2026-11-12', false);
  check(e.vistos.a.n === 2 && e.vistos.a.t === '2026-11-12' && e.vistos.a.s === false, 'otro día, otra vez; y si le dio la vuelta, si lo sabía');
  e = apuntarVisto(e, 'a', '2026-11-13');
  check(e.vistos.a.s === false && e.vistos.a.n === 3, 'pasar de largo no borra que no lo sabía');
  e = apuntarVisto(e, 'a', '2026-11-14', true);
  check(e.vistos.a.s === true, 'hasta que dice que ya lo sabe');
  const antes = JSON.stringify(e); apuntarVisto(e, 'b', '2026-11-14');
  check(JSON.stringify(e) === antes && apuntarVisto(e, '', '2026-11-14').vistos.a && JSON.stringify(apuntarVisto(e, 'b', 'ayer')) === antes, 'no cambia lo que se le pasa; sin id o sin día, nada');
  const l = limpiarVistos({ vistos: { a: { n: 'x', t: '2026-11-10' }, b: { n: 2, t: 'mal' }, c: null, d: { n: 5000, t: '2026-11-11', s: 'si' } }, otra: 1 });
  check(l.vistos.a.n === 1 && !l.vistos.b && !l.vistos.c && l.vistos.d.n === 999 && !('s' in l.vistos.d) && !('otra' in l), 'lo guardado ilegible se sanea');
  const muchos = { vistos: Object.fromEntries(Array.from({ length: 700 }, (_, i) => [`x${i}`, { n: 1, t: `2026-${String(1 + (i % 12)).padStart(2, '0')}-10` }])) };
  const lm = limpiarVistos(muchos);
  check(Object.keys(lm.vistos).length === 600 && Object.values(lm.vistos).every((v) => v.t >= '2026-02-10'), 'como mucho 600: los más antiguos, fuera');
  check(JSON.stringify(limpiarVistos('roto')) === '{"vistos":{}}', 'y sin nada guardado, vacío');
}

console.log('Cuál toca');
{
  const hoy = '2026-11-12';
  const suyos = apuntesDeFicha(fila, 'Press banca');
  const generales = [{ id: 'i:a:0', tipo: 'idea', titulo: 'A', texto: 'a' }, { id: 'i:a:1', tipo: 'idea', titulo: 'B', texto: 'b' }, { id: 'm:1', tipo: 'mito', titulo: 'M', texto: 'm', vuelta: true }];
  const todos = [...suyos, ...generales];
  const a0 = elegirApunte(todos, null, { hoy, salto: 0 });
  check(a0.id === 'p:f1:0', 'el primero del descanso, una clave del ejercicio del que descansa');
  const a1 = elegirApunte(todos, null, { hoy, salto: 1, excluir: [a0.id] });
  check(['idea', 'mito'].includes(a1.tipo), 'el segundo, uno general (uno sí, uno no: no todo es técnica)');
  const a2 = elegirApunte(todos, null, { hoy, salto: 2, excluir: [a0.id, a1.id] });
  check(a2.id === 'p:f1:1', 'y el tercero, otra vez del ejercicio');
  check(elegirApunte(generales, null, { hoy, salto: 0 }) && elegirApunte(suyos, null, { hoy, salto: 1 }).id === 'p:f1:0', 'si solo hay de un tipo, de ese');
  // el que no sabía vuelve otro día, antes que los nuevos
  let e = apuntarVisto(null, 'm:1', '2026-11-11', false);
  check(elegirApunte(todos, e, { hoy }).id === 'm:1', 'uno que no sabía ayer vuelve hoy, antes que ninguno nuevo');
  check(elegirApunte(todos, apuntarVisto(null, 'm:1', hoy, false), { hoy }).id !== 'm:1', 'pero no el mismo día');
  check(elegirApunte(todos, apuntarVisto(e, 'm:1', hoy, true), { hoy }).id === 'p:f1:0', 'y si hoy ya lo sabe, a por los nuevos');
  // todos vistos: el que hace más que no ve
  let v = null; todos.forEach((x, i) => { v = apuntarVisto(v, x.id, `2026-11-${String(1 + i).padStart(2, '0')}`); });
  check(elegirApunte(todos, v, { hoy }).id === todos[0].id, 'con todos vistos, el que hace más que no ve');
  check(elegirApunte(todos, v, { hoy, excluir: todos.map((x) => x.id) }) === null && elegirApunte([], null, { hoy }) === null, 'sin ninguno (o todos ya pasados en esta tanda), null');
  const d1 = apunteDelDia(todos, '2026-11-12'), d2 = apunteDelDia(todos, '2026-11-13');
  check(d1 && d1.id === apunteDelDia(todos, '2026-11-12').id && d1.id !== d2.id && ['idea', 'mito'].includes(d1.tipo) && apunteDelDia(suyos, hoy) === null, 'el apunte del día: uno general, el mismo todo el día y otro al siguiente');
}

console.log('La tarjeta y el repaso');
{
  const hoy = '2026-11-12';
  let e = apuntarVisto(null, 'a', '2026-11-01');
  e = apuntarVisto(e, 'b', '2026-11-08', false);
  e = apuntarVisto(e, 'c', '2026-11-12', true);
  const r = resumenApuntes(e, hoy);
  check(r.vistos === 3 && r.semana === 2 && r.repasar === 1, 'cuántos ha visto, cuántos en los últimos 7 días y cuántos tiene por repasar');
  check(JSON.stringify(resumenApuntes(null, hoy)) === '{"vistos":0,"semana":0,"repasar":0}', 'sin nada, ceros');
  const lista = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  check(paraRepasar(lista, e, hoy).map((x) => x.id).join() === 'b,c', 'el repaso: primero los que no sabía y, después, los vistos esta semana');
  check(textoApuntes(1) === '1 apunte' && textoApuntes(3) === '3 apuntes' && textoApuntes(0) === '0 apuntes', '«1 apunte», «3 apuntes»');
}

console.log('(tanda 2) Lo tuyo: correcciones, números, clip y músculo');
{
  const ej = { id: 'ej1', nombre: 'Press banca', ultima: '80 × 6 @8', toca: '82,5 kg × 6', video: 'https://youtu.be/gMgvBspQ9lk?t=42', grupo: ['pectoral', 'triceps'] };
  const recs = [{ id: 'r1', ejercicio_id: 'ej1', texto: 'Codos más cerrados al bajar', activo: true }, { id: 'r2', ejercicio_id: 'otro', texto: 'No es de este' }, { id: 'r3', ejercicio_id: 'ej1', texto: 'Ya no', activo: false }, { id: 'r4', ejercicio_id: 'ej1', texto: '  ' }];
  const c = apuntesDeCorrecciones(recs, ej);
  check(c.length === 1 && c[0].id === 'r:r1' && c[0].tipo === 'correccion' && c[0].efimero && c[0].texto === 'Codos más cerrados al bajar' && c[0].de === 'Press banca', 'lo que le corrigió su coach en este ejercicio (los activos, de este ejercicio)');
  check(apuntesDeCorrecciones(recs, null).length === 0 && apuntesDeCorrecciones(null, ej).length === 0, 'sin ejercicio o sin recordatorios, nada');
  const n = apunteDeNumeros(ej);
  check(n.id === 't:ej1' && n.titulo === 'Ahora: 82,5 kg × 6' && n.texto === 'La última vez hiciste 80 × 6 @8.' && n.efimero, 'sus números: lo que le toca y lo de la última vez');
  check(apunteDeNumeros({ id: 'x', nombre: 'N', toca: '40 kg × 8' }).texto.startsWith('Es la primera vez') && apunteDeNumeros({ id: 'x', nombre: 'N' }) === null, 'sin última vez, la marca de salida; sin nada, no hay apunte');
  check(apunteDeClip(ej).video === ej.video && apunteDeClip({ id: 'x', video: 'https://vimeo.com/1' }) === null && apunteDeClip({ id: 'x' }) === null, 'el clip, solo si el vídeo del ejercicio es de YouTube');
  const fila = { id: 'f1', nombre: 'Press banca', ficha: { principales: 'Pectoral mayor', secundarios: 'Tríceps y deltoides anterior', tabla: [{ objetivo: 'Fuerza', reps: '3-6', rpe: '8-9', descanso: '3-5 min' }, { objetivo: 'Hipertrofia', reps: '6-12' }, { objetivo: 'Resistencia', reps: '12-20' }] } };
  const m = apunteDeMusculo(fila, 'Press banca con barra', ej.grupo);
  check(m.id === 'p:f1:m' && m.titulo === 'Sobre todo, pectoral mayor' && m.texto === 'También ayudan: tríceps y deltoides anterior.' && m.grupo === 'pectoral', 'qué deberías notar: los músculos de la ficha y su grupo (para la estatua)');
  check(apunteDeMusculo({ id: 'f2', ficha: {} }) === null, 'sin músculos en la ficha, no hay apunte');
  const q = preguntasDeFicha(fila, 'Press banca');
  check(q.length === 2 && q[0].id === 'e:f1:q0' && q[0].opciones.length === 3 && q[0].opciones[q[0].correcta] === 'Pectoral mayor' && !q[0].opciones.some((o, i) => i !== q[0].correcta && /pectoral|tr[ií]ceps|deltoides/i.test(o)), `la pregunta del músculo: tres opciones, la buena y dos que no trabajan (${q[0].opciones.join(' / ')})`);
  check(q[1].id === 'e:f1:q1' && q[1].opciones.length === 3 && new Set(q[1].opciones).size === 3 && /repeticiones para/.test(q[1].titulo) && q[1].opciones[q[1].correcta].length > 0, `la de las repeticiones, con las de los otros objetivos (${q[1].titulo} ${q[1].opciones.join(' / ')})`);
  check(JSON.stringify(preguntasDeFicha(fila, 'Press banca')) === JSON.stringify(q), 'siempre en el mismo orden para la misma ficha');
  check(preguntasDeFicha({ id: 'f3', ficha: { tabla: [{ objetivo: 'Fuerza', reps: '3-6' }] } }).length === 0, 'sin datos para preguntar, ninguna');
  check(/^[peimn]:[A-Za-z0-9:_-]{1,78}$/.test(m.id) && q.every((x) => /^[peimn]:[A-Za-z0-9:_-]{1,78}$/.test(x.id)), 'el del músculo y las preguntas se pueden apuntar en la base (la 060 admite su clave)');
}

console.log('(tanda 2) Dudas, glosario y vídeo de la guía');
{
  const d = apuntesDeDudas(FAQ);
  check(d.length >= 5 && d[0].id === 'd:0' && d[0].tipo === 'duda' && d[0].titulo.startsWith('¿') && d[0].texto.length > 20 && d.every((x) => x.texto.length <= 520), `las dudas frecuentes de la app, como apuntes (${d.length})`);
  const g = apuntesDeGlosario();
  check(g.length === GLOSARIO.length && g.find((x) => x.titulo === 'RIR').id === 'g:rir' && g.find((x) => x.titulo === '1RM').id === 'g:1rm' && new Set(g.map((x) => x.id)).size === g.length, `el glosario: ${g.length} palabras del oficio`);
  const t = terminosDe('Deja 2 en recámara (RIR 2) y cuida el tempo; la descarga llega en dos semanas.');
  check(t.map((x) => x[0]).join() === 'RIR,Tempo,Descarga' && terminosDe('Compra tempo y arrir').length === 1 && terminosDe('').length === 0, 'las palabras del glosario que salen en un texto (enteras, sin tildes ni mayúsculas)');
  const guia = { titulo: 'Sueño', contenido: { secciones: [{ bloques: [{ t: 'p', x: 'a' }, { t: 'video', url: 'https://www.youtube.com/watch?v=gMgvBspQ9lk', titulo: 'Dormir mejor' }] }] } };
  check(videoDeGuia(guia).url.includes('gMgvBspQ9lk') && videoDeGuia(guia).titulo === 'Dormir mejor' && videoDeGuia({ contenido: { secciones: [{ bloques: [{ t: 'video', url: 'https://vimeo.com/1' }] }] } }) === null && videoDeGuia(null) === null, 'el vídeo de una guía, si es de YouTube');
  check(guiasACuento({ foco: 'descarga', sueno: 1, energia: 1 }).join() === 'deload,sueno,motivacion' && guiasACuento({ foco: 'intensidad', sueno: 3 }).length === 0 && guiasACuento().length === 0, 'las guías que vienen a cuento: descarga, ha dormido mal, va sin energía');
}

console.log('(tanda 2) Cuál toca, con lo nuevo');
{
  const hoy = '2026-11-12';
  const suyo = [{ id: 'r:r1', tipo: 'correccion', efimero: true, texto: 'Codos' }, { id: 't:e', tipo: 'numeros', efimero: true, texto: 'n' }];
  const tec = [{ id: 'p:f:0', tipo: 'clave', texto: 'c' }, { id: 'p:f:m', tipo: 'musculo', texto: 'm' }, { id: 'e:f:q0', tipo: 'test', titulo: '?', opciones: ['a', 'b', 'c'], correcta: 0 }];
  const gen = [{ id: 'i:a:0', tipo: 'idea', guia: 'a', titulo: 'A' }, { id: 'i:sueno:0', tipo: 'idea', guia: 'sueno', titulo: 'S' }, { id: 'g:rir', tipo: 'glosario', titulo: 'RIR' }, { id: 'd:0', tipo: 'duda', titulo: '¿?' }];
  const todos = [...suyo, ...tec, ...gen];
  const a0 = elegirApunte(todos, null, { hoy, salto: 0 });
  const a1 = elegirApunte(todos, null, { hoy, salto: 1, excluir: [a0.id] });
  const a2 = elegirApunte(todos, null, { hoy, salto: 2, excluir: [a0.id, a1.id] });
  check(a0.id === 'r:r1' && a1.id === 't:e' && a2.tipo !== 'correccion' && a2.tipo !== 'numeros', 'lo primero del descanso, lo suyo: lo que le corrigió su coach y sus números; después, lo demás');
  check(elegirApunte(todos, null, { hoy, salto: 3, excluir: suyo.map((x) => x.id), guias: ['sueno'] }).id === 'i:sueno:0', 'si ha dormido mal, de las guías sale primero la del sueño');
  check(elegirApunte(todos, null, { hoy, salto: 3, excluir: suyo.map((x) => x.id), principiante: true }).id === 'g:rir', 'a quien empieza, el glosario antes que las ideas');
  const vistos = todos.filter((x) => !x.efimero).reduce((e, x) => apuntarVisto(e, x.id, '2026-11-01'), null);
  check(elegirApunte(todos, vistos, { hoy, salto: 2, excluir: suyo.map((x) => x.id) }) && !elegirApunte(todos.filter((x) => !x.efimero), vistos, { hoy }).efimero, 'con todo visto, vuelve lo que hace más que no ve');
  check(elegirApunte(suyo, null, { hoy, salto: 5 }) !== null, 'si solo hay lo suyo, sale igualmente');
}

console.log('(tanda 2) Guardar para luego y el reto de la siguiente serie');
{
  let e = alternarGuardado(null, 'i:a:0');
  e = alternarGuardado(e, 'm:1');
  check(e.guardados.join() === 'i:a:0,m:1' && alternarGuardado(e, 'i:a:0').guardados.join() === 'm:1' && !('guardados' in alternarGuardado(alternarGuardado(null, 'x:1'), 'x:1')), 'guardar un apunte para luego, y quitarlo');
  const v = apuntarVisto(pendienteDeSubir(e, 'm:1', false), 'm:1', '2026-11-12', false);
  check(v.guardados.join() === 'i:a:0,m:1' && v.porSubir['m:1'] === false && v.vistos['m:1'].s === false, 'ver, subir o apuntar no pierde lo guardado');
  const r = llevarReto(v, { id: 'p:f:0', texto: 'Baja en 3 segundos.', de: 'Press banca' }, '2026-11-12');
  const p = retoPendiente(r, '2026-11-12');
  check(p && p.tipo === 'reto' && p.id === 'p:f:0' && p.texto === 'Baja en 3 segundos.' && p.de === 'Press banca' && p.efimero && r.guardados.length === 2, '«Lo pruebo en la siguiente serie»: se lleva la clave como reto');
  check(retoPendiente(r, '2026-11-13') === null && retoPendiente(llevarReto(r, null), '2026-11-12') === null && retoPendiente(null, '2026-11-12') === null, 'el reto es de hoy; contestado (o al día siguiente) ya no está');
  check(limpiarVistos({ guardados: ['a', 5, 'x'.repeat(90)], reto: { id: 'p:1', texto: 5 } }).guardados.join() === 'a' && !('reto' in limpiarVistos({ reto: { id: 'p:1', texto: 5 } })), 'lo guardado ilegible se sanea');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
