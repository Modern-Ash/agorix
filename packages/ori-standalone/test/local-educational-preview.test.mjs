import test from "node:test";
import assert from "node:assert/strict";
import { runLocalEducationalPreview } from "../src/local-educational-preview.mjs";
const hostContext={sessionId:"synthetic",learningStage:"connect",capabilities:[],grants:[],attempts:1,hintsUsed:0};
test("local inference disabled by default",async()=>{
  const result=await runLocalEducationalPreview({hostContext,intent:"help",fetchImpl:()=>{throw Error("should not call");}});
  assert.equal(result.hintSource,"deterministic");
  assert.equal(result.appliedChanges,false);
});
test("local Ollama accepts a safe hint and receives only metadata",async()=>{
  let request;
  const result=await runLocalEducationalPreview({hostContext,intent:"help",enableLocalModel:true,fetchImpl:async(_url,opts)=>{
    request=JSON.parse(opts.body);
    return {ok:true,json:async()=>({message:{content:"¿Qué podrías intentar primero?"}})};
  }});
  assert.equal(result.hintSource,"ollama");
  assert.equal(request.messages[1].content.includes("synthetic"),false);
  assert.equal(result.appliedChanges,false);
});
test("unsafe model output falls back",async()=>{
  const result=await runLocalEducationalPreview({hostContext,intent:"help",enableLocalModel:true,fetchImpl:async()=>({ok:true,json:async()=>({message:{content:"Aquí está la solución completa"}})})});
  assert.equal(result.hintSource,"deterministic");
});
test("offline model falls back",async()=>{
  const result=await runLocalEducationalPreview({hostContext,intent:"help",enableLocalModel:true,fetchImpl:async()=>{throw Error("offline");}});
  assert.equal(result.hintSource,"deterministic");
});
test("unknown intent never calls provider",async()=>{
  const result=await runLocalEducationalPreview({hostContext,intent:"unknown",enableLocalModel:true,fetchImpl:()=>{throw Error("called");}});
  assert.equal(result.hintSource,"deterministic");
});
