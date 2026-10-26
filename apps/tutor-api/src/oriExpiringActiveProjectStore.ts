import type { OriActiveProjectStore } from "./oriSessionProjectSelector.js";

export interface OriActiveProjectRecord {
  readonly accountId:string;
  readonly sessionId:string;
  readonly projectId:string;
  readonly expiresAt:number;
}
export interface OriActiveProjectPersistence {
  read(accountId:string,sessionId:string):Promise<OriActiveProjectRecord|null>;
  write(record:OriActiveProjectRecord):Promise<void>;
  delete(accountId:string,sessionId:string):Promise<void>;
}
/**
 * Expiring active-project store backed by an injected durable persistence port.
 * The port must enforce account+session isolation and transactional updates.
 */
export function createOriExpiringActiveProjectStore({
  persistence,now=Date.now,ttlMs=30*60*1000
}:{
  readonly persistence:OriActiveProjectPersistence;
  readonly now?:()=>number;
  readonly ttlMs?:number;
}):OriActiveProjectStore {
  if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>24*60*60*1000)
    throw new TypeError("Invalid active project TTL");
  const valid=(value:string)=>value.length>0&&value.length<=128;
  return Object.freeze({
    async get(accountId:string,sessionId:string):Promise<string|null>{
      if(!valid(accountId)||!valid(sessionId))return null;
      try{
        const record=await persistence.read(accountId,sessionId);
        if(!record)return null;
        if(record.accountId!==accountId||record.sessionId!==sessionId||
           !valid(record.projectId)||!Number.isFinite(record.expiresAt)||
           record.expiresAt<=now()){
          await persistence.delete(accountId,sessionId);
          return null;
        }
        return record.projectId;
      }catch{return null;}
    },
    async set(accountId:string,sessionId:string,projectId:string):Promise<void>{
      if(!valid(accountId)||!valid(sessionId)||!valid(projectId))
        throw new TypeError("Invalid active project identity");
      await persistence.write({accountId,sessionId,projectId,expiresAt:now()+ttlMs});
    },
    async clear(accountId:string,sessionId:string):Promise<void>{
      if(!valid(accountId)||!valid(sessionId))return;
      await persistence.delete(accountId,sessionId);
    }
  });
}
