import { useMemo, useState } from "react";
import { projectAgorixCode } from "@agorix/agorix-code";
import { createEditorHistory, programToWorkspace } from "@agorix/block-editor";
import { projectProgram } from "@agorix/code-generator";
import {
  KIDS_GRID,
  KIDS_MISSION_IDS,
  createFreeWorldMission,
  evaluateKidsRun,
  getKidsMission,
  worldToCell,
  type KidsCell,
} from "@agorix/curriculum";
import { projectPython } from "@agorix/python-projection";
import { ProjectStore, type ProjectMetadata } from "@agorix/persistence";
import { validateProgram, type Statement } from "@agorix/program-model";
import type { Locale } from "../../i18n.js";
import type { KidsAvatar, KidsWorld } from "../kidsState.js";
import {
  addKidsBlock,
  createKidsEditor,
  playKidsProgram,
  redoKidsEdit,
  removeKidsBlock,
  setKidsBlockNumber,
  undoKidsEdit,
  type KidsBlockKind,
  type KidsPlayedRun,
} from "../kidsEditorModel.js";
import type { KidsText } from "../useKidsText.js";
import { kidsGoalSpec, parseKidsGoalSpec } from "../kidsProjects.js";
import { KIDS_WORLD_STYLES } from "../worlds.js";

type CodeLanguage = "agorix" | "python" | "typescript";
type Prediction = "yes" | "no" | "dunno";
const PALETTE: readonly KidsBlockKind[] = ["move", "turnL", "turnR", "repeat", "sound"];

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly world: KidsWorld;
  readonly avatar: KidsAvatar;
  readonly missionIndex: 0 | 1 | 2 | 3;
  readonly onBack: () => void;
  readonly onComplete: () => void;
  readonly freeProjectId?: string | undefined;
  readonly onReflect?: (
    prediction: Prediction,
    outcome: "success" | "wall" | "passed" | "short",
  ) => void;
}

function same(a: KidsCell, b: KidsCell): boolean {
  return a.cx === b.cx && a.cy === b.cy;
}

function blockKind(statement: Statement): KidsBlockKind {
  switch (statement.type) {
    case "move":
      return "move";
    case "turn":
      return statement.degrees < 0 ? "turnL" : "turnR";
    case "repeat":
      return "repeat";
    default:
      return "sound";
  }
}

function playKidsTone(): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 440;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
    oscillator.onended = () => void context.close();
  } catch {
    // Sound is optional; program execution and evidence still work without WebAudio.
  }
}

