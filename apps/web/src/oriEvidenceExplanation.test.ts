import { describe,expect,it } from "vitest";
import { explainOriEvidence } from "./oriEvidenceExplanation.js";
import type { OriTraceEnvelope } from "./oriCanonicalTrace.js";
const valid:OriTraceEnvelope={
  status:"ready",expectedSteps:3,appliedChanges:false,
  evidence:{steps:[
    {index:0,description:"Executed move"},
    {index:1,description:"Executed move"},
    {index:2,description:"Executed turn"}
  ]},
  operationCounts:{move:2,turn:1},outcome:"completed"
};
describe("Ori evidence-grounded explanation",()=>{
  it("asks a question based on observed operation types",()=>{
    const result=explainOriEvidence(valid);
    expect(result.status).toBe("ready");
    expect(result.question).toContain("avanzó");
    expect(result.appliedChanges).toBe(false);
  });
  it("rejects count mismatches",()=>{
    expect(explainOriEvidence({...valid,operationCounts:{move:1}}).status).toBe("unavailable");
  });
  it("does not claim evidence for missing trace",()=>{
    expect(explainOriEvidence({status:"unavailable",appliedChanges:false}).status).toBe("unavailable");
  });
  it("rejects unsupported categories",()=>{
    expect(explainOriEvidence({...valid,operationCounts:{shell:3}}).status).toBe("unavailable");
  });
});
