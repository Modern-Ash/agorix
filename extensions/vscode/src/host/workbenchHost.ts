import {
  BlockEditorAdapterError,
  applyWorkspaceChange,
  getCanonicalNodeIdForBlock,
  programToWorkspace,
} from "@agorix/block-editor";
import { intentToChange, type AgentAnchorRef, type AgentVerb } from "@agorix/interaction-core";
import {
  ProgramValidationError,
  validateProgram,
  validEmbeddedImageSource,
  validEmbeddedSoundSource,
  type ProjectProgram,
} from "@agorix/program-model";
import { programSemanticHash } from "@agorix/proposals";
import {
  STUDIO_PROTOCOL_VERSION,
  type ActorPatch,
  type ActorView,
  type AssetView,
  type ChangeRefusalReason,
  type ExperienceFacts,
  type HostMessage,
  type UiMessage,
  type ValidationIssueView,
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
import { defaultProjectActor, defaultProjectStage, studioAssetCatalog } from "../studioCore.js";
import { ADVANCED_SOUNDS, getLocalizedFirstMission } from "@agorix/curriculum";
import type { RuntimeEvent } from "@agorix/runtime";
import type { StudioExecutionViewState } from "../studioCore.js";

export interface HostPort {
  historyState(): { canUndo: boolean; canRedo: boolean };
  runStageEvent?(event: RuntimeEvent): StudioExecutionViewState | undefined;
  getProgram(): ProjectProgram | undefined;
  getMetadata(): ProjectMetadata | undefined;
  commit(program: ProjectProgram, label: string): Promise<void>;
  commitMetadata(metadata: ProjectMetadata, label: string): Promise<void>;
  commitProject(program: ProjectProgram, metadata: ProjectMetadata, label: string): Promise<void>;
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
    ...(actor.scripts === undefined ? {} : { scriptIds: actor.scripts }),
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

function referencesActor(value: unknown, actorId: string): boolean {
  if (Array.isArray(value)) return value.some((item) => referencesActor(item, actorId));
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record["actorId"] === actorId ||
    Object.values(record).some((item) => referencesActor(item, actorId))
  );
}

function actorPatchForPersistence(patch: ActorPatch): Partial<ProjectActor> {
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => key !== "appearanceId"),
  ) as Partial<ProjectActor>;
}

function assetsForMetadata(metadata: ProjectMetadata): readonly AssetView[] {
  const catalog = studioAssetCatalog();
  const catalogIds = new Set(catalog.map((asset) => asset.id));
  const overrides = new Map((metadata.assets ?? []).map((asset) => [asset.id, asset]));
  const toView = (asset: NonNullable<ProjectMetadata["assets"]>[number]): AssetView => ({
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    tags: asset.tags ?? [],
    ...(/^builtin:kids-gallery-(costume|backdrop):[a-z]+$/.test(asset.source) ||
    [
      "builtin:costume.default",
      "builtin:costume.spark",
      "builtin:space.trailhead",
      "builtin:space.nebula",
    ].includes(asset.source) ||
    ADVANCED_SOUNDS.some((sound) => sound.source === asset.source) ||
    validEmbeddedImageSource(asset.source) ||
    (asset.kind === "sound" && validEmbeddedSoundSource(asset.source))
      ? { source: asset.source }
      : {}),
  });
  return [
    ...catalog.map((asset) => {
      const override = overrides.get(asset.id);
      return override === undefined ? asset : toView(override);
    }),
    ...(metadata.assets ?? []).filter((asset) => !catalogIds.has(asset.id)).map(toView),
  ];
}

function knownAssetIds(
  metadata: ProjectMetadata,
  kind?: "backdrop" | "costume" | "sound",
): ReadonlySet<string> {
  return new Set(
    [...(metadata.assets ?? []), ...studioAssetCatalog()]
      .filter((asset) => kind === undefined || asset.kind === kind)
      .map((asset) => asset.id),
  );
}

