// (tacto 243) Lo que el buscador de «Más» le pide a una pantalla que tiene su propio buscador (Recetas, Aprende): que
// se abra con ese texto ya puesto. Si la pantalla ya está a la vista, se lo dice con un aviso (EVENTO_BUSCA).
export const EVENTO_BUSCA = 'fbe-busca';
const pedidas = {};
export function pedirBusqueda(donde, texto) {
  pedidas[donde] = String(texto || '');
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_BUSCA, { detail: donde }));
}
export function tomarBusqueda(donde) {
  const t = pedidas[donde] || '';
  delete pedidas[donde];
  return t;
}
