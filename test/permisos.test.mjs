// Prueba del esquema en un Postgres local (PGlite) que imita Supabase:
// roles anon/authenticated, auth.users, auth.uid(), auth.jwt(), MFA y Storage (test/entorno-supabase.sql).
// Se aplican schema.sql y las migraciones dos veces, para comprobar que repetirlas no rompe nada.
// Uso: node test/permisos.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, existsSync } from 'node:fs';
import { aplicarEsquema, migraciones } from './esquema.mjs';

const db = new PGlite();
process.on("unhandledRejection", e => { console.error("ERROR:", e.message, e.query ? "\n  en: " + e.query : ""); process.exit(1); });
let ok = 0, fallos = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log('  ✓', msg); } else { fallos++; console.log('  ✗', msg); } };

await aplicarEsquema(db, { repetirMigraciones: true });
console.log(`Esquema y ${migraciones().length} migración(es) aplicados sin errores, también al repetirlas`);

// --- Utilidades -------------------------------------------------------
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const anon = async () => db.exec(`reset role; ${claims('', '')} set role anon;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const nuevoUsuario = async (email) => {
  await su();
  return (await q(`insert into auth.users (email) values ($1) returning id`, [email]))[0].id;
};

// --- Usuarios ---------------------------------------------------------
const pelayo = await nuevoUsuario('pelayo@fbe.test');
const ana = await nuevoUsuario('ana@test');
const luis = await nuevoUsuario('luis@test');
const intruso = await nuevoUsuario('intruso@test');
await su();
check((await q(`select count(*)::int n from perfiles where rol='atleta'`))[0].n === 4, 'cada usuario nuevo recibe un perfil de atleta');
await q(`update perfiles set rol='coach' where id=$1`, [pelayo]);

// --- El coach monta todo ------------------------------------------------
console.log('\nCoach');
await como(pelayo);
const [aAna] = await q(`insert into atletas (nombre) values ('Ana') returning id`);
const [aLuis] = await q(`insert into atletas (nombre) values ('Luis') returning id`);
const codAna = (await q(`select crear_invitacion($1) c`, [aAna.id]))[0].c;
const codLuis = (await q(`select crear_invitacion($1) c`, [aLuis.id]))[0].c;
check(/^FBE-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(codAna), `código con formato legible (${codAna})`);
check((await q(`select codigo_hash from invitaciones limit 1`))[0].codigo_hash.length === 64, 'solo se guarda el hash del código');

const [press] = await q(`insert into ejercicios (nombre, grupos_musculares) values ('Press banca', '{pectoral,triceps,deltoides}') returning id`);
const [remo] = await q(`insert into ejercicios (nombre, grupos_musculares) values ('Remo con barra', '{espalda,biceps}') returning id`);
check(await falla(`insert into ejercicios (nombre, grupos_musculares) values ('X', '{pecho}')`), 'rechaza grupos musculares inventados');

const [pl] = await q(`insert into bloques (es_plantilla, nombre, foco) values (true, 'Torso-pierna 3 días', 'adaptacion') returning id`);
const [pw] = await q(`insert into semanas (bloque_id, numero, foco) values ($1, 1, 'adaptacion') returning id`, [pl.id]);
const [ps] = await q(`insert into sesiones (semana_id, orden, nombre, intencion) values ($1, 1, 'Día 1 push A', 'rendimiento') returning id`, [pw.id]);
await q(`insert into sesion_ejercicios (sesion_id, ejercicio_id, orden, prioridad, series, reps_min, reps_max, rir_objetivo, carga_sugerida_kg, descanso_seg)
         values ($1, $2, 1, 'alta', 3, 6, 8, 2, 60, 150), ($1, $3, 2, 'media', 3, 8, 10, 2, 50, 120)`, [ps.id, press.id, remo.id]);

const lunes = (await q(`select (date_trunc('week', current_date))::date d`))[0].d;
const bAna = (await q(`select crear_bloque_desde_plantilla($1, $2, $3) b`, [pl.id, aAna.id, lunes]))[0].b;
await q(`update bloques set estado='activo' where id=$1`, [bAna]);
const [wAna1] = await q(`select id from semanas where bloque_id=$1 and numero=1`, [bAna]);
await q(`update semanas set programacion='programada' where id=$1`, [wAna1.id]);
const wAna2 = (await q(`select duplicar_semana($1, 2.5, 0, -1) w`, [wAna1.id]))[0].w;
const prog = await q(`select se.carga_sugerida_kg::float kg, se.rir_objetivo::float rir from sesion_ejercicios se join sesiones s on s.id=se.sesion_id where s.semana_id=$1 order by se.orden`, [wAna2]);
check(prog[0].kg === 62.5 && prog[0].rir === 1, 'duplicar semana aplica la progresión (+2,5 kg, −1 RIR)');
check((await q(`select programacion from semanas where id=$1`, [wAna2]))[0].programacion === 'en_programacion', 'la semana duplicada nace sin publicar');

const bLuis = (await q(`select crear_bloque_desde_plantilla($1, $2, $3) b`, [pl.id, aLuis.id, lunes]))[0].b;
await q(`update semanas set programacion='programada' where bloque_id=$1`, [bLuis]);
await q(`insert into notas_coach (atleta_id, texto) values ($1, 'Vigilar hombro')`, [aAna.id]);

// --- Ana activa su cuenta ---------------------------------------------
console.log('\nAtleta (Ana)');
await como(ana);
check((await q(`select count(*)::int n from atletas`))[0].n === 0, 'antes de canjear el código no ve ninguna ficha');
check((await q(`select canjear_invitacion('xxxx') a`))[0].a === null, 'un código erróneo devuelve null');
const canje = (await q(`select canjear_invitacion($1) a`, [codAna.toLowerCase().replace(/-/g, ' ')]))[0].a;
check(canje === aAna.id, 'canjea su código aunque lo escriba en minúsculas y con espacios');
check(await falla(`select canjear_invitacion($1)`, [codLuis]), 'no puede canjear también el código de otro atleta');

check((await q(`select count(*)::int n from atletas`))[0].n === 1, 've solo su ficha');
check((await q(`select count(*)::int n from bloques`))[0].n === 1, 've solo su bloque (ni el de Luis ni la plantilla)');
check((await q(`select count(*)::int n from semanas`))[0].n === 1, 'no ve la semana 2, que aún no está programada');
check((await q(`select count(*)::int n from notas_coach`))[0].n === 0, 'no ve las notas privadas del coach');
check((await q(`select count(*)::int n from invitaciones`))[0].n === 0, 'no ve las invitaciones');
check((await q(`select count(*)::int n from ejercicios`))[0].n === 2, 've la biblioteca de ejercicios');

const [seAna] = await q(`select se.id from sesion_ejercicios se join sesiones s on s.id=se.sesion_id where s.semana_id=$1 order by se.orden limit 1`, [wAna1.id]);
await q(`insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps, rpe) values ($1, $2, 1, 60, 8, 8), ($1, $2, 2, 62.5, 7, 9)`, [seAna.id, aLuis.id]);
check((await q(`select distinct atleta_id from series`))[0].atleta_id === aAna.id, 'la serie queda a su nombre aunque el cliente mande otro atleta');
await q(`insert into series (sesion_ejercicio_id, numero, kg, reps, rpe, atleta_id) values ($1, 2, 62.5, 8, 9, $2)
         on conflict (sesion_ejercicio_id, numero) do update set reps = excluded.reps`, [seAna.id, aAna.id]);
check((await q(`select reps from series where numero=2`))[0].reps === 8, 'reenviar una serie (sin cobertura) la actualiza sin duplicarla');

const [ses] = await q(`select id from sesiones where semana_id=$1`, [wAna1.id]);
await q(`update sesiones set completada=true, fecha_realizada=current_date, nota_atleta='Bien' where id=$1`, [ses.id]);
check((await q(`select completada from sesiones where id=$1`, [ses.id]))[0].completada === true, 'marca su sesión como completada');
check(await falla(`update sesiones set nombre='Me la invento' where id=$1`, [ses.id]), 'no puede cambiar la prescripción');
check(await falla(`update perfiles set rol='coach' where id=$1`, [ana]), 'no puede hacerse coach');

check(await falla(`insert into pesos (atleta_id, kg) values ($1, 61.2)`, [aAna.id]), 'sin consentimiento de salud no puede guardar su peso');
await q(`insert into consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', '2026-10'), ($1, 'privacidad', '2026-10')`, [ana]);
await q(`insert into pesos (atleta_id, fecha, kg) values ($1, current_date - 7, 61.6), ($1, current_date, 61.2)`, [aAna.id]);
await q(`insert into checkins (atleta_id, semana_inicio, horas_sueno, energia, motivacion) values ($1, $2, '7-8', 4, 5)`, [aAna.id, lunes]);
await q(`insert into molestias (atleta_id, semana_inicio, zona, intensidad) values ($1, $2, 'hombros', 2)`, [aAna.id, lunes]);
check((await q(`select count(*)::int n from pesos`))[0].n === 2, 'con consentimiento guarda peso, check-in y molestias');
check(await falla(`update consentimientos set version='trampa' where perfil_id=$1`, [ana]), 'un consentimiento no se puede reescribir, solo revocar');

// --- Luis intenta mirar lo de Ana --------------------------------------
console.log('\nOtro atleta (Luis)');
await como(luis);
await q(`select canjear_invitacion($1)`, [codLuis]);
check((await q(`select count(*)::int n from series`))[0].n === 0, 'no ve las series de Ana');
check((await q(`select count(*)::int n from pesos`))[0].n === 0, 'no ve el peso de Ana');
check(await falla(`insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps) values ($1, $2, 3, 100, 1)`, [seAna.id, aLuis.id]),
      'no puede escribir series en la sesión de Ana');
check((await q(`update sesiones set completada=false where id=$1 returning id`, [ses.id])).length === 0, 'no puede tocar la sesión de Ana');

// --- Cuenta sin invitación --------------------------------------------
console.log('\nCuenta sin código válido');
await como(intruso);
check((await q(`select count(*)::int n from atletas`))[0].n === 0, 'no ve ningún atleta');
check((await q(`select canjear_invitacion($1) a`, [codAna]))[0].a === null, 'un código ya usado no vale');
for (let i = 0; i < 4; i++) await q(`select canjear_invitacion('FBE-AAAAA-AAAAA')`);
check(await falla(`select canjear_invitacion('FBE-BBBBB-BBBBB')`), 'tras 5 intentos fallidos se bloquea una hora');
check(await falla(`select crear_invitacion($1)`, [aAna.id]), 'no puede crear invitaciones');

// --- Sin sesión ---------------------------------------------------------
console.log('\nSin sesión (anon)');
await anon();
check(await falla(`select * from atletas`), 'no puede leer ninguna tabla');
check(await falla(`select canjear_invitacion('x')`), 'no puede canjear códigos');

// --- Vistas ---------------------------------------------------------------
console.log('\nVistas');
await como(pelayo);
const res = await q(`select * from v_resumen_atletas order by nombre`);
const rAna = res.find(r => r.nombre === 'Ana');
check(res.length === 2, 'el coach ve la tarjeta de resumen de todos');
check(rAna.semana_numero === 1 && Number(rAna.completadas) === 1 && Number(rAna.sesiones_total) === 1, 'resumen: semana 1, 1/1 sesiones hechas');
check(Number(rAna.peso_kg) === 61.2 && Number(rAna.peso_cambio_kg) === -0.4, 'resumen: 61,2 kg (−0,4)');
check(rAna.horas_sueno === '7-8' && rAna.motivacion === 5 && rAna.max_molestia === 2, 'resumen: sueño, motivación y molestia máxima');
const e1 = await q(`select e1rm_kg::float e from v_e1rm_semanal`);
check(e1.length === 1 && e1[0].e === 81.3, `e1RM ajustado por RPE (62,5 × 8 @9 → ${e1[0]?.e} kg)`);
const vol = Object.fromEntries((await q(`select grupo, series::float n from v_series_por_grupo`)).map(v => [v.grupo, v.n]));
check(vol.pectoral === 2 && vol.triceps === 1 && vol.deltoides === 1, 'series semanales por grupo: 2 directas de pectoral; tríceps y deltoides cuentan 0,5');
const seed = new URL('../supabase/seed_ejercicios.sql', import.meta.url);
if (existsSync(seed)) {
  await su();
  await db.exec(readFileSync(seed, 'utf8'));
  await db.exec(readFileSync(seed, 'utf8'));
  check((await q(`select count(*)::int n from ejercicios`))[0].n === 148, 'la biblioteca de Notion se carga una vez y no duplica al repetirla (Press banca y Remo con barra ya existían)');
  const alt = await q(`select (select count(*)::int from ejercicios where alternativas <> '{}') n,
                              (select array_agg(x.nombre) from ejercicios e join ejercicios x on x.id = any(e.alternativas) where e.nombre = 'Sentadilla barra alta') sent,
                              (select count(*)::int from ejercicios where errores is not null and tipo <> '{}') ricos`);
  check(alt[0].n >= 130 && alt[0].sent.includes('Sentadilla frontal') && alt[0].ricos === 148,
        `con sus alternativas equivalentes (${alt[0].n} ejercicios), errores comunes y tipo`);
  await como(pelayo);
}
await como(ana);
check((await q(`select count(*)::int n from v_resumen_atletas`))[0].n === 1, 'la atleta solo ve su propio resumen');

// =====================================================================
// Migración 002
// =====================================================================
console.log('\nBiblioteca ampliada y alternativas');
await como(pelayo);
const [dom] = await q(`insert into ejercicios (nombre, grupos_musculares, tipo, alternativas) values ('Dominadas', '{espalda,biceps}', '{basico,multiarticular}', array[$1]::uuid[]) returning id, tipo`, [remo.id]);
check(dom.tipo.length === 2, 'guarda el tipo del ejercicio (básico, multiarticular)');
check(await falla(`insert into ejercicios (nombre, tipo) values ('X', '{inventado}')`), 'rechaza tipos de ejercicio inventados');
await como(ana);
await q(`insert into series (sesion_ejercicio_id, numero, kg, reps, rpe, sustituto_id) values ($1, 3, 50, 1, 10, $2)`, [seAna.id, dom.id]);
const e1sus = await q(`select ejercicio_id, e1rm_kg::float e from v_e1rm_semanal where ejercicio_id = $1`, [dom.id]);
check(e1sus.length === 1 && e1sus[0].e === 50, 'una serie hecha con la alternativa cuenta para la alternativa (y 1 rep @10 = su carga)');

console.log('\nRevisión del coach');
await su();
check((await q(`select revisada_en from sesiones where id = $1`, [ses.id]))[0].revisada_en === null, 'la sesión que hizo Ana queda pendiente de revisar');
await como(ana);
await q(`update sesiones set revisada_en = now() where id = $1`, [ses.id]);
await su();
check((await q(`select revisada_en from sesiones where id = $1`, [ses.id]))[0].revisada_en === null, 'ella no puede darla por revisada');
await como(ana);
await q(`insert into checkins (atleta_id, semana_inicio, energia, revisado_en) values ($1, $2::date - 7, 3, now())`, [aAna.id, lunes]);
await su();
check((await q(`select revisado_en from checkins where atleta_id = $1 and semana_inicio = $2::date - 7`, [aAna.id, lunes]))[0].revisado_en === null, 'un check-in nuevo nace pendiente aunque el cliente diga lo contrario');

console.log('\nComentarios');
await como(ana);
const [c1] = await q(`insert into comentarios (atleta_id, sesion_id, autor, texto) values ($1, $2, 'coach', 'Me ha costado la última serie') returning *`, [aLuis.id, ses.id]);
check(c1.autor === 'atleta' && c1.atleta_id === aAna.id, 'el autor y la atleta los fija la base de datos, no el cliente');
const [semOculta] = await (async () => { await su(); return q(`select s.id from sesiones s where s.semana_id = $1 limit 1`, [wAna2]); })();
await como(ana);
check(await falla(`insert into comentarios (sesion_id, texto, atleta_id) values ($1, 'hola', $2)`, [semOculta.id, aAna.id]), 'no puede comentar una sesión que aún no se le ha publicado');
await como(luis);
check(await falla(`insert into comentarios (sesion_id, texto, atleta_id) values ($1, 'cotilleo', $2)`, [ses.id, aLuis.id]), 'Luis no puede comentar en la sesión de Ana');
check((await q(`select count(*)::int n from comentarios`))[0].n === 0, 'Luis no ve los comentarios de Ana');
await como(pelayo);
const [c2] = await q(`insert into comentarios (sesion_id, texto) values ($1, 'Normal, era la serie más pesada. Mantén la carga.') returning *`, [ses.id]);
check(c2.autor === 'coach' && c2.atleta_id === aAna.id, 'el coach responde en la misma sesión');
check((await q(`select revisada_en from sesiones where id = $1`, [ses.id]))[0].revisada_en !== null, 'al comentar, la sesión queda revisada');
await q(`update comentarios set leido_en = now() where id = $1`, [c1.id]);
check((await q(`select leido_en from comentarios where id = $1`, [c1.id]))[0].leido_en !== null, 'el coach marca como leído lo que escribió la atleta');
await como(ana);
await q(`update comentarios set leido_en = now() where id = $1`, [c2.id]);
check((await q(`select leido_en from comentarios where id = $1`, [c2.id]))[0].leido_en !== null, 'la atleta marca como leída la respuesta del coach');
check(await falla(`update comentarios set texto = 'otra cosa' where id = $1`, [c2.id]), 'nadie reescribe un comentario desde la app');
check((await q(`delete from comentarios where id = $1 returning id`, [c2.id])).length === 0, 'la atleta no puede borrar lo que escribió el coach');
check((await q(`delete from comentarios where id = $1 returning id`, [c1.id])).length === 1, 'pero sí lo suyo');

