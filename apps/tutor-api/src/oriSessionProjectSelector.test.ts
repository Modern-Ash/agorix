import { describe,expect,it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriSessionProjectSelector,type OriActiveProjectStore } from "./oriSessionProjectSelector.js";

const session={accountId:"learner",sessionId:"session-a"};
const records=new Map([["project-a",{ownerId:"learner",projectId:"project-a"}],
  ["project-b",{ownerId:"learner",projectId:"project-b"}]]);
function fixture(){
  const entries=new Map<string,string>();
  const store:OriActiveProjectStore={
    get:async(account,id)=>entries.get(account+":"+id)??null,
    set:async(account,id,project)=>{entries.set(account+":"+id,project);},
    clear:async(account,id)=>{entries.delete(account+":"+id);}
  };
  const repository={get:async(_owner:string,id:string)=>{
    const record=records.get(id);
    if(!record)throw Error("not found");
    return record;
  }} as unknown as Pick<ProjectRepository,"get">;
  return {selector:createOriSessionProjectSelector({repository,store}),entries};
}
describe("Ori authenticated multi-project selection",()=>{
  it("chooses and restores a project within the authenticated session",async()=>{
    const {selector}=fixture();
    expect(await selector.choose(session,"project-b")).toBe(true);
    expect(await selector.activeProject(session)).toBe("project-b");
    expect(await selector.activeProject({...session,sessionId:"other"})).toBeNull();
  });
  it("rejects missing or foreign projects",async()=>{
    const {selector}=fixture();
    expect(await selector.choose(session,"missing")).toBe(false);
    expect(await selector.activeProject(session)).toBeNull();
  });
  it("invalidates selection when ownership changes",async()=>{
    const {selector}=fixture();
    expect(await selector.choose(session,"project-a")).toBe(true);
    records.set("project-a",{ownerId:"other",projectId:"project-a"});
    expect(await selector.activeProject(session)).toBeNull();
    records.set("project-a",{ownerId:"learner",projectId:"project-a"});
  });
});
