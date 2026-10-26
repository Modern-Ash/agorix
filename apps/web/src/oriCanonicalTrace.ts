import type { RunResult } from "@agorix/runtime";

/**
 * Privacy-minimized read-only adapter for Ori's trace v1 contract.
 * The canonical Agorix runtime is the only source of execution evidence.
 * No node IDs, coordinates, learner text, world state, or source code cross.
 */
export interface OriTraceStep {
  readonly index: number;
  readonly description: string;
}
export interface OriTraceEvidence {
  readonly steps: readonly OriTraceStep[];
}
export interface OriTraceEnvelope {
  readonly status: "ready" | "unavailable";
  readonly evidence?: OriTraceEvidence;
  readonly expectedSteps?: number;
  readonly outcome?: RunResult["outcome"];
  readonly appliedChanges: false;
}
const MAX_STEPS=100;
const KNOWN_KINDS=new Set(["move","turn","repeat","wait","say","if","forever"]);
const unavailable:OriTraceEnvelope=Object.freeze({status:"unavailable",appliedChanges:false});
export function deriveOriTraceEvidence(result:RunResult | undefined):OriTraceEnvelope {
  if (!result || !Number.isSafeInteger(result.stepsUsed) ||
      result.stepsUsed<1 || result.stepsUsed>MAX_STEPS ||
      result.trace.length!==result.stepsUsed ||
      result.outcome!=="completed") return unavailable;
  const steps:OriTraceStep[]=[];
  for(const [index,entry] of result.trace.entries()){
    if(!Number.isSafeInteger(entry.step) || entry.step!==index+1 ||
       typeof entry.statementType!=="string")return unavailable;
    const kind=KNOWN_KINDS.has(entry.statementType)?entry.statementType:"other";
    steps.push(Object.freeze({index,description:`Executed ${kind}`}));
  }
  return Object.freeze({
    status:"ready",
    evidence:Object.freeze({steps:Object.freeze(steps)}),
    expectedSteps:steps.length,
    outcome:result.outcome,
    appliedChanges:false
  });
}
