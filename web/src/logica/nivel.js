// Servicio y nivel de cada atleta (v0.22, migración 018).
// · Servicio: «nutricion» en false = solo le llevas el entrenamiento: la app no le enseña nada de nutrición.
// · Nivel: cómo pauta el coach la carga de cada ejercicio, según su prioridad (alta, «Obligatorio» en el editor = principal):
//     novato             → kg en todos (el atleta rellena reps y RPE);
//     novato_intermedio  → kg en los obligatorios y los muy importantes (multiarticulares complementarios), RPE en
//                          accesorios y prescindibles;
//     intermedio  → kg en los principales y RPE objetivo en el resto (sin carga);
//     avanzado    → RPE objetivo en todos (el atleta elige la carga).
//   Sin nivel, el editor enseña todas las columnas, como siempre. El atleta no ve su nivel: ve su tabla.
// Donde no hay carga pautada, el atleta ve en cada serie el peso que movió en esa misma serie la última vez.

export const NIVELES = [
  ['novato', 'Novato', 'Pautas kg en todos los ejercicios; el atleta rellena reps y RPE'],
  ['novato_intermedio', 'Novato/intermedio', 'Kg en los «Obligatorio» y «Muy importante» (los multiarticulares complementarios) y RPE objetivo en accesorios y prescindibles'],
  ['intermedio', 'Intermedio', 'Kg en los principales (los «Obligatorio») y RPE objetivo en el resto'],
  ['avanzado', 'Avanzado', 'RPE objetivo en todos; el atleta elige la carga'],
];
export const NOMBRE_NIVEL = Object.fromEntries(NIVELES.map(([v, t]) => [v, t]));
export const AYUDA_NIVEL = Object.fromEntries(NIVELES.map(([v, , a]) => [v, a]));

export const conNutricion = (atleta) => atleta?.nutricion !== false;
export const textoServicio = (atleta) => (conNutricion(atleta) ? 'Entrenamiento y nutrición' : 'Solo entrenamiento');

// ¿Cómo se pauta la carga de este ejercicio? 'kg' | 'rpe' | null (sin nivel: libre)
export function modoCarga(nivel, prioridad) {
  if (nivel === 'novato') return 'kg';
  if (nivel === 'novato_intermedio') return prioridad === 'alta' || prioridad === 'media' ? 'kg' : 'rpe';
  if (nivel === 'intermedio') return prioridad === 'alta' ? 'kg' : 'rpe';
  if (nivel === 'avanzado') return 'rpe';
  return null;
}

// Qué columnas de esfuerzo y carga enseña el editor para estas pautas. Una columna que el nivel no usa se
// esconde solo si ninguna pauta tiene algo en ella (nunca se esconde un dato puesto).
export function columnasEditor(nivel, pautas = []) {
  const modos = pautas.map((p) => modoCarga(nivel, p.prioridad));
  const algo = (k) => pautas.some((p) => p[k] != null);
  if (!nivel) return { rir: true, rpe: true, kg: true };
  return {
    rir: algo('rir_objetivo'),
    rpe: modos.includes('rpe') || algo('rpe_objetivo'),
    kg: modos.includes('kg') || algo('carga_sugerida_kg'),
  };
}

// El peso de la serie «numero» la última vez (o, si ese día hizo menos series, el de la última que hizo)
export function pesoAnterior(ultimas, numero) {
  const series = ultimas?.series || [];
  const kg = (s) => (s && s.kg != null && Number(s.kg) > 0 ? Number(s.kg) : null);
  const exacta = series.find((s) => Number(s.numero) === numero);
  if (exacta) return kg(exacta);
  const ordenadas = [...series].sort((a, b) => Number(a.numero) - Number(b.numero));
  const ultima = ordenadas[ordenadas.length - 1];
  return ultima && numero > Number(ultima.numero) ? kg(ultima) : null;
}
