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

console.log('(tanda 4) Los apuntes sueltos del coach');
{
  const A = await import('../web/src/logica/apuntes.js');
  const nov = [
    { id: 'n1', titulo: 'Dormir poco resta fuerza', texto: 'Tras dormir 4 horas, menos repeticiones.', publicada: true, publicada_en: '2026-11-10T08:00:00Z' },
    { id: 'a1', tipo: 'apunte', titulo: 'En press banca, piernas activas', texto: 'Empuja el suelo con los pies.', publicada: true, publicada_en: '2026-11-11T08:00:00Z', ejercicio_id: 'ej-press' },
    { id: 'a2', tipo: 'apunte', titulo: 'El agua, antes de tener sed', texto: 'Bebe a sorbos durante la sesión.', publicada: true, publicada_en: '2026-11-09T08:00:00Z', ejercicio_id: null },
    { id: 'a3', tipo: 'apunte', titulo: 'Borrador', texto: 'x', publicada: false, publicada_en: null },
  ];
  const todos = A.apuntesDeNovedades(nov);
  check(todos.length === 3 && todos[0].id === 'n:a1' && todos[0].tipo === 'coach' && todos[0].etiqueta === 'De tu coach' && todos[0].ejercicio === 'ej-press' && todos[1].tipo === 'novedad' && !('ejercicio' in todos[2]), 'con tipo «apunte» sale como «De tu coach» (con su ejercicio, si lo lleva); lo demás, novedad');
  check(A.apuntesDeNovedades(nov, { ejercicio: 'ej-press' }).length === 3 && A.apuntesDeNovedades(nov, { ejercicio: 'ej-sentadilla' }).map((x) => x.id).join() === 'n:n1,n:a2', 'en el descanso de otro ejercicio, el apunte de press banca no sale');
  const hoy = '2026-11-20';   // (la novedad ya no es de las últimas dos semanas... sí lo es: se da por vista)
  const visto = A.apuntarVisto(null, 'n:n1', '2026-11-12');
  const deSentadilla = [...A.apuntesDeNovedades(nov, { ejercicio: 'ej-press' }), { id: 'p:f:0', tipo: 'clave', texto: 'c' }, { id: 'i:a:0', tipo: 'idea', guia: 'a', titulo: 'A' }];
  check(A.elegirApunte(deSentadilla, visto, { hoy, salto: 0 }).id === 'n:a1', 'el apunte del coach para ese ejercicio, lo primero de lo suyo');
  check(A.elegirApunte(deSentadilla, visto, { hoy, salto: 1, excluir: ['n:a1'] }).id === 'n:a2', 'y el suelto general, delante de las ideas');
  check(A.novedadPendiente(todos, null, '2026-11-12')?.id === 'n:n1' && A.apunteDelDia(todos, '2026-11-12')?.id === 'n:n1', 'la novedad de la semana sigue siendo solo la novedad');
}

