// (v0.209) La copia completa, al día: toda tabla que crean schema.sql y las migraciones está en la copia, en la copia
// privada (copia_privada, para las que solo se abren con funciones) o fuera a propósito y con su motivo; la app sabe por
// qué migración va la base y lo que le falta; y «Recuperar un atleta» devuelve también lo de las versiones nuevas.
//   node test/copia.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { TABLAS_COPIA, TABLAS_OPCIONALES, FUERA_DE_COPIA } from '../web/src/datos/copia-tablas.js';
import { MIGRACION_ULTIMA, HUECOS_MIGRACIONES, migracionesQueFaltan } from '../web/src/datos/migracion.js';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e?.stack || e); process.exit(1); });
const lee = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
const sinComentarios = (s) => s.replace(/--[^\n]*/g, '');

const MIG = readdirSync(new URL('../supabase/migraciones/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const ARCHIVOS = ['supabase/schema.sql', ...MIG.map((f) => `supabase/migraciones/${f}`)];

console.log('Toda tabla tiene sitio: en la copia, en la copia privada o fuera con su motivo');
const creadas = new Map();
for (const a of ARCHIVOS) {
  // (solo las de public: las de fbe_privado son de la base, sin datos tuyos)
  for (const m of sinComentarios(lee(a)).matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(public\.)?([a-z_0-9]+)(\.[a-z_0-9]+)?\s*\(/gi)) {
    if (m[3]) continue;
    if (!creadas.has(m[2])) creadas.set(m[2], a.split('/').pop());
  }
}
// La copia privada, tal y como la deja la última migración que la define
const conPrivada = ARCHIVOS.filter((a) => /create or replace function public\.copia_privada\(\)/.test(lee(a)));
const ultimaPrivada = sinComentarios(lee(conPrivada[conPrivada.length - 1]));
const cuerpo = ultimaPrivada.slice(ultimaPrivada.lastIndexOf('create or replace function public.copia_privada()'));
const PRIVADAS = [...cuerpo.slice(0, cuerpo.indexOf('end $$')).matchAll(/'([a-z_0-9]+)', coalesce\(\(select jsonb_agg\(to_jsonb\(t\)[^)]*\) from public\.([a-z_0-9]+) t\)/g)].map((m) => [m[1], m[2]]);
check(creadas.size > 140 && PRIVADAS.length >= 15, `se leen ${creadas.size} tablas de ${ARCHIVOS.length} archivos y ${PRIVADAS.length} de la copia privada (${conPrivada[conPrivada.length - 1].split('/').pop()})`);
check(PRIVADAS.every(([k, t]) => k === t), 'cada tabla de la copia privada va con su nombre');
const enPrivada = new Set(PRIVADAS.map(([, t]) => t));
const copia = new Set(TABLAS_COPIA);
const fuera = new Set(Object.keys(FUERA_DE_COPIA));
const sinSitio = [...creadas].filter(([t]) => !copia.has(t) && !enPrivada.has(t) && !fuera.has(t));
check(!sinSitio.length, sinSitio.length ? `sin decir si va en la copia: ${sinSitio.map(([t, a]) => `${t} (${a})`).join(', ')} → añádela a TABLAS_COPIA (web/src/datos/copia-tablas.js), a copia_privada en una migración o a FUERA_DE_COPIA con su motivo` : 'ninguna tabla sin decir si va en la copia');
const noExisten = [...copia, ...fuera].filter((t) => !creadas.has(t));
check(!noExisten.length, noExisten.length ? `nombres que no son ninguna tabla: ${noExisten.join(', ')}` : 'y todos los nombres de las listas son tablas de verdad');
const dosVeces = [...fuera].filter((t) => copia.has(t) || enPrivada.has(t));
check(!dosVeces.length && Object.values(FUERA_DE_COPIA).every((m) => typeof m === 'string' && m.length >= 20), dosVeces.length ? `fuera y dentro a la vez: ${dosVeces.join(', ')}` : 'lo de fuera, fuera de verdad y cada una con su motivo');
check(TABLAS_COPIA.length === copia.size && TABLAS_OPCIONALES.every((t) => copia.has(t)), 'sin repetidas, y las opcionales son de la copia');
// La de la demo (backend-memoria) da lo mismo que la base
const mem = lee('web/src/datos/backend-memoria.js');
const enMem = mem.slice(mem.indexOf("if (nombre === 'copia_privada')"));
const listaMem = [...enMem.slice(0, enMem.indexOf('.map((t) => [t, copia(tabla(t))])')).matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]).filter((t) => t !== 'copia_privada');
check(JSON.stringify([...listaMem].sort()) === JSON.stringify([...enPrivada].sort()), `la demo da la misma copia privada que la base${JSON.stringify([...listaMem].sort()) === JSON.stringify([...enPrivada].sort()) ? '' : ` (demo: ${listaMem.filter((t) => !enPrivada.has(t))}; base: ${[...enPrivada].filter((t) => !listaMem.includes(t))})`}`);
check(copia.has('radar_ajustes') && copia.has('encuestas_chat') && fuera.has('errores_app') && fuera.has('animo_fijados') && !enPrivada.has('animo_fijados'), 'dentro, lo que faltaba (tus ajustes, las encuestas del chat); fuera, los registros técnicos y el rincón de ánimo de cada atleta (solo lo ve él)');

console.log('\nPor qué migración va la base');
const ultimaArchivo = Number(MIG[MIG.length - 1].slice(0, 3));
check(MIGRACION_ULTIMA === ultimaArchivo, `la app espera la última migración del repositorio (${MIGRACION_ULTIMA}; la última es la ${MIG[MIG.length - 1]}): al añadir una, súbelo en web/src/datos/migracion.js`);
const nums = MIG.map((f) => Number(f.slice(0, 3)));
const huecos = []; for (let n = 2; n <= nums[nums.length - 1]; n++) if (!nums.includes(n)) huecos.push(n);
check(JSON.stringify(huecos) === JSON.stringify(HUECOS_MIGRACIONES), `los números que no existen (${huecos.join(', ') || 'ninguno'}) son los de HUECOS_MIGRACIONES: «las que faltan» no los cuenta`);
check(JSON.stringify(migracionesQueFaltan(85, 87)) === JSON.stringify({ base: 85, ultima: 87, faltan: ['086', '087'], alMenos: null }) && !migracionesQueFaltan(50, 87).faltan.includes('052') && migracionesQueFaltan(50, 87).faltan.includes('053'), 'con la base en la 085, faltan la 086 y la 087 (y nunca la 052, que no existe)');
check(migracionesQueFaltan(87, 87).faltan.length === 0 && migracionesQueFaltan(90, 87).faltan.length === 0 && migracionesQueFaltan(null, 87).alMenos === '087', 'al día, ninguna; si la base no lo sabe decir, al menos la última');

console.log('\nContra el esquema real');
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b, { cubrir: false });
await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
const coachId = b.auth.sesion().user.id;
await b.sql(`update perfiles set rol = 'coach' where id = $1`, [coachId]);
const ana = await api.crearAtleta({ nombre: 'Ana Prueba', email: 'ana@fbe.test' });
const bloque = await api.nuevoBloque(ana.id, { nombre: 'Base', foco: 'adaptacion', fecha_inicio: '2026-09-07', semanas: 1, sesionesPorSemana: 2 });
const [ses] = await b.sql(`select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $1 order by s.id limit 1`, [bloque.id]);
const [ej] = await b.sql(`insert into ejercicios (nombre) values ('Sentadilla de prueba') returning id`);
const [rec] = await b.sql(`insert into recetas (nombre) values ('Avena de prueba') returning id`);
const [hab] = await b.sql(`insert into habitos (atleta_id, nombre, tipo, objetivo, unidad, icono) values ($1, 'Pasos', 'numero', 8000, 'pasos', 'pasos') returning id`, [ana.id]);
const [obj] = await b.sql(`insert into objetivos (atleta_id, titulo) values ($1, 'Subir la sentadilla') returning id`, [ana.id]);
const [com] = await b.sql(`insert into comentarios (atleta_id, autor, texto) values ($1, 'coach', '¡Vamos!') returning id`, [ana.id]);
const [sup] = await b.sql(`insert into suplementos (atleta_id, nombre, origen) values ($1, 'Creatina', 'atleta') returning id`, [ana.id]);
// Una fila suya en cada tabla nueva que vuelve al recuperarla (y alguna más de la copia)
const NUEVAS = [
  [`insert into revisiones_semanales (atleta_id, lunes, hecha, nota) values ($1, '2026-09-07', true, 'Bien')`, [ana.id]],
  [`insert into pausas (atleta_id, desde, hasta, motivo) values ($1, '2026-10-01', '2026-10-10', 'vacaciones')`, [ana.id]],
  [`insert into carrera_atleta (atleta_id, fc_max) values ($1, 190)`, [ana.id]],
  [`insert into carrera_eventos (atleta_id, nombre, fecha) values ($1, 'Media de prueba', '2026-12-13')`, [ana.id]],
  [`insert into carrera_semanas (atleta_id, lunes, km_min, km_max) values ($1, '2026-09-07', 20, 30)`, [ana.id]],
  [`insert into carrera_revisiones (atleta_id, fecha, titulo) values ($1, '2026-09-20', 'Test de 30 min')`, [ana.id]],
  [`insert into recordatorios_tecnica (atleta_id, ejercicio_id, texto) values ($1, $2, 'Rodillas fuera')`, [ana.id, ej.id]],
  [`insert into recetas_favoritas (atleta_id, receta_id) values ($1, $2)`, [ana.id, rec.id]],
  [`insert into personal_atleta (atleta_id, apodo) values ($1, 'Anita')`, [ana.id]],
  [`insert into contacto_atleta (atleta_id, telefono) values ($1, '+34600000000')`, [ana.id]],
  [`insert into salud_diaria (atleta_id, fecha, pasos) values ($1, '2026-09-08', 9000)`, [ana.id]],
  [`insert into salud_copias (atleta_id, tipo, habito_id, fecha, valor_puesto) values ($1, 'pasos', $2, '2026-09-08', 9000)`, [ana.id, hab.id]],
  [`insert into agenda_vida (atleta_id, tipo, fecha, titulo, autor) values ($1, 'evento', '2026-10-01', 'Boda', 'atleta')`, [ana.id]],
  [`insert into objetivos_propuestos (atleta_id, tipo, ejercicio_id, kg, reps, objetivo_id) values ($1, 'fuerza', $2, 100, 1, $3)`, [ana.id, ej.id, obj.id]],
  [`insert into objetivos_rondas (atleta_id) values ($1)`, [ana.id]],
  [`insert into suplementos_tomas (suplemento_id, atleta_id, fecha) values ($1, $2, '2026-09-08')`, [sup.id, ana.id]],
  [`insert into musica_sesion (sesion_id, atleta_id, url) values ($1, $2, 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP')`, [ses.id, ana.id]],
  [`insert into travesia_perfil (atleta_id, rango, hechas) values ($1, 2, 14)`, [ana.id]],
  [`insert into travesia_dia (atleta_id, dia, metros, estrellas, intentos) values ($1, '2026-09-08', 420, 3, 1)`, [ana.id]],
  [`insert into animo_fijados (atleta_id, comentario_id) values ($1, $2)`, [ana.id, com.id]],
  [`insert into radar_ajustes (usuario_id, datos) values ($1, '{"estilo":{"saludo":"nombre"}}')`, [coachId]],
];
const malas = [];
for (const [sql, args] of NUEVAS) { try { await b.sql(sql, args); } catch (e) { malas.push(`${sql.slice(12, 40)}: ${e.message}`); } }
check(!malas.length, malas.length ? `no se pudieron preparar: ${malas.join(' | ')}` : `preparadas sus filas en ${NUEVAS.length} tablas`);

