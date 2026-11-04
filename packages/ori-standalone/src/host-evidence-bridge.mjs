import { runEvidenceGatedAgent } from "./evidence-gated-agent.mjs";
import { validateSnapshot, validateTrace, ContractError } from "./contracts.mjs";

const INTENTS=new Set(["help","repeat","turn","move","debug"]);
const KEYS=["expectedSteps","hostContext","intent","programRevision","snapshot","trace"];
const HOST_KEYS=["attempts","capabilities","grants","hintsUsed","learningStage","sessionId"];
const HEX=/^[a-f0-9]{64}$/;

/**
 * Explicitly trusted host-to-Ori port envelope. The host owns all evidence,
 * grants and revision; no user prompt can grant tools.
 */
export function validateHostEvidenceRequest(value) {
  if(!value || typeof value!=="object" || Array.isArray(value) ||
    Object.keys(value).sort().join()!==KEYS.join())
    throw new ContractError("Invalid host evidence envelope");
  if(!INTENTS.has(value.intent) || typeof value.programRevision!=="string" ||
    !HEX.test(value.programRevision) ||
    !Number.isSafeInteger(value.expectedSteps) || value.expectedSteps<1 ||
    value.expectedSteps>100)throw new ContractError("Invalid host evidence metadata");
  const host=value.hostContext;
  if(!host || typeof host!=="object" || Array.isArray(host) ||
    Object.keys(host).sort().join()!==HOST_KEYS.join())
    throw new ContractError("Invalid host context fields");
  if(!Array.isArray(host.grants) ||
    host.grants.some(g=>!["inspectProgram","inspectTrace"].includes(g)) ||
    !host.grants.includes("inspectProgram") || !host.grants.includes("inspectTrace"))
    throw new ContractError("Missing trusted read grants");
  const snapshot=validateSnapshot(value.snapshot);
  const trace=validateTrace(value.trace);
  if(trace.steps.length!==value.expectedSteps ||
    trace.steps.some((step,index)=>step.index!==index))
    throw new ContractError("Incomplete host evidence");
  return {
    intent:value.intent,hostContext:structuredClone(host),
    snapshot,trace,expectedSteps:value.expectedSteps,
    programRevision:value.programRevision
  };
}
export async function executeHostEvidenceRequest(raw,{providerRouter}={}) {
  const request=validateHostEvidenceRequest(raw);
  const result=await runEvidenceGatedAgent({
    hostContext:request.hostContext,intent:request.intent,
    expectedSteps:request.expectedSteps,programRevision:request.programRevision,
    providerRouter,
    tools:{
      inspectProgram:async()=>request.snapshot,
      inspectTrace:async()=>request.trace
    }
  });
  return Object.freeze({
    schemaVersion:"ori/host-evidence-response/v1",
    plan:result.plan,
    proposal:result.evidenceReceipt?result.proposal:null,
    evidenceReceipt:result.evidenceReceipt??null,
    requiresLearnerApproval:true,appliedChanges:false
  });
}
