import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
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
  verifyKidsFreeGoal,
  evaluateKidsGoalRun,
  getKidsMission,
  getKidsHint,
  kidsMoveSteps,
  worldToCell,
  type KidsCell,
  type KidsGoalCheck,
} from "@agorix/curriculum";
import { projectPython } from "@agorix/python-projection";
import { projectJava } from "@agorix/java-projection";
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
  gateKidsOriOffer,
  saveKidsOriMemory,
  type KidsOriOffer,
} from "../kidsOri.js";
import { requestKidsOriOffer } from "../kidsOriRemote.js";
import { oriMotionStatus, useOriPageVisible } from "../kidsOriMotion.js";
import { expressionForMotion, outcomeOfOffer } from "../kidsOriExpression.js";
import { conceptsOfProgram } from "@agorix/learning-evidence";
import { recordMastery } from "../kidsMastery.js";
import {
  addKidsBlock,
  createKidsEditor,
  playKidsProgram,
  redoKidsEdit,
  duplicateKidsBlock,
  insertKidsBlock,
  moveKidsBlock,
  removeKidsBlock,
  setKidsBlockNumber,
  setKidsBlockSound,
  undoKidsEdit,
  type KidsBlockKind,
  type KidsPlayedRun,
} from "../kidsEditorModel.js";
import type { KidsText } from "../useKidsText.js";
import { kidsGoalSpec, listFreeProjectRefs, parseKidsGoalSpec } from "../kidsProjects.js";
import { KIDS_WORLD_STYLES } from "../worlds.js";
import { KidsOriCard } from "./KidsOriCard.js";
import { useKidsFlag } from "../kidsFlags.js";
import { bandProfile, codeTabsForBand, type AgeBand, type CodeTab } from "../kidsAgeBand.js";
import { KidsOriChat } from "./KidsOriChat.js";
import { KidsOriGoals } from "./KidsOriGoals.js";
import { describeOriGoal } from "@agorix/ori-agent";
import { KidsBackdrop, KidsSprite, builtinWorld, emojiSlot, spriteImage } from "./KidsArt.js";
import {
  KIDS_CUSTOM_SOUND_ID,
  KIDS_SOUNDS,
  isKidsSoundId,
  soundEvents,
} from "../kidsSoundLibrary.js";
import { playKidsSound } from "../kidsSoundPlayer.js";
import { dropSlot, nextZoom, type ZoomLevel } from "../kidsEditorInteractions.js";
import { KIDS_SHORTCUTS, kidsShortcut } from "../kidsShortcuts.js";
import { tutorialStep } from "../kidsTutorial.js";
import { KidsTutorial } from "./KidsTutorial.js";
import { ListenButton } from "./ListenButton.js";

