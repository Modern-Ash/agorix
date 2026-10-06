import { validateProgram, type ProjectProgram } from "@agorix/program-model";
import { validateProjectActors } from "./actors.js";
import { PersistenceError, type StoredProject } from "./store.js";

export const CROSS_SURFACE_CONTRACT_VERSION = "agorix/cross-surface/v1";

export const FORBIDDEN_CANONICAL_UI_KEYS = [
  "selectedPanel",
  "editorSplitSize",
  "theme",
  "studioFileFocus",
  "studioEditorFocus",
  "tabletOrientation",
  "blocklyId",
  "selectedNodeId",
  "vscodeUri",
] as const;

export const FORBIDDEN_CANONICAL_IDENTITY_KEYS = [
  "accountId",
  "ownerAccountId",
  "sessionId",
  "username",
  "alias",
  "email",
  "recoveryContact",
  "projectId",
  "revision",
  "serverProjectRevision",
] as const;

export const FORBIDDEN_CANONICAL_PROGRAM_KEYS = [
  ...FORBIDDEN_CANONICAL_UI_KEYS,
  ...FORBIDDEN_CANONICAL_IDENTITY_KEYS,
] as const;

export interface SemanticProjectSnapshot {
  readonly contractVersion: typeof CROSS_SURFACE_CONTRACT_VERSION;
  readonly schemaVersion: string;
  readonly program: ProjectProgram;
  readonly progress: {
    readonly missionProgress: number;
    readonly hintLevel: number;
  };
}

export function assertCrossSurfaceCompatibleProject(stored: StoredProject): StoredProject {
  const program = validateProgram(stored.program);
  assertNoUiSpecificProgramState(program);
  if (stored.metadata.actors === undefined) {
    return { ...stored, program };
  }
  const actors = validateProjectActors(stored.metadata.actors);
  return { ...stored, program, metadata: { ...stored.metadata, actors } };
}

export function semanticProjectSnapshot(stored: StoredProject): SemanticProjectSnapshot {
  const compatible = assertCrossSurfaceCompatibleProject(stored);
  return {
    contractVersion: CROSS_SURFACE_CONTRACT_VERSION,
    schemaVersion: compatible.schemaVersion,
    program: compatible.program,
    progress: {
      missionProgress: compatible.metadata.missionProgress,
      hintLevel: compatible.metadata.hintLevel,
    },
  };
}

export function semanticProjectHash(stored: StoredProject): string {
  return stableHash(stableStringify(semanticProjectSnapshot(stored)));
}

export function assertSemanticallyEquivalentProjects(
  left: StoredProject,
  right: StoredProject,
): void {
  const leftHash = semanticProjectHash(left);
  const rightHash = semanticProjectHash(right);
  if (leftHash !== rightHash) {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      "cross-surface-project",
      `semantic project hash changed across surfaces: ${leftHash} != ${rightHash}`,
    );
  }
}

export function assertNoUiSpecificProgramState(program: ProjectProgram): void {
  const violation = findForbiddenKey(program);
  if (violation !== undefined) {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      "canonical-program",
      `Surface, identity or ownership key "${violation.key}" is not allowed in canonical program state at ${violation.path}`,
    );
  }
}

function findForbiddenKey(value: unknown, path = "$"): { key: string; path: string } | undefined {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findForbiddenKey(value[index], `${path}[${index}]`);
      if (nested !== undefined) {
        return nested;
      }
    }
    return undefined;
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if ((FORBIDDEN_CANONICAL_PROGRAM_KEYS as readonly string[]).includes(key)) {
      return { key, path: `${path}.${key}` };
    }
    const nested = findForbiddenKey(nestedValue, `${path}.${key}`);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
