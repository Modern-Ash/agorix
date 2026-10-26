import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createOriHostEvidenceAdapter } from "./oriHostEvidenceAdapter.js";
const oriRoot=process.env["ORI_REPO_PATH"];
const runnable=!!oriRoot && isAbsolute(oriRoot) &&
  existsSync(resolve(oriRoot,"examples/host-evidence-cli.mjs"));
if(oriRoot && !runnable)throw Error("ORI_REPO_PATH lacks host-evidence-cli.mjs");
const request={
  expectedSteps:2,
  hostContext:{attempts:1,capabilities:["inspectProgram","inspectTrace"],
    grants:["inspectProgram","inspectTrace"],hintsUsed:1,
    learningStage:"connect",sessionId:"synthetic"},
  intent:"move",programRevision:"a".repeat(64),
  snapshot:{allowedBlocks:["move","turn"]},
  trace:{steps:[{index:0,description:"Executed move"},{index:1,description:"Executed turn"}]}
};
describe.skipIf(!runnable)("real Ori host evidence CLI",()=>{
  it("produces a review-only proposal and matching receipt",async()=>{
    const run=createOriHostEvidenceAdapter({oriRoot:oriRoot!});
    const result=await run(request);
    expect(result.status).toBe("ready");
    expect(result.appliedChanges).toBe(false);
    expect(result.requiresLearnerApproval).toBe(true);
    expect(result.evidenceReceipt?.programRevision).toBe(request.programRevision);
    expect(result.evidenceReceipt?.digest).toMatch(/^[a-f0-9]{64}$/);
  },15000);
  it("rejects untrusted input without invoking Ori",async()=>{
    const run=createOriHostEvidenceAdapter({oriRoot:oriRoot!});
    expect((await run({...request,message:"private"})).status).toBe("unavailable");
  });
});
