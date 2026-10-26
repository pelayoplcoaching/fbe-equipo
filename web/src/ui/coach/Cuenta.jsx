import { useState } from 'preact/hooks';
import { AjustesDispositivo } from '../Ajustes.jsx';
import { SeccionNotificaciones } from '../Notificaciones.jsx';
import { useApp, useCarga, Icono, Hoja, Cargando, HojaExportar, copiar, Avatar } from '../comunes.jsx';
import { num } from '../../logica/calculos.js';
import { BandaDemo } from '../App.jsx';
import { hoyISO } from '../../logica/fechas.js';

export function Cuenta() {
  const { perfil, backend, salir, api, aviso } = useApp();
  const [copia, setCopia] = useState(null);
  const [preparando, setPreparando] = useState(false);
  return (
    <div class="contenido coach">
      <header class="cabecera"><Avatar nombre={perfil?.nombre || 'Coach'} clase="grande" lleno /><div class="titulo"><h1>{perfil?.nombre || 'Cuenta'}</h1><div class="sub">{backend.auth.sesion()?.user.email}</div></div></header>
      <BandaDemo />
      <div class="panel">
        <ul class="lista">
          <li class="panel-pad separa"><span>{perfil?.nombre || 'Coach'}</span><span class="chip morado">Coach</span></li>
          <li class="panel-pad separa"><span>Cerrar sesión en este dispositivo</span><button class="btn btn-peq" onClick={salir}><Icono n="salir" /> Salir</button></li>
        </ul>
      </div>
      {backend.auth.mfa && <DosPasos />}
      <SeccionNotificaciones coach />
      <AjustesDispositivo coach />
      <Espacio />
      <section class="seccion">
        <h2>Copia de seguridad</h2>
        <div class="panel panel-pad pila-s">
          <p class="peq secundario">Supabase guarda copias diarias durante 7 días. Además, descarga una copia completa una vez al mes y guárdala tú (sin subirla a ningún sitio compartido: lleva datos de salud).</p>
          <button class="btn" style="justify-self:start" disabled={preparando} onClick={async () => {
            setPreparando(true);
            try { setCopia(JSON.stringify(await api.copiaCompleta(), null, 1)); } catch (e) { aviso(e.message, 'error'); } finally { setPreparando(false); }
          }}><Icono n="descargar" /> {preparando ? 'Preparando…' : 'Descargar copia completa'}</button>
        </div>
      </section>
      <p class="mini terciario">FBE Equipo, versión 0.18.</p>
      {copia && <HojaExportar titulo="Copia completa" nombre={`fbe-atletas-copia-${hoyISO()}.json`} contenido={copia} tipo="application/json" alCerrar={() => setCopia(null)} />}
    </div>
  );
}

// Verificación en dos pasos (TOTP). Con ella activada, tus permisos de coach solo valen tras escribir el código.
function DosPasos() {
  const { backend, api, aviso, modo } = useApp();
  const factores = useCarga(() => backend.auth.mfa.factores(), []);
  const [alta, setAlta] = useState(false);
  const [quitar, setQuitar] = useState(null);
  const verificados = (factores.datos || []).filter((f) => f.estado === 'verified');
  return (
    <section class="seccion">
      <h2>Verificación en dos pasos</h2>
      <div class="panel panel-pad pila">
        {factores.cargando && !factores.datos ? <Cargando /> : verificados.length ? (
          <>
            <p class="estado-escudo"><Icono n="escudo" /><span><strong>Activada.</strong> Al entrar, la app te pedirá el código de tu app de verificación; sin él, tu cuenta no ve ningún dato.</span></p>
            <ul class="lista">
              {verificados.map((f) => (
                <li key={f.id} class="separa" style="padding:8px 0"><span class="fila" style="gap:8px"><Icono n="movil" width="18" height="18" style="flex:none" />{f.nombre}</span><button class="btn btn-peq btn-peligro" onClick={() => setQuitar(f)}>Quitar</button></li>
              ))}
            </ul>
            <button class="btn btn-peq" style="justify-self:start" onClick={() => setAlta(true)}><Icono n="mas" /> Añadir otro dispositivo</button>
            <p class="mini terciario">Consejo: añade un segundo dispositivo o guarda el código secreto en tu gestor de contraseñas, por si pierdes el móvil.</p>
          </>
        ) : (
          <>
            <p class="secundario">Tu cuenta ve los datos de salud de todos tus atletas. Con la verificación en dos pasos, aunque alguien supiera tu contraseña no podría entrar sin el código de tu móvil.</p>
            <button class="btn btn-primario" style="justify-self:start" onClick={() => setAlta(true)}><Icono n="escudo" /> Activar</button>
          </>
        )}
      </div>
      {alta && <AltaFactor demo={modo === 'demo'} alCerrar={(hecho) => { setAlta(false); if (hecho) { factores.recargar(true); aviso('Verificación en dos pasos activada'); } }} />}
      {quitar && (
        <Hoja titulo="¿Quitar este dispositivo?" alCerrar={() => setQuitar(null)}>
          <p>{verificados.length === 1 ? 'Es el único: tu cuenta volverá a entrar solo con la contraseña.' : 'Los demás dispositivos seguirán funcionando.'}</p>
          <div class="fila-envolver">
            <button class="btn" onClick={() => setQuitar(null)}>Cancelar</button>
            <button class="btn btn-peligro" onClick={async () => {
              const ultimo = verificados.length === 1;
              try {
                // Si es el último, primero se deja de exigir (solo se puede con el segundo paso hecho)
                if (ultimo) await api.exigirDosPasos(false);
                try { await backend.auth.mfa.quitar(quitar.id); } catch (e) { if (ultimo) await api.exigirDosPasos(true).catch(() => {}); throw e; }
                setQuitar(null); factores.recargar(true); aviso('Dispositivo quitado');
              } catch (e) { aviso(e.message, 'error'); }
            }}>Quitar</button>
          </div>
        </Hoja>
      )}
    </section>
  );
}

