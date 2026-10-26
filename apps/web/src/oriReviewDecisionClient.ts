import { withAgorixSessionQueue } from "./accounts/sessionRequestQueue.js";
import type { OriLearnerDecision } from "./OriLearnerProposalReview.js";
import { parseOriServerDecision, type OriServerDecisionStatus } from "./oriServerDecision.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/**
 * Same-origin review client. Sends only opaque ticket ID and learner decision;
 * authentication is carried by the browser's existing session, not body data.
 */
export async function requestOriReviewDecision(
  ticketId:string,decision:OriLearnerDecision,
  fetchImpl:typeof fetch=fetch
):Promise<OriServerDecisionStatus> {
  if(!UUID.test(ticketId) || !["accept","edit","reject"].includes(decision))
    return "unavailable";
  return withAgorixSessionQueue(async()=>{
  try {
    const response=await fetchImpl("/api/tutor/ori/review/decision",{
      method:"POST",
      credentials:"same-origin",
      headers:{"content-type":"application/json","x-agorix-request":"1"},
      body:JSON.stringify({ticketId,decision}),
      signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)return response.status===409?"stale":"unavailable";
    return parseOriServerDecision(await response.json());
  }catch{return "unavailable";}
  });
}
