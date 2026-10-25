import { recordCanonicalTransaction, type EditorHistory } from "@agorix/block-editor";
import {
  SCHEMA_VERSION,
  validateProgram,
  validateProjectCreativeState,
  type ProjectCreativeState,
  type ProjectAsset,
  type ProjectProgram,
  type Procedure,
  type ProcedureParam,
  type ProcedureParamId,
  type Expression,
  type Statement,
  type Trigger,
} from "@agorix/program-model";
import type { Locale } from "../i18n.js";
import {
  KIDS_GALLERY_BACKDROPS,
  KIDS_GALLERY_CHARACTERS,
  galleryCharacterName,
  isGalleryBackdropId,
  isGalleryCharacterId,
  type KidsGalleryBackdropId,
  type KidsGalleryCharacterId,
} from "./kidsGallery.js";
import { KIDS_SOUNDS, isKidsSoundId } from "./kidsSoundLibrary.js";
import { validKidsImageDataUrl } from "./kidsImages.js";

const SCRIPT = /^studio-actor-([1-9][0-9]?)-([a-z]+)$/;
const MAX_STUDIO_ACTORS = 12;

export type StudioStatement = Extract<
  Statement,
  {
    type:
      | "move"
      | "goTo"
      | "glideTo"
      | "turn"
      | "pointInDirection"
      | "pointTowards"
      | "bounceOnEdge"
      | "goToLayer"
      | "setEffect"
      | "changeEffect"
      | "clearEffects"
      | "switchCostume"
      | "switchBackdrop"
      | "playSound"
      | "stopSounds"
      | "setVolume"
      | "changeVolume"
      | "say"
      | "think"
      | "show"
      | "hide"
      | "setSize"
      | "changeSize"
      | "wait"
      | "broadcast"
      | "setVariable"
      | "changeVariable"
      | "showVariable"
      | "hideVariable"
      | "listAdd"
      | "listRemoveAt"
      | "listInsertAt"
      | "listReplaceAt"
      | "repeat"
      | "repeatUntil"
      | "callProcedure"
      | "if";
  }
>;

const STUDIO_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;
const STUDIO_MESSAGES = ["hola", "vamos", "listo"] as const;
export const STUDIO_EDGE_CONDITION = {
  type: "touchingStageEdge",
  minX: 0,
  maxX: 320,
  minY: -100,
  maxY: 120,
} as const;
const DATA_NAME = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,19}$/u;
const MAX_STUDIO_BLOCKS = 60;
const MAX_STUDIO_CONTROL_DEPTH = 2;
const MAX_STUDIO_BODY = 3;
const STUDIO_ART_ID = /^(costume|backdrop):studio-art-([1-9][0-9]?)$/;

export interface StudioArt {
  readonly assets?: readonly ProjectAsset[] | undefined;
  readonly actorCostumes?: Readonly<Record<string, string>>;
  readonly stageBackdropId?: string | undefined;
}

export function studioArtAssets(assets: readonly ProjectAsset[] = []): readonly ProjectAsset[] {
  if (
    assets.length > 12 ||
    assets.some((asset) => {
      const match = STUDIO_ART_ID.exec(asset.id);
      return !match || match[1] !== asset.kind || !validKidsImageDataUrl(asset.source);
    }) ||
    new Set(assets.map((asset) => asset.id)).size !== assets.length
  )
    throw new RangeError("invalid studio art");
  return assets;
}

function finiteSmallNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= -100 && value <= 100;
}

function checkedStudioIndex(value: Expression): boolean {
  return (
    value.type === "numericLiteral" &&
    Number.isInteger(value.value) &&
    value.value >= 1 &&
    value.value <= 10
  );
}

function checkedTrigger(trigger: Trigger): boolean {
  return (
    trigger.type === "greenFlag" ||
    trigger.type === "onActorClicked" ||
    (trigger.type === "onKeyPressed" &&
      STUDIO_KEYS.includes(trigger.key as (typeof STUDIO_KEYS)[number])) ||
    (trigger.type === "onMessage" &&
      STUDIO_MESSAGES.includes(trigger.message as (typeof STUDIO_MESSAGES)[number]))
  );
}

const PARAM_IDS: readonly ProcedureParamId[] = ["p1", "p2", "p3"];

/** A bound field or `param` expression may only name one of the enclosing custom block's numbers. */
function paramInScope(id: ProcedureParamId | undefined, arity: number): boolean {
  return id === undefined || PARAM_IDS.indexOf(id) < arity;
}

function checkedNumber(value: Expression, program: ProjectProgram, depth = 0, arity = 0): boolean {
  if (depth > 2) return false;
  if (value.type === "param") return arity > 0 && paramInScope(value.paramId, arity);
  if (value.type === "numericLiteral") return finiteSmallNumber(value.value);
  if (value.type === "xPosition" || value.type === "yPosition") return true;
  if (value.type === "distanceToActor")
    return program.scripts.some((script) => {
      const target = actorOfScript(script.id);
      return target !== null && studioActorId(target.index, target.characterId) === value.actorId;
    });
  if (value.type === "variable")
    return program.variables?.some((item) => item.id === value.variableId) === true;
  if (value.type === "listLength")
    return program.lists?.some((item) => item.id === value.listId) === true;
  if (value.type === "listItem")
    return (
      program.lists?.some((item) => item.id === value.listId) === true &&
      checkedStudioIndex(value.index)
    );
  if (value.type === "randomInteger")
    return (
      value.min.type === "numericLiteral" &&
      value.max.type === "numericLiteral" &&
      finiteSmallNumber(value.min.value) &&
      finiteSmallNumber(value.max.value) &&
      value.min.value <= value.max.value
    );
  if (value.type === "mathFunction") return checkedNumber(value.value, program, depth + 1, arity);
  if (["add", "subtract", "multiply", "divide", "modulo"].includes(value.type)) {
    const binary = value as Extract<
      Expression,
      { type: "add" | "subtract" | "multiply" | "divide" | "modulo" }
    >;
    return (
      checkedNumber(binary.left, program, depth + 1, arity) &&
      checkedNumber(binary.right, program, depth + 1, arity) &&
      (!(binary.type === "divide" || binary.type === "modulo") ||
        (binary.right.type === "numericLiteral" && binary.right.value !== 0))
    );
  }
  return false;
}

