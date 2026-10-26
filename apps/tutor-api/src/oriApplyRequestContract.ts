/**
 * Strict browser-to-host contract for requesting application of an already
 * accepted Ori review ticket. The authenticated host resolves owner, project,
 * revision, permissions and proposal independently; none are browser inputs.
 */
export interface OriApplyRequest {
  readonly ticketId: string;
  readonly scriptId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCRIPT_ID = /^[a-zA-Z0-9_-]{1,80}$/;

export function parseOriApplyRequest(raw: unknown): OriApplyRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if (
    Object.keys(data).sort().join() !== "scriptId,ticketId" ||
    typeof data["ticketId"] !== "string" ||
    !UUID.test(data["ticketId"]) ||
    typeof data["scriptId"] !== "string" ||
    !SCRIPT_ID.test(data["scriptId"])
  ) return null;
  return Object.freeze({
    ticketId: data["ticketId"],
    scriptId: data["scriptId"],
  });
}
