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
| `volumen.js` | 3 | Las series por músculo de la semana propuesta frente a la anterior y al rango del atleta: solo enseña y avisa |
| `adaptador.js` | — | Del bloque que carga el editor a la entrada del motor, y de la propuesta a lo que se guarda |
| `guardadas.js` | — | Las reglas que el coach guarda para un atleta (fase 1b): leerlas, validarlas y pasarlas al motor |
| `nota.js` | — | El borrador de la nota de la semana para el atleta: solo lo que cambia |
| `registro.js` | — | Las propuestas guardadas: qué propuso el motor, qué aplicó el coach y el acuerdo real |
| `sombra.js` | — | La prueba en sombra: el motor frente a lo que programó el coach, sobre una copia completa |

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

## Puesta a punto, primera pasada (v0.181, 18/11/2026)

Decisiones de Pelayo: el salto de carga es de 2,5 kg en todo (`SALTO_FBE`; ya no se adivina por el nombre: ni 2 kg en
mancuernas ni 5 kg en máquinas desde 50 kg). Las mancuernas del gimnasio del atleta son una regla suya
(`atleta.salto.mancuernas`: 2 o 1) y el salto propio de un ejercicio sigue en `porEjercicio.<id>.salto`. Nunca más de un
salto de golpe. Cada fila trae `regla: { rango, salto }` (lo que vale de verdad para ese ejercicio) y la hoja enseña lo
pautado, lo que hizo y la propuesta serie a serie (`seriesEnFilas`, `textoSerieFBE` en `adaptador.js`).

## Segunda pasada: la regla por RPE (v0.182, 18/11/2026)

`porSerie.regla: 'rpe'` es la de partida (`'clasica'` deja la del 5/11; las pruebas antiguas la usan). En `porSerie()`:

| RPE | Parte baja | Parte alta (desde la mitad del rango) | Tope |
| --- | --- | --- | --- |
| ≤ 6,5 | sube | sube | sube |
| 7–7,5 | +1 rep (pierna: sube) | sube (empuje: +1 rep) | sube |
| 8–8,5 | +1 rep (serie pesada de un Obligatorio: sube) | +1 rep (pesada: sube) | sube |
| 9 | +1 rep | +1 rep | sube y baja al mínimo |
| 9,5 | igual | igual | igual |
| 10 | igual; −1 rep solo si no llegó a lo pautado | | |
| sin RPE | igual | | |

- Al subir: un solo salto; repeticiones = las que dejan el esfuerzo en `rpeObjetivo` (8) con Epley y las de reserva, nunca más
  de las hechas ni por debajo del suelo (la serie pesada de un básico sí puede: hasta 3); novato, una menos.
- `soloPrimeraDesde` (8,5) y `cuantasDuras` (2): con varias series a ese RPE o más, solo progresan las dos primeras.
- Carga baja (`cargaBajaPct` 10, `sobreTope` 2): sigue con repeticiones hasta tope + 2; alternativa `subir_carga`.
- Rangos: `rangoDe()` → regla del ejercicio > rangos del atleta (si no son los de partida) > `rangosEjercicio` (hip thrust
  8–12) > `rangosPrioridad[tipo][prioridad]`. El rango de la pauta ya no manda.
- Movimiento (`movimientoDe`): pierna = cuádriceps, isquiotibiales, glúteo, gemelo, aductores; empuje = pectoral,
  deltoides, tríceps; por el primer grupo muscular.
- Kilos para todos: `mueveKg` = movió kilos, sea cual sea el nivel; si la pauta no los llevaba, se escriben.
- Tipo nuevo de fila: `menos`.
- En la copia del 18/11 (84 pares de semanas, 5967 series): RPE sin apuntar 12 %, 10 el 7 %, 9,5 el 7 %, 8,5–9 el 25 %.
  El acuerdo con lo programado baja del 69 % al 52 % en dirección: es esperable (38 de las 84 semanas se programaron con
  el motor anterior y las reglas nuevas cambian a propósito lo que Pelayo corregía).

