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
import { validateOriScoreProposal, type OriAdvancedDecision } from "@agorix/ori-agent";
import type { Locale } from "../../i18n.js";
import { advancedProjectId, completeAdvancedStage } from "../kidsAdvancedProgress.js";
import { requestAdvancedOri } from "../kidsAdvancedOriRemote.js";
import {
  addScoreStatement,
  removeScoreStatement,
  scoreStatements,
  type ScoreStatement,
} from "../kidsAdvancedScoreEditorModel.js";

interface Props {
  readonly locale: Locale;
  readonly onBack: () => void;
}

const addOne: ScoreStatement = {
  type: "changeVariable",
  variableId: "score",
  delta: { type: "numericLiteral", value: 1 },
};
const setTwo: ScoreStatement = {
  type: "setVariable",
  variableId: "score",
  value: { type: "numericLiteral", value: 2 },
};

export function AdvancedScoreScreen({ locale, onBack }: Props) {
  const [store] = useState(() => new ProjectStore());
  const mission = useMemo(() => getKidsAdvancedMission("score", locale), [locale]);
  const id = advancedProjectId("score");
  const [metadata, setMetadata] = useState<ProjectMetadata>(() => store.load(id).metadata);
  const [history, setHistory] = useState<EditorHistory>(() =>
    createEditorHistory(store.load(id).program),
  );
  const currentProgram = useRef(history.current);
  const [run, setRun] = useState<MultiActorRunResult | null>(null);
  const [completed, setCompleted] = useState(metadata.missionProgress === 1);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [language, setLanguage] = useState<"agorix" | "python" | "typescript">("agorix");
  const [error, setError] = useState(false);
  const [oriBusy, setOriBusy] = useState(false);
  const [oriDecision, setOriDecision] = useState<OriAdvancedDecision | null>(null);
  const [oriChanged, setOriChanged] = useState(false);
  const statements = scoreStatements(history.current);
  const score = run?.actors.find((actor) => actor.id === "actor:ori")?.world.variables?.score;
  const shownValue = score?.visible
    ? score.value
    : (history.current.variables?.[0]?.initialValue ?? 0);
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
          stage: "Nivel avanzado · Etapa 3",
          watcher: "Puntaje",
          blocks: "Bloques del puntaje",
          add: "Sumar 1",
          set: "Poner en 2",
          play: "Jugar",
          predict: "Antes de jugar, ¿qué número pensás que aparecerá?",
          ready: "Agregá un bloque y mirá cómo cambia el puntaje.",
          success: "¡Puntaje logrado!",
          tryAgain: "El puntaje todavía no cambió. Probá otro bloque.",
          reflection:
            "Esperabas {expected} y el puntaje mostró {actual}. ¿Qué bloque hizo el cambio?",
          reflectionNoPrediction: "El puntaje mostró {actual}. ¿Qué bloque hizo el cambio?",
          error: "No se pudo guardar o ejecutar este puntaje. Probá de nuevo.",
          undo: "Deshacer",
          redo: "Rehacer",
          remove: "Quitar",
          code: "Código del programa",
          ori: "Pedirle una idea a Ori",
          oriBusy: "Ori está pensando…",
          oriAdd: "Ori propone agregar",
          oriAccept: "Agregar bloque",
          oriChange: "Cambiar bloque",
          oriReject: "No usar",
        }
      : {
          back: "Back to map",
          stage: "Advanced level · Stage 3",
          watcher: "Score",
          blocks: "Score blocks",
          add: "Add 1",
          set: "Set to 2",
          play: "Play",
          predict: "Before playing, what number do you think will appear?",
          ready: "Add a block and watch the score change.",
          success: "Score complete!",
          tryAgain: "The score has not changed yet. Try another block.",
          reflection:
            "You expected {expected} and the score showed {actual}. Which block changed it?",
          reflectionNoPrediction: "The score showed {actual}. Which block changed it?",
          error: "This score could not be saved or run. Please try again.",
          undo: "Undo",
          redo: "Redo",
          remove: "Remove",
          code: "Program code",
          ori: "Ask Ori for an idea",
          oriBusy: "Ori is thinking…",
          oriAdd: "Ori suggests adding",
          oriAccept: "Add block",
          oriChange: "Change block",
          oriReject: "Don't use",
        };

  function persist(next: EditorHistory) {
    const nextMetadata: ProjectMetadata = { ...metadata, updatedAt: new Date().toISOString() };
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

  function add(statement: ScoreStatement) {
    try {
      persist(addScoreStatement(history, statement));
    } catch {
      setError(true);
    }
  }

  function play() {
    try {
      const result = runMultiActorProgram(history.current, mission.starterCreative);
      setRun(result);
      if (evaluateKidsAdvancedMission("score", result) && completeAdvancedStage("score", store))
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
        { stage: "score", actorId: "actor:ori", locale, program: atRequest },
        store,
      );
      if (JSON.stringify(currentProgram.current) === JSON.stringify(atRequest))
        setOriDecision(decision);
    } finally {
      setOriBusy(false);
    }
  }

  function decideOri(action: "accept" | "change" | "reject") {
    const proposal = oriDecision?.proposal;
    if (!proposal) return;
    try {
      const review = validateOriScoreProposal(
        { stage: "score", actorId: "actor:ori", locale, program: history.current },
        proposal,
      );
      if (action === "reject") {
        rejectProposal(history.current, review);
        setOriDecision(null);
        return;
      }
      let next = review.candidateProgram;
      if (action === "change") {
        const operation = proposal.operations[0];
        if (operation?.type !== "appendStatement") throw new Error("invalid score block");
        const replacement = operation.statement.type === "setVariable" ? addOne : setTwo;
        const script = history.current.scripts[0]!;
        next = modifyProposal(history.current, review, {
          ...history.current,
          scripts: [{ ...script, statements: [...script.statements, replacement] }],
        }).program;
      } else next = acceptProposal(history.current, review).program;
      persist(
        recordCanonicalTransaction(history, { label: "Ori score idea", after: next }).history,
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
    ? oriType === "setVariable"
      ? copy.add
      : copy.set
    : oriType === "setVariable"
      ? copy.set
      : copy.add;
  const success = run !== null && evaluateKidsAdvancedMission("score", run);
  const reflection = (prediction === null ? copy.reflectionNoPrediction : copy.reflection)
    .replace("{expected}", String(prediction))
    .replace("{actual}", String(shownValue));

  return (
    <section
      className="kids-editor kids-advanced-scene kids-advanced-score"
      aria-labelledby="kids-score-title"
    >
      <header className="kids-editor-header">
        <button type="button" className="kids-button" onClick={onBack}>
          {copy.back}
        </button>
        <div>
          <p className="kids-editor-kicker">{copy.stage}</p>
          <h1 id="kids-score-title">{mission.title}</h1>
        </div>
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
          <div
            className="kids-advanced-score-watcher"
            role="status"
            aria-label={`${copy.watcher}: ${shownValue}`}
          >
            <span>{copy.watcher}</span>
            <strong>{shownValue}</strong>
          </div>
          <fieldset className="kids-advanced-score-prediction">
            <legend>{copy.predict}</legend>
            {[1, 2, 3].map((value) => (
              <button
                key={value}
                type="button"
                className="kids-button"
                aria-pressed={prediction === value}
                onClick={() => setPrediction(value)}
              >
                {value}
              </button>
            ))}
          </fieldset>
          <button type="button" className="kids-button kids-primary" onClick={play}>
            {copy.play}
          </button>
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
                  {copy.oriAdd} <strong>+ {oriLabel}</strong>
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
          {run ? <p className="kids-note">{reflection}</p> : null}
        </div>
        <div className="kids-editor-program-panel">
          <h2>{copy.blocks}</h2>
          <div className="kids-program-stack">
            <div className="kids-start-block">▶ {copy.play}</div>
            <ul>
              {statements.map((statement, index) => (
                <li key={index} className="kids-program-block kids-block-sound">
                  <div className="kids-block-line">
                    <span>{statement.type === "setVariable" ? copy.set : copy.add}</span>
                    <button
                      type="button"
                      className="kids-block-remove"
                      aria-label={`${copy.remove} ${index + 1}`}
                      onClick={() => {
                        try {
                          persist(removeScoreStatement(history, index));
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
                onClick={() => add(addOne)}
              >
                + {copy.add}
              </button>
              <button
                type="button"
                className="kids-palette-block kids-block-sound"
                onClick={() => add(setTwo)}
              >
                + {copy.set}
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
