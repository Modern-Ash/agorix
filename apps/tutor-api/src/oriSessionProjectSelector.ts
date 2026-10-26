import type { ProjectRepository } from "@agorix/project-repository";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";

export interface OriActiveProjectStore {
  get(accountId:string,sessionId:string):Promise<string|null>;
  set(accountId:string,sessionId:string,projectId:string):Promise<void>;
  clear(accountId:string,sessionId:string):Promise<void>;
}
/**
 * Session-scoped selection for learners with multiple projects.
 * The store is server-owned; project ownership is revalidated on every read.
 */
export function createOriSessionProjectSelector({
  repository,store
}:{
  readonly repository:Pick<ProjectRepository,"get">;
  readonly store:OriActiveProjectStore;
}) {
  const valid=(s:string)=>s.length>0&&s.length<=128;
  const choose=async(session:OriAuthenticatedSession,projectId:string):Promise<boolean>=>{
    if(!valid(session.accountId)||!valid(session.sessionId)||!valid(projectId))return false;
    try{
      const record=await repository.get(session.accountId,projectId);
      if(record.ownerId!==session.accountId||record.projectId!==projectId)return false;
      await store.set(session.accountId,session.sessionId,projectId);
      return true;
    }catch{return false;}
  };
  const activeProject=async(session:OriAuthenticatedSession):Promise<string|null>=>{
    if(!valid(session.accountId)||!valid(session.sessionId))return null;
    try{
      const projectId=await store.get(session.accountId,session.sessionId);
      if(!projectId||!valid(projectId))return null;
      const record=await repository.get(session.accountId,projectId);
      if(record.ownerId!==session.accountId||record.projectId!==projectId){
        await store.clear(session.accountId,session.sessionId);
        return null;
      }
      return projectId;
    }catch{return null;}
  };
  return Object.freeze({choose,activeProject});
}
