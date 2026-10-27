// Backend de producción: Supabase (Auth + PostgREST). Los permisos los impone la base de datos (RLS).

// Tablas cuya clave no es «id» (para ordenar al paginar)
export const CLAVE_TABLA = { cobros_atletas: 'atleta_id', preferencias_notificaciones: 'usuario_id' };
import { createClient } from '@supabase/supabase-js';

const MENSAJES = {
  '42501': 'No tienes permiso para hacer eso.',
  '23505': 'Ya existe un registro igual.',
  '23514': 'Algún valor está fuera de rango.',
  '23503': 'Falta un dato relacionado (puede que se haya borrado).',
  'invalid_credentials': 'Email o contraseña incorrectos.',
  'user_already_exists': 'Ya hay una cuenta con ese email. Entra con tu contraseña.',
  'email_not_confirmed': 'Confirma tu email con el enlace que te hemos enviado.',
  'weak_password': 'La contraseña es demasiado débil: usa al menos 10 caracteres.',
  'over_email_send_rate_limit': 'Demasiados correos seguidos. Prueba dentro de unos minutos.',
  'mfa_verification_failed': 'Código incorrecto o caducado. Escribe el que muestra ahora tu app.',
  'mfa_challenge_expired': 'El código ha caducado. Escribe el que muestra ahora tu app.',
  'insufficient_aal': 'Primero tienes que verificar tu código de dos pasos.',
  'mfa_factor_name_conflict': 'Ya tienes un dispositivo con ese nombre.',
  'too_many_enrolled_mfa_factors': 'Has llegado al máximo de dispositivos de verificación.',
};

function traducir(error) {
  if (!error) return null;
  const tamano = String(error.statusCode) === '413' || /maximum allowed size|too large/i.test(error.message || '');
  // Los avisos propios de la base («Tu cuenta está de baja…», el de la verificación en dos pasos) llegan con el
  // código 42501: se enseñan tal cual; solo el «permission denied» genérico se traduce
  const propio = (error.code === '42501' && error.message && !/permission denied|row-level security|violates row-level/i.test(error.message))
    // Igual con los de «fuera de rango» propios («No se puede apuntar un día que aún no ha llegado»); el genérico
    // de una restricción CHECK sí se traduce
    || (error.code === '23514' && error.message && !/violates check constraint/i.test(error.message));
  const e = new Error(tamano ? 'El archivo supera el tamaño máximo permitido.' : propio ? error.message : MENSAJES[error.code] || error.message || 'Algo ha fallado.');
  e.codigo = error.code;
  const m = String(error.message || '');
  e.sinConexion = (typeof navigator !== 'undefined' && navigator.onLine === false)
    || /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(m);
  if (e.sinConexion) e.message = 'Sin conexión.';
  return e;
}

function aplicarFiltro(q, f = {}) {
  for (const [k, v] of Object.entries(f.eq || {})) q = v === null ? q.is(k, null) : q.eq(k, v);
  for (const [k, v] of Object.entries(f.neq || {})) q = q.neq(k, v);
  for (const [k, v] of Object.entries(f.in || {})) q = q.in(k, v);
  for (const [k, v] of Object.entries(f.gte || {})) q = q.gte(k, v);
  for (const [k, v] of Object.entries(f.lte || {})) q = q.lte(k, v);
  for (const k of f.nulo || []) q = q.is(k, null);
  for (const k of f.nonulo || []) q = q.not(k, 'is', null);
  return q;
}

