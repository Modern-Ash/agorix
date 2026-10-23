> **Histórico.** Los resultados de Fase 1 y 2 describen el repo al 2026-10-21. Desde entonces el repo ganó actores, looks, sonidos, eventos, variables, el servicio tutor, scripts de deploy y smoke de producción. Ver `README.md` de esta carpeta.

# Plan de integración: prototipo Agorix Kids → arquitectura real

Fuente: `Modern-Ash/agorix@main` (docs/architecture/SYSTEM_DESIGN.md, LEARNING_COMPANION.md, packages/*, apps/tutor-api).

## Regla de oro
El prototipo es una **vista**. La autoridad sigue siendo: programa canónico (`program-model`) → runtime determinístico → evidencia. Nada del prototipo debe guardar estado de programa fuera de esas piezas.

## Mapa prototipo → paquete real

| Prototipo | Destino real | Nota |
|---|---|---|
| Lista de bloques (move, turn, repeat, al iniciar) | `program-model` (`ProjectProgram`) | Verificar que los statements existentes cubran move/turn/repeat; si no, es trabajo de dominio, no de UI |
| Paleta, drag, tocar para agregar, papelera | `block-editor` | Decisión abierta: Blockly (stack recomendado) vs. editor táctil propio sobre `program-model` |
| Mundo 6×4, sprite, meta, trail | `stage` (adaptador) + `runtime` | `stage` es neutro; el render actual es CSS grid. Definir el adaptador de render |
| Predicción, resultado, Paso/Jugar | `runtime` (observaciones) + `learning-evidence` | Eventos `predictionMade`, `programRevisedAfterExecution` |
| Reglas de Ori (computeProposal) | Adaptador **determinístico** de `provider-runtime` | Es el proveedor fake: el mismo contrato que luego tendrá el modelo |
| Propuesta aceptar/cambiar/rechazar | `ProgramProposal` + validador | Eventos `proposalDecided` |
| Escalera de ayuda | `curriculum` (hint ladder) | Ver conflicto de niveles abajo |
| Código Agorix/Python/Node/Java | `language-projection` / `code-generator` | Python y TypeScript están en el roadmap; **Java no**; Node ≈ TypeScript |
| Autosave, deshacer, proyectos | `persistence` (`.agorix` v1) | metadata: missionProgress, hintLevel, locale, missionSpec |
| Mundo libre | `curriculum` + `ProjectCreativeState` | Meta del niño = mission spec nuevo, validado por runtime |
| Reflexión | `learning-evidence` (`reflectionRecorded`) | Nunca guardar texto; storage `localEphemeral` |
| Panel adultos | Solo lectura de `assessMission` | Separar completion de comprensión (ya lo exige el paquete) |
| Cambio de idioma | Locale en `persistence` + i18n existente | `i18n.ts` ya existe en apps/web |

## Fases

**Fase 0 — Decisiones (hoy).**
1. **Decidido:** editor táctil propio sobre `program-model`, con `block-editor` como adaptador.
2. **Decidido:** render propio sobre `stage` (sin Phaser por ahora).
3. **Decidido:** mantener Java como language pack nuevo, fuera del roadmap original.
4. **Decidido:** el personaje se llama Ori.

**Fase 1 — Leer y mapear (sin código).** Leer `apps/web/src/App.tsx` (partes de editor, misiones y persistencia), `packages/program-model` (statements), `packages/curriculum` (misiones existentes). Confirmar que `first-mission.reach-goal` coincide con la meta del prototipo.

**Resultado de Fase 1:**
- Statements reales: `move(steps)`, `turn(degrees)`, `repeat(count, body)`, `if(condition, then)`. Triggers: `onStart`, `greenFlag`. Mapeo directo: Mover → `move`, Girar ← / → → `turn` (-90 / +90), Repetir → `repeat`, "al iniciar" → `onStart`.
- Diferencia de unidades: el prototipo mueve por casillas; el runtime usa pasos en píxeles. Hace falta una escala de casillas en `stage`/curriculum.
- `WorldState` ya tiene sprite `{x, y, heading}`, así que la grilla 2D es viable sin cambiar el runtime.
- La misión real (`first-mission.reach-goal`) es una sola fila horizontal sin giros. Las misiones del prototipo (3 en grilla 6×4) son nuevas: deben escribirse como `MissionDefinition` con hint ladder de niveles 1–5 estrictamente crecientes.
- Predicado real: `spriteTouchingGoal`. Locales `en` y `es` ya existen en `curriculum`, igual que en el prototipo.
- Riesgo: "Ver idea" del prototipo equivale al nivel 5 de la escalera; debe estar bloqueado hasta los niveles previos.

**Fase 2 — Dominio primero.** Programa canónico + runtime con las pruebas existentes. Sin UI nueva. Criterio: el mismo programa del prototipo da el mismo resultado en el runtime real.

**Resultado de Fase 2 (lectura del código, no ejecutado):**
- Convención de dirección coincide: `heading 0 = Este`, `90 = Sur`, `270 = Norte`, igual que `DIRS` del prototipo. `turn(-90)` = Girar izquierda; `turn(+90)` = Girar derecha.
- `touchingGoal` es igualdad exacta de coordenadas en el estado final. El prototipo también evalúa solo el estado final, así que la clasificación de "llegó" coincide si la grilla usa enteros.
- **Divergencia:** el runtime real no tiene bordes; `move` siempre avanza. El prototipo frena al chocar con el borde. Hace falta un concepto de límites en la misión (curriculum), no en el runtime.
- **Divergencia:** el runtime real emite trazas por nodo (`nodeId`), útil para Paso y para resaltar bloques.

**Tabla de paridad a verificar con `pnpm test` (casos calculados a mano desde la lógica del prototipo):**

| Misión | Inicio | Meta | Programa | Prototipo | Runtime real |
|---|---|---|---|---|---|
| A | (0,2) Este | (4,2) | Mover 4 | éxito | `touchingGoal` = true |
| A | (0,2) Este | (4,2) | Mover 2 | se quedó corto | false (x=2) |
| A | (0,2) Este | (4,2) | Mover 5 | pasó la meta (queda en x=5) | false (x=5) |
| A | (0,2) Este | (4,2) | Mover 6 | chocó con el borde | false (x=6), sin concepto de borde |
| B | (0,3) Este | (3,1) | Mover 6 | chocó con el borde | false (x=6), sin concepto de borde |
| C | (0,0) Este | (3,3) | Girar der., Mover 3, Girar izq., Mover 3 | éxito | true |

Resultado esperado: 4 de 5 casos coinciden en el resultado; el caso de borde necesita la regla de límites antes de ser paridad completa.

**Fase 3 — Vista táctil en apps/web.** Reemplazar la UI de la app actual por el prototipo (React + Vite, el stack del repo), leyendo y escribiendo solo `program-model` y `persistence`. Mismos flujos: predicción, paso, propuesta, reflexión.

**Hallazgos al empezar:**
- `apps/web` usa React 18, Vite 7, TypeScript estricto y tests con Vitest y Playwright.
- La CSP de producción es `font-src 'self' data:` y `connect-src 'self'`. El prototipo carga Google Fonts, que queda bloqueado: hay que autoalojar Atkinson Hyperlegible, Epilogue y JetBrains Mono.
- El prototipo no usa paquetes del repo; hay que reemplazar su motor de reglas por `program-model`, `runtime` y `curriculum`.
- No tengo acceso de escritura al repositorio: los archivos quedan en este proyecto para que los integres o los envíe un desarrollador.

**Fase 4 — Evidencia.** Emitir eventos de `learning-evidence` desde las acciones reales. Sin texto libre, sin timestamps.

**Fase 5 — Learning Companion.** Ori pasa de reglas a adaptadores reales: primero el determinístico (ya es el de Fase 3), luego Ollama o gateway compatible. Todo output por `validateLearningCompanionSafety`; si falla, el niño ve el mensaje seguro y el programa no cambia.

**Fase 6 — Mundo libre y desafíos.** La IA propone metas; el runtime verifica que sean alcanzables antes de mostrarlas.

**Fase 7 — Móvil y PWA.** Capacitor después de que Web esté estable (issue #37).

## Conflictos a resolver antes de Fase 3
- **Niveles de ayuda:** `LEARNING_COMPANION`/PEDAGOGY usan 6 niveles; `learning-evidence` valida niveles 1–5. Elegir una escala única.
- **Ayuda directa:** el botón "Ver idea" hoy da un bloque completo; la política pedagógica lo prohíbe en niveles tempranos.
- **Predicción:** en el prototipo es obligatoria antes de Jugar; PEDAGOGY la describe como opcional "cuando sea útil". Confirmar.
- **Proveedor por defecto:** el prototipo no tiene red. Todo modelo entra por `tutor-api`/`provider-runtime`, nunca desde el navegador.

## Qué no cambia
Programa canónico, semántica del runtime, completion predicate, y el hecho de que la app debe funcionar sin IA.
