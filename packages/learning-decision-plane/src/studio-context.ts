import type { LearningCompanionScaffoldLevel } from "@agorix/tutor-contract";
import {
  STUDIO_SIGNAL_LIMITS,
  sanitizeStudioIds,
  sanitizeStudioRanges,
  sanitizeStudioToken,
  type StudioSignal,
  type StudioSignalRange,
} from "./studio-signals.js";

export const STUDIO_CONTEXT_SCHEMA_VERSION = "agorix/studio-context/v1";

export const STUDIO_CONTEXT_LIMITS = {
  maxSnapshotNodes: 200,
  maxObservations: 20,
  maxScaffoldHistory: 20,
  maxSelected: STUDIO_SIGNAL_LIMITS.maxIds,
  maxLearnerText: 280,
  maxSerializedBytes: 16_384,
} as const;

export type StudioObservationKind = "error" | "success" | "output";

export interface StudioObservation {
  readonly kind: StudioObservationKind;
  readonly code?: string;
  readonly nodeId?: string;
}

export interface StudioSnapshotNode {
  readonly id: string;
  readonly kind: string;
}

/** Raw, untrusted input. Extra fields (paths, accounts, text) are ignored by the builder. */
export interface StudioContextInput {
  readonly missionId?: unknown;
  readonly missionVersion?: unknown;
  readonly learningTarget?: unknown;
  readonly programHash?: unknown;
  readonly snapshotNodes?: unknown;
  readonly selectedNodeIds?: unknown;
  readonly selectedRanges?: unknown;
  readonly observations?: unknown;
  readonly scaffoldHistory?: unknown;
  readonly locale?: unknown;
  /** Only text the learner explicitly submitted (for example into the intent bar). */
  readonly learnerSubmittedText?: unknown;
  readonly signal?: StudioSignal;
}

export interface StudioContext {
  readonly schema: typeof STUDIO_CONTEXT_SCHEMA_VERSION;
  readonly mission: {
    readonly id?: string;
    readonly version?: string;
    readonly learningTarget?: string;
  };
  readonly programHash?: string;
  readonly snapshot: {
    readonly nodes: readonly StudioSnapshotNode[];
    readonly truncated: boolean;
  };
  readonly selection: {
    readonly nodeIds: readonly string[];
    readonly ranges: readonly StudioSignalRange[];
  };
  readonly observations: readonly StudioObservation[];
  readonly scaffoldHistory: readonly LearningCompanionScaffoldLevel[];
  readonly locale?: string;
  readonly learnerText?: string;
  readonly signalKind?: StudioSignal["kind"];
}

