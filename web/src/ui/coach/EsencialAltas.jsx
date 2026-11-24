// FBE Esencial: dar de alta a varios de una vez (coach). Pelayo pega la lista (copiada de Stripe o escrita a mano), ve
// cómo la ha entendido la app, elige el lunes en que empiezan y crea sus fichas con su código (lo mismo que el alta de
// uno en uno, uno detrás de otro). Después, el mensaje de cada uno para mandarlo por correo (ya escrito) o copiarlo, y
// la lista de códigos para guardarla.
import { useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, useUnaVez, copiar } from '../comunes.jsx';
import { esLunes, fechaLarga } from '../../logica/esencial-alta.js';
import { leerAltas, mensajeInvitacion, enlaceCorreo, listaCodigos, ASUNTO_ESENCIAL, MAX_ALTAS } from '../../logica/esencial-altas.js';

const FALTA_091 = 'Para FBE Esencial falta ejecutar la migración 091 en Supabase (supabase/migraciones/091_esencial_alta.sql).';

export function HojaAltasEsencial({ inicio: inicio0, alCerrar }) {
  const { api } = useApp();
  const fichas = useCarga(() => api.atletas().catch(() => []), [], { tirar: false });
  const [texto, setTexto] = useState('');
  const [inicio, setInicio] = useState(inicio0);
  const [hechos, setHechos] = useState(null);
  const [va, setVa] = useState(0);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const leido = useMemo(() => leerAltas(texto, fichas.datos || []), [texto, fichas.datos]);
  const url = typeof location !== 'undefined' ? location.origin + location.pathname : '';
  const n = leido.validas.length;
  const crear = () => una(async () => {
    setError(null);
    if (!esLunes(inicio)) { setError('El día de inicio tiene que ser un lunes.'); return; }
    const salen = [];
    for (const [i, f] of leido.validas.entries()) {
      setVa(i + 1);
      try {
        const r = await api.crearAtletaEsencial({ nombre: f.nombre, email: f.email, nutricion: f.nutricion, inicio });
        if (r?.falta091) { setError(FALTA_091); break; }
        salen.push({ ...f, atleta: r.atleta, codigo: r.codigo });
      } catch (e) { salen.push({ ...f, fallo: e.message }); }
    }
    setVa(0);
    if (salen.length) setHechos(salen);
  });
  if (hechos) return <Invitaciones hechos={hechos} inicio={inicio} url={url} alCerrar={() => alCerrar(true)} />;
  return (
    <Hoja titulo="Varios de FBE Esencial" alCerrar={() => alCerrar(false)}>
      <div class="pila">
        <div class="campo"><label for="alt-texto">La lista</label>
          <textarea id="alt-texto" class="entrada" rows={7} value={texto} onInput={(e) => setTexto(e.currentTarget.value)}
            placeholder={'Ana López, ana@correo.com\nCarlos Vera; carlos@correo.com; nutrición'} />
          <span class="ayuda">Uno por línea: nombre y correo, y «nutrición» si es el nivel con nutrición. Vale también la lista copiada de Stripe. Como mucho {MAX_ALTAS} de una vez.</span></div>
        <div class="campo"><label for="alt-inicio">Empiezan el lunes</label>
          <input id="alt-inicio" class="entrada" type="date" required value={inicio} onInput={(e) => setInicio(e.currentTarget.value)} /></div>
        {leido.filas.length > 0 && (
          <section class="pila-s" aria-labelledby="alt-prev">
            <h3 id="alt-prev" class="etq">Lo que ha entendido la app: {n} de {leido.filas.length}</h3>
            <ul class="lista panel">
              {leido.filas.map((f, i) => (
                <li key={i} class="separa panel-pad">
                  <span class="pila-xs"><strong class="peq">{f.nombre || 'Sin nombre'}</strong><span class="mini terciario">{f.email || f.linea}</span></span>
                  <span class={`chip ${f.error ? 'aviso' : 'ok'}`}>{f.error || (f.nutricion ? 'Con nutrición' : 'Entrenamiento')}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {error && <div class="error" role="alert">{error}</div>}
        <button type="button" class="btn btn-primario btn-grande" disabled={ocupado || !n || fichas.cargando} onClick={crear}>
          {ocupado ? `Creando ${va} de ${n}…` : n ? `Crear ${n === 1 ? '1 ficha' : `${n} fichas`} con su código` : 'Crear sus fichas con su código'}</button>
      </div>
    </Hoja>
  );
}

// Las invitaciones: «Correo» abre el mensaje ya escrito en el programa de correo; «Copiar», para mandarlo por otro sitio
function Invitaciones({ hechos, inicio, url, alCerrar }) {
  const { aviso } = useApp();
  const [mandados, setMandados] = useState({});
  const bien = hechos.filter((h) => h.codigo);
  const mal = hechos.filter((h) => !h.codigo);
  const msj = (h) => mensajeInvitacion({ nombre: h.nombre, codigo: h.codigo, url, esencial: true, inicio });
  const marcar = (h) => setMandados((m) => ({ ...m, [h.atleta.id]: true }));
  const llevan = bien.filter((h) => mandados[h.atleta.id]).length;
  return (
    <Hoja titulo="Sus invitaciones" alCerrar={alCerrar}>
      <div class="pila">
        <p class="peq secundario">{bien.length === 1 ? 'Creada 1 ficha' : `Creadas ${bien.length} fichas`}; empiezan el {fechaLarga(inicio)}. Manda a cada uno su mensaje: «Correo» lo abre ya escrito. Si cierras esta hoja antes de mandarlos todos, a quien falte le generas otro código desde su ficha.</p>
        {mal.length > 0 && <div class="error" role="alert">No se han podido crear: {mal.map((h) => `${h.nombre} (${h.fallo})`).join('; ')}.</div>}
        {bien.length > 0 && <>
          <div class="separa">
            <span class="mini terciario num">{llevan} de {bien.length} mandados</span>
            <button type="button" class="btn btn-peq" onClick={async () => aviso((await copiar(listaCodigos(bien))) ? 'Lista copiada' : 'Selecciona el texto y cópialo')}><Icono n="copiar" /> Copiar la lista de códigos</button>
          </div>
          <ul class="lista panel">
            {bien.map((h) => {
              const correo = enlaceCorreo(h.email, ASUNTO_ESENCIAL, msj(h));
              return (
                <li key={h.atleta.id} class="separa panel-pad">
                  <span class="pila-xs"><strong class="peq">{h.nombre}{mandados[h.atleta.id] && <span class="chip ok" style="margin-left:var(--esp-8)">Mandado</span>}</strong>
                    <span class="mini terciario">{h.email} · <span class="num" style="white-space:nowrap">{h.codigo}</span>{h.nutricion ? ' · con nutrición' : ''}</span></span>
                  <span class="fila-envolver">
                    {correo && <a class="btn btn-peq" href={correo} onClick={() => marcar(h)} aria-label={`Correo para ${h.nombre}`}><Icono n="enviar" /> Correo</a>}
                    <button type="button" class="btn btn-peq" aria-label={`Copiar el mensaje para ${h.nombre}`}
                      onClick={async () => { const ok = await copiar(msj(h)); if (ok) marcar(h); aviso(ok ? 'Mensaje copiado' : 'Selecciona el texto y cópialo'); }}><Icono n="copiar" /> Copiar</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>}
        <button type="button" class="btn" onClick={alCerrar}>Hecho</button>
      </div>
    </Hoja>
  );
}
