// FBE Esencial («por su cuenta»): el atleta sin seguimiento personal, con la app y el motor (frenos de la v0.231).
// Aquí: quién va por su cuenta, cómo se le dice el esfuerzo («te sobran», como en la guía del vídeo), el nombre de la
// plantilla «Primeras 4 semanas» (la plantilla, en esencial-plantilla.js). Lo de antes de empezar (su lunes, el cribado,
// qué plantilla le toca) y sus marcas de la semana 4, en esencial-alta.js: solo lo cargan las pantallas que lo usan.
// (sin importar calculos.js, que usa textoSobran para la pauta: el número, con coma y sin ceros de detrás)
const num = (v, dec = 1) => {
  const n = Number(v);
  if (v == null || v === '' || !Number.isFinite(n)) return '—';
  return (Number.isInteger(n) ? String(n) : n.toFixed(dec).replace(/\.?0+$/, '')).replace('.', ',');
};

export const MODALIDAD_POR_SU_CUENTA = 'por_su_cuenta';
export const esPorSuCuenta = (atleta) => atleta?.modalidad === MODALIDAD_POR_SU_CUENTA;
// Quién ve lo del atleta además de él: «tu coach» o, para quien va por su cuenta (no tiene coach), Pelayo
export const quienLee = (atleta) => (esPorSuCuenta(atleta) ? 'Pelayo' : 'tu coach');
// (belleza A13) el nombre de la rutina sin «· FBE Esencial» donde ya se sabe que es FBE Esencial (Hoy, Semana, Perfil): el
// nombre de la plantilla no cambia, solo cómo se ve
export const nombreBloque = (nombre) => String(nombre || '').replace(/ \u00b7 FBE Esencial$/, '');
// (sin coach, 19) Los textos de la lógica común (Tu día, tu peso, «Hoy, por cómo estás», «Voy justo», los apuntes) que
// nombran al coach, dichos para quien va por su cuenta. Cada frase de la izquierda tiene que seguir existiendo en la
// lógica (lo comprueba test/esencial-sin-coach.test.mjs).
export const SIN_TU_COACH = [
  ['Coméntalo con tu coach para ajustar tu plan', 'Mejor más despacio: dale unas semanas'],
  [' y cuéntaselo a tu coach', ''],
  ['Cada comida que marcas le dice a tu coach cómo vas.', 'Cada comida que marcas cuenta para tu semana.'],
  ['Tu coach te lo pide: son unos minutos', 'Son unos minutos'],
  ['Enviado a tu coach', 'Enviado'],
  ['Pregunta de tu coach', 'Pregunta de Pelayo'],
  ['De tu coach', 'De Pelayo'],
];
export const sinTuCoach = (texto, atleta) => (esPorSuCuenta(atleta) && typeof texto === 'string' ? SIN_TU_COACH.reduce((t, [a, b]) => t.replace(a, b), texto) : texto);
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

// (alta, 9) Cuántos días vale el código de la invitación: 14; en FBE Esencial, hasta una semana después de su lunes de
// inicio (las altas se hacen semanas antes: con 14 días, uno dado el 15/12 ya no valdría el 11/1), como mucho 60
export function diasInvitacion({ esencial = false, inicio = null, hoy } = {}) {
  const f = /^\d{4}-\d{2}-\d{2}$/;
  if (!esencial || !f.test(inicio || '') || !f.test(hoy || '')) return 14;
  const hasta = Math.round((Date.parse(`${inicio}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 864e5) + 7;
  return Math.min(60, Math.max(14, hasta));
}

// (alta) El correo para escribir a Pelayo cuando no hay chat (FBE Esencial) o algo falla en la app o en el cobro: el
// público de la web (aprobado por él el 20/11/2026)
export const CORREO_CONTACTO = 'pelayofbe@fuerzabasadaenevidencia.com';
// La web (para enlazar la Puesta a punto y las guías)
export const WEB_FBE = 'https://fuerzabasadaenevidencia.com';
