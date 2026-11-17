// «A su medida» (migración 080): la lógica, la demo y la base (PGlite).
//   node test/a-medida.test.mjs
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lee = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const M = await import('../web/src/logica/a-medida.js');
const { sumarDias, fechaMadrid } = await import('../web/src/logica/fechas.js');
const jpeg = (n) => `data:image/jpeg;base64,${'A'.repeat(n)}`;

console.log('La lógica');
{
  const p = M.leerPropio({ v: 1, frases: { saludo: ['  Hola,   Ana ', 'Hola, Ana', '', 7, 'x'.repeat(300)], inventado: ['no'], record: 'no es lista' },
    ejercicios: [{ texto: 'Press banca', frases: ['El culo, en el banco'] }, { texto: 'press  BANCA', frases: ['repetido'] }, { texto: 'ab', frases: ['corto'] }, { texto: 'sin frases', frases: [] }],
    peso: { baja_semana: '1,0', sube_mes: 9 }, otra: 1 });
  check(igual(p.frases, { saludo: ['Hola, Ana', 'x'.repeat(160)] }) && igual(p.ejercicios, [{ texto: 'Press banca', frases: ['El culo, en el banco'] }]) && igual(p.peso, { baja_semana: 1, sube_mes: null }),
    'lo guardado se limpia: frases de una línea, sin repetir y de 160 letras como mucho; momentos que existen; ejercicios con nombre y frases; márgenes que valen');
  check(M.leerPropio(null) === null && M.leerPropio([]) === null && M.leerPropio('x') === null && M.leerPropio({ frases: { saludo: [' '] }, peso: { baja_semana: 0 } }) === null && M.paraGuardarPropio({ frases: {} }) === null,
    'vacío o sin nada que valga: null (el atleta ve lo de siempre)');
  const g = M.paraGuardarPropio({ frases: { varias: Array.from({ length: 20 }, (_, i) => `frase ${i}`) }, ejercicios: Array.from({ length: 12 }, (_, i) => ({ texto: `ejercicio ${i}`, frases: ['a'] })) });
  check(g.v === 1 && g.frases.varias.length === M.LIMITES.porMomento && g.ejercicios.length === M.LIMITES.ejercicios && g.peso === undefined && M.cuantasFrases(g) === 12 + 8, 'para guardar: con su versión y dentro de los topes (12 frases por momento, 8 ejercicios)');
  check(M.CLAVES_MOMENTO.length === 9 && M.CLAVES_HUECO.join() === 'perfil,antes,record' && M.MOMENTOS.every((m) => m.length === 3 && m[2].length > 10), 'nueve momentos y tres huecos de imagen');
}
{
  const propio = { frases: { saludo: ['a'], pierna: ['p'] }, ejercicios: [{ texto: 'sentadilla', frases: ['s1'] }, { texto: 'Sentadilla búlgara', frases: ['b1'] }, { texto: 'peso muerto', frases: ['pm'] }] };
  check(igual(M.frasesDe(propio, 'saludo'), ['a']) && igual(M.frasesDe(propio, 'record'), []) && igual(M.frasesDe(null, 'saludo'), [])
    && igual(M.frasesDe(propio, 'ejercicio', { ejercicio: 'Sentadilla barra alta' }), ['s1']) && igual(M.frasesDe(propio, 'ejercicio', { ejercicio: 'SENTADILLA BULGARA con mancuernas' }), ['b1'])
    && igual(M.frasesDe(propio, 'ejercicio', { ejercicio: 'Peso muerto rumano' }), ['pm']) && igual(M.frasesDe(propio, 'ejercicio', { ejercicio: 'Press banca' }), []) && igual(M.frasesDe(propio, 'ejercicio'), []),
    'las frases de un momento; las de un ejercicio, por lo que contiene su nombre (sin tildes ni mayúsculas, y lo más concreto primero)');
}
{
  const frases = ['a', 'b', 'c'];
  let estado = null; const vistas = [];
  for (let i = 0; i < 3; i++) { const r = M.elegirFrase(frases, estado, { momento: 'saludo', azar: () => 0 }); vistas.push(r.frase); estado = r.estado; }
  check(igual([...vistas].sort(), frases), 'rotan sin repetirse hasta haberlas visto todas');
  const cuarta = M.elegirFrase(frases, estado, { momento: 'saludo', azar: () => 0 });
  check(cuarta.frase !== vistas[2] && frases.includes(cuarta.frase), 'y al empezar otra vez, no repite la última');
  const d1 = M.elegirFrase(frases, null, { momento: 'saludo', clave: '2026-11-16', azar: () => 0.99 });
  const d1b = M.elegirFrase(frases, d1.estado, { momento: 'saludo', clave: '2026-11-16', azar: () => 0 });
  const d2 = M.elegirFrase(frases, d1b.estado, { momento: 'saludo', clave: '2026-11-17', azar: () => 0.99 });
  check(d1.frase === 'c' && d1b.frase === 'c' && d2.frase !== 'c', 'con su clave (el día, la sesión), la misma mientras dure; con otra clave, otra');
  const quitada = M.elegirFrase(['a', 'b'], d1.estado, { momento: 'saludo', clave: '2026-11-16', azar: () => 0 });
  check(quitada.frase === 'a' && M.elegirFrase([], d1.estado, { momento: 'saludo' }).frase === null && M.elegirFrase(['única'], M.elegirFrase(['única'], null, { momento: 'x' }).estado, { momento: 'x' }).frase === 'única',
    'si el coach quita la frase fijada, sale otra; sin frases, nada; con una sola, esa');
  let e = null; for (let i = 0; i < 40; i++) e = M.elegirFrase(frases, e, { momento: 'saludo', clave: `d${i}` }).estado;
  check(Object.keys(e.fijas).length === 24 && e.fijas['saludo:d39'] && !e.fijas['saludo:d0'], 'solo recuerda las últimas 24 claves');
  check(igual(estado, M.elegirFrase(frases, estado, { momento: 'otro' }).estado) === false && !('otro' in estado.vistas), 'no toca el estado que recibe');
}
{
  const con = { frases: { saludo: ['s'], varias: ['v'] } };
  const dias = Array.from({ length: 28 }, (_, i) => sumarDias('2026-11-02', i));
  check(dias.filter((d) => M.tocaVarias(d, con)).length === 7 && M.tocaVarias('2026-11-16', { frases: { varias: ['v'] } }) === true && M.tocaVarias('2026-11-16', { frases: { saludo: ['s'] } }) === false,
    '«varias», uno de cada cuatro días en lugar del saludo (siempre, si no hay saludo)');
}
{
  const ej = (g, series = 3) => ({ series, ejercicio: { grupos_musculares: [g] } });
  check(M.esDiaDePierna({ nombre: 'Pierna A' }) && M.esDiaDePierna({ nombre: 'Tren inferior' }) && !M.esDiaDePierna({ nombre: 'Torso-pierna' }) && !M.esDiaDePierna({ nombre: 'Full body A' }) && !M.esDiaDePierna({ nombre: 'Empuje' })
    && !M.esDiaDePierna({ nombre: 'Tirón' }) && M.esDiaDePierna({ nombre: 'Día 3' }, [ej('cuadriceps', 4), ej('isquiotibiales'), ej('gluteo'), ej('abdominales', 2)])
    && !M.esDiaDePierna({ nombre: 'Día 4' }, [ej('cuadriceps', 4), ej('pectoral', 4), ej('espalda', 4)]) && !M.esDiaDePierna({ nombre: 'Día 5' }, [ej('gemelo', 3)]) && !M.esDiaDePierna(null, []),
    'día de pierna: por el nombre de la sesión o porque dos de cada tres series lo son (torso-pierna y cuerpo completo, no)');
  check(M.semanaAdelantada({ fecha_inicio: '2026-11-23' }, '2026-11-21') && !M.semanaAdelantada({ fecha_inicio: '2026-11-16' }, '2026-11-16') && !M.semanaAdelantada({ fecha_inicio: null }, '2026-11-16') && !M.semanaAdelantada(null, '2026-11-16'),
    'empieza antes: la semana tiene fecha y aún no ha llegado (sin fecha, como en los microciclos, no)');
  check(M.gamberrada({ pauta: { rpe_objetivo: 8, series: 3 }, numero: 1, rpe: 10 }) === 'rpe' && M.gamberrada({ pauta: { rpe_objetivo: 8, series: 3 }, numero: 1, rpe: 9.5 }) === 'rpe' && M.gamberrada({ pauta: { rpe_objetivo: 8, series: 3 }, numero: 1, rpe: 9 }) === null
    && M.gamberrada({ pauta: { rir_objetivo: 2, series: 3 }, numero: 2, rpe: '10' }) === 'rpe' && M.gamberrada({ pauta: { rir_objetivo: 0, series: 3 }, numero: 2, rpe: 10 }) === null && M.gamberrada({ pauta: { series: 3 }, numero: 3, rpe: 10 }) === null
    && M.gamberrada({ pauta: { rpe_objetivo: 9, series: 3 }, numero: 4, rpe: '' }) === 'serie' && M.gamberrada({ pauta: { rpe_objetivo: 8, series: 3 }, numero: 2, rpe: '' }) === null && M.gamberrada() === null,
    'se pasa de lo pautado: 1,5 puntos o más por encima del RPE pautado (o del que sale de su RIR), o una serie de más');
}
{
  const hoy = '2026-11-16';
  // (pesos cada dos días durante cinco semanas, con una pendiente dada en % del peso por semana)
  const serie = (kg0, pctSemana) => Array.from({ length: 18 }, (_, i) => { const d = (17 - i) * 2; return { fecha: sumarDias(hoy, -d), kg: Math.round(kg0 * (1 + (pctSemana / 100) * (-d / 7)) * 100) / 100 }; });
  const margenes = { peso: { baja_semana: 1, sube_mes: 0.5 } };
  const rapido = M.avisoRitmoPeso(serie(80, -1.4), margenes, { hoy });
  check(rapido?.tipo === 'baja' && rapido.pct >= 1.2 && rapido.pct <= 1.6 && rapido.cada === 'semana' && /baja un 1,\d % a la semana/.test(rapido.texto) && /hasta un 1 %/.test(rapido.texto), `en definición, bajar más de su margen (1 % a la semana) avisa (${rapido?.pct} %)`);
  check(M.avisoRitmoPeso(serie(80, -0.7), margenes, { hoy }) === null && M.avisoRitmoPeso(serie(80, 0), margenes, { hoy }) === null, 'dentro del margen (0,7 % a la semana) o estable, no');
  const sube = M.avisoRitmoPeso(serie(80, 0.3), margenes, { hoy });
  check(sube?.tipo === 'sube' && sube.cada === 'mes' && sube.pct >= 1.1 && sube.pct <= 1.5 && /al mes/.test(sube.texto), `en volumen, un avanzado que sube más de un 0,5 % al mes: aviso (${sube?.pct} % al mes)`);
  check(M.avisoRitmoPeso(serie(80, 0.08), margenes, { hoy }) === null, 'un 0,35 % al mes entra en su margen');
  check(M.avisoRitmoPeso(serie(80, 0.3), margenes, { hoy, fase: 'perder' }) === null && M.avisoRitmoPeso(serie(80, -1.4), margenes, { hoy, fase: 'ganar' }) === null
    && M.avisoRitmoPeso(serie(80, -1.4), margenes, { hoy, fase: 'perder' })?.tipo === 'baja' && M.avisoRitmoPeso(serie(80, 0.3), margenes, { hoy, fase: 'ganar' })?.tipo === 'sube',
    'con plan de nutrición: en definición solo se avisa de bajar; en volumen, solo de subir');
  check(M.avisoRitmoPeso(serie(80, -1.4), null, { hoy }) === null && M.avisoRitmoPeso(serie(80, -1.4), { peso: { sube_mes: 0.5 } }, { hoy }) === null && M.avisoRitmoPeso(serie(80, 0.3), { peso: { baja_semana: 1 } }, { hoy }) === null,
    'sin márgenes (o sin el de ese sentido), no hay aviso');
  check(M.avisoRitmoPeso(serie(80, -1.4).slice(-3), margenes, { hoy }) === null && M.avisoRitmoPeso(serie(80, -1.4).filter((p) => p.fecha >= sumarDias(hoy, -9)), margenes, { hoy }) === null
    && M.avisoRitmoPeso(serie(80, -1.4), margenes, { hoy: sumarDias(hoy, 12) }) === null && M.avisoRitmoPeso([], margenes, { hoy }) === null,
    'con la tendencia de varias semanas: hacen falta 4 pesos que abarquen 2 semanas y uno de los últimos 10 días');
  const pico = [...serie(80, 0).slice(0, -1), { fecha: hoy, kg: 78.4 }];
  check(M.avisoRitmoPeso(pico, margenes, { hoy }) === null, 'una pesada suelta más baja no dispara el aviso');
}
check(M.imagenValida(jpeg(400)) && M.imagenValida(`data:image/webp;base64,${'A'.repeat(400)}`) && !M.imagenValida(jpeg(10)) && !M.imagenValida(jpeg(M.MAX_IMAGEN)) && !M.imagenValida(`data:image/png;base64,${'A'.repeat(400)}`)
  && !M.imagenValida(`${jpeg(400)}"><script>`) && !M.imagenValida(null) && M.MAX_IMAGEN === 600000, 'la imagen: un JPEG o un WebP como data URL, dentro de lo que admite la base');

