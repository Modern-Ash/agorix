import { useMemo, useRef, useState, type ChangeEvent } from "react";
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
import {
  parseAgorixProject,
  ProjectStore,
  sanitizeAgorixFilename,
  serializeAgorixProject,
  type ProjectMetadata,
} from "@agorix/persistence";
import { acceptProposal, modifyProposal, rejectProposal } from "@agorix/proposals";
import { validateOriScoreProposal, type OriAdvancedDecision } from "@agorix/ori-agent";
import type { Locale } from "../../i18n.js";
import { useOriPageVisible } from "../kidsOriMotion.js";
import { KidsSprite } from "./KidsArt.js";
import { advancedProjectId, completeAdvancedStage } from "../kidsAdvancedProgress.js";
import { useKidsFlag } from "../kidsFlags.js";
import { requestAdvancedOri } from "../kidsAdvancedOriRemote.js";
import {
  addScoreStatement,
  addScoreListOperation,
  createScoreList,
  removeScoreStatement,
  scoreDataStatements,
  scoreArithmetic,
  scoreArithmeticStatement,
  validateScoreDataProgram,
  type ScoreListOperation,
  type ScoreStatement,
} from "../kidsAdvancedScoreEditorModel.js";
import { useKidsText } from "../useKidsText.js";
import { ListenButton } from "./ListenButton.js";

interface Props {
  readonly locale: Locale;
  readonly readAloud?: boolean;
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

export function AdvancedScoreScreen({ locale, readAloud = true, onBack }: Props) {
  const t = useKidsText(locale);
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
  const [listInputError, setListInputError] = useState(false);
  const arithmeticEnabled = useKidsFlag("advancedOps");
  const [amount, setAmount] = useState(2);
  const [listValue, setListValue] = useState("1");
  const [listIndex, setListIndex] = useState("1");
  const [oriBusy, setOriBusy] = useState(false);
  const oriPageVisible = useOriPageVisible();
  const [oriDecision, setOriDecision] = useState<OriAdvancedDecision | null>(null);
  const [oriChanged, setOriChanged] = useState(false);
  const statements = scoreDataStatements(history.current);
  const list = history.current.lists?.[0];
  const listItems = list
    ? (run?.actors.find((actor) => actor.id === "actor:ori")?.world.lists?.[list.id]?.items ??
      list.initialItems)
    : [];
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
          createList: "Crear mi lista",
          listItems: "Mi lista",
          emptyList: "Vacía",
          number: "Número para agregar",
          position: "Posición (empieza en 1)",
          listAdd: "Agregar {n} a mi lista",
          listRemove: "Quitar posición {n}",
          listItem: "Poner elemento {n} en puntaje",
          listLength: "Poner largo de lista en puntaje",
          invalidListNumber: "Escribí un número entero entre -1000000 y 1000000.",
          export: "Exportar .agorix",
          import: "Importar .agorix",
          blocks: "Bloques del puntaje",
          add: "Sumar 1",
          set: "Poner en 2",
          plus: "Sumar {n} al puntaje",
          minus: "Restar {n} al puntaje",
          amount: "Cuánto",
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
          createList: "Create my list",
          listItems: "My list",
          emptyList: "Empty",
          number: "Number to add",
          position: "Position (starts at 1)",
          listAdd: "Add {n} to my list",
          listRemove: "Remove position {n}",
          listItem: "Set score to item {n}",
          listLength: "Set score to list length",
          invalidListNumber: "Enter a whole number between -1000000 and 1000000.",
          export: "Export .agorix",
          import: "Import .agorix",
          blocks: "Score blocks",
          add: "Add 1",
          set: "Set to 2",
          plus: "Add {n} to the score",
          minus: "Subtract {n} from the score",
          amount: "How much",
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
      setListInputError(false);
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

  function addList(operation: ScoreListOperation) {
    const raw = operation === "add" ? listValue : operation === "length" ? "0" : listIndex;
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isInteger(value) || Math.abs(value) > 1_000_000) {
      setListInputError(true);
      return;
    }
    try {
      persist(addScoreListOperation(history, operation, value));
    } catch {
      setError(true);
    }
  }

