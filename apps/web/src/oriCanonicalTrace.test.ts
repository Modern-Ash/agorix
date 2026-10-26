import { describe, expect, it } from "vitest";
import type { RunResult } from "@agorix/runtime";
import { deriveOriTraceEvidence } from "./oriCanonicalTrace.js";

function fixture(outcome:RunResult["outcome"]="completed"):RunResult {
  return {
    outcome,stepsUsed:2,
    trace:[
      {step:1,statementType:"move",nodeId:"secret-1",worldBefore:{x:9},worldAfter:{x:10}},
      {step:2,statementType:"say",nodeId:"secret-2",worldBefore:{x:10},worldAfter:{x:10}},
    ],
    observations:[],world:{x:10},
  } as unknown as RunResult;
}
describe("Ori canonical trace evidence adapter",()=>{
  it("derives ordered bounded evidence without learner data",()=>{
    const value=deriveOriTraceEvidence(fixture());
    expect(value).toMatchObject({status:"ready",expectedSteps:2,appliedChanges:false});
    expect(value.evidence?.steps.map(step=>step.index)).toEqual([0,1]);
    const output=JSON.stringify(value);
    expect(output).not.toContain("secret-1");
    expect(output).not.toContain("worldBefore");
    expect(output).not.toContain("nodeId");
  });
  it("fails closed for incomplete traces",()=>{
    const value=fixture();
    const incomplete={...value,trace:value.trace.slice(0,1)};
    expect(deriveOriTraceEvidence(incomplete).status).toBe("unavailable");
  });
  it("does not treat stopped or budget-exceeded as verified completion",()=>{
    expect(deriveOriTraceEvidence(fixture("stopped")).status).toBe("unavailable");
    expect(deriveOriTraceEvidence(fixture("budget-exceeded")).status).toBe("unavailable");
  });
  it("rejects out of order steps",()=>{
    const value=fixture();
    expect(deriveOriTraceEvidence({...value,trace:[value.trace[1]!,value.trace[0]!]}).status)
      .toBe("unavailable");
  });
  it("rejects missing run and oversized execution",()=>{
    expect(deriveOriTraceEvidence(undefined).status).toBe("unavailable");
    expect(deriveOriTraceEvidence({...fixture(),stepsUsed:101}).status).toBe("unavailable");
  });
});
