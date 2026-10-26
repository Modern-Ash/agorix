import { runProgram, createWorldState, type WorldStateInput } from "@agorix/runtime";
import type { ProjectProgram } from "@agorix/program-model";
import type { OriExecutionPort } from "./oriPersistedEvidenceResolver.js";

/**
 * Deterministic, read-only execution of a validated persisted program.
 * A trusted host supplies the initial world; never accept it from a browser.
 */
export function createOriCanonicalExecutionPort({
  world,maxSteps=100
}:{readonly world:WorldStateInput;readonly maxSteps?:number}):OriExecutionPort {
  if(!Number.isSafeInteger(maxSteps) || maxSteps<1 || maxSteps>100)
    throw new TypeError("Invalid Ori execution budget");
  return async(program:ProjectProgram)=>{
    const result=runProgram(program,createWorldState(world),{maxSteps});
    return {result};
  };
}
