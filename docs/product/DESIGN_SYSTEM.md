# Agorix design system and visual language

## Purpose

This document defines the reusable visual system for Agorix Web/Tablet, Agorix Studio and future Worlds surfaces. It is intentionally source-controlled so a contributor can implement the system without private Figma files or private chat context.

The system supports the product north star:

> AI proposes. Child decides. Runtime proves. Child explains.

The visual language should make those roles visible: learner work, AI proposals, accepted code and runtime evidence must feel related but never interchangeable.

## Visual Position

Agorix should feel like a calm creative studio for learning to program with AI. It is friendly for early learners, but not embarrassing for older beginners. It should feel more like a capable creative tool than a toy.

### Signature Gesture

Use a **learning rail**: a subtle horizontal or vertical evidence line that connects intent, proposal, code, runtime and reflection. The rail can appear in mission headers, execution inspectors, proposal cards and progress indicators. It is a structural motif, not decoration.

### What Agorix Is Not

Agorix must not default to:

- Scratch-like puzzle-piece identity as the dominant brand language;
- permanent rainbow block palettes as decoration;
- heavy black 2px borders everywhere;
- hard offset shadows as the default depth model;
- every capability as a separate floating card;
- childish "kid mode" styling;
- dark sci-fi neon as the only signal of AI.

The current POC uses thick dark borders and offset shadows. That was useful for proving layout boundaries, but the durable system should move toward softer surfaces, lower-contrast edges, meaningful depth and semantic color.

## Design Principles

1. **Evidence has weight**: runtime results, execution state and code mapping should be visually reliable and stable.
2. **AI is provisional**: proposal surfaces are distinct from accepted program surfaces. Use softer edges, review affordances and explicit uncertainty states.
3. **Worlds provide delight**: core product chrome stays calm; Worlds carry richer narrative color and character energy.
4. **Code is normal**: code surfaces are not hidden, scary or advanced-only. They should be readable and visually respected.
5. **Touch first, not touch only**: controls support tablet gestures and keyboard/focus states.
6. **One system, multiple surfaces**: Web/Tablet and Studio share semantic tokens, then adapt density and background treatment.
7. **Language expands**: English and Spanish text must fit without layout collapse.

## Token Model

Tokens use semantic names rather than raw color names. Values below are starting points; implementation may tune them for contrast while preserving the roles.

### Core Palette

| Token                  | Light value | Dark value | Use                                   |
| ---------------------- | ----------- | ---------- | ------------------------------------- |
| `--agx-surface-canvas` | `#F7F4EE`   | `#11151B`  | page or IDE background                |
| `--agx-surface-panel`  | `#FFFFFF`   | `#1A2028`  | panels, inspector rows, cards         |
| `--agx-surface-raised` | `#FBFAF6`   | `#222A34`  | action palettes and elevated controls |
| `--agx-surface-code`   | `#17212B`   | `#0C1117`  | code editor/readout                   |
| `--agx-text-primary`   | `#17201D`   | `#F3F7F4`  | primary text                          |
| `--agx-text-secondary` | `#5E6B65`   | `#AEB8B3`  | secondary text, metadata              |
| `--agx-text-on-code`   | `#EDF7F1`   | `#E9F4F0`  | code text                             |
| `--agx-border-subtle`  | `#D9DED6`   | `#33404C`  | panel boundaries                      |
| `--agx-border-strong`  | `#8C9A92`   | `#5B6A77`  | selected/active boundaries            |
| `--agx-focus`          | `#2F6FED`   | `#8AB4FF`  | visible focus ring                    |

### Semantic Color Roles

| Role              | Light token | Dark token | Meaning                                     |
| ----------------- | ----------- | ---------- | ------------------------------------------- |
| Movement          | `#3F7EE8`   | `#75A7FF`  | motion blocks, movement concepts, path cues |
| Control/logic     | `#8B63D9`   | `#B79CFF`  | repeat, branch, condition concepts          |
| Data              | `#2F9D78`   | `#65D5B0`  | variables, values, measurements             |
| Events            | `#D8892F`   | `#F2B15D`  | triggers, start/run events                  |
| AI proposal       | `#6C5CE7`   | `#A79BFF`  | provisional AI suggestions and diffs        |
| Runtime/execution | `#0E9F9A`   | `#55D6D2`  | run state, trace, evidence rail             |
| Success           | `#2E8F4E`   | `#74D78D`  | completion, valid state                     |
| Warning           | `#B87503`   | `#FFC35A`  | retry, caution, uncertain state             |
| Error/debug       | `#C2413B`   | `#FF8A80`  | validation failure, debug/error state       |

