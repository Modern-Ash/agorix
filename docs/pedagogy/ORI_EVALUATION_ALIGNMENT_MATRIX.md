# Ori vs Agorix — matriz de alineación pedagógica

Esta matriz utiliza las cinco actividades sintéticas y las misiones canónicas reales de Kids para indicar qué comparaciones están técnicamente justificadas y cuáles todavía no.

| Escenario | Índice | Misión Kids canónica | Alineación de metadatos | Comparación A/B lista |
| --- | ---: | --- | --- | --- |
| Movimiento | 1 | Sí, índice 1 | Sí, con nivel del escenario | No |
| Secuencias | 2 | Sí, índice 2 | Sí, con nivel del escenario | No |
| Bucles | 3 | No | No | No |
| Eventos | 4 | No | No | No |
| Depuración | 5 | No | No | No |

La matriz se calcula desde `KIDS_MISSION_IDS` y `oriPedagogicalFixtures`; los resultados anteriores reflejan la situación actual, no un mapeo pedagógico validado.

## Bloqueos de comparación

1. Ori shadow recibe índice de misión, nivel de pista y cantidad de scripts, pero no el programa completo.
2. El tutor determinista de Kids devuelve propuestas estructuradas; no genera un texto pedagógico equivalente a `hint` y `nextStep`.
3. Tres escenarios no tienen una misión Kids canónica correspondiente.
4. Coincidir en el índice no demuestra que el objetivo didáctico sea equivalente.

Por lo tanto, **ninguno de los cinco escenarios está habilitado para una comparación A/B rigurosa**. El resultado `metadataAligned` es solamente una coincidencia estructural.

## Próximos pasos

Definir una comparación válida por modalidad (pistas textuales frente a pistas textuales, o propuestas estructuradas frente a propuestas estructuradas), y recién después alinear los contextos de entrada. No ampliar Kids ni modificar su contrato por conveniencia de la evaluación. Mantener los datos sintéticos, la revisión humana y el aislamiento en `integration/ori`.
