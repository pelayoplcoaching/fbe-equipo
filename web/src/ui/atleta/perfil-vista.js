// (visual 3) Perfil tiene dos vistas: «Tú» (tu cabecera, tu carné, tu actividad, tu asesoría y lo tuyo) y «Ajustes»
// (conexiones, el reloj, este móvil, los mensajes, guías, preguntas y la cuenta). Quien lleva a Perfil para algo de
// los ajustes (las preguntas frecuentes desde Hoy, el enlace #ajustes) lo pide antes de ir; si Perfil ya está abierto,
// se entera por el evento.
let pedida = null;
export function pedirVistaPerfil(v) {
  pedida = v;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fbe-perfil-vista', { detail: v }));
}
export function vistaPedida() { const v = pedida; pedida = null; return v; }
