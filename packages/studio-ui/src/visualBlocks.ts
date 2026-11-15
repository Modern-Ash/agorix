import { getBlockDefinition, type BlockType } from "@agorix/block-editor";

export type BlockTone =
  "start" | "motion" | "looks" | "sound" | "control" | "sensing" | "operators" | "variables";
export type BlockShape = "hat" | "stack" | "container" | "reporter";

const tones: Record<string, BlockTone> = {
  Start: "start",
  Move: "motion",
  Looks: "looks",
  Sound: "sound",
  "Repeat & Decide": "control",
  Check: "sensing",
  Operators: "operators",
  Variables: "variables",
};

export function visualBlock(type: BlockType): { tone: BlockTone; shape: BlockShape } {
  const definition = getBlockDefinition(type);
  const tone = tones[definition?.section ?? ""] ?? "variables";
  const shape: BlockShape =
    definition?.placement === "trigger"
      ? "hat"
      : definition?.placement === "expression"
        ? "reporter"
        : type.startsWith("control_repeat") || type.startsWith("control_if")
          ? "container"
          : "stack";
  return { tone, shape };
}

export function visualLabel(label: string): string {
  const concise = label.split("[")[0]?.trim() ?? "";
  return concise || label;
}
