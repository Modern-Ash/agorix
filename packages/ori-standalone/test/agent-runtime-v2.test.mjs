import test from "node:test";
import assert from "node:assert/strict";
import { runEducationalAgentV2 } from "../src/agent-runtime-v2.mjs";

const hostContext={
  sessionId:"synthetic-v2",learningStage:"connect",
  capabilities:["inspectProgram","inspectTrace"],
  grants:["inspectProgram","inspectTrace"],attempts:1,hintsUsed:1
};
const tools={
  inspectProgram:async()=>({allowedBlocks:["move","turn"]}),
  inspectTrace:async()=>({steps:[{index:0,description:"El personaje no avanzó"}]})
};
test("v2 uses verified host evidence and creates review-only proposal",async()=>{
  const result=await runEducationalAgentV2({hostContext,intent:"move",tools});
  assert.equal(result.schemaVersion,"ori/agent-result/v2");
  assert.equal(result.evidenceAvailable.program,true);
  assert.equal(result.proposal.blocks[0].kind,"move");
  assert.equal(result.appliedChanges,false);
  assert.equal(result.proposalDecision,"pending-host-review");
});
test("v2 never proposes before learner attempt",async()=>{
  const result=await runEducationalAgentV2({
    hostContext:{...hostContext,attempts:0,hintsUsed:0},intent:"move",tools
  });
  assert.equal(result.proposal,null);
});
test("v2 refuses unapproved block kind",async()=>{
  const result=await runEducationalAgentV2({
    hostContext,intent:"turn",tools:{...tools,inspectProgram:async()=>({allowedBlocks:["move"]})}
  });
  assert.equal(result.proposal,null);
});
test("v2 does not inspect tools without host grants",async()=>{
  let called=0;
  const result=await runEducationalAgentV2({
    hostContext:{...hostContext,grants:[],capabilities:[]},intent:"move",
    tools:{inspectProgram:async()=>{called++;return tools.inspectProgram();}}
  });
  assert.equal(called,0);
  assert.equal(result.proposal,null);
});
test("v2 rejects invalid host snapshots",async()=>await assert.rejects(
  runEducationalAgentV2({hostContext,intent:"move",
    tools:{...tools,inspectProgram:async()=>({allowedBlocks:["shell command!"]})}})
));
test("v2 supports cancellation",async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(runEducationalAgentV2({hostContext,intent:"move",tools,signal:controller.signal}));
});

test("v2 ignores unsupported but syntactically valid block kinds",async()=>{
 const result=await runEducationalAgentV2({hostContext,intent:"move",tools:{...tools,inspectProgram:async()=>({allowedBlocks:["shell"]})}});
 assert.equal(result.proposal,null);
 assert.equal(result.appliedChanges,false);
});
