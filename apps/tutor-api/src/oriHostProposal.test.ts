import { describe, expect, it } from "vitest";
import { validateOriHostProposal } from "./oriHostEvidenceAdapter.js";

const allowed=["move","turn"];
const move={schemaVersion:"ori/proposal/v0",operation:"append",
  requiresLearnerApproval:true,blocks:[{kind:"move",steps:1}]};
describe("Ori v2 proposal output boundary",()=>{
  it("accepts only a bounded reviewed move",()=>{
    expect(validateOriHostProposal(move,allowed)).toMatchObject(move);
  });
  it("accepts a reviewed turn",()=>{
    expect(validateOriHostProposal({...move,blocks:[{kind:"turn",direction:"right"}]},allowed)).not.toBeNull();
  });
  it("rejects unauthorized blocks and extra fields",()=>{
    expect(validateOriHostProposal(move,["turn"])).toBeNull();
    expect(validateOriHostProposal({...move,autoApply:true},allowed)).toBeNull();
    expect(validateOriHostProposal({...move,blocks:[{kind:"move",steps:1,script:"secret"}]},allowed)).toBeNull();
    expect(validateOriHostProposal({...move,blocks:[{kind:"shell"}]},allowed)).toBeNull();
  });
  it("rejects oversized moves and non-reviewed proposals",()=>{
    expect(validateOriHostProposal({...move,blocks:[{kind:"move",steps:999}]},allowed)).toBeNull();
    expect(validateOriHostProposal({...move,requiresLearnerApproval:false},allowed)).toBeNull();
  });
  it("permits explicit no-proposal but rejects invalid data",()=>{
    expect(validateOriHostProposal(null,allowed)).toBeNull();
    expect(validateOriHostProposal("malicious",allowed)).toBeNull();
  });
});
