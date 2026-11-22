// (v0.207) Las dos fechas con que GitHub pasa cada lunes la prueba de punta a punta completa (.github/workflows/fechas.yml):
// van rotando por la lista de test/por-fechas.mjs, dos distintas cada semana. Escribe «fechas=[…]» para GitHub.
//   node test/fechas-semana.mjs            las de esta semana
//   node test/fechas-semana.mjs 2026-12-07 las de la semana de ese día
import { FECHAS, conZona } from './fechas-lista.mjs';

export function fechasDeLaSemana(dia = new Date()) {
  const semana = Math.floor((Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate()) / 86400000 + 3) / 7);
  const i = (semana * 2) % FECHAS.length;
  return [FECHAS[i], FECHAS[(i + 1) % FECHAS.length]].map(conZona);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dia = process.argv[2] ? new Date(`${process.argv[2]}T12:00:00Z`) : new Date();
  console.log(`fechas=${JSON.stringify(fechasDeLaSemana(dia))}`);
}
