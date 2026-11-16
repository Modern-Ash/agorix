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
.stage-sprite { padding: 0; color: var(--vscode-foreground); }
.stage-sprite:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 3px; }
.expression-socket { min-height: 28px; padding: 3px 10px; border: 1px solid var(--vscode-focusBorder); border-radius: 15px; background: var(--vscode-editorWidget-background); color: var(--vscode-foreground); cursor: pointer; }
.expression-socket[data-tone="sensing"] { border-color: var(--vscode-charts-blue); }
.expression-socket[data-tone="operators"] { border-color: var(--vscode-charts-green); }
.expression-socket:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.comparison-fields { display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.comparison-fields .block-field { min-width: 74px; }
.variable-creator { display: grid; gap: 6px; margin: 8px 0 14px; padding: 8px; border: 1px solid var(--vscode-panel-border); }
.variable-creator label { display: grid; gap: 3px; }
.variable-creator input { min-width: 0; }
.variable-creator ul { margin: 0; padding-left: 18px; }
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
/* Advanced Studio: the program is the desk, Ori is a companion, evidence is the bench below. */
.workbench { grid-template-columns: minmax(178px, 198px) minmax(0, 1fr) minmax(240px, 260px); gap: 10px; align-items: start; min-height: 100vh; box-sizing: border-box; background: var(--vscode-editor-background); }
.workbench[data-density="compact"] { grid-template-columns: minmax(150px, 175px) minmax(0, 1fr) minmax(240px, 270px); gap: 8px; }
.studio-banner { grid-column: 1 / -1; display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 14px; padding: 10px 14px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.studio-banner span { color: var(--vscode-descriptionForeground); font: 600 0.72em var(--vscode-editor-font-family); letter-spacing: 0.12em; }
.studio-banner h1 { margin: 0; font-size: 1.15em; line-height: 1.2; letter-spacing: -0.02em; }
.studio-banner p { margin: 0; max-width: 70ch; color: var(--vscode-descriptionForeground); }
.studio-tools, .studio-program, .studio-evidence, .studio-details, .agent { min-width: 0; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
.studio-tools { position: sticky; top: 10px; max-height: calc(100vh - 20px); overflow: auto; padding: 12px; border-top: 3px solid var(--vscode-charts-green, var(--vscode-focusBorder)); }
.studio-tools h2 { margin: 0 0 5px; font-size: 0.8em; letter-spacing: 0.06em; text-transform: uppercase; }
.library-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 12px; }
.library-tabs button { min-height: 32px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; }
.library-tabs button[aria-pressed="true"] { border-color: var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 78%); color: var(--vscode-foreground); font-weight: 700; }
.library-tabs button:focus-visible, .scene-library button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
.scene-library { display: grid; gap: 14px; }
.scene-library section { min-width: 0; }
.scene-library h3 { margin: 0 0 6px; color: var(--vscode-descriptionForeground); font-size: 0.76em; letter-spacing: 0.06em; text-transform: uppercase; }
.scene-library-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
.scene-library-grid button { display: grid; justify-items: center; align-content: center; gap: 3px; min-width: 0; min-height: 80px; padding: 4px; border: 1px solid var(--vscode-panel-border); border-radius: 7px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; }
.scene-library-grid button[aria-pressed="true"] { border: 2px solid var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 85%); }
.scene-library-grid button:disabled { opacity: 0.5; cursor: not-allowed; }
.scene-library-grid img { display: block; width: 60px; height: 48px; object-fit: contain; }
.scene-library-grid button > span:last-child { display: block; max-width: 100%; overflow: hidden; font-size: 0.76em; text-overflow: ellipsis; white-space: nowrap; }
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
.studio-main { display: grid; gap: 14px; min-width: 0; }
.studio-play { display: grid; gap: 8px; min-width: 0; padding: 10px; border: 1px solid var(--vscode-panel-border); border-top: 3px solid var(--vscode-charts-blue, var(--vscode-focusBorder)); background: var(--vscode-editorWidget-background); }
.studio-play .execution-toolbar, .studio-play .stage-panel { margin: 0; }
.studio-play .stage-viewport { min-height: 180px; max-height: 260px; }
.studio-play .stage-panel[data-empty="true"] .stage-viewport { min-height: 54px; }
.studio-program { min-height: 340px; padding: 16px; border-top: 3px solid var(--vscode-focusBorder); box-sizing: border-box; }
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
.studio-program .block-field:has(input[type="text"]) { flex-basis: clamp(76px, 14vw, 170px); }
.studio-program .block-field input { width: 64px; min-height: 28px; box-sizing: border-box; padding: 2px 4px; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); font: 0.96rem var(--vscode-editor-font-family); }
.studio-program .block-field input[type="text"] { width: clamp(76px, 14vw, 170px); }
.studio-program .block-field input:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
.studio-program .block button { flex: 0 0 26px; min-width: 26px; min-height: 28px; padding: 2px; text-align: center; font-size: 1.05em; }
.studio-program .block button.block-ori { margin-left: auto; flex-basis: 34px; min-width: 34px; color: var(--vscode-charts-purple, var(--vscode-focusBorder)); font-size: 0.78em; font-weight: 700; }
.studio-program .slot { display: grid; place-items: center; height: 16px; border-top: 1px dashed var(--vscode-panel-border); border-radius: 4px; color: var(--vscode-descriptionForeground); box-sizing: border-box; }
.studio-program .slot span { visibility: hidden; font-size: 0.8em; }
.studio-program .slot.is-empty { height: 72px; margin: 8px 0; border: 1px dashed var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 94%); }
.studio-program .slot.is-empty span { visibility: visible; }
.workbench[data-dragging="true"] .studio-program .slot { height: 36px; border: 1px dashed var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder), transparent 93%); }
.workbench[data-dragging="true"] .studio-program .slot span { visibility: visible; }
.studio-program .slot.drag-over, .workbench[data-dragging="true"] .studio-program .slot.drag-over { height: 42px; border: 2px solid var(--vscode-focusBorder); background: var(--vscode-list-hoverBackground); }
.studio-program .zones { margin-top: 14px; }
.studio-program .zone-hint { margin: 14px 0 0; color: var(--vscode-descriptionForeground); font-size: 0.84em; }
.studio-program .zones { margin-top: 6px; }
.studio-evidence { padding: 14px; border-top: 3px solid var(--vscode-charts-blue, var(--vscode-focusBorder)); }
.studio-evidence .stage-panel { margin-bottom: 10px; }
.studio-details { padding: 10px 14px; }
.studio-details summary { cursor: pointer; font-weight: 600; }
.studio-details summary:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 3px; }
.studio-details[open] summary { margin-bottom: 14px; }
.agent { position: sticky; top: 12px; max-height: calc(100vh - 24px); overflow: auto; padding: 0 14px 16px; border-top: 3px solid var(--vscode-charts-purple, var(--vscode-focusBorder)); }
.ori-header { display: flex; align-items: center; gap: 10px; margin: 0 -14px 4px; padding: 16px 14px; border-bottom: 1px solid var(--vscode-panel-border); background: color-mix(in srgb, var(--vscode-charts-purple, var(--vscode-focusBorder)), transparent 91%); }
.ori-header h2 { margin: 0; font-size: 1.2em; line-height: 1.1; }
.ori-header p { margin: 4px 0 0; color: var(--vscode-descriptionForeground); font-size: 0.84em; }
.ori-mark { display: grid; place-items: center; flex: 0 0 34px; height: 34px; border: 1px solid var(--vscode-charts-purple, var(--vscode-focusBorder)); border-radius: 10px; color: var(--vscode-charts-purple, var(--vscode-focusBorder)); font-size: 1.25em; }
.workbench[data-density="compact"] .studio-banner { padding: 8px 12px; }
.workbench[data-density="compact"] .studio-program, .workbench[data-density="compact"] .studio-evidence { padding: 10px; }
@media (max-width: 850px) { .workbench, .workbench[data-density="compact"] { grid-template-columns: minmax(0, 1fr) minmax(240px, 270px); } .studio-tools { grid-column: 1 / -1; position: static; max-height: 175px; } .studio-tools .palette { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; } .studio-tools .palette-search { grid-column: 1 / -1; } }
@media (max-width: 700px) { .workbench, .workbench[data-density="compact"] { grid-template-columns: minmax(0, 1fr); } .studio-banner, .studio-tools, .studio-main, .agent { grid-column: 1; } .agent { position: static; max-height: none; } }
@media (prefers-reduced-motion: reduce) { .slot, .stage-goal, .stage-sprite { transition: none; } }
`;
