// FBE Esencial («por su cuenta»): el atleta sin seguimiento personal, con la app y el motor (frenos de la v0.231).
// Aquí: quién va por su cuenta, cómo se le dice el esfuerzo («te sobran», como en la guía del vídeo), la plantilla
// «Primeras 4 semanas» (la misma de la guía; sirve para la demo y para el SQL de la base) y sus marcas de la semana 4.
// (sin importar calculos.js, que usa textoSobran para la pauta: el número, con coma y sin ceros de detrás)
const num = (v, dec = 1) => {
  const n = Number(v);
  if (v == null || v === '' || !Number.isFinite(n)) return '—';
  return (Number.isInteger(n) ? String(n) : n.toFixed(dec).replace(/\.?0+$/, '')).replace('.', ',');
};

export const MODALIDAD_POR_SU_CUENTA = 'por_su_cuenta';
export const esPorSuCuenta = (atleta) => atleta?.modalidad === MODALIDAD_POR_SU_CUENTA;

// ---------- «Te sobran» ----------
// Las repeticiones que podría haber hecho de más al acabar la serie. Un medio se lee como tramo, como en la guía
// (RIR 4,5 → «4-5»). Del RPE: te sobran 10 − RPE.
export function sobran(rir) {
  const r = Number(rir);
  if (rir == null || rir === '' || !Number.isFinite(r) || r < 0) return null;
  if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r));
  const a = Math.floor(r);
  return Math.abs(r - a - 0.5) < 1e-9 ? `${a}-${a + 1}` : num(r);
}
export const sobranDeRpe = (rpe) => (rpe == null || rpe === '' || !Number.isFinite(Number(rpe)) ? null : sobran(Math.max(0, 10 - Number(rpe))));

// «RIR 4,5» → «Te sobran 4-5»; «RPE 8» → «Te sobran 2»; «RIR 0» → «Sin que te sobre ninguna». El resto, igual.
export function textoSobran(texto) {
  const s = String(texto || '');
  const m = /^\s*(RIR|RPE)\s*(\d+(?:[.,]\d)?)\s*$/.exec(s);
  if (!m) return s;
  const v = Number(m[2].replace(',', '.'));
  const q = m[1] === 'RIR' ? sobran(v) : sobranDeRpe(v);
  if (q == null) return s;
  return q === '0' ? 'Sin que te sobre ninguna' : `Te sobran ${q}`;
}
// Para las opciones del RPE al apuntar: «8 · te sobran 2»
export function etiquetaRpeSobran(rpe) {
  const q = sobranDeRpe(rpe);
  if (q == null) return '';
  return `${num(rpe)} · ${q === '0' ? 'no te sobra ninguna' : `te sobran ${q}`}`;
}

