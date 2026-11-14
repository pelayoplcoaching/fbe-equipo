// (tanda 3) Lo que la travesía enseña fuera del juego: el mapa (los kilómetros acumulados avanzan por una ruta de verdad,
// con sus hitos y una postal en cada uno), los lobos que se desbloquean, las constelaciones que se completan con las
// estrellas, la manada propia (un lobo por semana completa) y, con la comunidad, la clasificación de la semana, el duelo
// y la travesía en equipo. Todo sale de lo que ya se guarda: metros, estrellas, retos y ríos. Solo funciones puras.

// ---------- El mapa ----------
// Tres rutas, una detrás de otra (y vuelta a empezar). Los hitos, con su kilómetro desde la salida.
export const RUTAS = [
  { id: 'mieres-madrid', nombre: 'De Mieres a Madrid', hitos: [['Mieres', 0], ['Pola de Lena', 12], ['Puerto de Pajares', 38], ['La Robla', 85], ['León', 110], ['Benavente', 180], ['Tordesillas', 262], ['Arévalo', 320], ['Guadarrama', 398], ['Madrid', 450]] },
  { id: 'madrid-valencia', nombre: 'De Madrid a Valencia', hitos: [['Madrid', 0], ['Arganda', 28], ['Tarancón', 82], ['Honrubia', 165], ['Motilla del Palancar', 198], ['Utiel', 270], ['Requena', 285], ['Buñol', 320], ['Valencia', 355]] },
  { id: 'valencia-barcelona', nombre: 'De Valencia a Barcelona', hitos: [['Valencia', 0], ['Sagunto', 30], ['Castellón', 72], ['Peñíscola', 140], ['Tortosa', 190], ['Tarragona', 260], ['Sitges', 315], ['Barcelona', 350]] },
];
// (remate, tanda 6) Las rutas nuevas, para después de Barcelona: cada una se elige en «Tu travesía» (sin elegir, van en
// este orden y vuelven a empezar). Los kilómetros son aproximados, siguiendo carreteras y caminos.
export const RUTAS_NUEVAS = [
  { id: 'picos', nombre: 'Por los Picos de Europa', hitos: [['Cangas de Onís', 0], ['Covadonga', 11], ['Lagos de Covadonga', 24], ['Arenas de Cabrales', 52], ['Poncebos', 58], ['Bulnes', 63], ['Sotres', 75], ['Potes', 115], ['Fuente Dé', 138]] },
  { id: 'pirineos', nombre: 'Por los Pirineos', hitos: [['Jaca', 0], ['Canfranc', 24], ['Somport', 32], ['Panticosa', 75], ['Torla', 110], ['Ordesa', 118], ['Benasque', 210], ['Vielha', 265], ['Puigcerdà', 380]] },
  { id: 'camino', nombre: 'El Camino de Santiago', hitos: [['León', 0], ['Astorga', 50], ['Rabanal del Camino', 70], ['Ponferrada', 115], ['Villafranca del Bierzo', 140], ['O Cebreiro', 170], ['Sarria', 215], ['Portomarín', 237], ['Arzúa', 275], ['Santiago de Compostela', 310]] },
];
const largo = (r) => r.hitos[r.hitos.length - 1][1];
// La ruta número n del recorrido (de 0 en adelante): las tres de siempre y luego las elegidas (o las nuevas, por orden)
export function rutaN(n, elegidas = []) {
  if (n < RUTAS.length) return RUTAS[n];
  const k = n - RUTAS.length, id = Array.isArray(elegidas) ? elegidas[k] : null;
  return RUTAS_NUEVAS.find((r) => r.id === id) || RUTAS_NUEVAS[k % RUTAS_NUEVAS.length];
}
const cuenta = (g) => ({ total: Number(g?.total) || 0, estrellas: Number(g?.estrellas) || 0, retos: Number(g?.retos) || 0, rios: Number(g?.rios) || 0 });

