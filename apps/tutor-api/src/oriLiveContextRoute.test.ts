import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createTutorServer } from "./server.js";
import { createOriContextPreview } from "./oriContextPreview.js";
import { configFromEnv } from "./index.js";

const oriRoot=process.env["ORI_REPO_PATH"];
const runnable=!!oriRoot && isAbsolute(oriRoot) &&
  existsSync(resolve(oriRoot,"examples/educational-context-cli.mjs"));
if(oriRoot && !runnable)throw Error("ORI_REPO_PATH lacks Ori educational context CLI");
const servers:Server[]=[];
afterEach(async()=>{
  await Promise.all(servers.splice(0).map(s=>new Promise<void>(done=>s.close(()=>done()))));
});
async function start(enabled:boolean){
  const server=createTutorServer({
    config:configFromEnv({AGORIX_TUTOR_ADAPTER:"fake"}),
    oriContextPreviewEnabled:enabled,
    oriContextPreview:createOriContextPreview({oriRoot:oriRoot!,enabled}),
  });
  servers.push(server);
  await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
function post(base:string,body:unknown,origin=base){
  return fetch(base+"/api/tutor/ori/context-preview",{
    method:"POST",headers:{"content-type":"application/json",origin},
    body:JSON.stringify(body)
  });
}
const request=(outcome:string)=>({
  intent:"debug",context:{scriptCount:2,hintCount:1,outcome}
});
describe.skipIf(!runnable)("live Agorix HTTP to Ori educational context CLI",()=>{
  it("uses real failed execution metadata for a contextual question",async()=>{
    const base=await start(true);
    const response=await post(base,request("failed"));
    expect(response.status).toBe(200);
    const value=await response.json() as Record<string,unknown>;
    expect(value).toMatchObject({status:"ready",hintSource:"deterministic",
      requiresLearnerApproval:true,appliedChanges:false});
    expect(value["hint"]).toBe("¿En qué paso dejó de ocurrir lo que esperabas?");
    expect(JSON.stringify(value)).not.toContain("context-v1");
  },15000);
  it("uses not-run metadata without inventing execution",async()=>{
    const base=await start(true);
    const response=await post(base,request("not-run"));
    const value=await response.json() as Record<string,unknown>;
    expect(value["hint"]).toBe("¿Qué esperás que suceda cuando ejecutes tu programa?");
  },15000);
  it("is disabled unless explicitly opted in",async()=>{
    const base=await start(false);
    expect((await post(base,request("failed"))).status).toBe(404);
  });
  it("rejects raw learner data and unsupported outcomes",async()=>{
    const base=await start(true);
    expect((await post(base,{...request("failed"),message:"private"})).status).toBe(400);
    expect((await post(base,request("unknown"))).status).toBe(400);
  });
  it("rejects cross-origin requests",async()=>{
    const base=await start(true);
    expect((await post(base,request("failed"),"https://untrusted.example")).status).toBe(403);
  });
});
