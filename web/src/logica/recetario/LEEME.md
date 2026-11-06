# El recetario al día con el plan

Para el coach: ¿lo que come un atleta un día cualquiera con sus recetas cuadra con su plan? Y, si no, por qué y cómo
arreglarlo.

## Lo que dijeron los datos (copia del 5 nov 2026, solo cifras agregadas)

La idea de partida era «cuando cambies las kcal, proponer el factor nuevo de todas las recetas». Medirlo cambió dos cosas:

**1. Los recetarios que no cuadraban no tenían un problema de factor.**

- De 11 atletas con recetario, 2 daban un 12 % y un 5,5 % más de kcal que su plan. Pero sus macros sí cuadraban
  (proteína, hidratos y grasa a menos de 7 g del plan). Lo que estaba mal eran las **kcal apuntadas en sus recetas**,
  un 9–10 % por encima de lo que dan sus propios macros.
- En total, 152 de 574 recetas tenían las kcal a más de un 5 % (y de 25 kcal) de las de sus macros, casi todas por
  arriba: 65 de 65 y 54 de 69 en esos dos atletas, y 16 y 17 en otros dos (que en conjunto sí cuadraban).
- Corrigiendo esas kcal a partir de los macros, **los 11 recetarios cuadran** con su plan (el que más se aleja, un 2,9 %).
- Ninguna receta se comparte entre atletas (574 recetas, cada una en un solo recetario): corregir las de uno no toca a otro.

**2. El factor no puede seguir un cambio de plan como los que propone la app.**

- El ajuste semanal de la app (`ajusteNutricion`) mueve solo los hidratos y deja la proteína fija. El factor multiplica
  todos los macros a la vez.
- Simulando −200 kcal en los 11 recetarios: con un factor único las kcal quedan exactas, pero la proteína baja unos
  14 g (mediana) y los hidratos quedan unos 29 g por encima del plan nuevo. Con un factor distinto por comida apenas
  mejora (13 g y 27 g): las comidas de un mismo atleta tienen una composición parecida.
- Para seguir de verdad un cambio de solo hidratos habría que cambiar el ingrediente de hidratos de cada receta, y eso
  pide los valores nutricionales de cada alimento, que la app no tiene.

## Qué hace (decisiones de Pelayo)

1. **Comprobador y factor con aviso**: las dos cosas, sabiendo el límite del factor.
2. Cuando las kcal de una receta no coinciden con sus macros, **mandan los macros**: el botón recalcula las kcal
   (4 por gramo de proteína y de hidratos, 9 por gramo de grasa). Los macros y las cantidades no se tocan.

### El comprobador

- **El día medio**: de cada comida del atleta, la media de sus recetas (con su factor); la suma es el día. Se compara
  con el plan vigente (kcal y cada macro). Con comida opcional, también el día sin ella.
- **Cuadra** si las kcal quedan a menos de un 5 % y cada macro a menos de un 7 % (o de 5 g).
- **Estados**: cuadra · cuadra, pero hay recetas con las kcal mal · las kcal de las recetas están mal (no cuadra en
  kcal y, corregidas, cuadraría) · no cuadra · faltan recetas para alguna comida · sin plan con kcal · sin recetas.
- **Recetas con las kcal mal**: a más de un 5 % y de 25 kcal de las de sus macros. Se enseñan con lo que tienen y lo
  que les toca, y se corrigen todas de una vez (con confirmación: las kcal de antes no se pueden recuperar).
- **Recetas fuera de línea**: a más de un 10 % de la mediana de su comida (con tres o más recetas del mismo tipo de
  día). Solo se señalan.
- **El plan**: avisa si las kcal del plan no coinciden con las de sus propios macros (más de un 3 %).

### El factor

- Calcula el multiplicador que deja las kcal del día medio en las del plan, para **todas las comidas o para las que se
  elijan** (las demás no se tocan). Parte del factor que ya tenga cada receta y respeta el margen de la base (0,25 a 5).
