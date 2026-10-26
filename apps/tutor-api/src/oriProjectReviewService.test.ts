import { describe,expect,it } from "vitest";
import { createOriProjectReviewService,type TrustedOriProject } from "./oriProjectReviewService.js";
import { createOriReviewRegistry } from "./oriReviewRegistry.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
const revision="a".repeat(64);
const evidence={
  intent:"move" as const,programRevision:revision,expectedSteps:1,
  hostContext:{sessionId:"synthetic",learningStage:"connect" as const,
    capabilities:["inspectProgram","inspectTrace"] as const,grants:["inspectProgram","inspectTrace"] as const,
    attempts:1,hintsUsed:1},
  snapshot:{allowedBlocks:["move"]},trace:{steps:[{index:0,description:"Executed move"}]}
};
const response:OriHostEvidenceResult={
  status:"ready",proposal:{schemaVersion:"ori/proposal/v0",operation:"append",
    requiresLearnerApproval:true,blocks:[{kind:"move",steps:1}]},
  evidenceReceipt:{programRevision:revision,digest:"b".repeat(64),complete:true},
  requiresLearnerApproval:true,appliedChanges:false
};
const project=(owner="student",rev=revision):TrustedOriProject=>({
  owner,projectId:"project-a",revision:rev,evidence
});
describe("trusted Ori project review orchestration",()=>{
  it("issues and decides only for an authorized project",async()=>{
    const registry=createOriReviewRegistry({currentRevision:async()=>revision});
    const service=createOriProjectReviewService({
      registry,authorizeProject:async(owner,id)=>owner==="student"&&id==="project-a",resolveProject:async(owner,id)=>owner==="student"&&id==="project-a"?project():null,
      runOri:async()=>response
    });
    const ticket=await service.propose("student","project-a");
    expect(ticket?.status).toBe("pending");
    expect(await service.propose("intruder","project-a")).toBeNull();
    expect(await service.decide("intruder","project-a",ticket!.id,"accept")).toBeNull();
    expect((await service.decide("student","project-a",ticket!.id,"reject"))?.status).toBe("rejected");
  });
  it("rejects changed revision after Ori returns",async()=>{
    let calls=0;
    const service=createOriProjectReviewService({
      registry:createOriReviewRegistry({currentRevision:async()=>revision}),
      authorizeProject:async()=>true,
      resolveProject:async()=>{calls++;return project("student",calls===1?revision:"c".repeat(64));},
      runOri:async()=>response
    });
    expect(await service.propose("student","project-a")).toBeNull();
  });
  it("rejects receipt revision mismatch",async()=>{
    const service=createOriProjectReviewService({
      registry:createOriReviewRegistry({currentRevision:async()=>revision}),
      authorizeProject:async()=>true,
      resolveProject:async()=>project(),
      runOri:async()=>({...response,evidenceReceipt:{...response.evidenceReceipt!,programRevision:"c".repeat(64)}})
    });
    expect(await service.propose("student","project-a")).toBeNull();
  });
});
