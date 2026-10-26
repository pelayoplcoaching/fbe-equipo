// Configuración de la app. Rellena con los datos de tu proyecto de Supabase
// (Project Settings → API). La clave "anon" es pública por diseño: la seguridad está en los permisos (RLS).
// Nunca pongas aquí la clave service_role.
// Con estos campos vacíos, la app arranca en modo demo.
window.FBE_CONFIG = {
  supabaseUrl: 'https://radaoeiymuiiffmxbeaz.supabase.co',
  supabaseAnonKey: 'sb_publishable_4-PR21v5Jh_Jc-U32ovRLQ_WpNlMOAN',
  // Notificaciones al móvil: la clave pública VAPID que da «npm run claves-push» (también pública por diseño).
  // Vacía, la app no ofrece activarlas. La privada va solo en los secretos de Supabase.
  vapidPublica: 'BJZBCsC0FTqAW-Z71Xw43sd-3GpHa5ig9D-5k5vCDOZoLRVMM3FvBke8cLZK0n8w0uhdC8cxKitYyzCRTQswLlY',
  // true si configuras el email (RESEND_API_KEY y AVISOS_REMITENTE en la función): la app ofrece recibirlas por email
  notificacionesEmail: false,
};