const LOCALE_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const WIN_PATH = /\b[A-Za-z]:[\\/][^\s]*/g;
const UNIX_PATH = /(?:^|[\s("'=])(?:~|\.{1,2})?\/[^\s)"']+/g;
const URL = /\b[a-z][a-z0-9+.-]*:\/\/[^\s]+/gi;
const LONG_SECRET = /\b[A-Za-z0-9_-]{32,}\b/g;

/** Redact paths, URLs, emails and token-like strings from learner-submitted text, then cap it. */
export function sanitizeLearnerText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(URL, "[redacted]")
    .replace(EMAIL, "[redacted]")
    .replace(WIN_PATH, "[redacted]")
    .replace(UNIX_PATH, (m) => `${/^[\s("'=]/.test(m) ? m[0] : ""}[redacted]`)
    .replace(LONG_SECRET, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return undefined;
  return cleaned.slice(0, STUDIO_CONTEXT_LIMITS.maxLearnerText);
}

function sanitizeNodes(value: unknown): { nodes: StudioSnapshotNode[]; truncated: boolean } {
  const nodes: StudioSnapshotNode[] = [];
  let truncated = false;
  if (!Array.isArray(value)) return { nodes, truncated };
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const id = sanitizeStudioToken((item as Record<string, unknown>).id);
    const kind = sanitizeStudioToken((item as Record<string, unknown>).kind);
    if (id === undefined || kind === undefined) continue;
    if (nodes.length >= STUDIO_CONTEXT_LIMITS.maxSnapshotNodes) {
      truncated = true;
      break;
    }
    nodes.push({ id, kind });
  }
  return { nodes, truncated };
}

function sanitizeObservations(value: unknown): StudioObservation[] {
  if (!Array.isArray(value)) return [];
  const out: StudioObservation[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (rec.kind !== "error" && rec.kind !== "success" && rec.kind !== "output") continue;
    const code = sanitizeStudioToken(rec.code);
    const nodeId = sanitizeStudioToken(rec.nodeId);
    out.push({
      kind: rec.kind,
      ...(code !== undefined ? { code } : {}),
      ...(nodeId !== undefined ? { nodeId } : {}),
    });
  }
  // Keep the most recent observations.
  return out.slice(-STUDIO_CONTEXT_LIMITS.maxObservations);
}

function sanitizeScaffold(value: unknown): LearningCompanionScaffoldLevel[] {
  if (!Array.isArray(value)) return [];
  const out: LearningCompanionScaffoldLevel[] = [];
  for (const item of value) {
    if (item === 0 || item === 1 || item === 2 || item === 3 || item === 4 || item === 5) {
      out.push(item);
    }
  }
  return out.slice(-STUDIO_CONTEXT_LIMITS.maxScaffoldHistory);
}

function sanitizeLearningTarget(value: unknown): string | undefined {
  return sanitizeStudioToken(value);
}

/**
 * Deterministic, bounded, sanitized context. Same input => same output.
 * Only whitelisted fields are copied; everything else is dropped.
 */
export function buildStudioContext(input: StudioContextInput): StudioContext {
  const missionId = sanitizeStudioToken(input.missionId);
  const missionVersion = sanitizeStudioToken(
    typeof input.missionVersion === "number" ? String(input.missionVersion) : input.missionVersion,
  );
  const learningTarget = sanitizeLearningTarget(input.learningTarget);
  const programHash = sanitizeStudioToken(input.programHash);
  const locale =
    typeof input.locale === "string" && LOCALE_PATTERN.test(input.locale)
      ? input.locale
      : undefined;
  const learnerText = sanitizeLearnerText(input.learnerSubmittedText);
  const { nodes, truncated } = sanitizeNodes(input.snapshotNodes);
  const context: StudioContext = {
    schema: STUDIO_CONTEXT_SCHEMA_VERSION,
    mission: {
      ...(missionId !== undefined ? { id: missionId } : {}),
      ...(missionVersion !== undefined ? { version: missionVersion } : {}),
      ...(learningTarget !== undefined ? { learningTarget } : {}),
    },
    ...(programHash !== undefined ? { programHash } : {}),
    snapshot: { nodes, truncated },
    selection: {
      nodeIds: sanitizeStudioIds(input.selectedNodeIds).slice(0, STUDIO_CONTEXT_LIMITS.maxSelected),
      ranges: sanitizeStudioRanges(input.selectedRanges),
    },
    observations: sanitizeObservations(input.observations),
    scaffoldHistory: sanitizeScaffold(input.scaffoldHistory),
    ...(locale !== undefined ? { locale } : {}),
    ...(learnerText !== undefined ? { learnerText } : {}),
    ...(input.signal !== undefined ? { signalKind: input.signal.kind } : {}),
  };
  return enforceByteCap(context);
}

/** Hard cap: shed the largest optional parts until the serialized form fits. */
function enforceByteCap(context: StudioContext): StudioContext {
  const size = (c: StudioContext): number => new TextEncoder().encode(JSON.stringify(c)).length;
  let current = context;
  const max = STUDIO_CONTEXT_LIMITS.maxSerializedBytes;
  while (size(current) > max && current.snapshot.nodes.length > 0) {
    current = {
      ...current,
      snapshot: {
        nodes: current.snapshot.nodes.slice(0, Math.floor(current.snapshot.nodes.length / 2)),
        truncated: true,
      },
    };
  }
  if (size(current) > max) {
    current = Object.fromEntries(
      Object.entries(current).filter(([key]) => key !== "learnerText"),
    ) as unknown as StudioContext;
  }
  return current;
}
