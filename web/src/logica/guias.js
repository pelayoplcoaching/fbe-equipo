// Las guías del coach y la ficha de técnica de cada ejercicio (migración 056, «Aprende»). Lógica pura: trocear el texto
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
const TIPOS = ['p', 'h', 'ul', 'ol', 'caja', 'tabla'];
// Los bloques de una sección, limpios: solo tipos conocidos y con algo dentro
export function bloquesDe(bs, dentro = false) {
  const out = [];
  for (const b of lista(bs)) {
    const o = objeto(b);
    if (!TIPOS.includes(o.t)) continue;
    if (o.t === 'p' || o.t === 'h') { if (texto(o.x)) out.push({ t: o.t, x: texto(o.x) }); continue; }
    if (o.t === 'ul' || o.t === 'ol') { const xs = lista(o.xs).map(texto).filter(Boolean); if (xs.length) out.push({ t: o.t, xs }); continue; }
    if (o.t === 'tabla') {   // { cab: [..], filas: [[..]] }: todas las filas con las columnas de la cabecera
      const cab = lista(o.cab).map(texto);
      const filas = lista(o.filas).map((f) => cab.map((_, i) => texto(lista(f)[i]))).filter((f) => f.some(Boolean));
      if (cab.length >= 2 && cab.length <= 8 && filas.length) out.push({ t: 'tabla', cab, filas });
      continue;
    }
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
    return { clave: texto(o.clave), titulo: texto(o.titulo), subtitulo: texto(o.subtitulo), bloques: bloquesDe(o.bloques), fichas: suyas };
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

// ------------------------------------------------------------ los errores típicos, para repasarse y para corregir
// De cada error típico de la ficha, su título (lo que va en negrita al principio) y el resto: [{ titulo, x }]
export function erroresDeFicha(f) {
  return fichaParaLeer(f).errores.map((e) => {
    const m = e.match(/^\*\*(.+?)\*\*([:.,;]?)\s*(.*)$/);
    if (!m) { const t = e.split(/[:.]/)[0]; return { titulo: sinMarcas(t).trim(), x: sinMarcas(e.slice(t.length + 1)).trim(), seguido: false }; }
    // «**Chocar las mancuernas** arriba: …»: sin signo tras la negrita, el resto sigue la frase
    return { titulo: sinMarcas(m[1]).trim(), x: sinMarcas(m[3]).trim(), seguido: !m[2] && !!m[3] };
  }).filter((e) => e.titulo);
}
// Como frases de corrección de un toque (hasta 140 letras, como las del coach), sin las que ya tenga
export function frasesDeFicha(f, yaTiene = []) {
  const ya = new Set(yaTiene.map((t) => normal(t)));
  return erroresDeFicha(f).map((e) => [...e.titulo].slice(0, 140).join('')).filter((t) => t && !ya.has(normal(t)));
}

// ------------------------------------------------------------ al programar
// La tabla de la ficha en una línea: «Fuerza 3-6 · Hipertrofia 6-12 · Resistencia muscular 12-20»
export const resumenTabla = (f) => fichaParaLeer(f).tabla.filter((r) => r.reps).map((r) => `${r.objetivo} ${r.reps}`).join(' · ');
// Las zonas de molestia del check-in y las palabras que las nombran en «no lo prescribo cuando»
const PALABRAS_ZONA = {
  hombros: ['hombro', 'manguito', 'subacromial', 'labrum'], pectoral: ['pectoral'], triceps: ['triceps', 'codo'], espalda_alta: ['cervical', 'dorsal', 'espalda alta', 'trapecio'],
  zona_lumbar: ['lumbar', 'hernia', 'discal', 'espalda baja'], femoral_gluteo: ['isquio', 'femoral', 'gluteo'], cuadriceps: ['cuadriceps', 'rodilla', 'rotuli', 'patelar'], aductor: ['aductor', 'ingle', 'pubalgia'],
};
export const NOMBRE_ZONA = { hombros: 'hombros', pectoral: 'pectoral', triceps: 'tríceps', espalda_alta: 'espalda alta', zona_lumbar: 'zona lumbar', femoral_gluteo: 'femoral y glúteo', cuadriceps: 'cuádriceps', aductor: 'aductor' };
// Las molestias recientes del atleta (intensidad 1 o más) que la ficha nombra en su «no lo prescribo cuando»: [{ zona, intensidad }]
export function avisosMolestia(f, molestias = []) {
  const no = normal(fichaParaLeer(f).no);
  if (!no) return [];
  const peor = new Map();
  for (const m of lista(molestias)) if (Number(m.intensidad) >= 1 && PALABRAS_ZONA[m.zona]) peor.set(m.zona, Math.max(peor.get(m.zona) || 0, Number(m.intensidad)));
  return [...peor].filter(([z]) => PALABRAS_ZONA[z].some((p) => no.includes(p))).map(([zona, intensidad]) => ({ zona, intensidad }));
}

// ------------------------------------------------------------ por qué entrenas así
// La distribución de la semana, por los nombres de sus sesiones y cuántas son: { clave, nombre } (clave = la de su
// sección en la guía de rutinas) o null si no se reconoce. Es una suposición: el coach no la apunta en ningún sitio.
export function tipoDeRutina(sesiones = []) {
  const ss = lista(sesiones).filter((s) => s && s.tipo !== 'cardio');
  const n = ss.length;
  if (n < 2 || n > 6) return null;
  const nombres = ss.map((s) => normal(s.nombre));
  const cuantas = (re) => nombres.filter((x) => re.test(x)).length;
  const full = cuantas(/full ?body|cuerpo (entero|completo)|\bfb\b/), torso = cuantas(/upper|torso|tren superior/), pierna = cuantas(/lower|pierna|tren inferior|\blegs?\b/);
  const push = cuantas(/push|empuje/), pull = cuantas(/pull|traccion|tiron/);
  const cardio = lista(sesiones).length - n;
  if (cardio >= 1 && n <= 4 && (full >= 2 || (torso >= 1 && pierna >= 1))) return { clave: 'con-cardio', nombre: 'Fuerza con cardio integrado' };
  if (full === n && n === 2) return { clave: 'full-body-2', nombre: 'Full Body en 2 días' };
  if (full === n && n === 3) return { clave: 'full-body-3', nombre: 'Full Body en 3 días' };
  if (n === 4 && torso === 2 && pierna === 2) return { clave: 'upper-lower-4', nombre: 'Upper / Lower en 4 días' };
  if (n === 5 && push >= 1 && pull >= 1 && torso >= 1 && pierna >= 1) return { clave: 'hibrida-5', nombre: 'Híbrida en 5 días (PPL + Upper / Lower)' };
  if (n === 6 && push === 2 && pull === 2 && pierna >= 2) return { clave: 'ppl-6', nombre: 'Push Pull Legs en 6 días' };
  return null;
}
