// FBE Esencial con nutrición (v0.252, migración 105): el cuestionario de nutrición por pasos y el plan que sale de él, con
// el motor de nutrición (logica/nutricion-motor.js: reglas R3-R25 del documento «claude/nutricion-motor-reglas.md»; el
// flujo, en logica/nutricion-cuestionario.js). En su propio trozo: lo abre «Tu plan de comida» (EsencialComida.jsx) cuando
// la base tiene la 105; sin ella, la hoja de la 093. Las preguntas de salud nuevas (exclusiones y SCOFF) solo salen con
// «salud_comida» encendido (APAGADO: pendientes del visto bueno de Pelayo); mientras, la pregunta de TCA de siempre, el
// embarazo de su cuestionario de entreno y lo de salud que ya contestó. Estilos: nutricion-motor.css (clases nm-*).
import { useState, useEffect, useMemo } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Paso, Segmentos } from '../comunes.jsx';
import { TarjetaPlan } from '../NutricionComun.jsx';
import { planMotor, metaPeso, rfm, OBJETIVOS, TRABAJOS, PASOS, FORMAS_DE_COMER, COCINA, COME_FUERA, SCOFF, EXCLUSIONES, SUELO_KCAL } from '../../logica/nutricion-motor.js';
import { pasosNutricion, inicialNutricion, faltaEnPaso, exclusionNutricion, soloMantener, datosParaMotor, paraEnviar, ritmosPerder, cambioDePlan, textoMeta,
  saludPara, EXPERIENCIAS, METODOS_GRASA } from '../../logica/nutricion-cuestionario.js';
import { fmtKcal } from '../../logica/nutricion.js';
import { hoyISO } from '../../logica/fechas.js';
import { encendido } from '../../logica/esencial-respuestas.js';
import * as nut from '../../datos/api-nutricion.js';

const previaDemo = (modo) => { try { return modo === 'demo' && /[?&]previa=1(&|$)/.test(location.search); } catch { return false; } };
const coma = (x, d = 2) => String(Math.round(Math.abs(x) * 10 ** d) / 10 ** d).replace('.', ',');
// Lo que lleva contestado, en memoria mientras dura la sesión: si cierra la hoja a medias, sigue donde lo dejó
let borrador = null;
const AYUDA_OBJETIVO = {
  perder: 'Bajar grasa sin perder músculo: comes algo menos de lo que gastas.',
  mantener: 'Tu mismo peso: con el entreno, más músculo y menos grasa poco a poco.',
  ganar: 'Subir de peso poco a poco para ganar músculo: comes algo más de lo que gastas.',
};

// Lo común: su perfil, su cuestionario de entreno y sus medidas (para rellenar lo que ya se sabe)
function useDatosNutricion() {
  const { api, backend, atleta } = useApp();
  return useCarga(async () => {
    const [perfil, cuestionario, medidas] = await Promise.all([
      nut.perfil(backend, atleta.id).catch(() => null),
      api.cuestionario(atleta.id).catch(() => null),
      api.medidas(atleta.id).catch(() => []),
    ]);
    return { perfil, cuestionario, medidas: medidas || [] };
  }, [atleta.id]);
}

