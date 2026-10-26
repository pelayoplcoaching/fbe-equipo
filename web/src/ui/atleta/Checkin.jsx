import { useEffect, useRef, useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, ErrorCaja, Paso, Segmentos, Icono, Pista } from '../comunes.jsx';
import { Hilo } from '../Hilo.jsx';
import { ESCALAS, HORAS_SUENO, ZONAS, MEDIDAS, num, signo } from '../../logica/calculos.js';
import { semanaCheckin, hoyISO, lunesDe, sumarDias, rangoSemana, fmtCorta, diasEntre } from '../../logica/fechas.js';
import { TEXTO_CONSENTIMIENTO_SALUD } from '../../legal.js';
import { pregunta, limpiarRespuestas, respuestasNoValidas } from '../../logica/preguntas.js';

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

function Escala({ id, etiqueta, frases, valor, alCambiar }) {
  return (
    <div class="campo">
      <span class="etq" id={id}>{etiqueta}</span>
      <Segmentos etiqueta={etiqueta} opciones={escala(frases)} valor={valor} alCambiar={alCambiar} />
      <span class="escala-frase">{valor ? frases[valor - 1] : `1 = ${frases[0].toLowerCase()}; ${frases.length} = ${frases[frases.length - 1].toLowerCase()}`}</span>
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
  // Lo que le pregunta su coach (sin elegir nada, todo)
  const ver = (k) => pregunta({ checkin_apartados: datos.datos?.apartados ?? null }, k);

  useEffect(() => {
    if (!datos.datos) return;
    const c = datos.datos.checkin || {};
    setF({ ...c });
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
    if (!c.calorias_media && salud && ver('reloj')) {
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
        <header class="cabecera"><div class="titulo"><h1>Check-in semanal</h1></div></header>
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
      datos.recargar(true);
      checkinSemana.recargar(true);
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  }

  return (
    <div class="contenido">
    <form class="en-linea" onSubmit={guardar}>
      <header class="cabecera">
        <div class="titulo">
          <h1>Check-in semanal</h1>
          <div class="sub">Semana del {rangoSemana(lunes)}{yaEnviado ? ', enviado' : ''}</div>
        </div>
        <button type="button" class="btn btn-peq" onClick={() => setLunes(lunes === estaSemana ? sumarDias(estaSemana, -7) : estaSemana)}>
          {lunes === estaSemana ? 'Semana pasada' : 'Esta semana'}
        </button>
      </header>
      <Pista id="checkin" icono="checkin">Una vez a la semana, un minuto: cómo has dormido, cómo te has sentido y si te ha dolido algo. Con esto tu coach prepara la semana siguiente. No hace falta rellenarlo todo.</Pista>

      {ver('peso') && <section class="seccion">
        <h2>Peso</h2>
        <div class="panel panel-pad pila">
          <div class="campo">
            <label for="ck-peso">Peso de hoy en ayunas (kg)</label>
            <Paso id="ck-peso" valor={peso ?? (ultimoPeso ? Number(ultimoPeso.kg) : null)} paso={0.1} min={25} max={350} dec={1} etiqueta="peso en kilos" alCambiar={setPeso} />
            <span class="ayuda">
              {ultimoPeso ? `Último registro: ${num(ultimoPeso.kg)} kg el ${ultimoPeso.fecha.slice(8, 10)}/${ultimoPeso.fecha.slice(5, 7)}` : 'Aún no hay pesos registrados.'}
              {peso && ultimoPeso ? ` (${signo(peso - ultimoPeso.kg)} kg)` : ''}
              {!peso && ultimoPeso ? '. Toca − o + o escribe el de hoy para guardarlo.' : ''}
            </span>
          </div>
        </div>
      </section>}

      {ver('descanso') && <section class="seccion">
        <h2>Descanso y motivación</h2>
        <div class="panel panel-pad pila">
          <div class="campo">
            <span class="etq">Horas de sueño por noche</span>
            <Segmentos etiqueta="Horas de sueño" valor={f.horas_sueno ?? null} alCambiar={set('horas_sueno')}
              opciones={HORAS_SUENO.map((h) => [h, h.replace('-', '–')])} />
          </div>
          <Escala id="ck-energia" etiqueta="Energía (cansancio)" frases={ESCALAS.energia} valor={f.energia} alCambiar={set('energia')} />
          <Escala id="ck-recup" etiqueta="Recuperación" frases={ESCALAS.recuperacion} valor={f.recuperacion} alCambiar={set('recuperacion')} />
          <Escala id="ck-motiv" etiqueta="Motivación" frases={ESCALAS.motivacion} valor={f.motivacion} alCambiar={set('motivacion')} />
        </div>
      </section>}

      {ver('molestias') && <section class="seccion">
        <h2>Molestias</h2>
        <div class="panel panel-pad pila">
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
          {!ZONAS.some(([z]) => molestias[z] > 0) && <p class="peq terciario">Sin molestias esta semana.</p>}
          <p class="peq secundario">Si un dolor es agudo o no mejora, avisa a tu coach directamente.</p>
        </div>
      </section>}

      {ver('alimentacion') && <section class="seccion">
        <h2>Alimentación</h2>
        <div class="panel panel-pad pila">
          <p class="peq secundario">¿Qué parte de cada comida seguiste según tu plan?</p>
          {[['adherencia_desayuno', 'Desayuno'], ['adherencia_comida', 'Comida'], ['adherencia_merienda', 'Merienda'], ['adherencia_cena', 'Cena']].map(([k, t]) => (
            <div class="campo" key={k}>
              <span class="etq">{t}</span>
              <Segmentos etiqueta={`Adherencia en ${t}`} valor={f[k] ?? null} alCambiar={set(k)} opciones={ESCALAS.adherencia.map((x, i) => [i + 1, x.replace(' %', '')])} />
            </div>
          ))}
          <Escala id="ck-saciedad" etiqueta="Saciedad" frases={ESCALAS.saciedad} valor={f.saciedad} alCambiar={set('saciedad')} />
          <Escala id="ck-satis" etiqueta="Satisfacción con la dieta" frases={ESCALAS.satisfaccion} valor={f.satisfaccion_dieta} alCambiar={set('satisfaccion_dieta')} />
        </div>
      </section>}

      {ver('medidas') && <section class="seccion">
        <button type="button" class="btn-texto" onClick={() => setVerMedidas(!verMedidas)} aria-expanded={verMedidas}>
          <Icono n={verMedidas ? 'arriba' : 'abajo'} /> Medidas (cada 4 semanas)
        </button>
        {verMedidas && (
          <div class="panel panel-pad pila">
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
          </div>
        )}
      </section>}

      {ver('reloj') && <section class="seccion">
        <button type="button" class="btn-texto" onClick={() => setVerOpcionales(!verOpcionales)} aria-expanded={verOpcionales}>
          <Icono n={verOpcionales ? 'arriba' : 'abajo'} /> Datos de reloj o app (opcionales)
        </button>
        {verOpcionales && (
          <div class="panel panel-pad rejilla-campos">
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
      </section>}

      {(datos.datos.preguntas || []).length > 0 && (
        <section class="seccion">
          <h2>Preguntas de tu coach</h2>
          <div class="panel panel-pad pila">
            {datos.datos.preguntas.map((q) => <RespuestaPregunta key={q.id} p={q} valor={resp[q.id]} alCambiar={(v) => setResp((r) => ({ ...r, [q.id]: v }))} />)}
          </div>
        </section>
      )}

      <div class="campo">
        <label for="ck-notas">Algo más para tu coach</label>
        <textarea id="ck-notas" class="area" value={f.notas || ''} onInput={(e) => set('notas')(e.currentTarget.value)} placeholder="Viajes, cambios de horario, cómo te has sentido…" />
      </div>
      {error && <div class="error" role="alert">{error}</div>}
      <button class="btn btn-primario btn-grande btn-ancho" disabled={guardando || datos.cargando}>{guardando ? 'Enviando…' : yaEnviado ? 'Actualizar check-in' : 'Enviar check-in'}</button>
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
