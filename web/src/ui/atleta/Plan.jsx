// Plan de la semana: qué día piensa hacer el atleta cada sesión (como en TrainingPeaks o Future) y
// «Añadir a mi calendario», que crea los eventos con aviso en el móvil sin necesitar notificaciones.
import { useState } from 'preact/hooks';
import { useApp, Icono, Hoja, Segmentos, usePreferencia, descargar as descargarArchivo } from '../comunes.jsx';
import { diaPrevistoValido, cuandoDia, repartir, calendarioICS, LETRAS_DIA } from '../../logica/plan.js';
import { sumarDias, hoyISO, desdeISO, fmtConDia, rangoSemana } from '../../logica/fechas.js';
import { NOMBRE_TIPO_SESION, NOMBRE_INTENCION } from '../../logica/calculos.js';

const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Guarda el día (o lo quita) pasando por la cola: sin cobertura se envía al volver
export function usePlanificar(alCambiar) {
  const { cola, atleta, aviso } = useApp();
  return async (sesion, dia) => {
    try {
      const r = await cola.enviar({ tipo: 'sesion', datos: { id: sesion.id, cambios: { dia_previsto: dia || null } }, atletaId: atleta.id });
      alCambiar?.({ ...sesion, dia_previsto: dia || null });
      if (r?.enCola) aviso('Sin conexión: el plan se guardará al volver la cobertura');
    } catch (e) { aviso(e.message, 'error'); }
  };
}

