// Ajustes de este dispositivo (se guardan en el propio navegador, no en la cuenta): tema, sonido (cuál, a qué
// volumen y los pitidos de los 3 últimos segundos), vibración, pantalla encendida durante la sesión y si Hoy
// enseña la cifra del peso o solo cómo va. Si el almacenamiento no está disponible, valen los de serie.

const CLAVE = 'fbe-ajustes';
export const AJUSTES_DEFECTO = { tema: 'sistema', sonido: true, sonidoDescanso: 'tres-beeps', volumen: 1, cuentaAtras: true, vibracion: true, pantalla: true, pesoCifra: false };
const COLOR = { claro: '#EEEEF3', oscuro: '#13111C' };

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
  aplicarTema(a.tema);
}

// El tema usa el mismo atributo que el visor que aloja la demo (data-theme); con «sistema» se respeta lo que hubiera.
let temaPrevio;
export function aplicarTema(tema = leerAjustes().tema) {
  if (typeof document === 'undefined') return;
  const r = document.documentElement;
  if (temaPrevio === undefined) temaPrevio = r.getAttribute('data-theme');
  if (tema === 'claro') r.setAttribute('data-theme', 'light');
  else if (tema === 'oscuro') r.setAttribute('data-theme', 'dark');
  else if (temaPrevio) r.setAttribute('data-theme', temaPrevio);
  else r.removeAttribute('data-theme');
  // Color de la barra del sistema en la app instalada
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    m.dataset.original ||= m.getAttribute('content');
    m.setAttribute('content', tema === 'sistema' ? m.dataset.original : COLOR[tema]);
  }
}
