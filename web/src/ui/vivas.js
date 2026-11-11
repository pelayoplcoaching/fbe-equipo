// Las ilustraciones que se mueven (imagenes.css, bloque V): con la app en segundo plano, se paran. Aquí solo se marca
// en <html> si la pestaña está oculta; lo demás es CSS (y solo transform y opacity). Con «reducir movimiento» no hay
// nada que parar: esas animaciones ni existen.
if (typeof document !== 'undefined' && !document.documentElement.dataset.vivas) {
  const raiz = document.documentElement;
  raiz.dataset.vivas = '1';
  const marcar = () => raiz.toggleAttribute('data-oculta', document.visibilityState === 'hidden');
  document.addEventListener('visibilitychange', marcar);
  marcar();
}
