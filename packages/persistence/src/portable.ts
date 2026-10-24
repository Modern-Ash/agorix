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
import { PersistenceError, type ProjectMetadata, type StoredProject } from "./store.js";
import { validateProjectActors, type ProjectActors } from "./actors.js";
import { validateProjectMissionSpec } from "./missionSpec.js";
import { validateAdvancedProgress } from "./advancedProgress.js";

export const AGORIX_PROJECT_FORMAT = "agorix-project";
export const AGORIX_PROJECT_FORMAT_VERSION = "1";
export const AGORIX_PROJECT_MEDIA_FORMAT_VERSION = "2";
export const AGORIX_PROJECT_EXTENSION = ".agorix";
export const AGORIX_PROJECT_MEDIA_TYPE = "application/vnd.agorix.project+json";
export const AGORIX_PROJECT_MAX_BYTES = 1024 * 1024;

const PORTABLE_PROJECT_ID = "portable-project";

const ENVELOPE_KEYS = ["format", "formatVersion", "exportedAt", "project"] as const;
const MEDIA_ENVELOPE_KEYS = [...ENVELOPE_KEYS, "media"] as const;
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
  "missionSpec",
  "advancedProgress",
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

export interface AgorixProjectEnvelopeV2 {
  readonly format: typeof AGORIX_PROJECT_FORMAT;
  readonly formatVersion: typeof AGORIX_PROJECT_MEDIA_FORMAT_VERSION;
  readonly exportedAt: string;
  /** In-memory project has its embedded image sources rehydrated. */
  readonly project: StoredProject;
  readonly media: Readonly<Record<string, string>>;
}

export type AgorixProjectEnvelope = AgorixProjectEnvelopeV1 | AgorixProjectEnvelopeV2;