console.log('\nRecursos');
await como(pelayo);
await q(`insert into recursos (titulo, categoria) values ('Guía de técnica de sentadilla', 'tecnica')`);
await q(`insert into recursos (titulo, atleta_id) values ('Plan de Luis', $1)`, [aLuis.id]);
await como(ana);
const recAna = await q(`select titulo from recursos`);
check(recAna.length === 1 && recAna[0].titulo.startsWith('Guía'), 'la atleta ve los recursos generales, no los personales de otro');
check(await falla(`insert into recursos (titulo) values ('spam')`), 'no puede crear recursos');
await como(intruso);
check((await q(`select count(*)::int n from recursos`))[0].n === 0, 'una cuenta sin vincular no ve recursos');

console.log('\nVídeos y fotos (tabla y Storage)');
await su();
check((await q(`select public from storage.buckets where id = 'archivos'`))[0]?.public === false, 'el bucket de archivos es privado');
await como(ana);
const ruta = `${aAna.id}/sentadilla-1.mp4`;
const [vid] = await q(`insert into archivos (atleta_id, tipo, ruta, sesion_ejercicio_id, revisado_en, comentario_coach) values ($1, 'video_tecnica', $2, $3, now(), 'trampa') returning *`, [aAna.id, ruta, seAna.id]);
check(vid.revisado_en === null && vid.comentario_coach === null, 'sube su vídeo; no puede darlo por revisado ni comentarlo como coach');
check(await falla(`insert into archivos (atleta_id, tipo, ruta) values ($1, 'video_tecnica', $2)`, [aAna.id, `${aLuis.id}/x.mp4`]), 'no puede registrar un archivo fuera de su carpeta');
await q(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [ruta]);
check(await falla(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [`${aLuis.id}/x.mp4`]), 'Storage: no puede subir a la carpeta de otro atleta');
await como(luis);
check(await falla(`insert into archivos (atleta_id, tipo, ruta) values ($1, 'foto_progreso', $2)`, [aLuis.id, `${aLuis.id}/f.jpg`]), 'sin consentimiento de salud no puede subir fotos de progreso');
check((await q(`select count(*)::int n from archivos`))[0].n === 0 && (await q(`select count(*)::int n from storage.objects`))[0].n === 0, 'Luis no ve los vídeos de Ana');
await como(pelayo);
check((await q(`select count(*)::int n from storage.objects`))[0].n === 1, 'el coach ve todos los archivos');
await q(`insert into comentarios (archivo_id, texto) values ($1, 'Rodillas bien; baja un poco más')`, [vid.id]);
check((await q(`select revisado_en from archivos where id = $1`, [vid.id]))[0].revisado_en !== null, 'al comentar el vídeo queda revisado');
await anon();
check(await falla(`select * from comentarios`), 'sin sesión no se leen comentarios');

console.log('\nMarcas');
await como(ana);
const [m1] = await q(`insert into marcas (atleta_id, ejercicio_id, kg, reps) values ($1, $2, 70, 1) returning id`, [aAna.id, press.id]);
check((await q(`delete from marcas where id = $1 returning id`, [m1.id])).length === 1, 'puede borrar una marca que apuntó mal');

console.log('\nVerificación en dos pasos del coach');
await su();
await q(`insert into auth.mfa_factors (user_id, status) values ($1, 'unverified')`, [pelayo]);
await como(pelayo, 'aal1');
check((await q(`select count(*)::int n from atletas`))[0].n === 2, 'con un factor sin verificar sigue entrando como siempre');
await su();
await q(`update auth.mfa_factors set status = 'verified' where user_id = $1`, [pelayo]);
await como(pelayo, 'aal1');
check((await q(`select count(*)::int n from atletas`))[0].n === 0, 'con la verificación activada, sin el segundo paso no ve ningún dato');
check(await falla(`select crear_invitacion($1)`, [aAna.id]), 'ni puede crear invitaciones');
await como(pelayo, 'aal2');
check((await q(`select count(*)::int n from atletas`))[0].n === 2, 'con el código verificado (aal2) vuelve a tener acceso de coach');
await como(ana, 'aal1');
check((await q(`select count(*)::int n from atletas`))[0].n === 1, 'a los atletas no les afecta');

// =====================================================================
// Migración 003: revisión de seguridad
// =====================================================================
const mensaje = async (sql, params = []) => { try { await db.query(sql, params); return null; } catch (e) { return e.message; } };

console.log('\nStorage solo acepta archivos registrados');
await como(luis);
check(await falla(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [`${aLuis.id}/foto-a-escondidas.jpg`]), 'sin registrarla en archivos (y sin consentimiento) no puede subir una foto a Storage');
await como(ana);
check(await falla(`insert into storage.objects (bucket_id, name) select 'archivos', $1 || '/basura-' || g || '.mp4' from generate_series(1, 50) g`, [aAna.id]), 'no puede llenar su carpeta con archivos sin registrar');
check(await falla(`insert into archivos (atleta_id, tipo, ruta) values ($1, 'video_tecnica', $2)`, [aAna.id, `${aAna.id}/../${aLuis.id}/x.mp4`]), 'una ruta con «..» no se registra');
check(await falla(`insert into archivos (atleta_id, tipo, ruta) values ($1, 'video_tecnica', $2)`, [aAna.id, `${aAna.id}/sub/x.mp4`]), 'ni con subcarpetas');
check(await falla(`insert into archivos (atleta_id, tipo, ruta) values ($1, 'video_tecnica', $2)`, [aAna.id, ruta]), 'ni dos veces la misma ruta');
const yaHoy = (await q(`select count(*)::int n from archivos where atleta_id = $1`, [aAna.id]))[0].n;
await q(`insert into archivos (atleta_id, tipo, ruta) select $1::uuid, 'video_tecnica', $1::text || '/v-' || g || '.mp4' from generate_series(1, $2::int) g`, [aAna.id, 30 - yaHoy]);
check(await falla(`insert into archivos (atleta_id, tipo, ruta) values ($1, 'video_tecnica', $2)`, [aAna.id, `${aAna.id}/v-31.mp4`]), 'como mucho 30 archivos en 24 horas');
await su();
await q(`delete from archivos where ruta like $1`, [`${aAna.id}/v-%`]);

console.log('\nConsentimientos que no se pueden falsear');
await como(luis);
const [cLuis] = await q(`insert into consentimientos (perfil_id, tipo, version, aceptado_en, revocado_en) values ($1, 'datos_salud', '2026-10', '2020-01-01', '2020-02-01') returning *`, [luis]);
check(new Date(cLuis.aceptado_en).getFullYear() >= 2026 && cLuis.revocado_en === null, 'la fecha de aceptación la pone la base, no el cliente');
check(await falla(`insert into consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', 'v-falsa')`, [luis]), 'solo se acepta la versión vigente del texto');
check(await falla(`insert into consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', '2026-10')`, [ana]), 'nadie da el consentimiento por otra persona');
await q(`update consentimientos set revocado_en = '2000-01-01' where id = $1`, [cLuis.id]);
const rev = (await q(`select revocado_en from consentimientos where id = $1`, [cLuis.id]))[0].revocado_en;
check(new Date(rev).getFullYear() >= 2026 && (await q(`select tiene_consentimiento_salud() c`))[0].c === false, 'revocar queda con la fecha real y retira el permiso');
check(await falla(`update consentimientos set revocado_en = null where id = $1`, [cLuis.id]), 'un consentimiento revocado no se puede reactivar');
check((await q(`select tiene_consentimiento_salud() c`))[0].c === false, 'y sigue sin consentimiento');

console.log('\nLas respuestas del coach no se pierden');
await q(`insert into consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', '2026-10')`, [luis]);
const [ckLuis] = await q(`insert into checkins (atleta_id, semana_inicio, energia) values ($1, $2, 3) returning id`, [aLuis.id, lunes]);
await como(pelayo, 'aal2');
await q(`insert into comentarios (checkin_id, texto) values ($1, 'Cuidado con la rodilla: baja el volumen de pierna')`, [ckLuis.id]);
await como(luis);
check((await q(`delete from checkins where id = $1 returning id`, [ckLuis.id])).length === 1, 'el atleta puede borrar su check-in');
await su();
check((await q(`select count(*)::int n from comentarios where atleta_id = $1 and autor = 'coach' and checkin_id is null`, [aLuis.id]))[0].n === 1, 'pero la respuesta del coach se queda (sin el enlace al check-in)');
await como(ana);
await q(`delete from archivos where id = $1`, [vid.id]);
await su();
check((await q(`select count(*)::int n from comentarios where texto like 'Rodillas bien%' and archivo_id is null`))[0].n === 1, 'igual si borra un vídeo comentado');

console.log('\nNada se revela sobre lo ajeno');
await como(intruso);
check((await q(`select atleta_de_sesion($1) a`, [ses.id]))[0].a === null, 'una cuenta cualquiera no averigua de quién es una sesión');
check((await q(`select count(*)::int n from ejercicios`))[0].n === 0, 'una cuenta sin vincular no ve la biblioteca');
await su();
const [ckLuis2] = await q(`insert into checkins (atleta_id, semana_inicio) values ($1, $2::date - 21) returning id`, [aLuis.id, lunes]);
await como(ana);
const ajeno = await mensaje(`insert into comentarios (checkin_id, texto) values ($1, 'x')`, [ckLuis2.id]);
const inexistente = await mensaje(`insert into comentarios (checkin_id, texto) values (gen_random_uuid(), 'x')`);
check(ajeno && ajeno === inexistente, 'comentar algo ajeno da el mismo error que algo que no existe');

console.log('\nAtleta de baja');
await como(pelayo, 'aal2');
await q(`update atletas set estado = 'baja' where id = $1`, [aAna.id]);
await como(ana);
check((await q(`select count(*)::int n from series`))[0].n > 0, 've sus datos');
check(await falla(`insert into series (sesion_ejercicio_id, numero, kg, reps) values ($1, 9, 50, 5)`, [seAna.id]), 'no registra series');
check(await falla(`update series set reps = 1 where atleta_id = $1`, [aAna.id]), 'ni cambia las que tiene');
check(await falla(`insert into comentarios (sesion_id, texto) values ($1, 'sigo aquí')`, [ses.id]), 'ni escribe comentarios');
check(await falla(`insert into archivos (atleta_id, tipo, ruta) values ($1, 'video_tecnica', $2)`, [aAna.id, `${aAna.id}/tras-baja.mp4`]), 'ni registra archivos');
check(await falla(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [`${aAna.id}/tras-baja.mp4`]), 'ni sube nada a Storage');
check((await q(`update consentimientos set revocado_en = now() where perfil_id = $1 and tipo = 'datos_salud' returning id`, [ana])).length === 1, 'pero sí puede revocar sus consentimientos');
await como(pelayo, 'aal2');
await q(`update atletas set estado = 'activo' where id = $1`, [aAna.id]);
await como(ana);
check(await falla(`insert into pesos (atleta_id, kg) values ($1, 60)`, [aAna.id]), 'de vuelta de alta, sin consentimiento de salud sigue sin poder guardar su peso');

console.log('\nVolumen objetivo');
await como(pelayo, 'aal2');
await q(`update atletas set volumen_objetivo = '{"pectoral": [12, 18]}' where id = $1`, [aAna.id]);
check(await falla(`update atletas set volumen_objetivo = '[10, 20]' where id = $1`, [aAna.id]), 'el coach lo guarda por músculo (un objeto, no una lista)');
await como(ana);
check((await q(`select volumen_objetivo from atletas`))[0].volumen_objetivo.pectoral[0] === 12, 'la atleta ve su rango');
check((await q(`update atletas set volumen_objetivo = null where id = $1 returning id`, [aAna.id])).length === 0, 'pero no puede cambiarlo');

// =====================================================================
// Migración 004
// =====================================================================
console.log('\nNotas fijadas por ejercicio');
await como(ana);
const [nf] = await q(`insert into notas_ejercicio (atleta_id, ejercicio_id, texto) values ($1, $2, 'Banco en el 3') returning *`, [aAna.id, press.id]);
check(nf.texto === 'Banco en el 3', 'la atleta guarda una nota en su press banca');
check(await falla(`insert into notas_ejercicio (atleta_id, ejercicio_id, texto) values ($1, $2, 'otra')`, [aAna.id, press.id]), 'una sola nota por ejercicio (se edita, no se duplica)');
await q(`update notas_ejercicio set texto = 'Banco en el 4' where id = $1`, [nf.id]);
check((await q(`select texto from notas_ejercicio where id = $1`, [nf.id]))[0].texto === 'Banco en el 4', 'y la cambia');
check(await falla(`insert into notas_ejercicio (atleta_id, ejercicio_id, texto) values ($1, $2, 'cuela')`, [aLuis.id, remo.id]), 'no puede escribir notas a nombre de otro');
await como(luis);
check((await q(`select count(*)::int n from notas_ejercicio`))[0].n === 0, 'Luis no ve las notas de Ana');
await como(pelayo, 'aal2');
check((await q(`select count(*)::int n from notas_ejercicio`))[0].n === 1, 'el coach las ve');

console.log('\nRespuestas guardadas');
await q(`insert into respuestas_guardadas (titulo, texto) values ('Buena semana', 'Muy bien, {nombre}. Seguimos así.')`);
await como(ana);
check((await q(`select count(*)::int n from respuestas_guardadas`))[0].n === 0 && await falla(`insert into respuestas_guardadas (titulo, texto) values ('x', 'y')`), 'los atletas ni las ven ni las crean');

// =====================================================================
// Migración 005
// =====================================================================
console.log('\n¿Cómo llegas hoy? (migración 005)');
await como(luis);
const [sLuis] = await q(`select id from sesiones order by orden limit 1`);
const prep = '{"sueno": 1, "energia": 2, "molestias": 3}';
check((await q(`update sesiones set preparacion = $1::jsonb where id = $2 returning preparacion`, [prep, sLuis.id]))[0].preparacion.sueno === 1, 'Luis, con consentimiento de salud, guarda cómo llega a su sesión');
check(await falla(`update sesiones set preparacion = '{"sueno": 4, "energia": 2, "molestias": 3}' where id = $1`, [sLuis.id]), 'solo valores de 1 a 3');
check(await falla(`update sesiones set preparacion = '{"sueno": 1, "energia": 2}' where id = $1`, [sLuis.id]), 'con las tres respuestas');
check(await falla(`update sesiones set preparacion = '{"sueno": 1, "energia": 2, "molestias": 3, "nota": "dolor de rodilla"}' where id = $1`, [sLuis.id]), 'y nada más: no cabe texto libre');
check(await falla(`update sesiones set preparacion = '{"sueno": "1", "energia": 2, "molestias": 3}' where id = $1`, [sLuis.id]), 'números, no textos');
check(await falla(`update sesiones set preparacion = '[1, 2, 3]' where id = $1`, [sLuis.id]), 'ni una lista');
check((await q(`update sesiones set preparacion = $1::jsonb where id = $2 returning id`, [prep, ses.id])).length === 0, 'no puede escribirla en la sesión de Ana');
await como(ana);
check(await falla(`update sesiones set preparacion = $1::jsonb where id = $2`, [prep, ses.id]), 'Ana, que revocó su consentimiento de salud, no puede guardarla');
check((await q(`update sesiones set preparacion = null, nota_atleta = 'Bien' where id = $1 returning id`, [ses.id])).length === 1, 'pero sí dejarla vacía y seguir usando su sesión');
await como(pelayo, 'aal2');
check((await q(`select preparacion from sesiones where id = $1`, [sLuis.id]))[0].preparacion.energia === 2, 'el coach la ve');
check(await falla(`update sesiones set preparacion = $1::jsonb where id = $2`, [prep, ses.id]), 'ni el coach puede ponérsela a Ana sin su consentimiento de salud');
check(await falla(`insert into sesiones (semana_id, orden, nombre, preparacion) values ($1, 99, 'Con preparación', $2::jsonb)`, [pw.id, prep]), 'ni crear una sesión (de plantilla) que ya la traiga');
check((await q(`update sesiones set preparacion = null where id = $1 returning id`, [sLuis.id])).length === 1, 'vaciarla se puede siempre');
await como(luis);
check((await q(`select consentimiento_salud_de_semana(semana_id) c from sesiones where id = $1`, [sLuis.id]))[0].c === true, 'la función de consentimiento responde a Luis sobre lo suyo');
check((await q(`select consentimiento_salud_de_semana($1::uuid) c`, [wAna1.id]))[0].c === false, 'pero no revela nada de Ana');
await anon();
check(await falla(`select consentimiento_salud_de_semana($1::uuid)`, [wAna1.id]), 'y sin sesión ni se puede llamar');
await como(pelayo, 'aal2');

