// Pulido, segunda tanda: lo que se puede comprobar sin navegador (la capa de datos sobre la demo en memoria).
//   node test/pulido2.test.mjs
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });

// Un backend en memoria que cuenta las lecturas por tabla (y las funciones)
function montar() {
  const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const cuenta = {};
  const sel = b.select.bind(b), rpc = b.rpc.bind(b);
  b.select = (t, ...a) => { cuenta[t] = (cuenta[t] || 0) + 1; return sel(t, ...a); };
  b.rpc = (n, ...a) => { cuenta[`rpc:${n}`] = (cuenta[`rpc:${n}`] || 0) + 1; return rpc(n, ...a); };
  return { b, api: crearApi(b), cuenta, n: (t) => cuenta[t] || 0 };
}
const img = (letra, largo) => `data:image/jpeg;base64,${letra.repeat(largo)}`;
const GRANDE = img('B', 60000), MINI = img('A', 6000);

console.log('1. Fotos de perfil ligeras');
{
  const { b, api, n } = montar();
  // Dos atletas ponen su foto: una versión antigua de la app (solo la de siempre) y la nueva (con miniatura)
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const pAna = await api.cambiarFoto(GRANDE);
  check(pAna.foto === GRANDE && !pAna.foto_grande, 'sin miniatura, la foto se guarda como siempre');
  await b.auth.entrar('ruben@fbe.demo', 'demo').catch(() => b.auth.entrar('rubén@fbe.demo', 'demo'));
  const pRuben = await api.cambiarFoto(GRANDE, MINI);
  check(pRuben.foto === MINI && pRuben.foto_grande === GRANDE, 'con miniatura, «foto» lleva la miniatura y «foto_grande» la de siempre');
  check(await api.fotoGrande(pRuben.id) === GRANDE, 'y la suya en grande es la de siempre');
  let mala = null; try { await api.cambiarFoto(GRANDE, 'x'); } catch (e) { mala = e.message; }
  check(/no es válida/.test(mala || ''), 'una miniatura que no es una imagen no se guarda');

  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const a1 = await api.atletas();
  const antes = n('perfiles');
  const a2 = await api.atletas(); await api.resumenes(); await api.bandeja(); await api.conversaciones();
  check(a1.find((x) => x.nombre === 'Ana López').foto === GRANDE && a2.find((x) => x.nombre === 'Rubén Martín').foto === MINI && n('perfiles') === antes,
    `la lista de atletas, Revisar y las conversaciones ya no vuelven a pedir las fotos (perfiles: ${antes} → ${n('perfiles')} lecturas)`);
  const fAna = await api.ficha(a1.find((x) => x.nombre === 'Ana López').id);
  check(fAna.atleta.foto === GRANDE && n('perfiles') === antes, 'ni la ficha de un atleta');

  // Aligerar las que aún van enteras (lo hace la app del coach sola)
  const pend = await api.fotosPorAligerar();
  check(pend.length === 1 && pend[0].id === pAna.id && pend[0].foto === GRANDE, 'el coach ve qué fotos van aún enteras (la de Ana; la de Rubén ya es ligera)');
  await api.guardarFotoLigera(pAna.id, MINI, GRANDE);
  check((await api.fotosPorAligerar()).length === 0, 'aligerada, ya no queda ninguna');
  const a3 = await api.atletas();
  check(a3.find((x) => x.nombre === 'Ana López').foto === MINI && n('perfiles') > antes, 'y la lista se pone al día con la miniatura (un perfil cambiado desde aquí invalida lo recordado)');
  check(await api.fotoGrande(pAna.id) === GRANDE, 'el coach sigue pudiendo verla en grande');
  let mal2 = null; try { await api.guardarFotoLigera(pAna.id, GRANDE, GRANDE); } catch (e) { mal2 = e.message; }
  check(!!mal2, 'una «miniatura» del tamaño de la grande no se acepta');

  // Quitarla
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const sin = await api.cambiarFoto(null);
  check(sin.foto == null && sin.foto_grande == null && await api.fotoGrande(pAna.id) == null, 'al quitar la foto se quitan las dos');
}
{
  // Una base sin la migración 047: no hay columna foto_grande
  const { b, api } = montar();
  const upd = b.update.bind(b), sel = b.select.bind(b);
  b.update = async (t, c, f) => { if (t === 'perfiles' && 'foto_grande' in c) throw new Error("Could not find the 'foto_grande' column of 'perfiles' in the schema cache"); return upd(t, c, f); };
  b.select = async (t, f, ...a) => { if (t === 'perfiles' && [...(f?.nulo || []), ...(f?.nonulo || [])].includes('foto_grande')) throw new Error('column perfiles.foto_grande does not exist'); return sel(t, f, ...a); };
  const api2 = crearApi(b);
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const p = await api2.cambiarFoto(GRANDE, MINI);
  check(p.foto === GRANDE, 'sin la migración 047, la foto se guarda como siempre (la de siempre en «foto»)');
  check((await api2.cambiarFoto(null)).foto == null, 'y se puede quitar');
  check(await api2.fotosPorAligerar() === null, 'y la app sabe que no hay nada que aligerar (no toca ninguna foto)');
  void api;
}
{
  // La foto del coach y la gente del equipo también se recuerdan
  const { b, api, n } = montar();
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  await api.cambiarFoto(GRANDE, MINI);
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const f1 = await api.fotoCoach(), f2 = await api.fotoCoach();
  check(f1 === MINI && f2 === MINI && n('rpc:foto_coach') === 1, 'el atleta pide la foto de su coach una vez (y es la miniatura)');
  check(await api.fotoGrande() === GRANDE, 'y al ampliarla, la grande');
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const p1 = await api.personasComunidad();
  await api.muro(); // (la primera vez puede volver a pedirlas si escribió alguien que ya no está)
  const llamadas = n('rpc:comunidad_personas');
  await api.personasComunidad(); await api.muro(); await api.muro({ filtro: 'avisos' });
  check(Object.keys(p1).length > 0 && n('rpc:comunidad_personas') === llamadas, `la gente del equipo (con sus fotos) no se pide en cada pantalla del muro (${Object.keys(p1).length} personas, ${llamadas} llamadas en total)`);
  await api.personasComunidad({ con: ['alguien-que-no-estaba'] });
  await api.personasComunidad({ con: ['alguien-que-no-estaba'] });
  check(n('rpc:comunidad_personas') === llamadas + 1, 'si escribe alguien que no estaba entre los recordados, se vuelven a pedir (una vez: si sigue sin estar, ya no)');
  // Otra cuenta en el mismo dispositivo no hereda lo recordado
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const antes = n('perfiles');
  await api.atletas();
  check(n('perfiles') > antes, 'al cambiar de cuenta, lo recordado no vale');
}

