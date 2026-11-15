// Los objetivos que propone el atleta (migración 076): el cuestionario de objetivos, las propuestas para el coach y la
// previsión de los objetivos de peso. La lógica, la demo y la base (PGlite).
//   node test/objetivos-atleta.test.mjs
import { readFileSync } from 'node:fs';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lee = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
const O = await import('../web/src/logica/objetivos-atleta.js');
const { progresoPeso } = await import('../web/src/logica/objetivos.js');
const { sumarDias, hoyISO } = await import('../web/src/logica/fechas.js');

console.log('La lógica');
const HOY = '2026-11-15';
check(O.tiposPara({ salud: false, carrera: false }).map((t) => t[0]).join() === 'fuerza,libre' && O.tiposPara({ salud: true, carrera: true }).length === 4
  && O.tiposPara({ salud: true, carrera: true, entrena: false }).map((t) => t[0]).join() === 'peso,libre',
'los tipos: el peso, solo con consentimiento de salud; la carrera, a quien se la llevan; la fuerza, a quien entrena');
check(O.limpiarPropuesta({ tipo: 'fuerza', ejercicio_id: 'e1', kg: '100', reps: 3, titulo: 'sobra', motivo: '  Mi  boda ' }, HOY).datos?.kg === 100
  && O.limpiarPropuesta({ tipo: 'fuerza', ejercicio_id: 'e1', kg: 100, reps: 3, motivo: '  Mi  boda ' }, HOY).datos.motivo === 'Mi boda'
  && O.limpiarPropuesta({ tipo: 'fuerza', ejercicio_id: 'e1', kg: 100, reps: 3, titulo: 'sobra' }, HOY).datos.titulo === null,
'una marca de fuerza: ejercicio, kilos y repeticiones (el título lo pone la app; el porqué, limpio)');
check(O.limpiarPropuesta({ tipo: 'fuerza', kg: 100, reps: 3 }, HOY).error && O.limpiarPropuesta({ tipo: 'fuerza', ejercicio_id: 'e1', kg: 100, reps: 13 }, HOY).error
  && O.limpiarPropuesta({ tipo: 'fuerza', ejercicio_id: 'e1', kg: 0, reps: 3 }, HOY).error && O.limpiarPropuesta({ tipo: 'fuerza', ejercicio_id: 'e1', kg: 100, reps: 2.5 }, HOY).error,
'sin ejercicio, sin kilos o con más de 12 repeticiones (o medias), no');
check(O.limpiarPropuesta({ tipo: 'peso', peso_kg: '72.456' }, HOY).datos.peso_kg === 72.46 && O.limpiarPropuesta({ tipo: 'peso', peso_kg: 20 }, HOY).error && O.limpiarPropuesta({ tipo: 'peso' }, HOY).error,
  'un peso: entre 30 y 300 kg');
check(O.limpiarPropuesta({ tipo: 'carrera', distancia_km: 10, tiempo_seg: 3000 }, HOY).datos.tiempo_seg === 3000 && O.limpiarPropuesta({ tipo: 'carrera', distancia_km: 10 }, HOY).error
  && O.limpiarPropuesta({ tipo: 'carrera', distancia_km: 0, tiempo_seg: 3000 }, HOY).error, 'una carrera: distancia y tiempo');
check(O.limpiarPropuesta({ tipo: 'libre', titulo: ' Entrenar\u200b 4   días ' }, HOY).datos.titulo === 'Entrenar 4 días' && O.limpiarPropuesta({ tipo: 'libre', titulo: ' ' }, HOY).error
  && O.limpiarPropuesta({ tipo: 'libre', titulo: 'x'.repeat(81) }, HOY).error && O.limpiarPropuesta({ tipo: 'otro', titulo: 'x' }, HOY).error, 'otra cosa: con sus palabras (hasta 80), limpias');