/** Persist a selected bundled asset before canonical actors, stage or blocks reference it. */
function metadataWithCatalogAsset(
  metadata: ProjectMetadata,
  kind: "costume" | "backdrop" | "sound",
  assetId: string,
): ProjectMetadata | undefined {
  const existing = metadata.assets?.find((asset) => asset.id === assetId);
  if (existing !== undefined) return existing.kind === kind ? metadata : undefined;
  const asset = studioAssetCatalog().find((entry) => entry.id === assetId && entry.kind === kind);
  if (asset?.source === undefined || (metadata.assets?.length ?? 0) >= 128) return undefined;
  return {
    ...metadata,
    assets: [
      ...(metadata.assets ?? []),
      { id: asset.id, kind, name: asset.name, source: asset.source, tags: asset.tags },
    ],
  };
}

function validationIssuesForMetadata(metadata: ProjectMetadata): readonly ValidationIssueView[] {
  const actorSet = actorsForMetadata(metadata);
  const actorIds = new Set(actorSet.items.map((actor) => actor.id));
  const costumeIds = knownAssetIds(metadata, "costume");
  const backdropIds = knownAssetIds(metadata, "backdrop");
  const issues: ValidationIssueView[] = [];

  actorSet.items.forEach((actor, index) => {
    const costumeId = actor.costumeId ?? actor.appearanceId;
    if (costumeId !== undefined && !costumeIds.has(costumeId)) {
      issues.push({
        id: `validation:actor-costume:${actor.id}`,
        severity: "error",
        kind: "missing-costume",
        path: `metadata.actors.items[${index}].costumeId`,
        ref: costumeId,
        message: `Actor "${actor.id}" references missing costume "${costumeId}".`,
      });
    }
  });

  metadata.stage?.actorOrder?.forEach((actorId, index) => {
    if (!actorIds.has(actorId)) {
      issues.push({
        id: `validation:stage-actor:${actorId}:${index}`,
        severity: "error",
        kind: "missing-actor",
        path: `metadata.stage.actorOrder[${index}]`,
        ref: actorId,
        message: `Stage order references missing actor "${actorId}".`,
      });
    }
  });

  const backdropId = metadata.stage?.backdropId;
  if (backdropId !== undefined && !backdropIds.has(backdropId)) {
    issues.push({
      id: `validation:stage-backdrop:${backdropId}`,
      severity: "error",
      kind: "missing-backdrop",
      path: "metadata.stage.backdropId",
      ref: backdropId,
      message: `Stage references missing backdrop "${backdropId}".`,
    });
  }

  return issues;
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
    intent.intent.type === "deleteBlock" ||
    intent.intent.type === "setNumericField" ||
    intent.intent.type === "setTextField" ||
    intent.intent.type === "replaceCondition" ||
    intent.intent.type === "setConditionNumber" ||
    intent.intent.type === "setComparisonOperand" ||
    intent.intent.type === "setConditionBoolean" ||
    intent.intent.type === "setConditionActor" ||
    intent.intent.type === "setLogicalOperand" ||
    intent.intent.type === "setLogicalBoolean" ||
    intent.intent.type === "addVariable" ||
    intent.intent.type === "renameVariable" ||
    intent.intent.type === "deleteVariable" ||
    intent.intent.type === "setVariableInitialValue" ||
    intent.intent.type === "setVariableVisible" ||
    intent.intent.type === "addList" ||
    intent.intent.type === "renameList" ||
    intent.intent.type === "deleteList" ||
    intent.intent.type === "setListVisible" ||
    intent.intent.type === "setListInitialItems" ||
    intent.intent.type === "setExpressionNumber" ||
    intent.intent.type === "setNumericInput" ||
    intent.intent.type === "setArithmeticOperand" ||
    intent.intent.type === "setArithmeticOperandSource"
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

  function validationMessage(): HostMessage[] {
    const metadata = port.getMetadata();
    if (metadata === undefined) return [];
    return [{ schema, type: "validation", issues: validationIssuesForMetadata(metadata) }];
  }

  function sceneMessage(): HostMessage[] {
    const metadata = port.getMetadata();
    if (metadata === undefined) return [];
    const backdropId = metadata.stage?.backdropId ?? defaultProjectStage().backdropId;
    return [{ schema, type: "scene", ...(backdropId === undefined ? {} : { backdropId }) }];
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
        ...sceneMessage(),
        {
          schema,
          type: "assets",
          assets:
            port.getMetadata() === undefined
              ? studioAssetCatalog()
              : assetsForMetadata(port.getMetadata()!),
        },
        ...validationMessage(),
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
        let assetMetadata: ProjectMetadata | undefined;
        if (intent.type === "setTextField") {
          if (intent.field === "actorId") {
            const metadata = port.getMetadata();
            if (
              metadata === undefined ||
              !actorsForMetadata(metadata).items.some((actor) => actor.id === intent.value)
            ) {
              return [
                { schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" },
              ];
            }
          }
          if (
            intent.field === "listId" &&
            !program.lists?.some((list) => list.id === intent.value)
          ) {
            return [
              { schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" },
            ];
          }
          const kind =
            intent.field === "costumeId"
              ? "costume"
              : intent.field === "backdropId"
                ? "backdrop"
                : intent.field === "soundId"
                  ? "sound"
                  : undefined;
          if (kind !== undefined) {
            const metadata = port.getMetadata();
            assetMetadata =
              metadata === undefined
                ? undefined
                : metadataWithCatalogAsset(metadata, kind, intent.value);
            if (assetMetadata === undefined) {
              return [
                { schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" },
              ];
            }
          }
        }
        if (
          intent.type === "setConditionActor" ||
          (intent.type === "replaceCondition" && intent.blockType === "sensing_touching_actor")
        ) {
          const metadata = port.getMetadata();
          const actorId =
            intent.type === "setConditionActor" ? intent.actorId : (intent.actorId ?? "actor:main");
          if (
            metadata === undefined ||
            !actorsForMetadata(metadata).items.some((actor) => actor.id === actorId)
          ) {
            return [
              { schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" },
            ];
          }
        }
        if (
          (intent.type === "setNumericInput" || intent.type === "setArithmeticOperandSource") &&
          intent.reporter === "distanceToActor"
        ) {
          const metadata = port.getMetadata();
          if (
            metadata === undefined ||
            !actorsForMetadata(metadata).items.some((actor) => actor.id === intent.referenceId)
          ) {
            return [
              { schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" },
            ];
          }
        }
        try {
          const { workspace } = programToWorkspace(program);
          const change = intentToChange(intent, newBlockId, workspace);
          if (change === undefined) {
            return intent.type === "setNumericField" ||
              intent.type === "setTextField" ||
              intent.type === "replaceCondition" ||
              intent.type === "setConditionNumber" ||
              intent.type === "setComparisonOperand" ||
              intent.type === "setConditionBoolean" ||
              intent.type === "setConditionActor" ||
              intent.type === "setLogicalOperand" ||
              intent.type === "setLogicalBoolean" ||
              intent.type === "addVariable" ||
              intent.type === "renameVariable" ||
              intent.type === "deleteVariable" ||
              intent.type === "setVariableInitialValue" ||
              intent.type === "setVariableVisible" ||
              intent.type === "addList" ||
              intent.type === "renameList" ||
              intent.type === "deleteList" ||
              intent.type === "setListVisible" ||
              intent.type === "setListInitialItems" ||
              (intent.type === "insertBlock" && intent.blockType.startsWith("lists_")) ||
              intent.type === "setExpressionNumber" ||
              intent.type === "setNumericInput" ||
              intent.type === "setArithmeticOperandSource" ||
              intent.type === "setArithmeticOperand"
              ? [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }]
              : [];
          }
          const nextProgram = applyWorkspaceChange(workspace, change).program;
          if (assetMetadata !== undefined && assetMetadata !== port.getMetadata())
            await port.commitProject(nextProgram, assetMetadata, `Workbench: ${intent.type}`);
          else await port.commit(nextProgram, `Workbench: ${intent.type}`);
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
        const withCostume =
          patch.costumeId === undefined
            ? metadata
            : metadataWithCatalogAsset(metadata, "costume", patch.costumeId);
        if (withCostume === undefined) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        const nextActors = current.items.map((actor) =>
          actor.id === message.actorId ? { ...actor, ...patch } : actor,
        );
        await port.commitMetadata(
          {
            ...withCostume,
            actors: { activeId: current.activeId, items: nextActors },
          },
          "Workbench: update actor",
        );
        return [...actorsMessage(), ...validationMessage()];
      }
      case "createActor": {
        const program = port.getProgram();
        const metadata = port.getMetadata();
        if (program === undefined || metadata === undefined) return [];
        const withCostume = metadataWithCatalogAsset(
          metadata,
          "costume",
          message.costumeId ?? "asset:costume.default",
        );
        if (withCostume === undefined) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        const current = actorsForMetadata(metadata);
        if (current.items.length >= 32 || program.scripts.length >= 64) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        let actorId = "";
        do {
          actorId = `actor:${newBlockId().replace(/[^A-Za-z0-9_]/g, "_")}`;
        } while (current.items.some((actor) => actor.id === actorId));
        const scriptId = `script:${actorId.slice("actor:".length)}`;
        if (program.scripts.some((script) => script.id === scriptId)) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        const nextProgram = validateProgram({
          ...program,
          scripts: [
            ...program.scripts,
            { id: scriptId, trigger: { type: "greenFlag" }, statements: [] },
          ],
        });
        const ownedExisting = current.items.map((actor) => ({
          ...actor,
          scripts: actor.scripts ?? program.scripts.map((script) => script.id),
        }));
        const actor: ProjectActor = {
          id: actorId,
          name: message.name,
          x: 40,
          y: 40,
          direction: 0,
          size: 100,
          visible: true,
          costumeId: message.costumeId ?? "asset:costume.default",
          scripts: [scriptId],
        };
        const stage = metadata.stage ?? defaultProjectStage();
        const nextMetadata: ProjectMetadata = {
          ...withCostume,
          actors: { activeId: actorId, items: [...ownedExisting, actor] },
          stage: {
            ...stage,
            actorOrder: [...(stage.actorOrder ?? ownedExisting.map((item) => item.id)), actorId],
          },
        };
        await port.commitProject(nextProgram, nextMetadata, "Workbench: create actor and script");
        return snapshot();
      }
      case "deleteActor": {
        const program = port.getProgram();
        const metadata = port.getMetadata();
        if (program === undefined || metadata === undefined) return [];
        if (message.baseHash !== programSemanticHash(program)) {
          return [{ schema, type: "error", code: "STALE_EDIT" }, ...snapshot()];
        }
        const current = actorsForMetadata(metadata);
        const actor = current.items.find((item) => item.id === message.actorId);
        const owned = actor?.scripts;
        if (
          current.items.length <= 1 ||
          owned === undefined ||
          owned.length !== message.ownedScriptIds.length ||
          owned.some((id, index) => id !== message.ownedScriptIds[index]) ||
          owned.some((id) => !program.scripts.some((script) => script.id === id)) ||
          current.items.some(
            (item) =>
              item.id !== message.actorId &&
              (item.scripts === undefined || item.scripts.some((id) => owned.includes(id))),
          )
        ) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        const ownedIds = new Set(owned);
        const remainingScripts = program.scripts.filter((script) => !ownedIds.has(script.id));
        if (remainingScripts.length === 0 || referencesActor(remainingScripts, message.actorId)) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        const remainingActors = current.items.filter((item) => item.id !== message.actorId);
        const activeId =
          current.activeId === message.actorId ? remainingActors[0]!.id : current.activeId;
        const stage = metadata.stage ?? defaultProjectStage();
        const nextMetadata: ProjectMetadata = {
          ...metadata,
          actors: { activeId, items: remainingActors },
          stage: {
            ...stage,
            ...(stage.actorOrder === undefined
              ? {}
              : { actorOrder: stage.actorOrder.filter((id) => id !== message.actorId) }),
          },
        };
        await port.commitProject(
          validateProgram({ ...program, scripts: remainingScripts }),
          nextMetadata,
          "Workbench: delete actor and owned scripts",
        );
        return snapshot();
      }
      case "createScript": {
        const program = port.getProgram();
        const metadata = port.getMetadata();
        if (program === undefined || metadata === undefined) return [];
        if (message.baseHash !== programSemanticHash(program)) {
          return [{ schema, type: "error", code: "STALE_EDIT" }, ...snapshot()];
        }
        const current = actorsForMetadata(metadata);
        if (
          program.scripts.length >= 64 ||
          !current.items.some((actor) => actor.id === message.actorId)
        ) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        let scriptId = "";
        do {
          scriptId = `script:studio_${newBlockId().replace(/[^A-Za-z0-9_]/g, "_")}`;
        } while (program.scripts.some((script) => script.id === scriptId));
        const trigger =
          message.trigger === "onMessage"
            ? { type: "onMessage" as const, message: message.message! }
            : message.trigger === "onKeyPressed"
              ? { type: "onKeyPressed" as const, key: message.key! }
              : message.trigger === "onActorClicked"
                ? { type: "onActorClicked" as const }
                : { type: "greenFlag" as const };
        const nextProgram = validateProgram({
          ...program,
          scripts: [...program.scripts, { id: scriptId, trigger, statements: [] }],
        });
        const nextActors = current.items.map((actor) => ({
          ...actor,
          scripts:
            actor.id === message.actorId
              ? [...(actor.scripts ?? program.scripts.map((script) => script.id)), scriptId]
              : (actor.scripts ?? program.scripts.map((script) => script.id)),
        }));
        await port.commitProject(
          nextProgram,
          { ...metadata, actors: { activeId: message.actorId, items: nextActors } },
          "Workbench: create actor script",
        );
        return snapshot();
      }
      case "deleteScript": {
        const program = port.getProgram();
        const metadata = port.getMetadata();
        if (program === undefined || metadata === undefined) return [];
        if (message.baseHash !== programSemanticHash(program)) {
          return [{ schema, type: "error", code: "STALE_EDIT" }, ...snapshot()];
        }
        const current = actorsForMetadata(metadata);
        const owner = current.items.find((actor) => actor.id === message.actorId);
        const scriptIds = owner?.scripts ?? program.scripts.map((script) => script.id);
        if (
          program.scripts.length <= 1 ||
          owner === undefined ||
          !scriptIds.includes(message.scriptId) ||
          !program.scripts.some((script) => script.id === message.scriptId)
        ) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        const nextProgram = validateProgram({
          ...program,
          scripts: program.scripts.filter((script) => script.id !== message.scriptId),
        });
        const nextActors = current.items.map((actor) => ({
          ...actor,
          scripts: (actor.scripts ?? program.scripts.map((script) => script.id)).filter(
            (id) => id !== message.scriptId,
          ),
        }));
        await port.commitProject(
          nextProgram,
          { ...metadata, actors: { activeId: current.activeId, items: nextActors } },
          "Workbench: delete actor script",
        );
        return snapshot();
      }
      case "importAsset": {
        const metadata = port.getMetadata();
        if (metadata === undefined) return [];
        if (
          !(message.kind === "sound"
            ? validEmbeddedSoundSource(message.source)
            : validEmbeddedImageSource(message.source)) ||
          (metadata.assets?.length ?? 0) >= 128
        ) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        const known = knownAssetIds(metadata);
        let id = "";
        do {
          id = `asset:studio_${newBlockId().replace(/[^A-Za-z0-9_]/g, "_")}`;
        } while (known.has(id));
        await port.commitMetadata(
          {
            ...metadata,
            assets: [
              ...(metadata.assets ?? []),
              { id, kind: message.kind, name: message.name, source: message.source },
            ],
          },
          "Workbench: import asset",
        );
        return snapshot();
      }
      case "updateAsset": {
        const metadata = port.getMetadata();
        if (metadata === undefined || !validEmbeddedImageSource(message.source)) return [];
        const existing = metadata.assets?.find((asset) => asset.id === message.assetId);
        const catalog = studioAssetCatalog().find((asset) => asset.id === message.assetId);
        const target = existing ?? catalog;
        if (target === undefined || (target.kind !== "costume" && target.kind !== "backdrop")) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        const replacement = {
          ...(existing ?? {
            id: target.id,
            kind: target.kind,
            ...(target.tags === undefined ? {} : { tags: target.tags }),
          }),
          name: message.name,
          source: message.source,
        };
        await port.commitMetadata(
          {
            ...metadata,
            assets:
              existing === undefined
                ? [...(metadata.assets ?? []), replacement]
                : metadata.assets!.map((asset) =>
                    asset.id === message.assetId ? replacement : asset,
                  ),
          },
          "Workbench: edit image asset",
        );
        return snapshot();
      }
      case "updateStage": {
        const metadata = port.getMetadata();
        if (metadata === undefined) return [];
        const withBackdrop = metadataWithCatalogAsset(metadata, "backdrop", message.backdropId);
        if (withBackdrop === undefined) {
          return [{ schema, type: "error", code: "INVALID_CHANGE", reason: "WOULD_BREAK_PROGRAM" }];
        }
        await port.commitMetadata(
          { ...withBackdrop, stage: { ...withBackdrop.stage, backdropId: message.backdropId } },
          "Workbench: update stage backdrop",
        );
        return [...sceneMessage(), ...validationMessage()];
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
