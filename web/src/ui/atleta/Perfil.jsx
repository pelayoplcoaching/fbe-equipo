import { hoyISO } from '../../logica/fechas.js';
import { HojaVideo } from '../Videos.jsx';
import { esYoutube } from '../../logica/youtube.js';
import { useState } from 'preact/hooks';
import { AjustesDispositivo, AjustesMensajes, VERSION_APP } from '../Ajustes.jsx';
import { SeccionNotificaciones } from '../Notificaciones.jsx';
import { CabeceraGrande, useApp, useCarga, Icono, Hoja, HojaExportar, Avatar, GrupoIos, FilaIos, IcoIos, usePreferencia } from '../comunes.jsx';
import { conEntrenamiento } from '../../logica/nivel.js';
import { urlSegura } from '../../logica/diseno.js';
import { BandaDemo } from '../App.jsx';
import { TextoPrivacidad } from '../Acceso.jsx';
import { TEXTO_CONSENTIMIENTO_SALUD } from '../../legal.js';
import { CATEGORIAS_RECURSO } from '../../logica/calculos.js';
import { FilaCuestionario } from './Cuestionario.jsx';
import { FilaCobro } from './Cobro.jsx';
import { FilaFoto } from '../FotoPerfil.jsx';
import { Carnet } from './Carnet.jsx';
import { LoTuyo } from './LoTuyo.jsx';
import { Conexiones } from './Conexiones.jsx';
import { PortadaPerfil, FotoConAnillo } from '../PerfilVisual.jsx';
import { PerfilSecciones, EnElEquipo } from './PerfilSocial.jsx';
import { usePersonal } from './Personal.jsx';
import { PORTADAS, portadaValida } from '../../logica/perfil.js';
import { LoCompartido } from '../Compartir.jsx';
import { GrupoReloj } from './Reloj.jsx';

