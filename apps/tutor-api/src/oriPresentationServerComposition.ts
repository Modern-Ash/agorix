import type { OriReviewIdentityResolver } from "./oriReviewHttpContract.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";
import { createOriTicketPresentationAcknowledgement } from "./oriTicketPresentationAcknowledgement.js";
import { createOriPresentationAckHttpHandler } from "./oriPresentationAckHttpHandler.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";

/**
 * Opt-in server composition. Caller owns the authenticated identity resolver,
 * project-scoped ticket lookup and durable database lifecycle.
 */
export function createOriPresentationServerComposition({
  identity,
  resolveTicket,
  store,
}: {
  readonly identity: OriReviewIdentityResolver;
  readonly resolveTicket: (owner: string, projectId: string, ticketId: string) =>
    Promise<OriReviewTicket | null>;
  readonly store: ReturnType<typeof openOriTicketPresentationSqliteStore>;
}) {
  const service = createOriTicketPresentationAcknowledgement({
    resolveTicket,
    record: store.record,
  });
  return Object.freeze({
    oriPresentationAckEnabled: true as const,
    oriPresentationAckHandler: createOriPresentationAckHttpHandler(identity, service),
  });
}
