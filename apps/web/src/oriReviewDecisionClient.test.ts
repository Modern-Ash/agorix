import { describe,expect,it,vi } from "vitest";
import { requestOriReviewDecision } from "./oriReviewDecisionClient.js";
const ticketId="123e4567-e89b-42d3-a456-426614174000";
describe("Ori same-origin review decision client",()=>{
  it("sends only ticket ID and decision with same-origin credentials",async()=>{
    const fetchMock=vi.fn(async()=>({
      ok:true,status:200,json:async()=>({status:"rejected",appliedChanges:false})
    })) as unknown as typeof fetch;
    expect(await requestOriReviewDecision(ticketId,"reject",fetchMock)).toBe("rejected");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url,init]=vi.mocked(fetchMock).mock.calls[0]!;
    expect(url).toBe("/api/tutor/ori/review/decision");
    expect(init?.credentials).toBe("same-origin");
    expect(JSON.parse(init?.body as string)).toEqual({ticketId,decision:"reject"});
  });
  it("rejects invalid ticket before network access",async()=>{
    const fetchMock=vi.fn() as unknown as typeof fetch;
    expect(await requestOriReviewDecision("invalid","accept",fetchMock)).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not claim success for server errors or auto-apply",async()=>{
    const denied=vi.fn(async()=>({ok:false,status:401})) as unknown as typeof fetch;
    expect(await requestOriReviewDecision(ticketId,"accept",denied)).toBe("unavailable");
    const invalid=vi.fn(async()=>({ok:true,status:200,json:async()=>({status:"accepted",appliedChanges:true})})) as unknown as typeof fetch;
    expect(await requestOriReviewDecision(ticketId,"accept",invalid)).toBe("unavailable");
  });
});
