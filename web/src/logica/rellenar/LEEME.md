# «Rellenar la semana»: el menú de la semana de un toque

Un botón en el menú semanal (del atleta y de la ficha del coach) que propone lo que falta de la semana con las
recetas del recetario del atleta. Se revisa, se cambia o se quita lo que no guste y se apunta de una vez.

## Por qué no «cuadra macros»

La idea de partida era un motor que buscase la combinación de recetas que cae en las kcal y los macros del día. Al
medirlo en una copia (5 nov 2026, solo cifras agregadas) resultó que **no hay nada que buscar**:

- Los recetarios están montados de forma que todas las recetas de una misma comida tienen casi las mismas kcal (la
  desviación típica dentro de una comida va de 0 a 10 kcal en la mayoría).
- Con 3.000 días al azar por atleta (una receta por comida), en 9 de 11 atletas cualquier combinación cae a un 1 % de
  sus kcal y a 1 g de su proteína.
- En los otros 2, **todas** las combinaciones se pasan lo mismo (un 12 % y un 5,5 %): el recetario está calculado para
  más kcal que el plan. Eso no se arregla eligiendo recetas, sino con el factor de las recetas.

Lo que sí faltaba: de 11 atletas con recetario, 5 no habían usado nunca el menú semanal y 3 solo un día. Elegir 28
recetas una a una es el freno; solo existía «copiar la semana anterior».

## Qué hace (decisiones de Pelayo)

| Decisión | Cómo queda |
| --- | --- |
| Comidas y cenas | A elegir al rellenar: **Variada** (una receta distinta cada día, hasta donde dé el recetario; de serie) o **Cocinar para dos días** (cada receta, dos días seguidos). |
| Desayunos, medias mañanas y meriendas | **Dos opciones que se alternan** por días. Las favoritas, primero. |
| Lo ya apuntado | **Solo rellena los huecos.** Nunca borra ni cambia nada. |
| Quién | **El atleta y el coach** (es la misma pantalla). |

Y, sin preguntar:

- En la semana en curso solo rellena **desde hoy**; una semana ya pasada no se rellena.
- No repite, si puede, lo que salió **la semana pasada**, ni lo que ya está apuntado esta semana. Eso pesa más que ser
  favorita.
- La misma receta **no sale dos veces el mismo día** (hay recetarios con recetas que valen para comida y cena) ni, en
  «Variada», dos días seguidos.
- En «Cocinar para dos días» las cenas van **un día desplazadas** respecto a las comidas: salvo el primer día, cada
  día se cocina una sola cosa (8 veces de cocinar en vez de 14).
- Los días **sin la comida opcional** («hoy sin merienda») no reciben esa comida y llevan las recetas de ese tipo de día.
- Una comida **sin recetas** en el recetario se queda sin rellenar, y lo dice.
- La misma entrada da siempre la misma propuesta; **«Otra propuesta»** la cambia. **«Cambiar»** pasa por todas las
  recetas de esa comida antes de repetir, empezando por las que no salen en el resto de la semana.
- Solo al **coach**: si los días completos se alejan un 5 % o más de las kcal del plan, lo avisa («revisa el factor de
  sus recetas»). Al atleta no se le enseña.

## Lo medido con los recetarios de la copia

Para la semana siguiente de los 11 atletas con recetario:

- «Variada»: 28 comidas (35 con cinco comidas al día), de 17 a 20 recetas distintas, 14 veces de cocinar. Ninguna
  receta repetida el mismo día ni dos días seguidos.
- «Cocinar para dos días»: de 11 a 15 recetas distintas y 8 veces de cocinar (11 en el atleta con días sin merienda,
  porque esos días llevan otras recetas).
- «Otra propuesta» cambia más de la mitad de las comidas en todos (de 17 a 28).
- El desvío frente al plan sale igual que en la medición al azar: 9 atletas dentro del 1,5 %, uno en +5,5 % y otro en
  +12,2 % (los dos que verían el aviso).

## Archivos

| Archivo | Qué |
| --- | --- |
| `logica/rellenar/rellenar.js` | `rellenarSemana`, `opcionesDe`, `cambiarPropuesta`, `filasDePropuesta`, `totalesDePropuesta`, `descuadreDePlan`, `textoPropuesta`. Lógica pura; usa `comidas.js` y `nutricion.js` sin cambiarlos. |
| `datos/rellenar.js` | `menuAnterior` y `guardarRelleno`: vuelve a leer la semana antes de guardar (un hueco que se haya llenado mientras tanto no se pisa ni se duplica) y hace una sola inserción en `menu_comidas`, con las mismas filas que crea la app al apuntar una receta a mano. No toca `api.js`. |
| `ui/RellenarSemana.jsx` | `HojaRellenar`, la hoja. Sin CSS nuevo. |
| `test/rellenar.test.mjs` | 68 comprobaciones de lógica y de lectura y guardado contra la demo (como coach y como atleta). |
| `test/e2e-rellenar.mjs` | 23 comprobaciones en el navegador (coach en escritorio; atleta a 360 px en oscuro). |
| `test/rellenar-enganche.patch` | Las 3 líneas de `ComidasComun.jsx` que ponen el botón y abren la hoja. No están aplicadas en esta rama. |

## Para integrarlo

1. Aplicar `test/rellenar-enganche.patch` (`git apply test/rellenar-enganche.patch`) o poner a mano en
   `web/src/ui/ComidasComun.jsx`: el `import { HojaRellenar }`, el botón «Rellenar la semana» antes de «Lista de la
   compra» (`setHoja('rellenar')`) y `{hoja === 'rellenar' && <HojaRellenar … />}` con `atletaId`, `lunes`,
   `entradas`, `recetario`, `diasSin`, `planes`, `esCoach`, `alCerrar` y `alGuardado={recargar}`.
2. Añadir `node test/rellenar.test.mjs` al script `test` de `package.json` y `probarRellenar` a `test/e2e.test.mjs`.
3. No lleva migración ni cambia permisos: guarda en `menu_comidas` lo mismo que ya se guarda a mano.

## Lo que no hace (a propósito)

- No ajusta raciones ni factores para cuadrar macros: no hace falta (ver arriba) y el factor es cosa del coach.
- No tiene en cuenta ingredientes (aprovechar sobras, no repetir proteína): las recetas no llevan esa información
  estructurada.
- No rellena los días anteriores a hoy ni toca lo marcado como comido.

## Siguiente pieza posible: el recetario al día con el plan

Cuando el coach cambie las kcal de un plan, el recetario se queda calculado para el plan viejo y hoy hay que cambiar
el factor receta por receta (de 30 a 83 por atleta). `descuadreDePlan` ya mide el desvío; faltaría proponer el factor
nuevo de todas las recetas de una vez.
