// (alta, v0.239) Las pantallas de entrada, en su propio trozo (Acceso.jsx las carga al hacer falta): entrar, activar la
// cuenta con el código de la invitación, recuperar la contraseña, vincular el código si falló y el segundo paso del coach.
// «Activa tu cuenta»: con el enlace de la invitación, el código ya va puesto; si el email ya tiene cuenta, «Entrar» o «He
// olvidado mi contraseña» (el código se aplica al entrar); si hay que confirmar el email, «Revisa tu correo» con «Reenviar
// el enlace»; y, para FBE Esencial, por qué hace falta el consentimiento de salud.
import { useEffect, useState } from 'preact/hooks';
import { useApp, Marca, Icono, Hoja } from './comunes.jsx';
import { guardarActivacionPendiente } from './App.jsx';
import { TEXTO_CONSENTIMIENTO_SALUD } from '../legal-version.js';
import { Imagen } from './Imagen.jsx';
import { CieloHora } from './Cielo.jsx';
import { CORREO_CONTACTO } from '../logica/esencial.js';
import { invitacionDelEnlace, CLAVE_ALGUNA_VEZ, TextoPrivacidad } from './Acceso.jsx';

const algunaVez = () => { try { return localStorage.getItem(CLAVE_ALGUNA_VEZ) === '1'; } catch { return true; } };

// (alta, 10) Al volver del enlace del correo con un error («#error_code=otp_expired…»), una frase llana en lugar de nada
function errorDelEnlace() {
  try {
    const h = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    const codigo = h.get('error_code') || (h.get('error') ? 'otro' : null);
    if (!codigo) return null;
    history.replaceState(history.state, '', location.pathname + location.search);
    return codigo === 'otp_expired'
      ? 'El enlace del correo ha caducado o ya se usó. Si aún no habías confirmado tu cuenta, actívala otra vez y te llegará otro; si ya la confirmaste, entra con tu email y tu contraseña.'
      : 'No se ha podido abrir el enlace del correo. Entra con tu email y tu contraseña o pide otro enlace.';
  } catch { return null; }
}


// (alta, 5) La contraseña, con el ojo para verla y el aviso de las mayúsculas activadas
export function CampoClave({ id, etiqueta, valor, alCambiar, nueva = false, ayuda = null }) {
  const [ver, setVer] = useState(false);
  const [mayus, setMayus] = useState(false);
  const mirar = (e) => { try { setMayus(!!e.getModifierState?.('CapsLock')); } catch { /* */ } };
  return (
    <div class="campo">
      <label for={id}>{etiqueta}</label>
      <span class="alta-clave">
        <input id={id} class="entrada" type={ver ? 'text' : 'password'} autoComplete={nueva ? 'new-password' : 'current-password'} required minLength={nueva ? 10 : undefined}
          autoCapitalize="none" spellcheck={false} value={valor} onInput={(e) => alCambiar(e.currentTarget.value)} onKeyDown={mirar} onKeyUp={mirar} onBlur={() => setMayus(false)}
          aria-describedby={mayus ? `${id}-mayus` : undefined} />
        <button type="button" class="alta-ojo" aria-controls={id} aria-pressed={ver ? 'true' : 'false'} aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          onClick={() => setVer(!ver)}><Icono n={ver ? 'ojo' : 'ojo-abierto'} /></button>
      </span>
      {mayus && <span id={`${id}-mayus`} class="ayuda alta-mayus" role="status"><Icono n="alerta" width="14" height="14" /> Tienes las mayúsculas activadas.</span>}
      {ayuda && <span class="ayuda">{ayuda}</span>}
    </div>
  );
}