export function Perfil({ programa, salud, recargarConsentimientos, irA }) {
  const { api, atleta, perfil, backend, salir, aviso, modo } = useApp();
  const consentimientos = useCarga(() => api.consentimientos(), [salud]);
  const [verPrivacidad, setVerPrivacidad] = useState(false);
  const [exportado, setExportado] = useState(null);
  const [cambiarPass, setCambiarPass] = useState(false);
  const [confirmarRetirada, setConfirmarRetirada] = useState(false);
  const p = programa.datos;
  const consSalud = (consentimientos.datos || []).find((c) => c.tipo === 'datos_salud' && !c.revocado_en);
  const recursos = useCarga(() => api.recursos().catch(() => []), []);
  const lista = recursos.datos || [];
  const guias = lista.filter((x) => x.categoria !== 'faq');
  const faq = lista.filter((x) => x.categoria === 'faq');

  async function descargar() {
    try { setExportado(JSON.stringify(await api.exportar(atleta.id), null, 2)); } catch (e) { aviso(e.message, 'error'); }
  }

  return (
    <div class="contenido perfil">
      <CabeceraGrande>
        <button class="btn btn-icono plano solo-estrecho" onClick={() => irA?.('hoy')} aria-label="Volver a Hoy"><Icono n="atras" /></button>
        <div class="titulo"><h1>Tu perfil</h1></div>
      </CabeceraGrande>
      <BandaDemo />
      <CabezaPerfil p={p} correo={backend.auth.sesion()?.user.email} />
      {/* v0.52: el carné de atleta (como una tarjeta de Apple Wallet) */}
      <Carnet bloque={p?.bloque || null} />
      {/* v0.114: tu actividad (cifras, 12 semanas, constancia, vitrina, medallas, hitos y entrenos) y tu sitio en el equipo */}
      {conEntrenamiento(atleta) && <PerfilSecciones salud={salud} irA={irA} />}
      <EnElEquipo />

      <GrupoIos titulo="Tu asesoría" id="grupo-asesoria">
        <FilaFoto nombre={atleta.nombre} />
        {atleta.objetivo && <FilaIos icono="diana" titulo="Objetivo" detalle={atleta.objetivo} />}
        {p?.bloque && <FilaIos icono="semana" titulo="Bloque actual" detalle={`Bloque ${p.bloque.numero}: ${p.bloque.nombre}`} />}
        <FilaCuestionario salud={salud} recargarConsentimientos={recargarConsentimientos} />
        <FilaCobro />
        <FilaIos icono="mensaje" titulo="Mensajes con tu coach" detalle="Para lo que no es de una sesión concreta" alTocar={() => irA?.('mensajes')} />
        {urlSegura(atleta.notion_url) && <FilaIos icono="enlace" titulo="Tu página de Notion" detalle="Lo de antes de la app" href={urlSegura(atleta.notion_url)} etiqueta="Tu página de Notion (se abre aparte)" />}
      </GrupoIos>

      {/* v0.104: lo que elige para su app (cómo le llamamos, su porqué, sus ejercicios, su música y su cumpleaños) */}
      <LoTuyo />
      {/* v0.105: Salud del iPhone y el calendario que se actualiza solo */}
      <Conexiones salud={salud} />
      {/* (compartir, tanda 2) lo que has compartido desde este móvil */}
      <LoCompartido />
      {/* (058) el modo reloj: el entreno desde el Apple Watch */}
      <GrupoReloj />

      <AjustesDispositivo antes={<SeccionNotificaciones fila />} />
      <AjustesMensajes />

      {guias.length > 0 && <Recursos titulo="Guías y recursos" id="grupo-guias" lista={guias} />}
      {faq.length > 0 && <Recursos titulo="Preguntas frecuentes" id="grupo-faq" lista={faq} />}

      <GrupoIos titulo="Cuenta" id="grupo-cuenta" pie={`FBE Equipo, versión ${VERSION_APP}. Hola, ${perfil?.nombre || atleta.nombre}.`}>
        <FilaIos icono="privacidad" titulo="Política de privacidad" detalle="Aceptada" alTocar={() => setVerPrivacidad(true)} etiqueta="Política de privacidad: leerla" />
        <li class="fila-ios fila-ios-bloque">
          <IcoIos n="escudo" tono={consSalud ? 'ok' : 'aviso'} />
          <span class="fila-ios-texto"><span class="fila-ios-titulo">Datos de salud</span><span class="peq terciario">{consSalud ? 'Consentimiento dado' : 'Sin consentimiento: no puedes registrar peso, check-in ni cómo llegas a cada sesión'}</span></span>
          <span class="fila-ios-fin">
            {consSalud
              ? <button class="btn btn-peq btn-peligro" onClick={() => setConfirmarRetirada(true)}>Retirar</button>
              : <button class="btn btn-peq btn-primario" onClick={async () => { await api.darConsentimientos(['datos_salud']); recargarConsentimientos(); consentimientos.recargar(true); }}>Dar</button>}
          </span>
          {confirmarRetirada && (
            <div class="fila-ios-control nota pila-s">
              <span>Si lo retiras, no podrás registrar peso, check-in, molestias ni cómo llegas a cada sesión, y la app dejará de usar lo que ya apuntaste. Lo ya registrado se conserva hasta que pidas borrarlo. Si tienes conectada Salud del iPhone, se desconecta y se borra lo que llegó de ahí (y lo que puso en tus hábitos y pesos, si no lo cambiaste tú).</span>
              <span class="fila">
                <button class="btn btn-peq" onClick={() => setConfirmarRetirada(false)}>Cancelar</button>
                <button class="btn btn-peq btn-peligro" onClick={async () => { await api.revocarConsentimiento(consSalud.id); setConfirmarRetirada(false); recargarConsentimientos(); consentimientos.recargar(true); aviso('Consentimiento retirado'); }}>Retirar consentimiento</button>
              </span>
            </div>
          )}
        </li>
        <FilaIos icono="descargar" titulo="Descargar mis datos" detalle="Todo lo que has registrado, en un archivo JSON">
          <button class="btn btn-peq" onClick={descargar}><Icono n="descargar" /> Descargar</button>
        </FilaIos>
        {modo !== 'demo' && <FilaIos icono="candado" titulo="Contraseña" alTocar={() => setCambiarPass(true)} valor="Cambiar" etiqueta="Cambiar la contraseña" />}
        <FilaIos icono="salir" tono="alerta" titulo="Cerrar sesión en este dispositivo">
          <button class="btn btn-peq" onClick={salir}><Icono n="salir" /> Salir</button>
        </FilaIos>
      </GrupoIos>

      {verPrivacidad && <Hoja titulo="Política de privacidad" alCerrar={() => setVerPrivacidad(false)} medio><TextoPrivacidad /><p class="peq secundario">{TEXTO_CONSENTIMIENTO_SALUD}</p></Hoja>}
      {exportado && <HojaExportar titulo="Tus datos" nombre={`mis-datos-fbe-${hoyISO()}.json`} contenido={exportado} tipo="application/json" alCerrar={() => setExportado(null)} />}
      {cambiarPass && <CambiarPassword alCerrar={() => setCambiarPass(false)} />}
    </div>
  );
}

