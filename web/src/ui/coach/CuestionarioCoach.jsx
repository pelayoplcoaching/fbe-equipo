// Coach: el cuestionario inicial del atleta (en Datos) y su check-in a medida (en Seguimiento)
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, Segmentos, Grafica } from '../comunes.jsx';
import { OBJETIVOS, EXPERIENCIA, LUGARES, MATERIAL, SINTOMAS, OTRAS, ZONAS_LESION, LIMITA, RESULTADO_COACH, nombre, resumenCuestionario, conSalud, objetivosDe, textoObjetivos } from '../../logica/cuestionario.js';
import { APARTADOS_CHECKIN, TIPOS_PREGUNTA, serieRespuestas } from '../../logica/preguntas.js';
import { fechaCuando, pendiente } from '../atleta/Cuestionario.jsx';

const lista = (opciones, valores) => (valores || []).map((v) => nombre(opciones, v));
// «Barra y discos, banco, mancuernas»
const enLinea = (xs) => xs.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x)).join(', ');
const primero = (nombreCompleto) => String(nombreCompleto || '').split(' ')[0];

export function CuestionarioCoach({ atleta, alCambiar }) {
  const { api, aviso } = useApp();
  const c = useCarga(() => api.cuestionario(atleta.id).catch(() => null), [atleta.id]);
  const d = c.datos;
  const hecho = !!d?.completado_en;
  // Empezado sin enviar: lo que ya ha guardado se ve (lo de salud, sobre todo)
  const empezado = !hecho && !!d && (conSalud(d) || !!d.objetivo || !!d.lugar);
  const puedePedir = !!atleta.perfil_id && atleta.estado === 'activo';
  const [pidiendo, setPidiendo] = useState(false);

  async function pedir() {
    setPidiendo(true);
    try {
      await api.pedirCuestionario(atleta.id);
      aviso(hecho ? `Le has pedido a ${primero(atleta.nombre)} que lo actualice` : `Le has pedido el cuestionario a ${primero(atleta.nombre)}`);
      c.recargar(true);
    } catch (e) { aviso(e.message, 'error'); } finally { setPidiendo(false); }
  }
  async function revisar() {
    try { await api.revisarCuestionario(d.id); aviso('Cuestionario revisado'); c.recargar(true); alCambiar?.(); } catch (e) { aviso(e.message, 'error'); }
  }

  let estado = 'Aún no lo ha rellenado.';
  if (!hecho && d?.pedido_en) estado = `Se lo pediste ${fechaCuando(d.pedido_en)}. Aún no lo ha rellenado.`;
  if (empezado) estado = `Lo ha empezado y aún no lo ha enviado (lo último, ${fechaCuando(d.actualizado_en)}).`;
  if (hecho) estado = `Enviado ${fechaCuando(d.completado_en)}${pendiente(d) ? `. Le pediste que lo actualice ${fechaCuando(d.pedido_en)}` : ''}.`;
  if (!atleta.perfil_id) estado = 'Lo podrá rellenar cuando active su cuenta.';

  return (
    <section class="panel cuestionario-coach" aria-labelledby="cu-coach">
      <div class="panel-pad pila-s">
        <div class="separa separa-envolver">
          <div><h2 id="cu-coach" class="h-panel">Cuestionario inicial</h2><div class="peq terciario">{c.cargando && !d ? 'Cargando…' : estado}</div></div>
          <div class="fila-envolver">
            {(hecho || d?.resultado) && !d.revisado_en && <button class="btn btn-peq btn-primario" onClick={revisar}><Icono n="hecho" /> Marcar revisado</button>}
            {puedePedir && <button class="btn btn-peq" disabled={pidiendo} onClick={pedir}><Icono n="enviar" /> {pendiente(d) ? 'Recordárselo' : hecho ? 'Pedir que lo actualice' : 'Pedírselo'}</button>}
          </div>
        </div>
        {(hecho || empezado) && (
          <div class="fila-envolver">
            {d.resultado ? <span class={`chip ${RESULTADO_COACH[d.resultado][1]}`}>{d.resultado !== 'sin_valoracion' && <Icono n="alerta" />}{RESULTADO_COACH[d.resultado][0]}</span>
              : <span class="chip">Sin responder lo de salud</span>}
            {d.revisado_en ? <span class="chip ok"><Icono n="hecho" />Revisado</span> : <span class="chip morado">Por revisar</span>}
          </div>
        )}
      </div>
      {(hecho || empezado) && <DatosCuestionario d={d} />}
    </section>
  );
}