function checkedCondition(value: Expression, program: ProjectProgram, arity = 0): boolean {
  if (value.type === "touchingStageEdge")
    return (
      value.minX === STUDIO_EDGE_CONDITION.minX &&
      value.maxX === STUDIO_EDGE_CONDITION.maxX &&
      value.minY === STUDIO_EDGE_CONDITION.minY &&
      value.maxY === STUDIO_EDGE_CONDITION.maxY
    );
  if (value.type === "touchingActor")
    return program.scripts.some((script) => {
      const target = actorOfScript(script.id);
      return target !== null && studioActorId(target.index, target.characterId) === value.actorId;
    });
  if (value.type !== "greaterThan" && value.type !== "lessThan" && value.type !== "equals")
    return false;
  return (
    checkedNumber(value.left, program, 0, arity) && checkedNumber(value.right, program, 0, arity)
  );
}

const MAX_STUDIO_PROCEDURES = 20;

function checkedParams(params: readonly ProcedureParam[] | undefined): boolean {
  return (
    params === undefined ||
    (params.length >= 1 &&
      params.length <= PARAM_IDS.length &&
      params.every((item, index) => item.id === PARAM_IDS[index] && DATA_NAME.test(item.name)))
  );
}

/** A call's fixed numbers: small, finite, and in half steps, so every unit picker can offer them. */
function checkedArgs(args: readonly Expression[] | undefined, arity: number): boolean {
  return (
    args === undefined ||
    (args.length <= PARAM_IDS.length &&
      args.every((item) =>
        item.type === "param"
          ? arity > 0 && paramInScope(item.paramId, arity)
          : item.type === "numericLiteral" &&
            Number.isInteger(item.value * 2) &&
            Math.abs(item.value) <= 200,
      ))
  );
}

function checkedProcedures(
  procedures: readonly Procedure[] | undefined,
  actorIndex: number,
  program: ProjectProgram,
): boolean {
  if (procedures === undefined) return true;
  return (
    procedures.length >= 1 &&
    procedures.length <= MAX_STUDIO_PROCEDURES &&
    procedures.every(
      (item) =>
        item.id.startsWith(`proc-${actorIndex}-`) &&
        /^proc-[1-9][0-9]?-[1-9][0-9]?$/.test(item.id) &&
        DATA_NAME.test(item.name) &&
        checkedParams(item.params) &&
        item.body.length >= 1 &&
        item.body.every((statement) => checked(statement, program, 0, item.params?.length ?? 0)),
    )
  );
}

function statementCount(statements: readonly Statement[]): number {
  return statements.reduce(
    (sum, statement) =>
      sum +
      1 +
      (statement.type === "repeat" || statement.type === "repeatUntil"
        ? statementCount(statement.body)
        : statement.type === "if"
          ? statementCount(statement.then) + statementCount(statement.else ?? [])
          : 0),
    0,
  );
}

export function studioActorId(index: number, characterId: KidsGalleryCharacterId): string {
  return `actor:studio-${index}-${characterId}`;
}

function scriptId(index: number, characterId: KidsGalleryCharacterId): string {
  return `studio-actor-${index}-${characterId}`;
}

function actorOfScript(id: string): { index: number; characterId: KidsGalleryCharacterId } | null {
  const match = SCRIPT.exec(id);
  if (!match || !isGalleryCharacterId(match[2])) return null;
  const index = Number(match[1]);
  if (index > 99) return null;
  return { index, characterId: match[2] };
}

