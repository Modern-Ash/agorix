import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectMetadata } from "@agorix/persistence";
import { POC_TOOLBOX, type BlockNode } from "@agorix/block-editor";
import { createMissionRunFeedback, getLocalizedFirstMission } from "@agorix/curriculum";
import {
  createDeterministicTutorResponse,
  createTutorRequest,
  type TutorHintHistoryEntry,
  type TutorResponse,
} from "@agorix/tutor-contract";
import { runProgram, type RunResult, type WorldState } from "@agorix/runtime";
import {
  framesFromRuntimeObservations,
  resetStageSession,
  type ObservationFrame,
  type StageState,
} from "@agorix/stage";
import {
  addBlockToWorkspace,
  blockNodeId,
  codeSliceForNode,
  createEditorModel,
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
import { LOCALE_LABELS, t, type Locale } from "./i18n.js";
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
  const [hintHistory, setHintHistory] = useState<readonly TutorHintHistoryEntry[]>([]);
  const [tutorResponse, setTutorResponse] = useState<TutorResponse | undefined>();
  const [lastRunResult, setLastRunResult] = useState<RunResult | undefined>();
  const [reflectionPrompt, setReflectionPrompt] = useState<string | undefined>();
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<number | undefined>();

  const mission = useMemo(() => getLocalizedFirstMission(locale), [locale]);
  const statements = model.workspace.scripts[0]?.statements ?? [];
  const activeFrame = frames[frameIndex];
  const highlightedCode =
    highlightedNodeId === undefined ? "" : codeSliceForNode(model, highlightedNodeId);
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
      if (timerRef.current !== undefined) {
        window.clearInterval(timerRef.current);
      }
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
    initialProjectRef.current = { ...initialProjectRef.current!, message: undefined };
    setPersistenceMessage(undefined);
    setModel((current) => mergeProjection(current, projection));
    setHighlightedNodeId(undefined);
    setFrames([]);
    setFrameIndex(0);
    setTutorResponse(undefined);
    setLastRunResult(undefined);
    setReflectionPrompt(undefined);
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

  function stopRun() {
    if (timerRef.current !== undefined) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
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
    setFrameIndex(0);
    setHighlightedNodeId(undefined);
    setHintHistory([]);
    setTutorResponse(undefined);
    setLastRunResult(undefined);
    setReflectionPrompt(undefined);
    setAttempts(0);
    setStatus("idle");
    setMessage(t(locale, "resetMessage"));
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
      const result = runProgram(model.program, initialWorldFor(model), {
        collectObservations: true,
        stopAfterSteps: 24,
      });
      setLastRunResult(result);
      setAttempts((current) => current + 1);
      const nextFrames = framesFromRuntimeObservations(result.observations);
      setFrames(nextFrames);
      setFrameIndex(0);
      setStatus("running");
      setMessage(t(locale, "running"));
      if (timerRef.current !== undefined) {
        window.clearInterval(timerRef.current);
      }
      timerRef.current = window.setInterval(() => {
        setFrameIndex((current) => {
          const next = current + 1;
          if (next >= nextFrames.length) {
            window.clearInterval(timerRef.current);
            timerRef.current = undefined;
            const feedback = createMissionRunFeedback({ mission, result, locale });
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
          <strong className={`run-state run-state-${status}`}>{message}</strong>
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

      <div className="workspace-grid">
        <aside className="toolbox" aria-labelledby="toolbox-title">
          <h2 id="toolbox-title">{t(locale, "blocks")}</h2>
          {toolbox.map((section) => (
            <section key={section.name}>
              <h3>{sectionNameFor(section.name, locale)}</h3>
              <div className="toolbox-list">
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
        </aside>

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
              const field = numericFieldFor(block);
              const nodeId = blockNodeId(index);
              const selected = highlightedNodeId === nodeId;
              return (
                <article
                  key={block.id}
                  className={selected ? "block-card active" : "block-card"}
                  aria-label={t(locale, "blockLabel", { name: displayNameFor(block, locale) })}
                >
                  <button
                    type="button"
                    className="block-title"
                    onClick={() => setHighlightedNodeId(nodeId)}
                  >
                    {displayNameFor(block, locale)}
                  </button>
                  {field === undefined ? (
                    <span>{t(locale, "touchingGoal")}</span>
                  ) : (
                    <label>
                      <span>{fieldLabelFor(field, locale)}</span>
                      <input
                        type="number"
                        value={blockValue(block, field)}
                        onChange={(event) =>
                          editBlock(index, block, Number(event.currentTarget.value))
                        }
                      />
                    </label>
                  )}
                  {block.type === "control_if" ? (
                    <p className="block-note">{t(locale, "blockNoteIf")}</p>
                  ) : null}
                  <div className="block-actions">
                    <button
                      type="button"
                      onClick={() => moveBlock(index, -1)}
                      disabled={index === 0}
                    >
                      {t(locale, "up")}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(index, 1)}
                      disabled={index === statements.length - 1}
                    >
                      {t(locale, "down")}
                    </button>
                    <button type="button" onClick={() => deleteBlock(index)}>
                      {t(locale, "delete")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

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
        </section>

        <aside className="tutor-panel" aria-labelledby="tutor-title">
          <div className="panel-heading">
            <h2 id="tutor-title">{t(locale, "proposalReview")}</h2>
            <span>
              {tutorResponse === undefined
                ? t(locale, "tutorOffline")
                : t(locale, "hintLevel", { level: tutorResponse.hintLevel })}
            </span>
          </div>
          <p aria-live="polite">{tutorResponse?.message ?? t(locale, "tutorIntro")}</p>
          <div className="tutor-actions">
            <button type="button" onClick={requestHint}>
              {t(locale, "getHint")}
            </button>
            <span className="hint-meter">
              {t(locale, "hintMeter", { count: hintHistory.length })}
            </span>
          </div>
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
