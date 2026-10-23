export type KidsShortcutAction = "undo" | "redo" | "delete" | "duplicate" | "run" | "help";

export const KIDS_SHORTCUTS = [
  { id: "undo", key: "Ctrl/Cmd+Z" },
  { id: "redo", key: "Ctrl/Cmd+Shift+Z / Ctrl+Y" },
  { id: "delete", key: "Delete" },
  { id: "duplicate", key: "Ctrl/Cmd+D" },
  { id: "run", key: "Space (stage)" },
  { id: "help", key: "?" },
] as const satisfies readonly { id: KidsShortcutAction; key: string }[];

export function kidsShortcut(
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "isComposing" | "target"
  >,
  modalOpen: boolean,
): KidsShortcutAction | null {
  if (modalOpen || event.isComposing || event.altKey) return null;
  const target = event.target;
  if (
    target &&
    typeof (target as Element).closest === "function" &&
    ((target as Element).closest("input, textarea, select, [contenteditable='true']") ||
      (target as Element).closest("[role='dialog']"))
  )
    return null;
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (modifier && key === "z") return event.shiftKey ? "redo" : "undo";
  if (modifier && key === "y") return "redo";
  if (modifier && key === "d" && !event.shiftKey) return "duplicate";
  if (modifier || (event.shiftKey && key !== "?") || event.altKey) return null;
  if (key === "delete" || key === "backspace") return "delete";
  if (key === " " || key === "spacebar") return "run";
  if (key === "?" || key === "/") return "help";
  return null;
}
