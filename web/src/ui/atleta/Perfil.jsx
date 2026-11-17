import { hoyISO } from '../../logica/fechas.js';
import { HojaVideo } from '../Videos.jsx';
import { esYoutube } from '../../logica/youtube.js';
import { useState, useEffect, useRef } from 'preact/hooks';
import { AjustesDispositivo, AjustesMensajes, VERSION_APP } from '../Ajustes.jsx';
import { SeccionNotificaciones } from '../Notificaciones.jsx';
import { CabeceraGrande, useApp, useCarga, Icono, Hoja, HojaExportar, Avatar, GrupoIos, FilaIos, IcoIos, usePreferencia, Pestanas } from '../comunes.jsx';
import { vistaPedida } from './perfil-vista.js';
import { conEntrenamiento } from '../../logica/nivel.js';
import { urlSegura } from '../../logica/diseno.js';
import { BandaDemo } from '../App.jsx';
import { TextoPrivacidad } from '../Acceso.jsx';
import { TEXTO_CONSENTIMIENTO_SALUD } from '../../legal.js';
import { CATEGORIAS_RECURSO } from '../../logica/calculos.js';
import { FilaCuestionario } from './Cuestionario.jsx';
import { FilaSuplementos } from './Suplementos.jsx';
import { FilaCobro } from './Cobro.jsx';
import { FilaFoto } from '../FotoPerfil.jsx';
import { Carnet } from './Carnet.jsx';
import { useImagenPropia } from './AMedida.jsx';
import { LoTuyo } from './LoTuyo.jsx';
import { Conexiones } from './Conexiones.jsx';
import { PortadaPerfil, FotoConAnillo } from '../PerfilVisual.jsx';
import { PerfilSecciones, EnElEquipo } from './PerfilSocial.jsx';
import { usePersonal } from './Personal.jsx';
import { PORTADAS, portadaValida } from '../../logica/perfil.js';
import { LoCompartido } from '../Compartir.jsx';
import { GrupoReloj } from './Reloj.jsx';
import { CompletaPerfil, IndicePerfil, FilaCorrecciones, FilaEvitados, FilaMaterial, FilaGuardados, recortarPortada, AtajosPerfil, FilaPrivacidad, FilasCuentaSegura, FilaHojaCalculo } from './PerfilMas.jsx';

