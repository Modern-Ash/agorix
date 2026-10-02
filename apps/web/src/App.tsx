import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import type { ProjectMetadata } from "@agorix/persistence";
import type { ProjectProgram } from "@agorix/program-model";
import { POC_TOOLBOX, type BlockNode } from "@agorix/block-editor";
import { createMissionRunFeedback, getLocalizedFirstMission } from "@agorix/curriculum";
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
import { decideProactiveSuggestion } from "@agorix/learning-decision-plane";
import {
  acceptProposal,
  createProgramProposal,
  createProposalReview,
  createRepeatPatternProposal,
  detectRepeatPattern,
  createWebProposalCardView,
  programSemanticHash,
  rejectProposal,
  type ProposalReview,
} from "@agorix/proposals";
import { runProgram, type RunResult, type WorldState } from "@agorix/runtime";
import {
  executionStepsFromRuntimeObservations,
  framesFromRuntimeObservations,
  learnerTraceFromExecutionSteps,
  resetStageSession,
  type ExecutionStep,
  type LearnerTraceItem,
  type ObservationFrame,
  type StageState,
} from "@agorix/stage";
import {
  addBlockToWorkspace,
  blockNodeId,
  codeSliceForNode,
  createEditorModel,
  createEditorModelFromProgram,
  deleteBlockFromWorkspace,
  editNumericBlockField,
  moveBlockInWorkspace,
  resetWorkspace,
  type AddableBlockType,
  type EditorModel,
  type EditorProjection,
} from "./editorModel.js";
import {
  createBrowserProjectPersistence,
  loadEditorProject,
  saveEditorProject,
  type LoadedEditorProject,
  type ProjectPersistence,
} from "./projectStorage.js";
import { LOCALE_LABELS, t, type Locale, type MessageKey } from "./i18n.js";
import { ProvenanceLabel } from "./ProvenanceLabel.js";
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
): ProjectMetadata {
  return {
    createdAt,
    updatedAt: new Date().toISOString(),
    missionProgress: programBlockCount > 0 ? 1 : 0,
    hintLevel: 0,
    locale,
  };
}

function countProgramBlocks(model: EditorModel): number {
  return model.program.scripts.reduce((total, script) => total + script.statements.length, 0);
}

function initialWorldFor(model: EditorModel): WorldState {
  return {
    sprite: {
      x: model.stage.initial.sprite.x,
      y: model.stage.initial.sprite.y,
      heading: model.stage.initial.sprite.heading,
    },
    goal: { x: model.stage.initial.goal.x, y: model.stage.initial.goal.y },
  };
}

function initialProjectFor(
  persistence: ProjectPersistence | undefined,
): LoadedEditorProject & { readonly model: EditorModel } {
  const loaded = loadEditorProject(persistence);
  return { ...loaded, model: loaded.model ?? createEditorModel() };
}

function numericFieldFor(block: BlockNode): "steps" | "degrees" | "count" | undefined {
  switch (block.type) {
    case "motion_move":
      return "steps";
    case "motion_turn":
      return "degrees";
    case "control_repeat":
      return "count";
    default:
      return undefined;
  }
}