check(O.limpiarPropuesta({ tipo: 'libre', titulo: 'x', fecha: sumarDias(HOY, -1) }, HOY).error && O.limpiarPropuesta({ tipo: 'libre', titulo: 'x', fecha: sumarDias(HOY, 731) }, HOY).error
  && O.limpiarPropuesta({ tipo: 'libre', titulo: 'x', fecha: sumarDias(HOY, 90) }, HOY).datos.fecha === sumarDias(HOY, 90) && O.limpiarPropuesta({ tipo: 'libre', titulo: 'x', motivo: 'm'.repeat(201) }, HOY).error,
'la fecha, de hoy a dentro de dos años; el porqué, hasta 200');
check(O.textoPropuesta({ tipo: 'fuerza', ejercicio: 'Sentadilla', kg: 100, reps: 3 }) === 'Sentadilla 100 kg × 3' && O.textoPropuesta({ tipo: 'fuerza', ejercicio: 'Press banca', kg: 62.5, reps: 1 }) === 'Press banca 62,5 kg a una repetición'
  && O.textoPropuesta({ tipo: 'peso', peso_kg: 72 }) === 'Pesar 72 kg' && O.textoPropuesta({ tipo: 'carrera', distancia_km: 10, tiempo_seg: 3000 }) === '10 km en 50:00'
  && O.textoPropuesta({ tipo: 'carrera', distancia_km: 21.1, tiempo_seg: 6300 }) === '21,1 km en 1:45:00' && O.ritmoCarrera(10, 3000) === '5:00 min/km' && O.textoPropuesta({ tipo: 'libre', titulo: 'Dominar la dominada' }) === 'Dominar la dominada',
'cada propuesta, con su texto');
{
  const f = O.objetivoDePropuesta({ tipo: 'fuerza', ejercicio_id: 'e1', ejercicio: 'Sentadilla', kg: 100, reps: 3, motivo: 'Porque sí', fecha: '2027-01-10' });
  const p = O.objetivoDePropuesta({ tipo: 'peso', peso_kg: 72 }), c = O.objetivoDePropuesta({ tipo: 'carrera', distancia_km: 10, tiempo_seg: 3000 });
  check(f.titulo === 'Sentadilla 100 kg × 3' && f.ejercicio_id === 'e1' && f.kg_objetivo === 100 && f.reps_objetivo === 3 && f.fecha_limite === '2027-01-10' && f.descripcion === 'Porque sí' && f.tipo === 'fuerza' && f.propuesto_por_atleta === true && f.estado === 'en_curso'
    && p.peso_objetivo === 72 && p.tipo === 'peso' && c.distancia_km === 10 && c.tiempo_seg === 3000 && O.tipoDeObjetivo({ ejercicio_id: 'x' }) === 'fuerza' && O.tipoDeObjetivo({}) === 'libre' && O.tipoDeObjetivo({ tipo: 'peso' }) === 'peso',
  'el objetivo que sale de una propuesta aceptada tal cual (y el tipo de los objetivos de antes)');
}
check(O.tocaCuestionario({ hoy: HOY }) === true && O.tocaCuestionario({ contestadoEn: '2026-11-01T10:00:00Z', hoy: HOY }) === false
  && O.tocaCuestionario({ contestadoEn: '2026-11-01T10:00:00Z', inicioBloque: '2026-11-09', hoy: HOY }) === true
  && O.tocaCuestionario({ contestadoEn: '2026-11-10T10:00:00Z', inicioBloque: '2026-11-09', hoy: HOY }) === false
  && O.tocaCuestionario({ contestadoEn: '2026-11-01T10:00:00Z', inicioBloque: '2026-11-23', hoy: HOY }) === false,
'le toca la primera vez y cuando su bloque de ahora empezó después de la última vez (no por un bloque que aún no ha empezado)');
check(O.tocaCuestionario({ pospuestoHasta: O.posponerHasta(HOY), hoy: HOY }) === false && O.tocaCuestionario({ pospuestoHasta: O.posponerHasta(HOY), hoy: sumarDias(HOY, 7) }) === true
  && O.tocaCuestionario({ pendientes: 1, hoy: HOY }) === false && O.posponerHasta(HOY) === '2026-11-22', '«Ahora no» lo esconde una semana; con propuestas esperando, tampoco sale');
{
  const l = [{ id: 1, estado: 'pendiente' }, { id: 2, estado: 'aceptada', resuelto_en: '2026-11-10T10:00:00Z' }, { id: 3, estado: 'descartada', resuelto_en: '2026-10-01T10:00:00Z' }, { id: 4, estado: 'descartada', resuelto_en: '2026-11-14T10:00:00Z' }];
  const v = O.propuestasVisibles(l, HOY);
  check(v.pendientes.length === 1 && v.recientes.map((x) => x.id).join() === '4,2', 'el atleta ve las que esperan y las contestadas en los últimos 14 días (lo último, primero)');
}
{
  const pesos = (desde, n, kg0, paso) => Array.from({ length: n }, (_, i) => ({ fecha: sumarDias(desde, i), kg: kg0 + i * paso }));
  const baja = progresoPeso({ peso_objetivo: 75, peso_inicio: 80, fecha_limite: '2027-03-01' }, pesos('2026-10-19', 28, 80, -0.07), HOY);
  check(baja.actual < 80 && baja.actual > 77 && baja.pct > 10 && baja.pct < 50 && baja.prevision && baja.prevision.ritmo < 0 && baja.prevision.aTiempo === true && baja.prevision.fecha > HOY && !baja.llegado && !baja.alejandose,
    `un objetivo de bajar de peso: ${baja.pct} % y «a este ritmo» hacia el ${baja.prevision?.fecha} (a tiempo)`);
  const tarde = progresoPeso({ peso_objetivo: 70, peso_inicio: 80, fecha_limite: sumarDias(HOY, 14) }, pesos('2026-10-19', 28, 80, -0.07), HOY);
  check(tarde.prevision?.aTiempo === false, 'si a ese ritmo no llega para la fecha, lo dice');
  const sube = progresoPeso({ peso_objetivo: 75, peso_inicio: 80 }, pesos('2026-10-19', 28, 80, 0.07), HOY);
  check(sube.prevision === null && sube.alejandose === true && sube.pct === 0, 'si la tendencia va al revés, sin previsión (y lo marca)');
  const gana = progresoPeso({ peso_objetivo: 72, peso_inicio: 70 }, pesos('2026-10-19', 28, 70, 0.05), HOY);
  check(gana.prevision && gana.prevision.ritmo > 0 && gana.pct > 0, 'también para quien quiere subir de peso');
  const ya = progresoPeso({ peso_objetivo: 79.5, peso_inicio: 80 }, pesos('2026-10-19', 28, 80, -0.07), HOY);
  check(ya.llegado && ya.pct === 100 && ya.prevision === null, 'cuando la tendencia llega a la meta, 100 %');
  const viejo = progresoPeso({ peso_objetivo: 75, peso_inicio: 80 }, pesos('2026-08-01', 28, 80, -0.07), HOY);
  check(viejo.actual === null && viejo.sinRecientes && viejo.prevision === null && progresoPeso({ peso_objetivo: 75 }, [], HOY).sinPesos && progresoPeso({}, [], HOY) === null, 'sin pesos de los últimos 14 días, ni progreso ni previsión');
}