console.log('\n2. Lecturas idénticas, compartidas');
{
  const { b, api, cuenta, n } = montar();
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const total = () => Object.entries(cuenta).filter(([k]) => !k.startsWith('rpc:')).reduce((s, [, v]) => s + v, 0);
  const t0 = n('atletas');
  const [x, y, z] = await Promise.all([api.atletas(), api.atletas(), api.atletas()]);
  check(n('atletas') === t0 + 1 && x.length === y.length && x.length === z.length, 'tres piezas que piden lo mismo a la vez hacen una sola consulta');
  x[0].nombre = 'CAMBIADO';
  check(y[0].nombre !== 'CAMBIADO' && z[0].nombre !== 'CAMBIADO', 'y cada una recibe sus propias filas (cambiar las de una no toca las de otra)');
  await api.atletas();
  check(n('atletas') === t0 + 1, 'pedirlo otra vez enseguida tampoco repite la consulta');
  // Una pantalla entera: el panel y la bandeja a la vez (lo que hace la app del coach al abrir)
  const antes = total();
  await Promise.all([api.resumenes(), api.bandeja(), api.conversaciones(), api.mensajesSinLeer?.().catch(() => 0)]);
  const juntas = total() - antes;
  check(juntas > 0, `el panel, la bandeja y las conversaciones a la vez: ${juntas} consultas`);
  // Tras escribir algo, nada compartido: se vuelve a leer
  const a0 = n('atletas');
  const ana = (await api.atletas()).find((q) => q.nombre === 'Ana López');
  await api.actualizarAtleta(ana.id, { objetivo: 'Otro objetivo' });
  const tras = await api.atletas();
  check(n('atletas') === a0 + 1 && tras.find((q) => q.id === ana.id).objetivo === 'Otro objetivo', 'tras escribir algo desde la app se vuelve a leer: nunca se enseña lo de antes del cambio');
  // También si la escritura va directa al backend (algunas pantallas lo usan así)
  const a1 = n('atletas');
  await b.update('atletas', { objetivo: 'Directo' }, { eq: { id: ana.id } });
  check((await api.atletas()).find((q) => q.id === ana.id).objetivo === 'Directo' && n('atletas') === a1 + 1, 'y también si la escritura va directa al backend');
  // Pedir datos frescos a propósito (tirar para recargar, un mensaje que llega) no reutiliza nada
  // (sin ventana, aquí se comprueba con un cambio de sesión, que hace lo mismo)
  const a2 = n('atletas');
  await api.atletas();
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  await api.atletas();
  check(n('atletas') === a2 + 1, 'un cambio en la sesión (entrar, salir, el segundo paso) tampoco deja nada compartido');
  // Un error no se queda guardado
  const sel = b.select.bind(b);
  let falla = true;
  b.select = async (t, ...r) => { if (t === 'objetivos' && falla) throw new Error('Sin conexión.'); return sel(t, ...r); };
  let e1 = null; try { await api.objetivos(ana.id); } catch (e) { e1 = e.message; }
  falla = false;
  let bien = null; try { bien = await api.objetivos(ana.id); } catch { /* */ }
  check(/Sin conexi/.test(e1 || '') && Array.isArray(bien), 'una consulta que falla no se queda guardada: la siguiente se vuelve a pedir');
  // El latido de presencia (cada minuto) no cuenta como cambio; cambiar si se me ve en línea, sí
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const a3 = n('atletas');
  await api.atletas();
  await b.rpc('presencia_marcar', {}).catch(() => {});
  await api.atletas();
  const trasLatido = n('atletas');
  await b.rpc('presencia_marcar', { p_visible: false }).catch(() => {});
  await api.atletas();
  check(trasLatido === a3 + 1 && n('atletas') === a3 + 2, 'el latido de presencia no invalida nada; cambiar «en línea», sí');
}

