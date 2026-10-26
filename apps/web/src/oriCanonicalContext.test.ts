import { describe, expect, it } from "vitest";
import { buildOriMinimalContext, deriveOriExecutionOutcome } from "./oriCanonicalContext.js";

describe("Ori canonical runtime outcome", () => {
  it("never invents execution before a run", () => {
    expect(buildOriMinimalContext({scriptCount:2,hintCount:0,hasRun:false,status:"unknown"}))
      .toEqual({scriptCount:2,hintCount:0,outcome:"not-run"});
  });
  it("maps completed to completed", () => {
    expect(deriveOriExecutionOutcome({hasRun:true,status:"completed"})).toBe("completed");
  });
  it("maps budget-exceeded to failure, never success", () => {
    expect(deriveOriExecutionOutcome({hasRun:true,status:"budget-exceeded"})).toBe("failed");
  });
  it("maps explicit stopped and unknown to stopped", () => {
    expect(deriveOriExecutionOutcome({hasRun:true,status:"stopped"})).toBe("stopped");
    expect(deriveOriExecutionOutcome({hasRun:true,status:"unknown"})).toBe("stopped");
  });
  it("minimizes data and bounds counts", () => {
    expect(buildOriMinimalContext({scriptCount:99999,hintCount:-1,hasRun:true,status:"completed"}))
      .toEqual({scriptCount:1000,hintCount:0,outcome:"completed"});
  });
});
