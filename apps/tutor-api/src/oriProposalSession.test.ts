import { describe,expect,it } from "vitest";
import { beginOriProposalReview,decideOriProposalReview } from "./oriProposalSession.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
const proposal={schemaVersion:"ori/proposal/v0",operation:"append",
  requiresLearnerApproval:true,blocks:[{kind:"move",steps:1}]};
const response:OriHostEvidenceResult={
  status:"ready",proposal,
  evidenceReceipt:{programRevision:"a".repeat(64),digest:"b".repeat(64),complete:true},
  requiresLearnerApproval:true,appliedChanges:false
};
describe("Ori learner proposal lifecycle",()=>{
  it("opens a review-only session",()=>{
    expect(beginOriProposalReview(response)).toMatchObject({status:"pending",appliedChanges:false});
  });
  it.each([["accept","accepted"],["edit","edited"],["reject","rejected"]] as const)(
    "records %s without mutating project", (decision,status)=>{
      const session=beginOriProposalReview(response)!;
      const result=decideOriProposalReview(session,"a".repeat(64),decision);
      expect(result.status).toBe(status);
      expect(result.appliedChanges).toBe(false);
      expect(decideOriProposalReview(result,"a".repeat(64),decision)).toBe(result);
    }
  );
  it("blocks stale revisions",()=>{
    const session=beginOriProposalReview(response)!;
    expect(decideOriProposalReview(session,"c".repeat(64),"accept").status).toBe("stale");
  });
  it("does not open sessions for absent proposals",()=>{
    expect(beginOriProposalReview({...response,proposal:null})).toBeNull();
  });
});
