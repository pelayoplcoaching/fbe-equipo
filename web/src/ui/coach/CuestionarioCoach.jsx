// Coach: el cuestionario inicial del atleta (en Datos) y su check-in a medida (en Seguimiento)
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Hoja, Icono, Segmentos, Grafica } from '../comunes.jsx';
import { OBJETIVOS, EXPERIENCIA, LUGARES, MATERIAL, SINTOMAS, OTRAS, ZONAS_LESION, LIMITA, RESULTADO_COACH, nombre, resumenCuestionario, conSalud, objetivosDe, textoObjetivos } from '../../logica/cuestionario.js';
import { APARTADOS_CHECKIN, TIPOS_PREGUNTA, serieRespuestas } from '../../logica/preguntas.js';
import { fechaCuando, pendiente } from '../atleta/Cuestionario.jsx';
import { fechaLarga } from '../../logica/esencial-alta.js';

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

// (FBE Esencial) Quien va por su cuenta: en qué punto está (cuestionario, visto bueno médico y su plan) y, si su cribado
// pide valoración médica, el botón para confirmar su visto bueno (con él, la app le asigna su plan).
export function EsencialCoach({ atleta, alCambiar }) {
  const { api, aviso } = useApp();
  const c = useCarga(() => api.cuestionario(atleta.id).catch(() => null), [atleta.id, atleta.visto_bueno_en]);
  const bl = useCarga(() => api.bloquesDe(atleta.id).catch(() => []), [atleta.id, atleta.visto_bueno_en]);
  // (094) las alternativas que ha elegido para siempre en su gimnasio, con sus nombres
  const alts = Object.entries(atleta.esencial_alternativas || {});
  const nombres = useCarga(() => (alts.length ? api.ejerciciosPorIds(alts.flat()).catch(() => []) : Promise.resolve([])), [alts.flat().join()]);
  const nombreEj = Object.fromEntries((nombres.datos || []).map((x) => [x.id, x.nombre]));
  const [ocupado, una] = useUnaVez();
  const [error, setError] = useState(null);
  const q = c.datos;
  const bloque = (bl.datos || []).find((x) => ['activo', 'ajustado', 'planificado'].includes(x.estado)) || null;
  const limpio = q?.resultado === 'sin_valoracion';
  const necesita = !!q?.resultado && !limpio;
  const cuest = !q?.completado_en ? (q ? 'Empezado, sin enviar' : 'Sin rellenar') : !q.resultado ? 'Enviado, sin la parte de salud' : RESULTADO_COACH[q.resultado][0];
  const visto = !q?.resultado ? '—' : limpio ? 'No le hace falta' : atleta.visto_bueno_en ? `Confirmado ${fechaCuando(atleta.visto_bueno_en)}`
    : atleta.visto_bueno_pedido_en ? `Dice que lo tiene (lo marcó ${fechaCuando(atleta.visto_bueno_pedido_en)})` : 'Aún no lo tiene';
  async function confirmar() {
    setError(null);
    try {
      const r = await api.esencialConfirmarVistoBueno(atleta.id);
      if (r?.falta091) { setError('Falta ejecutar la migración 091 en Supabase.'); return; }
      if (r?.error) { setError(`Visto bueno guardado, pero sin plan: ${r.error}`); alCambiar?.(); return; }
      aviso(r?.bloque ? `Visto bueno confirmado: ${primero(atleta.nombre)} ya tiene su plan` : 'Visto bueno confirmado');
      alCambiar?.();
    } catch (e) { setError(e.message); }
  }
  return (
    <section class="panel" aria-labelledby="esencial-coach">
      <div class="panel-pad pila-xs">
        <h2 id="esencial-coach" class="h-panel">FBE Esencial</h2>
        <span class="peq terciario">Va por su cuenta: la app le asigna el plan según su cuestionario y le prepara cada semana. No sale en Revisar, en la revisión semanal ni en «A quién escribir».</span>
      </div>
      <dl class="datos-cuest" style="border-top:1px solid var(--linea)">
        <div><dt>Empieza</dt><dd>{atleta.esencial_inicio ? `El ${fechaLarga(atleta.esencial_inicio)}` : 'El lunes siguiente a su cuestionario'}</dd></div>
        <div><dt>Cuestionario</dt><dd>{c.cargando && !q ? 'Cargando…' : cuest}</dd></div>
        <div><dt>Visto bueno médico</dt><dd>{visto}</dd></div>
        <div><dt>Su plan</dt><dd>{bl.cargando && !bl.datos ? 'Cargando…' : bloque ? `${bloque.nombre}${bloque.fecha_inicio ? `, desde el ${fechaLarga(bloque.fecha_inicio)}` : ''}` : 'Aún no tiene'}</dd></div>
        <PruebasCoach atletaId={atleta.id} />
        <MolestiasCoach atletaId={atleta.id} />
        {alts.length > 0 && <div><dt>Su gimnasio</dt><dd>{alts.map(([g, a]) => `${nombreEj[g] || '…'} → ${nombreEj[a] || '…'}`).join('; ')} <span class="terciario">(lo eligió para siempre)</span></dd></div>}
        {/* (093) con nutrición: su plan de comida lo calcula y lo ajusta la app; si dice tener o haber tenido un TCA, mantener */}
        {atleta.nutricion !== false && <div><dt>Comida</dt><dd>{q?.tca === true
          ? 'La app le calcula el plan y lo ajusta cada semana. Dice tener o haber tenido un trastorno de la conducta alimentaria: su plan es de mantener y nunca baja solo.'
          : 'La app le calcula el plan y lo ajusta cada semana (en Nutrición, sus planes y por qué cambian).'}</dd></div>}
      </dl>
      {necesita && !atleta.visto_bueno_en && (
        <div class="panel-pad pila-s" style="border-top:1px solid var(--linea)">
          <span class="peq">{atleta.visto_bueno_pedido_en ? 'Dice que ya tiene el visto bueno de su médico (o ha hecho la Puesta a punto). Si es así, confírmalo y la app le prepara su plan.'
            : 'Su cribado pide valoración médica antes de empezar. Si ya la tiene (o ha hecho la Puesta a punto contigo), puedes confirmarlo tú.'}</span>
          {error && <span class="error" role="alert">{error}</span>}
          <button type="button" class="btn btn-primario" style="justify-self:start" disabled={ocupado} onClick={() => una(confirmar)}><Icono n="hecho" /> Confirmar visto bueno</button>
        </div>
      )}
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
  const c = useCarga(() => api.cuestionario(atleta.id).catch(() => null), [atleta.id], { recuerdo: `cuestionario:${api.uid()}:${atleta.id}` });
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

// (v0.255, 108) Sus pruebas de FBE Esencial (silla, equilibrio, cintura/altura, prensión y SPPB): la última de cada una y la
// anterior. Sin la 108 o sin pruebas, nada.
function PruebasCoach({ atletaId }) {
  const { backend } = useApp();
  const d = useCarga(async () => {
    const [api, P] = await Promise.all([import('../../datos/api-pruebas.js'), import('../../logica/esencial-pruebas.js')]);
    const filas = (await api.hay108(backend).catch(() => false)) ? await api.pruebas(backend, atletaId).catch(() => []) : [];
    return filas.length ? { filas, P } : null;
  }, [atletaId]);
  if (!d.datos) return null;
  const { filas, P } = d.datos;
  const u = P.ultimasPruebas(filas);
  const xs = P.PRUEBAS.filter((k) => u[k]?.ultima);
  return (
    <div><dt>Sus pruebas</dt><dd>{xs.map((k) => `${P.NOMBRE_CORTO[k]}: ${P.valorTexto(k, u[k].ultima.valor)}${u[k].anterior ? ` (antes, ${P.valorTexto(k, u[k].anterior.valor)})` : ''}`).join('; ')}
      <span class="terciario"> · las últimas, del {fechaLarga(String(filas[0].fecha).slice(0, 10))}</span></dd></div>
  );
}

// (v0.256, 109) Sus molestias abiertas (de 0 a 10, con las zonas del cuestionario de lesiones: lo que apunta en «Me duele
// algo» y en su check-in de las últimas seis semanas), con su color y su tendencia, y si toca que le vea un profesional
// (M10). Sin la 109 o sin ninguna abierta, nada.
function MolestiasCoach({ atletaId }) {
  const { backend } = useApp();
  const d = useCarga(async () => {
    const [api, D, F] = await Promise.all([import('../../datos/api-dolor.js'), import('../../logica/dolor.js'), import('../../logica/fechas.js')]);
    if (!(await api.hay109(backend).catch(() => false))) return null;
    const hoy = F.hoyISO();
    const [registros, checkins] = await Promise.all([api.registros(backend, atletaId, F.sumarDias(hoy, -42)).catch(() => []), api.molestiasCheckin(backend, atletaId, F.sumarDias(F.lunesDe(hoy), -42)).catch(() => [])]);
    const estado = D.estadoZonas({ registros, checkins, hoy });
    const abiertas = estado.filter((z) => z.abierta);
    const semanas = checkins.filter((c) => String(c.semana_inicio).slice(0, 10) >= F.sumarDias(F.lunesDe(hoy), -35));
    const pro = D.profesional({ semanas, estado, hoy });
    return abiertas.length || pro ? { abiertas, pro, D } : null;
  }, [atletaId]);
  if (!d.datos) return null;
  const { abiertas, pro, D } = d.datos;
  const TEND = { mejor: 'mejor', igual: 'igual', peor: 'peor' };
  return (
    <div><dt>Sus molestias</dt><dd>{abiertas.length ? abiertas.map((z) => `${z.nombre}: ${z.valor}/10 (${D.NOMBRE_SEMAFORO[z.semaforo].toLowerCase()}, desde el ${fechaLarga(z.desde)}${z.tendencia ? `; ${TEND[z.tendencia]} que la semana anterior` : ''})`).join('; ') : 'Ninguna abierta'}
      {pro && <span class="texto-aviso"> · Toca que le vea un profesional{pro.motivo === 'semanas' ? ' (varias semanas con una molestia)' : pro.motivo === 'dos_semanas' ? ' (dos semanas sin mejorar)' : ''}.</span>}</dd></div>
  );
}

// (v0.254, 107) La lista de medicación que confirmó el atleta en «Mi medicación y el ejercicio» (reconocida con los nombres de
// Pauta Activa en lo que escribió aquí), con el enlace que abre Pauta Activa con ella. Sin la 107 o sin lista, nada.
function MedicacionConfirmada({ atletaId }) {
  const { backend } = useApp();
  const m = useCarga(async () => {
    const [api, M, F] = await Promise.all([import('../../datos/api-medicacion.js'), import('../../logica/medicacion.js'), import('../../logica/fechas.js')]);
    const fila = await api.medicacion(backend, atletaId).catch(() => null);
    return fila ? { fila, M, F } : null;
  }, [atletaId]);
  if (!m.datos) return null;
  const { fila, M, F } = m.datos;
  const lista = Array.isArray(fila.lista) ? fila.lista : [];
  return (
    <p class="peq">
      Su lista confirmada{lista.length ? `: ${lista.map((x) => `${x.nombre} (${M.dosisTexto(x)})`).join(', ')}` : ': ninguno de los que reconoce la app'}.
      {fila.confirmado_en ? ` Confirmada el ${fechaLarga(F.fechaMadrid(new Date(fila.confirmado_en)))}.` : ''}{' '}
      <a href={M.enlacePautaActiva(lista)} target="_blank" rel="noopener">Verla en Pauta Activa</a>
    </p>
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
          {d.otras?.includes('medicacion') && d.atleta_id && <MedicacionConfirmada atletaId={d.atleta_id} />}
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
  const [frecPeso, setFrecPeso] = useState(atleta.peso_frecuencia === 'semanal' ? 'semanal' : 'diario');
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
  async function cambiarFrecPeso(f) {
    if (f === frecPeso) return;
    const previo = frecPeso;
    setFrecPeso(f);
    try {
      await api.guardarFrecuenciaPeso(atleta.id, f);
      // Una vez a la semana: si el check-in no le pregunta el peso, se activa ese apartado
      if (f === 'semanal' && !marcado('peso')) await alternar('peso'); else recargarFicha?.();
      aviso(f === 'semanal' ? 'Su peso, una vez a la semana: en el check-in' : 'Su peso, a diario: en «Tu día»');
    } catch (e) { setFrecPeso(previo); aviso(e.message, 'error'); }
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
          <span class="etq" id="ck-peso-frec">Su peso</span>
          <div class="zonas elegir" role="group" aria-labelledby="ck-peso-frec">
            <button type="button" aria-pressed={frecPeso === 'diario' ? 'true' : 'false'} onClick={() => cambiarFrecPeso('diario')}>A diario</button>
            <button type="button" aria-pressed={frecPeso === 'semanal' ? 'true' : 'false'} onClick={() => cambiarFrecPeso('semanal')}>Una vez a la semana</button>
          </div>
          <span class="ayuda">{frecPeso === 'diario'
            ? 'Cada mañana le sale «Tu peso» en «Tu día» (pendiente hasta que lo apunte): así ves su tendencia día a día.'
            : marcado('peso') ? 'No le sale cada día en «Tu día»: se lo pide el check-in de la semana. Si quiere, puede apuntarlo otros días desde Hoy.'
            : 'Ojo: así no se lo pide nadie. Marca Peso arriba para que se lo pida el check-in.'}</span>
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
