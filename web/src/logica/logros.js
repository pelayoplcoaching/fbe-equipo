import { lunesDe } from './fechas.js';
import { num } from './calculos.js';

// Logros: medallas por hitos, en cuatro niveles con los colores de los discos de competición
// (10 kg verde, 15 kg amarillo, 20 kg azul y 25 kg rojo). Se calculan con lo que ya hay registrado.

export const NIVELES_LOGRO = [
  { n: 1, color: 'verde', nombre: 'Disco verde' },
  { n: 2, color: 'amarillo', nombre: 'Disco amarillo' },
  { n: 3, color: 'azul', nombre: 'Disco azul' },
  { n: 4, color: 'rojo', nombre: 'Disco rojo' },
];

const plural = (n, uno, varios) => `${num(n, 0)} ${n === 1 ? uno : varios}`;

// salud: si el logro necesita el consentimiento de datos de salud (sin él no se muestra)
export const LOGROS = [
  { id: 'sesiones', titulo: 'Constancia', icono: 'hoy', umbrales: [1, 10, 50, 100], texto: (u) => plural(u, 'sesión hecha', 'sesiones hechas') },
  { id: 'racha', titulo: 'Semanas completas', icono: 'llama', umbrales: [2, 4, 8, 12], texto: (u) => `${u} semanas completas seguidas` },
  { id: 'toneladas', titulo: 'Toneladas', icono: 'disco', umbrales: [10, 50, 100, 250], texto: (u) => `${num(u, 0)} toneladas movidas` },
  { id: 'records', titulo: 'Récords', icono: 'trofeo', umbrales: [1, 10, 25, 50], texto: (u) => plural(u, 'récord', 'récords') },
  { id: 'videos', titulo: 'Técnica', icono: 'video', umbrales: [1, 5, 15, 30], texto: (u) => plural(u, 'vídeo enviado a tu coach', 'vídeos enviados a tu coach') },
  { id: 'checkins', titulo: 'Check-ins', icono: 'checkin', umbrales: [1, 4, 12, 26], texto: (u) => plural(u, 'check-in', 'check-ins'), salud: true },
  { id: 'peso', titulo: 'Báscula', icono: 'bascula', umbrales: [7, 30, 90, 180], texto: (u) => plural(u, 'día apuntando tu peso', 'días apuntando tu peso'), salud: true },
];
export const LOGRO = Object.fromEntries(LOGROS.map((l) => [l.id, l]));

// La racha más larga de la historia (no la actual): semanas seguidas con todas las sesiones programadas hechas.
// Las semanas sin nada programado no cuentan ni rompen; la semana en curso a medias tampoco rompe.
export function rachaMaxima(semanas, hoy) {
  const actual = lunesDe(hoy);
  const porLunes = new Map();
  for (const s of semanas) {
    if (!s.fecha_inicio || !s.total) continue;
    const k = lunesDe(s.fecha_inicio);
    if (k > actual) continue;
    const x = porLunes.get(k) || { total: 0, hechas: 0 };
    x.total += s.total; x.hechas += s.hechas;
    porLunes.set(k, x);
  }
  let max = 0, n = 0;
  for (const [k, x] of [...porLunes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (x.hechas >= x.total) { n++; max = Math.max(max, n); }
    else if (k !== actual) n = 0;
  }
  return max;
}

// cuentas: { sesiones, racha, toneladas, records, videos, checkins, peso }; salud: consentimiento de datos de salud
export function calcularLogros(cuentas, { salud = true } = {}) {
  return LOGROS.filter((l) => salud || !l.salud).map((l) => {
    const valor = Number(cuentas[l.id]) || 0;
    const nivel = l.umbrales.filter((u) => valor >= u).length;
    const siguiente = l.umbrales[nivel] ?? null;
    const anterior = nivel ? l.umbrales[nivel - 1] : 0;
    return {
      id: l.id, titulo: l.titulo, icono: l.icono, valor, nivel,
      color: nivel ? NIVELES_LOGRO[nivel - 1].color : null,
      conseguido: nivel ? l.texto(l.umbrales[nivel - 1]) : null,
      siguiente: siguiente != null ? { umbral: siguiente, texto: l.texto(siguiente), falta: siguiente - valor } : null,
      // Progreso hacia el siguiente nivel (1 si ya tiene el último)
      progreso: siguiente == null ? 1 : Math.max(0, Math.min(1, (valor - anterior) / (siguiente - anterior))),
      niveles: l.umbrales.map((u, i) => ({ n: i + 1, umbral: u, texto: l.texto(u), color: NIVELES_LOGRO[i].color, conseguido: valor >= u })),
    };
  });
}

// Lo conseguido desde lo último que vio: [{ id, nivel, titulo, texto, color }] (el nivel más alto de cada logro)
export function logrosNuevos(lista, vistos = {}) {
  return lista.filter((l) => l.nivel > (Number(vistos[l.id]) || 0))
    .map((l) => ({ id: l.id, nivel: l.nivel, titulo: l.titulo, texto: l.conseguido, color: l.color }));
}
export const nivelesVistos = (lista) => Object.fromEntries(lista.map((l) => [l.id, l.nivel]));
