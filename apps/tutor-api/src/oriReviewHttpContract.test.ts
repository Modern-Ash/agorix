import { describe,expect,it } from "vitest";
import { parseOriReviewHttpRequest,validateOriReviewPrincipal } from "./oriReviewHttpContract.js";
const ticketId="123e4567-e89b-42d3-a456-426614174000";
describe("Ori review HTTP trust boundary",()=>{
  it("accepts only opaque ticket and decision",()=>{
    expect(parseOriReviewHttpRequest({ticketId,decision:"reject"})).toEqual({ticketId,decision:"reject"});
  });
  it("rejects browser-supplied owner, project, revision and grants",()=>{
    for(const key of ["ownerId","projectId","revision","grants","program"]){
      expect(parseOriReviewHttpRequest({ticketId,decision:"accept",[key]:"forged"})).toBeNull();
    }
  });
  it("rejects malformed ticket and unsupported decisions",()=>{
    expect(parseOriReviewHttpRequest({ticketId:"x",decision:"accept"})).toBeNull();
    expect(parseOriReviewHttpRequest({ticketId,decision:"apply"})).toBeNull();
  });
  it("requires a trusted nonempty principal",()=>{
    expect(validateOriReviewPrincipal(null)).toBeNull();
    expect(validateOriReviewPrincipal({ownerId:"",projectId:"a"})).toBeNull();
    expect(validateOriReviewPrincipal({ownerId:"a",projectId:"p"})).toEqual({ownerId:"a",projectId:"p"});
  });
});
