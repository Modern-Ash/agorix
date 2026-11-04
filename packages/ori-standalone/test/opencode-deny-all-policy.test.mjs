import test from "node:test";
import assert from "node:assert/strict";
import {createDenyAllOpenCodePolicy,assertDenyAllOpenCodePolicy} from "../src/opencode-deny-all-policy.mjs";
import {ProviderError} from "../src/providers.mjs";
test("deny-all policy is valid",()=>assert.equal(assertDenyAllOpenCodePolicy(createDenyAllOpenCodePolicy()),true));
test("global allow rejected",()=>assert.throws(()=>assertDenyAllOpenCodePolicy({...createDenyAllOpenCodePolicy(),permission:{"*":"allow"}}),ProviderError));
test("agent override rejected",()=>assert.throws(()=>assertDenyAllOpenCodePolicy({...createDenyAllOpenCodePolicy(),agent:{plan:{permission:{"*":"deny",bash:"allow"}}}}),ProviderError));
test("MCP config rejected",()=>assert.throws(()=>assertDenyAllOpenCodePolicy({...createDenyAllOpenCodePolicy(),mcp:{remote:{}}}),ProviderError));
test("extra configuration rejected",()=>assert.throws(()=>assertDenyAllOpenCodePolicy({...createDenyAllOpenCodePolicy(),tools:{bash:true}}),ProviderError));