console.log('(tanda 4) La racha de aprendizaje y la medalla');
{
  const A = await import('../web/src/logica/apuntes.js');
  let e = A.apuntarVisto(null, 'i:a:0', '2026-10-28');
  e = A.apuntarVisto(e, 'i:a:1', '2026-11-05');
  e = A.apuntarVisto(e, 'i:a:0', '2026-11-12');
  check(e.dias.join() === '2026-10-28,2026-11-05,2026-11-12' && A.rachaAprendizaje(e, '2026-11-13') === 3 && A.rachaAprendizaje(e, '2026-11-17') === 3 && A.rachaAprendizaje(e, '2026-11-24') === 0, 'tres semanas seguidas aprendiendo algo (aunque repase el mismo apunte); aguanta la semana siguiente');
  check(A.rachaAprendizaje(A.apuntarVisto(null, 'x:1', '2026-10-20'), '2026-11-13') === 0 && A.rachaAprendizaje(null, '2026-11-13') === 0, 'sin nada reciente, no hay racha');
  const b = A.conServidor(null, [{ apunte: 'm:1', veces: 1, ultimo: '2026-11-03' }, { apunte: 'm:2', veces: 1, ultimo: '2026-11-11' }]);
  check(A.rachaAprendizaje(b, '2026-11-13') === 2, 'lo de la base también cuenta');
  let m = null;
  for (let i = 0; i < 41; i++) m = A.apuntarVisto(m, `i:g:${i}`, '2026-11-12');
  const med = A.medallaApuntes(m);
  check(med.vistos === 41 && med.nivel === 2 && med.nombre === 'Aplicado' && med.siguiente.nombre === 'Estudioso' && med.faltan === 59, 'la medalla: con 41 apuntes, «Aplicado»; faltan 59 para «Estudioso»');
  check(A.medallaApuntes(null).nivel === 0 && A.medallaApuntes(null).nombre === null && A.medallaApuntes(null).faltan === 10, 'sin apuntes, sin medalla: faltan 10 para la primera');
  check(A.limpiarVistos({ dias: ['2026-11-12', 'mal', '2026-11-12'], curso: { clave: 'Mal Clave', desde: 'x' }, examenes: [{ dia: '2026-11-12', aciertos: 9, total: 8 }, { dia: 'x' }] }).dias.join() === '2026-11-12'
    && !('curso' in A.limpiarVistos({ curso: { clave: 'Mal Clave', desde: 'x' } })) && A.limpiarVistos({ examenes: [{ dia: '2026-11-12', aciertos: 9, total: 8 }, { dia: 'x' }] }).examenes[0].aciertos === 8, 'lo ilegible se sanea');
}

console.log('(tanda 4) Los cursos');
{
  const A = await import('../web/src/logica/apuntes.js');
  const ideas = (g, n, titulo) => Array.from({ length: n }, (_, i) => ({ id: `i:${g}:${i}`, tipo: 'idea', guia: g, de: titulo, titulo: `${titulo} ${i}`, texto: 't' }));
  const apuntes = [...ideas('sueno', 4, 'Sueño'), ...ideas('cardio', 9, 'Cardio'), ...ideas('corta', 1, 'Corta'), { id: 'm:1', tipo: 'mito', guia: 'mitos', titulo: '«M»', texto: 't' }];
  const cursos = A.cursosDe(apuntes);
  check(cursos.length === 2 && cursos[0].clave === 'sueno' && cursos[0].titulo === 'Sueño' && cursos[0].lecciones.length === 4 && cursos[1].lecciones.length === 7, 'un curso por guía con dos lecciones o más (siete como mucho)');
  const demo = A.cursosDe(A.apuntesDeGuias(GUIAS_DEMO));
  check(demo.length >= 2 && demo.some((c) => c.clave === 'mitos' && c.titulo === 'Mitos del gimnasio' && c.lecciones.some((id) => id.startsWith('m:'))), 'en la guía de mitos, los mitos son sus lecciones');
  let e = A.apuntarVisto(null, 'i:sueno:0', '2026-11-12');
  const pr = A.progresoCurso(cursos[0], e);
  check(pr.hechas === 1 && pr.total === 4 && !pr.hecho && pr.siguiente === 'i:sueno:1' && A.leccionesPendientes(cursos[0], apuntes, e).map((a) => a.id).join() === 'i:sueno:1,i:sueno:2,i:sueno:3', 'cómo lo lleva y las lecciones que le quedan, en orden');
  const semana = A.cursoDeLaSemana(cursos, e, '2026-11-12'), otra = A.cursoDeLaSemana(cursos, e, '2026-11-19');
  check(semana && otra && semana.clave !== otra.clave && !semana.elegido, 'el curso de la semana cambia cada semana');
  e = A.elegirCurso(e, 'sueno', '2026-11-12');
  check(A.cursoDeLaSemana(cursos, e, '2026-11-12').clave === 'sueno' && A.cursoDeLaSemana(cursos, e, '2026-11-19').clave === 'sueno' && A.cursoDeLaSemana(cursos, e, '2026-11-19').elegido, 'si elige uno, es el suyo hasta que lo acaba');
  check(A.elegirApunte(apuntes, e, { hoy: '2026-11-13', curso: 'sueno' }).id === 'i:sueno:1', 'en el descanso, las lecciones de su curso van delante y en orden');
  for (const id of cursos[0].lecciones) e = A.apuntarVisto(e, id, '2026-11-13');
  check(A.progresoCurso(cursos[0], e).hecho && A.cursoDeLaSemana(cursos, e, '2026-11-19').clave === 'cardio', 'acabado, pasa al siguiente');
  for (const id of cursos[1].lecciones) e = A.apuntarVisto(e, id, '2026-11-13');
  check(A.cursoDeLaSemana(cursos, e, '2026-11-19') === null && A.cursoDeLaSemana([], null, '2026-11-19') === null && !('curso' in A.elegirCurso(e, null, '2026-11-19')), 'con todos hechos (o sin cursos), ninguno');
}