Semantic colors should appear as accents, badges, rails, icons or small fills. They should not turn the entire UI into category-colored blocks.

### Typography

Agorix should use clear sans-serif typography with a small amount of creative character.

| Token                | Recommendation                                       | Use                                          |
| -------------------- | ---------------------------------------------------- | -------------------------------------------- |
| `--agx-font-display` | `Fraunces`, `Epilogue`, or system fallback           | mission titles, hero moments, world headings |
| `--agx-font-body`    | `Inter`, `Atkinson Hyperlegible`, or system fallback | UI and documentation text                    |
| `--agx-font-code`    | `JetBrains Mono`, `SFMono-Regular`, monospace        | generated code and node IDs                  |

Type scale:

| Token            | Size | Line-height | Use                           |
| ---------------- | ---: | ----------: | ----------------------------- |
| `--agx-type-xs`  | 12px |        16px | captions, metadata            |
| `--agx-type-sm`  | 14px |        20px | compact labels                |
| `--agx-type-md`  | 16px |        24px | normal UI body                |
| `--agx-type-lg`  | 20px |        28px | panel heading                 |
| `--agx-type-xl`  | 28px |        36px | mission heading               |
| `--agx-type-2xl` | 40px |        48px | landing or major world moment |

Do not scale type directly with viewport width. Use fixed steps and responsive layout changes instead.

### Spacing and Grid

Base spacing uses a 4px grid with common steps:

| Token            | Value | Use                       |
| ---------------- | ----: | ------------------------- |
| `--agx-space-1`  |   4px | tight internal gaps       |
| `--agx-space-2`  |   8px | compact control gaps      |
| `--agx-space-3`  |  12px | small card padding        |
| `--agx-space-4`  |  16px | default component padding |
| `--agx-space-6`  |  24px | panel gap                 |
| `--agx-space-8`  |  32px | section gap               |
| `--agx-space-12` |  48px | major layout gap          |

Grid rules:

- Tablet portrait: one primary column, world/code remain adjacent in scroll order.
- Tablet landscape: world and code dominate; palettes and helper surfaces are contextual.
- Desktop: use 12-column or named grid areas; avoid more than three persistent vertical regions.
- Studio: respect IDE density, but keep learning rail/evidence states visible.

### Radius and Shape

| Token                | Value | Use                                  |
| -------------------- | ----: | ------------------------------------ |
| `--agx-radius-xs`    |   4px | code highlights, tags                |
| `--agx-radius-sm`    |   8px | cards, buttons, rows                 |
| `--agx-radius-md`    |  12px | panels, proposal cards               |
| `--agx-radius-lg`    |  20px | world containers, major modal sheets |
| `--agx-radius-round` | 999px | small pills and rail markers only    |

Use radius sparingly. Avoid nested rounded cards inside rounded cards.

### Elevation

Elevation should be subtle, not hard-offset.

| Token                | Value                               | Use               |
| -------------------- | ----------------------------------- | ----------------- |
| `--agx-shadow-1`     | `0 1px 2px rgba(20, 30, 26, .08)`   | low panels        |
| `--agx-shadow-2`     | `0 8px 24px rgba(20, 30, 26, .12)`  | elevated palettes |
| `--agx-shadow-3`     | `0 18px 48px rgba(20, 30, 26, .16)` | modal/sheet       |
| `--agx-glow-runtime` | `0 0 0 4px rgba(14,159,154,.16)`    | active execution  |
| `--agx-glow-ai`      | `0 0 0 4px rgba(108,92,231,.14)`    | AI proposal focus |

### Motion

Motion should explain state changes, not decorate constantly.

| Motion                  | Duration | Easing                   | Use                   |
| ----------------------- | -------: | ------------------------ | --------------------- |
| `--agx-motion-fast`     |    120ms | ease-out                 | focus, active press   |
| `--agx-motion-standard` |    220ms | cubic-bezier(.2,.8,.2,1) | panel entrance, hover |
| `--agx-motion-evidence` |    360ms | cubic-bezier(.16,1,.3,1) | trace/rail advance    |

Rules:

- Always support `prefers-reduced-motion: reduce`.
- Runtime playback may move because it communicates program behavior; decorative motion must reduce.
- Avoid bounce/squash for core UI; save playful motion for Worlds.

### Iconography

Use simple line icons with 1.75px to 2px stroke. Icons should clarify commands and states:

