// (apuntes, tanda C) Camino y progreso: el anillo del objetivo diario, la hoja «Tu progreso» (objetivo, racha y comodín,
// puntos, tus temas de «Visto» a «Dominado», la ruta «Fundamentos FBE» y tu mes en apuntes) y el certificado.
// La lógica, en logica/apuntes-camino.js.
import { useMemo, useState } from 'preact/hooks';
import { Icono, Hoja, useApp, useCarga } from '../comunes.jsx';
import { hoyISO, fmtCorta } from '../../logica/fechas.js';
import { guiasConTexto } from '../../datos/guias.js';
import { apuntesDeGuias, apuntesDeGlosario } from '../../logica/apuntes.js';
import { leerApuntes, guardarEstado } from '../apuntes.js';
import { hoyEnApuntes, rachaDiaria, puntosTotales, elegirMeta, dominio, rutaFundamentos, progresoRuta, tuMesApuntes, puedeHacerPrueba, pruebaDeNivel, nombreTema } from '../../logica/apuntes-camino.js';
import { DibujoDiploma } from './apuntes-arte.jsx';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { imagenTemaApuntes } from '../../logica/imagenes.js';
import { AnilloMeta } from './AnilloMeta.jsx';
export { AnilloMeta };
import { vibrar } from '../hapticos.js';
import { LigaYDuelos } from './ApuntesSocial.jsx';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMes = (mes) => MESES[Number(mes.slice(5, 7)) - 1] || '';

async function compartirTexto(texto, aviso) {
  try {
    if (typeof navigator.share === 'function') { await navigator.share({ text: texto }); return; }
    await navigator.clipboard.writeText(texto);
    aviso?.('Copiado: pégalo donde quieras');
  } catch (e) { if (e?.name !== 'AbortError') aviso?.('No se ha podido compartir', 'error'); }
}

// El certificado de «Fundamentos FBE», con su nombre, la fecha y la nota
export function Certificado({ nombre = '', certificado }) {
  const { aviso } = useApp() || {};
  if (!certificado) return null;
  const pct = Math.round((certificado.aciertos / certificado.total) * 100);
  const texto = `He terminado «Fundamentos FBE» en FBE Equipo (examen final: ${pct} %).`;
  return (
    <div class={`certificado${hayImagen('apuntes-certificado') ? ' con-ilu' : ''}`} role="group" aria-label="Certificado de Fundamentos FBE">
      <Imagen id="apuntes-certificado" clase="certificado-fondo" tamanos="(min-width: 640px) 560px, 92vw" alternativa={<DibujoDiploma />} />
      <span class="certificado-de">Certificado</span>
      <strong class="certificado-curso">Fundamentos FBE</strong>
      {nombre && <span class="certificado-nombre">{nombre}</span>}
      <span class="certificado-pie num">{fmtCorta(certificado.dia)} · examen final {pct} %</span>
      <button type="button" class="btn btn-peq" onClick={() => compartirTexto(texto, aviso)}><Icono n="compartir" />Compartir</button>
    </div>
  );
}

