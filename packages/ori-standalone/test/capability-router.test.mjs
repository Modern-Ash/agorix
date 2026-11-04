import test from "node:test";
import assert from "node:assert/strict";
import { createCapabilityRouter } from "../src/capability-router.mjs";
import { ProviderError } from "../src/providers.mjs";

const descriptors=[
  {id:"local",mode:"local",features:["text"],maxOutputTokens:512},
  {id:"cloud",mode:"cloud",features:["text","tools"],maxOutputTokens:1024}
];
test("local provider used by default",async()=>{
  let cloudCalls=0;
  const router=createCapabilityRouter({descriptors,adapters:{local:{complete:async()=>({message:"Pista local"})},cloud:{complete:async()=>{cloudCalls++;return {message:"Cloud"};}}}});
  assert.equal((await router.complete({intent:"help"})).source,"local");
  assert.equal(cloudCalls,0);
});
test("cloud never called without explicit permission",async()=>{
  const router=createCapabilityRouter({descriptors,preferred:["cloud"],adapters:{cloud:{complete:async()=>({message:"Cloud"})}}});
  assert.equal((await router.complete({intent:"help"})).fallback,true);
});
test("cloud opt-in enables matching capability",async()=>{
  const router=createCapabilityRouter({descriptors,allowCloud:true,requiredFeatures:["tools"],adapters:{cloud:{complete:async()=>({message:"Cloud"})}}});
  assert.equal((await router.complete({intent:"help"})).source,"cloud");
});
test("missing adapter falls back safely",async()=>{
  const router=createCapabilityRouter({descriptors});
  assert.equal((await router.complete({intent:"help"})).fallback,true);
});
test("preferred order is preserved among eligible providers",async()=>{
  const router=createCapabilityRouter({descriptors,allowCloud:true,preferred:["cloud","local"],adapters:{local:{complete:async()=>({message:"Local"})},cloud:{complete:async()=>({message:"Cloud"})}}});
  assert.equal((await router.complete({intent:"help"})).source,"cloud");
});
test("invalid descriptor fails closed",()=>assert.throws(()=>createCapabilityRouter({descriptors:[{id:"bad",mode:"cloud",features:["shell"],maxOutputTokens:128}]}),ProviderError));
test("invalid adapters rejected",()=>assert.throws(()=>createCapabilityRouter({adapters:[]}),ProviderError));
