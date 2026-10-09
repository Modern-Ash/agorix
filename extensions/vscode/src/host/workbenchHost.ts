import {
  BlockEditorAdapterError,
  applyWorkspaceChange,
  getCanonicalNodeIdForBlock,
  programToWorkspace,
} from "@agorix/block-editor";
import { intentToChange, type AgentAnchorRef, type AgentVerb } from "@agorix/interaction-core";
import { ProgramValidationError, type ProjectProgram } from "@agorix/program-model";
import { programSemanticHash } from "@agorix/proposals";
import {
  STUDIO_PROTOCOL_VERSION,
  type ActorPatch,
  type ActorView,
  type ChangeRefusalReason,
  type ExperienceFacts,
  type HostMessage,
  type UiMessage,
} from "@agorix/studio-protocol";
import {
  missionSpecHash,
  validateProjectMissionSpec,
  type ProjectActor,
  type ProjectActors,
  type ProjectMetadata,
  type ProjectMissionSpec,
} from "@agorix/persistence";
import type { AgentAgreements } from "@agorix/agent-workflow";
import type { ProactiveDecision, StudioSignal } from "@agorix/learning-decision-plane";
import type { SyncState } from "../sync/syncHub.js";
import { defaultProjectActor, studioAssetCatalog } from "../studioCore.js";
import { getLocalizedFirstMission } from "@agorix/curriculum";

export interface HostPort {
  getProgram(): ProjectProgram | undefined;
  getMetadata(): ProjectMetadata | undefined;
  commit(program: ProjectProgram, label: string): Promise<void>;
  commitMetadata(metadata: ProjectMetadata, label: string): Promise<void>;
  openProposalReview(proposalId: string): Promise<void>;
  reveal(nodeId: string): Promise<void>;
  askAgent(verb: AgentVerb, nodeId: string | undefined): Promise<void>;
  updateAgreements(agreements: AgentAgreements): void;
  /** True when the current program reaches the goal in the deterministic runtime. */
  reachedGoal?(): boolean;
}

export interface WorkbenchHost {
  handle(message: UiMessage): Promise<HostMessage[]>;
  snapshot(): HostMessage[];
  syncMessage(state: SyncState): HostMessage[];
  /** Non-personal session facts behind the automatic density; both only ever go up. */
  experience(): ExperienceFacts;
  ambientHint(signal: StudioSignal, decision: ProactiveDecision): HostMessage[];
  clearAmbientHint(): HostMessage[];
}

const schema = STUDIO_PROTOCOL_VERSION;

function actorView(actor: ProjectActor, program: ProjectProgram | undefined): ActorView {
  const costumeId = actor.costumeId ?? actor.appearanceId;
  return {
    id: actor.id,
    name: actor.name,
    x: actor.x,
    y: actor.y,
    direction: actor.direction,
    size: actor.size,
    visible: actor.visible,
    ...(costumeId === undefined ? {} : { costumeId }),
    scriptCount: actor.scripts?.length ?? program?.scripts.length ?? 0,
  };
}

function actorsForMetadata(metadata: ProjectMetadata): ProjectActors {
  const rawActors = metadata.actors as unknown;
  if (Array.isArray(rawActors)) {
    const [first] = rawActors as readonly ProjectActor[];
    return first === undefined
      ? {
          activeId: defaultProjectActor(metadata.locale).id,
          items: [defaultProjectActor(metadata.locale)],
        }
      : { activeId: first.id, items: rawActors as readonly ProjectActor[] };
  }
  const fallback = defaultProjectActor(metadata.locale);
  return metadata.actors ?? { activeId: fallback.id, items: [fallback] };
}

function actorPatchForPersistence(patch: ActorPatch): Partial<ProjectActor> {
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => key !== "appearanceId"),
  ) as Partial<ProjectActor>;
}

function knownCostumeIds(metadata: ProjectMetadata): ReadonlySet<string> {
  return new Set(
    [...(metadata.assets ?? []), ...studioAssetCatalog()]
      .filter((asset) => asset.kind === "costume")
      .map((asset) => asset.id),
  );
}

function missionSpecForMetadata(metadata: ProjectMetadata): ProjectMissionSpec {
  if (metadata.missionSpec !== undefined) return validateProjectMissionSpec(metadata.missionSpec);
  const mission = getLocalizedFirstMission(metadata.locale);
  return {
    goal: mission.goal.learnerFacing.slice(0, 140),
    successCheck: "touches-goal",
    predictionPrompt: "Will the character reach the goal?",
  };
}