export function EditorScreen({
  t,
  locale,
  world,
  avatar,
  missionIndex,
  onBack,
  onComplete,
  freeProjectId,
  onReflect,
}: Props) {
  const projectId =
    freeProjectId ?? `kids.${world}.${KIDS_MISSION_IDS[Math.min(missionIndex, 2)]!}`;
  const [store] = useState(() => new ProjectStore());
  const [freeGoal, setFreeGoal] = useState<KidsCell | null>(() => {
    if (!freeProjectId || !store.has(projectId)) return null;
    try {
      return parseKidsGoalSpec(store.load(projectId).metadata.missionSpec?.goal ?? "");
    } catch {
      return null;
    }
  });
  const mission = useMemo(
    () =>
      freeProjectId
        ? createFreeWorldMission(freeGoal ?? { cx: 4, cy: 2 }, locale)
        : getKidsMission(KIDS_MISSION_IDS[Math.min(missionIndex, 2)]!, locale),
    [freeGoal, freeProjectId, missionIndex, locale],
  );
  const [createdAt] = useState(() => new Date().toISOString());
  const [history, setHistory] = useState(() => {
    try {
      return store.has(projectId)
        ? createEditorHistory(validateProgram(store.load(projectId).program))
        : createKidsEditor(mission);
    } catch {
      return createKidsEditor(mission);
    }
  });
  const [view, setView] = useState<"blocks" | "code">("blocks");
  const [language, setLanguage] = useState<CodeLanguage>("agorix");
  const [pending, setPending] = useState<"play" | "step" | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [played, setPlayed] = useState<KidsPlayedRun | null>(null);
  const [step, setStep] = useState(0);
  const style = KIDS_WORLD_STYLES[world];
  const statements = history.current.scripts[0]?.statements ?? [];
  const projection = useMemo(() => {
    switch (language) {
      case "agorix":
        return projectAgorixCode(history.current).text;
      case "python":
        return projectPython(history.current).text;
      case "typescript":
        return projectProgram(history.current).code;
    }
  }, [history.current, language]);
  const mapping = useMemo(() => programToWorkspace(history.current).mapping, [history.current]);
  const trace = played?.result.trace ?? [];
  const visibleTrace = trace.slice(0, step);
  const visibleResult = played
    ? {
        ...played.result,
        trace: visibleTrace,
        world:
          visibleTrace.at(-1)?.worldAfter ??
          played.result.trace[0]?.worldBefore ??
          played.result.world,
      }
    : null;
  const evaluation = visibleResult ? evaluateKidsRun({ mission, result: visibleResult }) : null;
  const start = worldToCell(mission.starterStage.sprite as { x: number; y: number });
  const goal = worldToCell(mission.starterStage.goal as { x: number; y: number });
  const final = evaluation?.final ?? start;
  const trail = evaluation?.trail ?? [start];
  const activeNode = visibleTrace.at(-1)?.nodeId;

  function clearRun() {
    setPlayed(null);
    setStep(0);
    setPrediction(null);
  }

  function change(next: typeof history) {
    setHistory(next);
    save(next, false);
    clearRun();
  }

  function save(next: typeof history, completed: boolean) {
    try {
      const previous = store.has(projectId) ? store.load(projectId).metadata : undefined;
      const metadata: ProjectMetadata = {
        createdAt: previous?.createdAt ?? createdAt,
        updatedAt: new Date().toISOString(),
        missionProgress: completed || previous?.missionProgress === 1 ? 1 : 0,
        hintLevel: previous?.hintLevel ?? 0,
        locale,
        ...(freeProjectId && freeGoal
          ? { missionSpec: { goal: kidsGoalSpec(freeGoal), successCheck: "touches-goal" as const } }
          : {}),
      };
      store.save(projectId, next.current, metadata);
    } catch {
      // Local storage can be unavailable; the active editor still works.
    }
  }

  function startRun(mode: "play" | "step") {
    if (freeProjectId && freeGoal === null) return;
    if (played && mode === "step") {
      const next = Math.min(step + 1, trace.length);
      setStep(next);
      if (trace[next - 1]?.statementType === "playSound") playKidsTone();
      if (next === trace.length && played.evaluation.outcome === "success") {
        save(history, true);
        onComplete();
      }
      return;
    }
    setPending(mode);
  }

  function choosePrediction(answer: Prediction) {
    const run = playKidsProgram(history, mission);
    setPrediction(answer);
    setPlayed(run);
    setStep(pending === "step" ? Math.min(1, run.result.trace.length) : run.result.trace.length);
    if (
      (pending === "play" &&
        run.result.trace.some((entry) => entry.statementType === "playSound")) ||
      (pending === "step" && run.result.trace[0]?.statementType === "playSound")
    )
      playKidsTone();
    if (
      (pending === "play" || run.result.trace.length <= 1) &&
      run.evaluation.outcome === "success"
    ) {
      save(history, true);
      onComplete();
    }
    setPending(null);
  }

  function chooseFreeGoal(cell: KidsCell) {
    if (!freeProjectId) return;
    try {
      createFreeWorldMission(cell, locale);
    } catch {
      return;
    }
    setFreeGoal(cell);
    clearRun();
    try {
      const previous = store.has(projectId) ? store.load(projectId).metadata : undefined;
      store.save(projectId, history.current, {
        createdAt: previous?.createdAt ?? createdAt,
        updatedAt: new Date().toISOString(),
        missionProgress: 0,
        hintLevel: previous?.hintLevel ?? 0,
        locale,
        missionSpec: { goal: kidsGoalSpec(cell), successCheck: "touches-goal" },
      });
    } catch {
      /* The free world still works when storage is unavailable. */
    }
  }

  function renderBlock(statement: Statement, index: number, childIndex?: number) {
    const kind = blockKind(statement);
    const nodeId = `scripts[0]/statements[${index}]${childIndex === undefined ? "" : `/body[${childIndex}]`}`;
    const blockId = mapping.find((entry) => entry.nodeId === nodeId)?.blockId;
    const number =
      statement.type === "move"
        ? statement.steps / KIDS_GRID.cellSize
        : statement.type === "repeat"
          ? statement.count
          : null;
    return (
      <li
        key={nodeId}
        className={`kids-program-block kids-block-${kind}`}
        data-active={activeNode === nodeId}
        data-block-id={blockId}
      >
        <div className="kids-block-line">
          <span
            className="kids-block-mark"
            aria-label={
              visibleTrace.some((entry) => entry.nodeId === nodeId)
                ? t("explainRan", {
                    n: visibleTrace.filter((entry) => entry.nodeId === nodeId).length,
                  })
                : t("explainNot")
            }
          >
            {visibleTrace.some((entry) => entry.nodeId === nodeId) ? "✓" : "◆"}
          </span>
          <span>{t(kind)}</span>
          {number !== null ? (
            <select
              aria-label={`${t(kind)} ${index + 1}`}
              value={number}
              onChange={(event) =>
                change(setKidsBlockNumber(history, index, Number(event.target.value), childIndex))
              }
            >
              {(kind === "repeat" ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className="kids-block-remove"
            aria-label={`${t("trash")} ${t(kind)} ${index + 1}`}
            onClick={() => change(removeKidsBlock(history, index, childIndex))}
          >
            ×
          </button>
        </div>
        {statement.type === "repeat" ? (
          <div className="kids-repeat-body">
            <ul>{statement.body.map((child, at) => renderBlock(child, index, at))}</ul>
            <div className="kids-repeat-add">
              {PALETTE.filter((item) => item !== "repeat").map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => change(addKidsBlock(history, item, index))}
                >
                  + {t(item)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <section className="kids-editor" aria-labelledby="kids-editor-title">
      <header className="kids-editor-header">
        <button type="button" className="kids-button" onClick={onBack}>
          {t("backMap")}
        </button>
        <div>
          <p className="kids-editor-kicker">
            {t("mission")} {missionIndex + 1}
          </p>
          <h1 id="kids-editor-title">{mission.title}</h1>
        </div>
        <button
          type="button"
          className="kids-button"
          disabled={!history.canUndo}
          onClick={() => change(undoKidsEdit(history))}
        >
          {t("undo")}
        </button>
        <button
          type="button"
          className="kids-button"
          disabled={!history.canRedo}
          onClick={() => change(redoKidsEdit(history))}
        >
          {locale === "es" ? "Rehacer" : "Redo"}
        </button>
      </header>
      <div className="kids-editor-layout">
        <div className="kids-editor-stage-panel">
          <p className="kids-editor-goal">
            {freeProjectId && !freeGoal ? t("placeGoal") : mission.goal.learnerFacing}
          </p>
          <div
            className="kids-world-grid"
            role={freeProjectId ? "group" : "img"}
            aria-label={`${mission.goal.learnerFacing} ${t("runtimeFact")}: ${evaluation?.outcome ?? ""}`}
            style={{ background: style.bg }}
          >
            {Array.from({ length: KIDS_GRID.rows * KIDS_GRID.cols }, (_, index) => {
              const cell = { cx: index % KIDS_GRID.cols, cy: Math.floor(index / KIDS_GRID.cols) };
              const content = (
                <>
                  {trail.some((visited) => same(visited, cell)) && !same(final, cell) ? (
                    <span className="kids-world-trail" style={{ background: style.trail }} />
                  ) : null}
                  {(!freeProjectId || freeGoal !== null) && same(goal, cell) ? (
                    <span className="kids-world-goal" aria-hidden="true">
                      {style.goalGlyph}
                    </span>
                  ) : null}
                  {same(final, cell) ? (
                    <span className="kids-world-avatar" aria-hidden="true">
                      {avatar}
                    </span>
                  ) : null}
                </>
              );
              return freeProjectId ? (
                <button
                  key={index}
                  type="button"
                  className="kids-world-cell kids-goal-cell"
                  style={{ borderColor: style.cell }}
                  disabled={same(start, cell)}
                  aria-label={`${t("placeGoal")}: ${cell.cx + 1}, ${cell.cy + 1}`}
                  aria-pressed={freeGoal !== null && same(freeGoal, cell)}
                  onClick={() => chooseFreeGoal(cell)}
                >
                  {content}
                </button>
              ) : (
                <div key={index} className="kids-world-cell" style={{ borderColor: style.cell }}>
                  {content}
                </div>
              );
            })}
          </div>
          <div className="kids-run-controls">
            <button
              type="button"
              className="kids-button kids-primary"
              disabled={Boolean(freeProjectId && !freeGoal)}
              onClick={() => startRun("play")}
            >
              {t("run")}
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={Boolean(freeProjectId && !freeGoal)}
              onClick={() => startRun("step")}
            >
              {t("step")}
            </button>
            <button type="button" className="kids-button" onClick={clearRun}>
              {t("reset")}
            </button>
          </div>
          <p className="kids-run-status" role="status">
            {played && step >= trace.length
              ? {
                  success: t("success", { g: style.goalGlyph }),
                  wall: t("wall"),
                  passed: t("passed", { g: style.goalGlyph }),
                  short: t("short", {
                    n: Math.abs(goal.cx - final.cx) + Math.abs(goal.cy - final.cy),
                    g: style.goalGlyph,
                  }),
                }[evaluation?.outcome ?? "short"]
              : played
                ? `${t("step")} ${step} / ${trace.length}`
                : t("oriIdle")}
          </p>
          {prediction ? (
            <p className="kids-note">
              {t("predLog")} {t(prediction)}
            </p>
          ) : null}
          {played &&
          step >= trace.length &&
          evaluation?.outcome === "success" &&
          prediction &&
          onReflect ? (
            <button
              type="button"
              className="kids-button kids-primary"
              onClick={() => onReflect(prediction, evaluation.outcome)}
            >
              {t("tell")}
            </button>
          ) : null}
          <aside className="kids-ori-card">
            <span aria-hidden="true">✦</span>
            <span>Ori · {t("oriIdle")}</span>
          </aside>
        </div>
        <div className="kids-editor-program-panel">
          <div className="kids-editor-tabs">
            <button
              type="button"
              aria-pressed={view === "blocks"}
              onClick={() => setView("blocks")}
            >
              {t("blocks")}
            </button>
            <button type="button" aria-pressed={view === "code"} onClick={() => setView("code")}>
              {t("code")}
            </button>
          </div>
          {view === "blocks" ? (
            <>
              <div className="kids-program-stack">
                <div className="kids-start-block">▶ {t("whenStart")}</div>
                <ul>{statements.map((statement, index) => renderBlock(statement, index))}</ul>
                {statements.length === 0 ? <p className="kids-note">{t("dragHere")}</p> : null}
              </div>
              <p className="kids-code-label">{t("codeNote")}</p>
              <pre className="kids-code-strip">{projectAgorixCode(history.current).text}</pre>
            </>
          ) : (
            <>
              <div className="kids-code-languages">
                {(["agorix", "python", "typescript"] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    aria-pressed={language === item}
                    onClick={() => setLanguage(item)}
                  >
                    {item === "agorix"
                      ? "Agorix Code"
                      : item === "python"
                        ? "Python"
                        : "TypeScript / Node"}
                  </button>
                ))}
              </div>
              <pre className="kids-code-view">{projection}</pre>
            </>
          )}
          <div className="kids-palette" aria-label={t("blocks")}>
            <p>{t("blocks")}</p>
            <div>
              {PALETTE.map((kind) => (
                <button
                  type="button"
                  key={kind}
                  className={`kids-palette-block kids-block-${kind}`}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", kind)}
                  onClick={() => change(addKidsBlock(history, kind))}
                >
                  + {t(kind)}
                </button>
              ))}
            </div>
            <div
              className="kids-drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const kind = event.dataTransfer.getData("text/plain");
                if (PALETTE.includes(kind as KidsBlockKind))
                  change(addKidsBlock(history, kind as KidsBlockKind));
              }}
            >
              {locale === "es" ? "Soltá aquí para agregar" : "Drop here to add"}
            </div>
          </div>
        </div>
      </div>
      {pending ? (
        <div className="kids-predict-backdrop">
          <div
            className="kids-predict-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kids-predict-title"
          >
            <h2 id="kids-predict-title">{t("predictQ", { s: avatar, g: style.goalGlyph })}</h2>
            <p>{t("predictNote")}</p>
            <div>
              {(["yes", "no", "dunno"] as const).map((answer) => (
                <button
                  type="button"
                  className="kids-button"
                  key={answer}
                  onClick={() => choosePrediction(answer)}
                >
                  {t(answer)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