console.log('\nEn la demo');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const atletas = await api.atletas();
const ana = atletas.find((a) => /Ana/.test(a.nombre)), ruben = atletas.find((a) => /Rubén/.test(a.nombre));
const fichaAna = (await api.ficha(ana.id)).atleta;
check(M.cuantasFrases(fichaAna.propio) >= 15 && igual(Object.keys(await api.huecosPropios(ana.id)).sort(), ['antes', 'perfil', 'record']) && M.leerPropio((await api.ficha(ruben.id)).atleta.propio) === null && igual(await api.huecosPropios(ruben.id), {}),
  'la demo tiene la 080: Ana, con frases e imágenes inventadas; Rubén, sin nada');
// (los nombres vetados no se escriben aqui: se compara la huella de cada palabra)
const VETADAS = new Set(['17681eac36dbdb02', '48cb0041ceae7ad8', '3e72b749a20d0781', 'a2d8646c6a75c567', '6a7932c04647207b', '46ce86ac9b896295', '799abf43eb61c292', '76769a9ac411bd9c', '12ac0371fe61f3cc', 'b81d9b8d86474496', 'e402a5c2a9c95505']);
const limpio = (t) => !(t.toLowerCase().match(/[a-z\u00e0-\u00ff]+/g) || []).some((w) => VETADAS.has(createHash('sha256').update(w).digest('hex').slice(0, 16)));
check(limpio(lee('web/src/datos/semilla-demo.js')) && limpio(lee('web/src/datos/a-medida-demo.js')) && limpio(lee('web/src/logica/a-medida.js') + lee('web/src/ui/atleta/AMedida.jsx') + lee('web/src/ui/coach/AMedidaCoach.jsx') + lee('supabase/migraciones/080_a_medida.sql')) && VETADAS.size === 11,
  'en el repositorio no hay nada de ningún atleta de verdad');