// Datos: lo que tiene puesto este atleta en la app. Menos es más: cada función que no uses con él es una
// pantalla menos que tiene que entender.
export function LoQueUsa({ atleta }) {
  const { api } = useApp();
  const f = useCarga(() => api.funcionesAtleta(atleta.id).catch(() => null), [atleta.id]);
  const d = f.datos;
  if (!d) return null;
  const filas = [
    ['Cuestionario inicial', d.cuestionario === 'hecho' ? 'Hecho' : d.cuestionario === 'pedido' ? 'Pedido, sin rellenar' : 'Sin pedir', 'datos'],
    ['Hábitos diarios', d.habitos ? `${d.habitos} ${d.habitos === 1 ? 'activo' : 'activos'}` : 'Ninguno', 'seguimiento'],
    ['Plan de nutrición', atleta.nutricion === false ? 'No se la llevas (no la ve)' : d.nutricion ? ({ macros: 'Kcal y macros', kcal_proteina: 'Kcal y proteína', sin_contar: 'Sin contar' })[d.nutricion] : 'Sin plan', 'nutricion'],
    ['Check-in', `${d.apartados ? `${d.apartados.length} de ${APARTADOS_CHECKIN.length} apartados` : 'Todos los apartados'}${d.preguntas ? ` y ${d.preguntas} ${d.preguntas === 1 ? 'pregunta tuya' : 'preguntas tuyas'}` : ''}`, 'seguimiento'],
  ];
  const carga = (d.habitos > 3 ? 1 : 0) + (atleta.nutricion !== false && d.nutricion && d.nutricion !== 'sin_contar' ? 1 : 0) + (d.preguntas > 3 ? 1 : 0) + (!d.apartados ? 1 : 0);
  return (
    <section class="panel" aria-labelledby="lo-que-usa">
      <div class="panel-pad pila-xs">
        <h2 id="lo-que-usa" class="h-panel">Lo que le pide la app cada día</h2>
        <span class="peq terciario">{carga >= 3 ? 'Es bastante: si acaba de empezar, quizá sobra algo. Lo que no uses con este atleta, no se lo pongas.' : 'Lo justo: lo que no uses con este atleta, no se lo pongas.'}</span>
      </div>
      <dl class="datos-cuest" style="border-top:1px solid var(--linea)">
        {filas.map(([t, v]) => <div key={t}><dt>{t}</dt><dd>{v}</dd></div>)}
      </dl>
    </section>
  );
}

// Programa: lo que importa para programarle, de un vistazo (tiempo, material, lesiones que limitan y la recomendación)
export function ParaProgramar({ atleta }) {
  const { api } = useApp();
  const c = useCarga(() => api.cuestionario(atleta.id).catch(() => null), [atleta.id]);
  const d = c.datos;
  if (!d?.completado_en && !d?.resultado) return null;
  const lesiones = (d.lesiones || []).filter((l) => l.limita > 0);
  const material = d.material?.length ? enLinea(lista(MATERIAL, d.material)).toLowerCase() : null;
  return (
    <div class="nota para-programar" role="note" aria-label="Del cuestionario inicial">
      <Icono n="diana" />
      <div class="pila-xs">
        <span><strong>{resumenCuestionario(d) || 'Cuestionario inicial'}</strong>{material ? `. Material: ${material}` : ''}{d.experiencia ? `. Experiencia: ${nombre(EXPERIENCIA, d.experiencia).toLowerCase()}` : ''}.</span>
        {lesiones.length > 0 && <span>Le limita: {lesiones.map((l) => `${nombre(ZONAS_LESION, l.zona).toLowerCase()} (${l.limita === 2 ? 'mucho' : 'algo'})`).join(', ')}.</span>}
        {d.resultado && d.resultado !== 'sin_valoracion' && <span class="texto-aviso">{RESULTADO_COACH[d.resultado][0]}.</span>}
      </div>
    </div>
  );
}