const c = await api.copiaCompleta();
const faltanEnCopia = TABLAS_COPIA.filter((t) => !Array.isArray(c[t]));
check(!faltanEnCopia.length, faltanEnCopia.length ? `sin leer: ${faltanEnCopia.join(', ')}` : `la copia trae las ${TABLAS_COPIA.length} tablas (y ninguna falla por permisos)`);
check(c.radar_ajustes?.length === 1 && c.privado?.suplementos_tomas?.length === 1 && [...enPrivada].every((t) => Array.isArray(c.privado?.[t])) && !('animo_fijados' in c.privado) && !('animo_fijados' in c), 'con lo que faltaba (tus ajustes de «A quién escribir»), la privada entera y sin el rincón de ánimo de Ana');
const pend = await api.migracionesPendientes();
check(pend && pend.base === MIGRACION_ULTIMA && !pend.faltan.length && !pend.alMenos, `Cuenta no avisa de nada con la base al día (va por la ${pend?.base})`);
await b.sql(`delete from fbe_migraciones where numero > 85`);
const pend85 = await api.migracionesPendientes();
// (de la 086 a la última del repositorio)
const tres = (n) => String(n).padStart(3, '0');
const desde86 = Array.from({ length: MIGRACION_ULTIMA - 85 }, (_, i) => 86 + i).filter((n) => !HUECOS_MIGRACIONES.includes(n)).map(tres);
check(JSON.stringify(pend85?.faltan) === JSON.stringify(desde86), `con la base en la 085, avisa de la 086 a la ${tres(MIGRACION_ULTIMA)} (${JSON.stringify(pend85?.faltan)})`);
await b.sql(`insert into fbe_migraciones (numero) values (86), (87)`);
await b.sql(`drop function public.migracion_actual()`);
const sin87 = await api.migracionesPendientes();
check(sin87?.alMenos === tres(MIGRACION_ULTIMA) && !sin87.faltan.length, `sin la 087 (la base no lo sabe decir), avisa de que falta al menos la ${tres(MIGRACION_ULTIMA)}`);
await b.guion(lee('supabase/migraciones/087_migraciones_pendientes.sql'));
// (y las de después de la 087, otra vez: así se comprueba también que se pueden repetir)
for (const f of MIG.filter((x) => Number(x.slice(0, 3)) > 87)) await b.guion(lee(`supabase/migraciones/${f}`));
await b.auth.registrar('ana@fbe.test', 'contraseña-ana-1', 'Ana');
const apiAna = crearApi(b, { cubrir: false });
check(await apiAna.migracionesPendientes() === null, 'a un atleta no le dice nada (la función es solo del coach)');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');