export function Perfil({ programa, salud, recargarConsentimientos, irA }) {
  const { api, atleta, perfil, backend, salir, aviso, modo } = useApp();
  const consentimientos = useCarga(() => api.consentimientos(), [salud]);
  const [verPrivacidad, setVerPrivacidad] = useState(false);
  const [exportado, setExportado] = useState(null);
  const [cambiarPass, setCambiarPass] = useState(false);
  const [confirmarRetirada, setConfirmarRetirada] = useState(false);
  // (visual 3) dos vistas: «Tú» y «Ajustes» (antes, todo seguido: unos 9.700 px)
  const [vista, setVista] = useState(() => vistaPedida() || 'tu');
  const cambiarVista = (v) => { setVista(v); window.scrollTo(0, 0); };
  useEffect(() => {
    const pide = () => { const v = vistaPedida(); if (v) cambiarVista(v); };
    window.addEventListener('fbe-perfil-vista', pide);
    return () => window.removeEventListener('fbe-perfil-vista', pide);
  }, []);
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
      <Pestanas clase="perfil-vistas" etiqueta="Tu perfil" idBase="perfil-vista" opciones={[['tu', 'Tú'], ['ajustes', 'Ajustes']]} valor={vista} alCambiar={cambiarVista} />
      <div class="perfil-cuerpo" id="perfil-vista-panel" role="tabpanel" aria-labelledby={`perfil-vista-${vista}`}>
      {vista === 'tu' ? <>
      <CabezaPerfil p={p} correo={backend.auth.sesion()?.user.email} />
      {/* (perfil, tanda 4) lo que le falta por rellenar y el índice con buscador */}
      <AtajosPerfil irA={irA} />
      <CompletaPerfil />
      <IndicePerfil vista={vista} cambiarVista={cambiarVista} />
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
        {/* (v0.174, 077) sus suplementos: verlos, añadir el primero y poner su aviso */}
        <FilaSuplementos />
        <FilaCobro />
        {conEntrenamiento(atleta) && <FilaCorrecciones />}
        <FilaIos icono="mensaje" titulo="Mensajes con tu coach" detalle="Para lo que no es de una sesión concreta" alTocar={() => irA?.('mensajes')} />
        {urlSegura(atleta.notion_url) && <FilaIos icono="enlace" titulo="Tu página de Notion" detalle="Lo de antes de la app" href={urlSegura(atleta.notion_url)} etiqueta="Tu página de Notion (se abre aparte)" />}
      </GrupoIos>

      {/* (perfil, tanda 4) lo que evita, su material (los ve su coach) y sus guardados, juntos */}
      <GrupoIos titulo="Tu forma de entrenar" id="grupo-tu-forma">
        {conEntrenamiento(atleta) && <FilaEvitados />}
        {conEntrenamiento(atleta) && <FilaMaterial />}
        <FilaGuardados irA={irA} />
      </GrupoIos>

      {/* v0.104: lo que elige para su app (cómo le llamamos, su porqué, sus ejercicios, su música y su cumpleaños) */}
      <LoTuyo salud={salud} />
      <button type="button" class="btn ancho perfil-a-ajustes" onClick={() => cambiarVista('ajustes')}><Icono n="ajustes" /> Ajustes, guías y cuenta</button>
      </> : <>
      <IndicePerfil vista={vista} cambiarVista={cambiarVista} />
      <IndiceAjustes />
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
        {/* (perfil, tanda 4) qué ve cada uno, de un vistazo */}
        <FilaPrivacidad salud={!!consSalud} />
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
        <FilaHojaCalculo />
        {modo !== 'demo' && <FilaIos icono="candado" titulo="Contraseña" alTocar={() => setCambiarPass(true)} valor="Cambiar" etiqueta="Cambiar la contraseña" />}
        <FilasCuentaSegura correo={backend.auth.sesion()?.user.email} />
        <FilaIos icono="salir" tono="alerta" titulo="Cerrar sesión en este dispositivo">
          <button class="btn btn-peq" onClick={salir}><Icono n="salir" /> Salir</button>
        </FilaIos>
      </GrupoIos>
      </>}
      </div>

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
  // (perfil, tanda 4, migración 073) su foto de portada (la ven su coach y, si estáis en la comunidad, el equipo)
  const { aviso, propio } = useApp();
  // (a medida, 080) la imagen que le ha puesto su coach: su portada mientras no ponga una foto suya
  const imagenSuya = useImagenPropia('perfil');
  const portadaFoto = useCarga(() => (propio || !api.portadaFoto ? Promise.resolve(undefined) : api.portadaFoto().catch(() => null)), [atleta.id]);
  const [subiendo, setSubiendo] = useState(false);
  const ponerFoto = async (archivo) => {
    if (!archivo) return;
    setSubiendo(true);
    try { const b = await recortarPortada(archivo); await api.ponerPortadaFoto(b); setElegir(false); aviso('Portada puesta'); portadaFoto.recargar(true); } catch (e) { aviso(e.message, 'error'); }
    setSubiendo(false);
  };
  const quitarFoto = async () => {
    try { await api.quitarPortadaFoto(); setElegir(false); aviso('Portada quitada'); portadaFoto.recargar(true); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <section class="perfil-cabeza con-portada" data-portada={portadaValida(portada)} aria-label={`${atleta.nombre}${bloque ? `, ${bloque}` : ''}`}>
      <PortadaPerfil texto={atleta.nombre} foto={portadaFoto.datos || imagenSuya || null} />
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
      {elegir && portadaFoto.datos !== undefined && (
        <div class="perfil-portada-foto">
          <label class={`btn btn-peq${subiendo ? ' ocupado' : ''}`}><Icono n="camara" />{subiendo ? 'Subiendo…' : portadaFoto.datos ? 'Cambiar tu foto' : 'Poner tu foto'}
            <input type="file" accept="image/*" class="sr" disabled={subiendo} onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; ponerFoto(f); }} aria-label="Elegir una foto de portada" /></label>
          {portadaFoto.datos && <button type="button" class="btn btn-peq" onClick={quitarFoto}><Icono n="basura" />Quitar</button>}
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

// (visual 4) El índice de los ajustes: una fila de accesos, pegada arriba, que salta a cada grupo. Sale de los grupos
// que hay (según la cuenta, unos están y otros no).
function IndiceAjustes() {
  const ref = useRef(null);
  const [grupos, setGrupos] = useState([]);
  useEffect(() => {
    const panel = ref.current?.closest('.perfil-cuerpo');
    if (!panel) return undefined;
    const leer = () => setGrupos([...panel.querySelectorAll(':scope > .grupo-ios > h2[id]')].map((h) => [h.id, h.textContent.trim()]));
    leer();
    const obs = new MutationObserver(leer);
    obs.observe(panel, { childList: true });
    return () => obs.disconnect();
  }, []);
  const ir = (id) => {
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.closest('.grupo-ios')?.scrollIntoView({ block: 'start', behavior: quieto ? 'auto' : 'smooth' });
  };
  return (
    <nav ref={ref} class="ajustes-indice" aria-label="Ir a un grupo de ajustes">
      {grupos.map(([id, t]) => <button key={id} type="button" class="chip" onClick={() => ir(id)}>{t}</button>)}
    </nav>
  );
}
