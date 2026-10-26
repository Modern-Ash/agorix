import type { IncomingMessage,ServerResponse } from "node:http";
import type { AuthService } from "@agorix/auth-service";
import type { ProjectRepository } from "@agorix/project-repository";
import type { WorldStateInput } from "@agorix/runtime";
import { createOriAuthServiceSessionResolver } from "./oriAuthServiceSessionResolver.js";
import { openOriSqliteProjectSelection } from "./oriSqliteProjectSelection.js";
import { createOriAuthorizedReviewOptions } from "./oriAuthorizedReviewComposition.js";
import type { OriLearningContext } from "./oriCanonicalReviewWorkflow.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";

/**
 * Single-host production composition with explicit trusted dependencies.
 * Never creates a second, disconnected AuthService or ProjectRepository.
 */
export function openOriReviewRuntime({
  auth,repository,dbPath,oriRoot,world,learningContext,cookieName,runOriOverride
}:{
  readonly auth:Pick<AuthService,"resolveSession">;
  readonly repository:ProjectRepository;
  readonly dbPath:string;
  readonly oriRoot:string;
  readonly world:WorldStateInput;
  readonly learningContext:(owner:string,projectId:string)=>Promise<OriLearningContext|null>;
  readonly cookieName?:string;
  /** Test-only seam; production uses the actual Ori process. */
  readonly runOriOverride?:(evidence:unknown)=>Promise<OriHostEvidenceResult>;
}) {
  const projects=openOriSqliteProjectSelection({path:dbPath,repository});
  try {
    const resolveSession=createOriAuthServiceSessionResolver(auth,{
      ...(cookieName===undefined?{}:{cookieName})
    });
    const options=createOriAuthorizedReviewOptions({
      repository,oriRoot,world,learningContext,
      resolveSession:(request:IncomingMessage,response?:ServerResponse)=>
        resolveSession(request,response),
      activeProject:projects.activeProject,
      ...(runOriOverride===undefined?{}:{runOriOverride})
    });
    return Object.freeze({
      options,
      chooseProject:projects.choose,
      signedOut:projects.signedOut,
      rotated:projects.rotated,
      close:projects.close
    });
  }catch(error){
    projects.close();
    throw error;
  }
}