// =====================================================================
// Migración 006
// =====================================================================
console.log('\nAvisos del coach (migración 006)');
await como(pelayo, 'aal2');
await q(`insert into avisos (texto) values ('Del 3 al 9 respondo más tarde')`);
await q(`insert into avisos (texto, atleta_id) values ('Ana: esta semana, test de press', $1)`, [aAna.id]);
await q(`insert into avisos (texto, desde) values ('Aún no', current_date + 3)`);
await q(`insert into avisos (texto, desde, hasta) values ('Ya pasó', current_date - 10, current_date - 1)`);
check(await falla(`insert into avisos (texto, desde, hasta) values ('Al revés', current_date, current_date - 1)`), 'un aviso no puede acabar antes de empezar');
check(await falla(`insert into avisos (texto) values ('   ')`), 'ni estar vacío');
check(await falla(`insert into avisos (texto) values (E'\\n\\t ')`) && await falla(`insert into avisos (texto) values (E'\\u00a0\\u200b')`), 'ni ser solo saltos de línea, espacios duros o invisibles');
check(await falla(`insert into avisos (texto) values ('x' || repeat(' ', 700))`), 'ni pasar de 600 caracteres rellenando con espacios');
check(await falla(`insert into avisos (texto, hasta) values ('Para siempre', '10000-01-01')`), 'ni llevar fechas absurdas');
check((await q(`select count(*)::int n from avisos`))[0].n === 4, 'el coach ve todos los suyos');
await como(ana);
const avAna = (await q(`select texto from avisos order by texto`)).map((x) => x.texto);
check(avAna.length === 2 && avAna.includes('Ana: esta semana, test de press'), 'Ana ve el general y el suyo, solo los que están en vigor');
check(await falla(`insert into avisos (texto) values ('Me lo invento')`), 'no puede crear avisos');
check((await q(`update avisos set texto = 'cambiado' returning id`)).length === 0 && (await q(`delete from avisos returning id`)).length === 0, 'ni cambiarlos ni borrarlos');
await como(luis);
check((await q(`select texto from avisos`)).map((x) => x.texto).join() === 'Del 3 al 9 respondo más tarde', 'Luis solo ve el general');
await como(intruso);
check((await q(`select count(*)::int n from avisos`))[0].n === 0, 'una cuenta sin vincular a ninguna ficha no ve ninguno');
await anon();
check(await falla(`select count(*) from avisos`), 'sin sesión no se pueden leer');
await como(pelayo, 'aal2');

// =====================================================================
// Migración 007
// =====================================================================
console.log('\nObjetivos de fuerza (migración 007)');
await como(pelayo, 'aal2');
const [obF] = await q(`insert into objetivos (atleta_id, titulo, ejercicio_id, kg_objetivo, reps_objetivo, e1rm_inicio) values ($1, 'Press 70 × 1', $2, 70, 1, 61.5) returning *`, [aAna.id, press.id]);
check(obF.ejercicio_id === press.id && Number(obF.kg_objetivo) === 70 && obF.creado_en, 'el coach enlaza un objetivo a un ejercicio con su marca y su fecha de alta');
check(await falla(`insert into objetivos (atleta_id, titulo, ejercicio_id) values ($1, 'Sin marca', $2)`, [aAna.id, press.id]), 'con ejercicio hace falta la marca');
check(await falla(`insert into objetivos (atleta_id, titulo, ejercicio_id, kg_objetivo, reps_objetivo) values ($1, 'Absurdo', $2, 5000, 1)`, [aAna.id, press.id]) && await falla(`insert into objetivos (atleta_id, titulo, ejercicio_id, kg_objetivo, reps_objetivo) values ($1, 'Cero', $2, 60, 0)`, [aAna.id, press.id]), 'cargas y repeticiones razonables');
check(await falla(`insert into objetivos (atleta_id, titulo, ejercicio_id, kg_objetivo, reps_objetivo) values ($1, 'Quince', $2, 60, 15)`, [aAna.id, press.id]), 'como mucho 12 repeticiones (más allá el 1RM estimado no vale)');
const [obM] = await q(`insert into objetivos (atleta_id, titulo, kg_objetivo, reps_objetivo, e1rm_inicio) values ($1, 'Manual', 60, 3, 50) returning *`, [aAna.id]);
check(obM.kg_objetivo === null && obM.reps_objetivo === null && obM.e1rm_inicio === null, 'sin ejercicio no se guarda marca: queda como objetivo manual');
const [bulg] = await q(`insert into ejercicios (nombre, grupos_musculares) values ('Sentadilla búlgara', '{cuadriceps,gluteo}') returning id`);
const [obB] = await q(`insert into objetivos (atleta_id, titulo, ejercicio_id, kg_objetivo, reps_objetivo, e1rm_inicio) values ($1, 'Búlgara 30 × 8', $2, 30, 8, 30) returning id`, [aAna.id, bulg.id]);
await q(`delete from ejercicios where id = $1`, [bulg.id]);
const obB2 = (await q(`select * from objetivos where id = $1`, [obB.id]))[0];
check(obB2 && obB2.ejercicio_id === null && obB2.kg_objetivo === null && obB2.reps_objetivo === null, 'si se borra el ejercicio, el objetivo sigue como manual y sin restos de la marca');
await su();
await q(`alter table objetivos drop constraint objetivos_marca_valida`);
const [obViejo] = await q(`insert into objetivos (atleta_id, titulo, ejercicio_id, kg_objetivo, reps_objetivo) values ($1, 'De una versión anterior', $2, 60, 20) returning id`, [aAna.id, press.id]);
// Repetir la 007 con la 008 ya puesta: como dice la guardia, se borra antes su apunte y después se repiten las siguientes
await q(`delete from fbe_migraciones where numero > 7`);
await db.exec(readFileSync(new URL('../supabase/migraciones/007_objetivos_fuerza.sql', import.meta.url), 'utf8'));
for (const m of migraciones().filter((m) => m > '007')) await db.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
const viejo = (await q(`select * from objetivos where id = $1`, [obViejo.id]))[0];
check(viejo.ejercicio_id === null && viejo.reps_objetivo === null && (await q(`select count(*)::int n from pg_constraint where conname = 'objetivos_marca_valida'`))[0].n === 1, 'al repetir la migración se aplica la restricción nueva y lo que no cumple queda como manual');
check((await q(`select confdeltype from pg_constraint where conname = 'objetivos_ejercicio_id_fkey'`))[0]?.confdeltype === 'n', 'la clave al ejercicio pone null al borrarlo (y se vuelve a crear al repetir)');
await q(`delete from objetivos where id in ($1, $2, $3)`, [obM.id, obB.id, obViejo.id]);
await como(pelayo, 'aal2');
await como(ana);
check((await q(`select kg_objetivo, reps_objetivo from objetivos where id = $1`, [obF.id]))[0]?.reps_objetivo === 1, 'Ana ve su objetivo con la marca');
check((await q(`update objetivos set kg_objetivo = 40 where id = $1 returning id`, [obF.id])).length === 0, 'pero no puede rebajarla');
await como(luis);
check((await q(`select count(*)::int n from objetivos where id = $1`, [obF.id]))[0].n === 0, 'Luis no ve los objetivos de Ana');
await como(pelayo, 'aal2');

// =====================================================================
// Migración 008
// =====================================================================
console.log('\nHábitos diarios (migración 008)');
await como(pelayo, 'aal2');
const [hPasos] = await q(`insert into habitos (atleta_id, nombre, tipo, objetivo, unidad, icono, dias_semana) values ($1, 'Pasos', 'numero', 8000, 'pasos', 'pasos', 6) returning *`, [aLuis.id]);
const [hMov] = await q(`insert into habitos (atleta_id, nombre, tipo, icono) values ($1, '10 min de movilidad', 'si_no', 'movilidad') returning *`, [aLuis.id]);
const [hAna] = await q(`insert into habitos (atleta_id, nombre, tipo, objetivo, unidad, icono) values ($1, 'Proteína', 'numero', 120, 'g', 'proteina') returning *`, [aAna.id]);
check(hPasos.dias_semana === 6 && hMov.objetivo === null && hMov.sentido === 'al_menos', 'el coach pone hábitos con objetivo numérico o de sí/no');
const habitoMalo = async (cols, vals) => falla(`insert into habitos (atleta_id, ${cols}) values ($1, ${vals})`, [aLuis.id]);
check(await habitoMalo(`nombre, tipo, objetivo`, `'Movilidad', 'si_no', 1`) && await habitoMalo(`nombre, tipo`, `'Pasos', 'numero'`), 'los de sí/no no llevan objetivo y los numéricos sí');
check(await habitoMalo(`nombre, tipo`, `'   ', 'si_no'`) && await habitoMalo(`nombre, tipo`, `E'\\u200b', 'si_no'`), 'el nombre tiene que llevar algo visible');
check(await habitoMalo(`nombre, tipo, icono`, `'X', 'si_no', 'cerveza'`) && await habitoMalo(`nombre, tipo, dias_semana`, `'X', 'si_no', 8`) && await habitoMalo(`nombre, tipo, objetivo`, `'X', 'numero', -5`), 'iconos conocidos, de 1 a 7 días y objetivos positivos');
const hoyM = (await q(`select ((now() at time zone 'Europe/Madrid')::date)::text d`))[0].d;
await como(luis);
check((await q(`select count(*)::int n from habitos`))[0].n === 2, 'Luis ve sus hábitos (y no los de Ana)');
check(await falla(`insert into habitos (atleta_id, nombre, tipo) values ($1, 'Mío', 'si_no')`, [aLuis.id]) && (await q(`update habitos set objetivo = 1000 where id = $1 returning id`, [hPasos.id])).length === 0, 'pero no los crea ni los cambia');
const [rP] = await q(`insert into registros_habito (habito_id, atleta_id, fecha, valor) values ($1, $2, $3, 9500) returning *`, [hPasos.id, aAna.id, hoyM]);
check(rP.atleta_id === aLuis.id, 'apunta sus pasos de hoy (el atleta lo pone la base, aunque mande otro)');
await q(`insert into registros_habito (habito_id, fecha, valor) values ($1, $2, 7000) on conflict (habito_id, fecha) do update set valor = excluded.valor`, [hPasos.id, hoyM]);
check(Number((await q(`select valor from registros_habito where habito_id = $1 and fecha = $2`, [hPasos.id, hoyM]))[0].valor) === 7000, 'corregirlo el mismo día lo reemplaza (uno por día)');
check(await falla(`insert into registros_habito (habito_id, fecha, valor) values ($1, $2, 2)`, [hMov.id, hoyM]), 'en uno de sí/no solo vale 1 o 0');
check((await q(`insert into registros_habito (habito_id, fecha, valor) values ($1, $2, 1) returning id`, [hMov.id, hoyM])).length === 1, 'y lo marca como hecho');
check(await falla(`insert into registros_habito (habito_id, fecha, valor) values ($1, ($2::date + 3), 1000)`, [hPasos.id, hoyM]), 'no se apuntan días que no han llegado');
check((await q(`insert into registros_habito (habito_id, fecha, valor) values ($1, ($2::date - 2), 11000) returning id`, [hPasos.id, hoyM])).length === 1, 'sí uno pasado que se le olvidó');
const errAjeno = await (async () => { try { await q(`insert into registros_habito (habito_id, fecha, valor) values ($1, $2, 100)`, [hAna.id, hoyM]); return null; } catch (e) { return e.message; } })();
const errNada = await (async () => { try { await q(`insert into registros_habito (habito_id, fecha, valor) values (gen_random_uuid(), $1, 100)`, [hoyM]); return null; } catch (e) { return e.message; } })();
check(errAjeno && errAjeno === errNada, 'no puede apuntar en un hábito de Ana (mismo error que en uno que no existe)');
await como(ana);
check((await q(`select count(*)::int n from registros_habito`))[0].n === 0, 'Ana no ve lo que apunta Luis');
check(await falla(`insert into registros_habito (habito_id, fecha, valor) values ($1, $2, 130)`, [hAna.id, hoyM]), 'y sin consentimiento de salud no puede apuntar en el suyo');
await como(pelayo, 'aal2');
check((await q(`select count(*)::int n from registros_habito where atleta_id = $1`, [aLuis.id]))[0].n === 3, 'el coach ve lo que apunta Luis');
await q(`update habitos set activo = false where id = $1`, [hMov.id]);
await como(luis);
check(await falla(`insert into registros_habito (habito_id, fecha, valor) values ($1, ($2::date - 1), 1)`, [hMov.id, hoyM]) && (await q(`select count(*)::int n from habitos where not activo`))[0].n === 1, 'un hábito archivado se sigue viendo, pero ya no se apunta');
// Lo que encontró la revisión independiente de la 008
await como(pelayo, 'aal2');
check(/consentimiento/.test(await mensaje(`insert into registros_habito (habito_id, fecha, valor) values ($1, $2, 130)`, [hAna.id, hoyM]) || '')
  && (await q(`insert into registros_habito (habito_id, fecha, valor) values ($1, ($2::date - 3), 8200) returning id`, [hPasos.id, hoyM])).length === 1,
  'el coach tampoco apunta hábitos de quien no ha dado el consentimiento de salud (de Luis, que lo ha dado, sí)');
check(/días apuntados/.test(await mensaje(`update habitos set tipo = 'si_no', objetivo = null, unidad = null where id = $1`, [hPasos.id]) || ''),
  'un hábito con días apuntados no cambia de número a sí/no (9000 pasos no son un «hecho»)');
check((await q(`update habitos set tipo = 'si_no', objetivo = null, unidad = null where id = $1 returning tipo`, [hAna.id]))[0]?.tipo === 'si_no'
  && (await q(`update habitos set tipo = 'numero', objetivo = 120, unidad = 'g' where id = $1 returning tipo`, [hAna.id]))[0]?.tipo === 'numero',
  'sin nada apuntado, sí se puede cambiar');
check(await falla(`update habitos set atleta_id = $1 where id = $2`, [aAna.id, hPasos.id]), 'un hábito no se pasa a otro atleta (sus días apuntados se quedarían con el anterior)');
check(await habitoMalo(`nombre, tipo`, `E'\\u2060\\u3164', 'si_no'`) && await habitoMalo(`nombre, tipo`, `E'\\u00ad\\u2800', 'si_no'`)
  && await habitoMalo(`nombre, tipo, objetivo, unidad`, `'Agua', 'numero', 2, '   '`), 'tampoco valen nombres ni unidades hechos solo de caracteres invisibles');
await anon();
check(await falla(`select count(*) from registros_habito`) && await falla(`select count(*) from habitos`), 'sin sesión no se ve nada');

console.log('\nSerie top + back-off (migración 008)');
await como(pelayo, 'aal2');
const [seBo] = await q(`select se.id from sesion_ejercicios se join sesiones s on s.id = se.sesion_id where s.semana_id = $1 order by s.orden, se.orden limit 1`, [wAna1.id]);
check((await q(`update sesion_ejercicios set backoff_pct = 10, series = 4 where id = $1 returning backoff_pct`, [seBo.id]))[0].backoff_pct !== null, 'el coach marca una serie top y back-offs al −10 %');
check(await falla(`update sesion_ejercicios set backoff_pct = 60 where id = $1`, [seBo.id]) && await falla(`update sesion_ejercicios set series = 1 where id = $1`, [seBo.id]), 'entre el 1 y el 50 %, y con al menos dos series');
const wBo = (await q(`select duplicar_semana($1) w`, [wAna1.id]))[0].w;
check(Number((await q(`select se.backoff_pct from sesion_ejercicios se join sesiones s on s.id = se.sesion_id where s.semana_id = $1 and se.series = 4`, [wBo]))[0]?.backoff_pct) === 10, 'duplicar la semana copia el back-off');
await q(`delete from semanas where id = $1`, [wBo]);
await como(ana);
check((await q(`update sesion_ejercicios set backoff_pct = null where id = $1 returning id`, [seBo.id])).length === 0 || await falla(`update sesion_ejercicios set backoff_pct = null where id = $1`, [seBo.id]), 'el atleta no puede quitarlo');

console.log('\nPose de las fotos (migración 008)');
await como(luis);
check((await q(`insert into archivos (atleta_id, tipo, ruta, pose) values ($1, 'foto_progreso', $2, 'perfil') returning pose`, [aLuis.id, `${aLuis.id}/perfil-1.jpg`]))[0].pose === 'perfil', 'una foto de progreso guarda su pose');
check(await falla(`insert into archivos (atleta_id, tipo, ruta, pose) values ($1, 'foto_progreso', $2, 'lateral')`, [aLuis.id, `${aLuis.id}/p2.jpg`]) && await falla(`insert into archivos (atleta_id, tipo, ruta, pose) values ($1, 'video_tecnica', $2, 'frente')`, [aLuis.id, `${aLuis.id}/v2.mp4`]), 'solo frente, perfil o espalda, y solo en fotos');

console.log('\nPlan de la semana (migración 008)');
await como(pelayo, 'aal2');
const [wL] = await q(`select w.id, w.fecha_inicio::text f from semanas w join sesiones s on s.semana_id = w.id where s.id = $1`, [sLuis.id]);
await q(`update sesiones set revisada_en = now() where id = $1`, [sLuis.id]);
await como(luis);
const miercoles = (await q(`select ($1::date + 2)::text d`, [wL.f]))[0].d;
const plan = await q(`update sesiones set dia_previsto = $1 where id = $2 returning dia_previsto::text d, revisada_en`, [miercoles, sLuis.id]);
check(plan[0]?.d === miercoles && plan[0].revisada_en !== null, 'Luis elige el miércoles para su sesión, y por eso no vuelve a «por revisar»');
check(await falla(`update sesiones set dia_previsto = ($1::date + 9) where id = $2`, [wL.f, sLuis.id]), 'el día tiene que caer en la semana de la sesión');
check((await q(`update sesiones set revisada_en = null where id = $1 returning revisada_en`, [sLuis.id]))[0].revisada_en !== null, 'no puede tocar la revisión aprovechando');
check((await q(`update sesiones set nota_atleta = 'Cambio de día por trabajo' where id = $1 returning revisada_en`, [sLuis.id]))[0].revisada_en === null, 'cambiar otra cosa sí la deja pendiente, como siempre');
await como(ana);
check((await q(`update sesiones set dia_previsto = $1 where id = $2 returning id`, [miercoles, sLuis.id])).length === 0, 'Ana no puede planificar la sesión de Luis');
await como(pelayo, 'aal2');
await q(`update semanas set fecha_inicio = fecha_inicio + 7 where id = $1`, [wL.id]);
check((await q(`select (dia_previsto - $1::date)::int n from sesiones where id = $2`, [miercoles, sLuis.id]))[0].n === 7, 'si el coach mueve la semana, el plan se mueve con ella');
await q(`update semanas set fecha_inicio = fecha_inicio - 7 where id = $1`, [wL.id]);
// Lo que encontró la revisión independiente de la 008
await como(ana);
const lunesL = wL.f;
const errores = [];
for (const [sem, dia] of [[wL.id, '1999-01-01'], [wL.id, lunesL], [null, lunesL]]) {
  errores.push(await mensaje(`insert into sesiones (semana_id, orden, nombre, dia_previsto) values (coalesce($1::uuid, gen_random_uuid()), 50, 'x', $2)`, [sem, dia]));
}
check(errores[0] && errores.every((e) => e === errores[0]), 'Ana no puede sondear las semanas de Luis con el día previsto: ajena con día absurdo, ajena con su lunes y una que no existe dan el mismo error');
const sAnaP = ses; // una sesión de Ana, de su semana publicada
const errMover = [await mensaje(`update sesiones set semana_id = $1, dia_previsto = $2 where id = $3`, [wL.id, lunesL, sAnaP.id]),
  await mensaje(`update sesiones set semana_id = $1, dia_previsto = '1999-01-01' where id = $2`, [wL.id, sAnaP.id])];
