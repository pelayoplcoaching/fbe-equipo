// Los suplementos del atleta (migración 077): en Hoy los marca con un toque; en su hoja añade los suyos (de la lista de
// FBE o con sus palabras), quita los que puso él y elige la hora de su aviso al móvil. Los que le pauta su coach no los
// cambia. Solo suplementos: no es para medicación.
import { useState } from 'preact/hooks';
import { esPorSuCuenta } from '../../logica/esencial.js';
import { useApp, useCarga, Hoja, Icono, IcoIos, useUnaVez } from '../comunes.jsx';
import { suplementosDeHoy, detalleSuplemento, porAnadir, constanciaSuplemento, MOMENTOS, MAX_SUPLEMENTOS, MAX_NOMBRE, MAX_DOSIS, HORA_MIN, HORA_MAX, horaValida } from '../../logica/suplementos.js';
import { fechaMadrid } from '../../logica/fechas.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { imagenSuplemento } from '../../logica/imagenes.js';

// (imágenes, tanda 11) el dibujo del suplemento, si es de la lista de FBE
const Dibujo = ({ s }) => (hayImagen(imagenSuplemento(s)) ? <Imagen id={imagenSuplemento(s)} clase="supl-img" tamanos="40px" /> : null);

// Sus suplementos y lo que ha marcado (null sin la 077 o en el modo atleta del coach: no se ofrece nada)
export function useSuplementos() {
  const { api, atleta, propio } = useApp();
  return useCarga(() => (propio ? Promise.resolve(null) : api.suplementos().catch(() => null)), [atleta.id, propio], { recuerdo: `suplementos:${atleta.id}` });
}

// En Hoy: lo que toma, para marcarlo con un toque (solo si tiene alguno)
export function TarjetaSuplementos({ estado }) {
  const { api, aviso, atleta } = useApp();
  const [abierta, setAbierta] = useState(false);
  const d = estado.datos;
  if (!d || atleta.estado === 'baja') return null;
  const hoy = fechaMadrid();
  const { lista, quedan, total } = suplementosDeHoy(d, hoy);
  if (!total && !abierta) return null;
  // Se ve al momento y se guarda por detrás (si no se puede guardar, vuelve a como estaba y se avisa)
  const marcar = (s) => estado.alMomento((x) => ({ ...x, tomas: s.tomado ? x.tomas.filter((t) => !(t.suplemento_id === s.id && t.fecha === hoy)) : [...x.tomas.filter((t) => !(t.suplemento_id === s.id && t.fecha === hoy)), { suplemento_id: s.id, fecha: hoy }] }),
    () => api.tomarSuplemento(s.id, hoy, !s.tomado)).catch((e) => aviso(e.message, 'error'));
  return (
    <>
      {total > 0 && (
        <section class="panel panel-pad pila-s tarjeta-suplementos" aria-label="Tus suplementos">
          <div class="separa">
            <strong>Tus suplementos</strong>
            <span class={`chip ${quedan ? '' : 'ok'}`}>{quedan ? (quedan === 1 ? 'Te queda 1' : `Te quedan ${quedan}`) : 'Hecho por hoy'}</span>
          </div>
          <ul class="suplementos-lista">
            {lista.map((s) => (
              <li key={s.id}>
                <button type="button" class="suplemento-fila" aria-pressed={s.tomado ? 'true' : 'false'} onClick={() => marcar(s)}>
                  <span class="suplemento-marca" aria-hidden="true">{s.tomado && <Icono n="hecho" />}</span>
                  <span class="pila-xs"><span class="suplemento-nombre">{s.nombre}</span>{detalleSuplemento(s) && <span class="mini secundario">{detalleSuplemento(s)}</span>}</span>
                  <Dibujo s={s} />
                </button>
              </li>
            ))}
          </ul>
          <button class="btn-texto peq" style="justify-self:start" onClick={() => setAbierta(true)}>Añadir, quitar o poner un aviso</button>
        </section>
      )}
      {abierta && <HojaSuplementos estado={estado} alCerrar={() => setAbierta(false)} />}
    </>
  );
}