console.log('(tanda 4) El examen');
{
  const A = await import('../web/src/logica/apuntes.js');
  const todos = [...A.apuntesDeGlosario(), ...A.apuntesDeGuias(GUIAS_DEMO)];
  let e = null;
  for (const a of todos.slice(0, 14)) e = A.apuntarVisto(e, a.id, '2026-11-10');
  const falla = todos.find((a) => a.tipo === 'mito');
  e = A.apuntarVisto(e, falla.id, '2026-11-10', false);
  check(!A.puedeExaminarse(A.apuntarVisto(null, 'g:rir', '2026-11-10')) && A.puedeExaminarse(e), 'hay examen cuando ha visto una docena de apuntes');
  const x = A.examenDe(todos, e, { hoy: '2026-11-13' });
  check(x.length === 8 && x.every((q) => q.tipo === 'test' && q.opciones.length >= 2 && q.correcta >= 0 && q.correcta < q.opciones.length && q.id.startsWith('x:') && q.origen) && new Set(x.map((q) => q.id)).size === 8, 'ocho preguntas, cada una con su respuesta buena');
  check(x.some((q) => /^¿Qué es «/.test(q.titulo) && q.opciones.length === 3) && x.some((q) => /^¿Verdad o mito\?/.test(q.titulo) && q.opciones.join() === 'Verdad,Mito'), 'del glosario («¿Qué es…?», tres definiciones) y de «¿Verdad o mito?»');
  check(x.some((q) => q.origen === falla.id && q.correcta === 1), 'lo que no sabía entra seguro (y un mito es «Mito»)');
  check(JSON.stringify(A.examenDe(todos, e, { hoy: '2026-11-13' })) === JSON.stringify(x) && JSON.stringify(A.examenDe(todos, e, { hoy: '2026-11-14' })) !== JSON.stringify(x), 'el mismo día, el mismo examen; otro día, otro');
  check(A.examenDe([], e, { hoy: '2026-11-13' }) === null && A.examenDe(todos.slice(0, 2), e, { hoy: '2026-11-13' }) === null, 'sin material para cuatro preguntas, no hay examen');
  const tras = A.apuntarExamen(A.apuntarExamen(e, { dia: '2026-11-13', aciertos: 5, total: 8 }), { dia: '2026-11-13', aciertos: 7, total: 8 });
  check(tras.examenes.length === 1 && A.ultimoExamen(tras).aciertos === 7 && A.ultimoExamen(null) === null && Object.keys(tras.vistos).length === Object.keys(e.vistos).length, 'el examen queda apuntado (uno por día: el último)');
  check(A.notaExamen(8, 8) === 'Sobresaliente' && A.notaExamen(6, 8) === 'Notable' && A.notaExamen(4, 8) === 'Aprobado' && A.notaExamen(2, 8) === 'Toca repasar', 'la nota, en palabras');
}