function AltaFactor({ alCerrar, demo }) {
  const { backend, api, aviso } = useApp();
  const [nombre, setNombre] = useState('Móvil');
  const [factor, setFactor] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const secreto = factor?.secreto?.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
  return (
    <Hoja titulo="Activar la verificación en dos pasos" alCerrar={() => alCerrar(false)}>
      {!factor ? (
        <form class="pila" onSubmit={async (e) => {
          e.preventDefault(); setOcupado(true); setError(null);
          try { setFactor(await backend.auth.mfa.inscribir(nombre.trim() || 'Móvil')); } catch (err) { setError(err.message); } finally { setOcupado(false); }
        }}>
          <p class="secundario">Necesitas una app de códigos: Google Authenticator, Microsoft Authenticator, 1Password, Authy…</p>
          {error && <div class="error" role="alert">{error}</div>}
          <div class="campo"><label for="mfa-nombre">Nombre del dispositivo</label><input id="mfa-nombre" class="entrada" value={nombre} onInput={(e) => setNombre(e.currentTarget.value)} /></div>
          <button class="btn btn-primario btn-grande" disabled={ocupado}>Continuar</button>
        </form>
      ) : (
        <form class="pila" onSubmit={async (e) => {
          e.preventDefault(); setOcupado(true); setError(null);
          try {
            await backend.auth.mfa.verificar(factor.id, codigo);
            // Desde ahora la base exige siempre el segundo paso a esta cuenta
            await api.exigirDosPasos(true);
            alCerrar(true);
          } catch (err) { setError(err.message); setOcupado(false); }
        }}>
          <p class="secundario">1. En tu app de códigos, añade una cuenta escaneando este código QR:</p>
          <img class="qr" src={factor.qr} alt="Código QR para la app de verificación" />
          <p class="peq secundario">¿No puedes escanearlo? Escribe esta clave a mano:</p>
          <div class="codigo-grande num" style="font-size:17px">{secreto}</div>
          <button type="button" class="btn-texto" onClick={async () => aviso((await copiar(factor.secreto)) ? 'Clave copiada' : 'Selecciónala y cópiala')}><Icono n="copiar" /> Copiar la clave</button>
          <p class="secundario">2. Escribe el código de 6 cifras que muestra la app:</p>
          {error && <div class="error" role="alert">{error}</div>}
          <div class="campo"><label for="mfa-codigo">Código</label>
            <input id="mfa-codigo" class="entrada num codigo-mfa" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required value={codigo} onInput={(e) => setCodigo(e.currentTarget.value.replace(/\D/g, ''))} />
            {demo && <span class="ayuda">En la demo, el código es 123456.</span>}</div>
          <button class="btn btn-primario btn-grande" disabled={ocupado || codigo.length < 6}>{ocupado ? 'Comprobando…' : 'Activar'}</button>
        </form>
      )}
    </Hoja>
  );
}

// Lo que ocupan los vídeos y fotos de todos en Storage, por atleta, frente al plan de Supabase
const GB = 1024 ** 3;
const fmtTam = (b) => (b >= GB ? `${num(b / GB, 2)} GB` : b >= 1048576 ? `${num(b / 1048576, 0)} MB` : `${num(b / 1024, 0)} KB`);
function Espacio() {
  const { api } = useApp();
  const [plan, setPlan] = useState(() => { try { return Number(localStorage.getItem('fbe-plan-gb')) || 1; } catch { return 1; } });
  const esp = useCarga(() => api.espacioUsado().catch(() => null), []);
  const d = esp.datos;
  const cambiarPlan = (gb) => { setPlan(gb); try { localStorage.setItem('fbe-plan-gb', String(gb)); } catch { /* */ } };
  const pct = d ? Math.min(100, (d.total / (plan * GB)) * 100) : 0;
  return (
    <section class="seccion">
      <h2>Espacio de vídeos y fotos</h2>
      <div class="panel panel-pad pila">
        {!d ? <Cargando /> : (
          <>
            <div class="separa"><span><strong class="num">{fmtTam(d.total)}</strong> <span class="secundario peq">de {plan} GB, en {d.archivos} {d.archivos === 1 ? 'archivo' : 'archivos'}</span></span>
              <select class="selector" style="width:auto;min-height:36px;padding:4px 8px" aria-label="Plan de Supabase" value={plan} onChange={(e) => cambiarPlan(Number(e.currentTarget.value))}><option value={1}>Plan gratuito (1 GB)</option><option value={100}>Plan Pro (100 GB)</option></select></div>
            <div class="espacio-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)} aria-label="Espacio usado"><span class={pct > 85 ? 'lleno' : ''} style={{ width: `${Math.max(1, pct)}%` }} /></div>
            {d.lista.filter((x) => x.bytes > 0).slice(0, 8).map((x) => (
              <div class="espacio-fila" key={x.atleta.id}><Avatar nombre={x.atleta.nombre} clase="peq" /><span>{x.atleta.nombre} <span class="mini terciario">({x.n} {x.n === 1 ? 'archivo' : 'archivos'})</span></span><strong class="num">{fmtTam(x.bytes)}</strong></div>
            ))}
            <p class="mini terciario">Un vídeo de una serie (30–40 s) pesa 30–60 MB. El plan gratuito de Supabase da 1 GB; el Pro, 100 GB y después 0,021 $ por GB al mes. Nada se borra solo: si hace falta sitio, borra vídeos antiguos desde el diario de cada atleta.</p>
          </>
        )}
      </div>
    </section>
  );
}
