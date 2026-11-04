import {runLocalAgentRuntime} from "../src/local-agent-runtime.mjs";

const intent=process.argv[2]??"help";
const enableModels=process.env.ORI_LOCAL_MODELS==="1";
const hostContext={
  sessionId:"synthetic-cli",learningStage:"connect",
  capabilities:[],grants:[],attempts:1,hintsUsed:0
};
try {
  const result=await runLocalAgentRuntime({
    hostContext,intent,enableModels,
    // This CLI enables Ollama only. Native OpenCode requires separate
    // verified isolation and explicit operator-provided preflight.
    preferred:["ollama"],deadlineMs:5000
  });
  console.log(JSON.stringify({
    intent,plan:result.plan,hint:result.hint,
    hintSource:result.hintSource,appliedChanges:result.appliedChanges
  },null,2));
} catch(error) {
  console.error("Ori local runtime failed:",error?.name??"Error");
  process.exitCode=1;
}