const PERSONAS_DEMO = [
  ['pelayo@fbe.demo', 'Pelayo', 'Coach: panel de atletas y programación', 'P'],
  ['ana@fbe.demo', 'Ana López', 'Atleta: semana 4 de su bloque de fuerza', 'A'],
  ['ruben@fbe.demo', 'Rubén Martín', 'Atleta: con una molestia lumbar', 'R'],
  ['carlos@fbe.demo', 'Carlos Vera', 'Atleta: recomposición, con cardio y dos semanas parado', 'C'],
  ['lucia@fbe.demo', 'Lucía Ferrer', 'Atleta: solo nutrición, con su recetario y su menú', 'L'],
  ['ivan@fbe.demo', 'Iván Prieto', 'Atleta: microciclos de 4 sesiones, 3 días por semana', 'I'],
];
// (FBE Esencial) en ?demo=esencial: quienes van por su cuenta, con la plantilla de la guía del vídeo
const PERSONAS_ESENCIAL = [
  ['marina@fbe.demo', 'Marina Ortega', 'FBE Esencial: acaba de entrar (su cuestionario y su semana 1)', 'M'],
  ['tomas@fbe.demo', 'Tomás Rey', 'FBE Esencial: ha terminado las cuatro semanas; sus marcas', 'T'],
  ['clara@fbe.demo', 'Clara Prieto', 'FBE Esencial: espera que Pelayo confirme su visto bueno médico', 'C'],
  ['ines@fbe.demo', 'Inés Gil', 'FBE Esencial con nutrición: prepara su plan de comida', 'I'],
  ['luciav@fbe.demo', 'Lucía Vidal', 'FBE Esencial: empieza de cero dentro de dos lunes (la espera)', 'L'],
  ['andresm@fbe.demo', 'Andrés Mora', 'FBE Esencial: ya entrena y empieza el lunes que viene', 'A'],
  ['pelayo@fbe.demo', 'Pelayo', 'Coach: panel de atletas', 'P'],
];


// (diseño) Mientras se ve una pantalla de entrada, la barra del sistema sigue del color de la noche de la portada de
// arranque (la franja de arriba de estas pantallas, en diseno.css, bloque 17): va la primera, que es la que manda
function useBarraNoche() {
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'theme-color'; m.content = '#1E1548'; m.id = 'tc-entrada';
    document.head.prepend(m);
    return () => m.remove();
  }, []);
}


export function Acceso() {
  useBarraNoche();
  const { backend, modo } = useApp();
  // (alta, 2) con el enlace de la invitación, directamente «Activa tu cuenta», con su código
  const enlace = invitacionDelEnlace();
  const [vista, setVista] = useState(enlace ? 'activar' : 'entrar'); // entrar | activar | recuperar
  const [error, setError] = useState(errorDelEnlace);
  const [ocupado, setOcupado] = useState(false);
  // (alta, 6) el email que ya escribió al activar, si resulta que ya tenía cuenta (para entrar o recuperar la contraseña)
  const [email, setEmail] = useState('');
  const primera = !algunaVez() && modo !== 'demo';
  // (diseño, tanda 12) al cambiar de formulario se empieza arriba: si no, viniendo de una pantalla más larga, el título
  // del nuevo quedaba cortado
  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* */ } }, [vista]);
  const irActivar = () => { setError(null); setVista('activar'); };

  async function comoDemo(email) {
    setError(null);
    try { await backend.auth.entrar(email, 'demo'); } catch (e) { setError(e.message); }
  }
  // (v0.249) «Ver como…» del panel de FBE Esencial: en la demo, «?como=tomas» entra directamente con esa persona
  useEffect(() => { if (modo === 'demo') { const m = /[?&]como=([a-z]{2,12})(&|$)/.exec(location.search); if (m) comoDemo(`${m[1]}@fbe.demo`); } }, []);

  return (
    <div class="app">
      {/* (imágenes, bloque T) la noche de arriba: el lobo bajo la luna al entrar; la puerta del gimnasio al activar la cuenta */}
      <Imagen key={vista === 'activar' ? 'activar' : 'acceso'} id={vista === 'activar' ? 'activar-fondo' : 'acceso-fondo'} clase="acceso-fondo" tamanos="(min-width: 700px) 480px, 85vw" prioridad />
      {/* (v0.200) y encima, el cielo de la hora: la luz del amanecer o del atardecer, o las estrellas de la noche */}
      <CieloHora clase="acceso-cielo" />
      <div class="acceso"><div class="acceso-caja">
      <Marca />
      {vista === 'entrar' && (
        <>
          {/* (alta, 19) la primera vez en este móvil, lo primero: activar la cuenta con el código de la invitación */}
          {primera && (
            <section class="alta-primera" aria-labelledby="alta-primera-t">
              <strong id="alta-primera-t">¿Es tu primera vez?</strong>
              <span class="peq">Si te ha llegado una invitación, activa tu cuenta con su código.</span>
              <button type="button" class="btn btn-primario btn-grande" onClick={irActivar}>Activa tu cuenta</button>
            </section>
          )}
          <div class="pila-s">
            <h1>Entra en tu cuenta</h1>
            <p class="lema">Tu programa y el registro de cada serie.</p>
          </div>
          {modo === 'demo' && (
            <div class="pila">
              <div class="nota">Esto es una demo con atletas ficticios. Elige con quién entrar:</div>
              {(backend.variante === 'esencial' ? PERSONAS_ESENCIAL : PERSONAS_DEMO).map(([email, nombre, rol, ini]) => (
                <button class="persona" key={email} onClick={() => comoDemo(email)}>
                  <span class="avatar" aria-hidden="true">{ini}</span>
                  <span><strong>{nombre}</strong><br /><span class="rol">{rol}</span></span>
                  <Icono n="derecha" width="20" height="20" />
                </button>
              ))}
              <button class="persona" onClick={() => setVista('activar')}>
                <span class="avatar" aria-hidden="true">M</span>
                <span><strong>Marta Gil</strong><br /><span class="rol">Atleta nueva: activa su cuenta con el código FBE-MARTA-7K3PQ</span></span>
                <Icono n="derecha" width="20" height="20" />
              </button>
            </div>
          )}
          <FormEntrar setError={setError} error={error} ocupado={ocupado} setOcupado={setOcupado} irRecuperar={() => setVista('recuperar')} emailInicial={email} />
          {!primera && <div class="nota">¿Tienes un código de invitación? <button class="btn-texto" onClick={irActivar}>Activa tu cuenta</button></div>}
        </>
      )}
      {vista === 'activar' && <Activar volver={() => { setError(null); setVista('entrar'); }} codigoInicial={enlace?.codigo || null} esencial={!!enlace?.esencial}
        irEntrar={(e) => { setEmail(e || ''); setError(null); setVista('entrar'); }} irRecuperar={(e) => { setEmail(e || ''); setVista('recuperar'); }} />}
      {vista === 'recuperar' && <Recuperar volver={() => setVista('entrar')} emailInicial={email} />}
    </div></div></div>
  );
}

