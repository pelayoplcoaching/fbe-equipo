// v0.230 (migración 090): el atleta apunta el resultado de su carrera (carrera_resultado_poner), contra el esquema real
// (PGlite, con RLS). De las suyas que ya han sido (hasta 60 días), solo el resultado y su nota; el coach, de cualquiera.
// Sin la 090, la app lo dice sin romperse.
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, sumarDias, fechaMadrid } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });
if (hoyISO() !== fechaMadrid()) {
  console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta)');
  process.exit(0);
}
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const q = (sql, p = []) => b.sql(sql, p);
const hoy = hoyISO();
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const ana = await api.crearAtleta({ nombre: 'Ana Ruiz', email: 'ana@test' });
const luis = await api.crearAtleta({ nombre: 'Luis Gil', email: 'luis@test' });
const cod = await api.crearInvitacion(ana.id);
const ev = async (atleta, fecha, extra = {}) => (await api.guardarCarreraEvento(atleta, { nombre: 'Carrera', fecha, distancia_km: '10', ...extra })).id;
const ayer = await ev(ana.id, sumarDias(hoy, -1), { objetivo: '50:00' });
const futura = await ev(ana.id, sumarDias(hoy, 5));
const vieja = await ev(ana.id, sumarDias(hoy, -61));
const deLuis = await ev(luis.id, sumarDias(hoy, -1));

await b.auth.registrar('ana@test', 'contraseña-ana-1', 'Ana');
await api.canjearCodigo(cod);
await api.darConsentimientos();
const apiAna = crearApi(b);
console.log('El atleta apunta su resultado');
const r = await apiAna.ponerResultadoCarrera(ayer, { resultado: '48:30', nota: 'Con calor' });
const fila = (await q(`select * from carrera_eventos where id = $1`, [ayer]))[0];
check(r?.resultado_seg === 2910 && fila.resultado_seg === 2910 && fila.resultado_nota === 'Con calor' && fila.objetivo_seg === 3000 && fila.nombre === 'Carrera',
  'Ana apunta 48:30 en la carrera de ayer, con su nota (lo demás de la carrera no cambia)');
check(/aún no ha llegado/.test((await falla(() => apiAna.ponerResultadoCarrera(futura, { resultado: '45:00' })))?.message || ''), 'de una carrera que aún no ha llegado, no');
check(/60 días/.test((await falla(() => apiAna.ponerResultadoCarrera(vieja, { resultado: '45:00' })))?.message || ''), 'de una de hace más de 60 días, no');
check(/tus carreras/.test((await falla(() => apiAna.ponerResultadoCarrera(deLuis, { resultado: '45:00' })))?.message || ''), 'de la carrera de otro, no');
check(/1:52:30 o 48:10/.test((await falla(() => apiAna.ponerResultadoCarrera(ayer, { resultado: 'mucho' })))?.message || '')
  && /entre 1 minuto y 48 horas/.test((await falla(() => b.rpc('carrera_resultado_poner', { p_evento: ayer, p_seg: 30 })))?.message || ''), 'un tiempo mal escrito o imposible, no');
check(!!(await falla(() => b.update('carrera_eventos', { nombre: 'Otra' }, { eq: { id: ayer } }).then((x) => { if (!x?.length) throw new Error('nada'); }))), 'y cambiar la carrera a mano sigue sin poder (solo el resultado, con la función)');
const quitar = await apiAna.ponerResultadoCarrera(ayer, { resultado: '' });
check(quitar?.resultado_seg === null && quitar.resultado_nota === null, 'con el tiempo vacío, lo quita (y su nota)');

console.log('\nEl coach');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
const rc = await api.ponerResultadoCarrera(vieja, { resultado: '47:00' });
check(rc?.resultado_seg === 2820, 'el coach lo apunta en cualquiera, también de hace más de 60 días');

console.log('\nSin la 090');
await q('drop function public.carrera_resultado_poner(uuid, integer, text)');
check((await crearApi(b).ponerResultadoCarrera(ayer, { resultado: '48:30' }))?.falta090 === true, 'la app lo nota y no se rompe');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