check(errMover[0] && errMover[0] === errMover[1] && /Solo el coach/.test(errMover[0]), 'ni moviendo una sesión suya a esa semana: el error es siempre «Solo el coach…»');
await como(luis);
check(await falla(`update sesiones set id = gen_random_uuid() where id = $1`, [sLuis.id]), 'el atleta no puede cambiar el identificador de su sesión');
await q(`update sesiones set dia_previsto = $1 where id = $2`, [miercoles, sLuis.id]);
await como(pelayo, 'aal2');
const [wL2] = await q(`insert into semanas (bloque_id, numero, fecha_inicio) select bloque_id, 98, fecha_inicio + 7 from semanas where id = $1 returning id`, [wL.id]);
const movida = await q(`update sesiones set semana_id = $1 where id = $2 returning dia_previsto`, [wL2.id, sLuis.id]);
check(movida.length === 1 && movida[0].dia_previsto === null, 'si el coach pasa una sesión a otra semana, se le quita el día previsto (en vez de fallar)');
await q(`update sesiones set semana_id = $1 where id = $2`, [wL.id, sLuis.id]);
await q(`delete from semanas where id = $1`, [wL2.id]);
await q(`update sesiones set dia_previsto = null where id = $1`, [sLuis.id]);

console.log('\nSeries en pautas ajenas (migración 008)');
const [seLuis] = await q(`select se.id from sesion_ejercicios se join sesiones s on s.id = se.sesion_id join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id where b.atleta_id = $1 limit 1`, [aLuis.id]);
await como(ana);
const errSerieAjena = await mensaje(`insert into series (sesion_ejercicio_id, numero, kg, reps) values ($1, 1, 50, 5)`, [seLuis.id]);
const errSerieNada = await mensaje(`insert into series (sesion_ejercicio_id, numero, kg, reps) values (gen_random_uuid(), 1, 50, 5)`);
check(errSerieAjena && errSerieAjena === errSerieNada, 'una pauta de Luis da el mismo error que una que no existe');

console.log('\nNutrición (migración 009)');
await como(pelayo, 'aal2');
const [pnL] = await q(`insert into planes_nutricion (atleta_id, desde, modo, fase, ritmo_pct, kcal, proteina_g, carbos_g, grasa_g, kcal_descanso, carbos_descanso_g, grasa_descanso_g, pautas)
  values ($1, $2::date - 7, 'macros', 'perder', -0.5, 2100, 140, 230, 65, 1900, 180, 65, 'Proteína en cada comida') returning *`, [aLuis.id, hoyM]);
check(pnL.kcal === 2100 && pnL.kcal_descanso === 1900, 'el coach pone a Luis un plan con kcal y macros, y días de descanso más bajos');
const planMalo = async (cols, vals) => falla(`insert into planes_nutricion (atleta_id, desde, ${cols}) values ($1, '2026-01-05', ${vals})`, [aLuis.id]);
check(await planMalo(`modo, kcal, proteina_g`, `'macros', 2000, 140`) && await planMalo(`modo, kcal, proteina_g, carbos_g`, `'kcal_proteina', 2000, 140, 200`) && await planMalo(`modo, kcal`, `'sin_contar', 2000`),
  'cada modo con sus cifras: los macros completos, solo kcal y proteína, o ninguna');
check(await planMalo(`modo, fase, ritmo_pct`, `'sin_contar', 'perder', 0.5`) && await planMalo(`modo, kcal, proteina_g`, `'kcal_proteina', 300, 140`)
  && await planMalo(`modo, kcal, proteina_g, kcal_descanso, carbos_g, grasa_g`, `'macros', 2000, 140, 1800, 200, 60`), 'el ritmo con el signo de la fase, kcal razonables y el día de descanso completo');
check(await planMalo(`modo, pautas`, `'sin_contar', E'\\u200b '`), 'las pautas tienen que llevar algo visible');
check(await falla(`insert into planes_nutricion (atleta_id, desde, modo) values ($1, $2::date - 7, 'sin_contar')`, [aLuis.id, hoyM]), 'una versión por día');
check(await falla(`update planes_nutricion set atleta_id = $1 where id = $2`, [aAna.id, pnL.id]), 'un plan no se pasa a otro atleta');
await como(luis);
check((await q(`select count(*)::int n from planes_nutricion`))[0].n === 1, 'Luis ve su plan');
check((await q(`update planes_nutricion set kcal = 3000 where id = $1 returning id`, [pnL.id])).length === 0 && await falla(`insert into planes_nutricion (atleta_id, desde, modo) values ($1, $2, 'sin_contar')`, [aLuis.id, hoyM]), 'pero no lo cambia ni se pone otro');
const [rn] = await q(`insert into registros_nutricion (atleta_id, fecha, kcal, proteina_g, carbos_g, grasa_g) values ($1, $2, 2050, 138.5, 220, 66) returning *`, [aLuis.id, hoyM]);
check(rn.kcal === 2050 && Number(rn.proteina_g) === 138.5 && rn.completo === true, 'apunta los totales de hoy');
await q(`insert into registros_nutricion (atleta_id, fecha, kcal, proteina_g) values ($1, $2, 1900, 120) on conflict (atleta_id, fecha) do update set kcal = excluded.kcal, proteina_g = excluded.proteina_g`, [aLuis.id, hoyM]);
check((await q(`select kcal from registros_nutricion where atleta_id = $1 and fecha = $2`, [aLuis.id, hoyM]))[0].kcal === 1900, 'corregirlo el mismo día lo reemplaza (uno por día)');
check(await falla(`insert into registros_nutricion (atleta_id, fecha, kcal) values ($1, $2::date + 3, 2000)`, [aLuis.id, hoyM]), 'no se apuntan días que no han llegado');
check(await falla(`insert into registros_nutricion (atleta_id, fecha) values ($1, $2::date - 1)`, [aLuis.id, hoyM]) && await falla(`insert into registros_nutricion (atleta_id, fecha, kcal) values ($1, $2::date - 1, 20000)`, [aLuis.id, hoyM])
  && await falla(`insert into registros_nutricion (atleta_id, fecha, cumplido) values ($1, $2::date - 1, 3)`, [aLuis.id, hoyM]), 'un registro dice algo, con cifras razonables (y sí/casi/no es 2/1/0)');
check((await q(`insert into registros_nutricion (atleta_id, fecha, cumplido, completo) values ($1, $2::date - 1, 2, false) returning cumplido`, [aLuis.id, hoyM]))[0].cumplido === 2, 'o, si va sin contar, si ha seguido el plan');
const errNutAjeno = await mensaje(`insert into registros_nutricion (atleta_id, fecha, kcal) values ($1, $2, 2000)`, [aAna.id, hoyM]);
const errNutNada = await mensaje(`insert into registros_nutricion (atleta_id, fecha, kcal) values (gen_random_uuid(), $1, 2000)`, [hoyM]);
check(errNutAjeno && errNutAjeno === errNutNada, 'no puede apuntar por Ana (el mismo error que por alguien que no existe)');
check(await falla(`update registros_nutricion set atleta_id = $1 where id = $2`, [aAna.id, rn.id]), 'ni pasarle un registro suyo');
await como(ana);
check((await q(`select count(*)::int n from registros_nutricion`))[0].n === 0 && (await q(`select count(*)::int n from planes_nutricion`))[0].n === 0, 'Ana no ve lo de Luis');
check(errNutAjeno === await mensaje(`insert into registros_nutricion (atleta_id, fecha, kcal) values ($1, $2, 2000)`, [aAna.id, hoyM]), 'y sin consentimiento de salud no puede apuntar lo suyo (el mismo error)');
await como(pelayo, 'aal2');
check(/consentimiento/.test(await mensaje(`insert into registros_nutricion (atleta_id, fecha, kcal) values ($1, $2, 2000)`, [aAna.id, hoyM]) || '')
  && (await q(`insert into registros_nutricion (atleta_id, fecha, kcal) values ($1, $2::date - 2, 2100) returning id`, [aLuis.id, hoyM])).length === 1,
  'el coach tampoco apunta por quien no ha dado el consentimiento (por Luis, sí)');
check((await q(`select count(*)::int n from registros_nutricion where atleta_id = $1`, [aLuis.id]))[0].n === 3, 'el coach ve lo que apunta Luis');
// Lo que encontró la revisión independiente de la 009
await como(pelayo, 'aal2');
check(await planMalo(`modo, kcal, proteina_g, carbos_g, grasa_g`, `'macros', 800, 600, 1500, 500`) && await planMalo(`modo, kcal, proteina_g`, `'kcal_proteina', 1000, 300`)
  && (await q(`insert into planes_nutricion (atleta_id, desde, modo, kcal, proteina_g, carbos_g, grasa_g) values ($1, '2026-02-02', 'macros', 2005, 150, 200, 65) returning id`, [aLuis.id])).length === 1,
  'las kcal cuadran con los macros (4/4/9, ±5 %) y dan para la proteína');
check(await planMalo(`modo, fase, ritmo_pct`, `'sin_contar', 'mantener', -1`), 'mantener va sin ritmo o con 0');
check(await planMalo(`modo, pautas`, `'sin_contar', E'\\u202e\\u2066'`) && await falla(`insert into avisos (texto) values (E'\\u2007\\u202f')`)
  && await falla(`insert into habitos (atleta_id, nombre, tipo) values ($1, E'\\u2066', 'si_no')`, [aLuis.id]), 'ningún texto vale solo con caracteres invisibles o de dirección (avisos, hábitos y nutrición)');
check((await q(`insert into avisos (texto) values (E'Hola \\u202e') returning id`)).length === 1, 'con algo visible, sí');
await como(luis);
check(await falla(`insert into registros_nutricion (atleta_id, fecha, kcal, nota) values ($1, $2::date - 4, 2000, E'\\U000e0041\\u034f')`, [aLuis.id, hoyM]), 'tampoco una nota hecha de etiquetas invisibles');
check(await falla(`truncate registros_nutricion`) && await falla(`truncate pesos`), 'nadie puede vaciar una tabla entera desde la app (TRUNCATE no mira los permisos por fila)');
await su();
const sin8 = new PGlite();
await sin8.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
await sin8.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
for (const m of migraciones().filter((m) => m < '008')) await sin8.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
let errSin8 = null;
try { await sin8.exec(readFileSync(new URL('../supabase/migraciones/009_nutricion.sql', import.meta.url), 'utf8')); } catch (e) { errSin8 = e.message; }
check(/Antes de la 009 hace falta la 008/.test(errSin8 || ''), 'la 009 no se aplica sin la 008 (antes se quedaba a medias)');
await sin8.close();
await anon();
check(await falla(`select count(*) from planes_nutricion`) && await falla(`select count(*) from registros_nutricion`), 'sin sesión no se ve nada');

// =====================================================================
// Migración 010
// =====================================================================
console.log('\nNotificaciones (migración 010)');
const servidor = async () => db.exec(`reset role; ${claims('', '')} set role service_role;`);
const sub = (n, k = 'A') => [`https://fcm.googleapis.com/fcm/send/prueba-${n}`, 'B' + k.repeat(86), k.repeat(22)];
const notis = async (where, params = []) => { await su(); return q(`select * from notificaciones where ${where} order by creado_en`, params); };
await como(luis);
check(await falla(`insert into suscripciones_push (usuario_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)`, [luis, ...sub('luis')]), 'una suscripción no se mete a mano en la tabla');
const subLuis = (await q(`select registrar_suscripcion_push($1, $2, $3, 'Android · Chrome') id`, sub('luis')))[0].id;
check(!!subLuis && (await q(`select dispositivo from suscripciones_push`))[0].dispositivo === 'Android · Chrome', 'Luis activa las notificaciones en su móvil');
check(await falla(`select registrar_suscripcion_push('https://atacante.example.com/push', $1, $2)`, sub('x').slice(1)) && await falla(`select registrar_suscripcion_push('http://fcm.googleapis.com/fcm/send/x', $1, $2)`, sub('x').slice(1)),
  'solo con los servicios de push de los navegadores (la función de envío hace POST a esa dirección)');
check(await falla(`select registrar_suscripcion_push($1, 'clave-rara', $2)`, [sub('y')[0], sub('y')[2]]) && await falla(`select registrar_suscripcion_push($1, $2, 'corta')`, sub('y').slice(0, 2)), 'y con las claves del navegador con su forma exacta');
check(await falla(`update suscripciones_push set usuario_id = $1`, [ana]), 'no puede pasar su suscripción a otra cuenta');
check(await falla(`insert into preferencias_notificaciones (desactivados) values ('{inventado}')`) && await falla(`insert into preferencias_notificaciones (hora_tarde) values ('03:00')`)
  && await falla(`insert into preferencias_notificaciones (silencio_desde, silencio_hasta) values ('22:00', null)`), 'preferencias con tipos conocidos, horas razonables y el «no molestar» completo');
const [prefL] = await q(`insert into preferencias_notificaciones (desactivados, silencio_desde, silencio_hasta) values ('{}', null, null) returning *`);
check(prefL.usuario_id === luis && prefL.hora_tarde.startsWith('21:00'), 'guarda sus preferencias (sin «no molestar»), con las horas de entrada');
check(await falla(`insert into preferencias_notificaciones (usuario_id) values ($1)`, [ana]) && await falla(`update suscripciones_push set fallos = 0`),
  'nadie crea las preferencias de otro, ni toca los datos de envío de sus móviles');
await como(pelayo, 'aal2');
await q(`select registrar_suscripcion_push($1, $2, $3, 'Mac · Safari')`, sub('pelayo', 'C'));
await su();
await q(`update perfiles set nombre = 'Pelayo Pérez' where id = $1`, [pelayo]);
await como(pelayo, 'aal2');
const [comL] = await q(`insert into comentarios (sesion_id, texto) values ($1, 'Muy bien la técnica, sube 2,5 kg') returning id`, [sLuis.id]);
const nResp = await notis(`clave = $1`, ['comentario:' + comL.id]);
const nomSesL = (await q(`select nombre from sesiones where id = $1`, [sLuis.id]))[0].nombre;
check(nResp.length === 1 && nResp[0].usuario_id === luis && nResp[0].tipo === 'respuesta' && nResp[0].titulo === 'Pelayo te ha respondido' && nResp[0].cuerpo === `En ${nomSesL}`,
  'cuando el coach le responde, a Luis le llega «Pelayo te ha respondido · En …»');
check(!JSON.stringify(nResp[0]).includes('sube 2,5') && nResp[0].url === '#hoy', 'sin el texto del mensaje (se ve con el móvil bloqueado)');
check(Math.abs(new Date(nResp[0].enviar_desde) - Date.now()) < 60000, 'y sale ya (Luis ha quitado el «no molestar»)');
check((await notis(`usuario_id = $1`, [pelayo])).length === 0, 'al coach no le llega lo que escribe él');
await como(luis);
const [comL2] = await q(`insert into comentarios (sesion_id, texto) values ($1, 'Me dolió la muñeca') returning id`, [sLuis.id]);
await q(`insert into comentarios (sesion_id, texto) values ($1, 'Y el codo también')`, [sLuis.id]);
const nMsg = await notis(`tipo = 'mensaje' and usuario_id = $1`, [pelayo]);
check(nMsg.length === 1 && nMsg[0].usuario_id === pelayo && nMsg[0].tipo === 'mensaje' && nMsg[0].titulo === 'Luis te ha escrito' && nMsg[0].url === '#revisar' && !JSON.stringify(nMsg[0]).includes('muñeca'),
  'cuando Luis escribe, al coach le llega «Luis te ha escrito» (tampoco con el texto), una sola aunque escriba dos seguidos');
await como(pelayo, 'aal2');
const [comA] = await q(`insert into comentarios (sesion_id, texto) values ($1, 'Hola Ana') returning id`, [ses.id]);
check((await notis(`clave = $1`, ['comentario:' + comA.id])).length === 0, 'a quien no tiene ningún móvil activado ni el email no se le acumula nada');
await como(luis);
check((await q(`select count(*)::int n from notificaciones`))[0].n === 1 && await falla(`insert into notificaciones (usuario_id, tipo, titulo, clave, caduca_en) values ($1, 'prueba', 'x', 'x', now())`, [luis]),
  'Luis ve sus notificaciones y no puede crearlas');
