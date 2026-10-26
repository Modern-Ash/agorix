import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthService } from "@agorix/auth-service";
import { createOriAuthServiceSessionResolver } from "./oriAuthServiceSessionResolver.js";

const token="A".repeat(48);
const next="B".repeat(48);
const request={headers:{cookie:"agorix_session="+token}} as IncomingMessage;
const resolved={
  rotated:true,sessionToken:next,
  account:{accountId:"learner",status:"active"},
  session:{accountId:"learner",sessionId:"session-1"}
};
describe("Ori rotating session propagation",()=>{
  it("writes secure replacement cookie before granting identity",async()=>{
    const headers=new Map<string,unknown>();
    const response={
      headersSent:false,
      getHeader:(key:string)=>headers.get(key),
      setHeader:(key:string,value:unknown)=>{headers.set(key,value);}
    } as unknown as ServerResponse;
    const auth={resolveSession:vi.fn(async()=>resolved)} as unknown as Pick<AuthService,"resolveSession">;
    const identity=await createOriAuthServiceSessionResolver(auth)(request,response);
    expect(identity).toEqual({accountId:"learner",sessionId:"session-1"});
    expect(headers.get("set-cookie")).toEqual([
      "agorix_session="+next+"; Path=/; HttpOnly; SameSite=Strict; Secure"
    ]);
  });
  it("denies rotating sessions without a writable response",async()=>{
    let calls=0;
    const auth={resolveSession:async()=>{calls++;return resolved;}} as unknown as Pick<AuthService,"resolveSession">;
    expect(await createOriAuthServiceSessionResolver(auth)(request)).toBeNull();
    const response={headersSent:true} as ServerResponse;
    expect(await createOriAuthServiceSessionResolver(auth)(request,response)).toBeNull();
    expect(calls).toBe(0);
  });
});
