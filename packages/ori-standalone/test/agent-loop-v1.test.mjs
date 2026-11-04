import test from "node:test";
import assert from "node:assert/strict";
import { runEducationalAgent, AgentLoopError } from "../src/agent-loop-v1.mjs";
import { V1ContractError } from "../src/contracts-v1.mjs";
const context=(grants=[],attempts=0)=>({sessionId:"synthetic",learningStage:"connect",capabilities:grants,grants,attempts,hintsUsed:0});
test("offline loop returns typed plan without tools",async()=>{
  const result=await runEducationalAgent({hostContext:context(),intent:"repeat"});
  assert.equal(result.plan.schemaVersion,"ori/plan/v1");
  assert.deepEqual(result.toolsUsed,[]);
  assert.equal(result.appliedChanges,false);
});
test("only authorized host reads are invoked",async()=>{
  let calls=0;
  const result=await runEducationalAgent({hostContext:context(["inspectProgram"]),intent:"move",tools:{inspectProgram:()=>{calls++;return {allowedBlocks:["move"]};}}});
  assert.equal(calls,1);
  assert.deepEqual(result.toolsUsed,["inspectProgram"]);
  assert.equal(result.evidenceAvailable.program,true);
});
test("trace is not requested without attempts",async()=>{
  let calls=0;
  const result=await runEducationalAgent({hostContext:context(["inspectTrace"]),intent:"debug",tools:{inspectTrace:()=>{calls++;return {steps:[]};}}});
  assert.equal(calls,0);
  assert.deepEqual(result.toolsUsed,[]);
});
test("trace uses host evidence after attempt",async()=>{
  const result=await runEducationalAgent({hostContext:context(["inspectTrace"],1),intent:"debug",tools:{inspectTrace:()=>({steps:[{index:0,description:"synthetic"}]})}});
  assert.equal(result.evidenceAvailable.trace,true);
});
test("unknown grant fails closed",async()=>assert.rejects(runEducationalAgent({hostContext:context(["shell"])}),V1ContractError));
test("invalid host evidence fails closed",async()=>assert.rejects(runEducationalAgent({hostContext:context(["inspectProgram"]),tools:{inspectProgram:()=>({allowedBlocks:[123]})}}),V1ContractError));
test("abort prevents tool execution",async()=>{
  const controller=new AbortController();controller.abort();
  let calls=0;
  await assert.rejects(runEducationalAgent({hostContext:context(["inspectProgram"]),signal:controller.signal,tools:{inspectProgram:()=>{calls++;return {allowedBlocks:[]};}}}),AgentLoopError);
  assert.equal(calls,0);
});
test("invalid step budget rejected",async()=>assert.rejects(runEducationalAgent({hostContext:context(),maxSteps:5}),AgentLoopError));
test("invalid intent rejected",async()=>assert.rejects(runEducationalAgent({hostContext:context(),intent:"execute-shell"}),AgentLoopError));
test("malformed context rejected",async()=>assert.rejects(runEducationalAgent({hostContext:{...context(),message:"child text"}}),V1ContractError));
