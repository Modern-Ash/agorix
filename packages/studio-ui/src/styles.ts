/** Workbench styles. Theme variables only, so the surface follows the IDE theme. */
export const WORKBENCH_CSS = `
:root { color-scheme: light dark; }
body { margin: 0; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
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
.stage-active-route { overflow: hidden; max-width: 320px; font-family: var(--vscode-editor-font-family); text-overflow: ellipsis; white-space: nowrap; }
.stage-viewport { position: relative; min-height: 180px; overflow: hidden; background: var(--vscode-editor-background); }
.stage-viewport > p { margin: 0; padding: 18px; color: var(--vscode-descriptionForeground); }
.stage-backdrop { position: absolute; inset: 0; background: var(--vscode-editor-background); }
.stage-backdrop[data-backdrop-id="asset:space.trailhead"] { background: linear-gradient(135deg, color-mix(in srgb, var(--vscode-charts-blue), transparent 82%), var(--vscode-editor-background)); }
.stage-backdrop[data-backdrop-id="asset:space.nebula"] { background: radial-gradient(circle at 72% 28%, color-mix(in srgb, var(--vscode-charts-purple), transparent 56%), transparent 32%), linear-gradient(135deg, color-mix(in srgb, var(--vscode-charts-purple), transparent 72%), var(--vscode-editor-background)); }
.stage-grid { position: absolute; inset: 0; background-image: linear-gradient(var(--vscode-editorWidget-border, var(--vscode-panel-border)) 1px, transparent 1px), linear-gradient(90deg, var(--vscode-editorWidget-border, var(--vscode-panel-border)) 1px, transparent 1px); background-size: 32px 32px; opacity: 0.38; }
.stage-goal, .stage-sprite { position: absolute; width: 22px; height: 22px; box-sizing: border-box; transition: left 180ms ease, bottom 180ms ease, transform 180ms ease; }
.stage-goal { transform: translate(-50%, 50%); border: 2px solid var(--vscode-testing-iconPassed); border-radius: 50%; background: color-mix(in srgb, var(--vscode-testing-iconPassed), transparent 78%); }
.stage-goal.reached { box-shadow: 0 0 0 4px color-mix(in srgb, var(--vscode-testing-iconPassed), transparent 72%); }
.stage-sprite { border: 2px solid var(--vscode-charts-orange); border-radius: 45% 45% 45% 8px; background: color-mix(in srgb, var(--vscode-charts-orange), transparent 64%); }
.stage-sprite[data-costume-id="asset:costume.default"] { border-color: var(--vscode-charts-blue); background: color-mix(in srgb, var(--vscode-charts-blue), transparent 58%); }
.stage-sprite[data-costume-id="asset:costume.spark"] { border-color: var(--vscode-charts-green); background: color-mix(in srgb, var(--vscode-charts-green), transparent 54%); }
.stage-sprite.selected { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.stage-bubble { position: absolute; left: calc(100% + 6px); bottom: calc(100% + 4px); max-width: 140px; padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); clip-path: none; font-size: 0.78em; white-space: nowrap; }
.stage-bubble-think { border-style: dashed; }
.stage-watchers { position: absolute; top: 8px; left: 8px; z-index: 2; display: grid; gap: 4px; min-width: 96px; }
.stage-watcher { display: flex; justify-content: space-between; gap: 8px; padding: 3px 6px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); font-family: var(--vscode-editor-font-family); font-size: 0.82em; }
.stage-watcher span { color: var(--vscode-descriptionForeground); }
.stage-watcher strong { font-weight: 700; font-variant-numeric: tabular-nums; }
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
.workbench[data-density="compact"] .asset-panel { margin-bottom: 6px; padding: 6px; }
.script-title { margin: 12px 0 4px; font-weight: 600; }
.workbench[data-density="compact"] .script-title { margin: 8px 0 2px; }
.slot { height: 8px; border-radius: 4px; transition: height 120ms ease; }
.slot.drag-over { height: 24px; background: var(--vscode-list-hoverBackground); outline: 1px dashed var(--vscode-focusBorder); }
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
@media (prefers-reduced-motion: reduce) { .slot, .stage-goal, .stage-sprite { transition: none; } }
`;