function FormEntrar({ error, setError, ocupado, setOcupado, irRecuperar, emailInicial = '' }) {
  const { backend, modo } = useApp();
  const [email, setEmail] = useState(emailInicial || '');
  const [password, setPassword] = useState('');
  async function enviar(e) {
    e.preventDefault();
    setError(null); setOcupado(true);
    try { await backend.auth.entrar(email.trim(), password); } catch (err) { setError(err.message); } finally { setOcupado(false); }
  }
  return (
    <form class="pila" onSubmit={enviar}>
      {error && <div class="error" role="alert">{error}</div>}
      <div class="campo">
        <label for="acc-email">Email</label>
        <input id="acc-email" class="entrada" type="email" autoComplete="email" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
      </div>
      <CampoClave id="acc-pass" etiqueta="Contraseña" valor={password} alCambiar={setPassword}
        ayuda={modo === 'demo' ? 'En la demo, la contraseña de todas las cuentas es «demo».' : null} />
      <button class="btn btn-primario btn-grande" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
      <button type="button" class="btn-texto" onClick={irRecuperar}>He olvidado mi contraseña</button>
    </form>
  );
}

function Recuperar({ volver, emailInicial = '' }) {
  const { backend } = useApp();
  const [email, setEmail] = useState(emailInicial || '');
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState(null);
  async function enviar(e) {
    e.preventDefault();
    try { await backend.auth.recuperar(email.trim()); setHecho(true); } catch (err) { setError(err.message); }
  }
  return (
    <form class="pila" onSubmit={enviar}>
      <h1>Recupera tu contraseña</h1>
      {hecho ? <div class="nota">Si hay una cuenta con ese email, te llegará un enlace para crear una contraseña nueva.</div> : (
        <>
          {error && <div class="error" role="alert">{error}</div>}
          <div class="campo">
            <label for="rec-email">Email de tu cuenta</label>
            <input id="rec-email" class="entrada" type="email" required autoComplete="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
          </div>
          <button class="btn btn-primario btn-grande">Enviar enlace</button>
        </>
      )}
      <button type="button" class="btn-texto" onClick={volver}><Icono n="atras" /> Volver</button>
    </form>
  );
}


// (alta, 4) Por qué no vale el código (invitacion_estado, migración 097). Sin la 097 (f === true), la frase de siempre.
export function textoCodigoFallido(f) {
  if (!f) return null;
  const otro = f.esencial ? `Escribe a Pelayo (${CORREO_CONTACTO}) y te manda uno nuevo.` : 'Pide uno nuevo a tu coach.';
  switch (f.estado) {
    case 'no_existe': return 'Ese código no existe. Revisa que esté bien escrito: FBE y dos grupos de cinco letras y números (FBE-XXXXX-XXXXX).';
    case 'caducado': return `Ese código ha caducado. ${otro}`;
    case 'reemplazado': return 'Ese código ya no vale porque hay uno más nuevo: búscalo en el último mensaje de tu invitación.';
    case 'usado': return 'Ese código ya se usó para activar una cuenta. Si fuiste tú, cierra la sesión y entra con el email con el que la activaste.';
    case 'demasiados': return 'Demasiados intentos con códigos que no valen. Prueba dentro de una hora.';
    default: return 'El código no vale: puede que esté mal escrito o que haya caducado. Pide uno nuevo a quien te invitó.';
  }
}

