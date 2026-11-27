// (tacto 243, v0.273) Un solo buscador (en «Más»): tus sesiones, tus ejercicios, las recetas, las guías, las secciones y
// los ajustes, desde el mismo sitio. Aquí, lo que no depende de la pantalla (probado en test/tacto.test.mjs).

// Sin tildes ni mayúsculas, para comparar
export const llano = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Cuánto se parece un título a lo buscado: 3, empieza por ello; 2, una palabra empieza por ello; 1, lo contiene (todas
// las palabras buscadas tienen que estar, en el título o en el detalle); 0, no
export function puntosDe(titulo, detalle, q) {
  const t = llano(titulo), d = llano(detalle), palabras = llano(q).split(/\s+/).filter(Boolean);
  if (!palabras.length) return 0;
  if (!palabras.every((p) => t.includes(p) || d.includes(p))) return 0;
  const p0 = palabras[0];
  if (t.startsWith(llano(q))) return 3;
  if (t.split(/[\s(\u00ab\u00b7,/-]+/).some((w) => w.startsWith(p0))) return 2;
  return 1;
}

// Los ajustes que se pueden buscar: [texto, id del control en Ajustes (o null: su fila se busca por su texto), otras palabras]
export const AJUSTES_BUSCABLES = [
  ['Tema (claro, oscuro o con el sol)', null, 'modo oscuro noche apariencia color'],
  ['Tamaño de la letra', null, 'texto grande fuente'],
  ['Modo ligero', null, 'ahorro lento animaciones'],
  ['Sonido y vibración', null, 'volumen silencio pitido tacto'],
  ['Unidad de las cargas', null, 'kilos libras kg lb'],
  ['Negro puro (OLED)', 'aj-oled', 'oscuro pantalla'],
  ['Alto contraste', 'aj-contraste', 'accesibilidad'],
  ['Ayuda para daltonismo', 'aj-daltonismo', 'colores accesibilidad'],
  ['Modo gimnasio', 'aj-gimnasio', 'botones grandes'],
  ['Modo zurdo', 'aj-zurdo', 'mano izquierda'],
  ['Pantalla encendida durante la sesión', 'aj-pantalla', 'no se apague bloqueo'],
  ['Teclado de la app al apuntar las series', 'aj-teclado', 'regla numeros'],
  ['Ver los kilos en Hoy', 'aj-peso-cifra', 'peso corporal esconder'],
  ['Subir los vídeos solo con wifi', 'aj-solo-wifi', 'datos'],
  ['Difuminar la cara al enviar un vídeo', 'aj-difuminar', 'privacidad'],
];

// Lo encontrado, por grupos: [{ grupo, total, items: [{ tipo, id, titulo, detalle, icono }] }] (como mucho «tope» por grupo,
// lo que más se parece primero). fuentes: { secciones: [[id, texto, icono]], sesiones: [{ id, nombre, fecha }],
// ejercicios: [{ id, nombre, veces }], recetas: [{ id, nombre, detalle }], guias: [{ clave, titulo, subtitulo }] }
export function buscarTodo(q, fuentes = {}, { tope = 5, fecha = (f) => f } = {}) {
  if (llano(q).length < 2) return [];
  const grupos = [
    ['Secciones', (fuentes.secciones || []).map(([id, texto, icono]) => ({ tipo: 'seccion', id, titulo: texto, detalle: '', icono: icono || 'derecha' }))],
    ['Tus sesiones', (fuentes.sesiones || []).map((s) => ({ tipo: 'sesion', id: s.id, titulo: s.nombre, detalle: s.fecha ? fecha(s.fecha) : '', icono: 'semana' }))],
    ['Ejercicios', (fuentes.ejercicios || []).map((e) => ({ tipo: 'ejercicio', id: e.id, titulo: e.nombre, detalle: e.veces ? `${e.veces} ${e.veces === 1 ? 'serie apuntada' : 'series apuntadas'}` : '', icono: 'progreso', dato: e }))],
    ['Recetas', (fuentes.recetas || []).map((r) => ({ tipo: 'receta', id: r.id, titulo: r.nombre, detalle: r.detalle || '', icono: 'receta' }))],
    ['Guías', (fuentes.guias || []).map((g) => ({ tipo: 'guia', id: g.clave || g.id, titulo: g.titulo, detalle: g.subtitulo || '', icono: 'biblioteca' }))],
    ['Ajustes', AJUSTES_BUSCABLES.map(([texto, id, mas]) => ({ tipo: 'ajuste', id: id || texto, titulo: texto, detalle: '', icono: 'ajustes', ancla: id, mas }))],
  ];
  return grupos.map(([grupo, items]) => {
    const con = items.map((it, k) => ({ it, k, p: puntosDe(it.titulo, `${it.detalle} ${it.mas || ''}`, q) })).filter((x) => x.p > 0).sort((a, c) => c.p - a.p || a.k - c.k);
    return { grupo, total: con.length, items: con.slice(0, tope).map((x) => x.it) };
  }).filter((g) => g.total > 0);
}

// Los ejercicios que ha hecho (de su historial de series), del más usado al menos: [{ id, nombre, veces, grupos_musculares }]
export function ejerciciosDeHistorial(series = []) {
  const m = new Map();
  for (const s of series || []) {
    if (!s.ejercicio_id || !s.ejercicio) continue;
    const e = m.get(s.ejercicio_id) || { id: s.ejercicio_id, nombre: s.ejercicio, veces: 0, grupos_musculares: s.grupos || [] };
    e.veces += 1;
    m.set(s.ejercicio_id, e);
  }
  return [...m.values()].sort((a, c) => c.veces - a.veces);
}
