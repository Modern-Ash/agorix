/**
 * Platform-neutral Studio Agent signals (issue #244).
 * Pure, serializable, versioned data. No host (VS Code/browser) or provider imports.
 */
export const STUDIO_SIGNAL_SCHEMA_VERSION = "agorix/studio-signal/v1";

export const STUDIO_SIGNAL_KINDS = [
  "selection-changed",
  "runtime-error",
  "runtime-success",
  "stalled",
  "repeated-error",
  "repeat-pattern",
  "first-step",
  "proposal-decided",
  "idle",
] as const;

export type StudioSignalKind = (typeof STUDIO_SIGNAL_KINDS)[number];
export type StudioProposalDecision = "accepted" | "rejected" | "modified";

export const STUDIO_SIGNAL_LIMITS = {
  maxIds: 16,
  maxToken: 64,
  maxCount: 1_000_000,
  maxSeconds: 86_400,
  maxLine: 1_000_000,
} as const;

/** Opaque, bounded identifier: never a path, never free text. */
export const STUDIO_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

export interface StudioSignalRange {
  readonly startLine: number;
  readonly endLine: number;
}

/** Closed payload: only whitelisted, sanitized fields exist on a signal. */
export interface StudioSignalPayload {
  readonly nodeIds?: readonly string[];
  readonly ranges?: readonly StudioSignalRange[];
  /** Short machine code such as a runtime error code; never a message. */
  readonly code?: string;
  /** repeated-error / repeat-pattern / first-step occurrences. */
  readonly occurrences?: number;
  /** stalled / idle duration in whole seconds. */
  readonly seconds?: number;
  readonly decision?: StudioProposalDecision;
  readonly proposalId?: string;
}

export interface StudioSignal extends StudioSignalPayload {
  readonly schema: typeof STUDIO_SIGNAL_SCHEMA_VERSION;
  readonly kind: StudioSignalKind;
  /** Monotonic ordinal supplied by the emitter; no wall-clock or identity data. */
  readonly sequence: number;
}

export function isStudioSignalKind(value: unknown): value is StudioSignalKind {
  return typeof value === "string" && (STUDIO_SIGNAL_KINDS as readonly string[]).includes(value);
}

export function sanitizeStudioToken(value: unknown): string | undefined {
  return typeof value === "string" && STUDIO_TOKEN_PATTERN.test(value) ? value : undefined;
}

function clampInt(value: unknown, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

export function sanitizeStudioIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const token = sanitizeStudioToken(item);
    if (token !== undefined && !out.includes(token)) out.push(token);
    if (out.length >= STUDIO_SIGNAL_LIMITS.maxIds) break;
  }
  return out;
}

export function sanitizeStudioRanges(value: unknown): readonly StudioSignalRange[] {
  if (!Array.isArray(value)) return [];
  const out: StudioSignalRange[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const start = clampInt(
      (item as Record<string, unknown>).startLine,
      STUDIO_SIGNAL_LIMITS.maxLine,
    );
    const end = clampInt((item as Record<string, unknown>).endLine, STUDIO_SIGNAL_LIMITS.maxLine);
    if (start === undefined || end === undefined) continue;
    out.push({ startLine: Math.min(start, end), endLine: Math.max(start, end) });
    if (out.length >= STUDIO_SIGNAL_LIMITS.maxIds) break;
  }
  return out;
}

/**
 * Build a signal from untrusted input. Unknown fields are dropped, strings must be
 * opaque tokens, numbers are clamped. Returns undefined for an unknown kind.
 */
export function createStudioSignal(
  kind: unknown,
  sequence: number,
  payload: Readonly<Record<string, unknown>> = {},
): StudioSignal | undefined {
  if (!isStudioSignalKind(kind)) return undefined;
  const nodeIds = sanitizeStudioIds(payload.nodeIds);
  const ranges = sanitizeStudioRanges(payload.ranges);
  const code = sanitizeStudioToken(payload.code);
  const proposalId = sanitizeStudioToken(payload.proposalId);
  const occurrences = clampInt(payload.occurrences, STUDIO_SIGNAL_LIMITS.maxCount);
  const seconds = clampInt(payload.seconds, STUDIO_SIGNAL_LIMITS.maxSeconds);
  const decision =
    payload.decision === "accepted" ||
    payload.decision === "rejected" ||
    payload.decision === "modified"
      ? payload.decision
      : undefined;
  return {
    schema: STUDIO_SIGNAL_SCHEMA_VERSION,
    kind,
    sequence: clampInt(sequence, Number.MAX_SAFE_INTEGER) ?? 0,
    ...(nodeIds.length > 0 ? { nodeIds } : {}),
    ...(ranges.length > 0 ? { ranges } : {}),
    ...(code !== undefined ? { code } : {}),
    ...(proposalId !== undefined ? { proposalId } : {}),
    ...(occurrences !== undefined ? { occurrences } : {}),
    ...(seconds !== undefined ? { seconds } : {}),
    ...(decision !== undefined ? { decision } : {}),
  };
}
