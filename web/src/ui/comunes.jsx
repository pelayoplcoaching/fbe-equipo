import { createContext, Component, render as pintarEn, h } from 'preact';
import { reportarError } from '../registro-errores.js';
import { useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { escalaGrafica, puntoMasCercano, indicesRecord } from '../logica/visual.js';
import { num, leerNumero } from '../logica/calculos.js';
import { LOBO } from './marca-lobo.js';
import { LOBO_CAJA, LOBO_D } from './lobo-trazo.js';
import { Ilustracion } from './Ilustraciones.jsx';
import { fmtCorta, aISO, diasEntre, hoyISO } from '../logica/fechas.js';
import { FRACCION_MEDIA, fotogramasMuelle, MUELLE, arrastreVisible, velocidadDe, destinoHoja } from '../logica/muelle.js';
import { remuestrear, mezclarPuntos, trazo as trazoDe, area as areaDe, salidaSuave, columnasCifra, seleccionValida } from '../logica/rangos.js';
import { sinMovimiento } from './transiciones.js';
import { leerPreferencia, guardarPreferencia } from './preferencias.js';

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// ---------------------------------------------------------------- iconos (24×24, trazo)
export const P = {
  hoy: 'M3 10v4M6 7v10M9 12h6M18 7v10M21 10v4',
  semana: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4',
  checkin: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16M8.5 12.5l2.2 2.2 4.8-4.8',
  progreso: 'M4 19h16M5 15l4.5-4.5 3.5 3.5L19 8M15 8h4v4',
  perfil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  atletas: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.5a6.5 6.5 0 0 1 3 5.5',
  plantillas: 'M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
  biblioteca: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3',
  hecho: 'M5 12.5l4.5 4.5L19 7.5',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  atras: 'M15 5l-7 7 7 7',
  derecha: 'M9 5l7 7-7 7',
  abajo: 'M5 9l7 7 7-7',
  arriba: 'M5 15l7-7 7 7',
  cerrar: 'M6 6l12 12M18 6 6 18',
  video: 'M4 7.5A1.5 1.5 0 0 1 5.5 6h9A1.5 1.5 0 0 1 16 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16.5zM16 10.5l4-2.5v8l-4-2.5',
  mensaje: 'M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  alerta: 'M12 4 2.5 20h19zM12 10v4.5M12 17.5v.5',
  sinred: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.5-2.6M19 13a10 10 0 0 0-2.3-1.6M2 9.5a15 15 0 0 1 4-2.6M12 20h.01M22 9.5A15 15 0 0 0 12 6c-.7 0-1.4 0-2 .1',
  copiar: 'M9 9h10v11H9zM5 15V4h10',
  basura: 'M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4h6v3',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  salir: 'M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16l-4-4 4-4M6 12h10',
  descargar: 'M12 4v11M7 10.5l5 4.5 5-4.5M5 19h14',
  editar: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trofeo: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4',
  compartir: 'M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  chincheta: 'M9 3h6l-1 6 3 3H7l3-3zM12 12v9',
  enfoque: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  bascula: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 9.5a5 5 0 0 1 7 0M12 9.5l1.5-2',
  rayo: 'M13 3 5 13h6l-1 8 8-10h-6z',
  reloj: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M10 2.5h4',
  enlace: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  enviar: 'M4 12 20 4l-6 16-3-7z',
  candado: 'M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V12a1.5 1.5 0 0 1 1.5-1.5zM8 10.5V8a4 4 0 0 1 8 0v2.5',
  duplicar: 'M8 8h11v11H8zM5 16V5h11M13.5 11v5M11 13.5h5',
  play: 'M8 5.5v13l10.5-6.5z',
  reiniciar: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4.5h4.5',
  intercambiar: 'M4 8h14l-3.5-3.5M20 16H6l3.5 3.5',
  historial: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 4v4.5H8M12 7.5V12l3 2',
  calculadora: 'M6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3zM8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h3.5',
  camara: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  llama: 'M12 3c.8 3 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-2.3 1.2-3.6 2.3-4.6.1 1.9 1 3.1 2.2 3.3-.4-3 .3-5.4 0-7.7z',
  bandeja: 'M3.5 13H8l1.5 2.5h5L16 13h4.5M5.5 5h13l2 8v5.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V13z',
  escudo: 'M12 3l7 2.8v5.4c0 4.6-3 8.3-7 9.8-4-1.5-7-5.2-7-9.8V5.8zM9 12l2.2 2.2L15.5 10',
  diana: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
  regla: 'M3.5 16.5 16.5 3.5l4 4-13 13zM7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2',
  imagen: 'M5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15 9h.01',
  movil: 'M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3zM11 18h2',
  pregunta: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  altavoz: 'M4 10v4h3l5 4V6l-5 4zM16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10',
  pausa: 'M8 5v14M16 5v14',
  disco: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 6.5v1M12 16.5v1',
  ajustes: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  // v0.10: hábitos, plan, cámara e intervalos
  pasos: 'M8.5 3.5c1.6 0 2.5 1.7 2.5 4.2S10 12 8.5 12 6 10.2 6 7.7s.9-4.2 2.5-4.2zM6.5 14.5h4l-.4 2.7a1.6 1.6 0 0 1-3.2 0zM15.5 7.5c1.6 0 2.5 1.7 2.5 4.2S17 16 15.5 16 13 14.2 13 11.7s.9-4.2 2.5-4.2zM13.5 18.5h4l-.2 1a1.6 1.6 0 0 1-3.2 0z',
  proteina: 'M12 3c3.6 0 6.5 6.2 6.5 10.3a6.5 6.5 0 0 1-13 0C5.5 9.2 8.4 3 12 3zM9.5 14a2.5 2.5 0 0 0 2.5 2.5',
  agua: 'M12 3.5c3.2 4.2 6 7.4 6 10.7a6 6 0 0 1-12 0c0-3.3 2.8-6.5 6-10.7zM9 14.5a3 3 0 0 0 3 3',
  sueno: 'M19.5 14.8A8 8 0 1 1 9.2 4.5a6.5 6.5 0 0 0 10.3 10.3zM16 3.5h3l-3 3h3',
  movilidad: 'M12 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4 9.5l8 1.5 8-1.5M12 11v4.5l-4 5.5M12 15.5l4 5.5',
  verdura: 'M5 19.5C5 11 10 5 20 4.5 20 14 14 19.5 5.5 19.5zM5 19.5l8-8',
  libre: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  calendario: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4M12 12.5v5M9.5 15h5',
  girar: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM9 13a3 3 0 0 1 5.3-1.9M15 13a3 3 0 0 1-5.3 1.9M14.6 9.3v1.9h-1.9M9.4 16.7v-1.9h1.9',
  intervalos: 'M2.5 12h3.5l2-5.5 3.5 11 3-8 2 2.5h5',
  // v0.11: nutrición
  // v0.12: notificaciones
  campana: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0M12 3v2',
  nutricion: 'M13 18.5a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 4v4.5a1.5 1.5 0 0 0 3 0V4M4.5 9v11M21.5 4c-1.2.8-1.8 2.6-1.8 4.3V12h1.8v8',
  receta: 'M4 11h16v4.5A4.5 4.5 0 0 1 15.5 20h-7A4.5 4.5 0 0 1 4 15.5zM2.5 11h19M9 7.5c0-1.2 1-1.8 1-3M13 7.5c0-1.2 1-1.8 1-3',
  estrella: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  // v0.43: la comunidad del equipo
  equipo: 'M12 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6.5 20a5.5 5.5 0 0 1 11 0M5.5 11.5a2.3 2.3 0 1 1 0-4.6M18.5 11.5a2.3 2.3 0 1 0 0-4.6M2 18.5a4 4 0 0 1 2.8-3.8M22 18.5a4 4 0 0 0-2.8-3.8',
  opciones: 'M5.5 12h.6M11.7 12h.6M17.9 12h.6',
  bandera: 'M5.5 21V4M5.5 4.5h11.5l-2.2 4 2.2 4H5.5',
  guardar: 'M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z',
  ojo: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6zM4 20 20 4',
  carrito:'M3 4h2l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2M9.5 20h.01M17 20h.01',
  // v0.50: los ajustes del perfil
  tema: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18M12 7.5h3.6M12 12h5M12 16.5h3.6',
  letra: 'M3 19 8 5h1l5 14M4.8 14.5h7.4M15 19l2.6-7h.8L21 19M15.9 16.6h4.2',
  paleta: 'M12 3.5a8.5 8.5 0 1 0 0 17c1.1 0 1.6-.7 1.6-1.5 0-1.2-1.1-1.5-1.1-2.6 0-.9.7-1.4 1.6-1.4h2.4A4.5 4.5 0 0 0 21 10.5c0-3.9-4-7-9-7zM7.5 12h.01M9.5 8h.01M14.5 8h.01',
  vibrar: 'M9 4h6a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4.5 9v6M19.5 9v6M2 11v2M22 11v2',
  privacidad: 'M12 3l7 2.8v5.4c0 4.6-3 8.3-7 9.8-4-1.5-7-5.2-7-9.8V5.8zM12 10.5a1.8 1.8 0 1 0 0-.1M12 12.5v3',
  // v0.55: el chat (emojis, adjuntar, documento, reenviar, silenciar, el teclado y seleccionar)
  cara: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5s1.3 1.8 3.5 1.8 3.5-1.8 3.5-1.8M9 9.5h.01M15 9.5h.01',
  clip: 'M21.4 11.1l-8.5 8.5a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8',
  documento: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  reenviar: 'M15 5l6 6-6 6M21 11H9a6 6 0 0 0-6 6v2',
  silencio: 'M13.7 21a2 2 0 0 1-3.4 0M18.6 13A7.6 7.6 0 0 1 18 9a6 6 0 0 0-9.3-5M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M3 3l18 18',
  teclado: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 9h.01M11 9h.01M15 9h.01M7 13h.01M17 13h.01M11 13h2M8 16h8',
  seleccionar: 'M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9',
  // v0.56: notas de voz, encuestas y el editor de fotos
  micro: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6',
  parar: 'M7 7h10v10H7z',
  encuesta: 'M5 20V12M10 20V6M15 20v-9M20 20V9M3 20h18',
  recortar: 'M6 3v14a1 1 0 0 0 1 1h14M3 6h14a1 1 0 0 1 1 1v14',
  texto: 'M5 6V4h14v2M12 4v16M9 20h6',
  deshacer: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  // v0.63: borrar en el teclado de la serie (la tecla de retroceso)
  retroceso: 'M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7zM12.5 9.5l5 5M17.5 9.5l-5 5',
  // v0.64: cambiar el orden de la sesión (flechas arriba y abajo) y el asa para arrastrar (seis puntos)
  ordenar: 'M7 4v16M3.5 7.5L7 4l3.5 3.5M17 20V4M13.5 16.5L17 20l3.5-3.5',
  asa: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  hd: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM8 9v6M8 12h3M11 9v6M14 9v6h1a3 3 0 0 0 0-6z',
};

// Anillo de la semana: un segmento por sesión programada; los hechos, en morado
export function Anillo({ hechas, total, tam = 68 }) {
  const n = Math.max(1, total), R = 26, C = 2 * Math.PI * R;
  const seg = C / n, hueco = n > 1 ? Math.min(5, seg * 0.18) : 0;
  return (
    <svg class="anillo" viewBox="0 0 64 64" width={tam} height={tam} role="img" aria-label={`${hechas} de ${total} sesiones hechas esta semana`}>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx="32" cy="32" r={R} fill="none" stroke-width="8" class={i < hechas ? 'lleno' : 'vacio'}
          stroke-dasharray={`${seg - hueco} ${C - seg + hueco}`} stroke-dashoffset={-i * seg - hueco / 2} transform="rotate(-90 32 32)" />
      ))}
      <text x="32" y="37" text-anchor="middle" class="anillo-num">{hechas}/{total}</text>
    </svg>
  );
}

