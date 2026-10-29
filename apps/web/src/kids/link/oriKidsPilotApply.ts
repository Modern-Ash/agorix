import { withAgorixSessionQueue } from "../../accounts/sessionRequestQueue.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function applyOriKidsPilotProposal(
  ticketId: string,
  scriptId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"applied" | "conflict" | "unavailable"> {
  if (!UUID.test(ticketId) || !scriptId || scriptId.length > 128) return "unavailable";
  return withAgorixSessionQueue(async () => {
    try {
      const response = await fetchImpl("/api/tutor/ori/review/apply", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-agorix-request": "1" },
        body: JSON.stringify({ ticketId, scriptId }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 409) return "conflict";
      if (!response.ok) return "unavailable";
      const raw: unknown = await response.json();
      return raw &&
        typeof raw === "object" &&
        !Array.isArray(raw) &&
        Object.keys(raw).length === 1 &&
        (raw as Record<string, unknown>)["status"] === "applied"
        ? "applied"
        : "unavailable";
    } catch {
      return "unavailable";
    }
  });
}
