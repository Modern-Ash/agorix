import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  parseAgorixProject,
  sanitizeAgorixFilename,
  semanticProjectHash,
  serializeAgorixProject,
  ACTOR_NAME_MAX_LENGTH,
  ACTOR_SIZE_MAX,
  ACTOR_SIZE_MIN,
  type ProjectActors,
  type ProjectMetadata,
} from "@agorix/persistence";
import type {
  ProjectActor,
  ProjectAsset,
  ProjectCreativeState,
  ProjectProgram,
} from "@agorix/program-model";
import {
  createEditorHistory,
  recordCanonicalTransaction,
  redoCanonicalTransaction,
  undoCanonicalTransaction,
  type BlockNode,
  type BlockWorkspaceSnapshot,
  type EditorHistory,
} from "@agorix/block-editor";
import {
  WORLDS,
  createMissionRunFeedback,
  getLocalizedFirstMission,
  getWorld,
  worldCopy,
  type WorldDefinition,
  type WorldPalette,
} from "@agorix/curriculum";
import {
  acceptIntentPlan,
  createDeterministicIntentPlan,
  createDeterministicTutorResponse,
  createLearningCompanionRequestFromTutorRequest,
  createIntentPlanRequest,
  createTutorRequest,
  editIntentPlanStep,
  rejectIntentPlan,
  type IntentPlan,
  type IntentPlanResponse,
  type TutorHintHistoryEntry,
  type TutorResponse,
} from "@agorix/tutor-contract";
import {
  decideProactiveSuggestion,
  decideProactiveWithLaya,
  type LayaBatchTransport,
  type ProactiveDecision,
  type ProactiveSignal,
} from "@agorix/learning-decision-plane";
import {
  acceptProposal,
  createProgramProposal,
  createProposalReview,
  createFirstStepProposal,
  createRepeatPatternProposal,
  detectRepeatPattern,
  createWebProposalCardView,
  programSemanticHash,
  rejectProposal,
  type ProposalReview,
} from "@agorix/proposals";
import {
  createWorldState,
  runMultiActorProgram,
  runProgram,
  touchingGoal,
  type MultiActorFrame,
  type MultiActorRuntimeActor,
  type RuntimeEvent,
  type RuntimeObservation,
  type RunResult,
  type VariableState,
  type WorldState,
} from "@agorix/runtime";
import type { PredictionAnswer } from "@agorix/agent-workflow";
import {
  deriveStageFeedback,
  executionStepsFromRuntimeObservations,
  framesFromRuntimeObservations,
  learnerTraceFromExecutionSteps,
  resetStageSession,
  resolveStageMotion,
  type ExecutionStep,
  type LearnerTraceItem,
  type ObservationFrame,
  type StageFeedback,
  type StageState,
  type StageVariableWatcher,
} from "@agorix/stage";
import {
  BASE_SPRITE_RADIUS,
  activeActor,
  defaultActors,
  patchActive,
  stageForActors,
  type ActorPatch,
} from "./actors.js";
import {
  addBlockToWorkspace,
  addBlockToWorkspaceAt,
  addScriptToWorkspace,
  blockNodeIdForPath,
  canContainStatements,
  childContainerPathFor,
  codeSliceForNode,
  INITIAL_STAGE,
  createEditorModel,
  createEditorModelFromProgram,
  deleteBlockFromWorkspaceAt,
  duplicateBlockInWorkspace,
  editBlockFieldAt,
  editIfConditionAt,
  editIfConditionNumberAt,
  editNumericBlockFieldAt,
  editVariableNumberInputAt,
  editScriptTriggerField,
  ifConditionKind,
  ifConditionNumberValue,
  indexInContainer,
  finalMoveIndex,
  INITIAL_STAGE,
  moveBlockInWorkspaceByPath,
  parentContainerPath,
  resetWorkspace,
  statementListAtPath,
  type AddableBlockType,
  type AddableTriggerType,
  type EditorModel,
  type EditorProjection,
  type IfConditionKind,
  type StatementPath,
} from "./editorModel.js";
import {
  createBrowserProjectPersistence,
  loadEditorProject,
  readLocalStoredProject,
  removeLocalStoredProject,
  saveEditorProject,
  type LoadedEditorProject,
  type ProjectPersistence,
} from "./projectStorage.js";
import { loadPresentationPrefs, savePresentationPrefs } from "./presentationPrefs.js";
import { LOCALE_LABELS, t, type Locale, type MessageKey } from "./i18n.js";
import { PredictionChip, PredictionComparison } from "./PredictionChip.js";
import { AgentCompanion, companionMood } from "./AgentCompanion.js";
import { ModelComparison } from "./ModelComparison.js";
import { GhostAddedBlocks } from "./GhostBlocks.js";
import { ghostMarksFor, type GhostMarkKind } from "./ghostMarks.js";
import { ProvenanceLabel } from "./ProvenanceLabel.js";
import { AccountUi, useWorkspace } from "./accounts/AccountUi.js";
import type { AccountBackend, ProjectDto } from "./accounts/clients.js";
import { createHttpBackend } from "./accounts/httpClient.js";
import { WorkspaceController } from "./accounts/workspace.js";
import { CODE_PROJECTION_IDS, projectCodeSurface, type CodeProjectionId } from "./codeSurface.js";
import {
  decideStaticWebLearningRoute,
  type WebLearningDecisionDiagnostics,
} from "./learningDecision.js";
import "./App.css";

type RunStatus = "idle" | "running" | "stopped" | "complete" | "retry" | "freeplay" | "error";

type PanelId = "action" | "program" | "stage" | "code" | "trace" | "companion";
type PanelArea = PanelId;

const PANEL_AREAS: readonly PanelArea[] = [
  "action",
  "program",
  "stage",
  "code",
  "trace",
  "companion",
];

const PANEL_LABELS: Record<PanelId, string> = {
  action: "Tools",
  program: "Blocks",
  stage: "Preview",
  code: "Code",
  trace: "Trace",
  companion: "AI",
};

const DEFAULT_PANEL_AREAS: Record<PanelId, PanelArea> = {
  action: "action",
  program: "program",
  stage: "stage",
  code: "code",
  trace: "trace",
  companion: "companion",
};

const BLOCK_DRAG_TYPE = "application/x-agorix-block-type";
const WORKSPACE_DRAG_TYPE = "application/x-agorix-workspace-index";
const MAX_ACTOR_SIZE = 400;

type PanelChromeProps = {
  readonly className: string;
  readonly style: CSSProperties;
};

function PanelControls({
  panel,
  collapsed,
  maximized,
  onToggle,
  onClose,
  onMaximize,
  onMove,
}: {
  readonly panel: PanelId;
  readonly collapsed: boolean;
  readonly maximized: boolean;
  readonly onToggle: () => void;
  readonly onClose: () => void;
  readonly onMaximize: () => void;
  readonly onMove: (direction: -1 | 1) => void;
}) {
  const label = PANEL_LABELS[panel];
  return (
    <div className="panel-controls" aria-label={`${label} panel controls`}>
      <button type="button" onClick={() => onMove(-1)} aria-label={`Shift ${label} panel left`}>
        <span aria-hidden="true">‹</span>
      </button>
      <button type="button" onClick={() => onMove(1)} aria-label={`Shift ${label} panel right`}>
        <span aria-hidden="true">›</span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
      >
        <span aria-hidden="true">{collapsed ? "+" : "−"}</span>
      </button>
      <button
        type="button"
        onClick={onMaximize}
        aria-label={maximized ? `Restore ${label}` : `Maximize ${label}`}
      >
        <span aria-hidden="true">{maximized ? "▣" : "□"}</span>
      </button>
      <button type="button" onClick={onClose} aria-label={`Close ${label}`}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

const addableBlocks = new Set<AddableBlockType>([
  "motion_move",
  "motion_turn",
  "looks_say",
  "looks_think",
  "looks_show",
  "looks_hide",
  "looks_set_size",
  "looks_switch_costume",
  "looks_switch_backdrop",
  "sound_play",
  "sound_stop",
  "event_broadcast",
  "variables_set",
  "variables_change",
  "variables_show",
  "variables_hide",
  "control_repeat",
  "control_if",
]);

function isAddable(type: string): type is AddableBlockType {
  return addableBlocks.has(type as AddableBlockType);
}

function mergeProjection(model: EditorModel, projection: EditorProjection): EditorModel {
  return { ...model, ...projection };
}

function createProjectMetadata(
  createdAt: string,
  programBlockCount: number,
  locale: Locale,
  creative: ProjectCreativeState,
): ProjectMetadata {
  return {
    createdAt,
    updatedAt: new Date().toISOString(),
    missionProgress: programBlockCount > 0 ? 1 : 0,
    hintLevel: 0,
    locale,
    ...creative,
  };
}

function countProgramBlocks(model: EditorModel): number {
  return model.program.scripts.reduce((total, script) => total + script.statements.length, 0);
}

function worldVariablesForProgram(
  program: ProjectProgram,
): Readonly<Record<string, VariableState>> {
  return Object.fromEntries(
    (program.variables ?? []).map((variable) => [
      variable.id,
      { value: variable.initialValue, visible: variable.visible },
    ]),
  );
}

function stageVariablesForProgram(program: ProjectProgram): readonly StageVariableWatcher[] {
  return (program.variables ?? []).map((variable) => ({
    id: variable.id,
    label: variable.name,
    value: variable.initialValue,
    visible: variable.visible,
  }));
}

function initialWorldFor(model: EditorModel, creative: ProjectCreativeState): WorldState {
  const actor = creative.actors?.[0];
  return createWorldState({
    sprite: {
      x: model.stage.initial.sprite.x,
      y: model.stage.initial.sprite.y,
      heading: model.stage.initial.sprite.heading,
      ...(actor?.visible === undefined ? {} : { visible: actor.visible }),
      ...(actor?.size === undefined ? {} : { size: actor.size }),
      ...(actor?.costumeId === undefined ? {} : { costumeId: actor.costumeId }),
    },
    goal: { x: model.stage.initial.goal.x, y: model.stage.initial.goal.y },
    ...(creative.stage?.backdropId === undefined ? {} : { backdropId: creative.stage.backdropId }),
    variables: worldVariablesForProgram(model.program),
  });
}

function runtimeObservationsFromActorFrames(
  result: ReturnType<typeof runMultiActorProgram>,
): readonly RuntimeObservation[] {
  const observations = result.trace.flatMap((entry): RuntimeObservation[] => [
    {
      kind: "statement-start",
      step: entry.step,
      nodeId: entry.nodeId,
      statementType: entry.statementType,
      world: entry.worldBefore,
    },
    {
      kind: "statement-end",
      step: entry.step,
      nodeId: entry.nodeId,
      statementType: entry.statementType,
      world: entry.worldAfter,
    },
  ]);
  const world = result.actors[0]?.world ?? createWorldState();
  return [
    ...observations,
    {
      kind: "run-complete",
      step: result.stepsUsed,
      nodeId: "$",
      outcome: result.outcome,
      world,
    },
  ];
}

function defaultAssets(locale: Locale): readonly ProjectAsset[] {
  return [
    {
      id: "asset:costume.default",
      kind: "costume",
      name: locale === "es" ? "Nova principal" : "Nova default",
      source: "builtin:costume.default",
      tags: ["starter"],
    },
    {
      id: "asset:costume.spark",
      kind: "costume",
      name: locale === "es" ? "Nova energia" : "Nova spark",
      source: "builtin:costume.spark",
      tags: ["starter", "motion"],
    },
    {
      id: "asset:space.trailhead",
      kind: "backdrop",
      name: locale === "es" ? "Ruta espacial" : "Space trailhead",
      source: "builtin:space.trailhead",
      tags: ["space", "mission"],
    },
    {
      id: "asset:space.nebula",
      kind: "backdrop",
      name: locale === "es" ? "Nebulosa" : "Nebula",
      source: "builtin:space.nebula",
      tags: ["space"],
    },
    {
      id: "asset:sound.beacon",
      kind: "sound",
      name: locale === "es" ? "Pulso de baliza" : "Beacon ping",
      source: "builtin:sound.beacon",
      tags: ["starter", "feedback"],
    },
  ];
}

function defaultActor(locale: Locale): ProjectActor {
  return {
    id: "actor:main",
    name: locale === "es" ? "Nova" : "Nova",
    x: INITIAL_STAGE.initial.sprite.x,
    y: INITIAL_STAGE.initial.sprite.y,
    direction: INITIAL_STAGE.initial.sprite.heading,
    size: 100,
    visible: true,
    costumeId: "asset:costume.default",
    scripts: ["main"],
  };
}

function defaultCreativeState(locale: Locale): ProjectCreativeState {
  const actor = defaultActor(locale);
  return {
    actors: [actor],
    stage: {
      backdropId: "asset:space.trailhead",
      width: INITIAL_STAGE.initial.viewport.width,
      height: INITIAL_STAGE.initial.viewport.height,
      actorOrder: [actor.id],
    },
    assets: defaultAssets(locale),
  };
}

function creativeStateFromMetadata(
  metadata: ProjectMetadata | undefined,
  locale: Locale,
): ProjectCreativeState {
  const fallback = defaultCreativeState(locale);
  const actors = metadata?.actors?.length ? metadata.actors : fallback.actors;
  const stage = metadata?.stage ?? fallback.stage;
  return {
    ...(actors === undefined ? {} : { actors }),
    ...(stage === undefined ? {} : { stage }),
    ...(metadata?.assets !== undefined
      ? { assets: metadata.assets }
      : fallback.assets === undefined
        ? {}
        : { assets: fallback.assets }),
  };
}

function safeActorPatch(
  creative: ProjectCreativeState,
  patch: Partial<ProjectActor>,
): Partial<ProjectActor> | undefined {
  if (
    patch.size !== undefined &&
    (!Number.isFinite(patch.size) || patch.size <= 0 || patch.size > MAX_ACTOR_SIZE)
  ) {
    return undefined;
  }
  if (
    patch.costumeId !== undefined &&
    !creative.assets?.some((asset) => asset.kind === "costume" && asset.id === patch.costumeId)
  ) {
    return undefined;
  }
  return patch;
}

export function updateActor(
  creative: ProjectCreativeState,
  actorId: string,
  patch: Partial<ProjectActor>,
): ProjectCreativeState {
  const safePatch = safeActorPatch(creative, patch);
  if (safePatch === undefined) return creative;
  const actors = (creative.actors?.length ? creative.actors : [defaultActor("en")]).map((actor) =>
    actor.id === actorId ? { ...actor, ...safePatch } : actor,
  );
  if (!actors.some((actor) => actor.id === actorId)) return creative;
  return { ...creative, actors };
}

function addProjectActor(creative: ProjectCreativeState, locale: Locale): ProjectCreativeState {
  const actors = creative.actors?.length ? [...creative.actors] : [defaultActor(locale)];
  const nextNumber = actors.length + 1;
  const actor: ProjectActor = {
    id: `actor:${nextNumber}`,
    name: `Actor ${nextNumber}`,
    x: INITIAL_STAGE.initial.sprite.x + nextNumber * 24,
    y: INITIAL_STAGE.initial.sprite.y,
    direction: 0,
    size: 100,
    visible: true,
    costumeId: "asset:costume.spark",
    scripts: ["main"],
  };
  const actorOrder = [...(creative.stage?.actorOrder ?? actors.map((item) => item.id)), actor.id];
  return { ...creative, actors: [...actors, actor], stage: { ...creative.stage, actorOrder } };
}

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function initialProjectFor(
  persistence: ProjectPersistence | undefined,
): LoadedEditorProject & { readonly model: EditorModel } {
  const loaded = loadEditorProject(persistence);
  return { ...loaded, model: loaded.model ?? createEditorModel() };
}

function numericFieldFor(block: BlockNode): "steps" | "degrees" | "count" | "size" | undefined {
  switch (block.type) {
    case "motion_move":
      return "steps";
    case "motion_turn":
      return "degrees";
    case "control_repeat":
      return "count";
    case "looks_set_size":
      return "size";
    default:
      return undefined;
  }
}

function variableNumberInputFor(block: BlockNode): "value" | "delta" | undefined {
  switch (block.type) {
    case "variables_set":
      return "value";
    case "variables_change":
      return "delta";
    default:
      return undefined;
  }
}

function variableNumberValue(block: BlockNode, input: "value" | "delta"): number {
  const value = block.inputs?.[input]?.fields?.value;
  return typeof value === "number" ? value : 0;
}

function displayNameForType(type: string, locale: Locale): string {
  switch (type) {
    case "motion_move":
      return t(locale, "move");
    case "motion_turn":
      return t(locale, "turn");
    case "looks_say":
      return locale === "es" ? "Decir" : "Say";
    case "looks_think":
      return locale === "es" ? "Pensar" : "Think";
    case "looks_show":
      return locale === "es" ? "Mostrar" : "Show";
    case "looks_hide":
      return locale === "es" ? "Ocultar" : "Hide";
    case "looks_set_size":
      return locale === "es" ? "Tamaño" : "Size";
    case "looks_switch_costume":
      return locale === "es" ? "Disfraz" : "Costume";
    case "looks_switch_backdrop":
      return locale === "es" ? "Fondo" : "Backdrop";
    case "sound_play":
      return locale === "es" ? "Sonido" : "Sound";
    case "sound_stop":
      return locale === "es" ? "Detener sonidos" : "Stop sounds";
    case "event_broadcast":
      return locale === "es" ? "Enviar" : "Broadcast";
    case "variables_set":
      return locale === "es" ? "Fijar variable" : "Set variable";
    case "variables_change":
      return locale === "es" ? "Cambiar variable" : "Change variable";
    case "variables_show":
      return locale === "es" ? "Mostrar variable" : "Show variable";
    case "variables_hide":
      return locale === "es" ? "Ocultar variable" : "Hide variable";
    case "control_repeat":
      return t(locale, "repeat");
    case "control_if":
      return t(locale, "toolboxIfGoal");
    default:
      return type;
  }
}

function displayNameFor(block: BlockNode, locale: Locale): string {
  return displayNameForType(block.type, locale);
}

function scriptLabelFor(script: BlockWorkspaceSnapshot["scripts"][number], locale: Locale): string {
  switch (script.trigger.type) {
    case "event_on_start":
      return t(locale, "whenRun");
    case "event_on_key_pressed": {
      const key = typeof script.trigger.fields?.key === "string" ? script.trigger.fields.key : "";
      return locale === "es" ? `Al presionar ${key}` : `When ${key} pressed`;
    }
    case "event_on_actor_clicked":
      return locale === "es" ? "Al hacer click" : "When actor clicked";
    case "event_on_message": {
      const message =
        typeof script.trigger.fields?.message === "string" ? script.trigger.fields.message : "";
      return locale === "es" ? `Al recibir ${message}` : `When ${message} received`;
    }
    default:
      return script.trigger.type;
  }
}

function editableTriggerFieldFor(
  script: BlockWorkspaceSnapshot["scripts"][number] | undefined,
): "key" | "message" | undefined {
  switch (script?.trigger.type) {
    case "event_on_key_pressed":
      return "key";
    case "event_on_message":
      return "message";
    default:
      return undefined;
  }
}

const KEY_TRIGGER_OPTIONS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "a", "d"];

function fieldLabelFor(
  field: "steps" | "degrees" | "count" | "size" | "value" | "delta",
  locale: Locale,
): string {
  switch (field) {
    case "steps":
      return t(locale, "steps");
    case "degrees":
      return t(locale, "degrees");
    case "count":
      return t(locale, "fieldCount");
    case "size":
      return t(locale, "actorSize");
    case "value":
      return locale === "es" ? "valor" : "value";
    case "delta":
      return locale === "es" ? "cambio" : "change";
  }
}

function textFieldFor(block: BlockNode): "text" | "message" | undefined {
  switch (block.type) {
    case "looks_say":
    case "looks_think":
      return "text";
    case "event_broadcast":
      return "message";
    default:
      return undefined;
  }
}

function assetFieldFor(block: BlockNode): "costumeId" | "backdropId" | "soundId" | undefined {
  switch (block.type) {
    case "looks_switch_costume":
      return "costumeId";
    case "looks_switch_backdrop":
      return "backdropId";
    case "sound_play":
      return "soundId";
    default:
      return undefined;
  }
}

function editableFieldLabelFor(
  field:
    | "steps"
    | "degrees"
    | "count"
    | "size"
    | "value"
    | "delta"
    | "text"
    | "message"
    | "costumeId"
    | "backdropId"
    | "soundId",
  locale: Locale,
): string {
  switch (field) {
    case "text":
      return t(locale, "blockText");
    case "message":
      return locale === "es" ? "mensaje" : "message";
    case "costumeId":
      return t(locale, "actorCostume");
    case "backdropId":
      return t(locale, "stageBackdrop");
    case "soundId":
      return locale === "es" ? "sonido" : "sound";
    case "value":
    case "delta":
      return fieldLabelFor(field, locale);
    default:
      return fieldLabelFor(field, locale);
  }
}

function stringBlockValue(
  block: BlockNode,
  field: "text" | "message" | "costumeId" | "backdropId" | "soundId",
): string {
  const value = block.fields?.[field];
  return typeof value === "string" ? value : "";
}

type PaletteBlock = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly glyph: string;
  readonly type?: AddableBlockType;
  readonly enabled: boolean;
};

