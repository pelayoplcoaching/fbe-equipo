// (tacto 224, v0.272) Los atajos de la barra de abajo: lo que ofrece cada pestaña al mantenerla pulsada. Aquí, cuáles
// (probado en test/tacto.test.mjs); quien los pinta y los hace, ui/atleta/barra-gestos.jsx.

// Cuánto hay que mantener pulsada una pestaña para que salgan
export const LARGO_MS = 450;
export const ICONO_SUB = 'progreso';
const ICONOS_SUB = { resumen: 'progreso', fuerza: 'disco', cuerpo: 'bascula', logros: 'trofeo' };

// id: la pestaña ('hoy', 'progreso', 'mas'…). tabs: las que tiene este atleta; mas: las que van en «Más» ([id, texto,
// icono]); ultimo: lo último que abrió desde «Más»; conPeso: si apunta su peso; subs: las partes de Progreso ([id, texto]).
// Devuelve [{ que: 'empezar' | 'peso' | 'ir' | 'sub', id?, texto, icono }] (vacío: esa pestaña no tiene atajos)
export function atajosDe(id, { tabs = [], mas = [], ultimo = null, conPeso = false, subs = [] } = {}) {
  if (id === 'hoy') {
    return [
      { que: 'empezar', texto: 'Empezar la sesión', icono: 'play' },
      tabs.includes('checkin') ? { que: 'ir', id: 'checkin', texto: 'Check-in', icono: 'checkin' } : null,
      conPeso ? { que: 'peso', texto: 'Tu peso', icono: 'bascula' } : null,
    ].filter(Boolean);
  }
  if (id === 'progreso') return subs.map(([k, t]) => ({ que: 'sub', id: k, texto: t, icono: ICONOS_SUB[k] || ICONO_SUB }));
  if (id === 'mas') {
    const p = mas.find(([t]) => t === ultimo);
    return p ? [{ que: 'ir', id: p[0], texto: p[1], icono: p[2] }] : [];
  }
  return [];
}
