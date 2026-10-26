import { parseOriReviewableProposal } from "./oriProposalReview.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface OriIssuedProposal {
  readonly ticketId:string;
  readonly proposal:NonNullable<ReturnType<typeof parseOriReviewableProposal>>;
  readonly appliedChanges:false;
}
export function parseOriIssuedProposal(raw:unknown):OriIssuedProposal|null {
  if(!raw || typeof raw!=="object" || Array.isArray(raw))return null;
  const r=raw as Record<string,unknown>;
  if(Object.keys(r).sort().join()!=="appliedChanges,proposal,ticketId" ||
     typeof r["ticketId"]!=="string" || !UUID.test(r["ticketId"]) ||
     r["appliedChanges"]!==false)return null;
  const proposal=parseOriReviewableProposal(r["proposal"]);
  if(!proposal)return null;
  return {ticketId:r["ticketId"],proposal,appliedChanges:false};
}
/** The server resolves identity, project, revision, grants and evidence. */
export async function requestOriProposal(fetchImpl:typeof fetch=fetch):Promise<OriIssuedProposal|null> {
  try{
    const response=await fetchImpl("/api/tutor/ori/review/propose",{
      method:"POST",credentials:"same-origin",
      headers:{"content-type":"application/json","x-agorix-request":"1"},
      body:"{}",signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)return null;
    return parseOriIssuedProposal(await response.json());
  }catch{return null;}
}
