# Motor «Programar según FBE» (fase 0)

Lógica pura que prepara la semana siguiente de un atleta a partir de la que acaba de hacer. No tiene pantallas, no lee ni
escribe en la base de datos y nunca publica: devuelve una propuesta para que el coach la revise.

Diseño completo: «Programar según FBE: diseño detallado del motor» (documento del proyecto en Claude).

## Qué hay

| Archivo | Paso | Contenido |
| --- | --- | --- |
| `reglas.js` | — | Reglas FBE, perfiles por nivel, herencia FBE → atleta → bloque → ejercicio, limpieza de reglas guardadas |
| `lectura.js` | 1 | Diagnóstico de cada ejercicio (también serie a serie y top + back-off), datos raros y tendencia de 4 semanas |
| `modelos.js` | 2 | Progresión serie a serie (el modelo de partida), doble progresión, triple progresión, lineal, solo repeticiones, «mantener» y «a mano» |
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

## Prueba en sombra (5/11/2026)

Se comparó lo que propone el motor con lo que programó el coach a mano: cinco atletas de tres niveles, una semana hecha
frente a la siguiente programada, 103 ejercicios y 338 series con kilos. Con la doble progresión por ejercicio el motor
acertaba la dirección del cambio (más kilos, más repeticiones o igual) en el 27 % de las series y dejaba la serie idéntica
en el 11 %. Con la progresión serie a serie y las reglas de arriba acierta la dirección en el 55 % y deja la serie idéntica
en el 44 % (62 % y 48 % donde el coach pauta kilos). El resto de la diferencia viene sobre todo de los accesorios, que en
los datos casi no se tocaban, y de cargas ligeras donde se siguió sumando repeticiones por encima del tope.

## Pruebas

```
node test/motor.test.mjs
```

202 comprobaciones, entre ellas mil semanas generadas al azar con semilla fija: ninguna propuesta se sale de lo que admite
la base (series 1–20, RPE 1–10, rango ordenado, detalle válido), los ejercicios «a mano» no se tocan y la misma entrada
da siempre la misma salida.

## Pendiente al integrar (lo hace la conversación principal)

- Añadir `node test/motor.test.mjs` al script `test` de `package.json`.
- `sugerenciaProgresion` (lo que ve el atleta en la sesión) y `sugerirCargas` siguen con la doble progresión por ejercicio
  y el criterio «todas las series al tope»; el motor parte de la progresión serie a serie. Conviene alinearlos.
- Guardar reglas y propuestas necesita una migración (perfiles, reglas por atleta y por pauta, propuestas, motivo
  visible). El motor no la necesita.
- Fuera de la fase 0: top set por RPE, RIR progresivo, carga calculada, APRE, porcentajes, ondulante, fases del bloque,
  volumen guiado, tope de minutos por sesión y proyección a cuatro semanas.