type CodeLanguage = "agorix" | "python" | "typescript" | "java";
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
  readonly readAloud?: boolean;
  readonly ageBand?: AgeBand | undefined;
  /** First-run coach for mission 1; absent when the tutorial is off or already done. */
  readonly tutorial?: { readonly onDone: () => void } | undefined;
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
  readAloud = true,
  ageBand,
  tutorial,
  onReflect,
}: Props) {
  const duplicateEnabled = useKidsFlag("duplicate");
  const customImagesEnabled = useKidsFlag("customImages");
  const soundLibraryEnabled = useKidsFlag("soundLibrary");
  const customAudioEnabled = useKidsFlag("customAudio");
  const oriFloatEnabled = useKidsFlag("oriFloat");
  const zoomEnabled = useKidsFlag("zoom");
  const contextMenuEnabled = useKidsFlag("contextMenu");
  const shortcutsEnabled = useKidsFlag("shortcuts");
  const [zoom, setZoom] = useState<ZoomLevel>(100);
  const [menu, setMenu] = useState<{
    index: number;
    childIndex?: number;
    x: number;
    y: number;
  } | null>(null);
  const [explanation, setExplanation] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [soundTarget, setSoundTarget] = useState<{ index: number; childIndex?: number } | null>(
    null,
  );
  const [soundCategory, setSoundCategory] = useState<
    "all" | "effects" | "music" | "nature" | "actions"
  >("all");
  const editorRef = useRef<HTMLElement>(null);
  const oriTrigger = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const touchDistance = useRef<number | null>(null);
  const savedArt = freeProjectId
    ? listFreeProjectRefs().find((entry) => entry.id === freeProjectId)
    : undefined;
  const avatarArt = savedArt?.avatar ?? emojiSlot(avatar);
  const worldArt = savedArt?.world ?? builtinWorld(world);
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
  const [freeGoalCheck, setFreeGoalCheck] = useState<KidsGoalCheck>(() => {
    if (!freeProjectId || !store.has(projectId)) return "touches-goal";
    try {
      return store.load(projectId).metadata.missionSpec?.successCheck ?? "touches-goal";
    } catch {
      return "touches-goal";
    }
  });
  const mission = useMemo(
    () =>
      freeProjectId
        ? verifyKidsFreeGoal(freeGoal ?? { cx: 4, cy: 2 }, freeGoalCheck, locale)
        : getKidsMission(KIDS_MISSION_IDS[Math.min(missionIndex, 2)]!, locale),
    [freeGoal, freeGoalCheck, freeProjectId, missionIndex, locale],
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
  const [showMoreLanguages, setShowMoreLanguages] = useState(false);
  const visibleCodeTabs: readonly CodeTab[] = ageBand
    ? codeTabsForBand(ageBand, showMoreLanguages)
    : ["agorix", "python", "node", "java"];
  const visibleLanguage: CodeLanguage =
    language !== "agorix" &&
    !visibleCodeTabs.includes(language === "typescript" ? "node" : language)
      ? "agorix"
      : language;
  const [pending, setPending] = useState<"play" | "step" | null>(null);
  const [numberTouched, setNumberTouched] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [played, setPlayed] = useState<KidsPlayedRun | null>(null);
  const [failedRuns, setFailedRuns] = useState(0);
  const [step, setStep] = useState(0);
  const [oriMemory, setOriMemory] = useState(loadKidsOriMemory);
  const [oriOpen, setOriOpen] = useState(false);
  const oriPageVisible = useOriPageVisible();
  const [oriSeenHash, setOriSeenHash] = useState<string | null>(null);
  const [remoteOri, setRemoteOri] = useState<{
    readonly key: string;
    readonly offer: KidsOriOffer | null;
  } | null>(null);
  const style = KIDS_WORLD_STYLES[world];
  const statements = history.current.scripts[0]?.statements ?? [];
  const projection = useMemo(() => {
    switch (visibleLanguage) {
      case "agorix":
        return projectAgorixCode(history.current).text;
      case "python":
        return projectPython(history.current).text;
      case "typescript":
        return projectProgram(history.current).code;
      case "java": {
        const result = projectJava(history.current);
        return result.diagnostics.length === 0
          ? result.text
          : `${result.text}\n// Some blocks are not available in this Java view.\n`;
      }
    }
  }, [history.current, visibleLanguage]);
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
  const evaluation = visibleResult
    ? evaluateKidsGoalRun(mission, visibleResult, freeProjectId ? freeGoalCheck : "touches-goal")
    : null;
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
  const rawOriOffer = oriWaiting ? undefined : (remoteOri?.offer ?? localOriOffer);
  const oriOffer =
    rawOriOffer && !freeProjectId
      ? gateKidsOriOffer(rawOriOffer, {
          failedRuns,
          hintsUsed: usedHintLevels.length,
        })
      : rawOriOffer;
  const oriMotion = oriWaiting
    ? "thinking"
    : oriOpen
      ? "listening"
      : played
        ? "observing"
        : oriOffer?.proposal
          ? "proposal"
          : "idle";
  /** Closing the panel hands focus back to the button that opened it. */
  function closeOriPanel() {
    setOriOpen(false);
    requestAnimationFrame(() => oriTrigger.current?.focus());
  }
  const oriReview = useMemo(
    () =>
      oriOffer?.proposal ? createProposalReview(history.current, oriOffer.proposal) : undefined,
    [history.current, oriOffer],
  );
  /** Ori's idea as ghost blocks: shown after the real ones while the panel is open, never saved. */
  const ghostLabels = useMemo(() => {
    const added = oriReview?.candidateProgram.scripts[0]?.statements.slice(statements.length) ?? [];
    return added.flatMap((statement) =>
      statement.type === "move"
        ? [`${t("move")} ${statement.steps / KIDS_GRID.cellSize}`]
        : statement.type === "turn"
          ? [t(statement.degrees < 0 ? "turnL" : "turnR")]
          : statement.type === "repeat"
            ? [`${t("repeat")} ${statement.count}`]
            : [],
    );
  }, [oriReview, statements.length, t]);
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
    if (!oriFloatEnabled) setOriOpen(true);
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
    oriFloatEnabled,
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

  const coach = tutorial
    ? tutorialStep({
        blocks: history.current.scripts[0]?.statements.length ?? 0,
        numberTouched,
        predicting: pending !== null,
        ran: played !== null,
      })
    : null;
  const tutorialDone = tutorial?.onDone;
  useEffect(() => {
    if (tutorialDone && played !== null) tutorialDone();
  }, [tutorialDone, played]);

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

  function dropOnProgram(event: DragEvent<HTMLUListElement>) {
    if (!zoomEnabled) return;
    event.preventDefault();
    const list = event.currentTarget;
    const top = list.getBoundingClientRect().top;
    const midpoints = [...list.children].map((child) => {
      const rect = child.getBoundingClientRect();
      return (rect.top + rect.height / 2 - top) / (zoom / 100);
    });
    const slot = dropSlot(event.clientY, top, midpoints, zoom);
    const source = event.dataTransfer.getData("application/x-kids-block-index");
    if (source) {
      change(moveKidsBlock(history, Number(source), slot));
      return;
    }
    const kind = event.dataTransfer.getData("text/plain");
    if (PALETTE.includes(kind as KidsBlockKind))
      change(insertKidsBlock(history, kind as KidsBlockKind, slot));
  }

  function explainBlock(index: number, childIndex?: number): string {
    const parent = statements[index];
    const block =
      childIndex === undefined
        ? parent
        : parent?.type === "repeat"
          ? parent.body[childIndex]
          : undefined;
    if (!block) return "";
    if (block.type === "move")
      return t("explainMoveBlock", { n: block.steps / KIDS_GRID.cellSize });
    if (block.type === "turn")
      return t(block.degrees < 0 ? "explainLeftBlock" : "explainRightBlock");
    if (block.type === "repeat") return t("explainRepeatBlock", { n: block.count });
    return t("explainSoundBlock");
  }

  function menuAction(action: "duplicate" | "delete" | "explain") {
    if (!menu) return;
    if (action === "duplicate") change(duplicateKidsBlock(history, menu.index, menu.childIndex));
    if (action === "delete") change(removeKidsBlock(history, menu.index, menu.childIndex));
    if (action === "explain") setExplanation(explainBlock(menu.index, menu.childIndex));
    setMenu(null);
  }

  function editorKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (menu) return;
    if (!shortcutsEnabled) return;
    const action = kidsShortcut(
      event.nativeEvent,
      Boolean(pending || helpOpen || editorRef.current?.querySelector("[role='dialog']")),
    );
    if (!action) return;
    const block = (event.target as Element).closest<HTMLElement>(".kids-program-block");
    if ((action === "delete" || action === "duplicate") && !block) return;
    if (action === "run" && !(event.target as Element).closest(".kids-world-grid")) return;
    event.preventDefault();
    if (action === "undo") change(undoKidsEdit(history));
    if (action === "redo") change(redoKidsEdit(history));
    if (action === "run") startRun("play");
    if (action === "help") setHelpOpen(true);
    if (block && (action === "delete" || action === "duplicate")) {
      const index = Number(block.dataset.index);
      const childIndex =
        block.dataset.childIndex === undefined ? undefined : Number(block.dataset.childIndex);
      change(
        action === "delete"
          ? removeKidsBlock(history, index, childIndex)
          : duplicateKidsBlock(history, index, childIndex),
      );
    }
  }

  useEffect(() => {
    if (menu) menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menu]);

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
          ? { missionSpec: { goal: kidsGoalSpec(freeGoal), successCheck: freeGoalCheck } }
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
      for (const id of soundEvents(trace.slice(next - 1, next))) void playKidsSound(id, avatarArt);
      if (next === trace.length && played.evaluation.outcome === "success") {
        save(history, true);
        onComplete();
      }
      return;
    }
    setPending(mode);
  }

  function choosePrediction(answer: Prediction) {
    const run = playKidsProgram(history, mission, freeProjectId ? freeGoalCheck : "touches-goal");
    const predicted = recordKidsPrediction(
      answer,
      run.evaluation.outcome,
      undefined,
      assistanceLevel,
    );
    // What the run showed, for the mastery stages: kept as counters only.
    const concepts = conceptsOfProgram(history.current);
    recordMastery({
      kind: "run",
      concepts,
      completed: run.evaluation.outcome === "success",
      helped: assistanceLevel !== "independent",
      free: Boolean(freeProjectId),
    });
    if (predicted && predicted.kind === "predictionMade" && predicted.matchedRuntimeOutcome)
      recordMastery({ kind: "explained", concepts });
    setPrediction(answer);
    if (run.evaluation.outcome !== "success") setFailedRuns((count) => count + 1);
    setPlayed(run);
    setStep(pending === "step" ? Math.min(1, run.result.trace.length) : run.result.trace.length);
    for (const id of soundEvents(
      pending === "play" ? run.result.trace : run.result.trace.slice(0, 1),
    )) {
      void playKidsSound(id, avatarArt);
    }
    if (
      (pending === "play" || run.result.trace.length <= 1) &&
      run.evaluation.outcome === "success"
    ) {
      save(history, true);
      onComplete();
    }
    setPending(null);
  }

  function chooseFreeGoal(cell: KidsCell, check: KidsGoalCheck = "touches-goal") {
    if (!freeProjectId) return;
    try {
      verifyKidsFreeGoal(cell, check, locale);
    } catch {
      return;
    }
    setFreeGoal(cell);
    setFreeGoalCheck(check);
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
        missionSpec: { goal: kidsGoalSpec(cell), successCheck: check },
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
        data-index={index}
        data-child-index={childIndex}
        tabIndex={contextMenuEnabled || shortcutsEnabled ? 0 : undefined}
        draggable={zoomEnabled && childIndex === undefined}
        onDragStart={(event) => {
          if (childIndex !== undefined) return;
          event.dataTransfer.setData("application/x-kids-block-index", String(index));
        }}
        onContextMenu={(event) => {
          if (!contextMenuEnabled) return;
          event.preventDefault();
          setMenu({
            index,
            ...(childIndex === undefined ? {} : { childIndex }),
            x: event.clientX,
            y: event.clientY,
          });
        }}
        onPointerDown={(event) => {
          if (!contextMenuEnabled || event.pointerType !== "touch") return;
          pressOrigin.current = { x: event.clientX, y: event.clientY };
          pressTimer.current = setTimeout(() => {
            setMenu({
              index,
              ...(childIndex === undefined ? {} : { childIndex }),
              x: event.clientX,
              y: event.clientY,
            });
            pressTimer.current = null;
          }, 500);
        }}
        onPointerMove={(event) => {
          if (!pressOrigin.current || !pressTimer.current) return;
          if (
            Math.hypot(
              event.clientX - pressOrigin.current.x,
              event.clientY - pressOrigin.current.y,
            ) > 8
          ) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
          }
        }}
        onPointerUp={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
          pressTimer.current = null;
        }}
        onPointerCancel={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
          pressTimer.current = null;
        }}
        onKeyDown={(event) => {
          if (
            !contextMenuEnabled ||
            !["F10", "ContextMenu"].includes(event.key) ||
            (event.key === "F10" && !event.shiftKey)
          )
            return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          setMenu({
            index,
            ...(childIndex === undefined ? {} : { childIndex }),
            x: rect.left + 24,
            y: rect.bottom,
          });
        }}
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
              data-tutorial={coach === "number" ? "target" : undefined}
              onChange={(event) => {
                change(
                  setKidsBlockNumber(history, index, Number(event.target.value), childIndex),
                  kind === "repeat" ? "loopChange" : "sequenceChange",
                );
                setNumberTouched(true);
              }}
            >
              {(kind === "repeat" ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ) : null}
          {statement.type === "playSound" && soundLibraryEnabled ? (
            <>
              <select
                aria-label={`${t("sound")} ${index + 1}`}
                value={statement.soundId}
                onChange={(event) =>
                  change(
                    setKidsBlockSound(history, index, event.target.value, childIndex),
                    "sequenceChange",
                  )
                }
              >
                {!isKidsSoundId(statement.soundId) ? (
                  <option value={statement.soundId}>{t("soundClassic")}</option>
                ) : null}
                {KIDS_SOUNDS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {t(item.nameKey)}
                  </option>
                ))}
                {customAudioEnabled || statement.soundId === KIDS_CUSTOM_SOUND_ID ? (
                  <option value={KIDS_CUSTOM_SOUND_ID}>{t("soundCustom")}</option>
                ) : null}
              </select>
              <button
                type="button"
                className="kids-block-sound-gallery"
                onClick={() =>
                  setSoundTarget({ index, ...(childIndex === undefined ? {} : { childIndex }) })
                }
              >
                {locale === "es" ? "Galería de sonidos" : "Sound gallery"}
              </button>
            </>
          ) : null}
          {duplicateEnabled || contextMenuEnabled ? (
            <button
              type="button"
              className="kids-block-duplicate"
              aria-label={`${t("duplicate")} ${t(kind)} ${index + 1}`}
              onClick={() =>
                change(
                  duplicateKidsBlock(history, index, childIndex),
                  kind === "repeat" ? "loopChange" : "sequenceChange",
                )
              }
            >
              ⧉
            </button>
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

  function oriCard(open: boolean) {
    if (!oriOffer) return null;
    return (
      <KidsOriCard
        key={`${oriHash}-${open}`}
        t={t}
        locale={locale}
        avatar={avatar}
        goalGlyph={style.goalGlyph}
        offer={oriOffer}
        shape={ageBand ? bandProfile(ageBand).oriShape : undefined}
        review={oriReview}
        open={open}
        onOpen={() => setOriOpen(true)}
        onAccept={(inspected) => decideOri("accept", inspected)}
        onModify={(choice, inspected) => decideOri("modify", inspected, choice)}
        onReject={(inspected) => decideOri("reject", inspected)}
      />
    );
  }

  const goalText =
    freeProjectId && !freeGoal
      ? t("placeGoal")
      : freeProjectId && freeGoal
        ? describeOriGoal(freeGoal, freeGoalCheck, locale)
        : mission.goal.learnerFacing;
  const resultText =
    played && step >= trace.length
      ? evaluation?.missingTurn
        ? locale === "es"
          ? "Llegaste a la meta. Probá incluir un giro."
          : "You reached the goal. Try adding a turn."
        : {
            success: t("success", { g: style.goalGlyph }),
            wall: t("wall"),
            passed: t("passed", { g: style.goalGlyph }),
            short: t("short", {
              n: Math.abs(goal.cx - final.cx) + Math.abs(goal.cy - final.cy),
              g: style.goalGlyph,
            }),
          }[evaluation?.outcome ?? "short"]
      : null;

  return (
    <section
      ref={editorRef}
      className="kids-editor"
      aria-labelledby="kids-editor-title"
      onKeyDown={editorKeyDown}
    >
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
        <ListenButton t={t} locale={locale} enabled={readAloud} text={resultText ?? goalText} />
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
        {shortcutsEnabled ? (
          <button type="button" className="kids-button" onClick={() => setHelpOpen(true)}>
            {t("shortcutsHelp")}
          </button>
        ) : null}
      </header>
      {tutorial && coach ? (
        <KidsTutorial
          t={t}
          locale={locale}
          step={coach}
          readAloud={readAloud}
          onSkip={tutorial.onDone}
        />
      ) : null}
      <div className="kids-editor-layout">
        <div className="kids-editor-stage-panel">
          <p className="kids-editor-goal">{goalText}</p>
          <KidsBackdrop
            world={worldArt}
            className="kids-world-grid"
            role={freeProjectId ? "group" : "img"}
            label={`${mission.goal.learnerFacing} ${t("runtimeFact")}: ${evaluation?.outcome ?? ""}`}
            style={{ background: style.bg }}
            {...(shortcutsEnabled ? { tabIndex: 0 } : {})}
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
                    <KidsSprite
                      slot={avatarArt}
                      className="kids-world-avatar"
                      label={avatarArt.kind === "custom" ? t("customExplorer") : undefined}
                    />
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
          </KidsBackdrop>
          <div className="kids-run-controls">
            <button
              type="button"
              className="kids-button kids-primary"
              disabled={Boolean(freeProjectId && !freeGoal)}
              data-tutorial={coach === "run" ? "target" : undefined}
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
            {resultText
              ? resultText
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
          {oriSuggestions
            ? !freeProjectId || freeGoal
              ? oriOffer
                ? oriFloatEnabled
                  ? null
                  : oriCard(oriOpen)
                : null
              : null
            : null}
          {oriSuggestions && (!freeProjectId || freeGoal) ? (
            <KidsOriChat
              locale={locale}
              missionId={mission.id}
              program={history.current}
              {...(freeProjectId && freeGoal ? { goalCell: freeGoal } : {})}
            />
          ) : null}
          {oriSuggestions && freeProjectId ? (
            <KidsOriGoals
              locale={locale}
              onAccept={(proposal) => chooseFreeGoal(proposal.cell, proposal.successCheck)}
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
          {zoomEnabled && view === "blocks" ? (
            <div className="kids-zoom-controls" role="group" aria-label={t("zoomBlocks")}>
              <button
                type="button"
                aria-label={t("zoomOut")}
                onClick={() => setZoom(nextZoom(zoom, -1))}
              >
                −
              </button>
              <output aria-label={t("zoomBlocks")}>{zoom}%</output>
              <button
                type="button"
                aria-label={t("zoomIn")}
                onClick={() => setZoom(nextZoom(zoom, 1))}
              >
                ＋
              </button>
              <button type="button" onClick={() => setZoom(100)}>
                {t("zoomReset")}
              </button>
            </div>
          ) : null}
          {view === "blocks" ? (
            <>
              <div
                className="kids-program-stack"
                style={zoomEnabled ? { zoom: `${zoom}%` } : undefined}
                onWheel={(event) => {
                  if (!zoomEnabled || !event.ctrlKey) return;
                  event.preventDefault();
                  setZoom(nextZoom(zoom, event.deltaY < 0 ? 1 : -1));
                }}
                onTouchStart={(event) => {
                  if (event.touches.length === 2)
                    touchDistance.current = Math.hypot(
                      event.touches[0]!.clientX - event.touches[1]!.clientX,
                      event.touches[0]!.clientY - event.touches[1]!.clientY,
                    );
                }}
                onTouchMove={(event) => {
                  if (!zoomEnabled || event.touches.length !== 2 || touchDistance.current === null)
                    return;
                  const distance = Math.hypot(
                    event.touches[0]!.clientX - event.touches[1]!.clientX,
                    event.touches[0]!.clientY - event.touches[1]!.clientY,
                  );
                  if (Math.abs(distance - touchDistance.current) > 25) {
                    setZoom(nextZoom(zoom, distance > touchDistance.current ? 1 : -1));
                    touchDistance.current = distance;
                  }
                }}
                onTouchEnd={() => {
                  touchDistance.current = null;
                }}
              >
                <div className="kids-start-block">▶ {t("whenStart")}</div>
                <ul
                  onDragOver={(event) => {
                    if (zoomEnabled) event.preventDefault();
                  }}
                  onDrop={dropOnProgram}
                >
                  {statements.map((statement, index) => renderBlock(statement, index))}
                  {oriOpen && oriOffer?.proposal
                    ? ghostLabels.map((label, index) => (
                        <li
                          key={`ghost-${index}`}
                          className="kids-ghost-block"
                          data-testid="ori-ghost-block"
                        >
                          <span>{label}</span>
                          <small>{t("oriGhostNote")}</small>
                        </li>
                      ))
                    : null}
                </ul>
                {statements.length === 0 ? <p className="kids-note">{t("dragHere")}</p> : null}
              </div>
            </>
          ) : (
            <>
              <div className="kids-code-languages" role="group" aria-label={t("code")}>
                {visibleCodeTabs.map((tab) => {
                  const item: CodeLanguage = tab === "node" ? "typescript" : tab;
                  return (
                    <button
                      type="button"
                      key={item}
                      aria-pressed={visibleLanguage === item}
                      onClick={() => setLanguage(item)}
                    >
                      {item === "agorix"
                        ? "Agorix Code"
                        : item === "python"
                          ? "Python"
                          : item === "typescript"
                            ? "TypeScript / Node"
                            : "Java"}
                    </button>
                  );
                })}
                {ageBand === "6-8" ? (
                  <button
                    type="button"
                    aria-expanded={showMoreLanguages}
                    onClick={() => {
                      setShowMoreLanguages((current) => !current);
                      setLanguage("agorix");
                    }}
                  >
                    {t(showMoreLanguages ? "fewerLanguages" : "moreLanguages")}
                  </button>
                ) : null}
              </div>
              <pre className="kids-code-view">{projection}</pre>
            </>
          )}
          <div
            className="kids-palette"
            aria-label={t("blocks")}
            style={zoomEnabled ? { zoom: `${zoom}%` } : undefined}
          >
            <p>{t("blocks")}</p>
            <div>
              {PALETTE.map((kind) => (
                <button
                  type="button"
                  key={kind}
                  className={`kids-palette-block kids-block-${kind}`}
                  data-tutorial={coach === "add" && kind === "move" ? "target" : undefined}
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
      {soundTarget ? (
        <div
          className="kids-sound-gallery-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={locale === "es" ? "Galería de sonidos" : "Sound gallery"}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSoundTarget(null);
          }}
        >
          <div className="kids-sound-gallery-dialog">
            <div className="kids-sound-gallery-heading">
              <h2>{locale === "es" ? "Escuchá y elegí" : "Listen and choose"}</h2>
              <button
                type="button"
                className="kids-button"
                autoFocus
                onClick={() => setSoundTarget(null)}
              >
                {t("close")}
              </button>
            </div>
            <div
              className="kids-gallery-filters"
              role="group"
              aria-label={locale === "es" ? "Categorías de sonidos" : "Sound categories"}
            >
              {(["all", "effects", "music", "nature", "actions"] as const).map((category) => (
                <button
                  key={category}
                  type="button"
                  className="kids-button"
                  aria-pressed={soundCategory === category}
                  onClick={() => setSoundCategory(category)}
                >
                  {
                    {
                      all: locale === "es" ? "Todos" : "All",
                      effects: locale === "es" ? "Efectos" : "Effects",
                      music: locale === "es" ? "Música" : "Music",
                      nature: locale === "es" ? "Naturaleza" : "Nature",
                      actions: locale === "es" ? "Acciones" : "Actions",
                    }[category]
                  }
                </button>
              ))}
            </div>
            <div className="kids-sound-gallery-grid">
              {KIDS_SOUNDS.filter(
                (item) => soundCategory === "all" || item.category === soundCategory,
              ).map((item) => (
                <div className="kids-sound-gallery-card" key={item.id}>
                  <strong>{t(item.nameKey)}</strong>
                  <div>
                    <button
                      type="button"
                      className="kids-button"
                      aria-label={`${locale === "es" ? "Escuchar" : "Listen"} ${t(item.nameKey)}`}
                      onClick={() => void playKidsSound(item.id, avatarArt)}
                    >
                      ▶
                    </button>
                    <button
                      type="button"
                      className="kids-button kids-primary"
                      aria-label={`${locale === "es" ? "Elegir" : "Choose"} ${t(item.nameKey)}`}
                      onClick={() => {
                        change(
                          setKidsBlockSound(
                            history,
                            soundTarget.index,
                            item.id,
                            soundTarget.childIndex,
                          ),
                          "sequenceChange",
                        );
                        setSoundTarget(null);
                      }}
                    >
                      {locale === "es" ? "Elegir" : "Choose"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {oriSuggestions && oriFloatEnabled ? (
        <div className="kids-ori-float-zone">
          <button
            type="button"
            ref={oriTrigger}
            className="kids-ori-float-trigger"
            data-ori-state={oriMotion}
            data-ori-paused={!oriPageVisible}
            aria-label={
              oriOffer?.proposal
                ? t("openOriProposal")
                : locale === "es"
                  ? "Abrir ayuda de Ori"
                  : "Open Ori help"
            }
            onClick={() => setOriOpen(true)}
          >
            <KidsSprite
              slot="ori"
              expression={expressionForMotion(oriMotion, outcomeOfOffer(oriOffer?.kind))}
            />
            <span>{oriMotion === "idle" ? t("oriIdle") : oriMotionStatus(oriMotion, locale)}</span>
          </button>
          {oriOpen ? (
            <div
              className="kids-ori-panel-layer"
              role="dialog"
              aria-label={
                oriOffer?.proposal
                  ? t("oriProposalTitle")
                  : locale === "es"
                    ? "Ayuda de Ori"
                    : "Ori help"
              }
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  closeOriPanel();
                }
              }}
            >
              <div className="kids-ori-float-dialog">
                <button
                  type="button"
                  className="kids-button kids-ori-float-close"
                  autoFocus
                  onClick={closeOriPanel}
                >
                  {t("closeOriProposal")}
                </button>
                <div className="kids-ori-stage">
                  <KidsSprite
                    slot="ori"
                    expression={expressionForMotion(
                      oriOpen && oriOffer?.proposal ? "proposal" : oriMotion,
                      outcomeOfOffer(oriOffer?.kind),
                    )}
                    talking
                  />
                </div>
                {oriOffer?.proposal ? (
                  oriCard(true)
                ) : (
                  <p className="kids-ori-guide-message">
                    {locale === "es"
                      ? freeProjectId && !freeGoal
                        ? "Elegí qué querés lograr en tu mundo. Después podemos pensar los bloques juntos."
                        : "Seguí creando. Si tengo una idea para tu programa, vas a poder revisarla antes de usarla."
                      : freeProjectId && !freeGoal
                        ? "Choose what you want to achieve in your world. Then we can think about the blocks together."
                        : "Keep creating. If I have an idea for your program, you can review it before using it."}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {menu ? (
        <div
          ref={menuRef}
          className="kids-block-menu"
          role="menu"
          aria-label={t("blockMenu")}
          style={{ left: menu.x, top: menu.y }}
          onKeyDown={(event) => {
            const items = [
              ...event.currentTarget.querySelectorAll<HTMLElement>("[role='menuitem']"),
            ];
            const current = items.indexOf(document.activeElement as HTMLElement);
            if (event.key === "Escape") {
              event.preventDefault();
              setMenu(null);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Tab") {
              event.preventDefault();
              const delta = event.key === "ArrowUp" || event.shiftKey ? -1 : 1;
              items[(current + delta + items.length) % items.length]?.focus();
            }
          }}
        >
          <button type="button" role="menuitem" onClick={() => menuAction("duplicate")}>
            {t("duplicate")}
          </button>
          <button type="button" role="menuitem" onClick={() => menuAction("delete")}>
            {t("deleteBlock")}
          </button>
          <button type="button" role="menuitem" onClick={() => menuAction("explain")}>
            {t("explainBlock")}
          </button>
        </div>
      ) : null}
      {explanation ? (
        <p className="kids-block-explanation" role="status">
          {explanation}
          <button type="button" onClick={() => setExplanation("")} aria-label={t("close")}>
            ×
          </button>
        </p>
      ) : null}
      {shortcutsEnabled && helpOpen ? (
        <div className="kids-predict-backdrop">
          <div
            className="kids-shortcuts-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("shortcutsHelp")}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setHelpOpen(false);
              }
            }}
          >
            <h2>{t("shortcutsHelp")}</h2>
            <ul>
              {KIDS_SHORTCUTS.map((item) => (
                <li key={item.id}>
                  <kbd>{item.key}</kbd> {t(`shortcut_${item.id}`)}
                </li>
              ))}
            </ul>
            <button type="button" autoFocus onClick={() => setHelpOpen(false)}>
              {t("close")}
            </button>
          </div>
        </div>
      ) : null}
      {pending ? (
        <div className="kids-predict-backdrop">
          <div
            className="kids-predict-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kids-predict-title"
          >
            <h2 id="kids-predict-title">{t("predictQ", { s: avatar, g: style.goalGlyph })}</h2>
            {spriteImage(avatarArt, customImagesEnabled) ? (
              <KidsSprite
                slot={avatarArt}
                className="kids-predict-avatar"
                label={avatarArt.kind === "custom" ? t("customExplorer") : undefined}
              />
            ) : null}
            <div>
              {(["yes", "no", "dunno"] as const).map((answer) => (
                <button
                  type="button"
                  className="kids-button"
                  key={answer}
                  data-tutorial={coach === "predict" ? "target" : undefined}
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
