/**
 * Synthetic metadata-only shadow protocol. No child text, programs or identifiers.
 * Only for loopback/local integration tests, not a public service.
 */
export const SHADOW_SCHEMA = "ori/shadow-metadata/v0";
export function validateShadowMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join() !== "hintLevel,missionIndex,scriptCount" ||
      !Number.isSafeInteger(value.missionIndex) || value.missionIndex < 0 || value.missionIndex > 1000 ||
      !Number.isSafeInteger(value.hintLevel) || value.hintLevel < 1 || value.hintLevel > 5 ||
      !Number.isSafeInteger(value.scriptCount) || value.scriptCount < 0 || value.scriptCount > 100) {
    throw new TypeError("Invalid Ori shadow metadata");
  }
  return Object.freeze({ missionIndex: value.missionIndex, hintLevel: value.hintLevel, scriptCount: value.scriptCount });
}
export function evaluateShadowMetadata(value) {
  const data = validateShadowMetadata(value);
  return Object.freeze({
    schema: SHADOW_SCHEMA,
    accepted: true,
    // Never return a hint, plan, proposal, execution result or user-derived content.
    capability: "metadata-validation",
    observed: Object.freeze({ hasScripts: data.scriptCount > 0 })
  });
}
