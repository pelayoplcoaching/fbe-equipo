// (v0.209) La última migración de supabase/migraciones que necesita esta versión de la app. Cuenta avisa al coach si su
// base va por una anterior (la base lo dice con migracion_actual(), desde la 087). test/copia.test.mjs comprueba que
// este número es el de la última migración del repositorio: al añadir una, súbelo.
export const MIGRACION_ULTIMA = 87;
// Números que no existen (la 052 se renumeró como 058 antes de publicarse)
export const HUECOS_MIGRACIONES = [52];

const tres = (n) => String(n).padStart(3, '0');

// Lo que le falta a una base que va por «base» (null: no se sabe, la base no tiene aún la 087)
export function migracionesQueFaltan(base, ultima = MIGRACION_ULTIMA) {
  if (base == null) return { base: null, ultima, faltan: [], alMenos: tres(ultima) };
  const n = Number(base);
  if (!Number.isInteger(n) || n >= ultima) return { base: n, ultima, faltan: [], alMenos: null };
  const faltan = [];
  for (let i = Math.max(n + 1, 1); i <= ultima; i++) if (!HUECOS_MIGRACIONES.includes(i)) faltan.push(tres(i));
  return { base: n, ultima, faltan, alMenos: null };
}