console.log('\nEn la demo');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const legal = await import('../web/src/legal.js');
const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);
await b.auth.entrar('ana@fbe.demo', 'demo');
const yo = await api.miAtleta();
check((await api.objetivos076()) === true && (await api.versionLegal?.().catch(() => null) ?? legal.VERSION_LEGAL) === legal.VERSION_LEGAL, 'la demo tiene la 076 (y la política nueva)');
let mias = await api.objetivosPropuestos();
check(mias.contestado_en && mias.propuestas.length === 0, 'en la demo, Ana ya contestó (sin propuestas esperando)');
const biblio = await api.biblioteca();
const sentadilla = biblio.find((e) => /sentadilla/i.test(e.nombre));
const en90 = sumarDias(hoyISO(), 90);
mias = await api.proponerObjetivos([
  { tipo: 'fuerza', ejercicio_id: sentadilla.id, kg: 100, reps: 3, fecha: en90, motivo: 'Mi número redondo' },
  { tipo: 'peso', peso_kg: 62 },
  { tipo: 'libre', titulo: 'Entrenar 4 días por semana' },
]);
check(mias.contestado_en && mias.propuestas.length === 3 && mias.propuestas.every((p) => p.estado === 'pendiente') && mias.propuestas[0].ejercicio === sentadilla.nombre && mias.propuestas[0].motivo === 'Mi número redondo',
  'el atleta contesta el cuestionario con tres propuestas (con el nombre del ejercicio)');
