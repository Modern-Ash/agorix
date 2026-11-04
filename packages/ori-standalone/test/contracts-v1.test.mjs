import test from "node:test";
import assert from "node:assert/strict";
import { validateV1Envelope, V1ContractError } from "../src/contracts-v1.mjs";

const valid = {
  context: {schemaVersion:"ori/context/v1",sessionId:"synthetic-1",learningStage:"connect",capabilities:["inspectProgram"],grants:["inspectProgram"],attempts:1,hintsUsed:0},
  plan: {schemaVersion:"ori/plan/v1",steps:[{id:"observe",goal:"Inspect synthetic program"}]},
  "tool-call": {schemaVersion:"ori/tool-call/v1",name:"inspectProgram",grantId:"inspectProgram"},
  proposal: {schemaVersion:"ori/proposal/v1",operations:[{kind:"appendStatement",payload:{kind:"move"}}],requiresLearnerApproval:true},
  "trace-evidence": {schemaVersion:"ori/trace-evidence/v1",source:"host-runtime",steps:[{index:0,description:"synthetic step"}]},
  refusal: {schemaVersion:"ori/refusal/v1",reason:"out-of-scope"},
  error: {schemaVersion:"ori/error/v1",code:"TOOL_DENIED",retryable:false}
};
for (const [kind, value] of Object.entries(valid)) {
  test(kind + " accepts valid synthetic envelope", () => assert.deepEqual(validateV1Envelope(kind,value),value));
  test(kind + " rejects unknown fields", () => assert.throws(() => validateV1Envelope(kind,{...value,untrusted:true}),V1ContractError));
  test(kind + " rejects invalid version", () => assert.throws(() => validateV1Envelope(kind,{...value,schemaVersion:"ori/other/v1"}),V1ContractError));
}
test("proposal rejects auto-apply",()=>assert.throws(()=>validateV1Envelope("proposal",{...valid.proposal,requiresLearnerApproval:false}),V1ContractError));
test("context rejects duplicate grants",()=>assert.throws(()=>validateV1Envelope("context",{...valid.context,grants:["inspectProgram","inspectProgram"]}),V1ContractError));
test("trace rejects invented source",()=>assert.throws(()=>validateV1Envelope("trace-evidence",{...valid["trace-evidence"],source:"model"}),V1ContractError));
test("plan rejects excessive steps",()=>assert.throws(()=>validateV1Envelope("plan",{...valid.plan,steps:Array(9).fill({id:"a",goal:"b"})}),V1ContractError));
