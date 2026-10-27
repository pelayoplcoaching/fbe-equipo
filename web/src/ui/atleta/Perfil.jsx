import { hoyISO } from '../../logica/fechas.js';
import { useState } from 'preact/hooks';
import { AjustesDispositivo } from '../Ajustes.jsx';
import { SeccionNotificaciones } from '../Notificaciones.jsx';
import { useApp, useCarga, Icono, Hoja, HojaExportar, Avatar } from '../comunes.jsx';
import { BandaDemo } from '../App.jsx';
import { TextoPrivacidad } from '../Acceso.jsx';
import { TEXTO_CONSENTIMIENTO_SALUD } from '../../legal.js';
import { CATEGORIAS_RECURSO } from '../../logica/calculos.js';
import { FilaCuestionario } from './Cuestionario.jsx';
import { FilaCobro } from './Cobro.jsx';
import { FilaFoto } from '../FotoPerfil.jsx';

export function Perfil({ programa, salud, recargarConsentimientos, irA }) {
  const { api, atleta, perfil, backend, salir, aviso, modo } = useApp();
  const consentimientos = useCarga(() => api.consentimientos(), [salud]);
  const [verPrivacidad, setVerPrivacidad] = useState(false);
  const [exportado, setExportado] = useState(null);
  const [cambiarPass, setCambiarPass] = useState(false);
  const [confirmarRetirada, setConfirmarRetirada] = useState(false);
  const p = programa.datos;
  const consSalud = (consentimientos.datos || []).find((c) => c.tipo === 'datos_salud' && !c.revocado_en);

  async function descargar() {
    try { setExportado(JSON.stringify(await api.exportar(atleta.id), null, 2)); } catch (e) { aviso(e.message, 'error'); }
  }

  return (
    <div class="contenido">
      <header class="cabecera">
        <button class="btn btn-icono plano solo-estrecho" onClick={() => irA?.('hoy')} aria-label="Volver a Hoy"><Icono n="atras" /></button>
        <Avatar nombre={atleta.nombre} foto={perfil?.foto} clase="grande" lleno /><div class="titulo"><h1>{atleta.nombre}</h1><div class="sub">{backend.auth.sesion()?.user.email}</div></div>
      </header>
      <BandaDemo />

      <section class="seccion">
        <h2>Tu asesoría</h2>
        <div class="panel">
          <ul class="lista">
            <FilaFoto nombre={atleta.nombre} />
            {atleta.objetivo && <li class="panel-pad"><div class="peq terciario">Objetivo</div><div>{atleta.objetivo}</div></li>}
            {p?.bloque && <li class="panel-pad"><div class="peq terciario">Bloque actual</div><div>Bloque {p.bloque.numero}: {p.bloque.nombre}</div></li>}
            <FilaCuestionario salud={salud} recargarConsentimientos={recargarConsentimientos} />
            <FilaCobro />
            <li class="panel-pad separa">
              <div><div>Mensajes con tu coach</div><div class="peq terciario">Para lo que no es de una sesión concreta</div></div>
              <button class="btn btn-peq" onClick={() => irA?.('mensajes')}><Icono n="mensaje" /> Abrir</button>
            </li>
            {atleta.notion_url && (
              <li class="panel-pad separa">
                <div><div>Tu página de Notion</div><div class="peq terciario">Lo de antes de la app</div></div>
                <a class="btn btn-peq" href={atleta.notion_url} target="_blank" rel="noopener"><Icono n="enlace" /> Abrir</a>
              </li>
            )}
          </ul>
        </div>
      </section>

      <Recursos />

      <section class="seccion">
        <h2>Privacidad</h2>
        <div class="panel">
          <ul class="lista">
            <li class="panel-pad separa">
              <div><div>Política de privacidad</div><div class="peq terciario">Aceptada</div></div>
              <button class="btn btn-peq" onClick={() => setVerPrivacidad(true)}>Leer</button>
            </li>
            <li class="panel-pad pila-s">
              <div class="separa">
                <div><div>Datos de salud</div><div class="peq terciario">{consSalud ? 'Consentimiento dado' : 'Sin consentimiento: no puedes registrar peso, check-in ni cómo llegas a cada sesión'}</div></div>
                {consSalud
                  ? <button class="btn btn-peq btn-peligro" onClick={() => setConfirmarRetirada(true)}>Retirar</button>
                  : <button class="btn btn-peq btn-primario" onClick={async () => { await api.darConsentimientos(['datos_salud']); recargarConsentimientos(); consentimientos.recargar(true); }}>Dar</button>}
              </div>
              {confirmarRetirada && (
                <div class="nota pila-s">
                  <span>Si lo retiras, no podrás registrar peso, check-in, molestias ni cómo llegas a cada sesión, y la app dejará de usar lo que ya apuntaste. Lo ya registrado se conserva hasta que pidas borrarlo.</span>
                  <span class="fila">
                    <button class="btn btn-peq" onClick={() => setConfirmarRetirada(false)}>Cancelar</button>
                    <button class="btn btn-peq btn-peligro" onClick={async () => { await api.revocarConsentimiento(consSalud.id); setConfirmarRetirada(false); recargarConsentimientos(); consentimientos.recargar(true); aviso('Consentimiento retirado'); }}>Retirar consentimiento</button>
                  </span>
                </div>
              )}
            </li>
            <li class="panel-pad separa">
              <div><div>Descargar mis datos</div><div class="peq terciario">Todo lo que has registrado, en un archivo JSON</div></div>
              <button class="btn btn-peq" onClick={descargar}><Icono n="descargar" /> Descargar</button>
            </li>
          </ul>
        </div>
      </section>

      <SeccionNotificaciones />

      <AjustesDispositivo />

      <section class="seccion">
        <h2>Cuenta</h2>
        <div class="panel">
          <ul class="lista">
            {modo !== 'demo' && <li class="panel-pad separa"><span>Contraseña</span><button class="btn btn-peq" onClick={() => setCambiarPass(true)}>Cambiar</button></li>}
            <li class="panel-pad separa"><span>Cerrar sesión en este dispositivo</span><button class="btn btn-peq" onClick={salir}><Icono n="salir" /> Salir</button></li>
          </ul>
        </div>
        <p class="mini terciario">FBE Equipo, versión 0.21. Hola, {perfil?.nombre || atleta.nombre}.</p>
      </section>

      {verPrivacidad && <Hoja titulo="Política de privacidad" alCerrar={() => setVerPrivacidad(false)}><TextoPrivacidad /><p class="peq secundario">{TEXTO_CONSENTIMIENTO_SALUD}</p></Hoja>}
      {exportado && <HojaExportar titulo="Tus datos" nombre={`mis-datos-fbe-${hoyISO()}.json`} contenido={exportado} tipo="application/json" alCerrar={() => setExportado(null)} />}
      {cambiarPass && <CambiarPassword alCerrar={() => setCambiarPass(false)} />}
    </div>
  );
}

