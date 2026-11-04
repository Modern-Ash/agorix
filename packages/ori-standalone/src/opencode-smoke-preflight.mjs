import { ProviderError } from "./providers.mjs";

/**
 * Preflight only. Never claims to prove process isolation.
 * Runtime execution remains disabled unless independently verified.
 */
export function assessOpenCodeSmokeReadiness({
  version,expectedVersion,workspace,isolated,credentialsAbsent,networkRestricted,
  effectivePermissionsVerified,toolDenialVerified
}={}) {
  const checks=Object.freeze({
    pinnedVersion:typeof version==="string" && version.length>0 && version===expectedVersion,
    disposableWorkspace:typeof workspace==="string" && workspace.startsWith("/tmp/ori-opencode-") && !workspace.includes(".."),
    isolatedProcess:isolated===true,
    credentialsAbsent:credentialsAbsent===true,
    networkRestricted:networkRestricted===true,
    effectivePermissionsVerified:effectivePermissionsVerified===true,
    toolDenialVerified:toolDenialVerified===true
  });
  return Object.freeze({ready:Object.values(checks).every(Boolean),checks});
}
export function requireOpenCodeSmokeReadiness(input) {
  const result=assessOpenCodeSmokeReadiness(input);
  if (!result.ready) throw new ProviderError("OpenCode smoke preflight incomplete");
  return result;
}
