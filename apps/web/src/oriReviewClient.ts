export interface OriReviewPreview {
  readonly status: "ready" | "unavailable";
  readonly hint?: string;
  readonly nextStep?: string;
  readonly requiresLearnerApproval: true;
  readonly appliedChanges: false;
}
const unavailable: OriReviewPreview = {
  status: "unavailable",
  requiresLearnerApproval: true,
  appliedChanges: false,
};
export async function requestOriReviewPreview(
  intent: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OriReviewPreview> {
  if (!["help", "repeat", "turn", "move", "debug"].includes(intent)) return unavailable;
  try {
    const response = await fetchImpl("/api/tutor/ori/runtime-preview", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent }),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("application/json"))
      return unavailable;
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return unavailable;
    const record = value as Record<string, unknown>;
    if (
      record["status"] !== "ready" ||
      record["requiresLearnerApproval"] !== true ||
      record["appliedChanges"] !== false ||
      typeof record["hint"] !== "string" ||
      record["hint"].length < 1 ||
      record["hint"].length > 180 ||
      typeof record["nextStep"] !== "string" ||
      record["nextStep"].length > 240
    )
      return unavailable;
    return {
      status: "ready",
      hint: record["hint"],
      nextStep: record["nextStep"],
      requiresLearnerApproval: true,
      appliedChanges: false,
    };
  } catch {
    return unavailable;
  }
}
