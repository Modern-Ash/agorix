import { describe,expect,it,vi } from "vitest";
import { parseOriIssuedProposal,requestOriProposal } from "./oriProposalIssuanceClient.js";
const value={
  ticketId:"123e4567-e89b-42d3-a456-426614174000",appliedChanges:false,
  proposal:{schemaVersion:"ori/proposal/v0",operation:"append",
    requiresLearnerApproval:true,blocks:[{kind:"move",steps:1}]}
};
describe("Ori proposal issuance browser contract",()=>{
  it("accepts only validated server-issued tickets",()=>{
    expect(parseOriIssuedProposal(value)).toEqual(value);
    expect(parseOriIssuedProposal({...value,appliedChanges:true})).toBeNull();
    expect(parseOriIssuedProposal({...value,ownerId:"forged"})).toBeNull();
    expect(parseOriIssuedProposal({...value,proposal:{...value.proposal,autoApply:true}})).toBeNull();
  });
  it("requests proposal without transmitting learner identity or program",async()=>{
    const fetchMock=vi.fn(async()=>({ok:true,json:async()=>value})) as unknown as typeof fetch;
    expect(await requestOriProposal(fetchMock)).toEqual(value);
    const [url,options]=vi.mocked(fetchMock).mock.calls[0]!;
    expect(url).toBe("/api/tutor/ori/review/propose");
    expect(options?.credentials).toBe("same-origin");
    expect(options?.headers).toMatchObject({"x-agorix-request":"1"});
    expect(options?.body).toBe("{}");
  });
  it("fails closed for server errors",async()=>{
    const fetchMock=vi.fn(async()=>({ok:false,status:401})) as unknown as typeof fetch;
    expect(await requestOriProposal(fetchMock)).toBeNull();
  });
});