- Run: play triangle.
- Step: forward-step.
- Stop: square.
- Reset: rotate/refresh.
- AI proposal: spark plus document/diff cue.
- Runtime evidence: pulse/trace line.
- Debug/error: alert with text label.

Icons never replace labels for unfamiliar learner actions. Use icon + text for primary learning commands.

## Light and Dark Surface Rules

### Light Web/Tablet

- Background: warm off-white or low-chroma neutral.
- Panels: white or warm raised surface with subtle borders.
- Code: dark code surface, because code should feel stable and inspectable.
- World: can carry richer color, but product chrome stays calm.
- AI: use proposal accent as outline/rail; do not make AI the loudest surface.

### Dark Studio

- Background: deep neutral compatible with IDE chrome.
- Panels: dark raised surfaces with clear border contrast.
- Code: can use host editor theme, but Agorix overlays use semantic tokens.
- Runtime/evidence: cyan/teal accents remain visible.
- Proposal/diff: purple AI accent plus explicit accept/reject/modify controls.

## Component Grammar

Each component below should be implementable in Web/Tablet and adaptable to Studio.

### App Shell

Purpose: hold navigation, current mission/project context and global controls.

Guidance:

- Use a calm top band or side rail, not a wall of panels.
- Keep primary creation surface visible immediately.
- Use one persistent language/project/status area; avoid duplicating metadata.
- Touch targets: 44px minimum; Studio compact mode may visually compress but must preserve keyboard access.

States:

- Idle: neutral surface.
- Running: runtime rail active.
- Proposal pending: AI accent marker, not full-shell recolor.
- Error/debug: explicit label + icon.

### Mission Header

Purpose: state learner goal, progress and next meaningful action.

Guidance:

- Use concise heading and learner-facing goal copy.
- Include progress rail with Build -> Run -> Reflect, using text and markers.
- Must support Spanish expansion without truncating goal text.
- Avoid celebratory full-screen takeover; completion should preserve editor context.

### World Surface

Purpose: provide the visible result of the program and world motivation.

Guidance:

- World visuals can be expressive, but framed by stable product chrome.
- Runtime state overlays use execution tokens, not decorative rainbow effects.
- Keep canvas/stage aspect ratio stable across viewport changes.
- Reduced motion must preserve functional runtime evidence.

### Code Surface

Purpose: keep generated textual code continuously visible.

Guidance:

- Use code font at 14px minimum.
- Provide high contrast in light and dark contexts.
- Highlight current node with a non-color-only marker when possible, such as side bar, underline or label.
- Code surface is read-only in POC; do not style it like an editable text box unless editing exists.

### Action Palette

Purpose: contextual commands and block/action insertion.

Guidance:

- Palette is contextual and compact; it should not permanently dominate the page.
- Use icon + text buttons for learner actions.
- Group actions by semantic category, not rainbow decoration.
- Long Spanish labels wrap to two lines before shrinking text.

### Visual Instruction / Card

Purpose: teach a small concept, prompt prediction or give mission instruction.

Guidance:

- Use stable 8-12px radius, subtle border and one semantic accent.
- Keep cards as individual repeated items, not nested page sections.
- Include clear heading, one action or prompt, and optional evidence link.

### ProgramProposal Card

Purpose: show an AI-originated change before learner decision.

Guidance:

- Distinguish proposal from accepted program with AI accent border/rail.
- Required content: what changes, why it may help, affected blocks/code, confidence/uncertainty copy, accept/modify/reject actions.
- Must say or imply that proposal may be wrong.
- Never use success colors for unaccepted proposals.

### Diff Proposal

Purpose: compare proposed change against accepted program.

Guidance:

- Use side-by-side where width allows; stacked before/after on tablet portrait.
- Added/removed/changed regions need text/icon labels, not color only.
- Keep canonical node IDs or block references available for developer/Studio surfaces.

### Learning Companion Prompt

Purpose: provide scaffolded help without taking product authority.

Guidance:

- Companion appears contextually near evidence/code, not as a permanent dominant chat wall.
- Use calm AI accent and clear provenance/state labels: suggestion, question, explanation, challenge.
- Include compact controls: ask, explain, challenge, show evidence.
- Never cover code surface in the normal flow.

### Execution State Bubble

Purpose: communicate run/step/stop/reset and completion/retry states.

Guidance:

- Use icon + label + semantic color accent.
- Runtime/execution token for active run; success/warning/error tokens for outcomes.
- Should fit in header and near world surface.
- Must be readable in Spanish.

### Execution Inspector Row

Purpose: show child-readable runtime evidence such as step, node, sprite position or predicate.

Guidance:

- Dense but readable row; use mono for node/code references.
- Include state labels such as Step, Block, Code, Result.
- Use rail marker to connect to highlighted code/block.
- Studio variant may be denser and table-like.

### Progress Indicator

Purpose: show learning loop position.

Guidance:

- Prefer rail/stepper over badges alone.
- Build, Run, Reflect states use labels and markers.
- Progress does not imply grading; it shows journey position.

### Touch Controls

Purpose: tablet-first run and manipulation controls.

Guidance:

- Minimum target 44x44px; recommended primary controls 48x48px or larger.
- Provide generous spacing between destructive and primary actions.
- Do not depend on hover, right-click or tiny drag handles.
- Use active/pressed state and focus state.

## Accessibility Rules

- Body text and labels target WCAG AA contrast of 4.5:1.
- Large text and icons target at least 3:1.
- Focus indicator must be visible and at least 3:1 against adjacent colors.
- State must never be color-only; use label, icon, rail position or shape.
- Reduced motion disables decorative motion and shortens transitions.
- Touch targets are at least 44x44px.
- Code text is at least 14px and high contrast.
- Avoid essential hover-only disclosure.

## Multilingual Text Expansion

English and Spanish are supported product locales. Component rules:

- Allow labels to wrap before reducing font size.
- Primary buttons should support two-line labels.
- Mission goal and companion copy should have flexible width, not fixed-height clipping.
- Avoid icon-only controls for learner-critical actions.
- Do not encode locale into canonical program visuals; locale is presentation metadata.

## Examples

These examples are implementation sketches, not final UI requirements.

### Tablet Landscape

```text
+--------------------------------------------------------------------------------+
| Mission: Reach the Goal                          [Language] [Run] [Step] [Stop]|
| Build ━━━━━ Run ───── Reflect                                                    |
+-----------------------------------------+--------------------------------------+
| WORLD SURFACE                           | CODE SURFACE                         |
| sprite, goal, runtime rail              | highlighted generated code           |
|                                         |                                      |
+-----------------------------------------+--------------------------------------+
| Action Palette: Move | Turn | Repeat    | Learning Companion: suggestion state  |
+-----------------------------------------+--------------------------------------+
```

Design notes:

- World and code dominate equally.
- Companion is contextual and cannot cover code.
- Run/Step/Stop remain reachable with 48px targets.

### Tablet Portrait

```text
+----------------------------------------+
| Mission header + run controls          |
+----------------------------------------+
| WORLD SURFACE                          |
| runtime evidence bubble                |
+----------------------------------------+
| CODE SURFACE                           |
| highlighted node                       |
+----------------------------------------+
| Action Palette / Companion prompt      |
+----------------------------------------+
```

Design notes:

- Code appears immediately after world, never hidden in a tab.
- Palette and companion are collapsible/contextual below primary surfaces.
- Spanish mission text wraps in the header.

### Agorix Studio Dark Surface

```text
+----------------+--------------------------------------+----------------------+
| Mission tree   | Code editor / diff proposal          | World preview        |
| Concepts       | AI proposal rail + accept controls   | Runtime evidence     |
| Progress       |                                      | Inspector rows       |
+----------------+--------------------------------------+----------------------+
```

Design notes:

- Studio uses dark tokens and IDE density.
- Proposal semantics match Web/Tablet even when represented as diffs.
- Runtime evidence remains visually above AI claims.

## Implementation Checklist

- [ ] Uses semantic tokens rather than raw values in new UI work.
- [ ] Uses light/dark token mapping for relevant surface.
- [ ] Uses semantic color only as an accent or state cue.
- [ ] Supports EN/ES text expansion.
- [ ] Provides visible focus and non-color-only state.
- [ ] Preserves code visibility in normal learner flow.
- [ ] Distinguishes AI proposal from accepted program and runtime evidence.
- [ ] Avoids private design context dependency.

## Acceptance Trace

| #117 acceptance criterion                          | Design system coverage                                     |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Visual grammar distinguishable from Scratch        | Visual Position, What Agorix Is Not, Design Principles     |
| Reusable tokens across Web and Studio              | Token Model, Light and Dark Surface Rules                  |
| Coherent light and dark variants                   | Core Palette, Light and Dark Surface Rules, Studio example |
| Block/category color semantic rather than dominant | Semantic Color Roles, Component Grammar                    |
| Components support EN/ES expansion                 | Multilingual Text Expansion and component guidance         |
| Touch targets documented                           | Touch Controls and Accessibility Rules                     |
| Implementable without private design context       | Purpose, Token Model, Component Grammar, Examples          |