function CambiarPassword({ alCerrar }) {
  const { backend, aviso } = useApp();
  const [pass, setPass] = useState('');
  const [error, setError] = useState(null);
  return (
    <Hoja titulo="Cambiar contraseña" alCerrar={alCerrar}>
      <form class="pila" onSubmit={async (e) => {
        e.preventDefault();
        if (pass.length < 10) { setError('Al menos 10 caracteres.'); return; }
        try { await backend.auth.cambiarPassword(pass); aviso('Contraseña cambiada'); alCerrar(); } catch (err) { setError(err.message); }
      }}>
        {error && <div class="error" role="alert">{error}</div>}
        <div class="campo"><label for="np">Nueva contraseña</label><input id="np" class="entrada" type="password" autoComplete="new-password" value={pass} onInput={(e) => setPass(e.currentTarget.value)} /></div>
        <button class="btn btn-primario btn-grande">Guardar</button>
      </form>
    </Hoja>
  );
}

// Guías, enlaces y preguntas frecuentes que publica el coach
function Recursos() {
  const { api, atleta } = useApp();
  const r = useCarga(() => api.recursos().catch(() => []), []);
  const lista = r.datos || [];
  if (!lista.length) return null;
  const orden = CATEGORIAS_RECURSO.map(([c]) => c);
  const grupos = CATEGORIAS_RECURSO.map(([c, t]) => [c, t, lista.filter((x) => x.categoria === c)]).filter(([, , xs]) => xs.length);
  return (
    <section class="seccion">
      <h2>Guías y recursos</h2>
      {grupos.sort(([a], [b]) => orden.indexOf(a) - orden.indexOf(b)).map(([c, t, xs]) => (
        <div class="panel" key={c}>
          <div class="panel-pad peq secundario recursos-cab">{t}</div>
          <ul class="lista">
            {xs.map((x) => (
              <li key={x.id} class="recurso">
                {x.url ? (
                  <a class="recurso-enlace" href={x.url} target="_blank" rel="noopener">
                    <span><span class="nombre">{x.titulo}</span>{x.atleta_id === atleta.id && <span class="chip morado">Para ti</span>}{x.descripcion && <><br /><span class="detalle">{x.descripcion}</span></>}</span>
                    <Icono n="enlace" />
                  </a>
                ) : (
                  <details>
                    <summary><span class="nombre">{x.titulo}</span>{x.atleta_id === atleta.id && <span class="chip morado">Para ti</span>}</summary>
                    {x.descripcion && <p class="secundario peq" style="white-space:pre-line">{x.descripcion}</p>}
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
