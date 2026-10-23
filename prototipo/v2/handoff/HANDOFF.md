# Handoff: Agorix Kids (prototipo móvil/tablet/computadora para niños 6–8)

Objetivo: reproducir este prototipo tal cual en React + Vite, y después conectarlo con la arquitectura real de Agorix (repo `Modern-Ash/agorix`).

## 1. Qué hay en esta carpeta

| Archivo | Para qué |
|---|---|
| `Agorix Kids App.dc.html` | **Fuente de verdad del prototipo.** Plantilla (HTML con `{{ }}` y `<sc-if>`/`<sc-for>`) + clase lógica `Component` con todo el estado, reglas y textos (ES/EN). |
| `Agorix Mobile Wireframes.dc.html` | 26 ideas de layout (1a–1z) con la elegida marcada HI-FI. Referencia, no se implementa tal cual. |
| `PLAN_INTEGRACION.md` | Plan de integración con el repo real, decisiones tomadas y divergencias encontradas. |
| `github.md` | Relación con el repo y mapa de pantallas. |
| `port/kidsEngine.ts` | Motor de reglas sin UI (programa aplanado, ejecución, resultado, propuesta de Ori). |
| `port/kidsEngine.test.ts` | Casos de paridad y de propuestas. Escritos, no ejecutados. |
| `port/web/KidsEditor.tsx` | Componente React mínimo que usa el motor. Referencia, no probado. |
| `port/web/fonts.css` | `@font-face` para las tipografías autoalojadas. |
| `assets/agorix-logo.svg`, `assets/agorix-agent-active.svg` | Logo y ícono del agente, copiados del repo. |

Importante: `Agorix Kids App.dc.html` usa el runtime de "Design Components" (`support.js`). Si lo abrís fuera de ese entorno no va a renderizar. Para reproducirlo en React, la lógica de la clase `Component` es JavaScript plano y se puede copiar casi sin cambios; la plantilla hay que traducirla a JSX.

## 2. Estado y lógica (en `Agorix Kids App.dc.html`, clase `Component`)

Estado principal (`this.state`):
- `screen`: `onboard | map | create | editor | reflect | projects | parents` (null = onboard).
- `onStep` (0–2), `lang` (`es|en`), `avatar` (emoji elegido), `world` (`space|ocean|robots|city`), `mIdx` (0–2 misiones; 3 = mundo libre/creativo).
- `programs`: mapa `"mundo:mIdx"` → árbol de bloques.
- `mode` (`blocks|code`), `codeLang` (`agorix|python|node|java`).
- `run` (estado de ejecución), `predicted`/`prediction`, `predLog`.
- `propOpen`, `stats` (decisiones sobre Ori), `history` (deshacer), `freeGoals`.
- `done`, `stars`, `toast`, `drag` (arrastre con pointer events), `orient`, `vw` (ancho de ventana).

Bloques (`META`): `move` (Mover con número 1–5), `turnL`/`turnR` (Girar ←/→), `repeat` (Repetir con número 2–6 y cuerpo), `sound` (sonar; tono por WebAudio).

Reglas de ejecución:
- Grilla 6×4. Dirección: 0 = Este, 90 = Sur, 180 = Oeste, 270 = Norte.
- `move` que sale de la grilla = choque (resultado `wall`), la posición no cambia.
- Al terminar: `success` si está en la meta; `passed` si la pisó en algún paso y terminó en otro lado; si no, `short`.
- Predicción obligatoria antes de Jugar (Sí / No / No sé); se registra en `predLog` al terminar.
- Ori propone (`computeProposal`): mover la distancia que falta, girar o repetir (solo misión 3); nunca se aplica sin "Usar".

Misiones:
- M1: inicio (0,2) Este → meta (4,2).
- M2: inicio (0,3) Este → meta (3,1).
- M3: inicio (0,0) Este → meta (3,3).
- Mundo libre (mIdx 3): inicio (0,2) Este; la meta la pone el niño tocando el mundo.