const guardado = await api.guardarPropio(ruben.id, { frases: { saludo: ['Hola, Rubén', ' ', 'Hola, Rubén'], record: ['Marca nueva'] }, ejercicios: [{ texto: 'peso muerto', frases: ['Barra pegada'] }], peso: { baja_semana: '1', sube_mes: '1,5' } });
check(guardado.v === 1 && guardado.frases.saludo.length === 1 && guardado.peso.sube_mes === 1.5 && igual((await api.ficha(ruben.id)).atleta.propio, guardado), 'el coach guarda lo de un atleta (limpio) y queda en su ficha');
check(await lanza(() => api.guardarPropio(ruben.id, { frases: Object.fromEntries(M.CLAVES_MOMENTO.map((k) => [k, Array.from({ length: 12 }, (_, i) => `${i}${'ñ'.repeat(159)}`)])), ejercicios: Array.from({ length: 8 }, (_, i) => ({ texto: `ejercicio ${i}`, frases: Array.from({ length: 12 }, (_, j) => `${j}${'ñ'.repeat(159)}`) })) }))
  && igual((await api.ficha(ruben.id)).atleta.propio, guardado), 'si entre todas las frases pasan de lo que admite la base, se dice antes de guardar (y no se guarda nada)');
await api.ponerImagenPropia(ruben.id, 'record', jpeg(900));
await api.ponerImagenPropia(ruben.id, 'record', jpeg(1200));
check(igual(Object.keys(await api.huecosPropios(ruben.id)), ['record']) && (await api.imagenPropia(ruben.id, 'record')) === jpeg(1200) && (await api.imagenPropia(ruben.id, 'perfil')) === null && (await b.select('atletas_imagenes', { eq: { atleta_id: ruben.id } })).length === 1,
  'pone una imagen en un hueco; cambiarla no la duplica');
