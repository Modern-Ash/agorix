import { AI_HEALTH_PATH } from "../aiStatus.js";

export interface AdultAiHealth {
  readonly configured: boolean;
  readonly available: boolean;
  readonly providerInUse: "deterministic" | "openai-compatible";
  readonly lastErrorClass: string | null;
}

const LOCAL: AdultAiHealth = {
  configured: false,
  available: false,
  providerInUse: "deterministic",
  lastErrorClass: null,
};

const ERROR_CLASSES = new Set([
  "unsupported-capability",
  "timeout",
  "cancelled",
  "not-configured",
  "authentication-failed",
  "provider-unavailable",
  "provider-error",
  "invalid-response",
]);

export async function fetchAdultAiHealth(
  fetchImpl: (path: string) => Promise<Response> = (path) =>
    fetch(path, { credentials: "same-origin", headers: { accept: "application/json" } }),
): Promise<AdultAiHealth> {
  try {
    const response = await fetchImpl(AI_HEALTH_PATH);
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("application/json"))
      return LOCAL;
    const value = (await response.json()) as Record<string, unknown>;
    if (
      typeof value.configured !== "boolean" ||
      typeof value.available !== "boolean" ||
      (value.providerInUse !== "deterministic" && value.providerInUse !== "openai-compatible") ||
      (value.lastErrorClass !== null &&
        (typeof value.lastErrorClass !== "string" || !ERROR_CLASSES.has(value.lastErrorClass)))
    )
      return LOCAL;
    return {
      configured: value.configured,
      available: value.available,
      providerInUse: value.providerInUse,
      lastErrorClass: value.lastErrorClass,
    };
  } catch {
    return LOCAL;
  }
}
