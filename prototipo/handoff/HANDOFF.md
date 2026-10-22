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

## 7. Orden sugerido para reproducirlo

1. Copiar `STR` y `META` y `WORLDS` como módulos de datos.
2. Portar el motor (`port/kidsEngine.ts` ya tiene `flatten`, `applyOp`, `finishRun`, `simulate`, `computeProposal`). Agregar el caso `sound` a `applyOp` y el manejo de `repeat` que ya está en `flatten`.
3. Portar el estado de la clase `Component` a un store (`useReducer` o Zustand, a elección).
4. Portar pantallas en este orden: Inicio, Mapa, Editor (la más grande), Reflexión, Proyectos, Adultos, Crear.
5. Verificar contra las pruebas y contra la tabla de paridad del plan.
6. Recién después, conectar con `program-model`, `runtime` y `curriculum` del repo (`PLAN_INTEGRACION.md`).
