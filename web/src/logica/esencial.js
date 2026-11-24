// FBE Esencial («por su cuenta»): el atleta sin seguimiento personal, con la app y el motor (frenos de la v0.231).
// Aquí: quién va por su cuenta, cómo se le dice el esfuerzo («te sobran», como en la guía del vídeo), la plantilla
// «Primeras 4 semanas» (su nombre; la plantilla, en esencial-plantilla.js) y sus marcas de la semana 4.
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

// La plantilla de la guía está en esencial-plantilla.js (solo la usan la demo y el SQL: no va en lo que se carga al abrir)
export const NOMBRE_PRIMERAS_4 = 'Primeras 4 semanas';

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
