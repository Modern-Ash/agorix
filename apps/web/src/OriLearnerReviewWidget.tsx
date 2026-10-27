import { useState } from "react";
import { requestOriProposal, type OriIssuedProposal } from "./oriProposalIssuanceClient.js";
import { OriLearnerProposalReview } from "./OriLearnerProposalReview.js";

/**
 * Opt-in learner UI. No proposal can be created locally: the server must
 * authenticate, authorize and issue an opaque ticket first.
 */
export function OriLearnerReviewWidget() {
  const [issued, setIssued] = useState<OriIssuedProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const request = async () => {
    if (loading) return;
    setLoading(true);
    setError(false);
    setIssued(null);
    try {
      const proposal = await requestOriProposal();
      if (!proposal) setError(true);
      setIssued(proposal);
    } finally {
      setLoading(false);
    }
  };
  return (
    <section aria-label="Propuestas educativas de Ori" data-testid="ori-learner-review-widget">
      <h3>Ori · Una propuesta para explorar</h3>
      <p>
        Ori puede sugerir un paso. Vos decidís qué hacer y tu programa no cambia automáticamente.
      </p>
      <button type="button" disabled={loading} onClick={() => void request()}>
        {loading ? "Preparando propuesta…" : "Pedir una propuesta"}
      </button>
      {error ? (
        <p role="status">No hay una propuesta disponible. Podés continuar programando.</p>
      ) : null}
      {issued ? (
        <OriLearnerProposalReview
          input={{
            ticketId: issued.ticketId,
            proposal: issued.proposal,
          }}
        />
      ) : null}
    </section>
  );
}