// En Perfil: la fila para verlos y añadir el primero
export function FilaSuplementos() {
  const estado = useSuplementos();
  const [abierta, setAbierta] = useState(false);
  const d = estado.datos;
  if (!d) return null;
  const n = (d.suplementos || []).filter((s) => s.activo !== false).length;
  return (
    <li class="panel-pad pila-s">
      <div class="separa">
        <div class="fila-ios-izq"><IcoIos n="proteina" /><div><div>Tus suplementos</div>
          <div class="peq terciario">{n ? `${n === 1 ? 'Uno' : n} en tu lista: los marcas en Hoy` : 'Creatina, proteína y similares, con su recordatorio'}</div></div></div>
        <button class="btn btn-peq" onClick={() => setAbierta(true)}>{n ? 'Ver' : 'Añadir'}</button>
      </div>
      {abierta && <HojaSuplementos estado={estado} alCerrar={() => setAbierta(false)} />}
    </li>
  );
}

const NUEVO = { clave: null, nombre: '', dosis: '', momento: 'cuando' };

export function HojaSuplementos({ estado, alCerrar }) {
  const { api, aviso, atleta } = useApp();
  const [f, setF] = useState(null);         // el que se está añadiendo o cambiando
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const d = estado.datos || { suplementos: [], tomas: [] };
  const hoy = fechaMadrid();
  const activos = (d.suplementos || []).filter((s) => s.activo !== false);
  const lleno = activos.length >= MAX_SUPLEMENTOS;
  const hacer = (fn, hecho) => una(async () => { setError(null); try { await fn(); await estado.recargar(true); if (hecho) aviso(hecho); return true; } catch (e) { setError(e.message); return false; } });
  const guardar = (e) => { e.preventDefault(); hacer(() => api.guardarSuplemento(null, f), f.id ? 'Cambiado' : 'Añadido a tu lista').then((bien) => { if (bien) setF(null); }); };
  const ponerAviso = (s, hora) => { if (hora && !horaValida(hora)) { setError('La hora del aviso, entre las 5:00 y las 23:30.'); return; } hacer(() => api.avisoSuplemento(s.id, hora || null), hora ? `Te avisaremos a las ${hora}` : 'Aviso quitado'); };

  if (f) {
    return (
      <Hoja titulo={f.id ? 'Cambiar suplemento' : 'Añadir suplemento'} alCerrar={() => { setF(null); setError(null); }}>
        <form class="pila" onSubmit={guardar} noValidate>
          <div class="campo"><label for="su-nombre">Nombre</label><input id="su-nombre" class="entrada" maxLength={MAX_NOMBRE} value={f.nombre} onInput={(e) => setF({ ...f, nombre: e.currentTarget.value, clave: null })} placeholder="Creatina, zinc…" /></div>
          <div class="campo"><label for="su-dosis">Dosis (opcional)</label><input id="su-dosis" class="entrada" maxLength={MAX_DOSIS} value={f.dosis || ''} onInput={(e) => setF({ ...f, dosis: e.currentTarget.value })} placeholder="5 g, 1 cápsula…" /></div>
          <div class="campo"><label for="su-momento">Cuándo</label>
            <select id="su-momento" class="selector" value={f.momento} onChange={(e) => setF({ ...f, momento: e.currentTarget.value })}>{MOMENTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
          <p class="mini terciario">Solo suplementos. La medicación no se apunta aquí: si tienes dudas con algo que tomas, {esPorSuCuenta(atleta) ? 'consúltalo con tu médico o tu farmacéutico' : 'escribe a tu coach'}.</p>
          {error && <div class="error" role="alert">{error}</div>}
          <button class="btn btn-primario btn-grande" disabled={ocupado || !f.nombre.trim()}>{f.id ? 'Guardar' : 'Añadir'}</button>
        </form>
      </Hoja>
    );
  }

  return (
    <Hoja titulo="Tus suplementos" alCerrar={alCerrar}>
      <div class="pila hoja-suplementos">
        {!activos.length ? <p class="secundario">Aún no tienes ninguno. Elige de la lista o añade el tuyo: lo marcarás cada día en Hoy.</p> : (
          <ul class="lista suplementos-mios">
            {activos.map((s) => {
              const c = constanciaSuplemento(s, d.tomas, hoy);
              return (
                <li key={s.id} class="panel-pad pila-s">
                  <div class="separa">
                    <span class="fila supl-con-img"><Dibujo s={s} /><span class="pila-xs"><strong>{s.nombre}</strong>
                      <span class="mini secundario">{[detalleSuplemento(s), s.origen === 'coach' ? (esPorSuCuenta(atleta) ? 'Te lo ha puesto Pelayo' : 'Te lo ha pautado tu coach') : null].filter(Boolean).join('. ')}</span>
                      {c.de > 0 && <span class="mini terciario num">{c.tomados} de {c.de} días{c.racha > 1 ? `, ${c.racha} seguidos` : ''}</span>}</span></span>
                    {s.origen === 'atleta' && (
                      <span class="fila">
                        <button class="btn btn-icono plano" aria-label={`Cambiar ${s.nombre}`} onClick={() => { setError(null); setF({ id: s.id, clave: s.clave, nombre: s.nombre, dosis: s.dosis || '', momento: s.momento }); }}><Icono n="editar" /></button>
                        <button class="btn btn-icono plano" aria-label={`Quitar ${s.nombre}`} disabled={ocupado} onClick={() => hacer(() => api.quitarSuplemento(s.id), 'Quitado de tu lista')}><Icono n="basura" /></button>
                      </span>
                    )}
                  </div>
                  <div class="suplemento-aviso">
                    <label for={`su-hora-${s.id}`} class="peq"><Icono n="campana" /> Aviso al móvil</label>
                    <input id={`su-hora-${s.id}`} type="time" class="entrada entrada-hora" min={HORA_MIN} max={HORA_MAX} value={s.aviso_hora || ''} disabled={ocupado}
                      onChange={(e) => ponerAviso(s, e.currentTarget.value)} />
                    {s.aviso_hora && <button class="btn-texto mini" disabled={ocupado} onClick={() => ponerAviso(s, null)}>Quitar aviso</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {activos.some((s) => s.aviso_hora) && <p class="mini terciario">El aviso llega a esa hora (hora de España) solo si aún no lo has marcado, y con las notificaciones activadas en este móvil.</p>}
        {error && <div class="error" role="alert">{error}</div>}
        {lleno ? <p class="peq secundario">Tienes {MAX_SUPLEMENTOS}, el máximo: quita alguno para añadir otro.</p> : (
          <div class="pila-s">
            <span class="etq" id="su-lista">Añadir de la lista de FBE</span>
            <div class="opciones opciones-suplemento" role="group" aria-labelledby="su-lista">
              {porAnadir(activos).map((x) => (
                <button type="button" key={x.clave} disabled={ocupado} onClick={() => hacer(() => api.guardarSuplemento(null, x), `${x.nombre}, en tu lista`)}>
                  <Dibujo s={x} />
                  <span class="pila-xs"><span>{x.nombre}</span><span class="mini secundario">{x.dosis}</span></span>
                </button>
              ))}
            </div>
            <button class="btn btn-peq" style="justify-self:start" onClick={() => { setError(null); setF({ ...NUEVO }); }}><Icono n="mas" /> Añadir otro</button>
            <p class="mini terciario">{esPorSuCuenta(atleta) ? 'Las dosis son las habituales en adultos sanos: ante la duda, consúltalo con tu médico o tu farmacéutico.' : 'Las dosis son las habituales en adultos sanos: tu coach te dirá la tuya.'} Solo suplementos, no medicación.</p>
          </div>
        )}
      </div>
    </Hoja>
  );
}
