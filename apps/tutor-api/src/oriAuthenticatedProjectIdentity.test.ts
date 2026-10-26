import { describe,expect,it } from "vitest";
import type { IncomingMessage } from "node:http";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriAuthorizedProjectIdentityResolver } from "./oriAuthenticatedProjectIdentity.js";
const request={} as IncomingMessage;
const session={accountId:"student-a",sessionId:"session-1"};
const project={ownerId:"student-a",projectId:"project-a"};
const repository={get:async(owner:string,id:string)=>{
  if(owner!=="student-a" || id!=="project-a")throw Error("not found");
  return project;
}} as unknown as ProjectRepository;
describe("Ori authenticated project identity",()=>{
  it("resolves a server-owned active project for an authenticated learner",async()=>{
    const resolver=createOriAuthorizedProjectIdentityResolver({
      resolveSession:async()=>session,
      activeProject:async()=> "project-a",
      repository
    });
    expect(await resolver(request)).toEqual({ownerId:"student-a",projectId:"project-a"});
  });
  it("rejects guests, missing active projects and revoked access",async()=>{
    const guest=createOriAuthorizedProjectIdentityResolver({
      resolveSession:async()=>null,activeProject:async()=> "project-a",repository
    });
    expect(await guest(request)).toBeNull();
    const missing=createOriAuthorizedProjectIdentityResolver({
      resolveSession:async()=>session,activeProject:async()=>null,repository
    });
    expect(await missing(request)).toBeNull();
    const revoked=createOriAuthorizedProjectIdentityResolver({
      resolveSession:async()=>session,activeProject:async()=> "other-project",repository
    });
    expect(await revoked(request)).toBeNull();
  });
  it("does not trust browser-provided project or owner fields",async()=>{
    const forged={headers:{"x-project-id":"project-b","x-owner-id":"admin"},
      url:"/api/tutor/ori/review/propose?projectId=project-b"} as unknown as IncomingMessage;
    const resolver=createOriAuthorizedProjectIdentityResolver({
      resolveSession:async()=>session,activeProject:async()=> "project-a",repository
    });
    expect(await resolver(forged)).toEqual({ownerId:"student-a",projectId:"project-a"});
  });
  it("fails closed on malformed session or repository errors",async()=>{
    const resolver=createOriAuthorizedProjectIdentityResolver({
      resolveSession:async()=>({...session,accountId:""}),
      activeProject:async()=> "project-a",repository
    });
    expect(await resolver(request)).toBeNull();
  });
});
