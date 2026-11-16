// «A su medida» (migración 080), en la ficha del atleta (pestaña Objetivos): lo que el coach le escribe a ese atleta.
//   · sus frases por momento (una por línea) y las de un ejercicio concreto,
//   · sus tres imágenes (perfil y carné, empezar antes y récord),
//   · sus márgenes de ritmo de peso.
// Solo lo ve ese atleta. Nada de aquí cambia su programación (sus reglas de progresión están en «Programar según FBE»).
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono } from '../comunes.jsx';
import { MOMENTOS, HUECOS, LIMITES, MARGEN_BAJA, MARGEN_SUBE_NIVEL, leerPropio, cuantasFrases, paraGuardarPropio } from '../../logica/a-medida.js';
import { prepararImagenPropia } from '../a-medida-imagen.js';

const enLineas = (lista) => (lista || []).join('\n');
const deLineas = (texto) => String(texto || '').split('\n');
const cuenta = (texto) => deLineas(texto).map((x) => x.trim()).filter(Boolean).length;
const coma = (n) => (n == null ? '' : String(n).replace('.', ','));

export function AMedida({ atleta, recargar }) {
  const { api } = useApp();
  const [abierta, setAbierta] = useState(false);
  const huecos = useCarga(() => api.huecosPropios(atleta.id).catch(() => null), [atleta.id]);
  // (sin la migración 080, la tabla de imágenes no existe: no se ofrece)
  if (huecos.datos === null) return null;
  const p = leerPropio(atleta.propio);
  const nFrases = cuantasFrases(atleta.propio), nImg = Object.keys(huecos.datos || {}).length;
  const nombre = (atleta.nombre || '').split(' ')[0] || 'este atleta';
  const partes = [nFrases ? `${nFrases} ${nFrases === 1 ? 'frase' : 'frases'}` : null, nImg ? `${nImg} ${nImg === 1 ? 'imagen' : 'imágenes'}` : null, p?.peso ? 'márgenes de peso' : null].filter(Boolean);
  return (
    <section class="seccion a-medida-coach" aria-labelledby="a-medida-t">
      <div class="seccion-cab"><h2 id="a-medida-t">A su medida</h2><button type="button" class="btn-texto" onClick={() => setAbierta(true)}>{partes.length ? 'Cambiar' : 'Empezar'}</button></div>
      <div class="panel panel-pad pila-s">
        {partes.length ? (
          <>
            <p class="a-medida-resumen"><Icono n="mensaje" /> <strong>{partes.join(' · ')}</strong></p>
            {p && Object.keys(p.frases).length > 0 && <p class="mini secundario">Con frases en: {MOMENTOS.filter(([k]) => p.frases[k]).map(([, n]) => n.toLowerCase()).join(', ')}{p.ejercicios.length ? `; y en ${p.ejercicios.map((e) => e.texto).join(', ')}` : ''}.</p>}
            {p && !Object.keys(p.frases).length && p.ejercicios.length > 0 && <p class="mini secundario">Con frases en: {p.ejercicios.map((e) => e.texto).join(', ')}.</p>}
            {p?.peso && <p class="mini secundario">Aviso de peso: {[p.peso.baja_semana != null && `si baja más de un ${coma(p.peso.baja_semana)} % a la semana`, p.peso.sube_mes != null && `si sube más de un ${coma(p.peso.sube_mes)} % al mes`].filter(Boolean).join(' o ')}.</p>}
          </>
        ) : <p class="peq secundario">Frases tuyas para sus momentos (el saludo, el día de pierna, un récord…), alguna imagen suya y sus márgenes de ritmo de peso. Solo lo ve {nombre}; sin nada, ve lo de siempre.</p>}
        <p class="mini terciario">Sus reglas de progresión se ponen en «Programar según FBE → Reglas de {nombre}».</p>
      </div>
      {abierta && <HojaAMedida atleta={atleta} huecos={huecos.datos || {}} alCerrar={() => setAbierta(false)} alCambiarImagen={() => huecos.recargar(true)} alGuardar={() => { setAbierta(false); recargar?.(); }} />}
    </section>
  );
}

