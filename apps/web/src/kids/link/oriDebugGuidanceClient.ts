import { withAgorixSessionQueue } from "../../accounts/sessionRequestQueue.js";

export interface OriDebugGuidance {
  readonly schema: "agorix/ori-debug-guidance/v1";
  readonly nextStep: string;
  readonly question: "Preguntarse si ese paso produjo lo que esperabas";
  readonly appliedChanges: false;
}

export function parseOriDebugGuidance(raw: unknown): OriDebugGuidance | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).sort().join() !== "appliedChanges,nextStep,question,schema" ||
    value["schema"] !== "agorix/ori-debug-guidance/v1" ||
    typeof value["nextStep"] !== "string" ||
    !/^Revisar el paso (?:[1-9]|[1-9][0-9]|100) de la traza verificada por el host$/.test(
      value["nextStep"],
    ) ||
    value["question"] !== "Preguntarse si ese paso produjo lo que esperabas" ||
    value["appliedChanges"] !== false
  )
    return null;
  return value as unknown as OriDebugGuidance;
}

export async function requestOriDebugGuidance(
  fetchImpl: typeof fetch = fetch,
): Promise<OriDebugGuidance | null> {
  return withAgorixSessionQueue(async () => {
    try {
      const response = await fetchImpl("/api/tutor/ori/review/debug", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-agorix-request": "1" },
        body: "{}",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return null;
      return parseOriDebugGuidance(await response.json());
    } catch {
      return null;
    }
  });
}