// Dónde va con esos metros: { ruta, n (qué ruta, de 0 en adelante contando vueltas), km (en esta ruta), largo, pct,
// anterior: [nombre, km], siguiente: [nombre, km] | null, faltan (km al siguiente), pasados (hitos alcanzados en esta ruta) }
// (remate, tanda 6) tras Barcelona ya no vuelve a empezar: siguen las rutas nuevas (las elegidas, o por orden)
export function posicionEnRuta(metros, elegidas = []) {
  let km = Math.max(0, Number(metros) || 0) / 1000, i = 0;
  while (km >= largo(rutaN(i, elegidas)) && i < 100000) { km -= largo(rutaN(i, elegidas)); i += 1; }
  const ruta = rutaN(i, elegidas);
  const pasados = ruta.hitos.filter(([, k]) => k <= km).length;
  const siguiente = ruta.hitos[pasados] || null;
  return { ruta, n: i, km: Math.round(km * 10) / 10, kmExacto: km, largo: largo(ruta), pct: Math.min(1, km / largo(ruta)), anterior: ruta.hitos[pasados - 1], siguiente,
    faltan: siguiente ? Math.max(0.1, Math.round((siguiente[1] - km) * 10) / 10) : 0, pasados };
}
// ¿Toca elegir la ruta siguiente? Desde la última de siempre en adelante: { n (la que se elige), elegida (su id o null) }
export function rutaPorElegir(metros, elegidas = []) {
  const p = posicionEnRuta(metros, elegidas);
  if (p.n < RUTAS.length - 1) return null;
  const n = p.n + 1, k = n - RUTAS.length;
  return { n, elegida: Array.isArray(elegidas) && RUTAS_NUEVAS.some((r) => r.id === elegidas[k]) ? elegidas[k] : null };
}
// Dónde va, en una frase
const km1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
export function textoRuta(p) {
  if (!p) return '';
  if (p.n === 0 && p.km === 0) return `Tu lobo sale de ${p.anterior[0]}. Lo primero, ${p.siguiente[0]}, a ${km1(p.faltan)} km.`;
  if (!p.siguiente) return `Tu lobo ha llegado a ${p.anterior[0]}.`;
  return `Va por el km ${km1(p.km)} de ${km1(p.largo)}: pasado ${p.anterior[0]}, a ${km1(p.faltan)} km de ${p.siguiente[0]}.`;
}
// Para contarlo fuera: lo que lleva su lobo, en dos frases
export function textoParaCompartir(guardado) {
  const t = cuenta(guardado), p = posicionEnRuta(t.total);
  if (t.total <= 0) return '';
  const donde = p.km === 0 ? `acaba de llegar a ${p.anterior[0]}` : `ha pasado ${p.anterior[0]} y va camino de ${p.siguiente[0]}`;
  return `Mi lobo lleva ${km1(t.total / 1000)} km en La travesía (${p.ruta.nombre.replace(/^De/, 'de')}): ${donde}.${t.estrellas > 0 ? ` ${t.estrellas} ${t.estrellas === 1 ? 'estrella' : 'estrellas'} por el camino.` : ''} Avanza solo cuando entreno.`;
}
// Las postales: una por hito alcanzado, de todas las rutas hechas y de la que lleva. La imagen, una de las doce
// ilustraciones de los meses (la misma siempre para el mismo hito). [{ id, lugar, ruta, km, imagen }], la última primero
export function postales(metros, elegidas = []) {
  const p = posicionEnRuta(metros, elegidas), out = [];
  for (let n = Math.max(0, p.n - 30); n <= p.n; n++) {
    const r = rutaN(n, elegidas);
    const hasta = n < p.n ? r.hitos.length : p.pasados;
    r.hitos.slice(0, hasta).forEach(([lugar, km], i) => {
      if (i === 0 && n > 0) return;   // (la salida de una ruta es la llegada de la anterior)
      out.push({ id: `${n}:${i}`, lugar, ruta: r.nombre, km, imagen: `mes-${String(((n * 5 + i * 7) % 12) + 1).padStart(2, '0')}` });
    });
  }
  return out.reverse();
}
// ¿Qué postales nuevas trae pasar de `antes` a `ahora` metros?
export function postalesNuevas(antes, ahora, elegidas = []) {
  const ya = new Set(postales(antes, elegidas).map((x) => x.id));
  return postales(ahora, elegidas).filter((x) => !ya.has(x.id));
}

