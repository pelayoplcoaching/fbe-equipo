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

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
