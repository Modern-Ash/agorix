import type { BlockType } from "@agorix/block-editor";
import type { Intent } from "@agorix/interaction-core";

export type NumericReporter = Extract<Intent, { type: "setNumericInput" }>["reporter"];

const REPORTERS: Partial<Record<BlockType, NumericReporter>> = {
  literal_number: "number",
  variables_value: "variable",
  lists_length: "listLength",
  lists_item: "listItem",
  sensing_x_position: "xPosition",
  sensing_y_position: "yPosition",
  sensing_distance_to_actor: "distanceToActor",
  operator_add: "add",
  operator_subtract: "subtract",
  operator_multiply: "multiply",
  operator_divide: "divide",
  operator_modulo: "modulo",
  operator_random: "random",
  operator_random_integer: "randomInteger",
};

export function numericReporterForBlock(type: BlockType): NumericReporter | undefined {
  return REPORTERS[type];
}
