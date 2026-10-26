import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriCanonicalReviewWorkflow } from "./oriCanonicalReviewWorkflow.js";

const oriRoot=process.env["ORI_REPO_PATH"];
const runnable=!!oriRoot && isAbsolute(oriRoot) &&
  existsSync(resolve(oriRoot,"examples/host-evidence-cli.mjs"));
if(oriRoot && !runnable)throw Error("ORI_REPO_PATH lacks host-evidence-cli.mjs");
const revision="a".repeat(64);
const record={
  ownerId:"student",projectId:"project-a",revision:1,semanticHash:revision,
  storedProject:{program:{schema:"agorix/program/v1",scripts:[{
    id:"main",trigger:{type:"onStart"},statements:[{type:"move",steps:1}]
  }]}}
};
describe.skipIf(!runnable)("real canonical program to independent Ori process to review",()=>{
  it("produces a review-only ticket, denies another owner, and never writes",async()=>{
    let writes=0;
    const repository={
      get:async(owner:string,id:string)=>{
        if(owner!=="student" || id!=="project-a")throw Error("not found");
        return record;
      },
      update:async()=>{writes++;throw Error("write forbidden");}
    } as unknown as ProjectRepository;
    const workflow=createOriCanonicalReviewWorkflow({
      repository,oriRoot:oriRoot!,world:{goal:{x:10,y:0}},
      learningContext:async()=>({attempts:1,hintsUsed:1,learningStage:"connect"})
    });
    const ticket=await workflow.propose("student","project-a");
    expect(ticket?.status).toBe("pending");
    expect(ticket?.appliedChanges).toBe(false);
    expect(await workflow.read("intruder","project-a",ticket!.id)).toBeNull();
    expect(await workflow.decide("intruder","project-a",ticket!.id,"accept")).toBeNull();
    expect((await workflow.decide("student","project-a",ticket!.id,"reject"))?.status).toBe("rejected");
    expect(writes).toBe(0);
  },20000);
  it("fails closed when trusted learning history is unavailable",async()=>{
    const repository={get:async()=>record} as unknown as ProjectRepository;
    const workflow=createOriCanonicalReviewWorkflow({
      repository,oriRoot:oriRoot!,world:{},
      learningContext:async()=>null
    });
    expect(await workflow.propose("student","project-a")).toBeNull();
  },20000);
});
