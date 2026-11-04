import { validateSnapshot, validateTrace, ContractError } from "./contracts.mjs";
import { createHash } from "node:crypto";

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Host evidence is copied and normalized at observation time.
 * The digest binds the proposal review to the exact verified observation,
 * but is NOT a cryptographic attestation of host execution.
 */
export function createEvidenceReceipt({snapshot,trace,expectedSteps,programRevision}={}) {
  const program=validateSnapshot(snapshot);
  const execution=validateTrace(trace);
  if(typeof programRevision!=="string" || !/^[a-f0-9]{64}$/.test(programRevision))
    throw new ContractError("Missing trusted host program revision");
  if(!Number.isSafeInteger(expectedSteps) || expectedSteps<1 || expectedSteps>100)
    throw new ContractError("Invalid host step budget");
  const indices=execution.steps.map(step=>step.index);
  if(indices.some((n,i)=>n!==i) || execution.steps.length!==expectedSteps)
    throw new ContractError("Incomplete or unordered host trace");
  const canonical={
    schemaVersion:"ori/evidence-receipt/v1",
    programRevision,
    allowedBlocks:[...program.allowedBlocks],
    steps:execution.steps.map(step=>({index:step.index,description:step.description}))
  };
  return Object.freeze({
    schemaVersion:"ori/evidence-receipt/v1",
    programRevision,
    digest:digest(canonical),
    stepCount:execution.steps.length,
    complete:true,
    appliedChanges:false
  });
}
export function assertCurrentProgramRevision(receipt,currentRevision) {
  if(!receipt || receipt.schemaVersion!=="ori/evidence-receipt/v1" ||
     !/^[a-f0-9]{64}$/.test(currentRevision??"") ||
     receipt.programRevision!==currentRevision)
    throw new ContractError("Stale or invalid program revision");
  return true;
}
