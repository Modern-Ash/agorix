import { recordCanonicalTransaction, type EditorHistory } from "@agorix/block-editor";
import {
  validateProgram,
  type ProjectCreativeState,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";

export type AdvancedSceneStatement = Extract<Statement, { type: "switchCostume" | "playSound" }>;
export type AdvancedSceneActorId = "actor:ori" | "actor:friend";

const SCRIPT = "advanced-scene-friend";
const COSTUMES = ["asset:costume.default", "asset:costume.spark"];
const SOUNDS = ["asset:sound.beacon"];

function checked(statement: AdvancedSceneStatement): AdvancedSceneStatement {
  if (statement.type === "switchCostume" && COSTUMES.includes(statement.costumeId))
    return statement;
  if (statement.type === "playSound" && SOUNDS.includes(statement.soundId)) return statement;
  throw new RangeError("unsupported advanced scene asset");
}

function scriptIndex(program: ProjectProgram, actorId: AdvancedSceneActorId): number {
  if (actorId === "actor:ori") return 0;
  return program.scripts.findIndex((script) => script.id === SCRIPT);
}

function edit(
  history: EditorHistory,
  actorId: AdvancedSceneActorId,
  label: string,
  update: (statements: readonly Statement[]) => readonly Statement[],
): EditorHistory {
  const scripts = [...history.current.scripts];
  let index = scriptIndex(history.current, actorId);
  if (index < 0) {
    scripts.push({ id: SCRIPT, trigger: { type: "greenFlag" }, statements: [] });
    index = scripts.length - 1;
  }
  const script = scripts[index];
  if (!script) throw new RangeError("missing actor script");
  scripts[index] = { ...script, statements: [...update(script.statements)] };
  const after = validateProgram({ ...history.current, scripts });
  return recordCanonicalTransaction(history, { label, after }).history;
}

export function addAdvancedStatement(
  history: EditorHistory,
  actorId: AdvancedSceneActorId,
  statement: AdvancedSceneStatement,
): EditorHistory {
  checked(statement);
  return edit(history, actorId, `add ${statement.type}`, (statements) => [
    ...statements,
    statement,
  ]);
}

export function replaceAdvancedStatement(
  history: EditorHistory,
  actorId: AdvancedSceneActorId,
  index: number,
  statement: AdvancedSceneStatement,
): EditorHistory {
  checked(statement);
  const script = history.current.scripts[scriptIndex(history.current, actorId)];
  if (!script || index < 0 || index >= script.statements.length)
    throw new RangeError("missing advanced scene block");
  return edit(history, actorId, `change ${statement.type}`, (statements) =>
    statements.map((item, at) => (at === index ? statement : item)),
  );
}

export function removeAdvancedStatement(
  history: EditorHistory,
  actorId: AdvancedSceneActorId,
  index: number,
): EditorHistory {
  const script = history.current.scripts[scriptIndex(history.current, actorId)];
  if (!script || index < 0 || index >= script.statements.length)
    throw new RangeError("missing advanced scene block");
  return edit(history, actorId, "remove scene block", (statements) =>
    statements.filter((_, at) => at !== index),
  );
}

/** Actor ownership follows the canonical scripts through undo and reload. */
export function creativeForAdvancedProgram(
  starter: ProjectCreativeState,
  program: ProjectProgram,
): ProjectCreativeState {
  const friendScript = program.scripts.some((script) => script.id === SCRIPT);
  return {
    ...starter,
    ...(starter.actors === undefined
      ? {}
      : {
          actors: starter.actors.map((actor) =>
            actor.id === "actor:friend"
              ? { ...actor, scripts: friendScript ? [SCRIPT] : [] }
              : actor,
          ),
        }),
  };
}

export function advancedActorStatements(
  program: ProjectProgram,
  actorId: AdvancedSceneActorId,
): readonly Statement[] {
  return program.scripts[scriptIndex(program, actorId)]?.statements ?? [];
}
