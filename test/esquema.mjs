// Aplica a una base PGlite lo mismo que harás en Supabase: el entorno de serie, schema.sql y las migraciones en orden.
import { readFileSync, readdirSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);

export function migraciones() {
  return readdirSync(new URL('supabase/migraciones/', raiz)).filter((f) => f.endsWith('.sql')).sort();
}

export async function aplicarEsquema(db, { repetirMigraciones = false } = {}) {
  await db.exec(readFileSync(new URL('test/entorno-supabase.sql', raiz), 'utf8'));
  await db.exec(readFileSync(new URL('supabase/schema.sql', raiz), 'utf8'));
  for (const m of migraciones()) {
    const sql = readFileSync(new URL(`supabase/migraciones/${m}`, raiz), 'utf8');
    await db.exec(sql);
    if (repetirMigraciones) await db.exec(sql);
  }
}
