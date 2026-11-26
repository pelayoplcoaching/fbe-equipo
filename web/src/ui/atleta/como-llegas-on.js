// (v0.258) ¿Va con «¿Cómo llegas hoy?» de un toque? Quien va por su cuenta, con la clave 'como_llegas' encendida (o en la
// vista previa de la demo, ?previa=1) y con la migración 110 en la base. (Sin estilos: lo pueden importar la sesión y la
// hoja del dial sin arrastrar nada.)
import { useApp, useCarga } from '../comunes.jsx';
import { encendido } from '../../logica/esencial-respuestas.js';
import { esPorSuCuenta } from '../../logica/esencial.js';
import { hay110 } from '../../datos/api-como-llegas.js';

export function useUnToque() {
  const { backend, atleta, modo } = useApp();
  let previa = false;
  try { previa = modo === 'demo' && /[?&]previa=1(&|$)/.test(location.search); } catch { /* sin location */ }
  const on = !!atleta && esPorSuCuenta(atleta) && encendido('como_llegas', previa);
  const r = useCarga(() => (on && backend ? hay110(backend) : Promise.resolve(false)), [on]);
  return on && r.datos === true;
}
