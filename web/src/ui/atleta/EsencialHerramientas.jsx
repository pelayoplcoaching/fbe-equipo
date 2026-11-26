// (v0.254) «Más herramientas» y «Mi medicación y el ejercicio», desde «¿Qué necesitas?» (EsencialAyuda.jsx). Decisiones de
// Pelayo del 26/11/2026 (claude/esencial-herramientas-integracion.md): las herramientas de la web que no están dentro de la
// app, como enlaces (logica/esencial-herramientas.js); y su medicación, reconocida con los nombres de Pauta Activa en lo que
// escribió en «Tomo alguna medicación a diario», para abrir Pauta Activa con su lista y, con la migración 107, guardarla en su
// ficha (datos/api-medicacion.js). Sin textos de salud nuevos: los de la web y los de Pauta Activa. Los nombres de Pauta
// Activa (datos/pauta-activa-nombres.json) se cargan al abrir la hoja. Estilos: los de siempre (GrupoIos, FilaIos y botones).
import { useState, useMemo } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Hoja, Icono, GrupoIos, FilaIos } from '../comunes.jsx';
import { Arte } from './EsencialArte.jsx';
import { MAS_HERRAMIENTAS, APRENDE_WEB, TODAS_HERRAMIENTAS, urlWeb } from '../../logica/esencial-herramientas.js';
import { PAUTA_ACTIVA, TEXTO_PAUTA_ACTIVA, TEXTO_ENLACE, reconocer, enlacePautaActiva, dosisTexto, tomaMedicacion } from '../../logica/medicacion.js';
import { fechaMadrid } from '../../logica/fechas.js';
import { fechaLarga } from '../../logica/esencial-alta.js';

// ---------- «Más herramientas»: las de la web, como enlaces ----------
export function HojaHerramientas({ cuestionario = null, alCerrar, alMedicacion = null }) {
  return (
    <Hoja titulo="Más herramientas" alCerrar={alCerrar}>
      <div class="pila">
        <Arte id="esencial-herramientas" />
        <p class="secundario">Las herramientas de la web de FBE que no están dentro de la app. Se abren aparte, en tu navegador.</p>
        <GrupoIos titulo="Herramientas" id="hta-herr-t">
          {MAS_HERRAMIENTAS.map(([u, t, d, i]) => <FilaIos key={u} icono={i} titulo={t} detalle={d} href={urlWeb(u)} etiqueta={`${t}: se abre en la web`} />)}
          <FilaIos icono="escudo" titulo="Pauta Activa" detalle={TEXTO_PAUTA_ACTIVA} href={PAUTA_ACTIVA} etiqueta="Pauta Activa: se abre aparte" />
        </GrupoIos>
        {alMedicacion && tomaMedicacion(cuestionario) && (
          <button type="button" class="btn" style="justify-self:start" onClick={alMedicacion}><Icono n="escudo" /> Pauta Activa con mi medicación</button>
        )}
        <GrupoIos titulo="Para aprender" id="hta-apr-t">
          {APRENDE_WEB.map(([u, t, d, i]) => <FilaIos key={u} icono={i} titulo={t} detalle={d} href={urlWeb(u)} etiqueta={`${t}: se abre en la web`} />)}
        </GrupoIos>
        <a class="btn-texto peq" style="justify-self:start" href={urlWeb(TODAS_HERRAMIENTAS)} target="_blank" rel="noopener">Todas las herramientas de la web</a>
      </div>
    </Hoja>
  );
}

