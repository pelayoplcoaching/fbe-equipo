// Backend de producción: Supabase (Auth + PostgREST). Los permisos los impone la base de datos (RLS).

// Tablas cuya clave no es «id» (para ordenar al paginar)
export const CLAVE_TABLA = { personal_atleta: 'atleta_id', mensajes_coach: 'momento', cobros_atletas: 'atleta_id', comidas_atleta: 'atleta_id', preferencias_notificaciones: 'usuario_id', menu_dias: 'atleta_id,fecha',
  comunidad_miembros: 'atleta_id', comunidad_reacciones: 'post_id,autor_id', comunidad_votos: 'post_id,autor_id', comunidad_animos: 'de,para,semana',
  // v0.54 (migración 032): el chat como WhatsApp
  comentario_reacciones: 'comentario_id,usuario_id', comentario_destacados: 'usuario_id,comentario_id', conversacion_estado: 'atleta_id', presencia: 'usuario_id',
  // v0.55 (migración 033): fijar, silenciar y las listas de difusión
  conversacion_fijado: 'atleta_id', chat_silencios: 'usuario_id,atleta_id', listas_difusion_miembros: 'lista_id,atleta_id',
  // v0.56 (migración 034): las encuestas del chat
  encuesta_votos: 'encuesta_id', privacidad_vista: 'usuario_id',
  // v0.57 (migración 035): la corrección de cada vídeo y las listas de puntos clave
  video_revisiones: 'archivo_id', tecnica_plantillas: 'ejercicio_id',
  // v0.59 (migración 037): la valoración del atleta de cada vídeo
  video_autoevaluacion: 'archivo_id',
  // v0.61 (migración 039): la velocidad mínima de cada ejercicio
  umbrales_velocidad: 'ejercicio_id',
  // v0.67 (migración 040): la revisión semanal del coach
  revisiones_semanales: 'atleta_id,lunes',
  // v0.69 (migración 041): 💪 a un comentario y las bienvenidas a los nuevos
  comunidad_comentario_reacciones: 'comentario_id,autor_id', comunidad_bienvenidas: 'de,para',
  // v0.70 (migración 042): el reparto de los retos por equipos
  comunidad_reto_equipos: 'reto_id,atleta_id',
  // v0.71 (migración 043): lo guardado de cada uno
  comunidad_guardados: 'perfil_id,post_id',
  // v0.72 (migración 044): quién va a cada evento
  comunidad_evento_asistentes: 'evento_id,perfil_id' };
import { createClient } from '@supabase/supabase-js';
import { Upload } from 'tus-js-client';

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
  // «The request timed out» / «The network connection was lost»: lo que dice el iPhone cuando la cobertura no da
  // (solo si no trae código: un «statement timeout» de la base es un error de verdad, no la cobertura)
  e.sinConexion = (typeof navigator !== 'undefined' && navigator.onLine === false)
    || (!error.code && /Failed to fetch|NetworkError|Load failed|fetch failed|timed out|connection was lost|network connection|ERR_NETWORK|ERR_INTERNET/i.test(m));
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

const TROZO = 6 * 1024 * 1024;

// (v0.57, revisión de seguridad) ¿Es esta dirección de una subida empezada (la que se guardó en el móvil) de este mismo
// servidor de subidas? Tiene que empezar por su dirección y «/» (y seguir igual al leerla como URL: sin «..» ni otro
// servidor); si no, se empieza otra subida y el token de la sesión nunca va a otro sitio.
export function urlSubidaValida(urlSubida, endpoint) {
  if (typeof urlSubida !== 'string' || typeof endpoint !== 'string' || !endpoint) return false;
  const base = endpoint.replace(/\/+$/, '') + '/';
  if (!urlSubida.startsWith(base) || urlSubida.length <= base.length || urlSubida.length > 2048) return false;
  try {
    const u = new URL(urlSubida), e = new URL(base);
    return /^https?:$/.test(u.protocol) && u.origin === e.origin && u.href === urlSubida && u.pathname.startsWith(e.pathname) && !u.username && !u.password;
  } catch { return false; }
}

