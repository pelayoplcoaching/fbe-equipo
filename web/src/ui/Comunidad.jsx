// La comunidad del equipo (v0.43): el muro, los retos y el ranking de constancia, para el atleta (pestaña Equipo)
// y para el coach. Voluntaria: el atleta entra aceptando lo que se comparte, y puede salir cuando quiera. Los
// permisos los pone la base (migración 027): lo de aquí solo enseña o esconde botones.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Avatar, Hoja, Siluetas, Vacio, ErrorCaja, Pestanas, Cargando, cuando } from './comunes.jsx';
import { Interruptor } from './Ajustes.jsx';
import { reducirFoto } from './FotoPerfil.jsx';
import { REACCIONES, MAX_POST, MAX_COMENTARIO, MAX_MOTIVO, nombreEquipo, nombreValido, estadoReto, textoReto, ordenarRanking, quienes } from '../logica/comunidad.js';
import { fmtConDia, fmtCorta, hoyISO, sumarDias, lunesDe } from '../logica/fechas.js';
import { num } from '../logica/calculos.js';
import { VERSION_COMUNIDAD } from '../datos/api.js';

const VISTAS = [['muro', 'Muro'], ['retos', 'Retos'], ['ranking', 'Ranking']];

// La pestaña Equipo del atleta: la primera vez (o tras salir), la entrada; dentro, muro, retos y ranking
export function Equipo() {
  const { api } = useApp();
  const miembro = useCarga(() => api.miembroComunidad(), []);
  const [vista, setVista] = useState('muro');
  const [ajustes, setAjustes] = useState(false);
  if (miembro.cargando && !miembro.datos) return <div class="contenido"><Siluetas forma="tarjetas" n={3} texto="Cargando el equipo" /></div>;
  const m = miembro.datos;
  if (m?.bloqueado) return <FueraDeLaComunidad />;
  // Sin haber entrado, tras salir o si ha cambiado lo que se comparte (hay que volver a aceptarlo)
  if (!m || m.salido_en || m.version !== VERSION_COMUNIDAD) return <EntrarComunidad antes={m} cambio={!!m && !m.salido_en} alEntrar={() => miembro.recargar(true)} />;
  return (
    <div class="contenido equipo">
      <header class="cabecera">
        <div class="titulo"><h1>Equipo</h1><div class="sub">Estás como {m.nombre}</div></div>
        <button class="btn btn-icono plano" aria-label="Ajustes de la comunidad" onClick={() => setAjustes(true)}><Icono n="ajustes" /></button>
      </header>
      <Pestanas opciones={VISTAS} valor={vista} alCambiar={setVista} etiqueta="Equipo" idBase="eq" />
      <div class="pestana-panel" role="tabpanel" id="eq-panel" aria-labelledby={`eq-${vista}`} key={vista}>
        {vista === 'muro' && <Muro />}
        {vista === 'retos' && <Retos />}
        {vista === 'ranking' && <Ranking miembro={m} />}
      </div>
      {ajustes && <HojaAjustesComunidad miembro={m} alCerrar={() => setAjustes(false)} alCambiar={() => miembro.recargar(true)} />}
    </div>
  );
}

// Qué se comparte y con quién (la entrada y los ajustes)
function QueSeComparte() {
  return (
    <>
      <div class="pila-s">
        <strong>Qué ven los demás</strong>
        <ul class="puntos secundario">
          <li>Tu nombre en el equipo y tu foto de perfil.</li>
          <li>Lo que publiques, comentes o compartas, y tus reacciones.</li>
          <li>Cuántas sesiones llevas en los retos y en el ranking de la semana (puedes no salir).</li>
        </ul>
      </div>
      <div class="pila-s">
        <strong>Lo que nunca se comparte</strong>
        <p class="secundario">Tu peso, tus medidas, la nutrición, los check-ins, las molestias, los vídeos de técnica ni lo que hablas con tu coach. Los kilos de un entreno, solo si tú lo eliges al compartirlo.</p>
      </div>
    </>
  );
}

// El coach le ha sacado de la comunidad: no ve nada ni puede volver a entrar hasta que le readmita
function FueraDeLaComunidad() {
  return (
    <div class="contenido">
      <header class="cabecera"><div class="titulo"><h1>Equipo</h1></div></header>
      <Vacio icono="equipo" titulo="No estás en la comunidad">Tu coach te ha sacado de la comunidad del equipo. Si quieres volver, habla con él.</Vacio>
    </div>
  );
}

