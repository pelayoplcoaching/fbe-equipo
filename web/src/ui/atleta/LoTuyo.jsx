// «Lo tuyo» (v0.104, migración 050): lo que el atleta elige para su app, en su perfil. Cómo quiere que le llamemos (la
// bienvenida y las celebraciones), su porqué (se lo recuerda la bienvenida al volver tras unos días sin entrenar), sus
// tres ejercicios (arriba en Progreso), su música (un botón en la portada de cada sesión) y su cumpleaños (día y mes:
// la app le felicita y su coach lo sabe). Todo opcional; lo ve su coach. Sin la 050, no sale.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, GrupoIos, FilaIos } from '../comunes.jsx';
import { LIMITES, limpiarPersonal, urlMusica, nombreMusica, cumpleValido } from '../../logica/personal.js';
import { MESES_LARGOS } from '../../logica/mes.js';
import { conEntrenamiento } from '../../logica/nivel.js';

export const textoCumple = (p) => (p?.cumple_mes && p?.cumple_dia ? `${p.cumple_dia} de ${MESES_LARGOS[p.cumple_mes - 1]}` : null);

export function LoTuyo() {
  const { api, atleta } = useApp();
  // (api.personal: undefined sin la 050; null sin nada guardado)
  const datos = useCarga(() => api.personal().then((p) => (p === undefined ? { sin: true } : { p: p || {} })).catch(() => ({ sin: true })), [atleta.id]);
  const [editar, setEditar] = useState(null);
  if (!datos.datos || datos.datos.sin) return null;
  const p = datos.datos.p;
  const entrena = conEntrenamiento(atleta);
  const nFav = p.favoritos?.length || 0;
  return (
    <GrupoIos titulo="Lo tuyo" id="grupo-lo-tuyo" pie="Todo es opcional. Lo ve tu coach; nadie más.">
      <FilaIos icono="perfil" titulo="Cómo quieres que te llamemos" valor={p.apodo || 'Tu nombre'} alTocar={() => setEditar('apodo')} etiqueta="Cambiar cómo quieres que te llamemos" />
      <FilaIos icono="diana" titulo="Tu porqué" detalle={p.porque ? `«${p.porque}»` : 'Una frase tuya para los días que cuestan'} alTocar={() => setEditar('porque')} etiqueta="Escribir tu porqué" />
      {entrena && <FilaIos icono="estrella" titulo="Tus tres ejercicios" valor={nFav ? `${nFav} de 3` : 'Elegir'} alTocar={() => setEditar('favoritos')} etiqueta="Elegir tus tres ejercicios" />}
      {entrena && <FilaIos icono="altavoz" titulo="Tu música" valor={p.musica_url ? nombreMusica(p.musica_url) : 'Añadir'} alTocar={() => setEditar('musica')} etiqueta="Poner el enlace a tu música" />}
      <FilaIos icono="calendario" titulo="Tu cumpleaños" valor={textoCumple(p) || 'Añadir'} alTocar={() => setEditar('cumple')} etiqueta="Poner tu cumpleaños" />
      {editar && <HojaLoTuyo campo={editar} actual={p} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); datos.recargar(true); }} />}
    </GrupoIos>
  );
}

const TITULOS = { apodo: 'Cómo quieres que te llamemos', porque: 'Tu porqué', favoritos: 'Tus tres ejercicios', musica: 'Tu música', cumple: 'Tu cumpleaños' };

