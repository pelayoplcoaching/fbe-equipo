import { useRef, useState } from 'preact/hooks';
import { Hoja, Icono, useApp } from '../comunes.jsx';
import { limpiarEncuesta, alternarVoto, resultadoEncuesta, textoTipoEncuesta, MAX_OPCIONES, MIN_OPCIONES } from '../../logica/encuestas.js';

// Las encuestas del chat (v0.56, migración 034). El coach la crea (aquí o en una lista de difusión: cada atleta recibe la
// suya); el atleta de esa conversación vota tocando una opción (y la cambia, o la quita, tocando otra vez); el coach ve
// qué ha votado. El voto solo lo ven ellos dos.

// En la burbuja
export function EncuestaChat({ c, yo, alVotado }) {
  const { api, aviso } = useApp();
  const e = c.encuesta;
  const [voto, setVoto] = useState(e.voto || []);
  const [ocupado, setOcupado] = useState(false);
  const puedeVotar = yo === 'atleta' && !c.eliminado_en && !c.programado;
  const res = resultadoEncuesta(e, voto);
  async function tocar(i) {
    if (!puedeVotar || ocupado) return;
    const nuevo = alternarVoto(voto, i, e.multiple);
    const antes = voto;
    setVoto(nuevo); setOcupado(true);
    try { await api.votarEncuestaChat(e.id, nuevo); alVotado?.(); } catch (err) { setVoto(antes); aviso(err.message, 'error'); } finally { setOcupado(false); }
  }
  const nombreGrupo = `encuesta-${e.id}`;
  return (
    <fieldset class="encuesta-chat" aria-busy={ocupado ? 'true' : 'false'}>
      <legend class="encuesta-pregunta"><Icono n="encuesta" /> <strong>{e.pregunta}</strong></legend>
      <p class="mini secundario">{textoTipoEncuesta(e.multiple)}{yo === 'coach' ? (res.votado ? ' · Ha votado' : ' · Aún no ha votado') : ''}</p>
      <ul class="encuesta-opciones">
        {res.filas.map((f) => (
          <li key={f.i}>
            <label class={`encuesta-opcion ${f.elegida ? 'elegida' : ''} ${puedeVotar ? '' : 'solo-ver'}`}>
              <input type={e.multiple ? 'checkbox' : 'radio'} name={nombreGrupo} checked={f.elegida} disabled={!puedeVotar || ocupado}
                onClick={(ev) => { ev.preventDefault(); tocar(f.i); }} onChange={() => {}} />
              <span class="encuesta-texto">{f.texto}</span>
              <span class="encuesta-barra" aria-hidden="true"><span style={{ width: `${res.total ? (f.votos / res.total) * 100 : 0}%` }} /></span>
              {yo === 'coach' && <span class="mini num encuesta-n">{f.votos ? '✓' : ''}<span class="sr">{f.votos ? ' (su respuesta)' : ''}</span></span>}
            </label>
          </li>
        ))}
      </ul>
      {puedeVotar && res.votado && <p class="mini terciario">Toca otra opción para cambiar tu voto (o la tuya para quitarlo).</p>}
    </fieldset>
  );
}

// Crear una encuesta (el coach): pregunta, de 2 a 12 opciones y si se puede elegir más de una
export function HojaEncuesta({ atletaId = null, listaId = null, para = '', alCerrar, alEnviada }) {
  const { api, aviso } = useApp();
  const [pregunta, setPregunta] = useState('');
  const [opciones, setOpciones] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const envio = useRef({});
  const cambiar = (i, v) => { envio.current = {}; setOpciones((xs) => { const n = xs.map((x, j) => (j === i ? v : x)); return n; }); };
  const lista = limpiarEncuesta({ pregunta, opciones, multiple });
  async function enviar(ev) {
    ev?.preventDefault();
    if (!lista.ok) { aviso(lista.error, 'error'); return; }
    setEnviando(true);
    try {
      const r = await api.crearEncuestaChat({ atletaId, listaId, pregunta, opciones, multiple, envio: envio.current });
      aviso(listaId ? `Encuesta enviada a ${r.enviados} ${r.enviados === 1 ? 'atleta' : 'atletas'}${r.saltados ? ` (${r.saltados} de baja)` : ''}` : 'Encuesta enviada');
      alEnviada?.(r);
    } catch (err) { aviso(err.message, 'error'); } finally { setEnviando(false); }
  }
  return (
    <Hoja titulo={para ? `Encuesta para ${para}` : 'Nueva encuesta'} alCerrar={alCerrar} medio>
      <form class="pila" onSubmit={enviar}>
        <div class="campo"><label for="encuesta-pregunta">Pregunta</label>
          <input id="encuesta-pregunta" class="entrada" maxLength={300} required value={pregunta} placeholder="¿Qué día te va mejor para el test?" onInput={(e) => { envio.current = {}; setPregunta(e.currentTarget.value); }} /></div>
        <fieldset class="pila-xs">
          <legend class="peq">Opciones (de {MIN_OPCIONES} a {MAX_OPCIONES})</legend>
          {opciones.map((o, i) => (
            <div key={i} class="fila encuesta-campo">
              <input class="entrada" maxLength={100} value={o} aria-label={`Opción ${i + 1}`} placeholder={`Opción ${i + 1}`} onInput={(e) => cambiar(i, e.currentTarget.value)} />
              {opciones.length > MIN_OPCIONES && <button type="button" class="btn btn-icono plano" aria-label={`Quitar la opción ${i + 1}`} onClick={() => { envio.current = {}; setOpciones((xs) => xs.filter((_, j) => j !== i)); }}><Icono n="cerrar" /></button>}
            </div>
          ))}
          {opciones.length < MAX_OPCIONES && <button type="button" class="btn btn-peq" onClick={() => setOpciones((xs) => [...xs, ''])}><Icono n="mas" /> Añadir opción</button>}
        </fieldset>
        <label class="casilla"><input type="checkbox" checked={multiple} onChange={(e) => { envio.current = {}; setMultiple(e.currentTarget.checked); }} /><span>Se puede elegir más de una</span></label>
        <p class="mini secundario">{listaId ? 'Cada atleta de la lista recibe la suya, en su chat; nadie ve a los demás ni sus votos.' : 'Solo la ve esta conversación; su voto solo lo ves tú.'}</p>
        <div class="fila-envolver hoja-pie-fijo">
          <button class="btn btn-primario" disabled={enviando || !lista.ok}><Icono n="enviar" /> {enviando ? 'Enviando…' : 'Enviar la encuesta'}</button>
        </div>
      </form>
    </Hoja>
  );
}
