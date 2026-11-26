// FBE Esencial (tanda 8, v0.249): «Tu panel: lo apagado, en tu mano». En el panel de FBE Esencial del coach (Atletas), una
// caja con cuatro pestañas:
//   · Por revisar: lo que está apagado esperando su visto bueno, con su interruptor, «Probar en una cuenta», «Ver como…» en
//     la demo y sus textos para corregir; el tope de avisos y su resumen de los lunes; y el registro, con «Deshacer».
//   · Respuestas: las del centro de respuestas, para corregirlas o añadir otras, con cuántas veces se abre cada una.
//   · El piloto: «Tal cual», la curva semana a semana, los candidatos a un programa con seguimiento, lo que ha hecho la app
//     esta semana, el repaso de seguridad del motor y la hoja de cálculo.
//   · Herramientas: Stripe frente a la app y los motivos de baja.
// Necesita la migración 103 (sin ella, lo dice). Estilos: panel-esencial.css (clases prv-*).
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Pestanas, cuando } from '../comunes.jsx';
import { hoyISO } from '../../logica/fechas.js';
import { fechaLarga } from '../../logica/esencial-alta.js';
import { CATEGORIAS, RESPUESTAS, PENDIENTES } from '../../logica/esencial-respuestas.js';
import { estadoDe, AJUSTES, textoNuevo, respuestaNueva, textoRegistro, talCualDe, curvaPiloto, candidatos, loQueHizo, csvPiloto, stripeFrenteApp, MOTIVOS_BAJA } from '../../logica/esencial-ajustes.js';
import * as datos from '../../datos/api-esencial.js';
// (v0.250, 118) la comida de quienes llevan nutrición, en recuentos
import { panelComida } from '../../logica/esencial-comida.js';

const TIPO = { texto: 'Texto', regla: 'Regla', salud: 'Salud' };
const ESTADO = { apagado: 'Apagado', probando: 'Probando en una cuenta', encendido: 'Encendido' };

export function PanelRevisar({ lista = [], abrir = null }) {
  const { backend } = useApp();
  const [pest, setPest] = useState('revisar');
  const filas = useCarga(() => datos.ajustes(backend).catch(() => null), [], { recuerdo: 'esencial-ajustes-coach' });
  const suyos = lista.filter((r) => r.modalidad === 'por_su_cuenta' && r.estado !== 'baja');
  if (filas.cargando && !filas.datos) return null;
  return (
    <details class="prv-caja" aria-labelledby="prv-t">
      <summary class="prv-cab"><Icono n="ajustes" width="20" height="20" /> <strong id="prv-t">Por revisar y el piloto</strong>
        {filas.datos && <span class="mini terciario">{`${estadoDe(filas.datos).filter((x) => x.estado === 'apagado').length} cosas apagadas`}</span>}</summary>
      {!filas.datos ? <p class="peq secundario">Para esto falta la actualización 103 en la base (la migración de la tanda 8).</p> : (
        <div class="pila">
          <Pestanas opciones={[['revisar', 'Por revisar'], ['respuestas', 'Respuestas'], ['piloto', 'El piloto'], ['comida', 'La comida'], ['herramientas', 'Herramientas']]} valor={pest} alCambiar={setPest} etiqueta="Tu panel de FBE Esencial" idBase="prv" />
          <div id="prv-panel" role="tabpanel" aria-labelledby={`prv-${pest}`} class="pila">
            {pest === 'revisar' && <PorRevisar filas={filas.datos} suyos={suyos} alCambiar={() => filas.recargar(true)} />}
            {pest === 'respuestas' && <Respuestas filas={filas.datos} alCambiar={() => filas.recargar(true)} />}
            {pest === 'piloto' && <Piloto lista={lista} abrir={abrir} />}
            {pest === 'comida' && <LaComida lista={lista} abrir={abrir} />}
            {pest === 'herramientas' && <Herramientas lista={lista} abrir={abrir} />}
          </div>
        </div>
      )}
    </details>
  );
}

