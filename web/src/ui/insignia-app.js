// El número en el icono de la app (v0.48, Badging API: Android con Chrome instalado, ordenador; iPhone desde iOS 16.4
// con la app en la pantalla de inicio y las notificaciones activadas). Mensajes sin leer y lo pendiente. Donde no
// existe, no pasa nada.
export function ponerInsignia(n) {
  try {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return false;
    if (n > 0) navigator.setAppBadge(Math.min(99, Math.round(n))).catch(() => {});
    else navigator.clearAppBadge?.().catch(() => {});
    return true;
  } catch { return false; }
}
export const quitarInsignia = () => ponerInsignia(0);