- **Antes de aplicarlo** enseña cómo quedaría el día: kcal y cada macro frente al plan. Si algún macro deja de cuadrar,
  lo avisa («el factor mueve todos los macros a la vez…»).
- No se ofrece mientras haya recetas con las kcal mal: el factor se calcula con ellas.
- Con confirmación: el atleta verá las cantidades nuevas en su app.

### El menú ya apuntado

Las comidas que el atleta ya tiene apuntadas llevan los macros de cuando se apuntaron. Al corregir kcal o aplicar un
factor, las apuntadas **desde hoy y sin comer** se ponen al día con su recetario de ahora. Lo pasado y lo ya comido no
se toca.

### Dónde

- Ficha del atleta → Nutrición → Recetario → **«Comprobar con el plan»**.
- Biblioteca → Recetas → **«Comprobar recetarios»**: todos los atletas con recetario, primero los que no cuadran; al
  tocar uno se abre su comprobación.

## Archivos

| Archivo | Qué |
| --- | --- |
| `logica/recetario/comprobar.js` | `comprobarRecetario`, `diaMedio`, `diferencia`, `cuadra`, `recetasConKcalMal`, `recetasFueraDeLinea`, `reescalar`, `menuPorActualizar`, `ordenRecetarios` y los textos. Lógica pura; usa `comidas.js` y `nutricion.js` sin cambiarlos. |
| `datos/recetario.js` | `datosRecetario`, `corregirKcal`, `aplicarFactores` (una actualización por cada factor distinto) y `recetariosDelEquipo` (cinco consultas para todos, sin las fotos). No toca `api.js`. |
| `ui/coach/ComprobarRecetario.jsx` | `HojaComprobarRecetario` y `HojaRecetariosEquipo`. Sin CSS nuevo. |
| `test/recetario.test.mjs` | 77 comprobaciones de lógica y de lectura y guardado contra la demo. |
| `test/e2e-recetario.mjs` | 23 comprobaciones en el navegador (escritorio y 360 px en oscuro). |
| `test/recetario-enganche.patch` | Las 6 líneas de `ComidasCoach.jsx` que ponen los dos botones. No están aplicadas en esta rama. |

## Para integrarlo

1. Aplicar `test/recetario-enganche.patch` (`git apply test/recetario-enganche.patch`) o poner a mano en
   `web/src/ui/coach/ComidasCoach.jsx`: el `import`; en `RecetarioCoach`, el botón «Comprobar con el plan»
   (`setHoja('comprobar')`) y `{hoja === 'comprobar' && <HojaComprobarRecetario atleta={atleta} alCerrar={…} alCambiar={recargar} />}`;
   en `RecetasBiblioteca`, el estado `equipo`, el botón «Comprobar recetarios» y `<HojaRecetariosEquipo … />`.
2. Añadir `node test/recetario.test.mjs` al script `test` de `package.json` y `probarRecetario` a `test/e2e.test.mjs`.
3. No lleva migración ni cambia permisos: solo el coach puede cambiar recetas y factores, como ya pasa.

## Lo que hay que saber

- Corregir las kcal de muchas recetas hace una actualización por receta y la base devuelve cada fila entera (con su
  foto): con 65 recetas tarda unos segundos. Es una operación de una vez.
- El factor se guarda con dos decimales (×0,93). El editor de una receta lo mueve de 0,25 en 0,25: al tocarlo a mano
  desde ahí saltará al cuarto más cercano.
- Las cantidades que ve el atleta ya se redondean como se mide en casa (gramos de 5 en 5), con cualquier factor.

## Lo que no hace (a propósito)

- No cambia ingredientes ni macros de ninguna receta: solo sus kcal (a las de sus macros) y el factor.
- No sigue un cambio de solo hidratos manteniendo la proteína: con un factor no se puede (ver arriba). Lo dice antes
  de aplicar.
- No corrige solo: todo pasa por un botón y una confirmación.
