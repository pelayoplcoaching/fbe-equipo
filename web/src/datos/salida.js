// La bandeja de salida del chat (v0.55): cada mensaje de texto sale de aquí. Aparece al momento en el chat (con ⏱),
// se guarda en el móvil y se envía en orden; sin cobertura (o sin sesión) espera y se envía solo al volver. Si la base
// lo rechaza (no por la cobertura), se queda con «!» para reintentarlo o eliminarlo: no se pierde en silencio.
// No se repite nunca: cada mensaje lleva su id (cliente_id) y la base no deja entrar dos con el mismo.
// (La cola de las series, datos/cola.js, va por atleta y aparta lo rechazado: aquí hace falta por cuenta, con el
// coach escribiendo a varios, y que lo fallido se quede a la vista. Comparte con ella qué es un error pasajero.)
import { ordenarSalida, siguienteSalida, nuevoPendiente, quitarYaEnviados, retomarSalida } from '../logica/chat.js';
import { esTemporal } from './cola.js';

export const CLAVE_SALIDA = 'fbe-salida-v1';
const almacenDe = () => { try { return window.localStorage; } catch { return null; } };
function leer(almacen, clave) {
  try { const x = JSON.parse(almacen?.getItem(clave) || '[]'); return Array.isArray(x) ? x : []; } catch { return []; }
}

export function crearSalida(api, { clave = CLAVE_SALIDA, almacen = almacenDe(), reintentoMs = 20000 } = {}) {
  // Lo que se estaba enviando cuando se cerró la app (o se mató) vuelve a «pendiente»: si llegó a entrar, la base no
  // lo repite (su cliente_id) y la app se queda con el que ya hay
  let lista = retomarSalida(leer(almacen, clave));
  const oyentes = new Set();
  let vaciando = false;
  let reintento = null;
  const guardar = () => { try { almacen?.setItem(clave, JSON.stringify(lista)); } catch { /* sin almacenamiento: vale mientras siga abierta */ } };
  const avisar = () => { guardar(); for (const f of oyentes) { try { f(lista); } catch { /* */ } } };
  const yo = () => api.uid?.() || null;

  function programar() {
    clearTimeout(reintento);
    if (lista.some((x) => x.perfil === yo() && x.estado === 'pendiente')) reintento = setTimeout(() => { s.vaciar(); }, reintentoMs);
  }

  const s = {
    lista: () => lista,
    pendientes: (atletaId) => lista.filter((x) => x.perfil === yo() && (!atletaId || x.atletaId === atletaId)),
    oir(f) { oyentes.add(f); return () => oyentes.delete(f); },
    // Un mensaje nuevo: a la bandeja (y a enviar). Devuelve el pendiente (con su cliente_id).
    encolar({ atletaId, autor, texto, respondeA = null }) {
      const p = nuevoPendiente({ perfil: yo(), atletaId, autor, texto, respondeA });
      if (!p.perfil || !p.texto) throw new Error('Escribe el mensaje');
      lista = ordenarSalida([...lista, p]);
      avisar();
      s.vaciar();
      return p;
    },
    reintentar(clienteId) {
      lista = lista.map((x) => (x.cliente_id === clienteId ? { ...x, estado: 'pendiente', error: null } : x));
      avisar();
      return s.vaciar();
    },
    descartar(clienteId) { lista = lista.filter((x) => x.cliente_id !== clienteId); avisar(); },
    // Con la conversación de la base delante: lo que ya está en ella (por su cliente_id) sale de la bandeja (también un
    // «!» o un ⏱ de algo que sí llegó y cuya respuesta se perdió)
    confirmar(mensajes = []) {
      const antes = lista.length;
      lista = quitarYaEnviados(lista, mensajes);
      if (lista.length !== antes) avisar();
    },
    // Lo de esta cuenta, en orden, uno a uno. Se para (sin perder nada) si falta la cobertura o la sesión.
    async vaciar() {
      if (vaciando) return;
      vaciando = true;
      try {
        for (;;) {
          const p = siguienteSalida(lista, yo());
          if (!p) break;
          lista = lista.map((x) => (x.cliente_id === p.cliente_id ? { ...x, estado: 'enviando', intentos: (x.intentos || 0) + 1 } : x));
          avisar();
          try {
            await api.enviarMensaje(p.atletaId, { texto: p.texto, autor: p.autor, respondeA: p.respondeA, clienteId: p.cliente_id });
            lista = lista.filter((x) => x.cliente_id !== p.cliente_id);
            avisar();
            try { window.dispatchEvent(new CustomEvent('fbe-salida-enviado', { detail: { atletaId: p.atletaId, cliente_id: p.cliente_id } })); } catch { /* */ }
          } catch (e) {
            if (esTemporal(e)) { lista = lista.map((x) => (x.cliente_id === p.cliente_id ? { ...x, estado: 'pendiente' } : x)); avisar(); break; }
            // Una cita que ya no vale (se eliminó el mensaje citado) no tumba el mensaje: sale sin ella
            if (p.respondeA && /responder a un mensaje/i.test(e?.message || '')) {
              lista = lista.map((x) => (x.cliente_id === p.cliente_id ? { ...x, estado: 'pendiente', respondeA: null } : x));
              continue;
            }
            lista = lista.map((x) => (x.cliente_id === p.cliente_id ? { ...x, estado: 'fallo', error: String(e?.message || e).slice(0, 200) } : x));
            avisar();
          }
        }
      } finally {
        vaciando = false;
        programar();
      }
    },
    // Al cerrar la sesión: nada de lo de nadie se queda en el móvil
    borrarTodo() { clearTimeout(reintento); lista = []; try { almacen?.removeItem(clave); } catch { /* */ } for (const f of oyentes) { try { f(lista); } catch { /* */ } } },
  };
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('online', () => { s.vaciar(); });
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') s.vaciar(); });
  return s;
}

// Una por app (la comparten el chat, la lista del coach y el arranque)
const porApi = new WeakMap();
export function salidaDe(api) {
  if (!api) return null;
  if (!porApi.has(api)) porApi.set(api, crearSalida(api));
  return porApi.get(api);
}
// Al cerrar la sesión (aunque aún no se haya abierto ningún chat)
export function borrarSalida(api) {
  if (api && porApi.has(api)) porApi.get(api).borrarTodo();
  else { try { window.localStorage.removeItem(CLAVE_SALIDA); } catch { /* */ } }
}
