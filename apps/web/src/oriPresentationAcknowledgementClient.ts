import { withAgorixSessionQueue } from "./accounts/sessionRequestQueue.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Best-effort presentation signal only. The server must authenticate, resolve
 * the ticket and compare its canonical description before recording.
 */
export async function acknowledgeOriPresentation(
  ticketId: string,
  description: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!UUID.test(ticketId) || !description || description.length > 512) return false;
  return withAgorixSessionQueue(async () => {
    try {
      const response = await fetchImpl("/api/tutor/ori/review/presented", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-agorix-request": "1" },
        body: JSON.stringify({ ticketId, description }),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  });
}
