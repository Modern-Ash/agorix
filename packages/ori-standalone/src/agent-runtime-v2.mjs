import { runEducationalAgent } from "./agent-loop-v1.mjs";
import { validateSnapshot, validateTrace, validateProposal, PROPOSAL_SCHEMA } from "./contracts.mjs";
import { ToolAccessError } from "./tools.mjs";

/**
 * Host-controlled educational agent v2: read verified evidence, suggest one
 * bounded change, never mutate. Not a general-purpose coding agent.
 */
export async function runEducationalAgentV2({
  hostContext,intent="help",tools={},signal,deadlineMs=3000
}={}) {
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs<1 || deadlineMs>10000)
    throw new ToolAccessError("Invalid deadline");
  const grants=hostContext?.grants??[];
  const observed={};
  const guarded={
    async inspectProgram() {
      if (!grants.includes("inspectProgram")) throw new ToolAccessError("Program inspection denied");
      const raw=await tools.inspectProgram?.({signal});
      if (raw!=null) observed.program=validateSnapshot(raw);
      return raw;
    },
    async inspectTrace() {
      if (!grants.includes("inspectTrace")) throw new ToolAccessError("Trace inspection denied");
      const raw=await tools.inspectTrace?.({signal});
      if (raw!=null) observed.trace=validateTrace(raw);
      return raw;
    }
  };
  const result=await runEducationalAgent({
    hostContext,intent,tools:guarded,signal,deadlineMs,maxSteps:4
  });
  let proposal=null;
  if (observed.program && ["move","turn"].includes(intent) &&
      hostContext?.hintsUsed>=1 && hostContext?.attempts>=1) {
    const block=intent==="move"?{kind:"move",steps:1}:{kind:"turn",direction:"right"};
    if (observed.program.allowedBlocks.includes(block.kind)) {
      proposal=validateProposal({
        schemaVersion:PROPOSAL_SCHEMA,operation:"append",
        requiresLearnerApproval:true,blocks:[block]
      },observed.program);
    }
  }
  return Object.freeze({
    schemaVersion:"ori/agent-result/v2",
    plan:result.plan,
    evidenceAvailable:result.evidenceAvailable,
    toolsUsed:result.toolsUsed,
    proposal,
    proposalDecision:"pending-host-review",
    requiresLearnerApproval:true,
    appliedChanges:false
  });
}
