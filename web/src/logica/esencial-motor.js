// FBE Esencial (tanda 3): la propuesta del motor para la semana siguiente de quien va por su cuenta, lista para guardar.
// Lógica pura (sin base de datos); se carga solo cuando hace falta (con el motor entero). La usa api.prepararSemanaEsencial.
import { proponerSemana, entradaDesdeBloque, pautasDeSemana, paraElMotor, leerGuardadas, notaDeSemana, claseParaNota } from './motor/index.js';
import { semanaDesdePropuesta } from './esencial-semana.js';

// d: api.bloqueCompleto del bloque de la semana hecha; base: esa semana; tipo: 'novato' (tras «Primeras 4 semanas») o
// 'siguiente'; ejercicios: { id: ejercicio }; atleta: su fila (nivel, volumen_objetivo, reglas_motor); checkins y
// molestias: las suyas.
// Devuelve { sesiones, nota, descarga, preguntas: [{ pauta_id, ejercicio_id, texto, series: [{ numero, kg, reps }] }] }.
export function propuestaEsencial({ d, base, tipo = 'siguiente', ejercicios = {}, atleta = {}, checkins = [], molestias = [], hoy }) {
  const suyas = paraElMotor(leerGuardadas(atleta?.reglas_motor ?? null));
  const entrada = entradaDesdeBloque({
    d, base, destino: null, ejercicios, hoy, checkins, molestias, reglas: suyas.reglas,
    atleta: { nivel: atleta?.nivel ?? 'novato', perfil: suyas.perfil, volumen_objetivo: atleta?.volumen_objetivo ?? null, modalidad: 'por_su_cuenta' },
  });
  const r = proponerSemana(entrada);
  const descarga = r.semana?.tipo === 'descarga';
  const pares = Object.fromEntries((r.filas || []).map((f) => [f.pauta_id, f]));
  const { sesiones, pautas } = pautasDeSemana(d, base);
  const porSesion = {};
  for (const p of pautas) (porSesion[p.sesion_id] ||= []).push(p);
  const semana = semanaDesdePropuesta({ sesiones, pautas: porSesion, pares, soloKilos: tipo === 'novato', ejercicios });
  // La nota de la semana: lo que cambia (la de la plantilla de novato ya la pone la base si no hay nada que contar)
  const filasNota = (r.filas || []).filter((f) => !['pregunta', 'sin_tocar'].includes(f.tipo))
    .map((f) => ({ ejercicio: f.ejercicio, clase: claseParaNota({ fila: f, propuesta: f.propuesta, hechas: entrada.series[f.pauta_id] }) })).filter((x) => x.clase);
  const nota = tipo === 'novato' ? null : notaDeSemana({ semana: descarga ? 'descarga' : r.semana?.tipo || 'normal', descarga: r.descarga?.tipo, total: pautas.length, filas: filasNota }) || null;
  const preguntas = (r.filas || []).filter((f) => f.tipo === 'pregunta' && f.pregunta)
    .map((f) => ({ pauta_id: f.pauta_id, sesion_id: f.sesion_id, ejercicio_id: f.ejercicio_id, texto: f.pregunta.texto, series: f.pregunta.series }));
  return { sesiones: semana, nota, descarga, preguntas };
}
