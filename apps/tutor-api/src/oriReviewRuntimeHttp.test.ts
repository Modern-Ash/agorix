import { afterEach,describe,expect,it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { AuthService,InMemoryAccountRepository,InMemorySessionRepository } from "@agorix/auth-service";
import type { ProjectRepository } from "@agorix/project-repository";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { openOriReviewRuntime } from "./oriReviewRuntime.js";

const servers:Server[]=[];
afterEach(async()=>{await Promise.all(servers.splice(0).map(server=>
  new Promise<void>(done=>server.close(()=>done()))));});
describe("Ori review runtime HTTP composition",()=>{
  it("rejects anonymous proposal issuance without invoking Ori",async()=>{
    const auth=new AuthService({
      accounts:new InMemoryAccountRepository(),
      sessions:new InMemorySessionRepository()
    });
    let runs=0;
    const repository={get:async(owner:string,id:string)=>({
      ownerId:owner,projectId:id
    })} as unknown as ProjectRepository;
    const runtime=openOriReviewRuntime({
      auth,repository,dbPath:":memory:",oriRoot:"/unused",world:{},
      learningContext:async()=>null,
      runOriOverride:async()=>{runs++;return {
        status:"unavailable",requiresLearnerApproval:true,appliedChanges:false
      };}
    });
    try{
      const server=createTutorServer({
        config:configFromEnv({AGORIX_TUTOR_ADAPTER:"fake"}),
        ...runtime.options
      });
      servers.push(server);
      await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));
      const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const response=await fetch(base+"/api/tutor/ori/review/propose",{
        method:"POST",
        headers:{"content-type":"application/json","x-agorix-request":"1",origin:base},
        body:"{}"
      });
      expect(response.status).toBe(401);
      expect(runs).toBe(0);
    }finally{runtime.close();}
  });
});
