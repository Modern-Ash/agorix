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
    type: "event_on_backdrop_switch",
    label: "When backdrop switches",
    section: "Start",
    placement: "trigger",
    accessibleName: "when backdrop switches",
    createDefaultBlock: (id) => ({
      id,
      type: "event_on_backdrop_switch",
      fields: { backdropId: "backdrop:forest" },
    }),
  },
  {
    type: "event_on_clone_start",
    label: "When I start as a clone",
    section: "Start",
    placement: "trigger",
    accessibleName: "when I start as a clone",
    createDefaultBlock: (id) => ({ id, type: "event_on_clone_start" }),
  },
  {
    type: "event_on_loudness_over",
    label: "When loud",
    section: "Start",
    placement: "trigger",
    accessibleName: "when the loudness goes over a level",
    createDefaultBlock: (id) => ({
      id,
      type: "event_on_loudness_over",
      fields: { level: 30 },
    }),
  },
  {
    type: "event_on_timer_over",
    label: "When time passes",
    section: "Start",
    placement: "trigger",
    accessibleName: "when seconds have passed",
    createDefaultBlock: (id) => ({
      id,
      type: "event_on_timer_over",
      fields: { seconds: 3 },
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
    type: "motion_go_to",
    label: "Go to [X, Y]",
    section: "Move",
    placement: "statement",
    accessibleName: "go to coordinates",
    createDefaultBlock: (id) => ({ id, type: "motion_go_to", fields: { x: 0, y: 0 } }),
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
    type: "sound_set_volume",
    label: "Set volume to [N]",
    section: "Sound",
    placement: "statement",
    accessibleName: "set volume",
    createDefaultBlock: (id) => ({ id, type: "sound_set_volume", fields: { volume: 100 } }),
  },
  {
    type: "sound_change_volume",
    label: "Change volume by [N]",
    section: "Sound",
    placement: "statement",
    accessibleName: "change volume",
    createDefaultBlock: (id) => ({ id, type: "sound_change_volume", fields: { delta: -10 } }),
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
    type: "control_forever",
    label: "Forever (bounded)",
    section: "Repeat & Decide",
    placement: "statement",
    accessibleName: "forever bounded loop",
    createDefaultBlock: (id) => ({
      id,
      type: "control_forever",
      inputs: { body: [createDefaultBlock("motion_move", `${id}:move`)] },
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
    type: "control_stop",
    label: "Stop [script / actor / scene]",
    section: "Repeat & Decide",
    placement: "statement",
    accessibleName: "stop program",
    createDefaultBlock: (id) => ({ id, type: "control_stop", fields: { scope: "script" } }),
  },
  {
    type: "control_ask_choice",
    label: "Ask a bundled choice",
    section: "Repeat & Decide",
    placement: "statement",
    accessibleName: "ask a choice",
    createDefaultBlock: (id) => ({
      id,
      type: "control_ask_choice",
      fields: { promptId: "path", variableId: "score" },
    }),
  },
  {
    type: "control_ask_text",
    label: "Ask for a word",
    section: "Repeat & Decide",
    placement: "statement",
    accessibleName: "ask for a typed word",
    createDefaultBlock: (id) => ({
      id,
      type: "control_ask_text",
      fields: { promptId: "word", variableId: "word" },
    }),
  },
  {
    type: "control_wait_until",
    label: "Wait until ___",
    section: "Repeat & Decide",
    placement: "statement",
    accessibleName: "wait until condition",
    createDefaultBlock: (id) => ({
      id,
      type: "control_wait_until",
      inputs: { condition: createDefaultBlock("sensing_touching_goal", `${id}:condition`) },
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
    type: "sensing_touching_actor",
    label: "Touching character?",
    section: "Check",
    placement: "expression",
    accessibleName: "touching character",
    createDefaultBlock: (id) => ({
      id,
      type: "sensing_touching_actor",
      fields: { actorId: "actor:main" },
    }),
  },
  {
    type: "sensing_touching_color",
    label: "Touching color?",
    section: "Check",
    placement: "expression",
    accessibleName: "touching a color",
    createDefaultBlock: (id) => ({
      id,
      type: "sensing_touching_color",
      fields: { color: "green" },
    }),
  },
  {
    type: "sensing_touching_stage_edge",
    label: "Touching stage edge?",
    section: "Check",
    placement: "expression",
    accessibleName: "touching stage edge",
    createDefaultBlock: (id) => ({
      id,
      type: "sensing_touching_stage_edge",
      fields: {
        minX: -240,
        maxX: 240,
        minY: -180,
        maxY: 180,
      },
    }),
  },
  {
    type: "sensing_distance_to_actor",
    label: "Distance to character",
    section: "Check",
    placement: "expression",
    accessibleName: "distance to character",
    createDefaultBlock: (id) => ({
      id,
      type: "sensing_distance_to_actor",
      fields: { actorId: "actor:main" },
    }),
  },
  {
    type: "sensing_x_position",
    label: "Horizontal position",
    section: "Check",
    placement: "expression",
    accessibleName: "horizontal position",
    createDefaultBlock: (id) => ({ id, type: "sensing_x_position" }),
  },
  {
    type: "sensing_y_position",
    label: "Vertical position",
    section: "Check",
    placement: "expression",
    accessibleName: "vertical position",
    createDefaultBlock: (id) => ({ id, type: "sensing_y_position" }),
  },
  {
    type: "looks_size",
    label: "Size",
    section: "Check",
    placement: "expression",
    accessibleName: "size",
    createDefaultBlock: (id) => ({ id, type: "looks_size" }),
  },
  {
    type: "control_delete_this_clone",
    label: "Delete this clone",
    section: "Repeat & Decide",
    placement: "statement",
    accessibleName: "delete this clone",
    createDefaultBlock: (id) => ({ id, type: "control_delete_this_clone" }),
  },
  {
    type: "control_reset_timer",
    label: "Reset timer",
    section: "Repeat & Decide",
    placement: "statement",
    accessibleName: "reset timer",
    createDefaultBlock: (id) => ({ id, type: "control_reset_timer" }),
  },
  {
    type: "sensing_timer",
    label: "Timer",
    section: "Check",
    placement: "expression",
    accessibleName: "timer in seconds",
    createDefaultBlock: (id) => ({ id, type: "sensing_timer" }),
  },
  {
    type: "sensing_key_down",
    label: "Key [K] is down",
    section: "Check",
    placement: "expression",
    accessibleName: "key is down",
    createDefaultBlock: (id) => ({
      id,
      type: "sensing_key_down",
      fields: { key: "Space" },
    }),
  },
  {
    type: "sensing_loudness",
    label: "Loudness",
    section: "Check",
    placement: "expression",
    accessibleName: "loudness, from 0 to 100",
    createDefaultBlock: (id) => ({ id, type: "sensing_loudness" }),
  },
  {
    type: "sensing_current_time",
    label: "Current [part] of the clock",
    section: "Check",
    placement: "expression",
    accessibleName: "a part of the clock now, as a number",
    createDefaultBlock: (id) => ({
      id,
      type: "sensing_current_time",
      fields: { part: "hour" },
    }),
  },
  {
    type: "sensing_mouse_x",
    label: "Mouse X",
    section: "Check",
    placement: "expression",
    accessibleName: "mouse horizontal position",
    createDefaultBlock: (id) => ({ id, type: "sensing_mouse_x" }),
  },
  {
    type: "sensing_mouse_y",
    label: "Mouse Y",
    section: "Check",
    placement: "expression",
    accessibleName: "mouse vertical position",
    createDefaultBlock: (id) => ({ id, type: "sensing_mouse_y" }),
  },
  {
    type: "sensing_mouse_down",
    label: "Mouse is down",
    section: "Check",
    placement: "expression",
    accessibleName: "mouse is down",
    createDefaultBlock: (id) => ({ id, type: "sensing_mouse_down" }),
  },
  {
    type: "pen_down",
    label: "Pen down",
    section: "Looks",
    placement: "statement",
    accessibleName: "pen down",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "pen_down" }),
  },
  {
    type: "pen_up",
    label: "Pen up",
    section: "Looks",
    placement: "statement",
    accessibleName: "pen up",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "pen_up" }),
  },
  {
    type: "pen_clear",
    label: "Clear pen",
    section: "Looks",
    placement: "statement",
    accessibleName: "clear pen",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "pen_clear" }),
  },
  {
    type: "pen_stamp",
    label: "Stamp",
    section: "Looks",
    placement: "statement",
    accessibleName: "stamp",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "pen_stamp" }),
  },
  {
    type: "pen_set_color",
    label: "Pen color [C]",
    section: "Looks",
    placement: "statement",
    accessibleName: "set pen color",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "pen_set_color", fields: { color: "dark" } }),
  },
  {
    type: "pen_set_size",
    label: "Pen size [N]",
    section: "Looks",
    placement: "statement",
    accessibleName: "set pen size",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "pen_set_size", fields: { size: 4 } }),
  },
  {
    type: "pen_set_transparency",
    label: "Pen transparency [N]",
    section: "Looks",
    placement: "statement",
    accessibleName: "set pen transparency",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "pen_set_transparency", fields: { percent: 50 } }),
  },
  {
    type: "pen_set_shade",
    label: "Pen shade [S]",
    section: "Looks",
    placement: "statement",
    accessibleName: "set pen shade",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "pen_set_shade", fields: { shade: "darker" } }),
  },
  {
    type: "music_play_note",
    label: "Play note [N] for [B] beats",
    section: "Looks",
    placement: "statement",
    accessibleName: "play note",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "music_play_note", fields: { note: 60, beats: 1 } }),
  },
  {
    type: "music_play_drum",
    label: "Play drum [D] for [B] beats",
    section: "Looks",
    placement: "statement",
    accessibleName: "play drum",
    legacy: true,
    createDefaultBlock: (id) => ({
      id,
      type: "music_play_drum",
      fields: { drum: "kick", beats: 1 },
    }),
  },
  {
    type: "music_set_instrument",
    label: "Instrument [I]",
    section: "Looks",
    placement: "statement",
    accessibleName: "set instrument",
    legacy: true,
    createDefaultBlock: (id) => ({
      id,
      type: "music_set_instrument",
      fields: { instrument: "piano" },
    }),
  },
  {
    type: "music_set_tempo",
    label: "Tempo [N]",
    section: "Looks",
    placement: "statement",
    accessibleName: "set tempo",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "music_set_tempo", fields: { bpm: 120 } }),
  },
  {
    type: "music_set_pitch",
    label: "Pitch [N]",
    section: "Looks",
    placement: "statement",
    accessibleName: "set pitch",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "music_set_pitch", fields: { semitones: 0 } }),
  },
  {
    type: "music_set_pan",
    label: "Pan [N]",
    section: "Looks",
    placement: "statement",
    accessibleName: "set pan",
    legacy: true,
    createDefaultBlock: (id) => ({ id, type: "music_set_pan", fields: { pan: 0 } }),
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
    type: "text_literal",
    label: "word",
    section: "Variables",
    placement: "expression",
    accessibleName: "word",
    createDefaultBlock: (id) => ({ id, type: "text_literal", fields: { value: "hello" } }),
  },
  {
    type: "text_variable",
    label: "word variable",
    section: "Variables",
    placement: "expression",
    accessibleName: "word variable value",
    createDefaultBlock: (id) => ({ id, type: "text_variable", fields: { variableId: "word" } }),
  },
  {
    type: "text_join",
    label: "join [A] [B]",
    section: "Variables",
    placement: "expression",
    accessibleName: "join words",
    createDefaultBlock: (id) => ({
      id,
      type: "text_join",
      inputs: {
        left: { id: `${id}:left`, type: "text_literal", fields: { value: "hello " } },
        right: { id: `${id}:right`, type: "text_literal", fields: { value: "world" } },
      },
    }),
  },
  {
    type: "text_length",
    label: "length of [A]",
    section: "Variables",
    placement: "expression",
    accessibleName: "length of word",
    createDefaultBlock: (id) => ({
      id,
      type: "text_length",
      inputs: { value: { id: `${id}:value`, type: "text_literal", fields: { value: "hello" } } },
    }),
  },
  {
    type: "text_letter_of",
    label: "letter [N] of [A]",
    section: "Variables",
    placement: "expression",
    accessibleName: "letter of word",
    createDefaultBlock: (id) => ({
      id,
      type: "text_letter_of",
      inputs: {
        index: { id: `${id}:index`, type: "literal_number", fields: { value: 1 } },
        value: { id: `${id}:value`, type: "text_literal", fields: { value: "hello" } },
      },
    }),
  },
  {
    type: "text_contains",
    label: "[A] contains [B]",
    section: "Check",
    placement: "expression",
    accessibleName: "word contains",
    createDefaultBlock: (id) => ({
      id,
      type: "text_contains",
      inputs: {
        left: { id: `${id}:left`, type: "text_literal", fields: { value: "hello" } },
        right: { id: `${id}:right`, type: "text_literal", fields: { value: "h" } },
      },
    }),
  },
  {
    type: "text_set",
    label: "Set word to [A]",
    section: "Variables",
    placement: "statement",
    accessibleName: "set word variable",
    createDefaultBlock: (id) => ({
      id,
      type: "text_set",
      fields: { variableId: "word" },
      inputs: { value: { id: `${id}:value`, type: "text_literal", fields: { value: "hello" } } },
    }),
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