console.log('\nRecuperar un atleta: también lo de las versiones nuevas');
await import('../scripts/restaurar-atleta.js');
const R = globalThis.FBERestaurar;
const TABLAS = ['revisiones_semanales', 'pausas', 'carrera_atleta', 'carrera_eventos', 'carrera_semanas', 'carrera_revisiones', 'recordatorios_tecnica', 'recetas_favoritas',
  'personal_atleta', 'contacto_atleta', 'salud_diaria', 'salud_copias', 'agenda_vida', 'objetivos_propuestos', 'objetivos_rondas', 'suplementos', 'suplementos_tomas', 'musica_sesion',
  'travesia_perfil', 'travesia_dia', 'habitos', 'objetivos', 'bloques'];
const cuenta = async () => Object.fromEntries(await Promise.all(TABLAS.map(async (t) => [t, (await b.sql(`select count(*)::int n from ${t} where atleta_id = $1`, [ana.id]))[0].n])));
const copiaAntes = JSON.parse(JSON.stringify(await api.copiaCompleta()));
const antes = await cuenta();
check(Object.values(antes).every((n) => n >= 1), 'antes, Ana tiene algo en cada una');
const sinNuevas = R.ORDEN.filter((t) => !copia.has(t) && !enPrivada.has(t));
check(!sinNuevas.length, sinNuevas.length ? `el script recupera tablas que la copia no trae: ${sinNuevas.join(', ')}` : 'todo lo que recupera el script viene en la copia');
await api.borrarAtleta(ana.id);
const { sql, resumen } = R.generarSql(copiaAntes, ana.id);
check(TABLAS.every((t) => resumen[t] >= 1), `el SQL las lleva todas (${TABLAS.filter((t) => !resumen[t]).join(', ') || 'ninguna fuera'})`);
const res = await b.guion(sql);
const despues = await cuenta();
const distintas = TABLAS.filter((t) => despues[t] !== antes[t]);
check(!distintas.length, distintas.length ? `difieren: ${distintas.map((t) => `${t} ${antes[t]}→${despues[t]}`).join(', ')}` : 'vuelve todo, tabla a tabla, tal y como estaba');
const comp = res[res.length - 1].rows[0];
check(comp.recuperado == 1 && Number(comp.filas_en_la_base) === Number(comp.filas_en_la_copia), `y la comprobación cuadra (${comp.filas_en_la_base} de ${comp.filas_en_la_copia} filas)`);
await b.guion(sql);
check(JSON.stringify(await cuenta()) === JSON.stringify(antes), 'repetirlo no duplica nada');
const [r] = await b.sql(`select texto, archivo_id from recordatorios_tecnica where atleta_id = $1`, [ana.id]);
check(r?.texto === 'Rodillas fuera' && r.archivo_id === null, 'sus recordatorios de técnica vuelven (sin el vídeo, que no está en la copia)');
// Una copia antigua (sin la privada): recupera lo demás sin fallar
const vieja = { ...copiaAntes }; delete vieja.privado;
await api.borrarAtleta(ana.id);
const rv = await b.guion(R.generarSql(vieja, ana.id).sql);
check(rv[rv.length - 1].rows[0].recuperado == 1 && (await b.sql(`select count(*)::int n from revisiones_semanales where atleta_id = $1`, [ana.id]))[0].n === 1, 'con una copia sin la parte privada, recupera lo demás (lo privado no viene)');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
