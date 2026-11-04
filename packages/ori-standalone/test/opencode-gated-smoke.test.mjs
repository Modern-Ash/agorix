import test from "node:test";
import assert from "node:assert/strict";
import {runGatedOpenCodeSmoke} from "../src/opencode-gated-smoke.mjs";
import {ProviderError} from "../src/providers.mjs";
const isolationAttestation={isolatedProcess:true,disposableWorkspace:true,noCredentials:true,networkRestricted:true,toolsDenied:true,adultSupervision:true};
const response=data=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(data)});
const safeConfig={permission:{"*":"deny"},agent:{plan:{permission:{"*":"deny"}}},mcp:{}};
test("gated smoke validates config before session",async()=>{
  const calls=[];
  const fetchImpl=async(url,opts)=>{
    calls.push(url);
    if(url.endsWith("/config")) return response(safeConfig);
    if(url.endsWith("/session") && opts.method==="POST") return response({id:"ses_test"});
    if(url.endsWith("/message")) return response({parts:[{type:"text",text:"¿Qué podrías probar primero?"}]});
    return response(true);
  };
  const result=await runGatedOpenCodeSmoke({fetchImpl,isolationAttestation});
  assert.equal(result.hintAccepted,true);
  assert.equal(result.appliedChanges,false);
  assert.ok(calls[0].endsWith("/config"));
});
test("unsafe config blocks session creation",async()=>{
  let calls=0;
  const fetchImpl=async(url)=>{calls++;return response({permission:{"*":"allow"}});};
  await assert.rejects(runGatedOpenCodeSmoke({fetchImpl,isolationAttestation}),ProviderError);
  assert.equal(calls,1);
});
test("missing isolation blocks native session",async()=>{
  const fetchImpl=async()=>response(safeConfig);
  await assert.rejects(runGatedOpenCodeSmoke({fetchImpl}),ProviderError);
});
test("unsafe hint fails closed",async()=>{
  const fetchImpl=async(url,opts)=>{
    if(url.endsWith("/config")) return response(safeConfig);
    if(url.endsWith("/session")&&opts.method==="POST") return response({id:"ses_test"});
    if(url.endsWith("/message")) return response({parts:[{type:"text",text:"La solución completa es copiar el código"}]});
    return response(true);
  };
  await assert.rejects(runGatedOpenCodeSmoke({fetchImpl,isolationAttestation}),ProviderError);
});
