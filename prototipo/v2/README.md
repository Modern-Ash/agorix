# Prototipo Agorix Kids v2

Entrega de Claude Design posterior a `prototipo/handoff/` (v1). Es referencia visual y de comportamiento: el estado canónico vive en `program-model` y `runtime`. Epic de seguimiento: #436.

## Qué cambió respecto de v1
- `handoff/HANDOFF.md` secciones 6b (diferencias con lo publicado), 6c (funcionalidad agregada), 6d (paridad pendiente con Scratch), 6e (ventajas frente a Scratch) y 6f (especificación de pendientes).
- `Agorix Kids App.dc.html` y `handoff/Agorix Kids App.dc.html` son la fuente de verdad del prototipo. Solo renderizan dentro del runtime "Design Components" (`support.js`).
- `uploads/` son capturas de la versión publicada usadas para la sección 6b.

## Estado de cada ítem

| Ítem del prototipo v2 | Issues | Estado |
|---|---|---|
| Imágenes propias (Ori, exploradores, fondos) | #457, #458, #459 | entregado |
| + Explorador / + Fondo propios | #456, #460 | entregado |
| Duplicar bloque ⧉ | #446 | entregado |
| Rehacer | — | ya publicado |
| Guardar/abrir proyecto .json (.agorix) | — | ya publicado (#376) |
| Autoguardado | — | ya publicado (#376) |
| Colores de bloque estilo Scratch | #447 | entregado |
| Ori flotante con burbuja | #452 | entregado |
| Franjas de edad 6–8 / 9–12 / 13+ | #453, #454, #455 | entregado |
| Cuenta de adulto y código de 6 dígitos | #471 | diseño aprobado; implementación en #504 (docs/superpowers/specs/2026-10-23-kids-adult-link-design.md) |
| Si / si no | #463 | entregado |
| Comparadores ≥ ≤ | #464 | entregado |
| Operadores aritméticos en la UI | #465 | entregado |
| Aleatorio | #467 | entregado |
| Listas | #468 | pendiente |
| Esperar | #466 | entregado |
| Enviar mensaje | — | ya en program-model (`broadcast`); UI en avanzado |
| Varios personajes y disfraces | #469 | entregado |
| Biblioteca de sonidos | #461 | entregado |
| Sonidos propios | #462 | entregado |
| Forma de rompecabezas | #448 | entregado |
| Zoom del área de bloques | #449 | entregado |
| Menú contextual | #450 | entregado |
| Borrar proyectos guardados | #445 | entregado |
| Tutoriales | #470 | pendiente |
| Atajos de teclado | #451 | entregado |
| Compartir y remezclar | #472 | decidido: fuera de Kids (ADR 0009 aceptado) |
| Diferencias 6b con la versión publicada | #444 | auditoría |

## Auditoría de las diferencias 6b (issue #444)

Verificada el 2026-10-23 contra la app en ejecución (`/kids`, español, misión 1). "Igual" = la app publicada y la entregada coinciden con lo que el handoff 6b describe de la versión publicada.

| Diferencia 6b | Estado | Evidencia |
|---|---|---|
| Chat libre con Ori ("Preguntale a Ori", se borra al salir) | igual | botón en el editor; e2e `kids-editor.spec.ts` |
| Escalera de pistas ("Pista 1") | igual | botón "Pista 1" bajo "¿Te doy una idea?" |
| Propuesta en dos pasos (botón "Propuesta") | igual | tarjeta de Ori con "Propuesta" |
| Deshacer y Rehacer | igual | ambos en la barra del editor |
| Títulos de misión | igual | kicker "Misión 1", título "Camino recto", "Volver al mapa" |
| Consigna visible | igual | "Mueve a tu personaje en línea recta hasta la meta." |
| Meta 🌎 en espacio, grilla 6×4, sprite = avatar | igual | mundo del editor |
| Código `when start` y `turn -90` | igual | pestaña Agorix Code; pestañas Agorix Code, Python, TypeScript / Node, Java |
| Paleta "+ mover" etc. y "Soltá aquí para agregar" | igual | paleta del editor |
| Bloques con ◆/✓ y botón de quitar (×) | igual | bloques del programa |
| Mapa: pestañas de mundos, misión 1 "▶ Jugar", candados | igual | pantalla Mapa |
| Navegación inferior Mapa, Crear, Mis proyectos, Adultos | igual | barra inferior |
| Tema: `theme-color #06923e` (verde) vs crema/violeta | **intencional** | `index.html` usa el verde del sitio; Kids usa el lienzo crema `#F7F4EE` y tokens de `docs/product/DESIGN_SYSTEM.md`. |

Ninguna fila quedó como `gap`, por lo que no se abrieron issues nuevos.

### Decisión de tema

El sistema oficial es `docs/product/DESIGN_SYSTEM.md`: lienzo crema, tipografías autoalojadas y paleta de tokens de Kids. Ese documento dice explícitamente que Agorix **no debe** adoptar por defecto una identidad de piezas de rompecabezas ni paletas arcoíris permanentes. Por eso la paleta Scratch (#447, #448) quedó detrás del flag `puzzleShape`, apagado por defecto. El verde `#06923e` es solo el color del navegador del sitio.
