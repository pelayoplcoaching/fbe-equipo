# «A quién escribir»: el radar de contacto del coach

El panel y la revisión semanal ya dicen cómo va cada atleta. Esto mira el otro lado: **cuánto contacto personal lleva el
coach con cada uno**, a quién toca escribir hoy y por qué, y deja un borrador corto para hacerlo.

Son reglas a la vista, no una puntuación de riesgo: el porqué de cada atleta sale escrito en su fila. No decide nada ni
envía nada solo; lo único que se guarda en la base es el mensaje que el coach envía.

## Qué cuenta como contacto

Un contacto es **un día (de Madrid) en que el coach le escribe algo solo a ese atleta**: chat, nota de voz o un
comentario en una sesión, un vídeo o un check-in. Cinco mensajes el mismo día son un contacto.

No cuentan:

- las **difusiones** (el mismo envío a dos o más atletas; sin ese dato, tres o más atletas en el mismo instante exacto);
- los mensajes **programados** que aún no han salido (cuentan el día en que salen) ni los **eliminados**;
- revisar un vídeo, una sesión o un check-in sin escribir nada.

Sí cuenta «**Ya hablamos**»: el coach apunta a mano que hoy han hablado fuera de la app. Se guarda solo en ese
dispositivo (`localStorage`, clave `fbe-radar-<usuario>`), igual que «Mañana».

## El objetivo y el reparto

De serie (`AJUSTES_RADAR`): **2 días de contacto en los últimos 7** (hoy y los seis anteriores) y **no proponer a
quien se le escribió hoy o ayer** (`separacion: 2`).

| Grupo | Quién |
| --- | --- |
| **Hoy** | Va por debajo del objetivo y no ha sabido del coach ni hoy ni ayer. También, aunque vaya al día: quien escribió y tiene el último mensaje de la conversación (de los últimos 14 días), y quien apuntó una molestia fuerte en el check-in o llegó en un día difícil y aún no han hablado. |
| **En unos días** | Va por debajo del objetivo, pero se le acaba de escribir: dice cuándo le toca otra vez. |
| **Al día** | Cumple el objetivo. |
| **Pospuestos** | El coach lo dejó para otro día («Mañana»). |

Orden dentro de «Hoy»: lo urgente de salud, quien escribió, quien lleva más días sin saber del coach (nunca, primero),
a quien le faltan más contactos y, a igualdad, por nombre. Solo salen los atletas **activos** (ni invitados ni de baja).

## Los motivos

De qué hablarle, de más a menos importante. Salen del resumen que ya calcula el panel (`api.resumenes`) y de tres
consultas pequeñas más (`datos/radar.js`):

| Motivo | Cuándo |
| --- | --- |
| Molestia fuerte / molestia | El aviso de molestia del panel (último check-in). La fuerte (3 o más) es urgente hasta que el coach le escribe a partir del día en que lo envió. |
| Día difícil / día flojo | En una sesión de los últimos 3 días contestó «¿Cómo llegas hoy?» con un día difícil o flojo. El difícil es urgente hasta que el coach le escribe ese día o después. |
| Lleva días sin registrar | El aviso «sin entrenar» del panel (5 días o más, o no ha empezado). |
| Le quedan sesiones | De jueves a domingo, con menos de la mitad de las sesiones de la semana hechas. |
| Cumplimiento bajo | El aviso de cumplimiento del panel (menos del 80 % de lo pautado en 4 semanas). |
| Sin check-in | El aviso del panel, solo a quien ya ha enviado alguno: a quien acaba de empezar o no los hace no se le reclama. |
| Récord | Un récord de los últimos 7 días. Se piden al abrir la fila del atleta (`api.actividad`), no para todos de golpe. |
| Semana completa | Todas las sesiones de la semana hechas. |
| Racha | 3 o más semanas seguidas completas. |
| Solo saludar | Siempre: con su última sesión, si la hay; a quien solo lleva nutrición, sobre el plan. |

