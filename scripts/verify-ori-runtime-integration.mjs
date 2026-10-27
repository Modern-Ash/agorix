import console from "node:console";
import {existsSync,realpathSync} from "node:fs";
import {isAbsolute,join} from "node:path";
import {spawnSync} from "node:child_process";

const configured=process.env.ORI_REPO_PATH;
if(!configured || !isAbsolute(configured)){
  console.error("ORI_REPO_PATH must be an absolute local Ori checkout");
  process.exit(2);
}
let root;
try{root=realpathSync(configured);}catch{
  console.error("ORI_REPO_PATH does not exist");
  process.exit(2);
}
const required=["src/local-agent-runtime.mjs","src/opencode-native.mjs","test/local-agent-http-e2e.test.mjs","examples/educational-context-cli.mjs","examples/host-evidence-cli.mjs"];
if(required.some(file=>!existsSync(join(root,file)))){
  console.error("Ori checkout lacks required integrated runtime modules");
  process.exit(2);
}
const run=(command,args,cwd)=>{
  const result=spawnSync(command,args,{cwd,stdio:"inherit",env:process.env,timeout:120000});
  if(result.error || result.status!==0){
    console.error("Interop gate failed:",command,args.join(" "),result.error?.message??result.status);
    process.exit(result.status??1);
  }
};
console.log("ORI_GATE: Ori unit + real loopback HTTP integration tests");
run("node",["--test","test/local-agent-runtime.test.mjs","test/local-agent-http-e2e.test.mjs"],root);
console.log("ORI_GATE: Agorix-to-Ori shadow API and v1 runtime process contracts");
run("pnpm",["exec","vitest","run","apps/tutor-api/src/oriRealProcessSmoke.test.ts","apps/tutor-api/src/oriRuntimeProcessContract.test.ts","apps/tutor-api/src/oriLiveRuntimeRoute.test.ts","apps/tutor-api/src/oriLiveContextRoute.test.ts","apps/tutor-api/src/oriHostEvidenceLive.test.ts","apps/tutor-api/src/oriCanonicalRealProcess.test.ts","apps/tutor-api/src/oriReviewApplyLiveProcessHttp.test.ts","apps/tutor-api/src/oriReviewHttpRoute.test.ts","apps/tutor-api/src/oriProposalIssuanceHttp.test.ts","apps/tutor-api/src/oriAuthorizedReviewLifecycle.test.ts","apps/tutor-api/src/oriAuthServiceIntegration.test.ts","apps/tutor-api/src/oriRealRotatingAuthIntegration.test.ts","apps/tutor-api/src/oriRotatingSessionRoute.test.ts","apps/tutor-api/src/oriReviewRuntimeHttp.test.ts","--reporter=verbose"],process.cwd());
// Run the release-critical live vertical in isolation. Vitest exits nonzero
// when its single test fails; with ORI_REPO_PATH checked above, it cannot skip
// due to a missing checkout without the gate detecting that configuration.
console.log("ORI_GATE: isolated live HTTP approval/apply vertical");
run("pnpm",["exec","vitest","run","apps/tutor-api/src/oriReviewApplyLiveProcessHttp.test.ts","apps/tutor-api/src/oriMissionParityLive.test.ts","--reporter=verbose"],process.cwd());
console.log("ORI_GATE: PASS — real processes, synthetic inputs; not real OpenCode or child readiness");
