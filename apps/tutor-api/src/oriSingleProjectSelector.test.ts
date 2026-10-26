import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriSingleProjectSelector } from "./oriSingleProjectSelector.js";

const session={accountId:"learner",sessionId:"session-1"};
const project={ownerId:"learner",projectId:"project-a"};
const repo=(items:unknown[],nextCursor?:string)=>({
  list:async()=>({items,...(nextCursor?{nextCursor}:{})})
}) as unknown as Pick<ProjectRepository,"list">;

describe("Ori server-side single-project selector",()=>{
  it("selects the only project owned by the authenticated account",async()=>{
    expect(await createOriSingleProjectSelector(repo([project]))(session)).toBe("project-a");
  });
  it("fails closed for zero or multiple projects",async()=>{
    expect(await createOriSingleProjectSelector(repo([]))(session)).toBeNull();
    expect(await createOriSingleProjectSelector(repo([project,project]))(session)).toBeNull();
  });
  it("fails closed for paginated results, mismatched owner and repository errors",async()=>{
    expect(await createOriSingleProjectSelector(repo([project],"next"))(session)).toBeNull();
    expect(await createOriSingleProjectSelector(repo([{...project,ownerId:"other"}]))(session)).toBeNull();
    const failing={list:async()=>{throw Error("database unavailable");}} as unknown as Pick<ProjectRepository,"list">;
    expect(await createOriSingleProjectSelector(failing)(session)).toBeNull();
  });
});