// ---------- Los lobos ----------
// Cada lobo, con sus dos colores (claro y sombra) y lo que hay que haber hecho para tenerlo
export const LOBOS = [
  { id: 'tiza', nombre: 'Lobo de tiza', claro: '#EEEEF2', sombra: '#A49CFF', como: 'El de siempre', si: () => true },
  { id: 'lavanda', nombre: 'Lobo lavanda', claro: '#C4BFFF', sombra: '#7C6AFD', como: 'Recorre 5 km', si: (t) => t.total >= 5000 },
  { id: 'rio', nombre: 'Lobo de río', claro: '#CAE0FF', sombra: '#3A83ED', como: 'Cruza 5 ríos', si: (t) => t.rios >= 5 },
  { id: 'oro', nombre: 'Lobo dorado', claro: '#FADA99', sombra: '#D3A329', como: 'Cumple 5 retos del día', si: (t) => t.retos >= 5 },
  { id: 'nieve', nombre: 'Lobo de nieve', claro: '#FFFFFF', sombra: '#C4BFFF', como: 'Recorre 25 km', si: (t) => t.total >= 25000 },
  { id: 'noche', nombre: 'Lobo de la noche', claro: '#462ABF', sombra: '#241665', como: 'Coge 300 estrellas', si: (t) => t.estrellas >= 300 },
  { id: 'brasa', nombre: 'Lobo de brasa', claro: '#FFB38C', sombra: '#D45E00', como: 'Llega a Madrid (450 km)', si: (t) => t.total >= 450000 },
];
export const lobosDe = (guardado) => { const t = cuenta(guardado); return LOBOS.map((l) => ({ id: l.id, nombre: l.nombre, claro: l.claro, sombra: l.sombra, como: l.como, tiene: !!l.si(t) })); };
// El lobo elegido (si no lo tiene o no existe, el de tiza)
export function loboElegido(guardado, id) {
  const l = lobosDe(guardado).find((x) => x.id === id && x.tiene);
  return l || lobosDe(guardado)[0];
}

// ---------- Las constelaciones ----------
// Cada una, con sus estrellas (x, y de 0 a 1) y las líneas que las unen. Se van completando en orden con las estrellas cogidas.
export const CONSTELACIONES = [
  { id: 'lobo', nombre: 'El Lobo', puntos: [[0.1, 0.6], [0.3, 0.45], [0.5, 0.5], [0.7, 0.35], [0.85, 0.2], [0.9, 0.45], [0.55, 0.75], [0.3, 0.8]], lineas: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [2, 6], [1, 7]] },
  { id: 'barra', nombre: 'La Barra', puntos: [[0.08, 0.5], [0.2, 0.3], [0.2, 0.7], [0.5, 0.5], [0.8, 0.3], [0.8, 0.7], [0.92, 0.5]], lineas: [[0, 3], [3, 6], [1, 2], [4, 5]] },
  { id: 'osa', nombre: 'La Osa Mayor', puntos: [[0.08, 0.3], [0.25, 0.25], [0.4, 0.32], [0.55, 0.42], [0.6, 0.65], [0.85, 0.7], [0.9, 0.45]], lineas: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { id: 'montana', nombre: 'La Montaña', puntos: [[0.05, 0.85], [0.3, 0.4], [0.45, 0.6], [0.65, 0.15], [0.95, 0.85], [0.65, 0.4], [0.3, 0.62], [0.5, 0.85], [0.75, 0.6]], lineas: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 7], [7, 0]] },
  { id: 'orion', nombre: 'Orión', puntos: [[0.25, 0.1], [0.75, 0.15], [0.4, 0.45], [0.5, 0.48], [0.6, 0.51], [0.2, 0.9], [0.8, 0.85], [0.5, 0.7], [0.5, 0.25], [0.1, 0.4]], lineas: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 8], [8, 1], [0, 9]] },
  { id: 'luna', nombre: 'La Luna Creciente', puntos: [[0.6, 0.08], [0.4, 0.2], [0.28, 0.4], [0.28, 0.6], [0.4, 0.8], [0.6, 0.92], [0.5, 0.75], [0.44, 0.5], [0.5, 0.25], [0.75, 0.5], [0.85, 0.3], [0.85, 0.7]], lineas: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0]] },
];
// Con esas estrellas cogidas: [{ id, nombre, puntos, lineas, total, cogidas, completa }] y cuántas completas
export function constelaciones(estrellas) {
  let quedan = Math.max(0, Math.round(Number(estrellas) || 0) );
  // (cada punto de una constelación pide 5 estrellas del juego: la primera se completa con 40)
  return CONSTELACIONES.map((c) => {
    const total = c.puntos.length * 5, mias = Math.min(total, quedan);
    quedan -= mias;
    return { id: c.id, nombre: c.nombre, puntos: c.puntos, lineas: c.lineas, total, estrellas: mias, cogidas: Math.floor(mias / 5), completa: mias >= total };
  });
}
export const constelacionesCompletas = (estrellas) => constelaciones(estrellas).filter((c) => c.completa).length;