check(await lanza(() => api.ponerImagenPropia(ruben.id, 'portada', jpeg(900))) && await lanza(() => api.ponerImagenPropia(ruben.id, 'perfil', 'data:image/png;base64,AAAA')) && await lanza(() => b.rpc('a_medida_imagen_poner', { p_atleta: ruben.id, p_hueco: 'perfil', p_imagen: jpeg(600001) }))
  && await lanza(() => b.rpc('a_medida_imagen_poner', { p_atleta: crypto.randomUUID(), p_hueco: 'perfil', p_imagen: jpeg(900) })) && await lanza(() => b.insert('atletas_imagenes', [{ atleta_id: ruben.id, hueco: 'perfil', imagen: jpeg(900) }]))
  && await lanza(() => b.update('atletas_imagenes', { imagen: jpeg(900) }, { eq: { atleta_id: ruben.id } })) && await lanza(() => b.delete('atletas_imagenes', { eq: { atleta_id: ruben.id } })),
  'un hueco que no existe, una imagen que no vale o un atleta que no existe, no; y la tabla no se toca a mano');
await b.auth.salir();
await b.auth.entrar('ruben@fbe.demo', 'demo');
const apiR = crearApi(b);
const mia = await apiR.miAtleta();
check(igual(mia.propio, guardado) && (await apiR.imagenPropia(ruben.id, 'record')) === jpeg(1200) && igual(await apiR.huecosPropios(ana.id), {}) && (await apiR.imagenPropia(ana.id, 'perfil')) === null && (await b.select('atletas_imagenes', {})).every((x) => x.atleta_id === ruben.id),
  'el atleta ve lo suyo (en su ficha y su imagen) y nada de otro atleta');
