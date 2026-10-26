import { describe,expect,it } from "vitest";
import { AuthService,InMemoryAccountRepository,InMemorySessionRepository } from "@agorix/auth-service";
import type { IncomingMessage } from "node:http";
import { createOriAuthServiceSessionResolver } from "./oriAuthServiceSessionResolver.js";

const request=(token:string):IncomingMessage=>({
  headers:{cookie:"agorix_session="+token}
} as IncomingMessage);
const policy={session:{rotateOnResolve:false}};
describe("Ori session resolver with canonical AuthService",()=>{
  it("resolves an actual registered and signed-in account without rotating its token",async()=>{
    const auth=new AuthService({
      accounts:new InMemoryAccountRepository(),
      sessions:new InMemorySessionRepository(),
      policy
    });
    await auth.register({username:"learner-one",password:"long-secure-passphrase-123"});
    const login=await auth.signIn({username:"learner-one",password:"long-secure-passphrase-123"});
    const resolver=createOriAuthServiceSessionResolver(auth);
    const principal=await resolver(request(login.sessionToken));
    expect(principal?.accountId).toBe(login.account.accountId);
    expect(principal?.sessionId).toBe(login.session.sessionId);
    await auth.signOut(login.sessionToken);
    expect(await resolver(request(login.sessionToken))).toBeNull();
  });
});
