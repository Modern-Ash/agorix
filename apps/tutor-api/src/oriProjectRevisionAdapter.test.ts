import { describe,expect,it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriProjectRevisionAdapter } from "./oriProjectRevisionAdapter.js";
const hash="a".repeat(64);
const record={ownerId:"student",projectId:"project-a",revision:3,semanticHash:hash};
const repository={
  get:async(owner:string,id:string)=>{
    if(owner!=="student" || id!=="project-a")throw Error("not found");
    return record;
  }
} as unknown as ProjectRepository;
describe("Ori canonical repository revision adapter",()=>{
  it("reads the trusted semantic hash for an authorized project",async()=>{
    const adapter=createOriProjectRevisionAdapter(repository);
    expect(await adapter.resolve("student","project-a")).toEqual({
      owner:"student",projectId:"project-a",revision:hash,repositoryRevision:3
    });
    expect(await adapter.currentRevision("student","project-a")).toBe(hash);
  });
  it("fails closed for another owner or missing project",async()=>{
    const adapter=createOriProjectRevisionAdapter(repository);
    expect(await adapter.resolve("intruder","project-a")).toBeNull();
    expect(await adapter.currentRevision("student","missing")).toBeNull();
  });
  it("rejects malformed revision metadata",async()=>{
    const invalid={get:async()=>({...record,semanticHash:"not-a-hash"})} as unknown as ProjectRepository;
    expect(await createOriProjectRevisionAdapter(invalid).resolve("student","project-a")).toBeNull();
  });
});