Mundos (`WORLDS`): space 🚀/🌎, ocean 🐙/🪸, robots 🤖/🔋, city 🛴/📦, cada uno con fondo, celda, trazo, meta, sprite, color de texto y tono suave.

Avatares del niño: 🦊 🐼 🐸 🦁 🐨 🦄; reemplazan al sprite del mundo en editor, mapa, proyectos, predicción y reflexión.

## 3. Pantallas y flujos

1. **Inicio (onboard):** 3 pasos: idioma (ES/EN, con 🔊), avatar, presentación de Ori ("puede equivocarse"). Sin nombre ni cuenta.
2. **Mapa:** elegir mundo (4 pestañas grandes), 3 misiones en zigzag con la actual pulsante, 🔒 en las bloqueadas. Concept chips arriba (✓ / práctica / próximo).
3. **Crear:** elegir personaje y fondo, entrar al editor en mundo libre.
4. **Editor:** arriba: ← volver, botón meta/texto, ↶ deshacer, toggle ▦ bloques / </> código. Izquierda: mundo 6×4 + controles Jugar/Paso/Volver + tarjeta de Ori. Derecha: programa (bloques con número y ✓/◆ de ejecución) y paleta inferior con arrastrar o tocar para agregar al final. Franja de código debajo de los bloques. Overlay de predicción y de propuesta.
5. **Reflexión:** elegir la causa, caritas de cómo se sintió, predicciones acertadas (✓/✗) y "seguir jugando".
6. **Proyectos:** grilla de miniaturas, "Nuevo" abre mundo libre, "✓ guardado".
7. **Adultos:** puerta de suma (7+5), progreso del día con límite, conceptos, decisiones sobre Ori, interruptores y privacidad.

Navegación inferior (cuando aplica): Mapa / Crear / Proyectos / Adultos.

## 4. Diseño

- Fuente de tokens: `docs/product/DESIGN_SYSTEM.md` y `apps/web/src/App.css` (`:root`). Colores clave: canvas `#F7F4EE`, panel `#FFFFFF`, texto `#17201D`, secundario `#5E6B65`, bordes `#D9DED6`, acento runtime `#0E9F9A`, IA `#6C5CE7`, movimiento `#3F7EE8`, control `#8B63D9`, evento `#D8892F`, datos `#2F9D78`, éxito `#2E8F4E`, error `#C2413B`.
- Tipografías: Atkinson Hyperlegible (texto), Epilogue (títulos), JetBrains Mono (código). Autoalojar en `public/fonts/` (ver `port/web/fonts.css`).
- Objetivos táctiles ≥ 44 px (la mayoría 56–64 px).
- Bloques: relleno de color por función, texto blanco, número en cápsula blanca. Propuestas de Ori: tono claro con borde punteado violeta.
- Adaptación: teléfono < 700 px (marco 390×844 o 844×390), tablet 700–1100 px, computadora > 1100 px (marco con alto mínimo 560 px).
- Reduce movimiento: `prefers-reduced-motion` desactiva animaciones.

## 5. Textos

Todos están en `STR.es` y `STR.en` dentro de la clase `Component`. Copiar esas dos tablas tal cual; son la fuente de copy.

## 6. Pendientes conocidos

- La franja de código bajo los bloques solo se muestra en vista de bloques.
- El sonido es un tono único; no hay sonidos por mundo.
- El choque con el borde no existe en el runtime real (`PLAN_INTEGRACION.md`, Fase 2).
- Las pruebas de `port/kidsEngine.test.ts` no se corrieron.
- Ori es reglas deterministas; no hay modelo conectado.
- Los datos del panel de adultos (minutos, decisiones de ejemplo) son de muestra.

## 6b. Diferencias con la versión publicada (`agorix.modern-ash.com/kids`)

