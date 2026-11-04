import test from "node:test";
import assert from "node:assert/strict";
import { defineProviderCapabilities, selectCapableProviders } from "../src/provider-capabilities.mjs";
import { ProviderError } from "../src/providers.mjs";

const local={id:"ollama",mode:"local",features:["text","structured-output"],maxOutputTokens:1024};
const cloud={id:"cloud",mode:"cloud",features:["text","tools","streaming"],maxOutputTokens:2048};
test("capability descriptors are immutable",()=>{
  const d=defineProviderCapabilities(local);
  assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.features));
});
test("local-first policy excludes cloud unless explicitly allowed",()=>{
  assert.deepEqual(selectCapableProviders([local,cloud]).map(d=>d.id),["ollama"]);
  assert.deepEqual(selectCapableProviders([local,cloud],{allowCloud:true}).map(d=>d.id),["ollama","cloud"]);
});
test("required features and token limits filter providers",()=>{
  assert.deepEqual(selectCapableProviders([local,cloud],{requiredFeatures:["tools"],allowCloud:true}).map(d=>d.id),["cloud"]);
  assert.deepEqual(selectCapableProviders([local],{maxOutputTokens:2000}),[]);
});
test("rejects duplicate ids",()=>assert.throws(()=>selectCapableProviders([local,local]),ProviderError));
test("rejects unsupported feature",()=>assert.throws(()=>defineProviderCapabilities({...local,features:["shell"]}),ProviderError));
test("rejects invalid token limit",()=>assert.throws(()=>defineProviderCapabilities({...local,maxOutputTokens:0}),ProviderError));
test("rejects unapproved cloud policy",()=>assert.throws(()=>selectCapableProviders([cloud],{allowCloud:"yes"}),ProviderError));
test("rejects endpoint/credential injection in descriptors",()=>{
  const result=defineProviderCapabilities({...local,endpoint:"https://example.org",apiKey:"secret"});
  assert.equal(Object.hasOwn(result,"apiKey"),false);
  assert.equal(Object.hasOwn(result,"endpoint"),false);
});
