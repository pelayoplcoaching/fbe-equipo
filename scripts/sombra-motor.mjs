// Prueba en sombra del motor «Programar según FBE» sobre una copia completa de la app (la de Cuenta → Copia completa).
// Compara lo que propone el motor con lo que el coach programó de verdad y saca cifras agregadas. Al final añade el
// acuerdo real: las propuestas que se aplicaron en la app y cómo quedaron (si la copia ya las trae).
//
//   node scripts/sombra-motor.mjs <copia.json>                      el informe, sin nombres de atletas
//   node scripts/sombra-motor.mjs <copia.json> --reglas '{"fbe":{"porSerie":{"rpeSube":8.5}}}'
//                                                                    con otras reglas de partida
//   node scripts/sombra-motor.mjs <copia.json> --comparar '{"fbe":{"topSet":{"backoff":"solas"}}}'
//                                                                    las reglas de siempre frente a esas, lado a lado
//   Las reglas van por capas, como en el motor: "fbe" son las de partida y "atleta" manda sobre el perfil del nivel
//   (para cambiar el modelo: --comparar '{"atleta":{"modelos":{"basico":"doble","resto":"doble"}}}').
//   --ejemplos 20     añade veinte diferencias de muestra (ejercicio, lo hecho, coach y motor; sin nombres)
//   --nombres         pone el nombre de cada atleta en su fila (solo para verlo en local)
//   --json <archivo>  guarda el informe en JSON (sin nombres)
//
// La copia lleva datos de salud de los atletas: no la subas al repositorio ni a ningún sitio compartido, y no
// guardes ni pegues en sitios compartidos la salida con --nombres.
import { readFileSync, writeFileSync } from 'node:fs';
import { sombraDeCopia, textoInforme } from '../web/src/logica/motor/sombra.js';
import { acuerdoDeCopia, textoAcuerdoDeCopia } from '../web/src/logica/motor/registro.js';

const args = process.argv.slice(2);
const valor = (nombre) => { const i = args.indexOf(nombre); return i >= 0 ? args[i + 1] : null; };
const ruta = args.find((a, i) => !a.startsWith('--') && !['--reglas', '--comparar', '--ejemplos', '--json'].includes(args[i - 1]));
if (!ruta) { console.error('Falta la copia: node scripts/sombra-motor.mjs <copia.json> [--reglas JSON] [--comparar JSON] [--ejemplos N] [--nombres] [--json archivo]'); process.exit(2); }
const json = (texto, que) => { try { return texto ? JSON.parse(texto) : null; } catch { console.error(`${que}: no es JSON válido`); process.exit(2); } };

const copia = JSON.parse(readFileSync(ruta, 'utf8'));
const ejemplos = Number(valor('--ejemplos')) || 0;
const informe = sombraDeCopia(copia, { reglas: json(valor('--reglas'), '--reglas') || {}, ejemplos });
const otras = json(valor('--comparar'), '--comparar');
const otro = otras ? sombraDeCopia(copia, { reglas: otras }) : null;
const nombres = args.includes('--nombres') ? Object.fromEntries((copia.atletas || []).map((a) => [a.id, a.nombre])) : null;
console.log(textoInforme(informe, { nombres, otro }));
// El acuerdo real: lo que quedó apuntado en cada semana al aplicar una propuesta en la app (desde la fase 1b)
const acuerdo = acuerdoDeCopia(copia);
console.log(`\n${textoAcuerdoDeCopia(acuerdo, { nombres })}`);
if (valor('--json')) { writeFileSync(valor('--json'), JSON.stringify(otro ? { informe, otro, acuerdo } : { ...informe, acuerdo }, null, 2)); console.log(`\nGuardado en ${valor('--json')}`); }