check(await lanza(() => api.proponerObjetivos([{ tipo: 'fuerza', kg: 100, reps: 3 }])) && await lanza(() => api.proponerObjetivos([{ tipo: 'libre', titulo: 'a' }, { tipo: 'libre', titulo: 'b' }, { tipo: 'libre', titulo: 'c' }]))
  && await lanza(() => b.rpc('objetivos_proponer', { p_propuestas: [{ tipo: 'libre', titulo: 5 }] })) && await lanza(() => b.rpc('objetivos_proponer', { p_propuestas: [{ tipo: 'fuerza', ejercicio_id: 'no-existe', kg: 100, reps: 3 }] })),
'una propuesta incompleta, con datos raros o que pasa de 5 pendientes, no');
check(await lanza(() => b.select('objetivos_propuestos', {})) && await lanza(() => b.insert('objetivos_propuestos', [{ atleta_id: yo.id, tipo: 'libre', titulo: 'x' }])) && await lanza(() => b.rpc('objetivos_propuestas_pendientes', {}))
  && await lanza(() => b.rpc('objetivo_propuesta_resolver', { p_id: mias.propuestas[0].id, p_aceptar: true, p_objetivo: null })), 'la tabla no se toca directamente, y el atleta no ve las de otros ni resuelve');
await api.retirarPropuesta(mias.propuestas[2].id);
mias = await api.objetivosPropuestos();
check(mias.propuestas.length === 2, 'retira una que aún espera');
const antes = (await api.objetivos(yo.id)).length;
await b.auth.salir();
await b.auth.entrar('carlos@fbe.demo', 'demo').catch(() => {});
if (await api.miAtleta().catch(() => null)) {
  check((await api.objetivosPropuestos()).propuestas.length === 0 && await lanza(() => api.retirarPropuesta(mias.propuestas[0].id)), 'otro atleta no ve las suyas ni las retira');
  await b.auth.salir();
}
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const bandeja = await api.bandeja();
check(bandeja.objetivos.length === 2 && bandeja.objetivos.every((x) => x.atleta?.id === yo.id) && bandeja.porAtleta[yo.id] >= 2, 'al coach le llegan a Revisar, con su atleta (y cuentan en el total)');
const pend = await api.propuestasPendientes(yo.id);
check(pend.length === 2 && (await api.propuestasPendientes()).length === 2 && await lanza(() => api.proponerObjetivos([{ tipo: 'libre', titulo: 'x' }])), 'las ve por atleta o todas; el coach no propone');
const fuerza = pend.find((p) => p.tipo === 'fuerza'), peso = pend.find((p) => p.tipo === 'peso');
const creado = await api.aceptarPropuesta(fuerza, { kg_objetivo: 95, titulo: `${sentadilla.nombre} 95 kg × 3` }, 'Mejor 95 para este bloque');
check(creado.kg_objetivo === 95 && creado.reps_objetivo === 3 && creado.ejercicio_id === sentadilla.id && creado.fecha_limite === en90 && creado.tipo === 'fuerza' && creado.propuesto_por_atleta === true && creado.descripcion === 'Mi número redondo',
  'el coach la acepta ajustando la cifra: sale el objetivo (propuesto por el atleta)');