// Tira de la semana: siete días con lo previsto en cada uno
export function TiraSemana({ semana, sesiones, hoy = hoyISO(), alTocar }) {
  if (!semana?.fecha_inicio) return null;
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(semana.fecha_inicio, i));
  return (
    <div class="tira-semana" role="list" aria-label={`Plan de la semana del ${rangoSemana(semana.fecha_inicio)}`}>
      {dias.map((d, i) => {
        const delDia = sesiones.filter((s) => (s.completada ? s.fecha_realizada === d : diaPrevistoValido(s, semana) === d));
        const texto = delDia.length ? delDia.map((s) => `${s.nombre}${s.completada ? ' (hecha)' : ''}`).join(', ') : 'descanso';
        return (
          <div role="listitem" key={d} class={`tira-dia ${d === hoy ? 'hoy' : ''} ${d < hoy ? 'pasado' : ''}`} aria-label={`${NOMBRES_DIA[i]} ${desdeISO(d).getDate()}: ${texto}`}>
            <span class="tira-letra" aria-hidden="true">{LETRAS_DIA[i]}</span>
            <span class="tira-num num" aria-hidden="true">{desdeISO(d).getDate()}</span>
            <span class="tira-ses">
              {delDia.map((s) => {
                const sigla = s.completada ? <Icono n="hecho" /> : s.nombre.split(' ').map((p) => p[0]).join('').slice(0, 3);
                // Las pendientes se pueden tocar (y alcanzar con el teclado) para cambiarles el día
                return alTocar && !s.completada
                  ? <button type="button" key={s.id} class="tira-chip" aria-label={`Cambiar el día de ${s.nombre}`} onClick={() => alTocar(s)}>{sigla}</button>
                  : <span key={s.id} class={`tira-chip ${s.completada ? 'hecha' : ''}`} aria-hidden="true">{sigla}</span>;
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// El plan editable: la tira y, debajo, cada sesión con su día
// soloTira: la tira, las sesiones sin día y las acciones (en Semana, donde debajo ya está la lista de sesiones)
export function PlanSemana({ semana, sesiones, alCambiar, compacto = false, soloTira = false }) {
  const [eligiendo, setEligiendo] = useState(null);
  const [calendario, setCalendario] = useState(false);
  const planificar = usePlanificar(alCambiar);
  const hoy = hoyISO();
  const pendientes = sesiones.filter((s) => !s.completada);
  const sinDia = pendientes.filter((s) => !diaPrevistoValido(s, semana));
  const conDia = pendientes.filter((s) => diaPrevistoValido(s, semana));
  const propuesta = repartir(sesiones, semana, hoy);
  const fin = semana?.fecha_inicio ? sumarDias(semana.fecha_inicio, 6) : null;
  if (!semana?.fecha_inicio || (fin && fin < hoy)) return null;
  return (
    <div class="panel panel-pad pila plan-semana">
      <TiraSemana semana={semana} sesiones={sesiones} hoy={hoy} alTocar={(s) => setEligiendo(s)} />
      {soloTira ? (
        sinDia.length > 0 && (
          <div class="plan-sin-dia">
            <span class="peq secundario">Sin día:</span>
            {sinDia.map((s) => <button key={s.id} class="btn btn-peq plano sin-dia" onClick={() => setEligiendo(s)} aria-label={`Elegir el día de ${s.nombre}`}><Icono n="calendario" />{s.nombre}</button>)}
          </div>
        )
      ) : (
      <ul class="plan-lista">
        {sesiones.map((s) => {
          const d = diaPrevistoValido(s, semana);
          return (
            <li key={s.id} class={s.completada ? 'hecha' : ''}>
              <span class="pila-xs">
                <span class="nombre">{s.nombre}</span>
                <span class="mini terciario">{s.completada ? `Hecha ${cuandoDia(s.fecha_realizada, hoy)}` : s.tipo && s.tipo !== 'fuerza' ? NOMBRE_TIPO_SESION[s.tipo] : NOMBRE_INTENCION[s.intencion] || 'Pendiente'}</span>
              </span>
              {s.completada ? <span class="chip ok"><Icono n="hecho" />Hecha</span> : (
                <button class={`btn btn-peq ${d ? '' : 'plano sin-dia'}`} onClick={() => setEligiendo(s)} aria-label={d ? `${s.nombre}: prevista ${cuandoDia(d, hoy)}. Cambiar el día` : `Elegir el día de ${s.nombre}`}>
                  <Icono n="calendario" />{d ? cuandoDia(d, hoy).replace(/^el /, '').replace(/^./, (c) => c.toUpperCase()) : 'Elegir día'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      )}
      <div class="fila-envolver">
        {sinDia.length > 0 && Object.keys(propuesta).length > 0 && (
          <button class="btn btn-peq" onClick={async () => { for (const s of sinDia) if (propuesta[s.id]) await planificar(s, propuesta[s.id]); }}>
            <Icono n="rayo" /> Repartir por mí
          </button>
        )}
        {conDia.length > 0 && <button class="btn btn-peq" onClick={() => setCalendario(true)}><Icono n="calendario" /> Añadir a mi calendario</button>}
      </div>
      {!compacto && (conDia.length > 0
        ? <p class="mini terciario">Toca una sesión de la tira para cambiarle el día.</p>
        : sinDia.length > 0 && <p class="peq secundario">Elige qué día harás cada sesión: Hoy te dirá qué toca y cuándo descansas.</p>)}
      {eligiendo && <HojaDia sesion={eligiendo} semana={semana} sesiones={sesiones} alCerrar={() => setEligiendo(null)}
        alElegir={async (d) => { const s = eligiendo; setEligiendo(null); await planificar(s, d); }} />}
      {calendario && <HojaCalendario semana={semana} sesiones={conDia} alCerrar={() => setCalendario(false)} />}
    </div>
  );
}

function HojaDia({ sesion, semana, sesiones, alCerrar, alElegir }) {
  const hoy = hoyISO();
  const actual = diaPrevistoValido(sesion, semana);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(semana.fecha_inicio, i));
  return (
    <Hoja titulo={`¿Qué día harás ${sesion.nombre}?`} alCerrar={alCerrar}>
      <div class="elegir-dia" role="group" aria-label="Día de la semana">
        {dias.map((d, i) => {
          const otras = sesiones.filter((s) => s.id !== sesion.id && (s.completada ? s.fecha_realizada === d : diaPrevistoValido(s, semana) === d));
          return (
            <button key={d} type="button" aria-pressed={actual === d ? 'true' : 'false'} class={`${d === hoy ? 'hoy' : ''} ${d < hoy ? 'pasado' : ''}`} onClick={() => alElegir(d)}>
              <span class="dia-nombre">{NOMBRES_DIA[i]}{d === hoy ? ', hoy' : ''}</span>
              <span class="num dia-fecha">{desdeISO(d).getDate()}</span>
              <span class="mini terciario">{otras.length ? otras.map((s) => s.nombre).join(', ') : ''}</span>
            </button>
          );
        })}
      </div>
      {actual && <button class="btn plano" onClick={() => alElegir(null)}>Sin día fijo</button>}
    </Hoja>
  );
}

// Descarga un .ics con las sesiones previstas: el móvil lo abre en su calendario y avisa a la hora elegida
function HojaCalendario({ semana, sesiones, alCerrar }) {
  const { modo } = useApp();
  const [hora, setHora] = usePreferencia('fbe-plan-hora', '18:00');
  const [aviso, setAviso] = usePreferencia('fbe-plan-aviso', 30);
  const [minutos, setMinutos] = usePreferencia('fbe-plan-minutos', 75);
  const ics = () => calendarioICS(sesiones.map((s) => ({ id: s.id, dia: diaPrevistoValido(s, semana), nombre: s.nombre, descripcion: s.dinamica || '' })),
    { hora, minutos, avisoMin: aviso, url: typeof location !== 'undefined' ? location.origin + location.pathname : '' });
  const descargar = () => {
    descargarArchivo(`entrenos-${semana.fecha_inicio}.ics`, ics(), 'text/calendar;charset=utf-8');
  };
  return (
    <Hoja titulo="Añadir a mi calendario" alCerrar={alCerrar}>
      <p class="peq secundario">Se crea un evento por sesión ({sesiones.map((s) => `${s.nombre}, ${fmtConDia(diaPrevistoValido(s, semana))}`).join('; ')}) con un aviso antes. Si cambias el plan, vuelve a añadirlo (si tu calendario lo duplica, borra el evento antiguo).</p>
      <div class="campo">
        <label for="plan-hora">Hora a la que sueles entrenar</label>
        <input id="plan-hora" class="entrada" type="time" value={hora} onInput={(e) => setHora(e.currentTarget.value || '18:00')} />
      </div>
      <div class="campo">
        <span class="etq" id="plan-dur">Duración</span>
        <Segmentos etiqueta="Duración" valor={minutos} alCambiar={(v) => setMinutos(v ?? 75)} opciones={[[45, '45 min'], [60, '1 h'], [75, '1 h 15'], [90, '1 h 30']]} />
      </div>
      <div class="campo">
        <span class="etq">Aviso</span>
        <Segmentos etiqueta="Aviso" valor={aviso} alCambiar={(v) => setAviso(v ?? 30)} opciones={[[15, '15 min antes'], [30, '30 min'], [60, '1 h'], [120, '2 h']]} />
      </div>
      <button class="btn btn-primario btn-grande" onClick={descargar}><Icono n="calendario" /> Descargar el calendario</button>
      <p class="mini terciario">{modo === 'demo' ? 'En la demo, el navegador puede bloquear la descarga. ' : ''}En el iPhone se abre en Calendario: toca «Añadir todo». En Android, ábrelo con Google Calendar.</p>
    </Hoja>
  );
}