// Cuenta creada pero sin vincular a una ficha de atleta (el código falló o se confirmó el email en otro dispositivo)
export function Vincular() {
  useBarraNoche();
  const { recargar, salir, perfil, codigoFallido } = useApp();
  const [f, setF] = useState(() => ({ codigo: codigoFallido ? '' : (invitacionDelEnlace()?.codigo || ''), privacidad: false, salud: false }));
  const [error, setError] = useState(() => textoCodigoFallido(codigoFallido));
  const [verPrivacidad, setVerPrivacidad] = useState(false);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.type === 'checkbox' ? e.currentTarget.checked : e.currentTarget.value });
  async function enviar(e) {
    e.preventDefault();
    if (!f.privacidad) { setError('Para continuar tienes que aceptar la política de privacidad.'); return; }
    setError(null);
    guardarActivacionPendiente({ codigo: f.codigo.trim(), privacidad: true, salud: f.salud });
    await recargar();
  }
  return (
    <div class="app"><div class="acceso"><form class="acceso-caja" onSubmit={enviar}>
      <Marca />
      <div class="pila-s">
        <h1>Introduce tu código</h1>
        <p class="lema">Hola{perfil?.nombre ? `, ${perfil.nombre}` : ''}. Tu cuenta está creada; falta vincularla con el código de tu invitación.</p>
      </div>
      {error && <div class="error" role="alert">{error}</div>}
      <div class="campo">
        <label for="vin-codigo">Código de invitación</label>
        <input id="vin-codigo" class="entrada num" autoCapitalize="characters" placeholder="FBE-XXXXX-XXXXX" required value={f.codigo} onInput={cambiar('codigo')} />
      </div>
      <label class="casilla">
        <input type="checkbox" checked={f.privacidad} onChange={cambiar('privacidad')} />
        <span>He leído y acepto la <button type="button" class="btn-texto" style="padding:0;min-height:0" onClick={() => setVerPrivacidad(true)}>política de privacidad</button>.</span>
      </label>
      <label class="casilla">
        <input type="checkbox" checked={f.salud} onChange={cambiar('salud')} />
        <span>{TEXTO_CONSENTIMIENTO_SALUD}</span>
      </label>
      <button class="btn btn-primario btn-grande">Vincular cuenta</button>
      <button type="button" class="btn-texto" onClick={salir}><Icono n="salir" /> Cerrar sesión</button>
      {verPrivacidad && <Hoja titulo="Política de privacidad" alCerrar={() => setVerPrivacidad(false)}><TextoPrivacidad /></Hoja>}
    </form></div></div>
  );
}

// Tras abrir el enlace de recuperación: crear la contraseña nueva
export function NuevaPassword() {
  useBarraNoche();
  const { backend, recargar, aviso } = useApp();
  const [pass, setPass] = useState('');
  const [error, setError] = useState(null);
  return (
    <div class="app"><div class="acceso"><form class="acceso-caja" onSubmit={async (e) => {
      e.preventDefault();
      if (pass.length < 10) { setError('La contraseña necesita al menos 10 caracteres.'); return; }
      try { await backend.auth.cambiarPassword(pass); aviso('Contraseña cambiada'); try { history.replaceState(null, '', location.pathname); } catch { /* */ } await recargar(); }
      catch (err) { setError(err.message); }
    }}>
      <Marca />
      <h1>Crea una contraseña nueva</h1>
      {error && <div class="error" role="alert">{error}</div>}
      <CampoClave id="np-pass" etiqueta="Contraseña nueva" valor={pass} alCambiar={setPass} nueva ayuda="Al menos 10 caracteres." />
      <button class="btn btn-primario btn-grande">Guardar y entrar</button>
    </form></div></div>
  );
}