check(await falla(`update notificaciones set estado = 'enviada'`) && await falla(`delete from notificaciones`), 'ni cambiarlas ni borrarlas');
check(await falla(`select fbe_privado.notificar($1, 'respuesta', 'Falsa', null, '#hoy', 'x')`, [ana]), 'ni crearle una a otra persona con la función interna (ni siquiera la ve)');
await como(ana);
check((await q(`select count(*)::int n from notificaciones`))[0].n === 0 && (await q(`select count(*)::int n from suscripciones_push`))[0].n === 0, 'Ana no ve las notificaciones ni los móviles de nadie');
check((await q(`delete from suscripciones_push returning id`)).length === 0, 'ni puede borrarlos');
await anon();
check(await falla(`select count(*) from notificaciones`) && await falla(`select registrar_suscripcion_push($1, $2, $3)`, sub('anon')), 'sin sesión, nada');

// Semana publicada, avisos, check-in, vídeo y sesión terminada
await como(pelayo, 'aal2');
const [w2L] = await q(`insert into semanas (bloque_id, numero, fecha_inicio) values ($1, 2, $2::date + 7) returning id`, [bLuis, lunes]);
await q(`update semanas set programacion = 'programada' where id = $1`, [w2L.id]);
const nSem = await notis(`clave = $1`, ['semana:' + w2L.id]);
check(nSem.length === 1 && nSem[0].usuario_id === luis && nSem[0].titulo === 'Ya tienes tu próxima semana' && nSem[0].url === '#semana', 'al publicar su semana, a Luis le llega «Ya tienes tu próxima semana»');
await q(`update semanas set programacion = 'en_programacion' where id = $1`, [w2L.id]);
await q(`update semanas set programacion = 'programada' where id = $1`, [w2L.id]);
check((await notis(`clave = $1`, ['semana:' + w2L.id])).length === 1, 'retirarla y volver a publicarla no la repite');
await como(pelayo, 'aal2');
const [wTmp] = await q(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 9, $2::date + 56, 'programada') returning id`, [bLuis, lunes]);
await q(`update semanas set programacion = 'en_programacion' where id = $1`, [wTmp.id]);
check((await notis(`clave = $1`, ['semana:' + wTmp.id])).length === 0, 'si la retiras antes de que salga la notificación, ya no sale');
await como(pelayo, 'aal2');
const [wTmp2] = await q(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 10, $2::date + 63, 'programada') returning id`, [bLuis, lunes]);
await q(`delete from semanas where id = $1`, [wTmp2.id]);
check((await notis(`clave = $1`, ['semana:' + wTmp2.id])).length === 0, 'ni si la borras');
await como(pelayo, 'aal2');
const [av1] = await q(`insert into avisos (texto) values ('El lunes 3 no hay check-in') returning id`);
const nAv = await notis(`clave = $1`, ['aviso:' + av1.id]);
check(nAv.length === 1 && nAv[0].usuario_id === luis && nAv[0].titulo === 'Aviso de Pelayo' && nAv[0].cuerpo === 'Tócalo para leerlo en la app.' && !JSON.stringify(nAv[0]).includes('lunes 3'),
  'un aviso llega a los atletas con el móvil activado, sin su texto (puede ser personal y se ve con el móvil bloqueado)');
