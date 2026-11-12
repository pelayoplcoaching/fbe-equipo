// (v0.140) Hoy a tu gusto: qué secciones de Hoy se ven y en qué orden, y qué diales salen arriba. Se guarda en cada
// móvil ({ orden, ocultas, dialesOcultos }); aquí solo la lógica, sin tocar nada del navegador.
//  - Las de debajo (SECCIONES_HOY) se ordenan y se ocultan; las de arriba (ARRIBA_HOY), solo se ocultan.
//  - La tarjeta del día, los avisos del coach, «Tu día» y los informes no están aquí: no se pueden quitar.
//  - Lo oculto no desaparece: va a «Lo que has ocultado», plegado al final (y «Tu día» lo sigue abriendo).

export const SECCIONES_HOY = [
  { id: 'sesion', nombre: 'Lo que vas a hacer' },
  { id: 'semana', nombre: 'Esta semana' },
  { id: 'carrera', nombre: 'Tu carrera' },
  { id: 'menu', nombre: 'Tu menú de hoy' },
  { id: 'nutricion', nombre: 'Nutrición de hoy' },
  { id: 'habitos', nombre: 'Tus hábitos' },
  { id: 'peso', nombre: 'Tu peso' },
];
export const ARRIBA_HOY = [
  { id: 'mes', nombre: 'Tu mes' },
  { id: 'mito', nombre: 'El mito de la semana' },
];
export const DIALES_HOY = [
  { id: 'constancia', nombre: 'Constancia' },
  { id: 'carga', nombre: 'Carga' },
  { id: 'llegas', nombre: 'Cómo llegas' },
  { id: 'comida', nombre: 'Comida' },
  { id: 'pasos', nombre: 'Pasos' },
  { id: 'sueno', nombre: 'Sueño' },
];
const IDS = SECCIONES_HOY.map((s) => s.id);
const OCULTABLES = new Set([...IDS, ...ARRIBA_HOY.map((s) => s.id)]);
const IDS_DIALES = new Set(DIALES_HOY.map((d) => d.id));

// Lo guardado, limpio: ids que existen, sin repetir; las que falten (nuevas en una versión) en su sitio de siempre
export function leerPanel(pref) {
  const p = pref && typeof pref === 'object' ? pref : {};
  const guardado = (Array.isArray(p.orden) ? p.orden : []).filter((id, i, a) => IDS.includes(id) && a.indexOf(id) === i);
  const orden = [...guardado];
  IDS.forEach((id, i) => {
    if (orden.includes(id)) return;
    // detrás de la que tenía delante por defecto (si está), si no, al principio
    const antes = IDS.slice(0, i).reverse().find((x) => orden.includes(x));
    orden.splice(antes ? orden.indexOf(antes) + 1 : 0, 0, id);
  });
  const ocultas = new Set((Array.isArray(p.ocultas) ? p.ocultas : []).filter((id) => OCULTABLES.has(id)));
  const dialesOcultos = new Set((Array.isArray(p.dialesOcultos) ? p.dialesOcultos : []).filter((id) => IDS_DIALES.has(id)));
  return { orden, ocultas, dialesOcultos };
}
const aGuardar = ({ orden, ocultas, dialesOcultos }) => ({ orden: [...orden], ocultas: [...ocultas], dialesOcultos: [...dialesOcultos] });

// En qué orden van las de debajo: { visibles, ocultas } con solo las que hoy tienen algo que enseñar (disponibles)
export function seccionesHoy(pref, disponibles = IDS) {
  const { orden, ocultas } = leerPanel(pref);
  const hay = orden.filter((id) => disponibles.includes(id));
  return { visibles: hay.filter((id) => !ocultas.has(id)), ocultas: hay.filter((id) => ocultas.has(id)) };
}

// Subir (-1) o bajar (+1) una sección entre las disponibles: se cambia por la vecina que se ve en la lista
export function moverSeccion(pref, id, delta, disponibles = IDS) {
  const p = leerPanel(pref);
  const lista = p.orden.filter((x) => disponibles.includes(x));
  const i = lista.indexOf(id), j = i + Math.sign(delta);
  if (i < 0 || j < 0 || j >= lista.length) return aGuardar(p);
  const a = p.orden.indexOf(lista[i]), b = p.orden.indexOf(lista[j]);
  [p.orden[a], p.orden[b]] = [p.orden[b], p.orden[a]];
  return aGuardar(p);
}

export function alternarSeccion(pref, id) {
  const p = leerPanel(pref);
  if (!OCULTABLES.has(id)) return aGuardar(p);
  if (p.ocultas.has(id)) p.ocultas.delete(id); else p.ocultas.add(id);
  return aGuardar(p);
}

export function alternarDial(pref, id) {
  const p = leerPanel(pref);
  if (!IDS_DIALES.has(id)) return aGuardar(p);
  if (p.dialesOcultos.has(id)) p.dialesOcultos.delete(id); else p.dialesOcultos.add(id);
  return aGuardar(p);
}

// ¿Está como viene? (para enseñar «Dejarlo como estaba» solo si hay algo que deshacer)
export function panelPorDefecto(pref) {
  const p = leerPanel(pref);
  return p.orden.every((id, i) => id === IDS[i]) && !p.ocultas.size && !p.dialesOcultos.size;
}

export const nombreSeccion = (id) => [...SECCIONES_HOY, ...ARRIBA_HOY].find((s) => s.id === id)?.nombre || id;