export function Icono({ n, titulo, ...resto }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden={titulo ? undefined : 'true'} role={titulo ? 'img' : undefined} {...resto}>
      {titulo && <title>{titulo}</title>}
      <path d={P[n]} />
    </svg>
  );
}

export function Marca() {
  return (
    <span class="marca">
      <img src={LOBO} alt="" width="28" height="28" aria-hidden="true" />
      FBE Equipo
    </span>
  );
}

// ---------------------------------------------------------------- piezas
// Avatar con iniciales: el color sale del nombre, así cada persona tiene siempre el mismo
export function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}
// Con foto de perfil (v0.19), la foto; sin ella, las iniciales en el color de su nombre
// ampliable: con foto, tocarla la abre en grande (v0.25). No usarlo dentro de otro botón.
// perfilId o deCoach (pulido 2.1): de quién es, para pedir su foto grande al ampliarla (en las listas va la miniatura)
export function Avatar({ nombre, clase = '', lleno = false, foto = null, ampliable = false, perfilId = null, deCoach = false }) {
  const [grande, setGrande] = useState(false);
  const [entera, setEntera] = useState(null);
  const app = useContext(Ctx);
  useEffect(() => {
    if (!grande || !(perfilId || deCoach) || !app?.api?.fotoGrande) return undefined;
    let vivo = true;
    Promise.resolve(app.api.fotoGrande(deCoach ? null : perfilId)).then((g) => { if (vivo && g) setEntera(g); }).catch(() => {});
    return () => { vivo = false; };
  }, [grande, perfilId, deCoach]);
  useEffect(() => { setEntera(null); }, [foto]);
  let h = 0;
  for (const ch of String(nombre || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = (h % 6) + 1;
  const conFoto = typeof foto === 'string' && foto.startsWith('data:image/');
  const circulo = (
    <span class={`avatar ${clase} ${lleno && !conFoto ? 'lleno' : ''} ${conFoto ? 'con-foto' : ''}`} style={{ '--av': `var(--av-${n})` }} aria-hidden="true">
      {conFoto ? <img src={foto} alt="" /> : iniciales(nombre)}
    </span>
  );
  if (!ampliable || !conFoto) return circulo;
  return (
    <>
      <button type="button" class="avatar-ampliable" onClick={() => setGrande(true)} aria-label={`Ver en grande la foto de ${nombre || 'perfil'}`}>{circulo}</button>
      {grande && (
        <Hoja titulo={nombre || 'Foto de perfil'} alCerrar={() => setGrande(false)}>
          <img class="foto-ampliada" src={entera || foto} alt={`Foto de perfil de ${nombre || ''}`} />
        </Hoja>
      )}
    </>
  );
}

export function Disco({ prioridad, titulo }) {
  return <span class={`disco ${prioridad}`} title={titulo} aria-hidden={titulo ? undefined : 'true'} />;
}

// El lobo de FBE dentro de un aro que gira (v0.29): el indicador de carga de toda la app
export function LoboCarga({ peq = false }) {
  return (
    <span class={`lobo-carga ${peq ? 'chico' : ''}`} aria-hidden="true">
      <svg viewBox={LOBO_CAJA}><path fill-rule="evenodd" d={LOBO_D} /></svg>
    </span>
  );
}

export function Cargando({ texto = 'Cargando' }) {
  return <div class="cargando" role="status"><LoboCarga /><span class="sr">{texto}</span></div>;
}

// Siluetas de carga: la forma de lo que va a aparecer, en gris, mientras llegan los datos.
// Aparecen con un pequeño retraso para no parpadear si los datos llegan enseguida.
const Linea = ({ w = '100%', h = 12, r }) => <span class="sil" style={{ width: w, height: `${h}px`, borderRadius: r }} />;
function FilaSilueta({ i = 0, icono = true, cola = true }) {
  const anchos = ['62%', '48%', '70%', '55%', '40%'];
  return (
    <div class={`sil-fila ${icono ? '' : 'sin-icono'}`}>
      {icono && <Linea w="34px" h={34} r="50%" />}
      <span class="sil-col"><Linea w={anchos[i % anchos.length]} h={14} /><Linea w={anchos[(i + 2) % anchos.length]} h={11} /></span>
      {cola && <Linea w="18px" h={18} r="6px" />}
    </div>
  );
}
function TarjetaSilueta({ i = 0, barra = false, filas = 2 }) {
  return (
    <div class="panel panel-pad sil-tarjeta">
      <Linea w={['58%', '44%', '66%'][i % 3]} h={16} />
      {Array.from({ length: filas }, (_, k) => <Linea key={k} w={k ? '72%' : '90%'} h={11} />)}
      {barra && <Linea w="100%" h={8} r="4px" />}
    </div>
  );
}
export function Siluetas({ forma = 'lista', n = 5, texto = 'Cargando' }) {
  let cuerpo;
  if (forma === 'hoy') {
    cuerpo = (
      <>
        <div class="sil-col"><Linea w="45%" h={12} /><Linea w="38%" h={34} r="8px" /></div>
        <div class="panel">{Array.from({ length: 5 }, (_, i) => <FilaSilueta key={i} i={i} cola={false} />)}</div>
        <Linea w="100%" h={54} r="14px" />
        <TarjetaSilueta i={1} />
      </>
    );
  } else if (forma === 'sesion') {
    cuerpo = (
      <>
        <div class="sil-col"><Linea w="42%" h={26} r="8px" /><Linea w="24%" h={12} /></div>
        {Array.from({ length: 3 }, (_, i) => <TarjetaSilueta key={i} i={i} filas={3} />)}
      </>
    );
  } else if (forma === 'tarjetas') {
    cuerpo = Array.from({ length: n }, (_, i) => <TarjetaSilueta key={i} i={i} barra={i % 2 === 0} />);
  } else if (forma === 'grafica') {
    cuerpo = (
      <>
        <Linea w="100%" h={36} r="12px" />
        <Linea w="100%" h={180} r="14px" />
        <div class="panel">{Array.from({ length: 3 }, (_, i) => <FilaSilueta key={i} i={i} icono={false} />)}</div>
      </>
    );
  } else if (forma === 'filas') {
    cuerpo = Array.from({ length: n }, (_, i) => <FilaSilueta key={i} i={i} />);
  } else if (forma === 'galeria') {
    cuerpo = <div class="galeria">{Array.from({ length: n }, (_, i) => <Linea key={i} w="100%" h={0} r="10px" />)}</div>;
  } else if (forma === 'formulario') {
    cuerpo = Array.from({ length: n }, (_, i) => <div key={i} class="sil-col"><Linea w={['30%', '42%', '26%'][i % 3]} h={12} /><Linea w="100%" h={46} r="12px" /></div>);
  } else {
    cuerpo = <div class="panel">{Array.from({ length: n }, (_, i) => <FilaSilueta key={i} i={i} />)}</div>;
  }
  // Al irse avisan a la portada de arranque, que espera a que la primera pantalla tenga sus datos
  useEffect(() => () => window.dispatchEvent(new Event('fbe-siluetas-fuera')), []);
  return (
    <div class={`siluetas sil-${forma}`} role="status" aria-live="polite">
      <div class="sil-marca"><LoboCarga peq /><span>{texto}</span></div>
      <div class="sil-cuerpo" aria-hidden="true">{cuerpo}</div>
    </div>
  );
}

// v0.50: con ilustracion (una de Ilustraciones.jsx), el dibujo de línea en lugar del icono; una frase y lo siguiente
export function Vacio({ icono = 'semana', ilustracion = null, titulo, children, accion }) {
  return (
    <div class={`vacio${ilustracion ? ' con-ilustracion' : ''}`}>
      {ilustracion ? <Ilustracion n={ilustracion} /> : <Icono n={icono} />}
      <p class="vacio-titulo">{titulo}</p>
      {children && <p>{children}</p>}
      {accion}
    </div>
  );
}

export function ErrorCaja({ error, reintentar }) {
  if (!error) return null;
  return (
    <div class="error" role="alert">
      {error.message || String(error)}
      {reintentar && <> <button class="btn-texto" onClick={reintentar}>Reintentar</button></>}
    </div>
  );
}

// Número con − y +; acepta coma decimal y punto de miles al teclear («8.000» son ocho mil). Al salir del
// campo, lo escrito se ordena: «80,55» con un decimal queda «80,6», que es lo que se guarda.
export function Paso({ valor, alCambiar, paso = 1, min = 0, max = 9999, dec = 1, etiqueta, id }) {
  const [texto, setTexto] = useState(valor == null ? '' : num(valor, dec));
  // Solo cuando el valor cambia desde fuera (no al montar: si se escribe nada más abrir, se borraría lo escrito)
  const montado = useRef(false);
  // Mientras se teclea, el valor se va pasando (para que «Guardar» se active sin tener que salir del campo),
  // pero lo escrito no se reescribe hasta salir de él
  const tecleando = useRef(false);
  useEffect(() => { if (montado.current && !tecleando.current) setTexto(valor == null ? '' : num(valor, dec)); montado.current = true; }, [valor]);
  const fijar = (v) => {
    if (v === null || Number.isNaN(v)) { setTexto(''); alCambiar(null); return; }
    const f = 10 ** dec;
    const c = Math.min(max, Math.max(min, Math.round(v * f) / f));
    setTexto(num(c, dec));
    alCambiar(c);
  };
  const alTeclear = (t) => {
    setTexto(t);
    tecleando.current = true;
    const v = leerNumero(t);
    alCambiar(v !== null && v >= min && v <= max ? Math.round(v * 10 ** dec) / 10 ** dec : null);
  };
  return (
    <div class="paso">
      <button type="button" aria-label={`Restar ${num(paso)} a ${etiqueta}`} onClick={() => fijar((valor ?? 0) - paso)}>−</button>
      <input id={id} inputMode="decimal" aria-label={etiqueta} value={texto} enterKeyHint="done"
        onInput={(e) => alTeclear(e.currentTarget.value)}
        onBlur={() => { tecleando.current = false; fijar(leerNumero(texto)); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        onFocus={(e) => e.currentTarget.select()} />
      <button type="button" aria-label={`Sumar ${num(paso)} a ${etiqueta}`} onClick={() => fijar((valor ?? 0) + paso)}>+</button>
    </div>
  );
}

// Control segmentado: opciones [[valor, texto]]
export function Segmentos({ opciones, valor, alCambiar, etiqueta, clase = '' }) {
  return (
    <div class={`segmentos ${clase}`} role="group" aria-label={etiqueta}>
      {opciones.map(([v, t, ayuda]) => (
        <button type="button" key={String(v)} data-v={v} aria-pressed={valor === v ? 'true' : 'false'} title={ayuda}
          onClick={(ev) => alCambiar(valor === v ? null : v, ev)}>{t}</button>
      ))}
    </div>
  );
}

// Pestañas accesibles: una pestaña activa en el orden de tabulación y las flechas (Inicio y Fin) para moverse
export function Pestanas({ opciones, valor, alCambiar, etiqueta, clase = '', idBase = 'pest' }) {
  const tecla = (e) => {
    const i = opciones.findIndex(([id]) => id === valor);
    const n = opciones.length;
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    const lista = e.currentTarget;
    alCambiar(opciones[j][0]);
    setTimeout(() => lista.querySelector(`#${idBase}-${opciones[j][0]}`)?.focus(), 0);
  };
  return (
    <div class={`pestanas ${clase}`} role="tablist" aria-label={etiqueta} onKeyDown={tecla}>
      {opciones.map(([id, t]) => (
        <button key={id} id={`${idBase}-${id}`} type="button" role="tab" aria-selected={valor === id ? 'true' : 'false'} aria-controls={`${idBase}-panel`}
          tabIndex={valor === id ? 0 : -1} onClick={() => alCambiar(id)}>{t}</button>
      ))}
    </div>
  );
}

// Diálogo como hoja inferior (en el móvil) o centrado (en pantallas anchas). Escape y velo lo cierran.
// Tab y Mayús+Tab no salen de la ventana de encima (como en un diálogo nativo): al pasar del último control
// se vuelve al primero. ref es el elemento con aria-modal; con varias abiertas, solo actúa la de encima.
const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function useAtraparFoco(ref) {
  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== 'Tab' || !ref.current) return;
      const modales = document.querySelectorAll('[aria-modal="true"]');
      if (modales.length && modales[modales.length - 1] !== ref.current) return;
      const lista = [...ref.current.querySelectorAll(ENFOCABLES)].filter((el) => el.getClientRects().length && !el.closest('[inert]'));
      if (!lista.length) { e.preventDefault(); return; }
      const primero = lista[0], ultimo = lista[lista.length - 1], activo = document.activeElement;
      const dentro = ref.current.contains(activo);
      if (e.shiftKey && (activo === primero || !dentro)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && (activo === ultimo || !dentro)) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
}

// v0.50: las capas que tapan la pantalla (hojas y pantallas completas) se pintan en <body>, fuera de la página: así un
// antepasado con transform (una tarjeta que se desliza, una transición) nunca las encierra en su caja, y los gestos
// de la página no reciben lo que pasa dentro de ellas.
// (sin preact/compat: importarlo cambia el onChange de todos los campos por onInput. Es lo mismo que hace su portal:
// pintar en un nodo propio de <body> con el contexto de la app, para que useApp siga funcionando dentro)
class ConContexto extends Component {
  getChildContext() { return this.props.contexto; }
  render({ children }) { return children; }
}
export class Capa extends Component {
  componentDidMount() {
    this.nodo = document.createElement('div');
    this.nodo.className = 'capa';
    document.body.appendChild(this.nodo);
    this.pintar();
  }
  componentDidUpdate() { this.pintar(); }
  componentWillUnmount() { pintarEn(null, this.nodo); this.nodo.remove(); }
  pintar() { pintarEn(h(ConContexto, { contexto: this.context }, this.props.children), this.nodo); }
  render() { return null; }
}

// v0.52: con física de muelle (como Apple Maps o Things 3). En el móvil, arrastrar desde el asa o el título sigue al dedo
// 1:1 (por encima de la hoja completa, con goma); al soltar se proyecta adónde iría con su velocidad y se va al tope
// más cercano (completa, media o cerrada) con un muelle (logica/muelle.js) que corre como animación de la Web Animations
// API (solo transform, por el compositor). medio: las hojas largas abren en el tope medio (~55 % de la pantalla, con su
// contenido desplazable dentro) y se suben a completa. Escape, el foco atrapado y su vuelta al cerrar, como siempre.
const leerY = (el) => { try { return new DOMMatrixReadOnly(getComputedStyle(el).transform).m42 || 0; } catch { return 0; } };
// v0.52 (revisión): la hoja va dentro de su capa (no al revés): así, cuando corren sus efectos, el diálogo ya existe y
// el foco entra en él al abrirse (desde la v0.50, con la capa por fuera, se quedaba en el botón que la abría)
export function Hoja(props) { return <Capa><HojaDentro {...props} /></Capa>; }
function HojaDentro({ titulo, alCerrar: alCerrarProp, children, ancho, medio = false, clase = '' }) {
  const ref = useRef(null);
  useAtraparFoco(ref);
  const arrastre = useRef(null);
  const animacion = useRef(null);
  // Siempre la versión actual de alCerrar (puede cambiar mientras está abierta: «no cerrar mientras sube el vídeo»)
  const cerrarRef = useRef(alCerrarProp);
  cerrarRef.current = alCerrarProp;
  const alCerrar = () => cerrarRef.current?.();
  // En cuanto se monta (no tras pintar), para que el foco y Escape funcionen desde el primer instante
  useLayoutEffect(() => {
    const previo = document.activeElement;
    // Con varias hojas abiertas, Escape cierra solo la de encima
    const tecla = (e) => {
      if (e.key !== 'Escape') return;
      // Solo la ventana de encima: la última abierta (otra hoja, la búsqueda rápida…) se cierra antes
      const modales = document.querySelectorAll('[aria-modal="true"]');
      if (modales.length && modales[modales.length - 1] !== ref.current) return;
      alCerrar();
    };
    document.addEventListener('keydown', tecla);
    // El primer control (que no sea «Cerrar»); si no hay otro, el propio diálogo (tabIndex −1)
    const foco = ref.current?.querySelector('input, select, textarea, button:not(.cerrar-hoja)');
    (foco || ref.current)?.focus({ preventScroll: true });
    // La página de detrás no se desplaza mientras haya alguna hoja abierta (se cuentan, por si hay una encima de otra)
    const cuerpo = document.body;
    cuerpo.dataset.hojas = String(Number(cuerpo.dataset.hojas || 0) + 1);
    cuerpo.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      const quedan = Math.max(0, Number(cuerpo.dataset.hojas || 1) - 1);
      if (quedan) cuerpo.dataset.hojas = String(quedan);
      else { delete cuerpo.dataset.hojas; cuerpo.style.overflow = ''; }
      previo?.focus?.();
    };
  }, []);

  // v0.52: las hojas largas abren en el tope medio (en el móvil): su alto, el 55 % de la pantalla, con el contenido
  // desplazable dentro; arrastrando el asa se suben a completa
  const movil = () => !window.matchMedia('(min-width: 700px)').matches;
  // (el tope medio se pone en cuanto el elemento existe, antes de pintarse y antes de los efectos)
  const medioRef = useRef(medio);
  const ponerRef = useCallback((hoja) => {
    ref.current = hoja;
    if (!hoja || hoja.dataset.muelle) return;
    hoja.dataset.muelle = '1';
    hoja.style.setProperty('--alto-medio', `${Math.round(window.innerHeight * FRACCION_MEDIA)}px`);
    if (medioRef.current && movil()) hoja.classList.add('en-medio');
  }, []);
  useLayoutEffect(() => () => { try { animacion.current?.cancel(); } catch { /* */ } animacion.current = null; }, []);
  // Lleva la hoja de «desde» a su tope con el muelle (la velocidad, la del dedo). Al acabar, deja el estado en reposo:
  // completa (sin transform), media (con su alto medio, sin transform) o cerrada (se cierra).
  const asentar = (hoja, desde, destino, velocidad) => {
    const velo = hoja.parentElement;
    const fin = () => {
      animacion.current = null;
      if (destino.tope === 'cerrada') { alCerrar(); return; }
      hoja.style.transform = '';
      if (destino.tope === 'media') hoja.classList.add('en-medio');
      velo.classList.remove('soltando');
    };
    velo.classList.add('soltando');
    if (destino.tope === 'cerrada') velo.classList.add('cerrando'); else velo.style.removeProperty('--velo');
    if (sinMovimiento()) { fin(); return; }
    const { puntos, duracion } = fotogramasMuelle({ desde, hasta: destino.y, velocidad, ...MUELLE });
    hoja.style.transform = `translateY(${destino.y}px)`;
    try {
      const anim = hoja.animate(puntos.map((y) => ({ transform: `translateY(${y.toFixed(2)}px)` })), { duration: Math.max(16, duracion), easing: 'linear' });
      animacion.current = anim;
      anim.onfinish = () => { if (animacion.current === anim) fin(); };
    } catch { fin(); }
  };
  const alBajar = (e) => {
    if (!movil() || e.button > 0) return;
    if (e.target.closest('button, a, input, select, textarea')) return;
    const hoja = ref.current;
    // Si se coge a medio camino (aún asentándose), se sigue desde donde está
    let y = leerY(hoja);
    try { animacion.current?.cancel(); } catch { /* */ }
    animacion.current = null;
    // Desde el tope medio, la hoja pasa a su alto completo (una sola vez, al empezar) desplazada lo mismo: no se mueve
    if (hoja.classList.contains('en-medio')) {
      const antes = hoja.getBoundingClientRect().top;
      hoja.classList.remove('en-medio');
      hoja.style.transform = '';
      y = antes - hoja.getBoundingClientRect().top;
    }
    hoja.style.transform = y ? `translateY(${y}px)` : '';
    const t = performance.now();
    arrastre.current = { y0: e.clientY, base: y, y, alto: hoja.offsetHeight, muestras: [{ y, t }] };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
  };
  const alMover = (e) => {
    const a = arrastre.current;
    if (!a) return;
    a.y = a.base + (e.clientY - a.y0);
    a.muestras.push({ y: a.y, t: performance.now() });
    if (a.muestras.length > 12) a.muestras.shift();
    const visible = arrastreVisible(a.y, a.alto);
    ref.current.style.transform = visible ? `translateY(${visible}px)` : '';
    ref.current.parentElement.style.setProperty('--velo', String(Math.max(0, 1 - Math.max(0, visible) / Math.max(320, a.alto))));
  };
  const alSoltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    const hoja = ref.current;
    if (!a || !hoja) return;
    // (al soltar tras una pausa, la velocidad es la de ese momento: casi nada)
    a.muestras.push({ y: a.y, t: performance.now() });
    const velocidad = velocidadDe(a.muestras);
    const desde = arrastreVisible(a.y, a.alto);
    asentar(hoja, desde, destinoHoja({ y: desde, velocidad, alto: a.alto, pantalla: window.innerHeight, medio }), velocidad);
  };
  return (
    <div class="velo" onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div class={`hoja-dialogo${clase ? ` ${clase}` : ''}`} role="dialog" aria-modal="true" aria-label={titulo} ref={ponerRef} tabIndex={-1} style={ancho ? { width: `min(${ancho}px, 100%)` } : undefined}>
        <div class="hoja-cab" onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}>
          <div class="asa" aria-hidden="true" />
          <div class="separa">
            <h2>{titulo}</h2>
            <button class="btn btn-icono plano cerrar-hoja" onClick={alCerrar} aria-label="Cerrar"><Icono n="cerrar" /></button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// Carga asíncrona con estado
// (pulido 4) recuerdo: una clave para recordar, mientras la app esté abierta, lo último que se cargó. Al volver a esa
// pantalla se enseña al momento lo recordado y se pone al día por detrás, sin esqueletos (como hacen las apps del
// móvil al volver a una lista). Solo en memoria: no se guarda nada en el dispositivo y se olvida al salir de la cuenta.
// Lo recordado deja de valer en cuanto se escribe algo desde este dispositivo («fbe-escritura», de datos/api.js): lo
// que se acaba de cambiar no se enseña como estaba antes, se vuelve a cargar. (Lo que cambie otra persona llega con la
// puesta al día de detrás.)
// (pulido 2.3) Reserva: el hueco de lo que llega tarde. Un bloque que no pinta nada hasta que carga (los avisos del
// coach, «Tu día», una tarjeta) empujaba hacia abajo todo lo que ya se estaba viendo. Envuelto en <Reserva id="…">,
// este dispositivo recuerda cuánto ocupó la última vez y, mientras carga, le guarda ese sitio (una silueta si aún no
// hay nada; solo el espacio que falta si ya hay algo y va a crecer): lo de debajo no se mueve. Con lo cargado, el
// hueco se quita y se apunta lo que ocupa ahora (0 si al final no pinta nada: la próxima vez no se le guarda sitio).
// La envoltura no tiene caja (display: contents): los hijos siguen siendo hijos, a efectos de diseño, de quien los
// contenía. Sabe que algo carga por las cargas (useCarga) de dentro, o porque se le dice (cargando).
const CtxReserva = createContext(null);
const CLAVE_ALTOS = 'fbe-altos';
const MAX_ALTOS = 160;
let altos = null, guardarAltosT = null;
const altosGuardados = () => {
  if (!altos) { try { altos = JSON.parse(localStorage.getItem(CLAVE_ALTOS) || '{}') || {}; } catch { altos = {}; } if (typeof altos !== 'object' || Array.isArray(altos)) altos = {}; }
  return altos;
};
const apuntarAlto = (clave, alto, conCero = false) => {
  const a = altosGuardados();
  if (a[clave] === alto || (!alto && !conCero && !(clave in a))) return;
  delete a[clave];
  if (alto > 0 || conCero) a[clave] = alto;   // (lo último apuntado, al final: al podar se van los más viejos)
  clearTimeout(guardarAltosT);
  guardarAltosT = setTimeout(() => {
    try {
      const claves = Object.keys(a);
      for (const k of claves.slice(0, Math.max(0, claves.length - MAX_ALTOS))) delete a[k];
      localStorage.setItem(CLAVE_ALTOS, JSON.stringify(a));
    } catch { /* sin sitio: no se recuerda */ }
  }, 600);
};
// liso: el hueco no pinta silueta (para dentro de una tarjeta de color). inicial: el sitio que se guarda la primera
// vez, cuando aún no se sabe cuánto ocupa (solo para lo que siempre sale y siempre ocupa más o menos lo mismo).
export function Reserva({ id, cargando = false, liso = false, inicial = 0, clase = '', children }) {
  const app = useContext(Ctx);
  const clave = `${String(app?.api?.uid?.() || '').slice(0, 8)}:${id}`;
  const caja = useRef(null);
  const reg = useRef(null);
  if (!reg.current) reg.current = { cargas: new Map(), revisar: () => {} };
  reg.current.revisar = () => {
    const el = caja.current;
    const hueco = el?.lastElementChild;
    if (!el || !hueco) return;
    let arriba = Infinity, abajo = -Infinity;
    for (const h of el.children) {
      if (h === hueco) continue;
      const r = h.getBoundingClientRect();
      if (r.height > 0) { arriba = Math.min(arriba, r.top); abajo = Math.max(abajo, r.bottom); }
    }
    const actual = abajo > arriba ? Math.round(abajo - arriba) : 0;
    const carga = cargando || [...reg.current.cargas.values()].some(Boolean);
    let falta = 0;
    if (carga) {
      // (el hueco, con algo ya pintado, es un hijo más de la rejilla o la pila que lo contiene: lleva su separación.
      // Se busca el primer antepasado con caja: los de display: contents no cuentan)
      let caja0 = el.parentElement;
      while (caja0 && caja0.parentElement && getComputedStyle(caja0).display === 'contents') caja0 = caja0.parentElement;
      const separa = actual > 0 && caja0 ? parseFloat(getComputedStyle(caja0).rowGap) || 0 : 0;
      falta = (altosGuardados()[clave] ?? inicial) - actual - separa;
    } else apuntarAlto(clave, actual, inicial > 0);
    if (falta > 8) { hueco.style.height = `${Math.round(falta)}px`; hueco.dataset.hueco = actual > 0 || liso ? 'resto' : 'entero'; }
    else if (hueco.dataset.hueco) { hueco.style.height = ''; delete hueco.dataset.hueco; }
  };
  useLayoutEffect(() => { reg.current.revisar(); });
  return (
    <CtxReserva.Provider value={reg.current}>
      <div class={clase ? `reserva ${clase}` : 'reserva'} ref={caja}>{children}<div class="reserva-hueco" aria-hidden="true" /></div>
    </CtxReserva.Provider>
  );
}

const recuerdos = new Map();
let escrituras = 0;
export function olvidarRecuerdos() { escrituras++; recuerdos.clear(); }
if (typeof window !== 'undefined') window.addEventListener('fbe-escritura', olvidarRecuerdos);
export function useCarga(fn, deps = [], opciones = {}) {
  const { recuerdo = null } = opciones;
  const recordado = () => (recuerdo && recuerdos.has(recuerdo) ? recuerdos.get(recuerdo) : null);
  const [estado, setEstado] = useState(() => { const datos = recordado(); return { datos, error: null, cargando: datos == null }; });
  const vivo = useRef(true);
  const ultima = useRef(0); // solo vale la respuesta de la última petición (si llegan desordenadas, las viejas se tiran)
  const claveRecuerdo = useRef(recuerdo);
  claveRecuerdo.current = recuerdo;
  // (pulido 5) alMomento: un cambio que se ve al instante mientras se guarda por detrás. base: lo último que dijo la
  // base; pendientes: los cambios en pantalla que aún se están guardando (se vuelven a poner encima de lo que llegue)
  const base = useRef(estado.datos);
  const pendientes = useRef([]);
  const conPendientes = (datos) => (datos == null ? datos : pendientes.current.reduce((d, c) => c(d), datos));
  // (pulido 2.3) dentro de una <Reserva>, le dice si está cargando (para que guarde el sitio) y cuándo llega algo
  const reserva = useContext(CtxReserva);
  const yo = useRef(null);
  if (!yo.current) yo.current = {};
  if (reserva) reserva.cargas.set(yo.current, estado.cargando);
  useLayoutEffect(() => { reserva?.revisar(); }, [reserva, estado.datos, estado.cargando, estado.error]);
  useEffect(() => () => { reserva?.cargas.delete(yo.current); }, [reserva]);
  const cargar = useCallback(async (silencioso = false) => {
    const n = ++ultima.current;
    const clave = claveRecuerdo.current;
    const antes = escrituras;
    if (!silencioso) setEstado((e) => ({ ...e, cargando: true, error: null }));
    try {
      const datos = await fn();
      // (solo se recuerda lo que se cargó entero sin que se escribiera nada mientras)
      if (clave && datos != null && antes === escrituras) recuerdos.set(clave, datos);
      if (vivo.current && n === ultima.current) { base.current = datos; setEstado({ datos: conPendientes(datos), error: null, cargando: false }); }
    } catch (error) {
      reportarError(error, 'carga');
      if (vivo.current && n === ultima.current) setEstado((e) => ({ ...e, error, cargando: false }));
    }
  }, deps);
  const primera = useRef(true);
  useEffect(() => {
    vivo.current = true;
    // Con algo recordado, se pone al día en silencio; si lo que se pide cambia (otra clave), se enseña lo de la nueva
    const datos = recordado();
    if (!primera.current && recuerdo) { base.current = datos; setEstado({ datos, error: null, cargando: datos == null }); }
    primera.current = false;
    cargar(datos != null);
    return () => { vivo.current = false; };
  }, [cargar]);
  // (pulido 9) «tirar para recargar» (ui/tirar.js) pide a todas las cargas montadas que se repitan en silencio, y espera
  // a que acaben. tirar: false deja fuera una carga que no es una simple consulta (p. ej., la que crea una invitación)
  const conTirar = opciones.tirar !== false;
  useEffect(() => {
    if (!conTirar) return undefined;
    const al = (e) => { const pr = cargar(true); e.detail?.esperas?.push(pr); };
    window.addEventListener('fbe-recargar', al);
    return () => window.removeEventListener('fbe-recargar', al);
  }, [cargar, conTirar]);
  // (v0.65) copia: la clave de la copia del móvil de lo que se carga (datos/copia.js). Si se enseñó la copia porque la base
  // tardaba, lo de la base llega luego con «fbe-copia» y se pone en su sitio, sin recargar. transformar: lo mismo que haría fn
  // con lo que llega de la base (lo que espera en la cola, encima)
  const { copia = null, transformar = null } = opciones;
  useEffect(() => {
    if (!copia) return undefined;
    const al = (e) => {
      if (e.detail?.clave !== copia || !vivo.current) return;
      ultima.current++;
      base.current = transformar ? transformar(e.detail.datos) : e.detail.datos;
      setEstado({ datos: conPendientes(base.current), error: null, cargando: false });
    };
    window.addEventListener('fbe-copia', al);
    return () => window.removeEventListener('fbe-copia', al);
  }, [copia]);
  // alMomento(cambio, guardar): `cambio` (lo cargado → lo cargado con el cambio hecho) se ve ya; `guardar` lo manda a
  // la base. Si falla, se deshace solo ese cambio y el error sigue hacia quien llamó (que avisa); cuando no queda
  // ninguno guardándose, se recarga en silencio para quedarse con lo que diga la base. El cambio tiene que dar lo
  // mismo si se aplica dos veces (poner un valor, no «darle la vuelta»): se repone encima de lo que vaya llegando.
  const alMomento = useCallback(async (cambio, guardar) => {
    pendientes.current = [...pendientes.current, cambio];
    setEstado((e) => (e.datos == null ? e : { ...e, datos: cambio(e.datos) }));
    let guardado = false;
    try { const r = await guardar(); guardado = true; return r; } finally {
      pendientes.current = pendientes.current.filter((c) => c !== cambio);
      if (guardado && base.current != null) base.current = cambio(base.current);
      if (vivo.current) {
        setEstado((e) => (e.datos == null ? e : { ...e, datos: conPendientes(base.current) }));
        if (!pendientes.current.length) cargar(true);
      }
    }
  }, [cargar]);
  return { ...estado, recargar: cargar, alMomento };
}

// Evita el doble envío (dos toques seguidos en «Guardar» o «Crear»): mientras la acción está en marcha no se repite
export function useUnaVez() {
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);
  const una = useCallback(async (fn) => {
    if (enCurso.current) return undefined;
    enCurso.current = true; setOcupado(true);
    try { return await fn(); } finally { enCurso.current = false; setOcupado(false); }
  }, []);
  return [ocupado, una];
}

// Avisa cuando cambia el día (la app abierta toda la noche, o al volver a ella por la mañana)
export function useCambioDeDia(alCambiar) {
  const dia = useRef(hoyISO());
  const fn = useRef(alCambiar);
  fn.current = alCambiar;
  useEffect(() => {
    const mirar = () => { const h = hoyISO(); if (h !== dia.current) { dia.current = h; fn.current(h); } };
    const visible = () => { if (document.visibilityState === 'visible') mirar(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', mirar);
    const t = setInterval(mirar, 60000);
    return () => { document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', mirar); clearInterval(t); };
  }, []);
}

// ---------------------------------------------------------------- navegación (v0.49)
// Título grande al estilo iOS: arriba, grande y con su subtítulo; al bajar, se compacta en una barra pequeña que se
// queda pegada. Sin escuchar el scroll: un IntersectionObserver vigila una marca invisible a unos 40 px del principio.
// Al compactarse, la cabecera deja un margen igual a lo que encoge, para que lo de debajo no salte.
// (Sin IntersectionObserver, se queda grande, como antes.)
export function CabeceraGrande({ clase = '', children }) {
  const cab = useRef(null);
  const alto = useRef(0);
  const [compacta, setCompacta] = useState(false);
  // v0.53.2: con el scroll y con histéresis (se compacta pasados 56 px y solo vuelve a grande por debajo de 12 px). Antes,
  // con un IntersectionObserver, en una página apenas más alta que la pantalla (Semana con un título largo) el cambio de
  // tamaño y el ajuste de scroll del navegador se realimentaban: al llegar al final, la cabecera se encogía, la página
  // ya no daba para tanto, volvía a crecer… y la pantalla se quedaba temblando. Ahora, además, si la página no da para
  // compactarse con holgura (lo que encoge + 56 px), no se compacta.
  useEffect(() => {
    let raf = 0;
    const mirar = () => {
      raf = 0;
      const h = cab.current;
      if (!h) return;
      const y = window.scrollY;
      setCompacta((c) => {
        if (c) return y > 12;
        if (y <= 56) return false;
        const grande = h.offsetHeight;
        const sobra = document.documentElement.scrollHeight - window.innerHeight;
        if (sobra < 56 + Math.max(0, grande - 56) + 40) return false;
        alto.current = grande;
        return true;
      });
    };
    const alScroll = () => { if (!raf) raf = requestAnimationFrame(mirar); };
    window.addEventListener('scroll', alScroll, { passive: true });
    mirar();
    return () => { window.removeEventListener('scroll', alScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  // Mientras cambia de tamaño, sin el «anclaje de scroll» del navegador: al encoger la cabecera, Chrome reajustaba el
  // scroll para mantener a la vista lo que tenía delante y, en Semana, lo devolvía arriba del todo (y vuelta a crecer)
  const primera = useRef(true);
  useLayoutEffect(() => {
    const h = cab.current;
    if (!h) return undefined;
    const raiz = document.documentElement;
    const antes = raiz.style.overflowAnchor;
    if (!primera.current) raiz.style.overflowAnchor = 'none';
    primera.current = false;
    h.style.marginBottom = compacta && alto.current ? `${Math.max(0, alto.current - h.offsetHeight)}px` : '';
    const t = setTimeout(() => { raiz.style.overflowAnchor = antes; }, 400);
    return () => { clearTimeout(t); raiz.style.overflowAnchor = antes; };
  }, [compacta]);
  // Diseño, tanda 10: el título va grande si cabe en una línea en el sitio que le deja la fila; si no, al tamaño de las
  // demás cabeceras (clase `titulo-justo`). Solo esos dos tamaños. Se mide antes de pintar con una copia invisible a
  // tamaño grande (`.titulo-medida`, fuera de la cabecera), y otra vez cuando cambia la fila, el texto o la ventana.
  const [justo, setJusto] = useState(false);
  useLayoutEffect(() => {
    const h = cab.current;
    if (!h || compacta) return undefined;
    const medir = () => {
      const h1 = h.querySelector('.titulo h1');
      if (!h1 || !h1.clientWidth) return;
      const copia = document.createElement('span');
      copia.className = 'titulo-medida';
      copia.setAttribute('aria-hidden', 'true');
      copia.textContent = h1.textContent;
      document.body.appendChild(copia);
      const ancho = copia.getBoundingClientRect().width;
      copia.remove();
      setJusto(ancho > h1.clientWidth + 0.5);
    };
    medir();
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(medir);
    mo?.observe(h, { childList: true, subtree: true, characterData: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    ro?.observe(h);
    document.fonts?.ready?.then(medir).catch(() => {});
    return () => { mo?.disconnect(); ro?.disconnect(); };
  }, [compacta]);
  return (
    <header ref={cab} class={`cabecera cabecera-grande${compacta ? ' compacta' : ''}${justo ? ' titulo-justo' : ''}${clase ? ` ${clase}` : ''}`}>{children}</header>
  );
}

// La píldora de la pestaña activa en la barra de abajo: un solo elemento que se desliza hasta el icono elegido.
// Se coloca midiendo el icono (así da igual cuántas pestañas haya o cuáles estén ocultas a ese ancho); la primera
// vez, sin animación.
export function usePildora(clave) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const cont = ref.current;
    const pild = cont?.querySelector('.tabs-pildora');
    if (!pild) return undefined;
    const colocar = () => {
      const ico = cont.querySelector('.tab[aria-current="page"] .tab-ico');
      if (!ico || !ico.getClientRects().length) { pild.style.opacity = '0'; return; }
      const a = ico.getBoundingClientRect(), b = cont.getBoundingClientRect();
      pild.style.opacity = '';
      pild.style.width = `${a.width}px`;
      pild.style.height = `${a.height}px`;
      pild.style.transform = `translate(${Math.round(a.left - b.left)}px, ${Math.round(a.top - b.top)}px)`;
    };
    colocar();
    const t = requestAnimationFrame(() => { pild.dataset.lista = '1'; });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(colocar) : null;
    ro?.observe(cont);
    return () => { cancelAnimationFrame(t); ro?.disconnect(); };
  }, [clave]);
  return ref;
}

// Ancho real (en px) de un elemento: las gráficas dibujan a su tamaño para que los textos no crezcan en pantallas anchas
export function useAncho(inicial = 340) {
  const [ancho, setAncho] = useState(inicial);
  const obs = useRef(null);
  // Ref de función: se engancha cuando el elemento aparece (aunque sea después de cargar los datos)
  const ref = useCallback((el) => {
    obs.current?.disconnect();
    obs.current = null;
    if (!el) return;
    const medir = (w) => { const x = Math.round(w); if (x >= 160) setAncho((a) => (Math.abs(a - x) > 1 ? x : a)); };
    medir(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    obs.current = new ResizeObserver(([e]) => medir(e.contentRect.width));
    obs.current.observe(el);
  }, []);
  useEffect(() => () => obs.current?.disconnect(), []);
  return [ancho, ref];
}

// ---------------------------------------------------------------- gráficas de línea (v0.49: táctiles)
// Arrastrando el dedo (o el ratón) por la gráfica sale una guía vertical con la fecha y el valor de ese punto; con el
// teclado, la gráfica es un deslizador (flechas, Inicio y Fin). Debajo de la línea, un degradado suave; los récords
// (donde se pide) van marcados. Para los lectores de pantalla, un resumen en texto.
function useRaspado(n, xs) {
  const [sel, setSel] = useState(null);
  const tocando = useRef(false);
  const caja = useRef(null);
  useEffect(() => { if (sel != null && sel >= n) setSel(null); }, [n]);
  // v0.52 (revisión): si la gráfica cambia a menos puntos (otro rango) con un punto elegido, en este mismo pintado ese
  // punto ya no existe: se ignora aquí (el efecto de arriba lo quita después), nunca se lee fuera de los datos
  const selOk = seleccionValida(sel, n);
  const desde = (e) => {
    const svg = caja.current?.querySelector('svg');
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const x = ((e.clientX - r.left) / Math.max(1, r.width)) * (vb?.width || r.width);
    setSel(puntoMasCercano(xs, x));
  };
  const eventos = {
    onPointerDown: (e) => { tocando.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } desde(e); },
    onPointerMove: (e) => { if (tocando.current || e.pointerType === 'mouse') desde(e); },
    onPointerUp: () => { tocando.current = false; },
    onPointerCancel: () => { tocando.current = false; },
    onPointerLeave: (e) => { if (e.pointerType === 'mouse' && !tocando.current) setSel(null); },
    onKeyDown: (e) => {
      const actual = selOk ?? n - 1;
      const sig = { ArrowLeft: actual - 1, ArrowDown: actual - 1, ArrowRight: actual + 1, ArrowUp: actual + 1, Home: 0, End: n - 1 }[e.key];
      if (sig == null) return;
      e.preventDefault();
      setSel(Math.max(0, Math.min(n - 1, sig)));
    },
    onBlur: () => { if (!tocando.current) setSel(null); },
  };
  return { sel: selOk, eventos, caja };
}

// La caja de una gráfica: el deslizador accesible, la etiqueta flotante del punto elegido y el resumen en texto
function CajaGrafica({ raspado, n, W, xs, ys, etiqueta, textoPunto, resumen, children }) {
  const { sel, eventos, caja } = raspado;
  const i = sel ?? n - 1;
  const izq = sel == null ? 0 : Math.max(0, Math.min(100, (xs[sel] / W) * 100));
  return (
    <div class="grafica-caja" ref={caja}>
      <div class="grafica-tactil" role="slider" tabIndex={0} aria-label={etiqueta} aria-valuemin="1" aria-valuemax={n} aria-valuenow={i + 1}
        aria-valuetext={textoPunto(i)} {...eventos}>
        {children}
        {sel != null && (
          <div class={`grafica-globo ${izq > 70 ? 'a-la-izq' : izq < 30 ? 'a-la-der' : ''}`} style={{ left: `${izq}%`, top: `${Math.max(0, ys[sel] - 8)}px` }} aria-hidden="true">
            {textoPunto(sel)}
          </div>
        )}
      </div>
      <p class="sr">{resumen}</p>
    </div>
  );
}

// v0.52: al cambiar de rango (o de ejercicio), la línea pasa de la forma vieja a la nueva (como en Revolut o Robinhood):
// los dos trazos, remuestreados a los mismos puntos, se mezclan durante ~0,5 s cambiando el atributo «d» (sin volver a
// pintar el componente). Los puntos se esconden mientras tanto. Con «reducir movimiento», el cambio es inmediato.
// clave: lo que, al cambiar, transforma la línea (sin clave, nunca). pts: [[x, y]] en píxeles; base: el suelo del área.
const MUESTRAS_MORPH = 64, DURACION_MORPH = 520;
function useMorph(clave, pts, base) {
  const linea = useRef(null), relleno = useRef(null);
  const finales = useRef({});
  const previo = useRef(null);
  const firma = pts.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(';');
  const raf = useRef(0);
  const ultimaClave = useRef(clave);
  useLayoutEffect(() => {
    const nuevo = remuestrear(pts, MUESTRAS_MORPH);
    const desde = previo.current;
    const cambia = clave !== undefined && ultimaClave.current !== clave;
    previo.current = nuevo;
    ultimaClave.current = clave;
    if (!cambia || !desde?.length || !nuevo.length || !linea.current || sinMovimiento()) return;
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const svg = linea.current.ownerSVGElement;
    svg?.classList.add('morfando');
    const pintar = (m) => { linea.current?.setAttribute('d', trazoDe(m)); relleno.current?.setAttribute('d', areaDe(m, base)); };
    pintar(desde);
    const paso = (ahora) => {
      const k = salidaSuave((ahora - t0) / DURACION_MORPH);
      if (k < 1) { pintar(mezclarPuntos(desde, nuevo, k)); raf.current = requestAnimationFrame(paso); return; }
      // Al acabar, el trazo de verdad (con sus esquinas en cada punto), el del último pintado
      if (finales.current.linea) linea.current?.setAttribute('d', finales.current.linea);
      if (finales.current.area) relleno.current?.setAttribute('d', finales.current.area);
      svg?.classList.remove('morfando');
    };
    raf.current = requestAnimationFrame(paso);
  }, [clave, firma]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return { linea, relleno, finales };
}

// v0.52: una cifra que rueda como un cuentakilómetros al cambiar (cada dígito en su columna, que se desliza; solo
// transform). Para los lectores de pantalla, el texto tal cual; con «reducir movimiento», sin rodar.
export function Odometro({ texto, clase = '' }) {
  const t = String(texto ?? '');
  return (
    <span class={`odometro ${clase}`}>
      <span class="sr">{t}</span>
      <span class="odo-cifras" aria-hidden="true">
        {columnasCifra(t).map((c) => (c.digito == null
          ? <span key={`c${c.clave}`} class="odo-c">{c.c}</span>
          : <span key={`d${c.clave}`} class="odo-col"><span class="odo-tira" style={{ transform: `translateY(${-c.digito * 10}%)` }}>{DIGITOS.map((d) => <span key={d}>{d}</span>)}</span></span>))}
      </span>
    </span>
  );
}
const DIGITOS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// puntos: [{x: 'YYYY-MM-DD', y: número}]
// rangoMin: el eje y abarca como poco esto (para que 2000 → 2080 kcal no parezca una montaña)
// records: marca los puntos que superan a todos los anteriores (1RM estimado, tonelaje…)
// clave (v0.52): al cambiar, la línea se transforma en la nueva
export function Grafica({ puntos, unidad = '', alto = 150, dec = 1, etiqueta, rangoMin = null, records = false, clave }) {
  const [W, ref] = useAncho();
  const id = useId();
  const n = puntos?.length || 0;
  const H = Math.max(alto, Math.min(240, Math.round(W * 0.3))), izq = 34, der = 14, arr = 16, abj = 22; // más alta si hay mucho ancho
  const { lo, hi, ticks } = escalaGrafica((puntos || []).map((p) => p.y), { rangoMin });
  const X = (i) => izq + (n === 1 ? (W - izq - der) / 2 : (i * (W - izq - der)) / (n - 1));
  const Y = (v) => arr + (1 - (v - lo) / (hi - lo)) * (H - arr - abj);
  const xs = (puntos || []).map((_, i) => X(i));
  const raspado = useRaspado(n, xs);
  const morph = useMorph(clave, (puntos || []).map((p, i) => [X(i), Y(p.y)]), H - abj);
  if (!n) return null;
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${X(n - 1).toFixed(1)} ${H - abj} L${X(0).toFixed(1)} ${H - abj}Z`;
  morph.finales.current = { linea: d, area };
  const etiquetasX = n <= 2 ? puntos.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  const ultimo = puntos[n - 1];
  const prs = records ? indicesRecord(puntos.map((p) => p.y)) : [];
  const conU = (v) => `${num(v, dec)}${unidad ? ` ${unidad}` : ''}`;
  const textoPunto = (i) => `${fmtCorta(puntos[i].x)}: ${conU(puntos[i].y)}${prs.includes(i) ? ', récord' : ''}`;
  const ys = puntos.map((p) => p.y);
  const iMax = ys.indexOf(Math.max(...ys));
  const resumen = `${etiqueta || 'Evolución'}. ${n} ${n === 1 ? 'punto' : 'puntos'}, del ${fmtCorta(puntos[0].x)} (${conU(puntos[0].y)}) al ${fmtCorta(ultimo.x)} (${conU(ultimo.y)}); el más alto, ${conU(ys[iMax])} el ${fmtCorta(puntos[iMax].x)}${prs.length ? `; ${prs.length} ${prs.length === 1 ? 'récord' : 'récords'}` : ''}.`;
  const sel = raspado.sel;
  return (
    <CajaGrafica raspado={raspado} n={n} W={W} xs={xs} ys={puntos.map((p) => Y(p.y))} etiqueta={etiqueta || 'Evolución'} textoPunto={textoPunto} resumen={resumen}>
      <svg class="grafica" ref={ref} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs><linearGradient id={`deg-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="deg-a" /><stop offset="1" class="deg-b" /></linearGradient></defs>
        {ticks.map((t) => (
          <g key={t}>
            <line class="eje" x1={izq} x2={W - der} y1={Y(t)} y2={Y(t)} stroke-dasharray="2 4" />
            <text x={izq - 6} y={Y(t) + 4} text-anchor="end">{num(t, 1)}</text>
          </g>
        ))}
        <path class="area-deg" ref={morph.relleno} d={area} fill={`url(#deg-${id})`} />
        <path class="linea" ref={morph.linea} d={d} />
        {sel != null && <line class="guia" x1={X(sel)} x2={X(sel)} y1={arr - 6} y2={H - abj} />}
        {puntos.map((p, i) => <circle key={i} class={`punto ${i === n - 1 ? 'ultimo' : ''} ${prs.includes(i) ? 'record' : ''} ${i === sel ? 'elegido' : ''}`} cx={X(i)} cy={Y(p.y)} r={i === sel ? 5.5 : prs.includes(i) ? 4.5 : i === n - 1 ? 4.5 : 3} />)}
        {sel == null && <text class="valor" x={Math.min(X(n - 1), W - der)} y={Y(ultimo.y) - 10} text-anchor="end">{conU(ultimo.y)}</text>}
        {etiquetasX.map((i) => (
          <text key={i} x={X(i)} y={H - 4} text-anchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{fmtCorta(puntos[i].x)}</text>
        ))}
      </svg>
    </CajaGrafica>
  );
}

// Peso: cada pesada como un punto y la tendencia como línea, con el eje x en días reales
export function GraficaPeso({ serie, alto = 170, etiqueta, clave }) {
  const [W, ref] = useAncho();
  const id = useId();
  const n = serie?.length || 0;
  const H = Math.max(alto, Math.min(240, Math.round(W * 0.3))), izq = 34, der = 14, arr = 14, abj = 22;
  const ys0 = (serie || []).flatMap((p) => [p.kg, p.tendencia]);
  let lo = n ? Math.min(...ys0) : 0, hi = n ? Math.max(...ys0) : 1;
  if (hi - lo < 1.5) { const m = (hi + lo) / 2; lo = m - 0.75; hi = m + 0.75; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const d0 = serie?.[0]?.fecha, dN = serie?.[n - 1]?.fecha;
  const total = n ? Math.max(1, diasEntre(d0, dN)) : 1;
  const X = (f) => izq + (n === 1 ? (W - izq - der) / 2 : (diasEntre(d0, f) / total) * (W - izq - der));
  const Y = (v) => arr + (1 - (v - lo) / (hi - lo)) * (H - arr - abj);
  const xs = (serie || []).map((p) => X(p.fecha));
  const raspado = useRaspado(n, xs);
  const morph = useMorph(clave, (serie || []).map((p) => [X(p.fecha), Y(p.tendencia)]), H - abj);
  if (!n) return null;
  const linea = serie.map((p, i) => `${i ? 'L' : 'M'}${X(p.fecha).toFixed(1)} ${Y(p.tendencia).toFixed(1)}`).join(' ');
  const area = `${linea} L${X(dN).toFixed(1)} ${H - abj} L${X(d0).toFixed(1)} ${H - abj}Z`;
  morph.finales.current = { linea, area };
  const paso = hi - lo > 6 ? 1 : 0.5;
  const ticks = [...new Set([lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.8].map((t) => Math.round(t / paso) * paso))];
  const ult = serie[n - 1];
  const fechasX = total >= 14 ? [d0, aISO(new Date(Date.parse(`${d0}T12:00:00`) + (total / 2) * 864e5)), dN] : [d0, dN];
  const textoPunto = (i) => `${fmtCorta(serie[i].fecha)}: ${num(serie[i].kg)} kg (tendencia ${num(serie[i].tendencia)})`;
  const resumen = `${etiqueta || 'Peso'}. ${n} ${n === 1 ? 'pesada' : 'pesadas'} del ${fmtCorta(d0)} al ${fmtCorta(dN)}; la tendencia va de ${num(serie[0].tendencia)} a ${num(ult.tendencia)} kg.`;
  const sel = raspado.sel;
  return (
    <CajaGrafica raspado={raspado} n={n} W={W} xs={xs} ys={serie.map((p) => Y(Math.max(p.kg, p.tendencia)))} etiqueta={etiqueta || 'Peso'} textoPunto={textoPunto} resumen={resumen}>
      <svg class="grafica grafica-peso" ref={ref} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs><linearGradient id={`deg-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="deg-a" /><stop offset="1" class="deg-b" /></linearGradient></defs>
        {ticks.map((t) => (
          <g key={t}><line class="eje" x1={izq} x2={W - der} y1={Y(t)} y2={Y(t)} stroke-dasharray="2 4" /><text x={izq - 6} y={Y(t) + 4} text-anchor="end">{num(t, 1)}</text></g>
        ))}
        <path class="area-deg" ref={morph.relleno} d={area} fill={`url(#deg-${id})`} />
        {serie.map((p) => <circle key={p.fecha} class="pesada" cx={X(p.fecha)} cy={Y(p.kg)} r="2.6" />)}
        <path class="linea" ref={morph.linea} d={linea} />
        {sel != null && <line class="guia" x1={xs[sel]} x2={xs[sel]} y1={arr - 6} y2={H - abj} />}
        {sel != null && <circle class="punto elegido" cx={xs[sel]} cy={Y(serie[sel].tendencia)} r="5.5" />}
        <circle class="punto ultimo" cx={X(ult.fecha)} cy={Y(ult.tendencia)} r="4.5" />
        {[...new Set(fechasX)].map((f, i, arr2) => (
          <text key={f} x={X(f)} y={H - 4} text-anchor={i === 0 ? 'start' : i === arr2.length - 1 ? 'end' : 'middle'}>{fmtCorta(f)}</text>
        ))}
      </svg>
    </CajaGrafica>
  );
}

// Copiar al portapapeles con alternativa de selección
export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

// Descarga un archivo generado en el navegador. Devuelve false si el navegador la bloquea.
// En la demo publicada como artefacto de claude.ai, las descargas pasan por su capacidad «downloads»
// (la persona ve una confirmación con el nombre y el tamaño); si no está, lo de siempre.
export async function descargar(nombre, contenido, tipo = 'application/json') {
  try {
    if (typeof window !== 'undefined' && typeof window.claude?.use === 'function') {
      const d = await window.claude.use('downloads').catch(() => null);
      if (d) {
        try { await d.save({ filename: nombre, data: contenido }); return true; } catch (e) { if (e?.code === 'declined') return true; if (e?.code !== 'rejected_extension' && e?.code !== 'extension_not_enabled') return false; }
      }
    }
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch { return false; }
}

// Hoja que descarga un archivo y, por si el navegador no deja, ofrece el texto para copiarlo
export function HojaExportar({ titulo, nombre, contenido, tipo, alCerrar }) {
  const { aviso } = useApp();
  useEffect(() => { descargar(nombre, contenido, tipo); }, []);
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar}>
      <p class="peq secundario">Se ha descargado <strong>{nombre}</strong>. Si no ves la descarga, copia el contenido y guárdalo en un archivo con ese nombre.</p>
      <textarea class="area mono" style="min-height:200px" readOnly value={contenido.length > 200000 ? contenido.slice(0, 200000) + '\n…' : contenido} onFocus={(e) => e.currentTarget.select()} aria-label="Contenido exportado" />
      <div class="fila-envolver">
        <button class="btn" onClick={() => descargar(nombre, contenido, tipo)}><Icono n="descargar" /> Descargar otra vez</button>
        <button class="btn" onClick={async () => aviso((await copiar(contenido)) ? 'Copiado' : 'Selecciona el texto y cópialo')}><Icono n="copiar" /> Copiar</button>
      </div>
    </Hoja>
  );
}

// Una pista corta la primera vez que se ve una pantalla (se cierra con «Entendido» y no vuelve). Para que la app,
// con todo lo que hace, se entienda sola.
export function Pista({ id, children, icono = 'pregunta' }) {
  const [vista, setVista] = usePreferencia(`fbe-pista-${id}`, false);
  // Como mucho tres líneas; si el texto es más largo, «Leer más» lo abre entero (si solo se pasa por una línea se
  // enseña entero: «Leer más» ocuparía lo mismo). Se mide con el tamaño real, también cuando la nota aparece después
  // (dentro de una fila plegada, en otra pestaña). Sin ResizeObserver, entero siempre.
  const [entera, setEntera] = useState(() => typeof ResizeObserver === 'undefined');
  const [larga, setLarga] = useState(false);
  const texto = useRef(null);
  // (pulido 2.3) se mide antes de pintar: «Leer más» sale a la vez que la nota, sin empujar después lo de debajo
  useLayoutEffect(() => {
    const p = texto.current;
    if (!p || entera) return undefined;
    const medir = () => {
      const sobra = p.scrollHeight - p.clientHeight;
      if (sobra <= 2) setLarga(false);
      else if (sobra <= (parseFloat(getComputedStyle(p).lineHeight) || 20) + 2) setEntera(true);
      else setLarga(true);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(p);
    return () => ro.disconnect();
  }, [entera, vista]);
  if (vista) return null;
  return (
    <div class="pista" role="note">
      <Icono n={icono} />
      <div class="pista-texto">
        <p ref={texto} class={entera ? undefined : 'corta'}>{children}</p>
        {larga && !entera && <button type="button" class="pista-mas" onClick={() => setEntera(true)}>Leer más</button>}
      </div>
      <button type="button" class="pista-cerrar" onClick={() => setVista(true)}><Icono n="cerrar" /><span class="sr">Entendido</span></button>
    </div>
  );
}

// ---------------------------------------------------------------- listas agrupadas (v0.50, como los Ajustes de iOS)
// Una sección con su título pequeño y una tarjeta con filas: cada fila con su icono en un cuadrito, el texto y, a la
// derecha, su control (un botón, un interruptor) o, si lleva a otra parte, el valor y el chevrón.
export function GrupoIos({ titulo, pie = null, children, clase = '', id }) {
  return (
    <section class={`seccion grupo-ios ${clase}`} aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      <div class="panel"><ul class="lista">{children}</ul></div>
      {pie && <p class="mini terciario grupo-ios-pie">{pie}</p>}
    </section>
  );
}
// tono: '' (el acento), 'ok', 'aviso' o 'alerta'. Con alTocar o href, la fila entera es el botón (o el enlace) y
// lleva el chevrón; si no, children va a la derecha. bloque: el control debajo, a todo el ancho (unos segmentos).
export function IcoIos({ n, tono = '' }) {
  return <span class={`ios-ico${tono ? ` ${tono}` : ''}`} aria-hidden="true"><Icono n={n} /></span>;
}
// dentro: lo que va en la fila pero no se ve en ella (la hoja que abre), para que la lista solo tenga filas
export function FilaIos({ icono, tono = '', titulo, detalle = null, valor = null, alTocar = null, href = null, etiqueta, children, bloque = null, clase = '', dentro = null }) {
  const texto = (
    <span class="fila-ios-texto">
      <span class="fila-ios-titulo">{titulo}</span>
      {detalle && <span class="peq terciario">{detalle}</span>}
    </span>
  );
  if (alTocar || href) {
    const cuerpo = (
      <>
        {icono && <IcoIos n={icono} tono={tono} />}
        {texto}
        {valor != null && <span class="fila-ios-valor peq">{valor}</span>}
        <Icono n={href ? 'enlace' : 'derecha'} class="fila-ios-chevron" />
      </>
    );
    return (
      <li class={`fila-ios-li ${clase}`}>
        {href ? <a class={`fila-ios fila-ios-nav${tono === 'alerta' ? ' peligro' : ''}`} href={href} target="_blank" rel="noopener" aria-label={etiqueta}>{cuerpo}</a>
          : <button type="button" class={`fila-ios fila-ios-nav${tono === 'alerta' ? ' peligro' : ''}`} onClick={alTocar} aria-label={etiqueta}>{cuerpo}</button>}
        {dentro}
      </li>
    );
  }
  return (
    <li class={`fila-ios${bloque ? ' fila-ios-bloque' : ''} ${clase}`}>
      {icono && <IcoIos n={icono} tono={tono} />}
      {texto}
      {children && <span class="fila-ios-fin">{children}</span>}
      {bloque && <div class="fila-ios-control">{bloque}</div>}
    </li>
  );
}

// Número pequeño sobre un icono o junto a un texto (pendientes, sin leer)
export function Insignia({ n, etiqueta }) {
  if (!n) return null;
  return <span class="insignia" role="img" aria-label={etiqueta || `${n} pendientes`}>{n > 99 ? '99+' : n}</span>;
}

// Guarda una preferencia del dispositivo (no datos: solo comodidades) sin romper si no hay almacenamiento
export function usePreferencia(clave, inicial) {
  const [v, setV] = useState(() => leerPreferencia(clave, inicial));
  const fijar = (nuevo) => { setV(nuevo); guardarPreferencia(clave, nuevo); };
  return [v, fijar];
}

// Fecha y hora relativas de un comentario: «hace 5 min», «ayer, 18:30», «12 oct»
export function cuando(iso) {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hh = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dia = new Date(d); dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy - dia) / 864e5);
  if (dias === 0) return `hoy, ${hh}`;
  if (dias === 1) return `ayer, ${hh}`;
  return fmtCorta(aISO(d));
}
