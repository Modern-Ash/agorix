import { useMemo, useState, type ChangeEvent } from "react";
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
import {
  parseAgorixProject,
  ProjectStore,
  sanitizeAgorixFilename,
  serializeAgorixProject,
  type ProjectMetadata,
} from "@agorix/persistence";
import {
  acceptProposal,
  createProgramProposal,
  createProposalReview,
  rejectProposal,
  type ProposalReview,
} from "@agorix/proposals";
import { projectPython } from "@agorix/python-projection";
import { runMultiActorProgram, type MultiActorRunResult } from "@agorix/runtime";
import type { Locale } from "../../i18n.js";
import {
  addAdvancedOperation,
  controlStatement,
  messageStatement,
  removeAdvancedOperation,
  validateControlStageProgram,
  type ControlOperation,
  type ControlStage,
  type MessageOperation,
} from "../kidsAdvancedControlModel.js";
import { advancedProjectId, completeAdvancedStage } from "../kidsAdvancedProgress.js";
import { useKidsText } from "../useKidsText.js";
import { ListenButton } from "./ListenButton.js";

interface Props {
  readonly stage: ControlStage;
  readonly locale: Locale;
  readonly readAloud?: boolean;
  readonly onBack: () => void;
}

const LABELS = {
  es: {
    back: "Volver al mapa",
    play: "Jugar",
    undo: "Deshacer",
    redo: "Rehacer",
    remove: "Quitar",
    code: "Código del programa",
    blocks: "Bloques",
    first: "Primer número (0 a 100)",
    second: "Último número (0 a 100)",
    atLeast: "+ Si puntaje ≥ número, si no",
    lessThan: "+ Si puntaje < número, si no",
    random: "+ Poner puntaje al azar entre los números",
    wait: "+ Esperar segundos",
    send: "+ Enviar mensaje",
    oriReceive: "+ Ori recibe y mueve 1",
    friendReceive: "+ Amiga recibe y mueve 1",
    sender: "Al jugar",
    ori: "Al recibir: Ori",
    friend: "Al recibir: Amiga",
    score: "Puntaje",
    result: "Resultado del programa",
    thenBranch: "Entonces: puntaje 1",
    elseBranch: "Si no: puntaje 2",
    success: "¡Misión lograda!",
    tryAgain: "Probá otro bloque y jugá de nuevo.",
    invalid:
      "Usá números enteros de 0 a 100. Para azar, el último debe ser mayor o igual al primero; para esperar, hasta 10 segundos.",
    error: "No se pudo guardar o ejecutar el programa.",
    export: "Exportar .agorix",
    import: "Importar .agorix",
    ask: "Pedirle una idea a Ori",
    proposed: "Ori propone agregar",
    accept: "Agregar bloque",
    reject: "No usar",
  },
  en: {
    back: "Back to map",
    play: "Play",
    undo: "Undo",
    redo: "Redo",
    remove: "Remove",
    code: "Program code",
    blocks: "Blocks",
    first: "First number (0 to 100)",
    second: "Last number (0 to 100)",
    atLeast: "+ If score ≥ number, else",
    lessThan: "+ If score < number, else",
    random: "+ Set score to random between numbers",
    wait: "+ Wait seconds",
    send: "+ Send message",
    oriReceive: "+ Ori receives and moves 1",
    friendReceive: "+ Friend receives and moves 1",
    sender: "On play",
    ori: "On receive: Ori",
    friend: "On receive: Friend",
    score: "Score",
    result: "Program result",
    thenBranch: "Then: score 1",
    elseBranch: "Else: score 2",
    success: "Mission complete!",
    tryAgain: "Try another block and play again.",
    invalid:
      "Use whole numbers from 0 to 100. For random, the last must be at least the first; for wait, use up to 10 seconds.",
    error: "The program could not be saved or run.",
    export: "Export .agorix",
    import: "Import .agorix",
    ask: "Ask Ori for an idea",
    proposed: "Ori suggests adding",
    accept: "Add block",
    reject: "Don't use",
  },
} as const;

