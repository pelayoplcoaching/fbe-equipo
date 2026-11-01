// Ajustes de este dispositivo (se guardan en el propio navegador, no en la cuenta): tema, sonido (cuál, a qué
// volumen y los pitidos de los 3 últimos segundos), vibración, pantalla encendida durante la sesión y si Hoy
// enseña la cifra del peso o solo cómo va. Si el almacenamiento no está disponible, valen los de serie.
// v0.49: color de acento, negro puro (OLED) en el tema oscuro y la vibración al tocar (marcar una serie, un récord,
// enviar el check-in), aparte de la del descanso.
import { cssAcento, ACENTO_DEFECTO } from '../logica/acentos.js';

const CLAVE = 'fbe-ajustes';
// voz (v0.48): el entrenador por voz, apagado de entrada
export const AJUSTES_DEFECTO = { tema: 'sistema', sonido: true, sonidoDescanso: 'tres-beeps', volumen: 1, cuentaAtras: true, vibracion: true, pantalla: true, pesoCifra: false, voz: false,
  acento: ACENTO_DEFECTO, oled: false, hapticos: true };
const COLOR = { claro: '#EEEEF3', oscuro: '#13111C', oled: '#000000' };

// Copia en memoria: si el navegador no deja guardar (almacenamiento lleno o bloqueado), lo elegido vale
// igual mientras la app esté abierta (antes se volvía a los de serie: «elijo otro sonido y suena el de siempre»)
let enMemoria = null;
export function leerAjustes() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) return { ...AJUSTES_DEFECTO, ...JSON.parse(guardado), ...(enMemoria || {}) };
  } catch { /* sin almacenamiento */ }
  return { ...AJUSTES_DEFECTO, ...(enMemoria || {}) };
}
export const ajuste = (k) => leerAjustes()[k];

export function guardarAjustes(a) {
  enMemoria = { ...a };
  try { localStorage.setItem(CLAVE, JSON.stringify(a)); } catch { /* sin almacenamiento: vale para esta visita */ }
  aplicarTema(a.tema, a);
}

// El tema usa el mismo atributo que el visor que aloja la demo (data-theme); con «sistema» se respeta lo que hubiera.
let temaPrevio;
export function aplicarTema(tema = leerAjustes().tema, a = leerAjustes()) {
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
