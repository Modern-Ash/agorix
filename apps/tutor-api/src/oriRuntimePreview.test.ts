import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOriRuntimePreview } from "./oriRuntimePreview.js";

function fixture(script: string) {
  const root = mkdtempSync(join(tmpdir(), "agorix-ori-"));
  mkdirSync(join(root, "examples"));
  writeFileSync(join(root, "examples/local-agent-runtime.mjs"), script);
  return {root, close:()=>rmSync(root,{recursive:true,force:true})};
}
const valid=JSON.stringify({
  intent:"help",plan:{schemaVersion:"ori/plan/v1",steps:[{id:"step-1",goal:"Observá el resultado"}]},
  hint:"¿Qué podrías probar primero?",hintSource:"deterministic",appliedChanges:false,
});
describe("host-owned Ori runtime preview",()=>{
  it("is disabled by default and does not start a child",async()=>{
    const f=fixture("throw Error('must not run')");
    try{expect(await createOriRuntimePreview({oriRoot:f.root})("help")).toEqual({
      status:"unavailable",requiresLearnerApproval:true,appliedChanges:false,
    });}finally{f.close();}
  });
  it("accepts a bounded review-only runtime response",async()=>{
    const f=fixture(`console.log(${JSON.stringify(valid)})`);
    try{expect(await createOriRuntimePreview({oriRoot:f.root,enabled:true})("help")).toMatchObject({
      status:"ready",hintSource:"deterministic",requiresLearnerApproval:true,appliedChanges:false,
    });}finally{f.close();}
  });
  it("rejects forged auto-apply",async()=>{
    const f=fixture(`console.log(${JSON.stringify(valid.replace('"appliedChanges":false','"appliedChanges":true'))})`);
    try{expect((await createOriRuntimePreview({oriRoot:f.root,enabled:true})("help")).status).toBe("unavailable");}finally{f.close();}
  });
  it("rejects unauthorized intent before starting runtime",async()=>{
    const f=fixture("throw Error('must not run')");
    try{expect((await createOriRuntimePreview({oriRoot:f.root,enabled:true})("shell")).status).toBe("unavailable");}finally{f.close();}
  });
  it("fails closed on process errors",async()=>{
    const f=fixture("process.exit(1)");
    try{expect((await createOriRuntimePreview({oriRoot:f.root,enabled:true})("help")).status).toBe("unavailable");}finally{f.close();}
  });
});