## Tercera pasada: descarga y peaking (v0.183, 18/11/2026)

- `descarga.cuando: 'manual'` de partida: sin el foco «Descarga» no hay señales ni propuesta (la hoja ya no enseña «Podría
  tocar descarga» ni «Ver la semana como descarga»). `descarga.tipo: 'fbe'` (`descarga.fbe`): series × 0,67, −10 % de
  kilos, RPE 7 (`rpeFijo`: se pone aunque la pauta no llevara esfuerzo y quita el RIR), mismas repeticiones; prioridad
  baja y muy baja, series × 0,5; novato, una serie menos y RPE 7 sin bajar kilos. `descarga.vuelta: 'repetir'`: tras la
  descarga, la última semana normal tal cual.
- Peaking: `topSet.peaking.soloObligatorio`, `resto: 'igual'`, `rpeMin: 9`, suelo 1. En la semana de peaking, lo que no es
  un básico Obligatorio devuelve «mantener», y dentro de él las series de apoyo no se tocan.
- Los focos de volumen, intensidad, adaptación y técnica no cambian nada (decisión).
- Pendiente menor: quitar de los formularios los campos que la regla por RPE no usa (de momento, avisados) y reescribir
  el aviso de nivel del editor (`AYUDA_NIVEL`), que describe el reparto antiguo de kilos y RPE por nivel.

(Nota de la v0.182:) «Suma una repetición hasta» de los formularios ya no aplica a la regla
por RPE (solo a la clásica y al top set).

## «Por su cuenta»: los cuatro frenos (24/11/2026)

Para los atletas sin seguimiento («FBE por tu cuenta»), que no tienen a Pelayo revisando la semana. Solo actúan con
`atleta.modalidad === 'por_su_cuenta'` en la entrada de `proponerSemana`; con cualquier otra modalidad (o sin ella) la
propuesta es exactamente la de siempre (comprobado con la copia del 24/11: 119 de 119 semanas idénticas). Aprobados por
Pelayo el 24/11/2026 tras la revisión de seguridad de la fase 0:

1. **Si movió menos kilos de los pautados, se parte de lo que hizo** (`desdeLoHecho`): el «igual» de la serie a serie, la
   semana a medias, los demás modelos y la pauta escrita sin serie a serie, bajados a los kilos que movió. Freno
   `desde_lo_hecho`.
2. **Si lo apuntado parece una errata, se pregunta antes de proponer**: la fila sale con `tipo: 'pregunta'`, sin cambios,
   con `pregunta: { tipo: 'errata', series: [{ numero, kg, reps }], texto }`, y la semana dice cuántas
   (`semana.preguntas`). Si el atleta lo confirma, la serie llega con `confirmada: true` y `lectura.js` ya no la descarta.
   Freno `errata_pregunta`.
3. **Nunca por debajo del mínimo del rango**: la serie pesada de un básico ya no baja de él al subir de kilos (si con el
   salto no llegaría, una repetición más; en el tope sube y vuelve al mínimo) y a RPE 10 no se quita la repetición si eso
   lo deja por debajo. Freno `minimo_rango`.
4. **Dos semanas por debajo del rango sin avanzar** (ni más repeticiones ni menos kilos): baja un salto y vuelve al
   mínimo. Si lo pautado ya iba por debajo del rango a propósito, su mínimo es lo pautado. Sin kilos que bajar, avisa.
   Freno `baja_rango`.

Y una red de seguridad para cualquier modelo o tipo de semana (`unSaltoComoMucho`): ninguna serie más de un salto por
encima de lo que movió (freno `un_salto`; con la copia del 24/11 no ha hecho falta). Las molestias siguen avisando sin
frenar (decisión del 24/11). Los frenos que actúan llegan en `fila.frenos` con su texto (`FRENO_POR_SU_CUENTA`).

