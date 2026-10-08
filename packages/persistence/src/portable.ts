import {
  SCHEMA_VERSION,
  validateProgram,
  validateProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import {
  FORBIDDEN_CANONICAL_UI_KEYS,
  assertCrossSurfaceCompatibleProject,
} from "./compatibility.js";
import {
  PersistenceError,
  type ProjectActor,
  type ProjectMetadata,
  type StoredProject,
} from "./store.js";

export const AGORIX_PROJECT_FORMAT = "agorix-project";
export const AGORIX_PROJECT_FORMAT_VERSION = "1";
export const AGORIX_PROJECT_EXTENSION = ".agorix";
export const AGORIX_PROJECT_MEDIA_TYPE = "application/vnd.agorix.project+json";
export const AGORIX_PROJECT_MAX_BYTES = 1024 * 1024;

const PORTABLE_PROJECT_ID = "portable-project";

const ENVELOPE_KEYS = ["format", "formatVersion", "exportedAt", "project"] as const;
const PROJECT_KEYS = ["schemaVersion", "program", "metadata"] as const;
const METADATA_KEYS = [
  "createdAt",
  "updatedAt",
  "missionProgress",
  "hintLevel",
  "locale",
  "actors",
  "stage",
  "assets",
] as const;
const ACTOR_KEYS = [
  "id",
  "name",
  "x",
  "y",
  "direction",
  "size",
  "visible",
  "costumeId",
  "appearanceId",
  "scripts",
] as const;
const STAGE_KEYS = ["backdropId", "width", "height", "actorOrder"] as const;
const ASSET_KEYS = ["id", "kind", "name", "source", "tags"] as const;

export const FORBIDDEN_PORTABLE_PROJECT_KEYS = [
  "accountId",
  "username",
  "email",
  "password",
  "passwordHash",
  "hash",
  "session",
  "sessionId",
  "sessionToken",
  "token",
  "accessToken",
  "refreshToken",
  "ownerAccountId",
  "serverProjectRevision",
  "revision",
  "projectId",
  "databaseId",
  "undoStack",
  "redoStack",
  "history",
  "providerApiKey",
  "apiKey",
  "secret",
  "logs",
  "telemetry",
  "aiConversation",
] as const;

export interface AgorixProjectEnvelopeV1 {
  readonly format: typeof AGORIX_PROJECT_FORMAT;
  readonly formatVersion: typeof AGORIX_PROJECT_FORMAT_VERSION;
  readonly exportedAt: string;
  readonly project: StoredProject;
}

export interface SerializeAgorixProjectOptions {
  readonly exportedAt?: string;
  readonly maxBytes?: number;
}

export interface ParseAgorixProjectOptions {
  readonly maxBytes?: number;
}

export type AgorixProjectSource = string | Uint8Array;

export function serializeAgorixProject(
  stored: StoredProject,
  options: SerializeAgorixProjectOptions = {},
): string {
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  assertIsoDate(exportedAt, "$.exportedAt");
  const project = validatePortableStoredProject(stored);
  const envelope: AgorixProjectEnvelopeV1 = {
    format: AGORIX_PROJECT_FORMAT,
    formatVersion: AGORIX_PROJECT_FORMAT_VERSION,
    exportedAt,
    project,
  };
  const json = `${JSON.stringify(envelope, null, 2)}\n`;
  assertByteLimit(json, options.maxBytes ?? AGORIX_PROJECT_MAX_BYTES);
  return json;
}

export function parseAgorixProject(
  source: AgorixProjectSource,
  options: ParseAgorixProjectOptions = {},
): AgorixProjectEnvelopeV1 {
  const maxBytes = options.maxBytes ?? AGORIX_PROJECT_MAX_BYTES;
  assertByteLimit(source, maxBytes);
  const text = typeof source === "string" ? source : decodeUtf8(source);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PersistenceError("CORRUPTED_DATA", PORTABLE_PROJECT_ID, "cannot parse .agorix JSON");
  }
  return validateAgorixProjectEnvelope(parsed);
}

export function validateAgorixProjectEnvelope(input: unknown): AgorixProjectEnvelopeV1 {
  assertPlainObject(input, "$");
  assertAllowedKeys(input, ENVELOPE_KEYS, "$");
  assertNoForbiddenPortableKeys(input, "$");

  if (input.format !== AGORIX_PROJECT_FORMAT) {
    throw new PersistenceError(
      "FORMAT_MISMATCH",
      PORTABLE_PROJECT_ID,
      `expected format ${JSON.stringify(AGORIX_PROJECT_FORMAT)}`,
    );
  }
  if (input.formatVersion !== AGORIX_PROJECT_FORMAT_VERSION) {
    throw new PersistenceError(
      "UNSUPPORTED_FORMAT",
      PORTABLE_PROJECT_ID,
      `unsupported .agorix formatVersion ${JSON.stringify(input.formatVersion)}`,
    );
  }
  if (typeof input.exportedAt !== "string") {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      "exportedAt must be a string",
    );
  }
  assertIsoDate(input.exportedAt, "$.exportedAt");

  return {
    format: AGORIX_PROJECT_FORMAT,
    formatVersion: AGORIX_PROJECT_FORMAT_VERSION,
    exportedAt: input.exportedAt,
    project: validatePortableStoredProject(input.project),
  };
}

