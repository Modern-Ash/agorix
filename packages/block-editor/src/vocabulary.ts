import type { BlockNode, BlockType, BlockWorkspaceSnapshot } from "./adapter.js";

export type ToolboxSectionName = "Start" | "Move" | "Repeat & Decide" | "Check";
export type BlockPlacement = "trigger" | "statement" | "expression";

export interface ToolboxBlockDefinition {
  readonly type: BlockType;
  readonly label: string;
  readonly section: ToolboxSectionName;
  readonly placement: BlockPlacement;
  readonly accessibleName: string;
  /** Kept so old projects load; never offered in the toolbox. */
  readonly legacy?: boolean;
  readonly createDefaultBlock: (id: string) => BlockNode;
}

export interface ToolboxSection {
  readonly name: ToolboxSectionName;
  readonly blocks: readonly ToolboxBlockDefinition[];
}

export const TOOLBOX_SECTION_ORDER: readonly ToolboxSectionName[] = [
  "Start",
  "Move",
  "Repeat & Decide",
  "Check",
];

export const ACCESSIBILITY_LIMITATIONS = [
  "Stock Blockly drag-and-drop block placement has no built-in keyboard-only alternative in the POC.",
  "The spatial block-composition canvas is not fully screen-reader navigable in stock Blockly.",
] as const;

const definitions: readonly ToolboxBlockDefinition[] = [
  {
    type: "event_green_flag",
    label: "When green flag clicked",
    section: "Start",
    placement: "trigger",
    accessibleName: "when green flag clicked",
    createDefaultBlock: (id) => ({ id, type: "event_green_flag" }),
  },
  {
    type: "event_on_start",
    // Legacy hat of projects saved before green-flag scripts; it means the same event and is not offered.
    legacy: true,
    label: "When you press Run",
    section: "Start",
    placement: "trigger",
    accessibleName: "when run starts",
    createDefaultBlock: (id) => ({ id, type: "event_on_start" }),
  },
  {
    type: "motion_move",
    label: "Move [N] steps",
    section: "Move",
    placement: "statement",
    accessibleName: "move steps",
    createDefaultBlock: (id) => ({ id, type: "motion_move", fields: { steps: 10 } }),
  },
  {
    type: "motion_turn",
    label: "Turn [N] degrees",
    section: "Move",
    placement: "statement",
    accessibleName: "turn degrees",
    createDefaultBlock: (id) => ({ id, type: "motion_turn", fields: { degrees: 90 } }),
  },
  {
    type: "control_repeat",
    label: "Repeat [N] times",
    section: "Repeat & Decide",
    placement: "statement",
    accessibleName: "repeat times",
    createDefaultBlock: (id) => ({
      id,
      type: "control_repeat",
      fields: { count: 3 },
      inputs: { body: [] },
    }),
  },
  {
    type: "control_if",
    label: "If ___, then",
    section: "Repeat & Decide",
    placement: "statement",
    accessibleName: "if condition then",
    createDefaultBlock: (id) => ({
      id,
      type: "control_if",
      inputs: {
        condition: createDefaultBlock("sensing_touching_goal", `${id}:condition`),
        then: [],
      },
    }),
  },
  {
    type: "sensing_touching_goal",
    label: "Touching the goal?",
    section: "Check",
    placement: "expression",
    accessibleName: "touching the goal",
    createDefaultBlock: (id) => ({ id, type: "sensing_touching_goal" }),
  },
];

export const POC_BLOCK_DEFINITIONS = definitions;

export const POC_TOOLBOX: readonly ToolboxSection[] = TOOLBOX_SECTION_ORDER.map((name) => ({
  name,
  blocks: definitions.filter(
    (definition) => definition.section === name && definition.legacy !== true,
  ),
}));

export function getBlockDefinition(type: BlockType): ToolboxBlockDefinition | undefined {
  return definitions.find((definition) => definition.type === type);
}

export function createDefaultBlock(type: BlockType, id: string): BlockNode {
  const definition = getBlockDefinition(type);
  if (definition === undefined) {
    throw new Error(`Unsupported POC block type ${JSON.stringify(type)}`);
  }
  return definition.createDefaultBlock(id);
}

export function canPlaceBlock(type: BlockType, placement: BlockPlacement): boolean {
  return getBlockDefinition(type)?.placement === placement;
}

export function createStarterWorkspace(scriptId = "main"): BlockWorkspaceSnapshot {
  return {
    scripts: [
      {
        id: "block:scripts_0_",
        programId: scriptId,
        trigger: createDefaultBlock("event_green_flag", "block:scripts_0_trigger"),
        statements: [],
      },
    ],
  };
}
