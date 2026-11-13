// «Apuntes»: formación en los descansos. Tarjetas que se leen en veinte o treinta segundos, sacadas de lo que el coach
// ya tiene escrito en la app (nada nuevo que guardar en la base):
//   · clave   un paso de la ficha de técnica del ejercicio del que se está descansando
//   · error   un error típico de esa ficha: delante, el error; detrás, por qué y cómo se corrige
//   · idea    una idea clave de una guía
//   · mito    un mito de la guía de mitos: delante, el mito; detrás, lo que se sabe
//   · novedad «la novedad de la semana»: un estudio o una idea en tres líneas que escribe el coach (migración 060)
// Las de «delante y detrás» (error, mito) se dan la vuelta y el atleta dice si lo sabía: las que no sabía vuelven otro
// día. Lo visto se recuerda en el móvil (ui/apuntes.js). Aquí solo hay funciones puras.
import { fichaParaLeer, erroresDeFicha, mitosDeGuia, sinMarcas } from './guias.js';
import { normal } from './busqueda.js';
import { lunesDe, sumarDias } from './fechas.js';

const MAX = 420;   // letras de un apunte: lo que se lee en medio minuto
const corta = (s, n = MAX) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const c = t.slice(0, n), fin = Math.max(c.lastIndexOf('. '), c.lastIndexOf('; '));
  return fin > n * 0.5 ? c.slice(0, fin + 1) : `${c.slice(0, c.lastIndexOf(' '))}…`;
};
const mayuscula = (s) => (s ? s.charAt(0).toLocaleUpperCase('es') + s.slice(1) : s);
const objeto = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const lista = (x) => (Array.isArray(x) ? x : []);

// Los apuntes de la ficha de un ejercicio. ficha: la fila de fichas_ejercicio ({ id, nombre, ficha }); nombre: cómo se
// llama el ejercicio en la sesión (si no, el de la ficha)
export function apuntesDeFicha(fila, nombre = '') {
  if (!fila?.id) return [];
  const f = fichaParaLeer(fila), de = String(nombre || fila.nombre || '').trim();
  const pasos = f.pasos.map((p, i) => ({ id: `p:${fila.id}:${i}`, tipo: 'clave', de, etiqueta: 'La clave', titulo: '', texto: corta(sinMarcas(p)) }));
  const errores = erroresDeFicha(fila).map((e, i) => ({
    id: `e:${fila.id}:${i}`, tipo: 'error', de, etiqueta: 'Error típico', titulo: e.titulo,
    // («**Chocar las mancuernas** arriba: …»: el resto sigue la frase del título)
    texto: corta(e.seguido ? `${e.titulo} ${e.x}` : mayuscula(e.x)), vuelta: !!e.x,
  }));
  return [...pasos, ...errores].filter((a) => a.texto || a.titulo);
}

// Los apuntes de las guías publicadas: sus ideas clave y, de la guía «mitos», cada mito
export function apuntesDeGuias(guias = []) {
  const out = [];
  for (const g of lista(guias)) {
    if (!g?.clave || g.publicada === false) continue;
    lista(objeto(g.contenido).ideas).forEach((i, n) => {
      const titulo = sinMarcas(objeto(i).titulo || '').trim(), x = sinMarcas(objeto(i).x || '').trim();
      if (titulo || x) out.push({ id: `i:${g.clave}:${n}`, tipo: 'idea', de: String(g.titulo || '').trim(), guia: g.clave, etiqueta: 'Idea clave', titulo, texto: corta(x) });
    });
    if (g.clave === 'mitos') {
      for (const m of mitosDeGuia(g)) {
        const texto = corta(m.bloques.filter((b) => b.t === 'p').map((b) => sinMarcas(b.x)).join(' '), 520);
        if (texto) out.push({ id: `m:${m.n}`, tipo: 'mito', de: m.tema, guia: 'mitos', etiqueta: 'Mito', titulo: `«${m.mito}»`, texto, vuelta: true });
      }
    }
  }
  return out;
}

