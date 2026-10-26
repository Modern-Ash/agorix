import { describe,expect,it } from "vitest";
import { validateOriRevisionAtReview } from "./oriProposalReview.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
const result:OriHostEvidenceResult={
  status:"ready",proposal:null,
  evidenceReceipt:{programRevision:"a".repeat(64),digest:"b".repeat(64),complete:true},
  requiresLearnerApproval:true,appliedChanges:false
};
describe("Ori proposal review revision gate",()=>{
  it("records a non-applying review for current revision",()=>{
    expect(validateOriRevisionAtReview(result,"a".repeat(64),"accept"))
      .toEqual({status:"reviewed",decision:"accept",appliedChanges:false});
  });
  it("rejects stale program revisions",()=>{
    expect(validateOriRevisionAtReview(result,"c".repeat(64),"accept").status).toBe("stale");
  });
  it("rejects malformed revision or unavailable result",()=>{
    expect(validateOriRevisionAtReview(result,"invalid","accept").status).toBe("invalid");
    expect(validateOriRevisionAtReview({...result,status:"unavailable"},"a".repeat(64),"accept").status).toBe("invalid");
  });
});