// «Tu progreso»: abre lo que toque con alAbrir(modo, curso)
export function HojaProgreso({ alCerrar, alAbrir }) {
  const { backend, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const guias = useCarga(() => guiasConTexto({ backend }).catch(() => []), [], { recuerdo: 'apuntes-guias' });
  const todos = useMemo(() => [...apuntesDeGuias(guias.datos || []), ...apuntesDeGlosario()], [guias.datos]);
  const [estado, setEstado] = useState(() => leerApuntes(atleta.id));
  const dia = hoyEnApuntes(estado, hoy), racha = rachaDiaria(estado, hoy), puntos = puntosTotales(estado);
  const temas = dominio(todos, estado);
  const ruta = progresoRuta(rutaFundamentos(todos), estado);
  const mes = tuMesApuntes(estado, todos, hoy.slice(0, 7));
  const conPrueba = puedeHacerPrueba(estado) && !!pruebaDeNivel(todos, hoy);
  const meta = (n) => { setEstado(guardarEstado(atleta.id, elegirMeta(leerApuntes(atleta.id), n))); vibrar('elegir'); };
  const textoMes = `Mi ${nombreMes(mes.mes)} en apuntes (FBE Equipo): ${mes.apuntes} apuntes en ${mes.dias} ${mes.dias === 1 ? 'día' : 'días'}${mes.temaFuerte ? `, lo que más: ${mes.temaFuerte.nombre}` : ''}${mes.rachaMax > 1 ? `, ${mes.rachaMax} días seguidos` : ''}.`;
  return (
    <Hoja titulo="Tu progreso" alCerrar={alCerrar} clase="hoja-progreso-apuntes">
      <div class="pila progreso-apuntes">
        {conPrueba && (
          <section class="prog-prueba panel panel-pad">
            <Imagen id="apuntes-prueba-nivel" clase="franja-ilu franja-pegada franja-prueba" tamanos="(min-width: 640px) 560px, 92vw" />
            <strong>¿Ya sabes de esto?</strong>
            <p class="peq secundario">Ocho preguntas: lo que aciertes, te lo salto y empiezas por lo que te falta.</p>
            <button type="button" class="btn btn-primario" onClick={() => alAbrir('nivel')}>Hacer la prueba de nivel</button>
          </section>
        )}
        <section class="prog-hoy" aria-labelledby="prog-hoy-t">
          <h3 id="prog-hoy-t">Tu objetivo</h3>
          <div class="prog-hoy-fila">
            <AnilloMeta {...dia} />
            <span class="pila-xs">
              <strong>{dia.hecho ? '¡Hecho por hoy!' : dia.falta === 1 ? 'Te falta uno para hoy' : `Te faltan ${dia.falta} para hoy`}</strong>
              <span class="peq secundario">{racha.dias > 0 ? `${racha.dias === 1 ? '1 día' : `${racha.dias} días`} seguidos` : 'Empieza hoy tu racha'}{racha.comodines ? ` · ${racha.comodines === 1 ? '1 comodín' : `${racha.comodines} comodines`}` : ''} · <span class="num">{puntos}</span> puntos</span>
            </span>
          </div>
          <div class="segmentos prog-meta" role="group" aria-label="Apuntes al día">
            {[1, 3, 5].map((n) => <button type="button" key={n} aria-pressed={dia.meta === n ? 'true' : 'false'} onClick={() => meta(n)}>{n} al día</button>)}
          </div>
          <p class="mini secundario">Cada semana con el objetivo cumplido cinco días te da un comodín: si un día no llegas, tu racha sigue.{racha.usados ? ` Ya te ha salvado ${racha.usados === 1 ? 'uno' : racha.usados}.` : ''}</p>
        </section>

        {temas.length > 0 && (
          <section class="prog-temas" aria-labelledby="prog-temas-t">
            <h3 id="prog-temas-t">Tus temas</h3>
            {temas.map((t) => (
              <div class={`prog-tema nivel-${t.nivel}${hayImagen(imagenTemaApuntes(t.tema)) ? ' con-ilu' : ''}`} key={t.tema}>
                <Imagen id={imagenTemaApuntes(t.tema)} clase="prog-tema-ilu" tamanos="48px" />
                <span class="prog-tema-cab"><strong>{t.nombre}</strong><span class="chip">{t.etiqueta}</span></span>
                <span class="prog-barra" role="img" aria-label={`${t.nombre}: ${t.vistos} vistos, ${t.practicados} practicados y ${t.dominados} dominados de ${t.total}`}>
                  <i class="v" style={{ width: `${(t.vistos / t.total) * 100}%` }} /><i class="p" style={{ width: `${(t.practicados / t.total) * 100}%` }} /><i class="d" style={{ width: `${(t.dominados / t.total) * 100}%` }} />
                </span>
                <span class="mini secundario num">{t.vistos} vistos · {t.practicados} practicados · {t.dominados} dominados · de {t.total}</span>
              </div>
            ))}
            <p class="mini secundario">Practicado: lo has recordado o acertado. Dominado: ha pasado tres repasos espaciados.</p>
          </section>
        )}

        {ruta.total > 0 && (
          <section class="prog-ruta" aria-labelledby="prog-ruta-t">
            <h3 id="prog-ruta-t">Fundamentos FBE</h3>
            <Imagen id="apuntes-ruta" clase="franja-ilu franja-ruta" tamanos="(min-width: 640px) 560px, 92vw" />
            <p class="peq secundario">{ruta.certificado ? 'Ruta terminada: aquí tienes tu certificado.' : ruta.todo ? 'Has hecho todos los módulos: te queda el examen final (con el 80 %, el certificado).' : `${ruta.hechos} de ${ruta.total} módulos. Con todos y el examen final, tu certificado.`}</p>
            <ol class="prog-modulos">
              {ruta.modulos.map((m) => (
                <li key={m.clave} class={m.hecho ? 'hecho' : ruta.siguiente?.clave === m.clave ? 'ahora' : ''}>
                  <span>{m.titulo}</span><span class="num mini">{m.hecho ? <Icono n="hecho" /> : `${m.hechas}/${m.total}`}</span>
                </li>
              ))}
            </ol>
            {ruta.siguiente && <button type="button" class="btn" onClick={() => alAbrir('curso', ruta.siguiente.clave)}>Seguir con «{ruta.siguiente.titulo}»</button>}
            {ruta.todo && !ruta.certificado && <button type="button" class="btn btn-primario" onClick={() => alAbrir('final')}>Hacer el examen final</button>}
            {ruta.certificado && <Certificado nombre={atleta?.nombre || ''} certificado={ruta.certificado} />}
          </section>
        )}

        <LigaYDuelos alJugar={(d) => alAbrir('duelo', null, d)} />
        <section class="prog-mes" aria-labelledby="prog-mes-t">
          <h3 id="prog-mes-t">Tu {nombreMes(mes.mes)} en apuntes</h3>
          <div class="prog-mes-cifras">
            <span><b class="num">{mes.apuntes}</b>apuntes</span>
            <span><b class="num">{mes.dias}</b>{mes.dias === 1 ? 'día' : 'días'}</span>
            <span><b class="num">{mes.rachaMax}</b>seguidos</span>
            <span><b class="num">{mes.puntos}</b>puntos</span>
          </div>
          <p class="peq">{mes.temaFuerte ? <>Lo que más: <strong>{mes.temaFuerte.nombre}</strong>.</> : 'Aún no hay un tema que destaque.'}{mes.examenes.n ? <> Exámenes: {mes.examenes.n}, con un {mes.examenes.media} % de media.</> : ''}{mes.metaDias ? <> Objetivo cumplido {mes.metaDias === 1 ? 'un día' : `${mes.metaDias} días`}.</> : ''}</p>
          {mes.apuntes > 0 && <button type="button" class="btn btn-peq" onClick={() => compartirTexto(textoMes, aviso)}><Icono n="compartir" />Compartir mi mes</button>}
        </section>
        {estado.prueba && <p class="mini secundario">Prueba de nivel ({fmtCorta(estado.prueba.dia)}): {estado.prueba.aciertos} de {estado.prueba.total}{estado.prueba.saltados.length ? `; te salté lo básico de ${estado.prueba.saltados.map(nombreTema).join(' y ')}` : ''}.</p>}
      </div>
    </Hoja>
  );
}