function checked(statement: Statement, program: ProjectProgram, depth = 0, arity = 0): boolean {
  if (statement.type === "move")
    return (
      paramInScope(statement.stepsFrom, arity) &&
      Number.isInteger(statement.steps / 20) &&
      statement.steps !== 0 &&
      Math.abs(statement.steps) <= 200
    );
  if (statement.type === "glideTo")
    return (
      [0.5, 1, 2, 3].includes(statement.seconds) &&
      checked({ type: "goTo", x: statement.x, y: statement.y }, program)
    );
  if (statement.type === "goTo")
    return (
      Number.isInteger(statement.x) &&
      statement.x >= 0 &&
      statement.x <= 320 &&
      Number.isInteger(statement.y) &&
      statement.y >= -100 &&
      statement.y <= 120
    );
  if (statement.type === "turn")
    return (
      paramInScope(statement.degreesFrom, arity) &&
      [45, 90, 180, -45, -90, -180].includes(statement.degrees)
    );
  if (statement.type === "pointInDirection") return [0, 90, 180, -90].includes(statement.degrees);
  if (statement.type === "pointTowards")
    return program.scripts.some((script) => {
      const actor = actorOfScript(script.id);
      return actor !== null && studioActorId(actor.index, actor.characterId) === statement.actorId;
    });
  if (statement.type === "bounceOnEdge") return true;
  if (statement.type === "setEffect")
    return (
      statement.effect === "brightness"
        ? [-50, -25, 0, 25, 50]
        : statement.effect === "color" || statement.effect === "ghost"
          ? [0, 25, 50, 75, 100]
          : []
    ).includes(statement.value);
  if (statement.type === "changeEffect")
    return (
      ["color", "ghost", "brightness"].includes(statement.effect) &&
      [-25, 25].includes(statement.delta)
    );
  if (statement.type === "clearEffects") return true;
  if (statement.type === "goToLayer")
    return statement.layer === "front" || statement.layer === "back";
  if (statement.type === "switchCostume")
    return (
      isGalleryCharacterId(statement.costumeId.slice(8)) &&
      statement.costumeId.startsWith("costume:")
    );
  if (statement.type === "switchBackdrop")
    return (
      isGalleryBackdropId(statement.backdropId.slice(9)) &&
      statement.backdropId.startsWith("backdrop:")
    );
  if (statement.type === "playSound")
    return isKidsSoundId(statement.soundId) && statement.soundId !== "kids:custom";
  if (statement.type === "stopSounds") return true;
  if (statement.type === "setVolume")
    return Number.isInteger(statement.volume) && statement.volume >= 0 && statement.volume <= 100;
  if (statement.type === "changeVolume")
    return Number.isInteger(statement.delta) && statement.delta >= -100 && statement.delta <= 100;
  if (statement.type === "say" || statement.type === "think")
    return statement.text.trim().length > 0 && statement.text.length <= 80;
  if (statement.type === "show" || statement.type === "hide") return true;
  if (statement.type === "changeSize") return [-50, -25, 25, 50].includes(statement.delta);
  if (statement.type === "setSize") return [50, 75, 100, 125, 150].includes(statement.size);
  if (statement.type === "wait")
    return paramInScope(statement.secondsFrom, arity) && [0.5, 1, 2, 3].includes(statement.seconds);
  if (statement.type === "broadcast")
    return STUDIO_MESSAGES.includes(statement.message as (typeof STUDIO_MESSAGES)[number]);
  if (statement.type === "setVariable" || statement.type === "changeVariable")
    return (
      program.variables?.some((item) => item.id === statement.variableId) === true &&
      checkedNumber(
        statement.type === "setVariable" ? statement.value : statement.delta,
        program,
        0,
        arity,
      )
    );
  if (statement.type === "showVariable" || statement.type === "hideVariable")
    return program.variables?.some((item) => item.id === statement.variableId) === true;
  if (statement.type === "listAdd")
    return (
      program.lists?.some((item) => item.id === statement.listId) === true &&
      checkedNumber(statement.value, program, 0, arity)
    );
  if (statement.type === "listRemoveAt")
    return (
      program.lists?.some((item) => item.id === statement.listId) === true &&
      checkedStudioIndex(statement.index)
    );
  if (statement.type === "listInsertAt" || statement.type === "listReplaceAt")
    return (
      program.lists?.some((item) => item.id === statement.listId) === true &&
      checkedStudioIndex(statement.index) &&
      checkedNumber(statement.value, program, 0, arity)
    );
  if (statement.type === "repeat")
    return (
      depth < MAX_STUDIO_CONTROL_DEPTH &&
      paramInScope(statement.countFrom, arity) &&
      [2, 3, 5].includes(statement.count) &&
      statement.body.length >= 1 &&
      statement.body.length <= MAX_STUDIO_BODY &&
      statement.body.every((item) => checked(item, program, depth + 1, arity))
    );
  if (statement.type === "callProcedure")
    return (
      /^proc-[1-9][0-9]?-[1-9][0-9]?$/.test(statement.procedureId) &&
      checkedArgs(statement.args, arity)
    );
  if (statement.type === "repeatUntil")
    return (
      depth < MAX_STUDIO_CONTROL_DEPTH &&
      checkedCondition(statement.condition, program, arity) &&
      statement.body.length >= 1 &&
      statement.body.length <= MAX_STUDIO_BODY &&
      statement.body.every((item) => checked(item, program, depth + 1, arity))
    );
  if (statement.type === "if") {
    return (
      depth < MAX_STUDIO_CONTROL_DEPTH &&
      checkedCondition(statement.condition, program, arity) &&
      statement.then.length >= 1 &&
      statement.then.length <= MAX_STUDIO_BODY &&
      statement.then.every((item) => checked(item, program, depth + 1, arity)) &&
      (statement.else === undefined ||
        (statement.else.length >= 1 &&
          statement.else.length <= MAX_STUDIO_BODY &&
          statement.else.every((item) => checked(item, program, depth + 1, arity))))
    );
  }
  return false;
}

export function validateStudioProgram(raw: ProjectProgram): ProjectProgram {
  const program = validateProgram(raw);
  if (
    program.scripts.length < 1 ||
    program.scripts.length > MAX_STUDIO_ACTORS ||
    (program.variables?.length ?? 0) > 3 ||
    (program.lists?.length ?? 0) > 3 ||
    program.variables?.some(
      (item, index) =>
        item.id !== `studio-var-${index + 1}` ||
        !DATA_NAME.test(item.name) ||
        item.initialValue !== 0 ||
        !item.visible,
    ) ||
    program.lists?.some(
      (item, index) =>
        item.id !== `studio-list-${index + 1}` ||
        !DATA_NAME.test(item.name) ||
        item.initialItems.length !== 0 ||
        !item.visible,
    ) ||
    program.scripts.some((script, position) => {
      const actor = actorOfScript(script.id);
      return (
        !actor ||
        actor.index !== position + 1 ||
        !checkedTrigger(script.trigger) ||
        !checkedProcedures(script.procedures, position + 1, program) ||
        statementCount(script.statements) +
          (script.procedures ?? []).reduce((sum, item) => sum + statementCount(item.body), 0) >
          MAX_STUDIO_BLOCKS ||
        script.statements.some((statement) => !checked(statement, program))
      );
    })
  )
    throw new RangeError("program is outside Kids studio");
  return program;
}

export function createStudioProgram(characterId: KidsGalleryCharacterId): ProjectProgram {
  return validateStudioProgram({
    schema: SCHEMA_VERSION,
    scripts: [{ id: scriptId(1, characterId), trigger: { type: "greenFlag" }, statements: [] }],
  });
}