  function exportProject() {
    try {
      const blob = new Blob([serializeAgorixProject(store.load(id))], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; // agora-allowlist: local Blob download from validated .agorix serializer
      anchor.download = sanitizeAgorixFilename("mi-lista");
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseAgorixProject(await file.text()).project;
      const program = validateScoreDataProgram(parsed.program);
      persist(
        recordCanonicalTransaction(history, { label: "import score list", after: program }).history,
      );
    } catch {
      setError(true);
    } finally {
      event.target.value = "";
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
          <div
            className="kids-advanced-score-watcher"
            role="status"
            aria-label={`${copy.watcher}: ${shownValue}`}
          >
            <span>{copy.watcher}</span>
            <strong>{shownValue}</strong>
          </div>
          {list ? (
            <div
              className="kids-advanced-list-watcher"
              role="status"
              aria-label={`${copy.listItems}: ${listItems.length ? listItems.join(", ") : copy.emptyList}`}
            >
              <span>
                {copy.listItems} · {listItems.length}/100
              </span>
              {listItems.length ? (
                <ol>
                  {listItems.map((value, index) => (
                    <li key={index}>{value}</li>
                  ))}
                </ol>
              ) : (
                <strong>{copy.emptyList}</strong>
              )}
            </div>
          ) : null}
          <fieldset className="kids-advanced-score-prediction">
            <legend>{copy.predict}</legend>
            {(arithmeticEnabled ? [-2, -1, 0, 1, 2, 3, 4, 5] : [1, 2, 3]).map((value) => (
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
              className="kids-button kids-ori-action"
              data-ori-state={
                oriBusy
                  ? "thinking"
                  : oriDecision?.proposal
                    ? "proposal"
                    : oriDecision
                      ? "fallback"
                      : "idle"
              }
              data-ori-paused={!oriPageVisible}
              disabled={oriBusy}
              onClick={() => void askOri()}
            >
              <KidsSprite slot="ori" />
              <span>{oriBusy ? copy.oriBusy : copy.ori}</span>
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
            {listInputError
              ? copy.invalidListNumber
              : error
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
                    <span>
                      {(() => {
                        if (
                          statement.type === "listAdd" &&
                          statement.value.type === "numericLiteral"
                        )
                          return copy.listAdd.replace("{n}", String(statement.value.value));
                        if (
                          statement.type === "listRemoveAt" &&
                          statement.index.type === "numericLiteral"
                        )
                          return copy.listRemove.replace("{n}", String(statement.index.value));
                        if (
                          statement.type === "setVariable" &&
                          statement.value.type === "listItem" &&
                          statement.value.index.type === "numericLiteral"
                        )
                          return copy.listItem.replace("{n}", String(statement.value.index.value));
                        if (
                          statement.type === "setVariable" &&
                          statement.value.type === "listLength"
                        )
                          return copy.listLength;
                        if (statement.type !== "setVariable" && statement.type !== "changeVariable")
                          return copy.blocks;
                        const arithmetic = scoreArithmetic(statement);
                        if (arithmetic)
                          return (arithmetic.op === "add" ? copy.plus : copy.minus).replace(
                            "{n}",
                            String(arithmetic.amount),
                          );
                        return statement.type === "setVariable" ? copy.set : copy.add;
                      })()}
                    </span>
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
              {arithmeticEnabled ? (
                <>
                  <label>
                    {copy.amount}{" "}
                    <select
                      aria-label={copy.amount}
                      value={amount}
                      onChange={(event) => setAmount(Number(event.target.value))}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="kids-palette-block kids-block-sound"
                    onClick={() => add(scoreArithmeticStatement("add", amount))}
                  >
                    + {copy.plus.replace("{n}", String(amount))}
                  </button>
                  <button
                    type="button"
                    className="kids-palette-block kids-block-sound"
                    onClick={() => add(scoreArithmeticStatement("subtract", amount))}
                  >
                    + {copy.minus.replace("{n}", String(amount))}
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <div className="kids-palette kids-advanced-list-palette" aria-label={copy.listItems}>
            <p>{copy.listItems}</p>
            {list ? (
              <div>
                <label>
                  {copy.number}{" "}
                  <input
                    type="number"
                    step="1"
                    value={listValue}
                    onChange={(event) => {
                      setListValue(event.target.value);
                      setListInputError(false);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="kids-palette-block kids-block-sound"
                  onClick={() => addList("add")}
                >
                  + {copy.listAdd.replace("{n}", listValue)}
                </button>
                <label>
                  {copy.position}{" "}
                  <input
                    type="number"
                    step="1"
                    value={listIndex}
                    onChange={(event) => {
                      setListIndex(event.target.value);
                      setListInputError(false);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="kids-palette-block kids-block-sound"
                  onClick={() => addList("remove")}
                >
                  + {copy.listRemove.replace("{n}", listIndex)}
                </button>
                <button
                  type="button"
                  className="kids-palette-block kids-block-sound"
                  onClick={() => addList("item")}
                >
                  + {copy.listItem.replace("{n}", listIndex)}
                </button>
                <button
                  type="button"
                  className="kids-palette-block kids-block-sound"
                  onClick={() => addList("length")}
                >
                  + {copy.listLength}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="kids-palette-block kids-block-sound"
                onClick={() => {
                  try {
                    persist(createScoreList(history, locale));
                  } catch {
                    setError(true);
                  }
                }}
              >
                + {copy.createList}
              </button>
            )}
          </div>
          <div className="kids-advanced-file-actions">
            <button type="button" className="kids-button" onClick={exportProject}>
              {copy.export}
            </button>
            <label className="kids-button kids-import-label">
              {copy.import}
              <input
                type="file"
                accept=".agorix,application/json"
                onChange={(event) => void importProject(event)}
              />
            </label>
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
