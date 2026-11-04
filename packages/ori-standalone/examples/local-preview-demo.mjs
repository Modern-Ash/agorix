import { runLocalEducationalPreview } from "../src/local-educational-preview.mjs";

const intent=process.argv[2]??"help";
const supported=new Set(["help","repeat","turn","move","debug"]);
if (!supported.has(intent)) {
  console.error("Usage: npm run demo:local-preview -- help|repeat|turn|move|debug");
  process.exitCode=2;
} else {
  const hostContext={
    sessionId:"synthetic-cli",learningStage:"connect",
    capabilities:[],grants:[],attempts:1,hintsUsed:0
  };
  const result=await runLocalEducationalPreview({
    hostContext,intent,enableLocalModel:true,
    model:process.env.ORI_OLLAMA_MODEL??"qwen2.5:3b",
    deadlineMs:5000
  });
  console.log(JSON.stringify({
    kind:result.kind,
    plan:result.plan,
    hint:result.hint,
    hintSource:result.hintSource,
    appliedChanges:result.appliedChanges,
    evidenceAvailable:result.evidenceAvailable
  },null,2));
  if (result.hintSource!=="ollama") {
    console.error("Ollama unavailable or hint rejected: deterministic fallback was used.");
  }
}
