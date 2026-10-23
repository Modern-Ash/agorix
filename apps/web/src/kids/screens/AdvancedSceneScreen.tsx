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
import { getKidsAdvancedMission, evaluateKidsAdvancedMission } from "@agorix/curriculum";
import { projectPython } from "@agorix/python-projection";
import { ProjectStore, type ProjectMetadata } from "@agorix/persistence";
import { runMultiActorProgram, type MultiActorRunResult } from "@agorix/runtime";
import { acceptProposal, rejectProposal, modifyProposal } from "@agorix/proposals";
import { validateOriAdvancedProposal, type OriAdvancedDecision } from "@agorix/ori-agent";
import type { Locale } from "../../i18n.js";
import {
  advancedActorStatements,
  addAdvancedStatement,
  creativeForAdvancedProgram,
  removeAdvancedStatement,
  replaceAdvancedStatement,
  type AdvancedSceneActorId,
  type AdvancedSceneStatement,
} from "../kidsAdvancedEditorModel.js";
import { advancedProjectId, completeAdvancedStage } from "../kidsAdvancedProgress.js";
import { requestAdvancedOri } from "../kidsAdvancedOriRemote.js";
import { useKidsText } from "../useKidsText.js";
import { ListenButton } from "./ListenButton.js";

interface Props {
  readonly locale: Locale;
  readonly readAloud?: boolean;
  readonly onBack: () => void;
}

const ACTORS: readonly AdvancedSceneActorId[] = ["actor:ori", "actor:friend"];

function playSceneTone(): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    oscillator.onended = () => void context.close();
  } catch {
    // Runtime evidence still works if audio is unavailable.
  }
}

