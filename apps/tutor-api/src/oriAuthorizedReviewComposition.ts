import type { IncomingMessage, ServerResponse } from "node:http";
import type { ProjectRepository } from "@agorix/project-repository";
import type { WorldStateInput } from "@agorix/runtime";
import { createOriAuthorizedProjectIdentityResolver, type OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";
import { createOriCanonicalReviewWorkflow, type OriLearningContext } from "./oriCanonicalReviewWorkflow.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";

/**
 * Complete server-side dependency composition for TutorServerOptions.
 * Production must supply a real authenticated session resolver, a trusted
 * server-side active-project selector, canonical project repository and
 * verified pedagogical context. No environment flag enables this by itself.
 */
export function createOriAuthorizedReviewOptions({
  repository,oriRoot,world,learningContext,resolveSession,activeProject,runOriOverride
}:{
  readonly repository:ProjectRepository;
  readonly oriRoot:string;
  readonly world:WorldStateInput;
  readonly learningContext:(owner:string,projectId:string)=>Promise<OriLearningContext|null>;
  readonly resolveSession:(request:IncomingMessage,response?:ServerResponse)=>Promise<OriAuthenticatedSession|null>;
  readonly activeProject:(session:OriAuthenticatedSession)=>Promise<string|null>;
  /** Test-only: production invokes the real Ori process. */
  readonly runOriOverride?:(evidence:unknown)=>Promise<OriHostEvidenceResult>;
}) {
  const identity=createOriAuthorizedProjectIdentityResolver({repository,resolveSession,activeProject});
  const workflow=createOriCanonicalReviewWorkflow({repository,oriRoot,world,learningContext,
    ...(runOriOverride ? {runOriOverride} : {})});
  return Object.freeze({
    oriReviewEnabled:true as const,
    oriReviewIdentity:identity,
    oriReviewPropose:(owner:string,projectId:string)=>workflow.propose(owner,projectId),
    oriReviewDecision:(owner:string,projectId:string,ticketId:string,decision:"accept"|"edit"|"reject")=>
      workflow.decide(owner,projectId,ticketId,decision)
  });
}