// ---------- Tu propia manada ----------
// Un lobo detrás del tuyo por cada semana completa seguida (hasta cuatro)
export const manadaPropia = (rachaSemanas) => Math.min(4, Math.max(0, Math.floor(Number(rachaSemanas) || 0)));

// ---------- Con la comunidad (travesia_manada, migración 061) ----------
// Mi puesto en la clasificación de la semana (1 = primero) o null
export function miPuesto(filas = []) { const i = (filas || []).findIndex((f) => f.yo); return i < 0 ? null : i + 1; }
// Los compañeros que han corrido hoy (sin mí): sus nombres, hasta cinco
export const correnHoy = (filas = []) => (filas || []).filter((f) => f.hoy && !f.yo).slice(0, 5).map((f) => f.nombre);
// El duelo de la semana con un compañero: { rival, yo, el, diferencia (metros a mi favor), gano } o null si no está
// (misMetros: lo mío de la semana según el móvil, que puede ir por delante de la base)
export function duelo(filas = [], rival = '', misMetros = null) {
  const el = (filas || []).find((f) => !f.yo && f.nombre === rival);
  if (!el) return null;
  const yo = Math.max(Number(misMetros) || 0, (filas || []).find((f) => f.yo)?.metros || 0);
  return { rival: el.nombre, yo, el: el.metros, diferencia: yo - el.metros, gano: yo > el.metros };
}
// La travesía en equipo: la meta del mes (15 km por cada uno que ha sumado, 50 km como poco) y cómo va
export function equipoDelMes(equipo) {
  const metros = Math.max(0, Number(equipo?.metros) || 0), miembros = Math.max(0, Number(equipo?.miembros) || 0);
  const meta = Math.max(50000, miembros * 15000);
  return { metros, miembros, meta, pct: Math.min(1, metros / meta), hecho: metros >= meta };
}

// (jugo, tanda 11) La silueta de cada sitio en el horizonte, cuando el lobo pasa por él en plena etapa:
// 'castillo' | 'catedral' | 'puente' | 'ciudad' | 'montana' | 'pueblo' (casas con su campanario, el resto)
const SILUETAS = {
  ciudad: ['Madrid', 'Valencia', 'Barcelona', 'León', 'Tarragona', 'Castellón'],
  catedral: ['Santiago de Compostela', 'Astorga', 'Covadonga'],
  castillo: ['Peñíscola', 'Sagunto', 'Ponferrada', 'Arévalo', 'Tortosa', 'Requena', 'Jaca'],
  puente: ['Tordesillas', 'Benavente', 'Cangas de Onís', 'Portomarín', 'Puente la Reina'],
  montana: ['Puerto de Pajares', 'Lagos de Covadonga', 'Fuente Dé', 'Somport', 'Ordesa', 'O Cebreiro', 'Bulnes', 'Guadarrama'],
};
export function siluetaDe(nombre) {
  for (const [tipo, sitios] of Object.entries(SILUETAS)) if (sitios.includes(nombre)) return tipo;
  return 'pueblo';
}
// Lo que necesita la etapa para el próximo sitio de la ruta: { nombre, tipo, metros (desde donde empieza la etapa),
// desde (km del sitio anterior), hasta (km del siguiente), km (por dónde va) } o null si no hay siguiente
export function proximoSitio(metrosAntes, elegidas = []) {
  const p = posicionEnRuta(metrosAntes, elegidas);
  if (!p.siguiente) return null;
  const exacto = p.kmExacto;
  return { nombre: p.siguiente[0], tipo: siluetaDe(p.siguiente[0]), metros: Math.max(1, Math.round((p.siguiente[1] - exacto) * 1000)), desde: p.anterior?.[1] ?? 0, hasta: p.siguiente[1], km: exacto };
}
