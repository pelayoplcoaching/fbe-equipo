// Ajustes de este dispositivo (se guardan en el propio navegador, no en la cuenta): tema, sonido (cuál, a qué
// volumen y los pitidos de los 3 últimos segundos), vibración, pantalla encendida durante la sesión y si Hoy
// enseña la cifra del peso o solo cómo va. Si el almacenamiento no está disponible, valen los de serie.
// v0.49: color de acento, negro puro (OLED) en el tema oscuro y la vibración al tocar (marcar una serie, un récord,
// enviar el check-in), aparte de la del descanso.
// v0.50: el tamaño de la letra (Normal, Grande o Muy grande), que cambia el tamaño de la raíz (todo va en rem).
// v0.52: «Respira» en el descanso (un círculo que acompasa la respiración), apagado de entrada.
// v0.52.2: el descanso si el coach no lo pone (de serie, 2:00; 0 = sin descanso automático).
import { cssAcento, ACENTO_DEFECTO } from '../logica/acentos.js';
import { descansoValido, DESCANSO_DEFECTO } from '../logica/calculos.js';

const CLAVE = 'fbe-ajustes';
// voz (v0.48): el entrenador por voz, apagado de entrada
export const AJUSTES_DEFECTO = { tema: 'sistema', sonido: true, sonidoDescanso: 'tres-beeps', volumen: 1, cuentaAtras: true, vibracion: true, pantalla: true, pesoCifra: false, voz: false,
  acento: ACENTO_DEFECTO, oled: false, hapticos: true, letra: 'normal', respira: false, descansoDefecto: DESCANSO_DEFECTO };
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
  if (!descansoValido(a.descansoDefecto)) a.descansoDefecto = DESCANSO_DEFECTO;
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
}

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