// La cabecera del perfil (v0.50): la foto en grande, el nombre, su bloque y su semana, y tres cifras de lo que lleva
// (semanas completas, sesiones hechas y récords). Solo con lo que ya hay: su constancia, cuántas sesiones ha hecho
// (solo sus identificadores) y sus récords (de su historial, el mismo que usa la vitrina).
function CabezaPerfil({ p, correo }) {
  const { api, atleta, perfil } = useApp();
  const entrena = conEntrenamiento(atleta);
  const constancia = useCarga(() => (entrena ? api.constancia(atleta.id).catch(() => null) : Promise.resolve(null)), [atleta.id, entrena]);
  const sesiones = useCarga(() => (entrena ? api.cuantasSesionesHechas(atleta.id).catch(() => null) : Promise.resolve(null)), [atleta.id, entrena]);
  const records = useCarga(() => (entrena ? api.cuantosRecords(atleta.id).catch(() => null) : Promise.resolve(null)), [atleta.id, entrena]);
  const cifras = entrena ? [
    ['semanas', 'Semanas completas', constancia.datos?.semanasCompletas],
    ['sesiones', 'Sesiones', sesiones.datos],
    ['records', 'Récords', records.datos],
  ] : [];
  const bloque = p?.bloque ? `Bloque ${p.bloque.numero}: ${p.bloque.nombre}${p.actual ? ` · Semana ${p.actual.numero}` : ''}` : null;
  // v0.114: la portada (un dibujo que sale de tu nombre), el aro de tu racha alrededor de la foto y tu porqué
  const personal = usePersonal();
  const porque = personal.datos?.porque?.trim();
  const apodo = personal.datos?.apodo?.trim();
  // v0.116: la portada que eliges (cinco colores; solo en este móvil)
  const [portada, setPortada] = usePreferencia('fbe-portada-perfil', 'noche');
  const [elegir, setElegir] = useState(false);
  return (
    <section class="perfil-cabeza con-portada" data-portada={portadaValida(portada)} aria-label={`${atleta.nombre}${bloque ? `, ${bloque}` : ''}`}>
      <PortadaPerfil texto={atleta.nombre} />
      <button type="button" class="btn-icono perfil-portada-btn" aria-label="Cambiar el color de la portada" aria-expanded={elegir ? 'true' : 'false'} onClick={() => setElegir(!elegir)}><Icono n="paleta" /></button>
      {elegir && (
        <div class="perfil-portadas" role="radiogroup" aria-label="Color de la portada">
          {PORTADAS.map(([k, t]) => (
            <button key={k} type="button" role="radio" aria-checked={portadaValida(portada) === k ? 'true' : 'false'} data-portada={k} class="pp-muestra" onClick={() => { setPortada(k); setElegir(false); }}>
              <span class="pp-color" aria-hidden="true" /><span class="pp-nombre">{t}</span>
            </button>
          ))}
        </div>
      )}
      <FotoConAnillo nombre={atleta.nombre} foto={perfil?.foto_grande || perfil?.foto} racha={constancia.datos?.racha || 0} clase="enorme" lleno ampliable />
      <div class="perfil-quien">
        <p class="perfil-nombre">{atleta.nombre}</p>
        {apodo && apodo !== atleta.nombre && <p class="peq secundario perfil-apodo">Te llamamos {apodo}</p>}
        {porque && <p class="perfil-frase">«{porque}»</p>}
        {correo && <p class="peq secundario perfil-correo">{correo}</p>}
        {bloque && <p class="perfil-bloque"><Icono n="semana" />{bloque}</p>}
      </div>
      {cifras.length > 0 && (
        <dl class="perfil-cifras">
          {cifras.map(([k, t, v]) => (
            <div key={k} data-k={k}>
              <dt>{t}</dt>
              <dd class="num">{v == null ? <span class="sil" style="width:2ch;height:1em;display:inline-block" /> : v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
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

// Guías, enlaces y preguntas frecuentes que publica el coach (v0.50: cada una en su lista agrupada; las guías, por
// categorías)
function Recursos({ titulo, id, lista }) {
  const { atleta } = useApp();
  const [video, setVideo] = useState(null);  // (YouTube) un recurso de vídeo se ve aquí, en su hoja
  const orden = CATEGORIAS_RECURSO.map(([c]) => c);
  const grupos = CATEGORIAS_RECURSO.map(([c, t]) => [c, t, lista.filter((x) => x.categoria === c)]).filter(([, , xs]) => xs.length)
    .sort(([a], [b]) => orden.indexOf(a) - orden.indexOf(b));
  const sinCategoria = lista.filter((x) => !orden.includes(x.categoria));
  if (sinCategoria.length) grupos.push(['otra', 'Otros', sinCategoria]);
  const varias = grupos.length > 1;
  return (
    <section class="seccion grupo-ios" aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      {grupos.map(([c, t, xs]) => (
        <div class="panel" key={c}>
          {varias && <div class="panel-pad peq secundario recursos-cab">{t}</div>}
          <ul class="lista">
            {xs.map((x) => (
              <li key={x.id} class="recurso">
                {x.url && esYoutube(x.url) ? (
                  <button type="button" class="recurso-enlace" onClick={() => setVideo(x)}>
                    <IcoIos n="video" />
                    <span><span class="nombre">{x.titulo}</span>{x.atleta_id === atleta.id && <span class="chip morado">Para ti</span>}{x.descripcion && <><br /><span class="detalle">{x.descripcion}</span></>}</span>
                    <Icono n="play" class="fila-ios-chevron" />
                  </button>
                ) : x.url ? (
                  <a class="recurso-enlace" href={x.url} target="_blank" rel="noopener">
                    <IcoIos n={c === 'faq' ? 'pregunta' : 'enlace'} />
                    <span><span class="nombre">{x.titulo}</span>{x.atleta_id === atleta.id && <span class="chip morado">Para ti</span>}{x.descripcion && <><br /><span class="detalle">{x.descripcion}</span></>}</span>
                    <Icono n="enlace" class="fila-ios-chevron" />
                  </a>
                ) : (
                  <details>
                    <summary><IcoIos n={c === 'faq' ? 'pregunta' : 'biblioteca'} /><span class="nombre">{x.titulo}</span>{x.atleta_id === atleta.id && <span class="chip morado">Para ti</span>}<Icono n="abajo" class="fila-ios-chevron" /></summary>
                    {x.descripcion && <p class="secundario peq" style="white-space:pre-line">{x.descripcion}</p>}
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {video && <HojaVideo titulo={video.titulo} url={video.url} descripcion={video.descripcion || ''} alCerrar={() => setVideo(null)} />}
    </section>
  );
}
