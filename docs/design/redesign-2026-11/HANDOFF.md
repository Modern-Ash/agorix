# Agorix redesign — implementation handoff

Source of truth for the visuals: the "Agorix rediseño" canvas in Claude Design
(https://claude.ai/artifact/CiHZrTTzXjX9z23KbXwgE5). The `mockups/` folder holds the
source of every artboard (`.dc.html`): plain HTML with inline styles plus a small
`renderVals()` script that shows the intended states and interactions. They are
**reference, not code to copy** — they need the canvas runtime to render.

Where two iterations cover the same screen, **Iteration 2 wins**
(`PanelKit`, `Editor2Web`, `Editor2Celular`, `Crear2Web`).

All work must follow `AGENTS.md`: one issue per block, small PRs linked to the issue,
deterministic tests for success and failure paths, no self-merge. Product invariants
(AI proposes / learner decides / runtime proves; code one tap away) are unchanged by
this redesign.

## Global rules (every screen)

- Works at phone (360–430 px), tablet (768–1024 px, both orientations) and desktop (≥1280 px).
  **No horizontal page scroll** at any width.
- Touch targets ≥ 44 px (48 px on phone). Text contrast ≥ 4.5:1. Respect `prefers-reduced-motion`.
- Rioplatense Spanish (voseo) copy; English via existing i18n.
- No visual elements copied from Scratch's brand (cat, logo, colors).
- Block category colors (keep consistent everywhere): Movimiento `#2563EB`, Apariencia `#6D3FE0`,
  Sonido `#BE185D`, Control `#F5B301` (dark text), Lápiz `#15803D`, Música `#C2410C`,
  Variables `#0E7490`, Mis bloques `#5B6475`. Primary/adult teal `#0F6E66`. Ori violet `#6D3FE0`.

## Block 1 — Shared `<Panel>` component (do first)

Mockup: `PanelKit.dc.html`. Today the Studio (`apps/web/src/App.tsx`) already has panel
maximize (`maximizedPanel`, `PanelId`), but the Kids editor has nothing equivalent.
Extract one reusable component (suggested home: `packages/studio-ui`) and use it in both.

API sketch:

```tsx
<Panel
  id="program"
  title="Programa de Pip"
  accent="#2563EB"
  zoomable
  minimizable
  maximizable
  actions={<RunControls />}
>
  {children}
</Panel>
```

Behavior:

1. Header 40 px (44 px on phone): accent dot, title, panel-specific actions, then zoom (− / % / +), minimize, maximize — always in this order.
2. Minimize sends the panel to a dock at the bottom of the work area; one tap restores it to its slot.
3. Maximize fills the whole work area (not the browser); Esc or the same button restores.
4. Zoom only on canvas panels (Programa, Escenario, Disfraces). Tapping the % resets to 100 %. Range 50–200 %.
5. Dividers between panels are draggable; sizes/minimized state persist per device (localStorage, try/catch).
6. Phone: maximize = full screen; minimize = chip in the dock.
7. Accessible: header buttons have `aria-label`; maximized panel traps nothing and restores focus.

Tests: unit tests for the layout reducer (minimize/restore/maximize/only-one-maximized/persisted state),
component tests for keyboard (Esc restores) and aria labels.

## Block 2 — Mission / scene editor (`KidsStudioScreen.tsx`, `EditorScreen.tsx`)

Mockups: `Editor2Web.dc.html` (desktop), `Editor2Celular.dc.html` (phone).
Older `EditorTablet`/`EditorWeb` boards show the sound picker and prediction flow.

- **Top bar, one line, 52 px:** back · mission pill ("Misión 2 · La esquina" + goal text truncated; tap expands a popover with the full text) · "Pista 1" (opens the popover with the hint) · undo · redo · keyboard · download · help · age chip. The current big mission card is removed.
- **Left activity bar (68 px):** Código, Disfraces, Sonidos (+ Ori at the bottom). It switches the content of the left drawer panel. **Disfraces / Sonidos no longer replace the main area**; program and stage stay visible.
- **Left drawer `<Panel>`:** Bloques (category rail + blocks) / Disfraces y fondos (Dibujar, Subir imagen, costume grid, backdrop grid) / Sonidos (search + list with listen/use).
- **Center:** `<Panel>` Programa (zoomable) and, docked below, `<Panel>` Código (language tabs Agorix Code / Python / TypeScript / Java; minimizable). Code must stay one tap away and in sync with the canonical program.
- **Right column (≈440 px):** `<Panel>` Escenario (Jugar / Detener / Paso in its header), `<Panel>` Personajes y fondo (sprites, +, backdrop thumbnail that opens Disfraces), `<Panel>` inspector of the selected sprite (x, y, dirección, tamaño; "¿Qué va a hacer Pip?" as chips; "Lo que pasó de verdad").
- **Phone:** stage panel on top (min/max), program panel with zoom below, bottom bar Bloques / Disfraces / Sonidos / Código opening bottom sheets (maximizable). Tapping a block appends it (no drag needed on phone).
- **Tablet landscape:** activity bar + drawer + program + stage; inspector collapses into the stage column.

Tests: activity switching keeps program/stage mounted; maximize/minimize per panel; mission popover open/close; phone sheet append flow; no horizontal overflow at 360/768/1280 (Playwright viewport tests).

## Block 3 — Create scene (`CreateScreen.tsx`)

Mockups: `Crear2Web.dc.html` (desktop), `CrearCelular.dc.html` (phone, 3-step wizard).

- Desktop/tablet: one screen, no page scroll. Left `<Panel>` with tabs **Personaje | Fondo** (with counts), filter chips and search **in the same row**, compact grid (Dibujar and Subir are the first two tiles). Right: sticky live preview, summary chips (Personaje / Fondo, tap to jump to that tab), "Sorprendeme", primary "Crear escena".
- Phone: 3-step wizard (Personaje → Fondo → ¡Crear!) with progress bar and back button.
- Remove the duplicated "Elegí tu personaje" vs "Personajes para Escena libre" sections.

## Block 4 — Adults (`ParentsScreen.tsx`, `AdultTabs.tsx`, `KidsIndicatorsPanel.tsx`)

Mockups: `Main.dc.html` (desktop Resumen), `AdultosTablet.dc.html` (Ajustes), `AdultosCelular.dc.html` (Personalizar), `AdultosCuenta.dc.html` (Cuenta y privacidad).

- 4 tabs: **Resumen · Ajustes · Personalizar · Cuenta y privacidad**. Desktop: side nav; tablet/phone: fixed top tabs.
- Resumen: KPI cards (time with inline −/+ goal, missions, concepts, Ori decisions) + learning indicators with explanations in tooltips; "Borrar indicadores" as secondary.
- Ajustes: age band segmented control; switches grouped as Ayuda de la IA / Accesibilidad / Contenido (includes microphone permission); daily goal.
- Personalizar: Imágenes | Sonidos toggle, filter Exploradores / Personajes / Fondos, card grid (replaces the 18 "Elegir audio para" rows), storage meter.
- Cuenta y privacidad: two clear paths ("Ya tengo un código" vs "Entrar / Crear cuenta"); Privacy collapsed; AI status moved to a collapsed "Diagnóstico".
- Fix: the account card overflows horizontally on phone today.

## Block 5 — Map (`MapScreen.tsx`)

Mockup: `MapaCelular.dc.html`. Worlds as a 4-column selector that fits on phone; dismissible age banner; mission path with locked/next/done states; Ori docked in the bottom nav (never covering missions).

## Block 6 — Admin / Centro de IA (`apps/web/src/admin/AiAdminApp.tsx`)

Mockups: `AdminWeb.dc.html`, `AdminTablet.dc.html`, `AdminCelular.dc.html`.

- Side nav grouped: Agentes de Ori · Reglas · Contenido y grupos · **Monitoreo** (Chat de Ori 24 h + Historial move here instead of repeating under every section).
- Sticky draft bar on every section: status ("Borrador con N cambios sin publicar" / validated / published) + Descartar · Validar · Publicar.
- Intervención de Ori: steppers/sliders next to a live simulated-learner preview table.
- Misiones: visual 6×6 board (mark start / goal), live winnability check, ES/EN texts side by side.
- Modo grupo on phone: section selector + accordions with a summary; categories as toggle chips.
- Fixes: horizontal overflow on phone; "Volver a Agorix" contrast in the dark header.

## Suggested order of PRs

1. `<Panel>` + layout reducer (Block 1)
2. Editor top bar + mission pill (Block 2a)
3. Editor activity bar + left drawer for Disfraces/Sonidos (Block 2b)
4. Editor phone layout (Block 2c)
5. Create scene (Block 3)
6. Adults tabs (Block 4)
7. Map (Block 5)
8. Admin (Block 6)