function DatosCuestionario({ d }) {
  const filas = [
    [objetivosDe(d).length > 1 ? 'Objetivos' : 'Objetivo', textoObjetivos(d) || null, objetivosDe(d).length > 1 ? `Principal: ${nombre(OBJETIVOS, objetivosDe(d)[0]).toLowerCase()}${d.objetivo_detalle ? `. ${d.objetivo_detalle}` : ''}` : d.objetivo_detalle],
    ['Experiencia en fuerza', d.experiencia && nombre(EXPERIENCIA, d.experiencia)],
    ['Disponibilidad', d.dias_semana && `${d.dias_semana} ${d.dias_semana === 1 ? 'día' : 'días'} a la semana${d.minutos_sesion ? `, ${d.minutos_sesion} min por sesión` : ''}`],
    ['Dónde entrena', d.lugar && nombre(LUGARES, d.lugar)],
    ['Material', d.material?.length ? enLinea(lista(MATERIAL, d.material)) : 'Nada en especial'],
    ['Otros deportes', d.otros_deportes],
  ];
  const salud = d.activo != null ? [
    ['Ejercicio regular (3 meses o más)', d.activo ? 'Sí' : 'No'],
    ['Enfermedad cardiovascular, metabólica o renal', d.enfermedad ? `Sí${d.enfermedad_detalle ? `: ${d.enfermedad_detalle}` : ''}` : 'No', null, d.enfermedad],
    ['Signos o síntomas', d.sintomas?.length ? lista(SINTOMAS, d.sintomas).join('. ') : 'Ninguno', null, d.sintomas?.length > 0],
    ['Además', d.otras?.length ? lista(OTRAS, d.otras).join('. ') : 'Nada', d.otras?.includes('medicacion') && d.medicacion_detalle ? `Medicación: ${d.medicacion_detalle}` : null, d.otras?.length > 0],
  ] : [];
  const lesiones = d.lesiones || [];
  return (
    <div class="datos-cuest">
      <dl>
        {filas.filter(([, v]) => v).map(([t, v, extra]) => (
          <div key={t}><dt>{t}</dt><dd>{v}{extra && <span class="cita-corta">«{extra}»</span>}</dd></div>
        ))}
      </dl>
      {salud.length > 0 && (
        <>
          <h3>Salud</h3>
          <dl>
            {salud.map(([t, v, extra, marca]) => (
              <div key={t} class={marca ? 'marcado' : ''}><dt>{t}</dt><dd>{v}{extra && <span class="cita-corta">{extra}</span>}</dd></div>
            ))}
          </dl>
        </>
      )}
      {(d.lesiones != null || d.alergias) && (
        <>
          <h3>Lesiones y alergias</h3>
          <dl>
            <div><dt>Lesiones o molestias</dt><dd>{lesiones.length ? (
              <ul class="lista-lesiones">{lesiones.map((l, i) => <li key={i}><strong>{nombre(ZONAS_LESION, l.zona)}</strong>: {LIMITA[l.limita].toLowerCase()}{l.nota ? `. ${l.nota}` : ''}</li>)}</ul>
            ) : 'Ninguna'}</dd></div>
            <div><dt>Alergias o intolerancias</dt><dd>{d.alergias || 'Ninguna'}</dd></div>
          </dl>
        </>
      )}
    </div>
  );
}

