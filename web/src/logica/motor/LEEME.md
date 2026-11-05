# Motor «Programar según FBE»

Lógica pura que prepara la semana siguiente de un atleta a partir de la que acaba de hacer. No tiene pantallas, no lee ni
escribe en la base de datos y nunca publica: devuelve una propuesta para que el coach la revise.

Diseño completo: «Programar según FBE: diseño detallado del motor» (documento del proyecto en Claude).

## Qué hay

| Archivo | Paso | Contenido |
| --- | --- | --- |
| `reglas.js` | — | Reglas FBE, perfiles por nivel, herencia FBE → atleta → bloque → ejercicio, limpieza de reglas guardadas |
| `lectura.js` | 1 | Diagnóstico de cada ejercicio (también serie a serie y top + back-off), datos raros y tendencia de 4 semanas |
| `modelos.js` | 2 | Progresión serie a serie (el modelo de partida, con top + back-off y peaking en los básicos), doble progresión, triple progresión, lineal, solo repeticiones, «mantener» y «a mano» |
| `topset.js` | 2 | Las cuentas de la serie top y del peaking: qué series son la top y qué kilos mantienen el esfuerzo con una repetición menos |
| `semana.js` | 3 | Señales de descarga y sus cuatro tipos, vuelta tras un parón, mantenimiento |
| `proponer.js` | 4 y 5 | Frenos, confianza, alternativas y `proponerSemana()` |

## Cómo se usa

```js
import { proponerSemana } from './logica/motor/index.js';

const { filas, semana, descarga } = proponerSemana({
  pautas,      // sesion_ejercicios de la semana hecha
  sesiones,    // las sesiones de fuerza de esa semana (las de cardio y las opcionales, fuera)
  series,      // { pauta_id: [series] }
  ejercicios,  // { id: { nombre, grupos_musculares, tipo } }
  historial,   // { ejercicio_id: [{ foco, pauta, series, malDia }] }, de la semana más antigua a la más reciente
  atleta,      // { nivel, perfil, volumen_objetivo }
  reglas,      // { fbe, atleta, bloque, porEjercicio, porPauta }: capas pasadas antes por limpiarReglas()
  contexto,    // { checkins, molestias, carga: { ratio }, diasSinEntrenar, focoAnterior, focoSiguiente, semanasDesdeDescarga }
});
```

Cada fila trae `antes`, `propuesta`, `cambios`, `tipo`, `motivo`, `confianza` (alta, media o baja), `frenos`, `avisos` y
hasta dos `alternativas`. `descarga` trae las señales y, si hay alguna, la versión de descarga de toda la semana.

## Decisiones de Pelayo (5/11/2026) que ya están en las reglas

- **Modelo de partida para todos los niveles: progresión serie a serie.** Cada serie progresa por su cuenta desde lo que
  se hizo en ella:
  1. llega al tope del rango → sube kilos y vuelve al suelo del rango; si varias llegan la misma semana, suben todas las
     que fueron fáciles (RPE 8 o menos) y, de las demás, solo la primera;
  2. va sobrada (RPE 7 o menos, solo en básicos) → sube kilos con las mismas repeticiones;
  3. RPE 9 o menos → una repetición más;
  4. por encima → igual.
- Rangos de partida: básicos 6–10, multiarticulares 8–12, aislamiento 10–15. Manda el rango propio del ejercicio; si no,
  el de la pauta (si no es serie a serie y trae mín–máx); si no, el del tipo. Una serie por debajo del suelo (básicos en
  intensificación o peaking) no se empuja hacia el rango.
- Donde, por el nivel del atleta, la carga la elige él (`modoCarga` = rpe), solo se mueven las repeticiones.
- Lineal, doble por ejercicio, triple y solo repeticiones quedan como modelos opcionales por ejercicio o por perfil.
- La doble progresión por ejercicio sube con todas las series menos una al tope (la que falta, dentro del rango).
- Descarga solo por señales; sin calendario salvo que las reglas de un atleta lo pidan.
- Las molestias se avisan junto a los ejercicios de esa zona y no frenan (la regla `molestias` permite frenar).
- El esfuerzo de las propuestas sale siempre en RPE.

