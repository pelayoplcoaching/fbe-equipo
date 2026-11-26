// (v0.254) Tu medicación y el ejercicio: reconocer lo que el atleta escribe en «Tomo alguna medicación a diario» (sus
// preguntas de salud) con los nombres de Pauta Activa (datos/pauta-activa-nombres.json, que sale de su base con
// scripts/pauta-activa-nombres.mjs), la lista que confirma (migración 107) y el enlace que abre Pauta Activa con ella.
// Nada de reglas ni de textos de salud: lo que tiene en cuenta al entrenar lo dice Pauta Activa. Lógica pura (la app, la
// demo y las pruebas).

export const PAUTA_ACTIVA = 'https://medicacionyejercicio.fuerzabasadaenevidencia.com/';
export const MAX_LISTA = 30, MAX_NOMBRE = 80, MAX_TEXTO = 80, MAX_DOSIS = 100000, MAX_TOMAS = 12;
// Lo que dice la tarjeta de Pauta Activa en la web (herramientas.html), tal cual, y lo de sin cuentas (su revisión jurídica)
export const TEXTO_PAUTA_ACTIVA = 'Lee tu medicación habitual y tu situación clínica y te dice qué tener en cuenta al entrenar: aeróbico, fuerza y equilibrio, interacciones relevantes (también con suplementos y plantas) e informes para ti, tu médico y tu entrenador.';
export const TEXTO_ENLACE = 'Sin cuentas: tu lista va dentro del propio enlace, sin tu nombre, y no pasa por ningún servidor.';

// Minúsculas, sin tildes, «µg» como «mcg» y todo lo que no es letra o número, un espacio
const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const normalizar = (s) => sinTildes(String(s ?? '').replace(/[\u00b5\u03bc]/g, 'mc')).toLowerCase()
  .replace(/[^a-z0-9.,\/-]+/g, ' ').replace(/\s+/g, ' ').trim();
const termino = (s) => normalizar(s).replace(/[^a-z0-9]+/g, ' ').trim();
// Palabras entre paréntesis que no son un nombre de medicamento («Fentanilo (parche)», «Ibandronato (mensual)»)
const NO_NOMBRE = new Set(['parche', 'mensual', 'semanal', 'oral', 'inhalado', 'inhalada', 'dosis', 'baja', 'alta', 'gotas', 'jarabe',
  'crema', 'colirio', 'inyectable', 'comprimidos', 'capsulas', 'sobres', 'regular', 'rapida', 'lenta', 'retard']);

