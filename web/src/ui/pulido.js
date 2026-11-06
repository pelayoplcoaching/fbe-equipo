// Pulido: pequeños comportamientos de toda la app para que responda mejor al dedo. Se instalan una vez al arrancar
// (main.jsx). Los estilos van en pulido.css.

import { instalarAtras } from './atras.js';
import { vibrar } from './hapticos.js';
import { instalarTirar } from './tirar.js';

// Lo que da un toque háptico al tocarlo (además de lo que ya lo daba: las series, el teclado de la app, los récords):
// interruptores, casillas, «+» y «−», grupos de opciones y «Revisado»
const CON_TOQUE = 'input.interruptor, [role="switch"], .casilla-redonda, .paso > button, .segmentos button, .si-casi-no button, .si-no button, .selector-chips button, .revisar-hecho';

let instalado = false;

// (pulido 2.7) Teclado y formularios, para toda la app a la vez:
// 1. En el iPhone, al entrar en un campo con letra de menos de 16 px (casi todos los del editor del coach), Safari
//    amplía la página y la deja ampliada. Con maximum-scale=1 no lo hace, y pellizcar para ampliar sigue funcionando
//    (iOS no hace caso de ese límite para el pellizco). Solo en iOS: en Android sí impediría ampliar con los dedos.
// 2. La tecla Intro del teclado del móvil dice lo que va a hacer («Siguiente» o «Hecho») y, en un formulario con
//    varios campos, pasa al siguiente en vez de enviarlo a medias; en el último, lo envía, como siempre. Con teclado
//    de verdad (ordenador) no cambia nada: Intro envía.
// 3. Con el teclado abierto, las hojas que suben desde abajo se quedan encima de él (--teclado-hoja, lo que tapa el
//    teclado, de visualViewport; pulido.css), en vez de quedar con el botón de guardar debajo.
export const esIOS = (nav = typeof navigator !== 'undefined' ? navigator : null) => !!nav && (/iP(hone|ad|od)/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1));
const DE_TEXTO = new Set(['', 'text', 'email', 'number', 'tel', 'url', 'password', 'search']);
const esCampoDeTexto = (el) => !!el && el.tagName === 'INPUT' && DE_TEXTO.has((el.getAttribute('type') || '').toLowerCase()) && !el.readOnly && !el.disabled;
// El siguiente campo de escribir del mismo formulario (los desplegables y las fechas se saltan: abren su propio selector)
export function campoSiguiente(el) {
  const form = el?.form || el?.closest?.('form');
  if (!form) return null;
  const campos = [...form.querySelectorAll('input, textarea')].filter((c) => (c === el || esCampoDeTexto(c) || (c.tagName === 'TEXTAREA' && !c.readOnly && !c.disabled)) && c.getClientRects().length > 0 && !c.closest('[inert]'));
  const i = campos.indexOf(el);
  return i >= 0 ? campos[i + 1] || null : null;
}
export function instalarTecladoYFormularios(d = typeof document !== 'undefined' ? document : null) {
  if (!d || typeof window === 'undefined') return;
  if (esIOS()) {
    const m = d.querySelector('meta[name="viewport"]');
    if (m && !/maximum-scale/.test(m.content)) m.content = `${m.content}, maximum-scale=1`;
  }
  d.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!esCampoDeTexto(el) || !(el.form || el.closest('form'))) return;
    if (el.hasAttribute('enterkeyhint') && !el.hasAttribute('data-intro')) return;   // (el que ya lo dice, manda)
    el.setAttribute('enterkeyhint', campoSiguiente(el) ? 'next' : el.type === 'search' ? 'search' : 'done');
    el.setAttribute('data-intro', '');
  });
  const tactil = () => { try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; } };
  d.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || !esCampoDeTexto(e.target) || !tactil()) return;
    const s = campoSiguiente(e.target);
    if (!s) return;
    e.preventDefault();
    try { s.focus(); } catch { /* */ }
  });
  const vv = window.visualViewport;
  if (!vv) return;
  let raf = 0, antes = -1;
  const poner = () => {
    raf = 0;
    // (lo mismo que mide el chat: lo que tapa menos de 80 px es la barra del navegador o un pellizco, no el teclado)
    const medida = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    const tapa = medida > 80 && vv.scale <= 1.01 ? medida : 0;
    if (tapa === antes) return;
    antes = tapa;
    if (tapa) d.documentElement.style.setProperty('--teclado-hoja', `${tapa}px`); else d.documentElement.style.removeProperty('--teclado-hoja');
    // El campo en el que se está escribiendo, a la vista dentro de su hoja
    const el = d.activeElement;
    if (tapa && el?.closest?.('.hoja-dialogo')) requestAnimationFrame(() => { try { el.scrollIntoView({ block: 'nearest' }); } catch { /* */ } });
  };
  const al = () => { if (!raf) raf = requestAnimationFrame(poner); };
  vv.addEventListener('resize', al);
  vv.addEventListener('scroll', al);
}

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
  // Teclado y formularios: sin ampliación en iPhone, Intro al campo siguiente, las hojas encima del teclado
  instalarTecladoYFormularios(d);
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