console.log('(tanda 4) Para el coach: lo que más se falla y mandar un apunte');
{
  const A = await import('../web/src/logica/apuntes.js');
  const apuntes = [{ id: 'm:1', etiqueta: 'Mito', de: 'Nutrición', titulo: '«Cenar engorda»', texto: 'No.' }, { id: 'g:rir', etiqueta: 'Glosario', titulo: 'RIR', texto: 'Recámara.' }, { id: 'i:a:0', etiqueta: 'Idea clave', titulo: 'A', texto: 'a' }];
  // (revisión) llegan ya contadas (apuntes_fallados(), 061: nunca quién)
  const filas = [{ apunte: 'm:1', atletas: 5 }, { apunte: 'g:rir', atletas: 2 }, { apunte: 'i:a:0', atletas: 1 }, { apunte: 'e:desconocido:0', atletas: 9 }, { apunte: 'm:1', atleta_id: 'a', sabia: false }];
  const f = A.masFallados(filas, apuntes);
  check(f.length === 2 && f[0].id === 'm:1' && f[0].atletas === 5 && f[0].titulo === '«Cenar engorda»' && f[1].id === 'g:rir' && f[1].atletas === 2, 'los que más atletas no sabían, de más a menos (con uno solo no sale: se sabría quién; lo que no se sabe nombrar, fuera)');
  check(Object.keys(f[0]).sort().join() === 'atletas,de,etiqueta,id,texto,titulo' && A.masFallados([], apuntes).length === 0 && A.masFallados(filas, apuntes, 1).length === 1, 'solo cuentas: ningún nombre de atleta');
  check(A.mensajeDeApunte(apuntes[0]) === 'Un apunte para ti (Nutrición): «Cenar engorda» No.' && A.mensajeDeApunte(apuntes[1]) === 'Un apunte para ti: RIR: Recámara.' && A.mensajeDeApunte(null) === '', 'el mensaje con el que se manda un apunte');
}

