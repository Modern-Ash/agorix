import type { IncomingMessage, ServerResponse } from "node:http";
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
export function createOriAuthServiceSessionResolver(auth:Pick<AuthService,"resolveSession">, options:{readonly cookieName?:string;readonly secure?:boolean}={}) {
  const cookieName=options.cookieName??COOKIE_NAME;
  if(!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(cookieName))throw new TypeError("Invalid cookie name");
  return async(request:IncomingMessage,response?:ServerResponse):Promise<OriAuthenticatedSession|null>=>{
    const raw=request.headers.cookie;
    if(!raw || raw.length>MAX_COOKIE_BYTES)return null;
    const pairs=raw.split(";").map(item=>item.trim());
    const matches=pairs.filter(item=>item.startsWith(cookieName+"="));
    if(matches.length!==1)return null;
    const token=matches[0]!.slice(cookieName.length+1);
    if(!/^[A-Za-z0-9_-]{32,256}$/.test(token))return null;
    // Resolving may rotate and revoke the presented token. Never do so
    // without a response capable of carrying its replacement.
    if(!response || response.headersSent || response.writableEnded)return null;
    try{
      const resolved=await auth.resolveSession(token);
      // Only authorize after verifying the account/session binding.
      if(resolved.session.accountId!==resolved.account.accountId ||
         resolved.account.status!=="active")return null;
      if(resolved.rotated){
        if(response.headersSent || response.writableEnded ||
           !/^[A-Za-z0-9_-]{32,256}$/.test(resolved.sessionToken))return null;
        const cookie=cookieName+"="+resolved.sessionToken+
          "; Path=/; HttpOnly; SameSite=Strict"+(options.secure===false?"":"; Secure");
        const prior=response.getHeader("set-cookie");
        response.setHeader("set-cookie",[
          ...(typeof prior==="string"?[prior]:Array.isArray(prior)?prior.map(String):[]),
          cookie
        ]);
      }
      return {accountId:resolved.account.accountId,sessionId:resolved.session.sessionId};
    }catch{return null;}
  };
}
