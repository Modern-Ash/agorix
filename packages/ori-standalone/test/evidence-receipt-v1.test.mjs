import test from "node:test";
import assert from "node:assert/strict";
import {createEvidenceReceipt,assertCurrentProgramRevision} from "../src/evidence-receipt-v1.mjs";
import {runEvidenceGatedAgent} from "../src/evidence-gated-agent.mjs";
const revision="a".repeat(64);
const snapshot={allowedBlocks:["move","turn"]};
const trace={steps:[{index:0,description:"step one"},{index:1,description:"step two"}]};
const hostContext={sessionId:"synthetic",learningStage:"connect",
 capabilities:["inspectProgram","inspectTrace"],grants:["inspectProgram","inspectTrace"],attempts:1,hintsUsed:1};
test("receipt binds revision and normalized trace",()=>{
 const receipt=createEvidenceReceipt({snapshot,trace,expectedSteps:2,programRevision:revision});
 assert.equal(receipt.complete,true);
 assert.equal(receipt.digest.length,64);
 assert.equal(assertCurrentProgramRevision(receipt,revision),true);
 assert.throws(()=>assertCurrentProgramRevision(receipt,"b".repeat(64)));
});
test("rejects missing revision and incomplete evidence",()=>{
 assert.throws(()=>createEvidenceReceipt({snapshot,trace,expectedSteps:2}));
 assert.throws(()=>createEvidenceReceipt({snapshot,trace,expectedSteps:3,programRevision:revision}));
});
test("agent emits review receipt without editing",async()=>{
 const result=await runEvidenceGatedAgent({hostContext,intent:"move",expectedSteps:2,programRevision:revision,
  tools:{inspectProgram:async()=>snapshot,inspectTrace:async()=>trace}});
 assert.equal(result.evidenceReceipt.programRevision,revision);
 assert.equal(result.appliedChanges,false);
});
test("debug emits a revision-bound receipt but never requests or issues a proposal",async()=>{
 let providerCalls=0;
 const result=await runEvidenceGatedAgent({hostContext,intent:"debug",expectedSteps:2,programRevision:revision,
  tools:{inspectProgram:async()=>snapshot,inspectTrace:async()=>trace},
  providerRouter:{complete:async()=>{providerCalls++;return {fallback:false,message:"private"};}}});
 assert.equal(result.evidenceReceipt.programRevision,revision);
 assert.equal(result.evidenceReceipt.complete,true);
 assert.match(result.plan.steps[0].goal,/paso 2/);
 assert.equal(result.proposal,null);
 assert.equal(result.appliedChanges,false);
 assert.equal(providerCalls,0);
 const incomplete=await runEvidenceGatedAgent({hostContext,intent:"debug",expectedSteps:3,programRevision:revision,
  tools:{inspectProgram:async()=>snapshot,inspectTrace:async()=>trace}});
 assert.equal(incomplete.evidenceReceipt,null);
 assert.equal(incomplete.proposal,null);
 const beforeAttempt=await runEvidenceGatedAgent({hostContext:{...hostContext,attempts:0},
  intent:"debug",expectedSteps:2,programRevision:revision,
  tools:{inspectProgram:async()=>snapshot,inspectTrace:async()=>trace}});
 assert.equal(beforeAttempt.evidenceReceipt,undefined);
});
test("mutation after host observation cannot change receipt",async()=>{
 const original={allowedBlocks:["move","turn"]};
 const originalTrace={steps:[{index:0,description:"step one"},{index:1,description:"step two"}]};
 const result=await runEvidenceGatedAgent({hostContext,intent:"move",expectedSteps:2,programRevision:revision,
  tools:{inspectProgram:async()=>original,inspectTrace:async()=>originalTrace}});
 const digest=result.evidenceReceipt.digest;
 original.allowedBlocks.push("shell");
 originalTrace.steps[0].description="tampered";
 assert.equal(result.evidenceReceipt.digest,digest);
});
