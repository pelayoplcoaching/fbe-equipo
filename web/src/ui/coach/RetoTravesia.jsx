// «La travesía» (remate, tanda 8, migración 063): el reto de la semana que pone el coach para todo el equipo dentro del
// juego del descanso («entre todos, 40 km»). Lo ven quienes están en la comunidad, con su barra, en «Tu travesía».
import { useEffect, useState } from 'preact/hooks';
import { useApp, Icono } from '../comunes.jsx';

const km = (m) => String(Math.round(m / 100) / 10).replace('.', ',');

export function RetoTravesia() {
  const { api, aviso } = useApp();
  const [datos, setDatos] = useState(undefined);   // undefined: cargando; null: sin la 063
  const [kms, setKms] = useState('');
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cargar = () => api.equipoTravesia().then((q) => { setDatos(q); if (q?.reto) { setKms(String(Math.round(q.reto.metros / 1000))); setTexto(q.reto.texto || ''); } }).catch(() => setDatos(null));
  useEffect(() => { cargar(); }, []);
  if (datos === undefined) return null;
  const guardar = async (quitar = false) => {
    setOcupado(true);
    try {
      await api.ponerRetoTravesia(quitar ? 0 : Math.round(Number(String(kms).replace(',', '.')) * 1000), texto);
      aviso?.(quitar ? 'Reto quitado' : 'Reto de La travesía puesto para esta semana');
      if (quitar) { setKms(''); setTexto(''); }
      await cargar();
    } catch (e) { aviso?.(e.message || 'No se ha podido guardar', 'error'); }
    setOcupado(false);
  };
  const valido = Number(String(kms).replace(',', '.')) >= 1 && Number(String(kms).replace(',', '.')) <= 10000;
  return (
    <section class="panel tv-reto-coach" aria-labelledby="tv-reto-coach-t">
      <h3 id="tv-reto-coach-t"><Icono n="luna" /> El reto de La travesía</h3>
      {datos === null
        ? <p class="secundario">Para poner un reto en el juego del descanso falta ejecutar la migración 063 en Supabase.</p>
        : <>
          <p class="secundario">Un objetivo para esta semana, entre todos, con lo que corren sus lobos en los descansos. {datos.reto ? `Llevan ${km(datos.reto.hecho)} de ${km(datos.reto.metros)} km.` : `Esta semana llevan ${km(datos.semana || 0)} km.`}</p>
          <div class="campo"><label for="tv-reto-km">Kilómetros entre todos</label>
            <input id="tv-reto-km" class="entrada" inputMode="decimal" placeholder="40" value={kms} onInput={(e) => setKms(e.currentTarget.value)} /></div>
          <div class="campo"><label for="tv-reto-texto">Frase (opcional)</label>
            <input id="tv-reto-texto" class="entrada" maxLength={80} placeholder="Entre todos, hasta Covadonga" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} /></div>
          <div class="fila">
            <button type="button" class="btn btn-primario" disabled={ocupado || !valido} onClick={() => guardar(false)}>{datos.reto ? 'Cambiar el reto' : 'Poner el reto'}</button>
            {datos.reto && <button type="button" class="btn" disabled={ocupado} onClick={() => guardar(true)}>Quitarlo</button>}
          </div>
        </>}
    </section>
  );
}