export function creativeForStudio(
  raw: ProjectProgram,
  backdropId: KidsGalleryBackdropId,
  locale: Locale,
  positions: Readonly<Record<string, { readonly x: number; readonly y: number }>> = {},
  actorOrder: readonly string[] = [],
  art: StudioArt = {},
): ProjectCreativeState {
  const program = validateStudioProgram(raw);
  if (!isGalleryBackdropId(backdropId)) throw new RangeError("unknown studio backdrop");
  const customAssets = studioArtAssets(art.assets);
  const assets = [
    ...KIDS_GALLERY_CHARACTERS.map((item) => ({
      id: `costume:${item.id}`,
      kind: "costume" as const,
      name: galleryCharacterName(item.id, locale),
      source: `builtin:kids-gallery-character:${item.id}`,
    })),
    ...KIDS_GALLERY_BACKDROPS.map((item) => ({
      id: `backdrop:${item.id}`,
      kind: "backdrop" as const,
      name: locale === "es" ? item.es : item.en,
      source: `builtin:kids-gallery-backdrop:${item.id}`,
    })),
    ...KIDS_SOUNDS.map((item) => ({
      id: item.id,
      kind: "sound" as const,
      name: locale === "es" ? item.es : item.en,
      source: `builtin:kids-sound:${item.id}`,
    })),
    ...customAssets,
  ];
  const actors = program.scripts.map((script, position) => {
    const actor = actorOfScript(script.id)!;
    const id = studioActorId(actor.index, actor.characterId);
    const saved = positions[id];
    return {
      id,
      name: galleryCharacterName(actor.characterId, locale),
      x:
        saved && Number.isInteger(saved.x) && saved.x >= 0 && saved.x <= 320
          ? saved.x
          : (position % 5) * 60,
      y:
        saved && Number.isInteger(saved.y) && saved.y >= -100 && saved.y <= 120
          ? saved.y
          : Math.floor(position / 5) * 60,
      direction: 0,
      size: 100,
      visible: true,
      costumeId: customAssets.some(
        (asset) => asset.kind === "costume" && asset.id === art.actorCostumes?.[id],
      )
        ? art.actorCostumes![id]!
        : `costume:${actor.characterId}`,
      scripts: [script.id],
    };
  });
  const ids = actors.map((actor) => actor.id);
  const order =
    actorOrder.length === ids.length &&
    new Set(actorOrder).size === ids.length &&
    actorOrder.every((id) => ids.includes(id))
      ? actorOrder
      : ids;
  return validateProjectCreativeState(
    {
      assets,
      actors,
      stage: {
        backdropId: customAssets.some(
          (asset) => asset.kind === "backdrop" && asset.id === art.stageBackdropId,
        )
          ? art.stageBackdropId
          : `backdrop:${backdropId}`,
        actorOrder: order,
        width: 400,
        height: 260,
      },
    },
    program,
  );
}

export function addStudioActor(
  history: EditorHistory,
  characterId: KidsGalleryCharacterId,
): EditorHistory {
  const program = validateStudioProgram(history.current);
  if (!isGalleryCharacterId(characterId) || program.scripts.length >= MAX_STUDIO_ACTORS)
    throw new RangeError("studio actor limit or unknown character");
  const next = validateStudioProgram({
    ...program,
    scripts: [
      ...program.scripts,
      {
        id: scriptId(program.scripts.length + 1, characterId),
        trigger: { type: "greenFlag" },
        statements: [],
      },
    ],
  });
  return recordCanonicalTransaction(history, { label: "add studio actor", after: next }).history;
}

export function appendStudioStatement(
  history: EditorHistory,
  actorId: string,
  statement: StudioStatement,
): EditorHistory {
  const program = validateStudioProgram(history.current);
  if (!checked(statement, program)) throw new RangeError("unsupported studio block or asset");
  const index = program.scripts.findIndex((script) => {
    const actor = actorOfScript(script.id);
    return actor !== null && studioActorId(actor.index, actor.characterId) === actorId;
  });
  if (index < 0) throw new RangeError("unknown studio actor");
  const scripts = [...program.scripts];
  const script = scripts[index]!;
  scripts[index] = { ...script, statements: [...script.statements, statement] };
  const next = validateStudioProgram({ ...program, scripts });
  return recordCanonicalTransaction(history, { label: `add ${statement.type}`, after: next })
    .history;
}

/** Turn the learner's last blocks into one visible, undoable control block. */
export function wrapStudioTail(
  history: EditorHistory,
  actorId: string,
  count: number,
  control:
    | { readonly type: "repeat"; readonly times: 2 | 3 | 5 }
    | { readonly type: "repeatUntil"; readonly condition: Expression }
    | { readonly type: "if"; readonly condition: Expression },
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const index = program.scripts.findIndex((script) => {
    const actor = actorOfScript(script.id);
    return actor !== null && studioActorId(actor.index, actor.characterId) === actorId;
  });
  const script = program.scripts[index];
  if (!script || !Number.isInteger(count) || count < 1 || count > MAX_STUDIO_BODY)
    throw new RangeError("invalid studio group");
  if (script.statements.length < count) throw new RangeError("not enough studio blocks");
  const body = script.statements.slice(-count);
  const statement: Statement =
    control.type === "repeat"
      ? { type: "repeat", count: control.times, body }
      : control.type === "repeatUntil"
        ? { type: "repeatUntil", condition: control.condition, body }
        : { type: "if", condition: control.condition, then: body };
  if (!checked(statement, program)) throw new RangeError("unsupported studio group");
  const scripts = [...program.scripts];
  scripts[index] = {
    ...script,
    statements: [...script.statements.slice(0, -count), statement],
  };
  const next = validateStudioProgram({ ...program, scripts });
  return recordCanonicalTransaction(history, { label: `group ${control.type}`, after: next })
    .history;
}

function scriptIndexOfActor(program: ProjectProgram, actorId: string): number {
  return program.scripts.findIndex((script) => {
    const actor = actorOfScript(script.id);
    return actor !== null && studioActorId(actor.index, actor.characterId) === actorId;
  });
}

function countCalls(statements: readonly Statement[], procedureId: string): number {
  return statements.reduce((sum, statement) => {
    if (statement.type === "callProcedure")
      return sum + (statement.procedureId === procedureId ? 1 : 0);
    if (statement.type === "repeat" || statement.type === "repeatUntil")
      return sum + countCalls(statement.body, procedureId);
    if (statement.type === "if")
      return (
        sum +
        countCalls(statement.then, procedureId) +
        countCalls(statement.else ?? [], procedureId)
      );
    return sum;
  }, 0);
}

/** How many places in this character's script (blocks and other custom blocks) call a custom block. */
export function studioProcedureUses(
  program: ProjectProgram,
  actorId: string,
  procedureId: string,
): number {
  const script = program.scripts[scriptIndexOfActor(program, actorId)];
  return script ? scriptCalls(script, procedureId) : 0;
}

function scriptCalls(script: ProjectProgram["scripts"][number], procedureId: string): number {
  return (
    countCalls(script.statements, procedureId) +
    (script.procedures ?? []).reduce((sum, item) => sum + countCalls(item.body, procedureId), 0)
  );
}

const FROM_FIELDS = {
  stepsFrom: "steps",
  degreesFrom: "degrees",
  secondsFrom: "seconds",
  countFrom: "count",
} as const;

