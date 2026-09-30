import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ProjectMetadata } from "@agorix/persistence";
import type { ProjectProgram } from "@agorix/program-model";
import { POC_TOOLBOX, type BlockNode } from "@agorix/block-editor";
import { createMissionRunFeedback, getLocalizedFirstMission } from "@agorix/curriculum";
import {
  acceptIntentPlan,
  createDeterministicIntentPlan,
  createDeterministicTutorResponse,
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
  acceptProposal,
  createProgramProposal,
  createProposalReview,
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
import "./App.css";

type RunStatus = "idle" | "running" | "stopped" | "complete" | "retry" | "freeplay" | "error";

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

function CodePanel({
  code,
  highlightedNodeId,
  model,
  locale,
}: {
  code: string;
  highlightedNodeId?: string;
  model: EditorModel;
  locale: Locale;
}) {
  const range = highlightedNodeId === undefined ? undefined : model.codeMapping[highlightedNodeId];
  if (range === undefined) {
    return <pre className="code-surface">{code}</pre>;
  }
  return (
    <pre className="code-surface" aria-label={t(locale, "codeAria")}>
      {code.slice(0, range.start)}
      <mark>{code.slice(range.start, range.end)}</mark>
      {code.slice(range.end)}
    </pre>
  );
}

function StageView({
  frame,
  fallback,
  locale,
}: {
  frame: ObservationFrame | undefined;
  fallback: StageState;
  locale: Locale;
}) {
  const state = frame?.state ?? fallback;
  const sprite = state.sprite;
  const goal = state.goal;
  const viewport = state.viewport;
  return (
    <section className="stage-panel" aria-labelledby="stage-title">
      <div className="panel-heading">
        <h2 id="stage-title">{t(locale, "stage")}</h2>
        <span className="status-pill">
          {frame?.reachedGoal ? t(locale, "evidenceGoalReached") : t(locale, "evidenceReachGoal")}
        </span>
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
}: {
  trace: readonly LearnerTraceItem[];
  activeTrace: LearnerTraceItem | undefined;
  locale: Locale;
}) {
  const items = trace.slice(0, 5);
  return (
    <section className="trace-panel" aria-labelledby="trace-title">
      <div className="panel-heading">
        <h2 id="trace-title">{t(locale, "trace")}</h2>
        <span>{t(locale, "traceSubtitle")}</span>
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

  return (
    <article
      className={selected ? "block-card active" : "block-card"}
      aria-label={t(locale, "blockLabel", { name: displayNameFor(block, locale) })}
      data-interaction-model="touch-first no-drag-required keyboard-reorder"
    >
      <button type="button" className="block-title" onClick={onSelect}>
        {displayNameFor(block, locale)}
      </button>
      {field === undefined ? (
        <span>{t(locale, "touchingGoal")}</span>
      ) : (
        <form className="value-editor" onSubmit={submitValue}>
          <label>
            <span>{fieldLabelFor(field, locale)}</span>
            <input
              type="number"
              inputMode="numeric"
              value={draftValue}
              onChange={(event) => setDraftValue(event.currentTarget.value)}
            />
          </label>
          <div className="value-actions">
            <button type="submit">{t(locale, "applyValue")}</button>
            <button type="button" onClick={cancelValue}>
              {t(locale, "cancelEdit")}
            </button>
          </div>
        </form>
      )}
      {block.type === "control_if" ? (
        <p className="block-note">{t(locale, "blockNoteIf")}</p>
      ) : null}
      <div className="block-actions" aria-label={t(locale, "cardActions")}>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0}>
          {t(locale, "up")}
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}>
          {t(locale, "down")}
        </button>
        <button type="button" onClick={onDelete}>
          {t(locale, "delete")}
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
  const timerRef = useRef<number | undefined>();

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
  const missionStep =
    status === "complete" || status === "freeplay" ? 3 : attempts > 0 || status === "retry" ? 2 : 1;

  const toolbox = useMemo(
    () =>
      POC_TOOLBOX.map((section) => ({
        ...section,
        blocks: section.blocks.filter((block) => isAddable(block.type)),
      })).filter((section) => section.blocks.length > 0),
    [],
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
    setStatus("idle");
  }

  function addBlock(type: AddableBlockType) {
    applyProjection(addBlockToWorkspace(model.workspace, type));
    setMessage(t(locale, "codeBehindBlocks"));
  }

  function editBlock(index: number, block: BlockNode, value: number) {
    const field = numericFieldFor(block);
    if (field === undefined) {
      return;
    }
    applyProjection(editNumericBlockField(model.workspace, index, field, value));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= statements.length) {
      return;
    }
    applyProjection(moveBlockInWorkspace(model.workspace, index, nextIndex));
  }

  function deleteBlock(index: number) {
    applyProjection(deleteBlockFromWorkspace(model.workspace, index));
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

  function rejectDeterministicProposal() {
    if (proposalReview === undefined) {
      return;
    }
    rejectProposal(model.program, proposalReview);
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
      const response = createDeterministicTutorResponse(
        createTutorRequest({
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
        }),
      );
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

  return (
    <main className={status === "complete" ? "editor-shell mission-complete" : "editor-shell"}>
      <header className="topbar">
        <div>
          <p className="eyebrow">{t(locale, "appEyebrow")}</p>
          <h1>{t(locale, "appTitle")}</h1>
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
          {persistenceMessage === undefined ? null : (
            <strong className="run-state run-state-error">{persistenceMessage}</strong>
          )}
          {reflectionPrompt === undefined ? null : (
            <div className="reflection-prompt">
              <strong>{t(locale, "reflection", { prompt: reflectionPrompt })}</strong>
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

      <div className="learning-layout">
        <StageView frame={activeFrame} fallback={model.stage.current} locale={locale} />

        <section className="code-panel" aria-labelledby="code-title">
          <div className="panel-heading">
            <h2 id="code-title">{t(locale, "code")}</h2>
            <span>{t(locale, "codeBehindBlocks")}</span>
          </div>
          <CodePanel
            code={model.code}
            {...(highlightedNodeId === undefined ? {} : { highlightedNodeId })}
            model={model}
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

        <section className="action-palette" aria-labelledby="action-palette-title">
          <div className="panel-heading">
            <h2 id="action-palette-title">{t(locale, "actionPalette")}</h2>
            <span>{t(locale, "actionsContext")}</span>
          </div>
          {toolbox.map((section) => (
            <section key={section.name}>
              <h3>{sectionNameFor(section.name, locale)}</h3>
              <div className="action-list">
                {section.blocks.map((block) => (
                  <button
                    key={block.type}
                    type="button"
                    onClick={() => addBlock(block.type as AddableBlockType)}
                  >
                    {displayNameForType(block.type, locale)}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </section>

        <TracePanel trace={learnerTrace} activeTrace={activeTrace} locale={locale} />

        <section className="program-panel" aria-labelledby="workspace-title">
          <div className="panel-heading">
            <h2 id="workspace-title">{t(locale, "whenRun")}</h2>
            <span>{t(locale, "blockCount", { count: statements.length })}</span>
          </div>
          <div className="block-stack">
            {statements.length === 0 ? (
              <p className="empty-state">{t(locale, "addMoveBlock")}</p>
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
                />
              );
            })}
          </div>
        </section>

        <aside
          className="companion-panel"
          aria-labelledby="companion-title"
          data-testid="canonical-hash"
          data-canonical-hash={canonicalHash}
        >
          <div className="panel-heading">
            <h2 id="companion-title">{t(locale, "proposalReview")}</h2>
            <span>
              {tutorResponse === undefined ? (
                <>
                  {t(locale, "tutorOffline")} <ProvenanceLabel kind="unavailable" locale={locale} />
                </>
              ) : (
                t(locale, "hintLevel", { level: tutorResponse.hintLevel })
              )}
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
            <button type="button" onClick={requestHint}>
              {t(locale, "getHint")}
            </button>
            <span className="hint-meter">
              {t(locale, "hintMeter", { count: hintHistory.length })}
            </span>
          </div>
          {proposalCard === undefined ? null : (
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
              <div className="tutor-actions">
                <button type="button" onClick={rejectDeterministicProposal}>
                  {t(locale, "rejectProposal")}
                </button>
                <button type="button" onClick={acceptDeterministicProposal}>
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
      </div>
    </main>
  );
}
