import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGREEMENTS,
  canShowHelp,
  canUseCompanionAction,
  highestHelpKind,
  type AssistanceLevel,
} from "./index.js";

const at = (assistanceCeiling: AssistanceLevel) => ({ ...DEFAULT_AGREEMENTS, assistanceCeiling });

describe("assistance ceiling", () => {
  it("allows exactly the kinds of the hint ladder up to the ceiling", () => {
    expect(highestHelpKind(at(0))).toBeUndefined();
    expect(highestHelpKind(at(1))).toBe("question");
    expect(highestHelpKind(at(2))).toBe("concept");
    expect(highestHelpKind(at(3))).toBe("pointer");
    expect(highestHelpKind(at(4))).toBe("proposal");
    expect(highestHelpKind(at(5))).toBe("proposal");
    expect(canShowHelp(at(3), "pointer")).toBe(true);
    expect(canShowHelp(at(3), "proposal")).toBe(false);
    expect(canShowHelp(at(0), "question")).toBe(false);
  });

  it("maps every Companion action to the help it needs", () => {
    const allowed = (level: AssistanceLevel) =>
      (["challenge", "reflect", "explain", "debug", "build"] as const).filter((action) =>
        canUseCompanionAction(at(level), action),
      );
    expect(allowed(0)).toEqual([]);
    expect(allowed(1)).toEqual(["challenge", "reflect"]);
    expect(allowed(2)).toEqual(["challenge", "reflect", "explain"]);
    expect(allowed(3)).toEqual(["challenge", "reflect", "explain", "debug"]);
    expect(allowed(4)).toHaveLength(5);
  });
});
