import type { ProjectRepository } from "@agorix/project-repository";
import type { RunResult } from "@agorix/runtime";
import { deriveOriTraceEvidence } from "../../web/src/oriCanonicalTrace.js";
import type { TrustedOriProject } from "./oriProjectReviewService.js";

export type OriIntent="help"|"repeat"|"turn"|"move"|"debug";
export interface CanonicalOriExecution {
  readonly result:RunResult;
  /** Execution must use the exact persisted program passed to this callback. */
}
export interface OriExecutionPort {
  (program:Awaited<ReturnType<ProjectRepository["get"]>>["storedProject"]["program"]):Promise<CanonicalOriExecution>;
}
/**
 * Resolve an owner-scoped persisted program, execute via the host's canonical
 * runner, and export only allowlisted, bounded evidence. No browser data is
 * accepted as an authoritative program, grant or revision.
 */
export function createOriPersistedEvidenceResolver({
  repository,execute
}:{readonly repository:ProjectRepository;readonly execute:OriExecutionPort}) {
  return async (owner:string,projectId:string,intent:OriIntent="move"):Promise<TrustedOriProject|null>=>{
    if(!owner || owner.length>128 || !projectId || projectId.length>128)return null;
    if(!["help","repeat","turn","move","debug"].includes(intent))return null;
    try{
      const record=await repository.get(owner,projectId);
      if(record.ownerId!==owner || record.projectId!==projectId ||
         !/^[a-f0-9]{64}$/.test(record.semanticHash))return null;
      const {result}=await execute(record.storedProject.program);
      const evidence=deriveOriTraceEvidence(result);
      if(evidence.status!=="ready" || !evidence.evidence || !evidence.expectedSteps)return null;
      // Only categories understood by the Ori v0 proposal contract are
      // available for proposals; never forward raw node IDs or program data.
      const allowedBlocks=["move","turn"].filter(kind=>
        evidence.operationCounts?.[kind]!==undefined);
      if(allowedBlocks.length===0)return null;
      const current=await repository.get(owner,projectId);
      if(current.semanticHash!==record.semanticHash ||
         current.revision!==record.revision)return null;
      return {
        owner,projectId,revision:record.semanticHash,
        evidence:{
          intent,programRevision:record.semanticHash,
          expectedSteps:evidence.expectedSteps,
          hostContext:{
            sessionId:"host-verified",learningStage:"connect",
            capabilities:["inspectProgram","inspectTrace"],
            grants:["inspectProgram","inspectTrace"],
            attempts:1,hintsUsed:1
          },
          snapshot:{allowedBlocks},
          trace:{steps:evidence.evidence.steps}
        }
      };
    }catch{return null;}
  };
}