// En Hoy, sin plan: la tarjeta para prepararlo (o, si la app no lo calcula en su caso, por qué)
export function TarjetaNutricionMotor({ pesoKg = null, alGuardar }) {
  const { modo } = useApp();
  const [abierta, setAbierta] = useState(false);
  const datos = useDatosNutricion();
  const conSalud = encendido('salud_comida', previaDemo(modo));
  const x = datos.datos;
  // (lo que ya contestó y lo de su cuestionario de entreno: con una exclusión, no hay plan que preparar)
  const motivo = x && x.cuestionario ? exclusionNutricion({ ...inicialNutricion({ ...x, pesoKg, hoy: hoyISO() }), excl: null }, { conSalud: false, cuestionario: x.cuestionario }) : null;
  return (
    <section class="seccion seccion-nutricion">
      <div class="seccion-cab"><h2>Tu plan de comida</h2></div>
      {motivo ? (
        <div class="nm-excl" role="status">
          <strong class="peq nm-excl-t"><Icono n="alerta" width="18" height="18" /><span>En tu caso, la app no calcula tu plan de comida</span></strong>
          <span class="peq">{EXCLUSIONES.find(([k]) => k === motivo)?.[1]} Lo que te conviene comer tiene que pautarlo un profesional: tu médico o un dietista-nutricionista.</span>
          <button class="btn btn-peq" onClick={() => setAbierta(true)}><Icono n="editar" /> Volver a contestar</button>
        </div>
      ) : (
        <div class="panel panel-pad pila-s">
          <p class="peq">Contesta unas preguntas (unos tres minutos) y la app te calcula tus calorías, tu proteína, tus hidratos y tu grasa. Cada 4 semanas lo revisa con lo que lo hayas seguido, tu peso y tu cintura.</p>
          <button class="btn btn-primario" onClick={() => setAbierta(true)}><Icono n="nutricion" /> Preparar mi plan</button>
        </div>
      )}
      {abierta && <HojaNutricionMotor pesoKg={pesoKg} conSalud={conSalud} alCerrar={() => { setAbierta(false); datos.recargar(true); }} alGuardar={() => { setAbierta(false); alGuardar?.(); }} />}
    </section>
  );
}

// La hoja del cuestionario (también para rehacerlo: actual, su plan de ahora)
export function HojaNutricionMotor({ pesoKg = null, actual = null, conSalud: conSaludProp = null, alCerrar, alGuardar }) {
  const { modo } = useApp();
  const datos = useDatosNutricion();
  const conSalud = conSaludProp ?? encendido('salud_comida', previaDemo(modo));
  if (!datos.datos) {
    return (
      <Hoja titulo="Tu plan de comida" alCerrar={alCerrar}>
        <p class="peq secundario" role="status">{datos.error ? 'No se han podido cargar tus datos: inténtalo de nuevo en un momento.' : 'Preparando tus preguntas…'}</p>
      </Hoja>
    );
  }
  return <Cuestionario datos={datos.datos} conSalud={conSalud} pesoKg={pesoKg} actual={actual} alCerrar={alCerrar} alGuardar={alGuardar} />;
}

