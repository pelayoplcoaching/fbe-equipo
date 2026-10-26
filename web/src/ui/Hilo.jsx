import { useEffect, useRef, useState } from 'preact/hooks';
import { useUnaVez, useApp, useCarga, Icono, Cargando, Hoja, cuando } from './comunes.jsx';
import { RESPUESTAS_EJEMPLO } from '../datos/respuestas.js';
import { TextoConMomentos, BotonDibujo, reproductorDe, textoMomento } from './Video.jsx';
import { describirDibujo, dibujoValido } from '../logica/dibujo.js';

// Conversación entre coach y atleta pegada a una sesión, un check-in o un vídeo.
// Al abrirla, lo que escribió la otra parte queda como leído (alLeer); al enviar, avisa con alCambiar.
export function Hilo({ atletaId, sesionId = null, checkinId = null, archivoId = null, nombreAtleta = 'Atleta', placeholder, vacio, alCambiar, alLeer }) {
  const { api, perfil, aviso } = useApp();
  const yo = perfil?.rol === 'coach' ? 'coach' : 'atleta';
  const hilo = useCarga(() => api.comentarios({ atletaId, sesionId, checkinId, archivoId }), [atletaId, sesionId, checkinId, archivoId]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [guardadas, setGuardadas] = useState(false);
  const [dibujo, setDibujo] = useState(null);         // el dibujo hecho sobre el vídeo, pendiente de enviar
  const [dibujando, setDibujando] = useState(false);
  const area = useRef(null);
  const primerNombre = nombreAtleta.split(' ')[0];

  useEffect(() => {
    const ids = (hilo.datos || []).filter((c) => c.autor !== yo && !c.leido_en).map((c) => c.id);
    if (ids.length) api.marcarLeidos(ids).then(() => alLeer?.()).catch(() => {});
  }, [hilo.datos]);

  async function enviar(e) {
    e?.preventDefault();
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      await api.comentar({ atletaId, sesionId, checkinId, archivoId, texto, autor: yo, dibujo });
      setTexto(''); setDibujo(null);
      await hilo.recargar(true);
      alCambiar?.();
    } catch (err) { aviso(err.message, 'error'); } finally { setEnviando(false); }
  }

  const lista = hilo.datos || [];
  const nombre = (autor) => (autor === yo ? 'Tú' : autor === 'coach' ? 'Tu coach' : nombreAtleta.split(' ')[0]);
  return (
    <div class="hilo">
      {hilo.cargando && !hilo.datos ? <Cargando /> : !lista.length ? (vacio ? <p class="peq terciario">{vacio}</p> : null) : (
        <ol class="mensajes">
          {lista.map((c) => (
            <li key={c.id} class={`mensaje ${c.autor === yo ? 'mio' : 'suyo'}`}>
              <span class="quien">{nombre(c.autor)}</span>
              <p>{archivoId ? <TextoConMomentos texto={c.texto} archivoId={archivoId} /> : c.texto}</p>
              {dibujoValido(c.dibujo) && <BotonDibujo dibujo={c.dibujo} archivoId={archivoId} />}
              <span class="cuando">{cuando(c.creado_en)}{c.autor === yo && c.leido_en ? ', visto' : ''}</span>
            </li>
          ))}
        </ol>
      )}
      <form class="responder" onSubmit={enviar}>
        <textarea ref={area} class="area" rows={2} aria-label={yo === 'coach' ? `Responder a ${nombreAtleta.split(' ')[0]}` : 'Escribir a tu coach'}
          placeholder={placeholder || (yo === 'coach' ? 'Responder…' : 'Escribe a tu coach…')} value={texto}
          onInput={(e) => setTexto(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) enviar(e); }} />
        <button class="btn btn-primario btn-icono" aria-label="Enviar" disabled={enviando || !texto.trim()}><Icono n="enviar" /></button>
      </form>
      {dibujo && (
        <div class="chip morado chip-dibujo"><Icono n="regla" /> Dibujo en {textoMomento(dibujo.t, true)}: {describirDibujo(dibujo, reproductorDe(archivoId)?.proporcion?.() || 1)}
          <button type="button" class="btn-texto mini" aria-label="Quitar el dibujo" onClick={() => setDibujo(null)}><Icono n="cerrar" /></button></div>
      )}
      <div class="hilo-extras">
        {archivoId && !dibujando && (
          <button type="button" class="btn-texto mini" onClick={() => {
            const r = reproductorDe(archivoId);
            if (!r) return;
            setDibujando(true);
            r.dibujar((d) => { setDibujando(false); if (d) { setDibujo(d); const m = textoMomento(d.t, true); setTexto((x) => (x.includes(m) ? x : x.trim() ? `${x.trimEnd()}\n${m} ` : `${m} `)); area.current?.focus(); } });
          }}><Icono n="regla" /> Dibujar sobre el vídeo</button>
        )}
        {archivoId && (
          <button type="button" class="btn-texto mini" onClick={() => {
            const r = reproductorDe(archivoId);
            if (!r) return;
            const m = textoMomento(r.ahora(), true);
            setTexto((x) => (x.trim() ? `${x.trimEnd()}\n${m} ` : `${m} `));
            area.current?.focus();
          }}><Icono n="reloj" /> Comentar este momento</button>
        )}
        {yo === 'coach' && <button type="button" class="btn-texto mini responder-guardadas" onClick={() => setGuardadas(true)}><Icono n="rayo" /> Respuestas guardadas</button>}
      </div>
      {guardadas && (
        <HojaRespuestas nombre={primerNombre} texto={texto} alCerrar={() => setGuardadas(false)}
          alElegir={(t) => { setTexto((x) => (x.trim() ? `${x.trimEnd()}\n\n${t}` : t)); setGuardadas(false); }} />
      )}
    </div>
  );
}

