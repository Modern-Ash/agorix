import type { OriActiveProjectPersistence } from "./oriExpiringActiveProjectStore.js";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";

/**
 * Coordinates the active-project selection with authenticated session
 * lifecycle events. The caller must invoke these hooks from trusted auth
 * middleware, never from a browser-provided session identifier.
 */
export function createOriActiveProjectSessionLifecycle(
  persistence:OriActiveProjectPersistence
) {
  const valid=(s:string)=>s.length>0&&s.length<=128;
  return Object.freeze({
    async signedOut(session:OriAuthenticatedSession):Promise<void>{
      if(!valid(session.accountId)||!valid(session.sessionId))return;
      await persistence.delete(session.accountId,session.sessionId);
    },
    async rotated(previous:OriAuthenticatedSession,next:OriAuthenticatedSession):Promise<boolean>{
      if(!valid(previous.accountId)||!valid(previous.sessionId)||
         !valid(next.accountId)||!valid(next.sessionId)||
         previous.accountId!==next.accountId)return false;
      if(previous.sessionId===next.sessionId)return true;
      const old=await persistence.read(previous.accountId,previous.sessionId);
      if(!old)return true;
      if(old.accountId!==previous.accountId||old.sessionId!==previous.sessionId)return false;
      if(old.expiresAt<=Date.now()){
        await persistence.delete(previous.accountId,previous.sessionId);
        return true;
      }
      await persistence.write({...old,sessionId:next.sessionId});
      await persistence.delete(previous.accountId,previous.sessionId);
      return true;
    }
  });
}
