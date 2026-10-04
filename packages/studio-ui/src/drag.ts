import type { DragSource, KeyChord } from "@agorix/interaction-core";

const KINDS = ["palette", "block", "evidence", "codeSelection", "proposal"];

export function dragPayload(source: DragSource): string {
  return JSON.stringify(source);
}

/** Structural check only; ids are validated again by resolveDrop and the host parser. */
export function parseDragPayload(raw: string): DragSource | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      KINDS.includes((value as { kind?: unknown }).kind as string)
    ) {
      return value as DragSource;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function chordFromEvent(event: { altKey: boolean; key: string }): KeyChord | undefined {
  if (event.altKey && event.key === "ArrowUp") return "Alt+ArrowUp";
  if (event.altKey && event.key === "ArrowDown") return "Alt+ArrowDown";
  if (!event.altKey && event.key === "Delete") return "Delete";
  return undefined;
}