// ---------- (81-85, 87, 97 y 98) Por revisar ----------
function PorRevisar({ filas, suyos, alCambiar }) {
  const { backend, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const [editar, setEditar] = useState(null);
  const [registro, setRegistro] = useState(0);
  const items = estadoDe(filas);
  const fila = (clave) => filas.find((f) => f.clave === clave) || null;
  const poner = (clave, campos, texto) => una(async () => {
    try { await datos.ponerAjuste(backend, clave, campos); aviso(texto); alCambiar(); setRegistro((n) => n + 1); } catch (e) { aviso(e.message, 'error'); }
  });
  const base = typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}`;
  return (
    <>
      <p class="peq secundario">Lo que está hecho y apagado hasta que lo veas. Enciéndelo para todos, pruébalo antes en una sola cuenta o míralo en la demo. Los textos los puedes corregir aquí mismo: la app usa tu versión.</p>
      <div class="prv-lista" role="list" aria-label="Lo apagado">
        {items.map((x) => (
          <div key={x.clave} role="listitem" class={x.estado === 'encendido' ? 'prv-item prv-item-si' : 'prv-item'}>
            <div class="prv-item-c">
              <span class="pila-xs">
                <strong class="peq">{x.titulo}</strong>
                <span class="mini terciario">{TIPO[x.tipo]} · {ESTADO[x.estado]}{x.editados ? ` · ${x.editados === 1 ? '1 texto tuyo' : `${x.editados} textos tuyos`}` : ''}</span>
              </span>
              <label class="prv-int">
                <span class="sr">{x.encendido ? `Apagar ${x.titulo}` : `Encender ${x.titulo} para todos`}</span>
                <input type="checkbox" role="switch" class="interruptor" checked={x.encendido} disabled={ocupado}
                  onChange={(e) => poner(x.clave, { encendido: e.currentTarget.checked }, e.currentTarget.checked ? `Encendido para todos: ${x.titulo}` : `Apagado: ${x.titulo}`)} />
              </label>
            </div>
            <span class="peq secundario">{x.que}</span>
            <div class="fila-envolver">
              {x.textos?.length > 0 && <button type="button" class="btn btn-peq" onClick={() => setEditar(x)}><Icono n="editar" /> Sus textos</button>}
              <a class="btn btn-peq" href={`${base}?demo=esencial&previa=1&como=${x.ver[0]}`} target="_blank" rel="noopener"><Icono n="ojo-abierto" /> Ver como en la demo</a>
              <label class="prv-prueba">
                <span class="mini terciario">Probar en</span>
                <select class="entrada prv-sel" value={fila(x.clave)?.solo_atleta || ''} disabled={ocupado} aria-label={`Probar ${x.titulo} en una sola cuenta`}
                  onChange={(e) => poner(x.clave, { solo_atleta: e.currentTarget.value || null }, e.currentTarget.value ? `Lo verá solo esa cuenta: ${x.titulo}` : `Ya no se prueba: ${x.titulo}`)}>
                  <option value="">nadie</option>
                  {suyos.map((r) => <option key={r.atleta_id} value={r.atleta_id}>{r.nombre}</option>)}
                </select>
              </label>
            </div>
            <span class="mini terciario">{`Se ve con ${x.ver[0] === 'andresm' ? 'Andrés' : x.ver[0].charAt(0).toUpperCase() + x.ver[0].slice(1)}: ${x.ver[1]}.`}</span>
          </div>
        ))}
      </div>
      <strong class="peq">Los avisos, tu lunes y el directo</strong>
      <div class="prv-lista" role="list" aria-label="Ajustes">
        {AJUSTES.map((x) => {
          const f = fila(x.clave);
          return (
            <div key={x.clave} role="listitem" class={f?.encendido ? 'prv-item prv-item-si' : 'prv-item'}>
              <div class="prv-item-c">
                <span class="pila-xs"><strong class="peq">{x.numero ? x.titulo.replace('N', String(f?.valor ?? x.numero[2])) : x.titulo}</strong><span class="peq secundario">{x.que}</span></span>
                <label class="prv-int">
                  <span class="sr">{f?.encendido ? `Apagar ${x.titulo}` : `Encender ${x.titulo}`}</span>
                  <input type="checkbox" role="switch" class="interruptor" checked={!!f?.encendido} disabled={ocupado}
                    onChange={(e) => poner(x.clave, { encendido: e.currentTarget.checked, ...(x.numero && f?.valor == null ? { valor: x.numero[2] } : {}) }, e.currentTarget.checked ? 'Encendido' : 'Apagado')} />
                </label>
              </div>
              {x.numero && (
                <label class="prv-prueba">
                  <span class="mini terciario">Como mucho</span>
                  <input class="entrada num prv-num" type="number" min={x.numero[0]} max={x.numero[1]} value={f?.valor ?? x.numero[2]} disabled={ocupado} aria-label="Avisos a la semana, como mucho"
                    onChange={(e) => { const v = Math.min(x.numero[1], Math.max(x.numero[0], Number(e.currentTarget.value) || x.numero[2])); poner(x.clave, { valor: v }, `Como mucho ${v} a la semana`); }} />
                  <span class="mini terciario">a la semana</span>
                </label>
              )}
            </div>
          );
        })}
      </div>
      <Registro vuelta={registro} alCambiar={alCambiar} />
      {editar && <HojaTextos item={editar} filas={filas} alCerrar={() => setEditar(null)} alCambiar={() => { alCambiar(); setRegistro((n) => n + 1); }} />}
    </>
  );
}

// (82 y 85) Sus textos: cada uno con el de la app debajo; lo que deja igual que el de la app no se guarda
function HojaTextos({ item, filas, alCerrar, alCambiar }) {
  const { backend, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const suyo = (t) => filas.find((f) => f.clave === t.clave)?.texto || {};
  const [valores, setValores] = useState(() => Object.fromEntries(item.textos.map((t) => [t.clave, Object.fromEntries(Object.entries(t.campos).map(([k, v]) => [k, suyo(t)[k] || v]))])));
  const guardar = (t) => una(async () => {
    const nuevo = textoNuevo(t.campos, valores[t.clave]);
    if (nuevo?.error) { aviso(nuevo.error, 'error'); return; }
    try {
      if (nuevo) await datos.ponerAjuste(backend, t.clave, { texto: nuevo });
      else await datos.quitarAjuste(backend, t.clave);
      aviso(nuevo ? `Guardado: ${t.nombre}` : `Como el de la app: ${t.nombre}`); alCambiar();
    } catch (e) { aviso(e.message, 'error'); }
  });
  const original = (t) => { setValores({ ...valores, [t.clave]: { ...t.campos } }); };
  return (
    <Hoja titulo={item.titulo} alCerrar={alCerrar}>
      <div class="pila prv-textos">
        <p class="peq secundario">Lo que guardes es lo que verán (en cuanto lo enciendas). Si lo dejas como el de la app, se queda el de la app.</p>
        {item.textos.length > 1 && <p class="peq" id="prv-textos-n">{`Escritos por ti: ${item.textos.filter((t) => Object.keys(suyo(t)).length).length} de ${item.textos.length}. Los demás llevan el de la app.`}</p>}
        {item.textos.map((t) => (
          <section key={t.clave} class="prv-texto" aria-label={t.nombre}>
            <strong class="peq">{t.nombre} <span class="mini terciario">· {Object.keys(suyo(t)).length ? 'el tuyo' : 'el de la app'}</span></strong>
            {Object.keys(t.campos).map((k) => (
              <label key={k} class="pila-xs">
                <span class="mini terciario">{{ q: 'Pregunta', r: 'Respuesta', titulo: 'Título', texto: 'Texto' }[k] || k}</span>
                <textarea class="prv-area" rows={k === 'q' || k === 'titulo' ? 2 : 4} value={valores[t.clave][k]} maxLength={1500}
                  onInput={(e) => setValores({ ...valores, [t.clave]: { ...valores[t.clave], [k]: e.currentTarget.value } })} />
              </label>
            ))}
            <div class="fila-envolver">
              <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={() => guardar(t)}><Icono n="guardar" /> Guardar</button>
              <button type="button" class="btn btn-peq" onClick={() => original(t)}><Icono n="reiniciar" /> El de la app</button>
            </div>
          </section>
        ))}
      </div>
    </Hoja>
  );
}

// (87) Lo que has cambiado, con «Deshacer»
function Registro({ vuelta, alCambiar }) {
  const { backend, aviso } = useApp();
  const r = useCarga(() => datos.registroAjustes(backend).catch(() => null), [vuelta]);
  const [ocupado, una] = useUnaVez();
  const filas = (r.datos || []).slice(0, 15);
  if (!filas.length) return null;
  const deshacer = (f) => una(async () => {
    try { await datos.deshacerAjuste(backend, f); aviso('Deshecho'); alCambiar(); r.recargar(true); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <section class="pila-s" aria-labelledby="prv-reg-t">
      <strong id="prv-reg-t" class="peq">Lo que has cambiado</strong>
      <div class="prv-lista" role="list">
        {filas.map((f, i) => (
          <div key={f.id} role="listitem" class="prv-reg">
            <span class="peq">{textoRegistro(f)} <span class="mini terciario">· {cuando(f.en)}</span></span>
            {i === 0 && <button type="button" class="btn-texto mini" disabled={ocupado} onClick={() => deshacer(f)}><Icono n="deshacer" /> Deshacer</button>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- (86 y 94) Respuestas: corregirlas, añadir otras y cuántas veces se abre cada una ----------
function Respuestas({ filas, alCambiar }) {
  const { backend, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const cons = useCarga(() => datos.consultas(backend).catch(() => null), []);
  const [editar, setEditar] = useState(null);
  const [nueva, setNueva] = useState({ cat: 'antes', q: '', r: '' });
  const n = new Map((cons.datos || []).map((x) => [x.clave, x.n]));
  const suyas = filas.filter((f) => /^respuesta_nueva:/.test(f.clave));
  const todas = [...RESPUESTAS, ...PENDIENTES.map((x) => ({ ...x, pendiente: true }))];
  const anadir = () => una(async () => {
    const r = respuestaNueva(nueva, suyas.map((f) => f.clave.split(':')[1]));
    if (r.error) { aviso(r.error, 'error'); return; }
    try { await datos.ponerAjuste(backend, r.clave, { texto: r.texto }); aviso('Añadida: ya sale en el centro de respuestas'); setNueva({ ...nueva, q: '', r: '' }); alCambiar(); } catch (e) { aviso(e.message, 'error'); }
  });
  const quitar = (clave) => una(async () => { try { await datos.quitarAjuste(backend, clave); aviso('Quitada'); alCambiar(); } catch (e) { aviso(e.message, 'error'); } });
  const masVistas = [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <>
      {cons.datos && <p class="peq secundario">{masVistas.length ? `Lo que más se abre en las ocho últimas semanas: ${masVistas.map(([c, k]) => `«${(todas.find((x) => x.id === c) || {}).q || c}» (${k})`).join(', ')}.` : 'Aún nadie ha abierto ninguna respuesta.'} Solo el recuento: nunca quién.</p>}
      {CATEGORIAS.map(([cat, nombre]) => (
        <details key={cat} class="prv-cat">
          <summary class="peq"><strong>{nombre}</strong> <span class="mini terciario">({todas.filter((x) => x.cat === cat).length})</span></summary>
          <div class="prv-lista" role="list">
            {todas.filter((x) => x.cat === cat).map((x) => {
              const f = filas.find((y) => y.clave === `respuesta:${x.id}`);
              return (
                <div key={x.id} role="listitem" class="prv-reg">
                  <span class="peq">{f?.texto?.q || x.q}{x.pendiente ? <span class="mini terciario"> · de salud, apagada</span> : null}{f ? <span class="mini terciario"> · con tu texto</span> : null}{n.get(x.id) ? <span class="mini terciario num"> · {n.get(x.id)} veces</span> : null}</span>
                  <button type="button" class="btn-texto mini" onClick={() => setEditar({ titulo: x.q, textos: [{ clave: `respuesta:${x.id}`, nombre: x.q, campos: { q: x.q, r: x.r } }] })}><Icono n="editar" /> Corregir</button>
                </div>
              );
            })}
          </div>
        </details>
      ))}
      <section class="prv-texto" aria-labelledby="prv-nueva-t">
        <strong id="prv-nueva-t" class="peq">Añadir una respuesta</strong>
        <label class="pila-xs"><span class="mini terciario">Tema</span>
          <select class="entrada" value={nueva.cat} onChange={(e) => setNueva({ ...nueva, cat: e.currentTarget.value })}>{CATEGORIAS.map(([c, nombre]) => <option key={c} value={c}>{nombre}</option>)}</select></label>
        <label class="pila-xs"><span class="mini terciario">Pregunta</span><textarea class="prv-area" rows={2} maxLength={140} value={nueva.q} onInput={(e) => setNueva({ ...nueva, q: e.currentTarget.value })} /></label>
        <label class="pila-xs"><span class="mini terciario">Respuesta</span><textarea class="prv-area" rows={4} maxLength={1500} value={nueva.r} onInput={(e) => setNueva({ ...nueva, r: e.currentTarget.value })} /></label>
        <button type="button" class="btn btn-peq btn-primario" style="justify-self:start" disabled={ocupado} onClick={anadir}><Icono n="mas" /> Añadirla</button>
      </section>
      {suyas.length > 0 && (
        <section class="pila-s" aria-label="Las que has añadido">
          <strong class="peq">Las que has añadido</strong>
          <div class="prv-lista" role="list">
            {suyas.map((f) => <div key={f.clave} role="listitem" class="prv-reg"><span class="peq">{f.texto?.q}</span><button type="button" class="btn-texto mini" disabled={ocupado} onClick={() => quitar(f.clave)}><Icono n="basura" /> Quitar</button></div>)}
          </div>
        </section>
      )}
      {editar && <HojaTextos item={editar} filas={filas} alCerrar={() => setEditar(null)} alCambiar={alCambiar} />}
    </>
  );
}

// ---------- (88, 89, 93, 95, 96 y 99) El piloto ----------
function Piloto({ lista, abrir }) {
  const { backend, aviso } = useApp();
  const hoy = hoyISO();
  const sp = useCarga(() => datos.semanasPiloto(backend).catch(() => null), [], { recuerdo: 'esencial-semanas-piloto' });
  const hab = useCarga(() => datos.hablaron(backend).catch(() => []), []);
  const viajes = useCarga(() => backend.select('esencial_notas', { eq: { tipo: 'viaje' } }).catch(() => []), []);
  const [repaso, setRepaso] = useState(null);
  const [ocupado, una] = useUnaVez();
  const nombres = new Map(lista.map((r) => [r.atleta_id, r.nombre]));
  if (sp.cargando && !sp.datos) return <p class="peq secundario" role="status">Sumando las semanas…</p>;
  if (!sp.datos) return <p class="peq secundario">Para esto falta la actualización 103 en la base.</p>;
  const tc = talCualDe(sp.datos, hoy), cu = curvaPiloto(sp.datos, hoy), ca = candidatos(sp.datos, hoy, hab.datos || []), hizo = loQueHizo(sp.datos, hoy, viajes.datos || []);
  const hacerRepaso = () => una(async () => {
    try {
      const [{ repasoSeguridad, fueraDeRegla }, copia] = await Promise.all([import('../../logica/motor/seguridad.js'), datos.copiaEsencial(backend)]);
      const c = repasoSeguridad(copia, { porSuCuenta: true });
      setRepaso({ semanas: c.semanas, filas: c.filas, fuera: fueraDeRegla(c), preguntas: c.preguntas, ejemplos: [...c.masDeUnSalto, ...c.bajoSuelo, ...c.atascadoDosSemanas].slice(0, 5) });
    } catch (e) { aviso(e.message, 'error'); }
  });
  const descargar = () => {
    const csv = csvPiloto(sp.datos, nombres);
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `fbe-esencial-piloto-${hoy}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <>
      <section class="pila-s" aria-labelledby="prv-tc-t">
        <strong id="prv-tc-t" class="peq">«Tal cual»: semanas hechas como las propuso la app</strong>
        <p class="peq secundario">{tc.semanas ? `${tc.talCual} de ${tc.semanas} semanas terminadas (${tc.pct} %): hechas enteras, sin cambiar un ejercicio en la sesión y sin repetirlas ni pausarlas.` : 'Aún no hay semanas terminadas.'}</p>
        {tc.lista.length > 0 && (
          <div class="prv-lista" role="list">
            {tc.lista.map((a) => (
              <div key={a.atleta_id} role="listitem" class="prv-reg">
                <span class="peq">{abrir ? <button type="button" class="btn-texto peq" onClick={() => abrir(a.atleta_id)}>{nombres.get(a.atleta_id) || 'Sin nombre'}</button> : nombres.get(a.atleta_id)}</span>
                <span class="mini terciario num">{`${a.talCual} de ${a.semanas} tal cual${a.cambios ? ` · ${a.cambios} con cambios` : ''}${a.repite ? ` · repitió ${a.repite}` : ''}${a.pausa ? ` · ${a.pausa} en pausa` : ''}${a.incompletas ? ` · ${a.incompletas} a medias` : ''}`}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section class="pila-s" aria-labelledby="prv-cu-t">
        <strong id="prv-cu-t" class="peq">La curva: cuántos entrenan cada semana de su plan</strong>
        {cu.puntos.length ? (
          <div class="prv-curva" role="list">
            {cu.puntos.map((p) => (
              <div key={p.n} role="listitem" class="prv-barra-f">
                <span class="mini num">Semana {p.n}</span>
                <span class="prv-barra" aria-hidden="true"><span class={p.pct >= cu.liston ? 'prv-barra-v prv-barra-ok' : 'prv-barra-v'} style={`inline-size:${p.pct}%`} /></span>
                <span class="mini num">{`${p.entrenaron} de ${p.total} (${p.pct} %)`}</span>
              </div>
            ))}
            <span class="mini terciario">{`El listón para abrirlo a todos: que sigan ${cu.liston} de cada 100.`}</span>
          </div>
        ) : <p class="peq secundario">Aún no ha terminado ninguna semana.</p>}
      </section>
      <section class="pila-s" aria-labelledby="prv-hizo-t">
        <strong id="prv-hizo-t" class="peq">Lo que ha hecho la app esta semana</strong>
        <p class="peq secundario">{`Semanas en marcha: ${hizo.preparadas}${hizo.preparadas ? (hizo.subidas ? `; en ${hizo.conSubidas === 1 ? 'una' : hizo.conSubidas} sube la carga de algún ejercicio (${hizo.subidas === 1 ? 'una subida' : `${hizo.subidas} subidas`})` : ', sin subidas de carga') : ''}. En pausa: ${hizo.pausas}. Repiten la semana: ${hizo.repiten}. Se les pasó sola: ${hizo.pasoSolo}. De viaje: ${hizo.viajes}.`}</p>
      </section>
      <section class="pila-s" aria-labelledby="prv-ca-t">
        <strong id="prv-ca-t" class="peq">Candidatos a un programa con seguimiento</strong>
        {ca.length ? (
          <div class="prv-lista" role="list">
            {ca.map((c) => <div key={c.atleta_id} role="listitem" class="prv-reg"><span class="peq">{abrir ? <button type="button" class="btn-texto peq" onClick={() => abrir(c.atleta_id)}>{nombres.get(c.atleta_id) || 'Sin nombre'}</button> : nombres.get(c.atleta_id)}</span><span class="mini terciario">{c.motivo}</span></div>)}
          </div>
        ) : <p class="peq secundario">Nadie todavía: sale quien lleva ocho semanas seguidas con todo hecho o ha mirado los programas desde «Cuando la app no basta».</p>}
      </section>
      <section class="pila-s" aria-labelledby="prv-rep-t">
        <strong id="prv-rep-t" class="peq">Repaso de seguridad del motor</strong>
        <p class="peq secundario">Recorre cada semana que ha preparado la app y compara cada serie propuesta con lo que hizo el atleta. Lo que importa tiene que salir a cero. Se hace aquí, en tu navegador: no sale ningún dato.</p>
        {repaso ? (
          <p class={repaso.fuera ? 'peq prv-aviso' : 'peq prv-ok'} role="status">{`${repaso.filas} propuestas en ${repaso.semanas} semanas: ${repaso.fuera === 0 ? 'ninguna fuera de regla' : `${repaso.fuera} fuera de regla`}.`}{repaso.preguntas ? ` ${repaso.preguntas} esperan a que el atleta confirme una posible errata.` : ''}</p>
        ) : <button type="button" class="btn btn-peq" style="justify-self:start" disabled={ocupado} onClick={hacerRepaso}><Icono n="escudo" /> Hacer el repaso</button>}
        {repaso?.ejemplos?.length > 0 && <ul class="peq">{repaso.ejemplos.map((e, i) => <li key={i}>{`${e.atleta}, ${e.ejercicio}, serie ${e.serie}: hizo ${e.hizo}, propone ${e.propone}`}</li>)}</ul>}
      </section>
      <section class="pila-s" aria-labelledby="prv-csv-t">
        <strong id="prv-csv-t" class="peq">La hoja de cálculo del piloto</strong>
        <p class="peq secundario">Una fila por atleta y semana (sesiones, hechas, ejercicios cambiados, subidas, cómo la cerró y si fue tal cual). Se abre con Excel o con Google Sheets.</p>
        <button type="button" class="btn btn-peq" style="justify-self:start" disabled={!sp.datos.length} onClick={descargar}><Icono n="descargar" /> Descargar la hoja</button>
      </section>
    </>
  );
}

// ---------- (91 y 92) Herramientas: Stripe frente a la app y los motivos de baja ----------
// (v0.250, 118) La comida: quién no se pesa, quién no apunta y cuántos ajustes ha hecho la app (solo recuentos)
function LaComida({ lista, abrir }) {
  const { backend } = useApp();
  const d = useCarga(() => datos.comidaPanel(backend).catch(() => null), []);
  if (d.cargando && !d.datos) return <p class="peq secundario" role="status">Mirando la comida…</p>;
  if (d.datos === null) return <p class="peq secundario">Para esto falta la actualización 104 en la base (la migración de la tanda 9).</p>;
  const nombres = Object.fromEntries(lista.map((r) => [r.atleta_id, r.nombre]));
  const x = panelComida(d.datos, nombres);
  if (!x) return <p class="peq secundario">Nadie de FBE Esencial lleva nutrición todavía.</p>;
  const ids = Object.fromEntries(lista.map((r) => [r.nombre, r.atleta_id]));
  const Nombres = ({ xs }) => (xs.length ? xs.map((n, i) => <span key={n}>{i ? ', ' : ''}<button type="button" class="btn-texto peq" onClick={() => abrir?.(ids[n])}>{n}</button></span>) : 'nadie');
  return (
    <section class="pila-s" aria-labelledby="prv-com-t">
      <strong id="prv-com-t" class="peq">La comida de FBE Esencial</strong>
      <div class="prv-com-cifras" role="list">
        {[[x.total, 'con nutrición'], [x.conPlan, 'con su plan de comida'], [x.ajustes7, 'ajustes de la app esta semana'], [x.ajustes, 'ajustes en total']].map(([n, t]) => (
          <div role="listitem" class="prv-com-cifra" key={t}><strong class="num">{n}</strong><span class="mini terciario">{t}</span></div>
        ))}
      </div>
      {x.sinPlan.length > 0 && <p class="peq"><strong>Sin plan de comida todavía: </strong><Nombres xs={x.sinPlan} /></p>}
      <p class="peq"><strong>Sin pesarse en dos semanas: </strong><Nombres xs={x.sinPesar} /></p>
      <p class="peq"><strong>Sin apuntar la comida en una semana: </strong><Nombres xs={x.sinApuntar} /></p>
      <p class="mini terciario">Solo recuentos: ni pesos ni lo que come cada uno. Quien tiene antecedente de TCA no sale en «sin pesarse».</p>
    </section>
  );
}

function Herramientas({ lista, abrir }) {
  const { backend } = useApp();
  const [texto, setTexto] = useState('');
  const [res, setRes] = useState(null);
  const at = useCarga(() => backend.select('atletas', { eq: { modalidad: 'por_su_cuenta' }, cols: 'id,nombre,email,estado' }).catch(() => []), []);
  const bajas = useCarga(() => datos.bajas(backend).catch(() => null), []);
  const comparar = () => setRes(stripeFrenteApp(texto, at.datos || []));
  const cuenta = new Map();
  for (const b of bajas.datos || []) cuenta.set(b.motivo, (cuenta.get(b.motivo) || 0) + 1);
  const L = ({ titulo, xs }) => (xs.length ? <div class="pila-xs"><strong class="peq">{`${titulo} (${xs.length})`}</strong><span class="peq secundario">{xs.map((x) => (x.nombre ? `${x.nombre} (${x.email})` : x.email) + (x.motivo ? `: ${x.motivo}` : '')).join(' · ')}</span></div> : null);
  return (
    <>
      <section class="pila-s" aria-labelledby="prv-st-t">
        <strong id="prv-st-t" class="peq">Stripe frente a la app</strong>
        <p class="peq secundario">Pega la lista de suscripciones de FBE Esencial (cópiala de Stripe o abre su CSV y copia las filas). La app mira cada correo y su estado.</p>
        <textarea class="prv-area" rows={5} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="ana@correo.com · active" aria-label="La lista de Stripe" />
        <button type="button" class="btn btn-peq" style="justify-self:start" disabled={!texto.trim()} onClick={comparar}><Icono n="buscar" /> Comparar</button>
        {res && (
          <div class="pila-s" role="status">
            <span class="peq">{`${res.leidas} suscripciones leídas.`}{!res.sinAcceso.length && !res.deBajaYDentro.length && !res.impagados.length ? ' Todo cuadra.' : ''}</span>
            <L titulo="Han pagado o reservado y no tienen acceso" xs={res.sinAcceso} />
            <L titulo="De baja en Stripe y activos en la app" xs={res.deBajaYDentro} />
            <L titulo="Con el cobro pendiente" xs={res.impagados} />
            <L titulo="En la app y no en esta lista" xs={res.sinStripe} />
          </div>
        )}
      </section>
      <section class="pila-s" aria-labelledby="prv-bj-t">
        <strong id="prv-bj-t" class="peq">«¿Por qué te vas?»</strong>
        {bajas.datos == null ? <p class="peq secundario">Para esto falta la actualización 103 en la base.</p>
          : !bajas.datos.length ? <p class="peq secundario">Nadie ha contestado todavía. Se lo preguntamos al tocar «Tu suscripción» para darse de baja (es opcional).</p> : (
            <>
              <p class="peq secundario">{MOTIVOS_BAJA.filter(([k]) => cuenta.get(k)).map(([k, t]) => `${t}: ${cuenta.get(k)}`).join(' · ')}</p>
              <div class="prv-lista" role="list">
                {bajas.datos.slice(0, 10).map((b) => (
                  <div key={b.id} role="listitem" class="prv-reg">
                    <span class="peq">{abrir ? <button type="button" class="btn-texto peq" onClick={() => abrir(b.atleta_id)}>{b.nombre}</button> : b.nombre} <span class="mini terciario">· {fechaLarga(String(b.creada_en).slice(0, 10))}</span></span>
                    <span class="mini terciario">{(MOTIVOS_BAJA.find(([k]) => k === b.motivo) || [])[1]}{b.texto ? `: «${b.texto}»` : ''}</span>
                  </div>
                ))}
              </div>
            </>
          )}
      </section>
    </>
  );
}