type PaletteCategory = {
  readonly id: string;
  readonly label: string;
  readonly tone: string;
  readonly blocks: readonly PaletteBlock[];
};

function scratchPaletteFor(locale: Locale): readonly PaletteCategory[] {
  const es = locale === "es";
  return [
    {
      id: "motion",
      label: es ? "Movimiento" : "Motion",
      tone: "motion",
      blocks: [
        {
          id: "motion_move",
          label: es ? "Mover" : "Move",
          detail: es ? "Avanza pasos" : "Move steps",
          glyph: "GO",
          type: "motion_move",
          enabled: true,
        },
        {
          id: "motion_turn",
          label: es ? "Girar" : "Turn",
          detail: es ? "Cambia direccion" : "Change direction",
          glyph: "90",
          type: "motion_turn",
          enabled: true,
        },
        {
          id: "motion_goto",
          label: es ? "Ir a x/y" : "Go to x/y",
          detail: es ? "Posiciona" : "Set position",
          glyph: "xy",
          enabled: false,
        },
        {
          id: "motion_glide",
          label: es ? "Deslizar" : "Glide",
          detail: es ? "Anima movimiento" : "Animate motion",
          glyph: "~",
          enabled: false,
        },
        {
          id: "motion_point",
          label: es ? "Apuntar" : "Point",
          detail: es ? "Orienta sprite" : "Aim sprite",
          glyph: "↗",
          enabled: false,
        },
      ],
    },
    {
      id: "looks",
      label: es ? "Apariencia" : "Looks",
      tone: "looks",
      blocks: [
        {
          id: "looks_say",
          label: es ? "Decir" : "Say",
          detail: es ? "Burbuja de texto" : "Speech bubble",
          glyph: '"',
          type: "looks_say",
          enabled: true,
        },
        {
          id: "looks_think",
          label: es ? "Pensar" : "Think",
          detail: es ? "Idea visible" : "Thought bubble",
          glyph: "…",
          type: "looks_think",
          enabled: true,
        },
        {
          id: "looks_show",
          label: es ? "Mostrar" : "Show",
          detail: es ? "Aparece" : "Become visible",
          glyph: "👁",
          type: "looks_show",
          enabled: true,
        },
        {
          id: "looks_hide",
          label: es ? "Ocultar" : "Hide",
          detail: es ? "Desaparece" : "Become hidden",
          glyph: "—",
          type: "looks_hide",
          enabled: true,
        },
        {
          id: "looks_set_size",
          label: es ? "Tamaño" : "Size",
          detail: es ? "Cambia tamaño" : "Set size",
          glyph: "%",
          type: "looks_set_size",
          enabled: true,
        },
        {
          id: "looks_costume",
          label: es ? "Disfraz" : "Costume",
          detail: es ? "Cambia look" : "Change look",
          glyph: "◐",
          type: "looks_switch_costume",
          enabled: true,
        },
        {
          id: "looks_backdrop",
          label: es ? "Fondo" : "Backdrop",
          detail: es ? "Cambia escena" : "Change scene",
          glyph: "▧",
          type: "looks_switch_backdrop",
          enabled: true,
        },
      ],
    },
    {
      id: "sound",
      label: es ? "Sonido" : "Sound",
      tone: "sound",
      blocks: [
        {
          id: "sound_start",
          label: es ? "Iniciar sonido" : "Start sound",
          detail: es ? "No espera" : "Do not wait",
          glyph: "♪",
          type: "sound_play",
          enabled: true,
        },
        {
          id: "sound_play",
          label: es ? "Tocar hasta fin" : "Play until done",
          detail: es ? "Espera final" : "Wait to finish",
          glyph: "▶",
          enabled: false,
        },
        {
          id: "sound_stop",
          label: es ? "Detener sonidos" : "Stop sounds",
          detail: es ? "Silencio" : "Silence",
          glyph: "■",
          type: "sound_stop",
          enabled: true,
        },
        {
          id: "sound_volume",
          label: es ? "Volumen" : "Volume",
          detail: es ? "Sube o baja" : "Louder or softer",
          glyph: "%",
          enabled: false,
        },
      ],
    },
    {
      id: "events",
      label: es ? "Eventos" : "Events",
      tone: "events",
      blocks: [
        {
          id: "event_flag",
          label: es ? "Bandera verde" : "Green flag",
          detail: es ? "Empieza script" : "Start script",
          glyph: "⚑",
          enabled: false,
        },
        {
          id: "event_key",
          label: es ? "Tecla presionada" : "Key pressed",
          detail: es ? "Entrada" : "Input",
          glyph: "⌨",
          enabled: false,
        },
        {
          id: "event_click",
          label: es ? "Al hacer click" : "When clicked",
          detail: es ? "Sprite click" : "Sprite click",
          glyph: "↙",
          enabled: false,
        },
        {
          id: "event_broadcast",
          label: es ? "Enviar mensaje" : "Broadcast",
          detail: es ? "Comunica" : "Send message",
          glyph: "MSG",
          type: "event_broadcast",
          enabled: true,
        },
      ],
    },
    {
      id: "control",
      label: es ? "Control" : "Control",
      tone: "control",
      blocks: [
        {
          id: "control_repeat",
          label: es ? "Repetir" : "Repeat",
          detail: es ? "Patron" : "Loop pattern",
          glyph: "xN",
          type: "control_repeat",
          enabled: true,
        },
        {
          id: "control_if",
          label: es ? "Si toca la meta" : "If touching goal",
          detail: es ? "Decision" : "Decision",
          glyph: "IF",
          type: "control_if",
          enabled: true,
        },
        {
          id: "control_wait",
          label: es ? "Esperar" : "Wait",
          detail: es ? "Pausa" : "Pause",
          glyph: "⏱",
          enabled: false,
        },
        {
          id: "control_forever",
          label: es ? "Por siempre" : "Forever",
          detail: es ? "Loop infinito" : "Endless loop",
          glyph: "∞",
          enabled: false,
        },
        {
          id: "control_stop",
          label: es ? "Bloque detener" : "Stop script block",
          detail: es ? "Corta script" : "Stop script",
          glyph: "×",
          enabled: false,
        },
      ],
    },
    {
      id: "sensing",
      label: es ? "Sensores" : "Sensing",
      tone: "sensing",
      blocks: [
        {
          id: "sensing_touching",
          label: es ? "Tocando?" : "Touching?",
          detail: es ? "Detecta choque" : "Detect collision",
          glyph: "?",
          enabled: false,
        },
        {
          id: "sensing_key",
          label: es ? "Tecla?" : "Key?",
          detail: es ? "Entrada teclado" : "Keyboard input",
          glyph: "⌨",
          enabled: false,
        },
        {
          id: "sensing_mouse",
          label: es ? "Mouse x/y" : "Mouse x/y",
          detail: es ? "Posicion" : "Pointer position",
          glyph: "xy",
          enabled: false,
        },
        {
          id: "sensing_ask",
          label: es ? "Preguntar" : "Ask",
          detail: es ? "Pregunta al usuario" : "Ask learner",
          glyph: "?",
          enabled: false,
        },
      ],
    },
    {
      id: "operators",
      label: es ? "Operadores" : "Operators",
      tone: "operators",
      blocks: [
        {
          id: "op_add",
          label: "+ - × ÷",
          detail: es ? "Matematica" : "Math",
          glyph: "+",
          type: "variables_change",
          enabled: true,
        },
        {
          id: "op_random",
          label: es ? "Azar" : "Random",
          detail: es ? "Numero al azar" : "Random number",
          glyph: "#",
          enabled: false,
        },
        {
          id: "op_compare",
          label: "= < >",
          detail: es ? "Compara" : "Compare",
          glyph: "=",
          type: "control_if",
          enabled: true,
        },
        {
          id: "op_logic",
          label: es ? "y / o / no" : "and / or / not",
          detail: es ? "Logica" : "Logic",
          glyph: "&&",
          enabled: false,
        },
        {
          id: "op_join",
          label: es ? "Unir texto" : "Join text",
          detail: es ? "Combina" : "Combine",
          glyph: "ab",
          enabled: false,
        },
      ],
    },
    {
      id: "variables",
      label: es ? "Variables" : "Variables",
      tone: "variables",
      blocks: [
        {
          id: "var_make",
          label: es ? "Crear variable" : "Make variable",
          detail: es ? "Guarda datos" : "Store data",
          glyph: "v",
          enabled: false,
        },
        {
          id: "var_set",
          label: es ? "Fijar variable" : "Set variable",
          detail: es ? "Asigna valor" : "Assign value",
          glyph: "=",
          type: "variables_set",
          enabled: true,
        },
        {
          id: "var_change",
          label: es ? "Cambiar variable" : "Change variable",
          detail: es ? "Suma/resta" : "Add or subtract",
          glyph: "+=",
          type: "variables_change",
          enabled: true,
        },
        {
          id: "var_show",
          label: es ? "Mostrar variable" : "Show variable",
          detail: es ? "Ver dato" : "See data",
          glyph: "V",
          type: "variables_show",
          enabled: true,
        },
        {
          id: "var_hide",
          label: es ? "Ocultar variable" : "Hide variable",
          detail: es ? "Quita el visor" : "Hide watcher",
          glyph: "V",
          type: "variables_hide",
          enabled: true,
        },
      ],
    },
    {
      id: "my-blocks",
      label: es ? "Mis bloques" : "My Blocks",
      tone: "myblocks",
      blocks: [
        {
          id: "my_make",
          label: es ? "Crear bloque" : "Make a block",
          detail: es ? "Abstrae idea" : "Name an idea",
          glyph: "fn",
          enabled: false,
        },
        {
          id: "my_define",
          label: es ? "Definir bloque" : "Define block",
          detail: es ? "Receta propia" : "Custom recipe",
          glyph: "{}",
          enabled: false,
        },
      ],
    },
  ];
}

function blockValue(block: BlockNode, field: "steps" | "degrees" | "count" | "size"): number {
  const value = block.fields?.[field];
  return typeof value === "number" ? value : 0;
}

function resultFeedback(
  result: RunResult,
  locale: Locale,
  mission: ReturnType<typeof getLocalizedFirstMission>,
) {
  return createMissionRunFeedback({ mission, result, locale });
}

function CodeText({
  code,
  mapping,
  highlightedNodeId,
}: {
  code: string;
  mapping: Readonly<Record<string, { readonly start: number; readonly end: number }>>;
  highlightedNodeId: string | undefined;
}) {
  const range = highlightedNodeId === undefined ? undefined : mapping[highlightedNodeId];
  if (range === undefined) return <pre className="code-surface">{code}</pre>;
  return (
    <pre className="code-surface">
      {code.slice(0, range.start)}
      <mark>{code.slice(range.start, range.end)}</mark>
      {code.slice(range.end)}
    </pre>
  );
}

