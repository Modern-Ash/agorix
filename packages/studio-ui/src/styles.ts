/** Workbench styles. Theme variables only, so the surface follows the IDE theme. */
export const WORKBENCH_CSS = `
:root { color-scheme: light dark; }
body { margin: 0; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
.workbench { display: grid; grid-template-columns: minmax(160px, 220px) 1fr; gap: 12px; padding: 12px; }
.palette { display: flex; flex-direction: column; gap: 6px; }
.palette button, .block button, .zone { min-height: 32px; padding: 4px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; text-align: left; }
.canvas { display: flex; flex-direction: column; }
.script-title { margin: 12px 0 4px; font-weight: 600; }
.slot { height: 8px; border-radius: 4px; transition: height 120ms ease; }
.slot.drag-over { height: 24px; background: var(--vscode-list-hoverBackground); outline: 1px dashed var(--vscode-focusBorder); }
.block { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-editorWidget-background); }
.block:focus-visible, .palette button:focus-visible, .block button:focus-visible, .zone:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
.block .label { flex: 1; }
.depth-0 { margin-left: 0; } .depth-1 { margin-left: 20px; } .depth-2 { margin-left: 40px; } .depth-3 { margin-left: 60px; } .depth-4 { margin-left: 80px; }
.zones { display: flex; gap: 8px; margin-top: 16px; }
.zone { flex: 1; text-align: center; border-style: dashed; }
.zone.drag-over { background: var(--vscode-list-hoverBackground); }
.status { margin-top: 12px; min-height: 1.4em; color: var(--vscode-descriptionForeground); }
@media (prefers-reduced-motion: reduce) { .slot { transition: none; } }
`;
