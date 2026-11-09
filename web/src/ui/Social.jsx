// La parte social del equipo (tanda «social», migración 053): lo que los atletas hacen entre ellos. Lo usan Comunidad.jsx
// (Equipo, el muro y el ranking), PerfilSocial.jsx (tu huella) y los ajustes de la comunidad. Sin la 053 en la base, nada
// de esto sale (cada pieza pregunta por lo suyo y, si la base no lo tiene, devuelve vacío).
//   · CumplesEquipo: «Hoy es el cumple de Rubén 🎂 · Felicitar» (y, si es el tuyo, quién te ha felicitado).
//   · HojaAnimo: el ánimo de siempre con unas palabras (hasta 80), opcional.
//   · HoyEntrenan: quién ha dicho cuándo entrena hoy y mañana, y «Hoy entreno a las…».
//   · Duelos: retar a alguien a la semana (sesiones), aceptar y ver cómo va.
//   · Padrinos: acompañar a quien acaba de entrar su primer mes.
//   · CompaneroSemana (en Ranking): el elegido por el equipo la semana pasada y tu voto de esta.
//   · NecesitanAnimo: quien lo enciende y lleva 5 días o más sin entrenar.
//   · LoMejorSemana (en el muro, lunes y martes) y MismaSesionHoy («Rubén y Carlos han hecho Pierna A · Chocar»).
//   · AlbumEquipo: las fotos del muro por meses.
//   · Huella (en Perfil → En el equipo): tus cifras sociales en frases.
import { useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Avatar, Cargando, Segmentos } from './comunes.jsx';
import { Interruptor } from './Ajustes.jsx';
import { quienes } from '../logica/comunidad.js';
import { mismaSesion, loMejorDeLaSemana, albumPorMeses, textoIntencion, textoDuelo, resultadoDuelo, huellaFrases, candidatosDuelo, limpiarNotaIntencion, textoCumples } from '../logica/social.js';
import { fechaMadrid, sumarDias, lunesDe, fmtCorta, fmtConDia } from '../logica/fechas.js';