function HojaAMedida({ atleta, huecos, alCerrar, alCambiarImagen, alGuardar }) {
  const { api, aviso } = useApp();
  const inicial = leerPropio(atleta.propio) || { frases: {}, ejercicios: [], peso: null };
  const [frases, setFrases] = useState(() => Object.fromEntries(MOMENTOS.map(([k]) => [k, enLineas(inicial.frases[k])])));
  const [ejercicios, setEjercicios] = useState(() => inicial.ejercicios.map((e) => ({ texto: e.texto, frases: enLineas(e.frases) })));
  const [peso, setPeso] = useState({ baja: coma(inicial.peso?.baja_semana), sube: coma(inicial.peso?.sube_mes) });
  const [guardando, setGuardando] = useState(false);
  const nombre = (atleta.nombre || '').split(' ')[0] || 'este atleta';
  const valor = () => ({
    frases: Object.fromEntries(Object.entries(frases).map(([k, t]) => [k, deLineas(t)])),
    ejercicios: ejercicios.map((e) => ({ texto: e.texto, frases: deLineas(e.frases) })),
    peso: { baja_semana: peso.baja, sube_mes: peso.sube },
  });
  const limpio = leerPropio(valor());
  // Lo que se quedaría fuera al guardar: frases de más, margen que no vale, un ejercicio sin nombre
  const pegas = [
    ...MOMENTOS.filter(([k]) => cuenta(frases[k]) > LIMITES.porMomento).map(([, n]) => `«${n}» tiene más de ${LIMITES.porMomento} frases: las de más no se guardan.`),
    ...(Object.values(frases).concat(ejercicios.map((e) => e.frases)).some((t) => deLineas(t).some((l) => l.trim().length > LIMITES.frase)) ? [`Alguna frase pasa de ${LIMITES.frase} letras: se cortará.`] : []),
    ...(ejercicios.some((e) => cuenta(e.frases) > 0 && e.texto.trim().length < 3) ? ['Un ejercicio con frases no tiene nombre (al menos 3 letras): no se guarda.'] : []),
    ...(peso.baja.trim() && limpio?.peso?.baja_semana == null ? ['El margen de bajada, entre 0,1 y 3 (% por semana).'] : []),
    ...(peso.sube.trim() && limpio?.peso?.sube_mes == null ? ['El margen de subida, entre 0,1 y 5 (% al mes).'] : []),
  ];
  const guardar = async () => {
    setGuardando(true);
    try {
      const guardado = await api.guardarPropio(atleta.id, valor());
      aviso(guardado ? 'Guardado: ya lo ve en su app' : 'Sin nada a su medida: ve lo de siempre');
      alGuardar();
    } catch (e) { aviso(e.message, 'error'); } finally { setGuardando(false); }
  };
  const total = cuantasFrases(paraGuardarPropio(valor()));
  return (
    <Hoja titulo={`A la medida de ${nombre}`} alCerrar={alCerrar} ancho={720}>
      <form class="pila a-medida-form" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
        <p class="peq secundario">Una frase por línea. Salen de una en una, sin repetirse hasta que las ha visto todas. Donde no escribas nada, {nombre} ve lo de siempre.</p>
        {MOMENTOS.map(([k, n, cuando]) => (
          <div class="campo" key={k}>
            <label for={`am-${k}`}>{n}</label>
            <textarea id={`am-${k}`} class="entrada" rows={Math.min(10, Math.max(2, cuenta(frases[k]) * 2 + 1))} value={frases[k]} onInput={(e) => setFrases({ ...frases, [k]: e.currentTarget.value })} />
            <span class="ayuda">{cuando} <span class="num">{cuenta(frases[k])} / {LIMITES.porMomento}</span></span>
          </div>
        ))}

        <fieldset class="a-medida-grupo">
          <legend>En un ejercicio concreto</legend>
          <p class="mini secundario">Sale al abrir ese ejercicio en la sesión, antes de empezarlo. Vale para todos los ejercicios cuyo nombre contenga lo que escribas («press banca», «peso muerto», «sentadilla»).</p>
          {ejercicios.map((e, i) => (
            <div class="a-medida-ejercicio-fila" key={i}>
              <div class="campo">
                <label for={`am-ej-${i}`}>El nombre contiene</label>
                <input id={`am-ej-${i}`} class="entrada" maxLength={LIMITES.textoEjercicio} value={e.texto} placeholder="press banca" onInput={(ev) => setEjercicios(ejercicios.map((x, j) => (j === i ? { ...x, texto: ev.currentTarget.value } : x)))} />
              </div>
              <div class="campo">
                <label for={`am-ejf-${i}`}>Sus frases</label>
                <textarea id={`am-ejf-${i}`} class="entrada" rows={Math.min(8, Math.max(2, cuenta(e.frases) * 2 + 1))} value={e.frases} onInput={(ev) => setEjercicios(ejercicios.map((x, j) => (j === i ? { ...x, frases: ev.currentTarget.value } : x)))} />
              </div>
              <button type="button" class="btn-texto mini peligro" onClick={() => setEjercicios(ejercicios.filter((_, j) => j !== i))}>Quitar este ejercicio</button>
            </div>
          ))}
          {ejercicios.length < LIMITES.ejercicios && <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => setEjercicios([...ejercicios, { texto: '', frases: '' }])}><Icono n="mas" /> Añadir un ejercicio</button>}
        </fieldset>

        <fieldset class="a-medida-grupo">
          <legend>Su ritmo de peso</legend>
          <p class="mini secundario">Con la tendencia de sus últimas cuatro semanas (no con una pesada). En definición solo se avisa de bajar; en volumen, solo de subir; si no lleva plan de nutrición en la app, de las dos cosas. Vacío, no se avisa.</p>
          <div class="a-medida-margenes">
            <div class="campo">
              <label for="am-baja">Avisar si baja más de</label>
              <span class="a-medida-unidad"><input id="am-baja" class="entrada num" inputMode="decimal" value={peso.baja} placeholder={coma(MARGEN_BAJA)} onInput={(e) => setPeso({ ...peso, baja: e.currentTarget.value })} /> % por semana</span>
              <span class="ayuda">En definición, lo recomendable es perder entre un 0,5 y un 1 % por semana (Helms).</span>
            </div>
            <div class="campo">
              <label for="am-sube">Avisar si sube más de</label>
              <span class="a-medida-unidad"><input id="am-sube" class="entrada num" inputMode="decimal" value={peso.sube} placeholder="0,5" onInput={(e) => setPeso({ ...peso, sube: e.currentTarget.value })} /> % al mes</span>
              <span class="fila-envolver">{MARGEN_SUBE_NIVEL.map(([k, n, v]) => <button type="button" key={k} class="chip" aria-pressed={peso.sube === coma(v) ? 'true' : 'false'} onClick={() => setPeso({ baja: peso.baja || coma(MARGEN_BAJA), sube: coma(v) })}>{n}: {coma(v)} %</button>)}</span>
            </div>
          </div>
        </fieldset>

        {pegas.length > 0 && <ul class="a-medida-pegas mini">{pegas.map((x) => <li key={x}>{x}</li>)}</ul>}
        <button class="btn btn-primario btn-grande" disabled={guardando}><Icono n="hecho" /> Guardar{total ? ` (${total} ${total === 1 ? 'frase' : 'frases'})` : ''}</button>
      </form>

      <section class="a-medida-imagenes" aria-labelledby="am-img-t">
        <h3 id="am-img-t">Sus imágenes</h3>
        <p class="mini secundario">Se guardan al subirlas (no hace falta «Guardar»). Solo las veis {nombre} y tú.</p>
        <div class="a-medida-huecos">
          {HUECOS.map(([k, n, forma, donde]) => <Hueco key={k} atletaId={atleta.id} hueco={k} nombre={n} forma={forma} donde={donde} puesta={huecos[k] || null} alCambiar={alCambiarImagen} />)}
        </div>
      </section>
    </Hoja>
  );
}