console.log('3. El recetario, ligero');
{
  const { b, api, n } = montar();
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const ana = await api.miAtleta();
  // Hoy solo pregunta qué comidas hace y si tiene recetas: no baja ninguna receta
  const r0 = n('recetas');
  const deHoy = await api.recetarioDeHoy(ana.id);
  const entero = await api.recetario(ana.id);
  check(n('recetas') > r0 && deHoy.asignaciones.length === entero.asignaciones.length && deHoy.asignaciones.length > 0
    && JSON.stringify(deHoy.tomas) === JSON.stringify(entero.tomas), `«Tu menú de hoy» sabe qué comidas hace y cuántas recetas tiene (${deHoy.asignaciones.length}) igual que el recetario entero`);
  const { api: api2, n: n2, b: b2 } = montar();
  await b2.auth.entrar('ana@fbe.demo', 'demo');
  await api2.recetarioDeHoy((await api2.miAtleta()).id);
  check(n2('recetas') === 0, 'y sin pedir una sola receta');

  // Las miniaturas se piden una vez y se recuerdan mientras la receta no cambie
  const conMini = entero.recetas.filter((r) => r.foto_mini).length;
  check(conMini > 0 && entero.recetas.every((r) => 'foto_mini' in r && r.ingredientes), `el recetario entero trae sus recetas con miniatura (${conMini} de ${entero.recetas.length})`);
  const r1 = n('recetas');
  await new Promise((r) => setTimeout(r, 2100));   // fuera de la ventana de consultas compartidas
  const otra = await api.recetario(ana.id);
  check(n('recetas') === r1 + 1 && otra.recetas.filter((r) => r.foto_mini).length === conMini,
    `la segunda vez solo se piden las recetas, sin miniaturas (${n('recetas') - r1} lectura en vez de 2), y salen con las recordadas`);

  // Si el coach cambia la foto de una receta, se vuelve a pedir solo esa
  const una = entero.recetas.find((r) => r.foto_mini);
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const NUEVA = img('C', 3000);
  await b.update('recetas', { foto_mini: NUEVA }, { eq: { id: una.id } });
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const pedidas = [];
  const sel = b.select.bind(b);
  b.select = (t, f, ...r) => { if (t === 'recetas' && f?.cols === 'id,foto_mini') pedidas.push(f.in?.id || []); return sel(t, f, ...r); };
  const tras = await api.recetario(ana.id);
  check(tras.recetas.find((r) => r.id === una.id).foto_mini === NUEVA && pedidas.length === 1 && pedidas[0].length === 1 && pedidas[0][0] === una.id,
    'al cambiar la foto de una receta se vuelve a pedir solo la suya');
  // Si las miniaturas no llegan (sin conexión a medias), el recetario sale igual, sin fotos, y no se queda así
  const { api: api3, b: b3 } = montar();
  await b3.auth.entrar('ana@fbe.demo', 'demo');
  const ana3 = await api3.miAtleta();
  const sel3 = b3.select.bind(b3);
  let falla = true;
  b3.select = async (t, f, ...r) => { if (t === 'recetas' && f?.cols === 'id,foto_mini' && falla) throw new Error('Sin conexión.'); return sel3(t, f, ...r); };
  const sinFotos = await api3.recetario(ana3.id);
  falla = false;
  await new Promise((r) => setTimeout(r, 2100));
  const conFotos = await api3.recetario(ana3.id);
  check(sinFotos.recetas.length > 0 && sinFotos.recetas.every((r) => r.foto_mini == null) && conFotos.recetas.some((r) => r.foto_mini),
    'si las miniaturas no llegan, el recetario sale sin fotos y a la siguiente se vuelven a pedir');
  // El coach: su biblioteca entera, igual
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  b.select = sel;
  const todo = await api.recetas();
  check(todo.length >= entero.recetas.length && todo.some((r) => r.foto_mini), `la biblioteca del coach también (${todo.length} recetas)`);
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