export function validatePortableStoredProject(input: unknown): StoredProject {
  assertPlainObject(input, "$.project");
  assertAllowedKeys(input, PROJECT_KEYS, "$.project");
  assertNoForbiddenPortableKeys(input, "$.project");

  if (input.schemaVersion !== SCHEMA_VERSION) {
    throw new PersistenceError(
      "UNKNOWN_VERSION",
      PORTABLE_PROJECT_ID,
      `unsupported project schemaVersion ${JSON.stringify(input.schemaVersion)}`,
    );
  }

  assertNoForbiddenProgramKeys(input.program);
  const program = validateProgram(input.program);
  const metadata = validatePortableMetadata(input.metadata, program);
  return assertCrossSurfaceCompatibleProject({
    schemaVersion: input.schemaVersion,
    program,
    metadata,
  });
}

export function sanitizeAgorixFilename(name: string): string {
  const withoutExtension = name.trim().replace(/\.agorix$/i, "");
  const slug = withoutExtension
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `${slug || "agorix-project"}${AGORIX_PROJECT_EXTENSION}`;
}

function validatePortableMetadata(input: unknown, program: ProjectProgram): ProjectMetadata {
  assertPlainObject(input, "$.project.metadata");
  assertAllowedKeys(input, METADATA_KEYS, "$.project.metadata");
  assertNoForbiddenPortableKeys(input, "$.project.metadata");

  if (typeof input.createdAt !== "string") {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      "createdAt must be a string",
    );
  }
  if (typeof input.updatedAt !== "string") {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      "updatedAt must be a string",
    );
  }
  if (typeof input.missionProgress !== "number" || !Number.isFinite(input.missionProgress)) {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      "missionProgress must be a finite number",
    );
  }
  if (typeof input.hintLevel !== "number" || !Number.isFinite(input.hintLevel)) {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      "hintLevel must be a finite number",
    );
  }
  if ("locale" in input && typeof input.locale !== "string") {
    throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, "locale must be a string");
  }

  const creative = validateProjectCreativeState(
    {
      actors: validateActors(input.actors),
      stage: validateStage(input.stage),
      assets: validateAssets(input.assets),
    },
    program,
  );
  const metadata: ProjectMetadata = {
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    missionProgress: input.missionProgress,
    hintLevel: input.hintLevel,
    ...creative,
  };
  if ("locale" in input) {
    const locale = input.locale;
    if (typeof locale === "string") {
      return { ...metadata, locale };
    }
  }
  return metadata;
}

function validateActors(input: unknown): readonly ProjectActor[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length > 32) {
    throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, "actors must be an array");
  }
  return input.map((actor, index) => validateActor(actor, index));
}

function validateActor(input: unknown, index: number): ProjectActor {
  const path = `$.project.metadata.actors[${index}]`;
  assertPlainObject(input, path);
  assertAllowedKeys(input, ACTOR_KEYS, path);
  assertNoForbiddenPortableKeys(input, path);
  if (typeof input.id !== "string" || input.id.length < 1 || input.id.length > 80) {
    throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.id invalid`);
  }
  if (typeof input.name !== "string" || input.name.length < 1 || input.name.length > 80) {
    throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.name invalid`);
  }
  for (const key of ["x", "y", "direction", "size"] as const) {
    if (typeof input[key] !== "number" || !Number.isFinite(input[key])) {
      throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.${key} invalid`);
    }
  }
  if (typeof input.visible !== "boolean") {
    throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.visible invalid`);
  }
  const { x, y, direction, size } = input as Record<"x" | "y" | "direction" | "size", number>;
  if ("costumeId" in input && typeof input.costumeId !== "string") {
    throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.costumeId invalid`);
  }
  if ("appearanceId" in input && typeof input.appearanceId !== "string") {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      `${path}.appearanceId invalid`,
    );
  }
  if (
    "scripts" in input &&
    (!Array.isArray(input.scripts) ||
      input.scripts.length > 32 ||
      !input.scripts.every((script) => typeof script === "string"))
  ) {
    throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.scripts invalid`);
  }
  const costumeId =
    typeof input.costumeId === "string"
      ? input.costumeId
      : typeof input.appearanceId === "string"
        ? input.appearanceId
        : undefined;
  return {
    id: input.id,
    name: input.name,
    x,
    y,
    direction,
    size,
    visible: input.visible,
    ...(costumeId === undefined ? {} : { costumeId }),
    ...(Array.isArray(input.scripts) ? { scripts: input.scripts as readonly string[] } : {}),
  };
}