// Segundo paso al entrar, para cuentas con la verificación en dos pasos activada
export function SegundoPaso() {
  useBarraNoche();
  const { backend, recargar, salir, modo } = useApp();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    setOcupado(true); setError(null);
    try {
      const factores = (await backend.auth.mfa.factores()).filter((f) => f.estado === 'verified');
      let ultimoError = null;
      for (const f of factores) {
        try { await backend.auth.mfa.verificar(f.id, codigo); ultimoError = null; break; } catch (err) { ultimoError = err; }
      }
      if (ultimoError) throw ultimoError;
      await recargar();
    } catch (err) { setError(err.message); setOcupado(false); }
  }
  return (
    <div class="app"><div class="acceso"><form class="acceso-caja" onSubmit={enviar}>
      <Marca />
      <div class="pila-s">
        <h1>Código de verificación</h1>
        <p class="lema">Escribe el código de 6 cifras de tu app de verificación.</p>
      </div>
      {error && <div class="error" role="alert">{error}</div>}
      <div class="campo">
        <label for="sp-codigo">Código</label>
        <input id="sp-codigo" class="entrada num codigo-mfa" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus
          value={codigo} onInput={(e) => setCodigo(e.currentTarget.value.replace(/\D/g, ''))} />
        {modo === 'demo' && <span class="ayuda">En la demo, el código es 123456.</span>}
      </div>
      <button class="btn btn-primario btn-grande" disabled={ocupado || codigo.length < 6}>{ocupado ? 'Comprobando…' : 'Entrar'}</button>
      <button type="button" class="btn-texto" onClick={salir}><Icono n="salir" /> Cerrar sesión</button>
    </form></div></div>
  );
}


// ---------- Activa tu cuenta ----------
const FORMATO = /^FBE[-\s]?[A-Z0-9]{5}[-\s]?[A-Z0-9]{5}$/i;

