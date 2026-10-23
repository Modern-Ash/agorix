import { useMemo, useRef, useState } from "react";
import {
  createEditorHistory,
  recordCanonicalTransaction,
  redoCanonicalTransaction,
  undoCanonicalTransaction,
  type EditorHistory,
} from "@agorix/block-editor";
import { projectAgorixCode } from "@agorix/agorix-code";
import { projectProgram } from "@agorix/code-generator";
import { evaluateKidsAdvancedMission, getKidsAdvancedMission } from "@agorix/curriculum";
import { runMultiActorProgram, type MultiActorRunResult } from "@agorix/runtime";
import { projectPython } from "@agorix/python-projection";
import { ProjectStore, type ProjectMetadata } from "@agorix/persistence";
import { acceptProposal, modifyProposal, rejectProposal } from "@agorix/proposals";
import { validateOriReactProposal, type OriAdvancedDecision } from "@agorix/ori-agent";
import type { Locale } from "../../i18n.js";
import type { AdvancedSceneActorId } from "../kidsAdvancedEditorModel.js";
import { advancedProjectId, completeAdvancedStage } from "../kidsAdvancedProgress.js";
import { requestAdvancedOri } from "../kidsAdvancedOriRemote.js";
import {
  addReactStatement,
  creativeForReactProgram,
  reactActorStatements,
  removeReactStatement,
  type ReactStatement,
} from "../kidsAdvancedReactEditorModel.js";
import { useKidsText } from "../useKidsText.js";
import { ListenButton } from "./ListenButton.js";

interface Props {
  readonly locale: Locale;
  readonly readAloud?: boolean;
  readonly onBack: () => void;
}
const ACTORS: readonly AdvancedSceneActorId[] = ["actor:ori", "actor:friend"];

