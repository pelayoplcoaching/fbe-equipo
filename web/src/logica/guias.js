// Las guías del coach y la ficha de técnica de cada ejercicio (migración 057, «Aprende»). Lógica pura: trocear el texto
// con su negrita, ordenar, buscar y preparar lo que se enseña. Sin red ni pantalla.

const normal = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const objeto = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const lista = (x) => (Array.isArray(x) ? x : []);
const texto = (x) => (typeof x === 'string' ? x.trim() : '');

// «Los **codos** a 45º» → [{ t: 'Los ' }, { t: 'codos', n: true }, { t: ' a 45º' }]. Nunca HTML: solo trozos de texto.
export function trozos(s) {
  const partes = String(s ?? '').split('**');
  // Con las marcas sin cerrar (número par de trozos), todo va tal cual, sin negrita y sin asteriscos
  if (partes.length % 2 === 0) return [{ t: partes.join('') }].filter((x) => x.t);
  return partes.map((t, i) => (i % 2 ? { t, n: true } : { t })).filter((x) => x.t);
}
export const sinMarcas = (s) => trozos(s).map((x) => x.t).join('');

// Los tonos de una caja (lo que no se conozca, «nota»)
export const TONOS = ['nota', 'clave', 'aviso', 'ojo'];
const TIPOS = ['p', 'h', 'ul', 'ol', 'caja'];
// Los bloques de una sección, limpios: solo tipos conocidos y con algo dentro
export function bloquesDe(bs, dentro = false) {
  const out = [];
  for (const b of lista(bs)) {
    const o = objeto(b);
    if (!TIPOS.includes(o.t)) continue;
    if (o.t === 'p' || o.t === 'h') { if (texto(o.x)) out.push({ t: o.t, x: texto(o.x) }); continue; }
    if (o.t === 'ul' || o.t === 'ol') { const xs = lista(o.xs).map(texto).filter(Boolean); if (xs.length) out.push({ t: o.t, xs }); continue; }
    if (dentro) continue;   // una caja dentro de otra no se pinta
    const dentroDe = bloquesDe(o.bloques, true);
    if (dentroDe.length || texto(o.titulo)) out.push({ t: 'caja', tono: TONOS.includes(o.tono) ? o.tono : 'nota', titulo: texto(o.titulo), bloques: dentroDe });
  }
  return out;
}

// Una guía lista para pintar: { entrada, cita, secciones: [{ titulo, subtitulo, bloques, fichas: [fichas de esa sección] }], ideas, sueltas }
// fichas: las de la guía ([{ id, orden, nombre, ficha }]). «sueltas»: las que ninguna sección nombra (van al final).
export function guiaParaLeer(guia, fichas = []) {
  const c = objeto(guia?.contenido);
  const porOrden = new Map(lista(fichas).map((f) => [Number(f.orden), f]));
  const usadas = new Set();
  const secciones = lista(c.secciones).map((s) => {
    const o = objeto(s);
    const suyas = lista(o.fichas).map((n) => porOrden.get(Number(n))).filter(Boolean);
    suyas.forEach((f) => usadas.add(f));
    return { titulo: texto(o.titulo), subtitulo: texto(o.subtitulo), bloques: bloquesDe(o.bloques), fichas: suyas };
  }).filter((s) => s.titulo || s.bloques.length || s.fichas.length);
  const sueltas = ordenarFichas(lista(fichas).filter((f) => !usadas.has(f)));
  const ideas = lista(c.ideas).map((i) => ({ titulo: texto(objeto(i).titulo), x: texto(objeto(i).x) })).filter((i) => i.titulo || i.x);
  return { entrada: texto(c.entrada), cita: texto(c.cita), secciones, ideas, sueltas };
}

export const ordenarGuias = (gs = []) => [...gs].sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || normal(a.titulo).localeCompare(normal(b.titulo)));
export const ordenarFichas = (fs = []) => [...fs].sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || normal(a.nombre).localeCompare(normal(b.nombre)));

// La ficha de un ejercicio, limpia: lo que falte, vacío
export function fichaParaLeer(f) {
  const o = objeto(f?.ficha ?? f);
  const niveles = objeto(o.niveles);
  return {
    cabecera: texto(o.cabecera), descripcion: texto(o.descripcion), patron: texto(o.patron), principales: texto(o.principales), secundarios: texto(o.secundarios),
    pasos: lista(o.pasos).map(texto).filter(Boolean), errores: lista(o.errores).map(texto).filter(Boolean),
    niveles: [['principiante', 'Principiante'], ['intermedio', 'Intermedio'], ['avanzado', 'Avanzado']].map(([k, n]) => ({ nivel: k, nombre: n, x: texto(niveles[k]) })).filter((n) => n.x),
    si: texto(o.si), no: texto(o.no),
    tabla: lista(o.tabla).map((r) => ({ objetivo: texto(objeto(r).objetivo), reps: texto(objeto(r).reps), rpe: texto(objeto(r).rpe), descanso: texto(objeto(r).descanso) })).filter((r) => r.objetivo),
  };
}
// ¿Tiene algo que enseñar?
export function fichaConContenido(f) {
  const x = fichaParaLeer(f);
  return !!(x.descripcion || x.pasos.length || x.errores.length || x.niveles.length || x.si || x.no || x.tabla.length);
}

// Buscar fichas por nombre (o por patrón o músculos), sin tildes; todas las palabras
export function buscarFichas(fichas = [], q = '') {
  const palabras = normal(q).split(' ').filter(Boolean);
  if (!palabras.length) return fichas;
  return fichas.filter((f) => {
    const o = objeto(f.ficha);
    const donde = normal([f.nombre, o.cabecera, o.patron, o.principales, f.guia_titulo].join(' '));
    return palabras.every((p) => donde.includes(p));
  });
}

// La guía de un grupo muscular de la app (la primera publicada que lo lleve)
export const guiaDeGrupo = (guias = [], grupo) => ordenarGuias(guias).find((g) => g.grupo && g.grupo === grupo) || null;

// «9 ejercicios», «1 ejercicio»
export const cuantosEjercicios = (n) => (n === 1 ? '1 ejercicio' : `${n || 0} ejercicios`);

// Para enlazar un ejercicio de la biblioteca con su ficha: las fichas que más se parecen a su nombre, primero
export function fichasParecidas(fichas = [], nombre = '') {
  const pal = (s) => new Set(normal(s).split(/[^a-z0-9]+/).filter((p) => p.length > 2 && !['con', 'del', 'las', 'los', 'una', 'para', 'por', 'desde'].includes(p)));
  const a = pal(nombre);
  return fichas.map((f) => { const b = pal(f.nombre); const comunes = [...a].filter((p) => b.has(p)).length; return { f, p: a.size && b.size ? comunes / new Set([...a, ...b]).size : 0 }; })
    .sort((x, y) => y.p - x.p || normal(x.f.nombre).localeCompare(normal(y.f.nombre))).map((x) => x.f);
}
