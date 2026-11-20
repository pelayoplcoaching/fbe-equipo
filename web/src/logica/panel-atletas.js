// (v0.198) La lista de Atletas a tu gusto: columnas, orden, filtros, grupos, vistas guardadas, etiquetas, fijados y
// una nota por atleta. Solo cálculos (sin pantalla): los usa ui/coach/Panel.jsx y los prueba test/panel-atletas.test.mjs.
// Lo del coach se guarda en la base con la migración 085 (atletas_panel y panel_ajustes); sin ella, en el aparato.
import { normal } from './busqueda.js';
import { NOMBRE_FOCO } from './calculos.js';
import { NIVELES, NOMBRE_NIVEL, SERVICIOS } from './nivel.js';

// ---------------------------------------------------------------- columnas
// La de «Atleta» va siempre la primera y no se quita. `defecto`: las que se ven hasta que eliges (las de siempre).
export const COLUMNAS = [
  { id: 'avisos', titulo: 'Avisos', defecto: true },
  { id: 'pagos', titulo: 'Pagos', defecto: true },
  { id: 'semana', titulo: 'Semana', defecto: true },
  { id: 'sesiones', titulo: 'Sesiones', defecto: true },
  { id: 'peso', titulo: 'Peso', defecto: true },
  { id: 'sueno', titulo: 'Sueño', defecto: true },
  { id: 'motivacion', titulo: 'Motivación', defecto: true },
  { id: 'molestias', titulo: 'Molestias', defecto: true },
  { id: 'ultimo', titulo: 'Último registro', defecto: true },
  { id: 'cumplido', titulo: '% cumplido (4 sem.)' },
  { id: 'sinEntrenar', titulo: 'Días sin entrenar' },
  { id: 'checkin', titulo: 'Check-in' },
  { id: 'energia', titulo: 'Energía' },
  { id: 'habitos', titulo: 'Hábitos' },
  { id: 'nutricion', titulo: 'Nutrición' },
  { id: 'fase', titulo: 'Fase del bloque' },
  { id: 'proxima', titulo: 'Semana que viene' },
  { id: 'mensajes', titulo: 'Mensajes' },
  { id: 'nivel', titulo: 'Nivel' },
  { id: 'servicio', titulo: 'Servicio' },
  { id: 'alta', titulo: 'Con FBE desde' },
  { id: 'nota', titulo: 'Tu nota' },
];
export const TITULO_COLUMNA = Object.fromEntries(COLUMNAS.map((c) => [c.id, c.titulo]));
const IDS_COLUMNA = new Set(COLUMNAS.map((c) => c.id));
export const COLUMNAS_DEFECTO = COLUMNAS.filter((c) => c.defecto).map((c) => c.id);
export const limpiarColumnas = (xs) => {
  const out = [...new Set((Array.isArray(xs) ? xs : []).filter((x) => IDS_COLUMNA.has(x)))];
  return out.length ? out : [...COLUMNAS_DEFECTO];
};
// Mover una columna un puesto (dir -1 arriba, +1 abajo)
export function moverColumna(cols, id, dir) {
  const xs = [...cols];
  const i = xs.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= xs.length) return xs;
  [xs[i], xs[j]] = [xs[j], xs[i]];
  return xs;
}

