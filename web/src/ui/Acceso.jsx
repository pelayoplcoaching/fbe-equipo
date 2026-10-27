import { useState } from 'preact/hooks';
import { useApp, Marca, Icono, Hoja } from './comunes.jsx';
import { guardarActivacionPendiente } from './App.jsx';
import { PRIVACIDAD, TEXTO_CONSENTIMIENTO_SALUD } from '../legal.js';

const PERSONAS_DEMO = [
  ['pelayo@fbe.demo', 'Pelayo', 'Coach: panel de atletas y programación', 'P'],
  ['ana@fbe.demo', 'Ana López', 'Atleta: semana 4 de su bloque de fuerza', 'A'],
  ['ruben@fbe.demo', 'Rubén Martín', 'Atleta: con una molestia lumbar', 'R'],
  ['carlos@fbe.demo', 'Carlos Vera', 'Atleta: recomposición, con cardio y dos semanas parado', 'C'],
  ['lucia@fbe.demo', 'Lucía Ferrer', 'Atleta: solo nutrición, con su recetario y su menú', 'L'],
];

export function Acceso() {
  const { backend, modo } = useApp();
  const [vista, setVista] = useState('entrar'); // entrar | activar | recuperar
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function comoDemo(email) {
    setError(null);
    try { await backend.auth.entrar(email, 'demo'); } catch (e) { setError(e.message); }
  }

  return (
    <div class="app"><div class="acceso"><div class="acceso-caja">
      <Marca />
      {vista === 'entrar' && (
        <>
          <div class="pila-s">
            <h1>Entra en tu cuenta</h1>
            <p class="lema">Tu programa, el registro de cada serie y el seguimiento con tu coach.</p>
          </div>
          {modo === 'demo' && (
            <div class="pila">
              <div class="nota">Esto es una demo con atletas ficticios. Elige con quién entrar:</div>
              {PERSONAS_DEMO.map(([email, nombre, rol, ini]) => (
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
          <FormEntrar setError={setError} error={error} ocupado={ocupado} setOcupado={setOcupado} irRecuperar={() => setVista('recuperar')} />
          <div class="nota">¿Tu coach te ha dado un código? <button class="btn-texto" onClick={() => { setError(null); setVista('activar'); }}>Activa tu cuenta</button></div>
        </>
      )}
      {vista === 'activar' && <Activar volver={() => { setError(null); setVista('entrar'); }} />}
      {vista === 'recuperar' && <Recuperar volver={() => setVista('entrar')} />}
    </div></div></div>
  );
}

function FormEntrar({ error, setError, ocupado, setOcupado, irRecuperar }) {
  const { backend, modo } = useApp();
  const [email, setEmail] = useState('');
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
      <div class="campo">
        <label for="acc-pass">Contraseña</label>
        <input id="acc-pass" class="entrada" type="password" autoComplete="current-password" required value={password} onInput={(e) => setPassword(e.currentTarget.value)} />
        {modo === 'demo' && <span class="ayuda">En la demo, la contraseña de todas las cuentas es «demo».</span>}
      </div>
      <button class="btn btn-primario btn-grande" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
      <button type="button" class="btn-texto" onClick={irRecuperar}>He olvidado mi contraseña</button>
    </form>
  );
}

function Recuperar({ volver }) {
  const { backend } = useApp();
  const [email, setEmail] = useState('');
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

export function TextoPrivacidad() {
  return (
    <div class="pila">
      <div class="nota">Borrador pendiente de revisión: faltan los datos de contacto del responsable.</div>
      {PRIVACIDAD.map(([t, d]) => <div class="pila-s" key={t}><strong>{t}</strong><p class="secundario">{d}</p></div>)}
    </div>
  );
}

function Activar({ volver }) {
  const { backend, modo } = useApp();
  const [f, setF] = useState({ codigo: modo === 'demo' ? 'FBE-MARTA-7K3PQ' : '', nombre: '', email: '', password: '', privacidad: false, salud: false });
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [verPrivacidad, setVerPrivacidad] = useState(false);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.type === 'checkbox' ? e.currentTarget.checked : e.currentTarget.value });

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    if (!/^FBE[-\s]?[A-Z0-9]{5}[-\s]?[A-Z0-9]{5}$/i.test(f.codigo.trim())) { setError('El código tiene este formato: FBE-XXXXX-XXXXX.'); return; }
    if (f.password.length < 10) { setError('La contraseña necesita al menos 10 caracteres.'); return; }
    if (!f.privacidad) { setError('Para activar la cuenta tienes que aceptar la política de privacidad.'); return; }
    setOcupado(true);
    // El canje y los consentimientos los completa App al detectar la sesión nueva (también si hay que confirmar el email).
    guardarActivacionPendiente({ codigo: f.codigo.trim(), privacidad: true, salud: f.salud });
    try {
      const r = await backend.auth.registrar(f.email.trim(), f.password, f.nombre.trim());
      if (r?.confirmarEmail) { setConfirmar(true); return; }
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  if (confirmar) {
    return (
      <div class="pila">
        <h1>Revisa tu correo</h1>
        <p class="lema">Te hemos enviado un enlace a <strong>{f.email}</strong>. Ábrelo desde este móvil y tu cuenta quedará activada con tu código.</p>
        <button class="btn-texto" onClick={volver}><Icono n="atras" /> Volver</button>
      </div>
    );
  }

  return (
    <form class="pila" onSubmit={enviar}>
      <div class="pila-s">
        <h1>Activa tu cuenta</h1>
        <p class="lema">Con el código que te ha dado tu coach. Solo se usa una vez.</p>
      </div>
      {error && <div class="error" role="alert">{error}</div>}
      <div class="campo">
        <label for="act-codigo">Código de invitación</label>
        <input id="act-codigo" class="entrada num" autoCapitalize="characters" autoComplete="one-time-code" placeholder="FBE-XXXXX-XXXXX" required value={f.codigo} onInput={cambiar('codigo')} />
      </div>
      <div class="campo">
        <label for="act-nombre">Tu nombre</label>
        <input id="act-nombre" class="entrada" autoComplete="given-name" required value={f.nombre} onInput={cambiar('nombre')} />
      </div>
      <div class="campo">
        <label for="act-email">Email</label>
        <input id="act-email" class="entrada" type="email" autoComplete="email" required value={f.email} onInput={cambiar('email')} />
      </div>
      <div class="campo">
        <label for="act-pass">Crea una contraseña</label>
        <input id="act-pass" class="entrada" type="password" autoComplete="new-password" minLength={10} required value={f.password} onInput={cambiar('password')} />
        <span class="ayuda">Al menos 10 caracteres.</span>
      </div>
      <label class="casilla">
        <input type="checkbox" checked={f.privacidad} onChange={cambiar('privacidad')} />
        <span>He leído y acepto la <button type="button" class="btn-texto" style="padding:0;min-height:0" onClick={() => setVerPrivacidad(true)}>política de privacidad</button>.</span>
      </label>
      <label class="casilla">
        <input type="checkbox" checked={f.salud} onChange={cambiar('salud')} />
        <span>{TEXTO_CONSENTIMIENTO_SALUD} <span class="terciario">Sin él podrás entrenar, pero no registrar peso, check-in ni molestias.</span></span>
      </label>
      <button class="btn btn-primario btn-grande" disabled={ocupado}>{ocupado ? 'Activando…' : 'Activar cuenta'}</button>
      <button type="button" class="btn-texto" onClick={volver}><Icono n="atras" /> Ya tengo cuenta</button>
      {verPrivacidad && <Hoja titulo="Política de privacidad" alCerrar={() => setVerPrivacidad(false)}><TextoPrivacidad /></Hoja>}
    </form>
  );
}

// Cuenta creada pero sin vincular a una ficha de atleta (el código falló o se confirmó el email en otro dispositivo)
export function Vincular() {
  const { recargar, salir, perfil, codigoFallido } = useApp();
  const [f, setF] = useState({ codigo: '', privacidad: false, salud: false });
  const [error, setError] = useState(codigoFallido ? 'El código no es válido o ha caducado. Pide uno nuevo a tu coach.' : null);
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
        <p class="lema">Hola{perfil?.nombre ? `, ${perfil.nombre}` : ''}. Tu cuenta está creada; falta vincularla con el código que te dio tu coach.</p>
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
      <div class="campo">
        <label for="np-pass">Contraseña nueva</label>
        <input id="np-pass" class="entrada" type="password" autoComplete="new-password" minLength={10} required value={pass} onInput={(e) => setPass(e.currentTarget.value)} />
        <span class="ayuda">Al menos 10 caracteres.</span>
      </div>
      <button class="btn btn-primario btn-grande">Guardar y entrar</button>
    </form></div></div>
  );
}

// Segundo paso al entrar, para cuentas con la verificación en dos pasos activada
export function SegundoPaso() {
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
