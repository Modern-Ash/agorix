export const PACKAGE_NAME = "@agorix/studio-ui";
export type { HostBridge } from "./bridge.js";
export type { RenderBlock, RenderRow } from "./blockView.js";
export { dropPointFor, toRows } from "./blockView.js";
export { chordFromEvent, dragPayload, parseDragPayload } from "./drag.js";
export { Canvas, AgentZone } from "./Canvas.js";
export { Palette } from "./Palette.js";
export { Workbench, statusFor, type WorkbenchDensity } from "./Workbench.js";
export { mountWorkbench } from "./mount.js";
export { WORKBENCH_CSS } from "./styles.js";
export type { AgentUiState, SelectionState } from "./agentUi.js";
export {
  canvasHints,
  editOperation,
  fullSelection,
  initialAgentUi,
  reduceAgentUi,
  selectionInput,
  toggleOperation,
} from "./agentUi.js";
export { AgentPanel } from "./AgentPanel.js";
export { type StudioUiLocale } from "./i18n.js";
export {
  Panel,
  PanelDivider,
  PanelDock,
  PanelWorkArea,
  usePanelLayoutController,
  type PanelLayoutController,
  type PanelProps,
} from "./Panel.js";
export { PANEL_CSS } from "./panelStyles.js";
export {
  INITIAL_PANEL_LAYOUT,
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  loadPanelLayout,
  parsePanelLayout,
  reducePanelLayout,
  savePanelLayout,
  serializePanelLayout,
  zoomOf,
  type PanelLayoutAction,
  type PanelLayoutState,
} from "./panelLayout.js";