export function Activar({ volver, irEntrar, irRecuperar, codigoInicial = null, esencial = false }) {
  const { backend, modo } = useApp();
  const [f, setF] = useState({ codigo: codigoInicial || (modo === 'demo' ? 'FBE-MARTA-7K3PQ' : ''), nombre: '', email: '', password: '', privacidad: false, salud: false });
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [verPrivacidad, setVerPrivacidad] = useState(false);
  // (alta, 6) el email ya tiene cuenta: entrar con ella (el código se canjea al entrar, si aún no está vinculada)
  const [existe, setExiste] = useState(false);
  // (alta, 8) FBE Esencial sin el consentimiento de salud: se avisa una vez antes de seguir
  const [avisoSalud, setAvisoSalud] = useState(false);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.type === 'checkbox' ? e.currentTarget.checked : e.currentTarget.value });

  async function enviar(e) {
    e.preventDefault();
    setError(null); setExiste(false);
    if (!FORMATO.test(f.codigo.trim())) { setError('El código tiene este formato: FBE-XXXXX-XXXXX.'); return; }
    if (!f.nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (f.password.length < 10) { setError('La contraseña necesita al menos 10 caracteres.'); return; }
    if (!f.privacidad) { setError('Para activar la cuenta tienes que aceptar la política de privacidad.'); return; }
    if (esencial && !f.salud && !avisoSalud) { setAvisoSalud(true); return; }
    setOcupado(true);
    // El canje y los consentimientos los completa App al detectar la sesión nueva (también si hay que confirmar el email).
    guardarActivacionPendiente({ codigo: f.codigo.trim(), privacidad: true, salud: f.salud });
    try {
      const r = await backend.auth.registrar(f.email.trim(), f.password, f.nombre.trim());
      if (r?.confirmarEmail) { setConfirmar(true); return; }
    } catch (err) {
      if (err?.codigo === 'user_already_exists') setExiste(true);
      else setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  if (confirmar) return <RevisaCorreo email={f.email.trim()} cambiarEmail={() => setConfirmar(false)} volver={volver} />;

  return (
    <form class="pila" onSubmit={enviar}>
      <div class="pila-s">
        <h1>Activa tu cuenta</h1>
        <p class="lema">Con el código de tu invitación. Solo se usa una vez.</p>
      </div>
      {error && <div class="error" role="alert">{error}</div>}
      {existe && (
        <div class="nota pila-s alta-existe" role="alert">
          <span>Ya hay una cuenta con <strong>{f.email.trim()}</strong>. Si es tuya, entra con tu contraseña: tu código se aplicará al entrar.</span>
          <span class="fila-envolver">
            <button type="button" class="btn btn-primario btn-peq" onClick={() => irEntrar?.(f.email.trim())}>Entrar</button>
            <button type="button" class="btn btn-peq" onClick={() => irRecuperar?.(f.email.trim())}>He olvidado mi contraseña</button>
          </span>
        </div>
      )}
      <div class="campo">
        <label for="act-codigo">Código de invitación</label>
        <input id="act-codigo" class="entrada num" autoCapitalize="characters" autoComplete="one-time-code" placeholder="FBE-XXXXX-XXXXX" required value={f.codigo} onInput={cambiar('codigo')} />
        {codigoInicial && f.codigo === codigoInicial && <span class="ayuda">Ya viene puesto desde tu invitación.</span>}
      </div>
      <div class="campo">
        <label for="act-nombre">Tu nombre</label>
        <input id="act-nombre" class="entrada" autoComplete="given-name" required value={f.nombre} onInput={cambiar('nombre')} />
      </div>
      <div class="campo">
        <label for="act-email">Email</label>
        <input id="act-email" class="entrada" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellcheck={false} required value={f.email} onInput={cambiar('email')} />
      </div>
      <CampoClave id="act-pass" etiqueta="Crea una contraseña" valor={f.password} alCambiar={(v) => setF({ ...f, password: v })} nueva ayuda="Al menos 10 caracteres." />
      <label class="casilla">
        <input type="checkbox" checked={f.privacidad} onChange={cambiar('privacidad')} />
        <span>He leído y acepto la <button type="button" class="btn-texto" style="padding:0;min-height:0" onClick={() => setVerPrivacidad(true)}>política de privacidad</button>.</span>
      </label>
      <label class="casilla">
        <input type="checkbox" checked={f.salud} onChange={(e) => { cambiar('salud')(e); setAvisoSalud(false); }} />
        <span>{TEXTO_CONSENTIMIENTO_SALUD} <span class="terciario">{esencial
          ? 'En FBE Esencial lo necesitas: sin él, la app no puede usar las preguntas de salud de tu cuestionario para prepararte el plan.'
          : 'Sin él podrás entrenar, pero no registrar peso, check-in ni molestias. Si te has apuntado a FBE Esencial, lo necesitas para que la app te prepare el plan.'}</span></span>
      </label>
      {avisoSalud && (
        <div class="nota alta-aviso-salud" role="alert">Sin el consentimiento de salud, la app no podrá prepararte el plan de FBE Esencial (lo podrás dar después, desde tu perfil). Si quieres seguir sin él, toca otra vez «Activar cuenta».</div>
      )}
      <button class="btn btn-primario btn-grande" disabled={ocupado}>{ocupado ? 'Activando…' : 'Activar cuenta'}</button>
      <button type="button" class="btn-texto" onClick={volver}><Icono n="atras" /> Ya tengo cuenta</button>
      {verPrivacidad && <Hoja titulo="Política de privacidad" alCerrar={() => setVerPrivacidad(false)}><TextoPrivacidad /></Hoja>}
    </form>
  );
}

// (alta, 7) «Revisa tu correo»: el enlace se abre en este móvil; si no llega, mirar en spam o promociones y reenviarlo
// (una vez por minuto, como deja Supabase); y, si el email estaba mal, volver a escribirlo
function RevisaCorreo({ email, cambiarEmail, volver }) {
  const { backend } = useApp();
  const [espera, setEspera] = useState(0);
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!espera) return undefined;
    const t = setTimeout(() => setEspera((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [espera]);
  const reenviar = async () => {
    setError(null);
    try { await backend.auth.reenviarConfirmacion?.(email); setHecho(true); setEspera(60); } catch (e) { setError(e.message); }
  };
  return (
    <div class="pila">
      <h1>Revisa tu correo</h1>
      <p class="lema">Te hemos enviado un enlace a <strong>{email}</strong>. Ábrelo desde este móvil y tu cuenta quedará activada con tu código.</p>
      <p class="peq secundario">¿No te llega? Mira en spam o en promociones: a veces tarda unos minutos.</p>
      {error && <div class="error" role="alert">{error}</div>}
      {hecho && <p class="peq" role="status">Te lo hemos vuelto a enviar.</p>}
      <span class="fila-envolver">
        <button type="button" class="btn" disabled={espera > 0} onClick={reenviar}><Icono n="enviar" /> {espera > 0 ? `Reenviar el enlace (${espera} s)` : 'Reenviar el enlace'}</button>
        <button type="button" class="btn-texto" onClick={cambiarEmail}>Me he equivocado de email</button>
      </span>
      <button type="button" class="btn-texto" onClick={volver}><Icono n="atras" /> Volver</button>
    </div>
  );
}