await como(pelayo, 'aal2');
const [av2] = await q(`insert into avisos (texto, atleta_id, desde) values ('Luis: test de 1RM', $1, current_date + 3) returning id`, [aLuis.id]);
const horaDe = async (id) => (await q(`select to_char(enviar_desde at time zone 'Europe/Madrid', 'HH24:MI') h, (enviar_desde at time zone 'Europe/Madrid')::date - current_date d from notificaciones where clave = $1`, ['aviso:' + id]))[0];
await su();
const h3 = await horaDe(av2.id);
check(h3?.h === '09:00' && h3.d === 3, 'uno que empieza otro día sale ese día a las 9:00');
await como(pelayo, 'aal2');
await q(`update avisos set desde = current_date + 5 where id = $1`, [av2.id]);
await su();
check((await horaDe(av2.id))?.d === 5, 'si le cambias la fecha antes de que salga, sale el día nuevo');
await como(pelayo, 'aal2');
await q(`update avisos set atleta_id = $1 where id = $2`, [aAna.id, av2.id]);
check((await notis(`clave = $1`, ['aviso:' + av2.id])).length === 0, 'y si lo pasas a otra persona, a Luis ya no le llega');
await como(pelayo, 'aal2');
const [av3] = await q(`insert into avisos (texto, desde) values ('Pasado mañana, test', current_date + 2) returning id`);
await q(`delete from avisos where id = $1`, [av3.id]);
check((await notis(`clave = $1`, ['aviso:' + av3.id])).length === 0, 'si lo borras antes de que salga, ya no sale');
await como(pelayo, 'aal2');
await q(`insert into avisos (texto, desde, hasta) values ('Ya pasó', current_date - 5, current_date - 1)`);
check((await notis(`tipo = 'aviso' and titulo is not null and cuerpo = 'Ya pasó'`)).length === 0, 'uno ya caducado no sale');
await como(luis);
const [ckN] = await q(`insert into checkins (atleta_id, semana_inicio, energia) values ($1, $2::date - 28, 4) returning id`, [aLuis.id, lunes]);
await q(`delete from checkins where id = $1`, [ckN.id]);
const [ckN2] = await q(`insert into checkins (atleta_id, semana_inicio, energia) values ($1, $2::date - 28, 4) returning id`, [aLuis.id, lunes]);
const nCk = await notis(`tipo = 'checkin_recibido' and usuario_id = $1`, [pelayo]);
check(nCk.length === 1 && nCk[0].usuario_id === pelayo && nCk[0].titulo === 'Luis ha enviado su check-in' && /^Semana del \d+ de [a-z]+$/.test(nCk[0].cuerpo), 'al coach le llega el check-in de Luis («Semana del …»), sin sus respuestas, y una sola aunque lo borre y lo vuelva a enviar');
void ckN2;
await como(luis);
const [vidL] = await q(`insert into archivos (atleta_id, tipo, ruta) values ($1, 'video_tecnica', $2) returning id`, [aLuis.id, `${aLuis.id}/aviso-1.mp4`]);
const nVid = (await notis(`clave = $1`, ['archivo:' + vidL.id]))[0];
check(nVid?.titulo === 'Luis ha subido un vídeo' && new Date(nVid.enviar_desde) - Date.now() > 4 * 60000, 'y su vídeo, unos minutos después (lo que tarda en subirse)');
await como(luis);
await q(`update sesiones set completada = true, fecha_realizada = current_date where id = $1`, [sLuis.id]);
check((await notis(`clave = $1`, ['sesion:' + sLuis.id])).length === 0, 'las sesiones terminadas, de entrada no (serían muchas)');
await como(pelayo, 'aal2');
await q(`insert into preferencias_notificaciones (desactivados) values ('{}')`);
await como(luis);
await q(`update sesiones set completada = false where id = $1`, [sLuis.id]);
await q(`update sesiones set completada = true where id = $1`, [sLuis.id]);
const nSes = await notis(`clave = $1`, ['sesion:' + sLuis.id]);
check(nSes.length === 1 && nSes[0].titulo === `Luis ha terminado ${nomSesL}`, 'si el coach las activa, le llega «Luis ha terminado …»');
await q(`update sesiones set completada = false, fecha_realizada = null where id = $1`, [sLuis.id]);
check((await notis(`clave = $1`, ['sesion:' + sLuis.id])).length === 0, 'si la vuelve a dejar sin hacer antes de que salga, ya no sale');
await como(luis);
await q(`update preferencias_notificaciones set desactivados = '{semana}'`);
await como(pelayo, 'aal2');
const [w3L] = await q(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 3, $2::date + 14, 'programada') returning id`, [bLuis, lunes]);
check((await notis(`clave = $1`, ['semana:' + w3L.id])).length === 0, 'lo que alguien desactiva no le llega');
await como(luis);
await q(`update preferencias_notificaciones set desactivados = '{}'`);
await como(pelayo, 'aal2');
const [comBorrar] = await q(`insert into comentarios (sesion_id, texto) values ($1, 'Perdona, era para otro') returning id`, [sLuis.id]);
await q(`delete from comentarios where id = $1`, [comBorrar.id]);
check((await notis(`clave = $1`, ['comentario:' + comBorrar.id])).length === 0, 'un comentario borrado antes de que salga su notificación ya no la envía');
await su();
await q(`alter table notificaciones add constraint prueba_rota check (false) not valid`);
await como(pelayo, 'aal2');
const rota = await mensaje(`insert into comentarios (sesion_id, texto) values ($1, 'Aunque falle la notificación')`, [sLuis.id]);
await su();
await q(`alter table notificaciones drop constraint prueba_rota`);
check(rota === null && (await q(`select count(*)::int n from comentarios where texto = 'Aunque falle la notificación'`))[0].n === 1, 'si crear la notificación fallara, el comentario se guarda igual');
check((await q(`select to_char(fbe_privado.fuera_de_silencio(('2026-10-20 23:10')::timestamp at time zone 'Europe/Madrid', '22:30', '08:00') at time zone 'Europe/Madrid', 'DD HH24:MI') h`))[0].h === '21 08:00'
  && (await q(`select to_char(fbe_privado.fuera_de_silencio(('2026-10-20 06:00')::timestamp at time zone 'Europe/Madrid', '22:30', '08:00') at time zone 'Europe/Madrid', 'DD HH24:MI') h`))[0].h === '20 08:00'
  && (await q(`select to_char(fbe_privado.fuera_de_silencio(('2026-10-20 12:00')::timestamp at time zone 'Europe/Madrid', '22:30', '08:00') at time zone 'Europe/Madrid', 'DD HH24:MI') h`))[0].h === '20 12:00'
  && (await q(`select to_char(fbe_privado.fuera_de_silencio(('2026-10-20 14:00')::timestamp at time zone 'Europe/Madrid', '13:00', '15:30') at time zone 'Europe/Madrid', 'DD HH24:MI') h`))[0].h === '20 15:30',
  '«no molestar» (hora de España): lo de por la noche sale a las 8:00, también si cruza la medianoche');

// Prueba, móviles compartidos y límite por cuenta
await como(luis);
check((await q(`select probar_notificacion() r`))[0].r === 'ok' && (await q(`select probar_notificacion() r`))[0].r === 'espera', '«Enviarme una de prueba»: como mucho una por minuto');
await como(intruso);
check(await falla(`select registrar_suscripcion_push($1, $2, $3)`, sub('intruso')) && await falla(`select probar_notificacion()`),
  'una cuenta sin ficha (cualquiera puede crearse una) no puede activarlas ni usar el servidor para enviarse pruebas');
await como(ana);
check((await q(`select probar_notificacion() r`))[0].r === 'sin_canal', 'sin ningún móvil activado, lo dice');
await q(`select registrar_suscripcion_push($1, $2, $3)`, sub('luis'));
await su();
check((await q(`select usuario_id from suscripciones_push where endpoint = $1`, [sub('luis')[0]]))[0].usuario_id === ana, 'si otra cuenta activa las notificaciones en el mismo navegador, pasan a ser suyas (y Luis deja de recibirlas allí)');
await como(ana);
await q(`delete from suscripciones_push`);
await como(luis);
const vapidA = 'B' + 'V'.repeat(86);
const idAct = (await q(`select registrar_suscripcion_push($1, $2, $3, null, $4) id`, [...sub('luis-act'), vapidA]))[0].id;
check((await q(`select actualizar_suscripcion_push($1, $2, $3, $4) ok`, [sub('luis-act')[0], sub('luis-act2')[0], ...sub('luis-act2').slice(1)]))[0].ok === true
  && (await q(`select endpoint, vapid from suscripciones_push where id = $1`, [idAct]))[0].endpoint === sub('luis-act2')[0],
  'si el navegador renueva su suscripción, la app la pone al día (la misma fila, con su clave VAPID)');
check((await q(`select actualizar_suscripcion_push($1, $2, $3, $4) ok`, [sub('no-existe')[0], ...sub('nueva')]))[0].ok === false && (await q(`select count(*)::int n from suscripciones_push where endpoint = $1`, [sub('nueva')[0]]))[0].n === 0,
  'pero no recupera una que ya no está (la quitó desde otro móvil)');
await q(`delete from suscripciones_push where id = $1`, [idAct]);
await como(luis);
for (let i = 0; i < 12; i++) await q(`select registrar_suscripcion_push($1, $2, $3)`, sub(`luis-${i}`));
check((await q(`select count(*)::int n from suscripciones_push`))[0].n === 10, 'como mucho 10 móviles por cuenta (se quedan los más recientes)');

// Lo que hace la función de envío (con la clave de servicio)
await como(luis);
for (const sql of [`select * from notificaciones_por_enviar()`, `select notificaciones_resultado('{}')`, `select crear_recordatorios()`]) {
  check(await falla(sql), `una cuenta de la app no puede usar ${sql.match(/select \*? ?(?:from )?(\w+)/)[1]}`);
}
await su();
await q(`grant execute on function notificaciones_por_enviar(integer, boolean), crear_recordatorios(timestamptz) to authenticated`);
await como(luis);
check(/Solo el servidor/.test(await mensaje(`select * from notificaciones_por_enviar()`) || '') && /Solo el servidor/.test(await mensaje(`select crear_recordatorios()`) || ''),
  'ni aunque una migración futura se las diera a todos (lo comprueban dentro)');
await su();
await q(`revoke execute on function notificaciones_por_enviar(integer, boolean), crear_recordatorios(timestamptz) from authenticated`);
await servidor();
const lote = await q(`select * from notificaciones_por_enviar(100)`);
const deLuis = lote.filter((x) => x.usuario_id === luis);
check(deLuis.length >= 4 && deLuis.every((x) => x.suscripciones.length === 10 && x.email === null && 'vapid' in x.suscripciones[0] && 'fallos' in x.suscripciones[0]), 'el servidor toma las que tocan, cada una con los móviles de su cuenta');
check(!lote.some((x) => x.titulo === 'Luis ha subido un vídeo'), 'pero no las que aún no tocan');
check((await q(`select count(*)::int n from notificaciones_por_enviar(100)`))[0].n === 0, 'y dos envíos a la vez no cogen las mismas');
const [n1, n2, n3] = deLuis;
await q(`select notificaciones_resultado($1)`, [JSON.stringify({
  enviadas: [{ id: n1.id, canal: 'push' }], reintentar: [{ id: n2.id, error: 'HTTP 503', esperar: 1800 }], fallidas: [{ id: n3.id, error: 'HTTP 400' }],
  suscripciones_ok: [n1.suscripciones[0].id], suscripciones_caducadas: [n1.suscripciones[1].id], suscripciones_error: [{ id: n1.suscripciones[2].id, error: 'HTTP 403' }],
})]);
await su();
const est = Object.fromEntries((await q(`select id, estado, canal, error, enviar_desde > now() + interval '29 minutes' tarde from notificaciones where id in ($1, $2, $3)`, [n1.id, n2.id, n3.id])).map((x) => [x.id, x]));
check(est[n1.id].estado === 'enviada' && est[n1.id].canal === 'push' && est[n2.id].estado === 'pendiente' && est[n2.id].tarde && est[n3.id].estado === 'fallida' && est[n3.id].error === 'HTTP 400',
  'apunta lo que pasó: enviada, a reintentar más tarde (cuando pide el servicio) o fallida');
const subsL = await q(`select id, fallos, usada_en, ultimo_error from suscripciones_push where usuario_id = $1`, [luis]);
check(subsL.length === 9 && subsL.find((x) => x.id === n1.suscripciones[0].id).usada_en && subsL.find((x) => x.id === n1.suscripciones[2].id).fallos === 1,
  'el móvil que ya no existe (el servicio de push dice 404 o 410) se borra; los demás guardan su último uso o error');
await su();
await q(`update notificaciones set enviar_desde = now() - interval '2 days', caduca_en = now() - interval '1 hour' where id = $1`, [n2.id]);
await servidor();
await q(`select * from notificaciones_por_enviar(100)`);
await su();
check((await q(`select estado from notificaciones where id = $1`, [n2.id]))[0].estado === 'caducada', 'la que no ha salido a tiempo ya no sale (caducada)');

// Por email (si la cuenta lo quiere y el servidor lo tiene configurado): como mucho uno por hora
await como(ana);
await q(`insert into preferencias_notificaciones (email, silencio_desde, silencio_hasta) values (true, null, null)`);
await como(pelayo, 'aal2');
const [comE] = await q(`insert into comentarios (sesion_id, texto) values ($1, 'Ana, mira esto') returning id`, [ses.id]);
await servidor();
const sinEmail = await q(`select * from notificaciones_por_enviar(100, false)`);
const conEmail = await q(`select * from notificaciones_por_enviar(100, true)`);
const nE = conEmail.find((x) => x.usuario_id === ana);
check(!sinEmail.some((x) => x.usuario_id === ana) && nE?.email === 'ana@test' && nE.suscripciones.length === 0 && nE.titulo === 'Pelayo te ha respondido',
  'con el email activado (y sin móvil), la toma solo si el servidor puede enviar emails, con su dirección');
await q(`select notificaciones_resultado($1)`, [JSON.stringify({ enviadas: [{ id: nE.id, canal: 'email' }] })]);
await como(pelayo, 'aal2');
await q(`insert into comentarios (sesion_id, texto) values ($1, 'Y esto otro') returning id`, [ses.id]);
await servidor();
check(!(await q(`select * from notificaciones_por_enviar(100, true)`)).some((x) => x.usuario_id === ana), 'y la siguiente espera a que pase una hora (se juntan en el mismo email)');
await como(ana);
await q(`delete from preferencias_notificaciones`);
await q(`insert into preferencias_notificaciones (email, silencio_desde, silencio_hasta) values (true, null, null)`);
await servidor();
check(!(await q(`select * from notificaciones_por_enviar(100, true)`)).some((x) => x.usuario_id === ana), 'borrar y volver a crear sus preferencias no se salta esa hora');
await su();
await q(`update auth.users set email_confirmed_at = null where id = $1`, [ana]);
await q(`update notificaciones set canal = null, enviada_en = null where usuario_id = $1 and canal = 'email'`, [ana]);
await servidor();
const sinConfirmar = (await q(`select * from notificaciones_por_enviar(100, true)`)).find((x) => x.usuario_id === ana);
check(sinConfirmar && sinConfirmar.email === null, 'y a un email sin confirmar no se envía nada');
await su();
await q(`update auth.users set email_confirmed_at = now() where id = $1`, [ana]);
// Lo que se quedó a medias: a los 10 minutos se vuelve a tomar (antes no: la función aún podría estar enviándola)
const [atascada] = await q(`select id from notificaciones where usuario_id = $1 and estado = 'enviando' limit 1`, [luis]);
if (atascada) {
  await q(`update notificaciones set tomada_en = now() - interval '6 minutes', caduca_en = now() + interval '1 hour' where id = $1`, [atascada.id]);
  await servidor();
  const a6 = (await q(`select * from notificaciones_por_enviar(500)`)).some((x) => x.id === atascada.id);
  await su();
  await q(`update notificaciones set estado = 'enviando', tomada_en = now() - interval '11 minutes' where id = $1`, [atascada.id]);
  await servidor();
  const a11 = (await q(`select * from notificaciones_por_enviar(500)`)).some((x) => x.id === atascada.id);
  check(!a6 && a11, 'una que se quedó a medias se vuelve a tomar a los 10 minutos, no antes');
} else check(false, 'hay una notificación a medias para probarlo');
await su();
const [vieja] = await q(`insert into notificaciones (usuario_id, tipo, titulo, clave, creado_en, enviar_desde, caduca_en) values ($1, 'aviso', 'Futuro', 'prueba-vieja', now() - interval '40 days', now() + interval '2 days', now() + interval '3 days') returning id`, [luis]);
await servidor();
await q(`select * from notificaciones_por_enviar(1)`);
await su();
check((await q(`select count(*)::int n from notificaciones where id = $1`, [vieja.id]))[0].n === 1, 'la limpieza de los 30 días no se lleva las que aún no han salido');
check((await q(`select fbe_privado.notificar($1, 'aviso', 'Tarde', null, '#hoy', 'caducada-antes', now() + interval '2 hours', now() + interval '1 hour') r`, [luis]))[0].r === false,
  'una que caducaría antes de poder salir (un aviso que acaba hoy, de noche) no se crea');

// Recordatorios
await su();
const enMadrid = (fecha, hora) => `('${fecha} ${hora}')::timestamp at time zone 'Europe/Madrid'`;
const dia = async (n) => (await q(`select ($1::date + $2::int)::text d`, [lunes, n]))[0].d;
const [sTorso] = await q(`insert into sesiones (semana_id, orden, nombre, dia_previsto) values ($1, 1, 'Torso B', $2::date + 9) returning id`, [w2L.id, lunes]);
const mie2 = await dia(9);
await servidor();
const r0845 = (await q(`select crear_recordatorios(${enMadrid(mie2, '08:45')}) n`))[0].n;
const recS = await notis(`clave = $1`, [`recordatorio_sesion:${mie2}`]);
check(r0845 >= 1 && recS.length === 1 && recS[0].usuario_id === luis && recS[0].titulo === 'Hoy toca Torso B', 'por la mañana, «Hoy toca Torso B» si la planificó para hoy');
await servidor();
await q(`select crear_recordatorios(${enMadrid(mie2, '09:30')})`);
check((await notis(`clave = $1`, [`recordatorio_sesion:${mie2}`])).length === 1, 'una sola vez al día');
const jue2 = await dia(10);
await su();
await q(`update sesiones set dia_previsto = $1 where id = $2`, [jue2, sTorso.id]);
await servidor();
await q(`select crear_recordatorios(${enMadrid(jue2, '11:00')})`);
check((await notis(`clave = $1`, [`recordatorio_sesion:${jue2}`])).length === 0, 'y solo en las dos horas siguientes a la hora elegida (si el servidor se para, no llega tarde)');
const dom2 = await dia(13);
await servidor();
await q(`select crear_recordatorios(${enMadrid(dom2, '21:15')})`);
await su();
const nHab = (await q(`select count(*)::int n from habitos where atleta_id = $1 and activo`, [aLuis.id]))[0].n;
const recT = await notis(`clave = $1`, [`recordatorio_tarde:${dom2}`]);
const recC = await notis(`clave = $1`, [`recordatorio_checkin:${dom2}`]);
check(nHab > 0 && recT.length === 1 && recT[0].titulo === (nHab === 1 ? 'Te queda un hábito y la nutrición de hoy' : `Te quedan ${nHab} hábitos y la nutrición de hoy`),
  `por la tarde, una sola con lo que le falta de hoy («${recT[0]?.titulo}»)`);
check(recC.length === 1 && recC[0].titulo === '¿Haces el check-in?' && recC[0].url === '#checkin', 'y el domingo, el check-in de la semana si aún no lo ha hecho');
await como(luis);
await q(`update preferencias_notificaciones set desactivados = '{habitos}', dia_checkin = 6`);
const lun3 = await dia(14);
await servidor();
await q(`select crear_recordatorios(${enMadrid(lun3, '21:15')})`);
const recT3 = await notis(`clave = $1`, [`recordatorio_tarde:${lun3}`]);
check(recT3.length === 1 && recT3[0].titulo === '¿Apuntas lo que has comido hoy?' && recT3[0].tipo === 'nutricion', 'sin los hábitos, solo la nutrición');
check((await notis(`clave = $1`, [`recordatorio_checkin:${lun3}`])).length === 0, 'el check-in, el día que elige');
await como(luis);
await q(`update preferencias_notificaciones set desactivados = '{}', dia_checkin = 7`);
await como(pelayo, 'aal2');
await q(`update atletas set estado = 'pausado' where id = $1`, [aLuis.id]);
const mar3 = await dia(15);
await servidor();
await q(`select crear_recordatorios(${enMadrid(mar3, '21:15')})`);
check((await notis(`clave = $1 and usuario_id = $2`, [`recordatorio_tarde:${mar3}`, luis])).length === 0, 'a un atleta en pausa (o de baja) no le llegan recordatorios');
await como(pelayo, 'aal2');
await q(`update atletas set estado = 'activo' where id = $1`, [aLuis.id]);
check((await notis(`usuario_id = $1 and clave like 'recordatorio%'`, [ana])).length === 0, 'ni los de hábitos, nutrición o check-in a quien no ha dado el consentimiento de salud');
// Migración 018: con «solo entrenamiento», sin recordatorios de nutrición (los hábitos, igual)
await como(luis);
await q(`update preferencias_notificaciones set desactivados = '{habitos}'`);
await como(pelayo, 'aal2');
await q(`update atletas set nutricion = false where id = $1`, [aLuis.id]);
const mie3 = await dia(16);
await servidor();
await q(`select crear_recordatorios(${enMadrid(mie3, '21:15')})`);
check((await notis(`clave = $1 and usuario_id = $2`, [`recordatorio_tarde:${mie3}`, luis])).length === 0, 'a quien solo le llevas el entrenamiento no le llega «¿Apuntas lo que has comido hoy?» (migración 018)');
await como(pelayo, 'aal2');
await q(`update atletas set nutricion = true where id = $1`, [aLuis.id]);
const jue3 = await dia(17);
await servidor();
await q(`select crear_recordatorios(${enMadrid(jue3, '21:15')})`);
check((await notis(`clave = $1 and usuario_id = $2 and tipo = 'nutricion'`, [`recordatorio_tarde:${jue3}`, luis])).length === 1, 'y al volver a llevarle la nutrición, vuelve a llegarle');
await como(luis);
await q(`update preferencias_notificaciones set desactivados = '{}'`);
// =====================================================================
// Migración 011
// =====================================================================
console.log('\nCuestionario inicial (migración 011)');
await su();
const crib = async (a, e, sint) => (await q(`select resultado_cribado($1, $2, $3::text[]) r`, [a, e, sint]))[0].r;
check(await crib(false, false, '{}') === 'sin_valoracion' && await crib(false, true, '{}') === 'valorar_antes' && await crib(true, true, '{}') === 'valorar_antes_vigoroso'
  && await crib(true, false, '{mareo}') === 'parar_y_valorar' && await crib(false, false, '{mareo}') === 'valorar_antes' && await crib(null, false, '{}') === null,
  'el cribado sigue el algoritmo de la ACSM de 2015 (sin síntomas ni enfermedad, nada; con enfermedad, valoración antes de empezar o de la intensidad vigorosa; con síntomas, valoración, y si ya entrena, parar)');
await como(luis);
const [cuL] = await q(`insert into cuestionarios (atleta_id, objetivo, experiencia, dias_semana, minutos_sesion, lugar, material, activo, enfermedad, sintomas, otras, lesiones, completado_en, revisado_en, pedido_en, resultado)
  values ($1, 'fuerza', '1_3', 4, 60, 'gimnasio', '{barra,rack,banco}', true, false, '{}', '{}', '[{"zona": "hombro", "limita": 1, "nota": "Al press por encima"}]', '2000-01-01', now(), now(), 'parar_y_valorar') returning *`, [aLuis.id]);
check(cuL.resultado === 'sin_valoracion' && new Date(cuL.completado_en).getFullYear() > 2020 && cuL.revisado_en === null && cuL.pedido_en === null,
  'Luis rellena su cuestionario: la recomendación, la fecha de completado, la revisión y la petición las pone la base (no él)');
const malCu = async (col, val) => falla(`update cuestionarios set ${col} = ${val} where id = $1`, [cuL.id]);
check(await malCu('objetivo', `'volar'`) && await malCu('dias_semana', '8') && await malCu('material', `'{nave}'`) && await malCu('sintomas', `'{tos}'`),
  'solo con las opciones que existen');
check(await malCu('lesiones', `'[{"zona": "oreja", "limita": 1}]'`) && await malCu('lesiones', `'[{"zona": "rodilla", "limita": 5}]'`)
  && await malCu('lesiones', `'[{"zona": "rodilla", "limita": 1, "nota": "​"}]'`) && await malCu('lesiones', `'[{"zona": "rodilla", "limita": 1, "x": 1}]'`) && await malCu('lesiones', `'{"zona": "rodilla"}'`),
  'y las lesiones con su forma exacta (zona conocida, cuánto limita de 0 a 2, una nota con algo visible)');
check(await falla(`update cuestionarios set atleta_id = $1 where id = $2`, [aAna.id, cuL.id]), 'un cuestionario no se pasa a otro atleta');
await como(pelayo, 'aal2');
await q(`update cuestionarios set revisado_en = now() where id = $1`, [cuL.id]);
check(await falla(`update cuestionarios set completado_en = null where id = $1 returning completado_en`, [cuL.id]) === false
  && (await q(`select completado_en is not null c from cuestionarios where id = $1`, [cuL.id]))[0].c, 'el coach lo revisa, pero no lo da por completado ni lo deja sin completar');
await como(luis);
const cambio = (await q(`update cuestionarios set sintomas = '{mareo}' where id = $1 returning resultado, revisado_en`, [cuL.id]))[0];
check(cambio.resultado === 'parar_y_valorar' && cambio.revisado_en === null, 'si Luis cambia algo de su salud, la recomendación se recalcula y vuelve a estar por revisar');
const nSalud = await notis(`tipo = 'cuestionario_recibido' and usuario_id = $1 and clave like 'cuestionario_salud:%'`, [pelayo]);
check(nSalud.length === 1 && nSalud[0].titulo === 'Revisa el cuestionario de Luis' && !/mareo|s[ií]ntoma|salud/i.test(`${nSalud[0].titulo} ${nSalud[0].cuerpo}`),
  'si cuenta síntomas entrenando, al coach le llega ya «Revisa el cuestionario de Luis» (aunque no lo haya enviado, y sin decir qué)');
await q(`update cuestionarios set sintomas = '{}' where id = $1`, [cuL.id]);
await como(ana);
check((await q(`select count(*)::int n from cuestionarios`))[0].n === 0, 'Ana no ve el cuestionario de Luis');
const [cuA] = await q(`insert into cuestionarios (atleta_id, objetivo, lugar) values ($1, 'salud', 'casa') returning id`, [aAna.id]);
check(!!cuA && /consentimiento/.test(await mensaje(`update cuestionarios set activo = true, enfermedad = false, sintomas = '{}' where id = $1`, [cuA.id]) || ''),
  'sin consentimiento de salud, Ana puede contar su objetivo pero no responder lo de salud');
await su();
await q(`update cuestionarios set activo = true, enfermedad = false, sintomas = '{}' where id = $1`, [cuA.id]);
await como(ana);
check(await falla(`update cuestionarios set enfermedad = true where id = $1`, [cuA.id])
  && !(await falla(`insert into cuestionarios (atleta_id, activo, enfermedad, sintomas, objetivo) values ($1, true, false, '{}', 'fuerza')
    on conflict (atleta_id) do update set activo = excluded.activo, enfermedad = excluded.enfermedad, sintomas = excluded.sintomas, objetivo = excluded.objetivo`, [aAna.id])),
  'ni cambiarlo si ya estaba (por ejemplo, después de retirar el consentimiento); volver a mandar lo mismo con un upsert, como hace la app, sí');
check(!(await falla(`update cuestionarios set sintomas = null where id = $1`, [cuA.id])) && !(await falla(`update cuestionarios set activo = null, enfermedad = null where id = $1`, [cuA.id]))
  && (await q(`select resultado from cuestionarios where id = $1`, [cuA.id]))[0].resultado === null,
  'y borrarlo se puede siempre, también de campo en campo');
check(await falla(`insert into cuestionarios (atleta_id, objetivo) values ($1, 'fuerza')`, [aLuis.id]), 'ni rellenar el de otro');
await como(intruso);
check((await q(`select count(*)::int n from cuestionarios`))[0].n === 0, 'una cuenta sin ficha no ve ninguno');
await como(pelayo, 'aal2');
await q(`update cuestionarios set pedido_en = '2000-01-01' where id = $1`, [cuL.id]);
check((await q(`select pedido_en > now() - interval '1 minute' r from cuestionarios where id = $1`, [cuL.id]))[0].r,
  'la hora de la petición (y de la revisión) la pone la base, no el reloj del móvil del coach');
const nPed = await notis(`tipo = 'cuestionario' and usuario_id = $1`, [luis]);
check(nPed.length === 1 && nPed[0].titulo === 'Tu coach te pide que actualices tu cuestionario' && nPed[0].url === '#hoy', 'si el coach le pide que lo actualice, a Luis le llega');
await como(luis);
await q(`update cuestionarios set objetivo = 'musculo', completado_en = now() where id = $1`, [cuL.id]);
const nCu = await notis(`tipo = 'cuestionario_recibido' and usuario_id = $1`, [pelayo]);
check(nCu.length >= 1 && nCu.at(-1).titulo === 'Luis ha completado su cuestionario' && !/mareo|hombro|fuerza|m[uú]sculo/i.test(JSON.stringify(nCu.at(-1))),
  'y al completarlo, al coach le llega «Luis ha completado su cuestionario» (sin nada de lo que ha contestado)');

console.log('\nCheck-in a medida (migración 011)');
await como(pelayo, 'aal2');
await q(`update atletas set checkin_apartados = '{descanso,molestias,reloj}' where id = $1`, [aLuis.id]);
check(await falla(`update atletas set checkin_apartados = '{horoscopo}' where id = $1`, [aLuis.id]), 'el coach elige qué apartados del check-in le pregunta a cada atleta (solo los que existen)');
const [pTodos] = await q(`insert into preguntas_checkin (texto, tipo, etiqueta_min, etiqueta_max) values ('Estrés en el trabajo', 'escala', 'Nada', 'Muchísimo') returning id`);
const [pLuis] = await q(`insert into preguntas_checkin (atleta_id, texto, tipo, unidad) values ($1, 'Horas de pie al día', 'numero', 'h') returning id`, [aLuis.id]);
const [pLuisT] = await q(`insert into preguntas_checkin (atleta_id, texto, tipo) values ($1, '¿Qué tal el hombro?', 'texto') returning id`, [aLuis.id]);
const [pAna] = await q(`insert into preguntas_checkin (atleta_id, texto, tipo) values ($1, '¿Has cenado tarde?', 'si_no') returning id`, [aAna.id]);
check(await falla(`insert into preguntas_checkin (texto, tipo, unidad) values ('Estrés', 'escala', 'kg')`) && await falla(`insert into preguntas_checkin (texto) values (E'\\u200b')`)
  && await falla(`insert into preguntas_checkin (texto, tipo) values ('X', 'dibujo')`), 'preguntas con un tipo conocido, texto visible y la unidad solo en las de número');
await como(luis);
check((await q(`update atletas set checkin_apartados = null where id = $1 returning id`, [aLuis.id])).length === 0, 'el atleta no cambia qué le preguntan');
check((await q(`select id from preguntas_checkin order by texto`)).map((x) => x.id).sort().join() === [pTodos.id, pLuis.id, pLuisT.id].sort().join(), 'Luis ve las suyas y las de todos, no las de Ana');
const ckR = async (resp) => mensaje(`insert into checkins (atleta_id, semana_inicio, energia, respuestas) values ($1, $2::date - 35, 3, $3)
  on conflict (atleta_id, semana_inicio) do update set respuestas = excluded.respuestas`, [aLuis.id, lunes, JSON.stringify(resp)]);
check(await ckR({ [pTodos.id]: 4, [pLuis.id]: 7.5, [pLuisT.id]: 'Mejor, sin dolor al press' }) === null, 'Luis responde las preguntas de su coach en el check-in');
check(await ckR({ [pTodos.id]: 6 }) && await ckR({ [pTodos.id]: 3.5 }) && await ckR({ [pLuis.id]: -1 }) && await ckR({ [pLuis.id]: 1.234 }) && await ckR({ [pLuisT.id]: '' })
  && await ckR({ [pLuisT.id]: 5 }) && await ckR({ 'no-es-un-id': 1 }), 'cada respuesta con la forma de su pregunta (escala de 1 a 5, números de 0 a 999999 con dos decimales, texto con algo)');
const errAjenaR = await ckR({ [pAna.id]: true });
const errNadaR = await ckR({ '00000000-0000-4000-8000-000000000000': true });
check(errAjenaR && errAjenaR === errNadaR, 'responder una pregunta de Ana da el mismo error que una que no existe');
await como(pelayo, 'aal2');
check(await falla(`update preguntas_checkin set tipo = 'texto' where id = $1`, [pLuis.id]) && await falla(`update preguntas_checkin set atleta_id = $1 where id = $2`, [aAna.id, pLuis.id]),
  'con respuestas, una pregunta no cambia de tipo ni de atleta');
check((await q(`update preguntas_checkin set activa = false where id = $1 returning id`, [pLuis.id])).length === 1, 'se archiva (y no se pierde lo respondido)');
check(await falla(`delete from preguntas_checkin where id = $1`, [pLuisT.id]) && await falla(`delete from preguntas_checkin where id = $1`, [pTodos.id]),
  'y con respuestas no se puede borrar (tampoco una para todos): se archiva');
await como(luis);
check(await ckR({ [pTodos.id]: 4, [pLuis.id]: 7.5, [pLuisT.id]: 'Mejor, sin dolor al press' }) === null,
  'con una pregunta ya archivada, Luis puede volver a enviar su check-in tal cual (como hace la app, con un upsert)');
await su();
await q(`set session_replication_role = replica`);  // una pregunta borrada antes de existir esta guardia
await q(`delete from preguntas_checkin where id = $1`, [pLuisT.id]);
await q(`set session_replication_role = origin`);
await como(luis);
check((await q(`update checkins set energia = 4 where atleta_id = $1 and semana_inicio = $2::date - 35 returning id`, [aLuis.id, lunes])).length === 1
  && await ckR({ [pTodos.id]: 4, [pLuis.id]: 7.5, [pLuisT.id]: 'Mejor, sin dolor al press' }) === null,
  'y si una pregunta ya no existe, el check-in que la tenía respondida se sigue pudiendo corregir (con update y con upsert)');
await anon();
check(await falla(`select count(*) from cuestionarios`) && await falla(`select count(*) from preguntas_checkin`), 'sin sesión no se ve nada');
await su();
const sin10 = new PGlite();
await sin10.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
await sin10.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
for (const m of migraciones().filter((m) => m < '010')) await sin10.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
let errSin10 = null;
try { await sin10.exec(readFileSync(new URL('../supabase/migraciones/011_cuestionario_y_checkin.sql', import.meta.url), 'utf8')); } catch (e) { errSin10 = e.message; }
check(/Antes de la 011 hace falta la 010/.test(errSin10 || ''), 'la 011 no se aplica sin la 010');
await sin10.close();
await su();
const sin9 = new PGlite();
await sin9.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
await sin9.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
for (const m of migraciones().filter((m) => m < '009')) await sin9.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
let errSin9 = null;
try { await sin9.exec(readFileSync(new URL('../supabase/migraciones/010_notificaciones.sql', import.meta.url), 'utf8')); } catch (e) { errSin9 = e.message; }
check(/Antes de la 010 hace falta la 009/.test(errSin9 || ''), 'la 010 no se aplica sin la 009');
await sin9.close();

console.log('\nDibujos sobre el vídeo (migración 012)');
await su();
const [vidD] = await q(`insert into archivos (atleta_id, tipo, ruta) values ($1, 'video_tecnica', $2) returning *`, [aAna.id, `${aAna.id}/dibujo.mp4`]);
await como(pelayo, 'aal2');
const dib = { t: 2.4, formas: [{ tipo: 'linea', p: [[0.2, 0.3], [0.6, 0.7]] }, { tipo: 'angulo', p: [[0.5, 0.5], [0.5, 0.1], [0.9, 0.5]] }] };
const [cDib] = await q(`insert into comentarios (archivo_id, texto, dibujo) values ($1, '0:02,4 la espalda, más recta', $2) returning *`, [vidD.id, JSON.stringify(dib)]);
check(cDib.dibujo.formas.length === 2, 'el coach deja una línea y un ángulo sobre un fotograma del vídeo de Ana');
const malDib = async (d) => falla(`insert into comentarios (archivo_id, texto, dibujo) values ($1, 'x', $2)`, [vidD.id, JSON.stringify(d)]);
check(await malDib({ t: 1, formas: [] }) && await malDib({ t: 1, formas: [{ tipo: 'linea', p: [[0, 0]] }] }) && await malDib({ t: 1, formas: [{ tipo: 'angulo', p: [[0, 0], [1, 1]] }] })
  && await malDib({ t: 1, formas: [{ tipo: 'linea', p: [[0, 0], [1.2, 1]] }] }) && await malDib({ t: -1, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]] }] })
  && await malDib({ t: 1, formas: [{ tipo: 'flecha', p: [[0, 0], [1, 1]] }] }) && await malDib({ t: 1, formas: Array.from({ length: 13 }, () => ({ tipo: 'linea', p: [[0, 0], [1, 1]] })) })
  && await malDib({ t: 1, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]], color: 'rojo' }] })
  && await malDib({ t: 1, formas: [{ tipo: 'linea' }] }) && await malDib({ formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]] }] }) && await malDib({}),
  'solo con su forma exacta: momento de 0 a 3600, de 1 a 12 formas, líneas de 2 puntos y ángulos de 3, coordenadas de 0 a 1, sin campos de más ni de menos');
check(await falla(`insert into comentarios (sesion_id, texto, dibujo) values ($1, 'x', $2)`, [ses.id, JSON.stringify(dib)]), 'un dibujo solo va en el comentario de un vídeo');
check(await falla(`update comentarios set dibujo = null where id = $1`, [cDib.id]), 'y, como el texto, no se edita después');
await como(ana);
check((await q(`select dibujo from comentarios where id = $1`, [cDib.id]))[0].dibujo.t === 2.4, 'Ana ve el dibujo de su coach');
await su();
const sin11 = new PGlite();
await sin11.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
await sin11.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
for (const m of migraciones().filter((m) => m < '011')) await sin11.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
let errSin11 = null;
try { await sin11.exec(readFileSync(new URL('../supabase/migraciones/012_dibujos_video.sql', import.meta.url), 'utf8')); } catch (e) { errSin11 = e.message; }
check(/Antes de la 012 hace falta la 011/.test(errSin11 || ''), 'la 012 no se aplica sin la 011');
await sin11.close();

console.log('\nCardio (migración 013)');
await como(pelayo, 'aal2');
const pautaC = { modalidad: 'carrera', minutos: 30, esfuerzo: 6, nota: 'Zona 2: puedes hablar sin ahogarte' };
const [sesC] = await q(`insert into sesiones (semana_id, orden, nombre, tipo, cardio) values ($1, 97, 'Rodaje', 'cardio', $2) returning *`, [wAna1.id, JSON.stringify(pautaC)]);
check(sesC.cardio.minutos === 30 && sesC.cardio.modalidad === 'carrera', 'el coach pauta 30 minutos de carrera a esfuerzo 6');
const malC = async (c) => falla(`update sesiones set cardio = $2 where id = $1`, [sesC.id, JSON.stringify(c)]);
check(await malC({ modalidad: 'carrera' }) && await malC({ minutos: 30 }) && await malC({ modalidad: 'patinete', minutos: 30 })
  && await malC({ modalidad: 'bici', minutos: 0 }) && await malC({ modalidad: 'bici', minutos: 30.5 }) && await malC({ modalidad: 'bici', minutos: 601 })
  && await malC({ modalidad: 'bici', km: 0 }) && await malC({ modalidad: 'bici', km: 250 }) && await malC({ modalidad: 'bici', km: '5' })
  && await malC({ modalidad: 'bici', minutos: 30, esfuerzo: 11 }) && await malC({ modalidad: 'bici', minutos: 30, nota: '' }) && await malC({ modalidad: 'bici', minutos: 30, fc: 150 }) && await malC([]),
  'solo con su forma exacta: modalidad de la lista, minutos enteros de 1 a 600 o km de 0 a 200 (al menos uno), esfuerzo de 1 a 10, nota corta, sin campos de más');
check((await q(`update sesiones set cardio = $2 where id = $1 returning cardio`, [sesC.id, JSON.stringify({ modalidad: 'bici', km: 20, minutos: 45 })]))[0].cardio.km === 20, 'minutos y kilómetros a la vez, también vale');
await q(`update sesiones set cardio = $2 where id = $1`, [sesC.id, JSON.stringify(pautaC)]);
const semDup = (await q(`select duplicar_semana($1) id`, [wAna1.id]))[0].id;
check((await q(`select cardio from sesiones where semana_id = $1 and nombre = 'Rodaje'`, [semDup]))[0].cardio.modalidad === 'carrera', 'duplicar la semana copia la pauta de cardio');
await q(`delete from semanas where id = $1`, [semDup]);
await como(ana);
check((await q(`select cardio from sesiones where id = $1`, [sesC.id]))[0].cardio.nota.startsWith('Zona 2'), 'Ana ve la pauta');
check(await falla(`update sesiones set cardio = $2 where id = $1`, [sesC.id, JSON.stringify({ modalidad: 'bici', minutos: 20 })]), 'pero no puede cambiarla');
const [hechaC] = await q(`update sesiones set completada = true, fecha_realizada = current_date, duracion_min = 32, rpe_sesion = 6, cardio_hecho = $2 where id = $1 returning *`, [sesC.id, JSON.stringify({ modalidad: 'carrera', minutos: 32, km: 5.2 })]);
check(hechaC.completada && hechaC.cardio_hecho.km === 5.2 && hechaC.revisada_en === null, 'registra 32 minutos y 5,2 km al terminar, y queda por revisar');
const malH = async (c) => falla(`update sesiones set cardio_hecho = $2 where id = $1`, [sesC.id, JSON.stringify(c)]);
check(await malH({ modalidad: 'carrera' }) && await malH({ minutos: 30 }) && await malH({ modalidad: 'carrera', minutos: 32, km: -1 }) && await malH({ modalidad: 'carrera', minutos: 32, fc: 150 }) && await malH({ modalidad: 'carrera', minutos: 32.5 }),
  'lo hecho también con su forma: modalidad y minutos enteros obligatorios, km opcional, nada más');
check((await q(`update sesiones set cardio_hecho = null where id = $1 returning cardio_hecho`, [sesC.id]))[0].cardio_hecho === null, 'y puede quitarlo');
await como(luis);
check((await q(`select count(*)::int n from sesiones where id = $1`, [sesC.id]))[0].n === 0, 'Luis no ve la sesión de cardio de Ana');
await su();
const sin12 = new PGlite();
await sin12.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
await sin12.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
for (const m of migraciones().filter((m) => m < '012')) await sin12.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
let errSin12 = null;
try { await sin12.exec(readFileSync(new URL('../supabase/migraciones/013_cardio.sql', import.meta.url), 'utf8')); } catch (e) { errSin12 = e.message; }
check(/Antes de la 013 hace falta la 012/.test(errSin12 || ''), 'la 013 no se aplica sin la 012');
await sin12.close();

console.log('\nMensajes y diario (migración 014)');
await como(ana);
const [adj] = await q(`insert into archivos (atleta_id, tipo, ruta, mime, bytes) values ($1, 'adjunto', $2, 'image/jpeg', 120000) returning *`, [aAna.id, `${aAna.id}/adjunto-1.jpg`]);
check(adj.tipo === 'adjunto' && adj.destacado === false, 'Ana registra un adjunto del chat (foto), que nace sin destacar');
check(await falla(`insert into archivos (atleta_id, tipo, ruta) values ($1, 'gif', $2)`, [aAna.id, `${aAna.id}/x.gif`]), 'un tipo que no existe sigue sin entrar');
const [vidP] = await q(`insert into archivos (atleta_id, tipo, ruta, poster_ruta, duracion_seg) values ($1, 'video_tecnica', $2, $3, 34) returning *`, [aAna.id, `${aAna.id}/video-p.mp4`, `${aAna.id}/video-p.mp4.jpg`]);
check(vidP.poster_ruta.endsWith('.jpg') && vidP.duracion_seg === 34, 'un vídeo lleva su miniatura y su duración');
check(await falla(`insert into archivos (atleta_id, tipo, ruta, poster_ruta) values ($1, 'video_tecnica', $2, $3)`, [aAna.id, `${aAna.id}/video-q.mp4`, `${aLuis.id}/video-q.jpg`]), 'la miniatura tiene que estar en su carpeta');
check(await falla(`insert into archivos (atleta_id, tipo, ruta, duracion_seg) values ($1, 'video_tecnica', $2, 5000)`, [aAna.id, `${aAna.id}/video-r.mp4`]), 'y la duración, entre 0 y 3600 segundos');
check((await q(`select archivo_registrado($1) ok`, [vidP.poster_ruta]))[0].ok === true && (await q(`select archivo_registrado($1) ok`, [`${aAna.id}/otra.jpg`]))[0].ok === false, 'Storage acepta la miniatura registrada, no una ruta inventada');
const [edit1] = await q(`update archivos set destacado = true, nota_atleta = 'Mi mejor sentadilla', ejercicio_id = null where id = $1 returning *`, [vidP.id]);
check(edit1.destacado === true && edit1.nota_atleta === 'Mi mejor sentadilla', 'Ana destaca su vídeo y le pone pie');
check(await falla(`update archivos set revisado_en = now() where id = $1`, [vidP.id]) && await falla(`update archivos set comentario_coach = 'x' where id = $1`, [vidP.id])
  && await falla(`update archivos set ruta = $2 where id = $1`, [vidP.id, `${aAna.id}/otra.mp4`]) && await falla(`update archivos set tipo = 'adjunto' where id = $1`, [vidP.id]),
  'pero no puede darlo por revisado, comentarlo como coach, ni cambiar la ruta o el tipo');
check(await falla(`insert into archivos (atleta_id, tipo, ruta, poster_ruta) values ($1, 'video_tecnica', $2, $3)`, [aAna.id, `${aAna.id}/video-s.mp4`, `${aAna.id}/../${aAna.id}/video-s.jpg`])
  && await falla(`insert into archivos (atleta_id, tipo, ruta, poster_ruta) values ($1, 'video_tecnica', $2, $3)`, [aAna.id, `${aAna.id}/video-t.mp4`, `${aAna.id}/video-t.mp4`])
  && await falla(`insert into archivos (atleta_id, tipo, ruta, poster_ruta) values ($1, 'video_tecnica', $2, $3)`, [aAna.id, `${aAna.id}/video-u.mp4`, vidP.poster_ruta]),
  'la miniatura no admite «..», no puede ser la misma ruta que el vídeo ni repetirse');
const [sinPoster] = await q(`update archivos set poster_ruta = null where id = $1 returning poster_ruta`, [vidP.id]);
check(sinPoster.poster_ruta === null && await falla(`update archivos set poster_ruta = $2 where id = $1`, [vidP.id, `${aAna.id}/video-p2.jpg`]),
  'Ana puede quitar la miniatura (si no llegó a subirse), pero no ponerle otra');
// El mensaje de un adjunto del chat es «un mensaje»: la base lo marca y avisa como tal
const [cAdj] = await q(`insert into comentarios (atleta_id, archivo_id, texto) values ($1, $2, 'El gimnasio del hotel') returning *`, [aAna.id, adj.id]);
const [cVid] = await q(`insert into comentarios (atleta_id, archivo_id, texto) values ($1, $2, 'Mi mejor serie') returning *`, [aAna.id, vidP.id]);
check(cAdj.adjunto === true && cVid.adjunto === false, 'el comentario de un adjunto nace marcado; el de un vídeo del diario, no');
check(await falla(`update comentarios set adjunto = true where id = $1`, [cVid.id]), 'y la marca no se cambia a mano');
// El coach contesta a los dos: la respuesta al adjunto llega como mensaje del chat; la del vídeo, como respuesta en Hoy
await como(pelayo, 'aal2');
const [rAdj] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Con eso te apaño la sesión') returning *`, [adj.id]);
const [rVid] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Buena profundidad') returning *`, [vidP.id]);
check(rAdj.adjunto === true && rVid.adjunto === false, 'la marca del adjunto también la lleva la respuesta del coach');
const avisoAdj = await notis(`clave = $1`, ['comentario:' + rAdj.id]);
check(avisoAdj.length === 1 && avisoAdj[0].usuario_id === ana && avisoAdj[0].url === '#mensajes' && avisoAdj[0].titulo === 'Pelayo te ha escrito' && avisoAdj[0].cuerpo === 'Mensaje nuevo',
  `a Ana le llega como mensaje del chat (#mensajes, «te ha escrito», «Mensaje nuevo»): ${JSON.stringify(avisoAdj[0] || null)}`);
