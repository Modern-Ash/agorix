import test from "node:test";
import assert from "node:assert/strict";
import {runLocalAgentRuntime} from "../src/local-agent-runtime.mjs";
import {ProviderError} from "../src/providers.mjs";
const hostContext={sessionId:"synthetic",learningStage:"connect",capabilities:[],grants:[],attempts:1,hintsUsed:0};
const ok=text=>async()=>({ok:true,json:async()=>({message:{content:text}})});
const json=data=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(data)});
const isolationAttestation={isolatedProcess:true,disposableWorkspace:true,noCredentials:true,networkRestricted:true,toolsDenied:true,adultSupervision:true};
const openCodePreflight={version:"1.2.3",expectedVersion:"1.2.3",workspace:"/tmp/ori-opencode-test",isolated:true,credentialsAbsent:true,networkRestricted:true,effectivePermissionsVerified:true,toolDenialVerified:true};
const openCodeFetch=async(url,opts)=>{
  if(url.endsWith("/config"))return json({permission:{"*":"deny"},agent:{plan:{permission:{"*":"deny"}}},mcp:{}});
  if(url.endsWith("/session")&&opts.method==="POST")return json({id:"ses_synthetic"});
  if(url.endsWith("/message"))return json({parts:[{type:"text",text:"¿Qué esperabas observar?"}]});
  return json(true);
};
test("default mode is offline and never calls models",async()=>{
  const result=await runLocalAgentRuntime({hostContext,intent:"help",ollamaFetch:async()=>{throw Error("called");}});
  assert.equal(result.hintSource,"deterministic");
  assert.equal(result.appliedChanges,false);
});
test("Ollama produces guarded hint",async()=>{
  const result=await runLocalAgentRuntime({hostContext,intent:"help",enableModels:true,preferred:["ollama"],ollamaFetch:ok("¿Qué podrías probar primero?")});
  assert.equal(result.hintSource,"ollama");
});
test("native provider only runs after gates",async()=>{
  const result=await runLocalAgentRuntime({hostContext,intent:"help",enableModels:true,preferred:["opencode-native"],openCodeFetch,isolationAttestation,openCodePreflight});
  assert.equal(result.hintSource,"opencode-native");
  assert.equal(result.appliedChanges,false);
});
test("native denied without preflight and falls back",async()=>{
  let called=0;
  const result=await runLocalAgentRuntime({hostContext,intent:"help",enableModels:true,preferred:["opencode-native"],openCodeFetch:async()=>{called++;return json({});}});
  assert.equal(called,0);
  assert.equal(result.hintSource,"deterministic");
});
test("unsafe Ollama hint falls through to gated native",async()=>{
  const result=await runLocalAgentRuntime({hostContext,intent:"help",enableModels:true,preferred:["ollama","opencode-native"],ollamaFetch:ok("La solución completa es copiar el código"),openCodeFetch,isolationAttestation,openCodePreflight});
  assert.equal(result.hintSource,"opencode-native");
});
test("invalid provider policy rejected",async()=>assert.rejects(runLocalAgentRuntime({hostContext,preferred:["cloud"]}),ProviderError));
test("unknown intent does not invoke provider",async()=>{
  const result=await runLocalAgentRuntime({hostContext,intent:"unknown",enableModels:true,preferred:["ollama"],ollamaFetch:async()=>{throw Error("called");}});
  assert.equal(result.hintSource,"deterministic");
});
