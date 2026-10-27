import { useEffect, useRef, useState } from "react";
import { requestOriReviewDecision } from "./oriReviewDecisionClient.js";
import { parseOriServerDecision } from "./oriServerDecision.js";
import { describeOriProposal, parseOriReviewableProposal } from "./oriProposalReview.js";

export type OriLearnerDecision = "accept" | "edit" | "reject";
export interface OriLearnerProposalInput {
  readonly ticketId: string;
  readonly proposal: unknown;
}
export interface OriLearnerProposalReviewProps {
  readonly input: OriLearnerProposalInput | undefined;
  /** Must call an authenticated server-owned decision endpoint, never write a project. */
  readonly onDecision?: (ticketId: string, decision: OriLearnerDecision) => Promise<unknown>;
  /** Presentation signal only; not proof of learner attention or server authorization. */
  readonly onPresented?: (ticketId: string, description: string) => void;
}
export function OriLearnerProposalReview({ input, onDecision, onPresented }: OriLearnerProposalReviewProps) {
  const [pending, setPending] = useState(false);
  const lastPresented = useRef<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const proposal = input ? parseOriReviewableProposal(input.proposal) : null;
  const ticketId = input?.ticketId;
  const description = proposal ? describeOriProposal(proposal) : null;
  useEffect(() => {
    if (!ticketId || !description || !onPresented) return;
    const presentationKey = JSON.stringify([ticketId, description]);
    if (lastPresented.current === presentationKey) return;
    lastPresented.current = presentationKey;
    onPresented(ticketId, description);
  }, [ticketId, description, onPresented]);
  if (!input || !proposal || !ticketId) return null;

  const choose = async (decision: OriLearnerDecision) => {
    if (pending || result !== null) return;
    setPending(true);
    try {
      const outcome = await (onDecision ?? requestOriReviewDecision)(input.ticketId, decision);
      setResult(
        typeof outcome === "string"
          ? ["accepted", "edited", "rejected", "stale"].includes(outcome)
            ? outcome
            : "unavailable"
          : parseOriServerDecision(outcome),
      );
    } catch {
      setResult("unavailable");
    } finally {
      setPending(false);
    }
  };
  return (
    <section aria-label="Propuesta de Ori" data-testid="ori-proposal-review">
      <h3>Ori propone un paso</h3>
      <p>{description}</p>
      <p>Esta propuesta no modifica tu programa. Primero tenés que revisarla.</p>
      {result === "stale" ? (
        <p role="alert">La propuesta ya no corresponde al proyecto actual.</p>
      ) : null}
      {result === "unavailable" ? (
        <p role="alert">No se pudo registrar la decisión. Pedí una propuesta nueva.</p>
      ) : null}
      {result && !["stale", "unavailable"].includes(result) ? (
        <p role="status">Decisión confirmada por el servidor: {result}. No se aplicaron cambios.</p>
      ) : null}
      {result === null ? (
        <div>
          <button type="button" disabled={pending} onClick={() => void choose("accept")}>
            Aceptar propuesta
          </button>
          <button type="button" disabled={pending} onClick={() => void choose("edit")}>
            Quiero editarla
          </button>
          <button type="button" disabled={pending} onClick={() => void choose("reject")}>
            Rechazar propuesta
          </button>
        </div>
      ) : null}
    </section>
  );
}
