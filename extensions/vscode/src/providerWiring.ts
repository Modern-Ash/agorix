// Builds the real pipeline + provider client for provider-backed proposals and keeps them in
// step with configuration. VS Code specific; the decision logic lives in studioProposalSource.
import * as vscode from "vscode";
import {
  createLayaLearningProvider,
  createStudioPipeline,
  type StudioPipeline,
  type StudioRouter,
} from "@agorix/learning-decision-plane";
import type { LayaBatchTransport } from "@agorix/learning-decision-plane";
import { createAgentClient } from "./commands/accounts.js";
import { createProposalSource, type ProposalSource } from "./studioProposalSource.js";
import type { StudioProviderClient } from "./studioProvider.js";

export interface ProviderWiringOptions {
  readonly context: vscode.ExtensionContext;
  /** Agreements and settings both allow AI help. */
  aiEnabled(): boolean;
  layaTransport?: LayaBatchTransport | undefined;
}

/** Policy-only router; the real health check happens in the provider client. */
export function createPolicyRouter(allowRemote: boolean): StudioRouter {
  return (requirements) => {
    if (requirements.generativeNeeded === "no" || requirements.reasoningTier === "deterministic") {
      return {
        status: "deterministic",
        reason: "deterministic",
        providerRequestAllowed: false,
      };
    }
    const wantsRemote = requirements.reasoningTier === "remote";
    if (wantsRemote && !allowRemote) {
      return {
        status: "unavailable",
        reason: "remote-not-allowed",
        providerRequestAllowed: false,
      };
    }
    return {
      status: "selected",
      reason: "selected",
      providerRequestAllowed: true,
      locality: wantsRemote ? "remote" : "local",
    };
  };
}

export function createProviderWiring(options: ProviderWiringOptions): {
  source(): ProposalSource;
} {
  let key = "";
  let pipeline: StudioPipeline | undefined;

  function current(): { pipeline: StudioPipeline; client: StudioProviderClient | undefined } {
    const config = vscode.workspace.getConfiguration("agorixStudio.agent");
    const budget = config.get("proposalBudgetRequests", 10);
    const allowRemote = config.get<boolean>("allowRemote", false) === true;
    const configured =
      String(config.get("endpoint", "")).trim() !== "" ||
      String(config.get("remoteEndpoint", "")).trim() !== "";
    const next = JSON.stringify([budget, allowRemote, config.get("layaEndpoint", "")]);
    if (pipeline === undefined || next !== key) {
      key = next;
      pipeline = createStudioPipeline({
        ...(options.layaTransport === undefined
          ? {}
          : { system1: createLayaLearningProvider(options.layaTransport) }),
        route: createPolicyRouter(allowRemote),
        budget: {
          maxRequests: typeof budget === "number" && budget >= 0 ? Math.floor(budget) : 10,
        },
      });
    }
    return {
      pipeline,
      client: options.aiEnabled() && configured ? createAgentClient(options.context) : undefined,
    };
  }

  return {
    source: () => {
      const { pipeline: active, client } = current();
      return createProposalSource({ pipeline: active, client });
    },
  };
}
