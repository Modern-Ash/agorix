import { recordCanonicalTransaction, type EditorHistory } from "@agorix/block-editor";
import {
  SCHEMA_VERSION,
  validateProgram,
  validateProjectCreativeState,
  type ProjectCreativeState,
  type ProjectAsset,
  type ProjectProgram,
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
      | "turn"
      | "switchCostume"
      | "switchBackdrop"
      | "playSound"
      | "setVolume"
      | "changeVolume"
      | "say"
      | "think"
      | "show"
      | "hide"
      | "setSize"
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
      | "if";
  }
>;

const STUDIO_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;
const STUDIO_MESSAGES = ["hola", "vamos", "listo"] as const;
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

function checkedNumber(value: Expression, program: ProjectProgram, depth = 0): boolean {
  if (depth > 2) return false;
  if (value.type === "numericLiteral") return finiteSmallNumber(value.value);
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
  if (["add", "subtract", "multiply", "divide"].includes(value.type)) {
    const binary = value as Extract<
      Expression,
      { type: "add" | "subtract" | "multiply" | "divide" }
    >;
    return (
      checkedNumber(binary.left, program, depth + 1) &&
      checkedNumber(binary.right, program, depth + 1) &&
      (binary.type !== "divide" ||
        (binary.right.type === "numericLiteral" && binary.right.value !== 0))
    );
  }
  return false;
}

function checkedCondition(value: Expression, program: ProjectProgram): boolean {
  if (value.type !== "greaterThan" && value.type !== "lessThan" && value.type !== "equals")
    return false;
  return checkedNumber(value.left, program) && checkedNumber(value.right, program);
}

function statementCount(statements: readonly Statement[]): number {
  return statements.reduce(
    (sum, statement) =>
      sum +
      1 +
      (statement.type === "repeat"
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

function checked(statement: Statement, program: ProjectProgram, depth = 0): boolean {
  if (statement.type === "move")
    return (
      Number.isInteger(statement.steps / 20) &&
      statement.steps !== 0 &&
      Math.abs(statement.steps) <= 200
    );
  if (statement.type === "turn") return [45, 90, 180, -45, -90, -180].includes(statement.degrees);
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
  if (statement.type === "setVolume")
    return Number.isInteger(statement.volume) && statement.volume >= 0 && statement.volume <= 100;
  if (statement.type === "changeVolume")
    return Number.isInteger(statement.delta) && statement.delta >= -100 && statement.delta <= 100;
  if (statement.type === "say" || statement.type === "think")
    return statement.text.trim().length > 0 && statement.text.length <= 80;
  if (statement.type === "show" || statement.type === "hide") return true;
  if (statement.type === "setSize") return [50, 75, 100, 125, 150].includes(statement.size);
  if (statement.type === "wait") return [0.5, 1, 2, 3].includes(statement.seconds);
  if (statement.type === "broadcast")
    return STUDIO_MESSAGES.includes(statement.message as (typeof STUDIO_MESSAGES)[number]);
  if (statement.type === "setVariable" || statement.type === "changeVariable")
    return (
      program.variables?.some((item) => item.id === statement.variableId) === true &&
      checkedNumber(statement.type === "setVariable" ? statement.value : statement.delta, program)
    );
  if (statement.type === "showVariable" || statement.type === "hideVariable")
    return program.variables?.some((item) => item.id === statement.variableId) === true;
  if (statement.type === "listAdd")
    return (
      program.lists?.some((item) => item.id === statement.listId) === true &&
      checkedNumber(statement.value, program)
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
      checkedNumber(statement.value, program)
    );
  if (statement.type === "repeat")
    return (
      depth < MAX_STUDIO_CONTROL_DEPTH &&
      [2, 3, 5].includes(statement.count) &&
      statement.body.length >= 1 &&
      statement.body.length <= MAX_STUDIO_BODY &&
      statement.body.every((item) => checked(item, program, depth + 1))
    );
  if (statement.type === "if") {
    return (
      depth < MAX_STUDIO_CONTROL_DEPTH &&
      checkedCondition(statement.condition, program) &&
      statement.then.length >= 1 &&
      statement.then.length <= MAX_STUDIO_BODY &&
      statement.then.every((item) => checked(item, program, depth + 1)) &&
      (statement.else === undefined ||
        (statement.else.length >= 1 &&
          statement.else.length <= MAX_STUDIO_BODY &&
          statement.else.every((item) => checked(item, program, depth + 1))))
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
        statementCount(script.statements) > MAX_STUDIO_BLOCKS ||
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