// Same limits as the runtime clamp, so inlining a call keeps the exact behaviour it had.
const FROM_LIMITS = {
  steps: { min: -1000, max: 1000, round: false },
  degrees: { min: -1000, max: 1000, round: false },
  seconds: { min: 0.1, max: 5, round: false },
  count: { min: 1, max: 1000, round: true },
} as const;

type Json = unknown;

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rebuild a tree of statements, letting `visit` replace any object (return undefined to recurse). */
function deepMap(node: Json, visit: (item: Record<string, Json>) => Json | undefined): Json {
  if (Array.isArray(node)) return node.map((item) => deepMap(item, visit));
  if (!isRecord(node)) return node;
  const replaced = visit(node);
  if (replaced !== undefined) return replaced;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, deepMap(value, visit)]),
  );
}

/** Rewrite every `…From` field and `param` expression of a body; null unbinds a number. */
function remapParams(
  body: readonly Statement[],
  next: (id: ProcedureParamId) => ProcedureParamId | null,
): Statement[] {
  const visit = (item: Record<string, Json>): Json | undefined => {
    if (item.type === "param") {
      const id = next(item.paramId as ProcedureParamId);
      return id === null ? { type: "numericLiteral", value: 0 } : { ...item, paramId: id };
    }
    if (!Object.keys(item).some((key) => key in FROM_FIELDS)) return undefined;
    const copy: Record<string, Json> = {};
    for (const [key, value] of Object.entries(item)) {
      if (key in FROM_FIELDS) {
        const id = next(value as ProcedureParamId);
        if (id !== null) copy[key] = id;
      } else copy[key] = deepMap(value, visit);
    }
    return copy;
  };
  return deepMap(body, visit) as Statement[];
}

function clampField(field: keyof typeof FROM_LIMITS, value: number): number {
  const limits = FROM_LIMITS[field];
  const bounded = Math.min(limits.max, Math.max(limits.min, value));
  return limits.round ? Math.round(bounded) : bounded;
}

/** The body of a custom block as one call sees it: each number replaced by the call's own value. */
function bodyForCall(procedure: Procedure, call: { args?: readonly Expression[] }): Statement[] {
  // Each of the block's numbers becomes the call's value: a fixed number, or the caller's own number.
  const bound = call.args?.map((item) =>
    item.type === "param" ? item.paramId : (item as { value: number }).value,
  );
  if (!bound) return [...procedure.body];
  const boundTo = (id: ProcedureParamId) => bound[PARAM_IDS.indexOf(id)] ?? 0;
  const visit = (item: Record<string, Json>): Json | undefined => {
    if (item.type === "param") {
      const value = boundTo(item.paramId as ProcedureParamId);
      return typeof value === "string"
        ? { type: "param", paramId: value }
        : { type: "numericLiteral", value };
    }
    if (!Object.keys(item).some((key) => key in FROM_FIELDS)) return undefined;
    const copy: Record<string, Json> = {};
    for (const [key, value] of Object.entries(item))
      if (!(key in FROM_FIELDS)) copy[key] = deepMap(value, visit);
    for (const [key, value] of Object.entries(item)) {
      if (!(key in FROM_FIELDS)) continue;
      const field = FROM_FIELDS[key as keyof typeof FROM_FIELDS];
      const target = boundTo(value as ProcedureParamId);
      // A number handed on stays a follower (the fixed value is its default); a fixed one replaces it.
      if (typeof target === "string") copy[key] = target;
      else copy[field] = clampField(field, target);
    }
    return copy;
  };
  return deepMap(procedure.body, visit) as Statement[];
}

function replaceCalls(statements: readonly Statement[], procedure: Procedure): Statement[] {
  return statements.flatMap((statement): Statement[] => {
    if (statement.type === "callProcedure")
      return statement.procedureId === procedure.id
        ? bodyForCall(procedure, statement)
        : [statement];
    if (statement.type === "repeat" || statement.type === "repeatUntil")
      return [{ ...statement, body: replaceCalls(statement.body, procedure) }];
    if (statement.type === "if")
      return [
        {
          ...statement,
          then: replaceCalls(statement.then, procedure),
          ...(statement.else === undefined
            ? {}
            : { else: replaceCalls(statement.else, procedure) }),
        },
      ];
    return [statement];
  });
}

/** Apply `change` to every call of a custom block, wherever the character's blocks keep it. */
function mapCalls(
  statements: readonly Statement[],
  procedureId: string,
  change: (call: Extract<Statement, { type: "callProcedure" }>) => Statement,
): Statement[] {
  return statements.map((statement): Statement => {
    if (statement.type === "callProcedure")
      return statement.procedureId === procedureId ? change(statement) : statement;
    if (statement.type === "repeat" || statement.type === "repeatUntil")
      return { ...statement, body: mapCalls(statement.body, procedureId, change) };
    if (statement.type === "if")
      return {
        ...statement,
        then: mapCalls(statement.then, procedureId, change),
        ...(statement.else === undefined
          ? {}
          : { else: mapCalls(statement.else, procedureId, change) }),
      };
    return statement;
  });
}

function mapScriptCalls(
  script: ProjectProgram["scripts"][number],
  procedureId: string,
  change: (call: Extract<Statement, { type: "callProcedure" }>) => Statement,
): ProjectProgram["scripts"][number] {
  return {
    ...script,
    statements: mapCalls(script.statements, procedureId, change),
    ...(script.procedures === undefined
      ? {}
      : {
          procedures: script.procedures.map((item) => ({
            ...item,
            body: mapCalls(item.body, procedureId, change),
          })),
        }),
  };
}

/** What a call gives one number: a fixed value, or the id of the calling block's own number. */
export type StudioCallValue = number | ProcedureParamId;

function withArgs(
  call: Extract<Statement, { type: "callProcedure" }>,
  args: readonly StudioCallValue[],
): Statement {
  const rest = withoutKey(call, "args");
  return args.length === 0
    ? rest
    : {
        ...rest,
        args: args.map((value) =>
          typeof value === "string"
            ? ({ type: "param", paramId: value } as const)
            : ({ type: "numericLiteral", value } as const),
        ),
      };
}

function argValues(call: Extract<Statement, { type: "callProcedure" }>): StudioCallValue[] {
  return (call.args ?? []).map((item) => (item.type === "param" ? item.paramId : item.value));
}

