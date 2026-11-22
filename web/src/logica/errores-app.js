// (v0.207) Errores de la app: los que no son fallos, aparte, para que se vean los de verdad.
// - Los avisos de las notificaciones que se arreglan solos: al abrir la app, si el navegador o la base no tenían la
//   suscripción, se rehace sola. Se apuntan para saber cuántas veces pasa, no porque algo haya fallado.
// - «Can't find variable: EmptyRanges»: lo dice el reproductor de vídeo del iPhone, no la app (y ya no se apunta).
// (las versiones, como en las novedades)
import { versionCorta, compararApp } from './novedades-app.js';

export const AVISO_PUSH = /^push: al abrir\b/;
export const DEL_IPHONE = /\bEmptyRanges\b/;

export const esAviso = (e) => !!e && (AVISO_PUSH.test(String(e.mensaje || '')) || DEL_IPHONE.test(String(e.mensaje || '')));

export function separarErrores(errores = []) {
  const reales = [], avisos = [];
  for (const e of errores || []) (esAviso(e) ? avisos : reales).push(e);
  return { reales, avisos };
}

// (v0.207) Los errores agrupados por mensaje (sin números, identificadores ni direcciones, para que el mismo fallo cuente
// como uno), con cuántas veces, a cuántas personas, en qué versiones y si es nuevo de la última versión (no salió en
// ninguna anterior). Los más repetidos primero; a igualdad, el más reciente.

export function mensajeComun(m) {
  return String(m || '')
    .replace(/https?:\/\/\S+/g, '…')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '…')
    .replace(/\b\d+(?:[.,:]\d+)*\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export function agruparErrores(errores = []) {
  const grupos = new Map();
  const versiones = [...new Set((errores || []).map((e) => versionCorta(e.version)).filter(Boolean))].sort(compararApp);
  const ultima = versiones[versiones.length - 1] || null;
  for (const e of errores || []) {
    const clave = mensajeComun(e.mensaje);
    let g = grupos.get(clave);
    if (!g) { g = { clave, mensaje: e.mensaje, veces: 0, personas: new Set(), versiones: new Set(), ultimo: null, ejemplos: [] }; grupos.set(clave, g); }
    g.veces++;
    if (e.quien) g.personas.add(e.quien);
    const v = versionCorta(e.version);
    if (v) g.versiones.add(v);
    if (!g.ultimo || String(e.creado_en || '') > String(g.ultimo)) { g.ultimo = e.creado_en || null; g.mensaje = e.mensaje; }
    if (g.ejemplos.length < 3) g.ejemplos.push(e);
  }
  return [...grupos.values()].map((g) => {
    const vs = [...g.versiones].sort(compararApp);
    return {
      clave: g.clave, mensaje: g.mensaje, veces: g.veces, personas: g.personas.size, versiones: vs, ultimo: g.ultimo, ejemplos: g.ejemplos,
      nuevo: !!ultima && versiones.length > 1 && vs.length > 0 && vs.every((v) => v === ultima),
    };
  }).sort((a, b) => b.veces - a.veces || String(b.ultimo || '').localeCompare(String(a.ultimo || '')));
}