const avisoVid = await notis(`clave = $1`, ['comentario:' + rVid.id]);
check(avisoVid.length === 1 && avisoVid[0].url === '#hoy' && avisoVid[0].titulo === 'Pelayo te ha respondido' && avisoVid[0].cuerpo === 'En tu vídeo', 'y la del vídeo del diario, como respuesta («En tu vídeo», #hoy)');
await como(luis);
check((await q(`update archivos set destacado = true where id = $1 returning id`, [vidP.id])).length === 0, 'Luis no toca los archivos de Ana');
await como(pelayo, 'aal2');
check((await q(`update archivos set revisado_en = now(), destacado = true where id = $1 returning revisado_en`, [vidP.id]))[0].revisado_en !== null, 'el coach sí lo revisa (y puede destacarlo)');
await como(ana);
await q(`delete from archivos where id = $1`, [adj.id]);
check((await q(`select 1 from comentarios where id in ($1, $2)`, [cAdj.id, rAdj.id])).length === 0 && (await q(`select archivo_id from comentarios where id = $1`, [cVid.id])).length === 1, 'al borrar un adjunto se van sus mensajes (los dos); los comentarios de un vídeo del diario se quedan');
await su();
const pub = await q(`select 1 from pg_publication where pubname = 'supabase_realtime'`);
check(pub.length === 0 || (await q(`select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'comentarios'`)).length === 1, 'comentarios está en la publicación de Realtime si el proyecto la tiene (en la prueba no hay publicación y no pasa nada)');
await q(`delete from archivos where id = $1`, [vidP.id]);
await q(`delete from comentarios where id in ($1, $2)`, [cVid.id, rVid.id]);
const sin13 = new PGlite();
await sin13.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
await sin13.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
for (const m of migraciones().filter((m) => m < '013')) await sin13.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
let errSin13 = null;
try { await sin13.exec(readFileSync(new URL('../supabase/migraciones/014_mensajes_y_diario.sql', import.meta.url), 'utf8')); } catch (e) { errSin13 = e.message; }
check(/Antes de la 014 hace falta la 013/.test(errSin13 || ''), 'la 014 no se aplica sin la 013');
await sin13.close();

