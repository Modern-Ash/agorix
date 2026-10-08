import type { BlockNode, BlockType, BlockWorkspaceSnapshot } from "./adapter.js";

export type ToolboxSectionName =
  "Start" | "Move" | "Looks" | "Sound" | "Repeat & Decide" | "Check" | "Operators" | "Variables";
export type BlockPlacement = "trigger" | "statement" | "expression";

export interface ToolboxBlockDefinition {
  readonly type: BlockType;
  readonly label: string;
  readonly section: ToolboxSectionName;
  readonly placement: BlockPlacement;
  readonly accessibleName: string;
  readonly createDefaultBlock: (id: string) => BlockNode;
}

export interface ToolboxSection {
  readonly name: ToolboxSectionName;
  readonly blocks: readonly ToolboxBlockDefinition[];
}

export const TOOLBOX_SECTION_ORDER: readonly ToolboxSectionName[] = [
  "Start",
  "Move",
  "Looks",
  "Sound",
  "Repeat & Decide",
  "Check",
  "Operators",
  "Variables",
];

export const ACCESSIBILITY_LIMITATIONS = [
  "Stock Blockly drag-and-drop block placement has no built-in keyboard-only alternative in the POC.",
  "The spatial block-composition canvas is not fully screen-reader navigable in stock Blockly.",
] as const;

