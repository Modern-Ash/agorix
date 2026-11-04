import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { executeHostEvidenceRequest } from "../src/host-evidence-bridge.mjs";
import { createProviderRouter } from "../src/providers.mjs";
const base={
  expectedSteps:2,
  hostContext:{attempts:1,capabilities:["inspectProgram","inspectTrace"],
    grants:["inspectProgram","inspectTrace"],hintsUsed:1,
    learningStage:"connect",sessionId:"synthetic"},
  intent:"move",programRevision:"a".repeat(64),
  snapshot:{allowedBlocks:["move","turn"]},
  trace:{steps:[{index:0,description:"Executed move"},{index:1,description:"Executed turn"}]}
};
test("host evidence generates a revision-bound review-only proposal",async()=>{
 const value=await executeHostEvidenceRequest(base);
 assert.equal(value.schemaVersion,"ori/host-evidence-response/v1");
 assert.equal(value.proposal.blocks[0].kind,"move");
 assert.equal(value.evidenceReceipt.programRevision,base.programRevision);
 assert.equal(value.appliedChanges,false);
});
test("host debug plan references only the verified step number",async()=>{
 const value=await executeHostEvidenceRequest({...base,intent:"debug"});
 assert.match(value.plan.steps[0].goal,/paso 2/);
 assert.equal(JSON.stringify(value.plan).includes("Executed move"),false);
 assert.equal(value.proposal,null);
 assert.equal(value.evidenceReceipt.programRevision,base.programRevision);
 assert.equal(value.appliedChanges,false);
});
test("no proposal before learner attempt",async()=>{
 const value=await executeHostEvidenceRequest({...base,hostContext:{...base.hostContext,attempts:0,hintsUsed:0}});
 assert.equal(value.proposal,null);
});
test("routed model may suggest one validated block after complete host evidence",async()=>{
 let request;
 const router=createProviderRouter({preferred:["local"],providers:{local:{
  async complete(value){request=value;return {message:JSON.stringify({
   schemaVersion:"ori/proposal/v0",operation:"append",requiresLearnerApproval:true,
   blocks:[{kind:"move",steps:3}]
  })};}
 }}});
 const value=await executeHostEvidenceRequest(base,{providerRouter:router});
 assert.equal(value.proposal.blocks[0].steps,3);
 assert.equal(value.evidenceReceipt.complete,true);
 assert.equal(request.traceStepCount,2);
 assert.deepEqual(request.allowedBlocks,["move","turn"]);
 assert.equal(JSON.stringify(request).includes("Executed"),false);
 assert.equal(value.appliedChanges,false);
});
test("model cannot bypass evidence or proposal validation",async()=>{
 let calls=0;
 const router={async complete(){calls++;return {fallback:false,message:JSON.stringify({
  schemaVersion:"ori/proposal/v0",operation:"append",requiresLearnerApproval:true,
  blocks:[{kind:"turn",direction:"left"}]
 })};}};
 const blocked=await executeHostEvidenceRequest({...base,hostContext:{...base.hostContext,attempts:0,hintsUsed:0}},{providerRouter:router});
 assert.equal(blocked.proposal,null);
 assert.equal(calls,0);
 const value=await executeHostEvidenceRequest(base,{providerRouter:router});
 assert.equal(value.proposal.blocks[0].kind,"move");
 assert.equal(value.proposal.blocks[0].steps,1);
 assert.equal(calls,1);
});
test("provider failure keeps the bounded deterministic proposal",async()=>{
 const value=await executeHostEvidenceRequest(base,{providerRouter:{
  async complete(){throw Error("provider unavailable");}
 }});
 assert.deepEqual(value.proposal.blocks,[{kind:"move",steps:1}]);
 assert.equal(value.evidenceReceipt.complete,true);
 assert.equal(value.appliedChanges,false);
});
test("rejects raw learner data and forged extra host fields",async()=>{
 await assert.rejects(executeHostEvidenceRequest({...base,message:"child"}));
 await assert.rejects(executeHostEvidenceRequest({...base,hostContext:{...base.hostContext,program:"secret"}}));
});
test("rejects missing grants and incomplete trace",async()=>{
 await assert.rejects(executeHostEvidenceRequest({...base,hostContext:{...base.hostContext,grants:["inspectProgram"]}}));
 await assert.rejects(executeHostEvidenceRequest({...base,expectedSteps:3}));
});
test("real CLI returns only review metadata",()=>{
 const r=spawnSync(process.execPath,["examples/host-evidence-cli.mjs"],{input:JSON.stringify(base),encoding:"utf8",timeout:7000});
 assert.equal(r.status,0,r.stderr);
 const value=JSON.parse(r.stdout);
 assert.equal(value.appliedChanges,false);
 assert.equal(value.evidenceReceipt.programRevision,base.programRevision);
 assert.equal(r.stdout.includes("synthetic"),false);
});
test("real CLI fails closed on unsupported intent",()=>{
 const r=spawnSync(process.execPath,["examples/host-evidence-cli.mjs"],{input:JSON.stringify({...base,intent:"shell"}),encoding:"utf8",timeout:7000});
 assert.notEqual(r.status,0);
 assert.equal(r.stdout,"");
});