function Hueco({ atletaId, hueco, nombre, forma, donde, puesta, alCambiar }) {
  const { api, aviso } = useApp();
  const [ocupado, setOcupado] = useState(false);
  const img = useCarga(() => (puesta ? api.imagenPropia(atletaId, hueco).catch(() => null) : Promise.resolve(null)), [atletaId, hueco, puesta]);
  const subir = async (archivo) => {
    if (!archivo) return;
    setOcupado(true);
    try { await api.ponerImagenPropia(atletaId, hueco, await prepararImagenPropia(archivo, hueco)); aviso('Imagen puesta'); alCambiar(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const quitar = async () => {
    setOcupado(true);
    try { await api.quitarImagenPropia(atletaId, hueco); aviso('Imagen quitada'); alCambiar(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  return (
    <div class="a-medida-hueco" data-hueco={hueco} data-forma={forma}>
      <div class="a-medida-hueco-vista">{img.datos ? <img src={img.datos} alt={`Su imagen de ${nombre.toLowerCase()}`} /> : <Icono n="camara" />}</div>
      <strong>{nombre}</strong>
      <span class="mini secundario">{donde} Mejor {forma}.</span>
      <span class="fila-envolver">
        <label class={`btn btn-peq${ocupado ? ' ocupado' : ''}`}><Icono n="camara" />{ocupado ? 'Un momento…' : puesta ? 'Cambiar' : 'Subir'}
          <input type="file" accept="image/*" class="sr" disabled={ocupado} onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; subir(f); }} aria-label={`Elegir la imagen de ${nombre.toLowerCase()}`} /></label>
        {puesta && <button type="button" class="btn btn-peq" disabled={ocupado} onClick={quitar}><Icono n="basura" />Quitar</button>}
      </span>
    </div>
  );
}