function withScript(
  history: EditorHistory,
  actorId: string,
  label: string,
  change: (
    script: ProjectProgram["scripts"][number],
    actorIndex: number,
  ) => ProjectProgram["scripts"][number],
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const index = scriptIndexOfActor(program, actorId);
  const script = program.scripts[index];
  if (!script) throw new RangeError("unknown studio actor");
  const scripts = [...program.scripts];
  scripts[index] = change(script, index + 1);
  const next = validateStudioProgram({ ...program, scripts });
  return recordCanonicalTransaction(history, { label, after: next }).history;
}

/** Turn the last blocks of a character into one named custom block and a call to it. */
export function createStudioProcedure(
  history: EditorHistory,
  actorId: string,
  count: number,
  name: string,
  numbers: readonly string[] = [],
): EditorHistory {
  return withScript(history, actorId, "create custom block", (script, actorIndex) => {
    const procedures = script.procedures ?? [];
    if (numbers.length > PARAM_IDS.length) throw new RangeError("custom block number limit");
    if (!Number.isInteger(count) || count < 1 || script.statements.length < count)
      throw new RangeError("invalid custom block group");
    if (procedures.length >= MAX_STUDIO_PROCEDURES) throw new RangeError("custom block limit");
    const taken = new Set(procedures.map((item) => item.id));
    let n = 1;
    while (taken.has(`proc-${actorIndex}-${n}`)) n += 1;
    const id = `proc-${actorIndex}-${n}`;
    return {
      ...script,
      procedures: [
        ...procedures,
        {
          id,
          name,
          ...(numbers.length === 0
            ? {}
            : { params: numbers.map((title, index) => ({ id: PARAM_IDS[index]!, name: title })) }),
          body: script.statements.slice(-count),
        },
      ],
      statements: [
        ...script.statements.slice(0, -count),
        withArgs(
          { type: "callProcedure", procedureId: id },
          numbers.map(() => 0),
        ),
      ],
    };
  });
}

export function renameStudioProcedure(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  name: string,
): EditorHistory {
  return withScript(history, actorId, "rename custom block", (script) => {
    if (!script.procedures?.some((item) => item.id === procedureId))
      throw new RangeError("unknown custom block");
    return {
      ...script,
      procedures: script.procedures.map((item) =>
        item.id === procedureId ? { ...item, name } : item,
      ),
    };
  });
}

export type StudioNumberUnit = "steps" | "degrees" | "seconds" | "count" | "number";

/** Values a child can pick for a call's number, by the unit of the first block that uses it. */
export const STUDIO_NUMBER_CHOICES: Readonly<Record<StudioNumberUnit, readonly number[]>> =
  Object.freeze({
    steps: [-200, -100, -60, -40, -20, 20, 40, 60, 100, 200],
    degrees: [-180, -90, -45, 45, 90, 180],
    seconds: [0.5, 1, 2, 3],
    count: [2, 3, 5],
    number: [-50, -10, -5, -1, 0, 1, 5, 10, 50],
  });

export const STUDIO_NUMBER_DEFAULTS: Readonly<Record<StudioNumberUnit, number>> = Object.freeze({
  steps: 40,
  degrees: 90,
  seconds: 1,
  count: 2,
  number: 1,
});

const SLOT_UNIT: Readonly<Record<string, StudioNumberUnit>> = {
  stepsFrom: "steps",
  degreesFrom: "degrees",
  secondsFrom: "seconds",
  countFrom: "count",
};

/**
 * The unit of each of a custom block's numbers, from the first block in it that uses the number, or
 * the number of another block it is handed on to (`all` are the character's blocks).
 */
export function studioProcedureNumberUnits(
  procedure: Procedure,
  all: readonly Procedure[] = [],
  depth = 0,
): StudioNumberUnit[] {
  const units: (StudioNumberUnit | undefined)[] = (procedure.params ?? []).map(() => undefined);
  const claim = (id: unknown, unit: StudioNumberUnit) => {
    const at = PARAM_IDS.indexOf(id as ProcedureParamId);
    if (at >= 0 && at < units.length && units[at] === undefined) units[at] = unit;
  };
  deepMap(procedure.body, (item) => {
    if (item.type === "param") claim(item.paramId, "number");
    if (item.type === "callProcedure" && Array.isArray(item.args) && depth < 4) {
      const callee = all.find((entry) => entry.id === item.procedureId);
      const inner = callee ? studioProcedureNumberUnits(callee, all, depth + 1) : [];
      item.args.forEach((arg, index) => {
        if (isRecord(arg) && arg.type === "param") claim(arg.paramId, inner[index] ?? "number");
      });
    }
    for (const [key, value] of Object.entries(item)) {
      const unit = SLOT_UNIT[key];
      if (unit) claim(value, unit);
    }
    return undefined;
  });
  return units.map((unit) => unit ?? "number");
}

/** Add one titled number to a custom block; every call of it starts with 0 for the new number. */
export function addStudioProcedureNumber(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  title: string,
): EditorHistory {
  return withScript(history, actorId, "add custom block number", (script) => {
    const procedure = script.procedures?.find((item) => item.id === procedureId);
    if (!procedure) throw new RangeError("unknown custom block");
    const params = procedure.params ?? [];
    if (params.length >= PARAM_IDS.length) throw new RangeError("custom block number limit");
    const changed = mapScriptCalls(script, procedureId, (call) =>
      withArgs(call, [...argValues(call), 0]),
    );
    return {
      ...changed,
      procedures: (changed.procedures ?? []).map((item) =>
        item.id === procedureId
          ? { ...item, params: [...params, { id: PARAM_IDS[params.length]!, name: title }] }
          : item,
      ),
    };
  });
}

/**
 * Remove one of a custom block's numbers. Blocks that used it keep their fixed value, later numbers
 * move up one place and every call drops that number.
 */
