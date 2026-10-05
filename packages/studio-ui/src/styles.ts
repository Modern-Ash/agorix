/** Workbench styles. Theme variables only, so the surface follows the IDE theme. */
export const WORKBENCH_CSS = `
:root { color-scheme: light dark; }
body { margin: 0; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
.workbench { display: grid; grid-template-columns: minmax(160px, 220px) 1fr minmax(220px, 300px); gap: 12px; padding: 12px; }
.workbench[data-density="compact"] { grid-template-columns: minmax(140px, 180px) 1fr minmax(200px, 260px); gap: 8px; padding: 8px; font-size: 0.95em; }
@media (max-width: 900px) { .workbench { grid-template-columns: 1fr; } }
.palette { display: flex; flex-direction: column; gap: 6px; }
.palette button, .block button, .zone { min-height: 32px; padding: 4px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; text-align: left; }
.palette button:disabled { cursor: not-allowed; opacity: 0.65; color: var(--vscode-disabledForeground); }
.workbench[data-density="compact"] .palette { gap: 4px; }
.workbench[data-density="compact"] .palette button, .workbench[data-density="compact"] .block button, .workbench[data-density="compact"] .zone { padding: 3px 8px; }
.canvas { display: flex; flex-direction: column; }
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
.canvas:focus { outline: none; }
.canvas-help { margin: 0 0 8px; font-size: 0.9em; color: var(--vscode-descriptionForeground); }
.block button { min-width: 32px; }
@media (forced-colors: active) {
  .block { border: 1px solid CanvasText; }
  .block.sel { outline: 3px solid Highlight; }
  .block.exec { border-left: 6px solid Highlight; }
  .block.fail { border-left: 6px double LinkText; }
  .block.ghost-added, .block.ghost-changed, .block.ghost-removed { border-style: dashed; }
  .block:focus-visible, .palette button:focus-visible, .block button:focus-visible { outline: 3px solid Highlight; }
}
@media (prefers-reduced-motion: reduce) { .slot { transition: none; } }
`;
