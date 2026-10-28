// Ajustes de este dispositivo (se guardan en el propio navegador, no en la cuenta): tema, sonido (cuál, a qué
// volumen y los pitidos de los 3 últimos segundos), vibración y pantalla encendida durante la sesión. Si el almacenamiento no está disponible, valen los de serie.

const CLAVE = 'fbe-ajustes';
export const AJUSTES_DEFECTO = { tema: 'sistema', sonido: true, sonidoDescanso: 'tres-beeps', volumen: 1, cuentaAtras: true, vibracion: true, pantalla: true };
const COLOR = { claro: '#EEEEF3', oscuro: '#13111C' };

export function leerAjustes() {
  try { return { ...AJUSTES_DEFECTO, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; } catch { return { ...AJUSTES_DEFECTO }; }
}
export const ajuste = (k) => leerAjustes()[k];

export function guardarAjustes(a) {
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