export function removeStudioProcedureNumber(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  paramId: ProcedureParamId,
): EditorHistory {
  return withScript(history, actorId, "remove custom block number", (script) => {
    const procedure = script.procedures?.find((item) => item.id === procedureId);
    const at = PARAM_IDS.indexOf(paramId);
    if (!procedure || at < 0 || at >= (procedure.params?.length ?? 0))
      throw new RangeError("unknown custom block number");
    const changed = mapScriptCalls(script, procedureId, (call) =>
      withArgs(
        call,
        argValues(call).filter((_value, index) => index !== at),
      ),
    );
    const remaining = (procedure.params ?? [])
      .filter((_item, index) => index !== at)
      .map((item, index): ProcedureParam => ({ id: PARAM_IDS[index]!, name: item.name }));
    return {
      ...changed,
      procedures: (changed.procedures ?? []).map((item) => {
        if (item.id !== procedureId) return item;
        const rest = withoutKey(item, "params");
        return {
          ...rest,
          ...(remaining.length === 0 ? {} : { params: remaining }),
          body: remapParams(item.body, (id) => {
            const index = PARAM_IDS.indexOf(id);
            if (index === at) return null;
            return index > at ? PARAM_IDS[index - 1]! : id;
          }),
        };
      }),
    };
  });
}

export type StudioBlockPath = readonly (number | "else")[];

function updateAt(
  list: readonly Statement[],
  path: StudioBlockPath,
  change: (statement: Statement) => Statement,
): Statement[] {
  const [head, ...rest] = path;
  if (typeof head !== "number" || head < 0 || head >= list.length)
    throw new RangeError("unknown block");
  return list.map((item, index): Statement => {
    if (index !== head) return item;
    if (rest.length === 0) return change(item);
    if (item.type === "repeat" || item.type === "repeatUntil")
      return { ...item, body: updateAt(item.body, rest, change) };
    if (item.type === "if") {
      if (rest[0] === "else" && item.else)
        return { ...item, else: updateAt(item.else, rest.slice(1), change) };
      return { ...item, then: updateAt(item.then, rest, change) };
    }
    throw new RangeError("unknown block");
  });
}

function withoutKey<T extends object>(value: T, key: string): T {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)) as T;
}

/** The number a block inside a custom block currently follows, if any. */
export function studioBlockNumber(statement: Statement): ProcedureParamId | null {
  switch (statement.type) {
    case "move":
      return statement.stepsFrom ?? null;
    case "turn":
      return statement.degreesFrom ?? null;
    case "wait":
      return statement.secondsFrom ?? null;
    case "repeat":
      return statement.countFrom ?? null;
    case "setVariable":
    case "listAdd":
      return statement.value.type === "param" ? statement.value.paramId : null;
    case "changeVariable":
      return statement.delta.type === "param" ? statement.delta.paramId : null;
    default:
      return null;
  }
}

/** Whether a block has a number slot that can follow one of the custom block's numbers. */
export function studioBlockHasNumberSlot(statement: Statement): boolean {
  switch (statement.type) {
    case "move":
    case "turn":
    case "wait":
    case "repeat":
      return true;
    case "setVariable":
    case "listAdd":
      return statement.value.type === "numericLiteral" || statement.value.type === "param";
    case "changeVariable":
      return statement.delta.type === "numericLiteral" || statement.delta.type === "param";
    default:
      return false;
  }
}

function bindStatement(statement: Statement, paramId: ProcedureParamId | null): Statement {
  const expression = (): Expression =>
    paramId === null ? { type: "numericLiteral", value: 0 } : { type: "param", paramId };
  switch (statement.type) {
    case "move":
      return paramId === null
        ? withoutKey(statement, "stepsFrom")
        : { ...statement, stepsFrom: paramId };
    case "turn":
      return paramId === null
        ? withoutKey(statement, "degreesFrom")
        : { ...statement, degreesFrom: paramId };
    case "wait":
      return paramId === null
        ? withoutKey(statement, "secondsFrom")
        : { ...statement, secondsFrom: paramId };
    case "repeat":
      return paramId === null
        ? withoutKey(statement, "countFrom")
        : { ...statement, countFrom: paramId };
    case "setVariable":
    case "listAdd":
      return { ...statement, value: expression() };
    case "changeVariable":
      return { ...statement, delta: expression() };
    default:
      throw new RangeError("this block has no number slot");
  }
}

function fixedValue(statement: Statement): number {
  switch (statement.type) {
    case "move":
      return statement.steps;
    case "turn":
      return statement.degrees;
    case "wait":
      return statement.seconds;
    case "repeat":
      return statement.count;
    case "setVariable":
    case "listAdd":
      return statement.value.type === "numericLiteral" ? statement.value.value : 0;
    case "changeVariable":
      return statement.delta.type === "numericLiteral" ? statement.delta.value : 0;
    default:
      return 0;
  }
}

function usesNumber(body: readonly Statement[], paramId: ProcedureParamId): boolean {
  let used = false;
  remapParams(body, (id) => {
    if (id === paramId) used = true;
    return id;
  });
  return used;
}

/**
 * Make a block inside a custom block follow one of its numbers (or go back to its fixed value with
 * null). The first block to use a number gives every call that block's value, so nothing changes
 * until the child picks a different number in a call.
 */
export function bindStudioProcedureBlock(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  path: StudioBlockPath,
  paramId: ProcedureParamId | null,
): EditorHistory {
  return withScript(history, actorId, "set custom block number", (script) => {
    const procedure = script.procedures?.find((item) => item.id === procedureId);
    if (!procedure) throw new RangeError("unknown custom block");
    const at = paramId === null ? -1 : PARAM_IDS.indexOf(paramId);
    if (paramId !== null && at >= (procedure.params?.length ?? 0))
      throw new RangeError("unknown custom block number");
    let seed = 0;
    const body = updateAt(procedure.body, path, (statement) => {
      if (!studioBlockHasNumberSlot(statement))
        throw new RangeError("this block has no number slot");
      seed = fixedValue(statement);
      return bindStatement(statement, paramId);
    });
    const first = paramId !== null && !usesNumber(procedure.body, paramId);
    const changed = first
      ? mapScriptCalls(script, procedureId, (call) =>
          withArgs(
            call,
            argValues(call).map((value, index) =>
              index === at && typeof value === "number" ? seed : value,
            ),
          ),
        )
      : script;
    return {
      ...changed,
      procedures: (changed.procedures ?? []).map((item) =>
        item.id === procedureId ? { ...item, body } : item,
      ),
    };
  });
}