// Las novedades publicadas, la última primero: [{ id, titulo, texto, fuente, enlace, publicada, publicada_en }]
// (tanda 4, migración 061) con tipo 'apunte' es un apunte suelto del coach («De tu coach»): no caduca como la novedad y,
// si lleva ejercicio_id, sale en los descansos de ese ejercicio. `ejercicio`: el id del ejercicio del que se descansa
// (los apuntes de otro ejercicio se quedan fuera); sin él (repaso, guardados), van todos.
export function apuntesDeNovedades(novedades = [], { ejercicio = null } = {}) {
  return lista(novedades).filter((n) => n?.id && n.publicada && n.publicada_en)
    .sort((a, b) => String(b.publicada_en).localeCompare(String(a.publicada_en)))
    .map((n) => {
      const enlace = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(String(n.enlace || '')) && !/\s/.test(n.enlace) ? n.enlace : null;
      const suelto = n.tipo === 'apunte';
      return { id: `n:${n.id}`, tipo: suelto ? 'coach' : 'novedad', etiqueta: suelto ? 'De tu coach' : 'Novedad de la semana', de: '', titulo: sinMarcas(n.titulo || '').trim(), texto: corta(sinMarcas(n.texto || ''), 520),
        fuente: String(n.fuente || '').trim() || null, enlace, dia: String(n.publicada_en).slice(0, 10), ...(suelto && n.ejercicio_id ? { ejercicio: n.ejercicio_id } : {}) };
    }).filter((a) => a.titulo && a.texto && (!a.ejercicio || !ejercicio || a.ejercicio === ejercicio));
}
// La novedad reciente (publicada en los últimos `dias`) que aún no ha visto, o null
export function novedadPendiente(apuntes = [], estado = null, hoy, dias = 14) {
  const v = limpiarVistos(estado).vistos;
  return apuntes.find((a) => a.tipo === 'novedad' && !v[a.id] && DIA.test(a.dia || '') && diasEntre(a.dia, hoy) >= 0 && diasEntre(a.dia, hoy) < dias) || null;
}

// ---------- (tanda 2) Más apuntes: lo tuyo, preguntas, dudas y glosario ----------
const sinTildes = normal;   // (sin tildes y en minúsculas: logica/busqueda.js)
// Un número fijo de un texto (para elegir siempre lo mismo con los mismos datos)
const huella = (t) => { let h = 7; for (const ch of String(t)) h = (h * 31 + ch.codePointAt(0)) % 1000003; return h; };

