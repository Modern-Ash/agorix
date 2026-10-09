import type { ProjectProgram, Statement } from "./schema.js";
import { ProgramValidationError } from "./validate.js";

export type ProjectAssetKind = "costume" | "backdrop" | "sound";

export interface ProjectAsset {
  readonly id: string;
  readonly kind: ProjectAssetKind;
  readonly name: string;
  readonly source: string;
  readonly tags?: readonly string[];
}

export interface ProjectActor {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly direction: number;
  readonly size: number;
  readonly visible: boolean;
  readonly costumeId?: string;
  readonly scripts?: readonly string[];
}

export interface ProjectStage {
  readonly backdropId?: string;
  readonly width?: number;
  readonly height?: number;
  readonly actorOrder?: readonly string[];
}

export interface ProjectCreativeState {
  readonly actors?: readonly ProjectActor[];
  readonly stage?: ProjectStage;
  readonly assets?: readonly ProjectAsset[];
}

interface CreativeValidationState {
  readonly actorIds: Set<string>;
  readonly assetIds: Set<string>;
  readonly costumeIds: Set<string>;
  readonly backdropIds: Set<string>;
  readonly soundIds: Set<string>;
  readonly scriptIds: Set<string>;
}

const MAX_ACTORS = 32;
const MAX_ASSETS = 128;
const MAX_TAGS = 16;
const MAX_STAGE_DIMENSION = 4096;
const MAX_ACTOR_SIZE = 400;
const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const CREATIVE_KEYS = ["actors", "stage", "assets"] as const;
const ASSET_KEYS = ["id", "kind", "name", "source", "tags"] as const;
const ACTOR_KEYS = [
  "id",
  "name",
  "x",
  "y",
  "direction",
  "size",
  "visible",
  "costumeId",
  "scripts",
] as const;
const STAGE_KEYS = ["backdropId", "width", "height", "actorOrder"] as const;

function fail(path: string, message: string, value: unknown): never {
  throw new ProgramValidationError("INVALID_CREATIVE_STATE", path, message, value);
}

function failReference(path: string, message: string, value: unknown): never {
  throw new ProgramValidationError("INVALID_REFERENCE", path, message, value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertAllowedKeys(
  input: Record<string, unknown>,
  keys: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) {
      fail(`${path}.${key}`, "unexpected creative-state field", input[key]);
    }
  }
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "expected a finite number", value);
  }
  return value;
}

function boundedPositiveNumber(value: unknown, path: string, max: number): number {
  const number = finiteNumber(value, path);
  if (number <= 0 || number > max) {
    fail(path, `expected a number greater than 0 and at most ${max}`, value);
  }
  return number;
}

function optionalBoundedPositiveNumber(
  value: unknown,
  path: string,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;
  return boundedPositiveNumber(value, path, max);
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 120) {
    fail(path, "expected a non-empty string of at most 120 characters", value);
  }
  return value;
}

function stableId(value: unknown, path: string): string {
  const id = nonEmptyString(value, path);
  if (!STABLE_ID_PATTERN.test(id)) {
    fail(path, "expected a stable id token", value);
  }
  return id;
}

function optionalStableId(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  return stableId(value, path);
}

function optionalStringArray(
  value: unknown,
  path: string,
  maxLength: number,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maxLength) {
    fail(path, `expected an array with at most ${maxLength} entries`, value);
  }
  return value.map((item, index) => nonEmptyString(item, `${path}[${index}]`));
}

function optionalStableIdArray(
  value: unknown,
  path: string,
  maxLength: number,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maxLength) {
    fail(path, `expected an array with at most ${maxLength} entries`, value);
  }
  return value.map((item, index) => stableId(item, `${path}[${index}]`));
}

function recordUniqueId(ids: Set<string>, id: string, path: string): void {
  if (ids.has(id)) {
    throw new ProgramValidationError(
      "DUPLICATE_ID",
      path,
      `duplicate id ${JSON.stringify(id)}`,
      id,
    );
  }
  ids.add(id);
}

