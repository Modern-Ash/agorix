import { describe,expect,it } from "vitest";
import { createOriReviewRegistry } from "./oriReviewRegistry.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
const revision="a".repeat(64);
const result:OriHostEvidenceResult={
  status:"ready",requiresLearnerApproval:true,appliedChanges:false,
  proposal:{schemaVersion:"ori/proposal/v0",operation:"append",requiresLearnerApproval:true,blocks:[{kind:"move",steps:1}]},
  evidenceReceipt:{programRevision:revision,digest:"b".repeat(64),complete:true}
};
describe("Ori review ticket ownership",()=>{
  it("allows only the original owner to read or decide",async()=>{
    const registry=createOriReviewRegistry({currentRevision:async()=>revision});
    const ticket=registry.issue(result,"learner-a")!;
    expect(registry.read(ticket.id,"learner-b")).toBeNull();
    expect(await registry.decide(ticket.id,"learner-b","accept")).toBeNull();
    expect(registry.read(ticket.id,"learner-a")?.status).toBe("pending");
    expect((await registry.decide(ticket.id,"learner-a","reject"))?.status).toBe("rejected");
  });
  it("rejects empty and oversized owner IDs",()=>{
    const registry=createOriReviewRegistry({currentRevision:async()=>revision});
    expect(registry.issue(result,"")).toBeNull();
    expect(registry.issue(result,"x".repeat(129))).toBeNull();
  });
});
