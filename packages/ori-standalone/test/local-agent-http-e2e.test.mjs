import test from "node:test";
import assert from "node:assert/strict";
import { startSyntheticOpenCodeServer } from "./support/synthetic-opencode-server.mjs";
import { runLocalAgentRuntime } from "../src/local-agent-runtime.mjs";

const hostContext={sessionId:"synthetic-e2e",learningStage:"connect",capabilities:[],grants:[],attempts:1,hintsUsed:0};
const isolationAttestation={isolatedProcess:true,disposableWorkspace:true,noCredentials:true,networkRestricted:true,toolsDenied:true,adultSupervision:true};
const openCodePreflight={version:"synthetic-only",expectedVersion:"synthetic-only",workspace:"/tmp/ori-opencode-synthetic",isolated:true,credentialsAbsent:true,networkRestricted:true,effectivePermissionsVerified:true,toolDenialVerified:true};
const options={hostContext,intent:"help",enableModels:true,preferred:["opencode-native"],isolationAttestation,openCodePreflight,deadlineMs:5000};

test("actual loopback HTTP completes config, session, message, cleanup",async()=>{
  const server=await startSyntheticOpenCodeServer();
  try{
    const result=await runLocalAgentRuntime({...options,openCodeEndpoint:server.endpoint});
    assert.equal(result.hintSource,"opencode-native");
    assert.equal(result.appliedChanges,false);
    assert.equal(server.sessions.size,0);
    assert.deepEqual(server.events.map(e=>e.method),["GET","POST","POST","DELETE"]);
  }finally{await server.close();}
});
test("unsafe config prevents session creation over HTTP",async()=>{
  const server=await startSyntheticOpenCodeServer({permission:"allow"});
  try{
    const result=await runLocalAgentRuntime({...options,openCodeEndpoint:server.endpoint});
    assert.equal(result.hintSource,"deterministic");
    assert.deepEqual(server.events.map(e=>e.path),["/config"]);
  }finally{await server.close();}
});
test("unsafe model output triggers deterministic fallback after cleanup",async()=>{
  const server=await startSyntheticOpenCodeServer({hint:"La solución completa es copiar el código"});
  try{
    const result=await runLocalAgentRuntime({...options,openCodeEndpoint:server.endpoint});
    assert.equal(result.hintSource,"deterministic");
    assert.equal(server.sessions.size,0);
  }finally{await server.close();}
});
test("missing attestation blocks native session",async()=>{
  const server=await startSyntheticOpenCodeServer();
  try{
    const result=await runLocalAgentRuntime({...options,openCodeEndpoint:server.endpoint,isolationAttestation:undefined});
    assert.equal(result.hintSource,"deterministic");
    assert.deepEqual(server.events.map(e=>e.path),[]);
  }finally{await server.close();}
});
