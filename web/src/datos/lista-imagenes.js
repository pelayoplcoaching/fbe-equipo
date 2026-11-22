// (v0.207) La lista de las ilustraciones (id → proporción y archivos) y la de qué imagen lleva cada ejercicio, juntas en su
// propio trozo: no van en el arranque. Las pide logica/imagenes.js (cargarListaImagenes) al abrir la app.
import LISTA from './imagenes.json' with { type: 'json' };
import EJERCICIOS_IMG from './ejercicios-imagenes.json' with { type: 'json' };

export { LISTA, EJERCICIOS_IMG };
