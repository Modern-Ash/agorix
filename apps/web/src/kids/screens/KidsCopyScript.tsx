import type { Statement } from "@agorix/program-model";
import type { EditorHistory } from "@agorix/block-editor";
import {
  addStudioCloneEdgeDelete,
  addStudioCloneScript,
  appendStudioStatement,
  hasStudioCloneScript,
  MAX_STUDIO_BLOCKS,
  removeStudioCloneScript,
  removeStudioStatement,
  studioCloneStatements,
  studioCloneTarget,
  wrapStudioTail,
} from "../kidsStudioModel.js";
import type { ProjectProgram } from "@agorix/program-model";
import type { Locale } from "../../i18n.js";

const COPY = {
  es: {
    title: "Guion de las copias",
    intro:
      "Cada copia hecha “con su guion” empieza aquí, cuando nace, y hace estos bloques por su cuenta.",
    add: "+ Dar un guion a las copias",
    remove: "Quitar el guion de las copias",
    hat: "Cuando empiezo como clon",
    empty: "Todavía no tiene bloques.",
    move: "Mover",
    turn: "Girar",
    wait: "Esperar",
    grow: "Agrandar",
    hide: "Ocultar",
    deleteMe: "Borrar este clon",
    edgeDelete: "Si toca el borde, borrar este clon",
    forever: "Por siempre",
    foreverAll: "Repetir por siempre todo",
    removeLast: "Quitar el último",
    used: "bloques",
    tipAdd: "Dar a las copias un guion que hacen solas al nacer",
    tipRemove: "Quitar el guion de las copias",
    tipMove: "Las copias avanzan un poco",
    tipTurn: "Las copias giran",
    tipWait: "Las copias esperan un segundo",
    tipGrow: "Las copias se agrandan un poco",
    tipHide: "Las copias se esconden",
    tipDelete: "Cada copia desaparece de la escena",
    tipEdge: "La copia desaparece cuando toca el borde",
    tipForever: "Las copias repiten todo para siempre",
    tipLast: "Quitar el último bloque del guion",
  },
  en: {
    title: "Copy script",
    intro:
      "Each copy made “with its script” starts here, when it is born, and does these blocks on its own.",
    add: "+ Give the copies a script",
    remove: "Remove the copy script",
    hat: "When I start as a clone",
    empty: "No blocks yet.",
    move: "Move",
    turn: "Turn",
    wait: "Wait",
    grow: "Grow",
    hide: "Hide",
    deleteMe: "Delete this clone",
    edgeDelete: "If it touches the edge, delete this clone",
    forever: "Forever",
    foreverAll: "Repeat everything forever",
    removeLast: "Remove the last one",
    used: "blocks",
    tipAdd: "Give the copies a script they run by themselves when born",
    tipRemove: "Remove the copy script",
    tipMove: "The copies move a little",
    tipTurn: "The copies turn",
    tipWait: "The copies wait a second",
    tipGrow: "The copies grow a little",
    tipHide: "The copies hide",
    tipDelete: "Each copy disappears from the scene",
    tipEdge: "The copy disappears when it touches the edge",
    tipForever: "The copies repeat everything forever",
    tipLast: "Remove the last block of the script",
  },
} as const;

function label(statement: Statement, text: (typeof COPY)[Locale]): string {
  switch (statement.type) {
    case "move":
      return `${text.move} ${statement.steps}`;
    case "turn":
      return `${text.turn} ${statement.degrees}°`;
    case "wait":
      return `${text.wait} ${statement.seconds}s`;
    case "changeSize":
      return `${text.grow} ${statement.delta}%`;
    case "hide":
      return text.hide;
    case "deleteThisClone":
      return text.deleteMe;
    case "forever":
      return `${text.forever}: ${statement.body.map((item) => label(item, text)).join(", ")}`;
    case "if":
      return statement.then.length === 1 && statement.then[0]!.type === "deleteThisClone"
        ? text.edgeDelete
        : statement.then.map((item) => label(item, text)).join(", ");
    default:
      return statement.type;
  }
}

/**
 * The script a character's copies start with (issue #1311): a small, closed set of blocks, so a
 * child can make rain or a crowd that lives and ends on its own. Edits go through the Studio model
 * like any other block, one undoable step each.
 */
