// Pulido: pequeños comportamientos de toda la app para que responda mejor al dedo. Se instalan una vez al arrancar
// (main.jsx). Los estilos van en pulido.css.

import { instalarAtras } from './atras.js';
import { vibrar } from './hapticos.js';
import { instalarTirar } from './tirar.js';

// Lo que da un toque háptico al tocarlo (además de lo que ya lo daba: las series, el teclado de la app, los récords):
// interruptores, casillas, «+» y «−», grupos de opciones y «Revisado»
const CON_TOQUE = 'input.interruptor, [role="switch"], .casilla-redonda, .paso > button, .segmentos button, .si-casi-no button, .si-no button, .selector-chips button, .revisar-hecho';

let instalado = false;

// (pulido 2.6) El botón que se acaba de pulsar enseña que está guardando. En la app, casi todos los botones que
// guardan se quedan desactivados mientras tanto (para que no se envíe dos veces), pero solo unos pocos lo decían
// («Guardando…»): los demás se quedaban grises, sin más. Aquí, para todos a la vez: si el botón pulsado se desactiva
// y hay algo guardándose (datos/api.js avisa con «fbe-guardando»), lleva la marca data-guardando (pulido.css le pone
// una rueda en el sitio del texto, sin cambiarle el tamaño) hasta que se guarda o el botón vuelve a estar activo.
// Un botón que se desactiva por otra cosa (un «−» que llega al mínimo, «Enviar» sin texto) no la lleva: no hay nada
// guardándose.
export function instalarGuardando(d = typeof document !== 'undefined' ? document : null) {
  if (!d || typeof window === 'undefined') return () => {};
  let boton = null, guardando = 0, quitar = null;
  const fuera = (b) => { if (b) { b.removeAttribute('data-guardando'); b.removeAttribute('aria-busy'); } };
  const mirar = () => {
    clearTimeout(quitar);
    const b = boton;
    if (!b) return;
    if (!b.isConnected) { boton = null; return; }
    if (!b.disabled) { fuera(b); return; }
    if (guardando > 0) { if (!b.hasAttribute('data-guardando')) { b.setAttribute('data-guardando', ''); b.setAttribute('aria-busy', 'true'); } }
    // (entre un paso y el siguiente de un mismo guardado, la rueda no parpadea)
    else if (b.hasAttribute('data-guardando')) quitar = setTimeout(() => { if (guardando === 0) fuera(b); }, 180);
  };
  const alPulsar = (e) => {
    const b = e.target?.closest?.('button');
    if (!b) return;
    if (b !== boton) { fuera(boton); boton = b; }
    setTimeout(mirar, 0);
  };
  const alGuardar = (e) => { guardando = Number(e.detail) || 0; mirar(); };
  d.addEventListener('click', alPulsar, true);
  window.addEventListener('fbe-guardando', alGuardar);
  const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(mirar) : null;
  mo?.observe(d.documentElement, { subtree: true, attributes: true, attributeFilter: ['disabled'] });
  return () => { d.removeEventListener('click', alPulsar, true); window.removeEventListener('fbe-guardando', alGuardar); mo?.disconnect(); clearTimeout(quitar); fuera(boton); };
}

export function instalarPulido(d = typeof document !== 'undefined' ? document : null) {
  if (!d || instalado) return;
  instalado = true;
  // En iPhone, lo pulsable solo enseña su estado «pulsado» (:active) si la página escucha los toques: con este oyente
  // vacío basta. Pasivo: no frena el scroll.
  d.addEventListener('touchstart', () => {}, { passive: true });
  // El botón «atrás» cierra lo último que se abrió en vez de sacar de la app (atras.js)
  instalarAtras();
  // Tirar para recargar en las pantallas de consulta (tirar.js)
  instalarTirar(d);
  // El botón pulsado enseña que está guardando
  instalarGuardando(d);
  // (pulido 8) Al entrar en un campo de números que ya tiene algo, se selecciona: lo que se teclea lo sustituye (como
  // en la sesión y en los «+» y «−», que ya lo hacían). Un segundo toque coloca el cursor donde se quiera.
  d.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el || el.tagName !== 'INPUT' || el.readOnly || el.disabled || !el.value) return;
    const modo = el.getAttribute('inputmode');
    if (!(el.type === 'number' || modo === 'decimal' || modo === 'numeric') || el.getAttribute('autocomplete') === 'one-time-code') return;
    // (tras el toque: en el iPhone, el propio toque deja el cursor donde cayó y desharía la selección)
    setTimeout(() => { if (d.activeElement === el) { try { el.select(); } catch { /* */ } } }, 0);
  });
  // Un toque háptico al tocar los controles de cada día (hapticos.js; con su ajuste)
  d.addEventListener('click', (e) => {
    const el = e.target?.closest?.(CON_TOQUE);
    if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') vibrar('toque');
  }, { passive: true, capture: true });
}