function CodePanel({
  program,
  highlightedNodeId,
}: {
  program: ProjectProgram;
  highlightedNodeId: string | undefined;
}) {
  const [projectionId, setProjectionId] = useState<CodeProjectionId>("typescript");
  const [comparisonId, setComparisonId] = useState<CodeProjectionId | undefined>();
  const primary = projectCodeSurface(program, projectionId);
  const comparison =
    comparisonId === undefined ? undefined : projectCodeSurface(program, comparisonId);

  return (
    <div className="code-panel-content">
      <div className="code-projection-controls">
        <label>
          <span>Code projection</span>
          <select
            aria-label="Code projection"
            value={projectionId}
            onChange={(event) => setProjectionId(event.currentTarget.value as CodeProjectionId)}
          >
            {CODE_PROJECTION_IDS.map((id) => (
              <option key={id} value={id}>
                {projectCodeSurface(program, id).label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Compare with</span>
          <select
            aria-label="Compare code projection"
            value={comparisonId ?? ""}
            onChange={(event) =>
              setComparisonId(
                event.currentTarget.value === ""
                  ? undefined
                  : (event.currentTarget.value as CodeProjectionId),
              )
            }
          >
            <option value="">None</option>
            {CODE_PROJECTION_IDS.filter((id) => id !== projectionId).map((id) => (
              <option key={id} value={id}>
                {projectCodeSurface(program, id).label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={comparison === undefined ? "code-projections" : "code-projections comparing"}>
        <div data-code-projection={primary.id}>
          <strong>{primary.label}</strong>
          <CodeText
            code={primary.code}
            mapping={primary.mapping}
            highlightedNodeId={highlightedNodeId}
          />
        </div>
        {comparison === undefined ? null : (
          <div data-code-projection={comparison.id}>
            <strong>{comparison.label}</strong>
            <CodeText
              code={comparison.code}
              mapping={comparison.mapping}
              highlightedNodeId={highlightedNodeId}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Presentation only: glyphs per world palette. Colors live in App.css under [data-world].
const WORLD_GLYPHS: Record<WorldPalette, { sprite: string; goal: string }> = {
  space: { sprite: "🚀", goal: "🌎" },
  ocean: { sprite: "🐙", goal: "🪸" },
  robots: { sprite: "🤖", goal: "🔋" },
  city: { sprite: "🛴", goal: "📦" },
};

/**
 * Optional Laya bridge installed by the host page (`globalThis.agorixLaya`).
 * Without it System-0 alone decides, so the app never depends on Laya.
 */
function layaBridge(): LayaBatchTransport | undefined {
  return (globalThis as { agorixLaya?: LayaBatchTransport }).agorixLaya;
}

/** System-0 decides synchronously; if a Laya bridge exists it may veto an offer. */
function useProactiveDecision(signal: ProactiveSignal | undefined): ProactiveDecision | undefined {
  const bridge = layaBridge();
  const base = signal === undefined ? undefined : decideProactiveSuggestion(signal);
  const key = JSON.stringify(signal ?? null);
  const [resolved, setResolved] = useState<
    { readonly key: string; readonly decision: ProactiveDecision } | undefined
  >();
  useEffect(() => {
    if (signal === undefined || bridge === undefined || base?.action !== "offer") {
      return undefined;
    }
    let cancelled = false;
    void decideProactiveWithLaya(signal, bridge).then((decision) => {
      if (!cancelled) setResolved({ key, decision });
    });
    return () => {
      cancelled = true;
    };
  }, [key, bridge]);
  if (base === undefined || bridge === undefined || base.action === "silence") return base;
  return resolved?.key === key ? resolved.decision : undefined;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(REDUCED_MOTION_QUERY).matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

type AudioContextConstructor = new () => AudioContext;
type WebAudioGlobal = typeof globalThis & {
  readonly AudioContext?: AudioContextConstructor;
  readonly webkitAudioContext?: AudioContextConstructor;
};

let stageAudioContext: AudioContext | undefined;

function frequencyForSoundId(soundId: string): number {
  let hash = 0;
  for (const character of soundId) {
    hash = (hash * 31 + character.charCodeAt(0)) % 997;
  }
  return 440 + (hash % 5) * 55;
}

function playStageSoundCue(soundId: string) {
  if (typeof window === "undefined") return;
  const audioGlobal = window as unknown as WebAudioGlobal;
  const AudioContextCtor = audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
  if (AudioContextCtor === undefined) return;
  try {
    stageAudioContext ??= new AudioContextCtor();
    const context = stageAudioContext;
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequencyForSoundId(soundId), now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch {
    // Visual runtime evidence remains authoritative when browser audio is unavailable.
  }
}

function stagePhaseText(locale: Locale, feedback: StageFeedback): string {
  switch (feedback.phase) {
    case "running":
      return t(locale, "stagePhaseRunning");
    case "stepping":
      return t(locale, "stagePhaseStepping", {
        n: feedback.position ?? 0,
        total: feedback.total,
      });
    case "stopped":
      return t(locale, "stagePhaseStopped");
    case "error":
      return t(locale, "stagePhaseError");
    default:
      return t(locale, "stagePhaseIdle");
  }
}

interface StageActorView {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly size: number;
  readonly visible: boolean;
  readonly costumeId?: string;
  readonly bubble?: {
    readonly kind: "say" | "think";
    readonly text: string;
  };
}

function stageActorsFromCreative(creative: ProjectCreativeState): readonly StageActorView[] {
  const actors = creative.actors?.length ? creative.actors : [defaultActor("en")];
  const order = creative.stage?.actorOrder ?? actors.map((actor) => actor.id);
  const byId = new Map(actors.map((actor) => [actor.id, actor]));
  return order.flatMap((id) => {
    const actor = byId.get(id);
    if (actor === undefined) return [];
    return [
      {
        id: actor.id,
        name: actor.name,
        x: actor.x,
        y: actor.y,
        heading: actor.direction,
        size: actor.size,
        visible: actor.visible,
        ...(actor.costumeId === undefined ? {} : { costumeId: actor.costumeId }),
      },
    ];
  });
}

function stageActorsFromRuntime(
  actors: readonly MultiActorRuntimeActor[] | undefined,
): readonly StageActorView[] | undefined {
  return actors?.map((actor) => ({
    id: actor.id,
    name: actor.name,
    x: actor.world.sprite.x,
    y: actor.world.sprite.y,
    heading: actor.world.sprite.heading,
    size: actor.world.sprite.size,
    visible: actor.world.sprite.visible,
    ...(actor.world.sprite.costumeId === undefined
      ? {}
      : { costumeId: actor.world.sprite.costumeId }),
    ...(actor.world.sprite.bubble === undefined ? {} : { bubble: actor.world.sprite.bubble }),
  }));
}

function ActorPanel({
  locale,
  actors = [],
  assets = [],
  stage,
  selectedActorId = "actor:main",
  onSelect,
  onAdd,
  onChange,
  onStageChange,
}: {
  locale: Locale;
  actors: readonly ProjectActor[];
  assets: readonly ProjectAsset[] | undefined;
  stage?: ProjectCreativeState["stage"];
  selectedActorId: string;
  onSelect: (actorId: string) => void;
  onAdd: () => void;
  onChange: (actorId: string, patch: Partial<ProjectActor>) => void;
  onStageChange: (patch: Partial<NonNullable<ProjectCreativeState["stage"]>>) => void;
}) {
  const selected = actors.find((actor) => actor.id === selectedActorId) ?? actors[0];
  const costumeAssets = assets.filter((asset) => asset.kind === "costume");
  const backdropAssets = assets.filter((asset) => asset.kind === "backdrop");
  if (selected === undefined) return null;
  return (
    <section className="actor-panel" aria-label={t(locale, "actors")}>
      <div className="actor-tabs" role="list" aria-label={t(locale, "actors")}>
        {actors.map((actor) => (
          <button
            key={actor.id}
            type="button"
            className={actor.id === selected.id ? "active" : ""}
            aria-pressed={actor.id === selected.id}
            onClick={() => onSelect(actor.id)}
          >
            {actor.name}
          </button>
        ))}
        <button type="button" onClick={onAdd}>
          {t(locale, "addActor")}
        </button>
      </div>
      <div className="actor-inspector">
        <label>
          <span>{t(locale, "actorName")}</span>
          <input
            value={selected.name}
            onChange={(event) => onChange(selected.id, { name: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>x</span>
          <input
            type="number"
            value={selected.x}
            onChange={(event) => onChange(selected.id, { x: Number(event.currentTarget.value) })}
          />
        </label>
        <label>
          <span>y</span>
          <input
            type="number"
            value={selected.y}
            onChange={(event) => onChange(selected.id, { y: Number(event.currentTarget.value) })}
          />
        </label>
        <label>
          <span>{t(locale, "actorDirection")}</span>
          <input
            type="number"
            value={selected.direction}
            onChange={(event) =>
              onChange(selected.id, { direction: Number(event.currentTarget.value) })
            }
          />
        </label>
        <label>
          <span>{t(locale, "actorSize")}</span>
          <input
            type="number"
            min="1"
            max={MAX_ACTOR_SIZE}
            value={selected.size}
            onChange={(event) => onChange(selected.id, { size: Number(event.currentTarget.value) })}
          />
        </label>
        <label className="actor-visible">
          <input
            type="checkbox"
            checked={selected.visible}
            onChange={(event) => onChange(selected.id, { visible: event.currentTarget.checked })}
          />
          <span>{t(locale, "actorVisible")}</span>
        </label>
        <label>
          <span>{t(locale, "actorCostume")}</span>
          <select
            value={selected.costumeId ?? ""}
            onChange={(event) => {
              const costumeId = event.currentTarget.value;
              onChange(selected.id, costumeId === "" ? {} : { costumeId });
            }}
          >
            {costumeAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t(locale, "stageBackdrop")}</span>
          <select
            value={stage?.backdropId ?? ""}
            onChange={(event) => {
              const backdropId = event.currentTarget.value;
              onStageChange(backdropId === "" ? {} : { backdropId });
            }}
          >
            {backdropAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

export function StageView({
  frame,
  fallback,
  locale,
  world,
  actors,
  assets,
  selectedActorId,
  feedback,
  activeCode,
  codePreview,
  reducedMotion,
  runStatus,
  onRun,
  onStop,
  onActorClick,
  onOpenCode,
  panelControls,
  panelProps,
  actors,
  onActorChange,
}: {
  actors?: ProjectActors;
  onActorChange?: (patch: ActorPatch) => void;
  world: WorldDefinition;
  frame: ObservationFrame | undefined;
  fallback: StageState;
  locale: Locale;
  actors?: readonly StageActorView[];
  assets?: readonly ProjectAsset[];
  selectedActorId?: string;
  feedback: StageFeedback;
  activeCode?: string;
  codePreview: string;
  reducedMotion: boolean;
  runStatus: RunStatus;
  onRun: () => void;
  onStop: () => void;
  onActorClick?: (actorId: string) => void;
  onOpenCode: () => void;
  panelControls?: ReactNode;
  panelProps?: PanelChromeProps;
}) {
  const state = frame?.state ?? fallback;
  const actor = actors === undefined ? undefined : activeActor(actors);
  const sprite = {
    ...state.sprite,
    radius: BASE_SPRITE_RADIUS * ((actor?.size ?? 100) / 100),
  };
  const goal = state.goal;
  const viewport = state.viewport;
  const copy = worldCopy(world, locale);
  const glyphs = WORLD_GLYPHS[world.visualStyle.palette];
  const motion = resolveStageMotion(reducedMotion);
  const settled = feedback.phase === "success" || feedback.phase === "retry";
  const trailPoints = feedback.trail.map((point) => `${point.x},${point.y}`).join(" ");
  const backstageCode = activeCode !== undefined && activeCode !== "" ? activeCode : codePreview;
  const visibleWatchers = (state.variables ?? []).filter((variable) => variable.visible);
  const assetNames = new Map((assets ?? []).map((asset) => [asset.id, asset.name]));
  const activeSoundIds = state.sounds?.activeSoundIds ?? [];
  const safeActors = actors ?? [];
  const safeSelectedActorId = selectedActorId ?? "actor:main";
  const visibleActors = safeActors.length > 0 ? safeActors.filter((actor) => actor.visible) : [];
  const renderedActors =
    visibleActors.length > 0
      ? visibleActors
      : [
          {
            id: "actor:main",
            name: copy.spriteName,
            x: sprite.x,
            y: sprite.y,
            heading: sprite.heading,
            size: sprite.size,
            visible: sprite.visible,
            ...(sprite.costumeId === undefined ? {} : { costumeId: sprite.costumeId }),
            ...(sprite.bubble === undefined ? {} : { bubble: sprite.bubble }),
          },
        ];
  return (
    <section
      className={panelProps?.className ?? "stage-panel"}
      style={panelProps?.style}
      aria-labelledby="stage-title"
      data-world={world.id}
      data-stage-phase={feedback.phase}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-backdrop-id={state.backdropId ?? "default"}
    >
      <div className="panel-heading">
        <h2 id="stage-title">{t(locale, "stage")}</h2>
        <span className="status-pill">
          {feedback.reachedGoal ? t(locale, "evidenceGoalReached") : t(locale, "evidenceReachGoal")}
        </span>
        <div className="stage-run-controls" aria-label="Stage execution controls">
          <button
            type="button"
            className="stage-run-button"
            onClick={onRun}
            disabled={runStatus === "running"}
          >
            {t(locale, "run")}
          </button>
          <button
            type="button"
            className="stage-stop-button"
            onClick={onStop}
            disabled={runStatus !== "running"}
          >
            {t(locale, "stop")}
          </button>
        </div>
        {panelControls}
      </div>
      {controls}
      {(feedback.phase === "running" || feedback.phase === "stepping") &&
      feedback.total > 1 &&
      feedback.position !== undefined ? (
        <div className="stage-progress" data-testid="stage-progress">
          <progress
            max={feedback.total}
            value={feedback.position}
            aria-label={t(locale, "stageProgressLabel")}
          />
          <span>
            {t(locale, "stageProgressText", { n: feedback.position, total: feedback.total })}
          </span>
        </div>
      ) : null}
      <div className="world-identity" data-testid="world-identity">
        <span className="world-badge">
          <span aria-hidden="true">{glyphs.sprite}</span> {t(locale, "stageWorldBadge")}
        </span>
        <strong>{copy.title}</strong>
        <span className="world-route">
          {t(locale, "stageRoute", { sprite: copy.spriteName, goal: copy.goalName })}
        </span>
      </div>
      {visibleWatchers.length === 0 ? null : (
        <aside className="stage-watchers" aria-label="Variable watchers" aria-live="polite">
          {visibleWatchers.map((variable) => (
            <div key={variable.id} className="stage-watcher" data-variable-id={variable.id}>
              <span>{variable.label}</span>
              <strong>{variable.value}</strong>
            </div>
          ))}
        </aside>
      )}
      {activeSoundIds.length === 0 ? null : (
        <aside className="stage-sounds" aria-label={t(locale, "activeSounds")} aria-live="polite">
          <span>{t(locale, "activeSounds")}</span>
          {activeSoundIds.map((soundId) => (
            <strong key={soundId}>{assetNames.get(soundId) ?? soundId}</strong>
          ))}
        </aside>
      )}
      <svg
        className="stage-canvas"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        role="img"
        aria-label={t(locale, "stageAria")}
      >
        <rect width={viewport.width} height={viewport.height} rx="14" />
        <line x1="24" y1="128" x2="240" y2="128" />
        {feedback.trail.length > 1 ? (
          <polyline className="world-trail" points={trailPoints} data-testid="world-trail">
            <title>{t(locale, "stageTrailAria")}</title>
          </polyline>
        ) : null}
        <circle
          className={feedback.reachedGoal ? "goal goal-reached" : "goal"}
          cx={goal.x}
          cy={goal.y}
          r={goal.radius}
          data-pulse={feedback.reachedGoal && motion.pulseGoal ? "true" : "false"}
        >
          <title>{copy.goalAlt}</title>
        </circle>
        {feedback.reachedGoal ? (
          <circle
            className="goal-ring"
            cx={goal.x}
            cy={goal.y}
            r={goal.radius + 6}
            aria-hidden="true"
          />
        ) : null}
        <text
          className="world-glyph"
          x={goal.x}
          y={goal.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={goal.radius * 1.6}
          aria-hidden="true"
        >
          {glyphs.goal}
        </text>
        {renderedActors.map((actor) => {
          const radius = Math.max(8, sprite.radius * (actor.size / 100));
          return (
            <g
              key={actor.id}
              role="button"
              tabIndex={0}
              className={
                actor.id === safeSelectedActorId ? "sprite-group selected-actor" : "sprite-group"
              }
              data-testid="stage-sprite"
              data-actor-id={actor.id}
              data-x={actor.x}
              data-y={actor.y}
              data-heading={actor.heading}
              data-costume-id={actor.costumeId ?? "default"}
              onClick={() => onActorClick?.(actor.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onActorClick?.(actor.id);
                }
              }}
              style={{
                transform: `translate(${actor.x}px, ${actor.y}px)`,
                transition:
                  motion.glideMs === 0 ? "none" : `transform ${motion.glideMs}ms ease-out`,
              }}
            >
              <g transform={`rotate(${actor.heading})`}>
                <circle className="sprite" r={radius}>
                  <title>{actor.name}</title>
                </circle>
                <path d="M 4 0 L 16 -6 L 16 6 Z" />
              </g>
              <text
                className="world-glyph"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={radius * 1.5}
                aria-hidden="true"
              >
                {glyphs.sprite}
              </text>
              {actor.bubble === undefined ? null : (
                <g className={`stage-bubble stage-bubble-${actor.bubble.kind}`}>
                  <rect x={radius + 8} y={-radius - 30} width="104" height="26" rx="9" />
                  <text x={radius + 60} y={-radius - 17} textAnchor="middle">
                    {actor.bubble.text}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <div
        className={`world-feedback world-feedback-${feedback.phase}`}
        data-testid="stage-feedback"
        data-feedback-phase={feedback.phase}
      >
        {settled ? (
          <>
            <strong className="world-feedback-mark">
              <span aria-hidden="true">{feedback.phase === "success" ? "★" : "↻"}</span>{" "}
              {t(locale, feedback.phase === "success" ? "stageSuccessMark" : "stageRetryMark")}
            </strong>
            <span>
              {feedback.phase === "success" ? copy.reachedFeedback : copy.stoppedShortFeedback}
            </span>
            <small className="world-fact-tag" data-fact-source="runtime">
              <span aria-hidden="true">▶</span> {t(locale, "stageObservedByRuntime")}
            </small>
          </>
        ) : (
          <span>{stagePhaseText(locale, feedback)}</span>
        )}
        {feedback.activeNodeId !== undefined && activeCode ? (
          <code className="world-active-block" data-testid="stage-active-block">
            {t(locale, "stageActiveBlock", { code: activeCode })}
          </code>
        ) : null}
      </div>
      <aside className="stage-backstage-code" aria-label={t(locale, "backstageCode")}>
        <div>
          <strong>{t(locale, "backstageCode")}</strong>
          <pre className="code-surface backstage-code-surface">
            <code>{backstageCode}</code>
          </pre>
        </div>
        <button type="button" onClick={onOpenCode}>
          {t(locale, "openFullCode")}
        </button>
      </aside>
    </section>
  );
}

function ActorInspector({
  actors,
  locale,
  onChange,
}: {
  actors: ProjectActors;
  locale: Locale;
  onChange: (patch: ActorPatch) => void;
}) {
  const actor = activeActor(actors);
  // Like Scratch's sprite pane: open next to the stage on wide screens, folded on narrow ones so
  // the Code panel stays in the first viewport.
  const [open, setOpen] = useState(
    () =>
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(min-width: 1024px)").matches,
  );
  const number = (
    key: "x" | "y" | "direction" | "size",
    label: string,
    attrs: { min?: number; max?: number } = {},
  ) => (
    <label className="actor-field">
      <span>{label}</span>
      <input
        type="number"
        data-testid={`actor-${key}`}
        value={actor[key]}
        {...attrs}
        onChange={(event) => {
          const value = event.currentTarget.valueAsNumber;
          if (Number.isFinite(value)) onChange({ [key]: value });
        }}
      />
    </label>
  );
  return (
    <details
      className="actor-inspector"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        {t(locale, "actorsTitle")}: {actor.name}
      </summary>
      <ul className="actor-list" aria-label={t(locale, "actorListLabel")}>
        {actors.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="actor-chip"
              aria-pressed={item.id === actors.activeId}
              data-testid="actor-chip"
            >
              <span aria-hidden="true">{item.visible ? "●" : "○"}</span> {item.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="actor-fields">
        <label className="actor-field actor-field-name">
          <span>{t(locale, "actorName")}</span>
          <input
            type="text"
            data-testid="actor-name"
            value={actor.name}
            maxLength={ACTOR_NAME_MAX_LENGTH}
            onChange={(event) => onChange({ name: event.currentTarget.value })}
          />
        </label>
        {number("x", t(locale, "actorX"))}
        {number("y", t(locale, "actorY"))}
        {number("direction", t(locale, "actorDirection"))}
        {number("size", t(locale, "actorSize"), { min: ACTOR_SIZE_MIN, max: ACTOR_SIZE_MAX })}
        <label className="actor-field actor-field-visible">
          <input
            type="checkbox"
            data-testid="actor-visible"
            checked={actor.visible}
            onChange={(event) => onChange({ visible: event.currentTarget.checked })}
          />
          <span>{t(locale, "actorShow")}</span>
        </label>
      </div>
    </details>
  );
}

function TracePanel({
  trace,
  activeTrace,
  locale,
  panelControls,
  panelProps,
}: {
  trace: readonly LearnerTraceItem[];
  activeTrace: LearnerTraceItem | undefined;
  locale: Locale;
  panelControls?: ReactNode;
  panelProps?: PanelChromeProps;
}) {
  const items = trace.slice(0, 5);
  return (
    <section
      className={panelProps?.className ?? "trace-panel"}
      style={panelProps?.style}
      aria-labelledby="trace-title"
    >
      <div className="panel-heading">
        <h2 id="trace-title">{t(locale, "trace")}</h2>
        <span>{t(locale, "traceSubtitle")}</span>
        {panelControls}
      </div>
      {items.length === 0 ? (
        <p className="empty-state trace-empty">{t(locale, "traceEmpty")}</p>
      ) : null}
      <ol className="trace-list">
        {items.map((item) => (
          <li
            key={`${item.index}-${item.nodeId ?? "complete"}`}
            className={activeTrace?.index === item.index ? "trace-item active" : "trace-item"}
          >
            <strong>{item.title}</strong>
            <span>{item.summary}</span>
            <small>
              {t(locale, "traceBefore", {
                x: item.before.x,
                y: item.before.y,
                heading: item.before.heading,
              })}{" "}
              ·{" "}
              {t(locale, "traceAfter", {
                x: item.after.x,
                y: item.after.y,
                heading: item.after.heading,
              })}
            </small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StepCard({
  item,
  position,
  total,
  canAdvance,
  onNext,
  locale,
}: {
  item: LearnerTraceItem;
  position: number;
  total: number;
  canAdvance: boolean;
  onNext: () => void;
  locale: Locale;
}) {
  return (
    <section className="step-card" data-testid="step-card" aria-live="polite">
      <ProvenanceLabel kind="runtime-fact" locale={locale} />
      <strong>{t(locale, "stepCardTitle", { n: position, total })}</strong>
      <p>
        {item.title} — {item.summary}
      </p>
      <p className="step-card-states">
        {t(locale, "traceBefore", { ...item.before })} ·{" "}
        {t(locale, "traceAfter", { ...item.after })}
      </p>
      {canAdvance ? (
        <button type="button" onClick={onNext}>
          {t(locale, "stepCardNext")}
        </button>
      ) : null}
    </section>
  );
}

function blockToneFor(type: BlockNode["type"]): string {
  if (type.startsWith("motion_")) return "motion";
  if (type.startsWith("looks_")) return "looks";
  if (type.startsWith("event_")) return "events";
  if (type.startsWith("control_")) return "control";
  if (type.startsWith("variables_")) return "variables";
  if (type.startsWith("operator_")) return "operators";
  return "logic";
}

function blockShapeFor(type: BlockNode["type"]): string {
  return type === "control_if" ? "predicate" : "command";
}

function autoScrollWorkspaceOnDrag(event: ReactDragEvent<HTMLElement>) {
  event.preventDefault();
  const scroller = event.currentTarget.closest(".program-panel");
  if (!(scroller instanceof HTMLElement)) {
    return;
  }
  const box = scroller.getBoundingClientRect();
  const edgeSize = Math.min(96, box.height / 4);
  if (event.clientY < box.top + edgeSize) {
    scroller.scrollBy({ top: -18, behavior: "auto" });
  } else if (event.clientY > box.bottom - edgeSize) {
    scroller.scrollBy({ top: 18, behavior: "auto" });
  }
}

export function ProgramBlockCard({
  block,
  path,
  siblingIndex,
  siblingTotal,
  depth,
  selected,
  suggestionAffected,
  ghost,
  canonicalNodeId,
  locale,
  assets = [],
  children,
  onSelect,
  onCommitValue,
  onCommitCondition,
  onCommitConditionValue,
  onCommitField,
  onMove,
  onNest,
  onOutdent,
  onDelete,
  onDuplicate,
  onDragStart,
  onDropBefore,
  onDropAfter,
  onDropInside,
}: {
  block: BlockNode;
  path: StatementPath;
  siblingIndex: number;
  siblingTotal: number;
  depth: number;
  selected: boolean;
  suggestionAffected: boolean;
  ghost?: GhostMarkKind | undefined;
  canonicalNodeId: string;
  locale: Locale;
  assets: readonly ProjectAsset[] | undefined;
  children?: ReactNode;
  onSelect: () => void;
  onCommitValue: (value: number) => void;
  onCommitCondition?: (kind: IfConditionKind) => void;
  onCommitConditionValue?: (value: number) => void;
  onCommitField?: (field: string, value: string) => void;
  onMove: (direction: -1 | 1) => void;
  onNest: () => void;
  onOutdent: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>) => void;
  onDropBefore: (event: ReactDragEvent<HTMLElement>) => void;
  onDropAfter: (event: ReactDragEvent<HTMLElement>) => void;
  onDropInside: (event: ReactDragEvent<HTMLElement>) => void;
}) {
  const field = numericFieldFor(block);
  const variableInput = variableNumberInputFor(block);
  const textField = textFieldFor(block);
  const assetField = assetFieldFor(block);
  const currentValue =
    field === undefined
      ? variableInput === undefined
        ? undefined
        : variableNumberValue(block, variableInput)
      : blockValue(block, field);
  const numericLabel = field ?? variableInput;
  const conditionKind = block.type === "control_if" ? ifConditionKind(block) : undefined;
  const conditionValue = block.type === "control_if" ? ifConditionNumberValue(block) : undefined;
  const currentTextValue = textField === undefined ? undefined : stringBlockValue(block, textField);
  const currentAssetValue =
    assetField === undefined ? undefined : stringBlockValue(block, assetField);
  const assetOptions =
    assetField === "costumeId"
      ? assets.filter((asset) => asset.kind === "costume")
      : assetField === "backdropId"
        ? assets.filter((asset) => asset.kind === "backdrop")
        : assetField === "soundId"
          ? assets.filter((asset) => asset.kind === "sound")
          : [];
  const [draftValue, setDraftValue] = useState(() =>
    currentValue === undefined ? "" : String(currentValue),
  );
  const [draftTextValue, setDraftTextValue] = useState(() => currentTextValue ?? "");

  useEffect(() => {
    if (currentValue !== undefined) {
      setDraftValue(String(currentValue));
    }
  }, [currentValue]);

  useEffect(() => {
    if (currentTextValue !== undefined) {
      setDraftTextValue(currentTextValue);
    }
  }, [currentTextValue]);

  function commitDraftValue() {
    if (numericLabel === undefined) return;
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) {
      setDraftValue(currentValue === undefined ? "" : String(currentValue));
      return;
    }
    if (parsed === currentValue) return;
    onCommitValue(parsed);
  }

  function commitDraftTextValue() {
    if (textField === undefined) return;
    const next = draftTextValue.trim();
    if (next.length === 0) {
      setDraftTextValue(currentTextValue ?? "");
      return;
    }
    if (next === currentTextValue) return;
    onCommitField?.(textField, next);
  }

  function handleValueKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setDraftValue(currentValue === undefined ? "" : String(currentValue));
      event.currentTarget.blur();
    }
  }

  function handleTextKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setDraftTextValue(currentTextValue ?? "");
      event.currentTarget.blur();
    }
  }

  const displayName = displayNameFor(block, locale);
  const positionId = `block-pos-${path.join("-")}`;
  const positionText = t(locale, "blockPosition", {
    position: siblingIndex + 1,
    total: siblingTotal,
    level: depth + 1,
  });

  function handleFaceKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    if (event.altKey && key === "ArrowUp") {
      event.preventDefault();
      if (siblingIndex > 0) onMove(-1);
    } else if (event.altKey && key === "ArrowDown") {
      event.preventDefault();
      if (siblingIndex < siblingTotal - 1) onMove(1);
    } else if (event.altKey && key === "ArrowRight") {
      event.preventDefault();
      if (siblingIndex > 0) onNest();
    } else if (event.altKey && key === "ArrowLeft") {
      event.preventDefault();
      if (depth > 0) onOutdent();
    } else if (key === "Delete") {
      event.preventDefault();
      onDelete();
    } else if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "d") {
      event.preventDefault();
      onDuplicate();
    } else if (!event.altKey && (key === "ArrowUp" || key === "ArrowDown")) {
      const faces = Array.from(
        event.currentTarget
          .closest(".block-stack")
          ?.querySelectorAll<HTMLButtonElement>(".block-face") ?? [],
      );
      const next = faces[faces.indexOf(event.currentTarget) + (key === "ArrowUp" ? -1 : 1)];
      if (next !== undefined) {
        event.preventDefault();
        next.focus();
      }
    }
  }

  const blockTone = blockToneFor(block.type);
  const blockShape = blockShapeFor(block.type);
  const hasStatementContainer = canContainStatements(block);
  const fieldSummary = Object.entries(block.fields ?? {})
    .filter(([key]) => key !== field && key !== textField && key !== assetField)
    .map(([, value]) => String(value))
    .join(" ");

  return (
    <article
      className={`block-node block-card block-${blockTone} block-shape-${blockShape}${
        selected ? " active" : ""
      }${suggestionAffected ? " suggestion-affected" : ""}${
        ghost === undefined ? "" : ` ghost-${ghost}`
      }`}
      aria-description={
        ghost === undefined
          ? undefined
          : t(locale, ghost === "removed" ? "ghostWouldRemove" : "ghostWouldChange")
      }
      style={{ marginLeft: `${depth * 22}px` }}
      aria-label={t(locale, "blockLabel", { name: displayName })}
      data-interaction-model="touch-first drag-drop keyboard-reorder"
      data-block-type={block.type}
      data-block-state={selected ? "selected" : suggestionAffected ? "suggested" : "idle"}
      data-block-shape={blockShape}
      data-canonical-node-id={canonicalNodeId}
      data-statement-path={path.join(".")}
      aria-describedby={positionId}
      draggable
      onDragStart={onDragStart}
      onDragOver={autoScrollWorkspaceOnDrag}
      onDrop={(event) => {
        event.stopPropagation();
        onDropBefore(event);
      }}
    >
      <div
        className="snap-target snap-before"
        aria-hidden="true"
        onDragOver={autoScrollWorkspaceOnDrag}
        onDrop={(event) => {
          event.stopPropagation();
          onDropBefore(event);
        }}
      />
      <div className="scratch-block-main">
        <button
          type="button"
          className="block-title block-face"
          aria-describedby={`${positionId} workspace-keyboard-hint`}
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight Delete Control+D Meta+D"
          onClick={onSelect}
          onKeyDown={handleFaceKeyDown}
        >
          <span className="block-grip" aria-hidden="true" />
          <span className="block-label">{displayName}</span>
        </button>
        <span id={positionId} className="visually-hidden">
          {positionText}
        </span>
        {block.type === "control_if" ? (
          <span className="block-slot block-slot-predicate block-condition-editor">
            <select
              value={conditionKind ?? "touchingGoal"}
              aria-label={locale === "es" ? "condición" : "condition"}
              onChange={(event) =>
                onCommitCondition?.(event.currentTarget.value as IfConditionKind)
              }
              draggable={false}
            >
              <option value="touchingGoal">{t(locale, "touchingGoal")}</option>
              <option value="scoreLessThan">score &lt;</option>
              <option value="scoreEquals">score =</option>
            </select>
            {conditionValue === undefined ? null : (
              <input
                type="number"
                inputMode="numeric"
                value={conditionValue}
                aria-label={locale === "es" ? "valor de condición" : "condition value"}
                onChange={(event) => {
                  const next = Number(event.currentTarget.value);
                  if (Number.isFinite(next)) {
                    onCommitConditionValue?.(next);
                  }
                }}
                draggable={false}
              />
            )}
          </span>
        ) : numericLabel !== undefined ? (
          <label className="value-editor block-inline-value">
            <input
              type="number"
              inputMode="numeric"
              value={draftValue}
              aria-label={`${displayName} ${fieldLabelFor(numericLabel, locale)}`}
              onBlur={commitDraftValue}
              onFocus={(event) => {
                // Keep the focused value and its block context above a virtual keyboard.
                event.currentTarget.scrollIntoView?.({ block: "nearest" });
              }}
              onChange={(event) => setDraftValue(event.currentTarget.value)}
              onKeyDown={handleValueKeyDown}
            />
            <span>{fieldLabelFor(numericLabel, locale)}</span>
          </label>
        ) : textField !== undefined ? (
          <label className="value-editor block-inline-value block-text-value">
            <input
              type="text"
              value={draftTextValue}
              maxLength={140}
              aria-label={`${displayName} ${editableFieldLabelFor(textField, locale)}`}
              onBlur={commitDraftTextValue}
              onFocus={(event) => {
                event.currentTarget.scrollIntoView?.({ block: "nearest" });
              }}
              onChange={(event) => setDraftTextValue(event.currentTarget.value)}
              onKeyDown={handleTextKeyDown}
              draggable={false}
            />
          </label>
        ) : assetField !== undefined ? (
          <label className="value-editor block-inline-value block-select-value">
            <select
              value={currentAssetValue ?? ""}
              aria-label={`${displayName} ${editableFieldLabelFor(assetField, locale)}`}
              onChange={(event) => onCommitField?.(assetField, event.currentTarget.value)}
              draggable={false}
            >
              {assetOptions.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
        ) : fieldSummary === "" ? null : (
          <span className="block-slot block-inline-value">{fieldSummary}</span>
        )}
        <div
          className="block-actions block-inline-controls"
          role="group"
          aria-label={t(locale, "cardActions")}
        >
          {siblingIndex === 0 ? null : (
            <button
              type="button"
              aria-label={t(locale, "up")}
              title={t(locale, "up")}
              onClick={() => onMove(-1)}
            >
              ↑
            </button>
          )}
          {siblingIndex === siblingTotal - 1 ? null : (
            <button
              type="button"
              aria-label={t(locale, "down")}
              title={t(locale, "down")}
              onClick={() => onMove(1)}
            >
              ↓
            </button>
          )}
          {siblingIndex === 0 ? null : (
            <button
              type="button"
              aria-label={t(locale, "nestBlock")}
              title={t(locale, "nestBlock")}
              onClick={onNest}
            >
              ↳
            </button>
          )}
          {depth === 0 ? null : (
            <button
              type="button"
              aria-label={t(locale, "outdentBlock")}
              title={t(locale, "outdentBlock")}
              onClick={onOutdent}
            >
              ↰
            </button>
          )}
          <button
            type="button"
            aria-label={t(locale, "duplicateBlock")}
            title={t(locale, "duplicateBlock")}
            onClick={onDuplicate}
          >
            ⧉
          </button>
          <button
            type="button"
            aria-label={t(locale, "delete")}
            title={t(locale, "delete")}
            onClick={onDelete}
          >
            ×
          </button>
        </div>
      </div>
      {block.type === "control_if" ? (
        <p className="block-note">{t(locale, "blockNoteIf")}</p>
      ) : null}
      {hasStatementContainer ? (
        <div
          className="nested-block-stack"
          data-container-path={path.join(".")}
          aria-label={t(locale, "nestedBlocks")}
          onDragOver={autoScrollWorkspaceOnDrag}
          onDrop={(event) => {
            event.stopPropagation();
            onDropInside(event);
          }}
        >
          {children}
          <div className="snap-target snap-inside" aria-hidden="true">
            {t(locale, "dropInside")}
          </div>
        </div>
      ) : null}
      <div
        className="snap-target snap-after"
        aria-hidden="true"
        onDragOver={autoScrollWorkspaceOnDrag}
        onDrop={(event) => {
          event.stopPropagation();
          onDropAfter(event);
        }}
      />
    </article>
  );
}

/**
 * Intent-to-plan dialogue (issue #86). The learner says what should happen and
 * decomposes it before any AI proposal exists: a clear intent becomes a plan in
 * the learner's own words, an ambiguous one becomes one clarifying question, and
 * the learner keeps, edits or rejects the plan. Nothing here changes the
 * canonical program - the plan is only an intent of record until a separate,
 * visible proposal changes blocks or code.
 */
function IntentDialogue({
  locale,
  program,
  mission,
  selectedNodeIds,
}: {
  readonly locale: Locale;
  readonly program: ProjectProgram;
  readonly mission: ReturnType<typeof getLocalizedFirstMission>;
  readonly selectedNodeIds: readonly string[];
}) {
  const [intent, setIntent] = useState("");
  const [response, setResponse] = useState<IntentPlanResponse | undefined>();
  const [plan, setPlan] = useState<IntentPlan | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [clarifications, setClarifications] = useState<readonly string[]>([]);
  const [editingStepId, setEditingStepId] = useState<string | undefined>();
  const [draftStep, setDraftStep] = useState("");

  function requestPlan(nextIntent: string) {
    const learnerIntent = nextIntent.trim();
    if (learnerIntent.length === 0) {
      setMessage(t(locale, "intentPlanNeedsInput"));
      return;
    }
    try {
      const next = createDeterministicIntentPlan(
        createIntentPlanRequest({
          learnerIntent,
          mission: {
            id: mission.id,
            version: mission.version,
            learningObjective: `${mission.title}: ${mission.goal.learnerFacing}`,
            concepts: mission.concepts,
          },
          program,
          selectedNodeIds,
          priorClarifications: clarifications,
          reading: { locale, readingLevel: "middle-grade" },
        }),
      );
      setResponse(next);
      setMessage(undefined);
      setEditingStepId(undefined);
      if (next.kind === "clarification") {
        setPlan(undefined);
        setClarifications((current) => [...current, next.clarification.question]);
        return;
      }
      setPlan(next.plan);
    } catch {
      setResponse(undefined);
      setPlan(undefined);
      setMessage(t(locale, "tutorError"));
    }
  }

  function keepPlan() {
    if (plan === undefined) {
      return;
    }
    try {
      setPlan(acceptIntentPlan(program, plan).plan);
      setMessage(t(locale, "intentPlanKept"));
    } catch {
      setMessage(t(locale, "tutorError"));
    }
  }

  function rejectPlan() {
    if (plan === undefined) {
      return;
    }
    try {
      setPlan(rejectIntentPlan(program, plan).plan);
      setMessage(t(locale, "intentPlanRejected"));
    } catch {
      setMessage(t(locale, "tutorError"));
    }
  }

  function startEditing(stepId: string, description: string) {
    setEditingStepId(stepId);
    setDraftStep(description);
  }

  function saveEditedStep() {
    if (plan === undefined || editingStepId === undefined) {
      return;
    }
    try {
      const order = plan.steps.find((step) => step.id === editingStepId)?.order ?? 1;
      setPlan(editIntentPlanStep(program, plan, editingStepId, draftStep).plan);
      setEditingStepId(undefined);
      setMessage(t(locale, "intentPlanEdited", { order }));
    } catch {
      setMessage(t(locale, "tutorError"));
    }
  }

  const clarification = response?.kind === "clarification" ? response.clarification : undefined;
  const concepts: string =
    plan === undefined
      ? ""
      : plan.concepts.map((concept) => conceptLabel(locale, concept)).join(", ");

  return (
    <section className="intent-panel" aria-labelledby="intent-title" data-testid="intent-dialogue">
      <div className="panel-heading">
        <h3 id="intent-title">{t(locale, "intentTitle")}</h3>
        {plan === undefined ? null : (
          <span>
            <ProvenanceLabel
              kind={plan.status === "accepted" ? "accepted" : "suggestion"}
              locale={locale}
            />
          </span>
        )}
      </div>
      <form
        className="intent-form"
        onSubmit={(event) => {
          event.preventDefault();
          requestPlan(intent);
        }}
      >
        <label>
          <span>{t(locale, "intentLabel")}</span>
          <input
            type="text"
            aria-label={t(locale, "intentLabel")}
            value={intent}
            placeholder={t(locale, "intentPlaceholder")}
            onChange={(event) => setIntent(event.currentTarget.value)}
          />
        </label>
        <button type="submit">{t(locale, "intentPlanAction")}</button>
      </form>
      {message === undefined ? null : (
        <p className="intent-message" aria-live="polite">
          {message}
        </p>
      )}
      {clarification === undefined ? null : (
        <div className="intent-clarification" data-testid="intent-clarification">
          <strong>{clarification.question}</strong>
          <div className="tutor-actions">
            {clarification.options.map((option) => (
              <button key={option} type="button" onClick={() => setIntent(option)}>
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
      {plan === undefined ? null : (
        <div className="intent-plan" data-testid="intent-plan">
          <p className="intent-objective">
            {t(locale, "intentObjective", { objective: plan.learningObjective })}
          </p>
          {concepts.length > 0 ? (
            <p className="intent-concepts">{t(locale, "intentConcepts", { concepts })}</p>
          ) : null}
          <ol className="intent-steps">
            {plan.steps.map((step) => (
              <li key={step.id} className="intent-step">
                <strong>
                  {t(locale, "intentStep", { order: step.order, description: step.description })}
                </strong>
                <span className="intent-rationale">{step.rationale}</span>
                {step.nodeId === undefined ? null : (
                  <span className="intent-node">{step.nodeId}</span>
                )}
                {plan.status !== "proposed" ? null : editingStepId === step.id ? (
                  <div className="intent-step-editor">
                    <label>
                      <span>{t(locale, "intentEditLabel", { order: step.order })}</span>
                      <input
                        type="text"
                        value={draftStep}
                        onChange={(event) => setDraftStep(event.currentTarget.value)}
                      />
                    </label>
                    <button type="button" onClick={saveEditedStep}>
                      {t(locale, "intentSaveStep")}
                    </button>
                    <button type="button" onClick={() => setEditingStepId(undefined)}>
                      {t(locale, "cancelEdit")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(step.id, step.description)}
                    aria-label={t(locale, "intentEditStep", { order: step.order })}
                  >
                    {t(locale, "intentEditStep", { order: step.order })}
                  </button>
                )}
              </li>
            ))}
          </ol>
          {plan.omittedSteps > 0 ? (
            <p className="hint-history">
              {t(locale, "intentOmittedSteps", { count: plan.omittedSteps })}
            </p>
          ) : null}
          <div className="tutor-actions">
            {plan.status !== "proposed" ? null : (
              <button type="button" onClick={keepPlan}>
                {t(locale, "intentKeepPlan")}
              </button>
            )}
            <button type="button" onClick={rejectPlan}>
              {t(locale, "intentRejectPlan")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function conceptLabel(locale: Locale, concept: string): string {
  return t(locale, `intentConcept_${concept}` as MessageKey);
}

export function App({ accountBackend }: { readonly accountBackend?: AccountBackend } = {}) {
  const persistenceRef = useRef<ProjectPersistence | undefined>(createBrowserProjectPersistence());
  // True while the editor holds a private account project. Then the anonymous local namespace
  // (`agorix:default-project`) must not be written, and sign-out must drop the content.
  const showingRemoteRef = useRef(false);
  const awaitBaselineRef = useRef(false);
  const baselineHashRef = useRef<string | undefined>();
  const revertRef = useRef<() => void>(() => undefined);
  const workspaceRef = useRef<WorkspaceController>();
  if (workspaceRef.current === undefined) {
    workspaceRef.current = new WorkspaceController({
      backend: accountBackend ?? createHttpBackend(),
      storage: typeof window === "undefined" ? undefined : safeLocalStorage(),
      readLocalProject: () => readLocalStoredProject(persistenceRef.current),
      onAccountContentCleared: () => revertRef.current(),
    });
  }
  const workspace = workspaceRef.current;
  const workspaceState = useWorkspace(workspace);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const audibleSoundStateRef = useRef<readonly string[]>([]);
  const initialProjectRef = useRef<ReturnType<typeof initialProjectFor>>();
  if (initialProjectRef.current === undefined) {
    initialProjectRef.current = initialProjectFor(persistenceRef.current);
  }

  const [actors, setActors] = useState<ProjectActors>(
    () =>
      initialProjectRef.current!.metadata?.actors ??
      defaultActors(initialProjectRef.current!.model.stage),
  );
  const [model, setModel] = useState<EditorModel>(() => {
    const initial = initialProjectRef.current!.model;
    return { ...initial, stage: stageForActors(initial.stage, actors) };
  });
  const [history, setHistory] = useState<EditorHistory>(() =>
    createEditorHistory(initialProjectRef.current!.model.program),
  );
  const [createdAt, setCreatedAt] = useState(
    () => initialProjectRef.current!.metadata?.createdAt ?? new Date().toISOString(),
  );
  const [locale, setLocale] = useState<Locale>(() =>
    initialProjectRef.current!.metadata?.locale === "es" ? "es" : "en",
  );
  const [creativeState, setCreativeState] = useState<ProjectCreativeState>(() =>
    creativeStateFromMetadata(initialProjectRef.current!.metadata, locale),
  );
  const [selectedActorId, setSelectedActorId] = useState(
    () =>
      creativeStateFromMetadata(initialProjectRef.current!.metadata, locale).actors?.[0]?.id ??
      "actor:main",
  );
  const [status, setStatus] = useState<RunStatus>("idle");
  const [message, setMessage] = useState(
    () => initialProjectRef.current!.message ?? t(locale, "emptyRunMessage"),
  );
  const [persistenceMessage, setPersistenceMessage] = useState<string | undefined>(
    () => initialProjectRef.current!.message,
  );
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | undefined>();
  const [announcement, setAnnouncement] = useState("");
  const [pendingFocus, setPendingFocus] = useState<
    { readonly path: StatementPath } | { readonly fallback: true } | undefined
  >();
  const [frameIndex, setFrameIndex] = useState(0);
  const [frames, setFrames] = useState<readonly ObservationFrame[]>([]);
  const [actorFrames, setActorFrames] = useState<readonly MultiActorFrame[]>([]);
  const [executionSteps, setExecutionSteps] = useState<readonly ExecutionStep[]>([]);
  const [learnerTrace, setLearnerTrace] = useState<readonly LearnerTraceItem[]>([]);
  const [hintHistory, setHintHistory] = useState<readonly TutorHintHistoryEntry[]>([]);
  const [tutorResponse, setTutorResponse] = useState<TutorResponse | undefined>();
  const [lastRunResult, setLastRunResult] = useState<RunResult | undefined>();
  const [reflectionPrompt, setReflectionPrompt] = useState<string | undefined>();
  const [attempts, setAttempts] = useState(0);
  const [proposalReview, setProposalReview] = useState<ProposalReview | undefined>();
  const [proposalMessage, setProposalMessage] = useState<string | undefined>();
  const [dismissedRepeatHash, setDismissedRepeatHash] = useState<string | undefined>();
  const [worldId, setWorldId] = useState<string>(() => loadPresentationPrefs().worldId);
  const [stepping, setStepping] = useState(false);
  const [firstStepDeclined, setFirstStepDeclined] = useState(false);
  const [prediction, setPrediction] = useState<PredictionAnswer | undefined>();
  const [observedGoal, setObservedGoal] = useState<boolean | undefined>();
  const [agentEnabled, setAgentEnabled] = useState<boolean>(
    () => loadPresentationPrefs().agentEnabled,
  );
  const [repeatDeclines, setRepeatDeclines] = useState(
    () => loadPresentationPrefs().repeatDeclines,
  );
  const [learningDecision, setLearningDecision] = useState<
    WebLearningDecisionDiagnostics | undefined
  >();
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [aiLiteracyActivity, setAiLiteracyActivity] = useState(false);
  const [aiPredictionRecorded, setAiPredictionRecorded] = useState(false);
  const timerRef = useRef<number | undefined>();
  const [panelAreas, setPanelAreas] = useState<Record<PanelId, PanelArea>>(DEFAULT_PANEL_AREAS);
  const [collapsedPanels, setCollapsedPanels] = useState<readonly PanelId[]>([]);
  const [closedPanels, setClosedPanels] = useState<readonly PanelId[]>([
    "code",
    "trace",
    "companion",
  ]);
  const [topbarOpen, setTopbarOpen] = useState(false);
  const [maximizedPanel, setMaximizedPanel] = useState<PanelId | undefined>(undefined);
  const [aiConnectionOpen, setAiConnectionOpen] = useState(false);
  const [activeDragKind, setActiveDragKind] = useState<"palette" | "workspace" | undefined>();
  const [activeScriptIndex, setActiveScriptIndex] = useState(0);

  useEffect(() => {
    if (pendingFocus === undefined) return;
    const target =
      "path" in pendingFocus
        ? document.querySelector<HTMLElement>(
            `[data-statement-path="${pendingFocus.path.join(".")}"] > .scratch-block-main > .block-face`,
          )
        : document.querySelector<HTMLElement>(".action-palette .tool-button:not(:disabled)");
    target?.focus();
    setPendingFocus(undefined);
  }, [pendingFocus, model]);

  const mission = useMemo(() => getLocalizedFirstMission(locale), [locale]);
  const activeScript = model.workspace.scripts[activeScriptIndex] ?? model.workspace.scripts[0];
  const statements = activeScript?.statements ?? [];
  const activeScriptBlockCount = statements.length;
  const activeFrame = executionSteps[frameIndex]?.frame ?? frames[frameIndex];
  const actorFrameIndex = actorFrames.length > 0 ? Math.min(frameIndex, actorFrames.length - 1) : 0;
  const activeActorSnapshots = actorFrames[actorFrameIndex]?.actors;
  const stageActors =
    stageActorsFromRuntime(activeActorSnapshots) ?? stageActorsFromCreative(creativeState);
  const fallbackStage: StageState = {
    ...model.stage.current,
    ...(creativeState.stage?.backdropId === undefined
      ? {}
      : { backdropId: creativeState.stage.backdropId }),
    variables: stageVariablesForProgram(model.program),
  };
  const projectActors = creativeState.actors?.length
    ? creativeState.actors
    : [defaultActor(locale)];
  const activeStep = executionSteps[frameIndex];
  const activeTrace = learnerTrace[frameIndex];
  const highlightedCode =
    highlightedNodeId === undefined ? "" : codeSliceForNode(model, highlightedNodeId);
  const codePreview = projectCodeSurface(model.program, "typescript").code.trim();
  const canonicalHash = programSemanticHash(model.program);
  const proposalCard =
    proposalReview === undefined ? undefined : createWebProposalCardView(proposalReview);
  const proposalScopeRows =
    proposalCard === undefined
      ? []
      : [
          {
            key: "actors",
            label: "proposalAffectedActors" as const,
            ids: proposalCard.affectedActorIds,
          },
          {
            key: "scripts",
            label: "proposalAffectedScripts" as const,
            ids: proposalCard.affectedScriptIds,
          },
          {
            key: "assets",
            label: "proposalAffectedAssets" as const,
            ids: proposalCard.affectedAssetIds,
          },
          {
            key: "variables",
            label: "proposalAffectedVariables" as const,
            ids: proposalCard.affectedVariableIds,
          },
        ].filter((row) => row.ids.length > 0);
  useEffect(() => {
    savePresentationPrefs({ worldId, repeatDeclines, agentEnabled });
  }, [worldId, repeatDeclines, agentEnabled]);

  useEffect(() => {
    const activeSoundIds = activeFrame?.state.sounds?.activeSoundIds ?? [];
    const previousSoundIds = audibleSoundStateRef.current;
    audibleSoundStateRef.current = activeSoundIds;
    if (status !== "running" && !stepping) {
      return;
    }
    activeSoundIds
      .filter((soundId) => !previousSoundIds.includes(soundId))
      .forEach((soundId) => playStageSoundCue(soundId));
  }, [activeFrame, status, stepping]);

  function updateSelectedActor(actorId: string, patch: Partial<ProjectActor>) {
    setCreativeState((current) => updateActor(current, actorId, patch));
  }
  const reducedMotion = usePrefersReducedMotion();
  const stageFeedback = deriveStageFeedback({
    frames: executionSteps.length > 0 ? executionSteps.map((step) => step.frame) : frames,
    index: frameIndex,
    status,
    stepping,
  });
  const world = getWorld(worldId);
  const worldText = worldCopy(world, locale);
  const repeatProposal = useMemo(
    () =>
      createRepeatPatternProposal({
        id: "repeat-pattern",
        baseProgram: model.program,
        purpose: t(locale, "repeatSuggestionPurpose"),
        rationale: t(locale, "repeatSuggestionRationale", {
          count: detectRepeatPattern(model.program)?.count ?? 0,
        }),
      }),
    [model.program, locale],
  );
  const repeatReviewActive = proposalReview?.proposal.source.capability === "repeat-pattern";
  useEffect(() => {
    if (activeScriptIndex >= model.workspace.scripts.length) {
      setActiveScriptIndex(0);
    }
  }, [activeScriptIndex, model.workspace.scripts.length]);
  const repeatDecision = useProactiveDecision(
    repeatProposal === undefined || proposalReview !== undefined
      ? undefined
      : {
          kind: "repeat-pattern",
          occurrences: detectRepeatPattern(model.program)?.count ?? 0,
          running: status === "running",
          declinedForCurrentProgram: dismissedRepeatHash === canonicalHash,
          declinedCount: repeatDeclines,
        },
  );
  const firstStepProposal = useMemo(
    () =>
      createFirstStepProposal({
        id: "first-step",
        baseProgram: model.program,
        purpose: t(locale, "firstStepPurpose"),
        rationale: t(locale, "firstStepRationale"),
      }),
    [model.program, locale],
  );
  const firstStepDecision = useProactiveDecision(
    firstStepProposal === undefined || proposalReview !== undefined
      ? undefined
      : {
          kind: "first-step",
          occurrences: statements.length,
          running: status === "running",
          declinedForCurrentProgram: firstStepDeclined,
          declinedCount: 0,
        },
  );
  const firstStepOffer =
    agentEnabled && firstStepDecision?.action === "offer" ? firstStepProposal : undefined;
  const firstStepReviewActive = proposalReview?.proposal.source.capability === "first-step";
  const repeatOffer =
    agentEnabled && repeatDecision?.action === "offer" ? repeatProposal : undefined;
  const missionStep =
    status === "complete" || status === "freeplay" ? 3 : attempts > 0 || status === "retry" ? 2 : 1;
  const layaSignal =
    learningDecision === undefined
      ? t(locale, "layaWaiting")
      : learningDecision.reasoningTier === "deterministic"
        ? t(locale, "layaDeterministic")
        : learningDecision.reasoningTier === "local"
          ? t(locale, "layaLocal")
          : t(locale, "layaRemote");

  // Only offer what works today; unimplemented blocks stay in the catalog but are not shown.
  const scratchPalette = useMemo(
    () =>
      scratchPaletteFor(locale)
        .map((section) => ({ ...section, blocks: section.blocks.filter((block) => block.enabled) }))
        .filter((section) => section.blocks.length > 0),
    [locale],
  );

  useEffect(() => {
    return () => {
      clearRunTimer();
    };
  }, []);

  useEffect(() => {
    if (initialProjectRef.current?.message !== undefined || showingRemoteRef.current) {
      return;
    }
    const metadata = createProjectMetadata(
      createdAt,
      countProgramBlocks(model),
      locale,
      creativeState,
    );
    setPersistenceMessage(saveEditorProject(persistenceRef.current, model.program, metadata));
  }, [createdAt, creativeState, locale, model.program]);

  useEffect(() => {
    void workspace.init();
    const retry = () => workspace.retrySave();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [workspace]);

  // Debounced private autosave. Only canonical program + metadata is sent: undo/redo history,
  // proposals and previews never leave the editor.
  useEffect(() => {
    if (!showingRemoteRef.current || workspaceState.active === undefined) {
      return;
    }
    const stored = {
      schemaVersion: model.program.schema,
      program: model.program,
      metadata: createProjectMetadata(createdAt, countProgramBlocks(model), locale, creativeState),
    };
    const hash = semanticProjectHash(stored);
    if (awaitBaselineRef.current) {
      awaitBaselineRef.current = false;
      baselineHashRef.current = hash;
      return;
    }
    if (baselineHashRef.current === hash) {
      return;
    }
    const timer = setTimeout(() => {
      baselineHashRef.current = hash;
      workspace.queueSave(stored);
    }, 400);
    return () => clearTimeout(timer);
  }, [
    createdAt,
    creativeState,
    locale,
    model.program,
    workspace,
    workspaceState.active?.projectId,
  ]);

  function loadAccountProject(dto: ProjectDto) {
    showingRemoteRef.current = true;
    awaitBaselineRef.current = true;
    baselineHashRef.current = undefined;
    replaceCurrentProject(dto.storedProject.program, dto.storedProject.metadata);
    setPersistenceMessage(undefined);
    setMessage(t(locale, "projectImported"));
  }

  revertRef.current = () => {
    if (!showingRemoteRef.current) {
      return;
    }
    showingRemoteRef.current = false;
    baselineHashRef.current = undefined;
    const local = loadEditorProject(persistenceRef.current);
    if (local.model !== undefined && local.metadata !== undefined) {
      replaceCurrentProject(local.model.program, local.metadata);
    } else {
      replaceCurrentProject(
        createEditorModel().program,
        createProjectMetadata(new Date().toISOString(), 0, locale, defaultCreativeState(locale)),
      );
    }
    setMessage(t(locale, "emptyRunMessage"));
  };

  function createStarterProject() {
    const program = createEditorModel().program;
    return {
      schemaVersion: program.schema,
      program,
      metadata: createProjectMetadata(
        new Date().toISOString(),
        0,
        locale,
        defaultCreativeState(locale),
      ),
    };
  }

  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent) {
      const target = event.target;
      const tagName = target instanceof HTMLElement ? target.tagName : "";
      const nativeEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA");
      if (nativeEditable || (!event.metaKey && !event.ctrlKey) || event.altKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") {
        return;
      }
      event.preventDefault();
      if (key === "z" && event.shiftKey) {
        redoEditor();
        return;
      }
      if (key === "z") {
        undoEditor();
        return;
      }
      redoEditor();
    }
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  });

  useEffect(() => {
    function handleRuntimeKey(event: KeyboardEvent) {
      const target = event.target;
      const tagName = target instanceof HTMLElement ? target.tagName : "";
      const nativeEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA");
      if (nativeEditable || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key.length > 1 && !event.key.startsWith("Arrow")) {
        return;
      }
      runRuntimeEvents([{ type: "keyPressed", key: event.key }]);
    }
    window.addEventListener("keydown", handleRuntimeKey);
    return () => window.removeEventListener("keydown", handleRuntimeKey);
  });

  function resetEphemeralEditorState() {
    clearRunTimer();
    audibleSoundStateRef.current = [];
    initialProjectRef.current = { ...initialProjectRef.current!, message: undefined };
    setPersistenceMessage(undefined);
    setHighlightedNodeId(undefined);
    setFrames([]);
    setActorFrames([]);
    setExecutionSteps([]);
    setLearnerTrace([]);
    setFrameIndex(0);
    setTutorResponse(undefined);
    setLastRunResult(undefined);
    setReflectionPrompt(undefined);
    setPrediction(undefined);
    setObservedGoal(undefined);
    setProposalReview(undefined);
    setProposalMessage(undefined);
    setLearningDecision(undefined);
    setStatus("idle");
    setActiveScriptIndex(0);
  }

  function applyProjection(projection: EditorProjection) {
    resetEphemeralEditorState();
    setModel((current) => mergeProjection(current, projection));
  }

  function commitProjection(label: string, projection: EditorProjection): boolean {
    const result = recordCanonicalTransaction(history, { label, after: projection.program });
    if (!result.applied) {
      return false;
    }
    setHistory(result.history);
    applyProjection(projection);
    return true;
  }

  function restoreHistory(nextHistory: EditorHistory, program: ProjectProgram) {
    resetEphemeralEditorState();
    setHistory(nextHistory);
    const restored = createEditorModelFromProgram(program);
    setModel((current) => ({ ...current, ...restored }));
  }

  function replaceCurrentProject(program: ProjectProgram, metadata: ProjectMetadata) {
    resetEphemeralEditorState();
    const restored = createEditorModelFromProgram(program);
    setHistory(createEditorHistory(restored.program));
    const restoredActors = metadata.actors ?? defaultActors(INITIAL_STAGE);
    setActors(restoredActors);
    setModel((current) => ({
      ...current,
      ...restored,
      stage: stageForActors(current.stage, restoredActors),
    }));
    setCreatedAt(metadata.createdAt);
    const nextCreative = creativeStateFromMetadata(metadata, locale);
    setCreativeState(nextCreative);
    setSelectedActorId(nextCreative.actors?.[0]?.id ?? "actor:main");
    if (metadata.locale === "en" || metadata.locale === "es") {
      setLocale(metadata.locale);
    }
    setFrames([]);
    setActorFrames([]);
    setExecutionSteps([]);
    setLearnerTrace([]);
    setFrameIndex(0);
    setHighlightedNodeId(undefined);
    setHintHistory([]);
    setTutorResponse(undefined);
    setLastRunResult(undefined);
    setReflectionPrompt(undefined);
    setAttempts(0);
    setStatus("idle");
    setActiveScriptIndex(0);
    setProposalReview(undefined);
    setProposalMessage(undefined);
    setAiLiteracyActivity(false);
    setAiPredictionRecorded(false);
    setActiveScriptIndex(0);
  }

  function undoEditor() {
    const restored = undoCanonicalTransaction(history);
    if (restored.history === history) {
      return;
    }
    restoreHistory(restored.history, restored.program);
    setMessage(t(locale, "programUpdatedMessage"));
  }

  function redoEditor() {
    const restored = redoCanonicalTransaction(history);
    if (restored.history === history) {
      return;
    }
    restoreHistory(restored.history, restored.program);
    setMessage(t(locale, "programUpdatedMessage"));
  }

  function updateActor(patch: ActorPatch) {
    const next = patchActive(actors, patch);
    setActors(next);
    setModel((current) => ({ ...current, stage: stageForActors(current.stage, next) }));
    setFrames([]);
    setFrameIndex(0);
  }

  function exportProject() {
    const metadata = createProjectMetadata(
      createdAt,
      countProgramBlocks(model),
      locale,
      creativeState,
    );
    const json = serializeAgorixProject({
      schemaVersion: model.program.schema,
      program: model.program,
      metadata,
    });
    const blob = new Blob([json], { type: "application/vnd.agorix.project+json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; // agora-allowlist: local Blob download generated from validated .agorix serializer, not outbound navigation
    anchor.download = sanitizeAgorixFilename("agorix-first-mission");
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage(t(locale, "projectExported"));
  }

  async function importProjectFile(file: File) {
    try {
      if (statements.length > 0 && !window.confirm(t(locale, "importReplaceConfirm"))) {
        return;
      }
      const envelope = parseAgorixProject(await file.text());
      replaceCurrentProject(envelope.project.program, envelope.project.metadata);
      setMessage(t(locale, "projectImported"));
    } catch {
      setStatus("error");
      setMessage(t(locale, "projectImportFailed"));
    } finally {
      if (importInputRef.current !== null) {
        importInputRef.current.value = "";
      }
    }
  }

  function blockAtStatementPath(
    workspace: BlockWorkspaceSnapshot,
    path: StatementPath,
  ): BlockNode | undefined {
    return statementListAtPath(workspace, parentContainerPath(path), activeScriptIndex)[
      indexInContainer(path)
    ];
  }

  function parentLabel(workspace: BlockWorkspaceSnapshot, path: StatementPath): string {
    const parentPath = parentContainerPath(path);
    const parent =
      parentPath.length === 0 ? undefined : blockAtStatementPath(workspace, parentPath);
    return parent === undefined ? t(locale, "whenRun") : displayNameFor(parent, locale);
  }

  function announceAt(
    kind: "announceAdded" | "announceMoved" | "announceDuplicated",
    workspace: BlockWorkspaceSnapshot,
    path: StatementPath,
  ) {
    const block = blockAtStatementPath(workspace, path);
    setAnnouncement(
      t(locale, kind, {
        name: block === undefined ? "" : displayNameFor(block, locale),
        position: indexInContainer(path) + 1,
        total: statementListAtPath(workspace, parentContainerPath(path), activeScriptIndex).length,
      }),
    );
    setPendingFocus({ path });
  }

  function findPathById(
    workspace: BlockWorkspaceSnapshot,
    id: string,
    container: StatementPath = [],
  ): StatementPath | undefined {
    const list = statementListAtPath(workspace, container, activeScriptIndex);
    for (const [index, block] of list.entries()) {
      const path = [...container, index];
      if (block.id === id) return path;
      if (canContainStatements(block)) {
        const found = findPathById(workspace, id, path);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  function addBlock(type: AddableBlockType) {
    const projection = addBlockToWorkspace(model.workspace, type, activeScriptIndex);
    if (commitProjection("add block", projection)) {
      setMessage(t(locale, "blockAddedMessage"));
      announceAt("announceAdded", projection.workspace, [
        model.workspace.scripts[activeScriptIndex]?.statements.length ?? 0,
      ]);
    }
  }

  function addEventScript(triggerType: AddableTriggerType) {
    const nextIndex = model.workspace.scripts.length;
    const projection = addScriptToWorkspace(model.workspace, triggerType);
    if (!commitProjection("add event script", projection)) {
      return;
    }
    setActiveScriptIndex(nextIndex);
    const scriptId = projection.program.scripts[nextIndex]?.id;
    if (scriptId !== undefined) {
      setCreativeState((current) => {
        const selected = selectedActorId ?? current.actors?.[0]?.id ?? "actor:main";
        const selectedActor = current.actors?.find((actor) => actor.id === selected);
        return updateActor(current, selected, {
          scripts: Array.from(new Set([...(selectedActor?.scripts ?? ["main"]), scriptId])),
        });
      });
    }
    setMessage(t(locale, "programUpdatedMessage"));
  }

  function editActiveTriggerField(field: "key" | "message", value: string) {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }
    if (
      commitProjection(
        "edit event trigger",
        editScriptTriggerField(model.workspace, activeScriptIndex, field, trimmed),
      )
    ) {
      setMessage(t(locale, "programUpdatedMessage"));
    }
  }

  function editBlockAt(path: StatementPath, block: BlockNode, value: number) {
    const field = numericFieldFor(block);
    const variableInput = variableNumberInputFor(block);
    if (field === undefined && variableInput === undefined) {
      return;
    }
    const projection =
      field === undefined
        ? editVariableNumberInputAt(model.workspace, path, value, activeScriptIndex)
        : editNumericBlockFieldAt(model.workspace, path, field, value, activeScriptIndex);
    if (commitProjection("edit numeric block field", projection)) {
      setMessage(t(locale, "programUpdatedMessage"));
      setAnnouncement(
        t(locale, "announceEdited", {
          name: displayNameFor(block, locale),
          field: fieldLabelFor(field ?? variableInput ?? "value", locale),
          value,
        }),
      );
    }
  }

  function editBlockField(path: StatementPath, block: BlockNode, field: string, value: string) {
    if (
      commitProjection(
        "edit block field",
        editBlockFieldAt(model.workspace, path, field, value, activeScriptIndex),
      )
    ) {
      setMessage(t(locale, "programUpdatedMessage"));
      setAnnouncement(
        t(locale, "announceEdited", {
          name: displayNameFor(block, locale),
          field: editableFieldLabelFor(
            field as
              | "steps"
              | "degrees"
              | "count"
              | "size"
              | "value"
              | "delta"
              | "text"
              | "message"
              | "costumeId"
              | "backdropId",
            locale,
          ),
          value,
        }),
      );
    }
  }

  function editIfCondition(path: StatementPath, block: BlockNode, kind: IfConditionKind) {
    if (block.type !== "control_if") {
      return;
    }
    if (
      commitProjection(
        "edit if condition",
        editIfConditionAt(model.workspace, path, kind, activeScriptIndex),
      )
    ) {
      setMessage(t(locale, "programUpdatedMessage"));
      setAnnouncement(
        t(locale, "announceEdited", {
          name: displayNameFor(block, locale),
          field: locale === "es" ? "condición" : "condition",
          value: kind,
        }),
      );
    }
  }

  function editIfConditionValue(path: StatementPath, block: BlockNode, value: number) {
    if (block.type !== "control_if") {
      return;
    }
    if (
      commitProjection(
        "edit if condition value",
        editIfConditionNumberAt(model.workspace, path, value, activeScriptIndex),
      )
    ) {
      setMessage(t(locale, "programUpdatedMessage"));
      setAnnouncement(
        t(locale, "announceEdited", {
          name: displayNameFor(block, locale),
          field: locale === "es" ? "valor de condición" : "condition value",
          value,
        }),
      );
    }
  }

  function moveBlockAt(path: StatementPath, direction: -1 | 1) {
    const containerPath = parentContainerPath(path);
    const siblings = statementListAtPath(model.workspace, containerPath, activeScriptIndex);
    const index = indexInContainer(path);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= siblings.length) {
      return;
    }
    const projection = moveBlockInWorkspaceByPath(
      model.workspace,
      path,
      containerPath,
      nextIndex,
      activeScriptIndex,
    );
    if (commitProjection("move block", projection)) {
      setMessage(t(locale, "programUpdatedMessage"));
      announceAt("announceMoved", projection.workspace, [...containerPath, nextIndex]);
    }
  }

  function deleteBlockAt(path: StatementPath) {
    const block = blockAtStatementPath(model.workspace, path);
    const projection = deleteBlockFromWorkspaceAt(model.workspace, path, activeScriptIndex);
    if (commitProjection("delete block", projection)) {
      setMessage(t(locale, "programUpdatedMessage"));
      const containerPath = parentContainerPath(path);
      const remaining = statementListAtPath(
        projection.workspace,
        containerPath,
        activeScriptIndex,
      ).length;
      setAnnouncement(
        t(locale, "announceDeleted", {
          name: block === undefined ? "" : displayNameFor(block, locale),
          total: statementListAtPath(projection.workspace, [], activeScriptIndex).length,
        }),
      );
      const index = indexInContainer(path);
      if (remaining > 0) {
        setPendingFocus({ path: [...containerPath, Math.min(index, remaining - 1)] });
      } else if (containerPath.length > 0) {
        setPendingFocus({ path: containerPath });
      } else {
        setPendingFocus({ fallback: true });
      }
    }
  }

  function duplicateBlockAt(path: StatementPath) {
    const projection = duplicateBlockInWorkspace(model.workspace, path, activeScriptIndex);
    if (commitProjection("duplicate block", projection)) {
      setMessage(t(locale, "programUpdatedMessage"));
      announceAt("announceDuplicated", projection.workspace, [
        ...parentContainerPath(path),
        indexInContainer(path) + 1,
      ]);
    }
  }

  function nestBlockAt(path: StatementPath) {
    const containerPath = parentContainerPath(path);
    const siblings = statementListAtPath(model.workspace, containerPath, activeScriptIndex);
    const index = indexInContainer(path);
    const previous = siblings[index - 1];
    if (previous === undefined || !canContainStatements(previous)) {
      return;
    }
    const targetContainerPath = [...containerPath, index - 1];
    const targetIndex = statementListAtPath(
      model.workspace,
      targetContainerPath,
      activeScriptIndex,
    ).length;
    const projection = moveBlockInWorkspaceByPath(
      model.workspace,
      path,
      targetContainerPath,
      targetIndex,
      activeScriptIndex,
    );
    if (commitProjection("nest block", projection)) {
      setMessage(t(locale, "programUpdatedMessage"));
      announceStructure("announceNested", projection.workspace, [
        ...targetContainerPath,
        targetIndex,
      ]);
    }
  }

  function outdentBlockAt(path: StatementPath) {
    if (path.length < 2) {
      return;
    }
    const parentPath = parentContainerPath(path);
    const grandParentPath = parentContainerPath(parentPath);
    const parentIndex = indexInContainer(parentPath);
    const projection = moveBlockInWorkspaceByPath(
      model.workspace,
      path,
      grandParentPath,
      parentIndex + 1,
      activeScriptIndex,
    );
    if (commitProjection("outdent block", projection)) {
      setMessage(t(locale, "programUpdatedMessage"));
      announceStructure("announceOutdented", projection.workspace, [
        ...grandParentPath,
        parentIndex + 1,
      ]);
    }
  }

  function announceStructure(
    kind: "announceNested" | "announceOutdented",
    workspace: BlockWorkspaceSnapshot,
    path: StatementPath,
  ) {
    const block = blockAtStatementPath(workspace, path);
    const parent =
      kind === "announceNested" ? parentLabel(workspace, path) : parentLabelBefore(path);
    setAnnouncement(
      t(locale, kind, {
        name: block === undefined ? "" : displayNameFor(block, locale),
        parent,
        position: indexInContainer(path) + 1,
        total: statementListAtPath(workspace, parentContainerPath(path), activeScriptIndex).length,
      }),
    );
    setPendingFocus({ path });
  }

  function parentLabelBefore(newPath: StatementPath): string {
    // The block left the container just before its new sibling position; name the container it left.
    const left = model.workspace;
    const siblingBefore = blockAtStatementPath(left, [
      ...parentContainerPath(newPath),
      indexInContainer(newPath) - 1,
    ]);
    return siblingBefore === undefined
      ? t(locale, "whenRun")
      : displayNameFor(siblingBefore, locale);
  }

  function clearRunTimer() {
    if (timerRef.current !== undefined) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }

  function stopRun() {
    clearRunTimer();
    audibleSoundStateRef.current = [];
    setStatus("stopped");
    setMessage(t(locale, "stopped"));
  }

  function resetEditor() {
    stopRun();
    const projection = resetWorkspace();
    initialProjectRef.current = { ...initialProjectRef.current!, message: undefined };
    setPersistenceMessage(undefined);
    setCreatedAt(new Date().toISOString());
    const result = recordCanonicalTransaction(history, {
      label: "reset workspace",
      after: projection.program,
    });
    setHistory(result.applied ? result.history : createEditorHistory(projection.program));
    setModel((current) => ({
      ...mergeProjection(current, projection),
      stage: resetStageSession(current.stage),
    }));
    const nextCreative = defaultCreativeState(locale);
    setCreativeState(nextCreative);
    setSelectedActorId(nextCreative.actors?.[0]?.id ?? "actor:main");
    setFrames([]);
    setActorFrames([]);
    setExecutionSteps([]);
    setLearnerTrace([]);
    setFrameIndex(0);
    setHighlightedNodeId(undefined);
    setHintHistory([]);
    setTutorResponse(undefined);
    setLastRunResult(undefined);
    setReflectionPrompt(undefined);
    setAttempts(0);
    setStatus("idle");
    setProposalReview(undefined);
    setProposalMessage(undefined);
    setAiLiteracyActivity(false);
    setAiPredictionRecorded(false);
    setMessage(t(locale, "resetMessage"));
  }

  function createRuntimeFrames(events?: readonly RuntimeEvent[]) {
    audibleSoundStateRef.current = [];
    const initialWorld = initialWorldFor(model, creativeState);
    const multiActorResult = runMultiActorProgram(model.program, creativeState, {
      maxSteps: 24,
      goal: initialWorld.goal,
      ...(events === undefined ? {} : { events }),
    });
    const observations = runtimeObservationsFromActorFrames(multiActorResult);
    const primaryWorld = multiActorResult.actors[0]?.world ?? initialWorld;
    const result: RunResult = {
      outcome: multiActorResult.outcome,
      world: primaryWorld,
      stepsUsed: multiActorResult.stepsUsed,
      trace: multiActorResult.trace.map((entry) => ({
        step: entry.step,
        nodeId: entry.nodeId,
        path: entry.path,
        statementType: entry.statementType,
        worldBefore: entry.worldBefore,
        worldAfter: entry.worldAfter,
      })),
      observations,
    };
    const nextFrames = framesFromRuntimeObservations(observations);
    const nextSteps = executionStepsFromRuntimeObservations(observations);
    const nextTrace = learnerTraceFromExecutionSteps(nextSteps, "beginner");
    setLastRunResult(result);
    setFrames(nextFrames);
    setActorFrames(multiActorResult.frames);
    setExecutionSteps(nextSteps);
    setLearnerTrace(nextTrace);
    return { result, nextFrames, nextSteps, nextTrace, multiActorResult };
  }

  function runBlocks() {
    if (status === "running") {
      return;
    }
    setStepping(false);
    setObservedGoal(undefined);
    if (statements.length === 0) {
      setStatus("error");
      setMessage(t(locale, "emptyRunMessage"));
      return;
    }
    try {
      const { result, nextFrames } = createRuntimeFrames();
      setAttempts((current) => current + 1);
      setFrameIndex(0);
      setStatus("running");
      setMessage(t(locale, "running"));
      clearRunTimer();
      timerRef.current = window.setInterval(() => {
        setFrameIndex((current) => {
          const next = current + 1;
          if (next >= nextFrames.length) {
            window.clearInterval(timerRef.current);
            timerRef.current = undefined;
            const feedback = resultFeedback(result, locale, mission);
            setObservedGoal(touchingGoal(result.world));
            setStatus(feedback.completed ? "complete" : "retry");
            setMessage(feedback.message);
            setReflectionPrompt(feedback.reflectionPrompt);
            setHighlightedNodeId(undefined);
            return Math.max(nextFrames.length - 1, 0);
          }
          setHighlightedNodeId(nextFrames[next]?.highlightedNodeId);
          return next;
        });
      }, 550);
      setHighlightedNodeId(nextFrames[0]?.highlightedNodeId);
    } catch {
      setStatus("error");
      setMessage(t(locale, "runSetupError"));
    }
  }

  function runRuntimeEvents(events: readonly RuntimeEvent[]) {
    if (status === "running") {
      return;
    }
    setStepping(false);
    setObservedGoal(undefined);
    try {
      const { result, nextFrames } = createRuntimeFrames(events);
      setAttempts((current) => current + 1);
      setFrameIndex(0);
      setStatus("running");
      setMessage(t(locale, "running"));
      clearRunTimer();
      timerRef.current = window.setInterval(() => {
        setFrameIndex((current) => {
          const next = current + 1;
          if (next >= nextFrames.length) {
            window.clearInterval(timerRef.current);
            timerRef.current = undefined;
            const feedback = resultFeedback(result, locale, mission);
            setObservedGoal(touchingGoal(result.world));
            setStatus(feedback.completed ? "complete" : "retry");
            setMessage(feedback.message);
            setReflectionPrompt(feedback.reflectionPrompt);
            setHighlightedNodeId(undefined);
            return Math.max(nextFrames.length - 1, 0);
          }
          setHighlightedNodeId(nextFrames[next]?.highlightedNodeId);
          return next;
        });
      }, 550);
      setHighlightedNodeId(nextFrames[0]?.highlightedNodeId);
    } catch {
      setStatus("error");
      setMessage(t(locale, "runSetupError"));
    }
  }

  function stepBlocks() {
    clearRunTimer();
    setStepping(true);
    if (statements.length === 0) {
      setStatus("error");
      setMessage(t(locale, "emptyRunMessage"));
      return;
    }
    try {
      const hasReusableSteps = executionSteps.length > 0 && lastRunResult !== undefined;
      const prepared = hasReusableSteps ? undefined : createRuntimeFrames();
      const result = hasReusableSteps ? lastRunResult : prepared!.result;
      const nextSteps = hasReusableSteps ? executionSteps : prepared!.nextSteps;
      if (!hasReusableSteps) {
        setAttempts((current) => current + 1);
      }
      const nextIndex = hasReusableSteps ? Math.min(frameIndex + 1, nextSteps.length - 1) : 0;
      setFrameIndex(nextIndex);
      setHighlightedNodeId(nextSteps[nextIndex]?.nodeId);
      if (nextIndex >= nextSteps.length - 1) {
        const feedback = resultFeedback(result, locale, mission);
        setObservedGoal(touchingGoal(result.world));
        setStatus(feedback.completed ? "complete" : "retry");
        setMessage(feedback.message);
        setReflectionPrompt(feedback.reflectionPrompt);
        return;
      }
      setStatus("stopped");
      setMessage(t(locale, "stepMessage"));
    } catch {
      setStatus("error");
      setMessage(t(locale, "runSetupError"));
    }
  }

  function previewImperfectAiProposal() {
    try {
      const proposal = createProgramProposal({
        id: "ai-literacy-imperfect-move-120",
        baseProgram: model.program,
        source: { kind: "learning-companion", capability: "program-proposal" },
        purpose: t(locale, "proposalPurpose"),
        rationale: t(locale, "aiLiteracyRationale"),
        affectedNodeIds: ["scripts[0]/statements[0]"],
        operations: [
          {
            type: "replaceStatement",
            nodeId: "scripts[0]/statements[0]",
            statement: { type: "move", steps: 120 },
          },
        ],
      });
      const review = createProposalReview(model.program, proposal);
      setAiLiteracyActivity(true);
      setAiPredictionRecorded(false);
      setProposalReview(review);
      setProposalMessage(t(locale, "proposalPreviewReady"));
      setHighlightedNodeId(review.proposal.affectedNodeIds[0]);
      restorePanel("companion");
    } catch {
      setStatus("error");
      setMessage(t(locale, "runSetupError"));
    }
  }

  function recordAiPrediction() {
    setAiPredictionRecorded(true);
    setProposalMessage(t(locale, "aiLiteracyPredictionRecorded"));
  }

  function toggleAgent(next: boolean) {
    setAgentEnabled(next);
    if (!next) {
      setProposalReview(undefined);
      setProposalMessage(undefined);
      setHighlightedNodeId(undefined);
    }
  }

  function tryFirstStep() {
    if (firstStepOffer === undefined) {
      return;
    }
    const review = createProposalReview(model.program, firstStepOffer);
    setProposalReview(review);
    setProposalMessage(t(locale, "proposalPreviewReady"));
    setHighlightedNodeId(review.proposal.affectedNodeIds[0]);
  }

  function tryRepeatSuggestion() {
    if (repeatOffer === undefined) {
      return;
    }
    const review = createProposalReview(model.program, repeatOffer);
    setProposalReview(review);
    setProposalMessage(t(locale, "proposalPreviewReady"));
    setHighlightedNodeId(review.proposal.affectedNodeIds[0]);
  }

  function changeRepeatSuggestion() {
    if (repeatOffer === undefined) {
      return;
    }
    setDismissedRepeatHash(canonicalHash);
    setRepeatDeclines((count) => count + 1);
    setHighlightedNodeId(repeatOffer.affectedNodeIds[0]);
  }

  function declineRepeatSuggestion() {
    setDismissedRepeatHash(canonicalHash);
    setRepeatDeclines((count) => count + 1);
  }

  function rejectDeterministicProposal() {
    if (proposalReview === undefined) {
      return;
    }
    rejectProposal(model.program, proposalReview);
    if (repeatReviewActive) {
      setDismissedRepeatHash(canonicalHash);
      setRepeatDeclines((count) => count + 1);
    }
    if (firstStepReviewActive) {
      setFirstStepDeclined(true);
    }
    setProposalReview(undefined);
    setProposalMessage(t(locale, "proposalRejected"));
    setHighlightedNodeId(undefined);
  }

  function acceptDeterministicProposal() {
    if (proposalReview === undefined) {
      return;
    }
    const accepted = acceptProposal(model.program, proposalReview);
    const nextModel = createEditorModelFromProgram(accepted.program);
    commitProjection("accept program proposal", nextModel);
    setProposalReview(undefined);
    setProposalMessage(t(locale, "proposalAccepted"));
    setMessage(t(locale, "codeBehindBlocks"));
  }

  function requestHint() {
    try {
      const result =
        lastRunResult ??
        runProgram(model.program, initialWorldFor(model, creativeState), {
          collectObservations: true,
          stopAfterSteps: 24,
        });
      const tutorRequest = createTutorRequest({
        mission: {
          id: mission.id,
          version: mission.version,
          concepts: mission.concepts,
        },
        program: model.program,
        runtime: {
          outcome: result.outcome,
          stepsUsed: result.stepsUsed,
          finalWorld: result.world,
          observations: result.observations,
        },
        hintHistory,
        reading: { locale, readingLevel: "middle-grade" },
      });
      const companionRequest = createLearningCompanionRequestFromTutorRequest(tutorRequest);
      const route = decideStaticWebLearningRoute(companionRequest);
      setLearningDecision(route.diagnostics);
      const response =
        route.requirements.generativeNeeded === "no"
          ? createDeterministicTutorResponse(tutorRequest)
          : createDeterministicTutorResponse(tutorRequest);
      const nextHistory: TutorHintHistoryEntry = {
        level: response.hintLevel,
        ...(response.concepts[0] === undefined ? {} : { concept: response.concepts[0] }),
        ...(response.nodeIds[0] === undefined ? {} : { nodeId: response.nodeIds[0] }),
      };

      setLastRunResult(result);
      setTutorResponse(response);
      setHintHistory((current) => [...current, nextHistory]);
      restorePanel("companion");
      if (response.nodeIds[0] !== undefined) {
        setHighlightedNodeId(response.nodeIds[0]);
      }
    } catch {
      setStatus("error");
      setMessage(t(locale, "tutorError"));
    }
  }

  function retryMission() {
    stopRun();
    setFrames([]);
    setActorFrames([]);
    setExecutionSteps([]);
    setLearnerTrace([]);
    setFrameIndex(0);
    setHighlightedNodeId(undefined);
    setTutorResponse(undefined);
    setLastRunResult(undefined);
    setReflectionPrompt(undefined);
    setStatus("idle");
    setMessage(t(locale, "keepBlocksTryAgain"));
  }

  function continueFreePlay() {
    setStatus("freeplay");
    setReflectionPrompt(undefined);
    setMessage(t(locale, "freePlayUnlocked"));
  }

  function togglePanel(panel: PanelId) {
    setCollapsedPanels((current) =>
      current.includes(panel) ? current.filter((item) => item !== panel) : [...current, panel],
    );
  }

  function closePanel(panel: PanelId) {
    setClosedPanels((current) => (current.includes(panel) ? current : [...current, panel]));
    setMaximizedPanel((current) => (current === panel ? undefined : current));
  }

  function restorePanel(panel: PanelId) {
    setClosedPanels((current) => current.filter((item) => item !== panel));
    setCollapsedPanels((current) => current.filter((item) => item !== panel));
  }

  function toggleMaximizedPanel(panel: PanelId) {
    setCollapsedPanels((current) => current.filter((item) => item !== panel));
    setClosedPanels((current) => current.filter((item) => item !== panel));
    setMaximizedPanel((current) => (current === panel ? undefined : panel));
  }

  function revealCompanion() {
    restorePanel("companion");
  }

  function movePanel(panel: PanelId, direction: -1 | 1) {
    setPanelAreas((current) => {
      const currentArea = current[panel];
      const currentIndex = PANEL_AREAS.indexOf(currentArea);
      const nextArea =
        PANEL_AREAS[(currentIndex + direction + PANEL_AREAS.length) % PANEL_AREAS.length];
      const occupyingPanel = (Object.keys(current) as PanelId[]).find(
        (candidate) => candidate !== panel && current[candidate] === nextArea,
      );
      return {
        ...current,
        [panel]: nextArea,
        ...(occupyingPanel === undefined ? {} : { [occupyingPanel]: currentArea }),
      };
    });
  }

  function panelControls(panel: PanelId) {
    return (
      <PanelControls
        panel={panel}
        collapsed={collapsedPanels.includes(panel)}
        maximized={maximizedPanel === panel}
        onToggle={() => togglePanel(panel)}
        onClose={() => closePanel(panel)}
        onMaximize={() => toggleMaximizedPanel(panel)}
        onMove={(direction) => movePanel(panel, direction)}
      />
    );
  }

  function panelProps(panel: PanelId, baseClassName: string): PanelChromeProps {
    const isCollapsed = collapsedPanels.includes(panel);
    const isMaximized = maximizedPanel === panel;
    return {
      className: `${baseClassName} resizable-panel${isCollapsed ? " panel-collapsed" : ""}${
        isMaximized ? " panel-maximized" : ""
      }`,
      style: { gridArea: panelAreas[panel] },
    };
  }

  function dragTool(event: ReactDragEvent<HTMLElement>, type: AddableBlockType) {
    event.dataTransfer.setData(BLOCK_DRAG_TYPE, type);
    event.dataTransfer.effectAllowed = "copy";
    setActiveDragKind("palette");
  }

  function dragWorkspaceBlock(event: ReactDragEvent<HTMLElement>, path: StatementPath) {
    event.dataTransfer.setData(WORKSPACE_DRAG_TYPE, path.join("."));
    event.dataTransfer.effectAllowed = "move";
    setActiveDragKind("workspace");
  }

  function clearDragState() {
    setActiveDragKind(undefined);
  }

  function pathFromDragData(value: string): StatementPath | undefined {
    if (value.trim() === "") {
      return undefined;
    }
    const path = value.split(".").map((segment) => Number(segment));
    return path.every((segment) => Number.isInteger(segment) && segment >= 0) ? path : undefined;
  }

  function dropIntoWorkspace(
    event: ReactDragEvent<HTMLElement>,
    targetContainerPath: StatementPath = [],
    targetIndex = statementListAtPath(model.workspace, targetContainerPath, activeScriptIndex)
      .length,
  ) {
    event.preventDefault();
    clearDragState();
    const type = event.dataTransfer.getData(BLOCK_DRAG_TYPE);
    if (isAddable(type)) {
      const projection = addBlockToWorkspaceAt(
        model.workspace,
        type,
        targetContainerPath,
        targetIndex,
        activeScriptIndex,
      );
      if (commitProjection("add block", projection)) {
        setMessage(t(locale, "blockAddedMessage"));
        announceAt("announceAdded", projection.workspace, [...targetContainerPath, targetIndex]);
      }
      return;
    }
    const source = pathFromDragData(event.dataTransfer.getData(WORKSPACE_DRAG_TYPE));
    if (source !== undefined) {
      const movedId = blockAtStatementPath(model.workspace, source)?.id;
      const projection = moveBlockInWorkspaceByPath(
        model.workspace,
        source,
        targetContainerPath,
        finalMoveIndex(source, targetContainerPath, targetIndex),
        activeScriptIndex,
      );
      if (commitProjection("move block", projection)) {
        setMessage(t(locale, "programUpdatedMessage"));
        const landed =
          movedId === undefined ? undefined : findPathById(projection.workspace, movedId);
        if (landed !== undefined) announceAt("announceMoved", projection.workspace, landed);
      }
    }
  }

  const ghostMarks = useMemo(
    () => ghostMarksFor(proposalReview, model.workspace),
    [proposalReview, model.workspace],
  );
  const contextualAffectedNodeIds =
    proposalReview?.proposal.affectedNodeIds ?? repeatOffer?.affectedNodeIds ?? [];

  function renderWorkspaceBlocks(containerPath: StatementPath = [], depth = 0): ReactNode {
    const blocks = statementListAtPath(model.workspace, containerPath, activeScriptIndex);
    return blocks.map((block, index) => {
      const path = [...containerPath, index];
      const nodeId = blockNodeIdForPath(model.workspace, path, activeScriptIndex);
      const childPath = childContainerPathFor(path);
      return (
        <ProgramBlockCard
          key={block.id}
          block={block}
          path={path}
          siblingIndex={index}
          siblingTotal={blocks.length}
          depth={depth}
          selected={highlightedNodeId === nodeId}
          suggestionAffected={contextualAffectedNodeIds.includes(nodeId)}
          ghost={ghostMarks.byPath.get(path.join("."))}
          canonicalNodeId={nodeId}
          locale={locale}
          assets={creativeState.assets}
          onSelect={() => setHighlightedNodeId(nodeId)}
          onCommitValue={(value) => editBlockAt(path, block, value)}
          onCommitCondition={(kind) => editIfCondition(path, block, kind)}
          onCommitConditionValue={(value) => editIfConditionValue(path, block, value)}
          onCommitField={(field, value) => editBlockField(path, block, field, value)}
          onMove={(direction) => moveBlockAt(path, direction)}
          onNest={() => nestBlockAt(path)}
          onOutdent={() => outdentBlockAt(path)}
          onDelete={() => deleteBlockAt(path)}
          onDuplicate={() => duplicateBlockAt(path)}
          onDragStart={(event) => dragWorkspaceBlock(event, path)}
          onDropBefore={(event) => dropIntoWorkspace(event, containerPath, index)}
          onDropAfter={(event) => dropIntoWorkspace(event, containerPath, index + 1)}
          onDropInside={(event) =>
            dropIntoWorkspace(
              event,
              childPath,
              statementListAtPath(model.workspace, childPath, activeScriptIndex).length,
            )
          }
        >
          {canContainStatements(block) ? renderWorkspaceBlocks(childPath, depth + 1) : null}
        </ProgramBlockCard>
      );
    });
  }

  const closedPanelIds = PANEL_AREAS.filter((panel) => closedPanels.includes(panel));

  const stageClosed = closedPanels.includes("stage");
  const playControls = (
    <div
      className="play-controls"
      role="group"
      aria-label={t(locale, "run")}
      data-testid="play-controls"
    >
      <button
        type="button"
        className="play-button"
        onClick={runBlocks}
        disabled={status === "running"}
      >
        <span className="play-glyph" aria-hidden="true">
          ⚑
        </span>
        {t(locale, "run")}
      </button>
      <button type="button" onClick={stepBlocks} disabled={status === "running"}>
        {t(locale, "step")}
      </button>
      <button
        type="button"
        className="stop-button"
        onClick={stopRun}
        disabled={status !== "running"}
      >
        <span className="stop-glyph" aria-hidden="true">
          ■
        </span>
        {t(locale, "stop")}
      </button>
      <button type="button" onClick={resetEditor}>
        {t(locale, "reset")}
      </button>
    </div>
  );

  return (
    <main
      className={status === "complete" ? "editor-shell mission-complete" : "editor-shell"}
      data-drag-kind={activeDragKind ?? "none"}
      data-learning-capability={learningDecision?.capability}
      data-generative-needed={learningDecision?.generativeNeeded}
      data-reasoning-tier={learningDecision?.reasoningTier}
      data-provider-selection-bypassed={learningDecision?.providerSelectionBypassed}
      data-code-open={closedPanels.includes("code") ? "false" : "true"}
      data-trace-open={closedPanels.includes("trace") ? "false" : "true"}
      data-companion-open={closedPanels.includes("companion") ? "false" : "true"}
    >
      <header className={topbarOpen ? "topbar topbar-open" : "topbar"}>
        <div className="brand-lockup">
          <div className="brand-identity" aria-label="Agorix">
            <span className="brand-mark" aria-hidden="true">
              <span className="brand-chevron" />
              <span className="brand-block" />
            </span>
            <span className="brand-nameplate">
              <span className="brand-wordmark">Agorix</span>
              <span className="brand-tagline">Code · Create · AI</span>
            </span>
          </div>
          <div className="topbar-copy">
            <p className="eyebrow">{t(locale, "appEyebrow")}</p>
            <h1>{t(locale, "appTitle")}</h1>
            <p className="topbar-subtitle">{t(locale, "appSubtitle")}</p>
          </div>
        </div>
        <div className="topbar-quick-actions">
          <button
            type="button"
            className="topbar-menu-button"
            aria-label={topbarOpen ? "Hide app menu" : "Show app menu"}
            aria-expanded={topbarOpen}
            aria-controls="app-menu"
            onClick={() => setTopbarOpen((open) => !open)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
        <div id="app-menu" className="run-controls" aria-label={t(locale, "run")}>
          <label className="locale-picker">
            <span>{t(locale, "localeLabel")}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.currentTarget.value as Locale)}
            >
              {Object.entries(LOCALE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <AccountUi
            controller={workspace}
            locale={locale}
            createStarterProject={createStarterProject}
            onProjectLoaded={loadAccountProject}
            onRemoveLocalProject={() => removeLocalStoredProject(persistenceRef.current)}
          />
          {stageClosed ? playControls : null}
          <button
            type="button"
            onClick={undoEditor}
            disabled={!history.canUndo}
            aria-label="Undo program edit"
            title="Undo"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redoEditor}
            disabled={!history.canRedo}
            aria-label="Redo program edit"
            title="Redo"
          >
            Redo
          </button>
          <button type="button" onClick={exportProject}>
            {t(locale, "exportProject")}
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()}>
            {t(locale, "importProject")}
          </button>
          <input
            ref={importInputRef}
            className="file-action-input"
            type="file"
            accept=".agorix,application/vnd.agorix.project+json,application/json"
            aria-label={t(locale, "importProjectFile")}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file !== undefined) {
                void importProjectFile(file);
              }
            }}
          />
        </div>
      </header>

      <div
        className="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="editor-announcer"
      >
        {announcement}
      </div>
      <span
        className="visually-hidden"
        data-testid="canonical-hash"
        data-canonical-hash={canonicalHash}
      >
        {canonicalHash}
      </span>
      <p id="workspace-keyboard-hint" className="visually-hidden">
        {t(locale, "blockKeyboardHint")}
      </p>
      <section className="mission-strip" aria-live="polite">
        <div>
          <h2>{t(locale, "missionPrefix", { title: mission.goal.title })}</h2>
          <p>{mission.goal.learnerFacing}</p>
          <p className="world-narrative" data-testid="world-narrative">
            {worldText.narrative}
          </p>
          <label className="world-picker">
            <span>{t(locale, "worldLabel")}</span>
            <select value={worldId} onChange={(event) => setWorldId(event.currentTarget.value)}>
              {WORLDS.map((option) => (
                <option key={option.id} value={option.id}>
                  {worldCopy(option, locale).title}
                </option>
              ))}
            </select>
          </label>
          <div
            className="mission-progress"
            aria-label={t(locale, "missionProgress", { step: missionStep })}
          >
            <span className={missionStep >= 1 ? "progress-dot active" : "progress-dot"}>
              {t(locale, "build")}
            </span>
            <span className={missionStep >= 2 ? "progress-dot active" : "progress-dot"}>
              {t(locale, "run")}
            </span>
            <span className={missionStep >= 3 ? "progress-dot active" : "progress-dot"}>
              {t(locale, "reflect")}
            </span>
          </div>
        </div>
        <div className="state-stack">
          <div className="run-state-row">
            <strong className={`run-state run-state-${status}`}>{message}</strong>
            {status === "complete" || status === "retry" || status === "stopped" ? (
              <ProvenanceLabel kind="runtime-fact" locale={locale} />
            ) : null}
          </div>
          <span className="attempt-readout">
            {t(locale, "attemptsHints", { attempts, hints: hintHistory.length })}
          </span>
          {statements.length === 0 ? (
            <section className="starter-roadmap" aria-label={t(locale, "startHere")}>
              <div>
                <h3>{t(locale, "startHere")}</h3>
                <p>{t(locale, "startPrompt")}</p>
              </div>
              <button
                type="button"
                className="primary-start"
                aria-label={t(locale, "startActionLabel")}
                onClick={() => addBlock("motion_move")}
              >
                {t(locale, "startAddMove")}
              </button>
              <ol>
                <li>{t(locale, "startAddMove")}</li>
                <li>{t(locale, "startRun")}</li>
                <li>{t(locale, "startReflectShort")}</li>
              </ol>
            </section>
          ) : null}
          {agentEnabled && statements.length > 0 && status !== "running" ? (
            <PredictionChip locale={locale} answer={prediction} onAnswer={setPrediction} />
          ) : null}
          {agentEnabled && (status === "complete" || status === "retry") ? (
            <PredictionComparison locale={locale} answer={prediction} reachedGoal={observedGoal} />
          ) : null}
          {tutorResponse === undefined ? null : (
            <div className="compact-ai-feedback" aria-live="polite">
              <strong>{t(locale, "hintLevelOf", { level: tutorResponse.hintLevel })}</strong>
              <span>{tutorResponse.message}</span>
            </div>
          )}
          {persistenceMessage === undefined ? null : (
            <strong className="run-state run-state-error">{persistenceMessage}</strong>
          )}
          {reflectionPrompt === undefined ? null : (
            <div className="reflection-prompt">
              <strong>
                {t(locale, "reflection", {
                  prompt:
                    aiLiteracyActivity && status === "complete"
                      ? t(locale, "aiLiteracyReflection")
                      : reflectionPrompt,
                })}
              </strong>
              <button type="button" onClick={continueFreePlay}>
                {t(locale, "keepBuilding")}
              </button>
            </div>
          )}
          {status === "retry" ? (
            <button type="button" className="secondary-action" onClick={retryMission}>
              {t(locale, "runAgain")}
            </button>
          ) : null}
          {status === "complete" ? (
            <button type="button" className="secondary-action" onClick={continueFreePlay}>
              {t(locale, "freePlay")}
            </button>
          ) : null}
        </div>
      </section>

      <section className="learning-flow" aria-label={t(locale, "appSubtitle")}>
        <article className="flow-step active">
          <strong>{t(locale, "flowTools")}</strong>
          <span>{t(locale, "flowToolsBody")}</span>
        </article>
        <article className={statements.length > 0 ? "flow-step active" : "flow-step"}>
          <strong>{t(locale, "flowBlocks")}</strong>
          <span>{t(locale, "flowBlocksBody")}</span>
        </article>
        <article className={attempts > 0 || status !== "idle" ? "flow-step active" : "flow-step"}>
          <strong>{t(locale, "flowStage")}</strong>
          <span>{t(locale, "flowStageBody")}</span>
        </article>
        <article className="flow-step active">
          <strong>{t(locale, "flowCode")}</strong>
          <span>{t(locale, "flowCodeBody")}</span>
        </article>
        <article
          className={
            hintHistory.length > 0 || learningDecision !== undefined
              ? "flow-step active"
              : "flow-step"
          }
        >
          <strong>{t(locale, "flowAi")}</strong>
          <span>{t(locale, "flowAiBody")}</span>
        </article>
      </section>

      <div className="learning-layout">
        {closedPanels.includes("stage") ? null : (
          <StageView
            world={world}
            frame={activeFrame}
            fallback={fallbackStage}
            locale={locale}
            actors={stageActors}
            {...(creativeState.assets === undefined ? {} : { assets: creativeState.assets })}
            selectedActorId={selectedActorId}
            feedback={stageFeedback}
            {...(highlightedCode.trim() ? { activeCode: highlightedCode.trim() } : {})}
            codePreview={codePreview}
            reducedMotion={reducedMotion}
            runStatus={status}
            onRun={runBlocks}
            onStop={stopRun}
            onActorClick={(actorId) => runRuntimeEvents([{ type: "actorClicked", actorId }])}
            onOpenCode={() => restorePanel("code")}
            panelControls={panelControls("stage")}
            panelProps={panelProps("stage", "stage-panel")}
            actors={actors}
            onActorChange={updateActor}
          />
        )}

        {closedPanels.includes("code") ? null : (
          <section
            className={panelProps("code", "code-panel").className}
            style={panelProps("code", "code-panel").style}
            aria-labelledby="code-title"
          >
            <div className="panel-heading">
              <h2 id="code-title">{t(locale, "code")}</h2>
              <span>{t(locale, "codeBehindBlocks")}</span>
              {panelControls("code")}
            </div>
            <CodePanel program={model.program} highlightedNodeId={highlightedNodeId} />
            {highlightedCode ? (
              <p className="highlight-readout">
                {t(locale, "currentNode", { code: highlightedCode.trim() })}
              </p>
            ) : null}
            {activeStep === undefined ? null : (
              <p className="highlight-readout" data-testid="step-readout">
                {activeStep.timing} · {activeStep.nodeId ?? "complete"}
              </p>
            )}
          </section>
        )}

        {closedPanels.includes("action") ? null : (
          <section
            className={panelProps("action", "action-palette").className}
            style={panelProps("action", "action-palette").style}
            aria-labelledby="action-palette-title"
          >
            <div className="panel-heading">
              <h2 id="action-palette-title">{t(locale, "actionPalette")}</h2>
              <span>{t(locale, "actionsContext")}</span>
              {panelControls("action")}
            </div>
            <ActorPanel
              locale={locale}
              actors={projectActors}
              assets={creativeState.assets}
              stage={creativeState.stage}
              selectedActorId={selectedActorId}
              onSelect={setSelectedActorId}
              onAdd={() => {
                setCreativeState((current) => {
                  const next = addProjectActor(current, locale);
                  const added = next.actors?.[next.actors.length - 1];
                  if (added !== undefined) {
                    setSelectedActorId(added.id);
                  }
                  return next;
                });
              }}
              onChange={updateSelectedActor}
              onStageChange={(patch) =>
                setCreativeState((current) => ({
                  ...current,
                  stage: { ...current.stage, ...patch },
                }))
              }
            />
            <p className="toolbox-intro">{t(locale, "toolboxIntro")}</p>
            {scratchPalette.map((section) => (
              <section key={section.id} className={`scratch-category category-${section.tone}`}>
                <h3>{section.label}</h3>
                <div className="action-list">
                  {section.blocks.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      className={`tool-button tool-${block.id}${block.enabled ? "" : " tool-disabled"}`}
                      aria-label={block.label}
                      draggable={block.enabled}
                      disabled={!block.enabled}
                      data-category={section.tone}
                      onDragStart={(event) => {
                        if (block.type !== undefined) dragTool(event, block.type);
                      }}
                      onDragEnd={clearDragState}
                      onClick={() => {
                        if (block.type !== undefined) addBlock(block.type);
                      }}
                    >
                      <span className="tool-glyph" aria-hidden="true">
                        {block.glyph}
                      </span>
                      <span className="tool-copy">
                        <strong>{block.label}</strong>
                        <small aria-hidden="true">{block.detail}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            <section className="ai-tool-shelf" aria-label={t(locale, "aiToolShelf")}>
              <div className="ai-native-strip">
                <span className="ai-orb" aria-hidden="true">
                  AI
                </span>
                <div>
                  <h3>{t(locale, "aiToolShelf")}</h3>
                  <p>{t(locale, "aiNativeAssistBody")}</p>
                </div>
                {closedPanelIds.includes("companion") ? (
                  <button type="button" onClick={() => restorePanel("companion")}>
                    {PANEL_LABELS.companion}
                  </button>
                ) : null}
              </div>
              <div className="action-list ai-action-list">
                <button type="button" aria-label="Use AI hint tool" onClick={requestHint}>
                  <span className="tool-glyph" aria-hidden="true">
                    AI
                  </span>
                  <span className="tool-copy">
                    <strong>{t(locale, "aiToolHint")}</strong>
                    <small aria-hidden="true">{t(locale, "modeAiHint")}</small>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Use AI challenge tool"
                  onClick={previewImperfectAiProposal}
                >
                  <span className="tool-glyph" aria-hidden="true">
                    ?
                  </span>
                  <span className="tool-copy">
                    <strong>{t(locale, "aiToolChallenge")}</strong>
                    <small aria-hidden="true">{t(locale, "philosophyAiBody")}</small>
                  </span>
                </button>
                <button type="button" aria-label="Use AI explain tool" onClick={revealCompanion}>
                  <span className="tool-glyph" aria-hidden="true">
                    fx
                  </span>
                  <span className="tool-copy">
                    <strong>{t(locale, "aiToolExplain")}</strong>
                    <small aria-hidden="true">{t(locale, "modeCodeHint")}</small>
                  </span>
                </button>
              </div>
            </section>
          </section>
        )}

        {closedPanels.includes("trace") ? null : (
          <TracePanel
            trace={learnerTrace}
            activeTrace={activeTrace}
            locale={locale}
            panelControls={panelControls("trace")}
            panelProps={panelProps("trace", "trace-panel")}
          />
        )}

        {closedPanels.includes("program") ? null : (
          <section
            className={panelProps("program", "program-panel").className}
            style={panelProps("program", "program-panel").style}
            aria-labelledby="workspace-title"
          >
            <div className="panel-heading">
              <h2 id="workspace-title">
                {activeScript === undefined
                  ? t(locale, "whenRun")
                  : scriptLabelFor(activeScript, locale)}
              </h2>
              <span>{t(locale, "blockCount", { count: activeScriptBlockCount })}</span>
              {panelControls("program")}
            </div>
            <div className="script-switcher" aria-label="Event scripts">
              {model.workspace.scripts.map((script, index) => (
                <button
                  key={script.id}
                  type="button"
                  className={index === activeScriptIndex ? "active" : ""}
                  aria-pressed={index === activeScriptIndex}
                  onClick={() => setActiveScriptIndex(index)}
                >
                  {scriptLabelFor(script, locale)}
                </button>
              ))}
              <button type="button" onClick={() => addEventScript("event_on_key_pressed")}>
                {locale === "es" ? "+ tecla" : "+ key"}
              </button>
              <button type="button" onClick={() => addEventScript("event_on_actor_clicked")}>
                {locale === "es" ? "+ click" : "+ click"}
              </button>
              <button type="button" onClick={() => addEventScript("event_on_message")}>
                {locale === "es" ? "+ mensaje" : "+ message"}
              </button>
            </div>
            {editableTriggerFieldFor(activeScript) === "key" ? (
              <label className="trigger-editor">
                <span>{locale === "es" ? "Tecla" : "Key"}</span>
                <select
                  value={
                    typeof activeScript?.trigger.fields?.key === "string"
                      ? activeScript.trigger.fields.key
                      : "Space"
                  }
                  onChange={(event) => editActiveTriggerField("key", event.currentTarget.value)}
                >
                  {KEY_TRIGGER_OPTIONS.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {editableTriggerFieldFor(activeScript) === "message" ? (
              <label className="trigger-editor">
                <span>{locale === "es" ? "Mensaje" : "Message"}</span>
                <input
                  key={activeScript?.id}
                  type="text"
                  defaultValue={
                    typeof activeScript?.trigger.fields?.message === "string"
                      ? activeScript.trigger.fields.message
                      : "go"
                  }
                  maxLength={80}
                  onBlur={(event) => editActiveTriggerField("message", event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                />
              </label>
            ) : null}
            <div
              className="block-stack"
              onDragOver={autoScrollWorkspaceOnDrag}
              onDrop={(event) => dropIntoWorkspace(event)}
              onDragEnd={clearDragState}
              data-drop-state={activeDragKind === undefined ? "idle" : "ready"}
            >
              {statements.length === 0 ? (
                <div className="empty-state empty-start-card">
                  <strong>{t(locale, "emptyStateTitle")}</strong>
                  <span>{t(locale, "emptyStateBody")}</span>
                  <button
                    type="button"
                    aria-label={t(locale, "startActionLabel")}
                    onClick={() => addBlock("motion_move")}
                  >
                    {t(locale, "startAddMove")}
                  </button>
                </div>
              ) : null}
              {renderWorkspaceBlocks()}
              <GhostAddedBlocks texts={ghostMarks.added} locale={locale} />
            </div>
          </section>
        )}

        {closedPanels.includes("companion") ? null : (
          <aside
            className={panelProps("companion", "companion-panel").className}
            style={panelProps("companion", "companion-panel").style}
            aria-labelledby="companion-title"
          >
            <div className="panel-heading">
              <h2 id="companion-title">{t(locale, "proposalReview")}</h2>
              <span>
                {tutorResponse === undefined
                  ? t(locale, "aiCoachStatus")
                  : t(locale, "hintLevel", { level: tutorResponse.hintLevel })}
              </span>
              {panelControls("companion")}
            </div>
            <AgentCompanion
              locale={locale}
              enabled={agentEnabled}
              mood={companionMood({
                enabled: agentEnabled,
                hasOffer: firstStepOffer !== undefined || repeatOffer !== undefined,
                reviewing: proposalReview !== undefined,
              })}
              message={
                proposalReview !== undefined
                  ? proposalMessage
                  : firstStepOffer !== undefined
                    ? t(locale, "firstStepTitle")
                    : repeatOffer !== undefined
                      ? t(locale, "repeatSuggestionTitle", {
                          count: detectRepeatPattern(model.program)?.count ?? 0,
                        })
                      : undefined
              }
              onToggle={toggleAgent}
            />
            <div className="ai-coach-card">
              <div className="ai-coach-card-header">
                <strong>{t(locale, "aiCoachMode")}</strong>
                <button
                  type="button"
                  className="ai-connect-button"
                  aria-expanded={aiConnectionOpen}
                  onClick={() => setAiConnectionOpen((current) => !current)}
                >
                  {t(locale, "aiConnectAction")}
                </button>
              </div>
              <span>{t(locale, "aiCoachBody")}</span>
              <small>{t(locale, "aiCoachStatus")}</small>
              <div className="laya-signal" aria-label={t(locale, "layaSignal")}>
                <strong>{t(locale, "layaSignal")}</strong>
                <span>{layaSignal}</span>
              </div>
              {aiConnectionOpen ? (
                <section className="ai-connect-panel" aria-label={t(locale, "aiConnectTitle")}>
                  <strong>{t(locale, "aiConnectTitle")}</strong>
                  <p>{t(locale, "aiConnectBody")}</p>
                  <dl>
                    <div>
                      <dt>{t(locale, "aiConnectProvider")}</dt>
                      <dd>{t(locale, "aiConnectProviderValue")}</dd>
                    </div>
                  </dl>
                  <span>{t(locale, "aiConnectConfigHint")}</span>
                  <button type="button" onClick={() => setAiConnectionOpen(false)}>
                    {t(locale, "aiConnectClose")}
                  </button>
                </section>
              ) : null}
            </div>
            <div className="coach-nudge" aria-live="polite">
              <strong>{t(locale, "aiNextMove")}</strong>
              <span>
                {statements.length === 0
                  ? t(locale, "aiNextAddMove")
                  : status === "idle" || status === "freeplay"
                    ? t(locale, "aiNextRun")
                    : status === "retry"
                      ? t(locale, "aiNextRetry")
                      : t(locale, "aiNextReflect")}
              </span>
            </div>
            <p aria-live="polite">
              {proposalMessage ?? tutorResponse?.message ?? t(locale, "tutorIntro")}
            </p>
            {proposalMessage === t(locale, "proposalAccepted") ? (
              <ProvenanceLabel kind="accepted" locale={locale} />
            ) : null}
            {agentEnabled ? (
              <IntentDialogue
                locale={locale}
                program={model.program}
                mission={mission}
                selectedNodeIds={highlightedNodeId === undefined ? [] : [highlightedNodeId]}
              />
            ) : null}
            {firstStepOffer === undefined ? null : (
              <div
                className="ai-welcome"
                data-testid="ai-welcome"
                data-decision={firstStepDecision?.action}
              >
                <strong>{t(locale, "firstStepTitle")}</strong>
                <p>{t(locale, "firstStepBody")}</p>
                <div className="tutor-actions">
                  <button type="button" onClick={tryFirstStep}>
                    {t(locale, "firstStepTry")}
                  </button>
                  <button type="button" onClick={() => setFirstStepDeclined(true)}>
                    {t(locale, "firstStepNo")}
                  </button>
                </div>
              </div>
            )}
            <div className="tutor-actions">
              {agentEnabled ? (
                <button type="button" onClick={previewImperfectAiProposal}>
                  {t(locale, "aiLiteracyActivity")}
                </button>
              ) : null}
              <button type="button" onClick={() => setComparisonOpen((open) => !open)}>
                {t(locale, "compareOpen")}
              </button>
              <button type="button" onClick={requestHint}>
                {t(locale, "getHint")}
              </button>
              <span className="hint-meter">
                {t(locale, "hintMeter", { count: hintHistory.length })}
              </span>
            </div>
            {comparisonOpen ? (
              <ModelComparison locale={locale} onClose={() => setComparisonOpen(false)} />
            ) : null}
            {proposalCard === undefined || repeatReviewActive ? null : (
              <div className="proposal-card" data-testid="proposal-preview">
                <ProvenanceLabel kind="suggestion" locale={locale} />
                <strong>{proposalCard.title}</strong>
                <p>{proposalCard.rationale}</p>
                <p>
                  {t(locale, "proposalBaseHash", {
                    hash: proposalReview?.proposal.baseProgramHash ?? "",
                  })}
                </p>
                {proposalScopeRows.length === 0 &&
                proposalCard.expectedRuntimeEvidence.length === 0 ? null : (
                  <ul className="proposal-evidence">
                    {proposalScopeRows.map((row) => (
                      <li key={row.key}>{t(locale, row.label, { ids: row.ids.join(", ") })}</li>
                    ))}
                    {proposalCard.expectedRuntimeEvidence.map((evidence) => (
                      <li key={evidence.id}>
                        {t(locale, "proposalExpectedEvidence", {
                          description: evidence.description,
                        })}
                      </li>
                    ))}
                  </ul>
                )}
                <ul>
                  {proposalCard.changes.map((change) => (
                    <li key={change.nodeId}>
                      {change.beforeText ?? ""} → {change.afterText ?? ""}
                    </li>
                  ))}
                </ul>
                {aiLiteracyActivity ? (
                  <div className="ai-literacy-evaluation">
                    <button type="button" onClick={recordAiPrediction}>
                      {t(locale, "aiLiteracyPredict")}
                    </button>
                    {aiPredictionRecorded ? (
                      <span data-testid="ai-prediction-recorded">
                        {t(locale, "aiLiteracyPredictionRecorded")}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="tutor-actions">
                  <button type="button" onClick={rejectDeterministicProposal}>
                    {t(locale, "rejectProposal")}
                  </button>
                  <button
                    type="button"
                    onClick={acceptDeterministicProposal}
                    disabled={aiLiteracyActivity && !aiPredictionRecorded}
                  >
                    {t(locale, "acceptProposal")}
                  </button>
                </div>
              </div>
            )}
            {tutorResponse === undefined ? null : (
              <p className="hint-history">
                {t(locale, "hintLevelOf", { level: tutorResponse.hintLevel })}
              </p>
            )}
          </aside>
        )}
      </div>
      {!stepping || activeTrace === undefined ? null : (
        <StepCard
          item={activeTrace}
          position={frameIndex + 1}
          total={learnerTrace.length}
          canAdvance={status === "stopped"}
          onNext={stepBlocks}
          locale={locale}
        />
      )}
      {repeatOffer === undefined && !(repeatReviewActive && proposalCard !== undefined) ? null : (
        <section
          className="contextual-suggestion"
          aria-label={t(locale, "repeatSuggestionTitle", {
            count: detectRepeatPattern(model.program)?.count ?? 0,
          })}
          data-testid="repeat-suggestion"
          data-decision={repeatDecision?.action ?? "offer"}
          data-decision-reason={repeatDecision?.reason ?? "repeated-steps-detected"}
        >
          <ProvenanceLabel kind="suggestion" locale={locale} />
          {repeatReviewActive && proposalCard !== undefined ? (
            <div data-testid="proposal-preview">
              <strong>{proposalCard.title}</strong>
              <p>{proposalCard.rationale}</p>
              {proposalScopeRows.length === 0 &&
              proposalCard.expectedRuntimeEvidence.length === 0 ? null : (
                <ul className="proposal-evidence">
                  {proposalScopeRows.map((row) => (
                    <li key={row.key}>{t(locale, row.label, { ids: row.ids.join(", ") })}</li>
                  ))}
                  {proposalCard.expectedRuntimeEvidence.map((evidence) => (
                    <li key={evidence.id}>
                      {t(locale, "proposalExpectedEvidence", {
                        description: evidence.description,
                      })}
                    </li>
                  ))}
                </ul>
              )}
              <ul>
                {proposalCard.changes.map((change) => (
                  <li key={change.nodeId}>
                    {change.beforeText ?? ""} → {change.afterText ?? ""}
                  </li>
                ))}
              </ul>
              <div className="tutor-actions">
                <button type="button" onClick={rejectDeterministicProposal}>
                  {t(locale, "rejectProposal")}
                </button>
                <button type="button" onClick={acceptDeterministicProposal}>
                  {t(locale, "acceptProposal")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <strong>
                {t(locale, "repeatSuggestionTitle", {
                  count: detectRepeatPattern(model.program)?.count ?? 0,
                })}
              </strong>
              <p>{t(locale, "repeatSuggestionBody")}</p>
              <div className="tutor-actions">
                <button type="button" onClick={tryRepeatSuggestion}>
                  {t(locale, "repeatSuggestionTry")}
                </button>
                <button type="button" onClick={changeRepeatSuggestion}>
                  {t(locale, "repeatSuggestionChange")}
                </button>
                <button type="button" onClick={declineRepeatSuggestion}>
                  {t(locale, "repeatSuggestionNo")}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
