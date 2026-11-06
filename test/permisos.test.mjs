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
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
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
// v0.54 (migración 032): lo suyo ya no lo borra a mano; lo elimina para todos con comentario_eliminar (en 48 horas)
check((await q(`delete from comentarios where id = $1 returning id`, [c1.id])).length === 0, 'ni borra a mano lo suyo (desde la 032, lo elimina para todos con su función)');
check((await q(`select comentario_eliminar($1) r`, [c1.id]))[0].r.estado === 'eliminado' && (await q(`select texto, eliminado_en from comentarios where id = $1`, [c1.id]))[0].texto === 'Se eliminó este mensaje', 'pero sí lo elimina para todos');
await su(); await q(`delete from comentarios where id = $1`, [c1.id]); await como(ana);

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
  && await malDib({ t: 1, formas: [{ tipo: 'espiral', p: [[0, 0], [1, 1]] }] }) && await malDib({ t: 1, formas: Array.from({ length: 25 }, () => ({ tipo: 'linea', p: [[0, 0], [1, 1]] })) })
  && await malDib({ t: 1, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]], color: 'rojo' }] })
  && await malDib({ t: 1, formas: [{ tipo: 'linea' }] }) && await malDib({ formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]] }] }) && await malDib({}),
  'solo con su forma exacta: momento de 0 a 3600, de 1 a 24 formas (035), líneas de 2 puntos y ángulos de 3, coordenadas de 0 a 1, sin campos de más ni de menos');
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
// (033) Ya no «contesta» poniendo en un mensaje suyo la foto que subió Ana (saldría en el chat como si la mandara él, y
// se podría reenviar): su foto del chat va en un mensaje suyo con un archivo suyo
check(await falla(`insert into comentarios (archivo_id, texto) values ($1, 'Con eso te apaño la sesión')`, [adj.id]), '(033) el coach no pone en un mensaje suyo la foto del chat que subió Ana');
const [adjC] = await q(`insert into archivos (atleta_id, tipo, ruta, mime, bytes) values ($1, 'adjunto', $2, 'image/jpeg', 90000) returning *`, [aAna.id, `${aAna.id}/adjunto-coach-1.jpg`]);
check(adjC.subido_por === 'coach' && adj.subido_por === 'atleta', '(033) la base apunta quién subió cada archivo');
const [rAdj] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Con eso te apaño la sesión') returning *`, [adjC.id]);
const [rVid] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Buena profundidad') returning *`, [vidP.id]);
check(rAdj.adjunto === true && rVid.adjunto === false, 'la marca del adjunto también la lleva la respuesta del coach');
const avisoAdj = await notis(`clave = $1`, ['comentario:' + rAdj.id]);
check(avisoAdj.length === 1 && avisoAdj[0].usuario_id === ana && avisoAdj[0].url === '#mensajes' && avisoAdj[0].titulo === 'Pelayo te ha escrito' && avisoAdj[0].cuerpo === 'Mensaje nuevo',
  `a Ana le llega como mensaje del chat (#mensajes, «te ha escrito», «Mensaje nuevo»): ${JSON.stringify(avisoAdj[0] || null)}`);
const avisoVid = await notis(`clave = $1`, ['comentario:' + rVid.id]);
check(avisoVid.length === 1 && avisoVid[0].url === `#videos/${vidP.id}` && avisoVid[0].titulo === 'Pelayo te ha respondido' && avisoVid[0].cuerpo === 'En tu vídeo', 'y la del vídeo del diario, como respuesta («En tu vídeo»; desde la 035, a ese vídeo: #videos/<id>)');
await como(luis);
check((await q(`update archivos set destacado = true where id = $1 returning id`, [vidP.id])).length === 0, 'Luis no toca los archivos de Ana');
await como(pelayo, 'aal2');
check((await q(`update archivos set revisado_en = now(), destacado = true where id = $1 returning revisado_en`, [vidP.id]))[0].revisado_en !== null, 'el coach sí lo revisa (y puede destacarlo)');
// (v0.54, tras la revisión de la 032) Un adjunto con mensajes ya no lo borra el atleta (eso va por comentario_eliminar); si
// lo borra el coach, sus mensajes quedan como eliminados
await como(ana);
check((await q(`delete from archivos where id = $1 returning id`, [adj.id])).length === 0, 'la atleta no borra un adjunto del chat que lleva mensajes');
await como(pelayo, 'aal2');
await q(`delete from archivos where id in ($1, $2)`, [adj.id, adjC.id]);
await como(ana);
check((await q(`select eliminado_en from comentarios where id in ($1, $2)`, [cAdj.id, rAdj.id])).every((x) => x.eliminado_en) && (await q(`select archivo_id from comentarios where id = $1`, [cVid.id])).length === 1,
  'al borrar el coach un adjunto, sus mensajes quedan como eliminados (los dos); los comentarios de un vídeo del diario se quedan');
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
  check(await falla(`update atletas set nivel = 'experto' where id = $1`, [aAna.id]) && !(await falla(`update atletas set nivel = 'novato_intermedio' where id = $1`, [aAna.id])), 'solo novato, novato/intermedio, intermedio o avanzado');
  await q(`update atletas set nivel = 'intermedio' where id = $1`, [aAna.id]);
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

console.log('\nTablas nuevas cerradas por defecto (migración 019)');
{
  await su();
  await q(`create table public.prueba_019 (id int primary key, x text)`);
  await q(`create sequence public.prueba_019_seq`);
  await q(`create function public.prueba_019_f() returns int language sql as 'select 1'`);
  const g = await q(`select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'prueba_019' and grantee in ('anon', 'authenticated')`);
  check(g.length === 0, 'una tabla nueva nace sin permisos para anon ni para las cuentas de la app (aunque se olvide su permiso, nadie la lee)');
  const seq = await q(`select has_sequence_privilege('anon', 'public.prueba_019_seq', 'usage') a, has_sequence_privilege('authenticated', 'public.prueba_019_seq', 'usage') u`);
  const fn = await q(`select has_function_privilege('anon', 'public.prueba_019_f()', 'execute') a`);
  check(!seq[0].a && !seq[0].u && !fn[0].a, 'tampoco sus secuencias, y sus funciones no las ejecuta nadie sin sesión');
  for (const x of ['table public.prueba_019', 'sequence public.prueba_019_seq', 'function public.prueba_019_f()']) await q(`drop ${x}`);
  const anonTablas = await q(`select count(*)::int n from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'`);
  const sinRls = await q(`select count(*)::int n from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`);
  check(anonTablas[0].n === 0 && sinRls[0].n === 0, 'sin sesión no se toca ninguna tabla, y todas las tablas tienen permisos por fila');
  const vistas = await q(`select count(*)::int n from information_schema.role_table_grants g join pg_class c on c.relname = g.table_name and c.relnamespace = 'public'::regnamespace
    where g.table_schema = 'public' and c.relkind = 'v' and g.grantee in ('anon', 'authenticated') and g.privilege_type <> 'SELECT'`);
  check(vistas[0].n === 0, 'las vistas solo se leen');
  const sin18 = new PGlite();
  await sin18.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin18.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '018')) await sin18.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let errSin18 = null;
  try { await sin18.exec(readFileSync(new URL('../supabase/migraciones/019_tablas_cerradas.sql', import.meta.url), 'utf8')); } catch (e) { errSin18 = e.message; }
  check(/Antes de la 019 hace falta la 018/.test(errSin18 || ''), 'la 019 no se aplica sin la 018');
  await sin18.close();
}

console.log('\nControl de cobros, privado del coach (migración 020)');
{
  await como(pelayo, 'aal2');
  await q(`insert into cobros_atletas (atleta_id, servicio, precio_mes, ciclo, desde) values ($1, 'Performance', 75, 'trimestral', '2026-07-20')`, [aAna.id]);
  const [pg] = await q(`insert into pagos (atleta_id, periodo_desde, periodo_hasta, importe, estado, fecha_pago, metodo) values ($1, '2026-10-20', '2027-01-19', 225, 'pagado', '2026-10-21', 'transferencia') returning id`, [aAna.id]);
  await q(`insert into pagos (atleta_id, periodo_desde, periodo_hasta, importe) values ($1, '2027-01-20', '2027-04-19', 225)`, [aAna.id]);
  check((await q(`select count(*)::int n from pagos where atleta_id = $1`, [aAna.id]))[0].n === 2, 'el coach apunta lo acordado con Ana y sus cobros');
  check(await falla(`insert into pagos (atleta_id, periodo_desde, periodo_hasta, importe, estado, fecha_pago) values ($1, '2026-11-01', '2026-11-30', 50, 'pendiente', '2026-11-02')`, [aAna.id])
    && await falla(`insert into pagos (atleta_id, periodo_desde, periodo_hasta, importe) values ($1, '2026-11-30', '2026-11-01', 50)`, [aAna.id])
    && await falla(`insert into pagos (atleta_id, periodo_desde, periodo_hasta, importe, metodo) values ($1, '2026-11-01', '2026-11-30', 50, 'cripto')`, [aAna.id])
    && await falla(`insert into cobros_atletas (atleta_id, ciclo) values ($1, 'semanal')`, [aLuis.id]),
    'con sentido: fecha de pago solo si está pagado, periodo en orden, métodos y ciclos conocidos');
  await como(ana);
  check((await q(`select count(*)::int n from pagos`))[0].n === 0 && (await q(`select count(*)::int n from cobros_atletas`))[0].n === 0, 'Ana no ve sus cobros ni lo acordado (ni preguntando a la base)');
  check(await falla(`insert into pagos (atleta_id, periodo_desde, periodo_hasta, importe, estado, fecha_pago) values ($1, '2026-11-01', '2026-11-30', 0, 'pagado', '2026-11-01')`, [aAna.id])
    && (await q(`update pagos set estado = 'pagado' where id = $1 returning id`, [pg.id]).catch(() => [])).length === 0, 'ni puede apuntarse ni cambiarse un pago');
  await anon();
  check(await falla(`select * from pagos`) && await falla(`select * from cobros_atletas`), 'sin sesión, nada');
  await como(pelayo, 'aal1');
  await su();
  const mfa = (await q(`select count(*)::int n from auth.mfa_factors where user_id = $1 and status = 'verified'`, [pelayo]))[0].n;
  await como(pelayo, 'aal1');
  const vistosAal1 = (await q(`select count(*)::int n from pagos`))[0].n;
  check(mfa === 0 || vistosAal1 === 0, 'con la verificación en dos pasos activada, sin el segundo paso tampoco los ve el coach');
  await su();
  const [aTmp] = await q(`insert into atletas (nombre) values ('Temporal') returning id`);
  await q(`insert into pagos (atleta_id, periodo_desde, periodo_hasta, importe) values ($1, '2026-11-01', '2026-11-30', 49)`, [aTmp.id]);
  await q(`insert into cobros_atletas (atleta_id, precio_mes) values ($1, 49)`, [aTmp.id]);
  await q(`delete from atletas where id = $1`, [aTmp.id]);
  check((await q(`select count(*)::int n from pagos where atleta_id = $1`, [aTmp.id]))[0].n === 0 && (await q(`select count(*)::int n from cobros_atletas where atleta_id = $1`, [aTmp.id]))[0].n === 0, 'se borran con el atleta');
  // La app pagina ordenando por la clave de cada tabla: las que no tienen «id» tienen que estar en CLAVE_TABLA
  const { CLAVE_TABLA } = await import('../web/src/datos/backend-supabase.js');
  const sinId = (await q(`select c.relname t from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
    and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'id' and not a.attisdropped)`)).map((x) => x.t).filter((t) => !t.startsWith('v_') && t !== 'fbe_migraciones' && t !== 'errores_app');
  check(sinId.every((t) => CLAVE_TABLA[t]), `las tablas sin «id» (${sinId.join(', ')}) tienen su clave para paginar en la app`);
  // Migración 021: el atleta ve solo el resumen (mi_cobro), calculado en la base
  await como(ana);
  const [c0] = await q(`select * from mi_cobro()`);
  check(c0 && c0.pagado_hasta && Number(c0.debe) === 0 && ['al_dia', 'vence_pronto', 'vencido'].includes(c0.estado) && Object.keys(c0).join() === 'pagado_hasta,debe,debe_desde,estado',
    `Ana ve cómo va (pagado hasta ${c0?.pagado_hasta?.toISOString?.().slice(0, 10) ?? c0?.pagado_hasta}, ${c0?.estado}), solo eso: ni precio, ni notas, ni la lista de cobros`);
  await como(pelayo, 'aal2');
  await q(`insert into pagos (atleta_id, periodo_desde, periodo_hasta, importe, estado) values ($1, current_date - 40, current_date - 10, 95, 'retrasado'), ($1, current_date - 9, current_date + 20, 95, 'pendiente'), ($1, current_date + 21, current_date + 50, 95, 'pendiente')`, [aAna.id]);
  await como(ana);
  const [c1] = await q(`select * from mi_cobro()`);
  check(c1.estado === 'retrasado' && Number(c1.debe) === 190, `con un periodo retrasado y otro pendiente ya empezados: debe 190 € (los que aún no han empezado no cuentan) y sale retrasado`);
  await como(luis);
  check((await q(`select * from mi_cobro()`)).length === 0, 'sin cobros apuntados, nada (la app no enseña nada)');
  await como(pelayo, 'aal2');
  check((await q(`select * from mi_cobro()`)).length === 0, 'el coach no tiene «mi cobro»');
  await q(`delete from pagos where atleta_id = $1 and importe = 95`, [aAna.id]);
  await anon();
  check(await falla(`select * from mi_cobro()`), 'sin sesión, nada');
  await su();
  const sin20 = new PGlite();
  await sin20.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin20.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '020')) await sin20.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let errSin20 = null;
  try { await sin20.exec(readFileSync(new URL('../supabase/migraciones/021_mi_cobro.sql', import.meta.url), 'utf8')); } catch (e) { errSin20 = e.message; }
  check(/Antes de la 021 hace falta la 020/.test(errSin20 || ''), 'la 021 no se aplica sin la 020');
  await sin20.close();
  const sin19 = new PGlite();
  await sin19.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin19.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '019')) await sin19.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let errSin19 = null;
  try { await sin19.exec(readFileSync(new URL('../supabase/migraciones/020_cobros.sql', import.meta.url), 'utf8')); } catch (e) { errSin19 = e.message; }
  check(/Antes de la 020 hace falta la 019/.test(errSin19 || ''), 'la 020 no se aplica sin la 019');
  await sin19.close();
}

console.log('\nRecetas, recetario y menú; solo nutrición (migración 022)');
{
  await su();
  await q(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await q(`insert into consentimientos (perfil_id, tipo, version) select $1, 'datos_salud', '2026-10' where not exists (select 1 from consentimientos where perfil_id = $1 and tipo = 'datos_salud' and revocado_en is null)`, [ana]);
  await como(pelayo, 'aal2');
  const [r1] = await q(`insert into recetas (nombre, tomas, raciones, kcal, proteina_g, ingredientes) values ('Porridge', '{desayuno}', 1, 505, 38, '[{"nombre":"Avena","cantidad":50,"unidad":"g"},{"nombre":"Canela"}]') returning id, creada_en`);
  const [r2] = await q(`insert into recetas (nombre, tomas) values ('Lentejas', '{comida}') returning id`);
  const [r3] = await q(`insert into recetas (nombre, tomas) values ('Solo de Luis', '{cena}') returning id`);
  check(await falla(`insert into recetas (nombre, tomas) values ('X', '{brunch}')`) && await falla(`insert into recetas (nombre, ingredientes) values ('X', '[{"nombre":"Avena","cantidad":-5}]')`)
    && await falla(`insert into recetas (nombre, raciones) values ('X', 0)`) && await falla(`insert into recetas (nombre, foto) values ('X', 'data:image/svg+xml;base64,AAAA')`) && await falla(`insert into recetas (nombre) values ('   ')`)
    && await falla(`insert into recetas (nombre, etiquetas) values ('X', array[''])`), 'recetas con sentido: tomas conocidas, ingredientes bien formados, raciones, foto JPEG/WebP, nombre visible, etiquetas');
  const [a1] = await q(`insert into recetas_atleta (atleta_id, receta_id, toma, factor) values ($1, $2, 'desayuno', 1.5) returning id`, [aAna.id, r1.id]);
  await q(`insert into recetas_atleta (atleta_id, receta_id, toma) values ($1, $2, 'cena')`, [aLuis.id, r3.id]);
  check(await falla(`insert into recetas_atleta (atleta_id, receta_id, toma) values ($1, $2, 'desayuno')`, [aAna.id, r1.id]) && await falla(`insert into recetas_atleta (atleta_id, receta_id, toma, factor) values ($1, $2, 'comida', 9)`, [aAna.id, r2.id]),
    'una receta va una vez por toma en el recetario de cada atleta, con un factor razonable');
  await como(ana);
  const vistas = (await q(`select nombre from recetas order by nombre`)).map((x) => x.nombre);
  check(vistas.join() === 'Porridge', `Ana solo ve las recetas de su recetario (${vistas.join(', ')}), no las demás ni las de Luis`);
  check((await q(`select count(*)::int n from recetas_atleta`))[0].n === 1, 'y solo su recetario');
  check(await falla(`insert into recetas (nombre) values ('Mía')`) && (await q(`update recetas set nombre = 'Cambiada' where id = $1 returning id`, [r1.id]).catch(() => [])).length === 0
    && await falla(`insert into recetas_atleta (atleta_id, receta_id, toma) values ($1, $2, 'comida')`, [aAna.id, r2.id]), 'no puede crear ni cambiar recetas, ni ponerse recetas');
  check(await falla(`update recetas_atleta set factor = 3 where id = $1`, [a1.id]) && await falla(`update recetas_atleta set nota = 'me la pongo yo' where id = $1`, [a1.id]),
    'ni tocar su factor o la nota del coach');
  const [pedido] = await q(`update recetas_atleta set favorita = true, cambio_pedido_en = '2000-01-01', cambio_nota = 'Sin canela, por favor' returning favorita, cambio_pedido_en, cambio_nota`);
  check(pedido.favorita && new Date(pedido.cambio_pedido_en).getFullYear() > 2020 && pedido.cambio_nota === 'Sin canela, por favor', 'sí puede marcarla como favorita y pedir que se la cambien (la fecha la pone la base)');
  await como(pelayo, 'aal2');
  const [res] = await q(`update recetas_atleta set cambio_pedido_en = null where id = $1 returning cambio_nota`, [a1.id]);
  check(res.cambio_nota === null, 'el coach la da por resuelta (y la nota se va con la petición)');
  // Comidas del día
  await como(ana);
  await q(`insert into comidas_atleta (atleta_id, tomas) values ($1, '{desayuno,comida,cena}')`, [aAna.id]);
  check(await falla(`insert into comidas_atleta (atleta_id, tomas) values ($1, '{cena}')`, [aLuis.id]) && await falla(`update comidas_atleta set tomas = '{cena,cena}'`) && await falla(`update comidas_atleta set tomas = '{}'`),
    'elige sus comidas del día (no las de otro; sin repetir y al menos una)');
  // Menú: dato de salud, solo recetas de su recetario o texto
  const [m1] = await q(`insert into menu_comidas (atleta_id, fecha, toma, receta_id, texto, kcal) values ($1, current_date, 'desayuno', $2, 'Porridge', 757.5) returning id`, [aAna.id, r1.id]);
  await q(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, current_date, 'comida', 'Comida fuera')`, [aAna.id]);
  check(await falla(`insert into menu_comidas (atleta_id, fecha, toma, receta_id, texto) values ($1, current_date, 'comida', $2, 'Lentejas')`, [aAna.id, r2.id]), 'en su menú solo entran recetas de su recetario (o lo que escriba)');
  check(await falla(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, current_date, 'cena', 'Ajena')`, [aLuis.id]) && await falla(`insert into menu_comidas (atleta_id, fecha, toma, texto, raciones) values ($1, current_date, 'cena', 'X', 50)`, [aAna.id])
    && await falla(`update menu_comidas set atleta_id = $1 where id = $2`, [aLuis.id, m1.id]), 'ni en el de otro, ni raciones imposibles, ni pasar una comida a otro atleta');
  check((await q(`update menu_comidas set hecho = true where id = $1 returning hecho`, [m1.id]))[0]?.hecho === true, 'marca lo que se ha comido');
  await como(luis);
  check((await q(`select count(*)::int n from menu_comidas`))[0].n === 0 && (await q(`select count(*)::int n from comidas_atleta`))[0].n === 0, 'Luis no ve el menú ni las comidas de Ana');
  await su();
  await q(`update consentimientos set revocado_en = now() where perfil_id = $1 and tipo = 'datos_salud' and revocado_en is null`, [ana]);
  await como(ana);
  check(await falla(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, current_date, 'cena', 'Sin permiso')`, [aAna.id]), 'sin su consentimiento de datos de salud, no se apunta en el menú');
  await como(pelayo, 'aal2');
  check(await falla(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, current_date, 'cena', 'Del coach')`, [aAna.id]), 'tampoco el coach por él');
  await su();
  await q(`insert into consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', '2026-10')`, [ana]);
  await q(`update atletas set estado = 'baja' where id = $1`, [aAna.id]);
  await como(ana);
  check(await falla(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, current_date, 'cena', 'De baja')`, [aAna.id]) && await falla(`update recetas_atleta set favorita = false`), 'de baja, ni el menú ni su recetario');
  await su();
  await q(`update atletas set estado = 'activo' where id = $1`, [aAna.id]);
  // Borrar la receta: sale de los recetarios y en el menú se queda el nombre
  await como(pelayo, 'aal2');
  await q(`delete from recetas where id = $1`, [r1.id]);
  const [m1b] = await q(`select receta_id, texto from menu_comidas where id = $1`, [m1.id]);
  check(m1b.receta_id === null && m1b.texto === 'Porridge' && (await q(`select count(*)::int n from recetas_atleta where receta_id = $1`, [r1.id]))[0].n === 0, 'borrar una receta la quita de los recetarios; en el menú se queda su nombre');
  // Solo nutrición: siempre se lleva al menos una cosa
  check(await falla(`update atletas set entrenamiento = false, nutricion = false where id = $1`, [aLuis.id]), 'un atleta siempre tiene entrenamiento, nutrición o las dos');
  await q(`update atletas set entrenamiento = false where id = $1`, [aLuis.id]);
  check((await q(`select entrenamiento from atletas where id = $1`, [aLuis.id]))[0].entrenamiento === false, 'solo nutrición');
  const vie4 = await dia(11);
  await su();
  await q(`insert into sesiones (semana_id, orden, nombre, dia_previsto) values ($1, 7, 'Pierna C', $2::date)`, [w2L.id, vie4]);
  await servidor();
  await q(`select crear_recordatorios(${enMadrid(vie4, '08:45')})`);
  check((await notis(`clave = $1 and usuario_id = $2`, [`recordatorio_sesion:${vie4}`, luis])).length === 0, 'a quien solo lleva la nutrición no le llega «Hoy toca…» aunque conserve sesiones planificadas');
  await como(pelayo, 'aal2');
  await q(`update atletas set entrenamiento = true where id = $1`, [aLuis.id]);
  await servidor();
  await q(`select crear_recordatorios(${enMadrid(vie4, '08:50')})`);
  check((await notis(`clave = $1 and usuario_id = $2`, [`recordatorio_sesion:${vie4}`, luis])).length === 1, 'y con el entrenamiento otra vez, sí');
  await como(pelayo, 'aal2');
  await como(luis);
  check(await falla(`update atletas set entrenamiento = false where id = $1`, [aLuis.id]) || (await q(`select entrenamiento from atletas where id = $1`, [aLuis.id]))[0].entrenamiento === true, 'el atleta no cambia su servicio');
  await anon();
  check(await falla(`select * from recetas`) && await falla(`select * from menu_comidas`) && await falla(`select * from recetas_atleta`) && await falla(`select * from comidas_atleta`), 'sin sesión, nada');
  await su();
  const [aTmp] = await q(`insert into atletas (nombre) values ('Temporal 22') returning id`);
  await q(`insert into recetas_atleta (atleta_id, receta_id, toma) values ($1, $2, 'comida')`, [aTmp.id, r2.id]);
  await q(`insert into comidas_atleta (atleta_id) values ($1)`, [aTmp.id]);
  await q(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, current_date, 'comida', 'X')`, [aTmp.id]);
  await q(`delete from atletas where id = $1`, [aTmp.id]);
  check((await q(`select (select count(*) from recetas_atleta where atleta_id = $1) + (select count(*) from comidas_atleta where atleta_id = $1) + (select count(*) from menu_comidas where atleta_id = $1) n`, [aTmp.id]))[0].n == 0, 'se borra todo con el atleta');
  await su();
  const sin21 = new PGlite();
  await sin21.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin21.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '021')) await sin21.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let err = null;
  try { await sin21.exec(readFileSync(new URL('../supabase/migraciones/022_comidas.sql', import.meta.url), 'utf8')); } catch (e) { err = e.message; }
  check(/Antes de la 022 hace falta la 021/.test(err || ''), 'la 022 no se aplica sin la 021');
  await sin21.close();
}

console.log('\nDías sin una comida (migración 023)');
{
  await como(pelayo, 'aal2');
  const [rx] = await q(`insert into recetas (nombre, tomas) values ('Pasta 023', '{comida}') returning id`);
  await q(`update comidas_atleta set tomas = '{desayuno,comida,merienda,cena}', opcional = 'merienda' where atleta_id = $1`, [aAna.id]);
  check((await q(`select opcional from comidas_atleta where atleta_id = $1`, [aAna.id]))[0].opcional === 'merienda', 'el coach marca la merienda como la comida que algunos días no hace');
  await q(`update comidas_atleta set opcional = 'recena' where atleta_id = $1`, [aAna.id]);
  check((await q(`select opcional from comidas_atleta where atleta_id = $1`, [aAna.id]))[0].opcional === null, 'una que no está entre sus comidas no vale (se queda sin opcional)');
  await q(`update comidas_atleta set opcional = 'merienda' where atleta_id = $1`, [aAna.id]);
  await como(ana);
  await q(`update comidas_atleta set opcional = null, tomas = '{desayuno,comida,merienda,cena}' where atleta_id = $1`, [aAna.id]);
  check((await q(`select opcional from comidas_atleta where atleta_id = $1`, [aAna.id]))[0].opcional === 'merienda', 'el atleta no cambia cuál es la opcional');
  await q(`update comidas_atleta set tomas = '{desayuno,comida,cena}' where atleta_id = $1`, [aAna.id]);
  check((await q(`select opcional from comidas_atleta where atleta_id = $1`, [aAna.id]))[0].opcional === null, 'pero si deja de merendar, ya no hay comida opcional');
  await como(pelayo, 'aal2');
  await q(`update comidas_atleta set tomas = '{desayuno,comida,merienda,cena}', opcional = 'merienda' where atleta_id = $1`, [aAna.id]);
  // La misma receta, una vez para cada tipo de día
  const [v1] = await q(`insert into recetas_atleta (atleta_id, receta_id, toma) values ($1, $2, 'comida') returning id`, [aAna.id, rx.id]);
  const [v2] = await q(`insert into recetas_atleta (atleta_id, receta_id, toma, factor, variante) values ($1, $2, 'comida', 1.25, 'sin') returning id`, [aAna.id, rx.id]);
  check(!!v1 && !!v2 && await falla(`insert into recetas_atleta (atleta_id, receta_id, toma, variante) values ($1, $2, 'comida', 'sin')`, [aAna.id, rx.id])
    && await falla(`insert into recetas_atleta (atleta_id, receta_id, toma) values ($1, $2, 'comida')`, [aAna.id, rx.id]) && await falla(`insert into recetas_atleta (atleta_id, receta_id, toma, variante) values ($1, $2, 'cena', 'a veces')`, [aAna.id, rx.id]),
    'la misma receta puede ir en una comida para los días con merienda y para los días sin ella, una vez cada una');
  await como(ana);
  check(await falla(`update recetas_atleta set variante = null where id = $1`, [v2.id]) && (await q(`select count(*)::int n from recetas_atleta where receta_id = $1`, [rx.id]))[0].n === 2, 'el atleta ve las dos, pero no cambia para qué días es cada una');
  // Sus días sin merienda
  const lunes23 = (await q(`select (current_date - (extract(isodow from current_date)::int - 1))::text d`))[0].d;
  await q(`insert into menu_dias (atleta_id, fecha) values ($1, $2::date + 6)`, [aAna.id, lunes23]);
  check((await q(`select count(*)::int n from menu_dias`))[0].n === 1 && await falla(`insert into menu_dias (atleta_id, fecha) values ($1, $2::date + 6)`, [aAna.id, lunes23])
    && await falla(`insert into menu_dias (atleta_id, fecha) values ($1, $2)`, [aLuis.id, lunes23]) && await falla(`update menu_dias set fecha = fecha + 1`), 'Ana marca un día sin merienda (una vez; no en el menú de otro, y no se cambia: se quita y se pone)');
  await como(luis);
  check((await q(`select count(*)::int n from menu_dias`))[0].n === 0, 'Luis no ve los días de Ana');
  await su();
  await q(`update consentimientos set revocado_en = now() where perfil_id = $1 and tipo = 'datos_salud'`, [ana]);
  await como(ana);
  check(await falla(`insert into menu_dias (atleta_id, fecha) values ($1, $2::date + 5)`, [aAna.id, lunes23]), 'sin el consentimiento de salud, no');
  await como(pelayo, 'aal2');
  check(await falla(`insert into menu_dias (atleta_id, fecha) values ($1, $2::date + 5)`, [aAna.id, lunes23]), 'ni el coach');
  await su();
  await q(`update consentimientos set revocado_en = null where perfil_id = $1 and tipo = 'datos_salud'`, [ana]);
  await como(ana);
  await q(`delete from menu_dias where atleta_id = $1`, [aAna.id]);
  check((await q(`select count(*)::int n from menu_dias`))[0].n === 0, 'y lo quita cuando quiere');
  await anon();
  check(await falla(`select * from menu_dias`), 'sin sesión, nada');
  await su();
  const sin22 = new PGlite();
  await sin22.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin22.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '022')) await sin22.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let err23 = null;
  try { await sin22.exec(readFileSync(new URL('../supabase/migraciones/023_dia_sin_toma.sql', import.meta.url), 'utf8')); } catch (e) { err23 = e.message; }
  check(/Antes de la 023 hace falta la 022/.test(err23 || ''), 'la 023 no se aplica sin la 022');
  await sin22.close();
}

console.log('\nPauta serie a serie (migración 024)');
{
  await como(pelayo, 'aal2');
  const [se] = await q(`select se.id, se.series from sesion_ejercicios se join sesiones s on s.id = se.sesion_id where s.semana_id = $1 and se.backoff_pct is null order by s.orden, se.orden limit 1`, [wAna1.id]);
  const det = JSON.stringify([{ reps: 8, kg: 25, rpe: 7 }, { reps: 10, kg: 22.5 }, { reps: 12, rpe: 9 }]);
  check((await q(`update sesion_ejercicios set series = 3, series_detalle = $2::jsonb where id = $1 returning series_detalle`, [se.id, det]))[0].series_detalle.length === 3,
    'el coach pauta cada serie con sus reps, kilos y RPE (cada uno opcional)');
  check(await falla(`update sesion_ejercicios set series = 4 where id = $1`, [se.id])
    && await falla(`update sesion_ejercicios set series_detalle = '[{"reps":8,"peso":25},{"reps":8},{"reps":8}]' where id = $1`, [se.id])
    && await falla(`update sesion_ejercicios set series_detalle = '[{"reps":8.5},{"reps":8},{"reps":8}]' where id = $1`, [se.id])
    && await falla(`update sesion_ejercicios set series_detalle = '[{"rpe":11},{"reps":8},{"reps":8}]' where id = $1`, [se.id])
    && await falla(`update sesion_ejercicios set series_detalle = '[{"kg":"25"},{"reps":8},{"reps":8}]' where id = $1`, [se.id])
    && await falla(`update sesion_ejercicios set backoff_pct = 10 where id = $1`, [se.id]),
    'tantas como series, solo reps/kg/rpe con números válidos, y no a la vez que top + back-off');
  const wDet = (await q(`select duplicar_semana($1) w`, [wAna1.id]))[0].w;
  const copia = await q(`select se.series_detalle from sesion_ejercicios se join sesiones s on s.id = se.sesion_id where s.semana_id = $1 and se.series_detalle is not null`, [wDet]);
  const wDet2 = (await q(`select duplicar_semana($1, 2.5) w`, [wAna1.id]))[0].w;
  const copia2 = await q(`select se.series_detalle from sesion_ejercicios se join sesiones s on s.id = se.sesion_id where s.semana_id = $1 and se.series_detalle is not null`, [wDet2]);
  check(copia.length === 1 && copia2.length === 0, 'duplicar la semana lo copia (y si suben los kilos, sin detalle, que dejaría de cuadrar)');
  await q(`delete from semanas where id = any($1)`, [[wDet, wDet2]]);
  await como(ana);
  check((await q(`update sesion_ejercicios set series_detalle = null where id = $1 returning id`, [se.id])).length === 0 || await falla(`update sesion_ejercicios set series_detalle = null where id = $1`, [se.id]), 'el atleta no lo cambia');
  await como(pelayo, 'aal2');
  await q(`update sesion_ejercicios set series_detalle = null where id = $1`, [se.id]);
}

console.log('\nModo atleta del coach: su propia ficha, vinculada a su cuenta (v0.37, sin migración)');
{
  await como(pelayo, 'aal2');
  const [yo] = await q(`insert into atletas (nombre, perfil_id, estado, nutricion) values ('Pelayo', $1, 'activo', false) returning id`, [pelayo]);
  check((await q(`select mi_atleta_id() id, es_coach() c`))[0].id === yo.id && (await q(`select es_coach() c`))[0].c === true,
    'el coach crea su ficha de atleta vinculada a su cuenta y sigue siendo coach');
  const bYo = (await q(`select crear_bloque_desde_plantilla($1, $2, $3) b`, [pl.id, yo.id, lunes]))[0].b;
  await q(`update bloques set estado = 'activo' where id = $1`, [bYo]);
  await q(`update semanas set programacion = 'programada' where bloque_id = $1`, [bYo]);
  const [seYo] = await q(`select se.id, s.id sesion from sesion_ejercicios se join sesiones s on s.id = se.sesion_id join semanas w on w.id = s.semana_id where w.bloque_id = $1 order by s.orden, se.orden limit 1`, [bYo]);
  const [sYo] = await q(`insert into series (sesion_ejercicio_id, numero, kg, reps, rpe) values ($1, 1, 60, 8, 8) returning atleta_id`, [seYo.id]);
  await q(`update sesiones set completada = true, fecha_realizada = current_date where id = $1`, [seYo.sesion]);
  check(sYo.atleta_id === yo.id, 'en su modo atleta registra sus series (se apuntan a su ficha) y termina la sesión');
  check((await notis(`tipo = 'sesion_hecha' and clave = $1`, ['sesion:' + seYo.sesion])).length === 0, 'terminar su propia sesión no le avisa a sí mismo');
  await como(ana);
  check((await q(`select id from series where atleta_id = $1`, [yo.id])).length === 0 && (await q(`select id from bloques where id = $1`, [bYo])).length === 0
    && (await q(`select id from atletas where id = $1`, [yo.id])).length === 0, 'un atleta no ve nada del entrenamiento del coach');
  await como(pelayo, 'aal2');
  check(await falla(`select canjear_invitacion('FBE-AAAAA-AAAAA')`), 'y el coach sigue sin poder canjear códigos');
  await q(`delete from atletas where id = $1`, [yo.id]);
}

console.log('\nAviso del fin del descanso con la app en segundo plano (migración 025)');
{
  await como(luis);
  const fin = (seg) => new Date(Date.now() + seg * 1000).toISOString();
  check((await q(`select programar_descanso($1, 'Serie 2 de press banca') r`, [fin(90)]))[0].r === 'ok', 'Luis (con su móvil activado) programa el aviso de su descanso');
  let [d] = await notis(`usuario_id = $1 and clave = 'descanso'`, [luis]);
  check(d && d.tipo === 'descanso' && d.estado === 'pendiente' && d.cuerpo === 'Ahora: Serie 2 de press banca'
    && Math.abs(new Date(d.enviar_desde) - (Date.now() + 91000)) < 5000, 'sale un segundo después del final, con lo que toca después');
  await como(luis);
  await q(`select programar_descanso($1, 'Serie 2 de press banca')`, [fin(105)]);
  const todas = await notis(`usuario_id = $1 and clave = 'descanso'`, [luis]);
  check(todas.length === 1 && new Date(todas[0].enviar_desde) > new Date(d.enviar_desde), 'con +15 (o un descanso nuevo) se cambia la misma, no se apila otra');
  await como(luis);
  check(await falla(`select programar_descanso($1)`, [fin(3600)]) && await falla(`select programar_descanso($1)`, [fin(-120)]), 'solo para un descanso que acaba en los próximos 30 minutos');
  await como(ana);
  check((await q(`select programar_descanso($1) r`, [fin(60)]))[0].r === 'sin_canal', 'sin ningún móvil activado no se programa nada');
  await q(`select cancelar_descanso()`);
  check((await notis(`usuario_id = $1 and clave = 'descanso'`, [luis])).length === 1, 'anular el suyo no toca el de nadie');
  await como(luis);
  await q(`select cancelar_descanso()`);
  check((await notis(`usuario_id = $1 and clave = 'descanso'`, [luis])).length === 0, 'si suena la app (o se salta el descanso), se anula');
  await su();
  await q(`insert into preferencias_notificaciones (usuario_id, desactivados) values ($1, '{descanso}') on conflict (usuario_id) do update set desactivados = array_append(preferencias_notificaciones.desactivados, 'descanso')`, [luis]);
  await como(luis);
  check((await q(`select programar_descanso($1) r`, [fin(60)]))[0].r === 'desactivado', 'quien lo desactiva en Notificaciones no lo recibe');
  await su();
  await q(`update preferencias_notificaciones set desactivados = array_remove(desactivados, 'descanso') where usuario_id = $1`, [luis]);
  await como(luis);
  await q(`select programar_descanso($1, 'Sentadilla')`, [fin(-2)]);
  await servidor();
  const lote = await q(`select * from notificaciones_por_enviar(100)`);
  check(lote.some((n) => n.tipo === 'descanso' && n.usuario_id === luis), 'cuando ya toca, la función de envío la coge como las demás');
  await su();
  await q(`select fbe_privado.disparar_descansos()`);
  check(true, 'el disparador de cada 5 s no falla sin Vault ni pg_net (aquí no están)');
  await q(`delete from notificaciones where clave = 'descanso'`);
  await db.exec('reset role');
  check(await falla(`set role anon; select programar_descanso(now() + interval '1 minute')`), 'sin sesión no se puede');
  await db.exec('reset role');
}

console.log('\nEl peso, a diario o una vez a la semana (migración 026)');
{
  await su();
  const [fa] = await q(`select id from atletas where perfil_id = $1`, [ana]);
  await como(ana);
  await q(`update atletas set peso_frecuencia = 'semanal' where perfil_id = $1`, [ana]);
  await su();
  check((await q(`select peso_frecuencia f from atletas where id = $1`, [fa.id]))[0].f === 'diario', 'el atleta no puede cambiar cómo se le pide el peso (lo decide el coach)');
  await como(pelayo, 'aal2');
  check(await falla(`update atletas set peso_frecuencia = 'mensual' where id = $1`, [fa.id]), 'solo «diario» o «semanal»');
  await q(`update atletas set peso_frecuencia = 'semanal' where id = $1`, [fa.id]);
  check((await q(`select peso_frecuencia f from atletas where id = $1`, [fa.id]))[0].f === 'semanal', 'el coach sí');
  await q(`update atletas set peso_frecuencia = 'diario' where id = $1`, [fa.id]);
}

console.log('\nLa comunidad del equipo (migración 027)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const version = 'comunidad-2026-11-b'; // (el texto de la 029)
  const normas = 'normas-2026-11';
  await su();
  const lunesM = (await q(`select ((now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid'))::integer - 1)) d`))[0].d;
  // Una semana nueva para Ana y otra para Luis (la de esta semana, publicada): para el ranking y para compartir
  await como(pelayo, 'aal2');
  const bCA = (await q(`select crear_bloque_desde_plantilla($1, $2, $3) b`, [pl.id, aAna.id, lunesM]))[0].b;
  const bCL = (await q(`select crear_bloque_desde_plantilla($1, $2, $3) b`, [pl.id, aLuis.id, lunesM]))[0].b;
  await q(`update bloques set numero = 90 where id = any($1::uuid[])`, [[bCA, bCL]]);
  await q(`update semanas set programacion = 'programada' where bloque_id = any($1::uuid[])`, [[bCA, bCL]]);
  const [sCA] = await q(`select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $1 order by s.orden limit 1`, [bCA]);
  const [sCL] = await q(`select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $1 order by s.orden limit 1`, [bCL]);
  const pautasCA = await q(`select id, ejercicio_id from sesion_ejercicios where sesion_id = $1 order by orden`, [sCA.id]);

  // Cerrada de entrada
  await como(ana);
  check((await q(`select activa from comunidad_ajustes`))[0]?.activa === false, 'de entrada la comunidad está cerrada (y cualquier cuenta puede saberlo)');
  check((await q(`update comunidad_ajustes set activa = true returning id`)).length === 0, 'un atleta no la abre');
  check(await falla(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]), 'cerrada, nadie puede entrar');
  await como(pelayo, 'aal2');
  await q(`update comunidad_ajustes set activa = true`);
  check((await q(`select activa from comunidad_ajustes`))[0].activa === true, 'el coach la abre (Cuenta → Comunidad)');
  const [aviso1] = await q(`insert into comunidad_posts (tipo, texto, fijada) values ('aviso', 'Bienvenidos al muro del equipo', true) returning *`);
  check(aviso1.autor_id === pelayo && aviso1.fijada && aviso1.atleta_id === null, 'el coach publica un aviso fijado arriba');
  const [reto] = await q(`insert into comunidad_retos (titulo, desde, hasta, objetivo) values ('8 sesiones en 4 semanas', $1::date - 7, $1::date + 20, 8) returning id`, [lunesM]);
  check(await falla(`insert into comunidad_retos (titulo, desde, hasta, objetivo) values ('Mal', current_date, current_date - 1, 3)`), 'un reto con sus fechas en orden');

  // Quien no ha entrado no ve nada (ni nombres, ni fotos, ni recuentos)
  await como(ana);
  check(await n(`select count(*)::int n from comunidad_posts`) === 0 && await n(`select count(*)::int n from comunidad_retos`) === 0
    && (await q(`select * from comunidad_personas()`)).length === 0 && (await q(`select * from comunidad_ranking()`)).length === 0
    && (await q(`select * from comunidad_retos_progreso()`)).length === 0, 'sin haber entrado, Ana no ve nada: ni el muro, ni quién está, ni retos ni ranking');
  await como(intruso);
  check(await falla(`select comunidad_unirme('Intruso', $1, $2)`, [version, normas]), 'una cuenta sin ficha de atleta no puede entrar');
  await como(ana);
  check(await falla(`select comunidad_unirme('Ana L.', 'comunidad-2020-01', $1)`, [normas]), 'hay que aceptar el texto vigente');
  check(await falla(`select comunidad_unirme('A', $1, $2)`, [version, normas]) && await falla(`select comunidad_unirme($1, $2, $3)`, ['x'.repeat(41), version, normas]), 'el nombre, de 2 a 40 letras');
  check(await falla(`insert into comunidad_miembros (atleta_id, perfil_id, nombre, version) values ($1, $2, 'Ana', $3)`, [aAna.id, ana, version]), 'entrar no se hace escribiendo en la tabla');
  await q(`select comunidad_unirme('  Ana   L. ', $1, $2)`, [version, normas]);
  const [mAna] = await q(`select * from comunidad_miembros`);
  check(mAna.nombre === 'Ana L.' && mAna.version === version && Math.abs(new Date(mAna.aceptado_en) - Date.now()) < 60000 && !mAna.salido_en, 'Ana entra con su nombre, el texto que aceptó y la hora de la base');
  check(await falla(`update comunidad_miembros set sin_ranking = true`), 'no cambia su fila a mano (con sus ajustes)');
  await como(luis);
  await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);
  check(await n(`select count(*)::int n from comunidad_miembros`) === 1, 'cada uno solo ve su propia fila de miembro');

  // Dentro: el muro, quién está
  await como(ana);
  const personas = await q(`select * from comunidad_personas() order by coach desc, nombre`);
  check(personas.length === 3 && personas[0].coach && personas[0].nombre === 'Pelayo Pérez' && personas.some((x) => x.nombre === 'Luis M.')
    && Object.keys(personas[0]).sort().join() === 'coach,foto,nombre,perfil_id', 'dentro ve al coach y a los demás miembros: solo nombre y foto de perfil');
  check((await q(`select id from comunidad_posts`)).length === 1, 've el aviso del coach');
  const [pAna] = await q(`insert into comunidad_posts (texto, autor_id, fijada) values ('Primera semana completa', $1, true) returning *`, [luis]);
  check(pAna.autor_id === ana && pAna.atleta_id === aAna.id && pAna.fijada === false && pAna.tipo === 'post', 'publica a su nombre aunque mande otro autor, y sin fijar');
  check(await falla(`insert into comunidad_posts (tipo, texto) values ('aviso', 'Soy el coach')`), 'no publica avisos del coach');
  check(await falla(`insert into comunidad_posts (tipo, texto, resumen, sesion_id) values ('entreno', 'Mi sesión', '{"nombre":"Inventada","series":99}', $1)`, [ses.id]),
    'ni un entreno con la tarjeta hecha por ella (la hace la base)');
  check(await falla(`insert into comunidad_posts (texto) values ($1)`, ['x'.repeat(2001)]) && await falla(`insert into comunidad_posts (texto) values (' ')`), 'texto de 1 a 2000 letras, con algo visible');
  check(await falla(`insert into comunidad_retos (titulo, desde, hasta, objetivo) values ('Mío', current_date, current_date + 7, 3)`)
    && (await q(`update comunidad_retos set objetivo = 1 returning id`)).length === 0 && (await q(`delete from comunidad_retos returning id`)).length === 0, 'no crea, cambia ni borra retos (ve los del coach)');
  check(await falla(`update comunidad_posts set fijada = true where id = $1`, [pAna.id]) || (await q(`update comunidad_posts set fijada = true where id = $1 returning id`, [pAna.id])).length === 0, 'no fija nada');
  await como(luis);
  const [pLuis] = await q(`insert into comunidad_posts (texto) values ('Hoy, sentadilla') returning id`);
  check(await falla(`update comunidad_posts set texto = 'Cambiado' where id = $1`, [pAna.id]), 'Luis no cambia lo de Ana');
  await q(`delete from comunidad_posts where id = $1`, [pAna.id]);
  check(await n(`select count(*)::int n from comunidad_posts where id = $1`, [pAna.id]) === 1, 'ni lo borra');
  check(await falla(`update comunidad_posts set oculta = true where id = $1`, [pAna.id]) || (await q(`update comunidad_posts set oculta = true where id = $1 returning id`, [pAna.id])).length === 0, 'ni lo oculta');

  // Reacciones
  check(await falla(`insert into comunidad_reacciones (post_id, autor_id, tipo) values ($1, $2, 'fuerza')`, [pAna.id, ana]), 'las reacciones no se escriben a mano (nadie reacciona por otro)');
  check((await q(`select comunidad_reaccionar($1, 'fuerza') r`, [pAna.id]))[0].r === 'fuerza', 'Luis reacciona 💪 a lo de Ana');
  check((await q(`select comunidad_reaccionar($1, 'fuerza') r`, [pAna.id]))[0].r === null && await n(`select count(*)::int n from comunidad_reacciones`) === 0, 'tocar otra vez la quita');
  await q(`select comunidad_reaccionar($1, 'fuego')`, [pAna.id]);
  await q(`select comunidad_reaccionar($1, 'aplauso')`, [pAna.id]);
  check((await q(`select tipo from comunidad_reacciones where post_id = $1`, [pAna.id])).map((x) => x.tipo).join() === 'aplauso', 'tocar otra la cambia: una por persona');
  check(await falla(`select comunidad_reaccionar($1, 'pulgar')`, [pAna.id]), 'solo las reacciones que hay (💪 🔥 👏; con la 045, también ❤️ 😂 🏆)');
  // Notificaciones: Luis tiene el móvil activado; Ana no (a ella no se le acumula nada)
  await como(ana);
  await q(`select comunidad_reaccionar($1, 'fuego')`, [pLuis.id]);
  const [cAna] = await q(`insert into comunidad_comentarios (post_id, texto, autor_id) values ($1, '¡Bien hecho!', $2) returning *`, [pLuis.id, luis]);
  check(cAna.autor_id === ana && cAna.atleta_id === aAna.id, 'comenta a su nombre');
  let nl = await notis(`usuario_id = $1 and tipo = 'comunidad'`, [luis]);
  check(nl.length === 1 && nl[0].titulo === 'Ana L. ha reaccionado a tu publicación' && nl[0].url === '#equipo' && !nl[0].cuerpo.includes('Bien hecho'),
    'a Luis le llega una sola por su publicación (reacción y comentario en la misma hora), sin el texto');
  await como(luis);
  await q(`select comunidad_reaccionar($1, 'fuerza')`, [pLuis.id]);
  check((await notis(`usuario_id = $1 and tipo = 'comunidad'`, [luis])).length === 1, 'lo suyo en lo suyo no le avisa');
  await como(luis);
  check(await falla(`insert into comunidad_comentarios (post_id, texto) values ($1, $2)`, [pAna.id, 'x'.repeat(1001)]), 'comentarios de hasta 1000 letras');
  const [cLuis] = await q(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Gracias') returning id`, [pLuis.id]);
  await como(ana);
  check(await n(`select count(*)::int n from comunidad_comentarios where post_id = $1`, [pLuis.id]) === 2 && await n(`select count(*)::int n from comunidad_reacciones where post_id = $1`, [pLuis.id]) === 2,
    'Ana ve los comentarios y quién ha reaccionado');
  await q(`delete from comunidad_comentarios where id = $1`, [cLuis.id]);
  check(await n(`select count(*)::int n from comunidad_comentarios where id = $1`, [cLuis.id]) === 1, 'no borra el comentario de otro');
  check(await falla(`update comunidad_comentarios set oculto = true where id = $1`, [cLuis.id]) || (await q(`update comunidad_comentarios set oculto = true where id = $1 returning id`, [cLuis.id])).length === 0, 'ni lo oculta');
  await q(`delete from comunidad_comentarios where id = $1`, [cAna.id]);
  check(await n(`select count(*)::int n from comunidad_comentarios where id = $1`, [cAna.id]) === 0, 'el suyo sí lo borra');

  // Compartir un entreno: la tarjeta la hace la base
  check(await falla(`select comunidad_compartir_sesion($1)`, [sCL.id]), 'no comparte la sesión de otro');
  check(await falla(`select comunidad_compartir_sesion($1)`, [sCA.id]), 'ni una sin terminar');
  await q(`insert into series (sesion_ejercicio_id, numero, kg, reps, rpe) values ($1, 1, 70, 8, 8), ($1, 2, 72.5, 6, 9), ($2, 1, 55, 10, 8)`, [pautasCA[0].id, pautasCA[1].id]);
  await q(`update sesiones set completada = true, fecha_realizada = current_date, duracion_min = 55 where id = $1`, [sCA.id]);
  const idE1 = (await q(`select comunidad_compartir_sesion($1, 'Sin kilos', false) id`, [ses.id]))[0].id;
  const [e1] = await q(`select * from comunidad_posts where id = $1`, [idE1]);
  const txt1 = JSON.stringify(e1.resumen);
  check(e1.tipo === 'entreno' && e1.autor_id === ana && e1.resumen.con_kilos === false && e1.resumen.series >= 2 && e1.resumen.ejercicios.length >= 1 && !/"kg"|"e1rm"|"reps"/.test(txt1),
    `comparte una sesión terminada sin los kilos: nombre, fecha, series y ejercicios (${txt1.slice(0, 120)}…)`);
  check(!e1.resumen.ejercicios.some((x) => x.record), 'el primer día de un ejercicio no hay récord');
  check(await falla(`select comunidad_compartir_sesion($1)`, [ses.id]), 'cada sesión, una vez');
  check(await falla(`select comunidad_compartir_sesion($1, null, true, $2)`, [sCA.id, [press.id]]), 'la app ya no dice en qué hubo récord: lo decide la base');
  const idE2 = (await q(`select comunidad_compartir_sesion($1, null, true) id`, [sCA.id]))[0].id;
  const [e2] = await q(`select resumen from comunidad_posts where id = $1`, [idE2]);
  const pressE2 = e2.resumen.ejercicios.find((x) => x.nombre === 'Press banca');
  check(e2.resumen.con_kilos && e2.resumen.minutos === 55 && e2.resumen.series === 3 && pressE2?.kg === 70 && pressE2?.reps === 8 && pressE2.record === true && pressE2.e1rm > 80,
    `con «Enseñar los kilos», la mejor serie de cada ejercicio y el récord con su 1RM estimado, calculados por la base (${JSON.stringify(pressE2)})`);
  check(e2.resumen.ejercicios.filter((x) => x.record).length === 1, 'récord donde el 1RM estimado de hoy supera al mejor de antes (el remo de hoy es el primero: sin récord)');
  check(await falla(`update comunidad_posts set resumen = '{"nombre":"Trampa","series":99}' where id = $1`, [idE2]) || (await q(`update comunidad_posts set resumen = '{"nombre":"Trampa"}' where id = $1 returning id`, [idE2])).length === 0,
    'y nadie puede cambiar la tarjeta');
  await como(luis);
  check(await falla(`select comunidad_compartir_sesion($1)`, [sCA.id]), 'Luis no comparte la sesión de Ana');
  check((await q(`select resumen from comunidad_posts where id = $1`, [idE2]))[0].resumen.ejercicios.length >= 2, 'y la ve en el muro');

  // Avisar al coach
  await como(ana);
  const idRep = (await q(`select comunidad_avisar_coach($1, null, 'No me gusta este comentario') id`, [pLuis.id]))[0].id;
  check(!!idRep && (await q(`select comunidad_avisar_coach($1, null, 'Otra vez') id`, [pLuis.id]))[0].id === idRep, 'avisa al coach de una publicación (una vez mientras siga abierto)');
  check(await n(`select count(*)::int n from comunidad_reportes`) === 0, 'y no ve los avisos (ni el suyo)');
  check(await falla(`insert into comunidad_reportes (post_id, autor_id) values ($1, $2)`, [pLuis.id, ana]), 'los avisos no se escriben a mano');
  check((await notis(`usuario_id = $1 and clave = $2`, [pelayo, 'comunidad_reporte:' + idRep])).some((x) => x.url === '#revisar' && x.tipo === 'comunidad'), 'al coach le llega a Revisar');
  await como(pelayo, 'aal2');
  const reps = await q(`select * from comunidad_reportes where resuelto_en is null`);
  check(reps.length === 1 && reps[0].motivo === 'No me gusta este comentario', 'el coach lo ve en Revisar');
  // Ocultar: deja de verse (con sus comentarios y reacciones), también para su autor
  await q(`select comunidad_moderar($1, null, true)`, [pLuis.id]);
  await q(`update comunidad_reportes set resuelto_en = '2000-01-01' where id = $1`, [idRep]);
  check(new Date((await q(`select resuelto_en from comunidad_reportes where id = $1`, [idRep]))[0].resuelto_en) > new Date(Date.now() - 60000), 'lo da por resuelto (con la hora de la base)');
  await como(ana);
  check(await n(`select count(*)::int n from comunidad_posts where id = $1`, [pLuis.id]) === 0 && await n(`select count(*)::int n from comunidad_reacciones where post_id = $1`, [pLuis.id]) === 0
    && await n(`select count(*)::int n from comunidad_comentarios where post_id = $1`, [pLuis.id]) === 0, 'oculta, Ana ya no la ve (ni sus comentarios ni sus reacciones)');
  check(await falla(`select comunidad_reaccionar($1, 'fuego')`, [pLuis.id]) && await falla(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Hola')`, [pLuis.id]), 'ni reacciona ni comenta en ella');
  await como(luis);
  check(await n(`select count(*)::int n from comunidad_posts where id = $1`, [pLuis.id]) === 0, 'tampoco su autor');

  // Retos y ranking: solo recuentos
  await como(ana);
  const prog = await q(`select * from comunidad_retos_progreso()`);
  const progAna = prog.find((x) => x.perfil_id === ana);
  check(prog.length === 2 && progAna.yo && progAna.hechas >= 2 && progAna.objetivo === 8 && Object.keys(prog[0]).sort().join() === 'hechas,nombre,objetivo,perfil_id,reto_id,yo',
    `el progreso del reto: cada miembro con sus sesiones hechas y el objetivo, nada más (Ana ${progAna?.hechas}/8)`);
  const rk = await q(`select * from comunidad_ranking() order by nombre`);
  check(rk.length === 2 && rk[0].nombre === 'Ana L.' && rk[0].hechas === 1 && rk[0].previstas === 1 && rk[1].hechas === 0 && Object.keys(rk[0]).sort().join() === 'hechas,nombre,perfil_id,previstas,yo',
    'el ranking de la semana: sesiones hechas de las previstas (solo recuentos)');
  await como(luis);
  await q(`select comunidad_ajustar(null, true)`);
  check((await q(`select * from comunidad_ranking()`)).map((x) => x.yo).join() === 'false,true' || (await q(`select * from comunidad_ranking()`)).length === 2, 'Luis deja de salir en el ranking (él sigue viendo lo suyo)');
  await como(ana);
  check(!(await q(`select * from comunidad_ranking()`)).some((x) => x.perfil_id === luis) && !(await q(`select * from comunidad_retos_progreso()`)).some((x) => x.perfil_id === luis),
    'y Ana ya no lo ve ni en el ranking ni en los retos');
  await como(luis);
  check((await q(`select * from comunidad_retos_progreso()`)).some((x) => x.perfil_id === luis && x.yo), 'pero él sí ve su progreso');
  check(await falla(`select comunidad_ajustar('L', null)`), 'cambiar el nombre, también de 2 a 40 letras');
  await q(`select comunidad_ajustar('Luis Martín', false)`);

  // Fotos en Storage: las ven los miembros mientras la publicación se vea
  await como(ana);
  const ruta = `${aAna.id}/abcdefgh12.jpg`;
  check(await falla(`insert into comunidad_posts (texto, foto_ruta) values ('Foto', $1)`, [`${aLuis.id}/abcdefgh12.jpg`]), 'su foto, solo en su carpeta');
  check(await falla(`insert into storage.objects (bucket_id, name) values ('comunidad', $1)`, [ruta]), 'sin publicación registrada, no se sube');
  const [pFoto] = await q(`insert into comunidad_posts (texto, foto_ruta) values ('Con foto', $1) returning id`, [ruta]);
  check(await falla(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [ruta]), 'ni va al bucket de los vídeos y fotos de progreso (las del muro tienen el suyo)');
  await q(`insert into storage.objects (bucket_id, name) values ('comunidad', $1)`, [ruta]);
  await como(luis);
  check((await q(`select name from storage.objects where name = $1`, [ruta])).length === 1, 'Luis (miembro) ve la foto de Ana');
  check(await falla(`insert into storage.objects (bucket_id, name) values ('comunidad', $1)`, [`${aAna.id}/zzzzzzzz12.jpg`]), 'y no sube nada a la carpeta de Ana');
  await como(intruso);
  check((await q(`select name from storage.objects where name = $1`, [ruta])).length === 0, 'una cuenta de fuera, no');
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderar($1, null, true)`, [pFoto.id]);
  check((await q(`select name from storage.objects where name = $1`, [ruta])).length === 1, 'el coach la sigue viendo aunque la oculte');
  await como(luis);
  check((await q(`select name from storage.objects where name = $1`, [ruta])).length === 0, 'oculta la publicación, Luis ya no ve la foto');
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderar($1, null, false)`, [pFoto.id]);

  // Salir: lo suyo deja de verse (y vuelve al volver)
  await como(ana);
  check((await q(`select comunidad_salir() f`))[0].f.length === 0, 'Ana sale (sin borrar lo suyo)');
  check(await n(`select count(*)::int n from comunidad_posts`) === 0 && (await q(`select * from comunidad_personas()`)).length === 0, 'fuera, ya no ve nada');
  check(await falla(`insert into comunidad_posts (texto) values ('Sigo aquí')`), 'ni publica');
  await como(luis);
  check(await n(`select count(*)::int n from comunidad_posts where autor_id = $1`, [ana]) === 0 && await n(`select count(*)::int n from comunidad_reacciones where autor_id = $1`, [ana]) === 0
    && !(await q(`select * from comunidad_personas()`)).some((x) => x.perfil_id === ana) && !(await q(`select * from comunidad_ranking()`)).some((x) => x.perfil_id === ana),
    'para Luis desaparece todo lo de Ana: publicaciones, reacciones, su nombre y su sitio en el ranking');
  check((await q(`select name from storage.objects where name = $1`, [ruta])).length === 0, 'también su foto');
  await como(ana);
  await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  await como(luis);
  check(await n(`select count(*)::int n from comunidad_posts where autor_id = $1`, [ana]) === 4, 'si vuelve a entrar, lo suyo vuelve a verse');

  // De baja, fuera al momento
  await como(pelayo, 'aal2');
  await q(`update atletas set estado = 'baja' where id = $1`, [aLuis.id]);
  await como(luis);
  check(await n(`select count(*)::int n from comunidad_posts`) === 0 && await falla(`insert into comunidad_posts (texto) values ('De baja')`) && await falla(`select comunidad_unirme('Luis', $1, $2)`, [version, normas]),
    'un atleta de baja deja de ver la comunidad al momento (ni publica ni puede volver a entrar)');
  await como(ana);
  check(!(await q(`select * from comunidad_personas()`)).some((x) => x.perfil_id === luis), 'y los demás dejan de verlo');
  await como(pelayo, 'aal2');
  await q(`update atletas set estado = 'activo' where id = $1`, [aLuis.id]);

  // Avisos del coach a todos (con sus preferencias)
  const [aviso2] = await q(`insert into comunidad_posts (tipo, texto) values ('aviso', 'Mañana no hay sesión en el gimnasio') returning id`);
  nl = await notis(`clave = $1`, ['comunidad_aviso:' + aviso2.id]);
  check(nl.some((x) => x.usuario_id === luis) && !nl.some((x) => x.usuario_id === pelayo) && nl.every((x) => x.titulo === 'Pelayo ha publicado un aviso en el equipo' && x.url === '#equipo' && !x.cuerpo.includes('gimnasio')),
    'un aviso del coach llega a los miembros (no a él), sin su texto');
  await su();
  await q(`update preferencias_notificaciones set desactivados = '{comunidad}' where usuario_id = $1`, [luis]);
  await como(pelayo, 'aal2');
  const [aviso3] = await q(`insert into comunidad_posts (tipo, texto) values ('aviso', 'Otro aviso') returning id`);
  check(!(await notis(`clave = $1`, ['comunidad_aviso:' + aviso3.id])).some((x) => x.usuario_id === luis), 'quien quita «Comunidad» en Notificaciones no las recibe');
  await q(`delete from comunidad_posts where id = $1`, [aviso2.id]);
  check((await notis(`clave = $1 and estado = 'pendiente'`, ['comunidad_aviso:' + aviso2.id])).length === 0, 'una publicación borrada antes de que salga su notificación ya no avisa');
  await su();
  await q(`update preferencias_notificaciones set desactivados = '{}' where usuario_id = $1`, [luis]);

  // El coach: todo; su ficha del modo atleta nunca es miembro
  await como(pelayo, 'aal2');
  check(await n(`select count(*)::int n from comunidad_posts`) >= 5 && await n(`select count(*)::int n from comunidad_miembros`) === 2, 'el coach lo ve todo (también lo oculto)');
  const [yo] = await q(`insert into atletas (nombre, perfil_id, estado, nutricion) values ('Pelayo', $1, 'activo', false) returning id`, [pelayo]);
  check(await falla(`select comunidad_unirme('Pelayo', $1, $2)`, [version, normas]), 'su ficha de atleta (modo atleta) no entra como miembro');
  await q(`delete from atletas where id = $1`, [yo.id]);
  check(await falla(`insert into comunidad_posts (tipo, texto) values ('post', 'Como atleta')`), 'el coach publica avisos, no publicaciones de atleta');
  await q(`select comunidad_moderar($1, false, null)`, [aviso1.id]);
  await q(`delete from comunidad_comentarios`);
  check(await n(`select count(*)::int n from comunidad_comentarios`) === 0, 'y borra cualquier comentario');

  // Cerrada otra vez: nadie ve nada
  await q(`update comunidad_ajustes set activa = false`);
  await como(ana);
  check(await n(`select count(*)::int n from comunidad_posts`) === 0 && (await q(`select * from comunidad_personas()`)).length === 0 && (await q(`select * from comunidad_ranking()`)).length === 0,
    'con la comunidad cerrada, los atletas no ven nada');
  await anon();
  check(await falla(`select * from comunidad_posts`) && await falla(`select * from comunidad_personas()`) && await falla(`select comunidad_reaccionar($1, 'fuego')`, [aviso1.id]), 'sin sesión, nada');
  // Ordenado para lo que sigue
  await su();
  await q(`delete from comunidad_reportes`);
  await q(`delete from comunidad_posts`);
  await q(`delete from comunidad_miembros`);
  await q(`delete from comunidad_retos`);
  await q(`delete from comunidad_cupos`);
  await q(`delete from bloques where id = any($1::uuid[])`, [[bCA, bCL]]);
  await q(`delete from storage.objects where name = $1`, [ruta]);
  await q(`delete from notificaciones where tipo = 'comunidad'`);
}

console.log('\nLo que encontró la revisión independiente de la 027');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const version = 'comunidad-2026-11-b'; // (el texto de la 029)
  const normas = 'normas-2026-11';
  await como(pelayo, 'aal2');
  await q(`update comunidad_ajustes set activa = true`);
  await como(ana); await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);

  // F1: un aviso al coach sobrevive aunque su autor borre lo avisado (con una copia), y su foto también
  const fotoL = `${aLuis.id}/fotoluis0001.jpg`;
  const [pL] = await q(`insert into comunidad_posts (texto, foto_ruta) values ('Esto es un insulto', $1) returning id`, [fotoL]);
  await q(`insert into storage.objects (bucket_id, name) values ('comunidad', $1)`, [fotoL]);
  const [cL] = await q(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Otro insulto') returning id`, [pL.id]);
  await como(ana);
  const rPost = (await q(`select comunidad_avisar_coach($1, null, 'acoso') id`, [pL.id]))[0].id;
  const rCom = (await q(`select comunidad_avisar_coach(null, $1, 'acoso') id`, [cL.id]))[0].id;
  await como(luis);
  check(await falla(`delete from storage.objects where bucket_id = 'comunidad' and name = $1`, [fotoL]) || (await q(`delete from storage.objects where bucket_id = 'comunidad' and name = $1 returning id`, [fotoL])).length === 0,
    'mientras su publicación exista, el autor no puede borrar (ni cambiar por otra) su foto');
  await q(`delete from comunidad_comentarios where id = $1`, [cL.id]);
  await q(`delete from comunidad_posts where id = $1`, [pL.id]);
  await q(`delete from storage.objects where bucket_id = 'comunidad' and name = $1`, [fotoL]);
  await como(pelayo, 'aal2');
  const reps = await q(`select * from comunidad_reportes where id = any($1::uuid[]) and resuelto_en is null`, [[rPost, rCom]]);
  const rp = reps.find((r) => r.id === rPost), rc = reps.find((r) => r.id === rCom);
  check(reps.length === 2 && rp.post_id === null && rp.copia_texto === 'Esto es un insulto' && rp.copia_autor_nombre === 'Luis M.' && rp.copia_atleta_id === aLuis.id && rp.copia_foto === fotoL
    && rc.de_comentario && rc.comentario_id === null && rc.copia_texto === 'Otro insulto', 'si el autor borra lo avisado, los avisos siguen ahí para el coach, con la copia (texto, autor, foto)');
  check((await q(`select name from storage.objects where bucket_id = 'comunidad' and name = $1`, [fotoL])).length === 1, 'y la foto sigue en Storage (el coach la ve) mientras el aviso esté abierto');
  await q(`update comunidad_reportes set resuelto_en = now() where id = any($1::uuid[])`, [[rPost, rCom]]);
  await q(`delete from storage.objects where bucket_id = 'comunidad' and name = $1`, [fotoL]);

  // F2: bucket propio, cupo que no se recupera borrando, sin cambiar una foto por otra
  await su();
  const [bucket] = await q(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'comunidad'`);
  check(bucket && bucket.public === false && Number(bucket.file_size_limit) <= 650000 && bucket.allowed_mime_types.join() === 'image/jpeg', 'las fotos del muro van a su propio bucket privado: solo JPEG y de 600 KB como mucho');
  check((await q(`select count(*)::int n from pg_policies where tablename = 'objects' and policyname like 'fbe_comunidad%' and cmd = 'UPDATE'`))[0].n === 0, 'sin permiso para sobrescribir una foto');
  await como(ana);
  const rutaT = `${aAna.id}/tarde00001.jpg`;
  const [pT] = await q(`insert into comunidad_posts (texto, foto_ruta) values ('Foto tardía', $1) returning id`, [rutaT]);
  await su(); await q(`update comunidad_posts set creado_en = now() - interval '1 hour' where id = $1`, [pT.id]);
  await como(ana);
  check(await falla(`insert into storage.objects (bucket_id, name) values ('comunidad', $1)`, [rutaT]), 'la foto se sube al publicar, no una hora después (cuando ya se ha visto la publicación sin ella)');
  await q(`delete from comunidad_posts where id = $1`, [pT.id]);
  await su(); await q(`delete from comunidad_cupos`);
  await como(ana);
  let cupo = 0;
  for (let i = 0; i < 21; i++) {
    try { const [x] = await q(`insert into comunidad_posts (texto) values ('ciclo') returning id`); await q(`delete from comunidad_posts where id = $1`, [x.id]); cupo++; } catch { break; }
  }
  check(cupo === 20, `borrar y volver a publicar no da más cupo: ${cupo} publicaciones en 24 horas`);
  check(await falla(`select comunidad_compartir_sesion($1)`, [ses.id]), 'compartir un entreno también gasta cupo');
  await su(); await q(`delete from comunidad_cupos`);

  // F3: si cambia el texto de la entrada, hay que volver a aceptarlo
  await q(`update comunidad_miembros set version = 'comunidad-2020-01' where perfil_id = $1`, [ana]);
  await como(ana);
  check((await q(`select comunidad_soy_miembro() v`))[0].v === false && await n(`select count(*)::int n from comunidad_posts`) === 0 && (await q(`select * from comunidad_personas()`)).length === 0,
    'con el texto aceptado antiguo, no está dentro (no ve nada)');
  await como(luis);
  check(!(await q(`select * from comunidad_personas()`)).some((x) => x.perfil_id === ana), 'ni los demás la ven');
  await como(ana); await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  check((await q(`select comunidad_soy_miembro() v`))[0].v === true, 'al aceptar el texto vigente, vuelve a estar dentro');

  // F4: el coach saca a alguien (y no le deja volver) y le vuelve a admitir
  check(await falla(`select comunidad_expulsar($1, true)`, [aLuis.id]), 'un atleta no saca a nadie');
  await como(pelayo, 'aal2');
  await q(`select comunidad_expulsar($1, true)`, [aLuis.id]);
  await como(ana);
  check(!(await q(`select * from comunidad_personas()`)).some((x) => x.perfil_id === luis), 'el coach saca a Luis: deja de verse');
  await como(luis);
  check((await q(`select comunidad_soy_miembro() v`))[0].v === false && await falla(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]), 'y Luis no puede volver a entrar');
  await como(pelayo, 'aal2'); await q(`select comunidad_expulsar($1, false)`, [aLuis.id]);
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);
  check((await q(`select comunidad_soy_miembro() v`))[0].v === true, 'al readmitirle, puede volver a entrar él');

  // F5: los récords los decide la base (una sesión peor que la anterior no es récord)
  await como(pelayo, 'aal2');
  const bR = (await q(`select crear_bloque_desde_plantilla($1, $2, $3) b`, [pl.id, aLuis.id, lunes]))[0].b;
  await q(`update bloques set numero = 91 where id = $1`, [bR]);
  await q(`update semanas set programacion = 'programada' where bloque_id = $1`, [bR]);
  const [sR] = await q(`select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $1 order by s.orden limit 1`, [bR]);
  const [seR] = await q(`select id from sesion_ejercicios where sesion_id = $1 and ejercicio_id = $2`, [sR.id, press.id]);
  const [sViejo] = await q(`select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $1 order by s.orden limit 1`, [bLuis]);
  const [seViejo] = await q(`select id from sesion_ejercicios where sesion_id = $1 and ejercicio_id = $2`, [sViejo.id, press.id]);
  await su();
  await q(`delete from series where sesion_ejercicio_id = $1`, [seViejo.id]);
  await q(`insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps, rpe, registrada_en) values ($1, $2, 1, 100, 5, 8, now() - interval '14 days')`, [seViejo.id, aLuis.id]);
  await q(`insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps, rpe) values ($1, $2, 1, 40, 5, 8)`, [seR.id, aLuis.id]);
  await q(`update sesiones set completada = true, fecha_realizada = current_date where id = $1`, [sR.id]);
  await como(luis);
  const idR = (await q(`select comunidad_compartir_sesion($1, null, true) id`, [sR.id]))[0].id;
  const [eR] = await q(`select resumen from comunidad_posts where id = $1`, [idR]);
  check(!eR.resumen.ejercicios.some((x) => x.record), 'con 40 kg después de 100 kg, la tarjeta no dice récord (lo decide la base)');

  // F6: todo lo suyo, también lo oculto y tras salir («Descargar mis datos»)
  await como(ana);
  const [pOculta] = await q(`insert into comunidad_posts (texto) values ('Me la ocultarán') returning id`);
  await como(pelayo, 'aal2'); await q(`select comunidad_moderar($1, null, true)`, [pOculta.id]);
  await como(ana);
  check(await n(`select count(*)::int n from comunidad_posts where id = $1`, [pOculta.id]) === 0, 'en el muro, su autora no ve lo que el coach le ha ocultado');
  await q(`select comunidad_salir(false)`);
  const mios = (await q(`select comunidad_mis_datos() d`))[0].d;
  check(mios.miembro?.nombre === 'Ana L.' && mios.publicaciones.some((x) => x.id === pOculta.id && x.oculta) && Array.isArray(mios.comentarios) && Array.isArray(mios.avisos_al_coach)
    && mios.avisos_al_coach.every((r) => !('copia_texto' in r)), 'tras salir, «mis datos» le da todo lo suyo (también lo oculto), y de sus avisos solo lo que escribió');
  await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);

  // F7: las notificaciones del equipo pendientes no salen a quien ya no está dentro
  const pendientesLuis = async () => (await q(`select count(*)::int n from notificaciones where usuario_id = $1 and tipo = 'comunidad' and estado = 'pendiente'`, [luis]))[0].n;
  const [pLuis2] = await q(`select id from comunidad_posts where autor_id = $1 limit 1`, [luis]).then(async (x) => x.length ? x : (await como(luis), await q(`insert into comunidad_posts (texto) values ('Para notificar') returning id`)));
  await como(ana); await q(`insert into comunidad_comentarios (post_id, texto) values ($1, 'ánimo')`, [pLuis2.id]);
  await su(); const antesBaja = await pendientesLuis();
  await como(pelayo, 'aal2'); await q(`update atletas set estado = 'baja' where id = $1`, [aLuis.id]);
  await su(); const trasBaja = await pendientesLuis();
  check(antesBaja >= 1 && trasBaja === 0, `al darle de baja, se retiran sus notificaciones del equipo pendientes (${antesBaja} → ${trasBaja})`);
  await como(pelayo, 'aal2'); await q(`update atletas set estado = 'activo' where id = $1`, [aLuis.id]);
  await su(); await q(`delete from notificaciones where tipo = 'comunidad'`);
  await como(pelayo, 'aal2');
  const [avisoN] = await q(`insert into comunidad_posts (tipo, texto) values ('aviso', 'Para todos') returning id`);
  await su(); const antesCierre = await pendientesLuis();
  await como(pelayo, 'aal2'); await q(`update comunidad_ajustes set activa = false`);
  await su(); const trasCierre = await pendientesLuis();
  check(antesCierre === 1 && trasCierre === 0, 'al cerrar la comunidad, también');
  await como(pelayo, 'aal2'); await q(`update comunidad_ajustes set activa = true`); await q(`delete from comunidad_posts where id = $1`, [avisoN.id]);

  // F8: nombres sin repetir, sin hacerse pasar por el coach y un cambio al día
  await como(luis);
  check(await falla(`select comunidad_ajustar('ana l.', null)`), 'un nombre ya usado en el equipo (sin distinguir mayúsculas), no');
  check(await falla(`select comunidad_ajustar('Pelayo', null)`) && await falla(`select comunidad_ajustar('Coach Luis', null)`) && await falla(`select comunidad_ajustar('El Entrenador', null)`) && await falla(`select comunidad_ajustar('FBE oficial', null)`),
    'ni el del coach, ni «coach», «entrenador» o «FBE»');
  await su(); await q(`update comunidad_miembros set nombre_cambiado_en = null where perfil_id = $1`, [luis]);
  await como(luis);
  await q(`select comunidad_ajustar('Luis Martín', null)`);
  check(await falla(`select comunidad_ajustar('Luis M. R.', null)`), 'un cambio de nombre al día (entrar no cuenta)');

  // F10: la app no cambia publicaciones ni comentarios (ni los suyos): fijar y ocultar, solo el coach con sus funciones
  const [pMia] = await q(`insert into comunidad_posts (texto) values ('Mía') returning id`);
  check(await falla(`update comunidad_posts set texto = 'otra' where id = $1`, [pMia.id]) && await falla(`select comunidad_moderar($1, null, true)`, [pMia.id]), 'ni su propia publicación: sin permiso de UPDATE');
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderar($1, null, true)`, [pMia.id]);
  check((await q(`select oculta from comunidad_posts where id = $1`, [pMia.id]))[0].oculta === true, 'el coach sí, con comunidad_moderar()');

  await su();
  await q(`delete from comunidad_reportes`); await q(`delete from comunidad_posts`); await q(`delete from comunidad_miembros`); await q(`delete from comunidad_cupos`);
  await q(`delete from bloques where id = $1`, [bR]);
  await q(`delete from notificaciones where tipo = 'comunidad'`);
  await q(`update comunidad_ajustes set activa = false`);
}

console.log('\nLas normas del equipo (migración 028)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const { VERSION_NORMAS } = await import('../web/src/datos/normas-comunidad.js');
  const { VERSION_COMUNIDAD } = await import('../web/src/datos/api.js');
  await su();
  check((await q(`select comunidad_normas_version() v`))[0].v === VERSION_NORMAS && (await q(`select comunidad_version() v`))[0].v === VERSION_COMUNIDAD,
    'las versiones de las normas y del texto de entrada son las mismas en la base y en la app');
  const version = VERSION_COMUNIDAD, normas = VERSION_NORMAS;
  await como(pelayo, 'aal2');
  await q(`update comunidad_ajustes set activa = true`);
  await como(ana);
  check(await falla(`select comunidad_unirme('Ana L.', $1)`, [version]), 'sin las normas (la función de antes), no se entra');
  check(await falla(`select comunidad_unirme('Ana L.', $1, 'normas-2020-01')`, [version]) && await falla(`select comunidad_unirme('Ana L.', $1, null)`, [version]), 'ni con otras normas o sin ellas');
  check(await falla(`update comunidad_miembros set normas_version = $1`, [normas]) || (await q(`update comunidad_miembros set normas_version = $1 returning atleta_id`, [normas])).length === 0, 'ni marcándolas a mano');
  await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  const [mA] = await q(`select normas_version, normas_leidas_en from comunidad_miembros where perfil_id = $1`, [ana]);
  check(mA.normas_version === normas && Math.abs(new Date(mA.normas_leidas_en) - Date.now()) < 60000, 'con las vigentes, entra: la base apunta qué normas leyó y cuándo');
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);
  check((await q(`select * from comunidad_personas()`)).some((x) => x.perfil_id === ana), 'Luis ve a Ana');
  // Quien estaba dentro antes de la 028 (sin normas) tiene que leerlas una vez
  await su(); await q(`update comunidad_miembros set normas_version = null, normas_leidas_en = null where perfil_id = $1`, [ana]);
  await como(ana);
  check((await q(`select comunidad_soy_miembro() v`))[0].v === false && await n(`select count(*)::int n from comunidad_posts`) === 0, 'quien entró sin normas (antes de la 028) no está dentro hasta leerlas');
  await como(luis);
  check(!(await q(`select * from comunidad_personas()`)).some((x) => x.perfil_id === ana), 'y los demás no la ven');
  // Y al ejecutar la 028, sus notificaciones del equipo pendientes no salen
  const [pL] = await q(`insert into comunidad_posts (texto) values ('De Luis') returning id`);
  await su();
  await q(`insert into preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true`, [ana]);
  await q(`insert into notificaciones (usuario_id, tipo, titulo, cuerpo, url, clave, caduca_en) values ($1, 'comunidad', 'Algo', 'Míralo en Equipo.', '#equipo', 'prueba-normas', now() + interval '1 day')`, [ana]);
  // (con la 029 ya aplicada, la 028 se repite como dice su aviso: se borra su apunte, se repite y después la 029)
  await q(`delete from fbe_migraciones where numero > 28`);
  await db.exec(readFileSync(new URL('../supabase/migraciones/028_normas_comunidad.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migraciones/029_comunidad_mejoras.sql', import.meta.url), 'utf8'));
  // (y las que vengan después, en orden)
  for (const m of migraciones().filter((x) => x > '029')) await db.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  check((await q(`select count(*)::int n from notificaciones where clave = 'prueba-normas'`))[0].n === 0, 'al ejecutar la 028, las notificaciones del equipo pendientes de quien aún no ha leído las normas se retiran');
  await como(ana); await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  check((await q(`select comunidad_soy_miembro() v`))[0].v === true, 'al leerlas, vuelve a estar dentro');
  // Si cambian las normas, todos fuera hasta volver a leerlas
  await su();
  const sql028 = readFileSync(new URL('../supabase/migraciones/028_normas_comunidad.sql', import.meta.url), 'utf8');
  const defVersion = sql028.match(/create or replace function public\.comunidad_normas_version\(\)[\s\S]*?\$\$;/)[0];
  await db.exec(defVersion.replace(normas, 'normas-2099-01'));
  await como(ana);
  const fuera = (await q(`select comunidad_soy_miembro() v`))[0].v;
  await como(luis);
  const fueraL = (await q(`select comunidad_soy_miembro() v`))[0].v;
  check(fuera === false && fueraL === false && await falla(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]), 'si cambian las normas, nadie está dentro (ni entra con las de antes)');
  await q(`select comunidad_unirme('Luis M.', $1, 'normas-2099-01')`, [version]);
  check((await q(`select comunidad_soy_miembro() v`))[0].v === true, 'hasta que las vuelve a leer');
  await su(); await db.exec(defVersion);
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);
  await su();
  await q(`delete from comunidad_posts where id = $1`, [pL.id]); await q(`delete from comunidad_miembros`); await q(`delete from comunidad_cupos`);
  await q(`delete from notificaciones where tipo = 'comunidad'`); await q(`update comunidad_ajustes set activa = false`);
}

console.log('\nLas mejoras de la comunidad (migración 029)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const { VERSION_COMUNIDAD, VERSION_NORMAS } = await import('../web/src/datos/api.js');
  const version = VERSION_COMUNIDAD, normas = VERSION_NORMAS;
  await su();
  check((await q(`select comunidad_version() v`))[0].v === 'comunidad-2026-11-b' && version === 'comunidad-2026-11-b', 'cambia el texto de la entrada (comunidad-2026-11-b), igual en la base y en la app');
  const lunesM = (await q(`select ((now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid'))::integer - 1)) d`))[0].d;
  const hoyM = (await q(`select (now() at time zone 'Europe/Madrid')::date d`))[0].d;
  // Semanas para las rachas: Ana tiene hecha esta semana (028), la pasada y la de hace tres (hace dos no tiene nada
  // publicado: se salta); la de hace cuatro, sin hacer, la corta. Luis: la pasada hecha y esta sin terminar.
  await como(pelayo, 'aal2');
  // (una semana de la plantilla, que empieza «dias» antes de este lunes)
  const nuevaSemana = async (atleta, dias, hecha, num) => {
    const bId = (await q(`select crear_bloque_desde_plantilla($1, $2, $3::date - $4::int) b`, [pl.id, atleta, lunesM, dias]))[0].b;
    await q(`update bloques set numero = $2 where id = $1`, [bId, num]);
    await q(`update semanas set programacion = 'programada' where bloque_id = $1`, [bId]);
    if (hecha) await q(`update sesiones set completada = true, fecha_realizada = $2::date - $3::int where semana_id in (select id from semanas where bloque_id = $1)`, [bId, lunesM, dias]);
    return bId;
  };
  const bloques029 = [
    await nuevaSemana(aAna.id, 7, true, 81), await nuevaSemana(aAna.id, 21, true, 82), await nuevaSemana(aAna.id, 28, false, 83),
    await nuevaSemana(aLuis.id, 7, true, 84),
  ];
  // Que la de esta semana de Ana sea la del bloque de la 028 (hecha) y la de Luis, su bloque de siempre (sin hacer);
  // lo que terminaron en pruebas anteriores, aparte mientras tanto (se deja como estaba al acabar)
  await su();
  const previas = (await q(`select s.id from sesiones s join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id
    where b.atleta_id = any($1::uuid[]) and s.completada and not (b.id = any($2::uuid[]))`, [[aAna.id, aLuis.id], bloques029])).map((x) => x.id);
  await q(`update sesiones set completada = false where id = any($1::uuid[])`, [previas]);
  // Esta semana, Ana lo tiene todo hecho (sus dos sesiones)
  const semanaAna = await q(`select id, completada, fecha_realizada from sesiones where semana_id = $1`, [wAna1.id]);
  await q(`update sesiones set completada = true, fecha_realizada = $2 where semana_id = $1`, [wAna1.id, hoyM]);
  await q(`update sesiones set completada = false, fecha_realizada = null where semana_id in (select id from semanas where bloque_id = $1)`, [bLuis]);
  await como(pelayo, 'aal2');
  await q(`update comunidad_ajustes set activa = true`);
  const [retoInd] = await q(`insert into comunidad_retos (titulo, desde, hasta, objetivo) values ('Dos sesiones', $1::date - 7, $1::date + 6, 2) returning *`, [lunesM]);
  check(retoInd.modo === 'individual', 'un reto es individual de entrada');
  const [retoEq] = await q(`insert into comunidad_retos (titulo, desde, hasta, objetivo, modo) values ('Entre todos', $1::date - 7, $1::date + 6, 4, 'equipo') returning *`, [lunesM]);
  const [retoViejo] = await q(`insert into comunidad_retos (titulo, desde, hasta, objetivo) values ('Ya acabó', $1::date - 21, $1::date - 15, 1) returning id`, [lunesM]);
  check(await falla(`insert into comunidad_retos (titulo, desde, hasta, objetivo) values ('Mucho', current_date, current_date + 7, 101)`)
    && (await q(`insert into comunidad_retos (titulo, desde, hasta, objetivo, modo) values ('Mucho equipo', current_date, current_date + 7, 101, 'equipo') returning id`)).length === 1
    && await falla(`insert into comunidad_retos (titulo, desde, hasta, objetivo, modo) values ('Demasiado', current_date, current_date + 7, 5001, 'equipo')`)
    && await falla(`insert into comunidad_retos (titulo, desde, hasta, objetivo, modo) values ('Raro', current_date, current_date + 7, 3, 'parejas')`),
    'un reto individual, de 1 a 100 sesiones; uno de equipo, hasta 5000; y solo esos dos modos');
  await q(`delete from comunidad_retos where titulo = 'Mucho equipo'`);

  // Quien no está dentro no ve nada nuevo
  await como(ana);
  check((await q(`select * from comunidad_resumen_semana()`)).length === 0 && (await q(`select * from comunidad_rachas()`)).length === 0
    && (await q(`select * from comunidad_perfil($1)`, [luis])).length === 0 && await falla(`select comunidad_animar($1)`, [luis]),
    'sin haber aceptado el texto nuevo, Ana no ve resumen, rachas ni perfiles, ni anima a nadie');
  await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);
  await como(intruso);
  check((await q(`select * from comunidad_resumen_semana()`)).length === 0 && (await q(`select * from comunidad_rachas()`)).length === 0 && (await q(`select * from comunidad_perfil($1)`, [ana])).length === 0
    && await falla(`select comunidad_animar($1)`, [ana]) && await falla(`select comunidad_compartir_logro($1)`, [retoInd.id]) && await n(`select count(*)::int n from comunidad_votos`) === 0 && await n(`select count(*)::int n from comunidad_animos`) === 0,
    'una cuenta de fuera: ni resumen, ni rachas, ni perfiles, ni ánimos, ni logros, ni votos');

  // Rachas
  await como(ana);
  let rachas = await q(`select * from comunidad_rachas() order by nombre`);
  const rAna = rachas.find((x) => x.perfil_id === ana), rLuis = rachas.find((x) => x.perfil_id === luis);
  check(rachas.length === 2 && Object.keys(rachas[0]).sort().join() === 'nombre,perfil_id,racha,semana_completa,yo', 'las rachas: nombre, semanas seguidas y si la de esta semana está completa (nada más)');
  check(rAna?.racha === 3 && rAna.semana_completa && rAna.yo, `Ana: esta semana, la pasada y la de hace tres (la de hace dos, sin nada publicado, se salta; la de hace cuatro la corta) → ${rAna?.racha}`);
  check(rLuis?.racha === 1 && !rLuis.semana_completa, `Luis: la semana en curso sin terminar no rompe la racha (la pasada, hecha) → ${rLuis?.racha}`);

  // Resumen de la semana
  let res = (await q(`select * from comunidad_resumen_semana()`))[0];
  check(res && Object.keys(res).sort().join() === 'miembros,records,retos,semana_completa,sesiones' && res.sesiones === 2 && res.semana_completa === 1 && res.miembros === 2 && res.retos === 2,
    `el resumen de la semana, solo recuentos: ${JSON.stringify(res)}`);
  await su();
  const deLuis = (await q(`select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $1 and w.fecha_inicio = $2`, [bLuis, lunesM])).map((x) => x.id);
  await q(`update sesiones set completada = true, fecha_realizada = $2 where id = any($1::uuid[])`, [deLuis, hoyM]);
  await como(luis);
  res = (await q(`select * from comunidad_resumen_semana()`))[0];
  check(deLuis.length >= 1 && res.sesiones === 2 + deLuis.length && res.semana_completa === 2, `Luis termina su semana: ${res.sesiones} sesiones del equipo y dos con la semana completa`);
  check((await q(`select racha from comunidad_rachas() where perfil_id = $1`, [luis]))[0].racha === 2, 'y su racha suma esta semana');

  // Perfil
  await como(ana);
  let pf = (await q(`select * from comunidad_perfil($1)`, [luis]))[0];
  check(pf && pf.nombre === 'Luis M.' && pf.racha === 2 && pf.retos === 2 && pf.retos_titulos.sort().join() === 'Dos sesiones,Entre todos' && pf.entrenos >= 0 && !pf.yo && !pf.coach && pf.desde
    && Object.keys(pf).sort().join() === 'coach,desde,entrenos,foto,nombre,perfil_id,racha,retos,retos_titulos,yo', `el perfil de Luis: racha, retos conseguidos (cuántos y cuáles) y entrenos (${JSON.stringify({ r: pf?.racha, t: pf?.retos_titulos })})`);
  check((await q(`select * from comunidad_perfil($1)`, [intruso])).length === 0 && (await q(`select * from comunidad_perfil($1)`, [pelayo]))[0]?.coach === true, 'de alguien de fuera, nada; el del coach, sí');
  check(!(await q(`select retos_titulos from comunidad_perfil($1)`, [ana]))[0].retos_titulos.includes('Ya acabó'), 'un reto que acabó antes de entrar no cuenta como conseguido');

  // Retos de equipo
  const totales = await q(`select * from comunidad_retos_totales()`);
  const tEq = totales.find((x) => x.reto_id === retoEq.id);
  check(totales.length === 3 && tEq?.modo === 'equipo' && tEq.total === 4 + deLuis.length && Object.keys(tEq).sort().join() === 'modo,reto_id,total'
    && (await q(`select * from comunidad_retos_progreso() where reto_id = $1`, [retoEq.id])).length === 2, `un reto de equipo: el total de todos, solo el recuento (${tEq?.total} de 4), y el progreso de cada uno, como siempre`);

  // «No salir en el ranking» lo esconde también de rachas, perfil y total del equipo
  await como(luis); await q(`select comunidad_ajustar(null, true)`);
  check((await q(`select * from comunidad_rachas()`)).some((x) => x.perfil_id === luis && x.yo), 'quien no sale en el ranking sigue viendo su racha');
  check((await q(`select racha from comunidad_perfil($1)`, [luis]))[0].racha === 2, 'y su perfil completo');
  check((await q(`select total from comunidad_retos_totales() where reto_id = $1`, [retoEq.id]))[0].total === 3 && (await q(`select * from comunidad_retos_progreso() where reto_id = $1 and yo`, [retoEq.id])).length === 1,
    'pero sus sesiones ya no cuentan en el total del equipo (él sigue viendo las suyas)');
  await como(ana);
  check(!(await q(`select * from comunidad_rachas()`)).some((x) => x.perfil_id === luis), 'Ana ya no ve la racha de Luis');
  pf = (await q(`select * from comunidad_perfil($1)`, [luis]))[0];
  check(pf.nombre === 'Luis M.' && pf.racha === null && pf.retos === null && pf.retos_titulos === null, 'en su perfil, ni racha ni retos (sí su nombre y sus entrenos)');
  res = (await q(`select * from comunidad_resumen_semana()`))[0];
  check(res.sesiones === 2 && res.semana_completa === 1 && res.miembros === 1, 'y el resumen de la semana no le cuenta');
  check(await falla(`select comunidad_compartir_logro($1)`, [retoEq.id]), 'sin él, el reto de equipo (3 de 4) ya no está conseguido');
  await como(pelayo, 'aal2');
  check((await q(`select * from comunidad_rachas()`)).some((x) => x.perfil_id === luis) && (await q(`select racha from comunidad_perfil($1)`, [luis]))[0].racha === 2, 'el coach sí ve su racha y su perfil');
  await como(luis); await q(`select comunidad_ajustar(null, false)`);

  // Logros: la base comprueba que está conseguido y hace la tarjeta (una vez por reto y persona)
  await como(ana);
  check(await falla(`insert into comunidad_posts (tipo, texto, reto_id, resumen) values ('logro', 'Mío', $1, '{"titulo":"Inventado","hechas":99}')`, [retoInd.id]), 'un logro no se publica a mano');
  check(await falla(`select comunidad_compartir_logro($1)`, [retoViejo.id]), 'ni uno de un reto que acabó antes de entrar');
  const idLogro = (await q(`select comunidad_compartir_logro($1, '¡Conseguido!') id`, [retoInd.id]))[0].id;
  const [logro] = await q(`select * from comunidad_posts where id = $1`, [idLogro]);
  check(logro.tipo === 'logro' && logro.autor_id === ana && logro.reto_id === retoInd.id && logro.resumen.titulo === 'Dos sesiones' && logro.resumen.hechas === 3 && logro.resumen.objetivo === 2 && logro.resumen.modo === 'individual' && logro.texto === '¡Conseguido!',
    `comparte un logro conseguido: la tarjeta, de la base (${JSON.stringify(logro.resumen)})`);
  check(await falla(`select comunidad_compartir_logro($1)`, [retoInd.id]), 'una vez por reto');
  const idLogroEq = (await q(`select comunidad_compartir_logro($1) id`, [retoEq.id]))[0].id;
  check((await q(`select resumen from comunidad_posts where id = $1`, [idLogroEq]))[0].resumen.hechas === 4 + deLuis.length, 'y el de equipo, con el total de todos');
  await como(luis);
  check(await n(`select count(*)::int n from comunidad_posts where tipo = 'logro'`) === 2, 'Luis ve los logros de Ana en el muro');

  // Menciones: solo quien está dentro (o el coach), nunca el autor, sin repetir; y les avisa sin el texto
  await su(); await q(`delete from notificaciones where tipo = 'comunidad'`);
  await q(`insert into preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true`, [ana]);
  await como(ana);
  const [pM] = await q(`insert into comunidad_posts (texto, menciones) values ('Hola @Luis M. y @Pelayo', $1) returning *`, [[luis, intruso, ana, pelayo, luis]]);
  check(pM.menciones.join() === [luis, pelayo].join(), 'de las menciones quedan Luis y el coach (ni alguien de fuera, ni ella misma, ni repetidas)');
  let nm = await notis(`tipo = 'comunidad' and clave like 'comunidad_mencion:%'`);
  check(nm.some((x) => x.usuario_id === luis && x.titulo === 'Ana L. te ha mencionado' && x.url === '#equipo' && !x.cuerpo.includes('Hola')) && !nm.some((x) => x.usuario_id === intruso || x.usuario_id === ana),
    'a Luis le llega «Ana L. te ha mencionado», sin el texto (y a nadie de fuera)');
  await como(luis);
  const [cM] = await q(`insert into comunidad_comentarios (post_id, texto, menciones) values ($1, '@Ana L. ¡gracias!', $2) returning *`, [pM.id, [ana, '00000000-0000-0000-0000-000000000001']]);
  check(cM.menciones.join() === ana && (await notis(`usuario_id = $1 and clave like 'comunidad_mencion:%'`, [ana])).some((x) => x.titulo === 'Luis M. te ha mencionado'), 'también en los comentarios');
  await su();
  check(await falla(`update comunidad_posts set menciones = $2 where id = $1`, [pM.id, [luis, pelayo, ana, intruso, retoInd.id, retoEq.id]]), 'como mucho 5 menciones');
  await como(ana);
  await q(`delete from comunidad_posts where id = $1`, [pM.id]);
  check((await notis(`estado = 'pendiente' and clave like $1`, [`comunidad_mencion:${pM.id}:%`])).length === 0, 'si se borra la publicación, sus menciones pendientes ya no avisan');

  // Encuestas del coach
  check(await falla(`insert into comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿Sí?', '{"opciones":["Sí","No"]}')`), 'un atleta no publica encuestas');
  await como(pelayo, 'aal2');
  const futuro = new Date(Date.now() + 3 * 864e5).toISOString();
  check(await falla(`insert into comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿Una?', '{"opciones":["Sola"]}')`)
    && await falla(`insert into comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿Cinco?', '{"opciones":["a","b","c","d","e"]}')`)
    && await falla(`insert into comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿Iguales?', '{"opciones":["Sí","sí "]}')`)
    && await falla(`insert into comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿Larga?', $1)`, [{ opciones: ['x'.repeat(81), 'b'] }])
    && await falla(`insert into comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿Pasada?', $1)`, [{ opciones: ['a', 'b'], cierre: '2020-01-01T00:00:00Z' }])
    && await falla(`insert into comunidad_posts (tipo, texto, encuesta) values ('encuesta', null, '{"opciones":["a","b"]}')`),
    'una encuesta: una pregunta y de 2 a 4 opciones distintas de hasta 80 letras, con el cierre en el futuro');
  const [enc] = await q(`insert into comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿Sábado o domingo?', $1) returning *`, [{ opciones: [' Sábado ', 'Domingo'], cierre: futuro, otra: 1 }]);
  check(enc.encuesta.opciones.join() === 'Sábado,Domingo' && Math.abs(Date.parse(enc.encuesta.cierre) - Date.parse(futuro)) < 1000 && Object.keys(enc.encuesta).sort().join() === 'cierre,opciones',
    'el coach publica una encuesta (la base deja solo las opciones, limpias, y el cierre)');
  check((await notis(`clave = $1`, ['comunidad_aviso:' + enc.id])).some((x) => x.usuario_id === luis && x.titulo === 'Pelayo ha publicado una encuesta en el equipo'), 'y les llega a los de dentro');
  await como(pelayo, 'aal2');
  check(await falla(`update comunidad_posts set encuesta = '{"opciones":["Otra","Cosa"]}' where id = $1`, [enc.id]) || (await q(`update comunidad_posts set encuesta = '{"opciones":["Otra","Cosa"]}' where id = $1 returning id`, [enc.id])).length === 0,
    'una encuesta no cambia después de publicarla');
  check(await falla(`select comunidad_votar($1, 0)`, [enc.id]), 'el coach no vota');
  await como(ana);
  check(await falla(`insert into comunidad_votos (post_id, autor_id, opcion) values ($1, $2, 0)`, [enc.id, ana]), 'los votos no se escriben a mano');
  check((await q(`select comunidad_votar($1, 0) v`, [enc.id]))[0].v === 0 && (await q(`select comunidad_votar($1, 1) v`, [enc.id]))[0].v === 1
    && await n(`select count(*)::int n from comunidad_votos where post_id = $1 and autor_id = $2 and opcion = 1`, [enc.id, ana]) === 1 && await n(`select count(*)::int n from comunidad_votos where post_id = $1`, [enc.id]) === 1,
    'Ana vota y cambia su voto: un voto por persona');
  check(await falla(`select comunidad_votar($1, 2)`, [enc.id]) && await falla(`select comunidad_votar($1, -1)`, [enc.id]) && await falla(`select comunidad_votar($1, null)`, [enc.id]), 'solo una de sus opciones');
  check(await falla(`select comunidad_votar($1, 0)`, [idLogro]), 'solo en encuestas');
  await como(luis); await q(`select comunidad_votar($1, 0)`, [enc.id]);
  check(await n(`select count(*)::int n from comunidad_votos where post_id = $1`, [enc.id]) === 2, 'Luis ve los dos votos (para los resultados y quién ha votado)');
  await como(intruso);
  check(await falla(`select comunidad_votar($1, 0)`, [enc.id]), 'alguien de fuera no vota');
  await su(); await q(`update comunidad_posts set encuesta = jsonb_set(encuesta, '{cierre}', to_jsonb((now() - interval '1 minute')::text)) where id = $1`, [enc.id]);
  await como(ana);
  check(await falla(`select comunidad_votar($1, 0)`, [enc.id]), 'cerrada la encuesta, ya no se vota ni se cambia el voto');
  await como(pelayo, 'aal2'); await q(`select comunidad_moderar($1, null, true)`, [enc.id]);
  await como(ana);
  check(await n(`select count(*)::int n from comunidad_votos where post_id = $1`, [enc.id]) === 0, 'oculta la encuesta, sus votos tampoco se ven');
  await como(pelayo, 'aal2'); await q(`select comunidad_moderar($1, null, false)`, [enc.id]);

  // Ánimos
  await su(); await q(`delete from notificaciones where tipo = 'comunidad'`);
  await como(ana);
  check(await falla(`select comunidad_animar($1)`, [ana]), 'nadie se anima a sí mismo');
  check(await falla(`select comunidad_animar($1)`, [intruso]) && await falla(`select comunidad_animar($1)`, [pelayo]), 'solo a alguien de dentro (ni de fuera ni al coach)');
  check(await falla(`insert into comunidad_animos (de, para, semana) values ($1, $2, $3)`, [ana, luis, lunesM]), 'los ánimos no se escriben a mano');
  check(new Date((await q(`select comunidad_animar($1) s`, [luis]))[0].s).getTime() === new Date(lunesM).getTime(), 'Ana anima a Luis (esta semana)');
  check(await falla(`select comunidad_animar($1)`, [luis]), 'una vez por semana a cada uno');
  await como(pelayo, 'aal2'); await q(`select comunidad_animar($1)`, [luis]);
  nm = await notis(`usuario_id = $1 and clave like 'comunidad_animo:%'`, [luis]);
  check(nm.length === 2 && nm.some((x) => x.titulo === 'Ana L. te ha mandado ánimo 🙌' && x.url === '#equipo') && nm.some((x) => x.titulo === 'Pelayo te ha mandado ánimo 🙌'), 'el coach también anima; a Luis le llegan los dos');
  await como(luis);
  check(await n(`select count(*)::int n from comunidad_animos where para = $1`, [luis]) === 2, 'Luis ve quién le ha animado');
  await como(intruso);
  check(await n(`select count(*)::int n from comunidad_animos`) === 0, 'alguien de fuera, no');
  await su();
  for (let i = 0; i < 40; i++) await q(`insert into comunidad_cupos (perfil_id, tipo) values ($1, 'animo')`, [luis]);
  await como(luis);
  check(await falla(`select comunidad_animar($1)`, [ana]), 'como mucho 40 ánimos al día');
  await su(); await q(`delete from comunidad_cupos`);
  await como(luis); await q(`select comunidad_animar($1)`, [ana]);

  // Salir: votos y ánimos, como las reacciones (dejan de verse; con «borrar», se borran) y en «mis datos»
  await como(ana);
  await q(`select comunidad_salir(false)`);
  check((await notis(`estado = 'pendiente' and clave like $1`, [`comunidad_animo:${ana}:%`])).length === 0, 'al salir, sus ánimos pendientes de avisar ya no avisan');
  await como(ana);
  const mios = (await q(`select comunidad_mis_datos() d`))[0].d;
  check(mios.votos.some((v) => v.post_id === enc.id && v.opcion === 1) && mios.animos_mandados.some((a) => a.para === luis && a.para_nombre === 'Luis M.') && mios.animos_recibidos.length === 1 && !('de' in mios.animos_recibidos[0])
    && mios.publicaciones.some((x) => x.tipo === 'logro'), '«mis datos» lleva sus votos, sus ánimos (los recibidos, sin de quién) y sus logros');
  await como(luis);
  check(await n(`select count(*)::int n from comunidad_votos where autor_id = $1`, [ana]) === 0 && await n(`select count(*)::int n from comunidad_animos where de = $1 or para = $1`, [ana]) === 0
    && !(await q(`select * from comunidad_rachas()`)).some((x) => x.perfil_id === ana) && (await q(`select * from comunidad_perfil($1)`, [ana])).length === 0,
    'para Luis desaparecen su voto, sus ánimos, su racha y su perfil');
  await como(ana); await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  await como(luis);
  check(await n(`select count(*)::int n from comunidad_votos where autor_id = $1`, [ana]) === 1, 'si vuelve, vuelven a verse');
  await como(ana); await q(`select comunidad_salir(true)`);
  await su();
  check(await n(`select count(*)::int n from comunidad_votos where autor_id = $1`, [ana]) === 0 && await n(`select count(*)::int n from comunidad_animos where de = $1`, [ana]) === 0
    && await n(`select count(*)::int n from comunidad_animos where para = $1`, [ana]) === 0, 'saliendo con «borrar», se borran sus votos y sus ánimos (los mandados y los recibidos)');

  // Ordenado para lo que sigue
  await q(`delete from comunidad_reportes`); await q(`delete from comunidad_posts`); await q(`delete from comunidad_miembros`); await q(`delete from comunidad_retos`);
  await q(`delete from comunidad_cupos`); await q(`delete from comunidad_animos`); await q(`delete from notificaciones where tipo = 'comunidad'`);
  await q(`update comunidad_ajustes set activa = false`);
  await q(`delete from bloques where id = any($1::uuid[])`, [bloques029]);
  await q(`update sesiones set completada = false, fecha_realizada = null where semana_id in (select id from semanas where bloque_id = $1)`, [bLuis]);
  await q(`update sesiones set completada = true where id = any($1::uuid[])`, [previas]);
  for (const x of semanaAna) await q(`update sesiones set completada = $2, fecha_realizada = $3 where id = $1`, [x.id, x.completada, x.fecha_realizada]);
}

console.log('\nLo que encontró la revisión de seguridad de la 029');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const { VERSION_COMUNIDAD: version, VERSION_NORMAS: normas } = await import('../web/src/datos/api.js');
  await su();
  const lunesM = (await q(`select ((now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid'))::integer - 1)) d`))[0].d;
  // Lo que terminaron en pruebas anteriores, aparte mientras tanto (se deja como estaba al acabar)
  const previas = await q(`select s.id, s.fecha_realizada from sesiones s join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id
    where b.atleta_id = any($1::uuid[]) and s.completada`, [[aAna.id, aLuis.id]]);
  await q(`update sesiones set completada = false where id = any($1::uuid[])`, [previas.map((x) => x.id)]);
  await como(pelayo, 'aal2');
  await q(`update comunidad_ajustes set activa = true`);
  const semana = async (atleta, dias, num) => {
    const bId = (await q(`select crear_bloque_desde_plantilla($1, $2, $3::date - $4::int) b`, [pl.id, atleta, lunesM, dias]))[0].b;
    await q(`update bloques set numero = $2 where id = $1`, [bId, num]);
    await q(`update semanas set programacion = 'programada' where bloque_id = $1`, [bId]);
    return bId;
  };
  const bRev = [await semana(aAna.id, 7, 71), await semana(aAna.id, 14, 72), await semana(aAna.id, 21, 73), await semana(aLuis.id, 7, 74)];
  const sesDe = async (b) => (await q(`select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $1`, [b])).map((x) => x.id);
  const sAna = [...await sesDe(bRev[0]), ...await sesDe(bRev[1]), ...await sesDe(bRev[2])];
  const [reto3] = await q(`insert into comunidad_retos (titulo, desde, hasta, objetivo) values ('Tres', $1::date - 21, $1::date + 6, 3) returning id`, [lunesM]);
  await como(ana); await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);

  // M1: fechas imposibles y actividad inflada
  await como(ana);
  check(await falla(`update sesiones set completada = true, fecha_realizada = '2099-01-01' where id = $1`, [sAna[0]])
    && await falla(`update sesiones set completada = true, fecha_realizada = (now() at time zone 'Europe/Madrid')::date + 2 where id = $1`, [sAna[0]]),
    'el atleta no fecha una sesión después de mañana (Madrid)');
  let msg = '';
  try { await q(`update sesiones set fecha_realizada = '2099-01-01' where id = $1`, [sAna[0]]); } catch (e) { msg = e.message; }
  check(/no puede ser posterior a hoy/.test(msg), `con un mensaje claro («${msg.slice(0, 60)}…»)`);
  check((await q(`update sesiones set completada = true, fecha_realizada = (now() at time zone 'Europe/Madrid')::date - 30 where id = $1 returning id`, [sAna[0]])).length === 1
    && (await q(`update sesiones set fecha_realizada = (now() at time zone 'Europe/Madrid')::date + 1 where id = $1 returning id`, [sAna[0]])).length === 1,
    'las fechas pasadas (una sesión de otra semana) siguen valiendo, y mañana (otra zona horaria) también');
  // Las tres, marcadas hoy de golpe: cuentan dos
  await q(`update sesiones set completada = true, fecha_realizada = (now() at time zone 'Europe/Madrid')::date where id = any($1::uuid[])`, [sAna]);
  const hechas = async () => (await q(`select hechas from comunidad_retos_progreso() where reto_id = $1 and yo`, [reto3.id]))[0].hechas;
  check(await hechas() === 2 && (await q(`select total from comunidad_retos_totales() where reto_id = $1`, [reto3.id]))[0].total === 2 && await falla(`select comunidad_compartir_logro($1)`, [reto3.id]),
    'tres sesiones marcadas el mismo día cuentan dos (también en el progreso de la 027 y en los totales): sin logro');
  check((await q(`select sesiones from comunidad_resumen_semana()`))[0].sesiones <= 2, 'ni inflan el resumen de la semana');
  await q(`update sesiones set fecha_realizada = (now() at time zone 'Europe/Madrid')::date - 1 where id = $1`, [sAna[2]]);
  check(await hechas() === 3, 'en días distintos, cuentan todas');
  await como(pelayo, 'aal2');
  await q(`update sesiones set fecha_realizada = '2099-01-01' where id = $1`, [sAna[2]]);
  await como(ana);
  check(await hechas() === 2, 'el coach sí puede poner cualquier fecha, pero una sesión del futuro no cuenta en nada');
  await como(pelayo, 'aal2');
  await q(`update sesiones set fecha_realizada = (now() at time zone 'Europe/Madrid')::date - 1 where id = $1`, [sAna[2]]);
  await q(`update bloques set estado = 'cancelado' where id = $1`, [bRev[2]]);
  await como(ana);
  check(await hechas() === 2, 'las sesiones de un bloque cancelado no cuentan');
  await como(pelayo, 'aal2'); await q(`update bloques set estado = 'activo' where id = $1`, [bRev[2]]);
  await su(); await q(`update semanas set programacion = 'en_programacion' where bloque_id = $1`, [bRev[1]]);
  await como(ana);
  check(await hechas() === 2, 'ni las de una semana sin publicar');
  await su(); await q(`update semanas set programacion = 'programada' where bloque_id = $1`, [bRev[1]]);

  // M2, L1, L2: menciones
  await su(); await q(`delete from notificaciones where tipo = 'comunidad'`); await q(`delete from comunidad_cupos`);
  await como(ana);
  const postsAna = [];
  for (let i = 0; i < 5; i++) postsAna.push((await q(`insert into comunidad_posts (texto) values ('p' || $1::text) returning id`, [i]))[0].id);
  await como(luis);
  for (const id of postsAna) await q(`insert into comunidad_comentarios (post_id, texto, menciones) values ($1, '@Ana L.', $2)`, [id, [ana]]);
  const mencionesA = async (where = '') => (await notis(`usuario_id = $1 and clave like 'comunidad_mencion:%' ${where}`, [ana])).length;
  check(await mencionesA() === 1, 'cinco comentarios mencionando a Ana en la misma hora: una sola notificación');
  await su();
  for (let i = 0; i < 20; i++) await q(`insert into comunidad_cupos (perfil_id, tipo) values ($1, 'mencion')`, [luis]);
  await como(luis);
  const [cTope] = await q(`insert into comunidad_comentarios (post_id, texto, menciones) values ($1, '@Pelayo', $2) returning menciones`, [postsAna[0], [pelayo]]);
  check(cTope.menciones.join() === pelayo && (await notis(`usuario_id = $1 and clave like 'comunidad_mencion:%'`, [pelayo])).length === 0,
    'con 20 menciones avisadas hoy, la siguiente sigue en el texto pero no avisa');
  await su(); await q(`delete from comunidad_cupos`);
  await como(luis); await q(`insert into comunidad_comentarios (post_id, texto, menciones) values ($1, '@Pelayo', $2)`, [postsAna[1], [pelayo]]);
  check((await notis(`usuario_id = $1 and clave like 'comunidad_mencion:%'`, [pelayo])).length === 1, 'sin el tope, avisa');
  await su(); check(await n(`select count(*)::int n from comunidad_cupos where perfil_id = $1 and tipo = 'mencion'`, [luis]) === 1, 'y cuenta en su cupo de menciones');
  // L1: borrar u ocultar el comentario (o su publicación) retira la mención pendiente
  await q(`delete from notificaciones where tipo = 'comunidad'`);
  await como(luis); const [c1] = await q(`insert into comunidad_comentarios (post_id, texto, menciones) values ($1, 'x @Ana L.', $2) returning id`, [postsAna[2], [ana]]);
  check(await mencionesA(`and estado = 'pendiente'`) === 1, 'la mención avisa');
  await como(pelayo, 'aal2'); await q(`select comunidad_moderar_comentario($1, true)`, [c1.id]);
  check(await mencionesA(`and estado = 'pendiente'`) === 0, 'el coach oculta el comentario: la mención pendiente se retira');
  await como(luis); const [c2] = await q(`insert into comunidad_comentarios (post_id, texto, menciones) values ($1, 'y @Ana L.', $2) returning id`, [postsAna[3], [ana]]);
  check(await mencionesA(`and estado = 'pendiente'`) === 1, 'otra mención (la anterior se retiró: no cuenta para la hora)');
  await q(`delete from comunidad_comentarios where id = $1`, [c2.id]);
  check(await mencionesA(`and estado = 'pendiente'`) === 0, 'su autor borra el comentario: también se retira');
  await como(luis); await q(`insert into comunidad_comentarios (post_id, texto, menciones) values ($1, 'otra @Ana L.', $2)`, [postsAna[4], [ana]]);
  await como(pelayo, 'aal2'); await q(`select comunidad_moderar($1, null, true)`, [postsAna[4]]);
  check(await mencionesA(`and estado = 'pendiente'`) === 0, 'y si el coach oculta la publicación, las de sus comentarios también');
  // L2: no se avisa de una publicación que ya no se ve
  await como(luis); const [pL] = await q(`insert into comunidad_posts (texto) values ('mía') returning id`);
  await q(`select comunidad_salir(false)`);
  await su(); await q(`delete from notificaciones where tipo = 'comunidad'`);
  await como(pelayo, 'aal2'); await q(`insert into comunidad_comentarios (post_id, texto, menciones) values ($1, 'mira @Ana L.', $2)`, [pL.id, [ana]]);
  check(await mencionesA() === 0, 'una mención en lo de alguien que ya ha salido no avisa (no se puede ver)');
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);

  // L3: ánimos al salir y borrar, y «mis datos»
  await como(luis); await q(`select comunidad_animar($1)`, [ana]);
  await como(ana); await q(`select comunidad_animar($1)`, [luis]);
  await q(`select comunidad_salir(true)`);
  await su();
  check(await n(`select count(*)::int n from comunidad_animos where de = $1 or para = $1`, [ana]) === 0, 'salir y borrar se lleva sus ánimos, los mandados y los recibidos');
  await como(ana); await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  await como(luis); await q(`select comunidad_animar($1)`, [ana]);
  await como(ana); await q(`select comunidad_salir(false)`);
  await como(luis);
  let mios = (await q(`select comunidad_mis_datos() d`))[0].d;
  const aAnaMio = mios.animos_mandados.find((x) => !('para' in x));
  check(aAnaMio?.para_nombre === 'Alguien del equipo' && !JSON.stringify(mios.animos_mandados).includes(ana), 'en «mis datos», a quien ya no está se le llama «Alguien del equipo», sin su identificador');
  check(mios.comentarios.every((x) => typeof x.menciones === 'number') && !JSON.stringify(mios.comentarios).includes(ana), 'y de sus menciones, cuántas (no a quién)');
  await como(ana); await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);

  // L4: que no se pueda deducir quién no sale en el ranking
  await como(ana);
  check((await q(`select * from comunidad_rachas()`)).every((x) => x.racha >= 1), 'las rachas solo salen desde 1');
  const deLuis = async () => JSON.stringify((({ racha, retos, retos_titulos }) => ({ racha, retos, retos_titulos }))((await q(`select * from comunidad_perfil($1)`, [luis]))[0]));
  const sinRacha = await deLuis();
  await como(luis); await q(`select comunidad_ajustar(null, true)`);
  await como(ana);
  check(sinRacha === await deLuis() && sinRacha === '{"racha":null,"retos":null,"retos_titulos":null}', 'el perfil sin racha ni retos sale igual que el de quien no sale en el ranking');
  await como(luis); await q(`select comunidad_ajustar(null, false)`);

  // L5: repetir la 027 con datos de la 029 se para sin tocar nada
  await como(pelayo, 'aal2');
  await q(`insert into comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿Sí?', '{"opciones":["Sí","No"]}')`);
  await su();
  await q(`delete from fbe_migraciones where numero > 27`);
  let err027 = '';
  try { await db.exec(readFileSync(new URL('../supabase/migraciones/027_comunidad.sql', import.meta.url), 'utf8')); } catch (e) { err027 = e.message; }
  for (const m of migraciones().filter((x) => x > '027')) await q(`insert into fbe_migraciones (numero) values ($1) on conflict do nothing`, [Number(m.slice(0, 3))]);
  check(/logros, encuestas o retos de equipo de la 029/.test(err027) && (await q(`select comunidad_version() v`))[0].v === version
    && (await q(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'comunidad_posts_validos'`))[0].d.includes('encuesta'),
    'repetir la 027 con logros, encuestas o retos de equipo se para antes de tocar nada');

  // L6: los logros, desde la última vez que entró; el coach no anima con la comunidad cerrada; votar tiene cupo
  const [rViejo] = await q(`insert into comunidad_retos (titulo, desde, hasta, objetivo) values ('Pasado', $1::date - 21, (now() at time zone 'Europe/Madrid')::date - 1, 1) returning id`, [lunesM]);
  await q(`update comunidad_miembros set entrado_en = now() - interval '40 days' where perfil_id = $1`, [ana]);
  const conseguido = async () => (await q(`select fbe_privado.comunidad_reto_conseguido($1, $2) c`, [rViejo.id, aAna.id]))[0].c;
  check(await conseguido(), 'un reto que acabó ayer cuenta para quien ya estaba dentro');
  const antes = (await q(`select entrado_en from comunidad_miembros where perfil_id = $1`, [ana]))[0].entrado_en;
  await como(ana); await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  await su();
  check(String((await q(`select entrado_en from comunidad_miembros where perfil_id = $1`, [ana]))[0].entrado_en) === String(antes) && await conseguido(), 'volver a aceptar estando dentro no cambia desde cuándo está');
  await como(ana); await q(`select comunidad_salir(false)`); await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  await su();
  check(!(await conseguido()), 'pero si sale y vuelve, ese reto ya no cuenta (cuentan desde que volvió)');
  await como(pelayo, 'aal2'); await q(`update comunidad_ajustes set activa = false`);
  check(await falla(`select comunidad_animar($1)`, [luis]), 'con la comunidad cerrada, el coach tampoco anima');
  await q(`update comunidad_ajustes set activa = true`);
  const [enc2] = await q(`insert into comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿A o B?', '{"opciones":["A","B"]}') returning id`);
  await como(luis); await q(`select comunidad_votar($1, 0)`, [enc2.id]);
  await su(); for (let i = 0; i < 30; i++) await q(`insert into comunidad_cupos (perfil_id, tipo) values ($1, 'voto')`, [luis]);
  await como(luis);
  check(await falla(`select comunidad_votar($1, 1)`, [enc2.id]) && (await q(`select comunidad_votar($1, 0) v`, [enc2.id]))[0].v === 0, 'votar o cambiar el voto, como mucho 30 veces al día (repetir el mismo no cuenta)');

  // Ordenado para lo que sigue
  await su();
  await q(`delete from comunidad_reportes`); await q(`delete from comunidad_posts`); await q(`delete from comunidad_miembros`); await q(`delete from comunidad_retos`);
  await q(`delete from comunidad_cupos`); await q(`delete from comunidad_animos`); await q(`delete from notificaciones where tipo = 'comunidad'`);
  await q(`update comunidad_ajustes set activa = false`);
  await q(`delete from bloques where id = any($1::uuid[])`, [bRev]);
  for (const x of previas) await q(`update sesiones set completada = true, fecha_realizada = $2 where id = $1`, [x.id, x.fecha_realizada]);
}

console.log('\nTareas, mensajes programados, el bloque entero y las bajas (migración 030)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  await su();
  await q(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  const hoyM = (await q(`select (now() at time zone 'Europe/Madrid')::date d`))[0].d;
  check((await q(`select relname from pg_class where relname in ('tareas', 'tareas_plantillas') and relrowsecurity order by 1`)).length === 2, 'las dos tablas nuevas, con RLS');
  check((await q(`select grantee, privilege_type from information_schema.role_table_grants where table_name in ('tareas', 'tareas_plantillas') and grantee in ('anon', 'public')`)).length === 0
    && !(await q(`select has_table_privilege('authenticated', 'public.tareas', 'truncate') t`))[0].t, 'cerradas por defecto: nada para anon, ni truncate para nadie');
  await anon();
  check(await falla(`select * from tareas`) && await falla(`select * from tareas_plantillas`) && await falla(`select tarea_completar(gen_random_uuid())`) && await falla(`select * from bloque_semanas(gen_random_uuid())`), 'sin sesión, nada');

  // El coach pone tareas
  await como(pelayo, 'aal2');
  const [tFoto] = await q(`insert into tareas (atleta_id, tipo, titulo) values ($1, 'foto', 'Foto de frente') returning *`, [aAna.id]);
  const [tTexto] = await q(`insert into tareas (atleta_id, tipo, titulo, detalle) values ($1, 'texto', '¿Qué tal el hombro?', 'Del 1 al 10') returning *`, [aAna.id]);
  const [tMedida] = await q(`insert into tareas (atleta_id, tipo, titulo) values ($1, 'medida', 'Cintura') returning *`, [aAna.id]);
  const [tVideo] = await q(`insert into tareas (atleta_id, tipo, titulo, ejercicio_id) values ($1, 'video', 'Vídeo del press', $2) returning *`, [aAna.id, press.id]);
  const [tFutura] = await q(`insert into tareas (atleta_id, tipo, titulo, fecha) values ($1, 'texto', 'El jueves', $2::date + 3) returning *`, [aAna.id, hoyM]);
  const [tLuis] = await q(`insert into tareas (atleta_id, tipo, titulo) values ($1, 'texto', 'Cuéntame tu semana') returning *`, [aLuis.id]);
  check(String(tFoto.fecha) === String(hoyM) && Math.abs(new Date(tFoto.creada_en) - Date.now()) < 60000, 'una tarea sale desde hoy (Madrid) si no se dice otra cosa');
  check(await falla(`insert into tareas (atleta_id, tipo, titulo) values ($1, 'llamada', 'X')`, [aAna.id]) && await falla(`insert into tareas (atleta_id, tipo, titulo) values ($1, 'texto', '​')`, [aAna.id])
    && await falla(`insert into tareas (atleta_id, tipo, titulo, ejercicio_id) values ($1, 'foto', 'X', $2)`, [aAna.id, press.id]) && await falla(`insert into tareas (atleta_id, tipo, titulo) values ($1, 'texto', $2)`, [aAna.id, 'x'.repeat(121)])
    && await falla(`insert into tareas (atleta_id, tipo, titulo) values ($1, 'texto', 'X')`, [aAna.id + '0']),
    'tipos conocidos, título visible y corto, y el ejercicio solo en las de vídeo');
  check(await falla(`insert into tareas (atleta_id, tipo, titulo, respuesta) values ($1, 'texto', 'X', 'Hecha')`, [aAna.id]) && await falla(`update tareas set atleta_id = $2 where id = $1`, [tFoto.id, aLuis.id])
    && (await q(`update tareas set creada_en = '2020-01-01' where id = $1 returning creada_en`, [tFoto.id]))[0].creada_en.getFullYear() > 2020,
    'sin hacer no lleva respuesta; no cambia de atleta y su fecha de creación no se toca');
  const nT = await notis(`clave = $1`, ['tarea:' + tLuis.id]);
  check(nT.length === 1 && nT[0].usuario_id === luis && nT[0].tipo === 'tarea' && nT[0].titulo === 'Pelayo te ha puesto una tarea' && nT[0].cuerpo === 'Para hoy: la tienes en Tu día.' && nT[0].url === '#hoy'
    && !JSON.stringify(nT[0]).includes('Cuéntame'), 'a Luis le llega «Pelayo te ha puesto una tarea» (sin el texto)');
  await como(pelayo, 'aal2');
  const [tLuisF] = await q(`insert into tareas (atleta_id, tipo, titulo, fecha) values ($1, 'texto', 'Luego', $2::date + 2) returning id`, [aLuis.id, hoyM]);
  check((await notis(`clave = $1`, ['tarea:' + tLuisF.id]))[0]?.cuerpo.startsWith('Para el '), 'si es para otro día, se lo dice («Para el …»)');

  // El atleta: solo las suyas, y solo marcarlas
  await como(ana);
  check(await n(`select count(*)::int n from tareas`) === 5 && await n(`select count(*)::int n from tareas where atleta_id = $1`, [aLuis.id]) === 0, 'Ana ve sus tareas, no las de Luis');
  check(await falla(`insert into tareas (atleta_id, tipo, titulo) values ($1, 'texto', 'Me la pongo yo')`, [aAna.id])
    && (await q(`update tareas set hecha_en = now(), titulo = 'Cambiada' where id = $1 returning id`, [tTexto.id])).length === 0
    && (await q(`delete from tareas where id = $1 returning id`, [tTexto.id])).length === 0, 'no crea, cambia ni borra tareas (ni marcándolas a mano)');
  check(await falla(`select * from tareas_plantillas`) === false && await n(`select count(*)::int n from tareas_plantillas`) === 0 && await falla(`insert into tareas_plantillas (tipo, titulo) values ('texto', 'X')`), 'las plantillas no las ve ni las crea');
  const hecha = (await q(`select tarea_completar($1, true, '  Un 3, mejor  ') h`, [tTexto.id]))[0].h;
  const [tt] = await q(`select hecha_en, respuesta from tareas where id = $1`, [tTexto.id]);
  check(!!hecha && tt.respuesta === 'Un 3, mejor' && String(tt.hecha_en) === String(hecha), 'marca hecha una de texto, con su respuesta');
  check((await q(`select tarea_completar($1, true, 'Un 2') h`, [tTexto.id]))[0].h.getTime() === hecha.getTime() && (await q(`select respuesta from tareas where id = $1`, [tTexto.id]))[0].respuesta === 'Un 2',
    'cambiar la respuesta no cambia cuándo la hizo');
  const nH = await notis(`clave = $1`, ['tarea_hecha:' + tTexto.id]);
  check(nH.length === 1 && nH[0].usuario_id === pelayo && nH[0].titulo === 'Ana ha hecho su tarea' && nH[0].url === '#revisar' && !JSON.stringify(nH[0]).includes('Un 2'), 'al coach le llega «Ana ha hecho su tarea» (sin la respuesta)');
  await como(ana);
  check(await falla(`select tarea_completar($1)`, [tLuis.id]) && await falla(`select tarea_completar($1)`, [tFutura.id]) && await falla(`select tarea_completar($1, true, $2)`, [tTexto.id, 'x'.repeat(501)])
    && await falla(`select tarea_completar($1, true, null, $2)`, [tTexto.id, vid.id]), 'ni la de otro, ni una de otro día que aún no toca, ni una respuesta larguísima, ni un archivo en una de texto');
  await su();
  const [fAna] = await q(`insert into archivos (atleta_id, tipo, ruta, pose) values ($1, 'foto_progreso', $2, 'frente') returning id`, [aAna.id, `${aAna.id}/tarea-foto.jpg`]);
  const [vAna] = await q(`insert into archivos (atleta_id, tipo, ruta, ejercicio_id) values ($1, 'video_tecnica', $2, $3) returning id`, [aAna.id, `${aAna.id}/tarea-video.mp4`, press.id]);
  const [fLuis] = await q(`insert into archivos (atleta_id, tipo, ruta, pose) values ($1, 'foto_progreso', $2, 'frente') returning id`, [aLuis.id, `${aLuis.id}/ajena.jpg`]);
  await como(ana);
  check(await falla(`select tarea_completar($1)`, [tFoto.id]) && await falla(`select tarea_completar($1, true, null, $2)`, [tFoto.id, vAna.id]) && await falla(`select tarea_completar($1, true, null, $2)`, [tFoto.id, fLuis.id])
    && !!(await q(`select tarea_completar($1, true, null, $2) h`, [tFoto.id, fAna.id]))[0].h, 'la de foto, solo con una foto de progreso suya (ni sin foto, ni con un vídeo, ni con la de otro)');
  check(await falla(`select tarea_completar($1, true, null, $2)`, [tVideo.id, fAna.id]) && !!(await q(`select tarea_completar($1, true, null, $2) h`, [tVideo.id, vAna.id]))[0].h, 'la de vídeo, con su vídeo de técnica');
  await su();
  const apartados = { pesos: await q(`delete from pesos where atleta_id = $1 and fecha >= $2 returning *`, [aAna.id, hoyM]), medidas: await q(`delete from medidas where atleta_id = $1 and fecha >= $2 returning *`, [aAna.id, hoyM]) };
  await como(ana);
  check(await falla(`select tarea_completar($1)`, [tMedida.id]), 'la de peso o medidas, solo con algo apuntado desde su día');
  await su(); await q(`insert into medidas (atleta_id, fecha, cintura_cm) values ($1, $2, 72.5)`, [aAna.id, hoyM]);
  await como(ana);
  check(!!(await q(`select tarea_completar($1) h`, [tMedida.id]))[0].h, 'con la cintura de hoy apuntada, sí');
  check((await q(`select tarea_completar($1, false) h`, [tMedida.id]))[0].h === null && (await q(`select hecha_en from tareas where id = $1`, [tMedida.id]))[0].hecha_en === null
    && (await notis(`clave = $1 and estado = 'pendiente'`, ['tarea_hecha:' + tMedida.id])).length === 0, 'puede deshacerla (y la notificación al coach, si no ha salido, se retira)');
  await como(pelayo, 'aal2');
  await q(`update tareas set revisada_en = now() where id = $1`, [tTexto.id]);
  check(await falla(`update tareas set revisada_en = now() where id = $1`, [tMedida.id]), 'el coach no marca revisada una que no está hecha');
  await como(ana);
  check(await falla(`select tarea_completar($1, false)`, [tTexto.id]) && await falla(`select tarea_completar($1, true, 'Otra')`, [tTexto.id]), 'revisada por el coach, ya no se cambia');
  await su(); await q(`update atletas set estado = 'baja' where id = $1`, [aAna.id]);
  await como(ana);
  check(await falla(`select tarea_completar($1)`, [tMedida.id]) && await n(`select count(*)::int n from tareas`) === 5, 'de baja, las ve pero no las marca');
  await su();
  const baja = (await q(`select baja_en from atletas where id = $1`, [aAna.id]))[0].baja_en;
  check(String(baja) === String(hoyM), 'al pasar a «baja», la base apunta el día');
  await como(pelayo, 'aal2');
  check((await q(`update atletas set baja_en = $2::date - 40 where id = $1 returning baja_en`, [aAna.id, hoyM])).length === 1 && await falla(`update atletas set baja_en = $2::date + 1 where id = $1`, [aAna.id, hoyM])
    && await falla(`update atletas set baja_en = '2019-12-31' where id = $1`, [aAna.id]), 'el coach puede corregirlo (entre 2020 y hoy)');
  check((await q(`update atletas set nombre = nombre where id = $1 returning baja_en`, [aAna.id]))[0].baja_en !== null, 'y no se pierde al cambiar otra cosa');
  await q(`update atletas set estado = 'activo' where id = $1`, [aAna.id]);
  check((await q(`select baja_en from atletas where id = $1`, [aAna.id]))[0].baja_en === null && await falla(`update atletas set baja_en = $2 where id = $1 and baja_en is null returning id`, [aAna.id, hoyM]) === false
    && (await q(`select baja_en from atletas where id = $1`, [aAna.id]))[0].baja_en === null, 'al volver de alta se quita (y un activo no tiene día de baja)');
  const [nuevoBaja] = await q(`insert into atletas (nombre, estado) values ('Antiguo', 'baja') returning id, baja_en`);
  check(String(nuevoBaja.baja_en) === String(hoyM), 'una ficha que nace de baja, con el día de hoy');
  await q(`delete from atletas where id = $1`, [nuevoBaja.id]);
  await como(ana);
  check(await falla(`update atletas set baja_en = null`) || (await q(`update atletas set baja_en = null returning id`)).length === 0, 'el atleta no toca su día de baja');

  // Tras la revisión de seguridad: el vídeo de su ejercicio, un archivo para una sola tarea y el archivo borrado
  await como(pelayo, 'aal2');
  const [tVid2] = await q(`insert into tareas (atleta_id, tipo, titulo, ejercicio_id) values ($1, 'video', 'Otro vídeo del press', $2) returning id`, [aAna.id, press.id]);
  const [tFoto2] = await q(`insert into tareas (atleta_id, tipo, titulo) values ($1, 'foto', 'Otra foto') returning id`, [aAna.id]);
  await su();
  const [vRemo] = await q(`insert into archivos (atleta_id, tipo, ruta, ejercicio_id) values ($1, 'video_tecnica', $2, $3) returning id`, [aAna.id, `${aAna.id}/tarea-remo.mp4`, remo.id]);
  const [vPauta] = await q(`insert into archivos (atleta_id, tipo, ruta, sesion_ejercicio_id) values ($1, 'video_tecnica', $2, $3) returning id`, [aAna.id, `${aAna.id}/tarea-pauta.mp4`, seAna.id]);
  await como(ana);
  let msgV = '';
  try { await q(`select tarea_completar($1, true, null, $2)`, [tVid2.id, vRemo.id]); } catch (e) { msgV = e.message; }
  check(/otro ejercicio/.test(msgV) && msgV.includes('Press banca'), `la de un vídeo de un ejercicio, solo con un vídeo de ese ejercicio («${msgV.slice(0, 70)}…»)`);
  check(await falla(`select tarea_completar($1, true, null, $2)`, [tVid2.id, vAna.id]) && await falla(`select tarea_completar($1, true, null, $2)`, [tFoto2.id, fAna.id]),
    'un mismo vídeo o una misma foto no sirven para dos tareas');
  check(!!(await q(`select tarea_completar($1, true, null, $2) h`, [tVid2.id, vPauta.id]))[0].h, 'vale el vídeo subido desde la pauta de ese ejercicio');
  check((await q(`delete from archivos where id = $1 returning id`, [fAna.id])).length === 1, 'Ana borra la foto con que hizo una tarea');
  const tF = (await q(`select hecha_en, archivo_id, respuesta from tareas where id = $1`, [tFoto.id]))[0];
  check(tF.hecha_en === null && tF.archivo_id === null && tF.respuesta === null, 'y esa tarea, aún sin revisar, vuelve a pendiente');
  await como(pelayo, 'aal2');
  await q(`update tareas set revisada_en = now() where id = $1`, [tVid2.id]);
  await como(ana);
  await q(`delete from archivos where id = $1`, [vPauta.id]);
  const tV2 = (await q(`select hecha_en, archivo_id from tareas where id = $1`, [tVid2.id]))[0];
  check(tV2.hecha_en !== null && tV2.archivo_id === null, 'la ya revisada por el coach se queda hecha (sin el archivo)');
  await su(); await q(`delete from archivos where id = $1`, [vRemo.id]);
  check((await q(`select indexdef from pg_indexes where indexname = 'tareas_archivo_unico'`))[0]?.indexdef.includes('UNIQUE'), 'y la base no deja dos tareas con el mismo archivo ni aunque lleguen a la vez (índice único)');

  // Plantillas: solo el coach, como mucho 30
  await como(pelayo, 'aal2');
  await q(`insert into tareas_plantillas (tipo, titulo, orden) select 'texto', 'Plantilla ' || g, g from generate_series(1, 30) g`);
  check(await falla(`insert into tareas_plantillas (tipo, titulo) values ('foto', 'La 31')`) && await falla(`insert into tareas_plantillas (tipo, titulo, ejercicio_id) values ('texto', 'X', $1)`, [press.id]), 'como mucho 30 plantillas, y el ejercicio solo en las de vídeo');
  await q(`delete from tareas_plantillas`);
  check((await q(`insert into tareas_plantillas (tipo, titulo, ejercicio_id) values ('video', 'Vídeo del press', $1) returning id`, [press.id])).length === 1, 'borrando, vuelve a caber');
  await q(`delete from tareas where id = $1`, [tLuisF.id]);
  check((await notis(`clave = $1`, ['tarea:' + tLuisF.id])).filter((x) => x.estado === 'pendiente').length === 0, 'si el coach borra una tarea, su notificación pendiente se retira');

  // Mensajes programados en el chat
  await como(pelayo, 'aal2');
  const [mP] = await q(`insert into comentarios (atleta_id, texto, enviar_en) values ($1, 'Mañana empezamos bloque', now() + interval '1 day') returning *`, [aLuis.id]);
  check(new Date(mP.creado_en).getTime() === new Date(mP.enviar_en).getTime() && mP.autor === 'coach', 'un mensaje programado lleva la hora a la que sale');
  const nP = (await notis(`clave = $1`, ['comentario:' + mP.id]))[0];
  check(nP?.titulo === 'Pelayo te ha escrito' && new Date(nP.enviar_desde) >= new Date(mP.enviar_en) - 1000, 'su notificación, en la cola para esa hora (la manda la función de envío de siempre)');
  await como(luis);
  check(await n(`select count(*)::int n from comentarios where id = $1`, [mP.id]) === 0 && (await q(`update comentarios set leido_en = now() where id = $1 returning id`, [mP.id])).length === 0,
    'Luis no lo ve (ni lo marca leído) antes de su hora');
  check(await n(`select count(*)::int n from notificaciones where clave = $1`, ['comentario:' + mP.id]) === 0 && await n(`select count(*)::int n from notificaciones where estado = 'pendiente' and enviar_desde > now()`) === 0,
    'ni su notificación pendiente (con su hora y su clave): en «Las últimas» y en su descarga no sale hasta que toca');
  await su();
  const [nCoachF] = await q(`insert into notificaciones (usuario_id, tipo, titulo, url, clave, enviar_desde, caduca_en) values ($1, 'mensaje', 'Prueba', '#revisar', 'prueba-futura', now() + interval '1 hour', now() + interval '1 day') returning id`, [pelayo]);
  await como(pelayo, 'aal2');
  check(await n(`select count(*)::int n from notificaciones where id = $1`, [nCoachF.id]) === 1, 'el coach sigue viendo las suyas pendientes, como antes');
  await su(); await q(`delete from notificaciones where id = $1`, [nCoachF.id]);
  await como(luis);
  check(await falla(`insert into comentarios (atleta_id, texto, enviar_en) values ($1, 'Yo también', now() + interval '1 hour')`, [aLuis.id]), 'el atleta no programa mensajes');
  await como(pelayo, 'aal2');
  check(await falla(`insert into comentarios (atleta_id, texto, enviar_en) values ($1, 'Lejos', now() + interval '91 days')`, [aLuis.id])
    && await falla(`insert into comentarios (sesion_id, texto, enviar_en) values ($1, 'En la sesión', now() + interval '1 hour')`, [sLuis.id]),
    'como mucho a 90 días, y solo en el chat (no en una sesión)');
  const [mYa] = await q(`insert into comentarios (atleta_id, texto, enviar_en) values ($1, 'Ya', now() + interval '5 seconds') returning enviar_en`, [aLuis.id]);
  check(mYa.enviar_en === null, 'uno para «ya mismo» sale ya');
  const nueva = (await q(`select now() + interval '2 days' t`))[0].t;
  const [mC] = await q(`update comentarios set texto = 'Pasado mañana empezamos', enviar_en = $2 where id = $1 returning *`, [mP.id, nueva]);
  check(mC.texto === 'Pasado mañana empezamos' && new Date(mC.creado_en).getTime() === new Date(nueva).getTime(), 'mientras no ha salido, el coach cambia el texto y la hora');
  const nP2 = await notis(`clave = $1 and estado = 'pendiente'`, ['comentario:' + mP.id]);
  check(nP2.length === 1 && new Date(nP2[0].enviar_desde) >= new Date(nueva) - 1000, 'y su notificación se rehace para la hora nueva');
  await como(pelayo, 'aal2');
  check(await falla(`update comentarios set atleta_id = $2 where id = $1`, [mP.id, aAna.id]), 'de un programado solo se cambian el texto y la hora');
  await su(); await q(`update comentarios set enviar_en = now() - interval '1 minute', creado_en = now() - interval '1 minute' where id = $1`, [mP.id]);
  await como(luis);
  check(await n(`select count(*)::int n from comentarios where id = $1`, [mP.id]) === 1 && (await q(`update comentarios set leido_en = now() where id = $1 returning id`, [mP.id])).length === 1, 'llegada su hora, Luis lo ve y lo marca leído');
  check(await n(`select count(*)::int n from notificaciones where clave = $1`, ['comentario:' + mP.id]) === 1, 'y también su notificación');
  await como(pelayo, 'aal2');
  // (v0.54: el texto de lo propio se edita en sus 15 minutos, como cualquier mensaje; pasados, no)
  await su(); await q(`update comentarios set enviar_en = now() - interval '20 minutes', creado_en = now() - interval '20 minutes' where id = $1`, [mP.id]); await como(pelayo, 'aal2');
  check(await falla(`update comentarios set texto = 'Cambiado' where id = $1`, [mP.id]) && await falla(`update comentarios set enviar_en = now() + interval '1 day' where id = $1`, [mP.id]), 'ya salido, no se reprograma (ni se edita pasados sus 15 minutos)');
  const [mB] = await q(`insert into comentarios (atleta_id, texto, enviar_en) values ($1, 'Lo cancelo', now() + interval '3 hours') returning id`, [aLuis.id]);
  await q(`delete from comentarios where id = $1`, [mB.id]);
  check((await notis(`clave = $1 and estado = 'pendiente'`, ['comentario:' + mB.id])).length === 0, 'cancelarlo (borrarlo) retira su notificación');

  // Avisos programados
  await como(pelayo, 'aal2');
  const [avP] = await q(`insert into avisos (texto, enviar_en) values ('Mañana, horario de verano', now() + interval '1 day') returning *`);
  check(String(avP.desde) === String((await q(`select ((now() + interval '1 day') at time zone 'Europe/Madrid')::date d`))[0].d), 'un aviso programado empieza el día (en Madrid) de su hora');
  const nAv = (await notis(`clave = $1 and usuario_id = $2`, ['aviso:' + avP.id, luis]))[0];
  check(!!nAv && new Date(nAv.enviar_desde) >= new Date(avP.enviar_en) - 1000, 'y su notificación sale a esa hora');
  await como(luis);
  check(await n(`select count(*)::int n from avisos where id = $1`, [avP.id]) === 0, 'antes, Luis no lo ve');
  await como(pelayo, 'aal2');
  check(await falla(`insert into avisos (texto, enviar_en) values ('Lejos', now() + interval '91 days')`), 'como mucho a 90 días');
  await su(); await q(`update avisos set enviar_en = now() - interval '1 minute', desde = (now() at time zone 'Europe/Madrid')::date where id = $1`, [avP.id]);
  await como(luis);
  check(await n(`select count(*)::int n from avisos where id = $1`, [avP.id]) === 1, 'a su hora, lo ve');
  await como(pelayo, 'aal2');
  let msgAv = '';
  try { await q(`update avisos set enviar_en = now() + interval '1 day' where id = $1`, [avP.id]); } catch (e) { msgAv = e.message; }
  check(/ya ha salido/.test(msgAv), 'uno que ya ha salido no se puede volver a programar (no se esconde otra vez)');
  const [avYa] = await q(`insert into avisos (texto) values ('Publicado hoy') returning id`);
  const [avLuego] = await q(`insert into avisos (texto, desde) values ('Desde pasado mañana', (now() at time zone 'Europe/Madrid')::date + 2) returning id`);
  check(await falla(`update avisos set enviar_en = now() + interval '2 hours' where id = $1`, [avYa.id])
    && (await q(`update avisos set enviar_en = now() + interval '3 days' where id = $1 returning id`, [avLuego.id])).length === 1
    && (await q(`update avisos set texto = 'Corregido' where id = $1 returning id`, [avP.id])).length === 1,
    'tampoco uno publicado sin hora que ya se ve; uno que aún no ha empezado, sí; y el texto de uno salido se puede corregir');
  await q(`delete from avisos where id = any($1::uuid[])`, [[avP.id, avYa.id, avLuego.id]]);

  // El bloque entero
  await como(pelayo, 'aal2');
  await q(`update semanas set programacion = 'en_programacion' where id = $1`, [wAna2]);
  await como(ana);
  const bs = await q(`select * from bloque_semanas($1)`, [bAna]);
  check(bs.length >= 2 && bs[0].numero === 1 && bs[0].publicada && bs.find((w) => w.numero === 2)?.publicada === false && Object.keys(bs[0]).join() === 'numero,fecha_inicio,publicada',
    'Ana ve las semanas de su bloque (la que no está publicada, solo como «por publicar»: sin foco, nota ni sesiones)');
  check(await n(`select count(*)::int n from semanas where id = $1`, [wAna2]) === 0, 'la sin publicar sigue sin verse por la tabla');
  check((await q(`select * from bloque_semanas($1)`, [bLuis])).length === 0 && (await q(`select * from bloque_semanas($1)`, [pl.id])).length === 0, 'del bloque de otro o de una plantilla, nada');
  await como(pelayo, 'aal2');
  check((await q(`select * from bloque_semanas($1)`, [bLuis])).length >= 1 && (await q(`select * from bloque_semanas($1)`, [pl.id])).length === 0, 'el coach, de cualquier atleta (las plantillas no son un bloque)');
  await q(`update semanas set programacion = 'programada' where id = $1`, [wAna2]);

  // Ordenado para lo que sigue
  await su();
  await q(`delete from tareas`); await q(`delete from tareas_plantillas`);
  await q(`delete from archivos where id = any($1::uuid[])`, [[fAna.id, vAna.id, fLuis.id]]);
  await q(`delete from medidas where atleta_id = $1 and fecha = $2 and cintura_cm = 72.5`, [aAna.id, hoyM]);
  for (const [tabla, filas] of Object.entries(apartados)) for (const f of filas) {
    const cols = Object.keys(f);
    await q(`insert into ${tabla} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, cols.map((c) => f[c]));
  }
  await q(`delete from notificaciones where tipo in ('tarea', 'tarea_hecha')`);
}

console.log('\nDías de entreno por semana (migración 031)');
{
  await su();
  await q(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  check((await q(`select dias_semana from atletas where id = $1`, [aAna.id]))[0].dias_semana === null, 'de entrada, sin objetivo (null: automático, todo como antes)');
  const col = (await q(`select data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'atletas' and column_name = 'dias_semana'`))[0];
  check(col?.data_type === 'smallint' && col.is_nullable === 'YES', 'atletas.dias_semana es un smallint que admite null');
  await como(pelayo, 'aal2');
  check((await q(`update atletas set dias_semana = 3 where id = $1 returning dias_semana`, [aAna.id]))[0]?.dias_semana === 3, 'el coach le pone 3 días por semana');
  check((await q(`update atletas set dias_semana = 1 where id = $1 returning dias_semana`, [aAna.id]))[0]?.dias_semana === 1
    && (await q(`update atletas set dias_semana = 7 where id = $1 returning dias_semana`, [aAna.id]))[0]?.dias_semana === 7, 'de 1 a 7');
  check(await falla(`update atletas set dias_semana = 0 where id = $1`, [aAna.id]) && await falla(`update atletas set dias_semana = 8 where id = $1`, [aAna.id])
    && await falla(`update atletas set dias_semana = -3 where id = $1`, [aAna.id]) && await falla(`insert into atletas (nombre, dias_semana) values ('Fuera', 9)`),
    'fuera de 1 a 7, la base lo rechaza (0, 8, −3 o 9 al crear la ficha)');
  check((await q(`select dias_semana from atletas where id = $1`, [aAna.id]))[0].dias_semana === 7, 'y lo rechazado no cambia lo que había');
  await q(`update atletas set dias_semana = 3 where id = $1`, [aAna.id]);
  await como(ana);
  check((await q(`select dias_semana from atletas`))[0]?.dias_semana === 3, 'Ana lee su objetivo en su ficha (la app cuenta con él)');
  const cambia = await q(`update atletas set dias_semana = 5 returning id`).catch(() => []);
  const quita = await q(`update atletas set dias_semana = null where perfil_id = $1 returning id`, [ana]).catch(() => []);
  await su();
  check(cambia.length === 0 && quita.length === 0 && (await q(`select dias_semana from atletas where id = $1`, [aAna.id]))[0].dias_semana === 3, 'Ana no puede cambiarse el objetivo ni quitárselo (lo decide el coach)');
  await como(luis);
  check((await q(`select dias_semana from atletas where id = $1`, [aAna.id])).length === 0 && (await q(`update atletas set dias_semana = 2 where id = $1 returning id`, [aAna.id]).catch(() => [])).length === 0,
    'Luis no ve ni toca el de Ana');
  check(!(await q(`select exists (select 1 from pg_policies where tablename = 'atletas' and cmd in ('UPDATE', 'ALL') and policyname <> 'coach_todo') x`))[0].x, 'en atletas, la única política que deja cambiar algo es la del coach');
  await como(pelayo, 'aal2');
  check((await q(`update atletas set dias_semana = null where id = $1 returning dias_semana`, [aAna.id]))[0]?.dias_semana === null, 'el coach lo vuelve a «Automático» (null)');
  const sin30 = new PGlite();
  await sin30.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin30.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '030')) await sin30.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let errSin30 = null;
  try { await sin30.exec(readFileSync(new URL('../supabase/migraciones/031_dias_semana.sql', import.meta.url), 'utf8')); } catch (e) { errSin30 = e.message; }
  check(/Antes de la 031 hace falta la 030/.test(errSin30 || '') && !(await sin30.query(`select 1 from information_schema.columns where table_name = 'atletas' and column_name = 'dias_semana'`)).rows.length,
    'la 031 no se aplica sin la 030 (y no deja nada a medias)');
  await sin30.close();
}

console.log('\nEl chat como WhatsApp: responder, editar, eliminar, reacciones, destacados, estado, presencia y Realtime (migración 032)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  await su();
  await q(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await q(`delete from chat_cupos`);
  const cols = (await q(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'comentarios' and column_name in ('responde_a', 'editado_en', 'eliminado_en') order by 1`)).map((r) => r.column_name);
  check(cols.join() === 'editado_en,eliminado_en,responde_a', 'comentarios trae responde_a, editado_en y eliminado_en');
  check((await q(`select relname from pg_class where relname in ('chat_cupos', 'comentario_reacciones', 'comentario_destacados', 'conversacion_estado', 'presencia') and relrowsecurity order by 1`)).length === 5,
    'las cinco tablas nuevas nacen con permisos por fila');
  check(!(await q(`select 1 from pg_policies where tablename = 'comentarios' and policyname = 'atleta_borrar'`)).length, 'el atleta ya no tiene política para borrar comentarios a mano');
  // Mensajes de partida: uno del coach a Ana, uno de Ana, uno del coach a Luis, uno programado a Ana y uno en su sesión
  await como(pelayo, 'aal2');
  const [mC] = await q(`insert into comentarios (atleta_id, texto) values ($1, '¿Qué tal la rodilla hoy?') returning *`, [aAna.id]);
  const [mL] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Luis, mañana descanso') returning *`, [aLuis.id]);
  const [mP] = await q(`insert into comentarios (atleta_id, texto, enviar_en) values ($1, 'Sorpresa del lunes', now() + interval '2 days') returning *`, [aAna.id]);
  const [mS] = await q(`insert into comentarios (sesion_id, texto) values ($1, 'En esta sesión, baja el peso') returning *`, [ses.id]);
  await como(ana);
  const [mA] = await q(`insert into comentarios (atleta_id, texto, editado_en, eliminado_en) values ($1, 'Mejor, gracias', now(), now()) returning *`, [aAna.id]);
  check(mA.editado_en === null && mA.eliminado_en === null, 'nadie crea un mensaje ya «editado» o «eliminado» (la base lo limpia)');

  console.log('  · Responder');
  const [rA] = await q(`insert into comentarios (atleta_id, texto, responde_a) values ($1, 'Sí, mucho mejor', $2) returning *`, [aAna.id, mC.id]);
  check(rA.responde_a === mC.id, 'Ana responde citando un mensaje de su chat');
  check(await falla(`insert into comentarios (atleta_id, texto, responde_a) values ($1, 'Cotilla', $2)`, [aAna.id, mL.id]), 'no puede citar un mensaje de otra conversación (el de Luis)');
  check(await falla(`insert into comentarios (atleta_id, texto, responde_a) values ($1, 'Adivino', $2)`, [aAna.id, mP.id]), 'ni uno programado que aún no ha salido, aunque sepa su id (la cita no lo destapa)');
  check(await falla(`insert into comentarios (atleta_id, texto, responde_a) values ($1, 'Desde el chat', $2)`, [aAna.id, mS.id]), 'ni, desde el chat, uno de una sesión (tiene que ser del mismo hilo)');
  const [rS] = await q(`insert into comentarios (sesion_id, texto, responde_a) values ($1, 'Vale, lo bajo', $2) returning *`, [ses.id, mS.id]);
  check(rS.responde_a === mS.id && rS.sesion_id === ses.id, 'en el hilo de esa sesión, sí');
  check(await falla(`update comentarios set responde_a = $2 where id = $1`, [mA.id, mC.id]), 'la cita no se pone ni se cambia después');
  await como(luis);
  check(await falla(`insert into comentarios (atleta_id, texto, responde_a) values ($1, 'Me meto', $2)`, [aLuis.id, mC.id]), 'Luis no puede citar en su chat un mensaje del de Ana');
  await como(pelayo, 'aal2');
  check(await falla(`insert into comentarios (atleta_id, texto, responde_a) values ($1, 'Mezclado', $2)`, [aLuis.id, mC.id]), 'el coach tampoco mezcla conversaciones (citar a Ana en el chat de Luis)');
  check(await falla(`insert into comentarios (atleta_id, texto, responde_a) values ($1, 'Mi programado', $2)`, [aAna.id, mP.id]), 'ni cita uno suyo programado que aún no ha salido');

  console.log('  · Editar');
  await como(ana);
  const [eA] = await q(`update comentarios set texto = 'Mejor, gracias. ¡Mucho', editado_en = '2020-01-01' where id = $1 returning *`, [mA.id]);
  check(new Date(eA.editado_en).getFullYear() > 2020, 'la hora de la edición la pone la base (no la que mande el móvil)');
  const [eA2] = await q(`update comentarios set texto = 'Mejor, gracias. ¡Mucho!' where id = $1 returning *`, [mA.id]);
  check(eA2.texto === 'Mejor, gracias. ¡Mucho!' && eA2.editado_en !== null && Math.abs(new Date(eA2.editado_en) - Date.now()) < 60000, 'Ana edita su mensaje en sus 15 minutos: la base apunta cuándo');
  check(await falla(`update comentarios set texto = 'Hackeado' where id = $1`, [mC.id]), 'no edita el del coach');
  check(await falla(`update comentarios set texto = '   ' where id = $1`, [mA.id]), 'ni deja un mensaje en blanco');
  check(await falla(`update comentarios set texto = 'Otra', leido_en = now() where id = $1`, [mA.id]), 'de lo suyo, solo el texto (ni marcarlo leído de paso)');
  check(await falla(`update comentarios set editado_en = null where id = $1`, [mA.id]) && await falla(`update comentarios set eliminado_en = now() where id = $1`, [mA.id]),
    '«Editado» y «eliminado» no se tocan a mano');
  await como(pelayo, 'aal2');
  check(await falla(`update comentarios set texto = 'Lo que yo diga' where id = $1`, [mA.id]), 'el coach no edita lo de Ana');
  const [eC] = await q(`update comentarios set texto = '¿Qué tal la rodilla esta mañana?' where id = $1 returning editado_en`, [mC.id]);
  check(eC.editado_en !== null, 'el coach edita lo suyo, también en sus 15 minutos');
  const [eP] = await q(`update comentarios set texto = 'Sorpresa del lunes (cambiada)' where id = $1 returning *`, [mP.id]);
  check(eP.editado_en === null && eP.texto === 'Sorpresa del lunes (cambiada)', 'su programado lo sigue cambiando como antes (sin «Editado»: aún no lo ha visto nadie)');
  await su(); await q(`update comentarios set creado_en = now() - interval '16 minutes' where id = $1`, [mA.id]);
  await como(ana);
  check(await falla(`update comentarios set texto = 'Tarde' where id = $1`, [mA.id]), 'pasados 15 minutos, ya no se edita');
  await su();
  const [adjA] = await q(`insert into archivos (atleta_id, tipo, ruta, mime, subido_por) values ($1::uuid, 'adjunto', $1::text || '/chat-foto.jpg', 'image/jpeg', 'atleta') returning *`, [aAna.id]);
  const [vidA] = await q(`insert into archivos (atleta_id, tipo, ruta, mime) values ($1::uuid, 'video_tecnica', $1::text || '/tecnica-032.mp4', 'video/mp4') returning *`, [aAna.id]);
  await como(ana);
  const [mF] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'La rodilla') returning *`, [adjA.id]);
  const [mV] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Mi sentadilla') returning *`, [vidA.id]);
  check(await falla(`update comentarios set texto = 'Otro pie' where id = $1`, [mF.id]), 'un mensaje con foto o vídeo no se edita (solo los de texto)');

  console.log('  · Reacciones');
  await como(ana);
  const [rx] = await q(`insert into comentario_reacciones (comentario_id, emoji, usuario_id) values ($1, '💪', $2) returning *`, [mC.id, pelayo]);
  check(rx.usuario_id === ana, 'Ana reacciona a un mensaje del coach (a su nombre, aunque mande otro)');
  check(await falla(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '👍')`, [mC.id]), 'una por persona y mensaje');
  const [rx2] = await q(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '❤️') on conflict (comentario_id, usuario_id) do update set emoji = excluded.emoji returning emoji`, [mC.id]);
  check(rx2.emoji === '❤️', 'tocar otra la cambia');
  // (034) cualquier emoji (cada uno elige los suyos), pero solo un emoji: ni texto, ni espacios, ni invisibles
  check(await falla(`insert into comentario_reacciones (comentario_id, emoji) values ($1, 'ok')`, [mA.id]) && await falla(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '👍 ')`, [mA.id])
    && await falla(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '\u200d')`, [mA.id]) && await falla(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '\u202e👍')`, [mA.id])
    && await falla(`insert into comentario_reacciones (comentario_id, emoji) values ($1, $2)`, [mA.id, '👍'.repeat(17)]), 'solo un emoji (sin texto, espacios ni invisibles)');
  check(await falla(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '👍')`, [mL.id]), 'no reacciona a los mensajes de Luis');
  check(await falla(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '👍')`, [mP.id]), 'ni a uno programado que aún no ha salido');
  check(await falla(`update comentario_reacciones set comentario_id = $2 where comentario_id = $1`, [mC.id, mA.id]), 'de una reacción solo se cambia el emoji');
  await como(pelayo, 'aal2');
  await q(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '👍')`, [mA.id]);
  check(await falla(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '👍')`, [mP.id]), 'el coach tampoco, a su programado antes de que salga');
  await como(ana);
  check(await n(`select count(*)::int n from comentario_reacciones`) === 2, 'Ana ve las reacciones de su conversación (la suya y la del coach)');
  check((await q(`delete from comentario_reacciones where usuario_id = $1 returning 1`, [pelayo])).length === 0 && (await q(`update comentario_reacciones set emoji = '😂' where usuario_id = $1 returning 1`, [pelayo])).length === 0,
    'no quita ni cambia la del coach');
  await como(luis);
  check(await n(`select count(*)::int n from comentario_reacciones`) === 0, 'Luis no ve las reacciones de la conversación de Ana');
  await como(ana);
  await q(`delete from comentario_reacciones where comentario_id = $1`, [mC.id]);
  check(await n(`select count(*)::int n from comentario_reacciones where comentario_id = $1`, [mC.id]) === 0, 'tocar la misma la quita');
  await su(); await q(`delete from chat_cupos`);
  await como(ana);
  let cupo = null;
  for (let i = 0; i < 121 && !cupo; i++) {
    try { await q(i ? `update comentario_reacciones set emoji = $2 where comentario_id = $1` : `insert into comentario_reacciones (comentario_id, emoji) values ($1, $2)`, [mC.id, i % 2 ? '👍' : '😂']); }
    catch (e) { cupo = { i, msg: e.message }; }
  }
  check(cupo?.i === 120 && /reaccionado muchas veces/.test(cupo.msg), 'como mucho 120 reacciones por hora (el coach no tiene cupo)');
  await su(); await q(`delete from chat_cupos`); await q(`delete from comentario_reacciones`);

  console.log('  · Destacados');
  await como(ana);
  const [dA] = await q(`insert into comentario_destacados (comentario_id, usuario_id) values ($1, $2) returning *`, [mC.id, pelayo]);
  check(dA.usuario_id === ana, 'Ana destaca un mensaje (a su nombre)');
  check(await falla(`insert into comentario_destacados (comentario_id) values ($1)`, [mL.id]) && await falla(`insert into comentario_destacados (comentario_id) values ($1)`, [mP.id]),
    'no destaca los de Luis ni uno programado');
  await como(pelayo, 'aal2');
  check(await n(`select count(*)::int n from comentario_destacados`) === 0, 'el coach no ve los destacados de Ana');
  await q(`insert into comentario_destacados (comentario_id) values ($1)`, [mA.id]);
  await como(ana);
  check(await n(`select count(*)::int n from comentario_destacados`) === 1 && (await q(`delete from comentario_destacados where usuario_id = $1 returning 1`, [pelayo])).length === 0,
    'ni Ana los del coach (ni puede quitarlos)');

  console.log('  · Eliminar para todos');
  await como(pelayo, 'aal2');
  await q(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '😮')`, [mA.id]);
  await como(ana);
  await q(`insert into comentario_destacados (comentario_id) values ($1)`, [mA.id]);
  const [rA2] = await q(`insert into comentarios (atleta_id, texto, responde_a) values ($1, 'Cito lo mío', $2) returning id`, [aAna.id, mA.id]);
  check(await falla(`select comentario_eliminar($1)`, [mC.id]), 'Ana no elimina lo del coach');
  await como(luis);
  check(await falla(`select comentario_eliminar($1)`, [mA.id]), 'ni Luis lo de Ana');
  await como(ana);
  check(await falla(`select comentario_eliminar($1)`, [mP.id]), 'ni Ana «elimina» el programado que aún no ve');
  const el = (await q(`select comentario_eliminar($1) r`, [mA.id]))[0].r;
  const tras = (await q(`select * from comentarios where id = $1`, [mA.id]))[0];
  check(el.estado === 'eliminado' && tras.texto === 'Se eliminó este mensaje' && tras.eliminado_en !== null && tras.editado_en === null && tras.responde_a === null,
    'Ana elimina lo suyo: la base borra el texto (queda «Se eliminó este mensaje»)');
  await su();
  check(await n(`select count(*)::int n from comentario_reacciones where comentario_id = $1`, [mA.id]) === 0 && await n(`select count(*)::int n from comentario_destacados where comentario_id = $1`, [mA.id]) === 0,
    'y se van sus reacciones y los destacados de todos');
  await como(pelayo, 'aal2');
  check(!(await q(`select texto from comentarios where atleta_id = $1`, [aAna.id])).some((x) => /Mejor, gracias/.test(x.texto)), 'el coach ya no puede leer el texto por ningún lado');
  check((await q(`select responde_a from comentarios where id = $1`, [rA2.id]))[0].responde_a === mA.id, 'la respuesta que lo citaba lo sigue citando (y la cita sale eliminada)');
  check(await falla(`update comentarios set texto = 'Resucitado' where id = $1`, [mA.id]) && await falla(`insert into comentarios (atleta_id, texto, responde_a) values ($1, 'x', $2)`, [aAna.id, mA.id]),
    'uno eliminado no se edita ni se cita');
  await como(ana);
  check(await falla(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '👍')`, [mA.id]) && await falla(`insert into comentario_destacados (comentario_id) values ($1)`, [mA.id]),
    'ni se reacciona a él ni se destaca');
  check((await q(`select comentario_eliminar($1) r`, [mA.id]))[0].r.estado === 'eliminado', 'eliminarlo otra vez no hace nada');
  const elF = (await q(`select comentario_eliminar($1) r`, [mF.id]))[0].r;
  await su();
  check(elF.rutas.length === 1 && elF.rutas[0] === `${aAna.id}/chat-foto.jpg` && !(await q(`select 1 from archivos where id = $1`, [adjA.id])).length
    && (await q(`select archivo_id from comentarios where id = $1`, [mF.id]))[0]?.archivo_id === null,
    'la foto del chat se va con él (la base la quita y da su ruta para borrarla de Storage); el mensaje queda, eliminado');
  await como(ana);
  await q(`select comentario_eliminar($1)`, [mV.id]);
  await su();
  check((await q(`select archivo_id from comentarios where id = $1`, [mV.id]))[0].archivo_id === vidA.id && (await q(`select 1 from archivos where id = $1`, [vidA.id])).length === 1,
    'el vídeo de técnica del diario no se borra al eliminar su comentario');
  await q(`update comentarios set creado_en = now() - interval '49 hours' where id = $1`, [rA.id]);
  await como(ana);
  check(await falla(`select comentario_eliminar($1)`, [rA.id]), 'pasadas 48 horas, ya no se elimina para todos');
  await su(); await q(`update atletas set estado = 'baja' where id = $1`, [aAna.id]);
  await como(ana);
  check(await falla(`select comentario_eliminar($1)`, [rS.id]), 'una cuenta de baja no elimina');
  await su(); await q(`update atletas set estado = 'activo' where id = $1`, [aAna.id]);
  await como(pelayo, 'aal2');
  const [mC2] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Era para otro') returning id`, [aAna.id]);
  check((await notis(`clave = $1 and estado = 'pendiente'`, ['comentario:' + mC2.id])).length === 1, 'el del coach deja su notificación pendiente…');
  await como(pelayo, 'aal2');
  await q(`select comentario_eliminar($1)`, [mC2.id]);
  check((await notis(`clave = $1`, ['comentario:' + mC2.id])).length === 0, '…y al eliminarlo antes de que salga, ya no sale');
  check((await notis(`tipo = 'mensaje' and usuario_id = $1`, [pelayo])).every((x) => !/Mejor|rodilla|Cito/.test(`${x.titulo} ${x.cuerpo || ''}`)), 'las notificaciones nunca llevan el texto (tampoco el de lo eliminado)');
  await como(pelayo, 'aal2');
  const can = (await q(`select comentario_eliminar($1) r`, [mP.id]))[0].r;
  check(can.estado === 'cancelado' && !(await q(`select 1 from comentarios where id = $1`, [mP.id])).length && (await notis(`clave = $1`, ['comentario:' + mP.id])).length === 0,
    'un programado del coach que aún no ha salido se cancela (se borra, con su notificación)');
  await su(); await q(`delete from chat_cupos`);
  await como(ana);
  const borrables = [];
  for (let i = 0; i < 31; i++) borrables.push((await q(`insert into comentarios (atleta_id, texto) values ($1, $2) returning id`, [aAna.id, `m${i}`]))[0].id);
  let cupoE = null;
  for (const [i, id] of borrables.entries()) { try { await q(`select comentario_eliminar($1)`, [id]); } catch (e) { cupoE = { i, msg: e.message }; break; } }
  check(cupoE?.i === 30 && /eliminado muchos/.test(cupoE.msg), 'como mucho 30 eliminaciones por hora');
  await su(); await q(`delete from chat_cupos`); await q(`delete from comentarios where id = any($1::uuid[])`, [borrables]);

  console.log('  · Estado de las conversaciones (solo el coach)');
  await su();
  const [aX] = await q(`insert into atletas (nombre) values ('Xenia') returning id`);
  const [aY] = await q(`insert into atletas (nombre) values ('Yago') returning id`);
  await como(pelayo, 'aal2');
  for (const a of [aAna.id, aLuis.id, aX.id]) await q(`insert into conversacion_estado (atleta_id, fijada_en) values ($1, '2020-01-01') on conflict (atleta_id) do update set fijada_en = excluded.fijada_en`, [a]);
  const fij = await q(`select fijada_en from conversacion_estado where atleta_id = $1`, [aAna.id]);
  check(Math.abs(new Date(fij[0].fijada_en) - Date.now()) < 60000, 'el coach fija una conversación (la hora la pone la base)');
  check(await falla(`insert into conversacion_estado (atleta_id, fijada_en) values ($1, now())`, [aY.id]), 'como mucho 3 fijadas');
  const [ar] = await q(`update conversacion_estado set archivada_en = now() where atleta_id = $1 returning *`, [aLuis.id]);
  check(ar.archivada_en !== null && ar.fijada_en === null, 'archivar la desfija (como WhatsApp)');
  await q(`insert into conversacion_estado (atleta_id, fijada_en) values ($1, now())`, [aY.id]);
  await q(`insert into conversacion_estado (atleta_id, no_leida) values ($1, true) on conflict (atleta_id) do update set no_leida = true`, [aAna.id]);
  await como(ana);
  check(await n(`select count(*)::int n from conversacion_estado`) === 0 && await falla(`insert into conversacion_estado (atleta_id, fijada_en) values ($1, now())`, [aAna.id])
    && (await q(`update conversacion_estado set no_leida = false returning 1`)).length === 0, 'Ana no ve ni toca el estado de las conversaciones del coach (ni la suya)');
  await como(luis);
  await q(`insert into comentarios (atleta_id, texto) values ($1, 'Pelayo, una duda')`, [aLuis.id]);
  await su();
  check((await q(`select archivada_en from conversacion_estado where atleta_id = $1`, [aLuis.id]))[0].archivada_en === null, 'un mensaje nuevo de Luis saca su conversación de archivadas');
  await q(`delete from conversacion_estado`); await q(`delete from atletas where id = any($1::uuid[])`, [[aX.id, aY.id]]);

  console.log('  · Última conexión y «Mostrar cuándo estoy en línea»');
  await como(ana);
  const p1 = (await q(`select presencia_marcar() r`))[0].r;
  check(p1.visible === true && Math.abs(new Date(p1.ultima_conexion) - Date.now()) < 60000, 'Ana marca su última conexión (la hora la pone la base)');
  await su(); await q(`update presencia set ultima_conexion = now() - interval '20 seconds' where usuario_id = $1`, [ana]);
  const antes = (await q(`select ultima_conexion from presencia where usuario_id = $1`, [ana]))[0].ultima_conexion;
  await como(ana);
  await q(`select presencia_marcar()`);
  await su();
  check(new Date((await q(`select ultima_conexion from presencia where usuario_id = $1`, [ana]))[0].ultima_conexion).getTime() === new Date(antes).getTime(), 'como mucho una vez por minuto (antes, no la reescribe)');
  await como(ana);
  check(await falla(`insert into presencia (usuario_id, ultima_conexion) values ($1, now())`, [ana]) && await falla(`update presencia set ultima_conexion = now() + interval '1 year'`),
    'no se escribe a mano (solo con presencia_marcar)');
  await como(pelayo, 'aal2'); await q(`select presencia_marcar()`);
  await como(luis); await q(`select presencia_marcar()`);
  check(await n(`select count(*)::int n from presencia where usuario_id = $1`, [ana]) === 0 && await n(`select count(*)::int n from presencia where usuario_id = $1`, [pelayo]) === 1,
    'Luis no ve la de Ana; sí la del coach');
  await como(ana);
  check(await n(`select count(*)::int n from presencia where usuario_id = $1`, [pelayo]) === 1 && await n(`select count(*)::int n from presencia where usuario_id = $1`, [luis]) === 0,
    'Ana ve la del coach, no la de Luis');
  await como(pelayo, 'aal2');
  check(await n(`select count(*)::int n from presencia where usuario_id = any($1::uuid[])`, [[ana, luis]]) === 2, 'el coach ve la de sus atletas');
  await como(ana);
  const p2 = (await q(`select presencia_marcar(false) r`))[0].r;
  check(p2.visible === false && p2.ultima_conexion === null, 'Ana la oculta: no se guarda su última conexión');
  check(await n(`select count(*)::int n from presencia where usuario_id = $1`, [pelayo]) === 0, 'y, como en WhatsApp, deja de ver la del coach');
  await como(pelayo, 'aal2');
  check(await n(`select count(*)::int n from presencia where usuario_id = $1`, [ana]) === 0, 'el coach deja de ver la de Ana');
  await como(ana); await q(`select presencia_marcar(true)`);
  await anon();
  check(await falla(`select * from presencia`) && await falla(`select presencia_marcar()`), 'sin sesión, nada');

  console.log('  · Realtime: el canal privado de cada conversación');
  const canal = async (topic, ext, quien, aal) => {
    await (aal ? como(quien, aal) : como(quien));
    await db.exec(`select set_config('realtime.topic', '${topic}', false)`);
    const envia = !(await falla(`insert into realtime.messages (topic, extension, event, payload) values ($1, $2, 'escribiendo', '{}')`, [topic, ext]));
    const recibe = (await q(`select count(*)::int n from realtime.messages where extension = $1`, [ext]))[0].n > 0;
    return { envia, recibe };
  };
  await su(); await q(`insert into realtime.messages (topic, extension, event, payload) values ('x', 'broadcast', 'x', '{}'), ('x', 'presence', 'x', '{}')`);
  const tAna = `chat:${aAna.id}`, tLuis = `chat:${aLuis.id}`;
  const r1 = await canal(tAna, 'broadcast', ana);
  check(r1.envia && r1.recibe, 'Ana entra en el canal de su conversación: envía y recibe («escribiendo…»)');
  const r2 = await canal(tAna, 'presence', ana);
  check(r2.envia && r2.recibe, 'y su presencia («en línea»)');
  const r3 = await canal(tLuis, 'broadcast', ana);
  const r4 = await canal(tLuis, 'presence', ana);
  check(!r3.envia && !r3.recibe && !r4.envia && !r4.recibe, 'no entra en el de Luis (ni envía ni recibe)');
  const r5 = await canal(tAna, 'broadcast', luis);
  check(!r5.envia && !r5.recibe, 'Luis no entra en el de Ana');
  const r6 = await canal(tLuis, 'broadcast', pelayo, 'aal2');
  const r6b = await canal(tAna, 'presence', pelayo, 'aal2');
  check(r6.envia && r6.recibe && r6b.envia && r6b.recibe, 'el coach, en los de sus atletas');
  const raros = [];
  for (const t of ['chat:no-es-un-uuid', `otro:${aAna.id}`, `chat:${aAna.id}x`, `chat:00000000-0000-0000-0000-000000000000`, '']) raros.push(await canal(t, 'broadcast', pelayo, 'aal2'));
  check(raros.every((x) => !x.envia && !x.recibe), 'un canal con otro nombre (o de un atleta que no existe) no vale para nadie, tampoco para el coach');
  const propio = await canal(`fbe-cambios:${ana}`, 'broadcast', ana), ajeno = await canal(`fbe-cambios:${luis}`, 'broadcast', ana), propioP = await canal(`fbe-cambios:${ana}`, 'presence', ana);
  check(propio.envia && propio.recibe && !ajeno.envia && !ajeno.recibe && !propioP.envia, 'el canal propio de la cuenta (fbe-cambios:<su id>, para los mensajes nuevos): solo el suyo, y sin presencia');
  const r7 = await canal(tAna, 'postgres_changes', ana);
  check(!r7.envia, 'solo broadcast y presencia');
  await como(ana); await q(`select presencia_marcar(false)`);
  const r8 = await canal(tAna, 'presence', ana);
  const r9 = await canal(tAna, 'broadcast', ana);
  check(!r8.envia && !r8.recibe && !r9.envia && !r9.recibe, 'con «Mostrar cuándo estoy en línea» apagado, Ana no comparte ni ve la presencia, ni el «escribiendo…» (tras la revisión: el canal entero)');
  const r9b = await canal(`fbe-cambios:${ana}`, 'broadcast', ana);
  check(r9b.envia && r9b.recibe && (await q(`select chat_privado_disponible() d`))[0].d === true, 'su canal propio (los mensajes nuevos) sigue; y la app sabe que los privados están disponibles');
  await como(ana); await q(`select presencia_marcar(true)`);
  await anon(); await db.exec(`select set_config('realtime.topic', '${tAna}', false)`);
  check(await falla(`insert into realtime.messages (topic, extension, event, payload) values ($1, 'broadcast', 'x', '{}')`, [tAna]), 'sin sesión, nada');
  await su(); await db.exec(`select set_config('realtime.topic', '', false)`); await q(`delete from realtime.messages`);
  const sinRt = new PGlite();
  await sinRt.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8').split('-- Realtime (lo justo')[0]);
  await sinRt.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  let errRt = null;
  try { for (const m of migraciones()) await sinRt.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8')); } catch (e) { errRt = e.message; }
  check(!errRt && (await sinRt.query(`select count(*)::int n from fbe_migraciones where numero = 32`)).rows[0].n === 1, 'en un proyecto sin realtime.messages, la 032 se aplica igual (sin «escribiendo…» ni «en línea»)');
  await sinRt.close();

  console.log('  · Buscar en los mensajes (solo el coach)');
  await como(pelayo, 'aal2');
  const enc = await q(`select * from chat_buscar('RODILLA esta')`);
  check(enc.length === 1 && enc[0].id === mC.id, 'el coach busca sin mayúsculas en todas sus conversaciones');
  check((await q(`select * from chat_buscar('que tal')`)).some((x) => x.id === mC.id), 'y sin tildes («que» encuentra «Qué»)');
  check(!(await q(`select * from chat_buscar('eliminó')`)).length && !(await q(`select * from chat_buscar('gracias')`)).some((x) => x.atleta_id === aAna.id && x.autor === 'atleta' && /Mejor/.test(x.texto)),
    'lo eliminado no sale');
  check((await q(`select * from chat_buscar('%%')`)).length === 0 && (await q(`select * from chat_buscar('a')`)).length === 0, '«%» no lo encuentra todo y hacen falta 2 letras');
  await como(ana);
  check((await q(`select * from chat_buscar('rodilla')`)).length === 0, 'un atleta no busca con ella (ni en lo suyo)');
  await su();
  await q(`delete from comentarios where atleta_id = any($1::uuid[]) and creado_en > now() - interval '3 days'`, [[aAna.id, aLuis.id]]);
  await q(`delete from archivos where id = $1`, [vidA.id]);
  await q(`delete from presencia`); await q(`delete from chat_cupos`);
}

console.log('\nLo que encontró la revisión de seguridad de la 032');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const ver = async (ruta) => (await q(`select name from storage.objects where bucket_id = 'archivos' and name = $1`, [ruta])).length === 1;
  await su();
  await q(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await q(`delete from chat_cupos`);
  await q(`insert into storage.buckets (id, name) values ('archivos', 'archivos') on conflict do nothing`);
  await q(`delete from storage.objects where bucket_id = 'archivos'`);
  console.log('  · M1: lo que se quita de archivos deja de verse en Storage, y va a la cola');
  await como(pelayo, 'aal2');
  const [adjC] = await q(`insert into archivos (atleta_id, tipo, ruta, mime) values ($1::uuid, 'adjunto', $1::text || '/rev-coach.jpg', 'image/jpeg') returning *`, [aAna.id]);
  await q(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [adjC.ruta]);
  const [mFC] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Mira tu analítica') returning *`, [adjC.id]);
  await como(ana);
  check(await ver(adjC.ruta), 'Ana ve la foto que le manda el coach (tiene su fila en archivos)');
  await como(pelayo, 'aal2');
  const el = (await q(`select comentario_eliminar($1) r`, [mFC.id]))[0].r;
  await como(ana);
  check(el.rutas[0] === adjC.ruta && !(await ver(adjC.ruta)), 'eliminada para todos y sin limpiar Storage (la app falló): Ana ya no la ve ni la lista (sin fila, no hay permiso)');
  check(!(await q(`select name from storage.objects where name like $1`, [`${aAna.id}/%`])).some((o) => o.name === adjC.ruta), '(tampoco al listar su carpeta)');
  check((await q(`delete from storage.objects where name = $1 returning name`, [adjC.ruta])).length === 0, 'ni la borra ella (sin su fila no es suya: lo hace la app del coach)');
  check(await falla(`select * from storage_pendiente()`) && await falla(`select storage_borrado($1)`, [[adjC.ruta]]), 'la cola no la ve ni la toca un atleta');
  await como(pelayo, 'aal2');
  check(await ver(adjC.ruta) && (await q(`select * from storage_pendiente() r`)).some((x) => x.r === adjC.ruta), 'el coach la ve y la tiene en la cola');
  check((await q(`delete from storage.objects where name = $1 returning name`, [adjC.ruta])).length === 1 && (await q(`select storage_borrado($1) n`, [[adjC.ruta]]))[0].n === 1
    && !(await q(`select * from storage_pendiente() r`)).some((x) => x.r === adjC.ruta), 'y la borra de Storage y la quita de la cola');
  // Todo lo de archivos: fotos de progreso, vídeos y su miniatura, del atleta; el coach, lo de todos
  await su();
  const [vidA] = await q(`insert into archivos (atleta_id, tipo, ruta, poster_ruta, mime) values ($1::uuid, 'video_tecnica', $1::text || '/rev-tecnica.mp4', $1::text || '/rev-tecnica.mp4.jpg', 'video/mp4') returning *`, [aAna.id]);
  const [fotoA] = await q(`insert into archivos (atleta_id, tipo, ruta, mime, pose) values ($1::uuid, 'foto_progreso', $1::text || '/rev-progreso.jpg', 'image/jpeg', 'frente') returning *`, [aAna.id]);
  await q(`insert into storage.objects (bucket_id, name) values ('archivos', $1), ('archivos', $2), ('archivos', $3), ('archivos', $1 || '-huerfano.mp4')`, [vidA.ruta, vidA.poster_ruta, fotoA.ruta]);
  await como(ana);
  check(await ver(vidA.ruta) && await ver(vidA.poster_ruta) && await ver(fotoA.ruta), 'Ana ve sus vídeos, sus miniaturas y sus fotos de progreso');
  check(!(await ver(`${vidA.ruta}-huerfano.mp4`)), 'pero no un archivo de su carpeta que no tiene fila en archivos');
  check((await q(`delete from storage.objects where name = $1 returning name`, [`${vidA.ruta}-huerfano.mp4`])).length === 0, 'ni lo borra');
  await como(luis);
  check(!(await ver(vidA.ruta)) && !(await ver(fotoA.ruta)), 'Luis no ve lo de Ana');
  await como(pelayo, 'aal2');
  check(await ver(vidA.ruta) && await ver(`${vidA.ruta}-huerfano.mp4`), 'el coach ve todo (también lo huérfano, para limpiarlo)');
  // Su vídeo del diario: lo borra de Storage (con su fila) y después la fila; la cola recoge lo que quede
  await como(ana);
  check((await q(`delete from storage.objects where name = any($1::text[]) returning name`, [[vidA.ruta, vidA.poster_ruta]])).length === 2, 'Ana borra de Storage su vídeo y su miniatura (mientras tiene su fila)');
  check((await q(`delete from archivos where id = $1 returning id`, [vidA.id])).length === 1, 'y después su fila');
  await como(pelayo, 'aal2');
  const cola = (await q(`select * from storage_pendiente() r`)).map((x) => x.r);
  check(cola.includes(vidA.ruta) && cola.includes(vidA.poster_ruta), 'lo borrado de archivos (y su miniatura) queda en la cola, por si no llegó a borrarse de Storage');
  await q(`select storage_borrado($1)`, [cola]);
  await su(); await q(`delete from storage.objects where name = $1`, [`${vidA.ruta}-huerfano.mp4`]);
  // Si la miniatura falla al subir, el atleta la quita del vídeo (014): esa ruta deja de ser suya, y va a la cola
  await su();
  const [vidP] = await q(`insert into archivos (atleta_id, tipo, ruta, poster_ruta, mime) values ($1::uuid, 'video_tecnica', $1::text || '/rev-poster.mp4', $1::text || '/rev-poster.mp4.jpg', 'video/mp4') returning *`, [aAna.id]);
  await q(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [vidP.poster_ruta]);
  await como(ana);
  check(await ver(vidP.poster_ruta) && (await q(`update archivos set poster_ruta = null where id = $1 returning id`, [vidP.id])).length === 1, 'Ana quita la miniatura de su vídeo');
  check(!(await ver(vidP.poster_ruta)) && (await q(`delete from storage.objects where name = $1 returning name`, [vidP.poster_ruta])).length === 0, 'y deja de verla (ni la borra)');
  await como(pelayo, 'aal2');
  check((await q(`select * from storage_pendiente() r`)).some((x) => x.r === vidP.poster_ruta), 'pero queda en la cola del coach');
  await q(`select storage_borrado($1)`, [[vidP.poster_ruta]]);
  await su(); await q(`delete from storage.objects where name = $1`, [vidP.poster_ruta]); await q(`delete from archivos where id = $1`, [vidP.id]); await q(`delete from fbe_privado.storage_por_borrar`);

  console.log('  · M2: el atleta no se lleva por delante mensajes del chat borrando archivos');
  await como(pelayo, 'aal2');
  const [adjC2] = await q(`insert into archivos (atleta_id, tipo, ruta, mime) values ($1::uuid, 'adjunto', $1::text || '/rev-coach2.jpg', 'image/jpeg') returning *`, [aAna.id]);
  await q(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [adjC2.ruta]);
  const [mF2] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Foto del coach') returning *`, [adjC2.id]);
  const [mF2r] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Y fíjate en esto') returning *`, [adjC2.id]);
  await su(); await q(`update comentarios set creado_en = now() - interval '30 days' where id = any($1::uuid[])`, [[mF2.id, mF2r.id]]);
  await como(ana);
  check((await q(`delete from archivos where id = $1 returning id`, [adjC2.id])).length === 0 && await n(`select count(*)::int n from comentarios where id = any($1::uuid[])`, [[mF2.id, mF2r.id]]) === 2,
    'Ana no borra la foto del coach (ni, con ella, sus mensajes) desde archivos');
  check((await q(`delete from storage.objects where name = $1 returning name`, [adjC2.ruta])).length === 0, 'ni su archivo de Storage');
  const [adjA] = await q(`insert into archivos (atleta_id, tipo, ruta, mime) values ($1::uuid, 'adjunto', $1::text || '/rev-ana.jpg', 'image/jpeg') returning *`, [aAna.id]);
  const [mFA] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Mi foto') returning *`, [adjA.id]);
  await su(); await q(`update comentarios set creado_en = now() - interval '30 days' where id = $1`, [mFA.id]);
  await como(ana);
  check((await q(`delete from archivos where id = $1 returning id`, [adjA.id])).length === 0 && await n(`select count(*)::int n from comentarios where id = $1`, [mFA.id]) === 1,
    'ni la suya de hace 30 días (se saltaría las 48 horas): eso va por comentario_eliminar');
  // Una foto que le está mandando el coach (su fila y su archivo ya están; su mensaje aún no): Ana no la borra de Storage
  await como(pelayo, 'aal2');
  const [adjC3] = await q(`insert into archivos (atleta_id, tipo, ruta, mime) values ($1::uuid, 'adjunto', $1::text || '/rev-coach3.jpg', 'image/jpeg') returning *`, [aAna.id]);
  await q(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [adjC3.ruta]);
  await como(ana);
  check(await ver(adjC3.ruta) && (await q(`delete from storage.objects where name = $1 returning name`, [adjC3.ruta])).length === 0,
    'una foto del coach aún sin su mensaje: Ana la ve, pero no la borra de Storage (ningún adjunto del chat)');
  await su(); await q(`delete from storage.objects where name = $1`, [adjC3.ruta]); await q(`delete from archivos where id = $1`, [adjC3.id]);
  await como(ana);
  const [adjSin] = await q(`insert into archivos (atleta_id, tipo, ruta, mime) values ($1::uuid, 'adjunto', $1::text || '/rev-sin-mensaje.jpg', 'image/jpeg') returning *`, [aAna.id]);
  await su(); await q(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [adjSin.ruta]);
  await como(ana);
  check((await q(`delete from storage.objects where name = $1 returning name`, [adjSin.ruta])).length === 0
    && (await q(`delete from archivos where id = $1 returning id`, [adjSin.id])).length === 1, 'un adjunto suyo sin mensaje (una subida que no llegó a enviarse) sí lo quita de archivos (su archivo, a la cola)');
  await como(pelayo, 'aal2');
  check((await q(`select * from storage_pendiente() r`)).some((x) => x.r === adjSin.ruta), '(y el coach lo tiene en la cola)');
  await q(`select storage_borrado($1)`, [[adjSin.ruta]]); await su(); await q(`delete from storage.objects where name = $1`, [adjSin.ruta]);
  await como(ana);
  await su();
  const [vidT] = await q(`insert into archivos (atleta_id, tipo, ruta, mime) values ($1::uuid, 'video_tecnica', $1::text || '/rev-diario.mp4', 'video/mp4') returning *`, [aAna.id]);
  await como(pelayo, 'aal2');
  const [cT] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Rodilla hacia dentro') returning id`, [vidT.id]);
  await como(ana);
  check((await q(`delete from archivos where id = $1 returning id`, [vidT.id])).length === 1, 'su vídeo del diario sí lo borra, como siempre');
  await su();
  check((await q(`select archivo_id, eliminado_en from comentarios where id = $1`, [cT.id]))[0]?.archivo_id === null, '(el comentario del coach se queda, sin el vídeo, como antes)');
  // El coach borra un adjunto con mensajes: quedan eliminados, no desaparecen
  await como(pelayo, 'aal2');
  await q(`delete from archivos where id = $1`, [adjC2.id]);
  await su();
  const tras = await q(`select texto, eliminado_en, archivo_id from comentarios where id = any($1::uuid[])`, [[mF2.id, mF2r.id]]);
  check(tras.length === 2 && tras.every((x) => x.eliminado_en && x.texto === 'Se eliminó este mensaje' && x.archivo_id === null), 'si el coach borra un adjunto del chat, sus mensajes quedan como «Se eliminó este mensaje» (no desaparecen)');
  check((await q(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [adjC2.ruta])).length === 1, 'y su archivo, a la cola');
  await q(`delete from fbe_privado.storage_por_borrar`); await q(`delete from storage.objects where bucket_id = 'archivos'`);
  await q(`delete from comentarios where id = any($1::uuid[])`, [[mF2.id, mF2r.id, mFA.id, cT.id]]); await q(`delete from archivos where id = $1`, [adjA.id]); await q(`delete from fbe_privado.storage_por_borrar`);

  console.log('  · Baja, «leído» y cupos');
  await como(pelayo, 'aal2');
  const [mC] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Revisión: hola') returning *`, [aAna.id]);
  await como(ana);
  const [mA] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Revisión: antes de la baja') returning *`, [aAna.id]);
  await su(); await q(`update atletas set estado = 'baja' where id = $1`, [aAna.id]);
  await como(ana);
  check(await falla(`update comentarios set texto = 'editado de baja' where id = $1`, [mA.id]) && await falla(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '👍')`, [mC.id])
    && await falla(`insert into comentario_destacados (comentario_id) values ($1)`, [mC.id]), 'de baja: no edita, ni reacciona, ni destaca');
  check((await q(`update comentarios set leido_en = now() where id = $1 returning id`, [mC.id])).length === 1, '(sí puede marcar leído lo que le llega)');
  await su(); await q(`update atletas set estado = 'activo' where id = $1`, [aAna.id]); await q(`update comentarios set leido_en = null where id = $1`, [mC.id]);
  await como(ana);
  const [l1] = await q(`update comentarios set leido_en = '2001-01-01' where id = $1 returning leido_en`, [mC.id]);
  check(Math.abs(new Date(l1.leido_en) - Date.now()) < 60000, '«leído» lo fecha la base (no la hora que mande el móvil)');
  const [l2] = await q(`update comentarios set leido_en = now() + interval '1 day' where id = $1 returning leido_en`, [mC.id]);
  check(new Date(l2.leido_en).getTime() === new Date(l1.leido_en).getTime() && await falla(`update comentarios set leido_en = null where id = $1`, [mC.id]), 'una vez leído, no cambia ni vuelve a «no leído»');
  const [mC2] = await (async () => { await como(pelayo, 'aal2'); return q(`insert into comentarios (atleta_id, texto) values ($1, 'Revisión: otro') returning *`, [aAna.id]); })();
  await como(ana); await q(`select presencia_marcar(false)`);
  const [l3] = await q(`update comentarios set leido_en = now() where id = $1 returning leido_en`, [mC2.id]);
  const madrid = (await q(`select to_char($1::timestamptz at time zone 'Europe/Madrid', 'HH24:MI:SS') h`, [l3.leido_en]))[0].h;
  check(madrid === '00:00:00', 'sin «Mostrar cuándo estoy en línea», lo leído queda con el día, no con la hora exacta');
  await q(`select presencia_marcar(true)`);
  const [mE] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'cupo') returning id`, [aAna.id]);
  await su();
  check((await q(`select pg_get_functiondef('fbe_privado.chat_gastar_cupo(text)'::regprocedure) d`))[0].d.includes('pg_advisory_xact_lock'), 'el cupo se cuenta de uno en uno (bloqueo por cuenta y tipo)');
  check(!(await q(`select 1 from pg_proc where proname = 'storage_pendiente' and prosecdef and array_to_string(proconfig, ',') <> 'search_path=""'`)).length, 'las funciones nuevas, con search_path vacío');
  await como(ana);
  check(!(await falla(`update comentarios set editado_en = null where id = $1`, [mE.id])) && (await q(`select editado_en from comentarios where id = $1`, [mE.id]))[0].editado_en === null,
    '(dejar «editado» como está no cambia nada: no hay forma de marcar «Editado» sin editar)');
  await su();
  await q(`delete from comentarios where id = any($1::uuid[])`, [[mC.id, mA.id, mC2.id, mE.id]]); await q(`delete from chat_cupos`); await q(`delete from presencia`);
}

console.log('\nEl chat, aún más como WhatsApp: sin duplicados, entregado, PDF, fijar, silenciar, reenviar y difundir (migración 033)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const ver = async (ruta) => (await q(`select name from storage.objects where bucket_id = 'archivos' and name = $1`, [ruta])).length === 1;
  const uuid = () => crypto.randomUUID();
  await su();
  await q(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await q(`delete from chat_cupos`); await q(`delete from presencia`);
  await q(`insert into storage.buckets (id, name) values ('archivos', 'archivos') on conflict do nothing`);
  const cols = (await q(`select table_name || '.' || column_name c from information_schema.columns where table_schema = 'public' and ((table_name = 'comentarios' and column_name in ('cliente_id', 'reenviado', 'entregado_en')) or (table_name = 'archivos' and column_name in ('nombre', 'paginas'))) order by 1`)).map((r) => r.c);
  check(cols.join() === 'archivos.nombre,archivos.paginas,comentarios.cliente_id,comentarios.entregado_en,comentarios.reenviado', 'comentarios trae cliente_id, reenviado y entregado_en; archivos, nombre y paginas');
  check((await q(`select relname from pg_class where relname in ('conversacion_fijado', 'chat_silencios', 'listas_difusion', 'listas_difusion_miembros') and relrowsecurity and relnamespace = 'public'::regnamespace`)).length === 4,
    'las cuatro tablas nuevas nacen con permisos por fila');
  const malos = await q(`select p.oid::regprocedure::text f from pg_proc p where p.prosecdef and p.pronamespace in ('public'::regnamespace, 'fbe_privado'::regnamespace)
    and p.proname in ('marcar_entregados', 'chat_reenviar', 'chat_difundir', 'nombre_coach', 'conversacion_fijado_preparar', 'chat_silencio_preparar', 'notificacion_chat', 'al_silenciar', 'al_eliminar_desfijar', 'chat_copia_valida', 'chat_cupo_coach', 'chat_gastar_cupo', 'comentario_eliminar', 'archivo_borrable', 'archivo_adjunto_borrar_mensaje')
    and coalesce(array_to_string(p.proconfig, ','), '') <> 'search_path=""'`);
  check(!malos.length, `las funciones con permisos de definidor, con search_path vacío${malos.length ? ` (no: ${malos.map((x) => x.f).join(', ')})` : ''}`);
  check((await q(`select 1 from storage.buckets where id = 'archivos' and 'application/pdf' = any(allowed_mime_types) and 'image/jpeg' = any(allowed_mime_types) and 'video/mp4' = any(allowed_mime_types)`)).length === 1,
    'Storage acepta PDF (y lo de antes sigue)');
  await anon();
  check(await falla(`select * from conversacion_fijado`) && await falla(`select * from chat_silencios`) && await falla(`select * from listas_difusion`) && await falla(`select marcar_entregados()`) && await falla(`select chat_reenviar(gen_random_uuid(), '[]')`),
    'sin sesión, nada de lo nuevo');

  console.log('  · Sin duplicados (cliente_id) y «Reenviado» solo con su función');
  await como(ana);
  const cid = uuid();
  const [m1] = await q(`insert into comentarios (atleta_id, texto, cliente_id, reenviado, entregado_en) values ($1, 'Sin cobertura', $2, true, now()) returning *`, [aAna.id, cid]);
  check(m1.cliente_id === cid && m1.reenviado === false && m1.entregado_en === null, 'Ana envía con el id de su móvil; nadie pone «Reenviado» ni «entregado» a mano (la base los limpia)');
  check(await falla(`insert into comentarios (atleta_id, texto, cliente_id) values ($1, 'Sin cobertura', $2)`, [aAna.id, cid]), 'el mismo mensaje otra vez (un reintento) no entra dos veces');
  await como(pelayo, 'aal2');
  const [mc] = await q(`insert into comentarios (atleta_id, texto, cliente_id, reenviado) values ($1, 'Mismo id, otro autor', $2, true) returning *`, [aAna.id, cid]);
  check(!!mc.id && mc.reenviado === false, 'el id es por autor (el coach no choca con el de Ana) y el coach tampoco pone «Reenviado» a mano');
  check(await falla(`update comentarios set reenviado = true where id = $1`, [mc.id]) && await falla(`update comentarios set entregado_en = now() where id = $1`, [m1.id]), '«Reenviado» y «entregado» no se cambian después');
  await como(ana);
  check(await falla(`update comentarios set cliente_id = gen_random_uuid() where id = $1`, [mc.id]) && await falla(`update comentarios set cliente_id = null where id = $1`, [m1.id]),
    'ni el id del móvil (ni el de lo del coach, que Ana puede marcar como leído)');

  console.log('  · Entregado (✓✓ gris)');
  await como(pelayo, 'aal2');
  const [mP] = await q(`insert into comentarios (atleta_id, texto, enviar_en) values ($1, 'Programado 033', now() + interval '2 days') returning id`, [aAna.id]);
  const [mL] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Para Luis 033') returning id`, [aLuis.id]);
  await como(luis);
  await q(`select marcar_entregados()`);
  await su();
  check((await q(`select entregado_en from comentarios where id = $1`, [mc.id]))[0].entregado_en === null && (await q(`select entregado_en from comentarios where id = $1`, [mL.id]))[0].entregado_en !== null,
    'cada uno marca lo suyo: lo de Luis le llega a Luis; lo de Ana no se toca');
  await como(ana);
  const nA = (await q(`select marcar_entregados() n`))[0].n;
  await su();
  const [eC] = await q(`select entregado_en from comentarios where id = $1`, [mc.id]);
  check(nA >= 1 && eC.entregado_en !== null && Math.abs(new Date(eC.entregado_en) - Date.now()) < 60000, 'la app de Ana descarga lo del coach: entregado (la hora, la de la base)');
  check((await q(`select entregado_en from comentarios where id = $1`, [mP.id]))[0].entregado_en === null && (await q(`select entregado_en from comentarios where id = $1`, [m1.id]))[0].entregado_en === null,
    'ni lo programado que aún no ha salido ni lo que escribe ella');
  await como(ana);
  check(!(await q(`select id from comentarios where id = $1`, [mP.id])).length, '(y lo programado sigue sin verse)');
  await como(pelayo, 'aal2');
  await q(`select marcar_entregados()`);
  await su();
  check((await q(`select entregado_en from comentarios where id = $1`, [m1.id]))[0].entregado_en !== null, 'el coach: lo de Ana le llega a él');
  await como(pelayo, 'aal2');
  const [mc2] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Leer lo da por entregado') returning id`, [aAna.id]);
  await como(ana);
  await q(`select presencia_marcar(false)`);
  const [l2] = await q(`update comentarios set leido_en = now() where id = $1 returning leido_en, entregado_en, creado_en`, [mc2.id]);
  check(!!l2.entregado_en && new Date(l2.entregado_en).getTime() === Math.max(new Date(l2.leido_en).getTime(), new Date(l2.creado_en).getTime()),
    'leerlo lo da por entregado (sin «en línea», con el día del «leído», pero nunca antes de escribirse)');
  await como(pelayo, 'aal2');
  const [mc3] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Sin en línea') returning id`, [aAna.id]);
  await como(ana);
  const [{ marcar_entregados: nSin }] = await q(`select marcar_entregados()`);
  await su();
  check(nSin === 0 && (await q(`select entregado_en from comentarios where id = $1`, [mc3.id]))[0].entregado_en === null,
    'sin «Mostrar cuándo estoy en línea», abrir la app no marca nada como entregado (por Realtime diría a qué hora la abre)');
  await como(ana);
  await q(`update comentarios set leido_en = now() where id = $1`, [mc3.id]);
  await su();
  const [e3] = await q(`select entregado_en, creado_en, to_char(leido_en at time zone 'Europe/Madrid', 'HH24:MI:SS') h from comentarios where id = $1`, [mc3.id]);
  check(e3.h === '00:00:00' && new Date(e3.entregado_en).getTime() === new Date(e3.creado_en).getTime(), 'y al leerlo cuenta como entregado sin decir la hora (la del mensaje)');
  await como(ana); await q(`select presencia_marcar(true)`);
  await como(intruso);
  check((await q(`select marcar_entregados() n`))[0].n === 0, 'una cuenta sin atleta no marca nada');

  console.log('  · Documentos PDF');
  await como(ana);
  const rDoc = `${aAna.id}/documento-033.pdf`;
  const pdf = (extra = {}) => ({ atleta_id: aAna.id, tipo: 'documento', ruta: rDoc, mime: 'application/pdf', bytes: 120000, nombre: 'Plan de comidas.pdf', paginas: 3, ...extra });
  const insArch = (f) => q(`insert into archivos (${Object.keys(f).join(',')}) values (${Object.keys(f).map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(f));
  const fallaArch = async (f) => { try { await insArch(f); return false; } catch { return true; } };
  check(await fallaArch(pdf({ mime: 'image/jpeg' })) && await fallaArch(pdf({ bytes: 20971521 })) && await fallaArch(pdf({ bytes: null })) && await fallaArch(pdf({ ruta: `${aAna.id}/documento-033.exe` })),
    'un documento es un PDF de hasta 20 MB con ruta .pdf (otro tipo, más grande, sin tamaño o con otra extensión, no)');
  check(await fallaArch(pdf({ nombre: '../../secreto.pdf' })) && await fallaArch(pdf({ nombre: 'carpeta/plan.pdf' })) && await fallaArch(pdf({ nombre: 'plan\u0007.pdf' })) && await fallaArch(pdf({ nombre: null }))
    && await fallaArch(pdf({ nombre: '   ' })) && await fallaArch(pdf({ ruta: `${aLuis.id}/documento-033.pdf` })) && await fallaArch(pdf({ poster_ruta: `${aAna.id}/x.jpg` })) && await fallaArch(pdf({ paginas: 0 })),
    'su nombre, sin barras, «..», caracteres de control ni en blanco; en su carpeta; sin miniatura; con páginas de verdad');
  check(await fallaArch(pdf({ nombre: 'Plan de comidas' })) && await fallaArch(pdf({ nombre: 'Plan de comidas.exe' })) && await fallaArch(pdf({ nombre: 'informe\u202Efdp.exe' }))
    && await fallaArch(pdf({ nombre: 'plan\u200B.pdf' })) && await fallaArch(pdf({ nombre: '\uFEFFplan.pdf' })) && await fallaArch(pdf({ nombre: 'plan\u0085.pdf' })) && await fallaArch(pdf({ nombre: 'plan"1".pdf' }))
    && await fallaArch(pdf({ nombre: 'a<b>.pdf' })) && await fallaArch(pdf({ nombre: '.oculto.pdf' })) && await fallaArch(pdf({ nombre: 'informe..pdf' })),
    '(revisión) el nombre acaba en .pdf y no lleva invisibles, marcas de dirección del texto (no se disfraza un .exe), comillas ni <>, ni empieza por punto');
  check(!!(await insArch(pdf({ ruta: `${aAna.id}/documento-033-mayus.pdf`, nombre: 'INFORME.PDF' })))[0], '(un .PDF en mayúsculas, sí)');
  const [doc] = await insArch(pdf());
  check(doc.tipo === 'documento' && doc.nombre === 'Plan de comidas.pdf', 'Ana registra su PDF (primero la fila, después Storage)');
  await q(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [rDoc]);
  check(await ver(rDoc), 'y lo sube (y lo ve: tiene su fila)');
  const [mD] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Documento') returning *`, [doc.id]);
  check(mD.adjunto === true && mD.atleta_id === aAna.id, 'su mensaje es un mensaje del chat (como una foto)');
  check(await falla(`update archivos set nombre = 'otro.pdf' where id = $1`, [doc.id]), 'no le cambia el nombre después');
  check((await q(`delete from storage.objects where name = $1 returning name`, [rDoc])).length === 0 && (await q(`delete from archivos where id = $1 returning id`, [doc.id])).length === 0,
    'no lo borra de Storage ni de archivos (lleva su mensaje: eso va por eliminar para todos)');
  await como(luis);
  check(!(await ver(rDoc)) && !(await q(`select id from archivos where id = $1`, [doc.id])).length, 'Luis no ve el PDF de Ana');
  await como(pelayo, 'aal2');
  check(await ver(rDoc), 'el coach, sí');
  await como(ana);
  const elD = (await q(`select comentario_eliminar($1) r`, [mD.id]))[0].r;
  await su();
  check(elD.rutas[0] === rDoc && !(await q(`select 1 from archivos where id = $1`, [doc.id])).length && (await q(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [rDoc])).length === 1,
    'eliminado para todos, el PDF se va de la base (y a la cola de Storage), como una foto');
  await como(ana);
  check(!(await ver(rDoc)), 'y Ana ya no lo ve');
  await su(); await q(`delete from storage.objects where name = $1`, [rDoc]); await q(`delete from fbe_privado.storage_por_borrar`); await q(`delete from archivos where atleta_id = $1 and creado_en > now() - interval '1 day'`, [aAna.id]);
  await como(ana);
  let topeDoc = null;
  for (let i = 0; i < 11 && !topeDoc; i++) { try { await insArch(pdf({ ruta: `${aAna.id}/documento-tope-${i}.pdf` })); } catch (e) { topeDoc = { i, m: e.message }; } }
  check(topeDoc?.i === 10 && /10 documentos/.test(topeDoc.m), 'como mucho 10 documentos al día (el atleta)');
  await su(); await q(`delete from archivos where tipo = 'documento'`);
  // El coach borra un PDF del chat con mensajes: quedan «Se eliminó este mensaje»
  await como(pelayo, 'aal2');
  const [docC] = await insArch(pdf({ ruta: `${aAna.id}/documento-coach.pdf` }));
  const [mDC] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Tu plan') returning id`, [docC.id]);
  await q(`delete from archivos where id = $1`, [docC.id]);
  await su();
  check((await q(`select eliminado_en from comentarios where id = $1`, [mDC.id]))[0].eliminado_en !== null, 'si el coach borra un PDF con mensajes, quedan como eliminados (no desaparecen)');
  await q(`delete from fbe_privado.storage_por_borrar`);

  console.log('  · Fijar un mensaje (solo el coach)');
  await como(pelayo, 'aal2');
  const [aFij] = await q(`insert into conversacion_fijado (atleta_id, comentario_id, hasta, fijado_en) values ($1, $2, now() + interval '7 days', '2020-01-01') returning *`, [aAna.id, mc.id]);
  check(aFij.comentario_id === mc.id && Math.abs(new Date(aFij.fijado_en) - Date.now()) < 60000, 'el coach fija un mensaje de la conversación de Ana (la hora la pone la base)');
  check(await falla(`insert into conversacion_fijado (atleta_id, comentario_id) values ($1, $2)`, [aAna.id, m1.id]), 'uno por conversación (fijar otro lo sustituye, no se suma)');
  await q(`insert into conversacion_fijado (atleta_id, comentario_id, hasta) values ($1, $2, now() + interval '24 hours') on conflict (atleta_id) do update set comentario_id = excluded.comentario_id, hasta = excluded.hasta`, [aAna.id, m1.id]);
  check((await q(`select comentario_id from conversacion_fijado where atleta_id = $1`, [aAna.id]))[0].comentario_id === m1.id, 'fijar otro sustituye al anterior');
  check(await falla(`insert into conversacion_fijado (atleta_id, comentario_id) values ($1, $2)`, [aLuis.id, mc.id]), 'no se fija en la conversación de Luis un mensaje de la de Ana');
  check(await falla(`update conversacion_fijado set comentario_id = $2 where atleta_id = $1`, [aAna.id, mP.id]), 'ni uno programado que aún no ha salido (no lo destapa)');
  check(await falla(`update conversacion_fijado set hasta = now() + interval '40 days' where atleta_id = $1`, [aAna.id]) && await falla(`update conversacion_fijado set hasta = now() + interval '5 minutes' where atleta_id = $1`, [aAna.id]),
    'de 1 hora a 30 días (24 h, 7 días o 30 días, como WhatsApp)');
  check(await falla(`update conversacion_fijado set atleta_id = $2 where atleta_id = $1`, [aAna.id, aLuis.id]), 'no se pasa a otra conversación');
  await como(ana);
  check((await q(`select comentario_id from conversacion_fijado`)).map((x) => x.comentario_id).join() === m1.id, 'Ana ve lo fijado en su conversación');
  check(await falla(`insert into conversacion_fijado (atleta_id, comentario_id) values ($1, $2)`, [aAna.id, mc.id]) && (await q(`update conversacion_fijado set hasta = null returning 1`)).length === 0
    && (await q(`delete from conversacion_fijado returning 1`)).length === 0, 'pero no fija, ni cambia, ni desfija');
  await como(luis);
  check(await n(`select count(*)::int n from conversacion_fijado`) === 0, 'Luis no ve lo fijado de Ana');
  await su(); await q(`update conversacion_fijado set hasta = now() - interval '1 minute' where atleta_id = $1`, [aAna.id]);
  await como(ana);
  check(await n(`select count(*)::int n from conversacion_fijado`) === 0, 'caducado, Ana deja de verlo');
  await como(pelayo, 'aal2');
  await q(`update conversacion_fijado set hasta = now() + interval '7 days' where atleta_id = $1`, [aAna.id]);
  await como(ana);
  await q(`select comentario_eliminar($1)`, [m1.id]);
  await su();
  check(await n(`select count(*)::int n from conversacion_fijado where atleta_id = $1`, [aAna.id]) === 0, 'eliminado para todos, se desfija solo');
  await como(pelayo, 'aal2');
  check(await falla(`insert into conversacion_fijado (atleta_id, comentario_id) values ($1, $2)`, [aAna.id, m1.id]), 'y uno eliminado no se fija');

  console.log('  · Silenciar (cada uno lo suyo) y las notificaciones');
  await su(); await q(`delete from notificaciones where tipo in ('respuesta', 'mensaje')`); await q(`delete from chat_cupos`);
  await como(ana);
  const [sA] = await q(`insert into chat_silencios (usuario_id, atleta_id, hasta) values ($1, $2, now() + interval '8 hours') returning *`, [pelayo, aAna.id]);
  check(sA.usuario_id === ana, 'Ana silencia su conversación (a su nombre, aunque mande otro)');
  check(await falla(`insert into chat_silencios (atleta_id) values ($1)`, [aLuis.id]), 'no silencia la de Luis');
  check(await falla(`update chat_silencios set hasta = now() + interval '9 days'`) && await falla(`update chat_silencios set hasta = now() - interval '1 hour'`), '8 horas, 1 semana o siempre (ni más de 8 días ni ya pasado)');
  await como(pelayo, 'aal2');
  check(await n(`select count(*)::int n from chat_silencios`) === 0, 'el coach no ve lo que silencia Ana');
  await q(`insert into comentarios (atleta_id, texto) values ($1, 'Silenciado 033')`, [aAna.id]);
  check(!(await notis(`usuario_id = $1 and tipo = 'respuesta'`, [ana])).length, 'con su chat silenciado, a Ana no le llega notificación de lo nuevo');
  await como(pelayo, 'aal2');
  const [prog9] = await q(`insert into comentarios (atleta_id, texto, enviar_en) values ($1, 'Para dentro de dos días', now() + interval '2 days') returning id`, [aAna.id]);
  check((await notis(`clave = $1`, ['comentario:' + prog9.id])).length === 1, 'uno programado para cuando ya no está silenciada sí deja su notificación');
  await como(ana);
  await q(`update chat_silencios set hasta = null where atleta_id = $1`, [aAna.id]);
  check(!(await notis(`clave = $1`, ['comentario:' + prog9.id])).length, 'silenciada «siempre», las pendientes de esa conversación se quitan');
  await q(`delete from chat_silencios where atleta_id = $1`, [aAna.id]);
  await como(pelayo, 'aal2');
  const [mOk] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Ya no silenciado') returning id`, [aAna.id]);
  const nOk = await notis(`clave = $1`, ['comentario:' + mOk.id]);
  check(nOk.length === 1 && nOk[0].url === '#mensajes' && !/silenciado/i.test(`${nOk[0].titulo} ${nOk[0].cuerpo}`), 'al volver a activarlas, sí (sin el texto del mensaje, como siempre)');
  await como(pelayo, 'aal2');
  await q(`insert into chat_silencios (atleta_id, hasta) values ($1, now() + interval '7 days')`, [aAna.id]);
  await como(ana);
  check(await n(`select count(*)::int n from chat_silencios`) === 0, 'Ana no ve que el coach la ha silenciado');
  await q(`insert into comentarios (atleta_id, texto) values ($1, 'Pelayo, ¿me oyes?')`, [aAna.id]);
  await como(luis);
  await q(`insert into comentarios (atleta_id, texto) values ($1, 'Pelayo, duda de Luis')`, [aLuis.id]);
  const aCoach = await notis(`usuario_id = $1 and tipo = 'mensaje'`, [pelayo]);
  check(!aCoach.some((x) => x.clave.startsWith(`mensaje:${aAna.id}:`)) && aCoach.some((x) => x.clave.startsWith(`mensaje:${aLuis.id}:`)), 'el coach, con Ana silenciada: lo de Ana no suena; lo de Luis, sí');
  check(aCoach.find((x) => x.clave.startsWith(`mensaje:${aLuis.id}:`))?.url === `#mensajes/${aLuis.id}`, 'y su notificación lleva a esa conversación (#mensajes/<atleta>)');
  await como(pelayo, 'aal2');
  const sinLeerCoach = await n(`select count(*)::int n from comentarios where autor = 'atleta' and atleta_id = $1 and leido_en is null`, [aAna.id]);
  check(sinLeerCoach >= 1, 'silenciada, lo de Ana sigue contando como sin leer');
  // (revisión) Silenciar es el chat: un comentario en un vídeo (o una sesión, o un check-in) sigue avisando
  await su();
  const [vidS] = await q(`insert into archivos (atleta_id, tipo, ruta, mime, subido_por) values ($1::uuid, 'video_tecnica', $1::text || '/silencio-tecnica.mp4', 'video/mp4', 'atleta') returning id`, [aAna.id]);
  await q(`delete from notificaciones where usuario_id = $1 and clave like $2`, [pelayo, `mensaje:${aAna.id}:%`]);
  await como(ana);
  await q(`insert into comentarios (archivo_id, texto) values ($1, 'Mira mi sentadilla')`, [vidS.id]);
  const aCoachVid = (await notis(`usuario_id = $1 and tipo = 'mensaje'`, [pelayo])).filter((x) => x.clave.startsWith(`mensaje:${aAna.id}:`));
  check(aCoachVid.length === 1 && aCoachVid[0].url === '#revisar', '(revisión) con Ana silenciada, su comentario en un vídeo sí le avisa al coach (va a Revisar, no al chat)');
  await como(ana);
  await q(`insert into chat_silencios (atleta_id, hasta) values ($1, null) on conflict (usuario_id, atleta_id) do update set hasta = excluded.hasta`, [aAna.id]);
  await como(pelayo, 'aal2');
  const [rVidS] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Buena profundidad') returning id`, [vidS.id]);
  const nVidS = await notis(`clave = $1`, ['comentario:' + rVidS.id]);
  check(nVidS.length === 1 && nVidS[0].url === `#videos/${vidS.id}`, '(revisión) y con su chat silenciado, a Ana le llega la respuesta del coach en su vídeo');
  await como(ana);
  await q(`delete from chat_silencios where atleta_id = $1`, [aAna.id]);
  await su(); await q(`delete from comentarios where archivo_id = $1`, [vidS.id]); await q(`delete from archivos where id = $1`, [vidS.id]);
  // (revisión) Silenciar con «insert … on conflict do update» (como la app) gasta una vez, no dos
  await q(`delete from chat_silencios`); await q(`delete from chat_cupos`);
  await como(ana);
  let topeU = null;
  for (let i = 0; i < 40 && !topeU; i++) {
    try { await q(`insert into chat_silencios (atleta_id, hasta) values ($1, now() + interval '8 hours') on conflict (usuario_id, atleta_id) do update set hasta = excluded.hasta`, [aAna.id]); }
    catch (e) { topeU = { i, m: e.message }; }
  }
  check(topeU?.i === 30 && /silenciado/.test(topeU.m), `(revisión) cambiar el silencio (insert … on conflict) cuenta una vez: 30 por hora (${JSON.stringify(topeU)})`);
  await su(); await q(`delete from chat_silencios`); await q(`delete from chat_cupos`);
  await como(ana);
  await q(`insert into chat_silencios (atleta_id, hasta) values ($1, now() + interval '8 hours')`, [aAna.id]);
  await q(`update chat_silencios set hasta = now() + interval '7 days' where atleta_id = $1`, [aAna.id]);
  await su();
  check(await n(`select count(*)::int n from chat_cupos where tipo = 'silenciar'`) === 2, '(revisión) y un insert y luego un update, dos (cada cambio cuenta una vez)');
  await q(`delete from chat_silencios`); await q(`delete from chat_cupos`);
  await como(pelayo, 'aal2');
  await su(); await q(`delete from chat_silencios`); await q(`delete from chat_cupos`);
  await como(ana);
  let topeS = null;
  for (let i = 0; i < 70 && !topeS; i++) {
    try { await q(i % 2 ? `delete from chat_silencios` : `insert into chat_silencios (atleta_id, hasta) values ($1, now() + interval '8 hours')`, [...(i % 2 ? [] : [aAna.id])]); }
    catch (e) { topeS = { i, m: e.message }; }
  }
  check(topeS?.i === 60 && /silenciado/.test(topeS.m), 'como mucho 30 silencios por hora (el atleta)');
  await su(); await q(`delete from chat_silencios`); await q(`delete from chat_cupos`);
  check(await falla(`insert into notificaciones (usuario_id, tipo, titulo, url, clave, caduca_en) values ($1, 'mensaje', 'x', '#mensajes/no-es-uuid', 'x-033', now() + interval '1 day')`, [pelayo]), 'una notificación solo lleva a una conversación con su id de verdad');

  console.log('  · Listas de difusión y difundir (solo el coach)');
  await su();
  const [aX] = await q(`insert into atletas (nombre, estado) values ('Xenia 033', 'baja') returning id`);
  await como(pelayo, 'aal2');
  const [lista] = await q(`insert into listas_difusion (nombre) values ('  Compiten  ') returning *`);
  check(lista.nombre === 'Compiten', 'el coach crea una lista («Compiten»)');
  check(await falla(`insert into listas_difusion (nombre) values ('compiten')`) && await falla(`insert into listas_difusion (nombre) values ('   ')`), 'sin repetir nombre ni en blanco');
  await q(`insert into listas_difusion_miembros (lista_id, atleta_id) values ($1, $2), ($1, $3), ($1, $4)`, [lista.id, aAna.id, aLuis.id, aX.id]);
  await como(ana);
  check(await n(`select count(*)::int n from listas_difusion`) === 0 && await n(`select count(*)::int n from listas_difusion_miembros`) === 0, 'Ana no ve las listas ni quién está en ellas');
  check(await falla(`insert into listas_difusion (nombre) values ('Mía')`) && await falla(`insert into listas_difusion_miembros (lista_id, atleta_id) values ($1, $2)`, [lista.id, aAna.id])
    && (await q(`delete from listas_difusion_miembros returning 1`)).length === 0, 'ni crea, ni se apunta, ni quita a nadie');
  check(await falla(`select chat_difundir($1, 'Hola a todos')`, [lista.id]), 'ni difunde');
  await como(pelayo, 'aal2');
  const cDif = uuid();
  const r1 = (await q(`select chat_difundir($1, 'Mañana, test de 1RM', null, null, $2) r`, [lista.id, cDif]))[0].r;
  check(r1.enviados === 2 && r1.saltados === 1, 'difundir: un mensaje a cada uno (Ana y Luis); Xenia, de baja, se salta y se dice');
  const r2 = (await q(`select chat_difundir($1, 'Mañana, test de 1RM', null, null, $2) r`, [lista.id, cDif]))[0].r;
  check(r2.enviados === 0, 'repetirlo con el mismo id (un reintento) no lo manda dos veces');
  await como(ana);
  const deDif = await q(`select * from comentarios where texto = 'Mañana, test de 1RM'`);
  check(deDif.length === 1 && deDif[0].atleta_id === aAna.id && deDif[0].autor === 'coach' && !deDif[0].reenviado, 'a Ana le llega en su chat, como un mensaje normal (sin saber de la lista)');
  await como(pelayo, 'aal2');
  const r3 = (await q(`select chat_difundir($1, 'Recordatorio programado', now() + interval '1 day') r`, [lista.id]))[0].r;
  check(r3.enviados === 2, 'también programada');
  await como(ana);
  check(!(await q(`select 1 from comentarios where texto = 'Recordatorio programado'`)).length, 'y, programada, Ana no la ve hasta su hora');
  await como(pelayo, 'aal2');
  check(await falla(`select chat_difundir($1, '   ')`, [lista.id]) && await falla(`select chat_difundir(gen_random_uuid(), 'x')`), 'sin texto (ni archivo) o sin lista, no');
  await su(); await q(`delete from chat_cupos`);
  await como(pelayo, 'aal2');
  let topeD = null;
  for (let i = 0; i < 31 && !topeD; i++) { try { await q(`select chat_difundir($1, $2)`, [lista.id, `d${i}`]); } catch (e) { topeD = { i, m: e.message }; } }
  check(topeD?.i === 30 && /difusiones/.test(topeD.m), 'como mucho 30 difusiones por hora (también el coach)');
  await su(); await q(`delete from chat_cupos`); await q(`delete from comentarios where texto ~ '^d[0-9]+$'`);

  console.log('  · Reenviar (solo el coach, solo lo suyo; con archivo, una copia para cada uno)');
  await como(pelayo, 'aal2');
  const [txt] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Mira esta guía') returning id`, [aAna.id]);
  const cFw = uuid();
  const rr = (await q(`select chat_reenviar($1, $2) r`, [txt.id, JSON.stringify([{ atleta: aLuis.id, cliente: cFw }])]))[0].r;
  check(rr.length === 1 && rr[0].atleta_id === aLuis.id, 'el coach reenvía a Luis un mensaje suyo del chat de Ana');
  await como(luis);
  const fw = await q(`select * from comentarios where id = $1`, [rr[0].id]);
  check(fw.length === 1 && fw[0].reenviado === true && fw[0].autor === 'coach' && fw[0].texto === 'Mira esta guía', 'a Luis le llega en su chat, con «↪ Reenviado»');
  check(!(await q(`select 1 from comentarios where id = $1`, [txt.id])).length, '(el original del chat de Ana, Luis no lo ve)');
  check(await falla(`select chat_reenviar($1, $2)`, [fw[0].id, JSON.stringify([{ atleta: aLuis.id }])]), 'Luis no reenvía nada');
  await como(ana);
  const [deAna] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Mi rodilla, muy mal') returning id`, [aAna.id]);
  check(await falla(`select chat_reenviar($1, $2)`, [deAna.id, JSON.stringify([{ atleta: aLuis.id }])]), 'ni Ana');
  await como(pelayo, 'aal2');
  check(await falla(`select chat_reenviar($1, $2)`, [deAna.id, JSON.stringify([{ atleta: aLuis.id }])]), 'el coach no reenvía lo de un atleta (datos de salud de otra persona)');
  check(await falla(`select chat_reenviar($1, $2)`, [mP.id, JSON.stringify([{ atleta: aLuis.id }])]), 'ni uno suyo programado que aún no ha salido');
  check(await falla(`select chat_reenviar($1, $2)`, [txt.id, JSON.stringify([{ atleta: aX.id }])]), 'ni a alguien de baja');
  check(await falla(`select chat_reenviar($1, $2)`, [txt.id, JSON.stringify([{ atleta: aLuis.id }, { atleta: aLuis.id }])]) && await falla(`select chat_reenviar($1, '[]')`, [txt.id]), 'a cada uno una vez, y a alguien');
  check((await q(`select chat_reenviar($1, $2) r`, [txt.id, JSON.stringify([{ atleta: aLuis.id, cliente: cFw }])]))[0].r.length === 0, 'repetido con el mismo id, no se duplica');
  // Con foto: la copia en la carpeta de Luis, con su fila (la de Ana sigue sin poder verla)
  const rF = `${aAna.id}/adjunto-033.jpg`, rCopia = `${aLuis.id}/adjunto-033-copia.jpg`;
  const [fA] = await insArch({ atleta_id: aAna.id, tipo: 'adjunto', ruta: rF, mime: 'image/jpeg', bytes: 1000 });
  await q(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [rF]);
  const [mF] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Así se hace') returning id`, [fA.id]);
  check(await falla(`select chat_reenviar($1, $2)`, [mF.id, JSON.stringify([{ atleta: aLuis.id }])]), 'con foto, sin copia para Luis no se reenvía');
  check(await falla(`select chat_reenviar($1, $2)`, [mF.id, JSON.stringify([{ atleta: aLuis.id, archivo: fA.id }])]), 'ni con la de Ana (no es de Luis)');
  const [fL] = await insArch({ atleta_id: aLuis.id, tipo: 'adjunto', ruta: rCopia, mime: 'image/jpeg', bytes: 1000 });
  await q(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [rCopia]);
  const rrF = (await q(`select chat_reenviar($1, $2) r`, [mF.id, JSON.stringify([{ atleta: aLuis.id, archivo: fL.id }])]))[0].r;
  check(rrF.length === 1, 'con la copia registrada en la carpeta de Luis, sí');
  check(await falla(`select chat_reenviar($1, $2)`, [mF.id, JSON.stringify([{ atleta: aLuis.id, archivo: fL.id }])]), 'y esa copia vale una sola vez');
  await como(luis);
  check(await ver(rCopia) && !(await ver(rF)), 'Luis ve su copia; la foto de la carpeta de Ana, no');
  const [fwF] = await q(`select * from comentarios where id = $1`, [rrF[0].id]);
  check(fwF.archivo_id === fL.id && fwF.adjunto && fwF.reenviado, 'su mensaje lleva su copia, como foto del chat y «Reenviado»');
  check((await q(`delete from storage.objects where name = $1 returning name`, [rCopia])).length === 0, 'y no la borra de Storage (es un adjunto del chat)');
  await como(ana);
  check(!(await ver(rCopia)), 'Ana no ve la copia de Luis');
  // (revisión) Lo que sube un atleta no lo pone el coach en un mensaje suyo, ni lo reenvía (la base sabe quién lo subió)
  const rSalud = `${aAna.id}/adjunto-033-analitica.jpg`;
  const [fSalud] = await insArch({ atleta_id: aAna.id, tipo: 'adjunto', ruta: rSalud, mime: 'image/jpeg', bytes: 2000 });
  await q(`insert into comentarios (archivo_id, texto) values ($1, 'Mi analítica') returning id`, [fSalud.id]);
  check(fSalud.subido_por === 'atleta', '(revisión) la foto que sube Ana queda como suya (subido_por, lo pone la base)');
  check(await falla(`update archivos set subido_por = 'coach' where id = $1`, [fSalud.id]), '(revisión) Ana no cambia quién la subió');
  await como(pelayo, 'aal2');
  check(await falla(`insert into comentarios (archivo_id, texto) values ($1, 'Mira esto')`, [fSalud.id]), '(revisión) el coach no pone la foto de Ana en un mensaje suyo');
  check(await falla(`update archivos set subido_por = 'coach' where id = $1`, [fSalud.id]), '(revisión) ni cambia quién la subió (tampoco el coach)');
  check(await falla(`insert into archivos (atleta_id, tipo, ruta, mime, bytes) values ($1, 'adjunto', $2, 'image/jpeg', 2000)`, [aLuis.id, rSalud]), '(revisión) ni registra a su nombre la ruta de la foto de Ana (la ruta es de su carpeta y única)');
  // Un mensaje del coach con la foto de Ana de antes de la 033 (o metido a mano): tampoco se reenvía
  await db.exec(`reset role; ${claims(pelayo, 'aal2')}`); // sin la cuenta de la app (como una fila de antes de la 033)
  const [mLegado] = await q(`insert into comentarios (atleta_id, autor, archivo_id, texto) values ($1, 'coach', $2, 'De antes') returning id`, [aAna.id, fSalud.id]);
  await como(pelayo, 'aal2');
  const [fL2] = await insArch({ atleta_id: aLuis.id, tipo: 'adjunto', ruta: `${aLuis.id}/adjunto-033-copia2.jpg`, mime: 'image/jpeg', bytes: 2000 });
  check(fL2.subido_por === 'coach', '(la copia la registra el coach)');
  check(await falla(`select chat_reenviar($1, $2)`, [mLegado.id, JSON.stringify([{ atleta: aLuis.id, archivo: fL2.id }])]),
    '(revisión) un mensaje del coach con una foto que subió un atleta no se reenvía (ni con su copia): nunca la salud de Ana en el chat de Luis');
  // Y la copia tiene que ser del coach: una que suba Luis no vale
  await como(luis);
  const [fDeLuis] = await insArch({ atleta_id: aLuis.id, tipo: 'adjunto', ruta: `${aLuis.id}/adjunto-033-luis.jpg`, mime: 'image/jpeg', bytes: 1000 });
  await como(pelayo, 'aal2');
  check(await falla(`select chat_reenviar($1, $2)`, [mF.id, JSON.stringify([{ atleta: aLuis.id, archivo: fDeLuis.id }])]), '(revisión) la copia, del coach (no vale un archivo que subió Luis)');
  // Difundir con foto: cada uno con su copia
  await como(pelayo, 'aal2');
  const [cA] = await insArch({ atleta_id: aAna.id, tipo: 'adjunto', ruta: `${aAna.id}/dif-033.jpg`, mime: 'image/jpeg', bytes: 500 });
  const [cL] = await insArch({ atleta_id: aLuis.id, tipo: 'adjunto', ruta: `${aLuis.id}/dif-033.jpg`, mime: 'image/jpeg', bytes: 500 });
  check(await falla(`select chat_difundir($1, '', null, $2)`, [lista.id, JSON.stringify([{ atleta: aAna.id, archivo: cA.id }])]), 'difundir con foto: falta la copia de Luis, no sale a nadie (todos o ninguno)');
  check(!(await q(`select 1 from comentarios where archivo_id = $1`, [cA.id])).length, '(ni a Ana)');
  check(await falla(`select chat_difundir($1, 'x', now() + interval '1 day', $2)`, [lista.id, JSON.stringify([{ atleta: aAna.id, archivo: cA.id }, { atleta: aLuis.id, archivo: cL.id }])]), 'con foto, no se programa');
  const rDF = (await q(`select chat_difundir($1, '', null, $2) r`, [lista.id, JSON.stringify([{ atleta: aAna.id, archivo: cA.id }, { atleta: aLuis.id, archivo: cL.id }])]))[0].r;
  await su();
  const msgsDF = await q(`select atleta_id, archivo_id, texto from comentarios where id = any($1::uuid[])`, [rDF.ids]);
  check(rDF.enviados === 2 && msgsDF.every((x) => (x.atleta_id === aAna.id ? x.archivo_id === cA.id : x.archivo_id === cL.id) && x.texto === 'Foto'), 'con las dos copias, a cada uno la suya (sin pie: «Foto»)');
  await su(); await q(`delete from chat_cupos`);
  await q(`delete from comentarios where atleta_id = any($1::uuid[]) and creado_en > now() - interval '3 days'`, [[aAna.id, aLuis.id]]);
  await q(`delete from storage.objects where bucket_id = 'archivos'`); await q(`delete from archivos where atleta_id = any($1::uuid[]) and creado_en > now() - interval '1 day' and tipo = 'adjunto'`, [[aAna.id, aLuis.id]]);
  await q(`delete from fbe_privado.storage_por_borrar`); await q(`delete from listas_difusion`); await q(`delete from atletas where id = $1`, [aX.id]);
  await q(`delete from notificaciones where tipo in ('respuesta', 'mensaje')`); await q(`delete from presencia`);
  // (revisión) Lo de antes de la 033: lo ya leído cuenta como entregado (cuando se leyó, nunca antes de escribirse) y una
  // foto del chat queda como de quien escribió su mensaje. Repetir la 033 lo pone (y no cambia lo demás).
  await su();
  const [viejoL] = await q(`insert into comentarios (atleta_id, autor, texto) values ($1, 'coach', 'Leído antes de la 033') returning id, creado_en`, [aAna.id]);
  await q(`update comentarios set leido_en = creado_en - interval '3 hours', entregado_en = null where id = $1`, [viejoL.id]);
  const [viejoL2] = await q(`insert into comentarios (atleta_id, autor, texto) values ($1, 'coach', 'Leído más tarde') returning id, creado_en`, [aAna.id]);
  await q(`update comentarios set leido_en = creado_en + interval '2 hours', entregado_en = null where id = $1`, [viejoL2.id]);
  const [fViejo] = await q(`insert into archivos (atleta_id, tipo, ruta, mime) values ($1::uuid, 'adjunto', $1::text || '/viejo-033.jpg', 'image/jpeg') returning id, subido_por`, [aAna.id]);
  await db.exec(`reset role; ${claims(ana, 'aal1')}`);
  await q(`insert into comentarios (archivo_id, autor, texto) values ($1, 'atleta', 'Foto de antes')`, [fViejo.id]);
  await su();
  // (como dice su aviso: las siguientes, detrás, en la misma consulta)
  await db.exec(`delete from fbe_migraciones where numero > 33;\n${readFileSync(new URL('../supabase/migraciones/033_chat_mas_whatsapp.sql', import.meta.url), 'utf8')}\n`
    + migraciones().filter((x) => x > '033').map((m) => readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8')).join('\n'));
  const [eV] = await q(`select entregado_en, creado_en from comentarios where id = $1`, [viejoL.id]);
  const [eV2] = await q(`select entregado_en, leido_en from comentarios where id = $1`, [viejoL2.id]);
  check(fViejo.subido_por === null && new Date(eV.entregado_en).getTime() === new Date(eV.creado_en).getTime() && new Date(eV2.entregado_en).getTime() === new Date(eV2.leido_en).getTime(),
    '(revisión) al aplicar la 033, lo ya leído queda entregado (al leerlo, y nunca antes de escribirse)');
  check((await q(`select subido_por from archivos where id = $1`, [fViejo.id]))[0].subido_por === 'atleta', '(revisión) y una foto del chat de antes, de quien la mandó');
  await q(`delete from comentarios where id in ($1, $2) or archivo_id = $3`, [viejoL.id, viejoL2.id, fViejo.id]); await q(`delete from archivos where id = $1`, [fViejo.id]);
  await q(`delete from fbe_privado.storage_por_borrar`); await q(`delete from notificaciones where tipo in ('respuesta', 'mensaje')`);
  // El nombre del coach para «Info del contacto» del atleta (el corto, como en sus notificaciones)
  await como(ana);
  const nc = (await q(`select nombre_coach() n`))[0].n;
  await como(intruso);
  check(typeof nc === 'string' && nc.length > 0 && !nc.includes(' ') && (await q(`select nombre_coach() n`))[0].n === null, 'el atleta ve el nombre corto de su coach; una cuenta sin atleta, no');
}

console.log('\nNotas de voz, encuestas, «escuchado» y reacciones a elegir (migración 034)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const uuid = () => crypto.randomUUID();
  const insArch = (f) => q(`insert into archivos (${Object.keys(f).join(',')}) values (${Object.keys(f).map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(f));
  const fallaArch = async (f) => { try { await insArch(f); return false; } catch { return true; } };
  await su();
  await q(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await q(`delete from chat_cupos`); await q(`delete from presencia`); await q(`delete from fbe_privado.storage_por_borrar`);
  const cols = (await q(`select table_name || '.' || column_name c from information_schema.columns where table_schema = 'public' and ((table_name = 'comentarios' and column_name = 'escuchado_en') or (table_name = 'archivos' and column_name = 'onda')) order by 1`)).map((x) => x.c);
  check(cols.join() === 'archivos.onda,comentarios.escuchado_en', 'comentarios trae escuchado_en; archivos, onda');
  check((await q(`select relname from pg_class where relname in ('encuestas_chat', 'encuesta_votos') and relrowsecurity and relnamespace = 'public'::regnamespace`)).length === 2, 'las dos tablas nuevas nacen con permisos por fila');
  const malos = await q(`select p.oid::regprocedure::text f from pg_proc p where p.pronamespace in ('public'::regnamespace, 'fbe_privado'::regnamespace)
    and p.proname in ('marcar_escuchado', 'chat_encuesta', 'encuesta_votar', 'al_eliminar_encuesta', 'encuesta_preparar', 'comentario_preparar', 'archivo_proteger', 'archivo_proteger_cambios', 'archivo_borrable',
                      'archivo_adjunto_borrar_mensaje', 'comentario_eliminar', 'chat_buscar', 'chat_copia_valida', 'chat_difundir', 'chat_gastar_cupo', 'chat_cupo_coach')
    and coalesce(array_to_string(p.proconfig, ','), '') <> 'search_path=""'`);
  check(!malos.length, `las funciones nuevas y las que cambia la 034, con search_path vacío${malos.length ? ` (no: ${malos.map((x) => x.f).join(', ')})` : ''}`);
  // (revisión) Las notas de voz van a su propio bucket privado («voz»: 3 MB y solo audio); en «archivos», ya no hay audio
  const tiposB = (await q(`select allowed_mime_types t from storage.buckets where id = 'archivos'`))[0]?.t || [];
  const [bVoz] = await q(`select public, file_size_limit, allowed_mime_types t from storage.buckets where id = 'voz'`);
  const AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'];
  check(bVoz && bVoz.public === false && Number(bVoz.file_size_limit) === 3145728 && bVoz.t.slice().sort().join() === AUDIO.slice().sort().join(),
    '(revisión) las notas de voz, en su bucket privado «voz»: 3 MB por archivo y solo esos audios');
  check(!AUDIO.some((t) => tiposB.includes(t)) && ['application/pdf', 'image/jpeg', 'video/mp4'].every((t) => tiposB.includes(t)) && new Set(tiposB).size === tiposB.length,
    '(revisión) y en «archivos» ya no se admite audio (lo de antes sigue, sin repetir)');
  check((await q(`select grantee, privilege_type from information_schema.role_table_grants where table_name in ('encuestas_chat', 'encuesta_votos') and grantee in ('authenticated', 'anon') and privilege_type <> 'SELECT'`)).length === 0
    && (await q(`select 1 from information_schema.role_table_grants where table_name in ('encuestas_chat', 'encuesta_votos') and grantee = 'anon'`)).length === 0,
    'de las encuestas y los votos, la app solo lee (se crean y se votan con sus funciones); sin sesión, nada');
  await anon();
  check(await falla(`select * from encuestas_chat`) && await falla(`select * from encuesta_votos`) && await falla(`select marcar_escuchado($1)`, [uuid()]) && await falla(`select encuesta_votar($1, '{0}')`, [uuid()]), 'sin sesión, nada de lo nuevo');

  console.log('  · Notas de voz');
  await como(ana);
  const hoy = new Date().toISOString().slice(0, 10);
  const onda = Array.from({ length: 32 }, (_, i) => (i * 7) % 101);
  const voz = (extra = {}) => ({ atleta_id: aAna.id, tipo: 'audio', ruta: `${aAna.id}/audio-${hoy}-${uuid().slice(0, 8)}.webm`, mime: 'audio/webm', bytes: 30000, duracion_seg: 12, onda: `{${onda.join(',')}}`, ...extra });
  const [vA] = await insArch(voz());
  check(vA.tipo === 'audio' && vA.subido_por === 'atleta' && vA.onda.length === 32, 'Ana registra una nota de voz (a su nombre, con su onda)');
  check(await fallaArch(voz({ duracion_seg: 0 })) && await fallaArch(voz({ duracion_seg: 62 })) && await fallaArch(voz({ duracion_seg: null })) && await fallaArch(voz({ bytes: 3145729 })) && await fallaArch(voz({ bytes: null })),
    'de 1 a 61 segundos (el minuto y un margen) y hasta 3 MB');
  check(await fallaArch(voz({ mime: 'audio/wav' })) && await fallaArch(voz({ mime: 'video/webm' })) && await fallaArch(voz({ ruta: `${aAna.id}/audio-${hoy}-x.exe` })) && await fallaArch(voz({ ruta: `${aAna.id}/adjunto-${hoy}-x.webm` }))
    && await fallaArch(voz({ ruta: `${aLuis.id}/audio-${hoy}-x.webm` })) && await fallaArch(voz({ nombre: 'nota.webm' })) && await fallaArch(voz({ poster_ruta: `${aAna.id}/x.jpg` })) && await fallaArch(voz({ paginas: 1 })),
    'solo los formatos que graban los navegadores, con su ruta audio-… en su carpeta, sin nombre, miniatura ni páginas');
  check(await fallaArch(voz({ onda: '{1,2,3}' })) && await fallaArch(voz({ onda: `{${Array(8).fill(101).join(',')}}` })) && await fallaArch(voz({ onda: `{${Array(65).fill(5).join(',')}}` }))
    && await fallaArch({ atleta_id: aAna.id, tipo: 'adjunto', ruta: `${aAna.id}/adjunto-${hoy}-onda.jpg`, mime: 'image/jpeg', bytes: 10, onda: `{${Array(8).fill(5).join(',')}}` }),
    'la onda: de 8 a 64 barras de 0 a 100, y solo en una nota de voz');
  check(await falla(`update archivos set onda = $2 where id = $1`, [vA.id, `{${Array(8).fill(1).join(',')}}`]) && await falla(`update archivos set duracion_seg = 5 where id = $1`, [vA.id]), 'Ana no le cambia ni la onda ni la duración');
  const [mvA] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Nota de voz') returning *`, [vA.id]);
  check(mvA.adjunto === true && mvA.atleta_id === aAna.id && mvA.escuchado_en === null, 'su mensaje es un adjunto del chat (como una foto)');
  const avisoVoz = await notis(`usuario_id = $1 and tipo = 'mensaje' and clave like $2`, [pelayo, `mensaje:${aAna.id}:%`]);
  check(avisoVoz.length >= 1 && avisoVoz.every((x) => !/nota de voz/i.test(`${x.titulo} ${x.cuerpo}`) || x.cuerpo === 'Mensaje nuevo'), 'al coach le llega como un mensaje, sin nada de su contenido');
  await como(ana);
  check(await falla(`update comentarios set escuchado_en = now() where id = $1`, [mvA.id]), 'nadie pone «escuchado» a mano');
  check((await q(`delete from archivos where id = $1 returning id`, [vA.id])).length === 0 && (await q(`select archivo_borrable($1) b`, [vA.ruta]))[0].b === false,
    'Ana no borra su nota de voz (ni de archivos ni de Storage): se elimina para todos, en 48 horas');
  await como(pelayo, 'aal2');
  check(await falla(`insert into comentarios (archivo_id, texto) values ($1, 'Nota de voz')`, [vA.id]), 'el coach no la pone en un mensaje suyo');
  // «Escuchado»
  const [vC] = await insArch(voz({ ruta: `${aAna.id}/audio-${hoy}-coach.webm` }));
  const [mvC] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Nota de voz') returning *`, [vC.id]);
  check(vC.subido_por === 'coach', 'el coach manda una nota de voz a Ana');
  check(await falla(`select marcar_escuchado($1)`, [mvC.id]), 'el coach no marca como escuchada la suya');
  await como(luis);
  check(await falla(`select marcar_escuchado($1)`, [mvC.id]), 'ni Luis la de Ana');
  await como(ana);
  const t1 = (await q(`select marcar_escuchado($1) t`, [mvC.id]))[0].t;
  const [eC] = await q(`select escuchado_en, leido_en, entregado_en from comentarios where id = $1`, [mvC.id]);
  check(!!t1 && !!eC.escuchado_en && !!eC.leido_en && !!eC.entregado_en, 'Ana la escucha: escuchada (y leída y entregada), con la hora de la base');
  check(new Date((await q(`select marcar_escuchado($1) t`, [mvC.id]))[0].t).getTime() === new Date(t1).getTime(), 'una vez y para siempre (escucharla otra vez no la cambia)');
  check(await falla(`select marcar_escuchado($1)`, [mvA.id]), 'ni Ana marca como escuchada la suya');
  const [txt] = await q(`select id from comentarios where atleta_id = $1 and autor = 'coach' and archivo_id is null and eliminado_en is null limit 1`, [aAna.id]);
  if (txt) check(await falla(`select marcar_escuchado($1)`, [txt.id]), 'solo las notas de voz');
  await como(pelayo, 'aal2');
  check(!!(await q(`select marcar_escuchado($1) t`, [mvA.id]))[0].t, 'el coach escucha la de Ana: escuchada');
  // Con «Mostrar cuándo estoy en línea» apagado, nada (por Realtime diría cuándo la escucha)
  const [vC2] = await insArch(voz({ ruta: `${aAna.id}/audio-${hoy}-coach2.webm` }));
  const [mvC2] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Nota de voz') returning *`, [vC2.id]);
  await como(ana); await q(`select presencia_marcar(false)`);
  check((await q(`select marcar_escuchado($1) t`, [mvC2.id]))[0].t === null && (await q(`select escuchado_en from comentarios where id = $1`, [mvC2.id]))[0].escuchado_en === null,
    'con «en línea» apagado, escucharla no se apunta (sin señal al momento)');
  await su(); await q(`delete from presencia`); await q(`delete from chat_cupos`);
  // Eliminar para todos: también su archivo
  await como(ana);
  const el = (await q(`select comentario_eliminar($1) r`, [mvA.id]))[0].r;
  check(el.estado === 'eliminado' && el.rutas.includes(vA.ruta) && (await q(`select 1 from archivos where id = $1`, [vA.id])).length === 0, 'Ana elimina su nota de voz para todos: el mensaje queda eliminado y el audio se va (a la cola de Storage)');
  // El límite diario: 60 notas de voz (aparte de los 30 archivos)
  await su(); await q(`delete from archivos where atleta_id = $1 and creado_en > now() - interval '1 day'`, [aAna.id]); await q(`delete from fbe_privado.storage_por_borrar`);
  await como(ana);
  let topeV = null;
  for (let i = 0; i < 62 && !topeV; i++) { try { await insArch(voz({ ruta: `${aAna.id}/audio-${hoy}-lim${i}.webm` })); } catch (e) { topeV = { i, m: e.message }; } }
  check(topeV?.i === 60 && /60 notas de voz/.test(topeV.m), 'como mucho 60 notas de voz al día (el atleta)');
  check(!!(await insArch({ atleta_id: aAna.id, tipo: 'adjunto', ruta: `${aAna.id}/adjunto-${hoy}-tras-voz.jpg`, mime: 'image/jpeg', bytes: 100 }))[0], 'y no cuentan en los 30 archivos al día');
  await su(); await q(`delete from archivos where atleta_id = $1 and creado_en > now() - interval '1 day'`, [aAna.id]); await q(`delete from fbe_privado.storage_por_borrar`);
  // Reenviar (el coach) las suyas, nunca las de un atleta
  await como(pelayo, 'aal2');
  const [vR] = await insArch(voz({ ruta: `${aAna.id}/audio-${hoy}-reenv.webm` }));
  const [mvR] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Nota de voz') returning id`, [vR.id]);
  const [copiaL] = await insArch(voz({ atleta_id: aLuis.id, ruta: `${aLuis.id}/audio-${hoy}-copia.webm` }));
  const rr = (await q(`select chat_reenviar($1, $2) r`, [mvR.id, JSON.stringify([{ atleta: aLuis.id, archivo: copiaL.id, cliente: uuid() }])]))[0].r;
  check(rr.length === 1, 'el coach reenvía su nota de voz a Luis (con su copia)');
  await como(ana);
  const [vAna2] = await insArch(voz({ ruta: `${aAna.id}/audio-${hoy}-salud.webm` }));
  const [mAna2] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'Nota de voz') returning id`, [vAna2.id]);
  await como(pelayo, 'aal2');
  const [copiaL2] = await insArch(voz({ atleta_id: aLuis.id, ruta: `${aLuis.id}/audio-${hoy}-copia2.webm` }));
  check(await falla(`select chat_reenviar($1, $2)`, [mAna2.id, JSON.stringify([{ atleta: aLuis.id, archivo: copiaL2.id }])]), 'pero nunca la de Ana (su voz, con lo que cuente, al chat de Luis)');
  // Buscar: la marca «Nota de voz» no sale
  check(!(await q(`select * from chat_buscar('nota de voz')`)).length, 'buscar no encuentra las marcas de las notas de voz');

  console.log('  · Encuestas');
  await su(); await q(`delete from chat_cupos`);
  await como(pelayo, 'aal2');
  const opciones = JSON.stringify(['Lunes', 'Martes', 'Jueves']);
  const cE = uuid();
  const r1 = (await q(`select chat_encuesta($1, null, $2, $3::jsonb, false, $4) r`, [aAna.id, '¿Qué día hacemos el test?', opciones, cE]))[0].r;
  check(r1.enviados === 1 && r1.ids.length === 1, 'el coach manda una encuesta a Ana');
  const [mE] = await q(`select * from comentarios where id = $1`, [r1.ids[0]]);
  const [enc] = await q(`select * from encuestas_chat where comentario_id = $1`, [mE.id]);
  check(mE.texto === '¿Qué día hacemos el test?' && mE.autor === 'coach' && enc.multiple === false && enc.opciones.length === 3, 'su mensaje lleva la pregunta; la encuesta, sus opciones');
  check((await q(`select chat_encuesta($1, null, $2, $3::jsonb, false, $4) r`, [aAna.id, '¿Qué día hacemos el test?', opciones, cE]))[0].r.enviados === 0, 'repetida con el mismo id, no se duplica');
  const malaE = async (pregunta, ops, extra = {}) => falla(`select chat_encuesta($1, $2, $3, $4::jsonb, $5, null)`, [extra.lista ? null : aAna.id, extra.lista || null, pregunta, JSON.stringify(ops), !!extra.multiple]);
  check(await malaE('Una', ['Solo una']) && await malaE('Muchas', Array.from({ length: 13 }, (_, i) => `o${i}`)) && await malaE('Repes', ['Sí', ' sí ']) && await malaE('Vacía', ['a', '   '])
    && await malaE('', ['a', 'b']) && await malaE('Números', [1, 2]) && await malaE('Larga', ['a'.repeat(101), 'b']) && await malaE('Invisible', ['​', 'b']),
    'de 2 a 12 opciones de hasta 100 letras, visibles, sin repetir; y con pregunta');
  check(await falla(`select chat_encuesta($1, $2, 'x', '["a","b"]'::jsonb, false, null)`, [aAna.id, uuid()]) && await falla(`select chat_encuesta(null, null, 'x', '["a","b"]'::jsonb, false, null)`), 'a un atleta o a una lista (no a los dos, ni a nadie)');
  check(await falla(`update comentarios set texto = 'Otra pregunta' where id = $1`, [mE.id]), 'un mensaje con encuesta no se edita (ni en sus 15 minutos)');
  check(await falla(`insert into encuestas_chat (comentario_id, atleta_id, pregunta, opciones) values ($1, $2, 'x', '["a","b"]')`, [mE.id, aAna.id]) && await falla(`update encuestas_chat set multiple = true where id = $1`, [enc.id])
    && await falla(`delete from encuestas_chat where id = $1`, [enc.id]), 'ni la encuesta se crea, cambia o borra a mano');
  await como(ana);
  check((await q(`select * from encuestas_chat`)).length === 1, 'Ana ve su encuesta');
  check(await falla(`select chat_encuesta($1, null, 'x', '["a","b"]'::jsonb, false, null)`, [aAna.id]), 'Ana no crea encuestas');
  check(await falla(`insert into encuesta_votos (encuesta_id, atleta_id, opciones) values ($1, $2, '{0}')`, [enc.id, aAna.id]), 'ni vota a mano (con su función)');
  const v1 = (await q(`select encuesta_votar($1, '{1}') v`, [enc.id]))[0].v;
  check(igual(v1, [1]), 'Ana vota «Martes»');
  check(igual((await q(`select encuesta_votar($1, '{2}') v`, [enc.id]))[0].v, [2]) && (await n(`select count(*)::int n from encuesta_votos`)) === 1, 'y cambia el voto (sigue siendo uno)');
  check(await falla(`select encuesta_votar($1, '{0,1}')`, [enc.id]) && await falla(`select encuesta_votar($1, '{3}')`, [enc.id]) && await falla(`select encuesta_votar($1, '{-1}')`, [enc.id]) && await falla(`select encuesta_votar($1, '{1,1}')`, [enc.id]),
    'una sola en una encuesta de una respuesta, y solo opciones que existen (sin repetir)');
  await como(luis);
  check(!(await q(`select * from encuestas_chat`)).length && !(await q(`select * from encuesta_votos`)).length && await falla(`select encuesta_votar($1, '{0}')`, [enc.id]), 'Luis ni la ve, ni ve el voto de Ana, ni vota en ella');
  await como(pelayo, 'aal2');
  check(igual((await q(`select opciones from encuesta_votos where encuesta_id = $1`, [enc.id]))[0].opciones, [2]) && await falla(`select encuesta_votar($1, '{0}')`, [enc.id]), 'el coach ve el voto de Ana (y él no vota)');
  await como(ana);
  check((await q(`select encuesta_votar($1, '{}') v`, [enc.id]))[0].v === null && !(await q(`select * from encuesta_votos`)).length, 'con ninguna opción, Ana quita su voto');
  // De varias respuestas
  await como(pelayo, 'aal2');
  const r2 = (await q(`select chat_encuesta($1, null, '¿Qué te apetece?', '["Pierna","Torso","Cardio"]'::jsonb, true, null) r`, [aAna.id]))[0].r;
  const [enc2] = await q(`select * from encuestas_chat where comentario_id = $1`, [r2.ids[0]]);
  await como(ana);
  check(igual((await q(`select encuesta_votar($1, '{2,0}') v`, [enc2.id]))[0].v, [0, 2]), 'en una de varias, elige varias (en orden)');
  // De baja, no vota; eliminar el mensaje se lleva la encuesta y el voto
  await su(); await q(`update atletas set estado = 'baja' where id = $1`, [aAna.id]);
  await como(ana);
  check(await falla(`select encuesta_votar($1, '{1}')`, [enc2.id]), 'de baja, Ana no vota');
  await su(); await q(`update atletas set estado = 'activo' where id = $1`, [aAna.id]);
  await como(pelayo, 'aal2');
  check(await falla(`select chat_encuesta($1, null, 'x', '["a","b"]'::jsonb, false, null)`, [(await q(`insert into atletas (nombre, estado) values ('Baja 034', 'baja') returning id`))[0].id]), 'a un atleta de baja, no');
  await q(`select comentario_eliminar($1)`, [r2.ids[0]]);
  check(!(await q(`select 1 from encuestas_chat where id = $1`, [enc2.id])).length && !(await q(`select 1 from encuesta_votos where encuesta_id = $1`, [enc2.id])).length, 'eliminado su mensaje (para todos), la encuesta y su voto se van');
  // A una lista de difusión: cada uno la suya, saltándose a los de baja
  const [aBaja] = await q(`insert into atletas (nombre, estado) values ('Otra baja 034', 'baja') returning id`);
  const [lista] = await q(`insert into listas_difusion (nombre) values ('Encuesta 034') returning id`);
  await q(`insert into listas_difusion_miembros (lista_id, atleta_id) values ($1, $2), ($1, $3), ($1, $4)`, [lista.id, aAna.id, aLuis.id, aBaja.id]);
  const r3 = (await q(`select chat_encuesta(null, $1, '¿Venís el sábado?', '["Sí","No"]'::jsonb, false, $2) r`, [lista.id, uuid()]))[0].r;
  check(r3.enviados === 2 && r3.saltados === 1, 'a una lista: a Ana y a Luis, cada uno la suya (y se salta a quien está de baja)');
  await como(luis);
  const [encL] = await q(`select * from encuestas_chat`);
  check(!!encL && encL.atleta_id === aLuis.id && igual((await q(`select encuesta_votar($1, '{0}') v`, [encL.id]))[0].v, [0]), 'Luis ve la suya y vota');
  await como(ana);
  check((await q(`select * from encuesta_votos`)).length === 0, 'y Ana no ve el voto de Luis');
  // Cupos: votar (120 por hora, el atleta) y encuestas (30 por hora, el coach)
  await su(); await q(`delete from chat_cupos`);
  await como(ana);
  const [encA3] = await q(`select e.* from encuestas_chat e where e.atleta_id = $1 order by creada_en desc limit 1`, [aAna.id]);
  let topeVoto = null;
  for (let i = 0; i < 125 && !topeVoto; i++) { try { await q(`select encuesta_votar($1, $2)`, [encA3.id, `{${i % 2}}`]); } catch (e) { topeVoto = { i, m: e.message }; } }
  check(topeVoto?.i === 120 && /votado muchas veces/.test(topeVoto.m), 'como mucho 120 votos por hora (el atleta)');
  await su(); await q(`delete from chat_cupos`);
  await como(pelayo, 'aal2');
  let topeE = null;
  for (let i = 0; i < 32 && !topeE; i++) { try { await q(`select chat_encuesta($1, null, $2, '["a","b"]'::jsonb, false, null)`, [aAna.id, `e${i}`]); } catch (e) { topeE = { i, m: e.message }; } }
  check(topeE?.i === 30 && /muchas encuestas/.test(topeE.m), 'como mucho 30 encuestas por hora (también el coach)');

  console.log('  · Reacciones a elegir');
  const [paraR] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Reacciona 034') returning id`, [aAna.id]);
  await como(ana);
  const [rx] = await q(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '👍🏽') returning emoji`, [paraR.id]);
  check(rx.emoji === '👍🏽' && (await q(`update comentario_reacciones set emoji = '🔥' where comentario_id = $1 returning emoji`, [paraR.id]))[0].emoji === '🔥', 'cualquier emoji, también con su tono de piel');
  await su();
  await q(`delete from chat_cupos`); await q(`delete from comentario_reacciones`); await q(`delete from listas_difusion`); await q(`delete from atletas where estado = 'baja' and nombre like '%034'`);
  await q(`delete from comentarios where atleta_id = any($1::uuid[]) and creado_en > now() - interval '1 day'`, [[aAna.id, aLuis.id]]);
  await q(`delete from archivos where atleta_id = any($1::uuid[]) and creado_en > now() - interval '1 day'`, [[aAna.id, aLuis.id]]);
  await q(`delete from fbe_privado.storage_por_borrar`); await q(`delete from notificaciones where tipo in ('respuesta', 'mensaje')`); await q(`delete from presencia`);

  console.log('  · (revisión) El bucket de las notas de voz, la cola de Storage, encuestas sin reenviar y emojis');
  {
    await su(); await q(`delete from chat_cupos`); await q(`delete from fbe_privado.storage_por_borrar`);
    await como(ana);
    const [vz] = await insArch(voz());
    check(!(await falla(`insert into storage.objects (bucket_id, name) values ('voz', $1)`, [vz.ruta])), 'Ana sube su nota de voz registrada al bucket «voz»');
    check(await falla(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [voz().ruta]) && await falla(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [`${vz.ruta}-x`]) === true
      && await falla(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [(await insArch(voz())).ruta]),
      'una nota de voz no se sube al bucket «archivos» (ni registrada)');
    check(await falla(`insert into storage.objects (bucket_id, name) values ('voz', $1)`, [`${aAna.id}/audio-${hoy}-sinfila.webm`]), 'sin su fila de nota de voz, nada sube a «voz»');
    const [fotoA] = await insArch({ atleta_id: aAna.id, tipo: 'adjunto', ruta: `${aAna.id}/adjunto-${hoy}-${uuid().slice(0, 8)}.jpg`, mime: 'image/jpeg' });
    check(await falla(`insert into storage.objects (bucket_id, name) values ('voz', $1)`, [fotoA.ruta]), 'ni una foto a «voz» (aunque esté registrada)');
    check((await q(`select name from storage.objects where bucket_id = 'voz'`)).length === 1, 'Ana ve su nota de voz en Storage');
    await q(`delete from storage.objects where bucket_id = 'voz' and name = $1`, [vz.ruta]);
    await como(luis);
    check(await falla(`insert into storage.objects (bucket_id, name) values ('voz', $1)`, [vz.ruta]) && !(await q(`select name from storage.objects where bucket_id = 'voz'`)).length,
      'Luis ni ve ni sube nada a la nota de voz de Ana');
    await como(pelayo, 'aal2');
    check((await q(`select name from storage.objects where bucket_id = 'voz' and name = $1`, [vz.ruta])).length === 1, 'Ana no la borra de Storage (solo el coach, al vaciar la cola); el coach la ve');
    check(await falla(`insert into storage.objects (bucket_id, name) values ('voz', $1)`, [`${aAna.id}/audio-${hoy}-coach-sinfila.webm`]), 'el coach tampoco sube a «voz» algo sin registrar');
    const [vzC] = await insArch(voz());
    check(!(await falla(`insert into storage.objects (bucket_id, name) values ('voz', $1)`, [vzC.ruta])) && (await q(`delete from storage.objects where bucket_id = 'voz' and name = $1 returning name`, [vzC.ruta])).length === 1,
      'el coach sube la suya (con su fila) y borra de «voz»');
    // La cola de Storage sabe de los dos buckets; una ruta en la cola no se vuelve a registrar
    await su();
    await q(`insert into fbe_privado.storage_por_borrar (ruta, bucket) values ($1, 'voz'), ($2, 'archivos')`, [`${aAna.id}/audio-${hoy}-reusada.webm`, `${aAna.id}/adjunto-video-${hoy}-reusado.mp4.jpg`]);
    check(await falla(`insert into fbe_privado.storage_por_borrar (ruta, bucket) values ('x/y.jpg', 'otro')`), 'la cola de Storage: «archivos» o «voz» (y, con la 045, «comunidad»)');
    await como(ana);
    let errReuso = '';
    try { await insArch(voz({ ruta: `${aAna.id}/audio-${hoy}-reusada.webm` })); } catch (e) { errReuso = e.message; }
    check(/ya se usó para un archivo eliminado/.test(errReuso), '(revisión) una ruta que espera a borrarse de Storage no se vuelve a registrar');
    check(await fallaArch({ atleta_id: aAna.id, tipo: 'adjunto', ruta: `${aAna.id}/adjunto-video-${hoy}-nuevo.mp4`, mime: 'video/mp4', poster_ruta: `${aAna.id}/adjunto-video-${hoy}-reusado.mp4.jpg` }),
      '(revisión) ni como portada de un vídeo');
    check(await falla(`select * from storage_pendiente_cubos(10)`), 'la cola, con su bucket, solo la lee el coach');
    await como(pelayo, 'aal2');
    const colaB = await q(`select * from storage_pendiente_cubos(10) order by bucket`);
    check(colaB.length === 2 && colaB[0].bucket === 'archivos' && colaB[1].bucket === 'voz', 'el coach la lee con el bucket de cada ruta');
    // Eliminar una nota de voz para todos: su ruta, a la cola con el bucket «voz»
    await su(); await q(`delete from fbe_privado.storage_por_borrar`);
    await como(ana);
    const [vzM] = await insArch(voz());
    const [mVz] = await q(`insert into comentarios (archivo_id, autor, texto, adjunto) values ($1, 'atleta', 'Nota de voz', true) returning id`, [vzM.id]);
    await q(`select comentario_eliminar($1)`, [mVz.id]);
    await su();
    check(igual((await q(`select ruta, bucket from fbe_privado.storage_por_borrar`)).map((x) => [x.ruta, x.bucket]), [[vzM.ruta, 'voz']]), '(revisión) al eliminarla, su ruta va a la cola con el bucket «voz»');
    // Una encuesta no se reenvía
    await q(`delete from chat_cupos`);
    await como(pelayo, 'aal2');
    const rE = (await q(`select chat_encuesta($1, null, '¿Sábado?', '["Sí","No"]'::jsonb, false, null) r`, [aAna.id]))[0].r;
    let errFw = '';
    try { await q(`select chat_reenviar($1, $2)`, [rE.ids[0], JSON.stringify([{ atleta: aLuis.id, cliente: uuid() }])]); } catch (e) { errFw = e.message; }
    check(/Una encuesta no se reenvía/.test(errFw), '(revisión) una encuesta no se reenvía (se crea otra o va a una lista)');
    // Un voto con un número enorme: el aviso de siempre (no un error de la base)
    await como(ana);
    const [encR] = await q(`select id from encuestas_chat where comentario_id = $1`, [rE.ids[0]]);
    let errV = '';
    try { await q(`select encuesta_votar($1, '{40000}')`, [encR.id]); } catch (e) { errV = e.message; }
    check(/Esa opción no está en la encuesta/.test(errV) && !/smallint|out of range/i.test(errV), '(revisión) un voto a la opción 40000: «Esa opción no está en la encuesta» (no un error de rango)');
    // Emojis: las teclas (1️⃣, #️⃣) y las banderas de etiquetas (🏴 + etiquetas + fin), sí; etiquetas sueltas, no
    const [paraE] = await q(`insert into comentarios (atleta_id, autor, texto) values ($1, 'atleta', 'Teclas') returning id`, [aAna.id]);
    await su(); const [paraE2] = await q(`insert into comentarios (atleta_id, autor, texto) values ($1, 'coach', 'Teclas 2') returning id`, [aAna.id]);
    await como(ana);
    const reac = async (e) => { try { await q(`delete from comentario_reacciones where comentario_id = $1`, [paraE2.id]); await q(`insert into comentario_reacciones (comentario_id, emoji) values ($1, $2)`, [paraE2.id, e]); return true; } catch { return false; } };
    check(await reac('1️⃣') && await reac('#⃣') && await reac('*️⃣') && await reac('\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}'),
      '(revisión) reacciones con teclas (1️⃣ #⃣ *️⃣) y banderas de etiquetas (Escocia)');
    check(!(await reac('\u{E0067}\u{E0062}')) && !(await reac('👍\u{E0067}\u{E0062}')) && !(await reac('\u{1F3F4}\u{E0067}\u{E0062}')) && !(await reac('1')) && !(await reac('a⃣')),
      '(revisión) pero no etiquetas sueltas o pegadas a otro emoji, ni una bandera sin cerrar, ni un número o una letra');
    void paraE;
    await su();
    await q(`delete from chat_cupos`); await q(`delete from comentario_reacciones`); await q(`delete from storage.objects where bucket_id = 'voz'`);
    await q(`delete from comentarios where atleta_id = any($1::uuid[]) and creado_en > now() - interval '1 day'`, [[aAna.id, aLuis.id]]);
    await q(`delete from archivos where atleta_id = any($1::uuid[]) and creado_en > now() - interval '1 day'`, [[aAna.id, aLuis.id]]);
    await q(`delete from fbe_privado.storage_por_borrar`); await q(`delete from notificaciones where tipo in ('respuesta', 'mensaje')`);
  }

  console.log('  · (v0.56) El aviso de privacidad: qué versión ha visto cada uno');
  {
    await su(); await q(`delete from privacidad_vista`);
    check((await q(`select relrowsecurity r from pg_class where relname = 'privacidad_vista' and relnamespace = 'public'::regnamespace`))[0]?.r === true
      && !(await q(`select 1 from information_schema.role_table_grants where table_name = 'privacidad_vista' and grantee in ('anon', 'authenticated') and (grantee = 'anon' or privilege_type not in ('SELECT', 'INSERT', 'UPDATE'))`)).length,
      'privacidad_vista, con permisos por fila; sin sesión, nada; nadie la borra a mano');
    await anon();
    check(await falla(`select * from privacidad_vista`) && await falla(`insert into privacidad_vista (version) values ('2026-11')`), 'sin sesión, ni se lee ni se escribe');
    await como(ana);
    const [pv] = await q(`insert into privacidad_vista (version) values ('2026-11') returning *`);
    check(pv.usuario_id === ana && pv.version === '2026-11', 'Ana pone la suya');
    await como(luis);
    const [pvL] = await q(`insert into privacidad_vista (usuario_id, version) values ($1, '2026-10') on conflict (usuario_id) do update set version = excluded.version returning *`, [ana]);
    check(pvL.usuario_id === luis, '(Luis, con el usuario de Ana, solo pone la suya)');
    check(!(await q(`update privacidad_vista set version = '2026-11' where usuario_id = $1 returning *`, [ana])).length && (await q(`select * from privacidad_vista`)).length === 1,
      'Luis no cambia ni ve la de Ana');
    await q(`update privacidad_vista set usuario_id = $1, version = '2026-11' where usuario_id = $2`, [ana, luis]);
    await su();
    const pvs = await q(`select usuario_id, version from privacidad_vista order by version`);
    check(pvs.length === 2 && pvs.filter((x) => x.usuario_id === ana).length === 1 && pvs.filter((x) => x.usuario_id === luis).length === 1 && pvs.find((x) => x.usuario_id === ana).version === '2026-11',
      'ni pasándose a otro usuario: la de Ana sigue igual (cada uno, solo la suya)');
    await como(ana);
    check((await q(`update privacidad_vista set version = '2026-01' returning version`))[0].version === '2026-11', 'nunca hacia atrás');
    check(await falla(`update privacidad_vista set version = '2026-13'`) && await falla(`update privacidad_vista set version = 'cualquiera'`) && await falla(`update privacidad_vista set version = '2099-01'`),
      'solo una versión con su formato que ya exista (no una de dentro de años)');
    const proxima = (await q(`select to_char((now() at time zone 'Europe/Madrid') + interval '1 month', 'YYYY-MM') v`))[0].v;
    check((await q(`update privacidad_vista set version = $1 returning version`, [proxima]))[0].version === proxima, '(la del mes que viene sí: margen para publicarla)');
    await como(pelayo, 'aal2');
    check((await q(`select usuario_id from privacidad_vista order by usuario_id`)).length === 2, 'el coach ve la de cada uno (en la ficha)');
    await su(); await q(`delete from privacidad_vista`);
  }

  console.log('  · La 034 sin la 033');
  const sin33 = new PGlite();
  await sin33.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin33.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '033')) await sin33.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let err34 = null;
  try { await sin33.exec(readFileSync(new URL('../supabase/migraciones/034_chat_voz_y_encuestas.sql', import.meta.url), 'utf8')); } catch (e) { err34 = e.message; }
  check(/Antes de la 034 hace falta la 033/.test(err34 || ''), 'la 034 no se aplica sin la 033');
  await sin33.close();
}

console.log('\nLos vídeos de técnica, mucho mejores (migración 035)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const insArch = async (f) => (await q(`insert into archivos (${Object.keys(f).join(',')}) values (${Object.keys(f).map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(f)))[0];
  const fallaArch = async (f) => { try { await insArch(f); return false; } catch { return true; } };
  const ruta = (atleta, x) => `${atleta}/v057-${x}-${Math.random().toString(36).slice(2, 8)}.mp4`;
  await su();
  await q(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await q(`delete from fbe_privado.storage_por_borrar`);
  const cols = (await q(`select column_name c from information_schema.columns where table_schema = 'public' and table_name = 'archivos' and column_name in ('serie_numero', 'repite_de', 'derivado_de') order by 1`)).map((x) => x.c);
  check(cols.join() === 'derivado_de,repite_de,serie_numero', 'archivos trae serie_numero, repite_de y derivado_de');
  check((await q(`select relname from pg_class where relname in ('video_revisiones', 'tecnica_plantillas') and relrowsecurity and relnamespace = 'public'::regnamespace`)).length === 2, 'las dos tablas nuevas nacen con permisos por fila');
  check((await q(`select 1 from information_schema.role_table_grants where table_name in ('video_revisiones', 'tecnica_plantillas') and grantee = 'anon'`)).length === 0, 'sin sesión, ningún permiso sobre ellas');
  const malos = await q(`select p.oid::regprocedure::text f from pg_proc p where p.pronamespace in ('public'::regnamespace, 'fbe_privado'::regnamespace)
    and p.proname in ('archivo_enlaces', 'archivo_proteger_cambios', 'dibujo_valido', 'checklist_valido', 'tempo_valido', 'video_revision_preparar', 'video_revision_voz_suelta', 'archivo_es_voz_video', 'video_visto',
                      'puntos_tecnica_validos', 'tecnica_plantilla_preparar', 'momento_de_comentario', 'enlace_video', 'notificacion_video', 'al_corregir_video', 'videos_viejos', 'videos_limpieza', 'videos_limpiar',
                      'video_correcciones', 'al_mover_archivo', 'comentario_sin_voz_video', 'chat_reenviar', 'chat_copia_valida')
    and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))`);
  check(!malos.length, `las funciones nuevas y las que cambia la 035, con search_path vacío${malos.length ? ` (no: ${malos.map((x) => x.f).join(', ')})` : ''}`);
  check((await q(`select count(*)::int n from pg_proc where proname in ('videos_viejos', 'video_revision_voz_suelta', 'notificacion_video', 'al_corregir_video') and pronamespace = 'fbe_privado'::regnamespace`))[0].n === 4
    && !(await q(`select has_function_privilege('authenticated', 'fbe_privado.videos_viejos(integer, integer)', 'execute') x`))[0].x, 'lo interno va en fbe_privado y la app no lo puede llamar');
  // Las series de Ana y de Luis
  const [seAna] = await q(`select se.id from sesion_ejercicios se join sesiones s on s.id = se.sesion_id join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id where b.atleta_id = $1 limit 1`, [aAna.id]);
  const [seLuis] = await q(`select se.id from sesion_ejercicios se join sesiones s on s.id = se.sesion_id join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id where b.atleta_id = $1 limit 1`, [aLuis.id]);

  console.log('  · La serie del vídeo y repetir un vídeo corregido');
  await como(ana);
  const v1 = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'a'), sesion_ejercicio_id: seAna.id, serie_numero: 2, duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  check(v1.serie_numero === 2, 'Ana envía un vídeo con su serie (la 2 de un ejercicio de su sesión)');
  check(await fallaArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'b'), sesion_ejercicio_id: seLuis.id, serie_numero: 1 })
    && await fallaArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'c'), sesion_ejercicio_id: seAna.id, serie_numero: 31 })
    && await fallaArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'd'), serie_numero: 1 }) === false
    && await fallaArch({ atleta_id: aAna.id, tipo: 'foto_progreso', ruta: `${aAna.id}/v057-f.jpg`, sesion_ejercicio_id: seAna.id, serie_numero: 1 }),
    'no con una serie de Luis, ni la 31, ni en una foto (sin su ejercicio de la sesión, la serie no se guarda)');
  check((await q(`select serie_numero from archivos where ruta like $1`, [`${aAna.id}/v057-d-%`]))[0].serie_numero === null, '(sin ejercicio de la sesión, sin serie)');
  const v2 = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'r'), repite_de: v1.id, duracion_seg: 6 });
  check(v2.repite_de === v1.id, 'y graba de nuevo un vídeo suyo corregido (repite_de)');
  await como(luis);
  const vL = await insArch({ atleta_id: aLuis.id, tipo: 'video_tecnica', ruta: ruta(aLuis.id, 'l'), duracion_seg: 5 });
  check(await fallaArch({ atleta_id: aLuis.id, tipo: 'video_tecnica', ruta: ruta(aLuis.id, 'x'), repite_de: v1.id }), 'Luis no repite un vídeo de Ana');
  await como(ana);
  check(await falla(`update archivos set serie_numero = 1 where id = $1`, [v1.id]) && await falla(`update archivos set repite_de = $2 where id = $1`, [v1.id, v2.id])
    && (await q(`update archivos set nota_atleta = 'Mi serie' where id = $1 returning id`, [v1.id])).length === 1, 'después, Ana no cambia la serie ni el vídeo que repite (el pie, sí)');
  await como(pelayo, 'aal2');
  check(await falla(`update archivos set repite_de = id where id = $1`, [v2.id]) && await falla(`update archivos set repite_de = $2 where id = $1`, [v2.id, vL.id]) && await falla(`update archivos set sesion_ejercicio_id = $2 where id = $1`, [v1.id, seLuis.id]),
    'ni el coach: un vídeo no se repite a sí mismo ni a uno de otro atleta, y la serie es de su atleta');

  console.log('  · La corrección (video_revisiones)');
  await como(ana);
  check(await falla(`insert into video_revisiones (archivo_id, atleta_id, puntuacion) values ($1, $2, 5)`, [v1.id, aAna.id]) && await falla(`select video_visto($1)`, [v1.id]), 'Ana no se corrige ni se marca «Visto» ella misma');
  await como(pelayo, 'aal2');
  const visto = (await q(`select video_visto($1)::text d`, [v1.id]))[0].d;
  const hoyM = (await q(`select (now() at time zone 'Europe/Madrid')::date::text d`))[0].d;
  const fotoAna = (await q(`select id from archivos where tipo = 'foto_progreso' and atleta_id = $1 limit 1`, [aAna.id]))[0]?.id;
  check(visto === hoyM && (await q(`select video_visto($1)::text d`, [v1.id]))[0].d === hoyM && (!fotoAna || (await q(`select video_visto($1) d`, [fotoAna]))[0].d === null),
    'el coach lo abre: «Visto» con el día de hoy (en Madrid), sin la hora (una foto, no)');
  const [r0] = await q(`select * from video_revisiones where archivo_id = $1`, [v1.id]);
  check(r0.atleta_id === aAna.id && r0.corregido_en === null && r0.puntuacion === null, 'verlo no es corregirlo');
  check(await falla(`update video_revisiones set puntuacion = 6 where archivo_id = $1`, [v1.id]) && await falla(`update video_revisiones set checklist = '{"puntos":[{"t":"x","e":"si"}]}' where archivo_id = $1`, [v1.id])
    && await falla(`update video_revisiones set tempo = '{"reps":[[0,2,1]]}' where archivo_id = $1`, [v1.id]) && await falla(`update video_revisiones set tempo = '{"reps":[[0,1,20]]}' where archivo_id = $1`, [v1.id])
    && await falla(`update video_revisiones set checklist = $2 where archivo_id = $1`, [v1.id, JSON.stringify({ puntos: Array.from({ length: 16 }, () => ({ t: 'x', e: 'bien' })) })]),
    'la nota de 1 a 5; los puntos con su forma; el tempo en orden y dentro del vídeo (8 s); de 1 a 15 puntos');
  await q(`update video_revisiones set puntuacion = 4, checklist = $2, tempo = $3, visto_el = '2020-01-01', corregido_en = '2020-01-01', atleta_id = $4 where archivo_id = $1`,
    [v1.id, JSON.stringify({ puntos: [{ t: 'Rodillas', e: 'mal', s: 1.5 }] }), JSON.stringify({ reps: [[0.2, 1.4, 2.1], [2.1, 3.3, 4]] }), aLuis.id]);
  const [r1] = await q(`select *, visto_el::text visto_el from video_revisiones where archivo_id = $1`, [v1.id]);
  check(r1.puntuacion === 4 && r1.visto_el === hoyM && r1.corregido_en && new Date(r1.corregido_en).getFullYear() > 2020 && r1.atleta_id === aAna.id,
    'el coach la corrige: nota, puntos y tempo; «Visto» y «Corregido» los pone la base (no se fechan a mano) y es de Ana');
  check(await falla(`insert into video_revisiones (archivo_id, atleta_id) values ($1, $2)`, [fotoAna || '00000000-0000-4000-8000-000000000000', aAna.id]),
    'solo se corrige un vídeo de técnica');
  const avisoCorr = await notis(`clave = $1`, ['video:' + v1.id]);
  check(avisoCorr.length === 1 && avisoCorr[0].usuario_id === ana && avisoCorr[0].titulo === 'Pelayo ha corregido tu vídeo' && avisoCorr[0].cuerpo === 'En tu vídeo' && avisoCorr[0].url === `#videos/${v1.id}@0.2`,
    `a Ana le llega «Pelayo ha corregido tu vídeo», sin texto, al primer momento corregido (${avisoCorr[0]?.url})`);
  await como(pelayo, 'aal2');
  await q(`update video_revisiones set puntuacion = 5 where archivo_id = $1`, [v1.id]);
  check((await notis(`clave = $1`, ['video:' + v1.id])).length === 1, 'cambiarla después no vuelve a avisar');
  await como(pelayo, 'aal2');
  const [cMom] = await q(`insert into comentarios (archivo_id, texto) values ($1, 'En 0:01,5 se te van las rodillas') returning id`, [v1.id]);
  const [cDibV] = await q(`insert into comentarios (archivo_id, texto, dibujo) values ($1, 'Mira el dibujo', $2) returning id`, [v1.id, JSON.stringify({ t: 2, hasta: 3, formas: [{ tipo: 'texto', p: [[0.5, 0.5]], x: 'Rodillas' }, { tipo: 'flecha', p: [[0, 0], [1, 1]], c: 'rojo' }] })]);
  check((await notis(`clave = $1`, ['comentario:' + cMom.id]))[0]?.url === `#videos/${v1.id}@1.5` && (await notis(`clave = $1`, ['comentario:' + cDibV.id]))[0]?.url === `#videos/${v1.id}@2.0`,
    'la respuesta del coach en el hilo del vídeo lleva a su momento (el que nombra o el de su dibujo)');
  check(!(await notis(`clave like 'comentario:%' or clave like 'video:%'`)).some((x) => /rodillas|dibujo/i.test(`${x.titulo} ${x.cuerpo}`)), 'ningún aviso lleva el texto');
  await su();
  check(await falla(`insert into notificaciones (usuario_id, tipo, titulo, url, clave, caduca_en) values ($1, 'respuesta', 'x', '#videos/../evil', 'v057-x', now() + interval '1 day')`, [ana])
    && await falla(`insert into notificaciones (usuario_id, tipo, titulo, url, clave, caduca_en) values ($1, 'respuesta', 'x', $2, 'v057-y', now() + interval '1 day')`, [ana, `#videos/${v1.id}@12345`])
    && await falla(`insert into notificaciones (usuario_id, tipo, titulo, url, clave, caduca_en) values ($1, 'respuesta', 'x', $2, 'v057-z', now() + interval '1 day')`, [ana, `#videos/${v1.id}@1.5x`]),
    'la dirección de un aviso, anclada: #videos/<id>@<segundos> y nada más');
  // Dibujos nuevos en la base
  await como(pelayo, 'aal2');
  const malD = async (d) => falla(`insert into comentarios (archivo_id, texto, dibujo) values ($1, 'x', $2)`, [v1.id, JSON.stringify(d)]);
  check(await malD({ t: 1, formas: [{ tipo: 'texto', p: [[0, 0]] }] }) && await malD({ t: 1, formas: [{ tipo: 'texto', p: [[0, 0]], x: 'x'.repeat(41) }] }) && await malD({ t: 1, formas: [{ tipo: 'texto', p: [[0, 0]], x: '​ ' }] })
    && await malD({ t: 1, hasta: 0.5, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]] }] }) && await malD({ t: 1, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]], c: 'verde' }] }) && await malD({ t: 1, formas: [{ tipo: 'lapiz', p: [[0, 0]] }] })
    && await malD({ t: 1, formas: [{ tipo: 'lapiz', p: Array(81).fill([0.5, 0.5]) }] }) && await malD({ t: 1, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]], c: 1 }] }) && await malD({ t: 1, formas: [{ tipo: 'circulo', p: [[0, 0], [1, 1], [1, 0]] }] }),
    'dibujos nuevos con su forma exacta: texto de 1 a 40 letras visibles, tramo que acaba después, colores de la lista, lápiz de 2 a 80 puntos, círculo de 2');
  // La voz del coach sobre el vídeo (una nota de voz del coach para Ana)
  console.log('  · La voz del coach sobre el vídeo');
  const insVoz = async (atleta, x) => (await q(`insert into archivos (atleta_id, tipo, ruta, mime, bytes, duracion_seg) values ($1::uuid, 'audio', $1::text || $2, 'audio/webm', 4000, 12) returning *`, [atleta, `/audio-v057-${x}.webm`]))[0];
  const voz1 = await insVoz(aAna.id, 'c1');
  const vozLuis = await insVoz(aLuis.id, 'cl');
  await como(ana);
  const vozAna = await insVoz(aAna.id, 'a1');
  await como(pelayo, 'aal2');
  check(await falla(`update video_revisiones set voz_archivo_id = $2, voz_inicio = 1 where archivo_id = $1`, [v1.id, vozAna.id]) && await falla(`update video_revisiones set voz_archivo_id = $2, voz_inicio = 1 where archivo_id = $1`, [v1.id, vozLuis.id])
    && await falla(`update video_revisiones set voz_archivo_id = $2, voz_inicio = 1 where archivo_id = $1`, [v1.id, v2.id]) && await falla(`update video_revisiones set voz_archivo_id = $2, voz_inicio = 30 where archivo_id = $1`, [v1.id, voz1.id]),
    'la voz: una nota de voz del coach para ese atleta (no una de Ana, ni de Luis, ni un vídeo) que empieza dentro del vídeo');
  await q(`update video_revisiones set voz_archivo_id = $2, voz_inicio = 1.25 where archivo_id = $1`, [v1.id, voz1.id]);
  check((await q(`select voz_inicio::float v from video_revisiones where archivo_id = $1`, [v1.id]))[0].v === 1.25, 'el coach pone su voz desde el 0:01,2');
  await como(ana);
  check((await q(`select voz_archivo_id from video_correcciones($1)`, [[v1.id]]))[0].voz_archivo_id === voz1.id && (await q(`select voz_registrada($1) ok`, [voz1.ruta]))[0].ok === true
    && (await q(`delete from archivos where id = $1 returning id`, [voz1.id])).length === 0, 'Ana la ve (y la puede escuchar: Storage la deja), pero no la borra');
  await como(luis);
  check((await q(`select * from video_revisiones where archivo_id = $1`, [v1.id])).length === 0 && (await q(`select * from video_revisiones`)).length === 0
    && (await q(`select * from video_correcciones($1)`, [[v1.id]])).length === 0, 'Luis no ve la corrección de Ana');
  await como(pelayo, 'aal2');
  const voz2 = await insVoz(aAna.id, 'c2');
  await q(`update video_revisiones set voz_archivo_id = $2 where archivo_id = $1`, [v1.id, voz2.id]);
  await su();
  check((await q(`select 1 from archivos where id = $1`, [voz1.id])).length === 0 && (await q(`select bucket from fbe_privado.storage_por_borrar where ruta = $1`, [voz1.ruta]))[0]?.bucket === 'voz',
    'al cambiarla por otra, la de antes se borra (y va a la cola de Storage, del bucket «voz»)');
  await como(pelayo, 'aal2');
  await q(`delete from archivos where id = $1`, [voz2.id]);
  check((await q(`select voz_archivo_id, voz_inicio from video_revisiones where archivo_id = $1`, [v1.id]))[0].voz_inicio === null, 'si se borra la voz, la corrección se queda sin ella (y sin su momento)');
  const voz3 = await insVoz(aAna.id, 'c3');
  await q(`update video_revisiones set voz_archivo_id = $2, voz_inicio = 0 where archivo_id = $1`, [v1.id, voz3.id]);

  console.log('  · Las listas de puntos clave (tecnica_plantillas)');
  await como(ana);
  check(await falla(`insert into tecnica_plantillas (ejercicio_id, puntos) values ($1, '{a}')`, [press.id]) && (await q(`select * from tecnica_plantillas`)).length === 0, 'el atleta ni las ve ni las escribe');
  await como(pelayo, 'aal2');
  const [tp] = await q(`insert into tecnica_plantillas (ejercicio_id, puntos) values ($1, $2) returning *`, [press.id, ['  Escápulas juntas ', 'Codos a 45°']]);
  check(tp.puntos[0] === 'Escápulas juntas' && await falla(`update tecnica_plantillas set puntos = '{}' where ejercicio_id = $1`, [press.id]) && await falla(`update tecnica_plantillas set puntos = $2 where ejercicio_id = $1`, [press.id, Array(16).fill('x')])
    && await falla(`update tecnica_plantillas set puntos = $2 where ejercicio_id = $1`, [press.id, ['​']]) && await falla(`insert into tecnica_plantillas (ejercicio_id, puntos) values ($1, '{a}')`, [press.id]),
    'el coach guarda la del press banca (de 1 a 15 puntos visibles, una por ejercicio)');

  console.log('  · Limpieza de vídeos antiguos');
  await su();
  const antiguo = { fecha: '2025-01-10', creado_en: '2025-01-10T10:00:00Z', revisado_en: '2025-01-11T10:00:00Z' };
  const viejo = await insArch({ atleta_id: aLuis.id, tipo: 'video_tecnica', ruta: ruta(aLuis.id, 'viejo'), ...antiguo, bytes: 5000, poster_ruta: `${aLuis.id}/v057-viejo.jpg` });
  const viejoDest = await insArch({ atleta_id: aLuis.id, tipo: 'video_tecnica', ruta: ruta(aLuis.id, 'dest'), ...antiguo, bytes: 5000, destacado: true });
  const viejoHablado = await insArch({ atleta_id: aLuis.id, tipo: 'video_tecnica', ruta: ruta(aLuis.id, 'hab'), ...antiguo, bytes: 5000 });
  // (revisión de seguridad, H2) uno con el día puesto atrás pero llegado hoy, uno sin revisar (en la cola), uno solo «Visto» hoy
  const viejoFalso = await insArch({ atleta_id: aLuis.id, tipo: 'video_tecnica', ruta: ruta(aLuis.id, 'falso'), fecha: '2021-01-01', revisado_en: '2025-01-11T10:00:00Z', bytes: 5000 });
  const viejoCola = await insArch({ atleta_id: aLuis.id, tipo: 'video_tecnica', ruta: ruta(aLuis.id, 'cola'), fecha: '2025-01-10', creado_en: '2025-01-10T10:00:00Z', bytes: 5000 });
  const viejoVisto = await insArch({ atleta_id: aLuis.id, tipo: 'video_tecnica', ruta: ruta(aLuis.id, 'visto'), ...antiguo, bytes: 5000 });
  const viejoCorr = await insArch({ atleta_id: aLuis.id, tipo: 'video_tecnica', ruta: ruta(aLuis.id, 'corr'), fecha: '2025-01-10', creado_en: '2025-01-10T10:00:00Z', bytes: 5000 });
  const viejoFoto = (await q(`insert into archivos (atleta_id, tipo, ruta, fecha) values ($1::uuid, 'foto_progreso', $1::text || '/v057-vieja.jpg', '2025-01-10') returning id`, [aLuis.id]))[0];
  await como(pelayo, 'aal2');
  await q(`insert into comentarios (archivo_id, texto) values ($1, 'Lo seguimos hablando')`, [viejoHablado.id]);
  await q(`select video_visto($1)`, [viejoVisto.id]);
  await su();
  await q(`insert into video_revisiones (archivo_id, atleta_id, puntuacion, corregido_en, actualizado_en) values ($1, $2, 3, '2025-01-11', '2025-01-11')`, [viejoCorr.id, aLuis.id]);
  await q(`set session_replication_role = replica`);
  await q(`update video_revisiones set actualizado_en = '2025-01-11', corregido_en = '2025-01-11' where archivo_id = $1`, [viejoCorr.id]);
  await q(`update archivos set revisado_en = null where id = $1`, [viejoCorr.id]);
  await q(`set session_replication_role = default`);
  await como(luis);
  check(await falla(`select videos_limpieza(6, 30)`) && await falla(`select videos_limpiar(6, 30, $1)`, [[viejo.id]]), 'el atleta no limpia nada');
  await como(pelayo, 'aal2');
  const prev = (await q(`select videos_limpieza(6, 30) r`))[0].r;
  {
    const idsP = prev.lista.map((x) => x.id);
    check(!idsP.includes(viejoFalso.id) && !idsP.includes(viejoCola.id) && idsP.includes(viejoVisto.id) && idsP.includes(viejoCorr.id),
      '(revisión) cuenta cuándo llegó (no el día puesto a mano); no el que espera en la cola; abrirlo («Visto») no lo protege; corregido hace tiempo, sí entra');
    check(await falla(`select videos_limpieza(6, 0)`) && await falla(`select videos_limpieza(6, 6)`) && await falla(`select videos_limpiar(6, 0, $1)`, [[viejo.id]]) && !(await falla(`select videos_limpieza(6, 7)`)),
      '(revisión) la conversación protege al menos 7 días (con 0, nada la protegería)');
  }
  const ids = prev.lista.map((x) => x.id);
  check(ids.includes(viejo.id) && !ids.includes(viejoDest.id) && !ids.includes(viejoHablado.id) && !ids.includes(viejoFoto.id) && !ids.includes(v1.id) && prev.n === ids.length && prev.bytes >= 5000,
    'lo que se borraría: de más de 6 meses, sin destacar, sin conversación reciente, solo vídeos de técnica (con cuántos y cuánto ocupan)');
  check(await falla(`select videos_limpieza(0, 30)`) && await falla(`select videos_limpieza(61, 30)`) && await falla(`select videos_limpiar(6, 30, '{}'::uuid[])`), 'con límites: de 1 a 60 meses y al menos un vídeo');
  const borr = (await q(`select videos_limpiar(6, 30, $1) r`, [[viejo.id, viejoDest.id, v1.id]]))[0].r;
  await su();
  check(borr.n === 1 && (await q(`select 1 from archivos where id = any($1::uuid[])`, [[viejoDest.id, v1.id]])).length === 2 && (await q(`select 1 from archivos where id = $1`, [viejo.id])).length === 0
    && (await q(`select count(*)::int n from fbe_privado.storage_por_borrar where ruta in ($1, $2)`, [viejo.ruta, viejo.poster_ruta]))[0].n === 2,
    'borra solo los que siguen cumpliéndolo (nunca el destacado ni el reciente) y su vídeo y su miniatura van a la cola de Storage');

  console.log('  · Al borrar el vídeo');
  await como(ana);
  check((await q(`delete from archivos where id = $1 returning id`, [v1.id])).length === 1, 'Ana borra su vídeo corregido');
  await su();
  check((await q(`select 1 from video_revisiones where archivo_id = $1`, [v1.id])).length === 0 && (await q(`select 1 from archivos where id = $1`, [voz3.id])).length === 0
    && (await q(`select repite_de from archivos where id = $1`, [v2.id]))[0].repite_de === null && (await q(`select bucket from fbe_privado.storage_por_borrar where ruta = $1`, [voz3.ruta]))[0]?.bucket === 'voz',
    'su corrección y la voz del coach se van con él; la repetición se queda suelta');
  await su();
  await q(`delete from archivos where ruta like '%/v057-%' or ruta like '%/audio-v057-%'`); await q(`delete from tecnica_plantillas`); await q(`delete from fbe_privado.storage_por_borrar`);
  await anon();
  check(await falla(`select * from video_revisiones`) && await falla(`select * from tecnica_plantillas`) && await falla(`select video_visto($1)`, [v2.id]) && await falla(`select videos_limpieza(6, 30)`), 'sin sesión, nada de lo nuevo');

  console.log('  · Revisión de seguridad de la 035');
  {
    await como(ana);
    const sv = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 's1'), duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
    const svRep = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 's2'), repite_de: sv.id, duracion_seg: 6 });
    // H1: «Visto» una vez; el atleta nunca ve una hora (ni con «Mostrar cuándo estoy en línea» ni sin él)
    await como(pelayo, 'aal2');
    await q(`select video_visto($1)`, [sv.id]);
    const t0 = (await q(`select actualizado_en::text a, visto_el::text v from video_revisiones where archivo_id = $1`, [sv.id]))[0];
    await q(`select video_visto($1)`, [sv.id]); await q(`select video_visto($1)`, [sv.id]);
    const t1 = (await q(`select actualizado_en::text a, visto_el::text v from video_revisiones where archivo_id = $1`, [sv.id]))[0];
    check(t0.a === t1.a && t0.v === t1.v, '(H1) abrir otra vez el vídeo no toca la fila: ni el día de «Visto» ni su fecha de cambio');
    await q(`update video_revisiones set puntuacion = 4 where archivo_id = $1`, [sv.id]);
    const tiposCols = (await q(`select t.typname from pg_proc p, unnest(p.proallargtypes) with ordinality a(oid, i) join pg_type t on t.oid = a.oid
                                where p.proname = 'video_correcciones' and p.pronamespace = 'public'::regnamespace`)).map((x) => x.typname);
    check(tiposCols.length > 0 && !tiposCols.some((x) => /^(timestamptz|timestamp|time|timetz|interval)$/.test(x)), `(H1) video_correcciones no devuelve ninguna hora (${tiposCols.join(', ')})`);
    for (const visible of [true, false]) {
      await su();
      await q(`insert into presencia (usuario_id, visible, ultima_conexion) values ($1, $2, null) on conflict (usuario_id) do update set visible = $2, ultima_conexion = null`, [pelayo, visible]);
      await como(ana);
      const filas = await q(`select * from video_correcciones($1)`, [[sv.id]]);
      const fila = filas[0] || {};
      const conHora = Object.entries(fila).filter(([, x]) => typeof x === 'string' && /\d{2}:\d{2}/.test(x));
      check(filas.length === 1 && !Object.keys(fila).some((k) => /_en$/.test(k)) && !conHora.length && fila.puntuacion === 4
        && (await q(`select visto_el::text v, corregido_el::text c from video_correcciones($1)`, [[sv.id]]))[0].c === t0.v
        && (await q(`select * from video_revisiones`)).length === 0 && (await q(`select corregido_en from video_revisiones where archivo_id = $1`, [sv.id])).length === 0,
        `(H1) con la presencia del coach ${visible ? 'visible' : 'escondida'}, Ana ve el día de «Visto» y «Corregido», nunca la hora (ni la tabla)`);
    }
    check(await falla(`select * from video_correcciones($1)`, [Array.from({ length: 1001 }, () => sv.id)]), '(H1) como mucho 1000 vídeos por vez');
    await su();
    await q(`delete from presencia where usuario_id = $1`, [pelayo]);
    // H2: el día de un archivo del atleta, como mucho mañana; cuándo llegó, la base
    await como(ana);
    const manana = (await q(`select ((now() at time zone 'Europe/Madrid')::date + 1)::text d`))[0].d;
    const fut = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'fut'), fecha: '2099-01-01', creado_en: '2020-01-01' });
    const atras = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'atras'), fecha: '2021-01-01', creado_en: '2021-01-01' });
    const [fx] = await q(`select fecha::text f, (creado_en > now() - interval '1 minute') hoy from archivos where id = $1`, [fut.id]);
    const [ax] = await q(`select fecha::text f, (creado_en > now() - interval '1 minute') hoy from archivos where id = $1`, [atras.id]);
    check(fx.f === manana && fx.hoy && ax.f === '2021-01-01' && ax.hoy, '(H2) un día del futuro se queda en mañana; uno de atrás vale (un vídeo pendiente), pero cuándo llegó lo pone la base');
    await como(pelayo, 'aal2');
    await q(`update archivos set revisado_en = now() where id = $1`, [atras.id]);
    check(!(await q(`select videos_limpieza(1, 7) r`))[0].r.lista.some((x) => x.id === atras.id), '(H2) así que el de atrás no se puede borrar como viejo: llegó hoy');
    // M1: el fotograma de un vídeo
    const frame = { atleta_id: aAna.id, tipo: 'adjunto', mime: 'image/jpeg', bytes: 300 };
    const fot = await insArch({ ...frame, ruta: `${aAna.id}/adjunto-v057-f1.jpg`, derivado_de: sv.id });
    const [cFot] = await q(`insert into comentarios (atleta_id, texto, archivo_id) values ($1, 'Mira', $2) returning id`, [aAna.id, fot.id]);
    const copiaL = await insArch({ atleta_id: aLuis.id, tipo: 'adjunto', mime: 'image/jpeg', bytes: 300, ruta: `${aLuis.id}/adjunto-v057-c1.jpg` });
    check(fot.derivado_de === sv.id && await falla(`select chat_reenviar($1, $2::jsonb)`, [cFot.id, JSON.stringify([{ atleta: aLuis.id, archivo: copiaL.id }])]),
      '(M1) el fotograma del vídeo de Ana va a su chat, y chat_reenviar no lo reenvía a Luis');
    check(await falla(`update archivos set derivado_de = null where id = $1`, [fot.id]) && await fallaArch({ ...frame, atleta_id: aLuis.id, ruta: `${aLuis.id}/adjunto-v057-f2.jpg`, derivado_de: sv.id })
      && await fallaArch({ ...frame, ruta: `${aAna.id}/adjunto-v057-f3.jpg`, derivado_de: fot.id }) && await fallaArch({ ...frame, tipo: 'documento', mime: 'application/pdf', ruta: `${aAna.id}/documento-v057-f4.pdf`, derivado_de: sv.id }),
      '(M1) el coach no lo quita después, ni lo pone a un archivo de otro atleta, ni de algo que no es un vídeo, ni en un documento');
    const fotL = await insArch({ atleta_id: aLuis.id, tipo: 'adjunto', mime: 'image/jpeg', bytes: 300, ruta: `${aLuis.id}/adjunto-v057-c2.jpg` });
    await su();
    await q(`set session_replication_role = replica`);
    await q(`update archivos set derivado_de = $2 where id = $1`, [fotL.id, sv.id]);
    await q(`set session_replication_role = default`);
    check((await q(`select fbe_privado.chat_copia_valida($1, $2, 'adjunto', 'image/jpeg') ok`, [fotL.id, aLuis.id]))[0].ok === false
      && (await q(`select fbe_privado.chat_copia_valida($1, $2, 'adjunto', 'image/jpeg') ok`, [copiaL.id, aLuis.id]))[0].ok === true,
      '(M1) y un fotograma nunca vale como copia para reenviar o difundir (chat_copia_valida)');
    await como(ana);
    check(await fallaArch({ ...frame, ruta: `${aAna.id}/adjunto-v057-f5.jpg`, derivado_de: sv.id }), '(M1) un atleta no marca fotogramas');
    // M2: la voz de un vídeo y las notas de voz del chat, por separado
    await como(pelayo, 'aal2');
    const insVozS = async (x) => (await q(`insert into archivos (atleta_id, tipo, ruta, mime, bytes, duracion_seg) values ($1::uuid, 'audio', $1::text || $2, 'audio/webm', 4000, 5) returning *`, [aAna.id, `/audio-v057-${x}.webm`]))[0];
    const nota = await insVozS('chat');
    await q(`insert into comentarios (atleta_id, texto, archivo_id) values ($1, 'Nota de voz', $2)`, [aAna.id, nota.id]);
    check(await falla(`update video_revisiones set voz_archivo_id = $2 where archivo_id = $1`, [sv.id, nota.id]), '(M2) una nota de voz del chat no se usa como voz del vídeo (al borrar el vídeo, se iría su mensaje)');
    const vozS = await insVozS('video');
    await q(`update video_revisiones set voz_archivo_id = $2, voz_inicio = 0 where archivo_id = $1`, [sv.id, vozS.id]);
    check(await falla(`insert into comentarios (atleta_id, texto, archivo_id) values ($1, 'Nota de voz', $2)`, [aAna.id, vozS.id])
      && await falla(`insert into comentarios (archivo_id, texto) values ($1, 'x')`, [vozS.id]), '(M2) ni la voz de un vídeo se pone después en un mensaje o un comentario');
    // L4: el coach pasa el vídeo a Luis: su corrección va con él (sin la voz, que era de Ana) y Ana ya no la ve
    await q(`update archivos set atleta_id = $2, ruta = $3 where id = $1`, [sv.id, aLuis.id, ruta(aLuis.id, 'movido')]);
    const [rm] = await q(`select atleta_id, voz_archivo_id, puntuacion from video_revisiones where archivo_id = $1`, [sv.id]);
    check(rm.atleta_id === aLuis.id && rm.voz_archivo_id === null && rm.puntuacion === 4 && !(await q(`select 1 from archivos where id = $1`, [vozS.id])).length
      && (await q(`select repite_de from archivos where id = $1`, [svRep.id]))[0].repite_de === null, '(L4) al pasar el vídeo a Luis, su corrección va con él, sin la voz de Ana, y la repetición de Ana queda suelta');
    await como(ana);
    check((await q(`select * from video_correcciones($1)`, [[sv.id]])).length === 0, '(L4) y Ana ya no ve esa corrección');
    await como(luis);
    check((await q(`select puntuacion from video_correcciones($1)`, [[sv.id]]))[0]?.puntuacion === 4, '(L4) Luis, sí');
    // L2: el aviso de la corrección, aún sin salir, se retira si el vídeo se borra
    await como(ana);
    const sv3 = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 's3'), duracion_seg: 8 });
    await como(pelayo, 'aal2');
    await q(`insert into video_revisiones (archivo_id, atleta_id, puntuacion) values ($1, $2, 2)`, [sv3.id, aAna.id]);
    const antesL2 = await notis(`clave = $1 and estado = 'pendiente'`, ['video:' + sv3.id]);
    await como(pelayo, 'aal2');
    await q(`delete from archivos where id = $1`, [sv3.id]);
    check(antesL2.length === 1 && (await notis(`clave = $1`, ['video:' + sv3.id])).length === 0, '(L2) se borra el vídeo antes de que salga el aviso de su corrección: el aviso se retira');
    // L5: algo mal formado da false, nunca un error
    await su();
    const malos = ['[1]', '"x"', '5', 'null', '{"t":"a","formas":[{"tipo":"linea","p":[[0,0],[1,1]]}]}', '{"t":1,"hasta":"z","formas":[{"tipo":"linea","p":[[0,0],[1,1]]}]}',
      '{"t":[1],"formas":[]}', '{"t":1,"formas":[{"tipo":"texto","p":[[0,0]],"x":5}]}', '{"t":1,"formas":[5]}', '{"t":1,"formas":[{"tipo":"linea","p":[[0,"a"],[1,1]]}]}', '{"t":1,"formas":"x"}'];
    const rD = [];
    for (const j of malos) rD.push((await q(`select dibujo_valido($1::jsonb) ok`, [j]))[0].ok);
    const malosC = ['[1]', '"x"', '{"puntos":[{"t":"a","e":"bien","s":"1"}]}', '{"puntos":[{"t":"a","e":"bien","s":[1]}]}', '{"puntos":[5]}', '{"puntos":{"a":1}}', '{"puntos":[{"t":5,"e":"bien"}]}'];
    const rC = [];
    for (const j of malosC) rC.push((await q(`select checklist_valido($1::jsonb) ok`, [j]))[0].ok);
    const malosT = ['[1]', '"x"', '{"reps":[1]}', '{"reps":[[1,"a",3]]}', '{"reps":"x"}', '{"reps":[{"a":1}]}'];
    const rT = [];
    for (const j of malosT) rT.push((await q(`select tempo_valido($1::jsonb) ok`, [j]))[0].ok);
    check(rD.every((x) => x === false) && rC.every((x) => x === false) && rT.every((x) => x === false)
      && (await q(`select dibujo_valido('{"t":1,"hasta":2,"formas":[{"tipo":"linea","p":[[0,0],[1,1]]}]}') a, checklist_valido('{"puntos":[{"t":"a","e":"bien","s":1}]}') b, tempo_valido('{"reps":[[0,1,2]]}') c`))
        .every((x) => x.a && x.b && x.c),
      `(L5) dibujos, puntos y tempo mal formados: false, nunca un error (${[...rD, ...rC, ...rT].map(String).join(' ')})`);
    await como(pelayo, 'aal2');
    check(await falla(`update video_revisiones set tempo = '{"reps":[[1,"a",3]]}' where archivo_id = $1`, [sv.id]), '(L5) y un tempo mal formado se rechaza con la restricción, sin romper el trigger');
    await su();
    await q(`delete from comentarios where archivo_id in (select id from archivos where ruta like '%/v057-%' or ruta like '%/audio-v057-%' or ruta like '%/adjunto-v057-%')`);
    await q(`delete from archivos where ruta like '%/v057-%' or ruta like '%/audio-v057-%' or ruta like '%/adjunto-v057-%' or ruta like '%/documento-v057-%'`);
    await q(`delete from fbe_privado.storage_por_borrar`);
  }

  console.log('  · La 035 sin la 034');
  const sin34 = new PGlite();
  await sin34.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin34.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '034')) await sin34.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  let err35 = null;
  try { await sin34.exec(readFileSync(new URL('../supabase/migraciones/035_videos_tecnica.sql', import.meta.url), 'utf8')); } catch (e) { err35 = e.message; }
  check(/Antes de la 035 hace falta la 034/.test(err35 || ''), 'la 035 no se aplica sin la 034');
  await sin34.close();
}

console.log('\nEl análisis automático de los vídeos (migración 036)');
{
  const { VALIDOS, MALFORMADOS } = await import('./analisis-casos.mjs');
  const { tamJsonb } = await import('../web/src/logica/analisis.js');
  const insArch = async (f) => (await q(`insert into archivos (${Object.keys(f).join(',')}) values (${Object.keys(f).map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(f)))[0];
  const ruta = (atleta, x) => `${atleta}/v058-${x}-${Math.random().toString(36).slice(2, 8)}.webm`;
  await su();
  check((await q(`select data_type from information_schema.columns where table_schema = 'public' and table_name = 'video_revisiones' and column_name = 'analisis'`))[0]?.data_type === 'jsonb'
    && (await q(`select 1 from pg_constraint where conname = 'video_revisiones_analisis_valido'`)).length === 1, 'video_revisiones trae analisis (jsonb), con su restricción');
  const malosSp = await q(`select p.oid::regprocedure::text f from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('analisis_valido', 'analisis_num', 'video_revision_preparar', 'video_correcciones') and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))`);
  check(!malosSp.length && (await q(`select prosecdef d from pg_proc where proname = 'video_correcciones'`))[0].d === true && (await q(`select prosecdef d from pg_proc where proname = 'analisis_valido'`))[0].d === false,
    'las funciones nuevas y las que cambia la 036, con search_path vacío (video_correcciones, como antes, con los permisos de su dueño; el validador, sin)');
  check(!(await q(`select has_function_privilege('anon', 'public.video_correcciones(uuid[])', 'execute') x`))[0].x && (await q(`select has_function_privilege('authenticated', 'public.video_correcciones(uuid[])', 'execute') x`))[0].x
    && !(await q(`select has_function_privilege('anon', 'public.analisis_valido(jsonb)', 'execute') x`))[0].x
    && (await q(`select 1 from information_schema.role_table_grants where table_name = 'video_revisiones' and grantee = 'anon'`)).length === 0
    && (await q(`select count(*)::int n from pg_policies where tablename = 'video_revisiones'`))[0].n === 1,
    'al volver a crear video_correcciones, sus permisos son los de la 035: la app sí, sin sesión no; la tabla, sin nada para anon y con una sola política (la del coach)');
  const tipos = (await q(`select t.typname from pg_proc p, unnest(p.proallargtypes) a(oid) join pg_type t on t.oid = a.oid where p.proname = 'video_correcciones'`)).map((x) => x.typname);
  check(tipos.includes('jsonb') && !tipos.some((x) => /^(timestamptz|timestamp|time|timetz|interval)$/.test(x)), `video_correcciones devuelve el análisis y sigue sin ninguna hora (${tipos.join(', ')})`);
  // El validador: lo mismo que la app (analisisValido), y nunca un error
  const rv = []; for (const j of VALIDOS) rv.push((await q(`select analisis_valido($1::jsonb) ok, octet_length($1::jsonb::text) n`, [j]))[0]);
  check(rv.every((x) => x.ok === true) && rv.every((x, i) => x.n === tamJsonb(JSON.parse(VALIDOS[i]))), `los ${VALIDOS.length} bien formados valen, y su tamaño en la base es el que calcula la app`);
  const rm = []; let errores = 0;
  for (const j of MALFORMADOS) { try { rm.push((await q(`select analisis_valido($1::jsonb) ok`, [j]))[0].ok); } catch { errores++; } }
  check(MALFORMADOS.length >= 20 && !errores && rm.every((x) => x === false), `los ${MALFORMADOS.length} mal formados dan false, nunca un error (${rm.filter((x) => x !== false).length} no)`);
  check((await q(`select analisis_valido(null) a, analisis_num('"1"'::jsonb, 0, 2) b, analisis_num('1'::jsonb, 0, 2) c, analisis_num(null, 0, 2) d`)).every((x) => x.a === false && x.b === false && x.c === true && x.d === false),
    'null y los números que no lo son, false');
  check((await q(`select analisis_valido('{"v":1,"barra":{"p":[[0,0.5,0.5],[0.1,0.5,1e-400]]}}') a, analisis_num('1e-400'::jsonb, 0, 1) b, analisis_num('1e400'::jsonb, 0, 3600) c,
    analisis_num('0.1234'::jsonb, 0, 1) d, analisis_num('1.5e-3'::jsonb, 0, 1) e, analisis_num('0.12345'::jsonb, 0, 1) f`)).every((x) => !x.a && !x.b && !x.c && x.d && x.e && !x.f),
    '(revisión, L2) con 4 decimales como mucho y sin exponentes extremos (1e-400, que la app ya leería como 0; 1e400), sin errores');
  // El coach lo guarda; Ana lo lee con video_correcciones(); Luis, no
  await como(ana);
  const v = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'a'), duracion_seg: 6, mime: 'video/webm', bytes: 1000 });
  const otro = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'b'), duracion_seg: 6, mime: 'video/webm', bytes: 1000 });
  const analisis = JSON.parse(VALIDOS[2]);
  check(await falla(`insert into video_revisiones (archivo_id, atleta_id, analisis) values ($1, $2, $3)`, [v.id, aAna.id, JSON.stringify(analisis)]), 'Ana no guarda un análisis (ni en su vídeo)');
  await como(pelayo, 'aal2');
  check(await falla(`insert into video_revisiones (archivo_id, atleta_id, analisis) values ($1, $2, $3)`, [v.id, aAna.id, MALFORMADOS[12]])
    && await falla(`insert into video_revisiones (archivo_id, atleta_id, analisis) values ($1, $2, $3)`, [v.id, aAna.id, JSON.stringify({ v: 1, barra: { p: [[0, 0.5, 0.5], [7.5, 0.5, 0.5]] } })])
    && await falla(`insert into video_revisiones (archivo_id, atleta_id, analisis) values ($1, $2, $3)`, [v.id, aAna.id, JSON.stringify({ v: 1, pose: { lado: 'izq', reps: [{ t: [0, 8], rodilla: 90 }] } })]),
    'uno mal formado, o que se sale del vídeo (6 s; la trayectoria o la pose después del 0:07), no se guarda');
  await q(`insert into video_revisiones (archivo_id, atleta_id, analisis) values ($1, $2, $3)`, [v.id, aAna.id, JSON.stringify(analisis)]);
  const [r1] = await q(`select analisis, corregido_en, actualizado_en::text a from video_revisiones where archivo_id = $1`, [v.id]);
  check(r1.analisis?.reps?.[0]?.vm === 0.52 && r1.corregido_en && (await notis(`clave = $1`, ['video:' + v.id])).length === 1, 'el coach lo guarda: cuenta como corregir (a Ana le llega «ha corregido tu vídeo», una vez)');
  await como(pelayo, 'aal2');
  await q(`update video_revisiones set analisis = $2 where archivo_id = $1`, [v.id, JSON.stringify({ ...analisis, reps: [{ ...analisis.reps[0], vm: 0.6 }] })]);
  const [r2] = await q(`select actualizado_en::text a from video_revisiones where archivo_id = $1`, [v.id]);
  await q(`update video_revisiones set puntuacion = puntuacion where archivo_id = $1`, [v.id]);
  check(r2.a !== r1.a && (await q(`select actualizado_en::text a from video_revisiones where archivo_id = $1`, [v.id]))[0].a === r2.a && (await notis(`clave = $1`, ['video:' + v.id])).length === 1,
    'cambiarlo mueve su fecha de cambio (y no vuelve a avisar); tocar otra cosa sin cambiarla, no');
  await como(ana);
  const leida = await q(`select * from video_correcciones($1)`, [[v.id, otro.id]]);
  check(leida.length === 1 && leida[0].analisis?.reps?.[0]?.vm === 0.6 && leida[0].analisis.pose.lado === 'izq' && !Object.keys(leida[0]).some((k) => /_en$/.test(k))
    && (await q(`select * from video_revisiones`)).length === 0, 'Ana lo lee del suyo con video_correcciones() (sin horas), nunca de la tabla');
  check((await q(`update video_revisiones set analisis = null where archivo_id = $1 returning 1`, [v.id])).length === 0 && await falla(`delete from video_revisiones where archivo_id = $1`, [v.id]) === false
    && (await q(`select analisis is not null x from video_correcciones($1)`, [[v.id]]))[0].x, 'ni lo quita ni lo cambia');
  await como(luis);
  check((await q(`select * from video_correcciones($1)`, [[v.id]])).length === 0, 'Luis no ve el análisis del vídeo de Ana');
  await anon();
  check(await falla(`select * from video_correcciones($1)`, [[v.id]]) && await falla(`select analisis_valido('{}'::jsonb)`), 'sin sesión, nada');
  // Quitarlo; y si el vídeo pasa a otro atleta, va con él
  await como(pelayo, 'aal2');
  await q(`update video_revisiones set analisis = null where archivo_id = $1`, [v.id]);
  check((await q(`select analisis from video_revisiones where archivo_id = $1`, [v.id]))[0].analisis === null, 'el coach lo quita de la corrección');
  await q(`update video_revisiones set analisis = $2 where archivo_id = $1`, [v.id, VALIDOS[0]]);
  await q(`update archivos set atleta_id = $2, ruta = $3 where id = $1`, [v.id, aLuis.id, ruta(aLuis.id, 'movido')]);
  await como(luis);
  check((await q(`select analisis from video_correcciones($1)`, [[v.id]]))[0]?.analisis?.barra?.p?.length === 2, 'si el coach pasa el vídeo a Luis, el análisis va con él');
  await su();
  await q(`delete from archivos where ruta like '%/v058-%'`);
  // La 036 sin la 035, y sobre una base que ya va por delante
  const sin35 = new PGlite();
  await sin35.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin35.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '035')) await sin35.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  const sql36 = readFileSync(new URL('../supabase/migraciones/036_videos_analisis.sql', import.meta.url), 'utf8');
  let err36 = null;
  try { await sin35.exec(sql36); } catch (e) { err36 = e.message; }
  check(/Antes de la 036 hace falta la 035/.test(err36 || '') && !(await sin35.query(`select 1 from information_schema.columns where table_name = 'video_revisiones' and column_name = 'analisis'`)).rows.length,
    'la 036 no se aplica sin la 035 (y no deja nada a medias)');
  await sin35.exec(readFileSync(new URL('../supabase/migraciones/035_videos_tecnica.sql', import.meta.url), 'utf8'));
  await sin35.exec(`insert into public.fbe_migraciones (numero) values (37)`);
  let err37 = null;
  try { await sin35.exec(sql36); } catch (e) { err37 = e.message; }
  check(/ya tiene la migración 037/.test(err37 || ''), 'ni en una base que ya tiene una posterior');
  await sin35.close();
}

console.log('\nLos vídeos de técnica, tanda A (migración 037)');
{
  const insArch = async (f) => (await q(`insert into archivos (${Object.keys(f).join(',')}) values (${Object.keys(f).map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(f)))[0];
  const ruta = (atleta, x) => `${atleta}/v059-${x}-${Math.random().toString(36).slice(2, 8)}.mp4`;
  const HORAS = /^(timestamptz|timestamp|time|timetz|interval)$/;
  const tiposDe = async (f) => (await q(`select t.typname from pg_proc p, unnest(p.proallargtypes) a(oid) join pg_type t on t.oid = a.oid where p.proname = $1 and p.pronamespace = 'public'::regnamespace`, [f])).map((x) => x.typname);
  await su();
  await q(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await q(`update consentimientos set revocado_en = null where perfil_id = $1 and tipo = 'datos_salud'`, [ana]);
  await q(`insert into consentimientos (perfil_id, tipo, version) select $1, 'datos_salud', '2026-10' where not exists (select 1 from consentimientos where perfil_id = $1 and tipo = 'datos_salud' and revocado_en is null)`, [ana]);
  await q(`delete from fbe_privado.storage_por_borrar`);
  await q(`delete from chat_cupos`);
  // La forma: tablas con permisos por fila, nada para anon, funciones con search_path vacío
  const tablas = ['recordatorios_tecnica', 'frases_correccion', 'videos_modelo', 'video_autoevaluacion'];
  check((await q(`select relname from pg_class where relname = any($1) and relrowsecurity and relnamespace = 'public'::regnamespace`, [tablas])).length === 4, 'las cuatro tablas nuevas nacen con permisos por fila');
  check((await q(`select 1 from information_schema.role_table_grants where table_name = any($1) and grantee in ('anon', 'PUBLIC')`, [tablas])).length === 0
    && (await q(`select count(distinct table_name)::int n from information_schema.role_table_grants where table_name = any($1) and grantee = 'authenticated' and privilege_type = 'SELECT'`, [tablas]))[0].n === 4,
    'sin sesión, ningún permiso sobre ellas (la app, los suyos a mano)');
  const pol = Object.fromEntries((await q(`select tablename t, count(*)::int n from pg_policies where tablename = any($1) group by 1`, [tablas])).map((x) => [x.t, x.n]));
  check(pol.recordatorios_tecnica === 1 && pol.frases_correccion === 1 && pol.videos_modelo === 1 && pol.video_autoevaluacion === 5 && (await q(`select count(*)::int n from pg_policies where tablename = 'video_revisiones'`))[0].n === 1,
    'políticas: el coach en recordatorios, frases y vídeos modelo (el atleta, ninguna); la valoración, el coach la lee y el atleta la suya; la corrección, como estaba');
  const nuevas = ['recordatorio_preparar', 'recordatorios_activos', 'frase_preparar', 'video_modelo_preparar', 'video_modelo_borrado', 'video_modelo_visible', 'videos_modelo_de', 'video_autoevaluacion_preparar', 'chat_gastar_cupo', 'reps_manual_validas', 'video_revision_reps', 'al_mover_archivo'];
  const malos = await q(`select p.oid::regprocedure::text f from pg_proc p where p.pronamespace in ('public'::regnamespace, 'fbe_privado'::regnamespace) and p.proname = any($1) and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))`, [nuevas]);
  check(!malos.length && (await q(`select count(*)::int n from pg_proc where proname = any($1)`, [nuevas]))[0].n === nuevas.length, `las funciones nuevas y las que cambia la 037, con search_path vacío${malos.length ? ` (no: ${malos.map((x) => x.f).join(', ')})` : ''}`);
  const definer = Object.fromEntries((await q(`select proname, prosecdef from pg_proc where proname = any($1)`, [nuevas])).map((x) => [x.proname, x.prosecdef]));
  check(definer.recordatorios_activos && definer.videos_modelo_de && definer.video_modelo_visible && definer.video_autoevaluacion_preparar && definer.al_mover_archivo && !definer.recordatorio_preparar && !definer.reps_manual_validas,
    'lo que lee por encima de los permisos (recordatorios_activos, videos_modelo_de, la política de Storage, la valoración y pasar un vídeo), con los permisos de su dueño; lo demás, sin');
  check(!(await q(`select has_function_privilege('anon', 'public.recordatorios_activos(uuid)', 'execute') a, has_function_privilege('anon', 'public.videos_modelo_de(uuid[])', 'execute') b`)).some((x) => x.a || x.b)
    && !(await q(`select has_function_privilege('authenticated', 'fbe_privado.al_mover_archivo()', 'execute') x`))[0].x, 'sin sesión no se llaman; lo interno, tampoco desde la app');
  check(!(await tiposDe('recordatorios_activos')).some((x) => HORAS.test(x)) && !(await tiposDe('videos_modelo_de')).some((x) => HORAS.test(x)), 'recordatorios_activos y videos_modelo_de no devuelven ninguna hora');
  check((await q(`select pg_get_function_result('public.video_correcciones(uuid[])'::regprocedure) r`))[0].r.includes('analisis jsonb') && !(await tiposDe('video_correcciones')).some((x) => HORAS.test(x)),
    'video_correcciones() sigue como en la 036 (con el análisis y sin horas)');

  // Lo que hace falta: un ejercicio, los vídeos de Ana y uno de Luis
  await como(pelayo, 'aal2');
  const [sent] = await q(`insert into ejercicios (nombre, grupos_musculares) values ('Sentadilla v059', '{cuadriceps,gluteo}') returning id`);
  await como(ana);
  const va = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'a'), ejercicio_id: sent.id, duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  const vb = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'b'), ejercicio_id: sent.id, duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  await como(luis);
  const vl = await insArch({ atleta_id: aLuis.id, tipo: 'video_tecnica', ruta: ruta(aLuis.id, 'l'), ejercicio_id: sent.id, duracion_seg: 6, mime: 'video/mp4', bytes: 1000 });

  console.log('  · 14. Recordatorios de técnica');
  await como(ana);
  check(await falla(`insert into recordatorios_tecnica (atleta_id, ejercicio_id, texto) values ($1, $2, 'Me lo pongo yo')`, [aAna.id, sent.id]), 'Ana no se pone recordatorios');
  await como(pelayo, 'aal2');
  const ins = (t, extra = {}) => q(`insert into recordatorios_tecnica (atleta_id, ejercicio_id, texto, archivo_id, segundo, activo) values ($1, $2, $3, $4, $5, $6) returning *`,
    [extra.atleta ?? aAna.id, extra.ejercicio ?? sent.id, t, extra.archivo ?? null, extra.segundo ?? null, extra.activo ?? true]);
  const [r1] = await ins('  Rodillas   hacia fuera al bajar ', { archivo: va.id, segundo: 2.5 });
  check(r1.texto === 'Rodillas hacia fuera al bajar' && Number(r1.segundo) === 2.5 && r1.activo, 'el coach fija uno para Ana (sin espacios de más), con su vídeo y su momento');
  await ins('Pecho arriba', { archivo: va.id }); await ins('Aire antes de bajar');
  check(await falla(`insert into recordatorios_tecnica (atleta_id, ejercicio_id, texto) values ($1, $2, 'El cuarto')`, [aAna.id, sent.id]), 'como mucho 3 activos por atleta y ejercicio');
  const [r4] = await ins('Uno guardado sin activar', { activo: false });
  check(r4 && await falla(`update recordatorios_tecnica set activo = true where id = $1`, [r4.id]), 'uno sin activar se guarda, pero no se activa si ya hay 3');
  const [adjL] = await q(`insert into archivos (atleta_id, tipo, ruta, mime, bytes) values ($1, 'adjunto', $2, 'image/jpeg', 100) returning id`, [aLuis.id, `${aLuis.id}/v059-adj-${Math.random().toString(36).slice(2, 8)}.jpg`]);
  check(await falla(`insert into recordatorios_tecnica (atleta_id, ejercicio_id, texto, archivo_id) values ($1, $2, 'Con el vídeo de Luis', $3)`, [aAna.id, sent.id, vl.id])
    && await falla(`insert into recordatorios_tecnica (atleta_id, ejercicio_id, texto, archivo_id) values ($1, $2, 'Con una foto', $3)`, [aLuis.id, sent.id, adjL.id])
    && await falla(`insert into recordatorios_tecnica (atleta_id, ejercicio_id, texto, segundo) values ($1, $2, 'Momento sin vídeo', 2)`, [aLuis.id, sent.id])
    && await falla(`insert into recordatorios_tecnica (atleta_id, ejercicio_id, texto) values ($1, $2, $3)`, [aLuis.id, sent.id, 'x'.repeat(141)])
    && await falla(`insert into recordatorios_tecnica (atleta_id, ejercicio_id, texto) values ($1, $2, '​ ')`, [aLuis.id, sent.id])
    && await falla(`insert into recordatorios_tecnica (atleta_id, ejercicio_id, texto, archivo_id, segundo) values ($1, $2, 'Fuera', $3, 3601)`, [aLuis.id, sent.id, vl.id]),
    'el vídeo, de técnica y de ese atleta; un momento, solo con su vídeo y de 0 a 3600 s; el texto, de 1 a 140 letras visibles');
  check(await falla(`update recordatorios_tecnica set atleta_id = $2 where id = $1`, [r1.id, aLuis.id]) && await falla(`update recordatorios_tecnica set ejercicio_id = $2 where id = $1`, [r1.id, press.id]),
    'no cambia de atleta ni de ejercicio');
  const [r1b] = await q(`update recordatorios_tecnica set texto = 'Rodillas fuera', creado_en = '2020-01-01' where id = $1 returning *`, [r1.id]);
  check(r1b.texto === 'Rodillas fuera' && r1b.creado_en > new Date('2021-01-01') && r1b.actualizado_en >= r1.actualizado_en, 'el coach lo cambia (las fechas las pone la base)');
  await como(ana);
  const deAna = await q(`select * from recordatorios_activos($1)`, [aAna.id]);
  check(deAna.length === 3 && deAna.every((r) => !Object.keys(r).some((k) => /_en$/.test(k))) && deAna.find((r) => r.id === r1.id)?.archivo_id === va.id && Number(deAna.find((r) => r.id === r1.id).segundo) === 2.5
    && (await q(`select * from recordatorios_tecnica`)).length === 0, 'Ana lee sus 3 activos con recordatorios_activos() (sin horas, con su vídeo y su momento), nunca de la tabla');
  check((await q(`update recordatorios_tecnica set texto = 'Mío' where id = $1 returning 1`, [r1.id])).length === 0 && (await q(`delete from recordatorios_tecnica where id = $1 returning 1`, [r1.id])).length === 0
    && (await q(`select * from recordatorios_activos($1)`, [aLuis.id])).length === 0, 'ni los cambia, ni los borra, ni lee los de otro');
  await como(luis);
  check((await q(`select * from recordatorios_activos($1)`, [aAna.id])).length === 0 && (await q(`select * from recordatorios_tecnica`)).length === 0, 'Luis no ve los de Ana');
  await como(intruso);
  check(await falla(`select * from recordatorios_activos($1)`, [aAna.id]), 'una cuenta sin ficha, tampoco');
  await anon();
  check(await falla(`select * from recordatorios_activos($1)`, [aAna.id]) && await falla(`select * from recordatorios_tecnica`), 'sin sesión, nada');
  await como(pelayo, 'aal2');
  await q(`update recordatorios_tecnica set activo = false where id = $1`, [r1.id]);
  await como(ana);
  check((await q(`select * from recordatorios_activos($1)`, [aAna.id])).length === 2, 'el coach lo quita (lo desactiva) y Ana deja de verlo');
  await como(pelayo, 'aal2');

  console.log('  · 4. Frases de corrección');
  const dib = JSON.stringify({ t: 0, hasta: 1.5, formas: [{ tipo: 'flecha', p: [[0.2, 0.2], [0.5, 0.5]], c: 'rojo' }] });
  const [f1] = await q(`insert into frases_correccion (ejercicio_id, texto, dibujo, orden) values ($1, '  Rodillas  fuera ', $2, 1) returning *`, [sent.id, dib]);
  const [f2] = await q(`insert into frases_correccion (texto) values ('Muy bien: así') returning *`);
  check(f1.texto === 'Rodillas fuera' && f1.dibujo?.formas?.length === 1 && f2.ejercicio_id === null, 'el coach guarda frases (de un ejercicio, con un dibujo ya hecho, o para todos)');
  check(await falla(`insert into frases_correccion (texto, dibujo) values ('Mal dibujo', '{"t":0,"formas":[]}')`) && await falla(`insert into frases_correccion (texto) values ($1)`, ['x'.repeat(141)])
    && await falla(`insert into frases_correccion (texto) values ('')`) && await falla(`insert into frases_correccion (texto, orden) values ('Orden', 1000)`), 'el dibujo, válido (dibujo_valido); el texto, de 1 a 140; el orden, de 0 a 999');
  for (let i = 0; i < 39; i++) await q(`insert into frases_correccion (ejercicio_id, texto) values ($1, $2)`, [sent.id, `Frase ${i}`]);
  check(await falla(`insert into frases_correccion (ejercicio_id, texto) values ($1, 'La 41')`, [sent.id]), 'como mucho 40 por ejercicio');
  await q(`delete from frases_correccion where texto like 'Frase %'`);
  await como(ana);
  check((await q(`select * from frases_correccion`)).length === 0 && await falla(`insert into frases_correccion (texto) values ('Mía')`) && (await q(`update frases_correccion set texto = 'x' returning 1`)).length === 0, 'el atleta ni las ve ni las escribe');
  await anon();
  check(await falla(`select * from frases_correccion`), 'sin sesión, nada');

  console.log('  · 6. Vídeos modelo');
  await como(pelayo, 'aal2');
  const rm = (x = 'demo1234') => `modelos/${sent.id}/modelo-${x}.mp4`;
  const [m1] = await q(`insert into videos_modelo (ejercicio_id, ruta, poster_ruta, duracion_seg, mime, bytes, angulo) values ($1, $2, $3, 6, 'video/mp4', 5000, '  De  lado ') returning *`, [sent.id, rm(), `${rm()}.jpg`]);
  check(m1.angulo === 'De lado' && m1.ruta === rm(), 'el coach registra su vídeo modelo de la sentadilla (en modelos/<ejercicio>/)');
  check(await falla(`insert into videos_modelo (ejercicio_id, ruta) values ($1, $2)`, [sent.id, `modelos/${press.id}/modelo-otro12345.mp4`])
    && await falla(`insert into videos_modelo (ejercicio_id, ruta) values ($1, $2)`, [sent.id, `modelos/${sent.id}/../modelo-xx123456.mp4`])
    && await falla(`insert into videos_modelo (ejercicio_id, ruta) values ($1, $2)`, [sent.id, `${aAna.id}/modelo-abcdef12.mp4`])
    && await falla(`insert into videos_modelo (ejercicio_id, ruta, poster_ruta) values ($1, $2, 'otra.jpg')`, [sent.id, rm('poster12')])
    && await falla(`insert into videos_modelo (ejercicio_id, ruta, mime) values ($1, $2, 'text/html')`, [sent.id, rm('mime1234')])
    && await falla(`insert into videos_modelo (ejercicio_id, ruta, duracion_seg) values ($1, $2, 601)`, [sent.id, rm('larga123')])
    && await falla(`insert into videos_modelo (ejercicio_id, ruta) values ($1, $2)`, [sent.id, rm()]),
    'la ruta, en la carpeta de su ejercicio y con su forma (sin «..»); su miniatura, al lado; solo vídeo; hasta 10 min; sin repetir');
  check(await falla(`update videos_modelo set ruta = $2 where id = $1`, [m1.id, rm('cambio12')]) && (await q(`update videos_modelo set angulo = 'De frente', orden = 2 where id = $1 returning angulo`, [m1.id]))[0].angulo === 'De frente',
    'de uno subido solo cambian el ángulo, el orden y la duración');
  for (let i = 2; i <= 6; i++) await q(`insert into videos_modelo (ejercicio_id, ruta) values ($1, $2)`, [sent.id, rm(`otro${i}xyz`)]);
  check(await falla(`insert into videos_modelo (ejercicio_id, ruta) values ($1, $2)`, [sent.id, rm('elsiete7')]), 'como mucho 6 por ejercicio');
  await q(`delete from videos_modelo where ruta like '%/modelo-otro%'`);
  await su(); await q(`delete from fbe_privado.storage_por_borrar`); await como(pelayo, 'aal2');
  // En Storage: el coach lo sube; los atletas vinculados lo ven (y su miniatura); nada más de modelos/
  await q(`insert into storage.objects (bucket_id, name) values ('archivos', $1), ('archivos', $2), ('archivos', $3), ('archivos', 'coach/privado.jpg')`, [rm(), `${rm()}.jpg`, `modelos/${sent.id}/modelo-sinregistro.mp4`]);
  await como(ana);
  const vistos = (await q(`select name from storage.objects where bucket_id = 'archivos' and (name like 'modelos/%' or name like 'coach/%') order by name`)).map((x) => x.name);
  check(vistos.length === 2 && vistos.includes(rm()) && vistos.includes(`${rm()}.jpg`), `Ana ve el vídeo modelo y su miniatura en Storage, y nada más de modelos/ ni del coach (${vistos.length})`);
  const deModelo = await q(`select * from videos_modelo_de($1)`, [[sent.id, press.id]]);
  check(deModelo.length === 1 && deModelo[0].ruta === rm() && !Object.keys(deModelo[0]).some((k) => /_en$/.test(k)) && (await q(`select * from videos_modelo`)).length === 0,
    'y lo lista con videos_modelo_de() (sin horas), nunca de la tabla');
  check(await falla(`insert into videos_modelo (ejercicio_id, ruta) values ($1, $2)`, [sent.id, rm('mio12345')]) && await falla(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [rm('subo1234')])
    && (await q(`delete from storage.objects where name = $1 returning 1`, [rm()])).length === 0 && (await q(`update videos_modelo set angulo = 'x' returning 1`)).length === 0,
    'no registra, ni sube, ni borra, ni cambia vídeos modelo');
  check(await falla(`select * from videos_modelo_de($1)`, [Array.from({ length: 201 }, () => sent.id)]), 'como mucho 200 ejercicios por vez');
  await su();
  await q(`update atletas set estado = 'baja' where id = $1`, [aLuis.id]);
  await como(luis);
  check((await q(`select * from videos_modelo_de($1)`, [[sent.id]])).length === 0 && (await q(`select name from storage.objects where name like 'modelos/%'`)).length === 0, 'un atleta de baja ya no los ve');
  await su();
  await q(`update atletas set estado = 'activo' where id = $1`, [aLuis.id]);
  await como(intruso);
  check(await falla(`select * from videos_modelo_de($1)`, [[sent.id]]) && (await q(`select name from storage.objects where name like 'modelos/%'`)).length === 0, 'una cuenta sin ficha, tampoco');
  await anon();
  check(await falla(`select * from videos_modelo_de($1)`, [[sent.id]]) && await falla(`select * from videos_modelo`), 'sin sesión, nada');
  // Borrarlo: a la cola de Storage, y esa ruta no vuelve
  await como(pelayo, 'aal2');
  await q(`delete from videos_modelo where id = $1`, [m1.id]);
  await su();
  const cola = (await q(`select ruta, bucket from fbe_privado.storage_por_borrar where ruta like 'modelos/%' order by ruta`));
  check(cola.length === 2 && cola.every((x) => x.bucket === 'archivos') && cola.some((x) => x.ruta === rm()), 'al borrarlo, su vídeo y su miniatura van a la cola de Storage');
  await como(pelayo, 'aal2');
  check(await falla(`insert into videos_modelo (ejercicio_id, ruta) values ($1, $2)`, [sent.id, rm()]), 'y su ruta no se vuelve a registrar mientras espera');
  await como(ana);
  check((await q(`select name from storage.objects where name = $1`, [rm()])).length === 0, 'Ana deja de verlo en Storage');
  await su();
  await q(`delete from storage.objects where name like 'modelos/%' or name = 'coach/privado.jpg'`); await q(`delete from fbe_privado.storage_por_borrar`);
  await como(pelayo, 'aal2');
  const [m2] = await q(`insert into videos_modelo (ejercicio_id, ruta) values ($1, $2) returning id`, [sent.id, rm('borrarej')]);
  const [ejB] = await q(`insert into ejercicios (nombre, grupos_musculares) values ('Ejercicio v059 que se borra', '{espalda}') returning id`);
  await q(`insert into videos_modelo (ejercicio_id, ruta) values ($1, $2)`, [ejB.id, `modelos/${ejB.id}/modelo-cascada1.mp4`]);
  await q(`delete from ejercicios where id = $1`, [ejB.id]);
  await su();
  check((await q(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [`modelos/${ejB.id}/modelo-cascada1.mp4`])).length === 1 && m2, 'si se borra el ejercicio, sus vídeos modelo también van a la cola');
  await q(`delete from fbe_privado.storage_por_borrar`);

  console.log('  · 12. La valoración del atleta');
  await como(ana);
  const [a1] = await q(`insert into video_autoevaluacion (archivo_id, atleta_id, rpe, nota, molestia, zona) values ($1, $2, 8.5, '  En la última se me van las rodillas ', true, 'rodilla') returning *`, [va.id, aLuis.id]);
  check(a1.atleta_id === aAna.id && Number(a1.rpe) === 8.5 && a1.nota === 'En la última se me van las rodillas' && a1.molestia === true && a1.zona === 'rodilla', 'Ana valora su vídeo (RPE, lo que nota y una molestia en la rodilla), a su nombre aunque mande otro atleta');
  const [a1b] = await q(`update video_autoevaluacion set molestia = false, zona = 'rodilla' where archivo_id = $1 returning *`, [va.id]);
  check(a1b.molestia === false && a1b.zona === null, 'y la cambia (sin molestia, sin zona)');
  const malasAuto = [['rpe', 5.5], ['rpe', 10.5], ['rpe', 7.25], ['nota', 'x'.repeat(281)], ['nota', '​'], ['zona', 'pie']];
  let rechazadas = 0;
  for (const [c, v] of malasAuto) if (await falla(`update video_autoevaluacion set ${c} = $2, molestia = true where archivo_id = $1`, [va.id, v])) rechazadas++;
  check(rechazadas === malasAuto.length && await falla(`insert into video_autoevaluacion (archivo_id) values ($1)`, [vb.id]) && await falla(`insert into video_autoevaluacion (archivo_id, rpe) values ($1, 8)`, [adjL.id]),
    'el RPE, de 6 a 10 de medio en medio; lo que nota, hasta 280 letras visibles; la zona, de la lista; algo que contar; y de un vídeo de técnica');
  check(await falla(`insert into video_autoevaluacion (archivo_id, rpe) values ($1, 8)`, [vl.id]), 'no valora un vídeo de Luis');
  // (revisión, L4) El mismo error para un vídeo de otro, algo que no es un vídeo de técnica o un id que no existe
  await su();
  const [adjA] = await q(`insert into archivos (atleta_id, tipo, ruta, mime, bytes) values ($1, 'adjunto', $2, 'image/jpeg', 100) returning id`, [aAna.id, `${aAna.id}/v059-adjA-${Math.random().toString(36).slice(2, 8)}.jpg`]);
  await como(ana);
  const errsL4 = [];
  for (const id of [vl.id, adjA.id, adjL.id, '00000000-0000-4000-8000-000000000059']) errsL4.push(await mensaje(`insert into video_autoevaluacion (archivo_id, rpe) values ($1, 8)`, [id]));
  check(errsL4.every((m) => m === errsL4[0]) && /Solo valoras tus vídeos de técnica/.test(errsL4[0] || ''), `(L4) el mismo error para el vídeo de Luis, una foto suya o de Luis y un id que no existe (no se sabe cuál es: ${errsL4[0]})`);
  await su(); await q(`delete from archivos where id = $1`, [adjA.id]);
  await como(ana);
  // La molestia es un dato de salud: sin su consentimiento, no
  await q(`update consentimientos set revocado_en = now() where perfil_id = $1 and tipo = 'datos_salud' and revocado_en is null`, [ana]);
  check(await falla(`insert into video_autoevaluacion (archivo_id, molestia) values ($1, true)`, [vb.id]) && await falla(`insert into video_autoevaluacion (archivo_id, rpe, molestia) values ($1, 8, false)`, [vb.id])
    && (await q(`insert into video_autoevaluacion (archivo_id, rpe, nota) values ($1, 8, 'Bien') returning molestia`, [vb.id]))[0].molestia === null
    && (await q(`update video_autoevaluacion set nota = 'Muy bien' where archivo_id = $1 returning nota`, [va.id]))[0].nota === 'Muy bien',
    'sin consentimiento de datos de salud no cuenta molestias (ni «no»); el esfuerzo y lo que nota, sí (y lo de antes no se toca)');
  await su();
  await q(`update consentimientos set revocado_en = null where perfil_id = $1 and tipo = 'datos_salud'`, [ana]);
  await como(pelayo, 'aal2');
  check((await q(`select * from video_autoevaluacion where archivo_id = $1`, [va.id]))[0]?.nota === 'Muy bien', 'el coach la lee');
  check(await falla(`insert into video_autoevaluacion (archivo_id, rpe) values ($1, 7)`, [vl.id]) && (await q(`update video_autoevaluacion set rpe = 6 where archivo_id = $1 returning 1`, [va.id])).length === 0
    && (await q(`delete from video_autoevaluacion where archivo_id = $1 returning 1`, [va.id])).length === 0, 'pero no la escribe, ni la cambia, ni la borra (es del atleta)');
  await como(luis);
  check((await q(`select * from video_autoevaluacion`)).length === 0 && (await q(`update video_autoevaluacion set rpe = 6 returning 1`)).length === 0, 'Luis no ve ni toca la de Ana');
  await anon();
  check(await falla(`select * from video_autoevaluacion`), 'sin sesión, nada');
  // Hasta que el coach lo revisa o lo corrige
  await como(pelayo, 'aal2');
  await q(`update archivos set revisado_en = now() where id = $1`, [vb.id]);
  await como(ana);
  check(await falla(`update video_autoevaluacion set rpe = 9 where archivo_id = $1`, [vb.id]), 'revisado el vídeo, ya no la cambia');
  await como(pelayo, 'aal2');
  await q(`update archivos set revisado_en = null where id = $1`, [vb.id]);
  await q(`insert into video_revisiones (archivo_id, atleta_id, puntuacion) values ($1, $2, 3)`, [vb.id, aAna.id]);
  await como(ana);
  check(await falla(`update video_autoevaluacion set rpe = 9 where archivo_id = $1`, [vb.id]) && (await q(`delete from video_autoevaluacion where archivo_id = $1 returning 1`, [vb.id])).length === 1,
    'corregido, tampoco (pero quitarla, siempre)');
  // Con su cupo por hora (el del chat): 30 cambios
  await su(); await q(`delete from chat_cupos`);
  await como(ana);
  let hechos = 0, msg = '';
  for (let i = 0; i < 35; i++) { try { await q(`update video_autoevaluacion set rpe = $2 where archivo_id = $1`, [va.id, i % 2 ? 7 : 8]); hechos++; } catch (e) { msg = e.message; break; } }
  check(hechos === 30 && /valoración en la última hora/.test(msg), `con su cupo: 30 cambios por hora (${hechos})`);
  // (revisión, L1) Como lo guarda la app (upsert): cada uno cuenta una vez (antes, el INSERT y el UPDATE contaban dos)
  await su(); await q(`delete from chat_cupos`);
  await como(ana);
  let ups = 0, msgU = '';
  for (let i = 0; i < 31; i++) {
    try { await q(`insert into video_autoevaluacion (archivo_id, rpe) values ($1, $2) on conflict (archivo_id) do update set rpe = excluded.rpe`, [va.id, i % 2 ? 7 : 8]); ups++; } catch (e) { msgU = e.message; break; }
  }
  await su();
  check(ups === 30 && /valoración en la última hora/.test(msgU) && (await q(`select count(*)::int n from chat_cupos where perfil_id = $1 and tipo = 'autoevaluacion'`, [ana]))[0].n === 30,
    `(L1) 30 «upserts» pasan y el 31.º no (${ups}); cada uno cuenta una vez`);
  await su(); await q(`delete from chat_cupos`);
  await como(ana);
  const rpeAhora = (await q(`select rpe from video_autoevaluacion where archivo_id = $1`, [va.id]))[0].rpe;
  for (let i = 0; i < 3; i++) await q(`update video_autoevaluacion set rpe = $2 where archivo_id = $1`, [va.id, rpeAhora]);
  await q(`insert into video_autoevaluacion (archivo_id, rpe) values ($1, $2) on conflict (archivo_id) do update set rpe = excluded.rpe`, [va.id, rpeAhora]);
  await su();
  check((await q(`select count(*)::int n from chat_cupos where perfil_id = $1 and tipo = 'autoevaluacion'`, [ana]))[0].n === 0, '(L1) guardar lo mismo que había no cuenta');
  await su(); await q(`delete from chat_cupos`);
  await q(`update atletas set estado = 'baja' where id = $1`, [aAna.id]);
  await como(ana);
  check(await falla(`update video_autoevaluacion set rpe = 9 where archivo_id = $1`, [va.id]), 'de baja, tampoco');
  await su();
  await q(`update atletas set estado = 'activo' where id = $1`, [aAna.id]);

  console.log('  · 15. Las marcas de repetición a mano (reps_manual_validas)');
  const VALIDAS = ['{"t":[0]}', '{"t":[0.4,2.3,4.3]}', '{"t":[1.2345,3600]}', JSON.stringify({ t: Array.from({ length: 30 }, (_, i) => i * 2) })];
  const MALAS = ['null', '[]', '{}', '"t"', '1', 'true', '{"t":[]}', '{"t":null}', '{"t":{}}', '{"t":"1"}', '{"t":["1"]}', '{"t":[true]}', '{"t":[null]}', '{"t":[[1]]}', '{"t":[{"x":1}]}',
    '{"t":[-1]}', '{"t":[3600.5]}', '{"t":[2,1]}', '{"t":[1,1]}', '{"t":[0.12345]}', '{"t":[1e-400]}', '{"t":[1e400]}', '{"t":[1],"x":2}', '{"T":[1]}', JSON.stringify({ t: Array.from({ length: 31 }, (_, i) => i) })];
  const rv = []; for (const j of VALIDAS) rv.push((await q(`select reps_manual_validas($1::jsonb) ok`, [j]))[0].ok);
  const rmx = []; let errs = 0;
  for (const j of MALAS) { try { rmx.push((await q(`select reps_manual_validas($1::jsonb) ok`, [j]))[0].ok); } catch { errs++; } }
  check(rv.every((x) => x === true) && MALAS.length >= 20 && !errs && rmx.every((x) => x === false) && (await q(`select reps_manual_validas(null) x`))[0].x === false,
    `los ${VALIDAS.length} bien formados valen; los ${MALAS.length} mal formados dan false, nunca un error (${rmx.filter((x) => x !== false).length} no)`);
  await como(pelayo, 'aal2');
  await q(`insert into video_revisiones (archivo_id, atleta_id, reps_manual) values ($1, $2, '{"t":[0.5,2.5,4.5]}') on conflict (archivo_id) do update set reps_manual = excluded.reps_manual`, [va.id, aAna.id]);
  const [rr] = await q(`select reps_manual, corregido_en from video_revisiones where archivo_id = $1`, [va.id]);
  check(rr.reps_manual.t.length === 3 && rr.corregido_en === null, 'el coach guarda sus marcas en la corrección (no cuenta como corregir: no avisa)');
  check(await falla(`update video_revisiones set reps_manual = '{"t":[2,1]}' where archivo_id = $1`, [va.id]) && await falla(`update video_revisiones set reps_manual = '{"t":[1,10]}' where archivo_id = $1`, [va.id]),
    'en orden y dentro del vídeo (8 s: nada en el 0:10)');
  await como(ana);
  check(await falla(`update video_revisiones set reps_manual = '{"t":[1]}' where archivo_id = $1`, [va.id]) === false && (await q(`update video_revisiones set reps_manual = '{"t":[1]}' where archivo_id = $1 returning 1`, [va.id])).length === 0
    && (await q(`select * from video_correcciones($1)`, [[va.id]]))[0] && !('reps_manual' in (await q(`select * from video_correcciones($1)`, [[va.id]]))[0]), 'Ana no las cambia (ni las ve: son del coach)');

  console.log('  · Pasar un vídeo a otro atleta: su hilo, su corrección, su voz, su valoración y sus recordatorios');
  await como(ana);
  const vm = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'm'), ejercicio_id: sent.id, duracion_seg: 8, mime: 'video/mp4', bytes: 1000,
    nota_atleta: 'Me molesta la rodilla izquierda al bajar', sesion_ejercicio_id: seAna.id, serie_numero: 2 });
  await q(`update archivos set destacado = true where id = $1`, [vm.id]);
  check((await q(`select nota_atleta, destacado, sesion_ejercicio_id, serie_numero from archivos where id = $1`, [vm.id])).map((x) => `${!!x.nota_atleta}${x.destacado}${x.sesion_ejercicio_id === seAna.id}${x.serie_numero}`).join() === 'truetruetrue2',
    '(antes: el vídeo lleva el pie de Ana, su estrella y la serie de su sesión)');
  const [cA] = await q(`insert into comentarios (atleta_id, archivo_id, texto) values ($1, $2, '¿Está bien la bajada?') returning id`, [aAna.id, vm.id]);
  await q(`insert into video_autoevaluacion (archivo_id, rpe, molestia, zona) values ($1, 9, true, 'zona_lumbar')`, [vm.id]);
  await como(pelayo, 'aal2');
  const [cC] = await q(`insert into comentarios (atleta_id, archivo_id, texto, dibujo) values ($1, $2, 'En 0:02 la espalda se redondea', $3) returning id`, [aAna.id, vm.id, JSON.stringify({ t: 2, formas: [{ tipo: 'linea', p: [[0.1, 0.1], [0.5, 0.5]] }] })]);
  const [voz] = await q(`insert into archivos (atleta_id, tipo, ruta, mime, bytes, duracion_seg) values ($1, 'audio', $2, 'audio/webm', 1000, 5) returning id`, [aAna.id, `${aAna.id}/audio-v059-${Math.random().toString(36).slice(2, 8)}.webm`]);
  await q(`insert into video_revisiones (archivo_id, atleta_id, puntuacion, voz_archivo_id, voz_inicio) values ($1, $2, 3, $3, 0)`, [vm.id, aAna.id, voz.id]);
  const [rmv] = await ins('Espalda neutra al bajar', { archivo: vm.id, segundo: 2 });
  for (const t of ['Luis 1', 'Luis 2', 'Luis 3']) await ins(t, { atleta: aLuis.id });
  await como(ana);
  await q(`update comentarios set leido_en = now() where id = $1`, [cC.id]);
  await q(`insert into comentario_reacciones (comentario_id, emoji) values ($1, '👍')`, [cC.id]);
  await q(`insert into comentario_destacados (comentario_id) values ($1)`, [cC.id]);
  await su();
  check((await notis(`clave = $1 and estado = 'pendiente'`, [`comentario:${cC.id}`])).length + (await notis(`clave = $1`, [`video:${vm.id}`])).length >= 1, '(antes: un aviso pendiente para Ana de lo que le dijo el coach)');
  await como(ana);
  check((await q(`select id from comentarios where archivo_id = $1`, [vm.id])).length === 2 && (await q(`select * from video_correcciones($1)`, [[vm.id]])).length === 1
    && (await q(`select * from recordatorios_activos($1)`, [aAna.id])).some((r) => r.id === rmv.id), '(antes: Ana ve el hilo, la corrección y el recordatorio)');
  await como(pelayo, 'aal2');
  await q(`update archivos set atleta_id = $2, ruta = $3 where id = $1`, [vm.id, aLuis.id, ruta(aLuis.id, 'movido')]);
  await como(ana);
  check((await q(`select id from comentarios where archivo_id = $1 or id = any($2)`, [vm.id, [cA.id, cC.id]])).length === 0, 'Ana ya no lee el hilo del vídeo que el coach ha pasado a Luis (ni lo suyo ni lo del coach)');
  check((await q(`select * from video_correcciones($1)`, [[vm.id]])).length === 0 && (await q(`select 1 from archivos where id in ($1, $2)`, [vm.id, voz.id])).length === 0, 'ni su corrección, ni el vídeo, ni la voz del coach');
  check((await q(`select * from video_autoevaluacion where archivo_id = $1`, [vm.id])).length === 0 && !(await q(`select * from recordatorios_activos($1)`, [aAna.id])).some((r) => r.id === rmv.id || r.archivo_id === vm.id),
    'ni su valoración, ni el recordatorio enlazado a ese vídeo');
  const susVideos = (await q(`select id from archivos where atleta_id = $1 and tipo = 'video_tecnica'`, [aAna.id])).map((x) => x.id);
  check(!susVideos.includes(vm.id) && !(await q(`select archivo_id from video_correcciones($1)`, [susVideos])).some((x) => x.archivo_id === vm.id), 'ni sale entre sus vídeos corregidos («Comparar con su mejor» no puede elegirlo)');
  await su();
  check((await q(`select 1 from comentarios where id = $1`, [cA.id])).length === 0 && (await q(`select atleta_id, leido_en, dibujo from comentarios where id = $1`, [cC.id]))[0]?.atleta_id === aLuis.id
    && (await q(`select leido_en from comentarios where id = $1`, [cC.id]))[0].leido_en === null && (await q(`select dibujo from comentarios where id = $1`, [cC.id]))[0].dibujo?.t === 2,
    'lo que escribió Ana se borra; lo del coach (con su dibujo) pasa a Luis, sin «leído»');
  check((await q(`select 1 from comentario_reacciones where comentario_id = $1`, [cC.id])).length === 0 && (await q(`select 1 from comentario_destacados where comentario_id = $1`, [cC.id])).length === 0
    && (await notis(`estado = 'pendiente' and clave in ($1, $2, $3)`, [`comentario:${cC.id}`, `comentario:${cA.id}`, `video:${vm.id}`])).length === 0, 'sin la reacción ni el destacado de Ana, y sus avisos pendientes se retiran');
  check((await q(`select * from video_autoevaluacion where archivo_id = $1`, [vm.id])).length === 0 && (await q(`select atleta_id, activo from recordatorios_tecnica where id = $1`, [rmv.id]))[0]?.atleta_id === aLuis.id
    && (await q(`select activo from recordatorios_tecnica where id = $1`, [rmv.id]))[0].activo === false && (await q(`select voz_archivo_id, atleta_id from video_revisiones where archivo_id = $1`, [vm.id]))[0].atleta_id === aLuis.id,
    'su valoración se borra; el recordatorio va con el vídeo (sin activar: Luis ya tenía 3) y la corrección, también (sin la voz)');
  const [vmM] = await q(`select atleta_id, nota_atleta, destacado, sesion_ejercicio_id, serie_numero, ejercicio_id from archivos where id = $1`, [vm.id]);
  check(vmM.atleta_id === aLuis.id && vmM.nota_atleta === null, '(M1) el pie que escribió Ana (podía contar algo de su salud) no pasa a Luis');
  check(vmM.destacado === false, '(M1) ni su estrella');
  check(vmM.sesion_ejercicio_id === null && vmM.serie_numero === null && vmM.ejercicio_id === sent.id, '(M1) ni la serie de su sesión (el ejercicio, sí)');
  await como(luis);
  check((await q(`select id from comentarios where archivo_id = $1`, [vm.id])).map((x) => x.id).join() === cC.id && (await q(`select puntuacion from video_correcciones($1)`, [[vm.id]]))[0]?.puntuacion === 3,
    'Luis ve lo del coach en el hilo y la corrección');
  await su();
  await q(`delete from archivos where ruta like '%/v059-%' or ruta like '%/audio-v059-%'`);
  check((await q(`select 1 from video_autoevaluacion`)).length === 0 && (await q(`select 1 from recordatorios_tecnica where archivo_id is not null or segundo is not null`)).length === 0,
    'al borrar los vídeos, su valoración se va y los recordatorios se quedan sin vídeo ni momento');
  await q(`delete from recordatorios_tecnica`); await q(`delete from frases_correccion`); await q(`delete from videos_modelo`); await q(`delete from fbe_privado.storage_por_borrar`); await q(`delete from chat_cupos`);
  await q(`delete from ejercicios where id = $1`, [sent.id]);

  console.log('  · (revisión, M2) El aviso de privacidad con revisiones («2026-12.1»)');
  await su(); await q(`delete from privacidad_vista`);
  check(/\\\.\[1-9\]/.test((await q(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'privacidad_vista_version_valida'`))[0].d), 'la restricción admite «AAAA-MM.n»');
  await como(ana);
  const pvR = async (v) => (await q(`insert into privacidad_vista (version) values ($1) on conflict (usuario_id) do update set version = excluded.version returning version`, [v]))[0].version;
  check(await pvR('2026-12') === '2026-12' && await pvR('2026-12.1') === '2026-12.1', 'Ana pasa de la 2026-12 a la 2026-12.1');
  check(await pvR('2026-12') === '2026-12.1' && await pvR('2026-11') === '2026-12.1', 'nunca hacia atrás (ni a la del mes sin revisión)');
  check(await falla(`update privacidad_vista set version = '2026-12.0'`) && await falla(`update privacidad_vista set version = '2026-12.100'`) && await falla(`update privacidad_vista set version = '2026-12.'`)
    && await falla(`update privacidad_vista set version = '2026-12-1'`) && await falla(`update privacidad_vista set version = '2099-01.1'`), 'solo con su formato (de 1 a 9; con la 043, hasta 99) y nunca de un mes que aún no ha llegado');
  const proximaR = (await q(`select to_char((now() at time zone 'Europe/Madrid') + interval '1 month', 'YYYY-MM') v`))[0].v;
  const pasadaR = (await q(`select to_char((now() at time zone 'Europe/Madrid') + interval '2 month', 'YYYY-MM') v`))[0].v;
  check(await pvR(`${proximaR}.2`) === `${proximaR}.2` && await falla(`update privacidad_vista set version = $1`, [`${pasadaR}.1`]), 'el mes, el de los siete primeros caracteres: hasta el que viene (con su revisión), no después');
  check(await pvR(`${proximaR}.1`) === `${proximaR}.2`, 'y dentro del mismo mes, la revisión tampoco va hacia atrás');
  await su(); await q(`delete from privacidad_vista`);

  console.log('  · La 037 sin la 036, y sobre una base que ya va por delante');
  const sin36 = new PGlite();
  await sin36.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin36.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '036')) await sin36.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  const sql37 = readFileSync(new URL('../supabase/migraciones/037_videos_tanda_a.sql', import.meta.url), 'utf8');
  let e37 = null;
  try { await sin36.exec(sql37); } catch (e) { e37 = e.message; }
  check(/Antes de la 037 hace falta la 036/.test(e37 || '') && !(await sin36.query(`select 1 from pg_class where relname = 'recordatorios_tecnica'`)).rows.length, 'la 037 no se aplica sin la 036 (y no deja nada a medias)');
  const defPv = async () => (await sin36.query(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'privacidad_vista_version_valida'`)).rows[0].d;
  check(!/\\\./.test(await defPv()) && (await sin36.query(`select '2026-12.1' ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' ok`)).rows[0].ok === false,
    '(M2) sin la 037, la base no admite «2026-12.1» (por eso la app, sin la 037, usa la 2026-12)');
  await sin36.exec(readFileSync(new URL('../supabase/migraciones/036_videos_analisis.sql', import.meta.url), 'utf8'));
  await sin36.exec(sql37);
  await sin36.exec(sql37);
  check((await sin36.query(`select count(*)::int n from fbe_migraciones where numero = 37`)).rows[0].n === 1, 'con la 036, se aplica (y se puede repetir: queda apuntada una vez)');
  await sin36.exec(`insert into public.fbe_migraciones (numero) values (38)`);
  let e38 = null;
  try { await sin36.exec(sql37); } catch (e) { e38 = e.message; }
  check(/ya tiene la migración 038/.test(e38 || ''), 'ni en una base que ya tiene una posterior');
  await sin36.close();
}

console.log('\nLos vídeos de técnica, tanda B, primera mitad (migración 038)');
{
  const insArch = async (f) => (await q(`insert into archivos (${Object.keys(f).join(',')}) values (${Object.keys(f).map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(f)))[0];
  const ruta = (atleta, x, ext = 'mp4') => `${atleta}/v060-${x}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const HORAS = /^(timestamptz|timestamp|time|timetz|interval)$/;
  const tiposDe = async (f) => (await q(`select t.typname from pg_proc p, unnest(p.proallargtypes) a(oid) join pg_type t on t.oid = a.oid where p.proname = $1 and p.pronamespace = 'public'::regnamespace`, [f])).map((x) => x.typname);
  await su();
  await q(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  // (los archivos de antes, de hace días: el cupo de 30 al día del atleta, libre para estas pruebas)
  await q(`update archivos set creado_en = creado_en - interval '3 days'`);
  await q(`delete from chat_cupos`); await q(`delete from fbe_privado.storage_por_borrar`);
  // La forma
  const cols = await q(`select table_name t, column_name c, data_type d from information_schema.columns where (table_name, column_name) in (('comentarios','video_respuesta_id'), ('archivos','angulo_de'), ('archivos','fps_captura'), ('video_revisiones','dos_angulos'))`);
  check(cols.length === 4 && cols.find((x) => x.c === 'dos_angulos').d === 'jsonb' && cols.find((x) => x.c === 'fps_captura').d === 'smallint', 'las cuatro columnas nuevas (respuesta en vídeo, otro ángulo, ritmo de grabación y desfase)');
  check((await q(`select relname from pg_class where relname = any($1) and relrowsecurity and relnamespace = 'public'::regnamespace`, [['comentarios', 'archivos', 'video_revisiones']])).length === 3
    && (await q(`select 1 from information_schema.role_table_grants where table_name = any($1) and grantee in ('anon', 'PUBLIC')`, [['comentarios', 'archivos', 'video_revisiones']])).length === 0,
    'las tablas, con sus permisos por fila y nada para anon (sin tablas ni políticas nuevas)');
  const nuevas = ['archivo_con_mensajes', 'comentario_respuesta_video', 'comentario_sin_respuesta_video', 'archivo_angulo_fps', 'dos_angulos_valido', 'video_revision_angulos', 'video_correcciones', 'al_borrar_video_respuestas', 'al_mover_archivo'];
  const malos = await q(`select p.oid::regprocedure::text f from pg_proc p where p.pronamespace in ('public'::regnamespace, 'fbe_privado'::regnamespace) and p.proname = any($1) and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))`, [nuevas]);
  check(!malos.length && (await q(`select count(distinct proname)::int n from pg_proc where proname = any($1)`, [nuevas]))[0].n === nuevas.length, `las funciones nuevas y las que cambia la 038, con search_path vacío${malos.length ? ` (no: ${malos.map((x) => x.f).join(', ')})` : ''}`);
  const definer = Object.fromEntries((await q(`select proname, prosecdef from pg_proc where proname = any($1)`, [nuevas])).map((x) => [x.proname, x.prosecdef]));
  check(definer.comentario_respuesta_video && definer.comentario_sin_respuesta_video && definer.video_revision_angulos && definer.al_borrar_video_respuestas && definer.al_mover_archivo && definer.archivo_angulo_fps && !definer.dos_angulos_valido,
    'lo que lee o cambia por encima de los permisos (también quitar el desfase al desenlazar), con los de su dueño y search_path vacío; el validador, sin');
  check(!(await q(`select has_function_privilege('anon', 'public.dos_angulos_valido(jsonb)', 'execute') a, has_function_privilege('authenticated', 'fbe_privado.al_borrar_video_respuestas()', 'execute') b, has_function_privilege('authenticated', 'fbe_privado.comentario_sin_respuesta_video()', 'execute') c`)).some((x) => x.a || x.b || x.c),
    'sin sesión no se llaman; lo interno, tampoco desde la app');
  check((await q(`select pg_get_function_result('public.video_correcciones(uuid[])'::regprocedure) r`))[0].r.includes('dos_angulos jsonb') && !(await tiposDe('video_correcciones')).some((x) => HORAS.test(x)),
    'video_correcciones() devuelve también el desfase (y sigue sin ninguna hora)');

  // Lo que hace falta
  await como(pelayo, 'aal2');
  const [ej] = await q(`insert into ejercicios (nombre, grupos_musculares) values ('Peso muerto v060', '{cuadriceps,gluteo}') returning id`);
  await como(ana);
  const va = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'a'), ejercicio_id: ej.id, duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  const vb = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'b'), ejercicio_id: ej.id, duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  const vc = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'c'), ejercicio_id: ej.id, duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  const fotoA = await insArch({ atleta_id: aAna.id, tipo: 'adjunto', ruta: ruta(aAna.id, 'foto', 'jpg'), mime: 'image/jpeg', bytes: 100 });
  await como(luis);
  const vl = await insArch({ atleta_id: aLuis.id, tipo: 'video_tecnica', ruta: ruta(aLuis.id, 'l'), duracion_seg: 6, mime: 'video/mp4', bytes: 1000 });
  // (con su objeto en Storage, como al subirlo: el tamaño de verdad en metadata.size; extra.real, otro tamaño que el de la fila)
  const adj = async (atleta, seg, extra = {}) => {
    const a = await insArch({ atleta_id: atleta, tipo: 'adjunto', ruta: ruta(atleta, 'adjunto-video', extra.ext || 'mp4'), mime: extra.mime || 'video/mp4', bytes: extra.bytes ?? 50000, duracion_seg: seg });
    if (!extra.sinSubir) await q(`insert into storage.objects (bucket_id, name, metadata) values ('archivos', $1, $2)`, [a.ruta, JSON.stringify({ size: extra.real ?? extra.bytes ?? 50000 })]);
    return a;
  };
  const responder = (video, archivo, texto = 'Vídeo') => q(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, $2, $3) returning *`, [video, texto, archivo]);

  console.log('  · 1 y 2. Respuestas en vídeo en el hilo de un vídeo');
  await su(); await q(`delete from notificaciones`);
  await como(pelayo, 'aal2');
  const revC = await adj(aAna.id, 150);
  const [cRev] = await responder(va.id, revC.id, 'Revisión grabada');
  check(cRev.video_respuesta_id === revC.id && cRev.autor === 'coach' && cRev.atleta_id === aAna.id && !cRev.adjunto, 'el coach responde en el hilo del vídeo de Ana con su revisión grabada (2:30)');
  const avisos = await notis(`clave = $1`, ['comentario:' + cRev.id]);
  check(avisos.length === 1 && avisos[0].url.startsWith(`#videos/${va.id}`) && !/Revisión grabada/.test(`${avisos[0].titulo} ${avisos[0].cuerpo || ''}`), 'a Ana le llega el aviso, al vídeo y sin el texto');
  await como(pelayo, 'aal2');
  check(await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, (await adj(aAna.id, 182)).id]), 'la del coach, de 3 minutos como mucho (y un segundo de margen)');
  await como(ana);
  const caraA = await adj(aAna.id, 40, { mime: 'video/webm', ext: 'webm' });
  const [cA] = await responder(va.id, caraA.id);
  check(cA.autor === 'atleta' && cA.video_respuesta_id === caraA.id, 'Ana responde en su hilo con la cámara de delante (40 s, WebM)');
  const largoA = await adj(aAna.id, 75);
  check(await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, largoA.id]), 'la del atleta, de un minuto como mucho');
  const otraA = await adj(aAna.id, 20);
  check(await falla(`insert into comentarios (atleta_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [aAna.id, otraA.id])
    && await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [fotoA.id, otraA.id])
    && await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, revC.id])
    && await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, caraA.id])
    && await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, vb.id])
    && await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, fotoA.id]),
    'solo en el hilo de un vídeo de técnica (ni en el chat ni en el de una foto), con un vídeo suyo (no el del coach), no uno ya usado, ni un vídeo de técnica ni una foto');
  const viejoA = await adj(aAna.id, 20);
  await su(); await q(`update archivos set creado_en = now() - interval '2 hours' where id = $1`, [viejoA.id]);
  await como(ana);
  const enChat = await adj(aAna.id, 20);
  await q(`insert into comentarios (atleta_id, texto, archivo_id) values ($1, 'Vídeo', $2)`, [aAna.id, enChat.id]);
  check(await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, viejoA.id]) && await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, enChat.id])
    && await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, (await adj(aAna.id, 20, { mime: 'video/quicktime', ext: 'mov' })).id]),
    'recién subido (en la última hora), que no esté ya en el chat, en MP4 o WebM');
  check(await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, (await adj(aAna.id, 20, { sinSubir: true })).id])
    && await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, (await adj(aAna.id, 20, { bytes: 50000, real: 150 * 1048576 })).id]),
    '(M2) ya subido a Storage, y de 100 MB como mucho según Storage (no según lo que diga la fila)');
  check(await falla(`insert into comentarios (atleta_id, texto, archivo_id) values ($1, 'Vídeo', $2)`, [aAna.id, caraA.id]), 'y al revés: el vídeo de una respuesta no va como archivo de otro mensaje');
  check(await falla(`update comentarios set video_respuesta_id = $2 where id = $1`, [cA.id, otraA.id]) && await falla(`update comentarios set video_respuesta_id = null where id = $1`, [cA.id]),
    'la respuesta en vídeo de un mensaje no se cambia ni se quita desde la app');
  check((await q(`delete from archivos where id = $1 returning 1`, [revC.id])).length === 0 && (await q(`delete from archivos where id = $1 returning 1`, [caraA.id])).length === 0,
    'Ana no borra el vídeo de la revisión de su coach (ni el suyo, que lleva su mensaje: eso va por eliminarlo)');
  await como(luis);
  check((await q(`select 1 from archivos where id = any($1)`, [[revC.id, caraA.id]])).length === 0 && (await q(`select 1 from comentarios where id = any($1)`, [[cRev.id, cA.id]])).length === 0
    && await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, otraA.id]), 'Luis no ve nada de eso (ni responde en el hilo de Ana con un vídeo de ella)');
  await su(); await q(`update atletas set estado = 'baja' where id = $1`, [aAna.id]);
  await como(ana);
  check(await falla(`insert into comentarios (archivo_id, texto, video_respuesta_id) values ($1, 'x', $2)`, [va.id, otraA.id]), 'de baja, Ana no responde (ni con vídeo)');
  await su(); await q(`update atletas set estado = 'activo' where id = $1`, [aAna.id]);
  // Eliminar el mensaje se lleva su vídeo (fuera de la tabla y a la cola de Storage)
  await como(ana);
  check((await q(`select comentario_eliminar($1) r`, [cA.id]))[0].r.estado === 'eliminado', 'Ana elimina su respuesta en vídeo para todos');
  await su();
  check(!(await q(`select 1 from archivos where id = $1`, [caraA.id])).length && (await q(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [caraA.ruta])).length === 1
    && (await q(`select video_respuesta_id from comentarios where id = $1`, [cA.id]))[0].video_respuesta_id === null, 'y su vídeo se va con él (a la cola de Storage); el mensaje queda como «Se eliminó»');
  await como(pelayo, 'aal2');
  const otraC = await adj(aAna.id, 30);
  const [cC2] = await responder(vc.id, otraC.id);
  await q(`delete from comentarios where id = $1`, [cC2.id]);
  await su();
  check(!(await q(`select 1 from archivos where id = $1`, [otraC.id])).length, 'si el coach borra un mensaje con respuesta en vídeo, también se va su vídeo');

  console.log('  · 9. Dos ángulos de la misma serie');
  await como(ana);
  check((await q(`update archivos set angulo_de = $2 where id = $1 returning angulo_de`, [vb.id, va.id]))[0].angulo_de === va.id, 'Ana enlaza un vídeo como el otro ángulo de otro suyo');
  check(await falla(`update archivos set angulo_de = $2 where id = $1`, [vc.id, va.id]) && await falla(`update archivos set angulo_de = $2 where id = $1`, [vc.id, vb.id])
    && await falla(`update archivos set angulo_de = $2 where id = $1`, [va.id, vc.id]),
    'como mucho una pareja (ni un tercero al mismo, ni en cadena, ni el que ya está enlazado)');
  check(await falla(`update archivos set angulo_de = $2 where id = $1`, [vc.id, vc.id]) && await falla(`update archivos set angulo_de = $2 where id = $1`, [vc.id, vl.id])
    && await falla(`update archivos set angulo_de = $2 where id = $1`, [vc.id, fotoA.id]) && await falla(`update archivos set angulo_de = $2 where id = $1`, [fotoA.id, vc.id]),
    'ni consigo mismo, ni con uno de Luis, ni con algo que no es un vídeo de técnica');
  const nuevoAng = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'd'), duracion_seg: 8, mime: 'video/mp4', bytes: 1000, angulo_de: vc.id });
  check(nuevoAng.angulo_de === vc.id && await falla(`insert into archivos (atleta_id, tipo, ruta, mime, bytes, angulo_de) values ($1, 'video_tecnica', $2, 'video/mp4', 10, $3)`, [aAna.id, ruta(aAna.id, 'e'), vc.id]),
    'al enviar un vídeo, ya como el otro ángulo (y no un tercero)');
  await su(); await q(`update atletas set estado = 'baja' where id = $1`, [aAna.id]);
  await como(ana);
  check(await falla(`update archivos set angulo_de = null where id = $1`, [nuevoAng.id]) === false && await falla(`update archivos set angulo_de = $2 where id = $1`, [nuevoAng.id, vc.id]), 'de baja, no enlaza');
  await su(); await q(`update atletas set estado = 'activo' where id = $1`, [aAna.id]);
  // El desfase, con la corrección (no cuenta como corregir)
  const DA_BIEN = [{ con: vb.id, desfase: 0.25 }, { con: vb.id, desfase: -2 }, { con: vb.id, desfase: 2 }, { con: vb.id, desfase: 0.033 }, { con: vb.id, desfase: 0 }];
  const DA_MAL = ['null', '[]', '{}', '"x"', '1', 'true', JSON.stringify({ con: vb.id }), JSON.stringify({ desfase: 0 }), JSON.stringify({ con: vb.id, desfase: 2.01 }), JSON.stringify({ con: vb.id, desfase: -2.5 }),
    JSON.stringify({ con: vb.id, desfase: 0.0333 }), JSON.stringify({ con: vb.id, desfase: '0.5' }), JSON.stringify({ con: vb.id, desfase: null }), JSON.stringify({ con: 'no-es', desfase: 0 }),
    JSON.stringify({ con: vb.id.toUpperCase(), desfase: 0 }), JSON.stringify({ con: 5, desfase: 0 }), JSON.stringify({ con: vb.id, desfase: 0, x: 1 }), JSON.stringify({ CON: vb.id, desfase: 0 }),
    `{"con":"${vb.id}","desfase":1e-400}`, `{"con":"${vb.id}","desfase":1e400}`, JSON.stringify({ con: [vb.id], desfase: 0 }), JSON.stringify({ con: vb.id, desfase: [0.5] }), JSON.stringify({ con: vb.id, desfase: { v: 1 } })];
  const okDA = []; for (const j of DA_BIEN) okDA.push((await q(`select dos_angulos_valido($1::jsonb) ok`, [JSON.stringify(j)]))[0].ok);
  const malDA = []; let errDA = 0;
  for (const j of DA_MAL) { try { malDA.push((await q(`select dos_angulos_valido($1::jsonb) ok`, [j]))[0].ok); } catch { errDA++; } }
  check(okDA.every((x) => x === true) && DA_MAL.length >= 20 && !errDA && malDA.every((x) => x === false) && (await q(`select dos_angulos_valido(null) x`))[0].x === false,
    `dos_angulos_valido(): los ${DA_BIEN.length} bien formados valen; los ${DA_MAL.length} mal formados dan false, nunca un error (${malDA.filter((x) => x !== false).length} no)`);
  await su(); await q(`delete from notificaciones`);
  await como(pelayo, 'aal2');
  await q(`insert into video_revisiones (archivo_id, atleta_id, dos_angulos) values ($1, $2, $3) on conflict (archivo_id) do update set dos_angulos = excluded.dos_angulos`, [va.id, aAna.id, JSON.stringify({ con: vb.id, desfase: 0.25 })]);
  const [rA] = await q(`select dos_angulos, corregido_en from video_revisiones where archivo_id = $1`, [va.id]);
  check(Number(rA.dos_angulos.desfase) === 0.25 && rA.corregido_en === null && !(await notis(`clave = $1`, ['video:' + va.id])).length, 'el coach guarda el desfase con la corrección (no cuenta como corregir: no avisa)');
  await como(pelayo, 'aal2');
  check(await falla(`update video_revisiones set dos_angulos = $2 where archivo_id = $1`, [va.id, JSON.stringify({ con: vc.id, desfase: 0 })])
    && await falla(`update video_revisiones set dos_angulos = $2 where archivo_id = $1`, [va.id, JSON.stringify({ con: vb.id, desfase: 3 })]), 'con su otro ángulo (no con otro vídeo) y de −2 a +2 s');
  await q(`insert into video_revisiones (archivo_id, atleta_id, dos_angulos) values ($1, $2, $3)`, [vb.id, aAna.id, JSON.stringify({ con: va.id, desfase: -0.25 })]);
  check(true, 'también desde el otro lado (el de la pareja)');
  await como(ana);
  const leida = await q(`select archivo_id, dos_angulos from video_correcciones($1)`, [[va.id]]);
  check(Number(leida[0]?.dos_angulos?.desfase) === 0.25 && (await q(`update video_revisiones set dos_angulos = null where archivo_id = $1 returning 1`, [va.id])).length === 0,
    'Ana lo lee con video_correcciones() (sin horas), pero no lo cambia');
  // Pasar uno a otro atleta o borrarlo los desenlaza
  await como(pelayo, 'aal2');
  await q(`update archivos set atleta_id = $2, ruta = $3 where id = $1`, [vb.id, aLuis.id, ruta(aLuis.id, 'movido')]);
  await su();
  const [vbM] = await q(`select angulo_de from archivos where id = $1`, [vb.id]);
  check(vbM.angulo_de === null && (await q(`select dos_angulos from video_revisiones where archivo_id = any($1)`, [[va.id, vb.id]])).every((x) => x.dos_angulos === null),
    'pasar uno de los dos a otro atleta los desenlaza (y quita el desfase de los dos)');
  await como(pelayo, 'aal2');
  await q(`delete from archivos where id = $1`, [vc.id]);
  check((await q(`select angulo_de from archivos where id = $1`, [nuevoAng.id]))[0].angulo_de === null, 'borrar uno lo desenlaza');

  console.log('  · 11. El ritmo de grabación (cámara lenta)');
  await como(ana);
  const lento = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'lento'), duracion_seg: 4, mime: 'video/mp4', bytes: 1000, fps_captura: 120 });
  check(lento.fps_captura === 120 && await falla(`insert into archivos (atleta_id, tipo, ruta, mime, bytes, fps_captura) values ($1, 'video_tecnica', $2, 'video/mp4', 10, 300)`, [aAna.id, ruta(aAna.id, 'x')])
    && await falla(`insert into archivos (atleta_id, tipo, ruta, mime, bytes, fps_captura) values ($1, 'video_tecnica', $2, 'video/mp4', 10, 12)`, [aAna.id, ruta(aAna.id, 'y')])
    && await falla(`insert into archivos (atleta_id, tipo, ruta, mime, bytes, fps_captura) values ($1, 'adjunto', $2, 'video/mp4', 10, 120)`, [aAna.id, ruta(aAna.id, 'z')]),
    'un vídeo grabado a 120 fps lo lleva apuntado (de 24 a 240, y solo en un vídeo de técnica)');
  check(await falla(`update archivos set fps_captura = 240 where id = $1`, [lento.id]), 'y no se cambia después (ni Ana)');
  await como(pelayo, 'aal2');
  check(await falla(`update archivos set fps_captura = null where id = $1`, [lento.id]), 'ni el coach');

  console.log('  · Borrar un vídeo y pasarlo a otro atleta: sus respuestas en vídeo');
  await como(pelayo, 'aal2');
  const revD = await adj(aAna.id, 60);
  const [cD] = await responder(va.id, revD.id);
  await como(ana);
  const caraD = await adj(aAna.id, 10);
  const [cD2] = await responder(va.id, caraD.id);
  await como(pelayo, 'aal2');
  await q(`update archivos set atleta_id = $2, ruta = $3 where id = $1`, [va.id, aLuis.id, ruta(aLuis.id, 'movido-a')]);
  await su();
  check(!(await q(`select 1 from archivos where id = any($1)`, [[revD.id, caraD.id]])).length && (await q(`select video_respuesta_id v from comentarios where id = $1`, [cD.id]))[0]?.v === null
    && !(await q(`select 1 from comentarios where id = $1`, [cD2.id])).length && (await q(`select 1 from fbe_privado.storage_por_borrar where ruta = any($1)`, [[revD.ruta, caraD.ruta]])).length === 2,
    'al pasar el vídeo a otro atleta, sus respuestas en vídeo se borran (a la cola de Storage): lo del de antes, fuera; el mensaje del coach se queda, sin el vídeo');
  await como(pelayo, 'aal2');
  const revE = await adj(aLuis.id, 30);
  await responder(va.id, revE.id);
  await q(`delete from archivos where id = $1`, [va.id]);
  await su();
  check(!(await q(`select 1 from archivos where id = $1`, [revE.id])).length, 'al borrar el vídeo de técnica, sus respuestas en vídeo también');
  await como(ana);
  const p1 = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'p1'), duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  const p2 = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'p2'), duracion_seg: 8, mime: 'video/mp4', bytes: 1000, angulo_de: p1.id });
  await como(pelayo, 'aal2');
  await q(`insert into video_revisiones (archivo_id, atleta_id, dos_angulos) values ($1, $2, $3), ($4, $2, $5)`, [p1.id, aAna.id, JSON.stringify({ con: p2.id, desfase: 0.1 }), p2.id, JSON.stringify({ con: p1.id, desfase: -0.1 })]);
  check(!(await falla(`delete from archivos where id = any($1)`, [[p1.id, p2.id]])) && !(await q(`select 1 from video_revisiones where archivo_id = any($1)`, [[p1.id, p2.id]])).length,
    'los dos ángulos (con su desfase guardado en los dos) se borran de una vez sin problema');
  // (H1) Borrar a la vez un vídeo y su respuesta (en los dos órdenes de la tabla), solo el vídeo, y un atleta entero
  const enCola = async (rutas) => { await su(); const n = (await q(`select count(*)::int n from fbe_privado.storage_por_borrar where ruta = any($1)`, [rutas]))[0].n; await como(pelayo, 'aal2'); return n; };
  const quedan = async (ids) => (await q(`select count(*)::int n from archivos where id = any($1)`, [ids]))[0].n;
  await como(ana);
  const vH1 = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'h1'), duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  await como(pelayo, 'aal2');
  const rH1 = await adj(aAna.id, 20);
  await responder(vH1.id, rH1.id);
  let eH1 = null;
  try { await q(`delete from archivos where id = any($1)`, [[vH1.id, rH1.id]]); } catch (e) { eH1 = e.message; }
  const nH1 = [await quedan([vH1.id, rH1.id]), await enCola([vH1.ruta, rH1.ruta])];
  check(!eH1 && nH1[0] === 0 && nH1[1] === 2, `(H1) borrar a la vez un vídeo y su respuesta en vídeo (el vídeo primero en la tabla): sin error, los dos a la cola de Storage${eH1 ? ` (${eH1})` : ''} ${nH1}`);
  const rH2 = await adj(aAna.id, 20);
  await como(ana);
  const vH2 = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'h2'), duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  await como(pelayo, 'aal2');
  await responder(vH2.id, rH2.id);
  check(!(await falla(`delete from archivos where id = any($1)`, [[rH2.id, vH2.id]])) && await quedan([vH2.id, rH2.id]) === 0, '(H1) y en el otro orden (la respuesta primero en la tabla)');
  await como(ana);
  const vH3 = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'h3'), duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  await como(pelayo, 'aal2');
  const rH3 = await adj(aAna.id, 20);
  const [cH3] = await responder(vH3.id, rH3.id);
  check(!(await falla(`delete from archivos where id = $1`, [vH3.id])) && await quedan([rH3.id]) === 0 && (await q(`select eliminado_en is not null e, video_respuesta_id v from comentarios where id = $1`, [cH3.id]))[0]?.v === null,
    '(H1) solo el vídeo: su respuesta en vídeo se va con él (y su mensaje queda como eliminado)');
  // (L5) Si el coach borra el archivo de una respuesta, su mensaje queda como eliminado (no diciendo «Vídeo» sin vídeo)
  await como(ana);
  const vL5 = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'l5'), duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  await como(pelayo, 'aal2');
  const rL5 = await adj(aAna.id, 20);
  const [cL5] = await responder(vL5.id, rL5.id, 'Mira esto');
  await q(`delete from archivos where id = $1`, [rL5.id]);
  const [cL5b] = await q(`select texto, eliminado_en, video_respuesta_id from comentarios where id = $1`, [cL5.id]);
  check(cL5b.eliminado_en && cL5b.texto === 'Se eliminó este mensaje' && cL5b.video_respuesta_id === null, '(L5) el coach borra el archivo de una respuesta: su mensaje queda como «Se eliminó este mensaje»');
  // (L5) Eliminar para todos: al coach se le devuelve la ruta del vídeo, para quitarlo de Storage al momento
  const rL5c = await adj(aAna.id, 20);
  const [cL5c] = await responder(vL5.id, rL5c.id);
  const elC = (await q(`select comentario_eliminar($1) r`, [cL5c.id]))[0].r;
  check(elC.estado === 'eliminado' && elC.rutas.includes(rL5c.ruta) && await quedan([rL5c.id]) === 0, '(L5) el coach elimina su respuesta en vídeo: se le devuelve su ruta (sale de Storage al momento) y su archivo se va');
  // (L3) Desenlazar dos ángulos quita el desfase de las dos correcciones
  await como(ana);
  const d1 = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'd1'), duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  const d2 = await insArch({ atleta_id: aAna.id, tipo: 'video_tecnica', ruta: ruta(aAna.id, 'd2'), duracion_seg: 8, mime: 'video/mp4', bytes: 1000, angulo_de: d1.id });
  await como(pelayo, 'aal2');
  await q(`insert into video_revisiones (archivo_id, atleta_id, dos_angulos) values ($1, $2, $3), ($4, $2, $5)`, [d1.id, aAna.id, JSON.stringify({ con: d2.id, desfase: 0.2 }), d2.id, JSON.stringify({ con: d1.id, desfase: -0.2 })]);
  await como(ana);
  await q(`update archivos set angulo_de = null where id = $1`, [d2.id]);
  await como(pelayo, 'aal2');
  check((await q(`select dos_angulos from video_revisiones where archivo_id = any($1)`, [[d1.id, d2.id]])).every((x) => x.dos_angulos === null), '(L3) al desenlazarlos (Ana), el desfase de las dos correcciones se quita');
  // (H1) Borrar un atleta entero con respuestas en vídeo
  const [aEva] = await q(`insert into atletas (nombre) values ('Atleta v060') returning id`);
  const vE = await insArch({ atleta_id: aEva.id, tipo: 'video_tecnica', ruta: ruta(aEva.id, 'e'), duracion_seg: 8, mime: 'video/mp4', bytes: 1000 });
  const rE = await adj(aEva.id, 30);
  await responder(vE.id, rE.id);
  let eE = null;
  try { await q(`delete from atletas where id = $1`, [aEva.id]); } catch (e) { eE = e.message; }
  check(!eE && await quedan([vE.id, rE.id]) === 0 && await enCola([vE.ruta, rE.ruta]) === 2, `(H1) borrar a un atleta con una respuesta en vídeo: sin error, y sus archivos a la cola de Storage${eE ? ` (${eE})` : ''}`);
  await su();
  await q(`delete from archivos where ruta like '%/v060-%'`);
  await q(`delete from fbe_privado.storage_por_borrar`);

  console.log('  · La 038 sin la 037, y sobre una base que ya va por delante');
  const sin37 = new PGlite();
  await sin37.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin37.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '037')) await sin37.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  const sql38 = readFileSync(new URL('../supabase/migraciones/038_videos_tanda_b1.sql', import.meta.url), 'utf8');
  let e38 = null;
  try { await sin37.exec(sql38); } catch (e) { e38 = e.message; }
  check(/Antes de la 038 hace falta la 037/.test(e38 || '') && !(await sin37.query(`select 1 from information_schema.columns where table_name = 'comentarios' and column_name = 'video_respuesta_id'`)).rows.length,
    'la 038 no se aplica sin la 037 (y no deja nada a medias)');
  await sin37.exec(readFileSync(new URL('../supabase/migraciones/037_videos_tanda_a.sql', import.meta.url), 'utf8'));
  await sin37.exec(sql38);
  await sin37.exec(sql38);
  check((await sin37.query(`select count(*)::int n from fbe_migraciones where numero = 38`)).rows[0].n === 1, 'con la 037, se aplica (y se puede repetir: queda apuntada una vez)');
  await sin37.exec(`insert into public.fbe_migraciones (numero) values (39)`);
  let e39 = null;
  try { await sin37.exec(sql38); } catch (e) { e39 = e.message; }
  check(/ya tiene la migración 039/.test(e39 || ''), 'ni en una base que ya tiene una posterior');
  await sin37.close();
}

console.log('\nLos vídeos de técnica, tanda B, segunda mitad (migración 039)');
{
  const HORAS = /^(timestamptz|timestamp|time|timetz|interval)$/;
  await su();
  // La forma
  check((await q(`select relname from pg_class where relname = 'umbrales_velocidad' and relrowsecurity and relnamespace = 'public'::regnamespace`)).length === 1
    && (await q(`select 1 from information_schema.role_table_grants where table_name = 'umbrales_velocidad' and grantee in ('anon', 'PUBLIC')`)).length === 0
    && (await q(`select data_type d, numeric_scale e from information_schema.columns where table_name = 'umbrales_velocidad' and column_name = 'vmin'`))[0]?.d === 'numeric',
    'la tabla de la velocidad mínima: con sus permisos por fila, nada para anon y numeric sin escala (0,1234 no se redondea en silencio)');
  const nuevas = ['umbral_velocidad_valido', 'umbral_velocidad_preparar', 'umbrales_velocidad_de', 'comentario_resumen_sesion'];
  const malosSp = await q(`select p.oid::regprocedure::text f from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any($1) and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))`, [nuevas]);
  const def = Object.fromEntries((await q(`select proname, prosecdef from pg_proc where proname = any($1)`, [nuevas])).map((x) => [x.proname, x.prosecdef]));
  check(!malosSp.length && Object.keys(def).length === 4 && def.umbrales_velocidad_de && def.comentario_resumen_sesion && !def.umbral_velocidad_valido && !def.umbral_velocidad_preparar,
    'sus funciones, con search_path vacío; la que lee para los atletas, con los permisos de su dueño; el validador y el trigger, sin');
  check(!(await q(`select has_function_privilege('anon', 'public.umbrales_velocidad_de(uuid[])', 'execute') a, has_function_privilege('anon', 'public.umbral_velocidad_valido(numeric)', 'execute') b`)).some((x) => x.a || x.b),
    'sin sesión no se llaman');
  check(!(await q(`select t.typname from pg_proc p, unnest(p.proallargtypes) a(oid) join pg_type t on t.oid = a.oid where p.proname = 'umbrales_velocidad_de'`)).some((x) => HORAS.test(x.typname)),
    'umbrales_velocidad_de() no devuelve ninguna hora');
  // El validador: false con todo lo mal formado, nunca un error
  const validoU = async (v) => (await q(`select public.umbral_velocidad_valido($1::numeric) ok`, [v]))[0].ok;
  const buenosU = ['0.05', '1', '0.3', '0.175', '0.300', '1.000', '0.17', '0.999', '0.3000', '0.17000', '1.0000000', '0.0500'];
  const malosU = [null, '0', '0.04', '0.0499', '1.0001', '2', '-0.3', 'NaN', 'Infinity', '-Infinity', '0.1234', '0.30001', '100', '-0', '0.000', '0.00001', '1.5', '0.0001', '-1', '99.999', '0.049999', '1.001', '0.04999999999', '0.12340', '0.17501000'];
  const okB = []; for (const v of buenosU) okB.push(await validoU(v));
  const okM = []; for (const v of malosU) okM.push(await validoU(v));
  check(okB.every((x) => x === true), 'la velocidad mínima: de 0,05 a 1 m/s, con hasta 3 decimales (los ceros del final no cuentan: 0,3000 vale)');
  check(okM.every((x) => x === false), `y ${malosU.length} mal formadas dan false, nunca un error (ni NaN, ni infinito, ni 4 decimales, ni fuera de rango)`);
  // Lo que hace falta
  await como(pelayo, 'aal2');
  const [ejU] = await q(`insert into ejercicios (nombre, grupos_musculares) values ('Sentadilla v061', '{cuadriceps,gluteo}') returning id`);
  const [ejU2] = await q(`insert into ejercicios (nombre, grupos_musculares) values ('Press v061', '{pectoral}') returning id`);
  // El coach la escribe
  const [u1] = await q(`insert into umbrales_velocidad (ejercicio_id, vmin) values ($1, 0.300) returning *`, [ejU.id]);
  check(String(u1.vmin) === '0.3' && !!u1.actualizado_en, 'el coach guarda la de la sentadilla (0,300 → 0,3, con la fecha de la base)');
  check(await falla(`insert into umbrales_velocidad (ejercicio_id, vmin) values ($1, 0.1234)`, [ejU2.id]) && await falla(`insert into umbrales_velocidad (ejercicio_id, vmin) values ($1, 0.04)`, [ejU2.id])
    && await falla(`insert into umbrales_velocidad (ejercicio_id, vmin) values ($1, 'NaN')`, [ejU2.id]) && await falla(`insert into umbrales_velocidad (ejercicio_id) values ($1)`, [ejU2.id]),
    'ni con 4 decimales, ni por debajo de 0,05, ni NaN, ni sin valor');
  check(Number((await q(`update umbrales_velocidad set vmin = 0.32 where ejercicio_id = $1 returning vmin`, [ejU.id]))[0].vmin) === 0.32 && await falla(`update umbrales_velocidad set ejercicio_id = $1 where ejercicio_id = $2`, [ejU2.id, ejU.id]),
    'la cambia (pero no de ejercicio)');
  check(await falla(`insert into umbrales_velocidad (ejercicio_id, vmin) values ($1, 0.2)`, [ejU.id]), 'una por ejercicio');
  await q(`insert into umbrales_velocidad (ejercicio_id, vmin) values ($1, 0.17)`, [ejU2.id]);
  // El atleta: nada de la tabla; las suyas, con la función (sin horas)
  await como(ana);
  check((await q(`select * from umbrales_velocidad`)).length === 0 && (await q(`update umbrales_velocidad set vmin = 0.5 returning *`)).length === 0
    && (await q(`delete from umbrales_velocidad returning *`)).length === 0 && await falla(`insert into umbrales_velocidad (ejercicio_id, vmin) values ($1, 0.5)`, [ejU.id]),
    'Ana no lee, ni cambia, ni borra, ni escribe la tabla');
  const leidas = await q(`select * from umbrales_velocidad_de($1::uuid[])`, [[ejU.id, ejU2.id, aAna.id]]);
  check(leidas.length === 2 && Object.keys(leidas[0]).join() === 'ejercicio_id,vmin' && Number(leidas.find((x) => x.ejercicio_id === ejU.id).vmin) === 0.32,
    'pero lee la velocidad mínima de sus ejercicios con umbrales_velocidad_de() (solo el ejercicio y el valor)');
  check(await falla(`select * from umbrales_velocidad_de($1::uuid[])`, [Array.from({ length: 201 }, () => ejU.id)]) && await falla(`select * from umbrales_velocidad_de(null)`), 'de 0 a 200 de una vez');
  await su(); await q(`update atletas set estado = 'baja' where id = $1`, [aLuis.id]);
  await como(luis);
  check((await q(`select * from umbrales_velocidad_de($1::uuid[])`, [[ejU.id]])).length === 1, 'un atleta de baja también (no es nada suyo: es un ajuste del ejercicio)');
  await su(); await q(`update atletas set estado = 'activo' where id = $1`, [aLuis.id]);
  const sinFicha = await nuevoUsuario('sin-ficha-v061@fbe.test');
  await como(sinFicha);
  check(await falla(`select * from umbrales_velocidad_de($1::uuid[])`, [[ejU.id]]), 'una cuenta sin ficha de atleta, no');
  await db.exec(`reset role; ${claims('', '')} set role anon;`);
  check(await falla(`select * from umbrales_velocidad_de($1::uuid[])`, [[ejU.id]]) && await falla(`select * from umbrales_velocidad`), 'ni sin sesión');
  // Se va con su ejercicio
  await como(pelayo, 'aal2');
  await q(`delete from ejercicios where id = $1`, [ejU2.id]);
  check((await q(`select count(*)::int n from umbrales_velocidad where ejercicio_id = $1`, [ejU2.id]))[0].n === 0, 'al borrar el ejercicio, su velocidad mínima se va con él');

  // 5. El resumen de la sesión: un comentario del coach en la sesión marcado por la base (resumen_sesion), uno por sesión,
  // un solo aviso y sin el texto (revisión M2)
  console.log('  · 5. El resumen de una sesión: marcado por la base, uno por sesión, un aviso sin el texto');
  await su(); await q(`delete from notificaciones`);
  check((await q(`select data_type d, is_nullable n, column_default x from information_schema.columns where table_name = 'comentarios' and column_name = 'resumen_sesion'`))[0]?.d === 'boolean'
    && (await q(`select 1 from pg_indexes where indexname = 'comentarios_resumen_sesion_unico'`)).length === 1
    && (await q(`select prosecdef s, proconfig c from pg_proc where proname = 'comentario_resumen_sesion'`))[0]?.c?.includes('search_path=""'),
    'la marca del resumen (comentarios.resumen_sesion), con su índice único por sesión y su trigger (con search_path vacío)');
  const sesionesAna = await q(`select s.id from sesiones s join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id where b.atleta_id = $1 order by s.id limit 2`, [aAna.id]);
  const [sesA, sesB] = sesionesAna;
  await como(pelayo, 'aal2');
  const [res] = await q(`insert into comentarios (sesion_id, texto, resumen_sesion) values ($1, $2, true) returning *`, [sesA.id, 'Resumen de la sesión, Ana:\n· Sentadilla: 4/5 (buena)']);
  const avisosR = await notis(`usuario_id = (select perfil_id from atletas where id = $1)`, [aAna.id]);
  check(res.autor === 'coach' && res.atleta_id === aAna.id && res.resumen_sesion === true && avisosR.length === 1 && !/Resumen|Sentadilla/.test(`${avisosR[0].titulo} ${avisosR[0].cuerpo || ''}`),
    'el coach manda el resumen de toda la sesión al hilo de esa sesión (marcado): a Ana le llega un solo aviso, sin el texto');
  await como(pelayo, 'aal2');
  let eDos = '';
  try { await q(`insert into comentarios (sesion_id, texto, resumen_sesion) values ($1, 'Otro texto cualquiera', true)`, [sesA.id]); } catch (e) { eDos = e.message; }
  check(/Ya le has mandado el resumen de esta sesión/.test(eDos) && (await q(`select count(*)::int n from comentarios where sesion_id = $1 and resumen_sesion`, [sesA.id]))[0].n === 1,
    'un segundo resumen de la misma sesión se rechaza con un aviso claro (aunque el texto sea otro)');
  check(await falla(`insert into comentarios (sesion_id, texto, resumen_sesion) values ($1, 'a', true), ($1, 'b', true)`, [sesB.id]) && (await q(`select count(*)::int n from comentarios where sesion_id = $1`, [sesB.id]))[0].n === 0,
    'ni dos a la vez en la misma orden (no queda ninguno a medias)');
  const [normal] = await q(`insert into comentarios (sesion_id, texto) values ($1, 'Resumen de la sesión (esto es un mensaje normal)') returning *`, [sesA.id]);
  check(normal.resumen_sesion === false, 'un mensaje normal que empieza igual no es un resumen (no depende del texto)');
  check(await falla(`update comentarios set resumen_sesion = true where id = $1`, [normal.id]) && await falla(`update comentarios set resumen_sesion = false where id = $1`, [res.id])
    && await falla(`insert into comentarios (atleta_id, texto, resumen_sesion) values ($1, 'x', true)`, [aAna.id]),
    'la marca no se pone ni se quita después, y fuera del hilo de una sesión no vale');
  const [edit] = await q(`update comentarios set texto = 'Resumen de la sesión, Ana: corregido' where id = $1 returning resumen_sesion`, [res.id]);
  check(edit.resumen_sesion === true, 'editar su texto no le quita la marca');
  // El atleta no puede hacerse pasar por el resumen (ni de baja)
  await como(ana);
  check(await falla(`insert into comentarios (sesion_id, texto, resumen_sesion) values ($1, 'Resumen de la sesión: me lo invento', true)`, [sesB.id])
    && await falla(`update comentarios set resumen_sesion = false where id = $1`, [res.id]) && await falla(`update comentarios set resumen_sesion = true where id = $1`, [normal.id])
    && (await q(`select count(*)::int n from comentarios where sesion_id = $1 and resumen_sesion`, [sesA.id]))[0].n === 1,
    'Ana no escribe un «resumen» ni quita o pone la marca');
  const [mioA] = await q(`insert into comentarios (sesion_id, texto) values ($1, 'Gracias') returning *`, [sesB.id]);
  check(mioA.resumen_sesion === false && await falla(`update comentarios set resumen_sesion = true where id = $1`, [mioA.id]), 'ni convierte uno suyo en resumen');
  await su(); await q(`update atletas set estado = 'baja' where id = $1`, [aAna.id]);
  await como(ana);
  check(await falla(`insert into comentarios (sesion_id, texto, resumen_sesion) values ($1, 'Resumen', true)`, [sesB.id]), 'ni de baja');
  await su(); await q(`update atletas set estado = 'activo' where id = $1`, [aAna.id]);
  // Al eliminarlo para todos, la marca se quita y la sesión admite otro
  await como(pelayo, 'aal2');
  const r1 = await q(`select public.comentario_eliminar($1) r`, [res.id]);
  const [quitado] = await q(`select resumen_sesion, eliminado_en from comentarios where id = $1`, [res.id]);
  const [otro] = await q(`insert into comentarios (sesion_id, texto, resumen_sesion) values ($1, 'Resumen de la sesión, de nuevo', true) returning resumen_sesion`, [sesA.id]);
  check(r1[0].r.estado === 'eliminado' && quitado.resumen_sesion === false && !!quitado.eliminado_en && otro.resumen_sesion === true, 'eliminado para todos, deja de contar: la sesión puede llevar otro');
  await su();
  await q(`delete from comentarios where sesion_id = any($1)`, [[sesA.id, sesB.id]]);

  // 17. El informe: un mensaje del chat de siempre (sin tabla nueva), un aviso sin el texto
  await su(); await q(`delete from notificaciones`);
  await como(pelayo, 'aal2');
  const [inf] = await q(`insert into comentarios (atleta_id, texto) values ($1, 'Tu informe de técnica de octubre de 2026') returning *`, [aAna.id]);
  const avisosI = await notis(`clave = $1`, ['comentario:' + inf.id]);
  check(avisosI.length === 1 && avisosI[0].url === '#mensajes' && !/informe/i.test(`${avisosI[0].titulo} ${avisosI[0].cuerpo || ''}`), 'el informe del mes, un mensaje del chat: un aviso al chat, sin el texto');
  await su();
  await q(`delete from comentarios where id = $1`, [inf.id]);
  await q(`delete from notificaciones`);
  await q(`delete from umbrales_velocidad`);
  await q(`delete from ejercicios where id = $1`, [ejU.id]);

  console.log('  · La 039 sin la 038, repetida y sobre una base que ya va por delante');
  const sin38 = new PGlite();
  await sin38.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin38.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '038')) await sin38.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  const sql39 = readFileSync(new URL('../supabase/migraciones/039_videos_tanda_b2.sql', import.meta.url), 'utf8');
  let e39 = null;
  try { await sin38.exec(sql39); } catch (e) { e39 = e.message; }
  check(/Antes de la 039 hace falta la 038/.test(e39 || '') && !(await sin38.query(`select 1 from pg_class where relname = 'umbrales_velocidad'`)).rows.length, 'la 039 no se aplica sin la 038 (y no deja nada a medias)');
  await sin38.exec(readFileSync(new URL('../supabase/migraciones/038_videos_tanda_b1.sql', import.meta.url), 'utf8'));
  await sin38.exec(sql39);
  await sin38.exec(`insert into public.ejercicios (nombre) values ('x'); insert into public.umbrales_velocidad (ejercicio_id, vmin) select id, 0.25 from public.ejercicios where nombre = 'x'`);
  await sin38.exec(sql39);
  check((await sin38.query(`select count(*)::int n from fbe_migraciones where numero = 39`)).rows[0].n === 1 && (await sin38.query(`select vmin from umbrales_velocidad`)).rows[0]?.vmin == 0.25,
    'con la 038, se aplica; repetida, queda apuntada una vez y no toca lo guardado');
  await sin38.exec(`insert into public.fbe_migraciones (numero) values (40)`);
  let e40 = null;
  try { await sin38.exec(sql39); } catch (e) { e40 = e.message; }
  check(/ya tiene la migración 040/.test(e40 || ''), 'ni en una base que ya tiene una posterior');
  await sin38.close();
}

console.log('\nLa revisión semanal del coach (migración 040)');
{
  await su();
  check((await q(`select relname from pg_class where relname = 'revisiones_semanales' and relrowsecurity and relnamespace = 'public'::regnamespace`)).length === 1
    && (await q(`select 1 from information_schema.role_table_grants where table_name = 'revisiones_semanales' and grantee in ('anon', 'PUBLIC')`)).length === 0,
    'la tabla: con sus permisos por fila y nada para anon');
  const nuevas040 = ['revision_semanal_valida', 'revision_semanal_preparar'];
  const malosSp040 = await q(`select p.oid::regprocedure::text f from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any($1) and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))`, [nuevas040]);
  check(!malosSp040.length && (await q(`select count(*)::int n from pg_proc where proname = any($1) and not prosecdef`, [nuevas040]))[0].n === 2, 'sus funciones, con search_path vacío y sin permisos de su dueño');
  const valida = async (l, n) => (await q(`select public.revision_semanal_valida($1::date, $2) ok`, [l, n]))[0].ok;
  check(await valida('2026-11-02', null) && await valida('2026-11-02', 'x'.repeat(500)) && !(await valida('2026-11-03', null)) && !(await valida('2026-11-02', 'x'.repeat(501))) && !(await valida(null, null)),
    'el validador: un lunes y una nota de hasta 500 caracteres; lo demás, false (nunca un error)');
  // El coach: escribe, lee y guarda el historial
  await como(pelayo, 'aal2');
  await q(`insert into revisiones_semanales (atleta_id, lunes, hecha, nota) values ($1, '2026-11-02', true, '  Subir 2,5 kg  ')`, [aAna.id]);
  await q(`insert into revisiones_semanales (atleta_id, lunes, hecha, nota) values ($1, '2026-11-09', false, '   ')`, [aAna.id]);
  const mias = await q(`select lunes::text l, hecha, nota from revisiones_semanales where atleta_id = $1 order by lunes`, [aAna.id]);
  check(mias.length === 2 && mias[0].hecha === true && mias[1].nota === null, 'el coach marca la revisión y deja una nota; una por semana (el historial se queda); la nota vacía queda en nada');
  let eLunes = null;
  try { await q(`insert into revisiones_semanales (atleta_id, lunes) values ($1, '2026-11-04')`, [aAna.id]); } catch (e) { eLunes = e.message; }
  check(/revisiones_semanales_validas/.test(eLunes || ''), 'una semana que no empieza en lunes, no');
  let eDoble = null;
  try { await q(`insert into revisiones_semanales (atleta_id, lunes) values ($1, '2026-11-02')`, [aAna.id]); } catch (e) { eDoble = e.message; }
  check(/duplicate|revisiones_semanales_pkey/.test(eDoble || ''), 'una sola por atleta y semana');
  // El atleta (y quien no tiene nada que ver): ni lo ve ni lo escribe
  await como(ana);
  const vistaAna = await q(`select * from revisiones_semanales`);
  let eAna = null;
  try { await q(`insert into revisiones_semanales (atleta_id, lunes, hecha) values ($1, '2026-11-16', true)`, [aAna.id]); } catch (e) { eAna = e.message; }
  await q(`update revisiones_semanales set nota = 'x'`);
  await q(`delete from revisiones_semanales`);
  await como(intruso);
  const vistaIntruso = await q(`select * from revisiones_semanales`);
  await su();
  check(!vistaAna.length && /row-level security/.test(eAna || '') && !vistaIntruso.length && (await q(`select count(*)::int n from revisiones_semanales where nota is distinct from 'x'`))[0].n === 2,
    'el atleta no la ve ni la escribe (ni la cambia ni la borra), ni nadie más');
  // Al borrar al atleta, se van con él
  const [aTmp] = await q(`insert into atletas (nombre) values ('Temporal') returning id`);
  await q(`insert into revisiones_semanales (atleta_id, lunes) values ($1, '2026-11-02')`, [aTmp.id]);
  await q(`delete from atletas where id = $1`, [aTmp.id]);
  check((await q(`select count(*)::int n from revisiones_semanales where atleta_id = $1`, [aTmp.id]))[0].n === 0, 'al borrar un atleta, sus revisiones se van con él');
  await q(`delete from revisiones_semanales`);

  console.log('  · La 040 sin la 039, repetida y sobre una base que ya va por delante');
  const sin39 = new PGlite();
  await sin39.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin39.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '039')) await sin39.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  const sql40 = readFileSync(new URL('../supabase/migraciones/040_revision_semanal.sql', import.meta.url), 'utf8');
  let e40a = null;
  try { await sin39.exec(sql40); } catch (e) { e40a = e.message; }
  check(/Antes de la 040 hace falta la 039/.test(e40a || '') && !(await sin39.query(`select 1 from pg_class where relname = 'revisiones_semanales'`)).rows.length, 'la 040 no se aplica sin la 039 (y no deja nada a medias)');
  await sin39.exec(readFileSync(new URL('../supabase/migraciones/039_videos_tanda_b2.sql', import.meta.url), 'utf8'));
  await sin39.exec(sql40);
  await sin39.exec(`insert into public.atletas (nombre) values ('x'); insert into public.revisiones_semanales (atleta_id, lunes, hecha, nota) select id, '2026-11-02', true, 'n' from public.atletas where nombre = 'x'`);
  await sin39.exec(sql40);
  check((await sin39.query(`select count(*)::int n from fbe_migraciones where numero = 40`)).rows[0].n === 1 && (await sin39.query(`select hecha, nota from revisiones_semanales`)).rows[0]?.nota === 'n',
    'con la 039, se aplica; repetida, queda apuntada una vez y no toca lo guardado');
  await sin39.exec(`insert into public.fbe_migraciones (numero) values (41)`);
  let e40b = null;
  try { await sin39.exec(sql40); } catch (e) { e40b = e.message; }
  check(/ya tiene la migración 041/.test(e40b || ''), 'ni en una base que ya tiene una posterior');
  await sin39.close();
}

console.log('\nLa comunidad, primera tanda de mejoras: bienvenida, entrenando ahora, respuestas, 💪 a comentarios y el resumen del domingo (migración 041)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const { VERSION_COMUNIDAD: version, VERSION_NORMAS: normas } = await import('../web/src/datos/api.js');
  const { textoResumenDomingo } = await import('../web/src/logica/comunidad.js');
  await su();
  check((await q(`select relname from pg_class where relname in ('comunidad_bienvenidas', 'comunidad_comentario_reacciones') and relrowsecurity and relnamespace = 'public'::regnamespace`)).length === 2
    && (await q(`select 1 from information_schema.role_table_grants where table_name in ('comunidad_bienvenidas', 'comunidad_comentario_reacciones') and (grantee in ('anon', 'PUBLIC') or (grantee = 'authenticated' and privilege_type <> 'SELECT'))`)).length === 0,
    'las tablas nuevas: con sus permisos por fila, solo lectura para la app y nada para anon');
  const nuevas041 = ['comunidad_comentario_visible', 'comunidad_respuesta_valida', 'comunidad_reaccionar_comentario', 'comunidad_nuevos', 'comunidad_dar_bienvenida',
    'comunidad_entrenando_visible', 'comunidad_entrenando_ahora', 'comunidad_texto_resumen', 'comunidad_comentario_responder', 'comunidad_al_responder_comentario', 'comunidad_resumen_de_la_semana'];
  check(!(await q(`select 1 from pg_proc p where p.proname = any($1) and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))`, [nuevas041])).length
    && !(await q(`select 1 from pg_proc where proname = any($1) and (has_function_privilege('anon', oid, 'execute') or (pronamespace = 'fbe_privado'::regnamespace and has_function_privilege('authenticated', oid, 'execute')))`, [nuevas041])).length,
    'sus funciones, con search_path vacío, ninguna para anon y las internas solo para la base');
  check(await n(`select count(*)::int n from pg_proc where proname = 'comunidad_respuesta_valida' and public.comunidad_respuesta_valida(null, gen_random_uuid()) = false and public.comunidad_respuesta_valida(gen_random_uuid(), gen_random_uuid()) = false and public.comunidad_respuesta_valida(null, null)`) === 1
    && (await q(`select * from comunidad_texto_resumen(0, 2, 1)`)).length === 0 && (await q(`select * from comunidad_texto_resumen(null, null, null)`)).length === 0,
    'los validadores: una respuesta a algo que no existe o sin publicación da false (nunca un error); sin sesiones, el resumen no tiene texto');
  const textos = [[42, 3, 5], [1, 1, 0], [7, 0, 2], [2, null, null]];
  let igualesJs = true;
  for (const [s, r, c] of textos) {
    const [sq] = await q(`select * from comunidad_texto_resumen($1, $2, $3)`, [s, r, c]);
    const js = textoResumenDomingo({ sesiones: s, records: r, semana_completa: c });
    if (!sq || sq.titulo !== js?.titulo || sq.cuerpo !== js?.cuerpo) igualesJs = false;
  }
  const [t42] = await q(`select * from comunidad_texto_resumen(42, 3, 5)`);
  check(igualesJs && t42.titulo === 'Esta semana en el equipo: 42 sesiones, 3 récords' && t42.cuerpo === '5 con la semana completa. Míralo en Equipo.',
    `el texto del resumen, igual en la base y en la app: «${t42.titulo}» · «${t42.cuerpo}»`);

  // Ana y Luis, dentro (y activos); avisos por email para los tres, para ver lo que les llega
  await q(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await q(`update comunidad_ajustes set activa = true`);
  await q(`update comunidad_miembros set bloqueado = false, salido_en = coalesce(salido_en, now()) where perfil_id = any($1::uuid[])`, [[ana, luis]]);
  for (const u of [pelayo, ana, luis]) await q(`insert into preferencias_notificaciones (usuario_id, email, desactivados) values ($1, true, '{sesion_hecha}') on conflict (usuario_id) do update set email = true, desactivados = '{sesion_hecha}', silencio_desde = null, silencio_hasta = null`, [u]);
  await q(`delete from notificaciones`);
  await como(ana); await q(`select comunidad_unirme('Ana L.', $1, $2)`, [version, normas]);
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);
  await su();
  await q(`update comunidad_miembros set creado_en = now() - interval '2 days' where perfil_id = $1`, [luis]);

  console.log('  · Bienvenida a los nuevos');
  await como(ana);
  let nuevos = await q(`select * from comunidad_nuevos()`);
  check(nuevos.length === 1 && nuevos[0].perfil_id === luis && nuevos[0].nombre === 'Luis M.' && nuevos[0].bienvenida === false
    && Object.keys(nuevos[0]).sort().join() === 'bienvenida,desde,foto,nombre,perfil_id',
    'Ana ve que Luis acaba de entrar (nunca a sí misma): nombre, foto, desde cuándo y si ya le ha dado la bienvenida');
  check(await falla(`select comunidad_dar_bienvenida($1)`, [ana]), 'nunca a uno mismo');
  await q(`select comunidad_dar_bienvenida($1)`, [luis]);
  check(await falla(`select comunidad_dar_bienvenida($1)`, [luis]) && (await q(`select bienvenida from comunidad_nuevos()`))[0].bienvenida === true, 'una vez por persona (y ya sale dada)');
  await su();
  check(await n(`select count(*)::int n from notificaciones where usuario_id = $1 and clave = $2 and titulo = 'Ana L. te da la bienvenida 👋' and url = '#equipo'`, [luis, `comunidad_bienvenida:${ana}`]) === 1,
    'a Luis le llega «Ana L. te da la bienvenida 👋» (sin más texto)');
  await como(luis);
  check(await n(`select count(*)::int n from comunidad_bienvenidas where para = $1 and de = $2`, [luis, ana]) === 1, 'Luis ve quién le ha dado la bienvenida');
  await como(pelayo, 'aal2');
  check((await q(`select perfil_id from comunidad_nuevos() order by nombre`)).map((x) => x.perfil_id).join() === [ana, luis].join() && (await q(`select 1 from comunidad_bienvenidas`)).length === 1,
    'el coach ve a los nuevos (los dos) y las bienvenidas, y también la da');
  await q(`select comunidad_dar_bienvenida($1)`, [ana]);
  await como(intruso);
  check(!(await q(`select * from comunidad_nuevos()`)).length && await falla(`select comunidad_dar_bienvenida($1)`, [luis]) && !(await q(`select * from comunidad_bienvenidas`)).length,
    'una cuenta de fuera: ni ve a los nuevos ni da la bienvenida ni ve ninguna');
  await su();
  await q(`update comunidad_miembros set creado_en = now() - interval '8 days' where perfil_id = $1`, [luis]);
  await como(ana);
  check(!(await q(`select * from comunidad_nuevos()`)).length, 'pasada su primera semana, ya no sale');
  await su();
  await q(`update comunidad_miembros set creado_en = now() - interval '2 days' where perfil_id = $1`, [luis]);
  await q(`update comunidad_miembros set sin_ranking = true where perfil_id = $1`, [luis]);
  await como(ana);
  check((await q(`select * from comunidad_nuevos()`)).length === 1, 'quien no sale en el ranking sí sale como nuevo (entrar no es el ranking)');
  await su();
  await q(`update comunidad_miembros set sin_ranking = false, version = 'comunidad-2026-11' where perfil_id = $1`, [luis]);
  await como(ana);
  check(!(await q(`select * from comunidad_nuevos()`)).length && !(await q(`select * from comunidad_bienvenidas where para = $1`, [luis])).length,
    'sin el texto vigente aceptado, no sale (ni su bienvenida para quien se la dio)');
  await su();
  await q(`update comunidad_miembros set version = $2 where perfil_id = $1`, [luis, version]);

  console.log('  · Entrenando ahora');
  await su();
  const [sesL] = await q(`select s.id from sesiones s join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id
    where b.atleta_id = $1 and not b.es_plantilla and w.programacion = 'programada' and exists (select 1 from sesion_ejercicios se where se.sesion_id = s.id) order by s.id limit 1`, [aLuis.id]);
  const [pautaL] = await q(`select id from sesion_ejercicios where sesion_id = $1 order by orden limit 1`, [sesL.id]);
  const estadoSesL = (await q(`select completada, fecha_realizada from sesiones where id = $1`, [sesL.id]))[0];
  await q(`update sesiones set completada = false where id = $1`, [sesL.id]);
  await q(`delete from series where sesion_ejercicio_id = $1 and numero = 9`, [pautaL.id]);
  const [serieL] = await q(`insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps) values ($1, $2, 9, 40, 8) returning id`, [pautaL.id, aLuis.id]);
  await q(`update series set registrada_en = now() - interval '5 minutes' where id = $1`, [serieL.id]);
  check((await q(`select ver_entrenando from comunidad_miembros where perfil_id = $1`, [luis]))[0].ver_entrenando === false, '«Que el equipo vea cuándo estoy entrenando», apagado de entrada');
  await como(ana);
  check(!(await q(`select * from comunidad_entrenando_ahora()`)).length, 'sin encenderlo, Luis no sale aunque esté entrenando');
  await como(luis);
  check((await q(`select comunidad_entrenando_visible(true) v`))[0].v === true && !(await q(`select * from comunidad_entrenando_ahora()`)).length, 'Luis lo enciende (y no se ve a sí mismo)');
  await como(ana);
  let ahora = await q(`select * from comunidad_entrenando_ahora()`);
  check(ahora.length === 1 && ahora[0].perfil_id === luis && Object.keys(ahora[0]).sort().join() === 'foto,nombre,perfil_id', 'Ana le ve entrenando: solo su nombre y su foto (ni horas ni nada de la sesión)');
  await como(pelayo, 'aal2');
  check((await q(`select * from comunidad_entrenando_ahora()`)).length === 1, 'el coach, también');
  await como(intruso);
  check(!(await q(`select * from comunidad_entrenando_ahora()`)).length && await falla(`select comunidad_entrenando_visible(true)`), 'una cuenta de fuera: ni lo ve ni lo enciende');
  await su();
  await q(`update series set registrada_en = now() - interval '25 minutes' where id = $1`, [serieL.id]);
  await como(ana);
  const pasados20 = (await q(`select * from comunidad_entrenando_ahora()`)).length;
  await su();
  await q(`update series set registrada_en = now() - interval '2 minutes' where id = $1`, [serieL.id]);
  await q(`update sesiones set completada = true, fecha_realizada = coalesce(fecha_realizada, current_date) where id = $1`, [sesL.id]);
  await como(ana);
  const terminada = (await q(`select * from comunidad_entrenando_ahora()`)).length;
  await su();
  await q(`update sesiones set completada = false where id = $1`, [sesL.id]);
  await q(`update comunidad_miembros set salido_en = now() where perfil_id = $1`, [luis]);
  await como(ana);
  const salido = (await q(`select * from comunidad_entrenando_ahora()`)).length;
  check(pasados20 === 0 && terminada === 0 && salido === 0, 'no sale con la última serie de hace más de 20 minutos, con la sesión terminada ni si ha salido del equipo');
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);
  await su();
  check((await q(`select ver_entrenando from comunidad_miembros where perfil_id = $1`, [luis]))[0].ver_entrenando === false, '(revisión) al salir se apaga: al volver a entrar empieza apagado y hay que encenderlo otra vez');
  await q(`delete from series where id = $1`, [serieL.id]);
  await q(`update sesiones set completada = $2, fecha_realizada = $3 where id = $1`, [sesL.id, estadoSesL.completada, estadoSesL.fecha_realizada]);

  console.log('  · Responder a un comentario y 💪 a un comentario');
  await como(ana);
  const [postA] = await q(`insert into comunidad_posts (texto) values ('Hoy, pierna') returning id`);
  const [postB] = await q(`insert into comunidad_posts (texto) values ('Otra cosa') returning id`);
  await como(luis);
  const [cL] = await q(`insert into comunidad_comentarios (post_id, texto) values ($1, '¡Bien!') returning id`, [postA.id]);
  const [cLB] = await q(`insert into comunidad_comentarios (post_id, texto) values ($1, 'En la otra') returning id`, [postB.id]);
  await como(pelayo, 'aal2');
  const [cP] = await q(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Muy bien los dos') returning id`, [postA.id]);
  await su();
  await q(`delete from notificaciones`);
  await como(ana);
  const [r1] = await q(`insert into comunidad_comentarios (post_id, texto, responde_a) values ($1, 'Gracias', $2) returning responde_a`, [postA.id, cL.id]);
  const [r2] = await q(`insert into comunidad_comentarios (post_id, texto, responde_a) values ($1, 'Y otra', (select id from comunidad_comentarios where texto = 'Gracias')) returning responde_a`, [postA.id]);
  check(r1.responde_a === cL.id && r2.responde_a === cL.id, 'Ana responde al comentario de Luis; responder a una respuesta cuelga del mismo comentario (un solo nivel)');
  check(await falla(`insert into comunidad_comentarios (post_id, texto, responde_a) values ($1, 'x', $2)`, [postA.id, cLB.id])
    && await falla(`insert into comunidad_comentarios (post_id, texto, responde_a) values ($1, 'x', gen_random_uuid())`, [postA.id]),
    'no a un comentario de otra publicación ni a uno que no existe');
  await su();
  check(await n(`select count(*)::int n from notificaciones where usuario_id = $1 and titulo = 'Ana L. ha respondido a tu comentario' and clave like $2`, [luis, `comunidad:${postA.id}:r%`]) === 1,
    'a Luis le llega «Ana L. ha respondido a tu comentario» (una por publicación y hora)');
  await como(luis);
  await q(`insert into comunidad_comentarios (post_id, texto, responde_a) values ($1, 'De nada', (select id from comunidad_comentarios where texto = 'Gracias'))`, [postA.id]);
  await su();
  check(await n(`select count(*)::int n from notificaciones where usuario_id = $1 and clave like 'comunidad:%:r%'`, [ana]) === 0, 'a la autora de la publicación no le llega dos veces (ya le llega «ha comentado tu publicación»)');
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderar_comentario($1, true)`, [cP.id]);
  await como(ana);
  check(await falla(`insert into comunidad_comentarios (post_id, texto, responde_a) values ($1, 'x', $2)`, [postA.id, cP.id]), 'ni a uno oculto por el coach (no lo ve)');
  // 💪
  await como(luis);
  const [cA] = await q(`select id from comunidad_comentarios where texto = 'Gracias'`);
  check((await q(`select comunidad_reaccionar_comentario($1) v`, [cA.id]))[0].v === true && (await q(`select comunidad_reaccionar_comentario($1) v`, [cA.id]))[0].v === false
    && (await q(`select comunidad_reaccionar_comentario($1) v`, [cA.id]))[0].v === true, 'Luis da 💪 al comentario de Ana; otra vez lo quita (uno por persona)');
  check(await falla(`select comunidad_reaccionar_comentario($1)`, [cP.id]), 'no a un comentario oculto');
  await como(ana);
  check(await n(`select count(*)::int n from comunidad_comentario_reacciones where comentario_id = $1`, [cA.id]) === 1, 'Ana ve el 💪 de su comentario');
  await como(intruso);
  check(await falla(`select comunidad_reaccionar_comentario($1)`, [cA.id]) && !(await q(`select * from comunidad_comentario_reacciones`)).length
    && !(await q(`select responde_a from comunidad_comentarios`)).length, 'una cuenta de fuera: ni reacciona ni ve nada');
  check(await falla(`insert into comunidad_comentario_reacciones (comentario_id, autor_id) values ($1, $2)`, [cA.id, intruso]), 'y nadie escribe en la tabla a mano');
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderar_comentario($1, false)`, [cP.id]);

  console.log('  · El resumen del domingo');
  await su();
  const hoyM = (await q(`select (now() at time zone 'Europe/Madrid')::date d`))[0].d;
  const lunesM = (await q(`select fbe_privado.comunidad_lunes() d`))[0].d;
  const [sesA] = await q(`select s.id, s.completada, s.fecha_realizada from sesiones s join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id
    where b.atleta_id = $1 and not b.es_plantilla and b.estado <> 'cancelado' and w.programacion = 'programada' and w.fecha_inicio = $2 order by s.orden limit 1`, [aAna.id, lunesM]);
  if (sesA) await q(`update sesiones set completada = true, fecha_realizada = $2 where id = $1`, [sesA.id, hoyM]);
  await q(`delete from notificaciones`);
  const [esperado] = await q(`select t.* from fbe_privado.comunidad_resumen_de_la_semana() r cross join lateral comunidad_texto_resumen(r.sesiones, r.records, r.semana_completa) t`);
  const domingo = '2026-11-08';
  const enM = (d, h) => `('${d} ${h}'::timestamp at time zone 'Europe/Madrid')`;
  await q(`select crear_recordatorios(${enM(domingo, '18:30')})`);
  await q(`select crear_recordatorios(${enM('2026-11-07', '20:00')})`);
  const antes = await n(`select count(*)::int n from notificaciones where clave like 'comunidad_resumen:%'`);
  await q(`update preferencias_notificaciones set desactivados = '{sesion_hecha,comunidad}' where usuario_id = $1`, [luis]);
  await q(`select crear_recordatorios(${enM(domingo, '20:00')})`);
  await q(`select crear_recordatorios(${enM(domingo, '20:01')})`);
  const res = await q(`select usuario_id, titulo, cuerpo, url, caduca_en from notificaciones where clave = $1 order by usuario_id`, [`comunidad_resumen:${domingo}`]);
  check(!!sesA && !!esperado && antes === 0 && res.length === 2 && res.every((x) => x.titulo === esperado.titulo && x.cuerpo === esperado.cuerpo && x.url === '#equipo')
    && res.some((x) => x.usuario_id === ana) && res.some((x) => x.usuario_id === pelayo) && !res.some((x) => x.usuario_id === luis),
    `el domingo por la tarde (y no antes ni otro día), una vez: «${esperado?.titulo}» a los de dentro y al coach, sin quien ha apagado «Equipo»`);
  await q(`delete from notificaciones`);
  await q(`update comunidad_ajustes set activa = false`);
  await q(`select crear_recordatorios(${enM(domingo, '20:30')})`);
  check(await n(`select count(*)::int n from notificaciones where clave like 'comunidad_resumen:%'`) === 0, 'con la comunidad cerrada, no sale');
  await q(`update comunidad_ajustes set activa = true`);
  await q(`update preferencias_notificaciones set desactivados = '{sesion_hecha}' where usuario_id = $1`, [luis]);
  if (sesA) await q(`update sesiones set completada = $2, fecha_realizada = $3 where id = $1`, [sesA.id, sesA.completada, sesA.fecha_realizada]);

  console.log('  · Descargar mis datos y salir borrando');
  await como(luis);
  const datosL = (await q(`select comunidad_mis_datos() d`))[0].d;
  check(datosL.reacciones_comentarios?.length === 1 && Array.isArray(datosL.bienvenidas_dadas) && datosL.bienvenidas_recibidas?.length === 1 && !('de' in datosL.bienvenidas_recibidas[0])
    && typeof datosL.miembro.ver_entrenando === 'boolean' && datosL.comentarios.some((c) => 'responde_a' in c),
    '«Descargar mis datos» lleva sus 💪 a comentarios, las bienvenidas (las recibidas, solo cuándo), «entrenando ahora» y a qué responde cada comentario');
  await q(`select comunidad_salir(true)`);
  await su();
  check(await n(`select count(*)::int n from comunidad_bienvenidas where de = $1 or para = $1`, [luis]) === 0 && await n(`select count(*)::int n from comunidad_comentario_reacciones where autor_id = $1`, [luis]) === 0,
    'salir borrando se lleva sus bienvenidas (dadas y recibidas) y sus 💪 a comentarios');
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);
  await como(ana);
  await q(`delete from comunidad_posts where id = any($1::uuid[])`, [[postA.id, postB.id]]);
  await su();
  await q(`delete from notificaciones`);

  console.log('  · La 041 sin la 040, repetida y sobre una base que ya va por delante');
  const sin40 = new PGlite();
  await sin40.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin40.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '040')) await sin40.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  const sql41 = readFileSync(new URL('../supabase/migraciones/041_comunidad_animo.sql', import.meta.url), 'utf8');
  let e41a = null;
  try { await sin40.exec(sql41); } catch (e) { e41a = e.message; }
  check(/Antes de la 041 hace falta la 040/.test(e41a || '') && !(await sin40.query(`select 1 from pg_class where relname = 'comunidad_bienvenidas'`)).rows.length, 'la 041 no se aplica sin la 040 (y no deja nada a medias)');
  await sin40.exec(readFileSync(new URL('../supabase/migraciones/040_revision_semanal.sql', import.meta.url), 'utf8'));
  await sin40.exec(sql41);
  await sin40.exec(`insert into auth.users (email) values ('a@x'), ('b@x'); insert into public.comunidad_bienvenidas (de, para) select (select id from auth.users where email = 'a@x'), (select id from auth.users where email = 'b@x')`);
  await sin40.exec(sql41);
  check((await sin40.query(`select count(*)::int n from fbe_migraciones where numero = 41`)).rows[0].n === 1 && (await sin40.query(`select count(*)::int n from comunidad_bienvenidas`)).rows[0].n === 1,
    'con la 040, se aplica; repetida, queda apuntada una vez y no toca lo guardado');
  await sin40.exec(`insert into public.fbe_migraciones (numero) values (42)`);
  let e41b = null;
  try { await sin40.exec(sql41); } catch (e) { e41b = e.message; }
  check(/ya tiene la migración 042/.test(e41b || ''), 'ni en una base que ya tiene una posterior');
  await sin40.close();
}

console.log('\nLa comunidad, segunda tanda: compañeros de racha, retos por equipos, de cardio y de semanas, e insignias (migración 042)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const { VERSION_COMUNIDAD: version, VERSION_NORMAS: normas } = await import('../web/src/datos/api.js');
  const C = await import('../web/src/logica/comunidad.js');
  await su();
  check((await q(`select relname from pg_class where relname in ('comunidad_companeros', 'comunidad_reto_equipos') and relrowsecurity and relnamespace = 'public'::regnamespace`)).length === 2
    && (await q(`select 1 from information_schema.role_table_grants where table_name in ('comunidad_companeros', 'comunidad_reto_equipos') and (grantee in ('anon', 'PUBLIC') or (grantee = 'authenticated' and privilege_type <> 'SELECT'))`)).length === 0,
    'las tablas nuevas: con sus permisos por fila, solo lectura para la app y nada para anon');
  const nuevas042 = ['comunidad_reto_maximo', 'comunidad_equipos_validos', 'comunidad_valor', 'comunidad_valor_reto', 'comunidad_total_equipo', 'comunidad_rachas_pareja', 'comunidad_semana_completa',
    'comunidad_companeros_ocupados', 'comunidad_insignias_de', 'comunidad_retos_equipos', 'comunidad_reto_equipos_guardar', 'comunidad_sesiones_recientes', 'comunidad_cardio_en_retos',
    'comunidad_invitar_companero', 'comunidad_responder_companero', 'comunidad_dejar_companero', 'comunidad_companeros', 'comunidad_insignias'];
  check(!(await q(`select 1 from pg_proc p where p.proname = any($1) and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))`, [nuevas042])).length
    && (await q(`select count(distinct proname)::int n from pg_proc where proname = any($1)`, [nuevas042]))[0].n === nuevas042.length
    && !(await q(`select 1 from pg_proc where proname = any($1) and (has_function_privilege('anon', oid, 'execute') or (pronamespace = 'fbe_privado'::regnamespace and has_function_privilege('authenticated', oid, 'execute')))`, [nuevas042])).length,
    'sus funciones, con search_path vacío, ninguna para anon y las internas solo para la base');
  check((await q(`select comunidad_reto_maximo('individual', 'sesiones') a, comunidad_reto_maximo('equipos', 'cardio') b, comunidad_reto_maximo('x', 'sesiones') c, comunidad_reto_maximo(null, null) d`))
    .map((x) => [x.a, x.b, x.c, x.d].join()).join() === [C.retoMaximo('individual', 'sesiones'), C.retoMaximo('equipos', 'cardio'), 0, 0].join()
    && (await q(`select comunidad_equipos_validos(array['Rojos', 'Azules']) a, comunidad_equipos_validos(array['Rojos', 'rojos']) b, comunidad_equipos_validos(array['Uno']) c,
      comunidad_equipos_validos(null) d, comunidad_equipos_validos(array['A', 'B', 'C']) e, comunidad_equipos_validos(array[' A', 'B']) f, comunidad_equipos_validos(array[array['A', 'B'], array['C', 'D']]) g`))
      .map((x) => [x.a, x.b, x.c, x.d, x.e, x.f, x.g].join()).join() === 'true,false,false,false,false,false,false',
    'los validadores: el máximo de cada reto (como la app; con algo raro, 0) y los nombres de los equipos (dos, distintos, sin espacios sobrantes), nunca un error');

  // Eva entra también (tres dentro: Ana, Luis y Eva)
  const eva = await nuevoUsuario('eva-v070@test');
  await su();
  const [aEva] = await q(`insert into atletas (nombre, perfil_id, estado) values ('Eva', $1, 'activo') returning id`, [eva]);
  await q(`update comunidad_ajustes set activa = true`);
  await q(`update comunidad_miembros set sin_ranking = false where perfil_id = any($1::uuid[])`, [[ana, luis]]);
  await q(`insert into preferencias_notificaciones (usuario_id, email, desactivados) values ($1, true, '{sesion_hecha}') on conflict (usuario_id) do update set email = true`, [eva]);
  await como(eva); await q(`select comunidad_unirme('Eva R.', $1, $2)`, [version, normas]);
  await su(); await q(`delete from notificaciones`);

  console.log('  · Compañeros de racha');
  await como(ana);
  check(await falla(`select comunidad_invitar_companero($1)`, [ana]), 'nunca uno mismo');
  const parejaAL = (await q(`select comunidad_invitar_companero($1) id`, [luis]))[0].id;
  check(await falla(`select comunidad_invitar_companero($1)`, [luis]), 'una invitación por pareja');
  await como(luis);
  check(await falla(`select comunidad_invitar_companero($1)`, [ana]), 'ni al revés (ya hay invitación)');
  let mias = await q(`select * from comunidad_companeros()`);
  check(mias.length === 1 && mias[0].perfil_id === ana && mias[0].estado === 'pendiente' && mias[0].invito === false && mias[0].racha === null,
    'Luis ve la invitación de Ana (pendiente)');
  await su();
  check(await n(`select count(*)::int n from notificaciones where usuario_id = $1 and titulo = 'Ana L. te invita a ser compañeros de racha' and url = '#equipo'`, [luis]) === 1,
    'a Luis le llega «Ana L. te invita a ser compañeros de racha» (sin más texto)');
  await como(eva);
  check(await falla(`select comunidad_responder_companero($1, true)`, [parejaAL]) && !(await q(`select * from comunidad_companeros`)).length && !(await q(`select * from comunidad_companeros($1)`, [ana])).length,
    'Eva no responde por Luis, ni ve la invitación (ni en la tabla ni en el perfil de Ana)');
  await como(luis);
  check((await q(`select comunidad_responder_companero($1, true) v`, [parejaAL]))[0].v === true, 'Luis acepta');
  await su();
  check(await n(`select count(*)::int n from notificaciones where usuario_id = $1 and titulo = 'Luis M. y tú ya sois compañeros de racha'`, [ana]) === 1
    && await n(`select count(*)::int n from notificaciones where usuario_id = $1 and clave like 'comunidad_companero:%'`, [luis]) === 0,
    'a Ana le llega que ya son compañeros (y a Luis se le retira el aviso de la invitación)');
  await como(eva);
  let vistas = await q(`select * from comunidad_companeros($1)`, [ana]);
  check(vistas.length === 1 && vistas[0].perfil_id === luis && Number.isInteger(vistas[0].racha) && vistas[0].mi_semana === null && vistas[0].su_semana === null
    && !(await q(`select * from comunidad_companeros`)).length, 'Eva ve la pareja en el perfil de Ana (con su racha), pero no cómo va la semana de cada uno ni la tabla');
  await como(ana);
  mias = await q(`select * from comunidad_companeros()`);
  check(mias.length === 1 && mias[0].estado === 'aceptada' && mias[0].invito === true && (await q(`select * from comunidad_companeros`)).length === 1, 'Ana ve su pareja (y su fila)');
  await como(pelayo, 'aal2');
  check((await q(`select * from comunidad_companeros`)).length === 1 && (await q(`select * from comunidad_companeros($1)`, [luis])).length === 1, 'el coach, todas');
  await como(intruso);
  check(!(await q(`select * from comunidad_companeros($1)`, [ana])).length && !(await q(`select * from comunidad_companeros`)).length && await falla(`select comunidad_invitar_companero($1)`, [ana]),
    'una cuenta de fuera: ni las ve ni invita');
  check(await falla(`insert into comunidad_companeros (de, para) values ($1, $2)`, [intruso, ana]), 'y nadie escribe en la tabla a mano');
  // «No salir en el ranking»: la pareja la ven solo ellos dos (y el coach)
  await su(); await q(`update comunidad_miembros set sin_ranking = true where perfil_id = $1`, [luis]);
  await como(eva);
  const evaSin = (await q(`select * from comunidad_companeros($1)`, [ana])).length + (await q(`select * from comunidad_companeros($1)`, [luis])).length;
  await como(ana);
  const anaSin = (await q(`select * from comunidad_companeros()`)).length;
  await como(pelayo, 'aal2');
  const coachSin = (await q(`select * from comunidad_companeros($1)`, [ana])).length;
  check(evaSin === 0 && anaSin === 1 && coachSin === 1, 'si uno no sale en el ranking, la pareja la ven solo ellos dos y el coach');
  await su(); await q(`update comunidad_miembros set sin_ranking = false where perfil_id = $1`, [luis]);
  // Rechazar y retirar
  await como(ana);
  const parejaAE = (await q(`select comunidad_invitar_companero($1) id`, [eva]))[0].id;
  await como(luis);
  check(await falla(`select comunidad_dejar_companero($1)`, [parejaAE]), 'Luis no termina la pareja de otros');
  await como(eva);
  check((await q(`select comunidad_responder_companero($1, false) v`, [parejaAE]))[0].v === false && !(await q(`select * from comunidad_companeros()`)).length, 'Eva dice «Ahora no»: la invitación desaparece');

  console.log('  · La racha de la pareja');
  await su();
  const lunesM = (await q(`select fbe_privado.comunidad_lunes() d`))[0].d;
  const lunesISO = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
  const semanasDe = async (atleta) => (await q(`select lunes, previstas, hechas from fbe_privado.comunidad_semanas_de(array[$1::uuid])`, [atleta])).map((x) => ({ ...x, lunes: lunesISO(x.lunes) }));
  const sesActual = async (atleta) => (await q(`select s.id, s.completada, s.fecha_realizada, s.cardio_hecho from sesiones s join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id
    where b.atleta_id = $1 and not b.es_plantilla and b.estado <> 'cancelado' and w.programacion = 'programada' and w.fecha_inicio = $2 order by s.orden`, [atleta, lunesM]));
  const sesA = await sesActual(aAna.id), sesL = await sesActual(aLuis.id);
  const hoyM = (await q(`select (now() at time zone 'Europe/Madrid')::date d`))[0].d;
  const rachaSql = async (a, b, desde = null) => (await q(`select * from fbe_privado.comunidad_rachas_pareja($1, $2, $3)`, [a, b, desde]))[0];
  const igualJs = async () => {
    const js = C.rachaPareja(await semanasDe(aAna.id), await semanasDe(aLuis.id), { lunesHoy: lunesISO(lunesM) });
    const sql = await rachaSql(aAna.id, aLuis.id);
    return { js, sql, igual: js.racha === sql.racha && js.mejor === sql.mejor };
  };
  for (const s of sesL) await q(`update sesiones set completada = true, fecha_realizada = $2 where id = $1`, [s.id, hoyM]);
  for (const s of sesA) await q(`update sesiones set completada = false where id = $1`, [s.id]);
  const r1 = await igualJs();
  for (const s of sesA) await q(`update sesiones set completada = true, fecha_realizada = $2 where id = $1`, [s.id, hoyM]);
  const r2 = await igualJs();
  check(sesA.length > 0 && sesL.length > 0 && r1.igual && r2.igual && r2.sql.racha === r1.sql.racha + 1,
    `la racha de los dos, igual en la base y en la app; esta semana suma solo cuando los dos la completan (${r1.sql.racha} → ${r2.sql.racha})`);
  const sola = (await q(`select racha from fbe_privado.comunidad_rachas_de(array[$1::uuid])`, [aLuis.id]))[0].racha;
  check((await rachaSql(aLuis.id, aLuis.id)).racha === sola && (await rachaSql(aAna.id, aLuis.id, hoyM)).racha === 1,
    'con el mismo atleta dos veces, su racha de siempre; contando desde que aceptaron (esta semana), 1');
  await como(ana);
  check((await q(`select racha, mi_semana, su_semana from comunidad_companeros()`))[0].mi_semana === true, 'cada uno de la pareja ve si su semana está completa');

  console.log('  · El aviso del sábado');
  await su();
  for (const s of sesA) await q(`update sesiones set completada = false where id = $1`, [s.id]);
  await q(`delete from notificaciones`);
  const sabado = lunesISO(new Date(Date.parse(`${lunesISO(lunesM)}T12:00:00Z`) + 5 * 864e5));
  const enM = (d, h) => `('${d} ${h}'::timestamp at time zone 'Europe/Madrid')`;
  await q(`select crear_recordatorios(${enM(sabado, '18:30')})`);
  const antes = await n(`select count(*)::int n from notificaciones where clave like 'comunidad_pareja:%'`);
  await q(`select crear_recordatorios(${enM(sabado, '20:00')})`);
  await q(`select crear_recordatorios(${enM(sabado, '21:00')})`);
  const sab = await q(`select usuario_id, titulo, url, clave from notificaciones where clave like 'comunidad_pareja:%'`);
  check(antes === 0 && sab.length === 1 && sab[0].usuario_id === ana && sab[0].titulo === 'Luis M. ya ha completado su semana: ¿cerráis la racha?' && sab[0].url === '#equipo'
    && sab[0].clave === `comunidad_pareja:${parejaAL}:${lunesISO(lunesM)}`,
    'el sábado por la tarde (no antes), una vez: a Ana, «Luis M. ya ha completado su semana: ¿cerráis la racha?» (y nada a Luis)');
  await q(`delete from notificaciones`);
  await q(`update preferencias_notificaciones set desactivados = '{sesion_hecha,comunidad}' where usuario_id = $1`, [ana]);
  await q(`select crear_recordatorios(${enM(sabado, '20:30')})`);
  check(await n(`select count(*)::int n from notificaciones where clave like 'comunidad_pareja:%'`) === 0, 'con «Equipo» apagado en sus notificaciones, no le llega');
  await q(`update preferencias_notificaciones set desactivados = '{sesion_hecha}' where usuario_id = $1`, [ana]);
  await q(`insert into notificaciones (usuario_id, tipo, titulo, cuerpo, url, clave, caduca_en) values ($1, 'comunidad', 'x', 'Míralo en Equipo.', '#equipo', $2, now() + interval '1 day')`, [luis, `comunidad_pareja:${parejaAL}:${lunesISO(lunesM)}`]);
  await q(`select crear_recordatorios(${enM(sabado, '20:45')})`);
  check(await n(`select count(*)::int n from notificaciones where clave like 'comunidad_pareja:%' and usuario_id = $1`, [ana]) === 0, '(revisión) a uno solo de los dos por pareja y semana');
  await q(`delete from notificaciones`);

  console.log('  · Retos por equipos, de cardio y de semanas completas');
  await como(pelayo, 'aal2');
  const desde = lunesISO(new Date(Date.parse(`${lunesISO(lunesM)}T12:00:00Z`) - 7 * 864e5)), hasta = lunesISO(new Date(Date.parse(`${lunesISO(lunesM)}T12:00:00Z`) + 13 * 864e5));
  check(await falla(`insert into comunidad_retos (titulo, desde, hasta, objetivo, modo) values ('X', $1, $2, 10, 'equipos')`, [desde, hasta])
    && await falla(`insert into comunidad_retos (titulo, desde, hasta, objetivo, modo, equipos) values ('X', $1, $2, 10, 'equipos', array['A', 'a'])`, [desde, hasta])
    && await falla(`insert into comunidad_retos (titulo, desde, hasta, objetivo, modo, equipos) values ('X', $1, $2, 10, 'individual', array['A', 'B'])`, [desde, hasta])
    && await falla(`insert into comunidad_retos (titulo, desde, hasta, objetivo, medida) values ('X', $1, $2, 53, 'semanas')`, [desde, hasta])
    && await falla(`insert into comunidad_retos (titulo, desde, hasta, objetivo, medida) values ('X', $1, $2, 10, 'kilos')`, [desde, hasta]),
    'la base no deja un reto por equipos sin sus dos nombres (distintos), nombres en otro modo, un objetivo por encima del máximo ni otra medida');
  const [rq] = await q(`insert into comunidad_retos (titulo, desde, hasta, objetivo, modo, equipos) values ('Rojos contra azules', $1, $2, 10, 'equipos', array['Rojos', 'Azules']) returning id`, [desde, hasta]);
  check(await falla(`select comunidad_reto_equipos_guardar($1, array[$2::uuid], array[$2::uuid])`, [rq.id, ana]), 'nadie en los dos equipos');
  check((await q(`select comunidad_reto_equipos_guardar($1, array[$2::uuid], array[$3::uuid, $4::uuid, $5::uuid]) n`, [rq.id, ana, luis, eva, intruso]))[0].n === 3,
    'el coach reparte: Ana en Rojos; Luis y Eva en Azules (a quien no está dentro no lo apunta)');
  check(await n(`select count(*)::int n from comunidad_reto_equipos where reto_id = $1`, [rq.id]) === 3, 'y él ve el reparto');
  await como(eva);
  check(await falla(`select comunidad_reto_equipos_guardar($1, array[$2::uuid], array[]::uuid[])`, [rq.id, eva]) && !(await q(`select * from comunidad_reto_equipos`)).length
    && !(await q(`select * from comunidad_sesiones_recientes()`)).length, 'un atleta ni reparte, ni ve el reparto, ni las sesiones recientes de los demás');
  await como(ana);
  let eqs = await q(`select * from comunidad_retos_equipos() where reto_id = $1 order by equipo`, [rq.id]);
  const totalAzulesCon = eqs[1]?.total;
  check(eqs.length === 2 && eqs[0].nombre === 'Rojos' && eqs[1].nombre === 'Azules' && eqs[0].personas.join() === ana && eqs[1].personas.length === 2 && eqs[1].total >= 1,
    `Ana ve los dos equipos con su nombre, quién va en cada uno y lo que suman (Azules: ${eqs[1]?.total})`);
  await su(); await q(`update comunidad_miembros set sin_ranking = true where perfil_id = $1`, [luis]);
  await como(ana);
  eqs = await q(`select * from comunidad_retos_equipos() where reto_id = $1 order by equipo`, [rq.id]);
  const progAna = await q(`select perfil_id from comunidad_retos_progreso() where reto_id = $1`, [rq.id]);
  await como(pelayo, 'aal2');
  const eqsCoach = await q(`select * from comunidad_retos_equipos() where reto_id = $1 order by equipo`, [rq.id]);
  const progAnaH = await (async () => { await como(ana); return q(`select perfil_id, hechas from comunidad_retos_progreso() where reto_id = $1`, [rq.id]); })();
  const sumaVisible = (e) => progAnaH.filter((x) => e.personas.includes(x.perfil_id)).reduce((n, x) => n + x.hechas, 0);
  check(eqs.every((e) => e.total === sumaVisible(e)) && eqs[1].total < totalAzulesCon && !eqs[1].personas.includes(luis) && !progAna.some((x) => x.perfil_id === luis) && eqsCoach[1].personas.includes(luis),
    `(revisión) quien no sale en el ranking sigue en su equipo, pero no suma ni sale por su nombre: cada total es la suma de lo que se ve (Azules: ${totalAzulesCon} → ${eqs[1].total}; el coach sí le ve en el equipo)`);
  await su(); await q(`update comunidad_miembros set sin_ranking = false where perfil_id = $1`, [luis]);
  await como(intruso);
  check(!(await q(`select * from comunidad_retos_equipos()`)).length, 'una cuenta de fuera no ve los equipos');
  // Cardio: solo de quien cuenta sus minutos
  await su();
  await q(`update sesiones set cardio_hecho = '{"modalidad":"carrera","minutos":30}' where id = $1`, [sesL[0].id]);
  await como(pelayo, 'aal2');
  const [rc] = await q(`insert into comunidad_retos (titulo, desde, hasta, objetivo, medida) values ('Cardio', $1, $2, 120, 'cardio') returning id`, [desde, hasta]);
  const [rs] = await q(`insert into comunidad_retos (titulo, desde, hasta, objetivo, medida) values ('Semanas', $1, $2, 3, 'semanas') returning id`, [desde, hasta]);
  await como(ana);
  const cardioAntes = await q(`select perfil_id, hechas from comunidad_retos_progreso() where reto_id = $1`, [rc.id]);
  await como(luis);
  const suyoAntes = (await q(`select hechas from comunidad_retos_progreso() where reto_id = $1 and yo`, [rc.id]))[0]?.hechas;
  check((await q(`select comunidad_cardio_en_retos(true) v`))[0].v === true, 'Luis enciende «Contar mis minutos de cardio en los retos»');
  await como(ana);
  const cardioDespues = await q(`select perfil_id, hechas from comunidad_retos_progreso() where reto_id = $1`, [rc.id]);
  check(!cardioAntes.some((x) => x.perfil_id === luis) && suyoAntes === 0 && cardioDespues.find((x) => x.perfil_id === luis)?.hechas === 30,
    'en un reto de cardio, los minutos de Luis no salen ni cuentan hasta que lo enciende; después, 30 minutos');
  const semL = (await q(`select hechas from comunidad_retos_progreso() where reto_id = $1 and perfil_id = $2`, [rs.id, luis]))[0]?.hechas;
  await su();
  const semJs = (await semanasDe(aLuis.id)).filter((x) => x.lunes >= desde && x.lunes <= hasta && x.hechas >= x.previstas).length;
  check(Number.isInteger(semL) && semL === semJs && semL >= 1, `un reto de semanas completas cuenta las semanas con todo hecho entre sus fechas (Luis: ${semL})`);
  await como(intruso);
  check(await falla(`select comunidad_cardio_en_retos(true)`), 'una cuenta de fuera no lo enciende');

  console.log('  · Insignias');
  await como(ana);
  await q(`insert into comunidad_posts (texto) values ('Primera de Ana')`);
  const propias = await q(`select clave, valor, meta from comunidad_insignias($1)`, [ana]);
  check(propias.length === 6 && propias.map((x) => x.clave).sort().join() === C.INSIGNIAS.map((x) => x[0]).sort().join() && propias.every((x) => x.valor <= x.meta)
    && propias.find((x) => x.clave === 'primera_publicacion').valor === 1, 'Ana ve sus seis insignias con su progreso (como mucho, la meta)');
  await como(eva);
  const deAna = await q(`select clave, valor, meta from comunidad_insignias($1)`, [ana]);
  check(deAna.length >= 1 && deAna.every((x) => x.valor >= x.meta) && deAna.some((x) => x.clave === 'primera_publicacion'), 'Eva ve de Ana solo las conseguidas');
  const todas = await q(`select distinct perfil_id from comunidad_insignias()`);
  await su(); await q(`update comunidad_miembros set sin_ranking = true where perfil_id = $1`, [ana]);
  await como(eva);
  const deAnaSin = (await q(`select * from comunidad_insignias($1)`, [ana])).length;
  await como(ana);
  const propiasSin = (await q(`select * from comunidad_insignias($1)`, [ana])).length;
  await como(pelayo, 'aal2');
  const coachSinI = (await q(`select * from comunidad_insignias($1)`, [ana])).length;
  check(todas.some((x) => x.perfil_id === ana) && deAnaSin === 0 && propiasSin === 6 && coachSinI === 6, 'de quien no sale en el ranking, ninguna para los demás (él y el coach, todas)');
  await su(); await q(`update comunidad_miembros set sin_ranking = false where perfil_id = $1`, [ana]);
  await como(intruso);
  check(!(await q(`select * from comunidad_insignias()`)).length, 'una cuenta de fuera no ve ninguna');

  console.log('  · Descargar mis datos y salir');
  await como(luis);
  const datosL = (await q(`select comunidad_mis_datos() d`))[0].d;
  check(datosL.companeros?.length === 1 && datosL.companeros[0].con === 'Ana L.' && !('para' in datosL.companeros[0]) && datosL.miembro.cardio_en_retos === true,
    '«Descargar mis datos» lleva sus compañeros de racha (con quién, por su nombre) y si cuenta sus minutos de cardio');
  await q(`select comunidad_salir(false)`);
  await su();
  check(await n(`select count(*)::int n from comunidad_companeros where de = $1 or para = $1`, [luis]) === 0, 'salir del equipo termina sus parejas');
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);
  check(!(await q(`select * from comunidad_companeros()`)).length, 'y al volver no reaparecen');

  console.log('  · (revisión) El máximo de 3, terminar al ser sacado y el aviso de aceptar');
  await su();
  check((await q(`select proname from pg_proc where proname in ('comunidad_invitar_companero', 'comunidad_responder_companero') and pg_get_functiondef(oid) like '%comunidad_bloquear_pareja%'`)).length === 2
    && (await q(`select 1 from pg_proc where proname = 'comunidad_bloquear_pareja' and pg_get_functiondef(oid) like '%pg_advisory_xact_lock%'`)).length === 1,
    'invitar y aceptar bloquean a las dos personas (en el mismo orden) antes de volver a contar');
  await como(ana);
  const p2 = (await q(`select comunidad_invitar_companero($1) id`, [luis]))[0].id;
  await como(luis); await q(`select comunidad_responder_companero($1, true)`, [p2]);
  await su();
  const siAntes = await n(`select count(*)::int n from notificaciones where clave = $1 and estado = 'pendiente'`, [`comunidad_companero_si:${p2}`]);
  await como(luis); await q(`select comunidad_dejar_companero($1)`, [p2]);
  await su();
  check(siAntes === 1 && await n(`select count(*)::int n from notificaciones where clave = $1`, [`comunidad_companero_si:${p2}`]) === 0, 'al terminar la pareja, se retira el aviso pendiente de «ya sois compañeros»');
  await como(ana);
  const p3 = (await q(`select comunidad_invitar_companero($1) id`, [luis]))[0].id;
  await como(luis); await q(`select comunidad_responder_companero($1, true)`, [p3]);
  await como(pelayo, 'aal2');
  await q(`select comunidad_expulsar($1, true)`, [aLuis.id]);
  await su();
  const trasSacar = await n(`select count(*)::int n from comunidad_companeros where $1 in (de, para)`, [luis]);
  await como(pelayo, 'aal2');
  await q(`select comunidad_expulsar($1, false)`, [aLuis.id]);
  await como(luis); await q(`select comunidad_unirme('Luis M.', $1, $2)`, [version, normas]);
  check(trasSacar === 0 && !(await q(`select * from comunidad_companeros()`)).length, 'que el coach le saque termina sus parejas (y al readmitirle no reaparecen)');
  await su();
  const fantasmas = [];
  for (const k of [1, 2, 3]) fantasmas.push(await nuevoUsuario(`fantasma${k}-v070@test`));
  await su();
  for (const f of fantasmas) await q(`insert into comunidad_companeros (de, para) values ($1, $2)`, [ana, f]);
  await como(ana);
  let eTope = '';
  try { await q(`select comunidad_invitar_companero($1)`, [eva]); } catch (e) { eTope = e.message; }
  check(/hasta 3/.test(eTope), 'el máximo de 3 cuenta todas sus parejas e invitaciones, esté como esté la otra persona');
  await su();
  await q(`delete from comunidad_companeros where para = any($1::uuid[])`, [fantasmas]);
  // Lo de esta prueba, como estaba
  await su();
  for (const s of [...sesA, ...sesL]) await q(`update sesiones set completada = $2, fecha_realizada = $3, cardio_hecho = $4 where id = $1`, [s.id, s.completada, s.fecha_realizada, s.cardio_hecho]);
  await q(`delete from comunidad_retos where id = any($1::uuid[])`, [[rq.id, rc.id, rs.id]]);
  await q(`delete from comunidad_posts where autor_id = $1 and texto = 'Primera de Ana'`, [ana]);
  await q(`delete from notificaciones`);
  await como(eva); await q(`select comunidad_salir(true)`);
  await su();
  await q(`delete from atletas where id = $1`, [aEva.id]);

  console.log('  · La 042 sin la 041, repetida y sobre una base que ya va por delante');
  const sin41 = new PGlite();
  await sin41.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin41.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '041')) await sin41.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  const sql42 = readFileSync(new URL('../supabase/migraciones/042_comunidad_constancia.sql', import.meta.url), 'utf8');
  let e42a = null;
  try { await sin41.exec(sql42); } catch (e) { e42a = e.message; }
  check(/Antes de la 042 hace falta la 041/.test(e42a || '') && !(await sin41.query(`select 1 from pg_class where relname = 'comunidad_companeros'`)).rows.length, 'la 042 no se aplica sin la 041 (y no deja nada a medias)');
  await sin41.exec(readFileSync(new URL('../supabase/migraciones/041_comunidad_animo.sql', import.meta.url), 'utf8'));
  await sin41.exec(sql42);
  await sin41.exec(`insert into auth.users (email) values ('a@x'), ('b@x'); insert into public.comunidad_companeros (de, para) select (select id from auth.users where email = 'a@x'), (select id from auth.users where email = 'b@x')`);
  await sin41.exec(sql42);
  check((await sin41.query(`select count(*)::int n from fbe_migraciones where numero = 42`)).rows[0].n === 1 && (await sin41.query(`select count(*)::int n from comunidad_companeros`)).rows[0].n === 1,
    'con la 041, se aplica; repetida, queda apuntada una vez y no toca lo guardado');
  await sin41.exec(`insert into public.fbe_migraciones (numero) values (43)`);
  let e42b = null;
  try { await sin41.exec(sql42); } catch (e) { e42b = e.message; }
  check(/ya tiene la migración 043/.test(e42b || ''), 'ni en una base que ya tiene una posterior');
  await sin41.close();
}

console.log('\nLa comunidad, tercera tanda: temas, preguntas al coach, varias fotos, guardar y buscar, la mejor respuesta (migración 043)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  await su();
  check((await q(`select relname from pg_class where relname in ('comunidad_guardados', 'comunidad_preguntas') and relrowsecurity and relnamespace = 'public'::regnamespace`)).length === 2
    && (await q(`select 1 from information_schema.role_table_grants where table_name in ('comunidad_guardados', 'comunidad_preguntas') and grantee in ('anon', 'PUBLIC')`)).length === 0
    && (await q(`select privilege_type p from information_schema.role_table_grants where table_name = 'comunidad_guardados' and grantee = 'authenticated'`)).map((x) => x.p).join() === 'SELECT'
    && (await q(`select privilege_type p from information_schema.role_table_grants where table_name = 'comunidad_preguntas' and grantee = 'authenticated' order by 1`)).map((x) => x.p).join() === 'DELETE,SELECT',
    'las tablas nuevas: con sus permisos por fila; lo guardado, solo lectura (se escribe con su función); las preguntas frecuentes, leer y quitar; nada para anon');
  const nuevas043 = ['comunidad_tema_valido', 'comunidad_fotos_validas', 'comunidad_post_tema', 'comunidad_al_preguntar', 'comunidad_mejor_retirar', 'comunidad_guardar', 'comunidad_buscar',
    'comunidad_mejor_respuesta', 'comunidad_guardar_pregunta'];
  check(!(await q(`select 1 from pg_proc p where p.proname = any($1) and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))`, [nuevas043])).length
    && (await q(`select count(distinct proname)::int n from pg_proc where proname = any($1)`, [nuevas043]))[0].n === nuevas043.length
    && !(await q(`select 1 from pg_proc where proname = any($1) and (has_function_privilege('anon', oid, 'execute') or (pronamespace = 'fbe_privado'::regnamespace and has_function_privilege('authenticated', oid, 'execute')))`, [nuevas043])).length,
    'sus funciones, con search_path vacío, ninguna para anon y las internas solo para la base');
  check((await q(`select comunidad_tema_valido('tecnica') a, comunidad_tema_valido('pregunta') b, comunidad_tema_valido('otro') c, comunidad_tema_valido(null) d,
      comunidad_fotos_validas(null, null) e, comunidad_fotos_validas(array['coach/abcdefgh.jpg', 'coach/abcdefgi.jpg'], 'coach/abcdefgh.jpg') f,
      comunidad_fotos_validas(array['coach/abcdefgh.jpg'], 'coach/abcdefgh.jpg') g, comunidad_fotos_validas(array['coach/abcdefgh.jpg', 'coach/abcdefgh.jpg'], 'coach/abcdefgh.jpg') h,
      comunidad_fotos_validas(array['coach/abcdefgh.jpg', 'coach/abcdefgi.jpg'], 'coach/zzzzzzzz.jpg') i, comunidad_fotos_validas(array['coach/abcdefgh.jpg', '../x.jpg'], 'coach/abcdefgh.jpg') j,
      comunidad_fotos_validas(array['coach/a1111111.jpg', 'coach/a2222222.jpg', 'coach/a3333333.jpg', 'coach/a4444444.jpg', 'coach/a5555555.jpg'], 'coach/a1111111.jpg') k,
      comunidad_fotos_validas(array[array['coach/abcdefgh.jpg', 'coach/abcdefgi.jpg'], array['coach/abcdefgj.jpg', 'coach/abcdefgk.jpg']], 'coach/abcdefgh.jpg') l`))
    .map((x) => [x.a, x.b, x.c, x.d, x.e, x.f, x.g, x.h, x.i, x.j, x.k, x.l].join()).join() === 'true,true,false,false,true,true,false,false,false,false,false,false',
    'los validadores: los temas y las fotos (de 2 a 4, sin repetir, con su ruta y la primera es foto_ruta), nunca un error');
  await q(`delete from notificaciones`);

  console.log('  · Temas');
  await como(ana);
  check(await falla(`insert into comunidad_posts (texto, tema) values ('Aviso falso', 'avisos')`), 'un atleta no publica con el tema «Avisos»');
  const [pCharla] = await q(`insert into comunidad_posts (texto) values ('Hola equipo, charla 043') returning id, tema, mejor_comentario`);
  const [pRaro] = await q(`insert into comunidad_posts (texto, tema) values ('Tema raro 043', 'otro') returning id, tema`);
  const [pPreg] = await q(`insert into comunidad_posts (texto, tema) values ('¿Cuántas series de calentamiento antes de la sentadilla? zz043', 'pregunta') returning id, tema`);
  check(pCharla.tema === 'charla' && pRaro.tema === 'charla' && pPreg.tema === 'pregunta' && pCharla.mejor_comentario === null, 'sin tema (o con uno que no vale), charla; la pregunta, con el suyo');
  await como(pelayo, 'aal2');
  const [aCoach] = await q(`insert into comunidad_posts (tipo, texto) values ('aviso', 'Aviso 043') returning id, tema`);
  const [aCoachT] = await q(`insert into comunidad_posts (tipo, texto, tema) values ('aviso', 'Técnica 043', 'tecnica') returning id, tema`);
  const [aCoachP] = await q(`insert into comunidad_posts (tipo, texto, tema) values ('aviso', 'Pregunta 043', 'pregunta') returning id, tema`);
  check(aCoach.tema === 'avisos' && aCoachT.tema === 'tecnica' && aCoachP.tema === 'avisos', 'el aviso del coach, «Avisos» de entrada (o técnica, logros o charla; una pregunta, no)');
  await su();
  check(await n(`select count(*)::int n from notificaciones where usuario_id = $1 and titulo = 'Ana L. te ha hecho una pregunta en el equipo' and url = '#equipo' and clave = $2`, [pelayo, `comunidad:${pPreg.id}:pregunta`]) === 1
    && await n(`select count(*)::int n from notificaciones where clave like '%:pregunta'`) === 1, 'al coach le llega «Ana L. te ha hecho una pregunta en el equipo» (sin el texto; solo por la pregunta)');
  check(await n(`select count(*)::int n from comunidad_posts where tema is null and tipo <> 'entreno'`) === 0, 'las publicaciones de antes de la 043 quedan con su tema');

  console.log('  · Varias fotos');
  await como(ana);
  const f1 = `${aAna.id}/fotoUno043.jpg`, f2 = `${aAna.id}/fotoDos043.jpg`;
  check(await falla(`insert into comunidad_posts (texto, foto_ruta, fotos) values ('x', $1, array[$1, $2])`, [f1, `${aLuis.id}/fotoAjena043.jpg`])
    && await falla(`insert into comunidad_posts (texto, foto_ruta, fotos) values ('x', $1, array[$2, $1])`, [f1, f2])
    && await falla(`insert into comunidad_posts (texto, foto_ruta, fotos) values ('x', null, array[$1, $2])`, [f1, f2])
    && await falla(`insert into comunidad_posts (texto, foto_ruta, fotos) values ('x', $1, array[$1, $2, $3, $4, $5])`, [f1, f2, `${aAna.id}/fotoTres043.jpg`, `${aAna.id}/fotoCuatro043.jpg`, `${aAna.id}/fotoCinco043.jpg`]),
    'las fotos: todas en su carpeta, la primera es foto_ruta y como mucho 4');
  const [pFotos] = await q(`insert into comunidad_posts (texto, foto_ruta, fotos, tema) values ('Dos fotos 043', $1, array[$1, $2], 'logros') returning id, fotos`, [f1, f2]);
  check(pFotos.fotos.length === 2 && (await q(`select comunidad_foto_registrada($1) a, comunidad_foto_borrable($1) b`, [f2]))[0].a === true && (await q(`select comunidad_foto_borrable($1) b`, [f2]))[0].b === false,
    'Ana publica dos fotos: la segunda se puede subir (está registrada) y no se puede borrar mientras se use');
  await como(luis);
  const visLuis = (await q(`select comunidad_foto_visible($1) v`, [f2]))[0].v;
  await como(intruso);
  const visIntruso = (await q(`select comunidad_foto_visible($1) v`, [f2]))[0].v;
  check(visLuis === true && visIntruso === false, 'la segunda foto la ven los de dentro (Luis), no una cuenta de fuera');
  // (revisión) Una foto, en una sola publicación: aunque el coach oculte la suya, Ana no la vuelve a enseñar en otra
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderar($1, null, true)`, [pFotos.id]);
  await como(ana);
  check(await falla(`insert into comunidad_posts (texto, foto_ruta, fotos) values ('Otra vez', $1, array[$1, $2])`, [`${aAna.id}/fotoNueva043.jpg`, f2])
    && await falla(`insert into comunidad_posts (texto, foto_ruta) values ('Otra vez', $1)`, [f2]),
    '(revisión) una foto de una publicación oculta no se puede poner en otra (ni como primera ni entre las demás)');
  await como(luis);
  const visOculta = (await q(`select comunidad_foto_visible($1) v`, [f2]))[0].v;
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderar($1, null, false)`, [pFotos.id]);
  check(visOculta === false, 'y la de la publicación oculta no la ve Luis');
  // (revisión) El aviso al coach guarda todas las fotos hasta que se resuelve
  await como(ana);
  const f3 = `${aAna.id}/fotoTres043.jpg`, f4 = `${aAna.id}/fotoCuatro043.jpg`;
  const [pAvisada] = await q(`insert into comunidad_posts (texto, foto_ruta, fotos) values ('Para avisar 043', $1, array[$1, $2]) returning id`, [f3, f4]);
  await como(luis);
  const idRep = (await q(`select comunidad_avisar_coach($1, null, 'Prueba 043') id`, [pAvisada.id]))[0].id;
  await como(ana);
  await q(`delete from comunidad_posts where id = $1`, [pAvisada.id]);
  const borrableAvisada = (await q(`select comunidad_foto_borrable($1) b`, [f4]))[0].b;
  check(borrableAvisada === false && await falla(`insert into comunidad_posts (texto, foto_ruta, fotos) values ('x', $1, array[$1, $2])`, [`${aAna.id}/fotoOtra043.jpg`, f4]),
    '(revisión) con un aviso abierto, la segunda foto de lo avisado no se borra aunque Ana borre la publicación (ni se pone en otra)');
  await como(pelayo, 'aal2');
  const [rep] = await q(`select copia_foto, copia_fotos from comunidad_reportes where id = $1`, [idRep]);
  check(rep.copia_foto === f3 && rep.copia_fotos?.join() === [f3, f4].join(), '(revisión) el aviso guarda las dos fotos (copia_fotos), que el coach ve en Revisar');

  console.log('  · Guardar');
  await como(luis);
  check((await q(`select comunidad_guardar($1, true) v`, [pPreg.id]))[0].v === true && (await q(`select comunidad_guardar($1) v`, [pPreg.id]))[0].v === true
    && (await q(`select post_id from comunidad_guardados`)).length === 1, 'Luis guarda la pregunta de Ana (dos veces: una fila)');
  check(await falla(`insert into comunidad_guardados (perfil_id, post_id) values ($1, $2)`, [luis, pCharla.id]), 'nadie escribe lo guardado a mano');
  await como(ana);
  const deAna = (await q(`select * from comunidad_guardados`)).length;
  await como(pelayo, 'aal2');
  const delCoach = (await q(`select * from comunidad_guardados`)).length;
  await como(intruso);
  check(deAna === 0 && delCoach === 0 && await falla(`select comunidad_guardar($1, true)`, [pPreg.id]), 'lo guardado solo lo ve su dueño (ni Ana, ni el coach); una cuenta de fuera no guarda');
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderar($1, null, true)`, [pCharla.id]);
  await como(luis);
  check(await falla(`select comunidad_guardar($1, true)`, [pCharla.id]), 'ni lo que no se ve (oculto por el coach)');

  console.log('  · Buscar');
  await como(luis);
  const busca = async (t, lim = 20) => (await q(`select id from comunidad_buscar($1, $2)`, [t, lim])).map((x) => x.id);
  check((await busca('ZZ043')).includes(pPreg.id) && (await busca('calentamiento antes')).join() === pPreg.id && (await busca('cuantas series')).includes(pPreg.id),
    'buscar por el texto (sin distinguir mayúsculas ni tildes)');
  check((await busca('Ana L')).includes(pFotos.id) && (await busca('Ana L')).includes(pPreg.id), 'y por el nombre de quien lo publica');
  check(!(await busca('charla 043')).length && !(await busca('a')).length && !(await busca('%%')).length && !(await busca('__')).length && (await busca('043', 1)).length === 1,
    'solo en lo que se ve (no lo oculto); de 2 letras en adelante; «%» y «_» no son comodines; con su límite');
  await como(intruso);
  check(!(await busca('043')).length, 'una cuenta de fuera no encuentra nada');
  await como(pelayo, 'aal2');
  check((await busca('charla 043')).includes(pCharla.id), 'el coach, también lo oculto');
  await q(`select comunidad_moderar($1, null, false)`, [pCharla.id]);

  console.log('  · La mejor respuesta');
  await como(luis);
  const [cLuis] = await q(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Yo hago dos o tres') returning id`, [pPreg.id]);
  await como(pelayo, 'aal2');
  const [cCoach] = await q(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Dos o tres series subiendo de carga, hasta llegar a la de trabajo.') returning id`, [pPreg.id]);
  await como(ana);
  const [cAna] = await q(`insert into comunidad_comentarios (post_id, texto) values ($1, '¡Gracias!') returning id`, [pPreg.id]);
  await su(); await q(`delete from notificaciones`);
  await como(luis);
  check(await falla(`select comunidad_mejor_respuesta($1, $2)`, [pPreg.id, cLuis.id]), 'Luis no elige la mejor respuesta de una publicación de Ana');
  await como(ana);
  check(await falla(`select comunidad_mejor_respuesta($1, $2)`, [pPreg.id, cAna.id]) && await falla(`select comunidad_mejor_respuesta($1, $2)`, [pCharla.id, cLuis.id]),
    'Ana, ni la suya ni un comentario de otra publicación');
  check((await q(`select comunidad_mejor_respuesta($1, $2) v`, [pPreg.id, cLuis.id]))[0].v === cLuis.id
    && (await q(`select mejor_comentario from comunidad_posts where id = $1`, [pPreg.id]))[0].mejor_comentario === cLuis.id, 'Ana elige la de Luis');
  await su();
  check(await n(`select count(*)::int n from notificaciones where usuario_id = $1 and titulo = 'Ana L. ha elegido tu comentario como mejor respuesta' and url = '#equipo' and tipo = 'comunidad'`, [luis]) === 1,
    'a Luis le llega «Ana L. ha elegido tu comentario como mejor respuesta» (preferencia «Equipo», sin el texto)');
  await como(pelayo, 'aal2');
  check((await q(`select comunidad_mejor_respuesta($1, $2) v`, [pPreg.id, cCoach.id]))[0].v === cCoach.id, 'el coach la cambia por la suya («Respuesta del coach»)');
  await su();
  check(await n(`select count(*)::int n from notificaciones where usuario_id = $1 and clave like 'comunidad_mejor:%' and estado = 'pendiente'`, [luis]) === 0
    && await n(`select count(*)::int n from notificaciones where usuario_id = $1 and clave like 'comunidad_mejor:%'`, [pelayo]) === 0,
    'el aviso pendiente a Luis se retira al cambiarla, y al coach no le llega el suyo');
  await como(intruso);
  check(await falla(`select comunidad_mejor_respuesta($1, null)`, [pPreg.id]), 'una cuenta de fuera no la toca');
  // (revisión) ocultar la publicación retira el aviso pendiente de su mejor respuesta
  await como(luis);
  const [cLuisF] = await q(`insert into comunidad_comentarios (post_id, texto) values ($1, '¡Qué buenas!') returning id`, [pFotos.id]);
  await como(ana); await q(`select comunidad_mejor_respuesta($1, $2)`, [pFotos.id, cLuisF.id]);
  await su();
  const antesOcultar = await n(`select count(*)::int n from notificaciones where clave like $1 and estado = 'pendiente'`, [`comunidad_mejor:${cLuisF.id}:%`]);
  await como(pelayo, 'aal2'); await q(`select comunidad_moderar($1, null, true)`, [pFotos.id]);
  await su();
  check(antesOcultar === 1 && await n(`select count(*)::int n from notificaciones where clave like $1`, [`comunidad_mejor:${cLuisF.id}:%`]) === 0,
    '(revisión) si el coach oculta la publicación, su aviso de mejor respuesta pendiente se retira');
  await como(pelayo, 'aal2'); await q(`select comunidad_moderar($1, null, false)`, [pFotos.id]);
  await como(ana);
  check(await falla(`update comunidad_posts set mejor_comentario = $2 where id = $1`, [pPreg.id, cLuis.id]) || (await q(`select mejor_comentario from comunidad_posts where id = $1`, [pPreg.id]))[0].mejor_comentario === cCoach.id,
    'ni se cambia a mano');

  console.log('  · Preguntas frecuentes');
  await como(ana);
  check(await falla(`select comunidad_guardar_pregunta($1, $2)`, [pPreg.id, cCoach.id]), 'un atleta no guarda preguntas frecuentes');
  await como(pelayo, 'aal2');
  check(await falla(`select comunidad_guardar_pregunta($1, $2)`, [pPreg.id, cLuis.id]) && await falla(`select comunidad_guardar_pregunta($1, $2)`, [pCharla.id, cCoach.id]),
    'el coach, con un comentario suyo y en una pregunta para el coach');
  // (revisión) si la mejor era otra, su aviso pendiente se retira al guardarla
  await como(ana); await q(`select comunidad_mejor_respuesta($1, $2)`, [pPreg.id, cLuis.id]);
  await su();
  const pendLuis = await n(`select count(*)::int n from notificaciones where usuario_id = $1 and clave like 'comunidad_mejor:%' and estado = 'pendiente'`, [luis]);
  await como(pelayo, 'aal2');
  const faq = (await q(`select comunidad_guardar_pregunta($1, $2, '¿Cuántas series de calentamiento antes de la sentadilla?', null) id`, [pPreg.id, cCoach.id]))[0].id;
  await su();
  check(pendLuis === 1 && await n(`select count(*)::int n from notificaciones where usuario_id = $1 and clave like 'comunidad_mejor:%' and estado = 'pendiente'`, [luis]) === 0,
    '(revisión) guardarla como pregunta frecuente retira el aviso pendiente de la mejor respuesta de antes');
  await como(pelayo, 'aal2');
  check((await q(`select pregunta, respuesta, comentario_id from comunidad_preguntas where id = $1`, [faq])).map((x) => [x.pregunta, x.respuesta, x.comentario_id === cCoach.id].join('|')).join()
    === '¿Cuántas series de calentamiento antes de la sentadilla?|Dos o tres series subiendo de carga, hasta llegar a la de trabajo.|true'
    && (await q(`select comunidad_guardar_pregunta($1, $2) id`, [pPreg.id, cCoach.id]))[0].id === faq && await n(`select count(*)::int n from comunidad_preguntas`) === 1,
    'el coach la guarda (con la pregunta retocada y su respuesta); otra vez, la misma (una por pregunta)');
  check(!Object.keys((await q(`select to_jsonb(q) j from comunidad_preguntas q`))[0].j).some((k) => /autor|atleta|perfil/.test(k)), 'sin el nombre (ni nada) de quien preguntó');
  await como(luis);
  const vLuis = (await q(`select pregunta from comunidad_preguntas`)).length;
  const borraLuis = (await q(`delete from comunidad_preguntas returning id`)).length;
  await como(intruso);
  check(vLuis === 1 && borraLuis === 0 && !(await q(`select * from comunidad_preguntas`)).length, 'la ven los de dentro (Luis), que no la quitan; una cuenta de fuera, nada');
  await como(ana);
  const datosAna = (await q(`select comunidad_mis_datos() d`))[0].d;
  await como(luis);
  const datosLuis = (await q(`select comunidad_mis_datos() d`))[0].d;
  check(datosAna.preguntas_frecuentes?.length === 1 && datosAna.publicaciones.some((x) => x.tema === 'pregunta' && x.mejor_comentario === cCoach.id) && datosAna.publicaciones.some((x) => x.fotos?.length === 2)
    && datosLuis.guardados?.length === 1 && datosLuis.guardados[0].post_id === pPreg.id && !datosAna.guardados?.length,
    '«Descargar mis datos» lleva sus temas, fotos y mejores respuestas, lo que ha guardado y las preguntas frecuentes de sus preguntas');
  await como(ana);
  await q(`delete from comunidad_posts where id = $1`, [pPreg.id]);
  await su();
  check(await n(`select count(*)::int n from comunidad_preguntas`) === 0 && await n(`select count(*)::int n from comunidad_guardados`) === 0,
    'si Ana borra su pregunta, se van con ella la pregunta frecuente y lo guardado');
  await como(pelayo, 'aal2');
  check((await q(`delete from comunidad_preguntas returning id`)).length === 0, '(y el coach puede quitarlas: con DELETE)');
  await como(ana);
  const fotosSalir = (await q(`select comunidad_salir(true) f`))[0].f;
  check(fotosSalir.includes(f1) && fotosSalir.includes(f2) && !fotosSalir.includes(f4), 'salir y borrar lo suyo devuelve también las fotos de las publicaciones de varias (no las de un aviso abierto)');
  await como(pelayo, 'aal2');
  await q(`update comunidad_reportes set resuelto_en = now() where id = $1`, [idRep]);
  await como(ana);
  await q(`select comunidad_unirme('Ana L.', $1, $2)`, [(await import('../web/src/datos/api.js')).VERSION_COMUNIDAD, (await import('../web/src/datos/api.js')).VERSION_NORMAS]);
  check((await q(`select comunidad_foto_borrable($1) b`, [f4]))[0].b === true, '(revisión) resuelto el aviso, ya se puede borrar');
  await como(pelayo, 'aal2');
  await q(`delete from comunidad_posts where id = any($1::uuid[])`, [[aCoach.id, aCoachT.id, aCoachP.id]]);
  await su(); await q(`delete from notificaciones`);

  console.log('  · La política con revisiones de dos cifras');
  await como(ana);
  const pv = (v) => q(`insert into privacidad_vista (usuario_id, version) values ($1, $2) on conflict (usuario_id) do update set version = excluded.version returning version`, [ana, v]);
  await su(); await q(`delete from privacidad_vista where usuario_id = $1`, [ana]);
  await como(ana);
  check((await pv('2026-12.9'))[0].version === '2026-12.9' && (await pv('2026-12.10'))[0].version === '2026-12.10' && (await pv('2026-12.9'))[0].version === '2026-12.10',
    'con la 043, la base admite la 2026-12.10 (después de la 2026-12.9, comparando como números: nunca vuelve atrás)');
  check(await falla(`insert into privacidad_vista (usuario_id, version) values ($1, '2026-12.100') on conflict (usuario_id) do update set version = excluded.version`, [ana])
    && await falla(`insert into privacidad_vista (usuario_id, version) values ($1, '2026-12.0') on conflict (usuario_id) do update set version = excluded.version`, [ana])
    && await falla(`insert into privacidad_vista (usuario_id, version) values ($1, '2026-12.01') on conflict (usuario_id) do update set version = excluded.version`, [ana]),
    'y rechaza la 2026-12.100, la 2026-12.0 y la 2026-12.01');
  await su();
  check(await falla(`insert into privacidad_vista (usuario_id, version) values ($1, '2026-12.100') on conflict (usuario_id) do update set version = excluded.version`, [luis])
    && (await q(`select 1 from pg_constraint where conname = 'privacidad_vista_version_valida' and pg_get_constraintdef(oid) like '%[1-9][0-9]?%'`)).length === 1,
    'la restricción también (ni desde el SQL Editor)');
  // (como las pruebas de la 037: sin filas con revisión al final, para repetir la 034 más abajo)
  await q(`delete from privacidad_vista where usuario_id = $1`, [ana]);

  console.log('  · La 043 sin la 042, repetida y sobre una base que ya va por delante');
  const sin42 = new PGlite();
  await sin42.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin42.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '042')) await sin42.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  const sql43 = readFileSync(new URL('../supabase/migraciones/043_comunidad_conversacion.sql', import.meta.url), 'utf8');
  let e43a = null;
  try { await sin42.exec(sql43); } catch (e) { e43a = e.message; }
  check(/Antes de la 043 hace falta la 042/.test(e43a || '') && !(await sin42.query(`select 1 from pg_class where relname = 'comunidad_guardados'`)).rows.length, 'la 043 no se aplica sin la 042 (y no deja nada a medias)');
  await sin42.exec(readFileSync(new URL('../supabase/migraciones/042_comunidad_constancia.sql', import.meta.url), 'utf8'));
  await sin42.exec(`insert into auth.users (email) values ('a@x');
    insert into public.comunidad_posts (autor_id, tipo, texto) select id, 'aviso', 'Antes de la 043' from auth.users where email = 'a@x'`);
  await sin42.exec(sql43);
  await sin42.exec(sql43);
  check((await sin42.query(`select count(*)::int n from fbe_migraciones where numero = 43`)).rows[0].n === 1 && (await sin42.query(`select tema from comunidad_posts`)).rows.map((x) => x.tema).join() === 'avisos',
    'con la 042, se aplica (lo de antes, con su tema); repetida, queda apuntada una vez y no toca lo guardado');
  await sin42.exec(`insert into public.fbe_migraciones (numero) values (44)`);
  let e43b = null;
  try { await sin42.exec(sql43); } catch (e) { e43b = e.message; }
  check(/ya tiene la migración 044/.test(e43b || ''), 'ni en una base que ya tiene una posterior');
  await sin42.close();
}

console.log('\nLa comunidad, cuarta tanda: eventos, programados y plantillas, el panel, el atleta de la semana y la moderación (migración 044)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  const ms = (x) => new Date(x).getTime();
  await su();
  const tablas044 = ['comunidad_eventos', 'comunidad_evento_asistentes', 'comunidad_plantillas', 'comunidad_destacados', 'comunidad_moderacion'];
  const permisosDe = async (t) => (await q(`select privilege_type p from information_schema.role_table_grants where table_name = $1 and grantee = 'authenticated' order by 1`, [t])).map((x) => x.p).join();
  check((await q(`select relname from pg_class where relname = any($1) and relrowsecurity and relnamespace = 'public'::regnamespace`, [tablas044])).length === 5
    && (await q(`select 1 from information_schema.role_table_grants where table_name = any($1) and grantee in ('anon', 'PUBLIC')`, [tablas044])).length === 0
    && await permisosDe('comunidad_eventos') === 'DELETE,INSERT,SELECT,UPDATE' && await permisosDe('comunidad_plantillas') === 'DELETE,INSERT,SELECT'
    && await permisosDe('comunidad_evento_asistentes') === 'SELECT' && await permisosDe('comunidad_destacados') === 'SELECT' && await permisosDe('comunidad_moderacion') === 'SELECT',
    'las tablas nuevas: con sus permisos por fila; quién va, el atleta de la semana y la moderación, solo lectura (se escriben con sus funciones); nada para anon');
  const nuevas044 = ['comunidad_evento_valido', 'comunidad_palabras_validas', 'comunidad_normal', 'comunidad_texto_filtrado', 'comunidad_destacado_visible', 'comunidad_evento_preparar',
    'comunidad_evento_cambiado', 'comunidad_evento_responder', 'comunidad_post_programar', 'comunidad_programado_cambiar', 'comunidad_plantilla_preparar', 'comunidad_moderar_entrada',
    'comunidad_post_moderar', 'comunidad_comentario_moderar', 'comunidad_al_retener', 'comunidad_silenciar', 'comunidad_moderacion_guardar', 'comunidad_aprobar', 'comunidad_destacar',
    'comunidad_destacado_quitar', 'comunidad_panel'];
  check(!(await q(`select 1 from pg_proc p where p.proname = any($1) and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))`, [nuevas044])).length
    && (await q(`select count(distinct proname)::int n from pg_proc where proname = any($1)`, [nuevas044]))[0].n === nuevas044.length
    && !(await q(`select 1 from pg_proc where proname = any($1) and (has_function_privilege('anon', oid, 'execute') or (pronamespace = 'fbe_privado'::regnamespace and has_function_privilege('authenticated', oid, 'execute')))`, [nuevas044])).length,
    'sus funciones, con search_path vacío, ninguna para anon y las internas solo para la base');
  check((await q(`select comunidad_evento_valido('Quedada', 'Retiro', null, 10) a, comunidad_evento_valido('', 'Retiro', null, null) b, comunidad_evento_valido('Quedada', 'Retiro', null, 0) c,
      comunidad_evento_valido(repeat('x', 81), 'Retiro', null, null) d, comunidad_evento_valido(null, null, null, null) e, comunidad_palabras_validas('{}') f, comunidad_palabras_validas(array['tonto', 'mala palabra']) g,
      comunidad_palabras_validas(array['Tonto']) h, comunidad_palabras_validas(array['x']) i, comunidad_palabras_validas(null) j, comunidad_palabras_validas(array[array['ab', 'cd'], array['ef', 'gh']]) k`))
    .map((x) => [x.a, x.b, x.c, x.d, x.e, x.f, x.g, x.h, x.i, x.j, x.k].join()).join() === 'true,false,false,false,false,true,true,false,false,false,false',
    'los validadores: el evento (título, sitio, descripción y plazas) y las palabras filtradas (ya normalizadas, de 2 a 40), nunca un error');
  check((await q(`select fbe_privado.comunidad_texto_filtrado('Eres un TONTÓ, ¿eh?', array['tonto']) a, fbe_privado.comunidad_texto_filtrado('Qué tontería', array['tonto']) b,
      fbe_privado.comunidad_texto_filtrado('Una mala   palabra', array['mala palabra']) c, fbe_privado.comunidad_texto_filtrado('Hola', '{}') d`)).map((x) => [x.a, x.b, x.c, x.d].join()).join() === 'true,false,true,false',
    'las palabras filtradas: palabras enteras, sin mayúsculas ni tildes («tontería» no salta con «tonto»)');
  await q(`update comunidad_miembros set sin_ranking = false, silenciado_hasta = null where perfil_id in ($1, $2)`, [ana, luis]);
  await q(`delete from notificaciones`);
  const aLas = (dias, hora) => `((now() at time zone 'Europe/Madrid')::date + ${dias} + time '${hora}') at time zone 'Europe/Madrid'`;

  console.log('  · Eventos y quién va');
  await como(ana);
  check(await falla(`insert into comunidad_eventos (titulo, empieza_en, lugar) values ('Mío', now() + interval '1 day', 'Casa')`), 'un atleta no crea eventos');
  await como(pelayo, 'aal2');
  check(await falla(`insert into comunidad_eventos (titulo, empieza_en, lugar) values ('Ayer', now() - interval '1 hour', 'Retiro')`)
    && await falla(`insert into comunidad_eventos (titulo, empieza_en, lugar) values ('Lejos', now() + interval '400 days', 'Retiro')`)
    && await falla(`insert into comunidad_eventos (titulo, empieza_en, lugar, plazas) values ('Sin plazas', now() + interval '1 day', 'Retiro', 0)`),
    'el coach: más adelante, como mucho a un año y con plazas válidas');
  const [ev] = await q(`insert into comunidad_eventos (titulo, empieza_en, lugar, descripcion, plazas, creado_en, cancelado_en) values ('Quedada en el Retiro', ${aLas(3, '18:00')}, ' Puerta de Alcalá ', '', 5, '2020-01-01', now()) returning *`);
  check(!!ev && ev.lugar === 'Puerta de Alcalá' && ev.descripcion === null && ev.cancelado_en === null && ms(ev.creado_en) > ms('2025-01-01'), 'crea una quedada (las fechas y lo cancelado las pone la base; sin espacios de más)');
  await como(ana);
  check((await q(`select id from comunidad_eventos`)).map((x) => x.id).join() === ev.id && (await q(`select comunidad_evento_responder($1, true) v`, [ev.id]))[0].v === true,
    'Ana la ve y se apunta («Me apunto»)');
  check(await falla(`insert into comunidad_evento_asistentes (evento_id, perfil_id, va) values ($1, $2, true)`, [ev.id, ana]) && await falla(`update comunidad_eventos set titulo = 'Cambiado' where id = $1`, [ev.id])
    || (await q(`select titulo from comunidad_eventos where id = $1`, [ev.id]))[0].titulo === 'Quedada en el Retiro', 'ni se apunta a mano ni cambia el evento');
  await como(luis);
  const vistosLuis = (await q(`select perfil_id, va from comunidad_evento_asistentes where evento_id = $1`, [ev.id])).map((x) => `${x.perfil_id === ana}:${x.va}`).join();
  await como(intruso);
  const vistosIntruso = (await q(`select * from comunidad_evento_asistentes`)).length + (await q(`select * from comunidad_eventos`)).length;
  check(vistosLuis === 'true:true' && vistosIntruso === 0 && await falla(`select comunidad_evento_responder($1, true)`, [ev.id]),
    'Luis ve que Ana va (como las reacciones); una cuenta de fuera no ve ni el evento ni quién va, ni se apunta');
  await como(pelayo, 'aal2');
  await q(`update comunidad_eventos set plazas = 1 where id = $1`, [ev.id]);
  await como(luis);
  check(await falla(`select comunidad_evento_responder($1, true)`, [ev.id]) && (await q(`select comunidad_evento_responder($1, false) v`, [ev.id]))[0].v === false, 'con las plazas llenas, Luis no puede apuntarse; «No voy», sí');
  await su();
  await q(`select crear_recordatorios(${aLas(3, '15:00')})`);
  const antesDeHora = await n(`select count(*)::int n from notificaciones where clave like 'comunidad_evento:%'`);
  await q(`select crear_recordatorios(${aLas(3, '16:30')})`);
  await q(`select crear_recordatorios(${aLas(3, '16:31')})`);
  const rec = await q(`select usuario_id, titulo, caduca_en from notificaciones where clave like 'comunidad_evento:%'`);
  check(antesDeHora === 0 && rec.length === 1 && rec[0].usuario_id === ana && rec[0].titulo === 'A las 18:00: Quedada en el Retiro' && ms(rec[0].caduca_en) === ms(ev.empieza_en),
    'dos horas antes (y no antes), una vez, solo a quien va: «A las 18:00: Quedada en el Retiro» (caduca al empezar)');
  await como(pelayo, 'aal2');
  await q(`update comunidad_eventos set cancelado_en = now() where id = $1`, [ev.id]);
  await su();
  check(await n(`select count(*)::int n from notificaciones where clave like 'comunidad_evento:%'`) === 0
    && await n(`select count(*)::int n from notificaciones where usuario_id = $1 and clave = $2 and titulo = 'Se cancela: Quedada en el Retiro'`, [ana, `comunidad_evento_cancelado:${ev.id}`]) === 1
    && await n(`select count(*)::int n from notificaciones where clave like 'comunidad_evento_cancelado:%'`) === 1,
    'al cancelarlo, el recordatorio pendiente se retira y a quien iba (solo a Ana) le llega «Se cancela: …»');
  await como(pelayo, 'aal2');
  await q(`update comunidad_eventos set cancelado_en = null where id = $1`, [ev.id]);
  const sigue = (await q(`select cancelado_en from comunidad_eventos where id = $1`, [ev.id]))[0].cancelado_en;
  await como(ana);
  check(sigue !== null && await falla(`select comunidad_evento_responder($1, null)`, [ev.id]), 'un evento cancelado no se descancela, y ya no se responde');
  const datosAna = (await q(`select comunidad_mis_datos() d`))[0].d;
  check(datosAna.eventos?.length === 1 && datosAna.eventos[0].va === true && Array.isArray(datosAna.atleta_de_la_semana), '«Descargar mis datos» lleva sus respuestas a los eventos');

  console.log('  · Avisos programados');
  await su(); await q(`delete from notificaciones`);
  await como(pelayo, 'aal2');
  const [prog] = await q(`insert into comunidad_posts (tipo, texto, publicar_en, menciones) values ('aviso', 'Mañana, sesión especial zz044', now() + interval '1 hour', $1) returning *`, [[ana]]);
  check(ms(prog.creado_en) === ms(prog.publicar_en) && prog.menciones.length === 0, 'el coach programa un aviso: sale con la fecha de su hora y sin menciones (avisarían antes de tiempo)');
  check(await falla(`insert into comunidad_posts (tipo, texto, publicar_en) values ('aviso', 'Lejos', now() + interval '91 days')`)
    && (await q(`insert into comunidad_posts (tipo, texto, publicar_en) values ('aviso', 'Casi ya', now() + interval '10 seconds') returning publicar_en`))[0].publicar_en === null,
    'como mucho a 90 días; con menos de 30 s, se publica ya');
  await q(`delete from comunidad_posts where texto = 'Casi ya'`);
  await su();
  const avisosYa = await n(`select count(*)::int n from notificaciones where clave = $1`, [`comunidad_aviso:${prog.id}`]);
  await como(ana);
  const anaLo = (await q(`select id from comunidad_posts where id = $1`, [prog.id])).length;
  const anaVis = (await q(`select comunidad_post_visible($1) v`, [prog.id]))[0].v;
  const anaBusca = (await q(`select id from comunidad_buscar('zz044')`)).length;
  check(avisosYa === 0 && anaLo === 0 && anaVis === false && anaBusca === 0 && await falla(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Antes de tiempo')`, [prog.id])
    && await falla(`select comunidad_reaccionar($1, 'fuerza')`, [prog.id]), 'hasta su hora, Ana no lo ve (ni buscándolo), no puede comentarlo ni reaccionar, y no le ha llegado nada');
  check(await falla(`insert into comunidad_posts (texto, publicar_en) values ('Yo también programo', now() + interval '1 hour')`), 'un atleta no programa');
  check(await falla(`select comunidad_programado_cambiar($1, 'Hackeado', null)`, [prog.id]), 'ni cambia lo programado');
  await como(pelayo, 'aal2');
  const nueva = (await q(`select comunidad_programado_cambiar($1, 'Mañana, sesión especial zz044 (a las 10)', now() + interval '2 hours') v`, [prog.id]))[0].v;
  // (revisión) un comentario del coach con una mención en lo programado no avisa antes de tiempo
  const [cProg] = await q(`insert into comunidad_comentarios (post_id, texto, menciones) values ($1, '@Ana L. mira esto', $2) returning id`, [prog.id, [ana]]);
  await su();
  const mencionProg = await n(`select count(*)::int n from notificaciones where clave like $1`, [`comunidad_mencion:${cProg.id.replace(/-/g, '')}:%`]);
  await q(`delete from comunidad_comentarios where id = $1`, [cProg.id]);
  check(mencionProg === 0, '(revisión) una mención en un comentario de un aviso programado no avisa (aún no se ve)');
  await como(pelayo, 'aal2');
  check(ms(nueva) > Date.now() + 3600e3 && (await q(`select texto, creado_en from comunidad_posts where id = $1`, [prog.id])).map((x) => `${x.texto}|${ms(x.creado_en) === ms(nueva)}`).join() === 'Mañana, sesión especial zz044 (a las 10)|true',
    'el coach lo cambia (texto y hora)');
  // (sale: como si hubiera llegado su hora)
  await su();
  await q(`update comunidad_posts set publicar_en = now() - interval '1 second', creado_en = now() - interval '1 second' where id = $1`, [prog.id]);
  await como(ana);
  const anaYa = (await q(`select id from comunidad_posts where id = $1`, [prog.id])).length;
  await su();
  // (revisión) Luis «vuelve a entrar» después de que saliera: a él no le llega el aviso de algo de antes
  const [{ e: entradaLuis }] = await q(`select entrado_en e from comunidad_miembros where perfil_id = $1`, [luis]);
  const [{ e: entradaAna }] = await q(`select entrado_en e from comunidad_miembros where perfil_id = $1`, [ana]);
  await q(`update comunidad_miembros set entrado_en = now() - interval '1 hour' where perfil_id = $1`, [ana]);
  await q(`update comunidad_miembros set entrado_en = now() where perfil_id = $1`, [luis]);
  await q(`select crear_recordatorios(now())`);
  await q(`select crear_recordatorios(now())`);
  const avisoLuis = await n(`select count(*)::int n from notificaciones where clave = $1 and usuario_id = $2`, [`comunidad_aviso:${prog.id}`, luis]);
  await q(`update comunidad_miembros set entrado_en = $2 where perfil_id = $1`, [luis, entradaLuis]);
  await q(`update comunidad_miembros set entrado_en = $2 where perfil_id = $1`, [ana, entradaAna]);
  check(avisoLuis === 0, '(revisión) a quien entra después de que saliera, no le llega su aviso');
  check(anaYa === 1 && await n(`select count(*)::int n from notificaciones where clave = $1 and titulo like '% ha publicado un aviso en el equipo'`, [`comunidad_aviso:${prog.id}`]) === 1
    && await n(`select count(*)::int n from notificaciones where clave = $1 and usuario_id = $2`, [`comunidad_aviso:${prog.id}`, pelayo]) === 0,
    'al llegar su hora, Ana lo ve, y crear_recordatorios() avisa una vez a los de dentro («… ha publicado un aviso en el equipo»), no al coach');
  await q(`select crear_recordatorios(now())`);
  check(await n(`select count(*)::int n from notificaciones where clave = $1 and usuario_id = $2`, [`comunidad_aviso:${prog.id}`, luis]) === 1, '(Luis, con su entrada de antes, sí)');
  await como(pelayo, 'aal2');
  check(await falla(`select comunidad_programado_cambiar($1, 'Tarde', null)`, [prog.id]), 'lo ya publicado no se cambia como programado');
  await q(`delete from comunidad_posts where id = $1`, [prog.id]);

  console.log('  · Plantillas');
  await como(pelayo, 'aal2');
  await q(`insert into comunidad_plantillas (texto) select 'Plantilla ' || g from generate_series(1, 30) g`);
  check(await n(`select count(*)::int n from comunidad_plantillas`) === 30 && await falla(`insert into comunidad_plantillas (texto) values ('La 31')`), 'el coach guarda hasta 30 plantillas (la 31, no)');
  await como(ana);
  check(!(await q(`select * from comunidad_plantillas`)).length && await falla(`insert into comunidad_plantillas (texto) values ('Mía')`), 'las plantillas son del coach: un atleta ni las ve ni las crea');
  await como(pelayo, 'aal2');
  await q(`delete from comunidad_plantillas`);

  console.log('  · El panel de la comunidad');
  await como(ana);
  check(await falla(`select comunidad_panel()`), 'solo el coach');
  await como(pelayo, 'aal2');
  const panel = (await q(`select comunidad_panel() p`))[0].p;
  check(panel.semanas?.length === 4 && panel.semanas.every((s) => ['activos', 'publicaciones', 'reacciones', 'comentarios'].every((k) => Number.isInteger(s[k]))) && panel.miembros >= 2
    && Array.isArray(panel.nunca) && Array.isArray(panel.inactivos) && Array.isArray(panel.activos) && Number.isInteger(panel.reportes) && Number.isInteger(panel.retenidos)
    && !/texto|zz04|Hola equipo/.test(JSON.stringify(panel)), 'el coach: 4 semanas de recuentos, quién falta, lo pendiente y los más activos (sin el contenido de nada)');

  console.log('  · El atleta de la semana');
  await como(ana);
  check(await falla(`select comunidad_destacar($1, 'Yo misma')`, [ana]), 'un atleta no se elige');
  await su(); await q(`update comunidad_miembros set sin_ranking = true where perfil_id = $1`, [luis]);
  await como(pelayo, 'aal2');
  check(await falla(`select comunidad_destacar($1, 'Por no fallar')`, [luis]) && await falla(`select comunidad_destacar($1, $2)`, [ana, 'x'.repeat(141)]) && await falla(`select comunidad_destacar($1, 'Fuera')`, [intruso]),
    'no se elige a quien no sale en el ranking, con una línea de más de 140 ni a alguien de fuera');
  await su(); await q(`update comunidad_miembros set sin_ranking = false where perfil_id = $1`, [luis]); await q(`delete from notificaciones`);
  await como(pelayo, 'aal2');
  const d1 = (await q(`select comunidad_destacar($1, '  Por no fallar   ni un día ') id`, [luis]))[0].id;
  await su();
  check(await n(`select count(*)::int n from notificaciones where usuario_id = $1 and clave = $2`, [luis, `comunidad_destacado:${d1}`]) === 1, 'a Luis le llega el aviso (sin la línea)');
  await como(ana);
  check((await q(`select perfil_id, motivo from comunidad_destacados`)).map((x) => `${x.perfil_id === luis}|${x.motivo}`).join() === 'true|Por no fallar ni un día'
    && await falla(`insert into comunidad_destacados (perfil_id, motivo) values ($1, 'Yo')`, [ana]), 'Ana lo ve (con la línea, sin espacios de más) y no lo escribe a mano');
  await como(pelayo, 'aal2');
  await q(`select comunidad_destacar($1, 'Por su constancia')`, [ana]);
  await como(luis);
  const deLuis = (await q(`select perfil_id from comunidad_destacados`)).map((x) => x.perfil_id === ana).join();
  await como(intruso);
  const deIntruso = (await q(`select * from comunidad_destacados`)).length;
  await como(pelayo, 'aal2');
  check(deLuis === 'true' && deIntruso === 0 && await n(`select count(*)::int n from comunidad_destacados`) === 2 && await n(`select count(*)::int n from comunidad_destacados where hasta > now()`) === 1,
    'uno a la vez: el nuevo (Ana) sustituye al de antes, que queda para el coach (los de dentro, solo el de ahora; de fuera, nada)');
  await su(); await q(`update comunidad_miembros set sin_ranking = true where perfil_id = $1`, [ana]);
  await como(luis);
  const conSinRanking = (await q(`select * from comunidad_destacados`)).length;
  await su(); await q(`update comunidad_miembros set sin_ranking = false where perfil_id = $1`, [ana]);
  await como(pelayo, 'aal2'); await q(`select comunidad_destacado_quitar()`);
  check(conSinRanking === 0 && await n(`select count(*)::int n from comunidad_destacados where hasta > now()`) === 0, 'si después elige no salir en el ranking, deja de verse; el coach lo quita antes de tiempo');

  console.log('  · Moderación: silenciar');
  await como(ana);
  check(await falla(`select comunidad_silenciar($1, 24)`, [luis]), 'un atleta no silencia');
  await como(pelayo, 'aal2');
  const hasta = (await q(`select comunidad_silenciar($1, 24) h`, [luis]))[0].h;
  const [pAnaSil] = await q(`insert into comunidad_posts (tipo, texto) values ('aviso', 'Aviso para silenciados') returning id`);
  await como(luis);
  const filaLuis = (await q(`select silenciado_hasta from comunidad_miembros`))[0];
  check(Math.abs(ms(hasta) - Date.now() - 864e5) < 60000 && ms(filaLuis.silenciado_hasta) === ms(hasta)
    && /pausado tus publicaciones/.test(await mensaje(`insert into comunidad_posts (texto) values ('Hola')`) || '') && await falla(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Hola')`, [pAnaSil.id])
    && (await q(`select comunidad_reaccionar($1, 'fuerza') r`, [pAnaSil.id]))[0].r === 'fuerza',
    'silenciado 24 h, Luis ve hasta cuándo en su fila, no publica ni comenta (con un mensaje claro) y sí reacciona');
  await como(ana);
  check(!(await q(`select silenciado_hasta from comunidad_miembros where perfil_id = $1`, [luis])).length, 'los demás no saben que está silenciado');
  await como(pelayo, 'aal2');
  check((await q(`select comunidad_silenciar($1, 0) h`, [luis]))[0].h === null, 'el coach le quita el silencio');
  await como(luis);
  check((await q(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Ya puedo') returning id`, [pAnaSil.id])).length === 1, 'y vuelve a poder comentar');

  console.log('  · Moderación: palabras filtradas y modo lento');
  await como(ana);
  check(await falla(`select comunidad_moderacion_guardar(array['tonto'], 0)`) && !(await q(`select * from comunidad_moderacion`)).length, 'un atleta ni las cambia ni las ve');
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderacion_guardar(array['Tonto', ' Mala   PALABRA ', 'tonto', 'x'], 0)`);
  check((await q(`select palabras from comunidad_moderacion`))[0].palabras.join() === 'mala palabra,tonto' && await falla(`select comunidad_moderacion_guardar(array[repeat('a', 41)], 0)`),
    'el coach las guarda normalizadas (sin repetir, sin las de una letra); de más de 40, no');
  await su(); await q(`delete from notificaciones`);
  await como(luis);
  const [ret] = await q(`insert into comunidad_posts (texto, menciones) values ('Eres un TONTO, @Ana L.', $1) returning id, retenida`, [[ana]]);
  const [retPreg] = await q(`insert into comunidad_posts (texto, tema) values ('¿Esto es de tontos? zz044', 'pregunta') returning id, retenida`);
  const [cRet] = await q(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Qué mala palabra') returning id, retenido`, [pAnaSil.id]);
  const [cBien] = await q(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Qué tontería') returning id, retenido`, [pAnaSil.id]);
  check(ret.retenida === true && retPreg.retenida === false && cRet.retenido === true && cBien.retenido === false && (await q(`select id from comunidad_posts where id = $1`, [ret.id])).length === 1,
    'con una palabra filtrada, la publicación y el comentario quedan retenidos (palabras enteras); su autor los ve');
  await su();
  check(await n(`select count(*)::int n from notificaciones where clave like $1`, [`comunidad_mencion:${ret.id.replace(/-/g, '')}:%`]) === 0
    && await n(`select count(*)::int n from notificaciones where clave like 'comunidad:' || $1 || ':%' and usuario_id = $2`, [pAnaSil.id, pelayo]) === 1,
    'lo retenido no avisa (ni la mención a Ana); el comentario que no lo está, sí');
  // (revisión) un comentario (del coach) con una mención en una publicación retenida no avisa; ni un comentario retenido con mención
  await como(pelayo, 'aal2');
  const [cEnRet] = await q(`insert into comunidad_comentarios (post_id, texto, menciones) values ($1, '@Ana L. ojo', $2) returning id`, [ret.id, [ana]]);
  await como(luis);
  const [cRetMen] = await q(`insert into comunidad_comentarios (post_id, texto, menciones) values ($1, 'Qué tonto, @Ana L.', $2) returning id, retenido`, [pAnaSil.id, [ana]]);
  await su();
  check(await n(`select count(*)::int n from notificaciones where clave like $1 or clave like $2`, [`comunidad_mencion:${cEnRet.id.replace(/-/g, '')}:%`, `comunidad_mencion:${cRetMen.id.replace(/-/g, '')}:%`]) === 0 && cRetMen.retenido,
    '(revisión) una mención en un comentario de una publicación retenida, o en un comentario retenido, no avisa');
  // (revisión) un entreno retenido no cuenta en el resumen de la semana ni en el perfil del equipo
  const [ent] = await q(`insert into comunidad_posts (autor_id, atleta_id, tipo, texto, resumen) values ($1, $2, 'entreno', 'Entreno zz044', '{"nombre": "Pierna", "ejercicios": [{"nombre": "Sentadilla", "record": true}]}') returning id`, [luis, aLuis.id]);
  await como(ana);
  const recA = (await q(`select records r from comunidad_resumen_semana()`))[0].r, entA = (await q(`select entrenos e from comunidad_perfil($1)`, [luis]))[0].e;
  const domA = (await (async () => { await su(); return q(`select records r from fbe_privado.comunidad_resumen_de_la_semana()`); })())[0].r;
  await q(`update comunidad_posts set retenida = true where id = $1`, [ent.id]);
  await como(ana);
  const recB = (await q(`select records r from comunidad_resumen_semana()`))[0].r, entB = (await q(`select entrenos e from comunidad_perfil($1)`, [luis]))[0].e;
  await su();
  const domB = (await q(`select records r from fbe_privado.comunidad_resumen_de_la_semana()`))[0].r;
  await q(`delete from comunidad_posts where id = $1`, [ent.id]);
  check(recB === recA - 1 && entB === entA - 1 && domB === domA - 1, '(revisión) un entreno retenido no cuenta en el resumen de la semana, en el del domingo ni en los entrenos del perfil');
  await como(ana);
  const anaRet = (await q(`select id from comunidad_posts where id = $1`, [ret.id])).length + (await q(`select id from comunidad_comentarios where id = $1`, [cRet.id])).length;
  const anaBien = (await q(`select id from comunidad_comentarios where id = $1`, [cBien.id])).length;
  check(anaRet === 0 && anaBien === 1 && await falla(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Visto')`, [ret.id]), 'Ana no ve lo retenido (ni lo puede comentar); lo demás, sí');
  check(await falla(`select comunidad_avisar_coach(null, $1, 'Retenido')`, [cRet.id]), '(revisión) ni avisa al coach de un comentario retenido que no ve');
  await como(pelayo, 'aal2');
  const [aCoachFiltro] = await q(`insert into comunidad_posts (tipo, texto) values ('aviso', 'No seáis tontos: a entrenar') returning retenida`);
  check(aCoachFiltro.retenida === false && (await q(`select count(*)::int n from comunidad_posts where retenida`))[0].n === 1, 'al coach nunca se le retiene nada; él ve lo retenido');
  await q(`select comunidad_aprobar($1, null)`, [ret.id]);
  await q(`select comunidad_aprobar(null, $1)`, [cRet.id]);
  await como(ana);
  check((await q(`select id from comunidad_posts where id = $1`, [ret.id])).length === 1 && (await q(`select id from comunidad_comentarios where id = $1`, [cRet.id])).length === 1
    && await falla(`select comunidad_aprobar($1, null)`, [ret.id]), 'el coach lo aprueba: ya lo ve Ana (un atleta no aprueba)');
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderacion_guardar('{}', 10)`);
  await como(luis);
  const lento1 = await mensaje(`insert into comunidad_posts (texto) values ('Una más')`);
  await su(); await q(`update comunidad_posts set creado_en = now() - interval '11 minutes' where autor_id = $1`, [luis]);
  await como(luis);
  const [lento2] = await q(`insert into comunidad_posts (texto) values ('Pasados 10 minutos') returning id`);
  check(/Modo lento: una publicación cada 10 minutos/.test(lento1 || '') && !!lento2 && await falla(`insert into comunidad_posts (texto) values ('Otra seguida')`)
    && (await q(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Comentar sí') returning id`, [pAnaSil.id])).length === 1,
    'con el modo lento (10 min), Luis publica una vez cada 10 minutos; comentar, sí');
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderacion_guardar('{}', 0)`);
  await su();
  await q(`delete from comunidad_posts where id = any($1::uuid[]) or texto in ('No seáis tontos: a entrenar', 'Aviso para silenciados')`, [[ret.id, retPreg.id, lento2.id]]);
  await q(`delete from comunidad_eventos`); await q(`delete from comunidad_destacados`); await q(`delete from notificaciones`);

  console.log('  · La 044 sin la 043, repetida y sobre una base que ya va por delante');
  const sin43 = new PGlite();
  await sin43.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin43.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '043')) await sin43.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  const sql44 = readFileSync(new URL('../supabase/migraciones/044_comunidad_coach.sql', import.meta.url), 'utf8');
  let e44a = null;
  try { await sin43.exec(sql44); } catch (e) { e44a = e.message; }
  check(/Antes de la 044 hace falta la 043/.test(e44a || '') && !(await sin43.query(`select 1 from pg_class where relname = 'comunidad_eventos'`)).rows.length, 'la 044 no se aplica sin la 043 (y no deja nada a medias)');
  await sin43.exec(readFileSync(new URL('../supabase/migraciones/043_comunidad_conversacion.sql', import.meta.url), 'utf8'));
  await sin43.exec(sql44);
  await sin43.exec(`insert into public.comunidad_eventos (titulo, empieza_en, lugar) values ('Quedada', now() + interval '1 day', 'Retiro')`);
  await sin43.exec(sql44);
  check((await sin43.query(`select count(*)::int n from fbe_migraciones where numero = 44`)).rows[0].n === 1 && (await sin43.query(`select count(*)::int n from comunidad_eventos`)).rows[0].n === 1
    && (await sin43.query(`select count(*)::int n from comunidad_moderacion`)).rows[0].n === 1, 'con la 043, se aplica; repetida, queda apuntada una vez y no toca lo guardado');
  await sin43.exec(`insert into public.fbe_migraciones (numero) values (45)`);
  let e44b = null;
  try { await sin43.exec(sql44); } catch (e) { e44b = e.message; }
  check(/ya tiene la migración 045/.test(e44b || ''), 'ni en una base que ya tiene una posterior');
  await sin43.close();
}

console.log('\nLa comunidad, quinta tanda: aniversarios, el mes en el equipo, hitos, reacciones y pegatinas, y momentos de 24 h (migración 045)');
{
  const n = async (sql, params = []) => (await q(sql, params))[0].n;
  await su();
  await q(`update comunidad_ajustes set activa = true`);
  await q(`update comunidad_miembros set sin_ranking = false, silenciado_hasta = null where perfil_id in ($1, $2)`, [ana, luis]);
  await q(`delete from comunidad_cupos`); await q(`delete from notificaciones`);
  await q(`select comunidad_moderacion_guardar('{}', 0)`).catch(() => {});
  await q(`update comunidad_moderacion set palabras = '{}', lento_min = 0`);
  const nuevas045 = ['comunidad_reaccion_valida', 'comunidad_pegatina_texto', 'comunidad_pegatina_valida', 'comunidad_meses_aniversario', 'comunidad_post_momento', 'comunidad_comentario_045',
    'comunidad_records_entre', 'comunidad_mes_equipo', 'comunidad_hitos_valores', 'comunidad_hitos', 'comunidad_crear_aniversarios', 'comunidad_limpiar_momentos',
    'comunidad_fuera_del_ranking', 'storage_borrado_cubo'];
  check(!(await q(`select 1 from pg_proc p where p.proname = any($1) and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))`, [nuevas045])).length
    && (await q(`select count(distinct proname)::int n from pg_proc where proname = any($1)`, [nuevas045]))[0].n === nuevas045.length
    && !(await q(`select 1 from pg_proc where proname = any($1) and (has_function_privilege('anon', oid, 'execute') or (pronamespace = 'fbe_privado'::regnamespace and has_function_privilege('authenticated', oid, 'execute')))`, [nuevas045])).length
    && (await q(`select relrowsecurity r from pg_class where oid = 'fbe_privado.comunidad_aniversarios'::regclass`))[0].r
    && !(await q(`select 1 from information_schema.role_table_grants where table_schema = 'fbe_privado' and table_name = 'comunidad_aniversarios' and grantee in ('anon', 'authenticated', 'PUBLIC')`)).length,
    'sus funciones, con search_path vacío, ninguna para anon y las internas solo para la base; los aniversarios ya puestos, en una tabla interna');
  check((await q(`select comunidad_reaccion_valida('corazon') a, comunidad_reaccion_valida('trofeo') b, comunidad_reaccion_valida('pulgar') c, comunidad_reaccion_valida(null) d,
      comunidad_pegatina_valida('dia_pierna') e, comunidad_pegatina_texto('dia_pierna') f, comunidad_pegatina_valida('otra') g, comunidad_pegatina_valida(null) h`))
    .map((x) => [x.a, x.b, x.c, x.d, x.e, x.f, x.g, x.h].join()).join() === 'true,true,false,false,true,Día de pierna,false,false',
    'los validadores: las seis reacciones y las seis pegatinas (con su texto), nunca un error');
  const meses = async (alta, hoy) => (await q(`select comunidad_meses_aniversario($1::date, $2::date) m`, [alta, hoy]))[0].m;
  check(await meses('2026-10-05', '2026-11-05') === 1 && await meses('2026-05-05', '2026-11-05') === 6 && await meses('2025-11-05', '2026-11-05') === 12 && await meses('2023-11-05', '2026-11-05') === 36
    && await meses('2026-09-05', '2026-11-05') === null && await meses('2026-10-06', '2026-11-05') === null && await meses('2026-11-05', '2026-11-05') === null
    && await meses('2026-01-31', '2026-02-28') === 1 && await meses('2026-01-30', '2026-02-28') === 1 && await meses('2026-01-31', '2026-02-27') === null
    && await meses('2024-02-29', '2025-02-28') === 12 && await meses('2023-08-31', '2024-02-29') === 6 && await meses('2026-03-31', '2026-04-30') === 1 && await meses(null, '2026-11-05') === null,
    'los meses de un aniversario: 1, 6, 12 y cada año; el día que no existe en ese mes, el último (31 de enero → 28 de febrero; 29 de febrero → 28 al año)');

  console.log('  · Reacciones nuevas y pegatinas');
  await como(pelayo, 'aal2');
  const [aviso45] = await q(`insert into comunidad_posts (tipo, texto) values ('aviso', 'Aviso de la tanda 5') returning id`);
  await como(luis);
  const [pLuis] = await q(`insert into comunidad_posts (texto) values ('Hoy pierna, mañana no me levanto') returning id`);
  await como(ana);
  check((await q(`select comunidad_reaccionar($1, 'corazon') r`, [pLuis.id]))[0].r === 'corazon' && (await q(`select comunidad_reaccionar($1, 'risa') r`, [pLuis.id]))[0].r === 'risa'
    && await n(`select count(*)::int n from comunidad_reacciones where post_id = $1`, [pLuis.id]) === 1 && await falla(`select comunidad_reaccionar($1, 'pulgar')`, [pLuis.id]),
    'Ana reacciona con ❤️ y la cambia por 😂 (una por persona, como siempre); una que no existe, no');
  await su();
  check(await n(`select count(*)::int n from notificaciones where usuario_id = $1 and clave like 'comunidad:' || $2 || ':%' and titulo like '% ha reaccionado a tu publicación'`, [luis, pLuis.id]) === 1,
    'a Luis le llega el aviso de siempre («… ha reaccionado a tu publicación»)');
  await como(intruso);
  check(await falla(`select comunidad_reaccionar($1, 'trofeo')`, [pLuis.id]), 'alguien de fuera no reacciona');
  await como(ana);
  const [peg] = await q(`insert into comunidad_comentarios (post_id, texto, pegatina, menciones) values ($1, 'lo que sea', 'dia_pierna', $2) returning texto, pegatina, menciones`, [pLuis.id, [luis]]);
  check(peg.texto === 'Día de pierna' && peg.pegatina === 'dia_pierna' && peg.menciones.length === 0 && await falla(`insert into comunidad_comentarios (post_id, texto, pegatina) values ($1, 'x', 'inventada')`, [pLuis.id]),
    'Ana manda una pegatina como comentario: la base pone su texto («Día de pierna») y ninguna mención; una que no existe, no');
  await como(luis);
  check((await q(`select pegatina from comunidad_comentarios where post_id = $1`, [pLuis.id])).map((x) => x.pegatina).join() === 'dia_pierna', 'Luis la ve (como cualquier comentario)');
  await como(intruso);
  check(!(await q(`select * from comunidad_comentarios where post_id = $1`, [pLuis.id])).length && await falla(`insert into comunidad_comentarios (post_id, texto, pegatina) values ($1, 'x', 'pr')`, [pLuis.id]),
    'alguien de fuera ni la ve ni manda pegatinas');
  await como(pelayo, 'aal2');
  await q(`select comunidad_silenciar($1, 24)`, [ana]);
  await como(ana);
  check(await falla(`insert into comunidad_comentarios (post_id, texto, pegatina) values ($1, 'x', 'vamos')`, [pLuis.id]), 'silenciada, tampoco manda pegatinas');
  await como(pelayo, 'aal2');
  await q(`select comunidad_silenciar($1, 0)`, [ana]);

  console.log('  · Momentos de 24 horas');
  const ruta = (k) => `${aAna.id}/Momento${k}abcd.jpg`;
  await como(ana);
  const [mom] = await q(`insert into comunidad_posts (tipo, texto, foto_ruta, tema, menciones) values ('momento', '  Atardecer   tras la sesión  ', $1, 'tecnica', $2) returning *`, [ruta(1), [luis]]);
  check(mom.tipo === 'momento' && mom.texto === 'Atardecer tras la sesión' && mom.tema === null && mom.menciones.length === 0 && mom.retenida === false,
    'Ana publica un momento: una foto y una línea (sin espacios de más, sin tema ni menciones)');
  check(await falla(`insert into comunidad_posts (tipo, texto) values ('momento', 'Sin foto')`) && await falla(`insert into comunidad_posts (tipo, texto, foto_ruta) values ('momento', $1, $2)`, ['x'.repeat(141), ruta(2)])
    && await falla(`insert into comunidad_posts (tipo, foto_ruta) values ('momento', $1)`, [`${aLuis.id}/Momento9abcd.jpg`]) && await falla(`insert into comunidad_posts (tipo, resumen) values ('aniversario', '{"meses": 1}')`),
    'sin foto, con más de 140 letras o con la foto de otro, no; un aniversario a mano, tampoco');
  await como(luis);
  const luisVe = (await q(`select id from comunidad_posts where id = $1`, [mom.id])).length;
  const luisFoto = (await q(`select comunidad_foto_visible($1) v`, [ruta(1)]))[0].v;
  check(luisVe === 1 && luisFoto && (await q(`select comunidad_reaccionar($1, 'fuego') r`, [mom.id]))[0].r === 'fuego'
    && /no llevan comentarios/.test(await mensaje(`insert into comunidad_comentarios (post_id, texto) values ($1, 'Qué bonito')`, [mom.id]) || ''),
    'Luis lo ve (y su foto) y reacciona; comentarlo, no (solo reacciones)');
  await como(intruso);
  check(!(await q(`select id from comunidad_posts where id = $1`, [mom.id])).length && !(await q(`select comunidad_foto_visible($1) v`, [ruta(1)]))[0].v, 'alguien de fuera no lo ve, ni su foto');
  // Con una palabra filtrada, retenido (solo su autora y el coach); oculto, solo el coach
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderacion_guardar(array['agujetazo'], 0)`);
  await como(ana);
  const [momRet] = await q(`insert into comunidad_posts (tipo, texto, foto_ruta) values ('momento', 'Menudo agujetazo', $1) returning id, retenida`, [ruta(3)]);
  const anaRet = (await q(`select id from comunidad_posts where id = $1`, [momRet.id])).length;
  await como(luis);
  const luisRet = (await q(`select id from comunidad_posts where id = $1`, [momRet.id])).length;
  check(momRet.retenida && anaRet === 1 && luisRet === 0, 'con una palabra filtrada, el momento queda retenido: lo ve Ana (pendiente de revisión), Luis no');
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderacion_guardar('{}', 0)`);
  await q(`select comunidad_moderar($1, null, true)`, [mom.id]);
  await como(luis);
  const luisOculto = (await q(`select id from comunidad_posts where id = $1`, [mom.id])).length;
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderar($1, null, false)`, [mom.id]);
  await q(`select comunidad_silenciar($1, 24)`, [ana]);
  await como(ana);
  const silMom = await mensaje(`insert into comunidad_posts (tipo, foto_ruta) values ('momento', $1)`, [ruta(4)]);
  await como(pelayo, 'aal2');
  await q(`select comunidad_silenciar($1, 0)`, [ana]);
  check(luisOculto === 0 && /pausado tus publicaciones/.test(silMom || ''), 'oculto por el coach, Luis no lo ve; silenciada, Ana no publica momentos');
  await como(luis);
  const [rep] = await q(`select comunidad_avisar_coach($1, null, 'No me gusta') id`, [mom.id]);
  await su();
  check(!!rep.id && (await q(`select copia_tipo, copia_foto from comunidad_reportes where id = $1`, [rep.id])).map((x) => `${x.copia_tipo}|${x.copia_foto}`).join() === `momento|${ruta(1)}`,
    '«Avisar al coach» de un momento guarda su copia (con la foto)');
  // Pasan 24 horas: nadie más lo ve (la base), y crear_recordatorios() lo borra; su foto, a la cola de Storage (salvo la que guarda un aviso abierto)
  const [mom2] = await q(`insert into comunidad_posts (autor_id, atleta_id, tipo, foto_ruta) values ($1, $2, 'momento', $3) returning id`, [ana, aAna.id, ruta(5)]);
  await q(`update comunidad_posts set creado_en = now() - interval '24 hours 5 minutes' where id = any($1::uuid[])`, [[mom.id, mom2.id]]);
  await como(luis);
  const luisTarde = (await q(`select id from comunidad_posts where id = any($1::uuid[])`, [[mom.id, mom2.id]])).length + (await q(`select post_id from comunidad_reacciones where post_id = $1`, [mom.id])).length;
  const fotoTarde = (await q(`select comunidad_foto_visible($1) v`, [ruta(5)]))[0].v;
  const reacTarde = await falla(`select comunidad_reaccionar($1, 'risa')`, [mom2.id]);
  await como(ana);
  const anaTarde = (await q(`select id from comunidad_posts where id = any($1::uuid[])`, [[mom.id, mom2.id]])).length;
  await como(pelayo, 'aal2');
  const coachTarde = (await q(`select id from comunidad_posts where id = any($1::uuid[])`, [[mom.id, mom2.id]])).length;
  check(luisTarde === 0 && !fotoTarde && reacTarde && anaTarde === 0 && coachTarde === 2, 'pasadas 24 horas, ni Luis ni Ana lo ven (ni la foto ni sus reacciones, ni se reacciona); el coach, hasta que se borre');
  await su();
  await q(`select crear_recordatorios(now())`);
  const cola = (await q(`select ruta, bucket from fbe_privado.storage_por_borrar where ruta like $1 order by ruta`, [`${aAna.id}/Momento%`])).map((x) => `${x.ruta.split('/')[1]}:${x.bucket}`).join();
  check(!(await q(`select id from comunidad_posts where id = any($1::uuid[])`, [[mom.id, mom2.id]])).length && cola === 'Momento5abcd.jpg:comunidad'
    && (await q(`select post_id from comunidad_reportes where id = $1`, [rep.id]))[0].post_id === null && (await q(`select id from comunidad_posts where id = $1`, [momRet.id])).length === 1,
    'crear_recordatorios() borra los momentos caducados (los de ahora, no) y pone su foto en la cola de Storage del bucket «comunidad» (la del aviso abierto, no: se borra al resolverlo)');
  await como(ana);
  check(/ya está en otra publicación/.test(await mensaje(`insert into comunidad_posts (texto, foto_ruta) values ('La de mi momento', $1)`, [ruta(5)]) || ''),
    '(revisión) la foto de un momento caducado que espera a borrarse no se reutiliza en otra publicación');
  await su();
  await q(`insert into fbe_privado.storage_por_borrar (ruta, bucket) values ($1, 'archivos')`, [ruta(5)]);
  const dosCubos = await n(`select count(*)::int n from fbe_privado.storage_por_borrar where ruta = $1`, [ruta(5)]);
  const archivoPorBorrar = (await q(`select ruta_por_borrar($1) v`, [ruta(5)]))[0].v;
  await q(`delete from fbe_privado.storage_por_borrar where ruta = $1 and bucket = 'archivos'`, [ruta(5)]);
  const soloComunidad = (await q(`select ruta_por_borrar($1) v`, [ruta(5)]))[0].v;
  check(dosCubos === 2 && archivoPorBorrar === true && soloComunidad === false, '(revisión) la cola va por bucket y ruta: una ruta de «archivos» no quita el sitio a la misma de la comunidad (ruta_por_borrar mira solo las suyas)');
  await como(pelayo, 'aal2');
  check((await q(`select bucket from storage_pendiente_cubos(1000)`)).some((x) => x.bucket === 'comunidad') && (await q(`select storage_borrado_cubo('archivos', array[$1]) n`, [ruta(5)]))[0].n === 0
    && (await q(`select storage_borrado_cubo('comunidad', array[$1]) n`, [ruta(5)]))[0].n === 1,
    'el coach la ve en la cola (con su bucket) y la quita al borrarla (solo de su bucket)');
  await como(ana);
  check(await falla(`select storage_borrado_cubo('comunidad', array['x'])`), 'un atleta no toca la cola');
  // (revisión) el modo lento también cuenta los momentos
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderacion_guardar('{}', 10)`);
  await como(ana);
  const lentoMom = await mensaje(`insert into comunidad_posts (tipo, foto_ruta) values ('momento', $1)`, [ruta(6)]);
  await su(); await q(`update comunidad_posts set creado_en = now() - interval '11 minutes' where autor_id = $1 and tipo in ('post', 'momento')`, [ana]);
  await como(ana);
  const [momL] = await q(`insert into comunidad_posts (tipo, foto_ruta) values ('momento', $1) returning id`, [ruta(7)]);
  const lentoPost = await mensaje(`insert into comunidad_posts (texto) values ('Justo después')`);
  await como(pelayo, 'aal2');
  await q(`select comunidad_moderacion_guardar('{}', 0)`);
  await su(); await q(`delete from comunidad_posts where id = $1`, [momL.id]);
  check(/Modo lento/.test(lentoMom || '') && !!momL && /Modo lento/.test(lentoPost || ''), '(revisión) con el modo lento, un momento cuenta como una publicación (ni momento justo después de publicar, ni al revés)');
  await su();
  await q(`delete from comunidad_posts where id = $1`, [momRet.id]);
  await q(`delete from comunidad_reportes where id = $1`, [rep.id]);

  console.log('  · Aniversarios en FBE');
  await su();
  await q(`delete from notificaciones`);
  const hoyM = (await q(`select (now() at time zone 'Europe/Madrid')::date::text d`))[0].d;
  const [{ alta: altaAntes }] = await q(`select fecha_alta::text alta from atletas where id = $1`, [aAna.id]);
  const [{ alta: altaLuis }] = await q(`select fecha_alta::text alta from atletas where id = $1`, [aLuis.id]);
  await q(`update atletas set fecha_alta = ($1::date - interval '1 month')::date where id = $2`, [hoyM, aAna.id]);
  // (Luis: hoy no; mañana cumple 6 meses)
  await q(`update atletas set fecha_alta = ($1::date + 1 - interval '6 months')::date where id = $2`, [hoyM, aLuis.id]);
  const aniversarioDeLuisHoy = (await q(`select comunidad_meses_aniversario(fecha_alta, $1::date) m from atletas where id = $2`, [hoyM, aLuis.id]))[0].m;
  await q(`select crear_recordatorios(now())`);
  await q(`select crear_recordatorios(now())`);
  const anis = await q(`select autor_id, atleta_id, texto, tema, resumen, retenida from comunidad_posts where tipo = 'aniversario'`);
  check(aniversarioDeLuisHoy === null && anis.length === 1 && anis[0].autor_id === ana && anis[0].atleta_id === aAna.id && anis[0].resumen.meses === 1 && anis[0].texto === null && anis[0].tema === null && !anis[0].retenida,
    'el día que Ana cumple 1 mes, crear_recordatorios() pone en el muro, una vez, su aniversario (a su nombre, con los meses)');
  await como(luis);
  const [aniL] = await q(`select id from comunidad_posts where tipo = 'aniversario'`);
  await su();
  await q(`update comunidad_miembros set sin_ranking = true where perfil_id = $1`, [ana]);
  await como(luis);
  const luisSin = (await q(`select id from comunidad_posts where tipo = 'aniversario'`)).length + (await q(`select comunidad_post_visible($1) v`, [aniL.id]))[0].v;
  await como(ana);
  const anaSin = (await q(`select id from comunidad_posts where tipo = 'aniversario'`)).length;
  await como(pelayo, 'aal2');
  const coachSin = (await q(`select id from comunidad_posts where tipo = 'aniversario'`)).length;
  await su();
  await q(`update comunidad_miembros set sin_ranking = false where perfil_id = $1`, [ana]);
  check(luisSin === 0 && anaSin === 1 && coachSin === 1, '(revisión) si después elige «No salir en el ranking», su aniversario deja de verse para los demás (ella y el coach, sí)');
  const insignia = async () => (await q(`select valor from fbe_privado.comunidad_insignias_de($1, $2) where clave = 'primera_publicacion'`, [aAna.id, ana]))[0].valor;
  const conAni = await insignia();
  await q(`update comunidad_posts set tipo = 'post', resumen = null, texto = 'temporal' where id = $1`, [aniL.id]).catch(() => null);
  const sinAni = await insignia();
  await q(`update comunidad_posts set tipo = 'aniversario', resumen = '{"meses": 1}', texto = null where id = $1`, [aniL.id]);
  await como(pelayo, 'aal2');
  const panelPub = (await q(`select comunidad_panel() p`))[0].p.semanas.reduce((a, s) => a + s.publicaciones, 0);
  await su();
  await q(`update comunidad_posts set tipo = 'post', resumen = null, texto = 'temporal' where id = $1`, [aniL.id]);
  await como(pelayo, 'aal2');
  const panelPub2 = (await q(`select comunidad_panel() p`))[0].p.semanas.reduce((a, s) => a + s.publicaciones, 0);
  await su();
  await q(`update comunidad_posts set tipo = 'aniversario', resumen = '{"meses": 1}', texto = null where id = $1`, [aniL.id]);
  check(conAni === sinAni - 1 && panelPub === panelPub2 - 1, '(revisión) el aniversario no cuenta para la insignia «primera publicación» ni en las publicaciones del panel del coach');
  await como(luis);
  check(!!aniL && (await q(`select comunidad_reaccionar($1, 'trofeo') r`, [aniL.id]))[0].r === 'trofeo'
    && (await q(`insert into comunidad_comentarios (post_id, texto) values ($1, '¡Felicidades, Ana!') returning id`, [aniL.id])).length === 1,
    'Luis lo ve, reacciona y comenta (como cualquier publicación)');
  await como(intruso);
  check(!(await q(`select id from comunidad_posts where tipo = 'aniversario'`)).length, 'alguien de fuera no lo ve');
  await como(ana);
  await q(`delete from comunidad_posts where id = $1`, [aniL.id]);
  await su();
  await q(`select crear_recordatorios(now())`);
  check(!(await q(`select id from comunidad_posts where tipo = 'aniversario'`)).length, 'si Ana lo borra, no vuelve a salir');
  // Quien no sale en el ranking: su tarjeta de Hoy sí (la app), en el muro no
  await q(`delete from fbe_privado.comunidad_aniversarios`);
  await q(`update comunidad_miembros set sin_ranking = true where perfil_id = $1`, [ana]);
  await q(`select crear_recordatorios(now())`);
  const sinRankingAni = (await q(`select id from comunidad_posts where tipo = 'aniversario'`)).length;
  await q(`update comunidad_miembros set sin_ranking = false where perfil_id = $1`, [ana]);
  check(sinRankingAni === 0, 'quien ha elegido «No salir en el ranking» no sale en el muro por su aniversario');
  const madrid = (h) => `(($1::date + time '${h}') at time zone 'Europe/Madrid')`;
  await q(`delete from notificaciones`);
  await q(`select crear_recordatorios(${madrid('08:30')})`, [hoyM]);
  const antes9 = await n(`select count(*)::int n from notificaciones where clave like 'comunidad_aniversario:%'`);
  await q(`select crear_recordatorios(${madrid('10:00')})`, [hoyM]);
  await q(`select crear_recordatorios(${madrid('11:00')})`, [hoyM]);
  const avCoach = await q(`select usuario_id, titulo, url from notificaciones where clave like 'comunidad_aniversario:%'`);
  check(antes9 === 0 && avCoach.length === 1 && avCoach[0].usuario_id === pelayo && avCoach[0].titulo === 'Mañana Luis cumple 6 meses en FBE 🎉' && avCoach[0].url === `#mensajes/${aLuis.id}`,
    'al coach, el día antes (desde las 9:00), una vez: «Mañana Luis cumple 6 meses en FBE 🎉», que lleva a su chat');
  await q(`update atletas set fecha_alta = $1 where id = $2`, [altaAntes, aAna.id]);
  await q(`update atletas set fecha_alta = $1 where id = $2`, [altaLuis, aLuis.id]);
  await q(`delete from comunidad_posts where tipo = 'aniversario'`); await q(`delete from fbe_privado.comunidad_aniversarios`); await q(`delete from notificaciones`);

  console.log('  · «<Mes> en el equipo» y los hitos');
  // Un entreno de Luis del mes pasado con dos récords, y tres 🏆 del mes pasado en una publicación
  const mesPasado = `(date_trunc('month', now() at time zone 'Europe/Madrid') - interval '5 days') at time zone 'Europe/Madrid'`;
  const [entL] = await q(`insert into comunidad_posts (autor_id, atleta_id, tipo, texto, resumen, creado_en) values ($1, $2, 'entreno', 'Entreno zz045',
    '{"nombre": "Pierna", "ejercicios": [{"nombre": "Sentadilla", "record": true}, {"nombre": "Prensa", "record": true}]}', ${mesPasado}) returning id`, [luis, aLuis.id]);
  await q(`insert into comunidad_reacciones (post_id, autor_id, tipo, creado_en) values ($1, $2, 'trofeo', ${mesPasado}), ($1, $3, 'trofeo', ${mesPasado}), ($1, $4, 'trofeo', ${mesPasado})`, [entL.id, ana, luis, pelayo]);
  await como(ana);
  const m1 = (await q(`select comunidad_mes_equipo() m`))[0].m;
  check(/^\d{4}-\d{2}$/.test(m1.mes) && ['sesiones', 'semanas_completas', 'records', 'retos', 'racha', 'miembros'].every((k) => Number.isInteger(m1.equipo[k])) && m1.equipo.records >= 2 && m1.equipo.reaccion === 'trofeo'
    && ['sesiones', 'records', 'racha', 'animos_dados', 'animos_recibidos'].every((k) => Number.isInteger(m1.yo[k])) && !/zz045|Sentadilla|Ana|Luis/.test(JSON.stringify(m1)),
    'el mes pasado en el equipo: sesiones, semanas completas, récords, retos, la reacción más usada y la racha más larga, y lo de Ana (solo recuentos, sin nombres)');
  await su(); await q(`update comunidad_posts set retenida = true where id = $1`, [entL.id]);
  await como(ana);
  const m2 = (await q(`select comunidad_mes_equipo() m`))[0].m;
  await su(); await q(`update comunidad_posts set retenida = false, oculta = true where id = $1`, [entL.id]);
  await como(ana);
  const m3 = (await q(`select comunidad_mes_equipo() m`))[0].m;
  await su(); await q(`update comunidad_posts set oculta = false where id = $1`, [entL.id]); await q(`update comunidad_miembros set sin_ranking = true where perfil_id = $1`, [luis]);
  await como(ana);
  const m4 = (await q(`select comunidad_mes_equipo() m`))[0].m;
  await su(); await q(`update comunidad_miembros set sin_ranking = false where perfil_id = $1`, [luis]);
  check(m2.equipo.records === m1.equipo.records - 2 && m3.equipo.records === m1.equipo.records - 2 && m2.equipo.reaccion !== 'trofeo' && m3.equipo.reaccion !== 'trofeo'
    && m4.equipo.records === m1.equipo.records - 2 && m4.equipo.miembros === m1.equipo.miembros - 1 && m4.equipo.reaccion !== 'trofeo',
    'lo retenido u oculto no cuenta (ni sus récords ni sus reacciones), ni lo de quien no sale en el ranking (ni las reacciones a lo suyo)');
  await su(); await q(`update comunidad_miembros set salido_en = now() where perfil_id = $1`, [luis]);
  await como(ana);
  const m5 = (await q(`select comunidad_mes_equipo() m`))[0].m;
  await su(); await q(`update comunidad_miembros set salido_en = null where perfil_id = $1`, [luis]);
  check(m5.equipo.records === m1.equipo.records - 2 && m5.equipo.reaccion !== 'trofeo', 'ni lo de quien ha salido (ni sus reacciones)');
  await como(pelayo, 'aal2');
  const mc = (await q(`select comunidad_mes_equipo() m`))[0].m;
  await como(intruso);
  const mi = (await q(`select comunidad_mes_equipo() m`))[0].m;
  check(mc?.equipo && mc.yo === null && mi === null, 'el coach ve lo del equipo; alguien de fuera, nada');
  // (la comunidad se abrió hace 60 días: el primero que entró)
  await su();
  const [{ c: entradaAna }] = await q(`select creado_en c from comunidad_miembros where perfil_id = $1`, [ana]);
  await q(`update comunidad_miembros set creado_en = now() - interval '60 days' where perfil_id = $1`, [ana]);
  await como(ana);
  const h1 = await q(`select clave, medida, meta, valor from comunidad_hitos()`);
  check(h1.map((x) => x.clave).join() === 'sesiones_100,sesiones_500,sesiones_1000,sesiones_2500,sesiones_5000,records_50,records_100,retos_10' && h1.every((x) => Number.isInteger(x.valor)),
    'los hitos del equipo: 100 a 5.000 sesiones, 50 y 100 récords y 10 retos, con lo que llevan');
  const recH = (l) => l.find((x) => x.clave === 'records_50').valor;
  await su(); await q(`update comunidad_posts set retenida = true where id = $1`, [entL.id]);
  await como(ana);
  const h2 = await q(`select clave, valor from comunidad_hitos()`);
  await su(); await q(`update comunidad_posts set retenida = false where id = $1`, [entL.id]); await q(`update comunidad_miembros set sin_ranking = true where perfil_id = $1`, [luis]);
  await como(ana);
  const h3 = await q(`select clave, valor from comunidad_hitos()`);
  await su(); await q(`update comunidad_miembros set sin_ranking = false where perfil_id = $1`, [luis]);
  await como(intruso);
  const hi = (await q(`select * from comunidad_hitos()`)).length;
  await su(); await q(`update comunidad_miembros set creado_en = $2 where perfil_id = $1`, [ana, entradaAna]);
  check(recH(h1) >= 2 && recH(h2) === recH(h1) - 2 && recH(h3) === recH(h1) - 2 && hi === 0, 'en los hitos tampoco cuenta lo retenido ni lo de quien no sale en el ranking; alguien de fuera no los ve');
  await su();
  await q(`delete from comunidad_posts where id = any($1::uuid[])`, [[entL.id, pLuis.id, aviso45.id]]);

  console.log('  · La 045 sin la 044, repetida y sobre una base que ya va por delante');
  const sin44 = new PGlite();
  await sin44.exec(readFileSync(new URL('./entorno-supabase.sql', import.meta.url), 'utf8'));
  await sin44.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const m of migraciones().filter((m) => m < '044')) await sin44.exec(readFileSync(new URL(`../supabase/migraciones/${m}`, import.meta.url), 'utf8'));
  const sql45 = readFileSync(new URL('../supabase/migraciones/045_comunidad_momentos.sql', import.meta.url), 'utf8');
  let e45a = null;
  try { await sin44.exec(sql45); } catch (e) { e45a = e.message; }
  check(/Antes de la 045 hace falta la 044/.test(e45a || '') && !(await sin44.query(`select 1 from information_schema.columns where table_name = 'comunidad_comentarios' and column_name = 'pegatina'`)).rows.length,
    'la 045 no se aplica sin la 044 (y no deja nada a medias)');
  await sin44.exec(readFileSync(new URL('../supabase/migraciones/044_comunidad_coach.sql', import.meta.url), 'utf8'));
  await sin44.exec(sql45);
  await sin44.exec(sql45);
  check((await sin44.query(`select count(*)::int n from fbe_migraciones where numero = 45`)).rows[0].n === 1, 'con la 044, se aplica; repetida, queda apuntada una vez');
  await sin44.exec(`insert into public.fbe_migraciones (numero) values (46)`);
  let e45b = null;
  try { await sin44.exec(sql45); } catch (e) { e45b = e.message; }
  check(/ya tiene la migración 046/.test(e45b || ''), 'ni en una base que ya tiene una posterior');
  // (revisión) repetir la 027, la 029 o la 034 con datos de la 045 se para con un aviso claro (y no deja nada a medias)
  const sqlDe45 = (m) => readFileSync(new URL(`../supabase/migraciones/${migraciones().find((x) => x.startsWith(m))}`, import.meta.url), 'utf8');
  const repetir = async (m) => { await sin44.exec(`delete from public.fbe_migraciones where numero > ${Number(m) - 1}`); try { await sin44.exec(sqlDe45(m)); return null; } catch (e) { return e.message; } };
  await sin44.exec(`insert into fbe_privado.storage_por_borrar (ruta, bucket) values ('coach/Fotomomento1.jpg', 'comunidad')`);
  const e34 = await repetir('034');
  await sin44.exec(`delete from fbe_privado.storage_por_borrar; insert into auth.users (email) values ('m@test');
    insert into public.comunidad_posts (autor_id, tipo, foto_ruta) select id, 'momento', 'coach/Fotomomento2.jpg' from public.perfiles limit 1;`);
  const e29 = await repetir('029');
  const e27 = await repetir('027');
  check(/fotos de la comunidad esperando a borrarse/.test(e34 || '') && /momentos, aniversarios, reacciones nuevas o pegatinas de la 045: repetir la 029/.test(e29 || '')
    && /de la 045: repetir la 027/.test(e27 || '') && (await sin44.query(`select count(*)::int n from public.comunidad_posts where tipo = 'momento'`)).rows[0].n === 1,
    '(revisión) repetir la 027, la 029 o la 034 con momentos, aniversarios, reacciones nuevas, pegatinas o fotos de la comunidad en la cola se para con un aviso claro');
  await sin44.close();
}

console.log('\n«Programar según FBE», fase 1b: reglas por atleta y propuestas guardadas (migración 046)');
{
  await su();
  const [aR] = await q(`insert into atletas (nombre, perfil_id) values ('Reglas', null) returning id`);
  await como(pelayo, 'aal2');
  const reglas = { v: 1, perfil: 'intermedio_fuerza', atleta: { porSerie: { rpeSube: 8.5 } }, porEjercicio: {} };
  await q(`update atletas set reglas_motor = $1 where id = $2`, [JSON.stringify(reglas), aR.id]);
  check((await q(`select reglas_motor r from atletas where id = $1`, [aR.id]))[0].r?.perfil === 'intermedio_fuerza', 'el coach guarda las reglas del motor de un atleta');
  check(await falla(`update atletas set reglas_motor = '[1, 2]'::jsonb where id = $1`, [aR.id])
    && await falla(`update atletas set reglas_motor = $1 where id = $2`, [JSON.stringify({ x: 'a'.repeat(70000) }), aR.id]),
    'solo un objeto, y de tamaño razonable');
  await como(luis);
  await q(`update atletas set reglas_motor = '{"perfil":"novato_lineal"}'::jsonb where id = $1`, [aLuis.id]).catch(() => {});
  const propias = await q(`update atletas set reglas_motor = '{"perfil":"novato_lineal"}'::jsonb where id = $1 returning id`, [aLuis.id]).catch(() => []);
  await como(ana);
  const ajenas = await q(`select reglas_motor from atletas where id = $1`, [aLuis.id]);
  await su();
  check(!propias.length && (await q(`select reglas_motor r from atletas where id = $1`, [aLuis.id]))[0].r === null && !ajenas.length,
    'el atleta no puede cambiarlas, y otro atleta no las ve');
  await q(`delete from atletas where id = $1`, [aR.id]);
  // Lo que propuso el motor, en la semana: lo escribe el coach; el atleta no
  const [wR] = await q(`select w.id from semanas w join bloques k on k.id = w.bloque_id where k.atleta_id = $1 order by w.numero limit 1`, [aAna.id]);
  await como(pelayo, 'aal2');
  await q(`update semanas set propuesta_motor = $1 where id = $2`, [JSON.stringify({ v: 1, filas: [] }), wR.id]);
  const objeto = await falla(`update semanas set propuesta_motor = '"x"'::jsonb where id = $1`, [wR.id]);
  await como(ana);
  const cambia = await q(`update semanas set propuesta_motor = null where id = $1 returning id`, [wR.id]).catch(() => []);
  await su();
  check(objeto && !cambia.length && (await q(`select propuesta_motor p from semanas where id = $1`, [wR.id]))[0].p?.v === 1,
    'el coach apunta en la semana lo que propuso el motor (solo un objeto); el atleta no puede cambiarlo');
  await q(`update semanas set propuesta_motor = null where id = $1`, [wR.id]);
}

console.log('\nFotos de perfil ligeras: la miniatura en foto y la grande aparte (migración 047)');
{
  const mini = `data:image/jpeg;base64,${'A'.repeat(400)}`, grande = `data:image/jpeg;base64,${'B'.repeat(4000)}`;
  await como(ana);
  await q(`update perfiles set foto = $1, foto_grande = $2 where id = $3`, [mini, grande, ana]);
  check((await q(`select foto from perfiles where id = $1`, [ana]))[0].foto === mini && (await q(`select foto_grande_de($1) f`, [ana]))[0].f === grande,
    'cada uno guarda su miniatura y su foto grande, y ve la suya en grande');
  check(await falla(`update perfiles set foto_grande = 'x' where id = $1`, [ana])
    && await falla(`update perfiles set foto_grande = $1 where id = $2`, [`data:image/jpeg;base64,${'A'.repeat(80001)}`, ana]),
    'la foto grande tiene que ser una imagen (JPEG o WebP en base64) y no pasar del tamaño máximo');
  await q(`update perfiles set foto_grande = $1 where id = $2`, [grande, luis]).catch(() => {});
  await db.exec('reset role;');
  check((await q(`select foto_grande from perfiles where id = $1`, [luis]))[0].foto_grande == null, 'y no puede cambiar la de otra persona');
  await como(pelayo, 'aal2');
  check((await q(`select foto_grande_de($1) f`, [ana]))[0].f === grande, 'el coach ve en grande la de sus atletas');
  // El coach, sin aligerar todavía: su foto de siempre sigue en «foto» y es la que se enseña en grande
  await q(`update perfiles set foto = $1, foto_grande = null where id = $2`, [grande, pelayo]);
  // (y puede aligerar la de un atleta: pasa la actual a foto_grande y deja la miniatura en foto)
  await q(`update perfiles set foto = $1, foto_grande = $2 where id = $3`, [mini, grande, luis]);
  check((await q(`select foto, foto_grande from perfiles where id = $1`, [luis]))[0].foto === mini, 'y puede aligerar la de un atleta (la app lo hace sola la primera vez)');
  await como(luis);
  check((await q(`select foto_grande_de() f`))[0].f === grande && (await q(`select foto_grande_de($1) f`, [pelayo]))[0].f === grande,
    'un atleta ve en grande la del coach (sin decir de quién: la del coach), también si aún no se ha aligerado');
  // Entre atletas, solo si los dos están dentro de la comunidad (lo mismo que ya pasa con la foto pequeña)
  await db.exec('reset role;');
  const activa = (await q(`select public.comunidad_activa() a`).catch(() => [{ a: false }]))[0].a;
  const dentro = (await q(`select perfil_id from fbe_privado.comunidad_dentro`)).map((x) => x.perfil_id);
  const seVen = !!activa && dentro.includes(luis) && dentro.includes(ana);
  await como(luis);
  const deAna = (await q(`select foto_grande_de($1) f`, [ana]))[0]?.f ?? null;
  check((deAna === grande) === seVen, `entre atletas, solo si los dos están dentro de la comunidad (aquí ${seVen ? 'lo están: la ve' : 'no lo están: no la ve'})`);
  await como(intruso);
  check(((await q(`select foto_grande_de($1) f`, [ana]))[0]?.f ?? null) === null, 'una cuenta que no es de nadie del equipo no ve la de un atleta');
  await db.exec('reset role; set role anon;');
  check(await falla(`select foto_grande_de($1)`, [ana]), 'y sin sesión no se puede ni llamar');
  await como(ana);
  await q(`update perfiles set foto = null, foto_grande = null where id = $1`, [ana]);
  await como(pelayo, 'aal2');
  await q(`update perfiles set foto = null, foto_grande = null where id in ($1, $2)`, [pelayo, luis]);
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