check(await lanza(() => api.descartarPropuesta(fuerza.id)) && await lanza(() => b.rpc('objetivo_propuesta_resolver', { p_id: peso.id, p_aceptar: true, p_objetivo: null })), 'una ya contestada no se vuelve a contestar; aceptar pide su objetivo');
const des = await api.descartarPropuesta(peso.id, 'De momento, a mantener');
check(des.estado === 'descartada' && des.nota_coach === 'De momento, a mantener' && (await api.propuestasPendientes()).length === 0 && (await api.bandeja()).objetivos.length === 0, 'descarta la otra con una nota: ya no espera nada');
await b.auth.salir();
await b.auth.entrar('ana@fbe.demo', 'demo');
mias = await api.objetivosPropuestos();
const lista = await api.objetivos(yo.id);
check(mias.propuestas.length === 2 && mias.propuestas.find((p) => p.tipo === 'fuerza').estado === 'aceptada' && mias.propuestas.find((p) => p.tipo === 'fuerza').objetivo_id === creado.id && mias.propuestas.find((p) => p.tipo === 'peso').nota_coach === 'De momento, a mantener'
  && lista.length === antes + 1 && lista.find((o) => o.id === creado.id)?.auto, 'el atleta ve la respuesta de su coach, y el objetivo nuevo en su Progreso, con su progreso automático');
check(await lanza(() => api.retirarPropuesta(mias.propuestas[0].id)), 'lo ya contestado no se retira');
// seguir con los mismos: contesta sin proponer nada
const t0 = mias.contestado_en;
await new Promise((r) => setTimeout(r, 5));
mias = await api.proponerObjetivos([]);
check(mias.contestado_en > t0, '«Sigo con los mismos» apunta que contestó, sin propuestas nuevas');
// un objetivo de peso aceptado: su progreso sale de su tendencia
await api.proponerObjetivos([{ tipo: 'peso', peso_kg: 60 }, { tipo: 'carrera', distancia_km: 10, tiempo_seg: 3000 }]).catch((e) => console.log('   ', e.message));
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
for (const p of await api.propuestasPendientes(yo.id)) await api.aceptarPropuesta(p);
const conPeso = (await api.objetivos(yo.id)).find((o) => o.tipo === 'peso');
const conCarrera = (await api.objetivos(yo.id)).find((o) => o.tipo === 'carrera');
check(conPeso?.peso_objetivo === 60 && conPeso.autoPeso && conPeso.autoPeso.meta === 60 && (conPeso.peso_inicio == null || conPeso.autoPeso.inicio === Number(conPeso.peso_inicio)) && conPeso.titulo === 'Pesar 60 kg',
  `el objetivo de peso, con su progreso desde su tendencia (${conPeso?.autoPeso?.actual ?? 'sin pesos recientes'} kg ahora)`);
check(conCarrera?.titulo === '10 km en 50:00' && conCarrera.distancia_km === 10 && conCarrera.tiempo_seg === 3000 && await lanza(() => api.crear('objetivos', { atleta_id: yo.id, titulo: 'x', tipo: 'peso' }))
  && await lanza(() => api.crear('objetivos', { atleta_id: yo.id, titulo: 'x', tipo: 'otra' })), 'el de carrera, con su distancia y su tiempo; un objetivo de peso sin peso (o de otro tipo), no');
const copia = await b.rpc('copia_privada', {});
check(copia.objetivos_propuestos.length === 4 && copia.objetivos_rondas.some((x) => x.atleta_id === yo.id), 'las propuestas van en la copia completa del coach');
await b.auth.salir();
await b.auth.entrar('ana@fbe.demo', 'demo');
const datos = await api.misDatos?.().catch(() => null);
if (datos) check(datos.objetivos_propuestos?.propuestas?.length === 4, 'y en «Descargar mis datos», todas');

