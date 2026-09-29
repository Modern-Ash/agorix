# Logical Design

## Shell hierarchy

The web app keeps one React entry component but changes its hierarchy:

1. `header.topbar`: product title, locale and touch run controls.
2. `section.mission-strip`: compact mission/progress/status chrome.
3. `div.learning-layout`: tablet-first grid with named regions.
4. `StageView`: World surface.
5. `section.code-panel`: Code surface.
6. `section.program-panel`: accepted block program editor.
7. `section.action-palette`: contextual block insertion.
8. `aside.companion-panel`: contextual Learning Companion.

## Responsive contract

- Landscape tablet and desktop use a two-column primary grid: World and Code dominate the first row.
- Portrait tablet uses a one-column flow: World, Code, program builder, action palette, companion.
- The action palette is never a permanent left rail.
- The companion is never a permanent full-height chat panel.

## Interaction design

- Run starts animated runtime playback.
- Step advances runtime evidence manually and keeps Code visible.
- Stop cancels playback.
- Reset clears the editor and evidence.
- Block insertion remains button-based for touch and keyboard.
