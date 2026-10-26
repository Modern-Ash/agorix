import { describe,expect,it } from "vitest";
import { AuthService,InMemoryAccountRepository,InMemorySessionRepository } from "@agorix/auth-service";
import type { IncomingMessage,ServerResponse } from "node:http";
import { createOriAuthServiceSessionResolver } from "./oriAuthServiceSessionResolver.js";

const request=(token:string)=>({headers:{cookie:"agorix_session="+token}} as IncomingMessage);
function response() {
  const headers=new Map<string,unknown>();
  return {
    headers,
    res:{
      headersSent:false,
      getHeader:(name:string)=>headers.get(name),
      setHeader:(name:string,value:unknown)=>{headers.set(name,value);}
    } as unknown as ServerResponse
  };
}
describe("Ori rotating session with canonical AuthService",()=>{
  it("rotates a real token, writes replacement cookie and rejects the previous token",async()=>{
    const auth=new AuthService({
      accounts:new InMemoryAccountRepository(),
      sessions:new InMemorySessionRepository()
    });
    await auth.register({username:"ori-learner",password:"long-secure-passphrase-123"});
    const login=await auth.signIn({username:"ori-learner",password:"long-secure-passphrase-123"});
    const first=response();
    const resolver=createOriAuthServiceSessionResolver(auth);
    const identity=await resolver(request(login.sessionToken),first.res);
    expect(identity?.accountId).toBe(login.account.accountId);
    const cookies=first.headers.get("set-cookie") as string[];
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toContain("; HttpOnly; SameSite=Strict; Secure");
    const rotated=cookies[0]!.split(";")[0]!.split("=")[1]!;
    expect(rotated).not.toBe(login.sessionToken);
    expect(await resolver(request(login.sessionToken),response().res)).toBeNull();
    const second=response();
    expect((await resolver(request(rotated),second.res))?.accountId).toBe(login.account.accountId);
  });
});
