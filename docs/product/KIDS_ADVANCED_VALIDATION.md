# Validación del nivel avanzado de Agorix Kids

Estado: **recorrido automatizado aprobado; validación con una niña o un niño pendiente**. El issue [A6 #413](https://github.com/Modern-Ash/agorix/issues/413) permanece abierto hasta incorporar hallazgos reales de [Kids 18 #389](https://github.com/Modern-Ash/agorix/issues/389). No hay observaciones de Mora registradas a la fecha de este documento.

## Evidencia automatizada

`apps/web/e2e/kids-advanced-journey.spec.ts` recorre la interfaz en español a 820 × 1180, sin marcar misiones como terminadas desde una fixture: completa M1, M2 y M3 con bloques, responde la predicción y comprueba el resultado de cada ejecución. Luego abre las tres etapas avanzadas desde el mapa, ejecuta la escena, toca a Ori para activar el evento y cambia el puntaje. Comprueba que el monitor muestra el valor del runtime, que Agorix Code, Python y TypeScript reflejan los programas canónicos, y que el progreso sobrevive a una recarga.

El mismo recorrido verifica accesibilidad con axe, gira la tablet a 1180 × 820, corta la red y comprueba que una idea local de Ori se puede rechazar, aceptar y deshacer sin alterar el programa anterior. Las pruebas de dominio y los recorridos específicos de cada etapa cubren propuestas inválidas, puertas de progreso y resultados fallidos. Estas pruebas confirman comportamiento del software; **no miden comprensión, autonomía ni familiaridad con Scratch**.

## Sesión humana pendiente

Usar primero el guion de [Primera prueba de Agorix Kids](KIDS_PLAYTEST.md), sin guiar a la participante. Si termina las tres misiones, quiere seguir y no está cansada, ofrecer el nivel avanzado en una sesión breve separada. Dar una consigna por vez sin nombrar controles:

| Etapa    | Consigna neutral                                 | Observar                                                                                            |
| -------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Entrada  | “¿Qué te gustaría probar ahora?”                 | Si descubre el acceso avanzado y entiende qué se abrió.                                             |
| Escena   | “Creá algo con dos personajes.”                  | Si encuentra disfraces y sonidos, identifica qué personaje cambió y entiende el resultado de Jugar. |
| Reacción | “Hacé que pase algo cuando toques un personaje.” | Si descubre el evento, toca al personaje correcto y relaciona bloque, código y resultado.           |
| Puntaje  | “Hacé que cambie el número.”                     | Si predice o explica el valor mostrado por el monitor y reconoce qué bloque lo cambió.              |
| Ori      | Sin consigna nueva.                              | Si distingue la propuesta de Ori del programa propio y decide usar, cambiar o rechazar.             |

Registrar **acción intentada → resultado visible → expectativa → ayuda pedida → intervención adulta**. Anotar “no llegó a intentarlo” cuando corresponda. No guardar datos personales, transcripciones, audio ni video. Registrar observaciones de producto y comentarios sobre Scratch en [Kids 18 #389](https://github.com/Modern-Ash/agorix/issues/389) mediante los issues de hallazgos previstos en el guion base.

## Decisión pendiente

Completar aquí, solo después de la sesión: fecha y versión; qué etapas recorrió sin ayuda; dónde se trabó; qué le resultó familiar o extraño frente a Scratch; enlaces a los issues de hallazgos; y cambios que se incorporaron. A6 no se considera validado con aprendices antes de disponer de esa evidencia.
