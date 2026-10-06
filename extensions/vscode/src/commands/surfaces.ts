import * as vscode from "vscode";
import type { AgentAgreements } from "@agorix/agent-workflow";
import type { AgentVerb } from "@agorix/interaction-core";
import type { ProjectProgram } from "@agorix/program-model";
import { patchActive, type ProjectActors } from "@agorix/persistence";
import {
  actorsOf,
  evidenceForProgram,
  type StudioExecutionViewState,
  type StudioProject,
  type StudioProposalSession,
} from "../studioCore.js";
import { openWorkbenchPanel, refreshWorkbench } from "../host/workbenchPanel.js";
import { validateMessage } from "../webview/framework.js";
import { actorInspectorInboundSchemas } from "../webview/actorInspector.js";
import { openActorInspectorPanel } from "../host/actorInspectorPanel.js";
import { openWorldPreviewPanel } from "../host/worldPreviewPanel.js";
import type { AgentPort } from "../host/agentHost.js";
import type { WorkbenchLocale } from "../host/workbenchHtml.js";
import type { OpenProject } from "../store/session.js";
import type { SyncHub } from "../sync/syncHub.js";

export interface StudioSurfaceCommandPort {
  readonly context: vscode.ExtensionContext;
  readonly hub: SyncHub;
  requireProject(): OpenProject | undefined;
  currentExecutionView(): StudioExecutionViewState | undefined;
  resetExecution(): StudioExecutionViewState | undefined;
  getProgram(): ProjectProgram | undefined;
  /** The open project without any prompt; undefined when none is open. */
  getProject(): StudioProject | undefined;
  commitProgram(program: ProjectProgram): Promise<void>;
  commitActors(actors: ProjectActors): Promise<void>;
  getActiveProposal(): StudioProposalSession | undefined;
  reviewProposalSession(proposal: StudioProposalSession): Promise<void>;
  revealCanonicalNode(nodeId: string): Promise<void>;
  askCompanion(action: AgentVerb, nodeId: string | undefined): Promise<void>;
  updateAgentAgreements(agreements: AgentAgreements): void;
  agentPort(): AgentPort;
}

export interface StudioSurfaceCommandHandlers {
  openWorldPreview(): StudioExecutionViewState | undefined;
  openWorkbench(): Promise<void>;
  openActorInspector(): ProjectActors | undefined;
  updateActor(patch?: unknown): Promise<ProjectActors | undefined>;
}

export function createStudioSurfaceCommandHandlers(
  port: StudioSurfaceCommandPort,
): StudioSurfaceCommandHandlers {
  const workbenchLocale = (open: OpenProject): WorkbenchLocale =>
    open.project.stored.metadata.locale?.toLowerCase().startsWith("es") ? "es" : "en";

  const openWorldPreview = (): StudioExecutionViewState | undefined => {
    const view = port.currentExecutionView() ?? port.resetExecution();
    if (view === undefined) {
      return undefined;
    }
    openWorldPreviewPanel(view, (nodeId) => {
      port.hub.select(nodeId, "preview");
    });
    return view;
  };

  const openWorkbench = async (): Promise<void> => {
    const open = port.requireProject();
    if (open === undefined) {
      return;
    }
    openWorkbenchPanel(
      port.context,
      {
        getProgram: port.getProgram,
        reachedGoal: () => {
          const project = port.getProject();
          if (project === undefined) return false;
          try {
            return evidenceForProgram(project, project.stored.program).reachedGoal;
          } catch {
            return false;
          }
        },
        commit: async (program) => {
          if (port.requireProject() === undefined) {
            return;
          }
          await port.commitProgram(program);
        },
        openProposalReview: async () => {
          const proposal = port.getActiveProposal();
          if (proposal !== undefined) {
            await port.reviewProposalSession(proposal);
          }
        },
        reveal: (nodeId) => {
          port.hub.select(nodeId, "canvas");
          return Promise.resolve();
        },
        askAgent: (verb, nodeId) => port.askCompanion(verb, nodeId),
        updateAgreements: port.updateAgentAgreements,
      },
      port.agentPort(),
      port.hub,
      workbenchLocale(open),
    );
    refreshWorkbench();
  };

  const applyActorPatch = async (
    patch: Parameters<typeof patchActive>[1],
  ): Promise<ProjectActors | { readonly error: string }> => {
    const project = port.getProject();
    if (project === undefined) {
      return { error: "No project is open." };
    }
    try {
      const next = patchActive(actorsOf(project.stored), patch);
      await port.commitActors(next);
      return next;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Invalid actor change." };
    }
  };

  const openActorInspector = (): ProjectActors | undefined => {
    const open = port.requireProject();
    if (open === undefined) {
      return undefined;
    }
    const actors = actorsOf(open.project.stored);
    openActorInspectorPanel(actors, { applyPatch: applyActorPatch });
    return actors;
  };

  const updateActor = async (patch?: unknown): Promise<ProjectActors | undefined> => {
    const result = await applyActorPatch(validatedPatch(patch));
    if ("error" in result) {
      throw new Error(result.error);
    }
    return result;
  };

  return { openWorldPreview, openWorkbench, openActorInspector, updateActor };
}

/** Programmatic edits use the same limits as the Inspector webview. */
function validatedPatch(patch: unknown): Parameters<typeof patchActive>[1] {
  const result = validateMessage(actorInspectorInboundSchemas, {
    ...(typeof patch === "object" && patch !== null ? patch : {}),
    type: "agorix-actor-patch",
  });
  if (!result.ok || result.message.type !== "agorix-actor-patch") {
    throw new Error("Invalid actor change.");
  }
  return withoutType(result.message);
}

function withoutType<T extends { readonly type: string }>(message: T): Omit<T, "type"> {
  const copy: Record<string, unknown> = { ...message };
  delete copy["type"];
  return copy as Omit<T, "type">;
}
