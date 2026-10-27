import { createHash } from "node:crypto";
import type { OriReviewTicket } from "./oriReviewRegistry.js";

/**
 * Server-only presentation acknowledgement. A browser signal is untrusted;
 * the host must resolve the ticket under the authenticated owner/project.
 * No child-facing rollout or pedagogical approval follows from this record.
 */
/** Strict server-owned description of the validated single-block proposal. */
function canonicalDescription(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (Object.keys(p).sort().join() !== "blocks,operation,requiresLearnerApproval,schemaVersion" ||
      p["schemaVersion"] !== "ori/proposal/v0" || p["operation"] !== "append" ||
      p["requiresLearnerApproval"] !== true || !Array.isArray(p["blocks"]) ||
      p["blocks"].length !== 1) return null;
  const b = p["blocks"][0];
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const block = b as Record<string, unknown>;
  if (block["kind"] === "move" && Object.keys(block).sort().join() === "kind,steps" &&
      Number.isSafeInteger(block["steps"]) && (block["steps"] as number) >= 1 &&
      (block["steps"] as number) <= 5)
    return `Agregar movimiento de ${block["steps"]} paso(s)`;
  if (block["kind"] === "turn" && Object.keys(block).sort().join() === "direction,kind" &&
      (block["direction"] === "left" || block["direction"] === "right"))
    return `Agregar giro hacia ${block["direction"] === "left" ? "la izquierda" : "la derecha"}`;
  return null;
}

export function createOriTicketPresentationAcknowledgement({
  resolveTicket,
  record,
}: {
  readonly resolveTicket: (owner: string, projectId: string, ticketId: string) =>
    Promise<OriReviewTicket | null>;
  readonly record: (entry: {
    readonly owner: string;
    readonly projectId: string;
    readonly ticketId: string;
    readonly descriptionHash: string;
  }) => Promise<boolean>;
}) {
  return Object.freeze({
    async acknowledge(owner: string, projectId: string, ticketId: string,
      description: string): Promise<"recorded" | "invalid" | "unavailable"> {
      if (!owner || owner.length > 128 || !projectId || projectId.length > 128 ||
          !/^[0-9a-f-]{36}$/i.test(ticketId) ||
          typeof description !== "string" ||
          description.trim().length < 8 || description.length > 512)
        return "invalid";
      try {
        const ticket = await resolveTicket(owner, projectId, ticketId);
        if (!ticket || ticket.id !== ticketId || ticket.status !== "pending" ||
            ticket.appliedChanges !== false) return "invalid";
        const expected = canonicalDescription(ticket.proposal);
        if (!expected || expected !== description) return "invalid";
        const descriptionHash = createHash("sha256").update(expected).digest("hex");
        return await record({ owner, projectId, ticketId, descriptionHash })
          ? "recorded" : "unavailable";
      } catch {
        return "unavailable";
      }
    },
  });
}
