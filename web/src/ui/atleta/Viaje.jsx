// (v0.143) De viaje por zona horaria: en Hoy, si el móvil está en otra hora que España, qué hora es en cada sitio, que su
// día en la app va con su hora y a qué hora de allí le llegarían las notificaciones (que siguen la hora de España). Con un
// toque, las ajusta para no recibir nada de noche allí (el «no molestar» y los recordatorios del día; lo que no cabe, apagado
// mientras viaja). Al volver, las deja como estaban. Lo del viaje, en este móvil (fbe-viaje:<uid>); las notificaciones son
// sus preferencias de siempre.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, usePreferencia, Icono } from '../comunes.jsx';
import { leerPreferencia } from '../preferencias.js';
import { estadoViaje, textoDesfase, horaAqui, horaBonita, ajusteDeViaje, ajusteAplicado, previoDeViaje, deshacerViaje, prefsDeCasa } from '../../logica/viaje.js';

export const claveViaje = (uid) => `fbe-viaje:${uid || 'sin-cuenta'}`;

// ¿Está de viaje? (con las zonas que haya marcado como «Vivo aquí»), para quien solo necesita saberlo
export function useDeViaje() {
  const { api } = useApp();
  const casa = leerPreferencia(claveViaje(api?.uid?.()), {})?.casa;
  return useMemo(() => estadoViaje({ casa: Array.isArray(casa) ? casa : [] }), [Array.isArray(casa) ? casa.join() : '']);
}

export function AvisoViaje() {
  const { api, aviso } = useApp();
  const [g, setG] = usePreferencia(claveViaje(api.uid()), {});
  const guardado = g && typeof g === 'object' ? g : {};
  const casa = Array.isArray(guardado.casa) ? guardado.casa : [];
  const est = useMemo(() => estadoViaje({ casa }), [casa.join()]);
  const ver = est.deViaje && guardado.visto !== est.tz;
  const volver = !est.deViaje && !!guardado.previo;
  const datos = useCarga(() => (ver || volver
    ? Promise.all([api.preferenciasNotificaciones(), api.suscripcionesPush().catch(() => [])]).then(([prefs, subs]) => ({ prefs, subs: subs || [] }))
    : Promise.resolve(null)), [ver, volver]);
  const [hecho, setHecho] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  // De vuelta: la próxima vez que viaje a esa zona, el aviso vuelve a salir
  useEffect(() => { if (!est.deViaje && guardado.visto) setG({ ...guardado, visto: null }); }, [est.deViaje]);

  if (!ver && !volver) return null;
  const prefs = datos.datos?.prefs || null;
  const conAvisos = !!prefs && ((datos.datos?.subs || []).length > 0 || prefs.email);

  if (volver) {
    const restaurar = async () => {
      setOcupado(true);
      try {
        await api.guardarPreferenciasNotificaciones(deshacerViaje(prefs, guardado.previo));
        setG({ ...guardado, previo: null });
        aviso('Tus notificaciones, como las tenías');
      } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
    };
    return (
      <section class="panel panel-pad aviso-viaje pila-s" aria-labelledby="viaje-vuelta">
        <div class="aviso-viaje-cab">
          <span class="ios-ico" aria-hidden="true"><Icono n="ubicacion" /></span>
          <span class="pila-xs"><h2 id="viaje-vuelta">De vuelta en hora de España</h2>
            <span class="peq secundario">De viaje ajustaste tus notificaciones a la hora de allí. ¿Las dejas como las tenías antes?</span></span>
        </div>
        <div class="fila-envolver">
          <button type="button" class="btn btn-primario" onClick={restaurar} disabled={!prefs || ocupado}>Volver a como las tenía</button>
          <button type="button" class="btn-texto" onClick={() => setG({ ...guardado, previo: null })}>Dejarlas así</button>
        </div>
      </section>
    );
  }

  const aplicado = !!hecho || (prefs && ajusteAplicado(prefs, est.desfase, guardado.previo));
  const ajustar = async () => {
    setOcupado(true);
    try {
      // siempre desde las de casa (si ya las ajustó en otra zona de este viaje, sin aquello)
      const a = ajusteDeViaje(prefsDeCasa(prefs, guardado.previo), est.desfase);
      await api.guardarPreferenciasNotificaciones({ ...prefs, ...a.cambios });
      // lo de antes, solo la primera vez (si cambia de zona en el mismo viaje, al volver se deja como en casa); lo apagado, se suma
      const previo = guardado.previo ? { ...guardado.previo, apagados: [...new Set([...(guardado.previo.apagados || []), ...a.apagados])] } : previoDeViaje(prefs, a.apagados);
      setG({ ...guardado, previo });
      setHecho(a.lineas);
    } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const manana = prefs && !(prefs.desactivados || []).includes('sesion_hoy');
  const lineas = hecho || (aplicado && prefs ? ajusteDeViaje(prefsDeCasa(prefs, guardado.previo), est.desfase).lineas : null);
  return (
    <section class="panel panel-pad aviso-viaje pila-s" aria-labelledby="viaje-tit">
      <div class="aviso-viaje-cab">
        <span class="ios-ico" aria-hidden="true"><Icono n="ubicacion" /></span>
        <span class="pila-xs">
          <h2 id="viaje-tit">De viaje: en {est.nombre} son las {horaBonita(est.aqui)}</h2>
          <span class="peq secundario">{textoDesfase(est.desfase).replace(/^./, (c) => c.toUpperCase())} (allí, las {horaBonita(est.espana)}). Lo que hagas cuenta en tu día de aquí; tu coach y la comunidad siguen la hora de España.</span>
        </span>
      </div>
      {conAvisos && (aplicado ? (
        <div class="aviso-viaje-ok" role="status">
          <Icono n="hecho" />
          <span class="pila-xs"><strong>Notificaciones a tu hora de aquí</strong>{lineas.map((l) => <span key={l} class="peq">{l}</span>)}</span>
        </div>
      ) : (
        <div class="pila-s">
          <p class="peq">Tus notificaciones van con la hora de España: {manana
            ? <>la de la sesión ({horaBonita(prefs.hora_manana)} allí) te llegaría a las {horaBonita(horaAqui(prefs.hora_manana, est.desfase))} de aquí.</>
            : <>las de la tarde ({horaBonita(prefs.hora_tarde)} allí) te llegarían a las {horaBonita(horaAqui(prefs.hora_tarde, est.desfase))} de aquí.</>}</p>
          <button type="button" class="btn btn-ancho" onClick={ajustar} disabled={ocupado}><Icono n="silencio" /> Ajustarlas a mi hora mientras viajo</button>
        </div>
      ))}
      <p class="mini terciario">¿Entrenas en el hotel? En la sesión, «¿Dónde entrenas hoy?» → Viaje, con tu material.</p>
      <div class="fila-envolver">
        <button type="button" class="btn btn-primario" onClick={() => setG({ ...guardado, visto: est.tz })}>Entendido</button>
        <button type="button" class="btn-texto" onClick={() => setG({ ...guardado, casa: [...new Set([...casa, est.tz])], visto: est.tz })}>Vivo aquí</button>
      </div>
    </section>
  );
}
