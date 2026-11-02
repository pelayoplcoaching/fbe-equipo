// v0.52: el carné de atleta en Perfil, como una tarjeta de Apple Wallet: «FBE Coaching», su nombre, su nivel, su bloque
// y desde cuándo entrena con su coach, con la marca. Brillo holográfico y una inclinación leve que sigue al dedo (o al
// móvil, donde no hace falta pedir permiso). Se puede compartir o guardar como imagen. Nunca lleva peso, salud ni
// nutrición: CAMPOS_CARNET es todo lo que puede llevar (las pruebas lo comprueban).
import { NOMBRE_NIVEL } from './nivel.js';
import { semilla } from './arte.js';

export const CAMPOS_CARNET = ['nombre', 'nivel', 'bloque', 'desde', 'numero'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// «marzo de 2026» (el mes en que empezó con su coach)
export function fmtDesde(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? `${MESES[mes - 1]} de ${m[1]}` : null;
}

// Un número de socio corto y estable, que sale de su identificador (no dice nada de él). Es decorativo: con 6 cifras
// casi nunca coinciden dos, pero no es un identificador único y no se usa para nada
export function numeroCarnet(id) {
  return `FBE·${String(semilla(String(id || '')) % 1000000).padStart(6, '0')}`;
}

export function datosCarnet({ atleta = {}, bloque = null } = {}) {
  return {
    nombre: String(atleta.nombre || '').trim() || 'Atleta FBE',
    nivel: NOMBRE_NIVEL[atleta.nivel] || null,
    bloque: bloque?.nombre ? `Bloque ${bloque.numero ? `${bloque.numero}: ` : ''}${bloque.nombre}` : null,
    desde: fmtDesde(atleta.fecha_alta),
    numero: numeroCarnet(atleta.id),
  };
}

// Lo que lleva la imagen para compartir: sin el bloque (su nombre lo escribe el coach y podría decir algo de salud,
// como «Rehabilitación de hombro»); el bloque solo se ve en el carné de la app
export const CAMPOS_IMAGEN = ['nombre', 'nivel', 'desde', 'numero'];
export function datosImagenCarnet(d = {}) {
  return Object.fromEntries(CAMPOS_IMAGEN.map((k) => [k, d[k] ?? null]));
}

// La inclinación con el dedo: de −max a +max grados según dónde esté dentro de la tarjeta, y dónde cae el brillo
export function inclinacion({ x, y, w, h }, max = 8) {
  const nx = Math.max(0, Math.min(1, w ? x / w : 0.5)), ny = Math.max(0, Math.min(1, h ? y / h : 0.5));
  const r = (v) => Math.round(v * 100) / 100;
  return { rx: r((0.5 - ny) * 2 * max), ry: r((nx - 0.5) * 2 * max), bx: r(nx * 100), by: r(ny * 100) };
}

// Con el móvil (deviceorientation): beta (adelante/atrás) y gamma (a los lados), respecto a cómo se tenía al empezar
export function inclinacionMovil(beta, gamma, base = { beta: 45, gamma: 0 }, max = 8) {
  const lim = (v) => Math.max(-1, Math.min(1, v));
  const db = lim(((Number(beta) || 0) - base.beta) / 30), dg = lim(((Number(gamma) || 0) - base.gamma) / 30);
  return inclinacion({ x: (dg + 1) / 2, y: (db + 1) / 2, w: 1, h: 1 }, max);
}
