import { validateSnapshot, validateTrace, ContractError } from "./contracts.mjs";

/**
 * Pure evidence reconciliation. The host remains the sole execution authority.
 * Never treats descriptions in trace steps as instructions.
 */
export function reconcileHostSimulation({snapshot,trace,expectedSteps=0}={}) {
  const program=validateSnapshot(snapshot);
  const observed=validateTrace(trace);
  if (!Number.isSafeInteger(expectedSteps) || expectedSteps<0 || expectedSteps>100)
    throw new ContractError("Invalid expected steps");
  const indices=observed.steps.map(step=>step.index);
  if (new Set(indices).size!==indices.length ||
      indices.some((index,i)=>index!==i))
    throw new ContractError("Trace indices must be contiguous and ordered");
  if (expectedSteps>0 && observed.steps.length>expectedSteps)
    throw new ContractError("Trace exceeds host execution budget");
  return Object.freeze({
    schemaVersion:"ori/simulation-evidence/v1",
    verifiedBy:"host-contract",
    stepCount:observed.steps.length,
    observedSteps:expectedSteps===0?null:expectedSteps,
    complete:expectedSteps>0 && observed.steps.length===expectedSteps,
    allowedBlockKinds:Object.freeze([...program.allowedBlocks]),
    appliedChanges:false
  });
}
