import { useState } from 'preact/hooks';
import { Hoja, Icono, Anillo } from './comunes.jsx';
import { MapaMuscular } from './MapaMuscular.jsx';
import { HojaCompartir } from './Compartir.jsx';
import { rangoLargo } from './atleta/TuSemana.jsx';
import { num, signo, NOMBRE_FOCO } from '../logica/calculos.js';

// Informe de un bloque: lo que se hizo de lo pautado, cómo subió la fuerza estimada de los ejercicios
// principales, semana a semana, músculos, récords y (con consentimiento) el peso. Lo ven el atleta y el coach.

const toneladas = (kg) => num(Math.round(kg / 100) / 10, 1);
export const tituloBloque = (b) => (b.numero ? `Bloque ${b.numero}: ${b.nombre}` : b.nombre);

// Línea mínima con los valores de cada semana (los huecos se saltan)
function Linea({ valores, etiqueta }) {
  const W = 96, H = 30, pad = 4;
  const vals = valores.filter((v) => v != null);
  if (vals.length < 2) return <span class="linea-vacia" />;
  const min = Math.min(...vals), max = Math.max(...vals), rango = max - min || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, valores.length - 1);
  const y = (v) => H - pad - ((v - min) / rango) * (H - 2 * pad);
  const pts = valores.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
  return (
    <svg class="linea-mini" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={etiqueta}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" />
    </svg>
  );
}

