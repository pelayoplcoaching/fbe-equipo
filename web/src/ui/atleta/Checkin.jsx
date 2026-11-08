import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CabeceraGrande, Siluetas, useApp, useCarga, ErrorCaja, Paso, Segmentos, Icono, Pista } from '../comunes.jsx';
import { Hilo } from '../Hilo.jsx';
import { ESCALAS, HORAS_SUENO, ZONAS, MEDIDAS, num, signo } from '../../logica/calculos.js';
import { semanaCheckin, hoyISO, lunesDe, sumarDias, rangoSemana, fmtCorta, diasEntre } from '../../logica/fechas.js';
import { TEXTO_CONSENTIMIENTO_SALUD } from '../../legal.js';
import { conNutricion } from '../../logica/nivel.js';
import { pregunta, limpiarRespuestas, respuestasNoValidas } from '../../logica/preguntas.js';
import { vibrar } from '../hapticos.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { imagenPasoCheckin } from '../../logica/imagenes.js';

// v0.49: las respuestas de una sola opción, en filas grandes (número y frase), fáciles de tocar con el pulgar
function OpcionesGrandes({ etiqueta, opciones, valor, alCambiar }) {
  return (
    <div class="opciones-grandes" role="group" aria-label={etiqueta}>
      {opciones.map(([v, t, ayuda]) => (
        <button type="button" key={String(v)} aria-pressed={valor === v ? 'true' : 'false'} onClick={(ev) => alCambiar(valor === v ? null : v, ev, `${t}${ayuda ? `, ${ayuda}` : ''}`)}>
          <span class="op-n num">{t}</span>{ayuda && ' '}{ayuda && <span class="op-t">{ayuda}</span>}
          <span class="op-check" aria-hidden="true"><Icono n="hecho" /></span>
        </button>
      ))}
    </div>
  );
}

const escala = (frases) => frases.map((f, i) => [i + 1, String(i + 1), f]);

// Una pregunta propia del coach: escala del 1 al 5, número, sí o no, o texto
function RespuestaPregunta({ p, valor, alCambiar }) {
  const id = `ck-p-${p.id}`;
  const extremos = p.etiqueta_min || p.etiqueta_max ? `1 = ${(p.etiqueta_min || '—').toLowerCase()}; 5 = ${(p.etiqueta_max || '—').toLowerCase()}` : '1 = poco; 5 = mucho';
  if (p.tipo === 'numero' || p.tipo === 'texto') {
    return (
      <div class="campo">
        <label for={id}>{p.texto}{p.unidad ? ` (${p.unidad})` : ''}</label>
        {p.tipo === 'numero'
          ? <input id={id} class="entrada entrada-num" inputMode="decimal" value={valor ?? ''} onInput={(e) => alCambiar(e.currentTarget.value)} />
          : <textarea id={id} class="area" maxLength={1000} value={valor ?? ''} onInput={(e) => alCambiar(e.currentTarget.value)} />}
        {p.ayuda && <span class="ayuda">{p.ayuda}</span>}
      </div>
    );
  }
  return (
    <div class="campo">
      <span class="etq" id={id}>{p.texto}</span>
      <Segmentos etiqueta={p.texto} valor={valor ?? null} alCambiar={alCambiar}
        opciones={p.tipo === 'si_no' ? [[true, 'Sí'], [false, 'No']] : [1, 2, 3, 4, 5].map((n) => [n, String(n)])} />
      {p.tipo === 'escala' && <span class="escala-frase">{extremos}</span>}
      {p.ayuda && <span class="ayuda">{p.ayuda}</span>}
    </div>
  );
}