export function crearBackendSupabase({ url, anonKey }) {
  const sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  let sesion = null;
  let recuperando = false;
  const oyentes = new Set();

  async function sel(tabla, f = {}) {
    // PostgREST limita las listas de 'in' por longitud de URL: se trocean.
    const inCol = Object.entries(f.in || {}).find(([, v]) => v.length > 150);
    if (inCol) {
      const [col, valores] = inCol;
      const trozos = [];
      for (let i = 0; i < valores.length; i += 150) trozos.push(valores.slice(i, i + 150));
      const partes = await Promise.all(trozos.map((t) => sel(tabla, { ...f, in: { ...f.in, [col]: t } })));
      return partes.flat();
    }
    if (Object.values(f.in || {}).some((v) => v.length === 0)) return [];
    // Supabase devuelve como mucho 1000 filas por consulta: se pagina hasta tenerlas todas (o hasta el límite pedido)
    const PAGINA = 1000;
    const tope = f.limit || Infinity;
    const orden = [...(f.order || [])];
    // Para paginar hace falta un orden estable: la clave de la tabla (casi todas, «id»; las que van por persona, no)
    const clave = CLAVE_TABLA[tabla] || 'id';
    if (tope > PAGINA && !orden.some(([c]) => c === clave)) orden.push([clave, 'asc']);
    const filas = [];
    for (let desde = 0; desde < tope; desde += PAGINA) {
      let q = aplicarFiltro(sb.from(tabla).select(f.cols || '*'), f);
      for (const [col, dir] of orden) q = q.order(col, { ascending: dir !== 'desc', nullsFirst: false });
      const hasta = Math.min(desde + PAGINA, tope) - 1;
      q = q.range(desde, hasta);
      const { data, error } = await q;
      if (error) throw traducir(error);
      filas.push(...data);
      if (data.length < hasta - desde + 1) break;
    }
    return filas;
  }

  async function factoresMfa() {
    const { data, error } = await sb.auth.mfa.listFactors();
    if (error) throw traducir(error);
    return (data.all || []).filter((f) => f.factor_type === 'totp')
      .map((f) => ({ id: f.id, nombre: f.friendly_name || 'App de verificación', estado: f.status, creado: f.created_at }));
  }

  // Mensajes al momento (v0.18): los comentarios nuevos llegan por Realtime (con los permisos de fila de cada
  // cuenta) y se avisa a la pantalla con un evento; si Realtime no está, el chat se pone al día solo cada rato.
  let canal = null;
  function escucharMensajes() {
    if (canal || !sesion || typeof window === 'undefined' || typeof sb.channel !== 'function') return;
    try {
      canal = sb.channel('fbe-comentarios')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comentarios' }, (p) => {
          window.dispatchEvent(new CustomEvent('fbe-mensaje', { detail: p.new || null }));
        })
        .subscribe();
    } catch { canal = null; }
  }
  function dejarDeEscuchar() {
    if (!canal) return;
    try { sb.removeChannel(canal); } catch { /* */ }
    canal = null;
  }

  return {
    modo: 'supabase',
    async iniciar() {
      const { data } = await sb.auth.getSession();
      sesion = data.session;
      // Al abrir el enlace de "he olvidado mi contraseña", Supabase inicia sesión y avisa con PASSWORD_RECOVERY
      if (/type=recovery/.test(location.hash)) recuperando = true;
      escucharMensajes();
      sb.auth.onAuthStateChange((evento, s) => {
        if (evento === 'PASSWORD_RECOVERY') recuperando = true;
        sesion = s;
        if (s) escucharMensajes(); else dejarDeEscuchar();
        oyentes.forEach((f) => f(s));
      });
    },
    auth: {
      sesion: () => (sesion ? { user: { id: sesion.user.id, email: sesion.user.email } } : null),
      async entrar(email, password) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw traducir(error);
        sesion = data.session;
      },
      async registrar(email, password, nombre) {
        const { data, error } = await sb.auth.signUp({
          email, password, options: { data: { nombre }, emailRedirectTo: location.origin + location.pathname },
        });
        if (error) throw traducir(error);
        sesion = data.session; // null si el proyecto pide confirmar el email
        return { confirmarEmail: !data.session };
      },
      async salir() { await sb.auth.signOut(); sesion = null; },
      async recuperar(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw traducir(error);
      },
      async cambiarPassword(password) {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw traducir(error);
        recuperando = false;
      },
      enRecuperacion: () => recuperando && !!sesion,
      alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); },
      // Verificación en dos pasos (TOTP: Google Authenticator, 1Password, Authy…)
      mfa: {
        async nivel() {
          const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
          if (error) throw traducir(error);
          return { actual: data.currentLevel, siguiente: data.nextLevel };
        },
        factores: factoresMfa,
        async inscribir(nombre) {
          // Quita intentos anteriores que se quedaron sin verificar
          const previos = await factoresMfa();
          for (const f of previos.filter((x) => x.estado !== 'verified')) await sb.auth.mfa.unenroll({ factorId: f.id });
          // issuer: el nombre que sale en la app de códigos (sin él, Supabase lo saca de la Site URL)
          const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', issuer: 'FBE Equipo', friendlyName: `${nombre} (${new Date().toISOString().slice(0, 10)})` });
          if (error) throw traducir(error);
          return { id: data.id, qr: data.totp.qr_code, secreto: data.totp.secret };
        },
        async verificar(factorId, codigo) {
          const { data, error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: String(codigo).replace(/\s/g, '') });
          if (error) throw traducir(error);
          if (data?.access_token) { const s = await sb.auth.getSession(); sesion = s.data.session; }
        },
        async quitar(factorId) {
          const { error } = await sb.auth.mfa.unenroll({ factorId });
          if (error) throw traducir(error);
          await sb.auth.refreshSession();
        },
      },
    },
    // Vídeos y fotos: bucket privado «archivos»; se ven con enlaces firmados que caducan en una hora
    storage: {
      async subir(ruta, archivo, tipo) {
        const { error } = await sb.storage.from('archivos').upload(ruta, archivo, { contentType: tipo, upsert: false, cacheControl: '3600' });
        if (error) throw traducir(error);
      },
      async url(ruta, segundos = 3600) {
        const { data, error } = await sb.storage.from('archivos').createSignedUrl(ruta, segundos);
        if (error) throw traducir(error);
        return data.signedUrl;
      },
      async borrar(rutas) {
        if (!rutas.length) return;
        for (let i = 0; i < rutas.length; i += 500) {
          const { error } = await sb.storage.from('archivos').remove(rutas.slice(i, i + 500));
          if (error) throw traducir(error);
        }
      },
      // Todos los archivos de una carpeta (<atleta_id>), de 1000 en 1000
      async listar(carpeta) {
        const rutas = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await sb.storage.from('archivos').list(carpeta, { limit: 1000, offset });
          if (error) throw traducir(error);
          rutas.push(...data.filter((f) => f.id).map((f) => `${carpeta}/${f.name}`));
          if (data.length < 1000) return rutas;
        }
      },
    },
    select: sel,
    async insert(tabla, filas) {
      const { data, error } = await sb.from(tabla).insert(filas).select();
      if (error) throw traducir(error);
      return data;
    },
    async update(tabla, cambios, f) {
      const { data, error } = await aplicarFiltro(sb.from(tabla).update(cambios), f).select();
      if (error) throw traducir(error);
      return data;
    },
    async upsert(tabla, filas, onConflict) {
      const { data, error } = await sb.from(tabla).upsert(filas, { onConflict }).select();
      if (error) throw traducir(error);
      return data;
    },
    async delete(tabla, f) {
      const { error } = await aplicarFiltro(sb.from(tabla).delete(), f);
      if (error) throw traducir(error);
    },
    async rpc(nombre, args) {
      const { data, error } = await sb.rpc(nombre, args);
      if (error) throw traducir(error);
      return data;
    },
    // Funciones de Supabase (Edge Functions), con la sesión de quien llama
    async funcion(nombre, cuerpo = {}) {
      // En la región de la base (Frankfurt): lo que se procesa se queda en la UE
      const { data, error } = await sb.functions.invoke(nombre, { body: cuerpo, headers: { 'x-region': 'eu-central-1' } });
      if (error) throw error;
      return data;
    },
  };
}
