// Revisión de seguridad de «Programar según FBE» sobre una copia completa de la app (la que se descarga en el panel).
// Recorre las mismas parejas de semanas que la prueba en sombra y mira cada serie que propone el motor frente a lo que
// hizo el atleta en ella. Pensada para «FBE por tu cuenta»: con --por-su-cuenta todos los atletas pasan por los frenos
// del 24/11/2026 (modelos.js) y la cifra que importa tiene que salir a cero.
//
//   node scripts/seguridad-motor.mjs <copia.json> [--por-su-cuenta] [--confirmar] [--json salida.json] [--ejemplos N]
//
//   --confirmar  simula que el atleta confirma todo lo que el motor le pregunta por posible errata y vuelve a proponer
//
// Qué cuenta (por serie hecha, comparada con la propuesta para esa misma serie):
//   masDeUnSalto        la propuesta sube más de un salto de carga sobre los kilos que movió
//   bajoSuelo           estaba dentro del rango y la propuesta baja del mínimo (sin contar el peaking)
//   atascadoDosSemanas  dos semanas seguidas por debajo de su mínimo y la propuesta ni suma repeticiones ni baja kilos (con kilos)
//   (informativo)       atascado una semana, sube más de un 10 %, más de 2 repeticiones, molestia y sube
// La copia lleva datos de salud: este script no escribe nombres de atletas (en el JSON, «Atleta N»).
import { readFileSync, writeFileSync } from 'node:fs';
import { repasoSeguridad } from '../web/src/logica/motor/seguridad.js';

const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const conValor = new Set(['--json', '--ejemplos'].map((n) => args.indexOf(n) + 1).filter((i) => i > 0));
const ruta = args.find((a, i) => !a.startsWith('--') && !conValor.has(i));
const porSuCuenta = args.includes('--por-su-cuenta'), confirmar = args.includes('--confirmar');
const salida = opcion('--json'), nEjemplos = Number(opcion('--ejemplos')) || 0;
if (!ruta) { console.error('Uso: node scripts/seguridad-motor.mjs <copia.json> [--por-su-cuenta] [--confirmar] [--json salida.json] [--ejemplos N]'); process.exit(1); }

const copia = JSON.parse(readFileSync(ruta, 'utf8'));
const c = repasoSeguridad(copia, { porSuCuenta, confirmar });

const res = { copia: copia.exportado_en || null, porSuCuenta, confirmar, ...c, masDeUnSaltoN: c.masDeUnSalto.length, bajoSueloN: c.bajoSuelo.length, atascadoDosSemanasN: c.atascadoDosSemanas.length };
if (salida) writeFileSync(salida, JSON.stringify(res, null, 2));
console.log(`SEGURIDAD${porSuCuenta ? ' · por su cuenta (con los frenos)' : ' · con seguimiento (motor de siempre)'}${confirmar ? ' · el atleta confirma las erratas' : ''}`);
console.log(`  Semanas: ${c.semanas} · propuestas (filas): ${c.filas} · series con kilos comparables: ${c.seriesConKilos} · con repeticiones: ${c.seriesConReps}`);
if (porSuCuenta) console.log(`  Ejercicios que esperan a que el atleta confirme una posible errata: ${c.preguntas}`);
console.log(`  Más de un salto de carga sobre lo hecho: ${c.masDeUnSalto.length}`);
console.log(`  Estaba dentro del rango y baja del mínimo: ${c.bajoSuelo.length} (más ${c.bajoSueloPautado} con lo pautado ya por debajo a propósito)`);
console.log(`  Dos semanas por debajo de su mínimo sin avanzar: ${c.atascadoDosSemanas.length} (más ${c.atascadoSinCarga} sin carga que bajar, con aviso al coach)`);
console.log(`  Informativo: atascado una semana ${c.atascadoUnaSemana} · sube más de un 10 % ${c.subeMas10} · más de 2 repeticiones ${c.masDe2Reps} · con molestia en la zona ${c.filasConMolestia}, de ellas suben ${c.subenConMolestia}`);
console.log(`  Semanas con aviso para el coach: ${c.semanasCon.alguno} de ${c.semanas} (pregunta por errata ${c.semanasCon.pregunta} · molestia ${c.semanasCon.molestia} · baja un salto ${c.semanasCon.bajaRango} · sin carga que bajar ${c.semanasCon.sinCarga})`);
console.log(`  Frenos que han actuado: ${Object.entries(c.frenos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || 'ninguno'}`);
if (nEjemplos) for (const [t, lista] of [['Más de un salto', c.masDeUnSalto], ['Baja del mínimo', c.bajoSuelo], ['Dos semanas por debajo', c.atascadoDosSemanas]]) {
  if (!lista.length) continue;
  console.log(`  ${t}:`);
  for (const e of lista.slice(0, nEjemplos)) console.log(`    ${e.ejercicio}, serie ${e.serie}: ${e.hizo} → ${e.propone} (${e.tipo}) · ${e.motivo}`);
}
