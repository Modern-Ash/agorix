import { executeHostEvidenceRequest } from "../src/host-evidence-bridge.mjs";
import { hostProposalRouterFromEnv } from "../src/host-proposal-router.mjs";

let input="";
try {
  for await(const chunk of process.stdin){
    input+=chunk.toString("utf8");
    if(Buffer.byteLength(input,"utf8")>8192)throw Error("Request too large");
  }
  const result=await executeHostEvidenceRequest(JSON.parse(input),{
    providerRouter:hostProposalRouterFromEnv(process.env)
  });
  process.stdout.write(JSON.stringify(result)+"\n");
}catch{
  process.stderr.write("Invalid host evidence request\n");
  process.exitCode=2;
}