// Barras de toneladas por semana, con lo hecho de lo pautado debajo
function Semanas({ semanas }) {
  const max = Math.max(1, ...semanas.map((w) => w.tonelaje));
  return (
    <ol class="semanas-barras" aria-label="Toneladas por semana">
      {semanas.map((w) => {
        const c = w.cumplimiento;
        return (
          <li key={w.numero} class={w.futura ? 'futura' : ''}>
            <span class="num mini secundario">{w.tonelaje ? `${toneladas(w.tonelaje)} t` : '—'}</span>
            <span class="barra" style={{ height: `${Math.max(4, (w.tonelaje / max) * 100)}%` }} aria-hidden="true" />
            <strong>S{w.numero}</strong>
            <span class="mini terciario">{w.foco ? NOMBRE_FOCO[w.foco] || w.foco : ''}</span>
            <span class="mini num">{w.futura ? 'Por venir' : `${w.sesiones.hechas}/${w.sesiones.total} ses.`}</span>
            {!w.futura && c.series.pct != null && <span class={`mini num ${c.series.pct >= 90 ? 'ok' : c.series.pct >= 70 ? '' : 'aviso'}`}>{c.series.pct} % series</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function InformeBloque({ informe: r, salud = false, coach = false, alCerrar }) {
  const [compartir, setCompartir] = useState(false);
  const c = r.cumplimiento;
  const tu = coach ? 'sus' : 'tus';
  const datosTarjeta = {
    nombre: tituloBloque(r.bloque), subtitulo: `${r.semanasTotal} semanas, ${rangoLargo(r.inicio, r.fin)}`, fecha: r.fin,
    etiquetaFecha: r.terminado ? 'Bloque terminado' : 'Bloque en curso',
    cifras: [[String(r.sesiones.hechas), r.sesiones.hechas === 1 ? 'sesión' : 'sesiones'], [toneladas(r.tonelaje), 'toneladas'], [String(r.records.length), r.records.length === 1 ? 'récord' : 'récords']],
    records: [], tituloMejores: 'Fuerza estimada (1RM)',
    mejores: r.principales.filter((p) => p.cambio != null).map((p) => ({ nombre: p.nombre, serie: `${signo(p.cambio, 1)} %` })),
    series: r.series, tonelaje: r.tonelaje, minutos: r.minutos,
  };
  return (
    <Hoja titulo={tituloBloque(r.bloque)} alCerrar={alCerrar} ancho={760}>
      <div class="informe">
        <p class="secundario">{r.semanasTotal} semanas, {rangoLargo(r.inicio, r.fin)}. <span class={`chip ${r.terminado ? 'ok' : 'morado'}`}>{r.terminado ? 'Terminado' : 'En curso'}</span></p>
        {r.bloque.objetivo && <p class="peq">{r.bloque.objetivo}</p>}

        <div class="informe-cifras">
          <div class="informe-cifra"><Anillo hechas={r.sesiones.hechas} total={r.sesiones.total || 1} tam={56} /><span class="pila-xs"><b class="num">{r.sesiones.hechas} de {r.sesiones.total}</b><span class="mini secundario">sesiones</span></span></div>
          <div class="informe-cifra"><span class="pila-xs"><b class="num">{c.series.pct ?? '—'} %</b><span class="mini secundario">de las series pautadas ({c.series.hechas} de {c.series.pautadas})</span></span></div>
          <div class="informe-cifra"><span class="pila-xs"><b class="num">{toneladas(r.tonelaje)} t</b><span class="mini secundario">{r.series} series{r.minutos ? `, ${Math.round(r.minutos / 60)} h` : ''}</span></span></div>
          <div class="informe-cifra"><span class="pila-xs"><b class="num">{r.records.length}</b><span class="mini secundario">{r.records.length === 1 ? 'récord' : 'récords'}</span></span></div>
        </div>

        {r.principales.length > 0 && (
          <section class="pila-s">
            <h3>Fuerza estimada</h3>
            <ul class="lista informe-fuerza">
              {r.principales.map((p) => (
                <li key={p.ejercicio_id}>
                  <span class="pila-xs"><strong>{p.nombre}</strong>
                    <span class="mini secundario num">{p.cambio != null ? `${num(p.inicio.e1rm)} → ${num(p.fin.e1rm)} kg (S${p.inicio.semana} a S${p.fin.semana})` : `${num(p.fin.e1rm)} kg`}</span></span>
                  <Linea valores={p.valores} etiqueta={`1RM estimado por semana: ${p.valores.map((v) => (v == null ? 'sin datos' : `${num(v)} kg`)).join(', ')}`} />
                  {p.cambio != null ? <span class={`chip num ${p.cambio > 0 ? 'ok' : ''}`}>{signo(p.cambio, 1)} %</span> : <span />}
                </li>
              ))}
            </ul>
            <p class="mini terciario">1RM estimado con la mejor serie de cada semana{r.principales.some((p) => !p.conEsfuerzo) ? '; donde no se apuntó el RPE, se supone al fallo y solo sirve para comparar ese ejercicio consigo mismo' : ''}.</p>
          </section>
        )}

        <section class="pila-s">
          <h3>Semana a semana</h3>
          <Semanas semanas={r.semanas} />
        </section>

        {c.esfuerzo.conEsfuerzo > 0 && (
          <section class="pila-s">
            <h3>Esfuerzo frente a lo pautado</h3>
            <div class="barra-partida" role="img" aria-label={`${100 - c.esfuerzo.pctEncima} % al esfuerzo pautado o por debajo, ${c.esfuerzo.pctEncima} % por encima`}>
              <span style={{ width: `${100 - c.esfuerzo.pctEncima}%` }} /><span class="encima" style={{ width: `${c.esfuerzo.pctEncima}%` }} />
            </div>
            <p class="peq secundario">{coach
              ? `${c.esfuerzo.pctEncima} % de las series con RPE fueron más de medio punto por encima de lo pautado (${c.esfuerzo.encima} de ${c.esfuerzo.conEsfuerzo}).`
              : `El ${100 - c.esfuerzo.pctEncima} % de tus series fueron al esfuerzo pautado o más suaves; el ${c.esfuerzo.pctEncima} %, por encima. Pasarse a menudo acumula fatiga: si te pasa, cuéntaselo a tu coach.`}</p>
          </section>
        )}

        {Object.keys(r.musculos).length > 0 && (
          <section class="pila-s">
            <h3>Series semanales por músculo</h3>
            <MapaMuscular series={r.musculos} etiqueta={`Series semanales medias por músculo en el bloque`} />
          </section>
        )}

        {salud && r.peso && (
          <section class="pila-s">
            <h3>Peso (tendencia)</h3>
            <p><b class="num">{num(r.peso.inicio)} → {num(r.peso.fin)} kg</b> <span class="chip num">{signo(r.peso.cambio, 1)} kg</span></p>
          </section>
        )}

        {r.records.length > 0 && (
          <section class="pila-s">
            <h3>Récords del bloque</h3>
            <ul class="lista">
              {r.records.slice(-6).reverse().map((x, i) => <li key={i} class="fila-record"><Icono n="trofeo" /><span><strong>{x.ejercicio}</strong>: {x.texto}</span></li>)}
            </ul>
            {r.records.length > 6 && <p class="mini terciario">y {r.records.length - 6} más en la vitrina.</p>}
          </section>
        )}

        {!coach && !r.vacio && (
          <button class="btn btn-grande" onClick={() => setCompartir(true)}><Icono n="compartir" /> Compartir {tu} cifras</button>
        )}
      </div>
      {compartir && <HojaCompartir datos={datosTarjeta} titulo="Compartir el bloque" alCerrar={() => setCompartir(false)}
        alt={`Tarjeta del ${tituloBloque(r.bloque)}: ${r.sesiones.hechas} sesiones, ${toneladas(r.tonelaje)} toneladas, ${r.records.length} récords`}
        nota="Solo lleva el nombre del bloque, las sesiones, las toneladas, los récords y cuánto ha subido tu fuerza estimada: nada de peso corporal ni datos de salud." />}
    </Hoja>
  );
}

// Lista de bloques para abrir su informe
export function ListaInformes({ informes, alAbrir, coach = false }) {
  return (
    <div class="panel">
      <ul class="lista">
        {informes.map((r) => (
          <li key={r.bloque.id}>
            <button class="fila-semana" onClick={() => alAbrir(r)}>
              <span class="pila-xs">
                <strong>{tituloBloque(r.bloque)}</strong>
                <span class="peq secundario">{r.terminado ? 'Terminado' : 'En curso'}, {r.sesiones.hechas} de {r.sesiones.total} sesiones{r.cumplimiento.series.pct != null ? `, ${r.cumplimiento.series.pct} % de las series` : ''}{r.records.length ? `, ${r.records.length} ${r.records.length === 1 ? 'récord' : 'récords'}` : ''}</span>
              </span>
              <Icono n="derecha" />
            </button>
          </li>
        ))}
      </ul>
      {!informes.length && <p class="panel-pad secundario">{coach ? 'Aún no tiene bloques publicados.' : 'Aún no tienes bloques publicados.'}</p>}
    </div>
  );
}

// Tarjeta en Hoy cuando acaba un bloque
export function TarjetaBloque({ informe: r, alAbrir, alQuitar }) {
  return (
    <section class="tarjeta-semana tarjeta-bloque" aria-label="Bloque terminado">
      <button class="tarjeta-semana-abrir" onClick={alAbrir}>
        <span class="tarjeta-semana-disco" aria-hidden="true" />
        <span class="pila-xs">
          <span class="mini">Has terminado el {tituloBloque(r.bloque)}</span>
          <strong>{r.sesiones.hechas} de {r.sesiones.total} sesiones{r.principales[0]?.cambio != null ? `, ${r.principales[0].nombre.toLowerCase()} ${signo(r.principales[0].cambio, 1)} %` : ''}</strong>
          <span class="mini">Mira tu informe</span>
        </span>
        <Icono n="derecha" />
      </button>
      <button class="btn btn-icono plano tarjeta-semana-quitar" onClick={alQuitar} aria-label="Ocultar el informe del bloque"><Icono n="cerrar" /></button>
    </section>
  );
}
