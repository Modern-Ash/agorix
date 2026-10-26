import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach,describe,expect,it } from "vitest";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";
const servers:Server[]=[];
afterEach(async()=>{await Promise.all(servers.splice(0).map(s=>new Promise<void>(done=>s.close(()=>done()))));});
const ticket:OriReviewTicket={
  id:"123e4567-e89b-42d3-a456-426614174000",status:"pending",
  proposal:{schemaVersion:"ori/proposal/v0",operation:"append",requiresLearnerApproval:true,blocks:[{kind:"move",steps:1}]},
  appliedChanges:false
};
async function start(authenticated=true,enabled=true) {
  const calls:string[]=[];
  const server=createTutorServer({
    config:configFromEnv({AGORIX_TUTOR_ADAPTER:"fake"}),
    oriReviewEnabled:enabled,
    oriReviewIdentity:async()=>authenticated?{ownerId:"student",projectId:"project-a"}:null,
    oriReviewPropose:async(owner,project)=>{calls.push(owner+"/"+project);return ticket;}
  });
  servers.push(server);
  await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));
  return {base:`http://127.0.0.1:${(server.address() as AddressInfo).port}`,calls};
}
const post=(base:string,body:unknown,origin=base)=>fetch(base+"/api/tutor/ori/review/propose",{
  method:"POST",headers:{"content-type":"application/json","x-agorix-request":"1",origin},body:JSON.stringify(body)
});
describe("Ori proposal issuance HTTP trust boundary",()=>{
  it("issues only server-owned proposal for authenticated project",async()=>{
    const {base,calls}=await start();
    const response=await post(base,{});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ticketId:ticket.id,proposal:ticket.proposal,appliedChanges:false
    });
    expect(calls).toEqual(["student/project-a"]);
  });
  it("denies guests and disabled endpoint",async()=>{
    const guest=await start(false);
    expect((await post(guest.base,{})).status).toBe(401);
    expect(guest.calls).toHaveLength(0);
    const disabled=await start(true,false);
    expect((await post(disabled.base,{})).status).toBe(404);
  });
  it("rejects browser-supplied project, grants and revision",async()=>{
    const {base,calls}=await start();
    for(const field of ["ownerId","projectId","grants","revision","program"]){
      expect((await post(base,{[field]:"forged"})).status).toBe(400);
    }
    expect(calls).toHaveLength(0);
  });
  it("denies issuance without the anti-CSRF request header",async()=>{
    const {base,calls}=await start();
    const response=await fetch(base+"/api/tutor/ori/review/propose",{
      method:"POST",headers:{"content-type":"application/json",origin:base},
      body:"{}"
    });
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("denies cross-origin issuance",async()=>{
    const {base,calls}=await start();
    expect((await post(base,{},"https://untrusted.example")).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});