function label(statement: ReturnType<typeof controlStatement>, locale: Locale): string {
  if (statement.type === "wait")
    return `${locale === "es" ? "Esperar" : "Wait"} ${statement.seconds}`;
  if (statement.type === "broadcast") return locale === "es" ? "Enviar go" : "Send go";
  if (statement.type === "move") return locale === "es" ? "Mover 1" : "Move 1";
  if (statement.type === "setVariable" && statement.value.type === "randomInteger")
    return `${locale === "es" ? "Azar" : "Random"} ${statement.value.min.type === "numericLiteral" ? statement.value.min.value : "?"}–${statement.value.max.type === "numericLiteral" ? statement.value.max.value : "?"}`;
  if (statement.type === "if") {
    const symbol = statement.condition.type === "lessThan" ? "<" : "≥";
    const value =
      statement.condition.type === "lessThan" || statement.condition.type === "greaterOrEqual"
        ? statement.condition.right.type === "numericLiteral"
          ? statement.condition.right.value
          : "?"
        : "?";
    return `${locale === "es" ? "Si puntaje" : "If score"} ${symbol} ${value} · ${locale === "es" ? "si no" : "else"}`;
  }
  return statement.type;
}

function traceLabel(entry: MultiActorRunResult["trace"][number], locale: Locale): string {
  const actor = entry.actorId === "actor:friend" ? (locale === "es" ? "Amiga" : "Friend") : "Ori";
  const score = entry.worldAfter.variables?.score?.value;
  const action =
    entry.statementType === "broadcast"
      ? locale === "es"
        ? "envió un mensaje"
        : "sent a message"
      : entry.statementType === "move"
        ? locale === "es"
          ? "avanzó 1"
          : "moved 1"
        : entry.statementType === "wait"
          ? locale === "es"
            ? "esperó"
            : "waited"
          : entry.statementType === "if"
            ? locale === "es"
              ? "evaluó si"
              : "checked if"
            : score === undefined
              ? entry.statementType
              : `${locale === "es" ? "puntaje" : "score"} ${score}`;
  return `${actor}: ${action}`;
}

