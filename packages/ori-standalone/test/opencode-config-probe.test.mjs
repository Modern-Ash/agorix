import test from "node:test";
import assert from "node:assert/strict";
import { probeOpenCodeEffectiveConfig } from "../src/opencode-config-probe.mjs";
import { ProviderError } from "../src/providers.mjs";
const response=config=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(config)});
test("accepts deny-all effective config from loopback",async()=>{
  const result=await probeOpenCodeEffectiveConfig({fetchImpl:async(url)=>{assert.equal(url,"http://127.0.0.1:4096/config");return response({permission:{"*":"deny"},agent:{plan:{permission:{"*":"deny"}}},mcp:{}});}});
  assert.equal(result.safeSnapshot,true);
});
test("rejects inherited global allow",async()=>assert.rejects(probeOpenCodeEffectiveConfig({fetchImpl:async()=>response({permission:{"*":"allow"}})}),ProviderError));
test("rejects permissive agent override",async()=>assert.rejects(probeOpenCodeEffectiveConfig({fetchImpl:async()=>response({permission:{"*":"deny"},agent:{plan:{permission:{"*":"allow"}}}})}),ProviderError));
test("rejects active MCP",async()=>assert.rejects(probeOpenCodeEffectiveConfig({fetchImpl:async()=>response({permission:{"*":"deny"},mcp:{remote:{}}})}),ProviderError));
test("rejects remote endpoints",async()=>assert.rejects(probeOpenCodeEffectiveConfig({endpoint:"https://example.com"}),ProviderError));
test("rejects oversized response",async()=>assert.rejects(probeOpenCodeEffectiveConfig({fetchImpl:async()=>response({permission:{"*":"deny"},extra:"x".repeat(40000)})}),ProviderError));
test("rejects unavailable runtime",async()=>assert.rejects(probeOpenCodeEffectiveConfig({fetchImpl:async()=>({ok:false})}),ProviderError));
