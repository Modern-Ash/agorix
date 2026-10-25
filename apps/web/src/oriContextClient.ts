import type { OriReviewPreview } from "./oriReviewClient.js";
export interface OriContextPreviewRequest {
  readonly intent:"help"|"repeat"|"turn"|"move"|"debug";
  readonly context:{readonly scriptCount:number;readonly hintCount:number;
    readonly outcome:"not-run"|"completed"|"failed"|"stopped"};
}
const unavailable:OriReviewPreview={status:"unavailable",requiresLearnerApproval:true,appliedChanges:false};
export async function requestOriContextPreview(input:OriContextPreviewRequest,fetchImpl:typeof fetch=fetch):Promise<OriReviewPreview>{
  const c=input.context;
  if(!["help","repeat","turn","move","debug"].includes(input.intent) ||
    ![c.scriptCount,c.hintCount].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000) ||
    !["not-run","completed","failed","stopped"].includes(c.outcome))return unavailable;
  try{
    const response=await fetchImpl("/api/tutor/ori/context-preview",{
      method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},
      body:JSON.stringify(input),signal:AbortSignal.timeout(4000)
    });
    if(!response.ok || !(response.headers.get("content-type")??"").includes("application/json"))return unavailable;
    const data:unknown=await response.json();
    if(!data || typeof data!=="object" || Array.isArray(data))return unavailable;
    const r=data as Record<string,unknown>;
    if(r["status"]!=="ready" || r["requiresLearnerApproval"]!==true ||
      r["appliedChanges"]!==false || typeof r["hint"]!=="string" ||
      r["hint"].length<1 || r["hint"].length>180 ||
      typeof r["nextStep"]!=="string" || r["nextStep"].length>240)return unavailable;
    return {status:"ready",hint:r["hint"],nextStep:r["nextStep"],
      requiresLearnerApproval:true,appliedChanges:false};
  }catch{return unavailable;}
}