// Tus respuestas habituales: tocar una la pone en el cuadro ({nombre} = el nombre del atleta)
export function HojaRespuestas({ nombre, texto, alCerrar, alElegir }) {
  const { api, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const lista = useCarga(() => api.respuestasGuardadas(), []);
  const [titulo, setTitulo] = useState('');
  const [editar, setEditar] = useState(false);
  const rellenar = (t) => t.replace(/\{nombre\}/g, nombre);
  // El nombre del atleta (palabra entera, también con tildes) pasa a ser {nombre}
  const comoPlantilla = (t) => {
    if (!nombre || nombre === 'Atleta') return t;
    const seguro = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Sin «lookbehind» (Safari anterior a la 16.4 no lo entiende): se captura el carácter de antes y se devuelve
    return t.replace(new RegExp(`(^|[^\\p{L}])${seguro}(?!\\p{L})`, 'gu'), '$1{nombre}');
  };
  async function guardar() {
    try {
      await api.crear('respuestas_guardadas', { titulo: titulo.trim(), texto: comoPlantilla(texto.trim()), orden: (lista.datos?.length || 0) + 1 });
      setTitulo(''); aviso('Respuesta guardada'); lista.recargar(true);
    } catch (e) { aviso(e.message, 'error'); }
  }
  return (
    <Hoja titulo="Respuestas guardadas" alCerrar={alCerrar}>
      {lista.cargando && !lista.datos ? <Cargando /> : !lista.datos?.length ? (
        <div class="pila-s">
          <p class="secundario">Aún no tienes respuestas guardadas. Escribe una en el cuadro y guárdala aquí, o empieza con unas de ejemplo y edítalas a tu gusto.</p>
          <button class="btn" style="justify-self:start" disabled={ocupado} onClick={() => una(async () => {
            try { for (const [i, [t, x]] of RESPUESTAS_EJEMPLO.entries()) await api.crear('respuestas_guardadas', { titulo: t, texto: x, orden: i + 1 }); await lista.recargar(true); }
            catch (e) { aviso(e.message, 'error'); }
          })}><Icono n="mas" /> Añadir las de ejemplo</button>
        </div>
      ) : (
        <>
          <div class="lista-elegir">
            {lista.datos.map((r) => (
              <div key={r.id} class="respuesta-guardada">
                <button onClick={() => alElegir(rellenar(r.texto))} disabled={editar}>
                  <span style="font-weight:650">{r.titulo}</span>
                  <span class="mini terciario">{rellenar(r.texto).slice(0, 110)}{r.texto.length > 110 ? '…' : ''}</span>
                </button>
                {editar && <button class="btn btn-icono plano btn-peligro" aria-label={`Quitar «${r.titulo}»`} onClick={async () => { await api.borrar('respuestas_guardadas', r.id); lista.recargar(true); }}><Icono n="basura" /></button>}
              </div>
            ))}
          </div>
          <button class="btn-texto" style="justify-self:start" onClick={() => setEditar(!editar)}>{editar ? 'Hecho' : 'Quitar alguna'}</button>
        </>
      )}
      {texto.trim() && (
        <div class="panel-pad nota pila-s">
          <span class="peq">Guardar lo que has escrito como respuesta{nombre && texto.includes(nombre) ? ` (su nombre se guardará como «{nombre}»)` : ''}:</span>
          <div class="fila" style="gap:8px">
            <input class="entrada" aria-label="Título de la respuesta" placeholder="Título, por ejemplo: Sube la carga" maxLength={80} value={titulo} onInput={(e) => setTitulo(e.currentTarget.value)} />
            <button class="btn btn-primario" disabled={!titulo.trim()} onClick={guardar}>Guardar</button>
          </div>
        </div>
      )}
      <p class="mini terciario">Escribe {'{nombre}'} donde quieras que vaya el nombre del atleta.</p>
    </Hoja>
  );
}