// ---------------------------------------------------------------- lo que no viene en el resumen del panel
// `extra`: { sinLeer: { id: n }, proxima: { id: 'publicada'|'borrador'|'sin'|null }, panel: { id: { fijado, etiquetas, nota } } }
export const lunesDeISO = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const restarDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
export const diasDesde = (fecha, hoy) => (fecha ? Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${String(fecha).slice(0, 10)}T12:00:00Z`)) / 864e5) : null);
const entrena = (r) => r.servicio !== 'nutricion';
export const activo = (r) => r.estado === 'activo';
// Check-in de la semana pasada o de esta (como el aviso «Sin check-in la semana pasada»)
export const checkinAlDia = (r, hoy) => !!r.checkin?.semana && r.checkin.semana >= restarDias(lunesDeISO(hoy), 7);
// La semana que viene: 'publicada' | 'borrador' | 'sin' | 'sin_bloque' | null (no aplica: de baja, en pausa, solo nutrición)
export function proximaDe(r, extra = {}) {
  if (!activo(r) || !entrena(r)) return null;
  if (!r.bloque) return 'sin_bloque';
  return extra.proxima?.[r.atleta_id] ?? null;
}
export const TEXTO_PROXIMA_CORTO = { publicada: 'Publicada', borrador: 'En borrador', sin: 'Sin programar', sin_bloque: 'Sin bloque' };
export const porProgramar = (r, extra) => ['borrador', 'sin', 'sin_bloque'].includes(proximaDe(r, extra));
export const conMolestias = (r) => (r.maxMolestia || 0) >= 2;
const PAGO_PENDIENTE = new Set(['pendiente', 'primer_cobro', 'vencido', 'retrasado']);
export const pagoPendiente = (r) => PAGO_PENDIENTE.has(r.cobro?.estado);
export const sinLeerDe = (r, extra = {}) => extra.sinLeer?.[r.atleta_id] || 0;
export const panelDe = (r, extra = {}) => extra.panel?.[r.atleta_id] || null;
export const etiquetasDe = (r, extra) => panelDe(r, extra)?.etiquetas || [];
export const fijado = (r, extra) => !!panelDe(r, extra)?.fijado;
export const diasSinEntrenar = (r, hoy) => {
  const u = [r.ultimaSerie, r.ultimaSesion].filter(Boolean).sort().at(-1);
  return u ? diasDesde(u, hoy) : null;
};

// ---------------------------------------------------------------- filtros
// El de siempre (estado): todos (menos de baja), atencion, invitados, baja, inactivos (ids de `inactivos`).
// Los que se suman (todos a la vez): servicio, nivel, etiqueta (una de ellas) y las marcas de abajo.
export const MARCAS = [
  ['sinCheckin', 'Sin check-in'],
  ['porProgramar', 'Por programar'],
  ['molestias', 'Con molestias'],
  ['sinLeer', 'Chat sin leer'],
  ['pago', 'Pagos pendientes'],
  ['pausa', 'En pausa'],
  ['carrera', 'Con carrera'],
  ['fijados', 'Fijados'],
];
export const NOMBRE_MARCA = Object.fromEntries(MARCAS);
// Los contadores de arriba (los que más ahorran): los cinco primeros
export const CONTADORES = MARCAS.slice(0, 5).map(([k]) => k);
export function cumpleMarca(k, r, extra, hoy) {
  if (k === 'sinCheckin') return activo(r) && !checkinAlDia(r, hoy);
  if (k === 'porProgramar') return porProgramar(r, extra);
  if (k === 'molestias') return conMolestias(r);
  if (k === 'sinLeer') return sinLeerDe(r, extra) > 0;
  if (k === 'pago') return pagoPendiente(r);
  if (k === 'pausa') return r.estado === 'pausado';
  if (k === 'carrera') return !!r.carrera;
  if (k === 'fijados') return fijado(r, extra);
  return true;
}
export const FILTROS_VACIOS = { servicio: null, nivel: null, etiqueta: null, marcas: [] };
export function limpiarFiltros(f) {
  const x = f && typeof f === 'object' ? f : {};
  return {
    servicio: SERVICIOS.some(([k]) => k === x.servicio) ? x.servicio : null,
    nivel: NIVELES.some(([k]) => k === x.nivel) || x.nivel === 'sin' ? x.nivel : null,
    etiqueta: typeof x.etiqueta === 'string' && x.etiqueta.trim() ? x.etiqueta.trim().slice(0, 24) : null,
    marcas: [...new Set((Array.isArray(x.marcas) ? x.marcas : []).filter((k) => NOMBRE_MARCA[k]))],
  };
}
export const hayFiltros = (f) => !!(f.servicio || f.nivel || f.etiqueta || f.marcas?.length);
export const textoFiltros = (f) => [
  f.servicio && Object.fromEntries(SERVICIOS)[f.servicio],
  f.nivel && (f.nivel === 'sin' ? 'Sin nivel' : NOMBRE_NIVEL[f.nivel]),
  f.etiqueta && `«${f.etiqueta}»`,
  ...(f.marcas || []).map((k) => NOMBRE_MARCA[k]),
].filter(Boolean).join(', ');
export function cumpleFiltros(r, f, extra, hoy) {
  if (f.servicio && r.servicio !== f.servicio) return false;
  if (f.nivel && (f.nivel === 'sin' ? !!r.nivel : r.nivel !== f.nivel)) return false;
  if (f.etiqueta && !etiquetasDe(r, extra).some((e) => e.toLowerCase() === f.etiqueta.toLowerCase())) return false;
  return (f.marcas || []).every((k) => cumpleMarca(k, r, extra, hoy));
}
export function cumpleEstado(r, estado, inactivos = []) {
  if (estado === 'atencion') return r.alertas.some((a) => a.nivel !== 'info');
  if (estado === 'invitados') return r.estado === 'invitado';
  if (estado === 'baja') return r.estado === 'baja';
  if (estado === 'inactivos') return inactivos.includes(r.atleta_id);
  return r.estado !== 'baja';
}
// Buscar: todas las palabras, en el nombre, sus etiquetas o tu nota (sin tildes ni mayúsculas)
export function coincide(r, q, extra) {
  const ps = normal(q).split(/\s+/).filter(Boolean);
  if (!ps.length) return true;
  const p = panelDe(r, extra);
  const texto = normal([r.nombre, ...(p?.etiquetas || []), p?.nota || ''].join(' '));
  return ps.every((x) => texto.includes(x));
}
// Cuántos cumplen cada contador (sobre la lista de antes de las marcas)
export const contar = (lista, extra, hoy) => Object.fromEntries(CONTADORES.map((k) => [k, lista.filter((r) => cumpleMarca(k, r, extra, hoy)).length]));

// ---------------------------------------------------------------- orden
// col: 'urgencia' (el de siempre: lo más urgente arriba y, a igualdad, por nombre), 'nombre' o una columna.
const GRAVEDAD_COBRO = { retrasado: 5, vencido: 4, pendiente: 3, primer_cobro: 2, vence_pronto: 1, al_dia: 0 };
const ORDEN_PROXIMA = { sin_bloque: 0, sin: 1, borrador: 2, publicada: 3 };
const ORDEN_NIVEL = Object.fromEntries(NIVELES.map(([k], i) => [k, i]));
const primeraCifra = (s) => { const m = String(s || '').match(/\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : null; };
export function valorOrden(col, r, extra = {}, hoy) {
  switch (col) {
    case 'nombre': return normal(r.nombre);
    case 'urgencia': return r.prioridad ?? 3;
    case 'avisos': return r.alertas.filter((a) => a.nivel !== 'info').length * 10 + r.alertas.length + (extra.pendientes?.[r.atleta_id] || 0);
    case 'pagos': return r.cobro ? GRAVEDAD_COBRO[r.cobro.estado] ?? null : null;
    case 'semana': return r.semana ? r.semana.numero : null;
    case 'sesiones': return r.sesiones?.total ? r.sesiones.completadas / r.sesiones.total : null;
    case 'cumplido': return r.cumplimiento?.series?.pct ?? null;
    case 'peso': return r.peso ? r.peso.kg : null;
    case 'sueno': return primeraCifra(r.checkin?.horas_sueno);
    case 'motivacion': return r.checkin?.motivacion ?? null;
    case 'energia': return r.checkin?.energia ?? null;
    case 'molestias': return r.maxMolestia || 0;
    case 'ultimo': return r.ultimaSerie || null;
    case 'sinEntrenar': return diasSinEntrenar(r, hoy);
    case 'checkin': return r.checkin?.semana || null;
    case 'habitos': return r.habitos?.pct ?? null;
    case 'nutricion': return r.diasNutricion ?? null;
    case 'fase': { const f = r.semana?.foco || r.bloque?.foco; return f ? normal(NOMBRE_FOCO[f] || f) : null; }
    case 'proxima': { const p = proximaDe(r, extra); return p ? ORDEN_PROXIMA[p] : null; }
    case 'mensajes': return sinLeerDe(r, extra);
    case 'nivel': return r.nivel ? ORDEN_NIVEL[r.nivel] : null;
    case 'servicio': return r.servicio || null;
    case 'alta': return r.fecha_alta || null;
    case 'nota': { const n = panelDe(r, extra)?.nota; return n ? normal(n) : null; }
    default: return null;
  }
}
// El sentido con el que empieza cada columna al tocarla (lo más útil arriba)
const EMPIEZA_DESC = new Set(['avisos', 'pagos', 'molestias', 'ultimo', 'sinEntrenar', 'mensajes', 'checkin', 'semana']);
export const dirInicial = (col) => (EMPIEZA_DESC.has(col) ? 'desc' : 'asc');
export const ORDENES = [['urgencia', 'Lo urgente primero'], ['nombre', 'Nombre'], ...COLUMNAS.filter((c) => !['nota'].includes(c.id)).map((c) => [c.id, c.titulo])];
export function limpiarOrden(o) {
  const col = ORDENES.some(([k]) => k === o?.col) ? o.col : 'urgencia';
  return { col, dir: o?.dir === 'desc' || o?.dir === 'asc' ? o.dir : dirInicial(col) };
}
// Ordena (una copia): los fijados siempre arriba; lo que no tiene dato, al final; a igualdad, lo urgente y el nombre
export function ordenar(lista, orden, extra = {}, hoy) {
  const o = limpiarOrden(orden);
  const signo = o.dir === 'desc' ? -1 : 1;
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [...lista].sort((x, y) => {
    const fx = fijado(x, extra) ? 0 : 1, fy = fijado(y, extra) ? 0 : 1;
    if (fx !== fy) return fx - fy;
    if (o.col !== 'urgencia') {
      const a = valorOrden(o.col, x, extra, hoy), b = valorOrden(o.col, y, extra, hoy);
      if (a == null && b != null) return 1;
      if (b == null && a != null) return -1;
      if (a != null && b != null) { const c = cmp(a, b) * signo; if (c) return c; }
    } else {
      const c = ((x.prioridad ?? 3) - (y.prioridad ?? 3)) * signo;
      if (c) return c;
    }
    return (x.prioridad ?? 3) - (y.prioridad ?? 3) || String(x.nombre).localeCompare(String(y.nombre), 'es');
  });
}

// ---------------------------------------------------------------- grupos
export const AGRUPAR = [['', 'Sin agrupar'], ['estado', 'Estado'], ['servicio', 'Servicio'], ['nivel', 'Nivel'], ['fase', 'Fase del bloque'], ['etiqueta', 'Etiqueta']];
const NOMBRE_ESTADO_GRUPO = { activo: 'Activos', pausado: 'En pausa', invitado: 'Sin activar', baja: 'De baja' };
const ORDEN_ESTADO = ['activo', 'pausado', 'invitado', 'baja'];
export const limpiarAgrupar = (x) => (AGRUPAR.some(([k]) => k === x) ? x : '');
// [{ clave, titulo, items }] en un orden fijo; con etiquetas, quien tiene varias sale en cada una
export function agrupar(lista, por, extra = {}) {
  if (!por) return [{ clave: '', titulo: '', items: lista }];
  const grupos = new Map();
  const meter = (clave, titulo, orden, r) => {
    if (!grupos.has(clave)) grupos.set(clave, { clave, titulo, orden, items: [] });
    const g = grupos.get(clave);
    if (titulo !== g.titulo && titulo[0] !== titulo[0].toLowerCase() && g.titulo[0] === g.titulo[0].toLowerCase()) g.titulo = titulo;   // (la que va con mayúscula)
    g.items.push(r);
  };
  for (const r of lista) {
    if (por === 'estado') meter(r.estado, NOMBRE_ESTADO_GRUPO[r.estado] || r.estado, ORDEN_ESTADO.indexOf(r.estado), r);
    else if (por === 'servicio') meter(r.servicio, Object.fromEntries(SERVICIOS)[r.servicio] || r.servicio, SERVICIOS.findIndex(([k]) => k === r.servicio), r);
    else if (por === 'nivel') meter(r.nivel || 'sin', r.nivel ? NOMBRE_NIVEL[r.nivel] : 'Sin nivel', r.nivel ? ORDEN_NIVEL[r.nivel] : 99, r);
    else if (por === 'fase') { const f = r.semana?.foco || r.bloque?.foco; meter(f || 'sin', f ? NOMBRE_FOCO[f] || f : 'Sin fase', f ? 0 : 99, r); }
    else if (por === 'etiqueta') {
      const es = etiquetasDe(r, extra);
      if (!es.length) meter('', 'Sin etiqueta', 99, r);
      for (const e of es) meter(e.toLowerCase(), e, 0, r);
    }
  }
  return [...grupos.values()].sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es'));
}

// ---------------------------------------------------------------- etiquetas y nota de cada atleta
export const MAX_ETIQUETAS = 8, MAX_ETIQUETA = 24, MAX_NOTA = 200;
const sinControl = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ');
export function limpiarEtiqueta(s) {
  return [...sinControl(s).replace(/\s+/g, ' ').trim()].slice(0, MAX_ETIQUETA).join('').trim();
}
export function limpiarEtiquetas(xs) {
  const out = [];
  for (const x of Array.isArray(xs) ? xs : []) {
    const e = limpiarEtiqueta(x);
    if (e && !out.some((o) => o.toLowerCase() === e.toLowerCase())) out.push(e);
    if (out.length >= MAX_ETIQUETAS) break;
  }
  return out;
}
export const limpiarNota = (s) => [...sinControl(s).replace(/\s+/g, ' ').trim()].slice(0, MAX_NOTA).join('').trim() || null;
// Lo de un atleta, listo para guardar; null si no queda nada (se borra su fila)
export function limpiarPanelAtleta(x) {
  const fila = { fijado: !!x?.fijado, etiquetas: limpiarEtiquetas(x?.etiquetas), nota: limpiarNota(x?.nota) };
  return fila.fijado || fila.etiquetas.length || fila.nota ? fila : null;
}
// Todas las etiquetas que usas, de más a menos usada (y por nombre)
export function etiquetasUsadas(panel = {}) {
  const n = new Map();
  for (const p of Object.values(panel || {})) for (const e of p?.etiquetas || []) { const k = e.toLowerCase(); const v = n.get(k) || { etiqueta: e, n: 0 }; v.n++; n.set(k, v); }
  return [...n.values()].sort((a, b) => b.n - a.n || a.etiqueta.localeCompare(b.etiqueta, 'es')).map((x) => x.etiqueta);
}
// Poner o quitar una etiqueta a varios a la vez: { id: fila nueva o null }
export function conEtiqueta(panel, ids, etiqueta, poner = true) {
  const e = limpiarEtiqueta(etiqueta);
  const out = {};
  if (!e) return out;
  for (const id of ids) {
    const p = panel?.[id] || { fijado: false, etiquetas: [], nota: null };
    const sin = (p.etiquetas || []).filter((x) => x.toLowerCase() !== e.toLowerCase());
    out[id] = limpiarPanelAtleta({ ...p, etiquetas: poner ? [...sin, e] : sin });
  }
  return out;
}
export const COLORES_ETIQUETA = ['morado', 'azul', 'verde', 'ambar', 'rojo', 'gris'];
// El color de una etiqueta: el que elegiste o, si no, uno fijo según sus letras
export function colorEtiqueta(e, colores = {}) {
  const k = String(e || '').toLowerCase();
  if (COLORES_ETIQUETA.includes(colores?.[k])) return colores[k];
  let h = 0;
  for (const c of k) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return COLORES_ETIQUETA[h % (COLORES_ETIQUETA.length - 1)];
}

// ---------------------------------------------------------------- ajustes y vistas guardadas
export const MAX_VISTAS = 12, MAX_NOMBRE_VISTA = 40;
export const ESTADOS = ['todos', 'atencion', 'invitados', 'baja', 'inactivos'];
export function limpiarVista(v) {
  if (!v || typeof v !== 'object') return null;
  const nombre = [...sinControl(v.nombre).replace(/\s+/g, ' ').trim()].slice(0, MAX_NOMBRE_VISTA).join('').trim();
  if (!nombre) return null;
  return {
    id: /^[a-z0-9-]{1,40}$/.test(String(v.id || '')) ? v.id : `v-${normal(nombre).replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`,
    nombre,
    estado: ESTADOS.includes(v.estado) ? v.estado : 'todos',
    filtros: limpiarFiltros(v.filtros),
    orden: limpiarOrden(v.orden),
    columnas: v.columnas ? limpiarColumnas(v.columnas) : null,
    agrupar: limpiarAgrupar(v.agrupar),
    compacta: !!v.compacta,
  };
}
export const AJUSTES_PANEL = { columnas: COLUMNAS_DEFECTO, orden: { col: 'urgencia', dir: 'asc' }, agrupar: '', compacta: false, vistas: [], colores: {} };
export function limpiarAjustesPanel(d) {
  const x = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  const vistas = [];
  for (const v of Array.isArray(x.vistas) ? x.vistas : []) {
    const l = limpiarVista(v);
    if (l && !vistas.some((o) => o.id === l.id || o.nombre.toLowerCase() === l.nombre.toLowerCase())) vistas.push(l);
    if (vistas.length >= MAX_VISTAS) break;
  }
  const colores = {};
  for (const [k, c] of Object.entries(x.colores && typeof x.colores === 'object' ? x.colores : {}).slice(0, 60)) {
    const e = limpiarEtiqueta(k).toLowerCase();
    if (e && COLORES_ETIQUETA.includes(c)) colores[e] = c;
  }
  return { columnas: limpiarColumnas(x.columnas), orden: limpiarOrden(x.orden), agrupar: limpiarAgrupar(x.agrupar), compacta: !!x.compacta, vistas, colores };
}
// La vista de ahora, para guardarla con un nombre (si ya hay una con ese nombre, se sustituye)
export function guardarVista(ajustes, nombre, actual) {
  const v = limpiarVista({ ...actual, nombre, columnas: actual.columnas || ajustes.columnas });
  if (!v) return ajustes;
  const resto = (ajustes.vistas || []).filter((o) => o.nombre.toLowerCase() !== v.nombre.toLowerCase());
  if (resto.length >= MAX_VISTAS) return ajustes;
  let id = v.id, n = 2;
  while (resto.some((o) => o.id === id)) id = `${v.id.slice(0, 36)}-${n++}`;
  return { ...ajustes, vistas: [...resto, { ...v, id }] };
}
export const quitarVista = (ajustes, id) => ({ ...ajustes, vistas: (ajustes.vistas || []).filter((v) => v.id !== id) });

// ---------------------------------------------------------------- recorrer la lista desde la ficha
// El anterior y el siguiente de `id` en el orden de la lista (sin dar la vuelta)
export function vecinos(ids = [], id) {
  const i = ids.indexOf(id);
  if (i < 0) return { anterior: null, siguiente: null, puesto: 0, total: ids.length };
  return { anterior: ids[i - 1] ?? null, siguiente: ids[i + 1] ?? null, puesto: i + 1, total: ids.length };
}

// ---------------------------------------------------------------- mensajes a varios
// {nombre} = su nombre de pila
export const conNombre = (texto, nombre) => String(texto || '').replace(/\{nombre\}/gi, String(nombre || '').trim().split(/\s+/)[0] || '');
