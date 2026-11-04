import { runLocalAgentRuntime } from "../src/local-agent-runtime.mjs";
import { validateEducationalRequest, contextualEducationalHint } from "../src/educational-request-v1.mjs";

const LIMIT=1024;
let input="";
try {
  for await (const chunk of process.stdin) {
    input += chunk.toString("utf8");
    if (Buffer.byteLength(input,"utf8") > LIMIT) throw Error("Input too large");
  }
  const request=validateEducationalRequest(JSON.parse(input));
  const result=await runLocalAgentRuntime({
    hostContext:{
      sessionId:"context-v1",learningStage:"connect",capabilities:[],grants:[],
      attempts:request.context.outcome==="not-run"?0:1,
      hintsUsed:request.context.hintCount
    },
    intent:request.intent,enableModels:false,preferred:[],deadlineMs:2000
  });
  process.stdout.write(JSON.stringify({
    schemaVersion:"ori/educational-response/v1",intent:request.intent,
    plan:result.plan,hint:contextualEducationalHint(request),
    hintSource:"deterministic",appliedChanges:false,
    requiresLearnerApproval:true
  })+"\n");
} catch {
  process.stderr.write("Invalid educational request\n");
  process.exitCode=2;
}