console.log('(apuntes bellos) El arte, en números y en palabras');
{
  const B = await import('../web/src/logica/apuntes-arte.js');
  const A = await import('../web/src/logica/apuntes.js');
  const tipos = ['clave', 'error', 'mito', 'idea', 'glosario', 'test', 'duda', 'coach', 'novedad', 'numeros', 'correccion', 'musculo', 'clip', 'reto'];
  check(tipos.every((t) => B.TONOS.includes(B.arteDe(t).tono) && B.arteDe(t).sello) && B.arteDe('inventado').tono === 'morado' && B.arteDe('mito').tono === 'rosa' && B.arteDe('error').tono === 'ambar',
    'cada tipo de apunte, con su tono y su sello (y uno desconocido, como una idea)');
  const k = B.palabraClave('Banco demasiado inclinado');
  check(k.palabra === 'demasiado' && k.antes + k.palabra + k.despues === 'Banco demasiado inclinado', 'el rotulador subraya la palabra más larga del título');
  check(B.palabraClave('La prisa sale cara').palabra === 'prisa' && B.palabraClave('«Cenar engorda»') === null && B.palabraClave('¿Qué es el RIR?') === null && B.palabraClave('Un eje') === null && B.palabraClave('') === null && B.palabraClave(null) === null,
    'si empatan, la primera; las frases entre comillas, las preguntas y los títulos sin palabras largas, sin rotulador');
  check(B.palabraClave('Sobre todo, el pectoral').palabra === 'pectoral', 'las palabras de relleno no se subrayan');
  const trozos = B.trozosConTerminos('Deja dos repeticiones en recámara (RIR 2) y controla el tempo.', [['RIR', 'a'], ['Tempo', 'b'], ['1RM', 'c']]);
  check(trozos.map((x) => x.texto).join('') === 'Deja dos repeticiones en recámara (RIR 2) y controla el tempo.' && trozos.filter((x) => x.termino).map((x) => `${x.termino}=${x.texto}`).join() === 'RIR=RIR,Tempo=tempo',
    'las palabras del glosario se encuentran dentro del texto (sin mirar mayúsculas), y juntos los trozos dan el texto tal cual');
  check(B.trozosConTerminos('El tempora y el contratempo', [['tempo', 'x']]).length === 1 && B.trozosConTerminos('Rápido: la técnica', [['tecnica', 'x']]).some((x) => x.termino === 'tecnica' && x.texto === 'técnica') && B.trozosConTerminos('', [['a', 'b']])[0].texto === '' && B.trozosConTerminos('x', [])[0].texto === 'x',
    'solo como palabra entera, y sin mirar las tildes');
  check(B.trozosConTerminos('RIR y más RIR', [['RIR', 'a']]).filter((x) => x.termino).length === 1, 'cada término, solo la primera vez');
  let e = A.apuntarVisto(null, 'g:rir', '2026-11-09');
  e = A.apuntarVisto(e, 'g:rpe', '2026-11-11');
  const sem = B.semanaDeAprendizaje(e, '2026-11-12');
  check(sem.length === 7 && sem.map((d) => d.letra).join('') === 'LMXJVSD' && sem.map((d) => (d.hecho ? 1 : 0)).join('') === '1010000' && sem[3].hoy && sem[4].futuro && !sem[2].futuro && sem[0].fecha === '2026-11-09',
    'la semana de aprendizaje: de lunes a domingo, encendidos los días que aprendió algo');
  check(B.semanaDeAprendizaje(null, '2026-11-12').every((d) => !d.hecho) && B.semanaDeAprendizaje(e, 'mal').length === 0, 'sin nada, todos apagados');
  check(B.metalDe(0) === null && B.metalDe(1) === 'bronce' && B.metalDe(3) === 'oro' && B.metalDe(4) === 'lavanda' && B.metalDe(9) === 'lavanda', 'el metal de cada medalla');
  let m9 = null; for (let i = 0; i < 9; i++) m9 = A.apuntarVisto(m9, `i:g:${i}`, '2026-11-12');
  const m10 = A.apuntarVisto(m9, 'i:g:9', '2026-11-12');
  check(B.medallaNueva(m9, m10) === 1 && B.medallaNueva(m10, m10) === 0 && B.medallaNueva(null, m9) === 0, 'se sabe cuándo se estrena una medalla (con el décimo apunte, la primera)');
  check(B.deslizar(-120, 10, 390) === 'izquierda' && B.deslizar(130, 30, 390) === 'derecha' && B.deslizar(60, 0, 390) === null && B.deslizar(120, 100, 390) === null && B.deslizar(110, 0, 800) === null && B.deslizar(NaN, 0) === null,
    'deslizar: hace falta moverla de lado (80 px o un cuarto del ancho) y más de lado que de arriba abajo');
  const a0 = B.arrastre(0), a1 = B.arrastre(200), a2 = B.arrastre(-50);
  check(a0.giro === 0 && a0.etiqueta === 0 && Math.abs(a1.giro - 200 / 22) < 1e-9 && a1.etiqueta === 1 && a2.giro < 0 && a2.etiqueta > 0 && a2.etiqueta < 1 && B.arrastre(900).giro === 12,
    'mientras se arrastra, gira un poco y asoma lo que hará al soltar');
  const n1 = B.aroDeNota(8, 8), n2 = B.aroDeNota(4, 8), n3 = B.aroDeNota(6, 8);
  check(n1.pct === 1 && n1.confeti && n1.tono === 'oro' && n2.pct === 0.5 && !n2.confeti && n2.tono === 'morado' && n3.confeti && n3.tono === 'verde' && B.aroDeNota(1, 0).pct === 0 && B.aroDeNota(1, 8).tono === 'ambar',
    'la nota del examen: el aro se llena con los aciertos y, de notable para arriba, confeti');
  check(B.barraDescanso(60, 120).k === 0.5 && !B.barraDescanso(60, 120).final && B.barraDescanso(8, 120).final && B.barraDescanso(0, 120).k === 0 && !B.barraDescanso(0, 120).final && B.barraDescanso(200, 120).k === 1 && B.barraDescanso(5, 0) === null && B.barraDescanso(NaN, 9) === null,
    'la cuenta del descanso como barra, con los diez últimos segundos aparte');
  check(B.puntosDeTanda(['sabia', 'no', 'visto', 'raro']).join() === 'sabia,no,visto' && B.puntosDeTanda(Array(20).fill('visto')).length === 12 && B.puntosDeTanda().length === 0, 'un punto por apunte del rato (hasta doce)');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
