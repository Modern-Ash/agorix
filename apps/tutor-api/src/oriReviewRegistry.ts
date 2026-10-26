import { randomUUID } from "node:crypto";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
import { beginOriProposalReview, decideOriProposalReview, type OriProposalReviewSession } from "./oriProposalSession.js";
import type { OriReviewDecision } from "./oriProposalReview.js";

export interface OriReviewTicket {
  readonly id:string;
  readonly status:OriProposalReviewSession["status"];
  readonly proposal:unknown;
  readonly appliedChanges:false;
}
export interface OriReviewRegistry {
  readonly issue:(result:OriHostEvidenceResult)=>OriReviewTicket|null;
  readonly read:(id:string)=>OriReviewTicket|null;
  readonly decide:(id:string,decision:OriReviewDecision)=>Promise<OriReviewTicket|null>;
  readonly purge:()=>void;
}
const MAX_SESSIONS=100;
const MAX_AGE_MS=5*60*1000;
/**
 * Trusted server-only registry. The browser gets an opaque identifier,
 * never an evidence envelope, grants or a host-supplied revision.
 */
export function createOriReviewRegistry({now=Date.now,maxSessions=MAX_SESSIONS,ttlMs=MAX_AGE_MS,currentRevision}:{
  readonly now?:()=>number;readonly maxSessions?:number;readonly ttlMs?:number;
  readonly currentRevision:(id:string)=>Promise<string>
}={}):OriReviewRegistry {
  if(typeof currentRevision!=="function"||!Number.isSafeInteger(maxSessions)||maxSessions<1||maxSessions>1000||
     !Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>3600000)
    throw new TypeError("Invalid review registry limits");
  const entries=new Map<string,{session:OriProposalReviewSession;created:number}>();
  const purge=()=>{
    const current=now();
    for(const [id,entry] of entries)if(current-entry.created>=ttlMs)entries.delete(id);
  };
  const ticket=(id:string,session:OriProposalReviewSession):OriReviewTicket=>
    Object.freeze({id,status:session.status,proposal:structuredClone(session.proposal),appliedChanges:false});
  return Object.freeze({
    purge,
    issue(result){
      purge();
      const session=beginOriProposalReview(result);
      if(!session)return null;
      if(entries.size>=maxSessions)return null;
      const id=randomUUID();
      entries.set(id,{session,created:now()});
      return ticket(id,session);
    },
    read(id){
      purge();
      const entry=entries.get(id);
      return entry?ticket(id,entry.session):null;
    },
    async decide(id,decision){
      purge();
      const entry=entries.get(id);
      if(!entry)return null;
      const revision=await currentRevision(id);
      const updated=decideOriProposalReview(entry.session,revision,decision);
      entries.set(id,{...entry,session:updated});
      return ticket(id,updated);
    }
  });
}
