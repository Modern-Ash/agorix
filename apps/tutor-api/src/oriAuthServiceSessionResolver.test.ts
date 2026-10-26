import { describe,expect,it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthService } from "@agorix/auth-service";
import { createOriAuthServiceSessionResolver } from "./oriAuthServiceSessionResolver.js";
const token="A".repeat(48);
const request=(cookie:string)=>({headers:{cookie}} as IncomingMessage);
const result={
  account:{accountId:"learner",status:"active"},
  session:{accountId:"learner",sessionId:"session-1"},
  rotated:false
};
const writableResponse=()=>({headersSent:false,writableEnded:false} as ServerResponse);
describe("Ori canonical AuthService session resolver",()=>{
  it("accepts a validated session from the canonical auth service",async()=>{
    const auth={resolveSession:async()=>result} as unknown as Pick<AuthService,"resolveSession">;
    expect(await createOriAuthServiceSessionResolver(auth)(request("agorix_session="+token),writableResponse()))
      .toEqual({accountId:"learner",sessionId:"session-1"});
  });
  it("rejects missing, duplicate or malformed cookies",async()=>{
    let calls=0;
    const auth={resolveSession:async()=>{calls++;return result;}} as unknown as Pick<AuthService,"resolveSession">;
    const resolve=createOriAuthServiceSessionResolver(auth);
    expect(await resolve(request(""))).toBeNull();
    expect(await resolve(request("agorix_session=x"))).toBeNull();
    expect(await resolve(request("agorix_session="+token+"; agorix_session="+token))).toBeNull();
    expect(calls).toBe(0);
  });
  it("fails closed for rotated, expired and mismatched sessions",async()=>{
    for(const value of [
      {...result,rotated:true},
      {...result,session:{accountId:"other",sessionId:"session-1"}},
      {...result,account:{accountId:"learner",status:"disabled"}}
    ]){
      const auth={resolveSession:async()=>value} as unknown as Pick<AuthService,"resolveSession">;
      expect(await createOriAuthServiceSessionResolver(auth)(request("agorix_session="+token),writableResponse())).toBeNull();
    }
    const expired={resolveSession:async()=>{throw Error("expired");}} as unknown as Pick<AuthService,"resolveSession">;
    expect(await createOriAuthServiceSessionResolver(expired)(request("agorix_session="+token),writableResponse())).toBeNull();
  });
});
