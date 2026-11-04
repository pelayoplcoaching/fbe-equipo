// v0.52: «Sesión en curso», como una Live Activity o la Dynamic Island. Mientras una sesión tiene series hechas y no
// se ha terminado, y el atleta está en otra pestaña, una píldora arriba dice qué sesión es, el ejercicio que toca y el
// descanso que queda. Lo que la sesión deja en el móvil (sin nada de salud) y cómo se lee, aquí, para probarlo.
import { mmss } from './calculos.js';

export const VIGENCIA_EN_CURSO = 4 * 3600 * 1000;   // retomar horas después ya no es «en curso» (como el cronómetro)
export const FIN_VISIBLE = 6000;                    // «¡Vamos!» se queda 6 s al acabar el descanso, como el temporizador

// Lo que se guarda: solo lo que hace falta para la píldora (el nombre de la sesión, el ejercicio y la serie que tocan,
// el descanso). Nada de peso corporal, salud ni nutrición.
export function enCursoValido(x) {
  return !!(x && typeof x === 'object' && typeof x.id === 'string' && x.id && typeof x.nombre === 'string' && Number.isFinite(x.t) && x.hechas > 0);
}

// El descanso tal y como se guarda (solo lo de la píldora: lo que queda y lo que toca después). v0.62: con el texto del aviso
// al móvil (con la carga propuesta) y, si se ha pausado desde la pantalla de bloqueo, los ms que quedaban (pausa).
export function descansoGuardable(d) {
  if (!d || !Number.isFinite(d.fin)) return null;
  return { fin: d.fin, total: d.total, prioridad: d.prioridad || null, texto: d.texto || null, voz: d.voz || null, tras: d.tras || null, inicio: d.inicio || null,
    aviso: d.aviso || null, pausa: Number.isFinite(d.pausa) && d.pausa >= 0 ? d.pausa : null };
}

// Cómo está ahora: null si no hay nada (o es de hace demasiado); si no, lo que pinta la píldora
export function estadoActividad(x, ahora = Date.now()) {
  if (!enCursoValido(x) || ahora - x.t > VIGENCIA_EN_CURSO || x.t - ahora > 60000) return null;
  let descanso = null;
  const d = x.descanso;
  // (v0.62: en pausa, lo que quedaba al pausar, quieto)
  const pausa = d && Number.isFinite(d.pausa) && d.pausa > 0 ? d.pausa : null;
  if (d && Number.isFinite(d.fin) && Number.isFinite(d.total) && d.total > 0 && (pausa || ahora - d.fin < FIN_VISIBLE)) {
    const quedan = pausa ? pausa / 1000 : Math.max(0, (d.fin - ahora) / 1000);
    descanso = { quedan, frac: Math.min(1, quedan / d.total), terminado: quedan <= 0, texto: d.texto || null, cuenta: quedan > 0 ? mmss(quedan) : '¡Vamos!', pausa: !!pausa };
  }
  return {
    id: x.id, nombre: x.nombre, ejercicio: x.ejercicio || null, siguiente: x.siguiente || null,
    hechas: x.hechas, total: x.total || null, descanso,
  };
}

// Qué se anuncia (con educación, una vez por cambio; nunca cada segundo): empieza un descanso, acaba un descanso
export function anuncioActividad(antes, ahora) {
  if (!ahora) return null;
  const da = antes?.descanso, dn = ahora.descanso;
  if (dn && !dn.terminado && (!da || da.terminado)) return `Descanso en curso: ${mmss(dn.quedan)}.`;
  if (dn?.terminado && da && !da.terminado) return `Descanso terminado.${dn.texto ? ` Ahora: ${dn.texto}.` : ''}`;
  return null;
}

// El nombre de la píldora para los lectores de pantalla (no cambia con cada segundo)
export function etiquetaActividad(e) {
  if (!e) return '';
  return `Sesión en curso: ${e.nombre}${e.ejercicio ? `, ${e.ejercicio}` : ''}${e.descanso && !e.descanso.terminado ? (e.descanso.pausa ? ', con un descanso en pausa' : ', con un descanso en marcha') : ''}. Toca para ver más`;
}
