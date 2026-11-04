import { createEvidenceReceipt } from "./evidence-receipt-v1.mjs";
import { runEducationalAgentV2 } from "./agent-runtime-v2.mjs";
import { reconcileHostSimulation } from "./simulation-evidence-v1.mjs";
import { AgentLoopError } from "./agent-loop-v1.mjs";
import { validateProposal, PROPOSAL_SCHEMA } from "./contracts.mjs";

function parseModelProposal(message, snapshot, intent) {
  if (typeof message !== "string" || message.length > 300) return null;
  try {
    const value = JSON.parse(message);
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).sort().join() !== "blocks,operation,requiresLearnerApproval,schemaVersion" ||
        value.schemaVersion !== PROPOSAL_SCHEMA || value.operation !== "append" ||
        value.requiresLearnerApproval !== true || !Array.isArray(value.blocks) ||
        value.blocks.length !== 1) return null;
    const block = value.blocks[0];
    if (!block || typeof block !== "object" || Array.isArray(block) ||
        block.kind !== intent ||
        Object.keys(block).sort().join() !== (intent === "move" ? "kind,steps" : "direction,kind"))
      return null;
    return validateProposal(value, snapshot);
  } catch { return null; }
}

/**
 * A single bounded host observation per tool. Never re-read after planning:
 * the snapshot and trace used to authorize the proposal are exactly those
 * observed by the v2 agent. No writes or implicit permissions.
 */
export async function runEvidenceGatedAgent({
  hostContext,intent,tools={},signal,expectedSteps=0,deadlineMs=3000,programRevision,
  providerRouter
}={}) {
  const observed={};
  const wrapped={};
  for(const name of ["inspectProgram","inspectTrace"]) {
    if(typeof tools[name]!=="function")continue;
    wrapped[name]=async options=>{
      const value=await tools[name](options);
      if(value!=null)observed[name]=structuredClone(value);
      return value;
    };
  }
  const result=await runEducationalAgentV2({
    hostContext,intent,tools:wrapped,signal,deadlineMs
  });
  // Debugging is read-only, but a complete host trace still needs a revision-bound
  // receipt before its plan can be trusted by a host. Other non-proposal intents
  // retain their original no-receipt behavior.
  if(!result.proposal && intent!=="debug") return Object.freeze({...result,simulation:null});
  if(signal?.aborted)throw new AgentLoopError("Agent cancelled");
  if(!hostContext?.grants?.includes("inspectProgram") ||
     !hostContext?.grants?.includes("inspectTrace") ||
     !result.evidenceAvailable.program || !result.evidenceAvailable.trace ||
     observed.inspectProgram==null || observed.inspectTrace==null)
    return Object.freeze({...result,proposal:null,simulation:null});
  const evidence=reconcileHostSimulation({
    snapshot:observed.inspectProgram,trace:observed.inspectTrace,expectedSteps
  });
  const receipt=evidence.complete && programRevision!==undefined
    ? createEvidenceReceipt({snapshot:observed.inspectProgram,trace:observed.inspectTrace,expectedSteps,programRevision})
    : null;
  let proposal=evidence.complete?result.proposal:null;
  if (receipt && proposal && providerRouter && ["move","turn"].includes(intent) && !signal?.aborted) {
    try {
      const response=await providerRouter.complete({
        intent,learningStage:hostContext.learningStage,
        attempts:hostContext.attempts,hintsUsed:hostContext.hintsUsed,
        allowedBlocks:observed.inspectProgram.allowedBlocks,
        traceStepCount:observed.inspectTrace.steps.length
      });
      if (!response?.fallback) {
        const candidate=parseModelProposal(response?.message,observed.inspectProgram,intent);
        if (candidate) proposal=candidate;
      }
    } catch { /* Deterministic proposal remains available. */ }
  }
  return Object.freeze({
    ...result,proposal,
    simulation:evidence,evidenceReceipt:receipt,appliedChanges:false
  });
}
