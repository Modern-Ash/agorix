import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { validateProjectActors } from "./actors.js";
import {
  FORBIDDEN_CANONICAL_UI_KEYS,
  assertCrossSurfaceCompatibleProject,
} from "./compatibility.js";
import { PersistenceError, type ProjectMetadata, type StoredProject } from "./store.js";

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
] as const;

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

  const metadata = validatePortableMetadata(input.metadata);
  assertNoForbiddenProgramKeys(input.program);
  return assertCrossSurfaceCompatibleProject({
    schemaVersion: input.schemaVersion,
    program: input.program as ProjectProgram,
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

function validatePortableMetadata(input: unknown): ProjectMetadata {
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

  const locale = typeof input.locale === "string" ? { locale: input.locale } : {};
  const actors = "actors" in input ? { actors: validateProjectActors(input.actors) } : {};
  return {
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    missionProgress: input.missionProgress,
    hintLevel: input.hintLevel,
    ...locale,
    ...actors,
  };
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
