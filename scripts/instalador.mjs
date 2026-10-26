// Genera supabase/instalar.sql: schema.sql y todas las migraciones, en orden, en un solo archivo para pegar
// una vez en el SQL Editor de Supabase en una base nueva. (La biblioteca, seed_ejercicios.sql, va aparte: es
// privada y no está en el repositorio.) Uso: npm run instalador. Las pruebas comprueban que está al día.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = new URL('../', import.meta.url);

export function generarInstalador() {
  const migraciones = readdirSync(new URL('supabase/migraciones/', raiz)).filter((f) => f.endsWith('.sql')).sort();
  const ultima = migraciones[migraciones.length - 1].slice(0, 3);
  const partes = [
    `-- =====================================================================
-- FBE Atletas: instalación completa en una base nueva (schema.sql y las migraciones 002 a ${ultima})
-- Generado con «npm run instalador»: no lo edites a mano (los cambios van en schema.sql o en una migración).
--
-- Cómo: en Supabase, SQL Editor → New query → pega TODO este archivo → Run. Después, en otra consulta,
-- seed_ejercicios.sql (tu biblioteca). Si ya tienes la app instalada, no uses este archivo: ejecuta solo
-- las migraciones que te falten (la base te lo impide igualmente).
-- =====================================================================

do $$
begin
  if to_regclass('public.perfiles') is not null then
    raise exception 'Esta base ya tiene la app instalada: no uses instalar.sql. Ejecuta solo las migraciones que te falten (supabase/migraciones/).';
  end if;
end $$;
`,
    `\n-- ============================== schema.sql ==============================\n`,
    readFileSync(new URL('supabase/schema.sql', raiz), 'utf8'),
  ];
  for (const m of migraciones) {
    partes.push(`\n-- ============================== migraciones/${m} ==============================\n`);
    partes.push(readFileSync(new URL(`supabase/migraciones/${m}`, raiz), 'utf8'));
  }
  return partes.join('').trimEnd() + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sql = generarInstalador();
  writeFileSync(new URL('supabase/instalar.sql', raiz), sql);
  console.log(`supabase/instalar.sql  ${Math.round(sql.length / 1024)} KB`);
}