function validateStage(input: unknown): ProjectMetadata["stage"] {
  if (input === undefined) return undefined;
  const path = "$.project.metadata.stage";
  assertPlainObject(input, path);
  assertAllowedKeys(input, STAGE_KEYS, path);
  assertNoForbiddenPortableKeys(input, path);
  if ("backdropId" in input && typeof input.backdropId !== "string") {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      `${path}.backdropId invalid`,
    );
  }
  for (const key of ["width", "height"] as const) {
    if (key in input && (typeof input[key] !== "number" || !Number.isFinite(input[key]))) {
      throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.${key} invalid`);
    }
  }
  if (
    "actorOrder" in input &&
    (!Array.isArray(input.actorOrder) ||
      input.actorOrder.length > 32 ||
      !input.actorOrder.every((actorId) => typeof actorId === "string"))
  ) {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      `${path}.actorOrder invalid`,
    );
  }
  return {
    ...(typeof input.backdropId === "string" ? { backdropId: input.backdropId } : {}),
    ...(typeof input.width === "number" ? { width: input.width } : {}),
    ...(typeof input.height === "number" ? { height: input.height } : {}),
    ...(Array.isArray(input.actorOrder)
      ? { actorOrder: input.actorOrder as readonly string[] }
      : {}),
  };
}

function validateAssets(input: unknown): ProjectMetadata["assets"] {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length > 128) {
    throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, "assets must be an array");
  }
  return input.map((asset, index) => {
    const path = `$.project.metadata.assets[${index}]`;
    assertPlainObject(asset, path);
    assertAllowedKeys(asset, ASSET_KEYS, path);
    assertNoForbiddenPortableKeys(asset, path);
    if (typeof asset.id !== "string") {
      throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.id invalid`);
    }
    if (asset.kind !== "costume" && asset.kind !== "backdrop" && asset.kind !== "sound") {
      throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.kind invalid`);
    }
    if (typeof asset.name !== "string" || asset.name.length < 1 || asset.name.length > 120) {
      throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.name invalid`);
    }
    if (typeof asset.source !== "string" || asset.source.length < 1 || asset.source.length > 120) {
      throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.source invalid`);
    }
    if (
      "tags" in asset &&
      (!Array.isArray(asset.tags) ||
        asset.tags.length > 16 ||
        !asset.tags.every((tag) => typeof tag === "string" && tag.length >= 1 && tag.length <= 40))
    ) {
      throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path}.tags invalid`);
    }
    return {
      id: asset.id,
      kind: asset.kind,
      name: asset.name,
      source: asset.source,
      ...(Array.isArray(asset.tags) ? { tags: asset.tags as readonly string[] } : {}),
    };
  });
}

function assertByteLimit(source: AgorixProjectSource, maxBytes: number): void {
  const bytes =
    typeof source === "string" ? new TextEncoder().encode(source).byteLength : source.byteLength;
  if (bytes > maxBytes) {
    throw new PersistenceError(
      "FILE_TOO_LARGE",
      PORTABLE_PROJECT_ID,
      `.agorix file exceeds the maximum of ${maxBytes} bytes`,
    );
  }
}

function decodeUtf8(source: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(source);
  } catch {
    throw new PersistenceError("CORRUPTED_DATA", PORTABLE_PROJECT_ID, "file is not valid UTF-8");
  }
}

function assertIsoDate(value: string, path: string): void {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path} must be ISO-8601`);
  }
}

function assertPlainObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, `${path} must be an object`);
  }
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new PersistenceError(
        "FORBIDDEN_FIELD",
        PORTABLE_PROJECT_ID,
        `field ${path}.${key} is not part of .agorix v1`,
      );
    }
  }
}

function assertNoForbiddenPortableKeys(value: unknown, path: string): void {
  const violation = findForbiddenPortableKey(value, path);
  if (violation !== undefined) {
    throw new PersistenceError(
      "FORBIDDEN_FIELD",
      PORTABLE_PROJECT_ID,
      `field ${violation.path} is not allowed in .agorix files`,
    );
  }
}

function assertNoForbiddenProgramKeys(value: unknown): void {
  const violation = findForbiddenProgramKey(value, "$.project.program");
  if (violation !== undefined) {
    throw new PersistenceError(
      "FORBIDDEN_FIELD",
      PORTABLE_PROJECT_ID,
      `UI-specific field ${violation.path} is not allowed in canonical program state`,
    );
  }
}

function findForbiddenPortableKey(
  value: unknown,
  path: string,
): { key: string; path: string } | undefined {
  return findForbiddenKey(value, path, FORBIDDEN_PORTABLE_PROJECT_KEYS);
}

function findForbiddenProgramKey(
  value: unknown,
  path: string,
): { key: string; path: string } | undefined {
  return findForbiddenKey(value, path, FORBIDDEN_CANONICAL_UI_KEYS);
}

function findForbiddenKey(
  value: unknown,
  path: string,
  forbiddenKeys: readonly string[],
): { key: string; path: string } | undefined {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findForbiddenKey(value[index], `${path}[${index}]`, forbiddenKeys);
      if (nested !== undefined) return nested;
    }
    return undefined;
  }
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    if (forbiddenKeys.includes(key)) {
      return { key, path: `${path}.${key}` };
    }
    const nested = findForbiddenKey(nestedValue, `${path}.${key}`, forbiddenKeys);
    if (nested !== undefined) return nested;
  }
  return undefined;
}
