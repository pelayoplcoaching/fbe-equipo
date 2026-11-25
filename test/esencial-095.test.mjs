// FBE Esencial, migración 095, contra el esquema real (PGlite, con RLS): el aviso del cuestionario antes de empezar
// (crear_recordatorios, la de la 094 con un bloque más). A quien activó su cuenta y no ha enviado el cuestionario, en los
// 5 días antes de su lunes de inicio, a su hora de la mañana, una vez por tanda; a nadie más.
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, sumarDias, lunesDe } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const q = (sql, p = []) => b.sql(sql, p);
const SQL = (n) => readFileSync(new URL(`../supabase/migraciones/${n}`, import.meta.url), 'utf8');

console.log('crear_recordatorios de la 095: la de la 094 con un bloque más');
const de = (txt) => { const i = txt.lastIndexOf('create or replace function public.crear_recordatorios(p_ahora'); return txt.slice(i, txt.indexOf('\nend $$;', i)); };
const f094 = de(SQL('094_esencial_piloto.sql')), f095 = de(SQL('095_esencial_cuestionario.sql'));
const corte = f094.lastIndexOf('  return v_n;');
check(f095.startsWith(f094.slice(0, corte)) && f095.endsWith('  return v_n;') && /esencial_cuestionario/.test(f095.slice(corte)) && f095.length > f094.length,
  'empieza exactamente como la de la 094 y añade su bloque al final, a prueba de fallos');
check((await q('select max(numero) n from fbe_migraciones'))[0].n >= 95, 'la base de prueba tiene la 095');

// El coach da de alta a seis de FBE Esencial que empiezan el lunes que viene (y una, dentro de dos semanas)
const inicio = sumarDias(lunesDe(hoyISO()), 7);
await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const alta = {};
for (const [n, ini] of [['Ana', inicio], ['Berta', inicio], ['Carmen', sumarDias(inicio, 14)], ['Dani', inicio], ['Eva', inicio]]) {
  alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n.toLowerCase()}@test`, inicio: ini });
}
const entrar = async (n) => {
  const email = `${n.toLowerCase()}@test`;
  await b.auth.registrar(email, `clave-${email}`, n);
  await api.canjearCodigo(alta[n].codigo);
  await api.darConsentimientos();
  return (await q('select id, perfil_id from atletas where email = $1', [email]))[0];
};
const limpio = { objetivo: 'salud', experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, lugar: 'gimnasio', material: ['maquinas'], activo: false, enfermedad: false, sintomas: [], otras: [], lesiones: [] };
const ana = await entrar('Ana');
const berta = await entrar('Berta');
await api.guardarCuestionario(berta.id, limpio, { completar: true });
const carmen = await entrar('Carmen');
const eva = await entrar('Eva');
// (Dani no ha activado su cuenta.) Todas con los avisos por correo; Eva, con los del cuestionario apagados
await db.exec('reset role;');
for (const a of [ana, berta, carmen, eva]) {
  await db.query('insert into preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true', [a.perfil_id]);
}
await db.query(`update preferencias_notificaciones set desactivados = array['cuestionario', 'sesion_hecha'] where usuario_id = $1`, [eva.perfil_id]);

const servidor = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false); set role service_role;`;
const llamar = async (dia, h) => { await db.exec(servidor); await db.query('select public.crear_recordatorios($1::timestamptz)', [`${dia} ${h}:00 Europe/Madrid`]); await db.exec('reset role;'); };
const avisos = async () => (await db.query(`select n.titulo, n.cuerpo, n.tipo, n.url, a.id atleta from notificaciones n join atletas a on a.perfil_id = n.usuario_id
  where n.clave like 'esencial_cuestionario:%'`)).rows;

console.log('\nEl aviso del cuestionario');
const viernes = sumarDias(inicio, -3);
await llamar(sumarDias(inicio, -7), '09:00');
check((await avisos()).length === 0, 'a 7 días de su lunes, aún nada (solo en los 5 días de antes)');
await llamar(viernes, '07:00');
check((await avisos()).length === 0, 'el viernes de antes, a las siete, nada (va a su hora de la mañana, las 8:30)');
await llamar(viernes, '09:00');
const r = await avisos();
check(r.length === 1 && r[0].atleta === ana.id && r[0].titulo === 'Te falta tu cuestionario' && r[0].tipo === 'cuestionario' && r[0].url === '#hoy/cuestionario' && /Empiezas el lunes/.test(r[0].cuerpo),
  'a su hora, a Ana (cuenta activa, sin cuestionario): «Te falta tu cuestionario», a Hoy');
check(!r.some((x) => [berta.id, carmen.id, eva.id].includes(x.atleta)), 'a Berta (ya lo envió), a Carmen (empieza dentro de dos semanas) y a Eva (los tiene apagados), no; Dani no ha activado su cuenta');
await llamar(sumarDias(viernes, 1), '09:00');
check((await avisos()).length === 1, 'al día siguiente no se repite (uno por tanda)');
await db.query('delete from notificaciones where clave like $1', ['esencial_cuestionario:%']);
await llamar(inicio, '09:00');
check((await avisos()).length === 0, 'el mismo lunes, ya no (el aviso es para antes de empezar)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
