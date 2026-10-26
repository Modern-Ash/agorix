import type { ProjectRepository } from "@agorix/project-repository";
import type { WorldStateInput } from "@agorix/runtime";
import { createOriCanonicalExecutionPort } from "./oriCanonicalExecutionPort.js";
import { createOriPersistedEvidenceResolver } from "./oriPersistedEvidenceResolver.js";
import { createOriHostEvidenceAdapter } from "./oriHostEvidenceAdapter.js";
import { createOriProjectReviewService } from "./oriProjectReviewService.js";
import { createOriReviewRegistry } from "./oriReviewRegistry.js";

export interface OriLearningContext {
  readonly attempts:number;
  readonly hintsUsed:number;
  readonly learningStage:"explore"|"connect"|"translate";
}
/**
 * Trusted server-only composition of canonical repository -> runtime ->
 * evidence -> independent Ori process -> review ticket. The caller supplies
 * authenticated owner identity and a real pedagogical evidence source.
 */
export function createOriCanonicalReviewWorkflow({
  repository,oriRoot,world,learningContext
}:{
  readonly repository:ProjectRepository;
  readonly oriRoot:string;
  readonly world:WorldStateInput;
  readonly learningContext:(owner:string,projectId:string)=>Promise<OriLearningContext|null>;
}) {
  const execute=createOriCanonicalExecutionPort({world,maxSteps:100});
  const resolve=createOriPersistedEvidenceResolver({repository,execute,learningContext});
  const runOri=createOriHostEvidenceAdapter({oriRoot});
  const ticketProjects=new Map<string,{owner:string;projectId:string}>();
  const registry=createOriReviewRegistry({
    currentRevision:async id=>{
      const binding=ticketProjects.get(id);
      if(!binding)return "";
      try{
        const record=await repository.get(binding.owner,binding.projectId);
        return record.semanticHash;
      }catch{return "";}
    }
  });
  const service=createOriProjectReviewService({
    resolveProject:async(owner,projectId)=>resolve(owner,projectId,"move"),
    runOri,registry
  });
  return Object.freeze({
    async propose(owner:string,projectId:string){
      const ticket=await service.propose(owner,projectId);
      if(ticket)ticketProjects.set(ticket.id,{owner,projectId});
      return ticket;
    },
    async decide(owner:string,projectId:string,ticketId:string,decision:"accept"|"edit"|"reject"){
      const ticket=await service.decide(owner,projectId,ticketId,decision);
      if(ticket && ticket.status!=="pending")ticketProjects.delete(ticketId);
      return ticket;
    },
    async read(owner:string,projectId:string,ticketId:string){
      // Revalidate project access; the registry's owner/project match alone
      // is not proof that ownership remains valid.
      try{
        const record=await repository.get(owner,projectId);
        if(record.ownerId!==owner || record.projectId!==projectId)return null;
        return service.read(owner,projectId,ticketId);
      }catch{return null;}
    }
  });
}
