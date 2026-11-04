import { ProviderError } from "./providers.mjs";

/**
 * Trusted host attestation for an isolated adult-supervised OpenCode process.
 * This is an application gate, NOT proof of OS/container sandboxing.
 * The caller must independently verify these facts before attesting.
 */
export function verifyOpenCodeIsolation(attestation) {
  if (!attestation || typeof attestation !== "object" || Array.isArray(attestation)) throw new ProviderError("Missing isolation attestation");
  const keys=["isolatedProcess","disposableWorkspace","noCredentials","networkRestricted","toolsDenied","adultSupervision"];
  if (Object.keys(attestation).length !== keys.length ||
      keys.some(key=>!Object.hasOwn(attestation,key) || attestation[key]!==true)) {
    throw new ProviderError("OpenCode isolation requirements not attested");
  }
  return true;
}