function validateAsset(input: unknown, path: string, state: CreativeValidationState): ProjectAsset {
  if (!isPlainObject(input)) {
    fail(path, "expected an object", input);
  }
  assertAllowedKeys(input, ASSET_KEYS, path);
  const id = stableId(input.id, `${path}.id`);
  recordUniqueId(state.assetIds, id, `${path}.id`);
  const kind = input.kind;
  if (kind !== "costume" && kind !== "backdrop" && kind !== "sound") {
    fail(`${path}.kind`, "expected costume, backdrop or sound", kind);
  }
  const asset: ProjectAsset = {
    id,
    kind,
    name: nonEmptyString(input.name, `${path}.name`),
    source: nonEmptyString(input.source, `${path}.source`),
    ...(input.tags === undefined
      ? {}
      : { tags: optionalStringArray(input.tags, `${path}.tags`, MAX_TAGS) ?? [] }),
  };
  if (kind === "costume") state.costumeIds.add(id);
  if (kind === "backdrop") state.backdropIds.add(id);
  if (kind === "sound") state.soundIds.add(id);
  return asset;
}

function validateActor(input: unknown, path: string, state: CreativeValidationState): ProjectActor {
  if (!isPlainObject(input)) {
    fail(path, "expected an object", input);
  }
  assertAllowedKeys(input, ACTOR_KEYS, path);
  const id = stableId(input.id, `${path}.id`);
  recordUniqueId(state.actorIds, id, `${path}.id`);
  const costumeId = optionalStableId(input.costumeId, `${path}.costumeId`);
  if (costumeId !== undefined && !state.costumeIds.has(costumeId)) {
    failReference(
      `${path}.costumeId`,
      `unknown costume id ${JSON.stringify(costumeId)}`,
      costumeId,
    );
  }
  const scripts = optionalStableIdArray(input.scripts, `${path}.scripts`, 32);
  for (const [index, scriptId] of (scripts ?? []).entries()) {
    if (!state.scriptIds.has(scriptId)) {
      failReference(
        `${path}.scripts[${index}]`,
        `unknown script id ${JSON.stringify(scriptId)}`,
        scriptId,
      );
    }
  }
  return {
    id,
    name: nonEmptyString(input.name, `${path}.name`),
    x: finiteNumber(input.x, `${path}.x`),
    y: finiteNumber(input.y, `${path}.y`),
    direction: finiteNumber(input.direction, `${path}.direction`),
    size: boundedPositiveNumber(input.size, `${path}.size`, MAX_ACTOR_SIZE),
    visible:
      typeof input.visible === "boolean"
        ? input.visible
        : fail(`${path}.visible`, "expected a boolean", input.visible),
    ...(costumeId === undefined ? {} : { costumeId }),
    ...(scripts === undefined ? {} : { scripts }),
  };
}

function validateStage(input: unknown, path: string, state: CreativeValidationState): ProjectStage {
  if (input === undefined) return {};
  if (!isPlainObject(input)) {
    fail(path, "expected an object", input);
  }
  assertAllowedKeys(input, STAGE_KEYS, path);
  const backdropId = optionalStableId(input.backdropId, `${path}.backdropId`);
  if (backdropId !== undefined && !state.backdropIds.has(backdropId)) {
    failReference(
      `${path}.backdropId`,
      `unknown backdrop id ${JSON.stringify(backdropId)}`,
      backdropId,
    );
  }
  const actorOrder = optionalStableIdArray(input.actorOrder, `${path}.actorOrder`, MAX_ACTORS);
  const seenActorOrder = new Set<string>();
  for (const [index, actorId] of (actorOrder ?? []).entries()) {
    if (seenActorOrder.has(actorId)) {
      throw new ProgramValidationError(
        "DUPLICATE_ID",
        `${path}.actorOrder[${index}]`,
        `duplicate actor order id ${JSON.stringify(actorId)}`,
        actorId,
      );
    }
    seenActorOrder.add(actorId);
    if (!state.actorIds.has(actorId)) {
      failReference(
        `${path}.actorOrder[${index}]`,
        `unknown actor id ${JSON.stringify(actorId)}`,
        actorId,
      );
    }
  }
  const width = optionalBoundedPositiveNumber(input.width, `${path}.width`, MAX_STAGE_DIMENSION);
  const height = optionalBoundedPositiveNumber(input.height, `${path}.height`, MAX_STAGE_DIMENSION);
  return {
    ...(backdropId === undefined ? {} : { backdropId }),
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    ...(actorOrder === undefined ? {} : { actorOrder }),
  };
}

