/** Maps visual blocks to/from program-model; Blockly-specific identifiers do not leak into domain documents. */
export const PACKAGE_NAME = "@agorix/block-editor";

export type {
  BlockEditorAdapterErrorCode,
  BlockMappingEntry,
  BlockMappingKind,
  BlockNode,
  BlockScript,
  BlockType,
  BlockWorkspaceSnapshot,
  PlacementReason,
  ProgramToWorkspaceResult,
  WorkspaceToProgramResult,
} from "./adapter.js";
export {
  BlockEditorAdapterError,
  getCanonicalNodeIdForBlock,
  programToWorkspace,
  workspaceToProgram,
} from "./adapter.js";
export type {
  BlockEditorProjectionUpdate,
  StatementContainerPath,
  StatementLocation,
  WorkspaceChange,
} from "./changes.js";
export { applyWorkspaceChange, projectWorkspace } from "./changes.js";
export type {
  CanonicalTransaction,
  EditorHistory,
  EditorHistorySnapshot,
  RestoreResult,
  TransactionResult,
} from "./history.js";
export {
  DEFAULT_HISTORY_LIMIT,
  createEditorHistory,
  recordCanonicalTransaction,
  redoCanonicalTransaction,
  undoCanonicalTransaction,
} from "./history.js";
export type {
  BlockPlacement,
  ToolboxBlockDefinition,
  ToolboxSection,
  ToolboxSectionName,
} from "./vocabulary.js";
export {
  ACCESSIBILITY_LIMITATIONS,
  POC_BLOCK_DEFINITIONS,
  POC_TOOLBOX,
  TOOLBOX_SECTION_ORDER,
  canPlaceBlock,
  createDefaultBlock,
  createStarterWorkspace,
  getBlockDefinition,
} from "./vocabulary.js";