Revisión de seguridad repetible con cada copia: `node scripts/seguridad-motor.mjs <copia.json> [--por-su-cuenta]
[--confirmar]`. Con la copia del 24/11 y los frenos: 0 series con más de un salto, 0 que bajan del mínimo y 0 atascadas
dos semanas con kilos (antes, 41, 39 y 5).

## Reglas propias de cada atleta (16/11/2026)

Cada atleta puede llevar, además del perfil, los rangos y el RPE, tres reglas más (se editan en «Reglas de este atleta» y
se guardan en su ficha, `atletas.reglas_motor`; nunca en el código):

- `porSerie.bajaAlSubir` (1–4): al llegar al tope y subir de kilos, baja solo esas repeticiones en vez de volver al
  mínimo del rango.
- `topSet.rango` y `topSet.rpeSube`: la serie top (la primera, la más pesada) con su rango de repeticiones y su «suma una
  repetición hasta» propios. Las series de apoyo siguen como siempre.
- `descarga.cuando = 'manual'`: no se le propone descarga por señales; solo si el coach pone ese foco.

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

## Volumen por músculo: solo enseñar y avisar (decisión del 5/11/2026)

El diseño preveía un «volumen guiado» que añadiera una serie por semana en los músculos prioritarios. No se ha hecho,
porque no es como se programa: en la copia, de 1061 ejercicios emparejados entre una semana y la siguiente de un bloque,
1058 llevan las mismas series y ninguno gana una (tampoco en las semanas «Volumen»); ningún atleta tiene un objetivo de
volumen propio; y con el rango general de 10 a 20 la mitad de los músculos sale «bajo» cada semana (358 de 740;
abdominales y gemelo siempre).

Lo que hay (`volumen.js`): `compararVolumen({ antes, despues, ejercicios, objetivo, semana })` cuenta las series por
músculo como la app (principal entero, secundarios a medias) y devuelve cada músculo con sus series antes y después,
su rango y su estado, más unos avisos. De partida (`volumen.avisar: 'cambios'`) avisa de cada músculo que cambia
respecto a la semana anterior, de lo que pasa del máximo y, si es un recorte de toda la semana (descarga, vuelta,
mantenimiento), de cuánto recorta en una sola línea. Quedarse por debajo del mínimo se ve pero no se avisa (`'todo'` lo
avisa; `'nada'` no avisa de nada). `proponerSemana` lo trae en `semana.volumen` (y en `descarga.volumen`). La hoja de
revisión lo enseña plegado, calculado sobre la semana de destino con lo que esté marcado.

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

## Reglas por atleta y por ejercicio (fase 1b, 5/11/2026)

Decisiones de Pelayo: por atleta se cambia el **perfil**, **hasta qué RPE suma repeticiones** y los **rangos de
repeticiones** de cada tipo de ejercicio; por ejercicio, **cómo progresa** (el modelo), su **rango**, su **salto de
carga** y ese mismo RPE; y la regla de un ejercicio vale **solo para ese atleta**.

- Se guardan en una columna nueva, `atletas.reglas_motor` (jsonb), con la forma
  `{ v: 1, perfil, atleta: { porSerie: { rpeSube, rangos } }, porEjercicio: { <id>: { modelo, porSerie: { rango, rpeSube }, salto: { tipo: 'kg', valor } } } }`.
  Es la migración `supabase/migraciones/046_motor_fase_1b.sql` (v0.76), con `semanas.propuesta_motor`. Solo el coach
  escribe esa columna (el atleta solo lee su ficha).
- `guardadas.js`: `leerGuardadas(valor)` (nunca falla: con algo roto devuelve reglas vacías y dice qué descartó; solo
  deja pasar lo que la pantalla edita), `paraGuardar`, `paraElMotor` (el perfil va en `atleta.perfil` y las capas en
  `reglas.atleta` y `reglas.porEjercicio`), `conReglasDeAtleta` y `conReglaDeEjercicio` (del formulario a lo guardado,
  con sus errores), `resumenGuardadas` y `resumenRegla`. Perfiles elegibles: Fuerza, Novato lineal en básicos, En casa o
  de viaje, Readaptación y Mantenimiento; sin perfil, sale el del nivel. Como mucho 200 ejercicios con regla propia.
