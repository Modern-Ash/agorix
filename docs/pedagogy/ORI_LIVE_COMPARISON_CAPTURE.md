# Ori — captura offline de dos productores reales

Este incremento ejecuta `captureOriRealTextBaseline` contra el tutor determinista auténtico y consulta un `OriPlanConsumer` inyectado para obtener una pista de Ori. Verifica coincidencia de misión canónica, nivel de ayuda y cantidad de scripts. Después prepara una comparación de un mensaje por tutor y separa las respuestas ciegas A/B de la clave de procedencia.

## Límites de evidencia

Las pruebas unitarias utilizan el tutor determinista real, pero un consumidor Ori simulado. El proceso real de Ori se valida en otro job de interoperabilidad, no mediante esta nueva prueba de extremo a extremo. El código permite inyectar el consumidor real en una ejecución posterior.

La coincidencia de metadatos **no demuestra igualdad de entradas**: Ori shadow recibe un contexto reducido; Agorix utiliza programa y runtime. Por eso el paquete mantiene `equalInputContextProven: false` y `eligibleForEfficacyClaim: false`.

No hay rutas nuevas, persistencia, datos de niños ni cambios de Kids. La clave del coordinador debe mantenerse fuera del material entregado a educadores. Antes de un piloto, falta ejecutar una captura con el proceso real de Ori y conservar evidencia de la ejecución.