const definitions: readonly ToolboxBlockDefinition[] = [
  {
    type: "event_on_start",
    label: "When you press Run",
    section: "Start",
    placement: "trigger",
    accessibleName: "when run starts",
    createDefaultBlock: (id) => ({ id, type: "event_on_start" }),
  },
  {
    type: "event_on_key_pressed",
    label: "When key pressed",
    section: "Start",
    placement: "trigger",
    accessibleName: "when key pressed",
    createDefaultBlock: (id) => ({ id, type: "event_on_key_pressed", fields: { key: "Space" } }),
  },
  {
    type: "event_on_actor_clicked",
    label: "When actor clicked",
    section: "Start",
    placement: "trigger",
    accessibleName: "when actor clicked",
    createDefaultBlock: (id) => ({ id, type: "event_on_actor_clicked" }),
  },
  {
    type: "event_on_message",
    label: "When message received",
    section: "Start",
    placement: "trigger",
    accessibleName: "when message received",
    createDefaultBlock: (id) => ({
      id,
      type: "event_on_message",
      fields: { message: "go" },
    }),
  },
  {
    type: "event_broadcast",
    label: "Broadcast message",
    section: "Start",
    placement: "statement",
    accessibleName: "broadcast message",
    createDefaultBlock: (id) => ({ id, type: "event_broadcast", fields: { message: "go" } }),
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
    type: "looks_say",
    label: "Say [text]",
    section: "Looks",
    placement: "statement",
    accessibleName: "say text",
    createDefaultBlock: (id) => ({ id, type: "looks_say", fields: { text: "Hello" } }),
  },
  {
    type: "looks_think",
    label: "Think [text]",
    section: "Looks",
    placement: "statement",
    accessibleName: "think text",
    createDefaultBlock: (id) => ({ id, type: "looks_think", fields: { text: "Hmm" } }),
  },
  {
    type: "looks_show",
    label: "Show",
    section: "Looks",
    placement: "statement",
    accessibleName: "show actor",
    createDefaultBlock: (id) => ({ id, type: "looks_show" }),
  },
  {
    type: "looks_hide",
    label: "Hide",
    section: "Looks",
    placement: "statement",
    accessibleName: "hide actor",
    createDefaultBlock: (id) => ({ id, type: "looks_hide" }),
  },
  {
    type: "looks_set_size",
    label: "Set size [N]",
    section: "Looks",
    placement: "statement",
    accessibleName: "set actor size",
    createDefaultBlock: (id) => ({ id, type: "looks_set_size", fields: { size: 100 } }),
  },
  {
    type: "looks_switch_costume",
    label: "Switch costume",
    section: "Looks",
    placement: "statement",
    accessibleName: "switch costume",
    createDefaultBlock: (id) => ({
      id,
      type: "looks_switch_costume",
      fields: { costumeId: "asset:costume.default" },
    }),
  },
  {
    type: "looks_switch_backdrop",
    label: "Switch backdrop",
    section: "Looks",
    placement: "statement",
    accessibleName: "switch backdrop",
    createDefaultBlock: (id) => ({
      id,
      type: "looks_switch_backdrop",
      fields: { backdropId: "asset:space.trailhead" },
    }),
  },
  {
    type: "sound_play",
    label: "Play sound",
    section: "Sound",
    placement: "statement",
    accessibleName: "play sound",
    createDefaultBlock: (id) => ({
      id,
      type: "sound_play",
      fields: { soundId: "asset:sound.beacon" },
    }),
  },
  {
    type: "sound_stop",
    label: "Stop sounds",
    section: "Sound",
    placement: "statement",
    accessibleName: "stop sounds",
    createDefaultBlock: (id) => ({ id, type: "sound_stop" }),
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
  {
    type: "operator_add",
    label: "[N] + [N]",
    section: "Operators",
    placement: "expression",
    accessibleName: "add numbers",
    createDefaultBlock: (id) => ({
      id,
      type: "operator_add",
      inputs: {
        left: createDefaultBlock("literal_number", `${id}:left`),
        right: { id: `${id}:right`, type: "literal_number", fields: { value: 1 } },
      },
    }),
  },
  {
    type: "operator_subtract",
    label: "[N] - [N]",
    section: "Operators",
    placement: "expression",
    accessibleName: "subtract numbers",
    createDefaultBlock: (id) => ({
      id,
      type: "operator_subtract",
      inputs: {
        left: createDefaultBlock("variables_value", `${id}:left`),
        right: { id: `${id}:right`, type: "literal_number", fields: { value: 1 } },
      },
    }),
  },
  {
    type: "operator_multiply",
    label: "[N] * [N]",
    section: "Operators",
    placement: "expression",
    accessibleName: "multiply numbers",
    createDefaultBlock: (id) => ({
      id,
      type: "operator_multiply",
      inputs: {
        left: createDefaultBlock("variables_value", `${id}:left`),
        right: { id: `${id}:right`, type: "literal_number", fields: { value: 2 } },
      },
    }),
  },
  {
    type: "operator_divide",
    label: "[N] / [N]",
    section: "Operators",
    placement: "expression",
    accessibleName: "divide numbers",
    createDefaultBlock: (id) => ({
      id,
      type: "operator_divide",
      inputs: {
        left: createDefaultBlock("variables_value", `${id}:left`),
        right: { id: `${id}:right`, type: "literal_number", fields: { value: 2 } },
      },
    }),
  },
  {
    type: "operator_less_than",
    label: "[N] < [N]",
    section: "Operators",
    placement: "expression",
    accessibleName: "less than",
    createDefaultBlock: (id) => ({
      id,
      type: "operator_less_than",
      inputs: {
        left: createDefaultBlock("variables_value", `${id}:left`),
        right: { id: `${id}:right`, type: "literal_number", fields: { value: 10 } },
      },
    }),
  },
  {
    type: "operator_greater_than",
    label: "[N] > [N]",
    section: "Operators",
    placement: "expression",
    accessibleName: "greater than",
    createDefaultBlock: (id) => ({
      id,
      type: "operator_greater_than",
      inputs: {
        left: createDefaultBlock("variables_value", `${id}:left`),
        right: { id: `${id}:right`, type: "literal_number", fields: { value: 10 } },
      },
    }),
  },
  {
    type: "operator_equals",
    label: "[N] = [N]",
    section: "Operators",
    placement: "expression",
    accessibleName: "equals",
    createDefaultBlock: (id) => ({
      id,
      type: "operator_equals",
      inputs: {
        left: createDefaultBlock("variables_value", `${id}:left`),
        right: { id: `${id}:right`, type: "literal_number", fields: { value: 10 } },
      },
    }),
  },
  {
    type: "operator_and",
    label: "[A] and [B]",
    section: "Operators",
    placement: "expression",
    accessibleName: "and",
    createDefaultBlock: (id) => ({
      id,
      type: "operator_and",
      inputs: {
        left: createDefaultBlock("sensing_touching_goal", `${id}:left`),
        right: createDefaultBlock("literal_boolean", `${id}:right`),
      },
    }),
  },
  {
    type: "operator_or",
    label: "[A] or [B]",
    section: "Operators",
    placement: "expression",
    accessibleName: "or",
    createDefaultBlock: (id) => ({
      id,
      type: "operator_or",
      inputs: {
        left: createDefaultBlock("sensing_touching_goal", `${id}:left`),
        right: createDefaultBlock("literal_boolean", `${id}:right`),
      },
    }),
  },
  {
    type: "operator_not",
    label: "not [A]",
    section: "Operators",
    placement: "expression",
    accessibleName: "not",
    createDefaultBlock: (id) => ({
      id,
      type: "operator_not",
      inputs: { value: createDefaultBlock("sensing_touching_goal", `${id}:value`) },
    }),
  },
  {
    type: "operator_random",
    label: "random [N] to [N]",
    section: "Operators",
    placement: "expression",
    accessibleName: "random number",
    createDefaultBlock: (id) => ({
      id,
      type: "operator_random",
      inputs: {
        min: { id: `${id}:min`, type: "literal_number", fields: { value: 1 } },
        max: { id: `${id}:max`, type: "literal_number", fields: { value: 10 } },
      },
    }),
  },
  {
    type: "variables_value",
    label: "score",
    section: "Variables",
    placement: "expression",
    accessibleName: "variable value",
    createDefaultBlock: (id) => ({ id, type: "variables_value", fields: { variableId: "score" } }),
  },
  {
    type: "variables_set",
    label: "Set score to [N]",
    section: "Variables",
    placement: "statement",
    accessibleName: "set variable",
    createDefaultBlock: (id) => ({
      id,
      type: "variables_set",
      fields: { variableId: "score" },
      inputs: { value: createDefaultBlock("literal_number", `${id}:value`) },
    }),
  },
  {
    type: "variables_change",
    label: "Change score by [N]",
    section: "Variables",
    placement: "statement",
    accessibleName: "change variable",
    createDefaultBlock: (id) => ({
      id,
      type: "variables_change",
      fields: { variableId: "score" },
      inputs: {
        delta: { id: `${id}:delta`, type: "literal_number", fields: { value: 1 } },
      },
    }),
  },
  {
    type: "variables_show",
    label: "Show score",
    section: "Variables",
    placement: "statement",
    accessibleName: "show variable",
    createDefaultBlock: (id) => ({
      id,
      type: "variables_show",
      fields: { variableId: "score" },
    }),
  },
  {
    type: "variables_hide",
    label: "Hide score",
    section: "Variables",
    placement: "statement",
    accessibleName: "hide variable",
    createDefaultBlock: (id) => ({
      id,
      type: "variables_hide",
      fields: { variableId: "score" },
    }),
  },
  {
    type: "literal_number",
    label: "[N]",
    section: "Operators",
    placement: "expression",
    accessibleName: "number",
    createDefaultBlock: (id) => ({ id, type: "literal_number", fields: { value: 0 } }),
  },
  {
    type: "literal_boolean",
    label: "true/false",
    section: "Operators",
    placement: "expression",
    accessibleName: "boolean",
    createDefaultBlock: (id) => ({ id, type: "literal_boolean", fields: { value: true } }),
  },
];

export const POC_BLOCK_DEFINITIONS = definitions;

export const POC_TOOLBOX: readonly ToolboxSection[] = TOOLBOX_SECTION_ORDER.map((name) => ({
  name,
  blocks: definitions.filter((definition) => definition.section === name),
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
        trigger: createDefaultBlock("event_on_start", "block:scripts_0_trigger"),
        statements: [],
      },
    ],
  };
}