check(await lanza(() => apiR.ponerImagenPropia(ruben.id, 'perfil', jpeg(900))) && await lanza(() => apiR.quitarImagenPropia(ruben.id, 'record')) && (await apiR.guardarPropio(ruben.id, { frases: { saludo: ['yo me lo pongo'] } }).catch(() => null), igual((await apiR.miAtleta()).propio, guardado)),
  'pero no pone ni quita imágenes, ni cambia sus frases');
const datos = await apiR.exportar(ruben.id);
check(Array.isArray(datos.atletas_imagenes) && datos.atletas_imagenes.length === 1 && JSON.stringify(datos).includes('Marca nueva'), 'en la descarga de sus datos van sus frases y sus imágenes');
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const api2 = crearApi(b);
await api2.quitarImagenPropia(ruben.id, 'record');
check(igual(await api2.huecosPropios(ruben.id), {}) && (await api2.guardarPropio(ruben.id, { frases: { saludo: [] } })) === null && (await api2.ficha(ruben.id)).atleta.propio === null, 'el coach quita la imagen y, al vaciar las frases, la ficha vuelve a null');
await api2.ponerImagenPropia(ruben.id, 'antes', jpeg(900));
await api2.borrar('atletas', ruben.id);
check((await b.select('atletas_imagenes', {})).every((x) => x.atleta_id !== ruben.id), 'al borrar al atleta, sus imágenes se van con él');

console.log('\nLa migración 080 (PGlite)');
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
const uA = await usuario('a@x.test'), uL = await usuario('l@x.test');
const A = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [uA]))[0].id;
const L = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Luis', $1, 'activo') returning id`, [uL]))[0].id;
const PROPIO = JSON.stringify(M.paraGuardarPropio({ frases: { saludo: ['Hola, Ana'], record: ['Marca nueva'] }, ejercicios: [{ texto: 'sentadilla', frases: ['Talones abajo'] }], peso: { baja_semana: 1, sube_mes: 0.5 } }));
const F = jpeg(900);

await como(coach, 'aal2');
check((await q(`update atletas set propio = $2::jsonb where id = $1 returning propio`, [A, PROPIO]))[0].propio.frases.saludo[0] === 'Hola, Ana', 'el coach guarda las frases y los márgenes en la ficha del atleta');
check(await falla(`update atletas set propio = '[1]'::jsonb where id = $1`, [A]) && await falla(`update atletas set propio = '"x"'::jsonb where id = $1`, [A])
  && await falla(`update atletas set propio = $2::jsonb where id = $1`, [A, JSON.stringify({ frases: { varias: Array.from({ length: 300 }, (_, i) => `${i}${'x'.repeat(160)}`) } })])
  && (await q(`update atletas set propio = null where id = $1 returning propio`, [L]))[0].propio === null, 'tiene que ser un objeto y de tamaño acotado (o nada)');
