import test from "node:test";
import assert from "node:assert/strict";
import { createOpenCodeCompatibleAdapter } from "../src/opencode-compatible.mjs";
import { ProviderError } from "../src/providers.mjs";

const metadata={intent:"help",learningStage:"connect",attempts:1,hintsUsed:0};
test("local compatible gateway receives only minimized metadata",async()=>{
  let captured;
  const adapter=createOpenCodeCompatibleAdapter({fetchImpl:async(url,opts)=>{
    captured={url,opts};
    return {ok:true,json:async()=>({choices:[{message:{content:"¿Qué podrías intentar primero?"}}]})};
  }});
  assert.equal((await adapter.complete(metadata)).message,"¿Qué podrías intentar primero?");
  assert.equal(captured.url,"http://127.0.0.1:4096/v1/chat/completions");
  assert.equal(captured.opts.body.includes("synthetic"),false);
});
test("remote endpoints rejected",()=>assert.throws(()=>createOpenCodeCompatibleAdapter({endpoint:"https://example.com"}),ProviderError));
test("credentialed endpoints rejected",()=>assert.throws(()=>createOpenCodeCompatibleAdapter({endpoint:"http://user:pass@localhost:4096"}),ProviderError));
test("untrusted child text rejected",async()=>assert.rejects(createOpenCodeCompatibleAdapter().complete({...metadata,message:"child"}),ProviderError));
test("malformed gateway response rejected",async()=>assert.rejects(createOpenCodeCompatibleAdapter({fetchImpl:async()=>({ok:true,json:async()=>({choices:[]})})}).complete(metadata),ProviderError));
test("network failure propagates for router fallback",async()=>assert.rejects(createOpenCodeCompatibleAdapter({fetchImpl:async()=>{throw Error("offline");}}).complete(metadata)));