function EntrarComunidad({ antes, cambio = false, alEntrar }) {
  const { api, atleta, aviso } = useApp();
  const [nombre, setNombre] = useState(antes?.nombre || nombreEquipo(atleta?.nombre));
  const [ocupado, una] = useUnaVez();
  const [error, setError] = useState(null);
  const entrar = (e) => {
    e.preventDefault();
    una(async () => {
      setError(null);
      try { await api.entrarComunidad(nombre); aviso('¡Ya estás en el equipo!'); alEntrar(); } catch (err) { setError(err.message); }
    });
  };
  return (
    <div class="contenido">
      <header class="cabecera"><div class="titulo"><h1>Equipo</h1><div class="sub">Para animaros entre los atletas de FBE</div></div></header>
      <section class="panel panel-pad pila entrar-equipo">
        <Icono n="equipo" class="entrar-equipo-ico" />
        <h2>{cambio ? 'Hemos cambiado lo que se comparte' : antes ? '¿Vuelves al equipo?' : 'Antes de entrar'}</h2>
        {cambio && <p class="nota peq">Para seguir en el equipo, lee lo que se comparte ahora y acéptalo. Mientras tanto, lo tuyo no se ve.</p>}
        <p>Es voluntario. Dentro, los atletas de FBE que han entrado y tu coach os veis entre vosotros: os podéis animar, compartir un entreno y apuntaros a los retos.</p>
        <QueSeComparte />
        <p class="peq secundario">Puedes salir cuando quieras desde los ajustes del equipo: lo tuyo deja de verse para los demás.{antes ? ' Si vuelves, lo que dejaste vuelve a verse.' : ''}</p>
        <form class="pila" onSubmit={entrar}>
          <div class="campo">
            <label for="eq-nombre">Tu nombre en el equipo</label>
            <input id="eq-nombre" class="entrada" maxLength={40} autoComplete="off" value={nombre} onInput={(e) => setNombre(e.currentTarget.value)} />
            <span class="ayuda">Es el que verán los demás (de 2 a 40 letras).</span>
          </div>
          {error && <div class="error" role="alert">{error}</div>}
          <button class="btn btn-primario btn-grande" disabled={ocupado || !nombreValido(nombre)}>{cambio ? 'Sí, quiero seguir' : 'Sí, quiero entrar'}</button>
        </form>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- el muro
export function Muro({ coach = false }) {
  const { api } = useApp();
  const [paginas, setPaginas] = useState(1);
  const muro = useCarga(() => api.muro({ limite: 20 * paginas }), [paginas]);
  const d = muro.datos;
  const recargar = () => muro.recargar(true);
  return (
    <div class="pila muro">
      <Compositor coach={coach} alPublicar={recargar} />
      <ErrorCaja error={muro.error} reintentar={() => muro.recargar()} />
      {!d ? <Siluetas forma="tarjetas" n={3} texto="Cargando el muro" />
        : !d.posts.length ? (
          <Vacio icono="equipo" titulo="Aún no hay nada en el muro">{coach ? 'Publica un aviso para darles la bienvenida.' : 'Sé el primero: cuenta qué tal tu semana o comparte tu próximo entreno.'}</Vacio>
        ) : d.posts.map((p) => <TarjetaPost key={p.id} post={p} coach={coach} alCambiar={recargar} />)}
      {d?.hayMas && <button class="btn" onClick={() => setPaginas(paginas + 1)}>Ver más</button>}
    </div>
  );
}

function Compositor({ coach, alPublicar }) {
  const { api, aviso } = useApp();
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState(null); // { blob, url }
  const [fijada, setFijada] = useState(false);
  const [ocupado, una] = useUnaVez();
  const input = useRef(null);
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.url); }, [foto]);
  const elegir = async (e) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    try { const blob = await reducirFoto(f); setFoto({ blob, url: URL.createObjectURL(blob) }); } catch (err) { aviso(err.message, 'error'); }
  };
  const publicar = (e) => {
    e.preventDefault();
    una(async () => {
      try {
        await api.publicarEnComunidad({ texto, foto: foto?.blob || null, fijada });
        setTexto(''); setFoto(null); setFijada(false);
        aviso(coach ? 'Aviso publicado en el muro' : 'Publicado en el equipo');
        alPublicar();
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  const vacio = !texto.trim() && !foto;
  return (
    <form class="panel panel-pad pila-s compositor" onSubmit={publicar}>
      <label class="sr" for="eq-texto">{coach ? 'Aviso para el equipo' : 'Tu publicación'}</label>
      <textarea id="eq-texto" class="area" maxLength={MAX_POST} rows={2} placeholder={coach ? 'Un aviso para todo el equipo…' : '¿Qué tal tu semana? Anima al equipo…'}
        value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
      {foto && (
        <div class="compositor-foto">
          <img src={foto.url} alt="La foto que vas a publicar" />
          <button type="button" class="btn btn-peq" onClick={() => setFoto(null)}><Icono n="cerrar" /> Quitar la foto</button>
        </div>
      )}
      <div class="separa compositor-pie">
        <span class="fila-envolver">
          <input ref={input} type="file" accept="image/*" class="sr" tabIndex={-1} aria-label="Foto para la publicación" onChange={elegir} />
          {!foto && <button type="button" class="btn btn-peq plano" onClick={() => input.current?.click()}><Icono n="imagen" /> Foto</button>}
          {coach && <label class="casilla casilla-peq"><input type="checkbox" checked={fijada} onChange={(e) => setFijada(e.currentTarget.checked)} /><span>Fijar arriba</span></label>}
        </span>
        <button class="btn btn-peq btn-primario" disabled={ocupado || (coach ? !texto.trim() : vacio)}>{ocupado ? 'Publicando…' : coach ? 'Publicar aviso' : 'Publicar'}</button>
      </div>
      {texto.length > MAX_POST - 200 && <span class="mini terciario">{MAX_POST - texto.length} letras más como mucho</span>}
    </form>
  );
}

function TarjetaPost({ post, coach, alCambiar }) {
  const { api, aviso } = useApp();
  const [hoja, setHoja] = useState(null); // 'comentarios' | 'opciones' | 'quien' | 'avisar'
  const [ocupado, una] = useUnaVez();
  const reaccionar = (k) => una(async () => {
    try { await api.reaccionar(post.id, k); await alCambiar(); } catch (e) { aviso(e.message, 'error'); }
  });
  const todos = Object.values(post.reacciones).flat();
  const tipo = post.tipo === 'aviso' ? 'Aviso del coach' : post.tipo === 'entreno' ? 'Entreno compartido' : null;
  return (
    <article class={`panel panel-pad pila-s post post-${post.tipo} ${post.fijada ? 'fijada' : ''} ${post.oculta ? 'oculta' : ''}`} aria-label={`${tipo || 'Publicación'} de ${post.autor.nombre}`}>
      <header class="post-cab">
        <Avatar nombre={post.autor.nombre} foto={post.autor.foto} />
        <div class="post-quien">
          <div class="fila-envolver"><strong>{post.autor.nombre}</strong>{post.autor.coach && <span class="chip morado">Coach</span>}</div>
          <div class="mini terciario">{tipo ? `${tipo} · ` : ''}{cuando(post.creado_en)}</div>
        </div>
        {post.fijada && <span class="chip post-fijado"><Icono n="chincheta" />Fijado</span>}
        {(coach || post.mio || !post.autor.coach) && <button class="btn btn-icono plano" aria-label="Opciones de la publicación" onClick={() => setHoja('opciones')}><Icono n="opciones" stroke-width="3" /></button>}
      </header>
      {post.oculta && <p class="nota peq">Oculta: los atletas no la ven.</p>}
      {post.tipo === 'entreno' && <TarjetaEntreno r={post.resumen} />}
      {post.texto && <p class="post-texto">{post.texto}</p>}
      {post.foto_ruta && <FotoPost ruta={post.foto_ruta} autor={post.autor.nombre} />}
      <div class="post-pie">
        <div class="reacciones" role="group" aria-label="Reacciones">
          {REACCIONES.map(([k, emoji, nombre]) => {
            const lista = post.reacciones[k] || [];
            return (
              <button key={k} type="button" class="reaccion" aria-pressed={post.miReaccion === k ? 'true' : 'false'} disabled={ocupado}
                aria-label={`${nombre}: ${lista.length}${lista.length ? ` (${lista.join(', ')})` : ''}`} onClick={() => reaccionar(k)}>
                <span aria-hidden="true">{emoji}</span>{lista.length > 0 && <span class="num" aria-hidden="true">{lista.length}</span>}
              </button>
            );
          })}
        </div>
        <button type="button" class="btn btn-peq plano post-comentar" onClick={() => setHoja('comentarios')}>
          <Icono n="mensaje" /> {post.comentarios ? `${post.comentarios} ${post.comentarios === 1 ? 'comentario' : 'comentarios'}` : 'Comentar'}
        </button>
      </div>
      {todos.length > 0 && <button type="button" class="btn-texto mini quien-reacciona" onClick={() => setHoja('quien')}>{quienes(todos)}</button>}
      {hoja === 'comentarios' && <HojaComentarios post={post} coach={coach} alCerrar={() => setHoja(null)} alCambiar={alCambiar} />}
      {hoja === 'quien' && <HojaQuien post={post} alCerrar={() => setHoja(null)} />}
      {hoja === 'opciones' && <HojaOpcionesPost post={post} coach={coach} alCerrar={() => setHoja(null)} alCambiar={alCambiar} alAvisar={() => setHoja('avisar')} />}
      {hoja === 'avisar' && <HojaAvisar postId={post.id} alCerrar={() => setHoja(null)} />}
    </article>
  );
}

// La tarjeta de un entreno (la de la base o, al compartir, la vista previa)
export function TarjetaEntreno({ r }) {
  if (!r) return null;
  const ejercicios = r.ejercicios || [];
  const records = ejercicios.filter((e) => e.record);
  const serie = (e) => (e.kg != null ? `${num(e.kg, 2)} kg × ${e.reps}` : e.reps != null ? `${e.reps} rep` : null);
  return (
    <div class="entreno-equipo">
      <div class="ee-cab">
        <span class="ee-ico"><Icono n="hoy" /></span>
        <div class="pila-xs"><strong>{r.nombre}</strong><span class="mini secundario">{r.fecha ? fmtConDia(r.fecha) : ''}</span></div>
      </div>
      <div class="ee-num">
        <div><span class="v num">{r.minutos ?? '—'}</span><span class="k">min</span></div>
        <div><span class="v num">{r.series ?? 0}</span><span class="k">series</span></div>
        <div><span class="v num">{ejercicios.length}</span><span class="k">{ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}</span></div>
      </div>
      {ejercicios.length > 0 && (
        <ul class="ee-ejercicios">
          {ejercicios.map((e, i) => (
            <li key={i}><span>{e.nombre}</span>{r.con_kilos && serie(e) && <span class="num secundario">{serie(e)}</span>}</li>
          ))}
        </ul>
      )}
      {records.map((e, i) => (
        <p class="ee-record" key={i}><Icono n="trofeo" /><span>Récord en {e.nombre}{r.con_kilos && e.e1rm ? ` · 1RM estimado ${num(e.e1rm)} kg` : ''}</span></p>
      ))}
    </div>
  );
}

function FotoPost({ ruta, autor }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    api.urlFotoComunidad(ruta).then((u) => vivo && setUrl(u)).catch(() => vivo && setError(true));
    return () => { vivo = false; };
  }, [ruta]);
  if (error) return <p class="mini terciario">La foto no está disponible.</p>;
  if (!url) return <div class="post-foto post-foto-cargando" aria-hidden="true" />;
  return <img class="post-foto" src={url} alt={`Foto de ${autor}`} loading="lazy" />;
}

function HojaQuien({ post, alCerrar }) {
  return (
    <Hoja titulo="Reacciones" alCerrar={alCerrar}>
      <ul class="lista">
        {REACCIONES.filter(([k]) => post.reacciones[k]?.length).map(([k, emoji, nombre]) => (
          <li key={k} class="panel-pad pila-xs"><span><span aria-hidden="true">{emoji}</span> {nombre} ({post.reacciones[k].length})</span><span class="peq secundario">{post.reacciones[k].join(', ')}</span></li>
        ))}
      </ul>
    </Hoja>
  );
}

function HojaOpcionesPost({ post, coach, alCerrar, alCambiar, alAvisar }) {
  const { api, aviso } = useApp();
  const [borrar, setBorrar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const hacer = (fn, texto) => una(async () => {
    try { await fn(); aviso(texto); alCerrar(); alCambiar(); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <Hoja titulo="Publicación" alCerrar={alCerrar}>
      {borrar ? (
        <div class="pila">
          <p>¿Borrar esta publicación? Se borran también sus comentarios y reacciones.</p>
          <div class="fila-envolver">
            <button class="btn" onClick={() => setBorrar(false)}>Cancelar</button>
            <button class="btn btn-peligro" disabled={ocupado} onClick={() => hacer(() => api.borrarDeComunidad(post), 'Publicación borrada')}><Icono n="basura" /> Sí, borrar</button>
          </div>
        </div>
      ) : (
        <div class="pila-s opciones-post">
          {coach && post.tipo === 'aviso' && <button class="btn" disabled={ocupado} onClick={() => hacer(() => api.fijarEnComunidad(post.id, !post.fijada), post.fijada ? 'Ya no está fijado' : 'Fijado arriba')}><Icono n="chincheta" /> {post.fijada ? 'Quitar de arriba' : 'Fijar arriba'}</button>}
          {coach && !post.mio && <button class="btn" disabled={ocupado} onClick={() => hacer(() => api.ocultarEnComunidad(post.id, !post.oculta), post.oculta ? 'Vuelve a verse' : 'Oculta para los atletas')}><Icono n="ojo" /> {post.oculta ? 'Volver a mostrarla' : 'Ocultarla'}</button>}
          {!coach && !post.mio && !post.autor.coach && <button class="btn" onClick={alAvisar}><Icono n="bandera" /> Avisar al coach</button>}
          {(coach || post.mio) && <button class="btn btn-peligro" onClick={() => setBorrar(true)}><Icono n="basura" /> Borrar</button>}
          {!coach && post.mio && <p class="mini terciario">Lo ven los del equipo y tu coach mientras sigas en la comunidad.</p>}
        </div>
      )}
    </Hoja>
  );
}

function HojaAvisar({ postId = null, comentarioId = null, alCerrar }) {
  const { api, aviso } = useApp();
  const [motivo, setMotivo] = useState('');
  const [ocupado, una] = useUnaVez();
  return (
    <Hoja titulo="Avisar al coach" alCerrar={alCerrar}>
      <form class="pila" onSubmit={(e) => {
        e.preventDefault();
        una(async () => {
          try { await api.avisarAlCoach({ postId, comentarioId, motivo }); aviso('Hecho: tu coach lo mirará'); alCerrar(); } catch (err) { aviso(err.message, 'error'); }
        });
      }}>
        <p class="secundario">Tu coach lo verá en Revisar y decidirá. A quien lo ha escrito no se le dice quién ha avisado.</p>
        <div class="campo">
          <label for="eq-motivo">Por qué (si quieres)</label>
          <textarea id="eq-motivo" class="area" maxLength={MAX_MOTIVO} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} />
        </div>
        <button class="btn btn-primario" disabled={ocupado}><Icono n="bandera" /> Avisar al coach</button>
      </form>
    </Hoja>
  );
}

function HojaComentarios({ post, coach, alCerrar, alCambiar }) {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.comentariosComunidad(post.id), [post.id]);
  const [texto, setTexto] = useState('');
  const [avisar, setAvisar] = useState(null);
  const [ocupado, una] = useUnaVez();
  const recargar = async () => { await lista.recargar(true); alCambiar(); };
  const enviar = (e) => {
    e.preventDefault();
    una(async () => {
      try { await api.comentarEnComunidad(post.id, texto); setTexto(''); await recargar(); } catch (err) { aviso(err.message, 'error'); }
    });
  };
  const accion = (fn, texto2) => una(async () => { try { await fn(); aviso(texto2); await recargar(); } catch (err) { aviso(err.message, 'error'); } });
  return (
    <Hoja titulo="Comentarios" alCerrar={alCerrar}>
      <div class="pila">
        {lista.cargando && !lista.datos ? <Cargando texto="Cargando los comentarios" /> : !(lista.datos || []).length ? (
          <p class="secundario">Aún no hay comentarios. ¡Anímale!</p>
        ) : (
          <ul class="lista comentarios-equipo">
            {lista.datos.map((c) => (
              <li key={c.id} class="comentario-equipo">
                <Avatar nombre={c.autor.nombre} foto={c.autor.foto} clase="peq" />
                <div class="pila-xs">
                  <span class="peq"><strong>{c.autor.nombre}</strong>{c.autor.coach && <span class="chip morado chip-mini">Coach</span>} <span class="mini terciario">{cuando(c.creado_en)}</span></span>
                  <span class="post-texto peq">{c.texto}</span>
                  {c.oculto && <span class="mini terciario">Oculto: los atletas no lo ven.</span>}
                  <span class="fila-envolver comentario-acciones">
                    {(coach || c.mio) && <button class="btn-texto mini peligro" disabled={ocupado} onClick={() => accion(() => api.borrarComentarioComunidad(c.id), 'Comentario borrado')}>Borrar</button>}
                    {coach && !c.mio && <button class="btn-texto mini" disabled={ocupado} onClick={() => accion(() => api.ocultarComentarioComunidad(c.id, !c.oculto), c.oculto ? 'Vuelve a verse' : 'Comentario oculto')}>{c.oculto ? 'Mostrar' : 'Ocultar'}</button>}
                    {!coach && !c.mio && !c.autor.coach && <button class="btn-texto mini" onClick={() => setAvisar(c.id)}>Avisar al coach</button>}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form class="pila-s" onSubmit={enviar}>
          <label class="sr" for="eq-comentario">Tu comentario</label>
          <textarea id="eq-comentario" class="area" maxLength={MAX_COMENTARIO} rows={2} placeholder="Escribe un comentario…" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
          <button class="btn btn-primario" disabled={ocupado || !texto.trim()}><Icono n="enviar" /> Comentar</button>
        </form>
      </div>
      {avisar && <HojaAvisar comentarioId={avisar} alCerrar={() => setAvisar(null)} />}
    </Hoja>
  );
}

// ---------------------------------------------------------------- retos
export function Retos({ coach = false }) {
  const { api } = useApp();
  const retos = useCarga(() => api.retosComunidad(), []);
  const [editar, setEditar] = useState(null); // {} nuevo · reto
  const hoy = hoyISO();
  const lista = retos.datos || [];
  const orden = { en_marcha: 0, proximo: 1, terminado: 2 };
  const ordenados = [...lista].sort((a, b) => orden[estadoReto(a, hoy)] - orden[estadoReto(b, hoy)]);
  return (
    <div class="pila retos">
      {coach && <button class="btn" style="justify-self:start" onClick={() => setEditar({})}><Icono n="mas" /> Nuevo reto</button>}
      <ErrorCaja error={retos.error} reintentar={() => retos.recargar()} />
      {retos.cargando && !retos.datos ? <Siluetas forma="tarjetas" n={2} texto="Cargando los retos" />
        : !ordenados.length ? <Vacio icono="diana" titulo="Aún no hay retos">{coach ? 'Crea uno: un número de sesiones entre dos fechas. Lo puede conseguir todo el equipo.' : 'Cuando tu coach proponga uno, lo verás aquí.'}</Vacio>
          : ordenados.map((r) => <TarjetaReto key={r.id} r={r} hoy={hoy} coach={coach} alEditar={() => setEditar(r)} />)}
      {editar && <HojaReto reto={editar.id ? editar : null} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); retos.recargar(true); }} />}
    </div>
  );
}

function TarjetaReto({ r, hoy, coach, alEditar }) {
  const yo = r.progreso.find((x) => x.yo);
  const conseguido = r.progreso.filter((x) => x.hechas >= r.objetivo).length;
  const estado = estadoReto(r, hoy);
  return (
    <article class="panel panel-pad pila-s reto" aria-label={`Reto: ${r.titulo}`}>
      <div class="separa">
        <div class="pila-xs"><h2 class="reto-titulo">{r.titulo}</h2><span class="mini terciario">{fmtCorta(r.desde)} – {fmtCorta(r.hasta)} · {r.objetivo} {r.objetivo === 1 ? 'sesión' : 'sesiones'}</span></div>
        <span class={`chip ${estado === 'en_marcha' ? 'morado' : ''}`}>{textoReto(r, hoy)}</span>
      </div>
      {r.descripcion && <p class="peq secundario post-texto">{r.descripcion}</p>}
      {yo && <p class="peq reto-yo">{yo.hechas >= r.objetivo ? <><Icono n="trofeo" /> ¡Conseguido! {yo.hechas} de {r.objetivo}</> : <>Llevas <strong class="num">{yo.hechas}</strong> de {r.objetivo}</>}</p>}
      {r.progreso.length > 0 && (
        <ul class="lista progreso-equipo">
          {r.progreso.map((x) => <FilaProgreso key={x.perfil_id} nombre={x.nombre} foto={x.foto} yo={x.yo} hechas={x.hechas} total={r.objetivo} texto={`${Math.min(x.hechas, r.objetivo)}/${r.objetivo}`} />)}
        </ul>
      )}
      <div class="separa">
        <span class="mini terciario">{conseguido ? `${conseguido} ${conseguido === 1 ? 'lo ha conseguido' : 'lo han conseguido'}` : 'Cuentan las sesiones terminadas entre esas fechas.'}</span>
        {coach && <button class="btn btn-peq" onClick={alEditar}><Icono n="editar" /> Cambiar</button>}
      </div>
    </article>
  );
}

function FilaProgreso({ nombre, foto, yo, hechas, total, texto, pos = null }) {
  const pct = total ? Math.min(100, Math.round((hechas / total) * 100)) : 0;
  return (
    <li class={`fila-progreso ${yo ? 'yo' : ''}`}>
      {pos != null && <span class="pos num" aria-hidden="true">{pos}</span>}
      <Avatar nombre={nombre} foto={foto} clase="peq" />
      <span class="nombre">{nombre}{yo ? ' (tú)' : ''}</span>
      <span class="barra-equipo" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={Math.min(hechas, total)} aria-label={`${nombre}: ${hechas} de ${total}`}><span style={{ width: `${Math.max(pct ? 4 : 0, pct)}%` }} class={hechas >= total ? 'lleno' : ''} /></span>
      <span class="num peq">{texto}</span>
    </li>
  );
}

function HojaReto({ reto, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const lunes = lunesDe(hoyISO());
  const [f, setF] = useState(() => reto ? { titulo: reto.titulo, descripcion: reto.descripcion || '', desde: reto.desde, hasta: reto.hasta, objetivo: reto.objetivo }
    : { titulo: '', descripcion: '', desde: lunes, hasta: sumarDias(lunes, 27), objetivo: 10 });
  const [borrar, setBorrar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const c = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const guardar = (e) => {
    e.preventDefault();
    una(async () => { try { await api.guardarReto({ ...f, objetivo: Number(f.objetivo) }, reto?.id || null); aviso(reto ? 'Reto guardado' : 'Reto creado'); alGuardar(); } catch (err) { aviso(err.message, 'error'); } });
  };
  return (
    <Hoja titulo={reto ? 'Cambiar el reto' : 'Nuevo reto'} alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar}>
        <div class="campo"><label for="reto-titulo">Título</label><input id="reto-titulo" class="entrada" maxLength={80} required value={f.titulo} onInput={c('titulo')} placeholder="Noviembre constante" /></div>
        <div class="campo"><label for="reto-desc">Descripción (opcional)</label><textarea id="reto-desc" class="area" maxLength={500} value={f.descripcion} onInput={c('descripcion')} /></div>
        <div class="fila-envolver">
          <div class="campo"><label for="reto-desde">Desde</label><input id="reto-desde" type="date" class="entrada" required value={f.desde} onInput={c('desde')} /></div>
          <div class="campo"><label for="reto-hasta">Hasta</label><input id="reto-hasta" type="date" class="entrada" required value={f.hasta} onInput={c('hasta')} /></div>
        </div>
        <div class="campo"><label for="reto-obj">Sesiones terminadas para conseguirlo</label><input id="reto-obj" type="number" inputMode="numeric" min="1" max="100" class="entrada entrada-num" required value={f.objetivo} onInput={c('objetivo')} /></div>
        <p class="mini terciario">Lo puede conseguir todo el equipo. Cada uno ve cuántas lleva cada miembro (solo el número de sesiones), menos quien ha elegido no salir en el ranking.</p>
        <button class="btn btn-primario" disabled={ocupado}>{reto ? 'Guardar' : 'Crear el reto'}</button>
        {reto && (borrar ? (
          <div class="fila-envolver"><span class="peq">¿Borrar este reto?</span><button type="button" class="btn btn-peq" onClick={() => setBorrar(false)}>No</button>
            <button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={() => una(async () => { try { await api.borrarReto(reto.id); aviso('Reto borrado'); alGuardar(); } catch (err) { aviso(err.message, 'error'); } })}>Sí, borrar</button></div>
        ) : <button type="button" class="btn-texto peligro" style="justify-self:start" onClick={() => setBorrar(true)}><Icono n="basura" /> Borrar el reto</button>)}
      </form>
    </Hoja>
  );
}

// ---------------------------------------------------------------- ranking de constancia
export function Ranking({ miembro = null }) {
  const { api } = useApp();
  const ranking = useCarga(() => api.rankingComunidad(), []);
  const filas = ranking.datos || [];
  const yo = filas.find((x) => x.yo);
  const fuera = !!miembro?.sin_ranking;
  const lista = ordenarRanking(filas.filter((x) => !(fuera && x.yo)));
  return (
    <div class="pila ranking">
      <p class="peq secundario">Sesiones hechas de las que tenéis esta semana. Solo cuenta la constancia: ni kilos ni peso.</p>
      <ErrorCaja error={ranking.error} reintentar={() => ranking.recargar()} />
      {fuera && <p class="nota peq">No sales en el ranking (lo cambias en los ajustes del equipo).{yo ? ` Tu semana: ${yo.hechas} de ${yo.previstas}.` : ''}</p>}
      {ranking.cargando && !ranking.datos ? <Siluetas forma="lista" n={4} texto="Cargando el ranking" />
        : !lista.length ? <Vacio icono="progreso" titulo="Aún no hay nadie en el ranking">Salen los del equipo con sesiones publicadas esta semana.</Vacio> : (
          <div class="panel">
            <ul class="lista progreso-equipo">
              {lista.map((x, i) => <FilaProgreso key={x.perfil_id} pos={i + 1} nombre={x.nombre} foto={x.foto} yo={x.yo} hechas={x.hechas} total={x.previstas} texto={`${x.hechas} de ${x.previstas}`} />)}
            </ul>
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------- ajustes del atleta
function HojaAjustesComunidad({ miembro, alCerrar, alCambiar }) {
  const { api, aviso } = useApp();
  const [nombre, setNombre] = useState(miembro.nombre);
  const [salir, setSalir] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const hacer = (fn, texto, cerrar = false) => una(async () => {
    try { await fn(); aviso(texto); if (cerrar) alCerrar(); alCambiar(); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <Hoja titulo="Ajustes de la comunidad" alCerrar={alCerrar}>
      <div class="pila">
        <form class="pila-s" onSubmit={(e) => { e.preventDefault(); hacer(() => api.ajustesComunidad({ nombre }), 'Nombre guardado'); }}>
          <div class="campo"><label for="eq-nombre-aj">Tu nombre en el equipo</label><input id="eq-nombre-aj" class="entrada" maxLength={40} value={nombre} onInput={(e) => setNombre(e.currentTarget.value)} /></div>
          <button class="btn btn-peq" style="justify-self:start" disabled={ocupado || !nombreValido(nombre) || nombre.trim() === miembro.nombre}>Guardar el nombre</button>
        </form>
        <div class="panel"><ul class="lista">
          <Interruptor id="eq-sin-ranking" texto="No salir en el ranking" ayuda="Ni en el ranking ni en los retos de los demás. Tú sigues viendo lo tuyo." valor={!!miembro.sin_ranking} desactivado={ocupado}
            alCambiar={(v) => hacer(() => api.ajustesComunidad({ sinRanking: v }), v ? 'Ya no sales en el ranking' : 'Vuelves a salir en el ranking')} />
        </ul></div>
        <details class="pila-s que-se-comparte"><summary>Qué se comparte y con quién</summary><QueSeComparte /></details>
        {!salir ? (
          <button class="btn btn-peligro" style="justify-self:start" onClick={() => setSalir(true)}><Icono n="salir" /> Salir de la comunidad</button>
        ) : (
          <div class="panel panel-pad pila-s">
            <p>Al salir, lo tuyo deja de verse para los demás (y vuelve a verse si entras otra vez). La pestaña sigue ahí para volver cuando quieras.</p>
            <label class="casilla"><input type="checkbox" checked={borrar} onChange={(e) => setBorrar(e.currentTarget.checked)} /><span>Borrar también lo que he publicado, comentado y reaccionado</span></label>
            <div class="fila-envolver">
              <button class="btn" onClick={() => setSalir(false)}>Cancelar</button>
              <button class="btn btn-peligro" disabled={ocupado} onClick={() => hacer(() => api.salirComunidad({ borrar }), 'Has salido de la comunidad', true)}>Salir</button>
            </div>
          </div>
        )}
      </div>
    </Hoja>
  );
}

// ---------------------------------------------------------------- compartir un entreno (Resumen de la sesión)
// datos: { sesionId, nombre, fecha, minutos, series, mejores: [{ ejercicio_id, nombre, kg, reps }] }. Los récords
// de la vista previa, con la misma regla que la base (recordsParaEquipo): así la tarjeta sale igual.
export function HojaCompartirEquipo({ datos, alCerrar, alCompartir }) {
  const { api, aviso, atleta } = useApp();
  const [texto, setTexto] = useState('');
  const [kilos, setKilos] = useState(false);
  const [ocupado, una] = useUnaVez();
  const records = useCarga(() => api.recordsParaEquipo(atleta.id, datos.sesionId).catch(() => new Set()), [datos.sesionId]);
  const previa = {
    nombre: datos.nombre, fecha: datos.fecha, minutos: datos.minutos, series: datos.series, con_kilos: kilos,
    ejercicios: datos.mejores.map((m) => ({ nombre: m.nombre, record: !!records.datos?.has(m.ejercicio_id), ...(kilos ? { kg: m.kg, reps: m.reps, e1rm: m.e1rm } : {}) })),
  };
  return (
    <Hoja titulo="Compartir con el equipo" alCerrar={alCerrar}>
      <form class="pila" onSubmit={(e) => {
        e.preventDefault();
        una(async () => {
          try {
            await api.compartirEnEquipo(datos.sesionId, { texto, kilos });
            aviso('Compartido con el equipo');
            alCompartir();
          } catch (err) { aviso(err.message, 'error'); }
        });
      }}>
        <div class="campo"><label for="eq-entreno-texto">Un comentario (opcional)</label>
          <textarea id="eq-entreno-texto" class="area" maxLength={MAX_POST} rows={2} placeholder="¿Cómo ha ido?" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} /></div>
        <div class="panel"><ul class="lista">
          <Interruptor id="eq-kilos" texto="Enseñar los kilos" ayuda="Tu mejor serie de cada ejercicio y las cifras de tus récords" valor={kilos} alCambiar={setKilos} />
        </ul></div>
        <div class="pila-s">
          <span class="mini terciario">Así lo verá el equipo:</span>
          <div class="post post-entreno ee-previa"><TarjetaEntreno r={previa} /></div>
        </div>
        <p class="mini terciario">Lo ven los del equipo y tu coach. Nunca va tu peso corporal ni datos de salud.</p>
        <button class="btn btn-primario btn-grande" disabled={ocupado}><Icono n="equipo" /> {ocupado ? 'Compartiendo…' : 'Compartir con el equipo'}</button>
      </form>
    </Hoja>
  );
}
