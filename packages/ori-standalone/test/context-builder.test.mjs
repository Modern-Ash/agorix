import test from "node:test";
import assert from "node:assert/strict";
import { buildEducationalContext } from "../src/context-builder.mjs";
import { V1ContractError } from "../src/contracts-v1.mjs";

const base = {sessionId:"synthetic-01",learningStage:"connect",capabilities:["inspectProgram"],grants:["inspectProgram"],attempts:1,hintsUsed:0};
test("constructs a frozen context from synthetic host input", () => {
  const result = buildEducationalContext(base);
  assert.equal(result.schemaVersion,"ori/context/v1");
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.grants));
  assert.notEqual(result.grants,base.grants);
});
test("does not mutate host input", () => {
  const before = structuredClone(base);
  buildEducationalContext(base);
  assert.deepEqual(base,before);
});
for (const key of ["message","prompt","email","childId","identity","token","program","trace","project","personalData"]) {
  test("rejects sensitive input " + key,()=>assert.throws(()=>buildEducationalContext({...base,[key]:"sensitive"}),V1ContractError));
}
test("rejects unknown host fields",()=>assert.throws(()=>buildEducationalContext({...base,unexpected:"value"}),V1ContractError));
test("rejects unrecognized tool grant",()=>assert.throws(()=>buildEducationalContext({...base,capabilities:["shell"],grants:["shell"]}),V1ContractError));
test("rejects grant missing from capabilities",()=>assert.throws(()=>buildEducationalContext({...base,capabilities:[],grants:["inspectProgram"]}),V1ContractError));
test("rejects duplicate capabilities",()=>assert.throws(()=>buildEducationalContext({...base,capabilities:["inspectProgram","inspectProgram"]}),V1ContractError));
test("rejects oversized session metadata",()=>assert.throws(()=>buildEducationalContext({...base,sessionId:"x".repeat(9000)}),V1ContractError));
test("allows no grants for offline fallback",()=>assert.deepEqual(buildEducationalContext({...base,capabilities:[],grants:[]}).grants,[]));
