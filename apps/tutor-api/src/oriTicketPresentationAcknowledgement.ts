import { createHash } from "node:crypto";
import type { OriReviewTicket } from "./oriReviewRegistry.js";

/**
 * Server-only presentation acknowledgement. A browser signal is untrusted;
 * the host must resolve the ticket under the authenticated owner/project.
 * No child-facing rollout or pedagogical approval follows from this record.
 */
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
        const descriptionHash = createHash("sha256").update(description).digest("hex");
        return await record({ owner, projectId, ticketId, descriptionHash })
          ? "recorded" : "unavailable";
      } catch {
        return "unavailable";
      }
    },
  });
}