// Subida por trozos (TUS, el protocolo de subidas reanudables de Supabase Storage). Se exporta para probarla.
// (v0.57) urlSubida: la dirección de una subida empezada (la guarda la app con el vídeo pendiente): se sigue por el trozo en
// que iba, también tras cerrar la app; si ya no vale (caducó a las 24 h), TUS empieza otra. alUrlSubida(url): en cuanto
// Storage la da, para guardarla.
export function subirPorTrozos({ endpoint, token, anonKey, ruta, archivo, tipo, alProgreso = null, senal = null, bucket = 'archivos', urlSubida = null, alUrlSubida = null, reintentos = [0, 1000, 3000, 5000, 10000, 15000, 20000, 30000, 30000, 60000, 60000] }) {
  // token: el de la sesión o una función que lo da (se pide en cada trozo: una subida larga sobrevive a su renovación)
  const pedirToken = typeof token === 'function' ? token : async () => token;
  return new Promise((ok, mal) => {
    const subida = new Upload(archivo, {
      endpoint,
      retryDelays: reintentos,
      headers: { apikey: anonKey, 'x-upsert': 'false' },
      onBeforeRequest: async (req) => { req.setHeader('authorization', `Bearer ${await pedirToken()}`); },
      // Además de lo que reintenta TUS solo (sin respuesta, 5xx, 409, 423), un 401/403 por un token caducado
      onShouldRetry: (err, intento) => {
        const st = err?.originalResponse?.getStatus?.() || 0;
        if (st === 401 || st === 403) return intento < 2;
        return !st || st >= 500 || st === 409 || st === 423;
      },
      uploadDataDuringCreation: true,
      // Cada intento va con su ruta (la registra la app justo antes): no se retoman subidas de otro intento por su huella,
      // solo la de este mismo vídeo, por su dirección (urlSubida)
      storeFingerprintForResuming: false,
      ...(urlSubidaValida(urlSubida, endpoint) ? { uploadUrl: urlSubida } : {}),
      onUploadUrlAvailable: () => { try { if (subida.url) alUrlSubida?.(subida.url); } catch { /* */ } },
      chunkSize: TROZO, // Supabase pide trozos de 6 MB exactos
      metadata: { bucketName: bucket, objectName: ruta, contentType: tipo || 'application/octet-stream', cacheControl: '3600' },
      onProgress: (hecho, total) => alProgreso?.(total ? hecho / total : 0),
      onSuccess: () => ok(),
      onError: (err) => {
        const st = err?.originalResponse?.getStatus?.() || 0;
        let cuerpo = String(err?.originalResponse?.getBody?.() || '');
        try { const j = JSON.parse(cuerpo); cuerpo = j.message || j.error || cuerpo; } catch { /* texto */ }
        // Ya estaba subido entero (un intento anterior llegó aunque no su respuesta): vale
        if (st === 409 && /already exists|duplicate/i.test(cuerpo)) { alProgreso?.(1); ok(); return; }
        const e = traducir({ message: cuerpo || err?.message || String(err), statusCode: st || undefined });
        // Sin respuesta, o el servidor no puede ahora (5xx, 423) tras todos los reintentos: se deja para luego
        if (!st || st >= 500 || st === 423) { e.sinConexion = true; e.message = 'Sin conexión.'; }
        mal(e);
      },
    });
    if (senal) senal.abortar = () => { subida.abort(true).catch(() => {}); const e = new Error('Cancelado'); e.cancelado = true; mal(e); };
    subida.start();
  });
}

// (v0.65) La sesión que Supabase guarda en el móvil (la de su clave en localStorage), si tiene con qué renovarse: { user }
export function sesionGuardada(clave, almacen = (() => { try { return globalThis.localStorage; } catch { return null; } })()) {
  try {
    const x = JSON.parse(almacen?.getItem(clave) || 'null');
    const s = x?.currentSession || x;
    return s && typeof s.refresh_token === 'string' && s.refresh_token && /^[0-9a-f-]{36}$/.test(String(s.user?.id || '')) ? { ...s, user: { id: s.user.id, email: s.user.email || null } } : null;
  } catch { return null; }
}