// El índice: cada nombre (normalizado) con su principio activo; los más largos primero (para «sacubitrilo valsartan» antes
// que «valsartan»). prio 2: nombre o marca; 1: un nombre suelto entre paréntesis o una alternativa con « / ».
const INDICES = new WeakMap();
export function indiceDe(base) {
  if (!base || !Array.isArray(base.p)) return { terminos: [], principios: new Map() };
  if (INDICES.has(base)) return INDICES.get(base);
  const principios = new Map();
  const porTermino = new Map();
  const poner = (t, pids, prio, dosis = null) => {
    const k = termino(t);
    if (k.replace(/ /g, '').length < 4) return;
    const ya = porTermino.get(k);
    if (ya && ya.prio >= prio) return;
    porTermino.set(k, { t: k, pids, prio, dosis });
  };
  for (const [pid, nombre, familia, marcas] of base.p) {
    const principal = String(nombre).replace(/\s*\(.*$/, '').trim();
    principios.set(pid, { pid, nombre: principal, familia: base.f?.[familia] || null });
  }
  for (const [pid, nombre, , marcas] of base.p) {
    const principal = String(nombre).replace(/\s*\(.*$/, '').trim();
    poner(principal, [pid], 2);
    for (const m of marcas || []) poner(m, [pid], 2);
    if (/\s\/\s/.test(principal)) for (const alt of principal.split(/\s\/\s/)) poner(alt, [pid], 1);
    const entre = /\(([^)]*)\)/.exec(String(nombre))?.[1];
    if (entre) {
      for (const parte of entre.split(/,|;|\so\s|\sy\s|\+/)) {
        const t = termino(parte);
        if (/^[a-z]{5,}$/.test(t) && !NO_NOMBRE.has(t)) poner(t, [pid], 1);
      }
    }
  }
  for (const [nombre, marcas, pids, dosis] of base.x || []) {
    if (!pids.every((pid) => principios.has(pid))) continue;
    poner(nombre, pids, 3, dosis);
    for (const m of marcas || []) poner(m, pids, 3, dosis);
  }
  const terminos = [...porTermino.values()].sort((a, b) => b.t.length - a.t.length);
  const out = { terminos, principios };
  INDICES.set(base, out);
  return out;
}

// La dosis (en mg; con g, por mil; en microgramos o unidades, sin dosis: Pauta Activa la pide) y las tomas al día del trozo
// de texto que va detrás del nombre: «5 mg 1-0-0», «850 mg cada 12 horas», «20 mg dos veces al día»
const NUM_PALABRA = { una: 1, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4 };
export function dosisYTomas(trozo = '') {
  const t = normalizar(trozo);
  let dosis = null, tomas = null;
  // lo que no es diario (semanal, mensual, cada varios días) o va en dos cifras («49/51 mg»), sin dosis: que la ponga en
  // Pauta Activa, que sabe de dosis por semana y por mes
  if (/\b(semana|semanas|semanal|semanales|mensual|mes|meses|quincenal|cada\s+\d+\s+dias)\b/.test(t)) return { dosis: null, tomas: null };
  const d = /(\d+(?:[.,]\d+)?)\s*(mg|miligramos?|g|gr|gramos?)\b/.exec(t);
  if (d && t[d.index - 1] !== '/') {
    const v = Number(d[1].replace(',', '.')) * (/^g/.test(d[2]) ? 1000 : 1);
    if (Number.isFinite(v) && v > 0 && v <= MAX_DOSIS) dosis = Math.round(v * 1000) / 1000;
  }
  const pauta = /\b(\d)\s*-\s*(\d)\s*-\s*(\d)(?:\s*-\s*(\d))?\b/.exec(t);
  if (pauta) {
    const suma = [pauta[1], pauta[2], pauta[3], pauta[4] || '0'].reduce((s, x) => s + Number(x), 0);
    if (suma >= 1 && suma <= MAX_TOMAS) tomas = suma;
  } else {
    const cada = /cada\s+(\d{1,2})\s*(h|horas?)\b/.exec(t);
    const veces = /\b(\d|una|un|uno|dos|tres|cuatro)\s+(veces|vez)?\s*al\s+dia\b/.exec(t);
    if (cada && [4, 6, 8, 12, 24].includes(Number(cada[1]))) tomas = 24 / Number(cada[1]);
    else if (veces) tomas = Number(veces[1]) || NUM_PALABRA[veces[1]] || null;
  }
  return { dosis, tomas: tomas && tomas >= 1 && tomas <= MAX_TOMAS ? tomas : null };
}

// Reconoce el texto: { encontrados: [{ pid, nombre, familia, dosis, tomas, texto }], sinReconocer: [línea] }. Cada línea (o
// trozo separado por «;» o «+») puede traer varios; un principio activo sale una sola vez; las líneas sin nada conocido
// van a sinReconocer (como mucho 10).
export function reconocer(texto, base) {
  const { terminos, principios } = indiceDe(base);
  const encontrados = [], sinReconocer = [];
  const vistos = new Set();
  const lineas = String(texto ?? '').split(/\n|;|\s\+\s/).map((l) => l.trim()).filter(Boolean);
  for (const original of lineas) {
    // con los signos (para la dosis y la pauta «1-0-1») y sin ellos, con los mismos índices (+1 por el espacio de delante)
    const lineaN = normalizar(original);
    const linea = ` ${lineaN.replace(/[.,\/-]/g, ' ')} `;
    const ocupado = [];
    const hallados = [];
    for (const x of terminos) {
      let desde = 0;
      for (;;) {
        const i = linea.indexOf(` ${x.t} `, desde);
        if (i < 0) break;
        const a = i + 1, b = i + 1 + x.t.length;
        if (!ocupado.some(([c, d]) => a < d && c < b)) { ocupado.push([a, b]); hallados.push({ x, a, b }); }
        desde = i + 1;
      }
    }
    hallados.sort((p, q) => p.a - q.a);
    if (!hallados.length) {
      if (/[a-z]{3,}/.test(linea) && sinReconocer.length < 10) sinReconocer.push(original.slice(0, MAX_TEXTO));
      continue;
    }
    hallados.forEach(({ x, b }, k) => {
      // lo que va detrás de este nombre y antes del siguiente
      const sigue = lineaN.slice(b - 1, k + 1 < hallados.length ? hallados[k + 1].a - 1 : lineaN.length);
      const { dosis, tomas } = dosisYTomas(sigue);
      x.pids.forEach((pid, j) => {
        if (vistos.has(pid) || encontrados.length >= MAX_LISTA) return;
        vistos.add(pid);
        const p = principios.get(pid);
        const dosisComb = x.dosis?.[j];
        encontrados.push({ pid, nombre: p.nombre, familia: p.familia, dosis: x.pids.length > 1 ? (Number.isFinite(dosisComb) ? dosisComb : null) : dosis,
          tomas, texto: original.slice(0, MAX_TEXTO) });
      });
    });
  }
  return { encontrados, sinReconocer };
}

// Lo que se guarda (107) y lo que lleva el enlace: como mucho 30, cada uno con su id, su nombre, su dosis en mg y sus tomas
const num = (v, max) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 1000) / 1000 : null; };
export function limpiarLista(lista = []) {
  const out = [], vistos = new Set();
  for (const x of Array.isArray(lista) ? lista : []) {
    const pid = String(x?.pid ?? '');
    if (!/^[a-z0-9_]{2,60}$/.test(pid) || vistos.has(pid)) continue;
    const nombre = String(x?.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE);
    if (!nombre) continue;
    vistos.add(pid);
    const tomas = num(x?.tomas, MAX_TOMAS);
    out.push({ pid, nombre, dosis: num(x?.dosis, MAX_DOSIS), tomas: tomas != null ? Math.round(tomas) : null,
      texto: x?.texto ? String(x.texto).replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO) : null });
    if (out.length >= MAX_LISTA) break;
  }
  return out;
}

