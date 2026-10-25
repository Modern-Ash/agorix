# Ori — modalidad de pista textual para evaluación pedagógica

El PR #706 confirmó que no es válido equiparar automáticamente una propuesta estructurada del tutor determinista con un plan textual de Ori.

Este incremento define una modalidad de salida estrictamente textual: `hint` y `nextStep`, junto con un contrato versionado y `appliedChanges: false`. El adaptador transforma únicamente un `OriLearnerHintPreview` válido, sin permitir propuestas ejecutables, identificadores infantiles ni campos adicionales.

## Límites

- No modifica programas, no invoca modelos y no registra endpoints.
- No genera pistas textuales del tutor determinista. Eso requiere identificar y ejecutar una ruta auténtica que produzca texto, no inventar un equivalente a partir de propuestas estructuradas.
- La salida no es evidencia de aprendizaje ni validación de seguridad infantil.
- El contrato se utiliza únicamente para preparar futuras comparaciones con respuestas de la misma modalidad y contextos alineados.

Próximo paso: investigar el camino determinista de texto del tutor actual y establecer un adaptador de evidencia reproducible, manteniendo las salidas originales y sin introducir respuestas artificiales.
