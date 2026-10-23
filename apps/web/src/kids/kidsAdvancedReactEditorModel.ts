import { recordCanonicalTransaction, type EditorHistory } from "@agorix/block-editor";
import {
  validateProgram,
  type ProjectCreativeState,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import type { AdvancedSceneActorId } from "./kidsAdvancedEditorModel.js";

export type ReactStatement = Extract<Statement, { type: "switchCostume" | "playSound" | "turn" }>;
const FRIEND_SCRIPT = "advanced-react-friend";

function indexFor(program: ProjectProgram, actorId: AdvancedSceneActorId): number {
  return actorId === "actor:ori"
    ? 0
    : program.scripts.findIndex((script) => script.id === FRIEND_SCRIPT);
}

function checked(statement: ReactStatement): ReactStatement {
  if (
    statement.type === "switchCostume" &&
    ["asset:costume.default", "asset:costume.spark"].includes(statement.costumeId)
  )
    return statement;
  if (statement.type === "playSound" && statement.soundId === "asset:sound.beacon")
    return statement;
  if (statement.type === "turn" && Math.abs(statement.degrees) === 90) return statement;
  throw new RangeError("unsupported stage-2 block");
}

function edit(
  history: EditorHistory,
  actorId: AdvancedSceneActorId,
  label: string,
  update: (items: readonly Statement[]) => readonly Statement[],
): EditorHistory {
  const scripts = [...history.current.scripts];
  let index = indexFor(history.current, actorId);
  if (index < 0) {
    scripts.push({ id: FRIEND_SCRIPT, trigger: { type: "onActorClicked" }, statements: [] });
    index = scripts.length - 1;
  }
  const script = scripts[index];
  if (!script || script.trigger.type !== "onActorClicked")
    throw new RangeError("missing event script");
  scripts[index] = { ...script, statements: [...update(script.statements)] };
  return recordCanonicalTransaction(history, {
    label,
    after: validateProgram({ ...history.current, scripts }),
  }).history;
}

export function addReactStatement(
  history: EditorHistory,
  actorId: AdvancedSceneActorId,
  statement: ReactStatement,
): EditorHistory {
  checked(statement);
  return edit(history, actorId, `add ${statement.type}`, (items) => [...items, statement]);
}

export function removeReactStatement(
  history: EditorHistory,
  actorId: AdvancedSceneActorId,
  at: number,
): EditorHistory {
  const script = history.current.scripts[indexFor(history.current, actorId)];
  if (!script || at < 0 || at >= script.statements.length)
    throw new RangeError("missing event block");
  return edit(history, actorId, "remove event block", (items) =>
    items.filter((_, index) => index !== at),
  );
}

export function reactActorStatements(
  program: ProjectProgram,
  actorId: AdvancedSceneActorId,
): readonly Statement[] {
  return program.scripts[indexFor(program, actorId)]?.statements ?? [];
}

export function creativeForReactProgram(
  starter: ProjectCreativeState,
  program: ProjectProgram,
): ProjectCreativeState {
  const hasFriend = program.scripts.some((script) => script.id === FRIEND_SCRIPT);
  return {
    ...starter,
    ...(starter.actors
      ? {
          actors: starter.actors.map((actor) =>
            actor.id === "actor:friend"
              ? { ...actor, scripts: hasFriend ? [FRIEND_SCRIPT] : [] }
              : actor,
          ),
        }
      : {}),
  };
}