Revisado con capturas de inicio (idioma, avatar, Ori), mapa, editor (bloques y código) y propuesta de Ori. No revisado: reflexión, proyectos, adultos, estados de ejecución.

- **Ori tiene chat libre:** botón "Preguntale a Ori" abre un panel con campo de pregunta. Dice "el chat se borra al salir". No está en el prototipo ni en el motor. Requiere definir la política (qué responde, cómo se valida, sin guardar texto).
- **Escalera de pistas:** aparece "Pista 1" bajo "¿Te doy una idea?". El prototipo tiene un solo "Ver idea".
- **Propuesta en dos pasos:** la tarjeta de Ori muestra "Propuesta" como botón antes de abrir el detalle (en el prototipo se abre directo).
- **Deshacer y Rehacer:** la barra del editor tiene ambos. El prototipo solo tiene Deshacer.
- **Títulos de misión:** "Misión 1 · Camino recto", con encabezado y botón "Volver al mapa". El prototipo solo muestra "Volver" y misiones sin nombre.
- **Consigna visible:** "Mueve a tu personaje en línea recta hasta la meta." arriba del mundo.
- **Mundo:** la meta es 🌎 en espacio, con la misma grilla 6×4. El sprite es el avatar.
- **Código:** la etiqueta del evento es "when start" en la vista Agorix Code, y los giros aparecen como `turn -90` / `turn 90`. El prototipo usa "al iniciar" y "girar ←/→". Las pestañas de código tienen Agorix Code, Python, Node y Java.
- **Paleta:** botones con "+" y texto ("+ mover", "+ girar ←", "+ repetir", "+ sonar") en vez de tarjetas con ícono y número. Hay una zona "Soltá aquí para agregar".
- **Bloques en el programa:** se ven con ◆ al ejecutarse y con botón ✖ para quitar. El prototipo quita con arrastre a la paleta.
- **Mapa:** pestañas de mundos con etiqueta debajo, misión 1 con 🦊 y "▶ Jugar", misiones 2 y 3 con candado, conectores punteados. Igual en lo esencial.
- **Navegación inferior:** Mapa, Crear, Mis proyectos, Adultos. Igual que el prototipo.
- **Tema:** el sitio público usa `theme-color #06923e` (verde). Las capturas del `/kids` usan crema y violeta, igual que el prototipo. Confirmar cuál es el sistema oficial.

## 6c. Funcionalidad agregada después del prototipo base

Estado de implementación en `Agorix Kids App.dc.html`.

**Imágenes y personalización**
- Fotos propias para Ori, cada explorador y cada fondo de mundo (Adultos → "Imágenes del juego"). Se guardan en `localStorage` (`agorix-kids-imgs`), redimensionadas a 256 px.
- Exploradores y fondos propios: "+ Explorador" y "+ Fondo" en Crear. Se guardan en `agorix-kids-custom`. Los fondos propios solo aplican a proyectos nuevos de mundo libre.
- Las imágenes se muestran como `background` (no `<img src>`), para no pedir URLs con marcadores sin resolver.

**Edición (paridad con Scratch)**
- Duplicar bloque (⧉) en cada bloque suelto; copia debajo con ids nuevos.
- Rehacer junto a Deshacer.
- Guardar y abrir proyecto como `.json` (Proyectos). Incluye programas, misiones terminadas, metas libres y estrellas.
- Guardado automático en `agorix-kids-projects`; se recupera al recargar.
- Colores de bloques al estilo Scratch: movimiento `#4C97FF` (borde `#3373CC`), control `#FFAB19` (`#CF8B17`), sonido `#CF63CF` (`#BD42BD`), evento `#FFBF00` (`#CC9900`).

**Ori**
- Flota en la esquina inferior derecha del marco, con burbuja; tocarla abre la propuesta.

