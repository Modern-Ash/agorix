import { recordCanonicalTransaction, type EditorHistory } from "@agorix/block-editor";
import {
  SCHEMA_VERSION,
  validateProgram,
  validateProjectCreativeState,
  type ProjectCreativeState,
  type ProjectProgram,
  type Statement,
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

const SCRIPT = /^studio-actor-([1-9][0-9]?)-([a-z]+)$/;
const MAX_STUDIO_ACTORS = 12;

export type StudioStatement = Extract<
  Statement,
  { type: "move" | "turn" | "switchCostume" | "switchBackdrop" | "playSound" }
>;

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

function checked(statement: Statement): boolean {
  if (statement.type === "move")
    return (
      Number.isInteger(statement.steps / 40) && statement.steps >= 40 && statement.steps <= 200
    );
  if (statement.type === "turn") return statement.degrees === -90 || statement.degrees === 90;
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
  return false;
}

export function validateStudioProgram(raw: ProjectProgram): ProjectProgram {
  const program = validateProgram(raw);
  if (
    program.scripts.length < 1 ||
    program.scripts.length > MAX_STUDIO_ACTORS ||
    (program.variables?.length ?? 0) > 0 ||
    (program.lists?.length ?? 0) > 0 ||
    program.scripts.some((script, position) => {
      const actor = actorOfScript(script.id);
      return (
        !actor ||
        actor.index !== position + 1 ||
        script.trigger.type !== "greenFlag" ||
        script.statements.some((statement) => !checked(statement))
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
): ProjectCreativeState {
  const program = validateStudioProgram(raw);
  if (!isGalleryBackdropId(backdropId)) throw new RangeError("unknown studio backdrop");
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
  ];
  const actors = program.scripts.map((script, position) => {
    const actor = actorOfScript(script.id)!;
    return {
      id: studioActorId(actor.index, actor.characterId),
      name: galleryCharacterName(actor.characterId, locale),
      x: (position % 5) * 60,
      y: Math.floor(position / 5) * 60,
      direction: 0,
      size: 100,
      visible: true,
      costumeId: `costume:${actor.characterId}`,
      scripts: [script.id],
    };
  });
  return validateProjectCreativeState(
    {
      assets,
      actors,
      stage: {
        backdropId: `backdrop:${backdropId}`,
        actorOrder: actors.map((actor) => actor.id),
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
  if (!checked(statement)) throw new RangeError("unsupported studio block or asset");
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
