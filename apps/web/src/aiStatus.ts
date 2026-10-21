/**
 * Learner-facing AI availability (issue #352). The adult enables AI on the server; the
 * browser only reads a same-origin health document and never holds a provider secret.
 *
 * Contract (served by the tutor API, #348): GET /api/tutor/health ->
 * `{ "configured": boolean, "available": boolean }`. Anything else, including a missing
 * endpoint, is normal local mode rather than an error.
 */
export type AiStatus = "local" | "connecting" | "active" | "unavailable";

export const AI_HEALTH_PATH = "/api/tutor/health";

export interface AiHealthDocument {
  readonly configured: boolean;
  readonly available: boolean;
}

export function resolveAiStatus(health: AiHealthDocument | undefined): AiStatus {
  if (health === undefined || !health.configured) return "local";
  return health.available ? "active" : "unavailable";
}

function parseHealth(value: unknown): AiHealthDocument | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { configured, available } = value as Record<string, unknown>;
  if (typeof configured !== "boolean") return undefined;
  return { configured, available: available === true };
}

export async function fetchAiStatus(
  fetchImpl: (path: string) => Promise<Response> = (path) =>
    fetch(path, { credentials: "same-origin", headers: { accept: "application/json" } }),
): Promise<AiStatus> {
  try {
    const response = await fetchImpl(AI_HEALTH_PATH);
    if (!response.ok) return "local";
    if (!(response.headers.get("content-type") ?? "").includes("application/json")) return "local";
    return resolveAiStatus(parseHealth(await response.json()));
  } catch {
    return "local";
  }
}

/** i18n keys per state; kept next to the state type so a new state cannot ship without copy. */
export const AI_STATUS_TITLE = {
  local: "aiStatusLocal",
  connecting: "aiStatusConnecting",
  active: "aiStatusActive",
  unavailable: "aiStatusUnavailable",
} as const satisfies Record<AiStatus, string>;

export const AI_STATUS_BODY = {
  local: "aiStatusLocalBody",
  connecting: "aiStatusConnectingBody",
  active: "aiStatusActiveBody",
  unavailable: "aiStatusUnavailableBody",
} as const satisfies Record<AiStatus, string>;

/** The learner's loop with the AI: ask, review the proposal, run, explain. */
export type AiStepId = "ask" | "review" | "run" | "explain";

export const AI_STEPS = [
  { id: "ask", label: "aiStepAsk" },
  { id: "review", label: "aiStepReview" },
  { id: "run", label: "aiStepRun" },
  { id: "explain", label: "aiStepExplain" },
] as const satisfies readonly { id: AiStepId; label: string }[];