## Los borradores

Una o dos frases, sin emojis ni saludo de fórmula, con el dato concreto (los días, la sesión, el récord). Dos o tres
frases por motivo; cada atleta empieza por una distinta (estable en el día) y «Otra frase» va pasando. Ninguna depende
del género de quien la recibe. El coach lo edita y lo **envía desde la fila** (`api.enviarMensaje`) o lo deja como
borrador de su chat («Abrir en su chat»: usa los borradores que el chat ya guarda en el dispositivo).

El estilo sale de medir los mensajes del coach en una copia (solo cifras): la mitad no llega a 45 letras, el 5 % lleva
emojis y el 10 % nombra al atleta.

## Lo medido en la copia (5 nov 2026, solo cifras agregadas)

- 34 atletas activos. En los últimos 7 días: 21 con 2 días o más de contacto personal, 10 con uno y 3 con ninguno.
- De 388 mensajes del coach, 102 eran tres difusiones a todo el equipo: no cuentan.
- Reparto del radar ese día: 15 en «Hoy» (10 por debajo del objetivo, 3 sin ningún mensaje personal y 2 que
  escribieron y tenían el último mensaje), 19 al día. Ninguna urgencia de salud.
- Motivo principal de los 34: saludar 13, le quedan sesiones 8, día flojo 5, sin registrar 4, semana completa 2,
  cumplimiento 1, racha 1.
- El chat de la app solo tenía 11 días de historia: **no se puede comprobar aún** si más contacto trae más
  cumplimiento. Por eso son reglas y no una puntuación. Con unas semanas más se puede medir.

## Archivos

| Archivo | Qué |
| --- | --- |
| `logica/radar/contactos.js` | Difusiones y el contacto de cada atleta (días, últimos 7, último, 4 ventanas, sin contestar). |
| `logica/radar/motivos.js` | Los motivos de cada atleta. |
| `logica/radar/borrador.js` | Las frases. |
| `logica/radar/radar.js` | El reparto, el orden y el resumen del equipo. |
| `logica/radar/local.js` | «Ya hablamos» y «Mañana», en el dispositivo. |
| `datos/radar.js` | Lo que se lee de la base (no toca `api.js`): el resumen del panel, los mensajes de 28 días sin su texto, las sesiones de 7 días y el día del último check-in. |
| `ui/coach/RadarContacto.jsx` | La pantalla. Reutiliza los estilos de la revisión semanal: no añade CSS. |
| `test/radar.test.mjs` | 105 comprobaciones de lógica y de lectura contra la demo. |
| `test/e2e-radar.mjs` | 31 comprobaciones en el navegador (escritorio y 360 px en oscuro). |
| `test/radar-enganche.patch` | Las 5 líneas de `CoachApp.jsx` que ponen la pestaña. No están aplicadas en esta rama. |

## Para integrarlo

1. Aplicar `test/radar-enganche.patch` (`git apply test/radar-enganche.patch`) o poner a mano en `CoachApp.jsx`: el
   `import`, la pestaña `['radar', 'A quién escribir', 'mensaje']` en `TODAS`, el nombre corto `radar: 'Escribir'`, su
   línea en los detalles de «Más» y `{tab === 'radar' && <RadarContacto abrirAtleta={abrirAtleta} />}`.
2. Añadir `node test/radar.test.mjs` al script `test` de `package.json` y `probarRadar` a `test/e2e.test.mjs`.
3. No lleva migración ni cambia `api.js`, `backend-memoria.js` ni los estilos.

## Lo que no hace (a propósito)

- No guarda en la base «Ya hablamos» ni «Mañana»: en otro dispositivo no se ven. Si se quiere, pide una tabla pequeña.
- No tiene frases propias del coach ni objetivo distinto por servicio: `AJUSTES_RADAR` y `FRASES` están preparados para
  ello.
- No avisa con notificaciones ni cuenta contactos por otros canales, salvo los que el coach apunta a mano.
