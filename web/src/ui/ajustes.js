// Ajustes de este dispositivo (se guardan en el propio navegador, no en la cuenta): tema, sonido (cuál, a qué
// volumen y los pitidos de los 3 últimos segundos), vibración, pantalla encendida durante la sesión y si Hoy
// enseña la cifra del peso o solo cómo va. Si el almacenamiento no está disponible, valen los de serie.
// v0.49: color de acento, negro puro (OLED) en el tema oscuro y la vibración al tocar (marcar una serie, un récord,
// enviar el check-in), aparte de la del descanso.
// v0.50: el tamaño de la letra (Normal, Grande o Muy grande), que cambia el tamaño de la raíz (todo va en rem).
// v0.52: «Respira» en el descanso (un círculo que acompasa la respiración), apagado de entrada.
// v0.52.2: el descanso si el coach no lo pone (de serie, 2:00; 0 = sin descanso automático).
// v0.54: el fondo del chat («Con dibujos», de serie, o «Liso»).
// v0.62: «Avisar aunque bloquees el móvil», apagado de serie.
// v0.63: el teclado de la app para apuntar las series (encendido de serie; apagado, el del móvil, como antes).
import { cssAcento, ACENTO_DEFECTO } from '../logica/acentos.js';
import { descansoValido, DESCANSO_DEFECTO } from '../logica/calculos.js';

const CLAVE = 'fbe-ajustes';
// voz (v0.48): el entrenador por voz, apagado de entrada
export const AJUSTES_DEFECTO = { tema: 'sistema', sonido: true, sonidoDescanso: 'tres-beeps', volumen: 1, cuentaAtras: true, vibracion: true, pantalla: true, pesoCifra: false, voz: false,
  acento: ACENTO_DEFECTO, oled: false, hapticos: true, letra: 'normal', respira: false, juegoDescanso: false, descansoDefecto: DESCANSO_DEFECTO, fondoChat: 'dibujos',
  // v0.56: los sonidos del chat (al enviar y al recibir, con el chat abierto) y las fotos en HD (más grandes) de serie
  sonidosChat: true, fotosHd: false,
  // v0.60: «Difuminar la cara» al enviar un vídeo, encendido de serie en este móvil (apagado si no se elige)
  difuminarCara: false,
  // v0.61: «Subir los vídeos solo con wifi» (solo sale donde el navegador dice si es wifi: Chrome de Android)
  soloWifi: false,
  // v0.66: «Modo gimnasio» (en la sesión, cifras y botones más grandes y más contraste)
  gimnasio: false,
  // v0.62: «Avisar aunque bloquees el móvil» (la pista del descanso, ui/pista-descanso.js): apagado de serie, porque en el
  // iPhone (y en Android) pausa la música de otras apps mientras dura el descanso. Solo sale donde puede funcionar
  vozBloqueo: false,
  // v0.63: «Teclado de la app al apuntar las series» (ui/atleta/Teclado.jsx): de serie, sí
  tecladoApp: true,
  // pulido 7: «Sonido al marcar una serie» (un tic suave, y unas notas al terminar la sesión). De serie, como tenga
  // puesto el sonido del descanso: quien lo tenía apagado no oye nada nuevo
  sonidoSerie: true,
  // v0.112: la unidad de las cargas del entreno, kilos o libras (logica/unidades.js); la base guarda siempre kilos
  unidadPeso: 'kg' };
const COLOR = { claro: '#EEEEF3', oscuro: '#13111C', oled: '#000000' };