export function Checkin({ salud, recargarConsentimientos, checkinSemana, releer }) {
  const { api, atleta, aviso } = useApp();
  const estaSemana = lunesDe(hoyISO());
  // El lunes se abre la semana que acaba de terminar (es la que toca contar)
  const [lunes, setLunes] = useState(() => semanaCheckin(hoyISO()));
  const datos = useCarga(() => api.checkin(atleta.id, lunes), [lunes]);
  // La semana que se ve ahora (lo que llega tarde de otra semana no se mezcla)
  const lunesActual = useRef(lunes);
  lunesActual.current = lunes;
  const [f, setF] = useState(null);
  const [molestias, setMolestias] = useState({});
  const [peso, setPeso] = useState(null);
  const [medidas, setMedidas] = useState({});
  const [verMedidas, setVerMedidas] = useState(false);
  const [verOpcionales, setVerOpcionales] = useState(false);
  const [pasosHabito, setPasosHabito] = useState(null);
  const [kcalNutricion, setKcalNutricion] = useState(null);
  const [resp, setResp] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  // v0.49: el paso que se ve (999 = el repaso), si se llegó desde el repaso, y el aviso de «enviado»
  const [paso, setPaso] = useState(0);
  const [desdeRepaso, setDesdeRepaso] = useState(false);
  const [enviado, setEnviado] = useState(null);
  const tituloRef = useRef(null);
  const enfocar = useRef(false);
  const temporizador = useRef(null);
  const [anuncioRespuesta, setAnuncioRespuesta] = useState('');
  useEffect(() => () => clearTimeout(temporizador.current), []);
  // Otra semana (o los datos de otra semana): nada de lo de antes sigue en marcha
  useEffect(() => { setEnviado(null); clearTimeout(temporizador.current); setAnuncioRespuesta(''); }, [lunes]);
  // El foco va al título de la pregunta nada más pintarla (antes de que el navegador la enseñe)
  useLayoutEffect(() => {
    if (!enfocar.current) return;
    enfocar.current = false;
    tituloRef.current?.focus({ preventScroll: true });
    const r = tituloRef.current?.closest('.ck-paso')?.getBoundingClientRect();
    if (r && (r.top < 0 || r.top > window.innerHeight * 0.6)) window.scrollTo({ top: window.scrollY + r.top - 140 });
  }, [paso]);
  // Lo que le pregunta su coach (sin elegir nada, todo)
  // A quien solo le lleva el entrenamiento, nada de alimentación (aunque el apartado esté elegido)
  const conNut = conNutricion(atleta) && datos.datos?.nutricion !== false;
  const ver = (k) => (k !== 'alimentacion' || conNut) && pregunta({ checkin_apartados: datos.datos?.apartados ?? null }, k);

  useEffect(() => {
    if (!datos.datos) return;
    const c = datos.datos.checkin || {};
    setF({ ...c });
    // Ya enviado, se abre en el repaso (cada respuesta se cambia tocándola); si no, en la primera pregunta
    clearTimeout(temporizador.current);
    setPaso(datos.datos.checkin ? 999 : 0);
    setDesdeRepaso(false);
    // Las respuestas, como se escriben (los números con coma)
    setResp(Object.fromEntries(Object.entries(c.respuestas || {}).map(([k, v]) => [k, typeof v === 'number' && datos.datos.preguntas?.find((q) => q.id === k)?.tipo === 'numero' ? num(v, 2) : v])));
    setMolestias(Object.fromEntries(ZONAS.map(([z]) => [z, datos.datos.molestias.find((m) => m.zona === z)?.intensidad ?? 0])));
    setPeso(null);
    setMedidas({});
    // Las medidas se piden cada 4 semanas: se abren solas si toca
    const ultima = datos.datos.medidas?.[0];
    setVerMedidas(!ultima || diasEntre(ultima.fecha, hoyISO()) >= 25);
    setVerOpcionales(!!(c.fc_reposo || c.hrv || c.pasos_media || c.calorias_media));
    setPasosHabito(null);
    setKcalNutricion(null);
    // Si apunta lo que come, la media de kcal de esa semana ya está hecha (solo los días completos)
    if (!c.calorias_media && salud && ver('reloj') && conNut) {
      (async () => {
        try {
          // Solo días acabados (hoy no) y completos (ni marcados como a medias ni con muy pocas kcal)
          const pedido = lunes;
          const regs = (await api.registrosNutricion(atleta.id, lunes, sumarDias(lunes, 6)))
            .filter((r) => r.kcal != null && r.fecha < hoyISO() && r.completo !== false && Number(r.kcal) >= 800);
          if (!regs.length || pedido !== lunesActual.current) return;
          const media = Math.round(regs.reduce((t, r) => t + Number(r.kcal), 0) / regs.length / 10) * 10;
          setF((x) => (x && !x.calorias_media ? { ...x, calorias_media: media } : x));
          setKcalNutricion({ media, dias: regs.length });
          setVerOpcionales(true);
        } catch { /* sin registro de nutrición: nada que proponer */ }
      })();
    }
    // Si apunta los pasos como hábito, la media de esa semana ya está hecha
    if (!c.pasos_media && salud && ver('reloj')) {
      (async () => {
        try {
          const hab = (await api.habitos(atleta.id, { todos: true })).find((h) => h.tipo === 'numero' && String(h.unidad || '').toLowerCase() === 'pasos');
          if (!hab) return;
          const pedido = lunes;
          const regs = (await api.registrosHabitos(atleta.id, lunes, sumarDias(lunes, 6))).filter((r) => r.habito_id === hab.id);
          if (!regs.length || pedido !== lunesActual.current) return;
          const media = Math.round(regs.reduce((t, r) => t + Number(r.valor), 0) / regs.length / 10) * 10;
          setF((x) => (x && !x.pasos_media ? { ...x, pasos_media: media } : x));
          setPasosHabito({ media, dias: regs.length });
          setVerOpcionales(true);
        } catch { /* sin hábitos: nada que proponer */ }
      })();
    }
  }, [datos.datos]);

  if (!salud) {
    return (
      <div class="contenido">
        <CabeceraGrande><div class="titulo"><h1>Check-in semanal</h1></div></CabeceraGrande>
        <div class="panel panel-pad pila">
          <p>Para registrar tu peso, sueño, energía y molestias hace falta tu consentimiento para tratar datos de salud.</p>
          <p class="secundario peq">{TEXTO_CONSENTIMIENTO_SALUD}</p>
          <button class="btn btn-primario btn-grande" onClick={async () => { await api.darConsentimientos(['datos_salud']); recargarConsentimientos(); }}>Dar consentimiento</button>
        </div>
      </div>
    );
  }
  if (datos.cargando && !f) return <div class="contenido"><Siluetas forma="formulario" n={5} texto="Cargando el check-in" /></div>;
  if (!f) return <div class="contenido"><ErrorCaja error={datos.error} reintentar={datos.recargar} /></div>;

  const pesos = datos.datos.pesos;
  const ultimoPeso = pesos[0];
  const ultimasMedidas = datos.datos.medidas?.[0] || null;
  const yaEnviado = !!datos.datos.checkin;
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function guardar(e) {
    e.preventDefault();
    if (datos.cargando) return; // aún se están cargando los datos de la semana elegida
    // Una respuesta escrita que no vale se dice (no se pierde en silencio)
    const malas = respuestasNoValidas(datos.datos.preguntas || [], resp);
    if (malas.length) {
      const q = malas[0];
      setError(`Revisa tu respuesta a «${q.texto}»: ${q.tipo === 'numero' ? 'tiene que ser un número de 0 a 999.999, con dos decimales como mucho' : 'escribe algo'}.`);
      return;
    }
    setError(null); setGuardando(true);
    try {
      // El peso y las medidas van con la fecha de hoy si es esta semana (o el lunes justo después de la semana);
      // si se rellena una semana anterior, con su domingo
      const fechaDato = lunes === estaSemana || sumarDias(lunes, 7) === hoyISO() ? hoyISO() : sumarDias(lunes, 6);
      // Las respuestas a sus preguntas; las de preguntas que ya no se le hacen se quedan como estaban
      const preguntas = datos.datos.preguntas || [];
      let enviar = f;
      if (preguntas.length) {
        const actuales = new Set(preguntas.map((q) => q.id));
        const otras = Object.fromEntries(Object.entries(datos.datos.checkin?.respuestas || {}).filter(([k]) => !actuales.has(k)));
        enviar = { ...f, respuestas: { ...otras, ...(limpiarRespuestas(preguntas, resp) || {}) } };
      }
      await api.guardarCheckin(atleta.id, lunes, enviar, ver('molestias') ? molestias : {}, null);
      if (peso && ver('peso')) await api.guardarPeso(atleta.id, fechaDato, peso);
      if (ver('medidas') && Object.values(medidas).some((v) => v != null)) await api.guardarMedidas(atleta.id, fechaDato, medidas);
      aviso(yaEnviado ? 'Check-in actualizado' : 'Check-in enviado a tu coach');
      setEnviado(yaEnviado ? 'actualizado' : 'enviado');
      vibrar('checkin');
      datos.recargar(true);
      checkinSemana.recargar(true);
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  }

  // ---------- v0.49: una pregunta por pantalla ----------
  // Cada paso: su título (el encabezado que recibe el foco), lo que se ve, y cómo se resume en la revisión. Los de una
  // sola respuesta pasan solos al siguiente (con un momento para ver lo elegido).
  const frase = (frases, v) => (v ? `${v}: ${frases[v - 1]}` : null);
  const pasos = [
    ver('peso') && {
      id: 'peso', titulo: 'Tu peso de hoy', resumen: peso ? `${num(peso)} kg` : ultimoPeso ? `Sin apuntar (el último, ${num(ultimoPeso.kg)} kg)` : null,
      cuerpo: () => (
        <div class="campo">
          <label for="ck-peso">En ayunas, en kg</label>
          <Paso id="ck-peso" valor={peso ?? (ultimoPeso ? Number(ultimoPeso.kg) : null)} paso={0.1} min={25} max={350} dec={1} etiqueta="peso en kilos" alCambiar={setPeso} />
          <span class="ayuda">
            {ultimoPeso ? `Último registro: ${num(ultimoPeso.kg)} kg el ${ultimoPeso.fecha.slice(8, 10)}/${ultimoPeso.fecha.slice(5, 7)}` : 'Aún no hay pesos registrados.'}
            {peso && ultimoPeso ? ` (${signo(peso - ultimoPeso.kg)} kg)` : ''}
            {!peso && ultimoPeso ? '. Toca − o + o escribe el de hoy para guardarlo.' : ''}
          </span>
        </div>
      ),
    },
    ver('descanso') && { id: 'sueno', titulo: '¿Cuánto duermes por noche?', auto: true, resumen: f.horas_sueno ? `${f.horas_sueno.replace('-', '–')} h` : null,
      cuerpo: (avanzar) => <OpcionesGrandes etiqueta="Horas de sueño" valor={f.horas_sueno ?? null} opciones={HORAS_SUENO.map((h) => [h, `${h.replace('-', '–')} h`])} alCambiar={(v, ev, t) => { set('horas_sueno')(v); avanzar(v, ev, t); }} /> },
    ver('descanso') && { id: 'energia', titulo: '¿Cómo vas de energía?', auto: true, resumen: frase(ESCALAS.energia, f.energia),
      cuerpo: (avanzar) => <OpcionesGrandes etiqueta="Energía (cansancio)" valor={f.energia ?? null} opciones={escala(ESCALAS.energia)} alCambiar={(v, ev, t) => { set('energia')(v); avanzar(v, ev, t); }} /> },
    ver('descanso') && { id: 'recuperacion', titulo: '¿Cómo te recuperas?', auto: true, resumen: frase(ESCALAS.recuperacion, f.recuperacion),
      cuerpo: (avanzar) => <OpcionesGrandes etiqueta="Recuperación" valor={f.recuperacion ?? null} opciones={escala(ESCALAS.recuperacion)} alCambiar={(v, ev, t) => { set('recuperacion')(v); avanzar(v, ev, t); }} /> },
    ver('descanso') && { id: 'motivacion', titulo: '¿Qué tal de motivación?', auto: true, resumen: frase(ESCALAS.motivacion, f.motivacion),
      cuerpo: (avanzar) => <OpcionesGrandes etiqueta="Motivación" valor={f.motivacion ?? null} opciones={escala(ESCALAS.motivacion)} alCambiar={(v, ev, t) => { set('motivacion')(v); avanzar(v, ev, t); }} /> },
    ver('molestias') && {
      id: 'molestias', titulo: '¿Te ha molestado algo?',
      resumen: ZONAS.filter(([z]) => molestias[z] > 0).map(([z, nombre]) => `${nombre} (${['', 'leve', 'moderada', 'grave'][molestias[z]]})`).join(', ') || 'Sin molestias',
      cuerpo: () => (
        <div class="pila">
          <span class="peq secundario" id="ck-zonas">Toca las zonas donde hayas notado molestias esta semana.</span>
          <div class="zonas" role="group" aria-labelledby="ck-zonas">
            {ZONAS.map(([z, nombre]) => (
              <button type="button" key={z} aria-pressed={molestias[z] > 0 ? 'true' : 'false'}
                onClick={() => setMolestias((m) => ({ ...m, [z]: m[z] > 0 ? 0 : 1 }))}>{nombre}</button>
            ))}
          </div>
          {ZONAS.filter(([z]) => molestias[z] > 0).map(([z, nombre]) => (
            <div class="zona-intensidad" key={z}>
              <span class="peq" style="font-weight:600">{nombre}</span>
              <Segmentos clase="dolor" etiqueta={`Intensidad en ${nombre}`} valor={molestias[z]}
                alCambiar={(v) => setMolestias((m) => ({ ...m, [z]: v ?? 1 }))}
                opciones={ESCALAS.molestia.slice(1).map((t, i) => [i + 1, ['Leve', 'Moderada', 'Grave'][i], t])} />
            </div>
          ))}
          <p class="peq secundario">Si un dolor es agudo o no mejora, avisa a tu coach directamente.</p>
        </div>
      ),
    },
    ver('alimentacion') && {
      id: 'adherencia', titulo: 'Alimentación',
      resumen: [['adherencia_desayuno', 'Desayuno'], ['adherencia_comida', 'Comida'], ['adherencia_merienda', 'Merienda'], ['adherencia_cena', 'Cena']].filter(([k]) => f[k]).map(([k, t]) => `${t} ${ESCALAS.adherencia[f[k] - 1]}`).join(', ') || null,
      cuerpo: () => (
        <div class="pila">
          <p class="peq secundario">¿Qué parte de cada comida seguiste según tu plan?</p>
          {[['adherencia_desayuno', 'Desayuno'], ['adherencia_comida', 'Comida'], ['adherencia_merienda', 'Merienda'], ['adherencia_cena', 'Cena']].map(([k, t]) => (
            <div class="campo" key={k}>
              <span class="etq">{t}</span>
              <Segmentos etiqueta={`Adherencia en ${t}`} valor={f[k] ?? null} alCambiar={set(k)} opciones={ESCALAS.adherencia.map((x, i) => [i + 1, x.replace(' %', '')])} />
            </div>
          ))}
        </div>
      ),
    },
    ver('alimentacion') && { id: 'saciedad', titulo: '¿Te has quedado con hambre?', auto: true, resumen: frase(ESCALAS.saciedad, f.saciedad),
      cuerpo: (avanzar) => <OpcionesGrandes etiqueta="Saciedad" valor={f.saciedad ?? null} opciones={escala(ESCALAS.saciedad)} alCambiar={(v, ev, t) => { set('saciedad')(v); avanzar(v, ev, t); }} /> },
    ver('alimentacion') && { id: 'satisfaccion', titulo: '¿Estás a gusto con la dieta?', auto: true, resumen: frase(ESCALAS.satisfaccion, f.satisfaccion_dieta),
      cuerpo: (avanzar) => <OpcionesGrandes etiqueta="Satisfacción con la dieta" valor={f.satisfaccion_dieta ?? null} opciones={escala(ESCALAS.satisfaccion)} alCambiar={(v, ev, t) => { set('satisfaccion_dieta')(v); avanzar(v, ev, t); }} /> },
    ver('medidas') && {
      id: 'medidas', titulo: 'Medidas', resumen: MEDIDAS.filter(([k]) => medidas[k] != null).map(([k, t]) => `${t} ${num(medidas[k])} cm`).join(', ') || (verMedidas ? 'Sin apuntar' : 'Esta semana no tocan'),
      cuerpo: () => (
        <div class="pila">
          <button type="button" class="btn-texto" onClick={() => setVerMedidas(!verMedidas)} aria-expanded={verMedidas}>
            <Icono n={verMedidas ? 'arriba' : 'abajo'} /> Medidas (cada 4 semanas)
          </button>
          {verMedidas && (
            <>
              <p class="peq secundario">Por la mañana, con la cinta ajustada sin apretar. {ultimasMedidas ? `Entre paréntesis, las del ${fmtCorta(ultimasMedidas.fecha)}.` : 'Si vas con prisa, basta con la cintura.'}</p>
              <div class="rejilla-campos">
                {MEDIDAS.map(([k, t]) => (
                  <div class="campo" key={k}>
                    <label for={`ck-${k}`}>{t} (cm){ultimasMedidas?.[k] != null && <span class="terciario"> (antes {num(ultimasMedidas[k])})</span>}</label>
                    <Paso id={`ck-${k}`} valor={medidas[k] ?? null} paso={0.5} min={10} max={250} dec={1} etiqueta={`${t} en centímetros`}
                      alCambiar={(v) => setMedidas((m) => ({ ...m, [k]: v ?? (ultimasMedidas?.[k] != null ? Number(ultimasMedidas[k]) : null) }))} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ),
    },
    ver('reloj') && {
      id: 'reloj', titulo: 'Datos de reloj o app', resumen: [['pasos_media', 'pasos'], ['calorias_media', 'kcal'], ['fc_reposo', 'lpm'], ['hrv', 'ms de HRV']].filter(([k]) => f[k] != null).map(([k, u]) => `${num(f[k], 0)} ${u}`).join(', ') || 'Sin apuntar (son opcionales)',
      cuerpo: () => (
        <div class="pila">
          <button type="button" class="btn-texto" onClick={() => setVerOpcionales(!verOpcionales)} aria-expanded={verOpcionales}>
            <Icono n={verOpcionales ? 'arriba' : 'abajo'} /> Datos de reloj o app (opcionales)
          </button>
          {verOpcionales && (
            <div class="rejilla-campos">
              {[['pasos_media', 'Pasos al día (media)', 500, 0, 100000, 0], ['calorias_media', 'Calorías al día (media)', 50, 500, 8000, 0],
                ['fc_reposo', 'FC en reposo (lpm)', 1, 25, 150, 0], ['hrv', 'HRV (ms)', 1, 0, 300, 0]].map(([k, t, paso, min, max, dec]) => (
                <div class="campo" key={k}>
                  <label for={`ck-${k}`}>{t}</label>
                  <Paso id={`ck-${k}`} valor={f[k] ?? null} paso={paso} min={min} max={max} dec={dec} etiqueta={t} alCambiar={set(k)} />
                  {k === 'pasos_media' && pasosHabito && <span class="ayuda">Media de los {pasosHabito.dias} días que apuntaste en tus hábitos.</span>}
                  {k === 'calorias_media' && kcalNutricion && <span class="ayuda">Media de los {kcalNutricion.dias} días completos que apuntaste en tu nutrición.</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    // Las preguntas de su coach, una a una (las de escala y las de sí o no también pasan solas)
    ...(datos.datos.preguntas || []).map((q) => ({
      id: `p-${q.id}`, titulo: q.texto, deCoach: true, auto: q.tipo === 'escala' || q.tipo === 'si_no',
      resumen: resp[q.id] === true ? 'Sí' : resp[q.id] === false ? 'No' : resp[q.id] != null && resp[q.id] !== '' ? `${resp[q.id]}${q.tipo === 'numero' && q.unidad ? ` ${q.unidad}` : ''}` : null,
      cuerpo: (avanzar) => <RespuestaPregunta p={q} valor={resp[q.id]} alCambiar={(v, ev) => { setResp((r) => ({ ...r, [q.id]: v })); if (q.tipo === 'escala' || q.tipo === 'si_no') avanzar(v, ev); }} />,
    })),
    {
      id: 'notas', titulo: 'Algo más para tu coach', resumen: f.notas?.trim() ? (f.notas.trim().length > 90 ? `${f.notas.trim().slice(0, 88)}…` : f.notas.trim()) : null,
      cuerpo: () => <div class="campo"><label for="ck-notas" class="sr">Algo más para tu coach</label><textarea id="ck-notas" class="area" value={f.notas || ''} onInput={(e) => set('notas')(e.currentTarget.value)} placeholder="Viajes, cambios de horario, cómo te has sentido…" /></div>,
    },
  ].filter(Boolean);
  const total = pasos.length;
  const enRevision = paso >= total;
  const actual = enRevision ? null : pasos[Math.max(0, paso)];
  // Ir a un paso (o al repaso, con total); desde el repaso, «Volver al repaso» en lugar de «Siguiente»
  function ir(n, desde = false) {
    clearTimeout(temporizador.current);
    const destino = Math.max(0, Math.min(n, total));
    if (destino >= total) setDesdeRepaso(false); else if (desde) setDesdeRepaso(true);
    if (destino !== paso) { enfocar.current = true; setPaso(destino); setError(null); setAnuncioRespuesta(''); }
  }
  // Al elegir una respuesta de una sola opción, al siguiente paso (o al repaso) un momento después; quitarla lo para.
  // Con el teclado o un lector de pantalla (un clic sin puntero: ev.detail === 0) no se avanza solo: se dice lo
  // elegido y se sigue con «Siguiente», para no mover el foco por sorpresa.
  const avanzarSolo = (v, ev, texto) => {
    clearTimeout(temporizador.current);
    if (v == null) { setAnuncioRespuesta('Respuesta quitada'); return; }
    setAnuncioRespuesta(`Elegido: ${texto || (v === true ? 'Sí' : v === false ? 'No' : String(v))}`);
    if (ev && ev.detail === 0) return;
    const a = paso;
    temporizador.current = setTimeout(() => ir(desdeRepaso ? total : a + 1), 420);
  };
  const anuncio = enRevision ? 'Repaso de tus respuestas antes de enviarlas' : `Pregunta ${paso + 1} de ${total}: ${actual.titulo}`;

  return (
    <div class="contenido">
    <form class="en-linea" onSubmit={(e) => { if (!enRevision) { e.preventDefault(); ir(paso + 1); return; } guardar(e); }}>
      <CabeceraGrande>
        <div class="titulo">
          <h1>Check-in semanal</h1>
          <div class="sub">Semana del {rangoSemana(lunes)}{yaEnviado ? ', enviado' : ''}</div>
        </div>
        <button type="button" class="btn btn-peq" onClick={() => setLunes(lunes === estaSemana ? sumarDias(estaSemana, -7) : estaSemana)}>
          {lunes === estaSemana ? 'Semana pasada' : 'Esta semana'}
        </button>
      </CabeceraGrande>
      <Pista id="checkin" icono="checkin">Una vez a la semana, un minuto: una pregunta por pantalla. Las de una sola respuesta pasan solas a la siguiente; al final repasas todo y lo envías. No hace falta rellenarlo todo.</Pista>

      <div class="ck-progreso">
        <div class="separa">
          <span class="peq secundario num" aria-hidden="true">{enRevision ? 'Repaso' : `${paso + 1} de ${total}`}</span>
          {!enRevision && <button type="button" class="btn-texto mini" onClick={() => ir(total)}>Ir al repaso</button>}
        </div>
        <div class="ck-barra" style={{ '--pasos': total }} role="progressbar" aria-label="Progreso del check-in" aria-valuemin="0" aria-valuemax={total} aria-valuenow={Math.min(paso + 1, total)}
          aria-valuetext={enRevision ? 'Repaso de las respuestas' : `${paso + 1} de ${total}`}>
          <span style={{ width: `${(Math.min(paso + 1, total) / total) * 100}%` }} />
        </div>
        <p class="sr" aria-live="polite">{anuncio}</p>
        <p class="sr" aria-live="polite">{anuncioRespuesta}</p>
      </div>

      {enviado && (
        <div class="ck-enviado" role="status">
          <span class="ck-enviado-ico" aria-hidden="true"><Icono n="hecho" /></span>
          <span class="pila-xs"><strong>{enviado === 'actualizado' ? 'Check-in actualizado' : '¡Enviado a tu coach!'}</strong><span class="peq secundario">Lo revisa y te contesta aquí abajo si hace falta.</span></span>
        </div>
      )}

      {!enRevision ? (
        <section class="ck-paso panel panel-pad pila" key={actual.id} aria-labelledby="ck-titulo">
          {hayImagen(imagenPasoCheckin(actual.id)) && <Imagen id={imagenPasoCheckin(actual.id)} clase="ck-ilu" tamanos="(min-width: 720px) 640px, 100vw" />}
          {actual.deCoach && <span class="mini terciario ck-de-coach"><Icono n="mensaje" /> Pregunta de tu coach</span>}
          <h2 id="ck-titulo" tabIndex={-1} ref={tituloRef}>{actual.titulo}</h2>
          {actual.cuerpo(avanzarSolo)}
        </section>
      ) : (
        <section class="ck-paso pila" key="revision" aria-labelledby="ck-titulo">
          {hayImagen(imagenPasoCheckin(null, { revision: true, enviado: yaEnviado })) && <Imagen id={imagenPasoCheckin(null, { revision: true, enviado: yaEnviado })} clase="ck-ilu ck-ilu-suelta" tamanos="(min-width: 720px) 640px, 100vw" />}
          <h2 id="ck-titulo" tabIndex={-1} ref={tituloRef}>{yaEnviado ? 'Tus respuestas' : 'Repasa y envía'}</h2>
          <div class="panel">
            <ul class="lista ck-repaso">
              {pasos.map((x, i) => (
                <li key={x.id}>
                  <button type="button" class="ck-repaso-fila" onClick={() => ir(i, true)} aria-label={`Cambiar: ${x.titulo}. ${x.resumen || 'Sin contestar'}`}>
                    <span class="pila-xs"><span class="peq secundario">{x.titulo}</span><span class={x.resumen ? 'ck-resp' : 'ck-resp terciario'}>{x.resumen || 'Sin contestar'}</span></span>
                    <Icono n="editar" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      {error && <div class="error" role="alert">{error}</div>}

      <div class="ck-nav">
        {enRevision ? (
          <button class="btn btn-primario btn-grande btn-ancho" disabled={guardando || datos.cargando}>{guardando ? 'Enviando…' : yaEnviado ? 'Actualizar check-in' : 'Enviar a tu coach'}</button>
        ) : (
          <>
            <button type="button" class="btn btn-grande" disabled={paso === 0} onClick={() => ir(paso - 1)}><Icono n="atras" /> Atrás</button>
            {desdeRepaso
              ? <button type="button" class="btn btn-primario btn-grande" onClick={() => ir(total)}>Volver al repaso</button>
              : <button type="button" class="btn btn-primario btn-grande" onClick={() => ir(paso + 1)}>{paso === total - 1 ? 'Repasar' : 'Siguiente'} <Icono n="derecha" /></button>}
          </>
        )}
      </div>
    </form>
      {yaEnviado && (
        <section class="seccion">
          <div class="seccion-cab"><h2>Comentarios con tu coach</h2>{datos.datos.checkin.revisado_en && <span class="chip ok"><Icono n="hecho" />Revisado</span>}</div>
          <div class="panel panel-pad">
            <Hilo atletaId={atleta.id} checkinId={datos.datos.checkin.id} alLeer={releer} vacio="Tu coach revisa tu check-in y te contesta aquí si hace falta." />
          </div>
        </section>
      )}
    </div>
  );
}