// Lo que le corrigió su coach en este ejercicio (sus recordatorios de técnica activos): [{ id, ejercicio_id, texto }].
// Son suyos y de este momento: no se apuntan como vistos.
export function apuntesDeCorrecciones(recordatorios = [], ejercicio = null) {
  if (!ejercicio?.id) return [];
  return lista(recordatorios).filter((r) => r?.id && r.ejercicio_id === ejercicio.id && r.activo !== false && String(r.texto || '').trim())
    .slice(0, 3).map((r) => ({ id: `r:${r.id}`, tipo: 'correccion', efimero: true, de: String(ejercicio.nombre || ''), etiqueta: 'Te lo corrigió tu coach', titulo: '', texto: corta(r.texto, 200) }));
}
// Sus números en este ejercicio: lo que hizo la última vez y lo que le toca ahora. ejercicio: { id, nombre, ultima, toca }
export function apunteDeNumeros(ejercicio = null) {
  const ultima = String(ejercicio?.ultima || '').trim(), toca = String(ejercicio?.toca || '').trim();
  if (!ejercicio?.id || (!ultima && !toca)) return null;
  return { id: `t:${ejercicio.id}`, tipo: 'numeros', efimero: true, de: String(ejercicio.nombre || ''), etiqueta: 'Tus números',
    titulo: toca ? `Ahora: ${toca}` : '', texto: ultima ? `La última vez hiciste ${ultima}.` : 'Es la primera vez que lo apuntas: hoy pones la marca de salida.' };
}
// El vídeo del ejercicio (si es de YouTube): para ver el gesto en el descanso
export function apunteDeClip(ejercicio = null) {
  const url = String(ejercicio?.video || '');
  if (!ejercicio?.id || !/^https:\/\/((www|m)\.)?(youtube\.com|youtu\.be)\//i.test(url)) return null;
  return { id: `c:${ejercicio.id}`, tipo: 'clip', efimero: true, de: String(ejercicio.nombre || ''), etiqueta: 'Así se hace', titulo: '', texto: '', video: url };
}
// «Qué deberías notar»: los músculos de la ficha
export function apunteDeMusculo(fila, nombre = '', grupo = null) {
  if (!fila?.id) return null;
  const f = fichaParaLeer(fila), pr = sinMarcas(f.principales).trim(), se = sinMarcas(f.secundarios).trim();
  if (!pr) return null;
  return { id: `p:${fila.id}:m`, tipo: 'musculo', de: String(nombre || fila.nombre || '').trim(), etiqueta: 'Qué deberías notar', titulo: `Sobre todo, ${pr.charAt(0).toLocaleLowerCase('es')}${pr.slice(1)}`,
    texto: se ? `También ayudan: ${se.charAt(0).toLocaleLowerCase('es')}${se.slice(1)}${/[.!?]$/.test(se) ? '' : '.'}` : '', grupo: Array.isArray(grupo) ? grupo[0] || null : grupo || null };
}
// Preguntas tipo test, de la ficha: qué trabaja sobre todo y cuántas repeticiones para un objetivo. Tres opciones, una
// buena, siempre en el mismo orden para la misma ficha.
const MUSCULOS = ['Pectoral', 'Dorsal ancho', 'Cuádriceps', 'Glúteo mayor', 'Isquiotibiales', 'Deltoides', 'Bíceps', 'Tríceps', 'Gemelos', 'Abdominales', 'Trapecio', 'Lumbares'];
const barajar = (xs, n) => xs.map((x, i) => [huella(`${n}:${i}:${x}`), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
export function preguntasDeFicha(fila, nombre = '') {
  if (!fila?.id) return [];
  const f = fichaParaLeer(fila), de = String(nombre || fila.nombre || '').trim(), out = [];
  const pr = sinMarcas(f.principales).trim();
  if (pr) {
    const dichos = sinTildes(`${pr} ${f.secundarios}`);
    const otros = barajar(MUSCULOS.filter((m) => !dichos.includes(sinTildes(m).split(' ')[0])), fila.id).slice(0, 2);
    if (otros.length === 2) {
      const opciones = barajar([pr, ...otros], `${fila.id}:m`);
      out.push({ id: `e:${fila.id}:q0`, tipo: 'test', de, etiqueta: 'Pregunta', titulo: `¿Qué trabaja sobre todo ${de ? `en ${de.charAt(0).toLocaleLowerCase('es')}${de.slice(1)}` : 'este ejercicio'}?`, opciones, correcta: opciones.indexOf(pr), texto: f.secundarios ? `También ayudan: ${sinMarcas(f.secundarios)}.`.replace(/\.\.$/, '.') : '' });
    }
  }
  const filas = f.tabla.filter((r) => r.reps);
  const distintas = [...new Set(filas.map((r) => r.reps))];
  if (distintas.length >= 3) {
    const r = filas[huella(fila.id) % filas.length];
    const opciones = barajar([r.reps, ...distintas.filter((x) => x !== r.reps).slice(0, 2)], `${fila.id}:r`);
    out.push({ id: `e:${fila.id}:q1`, tipo: 'test', de, etiqueta: 'Pregunta', titulo: `¿Cuántas repeticiones para ${r.objetivo.toLocaleLowerCase('es')}?`, opciones, correcta: opciones.indexOf(r.reps), texto: [r.rpe && `Esfuerzo: ${r.rpe}`, r.descanso && `descanso: ${r.descanso}`].filter(Boolean).join('; ') });
  }
  return out;
}
// Las dudas frecuentes de la app: [[pregunta, respuesta]]
export function apuntesDeDudas(faq = []) {
  return lista(faq).map((d, i) => ({ id: `d:${i}`, tipo: 'duda', de: '', etiqueta: 'Duda frecuente', titulo: String(d?.[0] || '').trim(), texto: corta(d?.[1] || '', 520) })).filter((a) => a.titulo && a.texto);
}
// El glosario: las palabras del oficio, en una frase. Salen como apuntes (antes, a quien empieza) y al tocar la palabra
export const GLOSARIO = [
  ['RIR', 'Repeticiones en recámara: las que te quedaban por hacer al acabar la serie. RIR 2 es parar cuando aún podías hacer dos más.'],
  ['RPE', 'Esfuerzo percibido, del 1 al 10. Un 10 es no poder hacer ni una más; un 8, que te quedaban dos.'],
  ['Tempo', 'El ritmo de cada repetición, en segundos: bajar, pausa abajo, subir y pausa arriba. «3-1-1-0» es bajar en tres, parar uno y subir en uno.'],
  ['1RM', 'El peso máximo que puedes mover una sola vez. La app lo estima con tus series: no hace falta probarlo.'],
  ['Back-off', 'Las series que van después de la serie más pesada del día, con menos peso, para sumar trabajo sin tanta fatiga.'],
  ['Descarga', 'Una semana más suave a propósito (menos series o menos peso) para recuperarte y seguir progresando después.'],
  ['Superserie', 'Dos ejercicios seguidos sin descanso entre ellos; se descansa al acabar el segundo.'],
  ['Hipertrofia', 'Ganar músculo. Pide series cerca del fallo, suficiente volumen y comer y dormir para recuperarlo.'],
  ['Volumen', 'Cuánto trabajo haces: el número de series duras por grupo muscular cada semana.'],
  ['Fallo', 'El punto en el que no puedes completar otra repetición con buena técnica.'],
];
export const apuntesDeGlosario = () => GLOSARIO.map(([t, x]) => ({ id: `g:${sinTildes(t).replace(/[^a-z0-9]/g, '')}`, tipo: 'glosario', de: '', etiqueta: 'Glosario', titulo: t, texto: x }));
// Las palabras del glosario que salen en un texto (para explicarlas al tocarlas): [[palabra, explicación]]
export function terminosDe(texto = '') {
  const t = ` ${sinTildes(texto)} `;
  return GLOSARIO.filter(([p]) => new RegExp(`[^a-z0-9]${sinTildes(p).replace(/[^a-z0-9]/g, '.')}[^a-z0-9]`).test(t));
}
// El primer vídeo de YouTube de una guía (para «Ver el vídeo» en sus apuntes): { url, titulo } o null
export function videoDeGuia(guia) {
  for (const s of lista(objeto(guia?.contenido).secciones)) for (const b of lista(objeto(s).bloques)) {
    const o = objeto(b);
    if (o.t === 'video' && /^https:\/\/((www|m)\.)?(youtube\.com|youtu\.be)\//i.test(String(o.url || ''))) return { url: o.url, titulo: String(o.titulo || guia.titulo || '') };
  }
  return null;
}
// Las guías que vienen a cuento ahora (tanda 2): semana de descarga, ha dormido mal, va sin energía. Devuelve sus claves.
export function guiasACuento({ foco = null, sueno = null, energia = null } = {}) {
  const out = [];
  if (foco === 'descarga') out.push('deload');
  if (Number(sueno) === 1) out.push('sueno');
  if (Number(energia) === 1) out.push('motivacion');
  return out;
}

// ---------- Lo visto (en el móvil) ----------
// (v0.148) Lo que la base admite como apunte (como apuntar_apunte() en la 061: cualquier letra; la 060 sola admite p, e, i,
// m y n y rechaza el resto, que sale de la cola): lo demás no se pone en cola
export const ID_APUNTE = /^[a-z]:[A-Za-z0-9:_-]{1,78}$/;
// (v0.148) El enlace de una novedad, como lo admite la base (060): https, un dominio y, si acaso, puerto, ruta, ?consulta o
// #ancla, sin espacios ni caracteres de control o invisibles
export const ENLACE_NOVEDAD = /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][\x21-\x7e]*)?$/;
// { vistos: { <id>: { n: veces, t: día (AAAA-MM-DD) de la última, s: lo sabía (true/false; solo las de dar la vuelta) } } }
// Como mucho 600 apuntes recordados (los más antiguos, fuera).
const DIA = /^\d{4}-\d{2}-\d{2}$/;
export function limpiarVistos(g) {
  const vistos = {};
  const pares = Object.entries(objeto(objeto(g).vistos)).filter(([id, v]) => id.length <= 80 && v && typeof v === 'object' && DIA.test(v.t));
  for (const [id, v] of pares.sort((a, b) => (a[1].t < b[1].t ? -1 : 1)).slice(-600)) {
    vistos[id] = { n: Math.min(999, Math.max(1, Math.round(Number(v.n) || 1))), t: v.t, ...(typeof v.s === 'boolean' ? { s: v.s } : {}) };
  }
  // (060) lo que no se pudo subir a la base (sin red): { <id>: true | false | null (si lo sabía) }, como mucho 300
  const porSubir = {};
  for (const [id, sabia] of Object.entries(objeto(objeto(g).porSubir)).slice(-300)) if (ID_APUNTE.test(id)) porSubir[id] = typeof sabia === 'boolean' ? sabia : null;
  // (tanda 2) los que ha guardado para luego (hasta 100) y el reto que se llevó a la siguiente serie
  const guardados = lista(objeto(g).guardados).filter((x) => typeof x === 'string' && x.length <= 80).slice(-100);
  const r = objeto(objeto(g).reto);
  const reto = typeof r.id === 'string' && r.id.length <= 80 && typeof r.texto === 'string' && DIA.test(r.dia || '') ? { id: r.id, texto: r.texto.slice(0, 420), de: String(r.de || '').slice(0, 120), dia: r.dia } : null;
  // (tanda 4) los días en que ha aprendido algo (los 200 últimos), el curso que sigue y sus exámenes (los 12 últimos)
  const dias = [...new Set(lista(objeto(g).dias).filter((d) => DIA.test(d || '')))].sort().slice(-200);
  const c = objeto(objeto(g).curso);
  const curso = typeof c.clave === 'string' && /^[a-z0-9-]{1,40}$/.test(c.clave) && DIA.test(c.desde || '') ? { clave: c.clave, desde: c.desde } : null;
  const examenes = lista(objeto(g).examenes).filter((x) => x && DIA.test(x.dia || '') && Number.isFinite(Number(x.aciertos)) && Number(x.total) > 0)
    .map((x) => ({ dia: x.dia, aciertos: Math.max(0, Math.min(Math.round(Number(x.total)), Math.round(Number(x.aciertos)))), total: Math.min(40, Math.round(Number(x.total))) })).slice(-12);
  return { vistos, ...(Object.keys(porSubir).length ? { porSubir } : {}), ...(guardados.length ? { guardados } : {}), ...(reto ? { reto } : {}),
    ...(dias.length ? { dias } : {}), ...(curso ? { curso } : {}), ...(examenes.length ? { examenes } : {}) };
}
// (tanda 2) Guardar un apunte para luego, o quitarlo
export function alternarGuardado(g, id) {
  const e = limpiarVistos(g), ya = e.guardados || [];
  return limpiarVistos({ ...e, guardados: ya.includes(id) ? ya.filter((x) => x !== id) : [...ya, id] });
}
// (tanda 2) «Lo pruebo en la siguiente serie»: se lleva la clave como reto; en el siguiente descanso se le pregunta
export function llevarReto(g, apunte, dia) {
  const e = limpiarVistos(g);
  return limpiarVistos({ ...e, reto: apunte ? { id: apunte.id, texto: apunte.texto, de: apunte.de || '', dia } : null });
}
// El reto que trae pendiente de hoy, como apunte con pregunta («¿Lo has hecho?»), o null
export function retoPendiente(g, hoy) {
  const r = limpiarVistos(g).reto;
  return r && r.dia === hoy ? { id: r.id, tipo: 'reto', efimero: true, de: r.de, etiqueta: '¿Lo has hecho?', titulo: '', texto: r.texto } : null;
}
// Queda por subir (o ya se subió)
export function pendienteDeSubir(g, id, sabia = null, subido = false) {
  const e = limpiarVistos(g), cola = { ...(e.porSubir || {}) };
  if (subido) delete cola[id]; else cola[id] = typeof sabia === 'boolean' ? sabia : cola[id] ?? null;
  return limpiarVistos({ ...e, porSubir: cola });
}
// Junta lo del móvil con lo que hay en la base (otro móvil, o este antes de borrar sus datos): de cada apunte, lo más
// reciente; con el mismo día, lo del móvil. filas: [{ apunte, veces, ultimo, sabia }]
export function conServidor(g, filas = []) {
  const e = limpiarVistos(g);
  for (const f of lista(filas)) {
    const id = String(f?.apunte || ''), t = String(f?.ultimo || '').slice(0, 10);
    if (!id || id.length > 80 || !DIA.test(t)) continue;
    const mio = e.vistos[id];
    if (mio && mio.t >= t) { if (typeof mio.s !== 'boolean' && typeof f.sabia === 'boolean') mio.s = f.sabia; mio.n = Math.max(mio.n, Number(f.veces) || 1); continue; }
    e.vistos[id] = { n: Math.max(mio?.n || 0, Number(f.veces) || 1), t, ...(typeof f.sabia === 'boolean' ? { s: f.sabia } : {}) };
  }
  // (tanda 4) y los días en que aprendió algo, según la base
  e.dias = [...(e.dias || []), ...lista(filas).map((f) => String(f?.ultimo || '').slice(0, 10)).filter((d) => DIA.test(d))];
  return limpiarVistos(e);
}
// Apunta que se ha visto (y, si se dio la vuelta, si lo sabía). Devuelve otro.
export function apuntarVisto(g, id, hoy, sabia = null) {
  const e = limpiarVistos(g);
  if (!id || !DIA.test(hoy)) return e;
  const antes = e.vistos[id];
  delete e.vistos[id];
  e.vistos[id] = { n: (antes && antes.t === hoy ? antes.n : (antes?.n || 0) + 1), t: hoy, ...(typeof sabia === 'boolean' ? { s: sabia } : antes && typeof antes.s === 'boolean' ? { s: antes.s } : {}) };
  e.dias = [...(e.dias || []), hoy];   // (tanda 4)
  return limpiarVistos(e);
}

const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// Cuál toca ahora. Por orden: (1) uno que no sabía y ya es otro día; (2) uno que no ha visto; (3) el que hace más que
// no ve (nunca uno de hoy, si hay otro). `primero`: los del ejercicio del que descansa, que van delante de los generales
// (uno sí, uno no, para que no todo sea técnica). `salto`: cuántos lleva pasados en esta tanda (para variar).
// (tanda 2) guias: las claves de las guías que vienen a cuento (sus ideas, antes); principiante: el glosario, antes
// (tanda 4) curso: la clave de la guía cuyo curso sigue (sus lecciones, antes y en orden); los apuntes sueltos del coach, delante
export function elegirApunte(apuntes = [], estado = null, { hoy, salto = 0, excluir = [], guias = [], principiante = false, curso = null } = {}) {
  const v = limpiarVistos(estado).vistos, fuera = new Set(excluir);
  const cand = apuntes.filter((a) => a && a.id && !fuera.has(a.id));
  if (!cand.length) return null;
  // (060) la novedad de la semana que aún no ha visto, lo primero
  const nueva = novedadPendiente(cand, estado, hoy);
  if (nueva) return nueva;
  // (tanda 2) lo suyo de este momento (lo que le corrigió su coach, sus números), lo primero y sin repetirse en la tanda
  const suyoAhora = cand.find((a) => a.efimero && (a.tipo === 'correccion' || a.tipo === 'numeros'));
  if (suyoAhora && salto < 2) return suyoAhora;
  const repasar = cand.filter((a) => !a.efimero && v[a.id]?.s === false && v[a.id].t !== hoy);
  if (repasar.length) return repasar.sort((a, b) => (v[a.id].t < v[b.id].t ? -1 : 1))[0];
  const nuevos = cand.filter((a) => !v[a.id] && !(a.efimero && (a.tipo === 'correccion' || a.tipo === 'numeros')));
  if (nuevos.length) {
    // (alterna los del ejercicio con los generales; dentro de cada grupo, en su orden)
    // (las novedades antiguas que no vio no salen solas: se quedan para el repaso de «Tus apuntes» si las abre)
    const DEL_EJERCICIO = ['clave', 'error', 'musculo', 'test', 'clip'];
    const suyos = [...nuevos.filter((a) => a.tipo === 'coach' && a.ejercicio), ...nuevos.filter((a) => DEL_EJERCICIO.includes(a.tipo))];
    let resto = nuevos.filter((a) => ['idea', 'mito', 'duda', 'glosario'].includes(a.tipo) || (a.tipo === 'coach' && !a.ejercicio));
    const delCoach = resto.filter((a) => a.tipo === 'coach');
    const delCurso = curso ? resto.filter((a) => (a.tipo === 'idea' || a.tipo === 'mito') && a.guia === curso) : [];
    if (delCoach.length && (salto % 2 === 1 || !suyos.length)) return delCoach[0];
    if (delCurso.length && (salto % 2 === 1 || !suyos.length)) return delCurso[0];
    // (lo que viene a cuento, delante; a quien empieza, el glosario antes que las ideas)
    const aCuento = resto.filter((a) => a.guia && guias.includes(a.guia));
    if (aCuento.length) resto = aCuento;
    else if (principiante && resto.some((a) => a.tipo === 'glosario')) resto = resto.filter((a) => a.tipo === 'glosario');
    else if (resto.some((a) => a.tipo === 'idea' || a.tipo === 'mito')) resto = resto.filter((a) => a.tipo !== 'glosario' || numeroDe(hoy) % 4 === 0);
    if (!suyos.length && !resto.length) return nuevos[0];
    if (suyos.length && (salto % 2 === 0 || !resto.length)) return suyos[0];
    return resto[(numeroDe(hoy) + salto) % resto.length] || suyos[0];
  }
  const conocidos = cand.filter((a) => v[a.id]);
  if (!conocidos.length) return cand[0];
  const viejos = conocidos.filter((a) => v[a.id].t !== hoy);
  const de = viejos.length ? viejos : conocidos;
  return de.sort((a, b) => (v[a.id].t < v[b.id].t ? -1 : v[a.id].t > v[b.id].t ? 1 : v[a.id].n - v[b.id].n))[0];
}
const numeroDe = (dia) => (DIA.test(dia || '') ? Math.floor(Date.parse(`${dia}T00:00:00Z`) / 86400000) : 0);

// El apunte del día (en Hoy): el mismo todo el día, distinto cada día, de entre los generales
export function apunteDelDia(apuntes = [], hoy, estado = null) {
  // (060) si hay una novedad de esta semana, es el apunte del día hasta que la vea (y ese día, también)
  const v = limpiarVistos(estado).vistos;
  const novedad = apuntes.find((a) => a.tipo === 'novedad' && DIA.test(a.dia || '') && diasEntre(a.dia, hoy) >= 0 && diasEntre(a.dia, hoy) < 7 && (!v[a.id] || v[a.id].t === hoy));
  if (novedad) return novedad;
  const generales = apuntes.filter((a) => a.tipo === 'idea' || a.tipo === 'mito');
  return generales.length ? generales[numeroDe(hoy) % generales.length] : null;
}

// Para la tarjeta: cuántos ha visto, cuántos esta semana (últimos 7 días) y cuántos tiene por repasar (no los sabía)
export function resumenApuntes(estado, hoy) {
  const v = Object.values(limpiarVistos(estado).vistos);
  return {
    vistos: v.length,
    semana: DIA.test(hoy || '') ? v.filter((x) => { const d = diasEntre(x.t, hoy); return d >= 0 && d < 7; }).length : 0,
    repasar: v.filter((x) => x.s === false).length,
  };
}
// Los que tiene por repasar (no los sabía) y, después, los vistos esta semana: para «Repasar» en Semana
export function paraRepasar(apuntes = [], estado, hoy) {
  const v = limpiarVistos(estado).vistos;
  const reciente = (a) => { const d = diasEntre(v[a.id].t, hoy); return d >= 0 && d < 7; };
  const vistos = apuntes.filter((a) => v[a.id]);
  return [...vistos.filter((a) => v[a.id].s === false), ...vistos.filter((a) => v[a.id].s !== false && reciente(a))];
}

export const textoApuntes = (n) => (n === 1 ? '1 apunte' : `${n || 0} apuntes`);


// ---------- (tanda 4) La racha de aprendizaje y la medalla ----------
// Semanas seguidas aprendiendo algo (al menos un apunte), hasta esta; si esta aún no tiene nada, hasta la pasada
export function rachaAprendizaje(estado, hoy) {
  if (!DIA.test(hoy || '')) return 0;
  const semanas = new Set((limpiarVistos(estado).dias || []).map((d) => lunesDe(d)));
  let l = lunesDe(hoy), n = 0;
  if (!semanas.has(l)) l = sumarDias(l, -7);
  while (semanas.has(l) && n < 200) { n += 1; l = sumarDias(l, -7); }
  return n;
}
export const MEDALLAS_APUNTES = [[10, 'Curioso'], [40, 'Aplicado'], [100, 'Estudioso'], [250, 'Sabio de la manada']];
// { vistos, nivel (0 a 4), nombre (o null), siguiente: { n, nombre } (o null), faltan }
export function medallaApuntes(estado) {
  const vistos = Object.keys(limpiarVistos(estado).vistos).length;
  const nivel = MEDALLAS_APUNTES.filter(([n]) => vistos >= n).length, sig = MEDALLAS_APUNTES[nivel] || null;
  return { vistos, nivel, nombre: nivel ? MEDALLAS_APUNTES[nivel - 1][1] : null, siguiente: sig ? { n: sig[0], nombre: sig[1] } : null, faltan: sig ? sig[0] - vistos : 0 };
}

// ---------- (tanda 4) Los cursos: una guía, lección a lección ----------
// De las ideas clave de cada guía (y, de la de mitos, sus mitos), si tiene dos o más: [{ clave, titulo, lecciones: [id] }]
// (hasta siete lecciones)
export function cursosDe(apuntes = []) {
  const porGuia = new Map();
  for (const a of apuntes) {
    if ((a?.tipo !== 'idea' && a?.tipo !== 'mito') || !a.guia) continue;
    if (!porGuia.has(a.guia)) porGuia.set(a.guia, { clave: a.guia, titulo: a.tipo === 'mito' ? 'Mitos del gimnasio' : a.de || a.guia, lecciones: [] });
    if (porGuia.get(a.guia).lecciones.length < 7) porGuia.get(a.guia).lecciones.push(a.id);
  }
  return [...porGuia.values()].filter((c) => c.lecciones.length >= 2);
}
// Cómo lleva un curso: { hechas, total, hecho, siguiente (id de la próxima lección, o null) }
export function progresoCurso(curso, estado) {
  const v = limpiarVistos(estado).vistos, ids = curso?.lecciones || [];
  const hechas = ids.filter((id) => v[id]).length;
  return { hechas, total: ids.length, hecho: ids.length > 0 && hechas >= ids.length, siguiente: ids.find((id) => !v[id]) || null };
}
// El curso de la semana: el que ha elegido (si sigue sin acabar) o, si no, el primero sin acabar empezando por el que
// toca esta semana (cada semana, uno distinto). Devuelve { ...curso, progreso, elegido } o null (sin cursos, o todos hechos)
export function cursoDeLaSemana(cursos = [], estado, hoy) {
  if (!cursos.length) return null;
  const e = limpiarVistos(estado);
  const mio = e.curso ? cursos.find((c) => c.clave === e.curso.clave) : null;
  if (mio && !progresoCurso(mio, e).hecho) return { ...mio, progreso: progresoCurso(mio, e), elegido: true };
  const desde = DIA.test(hoy || '') ? Math.floor(numeroDe(lunesDe(hoy)) / 7) % cursos.length : 0;
  for (let i = 0; i < cursos.length; i++) {
    const c = cursos[(desde + i) % cursos.length], pr = progresoCurso(c, e);
    if (!pr.hecho) return { ...c, progreso: pr, elegido: false };
  }
  return null;
}
export function elegirCurso(estado, clave, hoy) {
  const e = limpiarVistos(estado);
  return limpiarVistos({ ...e, curso: clave ? { clave, desde: hoy } : null });
}
// Las lecciones que le quedan de un curso, en orden (para leerlas seguidas)
export const leccionesPendientes = (curso, apuntes = [], estado) => {
  const v = limpiarVistos(estado).vistos;
  return (curso?.lecciones || []).filter((id) => !v[id]).map((id) => apuntes.find((a) => a.id === id)).filter(Boolean);
};

// ---------- (tanda 4) El examen ----------
// Preguntas de tres en raya con lo que ha visto: del glosario («¿Qué es…?», con tres definiciones), «¿Verdad o mito?»
// (las ideas clave son verdad; los mitos, mito) y las preguntas de la ficha que haya. Primero lo que no sabía, luego lo
// visto y, si falta, lo demás; el mismo día sale el mismo examen. Con menos de cuatro preguntas, null.
export const MIN_PARA_EXAMEN = 12;
export const puedeExaminarse = (estado) => Object.keys(limpiarVistos(estado).vistos).length >= MIN_PARA_EXAMEN;
export function examenDe(apuntes = [], estado = null, { hoy = '', n = 8 } = {}) {
  const v = limpiarVistos(estado).vistos;
  const peso = (a) => (v[a.id]?.s === false ? 0 : v[a.id] ? 1 : 2);
  const orden = (xs) => xs.map((a) => [peso(a), huella(`${hoy}:${a.id}`), a]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map((x) => x[2]);
  const glosario = apuntes.filter((a) => a.tipo === 'glosario');
  const deGlosario = orden(glosario).slice(0, Math.ceil(n / 2)).map((a) => {
    const otras = barajar(glosario.filter((x) => x.id !== a.id).map((x) => x.texto), `${hoy}:${a.id}`).slice(0, 2);
    if (otras.length < 2) return null;
    const opciones = barajar([a.texto, ...otras], `${hoy}:${a.id}:o`);
    return { id: `x:${a.id}`, origen: a.id, tipo: 'test', etiqueta: 'Examen', de: 'Glosario', titulo: `¿Qué es «${a.titulo}»?`, opciones, correcta: opciones.indexOf(a.texto), texto: '' };
  }).filter(Boolean);
  const deFicha = orden(apuntes.filter((a) => a.tipo === 'test' && Array.isArray(a.opciones))).slice(0, 2).map((a) => ({ ...a, id: `x:${a.id}`, origen: a.id, etiqueta: 'Examen' }));
  const afirmaciones = orden(apuntes.filter((a) => (a.tipo === 'idea' || a.tipo === 'mito') && a.titulo && a.titulo.length <= 140));
  const verdadOMito = afirmaciones.slice(0, n).map((a) => ({
    id: `x:${a.id}`, origen: a.id, tipo: 'test', etiqueta: 'Examen', de: a.de || '', titulo: `¿Verdad o mito? ${a.tipo === 'mito' ? a.titulo : `«${a.titulo.replace(/[.:]$/, '')}»`}`,
    opciones: ['Verdad', 'Mito'], correcta: a.tipo === 'mito' ? 1 : 0, texto: a.texto,
  }));
  const preguntas = [...deFicha, ...deGlosario];
  for (const q of verdadOMito) { if (preguntas.length >= n) break; preguntas.push(q); }
  if (preguntas.length < 4) return null;
  return barajar(preguntas.slice(0, n).map((q) => q.id), `${hoy}:x`).map((id) => preguntas.find((q) => q.id === id));
}
// Apunta un examen hecho: { dia, aciertos, total }
export function apuntarExamen(estado, { dia, aciertos, total }) {
  const e = limpiarVistos(estado);
  return limpiarVistos({ ...e, examenes: [...(e.examenes || []).filter((x) => x.dia !== dia), { dia, aciertos, total }] });
}
export const ultimoExamen = (estado) => { const x = limpiarVistos(estado).examenes || []; return x[x.length - 1] || null; };
// La nota, en palabras
export function notaExamen(aciertos, total) {
  const p = total > 0 ? aciertos / total : 0;
  return p >= 0.9 ? 'Sobresaliente' : p >= 0.7 ? 'Notable' : p >= 0.5 ? 'Aprobado' : 'Toca repasar';
}

// ---------- (tanda 4, coach) Lo que más se falla ----------
// filas: lo de apuntes_vistos con sabia = false ([{ apunte, atleta_id }]); apuntes: los que se saben nombrar (guías,
// glosario, dudas, novedades y las fichas que se tengan). Devuelve los `n` que más atletas no sabían:
// [{ id, etiqueta, de, titulo, texto, atletas }] (solo cuentas: ningún nombre)
// (revisión) las filas son ya cuentas, { apunte, atletas } (apuntes_fallados(), 061: nunca quién); de dos atletas en adelante
export function masFallados(filas = [], apuntes = [], n = 5) {
  const cuantos = new Map();
  for (const f of lista(filas)) {
    const id = String(f?.apunte || ''), k = Math.round(Number(f?.atletas));
    if (id && Number.isFinite(k) && k >= 2) cuantos.set(id, Math.max(cuantos.get(id) || 0, k));
  }
  const porId = new Map(apuntes.filter((a) => a?.id).map((a) => [a.id, a]));
  return [...cuantos.entries()].filter(([id]) => porId.has(id)).map(([id, k]) => { const a = porId.get(id); return { id, etiqueta: a.etiqueta, de: a.de || '', titulo: a.titulo || '', texto: a.texto || '', atletas: k }; })
    .sort((x, y) => y.atletas - x.atletas || x.id.localeCompare(y.id)).slice(0, n);
}
// El mensaje con el que el coach manda un apunte a un atleta
export function mensajeDeApunte(a) {
  const cuerpo = [a?.titulo, a?.texto].filter(Boolean).join(a?.titulo && !'.:?!\u00bb'.includes(a.titulo.slice(-1)) ? ': ' : ' ');
  return cuerpo ? `Un apunte para ti${a.de ? ` (${a.de})` : ''}: ${cuerpo}`.slice(0, 900) : '';
}