export interface SerializeAgorixProjectOptions {
  readonly exportedAt?: string;
  readonly maxBytes?: number;
  /** Requires an explicit adult decision before child-added media leaves this device. */
  readonly includeMedia?: boolean;
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
  const project = validatePortableStoredProject(stored, true);
  const media: Record<string, string> = {};
  const assets = project.metadata.assets?.map((asset) => {
    if (!asset.source.startsWith("data:image/")) return asset;
    media[asset.id] = asset.source;
    return { ...asset, source: `embedded:${asset.id}` };
  });
  const hasMedia = Object.keys(media).length > 0;
  if (hasMedia && options.includeMedia !== true) {
    throw new PersistenceError(
      "FORBIDDEN_FIELD",
      PORTABLE_PROJECT_ID,
      "embedded media needs explicit adult opt-in",
    );
  }
  if (Object.keys(media).length > 12) {
    throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, "too many embedded images");
  }
  const portableProject = hasMedia
    ? validatePortableStoredProject({
        ...project,
        metadata: { ...project.metadata, assets },
      })
    : project;
  const envelope = hasMedia
    ? {
        format: AGORIX_PROJECT_FORMAT,
        formatVersion: AGORIX_PROJECT_MEDIA_FORMAT_VERSION,
        exportedAt,
        project: portableProject,
        media,
      }
    : {
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
): AgorixProjectEnvelope {
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

export function validateAgorixProjectEnvelope(input: unknown): AgorixProjectEnvelope {
  assertPlainObject(input, "$");
  const isMedia = input.formatVersion === AGORIX_PROJECT_MEDIA_FORMAT_VERSION;
  assertAllowedKeys(input, isMedia ? MEDIA_ENVELOPE_KEYS : ENVELOPE_KEYS, "$");
  assertNoForbiddenPortableKeys(input, "$");

  if (input.format !== AGORIX_PROJECT_FORMAT) {
    throw new PersistenceError(
      "FORMAT_MISMATCH",
      PORTABLE_PROJECT_ID,
      `expected format ${JSON.stringify(AGORIX_PROJECT_FORMAT)}`,
    );
  }
  if (input.formatVersion !== AGORIX_PROJECT_FORMAT_VERSION && !isMedia) {
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

  const project = validatePortableStoredProject(input.project);
  if (!isMedia) {
    return {
      format: AGORIX_PROJECT_FORMAT,
      formatVersion: AGORIX_PROJECT_FORMAT_VERSION,
      exportedAt: input.exportedAt,
      project,
    };
  }
  assertPlainObject(input.media, "$.media");
  const assets = project.metadata.assets ?? [];
  const embedded = assets.filter((asset) => asset.source.startsWith("embedded:"));
  if (embedded.length > 12 || Object.keys(input.media).length !== embedded.length) {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      "embedded media count invalid",
    );
  }
  for (const asset of embedded) {
    if (
      asset.kind === "sound" ||
      asset.source !== `embedded:${asset.id}` ||
      !validInlineImage(input.media[asset.id])
    ) {
      throw new PersistenceError(
        "SCHEMA_MISMATCH",
        PORTABLE_PROJECT_ID,
        `embedded media invalid for ${asset.id}`,
      );
    }
  }
  const validatedMedia = input.media as Record<string, string>;
  const hydrated = validatePortableStoredProject(
    {
      ...project,
      metadata: {
        ...project.metadata,
        assets: assets.map((asset) =>
          asset.source.startsWith("embedded:")
            ? { ...asset, source: validatedMedia[asset.id] }
            : asset,
        ),
      },
    },
    true,
  );
  return {
    format: AGORIX_PROJECT_FORMAT,
    formatVersion: AGORIX_PROJECT_MEDIA_FORMAT_VERSION,
    exportedAt: input.exportedAt,
    project: hydrated,
    media: validatedMedia,
  };
}

export function validatePortableStoredProject(
  input: unknown,
  allowInlineImages = false,
): StoredProject {
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
  const metadata = validatePortableMetadata(input.metadata, program, allowInlineImages);
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

function validatePortableMetadata(
  input: unknown,
  program: ProjectProgram,
  allowInlineImages: boolean,
): ProjectMetadata {
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

  const actors = validateActors(input.actors);
  const creative = validateProjectCreativeState(
    {
      actors: actors?.items,
      stage: validateStage(input.stage),
      assets: validateAssets(input.assets, allowInlineImages),
    },
    program,
  );
  const portableCreative = {
    ...(creative.stage === undefined ? {} : { stage: creative.stage }),
    ...(creative.assets === undefined ? {} : { assets: creative.assets }),
  };
  const metadata: ProjectMetadata = {
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    missionProgress: input.missionProgress,
    hintLevel: input.hintLevel,
    ...("locale" in input && typeof input.locale === "string" ? { locale: input.locale } : {}),
    ...(actors === undefined ? {} : { actors }),
    ...portableCreative,
    ...(input.missionSpec === undefined
      ? {}
      : { missionSpec: validateProjectMissionSpec(input.missionSpec) }),
    ...(input.advancedProgress === undefined
      ? {}
      : { advancedProgress: validateAdvancedProgress(input.advancedProgress) }),
  };
  return metadata;
}

function validateActors(input: unknown): ProjectActors | undefined {
  if (input === undefined) return undefined;
  assertNoForbiddenPortableKeys(input, "$.project.metadata.actors");
  return validateProjectActors(input);
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

function validInlineImage(source: unknown): source is string {
  if (typeof source !== "string") return false;
  const match = /^data:image\/(png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(source);
  if (!match) return false;
  try {
    const bytes = atob(match[2]!);
    if (bytes.length === 0 || bytes.length >= 60 * 1024) return false;
    return match[1] === "png"
      ? bytes.startsWith("\x89PNG\r\n\x1a\n")
      : bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
  } catch {
    return false;
  }
}

function validateAssets(input: unknown, allowInlineImages: boolean): ProjectMetadata["assets"] {
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
    if (
      typeof asset.source !== "string" ||
      (asset.source.startsWith("data:")
        ? !allowInlineImages || asset.kind === "sound" || !validInlineImage(asset.source)
        : asset.source.length < 1 || asset.source.length > 120)
    ) {
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
