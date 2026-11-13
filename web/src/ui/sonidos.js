// Los sonidos del chat (v0.56): dos tonos propios, suaves y cortos, hechos al momento con WebAudio (sin archivos de
// audio, ni de WhatsApp ni de nadie). «enviado»: dos notas que suben; «recibido»: dos que bajan, un poco más presentes.
// (sonido, tanda 1) Ahora son de la familia sonora de FBE (ui/sonido.js), con el volumen del apartado «Chat», y hay un
// tercero, «coach»: el motivo de FBE, para lo que manda el coach.
// Solo con el chat abierto y a la vista, con «Sonidos del chat» activado y la conversación sin silenciar (lo decide
// debeSonar, en logica/chat.js). Si el navegador no deja (sin WebAudio o sin un toque antes), no suena y no pasa nada.
import { contexto, sonarFBE } from './sonido.js';

export let sonados = 0; // para las pruebas: cuántas veces ha sonado algo
export function sonar(tipo) {
  if (!['enviado', 'recibido', 'coach'].includes(tipo)) return false;
  contexto();   // (el chat se abre con un toque: el contexto puede crearse aquí)
  const ok = sonarFBE(tipo);
  if (ok) sonados++;
  return ok;
}