console.log('\nLa migración 076 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ana = await usuario('a@x.test'), luis = await usuario('l@x.test'), baja = await usuario('b@x.test');
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ana]))[0].id;
const atletaL = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Luis', $1, 'activo') returning id`, [luis]))[0].id;
await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Baja', $1, 'baja')`, [baja]);
const ej = (await q(`insert into public.ejercicios (nombre, grupos_musculares) values ('Sentadilla de prueba', '{cuadriceps}') returning id`))[0].id;
const [{ d: hoy }] = await q(`select (now() at time zone 'Europe/Madrid')::date::text as d`);
const mas = (n) => sumarDias(hoy, n);
const proponer = (l) => q('select objetivos_proponer($1::jsonb) as r', [JSON.stringify(l)]).then((r) => r[0].r);
const noProponer = (l) => falla('select objetivos_proponer($1::jsonb)', [JSON.stringify(l)]);

await como(ana);
let r = (await q('select objetivos_propuestas_mias() as r'))[0].r;
check(r.contestado_en === null && r.propuestas.length === 0, 'al empezar, sin contestar y sin propuestas');
r = await proponer([{ tipo: 'fuerza', ejercicio_id: ej, kg: 100, reps: 3, fecha: mas(90), motivo: '  Mi\u200b número   redondo ', titulo: 'sobra' }, { tipo: 'libre', titulo: 'Entrenar 4 días' }, { tipo: 'carrera', distancia_km: 10, tiempo_seg: 3000 }]);
check(r.contestado_en && r.propuestas.length === 3 && r.propuestas[0].ejercicio === 'Sentadilla de prueba' && Number(r.propuestas[0].kg) === 100 && r.propuestas[0].reps === 3 && r.propuestas[0].motivo === 'Mi número redondo'
  && r.propuestas[0].titulo === null && r.propuestas[0].fecha === mas(90) && r.propuestas.every((p) => p.estado === 'pendiente'), 'el atleta propone tres objetivos (limpios; el título de una marca lo pone la app)');
check(await noProponer([{ tipo: 'peso', peso_kg: 70 }]), 'el peso, sin consentimiento de datos de salud, no');
await su();
await q(`insert into public.consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', '2026-12')`, [ana]).catch(async () => { await q(`insert into public.consentimientos (perfil_id, tipo) values ($1, 'datos_salud')`, [ana]); });
await como(ana);
r = await proponer([{ tipo: 'peso', peso_kg: 70.456 }]);
check(r.propuestas.length === 4 && Number(r.propuestas.find((p) => p.tipo === 'peso').peso_kg) === 70.46, 'con consentimiento, sí (redondeado)');
check(await noProponer([{ tipo: 'libre', titulo: 'a' }, { tipo: 'libre', titulo: 'b' }]) && (await proponer([{ tipo: 'libre', titulo: 'quinta' }])).propuestas.length === 5 && await noProponer([{ tipo: 'libre', titulo: 'sexta' }]),
  'como mucho, 5 esperando');
await q('select objetivo_propuesta_retirar($1)', [r.propuestas.find((p) => p.tipo === 'peso').id]);
check(await noProponer([{ tipo: 'fuerza', kg: 100, reps: 3 }]) && await noProponer([{ tipo: 'fuerza', ejercicio_id: ej, kg: 100, reps: 13 }]) && await noProponer([{ tipo: 'fuerza', ejercicio_id: ej, kg: 100, reps: 2.5 }])
  && await noProponer([{ tipo: 'fuerza', ejercicio_id: '00000000-0000-0000-0000-000000000000', kg: 100, reps: 3 }]) && await noProponer([{ tipo: 'fuerza', ejercicio_id: 'x', kg: 100, reps: 3 }])
  && await noProponer([{ tipo: 'carrera', distancia_km: 10 }]) && await noProponer([{ tipo: 'peso', peso_kg: 20 }]) && await noProponer([{ tipo: 'libre' }]) && await noProponer([{ tipo: 'libre', titulo: '\u200b' }])
  && await noProponer([{ tipo: 'otro', titulo: 'x' }]) && await noProponer([{ tipo: 'libre', titulo: 5 }]) && await noProponer([{ tipo: 'fuerza', ejercicio_id: ej, kg: '100', reps: 3 }]) && await noProponer({ tipo: 'libre', titulo: 'x' })
  && await noProponer([{ tipo: 'libre', titulo: 'x', fecha: mas(-1) }]) && await noProponer([{ tipo: 'libre', titulo: 'x', fecha: mas(800) }]) && await noProponer([{ tipo: 'libre', titulo: 'x', fecha: 'mañana' }])
  && await noProponer([{ tipo: 'libre', titulo: 'x'.repeat(81) }]) && await noProponer([{ tipo: 'libre', titulo: 'x', motivo: 'm'.repeat(201) }]),
'lo incompleto, lo raro y lo que no es del tipo que toca, no');
check(await falla('select * from objetivos_propuestos') && await falla('select * from objetivos_rondas') && await falla(`insert into objetivos_propuestos (atleta_id, tipo, titulo) values ($1, 'libre', 'x')`, [atletaA])
  && await falla(`insert into objetivos (atleta_id, titulo) values ($1, 'x')`, [atletaA]), 'las tablas no se tocan directamente (y el atleta sigue sin crear objetivos)');
