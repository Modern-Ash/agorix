import { describe, expect, it } from "vitest";
import { KIDS_SHORTCUTS, kidsShortcut } from "./kidsShortcuts.js";

function key(value: string, options: Partial<KeyboardEvent> = {}) {
  return {
    key: value,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    isComposing: false,
    target: null,
    ...options,
  } as KeyboardEvent;
}

describe("Kids shortcuts (#451)", () => {
  it("has one help entry per action and resolves each binding", () => {
    expect(new Set(KIDS_SHORTCUTS.map((item) => item.id)).size).toBe(KIDS_SHORTCUTS.length);
    expect(kidsShortcut(key("z", { ctrlKey: true }), false)).toBe("undo");
    expect(kidsShortcut(key("z", { metaKey: true, shiftKey: true }), false)).toBe("redo");
    expect(kidsShortcut(key("y", { ctrlKey: true }), false)).toBe("redo");
    expect(kidsShortcut(key("d", { ctrlKey: true }), false)).toBe("duplicate");
    expect(kidsShortcut(key("Delete"), false)).toBe("delete");
    expect(kidsShortcut(key(" "), false)).toBe("run");
    expect(kidsShortcut(key("?", { shiftKey: true }), false)).toBe("help");
  });
  it("ignores composition, modals and typing fields", () => {
    expect(kidsShortcut(key("z", { ctrlKey: true, isComposing: true }), false)).toBeNull();
    expect(kidsShortcut(key("z", { ctrlKey: true }), true)).toBeNull();
    const input = { closest: () => ({}) } as unknown as EventTarget;
    expect(kidsShortcut(key("d", { ctrlKey: true, target: input }), false)).toBeNull();
  });
});
