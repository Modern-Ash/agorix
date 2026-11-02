/** Panel styles; own CSS variables with fallbacks so Web and VS Code hosts can both theme it. */
export const PANEL_CSS = `
.agx-panel-workarea { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; max-width: 100%; }
.agx-panel { display: flex; flex-direction: column; flex: 1 1 0; min-width: 0; min-height: 0; background: var(--agx-panel-bg, #fff); color: var(--agx-panel-fg, #1b2230); border: 1px solid var(--agx-panel-border, #d5dae3); border-radius: 10px; overflow: hidden; }
.agx-panel[hidden] { display: none; }
.agx-panel--maximized { position: absolute; inset: 0; z-index: 20; flex: none; }
.agx-panel-header { display: flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 8px; border-bottom: 1px solid var(--agx-panel-border, #d5dae3); }
@media (max-width: 767px) { .agx-panel-header { min-height: 44px; } }
.agx-panel-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--panel-accent, #5B6475); }
.agx-panel-title { flex: 1 1 auto; min-width: 0; margin: 0; font-size: 0.95rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.agx-panel-actions, .agx-panel-zoom { display: flex; align-items: center; gap: 4px; flex: none; }
.agx-panel-header button, .agx-panel-chip { min-width: 44px; min-height: 44px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.agx-panel-header button:hover:not(:disabled), .agx-panel-chip:hover { background: var(--agx-panel-hover, rgba(0,0,0,0.07)); }
.agx-panel-header button:focus-visible, .agx-panel-chip:focus-visible, .agx-panel-divider:focus-visible { outline: 3px solid var(--panel-accent, #5B6475); outline-offset: 1px; }
.agx-panel-header button:disabled { opacity: 0.45; cursor: not-allowed; }
.agx-panel-zoom-value { min-width: 56px; font-variant-numeric: tabular-nums; }
.agx-panel-body { flex: 1 1 auto; min-width: 0; min-height: 0; overflow: auto; }
.agx-panel-dock { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px; border-top: 1px solid var(--agx-panel-border, #d5dae3); }
.agx-panel-chip { display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; border: 1px solid var(--agx-panel-border, #d5dae3); border-radius: 999px; background: var(--agx-panel-bg, #fff); max-width: 100%; }
.agx-panel-divider { flex: none; background: var(--agx-panel-border, #d5dae3); touch-action: none; }
.agx-panel-divider--vertical { width: 6px; cursor: col-resize; }
.agx-panel-divider--horizontal { height: 6px; cursor: row-resize; }
@media (prefers-reduced-motion: no-preference) { .agx-panel { transition: box-shadow 120ms ease; } }
`;