console.log('\nFoto de perfil (migración 015)');
{
  const jpg = 'data:image/jpeg;base64,' + 'QUJD'.repeat(500);
  await como(ana);
  const [conFoto] = await q(`update perfiles set foto = $1 where id = $2 returning foto`, [jpg, ana]);
  check(conFoto?.foto === jpg, 'Ana pone su foto de perfil');
  check(await falla(`update perfiles set foto = $1 where id = $2`, ['data:image/png;base64,QUJD', ana])
    && await falla(`update perfiles set foto = $1 where id = $2`, ['data:image/jpeg;base64,' + 'A'.repeat(80001), ana])
    && await falla(`update perfiles set foto = $1 where id = $2`, ['https://ejemplo.com/foto.jpg', ana])
    && await falla(`update perfiles set foto = $1 where id = $2`, ['data:image/jpeg;base64,QUJD"><script>', ana]),
    'solo una imagen JPEG o WebP en base64, de menos de 80.000 caracteres (ni otra cosa, ni un enlace, ni código)');
  check((await q(`update perfiles set foto = $1 where id = $2 returning id`, [jpg, luis])).length === 0
    && (await q(`select foto from perfiles where id = $1`, [luis])).length === 0, 'no puede poner ni ver la foto de Luis');
  check(await falla(`update perfiles set rol = 'coach', foto = null where id = $1`, [ana]), 'y cambiar la foto no abre la puerta a cambiarse el rol');
  check((await q(`select foto_coach() f`))[0].f === null, 'sin foto del coach, foto_coach() da null');
  await como(pelayo, 'aal2');
  const fotoCoach = 'data:image/webp;base64,' + 'UklG'.repeat(100);
  await q(`update perfiles set foto = $1 where id = $2`, [fotoCoach, pelayo]);
  check((await q(`select foto from perfiles where id = $1`, [ana]))[0].foto === jpg, 'el coach ve la foto de Ana');
  await como(ana);
  check((await q(`select foto_coach() f`))[0].f === fotoCoach, 'Ana ve la foto de su coach con foto_coach()');
  check((await q(`select id from perfiles where rol = 'coach'`)).length === 0, 'pero no el resto del perfil del coach');
  await anon();
  check(await falla(`select foto_coach()`), 'sin sesión, nada');
  await su();
  await q(`update perfiles set foto = null where id in ($1, $2)`, [ana, pelayo]);
  const sin14 = new PGlite();
  await sin14.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin14.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '014')) await sin14.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let errSin14 = null;
  try { await sin14.exec(readFileSync(new URL('../supabase/migraciones/015_foto_perfil.sql', import.meta.url), 'utf8')); } catch (e) { errSin14 = e.message; }
  check(/Antes de la 015 hace falta la 014/.test(errSin14 || ''), 'la 015 no se aplica sin la 014');
  await sin14.close();
}

console.log('\nVarios objetivos en el cuestionario (migración 016)');
{
  await su();
  const [at] = await q(`insert into atletas (nombre) values ('Prueba 016') returning id`);
  const obj = async () => (await q(`select objetivo, objetivos from cuestionarios where atleta_id = $1`, [at.id]))[0];
  await q(`insert into cuestionarios (atleta_id, objetivos) values ($1, array['perder_grasa', 'fuerza', 'perder_grasa'])`, [at.id]);
  let o = await obj();
  check(JSON.stringify(o.objetivos) === '["perder_grasa","fuerza"]' && o.objetivo === 'perder_grasa', 'guarda varios objetivos sin repetir, en su orden, y el primero queda como principal');
  await q(`update cuestionarios set objetivo = 'fuerza' where atleta_id = $1`, [at.id]);
  o = await obj();
  check(JSON.stringify(o.objetivos) === '["fuerza","perder_grasa"]', 'si una versión anterior de la app cambia solo el principal (uno de la lista), pasa delante');
  await q(`update cuestionarios set objetivo = 'salud' where atleta_id = $1`, [at.id]);
  o = await obj();
  check(JSON.stringify(o.objetivos) === '["salud","perder_grasa"]' && o.objetivo === 'salud', 'y si es uno nuevo, sustituye al principal y mantiene el resto');
  check(await falla(`update cuestionarios set objetivos = array['fuerza', 'magia'] where atleta_id = $1`, [at.id])
    && await falla(`update cuestionarios set objetivos = array['fuerza','musculo','perder_grasa','salud','rendimiento','otro','fuerza2'] where atleta_id = $1`, [at.id]),
    'solo objetivos conocidos (como mucho los seis)');
  await q(`update cuestionarios set objetivos = '{}' where atleta_id = $1`, [at.id]);
  o = await obj();
  check(o.objetivos === null && o.objetivo === null, 'vaciar la lista deja el cuestionario sin objetivo');
  await q(`delete from cuestionarios where atleta_id = $1`, [at.id]);
  await q(`insert into cuestionarios (atleta_id, objetivo) values ($1, 'musculo')`, [at.id]);
  o = await obj();
  check(JSON.stringify(o.objetivos) === '["musculo"]', 'uno guardado a la antigua (solo «objetivo») queda también como lista de uno');
  await q(`delete from atletas where id = $1`, [at.id]);
  await como(ana);
  const previo = (await q(`select objetivos from cuestionarios where atleta_id = $1`, [aAna.id]))[0];
  if (previo) {
    const [r] = await q(`update cuestionarios set objetivos = array['musculo', 'fuerza'] where atleta_id = $1 returning objetivo, objetivos`, [aAna.id]);
    check(r.objetivo === 'musculo' && r.objetivos.length === 2, 'Ana marca varios objetivos en su cuestionario');
    await q(`update cuestionarios set objetivos = $2 where atleta_id = $1`, [aAna.id, previo.objetivos]);
  } else {
    const [r] = await q(`insert into cuestionarios (atleta_id, objetivos) values ($1, array['musculo', 'fuerza']) returning objetivo, objetivos`, [aAna.id]);
    check(r.objetivo === 'musculo' && r.objetivos.length === 2, 'Ana marca varios objetivos en su cuestionario');
    await su(); await q(`delete from cuestionarios where atleta_id = $1`, [aAna.id]);
  }
  await su();
  const sin15 = new PGlite();
  await sin15.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin15.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '015')) await sin15.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let errSin15 = null;
  try { await sin15.exec(readFileSync(new URL('../supabase/migraciones/016_objetivos_multiples.sql', import.meta.url), 'utf8')); } catch (e) { errSin15 = e.message; }
  check(/Antes de la 016 hace falta la 015/.test(errSin15 || ''), 'la 016 no se aplica sin la 015');
  await sin15.close();
}

console.log('\nRegistro de errores (migración 017)');
{
  await como(ana);
  await q(`select registrar_error($1, $2, $3, $4, $5)`, ['TypeError: x is undefined', '#hoy', 'at Hoy (app.js:1:2)', '0.21', 'Mozilla/5.0 (iPhone)']);
  await q(`select registrar_error($1, $2, $3, $4, $5)`, ['x'.repeat(900), 'p'.repeat(100), 'd'.repeat(3000), 'v'.repeat(80), 'n'.repeat(500)]);
  check(await falla(`select * from errores_app`) || (await q(`select * from errores_app`)).length === 0, 'Ana apunta sus errores, pero no puede leerlos (ni los de nadie)');
  check(await falla(`insert into errores_app (perfil_id, mensaje) values ($1, 'falso')`, [luis]) && await falla(`insert into errores_app (mensaje) values ('directo')`),
    'tampoco escribir la tabla directamente (ni a nombre de otro): solo con registrar_error');
  await anon();
  check(await falla(`select registrar_error('sin sesión')`), 'sin sesión, nada');
  await como(pelayo, 'aal2');
  const vistos = await q(`select perfil_id, mensaje, pantalla, version, char_length(mensaje) lm, char_length(detalle) ld, char_length(navegador) ln from errores_app order by creado_en`);
  check(vistos.length === 2 && vistos.every((e) => e.perfil_id === ana) && vistos[0].pantalla === '#hoy' && vistos[1].lm === 500 && vistos[1].ld === 2000 && vistos[1].ln === 300,
    'el coach los ve, a nombre de Ana, con lo largo recortado');
  await como(ana);
  for (let i = 0; i < 40; i++) await q(`select registrar_error($1)`, [`en bucle ${i}`]);
  await su();
  check((await q(`select count(*)::int n from errores_app where perfil_id = $1`, [ana]))[0].n === 30, 'si algo falla en bucle, como mucho 30 por hora');
  await q(`update errores_app set creado_en = now() - interval '61 days' where mensaje = 'en bucle 0'`);
  await como(luis);
  await q(`select registrar_error('otro')`);
  await su();
  check((await q(`select count(*)::int n from errores_app where mensaje = 'en bucle 0'`))[0].n === 0, 'lo de hace más de 60 días se borra solo');
  await como(pelayo, 'aal2');
  await q(`delete from errores_app`);
  await su();
  check((await q(`select count(*)::int n from errores_app`))[0].n === 0, 'el coach los borra');
  const sin16 = new PGlite();
  await sin16.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin16.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '016')) await sin16.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let errSin16 = null;
  try { await sin16.exec(readFileSync(new URL('../supabase/migraciones/017_registro_errores.sql', import.meta.url), 'utf8')); } catch (e) { errSin16 = e.message; }
  check(/Antes de la 017 hace falta la 016/.test(errSin16 || ''), 'la 017 no se aplica sin la 016');
  await sin16.close();
}

console.log('\nServicio y nivel del atleta (migración 018)');
{
  await su();
  const [d0] = await q(`select nutricion, nivel from atletas where id = $1`, [aAna.id]);
  check(d0.nutricion === true && d0.nivel === null, 'de entrada: con nutrición y sin nivel (todo como hasta ahora)');
  await como(pelayo, 'aal2');
  check((await q(`update atletas set nivel = 'intermedio', nutricion = false where id = $1 returning nivel`, [aAna.id]))[0].nivel === 'intermedio', 'el coach elige su nivel y su servicio');
  check(await falla(`update atletas set nivel = 'experto' where id = $1`, [aAna.id]), 'solo novato, intermedio o avanzado');
  await como(ana);
  check((await q(`select nivel, nutricion from atletas`))[0]?.nutricion === false, 'el atleta lee su ficha (la app oculta la nutrición)…');
  const cambia = await q(`update atletas set nutricion = true, nivel = 'avanzado' returning id`).catch(() => []);
  await su();
  const [d1] = await q(`select nutricion, nivel from atletas where id = $1`, [aAna.id]);
  check(cambia.length === 0 && d1.nutricion === false && d1.nivel === 'intermedio', '…pero no puede cambiarse ni el servicio ni el nivel');
  await q(`update atletas set nivel = null, nutricion = true where id = $1`, [aAna.id]);
  const sin17 = new PGlite();
  await sin17.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin17.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '017')) await sin17.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let errSin17 = null;
  try { await sin17.exec(readFileSync(new URL('../supabase/migraciones/018_servicio_y_nivel.sql', import.meta.url), 'utf8')); } catch (e) { errSin17 = e.message; }
  check(/Antes de la 018 hace falta la 017/.test(errSin17 || ''), 'la 018 no se aplica sin la 017');
  await sin17.close();
}

console.log('\nLa verificación en dos pasos falla cerrada');
await como(pelayo, 'aal2');
await q(`update perfiles set exige_2fa = true where id = $1`, [pelayo]);
await su();
await q(`delete from auth.mfa_factors where user_id = $1`, [pelayo]);
await como(pelayo, 'aal1');
check((await q(`select count(*)::int n from atletas`))[0].n === 0, 'aunque desaparezcan sus factores (o la base no pueda leerlos), sin segundo paso no ve nada');
check(await falla(`update perfiles set exige_2fa = false where id = $1`, [pelayo]), 'y con solo la contraseña no puede dejar de exigirlo');
await como(pelayo, 'aal2');
check((await q(`update perfiles set exige_2fa = false where id = $1 returning id`, [pelayo])).length === 1, 'con el segundo paso hecho, sí');
await como(pelayo, 'aal1');
check((await q(`select count(*)::int n from atletas`))[0].n === 2, 'sin factores ni exigencia, vuelve a entrar con la contraseña');

console.log('\nRepetir una migración antigua no deshace las siguientes');
check(await falla(`select * from fbe_migraciones`), 'la lista de migraciones aplicadas no la ve nadie desde la app');
await su();
const huella = async () => (await q(`select md5(string_agg(x, '|' order by x)) h from (
  select 'f:' || p.oid::regprocedure::text || ':' || md5(pg_get_functiondef(p.oid)) x from pg_proc p where p.pronamespace::regnamespace::text in ('public', 'fbe_privado') and p.prokind = 'f'
  union all select 'v:' || schemaname || '.' || viewname || ':' || md5(definition) from pg_views where schemaname in ('public', 'fbe_privado')
  union all select 'p:' || schemaname || '.' || tablename || '.' || policyname || ':' || md5(coalesce(qual, '') || '/' || coalesce(with_check, '') || '/' || cmd || '/' || array_to_string(roles, ',')) from pg_policies
  union all select 't:' || tgrelid::regclass::text || '.' || tgname || ':' || md5(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal
  union all select 'c:' || conrelid::regclass::text || '.' || conname || ':' || md5(pg_get_constraintdef(oid)) from pg_constraint where connamespace = 'public'::regnamespace
) s`))[0].h;
const antesRepetir = await huella();
const todas = migraciones();
const ultima = todas.at(-1);
const sqlDe = (m) => readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8');
let paradas = 0;
for (const m of todas.slice(0, -1)) {
  try { await db.exec(sqlDe(m)); } catch (e) { if (e.message.includes(`ya tiene la migración ${ultima.slice(0, 3)}`)) paradas++; }
}
check(paradas === todas.length - 1 && await huella() === antesRepetir, `repetir por error cualquiera anterior a la ${ultima.slice(0, 3)} se para con un aviso y no cambia nada (antes, la 002 quitaba en silencio la verificación en dos pasos)`);
await db.exec(sqlDe(ultima));
check(await huella() === antesRepetir, 'repetir la última no cambia nada');
await q(`delete from fbe_migraciones where numero > 2`);
for (const m of todas) await db.exec(sqlDe(m));
check(await huella() === antesRepetir && (await q(`select count(*)::int n from fbe_migraciones`))[0].n === todas.length,
  'y la salida que da el aviso (borrar su apunte, repetirla y después todas las siguientes) deja la base exactamente igual');

console.log('\nInstalación en un solo archivo (supabase/instalar.sql)');
const { generarInstalador } = await import('../scripts/instalador.mjs');
const instalador = readFileSync(new URL('../supabase/instalar.sql', import.meta.url), 'utf8');
check(instalador === generarInstalador(), 'instalar.sql está al día con schema.sql y las migraciones (si no, «npm run instalador»)');
const limpia = new PGlite();
await limpia.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
await limpia.exec(instalador);
const huellaDe = async (base) => (await base.query(`select md5(string_agg(x, '|' order by x)) h from (
  select 'f:' || p.oid::regprocedure::text || ':' || md5(pg_get_functiondef(p.oid)) x from pg_proc p where p.pronamespace::regnamespace::text in ('public', 'fbe_privado') and p.prokind = 'f'
  union all select 'v:' || schemaname || '.' || viewname || ':' || md5(definition) from pg_views where schemaname in ('public', 'fbe_privado')
  union all select 'p:' || schemaname || '.' || tablename || '.' || policyname || ':' || md5(coalesce(qual, '') || '/' || coalesce(with_check, '') || '/' || cmd || '/' || array_to_string(roles, ',')) from pg_policies
  union all select 't:' || tgrelid::regclass::text || '.' || tgname || ':' || md5(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal
  union all select 'c:' || conrelid::regclass::text || '.' || conname || ':' || md5(pg_get_constraintdef(oid)) from pg_constraint where connamespace = 'public'::regnamespace
) s`)).rows[0].h;
check(await huellaDe(limpia) === await huellaDe(db) && (await limpia.query(`select count(*)::int n from fbe_migraciones`)).rows[0].n === migraciones().length,
  'pegarlo en una base nueva deja exactamente lo mismo que schema.sql y las migraciones una a una');
let otraVez = null;
try { await limpia.exec(instalador); } catch (e) { otraVez = e.message; }
check(/ya tiene la app instalada/.test(otraVez || ''), 'y en una base que ya la tiene, se para con un aviso');
await limpia.close();

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
