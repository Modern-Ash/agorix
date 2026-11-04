import test from "node:test";
import assert from "node:assert/strict";
import { buildEducationalContext } from "../src/context-builder.mjs";
import { createEducationalPlan } from "../src/planner-v1.mjs";
import { refineEducationalPlan } from "../src/plan-refinement-v1.mjs";
import { runEducationalAgent } from "../src/agent-loop-v1.mjs";
import { V1ContractError } from "../src/contracts-v1.mjs";

const makeContext=(attempts=1,grants=[])=>buildEducationalContext({sessionId:"synthetic",learningStage:"connect",capabilities:grants,grants,attempts,hintsUsed:0});
test("debug trace refines plan with evidence-driven questions",()=>{
  const ctx=makeContext();
  const result=refineEducationalPlan(ctx,createEducationalPlan(ctx,{intent:"debug"}),{intent:"debug",traceAvailable:true});
  assert.equal(result.reason,"host-trace-available");
  assert.match(result.plan.steps[0].goal,/traza verificada/);
  assert.equal(result.appliedChanges,false);
});
test("debug plan points to an observed step without repeating trace text",()=>{
  const ctx=makeContext();
  const result=refineEducationalPlan(ctx,createEducationalPlan(ctx,{intent:"debug"}),{
    intent:"debug",traceAvailable:true,traceStepCount:2
  });
  assert.match(result.plan.steps[0].goal,/paso 2/);
  assert.match(result.plan.steps[1].goal,/esperabas/);
  assert.equal(JSON.stringify(result.plan).includes("Executed move"),false);
});
test("missing evidence switches to clarification plan",()=>{
  const ctx=makeContext();
  const result=refineEducationalPlan(ctx,createEducationalPlan(ctx,{intent:"debug"}),{intent:"debug"});
  assert.equal(result.reason,"insufficient-evidence");
});
test("non-debug intent keeps original plan",()=>{
  const ctx=makeContext();
  const plan=createEducationalPlan(ctx,{intent:"move"});
  assert.deepEqual(refineEducationalPlan(ctx,plan,{intent:"move"}).plan,plan);
});
test("trace without attempt rejected",()=>{
  const ctx=makeContext(0);
  assert.throws(()=>refineEducationalPlan(ctx,createEducationalPlan(ctx,{intent:"debug"}),{intent:"debug",traceAvailable:true}),V1ContractError);
});
test("malformed evidence flag rejected",()=>{
  const ctx=makeContext();
  assert.throws(()=>refineEducationalPlan(ctx,createEducationalPlan(ctx),{traceAvailable:"yes"}),V1ContractError);
});
test("trace count must be bounded and backed by an available trace",()=>{
  const ctx=makeContext();
  const plan=createEducationalPlan(ctx,{intent:"debug"});
  for(const traceStepCount of [-1,1.5,101])
    assert.throws(()=>refineEducationalPlan(ctx,plan,{intent:"debug",traceAvailable:true,traceStepCount}),V1ContractError);
  assert.throws(()=>refineEducationalPlan(ctx,plan,{intent:"debug",traceStepCount:2}),V1ContractError);
});
test("loop integrates validated trace refinement",async()=>{
  const result=await runEducationalAgent({hostContext:{sessionId:"synthetic",learningStage:"connect",capabilities:["inspectTrace"],grants:["inspectTrace"],attempts:1,hintsUsed:0},intent:"debug",tools:{inspectTrace:()=>({steps:[{index:0,description:"synthetic"}]})}});
  assert.equal(result.refinementReason,"host-trace-available");
  assert.equal(result.appliedChanges,false);
});
test("loop forwards only the validated trace length into its debug plan",async()=>{
  const result=await runEducationalAgent({
    hostContext:{sessionId:"synthetic",learningStage:"connect",capabilities:["inspectTrace"],grants:["inspectTrace"],attempts:1,hintsUsed:0},
    intent:"debug",tools:{inspectTrace:()=>({steps:[{index:0,description:"private"},{index:1,description:"private"}]})}
  });
  assert.match(result.plan.steps[0].goal,/paso 2/);
  assert.equal(JSON.stringify(result.plan).includes("private"),false);
});
test("loop does not invent trace when none is returned",async()=>{
  const result=await runEducationalAgent({hostContext:{sessionId:"synthetic",learningStage:"connect",capabilities:["inspectTrace"],grants:["inspectTrace"],attempts:1,hintsUsed:0},intent:"debug",tools:{inspectTrace:()=>null}});
  assert.equal(result.refinementReason,"insufficient-evidence");
});
