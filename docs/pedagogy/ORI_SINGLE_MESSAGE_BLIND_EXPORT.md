# Ori — exportación ciega de mensajes pedagógicos

Este incremento separa los datos del estudio exploratorio en dos objetos independientes:

- `educator`: identificador de misión, mensajes A/B y advertencias metodológicas. No contiene el origen de cada respuesta.
- `coordinator`: correspondencia restringida entre A/B y los tutores Ori/Agorix.

El coordinador debe entregar exclusivamente `educator` a quienes puntúan. La clave `coordinator` se conserva fuera de la interfaz de evaluación hasta finalizar la ronda.

## Limitaciones

La separación de objetos no equivale a autorización de acceso ni almacenamiento seguro. El código no verifica la procedencia real de las respuestas, no invoca los tutores y no demuestra equivalencia de los contextos. Por ello conserva explícitamente `equalInputContextProven: false` y `eligibleForEfficacyClaim: false`.

Este cambio no registra rutas, no habilita Ori en Kids y no modifica programas. Antes de un piloto humano se necesitan capturas reales y una revisión metodológica de la diferencia de entradas.