## Top set + back-off y peaking en los básicos (decisiones del 5/11/2026, con sus datos delante)

En la copia de ese día (167 básicos hechos de 28 atletas) el «top + back-off» de la app casi no se usa (1 pauta de 268):
se programa serie a serie, y en uno de cada tres básicos la primera serie es la más pesada y las demás bajan un 5–10 %
con más repeticiones. La top progresó como cualquier serie; las back-off se quedaron igual en dos de cada tres y solo se
movieron cuando iban a RPE 7.

- **Top + back-off** (regla `topSet`): un básico cuya primera serie es la más pesada se trata así sin pedirlo
  (`detectar`). La top sigue las reglas de siempre. Las back-off se quedan igual, salvo que vayan a RPE 7 o menos:
  entonces suben kilos con las mismas repeticiones (`backoff: 'faciles'`; también `'solas'` e `'igual'`). El modelo
  `top_set` hace lo mismo en un ejercicio que no sea básico; el perfil «Fuerza» lo usa en los básicos.
- **Peaking** (`topSet.peaking`): solo cuando la semana que se programa lleva el foco «Peaking»
  (`contexto.focoSiguiente`), solo en básicos con kilos y solo en semanas normales (ni descarga, ni vuelta, ni a medias).
  - La top (la serie o series a la carga más alta) baja una repetición respecto a lo que hizo, o a lo pautado si hizo
    más, y lleva los kilos que mantienen el esfuerzo: se calculan desde su 1RM estimado y se redondean al salto.
  - Baja hasta 1 repetición (`suelo`); al llegar solo se ajustan los kilos: un salto si fue a RPE 8 o menos.
  - Si la top salió por encima de RPE 9 (`duraRpe`), se repite tal cual.
  - Las back-off siguen su regla. Con series planas bajan todas juntas, calculadas desde la más exigente.
  - Donde la carga la elige el atleta baja la repetición y la carga queda como orientativa.
  - Añadido al construirlo: el esfuerzo que se mantiene es el que hizo pero nunca por debajo de RPE 8 (`rpeMin`), para
    que una top fácil no se quede fácil; la top nunca baja de kilos; y la subida de una semana a otra tiene tope
    (`maxPct`, 10 %). Con cargas ligeras el redondeo se come la subida de una repetición: esa semana baja la repetición
    con los mismos kilos y a la siguiente la cuenta ya da el salto.
  - La fila lleva `fase: 'peaking'` y la alternativa «Sin peaking»; `semana.peaking` dice cuántas filas entran.
- Sobre la última semana hecha de 29 atletas de la copia, el peaking daría 59 filas: 24 bajan la repetición y suben
  kilos (mediana +3,6 %, entre +1,8 y +8,3 %), 15 la bajan con los mismos kilos, 10 la bajan con la carga a elección del
  atleta, 9 se repiten por duras y 1 ya está en el suelo.

## Prueba en sombra (5/11/2026)

Se comparó lo que propone el motor con lo que programó el coach a mano: cinco atletas de tres niveles, una semana hecha
frente a la siguiente programada, 103 ejercicios y 338 series con kilos. Con la doble progresión por ejercicio el motor
acertaba la dirección del cambio (más kilos, más repeticiones o igual) en el 27 % de las series y dejaba la serie idéntica
en el 11 %. Con la progresión serie a serie y las reglas de arriba acierta la dirección en el 55 % y deja la serie idéntica
en el 44 % (62 % y 48 % donde el coach pauta kilos). El resto de la diferencia viene sobre todo de los accesorios, que en
los datos casi no se tocaban, y de cargas ligeras donde se siguió sumando repeticiones por encima del tope.

