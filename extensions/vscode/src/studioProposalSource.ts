// Provider-backed proposals behind one seam (no VS Code API). The Studio decision pipeline
// (System 0 / LAYA / budget / router) decides whether a provider may be asked; the provider's
// answer is validated twice (the client's contract and safety checks, then proposal validation
// and base-hash freshness). Anything else degrades to the built-in deterministic proposal, so a
// failure here never affects editing, running or the learner's program.
import {
  createStudioSignal,
  stateFromLearningCompanionRequest,
  type StudioPipeline,
  type StudioSignalKind,
} from "@agorix/learning-decision-plane";
import { programSemanticHash } from "@agorix/proposals";
import type { LearningCompanionResponse } from "@agorix/tutor-contract";
import {
  createCompanionRequest,
  createProposalSession,
  type StudioProject,
  type StudioProposalSession,
} from "./studioCore.js";
import type { StudioProviderClient } from "./studioProvider.js";

/** "build" is the learner asking the Companion to build; the others come from the agent loop. */
export type ProviderProposalTask = "first-step" | "repeat-pattern" | "build";

export type BuiltInReason =
  "no-provider" | "not-allowed" | "unavailable" | "rejected" | "invalid" | "stale";

export type ProviderProposalResult =
  | {
      readonly origin: "provider";
      readonly session: StudioProposalSession;
      /** The validated builder response the session was derived from. */
      readonly response: LearningCompanionResponse;
      readonly locality: "local" | "remote";
    }
  | {
      readonly origin: "built-in";
      readonly reason: BuiltInReason;
      /** Learner-safe sentence; never contains provider, endpoint or credential details. */
      readonly notice?: string;
    };

export interface ProposalSourceOptions {
  readonly pipeline: StudioPipeline;
  /** Undefined when AI help is not configured; the source then always yields built-in. */
  readonly client: StudioProviderClient | undefined;
}

export interface ProposalSource {
  request(project: StudioProject, task: ProviderProposalTask): Promise<ProviderProposalResult>;
}

const SIGNAL_FOR_TASK: Record<ProviderProposalTask, StudioSignalKind> = {
  "first-step": "first-step",
  "repeat-pattern": "repeat-pattern",
  build: "selection-changed",
};

function builtIn(reason: BuiltInReason, notice?: string): ProviderProposalResult {
  return { origin: "built-in", reason, ...(notice === undefined ? {} : { notice }) };
}

export function createProposalSource(options: ProposalSourceOptions): ProposalSource {
  let sequence = 0;
  return {
    async request(project, task) {
      const { client, pipeline } = options;
      if (client === undefined) {
        return builtIn("no-provider");
      }
      try {
        const request = createCompanionRequest(project, "build");
        const signal = createStudioSignal(SIGNAL_FOR_TASK[task], (sequence += 1));
        if (signal === undefined) {
          return builtIn("not-allowed");
        }
        const programHash = programSemanticHash(project.stored.program);
        const decision = await pipeline.decide({
          signal,
          state: stateFromLearningCompanionRequest(request),
          programHash,
          locale: project.stored.metadata.locale ?? "en",
        });
        if (!decision.providerRequestAllowed) {
          return builtIn("not-allowed", decision.learnerNotice);
        }
        const outcome = await client.request(request);
        if (outcome.status === "unavailable") {
          return builtIn("unavailable", outcome.message);
        }
        if (outcome.status === "rejected") {
          return builtIn("rejected", outcome.message);
        }
        const response = outcome.response;
        if (response.capability !== "builder" || response.payload.validation.status !== "valid") {
          return builtIn("invalid");
        }
        const proposal = response.payload.proposal;
        if (proposal.baseProgramHash !== programHash) {
          return builtIn("stale");
        }
        let session: StudioProposalSession;
        try {
          session = createProposalSession(project, proposal);
        } catch {
          // The provider's operations do not produce a valid program: never shown to the learner.
          return builtIn("invalid");
        }
        return { origin: "provider", session, response, locality: outcome.locality };
      } catch {
        return builtIn("unavailable");
      }
    },
  };
}