// «5 mg, 1 vez al día», «850 mg, 2 al día», «sin dosis»
export function dosisTexto(x = {}) {
  const d = Number.isFinite(x.dosis) ? `${String(x.dosis).replace('.', ',')} mg` : null;
  const t = Number.isFinite(x.tomas) ? (x.tomas === 1 ? '1 vez al día' : `${x.tomas} al día`) : null;
  return [d, t].filter(Boolean).join(', ') || 'sin dosis';
}

// El enlace que abre Pauta Activa con su lista: el estado en base64url en el fragmento (#lista=), como el que genera la
// propia Pauta Activa con «Copiar enlace con mi lista» (cada fármaco: [id, dosis, tomas, null, 0, '']). Solo la medicación:
// sin nombre ni edad. Lo que Pauta Activa no conoce, lo descarta ella al abrirlo.
const base64url = (texto) => {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export function enlacePautaActiva(lista = []) {
  const m = limpiarLista(lista).map((x) => [x.pid, x.dosis, x.tomas, null, 0, '']);
  return m.length ? `${PAUTA_ACTIVA}#lista=${base64url(JSON.stringify({ m }))}` : PAUTA_ACTIVA;
}
// Para las pruebas: lo que lleva un enlace
export function listaDelEnlace(url = '') {
  const c = /#lista=([A-Za-z0-9_-]+)/.exec(String(url))?.[1];
  if (!c) return null;
  const bin = atob(c.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
}

// ¿Ha dicho que toma medicación? (sus preguntas de salud: «otras» lleva 'medicacion')
export const tomaMedicacion = (c) => Array.isArray(c?.otras) && c.otras.includes('medicacion');