Corrección: esas dos cifras (55 % y 44 %) se midieron sin respetar el rango de la pauta (`rangoDeLaPauta: false`). Con
las reglas tal como salen, que sí lo respetan, son 53 % y 42 %. La regla de top + back-off casi no las mueve en esta
muestra, que tiene pocos básicos con la top primero: la serie idéntica pasa del 42 % al 43 % (del 44 % al 45 % sin
respetar el rango) y la dirección no cambia.

## Pruebas

```
node test/motor.test.mjs
```

263 comprobaciones, entre ellas mil semanas generadas al azar con semilla fija: ninguna propuesta se sale de lo que admite
la base (series 1–20, RPE 1–10, rango ordenado, detalle válido), los ejercicios «a mano» no se tocan y la misma entrada
da siempre la misma salida.

## En el editor (fase 1a, sin migración)

- `adaptador.js` pasa de lo que carga el editor (`api.bloqueCompleto`) a la entrada del motor: `pautasDeSemana`,
  `emparejar` (cada pauta de la semana hecha con la suya de la semana que se programa: misma sesión y ejercicio; si no,
  el mismo ejercicio en otra sesión), `entradaDesdeBloque` (historial de las semanas anteriores del bloque, check-ins,
  molestias, carga y días sin entrenar), `cambiosDePropuesta` y `diferencias`.
- `web/src/ui/coach/ProgramarFBE.jsx` es la hoja de revisión: lo que hizo, lo que hay, lo propuesto, el motivo, la
  confianza, los frenos y las alternativas de un toque; «Solo confianza alta / Todas / Ninguna»; ver la semana como
  descarga; y «Aplicar N cambios», que escribe solo las pautas marcadas de la semana destino. No publica: la semana se
  queda como estaba (si ya estaba publicada, la hoja lo avisa). Usa solo clases que ya existen; no toca `estilos.css`.
- `Editor.jsx` (28 líneas): el botón junto a «Cargas sugeridas». En una semana sin registrar que sigue a una hecha,
  «Programar según FBE»; en una semana hecha, «Programar la siguiente según FBE» (si la siguiente no existe la crea como
  copia con `api.prepararSemanas`). Las reglas son las de partida (`REGLAS_FBE` + perfil del nivel del atleta): todavía
  no se guardan reglas por atleta ni la propuesta.
- `test/e2e-programar-fbe.mjs`: 19 comprobaciones en la demo con Chrome (abrir, revisar, ver como peaking, alternativa,
  aplicar, sigue en borrador, reabrir sin cambios, programar la siguiente; escritorio y 360 px en oscuro; consola, desbordes y axe).
  Se ejecuta suelta (`npm run build && node test/e2e-programar-fbe.mjs`) o desde `e2e.test.mjs` con
  `probarProgramarFBE({ navegador, check, base })`.
- La hoja tiene «Ver la semana como peaking»: calcula la propuesta como si la semana llevara ese foco, sin cambiarlo
  (de partida está activo si la semana ya lo lleva).
- Sin probar en el navegador: crear la semana siguiente cuando no existe (la demo no tiene ese caso).

## Pendiente al integrar (lo hace la conversación principal)

- Añadir `node test/motor.test.mjs` al script `test` de `package.json` y llamar a `probarProgramarFBE` desde
  `test/e2e.test.mjs`.
- Línea de «Novedades» y versión al publicar.
- `sugerenciaProgresion` (lo que ve el atleta en la sesión) y `sugerirCargas` siguen con la doble progresión por ejercicio
  y el criterio «todas las series al tope»; el motor parte de la progresión serie a serie. Conviene alinearlos.
- Guardar reglas y propuestas necesita una migración (perfiles, reglas por atleta y por pauta, propuestas, motivo
  visible). El motor no la necesita.
- Sin hacer: RIR progresivo, carga calculada, APRE, porcentajes, ondulante, fases del bloque,
  volumen guiado, tope de minutos por sesión y proyección a cuatro semanas.