// ---------- «Mi medicación y el ejercicio»: su texto, reconocido; quitar lo que no está bien; guardar y abrir Pauta Activa ----------
export function HojaMedicacion({ cuestionario = null, alCerrar }) {
  const { backend, atleta, aviso } = useApp();
  const texto = String(cuestionario?.medicacion_detalle || '').trim();
  const base = useCarga(() => import('../../datos/pauta-activa-nombres.json').then((m) => m.default || m), []);
  const rec = useMemo(() => (base.datos ? reconocer(texto, base.datos) : null), [base.datos, texto]);
  // (107) ¿se puede guardar? y lo que ya guardó
  const med = useCarga(async () => {
    const m = await import('../../datos/api-medicacion.js');
    const hay = await m.hay107(backend).catch(() => false);
    return { m, hay, fila: hay ? await m.medicacion(backend, atleta.id).catch(() => null) : null };
  }, [atleta.id]);
  const [fuera, setFuera] = useState(() => new Set());
  const [guardada, setGuardada] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const lista = rec ? rec.encontrados.filter((x) => !fuera.has(x.pid)) : [];
  const fila = guardada || med.datos?.fila || null;
  const quitar = (pid) => setFuera((s) => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });
  const guardar = () => una(async () => {
    setError(null);
    try {
      const r = await med.datos.m.guardarMedicacion(backend, lista, base.datos?.version || null);
      if (r && !r.falta107) { setGuardada(r); aviso('Tu lista, guardada'); }
    } catch (e) { setError(e.message); }
  });
  return (
    <Hoja titulo="Tu medicación y el ejercicio" alCerrar={alCerrar}>
      <div class="pila" aria-busy={base.cargando ? 'true' : 'false'}>
        <Arte id="esencial-medicacion" />
        {texto ? (
          <>
            <p class="secundario">En tus preguntas de salud escribiste: «{texto}». Esto es lo que reconocemos con los nombres de Pauta Activa. Quita lo que no esté bien.</p>
            {rec && rec.encontrados.length > 0 && (
              <GrupoIos titulo="Lo que reconocemos" id="mde-rec-t">
                {rec.encontrados.map((x) => {
                  const sale = fuera.has(x.pid);
                  return (
                    <FilaIos key={x.pid} icono={sale ? 'cerrar' : 'hecho'} tono={sale ? 'aviso' : 'ok'} titulo={x.nombre}
                      detalle={sale ? 'Fuera de tu lista' : [x.familia && x.familia !== x.nombre ? x.familia : null, dosisTexto(x)].filter(Boolean).join(' · ')}>
                      <button type="button" class="btn-texto mini" aria-pressed={sale ? 'true' : 'false'} aria-label={`${sale ? 'Volver a poner' : 'Quitar'} ${x.nombre}`} onClick={() => quitar(x.pid)}>{sale ? 'Volver a poner' : 'Quitar'}</button>
                    </FilaIos>
                  );
                })}
              </GrupoIos>
            )}
            {rec && rec.encontrados.length === 0 && <p class="peq">No reconocemos ningún medicamento en lo que escribiste. Puedes añadirlos en Pauta Activa.</p>}
            {rec && rec.sinReconocer.length > 0 && rec.encontrados.length > 0 && (
              <p class="peq terciario">No reconocemos {rec.sinReconocer.map((s) => `«${s}»`).join(', ')}: puedes añadirlo en Pauta Activa.</p>
            )}
            <p class="peq terciario">¿Falta algo o sobra? Cámbialo en Perfil, en «Tu cuestionario inicial».</p>
          </>
        ) : (
          <p class="secundario">En tus preguntas de salud dijiste que tomas medicación a diario, pero no qué. Puedes escribirla en Perfil, en «Tu cuestionario inicial», o añadirla directamente en Pauta Activa.</p>
        )}
        {error && <p class="error" role="alert">{error}</p>}
        {fila && !error && <p class="peq" role="status">Tu lista está guardada en tu ficha desde el {fechaLarga(fechaMadrid(new Date(fila.confirmado_en)))}{fila.lista?.length ? ` (${fila.lista.length})` : ''}.</p>}
        <span class="fila-envolver">
          <a class="btn btn-primario" href={enlacePautaActiva(lista)} target="_blank" rel="noopener"><Icono n="enlace" /> Ver mi medicación en Pauta Activa</a>
          {med.datos?.hay && texto && rec && (
            <button type="button" class="btn" disabled={ocupado} onClick={guardar}><Icono n="guardar" /> {fila ? 'Guardar los cambios' : 'Guardar mi lista'}</button>
          )}
        </span>
        <p class="peq secundario">Pauta Activa {TEXTO_PAUTA_ACTIVA.charAt(0).toLowerCase()}{TEXTO_PAUTA_ACTIVA.slice(1)}</p>
        <p class="mini terciario">{TEXTO_ENLACE}{med.datos?.hay ? ' Si guardas tu lista, queda en tu ficha con tu consentimiento de salud: la ves tú y la ve Pelayo.' : ''}{base.datos?.version ? ` Nombres de Pauta Activa, versión ${base.datos.version}.` : ''}</p>
      </div>
    </Hoja>
  );
}