// Seguimiento: qué apartados le pregunta cada semana, sus preguntas propias y la evolución de las respuestas
export function CheckinAMedida({ atleta, preguntas, checkins, recargarFicha }) {
  const { api, aviso } = useApp();
  const [apartados, setApartados] = useState(atleta.checkin_apartados ?? null);
  const [editar, setEditar] = useState(null);
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [quitando, setQuitando] = useState(null);
  const todas = preguntas.datos || [];
  const activas = todas.filter((p) => p.activa !== false);
  const archivadas = todas.filter((p) => p.activa === false);
  const marcado = (k) => apartados == null || apartados.includes(k);
  const claves = APARTADOS_CHECKIN.map(([k]) => k);

  async function alternar(k) {
    const actual = apartados == null ? claves : apartados;
    const nueva = actual.includes(k) ? actual.filter((x) => x !== k) : [...actual, k];
    const previo = apartados;
    setApartados(nueva.length === claves.length ? null : claves.filter((x) => nueva.includes(x)));
    try { await api.guardarApartadosCheckin(atleta.id, nueva); recargarFicha?.(); } catch (e) { setApartados(previo); aviso(e.message, 'error'); }
  }
  async function quitar(p) {
    if (p.atleta_id == null && quitando !== p.id) { setQuitando(p.id); return; }
    setQuitando(null);
    try {
      const r = await api.quitarPregunta(p.id);
      aviso(r.archivado ? 'Pregunta archivada: lo que ya ha respondido se conserva' : 'Pregunta quitada');
      preguntas.recargar(true);
    } catch (e) { aviso(e.message, 'error'); }
  }
  async function recuperar(p) {
    try { await api.recuperarPregunta(p.id); aviso('Pregunta recuperada'); preguntas.recargar(true); } catch (e) { aviso(e.message, 'error'); }
  }
  const conGrafica = activas.filter((p) => p.tipo === 'escala' || p.tipo === 'numero').map((p) => [p, serieRespuestas(checkins, p)]).filter(([, s]) => s.length >= 2);

  return (
    <section class="seccion">
      <div class="seccion-cab"><h2>Su check-in</h2><button class="btn btn-peq" onClick={() => setEditar({})}><Icono n="mas" /> Pregunta</button></div>
      <div class="panel panel-pad pila">
        <div class="campo">
          <span class="etq" id="ck-apartados">Qué le preguntas cada semana</span>
          <div class="zonas elegir" role="group" aria-labelledby="ck-apartados">
            {APARTADOS_CHECKIN.map(([k, t]) => <button type="button" key={k} aria-pressed={marcado(k) ? 'true' : 'false'} onClick={() => alternar(k)}>{t}</button>)}
          </div>
          <span class="ayuda">Lo que quites deja de salirle en el check-in. El cuadro de notas para ti sale siempre.</span>
        </div>
        <div class="campo">
          <span class="etq">Tus preguntas</span>
          {!activas.length ? <p class="peq terciario">Ninguna todavía. Añade las tuyas: estrés, horas de pie, cómo va una lesión…</p> : (
            <ul class="lista lista-preguntas">
              {activas.map((p) => (
                <li key={p.id} class="separa">
                  <div class="pila-xs">
                    <span>{p.texto}</span>
                    <span class="peq terciario">{nombre(TIPOS_PREGUNTA, p.tipo)}{p.unidad ? ` (${p.unidad})` : ''}{p.atleta_id == null && <span class="chip chip-mini morado">Para todos</span>}</span>
                  </div>
                  <span class="fila">
                    <button class="btn btn-icono plano" aria-label={`Editar «${p.texto}»`} onClick={() => setEditar(p)}><Icono n="editar" /></button>
                    {quitando === p.id
                      ? <button class="btn btn-peq btn-peligro" onClick={() => quitar(p)}>Quitar para todos</button>
                      : <button class="btn btn-icono plano" aria-label={`Quitar «${p.texto}»`} onClick={() => quitar(p)}><Icono n="basura" /></button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {archivadas.length > 0 && (
            <button type="button" class="btn-texto" style="justify-self:start" aria-expanded={verArchivadas} onClick={() => setVerArchivadas(!verArchivadas)}>
              <Icono n={verArchivadas ? 'arriba' : 'abajo'} /> Archivadas ({archivadas.length})
            </button>
          )}
          {verArchivadas && (
            <ul class="lista lista-preguntas archivadas">
              {archivadas.map((p) => (
                <li key={p.id} class="separa"><span class="secundario">{p.texto}</span><button class="btn btn-peq" onClick={() => recuperar(p)}>Recuperar</button></li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {conGrafica.length > 0 && (
        <div class="graficas-preguntas">
          {conGrafica.map(([p, serie]) => (
            <div class="panel panel-pad pila-s" key={p.id}>
              <span class="separa"><strong class="peq">{p.texto}</strong>{p.tipo === 'escala' && <span class="mini terciario">de 1 a 5</span>}</span>
              <Grafica puntos={serie.map((x) => ({ x: x.iso, y: x.valor }))} unidad={p.tipo === 'numero' ? p.unidad || '' : ''} dec={p.tipo === 'escala' ? 0 : 1} alto={120}
                rangoMin={p.tipo === 'escala' ? 4 : null} etiqueta={`${p.texto}: último valor ${serie[serie.length - 1].valor}${p.unidad ? ` ${p.unidad}` : ''}`} />
            </div>
          ))}
        </div>
      )}
      {editar && <HojaPregunta atleta={atleta} pregunta={editar.id ? editar : null} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); preguntas.recargar(true); }} />}
    </section>
  );
}

function HojaPregunta({ atleta, pregunta, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const [f, setF] = useState(() => ({ texto: '', tipo: 'escala', unidad: '', ayuda: '', etiqueta_min: '', etiqueta_max: '', ...(pregunta || {}), para: pregunta && pregunta.atleta_id == null ? 'todos' : 'atleta' }));
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const campo = (k) => (e) => set(k)(e.currentTarget.value);
  async function guardar(e) {
    e.preventDefault();
    setError(null);
    if (!f.texto.trim()) { setError('Escribe la pregunta.'); return; }
    setGuardando(true);
    try {
      await api.guardarPregunta({ ...f, atleta_id: f.para === 'todos' ? null : atleta.id }, pregunta?.id || null);
      aviso(pregunta ? 'Pregunta guardada' : f.para === 'todos' ? 'Pregunta añadida al check-in de todos tus atletas' : `Pregunta añadida al check-in de ${primero(atleta.nombre)}`);
      alGuardar();
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  }
  return (
    <Hoja titulo={pregunta ? 'Editar pregunta' : 'Nueva pregunta del check-in'} alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar} noValidate>
        <div class="campo"><label for="pq-texto">Pregunta</label>
          <input id="pq-texto" class="entrada" maxLength={160} value={f.texto} onInput={campo('texto')} placeholder="Estrés en el trabajo, horas de pie, ¿qué tal la rodilla?…" /></div>
        <div class="campo"><span class="etq">Cómo se responde</span>
          <Segmentos etiqueta="Cómo se responde" opciones={TIPOS_PREGUNTA} valor={f.tipo} alCambiar={(v) => set('tipo')(v || f.tipo)} /></div>
        {f.tipo === 'escala' && (
          <div class="rejilla-campos">
            <div class="campo"><label for="pq-min">Qué es el 1</label><input id="pq-min" class="entrada" maxLength={30} value={f.etiqueta_min || ''} onInput={campo('etiqueta_min')} placeholder="Nada" /></div>
            <div class="campo"><label for="pq-max">Qué es el 5</label><input id="pq-max" class="entrada" maxLength={30} value={f.etiqueta_max || ''} onInput={campo('etiqueta_max')} placeholder="Muchísimo" /></div>
          </div>
        )}
        {f.tipo === 'numero' && (
          <div class="campo"><label for="pq-unidad">Unidad (si tiene)</label><input id="pq-unidad" class="entrada entrada-num" maxLength={12} value={f.unidad || ''} onInput={campo('unidad')} placeholder="h, cafés, km…" /></div>
        )}
        <div class="campo"><label for="pq-ayuda">Aclaración (si hace falta)</label>
          <input id="pq-ayuda" class="entrada" maxLength={200} value={f.ayuda || ''} onInput={campo('ayuda')} placeholder="Media de la semana, contando solo los días de trabajo…" /></div>
        <div class="campo"><span class="etq">A quién se la preguntas</span>
          <Segmentos etiqueta="A quién se la preguntas" opciones={[['atleta', `Solo a ${primero(atleta.nombre)}`], ['todos', 'A todos tus atletas']]} valor={f.para} alCambiar={(v) => set('para')(v || f.para)} />
          {pregunta && <span class="ayuda">Si ya tiene respuestas, no se le puede cambiar el tipo ni a quién va: quítala (se archiva) y crea otra.</span>}</div>
        {error && <div class="error" role="alert">{error}</div>}
        <button class="btn btn-primario btn-grande" disabled={guardando}>{guardando ? 'Guardando…' : pregunta ? 'Guardar' : 'Añadir al check-in'}</button>
      </form>
    </Hoja>
  );
}