check(await falla('select objetivos_propuestas_pendientes()') && await falla('select objetivo_propuesta_resolver($1, false)', [r.propuestas[0].id]), 'el atleta no ve las de todos ni resuelve');
await como(luis);
check((await q('select objetivos_propuestas_mias() as r'))[0].r.propuestas.length === 0 && await falla('select objetivo_propuesta_retirar($1)', [r.propuestas[0].id]), 'otro atleta no ve las suyas ni las retira');
await como(baja);
check(await noProponer([{ tipo: 'libre', titulo: 'x' }]), 'de baja, no propone');

await como(coach, 'aal2');
check(await noProponer([{ tipo: 'libre', titulo: 'x' }]) && await falla('select objetivos_propuestas_mias()'), 'el coach no propone (ni tiene propuestas suyas)');
let pendientes = (await q('select objetivos_propuestas_pendientes() as r'))[0].r;
check(pendientes.length === 4 && pendientes.every((p) => p.atleta_id === atletaA) && (await q('select objetivos_propuestas_pendientes($1) as r', [atletaL]))[0].r.length === 0, 'el coach ve las que esperan, de todos o de un atleta');
const pf = pendientes.find((p) => p.tipo === 'fuerza'), pl = pendientes.find((p) => p.titulo === 'Entrenar 4 días');
const objA = (await q(`insert into objetivos (atleta_id, titulo, tipo, ejercicio_id, kg_objetivo, reps_objetivo, fecha_limite, propuesto_por_atleta, estado) values ($1, 'Sentadilla 95 × 3', 'fuerza', $2, 95, 3, $3, true, 'en_curso') returning id`, [atletaA, ej, mas(90)]))[0].id;
const objL = (await q(`insert into objetivos (atleta_id, titulo) values ($1, 'De Luis') returning id`, [atletaL]))[0].id;
check(await falla('select objetivo_propuesta_resolver($1, true)', [pf.id]) && await falla('select objetivo_propuesta_resolver($1, true, $2)', [pf.id, objL]) && await falla('select objetivo_propuesta_resolver($1, null)', [pf.id])
  && await falla('select objetivo_propuesta_resolver($1, false, null, $2)', [pf.id, 'n'.repeat(201)]) && await falla('select objetivo_propuesta_resolver($1, false)', ['00000000-0000-0000-0000-000000000000']),
'aceptar pide un objetivo de ese mismo atleta; la nota, hasta 200');
let res = (await q('select objetivo_propuesta_resolver($1, true, $2, $3) as r', [pf.id, objA, ' Mejor 95 ']))[0].r;
check(res.estado === 'aceptada' && res.objetivo_id === objA && res.nota_coach === 'Mejor 95' && res.resuelto_en, 'la acepta con su objetivo (y una nota)');
res = (await q('select objetivo_propuesta_resolver($1, false) as r', [pl.id]))[0].r;
check(res.estado === 'descartada' && res.objetivo_id === null && await falla('select objetivo_propuesta_resolver($1, false)', [pl.id]), 'descarta otra; lo ya contestado no se vuelve a contestar');
check(await falla(`insert into objetivos (atleta_id, titulo, tipo) values ($1, 'x', 'peso')`, [atletaA]) && await falla(`insert into objetivos (atleta_id, titulo, tipo, distancia_km) values ($1, 'x', 'carrera', 10)`, [atletaA])
  && await falla(`insert into objetivos (atleta_id, titulo, tipo) values ($1, 'x', 'otra')`, [atletaA]) && await falla(`insert into objetivos (atleta_id, titulo, tipo, peso_objetivo) values ($1, 'x', 'peso', 500)`, [atletaA])
  && !(await falla(`insert into objetivos (atleta_id, titulo, tipo, peso_objetivo, peso_inicio) values ($1, 'Pesar 70', 'peso', 70, 74.2)`, [atletaA]))
  && !(await falla(`insert into objetivos (atleta_id, titulo, tipo, distancia_km, tiempo_seg) values ($1, '10 km', 'carrera', 10, 3000)`, [atletaA])), 'un objetivo de peso lleva su peso; uno de carrera, distancia y tiempo');
