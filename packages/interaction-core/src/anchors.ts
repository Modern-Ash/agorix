export const ANCHOR_KINDS = [
  "node",
  "error",
  "worldEntity",
  "evidenceRow",
  "paletteItem",
  "missionGoal",
] as const;

export type AnchorKind = (typeof ANCHOR_KINDS)[number];

export interface AgentAnchorRef {
  readonly kind: AnchorKind;
  readonly id: string;
}

/** Mirrors STUDIO_TOKEN_PATTERN: opaque bounded identifier, never a path or free text. */
const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

export function isAnchorKind(value: unknown): value is AnchorKind {
  return typeof value === "string" && (ANCHOR_KINDS as readonly string[]).includes(value);
}

export function isSafeId(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function createAnchorRef(kind: AnchorKind, id: string): AgentAnchorRef {
  if (!isAnchorKind(kind) || !isSafeId(id)) {
    throw new RangeError("invalid agent anchor");
  }
  return { kind, id };
}

export function parseAnchorRef(value: unknown): AgentAnchorRef | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { kind, id } = value as { kind?: unknown; id?: unknown };
  if (!isAnchorKind(kind) || !isSafeId(id)) {
    return undefined;
  }
  return { kind, id };
}