**Cuentas y franja de edad**
- Franjas 6–8, 9–12 y 13+ (Adultos → "Franja de edad"): cambian la paleta, las pestañas de código y la forma de Ori. El encabezado muestra la franja, no "Kids".
- Cuenta de adulto (correo y contraseña de 6+ caracteres). Genera un código de 6 dígitos que el niño ingresa en el inicio ("Tengo un código de mi adulto") para vincularse.
- Solo prototipo local: no hay backend, verificación por correo ni sincronización.

## 6d. Paridad pendiente con Scratch

- Operadores (sumar, comparar, aleatorio) y bloque "si / si no".
- Variables y listas.
- Bloques "esperar" y "enviar mensaje".
- Varios personajes (sprites) y biblioteca de personajes.
- Editor de disfraces (cambio de apariencia por acción).
- Biblioteca de sonidos y grabación propia (hoy hay un tono).
- Forma de rompecabezas (encastre visual) en los bloques.
- Zoom del área de bloques y menú contextual (clic derecho).
- Borrar proyectos guardados.
- Tutoriales y atajos de teclado.
- Compartir y remezclar: fuera por privacidad, o detrás de la cuenta de adulto.

## 6f. Especificación de pendientes (para implementar en el motor real)

Implementar sobre `program-model` y `runtime` del repo, no sobre el prototipo. Cada punto necesita pruebas con resultado esperado.

- **Varios personajes:** cada sprite tiene su propio programa y estado. Prueba: dos sprites con "mover 1" avanzan cada uno su casilla, sin interferir.
- **Operadores aritméticos:** sumar y restar entre dos valores (contador y número). Prueba: contador 3, "contador + 2" da 5; "contador − 5" da −2 sin error.
- **Comparadores:** "menor que" y "mayor o igual que" además de "=" y "≥" ya existentes.
- **Editor de disfraces:** un sprite tiene N disfraces; "cambiar disfraz a K" fija el disfraz K. Prueba: sprite con 3 disfraces, "cambiar a 2" muestra el 2 en la siguiente casilla.
- **Sonidos propios:** cargar un audio por sprite. Prueba: el audio se reproduce una vez al ejecutar el bloque.
- **Zoom y menú contextual:** zoom del área de bloques; clic derecho sobre un bloque ofrece duplicar, borrar y explicar.

Regla común: lo que el niño ve en el prototipo debe coincidir con el resultado del runtime real; los casos de la tabla de paridad de `PLAN_INTEGRACION.md` siguen siendo la referencia.

## 6e. Ventajas de Agorix frente a Scratch (diseño propio)

- Código visible en cuatro lenguajes (Agorix Code, Python, Node, Java), sincronizado con los bloques.
- Predicción antes de ejecutar y registro de aciertos (✓/✗).
- Ejecución paso a paso con resultado verificado por el runtime, no por el niño.
- Ori propone; el niño decide usar, cambiar o rechazar, y esas decisiones quedan en el panel de adultos.
- Escalera de pistas y reflexión al terminar cada misión.
- Sin cuenta para el niño, sin nombre ni ubicación, sin chat público.
- Panel de adultos con límite diario, conceptos aprendidos y control de Ori.
- Franjas de edad que cambian la complejidad de la herramienta.
- Lectura en voz alta en cada pantalla.

## 7. Orden sugerido para reproducirlo

1. Copiar `STR` y `META` y `WORLDS` como módulos de datos.
2. Portar el motor (`port/kidsEngine.ts` ya tiene `flatten`, `applyOp`, `finishRun`, `simulate`, `computeProposal`). Agregar el caso `sound` a `applyOp` y el manejo de `repeat` que ya está en `flatten`.
3. Portar el estado de la clase `Component` a un store (`useReducer` o Zustand, a elección).
4. Portar pantallas en este orden: Inicio, Mapa, Editor (la más grande), Reflexión, Proyectos, Adultos, Crear.
5. Verificar contra las pruebas y contra la tabla de paridad del plan.
6. Recién después, conectar con `program-model`, `runtime` y `curriculum` del repo (`PLAN_INTEGRACION.md`).
