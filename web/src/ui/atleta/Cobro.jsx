// Cómo va con sus pagos (v0.25, migración 021): el atleta solo ve el resumen (hasta cuándo tiene pagado y si
// queda algo pendiente), nunca el precio, las notas ni la lista de cobros. En Hoy, arriba, cuando debe algo o su
// periodo acaba (con «Ahora no» hasta mañana); en Perfil, siempre que haya cobros apuntados.
import { useApp, useCarga, Icono, usePreferencia } from '../comunes.jsx';
import { fmtEuros } from '../../logica/cobros.js';
import { fmtCorta, hoyISO } from '../../logica/fechas.js';

const fecha = (iso) => (iso ? `${fmtCorta(iso)}${iso.slice(0, 4) !== hoyISO().slice(0, 4) ? ` de ${iso.slice(0, 4)}` : ''}` : '');

export function textoCobro(c) {
  if (!c) return null;
  if (c.estado === 'retrasado') return { titulo: 'Tienes un pago retrasado', texto: `${fmtEuros(c.debe)} pendientes desde el ${fecha(c.debeDesde)}.`, tono: 'alerta' };
  if (c.estado === 'pendiente') return { titulo: 'Tienes un pago pendiente', texto: `${fmtEuros(c.debe)} desde el ${fecha(c.debeDesde)}.`, tono: 'aviso' };
  if (c.estado === 'vencido') return { titulo: 'Tu periodo de asesoría ha acabado', texto: `Lo tenías pagado hasta el ${fecha(c.pagadoHasta)}.`, tono: 'aviso' };
  if (c.estado === 'vence_pronto') return { titulo: 'Tu periodo acaba pronto', texto: `Lo tienes pagado hasta el ${fecha(c.pagadoHasta)}.`, tono: 'info' };
  if (c.estado === 'al_dia') return { titulo: 'Al día', texto: `Pagado hasta el ${fecha(c.pagadoHasta)}.`, tono: 'ok' };
  return null;
}

// Hoy: solo si hay algo que hacer
export function AvisoCobro({ irA }) {
  const { api, atleta } = useApp();
  const c = useCarga(() => api.miCobro(), [atleta?.id]).datos;
  const [oculto, setOculto] = usePreferencia('fbe-cobro-oculto', null);
  if (!c || !['retrasado', 'pendiente', 'vencido', 'vence_pronto'].includes(c.estado)) return null;
  // «Ahora no»: hasta mañana (o hasta que cambie lo que debe o la fecha)
  const firma = `${hoyISO()}|${c.estado}|${c.debe}|${c.pagadoHasta}`;
  if (oculto === firma) return null;
  const t = textoCobro(c);
  return (
    <section class={`aviso-cobro ${t.tono}`} aria-labelledby="aviso-cobro-t">
      <Icono n={t.tono === 'info' ? 'calendario' : 'alerta'} />
      <div class="pila-xs">
        <strong id="aviso-cobro-t">{t.titulo}</strong>
        <span>{t.texto} {c.estado === 'vence_pronto' || c.estado === 'vencido' ? 'Si ya has renovado, tu coach lo apuntará en cuanto lo vea.' : 'Si ya lo has pagado, díselo a tu coach y lo marca.'}</span>
        <span class="fila-envolver">
          <button class="btn btn-peq" onClick={() => irA?.('mensajes')}><Icono n="mensaje" /> Escribir a mi coach</button>
          <button class="btn-texto" onClick={() => setOculto(firma)}>Ahora no</button>
        </span>
      </div>
    </section>
  );
}

// Perfil → Tu asesoría: una fila con cómo va
export function FilaCobro() {
  const { api, atleta } = useApp();
  const c = useCarga(() => api.miCobro(), [atleta?.id]).datos;
  const t = textoCobro(c);
  if (!t) return null;
  return (
    <li class="panel-pad separa">
      <div><div>Tus pagos</div><div class="peq terciario">{t.titulo === 'Al día' ? t.texto : `${t.titulo}: ${t.texto.charAt(0).toLowerCase()}${t.texto.slice(1)}`}</div></div>
      <span class={`chip ${t.tono === 'alerta' ? 'alerta' : t.tono === 'aviso' ? 'aviso' : t.tono === 'ok' ? 'ok' : 'info'}`}>{t.tono === 'ok' ? 'Al día' : t.tono === 'info' ? 'Acaba pronto' : t.tono === 'alerta' ? 'Retrasado' : c.estado === 'vencido' ? 'Por renovar' : 'Pendiente'}</span>
    </li>
  );
}
