# Integración creativa de Escena libre (#1125)

Base: `main` posterior a #1155. Fuente de alcance: [#1125](https://github.com/Modern-Ash/agorix/issues/1125), [matriz de discovery](SCRATCH_FUNCTIONAL_MATRIX_1122.md), [modelo de interacción](INTERACTION_MODEL.md) y [paridad de entrada](INPUT_PARITY_MATRIX.md).

## Gap corregido

En una ventana desktop de 1280×800, la paleta puede quedar por debajo del programa. Al iniciar un arrastre, el editor bloqueaba el scroll nativo y no desplazaba la página; por eso el bloque visible no podía llegar al programa fuera de la ventana. Ahora el arrastre desplaza la página cuando el puntero se acerca a los 72 px superiores o inferiores. Al soltar, cancelar o desmontar el editor, se detiene el desplazamiento y se retira el bloque fantasma. El botón de teclado/touch sigue añadiendo el mismo bloque al modelo canónico.

## Recorrido integrado

`apps/web/e2e/kids-creative-integration.spec.ts` parte de un navegador sin flags manuales en 1280×800, 820×1180 y 390×844. Recorre onboarding → Mapa → Crear → Escena libre; comprueba ocho categorías, arrastre desktop con scroll o Enter en tablet/teléfono, bloques anidados, código proyectado, dos actores con scripts distintos, sonido, ejecución, Undo/Redo y recarga con el proyecto guardado. También comprueba ausencia de scroll lateral e infracciones axe graves o críticas. Adjunta una captura por tamaño al reporte Playwright.

Verificación local: build Web aprobado; matriz nueva **4/4** (incluye soltar fuera del programa y detener el scroll); pruebas existentes de arrastre, touch, anidamiento y medios **10/10**. El gate de import/export y smoke de producción está en [#1127](RELEASE_GATE_1127.md). Estos resultados son de código local; producción todavía debe comprobarse con el SHA integrado.

La [prueba de familiaridad con una persona](ADOPTION_USABILITY_CHECKLIST.md) sigue pendiente. La automatización demuestra acciones y estado visible, no que un usuario de Scratch encuentre la interfaz intuitiva.