export function AdvancedSceneScreen({ locale, readAloud = true, onBack }: Props) {
  const t = useKidsText(locale);
  const [store] = useState(() => new ProjectStore());
  const mission = useMemo(() => getKidsAdvancedMission("scene", locale), [locale]);
  const id = advancedProjectId("scene");
  const [metadata, setMetadata] = useState<ProjectMetadata>(() => {
    try {
      return store.load(id).metadata;
    } catch {
      return {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        missionProgress: 0,
        hintLevel: 0,
        locale,
      };
    }
  });
  const [history, setHistory] = useState<EditorHistory>(() => {
    try {
      return createEditorHistory(store.load(id).program);
    } catch {
      return createEditorHistory(mission.starterProgram);
    }
  });
  const [actorId, setActorId] = useState<AdvancedSceneActorId>("actor:ori");
  const currentProgram = useRef(history.current);
  const currentActor = useRef(actorId);
  const [run, setRun] = useState<MultiActorRunResult | null>(null);
  const [completed, setCompleted] = useState(metadata.missionProgress === 1);
  const [language, setLanguage] = useState<"agorix" | "python" | "typescript">("agorix");
  const [error, setError] = useState(false);
  const [oriBusy, setOriBusy] = useState(false);
  const [oriDecision, setOriDecision] = useState<OriAdvancedDecision | null>(null);
  const [oriChanged, setOriChanged] = useState(false);
  const creative = useMemo(
    () => creativeForAdvancedProgram(mission.starterCreative, history.current),
    [mission.starterCreative, history.current],
  );
  const statements = advancedActorStatements(history.current, actorId);
  const oriOperation = oriDecision?.proposal?.operations[0];
  const oriSuggestedCostume =
    oriOperation?.type === "appendStatement" && oriOperation.statement.type === "switchCostume";
  const code =
    language === "python"
      ? projectPython(history.current).text
      : language === "typescript"
        ? projectProgram(history.current).code
        : projectAgorixCode(history.current).text;

  function persist(next: EditorHistory) {
    const nextCreative = creativeForAdvancedProgram(mission.starterCreative, next.current);
    const nextMetadata: ProjectMetadata = {
      ...metadata,
      updatedAt: new Date().toISOString(),
      actors: { activeId: actorId, items: nextCreative.actors ?? [] },
      ...(nextCreative.stage === undefined ? {} : { stage: nextCreative.stage }),
      ...(nextCreative.assets === undefined ? {} : { assets: nextCreative.assets }),
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

  function add(statement: AdvancedSceneStatement) {
    try {
      persist(addAdvancedStatement(history, actorId, statement));
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
        { stage: "scene", actorId, locale, program: atRequest },
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
      const context = { stage: "scene" as const, actorId, locale, program: history.current };
      const review = validateOriAdvancedProposal(context, proposal);
      if (action === "reject") {
        rejectProposal(history.current, review);
        setOriDecision(null);
        return;
      }
      let next = review.candidateProgram;
      if (action === "change") {
        const operation = proposal.operations[0];
        if (operation?.type !== "appendStatement") throw new Error("invalid Ori block");
        const replacement: AdvancedSceneStatement =
          operation.statement.type === "switchCostume"
            ? { type: "playSound", soundId: "asset:sound.beacon" }
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
        recordCanonicalTransaction(history, { label: "Ori scene idea", after: next }).history,
      );
    } catch {
      setOriDecision(null);
      setError(true);
    }
  }

  function play() {
    try {
      const result = runMultiActorProgram(history.current, creative);
      setRun(result);
      if (result.trace.some((entry) => entry.statementType === "playSound")) playSceneTone();
      if (evaluateKidsAdvancedMission("scene", result) && completeAdvancedStage("scene", store))
        setCompleted(true);
      setError(false);
    } catch {
      setError(true);
    }
  }

  const success = run !== null && evaluateKidsAdvancedMission("scene", run);
  const copy =
    locale === "es"
      ? {
          back: "Volver al mapa",
          stage: "Nivel avanzado · Etapa 1",
          actors: "Personajes",
          blocks: "Bloques de",
          costume: "Cambiar disfraz",
          sound: "Tocar sonido",
          play: "Jugar",
          undo: "Deshacer",
          redo: "Rehacer",
          code: "Código del programa",
          result: "Ori y su amiga en escena",
          world: "Mundo",
          changed: "Cambió de disfraz",
          heard: "Sonó el pulso",
          success: "¡Escena lograda! Mirá cuál personaje cambió y qué sonido hizo.",
          tryAgain: "Todavía falta un cambio de disfraz y un sonido del mismo personaje.",
          ready: "Elegí un personaje, agregá bloques y jugá la escena.",
          error: "No se pudo guardar o ejecutar esta escena. Probá de nuevo.",
          spark: "Destello",
          default: "Ori",
          ping: "Pulso",
          remove: "Quitar",
          ori: "Pedirle una idea a Ori",
          oriBusy: "Ori está pensando…",
          oriAdd: "Ori propone agregar",
          oriAccept: "Agregar bloque",
          oriChange: "Cambiar bloque",
          oriReject: "No usar",
        }
      : {
          back: "Back to map",
          stage: "Advanced level · Stage 1",
          actors: "Characters",
          blocks: "Blocks for",
          costume: "Switch costume",
          sound: "Play sound",
          play: "Run",
          undo: "Undo",
          redo: "Redo",
          code: "Program code",
          result: "Ori and a friend on stage",
          world: "World",
          changed: "Costume changed",
          heard: "Ping played",
          success: "Scene complete! Which character changed, and what sound did they play?",
          tryAgain: "Try changing a costume and playing a sound for the same character.",
          ready: "Choose a character, add blocks, then run the scene.",
          error: "This scene could not be saved or run. Please try again.",
          spark: "Spark",
          default: "Ori",
          ping: "Ping",
          remove: "Remove",
          ori: "Ask Ori for an idea",
          oriBusy: "Ori is thinking…",
          oriAdd: "Ori suggests adding",
          oriAccept: "Add block",
          oriChange: "Change block",
          oriReject: "Don't use",
        };

  return (
    <section className="kids-editor kids-advanced-scene" aria-labelledby="kids-advanced-title">
      <header className="kids-editor-header">
        <button type="button" className="kids-button" onClick={onBack}>
          {copy.back}
        </button>
        <div>
          <p className="kids-editor-kicker">{copy.stage}</p>
          <h1 id="kids-advanced-title">{mission.title}</h1>
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
          <h2 className="kids-advanced-world-title">{copy.world}</h2>
          <div className="kids-advanced-actors" role="group" aria-label={copy.actors}>
            {ACTORS.map((id) => {
              const actor = creative.actors?.find((item) => item.id === id);
              const final = run?.actors.find((item) => item.id === id);
              const changed = final?.world.sprite.costumeId === "asset:costume.spark";
              const heard = (final?.world.sounds?.activeSoundIds.length ?? 0) > 0;
              return (
                <button
                  key={id}
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
                  {changed ? <span>{copy.changed}</span> : null}
                  {heard ? <span>{copy.heard}</span> : null}
                </button>
              );
            })}
          </div>
          <p className="kids-note">{copy.result}</p>
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
                  {copy.oriAdd}{" "}
                  <strong>
                    + {oriChanged === oriSuggestedCostume ? copy.sound : copy.costume}
                  </strong>{" "}
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
          <div className="kids-run-controls">
            <button type="button" className="kids-button kids-primary" onClick={play}>
              {copy.play}
            </button>
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
            <div className="kids-start-block">▶ {locale === "es" ? "Al jugar" : "When run"}</div>
            <ul>
              {statements.map((statement, index) => (
                <li key={`${actorId}-${index}`} className="kids-program-block kids-block-sound">
                  <div className="kids-block-line">
                    <span>{statement.type === "switchCostume" ? copy.costume : copy.sound}</span>
                    {statement.type === "switchCostume" ? (
                      <select
                        aria-label={`${copy.costume} ${index + 1}`}
                        value={statement.costumeId}
                        onChange={(event) =>
                          persist(
                            replaceAdvancedStatement(history, actorId, index, {
                              type: "switchCostume",
                              costumeId: event.target.value,
                            }),
                          )
                        }
                      >
                        <option value="asset:costume.default">{copy.default}</option>
                        <option value="asset:costume.spark">{copy.spark}</option>
                      </select>
                    ) : statement.type === "playSound" ? (
                      <select aria-label={`${copy.sound} ${index + 1}`} value={statement.soundId}>
                        <option value="asset:sound.beacon">{copy.ping}</option>
                      </select>
                    ) : null}
                    <button
                      type="button"
                      className="kids-block-remove"
                      aria-label={`${copy.remove} ${index + 1}`}
                      onClick={() => persist(removeAdvancedStatement(history, actorId, index))}
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
