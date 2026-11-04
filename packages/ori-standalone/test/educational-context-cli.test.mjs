import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { validateEducationalRequest, contextualEducationalHint } from "../src/educational-request-v1.mjs";
const base={schemaVersion:"ori/educational-request/v1",intent:"debug",
  context:{scriptCount:2,hintCount:1,outcome:"failed"}};
test("validates minimal bounded metadata",()=>assert.equal(validateEducationalRequest(base).context.scriptCount,2));
test("uses runtime evidence outcome to guide question",()=>assert.match(contextualEducationalHint(base),/paso/));
test("rejects raw learner data",()=>assert.throws(()=>validateEducationalRequest({...base,message:"child"})));
test("rejects program or trace in context",()=>assert.throws(()=>validateEducationalRequest({...base,context:{...base.context,program:"raw"}})));
test("rejects negative and oversized counts",()=>assert.throws(()=>validateEducationalRequest({...base,context:{...base.context,hintCount:1001}})));
test("rejects unknown outcomes",()=>assert.throws(()=>validateEducationalRequest({...base,context:{...base.context,outcome:"unknown"}})));
test("rejects unsupported intent",()=>assert.throws(()=>validateEducationalRequest({...base,intent:"shell"})));
test("CLI accepts valid request and produces non-applying response",()=>{
 const result=spawnSync(process.execPath,["examples/educational-context-cli.mjs"],{
  input:JSON.stringify(base),encoding:"utf8",timeout:5000});
 assert.equal(result.status,0,result.stderr);
 const value=JSON.parse(result.stdout);
 assert.equal(value.schemaVersion,"ori/educational-response/v1");
 assert.equal(value.appliedChanges,false);
 assert.match(value.hint,/paso/);
 assert.equal(result.stdout.includes("context-v1"),false);
});
test("CLI fails closed on extra child data",()=>{
 const result=spawnSync(process.execPath,["examples/educational-context-cli.mjs"],{
  input:JSON.stringify({...base,childName:"secret"}),encoding:"utf8",timeout:5000});
 assert.notEqual(result.status,0);
 assert.equal(result.stdout,"");
});