- En la hoja de revisión (`ReglasFBE.jsx`, sin estilos nuevos): un panel «Reglas de <atleta>» con su resumen y el
  formulario, y en cada fila «Regla propia» / «Cambiar la regla». Al guardar se escribe con
  `api.actualizar('atletas', id, { reglas_motor })`, la propuesta se recalcula y las marcas vuelven a las de partida.
  La hoja lee las reglas con `api.ficha(id)`: no ha hecho falta tocar `api.js`, `Editor.jsx` ni `Ficha.jsx`.
- Qué manda sobre qué: regla del ejercicio > rango de la pauta (si trae mínimo y máximo) > rangos del atleta > los de
  partida. El RPE del ejercicio manda sobre el del atleta.
- Sin la migración aplicada, todo sigue funcionando con las reglas de partida y, al guardar, la hoja dice que falta
  la migración. En la demo funciona sin ella.
- La prueba en sombra usa las reglas guardadas de cada atleta, como el editor (`sinGuardadas: true` las ignora).

## Nota de la semana y propuestas guardadas (fase 1b, 5/11/2026)

**Nota de la semana.** Decisión de Pelayo: el borrador dice **solo lo que cambia**, en dos o tres frases y sin
motivos. `nota.js`: `notaDeSemana({ filas, semana, descarga, total })` y `claseParaNota` (de la fila de la hoja a
«kilos», «reps», «series», «peaking» o «baja»). Solo cuenta lo marcado, con la opción elegida en cada fila; descarga,
vuelta, repetición y mantenimiento tienen su propia frase; como mucho tres ejercicios por frase («y 2 más»). En la hoja
va en un campo con la nota que ya tenga la semana (`semanas.nota_coach`, que existía), el borrador debajo y «Usar el
borrador». No se guarda nada sin tocarlo: si la nota cambia, se guarda con el botón de aplicar (que pasa a decir «y
guardar la nota», o «Guardar la nota» si no hay nada marcado). No necesita migración.

**Propuestas guardadas.** Decisión de Pelayo: se guardan **en la propia semana** (`semanas.propuesta_motor`, jsonb;
segunda columna de la migración 046). Como el atleta puede leer la fila de sus semanas publicadas, el
registro NO lleva motivos, señales de descarga ni nada del check-in o las molestias: por cada ejercicio, lo propuesto
en corto (series, repeticiones y kilos), el tipo, el modelo, la confianza y la decisión (`aplicada`, `alternativa`,
`no`, `igual`, `fuera`). La app no se lo enseña al atleta.
- `registro.js`: `registroDePropuesta` (al aplicar), `fusionarRegistro` (volver a aplicar desde la misma semana no borra
  lo decidido antes), `leerRegistro` (nunca falla), `acuerdoDeRegistro` (lo guardado frente a cómo está ahora la semana:
  aplicadas, con otra opción, no aplicadas, cambiadas después a mano, borradas y cuántas siguen como dijo el motor),
  `textoAcuerdo`, y `acuerdoDeCopia` / `textoAcuerdoDeCopia` (toda una copia: por confianza, tipo, modelo, con o sin
  regla propia y por atleta, solo con ids). Solo cuentan como propuesta los cambios de series, repeticiones o kilos:
  pasar una pauta de RIR a RPE no lo es.
- La hoja lo guarda al aplicar, sin avisar si falla (una base sin la migración sigue aplicando igual), y al volver a
  abrirla dice «Ya aplicaste una propuesta en esta semana el…» con el recuento.
- `scripts/sombra-motor.mjs` añade al final el acuerdo real de la copia.
- En `Editor.jsx` cambian dos cosas pequeñas: el aviso al aplicar dice también «nota guardada», y el campo «Nota para
  el atleta» lleva una clave con la versión para que se refresque cuando la hoja guarda la nota.

