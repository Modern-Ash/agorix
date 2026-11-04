import test from "node:test";
import assert from "node:assert/strict";
import {runEvidenceGatedAgent} from "../src/evidence-gated-agent.mjs";
const hostContext={sessionId:"synthetic",learningStage:"connect",
  capabilities:["inspectProgram","inspectTrace"],grants:["inspectProgram","inspectTrace"],
  attempts:1,hintsUsed:1};
const snapshot={allowedBlocks:["move","turn"]};
const trace={steps:[{index:0,description:"one"},{index:1,description:"two"}]};
test("reads each host port once and permits reviewed proposal with complete evidence",async()=>{
  let programs=0,traces=0;
  const result=await runEvidenceGatedAgent({hostContext,intent:"move",expectedSteps:2,
    tools:{inspectProgram:async()=>{programs++;return snapshot;},
      inspectTrace:async()=>{traces++;return trace;}}});
  assert.equal(programs,1);
  assert.equal(traces,1);
  assert.equal(result.simulation.complete,true);
  assert.equal(result.proposal.blocks[0].kind,"move");
  assert.equal(result.appliedChanges,false);
});
test("cannot re-read changing evidence after planning",async()=>{
  let calls=0;
  const result=await runEvidenceGatedAgent({hostContext,intent:"move",expectedSteps:2,
    tools:{inspectProgram:async()=>{calls++;return calls===1?snapshot:{allowedBlocks:[]};},
      inspectTrace:async()=>trace}});
  assert.equal(calls,1);
  assert.equal(result.proposal.blocks[0].kind,"move");
});
test("without trace permission no trace call occurs",async()=>{
  let traces=0;
  const result=await runEvidenceGatedAgent({
    hostContext:{...hostContext,grants:["inspectProgram"],capabilities:["inspectProgram"]},
    intent:"move",expectedSteps:2,
    tools:{inspectProgram:async()=>snapshot,inspectTrace:async()=>{traces++;return trace;}}});
  assert.equal(traces,0);
  assert.equal(result.proposal,null);
});
test("no complete evidence never authorizes a proposal",async()=>{
  const result=await runEvidenceGatedAgent({hostContext,intent:"move",expectedSteps:3,
    tools:{inspectProgram:async()=>snapshot,inspectTrace:async()=>trace}});
  assert.equal(result.proposal,null);
});
