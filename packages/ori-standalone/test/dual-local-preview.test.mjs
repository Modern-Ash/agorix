import test from "node:test";
import assert from "node:assert/strict";
import { runDualLocalPreview } from "../src/dual-local-preview.mjs";
import { ProviderError } from "../src/providers.mjs";
const hostContext={sessionId:"synthetic",learningStage:"connect",capabilities:[],grants:[],attempts:1,hintsUsed:0};
const ok=message=>async()=>({ok:true,json:async()=>({message:{content:message},choices:[{message:{content:message}}]})});
test("disabled providers yield deterministic hint",async()=>{
  const result=await runDualLocalPreview({hostContext,intent:"help"});
  assert.equal(result.hintSource,"deterministic");
});
test("Ollama preferred when healthy",async()=>{
  const result=await runDualLocalPreview({hostContext,intent:"help",enableLocalModels:true,ollamaFetch:ok("¿Qué podrías probar primero?"),gatewayFetch:ok("¿Qué esperabas?")});
  assert.equal(result.hintSource,"ollama");
});
test("gateway used when Ollama fails",async()=>{
  const result=await runDualLocalPreview({hostContext,intent:"help",enableLocalModels:true,ollamaFetch:async()=>{throw Error("offline");},gatewayFetch:ok("¿Qué podrías observar?")});
  assert.equal(result.hintSource,"opencode-compatible");
});
test("both offline use deterministic fallback",async()=>{
  const offline=async()=>{throw Error("offline");};
  const result=await runDualLocalPreview({hostContext,intent:"help",enableLocalModels:true,ollamaFetch:offline,gatewayFetch:offline});
  assert.equal(result.hintSource,"deterministic");
});
test("unsafe hint falls back",async()=>{
  const result=await runDualLocalPreview({hostContext,intent:"help",enableLocalModels:true,ollamaFetch:ok("solución completa"),gatewayFetch:ok("solución completa")});
  assert.equal(result.hintSource,"deterministic");
});
test("rejects unknown provider names",async()=>assert.rejects(runDualLocalPreview({hostContext,preferred:["cloud"]}),ProviderError));
test("unknown intent avoids inference",async()=>{
  const result=await runDualLocalPreview({hostContext,intent:"unknown",enableLocalModels:true,ollamaFetch:async()=>{throw Error("called");}});
  assert.equal(result.hintSource,"deterministic");
});

test("unsafe Ollama hint falls through to valid gateway hint",async()=>{
  const result=await runDualLocalPreview({
    hostContext,intent:"help",enableLocalModels:true,
    ollamaFetch:ok("La solución completa es copiar el código"),
    gatewayFetch:ok("¿Qué paso pequeño podrías probar?")
  });
  assert.equal(result.hintSource,"opencode-compatible");
  assert.equal(result.hint,"¿Qué paso pequeño podrías probar?");
  assert.equal(result.appliedChanges,false);
});
test("both invalid hints use deterministic fallback without edits",async()=>{
  const result=await runDualLocalPreview({
    hostContext,intent:"help",enableLocalModels:true,
    ollamaFetch:ok("console.log('unsafe')"),
    gatewayFetch:ok("Ya ejecuté tu programa")
  });
  assert.equal(result.hintSource,"deterministic");
  assert.equal(result.appliedChanges,false);
});
