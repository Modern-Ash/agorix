import { useEffect, useMemo, useState } from "react";
import { projectAgorixCode } from "@agorix/agorix-code";
import {
  createEditorHistory,
  programToWorkspace,
  recordCanonicalTransaction,
} from "@agorix/block-editor";
import { projectProgram } from "@agorix/code-generator";
import {
  KIDS_GRID,
  KIDS_HINT_LEVELS,
  KIDS_MISSION_IDS,
  createFreeWorldMission,
  evaluateKidsRun,
  getKidsMission,
  getKidsHint,
  kidsMoveSteps,
  worldToCell,
  type KidsCell,
} from "@agorix/curriculum";
import { projectPython } from "@agorix/python-projection";
import { ProjectStore, type ProjectMetadata } from "@agorix/persistence";
import {
  acceptProposal,
  createProposalReview,
  modifyProposal,
  programSemanticHash,
  rejectProposal,
} from "@agorix/proposals";
import { decideProactiveSuggestion, recordProactiveOutcome } from "@agorix/learning-decision-plane";
import { validateProgram, type Statement } from "@agorix/program-model";
import type { Locale } from "../../i18n.js";
import type { KidsAvatar, KidsWorld } from "../kidsState.js";
import {
  recordKidsPrediction,
  recordKidsProposalDecision,
  recordKidsRevision,
  recordKidsScaffold,
} from "../kidsEvidence.js";
import {
  createKidsOriProviderRuntime,
  loadKidsOriMemory,
  saveKidsOriMemory,
  type KidsOriOffer,
} from "../kidsOri.js";
import { requestKidsOriOffer } from "../kidsOriRemote.js";
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
import { KidsOriCard } from "./KidsOriCard.js";
import { KidsOriChat } from "./KidsOriChat.js";

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
  readonly oriSuggestions?: boolean;
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
  oriSuggestions = true,
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
  const [usedHintLevels, setUsedHintLevels] = useState<readonly number[]>(() => {
    try {
      const level = store.has(projectId) ? (store.load(projectId).metadata.hintLevel ?? 0) : 0;
      return KIDS_HINT_LEVELS.filter((candidate) => candidate <= level);
    } catch {
      return [];
    }
  });
  const [view, setView] = useState<"blocks" | "code">("blocks");
  const [language, setLanguage] = useState<CodeLanguage>("agorix");
  const [pending, setPending] = useState<"play" | "step" | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [played, setPlayed] = useState<KidsPlayedRun | null>(null);
  const [step, setStep] = useState(0);
  const [oriMemory, setOriMemory] = useState(loadKidsOriMemory);
  const [oriOpen, setOriOpen] = useState(false);
  const [oriSeenHash, setOriSeenHash] = useState<string | null>(null);
  const [remoteOri, setRemoteOri] = useState<{
    readonly key: string;
    readonly offer: KidsOriOffer | null;
  } | null>(null);
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
  const oriHash = useMemo(() => programSemanticHash(history.current), [history.current]);
  const oriProvider = useMemo(
    () => createKidsOriProviderRuntime(mission, missionIndex, locale),
    [mission, missionIndex, locale],
  );
  const localOriOffer = useMemo(
    () => oriProvider.propose(history.current),
    [oriProvider, history.current],
  );
  const oriHintLevel = Math.min(5, Math.max(1, usedHintLevels.length + 1)) as 1 | 2 | 3 | 4 | 5;
  const remoteOriKey = `${mission.id}:${locale}:${oriHash}:${oriHintLevel}`;
  const oriWaiting = !freeProjectId && remoteOri?.key !== remoteOriKey;
  const oriOffer = oriWaiting ? undefined : (remoteOri?.offer ?? localOriOffer);
  const oriReview = useMemo(
    () =>
      oriOffer?.proposal ? createProposalReview(history.current, oriOffer.proposal) : undefined,
    [history.current, oriOffer],
  );
  const assistanceLevel = usedHintLevels.includes(5)
    ? "delegated"
    : usedHintLevels.length > 0
      ? "hinted"
      : "independent";

  useEffect(() => {
    if (!oriSuggestions || freeProjectId) return;
    let current = true;
    void requestKidsOriOffer(history.current, mission.id, locale, oriHintLevel, missionIndex).then(
      (offer) => {
        if (current) setRemoteOri({ key: remoteOriKey, offer });
      },
    );
    return () => {
      current = false;
    };
  }, [
    oriSuggestions,
    freeProjectId,
    history.current,
    mission.id,
    locale,
    oriHintLevel,
    missionIndex,
    remoteOriKey,
  ]);

  useEffect(() => {
    if (
      !oriSuggestions ||
      (freeProjectId && !freeGoal) ||
      !oriOffer?.proposal ||
      oriSeenHash === oriHash
    )
      return;
    const offTargetRun =
      played !== null && step >= trace.length && played.evaluation.outcome === "short";
    const decision = decideProactiveSuggestion({
      kind: offTargetRun ? "runtime-off-target" : "first-step",
      occurrences: offTargetRun ? 1 : statements.length,
      running: pending !== null || (played !== null && step < trace.length),
      declinedForCurrentProgram: (oriMemory.programs[oriHash]?.declines ?? 0) > 0,
      declinedCount: oriMemory.sessionDeclines,
    });
    if (decision.action !== "offer") return;
    setOriOpen(true);
    setOriSeenHash(oriHash);
    const next = recordProactiveOutcome(
      oriMemory,
      oriHash,
      "offered",
      (oriMemory.lastOfferSequence ?? 0) + 1,
    );
    setOriMemory(next);
    saveKidsOriMemory(next);
  }, [
    oriSuggestions,
    freeProjectId,
    freeGoal,
    oriOffer,
    oriSeenHash,
    oriHash,
    statements.length,
    pending,
    played,
    step,
    trace.length,
    oriMemory,
  ]);

  function clearRun() {
    setPlayed(null);
    setStep(0);
    setPrediction(null);
  }

  function change(
    next: typeof history,
    revisionKind: "sequenceChange" | "loopChange" = "sequenceChange",
    learnerEdit = true,
  ) {
    if (learnerEdit && played && JSON.stringify(next.current) !== JSON.stringify(history.current)) {
      recordKidsRevision(
        revisionKind,
        1,
        played.evaluation.outcome !== "success",
        undefined,
        assistanceLevel,
      );
    }
    setHistory(next);
    setOriOpen(false);
    save(next, false);
    clearRun();
  }

  function save(next: typeof history, completed: boolean, hintLevel = usedHintLevels.length) {
    try {
      const previous = store.has(projectId) ? store.load(projectId).metadata : undefined;
      const metadata: ProjectMetadata = {
        createdAt: previous?.createdAt ?? createdAt,
        updatedAt: new Date().toISOString(),
        missionProgress: completed || previous?.missionProgress === 1 ? 1 : 0,
        hintLevel: Math.max(previous?.hintLevel ?? 0, hintLevel),
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
    recordKidsPrediction(answer, run.evaluation.outcome, undefined, assistanceLevel);
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
    setUsedHintLevels([]);
    clearRun();
    try {
      const previous = store.has(projectId) ? store.load(projectId).metadata : undefined;
      store.save(projectId, history.current, {
        createdAt: previous?.createdAt ?? createdAt,
        updatedAt: new Date().toISOString(),
        missionProgress: 0,
        hintLevel: 0,
        locale,
        missionSpec: { goal: kidsGoalSpec(cell), successCheck: "touches-goal" },
      });
    } catch {
      /* The free world still works when storage is unavailable. */
    }
  }

  function showNextHint() {
    const level = usedHintLevels.length + 1;
    const hint = getKidsHint(mission, level, usedHintLevels);
    if (!hint) return;
    recordKidsScaffold(level === 5 ? "solution" : "hint", hint.level);
    setUsedHintLevels([...usedHintLevels, level]);
    save(history, false, level);
  }

  function decideOri(
    decision: "accept" | "modify" | "reject",
    inspectedDiff: boolean,
    choice?: number,
  ) {
    if (!oriReview || !oriOffer?.proposal) return;
    if (decision === "reject") {
      rejectProposal(history.current, oriReview);
      recordKidsProposalDecision("reject", inspectedDiff, false);
      const next = recordProactiveOutcome(
        oriMemory,
        oriHash,
        "declined",
        (oriMemory.lastDeclineSequence ?? 0) + 1,
      );
      setOriMemory(next);
      saveKidsOriMemory(next);
      setOriOpen(false);
      return;
    }
    let result;
    if (decision === "accept") {
      result = acceptProposal(history.current, oriReview);
    } else {
      if (oriOffer.proposal.operations.length !== 1) return;
      const operation = oriOffer.proposal.operations[0];
      if (operation?.type !== "appendStatement" || choice === undefined) return;
      const suggested = operation.statement;
      const replacement: Statement =
        suggested.type === "move"
          ? { ...suggested, steps: kidsMoveSteps(choice) }
          : suggested.type === "repeat"
            ? { ...suggested, count: choice }
            : suggested.type === "turn"
              ? { ...suggested, degrees: choice }
              : suggested;
      const candidate = oriReview.candidateProgram;
      const script = candidate.scripts[0];
      if (!script) return;
      const modified = validateProgram({
        ...candidate,
        scripts: [
          { ...script, statements: [...script.statements.slice(0, -1), replacement] },
          ...candidate.scripts.slice(1),
        ],
      });
      result = modifyProposal(history.current, oriReview, modified);
    }
    const next = recordCanonicalTransaction(history, {
      label: decision === "accept" ? "use Ori proposal" : "change Ori proposal",
      after: result.program,
    }).history;
    recordKidsProposalDecision(decision, inspectedDiff, false);
    const memory = recordProactiveOutcome(
      oriMemory,
      oriHash,
      "accepted",
      (oriMemory.lastOfferSequence ?? 0) + 1,
    );
    setOriMemory(memory);
    saveKidsOriMemory(memory);
    change(next, "sequenceChange", false);
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
                change(
                  setKidsBlockNumber(history, index, Number(event.target.value), childIndex),
                  kind === "repeat" ? "loopChange" : "sequenceChange",
                )
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
            onClick={() =>
              change(
                removeKidsBlock(history, index, childIndex),
                kind === "repeat" ? "loopChange" : "sequenceChange",
              )
            }
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
                  onClick={() => change(addKidsBlock(history, item, index), "loopChange")}
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
          <div className="kids-hints">
            {usedHintLevels.map((level) => (
              <p className="kids-note" key={level}>
                {locale === "es" ? "Pista" : "Hint"} {level}: {mission.hintLadder[level - 1]?.text}
              </p>
            ))}
            {usedHintLevels.length < KIDS_HINT_LEVELS.length ? (
              <button type="button" className="kids-button" onClick={showNextHint}>
                {usedHintLevels.length === 4
                  ? t("seeIdea")
                  : `${locale === "es" ? "Pista" : "Hint"} ${usedHintLevels.length + 1}`}
              </button>
            ) : null}
          </div>
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
          {oriSuggestions ? (
            !freeProjectId || freeGoal ? (
              oriOffer ? (
                <KidsOriCard
                  key={`${oriHash}-${oriOpen}`}
                  t={t}
                  locale={locale}
                  avatar={avatar}
                  goalGlyph={style.goalGlyph}
                  offer={oriOffer}
                  review={oriReview}
                  open={oriOpen}
                  onOpen={() => setOriOpen(true)}
                  onAccept={(inspected) => decideOri("accept", inspected)}
                  onModify={(choice, inspected) => decideOri("modify", inspected, choice)}
                  onReject={(inspected) => decideOri("reject", inspected)}
                />
              ) : null
            ) : null
          ) : null}
          {oriSuggestions && (!freeProjectId || freeGoal) ? (
            <KidsOriChat
              locale={locale}
              missionId={mission.id}
              program={history.current}
              {...(freeProjectId && freeGoal ? { goalCell: freeGoal } : {})}
            />
          ) : null}
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
                  onClick={() =>
                    change(
                      addKidsBlock(history, kind),
                      kind === "repeat" ? "loopChange" : "sequenceChange",
                    )
                  }
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
                  change(
                    addKidsBlock(history, kind as KidsBlockKind),
                    kind === "repeat" ? "loopChange" : "sequenceChange",
                  );
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