## Prueba en sombra repetible

`sombra.js` hace la comparación de arriba sobre cualquier copia completa de la app (Cuenta → Copia completa), con todos
los atletas y todos los pares de semanas seguidas de un bloque (la primera con series, la segunda con pautas). Usa el
mismo camino que el editor (`entradaDesdeBloque` → `proponerSemana` → `emparejar`), mirando solo lo anterior a la semana
que se programa. Quedan fuera las semanas de descarga, las plantillas y las que el motor trata como vuelta, repetición o
mantenimiento.

```
node scripts/sombra-motor.mjs <copia.json>                                   # el informe, sin nombres
node scripts/sombra-motor.mjs <copia.json> --comparar '{"fbe":{"porSerie":{"rpeSube":8.5}}}'   # reglas de siempre frente a esas
node scripts/sombra-motor.mjs <copia.json> --ejemplos 20 --json informe.json
```

El informe trae: series comparadas, misma dirección y serie idéntica (en total, donde se pautan kilos y donde no); los
mismos datos por nivel, tipo de ejercicio, prioridad, confianza, modelo y foco; la matriz coach × motor; las diferencias
más frecuentes; y una fila por atleta con su id (nunca el nombre; `--nombres` los pone solo en la salida de pantalla).
`--comparar` pasa otro juego de reglas y enseña cuántos puntos cambia cada cifra: es la forma de afinar una regla con
datos. Las reglas van por capas (`fbe`, `atleta`, `bloque`); el modelo hay que cambiarlo en `atleta`, porque el perfil
del nivel manda sobre `fbe`.

La copia lleva datos de salud: no se sube al repositorio ni a sitios compartidos, y la salida con `--nombres` tampoco.

Sobre la copia del 5/11/2026 (38 pares de semanas de 25 atletas, 873 ejercicios, 2700 series; 2267 con kilos pautados):

| | Misma dirección | Serie idéntica |
| --- | --- | --- |
| Reglas de partida | 49,8 % | 38,1 % |
| Con la doble progresión por ejercicio | 27,0 % | 10,4 % |
| Sin la regla de top + back-off (solo básicos) | 45,5 % (51,4 % con ella) | 26,1 % (30,0 % con ella) |
| Sobrada en todos los ejercicios, no solo en básicos | 42,1 % | 30,6 % |
| Sin tocar los ejercicios donde la carga la elige el atleta | 55,3 % | 43,0 % |

Por atleta va del 30 % al 70 % en dirección (mediana 49 %). La muestra de cinco atletas de la primera prueba salía algo
mejor que el conjunto (53 % y 42 %). La confianza de la propuesta no predice el acuerdo (51 % en alta, 50 % en baja):
casi todos los bloques de la copia tienen dos semanas y no hay historial. Las diferencias más frecuentes: el coach deja
igual y el motor suma una repetición (427 series en aislamiento y multiarticulares), el coach suma repeticiones y el
motor sube kilos (110, multiarticulares) y el coach deja igual y el motor sube kilos (156).

De esta pasada salió un cambio: una serie sin kilos por debajo del rango (dominadas a 4 repeticiones) ya suma
repeticiones; antes se quedaba igual, como las series con kilos de intensificación.

## Pruebas

```
node test/motor.test.mjs
node test/frenos-por-su-cuenta.test.mjs   (los frenos de «por su cuenta» y que con seguimiento no cambia nada)
```

348 comprobaciones, entre ellas mil semanas generadas al azar con semilla fija: ninguna propuesta se sale de lo que admite
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
- `test/e2e-programar-fbe.mjs`: 36 comprobaciones en la demo con Chrome (abrir, revisar, reglas del atleta y de un
  ejercicio, volumen por músculo, ver como peaking, alternativa, nota de la semana, propuesta guardada,
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
  sugerencias de volumen al cambiar de bloque, tope de minutos por sesión y proyección a cuatro semanas.