export function crearBackendSupabase({ url, anonKey }) {
  const sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  let sesion = null;
  let recuperando = false;
  const oyentes = new Set();
  // (v0.65) la sesión guardada en el móvil, sin renovar por falta de cobertura (ver iniciar)
  let provisional = false;
  // (renovarla puede quedarse colgado con una cobertura que va y viene: como mucho ESPERA_SESION_MS, y si no, «sin conexión»)
  const ESPERA_SESION_MS = 2500;
  const sesionCon = () => Promise.race([sb.auth.getSession().catch(() => null), new Promise((ok) => { setTimeout(() => ok(null), ESPERA_SESION_MS); })]);
  async function conSesion() {
    if (!provisional) return;
    const data = (await sesionCon())?.data;
    if (data?.session) { sesion = data.session; provisional = false; return; }
    const e = new Error('Sin conexión.');
    e.sinConexion = true;
    throw e;
  }

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
    // (f.pagina: menos filas por vez en tablas con fotos grandes, como las recetas)
    const PAGINA = Math.min(1000, f.pagina || 1000);
    const tope = f.limit || Infinity;
    const orden = [...(f.order || [])];
    // Para paginar hace falta un orden estable: la clave de la tabla (casi todas, «id»; las que van por persona, no)
    // (una clave de varias columnas va separada por comas: «atleta_id,fecha»)
    for (const clave of (CLAVE_TABLA[tabla] || 'id').split(',')) if (tope > PAGINA && !orden.some(([c]) => c === clave)) orden.push([clave, 'asc']);
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
  // (v0.54) también los cambios (una edición, un mensaje eliminado, un «visto»), igual con sus permisos de fila. Los
  // borrados no: Realtime no les aplica los permisos de fila (mandaría a todos su id).
  // Canales privados (autorizados por las políticas de realtime.messages de la 032) solo si la base dice que están
  // (chat_privado_disponible(): sin la 032, la función no existe). Con ellos, todo va por privados: un error pasajero
  // (CHANNEL_ERROR, TIMED_OUT) se reintenta con espera creciente, nunca se cae al público. Sin ellos, los mensajes nuevos
  // van por el canal público de siempre (filtrado por sus permisos de fila) y no hay «escribiendo…» ni «en línea».
  let disponible = null;
  const privadoDisponible = () => {
    if (!disponible) {
      disponible = Promise.resolve(sb.rpc('chat_privado_disponible')).then(({ data, error }) => {
        if (error) { if (/chat_privado_disponible|PGRST202|does not exist|no existe/i.test(`${error.code || ''} ${error.message || ''}`)) return false; throw error; }
        return data === true;
      });
      // Si falla por la red (no porque falte la función), se vuelve a preguntar la próxima vez
      disponible.catch(() => { disponible = null; });
    }
    return disponible;
  };
  let authRealtime = null;
  const prepararAuth = () => {
    if (!authRealtime) authRealtime = Promise.resolve(sb.realtime?.setAuth?.()).catch(() => {});
    return authRealtime;
  };
  const espera = (intento) => Math.min(60000, 1000 * 2 ** Math.min(6, intento));

  let canal = null;
  let reintentoMensajes = null;
  function escucharMensajes(intento = 0) {
    if (canal || !sesion || typeof window === 'undefined' || typeof sb.channel !== 'function') return;
    const avisar = (p) => window.dispatchEvent(new CustomEvent('fbe-mensaje', { detail: p.new || null }));
    const abrir = (nombre, privado) => sb.channel(nombre, privado ? { config: { private: true } } : undefined)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comentarios' }, avisar)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comentarios' }, avisar);
    const uidCanal = sesion.user.id;
    canal = 'abriendo';
    privadoDisponible().then(async (privado) => {
      if (canal !== 'abriendo' || !sesion || sesion.user.id !== uidCanal) return;
      if (!privado) { canal = abrir('fbe-comentarios', false).subscribe(); return; }
      await prepararAuth();
      if (canal !== 'abriendo') return;
      const c = abrir(`fbe-cambios:${uidCanal}`, true);
      canal = c;
      c.subscribe((estado) => {
        if (estado === 'SUBSCRIBED') intento = 0;
        if ((estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') && canal === c) {
          try { sb.removeChannel(c); } catch { /* */ }
          canal = null;
          clearTimeout(reintentoMensajes);
          reintentoMensajes = setTimeout(() => escucharMensajes(intento + 1), espera(intento));
        }
      });
    }).catch(() => {
      canal = null;
      clearTimeout(reintentoMensajes);
      reintentoMensajes = setTimeout(() => escucharMensajes(intento + 1), espera(intento));
    });
  }
  function dejarDeEscuchar() {
    clearTimeout(reintentoMensajes);
    if (canal && typeof canal === 'object') { try { sb.removeChannel(canal); } catch { /* */ } }
    canal = null;
    disponible = null;
    for (const x of chats.values()) { clearTimeout(x.reintento); if (x.canal) { try { sb.removeChannel(x.canal); } catch { /* */ } } }
    chats.clear();
  }

  // v0.54: «escribiendo…», «en línea» y «algo ha cambiado» (una reacción, una edición) por un canal PRIVADO por
  // conversación (chat:<atleta_id>): solo entran el coach y ese atleta, y solo si enseñan cuándo están en línea. Nunca
  // uno público: sin los privados (sin la 032), esto no hace nada. Lo que viaja: quién escribe ('coach' | 'atleta').
  // Varias pantallas pueden pedir el mismo canal (la lista de conversaciones y el chat): se comparte con un contador.
  const chats = new Map();
  const OYENTE_VACIO = { escribiendo() {}, cambio() {}, soltar() {} };
  function canalChat(atletaId, oyente = {}) {
    if (!sesion || typeof window === 'undefined' || typeof sb.channel !== 'function' || !/^[0-9a-f-]{36}$/.test(String(atletaId || ''))) return null;
    // Sin «Mostrar cuándo estoy en línea», ni «escribiendo…» ni «en línea» (la base tampoco deja entrar)
    if (oyente.visible === false) { setTimeout(() => oyente.alEstado?.(false), 0); return OYENTE_VACIO; }
    const uidYo = sesion.user.id;
    let x = chats.get(atletaId);
    if (!x) {
      x = { oyentes: new Set(), listo: false, rastreando: false, canal: null, intento: 0, reintento: null, cerrado: false };
      chats.set(atletaId, x);
      const repartir = (f, ...a) => { for (const o of x.oyentes) { try { o[f]?.(...a); } catch { /* */ } } };
      const enLinea = () => {
        const estado = x.canal?.presenceState?.() || {};
        return Object.keys(estado).some((k) => k !== uidYo && (estado[k] || []).length > 0);
      };
      const reintentar = () => {
        x.listo = false; x.rastreando = false;
        repartir('alEstado', false);
        if (x.canal) { try { sb.removeChannel(x.canal); } catch { /* */ } x.canal = null; }
        if (x.cerrado) return;
        clearTimeout(x.reintento);
        x.reintento = setTimeout(abrir, espera(x.intento++));
      };
      const abrir = async () => {
        if (x.cerrado) return;
        try {
          if (!(await privadoDisponible())) { repartir('alEstado', false); return; }
          await prepararAuth();
          if (x.cerrado) return;
          const c = sb.channel(`chat:${atletaId}`, { config: { private: true, broadcast: { self: false }, presence: { key: uidYo, enabled: true } } });
          x.canal = c;
          c.on('broadcast', { event: 'escribiendo' }, ({ payload }) => repartir('alEscribir', payload?.r === 'coach' ? 'coach' : 'atleta'))
            .on('broadcast', { event: 'cambio' }, () => repartir('alCambio'))
            .on('presence', { event: 'sync' }, () => repartir('alPresencia', enLinea()));
          c.subscribe(async (estado) => {
            if (x.canal !== c) return;
            if (estado === 'SUBSCRIBED') {
              x.listo = true; x.intento = 0;
              repartir('alEstado', true);
              if (!x.rastreando) { x.rastreando = true; try { await c.track({ r: oyente.rol === 'coach' ? 'coach' : 'atleta' }); } catch { /* */ } }
            } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') reintentar();
          });
        } catch { reintentar(); }
      };
      abrir();
    }
    x.oyentes.add(oyente);
    if (x.listo) setTimeout(() => oyente.alEstado?.(true), 0);
    let ultimoEscribiendo = 0;
    return {
      escribiendo(rol) {
        if (!x.listo || !x.canal || Date.now() - ultimoEscribiendo < 2500) return;
        ultimoEscribiendo = Date.now();
        x.canal.send({ type: 'broadcast', event: 'escribiendo', payload: { r: rol === 'coach' ? 'coach' : 'atleta' } }).catch?.(() => {});
      },
      cambio() { if (x.listo && x.canal) x.canal.send({ type: 'broadcast', event: 'cambio', payload: {} }).catch?.(() => {}); },
      soltar() {
        x.oyentes.delete(oyente);
        if (x.oyentes.size) return;
        x.cerrado = true;
        clearTimeout(x.reintento);
        chats.delete(atletaId);
        try { if (x.canal) sb.removeChannel(x.canal); } catch { /* */ }
      },
    };
  }

  return {
    modo: 'supabase',
    canalChat,
    // Al cambiar «Mostrar cuándo estoy en línea»: los canales se vuelven a abrir con lo nuevo (y la base lo comprueba)
    reiniciarChats() {
      for (const x of chats.values()) { x.cerrado = true; clearTimeout(x.reintento); try { if (x.canal) sb.removeChannel(x.canal); } catch { /* */ } }
      chats.clear();
    },
    async iniciar() {
      // (v0.65) con la sesión caducada y poca cobertura, renovarla puede tardar mucho: la app no la espera más de ESPERA_SESION_MS
      const r = await sesionCon();
      const data = r?.data || { session: null };
      const error = r ? r.error : { name: 'AuthRetryableFetchError' };
      sesion = data.session;
      // (v0.65) Sin cobertura y con el permiso de la sesión caducado (dura una hora), Supabase no puede renovarlo y dice «sin
      // sesión», aunque la guarda (o tarda en contestar). La app no te saca por eso: entra con lo guardado en el móvil (provisional) y, en cuanto
      // vuelve la red, Supabase la renueva sola. Mientras, nada sale a la base (ni se lee sin permiso: daría listas vacías).
      if (!sesion && error?.name === 'AuthRetryableFetchError') {
        const g = sesionGuardada(sb.auth.storageKey);
        if (g) { sesion = g; provisional = true; }
      }
      // Al abrir el enlace de "he olvidado mi contraseña", Supabase inicia sesión y avisa con PASSWORD_RECOVERY
      if (/type=recovery/.test(location.hash)) recuperando = true;
      escucharMensajes();
      sb.auth.onAuthStateChange((evento, s) => {
        if (evento === 'PASSWORD_RECOVERY') recuperando = true;
        // (v0.65) con la provisional, el primer aviso («sin sesión», por no poder renovarla) no cuenta
        if (provisional && !s && evento === 'INITIAL_SESSION') return;
        provisional = false;
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
      // (v0.65, revisión) sin red y con el permiso caducado, signOut no consigue renovarlo y se va sin borrar la sesión guardada: al
      // volver a abrir sin red (o al volver la red) entraba otra vez la cuenta que había salido (un móvil compartido). Se borra en
      // el móvil pase lo que pase.
      async salir() {
        provisional = false;
        try { await sb.auth.signOut(); } catch { /* sin red */ }
        try { await sb.auth.signOut({ scope: 'local' }); } catch { /* */ }
        try { const ls = globalThis.localStorage; if (ls) { ls.removeItem(sb.auth.storageKey); ls.removeItem(`${sb.auth.storageKey}-code-verifier`); } } catch { /* */ }
        sesion = null;
      },
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
      // Lo pequeño (fotos), de una vez. Los vídeos (v0.33), por trozos de 6 MB con el protocolo TUS de Supabase: si la
      // cobertura falla o el móvil suspende la app, se reintenta solo y sigue por el trozo en que iba (antes, una
      // sola petición que el iPhone cortaba con «timed out» y había que empezar de cero). alProgreso(0…1).
      // bucket: «archivos» (de siempre) o «comunidad» (v0.43, las fotos del muro: pequeñas, de una vez)
      async subir(ruta, archivo, tipo, { alProgreso = null, senal = null, bucket = 'archivos', urlSubida = null, alUrlSubida = null } = {}) {
        await conSesion();
        if (!archivo || archivo.size <= TROZO || bucket !== 'archivos') {
          // (v0.56) «Cancelar» también en una pequeña (de una vez): deja de esperarla; si llega a subirse, su fila se borra
          // y su archivo va a la cola de Storage (lo hace la base)
          let cancelar = null;
          const cancelada = new Promise((_, mal) => { cancelar = () => { const e = new Error('Cancelado'); e.cancelado = true; mal(e); }; });
          if (senal) senal.abortar = cancelar;
          alProgreso?.(0.1);
          const { error } = await Promise.race([sb.storage.from(bucket).upload(ruta, archivo, { contentType: tipo, upsert: false, cacheControl: '3600' }), cancelada]);
          // Ya subido por un intento anterior (llegó el archivo, no la respuesta): vale
          if (error && !(String(error.statusCode) === '409' || /already exists|duplicate/i.test(error.message || ''))) throw traducir(error);
          alProgreso?.(1);
          return;
        }
        const pedirToken = async () => {
          const { data } = await sb.auth.getSession(); // la renueva si está a punto de caducar
          const t = data?.session?.access_token;
          if (!t) throw traducir({ message: 'not authenticated' });
          return t;
        };
        await pedirToken();
        await subirPorTrozos({ endpoint: `${url.replace(/\/$/, '')}/storage/v1/upload/resumable`, token: pedirToken, anonKey, ruta, archivo, tipo, alProgreso, senal, bucket, urlSubida, alUrlSubida });
      },
      // descargar (v0.55): el nombre con que se guarda («Guardar», que la persona pide)
      async url(ruta, segundos = 3600, bucket = 'archivos', { descargar = null } = {}) {
        await conSesion();
        const { data, error } = await sb.storage.from(bucket).createSignedUrl(ruta, segundos, descargar ? { download: descargar } : undefined);
        if (error) throw traducir(error);
        return data.signedUrl;
      },
      // v0.55: copiar (reenviar y difundir, el coach): Storage comprueba que quien copia ve el original y puede subir la copia
      // (la del coach, con su fila ya registrada en archivos: así ese atleta la ve). La ruta de la copia es nueva cada vez:
      // si ya existe algo ahí (409), no es esta copia, así que es un error (no se da por buena).
      async copiar(desde, hasta, bucket = 'archivos') {
        const { error } = await sb.storage.from(bucket).copy(desde, hasta);
        if (error) throw traducir(error);
      },
      // Devuelve las rutas que de verdad se han borrado (las que no se pueden ver o no existen no salen)
      async borrar(rutas, bucket = 'archivos') {
        const hechas = [];
        if (!rutas.length) return hechas;
        for (let i = 0; i < rutas.length; i += 500) {
          const { data, error } = await sb.storage.from(bucket).remove(rutas.slice(i, i + 500));
          if (error) throw traducir(error);
          for (const f of data || []) if (f?.name) hechas.push(f.name);
        }
        return hechas;
      },
      // Todos los archivos de una carpeta (<atleta_id>), de 1000 en 1000
      async listar(carpeta, bucket = 'archivos') {
        const rutas = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await sb.storage.from(bucket).list(carpeta, { limit: 1000, offset });
          if (error) throw traducir(error);
          rutas.push(...data.filter((f) => f.id).map((f) => `${carpeta}/${f.name}`));
          if (data.length < 1000) return rutas;
        }
      },
    },
    async select(tabla, f) { await conSesion(); return sel(tabla, f); },
    async insert(tabla, filas) {
      await conSesion();
      const { data, error } = await sb.from(tabla).insert(filas).select();
      if (error) throw traducir(error);
      return data;
    },
    async update(tabla, cambios, f) {
      await conSesion();
      const { data, error } = await aplicarFiltro(sb.from(tabla).update(cambios), f).select();
      if (error) throw traducir(error);
      return data;
    },
    async upsert(tabla, filas, onConflict) {
      await conSesion();
      const { data, error } = await sb.from(tabla).upsert(filas, { onConflict }).select();
      if (error) throw traducir(error);
      return data;
    },
    async delete(tabla, f) {
      await conSesion();
      const { error } = await aplicarFiltro(sb.from(tabla).delete(), f);
      if (error) throw traducir(error);
    },
    async rpc(nombre, args) {
      await conSesion();
      const { data, error } = await sb.rpc(nombre, args);
      if (error) throw traducir(error);
      return data;
    },
    // Funciones de Supabase (Edge Functions), con la sesión de quien llama
    async funcion(nombre, cuerpo = {}) {
      await conSesion();
      // En la región de la base (Frankfurt): lo que se procesa se queda en la UE
      const { data, error } = await sb.functions.invoke(nombre, { body: cuerpo, headers: { 'x-region': 'eu-central-1' } });
      if (error) throw error;
      return data;
    },
  };
}
