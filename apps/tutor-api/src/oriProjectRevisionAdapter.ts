import type { ProjectRepository } from "@agorix/project-repository";

/**
 * Trusted project lookup. Owner ID must come from authenticated middleware,
 * never from an arbitrary request field.
 */
export interface OriCanonicalProjectIdentity {
  readonly owner:string;
  readonly projectId:string;
  readonly revision:string;
  readonly repositoryRevision:number;
}
const HEX=/^[a-f0-9]{64}$/;
export function createOriProjectRevisionAdapter(repository:ProjectRepository) {
  const resolve=async(owner:string,projectId:string):Promise<OriCanonicalProjectIdentity|null>=>{

      if(!owner || owner.length>128 || !projectId || projectId.length>128)return null;
      try{
        const record=await repository.get(owner,projectId);
        if(record.ownerId!==owner || record.projectId!==projectId ||
           !Number.isSafeInteger(record.revision) || record.revision<1 ||
           !HEX.test(record.semanticHash))return null;
        return Object.freeze({
          owner,projectId,revision:record.semanticHash,repositoryRevision:record.revision
        });
      }catch{return null;}
  };
  return Object.freeze({
    resolve,
    async currentRevision(owner:string,projectId:string):Promise<string|null> {
      const project=await resolve(owner,projectId);
      return project?.revision??null;
    }
  });
}
