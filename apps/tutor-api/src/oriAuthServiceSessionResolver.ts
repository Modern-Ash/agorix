import type { IncomingMessage } from "node:http";
import type { AuthService } from "@agorix/auth-service";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";

const COOKIE_NAME="agorix_session";
const MAX_COOKIE_BYTES=4096;
/**
 * Adapter for the canonical AuthService. The trusted reverse proxy must
 * preserve the session cookie and enforce same-origin/CSRF protections.
 * Session rotation must be disabled for this read-only resolver, or handled
 * by middleware capable of writing Set-Cookie.
 */
export function createOriAuthServiceSessionResolver(auth:Pick<AuthService,"resolveSession">) {
  return async(request:IncomingMessage):Promise<OriAuthenticatedSession|null>=>{
    const raw=request.headers.cookie;
    if(!raw || raw.length>MAX_COOKIE_BYTES)return null;
    const pairs=raw.split(";").map(item=>item.trim());
    const matches=pairs.filter(item=>item.startsWith(COOKIE_NAME+"="));
    if(matches.length!==1)return null;
    const token=matches[0]!.slice(COOKIE_NAME.length+1);
    if(!/^[A-Za-z0-9_-]{32,256}$/.test(token))return null;
    try{
      const resolved=await auth.resolveSession(token);
      // A rotated token cannot be safely propagated by this read-only port.
      if(resolved.rotated || resolved.session.accountId!==resolved.account.accountId ||
         resolved.account.status!=="active")return null;
      return {accountId:resolved.account.accountId,sessionId:resolved.session.sessionId};
    }catch{return null;}
  };
}