export function AdvancedReactScreen({ locale, readAloud = true, onBack }: Props) {
  const t = useKidsText(locale);
  const [store] = useState(() => new ProjectStore());
  const mission = useMemo(() => getKidsAdvancedMission("react", locale), [locale]);
  const id = advancedProjectId("react");
  const [metadata, setMetadata] = useState<ProjectMetadata>(() => store.load(id).metadata);
  const [history, setHistory] = useState<EditorHistory>(() =>
    createEditorHistory(store.load(id).program),
  );
  const currentProgram = useRef(history.current);
  const [actorId, setActorId] = useState<AdvancedSceneActorId>("actor:ori");
  const currentActor = useRef(actorId);
  const [run, setRun] = useState<MultiActorRunResult | null>(null);
  const [completed, setCompleted] = useState(metadata.missionProgress === 1);
  const [language, setLanguage] = useState<"agorix" | "python" | "typescript">("agorix");
  const [error, setError] = useState(false);
  const [oriBusy, setOriBusy] = useState(false);
  const [oriDecision, setOriDecision] = useState<OriAdvancedDecision | null>(null);
  const [oriChanged, setOriChanged] = useState(false);
  const creative = useMemo(
    () => creativeForReactProgram(mission.starterCreative, history.current),
    [mission.starterCreative, history.current],
  );
  const statements = reactActorStatements(history.current, actorId);
  const code =
    language === "python"
      ? projectPython(history.current).text
      : language === "typescript"
        ? projectProgram(history.current).code
        : projectAgorixCode(history.current).text;
  const copy =
    locale === "es"
      ? {
          back: "Volver al mapa",
          stage: "Nivel avanzado · Etapa 2",
          actors: "Personajes",
          blocks: "Bloques de",
          event: "Cuando tocás al personaje",
          tap: "Tocar a",
          costume: "Cambiar disfraz",
          sound: "Tocar sonido",
          turn: "Girar",
          undo: "Deshacer",
          redo: "Rehacer",
          code: "Código del programa",
          remove: "Quitar",
          ready: "Agregá una acción y tocá un personaje para probar su reacción.",
          success: "¡Reacción lograda! ¿Qué cambió cuando tocaste al personaje?",
          tryAgain: "Todavía falta una reacción visible del personaje que tocaste.",
          error: "No se pudo guardar o ejecutar esta reacción. Probá de nuevo.",
          ori: "Pedirle una idea a Ori",
          oriBusy: "Ori está pensando…",
          oriAdd: "Ori propone agregar",
          oriAccept: "Agregar bloque",
          oriChange: "Cambiar bloque",
          oriReject: "No usar",
        }
      : {
          back: "Back to map",
          stage: "Advanced level · Stage 2",
          actors: "Characters",
          blocks: "Blocks for",
          event: "When you tap the character",
          tap: "Tap",
          costume: "Switch costume",
          sound: "Play sound",
          turn: "Turn",
          undo: "Undo",
          redo: "Redo",
          code: "Program code",
          remove: "Remove",
          ready: "Add an action and tap a character to test its reaction.",
          success: "Reaction complete! What changed when you tapped the character?",
          tryAgain: "The character you tapped still needs a visible reaction.",
          error: "This reaction could not be saved or run. Please try again.",
          ori: "Ask Ori for an idea",
          oriBusy: "Ori is thinking…",
          oriAdd: "Ori suggests adding",
          oriAccept: "Add block",
          oriChange: "Change block",
          oriReject: "Don't use",
        };

  function persist(next: EditorHistory) {
    const nextCreative = creativeForReactProgram(mission.starterCreative, next.current);
    const nextMetadata: ProjectMetadata = {
      ...metadata,
      updatedAt: new Date().toISOString(),
      actors: { activeId: actorId, items: nextCreative.actors ?? [] },
      ...(nextCreative.stage ? { stage: nextCreative.stage } : {}),
      ...(nextCreative.assets ? { assets: nextCreative.assets } : {}),
    };
    try {
      store.save(id, next.current, nextMetadata);
      currentProgram.current = next.current;
      setMetadata(nextMetadata);
      setHistory(next);
      setRun(null);
      setError(false);
      setOriDecision(null);
    } catch {
      setError(true);
    }
  }

  function add(statement: ReactStatement) {
    try {
      persist(addReactStatement(history, actorId, statement));
    } catch {
      setError(true);
    }
  }

  function tap(id: AdvancedSceneActorId) {
    const event = { type: "actorClicked" as const, actorId: id };
    try {
      const result = runMultiActorProgram(history.current, creative, { events: [event] });
      setRun(result);
      if (
        evaluateKidsAdvancedMission("react", result) &&
        completeAdvancedStage("react", store, event)
      )
        setCompleted(true);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function askOri() {
    setOriBusy(true);
    setOriDecision(null);
    setOriChanged(false);
    const atRequest = history.current;
    try {
      const decision = await requestAdvancedOri(
        { stage: "react", actorId, locale, program: atRequest },
        store,
      );
      if (
        JSON.stringify(currentProgram.current) === JSON.stringify(atRequest) &&
        currentActor.current === actorId
      )
        setOriDecision(decision);
    } finally {
      setOriBusy(false);
    }
  }

  function decideOri(action: "accept" | "change" | "reject") {
    const proposal = oriDecision?.proposal;
    if (!proposal) return;
    try {
      const context = { stage: "react" as const, actorId, locale, program: history.current };
      const review = validateOriReactProposal(context, proposal);
      if (action === "reject") {
        rejectProposal(history.current, review);
        setOriDecision(null);
        return;
      }
      let next = review.candidateProgram;
      if (action === "change") {
        const operation = proposal.operations[0];
        if (operation?.type !== "appendStatement") throw new Error("invalid event block");
        const replacement: ReactStatement =
          operation.statement.type === "switchCostume"
            ? { type: "turn", degrees: 90 }
            : { type: "switchCostume", costumeId: "asset:costume.spark" };
        const scripts = [...history.current.scripts];
        const script = scripts[operation.scriptIndex]!;
        scripts[operation.scriptIndex] = {
          ...script,
          statements: [...script.statements, replacement],
        };
        next = modifyProposal(history.current, review, { ...history.current, scripts }).program;
      } else next = acceptProposal(history.current, review).program;
      persist(
        recordCanonicalTransaction(history, { label: "Ori event idea", after: next }).history,
      );
    } catch {
      setOriDecision(null);
      setError(true);
    }
  }

  const oriOperation = oriDecision?.proposal?.operations[0];
  const oriType =
    oriOperation?.type === "appendStatement" ? oriOperation.statement.type : undefined;
  const oriLabel = oriChanged
    ? oriType === "switchCostume"
      ? copy.turn
      : copy.costume
    : oriType === "switchCostume"
      ? copy.costume
      : oriType === "turn"
        ? copy.turn
        : copy.sound;
  const success = run !== null && evaluateKidsAdvancedMission("react", run);

  return (
    <section
      className="kids-editor kids-advanced-scene kids-advanced-react"
      aria-labelledby="kids-react-title"
    >
      <header className="kids-editor-header">
        <button type="button" className="kids-button" onClick={onBack}>
          {copy.back}
        </button>
        <div>
          <p className="kids-editor-kicker">{copy.stage}</p>
          <h1 id="kids-react-title">{mission.title}</h1>
        </div>
        <ListenButton
          t={t}
          locale={locale}
          enabled={readAloud}
          text={run ? (success ? copy.success : copy.tryAgain) : mission.instruction}
        />
        <button
          type="button"
          className="kids-button"
          disabled={!history.canUndo}
          onClick={() => persist(undoCanonicalTransaction(history).history)}
        >
          {copy.undo}
        </button>
        <button
          type="button"
          className="kids-button"
          disabled={!history.canRedo}
          onClick={() => persist(redoCanonicalTransaction(history).history)}
        >
          {copy.redo}
        </button>
      </header>
      <div className="kids-editor-layout">
        <div className="kids-editor-stage-panel">
          <p className="kids-editor-goal">{mission.instruction}</p>
          <div className="kids-advanced-actors" role="group" aria-label={copy.actors}>
            {ACTORS.map((id) => {
              const actor = creative.actors?.find((item) => item.id === id);
              const final = run?.actors.find((item) => item.id === id);
              const changed = final?.world.sprite.costumeId === "asset:costume.spark";
              const turned = final?.world.sprite.heading !== actor?.direction;
              return (
                <div className="kids-advanced-react-actor" key={id}>
                  <button
                    type="button"
                    className="kids-advanced-actor"
                    aria-pressed={actorId === id}
                    onClick={() => {
                      currentActor.current = id;
                      setActorId(id);
                      setOriDecision(null);
                    }}
                  >
                    <span className="kids-advanced-actor-glyph" aria-hidden="true">
                      {id === "actor:ori" ? "🦊" : "🐼"}
                    </span>
                    <strong>{actor?.name ?? id}</strong>
                    {changed ? <span>{copy.costume}</span> : null}
                    {turned ? <span>{copy.turn}</span> : null}
                  </button>
                  <button
                    type="button"
                    className="kids-button kids-primary"
                    onClick={() => tap(id)}
                  >
                    {copy.tap} {actor?.name ?? id}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="kids-advanced-ori">
            <button
              type="button"
              className="kids-button"
              disabled={oriBusy}
              onClick={() => void askOri()}
            >
              {oriBusy ? copy.oriBusy : copy.ori}
            </button>
            {oriDecision?.proposal ? (
              <div className="kids-advanced-ori-review" aria-label={copy.oriAdd}>
                <p>{oriDecision.message}</p>
                <p>
                  {copy.oriAdd} <strong>+ {oriLabel}</strong>{" "}
                  {creative.actors?.find((actor) => actor.id === actorId)?.name}
                </p>
                <button
                  type="button"
                  className="kids-button kids-primary"
                  onClick={() => decideOri(oriChanged ? "change" : "accept")}
                >
                  {copy.oriAccept}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  onClick={() => setOriChanged(!oriChanged)}
                >
                  {copy.oriChange}
                </button>
                <button type="button" className="kids-button" onClick={() => decideOri("reject")}>
                  {copy.oriReject}
                </button>
              </div>
            ) : null}
          </div>
          <p className="kids-run-status" role="status">
            {error
              ? copy.error
              : success || completed
                ? copy.success
                : run
                  ? copy.tryAgain
                  : copy.ready}
          </p>
          {success ? <p className="kids-note">{mission.reflection}</p> : null}
        </div>
        <div className="kids-editor-program-panel">
          <h2>
            {copy.blocks} {creative.actors?.find((actor) => actor.id === actorId)?.name}
          </h2>
          <div className="kids-program-stack">
            <div className="kids-start-block">▶ {copy.event}</div>
            <ul>
              {statements.map((statement, index) => (
                <li key={`${actorId}-${index}`} className="kids-program-block kids-block-sound">
                  <div className="kids-block-line">
                    <span>
                      {statement.type === "switchCostume"
                        ? copy.costume
                        : statement.type === "turn"
                          ? copy.turn
                          : copy.sound}
                    </span>
                    <button
                      type="button"
                      className="kids-block-remove"
                      aria-label={`${copy.remove} ${index + 1}`}
                      onClick={() => {
                        try {
                          persist(removeReactStatement(history, actorId, index));
                        } catch {
                          setError(true);
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="kids-palette" aria-label={copy.blocks}>
            <p>{copy.blocks}</p>
            <div>
              <button
                type="button"
                className="kids-palette-block kids-block-sound"
                onClick={() => add({ type: "switchCostume", costumeId: "asset:costume.spark" })}
              >
                + {copy.costume}
              </button>
              <button
                type="button"
                className="kids-palette-block kids-block-sound"
                onClick={() => add({ type: "playSound", soundId: "asset:sound.beacon" })}
              >
                + {copy.sound}
              </button>
              <button
                type="button"
                className="kids-palette-block kids-block-sound"
                onClick={() => add({ type: "turn", degrees: 90 })}
              >
                + {copy.turn}
              </button>
            </div>
          </div>
          <div className="kids-code-languages" role="group" aria-label={copy.code}>
            {(["agorix", "python", "typescript"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={language === item}
                onClick={() => setLanguage(item)}
              >
                {item === "agorix"
                  ? "Agorix Code"
                  : item === "typescript"
                    ? "TypeScript"
                    : "Python"}
              </button>
            ))}
          </div>
          <pre className="kids-code-strip" aria-label={copy.code} tabIndex={0}>
            {code}
          </pre>
        </div>
      </div>
    </section>
  );
}