// Copia en memoria: si el navegador no deja guardar (almacenamiento lleno o bloqueado), lo elegido vale
// igual mientras la app esté abierta (antes se volvía a los de serie: «elijo otro sonido y suena el de siempre»)
let enMemoria = null;
const TEMAS = ['sistema', 'claro', 'oscuro'];
// El tamaño de la letra: su nombre y cuánto crece la raíz (100 % son los 16 px del navegador)
export const TAMANOS_LETRA = [['normal', 'Normal', 100], ['grande', 'Grande', 112.5], ['muy-grande', 'Muy grande', 125]];
const LETRAS = TAMANOS_LETRA.map(([k]) => k);
// Lo guardado, completado con los de serie y saneado (sin pantalla, para poder probarlo):
// - v0.49: quien apagó la vibración en la v0.48 (solo había una) la tiene apagada también al tocar;
// - un tema, un acento o un negro puro que no sean de los que hay vuelven a los de serie (alguien pudo tocar el
//   almacenamiento a mano, y el tema acaba en el color de la barra del sistema);
// - v0.50: un tamaño de letra que no es de los tres vuelve al normal;
// - v0.52.2: un descanso de por defecto que no es de la lista (1:00 a 5:00 o sin descanso) vuelve a 2:00.
export function normalizarAjustes(guardado = {}) {
  const g = guardado && typeof guardado === 'object' && !Array.isArray(guardado) ? guardado : {};
  const a = { ...AJUSTES_DEFECTO, ...g };
  if (!('hapticos' in g) && 'vibracion' in g) a.hapticos = g.vibracion !== false;
  a.hapticos = a.hapticos !== false;
  if (!TEMAS.includes(a.tema)) a.tema = AJUSTES_DEFECTO.tema;
  if (typeof a.acento !== 'string' || !/^[a-z]{1,20}$/.test(a.acento)) a.acento = AJUSTES_DEFECTO.acento;
  a.oled = a.oled === true;
  if (!LETRAS.includes(a.letra)) a.letra = AJUSTES_DEFECTO.letra;
  a.respira = a.respira === true;
  // «La travesía»: si jugó en el último descanso, el juego se abre solo en el siguiente (hasta que lo cierre a mano)
  a.juegoDescanso = a.juegoDescanso === true;
  if (!descansoValido(a.descansoDefecto)) a.descansoDefecto = DESCANSO_DEFECTO;
  // v0.54: el fondo del chat, con dibujos o liso
  if (!['dibujos', 'liso'].includes(a.fondoChat)) a.fondoChat = AJUSTES_DEFECTO.fondoChat;
  a.sonidosChat = a.sonidosChat !== false;
  // pulido 7: sin elegirlo, el sonido de la serie sigue al del descanso
  a.sonidoSerie = 'sonidoSerie' in g ? g.sonidoSerie !== false : a.sonido !== false;
  a.fotosHd = a.fotosHd === true;
  a.difuminarCara = a.difuminarCara === true;
  a.soloWifi = a.soloWifi === true;
  a.vozBloqueo = a.vozBloqueo === true;
  a.tecladoApp = a.tecladoApp !== false;
  a.unidadPeso = a.unidadPeso === 'lb' ? 'lb' : 'kg';
  return a;
}
export function leerAjustes() {
  let guardado = {};
  try {
    const t = localStorage.getItem(CLAVE);
    if (t) guardado = JSON.parse(t);
  } catch { /* sin almacenamiento (o lo guardado no se entiende): los de serie */ }
  return normalizarAjustes({ ...(guardado || {}), ...(enMemoria || {}) });
}
export const ajuste = (k) => leerAjustes()[k];

export function guardarAjustes(a) {
  enMemoria = { ...a };
  try { localStorage.setItem(CLAVE, JSON.stringify(a)); } catch { /* sin almacenamiento: vale para esta visita */ }
  aplicarTema(a.tema, a);
  // v0.63: para lo que ya está en pantalla y depende de un ajuste (el teclado de la sesión)
  try { window.dispatchEvent(new Event(EVENTO_AJUSTES)); } catch { /* sin ventana */ }
}
export const EVENTO_AJUSTES = 'fbe-ajustes';

// El tema usa el mismo atributo que el visor que aloja la demo (data-theme); con «sistema» se respeta lo que hubiera.
let temaPrevio;
export function aplicarTema(temaPedido = leerAjustes().tema, a = leerAjustes()) {
  const tema = TEMAS.includes(temaPedido) ? temaPedido : 'sistema';
  if (typeof document === 'undefined') return;
  const r = document.documentElement;
  if (temaPrevio === undefined) temaPrevio = r.getAttribute('data-theme');
  if (tema === 'claro') r.setAttribute('data-theme', 'light');
  else if (tema === 'oscuro') r.setAttribute('data-theme', 'dark');
  else if (temaPrevio) r.setAttribute('data-theme', temaPrevio);
  else r.removeAttribute('data-theme');
  // Negro puro: solo cambia algo cuando el tema que se ve es el oscuro (las reglas están en estilos.css)
  const oled = !!a.oled && tema !== 'claro';
  if (oled) r.setAttribute('data-oled', ''); else r.removeAttribute('data-oled');
  // v0.50: el tamaño de la letra, en la raíz (estilos.css lo traduce a su font-size)
  if (a.letra && a.letra !== 'normal' && LETRAS.includes(a.letra)) r.setAttribute('data-letra', a.letra); else r.removeAttribute('data-letra');
  // v0.66: el modo gimnasio (las reglas, en estilos.css, solo tocan la sesión y el descanso)
  if (a.gimnasio) r.setAttribute('data-gimnasio', ''); else r.removeAttribute('data-gimnasio');
  // El acento: sus variables en una hoja propia al final del <head> (con los mismos selectores que el tema)
  let hoja = document.getElementById('fbe-acento');
  const css = cssAcento(a.acento);
  if (css && !hoja) { hoja = document.createElement('style'); hoja.id = 'fbe-acento'; document.head.appendChild(hoja); }
  if (hoja) hoja.textContent = css;
  // Color de la barra del sistema en la app instalada (la de la portada de arranque se queda en morado hasta que se va)
  for (const m of document.querySelectorAll('meta[name="theme-color"]:not(#tc-portada)')) {
    m.dataset.original ||= m.getAttribute('content');
    const oscura = /dark/.test(m.getAttribute('media') || '');
    m.setAttribute('content', tema === 'sistema' ? (oled && oscura ? COLOR.oled : m.dataset.original) : tema === 'oscuro' && oled ? COLOR.oled : COLOR[tema]);
  }
}
