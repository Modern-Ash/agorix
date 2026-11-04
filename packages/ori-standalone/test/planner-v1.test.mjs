import test from "node:test";
import assert from "node:assert/strict";
import { createEducationalPlan } from "../src/planner-v1.mjs";
import { buildEducationalContext } from "../src/context-builder.mjs";
import { V1ContractError } from "../src/contracts-v1.mjs";

const context = buildEducationalContext({sessionId:"synthetic",learningStage:"connect",capabilities:[],grants:[],attempts:0,hintsUsed:0});
for (const intent of ["help","repeat","turn","move","debug","unknown"]) {
  test("typed plan for " + intent, () => {
    const plan = createEducationalPlan(context,{intent});
    assert.equal(plan.schemaVersion,"ori/plan/v1");
    assert.ok(plan.steps.length >= 2 && plan.steps.length <= 8);
    assert.ok(Object.isFrozen(plan.steps));
    assert.ok(plan.steps.every(step => !Object.hasOwn(step,"tool")));
  });
}
test("debug without attempts asks for evidence first",()=>{
  assert.match(createEducationalPlan(context,{intent:"debug"}).steps[0].goal,/primera ejecución/);
});
test("no full solution before attempts and hints",()=>{
  const plan = createEducationalPlan(context,{intent:"move"});
  assert.ok(!plan.steps.some(s=>/propuesta pequeña/.test(s.goal)));
});
test("advanced hints may suggest review, not auto-apply",()=>{
  const progressed=buildEducationalContext({sessionId:"synthetic",learningStage:"connect",capabilities:[],grants:[],attempts:1,hintsUsed:2});
  assert.match(createEducationalPlan(progressed,{intent:"move"}).steps.at(-1).goal,/aprobación/);
});
test("unknown intent fails closed",()=>assert.throws(()=>createEducationalPlan(context,{intent:"shell"}),V1ContractError));
test("untrusted extra context rejected",()=>assert.throws(()=>createEducationalPlan({...context,message:"child text"},{intent:"help"}),V1ContractError));
test("plans do not mutate context",()=>{
  const snapshot=structuredClone(context);
  createEducationalPlan(context,{intent:"repeat"});
  assert.deepEqual(context,snapshot);
});
