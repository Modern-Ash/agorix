import test from "node:test";
import assert from "node:assert/strict";
import { runEducationalAgent,AgentLoopError } from "../src/agent-loop-v1.mjs";
const hostContext={sessionId:"synthetic",learningStage:"connect",capabilities:["inspectProgram"],grants:["inspectProgram"],attempts:1,hintsUsed:0};
test("unresponsive host tool cannot hold agent indefinitely",async()=>{
  const started=Date.now();
  await assert.rejects(runEducationalAgent({hostContext,deadlineMs:30,tools:{inspectProgram:()=>new Promise(()=>{})}}),AgentLoopError);
  assert.ok(Date.now()-started<1000);
});
test("abort during in-flight read rejects promptly",async()=>{
  const controller=new AbortController();
  const pending=runEducationalAgent({hostContext,deadlineMs:2000,signal:controller.signal,tools:{inspectProgram:()=>new Promise(()=>{})}});
  controller.abort();
  await assert.rejects(pending,AgentLoopError);
});
test("late tool response is never returned as evidence",async()=>{
  let resolveRead;
  const pending=runEducationalAgent({hostContext,deadlineMs:20,tools:{inspectProgram:()=>new Promise(resolve=>{resolveRead=resolve;})}});
  await assert.rejects(pending,AgentLoopError);
  resolveRead({allowedBlocks:["move"]});
});
test("invalid deadline rejected",async()=>assert.rejects(runEducationalAgent({hostContext,deadlineMs:10001}),AgentLoopError));
test("successful read still works",async()=>{
  const result=await runEducationalAgent({hostContext,tools:{inspectProgram:()=>({allowedBlocks:["move"]})}});
  assert.equal(result.evidenceAvailable.program,true);
  assert.equal(result.appliedChanges,false);
});
