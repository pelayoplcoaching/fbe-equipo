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
export function apuntesDeNovedades(novedades = []) {
  return lista(novedades).filter((n) => n?.id && n.publicada && n.publicada_en)
    .sort((a, b) => String(b.publicada_en).localeCompare(String(a.publicada_en)))
    .map((n) => {
      const enlace = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(String(n.enlace || '')) && !/\s/.test(n.enlace) ? n.enlace : null;
      return { id: `n:${n.id}`, tipo: 'novedad', etiqueta: 'Novedad de la semana', de: '', titulo: sinMarcas(n.titulo || '').trim(), texto: corta(sinMarcas(n.texto || ''), 520),
        fuente: String(n.fuente || '').trim() || null, enlace, dia: String(n.publicada_en).slice(0, 10) };
    }).filter((a) => a.titulo && a.texto);
}
// La novedad reciente (publicada en los últimos `dias`) que aún no ha visto, o null
export function novedadPendiente(apuntes = [], estado = null, hoy, dias = 14) {
  const v = limpiarVistos(estado).vistos;
  return apuntes.find((a) => a.tipo === 'novedad' && !v[a.id] && DIA.test(a.dia || '') && diasEntre(a.dia, hoy) >= 0 && diasEntre(a.dia, hoy) < dias) || null;
}

// ---------- Lo visto (en el móvil) ----------
// (v0.148) Lo que la base admite como apunte (como apuntar_apunte() en la 060): lo demás no se pone en cola
export const ID_APUNTE = /^[peimn]:[A-Za-z0-9:_-]{1,78}$/;
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
  return Object.keys(porSubir).length ? { vistos, porSubir } : { vistos };
}
// Queda por subir (o ya se subió)
export function pendienteDeSubir(g, id, sabia = null, subido = false) {
  const e = limpiarVistos(g), cola = { ...(e.porSubir || {}) };
  if (subido) delete cola[id]; else cola[id] = typeof sabia === 'boolean' ? sabia : cola[id] ?? null;
  return limpiarVistos({ vistos: e.vistos, porSubir: cola });
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
  return limpiarVistos(e);
}
// Apunta que se ha visto (y, si se dio la vuelta, si lo sabía). Devuelve otro.
export function apuntarVisto(g, id, hoy, sabia = null) {
  const e = limpiarVistos(g);
  if (!id || !DIA.test(hoy)) return e;
  const antes = e.vistos[id];
  delete e.vistos[id];
  e.vistos[id] = { n: (antes && antes.t === hoy ? antes.n : (antes?.n || 0) + 1), t: hoy, ...(typeof sabia === 'boolean' ? { s: sabia } : antes && typeof antes.s === 'boolean' ? { s: antes.s } : {}) };
  return limpiarVistos(e);
}

const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// Cuál toca ahora. Por orden: (1) uno que no sabía y ya es otro día; (2) uno que no ha visto; (3) el que hace más que
// no ve (nunca uno de hoy, si hay otro). `primero`: los del ejercicio del que descansa, que van delante de los generales
// (uno sí, uno no, para que no todo sea técnica). `salto`: cuántos lleva pasados en esta tanda (para variar).
export function elegirApunte(apuntes = [], estado = null, { hoy, salto = 0, excluir = [] } = {}) {
  const v = limpiarVistos(estado).vistos, fuera = new Set(excluir);
  const cand = apuntes.filter((a) => a && a.id && !fuera.has(a.id));
  if (!cand.length) return null;
  // (060) la novedad de la semana que aún no ha visto, lo primero
  const nueva = novedadPendiente(cand, estado, hoy);
  if (nueva) return nueva;
  const repasar = cand.filter((a) => v[a.id]?.s === false && v[a.id].t !== hoy);
  if (repasar.length) return repasar.sort((a, b) => (v[a.id].t < v[b.id].t ? -1 : 1))[0];
  const nuevos = cand.filter((a) => !v[a.id]);
  if (nuevos.length) {
    // (alterna los del ejercicio con los generales; dentro de cada grupo, en su orden)
    // (las novedades antiguas que no vio no salen solas: se quedan para el repaso de «Tus apuntes» si las abre)
    const suyos = nuevos.filter((a) => a.tipo === 'clave' || a.tipo === 'error'), resto = nuevos.filter((a) => a.tipo === 'idea' || a.tipo === 'mito');
    if (!suyos.length && !resto.length) return nuevos[0];
    if (suyos.length && (salto % 2 === 0 || !resto.length)) return suyos[0];
    return resto[(numeroDe(hoy) + salto) % resto.length] || suyos[0];
  }
  const viejos = cand.filter((a) => v[a.id].t !== hoy);
  const de = viejos.length ? viejos : cand;
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
