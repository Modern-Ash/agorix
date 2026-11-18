/** Workbench styles. Theme variables only, so the surface follows the IDE theme. */
export const WORKBENCH_CSS = `
:root { color-scheme: light dark; }
body { margin: 0; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
.workbench { display: grid; grid-template-columns: minmax(160px, 220px) 1fr minmax(220px, 300px); gap: 12px; padding: 12px; }
.workbench[data-density="compact"] { grid-template-columns: minmax(140px, 180px) 1fr minmax(200px, 260px); gap: 8px; padding: 8px; font-size: 0.95em; }
@media (max-width: 900px) { .workbench { grid-template-columns: 1fr; } }
.palette { display: flex; flex-direction: column; gap: 6px; }
.palette-search { display: grid; gap: 3px; color: var(--vscode-descriptionForeground); font-size: 0.85em; }
.palette-search input { min-height: 28px; box-sizing: border-box; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
.palette-section { display: grid; gap: 4px; }
.palette-section h2 { margin: 8px 0 2px; font-size: 0.78em; letter-spacing: 0; text-transform: uppercase; color: var(--vscode-descriptionForeground); }
.palette button, .block button, .zone { min-height: 32px; padding: 4px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; text-align: left; }
.palette button:disabled { cursor: not-allowed; opacity: 0.65; color: var(--vscode-disabledForeground); }
.workbench[data-density="compact"] .palette { gap: 4px; }
.workbench[data-density="compact"] .palette button, .workbench[data-density="compact"] .block button, .workbench[data-density="compact"] .zone { padding: 3px 8px; }
.canvas { display: flex; flex-direction: column; }
.execution-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; padding: 6px 8px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.execution-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.execution-actions button { min-height: 32px; padding: 4px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; }
.execution-actions button:first-child { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.execution-actions button:disabled { cursor: not-allowed; opacity: 0.55; color: var(--vscode-disabledForeground); }
.execution-readout { color: var(--vscode-descriptionForeground); font-size: 0.9em; white-space: nowrap; }
.workbench[data-density="compact"] .execution-toolbar { margin-bottom: 6px; padding: 4px 6px; }
.workbench[data-density="compact"] .execution-actions button { padding: 3px 8px; }
@media (max-width: 700px) { .execution-toolbar { align-items: flex-start; flex-direction: column; } .execution-readout { white-space: normal; } }
.stage-panel { margin-bottom: 10px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.stage-panel-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-size: 0.9em; }
.stage-panel-header strong { color: var(--vscode-foreground); }
.stage-panel-header div { display: grid; justify-items: end; gap: 2px; min-width: 0; }
.stage-scene-actions { display: flex; align-items: stretch; border-bottom: 1px solid var(--vscode-panel-border); }
.stage-backdrop-picker { position: relative; z-index: 5; flex: 1; min-width: 0; }
.stage-add-character { flex: 0 0 auto; margin: 5px; padding: 4px 8px; border: 1px solid var(--vscode-focusBorder); border-radius: 5px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); cursor: pointer; }
.stage-add-character:disabled { opacity: 0.55; cursor: not-allowed; }
.stage-add-character:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.stage-backdrop-picker summary { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 4px 8px; cursor: pointer; list-style: none; }
.stage-backdrop-picker summary::-webkit-details-marker { display: none; }
.stage-backdrop-picker summary::after { content: "⌄"; margin-left: auto; color: var(--vscode-descriptionForeground); }
.stage-backdrop-picker[open] summary::after { content: "⌃"; }
.stage-backdrop-picker summary:focus-visible, .stage-backdrop-options button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.stage-backdrop-picker summary span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stage-backdrop-picker summary strong { color: var(--vscode-foreground); }
.stage-backdrop-preview { flex: 0 0 54px; width: 54px; height: 36px; border-radius: 4px; object-fit: cover; background: var(--vscode-editor-background); }
.stage-backdrop-options { position: absolute; top: 100%; right: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; width: min(100%, 330px); max-height: 340px; overflow: auto; padding: 8px; box-sizing: border-box; border: 1px solid var(--vscode-focusBorder); border-radius: 0 0 6px 6px; background: var(--vscode-editorWidget-background); box-shadow: 0 5px 16px color-mix(in srgb, black, transparent 55%); }
.stage-backdrop-options button { display: grid; justify-items: center; gap: 4px; min-width: 0; padding: 5px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; color: var(--vscode-foreground); background: var(--vscode-button-secondaryBackground); cursor: pointer; }
.stage-backdrop-options button[aria-pressed="true"] { border-color: var(--vscode-focusBorder); background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.stage-backdrop-options button:disabled { opacity: 0.55; cursor: not-allowed; }
.stage-backdrop-options img, .stage-backdrop-thumb { width: 100%; height: 60px; border-radius: 3px; object-fit: cover; background: var(--vscode-editor-background); }
.stage-backdrop-options button span:last-child { overflow: hidden; max-width: 100%; text-overflow: ellipsis; white-space: nowrap; }
@media (min-width: 701px) and (max-width: 1100px) { .stage-backdrop-options { grid-template-columns: 1fr; width: min(52%, 170px); } }
.stage-active-route { overflow: hidden; max-width: 320px; font-family: var(--vscode-editor-font-family); text-overflow: ellipsis; white-space: nowrap; }
.stage-viewport { position: relative; min-height: 180px; overflow: hidden; background: var(--vscode-editor-background); }
.stage-viewport > p { margin: 0; padding: 18px; color: var(--vscode-descriptionForeground); }
.stage-backdrop { position: absolute; inset: 0; background: var(--vscode-editor-background); }
.stage-backdrop[data-backdrop-id="asset:space.trailhead"] { background: linear-gradient(135deg, color-mix(in srgb, var(--vscode-charts-blue), transparent 82%), var(--vscode-editor-background)); }
.stage-backdrop[data-backdrop-id="asset:space.nebula"] { background: radial-gradient(circle at 72% 28%, color-mix(in srgb, var(--vscode-charts-purple), transparent 56%), transparent 32%), linear-gradient(135deg, color-mix(in srgb, var(--vscode-charts-purple), transparent 72%), var(--vscode-editor-background)); }
.stage-grid { position: absolute; inset: 0; background-image: linear-gradient(var(--vscode-editorWidget-border, var(--vscode-panel-border)) 1px, transparent 1px), linear-gradient(90deg, var(--vscode-editorWidget-border, var(--vscode-panel-border)) 1px, transparent 1px); background-size: 32px 32px; opacity: 0.38; }
.stage-art-backdrop { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.stage-art-backdrop + .stage-grid { opacity: 0.12; }
.stage-art-sprite { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.stage-sprite:has(.stage-art-sprite) { border: 0; border-radius: 0; background: transparent; }
.stage-goal, .stage-sprite { position: absolute; width: 22px; height: 22px; box-sizing: border-box; transition: left 180ms ease, bottom 180ms ease, transform 180ms ease; }
.stage-goal { transform: translate(-50%, 50%); border: 2px solid var(--vscode-testing-iconPassed); border-radius: 50%; background: color-mix(in srgb, var(--vscode-testing-iconPassed), transparent 78%); }
.stage-goal.reached { box-shadow: 0 0 0 4px color-mix(in srgb, var(--vscode-testing-iconPassed), transparent 72%); }
.stage-sprite { border: 2px solid var(--vscode-charts-orange); border-radius: 45% 45% 45% 8px; background: color-mix(in srgb, var(--vscode-charts-orange), transparent 64%); }
.stage-sprite[draggable="true"] { cursor: grab; }
.stage-sprite[draggable="true"]:active { cursor: grabbing; }
.stage-sprite[draggable="true"] { touch-action: none; }
.stage-sprite[data-dragging="true"] { transition: none; cursor: grabbing; z-index: 2; }
.stage-sprite { padding: 0; color: var(--vscode-foreground); }
.stage-sprite:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 3px; }
.expression-socket { min-height: 28px; padding: 3px 10px; border: 1px solid var(--vscode-focusBorder); border-radius: 15px; background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); cursor: pointer; }
.expression-socket[data-tone="sensing"] { border-color: var(--vscode-charts-blue); }
.expression-socket[data-tone="operators"] { border-color: var(--vscode-charts-green); }
.expression-socket:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.comparison-fields { display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.comparison-fields .block-field { min-width: 74px; }
.variable-creator, .list-creator { display: grid; gap: 6px; margin: 8px 0 14px; padding: 8px; border: 1px solid var(--vscode-panel-border); }
.variable-creator label, .list-creator label { display: grid; gap: 3px; }
.variable-creator input, .list-creator input { min-width: 0; }
.variable-creator ul, .list-creator ul { margin: 0; padding-left: 18px; }
.list-initial-items { display: grid; gap: 6px; }
.list-initial-items summary { cursor: pointer; }
.list-initial-items ol { display: grid; gap: 6px; padding-left: 18px; }
.list-initial-items li { display: flex; align-items: end; gap: 4px; flex-wrap: wrap; }
.list-initial-items li input { width: 72px; }
.list-management-actions { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0; }
.list-management-actions label { flex: 1 1 100%; }
.list-management-actions input { width: 100%; box-sizing: border-box; }
.variable-management summary { cursor: pointer; }
.variable-management-actions { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0; }
.variable-management-actions label { flex: 1 1 100%; }
.variable-management-actions input { width: 100%; box-sizing: border-box; }
.variable-management-actions .watcher-toggle, .list-management-actions .watcher-toggle { display: flex; align-items: center; flex: 1 1 100%; gap: 6px; }
.variable-management-actions .watcher-toggle input, .list-management-actions .watcher-toggle input { width: auto; min-width: auto; }
.scene-create-actor { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.scene-create-actor input { flex: 1 1 120px; min-width: 0; }
.scene-delete-actor { width: 100%; margin-top: 8px; border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-panel-border)) !important; }
.scene-delete-actor:disabled { opacity: 0.5; cursor: not-allowed; }
.block-asset-field { display: inline-flex; align-items: center; gap: 5px; }
.block-asset-field img { width: 28px; height: 28px; object-fit: contain; border: 1px solid var(--vscode-panel-border); }
.stage-sprite[data-costume-id="asset:costume.default"] { border-color: var(--vscode-charts-blue); background: color-mix(in srgb, var(--vscode-charts-blue), transparent 58%); }
.stage-sprite[data-costume-id="asset:costume.spark"] { border-color: var(--vscode-charts-green); background: color-mix(in srgb, var(--vscode-charts-green), transparent 54%); }
.stage-sprite.selected { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.stage-actor-tools { position: absolute; z-index: 3; display: flex; flex-wrap: wrap; justify-content: center; width: 180px; gap: 2px; padding: 3px; transform: translate(-50%, 0); border: 1px solid var(--vscode-focusBorder); border-radius: 6px; background: var(--vscode-editorWidget-background); box-shadow: 0 2px 8px color-mix(in srgb, black, transparent 55%); }
.stage-transform-slider { display: grid; width: 100%; gap: 1px; color: var(--vscode-descriptionForeground); font-size: 0.72em; }
.stage-transform-slider input { width: 100%; margin: 0; accent-color: var(--vscode-focusBorder); }
.stage-actor-tools button { min-width: 26px; min-height: 26px; padding: 2px 5px; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); border-radius: 4px; background: var(--vscode-button-secondaryBackground); cursor: pointer; }
.stage-actor-tools button:hover, .stage-actor-tools button:focus-visible { border-color: var(--vscode-focusBorder); outline: 1px solid var(--vscode-focusBorder); }
.stage-bubble { position: absolute; left: calc(100% + 6px); bottom: calc(100% + 4px); max-width: 140px; padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); clip-path: none; font-size: 0.78em; white-space: nowrap; }
.stage-bubble-think { border-style: dashed; }
.stage-watchers { position: absolute; top: 8px; left: 8px; z-index: 2; display: grid; gap: 4px; min-width: 96px; max-width: min(45%, 190px); max-height: 55%; overflow: auto; }
.stage-watcher { display: flex; justify-content: space-between; gap: 8px; padding: 3px 6px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); font-family: var(--vscode-editor-font-family); font-size: 0.82em; }
.stage-watcher span { color: var(--vscode-descriptionForeground); }
.stage-watcher strong { font-weight: 700; font-variant-numeric: tabular-nums; }
.stage-list-watcher { padding: 4px 6px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); font-family: var(--vscode-editor-font-family); font-size: 0.8em; }
.stage-list-watcher strong { display: block; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stage-list-watcher ol { margin: 0; padding-left: 24px; max-height: 90px; overflow: auto; font-variant-numeric: tabular-nums; }
.stage-list-watcher li { padding: 1px 0; border-top: 1px solid var(--vscode-panel-border); }
.stage-sounds { position: absolute; right: 8px; bottom: 8px; left: 8px; z-index: 2; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.stage-sounds span, .stage-sounds strong { display: inline-flex; align-items: center; min-height: 22px; padding: 2px 6px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); font-family: var(--vscode-editor-font-family); font-size: 0.78em; }
.stage-sounds span { color: var(--vscode-descriptionForeground); }
.stage-viewport[data-running="true"] .stage-sprite { box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-charts-blue), transparent 68%); }
.stage-readout { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; border-top: 1px solid var(--vscode-panel-border); }
.stage-readout div { display: flex; justify-content: space-between; gap: 8px; padding: 5px 8px; border-right: 1px solid var(--vscode-panel-border); font-family: var(--vscode-editor-font-family); font-size: 0.85em; }
.stage-readout div:last-child { border-right: 0; }
.stage-readout dt { color: var(--vscode-descriptionForeground); }
.stage-readout dd { margin: 0; }
.workbench[data-density="compact"] .stage-panel { margin-bottom: 6px; }
.workbench[data-density="compact"] .stage-viewport { min-height: 136px; }
.mission-spec { display: grid; gap: 8px; margin-bottom: 10px; padding: 8px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.mission-spec header { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--vscode-descriptionForeground); }
.mission-spec header strong { color: var(--vscode-foreground); }
.mission-spec code { overflow: hidden; max-width: 14em; font-family: var(--vscode-editor-font-family); font-size: 0.82em; text-overflow: ellipsis; white-space: nowrap; }
.mission-spec label { display: grid; gap: 3px; color: var(--vscode-descriptionForeground); font-size: 0.9em; }
.mission-spec input, .mission-spec select { min-height: 28px; box-sizing: border-box; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
.mission-spec button { justify-self: start; min-height: 30px; padding: 4px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; }
.mission-spec-grid { display: grid; grid-template-columns: minmax(120px, 0.4fr) minmax(0, 1fr); gap: 6px; }
.workbench[data-density="compact"] .mission-spec { margin-bottom: 6px; padding: 6px; }
@media (max-width: 700px) { .mission-spec-grid { grid-template-columns: 1fr; } }
.event-trace { display: grid; gap: 6px; margin-bottom: 10px; padding: 8px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.event-trace header { display: flex; justify-content: space-between; gap: 8px; color: var(--vscode-descriptionForeground); }
.event-trace header strong { color: var(--vscode-foreground); }
.event-trace p { margin: 0; color: var(--vscode-descriptionForeground); }
.event-trace-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.event-trace-filters label { display: grid; gap: 3px; color: var(--vscode-descriptionForeground); font-size: 0.84em; }
.event-trace-filters select { min-height: 26px; box-sizing: border-box; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
.event-trace ol { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.event-trace li { display: grid; grid-template-columns: auto minmax(84px, 1fr) auto auto; gap: 6px; align-items: center; padding: 5px 6px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editor-background); }
.event-trace small { grid-column: 2 / -1; color: var(--vscode-descriptionForeground); }
.event-trace code, .event-step { font-family: var(--vscode-editor-font-family); font-size: 0.82em; }
.event-step { color: var(--vscode-descriptionForeground); }
.workbench[data-density="compact"] .event-trace { margin-bottom: 6px; padding: 6px; }
.workbench[data-density="compact"] .event-trace li { grid-template-columns: auto minmax(72px, 1fr) auto; }
.workbench[data-density="compact"] .event-trace li code:last-of-type { grid-column: 2 / -1; }
.actor-tree { display: grid; gap: 6px; margin-bottom: 10px; padding: 8px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.actor-tree header { display: flex; justify-content: space-between; gap: 8px; color: var(--vscode-descriptionForeground); }
.actor-tree header strong { color: var(--vscode-foreground); }
.actor-tree-list { display: grid; gap: 4px; }
.actor-tree button { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; min-height: 34px; padding: 5px 7px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); text-align: left; cursor: pointer; }
.actor-tree button.selected { border-color: var(--vscode-focusBorder); background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.actor-tree button span { min-width: 0; }
.actor-tree button small { display: block; overflow: hidden; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); text-overflow: ellipsis; white-space: nowrap; }
.actor-inspector { display: grid; gap: 8px; margin-bottom: 10px; padding: 8px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.actor-inspector header { display: flex; justify-content: space-between; gap: 8px; color: var(--vscode-descriptionForeground); }
.actor-inspector header strong { color: var(--vscode-foreground); }
.actor-costume-picker { min-width: 0; }
.actor-costume-picker summary { display: flex; align-items: center; gap: 9px; min-height: 48px; padding: 5px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; cursor: pointer; list-style: none; }
.actor-costume-picker summary::-webkit-details-marker { display: none; }
.actor-costume-picker summary::after { content: "⌄"; margin-left: auto; color: var(--vscode-descriptionForeground); }
.actor-costume-picker[open] summary::after { content: "⌃"; }
.actor-costume-picker summary:focus-visible, .actor-costume-grid button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.actor-costume-picker summary small { display: block; color: var(--vscode-descriptionForeground); }
.actor-costume-picker summary strong { display: block; color: var(--vscode-foreground); }
.actor-costume-preview { display: grid; place-items: center; flex: 0 0 42px; height: 42px; border-radius: 5px; background: var(--vscode-editor-background); }
.actor-costume-preview img, .actor-costume-grid img { width: 38px; height: 38px; object-fit: contain; }
.actor-costume-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; max-height: 230px; overflow-y: auto; padding: 7px 2px; }
.actor-costume-grid button { display: grid; justify-items: center; gap: 3px; min-width: 0; padding: 5px 2px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; color: var(--vscode-foreground); background: var(--vscode-button-secondaryBackground); cursor: pointer; }
.actor-costume-grid button[aria-pressed="true"] { border-color: var(--vscode-focusBorder); background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.actor-costume-grid button span { overflow: hidden; max-width: 100%; text-overflow: ellipsis; white-space: nowrap; }
.studio-scene-editor .actor-costume-picker summary { min-height: 62px; border-color: color-mix(in srgb, var(--vscode-focusBorder), var(--vscode-panel-border) 55%); background: color-mix(in srgb, var(--vscode-focusBorder), var(--vscode-editorWidget-background) 94%); }
.studio-scene-editor .actor-costume-preview { flex-basis: 54px; height: 54px; }
.studio-scene-editor .actor-costume-preview img { width: 50px; height: 50px; }
.actor-properties { min-width: 0; border-top: 1px solid var(--vscode-panel-border); }
.actor-properties summary { padding: 8px 2px; color: var(--vscode-descriptionForeground); cursor: pointer; }
.actor-properties summary:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.actor-properties-fields { display: grid; gap: 8px; padding-top: 4px; }
@media (min-width: 701px) and (max-width: 1100px) { .actor-costume-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.actor-inspector label { display: grid; gap: 3px; color: var(--vscode-descriptionForeground); font-size: 0.9em; }
.actor-inspector input, .actor-inspector select { min-height: 26px; box-sizing: border-box; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
.actor-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.actor-visible { display: flex !important; grid-template-columns: none !important; align-items: center; gap: 8px !important; }
.actor-visible input { min-height: auto; }
.actor-ref { margin: 0; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); font-size: 0.82em; }
.workbench[data-density="compact"] .actor-inspector { margin-bottom: 6px; padding: 6px; }
.asset-panel { display: grid; gap: 8px; margin-bottom: 10px; padding: 8px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.asset-panel header { display: flex; justify-content: space-between; color: var(--vscode-descriptionForeground); }
.asset-panel header strong { color: var(--vscode-foreground); }
.asset-filters { display: grid; grid-template-columns: minmax(0, 1fr) minmax(96px, 0.45fr); gap: 6px; }
.asset-filters label { display: grid; gap: 3px; color: var(--vscode-descriptionForeground); font-size: 0.84em; }
.asset-filters input, .asset-filters select { min-height: 26px; box-sizing: border-box; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
.asset-list { display: grid; gap: 6px; max-height: 220px; overflow: auto; }
.asset-list > p { margin: 0; color: var(--vscode-descriptionForeground); }
.asset-row { display: grid; grid-template-columns: 34px 1fr; gap: 8px; padding: 6px; border: 1px solid var(--vscode-panel-border); }
.asset-row h3, .asset-row p { margin: 0; }
.asset-row h3 { font-size: 0.95em; }
.asset-row p { color: var(--vscode-descriptionForeground); font-size: 0.82em; }
.asset-preview { display: grid; place-items: center; min-height: 34px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editor-background); font-family: var(--vscode-editor-font-family); font-size: 0.75em; }
.asset-preview img { display: block; width: 100%; max-height: 48px; object-fit: contain; }
.workbench[data-density="compact"] .asset-panel { margin-bottom: 6px; padding: 6px; }
.validation-panel { display: grid; gap: 8px; margin-bottom: 10px; padding: 8px; border: 1px solid var(--vscode-editorWarning-foreground); background: var(--vscode-editorWidget-background); }
.validation-panel header { display: flex; justify-content: space-between; gap: 8px; color: var(--vscode-descriptionForeground); }
.validation-panel header strong { color: var(--vscode-foreground); }
.validation-panel ol { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.validation-panel li { display: grid; gap: 3px; padding: 6px; border-left: 3px solid var(--vscode-editorWarning-foreground); background: var(--vscode-editor-background); }
.validation-panel li[data-severity="error"] { border-left-color: var(--vscode-errorForeground); }
.validation-panel p { margin: 0; color: var(--vscode-foreground); }
.validation-panel code { overflow: hidden; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); font-size: 0.82em; text-overflow: ellipsis; white-space: nowrap; }
.workbench[data-density="compact"] .validation-panel { margin-bottom: 6px; padding: 6px; }
.script-heading { display: flex; gap: 5px; align-items: center; margin: 12px 0 4px; }
.script-title { display: block; flex: 1; min-width: 0; margin: 0; padding: 5px 8px; text-align: left; font-weight: 600; border: 1px solid var(--vscode-panel-border); border-radius: 5px; color: var(--vscode-foreground); background: var(--vscode-button-secondaryBackground); cursor: pointer; }
.script-delete { flex: 0 0 auto; min-height: 30px; padding: 3px 7px; font-size: 0.78em; color: var(--vscode-errorForeground); border: 1px solid var(--vscode-panel-border); border-radius: 5px; background: var(--vscode-editorWidget-background); cursor: pointer; }
.script-delete:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.script-title[aria-pressed="true"] { border-color: var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 85%); }
.script-title:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.workbench[data-density="compact"] .script-title { margin: 8px 0 2px; }
.slot { height: 8px; border-radius: 4px; transition: height 120ms ease; }
.slot.drag-over { height: 24px; background: var(--vscode-list-hoverBackground); outline: 1px dashed var(--vscode-focusBorder); }
.branch-label { margin-top: 4px; padding: 4px 10px; border-left: 3px solid var(--vscode-charts-orange, var(--vscode-focusBorder)); color: var(--vscode-descriptionForeground); font-size: 0.85em; font-weight: 600; }
.block { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-editorWidget-background); }
.workbench[data-density="compact"] .block { gap: 6px; padding: 4px 8px; }
.block:focus-visible, .palette button:focus-visible, .block button:focus-visible, .zone:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
.block .label { flex: 1; }
.depth-0 { margin-left: 0; } .depth-1 { margin-left: 20px; } .depth-2 { margin-left: 40px; } .depth-3 { margin-left: 60px; } .depth-4 { margin-left: 80px; }
.zones { display: flex; gap: 8px; margin-top: 16px; }
.zone { flex: 1; text-align: center; border-style: dashed; }
.zone.drag-over { background: var(--vscode-list-hoverBackground); }
.status { margin-top: 12px; min-height: 1.4em; color: var(--vscode-descriptionForeground); }
.agent { display: flex; flex-direction: column; gap: 10px; }
.agent button, .agent input, .agent select { min-height: 32px; }
.agent input, .agent select, .agent textarea { max-width: 100%; box-sizing: border-box; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); font: inherit; }
.agent button { border: 1px solid var(--vscode-panel-border); border-radius: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; }
.agent button:focus-visible, .agent input:focus-visible, .agent select:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
.ribbon { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 0.85em; }
.ribbon li { padding: 2px 8px; border: 1px solid var(--vscode-panel-border); border-radius: 10px; }
.ribbon li.done { opacity: 0.6; }
.ribbon li[aria-current="step"] { font-weight: 600; outline: 2px solid var(--vscode-focusBorder); }
.suggestion { padding: 8px; border: 1px dashed var(--vscode-editorInfo-foreground); border-radius: 6px; }
.ghost-badge { margin: 0 0 4px; font-size: 0.8em; color: var(--vscode-editorInfo-foreground); }
.block.ghost-added, .block.ghost-changed, .block.ghost-removed { border-style: dashed; border-color: var(--vscode-editorInfo-foreground); }
.block.ghost-skipped { opacity: 0.55; }
.hint-badge { margin-left: 8px; font-size: 0.85em; color: var(--vscode-editorInfo-foreground); }
.hint-badge.ambient, .ambient-hint { color: var(--vscode-editorWarning-foreground); }
.ambient-hint { margin: 6px 0; padding: 6px 10px; border-left: 3px solid var(--vscode-editorWarning-foreground); background: var(--vscode-editorWidget-background); }
.alternatives { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.alt { flex: 1 1 140px; padding: 8px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; }
.alt.current { border-color: var(--vscode-focusBorder); }
.operations { margin: 8px 0; border: 1px solid var(--vscode-panel-border); border-radius: 6px; }
.operation input[type="number"] { width: 5em; }
.block.sel { outline: 2px solid var(--vscode-focusBorder); }
.block.exec { border-left: 4px solid var(--vscode-charts-blue); }
.block.fail { border-left: 4px solid var(--vscode-errorForeground); }
.sync-badge { margin-left: 8px; font-weight: 600; }
.fail-badge { color: var(--vscode-errorForeground); }
.block.ghost-removed .label { text-decoration: line-through; }
/* Editor-first Studio shell: navigation, central editor, contextual Ori dock. */
.workbench { --tools-width: clamp(178px, 19vw, 224px); --ori-width: clamp(250px, 24vw, 320px); grid-template-columns: var(--tools-width) minmax(0, 1fr) var(--ori-width); gap: 0; align-items: start; min-height: 100vh; padding: 0; box-sizing: border-box; background: var(--vscode-editor-background); }
.workbench[data-density="compact"] { grid-template-columns: var(--tools-width) minmax(0, 1fr) var(--ori-width); gap: 0; padding: 0; }
.workbench[data-tools-open="false"] { grid-template-columns: minmax(0, 1fr) var(--ori-width); }
.workbench[data-ori-open="false"] { grid-template-columns: var(--tools-width) minmax(0, 1fr); }
.workbench[data-tools-open="false"][data-ori-open="false"] { grid-template-columns: minmax(0, 1fr); }
.workbench[data-tools-open="false"] .studio-main { grid-column: 1; }
.workbench[data-ori-open="false"] .studio-ori-dock, .workbench[data-tools-open="false"] .studio-tools { display: none; }
.workbench[data-tools-open="false"] .studio-ori-dock { grid-column: 2; }
.workbench[data-tools-open="false"][data-ori-open="false"] .studio-main { grid-column: 1; }
.workbench [hidden] { display: none !important; }
.studio-banner { grid-column: 1 / -1; display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 14px; padding: 10px 14px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.studio-banner span { color: var(--vscode-descriptionForeground); font: 600 0.72em var(--vscode-editor-font-family); letter-spacing: 0.12em; }
.studio-banner h1 { margin: 0; font-size: 1.15em; line-height: 1.2; letter-spacing: -0.02em; }
.studio-banner p { margin: 0; max-width: 70ch; color: var(--vscode-descriptionForeground); }
.studio-brand { display: flex; align-items: baseline; gap: 10px; }
.studio-shell-actions { display: flex; gap: 5px; margin-left: auto; }
.studio-shell-actions button, .studio-editor-tabs button { min-height: 32px; padding: 4px 10px; border: 1px solid transparent; background: transparent; color: var(--vscode-foreground); cursor: pointer; }
.studio-shell-actions button:hover, .studio-editor-tabs button:hover { background: var(--vscode-list-hoverBackground); }
.studio-shell-actions button:focus-visible, .studio-editor-tabs button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: -2px; }
.studio-shell-actions button[aria-pressed="true"] { color: var(--vscode-focusBorder); }
.studio-tools, .studio-program, .studio-evidence, .studio-details, .agent { min-width: 0; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.studio-tools { grid-column: 1; position: sticky; top: 0; max-height: calc(100vh - 58px); overflow: auto; padding: 12px; border-top: 0; border-left: 0; }
.studio-tools h2 { margin: 0 0 5px; font-size: 0.8em; letter-spacing: 0.06em; text-transform: uppercase; }
.library-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 12px; }
.library-tabs button { min-height: 32px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; }
.library-tabs button[aria-pressed="true"] { border-color: var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 78%); color: var(--vscode-foreground); font-weight: 700; }
.library-tabs button:focus-visible, .scene-library button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.scene-library { display: grid; gap: 14px; }
.scene-library > section[hidden] { display: none; }
.scene-section-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
.scene-section-tabs button { display: flex; justify-content: space-between; align-items: center; gap: 4px; min-width: 0; min-height: 34px; padding: 5px 8px; text-align: left; font-size: 0.8em; }
.scene-section-tabs button[aria-pressed="true"] { color: var(--vscode-foreground); border-color: var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 84%); }
.scene-section-tabs small { color: var(--vscode-descriptionForeground); font-size: 0.85em; }
.scene-section-tabs button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.scene-create-shortcut { width: 100%; margin-top: 8px; border-style: dashed !important; }
.scene-create-script { display: grid; gap: 5px; margin-top: 8px; }
.scene-create-script label { display: grid; gap: 3px; }
.scene-create-image { display: grid; gap: 7px; }
.scene-create-image canvas { order: 1; width: 100%; max-width: 240px; height: auto; border: 1px solid var(--vscode-panel-border); border-radius: 5px; background: #fff; touch-action: none; cursor: crosshair; }
.scene-create-image > select { order: 3; }
.scene-create-image > input:not([type="color"]):not([type="file"]) { order: 4; }
.scene-create-image > label { order: 6; }
.scene-create-image > p[role="alert"] { order: 7; }
.scene-create-image[data-editing="true"] > select { display: none; }
.scene-create-image[data-editing="true"] > input:not([type="color"]):not([type="file"]), .scene-create-image[data-editing="true"] .scene-draw-actions { order: 0; }
.scene-draw-tools { order: 2; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; gap: 4px; }
.scene-draw-tools button[aria-pressed="true"] { border-color: var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 80%); }
.scene-draw-tools input[type="color"] { width: 100%; height: 32px; padding: 2px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background: var(--vscode-button-secondaryBackground); }
.scene-draw-tools select { width: 100% !important; min-width: 0; padding: 3px !important; }
.scene-create-image input[type="file"] { display: block; max-width: 100%; }
.scene-draw-actions { order: 5; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.scene-library section { min-width: 0; }
.scene-library h3 { margin: 0 0 6px; color: var(--vscode-descriptionForeground); font-size: 0.76em; letter-spacing: 0.06em; text-transform: uppercase; }
.scene-library-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
.scene-asset-filters { display: grid; grid-template-columns: minmax(0, 1fr) minmax(95px, 0.7fr); gap: 5px; margin: 7px 0; }
.scene-asset-filters input, .scene-asset-filters select { min-width: 0; width: 100%; }
.scene-library-grid > button, .scene-asset-card > button:first-child { display: grid; justify-items: center; align-content: center; gap: 3px; min-width: 0; min-height: 80px; width: 100%; padding: 4px; border: 1px solid var(--vscode-panel-border); border-radius: 7px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; }
.scene-asset-card { display: grid; gap: 3px; min-width: 0; }
.scene-actor-from-costume { border-color: var(--vscode-focusBorder) !important; color: var(--vscode-foreground) !important; font-weight: 600; }
.scene-edit-asset, .scene-duplicate-asset { min-height: 28px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); cursor: pointer; }
.scene-edit-asset:hover, .scene-duplicate-asset:hover { background: var(--vscode-list-hoverBackground); }
.scene-library-grid button[aria-pressed="true"] { border: 2px solid var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 85%); }
.scene-library-grid button:disabled { opacity: 0.5; cursor: not-allowed; }
.scene-library-grid img { display: block; width: 60px; height: 48px; object-fit: contain; }
.scene-library-grid button > span:last-child { display: block; max-width: 100%; overflow: hidden; font-size: 0.76em; text-overflow: ellipsis; white-space: nowrap; }
.scene-sound-hint { margin: 0 0 8px; color: var(--vscode-descriptionForeground); font-size: 0.82em; line-height: 1.4; }
.scene-sound-card { display: grid; justify-items: center; gap: 4px; min-width: 0; padding: 8px 5px; border: 1px solid var(--vscode-panel-border); border-radius: 7px; background: var(--vscode-button-secondaryBackground); text-align: center; }
.scene-sound-card strong { max-width: 100%; overflow: hidden; font-size: 0.82em; text-overflow: ellipsis; white-space: nowrap; }
.scene-sound-card small { color: var(--vscode-descriptionForeground); }
.scene-sound-card button { width: 100%; font-size: 0.78em; }
.scene-sound-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; color: var(--vscode-charts-purple, var(--vscode-focusBorder)); background: color-mix(in srgb, var(--vscode-charts-purple, var(--vscode-focusBorder)), transparent 86%); font-size: 1.4em; }
.studio-tools > p { margin: 0 0 12px; color: var(--vscode-descriptionForeground); font-size: 0.82em; line-height: 1.35; }
.studio-tools .palette { display: flex; flex-direction: column; gap: 8px; }
.studio-tools .palette-section { gap: 5px; }
.studio-tools .palette button { display: flex; align-items: center; gap: 8px; cursor: grab; }
.studio-tools .palette button:active { cursor: grabbing; }
.studio-tools .palette button:disabled { cursor: not-allowed; }
.palette button[data-tone="start"], .studio-program .block[data-tone="start"] { --block-accent: var(--vscode-charts-yellow, var(--vscode-focusBorder)); }
.palette button[data-tone="motion"], .studio-program .block[data-tone="motion"] { --block-accent: var(--vscode-charts-blue, var(--vscode-focusBorder)); }
.palette button[data-tone="looks"], .studio-program .block[data-tone="looks"] { --block-accent: var(--vscode-charts-purple, var(--vscode-focusBorder)); }
.palette button[data-tone="sound"], .studio-program .block[data-tone="sound"] { --block-accent: var(--vscode-charts-red, var(--vscode-focusBorder)); }
.palette button[data-tone="control"], .studio-program .block[data-tone="control"] { --block-accent: var(--vscode-charts-orange, var(--vscode-focusBorder)); }
.palette button[data-tone="sensing"], .studio-program .block[data-tone="sensing"] { --block-accent: var(--vscode-charts-green, var(--vscode-focusBorder)); }
.palette button[data-tone="operators"], .studio-program .block[data-tone="operators"] { --block-accent: var(--vscode-charts-green, var(--vscode-focusBorder)); }
.palette button[data-tone="variables"], .studio-program .block[data-tone="variables"] { --block-accent: var(--vscode-charts-orange, var(--vscode-focusBorder)); }
.studio-tools .palette button[data-tone], .studio-program .block[data-tone] { position: relative; border-color: color-mix(in srgb, var(--block-accent), var(--vscode-panel-border) 42%); border-left: 5px solid var(--block-accent); background: linear-gradient(90deg, color-mix(in srgb, var(--block-accent), transparent 79%), var(--vscode-editorWidget-background) 78%); box-shadow: inset 0 1px color-mix(in srgb, var(--block-accent), transparent 60%); }
.studio-tools .palette button[data-shape="reporter"] { border-radius: 20px; }
.studio-tools .palette button[data-shape="hat"] { border-radius: 14px 14px 5px 5px; }
.studio-tools .palette button[data-shape="container"], .studio-program .block[data-shape="container"] { border-radius: 8px 8px 3px 3px; }
.studio-tools .palette button[data-shape="stack"]::after, .studio-program .block[data-shape="stack"]::after, .studio-program .block[data-shape="container"]::after { content: ""; position: absolute; left: 18px; bottom: -5px; width: 19px; height: 5px; border: 1px solid var(--block-accent); border-top: 0; border-radius: 0 0 5px 5px; background: color-mix(in srgb, var(--block-accent), var(--vscode-editorWidget-background) 65%); z-index: 1; }
.palette-block-label { flex: 1; }
.palette-block-symbol { color: var(--block-accent); font-size: 1.1em; }
.studio-tools .palette button[data-tone="motion"] .palette-grip::before, .studio-program .block[data-tone="motion"]::before { content: "➜"; }
.studio-tools .palette button[data-tone="looks"] .palette-grip::before, .studio-program .block[data-tone="looks"]::before { content: "◉"; }
.studio-tools .palette button[data-tone="sound"] .palette-grip::before, .studio-program .block[data-tone="sound"]::before { content: "♪"; }
.studio-tools .palette button[data-tone="start"] .palette-grip::before, .studio-program .block[data-tone="start"]::before { content: "⚑"; }
.studio-tools .palette button[data-tone="control"] .palette-grip::before, .studio-program .block[data-tone="control"]::before { content: "↻"; }
.studio-tools .palette button[data-tone="sensing"] .palette-grip::before, .studio-program .block[data-tone="sensing"]::before { content: "◎"; }
.studio-tools .palette button[data-tone="operators"] .palette-grip::before, .studio-program .block[data-tone="operators"]::before { content: "ƒ"; }
.studio-tools .palette button[data-tone="variables"] .palette-grip::before, .studio-program .block[data-tone="variables"]::before { content: "▦"; }
.palette-grip { flex: 0 0 18px; color: var(--block-accent, var(--vscode-descriptionForeground)); font-size: 1.05em; text-align: center; }
.palette-grip::before { content: "⋮⋮"; }
.studio-tools .palette-search { margin-bottom: 4px; }
.studio-program h2, .studio-evidence h2 { margin: 0 0 12px; color: var(--vscode-foreground); font-size: 0.8em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.studio-program-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.studio-program-heading h2 { margin: 0; }
.studio-program-heading button { min-height: 30px; padding: 4px 9px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); cursor: pointer; }
.studio-program-heading button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.studio-findings { margin: 0 0 10px; padding: 9px 11px; border: 1px solid color-mix(in srgb, var(--vscode-charts-orange, var(--vscode-focusBorder)), var(--vscode-panel-border) 52%); border-left: 3px solid var(--vscode-charts-orange, var(--vscode-focusBorder)); border-radius: 6px; background: color-mix(in srgb, var(--vscode-charts-orange, var(--vscode-focusBorder)), var(--vscode-editorWidget-background) 94%); }
.studio-findings header { display: flex; align-items: center; gap: 8px; }
.studio-findings h3 { margin: 0; font-size: 0.82em; }
.studio-findings header span { min-width: 19px; border-radius: 10px; text-align: center; background: var(--vscode-charts-orange, var(--vscode-focusBorder)); color: var(--vscode-editor-background); font-size: 0.72em; font-weight: 700; }
.studio-findings p { margin: 5px 0; color: var(--vscode-descriptionForeground); font-size: 0.76em; }
.studio-findings ul { display: grid; gap: 4px; max-height: 120px; overflow: auto; margin: 6px 0; padding: 0; list-style: none; }
.studio-findings li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; font-size: 0.78em; }
.studio-findings li strong { flex: 1; font-weight: 500; }
.studio-findings button { min-height: 26px; padding: 2px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; }
.studio-findings button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.studio-findings-ori { margin-top: 3px; }
.studio-component-launcher { display: none; }
.studio-component-launcher button { --block-accent: var(--vscode-focusBorder); flex: 0 0 auto; min-height: 30px; padding: 3px 5px; border: 1px solid color-mix(in srgb, var(--block-accent), var(--vscode-panel-border) 45%); border-bottom: 3px solid var(--block-accent); border-radius: 6px; background: color-mix(in srgb, var(--block-accent), var(--vscode-editorWidget-background) 88%); color: var(--vscode-foreground); font-size: 0.8em; cursor: pointer; }
.studio-component-launcher button[data-tone="motion"] { --block-accent: var(--vscode-charts-blue, var(--vscode-focusBorder)); }
.studio-component-launcher button[data-tone="looks"] { --block-accent: var(--vscode-charts-purple, var(--vscode-focusBorder)); }
.studio-component-launcher button[data-tone="control"] { --block-accent: var(--vscode-charts-orange, var(--vscode-focusBorder)); }
.studio-component-launcher button[data-tone="sensing"] { --block-accent: var(--vscode-charts-green, var(--vscode-focusBorder)); }
.studio-component-launcher button[aria-expanded="true"] { outline: 2px solid var(--block-accent); outline-offset: -2px; }
.studio-component-launcher button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.studio-main { grid-column: 2; display: grid; align-content: start; gap: 0; min-width: 0; min-height: calc(100vh - 58px); border-right: 1px solid var(--vscode-panel-border); }
.workbench[data-workspace-view="scene"] .studio-main { grid-template-columns: minmax(0, 1fr) clamp(232px, 24vw, 340px); }
.workbench[data-workspace-view="scene"] .studio-editor-tabs, .workbench[data-workspace-view="scene"] .studio-details, .workbench[data-workspace-view="scene"] .status { grid-column: 1 / -1; }
.workbench[data-workspace-view="scene"] .studio-play { grid-column: 1; }
.studio-scene-editor { grid-column: 2; min-width: 0; max-height: calc(100vh - 100px); overflow: auto; padding: 10px; border-left: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.studio-scene-editor h2 { margin: 0 0 14px; font-size: 0.8em; letter-spacing: 0.06em; text-transform: uppercase; }
.studio-scene-editor .actor-inspector { border-radius: 8px; border-color: color-mix(in srgb, var(--vscode-focusBorder), var(--vscode-panel-border) 65%); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 95%); }
.studio-scene-editor .actor-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.studio-scene-editor .actor-inspector label { min-width: 0; }
.studio-scene-editor .scene-create-image canvas { max-width: 100%; box-sizing: border-box; }
.studio-scene-editor .scene-create-image input, .studio-scene-editor .scene-create-image select { box-sizing: border-box; max-width: 100%; min-width: 0; }
.studio-scene-editor input:not([type="color"]):not([type="file"]), .studio-scene-editor select { width: 100%; min-height: 30px; padding: 5px 8px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; }
.studio-scene-editor input[type="file"] { width: 100%; color: var(--vscode-descriptionForeground); font-size: 0.85em; }
.studio-scene-editor button { min-height: 30px; padding: 5px 9px; color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); border: 1px solid var(--vscode-panel-border); border-radius: 4px; }
.studio-scene-editor button:hover { background: var(--vscode-list-hoverBackground); }
.studio-editor-tabs { display: flex; gap: 2px; align-items: end; min-height: 40px; padding: 0 10px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.studio-editor-tabs button { min-height: 40px; border-bottom: 2px solid transparent; border-radius: 0; }
.studio-editor-tabs button[aria-pressed="true"] { border-bottom-color: var(--vscode-focusBorder); color: var(--vscode-foreground); font-weight: 700; }
.studio-editor-tabs .studio-code-tab { margin-left: auto; color: var(--vscode-textLink-foreground, var(--vscode-focusBorder)); }
.studio-play { display: grid; gap: 8px; min-width: 0; padding: 12px; border: 0; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editorBackground, var(--vscode-editor-background)); }
.studio-history-actions { display: flex; justify-content: flex-end; gap: 6px; }
.studio-history-actions button { min-height: 28px; padding: 3px 8px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; }
.studio-history-actions button:disabled { opacity: .45; cursor: default; }
.studio-play .execution-toolbar, .studio-play .stage-panel { margin: 0; }
.studio-play .stage-viewport { min-height: clamp(260px, 36vh, 420px); max-height: none; }
.studio-play .stage-panel[data-empty="true"] .stage-viewport { min-height: 260px; }
.workbench[data-workspace-view="scene"] .studio-play .stage-viewport { min-height: clamp(380px, 60vh, 680px); }
@media (min-width: 761px) and (max-width: 1100px) {
  .workbench[data-workspace-view="scene"] .studio-play .execution-toolbar { display: grid; gap: 5px; }
  .workbench[data-workspace-view="scene"] .studio-play .execution-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3px; }
  .workbench[data-workspace-view="scene"] .studio-play .execution-actions button { min-width: 0; min-height: 28px; padding: 3px 2px; font-size: 0.8em; }
  .workbench[data-workspace-view="scene"] .studio-play .execution-readout { font-size: 0.75em; white-space: normal; }
}
.studio-program { min-height: 340px; padding: 16px; border: 0; box-sizing: border-box; }
.studio-program .canvas { min-height: 220px; }
.studio-program .block { min-height: 38px; box-sizing: border-box; cursor: grab; }
.studio-program .block:active { cursor: grabbing; }
.studio-program .block::before { content: "⋮⋮"; flex: 0 0 18px; color: var(--block-accent, var(--vscode-descriptionForeground)); font-size: 1.05em; text-align: center; }
.studio-program .block .label { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
.studio-program .block[data-shape="container"] { border-bottom-width: 4px; }
.studio-program .block.depth-1, .studio-program .slot.depth-1 { margin-left: 24px; border-left: 3px solid color-mix(in srgb, var(--vscode-charts-orange, var(--vscode-focusBorder)), transparent 45%); }
.studio-program .block.depth-2, .studio-program .slot.depth-2 { margin-left: 48px; border-left: 3px solid color-mix(in srgb, var(--vscode-charts-orange, var(--vscode-focusBorder)), transparent 45%); }
.studio-program .block.depth-3, .studio-program .slot.depth-3 { margin-left: 72px; border-left: 3px solid color-mix(in srgb, var(--vscode-charts-orange, var(--vscode-focusBorder)), transparent 45%); }
.studio-program .block.depth-4, .studio-program .slot.depth-4 { margin-left: 96px; border-left: 3px solid color-mix(in srgb, var(--vscode-charts-orange, var(--vscode-focusBorder)), transparent 45%); }
.studio-program .block-field { display: grid; gap: 2px; flex: 0 0 64px; color: var(--vscode-descriptionForeground); font-size: 0.74em; }
.studio-program .numeric-socket { flex: 0 1 160px; min-width: 110px; padding: 3px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; }
.studio-program .numeric-socket label { display: grid; gap: 2px; min-width: 0; }
.studio-program .numeric-socket select { width: 100%; min-height: 28px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); }
.studio-program .numeric-socket:has(.numeric-place) { border-color: var(--vscode-focusBorder); }
.studio-program .numeric-place { width: 100%; margin-top: 4px; min-height: 24px; border: 1px dashed var(--vscode-focusBorder); border-radius: 3px; background: transparent; color: var(--vscode-foreground); cursor: pointer; }
.studio-program .math-function-fields { display: grid; gap: 4px; margin-top: 4px; min-width: 0; }
.studio-program .math-function-fields input { width: 100%; min-width: 0; }
.studio-program .condition-detail { flex-basis: 128px; }
.studio-program .condition-detail select { width: 100%; min-height: 28px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); }
.studio-program .block-field:has(input[type="text"]) { flex-basis: clamp(76px, 14vw, 170px); }
.studio-program .block-field input { width: 64px; min-height: 28px; box-sizing: border-box; padding: 2px 4px; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); font: 0.96rem var(--vscode-editor-font-family); }
.studio-program .block-field input[type="text"] { width: clamp(76px, 14vw, 170px); }
.studio-program .block-field input:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
.studio-program .block button { flex: 0 0 26px; min-width: 26px; min-height: 28px; padding: 2px; text-align: center; font-size: 1.05em; }
.studio-program .block button.block-ori { margin-left: auto; flex-basis: 34px; min-width: 34px; color: var(--vscode-charts-purple, var(--vscode-focusBorder)); font-size: 0.78em; font-weight: 700; }
.studio-program .block button.block-breakpoint { color: var(--vscode-descriptionForeground); opacity: 0.65; }
.studio-program .block button.block-breakpoint[data-active="true"] { color: var(--vscode-charts-red, #e05a65); opacity: 1; font-weight: 800; }
.studio-debugger { display: grid; gap: 10px; margin: 10px 0; padding: 12px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.studio-debugger h3 { margin: 0; font-size: 0.95em; }
.studio-debugger label { display: flex; align-items: center; gap: 8px; }
.studio-debugger select { min-width: 130px; max-width: 220px; }
.studio-debugger ol { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.studio-debugger li { padding: 4px 7px; border: 1px solid var(--vscode-panel-border); font-family: var(--vscode-editor-font-family); }
.studio-program .slot { display: grid; place-items: center; height: 36px; border-top: 1px dashed var(--vscode-panel-border); border-radius: 4px; color: var(--vscode-descriptionForeground); box-sizing: border-box; }
.studio-program .slot span { visibility: hidden; font-size: 0.8em; }
.studio-program .slot.is-empty { height: 72px; margin: 8px 0; border: 1px dashed var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 94%); }
.studio-program .slot.is-empty span { visibility: visible; }
.studio-program .slot.is-branch-start { min-height: 30px; height: auto; padding: 4px 10px; border: 1px dashed var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.studio-program .slot.is-branch-start span { visibility: visible; }
.workbench[data-dragging="true"] .studio-program .slot { border: 1px dashed var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 93%); }
.workbench[data-dragging="true"] .studio-program .slot span { visibility: visible; }
.studio-program .slot.drag-over, .workbench[data-dragging="true"] .studio-program .slot.drag-over { border: 2px solid var(--vscode-focusBorder); background: var(--vscode-list-hoverBackground); }
.studio-program .zones { margin-top: 14px; }
.studio-program .zone-hint { margin: 14px 0 0; color: var(--vscode-descriptionForeground); font-size: 0.84em; }
.studio-program .zones { margin-top: 6px; }
.studio-evidence { padding: 14px; border-top: 3px solid var(--vscode-charts-blue, var(--vscode-focusBorder)); }
.studio-evidence .stage-panel { margin-bottom: 10px; }
.studio-details { padding: 10px 14px; }
.studio-details summary { cursor: pointer; font-weight: 600; }
.studio-details summary:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 3px; }
.studio-details[open] summary { margin-bottom: 14px; }
.studio-ori-dock { grid-column: 3; position: sticky; top: 0; height: calc(100vh - 58px); min-width: 0; overflow: auto; border-left: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.studio-ori-resize { position: absolute; z-index: 3; top: 0; bottom: 0; left: 0; width: 9px; cursor: col-resize; touch-action: none; }
.studio-ori-resize::before { content: ""; position: absolute; top: 0; bottom: 0; left: 3px; width: 2px; background: transparent; }
.studio-ori-resize:hover::before, .studio-ori-resize:focus-visible::before { background: var(--vscode-focusBorder); }
.studio-ori-resize:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: -2px; }
.studio-ori-dock .agent { position: static; max-height: none; overflow: visible; padding: 0 14px 16px; border: 0; }
@media (min-width: 761px) {
  .workbench[data-workspace-view="build"] .studio-main { grid-template-columns: minmax(0, 1fr) minmax(220px, 39%); }
  .workbench[data-workspace-view="build"] .studio-editor-tabs, .workbench[data-workspace-view="build"] .studio-details, .workbench[data-workspace-view="build"] .status { grid-column: 1 / -1; }
  .workbench[data-workspace-view="build"] .studio-program { grid-column: 1; grid-row: 2; min-height: calc(100vh - 150px); max-height: calc(100vh - 150px); overflow: auto; }
  .workbench[data-workspace-view="build"] .studio-play { grid-column: 2; grid-row: 2; align-content: start; border-left: 1px solid var(--vscode-panel-border); }
  .workbench[data-workspace-view="build"] .studio-play .execution-toolbar { display: grid; gap: 5px; }
  .workbench[data-workspace-view="build"] .studio-play .execution-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
  .workbench[data-workspace-view="build"] .studio-play .execution-actions button { min-height: 28px; padding: 3px 4px; font-size: 0.8em; }
  .workbench[data-workspace-view="build"] .studio-play .execution-readout { font-size: 0.75em; white-space: normal; }
  .workbench[data-workspace-view="build"] .stage-panel-header { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px; }
  .workbench[data-workspace-view="build"] .stage-panel-header > small { display: none; }
  .workbench[data-workspace-view="build"] .stage-panel-header > div { overflow: hidden; font-size: 0.76em; text-overflow: ellipsis; white-space: nowrap; }
  .workbench[data-workspace-view="build"] .stage-readout { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .workbench[data-workspace-view="build"] .stage-readout div { min-width: 0; padding: 3px 5px; font-size: 0.72em; }
  .workbench[data-workspace-view="build"] .studio-play .stage-viewport { min-height: clamp(210px, 32vh, 300px); }
  .workbench[data-workspace-view="build"] .studio-play .stage-panel[data-empty="true"] .stage-viewport { min-height: 210px; }
}
.ori-header { display: flex; align-items: center; gap: 10px; margin: 0 -14px 4px; padding: 16px 14px; border-bottom: 1px solid var(--vscode-panel-border); background: color-mix(in srgb, var(--vscode-charts-purple, var(--vscode-focusBorder)), transparent 91%); }
.ori-header h2 { margin: 0; font-size: 1.2em; line-height: 1.1; }
.ori-header p { margin: 4px 0 0; color: var(--vscode-descriptionForeground); font-size: 0.84em; }
.ori-mark { display: grid; place-items: center; flex: 0 0 34px; height: 34px; border: 1px solid var(--vscode-charts-purple, var(--vscode-focusBorder)); border-radius: 10px; color: var(--vscode-charts-purple, var(--vscode-focusBorder)); font-size: 1.25em; }
.ori-turn { min-width: 0; padding: 10px 12px; border: 1px solid var(--vscode-panel-border); border-radius: 10px; overflow-wrap: anywhere; }
.ori-turn p { margin: 5px 0 0; line-height: 1.45; }
.ori-turn-label { font-size: 0.72em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--vscode-descriptionForeground); }
.ori-turn-companion { margin-right: 10px; border-color: color-mix(in srgb, var(--vscode-charts-purple, var(--vscode-focusBorder)), var(--vscode-panel-border) 55%); background: color-mix(in srgb, var(--vscode-charts-purple, var(--vscode-focusBorder)), transparent 93%); }
.ori-turn-learner { margin-left: 10px; background: var(--vscode-input-background); }
.ori-workflow-settings { border-top: 1px solid var(--vscode-panel-border); padding-top: 9px; }
.ori-workflow-settings > summary { cursor: pointer; color: var(--vscode-descriptionForeground); font-size: 0.8em; }
.ori-workflow-settings > summary:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.ori-workflow-settings .ribbon { margin: 10px 0; }
.workbench[data-density="compact"] .studio-banner { padding: 8px 12px; }
.workbench[data-density="compact"] .studio-program, .workbench[data-density="compact"] .studio-evidence { padding: 10px; }
@media (min-width: 761px) and (max-width: 1100px) { .workbench, .workbench[data-tools-open="false"] { --ori-width: 210px; grid-template-columns: minmax(0, 1fr) var(--ori-width); } .workbench[data-ori-open="false"], .workbench[data-ori-open="false"][data-tools-open="false"] { grid-template-columns: minmax(0, 1fr); } .workbench .studio-main { grid-column: 1; } .workbench .studio-ori-dock, .workbench[data-tools-open="false"] .studio-ori-dock { grid-column: 2; } .workbench .studio-tools { position: fixed; z-index: 10; top: 96px; right: var(--ori-width); width: 220px; height: calc(100vh - 96px); box-sizing: border-box; box-shadow: -8px 0 22px #0004; } .workbench[data-ori-open="false"] .studio-tools { right: 0; } .studio-ori-dock .agent { padding-inline: 10px; } .ori-header { margin-inline: -10px; padding-inline: 10px; } }
@media (min-width: 761px) and (max-width: 1100px) { .studio-component-launcher { display: flex; gap: 3px; overflow-x: auto; padding: 2px 0 9px; margin: -4px 0 9px; scrollbar-width: thin; } }
@media (min-width: 761px) and (max-width: 1100px) { .workbench[data-workspace-view="build"] .studio-program .block { gap: 4px; padding: 5px 6px; } .workbench[data-workspace-view="build"] .studio-program .block::before { flex-basis: 14px; } .workbench[data-workspace-view="build"] .studio-program .block .label { flex: 0 1 auto; min-width: 40px; } .workbench[data-workspace-view="build"] .studio-program .block-field { flex-basis: 58px; } .workbench[data-workspace-view="build"] .studio-program .block-field input { width: 56px; } .workbench[data-workspace-view="build"] .studio-program .block button { flex-basis: 24px; min-width: 24px; } .workbench[data-workspace-view="build"] .studio-program .block button.block-ori { flex-basis: 30px; min-width: 30px; } }
@media (max-width: 760px) { .workbench, .workbench[data-density="compact"], .workbench[data-tools-open="false"], .workbench[data-ori-open="false"] { grid-template-columns: minmax(0, 1fr); } .studio-tools, .studio-main, .studio-ori-dock, .workbench[data-tools-open="false"] .studio-main, .workbench[data-tools-open="false"] .studio-ori-dock { grid-column: 1; } .studio-tools { position: static; max-height: 230px; } .studio-tools .palette { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; } .studio-tools .palette-search { grid-column: 1 / -1; } .studio-ori-dock { position: static; height: auto; max-height: 420px; } .studio-ori-resize { display: none; } }
@media (max-width: 700px) { .studio-banner { align-items: center; } .studio-banner p { display: none; } .studio-shell-actions { width: 100%; margin-left: 0; } .studio-shell-actions button { flex: 1; } .workbench[data-workspace-view="scene"] .studio-main { grid-template-columns: minmax(0, 1fr); } .workbench[data-workspace-view="scene"] .studio-play, .studio-scene-editor { grid-column: 1; } .studio-scene-editor { max-height: none; border-left: 0; border-top: 1px solid var(--vscode-panel-border); } }
@media (prefers-reduced-motion: reduce) { .slot, .stage-goal, .stage-sprite { transition: none; } }
`;