await q('select a_medida_imagen_poner($1, $2, $3)', [A, 'perfil', F]);
await q('select a_medida_imagen_poner($1, $2, $3)', [A, 'perfil', jpeg(1000)]);
await q('select a_medida_imagen_poner($1, $2, $3)', [A, 'record', `data:image/webp;base64,${'A'.repeat(500)}`]);
await q('select a_medida_imagen_poner($1, $2, $3)', [L, 'antes', F]);
check((await q('select hueco, imagen from atletas_imagenes where atleta_id = $1 order by hueco', [A])).map((x) => x.hueco).join() === 'perfil,record' && (await q(`select imagen from atletas_imagenes where atleta_id = $1 and hueco = 'perfil'`, [A]))[0].imagen === jpeg(1000),
  'el coach pone sus imágenes (una por hueco: cambiarla no la duplica)');
check(await falla('select a_medida_imagen_poner($1, $2, $3)', [A, 'portada', F]) && await falla('select a_medida_imagen_poner($1, $2, $3)', [A, 'perfil', 'data:image/png;base64,AAAA']) && await falla('select a_medida_imagen_poner($1, $2, $3)', [A, 'perfil', jpeg(600001)])
  && await falla('select a_medida_imagen_poner($1, $2, $3)', [A, 'perfil', `${F}"onerror="x`]) && await falla('select a_medida_imagen_poner($1, $2, $3)', [A, 'perfil', null]) && await falla('select a_medida_imagen_poner(gen_random_uuid(), $1, $2)', ['perfil', F])
  && await falla('select a_medida_imagen_poner(null, $1, $2)', ['perfil', F]), 'un hueco que no existe, una imagen que no es JPEG o WebP o que pesa de más, o un atleta que no existe, no');
check(await falla(`insert into atletas_imagenes (atleta_id, hueco, imagen) values ($1, 'antes', $2)`, [A, F]) && await falla(`update atletas_imagenes set imagen = $1`, [F]) && await falla(`delete from atletas_imagenes`),
  'la tabla solo se lee: ni insertar, ni cambiar, ni borrar a mano (tampoco el coach)');

await como(uA);
const mias = await q('select atleta_id, hueco from atletas_imagenes order by hueco');
check(mias.length === 2 && mias.every((x) => x.atleta_id === A) && (await q('select propio from atletas'))[0].propio.peso.sube_mes === 0.5 && (await q('select propio from atletas')).length === 1, 'el atleta lee sus imágenes y su ficha con lo suyo; de los demás, nada');
check(await falla('select a_medida_imagen_poner($1, $2, $3)', [A, 'antes', F]) && await falla('select a_medida_imagen_quitar($1, $2)', [A, 'perfil']) && (await q(`update atletas set propio = null where id = $1 returning id`, [A])).length === 0
  && (await q('select count(*)::int n from atletas_imagenes'))[0].n === 2, 'pero no pone ni quita imágenes ni cambia sus frases');
await como(uL);
check((await q('select hueco from atletas_imagenes')).map((x) => x.hueco).join() === 'antes', 'otro atleta solo ve las suyas');
await db.exec(`reset role; ${claims('', '')} set role anon;`);
check(await falla('select * from atletas_imagenes') && await falla('select a_medida_imagen_poner($1, $2, $3)', [A, 'antes', F]), 'sin sesión, nada');

await como(coach, 'aal2');
await q('select a_medida_imagen_quitar($1, $2)', [A, 'record']);
await q('select a_medida_imagen_quitar($1, $2)', [A, 'record']);
check((await q('select hueco from atletas_imagenes where atleta_id = $1', [A])).map((x) => x.hueco).join() === 'perfil', 'el coach quita una imagen (y quitar la que no está no rompe nada)');
await su();
await q('delete from atletas where id = $1', [L]);
check((await q('select count(*)::int n from atletas_imagenes where atleta_id = $1', [L]))[0].n === 0 && (await q('select max(numero)::int n from fbe_migraciones'))[0].n >= 80, 'al borrar al atleta, sus imágenes se van con él');
check((await q(`select relrowsecurity from pg_class where oid = 'public.atletas_imagenes'::regclass`))[0].relrowsecurity === true
  && (await q(`select has_table_privilege('authenticated', 'public.atletas_imagenes', 'insert') or has_table_privilege('authenticated', 'public.atletas_imagenes', 'update') or has_table_privilege('authenticated', 'public.atletas_imagenes', 'delete') or has_table_privilege('anon', 'public.atletas_imagenes', 'select') as x`))[0].x === false
  && (await q(`select has_function_privilege('anon', 'public.a_medida_imagen_poner(uuid, text, text)', 'execute') as x`))[0].x === false, 'permisos por fila activos; nadie escribe la tabla; sin sesión no se llama a sus funciones');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