const copiaB = (await q('select copia_privada() as c'))[0].c;
check(copiaB.objetivos_propuestos.length === 4 && copiaB.objetivos_rondas.length === 1, 'las propuestas van en la copia completa del coach');

await como(ana);
r = (await q('select objetivos_propuestas_mias() as r'))[0].r;
check(r.propuestas.length === 4 && r.propuestas.find((p) => p.id === pf.id).estado === 'aceptada' && r.propuestas.find((p) => p.id === pf.id).nota_coach === 'Mejor 95' && r.propuestas.find((p) => p.id === pl.id).estado === 'descartada',
  'el atleta ve la respuesta de su coach');
check(await falla('select objetivo_propuesta_retirar($1)', [pf.id]) && (await q('select titulo, tipo, propuesto_por_atleta from objetivos where id = $1', [objA]))[0]?.propuesto_por_atleta === true, 'lo ya contestado no se retira; el objetivo aceptado lo lee en su Progreso');
const t1 = r.contestado_en;
await new Promise((x) => setTimeout(x, 15));
r = await proponer([]);
check(r.contestado_en > t1 && r.propuestas.length === 4, '«Sigo con los mismos»: apunta que contestó, sin propuestas nuevas');
await su();
await q(`update objetivos_propuestos set resuelto_en = now() - interval '40 days' where id = $1`, [pl.id]);
await como(ana);
check((await q('select objetivos_propuestas_mias() as r'))[0].r.propuestas.length === 3 && (await q('select objetivos_propuestas_mias(true) as r'))[0].r.propuestas.length === 4, 'las contestadas hace más de 30 días ya no salen (salvo al descargar sus datos)');
await su();
await q('delete from objetivos where id = $1', [objA]);
check((await q('select objetivo_id, estado from objetivos_propuestos where id = $1', [pf.id]))[0].objetivo_id === null, 'si se borra el objetivo, la propuesta se queda sin él');
await q('delete from ejercicios where id = $1', [ej]);
await q('delete from atletas where id = $1', [atletaA]);
check((await q('select count(*)::int n from objetivos_propuestos'))[0].n === 0 && (await q('select count(*)::int n from objetivos_rondas'))[0].n === 0, 'todo se borra con la ficha del atleta');
const mig = lee('supabase/migraciones/076_objetivos_atleta.sql'), p75 = lee('supabase/migraciones/075_guias_grupos.sql');
const permisos = (s) => s.slice(s.indexOf('revoke truncate, references, trigger'), s.indexOf('insert into public.fbe_migraciones'));
check(/if v > 76 then/.test(mig) && /numero = 75\) then/.test(mig) && /values \(76\)/.test(mig) && permisos(mig) === permisos(p75), 'pide la 075; el bloque de permisos, el mismo que el de la 075');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
