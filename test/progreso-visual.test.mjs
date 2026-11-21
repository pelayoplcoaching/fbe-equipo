// (v0.203) Progreso y seguimiento, más bonitos: lo puro (los huecos y el final del eje de las gráficas, la previsión
// hacia la meta, las franjas de los bloques, la meta de un objetivo, el ritmo del peso frente a ella, el cambio de cada
// medida y dónde va su etiqueta, el color de cada casilla del check-in, sus tendencias, la zona de la carga y lo que
// subió cada récord) y lo que tiene que estar en su sitio (la hoja progreso-visual.css, ASCII, con tokens y su oscuro).
//   node test/progreso-visual.test.mjs
import { readFileSync } from 'node:fs';
import * as V from '../web/src/logica/visual.js';
import * as P from '../web/src/logica/progreso-visual.js';
import * as S from '../web/src/logica/seguimiento-visual.js';
import * as C from '../web/src/logica/calculos.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const src = (r) => readFileSync(new URL(`../web/src/${r}`, import.meta.url), 'utf8');

console.log('Las gráficas, con fechas de verdad');
{
  const sem = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-10-19', '2026-10-26', '2026-11-02'];
  check(V.sonFechas(sem) && !V.sonFechas(['2026-09-07', 'x']) && !V.sonFechas([]), 'reconoce una serie con fechas (y no la que no lo es)');
  check(JSON.stringify(V.huecosSerie(sem)) === '[3]', 'un parón de 4 semanas entre semanas seguidas es un hueco (del 21 sep al 19 oct)');
  check(V.huecosSerie(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']).length === 0, 'semanas seguidas: ningún hueco');
  check(V.huecosSerie(['2026-01-05', '2026-02-02', '2026-03-02', '2026-03-30']).length === 0, 'medidas cada 4 semanas: lo normal no es un hueco');
  check(V.huecosSerie(['2026-01-05', '2026-03-02']).length === 0, 'con dos puntos no hay «lo normal»: ningún hueco');
  check(V.finDominio('2026-09-01', '2026-11-01', null) === '2026-11-01' && V.finDominio('2026-09-01', '2026-11-01', '2026-10-01') === '2026-11-01', 'sin meta (o con la meta ya pasada), el eje acaba en el último punto');
  check(V.finDominio('2026-09-01', '2026-11-01', '2026-11-15') === '2026-11-15', 'con la meta cerca, el eje llega hasta ella');
  check(V.finDominio('2026-09-01', '2026-11-01', '2027-06-01') === '2026-12-02', 'con la meta muy lejos, como mucho la mitad del tramo que se ve');
  const p1 = V.puntoPrevision({ x: '2026-11-01', y: 76 }, { x: '2026-11-15', y: 80 }, '2026-11-15');
  check(p1 && p1.llega && p1.y === 80, 'la previsión llega a la meta si cabe en el eje');
  const p2 = V.puntoPrevision({ x: '2026-11-01', y: 76 }, { x: '2026-12-01', y: 82 }, '2026-11-16');
  check(p2 && !p2.llega && p2.x === '2026-11-16' && Math.abs(p2.y - 79) < 1e-9, 'si no cabe, hasta el final del eje con el valor que tocaría ese día');
  check(V.puntoPrevision({ x: '2026-11-01', y: 76 }, { x: '2026-10-01', y: 80 }, '2026-11-01') === null, 'una meta con fecha pasada no se dibuja');
  const bl = [
    { numero: 1, nombre: 'Base', fecha_inicio: '2026-08-03', fecha_fin: null, estado: 'finalizado' },
    { numero: 2, nombre: 'Fuerza', fecha_inicio: '2026-09-28', fecha_fin: '2026-10-25', estado: 'finalizado' },
    { numero: 3, nombre: 'Pico', fecha_inicio: '2026-10-26', estado: 'activo' },
    { numero: 4, nombre: 'Luego', fecha_inicio: '2026-12-07', estado: 'planificado' },
    { numero: 9, nombre: 'Anulado', fecha_inicio: '2026-09-01', estado: 'cancelado' },
  ];
  const fr = V.franjasBloques(bl, '2026-09-07', '2026-11-16', '2026-11-16');
  check(fr.length === 3 && fr.map((f) => f.etiqueta).join() === 'B1,B2,B3', 'las franjas de los bloques que caen en el eje (sin el cancelado ni el que aún no ha empezado)');
  check(fr[0].desde === '2026-09-07' && fr[0].hasta === '2026-09-27' && fr[2].hasta === '2026-11-16', 'cada una recortada al eje; sin fecha de fin, hasta el día antes del siguiente');
  check(V.franjasBloques(bl, '2026-10-26', '2026-11-16', '2026-11-16').length === 0, 'con un solo bloque dentro, ninguna (no dice nada)');
}

console.log('\nLa meta de un objetivo y el ritmo del peso');
{
  const objs = [
    { id: 'a', tipo: 'fuerza', ejercicio_id: 'sq', estado: 'en_curso', auto: { meta: 88, pct: 43, prevision: { fecha: '2026-12-26' } } },
    { id: 'b', tipo: 'fuerza', ejercicio_id: 'bp', estado: 'en_curso', auto: { meta: 62.5, conseguido: { fecha: '2026-11-01' } } },
    { id: 'c', tipo: 'peso', estado: 'en_curso', autoPeso: { meta: 61, actual: 61.7, prevision: { fecha: '2027-01-10' } } },
  ];
  const mf = P.metaFuerza(objs, 'sq');
  check(mf && mf.y === 88 && mf.hasta === '2026-12-26' && /^Meta: 88 kg$/.test(mf.texto), 'la meta del objetivo de ese ejercicio, con su previsión');
  check(P.metaFuerza(objs, 'bp') === null && P.metaFuerza(objs, 'dl') === null, 'un objetivo ya conseguido (o de otro ejercicio) no se dibuja');
  const mp = P.metaPeso(objs);
  check(mp && mp.y === 61 && mp.hasta === '2027-01-10', 'la meta de peso corporal');
  check(P.metaPeso([{ ...objs[2], autoPeso: { meta: 61, llegado: true } }]) === null, 'si la tendencia ya está en ella, no hay meta que dibujar');
  check(P.ritmoFrenteMeta({ kgSemana: -0.15 }, 61.7, mp) === 'hacia' && P.ritmoFrenteMeta({ kgSemana: 0.2 }, 61.7, mp) === 'contra', 'bajando hacia 61 kg va hacia la meta; subiendo, en contra');
  check(P.ritmoFrenteMeta({ kgSemana: 0.01 }, 61.7, mp) === null && P.ritmoFrenteMeta({ kgSemana: -0.2 }, 61.7, null) === null, 'con el ritmo casi a cero, o sin objetivo de peso, neutro');
}

console.log('\nTu cuerpo en cifras');
{
  const med = [{ fecha: '2026-09-26', cintura_cm: 74.5, brazo_cm: 28.5 }, { fecha: '2026-10-24', cintura_cm: 73.5 }, { fecha: '2026-11-21', cintura_cm: 72.6, brazo_cm: 28.5 }];
  const cm = P.cambiosMedidas(med, [['cintura_cm', 'Cintura'], ['brazo_cm', 'Brazo'], ['muslo_cm', 'Muslo']]);
  check(cm.length === 2 && cm[0].valor === 72.6 && cm[0].cambio === -1.9 && cm[0].desde === '2026-09-26' && cm[1].cambio === 0, 'cada medida con su último valor y su cambio desde la primera (y sin las que no tienen datos)');
  const al = P.alturasEtiquetas([44, 90, 128]);
  check(al[1] - al[0] >= 26 && al[2] - al[1] >= 26 && al[0] >= 11 && al[2] <= 89, `las etiquetas de un lado no se pisan (${al.join(', ')} %)`);
  const al2 = P.alturasEtiquetas([150, 170, 190]);
  check(al2[2] <= 89 && al2[1] <= al2[2] - 26 && al2[0] <= al2[1] - 26, `ni se salen por abajo (${al2.join(', ')} %)`);
  check(P.alturasEtiquetas([60]).join() === '30', 'una sola etiqueta va a la altura de su medida');
}

console.log('\nLos check-ins en color y sus tendencias');
{
  check(S.nivelCheckin('sueno', '7-8') === 'bien' && S.nivelCheckin('sueno', '6-7') === 'regular' && S.nivelCheckin('sueno', '<5') === 'mal' && S.nivelCheckin('sueno', null) === '', 'el sueño por tramos');
  check(S.nivelCheckin('energia', 5) === 'bien' && S.nivelCheckin('energia', 3) === 'regular' && S.nivelCheckin('energia', 2) === 'mal', 'las escalas de 1 a 5');
  check(S.nivelCheckin('pasos', 10292) === 'bien' && S.nivelCheckin('pasos', 7080) === 'regular' && S.nivelCheckin('pasos', 3000) === 'mal', 'los pasos');
  check(S.nivelCheckin('molestias', 0) === '' && S.nivelCheckin('molestias', 1) === 'regular' && S.nivelCheckin('molestias', 2) === 'mal', 'las molestias (ninguna no se colorea)');
  check(S.horasSueno('7-8') === 7.5 && S.horasSueno('>8') === 8.5 && S.horasSueno('x') === null, 'las horas de sueño de cada tramo, para dibujarlas');
  check(S.adherenciaMedia({ adherencia_desayuno: 5, adherencia_comida: 4, adherencia_cena: null }) === 4.5 && S.adherenciaMedia({}) === null, 'la adherencia media de las comidas que contestó');
  const ck = [
    { semana_inicio: '2026-11-09', energia: 4, recuperacion: 4, motivacion: 5, horas_sueno: '7-8', pasos_media: 10292 },
    { semana_inicio: '2026-10-26', energia: 5, recuperacion: 4, motivacion: 3, horas_sueno: '7-8' },
    { semana_inicio: '2026-11-02', energia: 4, recuperacion: 4, motivacion: 5, horas_sueno: '7-8', pasos_media: 9325 },
  ];
  const t = S.tendenciasCheckin(ck);
  const en = t.find((x) => x.clave === 'energia');
  check(en && en.valores.join() === '5,4,4' && en.cambio === 'igual', 'en orden de semanas, aunque lleguen desordenados');
  check(t.find((x) => x.clave === 'pasos')?.cambio === 'sube' && t.find((x) => x.clave === 'motivacion')?.valores.join() === '3,5,5', 'los pasos suben; la motivación, de 3 a 5');
  check(S.tendenciasCheckin([ck[0]]).length === 0, 'con un solo check-in, ninguna tendencia');
}

console.log('\nLa zona de la carga');
{
  const z = S.zonaCarga(1600);
  check(z.desde === 800 && z.hasta === 2400 && S.zonaCarga(0) === null, 'de la mitad a vez y media de su media (los umbrales del aviso)');
  check(S.fueraDeZona(2500, z) && S.fueraDeZona(700, z) && !S.fueraDeZona(1600, z) && !S.fueraDeZona(0, z) && !S.fueraDeZona(2500, null), 'lo que se sale (y una semana sin carga no cuenta)');
}

console.log('\nLo que subió cada récord (la vitrina)');
{
  const h = [
    { id: 'h1', ejercicio_id: 'banca', ejercicio: 'Press banca', fecha: '2026-10-06', sesion_id: 's1', kg: 60, reps: 8, rpe: 8 },
    { id: 'h2', ejercicio_id: 'banca', ejercicio: 'Press banca', fecha: '2026-10-13', sesion_id: 's2', kg: 62.5, reps: 8, rpe: 8 },
    { id: 'h3', ejercicio_id: 'banca', ejercicio: 'Press banca', fecha: '2026-10-20', sesion_id: 's3', kg: 65, reps: 8, rpe: 8 },
  ];
  const v = C.vitrina(h, '2026-10-24');
  const b = v.ejercicios[0];
  check(b.subida && b.subida.tipo === 'e1rm' && b.subida.fecha === '2026-10-20' && b.subida.valor > b.subida.antes && Math.abs(b.subida.valor - b.e1rm.valor) < 0.05, 'el último récord de 1RM estimado, con lo que había antes');
  const v1 = C.vitrina([h[0]], '2026-10-24');
  check(v1.ejercicios[0].subida === null, 'con una sola sesión no hay récord, ni subida');
}

console.log('\nEn su sitio');
{
  const css = src('progreso-visual.css');
  check(!/[^\x00-\x7F]/.test(css), 'progreso-visual.css, solo ASCII');
  check(/@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\)/.test(css) && /:root\[data-theme="dark"\]/.test(css), 'sus colores tienen versión oscura (de serie y elegida)');
  check(!/#[0-9a-fA-F]{3,8}\b/.test(css) && !/rgba?\(/.test(css), 'sin colores sueltos: todo con tokens');
  check(!/[^-]opacity\s*:/.test(css), 'nada entra o se apaga con opacity');
  check(/prefers-reduced-motion: no-preference/.test(css), 'las transiciones, solo sin «reducir movimiento»');
  check(src('main.jsx').includes("import './progreso-visual.css';"), 'la hoja se carga');
  const g = src('ui/comunes.jsx');
  check(/export function GraficaFantasma/.test(g) && /globo-record/.test(g) && /mascaraTramos/.test(g), 'la gráfica fantasma, el globo dorado y los tramos discontinuos');
  const pr = src('ui/atleta/Progreso.jsx');
  check(/<CuerpoEnCifras/.test(pr) && /<BloqueAros/.test(pr) && /enCurso=\{tonEnCurso\}/.test(pr) && /marcas=\{marcasEj\}/.test(pr), 'Progreso usa la figura de medidas, los aros del bloque, la semana en curso y las marcas en el 1RM');
  const f = src('ui/coach/Ficha.jsx');
  check(/<IndiceSeguimiento/.test(f) && /<TendenciasCheckin/.test(f) && /tabla-checkins/.test(f) && /zona-carga/.test(f), 'la ficha usa el índice, las tendencias, los check-ins en color y la zona de la carga');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
