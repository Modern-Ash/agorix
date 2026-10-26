import { describe, expect, it } from "vitest";
import { buildOriMinimalContext, deriveOriExecutionOutcome } from "./oriCanonicalContext.js";

describe("Ori canonical context privacy boundary", () => {
  it("does not invent an execution before running", () => {
    expect(buildOriMinimalContext({scriptCount:2,hintCount:0,hasRun:false,status:"unknown"}))
      .toEqual({scriptCount:2,hintCount:0,outcome:"not-run"});
  });
  it("does not infer successful execution from mere trace presence", () => {
    expect(deriveOriExecutionOutcome({hasRun:true,status:"unknown"})).toBe("stopped");
  });
  it("uses explicit trusted outcomes", () => {
    expect(deriveOriExecutionOutcome({hasRun:true,status:"failed"})).toBe("failed");
    expect(deriveOriExecutionOutcome({hasRun:true,status:"completed"})).toBe("completed");
  });
  it("bounds counts and never includes raw program or trace", () => {
    const value=buildOriMinimalContext({scriptCount:99999,hintCount:-3,hasRun:true,status:"unknown"});
    expect(value).toEqual({scriptCount:1000,hintCount:0,outcome:"stopped"});
    expect(Object.keys(value).sort()).toEqual(["hintCount","outcome","scriptCount"]);
  });
});