function HojaLoTuyo({ campo, actual, alCerrar, alGuardar }) {
  const { api, atleta, aviso } = useApp();
  const [f, setF] = useState(() => ({ apodo: actual.apodo || '', porque: actual.porque || '', favoritos: [...(actual.favoritos || [])], musica_url: actual.musica_url || '', cumple_mes: actual.cumple_mes || '', cumple_dia: actual.cumple_dia || '' }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const ejercicios = useCarga(() => (campo === 'favoritos' ? api.progreso(atleta.id).then((r) => r.ejercicios || []).catch(() => []) : Promise.resolve([])), [campo]);
  const cambiar = (c) => { setF({ ...f, ...c }); setError(null); };
  const musicaMal = campo === 'musica' && f.musica_url.trim() && urlMusica(f.musica_url) === false;
  const cumpleMal = campo === 'cumple' && (f.cumple_mes !== '' || f.cumple_dia !== '') && !cumpleValido(Number(f.cumple_mes), Number(f.cumple_dia));
  async function guardar(e) {
    e?.preventDefault();
    let limpio;
    try { limpio = limpiarPersonal({ ...actual, ...f }); } catch (err) { setError(err.message); return; }
    setGuardando(true);
    try { await api.guardarPersonal(limpio); aviso('Guardado'); alGuardar(); } catch (err) { setError(err.message); } finally { setGuardando(false); }
  }
  const quitar = async (cambios) => {
    setGuardando(true);
    try { await api.guardarPersonal({ ...actual, ...cambios }); aviso('Quitado'); alGuardar(); } catch (err) { setError(err.message); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo={TITULOS[campo]} alCerrar={alCerrar}>
      <form class="pila lo-tuyo-form" onSubmit={guardar}>
        {campo === 'apodo' && (
          <div class="campo">
            <label for="lt-apodo">Tu nombre en la app</label>
            <input id="lt-apodo" class="entrada" maxLength={LIMITES.apodo} value={f.apodo} onInput={(e) => cambiar({ apodo: e.currentTarget.value })} placeholder={(atleta.nombre || '').split(' ')[0]} autoFocus />
            <span class="ayuda">Así te saluda la app cada día y en tus celebraciones. Vacío, tu nombre.</span>
          </div>
        )}
        {campo === 'porque' && (
          <div class="campo">
            <label for="lt-porque">¿Por qué entrenas?</label>
            <textarea id="lt-porque" class="entrada" rows={3} maxLength={LIMITES.porque} value={f.porque} onInput={(e) => cambiar({ porque: e.currentTarget.value })} placeholder="Por mis hijos. Para llegar bien a los 50. Porque me sienta bien." autoFocus />
            <span class="ayuda num">{f.porque.trim().length} / {LIMITES.porque}. La app te lo recuerda al volver tras unos días sin entrenar.</span>
          </div>
        )}
        {campo === 'favoritos' && (
          <fieldset class="pila-s">
            <legend class="peq secundario">Los que más te importan: salen arriba en Progreso, con tu mejor marca.</legend>
            {ejercicios.cargando && !ejercicios.datos ? <p class="peq secundario">Cargando tus ejercicios…</p>
              : !(ejercicios.datos || []).length ? <p class="peq secundario">Cuando apuntes series con peso, aquí saldrán tus ejercicios.</p>
                : (ejercicios.datos || []).map((x) => {
                  const marcado = f.favoritos.includes(x.id);
                  return (
                    <label class="casilla" key={x.id}>
                      <input type="checkbox" checked={marcado} disabled={!marcado && f.favoritos.length >= LIMITES.favoritos}
                        onChange={() => cambiar({ favoritos: marcado ? f.favoritos.filter((i) => i !== x.id) : [...f.favoritos, x.id] })} />
                      <span>{x.nombre}</span>
                    </label>
                  );
                })}
            <span class="ayuda num">{f.favoritos.length} de {LIMITES.favoritos}</span>
          </fieldset>
        )}
        {campo === 'musica' && (
          <div class="campo">
            <label for="lt-musica">Enlace a tu lista</label>
            <input id="lt-musica" class="entrada" type="url" inputMode="url" maxLength={LIMITES.musica} value={f.musica_url} onInput={(e) => cambiar({ musica_url: e.currentTarget.value })} placeholder="https://open.spotify.com/playlist/…" autoFocus aria-invalid={musicaMal ? 'true' : undefined} />
            <span class={musicaMal ? 'error-campo' : 'ayuda'}>{musicaMal ? 'Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal.' : 'En tu app de música: Compartir → Copiar enlace. Saldrá un botón para abrirla al empezar cada sesión.'}</span>
          </div>
        )}
        {campo === 'cumple' && (
          <div class="pila-s">
            <div class="rejilla-2">
              <div class="campo">
                <label for="lt-dia">Día</label>
                <select id="lt-dia" class="selector" value={f.cumple_dia} onChange={(e) => cambiar({ cumple_dia: e.currentTarget.value === '' ? '' : Number(e.currentTarget.value) })}>
                  <option value="">—</option>
                  {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
              </div>
              <div class="campo">
                <label for="lt-mes">Mes</label>
                <select id="lt-mes" class="selector" value={f.cumple_mes} onChange={(e) => cambiar({ cumple_mes: e.currentTarget.value === '' ? '' : Number(e.currentTarget.value) })}>
                  <option value="">—</option>
                  {MESES_LARGOS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
            <span class={cumpleMal ? 'error-campo' : 'ayuda'}>{cumpleMal ? 'Elige un día que exista en ese mes.' : 'Sin el año: ese día la app te felicita y tu coach lo sabe.'}</span>
          </div>
        )}
        {error && <p class="error" role="alert">{error}</p>}
        <button class="btn btn-primario btn-grande" disabled={guardando || musicaMal || cumpleMal}><Icono n="hecho" /> {guardando ? 'Guardando…' : 'Guardar'}</button>
        {campo === 'cumple' && actual.cumple_mes && <button type="button" class="btn plano" disabled={guardando} onClick={() => quitar({ cumple_mes: null, cumple_dia: null })}>Quitar mi cumpleaños</button>}
        {campo === 'musica' && actual.musica_url && <button type="button" class="btn plano" disabled={guardando} onClick={() => quitar({ musica_url: null })}>Quitar el enlace</button>}
      </form>
    </Hoja>
  );
}
