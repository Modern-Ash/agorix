import {describe,it,expect} from "vitest";
import {requestOriReviewPreview} from "./oriReviewClient.js";
const fake=(payload:unknown,status=200):typeof fetch=>(async()=>({
  ok:status===200,status,headers:{get:()=>"application/json"},json:async()=>payload
} as Response)) as typeof fetch;
describe("Ori experimental review client",()=>{
  it("accepts a read-only approved preview",async()=>{
    const value=await requestOriReviewPreview("help",fake({status:"ready",hint:"¿Qué probaste?",nextStep:"Observá",requiresLearnerApproval:true,appliedChanges:false}));
    expect(value.status).toBe("ready");
    expect(value.appliedChanges).toBe(false);
  });
  it("rejects forged auto-apply",async()=>{
    const value=await requestOriReviewPreview("help",fake({status:"ready",hint:"x",nextStep:"y",requiresLearnerApproval:true,appliedChanges:true}));
    expect(value.status).toBe("unavailable");
  });
  it("rejects unavailable feature",async()=>expect((await requestOriReviewPreview("help",fake({},404))).status).toBe("unavailable"));
  it("rejects unsupported intent without fetch",async()=>{
    let calls=0;
    const value=await requestOriReviewPreview("shell",(async()=>{calls++;throw Error("called");}) as typeof fetch);
    expect(value.status).toBe("unavailable");expect(calls).toBe(0);
  });
});