export function KidsCopyScript({
  history,
  actorId,
  locale,
  onChange,
}: {
  readonly history: EditorHistory;
  readonly actorId: string;
  readonly locale: Locale;
  readonly onChange: (next: EditorHistory) => void;
}) {
  const text = COPY[locale === "es" ? "es" : "en"];
  const program: ProjectProgram = history.current;
  if (!hasStudioCloneScript(program, actorId)) {
    return (
      <section className="kids-copy-script" aria-label={text.title}>
        <button
          type="button"
          className="kids-button"
          title={text.tipAdd}
          data-testid="copy-script-add"
          onClick={() => onChange(addStudioCloneScript(history, actorId))}
        >
          {text.add}
        </button>
      </section>
    );
  }
  const target = studioCloneTarget(actorId);
  const statements = studioCloneStatements(program, actorId);
  const room = statements.length < MAX_STUDIO_BLOCKS;
  const run = (change: () => EditorHistory) => {
    try {
      onChange(change());
    } catch {
      // A refused change leaves the script as it was.
    }
  };
  return (
    <section className="kids-copy-script" aria-label={text.title}>
      <h3>{text.title}</h3>
      <p className="kids-note">{text.intro}</p>
      <p className="kids-start-block" data-testid="copy-script-hat">
        {text.hat}
      </p>
      <ol className="kids-copy-script-blocks" data-testid="copy-script-blocks">
        {statements.map((statement, index) => (
          <li key={index} className="kids-program-block">
            {label(statement, text)}
          </li>
        ))}
      </ol>
      {statements.length === 0 ? <p className="kids-note">{text.empty}</p> : null}
      <p className="kids-note">
        {statements.length} / {MAX_STUDIO_BLOCKS} {text.used}
      </p>
      <div className="kids-copy-script-palette" role="group" aria-label={text.title}>
        <button
          type="button"
          className="kids-button"
          title={text.tipMove}
          disabled={!room}
          onClick={() =>
            run(() => appendStudioStatement(history, target, { type: "move", steps: 20 }))
          }
        >
          + {text.move}
        </button>
        <button
          type="button"
          className="kids-button"
          title={text.tipTurn}
          disabled={!room}
          onClick={() =>
            run(() => appendStudioStatement(history, target, { type: "turn", degrees: 90 }))
          }
        >
          + {text.turn}
        </button>
        <button
          type="button"
          className="kids-button"
          title={text.tipWait}
          disabled={!room}
          onClick={() =>
            run(() => appendStudioStatement(history, target, { type: "wait", seconds: 1 }))
          }
        >
          + {text.wait}
        </button>
        <button
          type="button"
          className="kids-button"
          title={text.tipGrow}
          disabled={!room}
          onClick={() =>
            run(() => appendStudioStatement(history, target, { type: "changeSize", delta: 25 }))
          }
        >
          + {text.grow}
        </button>
        <button
          type="button"
          className="kids-button"
          title={text.tipHide}
          disabled={!room}
          onClick={() => run(() => appendStudioStatement(history, target, { type: "hide" }))}
        >
          + {text.hide}
        </button>
        <button
          type="button"
          className="kids-button"
          title={text.tipDelete}
          disabled={!room}
          data-testid="copy-script-delete"
          onClick={() =>
            run(() => appendStudioStatement(history, target, { type: "deleteThisClone" }))
          }
        >
          + {text.deleteMe}
        </button>
        <button
          type="button"
          className="kids-button"
          title={text.tipEdge}
          disabled={!room}
          data-testid="copy-script-edge"
          onClick={() => run(() => addStudioCloneEdgeDelete(history, actorId))}
        >
          + {text.edgeDelete}
        </button>
        <button
          type="button"
          className="kids-button"
          title={text.tipForever}
          disabled={statements.length === 0 || statements.length > 6}
          data-testid="copy-script-forever"
          onClick={() =>
            run(() => wrapStudioTail(history, target, statements.length, { type: "forever" }))
          }
        >
          {text.foreverAll}
        </button>
        <button
          type="button"
          className="kids-button"
          title={text.tipLast}
          disabled={statements.length === 0}
          onClick={() => run(() => removeStudioStatement(history, target, statements.length - 1))}
        >
          {text.removeLast}
        </button>
        <button
          type="button"
          className="kids-button"
          title={text.tipRemove}
          data-testid="copy-script-remove"
          onClick={() => run(() => removeStudioCloneScript(history, actorId))}
        >
          {text.remove}
        </button>
      </div>
    </section>
  );
}
