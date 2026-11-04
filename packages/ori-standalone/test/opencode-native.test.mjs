import test from "node:test";
import assert from "node:assert/strict";
import { createNativeOpenCodeAdapter } from "../src/opencode-native.mjs";
import { ProviderError } from "../src/providers.mjs";

const isolationAttestation={isolatedProcess:true,disposableWorkspace:true,noCredentials:true,networkRestricted:true,toolsDenied:true,adultSupervision:true};
const native=options=>createNativeOpenCodeAdapter({...options,isolationAttestation});
const metadata={intent:"help",learningStage:"connect",attempts:1,hintsUsed:0};
const response=data=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(data)});
test("uses documented session lifecycle and sends minimized metadata",async()=>{
  const calls=[];
  const fetchImpl=async(url,opts)=>{
    calls.push({url,opts});
    if(url.endsWith("/session") && opts.method==="POST") return response({id:"ses_test"});
    if(url.endsWith("/message")) return response({parts:[{type:"text",text:"¿Qué podrías probar primero?"}]});
    return response(true);
  };
  const adapter=native({fetchImpl});
  assert.deepEqual(await adapter.complete(metadata),{message:"¿Qué podrías probar primero?"});
  assert.equal(calls.length,3);
  assert.equal(calls[2].opts.method,"DELETE");
  const body=JSON.parse(calls[1].opts.body);
  assert.equal(body.tools.bash,false);
  assert.equal(body.tools.edit,false);
  assert.equal(body.parts[0].text.includes("ses_test"),false);
});
test("remote endpoints rejected",()=>assert.throws(()=>native({endpoint:"https://example.org"}),ProviderError));
test("credentialed endpoint rejected",()=>assert.throws(()=>native({endpoint:"http://user:pass@localhost:4096"}),ProviderError));
test("raw child text rejected",async()=>assert.rejects(native({fetchImpl:async()=>{throw Error("unexpected call");}}).complete({...metadata,message:"child"}),ProviderError));
test("invalid session id rejected",async()=>assert.rejects(native({fetchImpl:async()=>response({id:"../escape"})}).complete(metadata),ProviderError));
test("oversized server response rejected",async()=>assert.rejects(native({fetchImpl:async()=>response({id:"x".repeat(17000)})}).complete(metadata),ProviderError));
test("tool output not accepted as text",async()=>{
  const fetchImpl=async(url)=>url.endsWith("/session")?response({id:"ses_1"}):response({parts:[{type:"tool",text:"untrusted"}]});
  await assert.rejects(native({fetchImpl}).complete(metadata),ProviderError);
});

test("native adapter refuses missing isolation attestation",()=>assert.throws(()=>createNativeOpenCodeAdapter(),ProviderError));
test("native adapter refuses incomplete isolation attestation",()=>assert.throws(()=>createNativeOpenCodeAdapter({isolationAttestation:{...isolationAttestation,toolsDenied:false}}),ProviderError));