export function AdvancedControlScreen({ stage, locale, readAloud = true, onBack }: Props) {
  const t = useKidsText(locale);
  const copy = LABELS[locale];
  const mission = useMemo(() => getKidsAdvancedMission(stage, locale), [stage, locale]);
  const [store] = useState(() => new ProjectStore());
  const id = advancedProjectId(stage);
  const [metadata, setMetadata] = useState<ProjectMetadata>(() => store.load(id).metadata);
  const [history, setHistory] = useState<EditorHistory>(() =>
    createEditorHistory(store.load(id).program),
  );
  const [run, setRun] = useState<MultiActorRunResult | null>(null);
  const [first, setFirst] = useState("1");
  const [second, setSecond] = useState("3");
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState(false);
  const [language, setLanguage] = useState<"agorix" | "python" | "typescript">("agorix");
  const [proposal, setProposal] = useState<ProposalReview | null>(null);
  const [completed, setCompleted] = useState(metadata.missionProgress === 1);
  const code =
    language === "agorix"
      ? projectAgorixCode(history.current).text
      : language === "python"
        ? projectPython(history.current).text
        : projectProgram(history.current).code;
  const score =
    run?.actors.find((actor) => actor.id === "actor:ori")?.world.variables?.score?.value ?? 0;
  const success = run !== null && evaluateKidsAdvancedMission(stage, run);

  function persist(next: EditorHistory) {
    try {
      const program = validateControlStageProgram(next.current, stage);
      const updated = { ...metadata, updatedAt: new Date().toISOString() };
      store.save(id, program, updated);
      setMetadata(updated);
      setHistory(next);
      setRun(null);
      setProposal(null);
      setError(false);
      setInvalid(false);
    } catch {
      setError(true);
    }
  }

  function add(operation: ControlOperation | MessageOperation) {
    const a = Number(first),
      b = Number(second);
    if (
      stage === "control" &&
      (first.trim() === "" ||
        !Number.isInteger(a) ||
        (operation === "random" && (second.trim() === "" || !Number.isInteger(b))))
    ) {
      setInvalid(true);
      return;
    }
    try {
      persist(addAdvancedOperation(history, stage, operation, a, b));
    } catch {
      setInvalid(true);
    }
  }

  function play() {
    try {
      const result = runMultiActorProgram(history.current, mission.starterCreative, {
        randomSeed: 42,
      });
      setRun(result);
      if (evaluateKidsAdvancedMission(stage, result) && completeAdvancedStage(stage, store)) {
        setCompleted(true);
        setMetadata(store.load(id).metadata);
      }
      setError(false);
    } catch {
      setError(true);
    }
  }

  function askOri() {
    try {
      const operation: ControlOperation | MessageOperation =
        stage === "control"
          ? history.current.scripts[0]!.statements.some((s) => s.type === "wait")
            ? "atLeast"
            : "wait"
          : history.current.scripts[0]!.statements.length
            ? "friendReceive"
            : "send";
      const index = stage === "control" || operation === "send" ? 0 : 2;
      const statement =
        stage === "control"
          ? controlStatement(operation as ControlOperation, 1)
          : messageStatement(operation as MessageOperation);
      const nextIndex = history.current.scripts[index]!.statements.length;
      const offered = createProgramProposal({
        id: `kids-${stage}-${index}-${nextIndex}`,
        baseProgram: history.current,
        source: { kind: "deterministic-scaffold", capability: `kids-advanced-${stage}` },
        purpose: mission.instruction,
        rationale: mission.reflection,
        affectedNodeIds: [`scripts[${index}]/statements[${nextIndex}]`],
        operations: [{ type: "appendStatement", scriptIndex: index, statement }],
      });
      const review = createProposalReview(history.current, offered);
      validateControlStageProgram(review.candidateProgram, stage);
      setProposal(review);
    } catch {
      setError(true);
    }
  }

  function decide(accept: boolean) {
    if (!proposal) return;
    try {
      const program = accept
        ? acceptProposal(history.current, proposal).program
        : rejectProposal(history.current, proposal).program;
      if (accept)
        persist(recordCanonicalTransaction(history, { label: "Ori idea", after: program }).history);
      else setProposal(null);
    } catch {
      setProposal(null);
      setError(true);
    }
  }

  function exportProject() {
    try {
      const blob = new Blob([serializeAgorixProject(store.load(id))], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; // agora-allowlist: local Blob download from validated project serializer
      anchor.download = sanitizeAgorixFilename(id);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setError(true);
    }
  }

  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseAgorixProject(await file.text()).project;
      const program = validateControlStageProgram(parsed.program, stage);
      persist(
        recordCanonicalTransaction(history, { label: "import advanced project", after: program })
          .history,
      );
    } catch {
      setError(true);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <section
      className="kids-editor kids-advanced-scene kids-advanced-control"
      aria-labelledby="advanced-control-title"
    >
      <header className="kids-editor-header">
        <button type="button" className="kids-button" onClick={onBack}>
          {copy.back}
        </button>
        <div>
          <p className="kids-editor-kicker">
            {locale === "es" ? "Nivel avanzado" : "Advanced level"} · {stage === "control" ? 4 : 5}
          </p>
          <h1 id="advanced-control-title">{mission.title}</h1>
        </div>
        <ListenButton
          t={t}
          locale={locale}
          enabled={readAloud}
          text={success ? copy.success : mission.instruction}
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
          {stage === "control" ? (
            <div
              role="status"
              className="kids-advanced-score-watcher"
              aria-label={`${copy.score}: ${score}`}
            >
              <span>{copy.score}</span>
              <strong>{score}</strong>
            </div>
          ) : null}
          <button type="button" className="kids-button kids-primary" onClick={play}>
            {copy.play}
          </button>
          {run ? (
            <div role="status">
              <strong>{success ? copy.success : copy.tryAgain}</strong>
              <p>
                {copy.result}: {run.trace.map((entry) => traceLabel(entry, locale)).join(" → ")}
              </p>
              <p>{mission.reflection}</p>
            </div>
          ) : null}
          {completed && !run ? <p role="status">{copy.success}</p> : null}
          <button type="button" className="kids-button" onClick={askOri}>
            {copy.ask}
          </button>
          {proposal ? (
            <div className="kids-advanced-ori-review" aria-label={copy.proposed}>
              <p>
                {copy.proposed}:{" "}
                {label(
                  proposal.proposal.operations[0]!.type === "appendStatement"
                    ? proposal.proposal.operations[0]!.statement
                    : controlStatement("wait", 1),
                  locale,
                )}
              </p>
              <pre tabIndex={0}>{proposal.proposedProjection.code}</pre>
              <button type="button" className="kids-button" onClick={() => decide(true)}>
                {copy.accept}
              </button>
              <button type="button" className="kids-button" onClick={() => decide(false)}>
                {copy.reject}
              </button>
            </div>
          ) : null}
          {invalid ? <p role="alert">{copy.invalid}</p> : null}
          {error ? <p role="alert">{copy.error}</p> : null}
        </div>
        <div className="kids-editor-program-panel">
          <h2>{copy.blocks}</h2>
          {history.current.scripts.map((script, scriptIndex) => (
            <div key={script.id} className="kids-advanced-script">
              <h3>
                {stage === "control"
                  ? copy.sender
                  : scriptIndex === 0
                    ? copy.sender
                    : scriptIndex === 1
                      ? copy.ori
                      : copy.friend}
              </h3>
              <ol>
                {script.statements.map((statement, at) => (
                  <li key={at}>
                    <span>
                      {label(statement, locale)}
                      {statement.type === "if" ? (
                        <span className="kids-control-branches">
                          <span>{copy.thenBranch}</span>
                          <span>{copy.elseBranch}</span>
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="kids-button"
                      aria-label={`${copy.remove} ${at + 1}`}
                      onClick={() =>
                        persist(removeAdvancedOperation(history, stage, scriptIndex, at))
                      }
                    >
                      {copy.remove}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {stage === "control" ? (
            <div className="kids-advanced-control-palette">
              <label>
                {copy.first}
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                />
              </label>
              <label>
                {copy.second}
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={second}
                  onChange={(e) => setSecond(e.target.value)}
                />
              </label>
              {(["atLeast", "lessThan", "random", "wait"] as const).map((operation) => (
                <button
                  key={operation}
                  type="button"
                  className="kids-button"
                  onClick={() => add(operation)}
                >
                  {copy[operation]}
                </button>
              ))}
            </div>
          ) : (
            <div className="kids-advanced-control-palette">
              {(["send", "oriReceive", "friendReceive"] as const).map((operation) => (
                <button
                  key={operation}
                  type="button"
                  className="kids-button"
                  onClick={() => add(operation)}
                >
                  {copy[operation]}
                </button>
              ))}
            </div>
          )}
          <div className="kids-advanced-control-files">
            <button type="button" className="kids-button" onClick={exportProject}>
              {copy.export}
            </button>
            <label className="kids-button">
              {copy.import}
              <input
                type="file"
                accept=".agorix,application/json"
                aria-label={copy.import}
                onChange={(event) => void importProject(event)}
              />
            </label>
          </div>
          <div className="kids-code-strip">
            <div role="group" aria-label={locale === "es" ? "Idioma del código" : "Code language"}>
              {(["agorix", "python", "typescript"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className="kids-button"
                  aria-pressed={language === value}
                  onClick={() => setLanguage(value)}
                >
                  {value === "agorix" ? "Agorix" : value === "python" ? "Python" : "TypeScript"}
                </button>
              ))}
            </div>
            <pre aria-label={copy.code} tabIndex={0}>
              {code}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