function Cuestionario({ datos, conSalud, pesoKg, actual, alCerrar, alGuardar }) {
  const { backend, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const opts = { conSalud, cuestionario: datos.cuestionario };
  const pasos = pasosNutricion(conSalud);
  const sigue = borrador && borrador.atletaId === atleta.id && borrador.conSalud === conSalud ? borrador : null;
  const [d, setD] = useState(() => sigue?.d || inicialNutricion({ ...datos, pesoKg, hoy }));
  const [paso, setPaso] = useState(() => (sigue ? Math.min(sigue.paso, pasos.length - 1) : 0));
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [fin, setFin] = useState(null);   // { motivo } sin plan automático
  const [clave, titulo] = pasos[paso];
  const ultimo = clave === 'plan';
  const solo = soloMantener(d, opts);
  useEffect(() => { borrador = fin ? null : { atletaId: atleta.id, conSalud, d, paso }; }, [d, paso, fin]);
  // (al cambiar de paso, el título arriba y con el foco: la hoja vuelve al principio)
  const [movido, setMovido] = useState(false);
  useEffect(() => { if (movido) document.getElementById('nm-titulo')?.focus(); }, [paso]);
  const cambiar = (x) => { setD((y) => ({ ...y, ...x })); setError(null); };
  const ir = (n) => { setMovido(true); setError(null); setPaso(n); };
  const plan = useMemo(() => (ultimo ? planMotor(datosParaMotor(d, opts)) : null), [ultimo, d]);

  async function mandar(basico) {
    setOcupado(true);
    try {
      const r = await nut.planMotor(backend, paraEnviar(d, { ...opts, basico }));
      if (r?.falta105) { setError('Falta poner al día la base de la app: inténtalo más tarde.'); return; }
      if (r && r.automatico === false) { setFin({ motivo: r.motivo }); return; }
      if (basico) return;
      borrador = null;
      aviso('Tu plan de comida está listo');
      alGuardar?.();
    } catch (e) { setError(e.message); } finally { setOcupado(false); }
  }
  async function siguiente(ev) {
    ev.preventDefault();
    const m = faltaEnPaso(clave, d, opts);
    if (m) { setError(m); return; }
    // (R35) con una exclusión, el cuestionario para aquí: se guarda lo básico y su salud, sin plan
    if (clave === 'salud' && exclusionNutricion(d, opts)) { await mandar(true); return; }
    if (ultimo) { await mandar(false); return; }
    ir(paso + 1);
  }

  if (fin) {
    const otras = (datos.cuestionario?.otras || []).includes('embarazo');
    return (
      <Hoja titulo="Tu plan de comida" alCerrar={alCerrar}>
        <div class="pila">
          <div class="nm-excl" role="status">
            <strong class="peq nm-excl-t"><Icono n="alerta" width="18" height="18" /><span>En tu caso, la app no calcula tu plan de comida</span></strong>
            <span class="peq">{EXCLUSIONES.find(([k]) => k === fin.motivo)?.[1]} Lo que te conviene comer tiene que pautarlo un profesional: tu médico o un dietista-nutricionista.</span>
            {fin.motivo === 'embarazo' && otras && <span class="mini secundario">Si ya no estás embarazada, cámbialo en tu cuestionario (en Perfil) y vuelve a contestar.</span>}
          </div>
          <button class="btn btn-primario btn-grande" onClick={alCerrar}>Entendido</button>
        </div>
      </Hoja>
    );
  }

  return (
    <Hoja titulo="Tu plan de comida" alCerrar={alCerrar}>
      <form class="pila" onSubmit={siguiente} noValidate>
        <div class="pila-s">
          <div class="separa"><strong id="nm-titulo" tabIndex={-1}>{titulo}</strong><span class="peq secundario num">Paso {paso + 1} de {pasos.length}</span></div>
          <div class="progreso-barra" role="img" aria-label={`Paso ${paso + 1} de ${pasos.length}`}><span style={{ width: `${((paso + 1) / pasos.length) * 100}%` }} /></div>
        </div>

        {clave === 'tu' && (
          <>
            <div class="campo"><span class="etq">Sexo</span>
              <Segmentos etiqueta="Sexo" valor={d.sexo} opciones={[['mujer', 'Mujer'], ['hombre', 'Hombre']]} alCambiar={(v) => v && cambiar({ sexo: v })} />
              <span class="ayuda">Lo usa la fórmula de lo que gastas en reposo (Mifflin-St Jeor).</span></div>
            <div class="rejilla-campos">
              <div class="campo"><label for="nm-edad">Edad</label><Paso id="nm-edad" valor={d.edad} paso={1} min={18} max={90} dec={0} etiqueta="años" alCambiar={(v) => cambiar({ edad: v })} /></div>
              <div class="campo"><label for="nm-altura">Altura (cm)</label><Paso id="nm-altura" valor={d.altura} paso={1} min={130} max={220} dec={0} etiqueta="centímetros" alCambiar={(v) => cambiar({ altura: v })} /></div>
              <div class="campo"><label for="nm-peso">Peso (kg)</label><Paso id="nm-peso" valor={d.peso} paso={0.5} min={35} max={250} dec={1} etiqueta="kilos" alCambiar={(v) => cambiar({ peso: v })} /></div>
            </div>
            <span class="ayuda">Mejor el peso de esta mañana, en ayunas.</span>
          </>
        )}

        {clave === 'salud' && (
          <>
            <div class="campo"><span class="etq">¿Tienes o has tenido un trastorno de la conducta alimentaria?</span>
              <Segmentos etiqueta="Trastorno de la conducta alimentaria" valor={d.tca == null ? null : d.tca ? 'si' : 'no'} opciones={[['no', 'No'], ['si', 'Sí']]} alCambiar={(v) => v && cambiar({ tca: v === 'si' })} />
              <span class="ayuda">Anorexia, bulimia, atracones u otro. Si es que sí, tu plan será para mantener tu peso y nunca bajará solo: háblalo con tu médico. Es un dato de salud: solo lo veis tú y Pelayo.</span></div>
            {conSalud && (
              <div class="campo"><span class="etq" id="nm-excl">¿Te pasa algo de esto?</span>
                <div class="opciones" role="group" aria-labelledby="nm-excl">
                  {saludPara(d.sexo).map(([k, t]) => {
                    const sel = (d.excl || []).includes(k);
                    return <button type="button" key={k} aria-pressed={sel ? 'true' : 'false'} onClick={() => cambiar({ excl: sel ? (d.excl || []).filter((x) => x !== k) : [...(d.excl || []), k] })}>{t}</button>;
                  })}
                  <button type="button" aria-pressed={Array.isArray(d.excl) && !d.excl.length ? 'true' : 'false'} onClick={() => cambiar({ excl: [] })}>Ninguna de estas</button>
                </div>
                <span class="ayuda">Con cualquiera de ellas, la app no calcula tu plan: lo que te conviene comer tiene que pautarlo un profesional. Son datos de salud: solo los veis tú y Pelayo.</span></div>
            )}
          </>
        )}

        {clave === 'scoff' && (
          <>
            <p class="peq secundario">Cinco preguntas sobre cómo te llevas con la comida. Son las del cuestionario SCOFF, el que usan los médicos para detectar a tiempo un trastorno de la conducta alimentaria. Contesta con sinceridad: solo lo veis tú y Pelayo.</p>
            <div class="nm-scoff">
              {SCOFF.map(([k, q]) => (
                <div key={k} class="nm-scoff-f">
                  <span class="peq nm-scoff-q">{q}</span>
                  <Segmentos etiqueta={q} valor={d.scoff?.[k] == null ? null : d.scoff[k] ? 'si' : 'no'} opciones={[['no', 'No'], ['si', 'Sí']]}
                    alCambiar={(v) => v && cambiar({ scoff: { ...d.scoff, [k]: v === 'si' } })} />
                </div>
              ))}
            </div>
          </>
        )}

        {clave === 'medidas' && (
          <>
            <div class="nm-como">
              <svg class="nm-dib" viewBox="0 0 60 82" role="img" aria-label="Dónde medir: la cintura, a la altura del ombligo; la cadera, por la parte más ancha de los glúteos">
                <path class="nm-dib-cuerpo" stroke-width="1.5" d="M14 4 Q30 0 46 4 L44 30 Q41 42 42 50 Q48 62 47 78 L13 78 Q12 62 18 50 Q19 42 16 30 Z" />
                <circle class="nm-dib-cintura" cx="30" cy="46" r="1.4" stroke-width="1.5" />
                <line class="nm-dib-cintura" x1="4" y1="46" x2="56" y2="46" stroke-width="2" stroke-dasharray="4 3" />
                <line class="nm-dib-cadera" x1="4" y1="64" x2="56" y2="64" stroke-width="2" stroke-dasharray="4 3" />
              </svg>
              <div class="nm-como-l" role="list">
                <span role="listitem" class="peq nm-como-i">Por la mañana, en ayunas y después de orinar.</span>
                <span role="listitem" class="peq nm-como-i">De pie y relajado, con la cinta horizontal, ceñida sin apretar.</span>
                <span role="listitem" class="peq nm-como-i"><span class="nm-como-c">La cintura</span>, a la altura del ombligo, al final de soltar el aire.</span>
                <span role="listitem" class="peq nm-como-i"><span class="nm-como-k">La cadera</span>, por la parte más ancha de los glúteos.</span>
              </div>
            </div>
            <div class="rejilla-campos">
              <div class="campo"><label for="nm-cintura">Cintura (cm)</label><Paso id="nm-cintura" valor={d.cintura} paso={0.5} min={45} max={200} dec={1} etiqueta="centímetros" alCambiar={(v) => cambiar({ cintura: v })} /></div>
              <div class="campo"><label for="nm-cadera">Cadera (cm, opcional)</label><Paso id="nm-cadera" valor={d.cadera} paso={0.5} min={50} max={200} dec={1} etiqueta="centímetros" alCambiar={(v) => cambiar({ cadera: v })} /></div>
            </div>
            <span class="ayuda">Con tu cintura, la app sabe si pierdes grasa aunque tu peso no se mueva.</span>
            <details class="nm-grasa" open={!!d.composicionMetodo}>
              <summary class="peq nm-grasa-s">¿Te han medido la grasa corporal? (opcional)</summary>
              <div class="pila-s">
                <Segmentos etiqueta="Cómo te la midieron" valor={d.composicionMetodo} opciones={METODOS_GRASA} alCambiar={(v) => cambiar({ composicionMetodo: v || null })} />
                {d.composicionMetodo && (
                  <div class="rejilla-campos">
                    <div class="campo"><label for="nm-grasa">Grasa (%)</label><Paso id="nm-grasa" valor={d.composicionGrasa} paso={0.5} min={3} max={70} dec={1} etiqueta="por ciento" alCambiar={(v) => cambiar({ composicionGrasa: v })} /></div>
                    {d.composicionMetodo === 'dexa' && <div class="campo"><label for="nm-magra">Masa magra (kg)</label><Paso id="nm-magra" valor={d.masaMagraDexa} paso={0.5} min={20} max={200} dec={1} etiqueta="kilos" alCambiar={(v) => cambiar({ masaMagraDexa: v })} /></div>}
                  </div>
                )}
                <span class="ayuda">{d.composicionMetodo === 'dexa' ? 'Con la masa magra de un DEXA, la app calcula lo que gastas con ella (fórmula de Cunningham), que es más fino.' : 'Se guarda para ver cómo cambia. Para el cálculo, la app usa tu peso y tu cintura.'}</span>
              </div>
            </details>
          </>
        )}

        {clave === 'dia' && (
          <>
            <div class="campo"><span class="etq" id="nm-trabajo">¿Cómo es tu trabajo (o tu día)?</span>
              <div class="opciones" role="group" aria-labelledby="nm-trabajo">
                {TRABAJOS.map(([k, t]) => <button type="button" key={k} aria-pressed={d.trabajo === k ? 'true' : 'false'} onClick={() => cambiar({ trabajo: k })}>{t}</button>)}
              </div></div>
            <div class="campo"><span class="etq" id="nm-pasos">¿Cuántos pasos das al día?</span>
              <div class="opciones" role="group" aria-labelledby="nm-pasos">
                {PASOS.map(([k, t]) => <button type="button" key={k} aria-pressed={d.pasos === k ? 'true' : 'false'} onClick={() => cambiar({ pasos: k })}>{t}</button>)}
              </div>
              <span class="ayuda">La media de una semana normal: la ves en el móvil o en el reloj. Si no lo sabes, elige la que más se parezca.</span></div>
            <div class="campo"><label for="nm-dias">Días que entrenas a la semana</label><Paso id="nm-dias" valor={d.diasEntreno} paso={1} min={0} max={7} dec={0} etiqueta="días" alCambiar={(v) => cambiar({ diasEntreno: v })} />
              <span class="ayuda">Los de tu plan. Si haces otro deporte con regularidad, súmalo.</span></div>
          </>
        )}

        {clave === 'objetivo' && (solo ? (
          <p class="nota peq">Tu plan será para mantener tu peso, sin déficit, y la app nunca lo bajará sola. Si quieres cambiar tu peso, háblalo antes con tu médico.</p>
        ) : (
          <>
            <div class="campo"><span class="etq" id="nm-obj">¿Qué quieres conseguir?</span>
              <div class="opciones" role="group" aria-labelledby="nm-obj">
                {OBJETIVOS.map(([k, t]) => <button type="button" key={k} aria-pressed={d.objetivo === k ? 'true' : 'false'} onClick={() => cambiar({ objetivo: k, ...(k === 'mantener' && d.meta === 'peso' ? { meta: null } : {}) })}>{t}</button>)}
              </div>
              {d.objetivo && <span class="ayuda">{AYUDA_OBJETIVO[d.objetivo]}</span>}</div>
            {d.objetivo === 'perder' && (
              <div class="campo"><span class="etq" id="nm-ritmo">¿A qué ritmo?</span>
                <div class="opciones" role="group" aria-labelledby="nm-ritmo">
                  {ritmosPerder(d).map(({ r, gramos, recomendado }) => (
                    <button type="button" key={r} aria-pressed={Number(d.ritmo) === r ? 'true' : 'false'} onClick={() => cambiar({ ritmo: r })}>
                      Un {coma(r)} % de tu peso a la semana{gramos ? `, unos ${gramos} g` : ''}{recomendado ? ' (recomendado)' : ''}
                    </button>
                  ))}
                </div>
                <span class="ayuda">Más deprisa cuesta más músculo y más hambre. La app nunca te baja de {fmtKcal(SUELO_KCAL[d.sexo] || SUELO_KCAL.hombre)} kcal al día ni más de un 25 % por debajo de lo que gastas.</span></div>
            )}
            {d.objetivo === 'ganar' && (
              <div class="campo"><span class="etq" id="nm-exp">¿Cuánto tiempo llevas entrenando fuerza?</span>
                <div class="opciones" role="group" aria-labelledby="nm-exp">
                  {EXPERIENCIAS.map(([k, t]) => <button type="button" key={k} aria-pressed={d.experiencia === k ? 'true' : 'false'} onClick={() => cambiar({ experiencia: k })}>{t}</button>)}
                </div>
                <span class="ayuda">Cuanto más tiempo llevas, más despacio se gana músculo: la app te sube el peso más despacio para que ganes menos grasa.</span></div>
            )}
            {d.objetivo && (
              <div class="campo"><span class="etq">¿Una meta? <span class="terciario">(opcional)</span></span>
                <Segmentos etiqueta="Tu meta" valor={d.meta || 'no'} opciones={[['no', 'Sin meta'], ...(d.objetivo !== 'mantener' ? [['peso', 'Un peso']] : []), ['cintura', 'Una cintura']]}
                  alCambiar={(v) => v && cambiar({ meta: v === 'no' ? null : v })} />
                {d.meta === 'peso' && <Paso id="nm-meta-peso" valor={d.metaPeso} paso={0.5} min={35} max={250} dec={1} etiqueta="kilos" alCambiar={(v) => cambiar({ metaPeso: v })} />}
                {d.meta === 'cintura' && <Paso id="nm-meta-cintura" valor={d.metaCintura} paso={0.5} min={45} max={200} dec={1} etiqueta="centímetros" alCambiar={(v) => cambiar({ metaCintura: v })} />}
                <span class="ayuda">Sin fecha: la app te dice cuántas semanas son a tu ritmo.</span></div>
            )}
          </>
        ))}

        {clave === 'comer' && (
          <>
            <div class="campo"><span class="etq">¿Cuántas comidas haces al día?</span>
              <Segmentos etiqueta="Comidas al día" valor={d.tomas} opciones={[[3, '3'], [4, '4'], [5, '5']]} alCambiar={(v) => v && cambiar({ tomas: v })} />
              <span class="ayuda">Cuenta las principales y las de entre horas.</span></div>
            <div class="campo"><span class="etq" id="nm-forma">¿Cómo comes?</span>
              <div class="opciones" role="group" aria-labelledby="nm-forma">
                {FORMAS_DE_COMER.map(([k, t]) => <button type="button" key={k} aria-pressed={d.formaComer === k ? 'true' : 'false'} onClick={() => cambiar({ formaComer: k })}>{t}</button>)}
              </div></div>
            <div class="campo"><span class="etq">¿Cuánto cocinas?</span>
              <Segmentos etiqueta="Cuánto cocinas" valor={d.cocina} opciones={COCINA} alCambiar={(v) => cambiar({ cocina: v || null })} /></div>
            <div class="campo"><span class="etq">¿Comes fuera entre semana?</span>
              <Segmentos etiqueta="Comes fuera entre semana" valor={d.comeFuera} opciones={COME_FUERA} alCambiar={(v) => cambiar({ comeFuera: v || null })} /></div>
            <div class="campo"><label for="nm-bebidas">Bebidas con alcohol a la semana</label><Paso id="nm-bebidas" valor={d.bebidasSemana} paso={1} min={0} max={70} dec={0} etiqueta="bebidas" alCambiar={(v) => cambiar({ bebidasSemana: v })} />
              <span class="ayuda">Una caña, una copa de vino o un combinado cuentan como una. Van dentro de tus calorías: unas 100 cada una.</span></div>
            <div class="campo"><span class="etq">¿Prefieres comer pocos hidratos?</span>
              <Segmentos etiqueta="Pocos hidratos" valor={d.pocosHidratos ? 'si' : 'no'} opciones={[['no', 'No'], ['si', 'Sí']]} alCambiar={(v) => v && cambiar({ pocosHidratos: v === 'si' })} />
              <span class="ayuda">Si es que sí, la app no te pide un mínimo de 130 g de hidratos al día.</span></div>
          </>
        )}

        {ultimo && plan?.automatico && <TuPlan plan={plan} d={d} actual={actual} hoy={hoy} />}

        {error && <div class="error" role="alert">{error}</div>}
        <div class="fila-botones">
          {paso > 0 && <button type="button" class="btn" onClick={() => ir(paso - 1)}><Icono n="atras" /> Atrás</button>}
          <button class="btn btn-primario btn-grande" disabled={ocupado}>{ocupado ? 'Guardando…' : ultimo ? 'Guardar mi plan' : 'Siguiente'}</button>
        </div>
      </form>
    </Hoja>
  );
}

// El último paso: su plan, por qué, su meta y lo que viene
function TuPlan({ plan, d, actual, hoy }) {
  const m = !plan.soloMantener && d.meta === 'peso' ? metaPeso({ peso: d.peso, meta: d.metaPeso, altura: d.altura, ritmo: plan.ritmo_pct }) : null;
  const tm = textoMeta(m, { meta: d.metaPeso, peso: d.peso });
  const grasa = plan.soloMantener ? null : rfm(d);
  const cambio = cambioDePlan(actual, plan);
  return (
    <div class="pila" aria-live="polite">
      <TarjetaPlan plan={{ desde: hoy, fase: plan.objetivo, ritmo_pct: plan.ritmo_pct, modo: 'macros', kcal: plan.kcal, proteina_g: plan.proteina_g, carbos_g: plan.carbos_g, grasa_g: plan.grasa_g, fibra_g: plan.fibra_g }} />
      {cambio && <p class="peq nota">{cambio}</p>}
      <section class="pila-s" aria-labelledby="nm-porque-t">
        <strong id="nm-porque-t" class="peq">Por qué</strong>
        <div class="nm-porque" role="list">{plan.porque.map((x) => <span key={x} role="listitem" class="peq nm-porque-l">{x}</span>)}</div>
        {grasa != null && <p class="mini secundario">Tu grasa corporal estimada con tu cintura y tu altura (RFM, una estimación): un {String(grasa).replace('.', ',')} %.</p>}
      </section>
      {tm && <p class={m?.aviso ? 'peq nm-meta-aviso' : 'peq nm-meta'}><Icono n={m?.aviso ? 'alerta' : 'diana'} width="18" height="18" /><span>{tm}</span></p>}
      <div class="nm-sigue">
        <strong class="peq">Lo que viene</strong>
        <span class="peq">Cada día, en Hoy, un toque: «¿Has seguido tu plan?» (sí, casi o no). Si quieres, apunta también lo que comes.</span>
        {plan.soloMantener
          ? <span class="peq">Tu plan es para mantener tu peso: la app no lo baja nunca y no te pide que te peses.</span>
          : <span class="peq">Pésate tres o cuatro mañanas a la semana. Cada 4 semanas, si has seguido el plan al menos 20 días, la app lo revisa: si no avanzas, lo ajusta un poco (como mucho 250 kcal); si vas bien, lo deja igual.</span>}
      </div>
    </div>
  );
}
