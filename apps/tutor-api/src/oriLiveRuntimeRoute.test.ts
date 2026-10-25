import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createTutorServer } from "./server.js";
import { createOriRuntimePreview } from "./oriRuntimePreview.js";
import { configFromEnv } from "./index.js";

const oriRoot = process.env["ORI_REPO_PATH"];
const runnable = !!oriRoot && oriRoot.startsWith("/") &&
  existsSync(resolve(oriRoot, "examples/local-agent-runtime.mjs"));
if (oriRoot && !runnable) throw new Error("ORI_REPO_PATH must be a valid Ori checkout");
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(s => new Promise<void>(done => s.close(() => done()))));
});
async function start(enabled: boolean) {
  const server = createTutorServer({
    config: configFromEnv({AGORIX_TUTOR_ADAPTER:"fake"}),
    oriRuntimePreviewEnabled:enabled,
    oriRuntimePreview:createOriRuntimePreview({oriRoot:oriRoot!,enabled}),
  });
  servers.push(server);
  await new Promise<void>(done => server.listen(0,"127.0.0.1",done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
async function request(base:string,intent:string) {
  return fetch(base+"/api/tutor/ori/runtime-preview",{
    method:"POST",headers:{"content-type":"application/json",origin:base},
    body:JSON.stringify({intent}),
  });
}
describe.skipIf(!runnable)("Agorix Tutor API to real Ori v1 process",()=>{
  it.each(["help","repeat","turn","move","debug"])("roundtrips %s without writes",async intent=>{
    const base=await start(true);
    const response=await request(base,intent);
    expect(response.status).toBe(200);
    const result=await response.json() as Record<string,unknown>;
    expect(result).toMatchObject({
      status:"ready",hintSource:"deterministic",
      requiresLearnerApproval:true,appliedChanges:false,
    });
    expect(typeof result["hint"]).toBe("string");
    expect(typeof result["nextStep"]).toBe("string");
    expect(JSON.stringify(result)).not.toContain("synthetic-cli");
  },15000);
  it("remains unavailable when disabled",async()=>{
    const base=await start(false);
    expect((await request(base,"help")).status).toBe(404);
  });
  it("rejects forbidden intents without executing Ori",async()=>{
    const base=await start(true);
    expect((await request(base,"shell")).status).toBe(400);
  });
});
