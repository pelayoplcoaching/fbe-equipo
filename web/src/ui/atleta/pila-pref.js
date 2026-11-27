// (vista 253, v0.274) «Apilar los avisos» (en «Ordenar Hoy»): encendido de serie; apagado, cada aviso se ve entero
// como hasta ahora. Solo en este móvil
export const CLAVE_PILA = 'fbe-avisos-apilados';
export const EVENTO_PILA = 'fbe-pila-avisos';
export const quiereApilar = () => { try { return localStorage.getItem(CLAVE_PILA) !== '0'; } catch { return true; } };
export const fijarApilar = (si) => {
  try { if (si) localStorage.removeItem(CLAVE_PILA); else localStorage.setItem(CLAVE_PILA, '0'); } catch { /* sin almacenamiento: vale para esta visita */ }
  try { window.dispatchEvent(new Event(EVENTO_PILA)); } catch { /* */ }
};