/** Choose the numbers for one use of a custom block in the character's blocks. */
export function setStudioCallNumbers(
  history: EditorHistory,
  actorId: string,
  index: number,
  values: readonly number[],
): EditorHistory {
  return withScript(history, actorId, "set custom block numbers", (script) => {
    const call = script.statements[index];
    if (call?.type !== "callProcedure") throw new RangeError("not a custom block");
    const arity =
      script.procedures?.find((item) => item.id === call.procedureId)?.params?.length ?? 0;
    if (values.length !== arity) throw new RangeError("wrong number of values");
    return {
      ...script,
      statements: script.statements.map((item, position) =>
        position === index ? withArgs(call, values) : item,
      ),
    };
  });
}

function reaches(procedures: readonly Procedure[], from: string, target: string): boolean {
  const seen = new Set<string>();
  const visit = (id: string): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    const body = procedures.find((item) => item.id === id)?.body ?? [];
    if (countCalls(body, target) > 0) return true;
    return procedures.some(
      (item) => item.id !== id && countCalls(body, item.id) > 0 && visit(item.id),
    );
  };
  return visit(from);
}

/**
 * Delete a custom block. "refuse" fails while anything still calls it; "inline" first replaces each
 * call with the block's own blocks, so the character does exactly what it did before.
 */
export function deleteStudioProcedure(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  mode: "refuse" | "inline",
): EditorHistory {
  return withScript(history, actorId, "delete custom block", (script) => {
    const procedure = script.procedures?.find((item) => item.id === procedureId);
    if (!procedure) throw new RangeError("unknown custom block");
    const uses = scriptCalls(script, procedureId);
    if (uses > 0 && mode === "refuse") throw new RangeError("custom block is in use");
    if (uses > 0 && reaches(script.procedures ?? [], procedureId, procedureId))
      throw new RangeError("a block that calls itself cannot be inlined");
    const rest = (script.procedures ?? []).filter((item) => item.id !== procedureId);
    const inlined = rest.map((item) => ({
      ...item,
      body: replaceCalls(item.body, procedure),
    }));
    return {
      id: script.id,
      trigger: script.trigger,
      statements: replaceCalls(script.statements, procedure),
      ...(inlined.length === 0 ? {} : { procedures: inlined }),
    };
  });
}

export function setStudioTrigger(
  history: EditorHistory,
  actorId: string,
  trigger: Trigger | "greenFlag" | "onActorClicked",
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const resolved = typeof trigger === "string" ? ({ type: trigger } as Trigger) : trigger;
  if (!checkedTrigger(resolved)) throw new RangeError("unsupported studio event");
  const index = program.scripts.findIndex((script) => {
    const actor = actorOfScript(script.id);
    return actor !== null && studioActorId(actor.index, actor.characterId) === actorId;
  });
  if (index < 0) throw new RangeError("unknown studio actor");
  const scripts = [...program.scripts];
  scripts[index] = { ...scripts[index]!, trigger: resolved };
  return recordCanonicalTransaction(history, {
    label: "set studio event",
    after: validateStudioProgram({ ...program, scripts }),
  }).history;
}

export function addStudioVariable(history: EditorHistory, name: string): EditorHistory {
  const program = validateStudioProgram(history.current);
  if (
    !DATA_NAME.test(name) ||
    (program.variables?.length ?? 0) >= 3 ||
    program.variables?.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  )
    throw new RangeError("invalid studio variable");
  const variables = [
    ...(program.variables ?? []),
    {
      id: `studio-var-${(program.variables?.length ?? 0) + 1}`,
      name,
      initialValue: 0,
      visible: true,
    },
  ];
  return recordCanonicalTransaction(history, {
    label: "add studio variable",
    after: validateStudioProgram({ ...program, variables }),
  }).history;
}

export function addStudioList(history: EditorHistory, name: string): EditorHistory {
  const program = validateStudioProgram(history.current);
  if (
    !DATA_NAME.test(name) ||
    (program.lists?.length ?? 0) >= 3 ||
    program.lists?.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  )
    throw new RangeError("invalid studio list");
  const lists = [
    ...(program.lists ?? []),
    {
      id: `studio-list-${(program.lists?.length ?? 0) + 1}`,
      name,
      initialItems: [],
      visible: true,
    },
  ];
  return recordCanonicalTransaction(history, {
    label: "add studio list",
    after: validateStudioProgram({ ...program, lists }),
  }).history;
}

export function removeStudioStatement(
  history: EditorHistory,
  actorId: string,
  statementIndex: number,
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const index = program.scripts.findIndex((script) => {
    const actor = actorOfScript(script.id);
    return actor !== null && studioActorId(actor.index, actor.characterId) === actorId;
  });
  const script = program.scripts[index];
  if (!script || statementIndex < 0 || statementIndex >= script.statements.length)
    throw new RangeError("unknown studio block");
  const scripts = [...program.scripts];
  scripts[index] = {
    ...script,
    statements: script.statements.filter((_, at) => at !== statementIndex),
  };
  const next = validateStudioProgram({ ...program, scripts });
  return recordCanonicalTransaction(history, { label: "remove studio block", after: next }).history;
}

/**
 * Choose the numbers for a use of one custom block inside another. Each value is a fixed number or
 * the id of one of the enclosing block's own numbers, which hands that number on.
 */
export function setStudioProcedureCallNumbers(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  path: StudioBlockPath,
  values: readonly StudioCallValue[],
): EditorHistory {
  return withScript(history, actorId, "set custom block numbers", (script) => {
    const owner = script.procedures?.find((item) => item.id === procedureId);
    if (!owner) throw new RangeError("unknown custom block");
    const body = updateAt(owner.body, path, (statement) => {
      if (statement.type !== "callProcedure") throw new RangeError("not a custom block");
      const arity =
        script.procedures?.find((item) => item.id === statement.procedureId)?.params?.length ?? 0;
      if (values.length !== arity) throw new RangeError("wrong number of values");
      return withArgs(statement, values);
    });
    return {
      ...script,
      procedures: (script.procedures ?? []).map((item) =>
        item.id === procedureId ? { ...item, body } : item,
      ),
    };
  });
}
