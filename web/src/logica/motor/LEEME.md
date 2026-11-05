# Motor «Programar según FBE» (fase 0)

Lógica pura que prepara la semana siguiente de un atleta a partir de la que acaba de hacer. No tiene pantallas, no lee ni
escribe en la base de datos y nunca publica: devuelve una propuesta para que el coach la revise.

Diseño completo: «Programar según FBE: diseño detallado del motor» (documento del proyecto en Claude).

## Qué hay

| Archivo | Paso | Contenido |
| --- | --- | --- |
| `reglas.js` | — | Reglas FBE, perfiles por nivel, herencia FBE → atleta → bloque → ejercicio, limpieza de reglas guardadas |
| `lectura.js` | 1 | Diagnóstico de cada ejercicio (también serie a serie y top + back-off), datos raros y tendencia de 4 semanas |
| `modelos.js` | 2 | Doble progresión, triple progresión, lineal, solo repeticiones, «mantener» y «a mano» |
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

- La doble progresión sube con todas las series menos una al tope (la que falta, dentro del rango).
- Modelo de partida por nivel: novato, lineal en básicos; novato/intermedio e intermedio, doble progresión; avanzado, top
  set y RIR progresivo (aún no están: mientras tanto usa la doble y la fila lo dice).
- Descarga solo por señales; sin calendario salvo que las reglas de un atleta lo pidan.
- Las molestias se avisan junto a los ejercicios de esa zona y no frenan (la regla `molestias` permite frenar).
- El esfuerzo de las propuestas sale siempre en RPE.

## Pruebas

```
node test/motor.test.mjs
```

170 comprobaciones, entre ellas mil semanas generadas al azar con semilla fija: ninguna propuesta se sale de lo que admite
la base (series 1–20, RPE 1–10, rango ordenado, detalle válido), los ejercicios «a mano» no se tocan y la misma entrada
da siempre la misma salida.

## Pendiente al integrar (lo hace la conversación principal)

- Añadir `node test/motor.test.mjs` al script `test` de `package.json`.
- `sugerenciaProgresion` (lo que ve el atleta en la sesión) y `sugerirCargas` siguen con el criterio «todas las series al
  tope»; el motor usa «todas menos una». Conviene alinearlos.
- Guardar reglas y propuestas necesita una migración (perfiles, reglas por atleta y por pauta, propuestas, motivo
  visible). El motor no la necesita.
- Fuera de la fase 0: top set por RPE, RIR progresivo, carga calculada, APRE, porcentajes, ondulante, fases del bloque,
  volumen guiado, tope de minutos por sesión y proyección a cuatro semanas.