// Las personas del equipo (sin el coach), para elegir a alguien: [{ perfil_id, nombre, foto }]
function usePersonas() {
  const { api } = useApp();
  const p = useCarga(() => api.personasComunidad().catch(() => ({})), []);
  const yo = api.uid();
  return useMemo(() => Object.entries(p.datos || {}).map(([perfil_id, x]) => ({ perfil_id, ...x })).filter((x) => !x.coach && x.perfil_id !== yo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [p.datos]);
}

// ---------------------------------------------------------------- el ánimo con unas palabras
export function HojaAnimo({ perfilId, nombre, prefijo = '', titulo = null, alCerrar, alHecho = null }) {
  const { api, aviso } = useApp();
  const [texto, setTexto] = useState(prefijo);
  const [ocupado, una] = useUnaVez();
  const mandar = (e) => {
    e?.preventDefault();
    una(async () => {
      try { await api.animar(perfilId, texto); aviso(`Le has mandado ánimo a ${nombre} 🙌`); alHecho?.(); alCerrar(); } catch (err) { aviso(err.message, 'error'); }
    });
  };
  return (
    <Hoja titulo={titulo || `Animar a ${nombre}`} alCerrar={alCerrar}>
      <form class="pila" onSubmit={mandar}>
        <div class="campo">
          <label for="animo-texto">Unas palabras (si quieres)</label>
          <input id="animo-texto" class="entrada" maxLength={80} value={texto} placeholder="¡Vamos, que esta semana cae!" onInput={(e) => setTexto(e.currentTarget.value)} autoFocus />
          <span class="ayuda">Hasta 80 letras. Le llegan con el aviso del ánimo; el equipo no las ve.</span>
        </div>
        <button class="btn btn-primario" disabled={ocupado}><span aria-hidden="true">🙌</span> {texto.trim() ? 'Mandar el ánimo con tus palabras' : 'Mandar el ánimo'}</button>
      </form>
    </Hoja>
  );
}

// ---------------------------------------------------------------- cumpleaños
export function CumplesEquipo({ cambios = 0 }) {
  const { api } = useApp();
  const lista = useCarga(() => api.cumplesComunidad(), [cambios]);
  const animos = useCarga(() => api.animosComunidad().catch(() => null), [cambios]);
  const [felicitar, setFelicitar] = useState(null);
  const [hechos, setHechos] = useState([]);
  const xs = lista.datos || [];
  if (!xs.length) return null;
  const mio = xs.find((x) => x.soy_yo);
  const otros = xs.filter((x) => !x.soy_yo);
  const yaAnimado = (id) => hechos.includes(id) || !!animos.datos?.mandados?.has(id);
  const felicitaciones = (animos.datos?.recibidos || []).filter((r) => r.texto);
  return (
    <section class="panel panel-pad cumples-equipo pila-s" aria-label="Cumpleaños en el equipo">
      {mio && (
        <p class="cumple-mio"><span class="cumple-tarta" aria-hidden="true">🎂</span> <strong>¡Feliz cumpleaños, {mio.nombre.split(' ')[0]}!</strong>
          {felicitaciones.length > 0 ? <> Te han felicitado {quienes(felicitaciones.map((r) => r.nombre), 3)}.</> : ' El equipo lo sabe hoy.'}</p>
      )}
      {otros.length > 0 && (
        <div class="cumple-otros">
          <p class="cumple-texto"><span class="cumple-tarta" aria-hidden="true">🎂</span> <strong>{textoCumples(xs)}</strong></p>
          <div class="fila-envolver">
            {otros.map((x) => (
              <button key={x.perfil_id} type="button" class={`btn btn-peq ${yaAnimado(x.perfil_id) ? '' : 'btn-primario'}`} disabled={yaAnimado(x.perfil_id)} onClick={() => setFelicitar(x)}>
                {yaAnimado(x.perfil_id) ? <><Icono n="hecho" /> Felicitado</> : `Felicitar a ${x.nombre.split(' ')[0]}`}
              </button>
            ))}
          </div>
        </div>
      )}
      {felicitar && <HojaAnimo perfilId={felicitar.perfil_id} nombre={felicitar.nombre} titulo={`Felicitar a ${felicitar.nombre}`} prefijo="¡Feliz cumpleaños! 🎂" alCerrar={() => setFelicitar(null)} alHecho={() => setHechos((l) => [...l, felicitar.perfil_id])} />}
    </section>
  );
}

// ---------------------------------------------------------------- «hoy entreno a las…»
export function HoyEntrenan({ cambios = 0 }) {
  const { api, aviso } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const lista = useCarga(() => api.intencionesComunidad(), [vuelta, cambios]);
  const [editar, setEditar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const hoy = fechaMadrid();
  const xs = lista.datos;
  if (!xs) return null;
  const mia = xs.find((x) => x.soy_yo) || null;
  const otros = xs.filter((x) => !x.soy_yo);
  const deHoy = otros.filter((x) => x.fecha === hoy), deManana = otros.filter((x) => x.fecha !== hoy);
  const quitar = () => una(async () => { try { await api.decirIntencion(null); aviso('Quitado'); setVuelta((v) => v + 1); } catch (e) { aviso(e.message, 'error'); } });
  const linea = (ys, etq) => ys.length > 0 && (
    <p class="peq he-linea"><strong>{etq}</strong> {ys.map((x, i) => <span key={x.perfil_id}>{i > 0 && ', '}{x.nombre}{x.hora ? <> a las <b class="he-hora">{x.hora.replace(/^0/, '')}</b></> : ''}{x.nota ? ` (${x.nota})` : ''}</span>)}</p>
  );
  return (
    <section class="panel panel-pad hoy-entrenan pila-s" aria-labelledby="he-t">
      <div class="separa">
        <h2 id="he-t" class="he-t"><Icono n="reloj" /> {otros.length ? 'Hoy entrenan' : 'Coincidir para entrenar'}</h2>
        <button type="button" class="btn btn-peq" onClick={() => setEditar(true)}>{mia ? 'Cambiar' : 'Hoy entreno a las…'}</button>
      </div>
      {linea(deHoy, 'Hoy:')}
      {linea(deManana, 'Mañana:')}
      {mia
        ? <p class="peq secundario">Tú: {textoIntencion(mia, hoy)} · <button type="button" class="btn-texto mini" disabled={ocupado} onClick={quitar}>Quitar</button></p>
        : !otros.length && <p class="peq secundario">Di a qué hora entrenas (hoy o mañana) y quien quiera coincidir lo verá aquí. Se borra solo al día siguiente.</p>}
      {editar && <HojaIntencion mia={mia} alCerrar={() => setEditar(false)} alGuardar={() => { setEditar(false); setVuelta((v) => v + 1); }} />}
    </section>
  );
}
function HojaIntencion({ mia, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const hoy = fechaMadrid();
  const [fecha, setFecha] = useState(mia?.fecha || hoy);
  const [hora, setHora] = useState(mia?.hora || '');
  const [nota, setNota] = useState(mia?.nota || '');
  const [ocupado, una] = useUnaVez();
  const guardar = (e) => {
    e.preventDefault();
    una(async () => {
      try { await api.decirIntencion({ fecha, hora: hora || null, nota: limpiarNotaIntencion(nota) }); aviso('El equipo ya lo ve'); alGuardar(); } catch (err) { aviso(err.message, 'error'); }
    });
  };
  return (
    <Hoja titulo="¿Cuándo entrenas?" alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar}>
        <Segmentos etiqueta="Día" valor={fecha} alCambiar={(v) => setFecha(v || hoy)} opciones={[[hoy, 'Hoy'], [sumarDias(hoy, 1), 'Mañana']]} />
        <div class="rejilla-campos">
          <div class="campo"><label for="he-hora">Hora (opcional)</label><input id="he-hora" type="time" class="entrada" step="300" value={hora} onInput={(e) => setHora(e.currentTarget.value)} /></div>
          <div class="campo"><label for="he-nota">Dónde (opcional)</label><input id="he-nota" class="entrada" maxLength={40} value={nota} placeholder="Gimnasio del barrio" onInput={(e) => setNota(e.currentTarget.value)} /></div>
        </div>
        <p class="mini terciario">Lo ven los del equipo en «Hoy entrenan». Se quita solo al día siguiente.</p>
        <button class="btn btn-primario" disabled={ocupado}>Avisar al equipo</button>
      </form>
    </Hoja>
  );
}

// ---------------------------------------------------------------- duelos 1 a 1
export function Duelos({ cambios = 0 }) {
  const { api, aviso } = useApp();
  const yo = api.uid();
  const [vuelta, setVuelta] = useState(0);
  const lista = useCarga(() => api.duelosMios(), [vuelta, cambios]);
  const [retar, setRetar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const hoy = fechaMadrid();
  const xs = lista.datos;
  if (!xs) return null;
  const recargar = () => setVuelta((v) => v + 1);
  const responder = (d, acepta) => una(async () => {
    try { await api.responderDuelo(d.id, acepta); aviso(acepta ? '¡Duelo aceptado! Que gane quien más entrene' : 'Duelo rechazado'); recargar(); } catch (e) { aviso(e.message, 'error'); }
  });
  const retirar = (d) => una(async () => { try { await api.retirarDuelo(d.id); aviso('Duelo retirado'); recargar(); } catch (e) { aviso(e.message, 'error'); } });
  const vivos = xs.filter((d) => d.estado !== 'rechazado' || d.soy_retador);
  return (
    <div class="pila-s duelos">
      {!vivos.length && <p class="peq secundario">Reta a alguien del equipo a la semana: quién hace más sesiones de lunes a domingo. Lo veis los dos (y el coach).</p>}
      <ul class="lista duelos-lista">
        {vivos.map((d) => {
          const r = resultadoDuelo(d);
          return (
            <li key={d.id} class={`duelo-fila ${d.estado} ${r || ''}`}>
              <Avatar nombre={d.rival_nombre} foto={d.rival_foto} clase="peq" />
              <span class="pila-xs duelo-texto">
                <span class="duelo-linea">{textoDuelo(d, hoy)}</span>
                <span class="mini terciario">{d.semana > lunesDe(hoy) ? `Del ${fmtCorta(d.semana)} al ${fmtCorta(sumarDias(d.semana, 6))}` : d.acabado ? `Semana del ${fmtCorta(d.semana)}` : `Hasta el ${fmtConDia(sumarDias(d.semana, 6))}`}</span>
              </span>
              {d.estado === 'pendiente' && !d.soy_retador && !d.acabado && (
                <span class="fila duelo-acciones">
                  <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={() => responder(d, true)}>Acepto</button>
                  <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => responder(d, false)}>No</button>
                </span>
              )}
              {d.estado === 'pendiente' && d.soy_retador && <button type="button" class="btn btn-peq plano" disabled={ocupado} onClick={() => retirar(d)}>Retirar</button>}
              {d.estado === 'aceptado' && !d.acabado && d.suyas != null && (
                <span class="duelo-marcador num" aria-hidden="true">
                  <b class="dm-yo">{d.mias}<small>Tú</small></b><i>–</i><b>{d.suyas}<small>{String(d.rival_nombre || '').split(' ')[0]}</small></b>
                  <span class="duelo-barra" style={{ '--a': d.mias + 0.5, '--b': d.suyas + 0.5 }}><span /><span /></span>
                </span>
              )}
              {r && <span class={`chip duelo-resultado ${r}`}>{r === 'ganado' ? '🏆 Ganado' : r === 'perdido' ? 'Perdido' : 'Empate'}</span>}
            </li>
          );
        })}
      </ul>
      <button type="button" class="btn btn-peq duelo-retar" style="justify-self:start" onClick={() => setRetar(true)}><span aria-hidden="true">⚔️</span> Retar a alguien</button>
      {retar && <HojaRetar duelos={xs} yo={yo} alCerrar={() => setRetar(false)} alHecho={() => { setRetar(false); recargar(); }} />}
    </div>
  );
}
function HojaRetar({ duelos, yo, alCerrar, alHecho }) {
  const { api, aviso } = useApp();
  const personas = usePersonas();
  const hoy = fechaMadrid();
  const domingo = new Date(`${hoy}T12:00:00Z`).getUTCDay() === 0;
  const [proxima, setProxima] = useState(domingo);
  const semana = sumarDias(lunesDe(hoy), proxima || domingo ? 7 : 0);
  const lista = candidatosDuelo(personas, yo, duelos, semana);
  const [ocupado, una] = useUnaVez();
  const retar = (p) => una(async () => {
    try { await api.proponerDuelo(p.perfil_id, proxima || domingo); aviso(`Reto enviado a ${p.nombre}: en cuanto acepte, empieza`); alHecho(); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <Hoja titulo="Retar a un duelo" alCerrar={alCerrar}>
      <div class="pila">
        <p class="peq secundario">Quién hace más sesiones de lunes a domingo. Cuentan las sesiones terminadas de la semana publicada; empate si hacéis las mismas. Como mucho tres duelos a la vez.</p>
        {!domingo && <Segmentos etiqueta="Semana" valor={proxima ? 'proxima' : 'esta'} alCambiar={(v) => setProxima(v === 'proxima')} opciones={[['esta', 'Esta semana'], ['proxima', 'La que viene']]} />}
        {domingo && <p class="mini terciario">Hoy es domingo: el duelo es para la semana que viene.</p>}
        {!lista.length ? <p class="secundario">No hay nadie a quien retar esa semana.</p> : (
          <ul class="lista sc-lista">
            {lista.map((p) => (
              <li key={p.perfil_id} class="sc-fila">
                <Avatar nombre={p.nombre} foto={p.foto} clase="peq" />
                <span class="sc-texto">{p.nombre}</span>
                <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} aria-label={`Retar a ${p.nombre}`} onClick={() => retar(p)}>Retar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Hoja>
  );
}

// ---------------------------------------------------------------- padrinos
export function Padrinos({ cambios = 0 }) {
  const { api, aviso } = useApp();
  const yo = api.uid();
  const [vuelta, setVuelta] = useState(0);
  const d = useCarga(() => api.padrinosComunidad(), [vuelta, cambios]);
  const [ocupado, una] = useUnaVez();
  const x = d.datos;
  if (!x) return null;
  const miPadrino = x.vigentes.find((v) => v.nuevo === yo) || null;
  const misAhijados = x.vigentes.filter((v) => v.padrino === yo);
  const otros = x.vigentes.filter((v) => v.nuevo !== yo && v.padrino !== yo);
  const puedo = x.puedo && x.sin_padrino.length > 0 && misAhijados.length < 2;
  if (!miPadrino && !misAhijados.length && !otros.length && !puedo) return null;
  const apadrinar = (p) => una(async () => {
    try { await api.apadrinar(p.perfil_id); aviso(`Acompañas a ${p.nombre} su primer mes 🤝`); setVuelta((v) => v + 1); } catch (e) { aviso(e.message, 'error'); }
  });
  const dejar = (nuevo) => una(async () => { try { await api.quitarPadrino(nuevo); aviso('Hecho'); setVuelta((v) => v + 1); } catch (e) { aviso(e.message, 'error'); } });
  return (
    <section class="panel panel-pad padrinos pila-s" aria-labelledby="pd-t">
      <h2 id="pd-t" class="pd-t"><span aria-hidden="true">🤝</span> Acompañar a quien entra</h2>
      {miPadrino && (
        <p class="peq pd-mio"><Avatar nombre={miPadrino.padrino_nombre} foto={miPadrino.padrino_foto} clase="peq" /> <span><strong>{miPadrino.padrino_nombre}</strong> te acompaña tu primer mes (hasta el {fmtCorta(miPadrino.hasta)}): pregúntale lo que quieras mencionándole con @ en el muro.
          {' '}<button type="button" class="btn-texto mini" disabled={ocupado} onClick={() => dejar(null)}>Soltarme</button></span></p>
      )}
      {misAhijados.map((v) => (
        <p key={v.nuevo} class="peq pd-mio"><Avatar nombre={v.nuevo_nombre} foto={v.nuevo_foto} clase="peq" /> <span>Acompañas a <strong>{v.nuevo_nombre}</strong> hasta el {fmtCorta(v.hasta)}: échale un ojo a sus publicaciones y mándale ánimo.
          {' '}<button type="button" class="btn-texto mini" disabled={ocupado} onClick={() => dejar(v.nuevo)}>Dejarlo</button></span></p>
      ))}
      {otros.length > 0 && <p class="peq secundario">{otros.map((v) => `${v.padrino_nombre} acompaña a ${v.nuevo_nombre}`).join(' · ')}</p>}
      {puedo && (
        <div class="pila-xs">
          <p class="peq">Acaban de entrar y no tienen quien les acompañe. Llevas tiempo en el equipo: ¿les echas una mano el primer mes?</p>
          <ul class="lista">
            {x.sin_padrino.map((p) => (
              <li key={p.perfil_id} class="sc-fila">
                <Avatar nombre={p.nombre} foto={p.foto} clase="peq" />
                <span class="sc-texto">{p.nombre} <span class="mini terciario">· desde el {fmtCorta(String(p.desde).slice(0, 10))}</span></span>
                <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={() => apadrinar(p)}>Acompañarle</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- compañero de la semana (en Ranking)
export function CompaneroSemana({ cambios = 0 }) {
  const { api, aviso, perfil } = useApp();
  const coach = perfil?.rol === 'coach';
  const [vuelta, setVuelta] = useState(0);
  const d = useCarga(() => api.companeroSemana(), [vuelta, cambios]);
  const personas = usePersonas();
  const [votar, setVotar] = useState(false);
  const [ocupado, una] = useUnaVez();
  const x = d.datos;
  if (!x) return null;
  const miVoto = personas.find((p) => p.perfil_id === x.mi_voto) || null;
  const vota = (p) => una(async () => {
    try { await api.votarCompanero(p?.perfil_id || null); aviso(p ? `Tu voto va para ${p.nombre}` : 'Voto quitado'); setVotar(false); setVuelta((v) => v + 1); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <section class="panel panel-pad companero-semana pila-s" aria-labelledby="cs-t">
      <h2 id="cs-t" class="cs-t"><span aria-hidden="true">💜</span> Compañero de la semana</h2>
      {x.elegidos.length > 0 ? (
        <div class="cs-elegidos">
          {x.elegidos.map((e) => (
            <div key={e.perfil_id} class="cs-elegido">
              <Avatar nombre={e.nombre} foto={e.foto} clase="grande" />
              <strong>{e.nombre}</strong>
              <span class="mini terciario">Elegido por el equipo la semana pasada · {e.votos} {Number(e.votos) === 1 ? 'voto' : 'votos'}</span>
            </div>
          ))}
        </div>
      ) : <p class="peq secundario">La semana pasada no hubo elegido (hacen falta al menos 2 votos). El equipo vota a quien más anima o ayuda.</p>}
      {coach ? <p class="mini terciario">Esta semana {x.votos ? `ya han votado ${x.votos}` : 'aún no ha votado nadie'}. Los votos son secretos; el elegido sale el lunes.</p> : (
        <div class="fila-envolver separa">
          <span class="peq">{miVoto ? <>Esta semana votas a <strong>{miVoto.nombre}</strong></> : `Esta semana ${x.votos ? `ya han votado ${x.votos}` : 'aún no ha votado nadie'}`}</span>
          <button type="button" class={`btn btn-peq ${miVoto ? '' : 'btn-primario'}`} onClick={() => setVotar(true)}>{miVoto ? 'Cambiar' : 'Votar'}</button>
        </div>
      )}
      {votar && (
        <Hoja titulo="¿Quién ha sido tu compañero de la semana?" alCerrar={() => setVotar(false)}>
          <div class="pila">
            <p class="peq secundario">Quien más te ha animado, ayudado o acompañado esta semana. Un voto por semana (se puede cambiar hasta el domingo). Nadie ve a quién votas.</p>
            <ul class="lista sc-lista">
              {personas.map((p) => (
                <li key={p.perfil_id} class="sc-fila">
                  <Avatar nombre={p.nombre} foto={p.foto} clase="peq" />
                  <span class="sc-texto">{p.nombre}</span>
                  <button type="button" class={`btn btn-peq ${x.mi_voto === p.perfil_id ? '' : 'btn-primario'}`} disabled={ocupado || x.mi_voto === p.perfil_id} onClick={() => vota(p)}>{x.mi_voto === p.perfil_id ? 'Tu voto' : 'Votar'}</button>
                </li>
              ))}
            </ul>
            {miVoto && <button type="button" class="btn-texto mini" disabled={ocupado} onClick={() => vota(null)}>Quitar mi voto</button>}
          </div>
        </Hoja>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- quién necesita un ánimo
export function NecesitanAnimo({ cambios = 0 }) {
  const { api } = useApp();
  const lista = useCarga(() => api.sinEntrenarComunidad(), [cambios]);
  const animos = useCarga(() => api.animosComunidad().catch(() => null), [cambios]);
  const [animar, setAnimar] = useState(null);
  const [hechos, setHechos] = useState([]);
  const xs = lista.datos || [];
  if (!xs.length) return null;
  const ya = (id) => hechos.includes(id) || !!animos.datos?.mandados?.has(id);
  return (
    <section class="panel panel-pad necesitan-animo pila-s" aria-labelledby="na-t">
      <h2 id="na-t" class="na-t"><span aria-hidden="true">🙌</span> Un empujón</h2>
      <ul class="lista">
        {xs.map((x) => (
          <li key={x.perfil_id} class="sc-fila">
            <Avatar nombre={x.nombre} foto={x.foto} clase="peq" />
            <span class="sc-texto">{x.nombre} <span class="mini na-dias">{x.dias} días sin entrenar</span></span>
            <button type="button" class={`btn btn-peq ${ya(x.perfil_id) ? '' : 'btn-primario'}`} disabled={ya(x.perfil_id)} onClick={() => setAnimar(x)}>{ya(x.perfil_id) ? <><Icono n="hecho" /> Animado</> : 'Mandarle ánimo'}</button>
          </li>
        ))}
      </ul>
      <p class="mini terciario">Solo salen quienes han pedido que se les mande ánimo si paran (Ajustes de la comunidad).</p>
      {animar && <HojaAnimo perfilId={animar.perfil_id} nombre={animar.nombre} prefijo="¡Te echamos de menos por aquí!" alCerrar={() => setAnimar(null)} alHecho={() => setHechos((l) => [...l, animar.perfil_id])} />}
    </section>
  );
}

// ---------------------------------------------------------------- lo mejor de la semana y «misma sesión» (en el muro)
export function LoMejorSemana({ posts = [], alAbrirPerfil = null }) {
  const { api } = useApp();
  const hoy = fechaMadrid();
  const nuevos = useCarga(() => api.nuevosComunidad().catch(() => []), []);
  const records = useMemo(() => {
    const desde = sumarDias(lunesDe(hoy), -7), hasta = sumarDias(desde, 6);
    return posts.filter((p) => p.tipo === 'entreno' && p.creado_en && fechaMadrid(new Date(p.creado_en)) >= desde && fechaMadrid(new Date(p.creado_en)) <= hasta)
      .reduce((n, p) => n + (Array.isArray(p.resumen?.ejercicios) ? p.resumen.ejercicios.filter((e) => e?.record).length : 0), 0);
  }, [posts]);
  const m = loMejorDeLaSemana(posts, hoy, { nuevos: nuevos.datos || [], records });
  if (!m) return null;
  const resumen = (p) => p.texto || p.resumen?.nombre || p.resumen?.titulo || (p.tipo === 'encuesta' ? 'Una encuesta' : 'Una publicación');
  const linea = (p, etq) => p && (
    <li class="lm-fila"><span class="lm-etq">{etq}</span> <span class="lm-que">{resumen(p).slice(0, 70)}</span> <span class="mini terciario">· {p.autor?.nombre}</span></li>
  );
  return (
    <section class="panel panel-pad lo-mejor pila-s" aria-labelledby="lm-t">
      <h2 id="lm-t" class="lm-t"><span aria-hidden="true">✨</span> Lo mejor de la semana pasada</h2>
      <ul class="lista lm-lista">
        {linea(m.aplaudida, 'La más aplaudida')}
        {m.comentada && m.comentada.id !== m.aplaudida?.id && linea(m.comentada, 'La más comentada')}
        {(m.entrenos > 0 || m.records > 0) && <li class="lm-fila"><span class="lm-etq">Entrenos</span> <span class="lm-que">{m.entrenos} compartidos{m.records ? ` · ${m.records} ${m.records === 1 ? 'récord' : 'récords'}` : ''}</span></li>}
        {m.nuevos.length > 0 && <li class="lm-fila"><span class="lm-etq">Han entrado</span> <span class="lm-que">{quienes(m.nuevos, 3)}</span></li>}
      </ul>
    </section>
  );
}

export function MismaSesionHoy({ posts = [], alCambiar = null }) {
  const { api, aviso } = useApp();
  const yo = api.uid();
  const grupos = mismaSesion(posts, fechaMadrid());
  const [ocupado, una] = useUnaVez();
  const [hechos, setHechos] = useState([]);
  if (!grupos.length) return null;
  const chocar = (g) => una(async () => {
    try {
      const mios = posts.filter((p) => g.ids.includes(p.id) && p.autor_id !== yo && p.miReaccion !== 'fuerza');
      for (const p of mios) await api.reaccionar(p.id, 'fuerza');
      setHechos((l) => [...l, g.nombre]); aviso('💪 ¡Chocados!'); await alCambiar?.();
    } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <section class="panel panel-pad misma-sesion pila-s" aria-label="Misma sesión hoy">
      {grupos.map((g) => {
        const soyYo = g.autores.includes(yo);
        const nombres = g.nombres.map((n, i) => (g.autores[i] === yo ? 'tú' : n));
        return (
          <div key={g.nombre} class="separa ms-fila">
            <p class="peq"><span aria-hidden="true">🤜🤛</span> <strong>{quienes(nombres, 3)}</strong> {soyYo ? 'habéis' : 'han'} hecho <strong>{g.nombre}</strong> hoy</p>
            <button type="button" class="btn btn-peq" disabled={ocupado || hechos.includes(g.nombre)} onClick={() => chocar(g)}>{hechos.includes(g.nombre) ? <><Icono n="hecho" /> Chocados</> : 'Chocar 💪'}</button>
          </div>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------- el álbum del equipo
export function AlbumEquipo({ Foto, cambios = 0 }) {
  const { api } = useApp();
  const fotos = useCarga(() => api.fotosAlbum(), [cambios]);
  const [abierto, setAbierto] = useState(null);
  const meses = albumPorMeses(fotos.datos || []);
  if (fotos.cargando && !fotos.datos) return <Cargando texto="Cargando el álbum" />;
  if (!meses.length) return <div class="album-vacio"><Icono n="imagen" /><p class="peq secundario">Aún no hay fotos en el muro. Las que publique el equipo irán saliendo aquí, por meses.</p></div>;
  const mes = meses.find((m) => m.mes === abierto) || meses[0];
  return (
    <div class="pila-s album">
      {meses.length > 1 && <Segmentos etiqueta="Mes" valor={mes.mes} alCambiar={(v) => setAbierto(v || meses[0].mes)} opciones={meses.slice(0, 6).map((m) => [m.mes, m.titulo.split(' ')[0]])} clase="seg-compacto" />}
      <h3 class="album-t">{mes.titulo} <span class="mini terciario">· {mes.fotos.length} {mes.fotos.length === 1 ? 'foto' : 'fotos'}</span></h3>
      <ul class="album-rejilla" aria-label={`Fotos de ${mes.titulo}`}>
        {mes.fotos.slice(0, 60).map((f) => <li key={f.ruta} class="album-foto"><Foto ruta={f.ruta} autor={f.autor} /></li>)}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- tu huella (Perfil → En el equipo)
export function Huella({ perfilId = null }) {
  const { api } = useApp();
  const h = useCarga(() => api.huellaComunidad(perfilId), [perfilId]);
  if (!h.datos) return null;
  const frases = huellaFrases(h.datos);
  if (!frases.length) return <p class="peq secundario">Tu huella en el equipo irá creciendo con cada ánimo, bienvenida, comentario o quedada.</p>;
  return (
    <div class="huella pila-xs">
      <h3 class="huella-t">{perfilId ? 'Su huella en el equipo' : 'Tu huella en el equipo'}</h3>
      <ul class="huella-lista">{frases.map((f) => <li key={f}>{f}</li>)}</ul>
    </div>
  );
}

// ---------------------------------------------------------------- los ajustes sociales (en la hoja de ajustes de la comunidad)
export function AjustesSociales({ miembro, ocupado = false, alCambiar }) {
  const { api, aviso } = useApp();
  const [v, setV] = useState({ cumple: !!miembro.cumple_equipo, ausencia: !!miembro.ver_ausencia });
  const con053 = 'cumple_equipo' in miembro;
  const cambiar = (k) => async (val) => {
    try { const r = await api.ajustesSociales({ [k]: val }); setV({ cumple: !!r.cumple_equipo, ausencia: !!r.ver_ausencia }); aviso('Guardado'); alCambiar?.(); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <>
      <Interruptor id="eq-cumple" texto="Mi cumpleaños en el equipo" valor={v.cumple} desactivado={ocupado || !con053}
        ayuda={con053 ? 'El día de tu cumpleaños (el que pusiste en Perfil → Lo tuyo) el equipo lo ve y te puede felicitar. Solo el día y el mes.' : 'Falta poner al día la base (migración 053)'}
        alCambiar={cambiar('cumple')} />
      <Interruptor id="eq-ausencia" texto="Que me manden ánimo si paro" valor={v.ausencia} desactivado={ocupado || !con053}
        ayuda={con053 ? 'Si llevas 5 días o más sin entrenar, los del equipo ven «lleva N días sin entrenar» y te pueden mandar un ánimo. Nada más: ni el porqué ni tus sesiones.' : 'Falta poner al día la base (migración 053)'}
        alCambiar={cambiar('ausencia')} />
    </>
  );
}