function displayNameForType(type: string, locale: Locale): string {
  switch (type) {
    case "motion_move":
      return t(locale, "move");
    case "motion_turn":
      return t(locale, "turn");
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

function fieldLabelFor(field: "steps" | "degrees" | "count", locale: Locale): string {
  switch (field) {
    case "steps":
      return t(locale, "steps");
    case "degrees":
      return t(locale, "degrees");
    case "count":
      return t(locale, "fieldCount");
  }
}

function sectionNameFor(name: string, locale: Locale): string {
  switch (name) {
    case "Move":
      return t(locale, "toolboxMove");
    case "Repeat & Decide":
      return t(locale, "toolboxRepeatDecide");
    default:
      return name;
  }
}

function blockPurposeFor(type: string, locale: Locale): string {
  switch (type) {
    case "motion_move":
      return t(locale, "toolPurposeMove");
    case "motion_turn":
      return t(locale, "toolPurposeTurn");
    case "control_repeat":
      return t(locale, "toolPurposeRepeat");
    case "control_if":
      return t(locale, "toolPurposeIfGoal");
    default:
      return type;
  }
}

function blockGlyphFor(type: string): string {
  switch (type) {
    case "motion_move":
      return "GO";
    case "motion_turn":
      return "90";
    case "control_repeat":
      return "xN";
    case "control_if":
      return "IF";
    default:
      return "<>";
  }
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
          enabled: false,
        },
        {
          id: "looks_think",
          label: es ? "Pensar" : "Think",
          detail: es ? "Idea visible" : "Thought bubble",
          glyph: "…",
          enabled: false,
        },
        {
          id: "looks_show",
          label: es ? "Mostrar" : "Show",
          detail: es ? "Aparece" : "Become visible",
          glyph: "👁",
          enabled: false,
        },
        {
          id: "looks_hide",
          label: es ? "Ocultar" : "Hide",
          detail: es ? "Desaparece" : "Become hidden",
          glyph: "—",
          enabled: false,
        },
        {
          id: "looks_costume",
          label: es ? "Disfraz" : "Costume",
          detail: es ? "Cambia look" : "Change look",
          glyph: "◐",
          enabled: false,
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
          enabled: false,
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
          enabled: false,
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
          glyph: "📣",
          enabled: false,
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
          enabled: false,
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
          enabled: false,
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
          enabled: false,
        },
        {
          id: "var_change",
          label: es ? "Cambiar variable" : "Change variable",
          detail: es ? "Suma/resta" : "Add or subtract",
          glyph: "+=",
          enabled: false,
        },
        {
          id: "var_show",
          label: es ? "Mostrar variable" : "Show variable",
          detail: es ? "Ver dato" : "See data",
          glyph: "👁",
          enabled: false,
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

function blockValue(block: BlockNode, field: "steps" | "degrees" | "count"): number {
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
  locale,
  panelControls,
  panelProps,
}: {
  program: ProjectProgram;
  highlightedNodeId: string | undefined;
  locale: Locale;
  panelControls?: ReactNode;
  panelProps?: PanelChromeProps;
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

function StageView({
  frame,
  fallback,
  locale,
  panelControls,
  panelProps,
}: {
  frame: ObservationFrame | undefined;
  fallback: StageState;
  locale: Locale;
  panelControls?: ReactNode;
  panelProps?: PanelChromeProps;
}) {
  const state = frame?.state ?? fallback;
  const sprite = state.sprite;
  const goal = state.goal;
  const viewport = state.viewport;
  return (
    <section
      className={panelProps?.className ?? "stage-panel"}
      style={panelProps?.style}
      aria-labelledby="stage-title"
    >
      <div className="panel-heading">
        <h2 id="stage-title">{t(locale, "stage")}</h2>
        <span className="status-pill">
          {frame?.reachedGoal ? t(locale, "evidenceGoalReached") : t(locale, "evidenceReachGoal")}
        </span>
        {panelControls}
      </div>
      <svg
        className="stage-canvas"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        role="img"
        aria-label={t(locale, "stageAria")}
      >
        <rect width={viewport.width} height={viewport.height} rx="14" />
        <line x1="24" y1="128" x2="240" y2="128" />
        <circle className="goal" cx={goal.x} cy={goal.y} r={goal.radius} />
        <g transform={`translate(${sprite.x} ${sprite.y}) rotate(${sprite.heading})`}>
          <circle className="sprite" r={sprite.radius} />
          <path d="M 4 0 L 16 -6 L 16 6 Z" />
        </g>
      </svg>
    </section>
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

function blockToneFor(type: BlockNode["type"]): string {
  if (type.startsWith("motion_")) return "motion";
  if (type.startsWith("control_")) return "control";
  return "logic";
}

function blockShapeFor(type: BlockNode["type"]): string {
  return type === "control_if" ? "predicate" : "command";
}

function ProgramBlockCard({
  block,
  index,
  total,
  selected,
  locale,
  onSelect,
  onCommitValue,
  onMove,
  onDelete,
  onDragStart,
  onDropBefore,
}: {
  block: BlockNode;
  index: number;
  total: number;
  selected: boolean;
  locale: Locale;
  onSelect: () => void;
  onCommitValue: (value: number) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>) => void;
  onDropBefore: (event: ReactDragEvent<HTMLElement>) => void;
}) {
  const field = numericFieldFor(block);
  const currentValue = field === undefined ? undefined : blockValue(block, field);
  const [draftValue, setDraftValue] = useState(() =>
    currentValue === undefined ? "" : String(currentValue),
  );

  useEffect(() => {
    if (currentValue !== undefined) {
      setDraftValue(String(currentValue));
    }
  }, [currentValue]);

  function submitValue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) {
      setDraftValue(currentValue === undefined ? "" : String(currentValue));
      return;
    }
    onCommitValue(parsed);
  }

  function cancelValue() {
    setDraftValue(currentValue === undefined ? "" : String(currentValue));
  }

  const displayName = displayNameFor(block, locale);
  const blockTone = blockToneFor(block.type);
  const blockShape = blockShapeFor(block.type);

  return (
    <article
      className={`block-card block-${blockTone} block-shape-${blockShape}${
        selected ? " active" : ""
      }`}
      aria-label={t(locale, "blockLabel", { name: displayName })}
      data-interaction-model="touch-first drag-drop keyboard-reorder"
      data-block-type={block.type}
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDropBefore}
    >
      <div className="scratch-block-main">
        <button type="button" className="block-title" onClick={onSelect}>
          <span className="block-grip" aria-hidden="true" />
          <span>{displayName}</span>
        </button>
        {field === undefined ? (
          <span className="block-slot block-slot-predicate">{t(locale, "touchingGoal")}</span>
        ) : (
          <form className="value-editor" onSubmit={submitValue}>
            <label>
              <span>{fieldLabelFor(field, locale)}</span>
              <input
                type="number"
                inputMode="numeric"
                value={draftValue}
                aria-label={`${displayName} ${fieldLabelFor(field, locale)}`}
                onChange={(event) => setDraftValue(event.currentTarget.value)}
              />
            </label>
            <div className="value-actions">
              <button
                type="submit"
                aria-label={t(locale, "applyValue")}
                title={t(locale, "applyValue")}
              >
                ✓
              </button>
              <button
                type="button"
                aria-label={t(locale, "cancelEdit")}
                title={t(locale, "cancelEdit")}
                onClick={cancelValue}
              >
                ↺
              </button>
            </div>
          </form>
        )}
      </div>
      {block.type === "control_if" ? (
        <p className="block-note">{t(locale, "blockNoteIf")}</p>
      ) : null}
      <div className="block-actions" aria-label={t(locale, "cardActions")}>
        {index === 0 ? null : (
          <button
            type="button"
            aria-label={t(locale, "up")}
            title={t(locale, "up")}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
        )}
        {index === total - 1 ? null : (
          <button
            type="button"
            aria-label={t(locale, "down")}
            title={t(locale, "down")}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
        )}
        <button
          type="button"
          aria-label={t(locale, "delete")}
          title={t(locale, "delete")}
          onClick={onDelete}
        >
          ×
        </button>
      </div>
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

export function App() {
  const persistenceRef = useRef<ProjectPersistence | undefined>(createBrowserProjectPersistence());
  const initialProjectRef = useRef<ReturnType<typeof initialProjectFor>>();
  if (initialProjectRef.current === undefined) {
    initialProjectRef.current = initialProjectFor(persistenceRef.current);
  }

  const [model, setModel] = useState<EditorModel>(() => initialProjectRef.current!.model);
  const [createdAt, setCreatedAt] = useState(
    () => initialProjectRef.current!.metadata?.createdAt ?? new Date().toISOString(),
  );
  const [locale, setLocale] = useState<Locale>(() =>
    initialProjectRef.current!.metadata?.locale === "es" ? "es" : "en",
  );
  const [status, setStatus] = useState<RunStatus>("idle");
  const [message, setMessage] = useState(
    () => initialProjectRef.current!.message ?? t(locale, "emptyRunMessage"),
  );
  const [persistenceMessage, setPersistenceMessage] = useState<string | undefined>(
    () => initialProjectRef.current!.message,
  );
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | undefined>();
  const [frameIndex, setFrameIndex] = useState(0);
  const [frames, setFrames] = useState<readonly ObservationFrame[]>([]);
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
  const [repeatDeclines, setRepeatDeclines] = useState(0);
  const [learningDecision, setLearningDecision] = useState<
    WebLearningDecisionDiagnostics | undefined
  >();
  const [aiLiteracyActivity, setAiLiteracyActivity] = useState(false);
  const [aiPredictionRecorded, setAiPredictionRecorded] = useState(false);
  const timerRef = useRef<number | undefined>();
  const [panelAreas, setPanelAreas] = useState<Record<PanelId, PanelArea>>(DEFAULT_PANEL_AREAS);
  const [collapsedPanels, setCollapsedPanels] = useState<readonly PanelId[]>([]);
  const [closedPanels, setClosedPanels] = useState<readonly PanelId[]>([]);
  const [maximizedPanel, setMaximizedPanel] = useState<PanelId | undefined>(undefined);
  const [aiConnectionOpen, setAiConnectionOpen] = useState(false);

  const mission = useMemo(() => getLocalizedFirstMission(locale), [locale]);
  const statements = model.workspace.scripts[0]?.statements ?? [];
  const activeFrame = executionSteps[frameIndex]?.frame ?? frames[frameIndex];
  const activeStep = executionSteps[frameIndex];
  const activeTrace = learnerTrace[frameIndex];
  const highlightedCode =
    highlightedNodeId === undefined ? "" : codeSliceForNode(model, highlightedNodeId);
  const canonicalHash = programSemanticHash(model.program);
  const proposalCard =
    proposalReview === undefined ? undefined : createWebProposalCardView(proposalReview);
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
  const repeatDecision =
    repeatProposal === undefined || proposalReview !== undefined
      ? undefined
      : decideProactiveSuggestion({
          kind: "repeat-pattern",
          occurrences: detectRepeatPattern(model.program)?.count ?? 0,
          running: status === "running",
          declinedForCurrentProgram: dismissedRepeatHash === canonicalHash,
          declinedCount: repeatDeclines,
        });
  const repeatOffer = repeatDecision?.action === "offer" ? repeatProposal : undefined;
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

  const toolbox = useMemo(
    () =>
      POC_TOOLBOX.map((section) => ({
        ...section,
        blocks: section.blocks.filter((block) => isAddable(block.type)),
      })).filter((section) => section.blocks.length > 0),
    [],
  );
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
    if (initialProjectRef.current?.message !== undefined) {
      return;
    }
    const metadata = createProjectMetadata(createdAt, countProgramBlocks(model), locale);
    setPersistenceMessage(saveEditorProject(persistenceRef.current, model.program, metadata));
  }, [createdAt, locale, model.program]);

  function applyProjection(projection: EditorProjection) {
    clearRunTimer();
    initialProjectRef.current = { ...initialProjectRef.current!, message: undefined };
    setPersistenceMessage(undefined);
    setModel((current) => mergeProjection(current, projection));
    setHighlightedNodeId(undefined);
    setFrames([]);
    setExecutionSteps([]);
    setLearnerTrace([]);
    setFrameIndex(0);
    setTutorResponse(undefined);
    setLastRunResult(undefined);
    setReflectionPrompt(undefined);
    setProposalReview(undefined);
    setProposalMessage(undefined);
    setLearningDecision(undefined);
    setStatus("idle");
  }

  function addBlock(type: AddableBlockType) {
    applyProjection(addBlockToWorkspace(model.workspace, type));
    setMessage(t(locale, "blockAddedMessage"));
  }

  function editBlock(index: number, block: BlockNode, value: number) {
    const field = numericFieldFor(block);
    if (field === undefined) {
      return;
    }
    applyProjection(editNumericBlockField(model.workspace, index, field, value));
    setMessage(t(locale, "programUpdatedMessage"));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= statements.length) {
      return;
    }
    applyProjection(moveBlockInWorkspace(model.workspace, index, nextIndex));
    setMessage(t(locale, "programUpdatedMessage"));
  }

  function deleteBlock(index: number) {
    applyProjection(deleteBlockFromWorkspace(model.workspace, index));
    setMessage(t(locale, "programUpdatedMessage"));
  }

  function clearRunTimer() {
    if (timerRef.current !== undefined) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }

  function stopRun() {
    clearRunTimer();
    setStatus("stopped");
    setMessage(t(locale, "stopped"));
  }

  function resetEditor() {
    stopRun();
    const projection = resetWorkspace();
    initialProjectRef.current = { ...initialProjectRef.current!, message: undefined };
    setPersistenceMessage(undefined);
    setCreatedAt(new Date().toISOString());
    setModel((current) => ({
      ...mergeProjection(current, projection),
      stage: resetStageSession(current.stage),
    }));
    setFrames([]);
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

  function createRuntimeFrames() {
    const result = runProgram(model.program, initialWorldFor(model), {
      collectObservations: true,
      stopAfterSteps: 24,
    });
    const nextFrames = framesFromRuntimeObservations(result.observations);
    const nextSteps = executionStepsFromRuntimeObservations(result.observations);
    const nextTrace = learnerTraceFromExecutionSteps(nextSteps, "beginner");
    setLastRunResult(result);
    setFrames(nextFrames);
    setExecutionSteps(nextSteps);
    setLearnerTrace(nextTrace);
    return { result, nextFrames, nextSteps, nextTrace };
  }

  function runBlocks() {
    if (status === "running") {
      return;
    }
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

  function previewDeterministicProposal() {
    try {
      const proposal = createProgramProposal({
        id: "deterministic-move-160",
        baseProgram: model.program,
        source: { kind: "deterministic-scaffold", capability: "transparency-e2e" },
        purpose: t(locale, "proposalPurpose"),
        rationale: t(locale, "proposalRationale"),
        affectedNodeIds: ["scripts[0]/statements[0]"],
        operations: [
          {
            type: "replaceStatement",
            nodeId: "scripts[0]/statements[0]",
            statement: { type: "move", steps: 160 },
          },
        ],
      });
      const review = createProposalReview(model.program, proposal);
      setProposalReview(review);
      setProposalMessage(t(locale, "proposalPreviewReady"));
      setHighlightedNodeId(review.proposal.affectedNodeIds[0]);
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
    } catch {
      setStatus("error");
      setMessage(t(locale, "runSetupError"));
    }
  }

  function recordAiPrediction() {
    setAiPredictionRecorded(true);
    setProposalMessage(t(locale, "aiLiteracyPredictionRecorded"));
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
    applyProjection(nextModel);
    setProposalReview(undefined);
    setProposalMessage(t(locale, "proposalAccepted"));
    setMessage(t(locale, "codeBehindBlocks"));
  }

  function requestHint() {
    try {
      const result =
        lastRunResult ??
        runProgram(model.program, initialWorldFor(model), {
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

  function moveBlockToIndex(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= statements.length) {
      return;
    }
    const clamped = Math.max(0, Math.min(toIndex, statements.length - 1));
    applyProjection(moveBlockInWorkspace(model.workspace, fromIndex, clamped));
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
  }

  function dragWorkspaceBlock(event: ReactDragEvent<HTMLElement>, index: number) {
    event.dataTransfer.setData(WORKSPACE_DRAG_TYPE, String(index));
    event.dataTransfer.effectAllowed = "move";
  }

  function dropIntoWorkspace(event: ReactDragEvent<HTMLElement>, targetIndex = statements.length) {
    event.preventDefault();
    const type = event.dataTransfer.getData(BLOCK_DRAG_TYPE);
    if (isAddable(type)) {
      applyProjection(addBlockToWorkspace(model.workspace, type));
      setMessage(t(locale, "blockAddedMessage"));
      return;
    }
    const source = Number(event.dataTransfer.getData(WORKSPACE_DRAG_TYPE));
    if (Number.isInteger(source)) {
      moveBlockToIndex(
        source,
        targetIndex >= statements.length ? statements.length - 1 : targetIndex,
      );
    }
  }

  const closedPanelIds = PANEL_AREAS.filter((panel) => closedPanels.includes(panel));

  return (
    <main
      className={status === "complete" ? "editor-shell mission-complete" : "editor-shell"}
      data-learning-capability={learningDecision?.capability}
      data-generative-needed={learningDecision?.generativeNeeded}
      data-reasoning-tier={learningDecision?.reasoningTier}
      data-provider-selection-bypassed={learningDecision?.providerSelectionBypassed}
    >
      <header className="topbar">
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
        <div className="run-controls" aria-label={t(locale, "run")}>
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
          <button type="button" onClick={runBlocks} disabled={status === "running"}>
            {t(locale, "run")}
          </button>
          <button type="button" onClick={stepBlocks} disabled={status === "running"}>
            {t(locale, "step")}
          </button>
          <button type="button" onClick={stopRun} disabled={status !== "running"}>
            {t(locale, "stop")}
          </button>
          <button type="button" onClick={resetEditor}>
            {t(locale, "reset")}
          </button>
        </div>
      </header>

      <section className="mission-strip" aria-live="polite">
        <div>
          <h2>{t(locale, "missionPrefix", { title: mission.goal.title })}</h2>
          <p>{mission.goal.learnerFacing}</p>
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

      {closedPanelIds.length > 0 ? (
        <div className="panel-dock" aria-label="Closed panels">
          {closedPanelIds.map((panel) => (
            <button key={panel} type="button" onClick={() => restorePanel(panel)}>
              {PANEL_LABELS[panel]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="learning-layout">
        {closedPanels.includes("stage") ? null : (
          <StageView
            frame={activeFrame}
            fallback={model.stage.current}
            locale={locale}
            panelControls={panelControls("stage")}
            panelProps={panelProps("stage", "stage-panel")}
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
            <CodePanel
              program={model.program}
              highlightedNodeId={highlightedNodeId}
              locale={locale}
            />
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
              <h3>{t(locale, "aiToolShelf")}</h3>
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
              <h2 id="workspace-title">{t(locale, "whenRun")}</h2>
              <span>{t(locale, "blockCount", { count: statements.length })}</span>
              {panelControls("program")}
            </div>
            <div
              className="block-stack"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => dropIntoWorkspace(event)}
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
              {statements.map((block, index) => {
                const nodeId = blockNodeId(index);
                return (
                  <ProgramBlockCard
                    key={block.id}
                    block={block}
                    index={index}
                    total={statements.length}
                    selected={highlightedNodeId === nodeId}
                    locale={locale}
                    onSelect={() => setHighlightedNodeId(nodeId)}
                    onCommitValue={(value) => editBlock(index, block, value)}
                    onMove={(direction) => moveBlock(index, direction)}
                    onDelete={() => deleteBlock(index)}
                    onDragStart={(event) => dragWorkspaceBlock(event, index)}
                    onDropBefore={(event) => dropIntoWorkspace(event, index)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {closedPanels.includes("companion") ? null : (
          <aside
            className={panelProps("companion", "companion-panel").className}
            style={panelProps("companion", "companion-panel").style}
            aria-labelledby="companion-title"
            data-testid="canonical-hash"
            data-canonical-hash={canonicalHash}
          >
            <div className="panel-heading">
              <h2 id="companion-title">{t(locale, "proposalReview")}</h2>
              <span>
                {tutorResponse === undefined ? (
                  <>
                    {t(locale, "tutorOffline")}{" "}
                    <ProvenanceLabel kind="unavailable" locale={locale} />
                  </>
                ) : (
                  t(locale, "hintLevel", { level: tutorResponse.hintLevel })
                )}
              </span>
              {panelControls("companion")}
            </div>
            <div className="ai-guide" aria-hidden="true">
              <span className="ai-guide-orbit" />
              <span className="ai-guide-avatar">
                <span />
                <span />
                <i />
              </span>
            </div>
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
            <IntentDialogue
              locale={locale}
              program={model.program}
              mission={mission}
              selectedNodeIds={highlightedNodeId === undefined ? [] : [highlightedNodeId]}
            />
            <div className="tutor-actions">
              <button type="button" onClick={previewDeterministicProposal}>
                {t(locale, "previewProposal")}
              </button>
              <button type="button" onClick={previewImperfectAiProposal}>
                {t(locale, "aiLiteracyActivity")}
              </button>
              <button type="button" onClick={requestHint}>
                {t(locale, "getHint")}
              </button>
              <span className="hint-meter">
                {t(locale, "hintMeter", { count: hintHistory.length })}
              </span>
            </div>
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
