import { recordCanonicalTransaction, type EditorHistory } from "@agorix/block-editor";
import {
  validateProgram,
  type ProjectCreativeState,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";

export type AdvancedSceneStatement = Extract<
  Statement,
  { type: "switchCostume" | "playSound" | "move" }
>;
export type AdvancedSceneBaseActorId = "actor:ori" | "actor:friend";
export type CuratedSceneActorId = "actor:robot" | "actor:frog";
export type AdvancedSceneActorId = AdvancedSceneBaseActorId | CuratedSceneActorId;

export const CURATED_SCENE_ACTORS = [
  {
    id: "actor:robot",
    scriptId: "advanced-scene-robot",
    nameEs: "Robot",
    nameEn: "Robot",
    glyph: "🤖",
    x: 160,
  },
  {
    id: "actor:frog",
    scriptId: "advanced-scene-frog",
    nameEs: "Rana",
    nameEn: "Frog",
    glyph: "🐸",
    x: 240,
  },
] as const;

export const SCENE_COSTUMES = [
  "asset:costume.default",
  "asset:costume.spark",
  "asset:costume.explorer",
] as const;

const SCRIPT = "advanced-scene-friend";
const SOUNDS = ["asset:sound.beacon"];

function checked(statement: AdvancedSceneStatement): AdvancedSceneStatement {
  if (
    statement.type === "switchCostume" &&
    (SCENE_COSTUMES as readonly string[]).includes(statement.costumeId)
  )
    return statement;
  if (statement.type === "playSound" && SOUNDS.includes(statement.soundId)) return statement;
  if (statement.type === "move" && statement.steps === 1) return statement;
  throw new RangeError("unsupported advanced scene asset");
}

function scriptIndex(program: ProjectProgram, actorId: AdvancedSceneActorId): number {
  if (actorId === "actor:ori") return 0;
  const id =
    actorId === "actor:friend"
      ? SCRIPT
      : CURATED_SCENE_ACTORS.find((actor) => actor.id === actorId)?.scriptId;
  return program.scripts.findIndex((script) => script.id === id);
}

/** A curated actor exists exactly when its canonical script exists. */
export function addCuratedSceneActor(
  history: EditorHistory,
  actorId: CuratedSceneActorId,
): EditorHistory {
  const actor = CURATED_SCENE_ACTORS.find((item) => item.id === actorId);
  if (!actor || scriptIndex(history.current, actorId) >= 0)
    throw new RangeError("actor already added");
  const after = validateProgram({
    ...history.current,
    scripts: [
      ...history.current.scripts,
      { id: actor.scriptId, trigger: { type: "greenFlag" }, statements: [] },
    ],
  });
  return recordCanonicalTransaction(history, { label: `add ${actorId}`, after }).history;
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
    const id =
      actorId === "actor:friend"
        ? SCRIPT
        : CURATED_SCENE_ACTORS.find((actor) => actor.id === actorId)?.scriptId;
    if (!id) throw new RangeError("unknown actor");
    scripts.push({ id, trigger: { type: "greenFlag" }, statements: [] });
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
  locale: "es" | "en" = "es",
): ProjectCreativeState {
  const friendScript = program.scripts.some((script) => script.id === SCRIPT);
  const curated = CURATED_SCENE_ACTORS.filter((actor) =>
    program.scripts.some((script) => script.id === actor.scriptId),
  ).map((actor) => ({
    id: actor.id,
    name: locale === "es" ? actor.nameEs : actor.nameEn,
    x: actor.x,
    y: 0,
    direction: 0,
    size: 100,
    visible: true,
    costumeId: "asset:costume.default",
    scripts: [actor.scriptId],
  }));
  return {
    ...starter,
    ...(starter.actors === undefined
      ? {}
      : {
          actors: [
            ...starter.actors.map((actor) =>
              actor.id === "actor:friend"
                ? { ...actor, scripts: friendScript ? [SCRIPT] : [] }
                : actor,
            ),
            ...curated,
          ],
        }),
    ...(starter.stage === undefined
      ? {}
      : {
          stage: {
            ...starter.stage,
            actorOrder: [...(starter.stage.actorOrder ?? []), ...curated.map((actor) => actor.id)],
          },
        }),
  };
}

export function validateAdvancedSceneProgram(program: ProjectProgram): ProjectProgram {
  const valid = validateProgram(program);
  const scriptIds = [
    "advanced-scene",
    SCRIPT,
    ...CURATED_SCENE_ACTORS.map((actor) => actor.scriptId),
  ];
  if (
    valid.scripts[0]?.id !== "advanced-scene" ||
    valid.scripts[0].trigger.type !== "greenFlag" ||
    valid.scripts.some(
      (script) =>
        !scriptIds.includes(script.id) ||
        script.trigger.type !== "greenFlag" ||
        script.statements.some((statement) => {
          try {
            checked(statement as AdvancedSceneStatement);
            return false;
          } catch {
            return true;
          }
        }),
    ) ||
    new Set(valid.scripts.map((script) => script.id)).size !== valid.scripts.length ||
    (valid.variables?.length ?? 0) !== 0 ||
    (valid.lists?.length ?? 0) !== 0
  )
    throw new RangeError("unsupported advanced scene program");
  return valid;
}

export function advancedActorStatements(
  program: ProjectProgram,
  actorId: AdvancedSceneActorId,
): readonly Statement[] {
  return program.scripts[scriptIndex(program, actorId)]?.statements ?? [];
}