function refusalReason(error: unknown): ChangeRefusalReason {
  if (error instanceof BlockEditorAdapterError) return error.reason ?? "UNKNOWN";
  if (error instanceof ProgramValidationError) return "WOULD_BREAK_PROGRAM";
  return "UNKNOWN";
}

function isKnownFailure(error: unknown): boolean {
  return error instanceof BlockEditorAdapterError || error instanceof ProgramValidationError;
}

function isMutatingIntent(intent: UiMessage & { readonly type: "intent" }): boolean {
  return (
    intent.intent.type === "insertBlock" ||
    intent.intent.type === "moveBlock" ||
    intent.intent.type === "deleteBlock"
  );
}

export function createWorkbenchHost(port: HostPort, newBlockId: () => string): WorkbenchHost {
  let edits = 0;
  let reachedGoal = false;

  function actorsMessage(): HostMessage[] {
    const metadata = port.getMetadata();
    if (metadata === undefined) return [];
    const program = port.getProgram();
    const actorSet = actorsForMetadata(metadata);
    const actors = actorSet.items.map((actor) => actorView(actor, program));
    return [
      {
        schema,
        type: "actors",
        actors,
        selectedActorId: actorSet.activeId,
      },
    ];
  }

  function missionSpecMessage(): HostMessage[] {
    const metadata = port.getMetadata();
    if (metadata === undefined) return [];
    const spec = missionSpecForMetadata(metadata);
    return [
      {
        schema,
        type: "missionSpec",
        spec: { ...spec, hash: missionSpecHash(spec) ?? "mission:00000000" },
      },
    ];
  }

  function snapshot(): HostMessage[] {
    const program = port.getProgram();
    if (program === undefined) {
      return actorsMessage();
    }
    try {
      const { workspace } = programToWorkspace(program);
      return [
        { schema, type: "workspace", workspace, programHash: programSemanticHash(program) },
        ...actorsMessage(),
        { schema, type: "assets", assets: studioAssetCatalog() },
        ...missionSpecMessage(),
      ];
    } catch (error) {
      if (isKnownFailure(error)) {
        return [{ schema, type: "error", code: "INVALID_PROGRAM" }];
      }
      throw error;
    }
  }

  function syncMessage(state: SyncState): HostMessage[] {
    const program = port.getProgram();
    if (program === undefined) return [];
    try {
      const { mapping } = programToWorkspace(program);
      const blockFor = (nodeId: string | undefined): string | undefined =>
        nodeId === undefined
          ? undefined
          : mapping.find((entry) => entry.nodeId === nodeId)?.blockId;
      const selectedBlockId = blockFor(state.selectedNodeId);
      const executingBlockId = blockFor(state.executingNodeId);
      const failedBlockId = blockFor(state.failedNodeId);
      return [
        {
          schema,
          type: "sync",
          ...(selectedBlockId === undefined ? {} : { selectedBlockId }),
          ...(executingBlockId === undefined ? {} : { executingBlockId }),
          ...(failedBlockId === undefined ? {} : { failedBlockId }),
        },
      ];
    } catch (error) {
      if (isKnownFailure(error)) return [];
      throw error;
    }
  }

  function blockForNode(nodeId: string | undefined): string | undefined {
    if (nodeId === undefined) return undefined;
    const program = port.getProgram();
    if (program === undefined) return undefined;
    try {
      const { mapping } = programToWorkspace(program);
      return mapping.find((entry) => entry.nodeId === nodeId)?.blockId;
    } catch (error) {
      if (isKnownFailure(error)) return undefined;
      throw error;
    }
  }

  function ambientHint(signal: StudioSignal, decision: ProactiveDecision): HostMessage[] {
    if (decision.action !== "offer") return clearAmbientHint();
    const blockId = blockForNode(signal.nodeIds?.[0]);
    return [
      {
        schema,
        type: "ambientHint",
        hint: {
          label: labelForAmbientHint(signal, decision),
          actions: decision.actions ?? ["explain"],
          ...(blockId === undefined ? {} : { blockId }),
        },
      },
    ];
  }

  function clearAmbientHint(): HostMessage[] {
    return [{ schema, type: "ambientHint" }];
  }

  function canonicalNodeId(id: string | undefined): string | undefined {
    if (id === undefined) return undefined;
    const program = port.getProgram();
    if (program === undefined) return id;
    try {
      const { mapping } = programToWorkspace(program);
      return getCanonicalNodeIdForBlock(mapping, id) ?? id;
    } catch (error) {
      if (isKnownFailure(error)) return id;
      throw error;
    }
  }

  function nodeIdForAnchor(anchor: AgentAnchorRef): string | undefined {
    return anchor.kind === "node" ? canonicalNodeId(anchor.id) : undefined;
  }

  async function handle(message: UiMessage): Promise<HostMessage[]> {
    switch (message.type) {
      case "ready":
        return snapshot();
      case "intent": {
        const intent = message.intent;
        if (intent.type === "revealNode") {
          await port.reveal(canonicalNodeId(intent.nodeId) ?? intent.nodeId);
          return [];
        }
        if (intent.type === "reviewProposal") {
          await port.openProposalReview(intent.proposalId);
          return [];
        }
        if (intent.type === "askAgent") {
          await port.askAgent(intent.verb, nodeIdForAnchor(intent.about));
          return [];
        }
        if (intent.type === "highlightNodes") {
          const nodeId = canonicalNodeId(intent.nodeIds[0]);
          if (nodeId !== undefined) {
            await port.reveal(nodeId);
          }
          return [];
        }
        const program = port.getProgram();
        if (program === undefined) {
          return [];
        }
        if (isMutatingIntent(message) && message.baseHash !== programSemanticHash(program)) {
          return [{ schema, type: "error", code: "STALE_EDIT" }, ...snapshot()];
        }
        try {
          const change = intentToChange(intent, newBlockId);
          if (change === undefined) {
            return [];
          }
          const { workspace } = programToWorkspace(program);
          await port.commit(
            applyWorkspaceChange(workspace, change).program,
            `Workbench: ${intent.type}`,
          );
          edits += 1;
        } catch (error) {
          if (isKnownFailure(error) || error instanceof Error) {
            return [
              { schema, type: "error", code: "INVALID_CHANGE", reason: refusalReason(error) },
            ];
          }
          throw error;
        }
        return snapshot();
      }
      case "agreementsChanged":
        port.updateAgreements(message.agreements);
        return [];
      case "updateActor": {
        const metadata = port.getMetadata();
        if (metadata === undefined) return [];
        const current = actorsForMetadata(metadata);
        const patch = actorPatchForPersistence(message.patch);
        if (!current.items.some((actor) => actor.id === message.actorId)) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "BLOCK_NOT_FOUND" }];
        }
        if (patch.costumeId !== undefined && !knownCostumeIds(metadata).has(patch.costumeId)) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        const nextActors = current.items.map((actor) =>
          actor.id === message.actorId ? { ...actor, ...patch } : actor,
        );
        await port.commitMetadata(
          {
            ...metadata,
            actors: { activeId: current.activeId, items: nextActors },
          },
          "Workbench: update actor",
        );
        return actorsMessage();
      }
      case "updateMissionSpec": {
        const metadata = port.getMetadata();
        if (metadata === undefined) return [];
        let spec: ProjectMissionSpec;
        try {
          spec = validateProjectMissionSpec(message.spec);
        } catch {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        await port.commitMetadata(
          {
            ...metadata,
            missionSpec: spec,
          },
          "Workbench: update mission spec",
        );
        return missionSpecMessage();
      }
      default:
        // Agent-loop and proposal messages are handled by the agent host.
        return [];
    }
  }

  function experience(): ExperienceFacts {
    // Sticky: deleting blocks later must not flip the layout back and forth.
    if (!reachedGoal && port.reachedGoal?.() === true) reachedGoal = true;
    return { edits, reachedGoal };
  }

  return { experience, handle, snapshot, syncMessage, ambientHint, clearAmbientHint };
}

function labelForAmbientHint(signal: StudioSignal, decision: ProactiveDecision): string {
  const actions = decision.actions ?? [];
  if (actions.includes("debug")) return "Companion can debug this with runtime evidence.";
  if (actions.includes("propose")) return "Companion can suggest a small next step.";
  if (actions.includes("challenge")) return "Companion can ask you to predict what happens.";
  if (signal.kind === "repeat-pattern") return "Companion noticed repeated steps.";
  return "Companion can explain what is happening here.";
}
