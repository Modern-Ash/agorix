import { requireOpenCodeSmokeReadiness } from "../src/opencode-smoke-preflight.mjs";
import { execFileSync } from "node:child_process";
import { runGatedOpenCodeSmoke } from "../src/opencode-gated-smoke.mjs";

// Opt-in adult operator only. Never run this against an unisolated host.
// Attestation is a declaration, not proof of OS isolation.
if (process.env.ORI_OPENCODE_SMOKE!=="I_HAVE_VERIFIED_ISOLATION") {
  console.error("Refusing: set ORI_OPENCODE_SMOKE=I_HAVE_VERIFIED_ISOLATION only after independent sandbox verification.");
  process.exitCode=2;
} else {
  let actualVersion="";
  try { actualVersion=execFileSync("opencode",["--version"],{encoding:"utf8",timeout:2000}).trim(); } catch {}
  const evidence={version:actualVersion,expectedVersion:process.env.ORI_OPENCODE_PINNED_VERSION,workspace:process.env.ORI_OPENCODE_WORKSPACE,isolated:process.env.ORI_ISOLATED==="true",credentialsAbsent:process.env.ORI_NO_CREDENTIALS==="true",networkRestricted:process.env.ORI_NETWORK_RESTRICTED==="true",effectivePermissionsVerified:process.env.ORI_PERMISSIONS_VERIFIED==="true",toolDenialVerified:process.env.ORI_TOOL_DENIAL_VERIFIED==="true"};
  const isolationAttestation={
    isolatedProcess:true,disposableWorkspace:true,noCredentials:true,
    networkRestricted:true,toolsDenied:true,adultSupervision:true
  };
  try {
    requireOpenCodeSmokeReadiness(evidence);
    const result=await runGatedOpenCodeSmoke({isolationAttestation});
    console.log(JSON.stringify(result,null,2));
  } catch(error) {
    console.error("OpenCode smoke failed:",error?.name??"Error");
    process.exitCode=1;
  }
}