function validateStatementAssetRefs(
  statements: readonly Statement[],
  path: string,
  state: CreativeValidationState,
): void {
  for (const [index, statement] of statements.entries()) {
    const statementPath = `${path}[${index}]`;
    if (statement.type === "switchCostume" && !state.costumeIds.has(statement.costumeId)) {
      failReference(
        `${statementPath}.costumeId`,
        `unknown costume id ${JSON.stringify(statement.costumeId)}`,
        statement.costumeId,
      );
    }
    if (statement.type === "switchBackdrop" && !state.backdropIds.has(statement.backdropId)) {
      failReference(
        `${statementPath}.backdropId`,
        `unknown backdrop id ${JSON.stringify(statement.backdropId)}`,
        statement.backdropId,
      );
    }
    if (statement.type === "playSound" && !state.soundIds.has(statement.soundId)) {
      failReference(
        `${statementPath}.soundId`,
        `unknown sound id ${JSON.stringify(statement.soundId)}`,
        statement.soundId,
      );
    }
    if (statement.type === "repeat") {
      validateStatementAssetRefs(statement.body, `${statementPath}.body`, state);
    }
    if (statement.type === "if") {
      validateStatementAssetRefs(statement.then, `${statementPath}.then`, state);
    }
  }
}

export function validateProjectCreativeState(
  input: unknown,
  program: ProjectProgram,
): ProjectCreativeState {
  if (input === undefined) return {};
  if (!isPlainObject(input)) {
    fail("$", "expected an object", input);
  }
  assertAllowedKeys(input, CREATIVE_KEYS, "$");
  const state: CreativeValidationState = {
    actorIds: new Set(),
    assetIds: new Set(),
    costumeIds: new Set(),
    backdropIds: new Set(),
    soundIds: new Set(),
    scriptIds: new Set(program.scripts.map((script) => script.id)),
  };
  const rawAssets = input.assets;
  const assets =
    rawAssets === undefined
      ? undefined
      : Array.isArray(rawAssets) && rawAssets.length <= MAX_ASSETS
        ? rawAssets.map((asset, index) => validateAsset(asset, `$.assets[${index}]`, state))
        : fail("$.assets", `expected an array with at most ${MAX_ASSETS} entries`, rawAssets);
  const rawActors = input.actors;
  const actors =
    rawActors === undefined
      ? undefined
      : Array.isArray(rawActors) && rawActors.length <= MAX_ACTORS
        ? rawActors.map((actor, index) => validateActor(actor, `$.actors[${index}]`, state))
        : fail("$.actors", `expected an array with at most ${MAX_ACTORS} entries`, rawActors);
  const stage =
    input.stage === undefined ? undefined : validateStage(input.stage, "$.stage", state);
  for (const [index, script] of program.scripts.entries()) {
    validateStatementAssetRefs(script.statements, `$.program.scripts[${index}].statements`, state);
  }
  return {
    ...(actors === undefined ? {} : { actors }),
    ...(stage === undefined ? {} : { stage }),
    ...(assets === undefined ? {} : { assets }),
  };
}
