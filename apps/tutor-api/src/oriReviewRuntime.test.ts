import { describe,expect,it } from "vitest";
import type { AuthService } from "@agorix/auth-service";
import type { ProjectRepository } from "@agorix/project-repository";
import { openOriReviewRuntime } from "./oriReviewRuntime.js";

describe("Ori runtime production dependency composition",()=>{
  it("requires the caller-owned canonical auth and project repository",async()=>{
    const auth={resolveSession:async()=>{throw Error("no session");}} as unknown as Pick<AuthService,"resolveSession">;
    const repository={get:async(owner:string,id:string)=>({
      ownerId:owner,projectId:id
    })} as unknown as ProjectRepository;
    const runtime=openOriReviewRuntime({
      auth,repository,dbPath:":memory:",oriRoot:"/test-only",
      world:{},learningContext:async()=>null,
      runOriOverride:async()=>({status:"unavailable",requiresLearnerApproval:true,appliedChanges:false})
    });
    try{
      expect(runtime.options.oriReviewEnabled).toBe(true);
      const session={accountId:"learner",sessionId:"session-a"};
      expect(await runtime.chooseProject(session,"project-a")).toBe(true);
      expect(await runtime.options.oriReviewIdentity({headers:{}} as never)).toBeNull();
      expect(await runtime.options.oriReviewPropose("learner","project-a")).toBeNull();
      await runtime.signedOut(session);
    }finally{runtime.close();}
  });
});
