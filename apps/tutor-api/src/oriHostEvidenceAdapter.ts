import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export interface TrustedOriEvidence {
  readonly intent:"help"|"repeat"|"turn"|"move"|"debug";
  readonly programRevision:string;
  readonly expectedSteps:number;
  readonly hostContext:{
    readonly sessionId:string;
    readonly learningStage:"explore"|"connect"|"translate";
    readonly capabilities:readonly ("inspectProgram"|"inspectTrace")[];
    readonly grants:readonly ("inspectProgram"|"inspectTrace")[];
    readonly attempts:number;
    readonly hintsUsed:number;
  };
  readonly snapshot:{readonly allowedBlocks:readonly string[]};
  readonly trace:{readonly steps:readonly {readonly index:number;readonly description:string}[]};
}
export interface OriHostEvidenceResult {
  readonly status:"ready"|"unavailable";
  readonly proposal?:unknown;
  readonly evidenceReceipt?:{readonly programRevision:string;readonly digest:string;readonly complete:true};
  readonly requiresLearnerApproval:true;
  readonly appliedChanges:false;
}
const unavailable:OriHostEvidenceResult=Object.freeze({status:"unavailable",requiresLearnerApproval:true,appliedChanges:false});
const HEX=/^[a-f0-9]{64}$/;
export function validateTrustedOriEvidence(raw:unknown):TrustedOriEvidence|null {
  if(!raw || typeof raw!=="object" || Array.isArray(raw))return null;
  const r=raw as Record<string,unknown>;
  if(Object.keys(r).sort().join()!=="expectedSteps,hostContext,intent,programRevision,snapshot,trace" ||
    !["help","repeat","turn","move","debug"].includes(String(r["intent"])) ||
    typeof r["programRevision"]!=="string" || !HEX.test(r["programRevision"]) ||
    !Number.isSafeInteger(r["expectedSteps"]) || (r["expectedSteps"] as number)<1 ||
    (r["expectedSteps"] as number)>100)return null;
  const c=r["hostContext"],s=r["snapshot"],t=r["trace"];
  if(!c || typeof c!=="object" || Array.isArray(c) ||
     !s || typeof s!=="object" || Array.isArray(s) ||
     !t || typeof t!=="object" || Array.isArray(t))return null;
  const host=c as Record<string,unknown>;
  const snapshot=s as Record<string,unknown>;
  const trace=t as Record<string,unknown>;
  if(Object.keys(host).sort().join()!=="attempts,capabilities,grants,hintsUsed,learningStage,sessionId" ||
     typeof host["sessionId"]!=="string" || host["sessionId"].length>80 ||
     !["explore","connect","translate"].includes(String(host["learningStage"])) ||
     ![host["attempts"],host["hintsUsed"]].every(n=>Number.isSafeInteger(n)&&(n as number)>=0&&(n as number)<=100) ||
     !Array.isArray(host["grants"]) || !Array.isArray(host["capabilities"]) ||
     !["inspectProgram","inspectTrace"].every(g=>(host["grants"] as unknown[]).includes(g) && (host["capabilities"] as unknown[]).includes(g)) ||
     (host["grants"] as unknown[]).some(g=>!["inspectProgram","inspectTrace"].includes(String(g))) ||
     (host["capabilities"] as unknown[]).some(g=>!["inspectProgram","inspectTrace"].includes(String(g))))return null;
  if(Object.keys(snapshot).join()!=="allowedBlocks" || !Array.isArray(snapshot["allowedBlocks"]) ||
     (snapshot["allowedBlocks"] as unknown[]).length>100 ||
     (snapshot["allowedBlocks"] as unknown[]).some(x=>typeof x!=="string" || !/^[a-z][A-Za-z0-9]{0,39}$/.test(x)))return null;
  if(Object.keys(trace).join()!=="steps" || !Array.isArray(trace["steps"]) ||
     (trace["steps"] as unknown[]).length!==r["expectedSteps"] ||
     (trace["steps"] as unknown[]).some((x,i)=>!x || typeof x!=="object" || Array.isArray(x) ||
       Object.keys(x).sort().join()!=="description,index" ||
       (x as {index:unknown}).index!==i ||
       typeof (x as {description:unknown}).description!=="string" ||
       (x as {description:string}).description.length>200))return null;
  return raw as TrustedOriEvidence;
}
/**
 * Only invoke from a trusted server-side canonical-runtime adapter, NEVER
 * with a browser-provided envelope. Ori itself cannot attest host execution.
 */
export function createOriHostEvidenceAdapter({oriRoot,timeoutMs=3000}:{
  oriRoot:string;timeoutMs?:number
}) {
  if(!isAbsolute(oriRoot) || !Number.isSafeInteger(timeoutMs) || timeoutMs<1 || timeoutMs>10000)
    throw new TypeError("Invalid Ori host configuration");
  const root=realpathSync(oriRoot);
  if(!existsSync(join(root,"examples/host-evidence-cli.mjs")))
    throw new TypeError("Ori host evidence CLI missing");
  return async (raw:unknown):Promise<OriHostEvidenceResult>=>{
    const input=validateTrustedOriEvidence(raw);
    if(!input)return unavailable;
    return new Promise(resolve=>{
      const child=spawn(process.execPath,["examples/host-evidence-cli.mjs"],{
        cwd:root,stdio:["pipe","pipe","pipe"],env:{PATH:process.env["PATH"]??""}
      });
      let done=false,output="";
      const finish=(value:OriHostEvidenceResult)=>{
        if(done)return;done=true;clearTimeout(timer);
        if(child.exitCode===null)child.kill("SIGKILL");
        resolve(value);
      };
      const timer=setTimeout(()=>finish(unavailable),timeoutMs);
      child.on("error",()=>finish(unavailable));
      child.stdout.on("data",(chunk:Buffer)=>{
        output+=chunk.toString("utf8");
        if(Buffer.byteLength(output,"utf8")>8192)finish(unavailable);
      });
      child.on("close",code=>{
        if(code!==0)return finish(unavailable);
        try{
          const data:unknown=JSON.parse(output);
          if(!data || typeof data!=="object" || Array.isArray(data))return finish(unavailable);
          const d=data as Record<string,unknown>;
          const receipt=d["evidenceReceipt"];
          if(d["schemaVersion"]!=="ori/host-evidence-response/v1" ||
             d["appliedChanges"]!==false || d["requiresLearnerApproval"]!==true ||
             !receipt || typeof receipt!=="object" || Array.isArray(receipt))return finish(unavailable);
          const e=receipt as Record<string,unknown>;
          if(e["programRevision"]!==input.programRevision ||
             typeof e["digest"]!=="string" || !HEX.test(e["digest"]) ||
             e["complete"]!==true)return finish(unavailable);
          finish({status:"ready",...(d["proposal"]===undefined?{}:{proposal:d["proposal"]}),evidenceReceipt:{
            programRevision:input.programRevision,digest:e["digest"],complete:true
          },requiresLearnerApproval:true,appliedChanges:false});
        }catch{finish(unavailable);}
      });
      child.stdin.on("error",()=>finish(unavailable));
      child.stdin.end(JSON.stringify(input));
    });
  };
}