// ---------- La plantilla «Primeras 4 semanas» (la guía del vídeo del 3/1/2027) ----------
// Dos días por semana que no vayan seguidos, la misma sesión las cuatro semanas. Lo que cambia es cuánto haces
// (series) y cuánto aprietas (te sobran). La plancha va por tiempo: 20-30 s la primera semana y 5 s más cada semana
// (decisión de Pelayo del 24/11). Repeticiones: 10-12 las cuatro semanas.
export const PRIMERAS_4 = {
  nombre: 'Primeras 4 semanas',
  objetivo: 'Aprender los cinco ejercicios y llegar a febrero',
  descripcion: 'La guía del vídeo: dos días por semana que no vayan seguidos y la misma sesión las cuatro semanas. En la cuarta, tus marcas: el punto de partida para todo lo que venga.',
  foco: 'adaptacion',
  sesiones: ['Día 1', 'Día 2'],
  ejercicios: [
    { nombre: 'Prensa de piernas', alternativa: 'Sentadilla a un banco', nota: 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.' },
    { nombre: 'Peso muerto rumano con mancuernas', alternativa: 'Puente de glúteo', nota: 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.' },
    { nombre: 'Press de pecho en máquina', alternativa: 'Flexiones', nota: 'O flexiones, con más o menos inclinación según tu nivel.' },
    { nombre: 'Jalón al pecho', alternativa: 'Remo en máquina', nota: 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.' },
    { nombre: 'Plancha abdominal', alternativa: 'Curl de bíceps', porTiempo: true, nota: 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.' },
  ],
  semanas: [
    { numero: 1, series: [1, 1, 1, 1, 1], rir: 4.5, descanso: null, plancha: [20, 30],
      nota: 'Una serie de cada ejercicio, de diez a doce repeticiones. Aprender el gesto y salir con ganas de volver. Media hora y a casa. El primer día empieza con poco peso: haz doce repeticiones y pregúntate cuántas más habrías podido hacer; buscas el peso con el que te sobren cuatro o cinco.' },
    { numero: 2, series: [2, 2, 2, 2, 2], rir: 3, descanso: 90, plancha: [25, 35],
      nota: 'Dos series de cada ejercicio. Entre una serie y otra, descansa lo que necesites para repetirla bien: uno o dos minutos.' },
    { numero: 3, series: [2, 2, 2, 2, 2], rir: 2, descanso: 90, plancha: [30, 40],
      nota: 'Dos series, con un poco más de peso. Tu primera subida de carga.' },
    { numero: 4, series: [3, 3, 2, 2, 2], rir: 2, descanso: 90, plancha: [35, 45], marcas: true,
      nota: 'Tres series en los dos primeros ejercicios y dos en el resto. Apuntas tus marcas: el peso y las repeticiones de cada ejercicio. Tres cuartos de hora.' },
  ],
  reps: [10, 12],
};

// Las filas de la plantilla, sin ids: [{ semana, nota, sesiones: [{ orden, nombre, ejercicios: [{ orden, nombre,
// series, reps_min, reps_max, rir_objetivo, descanso_seg, por_tiempo, notas_coach }] }] }]
export function filasPrimeras4(p = PRIMERAS_4) {
  return p.semanas.map((w) => ({
    numero: w.numero, nota: w.nota, marcas: !!w.marcas,
    sesiones: p.sesiones.map((nombre, i) => ({
      orden: i + 1, nombre,
      ejercicios: p.ejercicios.map((e, k) => ({
        orden: k + 1, nombre: e.nombre, alternativa: e.alternativa, por_tiempo: !!e.porTiempo,
        series: w.series[k],
        reps_min: e.porTiempo ? w.plancha[0] : p.reps[0],
        reps_max: e.porTiempo ? w.plancha[1] : p.reps[1],
        rir_objetivo: e.porTiempo ? null : w.rir,
        descanso_seg: w.descanso,
        prioridad: k < 2 ? 'alta' : 'media',
        notas_coach: e.nota,
      })),
    })),
  }));
}

// ---------- Sus marcas (la semana 4) ----------
// De lo apuntado en una semana: la mejor serie de cada ejercicio (el que hizo, también si cambió a la alternativa).
// Con kilos, la de más kilos (a igualdad, más repeticiones); sin kilos o por tiempo, la de más repeticiones o segundos.
// pautas: [{ id, ejercicio_id, orden }]; series: [{ sesion_ejercicio_id, numero, kg, reps, sustituto_id }];
// ejercicios: { id: { id, nombre, por_tiempo } }. Devuelve [{ ejercicio_id, nombre, kg, reps, porTiempo, texto }] en
// el orden de la sesión.
export function marcasDeSemana({ pautas = [], series = [], ejercicios = {} }) {
  const orden = new Map();
  for (const p of [...pautas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))) if (!orden.has(p.id)) orden.set(p.id, p);
  const mejor = new Map();
  for (const s of series) {
    const p = orden.get(s.sesion_ejercicio_id);
    const reps = Number(s.reps);
    if (!p || !(reps > 0)) continue;
    const id = s.sustituto_id || p.ejercicio_id;
    const ej = ejercicios[id] || { id, nombre: '' };
    const kg = Number(s.kg) > 0 ? Number(s.kg) : null;
    const actual = mejor.get(id);
    const gana = !actual || (kg != null && (actual.kg == null || kg > actual.kg || (kg === actual.kg && reps > actual.reps)))
      || (kg == null && actual.kg == null && reps > actual.reps);
    if (gana) mejor.set(id, { ejercicio_id: id, nombre: ej.nombre, kg, reps, porTiempo: !!ej.por_tiempo, orden: p.orden ?? 0 });
  }
  return [...mejor.values()].sort((a, b) => a.orden - b.orden)
    // (con espacios que no parten: «16 kg × 12» no se corta en dos líneas)
    .map(({ orden: _o, ...m }) => ({ ...m, texto: m.porTiempo ? `${m.reps} s` : m.kg != null ? `${num(m.kg, 2)} kg × ${m.reps}` : `${m.reps} repeticiones` }));
}
